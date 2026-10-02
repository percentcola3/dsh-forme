import React from 'react'
import { createPortal } from 'react-dom'
import type { Context } from '@deepseek-ai/cordis'
import { taskRequest, startAgent, sessionsFor, openSession, modelsFor, type Catalog, type Prompt } from './tasks.ts'
import { shortName, sendPrompt, currentSessionId } from './logic.ts'
export const inject = ['slots', 'sessions', 'uiWorkspace', 'modelDirectories', 'remote', 'remote.session']
type Draft = Omit<Prompt,'id'> & {id?:string}
async function request(action: string, value: Partial<Prompt> = {}): Promise<Prompt[]> {
  const res = await fetch('/dsh-quick-prompts',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({action,...value})})
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? '快捷提示词操作失败。')
  return body.prompts
}
export function apply(ctx: Context): void {
  const slots = ctx.get('slots') as {
    inject(name:string, register:()=>()=>void):()=>void
    register(options:{name:string;id:string;order:number},render:(props:{sessionId?:string})=>React.ReactElement):()=>void
  }
  ctx.effect(()=>slots.inject('conversation.input.overlay',()=>slots.register({name:'conversation.input.overlay',id:'dsh-quick-prompts',order:5},props=>React.createElement(QuickPrompts,{ctx,sessionId:props.sessionId,key:props.sessionId}))))
  ctx.effect(()=>{
    const style = document.createElement('style')
    style.textContent = `
/* Reserve the shortcut row inside the card. The official composer observer
   includes this height, so chat content and file previews clear it naturally. */
[data-composer-card]:has(.dqp-bar) { --dqp-status-height:0px; --dqp-header-height:44px; padding-top:calc(var(--dqp-header-height) + 8px); }
[data-composer-card]:has(.dqp-task-status) { --dqp-status-height:32px; --dqp-header-height:76px; }
[data-composer-card]:has(.dqp-notice) { --dqp-header-height:calc(72px + var(--dqp-status-height)); }
.dqp-task-chip { display:inline-flex; align-items:center; flex:none; border-radius:999px; background:var(--dsw-alias-interactive-bg-hover); }
.dqp-bar .dqp-task-chip > button { background:transparent; }
.dqp-bar .dqp-task-chip > button:first-child { padding-right:7px; }
.dqp-bar .dqp-task-edit { width:25px; padding:0; border-radius:0 999px 999px 0; display:grid; place-items:center; }
.dqp-bar .dqp-task-edit:hover { color:var(--dsw-alias-state-business-primary); background:var(--dsw-alias-bg-layer-3); }
.dqp-task-status { position:absolute; top:44px; left:12px; right:12px; height:28px; display:flex; align-items:center; gap:8px; overflow:auto; white-space:nowrap; font-size:11px; }
.dqp-task-status button { border:0; border-radius:6px; background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-secondary); font:inherit; cursor:pointer; padding:3px 7px; }
.dqp-bar { position:absolute; top:0; left:0; right:0; height:44px; box-sizing:border-box; display:flex; align-items:center; gap:6px; padding:7px 12px; border:0; border-radius:22px 22px 0 0; background:color-mix(in srgb, var(--dsw-specific-input-major) 94%, var(--dsw-alias-label-primary) 6%); pointer-events:auto; }
.dqp-bar::after { content:''; position:absolute; bottom:0; left:12px; right:12px; height:1px; background:var(--dsw-alias-border-l3); pointer-events:none; }
.dqp-items { display:flex; flex:1; align-items:center; gap:6px; overflow-x:auto; overflow-y:hidden; min-width:0; max-height:30px; scrollbar-width:thin; }
.dqp-bar button { appearance:none; flex:none; height:28px; padding:0 11px; border:0; border-radius:999px; background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-secondary); font:inherit; font-size:12px; cursor:pointer; white-space:nowrap; }
.dqp-bar button:hover { background:var(--dsw-alias-bg-layer-3); color:var(--dsw-alias-label-primary); }
.dqp-bar .dqp-add { width:28px; padding:0; font-size:20px; line-height:28px; background:transparent; color:var(--dsw-alias-label-secondary); }
.dqp-bar .dqp-add:hover { background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-state-business-primary); }
.dqp-bar button:disabled { opacity:.45; cursor:default; }
.dqp-bar button:focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:-2px; }
.dqp-dialog :is(button,input,textarea,select):focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:2px; }
.dqp-notice { position:absolute; top:calc(44px + var(--dqp-status-height)); left:12px; right:12px; height:28px; line-height:28px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-state-error-primary); font-size:12px; }
.dqp-backdrop { position:fixed; inset:0; z-index:10020; display:grid; place-items:center; padding:20px; background:rgb(0 0 0 / .2); }
.dqp-dialog { width:440px; max-width:100%; max-height:calc(100vh - 40px); overflow:auto; box-sizing:border-box; padding:20px; border:1px solid var(--dsw-alias-border-l2); border-radius:16px; background:var(--dsw-alias-bg-layer-3); color:var(--dsw-alias-label-primary); box-shadow:0 12px 40px rgb(0 0 0 / .2); display:flex; flex-direction:column; gap:14px; font-size:13px; }
.dqp-dialog h3 { margin:0; font-size:16px; }
.dqp-dialog label { display:flex; flex-direction:column; gap:7px; }
.dqp-dialog :is(input,textarea,select) { width:100%; box-sizing:border-box; padding:9px 10px; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; background:var(--dsw-alias-bg-layer-2); color:inherit; font:inherit; }
.dqp-dialog textarea { min-height:150px; resize:vertical; line-height:1.6; }
.dqp-dialog small { color:var(--dsw-alias-label-tertiary); }
.dqp-dialog footer { display:flex; gap:8px; justify-content:flex-end; }
.dqp-dialog button { padding:7px 14px; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; background:var(--dsw-alias-bg-layer-2); color:inherit; cursor:pointer; font:inherit; }
.dqp-dialog .dqp-save { background:var(--dsw-alias-state-business-primary); color:white; border-color:transparent; }
.dqp-dialog .dqp-delete { margin-right:auto; color:var(--dsw-alias-state-error-primary); }
.dqp-dialog button:disabled { opacity:.5; cursor:default; }
.dqp-dialog [role="alert"] { color:var(--dsw-alias-state-error-primary); margin:0; }
`
    document.head.appendChild(style); return ()=>style.remove()
  })
}
function QuickPrompts({ctx,sessionId}:{ctx:Context;sessionId?:string}):React.ReactElement {
  const [items,setItems] = React.useState<Prompt[]>([])
  const [draft,setDraft] = React.useState<Draft|null>(null)
  const [error,setError] = React.useState('')
  const [busy,setBusy] = React.useState(false)
  const [modelError,setModelError] = React.useState('')
  const [catalog,setCatalog] = React.useState<Catalog>({groups:[]})
  const [runs,setRuns] = React.useState<Record<string,string>>(()=>{try {return JSON.parse(localStorage.getItem(`dqp-runs:${sessionId}`)??'{}')}catch{return {}}})
  React.useEffect(()=>{try {localStorage.setItem(`dqp-runs:${sessionId}`,JSON.stringify(runs))}catch{}},[runs,sessionId])
  const [panel,setPanel] = React.useState(false)
  const [output,setOutput] = React.useState({status:'idle',output:'',cwd:'',exitCode:null as number|null})
  const [,tick] = React.useState(0)
  React.useEffect(()=>{
    if(!sessionId||draft?.mode!=='agent')return
    let live=true
    try {void modelsFor(ctx)?.directoryFor(sessionId).load().then(value=>{if(live)setCatalog(value)}).catch(err=>{if(live)setModelError(String(err))})}catch(err){setModelError(String(err))}
    return()=>{live=false}
  },[ctx,sessionId,draft?.mode])
  React.useEffect(()=>{
    const stops=Object.values(runs).map(id=>{
      const reference=sessionsFor(ctx).retain(id,{source:'quickPromptStatus'})
      let live=true
      void reference.ready.then(()=>{if(live)tick(n=>n+1)}).catch(err=>{if(live)setError(String(err))})
      const stop=reference.binding.session.subscribe(()=>tick(n=>n+1))
      return ()=>{live=false;stop();reference.release()}
    })
    return()=>{for(const stop of stops)stop?.()}
  },[ctx,runs])
  const commandRunning=['running','stopping'].includes(output.status)
  React.useEffect(()=>{
    if(!sessionId)return
    let live=true
    let timer:ReturnType<typeof setTimeout>|undefined
    const poll=async()=>{
      try {
        const value=await taskRequest('status',{sessionId,includeOutput:panel})
        if(live)setOutput(previous=>{
          const next={...value,output:panel?value.output:previous.output}
          return previous.status===next.status&&previous.output===next.output&&previous.cwd===next.cwd&&previous.exitCode===next.exitCode?previous:next
        })
      } catch(err){if(live&&panel)setError(String(err))}
      if(live&&(panel||commandRunning))timer=setTimeout(poll,panel?1000:3000)
    }
    void poll();return()=>{live=false;clearTimeout(timer)}
  },[sessionId,panel,commandRunning])
  const sending = React.useRef(false)
  const nameInput = React.useRef<HTMLInputElement>(null)
  const trigger = React.useRef<HTMLButtonElement|null>(null)
  React.useEffect(()=>{let live=true; void request('list').then(items=>{if(live)setItems(items)}).catch(err=>{if(live)setError(String(err.message))});return()=>{live=false}},[])
  const close = () => { if (busy) return; setDraft(null); setError(''); trigger.current?.focus() }
  React.useEffect(()=>{
    if (!draft) return
    nameInput.current?.focus()
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!sending.current){setDraft(null);setError('');trigger.current?.focus()}}
    document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey)
  },[!!draft])
  const open = (event:React.MouseEvent<HTMLButtonElement>,item?:Prompt) => {trigger.current=event.currentTarget;setError('');setDraft(item?{...item}:{name:'',text:'',mode:'chat'})}
  const save = async (action:'save'|'delete') => {
    if(!draft||sending.current)return
    sending.current=true;setBusy(true);setError('')
    try {
      const items=await request(action,draft)
      setDraft(null);trigger.current?.focus()
      React.startTransition(()=>setItems(items))
    }
    catch(err){setError(err instanceof Error?err.message:String(err))}
    finally{sending.current=false;setBusy(false)}
  }
  const send = async(item:Prompt)=>{
    if(sending.current)return
    sending.current=true;setBusy(true);setError('')
    try {
      if(!sessionId || currentSessionId(ctx)!==sessionId)throw new Error('请先选择会话。')
      if(item.mode==='shell') {setOutput(await taskRequest('run',{id:item.id,sessionId}));setPanel(true)}
      else if(item.mode==='agent') {
        const {cwd}=await taskRequest('workspace',{sessionId})
        await startAgent(ctx,cwd,item,id=>setRuns(previous=>Object.fromEntries(Object.entries({...previous,[item.id]:id}).slice(-20))))
      } else await sendPrompt(ctx,sessionId,item.text)
    }catch(err){setError(err instanceof Error?err.message:String(err))}
    finally{sending.current=false;setBusy(false)}
  }
  const modal=draft?createPortal(React.createElement('div',{className:'dqp-backdrop',onClick:(event:React.MouseEvent)=>{if(event.target===event.currentTarget)close()}},
    React.createElement('form',{className:'dqp-dialog',role:'dialog','aria-modal':true,'aria-label':draft.id?'编辑快捷任务':'新增快捷任务',onSubmit:(event:React.FormEvent)=>{event.preventDefault();void save('save')},onKeyDown:(event:React.KeyboardEvent)=>{
      if(event.key!=='Tab')return
      const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('input,textarea,select,button:not(:disabled)'))
      const first=controls[0],last=controls[controls.length-1]
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
    }},
      React.createElement('h3',null,draft.id?'编辑快捷任务':'新增快捷任务'),
      React.createElement('label',null,'名称',React.createElement('input',{ref:nameInput,value:draft.name,maxLength:100,disabled:busy,placeholder:'例如：检查代码',onChange:(e:React.ChangeEvent<HTMLInputElement>)=>setDraft({...draft,name:e.target.value})}),React.createElement('small',null,'按钮最多显示 5 个字，悬停查看全名。')),
      React.createElement('label',null,'执行方式',React.createElement('select',{value:draft.mode??'chat',disabled:busy,onChange:(e:React.ChangeEvent<HTMLSelectElement>)=>setDraft({...draft,mode:e.target.value as Prompt['mode'],selection:undefined})},
        React.createElement('option',{value:'chat'},'当前对话'),React.createElement('option',{value:'agent'},'独立 Agent'),React.createElement('option',{value:'shell'},'终端命令'))),
      draft.mode==='agent'&&modelError?React.createElement('small',null,`模型列表暂不可用：${modelError}`):null,
      draft.mode==='agent'?React.createElement('label',null,'模型',React.createElement('select',{value:draft.selection?JSON.stringify([draft.selection.provider,draft.selection.model]):'',disabled:busy,onChange:(e:React.ChangeEvent<HTMLSelectElement>)=>{const route=e.target.value?JSON.parse(e.target.value):null;setDraft({...draft,selection:route?{provider:route[0],model:route[1]}:undefined})}},
        React.createElement('option',{value:''},'系统默认'),...catalog.groups.flatMap(group=>group.models.map(model=>React.createElement('option',{key:JSON.stringify([group.id,model.id]),value:JSON.stringify([group.id,model.id])},`${group.name} · ${model.name}`))))):null,
      draft.mode==='agent'&&draft.selection?React.createElement('label',null,'思考强度',React.createElement('select',{value:draft.selection.reasoningEffort??'',disabled:busy,onChange:(e:React.ChangeEvent<HTMLSelectElement>)=>setDraft({...draft,selection:{...draft.selection!,reasoningEffort:e.target.value||undefined}})},
        React.createElement('option',{value:''},'模型默认'),...(catalog.groups.find(g=>g.id===draft.selection?.provider)?.models.find(m=>m.id===draft.selection?.model)?.reasoning?.efforts??[]).map(e=>React.createElement('option',{key:e.id,value:e.id},e.name)))):null,
      React.createElement('label',null,draft.mode==='shell'?'Shell 命令':'提示词',React.createElement('textarea',{value:draft.text,maxLength:32000,disabled:busy,placeholder:'输入要发送的完整提示词…',onChange:(e:React.ChangeEvent<HTMLTextAreaElement>)=>setDraft({...draft,text:e.target.value})})),
      React.createElement('small',null,draft.mode==='agent'?'新建独立会话，仅使用当前目录和项目规则，不携带聊天历史；审批与结果在独立会话查看。':draft.mode==='shell'?'在当前工作目录执行，不经过 AI。每个目录同时运行一个快捷命令；输出面板可停止。':'发送到当前对话，沿用当前模型及上下文。'),
      error?React.createElement('p',{role:'alert'},error):null,
      React.createElement('footer',null,draft.id?React.createElement('button',{type:'button',className:'dqp-delete',disabled:busy,onClick:()=>{void save('delete')}},'删除'):null,React.createElement('button',{type:'button',disabled:busy,onClick:close},'取消'),React.createElement('button',{type:'submit',className:'dqp-save',disabled:busy||!draft.name.trim()||!draft.text.trim()},busy?'保存中…':'保存')))),document.body):null
  return React.createElement(React.Fragment,null,
    React.createElement('div',{className:'dqp-bar',role:'group','aria-label':'快捷任务'},
      React.createElement('button',{type:'button',className:'dqp-add','aria-label':'新增快捷任务',title:'新增快捷任务',disabled:busy,onClick:(e:React.MouseEvent<HTMLButtonElement>)=>open(e)},'+'),
      React.createElement('div',{className:'dqp-items'},...items.map(item=>React.createElement('span',{key:item.id,className:'dqp-task-chip'},React.createElement('button',{type:'button',disabled:busy||!sessionId||(item.mode==='agent'&&!!runs[item.id]&&(!!sessionsFor(ctx).binding(runs[item.id])?.session.getSnapshot().running||!!sessionsFor(ctx).binding(runs[item.id])?.session.getSnapshot().awaitingFirstTurn))||(item.mode==='shell'&&['running','stopping'].includes(output.status)),title:`${item.name} · ${{chat:'当前对话',agent:'独立 Agent',shell:'终端命令'}[item.mode??'chat']}\n点击执行 · 右键编辑`,onClick:()=>{void send(item)},onContextMenu:(e:React.MouseEvent<HTMLButtonElement>)=>{e.preventDefault();open(e,item)}},shortName(item.name)),React.createElement('button',{type:'button',className:'dqp-task-edit',disabled:busy,title:`编辑 ${item.name}`,'aria-label':`编辑快捷任务 ${item.name}`,onClick:(e:React.MouseEvent<HTMLButtonElement>)=>open(e,item)},
        React.createElement('svg',{width:12,height:12,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,'aria-hidden':true},React.createElement('path',{d:'M15 5l4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z'}))))))),
    (Object.keys(runs).length>0||output.status!=='idle')?React.createElement('div',{className:'dqp-task-status'},
      ...Object.entries(runs).map(([key,id])=>React.createElement('span',{key},
        React.createElement('button',{type:'button',onClick:()=>openSession(ctx,id)},`${shortName(items.find(i=>i.id===key)?.name??'任务')} · ${sessionsFor(ctx).binding(id)?.session.getSnapshot().running?'运行中':'查看结果/审批'}`),
        React.createElement('button',{type:'button',onClick:()=>{void sessionsFor(ctx).binding(id)?.session.cancel().then(r=>{if(!r.ok)setError(r.error?.message??'停止失败')}).catch(e=>setError(String(e)))}},'停止'))),
      output.status!=='idle'?React.createElement('button',{type:'button',onClick:()=>setPanel(true)},'终端任务日志'):null):null,
    panel?createPortal(React.createElement('div',{className:'dqp-backdrop',onClick:(e:React.MouseEvent)=>{if(e.target===e.currentTarget)setPanel(false)}},React.createElement('section',{className:'dqp-dialog',role:'dialog','aria-modal':true,'aria-label':'命令输出'},
      React.createElement('h3',null,`命令输出 · ${output.status}${output.exitCode==null?'':` · 退出码 ${output.exitCode}`}`),React.createElement('small',null,output.cwd),error?React.createElement('p',{role:'alert'},error):null,
      React.createElement('pre',{style:{whiteSpace:'pre-wrap',overflow:'auto',maxHeight:'50vh',minHeight:100}},output.output||'暂无输出'),
      React.createElement('footer',null,React.createElement('button',{disabled:!['running','stopping'].includes(output.status),onClick:()=>{void taskRequest('stop',{sessionId}).then(setOutput).catch(e=>setError(String(e)))}},'停止命令'),React.createElement('button',{onClick:()=>setPanel(false)},'关闭')))),document.body):null,
    error&&!draft?React.createElement('div',{className:'dqp-notice',role:'alert',title:error},error):null,modal)
}
