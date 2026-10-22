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
  for (const catalog of catalogs) assert.deepEqual(catalog.prompts.map(p => p.name), ['自定义', '推送'])
  const push = catalogs[0].prompts[1]
  assert.match(push.text, /先审阅并提交改动，再/)
  assert.match(push.text, /没有可提交改动时仍检查并推送已有待推送提交/)
  assert.match(push.text, /提交或检查失败时停止，不继续推送/)
  await store.change(project, 'save', { id: push.id, name: '审核推送', text: 'custom push instructions', gitOnly: false }, validatePrompt)
  await symlink(repo, join(directory, 'alias'))
  const alias = await projectOf(join(directory, 'alias'))
  assert.equal(alias.id, project.id)
  const reloaded = new ProjectPrompts(directory)
  assert.deepEqual((await reloaded.list(alias)).prompts, [custom, { ...push, name: '审核推送', text: 'custom push instructions' }])
  await rename(join(repo, '.git'), join(directory, 'saved-git'))
  assert.deepEqual((await reloaded.list(project)).prompts, [custom])
  await rename(join(directory, 'saved-git'), join(repo, '.git'))
  assert.deepEqual((await reloaded.list(project)).prompts.map(p => p.name), ['自定义', '审核推送'])
  await reloaded.change(project, 'delete', { id: push.id }, validatePrompt)
  assert.deepEqual((await new ProjectPrompts(directory).list(project)).prompts, [custom])
})

const legacyCommit = { id: 'old-commit', name: '提交', gitOnly: true, text: '检查当前项目的 Git 状态和差异。优先审阅并提交现有已暂存改动，尊重暂存范围，不自动加入未暂存文件；若没有暂存改动，审阅当前工作区，在改动范围明确时选择相关改动提交。排除密钥、凭据及无关改动，保留其他未提交内容；若混杂无关改动或敏感内容且无法确定提交范围，先向用户澄清。运行适当的检查，使用准确简洁的提交说明完成提交，并报告结果。没有可提交改动时说明情况。不要推送。沿用原生权限与审批流程。' }
const legacyPush = { id: 'old-push', name: '推送', gitOnly: true, text: '检查当前项目的 Git 分支、上游、远程仓库及待推送提交，然后将当前分支已有的提交正常推送到明确的目标。不要创建提交，不要强制推送，不要改写历史或丢弃工作区改动。若目标、权限或当前分支状态不明确，先向用户澄清；没有待推送提交时说明情况。报告推送结果，沿用原生权限与审批流程。' }

test('legacy automatic defaults migrate once without changing custom instructions or ids', async t => {
  const { directory, git, project, store } = await fixture(t)
  await git('init', '-b', 'main')
  const custom = [
    { ...legacyCommit, id: 'renamed', name: '审核提交' },
    { ...legacyPush, id: 'edited', text: 'custom instructions' },
    { ...legacyCommit, id: 'model', model: { provider: 'custom', model: 'custom' } },
    { ...legacyPush, id: 'user', gitOnly: false },
  ]
  await writeFile(join(directory, 'quick-prompts.projects.json'), JSON.stringify([{ ...project, initializedGitDefaults: true, prompts: [legacyCommit, legacyPush, ...custom] }]))
  const results = await Promise.all([store.list(project), store.list(project)])
  for (const result of results) {
    assert.equal(result.prompts[0].id, legacyPush.id)
    assert.equal(result.prompts[0].name, '推送')
    assert.match(result.prompts[0].text, /先审阅并提交改动，再/)
    assert.deepEqual(result.prompts.slice(1), custom)
  }
  assert.deepEqual((await new ProjectPrompts(directory).list(project)).prompts, results[0].prompts)
})

for (const prompts of [[], [legacyCommit], [legacyPush]]) {
  test(`legacy migration respects deleted defaults: ${prompts.map(p => p.name).join(',') || 'empty'}`, async t => {
    const { directory, git, project, store } = await fixture(t)
    await git('init', '-b', 'main')
    await writeFile(join(directory, 'quick-prompts.projects.json'), JSON.stringify([{ ...project, initializedGitDefaults: true, prompts }]))
    const result = await store.list(project)
    assert.deepEqual(result.prompts.map(p => p.id), prompts.some(p => p.id === legacyPush.id) ? [legacyPush.id] : [])
    assert.deepEqual((await new ProjectPrompts(directory).list(project)).prompts, result.prompts)
  })
}

test('Git detection supports nested folders and linked worktrees but rejects bare repos and inherited overrides', async t => {
  const { directory, repo, git, store } = await fixture(t)
  await git('init', '-b', 'main')
  await git('config', 'user.name', 'Test'); await git('config', 'user.email', 'test@example.invalid')
  await writeFile(join(repo, 'fixture'), 'fixture\n'); await git('add', '.'); await git('commit', '-m', 'fixture')
  const nested = join(repo, 'nested'); await mkdir(nested)
  assert.equal((await store.list(await projectOf(nested))).prompts.length, 1)
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
