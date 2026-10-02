import type { Context } from '@deepseek-ai/cordis'
export function shortName(name: string): string {
  return Array.from(new Intl.Segmenter('zh',{granularity:'grapheme'}).segment(name), item => item.segment).slice(0,5).join('')
}
export function currentSessionId(ctx: Pick<Context,'get'>): string | undefined {
  const navigation = ctx.get('uiWorkspace') as {selection:{getSnapshot():{sessionId?:string}}}
  return navigation.selection.getSnapshot().sessionId
}
export async function sendPrompt(ctx: Pick<Context,'get'>, sessionId: string | undefined, text: string): Promise<void> {
  const sessions=ctx.get('sessions') as {scope(id:string):Context|undefined}
  if(!sessionId||currentSessionId(ctx)!==sessionId)throw new Error('请先选择要发送的对话。')
  const scope=sessions.scope(sessionId)
  const conversation=scope?.get('conversation') as {send(text:string):Promise<void>}|undefined
  if(!conversation)throw new Error('当前对话暂不可用。')
  await conversation.send(text)
}
