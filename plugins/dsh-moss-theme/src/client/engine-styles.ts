export const engineCSS = `
/* The square box aligns with the mode controls; GPU content has no inline baseline. */
.moss-status-indicator.moss-engine { --engine:#c8b184; position:relative; display:inline-flex; align-items:center; justify-content:center; align-self:center; width:40px; height:32px; flex:0 0 40px; line-height:0; vertical-align:middle; }
.moss-engine-canvas,.moss-engine-art { position:absolute; inset:0; display:block; width:40px; height:32px; pointer-events:none; }
.moss-engine-canvas { opacity:0; }
.moss-engine-canvas[data-engine-ready="true"] { opacity:1; }
.moss-engine-art { overflow:visible; color:var(--engine); }
.moss-engine-art * { animation:none !important; transition:none !important; }
.moss-engine-canvas[data-engine-ready="true"] + .moss-engine-art > * { visibility:hidden; }
.moss-engine-canvas[data-engine-ready="true"] + .moss-engine-art > .moss-engine-pause,.moss-engine-canvas[data-engine-ready="true"] + .moss-engine-art > .moss-engine-fault,.moss-engine-canvas[data-engine-ready="true"] + .moss-engine-art > .moss-engine-disconnected { visibility:visible; }
[data-conversation-header-leading]:has(.moss-engine) { align-self:center; align-items:center; }
.moss-engine-corona { fill:currentColor; opacity:.16; filter:blur(1.4px); }
.moss-engine-plasma { fill:currentColor; opacity:.92; }
.moss-engine-filament { fill:none; stroke:#f6efdc; stroke-width:.9; stroke-linecap:round; opacity:.4; }
.moss-engine-ring-back { fill:none; stroke:#f4f1ea; stroke-width:2.6; opacity:.42; }
.moss-engine-ring-outer { fill:none; stroke:#f4f1ea; stroke-width:1.3; opacity:.5; }
.moss-engine-ring-front { fill:none; stroke:#f8f6f0; stroke-width:2.6; opacity:.92; }
.moss-engine[data-status="error"] .moss-engine-ring-back,.moss-engine[data-status="error"] .moss-engine-ring-front,.moss-engine[data-status="error"] .moss-engine-ring-outer { stroke:#ffaea4; }
.moss-engine-pause,.moss-engine-fault,.moss-engine-disconnected { display:none; stroke:#eef4fa; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; filter:drop-shadow(0 0 1px #0a1420); }
.moss-engine[data-status="connecting"] { --engine:#e0c89c; }
.moss-engine[data-status="working"] { --engine:#e8d5a0; }
.moss-engine[data-status="waiting"] { --engine:#e8b96e; }
.moss-engine[data-status="waiting"] .moss-engine-pause { display:block; }
.moss-engine[data-status="error"] { --engine:#ff6870; }
.moss-engine[data-status="error"] .moss-engine-fault { display:block; }
.moss-engine[data-status="error"] .moss-engine-fault path:first-child { fill:#ff687026; stroke-width:1.2; }
.moss-engine[data-status="offline"] { --engine:#8193a1; }
.moss-engine[data-status="offline"] .moss-engine-plasma { opacity:.35; }
.moss-engine[data-status="offline"] .moss-engine-filament { opacity:.25; }
.moss-engine[data-status="offline"] .moss-engine-ring-back { opacity:.2; }
.moss-engine[data-status="offline"] .moss-engine-ring-front { opacity:.35; }
.moss-engine[data-status="offline"] .moss-engine-disconnected { display:block; }
body[data-moss-motion="off"] .moss-engine *,body[data-moss-theme="off"] .moss-engine * { animation:none !important; transition:none !important; }
@media (prefers-reduced-motion:reduce) { .moss-engine * { animation:none !important; transition:none !important; } }
@media (forced-colors:active) {
  .moss-engine-canvas { display:none; }
  .moss-engine-canvas[data-engine-ready="true"] + .moss-engine-art > * { visibility:visible; }
  .moss-status-indicator.moss-engine { --engine:Canvas; }
  .moss-engine-corona,.moss-engine-plasma { fill:Canvas; }
  .moss-engine-filament { stroke:CanvasText; }
  .moss-engine-ring-back,.moss-engine-ring-front,.moss-engine-ring-outer { stroke:CanvasText; }
}
`
