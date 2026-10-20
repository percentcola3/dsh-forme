import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validatePrompt } from '../src/index.ts'
import { shortName, currentSessionId } from '../src/client/logic.ts'
test('label is limited to five graphemes without damaging emoji', () => {
  assert.equal(shortName('检查当前代码问题'), '检查当前代')
  assert.equal(shortName('👨‍👩‍👧‍👦检查代码问题'), '👨‍👩‍👧‍👦检查代码')
})
test('validation preserves original text and removes legacy modes and model selections', () => {
  for (const mode of ['chat', 'agent', 'shell', undefined]) assert.deepEqual(validatePrompt({ name: ' 检查 ', text: '  提示\n代码\n', mode, selection: { model: 'old' } }), { name: '检查', text: '  提示\n代码\n' })
  for (const value of [{ name: '', text: 'hi' }, { name: 'x', text: ' ' }, { name: 'x', text: 'a\0' }, { name: 'x', text: 'x'.repeat(32001) }]) assert.throws(() => validatePrompt(value))
})
test('selected parent is read without sending a message or changing the composer', () => {
  assert.equal(currentSessionId({ get: () => ({ selection: { getSnapshot: () => ({ sessionId: 'main' }) } }) }), 'main')
})
