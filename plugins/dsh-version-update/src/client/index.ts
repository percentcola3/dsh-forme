import { installBlankSessionNavigation } from './blank-session-nav.ts'
import { installPerformanceRecorder } from './performance.ts'
import React from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { WindowChrome } from './window-chrome.ts'

export const inject = ['slots', 'sessions']

type CheckState = {
  state: string
  current: string | null
  latest: string | null
  mode: string
  hint: string
  error: string | null
}

export function apply(ctx: Context): void {
  ctx.effect(installPerformanceRecorder)
  ctx.effect(() => {
    const sessions=ctx.get('sessions') as {list:{getSnapshot():{current?:string};subscribe(fn:()=>void):()=>void}}|undefined
    let current=sessions?.list.getSnapshot().current
    return sessions?.list.subscribe(()=>{
      const next=sessions.list.getSnapshot().current
      if(next!==current){current=next;globalThis.document.dispatchEvent(new CustomEvent('dsh-performance',{detail:{kind:'session-change',duration:0}}))}
    })
  })
  ctx.effect(() => installBlankSessionNavigation(ctx))
  injectStyles()
  ctx.slots.inject('shell.overlay', () => ctx.slots.register(
    { name: 'shell.overlay', id: 'dsh-window-chrome', order: 0, label: 'Window' },
    () => React.createElement(WindowChrome),
  ))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register(
    { name: 'shell.overlay', id: 'dsh-version-update', order: 10, label: 'Update' },
    () => React.createElement(UpdateBadge),
  ))
}

function UpdateBadge(): React.ReactElement | null {
  const [info, setInfo] = React.useState<CheckState | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')

  const load = React.useCallback(async (force = false) => {
    const res = await fetch(`/dsh-version-update/check${force ? '?force=1' : ''}`, { credentials: 'include' })
    setInfo(await res.json() as CheckState)
  }, [])

  React.useEffect(() => {
    void load()
    const timer = setInterval(() => { void load() }, 300_000)
    return () => clearInterval(timer)
  }, [load])

  const update = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/dsh-version-update/update', { method: 'POST', credentials: 'include' })
      const body = await res.json() as { error?: string; hint?: string }
      if (!res.ok) throw new Error(body.error || res.statusText)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  const available = info?.state === 'update-available' || busy || Boolean(error)
  if (!available) return null

  const title = error
    || (busy ? '正在下载并重启…' : `有新版本 ${info?.latest ?? ''}，点击下载、更新并重启`)

  return React.createElement(
    'button',
    {
      type: 'button',
      className: error ? 'dvu-badge dvu-badge-err' : 'dvu-badge',
      title,
      disabled: busy,
      onClick: () => { void update() },
    },
    React.createElement('span', { className: 'dvu-dot' }, '●'),
    busy ? '更新中' : (error ? '更新失败' : '有更新'),
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
  tag.dataset.plugin = 'dsh-version-update'
  tag.textContent = `
.dvu-chrome { display:none; }
.dvu-badge { position:absolute; top:10px; left:30px; z-index:30; appearance:none; border:0; display:inline-flex; align-items:center; gap:4px; height:20px; padding:0 8px; border-radius:999px; background:var(--dsw-alias-state-error-primary, #e24); color:#fff; font:inherit; font-size:11px; line-height:20px; cursor:pointer; pointer-events:auto; box-shadow:0 0 0 2px var(--dsw-specific-sidebar-fill, #fff); }
.dvu-badge:disabled { opacity:.85; cursor:progress; }
.dvu-badge-err { background:var(--dsw-alias-label-tertiary, #888); }
.dvu-dot { font-size:8px; }
`
  document.head.appendChild(tag)
}
