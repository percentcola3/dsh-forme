import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openOfficialTerminal, createOfficialTerminalCard } from '../src/client/official-terminal.ts'

function fixture(initiallyExpanded = false) {
  let expanded = initiallyExpanded
  let active
  let tabs = [{ sessionId: 's', tabId: 'existing' }]
  const calls = []
  const sidebar = {
    commandTarget: () => ({ paneId: 'guide' }),
    openTabFromTarget(kind, target) { calls.push(['target', kind, target]); this.openTab(kind) },
    openTab(kind) { active = { id: 'card', kind, contentId: 'content:card' }; expanded = true; tabs.push({ sessionId: 's', tabId: active.id }); calls.push(['open', kind]) },
    active: () => active,
    float(id) { calls.push(['float', id]) },
    dock(id) { calls.push(['dock', id]) },
    focus(id) { calls.push(['focus', id]) },
    isExpanded: () => expanded,
    toggleExpanded() { expanded = !expanded },
    closeIn(session, id) { calls.push(['close', session, id]); tabs = tabs.filter(tab => tab.tabId !== id) },
    openTabs: { getSnapshot: () => tabs },
    tabDomain: { occurrence: (session, tab) => { assert.equal(session, 's'); assert.equal(tab.id, 'card'); return { navigation: { getSnapshot: () => ({ address: 'content:card', params: { shellPath: '/bin/zsh' } }) } } } },
  }
  const terminals = { view(...args) { calls.push(['view', ...args]); return { state: { getSnapshot: () => ({ writable: true }) }, write(data) { calls.push(['write', data]) } } } }
  return { sidebar, terminals, calls }
}

test('tab entry follows the official terminal command target and reveals sidebar', () => {
  const f = fixture()
  assert.equal(openOfficialTerminal(f.sidebar).kind, 'terminal')
  assert.equal(f.sidebar.isExpanded(), true)
  assert.deepEqual(f.calls[0], ['target', 'terminal', { paneId: 'guide' }])
  assert.equal(f.calls.some(call => call[0] === 'float'), false)
})
test('card floats only its new official tab without reserving a sidebar column', () => {
  const f = fixture()
  const card = createOfficialTerminalCard(f.sidebar, f.terminals, 's')
  assert.equal(f.sidebar.isExpanded(), false)
  assert.deepEqual(f.calls, [['open', 'terminal'], ['float', 'card']])
  assert.equal(card.exists(), true)
  card.interrupt()
  assert.deepEqual(f.calls.at(-2), ['view', 's', 'card', 'content:card', undefined, '/bin/zsh'])
  assert.deepEqual(f.calls.at(-1), ['write', '\x03'])
  card.close(); card.close()
  assert.equal(f.calls.filter(call => call[0] === 'close').length, 1)
  assert.deepEqual(f.sidebar.openTabs.getSnapshot(), [{ sessionId: 's', tabId: 'existing' }])
})
test('card preserves an already open sidebar', () => {
  const f = fixture(true)
  createOfficialTerminalCard(f.sidebar, f.terminals, 's').close()
  assert.equal(f.sidebar.isExpanded(), true)
})
test('native dock transfer releases card ownership without closing the official terminal', () => {
  const f = fixture()
  const card = createOfficialTerminalCard(f.sidebar, f.terminals, 's')
  card.release(); card.close(); card.interrupt()
  assert.equal(card.exists(), true)
  assert.equal(f.calls.some(call => call[0] === 'close' || call[0] === 'view'), false)
})
test('failed float closes only the terminal created for the card', () => {
  const f = fixture()
  f.sidebar.float = () => { throw new Error('float unavailable') }
  assert.throws(() => createOfficialTerminalCard(f.sidebar, f.terminals, 's'), /float unavailable/)
  assert.deepEqual(f.calls.at(-1), ['close', 's', 'card'])
})

test('card expand docks the same pane, reveals sidebar and survives card cleanup', () => {
  const f = fixture()
  const card = createOfficialTerminalCard(f.sidebar, f.terminals, 's')
  card.expand('floating-pane')
  card.close()
  assert.equal(f.sidebar.isExpanded(), true)
  assert.deepEqual(f.calls.slice(-2), [['dock', 'floating-pane'], ['focus', 'card']])
  assert.equal(f.calls.filter(call => call[0] === 'open').length, 1)
  assert.equal(f.calls.some(call => call[0] === 'close'), false)
  assert.equal(card.exists(), true)
})
test('failed expansion leaves the card owned and closable', () => {
  const f = fixture()
  const card = createOfficialTerminalCard(f.sidebar, f.terminals, 's')
  f.sidebar.dock = () => { throw new Error('dock failed') }
  assert.throws(() => card.expand('floating-pane'), /dock failed/)
  card.close()
  assert.deepEqual(f.calls.at(-1), ['close', 's', 'card'])
})
