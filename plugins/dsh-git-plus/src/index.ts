import { isAbsolute } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { createGitRunner } from './git.ts'
import { parseStatus, readStatus, readDiff, sessionOwnsCwd } from './repository.ts'
import { listBranches, switchBranch } from './branches.ts'
import { createRepositoryDiscovery, resolveRepository } from './repositories.ts'
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
  const discoverRepositories = createRepositoryDiscovery(git)
  const selectedRepository = async (loc: { cwd: string; body: Record<string, unknown> }, res: ServerResponse) => {
    // Missing selection preserves the original root route behavior.
    if (loc.body.repositoryPath === undefined) return loc.cwd
    try { return await resolveRepository(git, loc.cwd, loc.body.repositoryPath) }
    catch (error) {
      sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
      return null
    }
  }
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
    // One git spawn answers the whole summary; slow-security machines pay once.
    const summary = await git(cwd, ['status', '--porcelain=v1', '-z', '-b', '--untracked-files=all'])
    if (summary.code !== 0) {
      sendJson(res, 200, { ok: false, error: summary.stderr.trim() || 'not a git repository' })
      return
    }
    sendJson(res, 200, { ok: true, ...parseStatus(summary.stdout), countsPending: true })
  })

  register('/dsh-git-plus/counts', async (req, res) => {
    const loc = await readWorkspace(ctx, req, res)
    if (!loc) return
    if (!loc.body || typeof loc.body !== 'object' || typeof (loc.body as { cwd?: unknown }).cwd !== 'string') { sendJson(res, 400, {error:'需要工作目录'}); return }
    sendJson(res, 200, { ok: true, ...await readStatus(git, (loc.body as { cwd: string }).cwd) })
  })

  register('/dsh-git-plus/diff', async (req, res) => {
    const loc = await readWorkspace(ctx, req, res)
    if (!loc) return
    if (typeof loc.body.path !== 'string') { sendJson(res, 400, {error:'需要文件路径'}); return }
    sendJson(res, 200, { ok: true, diff: await readDiff(git, loc.cwd, loc.body.path) })
  })

  register('/dsh-git-plus/repositories', async (req, res) => {
    const loc = await readWorkspace(ctx, req, res)
    if (!loc) return
    if (loc.body.refresh !== undefined && typeof loc.body.refresh !== 'boolean') {
      sendJson(res, 400, { ok: false, error: 'refresh must be a boolean' })
      return
    }
    sendJson(res, 200, await discoverRepositories(loc.cwd, loc.body.refresh === true))
  })

  register('/dsh-git-plus/branches', async (req, res) => {
    const loc = await readWorkspace(ctx, req, res)
    if (!loc) return
    const cwd = await selectedRepository(loc, res)
    if (!cwd) return
    sendJson(res, 200, await listBranches(git, cwd))
  })

  register('/dsh-git-plus/switch', async (req, res) => {
    const loc = await readWorkspace(ctx, req, res)
    if (!loc) return
    if (typeof loc.body.branch !== 'string') {
      sendJson(res, 400, { error: 'branch must be a string' })
      return
    }
    if (loc.body.kind !== undefined && loc.body.kind !== 'local' && loc.body.kind !== 'remote') {
      sendJson(res, 400, { error: 'kind must be local or remote' })
      return
    }
    const cwd = await selectedRepository(loc, res)
    if (!cwd) return
    sendJson(res, 200, await switchBranch(git, cwd, loc.body.branch, loc.body.kind))
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
