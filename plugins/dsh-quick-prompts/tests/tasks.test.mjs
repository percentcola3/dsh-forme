import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TaskManager } from '../src/task-manager.ts'
import { createTasks, openRun, ongoingRuns } from '../src/client/tasks.ts'
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const tick = () => new Promise(resolve => setImmediate(resolve))
function fixture({ delayed = false } = {}) {
  const admissions = [], stops = [], disposed = []
  const runtime = {
    getProvider: () => ({}), resolveMaxDepth: () => 4,
    startActivation: async spec => {
      const result = deferred(), admission = deferred()
      const receipt = { childId: spec.childId, result: result.promise, dispose: async () => { disposed.push(spec.childId); result.resolve({ stopReason: 'aborted' }) } }
      admissions.push({ spec, result, admission, receipt })
      return delayed ? admission.promise : receipt
    },
    interrupt: (child, authority) => { stops.push([child, authority]) },
  }
  const parent = { id: 'main', session: { header: { cwd: '/code/project' }, snapshotEvents: () => [{ type: 'session/title', data: { title: '主流程' } }] } }
  const prompt = { id: 'p', name: '检查', text: "  pwd\nprintf 'OK\\n'\n" }
  return { manager: new TaskManager(runtime), runtime, parent, prompt, admissions, stops, disposed }
}
test('native child uses exact live parent and caller delivery, preserves text, returns before execution', async () => {
  const f = fixture()
  const run = f.manager.start(f.parent, f.prompt, 'one')
  assert.equal(run.status, 'starting')
  await tick()
  const { spec, result } = f.admissions[0]
  assert.equal(spec.request.parent, f.parent)
  assert.equal(spec.provider, 'spawn'); assert.equal(spec.delivery, 'caller')
  assert.equal(spec.request.maxDepth, 4); assert.equal(spec.request.prompt.at(-1).text, f.prompt.text)
  assert.equal(spec.childId, run.childId); assert.equal(f.manager.list()[0].status, 'running')
  assert.equal(f.manager.list()[0].parentTitle, '主流程')
  result.resolve({ stopReason: 'completed', output: [{ type: 'text', text: 'OK' }] }); await tick()
  assert.equal(f.manager.list()[0].status, 'completed'); assert.equal(f.manager.list()[0].output, 'OK')
  await f.manager.dispose()
})
test('repeated clicks are idempotent; different shortcuts run concurrently and stop targets only one child', async () => {
  const f = fixture(); const first = f.manager.start(f.parent, f.prompt, 'one')
  assert.equal(f.manager.start(f.parent, f.prompt, 'one').id, first.id)
  assert.equal(f.manager.start(f.parent, f.prompt, 'two').id, first.id)
  const second = f.manager.start(f.parent, { ...f.prompt, id: 'q' }, 'three')
  assert.throws(() => f.manager.start(f.parent, { ...f.prompt, id: 'q' }, 'one'), /编号/)
  await tick(); f.manager.stop(first.id)
  assert.deepEqual(f.stops, [[first.childId, { kind: 'user', parentSessionId: 'main' }]])
  assert.equal(f.manager.list().find(run => run.id === first.id).status, 'stopping')
  assert.equal(f.manager.list().find(run => run.id === second.id).status, 'running')
  f.manager.observe(first.childId, { type: 'tool/call', data: { callId: 'slow', name: 'bash' } })
  f.admissions[0].result.resolve({ stopReason: 'interrupted' }); await tick()
  assert.equal(f.manager.list().find(run => run.id === first.id).tools[0].state, 'ended')
  assert.equal(f.manager.list().find(run => run.id === first.id).status, 'stopped')
  f.manager.start(f.parent, f.prompt, 'four'); assert.equal(f.admissions.length, 3)
  await f.manager.dispose()
})
for (const reason of ['error', 'blocked', 'max-tokens', 'aborted', 'interrupted']) test(`native ${reason} is never reported as completed`, async () => {
  const f = fixture(); f.manager.start(f.parent, f.prompt, 'one'); await tick()
  f.admissions[0].result.resolve({ stopReason: reason, output: [{ type: 'text', text: 'details' }] }); await tick()
  assert.equal(f.manager.list()[0].status, ['aborted', 'interrupted'].includes(reason) ? 'stopped' : 'failed')
  assert.equal(f.manager.list()[0].output, 'details'); assert.ok(f.manager.list()[0].endedAt)
  await f.manager.dispose()
})
test('event observer follows steps, tools, approvals and pending/unknown user questions', async () => {
  const f = fixture(); const run = f.manager.start(f.parent, f.prompt, 'one'); await tick()
  const emit = (type, data) => f.manager.observe(run.childId, { type, data })
  emit('step/start', {}); emit('tool/call', { callId: 'tool', name: 'read_file' })
  emit('tool/result', { message: { toolCallId: 'tool', isError: true } })
  assert.equal(f.manager.list()[0].tools[0].state, 'failed')
  emit('approval/asked', { id: 'approval' }); assert.equal(f.manager.list()[0].status, 'waiting')
  emit('approval/decided', { id: 'approval' }); assert.equal(f.manager.list()[0].status, 'running')
  emit('tool/call', { callId: 'ask', name: 'ask_user_question' })
  emit('tool/result', { message: { toolCallId: 'ask', content: [{ type: 'text', text: '{"pending":true}' }] } })
  assert.equal(f.manager.list()[0].status, 'waiting')
  emit('tool/result', { message: { toolCallId: 'ask' }, error: { code: 'TOOL_OUTCOME_UNKNOWN' } })
  assert.equal(f.manager.list()[0].status, 'waiting')
  emit('user/message', { source: { kind: 'user-question-reply', callId: 'ask' } })
  assert.equal(f.manager.list()[0].status, 'running')
  emit('assistant/message', { message: { content: [{ type: 'text', text: 'progress' }] } })
  assert.equal(f.manager.list()[0].output, 'progress'); assert.equal(f.manager.list()[0].steps, 1)
  f.manager.observe('unrelated-child', { type: 'step/start', data: {} }); assert.equal(f.manager.list()[0].steps, 1)
  await f.manager.dispose()
})
test('admission failure is actionable and unloading releases late receipts without touching another tree', async () => {
  const f = fixture({ delayed: true }); f.manager.start(f.parent, f.prompt, 'one')
  const closing = f.manager.dispose(); assert.equal(f.admissions[0].spec.signal.aborted, true)
  f.admissions[0].admission.resolve(f.admissions[0].receipt); await closing; await tick()
  assert.deepEqual(f.disposed, [f.admissions[0].spec.childId]); assert.equal(f.manager.list()[0].status, 'stopped')
  assert.throws(() => f.manager.start(f.parent, f.prompt, 'two'), /关闭/)
  const g = fixture({ delayed: true }); g.manager.start(g.parent, g.prompt, 'one')
  g.admissions[0].admission.reject(new Error('model unavailable')); await tick()
  assert.equal(g.manager.list()[0].status, 'failed'); assert.match(g.manager.list()[0].error, /model unavailable/)
  await g.manager.dispose()
})
test('stop during admission interrupts a late child and does not mark it completed early', async () => {
  const f = fixture({ delayed: true }); const run = f.manager.start(f.parent, f.prompt, 'one')
  f.manager.stop(run.id); assert.equal(f.admissions[0].spec.signal.aborted, true)
  f.admissions[0].admission.resolve(f.admissions[0].receipt); await tick()
  assert.equal(f.manager.list()[0].status, 'stopping'); assert.equal(f.stops[0][0], run.childId)
  f.admissions[0].result.resolve({ stopReason: 'aborted' }); await tick(); assert.equal(f.manager.list()[0].status, 'stopped')
  await f.manager.dispose()
})
test('client store deduplicates submission, keeps main selection untouched and restores runs without starting them', async () => {
  const pending = deferred(); const calls = []
  const run = { id: 'r', parentId: 'main', childId: 'child', promptId: 'p', status: 'running' }
  const request = async (action, body) => { calls.push([action, body]); return action === 'start' ? pending.promise : { runs: [run] } }
  const tasks = createTasks(request)
  const first = tasks.start('main', 'p'); const second = tasks.start('main', 'p')
  assert.equal(first, second); assert.equal(tasks.getSnapshot().open, true); assert.equal(tasks.busy('main', 'p'), true)
  pending.resolve({ run }); await first; assert.equal(calls.length, 1)
  const restored = createTasks(request); await restored.refresh()
  assert.equal(restored.getSnapshot().runs[0].id, 'r'); assert.equal(calls.filter(call => call[0] === 'start').length, 1)
  const navigation = []; openRun({ get: () => ({ openSession: address => navigation.push(address) }) }, run)
  assert.deepEqual(navigation, [{ kind: 'subagent', parentSessionId: 'main', childSessionId: 'child', mode: 'continuable' }])
})
test('stale polling cannot overwrite a newly started task; network and startup errors remain visible', async () => {
  const polling = deferred()
  const tasks = createTasks(async action => action === 'runs' ? polling.promise : { run: { id: 'new' } })
  const refresh = tasks.refresh(); await tasks.start('main', 'p'); polling.resolve({ runs: [] }); await refresh
  assert.equal(tasks.getSnapshot().runs[0].id, 'new')
  const failed = createTasks(async () => { throw new Error('parent offline') })
  await failed.start('main', 'p'); assert.match(failed.getSnapshot().error, /parent offline/)
  await failed.refresh(); assert.match(failed.getSnapshot().syncError, /同步失败/)
  assert.equal(failed.busy('main', 'p'), false)
})
test('a pending question outliving the first native turn is not success; a later reply can finish it', async () => {
  const f = fixture(); const run = f.manager.start(f.parent, f.prompt, 'one'); await tick()
  const emit = (type, data) => f.manager.observe(run.childId, { type, data })
  emit('tool/call', { callId: 'ask', name: 'ask_user_question' })
  emit('tool/result', { message: { toolCallId: 'ask', content: [{ type: 'text', text: '{"pending":true}' }] } })
  emit('turn/end', { reason: { kind: 'completed' } })
  f.admissions[0].result.resolve({ stopReason: 'completed', output: [{ type: 'text', text: '请选择' }] }); await tick()
  assert.equal(f.manager.list()[0].status, 'waiting'); assert.equal(f.manager.list()[0].endedAt, undefined)
  emit('user/message', { source: { kind: 'user-question-reply', callId: 'ask' } })
  emit('step/start', {}); emit('assistant/message', { message: { content: [{ type: 'text', text: '已按选择完成' }] } })
  emit('turn/end', { reason: { kind: 'completed' } })
  assert.equal(f.manager.list()[0].status, 'completed'); assert.equal(f.manager.list()[0].output, '已按选择完成')
  await f.manager.dispose()
})
test('stopping an idle child waiting for a late answer does not stick at stopping', async () => {
  const f = fixture(); const run = f.manager.start(f.parent, f.prompt, 'one'); await tick()
  f.manager.observe(run.childId, { type: 'approval/asked', data: { id: 'approval' } })
  f.admissions[0].result.resolve({ stopReason: 'completed' }); await tick()
  assert.equal(f.manager.list()[0].status, 'waiting')
  f.manager.stop(run.id); assert.equal(f.manager.list()[0].status, 'stopped')
  await f.manager.dispose()
})

