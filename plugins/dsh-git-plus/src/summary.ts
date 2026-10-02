import { randomUUID } from 'node:crypto'

type Selection = { provider: string; model: string; reasoningEffort?: string }
type Finish = {kind:string;failure?:{message?:string}}
type Llm = {
  listProviders(): {id:string;name:string}[]
  listModels(provider:string): Promise<{id:string}[]>
  stream(request:Record<string,unknown>): AsyncIterable<{type:string;text?:string;reason?:Finish}>
}
export async function drainSummary(ctx:{get(name:string):unknown}, config:{provider:string;model:string;prompt:string}, diff:string, sessionId:string) {
  if (!diff.trim()) throw new Error('没有可用于生成提交说明的变更')
  const llm = ctx.get('llm') as Llm | undefined
  if (!llm) throw new Error('LLM 服务未加载')
  const defaults = (ctx.get('agentDefaultModel') as {currentSelection():Selection}|undefined)?.currentSelection()
  const provider = config.provider || defaults?.provider || llm.listProviders()[0]?.id
  if (!provider) throw new Error('请先配置模型提供方')
  const model = config.model || (provider === defaults?.provider ? defaults.model : '') || (await llm.listModels(provider))[0]?.id
  if (!model) throw new Error('请先配置模型')
  const signal = AbortSignal.timeout(90_000)
  const clipped = diff.length > 80_000 ? diff.slice(0,80_000) + '\n…(truncated)' : diff
  let text = '', finished = false
  for await (const chunk of llm.stream({provider,model,system:config.prompt,
    messages:[{id:randomUUID(),role:'user',source:{kind:'dsh-git-plus'},content:[{type:'text',text:clipped}]}],
    sessionId,purpose:'git-commit-message',signal,
  })) {
    signal.throwIfAborted()
    if (chunk.type === 'text-delta') text += chunk.text ?? ''
    if (chunk.type === 'finish') {
      if (chunk.reason?.kind !== 'stop') throw new Error(chunk.reason?.failure?.message ?? `生成未完成：${chunk.reason?.kind}`)
      finished = true
    }
  }
  if (!finished || !text.trim()) throw new Error('模型没有返回完整的提交说明')
  return text.trim()
}
