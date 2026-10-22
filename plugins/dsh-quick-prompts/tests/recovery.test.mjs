import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RecoveryCoordinator, recoveryId, makeRecoveryMessage, createRecoveryStore, installRecovery } from '../src/recovery.ts'
import { Context } from '@deepseek-ai/cordis'
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
const start = { seq: 1, type: 'turn/start', data: { turn: 1 } }
const end = reason => ({ seq: 3, type: 'turn/end', data: { turn: 1, reason } })
function fixture(tail = []) {
  let rows = []
  const store = { read: async () => structuredClone(rows), update: async change => { const next = structuredClone(rows); change(next); rows = next; return structuredClone(rows) } }
  const events = [start, { seq: 2, type: 'user/message', data: { id: 'original', role: 'user', source: { kind: 'user' } } }, ...tail]
  const session = { id: 'main', header: { cwd: '/project' }, snapshotEvents: () => events }
  const sent = [], reports = []
  const agent = { id: 'main', status: 'idle', session, inbox: { nextTurn: [], nextStep: [] }, followup: message => sent.push(message) }
  let live
  const runtime = { inspect: async () => ({ meta: session.header, events }), resolveAgent: async () => { live = agent; return { agent } }, get: () => live, eligible: () => true, makeMessage: (id, text) => ({ id, role: 'user', source: { kind: 'dsh-quick-prompts-recovery' }, content: [{ type: 'text', text }] }), report: (...args) => reports.push(args) }
  const coordinator = new RecoveryCoordinator(store, runtime)
  const seed = () => coordinator.observe(session, start)
  return { store, events, session, agent, sent, reports, runtime, coordinator, seed, live: value => { live = value } }
}
for (const ending of [[], [end({ kind: 'interrupted' })], [end({ kind: 'aborted', reason: { kind: 'disposed' } })]]) test('continues only the observed interrupted turn, once across repeated startups', async () => {
  const f = fixture(ending); await f.seed()
  await Promise.all([f.coordinator.recover(), f.coordinator.recover()])
  assert.equal(f.sent.length, 1)
  assert.equal(f.sent[0].id, recoveryId('main', 1))
  assert.equal(f.sent[0].source.kind, 'dsh-quick-prompts-recovery')
  assert.match(f.sent[0].content[0].text, /unknown/)
  assert.match(f.sent[0].content[0].text, /Do not change goal activation/)
  assert.equal((await f.store.read())[0].state, 'continued')
  await new RecoveryCoordinator(f.store, f.runtime).recover()
  assert.equal(f.sent.length, 1)
  assert.ok(f.reports.some(row => row[1] === 'manual-continuation-required'))
})
for (const reason of [{ kind: 'completed' }, { kind: 'error' }, { kind: 'blocked' }, { kind: 'aborted', reason: { kind: 'user' } }, { kind: 'aborted', reason: { kind: 'parent' } }]) test(`does not continue ${JSON.stringify(reason)}`, async () => {
  const f = fixture([end(reason)]); await f.seed(); await f.coordinator.recover()
  assert.equal(f.sent.length, 0); assert.deepEqual(await f.store.read(), [])
})
test('no historical enumeration; children and ineligible sessions are not recorded', async () => {
  const f = fixture(); await f.coordinator.recover(); assert.equal(f.sent.length, 0)
  f.session.header.origin = 'subagent'; await f.seed(); assert.deepEqual(await f.store.read(), [])
  delete f.session.header.origin; f.runtime.eligible = () => false; await f.seed(); assert.deepEqual(await f.store.read(), [])
})
test('completed live turn removes candidate; disposed keeps it', async () => {
  const f = fixture(); await f.seed(); await f.coordinator.observe(f.session, end({ kind: 'aborted', reason: { kind: 'disposed' } })); assert.equal((await f.store.read()).length, 1)
  await f.coordinator.observe(f.session, end({ kind: 'completed' })); assert.deepEqual(await f.store.read(), [])
})
test('new later user message or turn supersedes candidate', async () => {
  for (const event of [{ seq: 4, type: 'user/message', data: { id: 'new' } }, { seq: 4, type: 'turn/start', data: { turn: 2 } }]) {
    const f = fixture(); await f.seed(); f.events.push(event); await f.coordinator.recover(); assert.equal(f.sent.length, 0)
  }
})
test('running agent and competing inbox suppress continuation', async () => {
  for (const running of [true, false]) {
    const f = fixture(); await f.seed()
    if (running) { f.agent.status = 'running'; f.live(f.agent) } else f.agent.inbox.nextTurn.push({ id: 'human' })
    await f.coordinator.recover(); assert.equal(f.sent.length, 0)
  }
})
test('rechecks user activity after resolving cold agent', async () => {
  const f = fixture(); await f.seed(); const resolve = f.runtime.resolveAgent
  f.runtime.resolveAgent = async () => { const value = await resolve(); f.events.push({ seq: 4, type: 'user/message', data: { id: 'race' } }); return value }
  await f.coordinator.recover(); assert.equal(f.sent.length, 0)
})
test('rechecks cancellation after durable reservation', async () => {
  const f = fixture(); await f.seed(); const update = f.store.update
  f.store.update = async change => { const result = await update(change); if (result[0]?.state === 'reserved') f.events.push(end({ kind: 'aborted', reason: { kind: 'user' } })); return result }
  await f.coordinator.recover(); assert.equal(f.sent.length, 0)
})
test('reserved crash gap and followup errors require manual continuation', async () => {
  for (const gap of [true, false]) {
    const f = fixture(); await f.seed()
    if (gap) await f.store.update(rows => { rows[0].state = 'reserved' })
    else f.agent.followup = () => { throw new Error('admission failed') }
    await f.coordinator.recover(); await new RecoveryCoordinator(f.store, f.runtime).recover()
    assert.equal(f.sent.length, 0); assert.ok(f.reports.some(row => row[1] === 'manual-continuation-required'))
  }
})
test('failed persistence never admits a prompt', async () => {
  const f = fixture(); await f.seed(); f.store.update = async () => { throw new Error('disk full') }
  await f.coordinator.recover(); assert.equal(f.sent.length, 0); assert.ok(f.reports.some(row => row[1] === 'recovery-failed'))
})
test('message uses required user role with truthful producer and immutable identity', () => {
  const message = makeRecoveryMessage('stable-id', 'recover')
  assert.equal(message.id, 'stable-id'); assert.equal(message.role, 'user')
  assert.equal(message.source.kind, 'dsh-quick-prompts-recovery')
  assert.ok(Object.isFrozen(message)); assert.ok(Object.isFrozen(message.source)); assert.ok(Object.isFrozen(message.content[0]))
})
test('observed newer human input after ended turn removes stale recovery', async () => {
  const f = fixture([end({ kind: 'interrupted' })]); await f.seed()
  const message = { seq: 4, type: 'user/message', data: { id: 'human-new' } }; f.events.push(message)
  await f.coordinator.observe(f.session, message); assert.deepEqual(await f.store.read(), [])
})
test('observeRunning records midturn only, without downgrading prior reservation', async () => {
  const f = fixture(); await f.coordinator.observeRunning(f.agent); assert.deepEqual(await f.store.read(), [])
  f.agent.status = 'running'; await f.coordinator.observeRunning(f.agent)
  await f.store.update(rows => { rows[0].state = 'reserved' })
  await f.coordinator.observeRunning(f.agent); assert.equal((await f.store.read())[0].state, 'reserved')
})
test('real atomic store survives three coordinator lifetimes without duplicate continuation', async t => {
  const root = await realpath(tmpdir())
  const directory = await mkdtemp(join(root, 'dqp-recovery-test-'))
  t.after(async () => {
    const target = await realpath(directory)
    assert.equal(target, resolve(directory)); assert.ok(target.startsWith(join(root, 'dqp-recovery-test-')))
    await rm(target, { recursive: true, force: true })
  })
  const f = fixture()
  const first = new RecoveryCoordinator(createRecoveryStore(directory), f.runtime)
  await first.observe(f.session, start); await first.dispose()
  const file = join(directory, 'quick-prompts-recovery.json')
  const recorded = JSON.parse(await readFile(file, 'utf8'))
  assert.equal(recorded[0].startSeq, 1); assert.equal(recorded[0].state, undefined)

  // Separate store objects emulate fresh plugin/host lifetimes; a raw crash tail
  // deliberately has no turn/end. Native repair belongs to the injected resolver.
  const secondStore = createRecoveryStore(directory)
  const originalUpdate = secondStore.update.bind(secondStore)
  let durableReservation = false
  secondStore.update = async change => {
    const result = await originalUpdate(change)
    if (result[0]?.state === 'reserved') {
      assert.equal(JSON.parse(await readFile(file, 'utf8'))[0].state, 'reserved')
      durableReservation = true
    }
    return result
  }
  f.agent.followup = message => { assert.ok(durableReservation); f.sent.push(message) }
  const second = new RecoveryCoordinator(secondStore, f.runtime)
  await second.recover(); await second.dispose()
  assert.equal(f.sent.length, 1)
  assert.equal(JSON.parse(await readFile(file, 'utf8'))[0].state, 'continued')

  const third = new RecoveryCoordinator(createRecoveryStore(directory), f.runtime)
  await third.recover(); await third.dispose()
  assert.equal(f.sent.length, 1)
  assert.ok(f.reports.some(row => row[1] === 'manual-continuation-required'))
})
test('Cordis installer persists live events, restores once after startup, and releases listeners', async t => {
  const root = await realpath(tmpdir())
  const directory = await mkdtemp(join(root, 'dqp-recovery-cordis-'))
  const contexts = []
  t.after(async () => {
    for (const ctx of contexts) await ctx.fiber.dispose()
    const target = await realpath(directory)
    assert.equal(target, resolve(directory)); assert.ok(target.startsWith(join(root, 'dqp-recovery-cordis-')))
    await rm(target, { recursive: true, force: true })
  })
  const f = fixture()
  const boot = async () => {
    const ctx = new Context(); contexts.push(ctx)
    await ctx.plugin(provider => {
      provider.provide('agents', { get: id => f.runtime.get(id) })
      provider.provide('sessions', { list: () => f.runtime.get('main') ? [f.session] : [] })
      provider.provide('workspaceRegistry', { archivedSessionIds: [] })
      provider.provide('sessionController', { inspect: id => f.runtime.inspect(id), resolveAgent: id => f.runtime.resolveAgent(id) })
    })
    let recovery
    const plugin = ctx.plugin({ inject: ['agents', 'sessions', 'sessionController', 'workspaceRegistry'], apply: scope => { recovery = installRecovery(scope, directory) } })
    await plugin
    await Promise.resolve()
    await recovery.recover()
    return { ctx, plugin, recovery }
  }
  const first = await boot()
  assert.deepEqual(await first.recovery.status(), [])
  f.live(f.agent); f.agent.status = 'running'
  first.ctx.emit('session/event', f.session, start)
  assert.equal((await first.recovery.status())[0].sessionId, 'main')
  const disposed = end({ kind: 'aborted', reason: { kind: 'disposed' } }); f.events.push(disposed)
  first.ctx.emit('session/event', f.session, disposed)
  await first.plugin.dispose()
  const saved = await first.recovery.status()
  assert.equal(saved.length, 1); assert.equal(saved[0].state, undefined)
  // After teardown the old host cannot mutate the persisted registry.
  first.ctx.emit('session/event', f.session, { seq: 99, type: 'turn/start', data: { turn: 99 } })
  assert.deepEqual(await first.recovery.status(), saved)
  await first.ctx.fiber.dispose()

  f.live(undefined); f.agent.status = 'idle'
  const second = await boot()
  assert.equal(f.sent.length, 1)
  assert.equal(f.sent[0].source.kind, 'dsh-quick-prompts-recovery')
  assert.equal((await second.recovery.status())[0].state, 'continued')
  assert.equal(JSON.parse(await readFile(join(directory, 'quick-prompts-recovery.json'), 'utf8'))[0].requestId, f.sent[0].id)
  await second.plugin.dispose()
  second.ctx.emit('session/event', f.session, end({ kind: 'completed' }))
  assert.equal((await second.recovery.status())[0].state, 'continued')
  assert.equal(f.sent.length, 1)
})
test('stop during cold resume prevents admission', async () => {
  const f = fixture(); await f.seed(); let release
  f.runtime.inspect = () => new Promise(resolve => { release = () => resolve({ meta: f.session.header, events: f.events }) })
  const recovery = f.coordinator.recover(); await new Promise(resolve => setImmediate(resolve))
  const disposal = f.coordinator.dispose(); release(); await Promise.all([recovery, disposal]); assert.equal(f.sent.length, 0)
})
