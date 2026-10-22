export const repositoryStyles = `
.dgp-repository-menu { min-width:0; max-height:min(70vh,620px); overflow:auto; }
.dgp-repository-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:2px 4px 6px; font-size:12px; }
.dgp-repository-heading button { border:0; background:transparent; color:var(--dsw-alias-label-secondary); font:inherit; font-size:11px; cursor:pointer; }
.dgp-repository-menu .dgp-hint,.dgp-repository-menu .dgp-error { margin:3px 0; padding:3px 5px; font-size:11px; line-height:1.4; }
.dgp-repository-tree,.dgp-repository-tree ul { list-style:none; padding:0; margin:0; }
.dgp-repository-tree ul { margin-left:6px; padding-left:6px; border-left:1px solid var(--dsw-alias-border-l2); }
.dgp-repository-row { display:flex; align-items:center; gap:4px; min-width:0; height:25px; padding:0 3px; }
.dgp-repository-row:hover { background:var(--dsw-alias-interactive-bg-hover); }
.dgp-repository-toggle { appearance:none; flex:1; min-width:0; height:25px; display:flex; align-items:center; gap:4px; padding:0; border:0; background:transparent; color:var(--dsw-alias-label-secondary); text-align:left; font:inherit; font-size:12px; cursor:pointer; }
.dgp-repository-chevron { width:10px; flex:none; font-size:10px; }
.dgp-repository-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dgp-repository-kind { flex:none; font-size:10px; color:var(--dsw-alias-label-tertiary); }
.dgp-repository-current { appearance:none; display:flex; align-items:center; gap:4px; height:23px; max-width:46%; padding:0 4px; border:0; border-radius:3px; background:transparent; color:var(--dsw-alias-label-secondary); font:inherit; font-size:11px; cursor:pointer; }
.dgp-repository-current span:first-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dgp-repository-current:hover:not(:disabled) { background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); }
.dgp-repository-current:disabled { opacity:.6; cursor:default; }
.dgp-repository-branches { margin:2px 0 4px 13px; padding:4px; border:1px solid var(--dsw-alias-border-l2); border-radius:4px; }
.dgp-repository-branches .dgp-branch-results { max-height:220px; overflow:auto; margin:0; padding:0; border:0; }
.dgp-repository-branches .dgp-branch { width:100%; min-width:0; min-height:24px; padding:3px 5px; border-radius:3px; font-size:11px; line-height:18px; font-weight:400; box-shadow:none; background:transparent; color:var(--dsw-alias-label-secondary); }
.dgp-repository-branches .dgp-branch:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); }
.dgp-repository-branches .dgp-branch span:first-child { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dgp-repository-branches .dgp-branch span:last-child { flex:none; color:var(--dsw-alias-label-tertiary); }
.dgp-repository-branches .dgp-branch:disabled { opacity:1; }
.dgp-branch-search { box-sizing:border-box; width:100%; height:26px; margin:0 0 3px; padding:3px 6px; border:1px solid var(--dsw-alias-border-l2); border-radius:3px; background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); font:inherit; font-size:11px; }
.dgp-repository-toggle:focus-visible,.dgp-repository-current:focus-visible,.dgp-branch-search:focus-visible { outline:1px solid var(--dsw-alias-label-secondary); outline-offset:-1px; }
`
