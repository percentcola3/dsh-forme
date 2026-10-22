type Textures = { surface: string; clouds: string }

/**
 * Scene layout in normalized units: y spans [-1, 1] bottom-to-top, x spans [-aspect, aspect].
 * Edge anchors measure Earth's x inward from that edge so wide strips keep it in view.
 */
export type SceneLayout = {
  earth: [x: number, y: number, radius: number]
  anchor?: 'center' | 'left' | 'right'
  /** Screen direction of the wake; Earth travels the opposite way. */
  thrust: [x: number, y: number]
  /** Wake length in Earth radii at full thrust. */
  tail: number
  stars: number
  /** Visual rotation period, independent of the wake and engine animation. */
  rotationSeconds: number
}

export const scenes = {
  hero: { earth: [.95, .02, .62], thrust: [-.996, -.09], tail: 5.5, stars: 1, rotationSeconds: 40 },
  console: { earth: [.72, 0, .6], thrust: [-.995, -.1], tail: 4.5, stars: 1, rotationSeconds: 32 },
  loading: { earth: [1.08, 0, .62], anchor: 'left', thrust: [.999, -.04], tail: 15, stars: .55, rotationSeconds: 18 },
} satisfies Record<string, SceneLayout>
export type SceneName = keyof typeof scenes

const vertex = `attribute vec2 position; varying vec2 uv;
void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`

