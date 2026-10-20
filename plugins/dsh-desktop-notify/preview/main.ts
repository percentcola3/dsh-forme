import React from 'react'
import { createRoot } from 'react-dom/client'
import { NotifyEntry, request } from '../src/client/index.ts'
import { styles } from '../src/client/styles.ts'
const h = React.createElement
const style = document.createElement('style'); style.textContent = styles; document.head.appendChild(style)
function NavigationProbe() {
  const [status, setStatus] = React.useState('')
  return h(React.Fragment, null, h('button', { onClick: async () => {
    const { open } = await request('poll', { desktop: true, focused: true })
    setStatus(open?.sessionId ? `已接收任务定位：${open.sessionId}` : '尚无点击回传')
    if (open) await request('ack', { id: open.id })
  } }, '核对点击回传'), h('span', { role: 'status' }, status))
}
createRoot(document.getElementById('root')!).render(h(React.Fragment, null,
  h('aside', null, h('strong', null, 'DSH'), h('small', null, 'DESKTOP SIGNALS'), h('p', null, '工作区'), h('div', null, '后台任务提醒'), h(NotifyEntry)),
  h('main', null, h('span', { className: 'eyebrow' }, 'DESKTOP NOTIFICATIONS / 桌面提醒'), h('h1', null, '让任务找到你。'), h('p', null, '四种桌面位置，真实任务状态。前后台一致，不打断正在做的事。'),
    h('div', { className: 'cards' }, ...['left', 'right', 'top', 'island'].map((position, i) => h('div', { key: position }, h('span', { className: 'dn-monitor', 'data-position': position }), h('b', null, ['屏幕左侧', '屏幕右侧', '屏幕顶部', '灵动岛'][i])))),
    h('div', { className: 'fixture' }, h('small', null, '事件链路验收 · 仅使用模拟会话'), ...['complete', 'decision', 'resolve', 'cancel'].map((kind, i) => h('button', { key: kind, onClick: () => { void fetch('/simulate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind }) }) } }, ['模拟正常完成', '模拟等待选择', '模拟已回答', '模拟取消任务'][i])), h(NavigationProbe)),
    h('p', { className: 'muted' }, '原生悬浮提醒会显示在桌面上，窗口和浏览器无需保持前台。'))))
