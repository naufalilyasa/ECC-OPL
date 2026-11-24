// Focused RED→GREEN regressions for the section-scoped functional completion brief.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { advanceCheckpoint, verifyReceipt, verifyIdentitySeparation, verifyFrameworkRepair } from
  '../scripts/design-build-v2/state-machine.mjs'
import { verifyRenderedParity, pngInfo } from '../scripts/design-build-v2/rendered-authority.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const sha = (b) => createHash('sha256').update(Buffer.isBuffer(b) ? b : Buffer.from(b)).digest('hex')
const png = (p) => readFileSync(join(ROOT, p))
const ID = { sectionId: 'REF-01-app-shell', revision: 'v1.1',
  bundleSha256: sha(Buffer.from('approved-reference')) }
const PNG_REF = 'docs/design/evidence/html-react/html-desktop-1440.png'
const PNG_CAND = 'docs/design/evidence/html-react/react-desktop-1440.png'
const row = (expected, actual, verdict = 'PASS') => ({ profile: 'desktop-1440', state: 'default',
  landmark: 'brand', property: 'visibility', expected, actual, verdict })
function receipt(over = {}) {
  return { schemaVersion: 2, sectionId: ID.sectionId, revision: ID.revision,
    approvedBundleSha256: ID.bundleSha256,
    candidateFileHashes: { 'AppLayout.tsx': sha(Buffer.from('candidate-v1')) },
    gateResults: { G0_preflight: 'PASS', G1_contract: 'PASS', G2_rendered_fidelity: 'PASS', G3_state_interaction: 'PASS' },
    measurements: [row('visible', 'visible')],
    viewportScreenshots: { 'desktop-1440': sha(png(PNG_REF)) },
    interactionEvidence: { checks: [{ name: 'profile-menu', applicable: true, observed: true,
      value: 'opened', before: 'closed', after: 'opened' }] },
    overallVerdict: 'PARITY_PASS', ...over }
}
function ctx(over = {}) {
  return { identity: { ...ID },
    active: { sectionId: ID.sectionId, revision: ID.revision, approvedBundleSha256: ID.bundleSha256,
      current: 1, state: 'PARITY_PENDING' },
    canvasApproval: { approved: true, verdictId: 'canvas:5b8f3d6b99aa@2026-11-24T03:16:23.184Z', sectionId: ID.sectionId,
      revision: ID.revision, bundleSha256: ID.bundleSha256 },
    candidateFiles: { 'AppLayout.tsx': Buffer.from('candidate-v1') },
    frameworkCompleteEvidence: { build: 'app-Bf7snb_q.js', builtAt: 'pilot', identitySha256: sha(Buffer.from('build')) },
    contractChecks: [{ name: 'token-map-bound', observed: true }, { name: 'geometry-declared', observed: true }],
    requiredViewports: ['desktop-1440'],
    viewportEvidence: { 'desktop-1440': { screenshot: png(PNG_REF), candidateScreenshot: png(PNG_CAND),
      measurements: [row('visible', 'visible')] } },
    interactionChecks: [{ name: 'profile-menu', applicable: true, observed: true,
      value: 'opened', before: 'closed', after: 'opened' }], ...over }
}
const active = (s = 'PARITY_PENDING') => ({ sectionId: ID.sectionId, revision: ID.revision,
  approvedBundleSha256: ID.bundleSha256, current: 1, state: s })

