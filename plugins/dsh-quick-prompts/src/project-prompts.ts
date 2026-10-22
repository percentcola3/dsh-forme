import { createHash, randomUUID } from 'node:crypto'
import { realpath } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { gitDefaults, isGitWorktree, migrateGitDefaults } from './git-defaults.ts'
import { PromptStore } from './prompt-store.ts'
import type { Prompt } from './types.ts'
export type Project = { id: string; cwd: string }
type Record = { id: string; cwd: string; prompts: Prompt[]; importedLegacy?: boolean; initializedGitDefaults?: boolean; gitDefaultsVersion?: number }
export async function projectOf(cwd: string | undefined): Promise<Project> {
  if (!cwd || !isAbsolute(cwd)) throw new Error('请先打开有项目目录的主会话。')
  const path = await realpath(cwd)
  return { id: createHash('sha256').update(path).digest('hex'), cwd: path }
}
/** One atomic catalog, with independent prompt arrays keyed by canonical directory. */
export class ProjectPrompts {
  private catalog: PromptStore<Record>
  private legacy: PromptStore<Prompt>
  constructor(directory: string) {
    this.catalog = new PromptStore(join(directory, 'quick-prompts.projects.json'))
    this.legacy = new PromptStore(join(directory, 'quick-prompts.json'))
  }
  async list(project: Project) {
    const git = await isGitWorktree(project.cwd)
    let records = await this.catalog.read()
    const current = records.find(item => item.id === project.id)
    if (git && (!current?.initializedGitDefaults || (current.gitDefaultsVersion ?? 1) < 2)) {
      records = await this.catalog.update(records => {
        let record = records.find(item => item.id === project.id)
        if (!record) { record = { ...project, prompts: [] }; records.push(record) }
        if (!record.initializedGitDefaults) {
          record.prompts.push(...gitDefaults())
          record.initializedGitDefaults = true
          record.gitDefaultsVersion = 2
        } else if ((record.gitDefaultsVersion ?? 1) < 2) {
          record.prompts = migrateGitDefaults(record.prompts)
          record.gitDefaultsVersion = 2
        }
      })
    }
    return { prompts: (records.find(item => item.id === project.id)?.prompts ?? []).filter(prompt => !prompt.gitOnly || git), legacyAvailable: !records.some(item => item.importedLegacy) && (await this.legacy.read()).length > 0 }
  }
  async change(project: Project, action: string, body: { id?: string; name?: unknown; text?: unknown; model?: unknown }, validate: (value: typeof body) => Omit<Prompt, 'id'>) {
    await this.list(project)
    const legacy = action === 'import' ? (await this.legacy.read()).map(item => ({ id: randomUUID(), ...validate(item) })) : []
    await this.catalog.update(records => {
      let record = records.find(item => item.id === project.id)
      if (!record) { record = { ...project, prompts: [] }; records.push(record) }
      const items = record.prompts
      const index = items.findIndex(item => item.id === body.id)
      if (action === 'import') {
        if (records.some(item => item.importedLegacy)) throw new Error('旧指令已导入其他项目。')
        if (!legacy.length) throw new Error('没有可导入的旧指令。')
        if (items.filter(item => !item.gitOnly).length + legacy.length > 100) throw new Error('每个项目最多保存 100 条快捷任务。')
        items.push(...legacy); record.importedLegacy = true
      } else if (action === 'save') {
        const value = validate(body)
        if (body.id && index < 0) throw new Error('快捷任务不属于当前项目或已删除，请刷新。')
        if (index >= 0) {
          const { model: _previousModel, ...previous } = items[index]!
          items[index] = { ...previous, ...value }
        }
        else { if (items.filter(item => !item.gitOnly).length >= 100) throw new Error('每个项目最多保存 100 条快捷任务。'); items.push({ id: randomUUID(), ...value }) }
      } else if (action === 'delete') {
        if (index < 0) throw new Error('快捷任务不属于当前项目或已删除。')
        items.splice(index, 1)
      } else throw new Error('未知操作。')
    })
    return this.list(project)
  }
}
