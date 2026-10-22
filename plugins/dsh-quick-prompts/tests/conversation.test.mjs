import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ConversationRuntime } from '../src/conversation-runtime.ts'
import { TaskManager, CONTEXT } from '../src/task-manager.ts'
import { createTasks, openRun, ongoingRuns, sessionRuns } from '../src/client/tasks.ts'
import { ConversationCard } from '../src/client/conversation-card.ts'
const tick = () => new Promise(resolve => setImmediate(resolve))
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
function fixture() {
  const calls = [], models = [], hooks = new Map()
  const agents = new Map()
  let gate
  const controller = {
    async create(request) {
      calls.push(['create', request])
      const events = []
      const agent = { id: request.sessionId, cancel: (_reason, options) => calls.push(['agent-cancel', { id: request.sessionId, ...options }]), session: { header: {}, snapshotEvents: () => events, append: (type, data) => { events.push({ type, data }); models.push({ type, data }) } }, ctx: { on: (name, listener, options) => { hooks.set(name, { listener, options }); return () => hooks.delete(name) } } }
      agents.set(request.sessionId, agent)
      return { sessionId: request.sessionId }
    },
    async resolveAgent(id) { return { agent: agents.get(id) } },
    async rename(request) { calls.push(['rename', request]) },
    async prompt(request, signal) { calls.push(['prompt', request]); if (gate) await gate.promise; signal.throwIfAborted(); return { accepted: true } },
    async cancel(request) { calls.push(['cancel', request]); return { accepted: true } },
  }
  const runtime = new ConversationRuntime(controller)
  const manager = new TaskManager(runtime)
  const parent = { id: 'main', options: { provider: 'parent-provider', model: 'parent-model' }, session: { header: { id: 'main', cwd: '/code', agentPreset: 'standard' }, snapshotEvents: () => [] } }
  const prompt = { id: 'shortcut', name: '检查代码', text: '请检查当前代码' }
  let run
  const start = async (overrides = {}) => { run = manager.start(parent, { ...prompt, ...overrides }, 'start'); await tick(); return run }
  const emit = (type, data = {}) => { manager.observe(run.childId, { type, data }); runtime.observe(run.childId, { type, data }) }
  const complete = async (text = '检查完成') => { emit('assistant/message', { message: { content: [{ type: 'text', text }] } }); emit('turn/end', { reason: { kind: 'completed' } }); await tick() }
  return { manager, runtime, calls, hooks, models, parent, start, emit, complete, hold: () => (gate = deferred()), get run() { return manager.list()[0] } }
}
test('shortcut starts an ordinary independent session with real human prompt, preset and isolated model', async () => {
  const f = fixture(); const run = await f.start({ model: { provider: 'fixed', model: 'fast' } })
  const created = f.calls.find(([action]) => action === 'create')[1]
  assert.deepEqual(created, { sessionId: run.childId, cwd: '/code', agentPreset: 'standard' })
  const prompt = f.calls.find(([action]) => action === 'prompt')[1]
  assert.equal(prompt.sessionId, run.childId); assert.equal(prompt.mode, 'queue')
  assert.deepEqual(prompt.content, [{ type: 'text', text: CONTEXT }, { type: 'text', text: '请检查当前代码' }])
  assert.equal(f.run.sessionKind, 'conversation')
  assert.deepEqual(f.models[0], { type: 'model/selection', data: { provider: 'fixed', model: 'fast' } })
  assert.equal(f.hooks.get('agent/request').options.prepend, true)
  const assembly = await f.hooks.get('system-prompt/assemble').listener({}, {}, async () => ({ variables: { other: 'kept' } }))
  assert.deepEqual(assembly.variables, { other: 'kept', provider: 'fixed', model: 'fast' })
  const config = await f.hooks.get('agent/request').listener({}, async () => ({ provider: 'global', model: 'global', reasoningEffort: 'max', temperature: 0.5 }))
  assert.deepEqual(config, { provider: 'fixed', model: 'fast', temperature: 0.5 })
  assert.deepEqual(f.parent.options, { provider: 'parent-provider', model: 'parent-model' })
  assert.ok(!f.calls.some(([name]) => name === 'selectModel'), 'global defaults never changed')
  await f.complete(); await f.manager.dispose(); assert.equal(f.hooks.size, 0)
})
test('card transcript streams AI text without exposing tool logs or reasoning and retains results', async () => {
  const f = fixture(); const run = await f.start()
  f.manager.stream(run.childId, { type: 'start', attemptId: 'a' })
  f.manager.stream(run.childId, { type: 'chunk', attemptId: 'a', index: 0, chunk: { type: 'reasoning-delta', text: 'private' } })
  f.manager.stream(run.childId, { type: 'chunk', attemptId: 'a', index: 1, chunk: { type: 'text-delta', text: '正在检查' } })
  f.emit('tool/result', { message: { content: [{ type: 'text', text: 'raw stdout' }] } })
  assert.deepEqual(f.run.messages.map(message => message.text), ['请检查当前代码', '正在检查'])
  await f.complete('完整结果')
  assert.deepEqual(f.run.messages.map(message => message.text), ['请检查当前代码', '完整结果'])
  assert.equal(ongoingRuns(f.manager.list()).length, 1)
  await f.manager.dispose()
})
test('follow-up reuses the same session, dedupes simultaneous retries and finishes a second turn', async () => {
  const f = fixture(); await f.start(); await f.complete()
  const gate = f.hold()
  const first = f.manager.reply(f.run.id, f.run.projectId, '再解释一下', 'message-2')
  const duplicate = f.manager.reply(f.run.id, f.run.projectId, '再解释一下', 'message-2')
  await assert.rejects(f.manager.reply(f.run.id, f.run.projectId, 'another', 'other'), /正在回复/)
  await tick(); assert.equal(f.calls.filter(([a]) => a === 'prompt').length, 2)
  gate.resolve(); await Promise.all([first, duplicate])
  f.emit('turn/start'); await f.complete('这是详细解释')
  assert.equal(f.run.status, 'completed')
  assert.deepEqual(f.run.messages.map(message => message.text), ['请检查当前代码', '检查完成', '再解释一下', '这是详细解释'])
  const requests = f.calls.filter(([a]) => a === 'prompt').map(([, request]) => request)
  assert.ok(requests.every(request => request.sessionId === f.run.childId))
  assert.deepEqual(requests[1].content, [{ type: 'text', text: '再解释一下' }])
  await f.manager.reply(f.run.id, f.run.projectId, '再解释一下', 'message-2')
  assert.equal(f.calls.filter(([a]) => a === 'prompt').length, 2)
  await assert.rejects(f.manager.reply(f.run.id, f.run.projectId, 'changed', 'message-2'), /编号/)
  await f.manager.dispose()
})
test('foreign project, approval, invalid input and dismissed card cannot receive follow-ups', async () => {
  const f = fixture(); await f.start(); await f.complete()
  await assert.rejects(f.manager.reply(f.run.id, 'foreign', 'hi', 'id'), /不属于/)
  for (const text of ['', ' ', 'x\0y', 'x'.repeat(32001)]) await assert.rejects(f.manager.reply(f.run.id, f.run.projectId, text, 'id'), /不能为空/)
  const gate = f.hold(); const pending = f.manager.reply(f.run.id, f.run.projectId, 'hi', 'id'); gate.resolve(); await pending
  f.emit('approval/asked', { id: 'approve' })
  await assert.rejects(f.manager.reply(f.run.id, f.run.projectId, 'approve', 'approval'), /完整对话/)
  f.emit('approval/decided', { id: 'approve' }); await f.complete()
  const { id, projectId } = f.run
  f.manager.close(id, projectId)
  await assert.rejects(f.manager.reply(id, projectId, 'hi', 'closed'), /已关闭/)
  await tick(); assert.equal(f.hooks.size, 0, 'closing releases session model hooks')
  await f.manager.dispose()
})
test('failed admission retains client draft opportunity and retry uses the same request ID', async () => {
  const f = fixture(); await f.start(); await f.complete()
  const gate = f.hold(); const pending = f.manager.reply(f.run.id, f.run.projectId, 'retry me', 'retry')
  gate.reject(new Error('offline')); await assert.rejects(pending, /offline/)
  assert.equal(f.run.status, 'failed'); assert.equal(f.run.messages.some(message => message.text === 'retry me'), false)
  const next = f.hold(); const retry = f.manager.reply(f.run.id, f.run.projectId, 'retry me', 'retry'); next.resolve(); await retry
  assert.equal(f.run.messages.filter(message => message.text === 'retry me').length, 1)
  await f.complete(); await f.manager.dispose()
})
test('finishing a fast follow-up before admission returns does not restore running status', async () => {
  const f = fixture(); await f.start(); await f.complete()
  const gate = f.hold(); const pending = f.manager.reply(f.run.id, f.run.projectId, 'fast', 'fast')
  f.emit('turn/start'); await f.complete('done already'); gate.resolve(); await pending
  assert.equal(f.run.status, 'completed'); await f.manager.dispose()
})
test('stopping during follow-up admission cancels only this conversation and never admits after disposal', async () => {
  const f = fixture(); await f.start(); await f.complete()
  const gate = f.hold(); const pending = f.manager.reply(f.run.id, f.run.projectId, 'late', 'late')
  f.manager.stop(f.run.id, f.run.projectId); gate.resolve(); await assert.rejects(pending)
  assert.equal(f.run.status, 'stopped')
  const stopped = f.calls.filter(([action]) => action === 'agent-cancel')
  assert.ok(stopped.length > 0)
  assert.ok(stopped.every(([, request]) => request.id === f.run.childId && request.keepInbox === false))
  await f.manager.dispose()
})
test('child session joins the owning workspace when resolvable and falls back to cwd', async () => {
  const base = fixture()
  const calls = base.calls
  const runtime = new ConversationRuntime({ create: async request => { calls.push(['create', request]); return { sessionId: request.sessionId } } }, undefined, cwd => cwd === '/code' ? 'ws-1' : undefined)
  const manager = new TaskManager(runtime)
  manager.start(base.parent, { id: 'shortcut', name: '检查代码', text: '任务' }, 'ws-run')
  await tick()
  assert.deepEqual({ ...calls.find(([action]) => action === 'create')[1], sessionId: 'kept' }, { sessionId: 'kept', workspaceId: 'ws-1', agentPreset: 'standard' })
  const fallback = []
  const runtime2 = new ConversationRuntime({ create: async request => { fallback.push(request); return { sessionId: request.sessionId } } }, undefined, () => undefined)
  const manager2 = new TaskManager(runtime2)
  manager2.start(base.parent, { id: 'shortcut', name: '检查代码', text: '任务' }, 'cwd-run')
  await tick()
  assert.equal(fallback[0].workspaceId, undefined); assert.equal(fallback[0].cwd, '/code')
  await manager.dispose(); await manager2.dispose()
})
test('client rejects stale follow-up responses after project switch and opens root full conversations', async () => {
  const pending = deferred(); const tasks = createTasks(async (action, body) => {
    if (action === 'list') return { projectId: body.sessionId, cwd: '/code', prompts: [] }
    if (action === 'reply') return pending.promise
    return { projectId: body.sessionId, runs: [] }
  })
  await tasks.select('one'); const replying = tasks.reply('r', 'hello', 'req')
  await tasks.select('two'); pending.resolve({ projectId: 'one', run: { id: 'r', status: 'running' } }); await replying
  assert.equal(tasks.getSnapshot().sessionId, 'two'); assert.equal(tasks.getSnapshot().runs.length, 0)
  const addresses = []; openRun({ get: () => ({ openSession: address => addresses.push(address) }) }, { childId: 'ordinary', sessionKind: 'conversation' })
  assert.deepEqual(addresses, ['ordinary'])
})
test('lightweight card contains transcript and composer, escapes text, and excludes execution logs', () => {
  const markup = renderToStaticMarkup(React.createElement(ConversationCard, { ctx: {}, tasks: { getDraft: () => '' }, run: { id: 'r', name: '检查', status: 'completed', output: 'legacy', liveOutput: 'tool secret', messages: [{ id: 'u', role: 'user', text: '<script>user</script>' }, { id: 'a', role: 'assistant', text: '结果' }] } }))
  assert.match(markup, /textarea/); assert.match(markup, /结果/); assert.match(markup, /&lt;script&gt;user/)
  assert.doesNotMatch(markup, /tool secret|>legacy</)
  assert.match(markup, /打开 检查 的完整对话/)
})

