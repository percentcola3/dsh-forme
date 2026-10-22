import { lstat, opendir, realpath } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { createGitRunner } from './git.ts'

type Git = ReturnType<typeof createGitRunner>
export type Repository = { path: string; name: string; branch: string; kind: 'repository' | 'submodule' | 'worktree' }
export const SCAN_LIMITS = { maxDepth: 8, maxDirectories: 2_000, maxRepositories: 100, maxDurationMs: 3_000 }
type Limits = typeof SCAN_LIMITS
type Reason = 'depth' | 'directories' | 'repositories' | 'time'
const SKIP = new Set(['.git', 'node_modules', '.cache', '.npm', '.pnpm-store', '.yarn', 'dist', 'build', 'out', 'target', 'coverage', '.next', '.nuxt', '.turbo', '.venv', 'venv', '__pycache__', '.gradle'])
const contained = (root: string, path: string) => path === root || (!isAbsolute(relative(root, path)) && relative(root, path) !== '..' && !relative(root, path).startsWith('..' + sep))

/** A fresh check for every action; discovery results never authorize a target. */
export async function resolveRepository(git: Git, cwd: string, repositoryPath: unknown = '.'): Promise<string> {
  if (typeof repositoryPath !== 'string' || !repositoryPath || isAbsolute(repositoryPath) || /^[A-Za-z]:/.test(repositoryPath) || repositoryPath.includes('\\') || repositoryPath.includes('\0') || repositoryPath.split('/').includes('..')) {
    throw new Error('repositoryPath must be a relative path without ..')
  }
  const root = await realpath(cwd)
  const target = await realpath(resolve(root, repositoryPath))
  if (!contained(root, target)) throw new Error('repositoryPath is outside the authorized cwd')
  // Reject symlink components, including aliases that happen to point back inside.
  let cursor = root
  for (const part of repositoryPath.split('/').filter(p => p && p !== '.')) {
    cursor = join(cursor, part)
    if ((await lstat(cursor)).isSymbolicLink()) throw new Error('repositoryPath must not traverse symlink directories')
  }
  const result = await git(target, ['rev-parse', '--show-toplevel'])
  if (result.code !== 0) throw new Error('repositoryPath is not a Git worktree')
  const top = await realpath(result.stdout.trim())
  if (target !== root && top !== target) throw new Error('repositoryPath must identify an exact Git worktree root')
  return target
}

