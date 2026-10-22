export type OfficialTab = { id: string; kind: string; contentId: string }
export type OfficialSidebar = {
  openTab(kind: string): void
  commandTarget(element?: Element | null): unknown
  openTabFromTarget(kind: string, target: unknown): void
  active(): OfficialTab | undefined
  float(tabId: string, rect?: { x: number; y: number; width: number; height: number }): void
  dock(paneId: string): void
  focus(tabId: string): void
  isExpanded(): boolean
  toggleExpanded(): void
  closeIn(sessionId: string, tabId: string): void
  openTabs: { getSnapshot(): { sessionId: string; tabId: string }[]; subscribe(fn: () => void): () => void }
  tabDomain: { occurrence(sessionId: string, tab: { id: string }): { navigation: { getSnapshot(): { address: string; params?: { terminalId?: string; shellPath?: string } } } } }
}
export type OfficialTerminals = {
  view(sessionId: string, key: string, contentId: string, terminalId?: string, shellPath?: string): {
    state: { getSnapshot(): { writable: boolean } }
    write(data: string): void
  }
}

/** Use the same target resolution and launch path as DSH's terminal shortcut. */
export function openOfficialTerminal(sidebar: OfficialSidebar, element?: Element | null): OfficialTab {
  const target = sidebar.commandTarget(element)
  if (target) sidebar.openTabFromTarget('terminal', target)
  else sidebar.openTab('terminal')
  const tab = sidebar.active()
  if (!tab || tab.kind !== 'terminal') throw new Error('官方终端尚未就绪，请稍后重试。')
  return tab
}

/** A card owns one real official floating tab, never a second terminal renderer. */
export function createOfficialTerminalCard(sidebar: OfficialSidebar, terminals: OfficialTerminals, sessionId: string, rect?: { x: number; y: number; width: number; height: number }) {
  const expanded = sidebar.isExpanded()
  // A new card must own its own tab, rather than replacing a user's existing tab.
  sidebar.openTab('terminal')
  const tab = sidebar.active()
  if (!tab || tab.kind !== 'terminal') throw new Error('官方终端尚未就绪，请稍后重试。')
  try {
    sidebar.float(tab.id, rect)
    if (!expanded && sidebar.isExpanded()) sidebar.toggleExpanded()
  } catch (error) {
    sidebar.closeIn(sessionId, tab.id)
    throw error
  }
  let closed = false
  return {
    tabId: tab.id,
    exists: () => sidebar.openTabs.getSnapshot().some(item => item.sessionId === sessionId && item.tabId === tab.id),
    interrupt() {
      if (closed) return
      const navigation = sidebar.tabDomain.occurrence(sessionId, { id: tab.id }).navigation.getSnapshot()
      const view = terminals.view(sessionId, tab.id, navigation.address, navigation.params?.terminalId, navigation.params?.shellPath)
      if (!view.state.getSnapshot().writable) throw new Error('终端尚未连接或当前不可输入。')
      view.write('\x03')
    },
    expand(paneId: string) {
      if (closed) return
      sidebar.dock(paneId)
      // Ownership transfers before card unmount; cleanup must not close this tab.
      closed = true
      if (!sidebar.isExpanded()) sidebar.toggleExpanded()
      sidebar.focus(tab.id)
    },
    release() { closed = true },
    close() { if (!closed) { closed = true; sidebar.closeIn(sessionId, tab.id) } },
  }
}
