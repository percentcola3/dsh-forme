import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { bootScript } from '../src/boot-brand.ts'
import { apply } from '../src/index.ts'
import { windowDriver } from '../src/client/window-driver.ts'

test('window controls only delegate to a complete native carrier; Electron retains its native caption', async () => {
  assert.equal(windowDriver({}).kind, 'browser')
  assert.equal(windowDriver({ dshDesktop: { protocolVersion: 1 } }).kind, 'electron')
  assert.equal(windowDriver({ __TAURI__: { window: { getCurrentWindow() { throw new Error('bridge unavailable') } } } }).kind, 'browser')
  assert.equal(windowDriver({ __TAURI__: { window: { getCurrentWindow: () => ({ minimize() {} }) } } }).kind, 'browser')
  const calls = []
  const native = Object.fromEntries(['minimize', 'toggleMaximize', 'isMaximized', 'startDragging'].map(name => [name, async () => { calls.push(name); return name === 'isMaximized' }]))
  const driver = windowDriver({ __TAURI__: { window: { getCurrentWindow: () => native } } })
  assert.equal(driver.kind, 'tauri')
  await driver.window.minimize()
  await driver.window.toggleMaximize()
  assert.equal(await driver.window.isMaximized(), true)
  await driver.window.startDragging()
  assert.deepEqual(calls, ['minimize', 'toggleMaximize', 'isMaximized', 'startDragging'])
})

function bootFixture(preference) {
  const attrs = new Map()
  const markAttrs = new Map()
  const mark = { textContent: 'HARNESS', hasAttribute: key => markAttrs.has(key), setAttribute: (key, value) => markAttrs.set(key, value) }
  const failure = { textContent: 'real plugin failure' }
  let boot = { firstElementChild: { firstElementChild: mark }, failure }
  const listeners = new Map()
  const observers = []
  const globals = {
    localStorage: { getItem: () => preference },
    document: {
      documentElement: { setAttribute: (key, value) => attrs.set(key, value) },
      querySelector: () => boot,
      getElementById: () => ({}),
    },
    window: { addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this) }
      observe() {}
      disconnect() { this.disconnected = true }
    },
  }
  vm.runInNewContext(bootScript, globals)
  return { attrs, mark, markAttrs, failure, listeners, observers, removeBoot() { boot = undefined } }
}

test('serialized startup script brands the host loader before React without hiding failures and releases its observer', () => {
  const f = bootFixture('{"motion":false}')
  assert.equal(f.mark.textContent, '550W')
  assert.equal(f.markAttrs.get('aria-label'), '550W 智能量子计算机')
  assert.equal(f.failure.textContent, 'real plugin failure')
  assert.equal(f.attrs.get('data-550w-boot-motion'), 'off')
  f.removeBoot(); f.observers[0].callback()
  assert.equal(f.observers[0].disconnected, true)
  assert.equal(f.listeners.size, 0)
})

test('startup preference and host index injection preserve a disabled theme and the official boot rows', () => {
  const f = bootFixture('{"enabled":false}')
  assert.equal(f.mark.textContent, 'HARNESS')
  assert.equal(f.observers.length, 0)
  assert.equal(f.attrs.size, 0)
  let handler
  apply({ on(event, listener) { assert.equal(event, 'webserver/index-inject'); handler = listener } })
  const rows = [{ kind: 'global', name: '__DSH_BOOT__', value: { entries: [] } }]
  handler(rows)
  assert.equal(rows[0].name, '__DSH_BOOT__')
  assert.deepEqual(rows.slice(1).map(row => row.kind), ['style', 'script'])
  assert.equal(rows[2].placement, 'body')
})