export async function scanRepositories(git: Git, cwd: string, overrides: Partial<Limits> = {}) {
  const limits = { ...SCAN_LIMITS, ...overrides }
  const root = await realpath(cwd)
  const deadline = Date.now() + limits.maxDurationMs
  const repositories: Repository[] = []
  const reasons = new Set<Reason>()
  const errors: { path: string; error: string }[] = []
  const expired = () => { if (Date.now() >= deadline) { reasons.add('time'); return true }; return false }
  const run: Git = async (path, args) => {
    if (expired()) return { code: 1, stdout: '', stderr: 'Repository scan time limit reached' }
    const result = await git(path, args, { timeoutMs: Math.max(1, deadline - Date.now()) })
    expired()
    return result
  }
  const inspect = async (path: string, rel: string) => {
    const info = await run(path, ['rev-parse', '--show-toplevel', '--absolute-git-dir', '--git-common-dir', '--show-superproject-working-tree'])
    if (info.code !== 0) return // Ordinary nongit root and invalid .git candidates are not repositories.
    const [top, gitDir, commonDir, superproject] = info.stdout.trimEnd().split('\n')
    if (!top || !gitDir || !commonDir) return
    if (rel !== '.' && await realpath(top) !== path) return
    const branch = await run(path, ['symbolic-ref', '--quiet', '--short', 'HEAD'])
    if (expired()) return
    const kind = superproject ? 'submodule' : await realpath(resolve(path, gitDir)) !== await realpath(resolve(path, commonDir)) ? 'worktree' : 'repository'
    repositories.push({ path: rel, name: basename(path), branch: branch.code === 0 ? branch.stdout.trim() : 'HEAD (detached)', kind })
  }
  const queue = [{ path: root, rel: '.', depth: 0 }]
  const queued = new Set([root])
  let scheduled = 1
  let scanIndex = -1
  const enqueue = (path: string, rel: string, depth: number) => {
    if (queued.has(path)) return
    if (depth > limits.maxDepth) { reasons.add('depth'); return }
    if (scheduled >= limits.maxDirectories) { reasons.add('directories'); return }
    if (repositories.length >= limits.maxRepositories) { reasons.add('repositories'); return }
    queued.add(path)
    scheduled++
    const insertion = queue.findIndex((item, index) => index > scanIndex && item.depth > depth)
    const item = { path, rel, depth }
    if (insertion < 0) queue.push(item)
    else queue.splice(insertion, 0, item)
  }
  for (scanIndex = 0; scanIndex < queue.length; scanIndex++) {
    if (expired()) break
    if (repositories.length >= limits.maxRepositories) { reasons.add('repositories'); break }
    const item = queue[scanIndex]
    try {
      // Recheck canonical containment immediately before inspection, in case directories changed.
      if (await realpath(item.path) !== item.path || !(await lstat(item.path)).isDirectory()) continue
      let candidate = item.depth === 0
      if (!candidate) {
        try { const marker = await lstat(join(item.path, '.git')); candidate = marker.isFile() || marker.isDirectory() } catch { /* No Git marker. */ }
      }
      const before = repositories.length
      if (candidate) await inspect(item.path, item.rel)
      if (expired()) break
      if (repositories.length > before) {
        // Git's NUL format preserves whitespace/newlines in submodule paths.
        // Read only this worktree's own regular .gitmodules, never a symlink.
        let hasModules = false
        try { hasModules = (await lstat(join(item.path, '.gitmodules'))).isFile() } catch { /* No submodules. */ }
        if (hasModules) {
          const modules = await run(item.path, ['config', '--null', '--file', '.gitmodules', '--get-regexp', '^submodule\\..*\\.path$'])
          for (const record of modules.stdout.split('\0')) {
            if (expired()) break
            const split = record.indexOf('\n')
            if (split < 0) continue
            const subpath = record.slice(split + 1)
            const parts = subpath.split('/')
            if (!subpath || isAbsolute(subpath) || subpath.includes('\\') || /^[A-Za-z]:/.test(subpath) || parts.some(p => !p || p === '.' || p === '..' || p === '.git')) continue
            const depth = item.depth + parts.length
            if (depth > limits.maxDepth) { reasons.add('depth'); continue }
            let path = item.path, safe = true
            for (const part of parts) {
              path = join(path, part)
              try { if (!(await lstat(path)).isDirectory()) { safe = false; break } } catch { safe = false; break }
            }
            if (!safe || !contained(root, path)) continue
            try {
              const marker = await lstat(join(path, '.git'))
              if (!marker.isFile() && !marker.isDirectory()) continue
            } catch { continue }
            enqueue(path, item.rel === '.' ? subpath : `${item.rel}/${subpath}`, depth)
          }
        }
      }
      if (expired()) break
      const directory = await opendir(item.path)
      for await (const entry of directory) {
        if (expired()) break
        if (!entry.isDirectory() || entry.isSymbolicLink() || SKIP.has(entry.name)) continue
        if (item.depth >= limits.maxDepth) { reasons.add('depth'); continue }
        if (scheduled >= limits.maxDirectories) { reasons.add('directories'); break }
        if (repositories.length >= limits.maxRepositories) { reasons.add('repositories'); break }
        enqueue(join(item.path, entry.name), item.rel === '.' ? entry.name : `${item.rel}/${entry.name}`, item.depth + 1)
      }
    } catch (error) {
      if (errors.length < 20) errors.push({ path: item.rel, error: error instanceof Error ? error.message : String(error) })
    }
  }
  repositories.sort((a, b) => a.path === '.' ? -1 : b.path === '.' ? 1 : a.path.localeCompare(b.path))
  return { ok: true as const, repositories, truncated: reasons.size > 0, limits, limitReasons: [...reasons], ...(errors.length ? { errors } : {}) }
}

/** Per-plugin bounded cache, keyed by canonical authorized cwd, with explicit refresh. */
export function createRepositoryDiscovery(git: Git) {
  const cache = new Map<string, { expires: number; result: Awaited<ReturnType<typeof scanRepositories>> }>()
  const pending = new Map<string, Promise<Awaited<ReturnType<typeof scanRepositories>>>>()
  return async (cwd: string, refresh = false) => {
    const root = await realpath(cwd)
    const previous = cache.get(root)
    if (!refresh && previous && previous.expires > Date.now()) return previous.result
    const active = pending.get(root)
    if (active) return active
    // Bound both retained results and in-flight scans across different roots.
    while (pending.size >= 32) await Promise.race(pending.values()).catch(() => {})
    const waiting = pending.get(root)
    if (waiting) return waiting
    const scan = scanRepositories(git, root).then(result => {
      if (cache.size >= 32) cache.delete(cache.keys().next().value!)
      cache.set(root, { expires: Date.now() + 15_000, result })
      return result
    }).finally(() => { pending.delete(root) })
    pending.set(root, scan)
    return scan
  }
}
