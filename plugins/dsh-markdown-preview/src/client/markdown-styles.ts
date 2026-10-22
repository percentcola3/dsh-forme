// Keep document styles out of chat, source previews, code tokens, and Mermaid labels.
const root = '[data-document-markdown]'
const prose = `${root} :where(:not([class*="dsh-mermaid-"], [class*="dsh-mermaid-"] *, .md-code-block *, svg *))`

export const markdownCSS = `
${root} {
  --dfp-md-ink:var(--dsw-alias-label-primary);
  --dfp-md-accent:var(--dsw-alias-state-business-primary);
  --dfp-md-line:var(--dsw-alias-border-l2);
  --dfp-md-surface:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));
  /* Theme text supplies most of each color, for contrast in both modes. */
  --dfp-md-h1:color-mix(in srgb,var(--dfp-md-ink) 72%,var(--dfp-md-accent));
  --dfp-md-h2:color-mix(in srgb,var(--dfp-md-ink) 72%,#648be8);
  --dfp-md-h3:color-mix(in srgb,var(--dfp-md-ink) 72%,#39a5a0);
  --dfp-md-h4:color-mix(in srgb,var(--dfp-md-ink) 72%,#a485d8);
  --dfp-md-h5:color-mix(in srgb,var(--dfp-md-ink) 72%,#c79448);
  --dfp-md-h6:color-mix(in srgb,var(--dfp-md-ink) 72%,#ca789b);
  box-sizing:border-box; width:100%; max-width:920px; min-width:0;
  margin-inline:auto; padding:clamp(20px,4%,48px) clamp(16px,5%,56px) 64px;
  color:var(--dfp-md-ink);
  font-family:var(--moss-text,var(--dsw-font-family,system-ui)),sans-serif;
  font-size:15px; line-height:1.8; overflow-wrap:anywhere;
}
${prose}:is(h1,h2,h3,h4,h5,h6) {
  margin-block:1.8em .65em; font-family:inherit; font-weight:650; line-height:1.35;
  text-wrap:pretty; scroll-margin-block-start:24px;
}
${prose}:is(h1) { color:var(--dfp-md-h1); font-size:2.15em; letter-spacing:-.025em; padding-block-end:.45em; border-bottom:2px solid color-mix(in srgb,currentColor 22%,transparent); }
${prose}:is(h2) { color:var(--dfp-md-h2); font-size:1.65em; letter-spacing:-.015em; padding-block-end:.35em; border-bottom:1px solid var(--dfp-md-line); }
${prose}:is(h3) { color:var(--dfp-md-h3); font-size:1.35em; }
${prose}:is(h4) { color:var(--dfp-md-h4); font-size:1.15em; }
${prose}:is(h5) { color:var(--dfp-md-h5); font-size:1.05em; }
${prose}:is(h6) { color:var(--dfp-md-h6); font-size:1em; }
${root} > :first-child > :first-child:is(h1,h2,h3),
${root} > :first-child:is(h1,h2,h3) { margin-block-start:0; }
${prose}:is(p) { margin-block:0 1.1em; line-height:inherit; }
${prose}:is(strong) { font-weight:650; }
${prose}:is(a,[role="link"]) {
  color:var(--dsw-alias-link,var(--dfp-md-h2));
  text-decoration:underline; text-decoration-thickness:1px; text-underline-offset:.2em;
  text-decoration-color:color-mix(in srgb,currentColor 55%,transparent);
}
${prose}:is(a,[role="link"]):hover { text-decoration-color:currentColor; text-decoration-thickness:2px; }
${prose}:is(a,button,input,summary,[tabindex]):focus-visible {
  outline:2px solid var(--dfp-md-accent); outline-offset:3px; border-radius:3px;
}
${prose}:is(blockquote) {
  margin:1.4em 0; padding:14px 20px; border:1px solid var(--dfp-md-line);
  border-inline-start:3px solid var(--dfp-md-h3); border-radius:0 8px 8px 0;
  background:color-mix(in srgb,var(--dfp-md-h3) 5%,var(--dsw-alias-bg-base));
  color:var(--dsw-alias-label-primary); font-style:normal;
}
${prose}:is(blockquote) > :last-child { margin-block-end:0; }
${prose}:is(ul,ol) { margin-block:.5em 1.2em; padding-inline-start:1.65em; }
${prose}:is(li) { margin-block:.3em; padding-inline-start:.25em; }
${prose}:is(li)::marker { color:var(--dfp-md-h3); font-weight:600; }
${prose}:is(li) > :is(ul,ol) { margin-block:.35em .6em; }
${prose}:is(li) > p { margin-block:.35em; }
${prose}:is(li):has(> input[type="checkbox"]) { list-style:none; }
${prose}:is(input[type="checkbox"]) {
  width:1em; height:1em; margin-inline:0 .5em; vertical-align:-.1em; accent-color:var(--dfp-md-h3);
}
/* A scrollable table retains native rows and columns without a DOM wrapper. */
${prose}:is(table) {
  display:block; width:max-content; max-width:100%; overflow-x:auto;
  margin-block:1.5em; border:1px solid var(--dfp-md-line); border-radius:8px;
  border-collapse:separate; border-spacing:0; font-size:.93em; overscroll-behavior-x:contain;
}
${prose}:is(th,td) { padding:10px 14px; border:0; border-bottom:1px solid var(--dfp-md-line); vertical-align:top; }
${prose}:is(th) { background:var(--dfp-md-surface); color:var(--dfp-md-ink); font-weight:650; }
${prose}:is(tr):last-child > td { border-bottom:0; }
${prose}:is(tbody) > tr:nth-child(even) { background:color-mix(in srgb,var(--dfp-md-ink) 3%,transparent); }
${prose}:is(caption) { padding:8px 12px; color:var(--dsw-alias-label-secondary); text-align:start; }
/* Leave token colors and the host's code wrapping controls intact. */
${prose}:is(code):not(:where(pre *, .md-code-block *)) {
  padding:.14em .38em; border:1px solid var(--dfp-md-line); border-radius:5px;
  background:var(--dsw-alias-markdown-inline-code,var(--dfp-md-surface));
  color:var(--dfp-md-h4); font-size:.88em; box-decoration-break:clone;
}
${prose}:is(pre):not(:where(.md-code-block *)) {
  max-width:100%; overflow:auto; box-sizing:border-box; margin-block:1.4em; padding:16px 20px;
  border:1px solid var(--dfp-md-line); border-radius:9px;
  background:var(--dsw-alias-markdown-code-block,var(--dfp-md-surface));
  font-size:.87em; line-height:1.65; tab-size:4; overflow-wrap:normal;
}
${root} :where(.md-code-block) {
  min-width:0; max-width:100%; margin-block:1.4em; border:1px solid var(--dfp-md-line); border-radius:9px;
}
${prose}:is(img) { display:block; max-width:100%; height:auto; margin-block:1.3em; border-radius:8px; }
${prose}:is(hr) { height:1px; margin-block:2.2em; border:0; background:var(--dfp-md-line); }

@media (max-width:600px) {
  ${root} { padding:20px 16px 40px; font-size:14px; }
  ${prose}:is(h1) { font-size:1.85em; }
  ${prose}:is(h2) { font-size:1.5em; }
  ${prose}:is(blockquote) { padding:12px 14px; }
  ${prose}:is(th,td) { padding:8px 10px; }
}
`
