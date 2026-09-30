import type {Context} from '@deepseek-ai/cordis'
import type {IncomingMessage,ServerResponse} from 'node:http'
import {mkdir,appendFile,stat,rename} from 'node:fs/promises'
import {join} from 'node:path'
import {homedir} from 'node:os'
export function sanitizeEvent(value:unknown) {
  const v=value as Record<string,unknown>
  if(!v||typeof v!=='object'||!['start','tab','frame-gap','longtask','request','files-sync','files-mount','terminal-mount','terminal-ready','quick-save','session-change','files-ready','blank-navigation','stop'].includes(String(v.kind)))throw new Error('Invalid event')
  const out:Record<string,string|number|boolean>={kind:String(v.kind)}
  for(const key of ['t','duration','count','status','width','height','switchId'])if(typeof v[key]==='number'&&Number.isFinite(v[key]))out[key]=v[key] as number
  for(const key of ['tab','phase','endpoint','run'])if(typeof v[key]==='string'&&/^[a-zA-Z0-9_./-]{0,90}$/.test(v[key] as string))out[key]=v[key] as string
  for(const key of ['longtaskSupported','visible'])if(typeof v[key]==='boolean')out[key]=v[key] as boolean
  return out
}
export function installPerformanceLog(ctx:Context) {
  const server=ctx.get('webServer') as {register(route:{kind:string;path:string;handler(req:IncomingMessage,res:ServerResponse):Promise<void>}):()=>void}
  const directory=join(homedir(),'.dsh','logs')
  const file=join(directory,'ui-performance.jsonl')
  let pending=0
  let queue=Promise.resolve()
  ctx.effect(()=>server.register({kind:'exact',path:'/dsh-ui-performance',handler:async(req,res)=>{
    const fence=ctx.get('connection') as {requestRejection(req:{headers:IncomingMessage['headers']}):number|undefined}|undefined
    const denied=fence?.requestRejection({headers:req.headers})
    if(!fence||denied!==undefined){res.statusCode=denied??403;res.end();return}
    if(req.method!=='POST'||!String(req.headers['content-type']).startsWith('application/json')){res.statusCode=400;res.end();return}
    if(pending>=4){res.statusCode=429;res.end();return}
    try {
      const chunks:Buffer[]=[];let size=0
      for await(const chunk of req){size+=chunk.length;if(size>65536)throw new Error('Too large');chunks.push(chunk)}
      const body=JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if(!Array.isArray(body.events)||body.events.length>200)throw new Error('Invalid batch')
      const data=body.events.map((event:unknown)=>JSON.stringify({receivedAt:Date.now(),...sanitizeEvent(event)})).join('\n')+'\n'
      pending++
      const write=queue.then(async()=>{
        await mkdir(directory,{recursive:true,mode:0o700})
        if(await stat(file).then(s=>s.size>5_000_000).catch(()=>false))await rename(file,file+'.1')
        await appendFile(file,data,{mode:0o600})
      })
      queue=write.catch(()=>{})
      try {await write}finally{pending--}
      res.statusCode=204;res.end()
    }catch{res.statusCode=400;res.end()}
  }}))
}
