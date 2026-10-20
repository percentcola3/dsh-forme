// Development fixture: actual plugin, simulated DSH slots and session stores.
// No model requests, credentials, or existing DSH profile are used here.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { apply } from '../src/client/index.ts'
import type { Context } from '@deepseek-ai/cordis'
import type { SessionActivity, SessionSnapshot } from '../src/client/state.ts'
import { MossIcon, type IconName } from '../src/client/icons.ts'
import { bootCSS, installBootBrand } from '../src/boot-brand.ts'

function store<T>(initial: T) {
  let state = initial
  const listeners = new Set<() => void>()
  return { getSnapshot: () => state, subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } }, set(next: T) { state = next; for (const fn of listeners) fn() } }
}
const selection = store<{ sessionId?: string }>({ sessionId: 'preview-a' })
const session = store<SessionSnapshot>({ running: false })
const activity = store<ReadonlyMap<string, SessionActivity>>(new Map())
const catalog = store<{ byId: Record<string, { projectionValues?: { agentPreset?: string } }> }>({ byId: { 'preview-a': { projectionValues: { agentPreset: 'standard' } } } })
const cleanups: (() => void)[] = []
const renderers = new Map<string, () => React.ReactElement | null>()
const slotsRevision = store(0)
const renderSlot = (name: string) => renderers.get(name)?.()
const services = {
  uiSession: { sessionStatus: activity },
  uiWorkspace: {
    selection,
    startSession(_workspace: unknown, options: { agentPreset?: string }) {
      const id = `preview-${Date.now()}`
      catalog.set({ byId: { ...catalog.getSnapshot().byId, [id]: { projectionValues: { agentPreset: options.agentPreset } } } })
      session.set({}); selection.set({ sessionId: id })
    },
  },
  remote: { agentPresets: { list: async () => ({ ok: true, value: { presets: [{ id: 'standard' }, { id: 'moss' }] } }) } },
  sessions: { list: catalog, retain() { return { ready: Promise.resolve(), binding: { session }, release() {} } } },
  slots: {
    inject(_name: string, register: () => () => void) { return register() },
    register(options: { name: string }, renderer: () => React.ReactElement | null) {
      renderers.set(options.name, renderer); slotsRevision.set(slotsRevision.getSnapshot() + 1)
      return () => { if (renderers.get(options.name) === renderer) { renderers.delete(options.name); slotsRevision.set(slotsRevision.getSnapshot() + 1) } }
    },
  },
}
apply({ get: (key: keyof typeof services) => services[key], effect: (run: () => () => void) => cleanups.push(run()) } as unknown as Context)
const h = React.createElement
/** Mirrors DSH's RunningStatus markup: hidden live status, divider, whale icon and label. */
function HostRunning() {
  const [start] = React.useState(Date.now)
  const [, tick] = React.useReducer((n: number) => n + 1, 0)
  React.useEffect(() => { const t = setInterval(tick, 1000); return () => clearInterval(t) }, [])
  const total = Math.max(1, Math.floor((Date.now() - start) / 1000)) + 158
  const label = `深度求索中，用时 ${total >= 60 ? `${Math.floor(total / 60)}分` : ''}${total % 60}秒 ···`
  return h('div', { className: 'fixture-running', 'data-chat-running': true },
    h('span', { role: 'status', className: 'fixture-sr' }, '深度求索中'),
    h('span', { className: 'fixture-running-content' }, h('span', { 'aria-hidden': true }, '🐋'), h('span', null, label)))
}
const root = createRoot(document.getElementById('root')!)
function Running() {
  const snapshot = React.useSyncExternalStore(session.subscribe, session.getSnapshot)
  return snapshot.running ? h(HostRunning) : null
}

