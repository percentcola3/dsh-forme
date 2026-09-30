/** Temporary opt-out recorder. No payloads, URLs with tokens, or DOM text. */
export function installPerformanceRecorder():()=>void {
  const originalFetch=window.fetch
  const run=crypto.randomUUID()
  let enabled=true,disposed=false,started=performance.now(),last=started,switchId=0
  let events:Record<string,unknown>[]=[]
  let flushing=false,failed=false
  const counts=new Map<string,{count:number;duration:number}>()
  const add=(kind:string,data:Record<string,unknown>={})=>{
    if(enabled&&events.length<200)events.push({kind,run,t:Math.round(performance.now()),switchId,...data})
  }
  const button=document.createElement('button')
  Object.assign(button.style,{position:'fixed',bottom:'8px',left:'8px',zIndex:'10010',fontSize:'11px',padding:'4px 8px',borderRadius:'6px',border:'1px solid #8885',background:'var(--dsw-alias-bg-layer-2)',color:'var(--dsw-alias-label-secondary)',cursor:'pointer'})
  button.title='记录性能耗时，不记录内容；10 分钟自动停止。点击停止或重新开始。'
  const label=()=>{button.textContent=failed?'性能日志写入失败':enabled?'性能记录中 · 停止':'性能记录已停止 · 开始'}
  document.body.appendChild(button);label()
  const flush=async()=>{
    if(flushing||!events.length)return
    flushing=true
    const batch=events.splice(0,200)
    try {const res=await originalFetch.call(window,'/dsh-ui-performance',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({events:batch}),keepalive:true});failed=!res.ok}
    catch{failed=true}finally{flushing=false;if(!disposed)label()}
  }
  const stop=()=>{add('stop');enabled=false;label();void flush()}
  button.onclick=()=>{if(enabled)stop();else{enabled=true;started=performance.now();last=started;add('start',{longtaskSupported:PerformanceObserver.supportedEntryTypes?.includes('longtask')??false});label()}}
  const request:typeof fetch=async(input,init)=>{
    if(!enabled)return originalFetch.call(window,input,init)
    let endpoint='other'
    try {const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href);if(url.origin===location.origin){const root=url.pathname.split('/')[1];endpoint=['dsh-project-run','dsh-quick-prompts','dsh-git-plus','dsh-version-update'].includes(root)?root:'official'}}catch{}
    const start=performance.now()
    let status=0
    try {const res=await originalFetch.call(window,input,init);status=res.status;return res}
    finally{const duration=Math.round(performance.now()-start);const key=endpoint;const previous=counts.get(key)??{count:0,duration:0};previous.count++;previous.duration+=duration;counts.set(key,previous);if(duration>150)add('request',{endpoint,duration,status,phase:'slow-headers'})}
  }
  window.fetch=request
  const click=(event:Event)=>{
    const tab=(event.target as Element)?.closest?.('header [role="tablist"] > [role="tab"]')
    if(!tab||!enabled)return
    switchId++
    const id=switchId,start=performance.now()
    const kind=tab.getAttribute('data-dsh-nav')??'other'
    add('tab',{tab:kind,phase:'click'})
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(id===switchId)add('tab',{tab:kind,phase:'two-frames',duration:Math.round(performance.now()-start)})}))
  }
  document.addEventListener('click',click,true)
  const mark=(event:Event)=>{
    const detail=(event as CustomEvent).detail
    if(detail&&['files-sync','files-mount','terminal-mount','terminal-ready','quick-save','session-change','files-ready','blank-navigation'].includes(detail.kind))add(detail.kind,{duration:Math.round(Number(detail.duration)||0)})
  }
  document.addEventListener('dsh-performance',mark)
  const supported=PerformanceObserver.supportedEntryTypes?.includes('longtask')??false
  let observer:PerformanceObserver|undefined
  if(supported){observer=new PerformanceObserver(list=>{for(const e of list.getEntries())add('longtask',{duration:Math.round(e.duration)})});observer.observe({entryTypes:['longtask']})}
  let raf=0
  const frame=(now:number)=>{if(enabled&&document.visibilityState==='visible'&&now-last>80)add('frame-gap',{duration:Math.round(now-last),visible:true});last=now;if(!disposed)raf=requestAnimationFrame(frame)}
  raf=requestAnimationFrame(frame)
  const visible=()=>{last=performance.now()}
  document.addEventListener('visibilitychange',visible)
  const timer=setInterval(()=>{
    if(enabled){for(const [endpoint,value]of counts)add('request',{endpoint,...value,phase:'headers-summary'});counts.clear();if(performance.now()-started>600000)stop()}
    void flush()
  },3000)
  const pagehide=()=>{add('stop');void flush()}
  window.addEventListener('pagehide',pagehide)
  add('start',{longtaskSupported:supported,width:innerWidth,height:innerHeight})
  return()=>{pagehide();disposed=true;enabled=false;clearInterval(timer);cancelAnimationFrame(raf);observer?.disconnect();button.remove();document.removeEventListener('click',click,true);document.removeEventListener('dsh-performance',mark);document.removeEventListener('visibilitychange',visible);window.removeEventListener('pagehide',pagehide);if(window.fetch===request)window.fetch=originalFetch}
}
