import {test} from 'node:test'
import assert from 'node:assert/strict'
import {validatePrompt} from '../src/index.ts'
import {startAgent} from '../src/client/tasks.ts'
test('task settings validate and preserve legacy defaults',()=>{
  assert.deepEqual(validatePrompt({name:'旧任务',text:'hi'}),{name:'旧任务',text:'hi'})
  assert.equal(validatePrompt({name:'终端',text:'yarn dev',mode:'shell'}).mode,'shell')
  assert.throws(()=>validatePrompt({name:'x',text:'pwd',mode:'wrong'}))
  assert.throws(()=>validatePrompt({name:'x',text:'a\0',mode:'shell'}))
  assert.throws(()=>validatePrompt({name:'x',text:'hi',mode:'agent',selection:{provider:'x'}}))
  assert.equal(validatePrompt({name:'x',text:'hi',mode:'chat',selection:{provider:'x',model:'y'}}).selection,undefined)
})
function fixture(fail=false) {
  const calls=[]
  const sessions={
    create:async options=>{calls.push(['create',options]);return 'new'},
    binding:id=>({session:{rename:async name=>{calls.push(['rename',id,name]);return {ok:true}}}}),
    scope:id=>({get:()=>({send:async text=>{calls.push(['send',id,text])}})})
  }
  const models={directoryFor:id=>({select:async value=>{calls.push(['model',id,value]);if(fail)throw new Error('model unavailable')}})}
  return {calls,ctx:{get:name=>name==='sessions'?sessions:models}}
}
test('independent agent creates fresh cwd-only session and selects model before sending',async()=>{
  const {ctx,calls}=fixture()
  const selection={provider:'deepseek',model:'light',reasoningEffort:'low'}
  await startAgent(ctx,'/tmp',{id:'p',name:'check',text:'exact prompt',mode:'agent',selection},id=>calls.push(['created',id]))
  assert.deepEqual(calls,[['create',{cwd:'/tmp'}],['created','new'],['rename','new','快捷任务 · check'],['model','new',selection],['send','new','exact prompt']])
})
test('model failure retains result link, never sends or retries with another model',async()=>{
  const {ctx,calls}=fixture(true)
  let retained
  await assert.rejects(startAgent(ctx,'/tmp',{name:'x',text:'hi',selection:{provider:'a',model:'b'}},id=>retained=id),/model unavailable/)
  assert.equal(retained,'new')
  assert.equal(calls.filter(c=>c[0]==='send').length,0)
})
