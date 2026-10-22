import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { apply, inject, validatePrompt } from '../src/index.ts'
import { ProjectPrompts, projectOf } from '../src/project-prompts.ts'
import { modelCatalog, requireAvailableModel, resolveTaskModel, validateModel } from '../src/models.ts'
const selection = { provider: 'configured', model: 'model/a' }
const registry = { listProviders: () => [{ id: 'configured', name: 'Configured', apiKey: 'secret' }], listModels: async () => [{ id: 'model/a', name: 'Model A', apiKey: 'secret' }] }
test('model validation rejects malformed routes and strips unapproved override fields', () => {
  for (const model of [[], 'model', {}, { provider: '', model: 'a' }, { provider: 'p', model: ' ' }, { provider: 'p', model: 'a\0' }, { provider: 'p', model: 3 }]) assert.throws(() => validatePrompt({ name: 'x', text: 'x', model }), /模型选择无效/)
  assert.deepEqual(validatePrompt({ name: 'x', text: 'x', model: { ...selection, permissions: 'all', reasoningEffort: 'high' } }).model, selection)
  assert.equal('model' in validatePrompt({ name: 'x', text: 'x' }), false)
  assert.equal(validateModel(null), null)
  assert.equal(validatePrompt({ name: 'x', text: 'x', model: null }).model, null)
})
test('catalog projects only live public metadata and isolates failed providers', async () => {
  assert.deepEqual(await modelCatalog(registry), [{ ...selection, label: 'Model A', providerLabel: 'Configured' }])
  assert.deepEqual(await modelCatalog({ ...registry, listProviders: () => [...registry.listProviders(), { id: 'broken', name: 'Broken' }], listModels: async id => { if (id === 'broken') throw Error('secret'); return registry.listModels(id) } }), await modelCatalog(registry))
  await requireAvailableModel(undefined, undefined)
  await requireAvailableModel(registry, selection)
  await assert.rejects(requireAvailableModel(registry, { ...selection, model: 'stale' }), /当前不可用/)
  await assert.rejects(requireAvailableModel(undefined, selection), /尚未就绪/)
})
test('selection roundtrips across reload and omission clears persisted selection', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'quick-model-store-'))
  try {
    const project = await projectOf(directory), store = new ProjectPrompts(directory)
    const saved = (await store.change(project, 'save', { name: 'x', text: 'x', model: selection }, validatePrompt)).prompts[0]
    assert.deepEqual((await new ProjectPrompts(directory).list(project)).prompts[0].model, selection)
    await store.change(project, 'save', { id: saved.id, name: 'x', text: 'x', model: null }, validatePrompt)
    assert.equal((await new ProjectPrompts(directory).list(project)).prompts[0].model, null)
    await store.change(project, 'save', { id: saved.id, name: 'x', text: 'x' }, validatePrompt)
    assert.equal('model' in (await new ProjectPrompts(directory).list(project)).prompts[0], false)
    assert.equal('model' in JSON.parse(await readFile(join(directory, 'quick-prompts.projects.json'), 'utf8'))[0].prompts[0], false)
  } finally { await rm(directory, { recursive: true, force: true }) }
})
test('authenticated scoped models route forwards only child agentOptions, inherits explicitly and rejects stale launch', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'quick-model-api-')), ctx = new Context()
  let handler, available = true, flashAvailable = false
  const specs = []
  const parent = { id: 'main', options: { provider: 'parent', model: 'current' }, session: { header: { id: 'main', cwd: directory }, requestHeader: () => ({ config: { provider: 'parent', model: 'pending' } }) } }
  const call = async (body, denied = false) => {
    const req = Readable.from([Buffer.from(JSON.stringify({ sessionId: 'main', ...body }))]); req.method = 'POST'; req.headers = { 'content-type': 'application/json', denied }
    let output; const res = { setHeader() {}, end(value) { output = JSON.parse(value) } }
    await handler(req, res); return { status: res.statusCode, ...output }
  }
  try {
    await ctx.plugin(provider => {
      provider.provide('connection', { requestRejection: req => req.headers.denied ? 403 : undefined })
      provider.provide('webServer', { register: route => { handler = route.handler; return () => {} } })
      provider.provide('sessionController', {}); provider.provide('workspaceRegistry', { archivedSessionIds: [] })
      provider.provide('sessions', { list: () => [] }); provider.provide('agents', { get: id => id === 'main' ? parent : undefined })
      provider.provide('llm', {
        listProviders: () => [...registry.listProviders(), ...flashAvailable ? [{ id: 'deepseek-account', name: 'DeepSeek' }] : []],
        listModels: async provider => provider === 'deepseek-account' ? flashAvailable ? [{ id: 'deepseek-flash', name: 'DeepSeek Flash' }] : [] : available ? registry.listModels() : [],
      })
      provider.provide('subagents', { getProvider: () => ({}), resolveMaxDepth: () => 4, interrupt() {}, startActivation: async spec => {
        specs.push(spec); let resolve
        return { childId: spec.childId, result: new Promise(done => { resolve = done }), dispose: async () => resolve({ stopReason: 'aborted' }) }
      } })
    })
    await ctx.plugin({ inject, apply: scope => apply(scope, {}, { directory, runtime: scope.get('subagents') }) })
    assert.equal((await call({ action: 'models' }, true)).status, 403)
    assert.equal((await call({ action: 'models', projectId: 'wrong' })).status, 400)
    assert.equal((await call({ action: 'models', sessionId: 'unknown' })).status, 400)
    const catalog = await call({ action: 'models' })
    assert.equal(catalog.status, 200); assert.deepEqual(catalog.models, await modelCatalog(registry)); assert.equal(catalog.cwd, (await projectOf(directory)).cwd)
    const saved = await call({ action: 'save', name: 'task', text: 'hello', model: { ...selection, permissions: 'all' } }), id = saved.prompts[0].id
    assert.equal((await call({ action: 'start', id, requestId: 'explicit' })).status, 202)
    assert.equal(specs[0].provider, 'spawn'); assert.deepEqual(specs[0].request.agentOptions, selection)
    assert.equal(specs[0].request.parent, parent); assert.deepEqual(parent.options, { provider: 'parent', model: 'current' })
    available = false
    assert.deepEqual((await call({ action: 'list' })).prompts[0].model, selection)
    const stale = await call({ action: 'start', id, requestId: 'stale' }); assert.equal(stale.status, 400); assert.match(stale.error, /当前不可用/); assert.equal(specs.length, 1)
    assert.equal((await call({ action: 'save', id, name: 'task', text: 'hello', model: null })).status, 200)
    assert.equal((await call({ action: 'start', id, requestId: 'inherit' })).status, 202)
    assert.equal('agentOptions' in specs[1].request, false); assert.equal(specs[1].request.parent, parent)
    assert.equal((await call({ action: 'save', id, name: 'task', text: 'hello' })).status, 200)
    const noFlash = await call({ action: 'start', id, requestId: 'no-flash' })
    assert.equal(noFlash.status, 400); assert.match(noFlash.error, /DeepSeek Flash.*不可用/)
    assert.equal(specs.length, 2)
    flashAvailable = true
    assert.equal((await call({ action: 'start', id, requestId: 'default-flash' })).status, 202)
    assert.deepEqual(specs[2].request.agentOptions, { provider: 'deepseek-account', model: 'deepseek-flash' })
    assert.equal(specs[2].request.parent, parent)
    assert.deepEqual(parent.options, { provider: 'parent', model: 'current' })
    assert.equal('model' in (await call({ action: 'list' })).prompts[0], false)
  } finally { await ctx.fiber.dispose(); await rm(directory, { recursive: true, force: true }) }
})

