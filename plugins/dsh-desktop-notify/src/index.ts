import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { NativeNotices } from './native.ts'
import { TaskMonitor, type Notice, type Session, type Event } from './monitor.ts'
import { defaults, parsePreferences, type Preferences } from './preferences.ts'
export const name = 'dsh-desktop-notify'
export const inject = ['webServer', 'connection', 'sessions']
type Host = { on(name: string, callback: (...args: any[]) => void, options?: { global: boolean }): () => void }
type NativeBridge = Pick<NativeNotices, 'prepare' | 'show' | 'dismiss' | 'configure' | 'dispose' | 'status' | 'error'>
export async function apply(ctx: Context, _config: unknown = {}, internals: { directory?: string; native?: (onOpen: (id: string) => void) => NativeBridge } = {}): Promise<void> {
  const directory = internals.directory ?? join(homedir(), '.dsh')
  const file = join(directory, 'desktop-notify.json')
  let preferences: Preferences = { ...defaults }
  try { preferences = parsePreferences(JSON.parse(await readFile(file, 'utf8'))) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.warn('dsh-desktop-notify: invalid preferences; using defaults') }
  let disposed = false
  let writeQueue = Promise.resolve()
  let navigation: { sessionId: string; id: string; at: number } | undefined
  const active = new Map<string, { notice: Notice; timer?: ReturnType<typeof setTimeout> }>()
  const recent: (Notice & { at: number })[] = []
  const native = (internals.native ?? (onOpen => new NativeNotices(onOpen)))(id => {
    const notice = recent.find(item => item.id === id)
    if (notice) navigation = { id: randomUUID(), sessionId: notice.sessionId, at: Date.now() }
  })
  const allowed = (kind: Notice['kind']) => preferences.enabled && (kind === 'complete' ? preferences.completion : preferences.decisions)
  const dismiss = (id: string) => { const entry = active.get(id); clearTimeout(entry?.timer); active.delete(id); native.dismiss(id) }
  const show = (notice: Notice) => {
    if (!allowed(notice.kind) || disposed) return
    dismiss(notice.id)
    // Bound long-lived state independently of the number of completed tasks.
    if (active.size >= 100) dismiss(active.keys().next().value!)
    recent.unshift({ ...notice, at: Date.now() }); recent.splice(100)
    const entry = { notice, timer: undefined as ReturnType<typeof setTimeout> | undefined }
    active.set(notice.id, entry)
    entry.timer = setTimeout(() => {
      void native.prepare().then(async () => {
        if (disposed || active.get(notice.id) !== entry || !allowed(notice.kind)) return
        await native.show(notice, preferences)
        entry.timer = setTimeout(() => active.delete(notice.id), (preferences.duration + 2) * 1000)
      }).catch(error => console.warn('dsh-desktop-notify:', error instanceof Error ? error.message : String(error)))
    }, notice.kind === 'decision' ? 200 : 400)
  }
  const monitor = new TaskMonitor({ show, dismiss })
  const host = ctx as unknown as Host
  host.on('session/event', (session: Session, event: Event) => { try { monitor.observe(session, event) } catch (error) { console.warn('dsh-desktop-notify: event observer failed', error) } }, { global: true })
  host.on('session/disposed', (session: Session) => monitor.remove(session.id), { global: true })
  ctx.effect(() => {
    const stop = () => native.dispose()
    process.once('exit', stop)
    return () => { disposed = true; process.off('exit', stop); for (const id of active.keys()) dismiss(id); native.dispose() }
  })
  const server = ctx.get('webServer') as { register(route: { kind: string; path: string; handler(req: IncomingMessage, res: ServerResponse): Promise<void> }): () => void }
  const send = (res: ServerResponse, status: number, body: unknown) => { res.statusCode = status; res.setHeader('content-type', 'application/json; charset=utf-8'); res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(body)) }
  ctx.effect(() => server.register({ kind: 'exact', path: '/dsh-desktop-notify', handler: async (req, res) => {
    const fence = ctx.get('connection') as { requestRejection(req: { headers: IncomingMessage['headers'] }): number | undefined } | undefined
    const denied = fence?.requestRejection({ headers: req.headers })
    if (!fence || denied !== undefined) { send(res, denied ?? 403, { error: '访问被拒绝。' }); return }
    if (req.method !== 'POST' || String(req.headers['content-type']).split(';')[0].trim() !== 'application/json') { send(res, 400, { error: '需要 JSON POST 请求。' }); return }
    try {
      let size = 0; const chunks: Buffer[] = []
      for await (const chunk of req) { size += chunk.length; if (size > 16000) { send(res, 413, { error: '请求过长。' }); return } chunks.push(chunk) }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (body.action === 'update') {
        const next = parsePreferences({ ...preferences, ...body.preferences })
        const save = writeQueue.then(async () => {
          await mkdir(directory, { recursive: true, mode: 0o700 })
          const temporary = `${file}.${process.pid}.tmp`
          await writeFile(temporary, JSON.stringify(next, null, 2), { mode: 0o600 })
          await rename(temporary, file)
          preferences = next
          for (const [id, entry] of active) if (!allowed(entry.notice.kind)) dismiss(id)
          native.configure(preferences)
        })
        writeQueue = save.catch(() => {})
        await save
      } else if (body.action === 'test') {
        if (!preferences.enabled) throw new Error('请先开启桌面提醒。')
        await native.prepare()
        const notice: Notice = { id: `preview:${randomUUID()}`, sessionId: '', kind: body.kind === 'decision' ? 'decision' : 'complete', title: '提醒测试', body: body.kind === 'decision' ? '任务需要你的选择。真实请求处理后，此提醒会自动收起。' : '任务已完成。DSH 在后台运行时，也会在这里提醒。' }
        await native.show(notice, preferences)
      } else if (body.action === 'prepare') await native.prepare()
      else if (body.action === 'poll') {
        // Consume only in the desktop window, after it has regained focus.
        const open = body.desktop === true && body.focused === true && navigation && Date.now() - navigation.at < 60000 ? navigation : undefined
        send(res, 200, { open }); return
      } else if (body.action === 'ack') { if (body.id === navigation?.id) navigation = undefined }
      else if (body.action !== 'get') throw new Error('未知操作。')
      send(res, 200, { preferences, native: { status: native.status, error: native.error, platform: process.platform }, recent: recent.slice(0, 12) })
    } catch (error) { send(res, 400, { error: error instanceof Error ? error.message : String(error) }) }
  } }))
}
