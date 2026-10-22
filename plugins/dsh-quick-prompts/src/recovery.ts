import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { PromptStore } from './prompt-store.ts'

export type RecoveryEvent = { seq: number; type: string; data: Record<string, any> }
export type RecoverySession = { id: string; header: { origin?: string; cwd?: string }; snapshotEvents(): RecoveryEvent[] }
export type RecoveryAgent = { id: string; status: string; session: RecoverySession; inbox: { nextTurn: { id: string }[]; nextStep: { id: string }[] }; followup(message: any): void }
export type RecoveryRecord = { sessionId: string; turn: number; startSeq: number; lastUserSeq: number; requestId: string; state?: 'reserved' | 'continued' | 'failed'; error?: string }
export type RecoveryStore = { read(): Promise<RecoveryRecord[]>; update(change: (records: RecoveryRecord[]) => void): Promise<RecoveryRecord[]> }
export type RecoveryRuntime = {
  inspect(id: string): Promise<{ meta: RecoverySession['header']; events: RecoveryEvent[] }>
  resolveAgent(id: string): Promise<{ agent: RecoveryAgent } | { error: unknown }>
  get(id: string): RecoveryAgent | undefined
  /** Exclude archived/deleted sessions and identities owned by subagent routing. */
  eligible(id: string, header: RecoverySession['header']): boolean
  /** Truthful host/plugin source; preserve the deterministic message id. */
  makeMessage(id: string, text: string): { id: string }
  report(id: string, reason: string, error?: unknown): void
}
export const RECOVERY_TEXT = 'DSH restarted while this conversation task was running. The user has enabled automatic restart recovery. Continue the original active objective within this turn in the same session using durable history and the current workspace. Do not resend the original task or blindly repeat completed tool calls. A tool whose outcome is unknown may already have changed external state: inspect that state before retrying; ask the user when its outcome cannot be established safely. Do not change goal activation merely because of this host notification; persisted goals may remain disarmed until the user explicitly resumes them. This is a host recovery notification, not a new user message.'
export function makeRecoveryMessage(id: string, text: string) {
  // Native followup persists user/message; provenance identifies the actual producer.
  return Object.freeze({ id, role: 'user' as const, source: Object.freeze({ kind: 'dsh-quick-prompts-recovery' }), content: Object.freeze([Object.freeze({ type: 'text' as const, text })]) })
}
export const recoveryId = (sessionId: string, startSeq: number) => `dqp-recovery-${createHash('sha256').update(JSON.stringify([sessionId, startSeq])).digest('hex').slice(0, 32)}`
export const createRecoveryStore = (directory: string): RecoveryStore => new PromptStore<RecoveryRecord>(join(directory, 'quick-prompts-recovery.json'))
const interrupted = (event: RecoveryEvent) => event.data.reason?.kind === 'interrupted' || (event.data.reason?.kind === 'aborted' && event.data.reason?.reason?.kind === 'disposed')
const userSeq = (events: RecoveryEvent[]) => events.findLast(event => event.type === 'user/message')?.seq ?? -1
const valid = (row: RecoveryRecord) => typeof row?.sessionId === 'string' && Number.isSafeInteger(row.startSeq) && row.startSeq >= 0 && Number.isSafeInteger(row.turn) && Number.isSafeInteger(row.lastUserSeq) && row.requestId === recoveryId(row.sessionId, row.startSeq)
const ordinary = (header: RecoverySession['header']) => header.origin !== 'subagent' && typeof header.cwd === 'string'
function matches(row: RecoveryRecord, events: RecoveryEvent[]): boolean {
  const start = events.findLast(event => event.type === 'turn/start')
  if (start?.seq !== row.startSeq || start.data.turn !== row.turn || userSeq(events) > row.lastUserSeq) return false
  const end = events.findLast(event => event.type === 'turn/end')
  return !end || end.seq < start.seq || interrupted(end)
}
function received(agent: RecoveryAgent, id: string): boolean {
  return [...agent.inbox.nextTurn, ...agent.inbox.nextStep].some(message => message.id === id)
    || agent.session.snapshotEvents().some(event => event.type === 'user/message' && (event.data.id === id || event.data.message?.id === id))
}

