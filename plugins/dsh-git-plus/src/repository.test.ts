import { test, type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm, symlink, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createGitRunner } from './git.ts'
import { readStatus, readDiff, sessionOwnsCwd } from './repository.ts'

const git = createGitRunner({gitExecutable:process.env.DSH_TEST_GIT,gitExecPath:process.env.DSH_TEST_GIT_EXEC_PATH})
async function fixture(t: TestContext) {
  const cwd=await mkdtemp(join(tmpdir(),'forme-git-'))
  t.after(()=>rm(cwd,{recursive:true,force:true}))
  const init=await git(cwd,['init','-b','main']);assert.equal(init.code,0,init.stderr)
  await git(cwd,['config','user.name','Plugin Test']);await git(cwd,['config','user.email','plugin-test@example.invalid'])
  return cwd
}
test('unborn repo includes nested untracked Chinese paths and readable diffs',async t=>{
  const cwd=await fixture(t);await mkdir(join(cwd,'文档'))
  await writeFile(join(cwd,'文档','需求 draft.md'),'hello\nworld\n')
  const status=await readStatus(git,cwd)
  assert.equal(status.branch,'main');assert.equal(status.files[0].path,'文档/需求 draft.md');assert.equal(status.insertions,2)
  assert.match(await readDiff(git,cwd,status.files[0].path),/\+hello/)
})
test('rename and modified Unicode files preserve exact paths, counts, and clean-file diffs',async t=>{
  const cwd=await fixture(t);await writeFile(join(cwd,'原名.md'),'hello\nworld\n')
  await git(cwd,['add','.']);await git(cwd,['commit','-m','fixture'])
  await git(cwd,['mv','原名.md','新 名.md'])
  const status=await readStatus(git,cwd)
  assert.equal(status.files[0].path,'新 名.md');assert.equal(status.files[0].oldPath,'原名.md')
  assert.match(await readDiff(git,cwd,'新 名.md'),/rename from/)
  await git(cwd,['commit','-am','rename fixture']);await writeFile(join(cwd,'新 名.md'),'hello\nnew world\n')
  const changed=await readStatus(git,cwd);assert.equal(changed.insertions,1);assert.equal(changed.deletions,1)
  assert.match(await readDiff(git,cwd,'新 名.md'),/\+new world/)
  await git(cwd,['restore','--','新 名.md']);assert.equal(await readDiff(git,cwd,'新 名.md'),'')
  await assert.rejects(readDiff(git,cwd,'../outside'),/超出/)
})
test('cold persisted sessions remain authorized; missing sessions and symlink escapes do not',async t=>{
  const cwd=await fixture(t);const outside=await mkdtemp(join(tmpdir(),'forme-outside-'));t.after(()=>rm(outside,{recursive:true,force:true}))
  await symlink(outside,join(cwd,'escape'))
  const ctx={get:(key:string)=>key==='sessions'?{list:()=>[]}:{stat:async(id:string)=>id==='known'?{header:{id,cwd}}:undefined}}
  assert.equal(await sessionOwnsCwd(ctx,'known',cwd),true)
  assert.equal(await sessionOwnsCwd(ctx,'unknown',cwd),false)
  assert.equal(await sessionOwnsCwd(ctx,'known',join(cwd,'escape')),false)
})
