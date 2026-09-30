import React from 'react'
import { createPortal } from 'react-dom'

type El = {
  textContent?: string
  getAttribute(name: string): string | null
  closest(selector: string): El | null
  querySelector(selector: string): El | null
  querySelectorAll(selector: string): ArrayLike<El & {
    textContent?: string
    click?: () => void
    setAttribute(name: string, value: string): void
    getBoundingClientRect?: () => { top: number; bottom: number; left: number; right: number; width: number }
    contains?: (node: unknown) => boolean
  }>
  appendChild(node: El): unknown
  setAttribute(name: string, value: string): void
  getBoundingClientRect?: () => { top: number; bottom: number; left: number; right: number; width: number }
  contains?: (node: unknown) => boolean
}

declare const document: {
  createElement(tag: string): El
  body: unknown
  addEventListener(type: string, listener: (event: { target?: unknown }) => void): void
  removeEventListener(type: string, listener: (event: { target?: unknown }) => void): void
}

declare const window: {
  innerWidth: number
  innerHeight: number
  addEventListener(type: string, listener: () => void, options?: boolean): void
  removeEventListener(type: string, listener: () => void, options?: boolean): void
}

declare class MutationObserver {
  constructor(callback: () => void)
  observe(target: unknown, options: { childList: boolean; subtree: boolean; attributes?: boolean; attributeFilter?: string[] }): void
  disconnect(): void
}

export function useWorkspaceToolHost(): {
  anchorRef: (el: El | null) => void
  host: El | null
  changesHost: El | null
} {
  const nodeRef = React.useRef<El | null>(null)
  const [host, setHost] = React.useState<El | null>(null)
  const [changesHost, setChangesHost] = React.useState<El | null>(null)
  const anchorRef = React.useCallback((el: El | null) => {
    nodeRef.current = el
  }, [])

  React.useLayoutEffect(() => {
    const header = nodeRef.current?.closest('header')
    if (!header) return
    const read = () => {
      const tabs = header.querySelector('[role="tablist"]')
      if (!tabs) {
        setHost(null)
        return
      }
      const items = tabs.querySelectorAll('[role="tab"]')
      for (let i = 0; i < items.length; i++) {
        const tab = items[i]
        const label = tab?.textContent?.trim() ?? ''
        const kind = /^(对话|Chat)$/.test(label) ? 'chat'
          : /^(文件|Files)$/.test(label) ? 'files'
          : /^(Changes|变更)/.test(label) ? 'changes'
          : /^(轨迹|Trace|Trajectory)$/.test(label) ? 'trace'
          : /^(终端|Terminal|运行|Run)$/.test(label) ? 'run' : 'other'
        if (tab?.getAttribute('data-dsh-nav') !== kind) tab?.setAttribute('data-dsh-nav', kind)
      }
      setChangesHost(tabs.querySelector('[data-dsh-nav="changes"]'))
      let bar = tabs.querySelector('[data-dsh-workspace-tools]')
      if (!bar) {
        bar = document.createElement('span')
        bar.setAttribute('data-dsh-workspace-tools', '')
        bar.setAttribute('class', 'dsh-ws-tools')
        tabs.appendChild(bar)
      }
      setHost(bar)
    }
    read()
    const observer = new MutationObserver(read)
    observer.observe(header, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return { anchorRef, host, changesHost }
}

export function renderOnTabRow(
  host: El | null,
  node: React.ReactElement,
  fallback: React.ReactElement,
): React.ReactElement {
  if (!host) return fallback
  return createPortal(node, host as never)
}

export function FloatingPanel(props: {
  open: boolean
  width: number
  anchor: El | null
  onClose: () => void
  children: React.ReactNode
}): React.ReactElement | null {
  const panelRef = React.useRef<El | null>(null)
  const [style, setStyle] = React.useState<Record<string, string | number>>({})

  React.useLayoutEffect(() => {
    if (!props.open || !props.anchor?.getBoundingClientRect) return
    const place = () => {
      const rect = props.anchor?.getBoundingClientRect?.()
      if (!rect) return
      const width = props.width
      const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8)
      const top = Math.min(rect.bottom + 6, window.innerHeight - 16)
      setStyle({
        position: 'fixed',
        top,
        left,
        width,
        zIndex: 10_000,
      })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [props.open, props.anchor, props.width])

  React.useEffect(() => {
    if (!props.open) return
    const onPointer = (event: { target?: unknown }) => {
      const target = event.target
      if (props.anchor?.contains?.(target) || panelRef.current?.contains?.(target)) return
      props.onClose()
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [props.open, props.anchor, props.onClose])

  if (!props.open) return null
  return createPortal(
    React.createElement(
      'div',
      { className: 'dgp-menu', role: 'dialog', ref: panelRef, style },
      props.children,
    ),
    document.body as never,
  )
}
