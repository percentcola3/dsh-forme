import React from 'react'

export type Department = 'ueg' | 'gabon' | 'flight'
type Part = { d: string; stroke?: string; strokeWidth?: number; fill?: string; transform?: string }

// Optical reductions of the film's insignia on a 24-unit grid. The polar grid,
// laurel branches and SCC's split circle survive at sidebar sizes; seal text does not.
const globe: Part[] = [
  { d: 'M18.2 10.4a6.2 6.2 0 1 1-12.4 0 6.2 6.2 0 0 1 12.4 0ZM16 10.4a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM13.7 10.4a1.7 1.7 0 1 1-3.4 0 1.7 1.7 0 0 1 3.4 0ZM12 4.2v4.5m0 3.4v4.5M5.8 10.4h4.5m3.4 0h4.5M7.6 6l3.2 3.2m2.4 2.4 3.2 3.2M16.4 6l-3.2 3.2m-2.4 2.4-3.2 3.2', stroke: 'currentColor', strokeWidth: .65, fill: 'none' },
  { d: 'M12.9 4.9l2.3.4 1.2 1.5-.6 1.7-1.3-.4-.7-1.3-1.5.2-.8-.8zM17.2 8.1l.6 1.6-.6 2.8-1.6 1.5-.7-1.4.8-1.5-.4-1.1zM6.7 9l1.1-.3.7 1.1-.7 1.3.4 1.7 1 .8-.3 1.1-1.4-1.3-.9-2.1zM11 10.2l.9-.4 1.1.4.1 1.1-1.1.6-1-.8z' },
]
const laurel: Part[] = [
  { d: 'M11.5 20.3C5.4 20.2 2.4 15 3.3 8M12.5 20.3C18.6 20.2 21.6 15 20.7 8M9.5 22l3-2m2 2-3-2', stroke: 'currentColor', strokeWidth: .8, fill: 'none' },
  { d: 'M3.6 8.2Q1.7 6.1 4.7 3.7Q4.8 6.1 3.6 8.2ZM3.1 11.8Q.3 10.2 1.8 7.3Q3.4 8.8 3.1 11.8ZM3.7 15Q.8 14.5 1.1 11.3Q3.1 12.3 3.7 15ZM5.6 17.8Q2.6 18.2 1.9 15.2Q4.2 15.5 5.6 17.8ZM8.5 19.7Q5.7 21.2 3.8 18.7Q6.3 18.1 8.5 19.7ZM3.9 11.3Q3.5 8.5 5.8 7.3Q5.7 9.7 3.9 11.3ZM4.5 14.8Q3.7 12.3 5.7 10.6Q6 13 4.5 14.8ZM6.3 17.4Q4.8 15.3 6 13.1Q7.1 15.2 6.3 17.4ZM9 19Q6.6 18.1 7.1 15.7Q9 17 9 19Z' },
  { d: 'M3.6 8.2Q1.7 6.1 4.7 3.7Q4.8 6.1 3.6 8.2ZM3.1 11.8Q.3 10.2 1.8 7.3Q3.4 8.8 3.1 11.8ZM3.7 15Q.8 14.5 1.1 11.3Q3.1 12.3 3.7 15ZM5.6 17.8Q2.6 18.2 1.9 15.2Q4.2 15.5 5.6 17.8ZM8.5 19.7Q5.7 21.2 3.8 18.7Q6.3 18.1 8.5 19.7ZM3.9 11.3Q3.5 8.5 5.8 7.3Q5.7 9.7 3.9 11.3ZM4.5 14.8Q3.7 12.3 5.7 10.6Q6 13 4.5 14.8ZM6.3 17.4Q4.8 15.3 6 13.1Q7.1 15.2 6.3 17.4ZM9 19Q6.6 18.1 7.1 15.7Q9 17 9 19Z', transform: 'translate(24 0) scale(-1 1)' },
]
const insignia: Record<Department, Part[]> = {
  ueg: [...globe, ...laurel],
  gabon: [
    { d: 'M23 12a11 11 0 1 1-22 0 11 11 0 0 1 22 0Z', stroke: 'currentColor', strokeWidth: 1, fill: 'none' },
    { d: 'M12 2.7v.7m0 17.2v.7M2.7 12h.7m17.2 0h.7', stroke: 'currentColor', strokeWidth: .9, fill: 'none' },
    // Keep the base seal's inner UEG badge, without its tiny lettering ring.
    ...[...globe, ...laurel].map(part => ({ ...part, transform: `translate(3.12 3.12) scale(.74) ${part.transform ?? ''}`.trim() })),
  ],
  flight: [
    { d: 'M11.4 1.3A10.7 10.7 0 0 0 2.6 17l1.7-1.1A8.7 8.7 0 0 1 9.6 3.6v18.8h1.8zM12.6 1.3A10.7 10.7 0 0 1 21.4 17l-1.7-1.1A8.7 8.7 0 0 0 12.6 3.4zM8.5 6.2l-1.9.6c0 5.6-1.4 8.7-4 10.5a10.7 10.7 0 0 0 5.8 4.8v-2.2a8.6 8.6 0 0 1-2.9-2.2C7.7 15.5 8.5 11.3 8.5 6.2ZM12.6 6.2l1.8.6c0 5.6 1.4 8.7 4.1 10.5a8.6 8.6 0 0 1-4.1 2.8V7l-1.8-.6v16a10.7 10.7 0 0 0 8.8-5.1c-5-3.2-6.1-6.3-6.1-10.5z' },
  ],
}

export function DepartmentIcon({ name, size = 18 }: { name: Department; size?: number }): React.ReactElement {
  return React.createElement('svg', { className: 'moss-department-icon', 'data-moss-department': name, width: size, height: size, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true, focusable: false },
    ...insignia[name].map((part, key) => React.createElement('path', { key, ...part })))
}

export function departmentURL(name: Department): string {
  const parts = insignia[name].map(part => `<path d="${part.d}"${part.fill ? ` fill="${part.fill}"` : ''}${part.stroke ? ' stroke="currentColor"' : ''}${part.strokeWidth ? ` stroke-width="${part.strokeWidth}"` : ''}${part.transform ? ` transform="${part.transform}"` : ''}/>`).join('')
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">${parts}</svg>`)}")`
}
