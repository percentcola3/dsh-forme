import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile, readFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ProjectPrompts, projectOf } from '../src/project-prompts.ts'
import { validatePrompt, apply, inject } from '../src/index.ts'
import { Context } from '@deepseek-ai/cordis'
import { Readable } from 'node:stream'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { rename } from 'node:fs/promises'

test('project configuration survives reload, aliases resolve identically and legacy import has one explicit owner', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-projects-'))
  try {
    await mkdir(join(directory, 'a')); await mkdir(join(directory, 'b')); await symlink(join(directory, 'a'), join(directory, 'alias'))
    const a = await projectOf(join(directory, 'a')), b = await projectOf(join(directory, 'b'))
    assert.equal((await projectOf(join(directory, 'alias'))).id, a.id)
    await writeFile(join(directory, 'quick-prompts.json'), JSON.stringify([{ id: 'legacy', name: '旧任务', text: 'pwd' }]))
    const store = new ProjectPrompts(directory)
    assert.deepEqual((await store.list(a)).prompts, [])
    const [sa, sb] = await Promise.all([store.change(a, 'save', { name: 'A', text: 'A' }, validatePrompt), store.change(b, 'save', { name: 'B', text: 'B' }, validatePrompt)])
    await assert.rejects(store.change(b, 'delete', { id: sa.prompts[0].id }, validatePrompt), /不属于当前项目/)
    await assert.rejects(store.change(a, 'save', { id: sb.prompts[0].id, name: 'bad', text: 'bad' }, validatePrompt), /不属于当前项目/)
    await store.change(a, 'import', {}, validatePrompt)
    await assert.rejects(store.change(b, 'import', {}, validatePrompt), /已导入其他项目/)
    assert.deepEqual((await new ProjectPrompts(directory).list(a)).prompts.map(item => item.name), ['A', '旧任务'])
    assert.deepEqual((await store.list(b)).prompts.map(item => item.name), ['B'])
    assert.equal(JSON.parse(await readFile(join(directory, 'quick-prompts.json'), 'utf8'))[0].id, 'legacy')
  } finally { await rm(directory, { recursive: true, force: true }) }
})
test('API scopes every action to the live session directory and refuses foreign shortcut/run ids and stale project scopes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-project-api-')), ctx = new Context()
  let handler
  const admitted = []
  try {
    const paths = { A: join(directory, 'a'), B: join(directory, 'b') }
    await Promise.all(Object.values(paths).map(path => mkdir(path)))
    const parents = Object.fromEntries(Object.entries(paths).map(([id, cwd]) => [id, { id, session: { header: { id, cwd } } }]))
    await ctx.plugin(provider => {
      provider.provide('connection', { requestRejection: () => undefined })
      provider.provide('webServer', { register: route => { handler = route.handler; return () => {} } })
      provider.provide('sessionController', {})
      provider.provide('workspaceRegistry', { archivedSessionIds: [] })
      provider.provide('sessions', { list: () => Object.values(parents).map(parent => parent.session) })
      provider.provide('agents', { get: id => parents[id] })
      provider.provide('llm', { listProviders: () => [{ id: 'deepseek-account', name: 'DeepSeek' }], listModels: async () => [{ id: 'deepseek-flash', name: 'DeepSeek Flash' }] })
      provider.provide('subagents', { getProvider: () => ({}), resolveMaxDepth: () => 4, interrupt() {}, startActivation: async spec => {
        admitted.push(spec)
        let settle
        return { childId: spec.childId, result: new Promise(resolve => { settle = resolve }), dispose: async () => settle({ stopReason: 'aborted' }) }
      } })
    })
    await ctx.plugin({ inject, apply: scope => apply(scope, {}, { directory, runtime: scope.get('subagents') }) })
    const call = async (sessionId, action, body = {}) => {
      const req = Readable.from([Buffer.from(JSON.stringify({ sessionId, action, ...body }))]); req.method = 'POST'; req.headers = { 'content-type': 'application/json' }
      let value; const res = { setHeader() {}, end(text) { value = JSON.parse(text) } }
      await handler(req, res); return { code: res.statusCode, ...value }
    }
    const a = await call('A', 'save', { name: 'A', text: 'pwd' }), b = await call('B', 'save', { name: 'B', text: 'pwd' })
    assert.equal((await call('B', 'start', { id: a.prompts[0].id, requestId: 'x' })).code, 400)
    assert.equal((await call('B', 'delete', { id: a.prompts[0].id })).code, 400)
    assert.equal((await call('B', 'runs', { projectId: a.projectId })).code, 400)
    const first = await call('A', 'start', { id: a.prompts[0].id, requestId: 'one', cwd: paths.B })
    const second = await call('A', 'start', { id: a.prompts[0].id, requestId: 'two' })
    const other = await call('B', 'start', { id: b.prompts[0].id, requestId: 'one' })
    assert.notEqual(first.run.id, second.run.id)
    assert.equal(admitted[0].request.cwd, (await projectOf(paths.A)).cwd)
    assert.equal((await call('A', 'runs')).runs.length, 2)
    assert.equal((await call('B', 'runs')).runs.length, 1)
    for (const action of ['stop', 'close']) assert.equal((await call('A', action, { runId: other.run.id })).code, 400)
    assert.equal((await call('A', 'close', { runId: first.run.id })).runs.length, 1)
    assert.equal((await call('B', 'runs')).runs[0].id, other.run.id)
    await promisify(execFile)('git', ['init', '-b', 'main'], { cwd: paths.A })
    const defaults = (await call('A', 'list')).prompts.filter(prompt => prompt.gitOnly)
    assert.equal(defaults.length, 1)
    assert.equal(defaults[0].name, '推送')
    const gitRun = await call('A', 'start', { id: defaults[0].id, requestId: 'git-default' })
    assert.equal(gitRun.code, 202)
    assert.equal(admitted.at(-1).request.prompt.at(-1).text, defaults[0].text)
    await rename(join(paths.A, '.git'), join(directory, 'saved-git'))
    const admissionsBefore = admitted.length
    assert.equal((await call('A', 'start', { id: defaults[0].id, requestId: 'no-longer-git', cwd: join(directory, 'saved-git') })).code, 400)
    assert.equal(admitted.length, admissionsBefore)
    assert.equal((await call('A', 'list')).prompts.some(prompt => prompt.gitOnly), false)

  } finally { await ctx.fiber.dispose(); await rm(directory, { recursive: true, force: true }) }
})
