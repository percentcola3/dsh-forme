import React from 'react'
import { createPortal } from 'react-dom'
import type { Context } from '@deepseek-ai/cordis'
import { createPreferences, MOSS_PRESET, MOSS_PROMPT, presetOf, sessionStatus, statusText, type MossStatus, type PreferenceStore, type SessionActivity, type SessionSnapshot, type SessionSummary } from './state.ts'
import { installStyles, installTheme } from './runtime.ts'
import { EarthScene, thrustFor } from './earth.ts'
import { RunningFlight } from './running.ts'
import { MossIcon } from './icons.ts'
import { BrandMark, SidebarBrand } from './brand.ts'
import { WindowChrome } from './chrome.ts'

// The gateway's namespaces are separate Cordis services: reading
// remote.agentPresets requires its own dependency as well as the gateway.
export const inject = ['slots', 'sessions', 'uiWorkspace', 'uiSession', 'remote', 'remote.agentPresets']
type Store<T> = { getSnapshot(): T; subscribe(listener: () => void): () => void }
type Reference = { ready: Promise<void>; binding: { session: Store<SessionSnapshot> }; release(): void }
type Services = {
  selection: Store<{ sessionId?: string }>
  activity?: Store<ReadonlyMap<string, SessionActivity>>
  sessions: {
    retain(id: string, options: { source: string }): Reference
    list?: Store<{ byId: Record<string, SessionSummary | undefined>; phase?: string }>
  }
  /** Opens a new session draft; `agentPreset` selects the MOSS composition. */
  startSession?(workspaceId: string | undefined, options: { clearPreviousDraft: boolean; agentPreset: string }): void
  /** Host roster, used only to tell whether the MOSS preset is installed. */
  listPresets?(): Promise<{ ok: boolean; value?: { presets: { id: string }[] } }>
}

/** Breadcrumb for the last activation step, so a host-side failure names itself. */
let step = 'start'
/** Survives the reload, so a failed boot can be diagnosed without a debugger. */
const BOOT_ERROR_KEY = 'dsh-moss-theme:boot-error'

export function apply(ctx: Context): void {
  try {
    activate(ctx)
    try { window.localStorage.removeItem(BOOT_ERROR_KEY) } catch { /* Restricted storage. */ }
  } catch (error) {
    // Keep the host bootable: one broken theme must not block the whole Web UI.
    console.error(`dsh-moss-theme: activation failed at "${step}"`, error)
    try {
      const reason = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error)
      window.localStorage.setItem(BOOT_ERROR_KEY, JSON.stringify({ at: new Date().toISOString(), step, reason }))
    } catch { /* Restricted storage. */ }
    try { installStyles() } catch { /* Nothing left to salvage. */ }
  }
}

