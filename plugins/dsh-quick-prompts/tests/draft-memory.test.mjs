import { test } from 'node:test'
import assert from 'node:assert/strict'
import { installDraftNavigation } from '../src/client/draft-memory.ts'

function fixture(savedDraft = { text: '未发送 @notes', references: [{ ref: 'notes' }] }) {
  const data = new Map([['dsh.conversation.draft-a', JSON.stringify({ draft: savedDraft, view: null })]])
  const store = value => ({ getSnapshot: () => value, subscribe: () => () => {} })
  const selection = { sessionId: 'sent-a' }
  const catalog = { phase: 'ready', ids: ['draft-a', 'sent-a', 'draft-b'], byId: {
    'draft-a': { blank: true, cwd: '/a', updatedAt: 10 }, 'sent-a': { blank: false, cwd: '/a', updatedAt: 20 }, 'draft-b': { blank: true, cwd: '/b', updatedAt: 1 },
  } }
  const groups = { phase: 'ready', archivedSessionIds: [], items: [
    { workspaceId: 'a', path: '/a', sessionIds: ['draft-a', 'sent-a'] },
    { workspaceId: 'b', path: '/b', sessionIds: ['draft-b'] },
  ] }
  const calls = []
  const nav = { selection: store(selection), startSession(...args) { calls.push(['new', ...args]) }, openWorkspace(...args) { calls.push(['workspace', ...args]); return Promise.resolve() }, openSession(id) { calls.push(['restore', id]) } }
  const original = nav.startSession
  const cleanup = installDraftNavigation(nav, { list: store(catalog) }, { list: store(groups) }, { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) })
  return { nav, data, calls, selection, groups, catalog, cleanup, original }
}
test('new task reopens the original workspace draft without altering semantic content', () => {
  const f = fixture(); const before = f.data.get('dsh.conversation.draft-a')
  f.nav.startSession()
  assert.deepEqual(f.calls, [['restore', 'draft-a']])
  assert.equal(f.data.get('dsh.conversation.draft-a'), before)
})
test('switching back to a workspace restores its pending draft', async () => {
  const f = fixture(); f.selection.sessionId = 'draft-b'
  await f.nav.openWorkspace('a')
  assert.deepEqual(f.calls, [['restore', 'draft-a']])
})
test('legacy string draft is supported, whitespace and invalid JSON are ignored', () => {
  const f = fixture('hello'); f.nav.startSession('a')
  assert.deepEqual(f.calls.pop(), ['restore', 'draft-a'])
  for (const value of [JSON.stringify({ draft: ' ' }), '{']) {
    f.data.set('dsh.conversation.draft-a', value); f.nav.startSession('a')
    assert.equal(f.calls.pop()[0], 'new')
  }
})
test('explicit prompt, clear request and preset preserve native creation policy', () => {
  const f = fixture()
  for (const options of [{ prompt: 'new request' }, { prompt: '' }, { clearPreviousDraft: true }, { agentPreset: 'other' }]) f.nav.startSession('a', options)
  assert.ok(f.calls.every(call => call[0] === 'new'))
})
test('drafts cannot cross workspaces or resurrect archived/sent sessions', () => {
  const f = fixture(); f.nav.startSession('b'); assert.equal(f.calls.pop()[0], 'new')
  f.groups.archivedSessionIds.push('draft-a'); f.nav.startSession('a'); assert.equal(f.calls.pop()[0], 'new')
  f.groups.archivedSessionIds.length = 0; f.catalog.byId['draft-a'].blank = false
  f.nav.startSession('a'); assert.equal(f.calls.pop()[0], 'new')
})
test('sent/cleared draft is no longer selected on the next new task', () => {
  const f = fixture(); f.data.set('dsh.conversation.draft-a', JSON.stringify({ draft: { text: '', references: [] } }))
  f.nav.startSession('a'); assert.equal(f.calls.pop()[0], 'new')
})
test('navigation callbacks are not bypassed and disposal restores native methods', async () => {
  const f = fixture(); const callback = () => {}
  await f.nav.openWorkspace('a', callback)
  assert.equal(f.calls.pop()[0], 'workspace')
  f.cleanup(); assert.equal(f.nav.startSession, f.original)
})
test('recent workspace resolves when no conversation is selected', () => {
  const f = fixture(); f.selection.sessionId = undefined
  f.nav.startSession(); assert.deepEqual(f.calls, [['restore', 'draft-a']])
})

test('Cordis service tracing preserves receiver and restores prototype methods on unload', async () => {
  const { Context, Service } = await import('@deepseek-ai/cordis')
  const ctx = new Context()
  const f = fixture(); f.cleanup()
  class WorkspaceService extends Service {
    selection = f.nav.selection
    constructor() { super(ctx, 'draftTestNavigation') }
    startSession(id) { assert.ok(this.ctx); f.calls.push(['native', id]) }
    openWorkspace(id) { this.startSession(id); return Promise.resolve() }
    openSession(id) { f.calls.push(['restore', id]) }
  }
  const service = new WorkspaceService()
  const nav = ctx.get('draftTestNavigation')
  const store = value => ({ getSnapshot: () => value, subscribe: () => () => {} })
  const stop = installDraftNavigation(nav, { list: store(f.catalog) }, { list: store(f.groups) }, { getItem: key => f.data.get(key) ?? null, setItem() {} })
  nav.startSession('a')
  nav.startSession('b')
  assert.deepEqual(f.calls, [['restore', 'draft-a'], ['native', 'b']])
  stop()
  assert.equal(Object.hasOwn(service, 'startSession'), false)
  nav.startSession('a')
  assert.deepEqual(f.calls.at(-1), ['native', 'a'])
})
