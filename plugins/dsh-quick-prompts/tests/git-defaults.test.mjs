import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, rename, writeFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { ProjectPrompts, projectOf } from '../src/project-prompts.ts'
import { isGitWorktree } from '../src/git-defaults.ts'
import { validatePrompt } from '../src/index.ts'
const exec = promisify(execFile)
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-git-defaults-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const repo = join(directory, 'repo'); await mkdir(repo)
  const git = (...args) => exec('git', args, { cwd: repo })
  return { directory, repo, git, store: new ProjectPrompts(directory), project: await projectOf(repo) }
}

test('real Git defaults seed once, edits survive reload, deletion persists, and custom prompts remain outside Git', async t => {
  const { directory, repo, git, store, project } = await fixture(t)
  await mkdir(join(repo, '.git'))
  assert.equal(await isGitWorktree(repo), false)
  assert.deepEqual((await store.list(project)).prompts, [])
  const custom = (await store.change(project, 'save', { name: '自定义', text: 'hello' }, validatePrompt)).prompts[0]
  await git('init', '-b', 'main')
  const catalogs = await Promise.all([store.list(project), store.list(project)])
  for (const catalog of catalogs) assert.deepEqual(catalog.prompts.map(p => p.name), ['自定义', '提交', '推送'])
  const [commit, push] = catalogs[0].prompts.slice(1)
  await store.change(project, 'save', { id: commit.id, name: '审核提交', text: 'custom commit instructions', gitOnly: false }, validatePrompt)
  await store.change(project, 'delete', { id: push.id }, validatePrompt)
  await symlink(repo, join(directory, 'alias'))
  const alias = await projectOf(join(directory, 'alias'))
  assert.equal(alias.id, project.id)
  const reloaded = new ProjectPrompts(directory)
  assert.deepEqual((await reloaded.list(alias)).prompts, [custom, { ...commit, name: '审核提交', text: 'custom commit instructions' }])
  await rename(join(repo, '.git'), join(directory, 'saved-git'))
  assert.deepEqual((await reloaded.list(project)).prompts, [custom])
  await rename(join(directory, 'saved-git'), join(repo, '.git'))
  assert.deepEqual((await reloaded.list(project)).prompts.map(p => p.name), ['自定义', '审核提交'])
})

test('Git detection supports nested folders and linked worktrees but rejects bare repos and inherited overrides', async t => {
  const { directory, repo, git, store } = await fixture(t)
  await git('init', '-b', 'main')
  await git('config', 'user.name', 'Test'); await git('config', 'user.email', 'test@example.invalid')
  await writeFile(join(repo, 'fixture'), 'fixture\n'); await git('add', '.'); await git('commit', '-m', 'fixture')
  const nested = join(repo, 'nested'); await mkdir(nested)
  assert.equal((await store.list(await projectOf(nested))).prompts.length, 2)
  const linked = join(directory, 'linked'); await git('worktree', 'add', '--detach', linked)
  assert.equal(await isGitWorktree(linked), true)
  const bare = join(directory, 'bare'); await git('init', '--bare', bare)
  assert.equal(await isGitWorktree(bare), false)
  const ordinary = join(directory, 'ordinary'); await mkdir(ordinary)
  const previous = { GIT_DIR: process.env.GIT_DIR, GIT_WORK_TREE: process.env.GIT_WORK_TREE }
  try {
    process.env.GIT_DIR = join(repo, '.git'); process.env.GIT_WORK_TREE = ordinary
    assert.equal(await isGitWorktree(ordinary), false)
    assert.equal(await isGitWorktree(repo), true)
  } finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value }
  }
})
