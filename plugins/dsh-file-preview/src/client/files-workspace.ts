type Placement = { paneId?: string; replaceTab?: string; revealIfOpened?: boolean; [key: string]: unknown }
export type Sidebar = {
  openTabIn(sessionId: string, kind: string, options?: Placement): void
  openResource(address: string, options?: Placement): void
  openResourceIn(sessionId: string, address: string, options?: Placement): void
  split(paneId?: string): string | undefined
  isExpanded(): boolean
  toggleExpanded(): void
  active(): { id: string } | undefined
  focus(tabId: string): void
}
export type Layout = { openRightbar(track: boolean, fullscreen: boolean): void; closeRightbar(): void }

/** Official components stay in their React-owned dock; only their viewport changes. */
export function installFilesWorkspace(sidebar: Sidebar, layout: Layout, currentSession: () => string | undefined) {
  const originalOpen = sidebar.openResource
  const originalOpenIn = sidebar.openResourceIn
  const originalPresentation = layout.openRightbar
  let leave: (() => void) | undefined
  let active: { session: string; route: (address: string, options?: Placement) => void } | undefined
  const wrappedOpen: Sidebar['openResource'] = (address, options) => {
    if (active && currentSession() === active.session && address.startsWith('dsh-resource://file/')) active.route(address, options)
    else originalOpen.call(sidebar, address, options)
  }
  const wrappedOpenIn: Sidebar['openResourceIn'] = (session, address, options) => {
    if (active?.session === session && currentSession() === session && address.startsWith('dsh-resource://file/')) active.route(address, options)
    else originalOpenIn.call(sidebar, session, address, options)
  }
  sidebar.openResource = wrappedOpen
  sidebar.openResourceIn = wrappedOpenIn

  return {
    mount(host: HTMLElement, session = currentSession()): () => void {
      leave?.()
      if (!session) return () => {}
      const wasExpanded = sidebar.isExpanded()
      const previousTab = sidebar.active()?.id
      let presentation: [boolean, boolean] = [true, false]
      let stopped = false
      let pending: { address: string; options?: Placement } | undefined
      let splitPending = false
      let timer: ReturnType<typeof setTimeout> | undefined
      let frame: number | undefined
      let ready = false
      let selectedPath: string | undefined
      const scroller = host.closest('[data-conversation-scroll]')
      const composer = scroller?.querySelector<HTMLElement>('[data-composer-seat]')
      const marked = new Set<HTMLElement>()
      const panel = () => document.querySelector<HTMLElement>('[data-sidebar-right-panel]')
      const mark = (el: HTMLElement, name: string, value = '') => {
        if (el.getAttribute(name) !== value) el.setAttribute(name, value)
        marked.add(el)
      }
      const presentationOverride: Layout['openRightbar'] = (track, fullscreen) => {
        presentation = [track, fullscreen]
        // The conversation owns the space; the dock must not reserve another column.
        layout.closeRightbar()
      }
      layout.openRightbar = presentationOverride
      layout.closeRightbar()

      const sync = () => {
        if (stopped || currentSession() !== session) return
        const dock = panel()
        if (!dock) return
        const rect = host.getBoundingClientRect()
        mark(dock, 'data-dfp-embedded')
        const card = composer?.querySelector<HTMLElement>('[data-composer-card]') ?? composer
        const composerRect = card?.getBoundingClientRect()
        const bottom = composerRect && composerRect.height > 0
          ? Math.min(rect.top + rect.height, composerRect.top - 8)
          : rect.top + rect.height
        const values = { left: rect.left, top: rect.top, width: rect.width, height: Math.max(0, bottom - rect.top) }
        for (const [key, value] of Object.entries(values)) {
          const property = `--dfp-${key}`
          if (dock.style.getPropertyValue(property) !== `${value}px`) dock.style.setProperty(property, `${value}px`)
        }
        const panes = Array.from(dock.querySelectorAll<HTMLElement>('[data-dockkit-pane]'))
        const tree = panes[0]
        if (!tree) return
        mark(tree, 'data-dfp-tree')
        const preview = panes[1]
        if (!preview) {
          // Retry after DockSurface has measured the bounded viewport.
          if (!splitPending) splitPending = !!sidebar.split(tree.dataset.dockkitPane)
          return
        }
        splitPending = false
        ready = true
        clearTimeout(timer)
        mark(preview, 'data-dfp-preview')
        // split() may seed Files, Guide or another registered default. Hide only
        // the Files/Guide placeholder until a real document replaces that tab.
        const seed = !!preview.querySelector('[data-files-state], [data-sidebar-right-guide-entry]')
        mark(preview, 'data-dfp-empty', String(seed))
        if (pending) {
          const request = pending
          pending = undefined
          const tab = preview.querySelector<HTMLElement>('[data-dockkit-tab][aria-selected="true"]')?.dataset.dockkitTab
          originalOpenIn.call(sidebar, session, request.address, {
            ...request.options, paneId: preview.dataset.dockkitPane,
            replaceTab: tab, revealIfOpened: false,
          })
        }
        for (const row of tree.querySelectorAll<HTMLElement>('[data-files-entry="file"]')) {
          const button = row.querySelector('button')
          if (button) {
            const selected = String(row.dataset.filesPath === selectedPath)
            if (button.getAttribute('aria-current') !== selected) button.setAttribute('aria-current', selected)
          }
        }
      }
      active = { session, route(address, options) {
        pending = { address, options }
        // Resolve official workspace-relative addresses against the tree root.
        const prefix = `dsh-resource://file/session/${encodeURIComponent(session)}`
        try {
          const path = decodeURIComponent(new URL(address).pathname.slice(new URL(prefix).pathname.length + 1))
          const root = panel()?.querySelector<HTMLElement>('[data-files-root]')?.dataset.filesRoot
          selectedPath = path.startsWith('/') ? path : root ? `${root.replace(/\/$/, '')}/${path}` : undefined
        } catch { selectedPath = undefined }
        sync()
      } }
      const firstPane = panel()?.querySelector<HTMLElement>('[data-dockkit-pane]')
      if (firstPane?.querySelector('[data-files-state]')) {
        if (!sidebar.isExpanded()) sidebar.toggleExpanded()
      } else {
        sidebar.openTabIn(session, 'files', { paneId: firstPane?.dataset.dockkitPane, revealIfOpened: false })
      }
      // Coalesce preview mutations/highlighting into one update per frame.
      const schedule = () => {
        if (stopped || frame !== undefined) return
        frame = requestAnimationFrame(() => { frame = undefined; sync() })
      }
      const onScroll = (event: Event) => {
        // Internal file/code scrolling does not move our viewport.
        const target = event.target
        if (target === document || (target instanceof Element && target.contains(host))) schedule()
      }
      const resize = new ResizeObserver(schedule)
      resize.observe(host)
      if (composer) resize.observe(composer)
      const observer = new MutationObserver(schedule)
      const dock = panel()
      if (dock) observer.observe(dock, { childList: true, subtree: true })
      window.addEventListener('resize', schedule)
      window.addEventListener('scroll', onScroll, true)
      let attempts = 0
      const retry = () => {
        sync()
        if (!stopped && !ready && ++attempts < 20) timer = setTimeout(retry, 80)
      }
      retry()
      const cleanup = () => {
        if (stopped) return
        stopped = true
        active = undefined
        clearTimeout(timer)
        resize.disconnect()
        observer.disconnect()
        if (frame !== undefined) cancelAnimationFrame(frame)
        window.removeEventListener('resize', schedule)
        window.removeEventListener('scroll', onScroll, true)
        for (const el of marked) {
          for (const attr of ['data-dfp-embedded', 'data-dfp-tree', 'data-dfp-preview', 'data-dfp-empty']) el.removeAttribute(attr)
          for (const key of ['left', 'top', 'width', 'height']) el.style.removeProperty(`--dfp-${key}`)
        }
        if (layout.openRightbar === presentationOverride) layout.openRightbar = originalPresentation
        if (currentSession() === session) {
          if (previousTab) sidebar.focus(previousTab)
          if (sidebar.isExpanded() !== wasExpanded) sidebar.toggleExpanded()
          if (wasExpanded) originalPresentation.call(layout, ...presentation)
          else layout.closeRightbar()
        }
        if (leave === cleanup) leave = undefined
      }
      leave = cleanup
      return cleanup
    },
    dispose() {
      leave?.()
      if (sidebar.openResource === wrappedOpen) sidebar.openResource = originalOpen
      if (sidebar.openResourceIn === wrappedOpenIn) sidebar.openResourceIn = originalOpenIn
    },
  }
}
