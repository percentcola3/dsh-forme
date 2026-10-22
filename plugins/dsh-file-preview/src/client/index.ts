import React from 'react'
import { SelectionMenu } from './selection-menu.ts'
import type { Context } from '@deepseek-ai/cordis'
import { renderOnTabRow, useWorkspaceToolHost } from './tab-host.ts'
import { openOfficialTerminal } from '../../../dsh-terminal/src/client/official-terminal.ts'
import { installFilesWorkspace, type Layout, type Sidebar } from './files-workspace.ts'

export const inject = ['slots', 'sidebarRight', 'layout', 'sessions', 'uiWorkspace']

type HeaderProps = {
  sessionId?: string
  ctx: Context
}

type Sessions = { list: { getSnapshot(): { byId: Record<string, { cwd?: string }> }; subscribe(listener: () => void): () => void } }
type Navigation = { selection: { getSnapshot(): { sessionId?: string }; subscribe(listener: () => void): () => void } }

/** One lightweight probe per distinct project path; results cache across tab switches. */
const gitPaths = new Map<string, boolean>()
async function probeGit(sessionId: string | undefined, cwd: string): Promise<boolean> {
  if (!cwd) return false
  if (gitPaths.has(cwd)) return gitPaths.get(cwd)!
  gitPaths.set(cwd, false)
  try {
    const res = await fetch('/dsh-file-preview', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId, cwd }) })
    const value = await res.json()
    if (res.ok && typeof value.git === 'boolean') { gitPaths.set(cwd, value.git); return value.git }
  } catch { /* offline stays "no icon", retried on the next path change */ }
  return false
}

function useWorkspacePath(ctx: Context, sessionId?: string): string {
  const sessions = ctx.get('sessions') as Sessions
  const navigation = ctx.get('uiWorkspace') as Navigation
  const snapshot = React.useSyncExternalStore(sessions.list.subscribe, sessions.list.getSnapshot)
  const selection = React.useSyncExternalStore(navigation.selection.subscribe, navigation.selection.getSnapshot)
  const id = sessionId || selection.sessionId
  return (id ? snapshot.byId[id]?.cwd : undefined) ?? ''
}

function useIsGit(ctx: Context, sessionId: string | undefined, name: string): boolean {
  const [git, setGit] = React.useState(() => gitPaths.get(name) ?? false)
  React.useEffect(() => {
    let live = true
    void probeGit(sessionId, name).then(value => { if (live) setGit(value) })
    return () => { live = false }
  }, [sessionId, name])
  return git
}

export function apply(ctx: Context): void {
  const slots = ctx.get('slots') as {
    inject(name: string, register: () => () => void): () => void
    register(options: {name: string; id: string; order: number; label: string}, render: (props: {sessionId?: string}) => React.ReactElement): () => void
  }
  injectStyles()
  const sidebar = ctx.get('sidebarRight') as Sidebar
  const workspace = installFilesWorkspace(sidebar, ctx.get('layout') as Layout, () => {
    const navigation = ctx.get('uiWorkspace') as { selection: { getSnapshot(): { sessionId?: string } } }
    return navigation.selection.getSnapshot().sessionId
  })
  ctx.effect(() => () => workspace.dispose())
  slots.inject('conversation.view', () => slots.register(
    { name: 'conversation.view', id: 'dsh-files', order: 21, label: '文件' },
    (props: { sessionId?: string }) => React.createElement(FilesView, { ctx, sessionId: props.sessionId, workspace }),
  ))
  slots.inject('conversation.session.header.actions', () => slots.register(
    { name: 'conversation.session.header.actions', id: 'dsh-file-preview', order: 0, label: '文件' },
    (props: { sessionId?: string }) => React.createElement(FilesAction, { ctx, sessionId: props.sessionId }),
  ))
}

