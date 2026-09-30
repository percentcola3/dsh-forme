import { spawn, type ChildProcess } from 'node:child_process'
import { stripVTControlCharacters } from 'node:util'

export type RunState = { command: string; status: 'idle' | 'running' | 'stopping' | 'exited' | 'error'; output: string; exitCode: number | null; truncated: boolean }
type Job = { state: RunState; child: ChildProcess; done: Promise<void>; stop?: Promise<void> }
const OUTPUT_LIMIT = 200_000
export class ProjectRunner {
  private disposed = false
  private jobs = new Map<string, Job>()
  private restarts = new Map<string, Promise<RunState>>()
  snapshot(cwd: string): RunState | undefined { return this.jobs.get(cwd)?.state }
  start(cwd: string, command: string): RunState {
    if (this.disposed) throw new Error('运行服务正在关闭。')
    if (this.jobs.get(cwd)?.state.status === 'running' || this.jobs.get(cwd)?.state.status === 'stopping') throw new Error('项目已在运行，请先停止。')
    if (!command.trim() || command.length > 16_000 || command.includes('\0')) throw new Error('请输入有效的启动命令。')
    // Keep completed output bounded across projects, too.
    for (const [key, job] of this.jobs) if (this.jobs.size >= 16 && !['running', 'stopping'].includes(job.state.status)) this.jobs.delete(key)
    if (this.jobs.size >= 16 && !this.jobs.has(cwd)) throw new Error('运行项目过多，请先停止其他项目。')
    const state: RunState = { command, status: 'running', output: '', exitCode: null, truncated: false }
    const child = spawn('/bin/zsh', ['-c', command], { cwd, detached: true, env: { ...process.env, TERM: 'dumb', FORCE_COLOR: '0' }, stdio: ['ignore', 'pipe', 'pipe'] })
    let finish!: () => void
    const done = new Promise<void>(resolve => { finish = resolve })
    const job: Job = { state, child, done }
    this.jobs.set(cwd, job)
    const append = (text: string) => {
      state.output += stripVTControlCharacters(text)
      if (state.output.length > OUTPUT_LIMIT) { state.output = state.output.slice(-OUTPUT_LIMIT); state.truncated = true }
    }
    child.stdout?.setEncoding('utf8'); child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', append); child.stderr?.on('data', append)
    child.on('error', error => { append(`\n${error.message}\n`); state.status = 'error'; finish() })
    child.on('close', code => {
      // A completed foreground command must not leave detached shell children.
      this.signal(job, 'SIGKILL')
      state.exitCode = code
      if (state.status !== 'error' && state.status !== 'stopping') state.status = 'exited'
      finish()
    })
    return state
  }
  restart(cwd: string, command: string): Promise<RunState> {
    const pending = this.restarts.get(cwd)
    if (pending) return pending
    if (!command.trim() || command.length > 16_000 || command.includes('\0')) return Promise.reject(new Error('请先保存有效的启动命令。'))
    const operation = (async () => {
      await this.stop(cwd)
      return this.start(cwd, command)
    })()
    this.restarts.set(cwd, operation)
    void operation.finally(() => { if (this.restarts.get(cwd) === operation) this.restarts.delete(cwd) }).catch(() => {})
    return operation
  }
  private signal(job: Job, signal: NodeJS.Signals): void {
    if (!job.child.pid) return
    try { process.kill(-job.child.pid, signal) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error }
  }
  async stop(cwd: string): Promise<void> {
    const job = this.jobs.get(cwd)
    if (!job || !['running', 'stopping'].includes(job.state.status)) return
    if (job.stop) return job.stop
    job.state.status = 'stopping'
    job.stop = (async () => {
      this.signal(job, 'SIGTERM')
      // Cover descendants even when the shell exits before its children.
      await new Promise(resolve => setTimeout(resolve, 1200))
      this.signal(job, 'SIGKILL')
      await job.done
      if (job.state.status === 'stopping') job.state.status = 'exited'
    })()
    return job.stop
  }
  killAll(): void {
    this.disposed = true
    for (const job of this.jobs.values()) if (['running', 'stopping'].includes(job.state.status)) this.signal(job, 'SIGKILL')
  }
  async dispose(): Promise<void> { this.disposed = true; await Promise.all([...this.jobs.keys()].map(key => this.stop(key))) }
}
