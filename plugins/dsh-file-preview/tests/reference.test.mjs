import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileReference } from '../src/client/selection-menu.ts'

test('code selection keeps the native file reference resolvable', () => {
  const ref = fileReference('/work/交互 示例.ts', { start: 2, end: 4 })
  assert.equal(ref.ref, '@"/work/交互 示例.ts"')
  assert.equal(ref.clipboardText, ref.ref)
  assert.match(ref.label, /:2-4/)
  // This is how the official reference opener recovers the file path.
  assert.equal(ref.ref.slice(2, -1), '/work/交互 示例.ts')
})

test('paths that the native reference grammar cannot represent are rejected', () => {
  for (const path of ['/work/a"b.ts', '/work/a\nb.ts', '/work/a\0b.ts']) {
    assert.throws(() => fileReference(path), /不支持/)
  }
})
