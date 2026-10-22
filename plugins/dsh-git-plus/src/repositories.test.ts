import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, realpath, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createGitRunner } from './git.ts'
import { createRepositoryDiscovery, resolveRepository, scanRepositories } from './repositories.ts'
import { listBranches, switchBranch } from './branches.ts'
import { apply } from './index.ts'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'

const git = createGitRunner()
async function run(cwd: string, ...args: string[]) {
  const result = await git(cwd, args)
  assert.equal(result.code, 0, result.stderr)
  return result.stdout.trim()
}
async function init(cwd: string, commit = true) {
  await mkdir(cwd, { recursive: true })
  await run(cwd, 'init', '-b', 'main')
  await run(cwd, 'config', 'user.name', 'Test')
  await run(cwd, 'config', 'user.email', 'test@example.invalid')
  if (commit) await run(cwd, 'commit', '--allow-empty', '-m', 'fixture')
}
async function fixture(t: { after(fn: () => Promise<void>): void }) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'dgp-repositories-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

test('discover nested independent repositories, initialized submodules and linked Git-file worktrees', async t => {
  const base = await fixture(t), root = join(base, 'root'), source = join(base, 'source')
  await init(root); await init(source)
  await init(join(root, 'packages', 'child'), false)
  await run(root, '-c', 'protocol.file.allow=always', 'submodule', 'add', source, 'modules/sub')
  await run(source, 'worktree', 'add', '-b', 'linked', join(root, 'linked'))
  await init(join(root, 'detached'))
  await run(join(root, 'detached'), 'checkout', '--detach')
  await mkdir(join(root, 'node_modules'), { recursive: true })
  await init(join(root, 'node_modules', 'ignored'))
  await symlink(source, join(root, 'escape'))
  const result = await scanRepositories(git, root)
  assert.equal(result.truncated, false)
  assert.deepEqual(result.repositories.map(r => [r.path, r.kind, r.branch]), [
    ['.', 'repository', 'main'], ['detached', 'repository', 'HEAD (detached)'],
    ['linked', 'worktree', 'linked'], ['modules/sub', 'submodule', 'main'], ['packages/child', 'repository', 'main'],
  ])
  assert.equal(await resolveRepository(git, root, 'linked'), join(root, 'linked'))
  assert.equal(await resolveRepository(git, root, 'modules/sub'), join(root, 'modules/sub'))
})

test('registered submodules remain visible under vendor and skipped dependency directories', async t => {
  const base = await fixture(t), root = join(base, 'root'), source = join(base, 'source')
  await init(root); await init(source)
  for (const path of ['vendor/library', 'node_modules/registered library']) {
    await run(root, '-c', 'protocol.file.allow=always', 'submodule', 'add', source, path)
  }
  await init(join(root, 'node_modules', 'unregistered'))
  await symlink(source, join(root, 'escape'))
  await run(root, 'config', '--file', '.gitmodules', 'submodule.escape.path', 'escape')
  await run(root, 'config', '--file', '.gitmodules', 'submodule.outside.path', '../source')
  const result = await scanRepositories(git, root)
  assert.deepEqual(result.repositories.map(r => [r.path, r.kind]), [
    ['.', 'repository'], ['node_modules/registered library', 'submodule'], ['vendor/library', 'submodule'],
  ])
  const shallow = await scanRepositories(git, root, { maxDepth: 1 })
  assert.deepEqual(shallow.repositories.map(r => r.path), ['.'])
  assert.ok(shallow.limitReasons.includes('depth'))
})

test('authorized nested cwd stays root target and nongit roots discover descendants', async t => {
  const base = await fixture(t)
  const root = join(base, 'parent'), cwd = join(root, 'nested')
  await init(root); await mkdir(cwd)
  await init(join(cwd, 'child'))
  assert.equal(await resolveRepository(git, cwd, '.'), cwd)
  const result = await scanRepositories(git, cwd)
  assert.deepEqual(result.repositories.map(r => r.path), ['.', 'child'])
  const nongit = await scanRepositories(git, base)
  assert.deepEqual(nongit.repositories.map(r => r.path), ['parent', 'parent/nested/child'])
})

test('each action rejects escapes, symlinks, invalid repositories and ordinary ancestor-resolving directories', async t => {
  const base = await fixture(t), root = join(base, 'root'), outside = join(base, 'outside')
  await init(root); await init(outside)
  await mkdir(join(root, 'ordinary'))
  await mkdir(join(root, 'invalid', '.git'), { recursive: true })
  await symlink(outside, join(root, 'escape'))
  await symlink(join(root, 'ordinary'), join(root, 'alias'))
  for (const path of ['../outside', 'ordinary/../../outside', outside, 'C:\\outside', 'escape', 'alias', 'ordinary', 'invalid', 'missing', '', null, 3]) {
    await assert.rejects(resolveRepository(git, root, path), String(path))
  }
  await init(join(root, 'child'))
  await resolveRepository(git, root, 'child')
  await rm(join(root, 'child'), { recursive: true })
  await symlink(outside, join(root, 'child'))
  await assert.rejects(resolveRepository(git, root, 'child'))
})

test('parent and child branch listing and switching remain isolated', async t => {
  const root = await fixture(t), child = join(root, 'child')
  await init(root); await init(child)
  await run(root, 'branch', 'parent-only'); await run(child, 'branch', 'child-only')
  const selected = await resolveRepository(git, root, 'child')
  assert.deepEqual((await listBranches(git, selected)).branches?.map(b => b.name).sort(), ['child-only', 'main'])
  assert.equal((await switchBranch(git, selected, 'parent-only')).ok, false)
  assert.equal((await switchBranch(git, selected, 'child-only')).ok, true)
  assert.equal(await run(root, 'branch', '--show-current'), 'main')
  assert.equal((await switchBranch(git, await resolveRepository(git, root, '.'), 'parent-only')).ok, true)
  assert.equal(await run(child, 'branch', '--show-current'), 'child-only')
})

