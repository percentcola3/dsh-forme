import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPreferences, defaults, parsePreferences, sessionStatus, STORAGE_KEY } from '../src/client/state.ts'
import { installTheme } from '../src/client/runtime.ts'

test('handles corrupt, missing, and untrusted persisted preferences', () => {
  for (const raw of [null, 'broken', 'null', '[]', '42']) assert.deepEqual(parsePreferences(raw), defaults)
  assert.deepEqual(parsePreferences('{"enabled":false,"motion":"false","ambient":false,"unknown":1}'), { enabled: false, motion: true, ambient: false })
})

test('persists changes, synchronizes another window, and tolerates unavailable storage', () => {
  const saved = new Map()
  const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) }
  const store = createPreferences(storage)
  let updates = 0
  const stop = store.subscribe(() => updates++)
  store.update({ enabled: false })
  assert.equal(updates, 1)
  assert.equal(createPreferences(storage).getSnapshot().enabled, false)
  store.receive(saved.get(STORAGE_KEY))
  assert.equal(updates, 1)
  store.receive(null)
  assert.deepEqual(store.getSnapshot(), defaults)
  stop()
  store.update({ motion: false })
  assert.equal(updates, 2)
  const denied = createPreferences({ getItem() { throw Error('denied') }, setItem() { throw Error('denied') } })
  denied.update({ enabled: false })
  assert.equal(denied.getSnapshot().enabled, false)
})

test('reports current session state without presenting errors as successful activity', () => {
  assert.equal(sessionStatus(), 'standby')
  assert.equal(sessionStatus('a'), 'connecting')
  assert.equal(sessionStatus('a', { running: true }), 'working')
  assert.equal(sessionStatus('a', { awaitingFirstTurn: true }), 'working')
  assert.equal(sessionStatus('a', { running: false }), 'standby')
  for (const key of ['lastAgentError', 'promptError', 'openError']) {
    assert.equal(sessionStatus('a', { running: true, [key]: 'failure' }), 'error')
  }
  assert.equal(sessionStatus('a', {}, true), 'offline')
  assert.equal(sessionStatus('a', { removed: true }), 'offline')
})

test('reflects host hydration, running updates and pending approvals instead of inventing activity', () => {
  for (const openState of ['cold', 'loading', 'opening']) {
    assert.equal(sessionStatus('a', { openState, running: false }), 'connecting')
  }
  assert.equal(sessionStatus('a', { openState: 'error' }), 'error')
  assert.equal(sessionStatus('a', { openState: 'open' }), 'standby')
  assert.equal(sessionStatus('a', { running: false }, false, { running: true }), 'working')
  const approval = { running: true, pendingInteraction: { id: 'approval-1' } }
  assert.equal(sessionStatus('a', { running: true }, false, approval), 'waiting')
  assert.equal(sessionStatus('a', { running: true }, false, { running: true }), 'working', 'resolving approval resumes the actual running state')
  assert.equal(sessionStatus('a', { running: false }, false, { running: false }), 'standby', 'stopping does not imply success')
  assert.equal(sessionStatus('a', { lastAgentError: 'failed' }, false, approval), 'error')
  assert.equal(sessionStatus('a', { removed: true }, false, approval), 'offline')
  assert.equal(sessionStatus('a', {}, true, approval), 'offline')
  assert.equal(sessionStatus(undefined, { running: true }, false, approval), 'standby', 'another session must never light up the current draft')
})

test('disabling and disposing restores the host without leaking styles or listeners', () => {
  const attrs = new Map([['data-moss-ambient', 'host-value']])
  let removed = false
  let attached = false
  const events = new Map()
  const body = { getAttribute: key => attrs.get(key) ?? null, setAttribute: (key, value) => attrs.set(key, value), removeAttribute: key => attrs.delete(key) }
  const doc = { body, head: { appendChild() { attached = true } }, createElement: () => ({ dataset: {}, remove() { removed = true } }) }
  const win = { addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name) }
  const store = createPreferences()
  const dispose = installTheme(store, doc, win)
  assert.equal(attached, true)
  assert.equal(attrs.get('data-moss-theme'), 'on')
  store.update({ enabled: false, motion: false })
  assert.equal(attrs.get('data-moss-theme'), 'off')
  assert.equal(attrs.get('data-moss-motion'), 'off')
  events.get('storage')({ key: STORAGE_KEY, newValue: '{"enabled":true}' })
  assert.equal(attrs.get('data-moss-theme'), 'on')
  dispose()
  assert.equal(removed, true)
  assert.equal(events.size, 0)
  assert.deepEqual([...attrs], [['data-moss-ambient', 'host-value']])
  store.update({ motion: false })
  assert.equal(attrs.has('data-moss-motion'), false)
})
