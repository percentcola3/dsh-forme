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
  background:transparent;
}
.dqp-dock{display:flex;flex:1;flex-direction:column;min-width:0;min-height:0;overflow:hidden;box-sizing:border-box;color:var(--dsw-alias-label-primary,#dce7ef);font:12px/1.6 var(--moss-text,system-ui)}
[data-conversation-content][data-dqp-layout=stacked]:has(> .dqp-dock-seat > .dqp-dock){grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) minmax(0,min(220px,35%))}
[data-dqp-layout=stacked]>.dqp-dock-seat:has(> .dqp-dock){grid-column:1;grid-row:2}
.dqp-dock-body{flex:1;overflow:auto;padding:12px 10px;min-height:0;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#839eb644 transparent;scrollbar-gutter:stable}
.dqp-run-card{padding:13px;margin-bottom:10px;border:1px solid var(--dsw-alias-border-l3,#a1b7cc22);border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-bg-base,#101c29) 93%,#9ab9d1 7%)}
.dqp-run-card:last-child{margin-bottom:0}
.dqp-live-output{margin:0;min-height:24px;max-height:min(340px,45vh);overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;font:12px/1.85 var(--moss-text,system-ui);color:var(--dsw-alias-label-secondary,#c1d3e1);white-space:pre-wrap;overflow-wrap:anywhere}
.dqp-live-pending{display:flex;flex-direction:column;gap:8px;padding:3px 0;opacity:.5;animation:dqp-pending 1.8s ease-in-out infinite}
.dqp-live-pending i{display:block;height:5px;width:88%;border-radius:3px;background:color-mix(in srgb,var(--dsw-alias-label-primary,#dce7ef) 16%,transparent)}
.dqp-live-pending i:nth-child(2){width:66%}.dqp-live-pending i:nth-child(3){width:40%}
.dqp-dialog :is(button,input,textarea):focus-visible,.dqp-bar button:focus-visible,.dqp-dock-body:focus-visible,.dqp-live-output:focus-visible{outline:2px solid #a3c8e1;outline-offset:2px}
@keyframes dqp-pending{50%{opacity:.22}}@media(prefers-reduced-motion:reduce){.dqp-live-pending{animation:none!important}}body[data-moss-motion=off] .dqp-live-pending{animation:none}
@media(max-width:600px){.dqp-panel-trigger{font-size:10px!important}}
`
