import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { EngineIndicator } from '../src/client/engine.ts'
import { engineCSS } from '../src/client/engine-styles.ts'
import { statusText } from '../src/client/state.ts'

test('engine exposes the actual six statuses without implying a stopped session succeeded', () => {
  for (const [status, description] of Object.entries(statusText)) {
    const markup = renderToStaticMarkup(React.createElement(EngineIndicator, { status }))
    assert.ok(markup.includes(`data-status="${status}"`))
    assert.ok(markup.includes(description.label))
    assert.ok(markup.includes('role="img"'))
    assert.ok(markup.includes('aria-hidden="true"'))
    assert.ok(!markup.includes('<button'), 'indicator must not intercept the mode control')
    assert.ok(!markup.includes('已完成') && !markup.includes('成功'))
  }
})
test('static alternatives retain state shapes when system or theme motion is disabled', () => {
  assert.ok(engineCSS.includes('prefers-reduced-motion:reduce'))
  assert.ok(engineCSS.includes('body[data-moss-motion="off"]'))
  assert.ok(engineCSS.includes('transition:none !important'))
  for (const [status, shape] of [['waiting', 'pause'], ['error', 'fault'], ['offline', 'disconnected']]) {
    assert.ok(engineCSS.includes(`.moss-engine[data-status="${status}"] .moss-engine-${shape} { display:block;`))
  }
})
