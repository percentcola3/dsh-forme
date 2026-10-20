import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LiveOutput } from '../src/live-output.ts'
test('live output follows public text, drops duplicates and never exposes reasoning or tool arguments', () => {
  const output = new LiveOutput()
  output.frame({ type: 'start', attemptId: 'a' })
  const send = (index, type, text) => output.frame({ type: 'chunk', attemptId: 'a', index, chunk: { type, text } })
  send(0, 'reasoning-delta', 'private reasoning'); send(1, 'text-delta', '你'); send(1, 'text-delta', 'duplicate')
  send(2, 'tool-call-delta', 'private args'); send(3, 'text-delta', '好')
  assert.equal(output.text, '你好')
  output.message('你好'); assert.equal(output.text, '你好')
  output.frame({ type: 'end', attemptId: 'a', outcome: { kind: 'settled', eventType: 'assistant/message' } })
  send(4, 'text-delta', 'late'); assert.equal(output.text, '你好')
})
test('abandoned attempts roll back and a retry preserves only committed earlier output', () => {
  const output = new LiveOutput(); output.append('earlier output')
  output.frame({ type: 'start', attemptId: 'a' })
  output.frame({ type: 'chunk', attemptId: 'a', index: 0, chunk: { type: 'text-delta', text: 'discarded' } })
  output.frame({ type: 'end', attemptId: 'a', outcome: { kind: 'abandoned' } })
  assert.equal(output.text, 'earlier output')
  output.frame({ type: 'start', attemptId: 'b' })
  output.frame({ type: 'chunk', attemptId: 'b', index: 0, chunk: { type: 'text-delta', text: 'current' } })
  output.message('current output')
  assert.equal(output.text, 'earlier output\n\ncurrent output')
})
test('a new attempt does not retain an unfinished previous prefix; output memory is bounded', () => {
  const output = new LiveOutput()
  output.frame({ type: 'start', attemptId: 'a' })
  output.frame({ type: 'chunk', attemptId: 'a', index: 0, chunk: { type: 'text-delta', text: 'old' } })
  output.frame({ type: 'start', attemptId: 'b' })
  output.frame({ type: 'chunk', attemptId: 'a', index: 1, chunk: { type: 'text-delta', text: 'stale' } })
  output.frame({ type: 'chunk', attemptId: 'b', index: 0, chunk: { type: 'text-delta', text: 'x'.repeat(30000) } })
  assert.equal(output.text.length, 24000); assert.equal(output.text.includes('old'), false)
})
