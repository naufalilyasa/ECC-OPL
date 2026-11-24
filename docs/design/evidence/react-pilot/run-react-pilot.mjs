// Real React runtime pilot: serves the ACTUAL production bundle from rlogic-wms
// in a disposable worktree and measures it in Chromium. No JSX->HTML conversion,
// no dependency install, no active-project modification.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const PW_DIR = '/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright';
const ROOT = resolve('public');
const OUT = resolve('pilot-evidence');
mkdirSync(OUT, { recursive: true });
const sha = (b) => createHash('sha256').update(Buffer.from(b)).digest('hex');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png' };

const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/react-page.html';
  let f = join(ROOT, p);
  try {
    if (!statSync(f).isFile()) throw 0;
    res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
    res.end(readFileSync(f));
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const { chromium } = await import(join(PW_DIR, 'node_modules/playwright/index.mjs'));
const exe = '/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright/pw-browsers/chromium_headless_shell-1255/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const browser = await chromium.launch({ executablePath: exe, headless: true });

// Required viewports from frozen design contract §3.4 / capture profile.
const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900, dpr: 1 },
  { name: '768x1024', width: 768, height: 1024, dpr: 1 },
  { name: '390x844', width: 390, height: 844, dpr: 1 },
  { name: '360x800', width: 360, height: 800, dpr: 1 },
];
const LANDMARKS = ['#app header', '#app-sidebar', '#app h1', '#app .text-mono'];

async function measure(drift, repair = false) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
    locale: 'id-ID', colorScheme: 'light', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/react-page.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#app header', { timeout: 15000 }).catch(() => {});
  if (drift || repair) {
    // Framework-only candidate drift: override the real component's rendered styles.
    await page.addStyleTag({ content: '#app header{height:80px !important;padding-top:32px !important}#app-sidebar{visibility:hidden !important}' });
  }
  if (repair) {
    // Framework-only repair: remove the candidate override; approved canvas untouched.
    await page.evaluate(() => document.querySelectorAll('style').forEach((s) => { if (!s.id) s.remove(); }));
  }
  await page.evaluate(() => document.fonts.ready);
  const appChildren = await page.evaluate(() => document.getElementById('app')?.children.length ?? 0);
  const out = { source: 'chromium-playwright-react-production-bundle', drift: Boolean(drift),
    appChildren, consoleErrors: errors.slice(0, 5), viewports: [] };
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.evaluate(() => document.fonts.ready);
    const styles = await page.evaluate((sels) => sels.map((sel) => {
      const el = document.querySelector(sel);
      if (!el) return { sel, present: false };
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { sel, present: true, display: cs.display, visibility: cs.visibility,
        height: Math.round(r.height * 100) / 100, paddingTop: cs.paddingTop,
        color: cs.color, fontFamily: cs.fontFamily.split(',')[0].trim() };
    }), LANDMARKS);
    const shot = await page.screenshot({ type: 'png', fullPage: false });
    const name = `react-${repair ? 'repaired' : drift ? 'drift' : 'approved'}-${vp.name}.png`;
    writeFileSync(join(OUT, name), shot);
    out.viewports.push({ name: vp.name, width: vp.width, height: vp.height, dpr: vp.dpr,
      screenshot: name, screenshotSha256: sha(shot), styles });
  }
  await ctx.close();
  return out;
}

const approved = await measure(false);
const drift = await measure(true);
const repaired = await measure(false, true);
writeFileSync(join(OUT, 'react-runtime-evidence.json'), JSON.stringify({
  generated: new Date().toISOString(),
  bundle: { entry: 'assets/app-Bf7snb_q.js', css: 'assets/app-_7P0h5zY.css',
    sha256: sha(readFileSync(join(ROOT, 'build/assets/app-Bf7snb_q.js'))) },
  url: '/master/items', component: 'Master/Items/Index',
  worktree: '/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/db2-react-pilot',
  approved, drift, repaired,
}, null, 2) + '\n');

await browser.close();
server.close();
console.log(JSON.stringify({
  approvedChildren: approved.appChildren, driftChildren: drift.appChildren,
  approvedErrors: approved.consoleErrors, driftErrors: drift.consoleErrors,
  repairedErrors: repaired.consoleErrors,
  pixelIdenticalApprovedVsRepaired: approved.viewports.every((a, i) => a.screenshotSha256 === repaired.viewports[i].screenshotSha256),
  driftDetected: approved.viewports.some((a, i) => a.screenshotSha256 !== drift.viewports[i].screenshotSha256),
  shots: [...approved.viewports, ...drift.viewports, ...repaired.viewports].map((v) => `${v.name}:${v.screenshotSha256.slice(0, 12)}`),
}, null, 2));
