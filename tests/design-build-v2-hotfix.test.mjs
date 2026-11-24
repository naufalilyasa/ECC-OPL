// Targeted regressions for multi-viewport G2 and required candidate evidence.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { verifyRenderedParity, pngInfo } from '../scripts/design-build-v2/rendered-authority.mjs'
import { verifyReceipt, advanceCheckpoint, STATES } from '../scripts/design-build-v2/state-machine.mjs'
import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const sha = (b) => createHash('sha256').update(Buffer.isBuffer(b) ? b : Buffer.from(b)).digest('hex')
const png = (n) => readFileSync(join(ROOT, 'docs/design/evidence/html-react', n))
const row = (profile, expected, actual, verdict = 'PASS') => ({ profile, state: 'default',
  landmark: 'brand', property: 'visibility', expected, actual, verdict })

// Multi-viewport: each profile has its OWN reference/candidate pair + digest.
function ctx(profiles) {
  return { requiredViewports: profiles.map((p) => p.name),
    screenshotPairs: Object.fromEntries(profiles.map((p) => [p.name,
      { reference: png(p.ref), candidate: png(p.cand) }])),
    viewportMeasurements: Object.fromEntries(profiles.map((p) => [p.name,
      [row(p.name, 'visible', 'visible')]])),
    // declare capture-profile dimensions from the profile definition, not hardcoded by the validator
    profileDimensions: Object.fromEntries(profiles.map((p) => [p.name, p.dims ?? [1440, 900]])),
    // per-profile digests declared independently (NOT one shared pair)
    evidenceHashes: Object.fromEntries(profiles.map((p) => [p.name,
      { approved: sha(png(p.ref)), candidate: sha(png(p.cand)) }])) }
}

test('HV01 distinct desktop/mobile pairs both verify', () => {
  const profiles = [
    { name: 'desktop-1440', ref: 'html-desktop-1440.png', cand: 'react-desktop-1440.png' },
    { name: 'mobile-390', ref: 'html-mobile-390.png', cand: 'react-mobile-390.png', dims: [390, 844] },
  ]
  const c = ctx(profiles)
  const r = verifyRenderedParity({ source: 'chromium-playwright',
    evidence: { verified: true, byProfile: c.evidenceHashes } }, c)
  assert.equal(r.code, 'PARITY_PASS')
  assert.equal(r.verifiedProfiles.length, 2)
})

test('HV02 duplicated desktop evidence labeled mobile is rejected', () => {
  const profiles = [
    { name: 'desktop-1440', ref: 'html-desktop-1440.png', cand: 'react-desktop-1440.png' },
    { name: 'mobile-390', ref: 'html-desktop-1440.png', cand: 'react-desktop-1440.png', dims: [390, 844] }, // wrong dims
  ]
  const c = ctx(profiles)
  const r = verifyRenderedParity({ source: 'chromium-playwright',
    evidence: { verified: true, byProfile: c.evidenceHashes } }, c)
  assert.notEqual(r.code, 'PARITY_PASS')
})

test('HV03 missing candidate image cannot fall back to reference', () => {
  const c = ctx([{ name: 'desktop-1440', ref: 'html-desktop-1440.png', cand: 'react-desktop-1440.png' }])
  delete c.screenshotPairs['desktop-1440'].candidate
  const r = verifyRenderedParity({ source: 'chromium-playwright',
    evidence: { verified: true, byProfile: c.evidenceHashes } }, c)
  assert.notEqual(r.code, 'PARITY_PASS')
})

test('HV04 one shared digest pair cannot satisfy two distinct profiles', () => {
  const profiles = [
    { name: 'desktop-1440', ref: 'html-desktop-1440.png', cand: 'react-desktop-1440.png' },
    { name: 'mobile-390', ref: 'html-mobile-390.png', cand: 'react-mobile-390.png', dims: [390, 844] },
  ]
  const c = ctx(profiles)
  // caller supplies ONE shared pair (old behavior) — must be rejected
  const r = verifyRenderedParity({ source: 'chromium-playwright',
    evidence: { verified: true, approvedSha256: sha(png('html-desktop-1440.png')),
      candidateSha256: sha(png('react-desktop-1440.png')) } }, c)
  assert.notEqual(r.code, 'PARITY_PASS')
})

test('HV05 candidateScreenshot ?? screenshot fallback rejected by receipt verifier', () => {
  const ID = { sectionId: 'REF-01-app-shell', revision: 'v1.1', bundleSha256: 'a'.repeat(64) }
  const r = { schemaVersion: 2, sectionId: ID.sectionId, revision: ID.revision,
    approvedBundleSha256: ID.bundleSha256, candidateFileHashes: { 'AppLayout.tsx': sha(Buffer.from('x')) },
    gateResults: { G0_preflight: 'PASS', G1_contract: 'PASS', G2_rendered_fidelity: 'PASS', G3_state_interaction: 'PASS' },
    measurements: [row('desktop-1440', 'visible', 'visible')], overallVerdict: 'PARITY_PASS' }
  const c = { active: { ...ID, current: 1 }, identity: ID,
    canvasApproval: { approved: true, verdictId: 'fb-95', ...ID },
    candidateFiles: { 'AppLayout.tsx': Buffer.from('x') },
    frameworkCompleteEvidence: { identitySha256: 'b'.repeat(64) },
    requiredViewports: ['desktop-1440'],
    viewportEvidence: { 'desktop-1440': { screenshot: png('html-desktop-1440.png'),
      /* candidateScreenshot intentionally MISSING */ measurements: [row('desktop-1440', 'visible', 'visible')] } },
    interactionChecks: [{ name: 'nav', applicable: true, observed: true, value: 'opened', before: 'closed', after: 'opened' }] }
  assert.notEqual(verifyReceipt(r, c).code, 'OK')
})

