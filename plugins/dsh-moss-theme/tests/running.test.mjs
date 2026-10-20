import { test } from 'node:test'
import assert from 'node:assert/strict'
import { missionClock } from '../src/client/state.ts'

test('mission clock mirrors the host elapsed label without inventing time', () => {
  assert.equal(missionClock('深度求索中，用时 38秒 ···'), 'T+00:38')
  assert.equal(missionClock('深度求索中，用时 2分41秒 ···'), 'T+02:41')
  assert.equal(missionClock('深度求索中，用时 1小时3分5秒 ···'), 'T+1:03:05')
  assert.equal(missionClock('Deep diving for 4m 7s ···'), 'T+04:07')
  assert.equal(missionClock('深度求索中'), 'T+00:00')
})
