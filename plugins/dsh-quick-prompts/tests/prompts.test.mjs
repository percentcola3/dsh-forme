import {test} from 'node:test'
import assert from 'node:assert/strict'
import {validatePrompt} from '../src/index.ts'
import {shortName,sendPrompt} from '../src/client/logic.ts'
test('label is limited to five graphemes without damaging emoji',()=>{
  assert.equal(shortName('检查当前代码问题'),'检查当前代')
  assert.equal(shortName('👨‍👩‍👧‍👦检查代码问题'),'👨‍👩‍👧‍👦检查代码')
})
test('validation preserves prompt formatting and rejects empty content',()=>{
  assert.deepEqual(validatePrompt({name:' 检查 ',text:'  提示\n代码\n'}),{name:'检查',text:'  提示\n代码\n'})
  assert.throws(()=>validatePrompt({name:'',text:'hello'}))
  assert.throws(()=>validatePrompt({name:'x',text:'   '}))
  assert.throws(()=>validatePrompt({name:'x',text:'a'.repeat(32001)}))
})
test('click dispatches exact saved text to the selected session only',async()=>{
  const calls=[]
  const ctx={get:name=>name==='uiWorkspace'?{selection:{getSnapshot:()=>({sessionId:'a'})}}:{scope:id=>({get:()=>({send:async text=>{calls.push({id,text})}})})}}
  await sendPrompt(ctx,'a','  检查代码\n保持格式')
  assert.deepEqual(calls,[{id:'a',text:'  检查代码\n保持格式'}])
  await assert.rejects(sendPrompt(ctx,'b','wrong session'))
  await assert.rejects(sendPrompt(ctx,undefined,'no session'))
  assert.equal(calls.length,1)
})
test('send failure is surfaced and never retried automatically',async()=>{
  let calls=0
  const ctx={get:name=>name==='uiWorkspace'?{selection:{getSnapshot:()=>({sessionId:'a'})}}:{scope:()=>({get:()=>({send:async()=>{calls++;throw new Error('offline')}})})}}
  await assert.rejects(sendPrompt(ctx,'a','prompt'),/offline/)
  assert.equal(calls,1)
})
