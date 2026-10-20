import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mountEarth } from '../src/client/globe-renderer.ts'

test('scene rendering pauses when hidden or motion is disabled and releases GPU resources on disposal', async () => {
  const globals = ['Image','document','matchMedia','MutationObserver','IntersectionObserver','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','devicePixelRatio']
  const originals = globals.map(key => Object.getOwnPropertyDescriptor(globalThis, key))
  const frames = new Map()
  const listeners = new Map()
  const observers = []
  let nextFrame = 0
  let mediaListener
  let draws = 0
  let texturesDeleted = 0
  let buffersDeleted = 0
  let shadersDeleted = 0
  let programsDeleted = 0
  const uniforms = new Map()
  const media = { matches: false, addEventListener(_name, fn) { mediaListener = fn }, removeEventListener() { mediaListener = undefined } }
  class Observer {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this) }
    observe() {}
    disconnect() { this.disconnected = true }
  }
  const gl = {
    createShader: () => ({}), deleteShader() { shadersDeleted++ }, shaderSource() {}, compileShader() {}, getShaderParameter: () => true,
    createProgram: () => ({}), deleteProgram() { programsDeleted++ }, attachShader() {}, linkProgram() {}, getProgramParameter: () => true, useProgram() {},
    createBuffer: () => ({}), deleteBuffer() { buffersDeleted++ }, bindBuffer() {}, bufferData() {}, getAttribLocation: () => 0, enableVertexAttribArray() {}, vertexAttribPointer() {},
    createTexture: () => ({}), deleteTexture() { texturesDeleted++ }, activeTexture() {}, bindTexture() {}, texImage2D() {}, texParameteri() {}, getUniformLocation: (_program, name) => ({ name }), uniform1i() {}, uniform1f(location, value) { uniforms.set(location.name, value) }, uniform2f(location, x, y) { uniforms.set(location.name, [x, y]) }, uniform3f(location, x, y, z) { uniforms.set(location.name, [x, y, z]) }, viewport() {}, drawArrays() { draws++ },
  }
  const canvasListeners = new Map()
  const canvas = { width: 0, height: 0, clientWidth: 600, clientHeight: 200, dataset: { scene: 'loading' }, getContext: () => gl, addEventListener: (name, fn) => canvasListeners.set(name, fn), removeEventListener: name => canvasListeners.delete(name) }
  const doc = { body: { dataset: {} }, hidden: false, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) }
  try {
    Object.assign(globalThis, {
      Image: class { set src(_value) { queueMicrotask(() => this.onload()) } }, document: doc, matchMedia: () => media,
      MutationObserver: Observer, IntersectionObserver: Observer, ResizeObserver: Observer, devicePixelRatio: 2,
      requestAnimationFrame(fn) { const id = ++nextFrame; frames.set(id, fn); return id }, cancelAnimationFrame: id => frames.delete(id),
    })
    const runFrame = now => {
      const [id, callback] = frames.entries().next().value
      frames.delete(id); callback(now)
    }
    const dispose = mountEarth(canvas, { surface: 'fixture:earth', clouds: 'fixture:clouds' })
    await new Promise(resolve => setImmediate(resolve))
    runFrame(100)
    assert.equal(canvas.dataset.ready, 'true')
    assert.equal(draws, 1)
    assert.equal(frames.size, 1)
    runFrame(160)
    const runningTime = uniforms.get('time')
    assert.ok(runningTime > 0, 'plasma and rotation advance on successive frames')
    assert.ok(Math.abs(uniforms.get('rotation') - runningTime / 18) < 1e-8, 'the small loading globe rotates visibly without accelerating the wake clock')
    assert.equal(uniforms.get('activity'), .4)
    const [earthX] = uniforms.get('earth')
    assert.ok(earthX < -1.5 && earthX > -3, 'the loading strip anchors Earth to its left edge')
    assert.ok(canvas.width * canvas.height <= 1_000_000, 'backing store stays within the pixel budget')
    canvas.dataset.thrust = '1'; observers[0].callback(); runFrame(200); runFrame(260)
    const ramp = uniforms.get('activity')
    assert.ok(ramp > .4 && ramp < 1, 'engines throttle up smoothly instead of snapping')
    for (let t = 300; t < 4000; t += 100) runFrame(t)
    assert.ok(uniforms.get('activity') > .99, 'processing reaches full thrust')
    assert.ok(Math.abs(uniforms.get('rotation') - uniforms.get('time') / 18) < 1e-8, 'changing engine activity must not reset or accelerate the globe')
    const cruisingTime = uniforms.get('time')
    const cruisingRotation = uniforms.get('rotation')
    doc.body.dataset.mossMotion = 'off'
    observers[0].callback()
    runFrame(4100)
    assert.equal(frames.size, 0, 'reduced motion must not leave an animation loop')
    assert.equal(uniforms.get('time'), cruisingTime, 'turning motion off freezes the gas field as well as the globe')
    assert.equal(uniforms.get('rotation'), cruisingRotation, 'motion settings freeze the surface as well as the tail')
    delete doc.body.dataset.mossMotion
    observers[0].callback()
    doc.hidden = true; listeners.get('visibilitychange')()
    assert.equal(frames.size, 0)
    doc.hidden = false; listeners.get('visibilitychange')()
    assert.equal(frames.size, 1)
    observers[1].callback([{ isIntersecting: false }])
    assert.equal(frames.size, 0, 'off-screen globes must stop rendering')
    observers[1].callback([{ isIntersecting: true }])
    media.matches = true; mediaListener(); runFrame(4300)
    assert.equal(frames.size, 0)
    dispose()
    assert.equal(texturesDeleted, 2)
    assert.equal(buffersDeleted, 1)
    assert.equal(programsDeleted, 1)
    assert.equal(shadersDeleted, 2)
    assert.equal(listeners.size, 0)
    assert.equal(canvasListeners.size, 0)
    assert.equal(mediaListener, undefined)
    assert.ok(observers.every(observer => observer.disconnected))
    // Without WebGL nothing is mounted; the CSS scene in the DOM remains visible.
    const fallback = { getContext: () => null, dataset: {}, style: {} }
    mountEarth(fallback, { surface: 'fixture:earth', clouds: 'fixture:clouds' })()
    assert.equal(fallback.dataset.ready, undefined)
  } finally {
    globals.forEach((key, i) => { if (originals[i]) Object.defineProperty(globalThis, key, originals[i]); else delete globalThis[key] })
  }
})
