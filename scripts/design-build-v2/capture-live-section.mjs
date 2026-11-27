/**
 * Capture a real section from a running Laravel + Inertia application
 * (not a static HTML imitation).
 *
 * Run with: node scripts/design-build-v2/capture-live-section.mjs \
 *   --base http://127.0.0.1:8000 --out <dir> \
 *   --playwright-dir <dir-with-playwright-installed> \
 *   --email <login> --password <password>
 *
 * Nothing here is machine- or project-specific: the Playwright install and the
 * credentials always come from the caller.
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x900', width: 1280, height: 900 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
  { name: '360x800', width: 360, height: 800 }
];

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

const requireArg = (flag, why, fallback) => {
  const value = arg(flag, fallback);
  if (!value) {
    console.error(`capture-live-section: missing ${flag} (${why})`);
    console.error('Usage: --base <url> --out <dir> --playwright-dir <dir> [--email <login> --password <password>] [--route <path>]');
    process.exit(2);
  }
  return value;
};

const PW_DIR = requireArg('--playwright-dir', 'directory holding a playwright install',
  process.env.E2E_PLAYWRIGHT_DIR);
const base = arg('--base', 'http://127.0.0.1:8000');
const outDir = path.resolve(arg('--out', 'artifacts/live-section'));
// Credentials are read from the environment too: argv is visible in `ps`.
// They are optional: a project without auth captures as an anonymous visitor.
const email = arg('--email', process.env.CAPTURE_EMAIL);
const password = arg('--password', process.env.CAPTURE_PASSWORD);
const doLogin = Boolean(email && password);
if (!doLogin) {
  console.error('capture-live-section: no credentials supplied; capturing without logging in.');
}
if (process.argv.includes('--email') || process.argv.includes('--password')) {
  console.error('capture-live-section: credentials passed on argv are visible to other users; prefer CAPTURE_EMAIL / CAPTURE_PASSWORD.');
}
const route = arg('--route', '/');

fs.mkdirSync(outDir, { recursive: true });

const script = `
const { createRequire } = require('node:module');
const req = createRequire(${JSON.stringify(path.join(PW_DIR, 'package.json'))});
const { chromium } = req('playwright');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch();
  const report = { base: ${JSON.stringify(base)}, route: ${JSON.stringify(route)}, viewports: {}, consoleErrors: [] };

  for (const vp of ${JSON.stringify(VIEWPORTS)}) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1
    });
    page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text().slice(0, 200)); });
    page.on('pageerror', e => report.consoleErrors.push(String(e).slice(0, 200)));

    // Log in through the real form so the app issues a real session.
    ${doLogin ? `await page.goto(${JSON.stringify(base)} + '/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', process.env.CAPTURE_EMAIL);
    await page.fill('input[type="password"]', process.env.CAPTURE_PASSWORD);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
      page.click('button[type="submit"]')
    ]);
` : '// No credentials supplied: treat the section as public.'}

    const response = await page.goto(${JSON.stringify(base)} + ${JSON.stringify(route)}, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    const shot = await page.screenshot({ fullPage: false });
    const file = ${JSON.stringify(outDir)} + '/' + vp.name + '-candidate.png';
    fs.writeFileSync(file, shot);

    report.viewports[vp.name] = {
      status: response ? response.status() : null,
      url: page.url(),
      title: await page.title(),
      h1: await page.locator('h1').first().textContent().catch(() => null),
      bodyBackground: await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
      fontFamily: await page.evaluate(() => getComputedStyle(document.body).fontFamily),
      primary: await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim()),
      bytes: shot.length
    };
    await page.close();
  }

  await browser.close();
  fs.writeFileSync(${JSON.stringify(outDir)} + '/live-capture.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch(e => { console.error('CAPTURE FAIL:', e.message); process.exit(1); });
`;

execFileSync(process.execPath, ['-e', script], {
  stdio: 'inherit',
  // Credentials travel via the environment, not the generated script text.
  env: { ...process.env, CAPTURE_EMAIL: email, CAPTURE_PASSWORD: password }
});
