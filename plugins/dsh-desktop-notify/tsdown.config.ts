import { defineConfig } from 'tsdown'
const externals = ['react', 'react-dom']
export default defineConfig([
  { entry: ['src/index.ts'], outDir: 'lib', format: 'esm', platform: 'node', target: 'es2024', dts: false, clean: true, fixedExtension: false },
  { name: 'dsh-desktop-notify/client', entry: { client: 'src/client/index.ts' }, outDir: 'lib', format: 'cjs', platform: 'browser', dts: false, clean: false,
    deps: { neverBundle: externals, alwaysBundle: id => !externals.includes(id) },
    define: { 'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production') },
    outputOptions: { codeSplitting: false, entryFileNames: 'client.js', banner: 'window.__ModuleLoader__.load({ id: "dsh-desktop-notify", factory: (require) => {', footer: 'return module.exports; } });', intro: 'var module = { exports: {} }; var exports = module.exports;' } },
])
