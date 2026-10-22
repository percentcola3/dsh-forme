import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createGitRunner } from './git.ts'
import { listBranches, switchBranch } from './branches.ts'
import { post } from './client/requests.ts'

const git = createGitRunner()
test('switch exact Unicode local branches; preserve dirty changes and report failures', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'dgp-branches-'))
  t.after(() => rm(cwd, { recursive: true, force: true }))
  const run = async (...args: string[]) => {
    const result = await git(cwd, args)
    assert.equal(result.code, 0, result.stderr)
    return result.stdout.trim()
  }
  await run('init', '-b', 'main')
  await run('config', 'user.name', 'Test')
  await run('config', 'user.email', 'test@example.invalid')
  await writeFile(join(cwd, 'file'), 'main\n')
  await run('add', '.')
  await run('commit', '-m', 'fixture')
  await run('branch', '功能/测试')
  assert.deepEqual((await listBranches(git, cwd)).branches?.map(b => b.name).sort(), ['main', '功能/测试'])
  assert.equal((await switchBranch(git, cwd, '功能/测试')).ok, true)
  assert.equal(await run('branch', '--show-current'), '功能/测试')
  await writeFile(join(cwd, 'file'), 'feature\n')
  await run('commit', '-am', 'feature fixture')
  assert.equal((await switchBranch(git, cwd, 'main')).ok, true)
  await writeFile(join(cwd, 'file'), 'dirty\n')
  const blocked = await switchBranch(git, cwd, '功能/测试')
  assert.equal(blocked.ok, false)
  assert.match(blocked.error!, /overwritten|local changes/i)
  assert.equal(await run('branch', '--show-current'), 'main')
  for (const branch of ['missing', '--detach', '@{-1}', '../main', 'main\u0000']) {
    assert.equal((await switchBranch(git, cwd, branch)).ok, false, branch)
  }
  assert.equal(await run('branch', '--show-current'), 'main')
})

test('remote catalog and explicit tracking switches preserve exact refs and dirty state', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'dgp-remote-branches-'))
  t.after(() => rm(cwd, { recursive: true, force: true }))
  const run = async (...args: string[]) => {
    const result = await git(cwd, args)
    assert.equal(result.code, 0, result.stderr)
    return result.stdout.trim()
  }
  await run('init', '-b', 'main')
  await run('config', 'user.name', 'Test')
  await run('config', 'user.email', 'test@example.invalid')
  await writeFile(join(cwd, 'file'), 'base\n')
  await run('add', '.')
  await run('commit', '-m', 'base')
  const base = await run('rev-parse', 'HEAD')
  await writeFile(join(cwd, 'file'), 'remote\n')
  await run('commit', '-am', 'remote')
  const target = await run('rev-parse', 'HEAD')
  await run('switch', '-c', 'start', base)
  await run('remote', 'add', 'origin', 'https://example.invalid/repository')
  await run('remote', 'add', 'origin/team', 'https://example.invalid/team')
  for (const name of ['origin/功能/测试', 'origin/main', 'origin/blocked', 'origin/team/nested', 'orphan/no-remote']) {
    await run('update-ref', `refs/remotes/${name}`, target)
  }
  await run('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main')
  const catalog = await listBranches(git, cwd)
  assert.equal(catalog.ok, true)
  assert.ok(catalog.branches?.some(b => b.name === 'origin/功能/测试' && b.kind === 'remote' && !b.current))
  assert.ok(catalog.branches?.some(b => b.name === 'start' && b.kind === 'local' && b.current))
  assert.ok(!catalog.branches?.some(b => b.name === 'origin/HEAD'))
  for (const name of ['origin/HEAD', 'origin/missing', 'orphan/no-remote', '../main', '--detach', '@{-1}', 'origin/main\u0000']) {
    assert.equal((await switchBranch(git, cwd, name, 'remote')).ok, false, name)
  }
  assert.equal((await switchBranch(git, cwd, 'origin/功能/测试')).ok, false, 'remote requires explicit kind')
  const collision = await switchBranch(git, cwd, 'origin/main', 'remote')
  assert.equal(collision.ok, false)
  assert.match(collision.error!, /本地分支已存在/)
  assert.equal(await run('branch', '--show-current'), 'start')
  await writeFile(join(cwd, 'file'), 'dirty\n')
  const before = await run('status', '--porcelain=v1')
  const blocked = await switchBranch(git, cwd, 'origin/blocked', 'remote')
  assert.equal(blocked.ok, false)
  assert.match(blocked.error!, /overwritten|local changes/i)
  assert.equal(await run('branch', '--show-current'), 'start')
  assert.equal(await run('rev-parse', 'HEAD'), base)
  assert.equal(await run('status', '--porcelain=v1'), before)
  assert.equal(await readFile(join(cwd, 'file'), 'utf8'), 'dirty\n')
  assert.notEqual((await git(cwd, ['show-ref', '--verify', '--quiet', 'refs/heads/blocked'])).code, 0)
  await writeFile(join(cwd, 'file'), 'base\n')
  assert.equal((await switchBranch(git, cwd, 'origin/功能/测试', 'remote')).ok, true)
  assert.equal(await run('branch', '--show-current'), '功能/测试')
  assert.equal(await run('rev-parse', 'HEAD'), target)
  assert.equal(await run('rev-parse', '--symbolic-full-name', '@{upstream}'), 'refs/remotes/origin/功能/测试')
  const nested = await switchBranch(git, cwd, 'origin/team/nested', 'remote')
  assert.equal(nested.ok, true, nested.error)
  assert.equal(await run('branch', '--show-current'), 'nested')
  assert.equal(await run('config', 'branch.nested.remote'), 'origin/team')
  assert.equal(await run('config', 'branch.nested.merge'), 'refs/heads/nested')
})

test('HTTP failures retain backend details and empty authentication errors stay readable', async t => {
  const original = globalThis.fetch
  t.after(() => { globalThis.fetch = original })
  globalThis.fetch = async () => new Response('', { status: 403, statusText: 'Forbidden' })
  await assert.rejects(post('/status', {}), /403 Forbidden/)
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'cwd is not owned by the live session' }), { status: 403 })
  await assert.rejects(post('/status', {}), /cwd is not owned/)
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, error: 'dirty files' }))
  assert.deepEqual(await post('/switch', {}), { ok: false, error: 'dirty files' })
})
