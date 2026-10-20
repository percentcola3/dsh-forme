import React from 'react'
import { createPortal } from 'react-dom'
import type { Context } from '@deepseek-ai/cordis'
import { taskRequest, createTasks, openRun, type TaskStore, type Prompt } from './tasks.ts'
import { shortName, currentSessionId } from './logic.ts'
import { active, statusLabels, type TaskRun } from '../types.ts'
import { styles } from './styles.ts'
export const inject = ['slots', 'uiWorkspace']
const h = React.createElement
type Draft = Omit<Prompt, 'id'> & { id?: string }
export function apply(ctx: Context): void {
  const tasks = createTasks()
  const slots = ctx.get('slots') as { inject(name: string, register: () => () => void): () => void; register(options: { name: string; id: string; order: number }, render: (props: { sessionId?: string }) => React.ReactElement | null): () => void }
  ctx.effect(() => slots.inject('conversation.input.overlay', () => slots.register({ name: 'conversation.input.overlay', id: 'dsh-quick-prompts', order: 5 }, props => h(QuickPrompts, { ctx, tasks, sessionId: props.sessionId, key: props.sessionId }))))
  ctx.effect(() => slots.inject('shell.overlay', () => slots.register({ name: 'shell.overlay', id: 'dsh-quick-prompts-panel', order: 95 }, () => h(TaskPanel, { ctx, tasks }))))
  ctx.effect(() => { const style = document.createElement('style'); style.textContent = styles; document.head.appendChild(style); return () => style.remove() })
  ctx.effect(() => {
    const poll = () => { void tasks.refresh().catch(() => {}) }
    poll(); const timer = setInterval(poll, 1200)
    window.addEventListener('focus', poll)
    return () => { clearInterval(timer); window.removeEventListener('focus', poll) }
  })
}
export function QuickPrompts({ ctx, tasks, sessionId }: { ctx: Context; tasks: TaskStore; sessionId?: string }): React.ReactElement {
  const state = React.useSyncExternalStore(tasks.subscribe, tasks.getSnapshot)
  const [items, setItems] = React.useState<Prompt[]>([])
  const [draft, setDraft] = React.useState<Draft | null>(null)
  const [error, setError] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const submitting = React.useRef(false)
  const nameInput = React.useRef<HTMLInputElement>(null)
  const trigger = React.useRef<HTMLButtonElement | null>(null)
  React.useEffect(() => { let live = true; void taskRequest('list').then(({ prompts }) => { if (live) setItems(prompts) }).catch(error => { if (live) setError(String(error.message)) }); return () => { live = false } }, [])
  const close = () => { if (submitting.current) return; setDraft(null); setError(''); trigger.current?.focus() }
  React.useEffect(() => {
    if (!draft) return
    nameInput.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !submitting.current) { setDraft(null); setError(''); trigger.current?.focus() } }
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey)
  }, [!!draft])
  const open = (event: React.MouseEvent<HTMLButtonElement>, item?: Prompt) => { trigger.current = event.currentTarget; setError(''); setDraft(item ? { ...item } : { name: '', text: '' }) }
  const save = async (action: 'save' | 'delete') => {
    if (!draft || submitting.current) return
    submitting.current = true; setSaving(true); setError('')
    try { const { prompts } = await taskRequest(action, draft); setItems(prompts); setDraft(null); trigger.current?.focus() }
    catch (error) { setError(error instanceof Error ? error.message : String(error)) }
    finally { submitting.current = false; setSaving(false) }
  }
  const start = (item: Prompt) => {
    if (!sessionId || currentSessionId(ctx) !== sessionId) { setError('请先选择主会话。'); return }
    setError(''); void tasks.start(sessionId, item.id)
  }
  const modal = draft ? createPortal(h('div', { className: 'dqp-backdrop', onMouseDown: (event: React.MouseEvent) => { if (event.target === event.currentTarget) close() } },
    h('form', { className: 'dqp-dialog', role: 'dialog', 'aria-modal': true, 'aria-label': draft.id ? '编辑快捷任务' : '新增快捷任务', onSubmit: (event: React.FormEvent) => { event.preventDefault(); void save('save') }, onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const nodes = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('input,textarea,button:not(:disabled)'))
      const first = nodes[0], last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    } }, h('h3', null, draft.id ? '编辑快捷任务' : '新增快捷任务'),
      h('small', null, '后台子 Agent · 主对话继续运行'),
      h('label', null, '名称', h('input', { ref: nameInput, value: draft.name, maxLength: 100, disabled: saving, placeholder: '例如：检查代码', onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, name: event.target.value }) }), h('small', null, '按钮最多显示 5 个字，悬停查看全名。')),
      h('label', null, '任务内容', h('textarea', { value: draft.text, maxLength: 32000, disabled: saving, placeholder: '描述要交给子 Agent 的任务，也可以填写需要 AI 执行的命令…', onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => setDraft({ ...draft, text: event.target.value }) })),
      h('small', null, '沿用主 Agent 的模型、工作目录与权限。结果和执行进度显示在右侧悬浮面板，不占用主对话输入框。'),
      error && h('p', { role: 'alert' }, error),
      h('footer', null, draft.id && h('button', { type: 'button', className: 'dqp-delete', disabled: saving, onClick: () => { void save('delete') } }, '删除'), h('button', { type: 'button', disabled: saving, onClick: close }, '取消'), h('button', { type: 'submit', className: 'dqp-save', disabled: saving || !draft.name.trim() || !draft.text.trim() }, saving ? '保存中…' : '保存')))), document.body) : null
  const running = state.runs.filter(run => active(run.status)).length
  return h(React.Fragment, null,
    h('div', { className: 'dqp-bar', role: 'group', 'aria-label': '快捷任务' }, h('button', { type: 'button', className: 'dqp-add', 'aria-label': '新增快捷任务', disabled: saving, onClick: (event: React.MouseEvent<HTMLButtonElement>) => open(event) }, '+'),
      h('div', { className: 'dqp-items' }, ...items.map(item =>
        h('span', { className: 'dqp-task-chip', key: item.id },
          h('button', {
            type: 'button', disabled: !sessionId || tasks.busy(sessionId, item.id),
            title: `${item.name} · 后台子 Agent\n点击执行 · 右键编辑`,
            onClick: () => start(item),
            onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => { event.preventDefault(); open(event, item) },
          }, shortName(item.name)),
          h('button', {
            type: 'button', className: 'dqp-task-edit', 'aria-label': `编辑快捷任务 ${item.name}`,
            onClick: (event: React.MouseEvent<HTMLButtonElement>) => open(event, item),
          }, h('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, 'aria-hidden': true },
            h('path', { d: 'M15 5l4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z' }))),
        ))),
      h('button', { type: 'button', className: 'dqp-panel-trigger', onClick: () => tasks.show() }, '后台任务', running ? ` ${running}` : '')),
    error && !draft && h('div', { className: 'dqp-notice', role: 'alert', title: error }, error), modal)
}
function elapsed(run: TaskRun, now: number): string { const seconds = Math.max(0, Math.floor(((run.endedAt ?? now) - run.startedAt) / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` }
export function TaskPanel({ ctx, tasks }: { ctx: Context; tasks: TaskStore }): React.ReactPortal | null {
  const state = React.useSyncExternalStore(tasks.subscribe, tasks.getSnapshot)
  const [now, setNow] = React.useState(Date.now)
  const count = state.runs.filter(run => active(run.status)).length
  React.useEffect(() => { if (!state.open || !count) return; setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [state.open, count])
  if (!state.open) return state.runs.length ? createPortal(h('button', { type: 'button', className: 'dqp-float-collapsed', 'aria-label': '展开后台快捷任务', onClick: () => tasks.show() }, h('i', { className: 'dqp-dot', 'data-status': count ? 'running' : 'completed' }), '后台任务', count ? ` · ${count}` : ''), document.body) : null
  const runs = [...state.runs].sort((a, b) => Number(active(b.status)) - Number(active(a.status)) || b.startedAt - a.startedAt).slice(0, 20)
  return createPortal(h('aside', { className: 'dqp-float', 'aria-label': '后台快捷任务' },
    h('header', { className: 'dqp-float-head' }, h('i', { className: 'dqp-dot', 'data-status': count ? 'running' : 'completed' }), h('span', null, h('strong', null, '后台快捷任务'), h('small', null, count ? `${count} 个任务执行中 · 主对话可继续` : '独立执行 · 结果保留在这里')), h('button', { type: 'button', 'aria-label': '收起后台任务面板', onClick: () => tasks.show(false) }, '−')),
    h('div', { className: 'dqp-float-body' }, (state.error || state.syncError) && h('p', { role: 'alert', className: 'dqp-float-error' }, state.error || state.syncError), !runs.length && h('div', { className: 'dqp-float-empty' }, '点击快捷指令，子 Agent 会在这里执行。'), ...runs.map(run => h('section', { className: 'dqp-run-card', key: run.id, 'data-run-id': run.id, 'aria-label': run.name },
      h('div', { className: 'dqp-run-heading' }, h('i', { className: 'dqp-dot', 'data-status': run.status }), h('strong', { title: run.name }, run.name), h('span', { className: 'dqp-run-status', 'data-status': run.status, role: 'status' }, statusLabels[run.status])),
      h('div', { className: 'dqp-run-meta' }, h('span', { title: run.parentTitle }, run.parentTitle), h('time', null, elapsed(run, now))),
      h('div', { className: 'dqp-run-progress' }, run.progress), run.error && h('div', { className: 'dqp-run-error' }, run.error),
      !!run.tools.length && h('ul', { className: 'dqp-run-tools' }, ...run.tools.map(tool => h('li', { key: tool.callId }, h('span', null, tool.name), h('b', null, { running: '执行中', done: '已返回', failed: '失败', ended: '已结束' }[tool.state])))),
      !!run.output && h('pre', { className: 'dqp-run-output' }, run.output),
      h('div', { className: 'dqp-run-actions' }, h('button', { type: 'button', disabled: !run.steps && !run.output, onClick: () => openRun(ctx, run) }, '完整记录'), active(run.status) && h('button', { type: 'button', className: 'dqp-run-stop', disabled: run.status === 'stopping', 'aria-label': `停止 ${run.name}`, onClick: () => { void tasks.stop(run.id) } }, run.status === 'stopping' ? '停止中…' : '停止'))))),
    h('footer', { className: 'dqp-float-foot' }, '任务在后台运行 · 收起后继续执行')), document.body)
}
