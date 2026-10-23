export const modelMenuCSS = `
.moss-model-trigger{display:inline-flex;align-items:center;gap:6px;min-width:0;max-width:100%;padding:5px 7px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary,#bbc6d2);font:inherit;font-size:12px;cursor:pointer}
.moss-model-trigger>span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.moss-model-trigger small{flex:none;opacity:.7;font-size:11px}
.moss-model-trigger:hover{background:var(--dsw-alias-interactive-bg-hover,#ffffff0c)}.moss-model-trigger:disabled{opacity:.5;cursor:default}
.moss-model-menu{position:fixed;z-index:11030;display:flex;flex-direction:column;width:300px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);box-sizing:border-box;padding:6px;border:1px solid var(--dsw-alias-border-l2,#899bb433);border-radius:12px;corner-shape:round;background:var(--dsw-alias-bg-layer-3,#192b3e);color:var(--dsw-alias-label-primary,#dce7ef);box-shadow:0 12px 40px #0004;font:13px/1.5 var(--moss-text,system-ui);overflow:hidden}
.moss-model-menu button{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:34px;box-sizing:border-box;padding:7px 9px;border:0;border-radius:6px;background:transparent;color:inherit;text-align:left;font:inherit;cursor:pointer}
.moss-model-menu button>span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.moss-model-menu button>span:last-child:not(:first-child){flex:none}
.moss-model-menu button:hover,.moss-model-menu button[data-active],.moss-model-menu button[aria-selected=true],.moss-model-menu button[aria-checked=true]{background:var(--dsw-alias-interactive-bg-hover,#ffffff0c)}
.moss-model-menu button:disabled{opacity:.5;cursor:default}
.moss-model-menu .moss-model-back{min-height:26px;padding:3px 8px;color:var(--dsw-alias-label-tertiary,#8ea4b8);font-size:11px}
.moss-model-search{flex:none;width:100%;box-sizing:border-box;border:0;border-bottom:1px solid var(--dsw-alias-border-l3,#a1b7cc22);border-radius:0;padding:9px;background:transparent;color:inherit;font:inherit;outline:none}
.moss-model-list{min-height:0;overflow:auto;max-height:min(420px,65vh);overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#839eb644 transparent;padding:3px 0}
.moss-model-list section+section{margin-top:9px}.moss-model-heading{padding:6px 9px 3px;color:var(--dsw-alias-label-tertiary,#8ea4b8);font-size:11px;line-height:1.5}.moss-model-list p{margin:10px;color:var(--dsw-alias-label-tertiary,#8ea4b8)}
.moss-model-root button>span:last-child{max-width:210px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary,#bbc6d2)}
.moss-model-error{overflow:auto;max-height:100px;padding:6px 9px;color:#ef9398;overflow-wrap:anywhere;font-size:11px}.moss-model-error button{min-height:24px;padding:3px 0;font-size:11px}
.moss-model-trigger:focus-visible,.moss-model-menu button:focus-visible{outline:2px solid #a3c8e1;outline-offset:-2px}.moss-model-search:focus-visible{box-shadow:inset 0 -2px #a3c8e1}
`
