/** Only expose native controls actually provided by the current carrier. */
export type NativeWindow = {
  minimize(): Promise<void>
  toggleMaximize(): Promise<void>
  isMaximized(): Promise<boolean>
  startDragging(): Promise<void>
  onResized?(listener: () => void): Promise<() => void>
}
export type WindowCarrier = {
  dshDesktop?: unknown
  __TAURI__?: { window?: { getCurrentWindow?(): NativeWindow } }
}
export type WindowDriver = { kind: 'tauri'; window: NativeWindow } | { kind: 'electron' | 'browser' }
export function windowDriver(carrier: WindowCarrier): WindowDriver {
  try {
    const native = carrier.__TAURI__?.window?.getCurrentWindow?.()
    if (native && ['minimize', 'toggleMaximize', 'isMaximized', 'startDragging'].every(key => typeof native[key as keyof NativeWindow] === 'function')) return { kind: 'tauri', window: native }
  } catch { /* An unavailable native bridge must not prevent the theme from activating. */ }
  return { kind: carrier.dshDesktop ? 'electron' : 'browser' }
}
