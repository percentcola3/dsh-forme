import type { Context } from '@deepseek-ai/cordis'
import { active, type Prompt, type TaskRun } from '../types.ts'
export type { Prompt, TaskRun } from '../types.ts'
export async function taskRequest(action: string, body: Record<string, unknown> = {}): Promise<any> {
  const res = await fetch('/dsh-quick-prompts', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...body }) })
  const value = await res.json()
  if (!res.ok) throw new Error(value.error ?? '快捷任务操作失败。')
  return value
}
export function openRun(ctx: Pick<Context, 'get'>, run: TaskRun): void {
  const workspace = ctx.get('uiWorkspace') as { openSession(address: { kind: 'subagent'; parentSessionId: string; childSessionId: string; mode: 'continuable' }): void }
  workspace.openSession({ kind: 'subagent', parentSessionId: run.parentId, childSessionId: run.childId, mode: 'continuable' })
}
export const ongoingRuns = (runs: TaskRun[]): TaskRun[] => runs.filter(run => !run.dismissed && active(run.status)).sort((a, b) => b.startedAt - a.startedAt)
const messageOf = (error: unknown) => error instanceof Error ? error.message : String(error)
export function createTasks(request: typeof taskRequest = taskRequest) {
  let current = { sessionId: undefined as string | undefined, projectId: '', cwd: '', prompts: [] as Prompt[], legacyAvailable: false, ready: false, runs: [] as TaskRun[], open: true, error: '', syncError: '' }
  const listeners = new Set<() => void>()
  const starting = new Map<string, Promise<void>>()
  let epoch = 0, mutation = 0
  let polling: number | undefined
  const publish = (patch: Partial<typeof current>) => { current = { ...current, ...patch }; for (const listener of listeners) listener() }
  const scope = () => ({ sessionId: current.sessionId, projectId: current.projectId })
  const load = async (generation: number) => {
    if (!current.sessionId) return
    try {
      const value = await request('list', { sessionId: current.sessionId })
      if (generation === epoch) publish({ ...value, ready: true, error: '' })
    } catch (error) { if (generation === epoch) publish({ error: messageOf(error) }) }
  }
  const store = {
    getSnapshot: () => current,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    async select(sessionId: string | undefined) {
      if (sessionId === current.sessionId) return
      const generation = ++epoch; mutation++
      publish({ sessionId, projectId: '', cwd: '', prompts: [], runs: [], legacyAvailable: false, ready: false, error: '', syncError: '', open: true })
      await load(generation)
    },
    show(open = true) { publish({ open }) },
    async refresh() {
      const generation = epoch
      if (!current.sessionId || polling === generation) return
      polling = generation
      const revision = mutation
      try {
        if (!current.ready) { await load(generation); return }
        const { runs, projectId } = await request('runs', scope()) as { runs: TaskRun[]; projectId: string }
        if (generation === epoch && revision === mutation && projectId === current.projectId) {
          const failed = runs.find(run => run.status === 'failed' && current.runs.some(previous => previous.id === run.id && active(previous.status)))
          publish({ runs, syncError: '', ...(failed ? { error: `${failed.name}：${failed.error ?? '任务未能完成，请从原生子智能体列表查看记录。'}` } : {}) })
        }
      } catch { if (generation === epoch) publish({ syncError: '任务状态同步失败，正在重连；当前显示可能已过期。' }) }
      finally { if (polling === generation) polling = undefined }
    },
    async save(action: 'save' | 'delete' | 'import', draft: Record<string, unknown> = {}) {
      if (!current.ready) throw new Error('项目尚未就绪，请稍后重试。')
      const generation = epoch
      const value = await request(action, { ...draft, ...scope() })
      if (generation === epoch) publish(value)
    },
    start(sessionId: string, promptId: string): Promise<void> {
      if (sessionId !== current.sessionId || !current.ready) return Promise.resolve()
      const key = `${epoch}:${promptId}`
      if (starting.has(key)) return starting.get(key)!
      const generation = epoch
      mutation++
      const operation = request('start', { ...scope(), id: promptId, requestId: crypto.randomUUID() }).then(({ run }) => {
        if (generation !== epoch) return
        mutation++
        publish({ runs: [run, ...current.runs.filter(item => item.id !== run.id)], ...(run.status === 'failed' ? { error: `${run.name}：${run.error ?? '任务未能启动。'}` } : {}) })
      }).catch(error => { if (generation === epoch) publish({ error: messageOf(error) }) }).finally(() => { starting.delete(key); if (generation === epoch) publish({}) })
      starting.set(key, operation); publish({ open: true, error: '' })
      return operation
    },
    async control(action: 'stop' | 'close', runId: string) {
      const generation = epoch
      mutation++
      try {
        const { runs } = await request(action, { ...scope(), runId })
        if (generation === epoch) {
          mutation++
          const updated = runs.find((run: TaskRun) => run.id === runId)
          publish({ runs: updated ? current.runs.map(run => run.id === runId ? updated : run) : current.runs.filter(run => run.id !== runId), error: '' })
        }
      } catch (error) { if (generation === epoch) publish({ error: messageOf(error) }) }
    },
    stop(runId: string) { return store.control('stop', runId) },
    close(runId: string) { return store.control('close', runId) },
    busy(sessionId: string | undefined, promptId: string) { return sessionId === current.sessionId && starting.has(`${epoch}:${promptId}`) },
  }
  return store
}
export type TaskStore = ReturnType<typeof createTasks>
