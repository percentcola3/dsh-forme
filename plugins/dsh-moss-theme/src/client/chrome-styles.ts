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
/* Keep the host's macOS traffic-light clearance above the sidebar identity. */
html[data-platform="darwin"]:not([data-fullscreen]) body[data-moss-theme="on"] div[data-window-drag]:has(+ div[data-window-drag] [data-slot="sidebar.brand.name"]) { min-height:48px; }
/* Hide the session breadcrumb, retaining mode/actions and the sidebar title. */
body[data-moss-theme="on"] header [data-slot="conversation.session.header"] nav[aria-label] { display:none; }

`
