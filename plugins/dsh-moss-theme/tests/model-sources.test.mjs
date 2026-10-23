import test from 'node:test'
import assert from 'node:assert/strict'
import { groupModelSources, filterModelSources, sameModel, rowSelection } from '../src/client/model-sources.ts'

const provider = (id, name, models) => ({ id, name, models })
const model = (id, name, extra = {}) => ({ id, name, ...extra })

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

test('orders sources and merges protocols without changes to model metadata', () => {
  const input = freeze([
    provider('magpie-responses', 'Magpie Responses', [model('c', 'GPT · Codex'), model('d', 'Claude · DCC')]),
    provider('magpie-messages', 'Magpie Messages', [model('v', 'Claude · Devin'), model('d2', 'Other · DCC'), model('ds', 'DS · DeepSeek'), model('r', 'Auto · routing group')]),
    ...['deepseek-account', 'deepseek-official', 'deepseek'].map(id => provider(id, id, [model('ds', 'DeepSeek')])),
  ])
  const before = JSON.stringify(input)
  const groups = groupModelSources(input)
  assert.deepEqual(groups.map(group => group.name), ['DS官方', 'DCC', 'Devin', 'Codex', '路由组'])
  assert.equal(groups[0].rows.length, 4)
  assert.deepEqual(groups[1].rows.map(row => row.provider.id), ['magpie-responses', 'magpie-messages'])
  assert.strictEqual(groups[3].rows[0].model, input[0].models[0])
  assert.equal(JSON.stringify(input), before)
})

test('keeps unknown sources separate and does not infer source from model family', () => {
  const groups = groupModelSources([
    provider('a', 'Gateway A', [model('gpt', 'GPT'), model('x', 'Claude · Unknown'), model('y', 'Name · DCC extra'), model('z', 'Name · dcc')]),
    provider('b', 'Gateway B', [model('gpt', 'GPT')]),
    provider('empty', 'Empty', []),
  ])
  assert.deepEqual(groups.map(group => group.name), ['Gateway A', 'Gateway B'])
  assert.equal(groups[0].rows.length, 4)
})

test('keeps duplicate names and IDs across providers with distinct unambiguous keys', () => {
  const groups = groupModelSources([
    provider('a/b', 'A', [model('c', 'Same · DCC')]),
    provider('a', 'B', [model('b/c', 'Same · DCC'), model('c', 'Same · DCC')]),
  ])
  const rows = groups[0].rows
  assert.equal(rows.length, 3)
  assert.equal(new Set(rows.map(row => row.key)).size, 3)
  assert.deepEqual(rows.map(row => row.model.name), Array(3).fill('Same · DCC'))
})

test('searches names, IDs, providers, and source labels and removes empty groups', () => {
  const groups = freeze(groupModelSources([
    provider('p', 'Protocol One', [model('route-special', 'Alpha · DCC'), model('b', 'Beta · Codex')]),
    provider('q', 'Second', [model('c', 'Gamma · Devin')]),
  ]))
  assert.deepEqual(filterModelSources(groups, ' ALPHA ').map(g => g.name), ['DCC'])
  assert.equal(filterModelSources(groups, 'ROUTE-SPECIAL')[0].rows[0].model.id, 'route-special')
  assert.deepEqual(filterModelSources(groups, 'protocol').map(g => g.name), ['DCC', 'Codex'])
  assert.equal(filterModelSources(groups, 'devin')[0].name, 'Devin')
  assert.deepEqual(filterModelSources(groups, 'absent'), [])
  assert.deepEqual(filterModelSources(groups, ' '), groups)
  assert.deepEqual(filterModelSources([], ''), [])
})

test('compares full routes independently of effort', () => {
  const current = { provider: 'a', model: 'm', reasoningEffort: 'high' }
  assert.equal(sameModel(current, { provider: 'a', model: 'm' }), true)
  assert.equal(sameModel(current, { provider: 'b', model: 'm' }), false)
  assert.equal(sameModel(current, { provider: 'a', model: 'n' }), false)
  assert.equal(sameModel(null, null), false)
  assert.equal(sameModel(undefined, current), false)
})

test('submits original routes and preserves current effort or uses model default', () => {
  const metadata = freeze(model('original/model', 'Name · Codex', {
    description: 'Keep this', reasoning: { defaultEffort: 'medium', efforts: [{ id: 'high', name: 'High' }] },
  }))
  const row = groupModelSources([provider('original/provider', 'Original', [metadata])])[0].rows[0]
  const route = { provider: 'original/provider', model: 'original/model' }
  const current = freeze({ ...route, reasoningEffort: 'high' })
  assert.deepEqual(rowSelection(row, current), current)
  assert.deepEqual(rowSelection(row), { ...route, reasoningEffort: 'medium' })
  assert.deepEqual(rowSelection(row, { provider: 'other', model: route.model, reasoningEffort: 'high' }), { ...route, reasoningEffort: 'medium' })
  assert.deepEqual(rowSelection(row, route), { ...route, reasoningEffort: 'medium' })
  assert.strictEqual(row.model.reasoning, metadata.reasoning)
  const plain = groupModelSources([provider('plain', 'Plain', [model('m', 'M')])])[0].rows[0]
  assert.deepEqual(rowSelection(plain), { provider: 'plain', model: 'm' })
})
