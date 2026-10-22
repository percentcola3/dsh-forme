import React from 'react'
import { statusText, type MossStatus } from './state.ts'
import { mountEngine } from './engine-renderer.ts'
const h = React.createElement

/** A small industrial engine, driven only by the selected session's real status. */
export function EngineIndicator({ status }: { status: MossStatus }): React.ReactElement {
  const canvas = React.useRef<HTMLCanvasElement>(null)
  React.useEffect(() => canvas.current ? mountEngine(canvas.current) : undefined, [])
  const description = `土星状态 · ${statusText[status].label}。${statusText[status].message}`
  return h('span', { className: 'moss-status-indicator moss-engine', 'data-status': status, role: 'img', 'aria-label': description, title: description },
    h('canvas', { ref: canvas, className: 'moss-engine-canvas', width: 64, height: 64, 'data-status': status, 'aria-hidden': true }),
    h('svg', { className: 'moss-engine-art', viewBox: '0 0 40 32', width: 40, height: 32, fill: 'none', 'aria-hidden': true, focusable: false },
      h('circle', { className: 'moss-engine-corona', cx: 20, cy: 16, r: 10.5 }),
      h('g', { transform: 'rotate(-17.2 20 16)' },
        h('ellipse', { className: 'moss-engine-ring-back', cx: 20, cy: 16, rx: 13.5, ry: 4.05 }),
        h('ellipse', { className: 'moss-engine-ring-outer', cx: 20, cy: 16, rx: 16.4, ry: 4.9 })),
      h('circle', { className: 'moss-engine-plasma', cx: 20, cy: 16, r: 8 }),
      h('path', { className: 'moss-engine-filament', d: 'M13.2 13.4Q20 12.2 26.8 13.4M12.6 15.8Q20 15 27.4 15.8M13.4 18.4Q20 17.7 26.6 18.4' }),
      h('g', { transform: 'rotate(-17.2 20 16)' },
        h('path', { className: 'moss-engine-ring-front', d: 'M6.5 16A13.5 4.05 0 0 0 33.5 16' }),
        h('path', { className: 'moss-engine-ring-outer', d: 'M3.6 16A16.4 4.9 0 0 0 36.4 16' })),
      h('g', { className: 'moss-engine-pause', transform: 'translate(28 2.5) scale(.5)' }, h('path', { d: 'M4 2V10M10 2V10' })),
      h('g', { className: 'moss-engine-fault', transform: 'translate(28 2.5) scale(.5)' }, h('path', { d: 'M7 1L13 11H1Z' }), h('path', { d: 'M7 4.4V7.2M7 8.8V9' })),
      h('path', { className: 'moss-engine-disconnected', transform: 'translate(28 2.5) scale(.5)', d: 'M1 2L5.5 6.5M8.5 9.5L13 14M3 8L11 2' })))
}
