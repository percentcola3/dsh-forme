import React from 'react'
import { createRoot } from 'react-dom/client'
import { RepositoryMenu } from '../src/client/repository-menu.ts'
import { repositoryStyles } from '../src/client/repository-styles.ts'
const h = React.createElement
const style = document.createElement('style'); style.textContent = repositoryStyles; document.head.appendChild(style)
const inventory = {
  ok: true, truncated: true, errors: [],
  repositories: [
    { path: '.', name: 'SaaS-AI-Work', branch: 'master', kind: 'repository' as const },
    { path: 'assets', name: 'assets', branch: 'main', kind: 'repository' as const },
    { path: 'food-saas-ai-plugin', name: 'food-saas-ai-plugin', branch: 'master', kind: 'repository' as const },
    { path: 'food-saas-knowledge', name: 'food-saas-knowledge', branch: 'master', kind: 'repository' as const },
    { path: 'food-saas-projects/_local-runner', name: '_local-runner', branch: 'master', kind: 'repository' as const },
    { path: 'food-saas-projects/frontend/saas-crm-atr-i18n', name: 'saas-crm-atr-i18n', branch: 'master', kind: 'repository' as const },
    { path: 'food-saas-projects/frontend/saasb-kds', name: 'saasb-kds', branch: 'master', kind: 'repository' as const },
  ],
}
const branchesFor: Record<string, { name: string; current: boolean; kind?: 'local' | 'remote' }[]> = {
  '.': [
    { name: 'master', current: true, kind: 'local' },
    { name: 'feature/atlas', current: false, kind: 'local' },
    { name: 'origin/feature/atlas', current: false, kind: 'remote' },
    { name: 'origin/release/24.10', current: false, kind: 'remote' },
  ],
  assets: [
    { name: 'main', current: true, kind: 'local' },
    { name: 'origin/main', current: false, kind: 'remote' },
  ],
}
let log: string[] = []
const render = () => createRoot(document.querySelector('#root')!).render(h(RepositoryMenu, {
  loc: { sessionId: 'preview', cwd: '/work/SaaS-AI-Work' }, inventory, loading: false, error: '',
  refresh: async () => { log = [...log, 'refresh']; document.querySelector('#log')!.textContent = log.join('\n') || '（无操作）' },
}))
const realFetch = window.fetch
window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body ?? '{}'))
  await new Promise(resolve => setTimeout(resolve, 120))
  if (String(input).endsWith('/branches')) {
    return new Response(JSON.stringify({ ok: true, branches: branchesFor[body.repositoryPath] ?? [{ name: 'master', current: true, kind: 'local' }] }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  if (String(input).endsWith('/switch')) {
    log = [...log, `switch ${body.repositoryPath} → ${body.kind ?? 'local'}:${body.branch}`]
    document.querySelector('#log')!.textContent = log.join('\n')
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  return realFetch(input, init)
}) as typeof fetch
render()
