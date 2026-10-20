import React from 'react'
import { windowDriver, type WindowCarrier, type WindowDriver } from './window-driver.ts'
import type { PreferenceStore } from './state.ts'

const region = 'header[data-window-drag], div[data-window-drag]:has([data-slot="sidebar.brand.name"]), div[data-window-drag]:has(+ div[data-window-drag] [data-slot="sidebar.brand.name"])'
const interactive = 'button,a,input,textarea,select,summary,[role="button"],[role="tab"],[role="link"],[role="menuitem"],[role="checkbox"],[role="radio"],[role="switch"],[role="slider"],[role="combobox"],[role="textbox"],[contenteditable="true"],[data-moss-no-drag]'
/** Reuse the host header. Electron handles drag/double-click in its native region. */
export function installWindowRegions(doc: Document, driver: WindowDriver): () => void {
  const previous = doc.documentElement.getAttribute('data-moss-window-carrier')
  doc.documentElement.setAttribute('data-moss-window-carrier', driver.kind)
  const down = (event: MouseEvent) => {
    if (driver.kind !== 'tauri' || event.button !== 0 || !(event.target instanceof Element)) return
    if (!event.target.closest(region) || event.target.closest(interactive)) return
    event.preventDefault()
    void (event.detail === 2 ? driver.window.toggleMaximize() : driver.window.startDragging()).catch(error => console.warn('550W: window operation unavailable', error))
  }
  doc.addEventListener('mousedown', down)
  return () => {
    doc.removeEventListener('mousedown', down)
    if (previous === null) doc.documentElement.removeAttribute('data-moss-window-carrier')
    else doc.documentElement.setAttribute('data-moss-window-carrier', previous)
  }
}
export function WindowChrome({ preferences }: { preferences: PreferenceStore }): null {
  const settings = React.useSyncExternalStore(preferences.subscribe, preferences.getSnapshot)
  React.useEffect(() => {
    if (!settings.enabled) return
    return installWindowRegions(document, windowDriver(window as unknown as WindowCarrier))
  }, [settings.enabled])
  return null
}
