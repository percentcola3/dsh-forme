import React from 'react'
import { createPortal } from 'react-dom'
import type { Context } from '@deepseek-ai/cordis'
import { createTasks, sessionRuns, type TaskStore } from './tasks.ts'
import { shortName, currentSessionId } from './logic.ts'
import { active, statusLabels, type Prompt, type TaskRun } from '../types.ts'
import { styles } from './styles.ts'
import { TaskModelPicker } from './model-picker.ts'
import { installTaskDock } from './task-dock.ts'
import { TerminalCard } from './terminal-card.ts'
import { installDraftNavigation } from './draft-memory.ts'
import { ConversationCard } from './conversation-card.ts'
export const inject = ['slots', 'uiWorkspace', 'sidebarRight', 'webTerminals', 'sessions', 'workspaces']
const h = React.createElement
type Draft = Omit<Prompt, 'id'> & { id?: string; origin: { sessionId: string; projectId: string; cwd: string } }
export function apply(ctx: Context): void {
  const tasks = createTasks()
  ctx.effect(() => installDraftNavigation(
    ctx.get('uiWorkspace') as Parameters<typeof installDraftNavigation>[0],
    ctx.get('sessions') as Parameters<typeof installDraftNavigation>[1],
    ctx.get('workspaces') as Parameters<typeof installDraftNavigation>[2],
    localStorage,
  ))
  const slots = ctx.get('slots') as { inject(name: string, register: () => () => void): () => void; register(options: { name: string; id: string; order: number }, render: (props: { sessionId?: string }) => React.ReactElement | null): () => void }
  ctx.effect(() => slots.inject('conversation.input.overlay', () => slots.register({ name: 'conversation.input.overlay', id: 'dsh-quick-prompts', order: 5 }, props => h(QuickPrompts, { ctx, tasks, sessionId: props.sessionId, key: props.sessionId }))))
  ctx.effect(() => slots.inject('shell.overlay', () => slots.register({ name: 'shell.overlay', id: 'dsh-quick-prompts-panel', order: 95 }, () => h(TaskPanel, { ctx, tasks }))))
  ctx.effect(() => { const style = document.createElement('style'); style.textContent = styles; document.head.appendChild(style); return () => style.remove() })
  ctx.effect(() => {
    // Fast polling only while a task is live; idle sessions check every 3s and
    // hidden windows pause entirely, so the composer is not re-rendered while typing.
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false
    const poll = () => { void tasks.select(currentSessionId(ctx)).then(() => tasks.refresh()).catch(() => {}) }
    const tick = () => {
      timer = undefined
      if (stopped) return
      if (!document.hidden) poll()
      const live = tasks.getSnapshot().runs.some(run => active(run.status))
      timer = setTimeout(tick, document.hidden ? 5000 : live ? 600 : 3000)
    }
    const wake = () => { if (timer !== undefined) clearTimeout(timer); tick() }
    tick()
    window.addEventListener('focus', wake)
    document.addEventListener('visibilitychange', wake)
    const unsubscribe = tasks.subscribe(() => { if (timer !== undefined && tasks.getSnapshot().runs.some(run => active(run.status))) { clearTimeout(timer); timer = setTimeout(tick, 600) } })
    const workspace = ctx.get('uiWorkspace') as { selection: { subscribe(listener: () => void): () => void } }
    const unselect = workspace.selection.subscribe(poll)
    return () => { stopped = true; unselect(); unsubscribe(); if (timer !== undefined) clearTimeout(timer); window.removeEventListener('focus', wake); document.removeEventListener('visibilitychange', wake) }
  })
}
export function QuickPrompts({ ctx, tasks, sessionId }: { ctx: Context; tasks: TaskStore; sessionId?: string }): React.ReactElement {
  const state = React.useSyncExternalStore(tasks.subscribe, tasks.getSnapshot)
  const selected = state.sessionId === sessionId
  const items = selected ? state.prompts : []
  const [draft, setDraft] = React.useState<Draft | null>(null)
  const [error, setError] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const submitting = React.useRef(false)
  const nameInput = React.useRef<HTMLInputElement>(null)
  const trigger = React.useRef<HTMLButtonElement | null>(null)
  const close = () => { if (submitting.current) return; setDraft(null); setError(''); trigger.current?.focus() }
  React.useEffect(() => {
    if (!draft) return
    nameInput.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !submitting.current) { setDraft(null); setError(''); trigger.current?.focus() } }
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey)
  }, [!!draft])
  const open = (event: React.MouseEvent<HTMLButtonElement>, item?: Prompt) => {
    if (!sessionId || !selected || !state.ready || currentSessionId(ctx) !== sessionId) return
    trigger.current = event.currentTarget; setError('')
    setDraft({ ...(item ?? { name: '', text: '' }), origin: { sessionId, projectId: state.projectId, cwd: state.cwd } })
  }
  const draftSelected = !!draft && selected && state.ready && draft.origin.sessionId === state.sessionId && draft.origin.projectId === state.projectId
  const save = async (action: 'save' | 'delete') => {
    if (!draft || submitting.current) return
    if (!draftSelected || currentSessionId(ctx) !== draft.origin.sessionId) { setError('项目已切换，请返回原项目或重新打开快捷任务。'); return }
    submitting.current = true; setSaving(true); setError('')
    try { const { origin, ...value } = draft; await tasks.save(action, value, origin); setDraft(null); trigger.current?.focus() }
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
      const nodes = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('input:not(:disabled),textarea:not(:disabled),select:not(:disabled),button:not(:disabled)'))
      const first = nodes[0], last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    } }, h('h3', null, draft.id ? '编辑快捷任务' : '新增快捷任务'),
      h('small', null, '独立快捷对话 · 主对话继续运行'),
      h('label', null, '名称', h('input', { ref: nameInput, value: draft.name, maxLength: 100, disabled: saving, placeholder: '例如：检查代码', onChange: (event: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, name: event.target.value }) }), h('small', null, '按钮最多显示 5 个字，悬停查看全名。')),
      h(TaskModelPicker, { key: `${draft.origin.sessionId}:${draft.origin.projectId}`, tasks, value: draft.model, disabled: saving || !draftSelected, onChange: model => setDraft({ ...draft, model }) }),
      h('label', null, '任务内容', h('textarea', { value: draft.text, maxLength: 32000, disabled: saving, placeholder: '描述要在独立对话中执行的任务，也可以填写需要 AI 执行的命令…', onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => setDraft({ ...draft, text: event.target.value }) })),
      h('small', null, `编辑项目：${draft.origin.cwd}。同一项目的会话共用指令，其他项目使用各自副本。`),
      !draftSelected && h('p', { role: 'alert' }, '项目已切换，请返回原项目继续编辑，或取消后重新打开。'),
      error && h('p', { role: 'alert' }, error),
      h('footer', null, draft.id && h('button', { type: 'button', className: 'dqp-delete', disabled: saving || !draftSelected, onClick: () => { void save('delete') } }, '删除'), h('button', { type: 'button', disabled: saving, onClick: close }, '取消'), h('button', { type: 'submit', className: 'dqp-save', disabled: saving || !draftSelected || !draft.name.trim() || !draft.text.trim() }, saving ? '保存中…' : '保存')))), document.body) : null
  const running = selected ? sessionRuns(state.runs, state.sessionId, state.projectId).filter(run => active(run.status)).length : 0
  const recoveryNotice = state.recovery?.state === 'reserved' || state.recovery?.state === 'failed'
    ? '上次任务的自动续接未能确认。请检查本对话记录后发送「继续」；系统不会自动重复提交。' : ''
  const notice = error || (selected ? state.error || state.syncError || recoveryNotice : '')
  return h(React.Fragment, null,
    h('div', { className: 'dqp-bar', role: 'group', 'aria-label': '快捷任务' },
      h('button', {
        type: 'button', className: 'dqp-terminal', 'aria-label': '打开项目终端', 'aria-pressed': state.terminalOpen,
        disabled: !selected || !sessionId, title: `${state.cwd || '当前项目'} 下打开终端小窗口`,
        onClick: () => tasks.showTerminal(!state.terminalOpen, state.projectId),
      }, h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        h('path', { d: 'M5 6l6 6-6 6M13 18h6' }))),
      h('button', { type: 'button', className: 'dqp-add', 'aria-label': '新增快捷任务', disabled: saving || !selected || !state.ready, onClick: (event: React.MouseEvent<HTMLButtonElement>) => open(event) },
        h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', 'aria-hidden': true }, h('path', { d: 'M12 4v16M4 12h16' }))),
      h('div', { className: 'dqp-items' }, ...items.map(item =>
        h('span', { className: 'dqp-task-chip', key: item.id },
          h('button', {
            type: 'button', disabled: !selected || !state.ready || !sessionId || tasks.busy(sessionId, item.id),
            title: `${item.name} · 独立快捷对话\n${item.model ? `${item.model.provider} / ${item.model.model}` : item.model === null ? '跟随当前会话模型' : '默认 DeepSeek Flash'}\n点击执行 · 右键编辑`,
            onClick: () => start(item),
            onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => { event.preventDefault(); open(event, item) },
          }, shortName(item.name)),
          h('button', {
            type: 'button', className: 'dqp-task-edit', 'aria-label': `编辑快捷任务 ${item.name}`,
            onClick: (event: React.MouseEvent<HTMLButtonElement>) => open(event, item),
          }, h('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, 'aria-hidden': true },
            h('path', { d: 'M15 5l4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z' }))),
        ))),
      selected && state.legacyAvailable && h('button', { type: 'button', title: '将旧版全局指令归入当前项目，仅可导入一次', onClick: () => { void tasks.save('import').catch(error => setError(String(error.message))) } }, '导入旧指令'),
      selected && sessionRuns(state.runs, state.sessionId, state.projectId).length > 0 && h('button', { type: 'button', className: 'dqp-panel-trigger', 'aria-expanded': state.open, title: state.open ? '收起快捷对话' : '显示快捷对话', onClick: () => tasks.show(!state.open) }, `快捷对话 ${sessionRuns(state.runs, state.sessionId, state.projectId).length}${running ? ` · ${running} 运行中` : ''}`)),
    notice && !draft && h('div', { className: 'dqp-notice', role: 'alert', title: notice }, notice), modal)
}
export function TaskPanel({ ctx, tasks }: { ctx: Context; tasks: TaskStore }): React.ReactPortal | null {
  const state = React.useSyncExternalStore(tasks.subscribe, tasks.getSnapshot)
  const [seat, setSeat] = React.useState<HTMLElement | null>(null)
  React.useLayoutEffect(() => installTaskDock(document.body, setSeat), [])
  // A terminal belongs to its original project/session, even as navigation changes.
  // Keep owned terminals mounted but hidden; switching projects is not "close".
  const projects = [...new Set([state.projectId, ...state.terminalCards.map(card => card.projectId)])].filter(Boolean)
  if (!seat) return null
  return createPortal(h(React.Fragment, null, ...projects.map(projectId => {
    const selected = state.ready && state.projectId === projectId
    const runs = selected ? sessionRuns(state.runs, state.sessionId, state.projectId).filter(run => run.projectId === projectId) : []
    const terminal = state.terminalCards.find(card => card.projectId === projectId)
    const visible = selected && state.open && (!!runs.length || !!terminal)
    return h('aside', { key: projectId, className: 'dqp-dock', hidden: !visible, 'data-dqp-project': projectId, 'aria-label': '快捷对话' },
      h('div', { className: 'dqp-dock-body', role: 'region', 'aria-label': '快捷对话卡片', tabIndex: 0 },
        terminal && h(TerminalCard, { ctx, key: `terminal:${projectId}`, sessionId: terminal.sessionId, active: visible, sourceSelected: state.sessionId === terminal.sessionId, onClose: () => tasks.showTerminal(false, projectId) }),
        ...runs.map(run => h(ConversationCard, { key: run.id, ctx, run, tasks }))))
  })), seat)
}
