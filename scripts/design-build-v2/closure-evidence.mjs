#!/usr/bin/env node
/**
 * §6 functional closure evidence: one real browser-rendered section measured
 * with an approved NON-P-WEB1 custom landmark profile.
 *
 * Demonstrates, with actual Chromium output:
 *   1. complete approved landmark coverage
 *   2. a matching candidate passes
 *   3. a deliberate mismatch in one required landmark fails
 *   4. a missing required measurement fails
 *   5. authoritative admission stays blocked without real evidence
 *   6. a11y + frontend-direction constraints remain intact
 *
 * Run with: node scripts/design-build-v2/closure-evidence.mjs
 * Writes to artifacts/landmark-scope-closure/
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  measureRendered, compareRendered, resolveLandmarks, landmarkProfileKey, sha256
} from './render-parity.mjs'
import { verifyAdmissionCertificate } from './track-a-admission.mjs'
import { enforceTrackAAdmission } from '../lib/design-build-antigravity-gate.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const OUT = join(ROOT, 'artifacts/landmark-scope-closure')

// An approved custom profile for a notification-panel section. Deliberately not
// the P-WEB1 topbar fixture: this proves admission is not fixture-locked.
const APPROVED_LANDMARKS = [
  { name: 'panel-header', selector: '.panel-header', props: ['display', 'minHeight', 'fontWeight'] },
  { name: 'status-pill', selector: '.status-pill', props: ['display', 'borderRadius', 'fontVariantNumeric'] },
  { name: 'reminder-row', selector: '.reminder-row', props: ['display', 'gap', 'paddingTop'] }
]

function page(overrides = {}) {
  const css = `
    body { margin: 0; font-family: system-ui, sans-serif; background: #111; color: #eee; }
    .panel-header { display: flex; align-items: center; min-height: 48px; font-weight: 700; padding: 0 16px; }
    .status-pill { display: inline-flex; border-radius: 999px; font-variant-numeric: tabular-nums; padding: 2px 10px; }
    .reminder-row { display: grid; gap: 8px; padding-top: 12px; }
  `
  const headerMinHeight = overrides.headerMinHeight ?? 48
  const pillRadius = overrides.pillRadius ?? 999
  const rowGap = overrides.rowGap ?? 8
  const style = css
    .replace('min-height: 48px', `min-height: ${headerMinHeight}px`)
    .replace('border-radius: 999px', `border-radius: ${pillRadius}px`)
    .replace('gap: 8px', `gap: ${rowGap}px`)
  return `<!doctype html><html><head><meta charset="utf-8"><style>${style}</style></head>
<body><header class="panel-header"><h1>Reminders</h1><span class="status-pill">3</span></header>
<div class="reminder-row">Pay invoice</div><div class="reminder-row">Call supplier</div></body></html>`
}

const results = []
function record(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  mkdirSync(OUT, { recursive: true })

  const approvedSet = resolveLandmarks({ landmarks: APPROVED_LANDMARKS })
  const approvedKey = landmarkProfileKey(approvedSet)
  const viewports = [
    { name: 'desktop-1440', width: 1440, height: 900 },
    { name: 'mobile-390', width: 390, height: 844 }
  ]

  // 1. Complete approved landmark coverage on a real render.
  const reference = {}
  for (const vp of viewports) {
    reference[vp.name] = await measureRendered(page(), { ...vp, landmarks: APPROVED_LANDMARKS })
  }
  const coverageOk = APPROVED_LANDMARKS.every(lm =>
    viewports.every(vp => reference[vp.name].landmarks[lm.name]?.present === true))
  record('1. complete approved landmark coverage', coverageOk,
    APPROVED_LANDMARKS.map(lm => lm.name).join(', '))
  for (const vp of viewports) {
    writeFileSync(join(OUT, `${vp.name}-reference.png`), reference[vp.name].screenshotBytes)
  }

  // 2. A matching candidate passes.
  const matching = {}
  for (const vp of viewports) {
    matching[vp.name] = await measureRendered(page(), { ...vp, landmarks: APPROVED_LANDMARKS })
  }
  const matchResults = viewports.map(vp =>
    compareRendered(reference[vp.name], matching[vp.name], 0.5, approvedSet))
  record('2. matching candidate passes at every viewport',
    matchResults.every(r => r.code === 'PARITY_PASS'),
    matchResults.map(r => r.code).join(', '))
  for (const vp of viewports) {
    writeFileSync(join(OUT, `${vp.name}-candidate.png`), matching[vp.name].screenshotBytes)
  }

  // 3. A deliberate mismatch in one required landmark fails.
  const mismatched = {}
  for (const vp of viewports) {
    mismatched[vp.name] = await measureRendered(
      page({ headerMinHeight: 96 }), { ...vp, landmarks: APPROVED_LANDMARKS })
  }
  const mismatchResults = viewports.map(vp =>
    compareRendered(reference[vp.name], mismatched[vp.name], 0.5, approvedSet))
  record('3. deliberate mismatch in one required landmark fails',
    mismatchResults.every(r => r.code === 'PARITY_FAIL')
      && mismatchResults.every(r => r.diffs.some(d => d.landmark === 'panel-header')),
    mismatchResults.map(r => r.code).join(', '))

  // 4. A missing required measurement fails.
  const partial = { ...reference['desktop-1440'] }
  partial.landmarks = { ...partial.landmarks }
  delete partial.landmarks['reminder-row']
  const missingResult = compareRendered(reference['desktop-1440'], partial, 0.5, approvedSet)
  record('4. missing required measurement fails',
    missingResult.code === 'PARITY_FAIL'
      && missingResult.diffs.some(d => d.landmark === 'reminder-row' && d.property === 'presence'),
    missingResult.code)

  // 5. Authoritative admission stays blocked without real evidence.
  const captures = {}
  for (const [index, vp] of viewports.entries()) {
    captures[vp.name] = {
      // Report the verdict actually measured for this viewport; a hardcoded
      // value would let this evidence generator claim a pass it never observed.
      verdict: matchResults[index].code,
      referenceSha256: reference[vp.name].screenshotSha256,
      candidateSha256: matching[vp.name].screenshotSha256
    }
  }
  const certificate = {
    status: 'ADMITTED',
    approvedBundleSha256: sha256(JSON.stringify(approvedSet)),
    profileDimensions: Object.fromEntries(viewports.map(vp => [vp.name, [vp.width, vp.height]])),
    captures,
    gateResults: {
      G0_preflight: 'PASS', G1_contract: 'PASS',
      G2_rendered_fidelity: 'PASS', G3_state_interaction: 'PASS'
    },
    gateSequence: ['G0_preflight', 'G1_contract', 'G2_rendered_fidelity', 'G3_state_interaction'],
    renderedEvidence: { verified: true, source: 'chromium-playwright' }
  }

  // Without the PNG bytes, the canonical verifier must refuse.
  const noEvidence = verifyAdmissionCertificate(certificate, {})
  const gateNoEvidence = enforceTrackAAdmission(certificate, {})
  record('5. admission blocked without real evidence',
    noEvidence.status === 'BLOCKED' && gateNoEvidence.status === 'BLOCKED',
    `verifier=${noEvidence.status}/${noEvidence.reason} gate=${gateNoEvidence.status}`)

  // With the real bytes, the canonical verifier accepts — proving the gate is
  // wired to evidence, not to shape.
  const images = {}
  for (const vp of viewports) {
    images[vp.name] = {
      reference: reference[vp.name].screenshotBytes,
      candidate: matching[vp.name].screenshotBytes
    }
  }
  const withEvidence = verifyAdmissionCertificate(certificate, images)
  record('5b. same certificate admits only when the real PNGs are supplied',
    withEvidence.status === 'ADMITTED', withEvidence.status)

  // 6. a11y + frontend-direction constraints remain intact.
  const a11ySkill = resolve(ROOT, 'skills/a11y/SKILL.md')
  const direction = resolve(ROOT, 'skills/frontend-design-direction/SKILL.md')
  const { existsSync, readFileSync } = await import('node:fs')
  const a11yOk = existsSync(a11ySkill)
    && readFileSync(a11ySkill, 'utf8').includes('WCAG')
  const directionOk = existsSync(direction)
  record('6. canonical a11y import and frontend direction intact',
    a11yOk && directionOk, `a11y=${a11yOk} direction=${directionOk}`)

  const summary = {
    generated_utc: new Date().toISOString(),
    profile: { landmarks: APPROVED_LANDMARKS, profileKey: approvedKey, source: 'custom (non-P-WEB1)' },
    viewports: viewports.map(vp => vp.name),
    results,
    allPassed: results.every(r => r.ok),
    note: 'This is measurement evidence for the closure directive, NOT a Track A admission certificate for any production project.'
  }
  writeFileSync(join(OUT, 'closure-evidence.json'), JSON.stringify(summary, null, 2) + '\n')

  console.log(`\n${results.filter(r => r.ok).length}/${results.length} checks passed`)
  console.log(`evidence: ${join(OUT, 'closure-evidence.json')}`)
  if (!summary.allPassed) process.exitCode = 1
}

main().catch(error => {
  console.error('CLOSURE EVIDENCE FAILED:', error.message)
  process.exitCode = 1
})
