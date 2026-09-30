import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ProjectRunner } from '../src/runner.ts'
const quote = value => `'${value.replaceAll("'", "'\\''")}'`
async function waitUntil(predicate) {
  for (let i = 0; i < 150; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 20)) }
  throw new Error('Timed out')
}
function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'dsh-run-test-'))
  const runner = new ProjectRunner()
  t.after(async () => { await runner.dispose(); rmSync(cwd, { recursive: true, force: true }) })
  return { cwd, runner, script(code) { writeFileSync(join(cwd, 'run.cjs'), code); return `${quote(process.execPath)} run.cjs` } }
}
test('command uses project cwd, combines output and reports exit status', async t => {
  const f = fixture(t)
  f.runner.start(f.cwd, f.script("console.log(process.cwd()); console.error('stderr'); process.exitCode=7"))
  await waitUntil(() => f.runner.snapshot(f.cwd).status === 'exited')
  const value = f.runner.snapshot(f.cwd)
  assert.ok(value.output.includes(f.cwd)); assert.ok(value.output.includes('stderr')); assert.equal(value.exitCode, 7)
})
test('output is bounded and ANSI styling is removed', async t => {
  const f = fixture(t)
  f.runner.start(f.cwd, f.script("process.stdout.write('x'.repeat(250000)+'\\x1b[31mEND\\x1b[0m')"))
  await waitUntil(() => f.runner.snapshot(f.cwd).status === 'exited')
  const value = f.runner.snapshot(f.cwd)
  assert.equal(value.output.length, 200000); assert.ok(value.truncated); assert.ok(value.output.endsWith('END'))
})
test('duplicate starts are rejected and stop kills SIGTERM-resistant descendants', async t => {
  const f = fixture(t)
  const command = f.script(`const {spawn}=require('node:child_process'); const child=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{}); console.log('ready'); setInterval(()=>{},1000)"],{stdio:['ignore','pipe','inherit']}); child.stdout.on('data',()=>console.log(child.pid)); setInterval(()=>{},1000)`)
  f.runner.start(f.cwd, command)
  await waitUntil(() => /\d+/.test(f.runner.snapshot(f.cwd).output))
  const pid = Number(f.runner.snapshot(f.cwd).output.trim())
  assert.throws(() => f.runner.start(f.cwd, 'echo duplicate'), /先停止/)
  await f.runner.stop(f.cwd)
  assert.equal(f.runner.snapshot(f.cwd).status, 'exited')
  await waitUntil(() => { try { process.kill(pid, 0); return false } catch (error) { return error.code === 'ESRCH' } })
  f.runner.start(f.cwd, 'echo restarted')
  await waitUntil(() => f.runner.snapshot(f.cwd).status === 'exited')
  assert.match(f.runner.snapshot(f.cwd).output, /restarted/)
})
test('project state is isolated and disposal terminates active commands', async t => {
  const f = fixture(t)
  const other = mkdtempSync(join(tmpdir(), 'dsh-run-other-')); t.after(() => rmSync(other, {recursive:true,force:true}))
  f.runner.start(f.cwd, f.script("setInterval(()=>{},1000)"))
  assert.equal(f.runner.snapshot(other), undefined)
  await f.runner.dispose()
  assert.equal(f.runner.snapshot(f.cwd).status, 'exited')
})

test('restart coalesces repeated requests, stops the old process and starts one replacement', async t => {
  const f = fixture(t)
  const command = f.script("console.log(process.pid); setInterval(()=>{},1000)")
  f.runner.start(f.cwd, command)
  await waitUntil(() => /\d+/.test(f.runner.snapshot(f.cwd).output))
  const oldPid = Number(f.runner.snapshot(f.cwd).output.trim())
  const restart = f.runner.restart(f.cwd, command)
  assert.equal(f.runner.restart(f.cwd, command), restart)
  await restart
  await waitUntil(() => /\d+/.test(f.runner.snapshot(f.cwd).output))
  assert.notEqual(Number(f.runner.snapshot(f.cwd).output.trim()), oldPid)
  assert.throws(() => process.kill(oldPid, 0), { code: 'ESRCH' })
  assert.equal(f.runner.snapshot(f.cwd).status, 'running')
})
test('invalid restart command leaves the running project untouched', async t => {
  const f = fixture(t)
  f.runner.start(f.cwd, f.script("setInterval(()=>{},1000)"))
  await assert.rejects(f.runner.restart(f.cwd, ''), /有效的启动命令/)
  assert.equal(f.runner.snapshot(f.cwd).status, 'running')
})
test('shutdown during restart cannot launch a replacement after disposal', async t => {
  const f = fixture(t)
  const command = f.script("setInterval(()=>{},1000)")
  f.runner.start(f.cwd, command)
  const rejected = assert.rejects(f.runner.restart(f.cwd, command), /正在关闭/)
  await f.runner.dispose()
  await rejected
  assert.equal(f.runner.snapshot(f.cwd).status, 'exited')
})
