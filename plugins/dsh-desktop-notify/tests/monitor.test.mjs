import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TaskMonitor } from '../src/monitor.ts'
import { parsePreferences, defaults } from '../src/preferences.ts'
function fixture(origin) {
  const notices = new Map(); const shown = []
  const monitor = new TaskMonitor({ show: notice => { notices.set(notice.id, notice); shown.push(notice) }, dismiss: id => notices.delete(id) })
  const session = { id: 'root', header: { cwd: '/Code/project', origin }, snapshotEvents: () => [{ type: 'session/title', data: { title: '后台任务' } }] }
  let seq = 0
  const event = (type, data = {}) => { const entry = { type, seq: seq++, data }; monitor.observe(session, entry); return entry }
  return { monitor, session, notices, shown, event }
}
test('notifies once for a completed turn regardless of selected task or focus', () => {
  const f = fixture(); f.event('turn/start'); f.event('step/start')
  const end = f.event('turn/end', { reason: { kind: 'completed' } })
  f.monitor.observe(f.session, end)
  assert.equal(f.shown.length, 1)
  assert.equal(f.shown[0].kind, 'complete'); assert.equal(f.shown[0].title, '后台任务')
})
test('canceled, blocked, interrupted and empty turns never report success', () => {
  for (const kind of ['aborted', 'blocked', 'interrupted', 'max-tokens']) {
    const f = fixture(); f.event('step/start'); f.event('turn/end', { reason: { kind } }); assert.equal(f.shown.length, 0, kind)
  }
  const f = fixture(); f.event('turn/start'); f.event('turn/end', { reason: { kind: 'completed' } }); assert.equal(f.shown.length, 0)
})
test('approval settled before native preparation does not leave a stale popup', () => {
  const f = fixture(); f.event('approval/asked', { id: 'a', toolName: 'bash', reason: '确认执行命令' })
  assert.equal(f.notices.size, 1); assert.equal(f.shown[0].body, '确认执行命令')
  f.event('approval/decided', { id: 'a', outcome: 'allowed-once' }); assert.equal(f.notices.size, 0)
})
test('timed continued questions remain pending across a successful turn and settle on reply', () => {
  const f = fixture(); f.event('step/start'); f.event('tool/call', { callId: 'q', name: 'ask_user_question', arguments: JSON.stringify({ questions: [{ question: '选择哪个方案？' }] }) })
  f.event('tool/result', { message: { toolCallId: 'q', content: [{ type: 'text', text: '{"pending":true}' }] } })
  f.event('turn/end', { reason: { kind: 'completed' } })
  assert.equal(f.notices.size, 1); assert.equal(f.shown.length, 1)
  f.event('user/message', { source: { kind: 'user-question-reply', callId: 'q' } }); assert.equal(f.notices.size, 0)
})
test('normal answers and aborted turns dismiss outstanding choices', () => {
  const f = fixture(); const ask = () => f.event('tool/call', { callId: 'q', name: 'ask_user_question', arguments: { questions: [{ question: '确认？' }] } })
  ask(); f.event('tool/result', { message: { toolCallId: 'q', content: [{ type: 'text', text: '{"answers":[]}' }] } }); assert.equal(f.notices.size, 0)
  ask(); f.event('turn/end', { reason: { kind: 'aborted' } }); assert.equal(f.notices.size, 0)
})
test('parallel sessions are independent; removal only clears its own notifications', () => {
  const f = fixture(); f.event('approval/asked', { id: 'a' })
  f.monitor.observe({ id: 'other' }, { type: 'approval/asked', seq: 0, data: { id: 'b' } })
  assert.equal(f.notices.size, 2); f.monitor.remove('root'); assert.equal(f.notices.size, 1); assert.ok(f.notices.has('other:approval:b'))
})
test('a new turn clears stale completion and errors are shown as errors', () => {
  const f = fixture(); f.event('step/start'); f.event('turn/end', { reason: { kind: 'completed' } }); f.event('turn/start'); assert.equal(f.notices.size, 0)
  f.event('turn/end', { reason: { kind: 'error' } }); assert.equal(f.shown.at(-1).kind, 'error')
})
test('subagent noise and malformed questions do not create misleading choices', () => {
  const child = fixture('subagent'); child.event('step/start'); child.event('turn/end', { reason: { kind: 'completed' } }); assert.equal(child.shown.length, 0)
  const f = fixture(); f.event('tool/call', { name: 'ask_user_question', arguments: 'bad json' }); assert.equal(f.shown.length, 0)
})
test('preferences reject wrong types, preserve all positions and bound durations', () => {
  assert.deepEqual(parsePreferences(null), defaults)
  for (const position of ['left', 'right', 'top', 'island']) assert.equal(parsePreferences({ position }).position, position)
  assert.equal(parsePreferences({ position: 'offscreen', enabled: 'false', duration: Infinity }).enabled, true)
  assert.equal(parsePreferences({ duration: 0 }).duration, 3); assert.equal(parsePreferences({ duration: 9000 }).duration, 30)
})
