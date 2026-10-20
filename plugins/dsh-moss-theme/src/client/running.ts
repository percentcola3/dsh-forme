import React from 'react'
import { createPortal } from 'react-dom'
import { missionClock } from './state.ts'
import { EarthScene } from './earth.ts'

const h = React.createElement
/** The host's live "deep diving" row; a stable data attribute, not a hashed class. */
const HOST = '[data-chat-running]'
let owner: symbol | undefined

/**
 * Replaces the visible content of the host running row with the flight strip.
 * The host keeps its element, timer, and screen-reader status; only its visible
 * children are hidden, and only while the strip is actually attached.
 */
export function RunningFlight({ enabled }: { enabled: boolean }): React.ReactElement | null {
  const [id] = React.useState(() => Symbol('moss-running'))
  const [claimed, setClaimed] = React.useState(false)
  React.useEffect(() => {
    // Several conversation headers may mount; one strip per host row.
    if (owner === undefined) { owner = id; setClaimed(true) }
    return () => { if (owner === id) owner = undefined }
  }, [id])
  const host = useHost(enabled && claimed)
  const container = React.useMemo(() => {
    if (!host) return undefined
    const element = document.createElement('span')
    element.className = 'moss-run-host'
    return element
  }, [host])
  React.useLayoutEffect(() => {
    if (!host || !container) return
    host.appendChild(container)
    host.setAttribute('data-moss-run', '')
    return () => { container.remove(); host.removeAttribute('data-moss-run') }
  }, [host, container])
  return host && container ? createPortal(h(Strip, { host }), container) : null
}

function useHost(active: boolean): HTMLElement | undefined {
  const [host, setHost] = React.useState<HTMLElement>()
  React.useEffect(() => {
    if (!active) { setHost(undefined); return }
    let frame = 0
    const scan = () => { frame = 0; setHost(document.querySelector<HTMLElement>(HOST) ?? undefined) }
    // Coalesce streaming DOM churn into at most one lookup per frame.
    const observer = new MutationObserver(() => { if (!frame) frame = requestAnimationFrame(scan) })
    observer.observe(document.body, { childList: true, subtree: true })
    scan()
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [active])
  return host
}

function hostLabel(host: HTMLElement): string {
  let text = ''
  host.childNodes.forEach(node => {
    if (!(node instanceof Element && node.classList.contains('moss-run-host'))) text += node.textContent ?? ''
  })
  return text
}

function Strip({ host }: { host: HTMLElement }): React.ReactElement {
  const [clock, setClock] = React.useState(() => missionClock(hostLabel(host)))
  React.useEffect(() => {
    const read = () => setClock(missionClock(hostLabel(host)))
    const timer = setInterval(read, 500)
    read()
    return () => clearInterval(timer)
  }, [host])
  return h('span', { className: 'moss-run', 'aria-hidden': true },
    h(EarthScene, { status: 'working', scene: 'loading' }),
    h('span', { className: 'moss-run-time' }, clock))
}
