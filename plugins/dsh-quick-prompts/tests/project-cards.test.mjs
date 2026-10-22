import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TerminalCard } from '../src/client/terminal-card.ts'
import { createTasks } from '../src/client/tasks.ts'
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes }); return { promise, resolve } }
function fixture() {
  const projectFor = { a1: 'A', a2: 'A', b1: 'B' }
  const runs = { A: [], B: [] }
  let nextList
  const tasks = createTasks(async (action, body) => {
    const projectId = projectFor[body.sessionId]
    const scope = { projectId, cwd: `/projects/${projectId}` }
    if (action === 'list') {
      if (nextList) { const gate = nextList; nextList = undefined; await gate.promise }
      return { ...scope, prompts: [], legacyAvailable: false }
    }
    if (action === 'runs') return { ...scope, runs: structuredClone(runs[projectId]) }
    if (action === 'start') {
      const run = { id: `${projectId}-${runs[projectId].length}`, projectId, parentId: body.sessionId, status: 'completed', name: projectId, startedAt: Date.now() }
      runs[projectId].push(run); return { ...scope, run }
    }
    if (action === 'close') { runs[projectId] = runs[projectId].filter(run => run.id !== body.runId); return { ...scope, runs: structuredClone(runs[projectId]) } }
    throw new Error(`Unexpected action ${action}`)
  })
  return { tasks, projectFor, runs, holdList() { nextList = deferred(); return nextList } }
}
test('terminal and conversation card lists are independent per project and restore across same-project sessions', async () => {
  const { tasks } = fixture()
  await tasks.select('a1'); await tasks.start('a1', 'prompt'); tasks.showTerminal(true)
  const aRun = tasks.getSnapshot().runs[0].id
  await tasks.select('a2')
  assert.equal(tasks.getSnapshot().terminalOpen, true)
  assert.deepEqual(tasks.getSnapshot().runs.map(run => run.id), [aRun])
  await tasks.select('b1')
  assert.equal(tasks.getSnapshot().projectId, 'B')
  assert.equal(tasks.getSnapshot().terminalOpen, false, 'A terminal never opens in B')
  assert.deepEqual(tasks.getSnapshot().runs, [])
  await tasks.start('b1', 'prompt'); const bRun = tasks.getSnapshot().runs[0].id
  tasks.showTerminal(true); tasks.show(false)
  await tasks.select('a1')
  assert.equal(tasks.getSnapshot().open, true)
  assert.equal(tasks.getSnapshot().terminalOpen, true)
  assert.deepEqual(tasks.getSnapshot().runs.map(run => run.id), [aRun])
  tasks.showTerminal(false)
  await tasks.select('b1')
  assert.equal(tasks.getSnapshot().open, false, 'B keeps its own collapsed state')
  assert.equal(tasks.getSnapshot().terminalOpen, true)
  assert.deepEqual(tasks.getSnapshot().runs.map(run => run.id), [bRun])
  await tasks.select('a2')
  assert.equal(tasks.getSnapshot().terminalOpen, false, 'closing A terminal does not close B terminal')
})
test('project resolution hides previous cards immediately and ignores late old-project terminal callbacks', async () => {
  const f = fixture(); const { tasks } = f
  await tasks.select('a1'); tasks.showTerminal(true); await tasks.start('a1', 'p')
  const gate = f.holdList(); const switching = tasks.select('b1')
  assert.equal(tasks.getSnapshot().ready, false)
  assert.equal(tasks.getSnapshot().terminalOpen, false)
  assert.deepEqual(tasks.getSnapshot().runs, [])
  tasks.showTerminal(true, 'A')
  assert.equal(tasks.getSnapshot().terminalOpen, false)
  gate.resolve(); await switching
  tasks.showTerminal(true, 'B'); tasks.showTerminal(false, 'A')
  assert.equal(tasks.getSnapshot().terminalOpen, true, 'an old A cleanup cannot alter B')
  await tasks.select(undefined)
  assert.equal(tasks.getSnapshot().terminalOpen, false)
  assert.deepEqual(tasks.getSnapshot().runs, [])
  await tasks.select('a1'); assert.equal(tasks.getSnapshot().terminalOpen, false, 'a scoped close updates only its owner project')
})
test('a directory/project change in the same session replaces all card state, then restores the original project', async () => {
  const f = fixture(); const { tasks } = f
  await tasks.select('a1'); await tasks.start('a1', 'p'); tasks.showTerminal(true)
  const id = tasks.getSnapshot().runs[0].id
  f.projectFor.a1 = 'B'
  // Existing refresh periodically revalidates the catalog/directory.
  await tasks.select('b1'); await tasks.select('a1')
  assert.equal(tasks.getSnapshot().terminalOpen, false)
  assert.deepEqual(tasks.getSnapshot().runs, [])
  f.projectFor.a1 = 'A'; await tasks.select('a2')
  assert.equal(tasks.getSnapshot().terminalOpen, true)
  assert.deepEqual(tasks.getSnapshot().runs.map(run => run.id), [id])
})
test('closed cards stay closed only in their owning project after switching away and back', async () => {
  const { tasks } = fixture()
  await tasks.select('a1'); await tasks.start('a1', 'p'); const aId = tasks.getSnapshot().runs[0].id
  await tasks.select('b1'); await tasks.start('b1', 'p'); const bId = tasks.getSnapshot().runs[0].id
  await tasks.select('a2'); await tasks.close(aId)
  await tasks.select('b1'); assert.deepEqual(tasks.getSnapshot().runs.map(run => run.id), [bId])
  await tasks.select('a1'); assert.deepEqual(tasks.getSnapshot().runs, [])
})

