#!/usr/bin/env node
// Produce real browser-rendered evidence for P-WEB1 and write it to disk.
// This artifact is the ONLY accepted authority for G2 PARITY_PASS.
import { measureRendered, compareRendered, ROOT, sha256, mkdirSync, writeFileSync, join } from './render-parity.mjs'
import { jsxToHtml } from '../../tests/fixtures/p-web1-rlogic/jsx-to-html.mjs'
import { readFileSync } from 'node:fs'

const fixture = join(ROOT, 'tests/fixtures/p-web1-rlogic')
const approved = readFileSync(join(fixture, '00-topbar.html'), 'utf8')
const tsx = readFileSync(join(fixture, 'AppLayout.tsx'), 'utf8')
const out = join(ROOT, 'docs/design/evidence/p-web1')
mkdirSync(out, { recursive: true })
const profile = { width: 390, height: 844, deviceScaleFactor: 1, theme: 'dark',
  locale: 'en-US', reducedMotion: 'reduce', fontReady: true }

const approvedM = await measureRendered(approved, profile)
const scenarios = {
  repaired: jsxToHtml(tsx),
  hideParent: jsxToHtml(tsx, { hideParent: true }),
  inlinePt32: jsxToHtml(tsx, { inlinePaddingTop: 32 }),
}
const evidence = { source: 'chromium-playwright', profile, generated_utc: new Date().toISOString(),
  approved: { screenshotSha256: approvedM.screenshotSha256, landmarks: approvedM.landmarks }, cases: {} }
writeFileSync(join(out, '00-topbar-approved.png'), approvedM.screenshotBytes)
for (const [name, html] of Object.entries(scenarios)) {
  const m = await measureRendered(html, profile)
  const verdict = compareRendered(approvedM, m)
  writeFileSync(join(out, `00-topbar-${name}.png`), m.screenshotBytes)
  evidence.cases[name] = { screenshotSha256: m.screenshotSha256, screenshotFile: `00-topbar-${name}.png`,
    landmarks: m.landmarks, verdict: verdict.code, diffs: verdict.diffs,
    paddingDelta: verdict.paddingDelta, renderedEvidence: verdict.evidence }
}
writeFileSync(join(out, 'rendered-parity.json'), JSON.stringify(evidence, null, 2) + '\n')
console.log('CAPTURED', Object.fromEntries(Object.entries(evidence.cases).map(([k, v]) => [k, v.verdict])),
  'approvedSha', approvedM.screenshotSha256.slice(0, 12))
