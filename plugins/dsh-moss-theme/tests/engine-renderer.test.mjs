import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mountEngine } from '../src/client/engine-renderer.ts'

function fixture(options = {}) {
 const names = ['document', 'matchMedia', 'MutationObserver', 'IntersectionObserver', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'devicePixelRatio']
 const originals = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name))
 const frames = new Map(), listeners = new Map(), canvasListeners = new Map(), uniforms = new Map()
 const observers = [], deleted = { shader: 0, program: 0, buffer: 0 }
 let next = 0, draws = 0, mediaListener, failDraw = false, error = 0
 const media = { matches: !!options.reduced, addEventListener(_n, fn) { mediaListener = fn }, removeEventListener() { mediaListener = undefined } }
 class Observer {
  constructor(callback) { this.callback = callback; this.targets = []; observers.push(this) }
  observe(...args) { this.targets.push(args) }
  disconnect() { this.disconnected = true }
 }
 const gl = {
  NO_ERROR: 0, isContextLost: () => false, getError: () => error,
  createShader: () => ({}), deleteShader() { deleted.shader++ }, shaderSource() {}, compileShader() {}, getShaderParameter: () => !options.compileFailure,
  createProgram: () => ({}), deleteProgram() { deleted.program++ }, attachShader() {}, linkProgram() {}, getProgramParameter: () => !options.linkFailure, useProgram() {},
  createBuffer: () => ({}), deleteBuffer() { deleted.buffer++ }, bindBuffer() {}, bufferData() {}, getAttribLocation: () => 0, enableVertexAttribArray() {}, vertexAttribPointer() {},
  getUniformLocation: (_p, name) => name, uniform1f(name, value) { uniforms.set(name, value) }, viewport() {},
  drawArrays() { assert.equal(canvas.dataset.engineReady === 'true' || canvas.dataset.engineReady === 'false', true); if (failDraw) throw Error('draw failed'); draws++ },
 }
 const canvas = { dataset: { status: 'standby' }, width: 0, height: 0, clientWidth: 32, clientHeight: 32,
  getContext: () => gl, addEventListener: (n, fn) => canvasListeners.set(n, fn), removeEventListener: n => canvasListeners.delete(n) }
 const doc = { body: { dataset: {} }, hidden: false, addEventListener: (n, fn) => listeners.set(n, fn), removeEventListener: n => listeners.delete(n) }
 Object.assign(globalThis, { document: doc, matchMedia: () => media, MutationObserver: Observer, IntersectionObserver: Observer, ResizeObserver: Observer, devicePixelRatio: 4,
  requestAnimationFrame(fn) { const id = next++; frames.set(id, fn); return id }, cancelAnimationFrame: id => frames.delete(id) })
 return { canvas, doc, frames, observers, deleted, uniforms, listeners, canvasListeners, media,
  get draws() { return draws }, get mediaListener() { return mediaListener },
  failDraw() { failDraw = true }, glError() { error = 1282 },
  tick(now) { const entry = frames.entries().next().value; assert.ok(entry, 'a frame should be scheduled'); frames.delete(entry[0]); entry[1](now) },
  restore() { names.forEach((name, i) => { if (originals[i]) Object.defineProperty(globalThis, name, originals[i]); else delete globalThis[name] }) },
 }
}