// SCF-02 — verify before any positive transition.
test('FC08 PARITY_PENDING + invalid receipt never becomes PARITY_PASS', () => {
  const bad = receipt({ measurements: [row('visible', 'hidden', 'FAIL')], overallVerdict: 'PARITY_FAIL' })
  const r = advanceCheckpoint(active(), bad, ctx())
  assert.notEqual(r.state, 'PARITY_PASS')
  assert.equal(r.current, 1)
})
test('FC08 PARITY_PENDING + valid receipt -> PARITY_PASS without increment', () => {
  const r = advanceCheckpoint(active(), receipt(), ctx())
  assert.equal(r.state, 'PARITY_PASS')
  assert.equal(r.current, 1)
})
test('FC09 context cannot supersede a different active section', () => {
  const c = ctx(); c.identity = { ...ID, sectionId: 'OTHER' }
  const r = advanceCheckpoint(active(), receipt(), c)
  assert.equal(r.current, 1)
  assert.notEqual(r.state, 'SECTION_COMPLETE')
})
test('FC10 verified completion increments once; repeat is no-op', () => {
  const c = ctx()
  const first = advanceCheckpoint(active('PARITY_PASS'), receipt(), c)
  assert.equal(first.state, 'SECTION_COMPLETE')
  assert.equal(first.current, 2)
  const second = advanceCheckpoint(first, receipt(), c)
  assert.equal(second.current, 2)
})
test('FC10 stale candidate after PASS blocks completion', () => {
  const c = ctx(); c.candidateFiles = { 'AppLayout.tsx': Buffer.from('candidate-v2') }
  const r = advanceCheckpoint(active('PARITY_PASS'), receipt(), c)
  assert.notEqual(r.state, 'SECTION_COMPLETE')
})
test('FC07 frameworkComplete boolean alone is insufficient', () => {
  const c = ctx(); c.frameworkComplete = true; delete c.frameworkCompleteEvidence
  const r = advanceCheckpoint(active(), receipt(), c)
  assert.notEqual(r.state, 'PARITY_PASS')
})

// SCF-03/04 — rendered authority and receipt cannot be satisfied by junk.
test('FC03 text image / corrupt PNG is rejected', () => {
  assert.equal(pngInfo(Buffer.from('not a png')), null)
  const c = ctx(); c.viewportEvidence['desktop-1440'].screenshot = Buffer.from('not a png')
  const r = verifyReceipt(receipt(), c)
  assert.notEqual(r.code, 'OK')
})
test('FC04 undefined expected/actual cannot compare equal', () => {
  const r = verifyRenderedParity({ source: 'chromium-playwright',
    evidence: { verified: true, approvedSha256: sha(png(PNG_REF)), candidateSha256: sha(png(PNG_CAND)) }, diffs: [] },
    { screenshotPairs: { 'desktop-1440': { reference: png(PNG_REF), candidate: png(PNG_CAND) } },
      requiredViewports: ['desktop-1440'], viewportMeasurements: { 'desktop-1440': [row(undefined, undefined)] } })
  assert.notEqual(r.code, 'PARITY_PASS')
})
test('FC05 receipt gateResults disagreeing with recomputed gates is rejected', () => {
  const r = verifyReceipt(receipt({ gateResults: { G0_preflight: 'FAIL', G1_contract: 'PASS',
    G2_rendered_fidelity: 'PASS', G3_state_interaction: 'PASS' } }), ctx())
  assert.notEqual(r.code, 'OK')
})
test('FC05 caller diffs:[] cannot grant G2 when measurements fail', () => {
  const r = verifyRenderedParity({ source: 'chromium-playwright',
    evidence: { verified: true, byProfile: { 'desktop-1440': { approved: sha(png(PNG_REF)), candidate: sha(png(PNG_CAND)) } } }, diffs: [] },
    { screenshotPairs: { 'desktop-1440': { reference: png(PNG_REF), candidate: png(PNG_CAND) } },
      requiredViewports: ['desktop-1440'], viewportMeasurements: { 'desktop-1440': [row('visible', 'hidden', 'FAIL')] } })
  assert.equal(r.code, 'PARITY_FAIL')
})

// SCF-05 — identity separation / repair provenance must use real values.
test('FC12 missing reference digests cannot prove separation', () => {
  assert.notEqual(verifyIdentitySeparation({ kinds: ['html'] }, { kinds: ['framework-implementation'] }).code, 'OK')
})
test('FC12 invented repair digest (+x) is not a proven candidate change', () => {
  const before = { referenceSha256: sha(Buffer.from('ref')), implementationSha256: sha(Buffer.from('a')) }
  const after = { referenceSha256: sha(Buffer.from('ref')), implementationSha256: sha(Buffer.from('a')) + 'x' }
  assert.notEqual(verifyFrameworkRepair(before, after).code, 'OK')
})
test('FC13 hand-built approved:true without verdict cannot pass G0', () => {
  const c = ctx(); c.canvasApproval = { approved: true }
  const r = verifyReceipt(receipt(), c)
  assert.notEqual(r.code, 'OK')
})