test('visible cards include only live tasks and disappear immediately on settlement', () => {
  const runs = ['completed', 'stopped', 'failed', 'starting', 'running', 'waiting', 'stopping'].map((status, i) => ({ id: String(i), status, startedAt: i }))
  assert.deepEqual(ongoingRuns(runs).map(run => run.status), ['stopping', 'waiting', 'running', 'starting'])
  assert.equal(ongoingRuns(runs.map(run => ({ ...run, status: 'completed' }))).length, 0)
})
test('native assistant frames are visible before settlement, tool text joins once, and late frames are ignored', async () => {
  const f = fixture(); const run = f.manager.start(f.parent, f.prompt, 'one'); await tick()
  f.manager.stream(run.childId, { type: 'start', attemptId: 'a' })
  f.manager.stream(run.childId, { type: 'chunk', attemptId: 'a', index: 0, chunk: { type: 'text-delta', text: '实时' } })
  f.manager.stream(run.childId, { type: 'chunk', attemptId: 'a', index: 1, chunk: { type: 'text-delta', text: '输出' } })
  assert.equal(f.manager.list()[0].liveOutput, '实时输出')
  assert.equal(f.manager.list()[0].status, 'running')
  f.manager.observe(run.childId, { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '实时输出' }] } } })
  f.manager.stream(run.childId, { type: 'end', attemptId: 'a', index: 2, outcome: { kind: 'settled', eventType: 'assistant/message' } })
  f.manager.observe(run.childId, { type: 'tool/result', data: { message: { content: [{ type: 'text', text: 'stdout' }] } } })
  assert.equal(f.manager.list()[0].liveOutput, '实时输出\n\nstdout')
  f.admissions[0].result.resolve({ stopReason: 'completed' }); await tick()
  f.manager.stream(run.childId, { type: 'start', attemptId: 'late' })
  f.manager.stream(run.childId, { type: 'chunk', attemptId: 'late', index: 0, chunk: { type: 'text-delta', text: 'bad' } })
  assert.equal(f.manager.list()[0].liveOutput, '实时输出\n\nstdout')
  await f.manager.dispose()
})
test('a newly failed task surfaces an error outside its removed card; old failures do not reappear', async () => {
  let runs = [{ id: 'new', name: '检查', status: 'running' }, { id: 'old', name: '旧任务', status: 'failed', error: 'old failure' }]
  const tasks = createTasks(async () => ({ runs })); await tasks.refresh()
  assert.equal(tasks.getSnapshot().error, '')
  runs = [{ ...runs[0], status: 'failed', error: 'model unavailable' }, runs[1]]; await tasks.refresh()
  assert.match(tasks.getSnapshot().error, /检查：model unavailable/)
  assert.equal(ongoingRuns(tasks.getSnapshot().runs).length, 0)
})
test('a startup failure already present in the admission response still shows an error', async () => {
  const tasks = createTasks(async () => ({ run: { id: 'failed', name: '检查', status: 'failed', error: 'spawn unavailable' } }))
  await tasks.start('main', 'p')
  assert.match(tasks.getSnapshot().error, /检查：spawn unavailable/)
  assert.equal(ongoingRuns(tasks.getSnapshot().runs).length, 0)
})
