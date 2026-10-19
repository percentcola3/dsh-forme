import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { realpathSync } from 'node:fs'
import { SessionTerminals } from './terminal.ts'
export const name = 'dsh-terminal'
export const inject = ['webServer', 'sessions', 'connection']
const json = (res: ServerResponse, code: number, value: unknown) => {
  res.statusCode = code; res.setHeader('content-type', 'application/json; charset=utf-8'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(value))
}
export async function sessionCwd(ctx: Pick<Context, 'get'>, sessionId: unknown): Promise<string> {
  if (typeof sessionId !== 'string' || !sessionId) throw new Error('请先打开任务对话。')
  const sessions = ctx.get('sessions') as { list(): { id?: string; cwd?: string; header?: { id?: string; cwd?: string } }[] }
  const session = sessions.list().find(item => (item.id ?? item.header?.id) === sessionId)
  const persistence = ctx.get('sessionPersistence') as { stat(id: string): Promise<{ header: { id: string; cwd?: string } } | undefined> } | undefined
  const stored = session ? undefined : await persistence?.stat(sessionId)
  if (stored && stored.header.id !== sessionId) throw new Error('会话信息不匹配。')
  const cwd = session?.header?.cwd ?? session?.cwd ?? stored?.header.cwd
  if (!cwd) throw new Error('会话没有有效的工作目录。')
  return realpathSync(cwd)
}
export function apply(ctx: Context): void {
  const terminals = new SessionTerminals()
  const server = ctx.get('webServer') as { register(route: { kind: string; path: string; handler(req: IncomingMessage, res: ServerResponse): Promise<void> }): () => void }
  ctx.effect(() => server.register({ kind: 'exact', path: '/dsh-terminal', handler: async (req, res) => {
    const connection = ctx.get('connection') as { requestRejection(req: { headers: IncomingMessage['headers'] }): number | undefined } | undefined
    const denied = connection?.requestRejection({ headers: req.headers })
    if (!connection || denied !== undefined) { json(res, denied ?? 403, { error: '访问被拒绝。' }); return }
    if (req.method !== 'POST') { json(res, 405, { error: 'POST required' }); return }
    if (String(req.headers['content-type']).split(';')[0]?.trim() !== 'application/json') { json(res, 415, { error: 'JSON required' }); return }
    try {
      let size = 0; const chunks: Buffer[] = []
      for await (const chunk of req) { size += chunk.length; if (size > 32_768) { json(res, 413, { error: '请求过大。' }); return } chunks.push(chunk) }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      // Never accept a browser-supplied cwd. Scope each PTY to its persisted session.
      const cwd = await sessionCwd(ctx, body.sessionId)
      const key = JSON.stringify([body.sessionId, cwd])
      const dimension = (value: unknown, max: number) => {
        if (!Number.isInteger(value) || (value as number) < 2 || (value as number) > max) throw new Error('终端尺寸无效。')
        return value as number
      }
      if (body.action === 'open') {
        json(res, 200, terminals.open(key, cwd, dimension(body.cols, 500), dimension(body.rows, 300))); return
      }
      if (typeof body.id !== 'string') throw new Error('终端标识无效。')
      switch (body.action) {
        case 'read':
          if (!Number.isSafeInteger(body.cursor) || body.cursor < 0) throw new Error('终端位置无效。')
          json(res, 200, terminals.read(key, body.id, body.cursor)); return
        case 'write':
          if (typeof body.data !== 'string' || body.data.length > 8192) throw new Error('终端输入过长。')
          terminals.write(key, body.id, body.data); break
        case 'resize': terminals.resize(key, body.id, dimension(body.cols, 500), dimension(body.rows, 300)); break
        case 'close': terminals.close(key, body.id); break
        default: throw new Error('未知终端操作。')
      }
      json(res, 200, {})
    } catch (error) { json(res, 400, { error: error instanceof Error ? error.message : String(error) }) }
  } }))
  ctx.effect(() => {
    const onExit = () => terminals.dispose()
    const onTerm = () => { terminals.dispose(); if (process.listenerCount('SIGTERM') === 1) process.exit(143) }
    const onInt = () => { terminals.dispose(); if (process.listenerCount('SIGINT') === 1) process.exit(130) }
    process.on('exit', onExit); process.on('SIGTERM', onTerm); process.on('SIGINT', onInt)
    return () => {
      terminals.dispose()
      process.off('exit', onExit); process.off('SIGTERM', onTerm); process.off('SIGINT', onInt)
    }
  })
}
