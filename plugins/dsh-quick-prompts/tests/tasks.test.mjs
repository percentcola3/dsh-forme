import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TaskManager } from '../src/task-manager.ts'
import { createTasks, openRun, ongoingRuns } from '../src/client/tasks.ts'
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const tick = () => new Promise(resolve => setImmediate(resolve))
async function readyTasks(request) {
  const tasks = createTasks(async (action, body) => action === 'list' ? { projectId: 'project', cwd: '/code/project', prompts: [] } : { projectId: 'project', ...await request(action, body) })
  await tasks.select('main')
  return tasks
}
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
  assert.equal(f.manager.start(f.parent, f.prompt, 'one').id, first.id)
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
  const tasks = await readyTasks(request)
  const first = tasks.start('main', 'p'); const second = tasks.start('main', 'p')
  assert.equal(first, second); assert.equal(tasks.getSnapshot().open, true); assert.equal(tasks.busy('main', 'p'), true)
  pending.resolve({ run }); await first; assert.equal(calls.length, 1)
  const restored = await readyTasks(request); await restored.refresh()
  assert.equal(restored.getSnapshot().runs[0].id, 'r'); assert.equal(calls.filter(call => call[0] === 'start').length, 1)
  const navigation = []; openRun({ get: () => ({ openSession: address => navigation.push(address) }) }, run)
  assert.deepEqual(navigation, [{ kind: 'subagent', parentSessionId: 'main', childSessionId: 'child', mode: 'continuable' }])
})
test('stale polling cannot overwrite a newly started task; network and startup errors remain visible', async () => {
  const polling = deferred()
  const tasks = await readyTasks(async action => action === 'runs' ? polling.promise : { run: { id: 'new' } })
  const refresh = tasks.refresh(); await tasks.start('main', 'p'); polling.resolve({ runs: [] }); await refresh
  assert.equal(tasks.getSnapshot().runs[0].id, 'new')
  const failed = await readyTasks(async () => { throw new Error('parent offline') })
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

test('conversation cards keep completed results and stopped turns available for follow-up until dismissed', () => {
  const runs = ['completed', 'stopped', 'failed', 'starting', 'running', 'waiting', 'stopping'].map((status, i) => ({ id: String(i), status, startedAt: i }))
  assert.deepEqual(ongoingRuns(runs).map(run => run.status), ['stopping', 'waiting', 'running', 'starting', 'failed', 'stopped', 'completed'])
  assert.equal(ongoingRuns(runs.map(run => ({ ...run, status: 'completed' }))).length, runs.length)
  assert.equal(ongoingRuns(runs.map(run => ({ ...run, dismissed: true }))).length, 0)
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
test('a newly failed task surfaces an error and keeps its card; old failures do not re-alert', async () => {
  let runs = [{ id: 'new', name: '检查', status: 'running' }, { id: 'old', name: '旧任务', status: 'failed', error: 'old failure' }]
  const tasks = await readyTasks(async () => ({ runs })); await tasks.refresh()
  assert.equal(tasks.getSnapshot().error, '')
  runs = [{ ...runs[0], status: 'failed', error: 'model unavailable' }, runs[1]]; await tasks.refresh()
  assert.match(tasks.getSnapshot().error, /检查：model unavailable/)
  assert.deepEqual(ongoingRuns(tasks.getSnapshot().runs).map(run => run.id), ['new', 'old'])
})
test('a startup failure already present in the admission response still shows an error', async () => {
  const tasks = await readyTasks(async () => ({ run: { id: 'failed', name: '检查', status: 'failed', error: 'spawn unavailable' } }))
  await tasks.start('main', 'p')
  assert.match(tasks.getSnapshot().error, /检查：spawn unavailable/)
  assert.deepEqual(ongoingRuns(tasks.getSnapshot().runs).map(run => run.id), ['failed'])
})

test('same shortcut supports independent instances; project-scoped stop/close cannot affect another project', async () => {
  const f = fixture({ delayed: true })
  const a = { id: 'A', cwd: '/code/A' }, b = { id: 'B', cwd: '/code/B' }
  const first = f.manager.start(f.parent, f.prompt, 'one', a)
  const second = f.manager.start(f.parent, f.prompt, 'two', a)
  const other = f.manager.start({ ...f.parent, id: 'other' }, f.prompt, 'three', b)
  assert.notEqual(first.id, second.id)
  assert.equal(f.admissions[0].spec.request.cwd, a.cwd)
  assert.equal(f.admissions[2].spec.request.cwd, b.cwd)
  assert.equal(f.manager.list(a.id).length, 2)
  assert.throws(() => f.manager.stop(other.id, a.id), /不属于当前项目/)
  assert.throws(() => f.manager.close(other.id, a.id), /不属于当前项目/)
  f.manager.close(first.id, a.id)
  assert.equal(f.manager.list(a.id).length, 1)
  assert.equal(f.admissions[0].spec.signal.aborted, true)
  assert.equal(f.admissions[1].spec.signal.aborted, false)
  assert.equal(f.admissions[2].spec.signal.aborted, false)
  for (const item of f.admissions) item.admission.resolve(item.receipt)
  await tick()
  assert.deepEqual(f.stops.map(item => item[0]), [first.childId])
  assert.equal(f.manager.list(b.id)[0].id, other.id)
  await f.manager.dispose()
})
test('project switches discard late list, start, poll, save, close and error responses', async () => {
  for (const action of ['list', 'start', 'runs', 'save', 'close', 'error']) {
    const late = deferred()
    let hold = false
    const tasks = createTasks(async (type, body) => {
      if (body.sessionId === 'A' && hold && (type === action || action === 'error' && type === 'start')) return late.promise
      if (type === 'list') return { projectId: body.sessionId, cwd: `/code/${body.sessionId}`, prompts: [{ id: body.sessionId, name: body.sessionId, text: body.sessionId }], legacyAvailable: false }
      return { projectId: body.sessionId, runs: [] }
    })
    if (action !== 'list') await tasks.select('A')
    hold = true
    const operation = action === 'list' ? tasks.select('A') : action === 'start' || action === 'error' ? tasks.start('A', 'A') : action === 'runs' ? tasks.refresh() : action === 'save' ? tasks.save('save', { name: 'A', text: 'A' }) : tasks.close('A')
    await tasks.select('B')
    if (action === 'error') late.reject(new Error('A failed'))
    else late.resolve({ projectId: 'A', cwd: '/code/A', prompts: [{ id: 'A' }], runs: [{ id: 'A' }], run: { id: 'A' } })
    await operation
    assert.equal(tasks.getSnapshot().projectId, 'B', action)
    assert.deepEqual(tasks.getSnapshot().prompts.map(item => item.id), ['B'], action)
    assert.deepEqual(tasks.getSnapshot().runs, [], action)
    assert.equal(tasks.getSnapshot().error, '', action)
  }
})
test('overlapping controls on different cards never resurrect a closed task', async () => {
  const stop = deferred(), close = deferred()
  const runs = [{ id: 'A', status: 'running' }, { id: 'B', status: 'running' }]
  const tasks = await readyTasks(async action => action === 'stop' ? stop.promise : action === 'close' ? close.promise : { runs })
  await tasks.refresh()
  const stopping = tasks.stop('A'), closing = tasks.close('B')
  close.resolve({ runs: [runs[0]] }); await closing
  stop.resolve({ runs: [{ ...runs[0], status: 'stopping' }, runs[1]] }); await stopping
  assert.deepEqual(tasks.getSnapshot().runs.map(run => [run.id, run.status]), [['A', 'stopping']])
})

test('uncertain restart recovery notice is scoped to its current conversation and clears on switch', async () => {
  const tasks = createTasks(async (action, body) => action === 'list'
    ? { projectId: body.sessionId, cwd: '/code/' + body.sessionId, prompts: [] }
    : { projectId: body.sessionId, runs: [], recovery: body.sessionId === 'A' ? { state: 'reserved' } : null })
  await tasks.select('A'); await tasks.refresh()
  assert.equal(tasks.getSnapshot().recovery.state, 'reserved')
  await tasks.select('B')
  assert.equal(tasks.getSnapshot().recovery, null)
  await tasks.refresh()
  assert.equal(tasks.getSnapshot().recovery, null)
})


test('catalog refresh is throttled and detects Git changes without changing sessions', async () => {
  let now = 0, prompts = [], lists = 0
  const tasks = createTasks(async action => {
    if (action === 'list') { lists++; return { projectId: 'project', cwd: '/code/project', prompts } }
    return { projectId: 'project', runs: [] }
  }, () => now)
  await tasks.select('main')
  prompts = [{ id: 'commit', name: '提交', gitOnly: true }]
  for (now = 400; now < 15_000; now += 400) await tasks.refresh()
  assert.equal(lists, 1)
  now = 15_000; await tasks.refresh()
  assert.equal(lists, 2); assert.equal(tasks.getSnapshot().prompts[0].id, 'commit')
  prompts = []; now = 30_000; await tasks.refresh()
  assert.deepEqual(tasks.getSnapshot().prompts, [])
})

test('late catalog response cannot undo prompt edits or restore a different session catalog', async () => {
  for (const action of ['save', 'switch']) {
    let now = 0, hold = false
    const late = deferred()
    const tasks = createTasks(async (type, body) => {
      if (type === 'list' && body.sessionId === 'A' && hold) return late.promise
      if (type === 'list') return { projectId: body.sessionId, cwd: '/code/' + body.sessionId, prompts: [{ id: body.sessionId }] }
      if (type === 'save') return { projectId: body.projectId, prompts: [{ id: 'edited' }] }
      return { projectId: body.projectId, runs: [] }
    }, () => now)
    await tasks.select('A'); hold = true; now = 15_000
    const refreshing = tasks.refresh()
    if (action === 'save') await tasks.save('save', { id: 'A', name: 'edited', text: 'edited' })
    else await tasks.select('B')
    late.resolve({ projectId: 'A', cwd: '/code/A', prompts: [{ id: 'stale' }] })
    await refreshing
    assert.deepEqual(tasks.getSnapshot().prompts.map(p => p.id), [action === 'save' ? 'edited' : 'B'])
  }
})

test('same-session cwd changes invalidate pending mutations and clear old task cards', async () => {
  let now = 0, project = 'A'
  const late = deferred()
  const tasks = createTasks(async (action, body) => {
    if (action === 'list') return { projectId: project, cwd: '/code/' + project, prompts: [{ id: project }] }
    if (action === 'save') return late.promise
    return { projectId: body.projectId, runs: [{ id: 'old' }] }
  }, () => now)
  await tasks.select('main'); await tasks.refresh()
  const save = tasks.save('save', { id: 'A', name: 'changed', text: 'changed' })
  project = 'B'; now = 15_000; await tasks.refresh()
  assert.equal(tasks.getSnapshot().projectId, 'B')
  assert.deepEqual(tasks.getSnapshot().runs, [])
  late.resolve({ projectId: 'A', prompts: [{ id: 'late' }] }); await save
  assert.deepEqual(tasks.getSnapshot().prompts.map(p => p.id), ['B'])
})
