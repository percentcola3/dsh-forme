import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm,readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {PromptStore} from '../src/prompt-store.ts'
test('asynchronous saves preserve concurrent edits and recover after rejected mutations',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'dqp-store-'))
 try {
  const file=join(dir,'prompts.json');const store=new PromptStore(file)
  await Promise.all([store.update(items=>items.push({id:'a'})),store.update(items=>items.push({id:'b'}))])
  assert.deepEqual(await store.read(),[{id:'a'},{id:'b'}])
  await assert.rejects(store.update(()=>{throw new Error('invalid')}))
  await store.update(items=>items.push({id:'c'}))
  assert.equal(JSON.parse(await readFile(file,'utf8')).length,3)
 }finally{await rm(dir,{recursive:true,force:true})}
})
