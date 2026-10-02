import {test} from 'node:test'
import assert from 'node:assert/strict'
import {drainSummary} from './summary.ts'
const config={provider:'',model:'',prompt:'Summarize the diff'}
test('uses configured defaults and DSH structured finish reasons',async()=>{
  let request:Record<string,unknown>|undefined
  const llm={listProviders:()=>[{id:'route',name:'Display name'}],listModels:async()=>[{id:'first'}],async *stream(options:Record<string,unknown>){request=options;yield {type:'text-delta',text:'feat: test'};yield {type:'finish',reason:{kind:'stop'}}}}
  const defaults={currentSelection:()=>({provider:'preferred',model:'selected'})}
  assert.equal(await drainSummary({get:n=>n==='llm'?llm:defaults},config,'+hello','session'),'feat: test')
  assert.equal(request?.provider,'preferred');assert.equal(request?.model,'selected');assert.equal(request?.sessionId,'session')
  assert.ok(request?.signal instanceof AbortSignal)
  await drainSummary({get:n=>n==='llm'?llm:undefined},config,'+hello','session')
  assert.equal(request?.provider,'route')
})
test('does not present failed or truncated generation as a commit message',async()=>{
  const ctx={get:(n:string)=>n==='llm'?{listProviders:()=>[{id:'route',name:'Display'}],listModels:async()=>[{id:'model'}],async *stream(){yield {type:'text-delta',text:'partial'};yield {type:'finish',reason:{kind:'error',failure:{message:'quota exhausted'}}}}}:undefined}
  await assert.rejects(drainSummary(ctx,config,'+hello','session'),/quota exhausted/)
  await assert.rejects(drainSummary(ctx,config,'','session'),/没有可用于/)
})