test('engine caps DPR, throttles draws and freezes time across motion and visibility gates', () => {
 const f = fixture(); let dispose
 try {
  dispose = mountEngine(f.canvas)
  assert.equal(f.canvas.dataset.engineReady, 'true')
  assert.equal(f.canvas.width, 64)
  assert.equal(f.canvas.height, 64)
  f.tick(0); let draws = f.draws; f.tick(40)
  assert.equal(f.draws, draws, 'standby skips draws before the 12fps idle interval')
  f.tick(90); assert.equal(f.uniforms.get('time'), .09)
  f.canvas.dataset.status = 'working'; f.observers[0].callback()
  f.tick(100); draws = f.draws; f.tick(116)
  assert.equal(f.draws, draws, 'skip draws before 30fps interval')
  f.tick(140); assert.equal(Math.round(f.uniforms.get('time') * 1000), 130)
  f.canvas.dataset.status = 'standby'; f.observers[0].callback()
  f.doc.body.dataset.mossMotion = 'off'; f.observers[0].callback()
  assert.equal(f.frames.size, 0, 'including RAF id zero, no pending frame survives pause')
  const frozen = f.uniforms.get('time')
  for (const [index, status] of ['standby', 'connecting', 'working', 'waiting', 'error', 'offline'].entries()) {
   f.canvas.dataset.status = status; f.observers[0].callback()
   assert.equal(f.uniforms.get('state'), index)
   assert.equal(f.uniforms.get('time'), frozen)
   assert.equal(f.frames.size, 0)
  }
  f.canvas.dataset.status = 'unknown'; f.observers[0].callback(); assert.equal(f.uniforms.get('state'), 0)
  delete f.doc.body.dataset.mossMotion; f.observers[0].callback(); f.tick(5000)
  assert.equal(f.uniforms.get('time'), frozen, 'resume excludes paused elapsed time')
  f.doc.hidden = true; f.listeners.get('visibilitychange')(); assert.equal(f.frames.size, 0)
  const hiddenDraws = f.draws; f.observers[0].callback(); assert.equal(f.draws, hiddenDraws)
  f.doc.hidden = false; f.listeners.get('visibilitychange')(); assert.equal(f.frames.size, 1)
  f.observers[1].callback([{ isIntersecting: false }]); assert.equal(f.frames.size, 0)
  f.observers[1].callback([{ isIntersecting: true }]); assert.equal(f.frames.size, 1)
  f.media.matches = true; f.mediaListener(); assert.equal(f.frames.size, 0)
  f.media.matches = false; f.mediaListener()
  f.doc.body.dataset.mossTheme = 'off'; f.observers[0].callback(); assert.equal(f.frames.size, 0)
  f.canvas.clientWidth = 500; f.canvas.clientHeight = 500; f.observers[2].callback()
  assert.equal(f.canvas.width, 128); assert.equal(f.canvas.height, 128)
  dispose(); dispose()
  assert.deepEqual(f.deleted, { shader: 2, program: 1, buffer: 1 })
  assert.equal(f.canvas.dataset.engineReady, 'false')
  assert.equal(f.listeners.size + f.canvasListeners.size + f.frames.size, 0)
  assert.equal(f.mediaListener, undefined)
  assert.ok(f.observers.every(o => o.disconnected))
  f.observers[0].callback(); f.observers[1].callback([{ isIntersecting: true }]); assert.equal(f.frames.size, 0)
 } finally { dispose?.(); f.restore() }
})

test('context loss reveals fallback and restoration creates a complete new resource set', () => {
 const f = fixture({ reduced: true }); let dispose
 try {
  dispose = mountEngine(f.canvas)
  assert.equal(f.frames.size, 0)
  let prevented = false
  f.canvasListeners.get('webglcontextlost')({ preventDefault() { prevented = true } })
  assert.equal(prevented, true); assert.equal(f.canvas.dataset.engineReady, 'false')
  assert.deepEqual(f.deleted, { shader: 2, program: 1, buffer: 1 })
  f.canvas.dataset.status = 'working'; f.observers[0].callback()
  f.canvasListeners.get('webglcontextrestored')()
  assert.equal(f.canvas.dataset.engineReady, 'true'); assert.equal(f.uniforms.get('state'), 2)
  assert.equal(f.frames.size, 0)
  dispose(); assert.deepEqual(f.deleted, { shader: 4, program: 2, buffer: 2 })
 } finally { dispose?.(); f.restore() }
})

for (const failure of ['compileFailure', 'linkFailure', 'drawFailure', 'glError']) {
 test(`${failure} preserves fallback and releases partial resources without leaked RAF`, () => {
  const f = fixture({ [failure]: true }); let dispose
  try {
   if (failure === 'drawFailure') f.failDraw()
   if (failure === 'glError') f.glError()
   dispose = mountEngine(f.canvas)
   assert.equal(f.canvas.dataset.engineReady, 'false'); assert.equal(f.frames.size, 0)
   assert.deepEqual(f.deleted, failure === 'compileFailure' ? { shader: 1, program: 0, buffer: 0 } : failure === 'linkFailure' ? { shader: 2, program: 1, buffer: 0 } : { shader: 2, program: 1, buffer: 1 })
   f.observers[0].callback(); assert.equal(f.frames.size, 0)
  } finally { dispose?.(); f.restore() }
 })
}

test('a later animation draw failure cancels the loop and releases resources', () => {
 const f = fixture(); let dispose
 try {
  dispose = mountEngine(f.canvas)
  f.failDraw(); f.tick(100)
  assert.equal(f.canvas.dataset.engineReady, 'false')
  assert.equal(f.frames.size, 0)
  assert.deepEqual(f.deleted, { shader: 2, program: 1, buffer: 1 })
 } finally { dispose?.(); f.restore() }
})

test('initially hidden canvas is not ready until its first successful visible draw', () => {
 const f = fixture(); let dispose
 try {
  f.doc.hidden = true
  dispose = mountEngine(f.canvas)
  assert.equal(f.canvas.dataset.engineReady, 'false')
  assert.equal(f.draws, 0)
  assert.equal(f.frames.size, 0)
  f.doc.hidden = false; f.listeners.get('visibilitychange')()
  assert.equal(f.canvas.dataset.engineReady, 'true')
  assert.equal(f.draws, 1)
 } finally { dispose?.(); f.restore() }
})

test('missing or throwing WebGL leaves fallback available without browser listeners', () => {
 for (const getContext of [() => null, () => { throw Error('unavailable') }]) {
  const canvas = { dataset: { engineReady: 'true' }, getContext }
  mountEngine(canvas)(); assert.equal(canvas.dataset.engineReady, 'false')
 }
})
