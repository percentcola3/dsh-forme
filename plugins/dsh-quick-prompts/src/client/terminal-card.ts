import React from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'

type TerminalState = { id: string; cwd: string; exited: boolean; reset: boolean; output: string; cursor: number }

async function terminalCall(sessionId: string, action: string, body: Record<string, unknown> = {}) {
  const response = await fetch('/dsh-terminal', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, action, ...body }) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || '终端连接失败')
  return result
}

const basename = (path: string) => path.split(/[\\/]/).filter(Boolean).at(-1) ?? path

/**
 * Small dock-card terminal for the current project. Talks to the dsh-terminal
 * plugin's /dsh-terminal route (PTY scoped to the session's project cwd).
 * 中断 sends SIGINT (Ctrl+C) to the foreground process; 关闭 ends the PTY
 * and hides the card.
 */
export function TerminalCard({ sessionId, onClose }: { sessionId: string; onClose: () => void }): React.ReactElement {
  const host = React.useRef<HTMLDivElement>(null)
  const connection = React.useRef<{ id: string; terminal: Terminal } | null>(null)
  const [generation, setGeneration] = React.useState(0)
  const [cwd, setCwd] = React.useState('')
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => {
    if (!host.current) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let cursor = 0
    let id = ''
    setError('')
    const terminal = new Terminal({ cursorBlink: true, fontSize: 12, fontFamily: 'Menlo, Monaco, monospace', scrollback: 3000, theme: { background: '#141821', foreground: '#e4e7ed', cursor: '#79b48d', selectionBackground: '#44886066' } })
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    terminal.open(host.current)
    const size = () => ({ cols: Math.max(2, Math.min(500, terminal.cols)), rows: Math.max(2, Math.min(300, terminal.rows)) })
    const report = (err: unknown) => { if (!stopped) setError(err instanceof Error ? err.message : String(err)) }
    const resize = () => {
      if (stopped) return
      try { fit.fit() } catch { return }
      if (id) void terminalCall(sessionId, 'resize', { id, ...size() }).catch(report)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host.current)
    try { fit.fit() } catch { /* host may be unsized on first paint */ }
    const input = terminal.onData(data => {
      if (!id || stopped) return
      void terminalCall(sessionId, 'write', { id, data }).catch(report)
    })
    const display = (state: TerminalState) => {
      if (state.reset) terminal.reset()
      terminal.write(state.output)
      cursor = state.cursor
      setCwd(state.cwd)
    }
    const poll = async () => {
      try {
        const state: TerminalState = await terminalCall(sessionId, 'read', { id, cursor })
        if (stopped) return
        display(state)
        if (state.exited) return
      } catch (err) { report(err); return }
      if (!stopped) timer = setTimeout(() => { void poll() }, 120)
    }
    void terminalCall(sessionId, 'open', size()).then((state: TerminalState) => {
      if (stopped) return
      id = state.id
      connection.current = { id, terminal }
      display(state)
      resize()
      terminal.focus()
      void poll()
    }).catch(report)
    return () => {
      stopped = true
      clearTimeout(timer)
      observer.disconnect()
      input.dispose()
      if (id) void terminalCall(sessionId, 'close', { id }).catch(() => {})
      connection.current = null
      terminal.dispose()
    }
  }, [sessionId, generation])
  const interrupt = () => {
    if (!connection.current || busy) return
    setBusy(true)
    void terminalCall(sessionId, 'write', { id: connection.current.id, data: '\x03' })
      .catch(err => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setBusy(false))
  }
  const close = () => {
    if (busy) return
    setBusy(true)
    const finish = () => onClose()
    if (!connection.current) { finish(); return }
    void terminalCall(sessionId, 'close', { id: connection.current!.id }).catch(() => {}).finally(finish)
  }
  return React.createElement('section', { className: 'dqp-run-card dqp-terminal-card', 'aria-label': '项目终端' },
    React.createElement('div', { className: 'dqp-run-actions' },
      React.createElement('span', { className: 'dqp-run-name' }, '终端 · ' + (cwd ? basename(cwd) : '连接中…')),
      React.createElement('button', { type: 'button', disabled: busy || !connection.current, title: '发送 Ctrl+C 中断前台命令', 'aria-label': '中断终端命令', onClick: interrupt }, '中断'),
      React.createElement('button', { type: 'button', disabled: busy, title: '结束终端并关闭卡片', 'aria-label': '关闭终端', onClick: close }, '×')),
    React.createElement('div', { className: 'dqp-terminal-body', ref: host, 'aria-label': '项目终端' }),
    error ? React.createElement('p', { className: 'dqp-terminal-error', role: 'alert' }, error,
      React.createElement('button', { type: 'button', onClick: () => { setError(''); setGeneration(value => value + 1) } }, '重新连接')) : null)
}
