export type Repository = { path: string; name: string; branch: string; kind: 'repository' | 'submodule' | 'worktree' }
export type RepositoryInventory = { ok: boolean; repositories: Repository[]; truncated: boolean; error?: string; errors?: { path: string; error: string }[] }
export type RepositoryNode = { path: string; name: string; repository?: Repository; children: RepositoryNode[] }

/** Keep directory boundaries, even when a repository contains other repositories. */
export function repositoryTree(repositories: Repository[], rootName: string): RepositoryNode {
  const root: RepositoryNode = { path: '.', name: rootName, children: [] }
  for (const repository of repositories) {
    if (repository.path === '.') { root.repository = repository; continue }
    const parts = repository.path.split('/')
    if (parts.some(part => !part || part === '.' || part === '..')) continue
    let parent = root
    for (let index = 0; index < parts.length; index++) {
      const path = parts.slice(0, index + 1).join('/')
      let child = parent.children.find(item => item.path === path)
      if (!child) { child = { path, name: parts[index]!, children: [] }; parent.children.push(child) }
      parent = child
    }
    parent.repository = repository
  }
  const sort = (node: RepositoryNode) => { node.children.sort((a, b) => a.name.localeCompare(b.name)); node.children.forEach(sort) }
  sort(root)
  return root
}
