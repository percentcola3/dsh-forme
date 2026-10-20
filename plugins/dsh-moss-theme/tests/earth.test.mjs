import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { EarthScene, thrustFor } from '../src/client/earth.ts'

test('each scene renders its own canvas with engine thrust derived from the real session state', () => {
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null,
    ...['hero', 'console', 'loading'].map(scene => React.createElement(EarthScene, { key: scene, status: 'working', scene })),
  ))
  for (const scene of ['hero', 'console', 'loading']) assert.match(html, new RegExp(`data-scene="${scene}"`))
  assert.equal([...html.matchAll(/data-thrust="1"/g)].length, 3)
  assert.doesNotMatch(html, /\bid="/, 'no document-level ids that could collide between simultaneous scenes')
})

test('thrust never overstates activity', () => {
  assert.equal(thrustFor.working, 1)
  assert.ok(thrustFor.standby < thrustFor.connecting && thrustFor.connecting < thrustFor.working)
  assert.ok(thrustFor.error < thrustFor.standby)
  assert.equal(thrustFor.offline, 0)
})
