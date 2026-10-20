import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { apply, inject } from '../src/index.ts'
test('authenticated API migrates legacy shortcuts, admits native tasks asynchronously, and detaches cleanly', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-quick-test-')); const ctx = new Context()
  let handler, spec, settle, disposed = 0
  const text = "pwd\nprintf 'FORME_SHELL_OK\\n'"
  const parent = { id: 'main', session: { header: { cwd: '/tmp' } } }
  const call = async (body, headers = {}) => {
    const req = Readable.from([Buffer.from(JSON.stringify(body))]); req.method = 'POST'; req.headers = { 'content-type': 'application/json', ...headers }
    let output; const res = { setHeader() {}, end(value) { output = value } }
    await handler(req, res); return { code: res.statusCode, body: JSON.parse(output) }
  }
  try {
    await writeFile(join(directory, 'quick-prompts.json'), JSON.stringify([{ id: 'p', name: '旧命令', text, mode: 'shell', selection: { model: 'legacy' } }]))
    await ctx.plugin(provider => {
      provider.provide('connection', { requestRejection: req => req.headers.denied ? 403 : undefined })
      provider.provide('webServer', { register: route => { handler = route.handler; return () => { handler = undefined } } })
      provider.provide('sessions', {})
      provider.provide('agents', { get: id => id === 'main' ? parent : undefined })
      provider.provide('subagents', { getProvider: () => ({}), resolveMaxDepth: () => 4, interrupt() {}, startActivation: async value => {
        spec = value; return { childId: value.childId, result: new Promise(resolve => { settle = resolve }), dispose: async () => { disposed++; settle({ stopReason: 'aborted' }) } }
      } })
    })
    const plugin = ctx.plugin({ inject, apply: scope => apply(scope, {}, { directory }) }); await plugin
    assert.equal((await call({ action: 'start', sessionId: 'main', id: 'p', requestId: 'denied' }, { denied: 'yes' })).code, 403)
    assert.equal(spec, undefined)
    assert.deepEqual((await call({ action: 'list' })).body.prompts, [{ id: 'p', name: '旧命令', text }])
    assert.equal((await call({ action: 'start', sessionId: 'offline', id: 'p', requestId: 'one' })).code, 400)
    const started = await call({ action: 'start', sessionId: 'main', id: 'p', requestId: 'one' })
    assert.equal(started.code, 202); assert.equal(spec.request.parent, parent); assert.equal(spec.delivery, 'caller'); assert.equal(spec.request.prompt.at(-1).text, text)
    assert.equal((await call({ action: 'start', sessionId: 'main', id: 'p', requestId: 'one' })).body.run.id, started.body.run.id)
    ctx.emit('session/event', { id: spec.childId }, { type: 'step/start', data: {} })
    assert.equal((await call({ action: 'runs' })).body.runs[0].steps, 1)
    await call({ action: 'save', id: 'p', name: '旧命令', text })
    assert.deepEqual(JSON.parse(await readFile(join(directory, 'quick-prompts.json'), 'utf8')), [{ id: 'p', name: '旧命令', text }])
    await plugin.dispose(); assert.equal(handler, undefined); assert.equal(disposed, 1)
  } finally { await ctx.fiber.dispose(); await rm(directory, { recursive: true, force: true }) }
})
