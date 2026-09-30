import React from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { splitUnifiedDiff, type SplitLine } from './diff-rows.ts'
import { FloatingPanel, renderOnTabRow, useWorkspaceToolHost } from './tab-host.ts'

export const inject = ['slots']

type SessionSnap = {
  current?: string
  byId: Record<string, { cwd?: string }>
}

type StatusPayload = {
  ok: boolean
  error?: string
  branch?: string
  upstream?: string
  files?: Array<{ path: string; status: string; insertions?: number; deletions?: number }>
  insertions?: number
  deletions?: number
  stat?: string
}

type HeaderProps = {
  sessionId?: string
  ctx: Context
}

function workspaceOf(ctx: Context, sessionId?: string): { sessionId: string; cwd: string } | null {
  const sessions = ctx.get('sessions') as { list?: { getSnapshot?: () => SessionSnap } } | undefined
  const snap = sessions?.list?.getSnapshot?.()
  const id = sessionId || snap?.current
  if (!id) return null
  const cwd = snap?.byId[id]?.cwd
  if (!cwd) return null
  return { sessionId: id, cwd }
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json() as T & { error?: string }
  if (!res.ok) throw new Error(data.error || res.statusText)
  return data
}

function sendToAgent(ctx: Context, sessionId: string, text: string): Promise<void> {
  const sessions = ctx.get('sessions') as {
    scope?: (id: string) => Context | undefined
  } | undefined
  const scoped = sessions?.scope?.(sessionId)
  const conversation = (scoped ?? ctx).get('conversation') as { send?: (value: string) => Promise<void> } | undefined
  if (!conversation?.send) throw new Error('conversation service is unavailable')
  return conversation.send(text)
}



function fileName(path: string): { base: string; dir: string } {
  const parts = path.replace(/\\/g, '/').split('/')
  return { base: parts.pop() || path, dir: parts.join('/') }
}

function statusTone(status: string): string {
  if (status.includes('D')) return 'dgp-st-del'
  if (status.includes('A') || status.includes('?')) return 'dgp-st-add'
  if (status.includes('U')) return 'dgp-st-del'
  return 'dgp-st-mod'
}

function icon(path: string): React.ReactElement {
  return React.createElement('svg', {
    width: 12,
    height: 12,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.5',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': true,
  }, React.createElement('path', { d: path }))
}

export function apply(ctx: Context): void {
  injectStyles()
  ctx.slots.inject('conversation.view', () => ctx.slots.register(
    { name: 'conversation.view', id: 'git-changes', order: 20, label: 'Changes' },
    (props: HeaderProps) => React.createElement(GitChangesView, { ctx, sessionId: props.sessionId }),
  ))
  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register(
    { name: 'conversation.session.header.actions', id: 'dsh-git-plus', order: 1, label: 'Git' },
    (props: HeaderProps) => React.createElement(GitToolbar, { ctx, sessionId: props.sessionId }),
  ))
}