test('scan caps depth, directories, repositories and time; only candidates execute Git', async t => {
  const root = await fixture(t)
  await mkdir(join(root, 'plain', 'deep'), { recursive: true })
  await init(join(root, 'repo'))
  const calls: string[] = []
  const tracking: typeof git = async (cwd, args, options) => { calls.push(cwd); return git(cwd, args, options) }
  await scanRepositories(tracking, root)
  assert.deepEqual([...new Set(calls)].sort(), [root, join(root, 'repo')].sort())
  for (const [overrides, reason] of [
    [{ maxDepth: 0 }, 'depth'], [{ maxDirectories: 1 }, 'directories'],
    [{ maxRepositories: 0 }, 'repositories'], [{ maxDurationMs: 0 }, 'time'],
  ] as const) {
    const result = await scanRepositories(git, root, overrides)
    assert.equal(result.truncated, true)
    assert.ok(result.limitReasons.includes(reason))
  }
})

test('HTTP discovery and branch actions retain authentication and session ownership fences', async t => {
  const base = await fixture(t), root = join(base, 'root'), outside = join(base, 'outside')
  await init(root); await init(outside); await init(join(root, 'child'))
  await run(join(root, 'child'), 'branch', 'child-only')
  type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>
  const routes = new Map<string, Handler>()
  let authenticated = true
  const context = {
    get: (name: string) => name === 'connection' ? { requestRejection: () => authenticated ? undefined : 403 }
      : name === 'sessions' ? { list: () => [{ id: 'session', cwd: root }] } : undefined,
    effect: (fn: () => unknown) => fn(),
    webServer: { register: (route: { path: string; handler: Handler }) => { routes.set(route.path, route.handler); return () => {} } },
  }
  apply(context as unknown as Parameters<typeof apply>[0], { provider: '', model: '', prompt: '' })
  const request = async (route: string, body: Record<string, unknown>) => {
    const req = Readable.from([Buffer.from(JSON.stringify(body))]) as IncomingMessage
    req.method = 'POST'; req.headers = { 'content-type': 'application/json' }
    let text = ''
    const res = { statusCode: 200, setHeader: () => {}, end: (value?: string) => { text = value ?? '' } }
    await routes.get('/dsh-git-plus/' + route)!(req, res as unknown as ServerResponse)
    return { status: res.statusCode, body: text ? JSON.parse(text) : undefined }
  }
  const body = { sessionId: 'session', cwd: root }
  assert.deepEqual((await request('repositories', body)).body.repositories.map((r: { path: string }) => r.path), ['.', 'child'])
  const branches = await request('branches', { ...body, repositoryPath: 'child' })
  assert.ok(branches.body.branches.some((b: { name: string }) => b.name === 'child-only'))
  assert.equal((await request('switch', { ...body, repositoryPath: 'child', branch: 'child-only' })).body.ok, true)
  assert.equal(await run(root, 'branch', '--show-current'), 'main')
  const child = join(root, 'child')
  await run(child, 'remote', 'add', 'origin', 'https://example.invalid/repository')
  await run(child, 'update-ref', 'refs/remotes/origin/remote-only', 'HEAD')
  assert.equal((await request('switch', { ...body, repositoryPath: 'child', branch: 'origin/remote-only', kind: 'remote' })).body.ok, true)
  assert.equal(await run(child, 'branch', '--show-current'), 'remote-only')
  assert.equal(await run(root, 'branch', '--show-current'), 'main')
  assert.equal(await run(outside, 'branch', '--show-current'), 'main')
  for (const kind of ['invalid', '', null, 1, {}]) {
    assert.equal((await request('switch', { ...body, branch: 'main', kind })).status, 400)
  }
  assert.equal((await request('switch', { ...body, repositoryPath: '../outside', branch: 'origin/remote-only', kind: 'remote' })).status, 400)
  assert.equal((await request('switch', { ...body, cwd: outside, branch: 'origin/remote-only', kind: 'remote' })).status, 403)
  assert.equal((await request('branches', { ...body, repositoryPath: '../outside' })).status, 400)
  assert.equal((await request('repositories', { ...body, cwd: outside })).status, 403)
  assert.equal((await request('switch', { ...body, sessionId: 'other', branch: 'main' })).status, 403)
  authenticated = false
  for (const route of ['repositories', 'branches', 'switch']) assert.equal((await request(route, body)).status, 403)
})

test('canonical-root cache reuses scans and explicit refresh bypasses it', async t => {
  const root = await fixture(t)
  let calls = 0
  const tracking: typeof git = async (cwd, args, options) => { calls++; return git(cwd, args, options) }
  const discover = createRepositoryDiscovery(tracking)
  const concurrent = await Promise.all([discover(root), discover(root + '/.'), discover(root, true)])
  assert.deepEqual(concurrent[0].repositories, [])
  assert.equal(concurrent[0], concurrent[1])
  assert.equal(concurrent[0], concurrent[2])
  assert.equal(calls, 1)
  const before = calls
  await init(join(root, 'new'))
  assert.deepEqual((await discover(root + '/.')).repositories, [])
  assert.equal(calls, before)
  assert.deepEqual((await discover(root, true)).repositories.map(r => r.path), ['new'])
  assert.ok(calls > before)
})
