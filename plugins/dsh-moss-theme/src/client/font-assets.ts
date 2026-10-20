import rajdhaniMedium from './fonts/rajdhani-500.woff2'
import rajdhaniSemibold from './fonts/rajdhani-600.woff2'
import sansRegular from './fonts/noto-sans-sc-400.woff2'
import sansSemibold from './fonts/noto-sans-sc-600.woff2'

// Local data URLs: the theme also works offline and makes no font CDN requests.
export const fontCSS = `
@font-face { font-family:'MOSS Rajdhani'; src:url('${rajdhaniMedium}') format('woff2'); font-weight:400 500; font-style:normal; font-display:swap; }
@font-face { font-family:'MOSS Rajdhani'; src:url('${rajdhaniSemibold}') format('woff2'); font-weight:600 900; font-style:normal; font-display:swap; }
@font-face { font-family:'MOSS Sans SC'; src:url('${sansRegular}') format('woff2'); font-weight:100 500; font-style:normal; font-display:swap; }
@font-face { font-family:'MOSS Sans SC'; src:url('${sansSemibold}') format('woff2'); font-weight:600 900; font-style:normal; font-display:swap; }
`