/** Mirrors AssistantMarkdown/MarkdownText's host seats, including the streaming flag. */
function TransmissionExample({ replay }: { replay: number }) {
  const [visible, setVisible] = React.useState(10000)
  const [streaming, setStreaming] = React.useState(false)
  React.useEffect(() => {
    if (!replay) return
    setVisible(0); setStreaming(true)
    let length = 0
    const timer = setInterval(() => {
      length += 3
      setVisible(length)
      if (length >= offset) { clearInterval(timer); setStreaming(false) }
    }, 45)
    return () => clearInterval(timer)
  }, [replay])
  const elements: React.ReactNode[] = []
  let offset = 0
  const text = (value: string) => {
    const shown = value.slice(0, Math.max(0, visible - offset))
    offset += value.length
    return shown
  }
  const title = text('领航员，对话界面方案已整理。')
  const intro = text('以电影里的通讯终端为参考：用引文、编号和细线组织信息，让长篇回复也有清晰的阅读节奏。')
  const quote = text('尾流从大气层连续延伸，贴着球面绕流，再向后舒展。保留冷光和空间感，让动态服从阅读。')
  const heading = text('界面呈现')
  const first = text('引文保留原文，用红色细线和灰白层次突出设计约束。')
  const second = text('章节采用仪表编号，正文维持自然行距，代码保留等宽字体。')
  const third = text('新回复短暂显现；扫描提示仅在真实流式输出时出现。')
  const check = text('验证与下一步')
  const ending = text('这是一段界面示例，文字逐步加入来自本地演示。实际会话直接使用 DSH 的 Markdown 与流式状态。')
  if (title) elements.push(h('h1', { key: 'title' }, title))
  if (intro) elements.push(h('p', { key: 'intro' }, intro))
  if (quote) elements.push(h('blockquote', { key: 'quote' }, h('p', null, quote)))
  if (heading) elements.push(h('h2', { key: 'heading' }, heading))
  if (first) elements.push(h('ol', { key: 'list' }, ...[first, second, third].filter(Boolean).map((line, i) => h('li', { key: i }, line))))
  if (check) elements.push(h('h2', { key: 'check' }, check))
  if (ending) elements.push(h('p', { key: 'ending' }, ending))
  if (!streaming) elements.push(h('pre', { key: 'code' }, h('code', null, 'pnpm --dir plugins/dsh-moss-theme build')))
  return h('div', { 'data-chat-flow-kind': 'assistant-step', 'data-chat-group-part': 'response' },
    h('div', { 'data-slot': 'conversation.chat.node' },
      h('div', { 'data-streaming': streaming || undefined },
        h('div', null, h('div', { className: 'fixture-markdown' }, ...elements)))))
}

function DetailsExample() {
  const [selected, setSelected] = React.useState<IconName>('orbit')
  const icons: [IconName, string][] = [['orbit', '航行'], ['terminal', '终端'], ['chat', '通讯'], ['folder', '档案'], ['connect', '连接'], ['focus', '定位']]
  return h('aside', { className: 'fixture-details', 'aria-label': '界面细节预览' },
    h('div', { className: 'fixture-details-heading' }, h('span', null, h(MossIcon, { name: 'terminal' }), 'INSTRUMENT DETAILS / 交互细节'), h('small', null, '本地界面示例')),
    h('div', { className: 'fixture-detail-grid' },
      h('div', { className: 'fixture-type-sample' }, h('small', null, 'TYPE / 字体层级'), h('strong', null, '550W / Aa 0129'), h('p', null, '领航员，保持前进。'), h('code', null, 'const signal = "550W";')),
      h('div', { className: 'fixture-icon-sample' }, h('small', null, 'GLYPHS / 仪表图标'),
        h('div', null, ...icons.map(([name, label]) => h('button', { key: name, 'aria-label': `${label}图标示例`, 'aria-pressed': selected === name, onClick: () => setSelected(name) }, h(MossIcon, { name }), h('span', null, label))))),
      h('div', { className: 'fixture-focus-sample' }, h('small', null, 'FOCUS / 输入焦点'), h('input', { 'aria-label': '焦点演示', placeholder: '点击输入，查看光标与边线' }),
        h('button', { onClick: () => {
          const quote = document.querySelector('[data-chat-flow-kind="assistant-step"] blockquote p')
          if (!quote) return
          const range = document.createRange(); range.selectNodeContents(quote)
          const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range)
        } }, h(MossIcon, { name: 'focus' }), '选中引文'))))
}

