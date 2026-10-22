#!/usr/bin/env node
// Make the macOS close button quit DeepSeek Harness instead of hiding it.
//
// The official Electron shell hides the main window on close and keeps the
// backend alive until Dock → Quit. This patches one statement in
// Contents/Resources/app.asar (lib/main.js): on darwin the close button calls
// app.quit(), so it goes through the normal ⌘Q path, including the
// "running tasks will be interrupted" confirmation. Cancelling it keeps the window.
//
//   node scripts/patch-desktop-close.mjs            apply (idempotent)
//   node scripts/patch-desktop-close.mjs --check    report state only
//   node scripts/patch-desktop-close.mjs --restore  put the original asar back
//
// Run with any Node ≥ 18, e.g. the app's own:
//   ELECTRON_RUN_AS_NODE=1 "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness" scripts/patch-desktop-close.mjs
// Quit DSH first. Re-run after every DSH update (updates replace app.asar).
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { setTimeout as delay } from 'node:timers/promises'
import process from 'node:process'

const APP = process.env.DSH_APP ?? '/Applications/DeepSeek Harness.app'
const ASAR = join(APP, 'Contents/Resources/app.asar')
const BACKUP = join(homedir(), '.dsh/cache/desktop-close/app.asar.original')
const PLIST = join(APP, 'Contents/Info.plist')
const ENTRY = 'lib/main.js'
const SIGNATURE = join(APP, 'Contents/_CodeSignature/CodeResources')
const EXECUTABLE = join(APP, 'Contents/MacOS/DeepSeek Harness')
const MARK = '/* dsh-forme: close quits */'
const ANCHOR = `window.on("close", (event) => {
			if (quitting || shellInstallerOwnsQuit || sessionEnding) return;
			event.preventDefault();`
const PATCHED = `${ANCHOR}
			${MARK} if (process.platform === "darwin" && !updateDialog.isOpen) { app.quit(); return; }`

const mode = process.argv.includes('--restore') ? 'restore' : process.argv.includes('--check') ? 'check' : 'apply'
const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

// --- asar (Chromium Pickle header + payload) ---------------------------------
function readAsar(buffer) {
  const headerSize = buffer.readUInt32LE(4) // Pickle payload length of the header pickle
  const jsonLength = buffer.readUInt32LE(12)
  const header = JSON.parse(buffer.subarray(16, 16 + jsonLength).toString('utf8'))
  return { header, base: 8 + headerSize }
}
function entryOf(header, path) {
  let node = header
  for (const part of path.split('/')) node = node.files?.[part]
  if (!node || node.files || node.unpacked) throw new Error(`asar: ${path} is not a packed file`)
  return node
}
function* files(node, prefix = '') {
  for (const [name, child] of Object.entries(node.files ?? {})) {
    const path = prefix ? `${prefix}/${name}` : name
    if (child.files) yield* files(child, path)
    else yield [path, child]
  }
}
function fileIntegrity(data) {
  const blockSize = 4 * 1024 * 1024
  const blocks = []
  for (let i = 0; i < data.length; i += blockSize) blocks.push(createHash('sha256').update(data.subarray(i, i + blockSize)).digest('hex'))
  if (blocks.length === 0) blocks.push(createHash('sha256').update(Buffer.alloc(0)).digest('hex'))
  return { algorithm: 'SHA256', hash: createHash('sha256').update(data).digest('hex'), blockSize, blocks }
}
function headerBuffer(header) {
  const json = Buffer.from(JSON.stringify(header), 'utf8')
  const aligned = (json.length + 3) & ~3
  const out = Buffer.alloc(16 + aligned)
  out.writeUInt32LE(4, 0)              // size pickle payload
  out.writeUInt32LE(8 + aligned, 4)    // header pickle size
  out.writeUInt32LE(4 + aligned, 8)    // header pickle payload
  out.writeUInt32LE(json.length, 12)   // string length
  json.copy(out, 16)
  return out
}
/** Rewrite one packed file, shifting later offsets; every other byte is kept. */
function replaceFile(buffer, path, data) {
  const { header, base } = readAsar(buffer)
  const target = entryOf(header, path)
  const start = Number(target.offset), oldSize = target.size, delta = data.length - oldSize
  for (const [, node] of files(header)) {
    if (node.unpacked || node === target) continue
    if (Number(node.offset) > start) node.offset = String(Number(node.offset) + delta)
  }
  target.size = data.length
  if (target.integrity) target.integrity = fileIntegrity(data)
  const payload = buffer.subarray(base)
  return Buffer.concat([headerBuffer(header), payload.subarray(0, start), data, payload.subarray(start + oldSize)])
}
const headerHash = buffer => {
  const jsonLength = buffer.readUInt32LE(12)
  return createHash('sha256').update(buffer.subarray(16, 16 + jsonLength)).digest('hex')
}