function activate(ctx: Context): void {
  let storage: Storage | undefined
  try { storage = window.localStorage } catch { /* Restricted browser storage. */ }
  const preferences = createPreferences(storage)
  step = 'theme'
  ctx.effect(() => installTheme(preferences))
  step = 'slots'
  const slots = ctx.get('slots') as {
    inject(name: string, register: () => () => void): () => void
    register(options: { name: string; id: string; order: number; priority?: number }, render: () => React.ReactElement | null): () => void
  }
  step = 'services'
  const workspace = ctx.get('uiWorkspace') as { selection?: Services['selection']; startSession?: Services['startSession'] } | undefined
  // `ctx.get('remote')` returns a proxy that throws on property access until the
  // service is live, so the `.agentPresets` read itself stays inside the guard.
  let remote: { agentPresets?: { list(): ReturnType<NonNullable<Services['listPresets']>> } } | undefined
  try {
    const gateway = ctx.get('remote') as { agentPresets?: { list(): ReturnType<NonNullable<Services['listPresets']>> } } | undefined
    remote = gateway?.agentPresets ? gateway : undefined
  } catch { /* Older hosts without a ready remote gateway; the roster stays hidden. */ }
  const services: Services = {
    // A host without a workspace selection only loses the live status, not the theme.
    selection: workspace?.selection ?? idleSelection,
    sessions: ctx.get('sessions') as Services['sessions'],
    activity: (ctx.get('uiSession') as { sessionStatus?: Services['activity'] }).sessionStatus,
    ...typeof workspace?.startSession === 'function' ? { startSession: workspace.startSession.bind(workspace) } : {},
    ...remote?.agentPresets ? { listPresets: () => remote.agentPresets!.list() } : {},
  }
  step = 'header'
  ctx.effect(() => guard('window chrome slot', () => slots.inject('shell.overlay', () => slots.register(
    { name: 'shell.overlay', id: 'dsh-550w-window', order: 90 },
    () => React.createElement(WindowChrome, { preferences }),
  ))) ?? noop)
  // A slot this host version does not expose costs one surface, never the whole theme.
  ctx.effect(() => guard('header slot', () => slots.inject('conversation.header.leading', () => {
    step = 'header-mount'
    return slots.register(
      { name: 'conversation.header.leading', id: 'dsh-moss-theme', order: 90 },
      () => React.createElement(MossControl, { preferences, services }),
    )
  })) ?? noop)
  // Unregister the brand override when disabled so DSH's original mark returns.
  ctx.effect(() => {
    let stop: (() => void) | undefined
    const sync = () => {
      step = 'brand'
      if (preferences.getSnapshot().enabled && !stop) {
        const disposers = [
          ['conversation.hero.brand.mark', () => React.createElement(EarthHero, { services })],
          ['sidebar.brand.mark', () => React.createElement(BrandMark)],
          ['sidebar.brand.name', () => React.createElement(SidebarBrand)],
        ] as const
        const registered = disposers.map(([name, render]) => guard(name, () => slots.inject(name, () => slots.register(
          { name, id: `dsh-550w-${name}`, order: 0, priority: -200 }, render,
        ))))
        stop = () => { for (const dispose of registered.reverse()) dispose?.() }
      }
      else if (!preferences.getSnapshot().enabled && stop) { stop(); stop = undefined }
    }
    sync()
    const unsubscribe = preferences.subscribe(sync)
    return () => { unsubscribe(); stop?.() }
  })
  step = 'active'
}

/** Runs one optional surface, reporting instead of failing activation. */
function guard<T>(label: string, run: () => T): T | undefined {
  try {
    return run()
  } catch (error) {
    console.error(`dsh-moss-theme: ${label} unavailable`, error)
    return undefined
  }
}

const noop = (): void => {}

/** Stand-in selection for hosts that expose no `uiWorkspace`; nothing is ever selected. */
const idleSnapshot = {}
const idleSelection: Store<{ sessionId?: string }> = {
  getSnapshot: () => idleSnapshot,
  subscribe: () => () => {},
}

function EarthHero({ services }: { services: Services }): React.ReactElement {
  const status = useStatus(services)
  const h = React.createElement
  return h('span', { className: 'moss-hero' },
    h('span', { className: 'moss-hero-stage' },
      h(EarthScene, { status, scene: 'hero' }),
    ),
    h('span', { className: 'moss-hero-subtitle' }, '带着地球，继续前进 · THE WANDERING EARTH'),
  )
}

/** Whether the selected session runs the MOSS agent preset, and how to switch to it. */
function useIdentity(services: Services): { active: boolean; available: boolean; connect(): void } {
  const { selection, sessions } = services
  const selected = React.useSyncExternalStore(selection.subscribe.bind(selection), selection.getSnapshot.bind(selection))
  const catalog = sessions.list
  const preset = React.useSyncExternalStore(
    React.useCallback((listener: () => void) => catalog?.subscribe(listener) ?? (() => {}), [catalog]),
    React.useCallback(() => selected.sessionId ? presetOf(catalog?.getSnapshot().byId[selected.sessionId]) : undefined, [catalog, selected.sessionId]),
  )
  const available = useRoster(services)
  const connect = React.useCallback(() => {
    services.startSession?.(undefined, { clearPreviousDraft: false, agentPreset: MOSS_PRESET })
  }, [services])
  return { active: preset === MOSS_PRESET, available, connect }
}

let roster: Promise<boolean> | undefined
function useRoster(services: Services): boolean {
  const [available, setAvailable] = React.useState(false)
  React.useEffect(() => {
    if (!services.listPresets) return
    let live = true
    roster ??= services.listPresets().then(result => !!result.ok && !!result.value?.presets.some(preset => preset.id === MOSS_PRESET)).catch(() => false)
    void roster.then(value => { if (live) setAvailable(value) })
    return () => { live = false }
  }, [services])
  return available
}

