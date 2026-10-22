import type { Parent, Receipt, Runtime } from './task-manager.ts'

type Scope = { get(name: string): any }
type Agent = {
  id: string; ctx: Scope
  session: { append(type: string, data: unknown): unknown }
  followup(message: { id: string; role: 'user'; content: { type: 'text'; text: string }[]; source: { kind: 'user' } }): unknown
  cancel(reason: { kind: 'user' }, options: { keepInbox: false }): void
}
type Handle = { agent: Agent; dispose(): Promise<unknown> }
export type HeadlessAgents = { create(options: { sessionId: string; meta: Record<string, unknown>; agentOptions: Record<string, unknown>; signal: AbortSignal; setup(scope: Scope, agent: Agent): Promise<void> }): Promise<Handle> }
const GUIDANCE = '这是即用即弃的快捷任务。只在当前对话回复，不联系主会话或其他 Agent。需要用户补充信息时直接用文本提问，用户会在卡片中回复。权限范围在启动时固定；遇到需要额外审批的操作，说明限制并停止，不重试或绕过限制。'

/** Own a hidden agent directly: no workspace attachment or subagent settlement route. */
export class HeadlessRuntime implements Runtime {
  readonly kind = 'headless' as const
  private handles = new Map<string, Handle>()
  private initial = new Map<string, (value: { stopReason: string }) => void>()
  private agents: HeadlessAgents
  constructor(agents: HeadlessAgents) { this.agents = agents }
  getProvider() { return this }
  resolveMaxDepth() { return undefined }
  observe(id: string, event: { type: string; data: Record<string, any> }): void {
    if (event.type !== 'turn/end') return
    const resolve = this.initial.get(id)
    this.initial.delete(id)
    resolve?.({ stopReason: event.data.reason?.kind ?? 'error' })
  }
  async startActivation(spec: Parameters<Runtime['startActivation']>[0]): Promise<Receipt> {
    const parent = spec.request.parent as Parent & { ctx: Scope; options?: Record<string, unknown>; session: Parent['session'] & { requestHeader?(): { config?: Record<string, unknown> } } }
    if (spec.childId === parent.id || this.handles.has(spec.childId)) throw new Error('快捷任务必须使用独立会话。')
    spec.signal.throwIfAborted()
    const config = parent.session.requestHeader?.()?.config ?? parent.options ?? {}
    const events = parent.session.snapshotEvents?.() ?? []
    const route = spec.request.agentOptions ?? events.findLast(event => event.type === 'model/selection')?.data ?? config
    const agentOptions = { provider: route.provider, model: route.model, ...(!spec.request.agentOptions && route.provider === config.provider && route.model === config.model && config.reasoningEffort ? { reasoningEffort: config.reasoningEffort } : {}) }
    const sandboxMode = parent.ctx.get('sandboxPolicy')?.overrideOf(parent.session)
    const permissionPreset = parent.ctx.get('permissionPresets')?.current(parent.session)
    const preset = parent.ctx.get('agentPresets')?.composedPreset(parent.ctx)
    const handle = await this.agents.create({
      sessionId: spec.childId,
      // Native navigation excludes origin=subagent. This is metadata only:
      // deliberately omit parentAgent and never register a subagent activation.
      meta: { origin: 'subagent', parentSession: parent.session.header.id, cwd: spec.request.cwd, isSeeded: false, ...(preset ? { agentPreset: preset } : {}) },
      agentOptions, signal: spec.signal,
      setup: async (scope, agent) => {
        const presets = scope.get('agentPresets')
        if (!presets) throw new Error('DSH 尚未加载 Agent 配置服务。')
        presets.composeFrom(scope, parent.ctx)
        // Same fixed permission boundary as native delegated tasks.
        if (sandboxMode !== undefined) agent.session.append('sandbox/mode', { mode: sandboxMode, source: 'delegation' })
        agent.session.append('approval/policy', { policy: 'never', source: 'delegation' })
        if (permissionPreset === 'auto' || permissionPreset === 'danger-full-access') agent.session.append('permission/preset', { preset: permissionPreset })
        const tools = scope.get('tools')
        if (!tools) throw new Error('DSH 尚未加载工具服务。')
        const blocked = new Set(['send_message', 'subagent', 'subagent_fork', 'workflow', 'ask_user_question'])
        tools.guard((exec: { name: string }) => blocked.has(exec.name) ? '快捷任务只通过当前卡片交流；需要补充信息时直接回复文本，不启动其他 Agent。' : undefined)
        const directory = scope.get('workingDirectory')
        if (!directory) throw new Error('DSH 尚未加载工作目录服务。')
        await directory.set(agent, spec.request.cwd, spec.signal)
      },
    })
    if (handle.agent.id !== spec.childId) { await handle.dispose(); throw new Error('快捷任务会话身份不匹配。') }
    this.handles.set(spec.childId, handle)
    const result = new Promise<{ stopReason: string }>(resolve => this.initial.set(spec.childId, resolve))
    const dispose = async () => {
      if (!this.handles.delete(spec.childId)) return
      this.initial.get(spec.childId)?.({ stopReason: 'aborted' }); this.initial.delete(spec.childId)
      await handle.dispose()
    }
    try {
      spec.signal.throwIfAborted()
      handle.agent.followup({ id: `${spec.childId}:initial`, role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: GUIDANCE }, ...spec.request.prompt] })
      return { childId: spec.childId, result, dispose }
    } catch (error) { await dispose(); throw error }
  }
  async prompt(request: Parameters<Runtime['prompt']>[0], signal: AbortSignal): Promise<{ messageId: string }> {
    signal.throwIfAborted()
    const handle = this.handles.get(request.childSessionId)
    if (!handle) throw new Error('快捷任务已关闭，请重新启动。')
    handle.agent.followup({ id: request.requestId, role: 'user', source: { kind: 'user' }, content: request.content })
    return { messageId: request.requestId }
  }
  interrupt(id: string): void { this.handles.get(id)?.agent.cancel({ kind: 'user' }, { keepInbox: false }) }
}