test('HV06 pngInfo rejects 36-byte header-only PNG buffer', () => {
  const b = Buffer.alloc(36)
  const magic = [137, 80, 78, 71, 13, 10, 26, 10]
  for (let i = 0; i < magic.length; i++) b[i] = magic[i]
  b.writeUInt32BE(13, 8)
  b.write('IHDR', 12, 'ascii')
  b.writeUInt32BE(100, 16)
  b.writeUInt32BE(100, 20)
  b.write('IEND', 28, 'ascii')
  assert.equal(pngInfo(b), null)
})

test('HV07 verifyReceipt rejects when G1 is FAIL even if G2 is PASS', () => {
  const ID = { sectionId: 'REF-01-app-shell', revision: 'v1.1', bundleSha256: 'a'.repeat(64), approvedBundleSha256: 'a'.repeat(64) }
  const r = { schemaVersion: 2, sectionId: ID.sectionId, revision: ID.revision,
    approvedBundleSha256: ID.bundleSha256, candidateFileHashes: { 'AppLayout.tsx': sha(Buffer.from('x')) },
    gateResults: { G0_preflight: 'PASS', G1_contract: 'FAIL', G2_rendered_fidelity: 'PASS', G3_state_interaction: 'PASS' },
    measurements: [row('desktop-1440', 'visible', 'visible')], overallVerdict: 'PARITY_PASS' }
  const c = { active: { ...ID, current: 1 }, identity: ID,
    canvasApproval: { approved: true, verdictId: 'canvas:5b8f3d6b99aa@2026-11-24T03:16:23.184Z', ...ID },
    candidateFiles: { 'AppLayout.tsx': Buffer.from('x') },
    frameworkCompleteEvidence: { identitySha256: 'b'.repeat(64) },
    contractChecks: [], // G1 fails because contractChecks is empty!
    requiredViewports: ['desktop-1440'],
    viewportEvidence: { 'desktop-1440': { screenshot: png('html-desktop-1440.png'),
      candidateScreenshot: png('react-desktop-1440.png'), measurements: [row('desktop-1440', 'visible', 'visible')] } },
    interactionChecks: [{ name: 'nav', applicable: true, observed: true, value: 'opened', before: 'closed', after: 'opened' }] }
  const res = verifyReceipt(r, c)
  assert.notEqual(res.code, 'OK')
  assert.equal(res.why, 'gateNotVerified')
  assert.equal(res.gate, 'G1_contract')
})

test('HV08 advanceCheckpoint blocks advancement when G1 is FAIL', () => {
  const ID = { sectionId: 'REF-01-app-shell', revision: 'v1.1', bundleSha256: 'a'.repeat(64), approvedBundleSha256: 'a'.repeat(64) }
  const r = { schemaVersion: 2, sectionId: ID.sectionId, revision: ID.revision,
    approvedBundleSha256: ID.bundleSha256, candidateFileHashes: { 'AppLayout.tsx': sha(Buffer.from('x')) },
    gateResults: { G0_preflight: 'PASS', G1_contract: 'FAIL', G2_rendered_fidelity: 'PASS', G3_state_interaction: 'PASS' },
    measurements: [row('desktop-1440', 'visible', 'visible')], overallVerdict: 'PARITY_PASS' }
  const active = { ...ID, current: 1, state: STATES.PARITY_PASS }
  const c = { active, identity: ID,
    canvasApproval: { approved: true, verdictId: 'canvas:5b8f3d6b99aa@2026-11-24T03:16:23.184Z', ...ID },
    candidateFiles: { 'AppLayout.tsx': Buffer.from('x') },
    frameworkCompleteEvidence: { identitySha256: 'b'.repeat(64) },
    contractChecks: [], // G1 fails
    requiredViewports: ['desktop-1440'],
    viewportEvidence: { 'desktop-1440': { screenshot: png('html-desktop-1440.png'),
      candidateScreenshot: png('react-desktop-1440.png'), measurements: [row('desktop-1440', 'visible', 'visible')] } },
    interactionChecks: [{ name: 'nav', applicable: true, observed: true, value: 'opened', before: 'closed', after: 'opened' }] }
  const next = advanceCheckpoint(active, r, c)
  assert.notEqual(next.state, STATES.SECTION_COMPLETE)
  assert.equal(next.current, 1)
  assert.equal(next.code, 'PARITY_NOT_VERIFIED')
})

