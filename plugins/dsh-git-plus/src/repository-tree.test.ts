import { test } from 'node:test'
import assert from 'node:assert/strict'
import { repositoryTree, type Repository } from './client/repository-tree.ts'
const repo = (path: string, branch = 'main', kind: Repository['kind'] = 'repository'): Repository => ({ path, name: path.split('/').at(-1)!, branch, kind })
test('repository tree preserves parent repositories and directory layers above nested repos', () => {
  const root = repositoryTree([repo('apps/api/vendor/lib', '开发', 'submodule'), repo('.'), repo('apps/api', 'feature'), repo('tools/tool')], 'project')
  assert.equal(root.repository?.path, '.')
  assert.deepEqual(root.children.map(node => node.name), ['apps', 'tools'])
  assert.equal(root.children[0]?.repository, undefined)
  const api = root.children[0]!.children[0]!
  assert.equal(api.repository?.branch, 'feature')
  assert.equal(api.children[0]!.children[0]!.repository?.kind, 'submodule')
  assert.equal(api.children[0]!.children[0]!.repository?.path, 'apps/api/vendor/lib')
})
test('nonrepo parent groups sibling repos and keeps same leaf names distinct', () => {
  const root = repositoryTree([repo('a/app'), repo('b/app', 'other')], 'workspace')
  assert.equal(root.repository, undefined)
  assert.equal(root.children[0]!.children[0]!.path, 'a/app')
  assert.equal(root.children[1]!.children[0]!.path, 'b/app')
})
test('tree never accepts traversal nodes', () => {
  assert.equal(repositoryTree([repo('../outside'), repo('/absolute'), repo('a//b')], 'workspace').children.length, 0)
})