/** One host coordinator owns the store. No historical scan and no tool replay.
 * A reserved-but-unconfirmed admission requires manual continuation: exactly-once
 * execution cannot span the disk checkpoint and followup operation.
 */
export class RecoveryCoordinator {
  private stopped = false
  private recovering?: Promise<void>
  private pending = new Set<Promise<unknown>>()
  private store: RecoveryStore
  private runtime: RecoveryRuntime
  constructor(store: RecoveryStore, runtime: RecoveryRuntime) { this.store = store; this.runtime = runtime }
  private track<T>(work: Promise<T>): Promise<T> {
    this.pending.add(work)
    void work.then(() => this.pending.delete(work), () => this.pending.delete(work))
    return work
  }
  private allowed(id: string, header: RecoverySession['header']) { return ordinary(header) && this.runtime.eligible(id, header) }
  status(): Promise<RecoveryRecord[]> { return this.store.read() }
  observeRunning(agent: RecoveryAgent): Promise<void> {
    if (agent.status !== 'running') return Promise.resolve()
    const start = agent.session.snapshotEvents().findLast(event => event.type === 'turn/start')
    return start ? this.observe(agent.session, start) : Promise.resolve()
  }
  observe(session: RecoverySession, event: RecoveryEvent): Promise<void> {
    if (this.stopped || !this.allowed(session.id, session.header)) return Promise.resolve()
    if (!['turn/start', 'turn/end', 'user/message'].includes(event.type)) return Promise.resolve()
    const events = session.snapshotEvents()
    return this.track(this.store.update(rows => {
      const index = rows.findIndex(row => row.sessionId === session.id)
      if (event.type === 'turn/start') {
        const row: RecoveryRecord = { sessionId: session.id, turn: event.data.turn, startSeq: event.seq, lastUserSeq: userSeq(events), requestId: recoveryId(session.id, event.seq) }
        if (!valid(row)) return
        if (index < 0) rows.push(row)
        else if (rows[index].startSeq < event.seq) rows[index] = row
      } else if (index >= 0) {
        if (event.type === 'turn/end' && event.data.turn === rows[index].turn && !interrupted(event)) rows.splice(index, 1)
        else if (event.type === 'user/message') {
          const end = events.findLast(item => item.type === 'turn/end')
          if (end && end.seq > rows[index].startSeq && event.seq > end.seq) rows.splice(index, 1)
          else rows[index].lastUserSeq = Math.max(rows[index].lastUserSeq, event.seq)
        }
      }
    }).then(() => {}))
  }
  recover(): Promise<void> { return this.recovering ??= this.track(this.run()) }
  private async run(): Promise<void> {
    const candidates = await this.store.read()
    for (const row of candidates) {
      if (this.stopped) return
      if (!valid(row)) { this.runtime.report(row?.sessionId ?? '', 'invalid-record'); continue }
      try {
        const observed = await this.runtime.inspect(row.sessionId)
        if (!this.allowed(row.sessionId, observed.meta) || !matches(row, observed.events)) { await this.forget(row); continue }
        if (row.state) { this.runtime.report(row.sessionId, 'manual-continuation-required'); continue }
        if (this.runtime.get(row.sessionId)?.status === 'running') continue
        const resolved = await this.runtime.resolveAgent(row.sessionId)
        if ('error' in resolved) throw resolved.error
        const agent = resolved.agent
        if (!this.ready(agent, row)) continue
        const message = this.runtime.makeMessage(row.requestId, RECOVERY_TEXT)
        if (message.id !== row.requestId) throw new Error('Recovery message factory must preserve its id')
        let reserved = false
        await this.store.update(rows => {
          const current = rows.find(item => item.sessionId === row.sessionId && item.requestId === row.requestId)
          if (current && !current.state && this.ready(agent, row)) { current.state = 'reserved'; reserved = true }
        })
        // No await between this final fence and the single wake operation.
        if (!reserved || !this.ready(agent, row)) continue
        agent.followup(message)
        await this.mark(row, 'continued')
        this.runtime.report(row.sessionId, 'continued')
      } catch (error) {
        await this.mark(row, 'failed', error instanceof Error ? error.message : String(error)).catch(() => {})
        this.runtime.report(row.sessionId, 'recovery-failed', error)
      }
    }
  }
  private ready(agent: RecoveryAgent, row: RecoveryRecord): boolean {
    return !this.stopped && this.runtime.get(row.sessionId) === agent && agent.status === 'idle'
      && this.allowed(agent.id, agent.session.header) && matches(row, agent.session.snapshotEvents())
      && !received(agent, row.requestId) && agent.inbox.nextTurn.length === 0 && agent.inbox.nextStep.length === 0
  }
  private async mark(row: RecoveryRecord, state: RecoveryRecord['state'], error?: string) {
    await this.store.update(rows => { const current = rows.find(item => item.requestId === row.requestId); if (current) { current.state = state; current.error = error } })
  }
  private async forget(row: RecoveryRecord) {
    await this.store.update(rows => { const index = rows.findIndex(item => item.requestId === row.requestId); if (index >= 0) rows.splice(index, 1) })
  }
  async dispose(): Promise<void> { this.stopped = true; await Promise.allSettled([...this.pending]) }
}

