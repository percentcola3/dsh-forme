/** The host's account menu has no item slot yet. Extend only the menu owned by
 * its account trigger, keeping the native account and sign-out actions intact. */
export function installAccountMenu(doc: Document, open: () => void): () => void {
  let entry: HTMLButtonElement | undefined
  let menu: HTMLElement | undefined
  let trigger: HTMLButtonElement | null = null
  const sync = () => {
    trigger = doc.querySelector<HTMLButtonElement>('button[data-signed-out][aria-haspopup="menu"][aria-expanded="true"]')
    const controlled = trigger?.getAttribute('aria-controls')
    const next = trigger ? (controlled ? doc.getElementById(controlled) : doc.querySelector<HTMLElement>('[role="menu"]')) : null
    if (entry?.isConnected && menu === next) return
    entry?.remove(); entry = undefined; menu = undefined
    const template = next?.querySelector<HTMLElement>('[role="menuitem"]')
    if (!next || !template) return
    menu = next
    entry = doc.createElement('button')
    entry.type = 'button'
    entry.className = `${template.className} dn-account-entry`
    entry.setAttribute('role', 'menuitem')
    entry.setAttribute('tabindex', '-1')
    entry.setAttribute('data-desktop-notify-entry', '')
    entry.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 10a7 7 0 0 1 14 0v5l2 3H3l2-3zM9 21h6M12 1v2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>桌面提醒</span>'
    entry.addEventListener('click', event => {
      event.stopPropagation()
      const account = trigger
      account?.click()
      account?.focus()
      open()
    })
    // Insert after Settings, before Feedback and Sign out.
    const row = template.parentElement === next ? template : template.parentElement!
    row.after(entry)
  }
  const keydown = (event: KeyboardEvent) => {
    if (!menu || !entry || !menu.contains(event.target as Node)) return
    const items = [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')].filter(item => !item.hasAttribute('disabled') && item.getAttribute('aria-disabled') !== 'true')
    const index = items.indexOf(doc.activeElement as HTMLElement)
    let next: number
    if (event.key === 'ArrowDown') next = (index + 1) % items.length
    else if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    else if (event.target === entry && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault(); event.stopPropagation(); entry.click(); return
    } else return
    event.preventDefault(); event.stopPropagation(); items[next]?.focus()
  }
  const observer = new MutationObserver(sync)
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-expanded'] })
  doc.addEventListener('keydown', keydown, true)
  sync()
  return () => { observer.disconnect(); doc.removeEventListener('keydown', keydown, true); entry?.remove() }
}
