import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'

const code = ts.transpileModule(readFileSync(new URL('../src/client/window-chrome.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2024, esModuleInterop: true },
}).outputText

function setup() {
  let cleanup
  let toggles = 0
  let maximized = false
  const listeners = new Map()
  const element = () => ({
    dataset: {}, style: {}, handlers: new Map(),
    cloneNode: () => element(),
    replaceWith(node) { top = node },
    addEventListener(type, handler) { this.handlers.set(type, handler) },
  })
  let top = element()
  const context = {
    exports: {},
    require: () => ({ useEffect: effect => { cleanup = effect() }, createElement: () => null }),
    window: { __TAURI__: { window: { getCurrentWindow: () => ({
      toggleMaximize: async () => { toggles++; maximized = !maximized },
    }) } } },
    document: {
      body: {}, getElementById: () => top,
      addEventListener: (type, handler) => listeners.set(type, handler),
      removeEventListener: type => listeners.delete(type),
    },
    MutationObserver: class { observe() {} disconnect() {} },
  }
  vm.runInNewContext(code, context)
  context.exports.WindowChrome()
  return {
    doubleClick({ x = 200, y = 20, interactive = false } = {}) {
      let stopped = false
      const event = { clientX: x, clientY: y, target: { closest: () => interactive },
        preventDefault() {}, stopPropagation() { stopped = true } }
      // DOM capture runs before the target's listener.
      listeners.get('dblclick')?.(event)
      if (!stopped) top.handlers.get('dblclick')?.(event)
    },
    addLegacyHandler() { top.handlers.set('dblclick', () => { toggles++; maximized = !maximized }) },
    dispose: () => cleanup(),
    get toggles() { return toggles },
    get maximized() { return maximized },
  }
}

test('each double click toggles once in both directions', () => {
  const view = setup()
  view.doubleClick()
  assert.equal(view.maximized, true)
  assert.equal(view.toggles, 1)
  view.doubleClick()
  assert.equal(view.maximized, false)
  assert.equal(view.toggles, 2)
})

test('capture prevents a legacy titlebar handler from toggling again', () => {
  const view = setup()
  view.addLegacyHandler()
  view.doubleClick()
  assert.equal(view.toggles, 1)
})

test('controls, traffic lights, content and disposed plugin do not toggle', () => {
  const view = setup()
  view.doubleClick({ interactive: true })
  view.doubleClick({ x: 30 })
  view.doubleClick({ y: 120 })
  assert.equal(view.toggles, 0)
  view.dispose()
  view.doubleClick()
  assert.equal(view.toggles, 0)
})
