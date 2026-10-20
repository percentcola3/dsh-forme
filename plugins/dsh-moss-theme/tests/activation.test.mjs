import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import * as theme from '../src/client/index.ts'

test('activates passive status, inline settings and branding without a remote preset service, then disposes cleanly', async () => {
  const originals = ['window', 'document'].map(key => Object.getOwnPropertyDescriptor(globalThis, key))
  const attributes = new Map()
  const styles = new Set()
  const events = new Map()
  const storage = new Map()
  const registrations = new Map()
  const errors = []
  const originalError = console.error
  const ctx = new Context()
  let fiber
  try {
    globalThis.document = {
      body: {
        getAttribute: key => attributes.get(key) ?? null,
        setAttribute: (key, value) => attributes.set(key, value),
        removeAttribute: key => attributes.delete(key),
      },
      head: { appendChild: style => styles.add(style) },
      createElement: () => ({ dataset: {}, remove() { styles.delete(this) } }),
    }
    globalThis.window = {
      localStorage: {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: key => storage.delete(key),
      },
      addEventListener: (name, listener) => events.set(name, listener),
      removeEventListener: name => events.delete(name),
    }
    console.error = (...args) => errors.push(args.map(String).join(' '))
    await ctx.plugin(provider => {
      provider.provide('slots', {
        inject: (_name, register) => register(),
        register(options, render) {
          registrations.set(options.name, render)
          return () => registrations.delete(options.name)
        },
      })
      provider.provide('sessions', {})
      provider.provide('uiWorkspace', {})
      provider.provide('uiSession', { sessionStatus: { getSnapshot: () => new Map(), subscribe: () => () => {} } })

    })

    fiber = ctx.plugin(theme)
    await fiber
    assert.deepEqual(errors, [], 'activation must succeed without falling back or swallowing an injection error')
    assert.equal(storage.has('dsh-moss-theme:boot-error'), false)
    assert.equal(registrations.size, 6, 'passive status, settings, window behavior, Earth hero and both brand slots must activate')
    const { services } = registrations.get('conversation.header.leading')().props
    assert.ok(registrations.has('settings.general.item'))
    assert.equal(services.selection.getSnapshot(), services.selection.getSnapshot(), 'idle snapshot must be stable for React')
    assert.equal(attributes.get('data-moss-theme'), 'on')
    assert.equal(styles.size, 1)
    await fiber.dispose()
    assert.equal(registrations.size, 0)
    assert.equal(styles.size, 0)
    assert.equal(events.size, 0)
    assert.equal(attributes.size, 0)
  } finally {
    await fiber?.dispose()
    await ctx.fiber.dispose()
    console.error = originalError
    ;['window', 'document'].forEach((key, i) => {
      if (originals[i]) Object.defineProperty(globalThis, key, originals[i])
      else delete globalThis[key]
    })
  }
})
