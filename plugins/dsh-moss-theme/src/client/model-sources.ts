/** Display-only groups retain original provider and model identities. */
export interface Selection {
  provider: string
  model: string
  reasoningEffort?: string
}

/** Model metadata from the host catalog. */
export interface CatalogModel {
  id: string
  name: string
  description?: string
  reasoning?: { defaultEffort?: string; efforts: readonly { id: string; name: string }[] }
}

/** Original provider catalog. */
export interface ProviderGroup {
  id: string
  name: string
  models: readonly CatalogModel[]
}

/** Display row with its original route. */
export interface SourceRow {
  key: string
  provider: { id: string; name: string }
  model: CatalogModel
}

/** Source group independent of model routing. */
export interface SourceGroup {
  id: string
  name: string
  rows: SourceRow[]
}

const sources = [
  { id: 'official', name: 'DS官方', suffix: ' · DeepSeek' },
  { id: 'dcc', name: 'DCC', suffix: ' · DCC' },
  { id: 'devin', name: 'Devin', suffix: ' · Devin' },
  { id: 'codex', name: 'Codex', suffix: ' · Codex' },
  { id: 'routing', name: '路由组', suffix: ' · routing group' },
] as const

/** Derive display groups without changes to catalog metadata or routes. */
export function groupModelSources(groups: readonly ProviderGroup[]): SourceGroup[] {
  const known = new Map<string, SourceGroup>()
  const other = new Map<string, SourceGroup>()
  for (const provider of groups) {
    for (const model of provider.models) {
      const source = ['deepseek-account', 'deepseek-official', 'deepseek'].includes(provider.id)
        ? sources[0]
        : sources.find(candidate => model.name.endsWith(candidate.suffix))
      const id = source === undefined ? `provider:${provider.id}` : `source:${source.id}`
      const bucket = source === undefined ? other : known
      let group = bucket.get(id)
      if (group === undefined) {
        group = { id, name: source?.name ?? provider.name, rows: [] }
        bucket.set(id, group)
      }
      group.rows.push({
        key: JSON.stringify([provider.id, model.id]),
        provider: { id: provider.id, name: provider.name },
        model,
      })
    }
  }
  return [
    ...sources.flatMap(source => {
      const group = known.get(`source:${source.id}`)
      return group === undefined ? [] : [group]
    }),
    ...other.values(),
  ]
}

/** Match model name, model ID, provider name, or source name without case sensitivity. */
export function filterModelSources(groups: readonly SourceGroup[], query: string): SourceGroup[] {
  const needle = query.trim().toLowerCase()
  return groups.flatMap(group => {
    const rows = group.rows.filter(row => [
      row.model.name, row.model.id, row.provider.name, group.name,
    ].some(value => value.toLowerCase().includes(needle)))
    return rows.length === 0 ? [] : [{ ...group, rows }]
  })
}

/** Compare model routes; absent selections do not identify a model. */
export function sameModel(a: Selection | null | undefined, b: Selection | null | undefined): boolean {
  return a != null && b != null && a.provider === b.provider && a.model === b.model
}

/** Preserve explicit effort on the current route; otherwise use the model default. */
export function rowSelection(row: SourceRow, current?: Selection | null): Selection {
  const route = { provider: row.provider.id, model: row.model.id }
  const effort = sameModel(route, current)
    ? current?.reasoningEffort ?? row.model.reasoning?.defaultEffort
    : row.model.reasoning?.defaultEffort
  return { ...route, ...(effort === undefined ? {} : { reasoningEffort: effort }) }
}
