import React from 'react'
import { createPortal } from 'react-dom'
import type { Context } from '@deepseek-ai/cordis'
import { EngineIndicator } from './engine.ts'
import { createPreferences, sessionStatus, type MossStatus, type PreferenceStore, type SessionActivity, type SessionSnapshot, type SessionSummary } from './state.ts'
import { installStyles, installTheme } from './runtime.ts'
import { EarthScene } from './earth.ts'
import { RunningFlight } from './running.ts'
import { BrandMark, SidebarBrand } from './brand.ts'
import { WindowChrome } from './chrome.ts'
import { installDepartmentIcons, type DepartmentSlots } from './departments.ts'
import { installWorkspaceIcons } from './workspace-icons.ts'
import { installModelSourceMenu, type ModelMenuSlots, type ModelDirectories } from './model-menu.ts'

export const inject = ['slots', 'sessions', 'uiWorkspace', 'uiSession', 'remote', 'remote.session', 'modelDirectories']
type Store<T> = { getSnapshot(): T; subscribe(listener: () => void): () => void }
type Reference = { ready: Promise<void>; binding: { session: Store<SessionSnapshot> }; release(): void }
type Services = {
  selection: Store<{ sessionId?: string }>
  activity?: Store<ReadonlyMap<string, SessionActivity>>
  sessions: {
    retain(id: string, options: { source: string }): Reference
    list?: Store<{ byId: Record<string, SessionSummary | undefined>; phase?: string }>
  }

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
  const workspace = ctx.get('uiWorkspace') as { selection?: Services['selection'] } | undefined
  const services: Services = {
    // A host without a workspace selection only loses the live status, not the theme.
    selection: workspace?.selection ?? idleSelection,
    sessions: ctx.get('sessions') as Services['sessions'],
    activity: (ctx.get('uiSession') as { sessionStatus?: Services['activity'] }).sessionStatus,
  }
  step = 'header'
  ctx.effect(() => guard('header window behavior', () => slots.inject('shell.overlay', () => slots.register(
    { name: 'shell.overlay', id: 'dsh-550w-window', order: 90 },
    () => React.createElement(WindowChrome, { preferences }),
  ))) ?? noop)
  // A slot this host version does not expose costs one surface, never the whole theme.
  ctx.effect(() => guard('header slot', () => slots.inject('conversation.header.leading', () => {
    step = 'header-mount'
    return slots.register(
      { name: 'conversation.header.leading', id: 'dsh-moss-theme', order: 90 },
      () => React.createElement(MossSurface, { preferences, services }),
    )
  })) ?? noop)
  ctx.effect(() => guard('general settings', () => slots.inject('settings.general.item', () => slots.register(
    { name: 'settings.general.item', id: 'dsh-550w-settings', order: 75 },
    () => React.createElement(ThemeSettings, { preferences }),
  ))) ?? noop)
  ctx.effect(() => guard('department icons', () => installDepartmentIcons(slots as DepartmentSlots, preferences)) ?? noop)
  ctx.effect(() => guard('workspace icons', () => installWorkspaceIcons(storage)) ?? noop)
  ctx.inject(['modelDirectories', 'sessions', 'remote', 'remote.session'], scope => scope.effect(() => guard('model source menu', () => installModelSourceMenu(
    scope.get('slots') as ModelMenuSlots,
    scope.get('modelDirectories') as ModelDirectories,
    scope.get('sessions') as { subagentAddress(id: string): unknown },
  )) ?? noop))
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
  // Mark the host's sibling once instead of a document-wide `span:has()` rule,
  // which the browser re-evaluates on every DOM change (including typing).
  const ref = React.useRef<HTMLSpanElement>(null)
  React.useLayoutEffect(() => {
    const sibling = ref.current?.parentElement?.nextElementSibling
    if (!sibling || sibling.tagName !== 'SPAN') return
    sibling.setAttribute('data-moss-hero-sibling', '')
    return () => sibling.removeAttribute('data-moss-hero-sibling')
  }, [])
  return h('span', { className: 'moss-hero', ref },
    h('span', { className: 'moss-hero-stage' },
      h(EarthScene, { status, scene: 'hero' }),
    ),
    h('span', { className: 'moss-hero-subtitle' }, '带着地球，继续前进 · THE WANDERING EARTH'),
  )
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

/** A passive live indicator: no control panel, menu or extra wordmark. */
export function StatusLight({ status }: { status: MossStatus }): React.ReactElement {
  return React.createElement(EngineIndicator, { status })
}
function MossSurface({ preferences, services }: { preferences: PreferenceStore; services: Services }): React.ReactElement {
  const settings = React.useSyncExternalStore(preferences.subscribe, preferences.getSnapshot)
  const status = useStatus(services)
  return React.createElement(React.Fragment, null,
    React.createElement(StatusLight, { status }),
    createPortal(React.createElement('div', { 'data-moss-atmosphere': '', 'aria-hidden': true }), document.getElementById('root') ?? document.body),
    React.createElement(RunningFlight, { enabled: settings.enabled }))
}
function ThemeSettings({ preferences }: { preferences: PreferenceStore }): React.ReactElement {
  const settings = React.useSyncExternalStore(preferences.subscribe, preferences.getSnapshot)
  const h = React.createElement
  const setting = (key: keyof typeof settings, label: string, hint: string) => h('label', { className: 'moss-setting', key },
    h('span', null, label, h('small', null, hint)),
    h('input', { type: 'checkbox', role: 'switch', checked: settings[key], onChange: (event: React.ChangeEvent<HTMLInputElement>) => preferences.update({ [key]: event.target.checked }) }))
  return h('section', { className: 'moss-settings', 'aria-label': '550W 主题设置' },
    h('h3', null, '550W / 流浪地球'),
    h('p', null, '550W 智能体预设默认不启用。使用前请自行安装并配置 ego（ego-browser）和 LCU Computer Use，确认 DSH 可以调用它们。本插件不会自动安装这些工具；主题可独立使用。'),
    h('p', null, '准备完成后，在「插件」中启用 preset-moss，再在原生 Agent 预设选择器中选择「550W」。'),
    setting('enabled', '流浪地球主题', '深蓝终端与信号红强调'),
    setting('ambient', '环境纹理', '仪表网格与冷光反射'),
    setting('motion', '界面动效', '地球航行与土星状态动画'))
}
