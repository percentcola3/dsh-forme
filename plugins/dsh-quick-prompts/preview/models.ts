import React from 'react'
import { createRoot } from 'react-dom/client'
import { QuickPrompts } from '../src/client/index.ts'
import { createTasks } from '../src/client/tasks.ts'
import { styles } from '../src/client/styles.ts'
import type { Context } from '@deepseek-ai/cordis'
import type { Prompt } from '../src/types.ts'
const style = document.createElement('style'); style.textContent = styles; document.head.appendChild(style)
let prompts: Prompt[] = [{ id: 'sample', name: '安装和启动', text: '检查项目并执行安装和启动步骤。' }]
const scope = { projectId: 'preview', cwd: '/示例项目' }
const tasks = createTasks(async (action, body) => {
  if (action === 'models') return { ...scope, models: [
    { provider: 'sample-a', model: 'fast', label: '快速模型', providerLabel: '示例提供方 A' },
    { provider: 'sample-a', model: 'deep', label: '推理模型', providerLabel: '示例提供方 A' },
    { provider: 'sample-b', model: 'coding', label: '代码模型', providerLabel: '示例提供方 B' },
  ] }
  if (action === 'save') {
    const saved = JSON.parse(JSON.stringify(body))
    prompts = [{ id: 'sample', name: saved.name, text: saved.text, ...(saved.model ? { model: saved.model } : {}) }]
    document.querySelector('#saved')!.textContent = JSON.stringify(saved, null, 2)
  } else if (action === 'start') throw new Error('仅供界面预览，不执行任务。')
  return { ...scope, prompts, runs: [] }
})
const ctx = { get: () => ({ selection: { getSnapshot: () => ({ sessionId: 'preview' }) } }) } as unknown as Context
void tasks.select('preview').then(() => createRoot(document.querySelector('#root')!).render(React.createElement(QuickPrompts, { ctx, tasks, sessionId: 'preview' })))
