import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { runService, launchUrl } from '../service.mjs'

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(predicate) {
  const deadline = Date.now() + 8000
  while (Date.now() < deadline) {
    const value = predicate()
    if (value) return value
    await delay(20)
  }
  throw new Error('Timed out waiting for service state')
}
function alive(pid) {
  try { process.kill(pid, 0); return true } catch (error) {
    if (error.code === 'ESRCH') return false
    throw error
  }
}
function fixture(mode = 'ready', options = {}) {
  const input = new PassThrough()
  const events = []
  const manager = runService({
    command: process.execPath,
    args: [fileURLToPath(new URL('./fake-dsh.mjs', import.meta.url)), mode],
    input, send: event => events.push(event), startupMs: 1500, retryMs: 30, ...options,
  })
  return { input, events, manager, async close() { input.end(); await manager.close() } }
}
const readyEvents = f => f.events.filter(e => e.phase === 'ready')
const pidOf = event => Number(new URL(event.url).searchParams.get('token').replace('test-', ''))

test('only accepts a complete authenticated loopback launch URL', () => {
  assert.equal(launchUrl('dsh web: http://127.0.0.1:3080/?token=abc'), undefined)
  assert.equal(launchUrl('dsh web: http://127.0.0.1:3080/?token=abc\n'), 'http://127.0.0.1:3080/?token=abc')
  for (const url of ['http://example.com:3080/?token=abc', 'http://127.0.0.1:3080/', 'http://127.0.0.1/?token=abc']) {
    assert.equal(launchUrl(`dsh web: ${url}\n`), undefined)
  }
})

test('restart receives a fresh URL and stops the old process', async () => {
  const f = fixture()
  try {
    const first = await until(() => readyEvents(f)[0])
    assert.ok(alive(pidOf(first)))
    f.input.write('restart\n')
    const second = await until(() => readyEvents(f)[1])
    assert.notEqual(first.url, second.url)
    assert.equal(alive(pidOf(first)), false)
    assert.ok(alive(pidOf(second)))
  } finally { await f.close() }
})

test('native parent EOF cleans up its service', async () => {
  const f = fixture()
  try {
    const ready = await until(() => readyEvents(f)[0])
    f.input.end()
    await until(() => !alive(pidOf(ready)))
    assert.equal(readyEvents(f).length, 1)
  } finally { await f.close() }
})

test('crashes have bounded automatic retries and a visible error', async () => {
  const f = fixture('crash')
  try {
    await until(() => f.events.find(e => e.phase === 'error'))
    assert.equal(readyEvents(f).length, 4)
    assert.ok(readyEvents(f).every(e => !alive(pidOf(e))))
  } finally { await f.close() }
})

test('startup timeout stays on an error instead of looping', async () => {
  const f = fixture('timeout', { startupMs: 80 })
  try {
    const error = await until(() => f.events.find(e => e.phase === 'error'))
    assert.match(error.message, /超时/)
    assert.equal(readyEvents(f).length, 0)
    assert.equal(f.events.filter(e => e.phase === 'starting').length, 1)
  } finally { await f.close() }
})

test('closing during startup does not later launch or restart a service', async () => {
  const f = fixture()
  await f.close()
  await delay(100)
  assert.equal(readyEvents(f).length, 0)
})
