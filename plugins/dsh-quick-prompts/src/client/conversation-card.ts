import React from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { active, statusLabels, type TaskRun } from '../types.ts'
import { openRun, type TaskStore } from './tasks.ts'
const h = React.createElement

/** Small conversation surface; the durable child owns context, tools and approvals. */
export const ConversationCard = React.memo(function ConversationCard({ ctx, run, tasks }: { ctx: Context; run: TaskRun; tasks: TaskStore }): React.ReactElement {
  const [text, setText] = React.useState(() => tasks.getDraft(run.id))
  const [error, setError] = React.useState('')
  const [acting, setActing] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const inFlight = React.useRef(false)
  const viewport = React.useRef<HTMLDivElement>(null)
  const follow = React.useRef(true)
  const messages = run.messages ?? []
  React.useLayoutEffect(() => {
    if (viewport.current && follow.current) viewport.current.scrollTop = viewport.current.scrollHeight
  }, [messages, run.status])
  const control = async (action: 'stop' | 'close') => {
    setActing(true); setError('')
    try { await tasks.control(action, run.id) }
    catch (err) { setError(err instanceof Error ? err.message : String(err)) }
    finally { setActing(false) }
  }
  const send = async () => {
    const value = text.trim()
    if (!value || inFlight.current || active(run.status)) return
    inFlight.current = true; setSending(true); setError(''); follow.current = true
    try {
      await tasks.reply(run.id, value, tasks.replyRequestId(run.id, value))
      if (tasks.getDraft(run.id).trim() === value) tasks.setDraft(run.id, '')
      setText(current => current.trim() === value ? '' : current)
    } catch (err) { setError(err instanceof Error ? err.message : String(err)) }
    finally { inFlight.current = false; setSending(false) }
  }
  return h('section', { className: 'dqp-run-card dqp-conversation', 'data-run-id': run.id, 'data-run-status': run.status, 'aria-label': `${run.name} 对话` },
    h('div', { className: 'dqp-run-actions' },
      h('span', { className: 'dqp-run-name', title: run.name }, run.name),
      h('span', { className: 'dqp-conversation-state', role: 'status' }, statusLabels[run.status]),
      run.sessionKind !== 'headless' && h('button', { type: 'button', title: '切换到此任务的完整对话，查看工具和审批；日常回复可直接在卡片内输入', 'aria-label': `打开 ${run.name} 的完整对话`, onClick: () => openRun(ctx, run) }, '↗'),
      active(run.status) && h('button', { type: 'button', disabled: acting || run.status === 'stopping', onClick: () => { void control('stop') } }, run.status === 'stopping' ? '停止中' : '停止'),
      h('button', { type: 'button', disabled: acting || sending, title: active(run.status) ? '停止并关闭对话' : '关闭对话卡片', 'aria-label': `关闭对话 ${run.name}`, onClick: () => { void control('close') } }, '×')),
    h('div', { ref: viewport, className: 'dqp-conversation-messages', role: 'log', 'aria-label': `${run.name} 的对话`, 'aria-live': 'off', tabIndex: 0,
      onScroll: (event: React.UIEvent<HTMLDivElement>) => { const node = event.currentTarget; follow.current = node.scrollHeight - node.scrollTop - node.clientHeight < 32 } },
      ...messages.map(message => h('div', { key: message.id, className: `dqp-message dqp-message-${message.role}` },
        h('small', null, message.role === 'user' ? '你' : 'AI'), h('div', null, message.text))),
      !messages.some(message => message.role === 'assistant') && !active(run.status) && run.output && h('div', { className: 'dqp-message dqp-message-assistant' }, h('small', null, 'AI'), h('div', null, run.output)),
      active(run.status) && h('div', { className: 'dqp-conversation-progress' }, run.status === 'waiting' ? '需要审批或选择，请打开完整对话处理。' : run.status === 'stopping' ? '正在停止…' : 'AI 正在回复…')),
    (error || run.error) && h('p', { className: 'dqp-run-error', role: 'alert' }, error || run.error),
    h('form', { className: 'dqp-conversation-input', onSubmit: (event: React.FormEvent) => { event.preventDefault(); event.stopPropagation(); void send() } },
      h('textarea', { value: text, rows: 2, maxLength: 32000, 'aria-label': `给 ${run.name} 发送消息`, placeholder: active(run.status) ? '可以先写下下一条消息…' : '继续对话…',
        onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => { setText(event.target.value); tasks.setDraft(run.id, event.target.value) },
        onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
          if (event.key === 'Enter') event.stopPropagation()
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.preventDefault(); void send() }
        } }),
      h('button', { type: 'submit', disabled: !text.trim() || sending || active(run.status), 'aria-label': `发送消息给 ${run.name}` }, sending ? '发送中' : '发送')))
})
