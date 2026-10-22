import type { Department } from './department-art.ts'

export const WORKSPACE_ICONS = ['ueg', 'engine', 'station', 'moon', 'relay', 'quantum', 'elevator', 'rescue'] as const satisfies readonly Department[]
export type WorkspaceIcon = typeof WORKSPACE_ICONS[number]
export const WORKSPACE_ICONS_KEY = 'dsh-moss-theme:workspace-icons:v1'
const selector = '[role="treeitem"][data-row-key^="workspace:"]'
const attribute = 'data-moss-workspace-icon'
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function isIcon(value: unknown): value is WorkspaceIcon {
  return WORKSPACE_ICONS.includes(value as WorkspaceIcon)
}
function hash(key: string): number {
  let value = 2166136261
  for (const letter of key) value = Math.imul(value ^ letter.codePointAt(0)!, 16777619)
  return value >>> 0
}

/** Assign by workspace identity, never by the current row order or title. Persisted
 * allocations survive renames and restarts; unused motifs are preferred for new projects. */
export function createWorkspaceIcons(storage?: StorageLike) {
  const assigned = new Map<string, WorkspaceIcon>()
  try {
    const saved: unknown = JSON.parse(storage?.getItem(WORKSPACE_ICONS_KEY) ?? '{}')
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      for (const [key, value] of Object.entries(saved)) if (key.startsWith('workspace:') && isIcon(value)) assigned.set(key, value)
    }
  } catch { /* A denied or corrupt cache must not affect navigation. */ }
  return (keys: Iterable<string>): ReadonlyMap<string, WorkspaceIcon> => {
    let changed = false
    for (const key of [...new Set(keys)].filter(key => key.startsWith('workspace:')).sort()) {
      if (assigned.has(key)) continue
      const counts = WORKSPACE_ICONS.map(icon => [...assigned.values()].filter(value => value === icon).length)
      const least = Math.min(...counts)
      const start = hash(key) % WORKSPACE_ICONS.length
      for (let offset = 0; offset < WORKSPACE_ICONS.length; offset++) {
        const index = (start + offset) % WORKSPACE_ICONS.length
        if (counts[index] !== least) continue
        assigned.set(key, WORKSPACE_ICONS[index]); changed = true; break
      }
    }
    if (changed) {
      try { storage?.setItem(WORKSPACE_ICONS_KEY, JSON.stringify(Object.fromEntries(assigned))) } catch { /* Keep the in-memory assignment. */ }
    }
    return assigned
  }
}

/** The host exposes no workspace-folder glyph slot. Decorate only its stable row
 * attribute; leave the folder, expansion chevron, hit targets and accessible name intact. */
export function installWorkspaceIcons(storage?: StorageLike, doc: Document = document): () => void {
  if (!doc.body) {
    let stop = () => {}
    const ready = () => { stop = installWorkspaceIcons(storage, doc) }
    doc.addEventListener('DOMContentLoaded', ready, { once: true })
    return () => { doc.removeEventListener('DOMContentLoaded', ready); stop() }
  }
  const Observer = doc.defaultView?.MutationObserver
  if (!Observer) return () => {}
  const assign = createWorkspaceIcons(storage)
  const decorated = new Map<Element, string | null>()
  const sync = () => {
    const rows = [...doc.querySelectorAll(selector)]
    const live = new Set(rows)
    for (const [row, previous] of decorated) {
      if (live.has(row)) continue
      if (previous === null) row.removeAttribute(attribute)
      else row.setAttribute(attribute, previous)
      decorated.delete(row)
    }
    const icons = assign(rows.map(row => row.getAttribute('data-row-key')!))
    for (const row of rows) {
      if (!decorated.has(row)) decorated.set(row, row.getAttribute(attribute))
      const icon = icons.get(row.getAttribute('data-row-key')!)!
      if (row.getAttribute(attribute) !== icon) row.setAttribute(attribute, icon)
    }
  }
  const containsRow = (node: Node) => node.nodeType === 1 && ((node as Element).matches(selector) || !!(node as Element).querySelector(selector))
  // Rows only change with the sidebar; skip text/streaming churn cheaply and
  // coalesce real changes into one pass per frame.
  let frame = 0
  const raf = doc.defaultView?.requestAnimationFrame?.bind(doc.defaultView)
  const schedule = () => { if (!raf) return sync(); if (!frame) frame = raf(() => { frame = 0; sync() }) }
  const observer = new Observer(records => {
    if (frame) return
    for (const record of records) {
      if (record.type === 'attributes') return schedule()
      for (const node of record.addedNodes) if (containsRow(node)) return schedule()
      for (const node of record.removedNodes) if (node.nodeType === 1 && decorated.size && [...decorated.keys()].some(row => node === row || node.contains(row))) return schedule()
    }
  })
  // Exclude our own attribute so decoration never triggers a feedback loop.
  observer.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-row-key'] })
  sync()
  return () => {
    observer.disconnect()
    if (frame) doc.defaultView?.cancelAnimationFrame?.(frame)
    for (const [row, previous] of decorated) {
      if (previous === null) row.removeAttribute(attribute)
      else row.setAttribute(attribute, previous)
    }
    decorated.clear()
  }
}
