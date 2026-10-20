import React from 'react'

// Original instrument glyphs: straight cuts, open corners and a shared 24-unit grid.
const paths = {
  orbit: 'M21 12a9 9 0 1 1-9-9m3 0h6v6M4 17 20 7M9 9l6 6',
  terminal: 'M3 7V3h18v4M3 17v4h18v-4M6 9l3 3-3 3m6 0h6',
  connect: 'M9 15 6 18m0 0H2m4 0v4M9 7l8 8M7 9l8-8 8 8-8 8zM2 8a14 14 0 0 1 14 14M2 13a9 9 0 0 1 9 9',
  copy: 'M9 7V3h9l3 3v11h-4M4 7h9l4 4v10H4zM13 7v4h4',
  close: 'M6 6l12 12M18 6 6 18',
  chat: 'M3 5h18v12H9l-6 4zM7 9h10m-10 4h6',
  folder: 'M3 7V4h7l3 3h8v13H3zM3 10h18',
  changes: 'M8 3v12m0 0-4-4m4 4 4-4m4-2v12m0-12-4 4m4-4 4 4',
  plus: 'M12 4v16M4 12h16',
  send: 'M12 21V3m-7 7 7-7 7 7M5 18v3h14v-3',
  check: 'M4 12l5 5L20 6',
  focus: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 12h8m-4-4v8',
  minimize: 'M4 17h16',
  maximize: 'M4 4h16v16H4z',
  restore: 'M8 8V3h13v13h-5M3 8h13v13H3z',
} as const
export type IconName = keyof typeof paths

export function MossIcon({ name }: { name: IconName }): React.ReactElement {
  return React.createElement('svg', { className: 'moss-icon', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'square', strokeLinejoin: 'miter', 'aria-hidden': true, focusable: false },
    React.createElement('path', { d: paths[name] }))
}

export function iconURL(name: IconName): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#c5cbd5" stroke-width="1.2"><path d="${paths[name]}"/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}