function GitToolbar(props: HeaderProps): React.ReactElement {
  const loc = workspaceOf(props.ctx, props.sessionId)
  const { anchorRef, host, changesHost } = useWorkspaceToolHost()
  const [status, setStatus] = React.useState<StatusPayload | null>(null)
  const [menu, setMenu] = React.useState<'commit' | 'branch' | null>(null)
  const branchRef = React.useRef<Parameters<typeof FloatingPanel>[0]['anchor']>(null)
  const commitRef = React.useRef<Parameters<typeof FloatingPanel>[0]['anchor']>(null)

  const reload = React.useCallback(async () => {
    if (!loc) return
    try {
      setStatus(await post<StatusPayload>('/dsh-git-plus/status', loc))
    } catch {
      setStatus(null)
    }
  }, [loc?.sessionId, loc?.cwd])

  React.useEffect(() => { void reload() }, [reload])
  React.useEffect(() => {
    const timer = setInterval(() => { void reload() }, 15_000)
    return () => clearInterval(timer)
  }, [reload])

  const bar = React.createElement(
    'div',
    { className: 'dgp-toolbar' },
    React.createElement(
      'button',
      {
        type: 'button',
        className: 'dgp-chip',
        ref: branchRef,
        'aria-expanded': menu === 'branch',
        'aria-haspopup': 'dialog',
        title: status?.upstream ? `${status.branch} → ${status.upstream}` : (status?.branch || '切换分支'),
        onClick: () => setMenu(menu === 'branch' ? null : 'branch'),
      },
      icon('M6 3v8M6 11a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6 6a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6 6h4.5A2.5 2.5 0 0 1 13 8.5V11'),
      React.createElement('span', { className: 'dgp-chip-label' }, status?.branch || 'Git'),
      icon('M4 6l4 4 4-4'),
    ),
    React.createElement(
      'button',
      {
        type: 'button',
        className: 'dgp-pill',
        ref: commitRef,
        'aria-expanded': menu === 'commit',
        'aria-haspopup': 'dialog',
        onClick: () => setMenu(menu === 'commit' ? null : 'commit'),
      },
      'Commit & Push',
      icon('M4 6l4 4 4-4'),
    ),
    React.createElement(FloatingPanel, {
      open: menu === 'branch',
      width: 280,
      anchor: branchRef.current,
      onClose: () => setMenu(null),
      children: React.createElement(BranchMenu, {
        loc,
        current: status?.branch,
        onSwitched: () => {
          setMenu(null)
          void reload()
        },
      }),
    }),
    React.createElement(FloatingPanel, {
      open: menu === 'commit',
      width: 360,
      anchor: commitRef.current,
      onClose: () => setMenu(null),
      children: React.createElement(CommitMenu, {
        ctx: props.ctx,
        sessionId: props.sessionId,
        onClose: () => setMenu(null),
      }),
    }),
  )

  return React.createElement(
    React.Fragment,
    null,
    React.createElement('span', { ref: anchorRef, className: 'dgp-anchor' }),
    renderOnTabRow(host, bar, bar),
    changesHost ? renderOnTabRow(changesHost, React.createElement('span', { className: 'dgp-tab-counts', 'aria-hidden': true },
      React.createElement('span', { className: 'dgp-ins' }, `+${status?.insertions ?? 0}`),
      React.createElement('span', { className: 'dgp-del' }, `-${status?.deletions ?? 0}`)), React.createElement(React.Fragment)) : null,
  )
}

// Small session cache avoids a blank list/diff on each Tab switch; every
// mount still revalidates against Git. Only retain the last viewed file.
type ChangesSnapshot = { status: StatusPayload | null; selected: string; rows: SplitLine[] }
const changesSnapshots = new Map<string, ChangesSnapshot>()
function rememberChanges(key: string, snapshot: ChangesSnapshot): void {
  changesSnapshots.delete(key)
  changesSnapshots.set(key, snapshot)
  if (changesSnapshots.size > 8) changesSnapshots.delete(changesSnapshots.keys().next().value!)
}

