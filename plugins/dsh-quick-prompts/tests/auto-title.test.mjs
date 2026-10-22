import { Context } from '@deepseek-ai/cordis'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as wait } from 'node:timers/promises'
import { AutoTitleCoordinator, AUTO_TITLE_PROVIDER, titleInput, normalizeAutoTitle, installAutoTitles } from '../src/auto-title.ts'

const user = (seq, text, kind = 'user') => ({ seq, type: 'user/message', data: { source: { kind }, content: [{ type: 'text', text }] } })
const end = seq => ({ seq, type: 'turn/end', data: { turn: 2, reason: { kind: 'completed' } } })
const native = (seq, messageSeqs = [0]) => ({ seq, type: 'session/title', data: { title: 'Old topic', messageSeqs, source: { kind: 'provider', provider: 'session-title-first-prompt-llm' } } })
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
function fixture(generate = async () => '最新任务标题', options = {}) {
  const events = [user(0, 'Initial topic'), native(1), user(2, 'New topic'), { seq: 3, type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'Completed the new task' }] } } }, end(4)]
  const writes = [], calls = []
  let live = true, eligible = true
  const session = { id: 'root', header: { origin: 'web' }, snapshotEvents: () => events, append(type, data) { const event = { seq: events.length, type, data }; events.push(event); writes.push(event); coordinator.observe(session, event); return event } }
  const runtime = { live: () => live, eligible: () => eligible, route: () => ({ provider: 'p', model: 'm' }), generate: (...args) => { calls.push(args); return generate(...args) } }
  const coordinator = new AutoTitleCoordinator(runtime, { debounceMs: 0, ...options })
  const emit = event => { events.push(event); coordinator.observe(session, event) }
  return { events, writes, calls, session, coordinator, runtime, emit, start: () => coordinator.observe(session, events.at(-1)), live: value => { live = value }, eligible: value => { eligible = value } }
}

test('writes AI title with truthful automatic source and exact route without user rename', async () => {
  const f = fixture(); f.start(); await wait(15)
  assert.equal(f.calls.length, 1); assert.equal(f.writes.length, 1)
  assert.deepEqual(f.writes[0].data, { title: '最新任务标题', messageSeqs: [0, 2], source: { kind: 'provider', provider: AUTO_TITLE_PROVIDER, model: { provider: 'p', model: 'm' } } })
  assert.equal(JSON.parse(f.calls[0][0]).latestHumanTopic, 'New topic')
  await f.coordinator.dispose()
})

test('no historical generation, first-prompt duplicate, manual pin, child or failed completion', async () => {
  for (const mode of ['no-observe', 'first', 'pin', 'child', 'failed', 'covered', 'archived']) {
    const f = fixture()
    if (mode === 'first') f.events.splice(2, 1)
    if (mode === 'pin') f.events[1].data.source = { kind: 'user' }
    if (mode === 'child') f.session.header.parentSession = 'parent'
    if (mode === 'failed') f.events.at(-1).data.reason.kind = 'error'
    if (mode === 'covered') f.events[1].data.messageSeqs = [0, 2]
    if (mode === 'archived') f.eligible(false)
    if (mode !== 'no-observe') f.start()
    await wait(5); assert.equal(f.calls.length, 0, mode); await f.coordinator.dispose()
  }
})

test('public context excludes tool output, reasoning, and synthetic recovery notices', () => {
  const events = [user(0, 'Old topic'), user(1, 'Continue this'), user(2, 'RECOVERY SECRET', 'dsh-quick-prompts-recovery'),
    { seq: 3, type: 'tool/result', data: { content: 'TOOL SECRET' } },
    { seq: 4, type: 'assistant/message', data: { message: { content: [{ type: 'reasoning', text: 'THINK SECRET' }, { type: 'text', text: 'Public answer' }] } } },
    { seq: 5, type: 'assistant/message', data: { message: { channel: 'analysis', content: [{ type: 'text', text: 'PRIVATE' }] } } }]
  const result = titleInput(events, 5)
  assert.equal(JSON.parse(result.input).latestHumanTopic, 'Continue this')
  assert.match(result.input, /Public answer/); assert.doesNotMatch(result.input, /SECRET|PRIVATE/)
  assert.deepEqual(result.messageSeqs, [0, 1])
  const huge = [...events, ...Array.from({ length: 20 }, (_, i) => ({ seq: i + 6, type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'A'.repeat(10000) }] } } }))]
  const clipped = titleInput(huge, 30)
  assert.equal(JSON.parse(clipped.input).latestHumanTopic, 'Continue this'); assert.ok(clipped.input.length < 18000)
})

