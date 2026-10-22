export type Preferences = { enabled: boolean; ambient: boolean; motion: boolean }
export const STORAGE_KEY = 'dsh-moss-theme:v1'
export const defaults: Preferences = { enabled: true, ambient: true, motion: true }

export function parsePreferences(value: string | null): Preferences {
  try {
    const data = JSON.parse(value ?? '{}')
    if (!data || typeof data !== 'object') return { ...defaults }
    return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) =>
      [key, typeof data[key] === 'boolean' ? data[key] : fallback])) as Preferences
  } catch { return { ...defaults } }
}

export function createPreferences(storage?: Pick<Storage, 'getItem' | 'setItem'>) {
  let current: Preferences
  try { current = parsePreferences(storage?.getItem(STORAGE_KEY) ?? null) }
  catch { current = { ...defaults } }
  const listeners = new Set<() => void>()
  const replace = (next: Preferences) => {
    if (Object.keys(defaults).every(key => current[key as keyof Preferences] === next[key as keyof Preferences])) return
    current = next
    for (const listener of listeners) listener()
  }
  return {
    getSnapshot: () => current,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    update(patch: Partial<Preferences>) {
      replace({ ...current, ...patch })
      try { storage?.setItem(STORAGE_KEY, JSON.stringify(current)) } catch { /* Still usable in private windows. */ }
    },
    receive(value: string | null) { replace(parsePreferences(value)) },
  }
}
export type PreferenceStore = ReturnType<typeof createPreferences>

export type SessionSnapshot = {
  running?: boolean; awaitingFirstTurn?: boolean; lastAgentError?: unknown
  promptError?: unknown; openError?: unknown; openState?: string; removed?: boolean
}
/** Published by the host's uiSession.sessionStatus store, including approvals/questions. */
export type SessionActivity = { running?: boolean; pendingInteraction?: unknown }
export type MossStatus = 'standby' | 'connecting' | 'working' | 'waiting' | 'error' | 'offline'
export function sessionStatus(sessionId?: string, snapshot?: SessionSnapshot, failed = false, activity?: SessionActivity): MossStatus {
  if (!sessionId) return 'standby'
  if (failed || snapshot?.removed) return 'offline'
  if (snapshot?.lastAgentError || snapshot?.promptError || snapshot?.openError || snapshot?.openState === 'error') return 'error'
  if (activity?.pendingInteraction != null) return 'waiting'
  if (snapshot?.running || snapshot?.awaitingFirstTurn || activity?.running) return 'working'
  if (!snapshot || ['cold', 'loading', 'opening'].includes(snapshot.openState ?? '')) return 'connecting'
  return 'standby'
}
export const statusText: Record<MossStatus, { label: string; code: string; message: string }> = {
  standby: { label: '待命', code: 'STANDBY', message: '550W 已就绪。请输入指令。' },
  connecting: { label: '建立连接', code: 'CONNECTING', message: '正在同步当前任务，请稍候。' },
  working: { label: '处理中', code: 'PROCESSING', message: '指令处理中。请以对话中的实际输出为准。' },
  waiting: { label: '等待确认', code: 'AWAITING INPUT', message: '任务正在等待你的审批或回答，请查看对话中的请求。' },
  error: { label: '需要检查', code: 'ATTENTION', message: '任务出现异常。请检查对话中的错误信息。' },
  offline: { label: '会话不可用', code: 'UNAVAILABLE', message: '当前会话暂不可用。请选择或重新打开任务。' },
}

/** Agent preset id declared by this package's cordis.patch.yml. */
export const MOSS_PRESET = 'moss'
export type SessionSummary = { projectionValues?: { agentPreset?: unknown } }
/** The preset a session records, read from the host's session catalog. */
export function presetOf(summary?: SessionSummary): string | undefined {
  const value = summary?.projectionValues?.agentPreset
  return typeof value === 'string' ? value : undefined
}

/**
 * Mission clock from the host's localized running label ("用时 2分41秒", "for 2m 41s").
 * The host emits hours, minutes, seconds in that order, so the last three integers suffice.
 */
export function missionClock(label: string): string {
  const parts = (label.match(/\d+/g) ?? []).map(Number).slice(-3)
  while (parts.length < 3) parts.unshift(0)
  const [hours, minutes, seconds] = parts
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours ? `T+${hours}:${pad(minutes)}:${pad(seconds)}` : `T+${pad(minutes)}:${pad(seconds)}`
}
