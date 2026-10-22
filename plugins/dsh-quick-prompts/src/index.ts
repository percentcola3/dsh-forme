import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { ProjectPrompts, projectOf } from './project-prompts.ts'
import { installRecovery } from './recovery.ts'
import { installAutoTitles } from './auto-title.ts'
import { TaskManager, type Parent, type Runtime } from './task-manager.ts'
import { HeadlessRuntime, type HeadlessAgents } from './headless-runtime.ts'
import { modelCatalog, requireAvailableModel, validateModel, type ModelRegistry } from './models.ts'
import type { AssistantFrame } from './live-output.ts'
import { join } from 'node:path'
import { homedir } from 'node:os'
export const name = 'dsh-quick-prompts'
export const inject = ['webServer', 'connection', 'sessions', 'agents']
export function validatePrompt(value: { name?: unknown; text?: unknown; model?: unknown }) {
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 100) throw new Error('名称不能为空，且不能超过 100 字。')
  if (typeof value.text !== 'string' || !value.text.trim() || value.text.length > 32000 || value.text.includes('\0')) throw new Error('任务内容不能为空，且不能超过 32,000 字。')
  const model = validateModel(value.model)
  return { name: value.name.trim(), text: value.text, ...model ? { model } : {} }
}
export function apply(ctx: Context, _config: unknown = {}, internals: { directory?: string; runtime?: Runtime } = {}): void {
  const recovery = installRecovery(ctx, internals.directory ?? join(homedir(), '.dsh'))
  ctx.inject(['llm', 'agentDefaultModel', 'sessionProjections', 'sessionTitle'], scope => { installAutoTitles(scope) })
  const runtime = internals.runtime ?? new HeadlessRuntime(ctx.get('agents') as HeadlessAgents)
  const manager = new TaskManager(runtime)
  const agents = ctx.get('agents') as { get(id: string): Parent | undefined }
  const host = ctx as unknown as { on(name: string, listener: (...args: any[]) => void, options: { global: boolean }): () => void }
  host.on('session/event', (session: { id: string }, event: { type: string; data: Record<string, any> }) => { try { manager.observe(session.id, event); if (runtime instanceof HeadlessRuntime) runtime.observe(session.id, event) } catch (error) { console.warn('dsh-quick-prompts: task observation failed', error) } }, { global: true })
  host.on('agent/assistant-stream', ({ agent, frame }: { agent: { session: { id: string } }; frame: AssistantFrame }) => { try { manager.stream(agent.session.id, frame) } catch (error) { console.warn('dsh-quick-prompts: stream observation failed', error) } }, { global: true })
  ctx.effect(() => () => manager.dispose())
  const store = new ProjectPrompts(internals.directory ?? join(homedir(), '.dsh'))
  const sessions = ctx.get('sessions') as { list(): { id?: string; cwd?: string; header?: { id: string; cwd?: string } }[] }
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
      if (typeof body.sessionId !== 'string' || !body.sessionId) throw new Error('请先打开有项目目录的主会话。')
      const parent = agents.get(body.sessionId)
      const session = parent?.session ?? sessions.list().find(item => (item.id ?? item.header?.id) === body.sessionId)
      const project = await projectOf(session && ('header' in session ? session.header?.cwd : session.cwd))
      if (body.projectId !== undefined && body.projectId !== project.id) throw new Error('项目已切换，请刷新后重试。')
      const scope = { projectId: project.id, cwd: project.cwd }
      if (body.action === 'runs') { send(res, 200, { ...scope, runs: manager.list(project.id), recovery: (await recovery.status()).find(row => row.sessionId === body.sessionId && (row.state === 'reserved' || row.state === 'failed')) ?? null }); return }
      if (body.action === 'models') { send(res, 200, { ...scope, models: await modelCatalog(ctx.get('llm') as ModelRegistry | undefined) }); return }
      if (body.action === 'start') {
        if (typeof body.requestId !== 'string' || !body.requestId || body.requestId.length > 100) throw new Error('任务请求编号无效。')
        const prompt = (await store.list(project)).prompts.find(item => item.id === body.id)
        if (!prompt) throw new Error('快捷任务不属于当前项目或已删除，请刷新。')
        if (!parent) throw new Error('主会话尚未就绪，请先打开会话，连接就绪后重试。')
        await requireAvailableModel(ctx.get('llm') as ModelRegistry | undefined, prompt.model)
        send(res, 202, { ...scope, run: manager.start(parent, prompt, body.requestId, project) }); return
      }
      if (body.action === 'reply') {
        const run = await manager.reply(body.runId, project.id, body.text, body.requestId)
        send(res, 202, { ...scope, run }); return
      }
      if (body.action === 'stop' || body.action === 'close') {
        if (body.action === 'close') manager.close(body.runId, project.id)
        else manager.stop(body.runId, project.id)
        send(res, 200, { ...scope, runs: manager.list(project.id), recovery: (await recovery.status()).find(row => row.sessionId === body.sessionId && (row.state === 'reserved' || row.state === 'failed')) ?? null }); return
      }
      if (body.action === 'list') { send(res, 200, { ...scope, ...await store.list(project) }); return }
      send(res, 200, { ...scope, ...await store.change(project, body.action, body, validatePrompt) })
    } catch (error) { send(res, 400, { error: error instanceof Error ? error.message : String(error) }) }
  } }))
}