for (const kind of ['human', 'turn', 'manual', 'automatic', 'disposed', 'unloaded', 'unobserved']) test(`discards in-flight output after ${kind}`, async () => {
  const pending = deferred(), f = fixture(() => pending.promise); f.start(); await wait(5)
  const signal = f.calls[0][3]
  if (kind === 'human') f.emit(user(5, 'Something newer'))
  if (kind === 'turn') f.emit({ seq: 5, type: 'turn/start', data: { turn: 3 } })
  if (kind === 'manual') f.emit({ seq: 5, type: 'session/title', data: { title: 'Pinned', source: { kind: 'user' }, messageSeqs: [] } })
  if (kind === 'automatic') f.emit(native(5))
  if (kind === 'disposed') { f.live(false); f.coordinator.disposed(f.session) }
  if (kind === 'unobserved') f.events.push(user(5, 'Race without observer'))
  let disposal
  if (kind === 'unloaded') disposal = f.coordinator.dispose()
  if (kind !== 'unobserved') assert.equal(signal.aborted, true)
  pending.resolve('Stale'); await wait(5); await disposal
  assert.equal(f.writes.length, 0); await f.coordinator.dispose()
})

test('restores cached accepted title after late native result but never after manual pin', async () => {
  const f = fixture(); f.start(); await wait(5)
  f.emit(native(6)); await wait(1)
  assert.equal(f.writes.length, 2); assert.equal(f.calls.length, 1)
  f.emit(native(8))
  f.emit({ seq: 9, type: 'session/title', data: { title: 'Pinned', source: { kind: 'user' }, messageSeqs: [] } })
  await wait(1); assert.equal(f.writes.length, 2)
  await f.coordinator.dispose()
})

test('does not restore cached title over newer topic or arbitrary title providers', async () => {
  for (const newer of [false, true]) {
    const f = fixture(); f.start(); await wait(5)
    if (newer) f.emit(user(6, 'Next task'))
    const stale = native(7)
    if (!newer) stale.data.source.provider = 'another-title-plugin'
    f.emit(stale); await wait(1); assert.equal(f.writes.length, 1); await f.coordinator.dispose()
  }
})

test('one model call per session while canceled call settles', async () => {
  const pending = deferred(), f = fixture(() => pending.promise)
  f.start(); await wait(5)
  f.emit(user(5, 'Third topic')); f.emit(end(6)); await wait(5)
  assert.equal(f.calls.length, 1)
  pending.resolve('New title'); await wait(5)
  assert.equal(f.calls.length, 2); assert.equal(f.writes.length, 1)
  await f.coordinator.dispose()
})

test('global concurrency is bounded and queued work starts after settlement', async () => {
  const requests = [], sessions = [], coordinator = new AutoTitleCoordinator({ live: () => true, route: () => ({ provider: 'p', model: 'm' }), generate: () => { const d = deferred(); requests.push(d); return d.promise } }, { debounceMs: 0, concurrency: 2 })
  for (let i = 0; i < 4; i++) {
    const events = [user(0, 'first'), user(1, 'second'), end(2)]
    const session = { id: String(i), header: {}, snapshotEvents: () => events, append: () => {} }; sessions.push(session); coordinator.observe(session, events[2])
  }
  await wait(5); assert.equal(requests.length, 2)
  requests[0].resolve('Title'); await wait(5); assert.equal(requests.length, 3)
  for (const session of sessions) coordinator.disposed(session)
  requests.forEach(d => d.resolve('Title')); await coordinator.dispose()
})

test('timeout aborts model and a later success cannot commit', async () => {
  const pending = deferred(), f = fixture(() => pending.promise, { timeoutMs: 5 }); f.start(); await wait(15)
  assert.equal(f.calls[0][3].aborted, true); pending.resolve('Too late'); await wait(1)
  assert.equal(f.writes.length, 0); await f.coordinator.dispose()
})