// --- app bundle ----------------------------------------------------------------
const plistHash = () => sh('/usr/libexec/PlistBuddy', ['-c', 'Print :ElectronAsarIntegrity:Resources/app.asar:hash', PLIST])
const setPlistHash = hash => sh('/usr/libexec/PlistBuddy', ['-c', `Set :ElectronAsarIntegrity:Resources/app.asar:hash ${hash}`, PLIST])
function running() {
  try { return sh('/usr/bin/pgrep', ['-f', `${APP}/Contents/MacOS/`]).split('\n').filter(Boolean).length > 0 } catch { return false }
}
function resign() {
  // Re-sign only the outer app; leave nested vendor-signed helpers untouched.
  sh('/usr/bin/codesign', ['--force', '--sign', '-', '--preserve-metadata=entitlements,flags,identifier', APP])
  sh('/usr/bin/codesign', ['--verify', '--deep', '--strict', APP])
}
function state(buffer) {
  const { header, base } = readAsar(buffer)
  const node = entryOf(header, ENTRY)
  const text = buffer.subarray(base + Number(node.offset), base + Number(node.offset) + node.size).toString('utf8')
  return { text, patched: text.includes(MARK), anchors: text.split(ANCHOR).length - 1 }
}

if (process.argv.includes('--wait')) {
  console.log('Waiting for DSH to quit before patching…')
  while (running()) await delay(500)
}
const current = readFileSync(ASAR)
const info = state(current)
if (mode === 'check') {
  console.log(JSON.stringify({ app: APP, patched: info.patched, anchorFound: info.anchors === 1, backup: existsSync(BACKUP), integrityMatches: plistHash() === headerHash(current) }, null, 2))
  process.exit(0)
}
if (!process.argv.includes('--dry-run') && running()) { console.error('DeepSeek Harness is running. Quit it (⌘Q) and run this again.'); process.exit(2) }

if (mode === 'restore') {
  if (!existsSync(BACKUP)) { console.error(`No backup at ${BACKUP}; nothing to restore.`); process.exit(1) }
  const original = readFileSync(BACKUP)
  copyFileSync(BACKUP, ASAR)
  for (const [target, name] of [[PLIST, 'Info.plist'], [SIGNATURE, 'CodeResources'], [EXECUTABLE, 'executable']]) copyFileSync(join(dirname(BACKUP), name), target)
  sh('/usr/bin/codesign', ['--verify', '--deep', '--strict', APP])
  console.log('Restored the original app.asar (close button hides the window again).')
  process.exit(0)
}

if (info.patched) { console.log('Already patched: the close button quits DSH.'); process.exit(0) }
if (info.anchors !== 1) {
  console.error(`This DSH build changed its close handler (found ${info.anchors} anchors); not patching. Update scripts/patch-desktop-close.mjs.`)
  process.exit(1)
}
const nextText = info.text.replace(ANCHOR, PATCHED)
const next = replaceFile(current, ENTRY, Buffer.from(nextText, 'utf8'))
const check = state(next)
if (!check.patched || check.text !== nextText) throw new Error('asar rewrite verification failed')
// Every other packed file must be byte-identical after the rewrite.
{
  const a = readAsar(current), b = readAsar(next)
  for (const [path, node] of files(a.header)) {
    if (node.unpacked || path === ENTRY) continue
    const other = entryOf(b.header, path)
    const x = current.subarray(a.base + Number(node.offset), a.base + Number(node.offset) + node.size)
    const y = next.subarray(b.base + Number(other.offset), b.base + Number(other.offset) + other.size)
    if (!x.equals(y)) throw new Error(`asar rewrite changed ${path}`)
  }
}
if (process.argv.includes('--dry-run')) {
  const output = process.argv[process.argv.indexOf('--dry-run') + 1]
  writeFileSync(output, next)
  console.log('Validated rewrite; all other packed files are byte-identical. Staged: ' + output)
  process.exit(0)
}
mkdirSync(dirname(BACKUP), { recursive: true })
if (existsSync(BACKUP) && !readFileSync(BACKUP).equals(current)) copyFileSync(BACKUP, `${BACKUP}.${Date.now()}`)
copyFileSync(ASAR, BACKUP)
for (const [target, name] of [[PLIST, 'Info.plist'], [SIGNATURE, 'CodeResources'], [EXECUTABLE, 'executable']]) copyFileSync(target, join(dirname(BACKUP), name))
const temp = `${ASAR}.dsh-forme-tmp`
writeFileSync(temp, next)
renameSync(temp, ASAR)
try {
  setPlistHash(headerHash(next))
  resign()
} catch (error) {
  copyFileSync(BACKUP, ASAR)
  for (const [target, name] of [[PLIST, 'Info.plist'], [SIGNATURE, 'CodeResources'], [EXECUTABLE, 'executable']]) copyFileSync(join(dirname(BACKUP), name), target)
  throw error
}
console.log(`Patched: the close button now quits DSH (with the usual task confirmation).\nBackup: ${BACKUP}\nUndo:   node scripts/patch-desktop-close.mjs --restore`)

if (process.argv.includes('--reopen')) sh('/usr/bin/open', [APP])
