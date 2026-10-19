import React from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import css from './xterm-style.ts'
type State = { id: string; cwd: string; exited: boolean; reset: boolean; output: string; cursor: number }
async function call(sessionId: string, action: string, body: Record<string, unknown> = {}) {
  const response = await fetch('/dsh-terminal', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, action, ...body }) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || '终端连接失败')
  return result
}
export function TerminalView({ sessionId }: { sessionId?: string }) {
  const host = React.useRef<HTMLDivElement>(null)
  const connection = React.useRef<{ id: string; terminal: Terminal } | null>(null)
  const [generation, setGeneration] = React.useState(0)
  const [cwd, setCwd] = React.useState('')
  const [error, setError] = React.useState('')
  const [status, setStatus] = React.useState('连接中…')
  const [closed, setClosed] = React.useState(false)
  React.useEffect(() => {
    if (!host.current || !sessionId || closed) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let cursor = 0
    let id = ''
    let queue = Promise.resolve()
    setError(''); setStatus('连接中…')
    const terminal = new Terminal({ cursorBlink: true, screenReaderMode: true, fontSize: 13, fontFamily: 'Menlo, Monaco, monospace', scrollback: 5000, theme: { background: '#181b21', foreground: '#e4e7ed', cursor: '#79b48d', selectionBackground: '#44886066' } })
    const fit = new FitAddon()
    terminal.loadAddon(fit); terminal.open(host.current)
    const size = () => ({ cols: Math.max(2, Math.min(500, terminal.cols)), rows: Math.max(2, Math.min(300, terminal.rows)) })
    const report = (err: unknown) => { if (!stopped) setError(err instanceof Error ? err.message : String(err)) }
    const resize = () => {
      if (stopped) return
      fit.fit()
      if (id) void call(sessionId, 'resize', { id, ...size() }).catch(report)
    }
    const observer = new ResizeObserver(resize); observer.observe(host.current)
    fit.fit()
    const input = terminal.onData(data => {
      if (!id || stopped) return
      // Preserve keystroke and paste ordering; never replay input after errors.
      queue = queue.then(async () => {
        if (stopped) return
        for (let offset = 0; offset < data.length; offset += 4096) await call(sessionId, 'write', { id, data: data.slice(offset, offset + 4096) })
      }).catch(report)
    })
    const display = (state: State) => {
      if (state.reset) terminal.reset()
      terminal.write(state.output)
      cursor = state.cursor
      setCwd(state.cwd); setStatus(state.exited ? '已结束' : 'zsh')
    }
    const poll = async () => {
      try {
        const state: State = await call(sessionId, 'read', { id, cursor })
        if (stopped) return
        display(state)
        if (state.exited) return
      } catch (err) { report(err); return }
      if (!stopped) timer = setTimeout(() => { void poll() }, 100)
    }
    void call(sessionId, 'open', size()).then((state: State) => {
      if (stopped) return
      id = state.id; connection.current = { id, terminal }
      display(state); resize(); terminal.focus();
      void poll()
    }).catch(report)
    return () => { stopped = true; clearTimeout(timer); observer.disconnect(); input.dispose(); connection.current = null; terminal.dispose() }
  }, [sessionId, generation, closed])
  const close = async () => {
    if (!sessionId || !connection.current) return
    try { await call(sessionId, 'close', { id: connection.current.id }); setClosed(true); setStatus('已关闭') }
    catch (err) { setError(err instanceof Error ? err.message : String(err)) }
  }
  return React.createElement('section', { className: 'dst-terminal', 'data-conversation-composer-overlay': '' },
    React.createElement('style', null, css + `
.dst-terminal { display:flex; flex-direction:column; height:100%; min-height:0; box-sizing:border-box; padding:12px 16px calc(var(--dsh-composer-height, 150px) + 8px); gap:8px; background:#181b21; color:#e4e7ed; }
.dst-terminal-head { display:flex; align-items:center; gap:12px; font-size:12px; flex:none; }
.dst-terminal-head span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0; flex:1; color:#aab2c0; }
.dst-terminal-head button { border:1px solid #48505f; border-radius:6px; background:transparent; color:inherit; padding:4px 10px; cursor:pointer; }
.dst-terminal-head button:hover { background:#303745; }
.dst-terminal-body { flex:1; min-height:80px; overflow:hidden; }
.dst-terminal-error { color:#ff9999; font-size:12px; margin:0; }
`),
    React.createElement('div', { className: 'dst-terminal-head' }, React.createElement('strong', null, '本机终端 · ' + status), React.createElement('span', { title: cwd }, cwd),
      React.createElement('button', { onClick: () => connection.current?.terminal.clear() }, '清屏'),
      closed ? React.createElement('button', { onClick: () => setClosed(false) }, '打开终端') : React.createElement('button', { onClick: () => { void close() } }, '关闭终端'),
      error ? React.createElement('button', { onClick: () => setGeneration(value => value + 1) }, '重新连接') : null),
    error ? React.createElement('p', { className: 'dst-terminal-error', role: 'alert' }, error) : null,
    React.createElement('div', { className: 'dst-terminal-body', ref: host, 'aria-label': '任务终端' }))
}
