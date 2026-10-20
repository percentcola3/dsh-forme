import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { PromptStore } from './prompt-store.ts'
import { TaskManager, type Parent, type Runtime } from './task-manager.ts'
import type { Prompt } from './types.ts'
import type { AssistantFrame } from './live-output.ts'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'
export const name = 'dsh-quick-prompts'
export const inject = ['webServer', 'connection', 'sessions', 'agents', 'subagents']
export function validatePrompt(value: { name?: unknown; text?: unknown }) {
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 100) throw new Error('名称不能为空，且不能超过 100 字。')
  if (typeof value.text !== 'string' || !value.text.trim() || value.text.length > 32000 || value.text.includes('\0')) throw new Error('任务内容不能为空，且不能超过 32,000 字。')
  return { name: value.name.trim(), text: value.text }
}
export function apply(ctx: Context, _config: unknown = {}, internals: { directory?: string } = {}): void {
  const manager = new TaskManager(ctx.get('subagents') as Runtime)
  const agents = ctx.get('agents') as { get(id: string): Parent | undefined }
  const host = ctx as unknown as { on(name: string, listener: (...args: any[]) => void, options: { global: boolean }): () => void }
  host.on('session/event', (session: { id: string }, event: { type: string; data: Record<string, any> }) => { try { manager.observe(session.id, event) } catch (error) { console.warn('dsh-quick-prompts: task observation failed', error) } }, { global: true })
  host.on('agent/assistant-stream', ({ agent, frame }: { agent: { session: { id: string } }; frame: AssistantFrame }) => { try { manager.stream(agent.session.id, frame) } catch (error) { console.warn('dsh-quick-prompts: stream observation failed', error) } }, { global: true })
  ctx.effect(() => () => manager.dispose())
  const store = new PromptStore<Prompt>(join(internals.directory ?? join(homedir(), '.dsh'), 'quick-prompts.json'))
  const prompts = async () => (await store.read()).map(item => ({ id: item.id, ...validatePrompt(item) }))
  const server = ctx.get('webServer') as { register(route: { kind: string; path: string; handler(req: IncomingMessage, res: ServerResponse): Promise<void> }): () => void }
  const send = (res: ServerResponse, status: number, body: unknown) => { res.statusCode = status; res.setHeader('content-type', 'application/json; charset=utf-8'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(body)) }
  ctx.effect(() => server.register({ kind: 'exact', path: '/dsh-quick-prompts', handler: async (req, res) => {
    const fence = ctx.get('connection') as { requestRejection(req: { headers: IncomingMessage['headers'] }): number | undefined } | undefined
    const denied = fence?.requestRejection({ headers: req.headers })
    if (!fence || denied !== undefined) { send(res, denied ?? 403, { error: '访问被拒绝。' }); return }
    if (req.method !== 'POST' || String(req.headers['content-type']).split(';')[0]?.trim() !== 'application/json') { send(res, 400, { error: '需要 JSON POST 请求。' }); return }
    try {
      let size = 0; const chunks: Buffer[] = []
      for await (const chunk of req) { size += chunk.length; if (size > 160000) { send(res, 413, { error: '任务内容过长。' }); return } chunks.push(chunk) }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (body.action === 'runs') { send(res, 200, { runs: manager.list() }); return }
      if (body.action === 'start') {
        if (typeof body.sessionId !== 'string' || !body.sessionId || typeof body.requestId !== 'string' || !body.requestId || body.requestId.length > 100) throw new Error('请先打开主会话，再启动快捷任务。')
        const prompt = (await prompts()).find(item => item.id === body.id)
        if (!prompt) throw new Error('快捷任务已删除，请刷新。')
        const parent = agents.get(body.sessionId)
        if (!parent) throw new Error('主会话尚未就绪，请先打开会话，连接就绪后重试。')
        send(res, 202, { run: manager.start(parent, prompt, body.requestId) }); return
      }
      if (body.action === 'stop') { manager.stop(body.runId); send(res, 200, { runs: manager.list() }); return }
      if (body.action === 'list') { send(res, 200, { prompts: await prompts() }); return }
      const items = await store.update(items => {
        const index = items.findIndex(item => item.id === body.id)
        if (body.action === 'save') {
          const value = validatePrompt(body)
          if (body.id && index < 0) throw new Error('快捷任务已删除，请刷新。')
          if (index >= 0) items[index] = { id: body.id, ...value }
          else { if (items.length >= 100) throw new Error('最多保存 100 条快捷任务。'); items.push({ id: randomUUID(), ...value }) }
        } else if (body.action === 'delete') {
          if (index < 0) throw new Error('快捷任务不存在。')
          items.splice(index, 1)
        } else throw new Error('未知操作。')
      })
      send(res, 200, { prompts: items.map(item => ({ id: item.id, ...validatePrompt(item) })) })
    } catch (error) { send(res, 400, { error: error instanceof Error ? error.message : String(error) }) }
  } }))
}
