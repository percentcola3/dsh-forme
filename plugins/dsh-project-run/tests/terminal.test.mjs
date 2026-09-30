import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { ProjectTerminals } from '../src/terminal.ts'
const waitFor = async read => {
  for (let i = 0; i < 60; i++) { const value = read(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 50)) }
  throw new Error('terminal output timed out')
}
test('interactive PTY preserves shell state, scopes access and closes', async () => {
  const terminals = new ProjectTerminals()
  try {
    const first = terminals.open('session-a', tmpdir(), 80, 24)
    assert.equal(terminals.open('session-a', tmpdir(), 80, 24).id, first.id)
    assert.throws(() => terminals.read('session-b', first.id, 0))
    terminals.write('session-a', first.id, "printf '\\120\\124\\131_READY'; pwd\r")
    await waitFor(() => terminals.read('session-a', first.id, 0).output.includes('PTY_READY'))
    terminals.write('session-a', first.id, 'export DSH_TERMINAL_FIXTURE=works\r')
    terminals.write('session-a', first.id, "printf '\\123\\124\\101\\124\\105_%s' $DSH_TERMINAL_FIXTURE\r")
    await waitFor(() => terminals.read('session-a', first.id, 0).output.includes('STATE_works'))
    terminals.resize('session-a', first.id, 100, 30)
    terminals.write('session-a', first.id, "sleep 60 & printf '\\103\\110\\111\\114\\104_%s' $!\r")
    const pid = await waitFor(() => Number(terminals.read('session-a', first.id, 0).output.match(/CHILD_(\d+)/)?.[1]))
    terminals.close('session-a', first.id)
    assert.throws(() => terminals.read('session-a', first.id, 0))
    await waitFor(() => { try { process.kill(pid, 0); return false } catch { return true } })
  } finally { terminals.dispose() }
  assert.throws(() => terminals.open('new', tmpdir(), 80, 24))
})
