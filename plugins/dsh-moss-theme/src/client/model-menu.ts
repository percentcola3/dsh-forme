import React from 'react'
import { createPortal } from 'react-dom'
import { filterModelSources, groupModelSources, rowSelection, sameModel, type ProviderGroup, type Selection, type SourceRow } from './model-sources.ts'
import type { PreferenceStore } from './state.ts'

const h = React.createElement
export type DirectoryState = {
  current: Selection | null; retainedEffort?: string; routable: boolean | null
  groups: readonly ProviderGroup[]; failures: readonly { id: string; name: string; message: string }[]
  status: string; pending: Selection | null; error: string | null
}
type Store = { getSnapshot(): DirectoryState; subscribe(listener: () => void): () => void }
type Result = { ok: boolean; error?: { message?: string; code?: string } } | undefined
export type ModelMenuProps = {
  locked?: boolean; available: boolean; directory: Store; load(): void; select(value: Selection): Promise<Result>
}
export type ModelDirectories = { directoryFor(id: string): { store: Store; load(): Promise<unknown>; select(value: Selection): Promise<Result> } }
export type ModelMenuSlots = {
  inject(name: string, install: () => () => void): () => void
  register(options: { name: string; id: string; priority: number; inject(id: string): ModelMenuProps }, render: (props: ModelMenuProps) => React.ReactElement | null): () => void
}

/** Shadow only this display seat. The host still owns catalogs, sessions and model routing. */
export function installModelSourceMenu(slots: ModelMenuSlots, models: ModelDirectories, sessions: { subagentAddress(id: string): unknown }, preferences: PreferenceStore): () => void {
  return slots.inject('conversation.input.model', () => {
    let dispose: (() => void) | undefined
    const sync = () => {
      if (!preferences.getSnapshot().enabled) { dispose?.(); dispose = undefined; return }
      if (dispose) return
      dispose = slots.register({ name: 'conversation.input.model', id: 'dsh-moss-model-sources', priority: -200,
        inject: sessionId => {
          const directory = models.directoryFor(sessionId)
          const available = sessions.subagentAddress(sessionId) === undefined
          return { available, directory: directory.store,
            load: () => { if (available) void directory.load().catch(() => {}) },
            select: value => available ? directory.select(value) : Promise.resolve(undefined),
          }
        },
      }, props => h(ModelSourceMenu, props))
    }
    const unsubscribe = preferences.subscribe(sync)
    sync()
    return () => { unsubscribe(); dispose?.() }
  })
}