test('default Flash selects official accounts first and remains deterministic across catalog order', async () => {
  const catalog = entries => ({
    listProviders: () => entries.map(([id]) => ({ id, name: id })),
    listModels: async provider => entries.find(([id]) => id === provider)[1].map(id => ({ id, name: id })),
  })
  const entries = [['z-router', ['deepseek-v4-flash']], ['deepseek', ['deepseek-flash']], ['deepseek-account', ['deepseek-flash']]]
  for (const ordered of [entries, [...entries].reverse()]) assert.deepEqual(await resolveTaskModel(catalog(ordered), undefined), { provider: 'deepseek-account', model: 'deepseek-flash' })
  assert.deepEqual(await resolveTaskModel(catalog(entries.slice(0, 2)), undefined), { provider: 'deepseek', model: 'deepseek-flash' })
  const alternatives = [['z-router', ['deepseek-flash']], ['a-router', ['deepseek-v4-flash', 'deepseek-flash']]]
  for (const ordered of [alternatives, [...alternatives].reverse()]) assert.deepEqual(await resolveTaskModel(catalog(ordered), undefined), { provider: 'a-router', model: 'deepseek-flash' })
})
test('default Flash rejects unrelated Flash and unavailable catalogs without parent fallback', async () => {
  for (const provider of ['other', 'deepseek']) {
    const unrelated = { listProviders: () => [{ id: provider, name: provider }], listModels: async () => ['glm-4.7-flash', 'gemini-flash', 'flash-attention'].map(id => ({ id, name: id })) }
    await assert.rejects(resolveTaskModel(unrelated, undefined), /DeepSeek Flash.*不可用/)
  }
  await assert.rejects(resolveTaskModel(undefined, undefined), /尚未就绪/)
  await assert.rejects(resolveTaskModel(registry, undefined), /DeepSeek Flash.*不可用/)
  assert.equal(await resolveTaskModel(undefined, null), undefined)
  assert.deepEqual(await resolveTaskModel(registry, selection), selection)
  await assert.rejects(resolveTaskModel(registry, { ...selection, model: 'missing' }), /当前不可用/)
  await assert.rejects(resolveTaskModel(registry, 'invalid'), /模型选择无效/)
})
