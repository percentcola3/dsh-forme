import type { Context } from '@deepseek-ai/cordis'
type RecoveryNotice = { state?: string; error?: string } | null
import { active, type Prompt, type TaskRun, type ModelChoice } from '../types.ts'
export type { Prompt, TaskRun } from '../types.ts'
export { active } from '../types.ts'
export async function taskRequest(action: string, body: Record<string, unknown> = {}): Promise<any> {
  const res = await fetch('/dsh-quick-prompts', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...body }) })
  const value = await res.json()
  if (!res.ok) throw new Error(value.error ?? '快捷任务操作失败。')
  return value
}
export function openRun(ctx: Pick<Context, 'get'>, run: TaskRun): void {
  if (run.sessionKind === 'headless') return
  const workspace = ctx.get('uiWorkspace') as { openSession(address: string | { kind: 'subagent'; parentSessionId: string; childSessionId: string; mode: 'continuable' }): void }
  if (run.sessionKind === 'conversation') { workspace.openSession(run.childId); return }
  workspace.openSession({ kind: 'subagent', parentSessionId: run.parentId, childSessionId: run.childId, mode: 'continuable' })
}
// Conversation cards retain their replies after completion until explicitly closed.
export const ongoingRuns = (runs: TaskRun[]): TaskRun[] => runs.filter(run => !run.dismissed).sort((a, b) => b.startedAt - a.startedAt)
// A card belongs to its launch conversation, not every conversation in the project.
export const sessionRuns = (runs: TaskRun[], sessionId: string | undefined, projectId: string): TaskRun[] =>
  sessionId ? ongoingRuns(runs).filter(run => run.parentId === sessionId && run.projectId === projectId) : []
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b)
const messageOf = (error: unknown) => error instanceof Error ? error.message : String(error)
export type ProjectTerminalCard = { projectId: string; sessionId: string }
export function createTasks(request: typeof taskRequest = taskRequest, now: () => number = Date.now) {
  let current = { sessionId: undefined as string | undefined, projectId: '', cwd: '', prompts: [] as Prompt[], legacyAvailable: false, ready: false, runs: [] as TaskRun[], open: true, terminalOpen: false, terminalCards: [] as ProjectTerminalCard[], recovery: null as RecoveryNotice, error: '', syncError: '' }
  const listeners = new Set<() => void>()
  const starting = new Map<string, Promise<void>>()
  const drafts = new Map<string, string>()
  const replyKeys = new Map<string, { text: string; id: string }>()
  const projectCards = new Map<string, { open: boolean; terminalOpen: boolean; runs: TaskRun[] }>()
  let epoch = 0, mutation = 0, catalogRevision = 0
  let lastCatalogAt = -Infinity
  let polling: number | undefined
  const publish = (patch: Partial<typeof current>) => {
    current = { ...current, ...patch }
    if (current.ready && current.projectId) {
      projectCards.delete(current.projectId)
      projectCards.set(current.projectId, { open: current.open, terminalOpen: current.terminalOpen, runs: current.runs })
      // Keep each visited project's own panel state for the plugin lifetime.
    }
    for (const listener of listeners) listener()
  }
  const scope = () => ({ sessionId: current.sessionId, projectId: current.projectId })
  const load = async (generation: number) => {
    if (!current.sessionId) return
    const revision = catalogRevision
    lastCatalogAt = now()
    try {
      const value = await request('list', { sessionId: current.sessionId })
      if (generation !== epoch || revision !== catalogRevision) return
      if (current.ready && value.projectId === current.projectId && Object.entries(value).every(([key, item]) => same(item, (current as Record<string, unknown>)[key]))) return
      if (value.projectId !== current.projectId) {
        if (current.ready) { epoch++; mutation++; catalogRevision++ }
        const cards = projectCards.get(value.projectId)
        publish({ ...value, runs: cards?.runs ?? [], open: cards?.open ?? true, terminalOpen: current.terminalCards.some(card => card.projectId === value.projectId), recovery: null, ready: true, error: '', syncError: '' })
      } else publish({ ...value, ready: true, ...(current.ready ? {} : { error: '' }) })
    } catch (error) { if (generation === epoch && revision === catalogRevision) publish({ error: messageOf(error) }) }
  }
  const store = {
    getSnapshot: () => current,
    getDraft: (runId: string) => drafts.get(runId) ?? '',
    // Local drafts survive collapsing/switching cards without notifying composer subscribers.
    setDraft(runId: string, text: string) {
      if (text) { drafts.delete(runId); drafts.set(runId, text) } else drafts.delete(runId)
      while (drafts.size > 100) drafts.delete(drafts.keys().next().value!)
    },
    replyRequestId(runId: string, text: string) {
      const previous = replyKeys.get(runId)
      if (previous?.text === text) return previous.id
      const id = crypto.randomUUID(); replyKeys.set(runId, { text, id }); return id
    },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    async select(sessionId: string | undefined) {
      if (sessionId === current.sessionId) return
      const generation = ++epoch; mutation++; catalogRevision++
      publish({ sessionId, projectId: '', cwd: '', prompts: [], runs: [], legacyAvailable: false, ready: false, error: '', syncError: '', recovery: null, open: true, terminalOpen: false })
      await load(generation)
    },
    show(open = true) { publish({ open }) },
    showTerminal(open = true, projectId = current.projectId) {
      if (!projectId || (open && (!current.ready || projectId !== current.projectId || !current.sessionId))) return
      const terminalCards = current.terminalCards.filter(card => card.projectId !== projectId)
      const previous = current.terminalCards.find(card => card.projectId === projectId)
      if (open) terminalCards.push(previous ?? { projectId, sessionId: current.sessionId! })
      const cached = projectCards.get(projectId)
      if (cached) projectCards.set(projectId, { ...cached, terminalOpen: open })
      publish({ terminalCards, ...(current.projectId === projectId ? { terminalOpen: open, open: true } : {}) })
    },
    async refresh() {
      const generation = epoch
      if (!current.sessionId || polling === generation) return
      polling = generation
      const revision = mutation
      try {
        if (!current.ready) { await load(generation); return }
        if (now() - lastCatalogAt >= 15_000) await load(generation)
        if (generation !== epoch) return
        const { runs, projectId, recovery = null } = await request('runs', scope()) as { runs: TaskRun[]; projectId: string; recovery?: RecoveryNotice }
        if (generation === epoch && revision === mutation && projectId === current.projectId) {
          const failed = runs.find(run => run.status === 'failed' && current.runs.some(previous => previous.id === run.id && active(previous.status)))
          // Polling usually returns identical data; republishing would re-render
          // the composer overlay on every tick and compete with typing.
          const unchanged = !failed && current.syncError === '' && same(runs, current.runs) && same(recovery, current.recovery)
          if (!unchanged) publish({ runs: same(runs, current.runs) ? current.runs : runs.map(run => { const previous = current.runs.find(item => item.id === run.id); return previous && same(previous, run) ? previous : run }), recovery: same(recovery, current.recovery) ? current.recovery : recovery, syncError: '', ...(failed ? { error: `${failed.name}：${failed.error ?? '任务未能完成，请从原生子智能体列表查看记录。'}` } : {}) })
        }
      } catch { const syncError = '任务状态同步失败，正在重连；当前显示可能已过期。'; if (generation === epoch && current.syncError !== syncError) publish({ syncError }) }
      finally { if (polling === generation) polling = undefined }
    },
    async models(): Promise<ModelChoice[]> {
      if (!current.ready || !current.sessionId) throw new Error('项目尚未就绪，请稍后重试。')
      const generation = epoch, projectId = current.projectId
      const value = await request('models', scope())
      if (generation !== epoch || projectId !== current.projectId || value.projectId !== projectId) throw new Error('项目已切换，请重新打开快捷任务。')
      if (!Array.isArray(value.models)) throw new Error('模型列表暂不可用，请重新加载插件后重试。')
      return value.models
    },
    async save(action: 'save' | 'delete' | 'import', draft: Record<string, unknown> = {}) {
      if (!current.ready) throw new Error('项目尚未就绪，请稍后重试。')
      const generation = epoch, projectId = current.projectId
      const revision = ++catalogRevision
      const value = await request(action, { ...draft, ...scope() })
      if (generation === epoch && projectId === current.projectId && revision === catalogRevision) {
        catalogRevision++
        lastCatalogAt = now()
        publish(value)
      }
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
    async reply(runId: string, text: string, requestId: string) {
      if (!current.ready || !current.sessionId) throw new Error('项目尚未就绪，请稍后重试。')
      const generation = epoch
      mutation++
      const { run, projectId } = await request('reply', { ...scope(), runId, text, requestId })
      if (replyKeys.get(runId)?.id === requestId) replyKeys.delete(runId)
      if (generation === epoch && projectId === current.projectId) {
        mutation++
        publish({ runs: current.runs.map(previous => previous.id === run.id ? run : previous), error: '' })
      }
    },
    async control(action: 'stop' | 'close', runId: string) {
      const generation = epoch
      mutation++
      try {
        const { runs } = await request(action, { ...scope(), runId })
        if (action === 'close') { drafts.delete(runId); replyKeys.delete(runId) }
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
