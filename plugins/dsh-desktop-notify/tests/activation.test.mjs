import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { setTimeout as wait } from 'node:timers/promises'
import { apply } from '../src/index.ts'
test('server activation authenticates settings, persists them, cancels stale delivery and routes clicks', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-notify-test-'))
  const ctx = new Context(); let handler; let onOpen; let released = false; let showing = []
  let resolveReady; const ready = new Promise(resolve => { resolveReady = resolve })
  const bridge = { status: 'idle', error: '', prepare: () => ready, show: async notice => showing.push(notice), dismiss: () => {}, configure: () => {}, dispose: () => { released = true } }
  const call = async (body, headers = {}) => {
    const req = Readable.from([Buffer.from(JSON.stringify(body))]); req.method = 'POST'; req.headers = { 'content-type': 'application/json', ...headers }
    let output = ''; const res = { statusCode: 200, setHeader() {}, end(value) { output = value } }
    await handler(req, res); return { code: res.statusCode, body: JSON.parse(output) }
  }
  try {
    await ctx.plugin(provider => {
      provider.provide('sessions', {})
      provider.provide('connection', { requestRejection: req => req.headers.denied ? 403 : undefined })
      provider.provide('webServer', { register: route => { handler = route.handler; return () => { handler = undefined } } })
    })
    const plugin = ctx.plugin({ inject: ['webServer', 'connection', 'sessions'], apply: scope => apply(scope, {}, { directory, native: callback => { onOpen = callback; return bridge } }) })
    await plugin
    assert.equal((await call({ action: 'get' }, { denied: 'yes' })).code, 403)
    assert.equal((await call({ action: 'update', preferences: { position: 'island', duration: 12 } })).body.preferences.position, 'island')
    const session = { id: 'background', header: { cwd: '/code/demo' } }; let seq = 0
    const event = (type, data) => ctx.emit('session/event', session, { type, data, seq: seq++ })
    event('approval/asked', { id: 'stale' }); await wait(230)
    event('approval/decided', { id: 'stale' }); resolveReady(); await wait(10)
    assert.equal(showing.length, 0, 'resolved choices must not appear after the helper finishes preparing')
    event('step/start', { turn: 1 }); event('turn/end', { turn: 1, reason: { kind: 'completed' } }); await wait(450)
    assert.equal(showing.length, 1)
    onOpen(showing[0].id)
    assert.equal((await call({ action: 'poll', desktop: true, focused: false })).body.open, undefined)
    assert.equal((await call({ action: 'poll', desktop: false, focused: true })).body.open, undefined)
    const nav = (await call({ action: 'poll', desktop: true, focused: true })).body.open
    assert.equal(nav.sessionId, 'background')
    await call({ action: 'ack', id: nav.id }); assert.equal((await call({ action: 'poll', desktop: true, focused: true })).body.open, undefined)
    await call({ action: 'update', preferences: { enabled: false } })
    event('step/start', { turn: 2 }); event('turn/end', { turn: 2, reason: { kind: 'completed' } }); await wait(430)
    assert.equal(showing.length, 1)
    await plugin.dispose(); assert.equal(released, true); assert.equal(handler, undefined)
  } finally { await ctx.fiber.dispose(); await rm(directory, { recursive: true, force: true }) }
})
