export const styles = `
[data-composer-card]:has(.dqp-bar){padding-top:52px}
[data-composer-card]:has(.dqp-notice){padding-top:82px}
.dqp-bar{position:absolute;top:0;left:0;right:0;height:44px;box-sizing:border-box;display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:22px 22px 0 0;background:color-mix(in srgb,var(--dsw-specific-input-major,#152435) 94%,var(--dsw-alias-label-primary,#ddd) 6%);pointer-events:auto}
.dqp-bar:after{content:'';position:absolute;bottom:0;left:12px;right:12px;height:1px;background:var(--dsw-alias-border-l3,#ffffff20);pointer-events:none}
.dqp-items{display:flex;flex:1;gap:6px;align-items:center;overflow-x:auto;overflow-y:hidden;min-width:0;max-height:30px;scrollbar-width:thin}
.dqp-task-chip{display:inline-flex;align-items:center;flex:none;border-radius:9px;background:var(--dsw-alias-interactive-bg-hover,#ffffff12)}
.dqp-bar button{appearance:none;flex:none;height:28px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#b7c6d5);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap}
.dqp-bar button:hover{background:var(--dsw-alias-bg-layer-3,#ffffff15);color:var(--dsw-alias-label-primary,#edf4fa)}
.dqp-bar .dqp-add{width:28px;padding:0;display:grid;place-items:center}
.dqp-bar .dqp-task-edit{width:25px;padding:0;display:grid;place-items:center}
.dqp-bar button:disabled{opacity:.45;cursor:default}
.dqp-panel-trigger{margin-left:auto;display:flex;gap:6px;align-items:center}
.dqp-notice{position:absolute;top:46px;left:12px;right:12px;line-height:28px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#ef9398;font-size:12px}
.dqp-backdrop{position:fixed;inset:0;z-index:11020;display:grid;place-items:center;padding:20px;background:#040a12a8;backdrop-filter:blur(6px)}
.dqp-dialog{width:440px;max-width:100%;max-height:calc(100vh - 40px);overflow:auto;box-sizing:border-box;padding:24px;border:1px solid var(--dsw-alias-border-l2,#899bb433);border-radius:16px;background:var(--dsw-alias-bg-layer-3,#152333);color:var(--dsw-alias-label-primary,#e1eaf3);box-shadow:0 20px 70px #0007;display:flex;flex-direction:column;gap:18px;font:13px/1.6 var(--moss-text,system-ui)}
.dqp-dialog h3{margin:0;font-size:17px}.dqp-dialog label{display:flex;flex-direction:column;gap:7px}.dqp-dialog :is(input,textarea,select){width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2,#899bb433);border-radius:8px;background:var(--dsw-alias-bg-layer-2,#101b29);color:inherit;font:inherit}.dqp-dialog textarea{min-height:170px;resize:vertical;line-height:1.7}.dqp-dialog small{color:var(--dsw-alias-label-tertiary,#8ea4b8)}.dqp-dialog footer{display:flex;gap:8px;justify-content:flex-end}.dqp-dialog button{padding:8px 15px;border:1px solid var(--dsw-alias-border-l2,#899bb433);border-radius:8px;background:var(--dsw-alias-bg-layer-2,#101b29);color:inherit;cursor:pointer;font:inherit}.dqp-dialog .dqp-save{background:#c7dce9;color:#14202c;border-color:transparent}.dqp-dialog .dqp-delete{margin-right:auto;color:#ef9398}.dqp-dialog button:disabled{opacity:.5;cursor:default}.dqp-dialog [role=alert]{color:#ef9398;margin:0}
.dqp-model-field{display:flex;flex-direction:column;gap:7px}.dqp-model-field select{min-height:42px}.dqp-model-message{display:flex;align-items:center;gap:8px;font-size:12px}.dqp-model-message button{flex:none;padding:3px 8px}.dqp-model-warning{color:#efb26e!important}
/* One grid owns the host's message scroller (including its sticky composer)
   and our task seat. No fixed layer or reserved body padding is involved. */
.dqp-dock-seat{display:none}
[data-conversation-content]:has(> .dqp-dock-seat > .dqp-dock:not([hidden])){
  display:grid;grid-template-columns:minmax(0,1fr) clamp(280px,28%,360px);grid-template-rows:minmax(0,1fr);
  --dsh-chat-content-width:min(var(--dsh-chat-user-width,920px),calc(100% - 48px));
  --dsh-composer-card-max-width:calc(var(--dsh-chat-content-width) + 32px);
}
[data-conversation-content]:not([data-dqp-layout=stacked]):has(> .dqp-dock-seat > .dqp-dock:not([hidden]) .dqp-terminal-card){grid-template-columns:minmax(0,1fr) clamp(340px,34%,460px)}
[data-conversation-content]:has(> .dqp-dock-seat > .dqp-dock:not([hidden]))>[data-conversation-scroll]{grid-column:1;grid-row:1;min-width:0;overflow-x:hidden}
[data-conversation-content]:has(> .dqp-dock-seat > .dqp-dock:not([hidden]))>[data-width-handle]{display:none}
.dqp-dock-seat:has(> .dqp-dock:not([hidden])){
  grid-column:2;grid-row:1;display:flex;min-width:0;min-height:0;overflow:hidden;
  background:transparent;
}
.dqp-dock[hidden]{display:none}
.dqp-dock{display:flex;flex:1;flex-direction:column;min-width:0;min-height:0;overflow:hidden;box-sizing:border-box;color:var(--dsw-alias-label-primary,#dce7ef);font:12px/1.6 var(--moss-text,system-ui)}
[data-conversation-content][data-dqp-layout=stacked]:has(> .dqp-dock-seat > .dqp-dock:not([hidden])){grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) minmax(0,min(220px,35%))}
[data-dqp-layout=stacked]>.dqp-dock-seat:has(> .dqp-dock:not([hidden])){grid-column:1;grid-row:2}
.dqp-dock-body{flex:1;overflow:auto;padding:12px 10px;min-height:0;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#839eb644 transparent;scrollbar-gutter:stable}
.dqp-run-card{padding:13px;margin-bottom:10px;border:1px solid var(--dsw-alias-border-l3,#a1b7cc22);border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-bg-base,#101c29) 93%,#9ab9d1 7%)}
.dqp-run-actions{display:flex;align-items:center;gap:5px;margin:-5px -5px 8px 0;color:var(--dsw-alias-label-tertiary,#8ea4b8)}
.dqp-run-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}
.dqp-run-actions button{appearance:none;border:0;background:transparent;color:inherit;font:inherit;font-size:11px;padding:3px 6px;border-radius:5px;cursor:pointer}
.dqp-run-actions button:hover{background:#ffffff0d;color:#ed969c}.dqp-run-actions button:disabled{opacity:.45;cursor:default}.dqp-run-actions button:focus-visible{outline:1px solid #a3c8e1;outline-offset:1px}
.dqp-run-card:last-child{margin-bottom:0}
.dqp-live-output{margin:0;min-height:24px;max-height:min(340px,45vh);overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;font:12px/1.85 var(--moss-text,system-ui);color:var(--dsw-alias-label-secondary,#c1d3e1);white-space:pre-wrap;overflow-wrap:anywhere}
.dqp-live-pending{display:flex;flex-direction:column;gap:8px;padding:3px 0;opacity:.5;animation:dqp-pending 1.8s ease-in-out infinite}
.dqp-live-pending i{display:block;height:5px;width:88%;border-radius:3px;background:color-mix(in srgb,var(--dsw-alias-label-primary,#dce7ef) 16%,transparent)}
.dqp-live-pending i:nth-child(2){width:66%}.dqp-live-pending i:nth-child(3){width:40%}
.dqp-dialog :is(button,input,textarea,select):focus-visible,.dqp-bar button:focus-visible,.dqp-dock-body:focus-visible,.dqp-live-output:focus-visible{outline:2px solid #a3c8e1;outline-offset:2px}
@keyframes dqp-pending{50%{opacity:.22}}@media(prefers-reduced-motion:reduce){.dqp-live-pending{animation:none!important}}body[data-moss-motion=off] .dqp-live-pending{animation:none}
@media(max-width:600px){.dqp-panel-trigger{font-size:10px!important}}
.dqp-bar button.dqp-terminal{width:28px;padding:0;display:grid;place-items:center;background:transparent!important;border:0!important;box-shadow:none!important;border-radius:0}
.dqp-bar button.dqp-terminal:hover{background:transparent!important;color:var(--dsw-alias-label-primary,#edf4fa)}
.dqp-bar .dqp-terminal[aria-pressed=true]{color:var(--dsw-alias-label-primary,#edf4fa)}
.dqp-run-state{margin-left:6px;font-style:normal;font-size:10px;color:#ef9398}
.dqp-run-card[data-run-status=failed]{border-color:#ef939855}
.dqp-run-error{margin:0 0 8px;color:#ef9398;font-size:11px;line-height:1.6;overflow-wrap:anywhere}
.dqp-terminal-card{position:relative;display:flex;flex-direction:column;min-height:220px;margin-bottom:10px;border:1px solid var(--dsw-alias-border-l3,#a1b7cc22);border-radius:9px;overflow:hidden;background:var(--dsw-alias-bg-base,#101c29)}
.dqp-terminal-card:last-child{margin-bottom:0}
/* A single hairline frames the borrowed terminal; the official header stays. */
.dqp-terminal-overlay{position:absolute;top:0;right:0;z-index:12;display:flex;gap:2px;padding:3px}
.dqp-terminal-overlay button{appearance:none;height:22px;padding:0 7px;border:0;border-radius:5px;background:#0b1723cc;color:var(--dsw-alias-label-secondary,#b7c6d5);font:11px/1 var(--moss-text,system-ui);cursor:pointer;opacity:.45}
.dqp-terminal-overlay:hover{opacity:1}
.dqp-terminal-overlay button:hover{background:#152435e6;color:var(--dsw-alias-label-primary,#edf4fa)}
.dqp-terminal-overlay button:focus-visible{outline:2px solid #a3c8e1;outline-offset:1px}
.dqp-terminal-overlay button:disabled{cursor:default;opacity:.3}
.dqp-terminal-body{height:230px;min-height:160px;overflow:hidden;color:var(--dsw-alias-label-tertiary);font-size:11px}
.dqp-terminal-overlay{border-radius:8px 8px 0 0}
.dqp-terminal-body:has(.dqp-terminal-return){border:1px solid var(--dsw-alias-border-l3,#a1b7cc22);background:color-mix(in srgb,var(--dsw-alias-bg-base,#101c29) 93%,#9ab9d1 7%)}
[data-dqp-official-terminal]{position:fixed!important;left:var(--dqp-terminal-left)!important;top:var(--dqp-terminal-top)!important;width:var(--dqp-terminal-width)!important;height:var(--dqp-terminal-height)!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;transform:none!important;clip-path:var(--dqp-terminal-clip);visibility:var(--dqp-terminal-visibility)!important;z-index:70!important}
/* The native pane sits inside the card's 1px border: 9px outer, 8px inner. */
[data-dqp-official-terminal]{border:0!important;border-radius:8px!important;corner-shape:round;box-shadow:none!important;overflow:hidden!important}
[data-dqp-official-terminal] [data-dockkit-float-grip]{box-sizing:border-box;height:30px!important;min-height:0!important;padding:0 7px!important;gap:4px;align-items:center}
[data-dqp-official-terminal] [data-dockkit-float-title]{height:24px;min-height:0;padding:0 4px;font-size:12px;line-height:24px}
[data-dqp-official-terminal] :is([data-dockkit-float-dock],[data-dockkit-float-close]){box-sizing:border-box;width:24px;height:24px;min-height:0;padding:3px}
[data-dqp-official-terminal] [data-dockkit-float-grip] svg{width:14px;height:14px}
.dqp-terminal-error{margin:6px 0 0;color:#ef9398;font-size:11px;display:flex;align-items:center;gap:8px}
.dqp-terminal-error button{appearance:none;border:1px solid #ef939855;border-radius:5px;background:transparent;color:inherit;font:inherit;font-size:11px;padding:2px 8px;cursor:pointer}
/* Lightweight conversations: plain text, scoped scrolling, small local composer. */
.dqp-conversation{display:flex;flex-direction:column;min-height:210px;contain:layout style}
.dqp-conversation .dqp-run-actions{margin-bottom:10px}
.dqp-conversation-state{font-size:10px;white-space:nowrap;color:var(--dsw-alias-label-tertiary,#8ea4b8)}
.dqp-conversation[data-run-status=running] .dqp-conversation-state{color:#a3c8e1}
.dqp-conversation-messages{min-height:70px;max-height:min(400px,48vh);overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;overflow-wrap:anywhere;padding-right:3px}
.dqp-message{margin:0 0 13px;font-size:12px;line-height:1.8}
.dqp-message small{display:block;margin-bottom:3px;font-size:10px;color:var(--dsw-alias-label-tertiary,#8ea4b8)}
.dqp-message>div{white-space:pre-wrap}
.dqp-message-user{margin-left:16px;padding:7px 9px;border-radius:8px;background:var(--dsw-alias-interactive-bg-hover,#ffffff09)}
.dqp-message-assistant{color:var(--dsw-alias-label-primary,#dce7ef)}
.dqp-conversation-progress{padding:2px 0 9px;font-size:11px;color:var(--dsw-alias-label-tertiary,#8ea4b8)}
.dqp-conversation-input{display:flex;align-items:flex-end;gap:6px;margin-top:10px;padding-top:9px;border-top:1px solid var(--dsw-alias-border-l3,#a1b7cc22)}
.dqp-conversation-input textarea{display:block;flex:1;min-width:0;min-height:44px;max-height:140px;resize:vertical;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l3,#a1b7cc22);border-radius:7px;padding:7px 8px;background:var(--dsw-alias-bg-base,#101c29);color:inherit;font:12px/1.6 var(--moss-text,system-ui)}
.dqp-conversation-input button{flex:none;padding:7px 9px;border:0;border-radius:6px;background:#c7dce9;color:#14202c;font:11px/1.5 var(--moss-text,system-ui);cursor:pointer}
.dqp-conversation-input button:disabled{opacity:.4;cursor:default}
.dqp-conversation-input :is(textarea,button):focus-visible,.dqp-conversation-messages:focus-visible{outline:2px solid #a3c8e1;outline-offset:1px}
.dqp-terminal-return{display:grid;align-content:center;justify-items:start;gap:8px;height:100%;padding:12px}.dqp-terminal-return p{margin:0}.dqp-terminal-return button{padding:6px 10px;border:1px solid var(--dsw-alias-border-l3,#a1b7cc22);border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary,#dce7ef);font:inherit;cursor:pointer}
`
