export const styles = `
[data-composer-card]:has(.dqp-bar){padding-top:52px}
[data-composer-card]:has(.dqp-notice){padding-top:82px}
.dqp-bar{position:absolute;top:0;left:0;right:0;height:44px;box-sizing:border-box;display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:22px 22px 0 0;background:color-mix(in srgb,var(--dsw-specific-input-major,#152435) 94%,var(--dsw-alias-label-primary,#ddd) 6%);pointer-events:auto}
.dqp-bar:after{content:'';position:absolute;bottom:0;left:12px;right:12px;height:1px;background:var(--dsw-alias-border-l3,#ffffff20);pointer-events:none}
.dqp-items{display:flex;flex:1;gap:6px;align-items:center;overflow-x:auto;overflow-y:hidden;min-width:0;max-height:30px;scrollbar-width:thin}
.dqp-task-chip{display:inline-flex;align-items:center;flex:none;border-radius:9px;background:var(--dsw-alias-interactive-bg-hover,#ffffff12)}
.dqp-bar button{appearance:none;flex:none;height:28px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#b7c6d5);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap}
.dqp-bar button:hover{background:var(--dsw-alias-bg-layer-3,#ffffff15);color:var(--dsw-alias-label-primary,#edf4fa)}
.dqp-bar .dqp-add{width:28px;padding:0;font-size:20px}
.dqp-bar .dqp-task-edit{width:25px;padding:0;display:grid;place-items:center}
.dqp-bar button:disabled{opacity:.45;cursor:default}
.dqp-panel-trigger{margin-left:auto;display:flex;gap:6px;align-items:center}
.dqp-notice{position:absolute;top:46px;left:12px;right:12px;line-height:28px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#ef9398;font-size:12px}
.dqp-backdrop{position:fixed;inset:0;z-index:11020;display:grid;place-items:center;padding:20px;background:#040a12a8;backdrop-filter:blur(6px)}
.dqp-dialog{width:440px;max-width:100%;max-height:calc(100vh - 40px);overflow:auto;box-sizing:border-box;padding:24px;border:1px solid var(--dsw-alias-border-l2,#899bb433);border-radius:16px;background:var(--dsw-alias-bg-layer-3,#152333);color:var(--dsw-alias-label-primary,#e1eaf3);box-shadow:0 20px 70px #0007;display:flex;flex-direction:column;gap:18px;font:13px/1.6 var(--moss-text,system-ui)}
.dqp-dialog h3{margin:0;font-size:17px}.dqp-dialog label{display:flex;flex-direction:column;gap:7px}.dqp-dialog :is(input,textarea){width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2,#899bb433);border-radius:8px;background:var(--dsw-alias-bg-layer-2,#101b29);color:inherit;font:inherit}.dqp-dialog textarea{min-height:170px;resize:vertical;line-height:1.7}.dqp-dialog small{color:var(--dsw-alias-label-tertiary,#8ea4b8)}.dqp-dialog footer{display:flex;gap:8px;justify-content:flex-end}.dqp-dialog button{padding:8px 15px;border:1px solid var(--dsw-alias-border-l2,#899bb433);border-radius:8px;background:var(--dsw-alias-bg-layer-2,#101b29);color:inherit;cursor:pointer;font:inherit}.dqp-dialog .dqp-save{background:#c7dce9;color:#14202c;border-color:transparent}.dqp-dialog .dqp-delete{margin-right:auto;color:#ef9398}.dqp-dialog button:disabled{opacity:.5;cursor:default}.dqp-dialog [role=alert]{color:#ef9398;margin:0}
/* One grid owns the host's message scroller (including its sticky composer)
   and our task seat. No fixed layer or reserved body padding is involved. */
.dqp-dock-seat{display:none}
[data-conversation-content]:has(> .dqp-dock-seat > .dqp-dock){
  display:grid;grid-template-columns:minmax(0,1fr) clamp(250px,26%,320px);grid-template-rows:minmax(0,1fr);
  --dsh-chat-content-width:min(var(--dsh-chat-user-width,920px),calc(100% - 48px));
  --dsh-composer-card-max-width:calc(var(--dsh-chat-content-width) + 32px);
}
[data-conversation-content]:has(> .dqp-dock-seat > .dqp-dock)>[data-conversation-scroll]{grid-column:1;grid-row:1;min-width:0;overflow-x:hidden}
[data-conversation-content]:has(> .dqp-dock-seat > .dqp-dock)>[data-width-handle]{display:none}
.dqp-dock-seat:has(> .dqp-dock){
  grid-column:2;grid-row:1;display:flex;min-width:0;min-height:0;overflow:hidden;
  border-left:1px solid var(--dsw-alias-border-l3,#9db8ca22);
  background:color-mix(in srgb,var(--dsw-alias-bg-base,#101c29) 92%,#9ab9d1 8%);
}
.dqp-dock{display:flex;flex:1;flex-direction:column;min-width:0;min-height:0;overflow:hidden;box-sizing:border-box;color:var(--dsw-alias-label-primary,#dce7ef);font:12px/1.6 var(--moss-text,system-ui)}
[data-conversation-content][data-dqp-layout=stacked]:has(> .dqp-dock-seat > .dqp-dock){grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) minmax(0,min(220px,35%))}
[data-dqp-layout=stacked]>.dqp-dock-seat:has(> .dqp-dock){grid-column:1;grid-row:2;border-left:0;border-top:1px solid var(--dsw-alias-border-l3,#9db8ca22)}
.dqp-dock-head{display:flex;align-items:center;gap:9px;min-height:42px;box-sizing:border-box;padding:8px 12px;border-bottom:1px solid #b9d3e416;flex:none}
.dqp-dock-head strong{font-size:12px;font-weight:600}
.dqp-dock-count{font-size:10px;color:#8ca7ba}
.dqp-dock button{cursor:pointer;font:inherit;color:inherit}
.dqp-dock-head button{display:grid;place-items:center;margin-left:auto;width:24px;height:24px;padding:0;border:0;border-radius:5px;background:transparent;color:#9eb6c9}
.dqp-dock-head button:hover{background:#adc9db12;color:#e2eff7}
.dqp-dock-body{flex:1;overflow:auto;padding:8px;min-height:0;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#839eb644 transparent;scrollbar-gutter:stable}
.dqp-dock-empty{padding:18px 8px;text-align:center;color:#8faabd;font-size:11px}
.dqp-run-card{padding:10px;margin-bottom:7px;border:1px solid #a1b7cc1b;border-radius:8px;background:#8faec207}
.dqp-run-card:last-child{margin-bottom:0}
.dqp-run-heading{display:flex;gap:7px;align-items:center}
.dqp-run-heading strong{flex:1;min-width:0;font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dqp-run-status{font-size:10px;white-space:nowrap;color:#a9bfce}
.dqp-run-status[data-status=completed]{color:#8ecdbd}
.dqp-run-status[data-status=failed],.dqp-run-status[data-status=waiting]{color:#ef9298}
.dqp-run-meta{display:flex;gap:10px;color:#7694ab;font-size:10px;margin-top:3px}
.dqp-run-meta span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dqp-run-meta time{font-variant-numeric:tabular-nums}
.dqp-run-progress{margin-top:7px;font-size:11px;color:#9eb8cb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dqp-run-preview{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-wrap;overflow-wrap:anywhere;margin:7px 0 0;color:#b4c9d8;font-size:11px;line-height:1.65}
.dqp-run-error{white-space:pre-wrap;overflow-wrap:anywhere;color:#f1a3a5;margin-top:7px;font-size:11px}
.dqp-run-details{margin-top:8px;padding-top:8px;border-top:1px solid #a8c2d415}
.dqp-run-output{font:11px/1.75 var(--moss-text,system-ui);white-space:pre-wrap;overflow-wrap:anywhere;max-height:150px;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;margin:6px 0 0;color:#c1d3e1}
.dqp-run-tools{list-style:none;margin:0;padding:0;color:#8faec2;font:10px/1.8 var(--moss-code,monospace)}
.dqp-run-tools li{display:flex;gap:8px}.dqp-run-tools span{flex:1;min-width:0;overflow-wrap:anywhere}.dqp-run-tools b{font-weight:400;color:#7b9aac;white-space:nowrap}
.dqp-run-actions{display:flex;gap:10px;align-items:center;margin-top:8px}
.dqp-run-actions button{display:inline-flex;align-items:center;gap:4px;border:0;border-radius:4px;padding:2px 0;background:transparent;font-size:10px;color:#89a9c0}
.dqp-run-actions button:hover{color:#dcecf7}.dqp-run-actions button:disabled{opacity:.35;cursor:default}
.dqp-run-actions .dqp-run-record{margin-left:auto}
.dqp-run-actions .dqp-run-stop{padding:2px 6px;background:#e9778010;color:#f1a3a5}
.dqp-dot{width:5px;height:5px;border-radius:50%;background:#7b98ac;flex:none}
.dqp-dot[data-status=running],.dqp-dot[data-status=starting]{background:#b2d8ef;box-shadow:0 0 8px #98c7e188;animation:dqp-breathe 1.7s ease-in-out infinite}
.dqp-dot[data-status=completed]{background:#84c9b4}
.dqp-dot[data-status=failed],.dqp-dot[data-status=waiting]{background:#e97780}
.dqp-dock-error{margin:0 0 8px;padding:8px;border:1px solid #ed8c9626;border-radius:6px;color:#f2a2a5;font-size:11px;overflow-wrap:anywhere}
.dqp-dialog :is(button,input,textarea):focus-visible,.dqp-bar button:focus-visible,.dqp-dock button:focus-visible,.dqp-dock-body:focus-visible,.dqp-run-output:focus-visible{outline:2px solid #a3c8e1;outline-offset:2px}
@keyframes dqp-breathe{50%{opacity:.35;box-shadow:0 0 3px #98c7e144}}@media(prefers-reduced-motion:reduce){.dqp-dot{animation:none!important}}body[data-moss-motion=off] .dqp-dot{animation:none}
@media(max-width:600px){.dqp-panel-trigger{font-size:10px!important}}
`
