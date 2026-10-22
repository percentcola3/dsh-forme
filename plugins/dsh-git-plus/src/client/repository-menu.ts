import React from 'react'
import { post } from './requests.ts'
import { repositoryTree, type RepositoryInventory, type RepositoryNode } from './repository-tree.ts'
const h = React.createElement
export type Workspace = { sessionId: string; cwd: string }
type Branch = { name: string; current: boolean; kind?: 'local' | 'remote' }

export function RepositoryMenu({ loc, inventory, loading, error, refresh }: {
  loc: Workspace; inventory: RepositoryInventory | null; loading: boolean; error: string; refresh(): Promise<void>
}): React.ReactElement {
  const tree = repositoryTree(inventory?.repositories ?? [], loc.cwd.split('/').filter(Boolean).at(-1) || loc.cwd)
  const [pickerPath, setPickerPath] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const lock = React.useRef(false)
  const active = React.useRef(true)
  React.useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const acquire = () => { if (lock.current) return false; lock.current = true; setBusy(true); return true }
  const release = () => { lock.current = false; if (active.current) setBusy(false) }
  return h('div', { className: 'dgp-repository-menu' },
    h('div', { className: 'dgp-repository-heading' }, h('strong', null, `仓库与分支 · ${inventory?.repositories.length ?? 0}`), h('button', { type: 'button', disabled: busy || loading, onClick: () => { void refresh() } }, loading ? '检测中…' : '重新检测')),
    error && h('p', { className: 'dgp-error', role: 'alert' }, error),
    inventory?.truncated && h('p', { className: 'dgp-hint', role: 'status' }, '检测达到范围或时间限制，仅显示已发现的仓库；可进入子目录继续查看。'),
    !!inventory?.errors?.length && h('p', { className: 'dgp-hint', title: inventory.errors.map(item => `${item.path}: ${item.error}`).join('\n') }, '部分目录无法读取，检测结果可能不完整。'),
    inventory?.repositories.length ? h('ul', { className: 'dgp-repository-tree', 'aria-label': '目录、仓库与分支' },
      h(TreeNode, { node: tree, loc, root: true, busy, acquire, release, refresh, pickerPath, setPickerPath }))
      : h('p', { className: 'dgp-hint' }, loading ? '正在检测仓库…' : '当前目录范围内没有发现可管理的 Git 仓库。'),
    h('p', { className: 'dgp-hint' }, '点击右侧分支名切换分支，仅作用于该仓库。'))
}

type NodeProps = { node: RepositoryNode; loc: Workspace; root?: boolean; pickerPath: string | null; setPickerPath(path: string | null): void; busy: boolean; acquire(): boolean; release(): void; refresh(): Promise<void> }
function TreeNode(props: NodeProps): React.ReactElement {
  const { node, loc, root, busy, acquire, release, refresh, pickerPath, setPickerPath } = props
  const [expanded, setExpanded] = React.useState(Boolean(root) || !node.repository)
  const trigger = React.useRef<{ focus(): void }>(null)
  const repo = node.repository
  const hasChildren = node.children.length > 0
  const open = !!repo && pickerPath === repo.path
  const wasOpen = React.useRef(open)
  React.useEffect(() => {
    if (busy) return
    if (wasOpen.current && !open) trigger.current?.focus()
    wasOpen.current = open
  }, [open, busy])
  const close = () => setPickerPath(null)
  return h('li', { className: 'dgp-repository-node' },
    h('div', { className: 'dgp-repository-row' },
      h('button', { type: 'button', className: 'dgp-repository-toggle', disabled: busy,
        'aria-expanded': hasChildren ? expanded : undefined,
        title: node.path, onClick: () => hasChildren ? setExpanded(value => !value) : repo && setPickerPath(open ? null : repo.path) },
        h('span', { className: 'dgp-repository-chevron', 'aria-hidden': true }, hasChildren ? expanded ? '▾' : '▸' : '·'),
        h('span', { className: 'dgp-repository-name' }, node.name),
        repo && h('span', { className: 'dgp-repository-kind' }, repo.kind === 'submodule' ? '子模块' : repo.kind === 'worktree' ? '工作树' : 'Git')),
      repo && h('button', { ref: trigger, type: 'button', className: 'dgp-repository-current', disabled: busy,
        'aria-label': `切换 ${node.name} 的分支，当前 ${repo.branch}`, 'aria-expanded': open,
        title: `${node.path} · ${repo.branch} · 点击切换分支`, onClick: () => setPickerPath(open ? null : repo.path) },
        h('span', null, repo.branch), h('span', { 'aria-hidden': true }, '⌄'))),
    open && repo && h(RepositoryBranches, { key: repo.path, repositoryPath: repo.path, branch: repo.branch, loc, busy, acquire, release, refresh, close }),
    expanded && hasChildren && h('ul', null, ...node.children.map(child => h(TreeNode, { ...props, key: child.path, node: child, root: false }))))
}

