import { mkdirSync, mkdtempSync, writeFileSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { probeInstall } from './probe.ts'

function writePkg(dir: string, name: string, version: string): void {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version }))
}

test('resolves npx bin symlink to @deepseek-ai/dsh instead of walking .bin parents', () => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-probe-npx-'))
  const npx = join(root, 'npm', '_npx', 'hash')
  const pkgDir = join(npx, 'node_modules', '@deepseek-ai', 'dsh')
  const binDir = join(npx, 'node_modules', '.bin')
  const libDir = join(pkgDir, 'lib')
  writePkg(npx, '', '')
  writeFileSync(join(npx, 'package.json'), JSON.stringify({}))
  writePkg(pkgDir, '@deepseek-ai/dsh', '0.1.5-rc.1')
  mkdirSync(libDir, { recursive: true })
  writeFileSync(join(libDir, 'bin.js'), 'export {}\n')
  mkdirSync(binDir, { recursive: true })
  const bin = join(binDir, 'dsh')
  symlinkSync(join('..', '@deepseek-ai', 'dsh', 'lib', 'bin.js'), bin)

  const cwd = join(root, 'unrelated-project')
  mkdirSync(cwd, { recursive: true })
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: 'unrelated', version: '1.0.0' }))

  const probe = probeInstall({ argv1: bin, cwd })
  assert.equal(probe.mode, 'npx')
  assert.equal(probe.current, '0.1.5-rc.1')
})

test('prefers source checkout when cwd is @deepseek-ai/dsh-root', () => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-probe-src-'))
  writePkg(root, '@deepseek-ai/dsh-root', '0.1.5-rc.1')
  const probe = probeInstall({ cwd: root })
  assert.equal(probe.mode, 'source')
  assert.equal(probe.current, '0.1.5-rc.1')
})

test('unknown when argv and cwd have no dsh package', () => {
  const root = mkdtempSync(join(tmpdir(), 'dsh-probe-unknown-'))
  writePkg(root, 'unrelated', '1.0.0')
  const probe = probeInstall({ cwd: root })
  assert.equal(probe.mode, 'unknown')
  assert.equal(probe.current, null)
})
