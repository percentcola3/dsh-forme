import { createRequire } from 'node:module'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export type InstallMode = 'source' | 'npx' | 'global' | 'unknown'

export interface Probe {
  current: string | null
  mode: InstallMode
  hint: string
}

export interface ProbeInput {
  argv1?: string
  cwd: string
}

function readJson(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function walkParents(start: string): string[] {
  const out: string[] = []
  let dir = start
  for (let i = 0; i < 16; i += 1) {
    out.push(dir)
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return out
}

function dirOfArgv(path: string): string {
  try {
    return dirname(path.startsWith('file:') ? fileURLToPath(path) : path)
  } catch {
    return process.cwd()
  }
}

function isNpxInstall(dir: string): boolean {
  return dir.includes('_npx') || dir.includes('npm-cache') || dir.includes(`${sep}dlx${sep}`) || dir.includes('/dlx/')
}

function classify(pkg: Record<string, unknown>, dir: string): Probe | null {
  if (pkg.name === '@deepseek-ai/dsh-root') {
    return {
      current: typeof pkg.version === 'string' ? pkg.version : null,
      mode: 'source',
      hint: '当前是源码检出，版本插件不会执行 npm 更新。开发请自行 git pull。',
    }
  }
  if (pkg.name === '@deepseek-ai/dsh' && typeof pkg.version === 'string') {
    const npx = isNpxInstall(dir)
    return {
      current: pkg.version,
      mode: npx ? 'npx' : 'global',
      hint: npx
        ? 'npx --yes @deepseek-ai/dsh@latest web'
        : 'npm install -g @deepseek-ai/dsh@latest',
    }
  }
  return null
}

function probeFromStart(start: string): Probe | null {
  let npm: Probe | null = null
  for (const dir of walkParents(start)) {
    const pkgPath = join(dir, 'package.json')
    if (!existsSync(pkgPath)) continue
    const pkg = readJson(pkgPath)
    if (!pkg) continue
    const found = classify(pkg, dir)
    if (!found) continue
    if (found.mode === 'source') return found
    if (!npm) npm = found
  }
  return npm
}

function resolveNearby(id: string, from: string): string | null {
  try {
    return createRequire(from).resolve(`${id}/package.json`)
  } catch {
    return null
  }
}

function collectStarts(input: ProbeInput): string[] {
  const starts: string[] = []
  const seen = new Set<string>()
  const push = (dir: string | null | undefined) => {
    if (!dir || seen.has(dir)) return
    seen.add(dir)
    starts.push(dir)
  }

  if (input.argv1) {
    try {
      push(dirname(realpathSync(input.argv1)))
    } catch {
      // argv may be a missing or non-file path
    }
    push(dirOfArgv(input.argv1))
    const from = input.argv1.startsWith('file:') ? fileURLToPath(input.argv1) : input.argv1
    const dsh = resolveNearby('@deepseek-ai/dsh', from)
    if (dsh) push(dirname(dsh))
    const root = resolveNearby('@deepseek-ai/dsh-root', from)
    if (root) push(dirname(root))
  }
  push(input.cwd)
  return starts
}

export function probeInstall(input: ProbeInput = { argv1: process.argv[1], cwd: process.cwd() }): Probe {
  let npm: Probe | null = null
  for (const start of collectStarts(input)) {
    const found = probeFromStart(start)
    if (found?.mode === 'source') return found
    if (found && !npm) npm = found
  }
  return npm ?? { current: null, mode: 'unknown', hint: '无法识别本地 dsh 安装' }
}
