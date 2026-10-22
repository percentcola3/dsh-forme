type Store<T> = { getSnapshot(): T; subscribe(fn: () => void): () => void }
type Summary = { blank?: boolean; cwd?: string; updatedAt?: number }
type Workspace = { workspaceId: string; path: string; sessionIds: string[]; createdAt?: string }
type StartOptions = { prompt?: unknown; clearPreviousDraft?: boolean; agentPreset?: unknown }
export type DraftNavigation = {
  selection: Store<{ sessionId?: string }>
  startSession(workspaceId?: string, options?: StartOptions): void
  openWorkspace(workspaceId: string, beforeOpen?: unknown, options?: StartOptions): Promise<unknown>
  openSession(sessionId: string): void
}
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>
const LAST = 'dsh-forme.draft-session.v1.'

/** Reopen the original blank Session: never copy text over another composer. */
export function installDraftNavigation(navigation: DraftNavigation,
  sessions: { list: Store<{ phase?: string; ids: string[]; byId: Record<string, Summary | undefined> }> },
  workspaces: { list: Store<{ phase?: string; items: Workspace[]; archivedSessionIds: string[] }> },
  storage: Storage) {
  const read = (key: string) => { try { return storage.getItem(key) } catch { return null } }
  const remember = () => {
    const id = navigation.selection.getSnapshot().sessionId
    if (!id || !sessions.list.getSnapshot().byId[id]?.blank) return
    const workspace = workspaces.list.getSnapshot().items.find(item => item.sessionIds.includes(id))
    if (workspace) try { storage.setItem(LAST + workspace.workspaceId, id) } catch { /* storage may be unavailable */ }
  }
  const candidate = (workspaceId?: string) => {
    const catalog = sessions.list.getSnapshot()
    const groups = workspaces.list.getSnapshot()
    if (catalog.phase !== 'ready' || groups.phase !== 'ready') return
    const current = navigation.selection.getSnapshot().sessionId
    const recent = [...groups.items].sort((a, b) => {
      const time = (w: Workspace) => Math.max(Date.parse(w.createdAt ?? '') || 0, ...w.sessionIds.map(id => catalog.byId[id]?.updatedAt ?? 0))
      return time(b) - time(a)
    })[0]
    const target = workspaceId ?? groups.items.find(item => current && item.sessionIds.includes(current))?.workspaceId ?? recent?.workspaceId
    const workspace = groups.items.find(item => item.workspaceId === target)
    if (!workspace) return
    const preferred = read(LAST + workspace.workspaceId)
    const ids = [...new Set([current, preferred, ...catalog.ids])]
    return ids.find((id): id is string => {
      if (!id || !workspace.sessionIds.includes(id) || groups.archivedSessionIds.includes(id)) return false
      const summary = catalog.byId[id]
      if (!summary?.blank || summary.cwd !== workspace.path) return false
      try {
        const saved = JSON.parse(read('dsh.conversation.' + id) ?? 'null')
        const text = typeof saved?.draft === 'string' ? saved.draft : saved?.draft?.text
        return typeof text === 'string' && text.trim().length > 0
      } catch { return false }
    })
  }
  const ownStart = Object.getOwnPropertyDescriptor(navigation, 'startSession')
  const ownOpen = Object.getOwnPropertyDescriptor(navigation, 'openWorkspace')
  // Cordis wraps methods in a fresh tracing proxy on each property access.
  // Read descriptors so call receivers and unload restoration remain correct.
  const method = (name: string): Function => {
    let object: object | null = navigation
    while (object) {
      const value = Object.getOwnPropertyDescriptor(object, name)?.value
      if (typeof value === 'function') return value
      object = Object.getPrototypeOf(object)
    }
    throw new Error(`Workspace navigation method unavailable: ${name}`)
  }
  const originalStart = method('startSession')
  const originalOpen = method('openWorkspace')
  const mayRestore = (options?: StartOptions) => options?.prompt === undefined && options?.clearPreviousDraft !== true && options?.agentPreset === undefined
  const start: DraftNavigation['startSession'] = function (this: DraftNavigation, workspaceId, options) {
    const id = mayRestore(options) ? candidate(workspaceId) : undefined
    if (id) { navigation.openSession(id); return }
    return originalStart.call(this, workspaceId, options)
  }
  const open: DraftNavigation['openWorkspace'] = function (this: DraftNavigation, workspaceId, beforeOpen, options) {
    const id = beforeOpen === undefined && mayRestore(options) ? candidate(workspaceId) : undefined
    if (id) { navigation.openSession(id); return Promise.resolve() }
    return originalOpen.call(this, workspaceId, beforeOpen, options)
  }
  Object.defineProperty(navigation, 'startSession', { configurable: true, writable: true, value: start })
  Object.defineProperty(navigation, 'openWorkspace', { configurable: true, writable: true, value: open })
  remember()
  const stop = navigation.selection.subscribe(remember)
  return () => {
    stop()
    const restore = (name: string, wrapper: Function, descriptor?: PropertyDescriptor) => {
      if (Object.getOwnPropertyDescriptor(navigation, name)?.value !== wrapper) return
      if (descriptor) Object.defineProperty(navigation, name, descriptor)
      else Reflect.deleteProperty(navigation, name)
    }
    restore('startSession', start, ownStart)
    restore('openWorkspace', open, ownOpen)
  }
}
