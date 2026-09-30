import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

const child = spawn('/bin/zsh', [
  fileURLToPath(new URL('../start-service.sh', import.meta.url)),
  fileURLToPath(new URL('../service.mjs', import.meta.url)),
], { stdio: ['pipe', 'pipe', 'pipe'] })
const events = []
createInterface({ input: child.stdout }).on('line', line => {
  try {
    const event = JSON.parse(line)
    events.push(event)
    console.log(`service: ${event.phase}${event.code ? ` (${event.code}/${event.operation})` : ''}`)
  } catch { /* shell diagnostics are not readiness messages */ }
})
let exited = false
child.once('exit', () => { exited = true })
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
async function waitFor(predicate, timeout = 330_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const error = events.find(e => e.phase === 'error')
    if (error) throw new Error(error.message)
    const value = predicate()
    if (value) return value
    if (exited) throw new Error('Supervisor exited before readiness')
    await pause(100)
  }
  throw new Error('Smoke timeout')
}
async function reachable(url) {
  try {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(1500) })
    await response.body?.cancel()
    return true
  } catch { return false }
}
const urls = []
try {
  const first = await waitFor(() => events.find(e => e.phase === 'ready'))
  urls.push(first.url)
  const response = await fetch(first.url, { redirect: 'manual', signal: AbortSignal.timeout(5000) })
  assert.equal(response.status, 303, `Unexpected auth status ${response.status}`)
  const cookieHeader = response.headers.get('set-cookie')
  assert.ok(cookieHeader, 'No authentication cookie returned')
  assert.match(cookieHeader, /HttpOnly/)
  assert.match(cookieHeader, /SameSite=Strict/)
  await response.body?.cancel()
  const origin = new URL(first.url).origin
  const anonymous = await fetch(origin, { redirect: 'manual' })
  assert.equal(anonymous.status, 401)
  await anonymous.body?.cancel()
  const authenticated = await fetch(origin, { headers: { cookie: cookieHeader.split(';', 1)[0] }, redirect: 'manual' })
  assert.equal(authenticated.status, 200)
  assert.match(await authenticated.text(), /id="root"/)
  console.log('Token exchange plus cookie-authenticated workspace HTML verified')
  child.stdin.write('restart\n')
  const second = await waitFor(() => events.filter(e => e.phase === 'ready')[1])
  urls.push(second.url)
  assert.notEqual(new URL(first.url).searchParams.get('token'), new URL(second.url).searchParams.get('token'))
  assert.equal(await reachable(first.url), false, 'Old service still listening')
  assert.equal(await reachable(second.url), true)
  console.log('Restart rotates token and closes old listener')
} finally {
  child.stdin.end()
  const deadline = Date.now() + 10_000
  while (!exited && Date.now() < deadline) await pause(100)
  if (!exited) child.kill('SIGTERM')
  assert.ok(exited, 'Supervisor did not exit after native-parent EOF')
  for (const url of urls) assert.equal(await reachable(url), false, 'Owned service survived App exit')
  console.log('Parent exit stops supervisor and owned listeners')
}
