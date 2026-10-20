import { iconURL } from './icons.ts'

const theme = 'body[data-moss-theme="on"]'
// User content/text are host factories (no slot wrapper). The final span is
// UserText; attachment rows and plain reference summaries are excluded.
const userBubble = ':is([data-chat-flow-kind="user"],[data-chat-flow-kind="steering"]) > [data-slot="conversation.chat.node"] > div > div > div:not([data-message-attachments]):has(> span)'

export const interfaceCSS = `
/* Midnight-blue surfaces share the Earth's cool reflected light. */
${theme}[data-moss-ambient="on"] [data-conversation-scroll] {
  background-image:radial-gradient(ellipse at 94% 0%,#76a9db0d,transparent 48%),linear-gradient(90deg,#050c1612,transparent 18%,transparent 82%,#050c1612);
}
${theme} {
  --dsw-specific-sidebar-nav-item-active:#20374d;
  --dsw-specific-sidebar-nav-item-active-accent:#20374d;
  --dsw-alias-interactive-bg-hover:#9cbed51a;
  --dsw-alias-interactive-bg-active:#89b4d52b;
  --dsw-alias-interactive-bg-hover-solid:#213347;
  --dsw-focus-ring-color:#d75b62;
}
/* Select, hover and keyboard focus have distinct, consistent affordances. */
${theme} :is([role="treeitem"],[role="option"])[aria-selected="true"],
${theme} :is(button[aria-current="page"],button[aria-pressed="true"]) {
  background-color:#20374d; background-image:none;
  box-shadow:inset 0 0 0 1px #a8c6dd26;
  color:#edf4fa; border-color:transparent; border-radius:6px; corner-shape:round;
}
${theme} [role="treeitem"][aria-selected="true"] { outline:none; }
${theme} :is([role="treeitem"],[role="option"]):not([aria-selected="true"]):hover { background-color:#9cbed513; }
${theme} :is([role="treeitem"],[role="option"])[aria-selected="true"]:hover { background-color:#29445c; }
${theme} :is(button,[role="treeitem"],[role="option"],a):focus-visible {
  outline:1px solid #d75b62; outline-offset:3px;
}
${theme} header [role="tab"][aria-selected="true"] {
  color:#f0f1f4; text-shadow:0 0 18px #ffffff24;
  box-shadow:inset 0 -1px #e15d6388;
}
${theme} :is([role="tab"],[role="treeitem"],[role="option"]) { font-variant-numeric:tabular-nums; }
${theme} ::selection { background:#668eaf70; color:#ffffff; text-shadow:none; }
${theme} :is(pre,code) ::selection,${theme} code::selection { background:#d9dce350; color:#ffffff; }
${theme} :is(input,textarea,[contenteditable="true"]) { caret-color:#f0f1f4; }

/* Keep user prompts compact; their chamfered line echoes the instrument panels. */
${theme} ${userBubble} {
  position:relative; border:1px solid #d0d4dc32; border-radius:7px 2px 7px 7px; corner-shape:round;
  background:linear-gradient(120deg,#203246,#172638); box-shadow:inset 0 1px #d6e8f510,0 5px 18px #050c161a;
}
${theme} ${userBubble}::after {
  content:''; position:absolute; right:-1px; top:-1px; width:12px; height:12px;
  border-right:1px solid #d36067aa; border-top:1px solid #d36067aa; border-radius:0 2px 0 0; pointer-events:none;
}
${theme} [data-composer-card] { background:linear-gradient(120deg,#182a3c,#112031); }
${theme} [data-composer-card]:focus-within { border-color:#db606788; box-shadow:0 16px 45px #0506083b,0 0 0 2px #db60670c,inset 0 1px #e4e7ed14; }

/* Native glyphs retain their meaning; color and etched-light treatment are shared. */
${theme} :is(header[data-window-drag],[data-turn-tail],[data-code-block-banner]) button svg { transition:color .16s,filter .16s; }
${theme} :is(header[data-window-drag],[data-turn-tail],[data-code-block-banner]) button:not(:disabled):is(:hover,:focus-visible) svg {
  color:#e3e6ec; filter:drop-shadow(0 0 4px #e35c6540);
}
${theme} :is([data-turn-tail],[data-code-block-banner]) button { border-radius:4px; corner-shape:round; }
${theme} :is([data-turn-tail],[data-code-block-banner]) button:not(:disabled):hover { background-color:#d0d4dc14; }
${theme} [data-turn-tail] :is(button,time) { font-family:var(--moss-display); font-variant-numeric:tabular-nums; }
${theme} [data-disclosure-header] { border-radius:4px; }
${theme} [data-disclosure-header]:hover { background-color:#d0d4dc0b; }
${theme} :is([data-variant="think"],[data-variant="others"])[data-open] > [data-disclosure-header] {
  color:#d3d6dc; box-shadow:inset 2px 0 #d3d6dc66;
}
${theme} [data-code-block-banner] {
  background:linear-gradient(90deg,#1c2d40,#142334); border-bottom:1px solid #a8c6dd26;
  font-family:var(--moss-display); letter-spacing:.035em;
}
${theme} :has(> [data-code-block-banner]) { border-radius:5px; corner-shape:round; }
${theme} [data-code-block-content] { background-color:#0a1420; }

.moss-icon { display:inline-block; width:16px; height:16px; flex:none; vertical-align:-3px; }
.moss-section-label .moss-icon { width:13px; height:13px; opacity:.85; }
.moss-close { display:inline-flex; align-items:center; justify-content:center; }
.moss-close .moss-icon { width:18px; height:18px; }
.moss-connect,.moss-copy { display:inline-flex; align-items:center; justify-content:center; gap:7px; }
.moss-connect .moss-icon,.moss-copy .moss-icon { width:13px; height:13px; }
${theme} .moss-persona summary { font-family:var(--moss-display); }
${theme} .moss-persona textarea { font-family:var(--moss-display); }
${theme} .moss-console { background-image:radial-gradient(ellipse at 100% 0,#9ac2e610,transparent 50%),linear-gradient(180deg,#17283afa,#0c1724fc); }
@media (prefers-reduced-motion:reduce) {
  ${theme} :is(header[data-window-drag],[data-turn-tail],[data-code-block-banner]) button svg { transition:none; }
}
${theme}[data-moss-motion="off"] :is(header[data-window-drag],[data-turn-tail],[data-code-block-banner]) button svg { transition:none; }
`

// A single original glyph also marks each AI transmission, as a CSS decoration.
export const transmissionGlyph = iconURL('orbit')
