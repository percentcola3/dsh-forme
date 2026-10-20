import React from 'react'
import { LOGO_URL } from '../brand-art.ts'

export function BrandMark({ className = '' }: { className?: string }): React.ReactElement {
  return React.createElement('img', { className: `moss-brand-logo ${className}`, src: LOGO_URL, alt: '550W', draggable: false })
}

export function SidebarBrand(): React.ReactElement {
  return React.createElement('span', { className: 'moss-sidebar-brand' },
    React.createElement(BrandMark))
}
