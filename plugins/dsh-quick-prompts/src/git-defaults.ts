import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import type { Prompt } from './types.ts'

const exec = promisify(execFile)
/** Probe only the server-resolved project; inherited Git overrides must not redirect it. */
export async function isGitWorktree(cwd: string): Promise<boolean> {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')))
  try {
    const result = await exec('git', ['rev-parse', '--is-inside-work-tree'], { cwd, env, timeout: 5_000, maxBuffer: 16_384, windowsHide: true })
    return result.stdout.trim() === 'true'
  } catch { return false }
}

// Keep the exact legacy texts to distinguish automatic defaults from user edits.
const legacyCommit = '检查当前项目的 Git 状态和差异。优先审阅并提交现有已暂存改动，尊重暂存范围，不自动加入未暂存文件；若没有暂存改动，审阅当前工作区，在改动范围明确时选择相关改动提交。排除密钥、凭据及无关改动，保留其他未提交内容；若混杂无关改动或敏感内容且无法确定提交范围，先向用户澄清。运行适当的检查，使用准确简洁的提交说明完成提交，并报告结果。没有可提交改动时说明情况。不要推送。沿用原生权限与审批流程。'
const legacyPush = '检查当前项目的 Git 分支、上游、远程仓库及待推送提交，然后将当前分支已有的提交正常推送到明确的目标。不要创建提交，不要强制推送，不要改写历史或丢弃工作区改动。若目标、权限或当前分支状态不明确，先向用户澄清；没有待推送提交时说明情况。报告推送结果，沿用原生权限与审批流程。'
const pushText = '检查当前项目的 Git 状态、差异、分支、上游及远程仓库。先审阅并提交改动，再将当前分支的待推送提交正常推送到明确的目标。优先处理已有暂存改动，尊重暂存范围，不自动加入未暂存文件；若没有暂存改动，在改动范围明确时选择相关改动提交。排除密钥、凭据及无关改动，保留其他未提交内容；若提交范围或推送目标不明确，先向用户澄清。运行适当的检查，使用准确简洁的提交说明。没有可提交改动时仍检查并推送已有待推送提交；没有待推送提交时说明情况。提交或检查失败时停止，不继续推送。不要强制推送，不要改写历史或丢弃工作区改动。报告提交和推送结果，沿用原生权限与审批流程。'

export function gitDefaults(): Prompt[] {
  return [{ id: randomUUID(), name: '推送', gitOnly: true, text: pushText }]
}

/** Migrate only untouched automatic entries; never recreate a deleted default. */
export function migrateGitDefaults(prompts: Prompt[]): Prompt[] {
  return prompts.flatMap(prompt => {
    if (!prompt.gitOnly || prompt.model !== undefined) return [prompt]
    if (prompt.name === '提交' && prompt.text === legacyCommit) return []
    if (prompt.name === '推送' && prompt.text === legacyPush) return [{ ...prompt, text: pushText }]
    return [prompt]
  })
}
