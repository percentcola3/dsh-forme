import type { Context } from '@deepseek-ai/cordis'
import { markdownCSS } from './markdown-styles.ts'

export const name = 'dsh-markdown-preview'

/** Limit prose changes to official Markdown documents and remove them on unload. */
export function apply(ctx: Context): void {
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = name
    style.textContent = markdownCSS
    document.head.appendChild(style)
    return () => style.remove()
  })
}
