import type { ModelChoice, ModelSelection } from './types.ts'
/** Public metadata only: never read settings, credentials, or adapter internals. */
export type ModelRegistry = {
  listProviders(): { id: string; name: string }[]
  listModels(provider: string): Promise<{ id: string; name: string }[]>
}
export function validateModel(value: unknown): ModelSelection | null | undefined {
  if (value === undefined || value === null) return value
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('任务模型选择无效，请重新选择模型或跟随主会话。')
  const { provider, model } = value as Record<string, unknown>
  if ([provider, model].some(part => typeof part !== 'string' || !part.trim() || part.length > 500 || /[\u0000-\u001f\u007f]/.test(part))) throw new Error('任务模型选择无效，请重新选择模型或跟随主会话。')
  return { provider: provider as string, model: model as string }
}
export async function modelCatalog(registry: ModelRegistry | undefined): Promise<ModelChoice[]> {
  if (!registry) throw new Error('DSH 模型目录尚未就绪，请稍后重试。')
  const groups = await Promise.all(registry.listProviders().map(async provider => {
    try {
      return (await registry.listModels(provider.id)).map(model => ({ provider: provider.id, model: model.id, label: model.name, providerLabel: provider.name }))
    } catch { return [] } // A failed provider must not hide other configured providers.
  }))
  return groups.flat()
}
export async function resolveTaskModel(registry: ModelRegistry | undefined, value: unknown): Promise<ModelSelection | undefined> {
  const selection = validateModel(value)
  if (selection === null) return undefined
  if (selection !== undefined) {
    await requireAvailableModel(registry, selection)
    return selection
  }
  const identity = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')
  const choices = (await modelCatalog(registry)).filter(choice => {
    const modelIdentities = [choice.model, choice.label].map(identity)
    const deepseekModel = modelIdentities.some(model => model.includes('deepseek') && model.includes('flash'))
    const provider = identity(`${choice.provider} ${choice.providerLabel ?? ''}`)
    const shortFlash = modelIdentities.some(model => /^(?:v\d+)?flash$/.test(model))
    return !modelIdentities.some(model => model.includes('glm')) && (deepseekModel || provider.includes('deepseek') && shortFlash)
  })
  choices.sort((a, b) => {
    const official = (choice: ModelChoice) => choice.provider.toLowerCase() === 'deepseek-account' ? 0 : choice.provider.toLowerCase() === 'deepseek' ? 1 : 2
    const rank = official(a) - official(b)
    const aKey = JSON.stringify([a.provider, a.model]), bKey = JSON.stringify([b.provider, b.model])
    return rank || (aKey < bKey ? -1 : aKey > bKey ? 1 : 0)
  })
  const choice = choices[0]
  if (!choice) throw new Error('默认 DeepSeek Flash 模型当前不可用，请先配置 DeepSeek Flash，或在任务编辑器选择其他模型或跟随当前会话。')
  return { provider: choice.provider, model: choice.model }
}
export async function requireAvailableModel(registry: ModelRegistry | undefined, value: unknown): Promise<void> {
  const selection = validateModel(value)
  if (!selection) return
  if (!registry) throw new Error('DSH 模型目录尚未就绪，请稍后重试。')
  let available = false
  try {
    available = registry.listProviders().some(provider => provider.id === selection.provider) && (await registry.listModels(selection.provider)).some(model => model.id === selection.model)
  } catch { /* Do not return adapter error messages, which may include credentials. */ }
  if (!available) throw new Error(`所选模型 ${selection.provider} / ${selection.model} 当前不可用，请在任务编辑器重新选择模型或跟随主会话。`)
}