function useStatus({ selection, sessions, activity }: Services): MossStatus {
  const selected = React.useSyncExternalStore(selection.subscribe.bind(selection), selection.getSnapshot.bind(selection))
  const id = selected.sessionId
  const taskActivity = React.useSyncExternalStore(
    React.useCallback((listener: () => void) => activity?.subscribe(listener) ?? noop, [activity]),
    React.useCallback(() => id ? activity?.getSnapshot().get(id) : undefined, [activity, id]),
  )
  // Restored navigation can arrive before the controller's first catalog.
  // Wait for discovery rather than retaining an unknown id once and staying offline.
  const catalog = sessions.list
  const known = React.useSyncExternalStore(
    React.useCallback((listener: () => void) => catalog?.subscribe(listener) ?? (() => {}), [catalog]),
    React.useCallback(() => !catalog || !id || !!catalog.getSnapshot().byId[id], [catalog, id]),
  )
  const [state, setState] = React.useState<{ id?: string; snapshot?: SessionSnapshot; failed?: boolean }>({})
  React.useEffect(() => {
    if (!id || !known) return
    let live = true
    let reference: Reference | undefined
    let unsubscribe: (() => void) | undefined
    try {
      reference = sessions.retain(id, { source: 'mossThemeStatus' })
      const session = reference.binding.session
      const read = () => { if (live) setState({ id, snapshot: session.getSnapshot() }) }
      unsubscribe = session.subscribe(read)
      read()
      void reference.ready.then(read).catch(() => { if (live) setState({ id, failed: true }) })
    } catch { setState({ id, failed: true }) }
    return () => { live = false; unsubscribe?.(); reference?.release() }
  }, [id, known, sessions])
  if (!known) return 'connecting'
  return sessionStatus(id, state.id === id ? state.snapshot : undefined, state.id === id && state.failed, taskActivity)
}

function Eye({ status }: { status: MossStatus }): React.ReactElement {
  return React.createElement('span', { className: 'moss-eye', 'data-status': status, 'aria-hidden': true })
}