function StartupPreview({ onDone }: { onDone(): void }) {
  React.useEffect(() => {
    const stop = installBootBrand()
    const timer = setTimeout(onDone, 2800)
    return () => { clearTimeout(timer); stop() }
  }, [onDone])
  return h(React.Fragment, null, h('style', null, bootCSS),
    h('div', { className: 'fixture-boot', 'data-dsh-boot': '' },
      h('div', null, h('div', null, 'HARNESS'), h('div', { 'data-dsh-boot-spinner': '' }), h('div', { role: 'status' }, '正在加载插件…'))))
}
function Preview() {
  const [mounted, setMounted] = React.useState(true)
  const [hero, setHero] = React.useState(true)
  const [replay, setReplay] = React.useState(0)
  const [details, setDetails] = React.useState(false)
  const [selectedTask, setSelectedTask] = React.useState('550W 界面主题')
  const [startup, setStartup] = React.useState(false)
  const finishStartup = React.useCallback(() => setStartup(false), [])
  React.useSyncExternalStore(slotsRevision.subscribe, slotsRevision.getSnapshot)
  return h(React.Fragment, null,
    mounted && renderSlot('shell.overlay'),
    startup && h(StartupPreview, { onDone: finishStartup }),
    h('aside', { className: 'fixture-sidebar' }, h('div', { className: 'fixture-brand' }, mounted ? renderSlot('sidebar.brand.name') : 'DSH'),
      h('button', { className: 'fixture-new' }, h(MossIcon, { name: 'plus' }), '新建任务'), h('div', { className: 'fixture-label' }, '工作空间 / WORKSPACES'),
      h('div', { className: 'fixture-project' }, h(MossIcon, { name: 'folder' }), 'dsh-forme'),
      h('div', { role: 'tree', 'aria-label': '示例任务列表' }, ...['550W 界面主题', '项目结构分析', '构建与验证'].map(label => h('button', { key: label, className: 'fixture-task', role: 'treeitem', 'aria-selected': selectedTask === label, onClick: () => setSelectedTask(label) }, h(MossIcon, { name: 'chat' }), label))),
      h('div', { className: 'fixture-side-bottom' }, h(MossIcon, { name: 'orbit' }), '本地工作空间', h('small', null, '领航员终端 · LOCAL WORKSPACE'))),
    h('main', { 'data-conversation-scroll': '' }, h('header', { 'data-window-drag': '' }, mounted && renderSlot('conversation.header.leading'), h('strong', null, '550W 界面主题'), h('nav', { role: 'tablist', 'aria-label': '工作视图' }, h('button', { role: 'tab', 'aria-selected': true }, h(MossIcon, { name: 'chat' }), '对话'), h('button', { role: 'tab', 'aria-selected': false }, h(MossIcon, { name: 'folder' }), '文件'), h('button', { role: 'tab', 'aria-selected': false }, h(MossIcon, { name: 'changes' }), '变更'))),
      details && h(DetailsExample),
      hero ? h('div', { className: 'fixture-hero' }, h('div', null, h('span', null, h('span', { 'data-slot': 'conversation.hero.brand.mark' }, mounted && renderSlot('conversation.hero.brand.mark'))), h('span', {className:'fixture-native-title'}, '探索未至之境', h('small', null, '预览版')))) : h('article', { className: 'fixture-chat' }, h('div', { className: 'fixture-label' }, 'MISSION LOG / 任务记录'),
        h('div', { 'data-chat-flow-kind': 'user' }, h('div', { 'data-slot': 'conversation.chat.node' }, h('div', null, h('div', null, h('div', { className: 'fixture-user' }, h('span', null, '把这次界面方案整理成通讯简报，并给出下一步。')))))),
        h(TransmissionExample, { replay }),
        h(Running)),
      h('div', { className: 'fixture-composer-stack' }, mounted && renderSlot('conversation.input.dock'), h('div', { className: 'fixture-composer', 'data-composer-card': '' }, h('textarea', { placeholder: '领航员，请下达指令…', 'aria-label': '示例输入框' }), h('div', null, h('span', null, h(MossIcon, { name: 'folder' }), '工作空间 / dsh-forme'), h('button', { disabled: true, 'aria-label': '示例发送按钮' }, h(MossIcon, { name: 'send' }))))),
      h('div', { className: 'fixture-controls' }, h('span', null, '开发预览 · 模拟会话'),
        h('button', {onClick:()=>setHero(value=>!value)}, hero ? '对话预览' : '首页预览'),
        h('button', { onClick: () => { setHero(false); setReplay(value => value + 1) } }, '文字演示'),
        h('button', { 'aria-pressed': details, onClick: () => { setHero(false); setDetails(value => !value) } }, '细节预览'),
        h('button', { onClick: () => setStartup(true) }, '启动预览'),
        ...[['待命', {}], ['连接中', {openState:'loading'}], ['处理中', { running: true }], ['等待确认', { running: true }], ['异常', { lastAgentError: 'preview' }], ['不可用', { removed: true }]].map(([label, value]) => h('button', { key: String(label), onClick: () => {
          const id = selection.getSnapshot().sessionId
          activity.set(id ? new Map([[id, { running: !!(value as SessionSnapshot).running, ...label === '等待确认' ? { pendingInteraction: { id: 'fixture-approval' } } : {} }]]) : new Map())
          session.set(value as SessionSnapshot)
        } }, String(label))),
        h('button', { onClick: () => selection.set({}) }, '无会话'), h('button', { onClick: () => { session.set({}); selection.set({ sessionId: 'preview-b' }) } }, '切换会话'),
        h('button', { onClick: () => { for (const cleanup of cleanups.reverse()) cleanup(); setMounted(false) }, disabled: !mounted }, '卸载插件'))),
  )
}
root.render(h(Preview))
