import { test } from 'node:test'
import assert from 'node:assert/strict'
import { installDepartmentIcons } from '../src/client/departments.ts'
import { createPreferences } from '../src/client/state.ts'

function fixture() {
  const entries = []; const listeners = new Set()
  const notify = () => { for (const listener of [...listeners]) listener() }
  const slots = {
    inject: (_name, register) => register(),
    entries: () => [...entries].sort((a, b) => (a.options.priority ?? 0) - (b.options.priority ?? 0)),
    subscribe: (_name, listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    register(options, render) {
      const { locale, registrant, ...cell } = options
      const entry = { options: cell, locale, registrant, render }; entries.push(entry); notify()
      return () => { entries.splice(entries.indexOf(entry), 1); notify() }
    },
  }
  const native = (id, order) => slots.register({ name: 'sidebar.panellist', id, order, label: () => `native ${id}`, locale: 'host', registrant: 'host' }, () => id)
  const winner = id => entries.filter(entry => entry.options.id === id).sort((a, b) => (a.options.priority ?? 0) - (b.options.priority ?? 0))[0]
  return { slots, native, winner, entries, listeners, notify }
}

test('department glyphs preserve native labels and restore original panels when disabled or unloaded', () => {
  const f = fixture(); f.native('plugins', 0); f.native('schedules', 10)
  const originals = [...f.entries]
  const preferences = createPreferences()
  const stop = installDepartmentIcons(f.slots, preferences)
  for (const [id, name] of [['plugins', 'gabon'], ['schedules', 'flight']]) {
    const native = originals.find(entry => entry.options.id === id)
    const themed = f.winner(id)
    assert.equal(themed.options.label, native.options.label)
    assert.equal(themed.options.order, native.options.order)
    assert.equal(themed.locale, native.locale)
    assert.deepEqual(themed.render({ size: 16 }).props, { name, size: 18 })
  }
  const themed = f.winner('plugins')
  f.notify(); f.notify()
  assert.equal(f.winner('plugins'), themed, 'our own deferred slot updates must reach a fixed point, never register again')
  preferences.update({ enabled: false })
  assert.deepEqual(f.entries, originals)
  preferences.update({ enabled: true })
  assert.equal(f.entries.length, 4)
  stop()
  assert.deepEqual(f.entries, originals)
  assert.equal(f.listeners.size, 0)
})

test('late or removed host panels never leave a phantom navigation entry', () => {
  const f = fixture()
  const stop = installDepartmentIcons(f.slots, createPreferences())
  assert.equal(f.entries.length, 0)
  const remove = f.native('plugins', 0)
  assert.equal(f.entries.length, 2)
  remove()
  assert.equal(f.entries.length, 0)
  const removeOther = f.native('some-other-plugin', 30)
  assert.equal(f.entries.length, 1)
  stop(); removeOther()
  assert.equal(f.entries.length, 0)
})