function MossControl({ preferences, services }: { preferences: PreferenceStore; services: Services }): React.ReactElement {
  const h = React.createElement
  const settings = React.useSyncExternalStore(preferences.subscribe, preferences.getSnapshot)
  const status = useStatus(services)
  const identity = useIdentity(services)
  const text = statusText[status]
  const [open, setOpen] = React.useState(false)
  const [copied, setCopied] = React.useState('')
  const trigger = React.useRef<HTMLButtonElement>(null)
  const panel = React.useRef<HTMLDivElement>(null)
  const panelId = React.useId()
  const close = React.useCallback(() => { setOpen(false); trigger.current?.focus() }, [])
  React.useEffect(() => {
    if (!open) return
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close() } }
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer) }
  }, [open, close])
  const copy = async () => {
    try { await navigator.clipboard.writeText(MOSS_PROMPT); setCopied('已复制，粘贴到对话中发送。') }
    catch { setCopied('无法访问剪贴板，请手动选择复制。') }
  }
  const setting = (key: keyof typeof settings, label: string, hint: string) => h('label', { className: 'moss-setting', key },
    h('span', null, label, h('small', null, hint)),
    h('input', { type: 'checkbox', role: 'switch', checked: settings[key], onChange: (event: React.ChangeEvent<HTMLInputElement>) => preferences.update({ [key]: event.target.checked }) }),
  )
  const segments = Math.round(thrustFor[status] * 12)
  return h(React.Fragment, null,
    h('button', { ref: trigger, type: 'button', className: 'moss-trigger', 'data-status': status, title: settings.enabled ? `550W · ${text.label}` : '550W · 主题已关闭', 'aria-label': '550W 控制台', 'aria-haspopup': 'dialog', 'aria-expanded': open, 'aria-controls': open ? panelId : undefined, onClick: () => setOpen(value => !value) },
      h(Eye, { status }), h('span', { className: 'moss-wordmark' }, h(BrandMark)),
      h('span', { className: 'moss-trigger-state', role: 'status', 'aria-live': 'polite', 'aria-atomic': true }, text.label)),
    createPortal(h('div', { 'data-moss-atmosphere': '', 'aria-hidden': true }), document.body),
    h(RunningFlight, { enabled: settings.enabled }),
    open ? createPortal(h('div', { ref: panel, id: panelId, className: 'moss-console', role: 'dialog', 'aria-label': '550W 控制台' },
      h('div', { className: 'moss-console-head' },
        h(Eye, { status }),
        h('div', { className: 'moss-console-id' }, h('strong', null, h(BrandMark)), h('small', null, identity.active ? '智能量子计算机 · 当前会话已接入' : '智能量子计算机 · 当前会话未接入')),
        h('button', { type: 'button', className: 'moss-close', 'aria-label': '关闭 550W 控制台', onClick: close }, h(MossIcon, { name: 'close' }))),
      h('div', { className: 'moss-monitor' },
        h(EarthScene, { status, scene: 'console' }),
        h('div', { className: 'moss-hud', 'aria-hidden': true },
          h('span', { className: 'tl' }, 'NAV / 地球航行'),
          h('span', { className: 'tr' }, text.code),
          h('span', { className: 'br' }, '视觉示意 · 非遥测')),
      ),
      h('div', { className: 'moss-status', 'data-status': status },
        h('span', { className: 'moss-status-label', role: 'status' }, text.label),
        h('span', { className: 'moss-status-message' }, text.message),
        h('code', null, text.code)),
      h('div', { className: 'moss-thrust', 'aria-hidden': true },
        h('span', null, '发动机'),
        h('span', { className: 'moss-thrust-bar' }, ...Array.from({ length: 12 }, (_, i) => h('i', { key: i, 'data-on': String(i < segments) }))),
        h('span', null, `${Math.round(thrustFor[status] * 100)}%`)),
      h('div', { className: 'moss-section-label' }, h(MossIcon, { name: 'connect' }), 'AGENT / 身份'),
      h('div', { className: 'moss-identity', 'data-active': String(identity.active) },
        h('span', null,
          identity.active ? '550W 在线' : identity.available ? '550W 待接入' : '550W 预设未安装',
          h('small', null, identity.active
            ? '当前会话使用 550W 预设：标准编码工具 + 550W 人设。'
            : identity.available
              ? '新建一个使用 550W 预设的会话。现有会话保持原预设。'
              : '重新安装 dsh-moss-theme 并重启 DSH 后可用；也可使用下方的对话风格指令。')),
        identity.available && !identity.active && services.startSession
          ? h('button', { type: 'button', className: 'moss-connect', onClick: () => { identity.connect(); setOpen(false) } }, h(MossIcon, { name: 'connect' }), '接入 550W')
          : null),
      h('div', { className: 'moss-section-label' }, h(MossIcon, { name: 'terminal' }), 'INTERFACE / 界面'),
      h('div', { className: 'moss-preferences' },
        setting('enabled', '流浪地球主题', '深蓝灰终端 · 红色强调'),
        setting('ambient', '环境纹理', '仪表网格与冷光反射'),
        setting('motion', '界面动效', '地球航行、状态灯、文字显现')),
      h('details', { className: 'moss-persona' },
        h('summary', null, '对话风格指令', h('small', null, '用于未接入 550W 的会话')),
        h('p', null, '复制后自行发送到当前对话。仅影响表达风格，不更换预设或工具。'),
        h('textarea', { readOnly: true, value: MOSS_PROMPT, 'aria-label': '550W 对话风格指令' }),
        h('div', { className: 'moss-persona-actions' },
          h('button', { className: 'moss-copy', type: 'button', onClick: () => { void copy() } }, h(MossIcon, { name: 'copy' }), '复制指令'),
          h('p', { role: 'status' }, copied))),
      h('blockquote', { className: 'moss-quote' }, '“让人类永远保持理智，确实是一种奢求。”', h('cite', null, '— 550W · 流浪地球')),
      h('div', { className: 'moss-footnote' }, h('span', null, 'THE WANDERING EARTH'), h('span', null, 'DSH · 非官方致敬')),
    ), document.body) : null,
  )
}
