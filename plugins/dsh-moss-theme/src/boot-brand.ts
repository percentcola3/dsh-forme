import { LOGO_URL } from './brand-art.ts'

/** Host boot DOM is addressed by its public markers, before client plugins mount. */
export const bootCSS = `
html[data-550w-boot="on"] [data-dsh-boot] { background:#0b0c0e; color:#e7e8eb; }
html[data-550w-boot="on"] [data-dsh-boot] > div > :first-child {
  width:260px; height:94px; margin:0 auto 28px; overflow:hidden; font-size:0;
  background:url("${LOGO_URL}") center/contain no-repeat;
  animation:w550-boot-reveal .8s ease-out both;
}
html[data-550w-boot="on"] [data-dsh-boot-spinner] {
  width:140px; height:2px; margin:0 auto 22px; border:0; border-radius:0;
  mask:none; -webkit-mask:none; background:linear-gradient(90deg,#dc1830 0 18%,#d0d4dc 18% 100%);
  animation:w550-boot-scan 1.8s ease-in-out infinite; transform:none;
}
html[data-550w-boot="on"] [data-dsh-boot] > div > :last-child { color:#aeb4bf; font:11px/1.6 -apple-system,'PingFang SC',sans-serif; letter-spacing:.08em; }
@keyframes w550-boot-reveal { from { opacity:.25; filter:blur(2px); } to { opacity:1; filter:blur(0); } }
@keyframes w550-boot-scan { 0%,100% { opacity:.4; } 50% { opacity:1; } }
html[data-550w-boot-motion="off"] [data-dsh-boot] > div > :first-child,
html[data-550w-boot-motion="off"] [data-dsh-boot-spinner] { animation:none !important; }
@media(prefers-reduced-motion:reduce) {
  html[data-550w-boot="on"] [data-dsh-boot] > div > :first-child,
  html[data-550w-boot="on"] [data-dsh-boot-spinner] { animation:none !important; }
}
`

/** Standalone body script, serialized into the host's supported index-inject hook. */
export function installBootBrand(): () => void {
  let preference: { enabled?: boolean; motion?: boolean } = {}
  try { preference = JSON.parse(localStorage.getItem('dsh-moss-theme:v1') ?? '{}') ?? {} } catch { /* Defaults. */ }
  if (preference.enabled === false) return () => {}
  document.documentElement.setAttribute('data-550w-boot', 'on')
  document.documentElement.setAttribute('data-550w-boot-motion', preference.motion === false ? 'off' : 'on')
  let seen = false
  const observer = new MutationObserver(() => scan())
  const scan = () => {
    const boot = document.querySelector('[data-dsh-boot]')
    const mark = boot?.firstElementChild?.firstElementChild
    if (mark && !mark.hasAttribute('data-550w-bootmark')) {
      mark.textContent = '550W'
      mark.setAttribute('data-550w-bootmark', '')
      mark.setAttribute('role', 'img')
      mark.setAttribute('aria-label', '550W 智能量子计算机')
      seen = true
    }
    if (seen && !boot) { observer.disconnect(); window.removeEventListener('pagehide', stop) }
  }
  const stop = () => { observer.disconnect(); window.removeEventListener('pagehide', stop) }
  observer.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true })
  window.addEventListener('pagehide', stop, { once: true })
  scan()
  return stop
}

export const bootScript = `;(${installBootBrand.toString()})();`
