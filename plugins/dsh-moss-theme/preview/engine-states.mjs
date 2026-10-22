import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFile, writeFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { EngineIndicator } from '../src/client/engine.ts'
import { engineCSS } from '../src/client/engine-styles.ts'
import { statusText } from '../src/client/state.ts'
// Renderer has no imports: embed its actual code as a standalone browser module.
const renderer = stripTypeScriptTypes(await readFile(new URL('../src/client/engine-renderer.ts', import.meta.url), 'utf8'), { mode: 'strip' })
const render = status => renderToStaticMarkup(React.createElement(EngineIndicator, { status }))
const tiles = Object.entries(statusText).map(([state, info]) => `<button class="tile" data-state="${state}" aria-label="预览${info.label}"><div class="art">${render(state)}</div><strong>${info.label}</strong><small>${info.code}</small></button>`).join('')
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>土星 · 状态预览</title><style>
${engineCSS}
*{box-sizing:border-box}body{margin:0;padding:40px;background:#0b1722;color:#d4e2ed;font-family:system-ui,sans-serif}main{max-width:760px;margin:auto}h1{font-size:22px;letter-spacing:.04em;font-weight:550}p{font-size:13px;color:#9aafbf;line-height:1.8}.header{display:flex;align-items:center;gap:12px;border:1px solid #344c60;background:#162a3b;padding:10px 18px;border-radius:12px;margin:24px 0}.mode{font-size:15px;color:#acbecb}.state-label{margin-left:auto;font-size:12px;color:#8eacbf}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.tile{display:flex;flex-direction:column;align-items:center;gap:8px;padding:18px 8px;background:#102333;border:1px solid #2b4355;border-radius:12px;color:inherit;cursor:pointer}.tile:hover,.tile:focus-visible{border-color:#73b5e4;outline:none;background:#173045}.tile .art{height:84px;display:flex;align-items:center;justify-content:center}.tile .moss-engine{transform:scale(2)}strong{font-size:13px;font-weight:500}small{font:10px ui-monospace,monospace;letter-spacing:.08em;color:#8faabc}.controls{display:flex;gap:12px;align-items:center;font-size:13px;margin-top:22px}input{accent-color:#78bfff}@media(max-width:520px){body{padding:20px}.grid{grid-template-columns:repeat(2,1fr)}}
</style><body data-moss-theme="on" data-moss-motion="on"><main><h1>土星 / WebGL 状态指示</h1><p>顶部为实际尺寸；下方以两倍尺寸展示六种状态。点击卡片切换顶部状态。</p><div class="header"><span id="sample">${render('working')}</span><span class="mode">△ 标准模式</span><span class="state-label" id="label">处理中</span></div><div class="grid">${tiles}</div><label class="controls"><input id="motion" type="checkbox" checked>运行动画</label><p>悬停查看状态说明。停止运行回到待命，不代表任务成功。</p></main><script type="module">
${renderer}
document.querySelectorAll(".moss-engine-canvas").forEach(canvas => mountEngine(canvas));
const labels=${JSON.stringify(statusText)};
document.querySelectorAll('.tile').forEach(tile=>tile.addEventListener('click',()=>{const state=tile.dataset.state;const root=document.querySelector('#sample .moss-engine');root.dataset.status=state;root.querySelector('canvas').dataset.status=state;root.setAttribute('aria-label',tile.querySelector('.moss-engine').getAttribute('aria-label'));root.title=tile.querySelector('.moss-engine').title;document.querySelector('#label').textContent=labels[state].label}));
document.querySelector('#motion').addEventListener('change',event=>document.body.dataset.mossMotion=event.target.checked?'on':'off');
</script></body></html>`
await writeFile(new URL('./engine-states.html', import.meta.url), html)
