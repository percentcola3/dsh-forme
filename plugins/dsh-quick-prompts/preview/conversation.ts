import React from 'react'
import { createRoot } from 'react-dom/client'
import type { Context } from '@deepseek-ai/cordis'
import { QuickPrompts, TaskPanel } from '../src/client/index.ts'
import { createTasks } from '../src/client/tasks.ts'
import { styles } from '../src/client/styles.ts'
import type { TaskRun } from '../src/types.ts'
const h = React.createElement
const style = document.createElement('style'); style.textContent = styles; document.head.appendChild(style)
const scope = { projectId: 'demo', cwd: '/项目/轻量对话' }
const prompts = [{ id: 'review', name: '检查代码', text: '检查当前项目，列出值得修复的问题。' }]
let runs: TaskRun[] = []
let replies = 0
let failNext = false
const tasks = createTasks(async (action, body) => {
  if (action === 'list') return { ...scope, prompts }
  if (action === 'start') {
    const now = Date.now()
    const run: TaskRun = { id: crypto.randomUUID(), requestId: body.requestId as string, promptId: 'review', name: '检查代码', projectId: 'demo', cwd: scope.cwd, parentId: 'main', parentTitle: '项目开发', childId: 'demo-conversation', sessionKind: 'conversation', status: 'completed', startedAt: now, updatedAt: now, output: '已检查项目。', progress: '', steps: 2, tools: [], messages: [{ id: 'u0', role: 'user', text: prompts[0]!.text }, { id: 'a0', role: 'assistant', text: '已检查项目，建议优先处理两处：\n\n1. 请求失败后保留输入，方便重试。\n2. 列表为空时显示明确的空状态。\n\n需要的话，我可以继续给出修改方案。' }] }
    runs.push(run); return { ...scope, run: structuredClone(run) }
  }
  if (action === 'reply') {
    replies++
    document.querySelector('#send-count')!.textContent = String(replies)
    if (failNext) { failNext = false; throw new Error('模拟网络中断，请重试。') }
    const run = runs.find(run => run.id === body.runId)!
    run.messages!.push({ id: `${body.requestId}:user`, role: 'user', text: String(body.text) })
    run.messages!.push({ id: `${body.requestId}:assistant`, role: 'assistant', text: `收到「${body.text}」。\n\n继续在同一个独立会话中处理，之前的检查结果仍在上下文里。` })
    run.updatedAt = Date.now()
    return { ...scope, run: structuredClone(run) }
  }
  if (action === 'close') runs = runs.filter(run => run.id !== body.runId)
  if (action === 'models') return { ...scope, models: [] }
  return { ...scope, runs: structuredClone(runs) }
})
const ctx = { get: () => ({ selection: { getSnapshot: () => ({ sessionId: 'main' }) }, openSession: (id: string) => { document.querySelector('#opened')!.textContent = `完整对话：${id}` } }) } as unknown as Context
function Demo() {
  return h('div', { 'data-slot': 'main.conversation' },
    h('header', null, h('b', null, '项目开发'), h('small', null, '快捷任务 · 轻量对话预览')),
    h('div', { 'data-conversation-content': '', style: { height: '640px' } },
      h('div', { 'data-conversation-scroll': '', className: 'demo-chat' },
        h('div', { className: 'demo-messages' }, h('p', { className: 'demo-user' }, '帮我继续实现项目里的功能。'), h('p', null, '主对话保持独立。右侧可以运行快捷指令，也可以继续追问结果。')),
        h('div', { 'data-composer-seat': '' }, h('div', { 'data-composer-card': '', className: 'demo-composer' }, h('textarea', { placeholder: '给主对话发送消息…', 'aria-label': '主对话输入' }), h(QuickPrompts, { ctx, tasks, sessionId: 'main' }))))),
    h(TaskPanel, { ctx, tasks }))
}
void tasks.select('main').then(async () => {
  createRoot(document.querySelector('#root')!).render(h(Demo))
  await tasks.start('main', 'review')
})
document.querySelector('#fail-next')!.addEventListener('click', () => { failNext = true })
