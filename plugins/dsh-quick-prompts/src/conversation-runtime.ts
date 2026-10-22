import type { ModelSelection } from './types.ts'
import type { Parent, Receipt, Runtime } from './task-manager.ts'

type Event = { type: string; data: Record<string, any> }
type Route = ModelSelection & { reasoningEffort?: string }
export type ConversationAgent = {
  cancel(reason: { kind: 'user' }, options: { keepInbox: false }): void
  id: string
  options?: Partial<Route>
  ctx: { on(name: string, listener: (...args: any[]) => any, options?: { prepend: boolean }): () => void }
  session: { header: { agentPreset?: string }; snapshotEvents(): Event[]; requestHeader?(): { config?: Partial<Route> } | undefined; append(type: string, data: unknown): unknown }
}
export type ConversationController = {
  create(request: { sessionId: string; cwd: string; agentPreset?: string }): Promise<{ sessionId: string }>
  resolveAgent(id: string): Promise<{ agent: ConversationAgent } | { error: unknown }>
  rename(request: { sessionId: string; title: string }): Promise<unknown>
  prompt(request: { sessionId: string; requestId: string; mode: 'queue'; content: { type: 'text'; text: string }[] }, signal: AbortSignal): Promise<unknown>
  cancel(request: { sessionId: string }): Promise<unknown>
}
const routeOf = (value: Partial<Route> | undefined): Route | undefined => value && typeof value.provider === 'string' && typeof value.model === 'string'
  ? { provider: value.provider, model: value.model, ...(value.reasoningEffort ? { reasoningEffort: value.reasoningEffort } : {}) } : undefined

/** Ordinary durable sessions have no subagent settlement route to the main chat. */
export class ConversationRuntime implements Runtime {
  readonly kind = 'conversation' as const
  private initial = new Map<string, { resolve(value: Awaited<Receipt['result']>): void }>()
  private owned = new Set<string>()
  private modelHooks = new Map<string, () => void>()
  private controller: ConversationController
  private getAgent?: (id: string) => ConversationAgent | undefined
  private live = new Map<string, ConversationAgent>()
  constructor(controller: ConversationController, getAgent?: (id: string) => ConversationAgent | undefined) { this.controller = controller; this.getAgent = getAgent }
  private cancel(id: string): void {
    const agent = this.getAgent ? this.getAgent(id) : this.live.get(id)
    agent?.cancel({ kind: 'user' }, { keepInbox: false })
  }
  getProvider() { return this }
  resolveMaxDepth() { return undefined }
  observe(id: string, event: Event): void {
    if (event.type !== 'turn/end') return
    const pending = this.initial.get(id)
    if (!pending) return
    this.initial.delete(id)
    pending.resolve({ stopReason: event.data.reason?.kind ?? 'error' })
  }
  private async configureModel(id: string, selected: Route | undefined): Promise<void> {
    const resolved = await this.controller.resolveAgent(id)
    if ('error' in resolved) throw new Error('快捷对话模型配置失败。')
    const agent = resolved.agent
    this.live.set(id, agent)
    if (!selected) return
    agent.session.append('model/selection', selected)
    // The native selectModel API also changes the GLOBAL default. These scoped
    // public waterfall hooks affect only this session. Read its durable selection
    // on each step so a later change in the full conversation is respected.
    let assembled: Route = selected
    const assembly = agent.ctx.on('system-prompt/assemble', async (_value: unknown, _context: unknown, next: () => Promise<any>) => {
      const last = agent.session.snapshotEvents().findLast(event => event.type === 'model/selection')?.data
      assembled = routeOf(last as Route) ?? selected
      const result = await next()
      return { ...result, variables: { ...result.variables, provider: assembled.provider, model: assembled.model } }
    }, { prepend: true })
    const request = agent.ctx.on('agent/request', async (_value: unknown, next: () => Promise<any>) => {
      const { reasoningEffort: _effort, ...result } = await next()
      return { ...result, ...assembled }
    }, { prepend: true })
    this.modelHooks.set(id, () => { assembly(); request() })
  }
  async startActivation(spec: Parameters<Runtime['startActivation']>[0]): Promise<Receipt> {
    spec.signal.throwIfAborted()
    const parent = spec.request.parent as Parent & { options?: Partial<Route>; session: { header: { agentPreset?: string }; requestHeader?(): { config?: Partial<Route> } | undefined } }
    const events = parent.session.snapshotEvents?.() ?? []
    const preset = events.findLast(event => event.type === 'agent-preset/selected')?.data.agentPreset ?? parent.session.header.agentPreset
    const selected = routeOf(spec.request.agentOptions) ?? routeOf(events.findLast(event => event.type === 'model/selection')?.data as Route) ?? routeOf(parent.session.requestHeader?.()?.config) ?? routeOf(parent.options)
    const created = await this.controller.create({ sessionId: spec.childId, cwd: spec.request.cwd, ...(typeof preset === 'string' ? { agentPreset: preset } : {}) })
    const id = created.sessionId
    this.owned.add(id)
    try {
      spec.signal.throwIfAborted()
      await this.configureModel(id, selected)
      await this.controller.rename({ sessionId: id, title: spec.label })
      spec.signal.throwIfAborted()
      const result = new Promise<Awaited<Receipt['result']>>(resolve => this.initial.set(id, { resolve }))
      // The shortcut text itself is the first human message; no parent history,
      // protocol instructions, tool logs or implicit main-conversation wakeups.
      await this.controller.prompt({ sessionId: id, requestId: `${spec.childId}:initial`, mode: 'queue', content: spec.request.prompt.slice(-1) }, spec.signal)
      return { childId: id, result, dispose: async () => {
        if (!this.owned.delete(id)) return
        try { this.cancel(id) }
        finally { this.initial.get(id)?.resolve({ stopReason: 'aborted' }); this.initial.delete(id); this.modelHooks.get(id)?.(); this.modelHooks.delete(id); this.live.delete(id) }
      } }
    } catch (error) {
      this.initial.get(id)?.resolve({ stopReason: 'aborted' }); this.initial.delete(id)
      this.modelHooks.get(id)?.(); this.modelHooks.delete(id); this.owned.delete(id)
      try { this.cancel(id) } catch { /* Admission already failed; preserve that error. */ }
      this.live.delete(id)
      throw error
    }
  }
  async prompt(request: Parameters<Runtime['prompt']>[0], signal: AbortSignal): Promise<{ messageId: string }> {
    if (!this.owned.has(request.childSessionId)) throw new Error('快捷对话已关闭，请重新启动。')
    signal.throwIfAborted()
    await this.controller.prompt({ sessionId: request.childSessionId, requestId: request.requestId, mode: 'queue', content: request.content }, signal)
    return { messageId: request.requestId }
  }
  interrupt(id: string): void {
    if (this.owned.has(id)) this.cancel(id)
  }
}
