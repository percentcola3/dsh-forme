import { createRequire } from 'node:module'
import { chmodSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
// node-pty's published macOS spawn-helper can arrive without executable bits.
if (process.platform === 'darwin') {
  const require = createRequire(import.meta.url)
  const root = dirname(require.resolve('node-pty/package.json'))
  for (const directory of [`prebuilds/${process.platform}-${process.arch}`, 'build/Release']) {
    const helper = join(root, directory, 'spawn-helper')
    if (existsSync(helper)) chmodSync(helper, 0o755)
  }
}
