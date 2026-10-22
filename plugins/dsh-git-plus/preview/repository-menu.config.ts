import { defineConfig } from 'tsdown'
import { copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const local = (path: string) => fileURLToPath(new URL(path, import.meta.url))
export default defineConfig({
  entry: [local('./repository-menu.ts')], format: 'iife', platform: 'browser',
  outDir: local('../../../.build/git-tree-preview'),
  deps: { alwaysBundle: [/.*/], onlyBundle: false },
  define: { 'process.env.NODE_ENV': '"production"' },
  onSuccess: () => { copyFileSync(local('./repository-menu.html'), local('../../../.build/git-tree-preview/index.html')) },
})
