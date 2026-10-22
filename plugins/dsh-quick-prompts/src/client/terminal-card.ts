import React from 'react'
import type { Context } from '@deepseek-ai/cordis'
import { createOfficialTerminalCard, type OfficialSidebar, type OfficialTerminals } from '../../../dsh-terminal/src/client/official-terminal.ts'

/** Only a seat: DSH keeps ownership of the floating pane, renderer and PTY. */
export function TerminalCard({ ctx, sessionId, active = true, sourceSelected = true, onClose }: { ctx: Context; sessionId: string; active?: boolean; sourceSelected?: boolean; onClose: () => void }): React.ReactElement {
  const host = React.useRef<HTMLDivElement>(null)
  const lease = React.useRef<ReturnType<typeof createOfficialTerminalCard> | null>(null)
  const expandRef = React.useRef<(() => void) | null>(null)
  const activeRef = React.useRef(active && sourceSelected)
  activeRef.current = active && sourceSelected
  const scheduleRef = React.useRef<(() => void) | null>(null)
  React.useLayoutEffect(() => { scheduleRef.current?.() }, [active, sourceSelected])
  const closeRef = React.useRef(onClose)
  closeRef.current = onClose
  const [error, setError] = React.useState('')
  const [connected, setConnected] = React.useState(false)
  React.useEffect(() => {
    const seat = host.current
    if (!seat) return
    const sidebar = ctx.get('sidebarRight') as OfficialSidebar
    let owner: ReturnType<typeof createOfficialTerminalCard> | undefined
    let stopped = false
    let frame: number | undefined
    let pane: HTMLElement | undefined
    const releasePane = () => {
      pane?.removeAttribute('data-dqp-official-terminal')
      for (const key of ['left', 'top', 'width', 'height', 'clip', 'visibility']) pane?.style.removeProperty(`--dqp-terminal-${key}`)
    }
    expandRef.current = () => {
      const paneId = pane?.dataset.dockkitFloat
      if (!owner || !paneId) throw new Error('终端小窗尚未就绪，请稍后重试。')
      owner.expand(paneId)
      releasePane()
      closeRef.current()
    }
    const sync = () => {
      frame = undefined
      if (stopped) return
      if (!activeRef.current) { pane?.style.setProperty('--dqp-terminal-visibility', 'hidden'); return }
      // openTab acts on the foreground session, so never create under another
      // project during a navigation/effect race. The original PTY stays owned.
      const navigation = ctx.get('uiWorkspace') as { selection: { getSnapshot(): { sessionId?: string } } }
      if (navigation.selection.getSnapshot().sessionId !== sessionId) return
      if (!owner) {
        try {
          const rect = seat.getBoundingClientRect()
          owner = createOfficialTerminalCard(sidebar, ctx.get('webTerminals') as OfficialTerminals, sessionId, { x: rect.left, y: rect.top, width: Math.max(1, rect.width), height: Math.max(1, rect.height) })
          lease.current = owner
        } catch (error) { setError(error instanceof Error ? error.message : String(error)); return }
      }
      if (!owner.exists()) { closeRef.current(); return }
      const body = Array.from(document.querySelectorAll<HTMLElement>('div[data-sidebar-right-tab]'))
        .find(node => node.dataset.sidebarRightTab === owner!.tabId && node.closest('[data-sidebar-right-session]')?.getAttribute('data-sidebar-right-session') === sessionId)
      const next = body?.closest<HTMLElement>('[data-dockkit-float]') ?? undefined
      if (!next) {
        // The native "dock" action transfers ownership back to the sidebar.
        if (pane && body?.closest('[data-dockkit-pane]')) { owner.release(); closeRef.current() }
        return
      }
      if (pane !== next) { releasePane(); pane = next }
      pane.setAttribute('data-dqp-official-terminal', '')
      const rect = seat.getBoundingClientRect()
      const viewport = seat.closest('.dqp-dock-body')?.getBoundingClientRect()
      const top = Math.max(0, (viewport?.top ?? 0) - rect.top, -rect.top)
      const bottom = Math.max(0, rect.bottom - (viewport?.bottom ?? innerHeight), rect.bottom - innerHeight)
      const left = Math.max(0, (viewport?.left ?? 0) - rect.left, -rect.left)
      const right = Math.max(0, rect.right - (viewport?.right ?? innerWidth), rect.right - innerWidth)
      const values = { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, clip: `inset(${top}px ${right}px ${bottom}px ${left}px)`, visibility: rect.width > 0 && rect.height > 0 && top + bottom < rect.height ? 'visible' : 'hidden' }
      for (const [key, value] of Object.entries(values)) {
        if (pane.style.getPropertyValue(`--dqp-terminal-${key}`) !== value) pane.style.setProperty(`--dqp-terminal-${key}`, value)
      }
      setConnected(true)
    }
    const schedule = () => { if (!stopped && frame === undefined) frame = requestAnimationFrame(sync) }
    scheduleRef.current = schedule
    // Composer keystrokes and terminal output mutate the DOM constantly; only
    // structural changes outside the borrowed pane can move or detach it.
    const mutations = new MutationObserver(records => {
      if (!activeRef.current) return
      if (!pane?.isConnected) return schedule()
      if (records.some(record => !pane!.contains(record.target) && !seat.contains(record.target) && !(record.target as Element).closest?.('[data-composer-seat]'))) schedule()
    })
    mutations.observe(document.body, { childList: true, subtree: true })
    const resize = new ResizeObserver(schedule)
    resize.observe(seat)
    const unsubscribe = sidebar.openTabs.subscribe(schedule)
    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    sync()
    return () => {
      stopped = true
      scheduleRef.current = null
      if (frame !== undefined) cancelAnimationFrame(frame)
      mutations.disconnect(); resize.disconnect(); unsubscribe()
      window.removeEventListener('scroll', schedule, true); window.removeEventListener('resize', schedule)
      releasePane(); owner?.close(); lease.current = null; expandRef.current = null
    }
  }, [ctx, sessionId])
  const interrupt = () => {
    try { lease.current?.interrupt(); setError('') }
    catch (error) { setError(error instanceof Error ? error.message : String(error)) }
  }
  const expand = () => {
    try { expandRef.current?.(); setError('') }
    catch (error) { setError(error instanceof Error ? error.message : String(error)) }
  }
  const returnToSource = () => {
    try { (ctx.get('uiWorkspace') as { openSession(id: string): void }).openSession(sessionId) }
    catch (error) { setError(error instanceof Error ? error.message : String(error)) }
  }
  const body = sourceSelected ? connected ? null : '正在打开官方终端…' : React.createElement('div', { className: 'dqp-terminal-return' }, React.createElement('p', null, '终端保留在本项目的原会话中。'), React.createElement('button', { type: 'button', onClick: returnToSource }, '返回原终端'))
  return React.createElement('section', { className: 'dqp-terminal-card', 'aria-label': '官方项目终端' },
    React.createElement('div', { className: 'dqp-terminal-overlay' },
      React.createElement('button', { type: 'button', disabled: !connected || !sourceSelected, title: '在官方侧边栏展开此终端', 'aria-label': '放大终端到侧边栏', onClick: expand }, '放大'),
      React.createElement('button', { type: 'button', disabled: !connected, title: '发送 Ctrl+C', onClick: interrupt }, '中断'),
      React.createElement('button', { type: 'button', title: '结束终端并关闭卡片', 'aria-label': '关闭终端', onClick: onClose }, '×')),
    React.createElement('div', { className: 'dqp-terminal-body', ref: host }, body),
    error ? React.createElement('p', { className: 'dqp-terminal-error', role: 'alert' }, error) : null)
}
