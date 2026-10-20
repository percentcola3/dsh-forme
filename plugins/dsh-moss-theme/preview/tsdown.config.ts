import { defineConfig } from 'tsdown'
import { copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const local = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  entry: [local('./main.ts')],
  format: 'iife',
  platform: 'browser',
  loader: { '.jpg': 'dataurl', '.woff2': 'dataurl' },
  outputOptions: { codeSplitting: false },
  outDir: local('../../../.build/moss-preview'),
  deps: { alwaysBundle: [/.*/], onlyBundle: false },
  define: { 'process.env.NODE_ENV': '"production"' },
  onSuccess: () => { copyFileSync(local('./index.html'), local('../../../.build/moss-preview/index.html')) },
})
