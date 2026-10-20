import React from 'react'
import { createPortal } from 'react-dom'
import type { Context } from '@deepseek-ai/cordis'
import { defaults, positions, type Preferences } from '../preferences.ts'
import { styles } from './styles.ts'
import type { Notice } from '../monitor.ts'
import { installAccountMenu } from './account-menu.ts'
export const inject = ['slots', 'uiWorkspace']
type Response = { preferences: Preferences; native: { status: string; error: string; platform: string }; recent: (Notice & { at: number })[] }
const labels = { left: '屏幕左侧', right: '屏幕右侧', top: '屏幕顶部', island: '灵动岛' }
export async function request(action: string, body: Record<string, unknown> = {}): Promise<any> {
  const res = await fetch('/dsh-desktop-notify', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...body }) })
  const value = await res.json()
  if (!res.ok) throw new Error(value.error ?? '桌面提醒操作失败。')
  return value
}
const h = React.createElement
export function Bell(): React.ReactElement {
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, 'aria-hidden': true }, h('path', { d: 'M5 10a7 7 0 0 1 14 0v5l2 3H3l2-3zM9 21h6M12 1v2', strokeLinecap: 'round', strokeLinejoin: 'round' }))
}
export function apply(ctx: Context): void {
  const slots = ctx.get('slots') as { inject(name: string, callback: () => () => void): () => void; register(options: { name: string; id: string; order: number }, render: (props: { wide?: boolean }) => React.ReactElement): () => void }
  ctx.effect(() => { const style = document.createElement('style'); style.textContent = styles; document.head.appendChild(style); return () => style.remove() })
  ctx.effect(() => slots.inject('shell.overlay', () => slots.register({ name: 'shell.overlay', id: 'dsh-desktop-notify-menu', order: 70 }, () => h(AccountNotifyEntry))))
  ctx.effect(() => slots.inject('settings.general.item', () => slots.register({ name: 'settings.general.item', id: 'dsh-desktop-notify', order: 70 }, () => h(NotifyEntry, { settings: true }))))
  ctx.effect(() => {
    let live = true; let polling = false
    const workspace = ctx.get('uiWorkspace') as { openSession(id: string): void }
    const poll = async () => {
      if (polling || document.hidden || !document.hasFocus()) return
      polling = true
      try {
        const { open } = await request('poll', { desktop: !!(window as unknown as { dshDesktop?: unknown }).dshDesktop, focused: true })
        if (live && open?.sessionId) { workspace.openSession(open.sessionId); await request('ack', { id: open.id }) }
      } catch { /* A reconnect is retried when the window is visible. */ }
      finally { polling = false }
    }
    const timer = setInterval(() => { void poll() }, 1000)
    window.addEventListener('focus', poll); document.addEventListener('visibilitychange', poll)
    return () => { live = false; clearInterval(timer); window.removeEventListener('focus', poll); document.removeEventListener('visibilitychange', poll) }
  })
}
export function AccountNotifyEntry(): React.ReactElement | null {
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => installAccountMenu(document, () => setOpen(true)), [])
  return open ? h(NotifySettings, { close: () => setOpen(false) }) : null
}
export function NotifyEntry({ compact = false, settings = false }: { compact?: boolean; settings?: boolean }): React.ReactElement {
  const [open, setOpen] = React.useState(false)
  return h(React.Fragment, null,
    settings ? h('div', { className: 'dn-setting-row' }, h('div', null, '桌面提醒', h('small', null, '后台任务完成与审批、选择提醒')), h('button', { type: 'button', onClick: () => setOpen(true) }, '配置'))
      : h('button', { type: 'button', className: 'dn-entry', title: '桌面提醒', 'aria-label': '配置桌面提醒', onClick: () => setOpen(true) }, h(Bell), !compact && '桌面提醒'),
    open && h(NotifySettings, { close: () => setOpen(false) }))
}
export function NotifySettings({ close }: { close(): void }): React.ReactPortal {
  const [value, setValue] = React.useState<Preferences>({ ...defaults })
  const [state, setState] = React.useState<Response>()
  const [error, setError] = React.useState('')
  const [busy, setBusy] = React.useState(true)
  const [saved, setSaved] = React.useState(false)
  const panel = React.useRef<HTMLDivElement>(null)
  const titleId = React.useId()
  React.useEffect(() => {
    let live = true
    void request('get').then(data => { if (live) { setState(data); setValue(data.preferences) } }).catch(err => { if (live) setError(String(err.message)) }).finally(() => { if (live) setBusy(false) })
    const previous = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); close() }
      if (event.key === 'Tab') {
        const nodes = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary')
        if (!nodes?.length) return
        const first = nodes[0]; const last = nodes[nodes.length - 1]
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', key, true)
    return () => { live = false; document.removeEventListener('keydown', key, true); previous?.focus() }
  }, [])
  const patch = (next: Partial<Preferences>) => { setValue(old => ({ ...old, ...next })); setSaved(false) }
  const save = async (kind?: string) => {
    setBusy(true); setError(''); setSaved(false)
    try {
      let data = await request('update', { preferences: value })
      setState(data); setValue(data.preferences)
      if (kind) { data = await request('test', { kind }); setState(data) }
      else if (value.enabled && data.native.status === 'idle') { data = await request('prepare'); setState(data) }
      setSaved(true)
    } catch (err) { setError(err instanceof Error ? err.message : String(err)) }
    finally { setBusy(false) }
  }
  const toggle = (key: 'enabled' | 'completion' | 'decisions' | 'sound', label: string, detail: string) => h('label', { className: 'dn-row', key }, h('span', null, label, h('small', null, detail)), h('input', { type: 'checkbox', checked: value[key], disabled: busy || !state, onChange: (event: React.ChangeEvent<HTMLInputElement>) => patch({ [key]: event.target.checked }) }))
  return createPortal(h('div', { className: 'dn-shade', onMouseDown: (event: React.MouseEvent) => { if (event.target === event.currentTarget) close() } },
    h('div', { className: 'dn-panel', role: 'dialog', 'aria-modal': true, 'aria-labelledby': titleId, ref: panel, tabIndex: -1 },
      h('div', { className: 'dn-head' }, h(Bell), h('div', null, h('h2', { id: titleId }, '桌面提醒'), h('p', null, '任务有结果，随时知晓。')), h('button', { type: 'button', 'aria-label': '关闭桌面提醒设置', onClick: close }, '×')),
      h('div', { className: 'dn-body' },
        toggle('enabled', '开启桌面提醒', 'DSH 在前台或后台运行时均提醒，不抢占焦点。'),
        h('div', { className: 'dn-label' }, '提醒位置 / PLACEMENT'),
        h('div', { className: 'dn-positions', role: 'group', 'aria-label': '提醒位置' }, ...positions.map(position => h('button', { type: 'button', key: position, disabled: busy || !state, 'aria-pressed': value.position === position, onClick: () => patch({ position }) }, h('span', { className: 'dn-monitor', 'data-position': position, 'aria-hidden': true }), labels[position]))),
        h('div', { className: 'dn-options' }, h('label', null, '显示器', h('select', { 'aria-label': '显示器', value: value.display, disabled: busy || !state, onChange: (event: React.ChangeEvent<HTMLSelectElement>) => patch({ display: event.target.value as Preferences['display'] }) }, h('option', { value: 'main' }, '主显示器'), h('option', { value: 'pointer' }, '鼠标所在显示器'))),
          h('label', null, '自动收起时长', h('select', { 'aria-label': '自动收起时长', value: value.duration, disabled: busy || !state, onChange: (event: React.ChangeEvent<HTMLSelectElement>) => patch({ duration: Number(event.target.value) }) }, ...[...new Set([3, 5, 8, 12, 20, 30, value.duration])].sort((a, b) => a - b).map(seconds => h('option', { value: seconds, key: seconds }, `${seconds} 秒`))))),
        toggle('completion', '任务完成', '仅正常结束时提醒，取消和中断不会显示为完成。'),
        toggle('decisions', '需要选择或审批', '轻动画提示后自动收起，问题和审批仍在任务内等你处理。异常也会提醒。'),
        toggle('sound', '提示音', '每条新提醒播放一次轻提示音。'),
        h('p', { className: 'dn-note' }, '小型地球动画表示完成，月球与红色微光表示需要关注。无文字提醒，到时自动消失；点击动画返回任务。'),
        h('div', { className: 'dn-status', role: 'status' }, busy ? '正在保存或准备原生提醒，首次编译可能需要片刻…' : state?.native.status === 'ready' ? '原生提醒已就绪 · 覆盖所有会话 · 前后台均有效' : state?.native.status === 'unavailable' ? state.native.error : '首次保存或测试会准备原生提醒，无需系统通知权限。'),
        error && h('div', { className: 'dn-error', role: 'alert' }, error),
        !!state?.recent.length && h('details', { className: 'dn-recent' }, h('summary', null, '最近提醒'), h('ol', null, ...state.recent.map((notice, i) => h('li', { key: `${notice.id}:${i}` }, h('span', { className: 'dn-pill', 'data-kind': notice.kind }, notice.kind === 'complete' ? '完成' : notice.kind === 'error' ? '异常' : '待选择'), h('span', null, notice.title), h('time', null, new Date(notice.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))))))
      ),
      h('div', { className: 'dn-actions' }, h('button', { type: 'button', disabled: busy || !state || !value.enabled, onClick: () => { void save('complete') } }, '测试完成提醒'), h('button', { type: 'button', disabled: busy || !state || !value.enabled, onClick: () => { void save('decision') } }, '测试选择提醒'), h('button', { type: 'button', disabled: busy || !state, onClick: () => { void save() } }, busy ? '处理中…' : saved ? '已保存' : '保存设置'))
    )), document.body)
}
