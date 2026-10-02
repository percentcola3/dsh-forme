import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createGitRunner } from './git.ts'

test('configured executable receives cwd, literal arguments, and a private helper environment', async () => {
  const original = process.env.GIT_EXEC_PATH
  const run = createGitRunner({ gitExecutable: process.execPath, gitExecPath: '/portable git/helpers' })
  const result = await run(process.cwd(), ['-e', 'console.log(JSON.stringify([process.cwd(), process.env.GIT_EXEC_PATH, process.argv[1]]))', '--', '$(do-not-execute)'])
  assert.equal(result.code, 0)
  assert.deepEqual(JSON.parse(result.stdout), [process.cwd(), '/portable git/helpers', '$(do-not-execute)'])
  assert.equal(process.env.GIT_EXEC_PATH, original)
})

test('execution errors retain useful diagnostics, including missing executable', async () => {
  const run = createGitRunner({ gitExecutable: process.execPath })
  const failed = await run(process.cwd(), ['-e', 'process.stderr.write("Git setup required"); process.exit(69)'])
  assert.equal(failed.code, 69)
  assert.equal(failed.stderr, 'Git setup required')
  const missing = await createGitRunner({ gitExecutable: '/missing-plant-test/git' })(process.cwd(), ['status'])
  assert.notEqual(missing.code, 0)
  assert.match(missing.stderr, /ENOENT/)
})
