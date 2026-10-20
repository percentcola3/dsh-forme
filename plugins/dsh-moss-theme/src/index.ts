import type { Context } from '@deepseek-ai/cordis'
import { bootCSS, bootScript } from './boot-brand.ts'

export const name = 'dsh-moss-theme'
type BootIndexContext = { on(event: 'webserver/index-inject', listener: (table: unknown[]) => void): unknown }

/** Supply the identity before browser plugin activation, including Desktop's boot carrier. */
export function apply(ctx: Context): void {
  const host = ctx as unknown as BootIndexContext
  host.on('webserver/index-inject', table => {
    table.push({ kind: 'style', text: bootCSS }, { kind: 'script', placement: 'body', text: bootScript })
  })
}
