import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Public documentation artwork. All labels are fictional; no screenshots or external assets.
const output = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/readme')
mkdirSync(output, { recursive: true })
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const text = (x, y, value, color = '#cbd5e1', size = 18) => `<text x="${x}" y="${y}" fill="${color}" font-size="${size}">${escape(value)}</text>`
const box = (x, y, w, h, fill = '#172334') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${fill}" stroke="#334155"/>`
const line = (x1, y1, x2, y2) => `<path d="M${x1} ${y1}H${x2}V${y2}" stroke="#64748b" fill="none" stroke-width="2"/>`
const panel = (name, title, subtitle, body) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 400" role="img" aria-labelledby="title desc">
<title id="title">${escape(title)}</title><desc id="desc">${escape(subtitle)}. Concept illustration with fictional data, not an application screenshot.</desc>
<rect width="960" height="400" rx="18" fill="#0b1220"/>
<g font-family="Arial, Helvetica, sans-serif">${text(32, 44, title, '#f1f5f9', 25)}${text(32, 75, subtitle, '#94a3b8', 16)}${body}${text(32, 378, 'CONCEPT ILLUSTRATION / FICTIONAL DATA / NOT A SCREENSHOT', '#94a3b8', 12)}</g></svg>\n`
  writeFileSync(resolve(output, `${name}.svg`), svg)
}
panel('git', 'Git changes and branches', 'Inspect the repository before an action.',
  box(32,100,260,240)+text(50,132,'demo-project / main','#f8fafc')+text(50,174,'M  src/example.ts')+text(50,212,'+  tests/example.test.ts')+text(50,300,'Branch: feature/demo','#93c5fd')+
  box(310,100,300,240)+text(330,132,'Before','#f8fafc')+box(326,160,268,50,'#3b2029')+text(340,191,'return oldValue;','#fda4af')+
  box(628,100,300,240)+text(648,132,'After','#f8fafc')+box(644,160,268,50,'#12372e')+text(658,191,'return newValue;','#86efac')+text(648,300,'Review the diff first.','#94a3b8',16))
panel('files', 'Files and references', 'Browse native previews. Add context without sending the draft.',
  box(32,100,250,240)+text(52,135,'demo-project','#f8fafc')+text(65,176,'src/')+text(82,214,'example.ts','#93c5fd')+text(65,252,'docs/')+text(82,289,'guide.md')+
  box(300,100,628,150)+text(322,135,'example.ts','#f8fafc')+text(322,175,'export const greeting = "Hello";','#93c5fd')+text(322,216,'Select lines → Add reference','#94a3b8',16)+
  box(300,268,628,72)+text(322,298,'@ src/example.ts : 1','#93c5fd')+text(322,325,'Draft stays editable. Nothing is sent automatically.','#94a3b8',15))
panel('tasks', 'Headless task cards', 'One task context per card. The main conversation stays separate.',
  box(32,100,550,240)+text(54,135,'Main conversation','#f8fafc')+text(54,181,'Continue your project discussion here.')+box(50,266,514,53)+text(70,299,'[ + ]   [ Review ]   [ Push ]','#93c5fd')+
  box(610,100,318,240)+text(632,135,'Review · Complete','#86efac')+text(632,180,'You: Review this change.',undefined,16)+text(632,216,'AI: Here are the findings.',undefined,16)+box(628,264,282,54)+text(644,297,'Ask a follow-up…','#93c5fd',16))
panel('terminal', 'Native terminal card', 'One native terminal, from a compact card to the DSH sidebar.',
  box(32,100,550,240)+text(54,135,'demo-project / terminal','#f8fafc')+text(54,182,'$ printf "hello\\n"','#93c5fd')+text(54,220,'hello','#86efac')+text(54,304,'Interrupt: Ctrl+C    Close: end this terminal',undefined,16)+
  line(584,214,634,214)+box(648,100,280,240)+text(670,140,'Official sidebar','#f8fafc')+text(670,190,'Expand the same PTY',undefined,16)+text(670,232,'Keep input and output',undefined,16)+text(670,274,'No second shell',undefined,16))
panel('notify', 'Desktop task alerts', 'A native macOS panel can appear while another app has focus.',
  box(32,100,510,240)+text(54,135,'Your current application','#f8fafc')+text(54,185,'Continue your work here.')+text(54,227,'The alert does not take keyboard focus.',undefined,16)+
  box(570,100,358,240)+`<circle cx="650" cy="185" r="37" fill="#d8b78d"/><path d="M618 173Q650 186 682 173M616 188Q650 203 684 188M625 206Q650 217 675 206" fill="none" stroke="#a57555" stroke-width="7"/><circle cx="842" cy="185" r="37" fill="#c45b5b"/>`+text(602,254,'Complete',undefined,16)+text(777,254,'Needs attention',undefined,16)+text(592,303,'Click to return to the task.','#93c5fd',16))
panel('theme', '550W theme and agent preset', 'Appearance and agent instructions are separate choices.',
  box(32,100,440,240)+text(54,139,'550W / THEME','#f8fafc',23)+`<circle cx="102" cy="207" r="34" fill="#82bdd5"/><ellipse cx="102" cy="207" rx="57" ry="13" fill="none" stroke="#bac7d6" stroke-width="5"/>`+text(176,199,'Live task state','#93c5fd')+text(176,232,'Theme · texture · motion',undefined,16)+text(54,305,'Local fonts and artwork',undefined,16)+
  box(490,100,438,240)+text(512,139,'550W / PRESET','#f8fafc',23)+text(512,184,'Clear answers. Small code changes.',undefined,16)+text(512,220,'Run checks. Report actual results.',undefined,16)+text(512,256,'Browser → ego-browser', '#93c5fd',16)+text(512,292,'Other computer actions → LCU','#93c5fd',16))
console.log('Generated six public SVG illustrations with fictional data.')
