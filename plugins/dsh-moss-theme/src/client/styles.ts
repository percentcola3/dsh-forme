import { transmissionCSS } from './transmission-styles.ts'
import { interfaceCSS } from './interface-styles.ts'
import { chromeCSS } from './chrome-styles.ts'
import { engineCSS } from './engine-styles.ts'

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
  --moss-signal:#f07c83; --moss-accent:#df4e54; --moss-accent-dim:#803137; --moss-red:#e34448; --moss-red-deep:#8b2228;
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
/* The plugin manager also marks its inset page heading as a drag region.
   Keep the console gradient on the full-width conversation header only. */
body[data-moss-theme="on"] header[data-window-drag]:has([data-conversation-header-leading]) {
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
  -webkit-app-region:initial !important; app-region:initial !important;
  background:
    radial-gradient(ellipse at 82% 0%,#6b9ccc10,transparent 60%),
    repeating-linear-gradient(90deg,transparent 0 119px,#92b6d306 119px 120px),
    repeating-linear-gradient(0deg,transparent 0 59px,#92b6d306 59px 60px);
}
body:not([data-moss-theme="on"]) [data-moss-atmosphere],
body[data-moss-ambient="off"] [data-moss-atmosphere] { display:none; }

${transmissionCSS}

/* Preserve the existing mode-selector placement around the engine status slot. */
[data-conversation-header-leading]:has(.moss-status-indicator) { padding-inline-start:max(0px,calc(var(--dsh-frame-leading-clearance,0px) - 20px)); }
[data-conversation-header-leading]:has(.moss-status-indicator) + * { padding-inline-start:4px; }
${engineCSS}

/* Theme preferences live inline in the host's General settings. */
.moss-settings { margin-block:20px; color:var(--dsw-alias-label-primary); font:13px/1.6 var(--moss-text,sans-serif); }
.moss-settings h3 { margin:0 0 8px; font:600 14px/1.6 var(--moss-display,sans-serif); color:var(--moss-signal,#df4e54); letter-spacing:.04em; }
.moss-setting { display:flex; align-items:center; justify-content:space-between; gap:16px; min-height:56px; border-bottom:1px solid var(--dsw-alias-border-l2,#c6cbd412); cursor:pointer; }
.moss-setting:last-child { border-bottom:0; }
.moss-setting > span { display:flex; flex-direction:column; }
.moss-setting small { color:var(--dsw-alias-label-tertiary,#8b929d); font-size:11px; }
.moss-setting input { appearance:none; position:relative; flex-shrink:0; width:30px; height:16px; margin:0; border-radius:8px; background:#48515d; cursor:pointer; transition:background .2s; }
.moss-setting input::after { content:''; position:absolute; top:2px; left:2px; width:12px; height:12px; border-radius:50%; background:#c4cbd4; transition:transform .2s; }
.moss-setting input:checked { background:#df4e54; }
.moss-setting input:checked::after { transform:translateX(14px); background:#f5f5f7; }
.moss-setting input:focus-visible { outline:2px solid var(--moss-signal,#df4e54); outline-offset:3px; }

${interfaceCSS}
${chromeCSS}
`
