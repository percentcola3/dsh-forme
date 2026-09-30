import { cpSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, existsSync, realpathSync, readdirSync, lstatSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const installed = realpathSync(process.env.PAKE_TEMPLATE || join(process.env.HOME, 'Library/pnpm/global/5/node_modules/pake-cli'))
const template = join(root, '.build/pake-template')
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', ...options })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`)
}
mkdirSync(template, { recursive: true })
for (const file of ['package.json', 'dist/cli.js', 'src-tauri']) {
  cpSync(join(installed, file), join(template, file), {
    recursive: true,
    filter: path => !/\/(target|\.pake|gen)(\/|$)/.test(path),
  })
}
// npm hoists dependencies beside pake-cli; retain that resolution in the copy.
const moduleRoot = join(root, '.build/node_modules')
mkdirSync(moduleRoot, { recursive: true })
for (const entry of readdirSync(dirname(installed))) {
  const target = join(moduleRoot, entry)
  if (!existsSync(target)) symlinkSync(join(dirname(installed), entry), target)
}
const localModules = join(template, 'node_modules')
if (existsSync(localModules) && lstatSync(localModules).isSymbolicLink()) unlinkSync(localModules)
mkdirSync(join(localModules, '.bin'), { recursive: true })
for (const entry of readdirSync(dirname(installed)).filter(name => !name.startsWith('.'))) {
  if (!existsSync(join(localModules, entry))) symlinkSync(join(dirname(installed), entry), join(localModules, entry))
}
if (!existsSync(join(localModules, '.bin/tauri'))) symlinkSync(join(localModules, '@tauri-apps/cli/tauri.js'), join(localModules, '.bin/tauri'))
const libPath = join(template, 'src-tauri/src/lib.rs')
let lib = readFileSync(libPath, 'utf8')
const replace = (before, after) => {
  if (!lib.includes(before)) throw new Error(`Pake 3.16.1 integration point missing: ${before}`)
  lib = lib.replace(before, after)
}
replace('pub fn run_app() {', 'mod dsh_runtime;\n\npub fn run_app() {')
replace('.invoke_handler(tauri::generate_handler![', '.invoke_handler(tauri::generate_handler![\n            dsh_runtime::dsh_status,\n            dsh_runtime::dsh_restart,\n            dsh_runtime::dsh_page_loaded,')
replace('let label = webview.label();', 'dsh_runtime::check_page(webview.app_handle());\n            let label = webview.label();')
replace('let window = set_window(app.app_handle(), &pake_config, &tauri_config)?;', 'let window = set_window(app.app_handle(), &pake_config, &tauri_config)?;\n            dsh_runtime::install(&window)?;')
replace('.run(move |_app, _event| {', '.run(move |_app, _event| {\n            if matches!(_event, tauri::RunEvent::Exit) { dsh_runtime::shutdown(_app); }')
writeFileSync(libPath, lib)
cpSync(join(root, 'desktop/dsh_runtime.rs'), join(template, 'src-tauri/src/dsh_runtime.rs'))
// Local bootstrap and the dynamically assigned loopback origin both need window controls.
const capabilityPath = join(template, 'src-tauri/capabilities/default.json')
const capability = JSON.parse(readFileSync(capabilityPath, 'utf8'))
capability.remote.urls = ['http://127.0.0.1:*']
writeFileSync(capabilityPath, JSON.stringify(capability, null, 2))
const web = join(root, '.build/startup')
mkdirSync(web, { recursive: true })
cpSync(join(root, 'desktop/index.html'), join(web, 'index.html'))
cpSync(join(root, 'assets/deepseek-harness.png'), join(web, 'icon.png'))
const output = join(root, '.build/output')
mkdirSync(output, { recursive: true })
run(process.execPath, [join(template, 'dist/cli.js'), web,
  '--name', 'DeepSeekHarness', '--identifier', 'com.pake.ab12df0',
  '--icon', join(root, 'assets/deepseek-harness.icns'),
  '--targets', 'app', '--iterative-build', '--hide-title-bar', '--hide-on-close', 'false',
  '--internal-url-regex', '^http://127\\.0\\.0\\.1:[0-9]+/',
], { cwd: output, env: { ...process.env, CARGO_TARGET_DIR: process.env.CARGO_TARGET_DIR || join(root, '.build/cargo-target') } })
const bundle = join(output, 'DeepSeekHarness.app')
for (const file of ['service.mjs', 'start-service.sh']) cpSync(join(root, 'desktop', file), join(bundle, 'Contents/Resources', file))
run('codesign', ['--force', '--sign', '-', '--preserve-metadata=identifier,entitlements,flags,runtime', bundle])
run('codesign', ['--verify', '--deep', '--strict', bundle])
console.log(`Built and verified: ${bundle}`)
