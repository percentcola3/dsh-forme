import React from 'react'
import { SelectionMenu } from './selection-menu.ts'
import type { Context } from '@deepseek-ai/cordis'
import { renderOnTabRow, useWorkspaceToolHost } from './tab-host.ts'
import { installFilesWorkspace, type Layout, type Sidebar } from './files-workspace.ts'

export const inject = ['slots', 'sidebarRight', 'layout', 'sessions', 'uiWorkspace']

type HeaderProps = {
  sessionId?: string
  ctx: Context
}

function workspaceName(ctx: Context, sessionId?: string): string {
  const sessions = ctx.get('sessions') as {
    list?: { getSnapshot?: () => { byId: Record<string, { cwd?: string }> } }
  } | undefined
  const snap = sessions?.list?.getSnapshot?.()
  const navigation = ctx.get('uiWorkspace') as { selection: { getSnapshot(): { sessionId?: string } } }
  const id = sessionId || navigation.selection.getSnapshot().sessionId
  const cwd = id ? snap?.byId[id]?.cwd : undefined
  if (!cwd) return '文件'
  return cwd
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
  const name = workspaceName(props.ctx, props.sessionId)
  const chip = React.createElement(
    'span',
    {
      className: 'dfp-chip dfp-path-chip',
      title: name,
    },
    React.createElement('svg', {
      width: 12,
      height: 12,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.5',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': true,
    }, React.createElement('path', { d: 'M2.5 4.5h4l1.5 1.5h5.5v7.5h-11z' })),
    React.createElement('span', { className: 'dfp-chip-label' }, name),
  )
  return React.createElement(
    React.Fragment,
    null,
    React.createElement('span', { ref: anchorRef, className: 'dfp-anchor' }),
    renderOnTabRow(host, chip, chip),
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
[data-dfp-embedded] [data-dockkit-cell]:has(> [data-dfp-tree]) { flex:0 0 min(280px, 32%) !important; }
[data-dfp-embedded] [data-dockkit-cell]:has(> [data-dfp-preview]) { flex:1 1 0 !important; }
[data-dfp-embedded] [data-dockkit-split]:has(> [data-dockkit-cell] > [data-dfp-tree]) > [data-dockkit-divider] { pointer-events:none; cursor:default; }
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
.dfp-path-chip { order:0; max-width:240px !important; cursor:default !important; }
.dgp-toolbar { order:1; }
.dfp-chip { appearance:none; border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-secondary); font:inherit; display:inline-flex; align-items:center; gap:5px; height:28px; box-sizing:border-box; max-width:160px; min-width:0; padding:0 8px; border-radius:8px; font-size:12px; line-height:1; white-space:nowrap; cursor:pointer; }
.dfp-chip svg { flex:none; }
.dfp-chip-label { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.dfp-chip[aria-pressed="true"] { color:var(--dsw-alias-state-business-primary); border-color:var(--dsw-alias-state-business-primary); background:var(--dsw-specific-sidebar-nav-item-active-accent); }
.dfp-chip:focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:2px; }
`
  document.head.appendChild(tag)
}
