import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { Context } from '@deepseek-ai/cordis'
import { apply } from '../lib/index.js'
const ctx = new Context()
let handler; let seq = 0; let turn = 0
await ctx.plugin(provider => {
  provider.provide('sessions', {})
  provider.provide('connection', { requestRejection: req => req.headers.origin && req.headers.origin !== 'http://127.0.0.1:4180' ? 403 : undefined })
  provider.provide('webServer', { register: route => { handler = route.handler; return () => { handler = undefined } } })
})
await ctx.plugin({ inject: ['webServer', 'connection', 'sessions'], apply: plugin => apply(plugin, {}, { directory: new URL('../../../.build/dsh-notify-preview-settings', import.meta.url).pathname }) })
const session = { id: 'preview-task', header: { cwd: '/preview', origin: 'user' }, snapshotEvents: () => [{ type: 'session/title', data: { title: '设计预览 · 示例后台任务' } }] }
const event = (type, data = {}) => ctx.emit('session/event', session, { type, seq: seq++, data })
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/dsh-desktop-notify') { await handler(req, res); return }
    if (req.url === '/simulate' && req.method === 'POST') {
      let raw = ''; for await (const chunk of req) raw += chunk
      const { kind } = JSON.parse(raw)
      if (kind === 'decision') { event('turn/start', { turn: ++turn }); event('step/start', { turn }); event('tool/call', { callId: 'choice', name: 'ask_user_question', arguments: '{"questions":[{"question":"界面方案已就绪，请选择接下来的方向。"}]}' }) }
      else if (kind === 'resolve') event('tool/result', { message: { toolCallId: 'choice', content: [{ type: 'text', text: '{"answers":[]}' }] } })
      else { event('turn/start', { turn: ++turn }); event('step/start', { turn }); event('turn/end', { turn, reason: { kind: kind === 'cancel' ? 'aborted' : 'completed' } }) }
      res.end('{}'); return
    }
    if (req.url === '/main.iife.js') { res.setHeader('content-type', 'application/javascript'); res.end(await readFile(new URL('../../../.build/dsh-notify-preview/main.iife.js', import.meta.url))); return }
    res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(await readFile(new URL('./index.html', import.meta.url)))
  } catch (error) { res.statusCode = 500; res.end(String(error)) }
})
server.listen(4180, '127.0.0.1', () => console.log('Notification preview: http://127.0.0.1:4180/'))
process.on('SIGINT', async () => { await ctx.fiber.dispose(); server.close(); process.exit(0) })
process.on('SIGTERM', async () => { await ctx.fiber.dispose(); server.close(); process.exit(0) })
