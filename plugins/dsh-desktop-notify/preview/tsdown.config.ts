import { defineConfig } from 'tsdown'
export default defineConfig({ entry: ['main.ts'], outDir: '../../../.build/dsh-notify-preview', format: 'iife', platform: 'browser', dts: false, clean: true, deps: { alwaysBundle: () => true }, define: { 'process.env.NODE_ENV': '"production"' }, outputOptions: { entryFileNames: 'main.iife.js' } })
