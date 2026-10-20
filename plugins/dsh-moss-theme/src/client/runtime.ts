import { STORAGE_KEY, type PreferenceStore } from './state.ts'
import { themeCSS } from './styles.ts'
import { earthCSS } from './earth-styles.ts'

function installFonts(style: HTMLStyleElement): () => void {
  let active = true
  void import('./font-assets.ts').then(({ fontCSS }) => {
    if (active) style.textContent = fontCSS + themeCSS + earthCSS
  }).catch(() => { /* System fonts remain usable if decoding is unavailable. */ })
  return () => { active = false }
}

/**
 * Last resort when activation fails part-way: the palette alone, no service wiring.
 * Keeps the interface usable instead of leaving the host's stock look half restyled.
 */
export function installStyles(doc: Document = document): void {
  if (!doc.body || !doc.head) return
  const style = doc.createElement('style')
  style.dataset.plugin = 'dsh-moss-theme'
  style.textContent = themeCSS + earthCSS
  doc.head.appendChild(style)
  doc.body.setAttribute('data-moss-theme', 'on')
  doc.body.setAttribute('data-moss-ambient', 'on')
  doc.body.setAttribute('data-moss-motion', 'on')
}

// Own only our attributes and stylesheet. The built-in theme preference stays intact.
export function installTheme(store: PreferenceStore, doc: Document = document, win: Window = window): () => void {
  // Client plugins can activate before <body> exists; wait for it instead of throwing.
  if (!doc.body) {
    let cancel = () => {}
    const once = () => { cancel = installTheme(store, doc, win) }
    doc.addEventListener('DOMContentLoaded', once, { once: true })
    cancel = () => doc.removeEventListener('DOMContentLoaded', once)
    return () => cancel()
  }
  const body = doc.body
  const attributes = ['data-moss-theme', 'data-moss-ambient', 'data-moss-motion']
  const previous = attributes.map(key => body.getAttribute(key))
  const style = doc.createElement('style')
  style.dataset.plugin = 'dsh-moss-theme'
  style.textContent = themeCSS + earthCSS
  doc.head.appendChild(style)
  const sync = () => {
    const value = store.getSnapshot()
    body.setAttribute('data-moss-theme', value.enabled ? 'on' : 'off')
    body.setAttribute('data-moss-ambient', value.ambient ? 'on' : 'off')
    body.setAttribute('data-moss-motion', value.motion ? 'on' : 'off')
  }
  sync()
  const stopFonts = installFonts(style)
  const unsubscribe = store.subscribe(sync)
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) store.receive(event.key === null ? null : event.newValue)
  }
  win.addEventListener('storage', onStorage)
  return () => {
    stopFonts()
    unsubscribe()
    win.removeEventListener('storage', onStorage)
    style.remove()
    attributes.forEach((key, i) => {
      if (previous[i] === null) body.removeAttribute(key)
      else body.setAttribute(key, previous[i]!)
    })
  }
}
