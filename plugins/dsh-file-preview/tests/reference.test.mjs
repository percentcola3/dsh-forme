import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileReference } from '../src/client/selection-menu.ts'

test('code selection keeps the native file reference resolvable', () => {
  const ref = fileReference('/work/交互 示例.ts', { start: 2, end: 4 })
  assert.equal(ref.ref, '@"/work/交互 示例.ts"')
  assert.equal(ref.clipboardText, ref.ref)
  assert.match(ref.label, /:2-4/)
  // This is how the official reference opener recovers the file path.
  assert.equal(ref.ref.slice(2, -1), '/work/交互 示例.ts')
})

test('paths that the native reference grammar cannot represent are rejected', () => {
  for (const path of ['/work/a"b.ts', '/work/a\nb.ts', '/work/a\0b.ts']) {
    assert.throws(() => fileReference(path), /不支持/)
  }
})
import { readFileSync } from 'node:fs'
import { Readable } from 'node:stream'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Context } from '@deepseek-ai/cordis'
import { apply, inject } from '../src/index.ts'

test('the header chip shows a git icon only for git workspaces and no folder icon otherwise', async () => {
  const patch = readFileSync(new URL('../src/client/index.ts', import.meta.url), 'utf8')
  assert.match(patch, /data-dfp-git/)
  assert.doesNotMatch(patch, /M2.5 4.5h4l1.5 1.5h5.5v7.5h-11z/, 'the old folder glyph is gone')
  assert.match(patch, /cursor:copy/, 'the whole path chip is the copy target')
})

test('the scoped git endpoint rejects foreign sessions and answers for the workspace directory', async () => {
  const directory = '/tmp'
  const ctx = new Context()
  let handler
  await ctx.plugin(provider => {
    provider.provide('connection', { requestRejection: req => req.headers.denied ? 403 : undefined })
    provider.provide('webServer', { register: route => { handler = route.handler; return () => { handler = undefined } } })
    provider.provide('sessions', { list: () => [{ id: 'mine', header: { id: 'mine', cwd: directory } }] })
  })
  await ctx.plugin({ inject, apply: scope => apply(scope) })
  const call = async (body, headers = {}) => {
    const req = Readable.from([Buffer.from(JSON.stringify(body))]); req.method = 'POST'; req.headers = { 'content-type': 'application/json', ...headers }
    let value; const res = { setHeader() {}, end(text) { value = JSON.parse(text) } }
    await handler(req, res); return { status: res.statusCode, body: value }
  }
  assert.equal((await call({ sessionId: 'mine' }, { denied: 'yes' })).status, 403)
  assert.equal((await call({ sessionId: 'other' })).status, 400)
  const answer = await call({ sessionId: 'mine' })
  assert.equal(answer.status, 200)
  assert.equal(typeof answer.body.git, 'boolean')
  await ctx.fiber.dispose()
})
