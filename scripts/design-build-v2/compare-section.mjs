#!/usr/bin/env node
// Section-scoped HTML-to-React comparison (SCF-01). Portable: paths from argv/env,
// no hardcoded developer paths. Renders the owner-approved HTML independently and
// the real React candidate, measures SEMANTIC regions (not wrapper equality),
// records exclusions, and writes paired captures + before measurements.
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, extname, resolve } from 'node:path'
import { createHash } from 'node:crypto'

const [worktreeArg, outArg] = process.argv.slice(2)
const W = resolve(worktreeArg ?? process.env.DB2_WORKTREE ?? '.')
const OUT = resolve(outArg ?? process.env.DB2_EVIDENCE_DIR ?? 'docs/design/evidence/html-react')
const PW = resolve(process.env.E2E_PLAYWRIGHT_DIR ?? join(W, '..', 'm6-playwright'))
mkdirSync(OUT, { recursive: true })
const sha = (b) => createHash('sha256').update(Buffer.isBuffer(b) ? b : Buffer.from(b)).digest('hex')
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png' }

// Approved reference = owner-approved HTML (CSS inline) + its actually used fonts/contract.
const refHtml = join(W, 'docs/design/sections/01-app-shell.html')
const scope = {
  sectionId: 'REF-01-app-shell', candidateRoute: '/master/items',
  profiles: ['desktop-1440', 'tablet-768', 'mobile-390', 'mobile-360'],
  regions: { // semantic region -> { html selector, react selector, properties }
    brand: { html: '.brand', react: '#app-sidebar .text-h4', properties: ['text', 'fontFamily', 'fontWeight', 'fontSize', 'color'] },
    sidebar: { html: '.sidebar', react: '#app-sidebar', properties: ['display', 'width', 'backgroundColor'] },
    navSelected: { html: '.nav-item.active', react: '#app-sidebar a[href="/master/items"]', properties: ['text', 'color', 'backgroundColor', 'height'] },
    topbar: { html: '.topbar', react: '#app header', properties: ['display', 'height', 'paddingLeft', 'backgroundColor'] },
    warehouse: { html: '.warehouse .code', react: '#app header span.font-mono', properties: ['text', 'fontFamily', 'color'] },
    userRole: { html: '.who .role', react: '#app header span.rounded-full', properties: ['text', 'color', 'borderRadius', 'fontSize'] },
    h1: { html: 'h1', react: '#app h1', properties: ['text', 'fontSize', 'fontWeight', 'color', 'lineHeight'] },
  },
  exclusions: [{ region: 'master-items-table-and-filters',
    reason: 'functional page content not specified by shell placeholder', verification: 'own approved section contract / G4' }],
  note: 'Wrapper geometry (H1 container width, brand wrapper) is NOT an acceptance criterion; measure actual text/style.',
}
const server = createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname)
  const map = { '/approved': refHtml, '/react-page.html': join(W, 'public/react-page.html') }
  let f = map[p] ?? (p.startsWith('/build/') ? join(W, 'public', p.slice(1)) : join(W, p.slice(1)))
  try {
    if (!f.startsWith(W)) throw 0
    const b = readFileSync(f)
    r.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' }); r.end(b)
  } catch { r.writeHead(404); r.end('nf') }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port
const { chromium } = await import(join(PW, 'node_modules/playwright/index.mjs'))
const exe = process.env.E2E_CHROMIUM_PATH ?? join(PW, 'pw-browsers/chromium_headless_shell-1255/chrome-headless-shell-mac-arm64/chrome-headless-shell')
const browser = await chromium.launch({ executablePath: exe, headless: true })
const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 }, { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-390', width: 390, height: 844 }, { name: 'mobile-360', width: 360, height: 800 },
]
const FONT = `@font-face{font-family:'Instrument Sans';src:url('/resources/fonts/InstrumentSans-Regular.woff2') format('woff2');font-weight:400}
@font-face{font-family:'Instrument Sans';src:url('/resources/fonts/InstrumentSans-Medium.woff2') format('woff2');font-weight:500}
@font-face{font-family:'Instrument Sans';src:url('/resources/fonts/InstrumentSans-SemiBold.woff2') format('woff2');font-weight:600}
@font-face{font-family:'JetBrains Mono';src:url('/resources/fonts/JetBrainsMono-Regular.woff2') format('woff2');font-weight:400}`
const text = (el) => (el?.textContent ?? '').trim().slice(0, 80)
async function measure(page, sels, props) {
  return page.evaluate(({ sels, props }) => Object.fromEntries(Object.entries(sels).map(([k, sel]) => {
    const el = document.querySelector(sel)
    if (!el) return [k, { present: false }]
    const cs = getComputedStyle(el)
    // text is set AFTER the spread so a 'text' entry in props cannot overwrite it with undefined.
    return [k, { ...Object.fromEntries(props.filter((p) => p !== 'text').map((p) => [p,
        p === 'fontFamily' ? cs[p].split(',')[0].trim().replace(/^"|"$/g, '')
        : p === 'borderRadius' && parseFloat(cs[p]) > 1000 ? 'capsule' : cs[p]])),
      present: true, text: (el.textContent || '').trim().slice(0, 80) }]
  })), { sels, props })
}
async function shoot(which, url) {
  const out = []
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1, locale: 'id-ID', colorScheme: 'light', reducedMotion: 'reduce' })
    const page = await ctx.newPage(); await page.addStyleTag({ content: FONT })
    await page.goto(url, { waitUntil: 'networkidle' }); await page.evaluate(() => document.fonts.ready)
    if (which === 'react') await page.waitForSelector('#app header', { timeout: 15000 }).catch(() => {})
    const sels = Object.fromEntries(Object.entries(scope.regions).map(([k, v]) => [k, v[which]]))
    const props = [...new Set(Object.values(scope.regions).flatMap((v) => v.properties))]
    const regions = await measure(page, sels, props)
    const png = await page.screenshot({ type: 'png' }); const name = `${which}-${vp.name}.png`
    writeFileSync(join(OUT, name), png)
    out.push({ viewport: vp.name, screenshot: name, sha256: sha(png), regions })
    await ctx.close()
  }
  return out
}
const html = await shoot('html', `http://127.0.0.1:${port}/approved`)
const react = await shoot('react', `http://127.0.0.1:${port}/react-page.html`)
const comparison = html.map((a, i) => {
  const c = react[i], diffs = []
  for (const [region, cfg] of Object.entries(scope.regions)) {
    for (const prop of cfg.properties) {
      const av = a.regions[region]?.[prop], cv = c.regions[region]?.[prop]
      if (av !== cv) diffs.push({ viewport: a.viewport, region, property: prop, html: av ?? null, react: cv ?? null })
    }
  }
  return { viewport: a.viewport, htmlScreenshot: a.screenshot, reactScreenshot: c.screenshot, diffCount: diffs.length, diffs }
})
writeFileSync(join(OUT, 'section-comparison.json'), JSON.stringify({ scope, html, react, comparison,
  totalDiffs: comparison.reduce((n, c) => n + c.diffCount, 0) }, null, 2) + '\n')
await browser.close(); server.close()
console.log(JSON.stringify({ totalDiffs: comparison.reduce((n, c) => n + c.diffCount, 0),
  perViewport: comparison.map((c) => ({ vp: c.viewport, diffs: c.diffCount })) }))
