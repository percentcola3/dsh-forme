import React from 'react'
import { TerminalView } from './terminal-view.ts'
import type { Context } from '@deepseek-ai/cordis'
export const inject = ['slots']
type Snapshot = { cwd: string; savedCommand: string; command: string; status: 'idle' | 'running' | 'stopping' | 'exited' | 'error'; output: string; exitCode: number | null; truncated: boolean }
async function request(sessionId: string, action: string, command?: string, includeOutput = true): Promise<Snapshot> {
  const response = await fetch('/dsh-project-run', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, action, command, includeOutput }) })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error ?? `请求失败 (${response.status})`)
  return body
}
export function apply(ctx: Context): void {
  const slots = ctx.get('slots') as {
    inject(name: string, register: () => () => void): () => void
    register(options: { name: string; id: string; label: string; order: number }, render: (props: { sessionId?: string }) => React.ReactElement): () => void
  }
  ctx.effect(() => slots.inject('conversation.view', () => slots.register(
    { name: 'conversation.view', id: 'dsh-project-run', label: '终端', order: 40 },
    (props: { sessionId?: string }) => React.createElement(TerminalView, { key: props.sessionId, sessionId: props.sessionId }),
  )))
  ctx.effect(() => slots.inject('conversation.session.header.actions', () => slots.register(
    { name: 'conversation.session.header.actions', id: 'dsh-project-shortcuts', label: '项目启动', order: -10 },
    (props: { sessionId?: string }) => React.createElement(ProjectShortcuts, { key: props.sessionId, sessionId: props.sessionId }),
  )))
  ctx.effect(() => {
    const style = document.createElement('style')
    style.textContent = `
.dpr-dialog { width:min(760px, calc(100vw - 48px)); max-width:none; height:min(620px, calc(100dvh - 64px)); max-height:calc(100dvh - 64px); padding:0; border:1px solid var(--dsw-alias-border-l2); border-radius:16px; background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); box-shadow:0 20px 70px #0003; overflow:hidden; }
.dpr-dialog::backdrop { background:rgb(0 0 0 / 28%); }
.dpr-dialog-layout { display:flex; flex-direction:column; height:100%; min-height:0; }
.dpr-dialog-header { display:flex; align-items:center; justify-content:space-between; flex:none; padding:14px 20px; border-bottom:1px solid var(--dsw-alias-border-l2); font-size:14px; }
.dpr-dialog-close { appearance:none; border:0; border-radius:6px; background:transparent; color:var(--dsw-alias-label-secondary); cursor:pointer; font-size:20px; width:28px; height:28px; }
.dpr-dialog-close:hover { background:var(--dsw-alias-interactive-bg-hover); }
.dpr-dialog .dpr-page { flex:1; height:auto; padding:16px 20px; overflow:auto; }
.dpr-dialog .dpr-output { min-height:100px; }
.dpr-shortcuts { display:inline-flex; align-items:center; gap:4px; margin-right:8px; font-size:12px; }
.dpr-shortcuts > button { appearance:none; height:26px; padding:0 8px; border:1px solid var(--dsw-alias-border-l2); border-radius:7px; background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-secondary); font:inherit; cursor:pointer; white-space:nowrap; }
.dpr-shortcuts > button:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-primary); }
.dpr-shortcuts > button:disabled { opacity:.4; cursor:default; }
.dpr-shortcuts > button:focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:2px; }
.dpr-shortcuts .dpr-start { color:var(--dsw-alias-state-business-primary); }
.dpr-shortcuts .dpr-stop { color:var(--dsw-alias-state-error-primary); }
.dpr-run-dot { width:6px; height:6px; border-radius:50%; margin:0 5px; background:var(--dsw-alias-label-tertiary); }
.dpr-run-dot[data-running="true"] { background:var(--dsw-alias-state-business-primary); }
.dpr-shortcut-error { max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-state-error-primary); }
.dpr-page { height:100%; min-height:0; display:flex; flex-direction:column; padding:16px 20px calc(var(--dsh-composer-height, 150px) + 8px); box-sizing:border-box; gap:12px; background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); }
.dpr-head { display:flex; align-items:center; gap:10px; font-size:13px; }
.dpr-head strong { flex:none; }
.dpr-path { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-tertiary); }
.dpr-command { resize:vertical; min-height:62px; max-height:180px; box-sizing:border-box; width:100%; padding:10px 12px; border:1px solid var(--dsw-alias-border-l2); border-radius:10px; background:var(--dsw-alias-bg-layer-2); color:inherit; font:12px/1.6 ui-monospace, monospace; }
.dpr-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:12px; }
.dpr-actions button { appearance:none; padding:6px 12px; border:1px solid var(--dsw-alias-border-l2); border-radius:7px; background:var(--dsw-alias-bg-layer-2); color:inherit; font:inherit; cursor:pointer; }
.dpr-actions button:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); }
.dpr-actions button:focus-visible, .dpr-command:focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:2px; }
.dpr-actions button:disabled { opacity:.45; cursor:default; }
.dpr-actions .dpr-start { background:var(--dsw-alias-state-business-primary); color:white; border-color:transparent; }
.dpr-actions .dpr-stop { color:var(--dsw-alias-state-error-primary); }
.dpr-status { margin-left:auto; color:var(--dsw-alias-label-secondary); }
.dpr-status[data-running="true"] { color:var(--dsw-alias-state-business-primary); }
.dpr-output { flex:1; min-height:80px; margin:0; padding:12px 14px; overflow:auto; border:1px solid var(--dsw-alias-border-l2); border-radius:10px; background:var(--dsw-alias-bg-layer-2); font:12px/1.65 ui-monospace, monospace; white-space:pre-wrap; overflow-wrap:anywhere; user-select:text; }
.dpr-error { margin:0; font-size:12px; color:var(--dsw-alias-state-error-primary); }
.dpr-note { margin:0; font-size:11px; color:var(--dsw-alias-label-tertiary); }
header [role="tablist"]:has([data-dsh-nav="run"]) > [role="tab"][data-dsh-nav="trace"] { border-radius:0; }
header [role="tablist"] > [role="tab"][data-dsh-nav="run"] { order:4; border-radius:0 999px 999px 0; }
header [role="tablist"]:has([data-dsh-nav="run"]) .dsh-ws-tools { max-width:calc(100% - 410px); }
`
    document.head.appendChild(style)
    return () => style.remove()
  })
}
function RunView({ sessionId }: { sessionId?: string }): React.ReactElement {
  const [snapshot, setSnapshot] = React.useState<Snapshot | null>(null)
  const [command, setCommand] = React.useState('')
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState('')
  const [following, setFollowing] = React.useState(true)
  const output = React.useRef<HTMLPreElement>(null)
  const initialized = React.useRef(false)
  const revision = React.useRef(0)
  const pollError = React.useRef(false)
  React.useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const poll = async () => {
      const version = revision.current
      try {
        const value = await request(sessionId, 'status')
        if (cancelled || version !== revision.current) return
        if (pollError.current) { setError(''); pollError.current = false }
        setSnapshot(value)
        if (!initialized.current) { initialized.current = true; setCommand(value.savedCommand) }
      } catch (err) { if (!cancelled && version === revision.current) { pollError.current = true; setError(err instanceof Error ? err.message : String(err)) } }
      finally { if (!cancelled) timer = setTimeout(() => { void poll() }, 1000) }
    }
    void poll()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [sessionId])
  React.useLayoutEffect(() => {
    if (following && output.current) output.current.scrollTop = output.current.scrollHeight
  }, [snapshot?.output, following])
  const run = async (action: 'save' | 'start' | 'restart' | 'stop') => {
    if (!sessionId || busy) return
    revision.current++
    setBusy(action); setError('')
    try {
      if (action === 'save' || action === 'start' || action === 'restart') await request(sessionId, 'save', command)
      setSnapshot(await request(sessionId, action === 'save' ? 'status' : action))
      if (action === 'start' || action === 'restart') setFollowing(true)
    } catch (err) { setError(err instanceof Error ? err.message : String(err)) }
    finally { revision.current++; setBusy('') }
  }
  const running = snapshot?.status === 'running' || snapshot?.status === 'stopping'
  const status = !snapshot ? '连接中…' : ({ idle: '未启动', running: '运行中', stopping: '正在停止…', exited: `已结束${snapshot.exitCode === null ? '' : ` · 退出码 ${snapshot.exitCode}`}`, error: '启动失败' })[snapshot.status]
  return React.createElement('section', { className: 'dpr-page', 'data-conversation-composer-overlay': '' },
    React.createElement('div', { className: 'dpr-head' }, React.createElement('strong', null, '项目启动'), React.createElement('span', { className: 'dpr-path', title: snapshot?.cwd }, snapshot?.cwd)),
    React.createElement('textarea', { className: 'dpr-command', 'aria-label': '项目启动命令', value: command, spellCheck: false, disabled: !snapshot || !!busy || running, placeholder: '例如：npm run dev', onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => setCommand(event.target.value) }),
    React.createElement('div', { className: 'dpr-actions' },
      React.createElement('button', { disabled: !snapshot || !!busy || running || command === snapshot.savedCommand, onClick: () => { void run('save') } }, busy === 'save' ? '保存中…' : '保存命令'),
      React.createElement('button', { className: 'dpr-start', disabled: !snapshot || !!busy || running || !command.trim(), onClick: () => { void run('start') } }, busy === 'start' ? '启动中…' : '启动'),
      React.createElement('button', { disabled: !snapshot || !!busy || snapshot.status === 'stopping' || !command.trim(), onClick: () => { void run('restart') } }, busy === 'restart' ? '重启中…' : '重启'),
      React.createElement('button', { className: 'dpr-stop', disabled: !running || !!busy || snapshot?.status === 'stopping', onClick: () => { void run('stop') } }, busy === 'stop' ? '中断中…' : '中断'),
      React.createElement('button', { 'aria-pressed': following, onClick: () => setFollowing(!following) }, following ? '跟随输出：开' : '跟随输出：关'),
      React.createElement('span', { className: 'dpr-status', 'data-running': running, role: 'status' }, status)),
    error ? React.createElement('p', { className: 'dpr-error', role: 'alert' }, error) : null,
    React.createElement('pre', { className: 'dpr-output', ref: output, 'aria-label': '运行输出', onScroll: () => { const el = output.current; if (el) setFollowing(el.scrollHeight - el.scrollTop - el.clientHeight < 24) } }, snapshot?.output || '启动后，命令输出会显示在这里。'),
    React.createElement('p', { className: 'dpr-note' }, snapshot?.truncated ? '仅保留最近 200,000 字符输出。' : '命令在当前项目目录下通过 zsh 执行。请使用前台启动命令；切换 Tab 会继续运行，中断按钮会结束进程。命令保存一次后，也可以直接使用顶部快捷按钮。'))
}

