// Parent owns layout and SVG fallback; this module owns only the canvas.
const vertex = `attribute vec2 position; varying vec2 uv;
void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`
const fragment = `
precision highp float;
varying vec2 uv;
uniform float time, state, pixel, aspect;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){return noise(p)*.6+noise(p*2.3+7.1)*.4;}
void main(){
 vec2 p=(uv*2.-1.)*vec2(aspect,1.);
 float connecting=1.-step(.5,abs(state-1.));
 float working=1.-step(.5,abs(state-2.));
 float waiting=1.-step(.5,abs(state-3.));
 float error=1.-step(.5,abs(state-4.));
 float offline=step(4.5,state);
 // Rotation speed is the activity signal; low-frequency bands avoid dizziness.
 float spin=(.32+connecting*.36+working*1.95+waiting*.5+error*.4)*(1.-offline);
 // Saturn ring disc, same geometry as the desktop notification: plane rises to
 // the right, ry/rx = .3, C/B/A bands in planet radii with a Cassini gap.
 float planetR=.5;
 float tilt=-.3,cs=cos(tilt),sn=sin(tilt);
 vec2 rq=vec2(p.x*cs-p.y*sn,p.x*sn+p.y*cs);
 float ringE=length(vec2(rq.x,rq.y/.3))/planetR;
 float w=.07;
 float bandC=smoothstep(1.32-w,1.32+w,ringE)*(1.-smoothstep(1.52-w,1.52+w,ringE));
 float bandB=smoothstep(1.52-w,1.52+w,ringE)*(1.-smoothstep(1.86-w,1.86+w,ringE));
 float bandA=smoothstep(1.93-w,1.93+w,ringE)*(1.-smoothstep(2.18-w,2.18+w,ringE));
 float ringPattern=.88+.12*noise(vec2(ringE*18.,3.7));
 float ringA=(bandC*.3+bandB*.92+bandA*.66)*ringPattern;
 float r=length(p);
 float disc=1.-smoothstep(0.,pixel*1.5,r-planetR);
 float behind=step(0.,rq.y);
 // Far half is dimmer and hidden by the sphere; near half crosses in front.
 float ringVis=ringA*mix(1.,.62*(1.-disc),behind);
 vec3 ringCol=vec3(.97,.96,.93);
 ringCol=mix(ringCol,vec3(1.,.68,.64),error);
 ringCol=mix(ringCol,vec3(.98,.9,.78),waiting*.5);
 ringCol=mix(ringCol,vec3(.62,.68,.74),offline*.8);
 vec3 col=ringCol; float alpha=0.;
 if(disc>0.){
  vec2 sp=p/planetR;
  vec3 n=vec3(sp,sqrt(max(0.,1.-dot(sp,sp))));
  float lon=atan(n.x,n.z)+time*spin*2.2;
  float lat=asin(clamp(n.y,-1.,1.));
  float warp=fbm(vec2(lon*1.05,lat*3.4));
  float stripes=.5+.5*sin(lat*6.+warp*2.9+sin(lon*.7)*.35);
  col=mix(vec3(.66,.55,.4),vec3(.94,.88,.75),.26+stripes*.52);
  float stormA=mod(lon-1.2+3.14159265,6.2831853)-3.14159265;
  float stormD=length(vec2(stormA,lat-.12)*vec2(1.,2.4));
  col=mix(col,vec3(.99,.96,.88),smoothstep(.27,.1,stormD)*.8);
  float stormB=mod(lon-3.9+3.14159265,6.2831853)-3.14159265;
  col=mix(col,vec3(.55,.44,.33),smoothstep(.22,.08,length(vec2(stormB,lat+.3)*vec2(1.,2.)))*.7);
  float stormC=mod(lon-.4+3.14159265,6.2831853)-3.14159265;
  col=mix(col,vec3(.9,.82,.66),smoothstep(.2,.07,length(vec2(stormC,lat-.38)*vec2(1.,2.6)))*.55);
  float light=clamp(.34+.78*dot(n,normalize(vec3(-.5,.45,.74))),0.,1.);
  col*=.44+.62*light;
  col=mix(col,col*vec3(1.35,.5,.42),error*.72);
  col=mix(col,col*vec3(1.05,.92,.75),waiting*.28);
  col=mix(col,vec3(.42,.47,.54)*(.5+.5*light),offline*.82);
  col=mix(col,ringCol,ringA*(1.-behind));
  alpha=disc;
 }
 float halo=exp(-pow((r-planetR)*10.,2.))*.1*(1.-offline*.6);
 vec3 hc=mix(vec3(.82,.74,.58),vec3(.9,.4,.34),error);
 float a2=max(max(alpha,ringVis),halo);
 vec3 outCol=(col*max(alpha,ringVis)+hc*halo)/max(a2,.001);
 outCol=mix(outCol,vec3(dot(outCol,vec3(.33))),offline*.35);
 gl_FragColor=vec4(min(outCol,vec3(a2)),a2);
}`
const statuses = ['standby', 'connecting', 'working', 'waiting', 'error', 'offline']
const FRAME_MS = 1000 / 30
// Slow idle spin needs few frames; keeps standby off the main thread while typing.
const IDLE_FRAME_MS = 1000 / 12

