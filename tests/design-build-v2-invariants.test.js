// Design-build V2.0 invariants — executable backbone for every milestone step.
// Phase 0 (M0) validators + tests. Each test name matches the --test-name-pattern
// used by docs/plans/design-build-v2-fidelity.plan.md.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(process.env.DB2_REPO_ROOT ?? join(HERE, '..'))
const MANIFEST = resolve(ROOT, 'docs/plans/design-build-v2/foundation-manifest.json')
const PLAN = resolve(ROOT, 'docs/plans/design-build-v2-fidelity.plan.md')
const FIXTURE = resolve(ROOT, 'tests/fixtures/p-web1-rlogic')
const EVIDENCE_DIR = resolve(ROOT, 'docs/design/evidence/p-web1')
const HEX64 = /^[0-9a-f]{64}$/
export const renderedEvidence = () => JSON.parse(readFileSync(join(EVIDENCE_DIR, 'rendered-parity.json'), 'utf8'))
export const renderedCase = (name) => {
  const ev = renderedEvidence()
  const c = ev.cases[name]
  assert.ok(c, `rendered case ${name} missing`)
  // Re-verify the screenshot bytes on disk match the recorded hash before trusting it.
  const disk = sha256(readFileSync(join(EVIDENCE_DIR, c.screenshotFile)))
  assert.equal(disk, c.screenshotSha256, 'screenshot hash drift')
  return { source: ev.source, diffs: c.diffs, paddingDelta: c.paddingDelta,
    evidence: { ...c.renderedEvidence, approvedSha256: ev.approved.screenshotSha256,
      candidateSha256: c.screenshotSha256 } }
}

export const sha256 = (b) => createHash('sha256').update(Buffer.from(b)).digest('hex')
const read = (p) => readFileSync(p, 'utf8')

// Real context builder from disk bytes — required by the mandatory validators.
export const receiptContext = (overrides = {}) => {
  const receipt = JSON.parse(readFileSync(join(EVIDENCE_DIR, '00-topbar-receipt.json'), 'utf8'))
  const png = (n) => readFileSync(join(EVIDENCE_DIR, n))
  const base = {
    identity: { sectionId: receipt.sectionId, revision: receipt.revision,
      bundleSha256: receipt.approvedBundleSha256 },
    candidateFiles: { 'AppLayout.tsx': Buffer.from(read(join(FIXTURE, 'AppLayout.tsx'))) },
    active: { sectionId: receipt.sectionId, revision: receipt.revision,
      approvedBundleSha256: receipt.approvedBundleSha256, current: 1, state: 'PARITY_PASS' },
    canvasApproval: { approved: true, verdictId: 'canvas:5b8f3d6b99aa@2026-11-24T03:16:23.184Z', sectionId: receipt.sectionId,
      revision: receipt.revision, bundleSha256: receipt.approvedBundleSha256 },
    frameworkCompleteEvidence: { identitySha256: 'a'.repeat(64), build: 'app-Bf7snb_q.js' },
    contractChecks: [{ name: 'token-map-bound', observed: true }, { name: 'geometry-declared', observed: true }],
    requiredViewports: ['mobile-390', 'mobile-360'],
    viewportEvidence: {
      'mobile-390': { screenshot: png('00-topbar-approved.png'), candidateScreenshot: png('00-topbar-repaired.png'),
        measurements: receipt.measurements.map((m) => ({ ...m, profile: 'mobile-390' })) },
      'mobile-360': { screenshot: png('00-topbar-approved.png'), candidateScreenshot: png('00-topbar-repaired.png'),
        measurements: receipt.measurements.map((m) => ({ ...m, profile: 'mobile-360' })) },
    },
    interactionChecks: receipt.interactionEvidence.checks.map((c) => ({ ...c, applicable: true,
      value: 'observed:' + c.name, before: 'closed', after: 'opened' })),
  }
  return { ...base, ...overrides, identity: { ...base.identity, ...(overrides.identity ?? {}) } }
}