function ProjectShortcuts({ sessionId }: { sessionId?: string }): React.ReactElement {
  const [configuring, setConfiguring] = React.useState(false)
  const [snapshot, setSnapshot] = React.useState<Snapshot | null>(null)
  const [busy, setBusy] = React.useState('')
  const [error, setError] = React.useState('')
  const revision = React.useRef(0)
  const pollError = React.useRef(false)
  const inFlight = React.useRef(false)
  React.useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const poll = async () => {
      const version = revision.current
      try {
        if (inFlight.current) return
        const state = await request(sessionId, 'status', undefined, false)
        if (!cancelled && version === revision.current) {
          if (pollError.current) { setError(''); pollError.current = false }
          setSnapshot(state)
        }
      } catch (err) { if (!cancelled && version === revision.current) { pollError.current = true; setError(err instanceof Error ? err.message : String(err)) } }
      finally { if (!cancelled) timer = setTimeout(() => { void poll() }, 1500) }
    }
    void poll()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [sessionId])
  const configure = () => setConfiguring(true)
  const act = async (action: 'start' | 'restart' | 'stop') => {
    if (!sessionId || inFlight.current) return
    inFlight.current = true; revision.current++; setBusy(action); setError('')
    try { setSnapshot(await request(sessionId, action, undefined, false)) }
    catch (err) { setError(err instanceof Error ? err.message : String(err)) }
    finally { revision.current++; inFlight.current = false; setBusy('') }
  }
  const running = snapshot?.status === 'running'
  const stopping = snapshot?.status === 'stopping'
  const configured = !!snapshot?.savedCommand.trim()
  return React.createElement('div', { className: 'dpr-shortcuts', role: 'group', 'aria-label': '项目启动快捷操作' },
    React.createElement('span', { className: 'dpr-run-dot', 'data-running': running, title: running ? `运行中：${snapshot.command}` : stopping ? '正在中断' : '未运行', 'aria-label': running ? '项目运行中' : '项目未运行' }),
    React.createElement('button', { className: 'dpr-start', title: snapshot?.savedCommand || '请先配置启动命令', disabled: !configured || !!busy || running || stopping, onClick: () => { void act('start') } }, busy === 'start' ? '启动中…' : '启动'),
    React.createElement('button', { title: snapshot?.savedCommand || '请先配置启动命令', disabled: !configured || !!busy || stopping, onClick: () => { void act('restart') } }, busy === 'restart' ? '重启中…' : '重启'),
    React.createElement('button', { className: 'dpr-stop', disabled: !running || !!busy, onClick: () => { void act('stop') } }, busy === 'stop' ? '中断中…' : '中断'),
    React.createElement('button', { title: '配置命令与查看日志', onClick: configure }, configured ? '配置 / 日志' : '配置启动命令'),
    error ? React.createElement('span', { role: 'alert', title: error, className: 'dpr-shortcut-error' }, error) : null,
    configuring ? React.createElement(ConfigurationDialog, { sessionId, onClose: () => setConfiguring(false) }) : null)
}

function ConfigurationDialog({ sessionId, onClose }: { sessionId?: string; onClose: () => void }): React.ReactElement {
  const dialog = React.useRef<HTMLDialogElement>(null)
  React.useLayoutEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => { element?.close() }
  }, [])
  return React.createElement('dialog', {
    className: 'dpr-dialog', ref: dialog, 'aria-label': '配置启动命令与查看日志',
    onCancel: onClose, onClose,
    onClick: (event: React.MouseEvent<HTMLDialogElement>) => {
      if (event.target !== event.currentTarget) return
      const rect = event.currentTarget.getBoundingClientRect()
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose()
    },
  }, React.createElement('div', { className: 'dpr-dialog-layout' },
    React.createElement('div', { className: 'dpr-dialog-header' },
      React.createElement('strong', null, '配置启动命令与查看日志'),
      React.createElement('button', { type: 'button', className: 'dpr-dialog-close', 'aria-label': '关闭配置面板', onClick: onClose }, '×')),
    React.createElement(RunView, { sessionId })))
}
