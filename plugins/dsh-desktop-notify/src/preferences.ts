export const positions = ['left', 'right', 'top', 'island'] as const
export type Position = typeof positions[number]
export type Preferences = { enabled: boolean; completion: boolean; decisions: boolean; sound: boolean; position: Position; display: 'main' | 'pointer'; duration: number }
export const defaults: Preferences = { enabled: true, completion: true, decisions: true, sound: false, position: 'right', display: 'main', duration: 5 }
export function parsePreferences(value: unknown): Preferences {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    enabled: typeof data.enabled === 'boolean' ? data.enabled : defaults.enabled,
    completion: typeof data.completion === 'boolean' ? data.completion : defaults.completion,
    decisions: typeof data.decisions === 'boolean' ? data.decisions : defaults.decisions,
    sound: typeof data.sound === 'boolean' ? data.sound : defaults.sound,
    position: positions.includes(data.position as Position) ? data.position as Position : defaults.position,
    display: data.display === 'pointer' ? 'pointer' : 'main',
    duration: typeof data.duration === 'number' && Number.isFinite(data.duration) ? Math.min(30, Math.max(3, Math.round(data.duration))) : defaults.duration,
  }
}