/** Transparent procedural engine. data-engine-ready gates the parent's SVG fallback. */
export function mountEngine(canvas: HTMLCanvasElement): () => void {
 canvas.dataset.engineReady = 'false'
 let gl: WebGLRenderingContext | null
 try { gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'low-power' }) }
 catch { return () => {} }
 if (!gl) return () => {}
 const context = gl
 let disposed = false, lost = false, visible = true
 let frame: number | undefined
 let last: number | undefined
 let clock = 0
 let draw: (() => void) | undefined
 const resources: (() => void)[] = []
 const reduced = matchMedia('(prefers-reduced-motion: reduce)')
 const moving = () => document.body.dataset.mossMotion !== 'off' && document.body.dataset.mossTheme !== 'off' && !reduced.matches
 const pause = () => {
  if (frame !== undefined) cancelAnimationFrame(frame)
  frame = undefined; last = undefined
 }
 const release = () => {
  draw = undefined
  for (const dispose of resources.splice(0).reverse()) { try { dispose() } catch { /* Context may already be lost. */ } }
 }
 const fail = () => { pause(); release(); canvas.dataset.engineReady = 'false' }
 const render = () => {
  if (disposed || lost || !draw) return false
  try {
   draw()
   if (context.isContextLost() || context.getError() !== context.NO_ERROR) throw new Error('Engine draw failed')
   if (canvas.dataset.engineReady !== 'true') canvas.dataset.engineReady = 'true'
   return true
  } catch { fail(); return false }
 }
 const animate = (now: number) => {
  frame = undefined
  if (disposed || lost || !draw || !visible || document.hidden || !moving()) { last = undefined; return }
  const busy = canvas.dataset.status === 'working' || canvas.dataset.status === 'connecting'
  if (last === undefined || now - last >= (busy ? FRAME_MS : IDLE_FRAME_MS)) {
   if (last !== undefined) clock += Math.min((now - last) / 1000, .1)
   last = now
   if (!render()) return
  }
  frame = requestAnimationFrame(animate)
 }
 const refresh = () => {
  pause()
  if (disposed || lost || !visible || document.hidden || !draw) return
  if (render() && moving()) frame = requestAnimationFrame(animate)
 }
 const initialize = () => {
  release()
  try {
   const compile = (kind: number, source: string) => {
    const shader = context.createShader(kind)
    if (!shader) throw new Error('Engine shader unavailable')
    resources.push(() => context.deleteShader(shader))
    context.shaderSource(shader, source); context.compileShader(shader)
    if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) throw new Error('Engine shader compilation failed')
    return shader
   }
   const vs = compile(context.VERTEX_SHADER, vertex), fs = compile(context.FRAGMENT_SHADER, fragment)
   const program = context.createProgram()
   if (!program) throw new Error('Engine program unavailable')
   resources.push(() => context.deleteProgram(program))
   context.attachShader(program, vs); context.attachShader(program, fs); context.linkProgram(program)
   if (!context.getProgramParameter(program, context.LINK_STATUS)) throw new Error('Engine program link failed')
   const buffer = context.createBuffer()
   if (!buffer) throw new Error('Engine buffer unavailable')
   resources.push(() => context.deleteBuffer(buffer))
   context.useProgram(program)
   context.bindBuffer(context.ARRAY_BUFFER, buffer)
   context.bufferData(context.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), context.STATIC_DRAW)
   const position = context.getAttribLocation(program, 'position')
   if (position < 0) throw new Error('Engine position unavailable')
   context.enableVertexAttribArray(position); context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0)
   const uniforms = Object.fromEntries(['time', 'state', 'pixel', 'aspect'].map(name => [name, context.getUniformLocation(program, name)]))
   draw = () => {
    const ratio = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1))
    const width = Math.max(1, Math.min(128, Math.round((canvas.clientWidth || 32) * ratio)))
    const height = Math.max(1, Math.min(128, Math.round((canvas.clientHeight || 32) * ratio)))
    if (canvas.width !== width) canvas.width = width
    if (canvas.height !== height) canvas.height = height
    context.viewport(0, 0, width, height)
    context.uniform1f(uniforms.time, clock)
    context.uniform1f(uniforms.state, Math.max(0, statuses.indexOf(canvas.dataset.status || 'standby')))
    context.uniform1f(uniforms.pixel, 2 / height)
    context.uniform1f(uniforms.aspect, width / height)
    context.drawArrays(context.TRIANGLES, 0, 6)
   }
   refresh()
  } catch { fail() }
 }
 const onLost = (event: Event) => { event.preventDefault(); lost = true; fail() }
 const onRestored = () => { if (!disposed) { lost = false; initialize() } }
 const attributes = new MutationObserver(refresh)
 attributes.observe(canvas, { attributes: true, attributeFilter: ['data-status'] })
 attributes.observe(document.body, { attributes: true, attributeFilter: ['data-moss-motion', 'data-moss-theme'] })
 const intersection = new IntersectionObserver(entries => {
  if (disposed) return
  visible = entries.some(entry => entry.isIntersecting)
  refresh()
 })
 intersection.observe(canvas)
 const resize = new ResizeObserver(refresh)
 resize.observe(canvas)
 document.addEventListener('visibilitychange', refresh)
 reduced.addEventListener('change', refresh)
 canvas.addEventListener('webglcontextlost', onLost)
 canvas.addEventListener('webglcontextrestored', onRestored)
 initialize()
 return () => {
  if (disposed) return
  disposed = true; fail()
  attributes.disconnect(); intersection.disconnect(); resize.disconnect()
  document.removeEventListener('visibilitychange', refresh)
  reduced.removeEventListener('change', refresh)
  canvas.removeEventListener('webglcontextlost', onLost)
  canvas.removeEventListener('webglcontextrestored', onRestored)
 }
}
