export type Notice = { id: string; sessionId: string; kind: 'complete' | 'decision' | 'error'; title: string; body: string }
export type Session = { id: string; header?: { origin?: string; cwd?: string }; snapshotEvents?(): Event[] }
export type Event = { type: string; seq: number; data: Record<string, any> }
type Sink = { show(notice: Notice): void; dismiss(id: string): void }
const text = (value: unknown, fallback: string, limit = 160) => typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : fallback
function pending(content: unknown): boolean {
  if (!Array.isArray(content)) return false
  try { return JSON.parse(content.find(block => block.type === 'text')?.text ?? '{}').pending === true } catch { return false }
}
/** Observe committed live events only. No history replay, selected-session dependency, or focus gate. */
export class TaskMonitor {
  private states = new Map<string, { seq: number; pending: Set<string>; stepped: boolean; title?: string }>()
  private sink: Sink
  constructor(sink: Sink) { this.sink = sink }
  remove(sessionId: string): void {
    const state = this.states.get(sessionId)
    for (const key of state?.pending ?? []) this.sink.dismiss(key)
    this.sink.dismiss(`${sessionId}:end`)
    this.states.delete(sessionId)
  }
  observe(session: Session, event: Event): void {
    if (session.header?.origin === 'subagent') return
    let state = this.states.get(session.id)
    if (!state) { state = { seq: -1, pending: new Set(), stepped: false }; this.states.set(session.id, state) }
    if (event.seq <= state.seq) return
    state.seq = event.seq
    const data = event.data
    const title = () => {
      if (!state!.title) {
        const recorded = session.snapshotEvents?.().findLast(item => item.type === 'session/title')
        state!.title = text(recorded?.data.title, session.header?.cwd?.split(/[\\/]/).filter(Boolean).at(-1) ?? 'DSH 任务', 80)
      }
      return state!.title!
    }
    const showDecision = (key: string, body: string) => {
      if (state!.pending.has(key)) return
      state!.pending.add(key)
      this.sink.dismiss(`${session.id}:end`)
      this.sink.show({ id: key, sessionId: session.id, kind: 'decision', title: title(), body })
    }
    const settle = (key: string) => { state!.pending.delete(key); this.sink.dismiss(key) }
    switch (event.type) {
      case 'session/title': state.title = text(data.title, title(), 80); break
      case 'turn/start': state.stepped = false; this.sink.dismiss(`${session.id}:end`); break
      case 'step/start': state.stepped = true; break
      case 'approval/asked': showDecision(`${session.id}:approval:${data.id}`, text(data.reason, `需要确认 ${text(data.toolName, '工具操作', 60)}`)); break
      case 'approval/decided': settle(`${session.id}:approval:${data.id}`); break
      case 'tool/call':
      case 'tool/ptc-dispatch': {
        if (data.name !== 'ask_user_question') break
        if (event.type === 'tool/ptc-dispatch' && (data.isError || !pending(data.content))) break
        let args = data.arguments
        if (typeof args === 'string') { try { args = JSON.parse(args) } catch { break } }
        if (!Array.isArray(args?.questions) || !args.questions.length) break
        showDecision(`${session.id}:question:${event.type === 'tool/ptc-dispatch' ? data.subCallId : data.callId}`, text(args.questions[0].question, '任务需要你的选择，请返回会话处理。'))
        break
      }
      case 'tool/result': if (!pending(data.message?.content) && !['TOOL_OUTCOME_UNKNOWN', 'tool/outcome-unknown'].includes(data.error?.code)) settle(`${session.id}:question:${data.message?.toolCallId}`); break
      case 'user/message': if (data.source?.kind === 'user-question-reply') settle(`${session.id}:question:${data.source.callId}`); break
      case 'turn/end': {
        // Cancellation, interruption, rejection and empty turns are never success.
        const reason = data.reason?.kind
        if (reason !== 'completed') {
          for (const key of [...state.pending]) settle(key)
          if (reason === 'error') this.sink.show({ id: `${session.id}:end`, sessionId: session.id, kind: 'error', title: title(), body: '任务出现异常，请返回会话查看。' })
        } else if ((state.stepped || data.turn != null && session.snapshotEvents?.().some(item => item.type === 'step/start' && item.data.turn === data.turn)) && !state.pending.size) this.sink.show({ id: `${session.id}:end`, sessionId: session.id, kind: 'complete', title: title(), body: '本轮任务已完成，点击查看结果。' })
        state.stepped = false
        break
      }
    }
  }
}
