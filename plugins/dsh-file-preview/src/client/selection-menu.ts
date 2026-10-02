import React from 'react'
import { createPortal } from 'react-dom'
import type { Context } from '@deepseek-ai/cordis'

type Input = {
  state: { getSnapshot(): { draft: string; phase: string; draftRev: number; occurrences: { length: number }[] } }
}
type SelectionInfo = { path: string; x: number; y: number; code: boolean; lines?: { start: number; end: number } }

export function fileReference(path: string, lines?: { start: number; end: number }) {
  if (/[\u0000-\u001f\u007f-\u009f"]/u.test(path)) throw new Error('文件路径包含不支持的字符。')
  const mention = /\s/u.test(path) ? `@"${path}"` : `@${path}`
  const location = lines ? `:${lines.start}${lines.end === lines.start ? '' : `-${lines.end}`}` : ''
  return { source: 'reference', ref: mention, clipboardText: mention, appearance: 'file',
    label: `${path.split('/').pop()}${location} · ${path}` }
}

/** Only use line offsets from the official code element, never rendered Markdown. */
function selectedCode(preview: Element): Pick<SelectionInfo, 'code' | 'lines'> {
  const selection = window.getSelection()
  const body = preview.querySelector('[data-textpreview-body]')
  if (!body || !selection || selection.isCollapsed || !selection.rangeCount || !selection.toString().trim()) return { code: false }
  const range = selection.getRangeAt(0)
  if (!body.contains(range.startContainer) || !body.contains(range.endContainer)) return { code: false }
  const code = body.querySelector('pre code')
  if (!code?.contains(range.startContainer) || !code.contains(range.endContainer)) return { code: true }
  const prefix = document.createRange()
  prefix.selectNodeContents(code)
  prefix.setEnd(range.startContainer, range.startOffset)
  const start = prefix.toString().split('\n').length
  prefix.setEnd(range.endContainer, range.endOffset)
  const beforeEnd = prefix.toString()
  const end = Math.max(start, beforeEnd.split('\n').length - (beforeEnd.endsWith('\n') ? 1 : 0))
  return { code: true, lines: { start, end } }
}

export function SelectionMenu({ ctx, sessionId }: { ctx: Context; sessionId?: string }): React.ReactElement | null {
  const [selection, setSelection] = React.useState<SelectionInfo | null>(null)
  const [error, setError] = React.useState('')
  const menuRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const close = () => setSelection(null)
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) close()
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    const onContext = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null
      const preview = target?.closest('[data-dfp-preview] [data-textpreview-state]')
      const path = preview?.querySelector('[data-textpreview-path]')?.getAttribute('title')
      if (!path || !preview) { close(); return }
      event.preventDefault()
      event.stopPropagation()
      setError('')
      setSelection({ path, ...selectedCode(preview), x: event.clientX, y: event.clientY })
    }
    document.addEventListener('contextmenu', onContext, true)
    document.addEventListener('pointerdown', onPointer, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('contextmenu', onContext, true)
      document.removeEventListener('pointerdown', onPointer, true)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [])
  React.useLayoutEffect(() => {
    const menu = menuRef.current
    if (!selection || !menu) return
    const rect = menu.getBoundingClientRect()
    menu.style.left = `${Math.max(8, Math.min(selection.x, window.innerWidth - rect.width - 8))}px`
    menu.style.top = `${Math.max(8, Math.min(selection.y, window.innerHeight - rect.height - 8))}px`
    menu.querySelector('button')?.focus({ preventScroll: true })
  }, [selection, error])

  const add = () => {
    if (!selection) return
    try {
      const sessions = ctx.get('sessions') as { scope(id: string): Context | undefined }
      const navigation = ctx.get('uiWorkspace') as { selection: { getSnapshot(): { sessionId?: string } } }
      if (!sessionId || navigation.selection.getSnapshot().sessionId !== sessionId) throw new Error('会话已切换，请重新打开文件菜单。')
      const scope = sessions.scope(sessionId)
      if (!scope) throw new Error('当前会话输入框不可用。')
      const conversation = scope.get('conversation') as { input: { for(scope: Context): Input } }
      const input = conversation.input.for(scope)
      const state = input.state.getSnapshot()
      if (state.phase !== 'plain') throw new Error('输入框正在处理操作，请稍后再加入。')
      // Insert at the end through the official edit event so existing reference
      // chips stay structured. TokenSpan counts each chip as one character.
      const end = state.draft.length - state.occurrences.reduce((total, ref) => total + ref.length - 1, 0)
      const events = scope as unknown as { bail(scope: Context, event: string, request: unknown): unknown }
      const applied = events.bail(scope, 'slash/input-insert-reference', {
        reference: fileReference(selection.path, selection.lines), span: { start: end, end, draftRev: state.draftRev },
      })
      if (applied !== true) throw new Error('输入内容已变化，请重试。')
      // The native reference opener treats ref as a path. Keep line context in
      // ordinary prompt text so the chip remains clickable and serializable.
      if (selection.lines) {
        const next = input.state.getSnapshot()
        const tail = next.draft.length - next.occurrences.reduce((total, ref) => total + ref.length - 1, 0)
        const { start, end } = selection.lines
        const inserted = events.bail(scope, 'slash/input-insert-text', {
          text: ` （第 ${start}${end === start ? '' : `–${end}`} 行） `,
          span: { start: tail, end: tail, draftRev: next.draftRev },
        })
        if (inserted !== true) throw new Error('文件已加入，但行号插入失败，请补充选区行号。')
      }
      setSelection(null)
      document.querySelector<HTMLElement>('[data-input-scroll] [contenteditable="true"], [data-composer-seat] textarea')?.focus()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }
  if (!selection) return null
  return createPortal(React.createElement('div', {
    ref: menuRef, className: 'dfp-selection-menu', role: 'menu', 'aria-label': '文件操作',
    style: { left: selection.x, top: selection.y },
  }, React.createElement('button', { type: 'button', role: 'menuitem', onClick: add },
    React.createElement('span', { className: 'dfp-menu-icon', 'aria-hidden': true },
      React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' },
        React.createElement('path', { d: selection.code ? 'm8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16' : 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zm0 0v5h5M8 13h8M8 17h5' }))),
    React.createElement('span', { className: 'dfp-menu-copy' },
      React.createElement('span', { className: 'dfp-menu-label' }, selection.code ? '将代码插入 Chat' : '将文件插入 Chat'),
      React.createElement('span', { className: 'dfp-menu-description', title: selection.path },
        `${selection.path.split('/').pop()}${selection.lines ? ` · 第 ${selection.lines.start}${selection.lines.end === selection.lines.start ? '' : `–${selection.lines.end}`} 行` : ''}`))),
  error ? React.createElement('p', { role: 'alert' }, error) : null), document.body)
}
