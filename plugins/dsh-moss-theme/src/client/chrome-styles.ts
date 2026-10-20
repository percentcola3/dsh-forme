export const chromeCSS = `
.moss-brand-logo { display:block; width:86px; height:auto; object-fit:contain; }
body[data-moss-theme="on"] { --moss-chrome-height:36px; }
/* Official macOS traffic lights start at 18px and have a 14px diameter. */
html[data-platform="darwin"] body[data-moss-theme="on"]:has(.moss-titlebar[data-carrier="electron"]) { --moss-chrome-height:50px; }
html[data-platform="darwin"][data-fullscreen] body[data-moss-theme="on"]:has(.moss-titlebar[data-carrier="electron"]) { --moss-chrome-height:36px; }
.moss-titlebar {
  position:fixed; top:0; left:0; right:0; z-index:10020; height:var(--moss-chrome-height,36px); box-sizing:border-box;
  display:flex; align-items:center; gap:18px; padding:0 12px;
  background:linear-gradient(#112031,#0b1623); border-bottom:1px solid #ffffff17;
  color:#b2b6be; font:500 9px/1 var(--moss-display,sans-serif); letter-spacing:.16em;
  -webkit-app-region:drag; app-region:drag; pointer-events:auto; user-select:none;
}
/* A dedicated strip frees the full app width for native dragging. */
body[data-moss-theme="on"]:has(.moss-titlebar) { padding-top:var(--moss-chrome-height); box-sizing:border-box; }
body[data-moss-theme="on"]:has(.moss-titlebar) > #root { height:100%; min-height:0; margin-top:0; }
.moss-titlebar-brand { display:flex; align-items:center; gap:12px; pointer-events:none; }
.moss-titlebar-brand .moss-brand-logo { width:49px; height:20px; }
.moss-titlebar-center { position:absolute; left:50%; transform:translateX(-50%); pointer-events:none; color:#838a96; }
.moss-window-actions { display:flex; align-self:stretch; margin-left:auto; -webkit-app-region:no-drag; app-region:no-drag; }
.moss-window-actions button { display:flex; align-items:center; justify-content:center; width:38px; border:0; border-left:1px solid #ffffff08; border-radius:0; background:transparent; color:#bfc5ce; -webkit-app-region:no-drag; app-region:no-drag; cursor:pointer; }
.moss-window-actions button:hover { background:#ffffff0c; color:#fff; }
.moss-window-actions button:focus-visible { outline:1px solid #e34448; outline-offset:-4px; }
.moss-window-actions .moss-icon { width:13px; height:13px; }
.moss-titlebar-error { margin-left:auto; font:10px/1.4 var(--moss-text,sans-serif); letter-spacing:0; color:#f3a5ab; -webkit-app-region:no-drag; }
/* Native Electron captions stay native: the theme does not counterfeit their APIs. */
html[data-platform="darwin"] .moss-titlebar[data-carrier="electron"] { padding-left:88px; }
html[data-platform="win32"] .moss-titlebar[data-carrier="electron"] { padding-right:146px; }
html[data-fullscreen] .moss-titlebar[data-carrier="electron"] { padding-left:12px; padding-right:12px; }
/* The host deliberately marks body portals no-drag; opt in only this strip. */
html body[data-moss-theme="on"] > .moss-titlebar[data-carrier="electron"] { -webkit-app-region:drag !important; app-region:drag !important; }
.moss-titlebar button { -webkit-app-region:no-drag !important; app-region:no-drag !important; }
.moss-wordmark .moss-brand-logo { width:62px; height:23px; }
.moss-console-id .moss-brand-logo { width:116px; height:43px; }
.moss-sidebar-brand { display:flex; align-items:center; padding:0; }
.moss-sidebar-brand .moss-brand-logo { width:128px; height:47px; }
/* The full name slot replaces both parts of the official expanded identity. */
body[data-moss-theme="on"] span:has(> [data-slot="sidebar.brand.mark"]):has(+ span [data-slot="sidebar.brand.name"]) { display:none; }
[data-slot="sidebar.brand.mark"] .moss-brand-logo { width:30px; height:16px; }
/* The official name seat is 24px high; allow the larger vector to fit. */
body[data-moss-theme="on"] span:has(> [data-slot="sidebar.brand.name"]),
body[data-moss-theme="on"] span:has(> span > [data-slot="sidebar.brand.name"]) { height:auto; overflow:visible; }
body[data-moss-theme="on"] div[data-window-drag]:has([data-slot="sidebar.brand.name"]) { height:64px; min-height:64px; margin:0 0 8px; padding:8px 4px; overflow:visible; }
/* The native sidebar's traffic-light spacer is redundant below our own strip.
   Keep its collapse button, aligned with the adjacent logo row. */
body[data-moss-theme="on"] div[data-window-drag]:has(+ div[data-window-drag] [data-slot="sidebar.brand.name"]) { position:relative; height:0; min-height:0; margin:0; padding:0; overflow:visible; }
body[data-moss-theme="on"] div[data-window-drag]:has(+ div[data-window-drag] [data-slot="sidebar.brand.name"]) > :is(button,span) { position:absolute; top:18px; right:0; z-index:1; }
/* Hide the session breadcrumb, retaining mode/actions and the sidebar title. */
body[data-moss-theme="on"] header [data-slot="conversation.session.header"] nav[aria-label] { display:none; }
@media(max-width:600px) { .moss-titlebar-center,.moss-titlebar-brand > span { display:none; } .moss-titlebar { gap:8px; } }
`