export function ModelSourceMenu({ locked = false, available, directory, load, select }: ModelMenuProps): React.ReactElement | null {
  const state = React.useSyncExternalStore(listener => directory.subscribe(listener), () => directory.getSnapshot())
  const [pane, setPane] = React.useState<'root' | 'model' | 'effort' | null>(null)
  const [query, setQuery] = React.useState('')
  const [active, setActive] = React.useState(0)
  const [error, setError] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [position, setPosition] = React.useState<React.CSSProperties>({ visibility: 'hidden' })
  const trigger = React.useRef<HTMLButtonElement>(null), menu = React.useRef<HTMLDivElement>(null), search = React.useRef<HTMLInputElement>(null)
  const options = React.useRef<(HTMLButtonElement | null)[]>([])
  const operation = React.useRef(0)
  const busyRef = React.useRef(false)
  const restoreFocus = React.useRef(false)
  const id = React.useId()
  const groups = React.useMemo(() => groupModelSources(state.groups), [state.groups])
  const rows = React.useMemo(() => groups.flatMap(group => group.rows), [groups])
  const visible = React.useMemo(() => filterModelSources(groups, query), [groups, query])
  const visibleRows = React.useMemo(() => visible.flatMap(group => group.rows), [visible])
  const current = rows.find(row => sameModel({ provider: row.provider.id, model: row.model.id }, state.current))
  const reasoning = current?.model.reasoning
  const effort = state.current?.reasoningEffort ?? reasoning?.defaultEffort
  const effortName = reasoning ? reasoning.efforts.find(item => item.id === effort)?.name ?? effort : undefined
  const effortChoices = reasoning ? [
    ...(reasoning.defaultEffort === undefined ? [{ id: undefined, name: '提供方默认' }] : []), ...reasoning.efforts,
  ] : []
  const busy = submitting || state.pending !== null
  const caption = current?.model.name ?? state.current?.model ?? '选择模型'
  const close = () => { restoreFocus.current = true; setPane(null) }
  React.useLayoutEffect(() => { if (!pane && !busy && restoreFocus.current) { restoreFocus.current = false; trigger.current?.focus() } }, [pane, busy])
  React.useEffect(() => { if (available) load() }, [directory, available])
  const openPane = (next: 'root' | 'model' | 'effort') => {
    setQuery(''); setError(''); setPane(next)
    setActive(next === 'model' ? Math.max(0, rows.findIndex(row => sameModel({ provider: row.provider.id, model: row.model.id }, state.current)))
      : next === 'effort' ? Math.max(0, effortChoices.findIndex(item => item.id === effort)) : 0)
  }
  React.useEffect(() => {
    operation.current++; busyRef.current = false; setSubmitting(false); setPane(null); setError('')
    return () => { operation.current++ }
  }, [directory])
  React.useEffect(() => { if (locked || !available) setPane(null) }, [locked, available])
  React.useLayoutEffect(() => {
    if (!pane) return
    const place = () => {
      const anchor = trigger.current?.getBoundingClientRect(), box = menu.current?.getBoundingClientRect()
      if (!anchor || !box) return
      setPosition({ left: Math.max(8, Math.min(anchor.right - box.width, innerWidth - box.width - 8)), top: Math.max(8, Math.min(anchor.top - box.height - 8, innerHeight - box.height - 8)) })
    }
    place()
    const observer = new ResizeObserver(place)
    if (menu.current) observer.observe(menu.current)
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true)
    return () => { observer.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [pane])
  React.useEffect(() => {
    if (!pane) return
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setPane(null) }
    document.addEventListener('pointerdown', outside)
    if (pane === 'model') search.current?.focus()
    else (options.current[active] ?? options.current[0])?.focus()
    return () => document.removeEventListener('pointerdown', outside)
  }, [pane])
  React.useEffect(() => { if (pane === 'model') options.current[Math.min(active, visibleRows.length - 1)]?.scrollIntoView({ block: 'nearest' }) }, [active, visibleRows, pane])
  const choose = async (selection: Selection) => {
    if (busyRef.current || busy || locked || !available) return
    busyRef.current = true; setSubmitting(true); setError('')
    const epoch = operation.current
    try {
      const result = await select(selection)
      if (epoch !== operation.current) return
      if (result?.ok) close()
      else setError(result?.error?.message ?? '模型切换未完成，请重试。')
    } catch (cause) {
      if (epoch === operation.current) setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      if (epoch === operation.current) { busyRef.current = false; setSubmitting(false) }
    }
  }
  const keyDown = (event: React.KeyboardEvent) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === 'Escape' || event.key === 'Tab' && event.shiftKey) {
      event.preventDefault(); event.stopPropagation(); if (pane === 'root') close(); else openPane('root'); return
    }
    const count = pane === 'model' ? visibleRows.length : pane === 'effort' ? effortChoices.length : reasoning ? 2 : 1
    const index = Math.min(active, count - 1)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!count) return
      const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + count) % count
      setActive(next); if (pane === 'model') search.current?.focus(); else options.current[next]?.focus()
    } else if ((event.key === 'Enter' || event.key === 'Tab') && pane === 'model' && event.target === search.current) {
      event.preventDefault()
      const row = visibleRows[index]
      if (row) void choose(rowSelection(row, state.current))
      else if (event.key === 'Tab') close()
    } else if (event.key === 'Tab') {
      event.preventDefault()
      const focused = options.current.find(option => option === document.activeElement)
      if (focused && !focused.disabled) focused.click(); else close()
    }
  }
  const bindOption = (index: number) => (node: HTMLButtonElement | null) => { options.current[index] = node }
  const rowNode = (row: SourceRow, index: number) => {
    const selected = sameModel({ provider: row.provider.id, model: row.model.id }, state.current)
    return h('button', { key: row.key, ref: bindOption(index), id: `${id}-option-${index}`, type: 'button', role: 'option', 'aria-selected': selected,
      disabled: busy, tabIndex: -1, 'data-active': index === Math.min(active, visibleRows.length - 1) || undefined,
      title: `${row.provider.name} · ${row.provider.id} / ${row.model.id}`,
      onFocus: () => setActive(index), onPointerMove: () => setActive(index), onClick: () => void choose(rowSelection(row, state.current)),
    }, h('span', null, row.model.name), selected ? h('span', { 'aria-hidden': true }, '✓') : null)
  }
  if (!available) return null
  let offset = 0
  return h(React.Fragment, null,
    h('button', { ref: trigger, className: 'moss-model-trigger', type: 'button', disabled: locked || busy, 'aria-label': `模型：${caption}`, 'aria-haspopup': 'dialog', 'aria-expanded': !!pane,
      title: current ? `${current.provider.name} / ${current.model.id}` : caption,
      onClick: () => { if (pane) close(); else { load(); openPane('root') } },
    }, h('span', null, caption), effortName && h('small', null, effortName), h('span', { 'aria-hidden': true }, busy ? '…' : '⌄')),
    pane && createPortal(h('div', { ref: menu, className: 'moss-model-menu', style: position, role: 'dialog', 'aria-label': '模型选择', onKeyDown: keyDown },
      pane !== 'root' && h('button', { className: 'moss-model-back', type: 'button', onClick: () => openPane('root') }, '‹ 返回'),
      pane === 'root' && h('div', { className: 'moss-model-root' },
        h('button', { ref: bindOption(0), type: 'button', onClick: () => openPane('model') }, h('span', null, '模型'), h('span', null, `${caption} ›`)),
        reasoning && h('button', { ref: bindOption(1), type: 'button', onClick: () => openPane('effort') }, h('span', null, '推理强度'), h('span', null, `${effortName ?? '提供方默认'} ›`))),
      pane === 'model' && h(React.Fragment, null,
        h('input', { ref: search, className: 'moss-model-search', type: 'search', role: 'combobox', 'aria-expanded': true, 'aria-controls': `${id}-list`, 'aria-autocomplete': 'list',
          'aria-activedescendant': visibleRows.length ? `${id}-option-${Math.min(active, visibleRows.length - 1)}` : undefined,
          'aria-label': '搜索模型或来源', placeholder: '搜索模型或来源…', value: query, onChange: (event: React.ChangeEvent<HTMLInputElement>) => { setQuery(event.target.value); setActive(0) } }),
        h('div', { className: 'moss-model-list', id: `${id}-list`, role: 'listbox', 'aria-label': '模型', 'aria-busy': busy || state.status === 'loading' },
          ...visible.map(group => { const start = offset; offset += group.rows.length; return h('section', { key: group.id, role: 'group', 'aria-label': group.name },
            h('div', { className: 'moss-model-heading', 'aria-hidden': true }, group.name), ...group.rows.map((row, index) => rowNode(row, start + index))) }),
          !visibleRows.length && h('p', { role: 'status' }, state.status === 'loading' ? '正在加载模型…' : query ? '没有匹配的模型' : '没有可用模型'))),
      pane === 'effort' && h('div', { className: 'moss-model-list', role: 'menu', 'aria-label': '推理强度' }, ...effortChoices.map((item, index) => h('button', {
        key: item.id ?? 'provider-default', ref: bindOption(index), onFocus: () => setActive(index), type: 'button', role: 'menuitemradio', 'aria-checked': item.id === effort, disabled: busy,
        onClick: () => { if (current) void choose({ provider: current.provider.id, model: current.model.id, ...item.id === undefined ? {} : { reasoningEffort: item.id } }) },
      }, h('span', null, item.name), item.id === effort ? '✓' : null))),
      (error || state.error || state.failures.length > 0) && h('div', { className: 'moss-model-error', role: 'alert' }, error || state.error || state.failures.map(failure => `${failure.name}：${failure.message}`).join('；'),
        h('button', { type: 'button', disabled: busy, onClick: () => { setError(''); load() } }, '重试加载')),
    ), document.body))
}
