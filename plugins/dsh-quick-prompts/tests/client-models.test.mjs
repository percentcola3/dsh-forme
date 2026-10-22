import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createTasks } from '../src/client/tasks.ts'
import { modelKey, TaskModelPicker } from '../src/client/model-picker.ts'
const choice = { provider: 'provider/a', model: 'model:b', label: '示例模型', providerLabel: '示例提供方' }

test('model catalog requests use the current session/project and do not mutate the parent', async () => {
  const calls = []
  const tasks = createTasks(async (action, body) => {
    calls.push([action, body])
    return action === 'list' ? { projectId: 'project', cwd: '/sample', prompts: [] } : { projectId: 'project', models: [choice] }
  })
  await assert.rejects(tasks.models(), /尚未就绪/)
  await tasks.select('parent')
  assert.deepEqual(await tasks.models(), [choice])
  assert.deepEqual(calls, [['list', { sessionId: 'parent' }], ['models', { sessionId: 'parent', projectId: 'project' }]])
})
test('late catalog response cannot cross into another selected session', async () => {
  let resolve
  const tasks = createTasks(async (action, body) => action === 'list'
    ? { projectId: body.sessionId, cwd: '/sample', prompts: [] }
    : new Promise(done => { resolve = done }))
  await tasks.select('first')
  const result = assert.rejects(tasks.models(), /项目已切换/)
  await tasks.select('second')
  resolve({ projectId: 'first', models: [choice] })
  await result
})
test('malformed or stale model catalog responses surface errors', async () => {
  let response = { projectId: 'project' }
  const tasks = createTasks(async action => action === 'list' ? { projectId: 'project', cwd: '/sample', prompts: [] } : response)
  await tasks.select('parent')
  await assert.rejects(tasks.models(), /暂不可用/)
  response = { projectId: 'other', models: [choice] }
  await assert.rejects(tasks.models(), /项目已切换/)
})
test('saving a task forwards the fixed route, and resetting omits it from JSON', async () => {
  const saved = []
  const tasks = createTasks(async (action, body) => {
    if (action === 'save') saved.push(JSON.parse(JSON.stringify(body)))
    return { projectId: 'project', cwd: '/sample', prompts: [] }
  })
  await tasks.select('parent')
  const draft = { id: 'task', name: '检查', text: '检查项目', model: { provider: choice.provider, model: choice.model } }
  await tasks.save('save', draft)
  await tasks.save('save', { ...draft, model: undefined })
  assert.deepEqual(saved[0].model, draft.model)
  assert.equal('model' in saved[1], false)
})
test('saved model remains selected during initial catalog loading', () => {
  const html = renderToStaticMarkup(React.createElement(TaskModelPicker, {
    tasks: { models: async () => [choice] }, value: choice, disabled: false, onChange() {},
  }))
  assert.match(html, /跟随当前会话模型/)
  assert.match(html, /正在核对/)
  assert.match(html, /selected=""/)
  assert.notEqual(modelKey({ provider: 'a:b', model: 'c' }), modelKey({ provider: 'a', model: 'b:c' }))
})
