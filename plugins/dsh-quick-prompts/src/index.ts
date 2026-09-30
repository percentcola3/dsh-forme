import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { ProjectRunner } from './runner.ts'
import { realpath } from 'node:fs/promises'
import { PromptStore } from './prompt-store.ts'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'
export const name = 'dsh-quick-prompts'
export const inject = ['webServer', 'connection', 'sessions']
type Prompt = { id: string; name: string; text: string; mode?: string; selection?: {provider:string;model:string;reasoningEffort?:string} }
export function validatePrompt(value: { name?: unknown; text?: unknown; mode?: unknown; selection?: unknown }) {
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 100) throw new Error('名称不能为空，且不能超过 100 字。')
  if (typeof value.text !== 'string' || !value.text.trim() || value.text.length > 32_000) throw new Error('提示词不能为空，且不能超过 32,000 字。')
  const mode = value.mode ?? 'chat'
  if (!['chat','agent','shell'].includes(String(mode))) throw new Error('执行方式无效。')
  if (mode === 'shell' && (value.text.length > 16000 || value.text.includes('\0'))) throw new Error('Shell 命令无效或过长。')
  let selection: Prompt['selection']
  if (mode === 'agent' && value.selection !== undefined) {
    const item = value.selection as Record<string, unknown>
    if (!item || typeof item.provider !== 'string' || !item.provider || typeof item.model !== 'string' || !item.model || item.provider.length > 200 || item.model.length > 200) throw new Error('模型配置无效。')
    if (item.reasoningEffort !== undefined && (typeof item.reasoningEffort !== 'string' || item.reasoningEffort.length > 100)) throw new Error('思考强度无效。')
    selection = {provider:item.provider,model:item.model,...item.reasoningEffort === undefined ? {} : {reasoningEffort:item.reasoningEffort as string}}
  }
  return { name: value.name.trim(), text: value.text, ...(value.mode === undefined ? {} : {mode:String(mode)}), ...selection ? {selection} : {} }
}
export function apply(ctx: Context): void {
  const runner = new ProjectRunner()
  const cwdFor = async (id: unknown) => {
    if (typeof id !== 'string' || !id) throw new Error('请先选择会话。')
    const sessions = ctx.get('sessions') as {list(): {id?:string;header:{id:string;cwd?:string}}[]}
    const live = sessions.list().find(s => (s.id ?? s.header.id) === id)?.header
    const persistence = ctx.get('sessionPersistence') as {stat(id:string):Promise<{header:{id:string;cwd?:string}}|undefined>}|undefined
    const header = live ?? (await persistence?.stat(id))?.header
    if (!header || header.id !== id || !header.cwd) throw new Error('会话没有有效工作目录。')
    return realpath(header.cwd)
  }
  ctx.effect(() => {
    const cleanup = () => runner.killAll()
    process.on('exit',cleanup); process.on('SIGTERM',cleanup); process.on('SIGINT',cleanup)
    return async () => { await runner.dispose(); process.off('exit',cleanup);process.off('SIGTERM',cleanup);process.off('SIGINT',cleanup) }
  })
  const server = ctx.get('webServer') as { register(route: {kind: string; path: string; handler(req: IncomingMessage, res: ServerResponse): Promise<void>}): () => void }
  const directory = join(homedir(), '.dsh')
  const file = join(directory, 'quick-prompts.json')
  const store = new PromptStore<Prompt>(file)
  const send = (res: ServerResponse, status: number, body: unknown) => { res.statusCode = status; res.setHeader('content-type','application/json; charset=utf-8'); res.setHeader('cache-control','no-store'); res.end(JSON.stringify(body)) }
  ctx.effect(() => server.register({kind:'exact',path:'/dsh-quick-prompts',handler: async (req,res) => {
    const fence = ctx.get('connection') as {requestRejection(req: {headers: IncomingMessage['headers']}): number | undefined} | undefined
    const denied = fence?.requestRejection({headers:req.headers})
    if (!fence || denied !== undefined) { send(res,denied ?? 403,{error:'访问被拒绝。'}); return }
    if (req.method !== 'POST' || String(req.headers['content-type']).split(';')[0]?.trim() !== 'application/json') { send(res,400,{error:'需要 JSON POST 请求。'}); return }
    try {
      let size = 0; const chunks: Buffer[] = []
      for await (const chunk of req) { size += chunk.length; if (size > 160_000) { send(res,413,{error:'提示词过长。'}); return } chunks.push(chunk) }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))

      if (['workspace','run','status','stop'].includes(body.action)) {
        const cwd = await cwdFor(body.sessionId)
        if (body.action === 'workspace') { send(res,200,{cwd}); return }
        if (body.action === 'run') {
          const prompt = (await store.read()).find(p => p.id === body.id)
          if (!prompt || prompt.mode !== 'shell') throw new Error('终端任务不存在。')
          runner.start(cwd,prompt.text)
        }
        if (body.action === 'stop') await runner.stop(cwd)
        const state=runner.snapshot(cwd) ?? {status:'idle',output:'',exitCode:null}
        send(res,200,{cwd,...state,...body.includeOutput===false?{output:''}:{}});return
      }
      const prompts = body.action === 'list' ? await store.read() : await store.update(prompts=>{
        const index = prompts.findIndex(prompt => prompt.id === body.id)
        if (body.action === 'save') {
          const value = validatePrompt(body)
          if (body.id && index < 0) throw new Error('提示词已删除，请刷新。')
          if (index >= 0) prompts[index] = {id:body.id,...value}
          else { if (prompts.length >= 100) throw new Error('最多保存 100 条提示词。'); prompts.push({id:randomUUID(),...value}) }
        } else if (body.action === 'delete') {
          if (index < 0) throw new Error('提示词不存在。')
          prompts.splice(index,1)
        } else throw new Error('未知操作。')
      })
      send(res,200,{prompts})
    } catch (error) { send(res,400,{error:error instanceof Error ? error.message : String(error)}) }
  }}))
}
