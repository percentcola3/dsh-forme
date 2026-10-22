import React from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { openOfficialTerminal, type OfficialSidebar } from './official-terminal.ts'

/** A launch entry only. The official sidebar owns terminal rendering and lifetime. */
export function TerminalView({ ctx, sessionId }: { ctx: Context; sessionId?: string }) {
  const entry = React.useRef<HTMLElement>(null)
  const [error, setError] = React.useState('')
  const open = () => {
    if (!sessionId) { setError('请先打开任务对话。'); return }
    try { openOfficialTerminal(ctx.get('sidebarRight') as OfficialSidebar, entry.current); setError('') }
    catch (error) { setError(error instanceof Error ? error.message : String(error)) }
  }
  React.useEffect(open, [ctx, sessionId])
  return React.createElement('section', { ref: entry, style: { padding: '20px', color: 'var(--dsw-alias-label-secondary)', fontSize: 13 } },
    React.createElement('p', { role: error ? 'alert' : 'status' }, error || '终端已在右侧打开。'),
    React.createElement('button', { type: 'button', onClick: open }, error ? '重试' : '新建终端'))
}