function FilesAction(props: HeaderProps): React.ReactElement {
  const { anchorRef, host } = useWorkspaceToolHost()
  const name = useWorkspacePath(props.ctx, props.sessionId)
  const [copyState, setCopyState] = React.useState<'idle' | 'copied' | 'failed'>('idle')
  const copyEpoch = React.useRef(0)
  React.useEffect(() => {
    copyEpoch.current++
    setCopyState('idle')
    return () => { copyEpoch.current++ }
  }, [name])
  React.useEffect(() => {
    if (copyState === 'idle') return
    const timer = setTimeout(() => setCopyState('idle'), 2500)
    return () => clearTimeout(timer)
  }, [copyState])
  const copy = async () => {
    const epoch = ++copyEpoch.current
    try {
      await navigator.clipboard.writeText(name)
      if (copyEpoch.current === epoch) setCopyState('copied')
    } catch {
      if (copyEpoch.current === epoch) setCopyState('failed')
    }
  }
  const copyByKey = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void copy() }
  }
  const isGit = useIsGit(props.ctx, props.sessionId, name)
  const openTerminal = (event: React.MouseEvent<HTMLButtonElement>) => {
    try { openOfficialTerminal(props.ctx.get('sidebarRight') as never, event.currentTarget) }
    catch (error) { console.warn('dsh-file-preview: could not open the official terminal', error) }
  }
  const chip = !name ? React.createElement(React.Fragment) : React.createElement(
    'span',
    {
      className: 'dfp-chip dfp-path-chip',
      'data-dfp-git': isGit || undefined,
      title: name,
    },
    isGit ? React.createElement('svg', {
      width: 12,
      height: 12,
      viewBox: '0 0 16 16',
      fill: 'currentColor',
      'aria-hidden': true,
    }, React.createElement('path', { d: 'M5 3a2 2 0 1 1-2.6 1.9L1.6 5.8a1.2 1.2 0 1 0 .3 2.2l1.8-.6a2 2 0 1 0 2.2-3.2A2 2 0 0 1 5 3zm6 6.5a2 2 0 1 1-2.6 1.9c-.6.3-1.6.9-2.3 1.3a1.2 1.2 0 1 0 1.1 2.1l3.8-2.1v-3.2zm0-6.4a2 2 0 1 0 0 3.8v1.9L7.3 11a1.2 1.2 0 0 0 1.2 2.1l3.5-2v-4.9a2 2 0 0 0 0-3.2zM11 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM4 4a1 1 0 1 0 0 0zm0 7a1 1 0 1 0 0 2 1 1 0 0 0 0-2z' })) : null,
    React.createElement('span', { className: 'dfp-chip-label dfp-path-label' }, name),
    React.createElement('button', {
      type: 'button', className: 'dfp-copy-path', onClick: () => { void copy() }, onKeyDown: copyByKey,
      'aria-label': copyState === 'copied' ? '路径已复制' : '复制项目路径',
      title: copyState === 'failed' ? '复制失败，请选中路径文字手动复制' : copyState === 'copied' ? '已复制' : '复制完整项目路径',
    }, React.createElement('svg', { width: 13, height: 13, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
      React.createElement('path', { d: copyState === 'copied' ? 'M3 8l3 3 7-7' : 'M5 5h8v9H5zM3 11H2V2h8v1' }))),
    React.createElement('span', { className: 'dfp-copy-feedback', role: 'status', 'aria-live': 'polite' }, copyState === 'copied' ? '已复制完整路径' : copyState === 'failed' ? '复制失败，请选中路径手动复制' : ''),
  )
  const terminal = React.createElement('button', {
    type: 'button', className: 'dfp-chip dfp-open-terminal', onClick: openTerminal,
    'aria-label': '打开终端', title: '在右侧栏打开内置终端',
  }, React.createElement('svg', { width: 12, height: 12, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': true },
    React.createElement('path', { d: 'M3 4l3.5 4L3 12M8 12h5' })))
  return React.createElement(
    React.Fragment,
    null,
    React.createElement('span', { ref: anchorRef, className: 'dfp-anchor' }),
    renderOnTabRow(host, React.createElement(React.Fragment, null, chip, terminal), chip),
  )
}

function FilesView({ ctx, sessionId, workspace }: { ctx: Context; sessionId?: string; workspace: ReturnType<typeof installFilesWorkspace> }): React.ReactElement {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    let cleanup: (() => void) | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const frame = requestAnimationFrame(() => {
      timer = setTimeout(() => { if (ref.current) cleanup = workspace.mount(ref.current, sessionId) }, 0)
    })
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); cleanup?.() }
  }, [workspace, sessionId])
  return React.createElement('div', { className: 'dfp-view', 'data-conversation-composer-overlay': '' },
    React.createElement('div', { className: 'dfp-viewport', ref }, '正在打开文件…'),
    React.createElement(SelectionMenu, { ctx, sessionId }))
}

