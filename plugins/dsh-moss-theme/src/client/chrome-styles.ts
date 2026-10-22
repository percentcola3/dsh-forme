export const chromeCSS = `
.moss-brand-logo { display:block; width:86px; height:auto; object-fit:contain; }
/* Existing host headers own window movement; no extra title bar or logo. */
html[data-moss-window-carrier="electron"] body[data-moss-theme="on"] :is(header[data-window-drag],div[data-window-drag]:has([data-slot="sidebar.brand.name"]),div[data-window-drag]:has(+ div[data-window-drag] [data-slot="sidebar.brand.name"])) {
  -webkit-app-region:drag !important; app-region:drag !important; user-select:none;
}
html[data-moss-window-carrier="electron"] body[data-moss-theme="on"] header[data-window-drag] :not(:is(button,a,input,textarea,select,summary,[role="button"],[role="tab"],[role="link"],[role="menuitem"],[role="checkbox"],[role="radio"],[role="switch"],[role="slider"],[role="combobox"],[role="textbox"],[contenteditable="true"],[data-moss-no-drag])) {
  -webkit-app-region:drag !important; app-region:drag !important;
}
html[data-moss-window-carrier="electron"] body[data-moss-theme="on"] [data-window-drag] :is(button,a,input,textarea,select,summary,[role="button"],[role="tab"],[role="link"],[role="menuitem"],[role="checkbox"],[role="radio"],[role="switch"],[role="slider"],[role="combobox"],[role="textbox"],[contenteditable="true"],[data-moss-no-drag]),
html[data-moss-window-carrier="electron"] body[data-moss-theme="on"] [data-window-drag] :is(button,a,input,textarea,select,summary,[role="button"],[role="tab"],[role="link"],[role="menuitem"],[role="checkbox"],[role="radio"],[role="switch"],[role="slider"],[role="combobox"],[role="textbox"],[contenteditable="true"],[data-moss-no-drag]) * {
  -webkit-app-region:no-drag !important; app-region:no-drag !important;
}
.moss-sidebar-brand { display:flex; align-items:center; justify-content:center; padding:0; }
.moss-sidebar-brand .moss-brand-logo { width:128px; height:47px; }
/* The full name slot replaces both parts of the official expanded identity. */
body[data-moss-theme="on"] span:has(> [data-slot="sidebar.brand.mark"]):has(+ span [data-slot="sidebar.brand.name"]) { display:none; }
[data-slot="sidebar.brand.mark"] .moss-brand-logo { width:30px; height:16px; }
/* The official name seat is 24px high; allow the larger vector to fit. */
body[data-moss-theme="on"] span:has(> [data-slot="sidebar.brand.name"]),
body[data-moss-theme="on"] span:has(> span > [data-slot="sidebar.brand.name"]) { height:auto; overflow:visible; }
body[data-moss-theme="on"] div[data-window-drag]:has([data-slot="sidebar.brand.name"]) { position:relative; height:56px; min-height:56px; margin:-4px 0 8px; padding:4px 32px; overflow:visible; }
/* Center the full identity seat, including on resizable sidebar widths. */
body[data-moss-theme="on"] div[data-window-drag]:has([data-slot="sidebar.brand.name"]) > :is(span,button):has([data-slot="sidebar.brand.name"]) { justify-content:center; }
body[data-moss-theme="on"] div[data-window-drag]:has([data-slot="sidebar.brand.name"]) > button:not(:has([data-slot="sidebar.brand.name"])) { position:absolute; right:4px; }
/* The host's hidden shortcut hint must not shift the new-chat label off center. */
body[data-moss-theme="on"] div[data-window-drag]:has([data-slot="sidebar.brand.name"]) + button {
  color:var(--moss-signal); background:#df4e540a !important; border-color:#df4e5447;
}
body[data-moss-theme="on"] div[data-window-drag]:has([data-slot="sidebar.brand.name"]) + button:hover { background:#df4e5417 !important; border-color:#f07c8377; }
body[data-moss-theme="on"] div[data-window-drag]:has([data-slot="sidebar.brand.name"]) + button > span:first-child { mask-image:none; }
body[data-moss-theme="on"] div[data-window-drag]:has([data-slot="sidebar.brand.name"]) + button > span:first-child > span { width:100%; justify-content:center; }
body[data-moss-theme="on"] div[data-window-drag]:has([data-slot="sidebar.brand.name"]) + button > span[aria-hidden="true"] { position:absolute; right:12px; top:50%; transform:translateY(-50%); }
/* The official right-panel expand button is only 28px wide; misses around it
   start a window drag. Enlarge its hit area and keep its container clickable. */
html[data-moss-window-carrier="electron"] body[data-moss-theme="on"] [data-conversation-header-corner] { -webkit-app-region:no-drag !important; app-region:no-drag !important; }
html[data-moss-window-carrier="electron"] body[data-moss-theme="on"] [data-sidebar-right-expand] { min-width:40px !important; min-height:34px !important; margin:0 !important; }
html[data-moss-window-carrier="electron"] body[data-moss-theme="on"] [data-sidebar-right-expand]::before { content:''; position:absolute; inset:-6px; }
html[data-moss-window-carrier="electron"] body[data-moss-theme="on"] [data-sidebar-right-expand] { position:relative; }

/* Panel chrome buttons (fullscreen / collapse) are 28px icons on a 28px strip;
   give them the same comfortable hit area as the expand button. */
body[data-moss-theme="on"] [data-dockkit-strip-chrome] { pointer-events:auto; }
body[data-moss-theme="on"] [data-sidebar-right-toggle],
body[data-moss-theme="on"] [data-sidebar-right-mode] { min-width:40px !important; min-height:34px !important; position:relative; }
body[data-moss-theme="on"] [data-sidebar-right-toggle]::before,
body[data-moss-theme="on"] [data-sidebar-right-mode]::before { content:''; position:absolute; inset:-6px; }
body[data-moss-theme="on"] [data-dockkit-strip-chrome] { height:34px; align-items:center; }

/* Keep the host's macOS traffic-light clearance above the sidebar identity. */
html[data-platform="darwin"]:not([data-fullscreen]) body[data-moss-theme="on"] div[data-window-drag]:has(+ div[data-window-drag] [data-slot="sidebar.brand.name"]) { min-height:48px; }
/* Hide the session breadcrumb, retaining mode/actions and the sidebar title. */
body[data-moss-theme="on"] header [data-slot="conversation.session.header"] nav[aria-label] { display:none; }

`