/** Requires sessionController, workspaceRegistry, sessions and agents injection.
 * No global persistence scan: only the plugin's registry and currently live agents.
 */
export function installRecovery(ctx: { get(name: string): unknown; effect(callback: () => (() => Promise<void>)): unknown }, directory: string): RecoveryCoordinator {
  const controller = ctx.get('sessionController') as Pick<RecoveryRuntime, 'inspect' | 'resolveAgent'>
  const agents = ctx.get('agents') as { get(id: string): RecoveryAgent | undefined }
  const sessions = ctx.get('sessions') as { list(): RecoverySession[] }
  const workspaces = ctx.get('workspaceRegistry') as { archivedSessionIds: readonly string[] }
  const host = ctx as unknown as { on(name: string, callback: (...args: any[]) => void, options: { global: boolean }): () => void }
  const report: RecoveryRuntime['report'] = (id, reason, error) => {
    if (reason !== 'continued') console.warn(`dsh-quick-prompts: recovery ${reason} (${id})`, error ?? '')
  }
  const coordinator = new RecoveryCoordinator(createRecoveryStore(directory), {
    inspect: id => controller.inspect(id), resolveAgent: id => controller.resolveAgent(id), get: id => agents.get(id),
    eligible: (id, header) => ordinary(header) && !workspaces.archivedSessionIds.includes(id),
    makeMessage: makeRecoveryMessage, report,
  })
  ctx.effect(() => {
    const check = (work: Promise<unknown>, id = '') => { void work.catch(error => report(id, 'recovery-failed', error)) }
    const offEvent = host.on('session/event', (session: RecoverySession, event: RecoveryEvent) => check(coordinator.observe(session, event), session.id), { global: true })
    const offAgent = host.on('agent/created', ({ agent }: { agent: RecoveryAgent }) => check(coordinator.observeRunning(agent), agent.id), { global: true })
    // Dependencies are injected before this effect; defer one microtask so apply
    // can finish installing host routes without awaiting cold-session restoration.
    check(Promise.resolve().then(async () => {
      const recovery = coordinator.recover()
      for (const session of sessions.list()) {
        const agent = agents.get(session.id)
        if (agent) await coordinator.observeRunning(agent)
      }
      await recovery
    }))
    return async () => { offEvent(); offAgent(); await coordinator.dispose() }
  })
  return coordinator
}