function GitChangesView(props: HeaderProps): React.ReactElement {
  const loc = workspaceOf(props.ctx, props.sessionId)
  const cacheKey = JSON.stringify(loc)
  const cached = changesSnapshots.get(cacheKey)
  const [status, setStatus] = React.useState<StatusPayload | null>(() => cached?.status ?? null)
  const latestStatus = React.useRef(status)
  latestStatus.current = status
  const [error, setError] = React.useState('')
  const [selected, setSelected] = React.useState(() => cached?.selected ?? '')
  const [rows, setRows] = React.useState<SplitLine[]>(() => cached?.rows ?? [])
  const [busy, setBusy] = React.useState(false)

  const reload = React.useCallback(async () => {
    if (!loc) return
    setError('')
    try {
      const next = await post<StatusPayload>('/dsh-git-plus/status', loc)
      setStatus(next)
      latestStatus.current = next
      const previous = changesSnapshots.get(cacheKey)
      if (previous) rememberChanges(cacheKey, { ...previous, status: next })
      setSelected((current) => {
        if (current && next.files?.some(file => file.path === current)) return current
        return next.files?.[0]?.path ?? ''
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [loc?.sessionId, loc?.cwd])

  React.useEffect(() => { void reload() }, [reload])

  React.useEffect(() => {
    if (!loc || !selected) {
      setRows([])
      return
    }
    let cancelled = false
    const previous = changesSnapshots.get(cacheKey)
    const hasPreview = previous?.selected === selected
    setRows(hasPreview ? previous.rows : [])
    setBusy(!hasPreview)
    void post<{ diff?: string }>('/dsh-git-plus/diff', { ...loc, path: selected })
      .then((next) => {
        if (!cancelled) {
          const parsed = splitUnifiedDiff(next.diff || '')
          setRows(parsed)
          rememberChanges(cacheKey, { status: latestStatus.current, selected, rows: parsed })
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setBusy(false)
      })
    return () => { cancelled = true }
  }, [loc?.sessionId, loc?.cwd, selected])

  const files = status?.files ?? []
  const current = files.find(file => file.path === selected)
  const name = selected ? fileName(selected) : null

  return React.createElement(
    'div',
    { className: 'dgp-page', 'data-conversation-composer-overlay': '' },
    React.createElement(
      'aside',
      { className: 'dgp-page-files' },
      React.createElement(
        'div',
        { className: 'dgp-page-head' },
        React.createElement('span', null, 'CHANGES'),
        React.createElement('span', { className: 'dgp-count' }, String(files.length)),
      ),
      error ? React.createElement('p', { className: 'dgp-error' }, error) : null,
      !loc ? React.createElement('p', { className: 'dgp-hint' }, '打开一个带工作目录的会话后再试。') : null,
      status && !status.ok ? React.createElement('p', { className: 'dgp-hint' }, status.error) : null,
      loc && status?.ok && files.length === 0
        ? React.createElement('p', { className: 'dgp-hint' }, '没有未提交的变更')
        : files.map((file) => {
          const parts = fileName(file.path)
          return React.createElement(
            'button',
            {
              key: file.path,
              type: 'button',
              className: selected === file.path ? 'dgp-file dgp-file-on' : 'dgp-file',
              'aria-current': selected === file.path ? 'true' : undefined,
              onClick: () => setSelected(file.path),
              title: file.path,
            },
            React.createElement(
              'span',
              { className: 'dgp-file-main' },
              React.createElement('span', { className: 'dgp-file-base' }, parts.base),
              parts.dir ? React.createElement('span', { className: 'dgp-file-dir' }, parts.dir) : null,
            ),
            React.createElement(
              'span',
              { className: 'dgp-file-meta' },
              file.insertions ? React.createElement('span', { className: 'dgp-ins' }, `+${file.insertions}`) : null,
              file.deletions ? React.createElement('span', { className: 'dgp-del' }, `-${file.deletions}`) : null,
              React.createElement('code', { className: statusTone(file.status) }, file.status.trim() || file.status),
            ),
          )
        }),
    ),
    React.createElement(
      'section',
      { className: 'dgp-page-diff' },
      React.createElement(
        'div',
        { className: 'dgp-page-head dgp-diff-head' },
        name
          ? React.createElement(
            'span',
            { className: 'dgp-diff-title' },
            React.createElement('span', null, name.base),
            name.dir ? React.createElement('span', { className: 'dgp-file-dir' }, name.dir) : null,
            current ? React.createElement('code', { className: statusTone(current.status) }, current.status.trim() || current.status) : null,
          )
          : React.createElement('span', null, '选择一个文件'),
      ),
      React.createElement(DiffCompare, { rows, busy }),
    ),
  )
}

function DiffCompare(props: { rows: SplitLine[]; busy: boolean }): React.ReactElement {
  return React.createElement(
    'div',
    { className: 'dgp-split' },
    React.createElement(
      'div',
      { className: 'dgp-split-head' },
      React.createElement('div', null, '改动前'),
      React.createElement('div', null, '改动后'),
    ),
    React.createElement(
      'div',
      { className: 'dgp-split-body' },
      props.busy
        ? React.createElement('p', { className: 'dgp-hint' }, '加载 diff…')
        : props.rows.length === 0
          ? React.createElement('p', { className: 'dgp-hint' }, '没有可对比的内容')
          : props.rows.map((row, index) => React.createElement(
            'div',
            { key: index, className: 'dgp-pair' },
            React.createElement(DiffCell, { side: 'before', row }),
            React.createElement(DiffCell, { side: 'after', row }),
          )),
    ),
  )
}

function DiffCell(props: { side: 'before' | 'after'; row: SplitLine }): React.ReactElement {
  const before = props.side === 'before'
  const text = before ? props.row.left : props.row.right
  const no = before ? props.row.leftNo : props.row.rightNo
  const tone = before
    ? (props.row.kind === 'del' || props.row.kind === 'replace' ? 'dgp-line-del' : (text ? '' : 'dgp-line-empty'))
    : (props.row.kind === 'add' || props.row.kind === 'replace' ? 'dgp-line-add' : (text ? '' : 'dgp-line-empty'))
  return React.createElement(
    'div',
    { className: `dgp-line ${tone}` },
    React.createElement('span', { className: 'dgp-no' }, no ?? ''),
    React.createElement('pre', null, text || ' '),
  )
}

function BranchMenu(props: {
  loc: { sessionId: string; cwd: string } | null
  current?: string
  onSwitched: () => void
}): React.ReactElement {
  const [branches, setBranches] = React.useState<Array<{ name: string; current: boolean }>>([])
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState('')
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    if (!props.loc) return
    let cancelled = false
    void post<{ ok?: boolean; error?: string; branches?: Array<{ name: string; current: boolean }> }>(
      '/dsh-git-plus/branches',
      props.loc,
    ).then((next) => {
      if (cancelled) return
      setReady(true)
      if (next.ok === false) setError(next.error || '无法列出分支')
      else setBranches(next.branches ?? [])
    }).catch((err: unknown) => {
      if (cancelled) return
      setReady(true)
      setError(err instanceof Error ? err.message : String(err))
    })
    return () => { cancelled = true }
  }, [props.loc?.sessionId, props.loc?.cwd])

  const switchTo = async (branch: string) => {
    if (!props.loc || branch === props.current) return
    setBusy(branch)
    setError('')
    try {
      const next = await post<{ ok?: boolean; error?: string }>('/dsh-git-plus/switch', { ...props.loc, branch })
      if (next.ok === false) setError(next.error || `无法切换到 ${branch}`)
      else props.onSwitched()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy('')
    }
  }

  return React.createElement(
    React.Fragment,
    null,
    React.createElement('div', { className: 'dgp-menu-title' }, '切换分支'),
    error ? React.createElement('p', { className: 'dgp-error' }, error) : null,
    !props.loc ? React.createElement('p', { className: 'dgp-hint' }, '打开一个带工作目录的会话后再试。') : null,
    React.createElement(
      'div',
      { className: 'dgp-branch-list' },
      branches.length === 0
        ? React.createElement('p', { className: 'dgp-hint' }, ready ? '没有本地分支' : '加载分支…')
        : branches.map(branch => React.createElement(
          'button',
          {
            key: branch.name,
            type: 'button',
            className: branch.current || branch.name === props.current ? 'dgp-branch dgp-branch-on' : 'dgp-branch',
            'aria-current': branch.current || branch.name === props.current ? 'true' : undefined,
            disabled: Boolean(busy) || branch.name === props.current,
            onClick: () => { void switchTo(branch.name) },
          },
          React.createElement('span', null, branch.name),
          branch.current || branch.name === props.current ? React.createElement('span', null, '当前') : null,
        )),
    ),
  )
}

function CommitMenu(props: { ctx: Context; sessionId?: string; onClose: () => void }): React.ReactElement {
  const loc = workspaceOf(props.ctx, props.sessionId)
  const [message, setMessage] = React.useState('')
  const [busy, setBusy] = React.useState('')
  const [error, setError] = React.useState('')

  const summarize = async () => {
    if (!loc) return
    setBusy('summary')
    setError('')
    try {
      const next = await post<{ message?: string }>('/dsh-git-plus/summarize', loc)
      setMessage(next.message || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy('')
    }
  }

  const commit = async (push: boolean) => {
    if (!loc) return
    const text = message.trim()
    if (!text) {
      setError('先生成或填写提交说明')
      return
    }
    setBusy(push ? 'push' : 'commit')
    setError('')
    const instruction = push
      ? `Commit all current git changes in this workspace using this exact message, then push to the current upstream. Do not invent extra files.\n\n${text}`
      : `Commit all current git changes in this workspace using this exact message. Do not push.\n\n${text}`
    try {
      await sendToAgent(props.ctx, loc.sessionId, instruction)
      props.onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy('')
    }
  }

  return React.createElement(
    'div',
    { className: 'dgp-menu-content' },
    error ? React.createElement('p', { className: 'dgp-error' }, error) : null,
    React.createElement('textarea', {
      value: message,
      rows: 4,
      placeholder: '提交说明，可点「生成说明」',
      onChange: (event: { target: { value: string } }) => setMessage(event.target.value),
    }),
    React.createElement(
      'footer',
      { className: 'dgp-menu-foot' },
      React.createElement('button', { type: 'button', disabled: !loc || Boolean(busy), onClick: () => { void summarize() } }, busy === 'summary' ? '生成中…' : '生成说明'),
      React.createElement('button', { type: 'button', disabled: !loc || Boolean(busy), onClick: () => { void commit(false) } }, 'Commit'),
      React.createElement('button', { type: 'button', className: 'dgp-primary', disabled: !loc || Boolean(busy), onClick: () => { void commit(true) } }, 'Commit & Push'),
    ),
  )
}

declare const document: {
  createElement(tag: 'style'): { dataset: Record<string, string>; textContent: string }
  head: { appendChild(node: unknown): void }
}

let stylesInjected = false
function injectStyles(): void {
  if (stylesInjected || typeof document === 'undefined') return
  stylesInjected = true
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-git-plus'
  tag.textContent = `
.dgp-anchor { display:none; }

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
.dgp-toolbar { display:inline-flex; align-items:center; gap:6px; min-width:0; flex-wrap:nowrap; }
.dgp-chip, .dgp-pill { appearance:none; border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-secondary); font:inherit; display:inline-flex; align-items:center; gap:5px; height:28px; box-sizing:border-box; max-width:168px; min-width:0; padding:0 8px; border-radius:8px; font-size:12px; line-height:1; white-space:nowrap; cursor:pointer; }
.dgp-pill { max-width:none; flex:none; }
.dgp-chip svg, .dgp-pill svg { flex:none; }
.dgp-chip-label { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dgp-chip:hover, .dgp-pill:hover { color:var(--dsw-alias-label-primary); background:var(--dsw-alias-interactive-bg-hover); }
.dgp-chip[aria-expanded="true"], .dgp-pill[aria-expanded="true"], .dgp-pill[aria-pressed="true"] { color:var(--dsw-alias-state-business-primary); border-color:var(--dsw-alias-state-business-primary); background:var(--dsw-specific-sidebar-nav-item-active-accent); }
.dgp-chip:focus-visible, .dgp-pill:focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:2px; }
.dgp-menu-content { display:flex; flex-direction:column; gap:8px; min-width:0; }
.dgp-ins { color:#3c9; font-variant-numeric:tabular-nums; }
.dgp-del { color:var(--dsw-alias-state-error-primary); font-variant-numeric:tabular-nums; }
.dgp-menu { box-sizing:border-box; padding:12px; border-radius:12px; background:var(--dsw-alias-bg-layer-3); border:1px solid var(--dsw-alias-border-l2); box-shadow:var(--dsw-elevation-prominent); display:flex; flex-direction:column; gap:8px; max-height:min(420px, calc(100vh - 24px)); overflow:auto; }
.dgp-menu-title { font-size:12px; font-weight:600; color:var(--dsw-alias-label-tertiary); }
.dgp-menu textarea { font:inherit; min-height:72px; border-radius:8px; border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); padding:8px; }
.dgp-menu-foot { display:flex; justify-content:flex-end; gap:8px; }
.dgp-menu-foot button, .dgp-primary { appearance:none; border:1px solid var(--dsw-alias-border-l2); background:none; border-radius:8px; padding:6px 12px; font:inherit; font-size:12px; cursor:pointer; color:var(--dsw-alias-label-secondary); }
.dgp-primary { background:var(--dsw-alias-label-primary) !important; color:var(--dsw-alias-bg-layer-3) !important; }
.dgp-branch-list { overflow:auto; display:flex; flex-direction:column; min-height:0; }
.dgp-branch { appearance:none; border:0; background:none; width:100%; display:flex; justify-content:space-between; gap:8px; text-align:left; padding:8px 10px; border-radius:8px; font:inherit; font-size:13px; cursor:pointer; color:var(--dsw-alias-label-secondary); }
.dgp-branch:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-primary); }
.dgp-branch-on, .dgp-branch-on:hover:not(:disabled) { background:var(--dsw-specific-sidebar-nav-item-active-accent); color:var(--dsw-alias-state-business-primary); box-shadow:inset 3px 0 var(--dsw-alias-state-business-primary); font-weight:600; }
.dgp-branch:focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:-2px; }
.dgp-branch:disabled { cursor:default; }
.dgp-branch:disabled:not(.dgp-branch-on) { opacity:.7; }
.dgp-page { display:flex; height:100%; width:100%; min-height:0; overflow:hidden; background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); box-sizing:border-box; }
.dgp-page-files { width:280px; flex:none; overflow:auto; border-right:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-2); padding-bottom:calc(var(--dsh-composer-height, 152px) + 16px); }
.dgp-page-diff { flex:1; min-width:0; min-height:0; display:flex; flex-direction:column; }
.dgp-page-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 12px; font-size:11px; font-weight:600; letter-spacing:.06em; color:var(--dsw-alias-label-tertiary); border-bottom:1px solid var(--dsw-alias-border-l2); }
.dgp-count { font-variant-numeric:tabular-nums; }
.dgp-diff-head { letter-spacing:0; }
.dgp-diff-title { display:flex; align-items:center; gap:8px; min-width:0; font-size:13px; font-weight:500; color:var(--dsw-alias-label-primary); letter-spacing:0; }
.dgp-file { appearance:none; box-sizing:border-box; border:0; border-radius:6px; background:none; width:calc(100% - 12px); margin:2px 6px; display:flex; align-items:center; gap:8px; text-align:left; padding:8px 10px; font:inherit; font-size:12px; cursor:pointer; color:var(--dsw-alias-label-secondary); }
.dgp-file-main { flex:1; min-width:0; display:flex; flex-direction:column; gap:1px; }
.dgp-file-base { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-primary); }
.dgp-file-dir { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; color:var(--dsw-alias-label-tertiary); }
.dgp-file-meta { flex:none; display:inline-flex; align-items:center; gap:6px; font-size:11px; }
.dgp-file-meta code, .dgp-diff-title code { font:inherit; font-size:11px; font-weight:600; }
.dgp-st-mod { color:#c90; }
.dgp-st-add { color:#3c9; }
.dgp-st-del { color:var(--dsw-alias-state-error-primary); }
.dgp-file:hover { background:var(--dsw-alias-interactive-bg-hover); }
.dgp-file-on, .dgp-file-on:hover { background:var(--dsw-specific-sidebar-nav-item-active-accent); box-shadow:inset 3px 0 0 var(--dsw-alias-state-business-primary); }
.dgp-file-on .dgp-file-base { font-weight:600; }
.dgp-file-on .dgp-file-dir { color:var(--dsw-alias-label-secondary); }
.dgp-file:focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:-2px; }
.dgp-split { display:flex; flex-direction:column; min-height:0; flex:1; }
.dgp-split-head { display:grid; grid-template-columns:1fr 1fr; position:sticky; top:0; z-index:1; background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-tertiary); font-size:12px; }
.dgp-split-head > div { padding:8px 12px; border-bottom:1px solid var(--dsw-alias-border-l2); }
.dgp-split-head > div:first-child { border-right:1px solid var(--dsw-alias-border-l2); }
.dgp-split-body { flex:1; min-height:0; overflow:auto; padding-bottom:calc(var(--dsh-composer-height, 152px) + 16px); font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px; }
.dgp-pair { display:grid; grid-template-columns:1fr 1fr; }
.dgp-line { display:grid; grid-template-columns:48px minmax(0,1fr); min-height:18px; border-right:1px solid var(--dsw-alias-border-l2); }
.dgp-pair > .dgp-line:last-child { border-right:0; }
.dgp-no { padding:0 8px; text-align:right; color:var(--dsw-alias-label-tertiary); user-select:none; }
.dgp-line pre { margin:0; padding:0 8px; white-space:pre; overflow:hidden; text-overflow:ellipsis; }
.dgp-line-del { background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 16%, transparent); }
.dgp-line-add { background:color-mix(in srgb, #3c9 18%, transparent); }
.dgp-line-empty { background:color-mix(in srgb, var(--dsw-alias-label-tertiary) 8%, transparent); }
.dgp-error { color:var(--dsw-alias-state-error-primary); padding:8px 12px; font-size:12px; }
.dgp-hint { padding:8px 12px; font-size:12px; color:var(--dsw-alias-label-tertiary); }
`
  document.head.appendChild(tag)
}