let stylesInjected = false
function injectStyles(): void {
  if (stylesInjected || typeof document === 'undefined') return
  stylesInjected = true
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-file-preview'
  tag.textContent = `
.dfp-view { height:100%; flex:1; min-height:0; box-sizing:border-box; }
.dfp-viewport { height:100%; min-height:0; color:var(--dsw-alias-label-tertiary); }
[data-dfp-embedded] { position:fixed !important; inset:auto !important; left:var(--dfp-left) !important; top:var(--dfp-top) !important; width:var(--dfp-width) !important; height:var(--dfp-height) !important; z-index:10 !important; transform:none !important; transition:none !important; border:0 !important; overflow:hidden; }
[data-dfp-embedded] [data-sidebar-right-mode], [data-dfp-embedded] [data-sidebar-right-toggle] { display:none !important; }
/* Current DockKit positions panes directly; the older cell-only flex rule
   does not constrain these panes and leaves a 50/50 split. */
[data-dfp-embedded] { --dfp-tree-width:22%; }
[data-dfp-embedded] [data-dfp-tree] { left:0 !important; width:var(--dfp-tree-width) !important; min-width:0 !important; box-sizing:border-box; }
[data-dfp-embedded] [data-dfp-preview] { left:var(--dfp-tree-width) !important; width:calc(100% - var(--dfp-tree-width)) !important; min-width:0 !important; box-sizing:border-box; }
[data-dfp-embedded] [data-dockkit-cell]:has(> [data-dfp-tree]) { flex:0 0 var(--dfp-tree-width) !important; }
[data-dfp-embedded] [data-dockkit-cell]:has(> [data-dfp-preview]) { flex:1 1 0 !important; }
[data-dfp-embedded] [data-dockkit-cell] > :is([data-dfp-tree],[data-dfp-preview]) { left:0 !important; width:100% !important; }
[data-dfp-embedded] [data-dockkit-divider] { display:none !important; }
[data-dfp-tree] { background:color-mix(in srgb, var(--dsw-alias-bg-base) 94%, var(--dsw-alias-label-primary) 6%); }
[data-dfp-tree] [data-files-state] { background:inherit; }
[data-dfp-preview] { background:var(--dsw-alias-bg-base); }
[data-dfp-tree] [data-dockkit-strip] { display:none; }
[data-dfp-preview][data-dfp-empty="true"] { position:relative; }
[data-dfp-preview][data-dfp-empty="true"] > * { visibility:hidden; }
[data-dfp-preview][data-dfp-empty="true"]::after { content:'选择左侧文件以预览'; position:absolute; inset:0; display:grid; place-items:center; pointer-events:none; color:var(--dsw-alias-label-tertiary); font-size:13px; }
[data-dfp-tree] [data-files-entry] > button { border-radius:6px; transition:background-color 120ms; }
[data-dfp-tree] [data-files-entry] > button:hover { background:var(--dsw-alias-interactive-bg-hover); }
[data-dfp-tree] [data-files-entry] > button[aria-current="true"] { background:var(--dsw-specific-sidebar-nav-item-active-accent); box-shadow:inset 3px 0 var(--dsw-alias-state-business-primary); font-weight:600; }
[data-dfp-tree] [data-files-entry] > button:focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:-2px; }
.dfp-selection-menu { position:fixed; z-index:10000; width:248px; max-width:calc(100vw - 16px); box-sizing:border-box; padding:5px; border:1px solid var(--dsw-alias-border-l2); border-radius:12px; background:var(--dsw-alias-bg-layer-3); box-shadow:0 6px 24px rgb(0 0 0 / .12); }
.dfp-selection-menu button { display:flex; align-items:center; gap:10px; width:100%; box-sizing:border-box; padding:10px; border:0; border-radius:8px; background:none; color:var(--dsw-alias-label-primary); text-align:left; font:inherit; font-size:13px; cursor:pointer; }
.dfp-selection-menu button:hover { background:var(--dsw-alias-interactive-bg-hover); }
.dfp-selection-menu button:focus-visible { background:var(--dsw-alias-interactive-bg-hover); outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:-2px; }
.dfp-menu-icon { display:grid; place-items:center; width:32px; height:32px; flex:none; border-radius:8px; color:var(--dsw-alias-state-business-primary); background:var(--dsw-specific-sidebar-nav-item-active-accent); }
.dfp-menu-copy { display:flex; flex-direction:column; gap:4px; min-width:0; }
.dfp-menu-label { font-weight:500; }
.dfp-menu-description { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; color:var(--dsw-alias-label-tertiary); }
.dfp-selection-menu p { padding:6px 10px; margin:0; font-size:12px; color:var(--dsw-alias-state-error-primary); }
.dfp-anchor { display:none; }

header [role="tablist"] { flex-wrap:nowrap !important; align-items:center; gap:0; padding:0 8px 8px; }
header [role="tablist"] > [role="tab"] { isolation:isolate; position:relative; display:inline-flex; align-items:center; justify-content:center; gap:5px; flex:none; box-sizing:border-box; height:34px; padding:0 14px; border:0; border-radius:0; white-space:nowrap; color:var(--dsw-alias-label-secondary); background:var(--dsw-alias-interactive-bg-hover); font-size:13px; font-weight:500; line-height:26px; }
header [role="tablist"] > [role="tab"]::after { display:none; }
header [role="tablist"] > [role="tab"]::before { content:''; position:absolute; inset:4px; border-radius:999px; z-index:-1; }
header [role="tablist"] > [role="tab"]:hover { color:var(--dsw-alias-label-primary); }
header [role="tablist"] > [role="tab"]:hover::before { background:var(--dsw-alias-bg-layer-2); }
header [role="tablist"] > [role="tab"][aria-selected="true"] { color:var(--dsw-alias-label-primary); font-weight:600; }
header [role="tablist"] > [role="tab"][aria-selected="true"]::before { background:var(--dsw-alias-bg-base); box-shadow:0 1px 4px rgb(0 0 0 / .14); }
header [role="tablist"] > [role="tab"]:focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:-2px; }
header [role="tablist"] > [role="tab"][data-dsh-nav="chat"] { order:0; border-radius:999px 0 0 999px; }
header [role="tablist"] > [role="tab"][data-dsh-nav="files"] { order:1; }
header [role="tablist"] > [role="tab"][data-dsh-nav="changes"] { order:2; }
header [role="tablist"] > [role="tab"][data-dsh-nav="trace"] { order:3; border-radius:0 999px 999px 0; }
header [role="tablist"] > [role="tab"][data-dsh-nav="other"] { order:4; }
.dsh-ws-tools { display:inline-flex; align-items:center; order:100; gap:6px; min-width:0; max-width:calc(100% - 350px); margin:0 0 0 auto; padding-left:16px; flex:0 1 auto; flex-wrap:nowrap; }
.dgp-tab-counts { display:inline-flex; gap:3px; font-size:10px; font-weight:400; }
.dfp-path-chip { order:0; max-width:320px !important; }
.dfp-open-terminal { order:0; width:28px; padding:0; justify-content:center; }
.dfp-open-terminal:hover { color:var(--dsw-alias-label-primary); border-color:var(--dsw-alias-border-l2); }
.dgp-toolbar { order:1; }
.dfp-chip { appearance:none; border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-secondary); font:inherit; display:inline-flex; align-items:center; gap:5px; height:28px; box-sizing:border-box; max-width:160px; min-width:0; padding:0 8px; border-radius:8px; font-size:12px; line-height:1; white-space:nowrap; cursor:pointer; }
.dfp-chip svg { flex:none; }
.dfp-chip.dfp-path-chip { border:0; background:transparent; padding:2px 4px; cursor:copy; position:relative; }
.dfp-chip.dfp-path-chip:hover { background:var(--dsw-alias-interactive-bg-hover); border-radius:6px; }
.dfp-chip.dfp-path-chip:focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:1px; }
.dfp-path-label { user-select:text; cursor:text; }
.dfp-path-chip[data-dfp-git] { color:var(--dsw-alias-label-secondary); }
.dfp-path-chip[data-dfp-git] svg { color:#e8a97a; }
.dfp-copy-path { position:relative; display:inline-flex; align-items:center; justify-content:center; flex:none; width:24px; height:24px; margin:2px 0 2px 2px; border:0; border-radius:4px; background:transparent; color:inherit; cursor:pointer; }
.dfp-copy-path::before { content:''; position:absolute; inset:-6px; }
.dfp-copy-path:hover { color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-layer-2); }
.dfp-copy-path:focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:1px; }
.dfp-copy-feedback { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; }
.dfp-chip-label { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.dfp-chip[aria-pressed="true"] { color:var(--dsw-alias-state-business-primary); border-color:var(--dsw-alias-state-business-primary); background:var(--dsw-specific-sidebar-nav-item-active-accent); }
.dfp-chip:focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:2px; }
`
  document.head.appendChild(tag)
}