function RepositoryBranches({ repositoryPath, branch, loc, busy, acquire, release, refresh, close }: {
  repositoryPath: string; branch: string; loc: Workspace; busy: boolean; acquire(): boolean; release(): void; refresh(): Promise<void>; close(): void
}): React.ReactElement {
  const [query, setQuery] = React.useState('')
  const [branches, setBranches] = React.useState<Branch[]>([])
  const [error, setError] = React.useState('')
  const [ready, setReady] = React.useState(false)
  const [switching, setSwitching] = React.useState('')
  const active = React.useRef(true)
  const sequence = React.useRef(0)
  React.useEffect(() => { active.current = true; return () => { active.current = false; sequence.current++ } }, [])
  const reload = React.useCallback(async () => {
    const ticket = ++sequence.current
    setReady(false)
    try {
      const value = await post<{ ok: boolean; branches?: Branch[]; error?: string }>('/dsh-git-plus/branches', { ...loc, repositoryPath })
      if (!active.current || ticket !== sequence.current) return
      if (!value.ok) throw new Error(value.error || '无法读取分支')
      setBranches(value.branches ?? []); setError('')
    } catch (reason) { if (active.current && ticket === sequence.current) setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { if (active.current && ticket === sequence.current) setReady(true) }
  }, [loc.sessionId, loc.cwd, repositoryPath])
  React.useEffect(() => { void reload() }, [reload, branch])
  const switchTo = async (target: Branch) => {
    if (!acquire()) return
    setSwitching(`${target.kind ?? 'local'}:${target.name}`); setError('')
    try {
      const result = await post<{ ok: boolean; error?: string }>('/dsh-git-plus/switch', { ...loc, repositoryPath, branch: target.name, kind: target.kind ?? 'local' })
      if (!result.ok) throw new Error(result.error || '分支切换失败')
      if (active.current) await reload()
      await refresh()
      if (active.current) close()
    } catch (reason) { if (active.current) setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { release(); if (active.current) setSwitching('') }
  }
  const filtered = branches.filter(item => item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  return h('div', { className: 'dgp-repository-branches', onKeyDown: (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && !busy) { event.preventDefault(); event.stopPropagation(); close() }
  } },
    h('input', { className: 'dgp-branch-search', type: 'search', value: query, disabled: busy,
      placeholder: '搜索本地 / 远程分支…', 'aria-label': `搜索 ${repositoryPath} 的分支`,
      onChange: (event: React.ChangeEvent<{ value: string }>) => setQuery(event.target.value) }),
    error && h('p', { className: 'dgp-error', role: 'alert' }, error),
    !ready ? h('p', { className: 'dgp-hint' }, '加载分支…') : branches.length === 0 ? h('p', { className: 'dgp-hint' }, '暂无分支（可能尚未创建首次提交）') :
      !filtered.length ? h('p', { className: 'dgp-hint' }, '没有匹配的分支') :
      h('ul', { className: 'dgp-branch-results' }, ...filtered.map(item => h('li', { key: `${item.kind ?? 'local'}:${item.name}` }, h('button', {
        type: 'button', className: 'dgp-branch', 'aria-current': item.current ? 'true' : undefined,
        title: `${repositoryPath} → ${item.name}${item.kind === 'remote' ? '（创建本地跟踪分支并切换）' : ''}`,
        disabled: busy || item.current, onClick: () => { void switchTo(item) },
      }, h('span', null, item.name), h('span', null, switching === `${item.kind ?? 'local'}:${item.name}` ? '切换中…' : item.current ? '当前' : item.kind === 'remote' ? '远程 · 检出' : '切换'))))),
    ready && branches.some(item => item.kind === 'remote') && h('p', { className: 'dgp-hint' }, '远程分支检出时创建本地跟踪分支。'),
    error && h('button', { type: 'button', disabled: busy, onClick: () => { void reload() } }, '重试读取分支'))
}