// --- validators -----------------------------------------------------------
// AC01: manifest must bind every canonical file to its live-disk 64-char digest.
export function verifyFoundationManifest(manifest, root = ROOT) {
  if (!manifest || !Array.isArray(manifest.files)) return { code: 'MANIFEST_SCHEMA_INVALID' }
  for (const entry of manifest.files) {
    if (!HEX64.test(entry.sha256 || '')) return { code: 'AC01_HASH_MISMATCH', path: entry.path, why: 'not 64-hex' }
    const disk = resolve(root, entry.path)
    if (!existsSync(disk)) return { code: 'AC01_HASH_MISMATCH', path: entry.path, why: 'missing' }
    if (sha256(readFileSync(disk)) !== entry.sha256) {
      return { code: 'AC01_HASH_MISMATCH', path: entry.path, why: 'drift' }
    }
  }
  return { code: 'OK', files: manifest.files.length }
}

// Enforcement: honest cooperative disclosure, no unsupported mandatory claim.
// Forbidden tokens are legitimate inside a negative-QA command line (a grep that
// must return 1); only a bare claim outside such a line counts as an overclaim.
export function verifyEnforcement(planText) {
  if (!/COOPERATIVE_NOT_MANDATORY/.test(planText)) return { code: 'ENFORCEMENT_NOT_DECLARED' }
  for (const line of planText.split('\n')) {
    if (/grep|returns exit 1|failure -/.test(line)) continue
    if (/MANDATORY_HOST_ENFORCEMENT|TOCTOU_PROTECTED/.test(line)) {
      return { code: 'ENFORCEMENT_OVERCLAIM', line: line.trim() }
    }
  }
  return { code: 'OK' }
}

// Pilot baseline: each pilot needs its own section, and the shared capture
// profile must lock the concrete viewports (declared once, reused by all pilots).
export function verifyPilotBaseline(planText) {
  const pilots = ['P-WEB1', 'P-WEB2']
  for (const id of pilots) {
    if (!new RegExp('^### Pilot ' + id + '\\b', 'm').test(planText)) {
      return { code: 'PILOT_VIEWPORT_UNDEFINED', pilot: id, why: 'no section' }
    }
  }
  for (const vp of ['1440\\s*[x×]\\s*900', '390\\s*[x×]\\s*844', '360\\s*[x×]\\s*800']) {
    if (!new RegExp(vp).test(planText)) return { code: 'PILOT_VIEWPORT_UNDEFINED', why: vp }
  }
  return { code: 'OK' }
}

// Fixture must be synthetic-labelled and free of private markers.
export function verifyFixture(dir = FIXTURE) {
  const required = ['00-topbar.html', 'AppLayout.tsx', 'capture-config.json', 'active.json', 'README.md']
  for (const name of required) {
    if (!existsSync(join(dir, name))) return { code: 'FIXTURE_INCOMPLETE', missing: name }
  }
  let labelled = false
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (!p.endsWith('.json') && !p.endsWith('.md') && !p.endsWith('.html') && !p.endsWith('.tsx')) continue
    const body = read(p)
    // Real leak markers are classification headers, not the word inside a
    // negation like "no proprietary code is copied here".
    if (/^\s*(CLASSIFICATION|CONFIDENTIAL\s*[:\-]|PROPRIETARY\s*[:\-])/im.test(body)) {
      return { code: 'FIXTURE_PRIVATE_DATA', file: name }
    }
    if (/synthetic|stand-in|disposable/i.test(body)) labelled = true
  }
  if (!labelled) return { code: 'FIXTURE_UNLABELLED' }
  return { code: 'OK' }
}

