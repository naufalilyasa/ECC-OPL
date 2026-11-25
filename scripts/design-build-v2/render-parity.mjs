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

// Landmarks whose computed geometry/visibility/typography define fidelity.
// The default set is the P-WEB1 topbar contract; any other project supplies its
// own set through a profile so Track A admission is not locked to one fixture.
// Frozen: a caller that mutates a returned set must not change the default for
// every later caller in the same process.
export const DEFAULT_LANDMARKS = Object.freeze([
  Object.freeze({ name: 'topbar-container', selector: '.topbar', props: Object.freeze(['paddingTop', 'display', 'minHeight', 'gap']) }),
  Object.freeze({ name: 'warehouse-badge', selector: '.warehouse-badge', props: Object.freeze(['display', 'visibility', 'borderRadius', 'fontVariantNumeric']) }),
  Object.freeze({ name: 'brand', selector: '.brand', props: Object.freeze(['fontWeight', 'fontSize', 'fontFamily']) }),
]);

function cloneLandmarks(landmarks) {
  return landmarks.map(lm => ({ name: lm.name, selector: lm.selector, props: [...lm.props] }));
}

// Measured computed-style properties must be real, readable CSS properties.
// A typo silently yields `undefined` on both sides, which would read as a match.
const ALLOWED_PROPS = new Set([
  'display', 'visibility', 'position', 'opacity', 'overflow',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'gap', 'rowGap', 'columnGap',
  'minHeight', 'minWidth', 'maxHeight', 'maxWidth',
  'height', 'width',
  'fontWeight', 'fontSize', 'fontFamily', 'lineHeight', 'letterSpacing',
  'textAlign', 'textTransform', 'textDecorationLine', 'whiteSpace',
  'fontVariantNumeric', 'color', 'backgroundColor', 'backgroundImage',
  'borderRadius', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'boxShadow', 'flexDirection', 'flexWrap', 'justifyContent', 'alignItems',
  'zIndex', 'transform', 'transition', 'pointerEvents'
]);

/**
 * A stable identity for a landmark set. Measurements carry it so a comparison
 * across two different sets fails instead of passing on matching names alone.
 */
export function landmarkProfileKey(landmarks) {
  const normalized = landmarks
    .map(lm => ({ n: lm.name, s: lm.selector, p: [...lm.props].sort() }))
    // Order-independent: the same set declared in a different order is the same
    // scope, and must not fail a comparison as a different landmark set.
    .sort((a, b) => a.n.localeCompare(b.n));
  return sha256(JSON.stringify(normalized)).slice(0, 16);
}

/**
 * Resolve the landmark set for a measurement or comparison.
 *
 * Accepts `{ landmarks }` inline or `{ profilePath }` pointing at a JSON file.
 * A landmark without a name, selector, or props array is rejected: an empty
 * selector would silently match nothing and turn every comparison into a false
 * PASS, and a missing name would collide every entry under `undefined`.
 * Duplicate names and unknown measured properties are rejected too.
 */
export function resolveLandmarks(profile = {}) {
  let landmarks = profile.landmarks;
  if (!landmarks && profile.profilePath) {
    const parsed = JSON.parse(readFileSync(resolve(profile.profilePath), 'utf8'));
    if (!parsed || !Array.isArray(parsed.landmarks)) {
      throw new Error(`profile ${profile.profilePath} must contain a landmarks array`);
    }
    landmarks = parsed.landmarks;
  }
  if (!landmarks) return cloneLandmarks(DEFAULT_LANDMARKS);
  if (!Array.isArray(landmarks) || landmarks.length === 0) {
    throw new Error('landmarks must be a non-empty array');
  }
  const seen = new Set();
  for (const lm of landmarks) {
    if (!lm || typeof lm.name !== 'string' || lm.name.trim() === '') {
      throw new Error('landmark requires a non-empty name');
    }
    if (seen.has(lm.name)) {
      throw new Error(`duplicate landmark name: ${lm.name}`);
    }
    seen.add(lm.name);
    if (typeof lm.selector !== 'string' || lm.selector.trim() === '') {
      throw new Error(`landmark ${lm.name} requires a non-empty selector`);
    }
    if (!Array.isArray(lm.props) || lm.props.length === 0) {
      throw new Error(`landmark ${lm.name} requires a non-empty props array`);
    }
    for (const property of lm.props) {
      if (typeof property !== 'string' || !ALLOWED_PROPS.has(property)) {
        throw new Error(`landmark ${lm.name} declares unsupported property: ${property}`);
      }
    }
  }
  return landmarks;
}

export async function measureRendered(html, profile = {}) {
  const landmarks = resolveLandmarks(profile);
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
    for (const lm of landmarks) {
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
      landmarks: measured, profileKey: landmarkProfileKey(landmarks),
      screenshotSha256: sha256(screenshot), screenshotBytes: screenshot }
  } finally {
    await browser.close()
  }
}

// Compare two *rendered* measurements. Never accepts source-level TSX regex as proof.
export function compareRendered(approved, cand, tolerance = 0.5, landmarks = null) {
  const diffs = []
  const a = approved.landmarks ?? {}, c = cand.landmarks ?? {}
  const fail = (extra = {}) => ({ code: 'PARITY_FAIL', diffs, paddingDelta: 0,
    evidence: { approvedSha256: approved.screenshotSha256, candidateSha256: cand.screenshotSha256,
      source: cand.source, verified: false }, ...extra })

  // A measurement recorded which landmark set produced it. Comparing across two
  // different sets would pass on matching names alone while comparing different
  // elements, so that is a hard failure, not a silent pass.
  if (approved.profileKey && cand.profileKey && approved.profileKey !== cand.profileKey) {
    diffs.push({ landmark: '(profile)', property: 'landmarkSet',
      expected: approved.profileKey, actual: cand.profileKey, verdict: 'FAIL' })
    return fail()
  }

  // The comparison scope must equal the set the measurements were taken with.
  // An omitted scope for a custom profile must not fall back to the P-WEB1
  // fixture defaults; an explicit empty or reduced scope must not pass.
  const measuredKey = approved.profileKey || cand.profileKey
  if (!landmarks) {
    if (measuredKey) {
      diffs.push({ landmark: '(profile)', property: 'landmarkSet',
        expected: 'explicit comparison scope',
        actual: 'omitted for a custom measurement', verdict: 'FAIL' })
      return fail()
    }
    landmarks = DEFAULT_LANDMARKS
  }
  if (!Array.isArray(landmarks) || landmarks.length === 0) {
    diffs.push({ landmark: '(profile)', property: 'landmarkSet',
      expected: 'non-empty comparison scope', actual: String(landmarks?.length ?? landmarks), verdict: 'FAIL' })
    return fail()
  }
  if (measuredKey && landmarkProfileKey(landmarks) !== measuredKey) {
    diffs.push({ landmark: '(profile)', property: 'landmarkSet',
      expected: measuredKey, actual: landmarkProfileKey(landmarks), verdict: 'FAIL' })
    return fail()
  }

  for (const lm of landmarks) {
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
      // Two missing values are missing evidence, not agreement.
      if (avp === undefined || cvp === undefined) {
        diffs.push({ landmark: lm.name, property: p, expected: avp ?? null, actual: cvp ?? null,
          missing: true, verdict: 'FAIL' })
        continue
      }
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
