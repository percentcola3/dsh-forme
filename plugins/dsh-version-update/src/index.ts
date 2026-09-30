import { installPerformanceLog } from './performance-log.ts'
import { spawn } from 'node:child_process'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { probeInstall, type InstallMode } from './probe.ts'

export const name = 'dsh-version-update'
export const inject = ['webServer']

export interface Config {
  checkIntervalMs: number
  timeoutMs: number
  registry: string
}

export const Config: Schema<Config> = Schema.object({
  checkIntervalMs: Schema.number().default(21_600_000),
  timeoutMs: Schema.number().default(5_000),
  registry: Schema.string().default('https://registry.npmjs.org'),
})

interface CheckState {
  state: 'checking' | 'up-to-date' | 'update-available' | 'error' | 'unknown' | 'source'
  current: string | null
  latest: string | null
  mode: InstallMode
  hint: string
  error: string | null
  fetchedAt: number | null
}

interface ConnectionFence {
  requestRejection(request: { readonly headers: IncomingMessage['headers'] }): 401 | 403 | undefined
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

function rejected(ctx: Context, req: IncomingMessage, res: ServerResponse): boolean {
  const connection = ctx.get('connection') as ConnectionFence | undefined
  const code = connection?.requestRejection({ headers: req.headers })
  if (code === undefined) return false
  res.statusCode = code
  res.end()
  return true
}

function webArgs(): string[] {
  const rest = process.argv.slice(2)
  return rest[0] === 'web' ? rest : ['web', ...rest]
}

function relaunchLatest(): void {
  const child = spawn('npx', ['--yes', '@deepseek-ai/dsh@latest', ...webArgs()], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: process.env,
  })
  child.unref()
}

async function fetchLatest(registry: string, timeoutMs: number): Promise<string> {
  const url = `${registry.replace(/\/$/, '')}/@deepseek-ai/dsh/latest`
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ac.signal, headers: { accept: 'application/json' } })
    if (!res.ok) throw new Error(`registry ${res.status}`)
    const body = await res.json() as { version?: string }
    if (!body.version) throw new Error('registry payload missing version')
    return body.version
  } finally {
    clearTimeout(timer)
  }
}

export function apply(ctx: Context, config: Config): void {
  installPerformanceLog(ctx)
  const webServer = Reflect.get(ctx, 'webServer') as {
    register: (route: { kind: string; path: string; handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void> }) => () => void
  }
  let cached: CheckState = {
    state: 'checking',
    current: null,
    latest: null,
    mode: 'unknown',
    hint: '',
    error: null,
    fetchedAt: null,
  }
  let updating = false

  const refresh = async (): Promise<CheckState> => {
    const probe = probeInstall()
    if (probe.mode === 'source') {
      cached = {
        state: 'source',
        current: probe.current,
        latest: null,
        mode: 'source',
        hint: probe.hint,
        error: null,
        fetchedAt: Date.now(),
      }
      return cached
    }
    if (!probe.current) {
      cached = {
        state: 'unknown',
        current: null,
        latest: null,
        mode: probe.mode,
        hint: probe.hint,
        error: null,
        fetchedAt: Date.now(),
      }
      return cached
    }
    try {
      const latest = await fetchLatest(config.registry, config.timeoutMs)
      cached = {
        state: latest === probe.current ? 'up-to-date' : 'update-available',
        current: probe.current,
        latest,
        mode: probe.mode,
        hint: probe.hint,
        error: null,
        fetchedAt: Date.now(),
      }
    } catch (error) {
      cached = {
        state: 'error',
        current: probe.current,
        latest: cached.latest,
        mode: probe.mode,
        hint: probe.hint,
        error: error instanceof Error ? error.message : String(error),
        fetchedAt: Date.now(),
      }
    }
    return cached
  }

  ctx.effect(() => {
    void refresh()
    const timer = setInterval(() => { void refresh() }, config.checkIntervalMs)
    return () => clearInterval(timer)
  })

  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-version-update/check',
    handler: async (req, res) => {
      if (rejected(ctx, req, res)) return
      if (req.method !== 'GET') {
        res.statusCode = 405
        res.setHeader('allow', 'GET')
        res.end()
        return
      }
      const url = new URL(String(req.url), 'http://localhost')
      if (url.searchParams.get('force') === '1') await refresh()
      sendJson(res, 200, cached)
    },
  }))

  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/dsh-version-update/update',
    handler: async (req, res) => {
      if (rejected(ctx, req, res)) return
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.setHeader('allow', 'POST')
        res.end()
        return
      }
      if (updating) {
        sendJson(res, 409, { error: 'update already running' })
        return
      }
      const snapshot = cached.state === 'update-available' ? cached : await refresh()
      if (snapshot.mode === 'source') {
        sendJson(res, 400, { error: snapshot.hint })
        return
      }
      if (snapshot.state !== 'update-available') {
        sendJson(res, 400, { error: 'no npm update is available' })
        return
      }
      updating = true
      try {
        if (snapshot.mode === 'global') {
          await new Promise<void>((resolvePromise, reject) => {
            const child = spawn('npm', ['install', '-g', '@deepseek-ai/dsh@latest'], {
              stdio: ['ignore', 'pipe', 'pipe'],
              windowsHide: true,
            })
            let stderr = ''
            child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
            child.on('error', reject)
            child.on('exit', (code) => {
              if (code === 0) resolvePromise()
              else reject(new Error(stderr.trim() || `npm exited ${String(code)}`))
            })
          })
        }
        relaunchLatest()
        sendJson(res, 200, { ok: true, restart: true, hint: '正在下载最新版本并重启。' })
        setTimeout(() => process.exit(0), 500)
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
        updating = false
      }
    },
  }))
}