test('adapter is optional and chooses pending session model over default', async () => {
  assert.equal(installAutoTitles({ get: () => undefined, effect() {} }), undefined)
  const f = fixture(), listeners = new Map(), requests = [], effects = []
  const services = {
    sessions: { get: () => f.session },
    sessionProjections: { stateOf: () => ({ pending: { provider: 'selected', model: 'latest' }, lastUsed: { provider: 'old', model: 'old' } }) },
    agentDefaultModel: { currentSelection: () => ({ provider: 'default', model: 'default' }) },
    llm: { async *stream(request) { requests.push(request); yield { type: 'text-delta', text: 'New task' }; yield { type: 'finish', reason: { kind: 'stop' } } } },
  }
  const ctx = { get: name => services[name], effect: fn => effects.push(fn()), on: (name, callback) => { listeners.set(name, callback); return () => listeners.delete(name) } }
  installAutoTitles(ctx); listeners.get('session/event')(f.session, f.events.at(-1)); await wait(280)
  assert.equal(requests.length, 1); assert.equal(requests[0].provider, 'selected'); assert.equal(requests[0].model, 'latest')
  assert.equal(requests[0].purpose, 'session-title'); assert.equal(requests[0].messages[0].source.kind, AUTO_TITLE_PROVIDER)
  assert.deepEqual(f.writes[0].data.source.model, { provider: 'selected', model: 'latest' })
  await Promise.all(effects.map(dispose => dispose())); await f.coordinator.dispose()
})

test('Cordis installer preserves native-like session identity and releases event listeners', async t => {
  const ctx = new Context(), requests = []
  t.after(() => ctx.fiber.dispose())
  // Class instance mirrors Session's identity semantics across service returns
  // and direct session/event payloads; do not substitute a traced plain record.
  class Session {
    id = 'cordis-root'
    header = { origin: 'web' }
    events = [user(0, 'Initial task'), native(1), user(2, 'Latest task'), end(3)]
    snapshotEvents() { return this.events }
    append(type, data) { const event = { type, data, seq: this.events.length }; this.events.push(event); ctx.emit('session/event', this, event); return event }
  }
  const session = new Session()
  await ctx.plugin(scope => {
    scope.provide('sessions', { get: id => id === session.id ? session : undefined })
    scope.provide('llm', { async *stream(request) { requests.push(request); yield { type: 'text-delta', text: 'Latest task title' }; yield { type: 'finish', reason: { kind: 'stop' } } } })
    scope.provide('sessionProjections', { stateOf: () => ({ pending: { provider: 'selected', model: 'reasoning-model', reasoningEffort: 'high' } }) })
    scope.provide('agentDefaultModel', { currentSelection: () => ({ provider: 'default', model: 'default' }) })
    scope.provide('workspaceRegistry', { archivedSessionIds: [] })
    scope.provide('sessionTitle', {})
  })
  const plugin = ctx.plugin({ inject: ['sessions', 'llm', 'agentDefaultModel', 'sessionProjections', 'sessionTitle', 'workspaceRegistry'], apply: scope => { installAutoTitles(scope) } })
  await plugin
  ctx.emit('session/event', session, session.events.at(-1))
  await wait(280)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].provider, 'selected'); assert.equal(requests[0].model, 'reasoning-model')
  assert.equal(requests[0].maxTokens, 4096); assert.equal(Object.hasOwn(requests[0], 'reasoningEffort'), false)
  assert.equal(session.events.at(-1).data.source.provider, AUTO_TITLE_PROVIDER)
  assert.deepEqual(session.events.at(-1).data.source.model, { provider: 'selected', model: 'reasoning-model' })
  await plugin.dispose()
  session.events.push(user(5, 'After disposal'), end(6))
  ctx.emit('session/event', session, session.events.at(-1))
  await wait(280); assert.equal(requests.length, 1)
})

test('unchanged title records coverage and avoids a second request without new human input', async () => {
  const f = fixture(async () => 'Old topic'); f.start(); await wait(5)
  assert.equal(f.writes.length, 1)
  f.emit(end(6)); await wait(5)
  assert.equal(f.calls.length, 1); await f.coordinator.dispose()
})

test('sanitizes title output and enforces Unicode-safe byte bound', () => {
  assert.equal(normalizeAutoTitle('\u001b[31m**测试标题**\nExplanation'), '测试标题')
  const title = normalizeAutoTitle('😀'.repeat(200)); assert.equal(Buffer.byteLength(title), 160); assert.equal([...title].length, 40)
})
