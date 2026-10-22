export const earthCSS = `
/* ── Shared WebGL scene with a CSS fallback underneath ─────────── */
.moss-scene { position:relative; display:block; overflow:hidden; width:100%; height:100%; isolation:isolate; }
.moss-scene * { pointer-events:none; }
/* Keep loading transparent; reveal only a complete WebGL frame. */
.moss-scene-canvas { position:absolute; inset:0; width:100%; height:100%; display:block; opacity:0; transition:opacity .18s ease; }
.moss-scene-canvas[data-ready="true"] { opacity:1; }
.moss-scene-fallback { position:absolute; inset:0; opacity:0; }
.moss-scene:has(.moss-scene-canvas[data-failed="true"]) .moss-scene-fallback { opacity:1; }
.moss-fallback-earth { position:absolute; aspect-ratio:1; border-radius:50%; transform:translate(-50%,-50%);
  background:radial-gradient(circle at 62% 34%,#effaff 0,#a6d9ec 20%,#62a8c9 45%,#3c7597 74%,#25485e 100%);
  box-shadow:0 0 0 1px #8cc8ff22, 0 0 24px #6fb6ff44, inset -10px -8px 24px #16344b66; }
.moss-fallback-tail { position:absolute; height:62%;
  clip-path:polygon(100% 0,88% 5%,72% 18%,54% 33%,32% 39%,0 42%,0 58%,32% 61%,54% 67%,72% 82%,88% 95%,100% 100%);
  background:linear-gradient(270deg,#d1f4ff 0,#85c9efaa 18%,#5d98bf44 55%,transparent);
  filter:blur(3px); opacity:calc(var(--thrust,.4) * .9); }
.moss-scene[data-status="working"] { --thrust:1; } .moss-scene[data-status="connecting"] { --thrust:.62; }
.moss-scene[data-status="waiting"] { --thrust:.22; }
.moss-scene[data-status="error"],.moss-scene[data-status="offline"] { --thrust:.1; }
.moss-scene-hero .moss-fallback-earth,.moss-scene-console .moss-fallback-earth { left:66%; top:50%; height:62%; }
.moss-scene-hero .moss-fallback-tail,.moss-scene-console .moss-fallback-tail { right:34%; top:50%; width:72%; transform:translateY(-50%); }
.moss-scene-loading .moss-fallback-earth { left:10px; right:auto; top:50%; height:62%; transform:translateY(-50%); }
.moss-scene-loading .moss-fallback-tail { left:24px; right:auto; top:50%; width:90%; transform:translateY(-50%) scaleX(-1); }

/* ── New-conversation hero ─────────────────────────────────────── */
.moss-hero { position:relative; display:flex; flex-direction:column; align-items:center; width:min(760px,calc(100vw - 48px)); gap:0; }
.moss-hero-stage { position:relative; width:100%; height:260px;
  -webkit-mask:radial-gradient(ellipse 60% 75% at 50% 50%,#000 55%,#0000 100%); mask:radial-gradient(ellipse 60% 75% at 50% 50%,#000 55%,#0000 100%); }
.moss-hero-subtitle { display:flex; align-items:center; gap:10px; margin-top:14px; padding-bottom:6px; color:#b6bdc7; font:9px/1.6 var(--moss-display,'MOSS Rajdhani',sans-serif); letter-spacing:.38em; }
.moss-hero-subtitle::before,.moss-hero-subtitle::after { content:''; width:28px; height:1px; background:linear-gradient(90deg,transparent,#df4e5488); }
.moss-hero-subtitle::after { transform:scaleX(-1); }
/* The host inserts a slot wrapper inside its mark span. Hide only the adjacent
   native headline/badge while our Earth owns that mark; theme-off restores it. */
body[data-moss-theme="on"] [data-moss-hero-sibling] { display:none; }

/* ── Chat running row: the host's "deep diving" line becomes a flight strip ── */
body[data-moss-theme="on"] [data-chat-running][data-moss-run] { align-items:stretch; }
body[data-moss-theme="on"] [data-chat-running][data-moss-run] > :not(.moss-run-host):not([role="status"]) { display:none; }
.moss-run-host { display:block; width:100%; }
.moss-run { position:relative; display:flex; align-items:center; width:100%; height:44px; overflow:hidden; box-sizing:border-box; border:0; border-radius:0; background:transparent; box-shadow:none; }
/* Stars and wake blend into the conversation instead of sitting in a dark card.
   The transparent right fade leaves the host's elapsed time readable. */
.moss-run .moss-scene { position:absolute; inset:0;
  -webkit-mask-image:linear-gradient(90deg,transparent,#000 2%,#000 76%,transparent),linear-gradient(180deg,transparent,#000 18%,#000 82%,transparent);
  -webkit-mask-composite:source-in;
  mask-image:linear-gradient(90deg,transparent,#000 2%,#000 76%,transparent),linear-gradient(180deg,transparent,#000 18%,#000 82%,transparent);
  mask-composite:intersect; }
.moss-run-time { position:relative; z-index:1; margin-left:auto; padding:0 14px; text-align:right; color:#c2c8d1; font:500 15px/1 var(--moss-display,'MOSS Rajdhani',sans-serif); letter-spacing:.06em; font-variant-numeric:tabular-nums; }

/* Compact preset action lives in the header console. */
.moss-connect { appearance:none; flex-shrink:0; white-space:nowrap; padding:6px 14px; border:1px solid #e3444880; border-radius:3px; background:#e3444814; color:#f2c1c4; cursor:pointer; font:600 11px/1.4 ui-monospace,'SF Mono',Menlo,'PingFang SC',monospace; letter-spacing:2px; transition:background .15s,border-color .15s; }
.moss-console .moss-connect { color:#f2c1c4; font-size:11px !important; }
.moss-connect:hover, .moss-console .moss-connect:hover { background:#e3444826; border-color:#e34448; color:#fff; }
.moss-connect:focus-visible { outline:2px solid #e34448; outline-offset:2px; }

body[data-moss-motion="off"] .moss-scene-canvas { transition:none; }
@media(max-width:600px) {
  .moss-hero-subtitle { letter-spacing:.18em; white-space:nowrap; font-size:8px; } .moss-hero-subtitle::before,.moss-hero-subtitle::after { width:14px; }
  .moss-hero-stage { height:190px; }
}
`