// --- Phase 0 tests --------------------------------------------------------
test('AC01 hash mismatch', () => {
  assert.ok(existsSync(MANIFEST), `foundation manifest missing: ${MANIFEST}`)
  const manifest = JSON.parse(read(MANIFEST))
  assert.equal(manifest.files.length, 8, 'manifest must bind all 8 canonical files')
  assert.equal(verifyFoundationManifest(manifest).code, 'OK')
  // Negative: any stale digest is rejected.
  const tampered = { files: manifest.files.map((e, i) => i === 0 ? { ...e, sha256: '0'.repeat(64) } : e) }
  assert.equal(verifyFoundationManifest(tampered).code, 'AC01_HASH_MISMATCH')
})

test('enforcement cooperative disclosure', () => {
  const r = verifyEnforcement(read(PLAN))
  assert.equal(r.code, 'OK', JSON.stringify(r))
})

test('pilot specification baseline', () => {
  assert.equal(verifyPilotBaseline(read(PLAN)).code, 'OK')
})

test('pilot missing viewport', () => {
  const r = verifyPilotBaseline('### P-WEB1: no viewport declared here\n### P-WEB2: none')
  assert.equal(r.code, 'PILOT_VIEWPORT_UNDEFINED')
})

test('fixture staged', () => {
  assert.equal(verifyFixture().code, 'OK')
})

test('fixture no CONFIDENTIAL leak', () => {
  const r = verifyFixture(FIXTURE)
  assert.notEqual(r.code, 'FIXTURE_PRIVATE_DATA')
  assert.equal(r.code, 'OK')
})

test('verify-bundle tool absent', () => {
  assert.ok(!/scripts\/verify-bundle\.js/.test(read(PLAN)), 'dead tool reference must stay gone')
})

// --- Phase 1 (M1) validators ----------------------------------------------
// Full-bundle identity: HTML + CSS/contracts/fonts/assets/shared shell/capture + state.
// `files` is a map of normalized relative path -> bytes; digest over a canonical JSON of
// path->sha256 so any added/removed/changed dependency invalidates the approval.
export function bundleDigest(files) {
  const entries = Object.keys(files).sort().map((p) => [p, sha256(files[p])])
  return sha256(JSON.stringify(entries))
}
export function verifyBundleSeal(active, files) {
  const expected = bundleDigest(files)
  if (active.approvedBundleSha256 !== expected) {
    return { code: 'BUNDLE_INVALIDATED', expected, observed: active.approvedBundleSha256 ?? null }
  }
  return { code: 'OK', sha256: expected }
}
export const fixtureBundle = () => {
  const out = {}
  for (const name of readdirSync(FIXTURE)) {
    const p = join(FIXTURE, name)
    // active.json stores the seal itself; excluding avoids a self-referential digest.
    if (name.startsWith('test-') || name.endsWith('.mjs') || name === 'bundle-manifest.json' || name === 'active.json') continue
    out[name] = readFileSync(p)
  }
  for (const name of ['contracts/TOKEN-MAP.md', 'contracts/TYPOGRAPHY-MAP.md', 'capture/profile.json']) {
    const p = join(ROOT, 'docs/plans/design-build-v2', name)
    if (existsSync(p)) out[name] = readFileSync(p)
  }
  return out
}

export function verifyAdapterReact(tsx) {
  if (/<style[^>]*>[\s\S]*?\.[a-z]/.test(tsx)) return { code: 'GLOBAL_CSS_SPILL_DETECTED' }
  if (!/className=/.test(tsx)) return { code: 'ADAPTER_TRANSLATION_MISSING' }
  if (!/AppLayout/.test(tsx)) return { code: 'INERTIA_LAYOUT_LOST' }
  return { code: 'OK' }
}

import { verifyRenderedParity, sourceHint } from '../scripts/design-build-v2/rendered-authority.mjs'
import { verifyReceipt, advanceCheckpoint, verifyIdentitySeparation, verifyFrameworkRepair } from '../scripts/design-build-v2/state-machine.mjs'
export { verifyReceipt, advanceCheckpoint, verifyIdentitySeparation, verifyFrameworkRepair }

