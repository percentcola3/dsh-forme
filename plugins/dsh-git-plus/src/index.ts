import { isAbsolute } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { createGitRunner } from './git.ts'
import { readStatus, readDiff, sessionOwnsCwd } from './repository.ts'
import { drainSummary } from './summary.ts'

export const name = 'dsh-git-plus'
export const inject = ['webServer', 'connection', 'sessions']

export interface Config {
  gitExecutable?: string
  gitExecPath?: string
  provider: string
  model: string
  prompt: string
}

export const Config: Schema<Config> = Schema.object({
  gitExecutable: Schema.string().default('').description('Git executable path. Empty uses git from the host PATH.'),
  gitExecPath: Schema.string().default('').description('Optional Git helper directory (GIT_EXEC_PATH), for portable Git distributions.'),
  provider: Schema.string().default(''),
  model: Schema.string().default(''),
  prompt: Schema.string().default(
    'Write a concise Conventional Commits message for the git diff below. Reply with the message only.',
  ),
})

interface ConnectionFence {
  requestRejection(request: { readonly headers: IncomingMessage['headers'] }): 401 | 403 | undefined
}

const MAX_BODY_BYTES = 256 * 1024

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

async function readBody(req: IncomingMessage): Promise<string | null> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.byteLength
    if (size > MAX_BODY_BYTES) {
      req.resume()
      return null
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks, size).toString('utf8')
}

function rejected(ctx: Context, req: IncomingMessage, res: ServerResponse): boolean {
  const connection = ctx.get('connection') as ConnectionFence | undefined
  const code = connection?.requestRejection({ headers: req.headers })
  if (connection && code === undefined) return false
  res.statusCode = code ?? 403
  res.end()
  return true
}

async function parseJsonBody(req: IncomingMessage, res: ServerResponse): Promise<Record<string, unknown> | null> {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.setHeader('allow', 'POST')
    res.end()
    return null
  }
  const essence = String(req.headers['content-type']).split(';', 1)[0]?.trim().toLowerCase()
  if (essence !== 'application/json') {
    sendJson(res, 415, { error: 'content-type must be application/json' })
    return null
  }
  const text = await readBody(req)
  if (text === null) {
    sendJson(res, 413, { error: 'payload too large' })
    return null
  }
  try {
    const value = JSON.parse(text) as unknown
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      sendJson(res, 400, { error: 'body must be a JSON object' })
      return null
    }
    return value as Record<string, unknown>
  } catch {
    sendJson(res, 400, { error: 'invalid JSON' })
    return null
  }
}

function isSafeRef(name: string): boolean {
  return name.length > 0
    && name.length < 200
    && !name.startsWith('-')
    && !name.includes('..')
    && !name.includes('\\')
    && /^[A-Za-z0-9][A-Za-z0-9._/\-]*$/.test(name)
}

function parseLocalBranches(stdout: string): Array<{ name: string; current: boolean }> {
  const branches: Array<{ name: string; current: boolean }> = []
  for (const line of stdout.split('\n')) {
    if (!line) continue
    const [name, head] = line.split('\t')
    if (!name || !isSafeRef(name)) continue
    branches.push({ name, current: head === '*' })
  }
  return branches
}

