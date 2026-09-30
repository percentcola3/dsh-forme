import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../src/client/files-workspace.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2024 } }).outputText
function element(dataset = {}) {
  const attrs = new Map(), styles = new Map()
  return { dataset, getAttribute: k => attrs.get(k) ?? null, setAttribute: (k,v) => attrs.set(k,v), removeAttribute: k => attrs.delete(k),
    style: { getPropertyValue: k => styles.get(k) ?? '', setProperty: (k,v) => styles.set(k,v), removeProperty: k => styles.delete(k) },
    querySelector: () => null, querySelectorAll: () => [] }
}
function fixture({ twoPanes = true, blockedSplits = 0, initiallyExpanded = false, composerTop } = {}) {
  let current = 'a', expanded = initiallyExpanded, splits = 0, measurements = 0
  const observed = []
  const calls = [], timers = new Set(), observers = []
  const tree = element({ dockkitPane: 'tree' }), preview = element({ dockkitPane: 'preview' })
  const button = element(), row = element({ filesPath: '/work/a b.md' })
  row.querySelector = () => button
  tree.querySelectorAll = () => [row]
  preview.querySelector = selector => selector.includes('aria-selected') ? element({ dockkitTab: 'seed-files' }) : element()
  let panes = twoPanes ? [tree, preview] : [tree]
  const panel = element()
  panel.querySelectorAll = () => panes
  panel.querySelector = selector => selector === '[data-files-root]' ? element({ filesRoot: '/work' }) : tree
  const card = { getBoundingClientRect: () => ({ top: composerTop, height: 120 }) }
  const composer = { querySelector: () => card }
  const host = { closest: () => composerTop === undefined ? null : { querySelector: () => composer }, getBoundingClientRect: () => { measurements++; return { left: 240, top: 96, width: 900, height: 500 } } }
  const sandbox = {
    exports: {}, URL,
    requestAnimationFrame(fn) { timers.add(fn); return fn }, cancelAnimationFrame(fn) { timers.delete(fn) },
    document: { body: {}, querySelector: () => panel },
    window: { addEventListener() {}, removeEventListener() {} },
    MutationObserver: class { constructor(fn) { observers.push(fn) } observe(target) { observed.push(target) } disconnect() {} },
    ResizeObserver: class { observe() {} disconnect() {} },
    setTimeout(fn) { timers.add(fn); return fn }, clearTimeout(fn) { timers.delete(fn) },
  }
  vm.runInNewContext(compiled, sandbox)
  const layoutCalls = []
  const layout = { openRightbar(...args) { layoutCalls.push(args) }, closeRightbar() { layoutCalls.push('close') } }
  const originalPresentation = layout.openRightbar
  const sidebar = {
    openResource(address, options) { calls.push({ address, options }) },
    openResourceIn(session, address, options) { calls.push({ session, address, options }) },
    openTabIn() { expanded = true; layout.openRightbar(true, false) },
    isExpanded: () => expanded, toggleExpanded() { expanded = !expanded },
    active: () => ({ id: 'old-tab' }), focus(id) { calls.push({ focus: id }) },
    split(id) { assert.equal(id, 'tree'); splits++; if (splits <= blockedSplits) return; sandbox.setTimeout(() => { panes = [tree, preview] }); return 'preview' },
  }
  const original = sidebar.openResource, originalIn = sidebar.openResourceIn
  const workspace = sandbox.exports.installFilesWorkspace(sidebar, layout, () => current)
  return { sidebar, layout, layoutCalls, workspace, calls, panel, preview, button, original, originalIn, originalPresentation,
    mount: () => workspace.mount(host, 'a'),
    switchSession() { current = 'b' },
    get measurements() { return measurements }, observed,
    get splits() { return splits }, get expanded() { return expanded },
    sync() { observers.forEach(fn => fn()) },
    flush() { for (let i = 0; timers.size && i < 50; i++) { const batch = [...timers]; timers.clear(); batch.forEach(fn => fn()) } assert.equal(timers.size, 0) },
  }
}
const file = 'dsh-resource://file/session/a/a%20b.md'
test('viewport is bounded to the conversation and does not reserve a right column', () => {
  const f = fixture(); const leave = f.mount()
  assert.equal(f.panel.style.getPropertyValue('--dfp-top'), '96px')
  assert.equal(f.panel.style.getPropertyValue('--dfp-height'), '500px')
  assert.ok(f.layoutCalls.every(call => call === 'close'))
  assert.equal(f.preview.getAttribute('data-dfp-empty'), 'true')
  leave()
  assert.equal(f.panel.getAttribute('data-dfp-embedded'), null)
  assert.equal(f.panel.style.getPropertyValue('--dfp-top'), '')
  assert.equal(f.expanded, false)
  assert.equal(f.layout.openRightbar, f.originalPresentation)
})
test('both entry points replace right-side Files seed without replacing the tree', () => {
  const f = fixture(); f.mount()
  f.sidebar.openResource(file, { paneId: 'tree', params: { line: 8 } })
  f.sidebar.openResourceIn('a', file, { paneId: 'tree', replaceTab: 'tree-files' })
  assert.equal(f.calls.length, 2)
  for (const call of f.calls) { assert.equal(call.options.paneId, 'preview'); assert.equal(call.options.replaceTab, 'seed-files'); assert.equal(call.options.revealIfOpened, false) }
  assert.equal(f.calls[0].options.params.line, 8)
  assert.equal(f.button.getAttribute('aria-current'), 'true')
})
test('waits for room measurement and opens only the latest clicked file after splitting', () => {
  const f = fixture({ twoPanes: false, blockedSplits: 2 }); f.mount()
  f.sidebar.openResource(file); f.sidebar.openResource(file + '?line=2'); f.flush()
  assert.equal(f.splits, 3)
  assert.equal(f.calls.length, 1)
  assert.equal(f.calls[0].address, file + '?line=2')
})
test('does not misroute other sessions/resources, or opens outside Files Tab', () => {
  const f = fixture(); f.sidebar.openResource(file, { paneId: 'normal' }); f.mount()
  f.sidebar.openResourceIn('b', file, { paneId: 'normal' })
  f.sidebar.openResource('dsh-resource://other/resource', { paneId: 'normal' })
  assert.ok(f.calls.every(call => call.options.paneId === 'normal'))
})
test('leaving or switching sessions cancels deferred previews', () => {
  for (const switchSession of [false, true]) {
    const f = fixture({ twoPanes: false, blockedSplits: 100 }); const leave = f.mount()
    f.sidebar.openResource(file)
    if (switchSession) f.switchSession()
    leave(); f.flush()
    assert.equal(f.calls.filter(call => call.address).length, 0)
  }
})
test('disposal restores previous sidebar expansion and service methods', () => {
  const f = fixture({ initiallyExpanded: true }); f.mount(); f.workspace.dispose()
  assert.equal(f.expanded, true)
  assert.equal(f.calls.at(-1).focus, 'old-tab')
  assert.equal(f.sidebar.openResource, f.original)
  assert.equal(f.sidebar.openResourceIn, f.originalIn)
  assert.equal(f.layout.openRightbar, f.originalPresentation)
})

test('ready panes stop retries and mutation bursts share one layout measurement', () => {
  const f = fixture(); f.mount()
  const initial = f.measurements
  f.flush()
  assert.equal(f.measurements, initial)
  assert.deepEqual(f.observed, [f.panel])
  for (let i = 0; i < 20; i++) f.sync()
  assert.equal(f.measurements, initial)
  f.flush()
  assert.equal(f.measurements, initial + 1)
})

test('leaving cancels a queued animation-frame layout update', () => {
  const f = fixture(); const leave = f.mount()
  f.sync(); const count = f.measurements
  leave(); f.flush()
  assert.equal(f.measurements, count)
})

test('preview stops 8px above the live composer card without a second height deduction', () => {
  const f = fixture({ composerTop: 550 }); f.mount()
  assert.equal(f.panel.style.getPropertyValue('--dfp-height'), '446px')
})
