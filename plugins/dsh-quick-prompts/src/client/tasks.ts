import type { Context } from '@deepseek-ai/cordis'
export type Selection = {provider:string;model:string;reasoningEffort?:string}
export type Prompt = {id:string;name:string;text:string;mode?:'chat'|'agent'|'shell';selection?:Selection}
export type Catalog = {groups:{id:string;name:string;models:{id:string;name:string;reasoning?:{efforts:{id:string;name:string}[]}}[]}[]}
type Result = {ok:boolean;error?:{message:string}}
type Face = {subscribe(callback:()=>void):()=>void;rename(name:string):Promise<Result>;cancel():Promise<Result>;getSnapshot():{running:boolean;awaitingFirstTurn:boolean;lastAgentError?:string;promptError?:unknown}}
export type Sessions = {create(options:{cwd:string}):Promise<string>;open(id:string):void;scope(id:string):Context|undefined;binding(id:string):{session:Face}|undefined;list:{getSnapshot():{current?:string}}}
export const sessionsFor = (ctx:Pick<Context,'get'>) => ctx.get('sessions') as Sessions
export const modelsFor = (ctx:Pick<Context,'get'>) => ctx.get('modelDirectories') as {directoryFor(id:string):{load():Promise<Catalog>;select(value:Selection):Promise<void>}}|undefined
export async function taskRequest(action:string, value:Record<string,unknown> = {}) {
  const res = await fetch('/dsh-quick-prompts',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({action,...value})})
  const body = await res.json()
  if(!res.ok) throw new Error(body.error ?? '快捷任务操作失败。')
  return body
}
export async function startAgent(ctx:Pick<Context,'get'>, cwd:string, item:Prompt, created:(id:string)=>void):Promise<string> {
  const sessions=sessionsFor(ctx)
  const id=await sessions.create({cwd})
  created(id) // Keep the created session inspectable even if configuration fails.
  const binding=sessions.binding(id)
  if(!binding)throw new Error('独立会话尚未就绪。')
  const renamed=await binding.session.rename(`快捷任务 · ${item.name}`)
  if(!renamed.ok)throw new Error(renamed.error?.message ?? '会话命名失败')
  if(item.selection) {
    const models=modelsFor(ctx)
    if(!models)throw new Error('模型选择服务不可用。')
    await models.directoryFor(id).select(item.selection)
  }
  const conversation=sessions.scope(id)?.get('conversation') as {send(text:string):Promise<void>}|undefined
  if(!conversation)throw new Error('独立会话暂不可用。')
  await conversation.send(item.text)
  return id
}
