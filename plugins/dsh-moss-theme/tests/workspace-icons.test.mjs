import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createWorkspaceIcons, installWorkspaceIcons, WORKSPACE_ICONS, WORKSPACE_ICONS_KEY } from '../src/client/workspace-icons.ts'

test('projects receive different motifs and keep them across reordering, additions and reloads', () => {
  const saved = new Map()
  const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) }
  const keys = WORKSPACE_ICONS.map((_, index) => `workspace:project-${index}`)
  const assign = createWorkspaceIcons(storage)
  const initial = new Map(assign(keys))
  assert.equal(new Set(initial.values()).size, keys.length, 'use every available motif before repeating one')
  assert.deepEqual(new Map(assign([...keys].reverse())), initial, 'reordering the tree must not change project identities')
  assert.deepEqual(new Map(createWorkspaceIcons(storage)(keys)), initial, 'a restart restores the same mapping')
  const expanded = assign(['workspace:new-project', ...keys])
  for (const [key, icon] of initial) assert.equal(expanded.get(key), icon, 'adding a project must not reshuffle existing icons')
  assert.equal(expanded.size, keys.length + 1)
  assert.equal(saved.has(WORKSPACE_ICONS_KEY), true)
})

test('bad storage cannot break sidebar decoration or introduce unknown SVG names', () => {
  for (const raw of ['broken', 'null', '[]', '{"workspace:a":"invalid","session:b":"engine"}']) {
    const assign = createWorkspaceIcons({ getItem: () => raw, setItem() { throw Error('read-only') } })
    const result = assign(['workspace:a', 'workspace:', 'session:b'])
    assert.equal(result.size, 2)
    assert.ok([...result.values()].every(icon => WORKSPACE_ICONS.includes(icon)))
    assert.notEqual(result.get('workspace:a'), result.get('workspace:'))
  }
  const assign = createWorkspaceIcons({ getItem() { throw Error('denied') }, setItem() { throw Error('denied') } })
  const initial = assign(['workspace:a']).get('workspace:a')
  assert.equal(assign(['workspace:a']).get('workspace:a'), initial)
})

test('row reuse and project removal restore decorations, while ordinary chat output does not rescan the tree', () => {
  const attr = 'data-moss-workspace-icon'
  const row = key => {
    const attrs = new Map([['data-row-key', key]])
    return { nodeType: 1, getAttribute: name => attrs.get(name) ?? null, setAttribute: (name, value) => attrs.set(name, value), removeAttribute: name => attrs.delete(name), matches: () => attrs.get('data-row-key')?.startsWith('workspace:'), querySelector: () => null }
  }
  const first = row('workspace:first'), second = row('workspace:second')
  first.setAttribute(attr, 'host-value')
  let rows = [first, second], observed, callback, disconnected = false, scans = 0
  const doc = {
    body: {}, querySelectorAll() { scans++; return rows.filter(item => item.matches()) },
    defaultView: { MutationObserver: class {
      constructor(listener) { callback = listener }
      observe(_body, options) { observed = options }
      disconnect() { disconnected = true }
    } },
  }
  const stop = installWorkspaceIcons(undefined, doc)
  assert.notEqual(first.getAttribute(attr), second.getAttribute(attr))
  assert.deepEqual(observed.attributeFilter, ['data-row-key'], 'our own writes cannot trigger an observer loop')
  callback([{ type: 'childList', addedNodes: [{ nodeType: 3 }], removedNodes: [] }])
  assert.equal(scans, 1, 'streaming chat text is unrelated to workspace icons')
  const original = first.getAttribute(attr)
  first.setAttribute('data-row-key', 'workspace:reused')
  callback([{ type: 'attributes' }])
  assert.notEqual(first.getAttribute(attr), original, 'recycled rows receive the new project identity')
  first.setAttribute('data-row-key', 'session:reused')
  rows = [first]
  callback([{ type: 'attributes' }])
  assert.equal(first.getAttribute(attr), 'host-value')
  assert.equal(second.getAttribute(attr), null)
  stop()
  assert.equal(disconnected, true)
})