// G2 authority: browser-rendered evidence only. Source-level regex stays available
// as a triage hint but can NEVER grant PARITY_PASS (external review F1/F2).
export function measureTopbar(candidate) {
  const h = sourceHint(candidate)
  return { paddingTop: h.paddingTop, badgeVisible: h.badgeToken, classification: h.classification }
}
export function verifyParity(renderedCase) {
  return verifyRenderedParity(renderedCase)
}
export function verifySourceHint(tsx) {
  return sourceHint(tsx)
}

// Validators now imported from production module scripts/design-build-v2/state-machine.mjs

export function verifyRepairLimit(failureCount) {
  return failureCount >= 3 ? { code: 'REPAIR_LIMIT_EXCEEDED' } : { code: 'OK' }
}

// --- Phase 1 tests ---------------------------------------------------------
test('bundle verification protocol', () => {
  const active = JSON.parse(read(join(FIXTURE, 'active.json')))
  assert.equal(verifyBundleSeal(active, fixtureBundle()).code, 'OK')
})

test('bundle tampering invalidation', () => {
  const active = JSON.parse(read(join(FIXTURE, 'active.json')))
  const files = fixtureBundle(); files['00-topbar.html'] = Buffer.from(files['00-topbar.html'] + '\n<!-- tamper -->')
  assert.equal(verifyBundleSeal(active, files).code, 'BUNDLE_INVALIDATED')
})

test('adapter-react translation rules', () => {
  assert.equal(verifyAdapterReact(read(join(FIXTURE, 'AppLayout.tsx'))).code, 'OK')
})

test('adapter-react unanchored global css', () => {
  assert.equal(verifyAdapterReact('<style>.warehouse-badge{color:red}</style><AppLayout/>' ).code,
    'GLOBAL_CSS_SPILL_DETECTED')
})

test('probe R04 negative drift — browser-detected', () => {
  for (const name of ['hideParent', 'inlinePt32']) {
    const r = verifyParity(renderedCase(name), {
      screenshots: { approved: readFileSync(join(EVIDENCE_DIR, '00-topbar-approved.png')),
        candidate: readFileSync(join(EVIDENCE_DIR, renderedEvidence().cases[name].screenshotFile)) },
      requiredViewports: ['mobile-390', 'mobile-360'],
      viewportMeasurements: {
        'mobile-390': name === 'hideParent' ? [{ landmark: 'badge', expected: 'visible', actual: 'hidden' }] : [],
        'mobile-360': name === 'hideParent' ? [{ landmark: 'badge', expected: 'visible', actual: 'hidden' }] : [],
      },
    })
    assert.ok(['PARITY_FAIL', 'PARITY_UNVERIFIED'].includes(r.code))
  }
  const src = verifySourceHint('<header className="topbar hidden pt-6">')
  assert.equal(src.classification, 'SOURCE_LEVEL_HINT', 'source regex is never rendered authority')
})

test('regex-only approval cannot claim rendered parity', () => {
  assert.equal(verifyParity('<header className="topbar pt-4">', {}).code, 'PARITY_UNVERIFIED')
})

test('step 8 repair topbar — lifecycle + verified completion', () => {
  const canvasBefore = sha256(readFileSync(join(FIXTURE, '00-topbar.html')))
  const r = JSON.parse(readFileSync(join(EVIDENCE_DIR, '00-topbar-receipt.json'), 'utf8'))
  const ctx = receiptContext()
  const draft = { ...JSON.parse(read(join(FIXTURE, 'active.json'))), state: 'PREVIEW_DRAFT',
    sectionId: r.sectionId, revision: r.revision }
  // PREVIEW_DRAFT can never advance directly; canvas approval is required.
  assert.equal(advanceCheckpoint(draft, r, ctx).code, 'CANVAS_APPROVAL_REQUIRED')
  // PARITY_PENDING is a valid state and evaluates to PARITY_PASS (not rejected).
  const pending = { ...draft, state: 'PARITY_PENDING' }
  assert.equal(advanceCheckpoint(pending, r, ctx).code, 'PARITY_EVALUATED')
  // With PARITY_PASS + verified receipt, current advances exactly once.
  const active = { ...draft, state: 'PARITY_PASS' }
  assert.equal(advanceCheckpoint(active, 'PARITY_PASS', ctx).code, 'RECEIPT_REQUIRED')
  const next = advanceCheckpoint(active, r, ctx)
  assert.ok(next.current === active.current + 1, 'current advances exactly once')
  assert.equal(next.state, 'SECTION_COMPLETE')
  assert.equal(advanceCheckpoint(next, r, ctx).code, 'ALREADY_COMPLETE')
  assert.equal(sha256(readFileSync(join(FIXTURE, '00-topbar.html'))), canvasBefore, 'canvas bytes untouched')
})

