import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RepositoryMenu } from './repository-menu.ts'
import type { RepositoryInventory } from './repository-tree.ts'

const inventory: RepositoryInventory = {
  ok: true, truncated: true,
  repositories: [
    { path: '.', name: 'SaaS-AI-Work', branch: 'master', kind: 'repository' },
    { path: 'food-saas-ai-plugin', name: 'food-saas-ai-plugin', branch: 'master', kind: 'repository' },
    { path: 'food-saas-projects/frontend/saasb-kds', name: 'saasb-kds', branch: 'feature/kds', kind: 'repository' },
  ],
}

const markup = (refreshCalls = 0) => renderToStaticMarkup(React.createElement(RepositoryMenu, {
  loc: { sessionId: 's1', cwd: '/work/SaaS-AI-Work' }, inventory, loading: false, error: '',
  refresh: async () => { refreshCalls++ },
}))

test('repository tree stays compact, counts repositories, and drops active decorations', () => {
  const html = markup()
  assert.match(html, /仓库与分支 · 3/)
  assert.match(html, /仅显示已发现的仓库/)
  // One row per directory node, and one branch switch button per repository.
  assert.equal((html.match(/dgp-repository-toggle/g) ?? []).length, 5)
  assert.equal((html.match(/dgp-repository-current/g) ?? []).length, 3)
  assert.equal((html.match(/dgp-branch-on/g) ?? []).length, 0)
  assert.equal((html.match(/box-shadow/g) ?? []).length, 0)
})

test('each repository exposes an explicit branch switch affordance', () => {
  const html = markup()
  assert.match(html, /切换 SaaS-AI-Work 的分支，当前 master/)
  assert.match(html, /切换 saasb-kds 的分支，当前 feature\/kds/)
  assert.match(html, /aria-expanded="false"/)
  assert.match(html, /点击右侧分支名切换分支/)
})
