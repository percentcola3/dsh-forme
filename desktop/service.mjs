import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { createInterface } from 'node:readline'
import { pathToFileURL } from 'node:url'

export const packageSpec = '@deepseek-ai/dsh@0.1.5-rc.1'
const exec = promisify(execFile)

async function hasLiveGroup(groupId) {
  const { stdout } = await exec('/bin/ps', ['-axo', 'pgid=,stat='], { maxBuffer: 4 * 1024 * 1024 })
  return stdout.split('\n').some(line => {
    const [group, status] = line.trim().split(/\s+/)
    return Number(group) === groupId && status && !status.startsWith('Z')
  })
}

export function launchUrl(text) {
  const match = /dsh web: (http:\/\/[^\s\x1b]+)(?=[\s\x1b])/u.exec(text)
  if (!match) return undefined
  try {
    const url = new URL(match[1])
    if (url.hostname !== '127.0.0.1' || !url.port || !url.searchParams.get('token')) return undefined
    return url.href
  } catch { return undefined }
}

/** The child owns a separate process group; never signal an unrelated dsh. */
export async function stopGroup(child, graceMs = 3000) {
  if (!child?.pid) return
  const signal = async name => {
    try { process.kill(-child.pid, name); return true } catch (error) {
      if (error.code === 'ESRCH') return false
      // Never turn EPERM into success while the group still has live members.
      if (error.code === 'EPERM' && !await hasLiveGroup(child.pid)) return false
      error.operation = name === 0 ? 'probe' : name
      throw error
    }
  }
  if (!await signal('SIGTERM')) return
  const deadline = Date.now() + graceMs
  while (Date.now() < deadline) {
    if (!await signal(0)) return
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  await signal('SIGKILL')
}

export function runService({
  command = process.execPath,
  args = [join(dirname(process.execPath), '../lib/node_modules/npm/bin/npx-cli.js'), '--yes', '--prefer-offline', packageSpec, 'web', '--no-open', '--host', '127.0.0.1', '--port', '0'],
  input = process.stdin,
  send = event => process.stdout.write(`${JSON.stringify(event)}\n`),
  startupMs = 300_000,
  retryMs = 1000,
} = {}) {
  let child
  let closing = false
  let retries = 0
  let restartTimer
  let startupTimer
  let transition = Promise.resolve()

  const reportError = message => send({ phase: 'error', message })
  const start = async () => {
    clearTimeout(restartTimer)
    clearTimeout(startupTimer)
    const previous = child
    child = undefined
    await stopGroup(previous)
    if (closing) return
    send({ phase: 'starting', message: '正在启动 DeepSeek…' })
    const processChild = spawn(command, args, {
      cwd: homedir(),
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', npm_config_update_notifier: 'false' },
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child = processChild
    let tail = ''
    let ready = false
    let timedOut = false
    const read = chunk => {
      if (closing || child !== processChild || ready || timedOut) return
      tail = (tail + String(chunk)).slice(-8192)
      const url = launchUrl(tail)
      if (!url) return
      ready = true
      clearTimeout(startupTimer)
      // Only the native parent receives this transient URL. Never persist it.
      send({ phase: 'ready', message: '', url })
      tail = ''
    }
    processChild.stdout.on('data', read)
    processChild.stderr.on('data', read)
    processChild.once('error', () => {
      clearTimeout(startupTimer)
      reportError('无法启动 Node/npm，请检查本机 Node 22.22.0 安装。')
    })
    processChild.once('exit', () => {
      if (closing || child !== processChild || timedOut) return
      clearTimeout(startupTimer)
      if (retries++ < 3) {
        send({ phase: 'starting', message: '服务已停止，正在重新连接…' })
        restartTimer = setTimeout(() => enqueue(start), retryMs * retries)
      } else {
        reportError('服务启动失败。请检查网络与 npm 安装后重试。')
        // The npm parent can exit while a descendant still holds resources.
        enqueue(async () => { await stopGroup(processChild); if (child === processChild) child = undefined })
      }
    })
    startupTimer = setTimeout(() => {
      if (closing || child !== processChild) return
      timedOut = true
      reportError('启动超时。首次运行需要下载 npm 包，请检查网络后重试。')
      enqueue(async () => { await stopGroup(processChild); if (child === processChild) child = undefined })
    }, startupMs)
  }
  const enqueue = work => {
    transition = transition.then(work).catch(error => send({ phase: 'error', message: '服务管理失败，请退出 App 后重试。', code: error.code || error.name, operation: error.operation }))
    return transition
  }
  const close = () => {
    closing = true
    clearTimeout(restartTimer)
    clearTimeout(startupTimer)
    return enqueue(async () => { await stopGroup(child); child = undefined })
  }
  const lines = createInterface({ input })
  lines.on('line', line => {
    if (line === 'restart' && !closing) { retries = 0; enqueue(start) }
  })
  // Closing the native parent's stdin pipe also works after a force quit/crash.
  lines.once('close', close)
  process.once('SIGTERM', () => { lines.close(); close().finally(() => process.exit(0)) })
  process.once('SIGINT', () => { lines.close(); close().finally(() => process.exit(0)) })
  enqueue(start)
  return { close, restart: () => enqueue(start) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runService()
