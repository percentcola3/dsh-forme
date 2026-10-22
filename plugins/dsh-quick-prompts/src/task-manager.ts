import { randomUUID } from 'node:crypto'
import { LiveOutput, type AssistantFrame } from './live-output.ts'
import type { Project } from './project-prompts.ts'
import { validateModel } from './models.ts'
import { active, type ModelSelection, type Prompt, type TaskRun } from './types.ts'
export type Parent = { id: string; session: { header: { id: string; cwd?: string }; snapshotEvents?(): { type: string; data: Record<string, any> }[] } }
export type Receipt = { childId: string; result: Promise<{ output?: { type: string; text?: string }[]; stopReason: string; diagnostic?: unknown }>; dispose(): Promise<unknown> }
export type Runtime = {
  kind?: 'conversation' | 'headless'
  getProvider(name: string): unknown
  resolveMaxDepth(config?: number): number | undefined
  startActivation(spec: { provider: string; childId: string; label: string; request: { parent: Parent; cwd: string; prompt: { type: 'text'; text: string }[]; maxDepth?: number; agentOptions?: ModelSelection }; signal: AbortSignal; delivery: 'caller' }): Promise<Receipt>
  prompt(request: { requestId: string; parentSessionId: string; childSessionId: string; mode: 'continuable'; delivery: 'queue'; content: { type: 'text'; text: string }[] }, signal: AbortSignal): Promise<{ messageId: string }>
  interrupt(childId: string, authority: { kind: 'user'; parentSessionId: string }): void
}
type Entry = { run: TaskRun; controller: AbortController; receipt?: Receipt; admission?: Promise<void>; pending: Set<string>; parent: Parent; live: LiveOutput; chat: LiveOutput; replyId: string; replies: Map<string, string>; replying?: boolean; settled?: boolean; turnActive?: boolean }
const textOf = (blocks: unknown): string => Array.isArray(blocks) ? blocks.filter(block => block?.type === 'text' && typeof block.text === 'string').map(block => block.text).join('\n').slice(-24000) : ''
const messageOf = (error: unknown) => error instanceof Error ? error.message : String(error)
export const CONTEXT = '你正在执行用户从快捷指令栏启动的后台子任务。仅处理下面的任务内容，完成后给出清晰结果。主对话继续独立运行，不要调用 send_message 给主 Agent 发送进度或触发它继续执行。若内容是命令，请由你使用当前获准的工具执行并反馈结果；遵守继承的权限和审批规则，遇到限制明确说明。'
export class TaskManager {
  private entries = new Map<string, Entry>()
  private runtime: Runtime
  private closed = false
  constructor(runtime: Runtime) { this.runtime = runtime }
  list(projectId?: string): TaskRun[] { return [...this.entries.values()].filter(entry => !entry.run.dismissed && (!projectId || entry.run.projectId === projectId)).map(entry => structuredClone(entry.run)).reverse() }
  start(parent: Parent, prompt: Prompt, requestId: string, project: Project = { id: parent.session.header.cwd ?? parent.id, cwd: parent.session.header.cwd ?? '' }): TaskRun {
    if (this.closed) throw new Error('快捷任务服务正在关闭。')
    const previous = [...this.entries.values()].find(entry => entry.run.projectId === project.id && entry.run.parentId === parent.id && entry.run.requestId === requestId)
    if (previous) {
      if (previous.run.promptId !== prompt.id) throw new Error('请求编号已用于其他任务。')
      return structuredClone(previous.run)
    }
    if (!this.runtime.getProvider('spawn')) throw new Error('DSH 尚未加载原生 spawn 子 Agent，请检查子 Agent 插件。')
    const maxDepth = this.runtime.resolveMaxDepth()
    const finished = [...this.entries.values()].filter(entry => !active(entry.run.status))
    while (this.entries.size >= 100 && finished.length) {
      const old = finished.shift()!
      this.entries.delete(old.run.id)
      void old.receipt?.dispose().catch(() => {})
    }
    if (this.entries.size >= 100) throw new Error('后台任务过多，请先等待部分任务结束。')
    const now = Date.now()
    const parentTitle = parent.session.snapshotEvents?.().findLast(event => event.type === 'session/title')?.data.title
    const entry: Entry = {
      run: { sessionKind: this.runtime.kind, id: randomUUID(), projectId: project.id, cwd: project.cwd, requestId, promptId: prompt.id, name: prompt.name, parentId: parent.id, parentTitle: typeof parentTitle === 'string' ? parentTitle.slice(0, 100) : parent.session.header.cwd?.split(/[\\/]/).at(-1) ?? '主会话', childId: randomUUID(), status: 'starting', startedAt: now, updatedAt: now, output: '', messages: [{ id: `${requestId}:user`, role: 'user', text: prompt.text }], progress: '正在创建原生子 Agent…', steps: 0, tools: [] },
      controller: new AbortController(), pending: new Set(), parent, live: new LiveOutput(), chat: new LiveOutput(), replyId: `${requestId}:assistant`, replies: new Map(),
    }
    this.entries.set(entry.run.id, entry)
    entry.admission = this.launch(entry, prompt, maxDepth)
    return structuredClone(entry.run)
  }
  private async launch(entry: Entry, prompt: Prompt, maxDepth: number | undefined): Promise<void> {
    try {
      const model = validateModel(prompt.model)
      const receipt = await this.runtime.startActivation({ provider: 'spawn', childId: entry.run.childId, label: prompt.name, request: { parent: entry.parent, cwd: entry.run.cwd, prompt: [{ type: 'text', text: CONTEXT }, { type: 'text', text: prompt.text }], ...model ? { agentOptions: model } : {}, ...maxDepth === undefined ? {} : { maxDepth } }, signal: entry.controller.signal, delivery: 'caller' })
      entry.receipt = receipt; entry.run.childId = receipt.childId
      // Observe the result before teardown can reject it. Admission stays separate
      // from execution so unloading can await late receipts and release only ours.
      void this.settle(entry, receipt)
      if (entry.run.status === 'stopping' || this.closed) this.runtime.interrupt(receipt.childId, { kind: 'user', parentSessionId: entry.run.parentId })
      else { entry.run.status = entry.pending.size ? 'waiting' : 'running'; if (!entry.run.steps) entry.run.progress = 'AI 正在执行后台任务…' }
      entry.run.updatedAt = Date.now()
    } catch (error) { this.fail(entry, error) }
  }
  private async settle(entry: Entry, receipt: Receipt): Promise<void> {
    try {
      const result = await receipt.result
      entry.settled = true
      entry.run.output = textOf(result.output) || entry.run.output
      if (!entry.chat.text && entry.run.output) this.chatText(entry, entry.run.output)
      this.finish(entry, result.stopReason)
    } catch (error) { this.fail(entry, error) }
    finally {
      for (const tool of entry.run.tools) if (tool.state === 'running') tool.state = 'ended'
      entry.run.updatedAt = Date.now()
    }
  }
  private finish(entry: Entry, reason: string): void {
    const run = entry.run
    // A question can outlive its initial turn. Keep observing the same durable
    // child when the user answers in its native session; idle is not completion.
    if (reason === 'completed' && entry.pending.size && !entry.controller.signal.aborted) {
      run.status = 'waiting'; run.progress = '任务需要你的处理，请打开完整记录。'
      return
    }
    if (reason === 'completed') { run.status = 'completed'; run.progress = '后台任务已完成' }
    else if (['aborted', 'interrupted'].includes(reason)) { entry.pending.clear(); run.status = 'stopped'; run.progress = '后台任务已停止' }
    else {
      run.status = 'failed'; run.progress = '任务未能完成'
      run.error = reason === 'blocked' ? '子 Agent 被权限或执行规则阻止，请查看结果中的说明。' : reason === 'max-tokens' ? '已达到输出上限，任务未完整完成。' : '子 Agent 执行失败，请查看结果或完整记录。'
    }
    for (const tool of run.tools) if (tool.state === 'running') tool.state = 'ended'
    run.endedAt = Date.now(); run.updatedAt = Date.now()
  }
  private fail(entry: Entry, error: unknown): void {
    entry.run.status = entry.controller.signal.aborted ? 'stopped' : 'failed'
    entry.run.error = entry.controller.signal.aborted ? undefined : messageOf(error)
    entry.run.progress = entry.controller.signal.aborted ? '后台任务已停止' : '启动或执行失败'
    for (const tool of entry.run.tools) if (tool.state === 'running') tool.state = 'ended'
    entry.run.endedAt = Date.now(); entry.run.updatedAt = Date.now()
  }
  async reply(id: string, projectId: string, text: unknown, requestId: unknown): Promise<TaskRun> {
    if (this.closed) throw new Error('快捷任务服务正在关闭。')
    if (typeof text !== 'string' || !text.trim() || text.length > 32000 || text.includes('\0')) throw new Error('消息不能为空，且不能超过 32,000 字。')
    if (typeof requestId !== 'string' || !requestId || requestId.length > 100) throw new Error('消息请求编号无效。')
    const entry = this.entries.get(id)
    if (!entry || entry.run.projectId !== projectId || entry.run.dismissed) throw new Error('对话不属于当前项目或已关闭。')
    const previous = entry.replies.get(requestId)
    if (previous !== undefined) {
      if (previous !== text) throw new Error('请求编号已用于其他消息。')
      // Concurrent HTTP retries wait for the same admission, never queue twice.
      await entry.admission
      return structuredClone(entry.run)
    }
    if (active(entry.run.status)) throw new Error(entry.run.status === 'waiting' ? '请先在完整对话中处理审批或选择。' : 'AI 正在回复，请等本轮结束后发送。')
    if (!entry.receipt || !entry.settled) throw new Error('子会话尚未就绪，请重新启动此快捷任务。')
    if (typeof this.runtime.prompt !== 'function') throw new Error('当前 DSH 版本不支持子会话续聊，请升级后重试。')
    // Queue a real human message to the exact original child. Never spawn a new
    // child or send a model-authored message to the parent/main conversation.
    entry.replies.set(requestId, text)
    while (entry.replies.size > 200) entry.replies.delete(entry.replies.keys().next().value!)
    entry.controller = new AbortController()
    entry.replying = true; entry.turnActive = false
    entry.live = new LiveOutput(); entry.chat = new LiveOutput(); entry.replyId = `${requestId}:assistant`
    const run = entry.run
    run.messages ??= []
    run.messages.push({ id: `${requestId}:user`, role: 'user', text })
    run.output = ''; run.liveOutput = ''; run.error = undefined; run.endedAt = undefined
    run.status = 'starting'; run.progress = '正在发送消息…'; run.updatedAt = Date.now()
    entry.admission = (async () => {
      try {
        await this.runtime.prompt({ requestId, parentSessionId: run.parentId, childSessionId: run.childId, mode: 'continuable', delivery: 'queue', content: [{ type: 'text', text }] }, entry.controller.signal)
        if (entry.controller.signal.aborted || this.closed || run.dismissed) {
          this.runtime.interrupt(run.childId, { kind: 'user', parentSessionId: run.parentId })
          if (!entry.turnActive) this.finish(entry, 'aborted')
        } else if (run.status === 'starting') { run.status = 'running'; run.progress = 'AI 正在回复…' }
      } catch (error) {
        // Admission failed: retain the typed draft in the client and do not show
        // an unsent user bubble. A retry carries the same native request ID.
        entry.replies.delete(requestId)
        run.messages = run.messages?.filter(message => message.id !== `${requestId}:user`)
        this.fail(entry, error)
        throw error
      } finally { entry.replying = false; run.updatedAt = Date.now() }
    })()
    await entry.admission
    return structuredClone(run)
  }
  close(id: string, projectId: string): void {
    this.stop(id, projectId)
    const entry = this.entries.get(id)!
    entry.run.dismissed = true
    // Release scoped model hooks and ownership even when the card is closed
    // before its admission finishes. Durable conversation history stays intact.
    void Promise.resolve(entry.admission).catch(() => {}).then(() => entry.receipt?.dispose()).catch(error => console.warn('dsh-quick-prompts: conversation cleanup failed', error))
  }
  stop(id: string, projectId?: string): void {
    const entry = this.entries.get(id)
    if (!entry || (projectId !== undefined && entry.run.projectId !== projectId)) throw new Error('后台任务不属于当前项目或已结束。')
    if (!active(entry.run.status) || entry.run.status === 'stopping') return
    if (entry.replying) entry.controller.abort()
    if (entry.settled && entry.run.status === 'waiting' && !entry.turnActive) {
      entry.controller.abort(); this.runtime.interrupt(entry.run.childId, { kind: 'user', parentSessionId: entry.run.parentId }); this.finish(entry, 'aborted'); return
    }
    if (entry.receipt) this.runtime.interrupt(entry.run.childId, { kind: 'user', parentSessionId: entry.run.parentId })
    else entry.controller.abort()
    entry.run.status = 'stopping'; entry.run.progress = '正在停止子 Agent…'; entry.run.updatedAt = Date.now()
  }
  private chatText(entry: Entry, text: string): void {
    const messages = entry.run.messages ??= []
    const previous = messages.find(message => message.id === entry.replyId)
    if (previous) previous.text = text
    else if (text) messages.push({ id: entry.replyId, role: 'assistant', text })
    // The durable child owns the full transcript. Keep a bounded card projection.
    let size = messages.reduce((total, message) => total + message.text.length, 0)
    while (messages.length > 2 && (messages.length > 48 || size > 96000)) size -= messages.shift()!.text.length
  }
  stream(sessionId: string, frame: AssistantFrame): void {
    const entry = [...this.entries.values()].find(entry => entry.run.childId === sessionId && active(entry.run.status))
    if (!entry) return
    entry.live.frame(frame)
    entry.chat.frame(frame); this.chatText(entry, entry.chat.text)
    entry.run.liveOutput = entry.live.text
    entry.run.updatedAt = Date.now()
  }
  observe(sessionId: string, event: { type: string; data: Record<string, any> }): void {
    const entry = [...this.entries.values()].find(entry => entry.run.childId === sessionId && active(entry.run.status))
    if (!entry) return
    const { run, pending } = entry; const data = event.data
    switch (event.type) {
      case 'turn/start': entry.turnActive = true; run.progress = 'AI 正在执行后台任务…'; break
      case 'step/start': entry.turnActive = true; run.steps++; run.progress = `正在执行第 ${run.steps} 步`; break
      case 'tool/call':
        run.tools.push({ callId: data.callId, name: String(data.name).slice(0, 100), state: 'running' }); run.tools = run.tools.slice(-6)
        run.progress = `正在调用 ${String(data.name).slice(0, 100)}`
        if (data.name === 'ask_user_question') pending.add(`question:${data.callId}`)
        break
      case 'tool/result': {
        const output = textOf(data.message?.content)
        entry.live.append(output); run.liveOutput = entry.live.text
        const tool = run.tools.find(tool => tool.callId === data.message?.toolCallId)
        if (tool) tool.state = data.message?.isError || data.error ? 'failed' : 'done'
        let continued = false
        try { continued = JSON.parse(textOf(data.message?.content)).pending === true } catch {}
        if (!continued && !['TOOL_OUTCOME_UNKNOWN', 'tool/outcome-unknown'].includes(data.error?.code)) pending.delete(`question:${data.message?.toolCallId}`)
        break
      }
      case 'tool/ptc-dispatch': {
        if (data.name === 'ask_user_question' && !data.isError) {
          try { if (JSON.parse(textOf(data.content)).pending === true) pending.add(`question:${data.subCallId}`) } catch {}
        }
        break
      }
      case 'approval/asked': pending.add(`approval:${data.id}`); run.progress = '需要处理权限或审批请求'; break
      case 'approval/decided': pending.delete(`approval:${data.id}`); break
      case 'user/message': if (data.source?.kind === 'user-question-reply') { pending.delete(`question:${data.source.callId}`); run.progress = '已收到回复，继续执行…' } break
      case 'assistant/message': {
        if (data.message?.channel === 'analysis') return
        const text = textOf(data.message?.content)
        if (text) { run.output = text; entry.live.message(text); entry.chat.message(text); this.chatText(entry, entry.chat.text); run.liveOutput = entry.live.text }
        break
      }
      case 'turn/end':
        entry.turnActive = false
        if (entry.settled) this.finish(entry, data.reason?.kind ?? 'error')
        else if (data.reason?.kind !== 'completed') run.progress = '正在整理执行结果…'
        break
      default: return
    }
    if (active(run.status) && run.status !== 'stopping') run.status = pending.size ? 'waiting' : run.status === 'starting' ? 'starting' : 'running'
    if (run.status === 'waiting') run.progress = '任务需要你的处理，请打开完整记录。'
    run.updatedAt = Date.now()
  }
  async dispose(): Promise<void> {
    this.closed = true
    const entries = [...this.entries.values()]
    for (const entry of entries) entry.controller.abort()
    await Promise.allSettled(entries.map(entry => entry.admission))
    await Promise.allSettled(entries.map(entry => entry.receipt?.dispose()))
  }
}
