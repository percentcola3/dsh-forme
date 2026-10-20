import { transmissionCSS } from './transmission-styles.ts'
import { interfaceCSS } from './interface-styles.ts'
import { chromeCSS } from './chrome-styles.ts'

/*
 * A midnight-blue control room with red reserved for emphasis:
 *   midnight    #09121d … #203247   panels and the reading plane
 *   signal red  #e34448             550W, attention and primary actions
 *   silver      #c8cbd1 … #f0f1f4   prose, instrument labels and waiting states
 * The Earth scene keeps its icy-blue atmosphere and engine wake.
 */
export const themeCSS = `
/* DSH semantic tokens also recolor menus and portals without relying on hashed classes. */
html body[data-moss-theme="on"] {
  color-scheme: dark;
  --moss-accent:#df4e54; --moss-accent-dim:#803137; --moss-red:#e34448; --moss-red-deep:#8b2228;
  --moss-display:'MOSS Rajdhani','MOSS Sans SC','Source Han Sans SC','PingFang SC',sans-serif;
  --moss-text:'MOSS Sans SC','Source Han Sans SC','Noto Sans SC','PingFang SC',sans-serif;
  --dsw-font-family:var(--moss-display); --dsw-font-family-brand:var(--moss-display);
  --dsh-font-family-text:var(--moss-display); --dsh-font-family-text-default:var(--moss-display);
  --moss-line:#d0d4dc25; --moss-line-strong:#d0d4dc4a; --moss-mono:ui-monospace,'SF Mono',SFMono-Regular,Menlo,Consolas,monospace;
  --dsw-alias-bg-base:#0c1521;
  --dsw-alias-bg-layer-1:#101e2e;
  --dsw-alias-bg-layer-2:#162638;
  --dsw-alias-bg-layer-3:#203247;
  --dsw-alias-bg-module-platform:#101c2a;
  --dsw-alias-bg-overlay:#24374c;
  --dsw-alias-bg-mask-1:#000b;
  --dsw-alias-label-primary:#e7e8eb;
  --dsw-alias-label-primary-bluish:#e7e8eb;
  --dsw-alias-label-primary-dimmed:#c8cbd1;
  --dsw-alias-label-primary-foreground:#0c1521;
  --dsw-alias-label-primary-inverted:#101e2e;
  --dsw-alias-label-secondary:#b1b5bd;
  --dsw-alias-label-tertiary:#969ca6;
  --dsw-alias-label-caption:#8a919b;
  --dsw-alias-label-document-preview:#c8cbd1;
  --dsw-alias-border-l1:#d0d4dc16;
  --dsw-alias-border-l2:#d0d4dc2a;
  --dsw-alias-border-l3:#d0d4dc3b;
  --dsw-alias-border-l4:#d0d4dc55;
  --dsw-alias-brand-primary:#eceef1;
  --dsw-alias-brand-text:#eceef1;
  --dsw-alias-brand-primary-invert:#0c1521;
  --dsw-alias-state-business-primary:#df4e54;
  --dsw-alias-state-business-tertiary:#243e55;
  --dsw-alias-link:#d9dce2;
  --dsw-alias-state-error-primary:#ff6b72;
  --dsw-alias-state-error-secondary:#ff6b72;
  --dsw-alias-state-warn-primary:#df4e54;
  --dsw-alias-state-warn-label:#df4e54;
  --dsw-alias-state-warn-tertiary:#43252b;
  --dsw-alias-state-success-primary:#cdd1d7;
  --dsw-alias-state-success-secondary:#cdd1d7;
  --dsw-alias-interactive-bg-hover:#9cbed51a;
  --dsw-alias-interactive-bg-active:#89b4d52b;
  --dsw-alias-interactive-bg-hover-solid:#1d3045;
  --dsw-alias-button-primary-fill:#c9363e;
  --dsw-alias-button-primary-hover:#e3474f;
  --dsw-alias-button-contrast-fill:#e7e8eb;
  --dsw-alias-button-elevated-fill:#24374c;
  --dsw-alias-button-floating-fill:#1d3045;
  --dsw-alias-button-floating-hover:#2b435b;
  --dsw-alias-button-info-fill:#b52f38;
  --dsw-alias-button-info-hover:#c9363e;
  --dsw-alias-markdown-code-block:#09121d;
  --dsw-alias-markdown-code-block-banner:#162638;
  --dsw-alias-markdown-inline-code:#1d3045;
  --dsw-alias-markdown-code-segment-selected:#2b435b;
  --dsw-alias-markdown-code-segment-unselected:#101e2e;
  --dsw-alias-markdown-citation:#1d3045;
  --dsw-alias-toast-bg:#24374c;
  --dsw-alias-toast-label:#e7e8eb;
  --dsw-alias-tooltip-bg:#24374c;
  --dsw-alias-scrollbar-bg-l1:#38516a;
  --dsw-alias-scrollbar-bg-l2:#627f99;
  --dsw-alias-menu-group-header-fill:#101c2a;
  --dsw-menu-surface-fill:#17283bf7;
  --dsw-specific-menu:#17283bf7;
  --dsw-specific-selector:#203247;
  --dsw-specific-sidebar-fill:#09121d;
  --dsw-specific-sidebar-nav-item-active:#20374d;
  --dsw-specific-sidebar-nav-item-active-accent:#20374d;
  --dsw-specific-sidebar-nav-item-hover:#17283b;
  --dsw-specific-bubble:#203247;
  --dsw-specific-bubble-highlight:#2b435b;
  --dsw-specific-input-major:#112031;
  --dsw-specific-login-input:#112031;
  --dsw-specific-tip:#203247;
  background:var(--dsw-alias-bg-base); color:var(--dsw-alias-label-primary); font-family:var(--moss-display);
}
/* Native session rows are divs, while menus and editors can set their own font.
   Cover UI semantics as well as buttons; do not override code/editor descendants. */
html body[data-moss-theme="on"] :is(button,input,select,textarea,[contenteditable="true"],[data-composer-input],[role="treeitem"],[role="option"],[role="menuitem"],[role="tab"],[data-window-drag]) { font-family:var(--moss-display); }
/* Reading surfaces use the text face; code retains its own monospace stack. */
body[data-moss-theme="on"] [data-chat-flow-kind] { font-family:var(--moss-text); }
/* One shared contour for the card, its native overlays and the shortcut row. */
body[data-moss-theme="on"] [data-composer-card] {
  --moss-card-radius:10px; --dsw-radius-panel:var(--moss-card-radius);
  position:relative; border:1px solid var(--moss-line-strong); border-radius:var(--moss-card-radius); corner-shape:round;
  background-image:none;
  box-shadow:0 16px 45px #0506083b, inset 0 1px #e0e3e814;
  transition:border-color .2s, box-shadow .2s;
}
/* Mask a rounded stroke into two HUD corners, exactly on the card's border. */
body[data-moss-theme="on"] [data-composer-card]::before {
  content:''; position:absolute; inset:-1px; z-index:2; box-sizing:border-box; pointer-events:none;
  border:1px solid var(--moss-red); border-radius:inherit; corner-shape:round;
  mask:linear-gradient(#000 0 0) top left/20px 20px no-repeat,linear-gradient(#000 0 0) bottom right/20px 20px no-repeat;
}
body[data-moss-theme="on"] [data-composer-card]:focus-within { border-color:#e25c626e; box-shadow:0 16px 45px #0506084d, 0 0 0 2px #e3444812, inset 0 1px #e0e3e80a; }
body[data-moss-theme="on"] header[data-window-drag] {
  border-bottom:1px solid var(--moss-line);
  background:linear-gradient(180deg,#17283a,#101e2c);
  box-shadow:inset 0 1px #e0e3e81a,0 1px 0 #0003;
}
/* Match the segmented shell and its inset selection, including plugin nav caps. */
body[data-moss-theme="on"] header [role="tablist"] { border-radius:10px; }
body[data-moss-theme="on"] header [role="tablist"] > [role="tab"] { border-radius:0; corner-shape:round; }
body[data-moss-theme="on"] header [role="tablist"] > [role="tab"][data-dsh-nav="chat"] { border-radius:10px 0 0 10px; }
body[data-moss-theme="on"] header [role="tablist"] > [role="tab"]:is([data-dsh-nav="trace"],[data-dsh-nav="other"]) { border-radius:0 10px 10px 0; }
body[data-moss-theme="on"] header [role="tablist"]:has(> [data-dsh-nav="other"]) > [data-dsh-nav="trace"] { border-radius:0; }
body[data-moss-theme="on"] header [role="tablist"] > [role="tab"]::before { inset:4px; border-radius:6px; corner-shape:round; }
body[data-moss-theme="on"] header [role="tab"][aria-selected="true"] { color:var(--moss-accent); }
body[data-moss-theme="on"] :is(.dfp-chip,.dqp-bar > button,.dgp-toolbar button) { border-radius:6px; corner-shape:round; }
body[data-moss-theme="on"] .dqp-bar { border-radius:calc(var(--moss-card-radius) - 1px) calc(var(--moss-card-radius) - 1px) 0 0; corner-shape:round; }
body[data-moss-theme="on"] .dqp-task-chip { border-radius:6px; corner-shape:round; }
body[data-moss-theme="on"] .dqp-task-chip > button:first-child { border-radius:6px 0 0 6px; corner-shape:round; }
body[data-moss-theme="on"] .dqp-task-chip > .dqp-task-edit { border-radius:0 6px 6px 0; corner-shape:round; }
body[data-moss-theme="on"] ::selection { background:#df4e5455; color:#fff; }
body[data-moss-theme="on"] :is(pre,code) { font-family:var(--moss-mono); }
/* Cool blue reflected light and a faint instrument grid. */
body[data-moss-theme="on"] [data-moss-atmosphere] {
  position:fixed; inset:0; z-index:9990; pointer-events:none;
  background:
    radial-gradient(ellipse at 82% 0%,#6b9ccc10,transparent 60%),
    repeating-linear-gradient(90deg,transparent 0 119px,#92b6d306 119px 120px),
    repeating-linear-gradient(0deg,transparent 0 59px,#92b6d306 59px 60px);
}
body:not([data-moss-theme="on"]) [data-moss-atmosphere],
body[data-moss-ambient="off"] [data-moss-atmosphere] { display:none; }

${transmissionCSS}

/* ── Header trigger ─────────────────────────────────────────── */
.moss-trigger { appearance:none; -webkit-app-region:no-drag; display:inline-flex; align-items:center; gap:10px; box-sizing:border-box; height:28px; padding:3px 7px; border:1px solid transparent; border-radius:7px; background:transparent; color:var(--dsw-alias-label-secondary,#aeb3bc); cursor:pointer; white-space:nowrap; transition:background .2s,border-color .2s,color .2s; }
.moss-trigger:hover,.moss-trigger[aria-expanded="true"] { border-color:#d0d4dc33; background:#d0d4dc0a; color:var(--dsw-alias-label-primary,#e3e5e9); }
.moss-wordmark { font:600 16px/1 var(--moss-display,'MOSS Rajdhani',sans-serif); letter-spacing:2.8px; }
/* Status remains available to screen readers and the hover hint, without a label or divider. */
.moss-trigger-state { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; border:0; }
/* The desktop frame overlays its sidebar/new-session controls over this row. */
[data-conversation-header-leading]:has(.moss-trigger) { padding-inline-start:max(0px,calc(var(--dsh-frame-leading-clearance,0px) - 20px)); }
[data-conversation-header-leading]:has(.moss-trigger) + * { padding-inline-start:12px; }
.moss-trigger:focus-visible,.moss-console :is(button,summary,input,textarea):focus-visible { outline:2px solid var(--moss-red,#e34448); outline-offset:2px; }
.moss-trigger .moss-eye { --eye:10px; }

/* A single diffused LED, without the old camera housing or glass highlights.
   Silver = idle, white = connecting, blue = work, red = attention. */
.moss-eye { --eye:12px; --lamp:#a5b3c3; --breath-time:4.8s; --breath-low:.25; --breath-high:.6;
  position:relative; display:inline-block; flex-shrink:0; width:var(--eye); height:var(--eye); border-radius:50%; corner-shape:round;
  background:none; box-shadow:none; }
.moss-eye::before { content:''; position:absolute; inset:-35%; border-radius:50%; pointer-events:none;
  background:var(--lamp); filter:blur(4px); animation:moss-lamp-halo var(--breath-time) ease-in-out infinite; }
.moss-eye::after { content:''; position:absolute; inset:10%; border-radius:50%; pointer-events:none;
  background:var(--lamp); box-shadow:0 0 4px color-mix(in srgb,var(--lamp) 30%,transparent);
  animation:moss-lamp-core var(--breath-time) ease-in-out infinite; }
.moss-eye[data-status="working"] { --lamp:#79bcff; --breath-time:1.6s; --breath-low:.42; --breath-high:1; }
.moss-eye[data-status="connecting"] { --lamp:#e4edf7; --breath-time:1s; --breath-low:.2; --breath-high:.85; }
.moss-eye[data-status="waiting"] { --lamp:#f08086; --breath-time:3.2s; --breath-low:.4; --breath-high:.9; }
.moss-eye[data-status="error"] { --lamp:#ff4f5e; --breath-time:2.8s; --breath-low:.25; --breath-high:1; }
.moss-eye[data-status="error"]::after { animation-name:moss-lamp-alert; }
.moss-eye[data-status="error"]::before { animation-name:moss-lamp-alert-halo; }
.moss-eye[data-status="offline"] { --lamp:#667384; }
.moss-eye[data-status="offline"]::before { animation:none; opacity:0; }
.moss-eye[data-status="offline"]::after { animation:none; opacity:.18; box-shadow:none; }

/* ── Console ─────────────────────────────────────────────────── */
.moss-console { position:fixed; z-index:10030; top:64px; right:20px; width:380px; max-width:calc(100vw - 24px); max-height:calc(100dvh - 84px); overflow:auto; box-sizing:border-box;
  border:1px solid #c6cbd42e; border-radius:8px; background:linear-gradient(180deg,#202227fa,#0c1521fc); color:#e3e5e9;
  box-shadow:0 30px 90px #000c, 0 0 0 1px #000, inset 0 1px #ffffff0a; font:13px/1.6 var(--moss-text,sans-serif); -webkit-app-region:no-drag;
  animation:moss-console-in .22s cubic-bezier(.2,.8,.2,1); }
.moss-console * { box-sizing:border-box; }
.moss-console button { appearance:none; font:inherit; cursor:pointer; color:#e3e5e9; }
.moss-console-head { display:flex; align-items:center; gap:14px; padding:18px 18px 16px; }
.moss-console-head .moss-eye { --eye:12px; }
.moss-console-id { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
.moss-console-id strong { display:block; font:600 20px/1 var(--moss-display,'MOSS Rajdhani',sans-serif); letter-spacing:6px; color:#f0f1f3; }
.moss-console-id small { color:#8b929d; font:9px/1.4 var(--moss-display,'MOSS Rajdhani',sans-serif); letter-spacing:1.6px; }
.moss-close { align-self:flex-start; width:26px; height:26px; padding:0; border:0; border-radius:4px; background:transparent; font-size:18px !important; line-height:1; color:#8b929d !important; }
.moss-close:hover { background:#ffffff0d; color:#e3e5e9 !important; }
.moss-monitor { position:relative; margin:0 18px; border:1px solid #c6cbd424; border-radius:4px; overflow:hidden; background:#07080a; }
.moss-monitor .moss-scene { height:170px; }
.moss-hud { position:absolute; inset:0; pointer-events:none; font:9px/1.3 var(--moss-display,'MOSS Rajdhani',sans-serif); letter-spacing:1.4px; color:#df4e54cc; }
.moss-hud > span { position:absolute; }
.moss-hud .tl { top:9px; left:10px; } .moss-hud .tr { top:9px; right:10px; text-align:right; } .moss-hud .bl { bottom:9px; left:10px; } .moss-hud .br { bottom:9px; right:10px; text-align:right; color:#b0b7c1aa; }
.moss-hud::before,.moss-hud::after { content:''; position:absolute; width:10px; height:10px; border-color:#df4e5488; border-style:solid; }
.moss-hud::before { top:4px; left:4px; border-width:1px 0 0 1px; }
.moss-hud::after { bottom:4px; right:4px; border-width:0 1px 1px 0; }
.moss-status { display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:10px; margin:14px 18px 0; padding:10px 12px; border:1px solid #c6cbd41c; border-left:2px solid var(--tone,#df4e54); border-radius:3px; background:#ffffff04; }
.moss-status[data-status="standby"] { --tone:#cdd1d7; }
.moss-status[data-status="working"] { --tone:#df4e54; }
.moss-status[data-status="connecting"],.moss-status[data-status="waiting"] { --tone:#e1e3e7; }
.moss-status[data-status="error"] { --tone:#ff6b72; }
.moss-status[data-status="offline"] { --tone:#7c838e; }
.moss-status-label { color:var(--tone); font-weight:600; font-size:12px; letter-spacing:1px; }
.moss-status-message { color:#bfc3cb; font-size:12px; line-height:1.5; }
.moss-status code { font:9px var(--moss-display,'MOSS Rajdhani',sans-serif); letter-spacing:1.4px; color:#8b929d; }
.moss-thrust { display:flex; align-items:center; gap:10px; margin:10px 18px 0; color:#8b929d; font:9px var(--moss-display,'MOSS Rajdhani',sans-serif); letter-spacing:1.4px; }
.moss-thrust-bar { flex:1; height:4px; display:flex; gap:2px; }
.moss-thrust-bar i { flex:1; background:#c6cbd41a; transition:background .4s; }
.moss-thrust-bar i[data-on="true"] { background:linear-gradient(90deg,#828b98,#e2e6ed); box-shadow:0 0 6px #e2e6ed33; }
.moss-section-label { display:flex; align-items:center; gap:8px; padding:20px 18px 6px; color:#c9cdd5; font:9px var(--moss-display,'MOSS Rajdhani',sans-serif); letter-spacing:2px; }
.moss-section-label::after { content:''; flex:1; height:1px; background:#c6cbd41c; }
.moss-preferences { margin:0 18px; }
.moss-setting { display:flex; align-items:center; justify-content:space-between; gap:16px; min-height:50px; border-bottom:1px solid #c6cbd412; cursor:pointer; }
.moss-setting:last-child { border-bottom:0; }
.moss-setting > span { display:flex; flex-direction:column; }
.moss-setting small { color:#8b929d; font-size:10.5px; }
.moss-setting input { appearance:none; position:relative; flex-shrink:0; width:30px; height:16px; margin:0; border-radius:8px; background:#292c31; cursor:pointer; transition:background .2s; }
.moss-setting input::after { content:''; position:absolute; top:2px; left:2px; width:12px; height:12px; border-radius:50%; background:#9299a4; transition:transform .2s,background .2s; }
.moss-setting input:checked { background:#df4e54; }
.moss-setting input:checked::after { transform:translateX(14px); background:#ededf0; }
.moss-persona { margin:8px 18px 0; padding:10px 12px; border:1px solid #c6cbd41c; border-radius:4px; background:#ffffff03; }
.moss-persona summary { cursor:pointer; color:#e3e5e9; font-size:12px; }
.moss-persona summary small { margin-left:8px; color:#8b929d; font-size:10px; }
.moss-persona p { color:#a1a7b1; margin:9px 0; font-size:11px; }
.moss-persona textarea { width:100%; min-height:110px; resize:vertical; padding:8px 10px; color:#ccd0d7; background:#08090b; border:1px solid #c6cbd426; border-radius:3px; font:11px/1.65 -apple-system,'PingFang SC',sans-serif; }
.moss-persona-actions { display:flex; align-items:center; gap:10px; margin-top:8px; }
.moss-persona-actions p { margin:0; }
.moss-copy { padding:5px 12px; border:1px solid #df4e5466; border-radius:3px; background:#df4e5414; color:#e8eaee !important; font-size:11px !important; }
.moss-copy:hover { background:#df4e5426; }
.moss-identity { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:0 18px; padding:10px 12px; border:1px solid #c6cbd41c; border-radius:4px; background:#ffffff03; }
.moss-identity[data-active="true"] { border-color:#e3444840; background:#e344480a; }
.moss-identity > span { display:flex; flex-direction:column; font-size:12.5px; }
.moss-identity small { color:#8b929d; font-size:10.5px; line-height:1.5; }
.moss-identity[data-active="true"] > span { color:#f2c1c4; }
.moss-quote { margin:18px 18px 0; padding:12px 0 0; border-top:1px solid #c6cbd41a; color:#999faa; font-size:11px; line-height:1.7; }
.moss-quote cite { display:block; margin-top:2px; color:#757c88; font:9px var(--moss-display,'MOSS Rajdhani',sans-serif); font-style:normal; letter-spacing:1.4px; }
.moss-footnote { display:flex; justify-content:space-between; margin-top:14px; padding:10px 18px; border-top:1px solid #c6cbd41a; color:#757c88; font:9px/1.6 var(--moss-display,'MOSS Rajdhani',sans-serif); letter-spacing:1.4px; }

@keyframes moss-lamp-core { 0%,100% { opacity:var(--breath-low); } 50% { opacity:var(--breath-high); } }
@keyframes moss-lamp-halo { 0%,100% { opacity:.04; } 50% { opacity:.22; } }
@keyframes moss-lamp-alert { 0%,32%,64%,100% { opacity:.25; } 16%,48% { opacity:1; } }
@keyframes moss-lamp-alert-halo { 0%,32%,64%,100% { opacity:.02; } 16%,48% { opacity:.3; } }
@keyframes moss-console-in { from { opacity:0; transform:translateY(-6px) scale(.985); } }
body[data-moss-motion="off"] .moss-eye::before, body[data-moss-motion="off"] .moss-eye::after, body[data-moss-motion="off"] .moss-console { animation:none !important; }
@media (prefers-reduced-motion:reduce) { .moss-eye::before,.moss-eye::after,.moss-console { animation:none !important; } }
body[data-moss-motion="off"] .moss-eye:not([data-status="offline"])::after { opacity:.85; }
@media (prefers-reduced-motion:reduce) { .moss-eye:not([data-status="offline"])::after { opacity:.85; } }
body[data-moss-motion="off"] .moss-eye::before { opacity:.1; }
@media (prefers-reduced-motion:reduce) { .moss-eye::before { opacity:.1; } }
body[data-moss-motion="off"] .moss-eye[data-status="offline"]::before { opacity:0; }
@media (max-width:600px) { .moss-console { top:56px; right:12px; max-height:calc(100dvh - 70px); } }
${interfaceCSS}
${chromeCSS}
`
