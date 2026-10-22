import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { HeadlessRuntime } from '../src/headless-runtime.ts'
import { ConversationCard } from '../src/client/conversation-card.ts'
import { createTasks, openRun } from '../src/client/tasks.ts'

function fixture() {
  const calls = [], events = [], prompts = []
  const parent = { id: 'main', options: { provider: 'p', model: 'base' }, ctx: { get(name) { return { sandboxPolicy: { overrideOf: () => 'workspace-write' }, permissionPresets: { current: () => 'auto' }, agentPresets: { composedPreset: () => 'standard' } }[name] } }, session: { header: { id: 'main', cwd: '/project' }, snapshotEvents: () => [] } }
  const scope = { get(name) { return { agentPresets: { composeFrom: (...args) => calls.push(['compose', ...args]) }, tools: { guard: guard => calls.push(['guard', guard]) }, workingDirectory: { set: async (_agent, cwd) => calls.push(['cwd', cwd]) } }[name] } }
  const agent = { id: 'child', ctx: scope, session: { append: (...args) => events.push(args) }, followup: message => prompts.push(message), cancel: (...args) => calls.push(['cancel', ...args]) }
  const registry = { async create(options) { calls.push(['create', options]); await options.setup(scope, agent); return { agent, async dispose() { calls.push(['dispose']) } } } }
  const runtime = new HeadlessRuntime(registry)
  const spec = { childId: 'child', label: 'task', provider: 'spawn', delivery: 'caller', request: { parent, cwd: '/project', prompt: [{ type: 'text', text: 'work' }] }, signal: new AbortController().signal }
  return { calls, events, prompts, parent, runtime, spec, registry }
}
test('headless task has hidden origin, no parent activation, fixed permissions and direct follow-up', async () => {
  const f = fixture()
  const receipt = await f.runtime.startActivation(f.spec)
  const options = f.calls.find(([name]) => name === 'create')[1]
  assert.equal(options.meta.origin, 'subagent')
  assert.equal(options.parentAgent, undefined)
  assert.equal(options.seed, undefined)
  assert.equal(options.workspaceId, undefined)
  assert.deepEqual(options.agentOptions, { provider: 'p', model: 'base' })
  assert.deepEqual(f.events, [['sandbox/mode', { mode: 'workspace-write', source: 'delegation' }], ['approval/policy', { policy: 'never', source: 'delegation' }], ['permission/preset', { preset: 'auto' }]])
  const guard = f.calls.find(([name]) => name === 'guard')[1]
  for (const name of ['send_message', 'ask_user_question', 'subagent']) assert.equal(typeof guard({ name }), 'string')
  assert.equal(guard({ name: 'bash' }), undefined)
  let settled = false; receipt.result.then(() => { settled = true })
  f.runtime.observe('main', { type: 'turn/end', data: { reason: { kind: 'completed' } } }); await Promise.resolve()
  assert.equal(settled, false)
  f.runtime.observe('child', { type: 'turn/end', data: { reason: { kind: 'completed' } } })
  assert.deepEqual(await receipt.result, { stopReason: 'completed' })
  await f.runtime.prompt({ childSessionId: 'child', requestId: 'next', content: [{ type: 'text', text: 'continue' }] }, f.spec.signal)
  assert.equal(f.prompts.length, 2); assert.equal(f.calls.filter(([name]) => name === 'create').length, 1)
  assert.deepEqual(f.prompts[1], { id: 'next', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'continue' }] })
  f.runtime.interrupt('main'); assert.ok(!f.calls.some(([name]) => name === 'cancel'))
  await receipt.dispose(); await receipt.dispose()
  assert.equal(f.calls.filter(([name]) => name === 'dispose').length, 1)
  await assert.rejects(f.runtime.prompt({ childSessionId: 'child' }, f.spec.signal), /已关闭/)
})
test('cancellation after headless creation releases the handle without sending a prompt', async () => {
  const f = fixture(), abort = new AbortController()
  const create = f.registry.create
  f.registry.create = async options => { const handle = await create(options); abort.abort(); return handle }
  await assert.rejects(f.runtime.startActivation({ ...f.spec, signal: abort.signal }))
  assert.equal(f.prompts.length, 0)
  assert.equal(f.calls.filter(([name]) => name === 'dispose').length, 1)
})
test('headless cards retain conversation input without a full-session navigation action', () => {
  const tasks = createTasks()
  const run = { id: 'run', name: '推送', sessionKind: 'headless', status: 'completed', messages: [{ id: 'a', role: 'assistant', text: 'done' }] }
  const ctx = { get() { throw new Error('headless card must not navigate') } }
  const markup = renderToStaticMarkup(React.createElement(ConversationCard, { ctx, tasks, run }))
  assert.match(markup, /textarea/); assert.match(markup, /done/); assert.doesNotMatch(markup, /完整对话|↗/)
  openRun(ctx, run)
})
