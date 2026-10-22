import React from 'react'
import { createRoot } from 'react-dom/client'
import { AccountNotifyEntry, request } from '../src/client/index.ts'
import { styles } from '../src/client/styles.ts'
const h = React.createElement
const style = document.createElement('style'); style.textContent = styles; document.head.appendChild(style)
function PreviewAccountMenu() {
  const [open, setOpen] = React.useState(false)
  return h('div', { className: 'fixture-account' },
    h('button', { 'aria-label': '账号菜单', 'aria-haspopup': 'menu', 'aria-expanded': open, 'aria-controls': 'fixture-account-menu', 'data-signed-out': false, onClick: () => setOpen(!open) }, '◉  预览账号'),
    open && h('div', { id: 'fixture-account-menu', role: 'menu' }, ...['设置', '意见反馈', '退出登录'].map(label => h('button', { key: label, role: 'menuitem', className: 'fixture-menu-item', onClick: () => setOpen(false) }, label))),
    h(AccountNotifyEntry))
}
function NavigationProbe() {
  const [status, setStatus] = React.useState('')
  return h(React.Fragment, null, h('button', { onClick: async () => {
    const { open } = await request('poll', { desktop: true, focused: true })
    setStatus(open?.sessionId ? `已接收任务定位：${open.sessionId}` : '尚无点击回传')
    if (open) await request('ack', { id: open.id })
  } }, '核对点击回传'), h('span', { role: 'status' }, status))
}
createRoot(document.getElementById('root')!).render(h(React.Fragment, null,
  h('aside', null, h('strong', null, 'DSH'), h('small', null, 'DESKTOP SIGNALS'), h('p', null, '工作区'), h('div', null, '后台任务提醒'), h(PreviewAccountMenu)),
  h('main', null, h('span', { className: 'eyebrow' }, 'DESKTOP NOTIFICATIONS / 桌面提醒'), h('h1', null, '让任务找到你。'), h('p', null, '八个边框锚点，木星状态徽标。前后台一致，不打断正在做的事。'),
    h('div', { className: 'cards' }, ...['top-left', 'top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left'].map((position, i) => h('div', { key: position }, h('span', { className: 'dn-anchor-dot', 'data-position': position }), h('b', null, ['左上角', '顶部中央', '右上角', '右侧中央', '右下角', '底部中央', '左下角', '左侧中央'][i])))),
    h('div', { className: 'fixture' }, h('small', null, '事件链路验收 · 仅使用模拟会话'), ...['complete', 'decision', 'resolve', 'cancel'].map((kind, i) => h('button', { key: kind, onClick: () => { void fetch('/simulate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind }) }) } }, ['模拟正常完成', '模拟等待选择', '模拟已回答', '模拟取消任务'][i])), h(NavigationProbe)),
    h('p', { className: 'muted' }, '原生悬浮提醒会显示在桌面上，窗口和浏览器无需保持前台。'))))
