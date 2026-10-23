import test from 'node:test'
import assert from 'node:assert/strict'
import { installModelSourceMenu } from '../src/client/model-menu.ts'

function harness({ enabled = true, restricted = false } = {}) {
  let preferencesState = { enabled, ambient: true, motion: true }
  const listeners = new Set()
  const preferences = {
    getSnapshot: () => preferencesState,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    update(patch) { preferencesState = { ...preferencesState, ...patch }; [...listeners].forEach(fn => fn()) },
  }
  const original = { options: { name: 'conversation.input.model', priority: 0 }, render: () => 'original' }
  const entries = [original]
  let mount, disposeMount
  let loadCount = 0
  const selections = [], sessionIds = []
  const state = Object.freeze({ current: null, routable: null, groups: [], failures: [], status: 'ready', pending: null, error: null })
  const store = { getSnapshot: () => state, subscribe: () => () => {} }
  const result = { ok: true }
  const directory = {
    store,
    async load() { loadCount++; return state },
    async select(value) { selections.push(value); return result },
  }
  const slots = {
    inject(name, install) {
      assert.equal(name, 'conversation.input.model')
      mount = () => { disposeMount = install() }
      mount()
      return () => { disposeMount?.(); disposeMount = undefined; mount = undefined }
    },
    register(options, render) {
      const entry = { options, render }
      entries.push(entry)
      return () => { const index = entries.indexOf(entry); if (index >= 0) entries.splice(index, 1) }
    },
  }
  const dispose = installModelSourceMenu(slots, {
    directoryFor(id) { sessionIds.push(id); return directory },
  }, { subagentAddress: () => restricted ? { parent: 'parent' } : undefined })
  return {
    preferences, listeners, entries, original, store, result, directory, selections, sessionIds, dispose,
    loadCount: () => loadCount,
    active: () => [...entries].sort((a, b) => a.options.priority - b.options.priority)[0],
    removeDeclaration() { disposeMount?.(); disposeMount = undefined },
    restoreDeclaration() { mount?.() },
  }
}

test('registers while the plugin component is enabled and restores the original menu on disposal', () => {
  const f = harness({ enabled: false })
  const replacement = f.active()
  assert.notStrictEqual(replacement, f.original)
  assert.equal(replacement.options.name, 'conversation.input.model')
  assert.equal(f.entries.length, 2)
  f.preferences.update({ motion: false })
  assert.strictEqual(f.active(), replacement)
  assert.equal(f.entries.length, 2)
  f.dispose()
  assert.strictEqual(f.active(), f.original)
  assert.equal(f.entries.length, 1)
})

test('tracks declaration disposal and recreation without duplicate registrations', () => {
  const f = harness()
  assert.equal(f.entries.length, 2)
  f.removeDeclaration()
  assert.strictEqual(f.active(), f.original)
  f.restoreDeclaration()
  assert.equal(f.entries.length, 2)
  f.dispose()
  assert.equal(f.entries.length, 1)
})

test('uses the shared directory and forwards exact provider/model/effort without rewriting', async () => {
  const f = harness()
  const props = f.active().options.inject('session-one')
  assert.deepEqual(f.sessionIds, ['session-one'])
  assert.equal(props.available, true)
  assert.strictEqual(props.directory, f.store)
  props.load()
  assert.equal(f.loadCount(), 1)
  const selection = Object.freeze({ provider: 'magpie/responses', model: 'upstream/model · Codex', reasoningEffort: 'very-high' })
  assert.strictEqual(await props.select(selection), f.result)
  assert.strictEqual(f.selections[0], selection)
  const defaultEffort = Object.freeze({ provider: 'deepseek-account', model: 'deepseek-v4' })
  await props.select(defaultEffort)
  assert.strictEqual(f.selections[1], defaultEffort)
  assert.equal(Object.hasOwn(f.selections[1], 'reasoningEffort'), false)
  f.dispose()
})

test('prevents catalog loads and model selection for an addressed subagent', async () => {
  const f = harness({ restricted: true })
  const props = f.active().options.inject('child-session')
  assert.equal(props.available, false)
  props.load()
  assert.equal(await props.select({ provider: 'p', model: 'm', reasoningEffort: 'high' }), undefined)
  assert.equal(f.loadCount(), 0)
  assert.deepEqual(f.selections, [])
  f.dispose()
})

test('returns host selection failures unchanged', async () => {
  const f = harness()
  const failure = { ok: false, error: { code: 'session/writer-held', message: 'Busy' } }
  f.directory.select = async () => failure
  const props = f.active().options.inject('session')
  assert.strictEqual(await props.select({ provider: 'p', model: 'm' }), failure)
  f.dispose()
})
