import {test} from 'node:test'
import assert from 'node:assert/strict'
import {hideBlankNavigation} from '../src/client/blank-session-nav.ts'
test('hide only explicitly blank selected sessions, reveal when conversation begins',()=>{
 assert.equal(hideBlankNavigation({current:'new',byId:{new:{blank:true},old:{blank:false}}}),true)
 assert.equal(hideBlankNavigation({current:'new',byId:{new:{blank:false}}}),false)
 assert.equal(hideBlankNavigation({current:'old',byId:{new:{blank:true},old:{blank:false}}}),false)
 assert.equal(hideBlankNavigation({current:'loading',byId:{}}),false)
 assert.equal(hideBlankNavigation({byId:{}}),false)
})