const fragment = `
precision highp float;
varying vec2 uv;
uniform sampler2D surfaceMap;
uniform sampler2D cloudMap;
uniform float time;
uniform float rotation;
uniform float activity;
uniform float aspect;
uniform float pixel;
uniform float starAmount;
uniform float tailLength;
uniform vec3 earth;
uniform vec2 thrust;
const float PI=3.14159265;
const vec3 SUN=vec3(.5,.42,.75);
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+vec2(17.1,3.7);a*=.5;}return v;}

vec3 starLayer(vec2 p,float density,float seed){
  vec2 g=p*density;vec2 id=floor(g);vec2 f=fract(g)-.5;
  float h=hash(id+seed);
  if(h<.94)return vec3(0.);
  vec2 o=vec2(hash(id+3.1+seed),hash(id+7.7+seed))-.5;
  float size=pixel*density*(.9+1.6*(h-.94)/.06);
  float b=smoothstep(size,0.,length(f-o*.6));
  float twinkle=.65+.35*sin(time*(.7+h*2.)+h*50.);
  return mix(vec3(.62,.76,1.),vec3(1.,.88,.72),hash(id+1.3))*b*twinkle*(h-.9)*8.;
}

// Follow the atmospheric shell before peeling away. The downstream curve has
// the same position and tangent at departure, so there is no angular join.
float wakeProfile(float a){
  const float shellRadius=1.025;
  const float departure=.58;
  const float channel=.18;
  float height=sqrt(shellRadius*shellRadius-departure*departure);
  float slope=departure/height;
  float relaxation=(height-channel)/slope;
  float arc=sqrt(max(.001,shellRadius*shellRadius-a*a));
  float trailing=channel+(height-channel)*exp(-(a-departure)/relaxation);
  return mix(arc,trailing,smoothstep(.4,.78,a));
}

// The atmosphere stripped by motion. Ahead of the planet the layer stays a thin
// compressed shell on the limb. The two shear layers curve inward behind the
// planet, retain an open channel between them, then drift along one shared axis.
vec3 wake(vec2 rel,float r){
  vec2 perp=vec2(-thrust.y,thrust.x);
  float a=dot(rel,thrust);
  float s=dot(rel,perp);
  float reach=tailLength*(.5+.5*activity);
  float behind=max(a,0.);
  if(a>reach*1.25)return vec3(0.);
  float t=time*(.25+activity*.9);
  float neck=min(reach*.55,2.35);
  float downstream=smoothstep(.25,neck*1.5,behind);
  // Anchor both branches to the shell; shared axis drift starts after release.
  float released=smoothstep(.65,1.6,behind);
  float axis=sin(behind*1.65-t*.8)*.065*smoothstep(.85,2.2,behind);
  float as=abs(s-axis);
  float side=s-axis<0.?-1.:1.;
  float sep=wakeProfile(a);
  float merged=smoothstep(neck*.65,neck*1.6,behind);
  side*=1.-merged;
  float taper=1.-smoothstep(reach*.4,reach*1.15,behind);
  float width=(.025+.095*downstream)*(.45+.55*taper);
  if(as>sep+width*7.+.1)return vec3(0.);
  float k=smoothstep(-.35,.3,a);
  float lay=mix(r-1.,as-sep,k);
  // Curl stays inside the converging envelope instead of fanning outward.
  float wb=min(behind,1.5)*(.25+.75*taper)*released;
  float warp=(fbm(vec2(a*.8-t*.8,as*2.2+side*7.3))-.5)*wb*.12
            +(noise(vec2(a*2.6-t*1.6,as*5.+side*3.1))-.5)*wb*.05;
  warp*=1.-step(8.,tailLength)*.8;
  float w=lay+warp;
  float freq=clamp(earth.z/pixel*.9,12.,110.);
  float n1=noise(vec2(w*freq,a*.32-t*.7+side*11.));
  float n2=noise(vec2(w*freq*2.3+3.7,a*.55-t*1.15+side*5.));
  float ridge=pow(1.-abs(n1*2.-1.),7.)+pow(1.-abs(n2*2.-1.),12.)*.7;
  // Strands brighten and break along their length as they peel away.
  float breakup=.35+.9*smoothstep(.25,.75,noise(vec2(w*freq*.22+side*9.,a*1.3-t*1.4)));
  float inside=mix(1.+k*2.,1.,downstream);
  float env=w>=0.?exp(-w/width):exp(w/(width*inside))*(1.-.25*k);
  float fade=exp(-behind/max(reach,.05)*1.1)*(1.-smoothstep(reach*.65,reach*1.15,behind));
  float onset=smoothstep(-.3,.45,a);
  // A few strands carry most of the light; the rest stay faint.
  float lane=noise(vec2(w*freq*.08+side*17.,a*.12-t*.2));
  float weight=.25+1.6*pow(lane,2.2);
  // Keep the near wake hollow behind Earth, with a faint interior downstream
  // so the two soft edges stay distinct without pinching into a bright point.
  float core=smoothstep(.0,.55,as/max(sep,1e-3)-.35+behind*.02);
  core=mix(core,1.,smoothstep(neck*.65,neck*1.4,behind));
  // The long, thin running strip has no room for a shadow cone; keep it bright.
  float strip=step(8.,tailLength);
  core=mix(core,1.,strip);
  weight*=1.+strip*1.4;
  // A continuous translucent sheet connects the moving filaments to the limb.
  // Keep the wake visible at cruise with a rounded head and a tapered tail.
  float flow=env*mix(.42,.2+ridge*breakup*weight*1.65,onset);
  float centre=exp(-pow(as/(width*1.1),2.))*merged;
  flow=max(flow,centre*(.16+.08*noise(vec2(a*2.-t,0.))));
  float I=flow*fade*mix(1.,core,onset)*(.38+.62*activity);
  return mix(vec3(.36,.7,.95),vec3(.86,.97,1.),clamp(I,0.,1.))*I*1.75;
}

void main(){
  vec2 p=vec2((uv.x*2.-1.)*aspect,uv.y*2.-1.);
  vec2 rel=(p-earth.xy)/earth.z;
  float r=length(rel);
  vec3 col=vec3(0.);
  if(r>1.){
    col+=(starLayer(p,13.,0.)+starLayer(p+vec2(.37,.11),27.,9.)*.6)*starAmount;
    vec2 rim=rel/r;
    float alt=r-1.;
    float lit=max(0.,dot(normalize(vec3(rim,.25)),normalize(SUN)));
    float ahead=max(0.,-dot(rim,thrust));
    col+=vec3(.55,.84,1.)*(exp(-alt*38.)*.8+exp(-alt*10.)*.15)*(.6+lit*.7);
    col+=vec3(.8,.92,1.)*exp(-alt*70.)*ahead*activity*.55;
    col+=wake(rel,r);
  }
  float edgeW=pixel*1.4/earth.z;
  if(r<1.+edgeW){
    float lc=min(r,1.);
    vec3 n=vec3(rel/max(r,1e-4)*lc,sqrt(max(0.,1.-lc*lc)));
    float c=cos(.4),sn=sin(.4);
    vec3 a=vec3(n.x*c+n.y*sn,-n.x*sn+n.y*c,n.z);
    vec2 map=vec2(fract(atan(a.x,a.z)/(2.*PI)+.62+rotation),acos(clamp(a.y,-1.,1.))/PI);
    vec3 land=texture2D(surfaceMap,map).rgb;
    float cloud=texture2D(cloudMap,vec2(fract(map.x+time*.0005),map.y)).r;
    float water=smoothstep(.04,.18,land.b-land.r);
    // Lift the satellite texture into an icy daylight palette; preserve its
    // land detail while replacing nearly black ocean texels with pale blue.
    vec3 base=pow(land,vec3(.82))*vec3(.96,1.02,1.08);
    base=mix(base,vec3(.22,.52,.69)+land*.28,water*.78);
    // Cool the land into the same palette as the ocean before the cloud layer;
    // continents remain readable without the satellite image's green/brown cast.
    float luminance=dot(base,vec3(.2126,.7152,.0722));
    base=mix(base,vec3(.65,.88,1.)*luminance,.38);
    vec3 surface=mix(base,vec3(.93,.97,1.),smoothstep(.15,.85,cloud)*.85);
    float diffuse=dot(n,normalize(SUN));
    float day=smoothstep(-.15,.7,diffuse);
    vec3 e=surface*(.24+day*.83);
    e=mix(e,vec3(.52,.75,.86),(.08+water*.12)*(1.-cloud*.6));
    e+=vec3(.55,.72,.85)*pow(max(0.,dot(reflect(-normalize(SUN),n),vec3(0.,0.,1.))),36.)*.22*water*(1.-cloud);
    // A belt of planetary engines across the trailing hemisphere, brighter with thrust.
    vec3 ringN=normalize(vec3(-thrust,.5));
    vec3 rv=normalize(cross(ringN,vec3(0.,0.,1.)));
    vec3 ru=cross(ringN,rv);
    float d=dot(n,ringN);
    float th=atan(dot(n,ru),dot(n,rv));
    float cells=clamp(earth.z/pixel*1.1,18.,140.);
    float cc=th/(2.*PI)*cells;
    float hid=hash(vec2(floor(cc),3.));
    float bead=smoothstep(.42,.08,abs(fract(cc)-.5))*step(.3,hid)*(.7+.3*sin(time*6.+hid*40.));
    float band=exp(-d*d/(.022*.022));
    float density=smoothstep(30.,90.,earth.z/pixel);
    e+=vec3(.55,.85,1.)*band*bead*activity*1.5*density;
    e+=vec3(.25,.55,1.)*exp(-d*d/(.09*.09))*activity*.22;
    e+=vec3(.08,.25,.7)*activity*(1.-day)*smoothstep(-.1,.7,dot(n,normalize(vec3(thrust,-.3))))*.3;
    float lit=max(0.,dot(normalize(vec3(n.xy,.25)),normalize(SUN)));
    // A translucent blue veil covers the whole disk. Its optical depth grows
    // toward the limb, softening coastlines while keeping clouds and rotation.
    float hazeDepth=.38+.62*pow(1.-n.z,1.6)+cloud*.06;
    float transmission=exp(-hazeDepth);
    vec3 scattered=vec3(.48,.74,.9)*(.65+.35*day);
    e=e*transmission+scattered*(1.-transmission);
    e=mix(e,vec3(.6,.86,1.),pow(1.-n.z,2.5)*(.22+.35*lit));
    float edge=1.-smoothstep(1.-edgeW,1.+pixel*.6/earth.z,r);
    col=mix(col,e,edge);
  }
  col=max(col,0.);
  float alpha=clamp(max(col.r,max(col.g,col.b)),0.,1.);
  if(r<1.)alpha=1.;
  gl_FragColor=vec4(min(col,vec3(alpha)),alpha);
}`

