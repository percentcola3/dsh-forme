import {test} from 'node:test'
import assert from 'node:assert/strict'
import {sanitizeEvent} from '../src/performance-log.ts'
test('performance log drops contents and token-bearing strings',()=>{
 assert.deepEqual(sanitizeEvent({kind:'request',duration:20,t:15,endpoint:'api?token=secret',text:'private',body:'private',status:200}),{kind:'request',duration:20,t:15,status:200})
 assert.throws(()=>sanitizeEvent({kind:'arbitrary'}))
 assert.deepEqual(sanitizeEvent({kind:'tab',duration:Infinity,tab:'files',phase:'click',switchId:3}),{kind:'tab',switchId:3,tab:'files',phase:'click'})
})
