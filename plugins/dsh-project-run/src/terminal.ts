import * as pty from 'node-pty'
import { randomUUID } from 'node:crypto'
type Entry = { id: string; cwd: string; process: pty.IPty; output: string; offset: number; exited: boolean }
export class ProjectTerminals {
  private entries = new Map<string, Entry>()
  private disposed = false
  open(key: string, cwd: string, cols: number, rows: number) {
    const current = this.entries.get(key)
    if (current) return this.read(key, current.id, 0)
    if (this.disposed) throw new Error('终端已关闭。')
    if (this.entries.size >= 16) throw new Error('最多打开 16 个终端，请先关闭不用的终端。')
    const process = pty.spawn('/bin/zsh', ['-i'], { cwd, cols, rows, name: 'xterm-256color', env: { ...globalThis.process.env, TERM: 'xterm-256color' } })
    const entry: Entry = { id: randomUUID(), cwd, process, output: '', offset: 0, exited: false }
    this.entries.set(key, entry)
    process.onData(data => {
      entry.output += data
      if (entry.output.length > 200_000) {
        const drop = entry.output.length - 200_000
        entry.output = entry.output.slice(drop); entry.offset += drop
      }
    })
    process.onExit(() => { entry.exited = true })
    return this.read(key, entry.id, 0)
  }
  private entry(key: string, id: string) {
    const entry = this.entries.get(key)
    if (!entry || entry.id !== id) throw new Error('终端已关闭，请重新打开。')
    return entry
  }
  read(key: string, id: string, cursor: number) {
    const entry = this.entry(key, id)
    const reset = cursor < entry.offset || cursor > entry.offset + entry.output.length
    return { id, cwd: entry.cwd, exited: entry.exited, reset, output: entry.output.slice(reset ? 0 : cursor - entry.offset), cursor: entry.offset + entry.output.length }
  }
  write(key: string, id: string, data: string) {
    const entry = this.entry(key, id)
    if (entry.exited) throw new Error('终端进程已结束。')
    entry.process.write(data)
  }
  resize(key: string, id: string, cols: number, rows: number) { const entry = this.entry(key, id); if (!entry.exited) entry.process.resize(cols, rows) }
  close(key: string, id: string) {
    const entry = this.entry(key, id)
    this.entries.delete(key)
    // Let the interactive shell propagate hangup to its foreground/background jobs.
    try { entry.process.kill('SIGHUP') } catch {}
    const timer = setTimeout(() => {
      if (!entry.exited) {
        try { globalThis.process.kill(-entry.process.pid, 'SIGKILL') } catch {}
        try { entry.process.kill('SIGKILL') } catch {}
      }
    }, 1000)
    timer.unref()
  }
  dispose() { this.disposed = true; for (const [key, entry] of this.entries) this.close(key, entry.id) }
}
