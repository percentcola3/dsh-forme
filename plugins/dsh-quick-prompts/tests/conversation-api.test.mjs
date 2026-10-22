import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { apply, inject } from '../src/index.ts'
const tick = () => new Promise(resolve => setImmediate(resolve))
test('production API starts independent chat without spawn and authenticates scoped follow-up messages', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dqp-chat-api-'))
  const ctx = new Context(); let handler
  const agents = new Map([['main', { id: 'main', session: { header: { id: 'main', cwd: '/tmp' }, snapshotEvents: () => [] } }]])
  const prompts = [], stopped = [], created = [], disposed = []
  const childScope = { get: name => ({ agentPresets: { composeFrom() {} }, tools: { guard() {} }, workingDirectory: { async set() {} } })[name] }
  agents.get('main').ctx = { get: () => undefined }
  const call = async (body, headers = {}) => {
    const req = Readable.from([Buffer.from(JSON.stringify({ sessionId: 'main', ...body }))]); req.method = 'POST'; req.headers = { 'content-type': 'application/json', ...headers }
    let value; const res = { setHeader() {}, end(text) { value = JSON.parse(text) } }; await handler(req, res); return { status: res.statusCode, body: value }
  }
  try {
    await ctx.plugin(provider => {
      provider.provide('connection', { requestRejection: req => req.headers.denied ? 403 : undefined })
      provider.provide('webServer', { register: route => { handler = route.handler; return () => { handler = undefined } } })
      provider.provide('agents', { get: id => agents.get(id), async create(options) {
        created.push(options)
        const sessionId = options.sessionId
        const agent = { id: sessionId, ctx: childScope, cancel: (_cause, settings) => stopped.push({ sessionId, ...settings }), followup: message => prompts.push({ sessionId, requestId: message.id, content: message.content }), session: { header: { id: sessionId, ...options.meta }, append() {}, snapshotEvents: () => [] } }
        await options.setup(childScope, agent)
        agents.set(sessionId, agent)
        return { agent, async dispose() { disposed.push(sessionId); agents.delete(sessionId) } }
      } })
      provider.provide('llm', { listProviders: () => [{ id: 'deepseek-account', name: 'DeepSeek' }], listModels: async () => [{ id: 'deepseek-flash', name: 'DeepSeek Flash' }] })
      provider.provide('sessions', { list: () => [] })
      provider.provide('workspaceRegistry', { attachSession() { throw new Error('headless tasks must not join workspace conversations') } })
      provider.provide('sessionController', { create() { throw new Error('headless tasks must not create ordinary conversations') } })
    })
    await ctx.plugin({ inject, apply: scope => apply(scope, {}, { directory }) })
    const saved = await call({ action: 'save', name: '检查', text: '检查代码' }); const prompt = saved.body.prompts.find(item => item.name === '检查')
    const started = await call({ action: 'start', id: prompt.id, requestId: 'first' }); assert.equal(started.status, 202)
    await tick(); const run = (await call({ action: 'runs' })).body.runs[0]
    assert.equal(run.sessionKind, 'headless'); assert.notEqual(run.childId, 'main')
    assert.equal(created[0].meta.origin, 'subagent'); assert.equal(created[0].parentAgent, undefined)
    assert.equal(prompts[0].content.at(-1).text, '检查代码'); assert.equal(prompts[0].content.length, 3)
    ctx.emit('session/event', { id: run.childId, ...agents.get(run.childId).session }, { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '结果' }] } } })
    ctx.emit('session/event', { id: run.childId, ...agents.get(run.childId).session }, { type: 'turn/end', data: { reason: { kind: 'completed' } } }); await tick()
    const denied = await call({ action: 'reply', runId: run.id, text: '继续', requestId: 'next' }, { denied: 'yes' }); assert.equal(denied.status, 403)
    const foreign = await call({ action: 'reply', runId: run.id, projectId: 'other', text: '继续', requestId: 'next' }); assert.equal(foreign.status, 400)
    assert.equal(prompts.length, 1)
    const accepted = await call({ action: 'reply', runId: run.id, text: '解释结果', requestId: 'next' }); assert.equal(accepted.status, 202)
    assert.equal(prompts[1].sessionId, run.childId); assert.equal(prompts[1].requestId, 'next')
    assert.deepEqual(accepted.body.run.messages.map(message => message.text), ['检查代码', '结果', '解释结果'])
    await call({ action: 'reply', runId: run.id, text: '解释结果', requestId: 'next' }); assert.equal(prompts.length, 2)
    await call({ action: 'close', runId: run.id }); await tick()
    assert.equal(stopped.at(-1).sessionId, run.childId); assert.equal(stopped.at(-1).keepInbox, false)
    assert.deepEqual(disposed, [run.childId]); assert.equal(agents.has(run.childId), false)
    assert.ok(prompts.every(request => request.sessionId === run.childId))
  } finally { await ctx.fiber.dispose(); await rm(directory, { recursive: true, force: true }) }
})