test('terminal cards keep their original owner session across navigation instead of creating one per session', async () => {
  const { tasks } = fixture()
  await tasks.select('a1'); tasks.showTerminal(true)
  assert.deepEqual(tasks.getSnapshot().terminalCards, [{ projectId: 'A', sessionId: 'a1' }])
  await tasks.select('a2'); tasks.showTerminal(true)
  assert.deepEqual(tasks.getSnapshot().terminalCards, [{ projectId: 'A', sessionId: 'a1' }])
  await tasks.select('b1'); tasks.showTerminal(true)
  assert.deepEqual(tasks.getSnapshot().terminalCards, [{ projectId: 'A', sessionId: 'a1' }, { projectId: 'B', sessionId: 'b1' }])
  await tasks.select('a1'); tasks.showTerminal(false)
  assert.deepEqual(tasks.getSnapshot().terminalCards, [{ projectId: 'B', sessionId: 'b1' }])
})

test('same-project non-owner session keeps a terminal return entry rather than opening a replacement shell', () => {
  const markup = renderToStaticMarkup(React.createElement(TerminalCard, { ctx: {}, sessionId: 'original', active: true, sourceSelected: false, onClose() {} }))
  assert.match(markup, /返回原终端/)
  assert.match(markup, /终端保留在本项目的原会话中/)
  assert.doesNotMatch(markup, /正在打开官方终端/)
  // The official terminal header is the only chrome; no duplicate card frame.
  assert.doesNotMatch(markup, /dqp-run-card/, 'no outer card frame')
  assert.doesNotMatch(markup, />终端</, 'no repeated title row')
  assert.match(markup, /dqp-terminal-overlay/, 'controls float on a slim overlay')
})
test('visiting more projects never resets an earlier project card table or collapsed state', async () => {
  const f = fixture(); await f.tasks.select('a1'); await f.tasks.start('a1', 'p'); f.tasks.showTerminal(true); f.tasks.show(false)
  const id = f.tasks.getSnapshot().runs[0].id
  for (let i = 0; i < 25; i++) { f.projectFor[`extra-${i}`] = `P${i}`; await f.tasks.select(`extra-${i}`) }
  await f.tasks.select('a2')
  assert.equal(f.tasks.getSnapshot().open, false)
  assert.equal(f.tasks.getSnapshot().terminalOpen, true)
  assert.deepEqual(f.tasks.getSnapshot().runs.map(run => run.id), [id])
})
