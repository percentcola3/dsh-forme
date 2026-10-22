import type { createGitRunner } from './git.ts'

type Git = ReturnType<typeof createGitRunner>
export type BranchKind = 'local' | 'remote'

export async function listBranches(git: Git, cwd: string) {
  const result = await git(cwd, ['for-each-ref', '--sort=-committerdate', '--format=%(refname)%09%(HEAD)%09%(symref)', 'refs/heads/', 'refs/remotes/'])
  if (result.code !== 0) return { ok: false as const, error: result.stderr.trim() || '无法列出分支' }
  const branches = result.stdout.split('\n').filter(Boolean).flatMap(line => {
    const [ref, head, symbolic] = line.split('\t')
    const remote = ref.startsWith('refs/remotes/')
    // Remote HEAD is an alias, not a branch that can be selected explicitly.
    if (remote && symbolic) return []
    return [{ name: ref.slice(remote ? 'refs/remotes/'.length : 'refs/heads/'.length), current: !remote && head === '*', kind: remote ? 'remote' as const : 'local' as const }]
  })
  return { ok: true as const, branches }
}

export async function switchBranch(git: Git, cwd: string, branch: string, kind: BranchKind = 'local') {
  const ref = `${kind === 'remote' ? 'refs/remotes/' : 'refs/heads/'}${branch}`
  // Validate a literal ref: never accept checkout shortcuts such as @{-1}.
  if (!branch || branch.startsWith('-') || (await git(cwd, ['check-ref-format', ref])).code !== 0) {
    return { ok: false as const, error: '无效的分支名称' }
  }
  const exists = await git(cwd, ['show-ref', '--verify', '--quiet', ref])
  if (exists.code !== 0) return { ok: false as const, error: `分支不存在：${branch}。请重新打开分支菜单。` }
  let localBranch = branch
  let trackingRemote: string | undefined
  let args = ['switch', '--no-guess', '--', branch]
  if (kind === 'remote') {
    const symbolic = await git(cwd, ['symbolic-ref', '--quiet', ref])
    if (symbolic.code === 0) return { ok: false as const, error: '不能切换到远程符号引用，请选择具体分支。' }
    const remotes = await git(cwd, ['remote'])
    if (remotes.code !== 0) return { ok: false as const, error: remotes.stderr.trim() || '无法读取远程仓库' }
    const remote = remotes.stdout.split('\n').filter(name => name && branch.startsWith(`${name}/`)).sort((a, b) => b.length - a.length)[0]
    if (!remote) return { ok: false as const, error: `找不到远程分支对应的远程仓库：${branch}` }
    localBranch = branch.slice(remote.length + 1)
    if (localBranch.startsWith('-') || (await git(cwd, ['check-ref-format', `refs/heads/${localBranch}`])).code !== 0) {
      return { ok: false as const, error: '远程分支无法转换为有效的本地分支名称' }
    }
    const localExists = await git(cwd, ['show-ref', '--verify', '--quiet', `refs/heads/${localBranch}`])
    if (localExists.code === 0) return { ok: false as const, error: `本地分支已存在：${localBranch}。请选择本地分支，或使用 Git 检查其上游。` }
    // --create is transactional: a failed checkout does not create the local branch.
    // Set the upstream explicitly below: Git's automatic matching is ambiguous
    // when remotes such as origin and origin/team have overlapping namespaces.
    trackingRemote = remote
    args = ['switch', '--no-guess', '--create', localBranch, '--no-track', '--', ref]
  }
  const result = await git(cwd, args)
  if (result.code !== 0) return { ok: false as const, error: (result.stderr || result.stdout).trim() || `无法切换到 ${branch}` }
  if (trackingRemote) {
    for (const [key, value] of [['remote', trackingRemote], ['merge', `refs/heads/${localBranch}`]]) {
      const configured = await git(cwd, ['config', '--local', '--replace-all', `branch.${localBranch}.${key}`, value])
      if (configured.code !== 0) return { ok: false as const, error: `已切换到 ${localBranch}，但设置上游失败：${configured.stderr.trim()}` }
    }
  }
  return { ok: true as const, branch: localBranch }
}
