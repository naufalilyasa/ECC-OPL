#!/usr/bin/env node
// Real browser-rendered parity measurement for the P-WEB1 disposable fixture.
// Uses the already-installed Playwright + Chromium in the E2E scratch dir. No new deps,
// no active HOME writes, no deployment. Produces measurements + screenshots on disk.
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const ROOT = resolve(HERE, '../..')
export const PW_DIR = resolve(process.env.E2E_PLAYWRIGHT_DIR
  || '/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright')
const require = createRequire(join(PW_DIR, 'package.json'))
const { chromium } = require('playwright')

const sha256 = (b) => createHash('sha256').update(b).digest('hex')

// Landmarks whose computed geometry/visibility/typography define P-WEB1 topbar fidelity.
const LANDMARKS = [
  { name: 'topbar-container', selector: '.topbar', props: ['paddingTop', 'display', 'minHeight', 'gap'] },
  { name: 'warehouse-badge', selector: '.warehouse-badge', props: ['display', 'visibility', 'borderRadius', 'fontVariantNumeric'] },
  { name: 'brand', selector: '.brand', props: ['fontWeight', 'fontSize', 'fontFamily'] },
]

export async function measureRendered(html, profile = {}) {
  const width = profile.width ?? 390, height = profile.height ?? 844
  const dpr = profile.deviceScaleFactor ?? 1
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.E2E_CHROMIUM_PATH || undefined,
  })
  try {
    const page = await browser.newPage({
      viewport: { width, height }, deviceScaleFactor: dpr,
      reducedMotion: profile.reducedMotion ?? 'reduce', locale: profile.locale ?? 'en-US',
      colorScheme: profile.theme ?? 'dark',
    })
    await page.setContent(html, { waitUntil: 'domcontentloaded' })
    if (profile.fontReady !== false) {
      await page.evaluate(() => document.fonts?.ready ?? Promise.resolve())
    }
    const measured = {}
    for (const lm of LANDMARKS) {
      const el = page.locator(lm.selector).first()
      const count = await el.count()
      if (!count) { measured[lm.name] = { present: false }; continue }
      const styles = await el.evaluate((node, props) => {
        const cs = getComputedStyle(node)
        const out = {}
        for (const p of props) out[p] = cs[p]
        const box = node.getBoundingClientRect()
        return { styles: out, box: { x: box.x, y: box.y, width: box.width, height: box.height },
          visible: cs.display !== 'none' && cs.visibility !== 'hidden' && box.width > 0 && box.height > 0 }
      }, lm.props)
      measured[lm.name] = { present: true, ...styles }
    }
    const screenshot = await page.screenshot({ animations: 'disabled' })
    return { source: 'chromium-playwright', profile: { width, height, dpr,
      theme: profile.theme ?? 'dark', locale: profile.locale ?? 'en-US', reducedMotion: profile.reducedMotion ?? 'reduce' },
      landmarks: measured, screenshotSha256: sha256(screenshot), screenshotBytes: screenshot }
  } finally {
    await browser.close()
  }
}

// Compare two *rendered* measurements. Never accepts source-level TSX regex as proof.
export function compareRendered(approved, cand, tolerance = 0.5) {
  const diffs = []
  const a = approved.landmarks ?? {}, c = cand.landmarks ?? {}
  for (const lm of LANDMARKS) {
    const av = a[lm.name], cv = c[lm.name]
    if (!av?.present || !cv?.present) {
      diffs.push({ landmark: lm.name, property: 'presence', expected: Boolean(av?.present),
        actual: Boolean(cv?.present), verdict: 'FAIL' }); continue
    }
    if (av.visible !== cv.visible) {
      diffs.push({ landmark: lm.name, property: 'visibility', expected: av.visible,
        actual: cv.visible, verdict: 'FAIL' })
    }
    for (const p of lm.props) {
      const avp = av.styles?.[p], cvp = cv.styles?.[p]
      if (avp === cvp) continue
      const an = parseFloat(avp), cn = parseFloat(cvp)
      const delta = Number.isFinite(an) && Number.isFinite(cn) ? Math.abs(an - cn) : null
      if (delta !== null && delta <= tolerance) continue
      diffs.push({ landmark: lm.name, property: p, expected: avp, actual: cvp,
        delta, unit: p.endsWith('Top') || p === 'minHeight' ? 'px' : undefined, verdict: 'FAIL' })
    }
    for (const k of ['width', 'height']) {
      const delta = Math.abs((av.box?.[k] ?? 0) - (cv.box?.[k] ?? 0))
      if (delta > tolerance) diffs.push({ landmark: lm.name, property: `box.${k}`,
        expected: av.box?.[k], actual: cv.box?.[k], delta, unit: 'px', verdict: 'FAIL' })
    }
  }
  return { code: diffs.length ? 'PARITY_FAIL' : 'PARITY_PASS', diffs,
    paddingDelta: diffs.find((d) => d.property === 'paddingTop')?.delta ?? 0,
    evidence: { approvedSha256: approved.screenshotSha256, candidateSha256: cand.screenshotSha256,
      source: cand.source, verified: cand.source === 'chromium-playwright' } }
}

export function readManifest(path) {
  return JSON.parse(readFileSync(resolve(ROOT, path), 'utf8'))
}
export { existsSync, mkdirSync, readFileSync, writeFileSync, join, resolve, sha256 }