let imagery: Promise<HTMLImageElement[]> | undefined
function loadImagery(textures: Textures): Promise<HTMLImageElement[]> {
  return imagery ??= Promise.all([textures.surface, textures.clouds].map(src => new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Earth texture could not be decoded'))
    image.src = src
  })))
}

const FRAME_MS = 33
const MAX_PIXELS = 1_000_000

/** One full-scene shader per canvas. Pauses off-screen or when motion is off, and disposes every GPU resource. */
export function mountEarth(canvas: HTMLCanvasElement, textures: Textures): () => void {
  delete canvas.dataset.ready
  delete canvas.dataset.failed
  const fail = () => { delete canvas.dataset.ready; canvas.dataset.failed = 'true' }
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'low-power' })
  // Loading is transparent; show the static scene only on a rendering failure.
  if (!gl) { fail(); return () => {} }
  const resources: (() => void)[] = []
  let disposed = false
  let frame = 0
  let visible = true
  let ready = false
  let last = 0
  let clock = 0
  let rotation = 0
  let thrust = Number.NaN
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const moving = () => document.body.dataset.mossMotion !== 'off' && !reduced.matches
  const compile = (kind: number, source: string) => {
    const shader = gl.createShader(kind)
    if (!shader) throw new Error('Scene shader unavailable')
    resources.push(() => gl.deleteShader(shader))
    gl.shaderSource(shader, source); gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Scene shader compilation failed')
    return shader
  }
  let draw: ((dt: number) => void) | undefined
  const pause = () => { cancelAnimationFrame(frame); frame = 0; last = 0 }
  const animate = (now: number) => {
    frame = 0
    if (disposed || !ready || !visible || document.hidden) { last = 0; return }
    if (last === 0 || now - last >= FRAME_MS) {
      const dt = last && moving() ? Math.min((now - last) / 1000, .1) : 0
      clock += dt
      last = now
      draw?.(dt)
    }
    if (moving()) frame = requestAnimationFrame(animate)
  }
  const refresh = () => { pause(); if (ready && !disposed && visible && !document.hidden) frame = requestAnimationFrame(animate) }
  const observer = new MutationObserver(refresh)
  observer.observe(document.body, { attributes: true, attributeFilter: ['data-moss-motion'] })
  observer.observe(canvas, { attributes: true, attributeFilter: ['data-thrust', 'data-scene'] })
  const intersection = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; refresh() })
  intersection.observe(canvas)
  const resize = new ResizeObserver(refresh)
  resize.observe(canvas)
  reduced.addEventListener('change', refresh)
  document.addEventListener('visibilitychange', refresh)
  const lost = (event: Event) => { event.preventDefault(); ready = false; pause(); fail() }
  canvas.addEventListener('webglcontextlost', lost)
  void loadImagery(textures).then(images => {
    if (disposed) return
    const program = gl.createProgram()
    if (!program) throw new Error('Scene renderer unavailable')
    resources.push(() => gl.deleteProgram(program))
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex)); gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment)); gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Scene shader linking failed')
    gl.useProgram(program)
    const buffer = gl.createBuffer()
    resources.push(() => gl.deleteBuffer(buffer))
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'position')
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    images.forEach((image, unit) => {
      const texture = gl.createTexture()
      resources.push(() => gl.deleteTexture(texture))
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.uniform1i(gl.getUniformLocation(program, unit === 0 ? 'surfaceMap' : 'cloudMap'), unit)
    })
    const u = (name: string) => gl.getUniformLocation(program, name)
    const loc = { time: u('time'), rotation: u('rotation'), activity: u('activity'), aspect: u('aspect'), pixel: u('pixel'), stars: u('starAmount'), tail: u('tailLength'), earth: u('earth'), thrust: u('thrust') }
    draw = (dt: number) => {
      const cssWidth = canvas.clientWidth, cssHeight = canvas.clientHeight
      if (!cssWidth || !cssHeight) return
      let scale = Math.min(devicePixelRatio || 1, 2)
      if (cssWidth * cssHeight * scale * scale > MAX_PIXELS) scale = Math.sqrt(MAX_PIXELS / (cssWidth * cssHeight))
      const width = Math.round(cssWidth * scale), height = Math.round(cssHeight * scale)
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
      const layout: SceneLayout = scenes[(canvas.dataset.scene as SceneName) ?? 'hero'] ?? scenes.hero
      // Advance geography and clouds around the tilted axis without speeding
      // up the atmospheric wake. Keep a continuous phase across status changes.
      rotation = (rotation + dt / layout.rotationSeconds) % 1
      const aspect = width / height
      const target = Math.max(0, Math.min(1, Number(canvas.dataset.thrust ?? .4) || 0))
      // Engines throttle smoothly between session states instead of snapping.
      thrust = Number.isNaN(thrust) || !moving() ? target : thrust + (target - thrust) * Math.min(1, dt * 1.6)
      const [ex, ey, er] = layout.earth
      gl.viewport(0, 0, width, height)
      gl.uniform1f(loc.time, clock)
      gl.uniform1f(loc.rotation, rotation)
      gl.uniform1f(loc.activity, thrust)
      gl.uniform1f(loc.aspect, aspect)
      gl.uniform1f(loc.pixel, 2 / height)
      gl.uniform1f(loc.stars, layout.stars)
      gl.uniform1f(loc.tail, layout.tail)
      gl.uniform3f(loc.earth, layout.anchor === 'left' ? -aspect + ex : layout.anchor === 'right' ? aspect - ex : ex, ey, er)
      gl.uniform2f(loc.thrust, layout.thrust[0], layout.thrust[1])
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      if (gl.isContextLost()) { fail(); return }
      delete canvas.dataset.failed
      canvas.dataset.ready = 'true'
    }
    ready = true; refresh()
  }).catch(() => { if (!disposed) fail() })
  return () => {
    disposed = true; pause(); observer.disconnect(); intersection.disconnect(); resize.disconnect()
    reduced.removeEventListener('change', refresh); document.removeEventListener('visibilitychange', refresh)
    canvas.removeEventListener('webglcontextlost', lost)
    resources.reverse().forEach(dispose => dispose())
  }
}
