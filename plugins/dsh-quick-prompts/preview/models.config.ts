import { defineConfig } from 'tsdown'
import { copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const local = (path: string) => fileURLToPath(new URL(path, import.meta.url))
export default defineConfig({
  entry: [local('./models.ts')], format: 'iife', platform: 'browser',
  outDir: local('../../../.build/quick-model-preview'),
  deps: { alwaysBundle: [/.*/], onlyBundle: false },
  define: { 'process.env.NODE_ENV': '"production"' },
  onSuccess: () => { copyFileSync(local('./models.html'), local('../../../.build/quick-model-preview/index.html')) },
})
