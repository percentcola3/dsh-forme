import type { Context } from '@deepseek-ai/cordis'
import { active, type TaskRun } from '../types.ts'
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
export function createTasks(request: typeof taskRequest = taskRequest) {
  let current = { runs: [] as TaskRun[], open: false, error: '', syncError: '' }
  const listeners = new Set<() => void>()
  const starting = new Map<string, Promise<void>>()
  let polling = false
  let mutation = 0
  const publish = (patch: Partial<typeof current>) => { current = { ...current, ...patch }; for (const listener of listeners) listener() }
  return {
    getSnapshot: () => current,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    show(open = true) { publish({ open }) },
    async refresh() {
      if (polling) return
      polling = true
      const revision = mutation
      try { const { runs } = await request('runs'); if (revision === mutation) publish({ runs, syncError: '' }) }
      catch { publish({ syncError: '任务状态同步失败，正在重连；当前显示可能已过期。' }) }
      finally { polling = false }
    },
    start(sessionId: string, promptId: string): Promise<void> {
      const key = `${sessionId}:${promptId}`
      if (starting.has(key)) return starting.get(key)!
      const operation = request('start', { sessionId, id: promptId, requestId: crypto.randomUUID() }).then(({ run }) => {
        mutation++
        publish({ runs: [run, ...current.runs.filter(item => item.id !== run.id)] })
      }).catch(error => { publish({ error: error instanceof Error ? error.message : String(error) }) }).finally(() => { starting.delete(key); publish({}) })
      starting.set(key, operation); publish({ open: true, error: '' })
      return operation
    },
    async stop(runId: string) {
      try { const { runs } = await request('stop', { runId }); mutation++; publish({ runs, error: '' }) }
      catch (error) { publish({ error: error instanceof Error ? error.message : String(error) }) }
    },
    busy(sessionId: string | undefined, promptId: string) { return !!sessionId && (starting.has(`${sessionId}:${promptId}`) || current.runs.some(run => run.parentId === sessionId && run.promptId === promptId && active(run.status))) },
  }
}
export type TaskStore = ReturnType<typeof createTasks>