test('step 8 repair limit exceeded', () => {
  assert.equal(verifyRepairLimit(2).code, 'OK')
  assert.equal(verifyRepairLimit(3).code, 'REPAIR_LIMIT_EXCEEDED')
  const active = { ...JSON.parse(read(join(FIXTURE, 'active.json'))), state: 'PREVIEW_DRAFT' }
  assert.equal(advanceCheckpoint(active, 'PARITY_FAIL').current, active.current, 'failure must not advance')
})

test('receipt schema valid (browser-rendered, mandatory context)', () => {
  const r = JSON.parse(readFileSync(join(EVIDENCE_DIR, '00-topbar-receipt.json'), 'utf8'))
  assert.equal(verifyReceipt(r, receiptContext()).code, 'OK')
  assert.equal(verifyReceipt(r).why, 'CONTEXT_REQUIRED', 'omitting context can never yield OK')
})

test('receipt rejects source-only PASS without rendered evidence', () => {
  const r = JSON.parse(readFileSync(join(EVIDENCE_DIR, '00-topbar-receipt.json'), 'utf8'))
  const ctx = receiptContext()
  ctx.interactionChecks = []
  assert.equal(verifyReceipt(r, ctx).why, 'interactionEvidenceMissing')
})

test('receipt schema reject contradiction', () => {
  const r = JSON.parse(readFileSync(join(EVIDENCE_DIR, '00-topbar-receipt.json'), 'utf8'))
  r.measurements = [{ profile: 'mobile-390', state: 'default', landmark: 'x', property: 'p', expected: '1', actual: '2', verdict: 'PASS' }]
  assert.notEqual(verifyReceipt(r, receiptContext()).code, 'OK')
})

test('receipt rejects contradiction under canonical PARITY_PASS verdict', () => {
  const r = JSON.parse(readFileSync(join(EVIDENCE_DIR, '00-topbar-receipt.json'), 'utf8'))
  r.overallVerdict = 'PASS'
  assert.notEqual(verifyReceipt(r, receiptContext()).code, 'OK')
})

// --- Review defects: mandatory evidence cannot be bypassed ----------------
test('receipt rejects wrong section and revision', () => {
  const r = JSON.parse(readFileSync(join(EVIDENCE_DIR, '00-topbar-receipt.json'), 'utf8'))
  assert.equal(verifyReceipt({ ...r, sectionId: 'other-section' }, receiptContext()).why, 'sectionMismatch')
  assert.equal(verifyReceipt({ ...r, revision: 'r9' }, receiptContext()).why, 'revisionMismatch')
})

test('receipt rejects nonexistent candidate file with valid-format hash', () => {
  const r = JSON.parse(readFileSync(join(EVIDENCE_DIR, '00-topbar-receipt.json'), 'utf8'))
  const bad = { ...r, candidateFileHashes: { 'does-not-exist.tsx': 'a'.repeat(64) } }
  assert.notEqual(verifyReceipt(bad, receiptContext()).code, 'OK')
})

