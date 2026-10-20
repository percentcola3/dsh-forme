import React from 'react'
import { createPortal } from 'react-dom'
import type { Context } from '@deepseek-ai/cordis'
import { taskRequest, createTasks, ongoingRuns, type TaskStore, type Prompt } from './tasks.ts'
import { shortName, currentSessionId } from './logic.ts'
import type { TaskRun } from '../types.ts'
import { styles } from './styles.ts'
import { installTaskDock } from './task-dock.ts'
export const inject = ['slots', 'uiWorkspace']
const h = React.createElement
type Draft = Omit<Prompt, 'id'> & { id?: string }
export function apply(ctx: Context): void {
  const tasks = createTasks()
  const slots = ctx.get('slots') as { inject(name: string, register: () => () => void): () => void; register(options: { name: string; id: string; order: number }, render: (props: { sessionId?: string }) => React.ReactElement | null): () => void }
  ctx.effect(() => slots.inject('conversation.input.overlay', () => slots.register({ name: 'conversation.input.overlay', id: 'dsh-quick-prompts', order: 5 }, props => h(QuickPrompts, { ctx, tasks, sessionId: props.sessionId, key: props.sessionId }))))
  ctx.effect(() => slots.inject('shell.overlay', () => slots.register({ name: 'shell.overlay', id: 'dsh-quick-prompts-panel', order: 95 }, () => h(TaskPanel, { tasks }))))
  ctx.effect(() => { const style = document.createElement('style'); style.textContent = styles; document.head.appendChild(style); return () => style.remove() })
  ctx.effect(() => {
    const poll = () => { void tasks.refresh().catch(() => {}) }
    poll(); const timer = setInterval(poll, 400)
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
      h('small', null, '沿用主 Agent 的模型、工作目录与权限。结果和执行进度显示在对话右侧任务栏，主对话可继续使用。'),
      error && h('p', { role: 'alert' }, error),
      h('footer', null, draft.id && h('button', { type: 'button', className: 'dqp-delete', disabled: saving, onClick: () => { void save('delete') } }, '删除'), h('button', { type: 'button', disabled: saving, onClick: close }, '取消'), h('button', { type: 'submit', className: 'dqp-save', disabled: saving || !draft.name.trim() || !draft.text.trim() }, saving ? '保存中…' : '保存')))), document.body) : null
  const running = ongoingRuns(state.runs).length
  const notice = error || state.error || state.syncError
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
      running > 0 && h('button', { type: 'button', className: 'dqp-panel-trigger', 'aria-expanded': state.open, title: state.open ? '收起进行中的任务' : '显示进行中的任务', onClick: () => tasks.show(!state.open) }, `后台任务 ${running}`)),
    notice && !draft && h('div', { className: 'dqp-notice', role: 'alert', title: notice }, notice), modal)
}
export function TaskPanel({ tasks }: { tasks: TaskStore }): React.ReactPortal | null {
  const state = React.useSyncExternalStore(tasks.subscribe, tasks.getSnapshot)
  const [seat, setSeat] = React.useState<HTMLElement | null>(null)
  React.useLayoutEffect(() => installTaskDock(document.body, setSeat), [])
  const runs = ongoingRuns(state.runs)
  if (!state.open || !seat || !runs.length) return null
  return createPortal(h('aside', { className: 'dqp-dock', 'aria-label': '进行中的快捷任务' },
    h('div', { className: 'dqp-dock-body', role: 'region', 'aria-label': '进行中的任务卡片', tabIndex: 0 },
      ...runs.map(run => h(RunCard, { key: run.id, run })))), seat)
}
function RunCard({ run }: { run: TaskRun }): React.ReactElement {
  const output = run.liveOutput ?? run.output
  const viewport = React.useRef<HTMLPreElement>(null)
  const follow = React.useRef(true)
  React.useLayoutEffect(() => {
    const node = viewport.current
    if (node && follow.current) node.scrollTop = node.scrollHeight
  }, [output])
  return h('section', { className: 'dqp-run-card', 'data-run-id': run.id, 'aria-label': run.name, title: run.name },
    output ? h('pre', {
      ref: viewport, className: 'dqp-live-output', role: 'log', tabIndex: 0,
      'aria-label': `${run.name} 的实时输出`, 'aria-live': 'off',
      onScroll: (event: React.UIEvent<HTMLPreElement>) => {
        const node = event.currentTarget
        follow.current = node.scrollHeight - node.scrollTop - node.clientHeight < 32
      },
    }, output) : h('div', { className: 'dqp-live-pending', role: 'status', 'aria-label': `${run.name} 等待输出` },
      h('i'), h('i'), h('i')))
}
