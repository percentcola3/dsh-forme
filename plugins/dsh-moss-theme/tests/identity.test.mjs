import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { MOSS_PRESET, presetOf } from '../src/client/state.ts'

test('reads the MOSS preset only from the host-recorded session projection', () => {
  assert.equal(presetOf({ projectionValues: { agentPreset: 'moss' } }), MOSS_PRESET)
  assert.equal(presetOf({ projectionValues: { agentPreset: 42 } }), undefined)
  assert.equal(presetOf({}), undefined)
  assert.equal(presetOf(undefined), undefined)
})

test('the bundle patch declares the MOSS preset with a persona that stays honest about its tools', () => {
  const patch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
  assert.match(patch, /- id: preset-moss\n\s+name: '@deepseek-ai\/dsh-agent-preset'/)
  assert.match(patch, new RegExp(`\\n\\s+id: ${MOSS_PRESET}\\n`))
  assert.match(patch, /name: '@deepseek-ai\/dsh-persona'/)
  assert.match(patch, /You are 550W/)
  assert.match(patch, /no abilities beyond the tools/)
  assert.match(patch, /approval policy/)
  assert.match(patch, /ASD-STE100/)
  assert.doesNotMatch(patch, /领航员|Navigator/, 'the preset no longer uses a role-play form of address')
  assert.doesNotMatch(patch, /complete: true/, 'the persona must not replace the host safety and tool guidance')
  for (const row of ['tool-bash', 'tool-fs', 'tool-ask-user', 'compaction']) assert.match(patch, new RegExp(`- id: ${row}\\n`))
})

test('the 550W tool composition matches the shipped standard preset after the persona row', () => {
  const patch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
  const rows = [...patch.slice(patch.indexOf('- id: preset-moss')).matchAll(/^ {10}- id: ([\w-]+)$/gm)].map(match => match[1])
  assert.deepEqual(rows, ['persona', 'agent-instructions', 'time-context', 'tool-bash', 'tool-pwsh', 'tool-fs', 'tool-fs-search', 'tool-jobs', 'tool-schedule', 'skill-filesystem', 'tool-skill', 'command-goal', 'tool-goal', 'planning', 'compaction', 'delegation', 'tool-ask-user', 'tool-todo', 'tool-web', 'present', 'tool-plugin-manager', 'tool-plugin-market'])
})
