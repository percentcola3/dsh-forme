import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'

const root = new URL('../', import.meta.url)
const metadata = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
const bundle = readFileSync(new URL(metadata.exports['./client'], root), 'utf8')

function loadClient(document) {
  const registrations = []
  const externalRequests = []
  const sandbox = {
    document,
    window: {
      __ModuleLoader__: {
        load(registration) { registrations.push(registration) },
      },
    },
  }
  vm.runInNewContext(bundle, sandbox, { filename: 'lib/client.js', timeout: 1000 })
  assert.equal(registrations.length, 1)
  assert.equal(registrations[0].id, metadata.name)
  const client = registrations[0].factory(id => {
    externalRequests.push(id)
    throw new Error(`Unexpected runtime dependency: ${id}`)
  })
  assert.deepEqual(externalRequests, [])
  return client
}

function documentFixture() {
  const existingStyle = { textContent: '/* unrelated host stylesheet */' }
  const nodes = [existingStyle]
  const document = new Proxy({
    head: {
      appendChild(node) {
        assert.ok(!nodes.includes(node))
        nodes.push(node)
        return node
      },
    },
    createElement(tag) {
      assert.equal(tag, 'style', 'the plugin must create only its stylesheet')
      return {
        dataset: {},
        textContent: '',
        remove() {
          const index = nodes.indexOf(this)
          if (index !== -1) nodes.splice(index, 1)
        },
      }
    },
  }, {
    get(target, key) {
      assert.ok(Object.hasOwn(target, key), `Unexpected document access: ${String(key)}`)
      return target[key]
    },
    set() { assert.fail('The plugin must not replace document properties') },
  })
  return { document, nodes, existingStyle }
}

function effectContext() {
  const cleanups = []
  return {
    effect(effect) {
      const cleanup = effect()
      assert.equal(typeof cleanup, 'function')
      cleanups.push(cleanup)
      return cleanup
    },
    dispose() {
      for (const cleanup of cleanups.splice(0).reverse()) cleanup()
    },
  }
}

test('compiled browser entry registers without runtime imports or document access', () => {
  const inaccessibleDocument = new Proxy({}, {
    get() { assert.fail('Module registration must not access the document') },
  })
  const client = loadClient(inaccessibleDocument)
  assert.equal(client.name, metadata.name)
  assert.equal(typeof client.apply, 'function')
})

test('enable, unload, and reenable manage only the owned stylesheet', () => {
  const { document, nodes, existingStyle } = documentFixture()
  const client = loadClient(document)
  const firstContext = effectContext()
  client.apply(firstContext)
  assert.equal(nodes.length, 2)
  const firstStyle = nodes[1]
  assert.equal(firstStyle.dataset.plugin, metadata.name)
  assert.ok(firstStyle.textContent.includes('[data-document-markdown]'))
  assert.ok(firstStyle.textContent.length > 0)

  firstContext.dispose()
  assert.deepEqual(nodes, [existingStyle])
  firstContext.dispose()
  assert.deepEqual(nodes, [existingStyle])

  const secondContext = effectContext()
  client.apply(secondContext)
  assert.equal(nodes.length, 2)
  assert.notEqual(nodes[1], firstStyle)
  assert.equal(nodes[1].textContent, firstStyle.textContent)
  secondContext.dispose()
  assert.deepEqual(nodes, [existingStyle])
})

test('published entry points and bundle patch include the pinned community plugin', () => {
  assert.equal(metadata.main, metadata.exports['.'])
  for (const entry of ['.', './client', './cordis.patch.yml']) {
    assert.ok(existsSync(new URL(metadata.exports[entry], root)), `Missing published entry: ${entry}`)
  }
  assert.ok(metadata.files.includes('lib'))
  assert.ok(metadata.files.includes(metadata.dsh.bundle.patch.replace(/^\.\//, '')))
  assert.equal(metadata.dsh.client.platform, 'web')
  assert.ok(metadata.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-sidebar-documentpreview'))
  assert.match(metadata.dependencies['dsh-mermaid-preview'], /^git\+https:\/\/github\.com\/realguan\/dsh-mermaid-preview\.git#[a-f0-9]{40}$/)

  const patch = readFileSync(new URL(metadata.dsh.bundle.patch, root), 'utf8')
  const rows = [...patch.matchAll(/^\s*- id:\s*(\S+)\s*\n\s*name:\s*(\S+)\s*$/gm)]
    .map(([, id, name]) => ({ id, name }))
  assert.deepEqual(rows, [
    { id: metadata.name, name: metadata.name },
    { id: 'dsh-markdown-mermaid', name: 'dsh-mermaid-preview' },
  ])
})
