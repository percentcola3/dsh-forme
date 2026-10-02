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
  assert.equal(rows.length, 3)
})

test('new-file metadata and trailing newline are not source lines', () => {
  const rows = splitUnifiedDiff('diff --git a/a b/a\nnew file mode 100644\nindex 000..111\n--- /dev/null\n+++ b/a\n@@ -0,0 +1,1 @@\n+hello\n')
  assert.deepEqual(rows, [{ leftNo: null, rightNo: 1, left: '', right: 'hello', kind: 'add' }])
})

test('source lines beginning with diff header characters are preserved', () => {
  const rows = splitUnifiedDiff('@@ -1 +1 @@\n---old\n+++new\n')
  assert.deepEqual(rows, [{ leftNo: 1, rightNo: 1, left: '--old', right: '++new', kind: 'replace' }])
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