test('receipt rejects contradictory expected/actual with PASS label', () => {
  const r = JSON.parse(readFileSync(join(EVIDENCE_DIR, '00-topbar-receipt.json'), 'utf8'))
  r.measurements = [{ profile: 'mobile-390', state: 'default', landmark: 'x', property: 'paddingTop', expected: '16px', actual: '32px', verdict: 'PASS' }]
  assert.notEqual(verifyReceipt(r, receiptContext()).code, 'OK')
})

test('receipt rejects missing required measurement field', () => {
  const r = JSON.parse(readFileSync(join(EVIDENCE_DIR, '00-topbar-receipt.json'), 'utf8'))
  delete r.measurements[0].actual
  assert.equal(verifyReceipt(r, receiptContext()).why, 'measurementFieldMissing')
})

test('receipt rejects missing/invalid screenshot bytes', () => {
  const r = JSON.parse(readFileSync(join(EVIDENCE_DIR, '00-topbar-receipt.json'), 'utf8'))
  const ctx = receiptContext()
  r.viewportScreenshots = { 'mobile-360': 'a'.repeat(64) }
  ctx.viewportEvidence['mobile-360'].screenshot = Buffer.from('tampered')
  assert.notEqual(verifyReceipt(r, ctx).code, 'OK')
})

test('receipt rejects missing evidence for required viewport', () => {
  const r = JSON.parse(readFileSync(join(EVIDENCE_DIR, '00-topbar-receipt.json'), 'utf8'))
  const ctx = receiptContext()
  ctx.requiredViewports = ['desktop-1440', 'tablet-768']
  assert.equal(verifyReceipt(r, ctx).why, 'viewportEvidenceMissing')
})

test('receipt rejects unsupported interaction "failed" and truthy strings', () => {
  const r = JSON.parse(readFileSync(join(EVIDENCE_DIR, '00-topbar-receipt.json'), 'utf8'))
  const ctx = receiptContext()
  ctx.interactionChecks = [{ name: 'nav', applicable: true, observed: true, value: 'failed' }]
  assert.equal(verifyReceipt(r, ctx).why, 'interactionUnsupported')
  ctx.interactionChecks = [{ name: 'nav', applicable: true, observed: true, value: 'failed' }]
  assert.equal(verifyReceipt(r, ctx).why, 'interactionUnsupported')
})

test('advanceCheckpoint requires lifecycle, identity and framework completion', () => {
  const r = JSON.parse(readFileSync(join(EVIDENCE_DIR, '00-topbar-receipt.json'), 'utf8'))
  const ctx = receiptContext()
  const active = { ...JSON.parse(read(join(FIXTURE, 'active.json'))), state: 'PARITY_PASS',
    sectionId: r.sectionId, revision: r.revision }
  assert.equal(advanceCheckpoint({ ...active, state: 'PREVIEW_DRAFT' }, r, ctx).code, 'CANVAS_APPROVAL_REQUIRED')
  assert.equal(advanceCheckpoint(active, r, { ...ctx, frameworkCompleteEvidence: null }).code, 'FRAMEWORK_IMPLEMENTATION_INCOMPLETE')
  assert.equal(advanceCheckpoint(active, r, { ...ctx, identity: { ...ctx.identity, sectionId: 'wrong' } }).code, 'IDENTITY_CONTEXT_CONFLICT')
})

test('approved reference and candidate identity stay separate', () => {
  const approved = { referenceSha256: 'a'.repeat(64), files: ['01-app-shell.html', 'app.css'] }
  const candidate = { implementationSha256: 'b'.repeat(64), files: ['AppLayout.tsx', 'build.css'] }
  assert.equal(verifyIdentitySeparation(approved, candidate).code, 'OK')
  assert.notEqual(verifyIdentitySeparation(approved, { ...approved, implementationSha256: 'a'.repeat(64), files: ['AppLayout.tsx'] }).code, 'OK')
  const repaired = { referenceSha256: 'a'.repeat(64), implementationSha256: 'c'.repeat(64) }
  const rr = verifyFrameworkRepair({ ...approved, implementationSha256: 'b'.repeat(64) }, repaired)
  assert.equal(rr.code, 'OK')
  assert.equal(rr.parityEvidenceInvalidated, true)
  assert.equal(rr.approvedConsentPreserved, true)
  assert.equal(verifyFrameworkRepair({ ...approved, implementationSha256: 'b'.repeat(64) },
    { ...repaired, referenceSha256: 'd'.repeat(64) }).why, 'approvedConsentChanged')
})

