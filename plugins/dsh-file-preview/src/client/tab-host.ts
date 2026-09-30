import React from 'react'
import { createPortal } from 'react-dom'

type El = {
  closest(selector: string): El | null
  querySelector(selector: string): El | null
  querySelectorAll(selector: string): ArrayLike<El>
  textContent?: string
  click(): void
  appendChild(node: El): unknown
  setAttribute(name: string, value: string): void
  getAttribute(name: string): string | null
}

declare const document: {
  createElement(tag: string): El
}

declare class MutationObserver {
  constructor(callback: () => void)
  observe(target: unknown, options: { childList: boolean; subtree: boolean; attributes?: boolean; attributeFilter?: string[] }): void
  disconnect(): void
}

export function useWorkspaceToolHost(): {
  anchorRef: (el: El | null) => void
  host: El | null
} {
  const nodeRef = React.useRef<El | null>(null)
  const [host, setHost] = React.useState<El | null>(null)
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

  return { anchorRef, host }
}

export function renderOnTabRow(
  host: El | null,
  node: React.ReactElement,
  fallback: React.ReactElement,
): React.ReactElement {
  if (!host) return fallback
  return createPortal(node, host as never)
}
