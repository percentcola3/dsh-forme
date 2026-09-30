import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { realpathSync } from 'node:fs'
import { projectCwd } from '../src/index.ts'
const context = (live = [], persistence) => ({ get: name => name === 'sessions' ? { list: () => live } : persistence })
test('execution directory comes only from the exact live session header', async () => {
  const ctx = context([{ header: { id: 'a', cwd: tmpdir() } }])
  assert.equal(await projectCwd(ctx, 'a'), realpathSync(tmpdir()))
  await assert.rejects(projectCwd(ctx, 'b'), /有效的工作目录/)
  await assert.rejects(projectCwd(ctx, ''), /打开项目会话/)
})
test('cold history session resolves its stored workspace without loading an agent', async () => {
  let requested
  const ctx = context([], { stat: async id => { requested = id; return { header: { id, cwd: tmpdir() } } } })
  assert.equal(await projectCwd(ctx, 'history'), realpathSync(tmpdir()))
  assert.equal(requested, 'history')
})
test('live metadata wins without querying persistent storage', async () => {
  const ctx = context([{ header: { id: 'a', cwd: tmpdir() } }], { stat: () => { throw new Error('must not read') } })
  assert.equal(await projectCwd(ctx, 'a'), realpathSync(tmpdir()))
})
test('unknown sessions, missing cwd and mismatched metadata remain rejected', async () => {
  await assert.rejects(projectCwd(context([], { stat: async () => undefined }), 'a'))
  await assert.rejects(projectCwd(context([{ header: { id: 'a' } }]), 'a'))
  await assert.rejects(projectCwd(context([], { stat: async () => ({ header: { id: 'wrong', cwd: tmpdir() } }) }), 'a'), /不匹配/)
})