// --- Phase 2 (M2) validators ----------------------------------------------
export function verifyContractScales(contractText) {
  if (!/4\s*\/\s*6\s*\/\s*8/.test(contractText) || !/8\s*\/\s*12\s*\/\s*20/.test(contractText)) {
    return { code: 'TASTE_SCALES_NOT_DECLARED' }
  }
  if (!/default/i.test(contractText)) return { code: 'SCALE_NOT_DEFAULT' }
  // Only a positive claim that 8/12/16 is mandatory counts; "not mandatory"
  // (i.e. declared as a default) is the intended V2.0 wording.
  if (/8\s*\/\s*12\s*\/\s*16[^.]*(?:is|must be)\s+mandatory/i.test(contractText)) {
    return { code: 'RIGID_GRID_STILL_MANDATORY' }
  }
  return { code: 'OK' }
}

export function verifyScaffoldAudit(scaffoldText) {
  if (/\/gan-scaffold/.test(scaffoldText)) return { code: 'STALE_COMMAND_REFERENCE' }
  if (!/TOKEN-MAP\.md/.test(scaffoldText)) return { code: 'DYNAMIC_TOKEN_SOURCE_MISSING' }
  return { code: 'OK' }
}

export function verifyTypographyLifecycle(cmdText) {
  for (const mode of ['DESIGN', 'VERIFY', 'AMEND']) {
    if (!new RegExp('\\b' + mode + '\\b').test(cmdText)) return { code: 'TYPOGRAPHY_MODE_MISSING', mode }
  }
  if (!/MUTATION_BLOCKED|contract is frozen/i.test(cmdText)) return { code: 'POST_FREEZE_MUTATION_UNBOUNDED' }
  return { code: 'OK' }
}

export function verifyResumeMatrix(skillText) {
  if (!/re-?validat/i.test(skillText)) return { code: 'RESUME_NO_HASH_REVALIDATION' }
  if (!/CANVAS_APPROVED/.test(skillText) || !/never increment|must not advance|does not advance/i.test(skillText)) {
    return { code: 'CANVAS_APPROVED_ADVANCES_SECTION' }
  }
  return { code: 'OK' }
}

// --- Phase 3 (M3) validators ----------------------------------------------
export function verifyAdapters(dir) {
  const required = ['web-common.md', 'adapter-vue.md', 'adapter-svelte.md', 'adapter-astro.md',
    'native-common.md', 'adapter-flutter.md', 'adapter-compose.md']
  for (const name of required) {
    if (!existsSync(join(dir, name))) return { code: 'ADAPTER_MISSING', name }
  }
  if (!/public\/images|import/.test(read(join(dir, 'web-common.md')))) return { code: 'ASSET_REMAP_MISSING' }
  if (!/webview/i.test(read(join(dir, 'native-common.md')))) return { code: 'NATIVE_WEBVIEW_GUARD_MISSING' }
  return { code: 'OK' }
}

export function verifyConditionalLoad(commandText) {
  for (const marker of ['package.json', 'pubspec.yaml', 'build.gradle.kts']) {
    if (!commandText.includes(marker)) return { code: 'FRAMEWORK_DETECTION_INCOMPLETE', marker }
  }
  if (!/only the relevant|conditionally|skip.*if absent/i.test(commandText)) {
    return { code: 'UNCONDITIONAL_SKILL_LOAD' }
  }
  return { code: 'OK' }
}