test('HV09 state-machine recomputeG2 forwards profileDimensions to verifyRenderedParity', () => {
  const ID = { sectionId: 'REF-01-app-shell', revision: 'v1.1', bundleSha256: 'a'.repeat(64), approvedBundleSha256: 'a'.repeat(64) }
  const r = { schemaVersion: 2, sectionId: ID.sectionId, revision: ID.revision,
    approvedBundleSha256: ID.bundleSha256, candidateFileHashes: { 'AppLayout.tsx': sha(Buffer.from('x')) },
    gateResults: { G0_preflight: 'PASS', G1_contract: 'PASS', G2_rendered_fidelity: 'PASS', G3_state_interaction: 'PASS' },
    measurements: [row('desktop-1440', 'visible', 'visible')], overallVerdict: 'PARITY_PASS' }
  const c = { active: { ...ID, current: 1 }, identity: ID,
    canvasApproval: { approved: true, verdictId: 'canvas:5b8f3d6b99aa@2026-11-24T03:16:23.184Z', ...ID },
    candidateFiles: { 'AppLayout.tsx': Buffer.from('x') },
    frameworkCompleteEvidence: { identitySha256: 'b'.repeat(64) },
    contractChecks: [{ name: 'tokens', observed: true }],
    requiredViewports: ['desktop-1440'],
    profileDimensions: { 'desktop-1440': [390, 844] }, // Intentionally wrong dims! Desktop is 1440x900
    viewportEvidence: { 'desktop-1440': { screenshot: png('html-desktop-1440.png'),
      candidateScreenshot: png('react-desktop-1440.png'), measurements: [row('desktop-1440', 'visible', 'visible')] } },
    interactionChecks: [{ name: 'nav', applicable: true, observed: true, value: 'opened', before: 'closed', after: 'opened' }] }
  const res = verifyReceipt(r, c)
  assert.equal(res.code, 'INVALID_RECEIPT')
  assert.ok(['gateDisagreement', 'gateNotVerified'].includes(res.why))
  assert.equal(res.gate, 'G2_rendered_fidelity')
})

test('HV10 section-gate.mjs real CLI entrypoint runs correctly and forwards context', () => {
  const gateScript = join(ROOT, 'scripts/design-build-v2/section-gate.mjs')
  const ID = { sectionId: 'REF-01-app-shell', revision: 'v1.1', bundleSha256: 'a'.repeat(64), approvedBundleSha256: 'a'.repeat(64) }
  const reqPath = join(tmpdir(), 'test-section-gate-req-' + Date.now() + '.json')
  const reqData = {
    projectRoot: ROOT,
    identity: ID,
    active: { ...ID, current: 1, state: STATES.PARITY_PASS },
    canvasApproval: { approved: true, verdictId: 'canvas:5b8f3d6b99aa@2026-11-24T03:16:23.184Z', ...ID },
    candidateFiles: { 'AppLayout.tsx': 'tests/fixtures/p-web1-rlogic/AppLayout.tsx' },
    frameworkCompleteEvidence: { identitySha256: 'b'.repeat(64) },
    contractChecks: [{ name: 'tokens', observed: true }],
    requiredViewports: ['desktop-1440'],
    profileDimensions: { 'desktop-1440': [1440, 900] },
    viewportEvidence: {
      'desktop-1440': {
        screenshot: 'docs/design/evidence/html-react/html-desktop-1440.png',
        candidateScreenshot: 'docs/design/evidence/html-react/react-desktop-1440.png',
        measurements: [row('desktop-1440', 'visible', 'visible')],
      },
    },
    interactionChecks: [{ name: 'nav', applicable: true, observed: true, value: 'opened', before: 'closed', after: 'opened' }],
    receipt: {
      schemaVersion: 2,
      sectionId: ID.sectionId,
      revision: ID.revision,
      approvedBundleSha256: ID.bundleSha256,
      candidateFileHashes: { 'AppLayout.tsx': sha(readFileSync(join(ROOT, 'tests/fixtures/p-web1-rlogic/AppLayout.tsx'))) },
      gateResults: { G0_preflight: 'PASS', G1_contract: 'PASS', G2_rendered_fidelity: 'PASS', G3_state_interaction: 'PASS' },
      measurements: [row('desktop-1440', 'visible', 'visible')],
      overallVerdict: 'PARITY_PASS',
    },
  }
  writeFileSync(reqPath, JSON.stringify(reqData, null, 2))
  try {
    const res = spawnSync(process.execPath, [gateScript, reqPath], { encoding: 'utf8' })
    assert.equal(res.status, 0, `section-gate failed: ${res.stderr || res.stdout}`)
    const parsed = JSON.parse(res.stdout)
    assert.equal(parsed.receipt.code, 'OK')
    assert.equal(parsed.g2.code, 'PARITY_PASS')
    assert.equal(parsed.checkpoint.state, STATES.SECTION_COMPLETE)
    assert.equal(parsed.checkpoint.current, 2)
  } finally {
    try { unlinkSync(reqPath) } catch {}
  }
})