test('cards stay with their launch session across navigation within one project', () => {
  const runs = [
    { id: 'a', parentId: 'main-a', childId: 'child-a', projectId: 'p', startedAt: 1 },
    { id: 'b', parentId: 'main-b', childId: 'child-b', projectId: 'p', startedAt: 2 },
    { id: 'closed', parentId: 'main-a', projectId: 'p', dismissed: true },
    { id: 'foreign', parentId: 'main-a', projectId: 'other' },
  ]
  assert.deepEqual(sessionRuns(runs, 'main-a', 'p').map(run => run.id), ['a'])
  assert.deepEqual(sessionRuns(runs, 'main-b', 'p').map(run => run.id), ['b'])
  assert.deepEqual(sessionRuns(runs, 'child-a', 'p'), [])
  assert.deepEqual(sessionRuns(runs, undefined, 'p'), [])
  assert.deepEqual(sessionRuns(runs, 'main-a', 'p').map(run => run.id), ['a'])
})
test('main and unrelated session events never enter a shortcut card', async () => {
  const f = fixture(); await f.start()
  for (const id of ['main', 'unrelated']) {
    f.manager.observe(id, { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'foreign output' }] } } })
    f.manager.stream(id, { type: 'start', attemptId: id })
    f.manager.stream(id, { type: 'chunk', attemptId: id, index: 0, chunk: { type: 'text-delta', text: 'foreign stream' } })
    f.runtime.observe(id, { type: 'turn/end', data: { reason: { kind: 'completed' } } })
  }
  await tick()
  assert.deepEqual(f.run.messages.map(message => message.text), ['请检查当前代码'])
  await f.complete('own output')
  assert.deepEqual(f.run.messages.map(message => message.text), ['请检查当前代码', 'own output'])
  assert.ok(f.calls.filter(([action]) => action === 'prompt').every(([, request]) => request.sessionId === f.run.childId))
  await f.manager.dispose()
})
test('a controller returning the main session cannot prompt, rename or cancel it', async () => {
  const touched = []
  const runtime = new ConversationRuntime({
    create: async () => ({ sessionId: 'main' }),
    resolveAgent: async () => { touched.push('resolve'); throw new Error('unexpected') },
    rename: async () => touched.push('rename'), prompt: async () => touched.push('prompt'), cancel: async () => touched.push('cancel'),
  }, () => { touched.push('getAgent'); return undefined })
  const manager = new TaskManager(runtime)
  manager.start({ id: 'main', session: { header: { id: 'main', cwd: '/code' } } }, { id: 'p', name: 'test', text: 'task' }, 'req')
  await tick()
  assert.equal(manager.list()[0].status, 'failed')
  assert.match(manager.list()[0].error, /独立会话/)
  await manager.dispose()
  assert.deepEqual(touched, [])
})
test('drafts and retry identity survive card remount without publishing on keystrokes', () => {
  const tasks = createTasks(); let notifications = 0; tasks.subscribe(() => notifications++)
  tasks.setDraft('card', '未发送的输入')
  const id = tasks.replyRequestId('card', '未发送的输入')
  assert.equal(tasks.getDraft('card'), '未发送的输入')
  assert.equal(tasks.replyRequestId('card', '未发送的输入'), id)
  assert.notEqual(tasks.replyRequestId('card', '新的输入'), id)
  assert.equal(notifications, 0, 'typing does not re-render the host composer or other cards')
})
