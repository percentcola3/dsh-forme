import React from 'react'
import type { ModelChoice, ModelSelection } from '../types.ts'
import type { TaskStore } from './tasks.ts'
const h = React.createElement
export const modelKey = (value?: ModelSelection) => value ? JSON.stringify([value.provider, value.model]) : ''

export function TaskModelPicker({ tasks, value, disabled, onChange }: {
  tasks: TaskStore; value?: ModelSelection; disabled: boolean; onChange(value: ModelSelection | undefined): void
}): React.ReactElement {
  const [models, setModels] = React.useState<ModelChoice[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [revision, retry] = React.useReducer((value: number) => value + 1, 0)
  React.useEffect(() => {
    let active = true
    setLoading(true); setError('')
    void tasks.models().then(items => { if (active) setModels(items) }).catch(error => {
      if (active) setError(error instanceof Error ? error.message : String(error))
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [tasks, revision])
  const selected = modelKey(value)
  const missing = !!value && !models.some(item => modelKey(item) === selected)
  const groups = new Map<string, ModelChoice[]>()
  for (const model of models) groups.set(model.provider, [...groups.get(model.provider) ?? [], model])
  return h('div', { className: 'dqp-model-field' },
    h('label', null, '执行模型', h('select', {
      value: selected, disabled, 'aria-busy': loading,
      onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
        if (!event.target.value) { onChange(undefined); return }
        const choice = models.find(item => modelKey(item) === event.target.value)
        if (choice) onChange({ provider: choice.provider, model: choice.model })
      },
    }, h('option', { value: '' }, '跟随当前会话模型'),
    missing && h('option', { value: selected, disabled: true }, `${value!.provider} / ${value!.model}（${loading ? '正在核对' : error ? '暂无法核对' : '当前不可用'}）`),
    ...[...groups].map(([provider, entries]) => h('optgroup', { key: provider, label: entries[0].providerLabel || provider },
      ...entries.map(item => h('option', { key: modelKey(item), value: modelKey(item) }, item.label === item.model ? item.label : `${item.label} · ${item.model}`)))))),
    h('small', null, value ? '此快捷任务固定使用所选模型，主对话的模型不变。' : '执行时使用当前会话的模型；以后切换会话模型时自动跟随。'),
    loading && h('small', { role: 'status' }, '正在加载可用模型…'),
    error && h('div', { className: 'dqp-model-message', role: 'alert' }, `模型列表加载失败：${error}`, h('button', { type: 'button', disabled, onClick: () => retry() }, '重试')),
    !loading && !error && !models.length && h('small', null, '没有可选模型，请先在 DSH 中配置模型提供方。'),
    !loading && !error && missing && h('small', { className: 'dqp-model-warning' }, '已保存的模型当前不可用，请重新选择或改为跟随当前会话。'))
}
