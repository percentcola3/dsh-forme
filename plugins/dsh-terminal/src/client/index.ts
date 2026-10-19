import React from 'react'
import { TerminalView } from './terminal-view.ts'
import type { Context } from '@deepseek-ai/cordis'
export const inject = ['slots']
export function apply(ctx: Context): void {
  const slots = ctx.get('slots') as {
    inject(name: string, register: () => () => void): () => void
    register(options: { name: string; id: string; label: string; order: number }, render: (props: { sessionId?: string }) => React.ReactElement): () => void
  }
  ctx.effect(() => slots.inject('conversation.view', () => slots.register(
    { name: 'conversation.view', id: 'dsh-terminal', label: '终端', order: 40 },
    (props: { sessionId?: string }) => React.createElement(TerminalView, { key: props.sessionId, sessionId: props.sessionId }),
  )))
}
