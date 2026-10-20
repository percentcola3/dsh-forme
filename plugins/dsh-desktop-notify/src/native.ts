import { spawn, execFile, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import { readFile, mkdir, writeFile, access, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'
import type { Notice } from './monitor.ts'
import type { Preferences } from './preferences.ts'
const exec = promisify(execFile)
export class NativeNotices {
  private child?: ChildProcessWithoutNullStreams
  private preparing?: Promise<void>
  private stopped = false
  private lifetime = new AbortController()
  status: 'idle' | 'preparing' | 'ready' | 'unavailable' = process.platform === 'darwin' ? 'idle' : 'unavailable'
  error = process.platform === 'darwin' ? '' : '自定义桌面位置目前支持 macOS。'
  private onOpen: (id: string) => void
  private onStatus: () => void
  constructor(onOpen: (id: string) => void, onStatus: () => void = () => {}) { this.onOpen = onOpen; this.onStatus = onStatus }
  prepare(): Promise<void> {
    if (this.stopped) return Promise.reject(new Error('提醒插件已停止。'))
    if (this.child && this.status === 'ready') return Promise.resolve()
    if (this.preparing) return this.preparing
    this.preparing = this.start().finally(() => { this.preparing = undefined })
    return this.preparing
  }
  private async start(): Promise<void> {
    if (process.platform !== 'darwin') throw new Error(this.error)
    this.status = 'preparing'; this.error = ''; this.onStatus()
    try {
      const source = await readFile(fileURLToPath(new URL('../native/DSHNotices.swift', import.meta.url)))
      const hash = createHash('sha256').update(source).update(process.arch).digest('hex').slice(0, 20)
      const app = join(homedir(), '.dsh', 'cache', 'desktop-notify', hash, 'DSH Notices.app')
      const bin = join(app, 'Contents', 'MacOS', 'DSHNotices')
      try { await access(bin) } catch {
        await mkdir(join(app, 'Contents', 'MacOS'), { recursive: true, mode: 0o700 })
        const temporary = `${bin}.${process.pid}`
        await exec('/usr/bin/xcrun', ['swiftc', '-O', '-swift-version', '5', '-framework', 'AppKit', '-framework', 'SwiftUI', fileURLToPath(new URL('../native/DSHNotices.swift', import.meta.url)), '-o', temporary], { timeout: 120000, maxBuffer: 1024 * 1024, signal: this.lifetime.signal })
        await writeFile(join(app, 'Contents', 'Info.plist'), '<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>dev.dsh.desktop-notify</string><key>CFBundleName</key><string>DSH Notices</string><key>CFBundleExecutable</key><string>DSHNotices</string><key>LSUIElement</key><true/><key>NSHighResolutionCapable</key><true/></dict></plist>')
        await rename(temporary, bin)
      }
      if (this.stopped) return
      const child = spawn(bin, [], { stdio: ['pipe', 'pipe', 'pipe'] })
      this.child = child
      const lines = createInterface({ input: child.stdout })
      let stderr = ''
      child.stderr.on('data', chunk => { stderr = (stderr + String(chunk)).slice(-1500) })
      child.stdin.on('error', () => {})
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => { child.kill(); reject(new Error('桌面提醒窗口启动超时。')) }, 12000)
        const fail = (error: Error) => { clearTimeout(timer); reject(error) }
        child.once('error', fail)
        child.once('exit', code => {
          clearTimeout(timer); lines.close()
          if (this.child === child) this.child = undefined
          if (!this.stopped) { this.status = 'unavailable'; this.error = `桌面提醒已退出 (${code ?? 'signal'})。${stderr}`; this.onStatus() }
          reject(new Error(this.error || '桌面提醒已停止。'))
        })
        lines.on('line', line => {
          try {
            const value = JSON.parse(line)
            if (value.type === 'ready') { clearTimeout(timer); this.status = 'ready'; this.onStatus(); resolve() }
            if (value.type === 'open' && typeof value.id === 'string') this.onOpen(value.id)
          } catch { /* Ignore non-protocol diagnostics from the OS. */ }
        })
      })
    } catch (error) {
      this.status = 'unavailable'
      this.error = `桌面提醒不可用：${error instanceof Error ? error.message : String(error)}。首次使用需要 Xcode Command Line Tools。`
      this.onStatus(); throw new Error(this.error)
    }
  }
  async show(notice: Notice, preferences: Preferences): Promise<void> { await this.prepare(); this.send({ action: 'show', notice, preferences }) }
  dismiss(id: string): void { this.send({ action: 'dismiss', id }) }
  configure(preferences: Preferences): void { this.send({ action: 'configure', preferences }) }
  private send(value: unknown): void { if (this.child?.stdin.writable) this.child.stdin.write(`${JSON.stringify(value)}\n`) }
  dispose(): void { this.stopped = true; this.lifetime.abort(); this.child?.stdin.end(); this.child?.kill(); this.child = undefined }
}
