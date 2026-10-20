/** Add only our portal seat. The host keeps ownership of its chat/composer tree. */
export function installTaskDock(root: HTMLElement, onSeat: (seat: HTMLElement | null) => void): () => void {
  const seat = root.ownerDocument.createElement('div')
  seat.className = 'dqp-dock-seat'
  let content: HTMLElement | undefined
  let previousLayout: string | null = null
  let publishedLayout: string | undefined
  let frame: number | undefined
  let stopped = false
  const measure = () => {
    if (!content) return
    const next = content.clientWidth >= 820 ? 'columns' : 'stacked'
    if (content.getAttribute('data-dqp-layout') !== next) content.setAttribute('data-dqp-layout', next)
    publishedLayout = next
  }
  const resize = new ResizeObserver(measure)
  const release = () => {
    resize.disconnect()
    if (content && content.getAttribute('data-dqp-layout') === publishedLayout) {
      if (previousLayout === null) content.removeAttribute('data-dqp-layout')
      else content.setAttribute('data-dqp-layout', previousLayout)
    }
    seat.remove()
    content = undefined
    publishedLayout = undefined
  }
  const sync = () => {
    frame = undefined
    if (stopped) return
    const candidates = Array.from(root.querySelectorAll<HTMLElement>('[data-conversation-content]'))
      .filter(node => !node.closest('[data-sidebar-right-panel],[data-sidebar-chat],[hidden],[aria-hidden="true"]') && node.getClientRects().length > 0)
    const next = candidates.find(node => node.closest('[data-slot="main.conversation"]')) ?? candidates[0]
    if (next === content && seat.parentElement === content) { measure(); return }
    release()
    if (!next) { onSeat(null); return }
    content = next
    previousLayout = content.getAttribute('data-dqp-layout')
    content.appendChild(seat)
    resize.observe(content)
    measure()
    onSeat(seat)
  }
  const schedule = () => { if (!stopped && frame === undefined) frame = requestAnimationFrame(sync) }
  const mutations = new MutationObserver(schedule)
  mutations.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-hidden', 'data-conversation-session', 'class'] })
  sync()
  return () => {
    stopped = true
    mutations.disconnect()
    if (frame !== undefined) cancelAnimationFrame(frame)
    release()
  }
}