async function readWorkspace(
  ctx: Context,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<{ sessionId: string; cwd: string; body: Record<string, unknown> } | null> {
  const body = await parseJsonBody(req, res)
  if (!body) return null
  const sessionId = String(body.sessionId ?? '')
  const cwd = String(body.cwd ?? '')
  if (!sessionId || !cwd || !isAbsolute(cwd)) {
    sendJson(res, 400, { error: 'sessionId and absolute cwd are required' })
    return null
  }
  if (!await sessionOwnsCwd(ctx, sessionId, cwd)) {
    sendJson(res, 403, { error: 'cwd is not owned by the live session' })
    return null
  }
  return { sessionId, cwd, body }
}

export function apply(ctx: Context, config: Config): void {
  const git = createGitRunner(config)
  const webServer = Reflect.get(ctx, 'webServer') as {
    register: (route: { kind: string; path: string; handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void> }) => () => void
  }
  const register = (path: string, handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>): void => {
    ctx.effect(() => webServer.register({
      kind: 'exact',
      path,
      handler: async (req, res) => {
        if (rejected(ctx, req, res)) return
        try {
          await handler(req, res)
        } catch (error) {
          sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    }))
  }

  register('/dsh-git-plus/status', async (req, res) => {
    const body = await parseJsonBody(req, res)
    if (!body) return
    const sessionId = String(body.sessionId ?? '')
    const cwd = String(body.cwd ?? '')
    if (!sessionId || !cwd || !isAbsolute(cwd)) {
      sendJson(res, 400, { error: 'sessionId and absolute cwd are required' })
      return
    }
    if (!await sessionOwnsCwd(ctx, sessionId, cwd)) {
      sendJson(res, 403, { error: 'cwd is not owned by the live session' })
      return
    }
    const inside = await git(cwd, ['rev-parse', '--is-inside-work-tree'])
    if (inside.code !== 0 || inside.stdout.trim() !== 'true') {
      sendJson(res, 200, { ok: false, error: inside.stderr.trim() || 'not a git repository' })
      return
    }
    sendJson(res, 200, { ok: true, ...await readStatus(git, cwd) })
  })

  register('/dsh-git-plus/diff', async (req, res) => {
    const loc = await readWorkspace(ctx, req, res)
    if (!loc) return
    if (typeof loc.body.path !== 'string') { sendJson(res, 400, {error:'需要文件路径'}); return }
    sendJson(res, 200, { ok: true, diff: await readDiff(git, loc.cwd, loc.body.path) })
  })

  register('/dsh-git-plus/branches', async (req, res) => {
    const loc = await readWorkspace(ctx, req, res)
    if (!loc) return
    const listed = await git(loc.cwd, [
      'for-each-ref',
      '--sort=-committerdate',
      '--format=%(refname:short)%09%(HEAD)',
      'refs/heads',
    ])
    if (listed.code !== 0) {
      sendJson(res, 200, { ok: false, error: listed.stderr.trim() || 'unable to list branches' })
      return
    }
    sendJson(res, 200, { ok: true, branches: parseLocalBranches(listed.stdout) })
  })

  register('/dsh-git-plus/switch', async (req, res) => {
    const loc = await readWorkspace(ctx, req, res)
    if (!loc) return
    const branch = String(loc.body.branch ?? '')
    if (!isSafeRef(branch)) {
      sendJson(res, 400, { error: 'invalid branch name' })
      return
    }
    const switched = await git(loc.cwd, ['switch', '--', branch])
    if (switched.code !== 0) {
      sendJson(res, 200, {
        ok: false,
        error: (switched.stderr || switched.stdout).trim() || `unable to switch to ${branch}`,
      })
      return
    }
    sendJson(res, 200, { ok: true, branch })
  })

  register('/dsh-git-plus/summarize', async (req, res) => {
    const body = await parseJsonBody(req, res)
    if (!body) return
    const sessionId = String(body.sessionId ?? '')
    const cwd = String(body.cwd ?? '')
    if (!sessionId || !cwd || !isAbsolute(cwd)) {
      sendJson(res, 400, { error: 'sessionId and absolute cwd are required' })
      return
    }
    if (!await sessionOwnsCwd(ctx, sessionId, cwd)) {
      sendJson(res, 403, { error: 'cwd is not owned by the live session' })
      return
    }
    const status = await readStatus(git, cwd)
    const parts: string[] = []
    let size = 0
    for (const file of status.files) {
      const diff = await readDiff(git, cwd, file.path)
      parts.push(diff)
      size += diff.length
      if (size >= 80_000) break
    }
    const message = await drainSummary(ctx, config, parts.join('\n'), sessionId)
    sendJson(res, 200, { ok: true, message })
  })
}
