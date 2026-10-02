import { realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import type { createGitRunner } from './git.ts'

type Git = ReturnType<typeof createGitRunner>
type ChangedFile = { path: string; status: string; oldPath?: string }

export function parseStatus(output: string) {
  const records = output.split('\0')
  let branch = '', upstream = ''
  const files: ChangedFile[] = []
  for (let i = 0; i < records.length; i++) {
    const row = records[i]
    if (row.startsWith('## ')) {
      const names = row.slice(3).replace(/^(No commits yet on |Initial commit on )/, '').split(' [')[0]
      ;[branch, upstream = ''] = names.split('...')
    } else if (row) {
      const status = row.slice(0, 2)
      const file: ChangedFile = { path: row.slice(3), status: status.trim() }
      if (/[RC]/.test(status)) file.oldPath = records[++i]
      files.push(file)
    }
  }
  return { branch, upstream, files }
}

export function parseCounts(output: string) {
  let insertions = 0, deletions = 0
  const byPath: Record<string, { insertions: number; deletions: number }> = Object.create(null)
  const records = output.split('\0')
  for (let i = 0; i < records.length; i++) {
    const match = /^(\d+|-)\t(\d+|-)\t([\s\S]*)$/.exec(records[i])
    if (!match) continue
    let path = match[3]
    if (!path) { i++; path = records[++i] }
    const plus = Number(match[1]) || 0, minus = Number(match[2]) || 0
    insertions += plus; deletions += minus
    byPath[path] = { insertions: plus, deletions: minus }
  }
  return { insertions, deletions, byPath }
}

export async function sessionOwnsCwd(ctx: { get(name: string): unknown }, sessionId: string, cwd: string) {
  const sessions = ctx.get('sessions') as { list(): {id?:string;cwd?:string;header?:{id?:string;cwd?:string}}[] } | undefined
  const live = sessions?.list().find(s => (s.id ?? s.header?.id) === sessionId)
  const persistence = ctx.get('sessionPersistence') as {stat(id:string):Promise<{header:{id:string;cwd?:string}}|undefined>} | undefined
  const stored = live ? undefined : await persistence?.stat(sessionId)
  if (stored && stored.header.id !== sessionId) return false
  const root = live?.header?.cwd ?? live?.cwd ?? stored?.header.cwd
  if (!root || !isAbsolute(cwd)) return false
  try {
    const [owned, candidate] = await Promise.all([realpath(root), realpath(cwd)])
    return candidate === owned || candidate.startsWith(owned + sep)
  } catch { return false }
}

export async function readStatus(git: Git, cwd: string) {
  const status = await git(cwd, ['status', '--porcelain=v1', '-z', '-b', '--untracked-files=all'])
  if (status.code !== 0) throw new Error(status.stderr.trim() || '无法读取 Git 状态')
  const parsed = parseStatus(status.stdout)
  const hasHead = (await git(cwd, ['rev-parse', '--verify', 'HEAD'])).code === 0
  let stats = ''
  if (hasHead) {
    const result = await git(cwd, ['diff', '--numstat', '-z', 'HEAD'])
    if (result.code !== 0) throw new Error(result.stderr)
    stats = result.stdout
  }
  for (const file of parsed.files.filter(f => !hasHead || f.status === '??')) {
    const result = await git(cwd, ['diff', '--no-index', '--numstat', '-z', '--', '/dev/null', file.path])
    // Deletions in an unborn index have no current file to count.
    if (result.code <= 1) stats += result.stdout
  }
  const counts = parseCounts(stats)
  return {
    ...parsed,
    files: parsed.files.map(file => ({ ...file, ...counts.byPath[file.path] })),
    insertions: counts.insertions, deletions: counts.deletions,
  }
}

export async function readDiff(git: Git, cwd: string, path: string): Promise<string> {
  if (!path || isAbsolute(path) || path.includes('\0')) throw new Error('需要工作区内的相对路径')
  const rel = relative(resolve(cwd), resolve(cwd, path))
  if (rel === '..' || rel.startsWith('..' + sep)) throw new Error('路径超出工作区')
  const status = await git(cwd, ['status', '--porcelain=v1', '-z', '-b', '--untracked-files=all'])
  if (status.code !== 0) throw new Error(status.stderr)
  const file = parseStatus(status.stdout).files.find(f => f.path === path)
  if (!file) return '' // A file reverted while selected is no longer a change.
  const hasHead = (await git(cwd, ['rev-parse', '--verify', 'HEAD'])).code === 0
  let result
  if (!hasHead || file.status === '??') {
    // no-index reads the actual path: never follow a parent symlink out of cwd.
    const canonical = await realpath(resolve(cwd, path))
    const root = await realpath(cwd)
    if (!canonical.startsWith(root + sep)) throw new Error('文件指向工作区外部')
    result = await git(cwd, ['diff', '--no-index', '--', '/dev/null', path])
    if (result.code > 1) throw new Error(result.stderr)
  } else {
    result = await git(cwd, ['--literal-pathspecs', 'diff', 'HEAD', '--', ...(file.oldPath ? [file.oldPath] : []), path])
    if (result.code !== 0) throw new Error(result.stderr)
  }
  return result.stdout
}
