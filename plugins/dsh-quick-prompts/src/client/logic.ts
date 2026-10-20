import type { Context } from '@deepseek-ai/cordis'
export function shortName(name: string): string {
  return Array.from(new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(name), item => item.segment).slice(0, 5).join('')
}
export function currentSessionId(ctx: Pick<Context, 'get'>): string | undefined {
  return (ctx.get('uiWorkspace') as { selection: { getSnapshot(): { sessionId?: string } } }).selection.getSnapshot().sessionId
}
