import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, symlinkSync, unlinkSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const resources = process.env.DSH_APP_RESOURCES ?? '/Applications/DeepSeek Harness.app/Contents/Resources'
const cli = join(resources, 'runtime/cli/bin/dsh')
const pnpm = join(resources, 'runtime/pnpm/bin/pnpm.cjs')
if (!existsSync(cli) || !existsSync(pnpm)) throw new Error('Install DeepSeek Harness Desktop first, or set DSH_APP_RESOURCES.')
const run = (bin, args, cwd) => {
  const result = spawnSync(bin, args, { cwd, stdio: 'inherit', env: process.env })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Command failed: ${bin} (exit ${result.status})`)
}
run(process.execPath, [pnpm, 'install', '--frozen-lockfile', '--ignore-scripts'], join(root, 'plugins'))
run(process.execPath, [pnpm, '-r', 'run', 'build'], join(root, 'plugins'))

// pnpm's link: dependency intentionally does not install the linked package's
// dependencies. Make the already-built workspace packages resolvable from the
// meta-bundle before handing it to the Desktop profile.
mkdirSync(join(root, 'node_modules'), { recursive: true })
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
// Remove only stale local links created by this installer. Leave unrelated
// packages and links untouched when components leave the bundle.
for (const name of readdirSync(join(root, 'node_modules'))) {
  if (Object.hasOwn(manifest.dependencies, name)) continue
  const link = join(root, 'node_modules', name)
  if (lstatSync(link).isSymbolicLink() && resolve(dirname(link), readlinkSync(link)) === join(root, 'plugins', name)) unlinkSync(link)
}
for (const name of Object.keys(manifest.dependencies)) {
  const source = join(root, 'plugins', name)
  const link = join(root, 'node_modules', name)
  if (!existsSync(join(source, 'lib/index.js'))) throw new Error(`Build output missing: ${name}`)
  let stat
  try { stat = lstatSync(link) } catch (error) { if (error.code !== 'ENOENT') throw error }
  if (stat) {
    if (!stat.isSymbolicLink() || resolve(dirname(link), readlinkSync(link)) !== source) {
      throw new Error(`Existing dependency is not this workspace package: ${link}. Resolve it before installing.`)
    }
  } else symlinkSync(relative(dirname(link), source), link, 'dir')
}
run(cli, ['plugin', '--profile', 'desktop', 'add', '--ignore-scripts', root], root)
console.log(`Installed dsh-forme into the actual Desktop profile. Quit and reopen DeepSeek Harness to load all ${Object.keys(manifest.dependencies).length} components.`)
