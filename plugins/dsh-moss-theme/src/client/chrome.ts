import React from 'react'
import { BrandMark } from './brand.ts'
import { MossIcon } from './icons.ts'
import { windowDriver, type WindowCarrier } from './window-driver.ts'
import type { PreferenceStore } from './state.ts'

export function WindowChrome({ preferences }: { preferences: PreferenceStore }): React.ReactElement | null {
  const settings = React.useSyncExternalStore(preferences.subscribe, preferences.getSnapshot)
  const [driver] = React.useState(() => windowDriver(window as unknown as WindowCarrier))
  const [maximized, setMaximized] = React.useState(false)
  const [fullscreen, setFullscreen] = React.useState(false)
  const [error, setError] = React.useState('')
  const h = React.createElement
  React.useEffect(() => {
    if (driver.kind !== 'tauri') return
    let live = true
    let stop: (() => void) | undefined
    const read = () => { void driver.window.isMaximized().then(value => { if (live) setMaximized(value) }).catch(() => {}) }
    read()
    void driver.window.onResized?.(read).then(unsubscribe => { if (live) stop = unsubscribe; else unsubscribe() }).catch(() => {})
    return () => { live = false; stop?.() }
  }, [driver])
  React.useEffect(() => {
    const read = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', read)
    return () => document.removeEventListener('fullscreenchange', read)
  }, [])
  const run = async (action: () => Promise<unknown>) => {
    try { await action(); setError('') }
    catch { setError('窗口操作不可用，请使用系统窗口按钮。') }
  }
  const zoom = () => driver.kind === 'tauri'
    ? run(async () => { await driver.window.toggleMaximize(); setMaximized(await driver.window.isMaximized()) })
    : run(() => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())
  if (!settings.enabled) return null
  return h('div', { className: 'moss-titlebar', 'data-window-drag': '', 'data-carrier': driver.kind, 'aria-label': '550W 窗口栏',
    onMouseDown: (event: React.MouseEvent) => {
      if (driver.kind !== 'tauri' || event.button !== 0 || (event.target as Element).closest('button')) return
      event.preventDefault()
      if (event.detail === 2) void zoom()
      else void run(() => driver.window.startDragging())
    },
  },
    h('div', { className: 'moss-titlebar-brand' }, h(BrandMark), h('span', null, 'INTELLIGENT QUANTUM COMPUTER')),
    h('span', { className: 'moss-titlebar-center', 'aria-hidden': true }, '550W / 领航员终端'),
    error && h('span', { className: 'moss-titlebar-error', role: 'status' }, error),
    driver.kind === 'tauri' ? h('div', { className: 'moss-window-actions' },
      h('button', { type: 'button', 'aria-label': '最小化窗口', title: '最小化', onClick: () => { void run(() => driver.window.minimize()) } }, h(MossIcon, { name: 'minimize' })),
      h('button', { type: 'button', 'aria-label': maximized ? '还原窗口' : '最大化窗口', title: maximized ? '还原' : '最大化', onClick: () => { void zoom() } }, h(MossIcon, { name: maximized ? 'restore' : 'maximize' })))
      : driver.kind === 'browser' && typeof document.documentElement.requestFullscreen === 'function' ? h('div', { className: 'moss-window-actions' },
        h('button', { type: 'button', 'aria-label': fullscreen ? '退出全屏' : '全屏显示', title: fullscreen ? '退出全屏' : '浏览器全屏', onClick: () => { void zoom() } }, h(MossIcon, { name: fullscreen ? 'restore' : 'maximize' }))) : null)
}
