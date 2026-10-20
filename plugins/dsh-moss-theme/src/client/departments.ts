import React from 'react'
import { DepartmentIcon, type Department } from './department-art.ts'
import type { PreferenceStore } from './state.ts'

type Options = { name: string; id: string; order: number; priority?: number; label?: unknown; locale?: string; registrant?: string }
// The host stores locale/registrant beside options, not inside it.
type Entry = { options: Pick<Options, 'id' | 'order' | 'priority' | 'label'>; locale?: string; registrant?: string }
export type DepartmentSlots = {
  inject(name: string, register: () => () => void): () => void
  register(options: Options, render: (props: { size?: number }) => React.ReactElement): () => void
  entries?(name: string): readonly Entry[]
  subscribe?(name: string, listener: () => void): () => void
}
const owner = 'dsh-moss-theme/departments'
const panels: Record<string, Department> = { plugins: 'gabon', schedules: 'flight' }

/** Shadow just the glyphs of existing native panels. Their labels, order,
 * navigation and presence continue to belong to the host. */
export function installDepartmentIcons(slots: DepartmentSlots, preferences: PreferenceStore): () => void {
  if (!slots.entries || !slots.subscribe) return () => {}
  return slots.inject('sidebar.panellist', () => {
    const mounted = new Map<string, { source: Entry; dispose: () => void }>()
    let syncing = false
    const sync = () => {
      if (syncing) return
      syncing = true
      try {
        const originals = slots.entries!('sidebar.panellist').filter(entry => entry.registrant !== owner)
        for (const [id, name] of Object.entries(panels)) {
          const source = preferences.getSnapshot().enabled ? originals.find(entry => entry.options.id === id) : undefined
          if (mounted.get(id)?.source === source) continue
          mounted.get(id)?.dispose(); mounted.delete(id)
          if (!source) continue
          const { order, label } = source.options
          const { locale } = source
          const dispose = slots.register({ name: 'sidebar.panellist', id, order, label, locale, registrant: owner, priority: -200 },
            props => React.createElement(DepartmentIcon, { name, size: Math.max(18, props.size ?? 18) }))
          mounted.set(id, { source, dispose })
        }
      } finally { syncing = false }
    }
    const stopSlots = slots.subscribe!('sidebar.panellist', sync)
    const stopPreferences = preferences.subscribe(sync)
    sync()
    return () => { stopSlots(); stopPreferences(); for (const entry of mounted.values()) entry.dispose(); mounted.clear() }
  })
}