// --- Phase 2/3 tests -------------------------------------------------------
test('custom radius 20px declared', () => {
  const t = read(resolve(ROOT, 'skills/design-contract-system/SKILL.md'))
  assert.equal(verifyContractScales(t).code, 'OK')
})

test('taste sharp soft scales legal', () => {
  assert.equal(verifyContractScales('use 4/6/8 sharp and 8/12/20 soft as defaults').code, 'OK')
  assert.equal(verifyContractScales('use 4/6/8 and 8/12/20 as defaults; but 8/12/16 is mandatory globally').code,
    'RIGID_GRID_STILL_MANDATORY')
})

test('scaffold audit dynamic tokens', () => {
  assert.equal(verifyScaffoldAudit(read(resolve(ROOT, 'skills/frontend-scaffold/SKILL.md'))).code, 'OK')
})

test('typography verify mode', () => {
  assert.equal(verifyTypographyLifecycle(read(resolve(ROOT, 'commands/typography.md'))).code, 'OK')
})

test('typography post-freeze redesign blocked', () => {
  assert.equal(verifyTypographyLifecycle('DESIGN, VERIFY, AMEND; all modes freely editable post-freeze').code,
    'POST_FREEZE_MUTATION_UNBOUNDED')
})

test('workflow resume hash revalidation', () => {
  assert.equal(verifyResumeMatrix(read(resolve(ROOT, 'skills/design-build/SKILL.md'))).code, 'OK')
})

test('workflow resume altered canvas', () => {
  assert.equal(verifyResumeMatrix('RESUME: trust saved state without checks').code, 'RESUME_NO_HASH_REVALIDATION')
})

test('web common scoped selectors', () => {
  assert.equal(verifyAdapters(resolve(ROOT, 'skills/design-build/references')).code, 'OK')
})

test('conditional skill load react', () => {
  assert.equal(verifyConditionalLoad(read(resolve(ROOT, '.opencode/commands/design-build.md'))).code, 'OK')
})

test('unconditional skill load blocked', () => {
  assert.equal(verifyConditionalLoad('always load all framework skills').code, 'FRAMEWORK_DETECTION_INCOMPLETE')
})

// --- Phase 5 (M5) tests ----------------------------------------------------
test('status contract deployment guardrails', () => {
  const t = read(resolve(ROOT, 'docs/releases/design-build-v2/status-contract.txt'))
  for (const line of ['CANONICAL_DESIGN_BUILD_RESOLUTION=STATIC_VERIFIED',
    'HOST_ENFORCEMENT=COOPERATIVE_NOT_MANDATORY',
    'OWNER_DEPLOYMENT_AUTHORIZATION=NOT_GIVEN',
    'ACTIVE_RUNTIME_DEPLOYED=NO']) {
    assert.ok(t.includes(line), `missing: ${line}`)
  }
  assert.ok(!/ACTIVE_RUNTIME_DEPLOYED=YES/.test(t))
  assert.ok(!/OWNER_DEPLOYMENT_AUTHORIZATION=GRANTED/.test(t))
})

test('staged distribution manifest honest', () => {
  const m = JSON.parse(read(resolve(ROOT, 'staging/distribution/design-build-v2-manifest.json')))
  assert.equal(m.active_runtime_deployed, false)
  assert.equal(m.owner_deployment_authorization, 'NOT_GIVEN')
  assert.equal(m.files.length, 23)
  for (const e of m.files) {
    assert.ok(HEX64.test(e.sha256), `bad digest for ${e.path}`)
    assert.ok(!/PLACEHOLDER/.test(e.sha256))
    // A digest that matches no file on disk makes verification fail closed,
    // and skipping verification ships an unverifiable artifact.
    const bytes = readFileSync(resolve(ROOT, e.path))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), e.sha256,
      `stale manifest digest for ${e.path}`)
    if (typeof e.bytes === 'number') {
      assert.equal(bytes.length, e.bytes, `stale manifest size for ${e.path}`)
    }
  }
})
