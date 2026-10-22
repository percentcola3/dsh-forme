export const positions = ['top-left', 'top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left'] as const
export type Position = typeof positions[number]
export type Preferences = { enabled: boolean; completion: boolean; decisions: boolean; sound: boolean; position: Position; display: 'main' | 'pointer'; duration: number }
export const defaults: Preferences = { enabled: true, completion: true, decisions: true, sound: false, position: 'right', display: 'main', duration: 4 }
/** Earlier releases offered left/right/top/island; map them onto the closest border anchor. */
const legacy: Record<string, Position> = { island: 'top' }
export function parsePreferences(value: unknown): Preferences {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const stored = typeof data.position === 'string' ? data.position : ''
  const position = (positions as readonly string[]).includes(stored) ? stored as Position : legacy[stored] ?? defaults.position
  return {
    enabled: typeof data.enabled === 'boolean' ? data.enabled : defaults.enabled,
    completion: typeof data.completion === 'boolean' ? data.completion : defaults.completion,
    decisions: typeof data.decisions === 'boolean' ? data.decisions : defaults.decisions,
    sound: typeof data.sound === 'boolean' ? data.sound : defaults.sound,
    position,
    display: data.display === 'pointer' ? 'pointer' : 'main',
    duration: typeof data.duration === 'number' && Number.isFinite(data.duration) ? Math.min(30, Math.max(3, Math.round(data.duration))) : defaults.duration,
  }
}
