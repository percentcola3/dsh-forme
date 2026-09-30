import { test } from 'node:test'
import assert from 'node:assert/strict'
import { splitUnifiedDiff } from './diff-rows.ts'

test('pairs replacements and keeps context on both sides', () => {
  const rows = splitUnifiedDiff(`diff --git a/a.ts b/a.ts
--- a/a.ts
+++ b/a.ts
@@ -1,3 +1,3 @@
 keep
-old
+new
 keep
`)
  assert.equal(rows[0]?.kind, 'ctx')
  assert.equal(rows[1]?.kind, 'replace')
  assert.equal(rows[1]?.left, 'old')
  assert.equal(rows[1]?.right, 'new')
  assert.equal(rows[2]?.kind, 'ctx')
})

test('keeps deletions on the left and additions on the right', () => {
  const rows = splitUnifiedDiff(`@@ -1,2 +1,2 @@
-removed
 unchanged
+added
`)
  assert.equal(rows[0]?.kind, 'del')
  assert.equal(rows[0]?.left, 'removed')
  assert.equal(rows[0]?.right, '')
  assert.equal(rows[1]?.kind, 'ctx')
  assert.equal(rows[2]?.kind, 'add')
  assert.equal(rows[2]?.left, '')
  assert.equal(rows[2]?.right, 'added')
})
