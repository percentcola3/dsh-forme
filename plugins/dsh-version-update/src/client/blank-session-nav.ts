import type {Context} from '@deepseek-ai/cordis'
type List = {current?:string;byId:Record<string,{blank?:boolean}>}
export function hideBlankNavigation(list:List):boolean {
  return list.current!==undefined && list.byId[list.current]?.blank===true
}
/** Keep official session ownership intact; suppress only its provisional row. */
export function installBlankSessionNavigation(ctx:Pick<Context,'get'>):()=>void {
  const sessions=ctx.get('sessions') as {list:{getSnapshot():List;subscribe(fn:()=>void):()=>void}}|undefined
  if(!sessions)throw new Error('Blank session navigation requires the sessions service')
  const attribute='data-dsh-hide-blank-navigation'
  const style=document.createElement('style')
  // Pinned official ui-workspace CSS module class; no translated title matching.
  style.textContent=`html[${attribute}] [role="tree"] [role="treeitem"][aria-selected="true"][class*="_sessionRow"] { display:none !important; }`
  document.head.appendChild(style)
  const sync=()=>{
    const hide=hideBlankNavigation(sessions.list.getSnapshot())
    if(document.documentElement.hasAttribute(attribute)!==hide)document.documentElement.toggleAttribute(attribute,hide)
    document.dispatchEvent(new CustomEvent('dsh-performance',{detail:{kind:'blank-navigation',duration:hide?1:0}}))
  }
  sync()
  const unsubscribe=sessions.list.subscribe(sync)
  return()=>{unsubscribe();style.remove();document.documentElement.removeAttribute(attribute)}
}
