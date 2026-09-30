import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { realpathSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { createHash } from 'node:crypto'
import { ProjectTerminals } from './terminal.ts'
import { ProjectRunner } from './runner.ts'
export const name = 'dsh-project-run'
export const inject = ['webServer', 'sessions', 'connection']
const json = (res: ServerResponse, code: number, value: unknown) => {
  res.statusCode = code; res.setHeader('content-type', 'application/json; charset=utf-8'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(value))
}
export async function projectCwd(ctx: Pick<Context, 'get'>, sessionId: unknown): Promise<string> {
  if (typeof sessionId !== 'string' || !sessionId) throw new Error('请先打开项目会话。')
  const sessions = ctx.get('sessions') as { list(): { id?: string; cwd?: string; header?: { id?: string; cwd?: string } }[] }
  const session = sessions.list().find(item => (item.id ?? item.header?.id) === sessionId)
  // History sessions need not be loaded as live agents merely to run a project.
  // Match the official workspace-files lookup: live header, then persisted stat.
  const persistence = ctx.get('sessionPersistence') as { stat(id: string): Promise<{ header: { id: string; cwd?: string } } | undefined> } | undefined
  const stored = session ? undefined : await persistence?.stat(sessionId)
  if (stored && stored.header.id !== sessionId) throw new Error('会话信息不匹配。')
  const cwd = session?.header?.cwd ?? session?.cwd ?? stored?.header.cwd
  if (!cwd) throw new Error('会话没有有效的工作目录。')
  return realpathSync(cwd)
}
export function apply(ctx: Context): void {
  const runner = new ProjectRunner()
  const terminals = new ProjectTerminals()
  const server = ctx.get('webServer') as { register(route: { kind: string; path: string; handler(req: IncomingMessage, res: ServerResponse): Promise<void> }): () => void }
  const configDir = join(homedir(), '.dsh', 'project-run')
  const configFile = (cwd: string) => join(configDir, createHash('sha256').update(cwd).digest('hex') + '.json')
  const readCommand = (cwd: string): string => {
    try { return String(JSON.parse(readFileSync(configFile(cwd), 'utf8')).command ?? '') } catch (err) { if ((err as NodeJS.ErrnoException).code === 'ENOENT') return ''; throw err }
  }
  const snapshot = (cwd: string) => ({ cwd, savedCommand: readCommand(cwd), ...(runner.snapshot(cwd) ?? { status: 'idle', command: '', output: '', exitCode: null, truncated: false }) })
  ctx.effect(() => server.register({ kind: 'exact', path: '/dsh-project-run', handler: async (req, res) => {
    const connection = ctx.get('connection') as { requestRejection(req: { headers: IncomingMessage['headers'] }): number | undefined } | undefined
    const denied = connection?.requestRejection({ headers: req.headers })
    if (!connection || denied !== undefined) { json(res, denied ?? 403, { error: '访问被拒绝。' }); return }
    if (req.method !== 'POST') { json(res, 405, { error: 'POST required' }); return }
    if (String(req.headers['content-type']).split(';')[0]?.trim() !== 'application/json') { json(res, 415, { error: 'JSON required' }); return }
    try {
      let size = 0; const chunks: Buffer[] = []
      for await (const chunk of req) { size += chunk.length; if (size > 32_768) { json(res, 413, { error: '请求过大。' }); return } chunks.push(chunk) }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      const cwd = await projectCwd(ctx, body.sessionId)
      if (typeof body.action === 'string' && body.action.startsWith('terminal/')) {
        const key = JSON.stringify([body.sessionId, cwd])
        const dimension = (value: unknown, max: number) => {
          if (!Number.isInteger(value) || (value as number) < 2 || (value as number) > max) throw new Error('终端尺寸无效。')
          return value as number
        }
        if (body.action === 'terminal/open') {
          json(res, 200, terminals.open(key, cwd, dimension(body.cols, 500), dimension(body.rows, 300))); return
        }
        if (typeof body.id !== 'string') throw new Error('终端标识无效。')
        switch (body.action) {
          case 'terminal/read':
            if (!Number.isSafeInteger(body.cursor) || body.cursor < 0) throw new Error('终端位置无效。')
            json(res, 200, terminals.read(key, body.id, body.cursor)); return
          case 'terminal/write':
            if (typeof body.data !== 'string' || body.data.length > 8192) throw new Error('终端输入过长。')
            terminals.write(key, body.id, body.data); break
          case 'terminal/resize': terminals.resize(key, body.id, dimension(body.cols, 500), dimension(body.rows, 300)); break
          case 'terminal/close': terminals.close(key, body.id); break
          default: throw new Error('未知终端操作。')
        }
        json(res, 200, {}); return
      }
      switch (body.action) {
        case 'status': break
        case 'save': {
          if (typeof body.command !== 'string' || body.command.length > 16_000 || body.command.includes('\0')) throw new Error('启动命令无效。')
          mkdirSync(configDir, { recursive: true, mode: 0o700 })
          const file = configFile(cwd)
          writeFileSync(file + '.tmp', JSON.stringify({ command: body.command }), { mode: 0o600 })
          renameSync(file + '.tmp', file)
          break
        }
        case 'start': runner.start(cwd, readCommand(cwd)); break
        case 'stop': await runner.stop(cwd); break
        case 'restart': await runner.restart(cwd, readCommand(cwd)); break
        default: throw new Error('未知操作。')
      }
      const result = snapshot(cwd)
      json(res, 200, body.includeOutput === false ? { ...result, output: '' } : result)
    } catch (error) { json(res, 400, { error: error instanceof Error ? error.message : String(error) }) }
  } }))
  ctx.effect(() => {
    const onExit = () => { terminals.dispose(); runner.killAll() }
    const onTerm = () => { terminals.dispose(); runner.killAll(); if (process.listenerCount('SIGTERM') === 1) process.exit(143) }
    const onInt = () => { terminals.dispose(); runner.killAll(); if (process.listenerCount('SIGINT') === 1) process.exit(130) }
    process.on('exit', onExit); process.on('SIGTERM', onTerm); process.on('SIGINT', onInt)
    return async () => {
      terminals.dispose()
      await runner.dispose()
      process.off('exit', onExit); process.off('SIGTERM', onTerm); process.off('SIGINT', onInt)
    }
  })
}
