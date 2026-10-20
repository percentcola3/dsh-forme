import { transmissionGlyph } from './interface-styles.ts'

/*
 * Host contract: assistant-step > conversation.chat.node > AssistantMarkdown
 * root > body > MarkdownText. Do not depend on the host's generated CSS names.
 * Reasoning disclosures, user messages and document previews keep their layout.
 */
const reply = '[data-chat-flow-kind="assistant-step"]:not([data-chat-group-part="reasoning"]) [data-slot="conversation.chat.node"] > div > div > div:not([data-turn-process-inline]):not(:has([data-variant="think"]))'
const prose = `body[data-moss-theme="on"] ${reply}`
const live = `body[data-moss-theme="on"][data-moss-motion="on"] ${reply.replace(' > div > div > div', ' > div[data-streaming] > div > div')}`

export const transmissionCSS = `
/* AI transmissions: a quiet document rail, small instrument labels and generous prose. */
${prose} {
  position:relative; min-width:0; padding:0 0 2px 22px;
  border-inline-start:1px solid #d0d4dc2b;
  font-family:var(--moss-text); line-height:1.85;
  counter-reset:moss-section;
  background:linear-gradient(110deg,#dce0e605,transparent 70%);
  border-radius:0 4px 4px 0;
}
${prose}:first-child::before {
  content:'AI TRANSMISSION / 智能体回复'; display:block;
  margin:0 0 16px; padding:6px 0 9px 23px; border-bottom:1px solid #d0d4dc1c;
  color:#c2c6ce; font:500 10px/1.4 var(--moss-display); letter-spacing:.16em;
  background:${transmissionGlyph} left 5px/14px 14px no-repeat,linear-gradient(#e45459,#e45459) left top/24px 1px no-repeat;
}
${prose} > :first-child { margin-top:0; }
${prose} :is(p,li,td,th) { font-family:var(--moss-text); }
${prose} p { color:var(--dsw-alias-label-primary); line-height:1.85; }
${prose} :is(h1,h2,h3,h4) { font-family:var(--moss-display); color:#e8eaee; letter-spacing:.035em; }
${prose} h1 { font-size:1.45em; font-weight:600; line-height:1.55; margin:0 0 16px; }
${prose} h2 {
  display:flex; align-items:baseline; gap:12px; margin:30px 0 12px;
  font-size:1.15em; font-weight:600; line-height:1.6; counter-increment:moss-section;
}
${prose} h2::before {
  content:counter(moss-section,decimal-leading-zero); flex:none;
  color:#c6c9ce; font:600 .85em/1 var(--moss-display); letter-spacing:.08em;
}
${prose} h2::after { content:''; align-self:center; flex:1; min-width:12px; height:1px; background:linear-gradient(90deg,#d0d4dc2b,transparent); }
${prose} h3 { font-size:1.04em; font-weight:600; margin:22px 0 10px; }
${prose} :is(ul,ol) { padding-inline-start:1.5em; }
${prose} li { padding-inline-start:.2em; }
${prose} li::marker { color:#c6c9ce; font-family:var(--moss-display); font-weight:600; }
${prose} strong { color:#f1f2f4; font-weight:600; }
${prose} :is(a,[role="link"]) { color:#d4d8e0; text-decoration-color:#d4d8e055; text-underline-offset:4px; }
${prose} :is(a,[role="link"]):hover { color:#ffffff; text-decoration-color:currentColor; }
${prose} :not(pre) > code { padding:2px 5px; border:1px solid #ccd1d91a; border-radius:3px; color:#d3d7df; }
${prose} hr { border:0; height:1px; margin:28px 0; background:linear-gradient(90deg,#c6c9ce70,#d0d4dc22 32%,transparent); }

/* Markdown > quotes become film-like excerpt panels. No text is rewritten. */
${prose} blockquote {
  position:relative; box-sizing:border-box; margin:22px 0; padding:38px 24px 19px;
  border:1px solid #d0d4dc2a; border-inline-start:2px solid #d55a60;
  border-radius:2px; corner-shape:round;
  background:linear-gradient(110deg,#d3d7df0b,#cbd0d903 75%);
  color:#e1e4e9; font-style:normal;
}
${prose} blockquote::before {
  content:'QUOTE / 引文'; position:absolute; inset:12px auto auto 24px;
  color:#c6c9ce; font:500 9px/1.3 var(--moss-display); letter-spacing:.18em;
}
${prose} blockquote::after {
  content:''; position:absolute; right:-1px; bottom:-1px; width:13px; height:13px;
  border-right:1px solid #d55a6099; border-bottom:1px solid #d55a6099;
  pointer-events:none;
}
${prose} blockquote > :is(p,ul,ol) { margin:0; color:#e1e4e9; line-height:1.9; }
${prose} blockquote > * + * { margin-top:10px; }
${prose} blockquote blockquote { margin:14px 0 0; padding:12px 0 0 16px; border:0; border-inline-start:1px solid #d0d4dc4a; background:none; }
${prose} blockquote blockquote::before,${prose} blockquote blockquote::after { content:none; }
${prose} table { border-color:#d0d4dc2a; }
${prose} th { color:#dadde3; background:#d0d4dc09; font-weight:600; }

/* Stream-only motion. Existing text, code, copying and the host's token cadence stay intact. */
${live} { animation:moss-transmission-arrive .38s ease-out; }
${live}::after {
  content:''; display:block; width:34px; height:2px; margin-top:16px;
  background:linear-gradient(90deg,transparent,#e3e6ec,transparent);
  animation:moss-transmission-scan 2.4s ease-in-out infinite;
}
@keyframes moss-transmission-arrive { from { opacity:.65; transform:translateY(2px); } to { opacity:1; transform:none; } }
@keyframes moss-transmission-scan { 0%,100% { opacity:.35; transform:translateX(0); } 50% { opacity:.85; transform:translateX(12px); } }
@media (prefers-reduced-motion:reduce) {
  ${prose} { animation:none !important; }
  ${prose}::after { animation:none !important; }
}
@media (max-width:600px) {
  ${prose} { padding-inline-start:12px; }
  ${prose} blockquote { padding:34px 16px 16px; }
  ${prose} blockquote::before { left:16px; }
  ${prose} h2 { gap:9px; }
}
`
