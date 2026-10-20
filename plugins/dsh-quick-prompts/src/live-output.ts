const LIMIT = 24000
const join = (before: string, after: string) => [before, after].filter(Boolean).join('\n\n').slice(-LIMIT)
export type AssistantFrame = {
  type: 'start' | 'chunk' | 'end'; attemptId: string; index?: number
  chunk?: { type: string; text?: string }
  outcome?: { kind: string; eventType?: string }
}
/** Public text only. Reasoning, tool arguments and protocol frames stay out. */
export class LiveOutput {
  text = ''
  private attempt?: { id: string; index: number; before: string; text: string; committed: boolean; ended: boolean }
  frame(frame: AssistantFrame): void {
    if (frame.type === 'start') {
      if (this.attempt?.id === frame.attemptId) return
      if (this.attempt && !this.attempt.committed && !this.attempt.ended) this.text = this.attempt.before
      this.attempt = { id: frame.attemptId, index: 0, before: this.text, text: '', committed: false, ended: false }
      return
    }
    const attempt = this.attempt
    if (!attempt || attempt.id !== frame.attemptId || attempt.ended) return
    if (frame.type === 'end') {
      attempt.ended = true
      if (!attempt.committed && (frame.outcome?.kind === 'abandoned' || frame.outcome?.eventType === 'assistant/attempt')) this.text = attempt.before
      return
    }
    if (frame.index !== attempt.index) return
    attempt.index++
    if (frame.chunk?.type !== 'text-delta' || typeof frame.chunk.text !== 'string' || attempt.committed) return
    attempt.text = (attempt.text + frame.chunk.text).slice(-LIMIT)
    this.text = join(attempt.before, attempt.text)
  }
  message(text: string): void {
    if (!text) return
    if (this.attempt && !this.attempt.committed) {
      this.text = join(this.attempt.before, text)
      this.attempt.committed = true
    } else this.append(text)
  }
  append(text: string): void { if (text) this.text = join(this.text, text) }
}
