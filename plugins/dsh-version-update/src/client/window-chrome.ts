import React from 'react'

type AppWindow = {
  startDragging?: () => Promise<unknown>
  toggleMaximize?: () => Promise<unknown>
  isMaximized?: () => Promise<boolean>
  maximize?: () => Promise<unknown>
  unmaximize?: () => Promise<unknown>
}

type Pointer = {
  button: number
  detail: number
  clientX: number
  clientY: number
  target?: { closest?: (selector: string) => unknown }
  preventDefault(): void
  stopPropagation(): void
}

type El = {
  dataset: { dshZoom?: string }
  style: Record<string, string>
  cloneNode(deep: boolean): El
  replaceWith(node: El): void
  addEventListener(type: string, listener: (event: Pointer) => void): void
}

declare const window: {
  __TAURI__?: { window?: { getCurrentWindow?: () => AppWindow } }
}

declare const document: {
  getElementById(id: string): El | null
  addEventListener(type: string, listener: (event: Pointer) => void, options?: boolean): void
  removeEventListener(type: string, listener: (event: Pointer) => void, options?: boolean): void
  body: unknown
}

declare class MutationObserver {
  constructor(callback: () => void)
  observe(target: unknown, options: { childList: boolean; subtree: boolean }): void
  disconnect(): void
}

const TOP_HIT_PX = 40
const TRAFFIC_LIGHTS_PX = 80
const INTERACTIVE = 'button, a, input, textarea, select, [role="tab"], [role="menuitem"], [contenteditable="true"]'

function currentWindow(): AppWindow | null {
  return window.__TAURI__?.window?.getCurrentWindow?.() ?? null
}

function zoomToFill(appWindow: AppWindow): void {
  if (appWindow.toggleMaximize) {
    void appWindow.toggleMaximize()
    return
  }
  void appWindow.isMaximized?.().then((maximized) => {
    if (maximized) void appWindow.unmaximize?.()
    else void appWindow.maximize?.()
  })
}

function retargetTopDom(appWindow: AppWindow): void {
  const el = document.getElementById('pake-top-dom')
  if (!el || el.dataset.dshZoom === '1') return
  const next = el.cloneNode(true)
  next.dataset.dshZoom = '1'
  next.style.left = `${TRAFFIC_LIGHTS_PX}px`
  next.style.width = `calc(100% - ${TRAFFIC_LIGHTS_PX}px)`
  next.style.height = `${TOP_HIT_PX}px`
  next.style.zIndex = '20'
  next.style.cursor = 'default'
  el.replaceWith(next)
  next.addEventListener('mousedown', (event) => {
    if (event.button !== 0 || event.detail === 2) return
    void appWindow.startDragging?.()
  })
}

function enableTitlebarZoom(): () => void {
  const appWindow = currentWindow()
  if (!appWindow) return () => {}

  const onPageDblClick = (event: Pointer) => {
    if (event.clientY > TOP_HIT_PX || event.clientX < TRAFFIC_LIGHTS_PX) return
    if (event.target?.closest?.(INTERACTIVE)) return
    event.preventDefault()
    // Own this gesture in capture phase; the titlebar must not toggle again.
    event.stopPropagation()
    zoomToFill(appWindow)
  }

  retargetTopDom(appWindow)
  const observer = new MutationObserver(() => { retargetTopDom(appWindow) })
  observer.observe(document.body, { childList: true, subtree: true })
  document.addEventListener('dblclick', onPageDblClick, true)
  return () => {
    observer.disconnect()
    document.removeEventListener('dblclick', onPageDblClick, true)
  }
}

export function WindowChrome(): React.ReactElement {
  React.useEffect(() => enableTitlebarZoom(), [])
  return React.createElement('span', { className: 'dvu-chrome', 'aria-hidden': true })
}
