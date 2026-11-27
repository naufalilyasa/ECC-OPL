// Production section state machine for design-build V2.0. Imported by the real
// /design-build workflow, NOT defined inside test files.
//
// Brief closure (SCF-02/04/05): verify evidence BEFORE any positive transition;
// active identity is authoritative (context cannot supersede it); completion
// increments once; approval must be a real verdict event, not `approved:true`.
import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { verifyRenderedParity, pngInfo } from './rendered-authority.mjs'

export const HEX64 = /^[0-9a-f]{64}$/
export const sha256 = (b) => createHash('sha256').update(Buffer.from(b)).digest('hex')
const reject = (why, extra = {}) => ({ code: 'INVALID_RECEIPT', why, ...extra })

export const STATES = Object.freeze({
  PREVIEW_DRAFT: 'PREVIEW_DRAFT', AWAITING_APPROVAL: 'AWAITING_APPROVAL',
  CANVAS_APPROVED: 'CANVAS_APPROVED', PORT_IN_PROGRESS: 'PORT_IN_PROGRESS',
  PARITY_PENDING: 'PARITY_PENDING', PARITY_PASS: 'PARITY_PASS',
  REPAIR_REQUIRED: 'REPAIR_REQUIRED', BLOCKED: 'BLOCKED', SECTION_COMPLETE: 'SECTION_COMPLETE',
})
const REQUIRED_GATES = ['G0_preflight', 'G1_contract', 'G2_rendered_fidelity', 'G3_state_interaction']
const MEASUREMENT_FIELDS = ['profile', 'state', 'landmark', 'property', 'expected', 'actual', 'verdict']
const hasBytes = (v) => Buffer.isBuffer(v) || typeof v === 'string' || v instanceof Uint8Array
const toBuf = (v) => Buffer.isBuffer(v) ? v : Buffer.from(v)

// Recompute G2 via the SAME authority the command uses (no parallel equality check).
function recomputeG2(receipt, context) {
  const required = context.requiredViewports ?? []
  const vps = context.viewportEvidence ?? {}
  // Independent digest pair PER PROFILE. No shared pair, no `?? screenshot` fallback.
  const byProfile = Object.fromEntries(required.map((vp) => [vp, {
    approved: sha256(toBuf(vps[vp]?.screenshot ?? Buffer.alloc(0))),
    candidate: sha256(toBuf(vps[vp]?.candidateScreenshot ?? Buffer.alloc(0))),
  }]))
  return verifyRenderedParity(
    { source: 'chromium-playwright', evidence: { verified: true, byProfile } },
    { screenshotPairs: Object.fromEntries(required.map((vp) => [vp, {
        reference: vps[vp]?.screenshot, candidate: vps[vp]?.candidateScreenshot }])),
      requiredViewports: required,
      profileDimensions: context.profileDimensions,
      viewportMeasurements: Object.fromEntries(required.map((vp) => [vp, vps[vp]?.measurements ?? []])) })
}

/**
 * Verify a receipt against authoritative context. Every required input is MANDATORY;
 * absence is a rejection. Gates are recomputed and must agree with receipt labels.
 */
export function verifyReceipt(receipt, context) {
  if (!receipt || typeof receipt !== 'object') return reject('schema')
  if (!context || typeof context !== 'object') return reject('CONTEXT_REQUIRED')
  const { identity, candidateFiles, viewportEvidence, canvasApproval, interactionChecks, active } = context
  if (receipt.schemaVersion !== 2) return reject('schemaVersion')

  // Active identity is authoritative; context identity must MATCH it, never replace it.
  const src = active ?? identity
  if (!src?.sectionId || !src?.revision || !HEX64.test(src?.approvedBundleSha256 || '')) {
    return reject('ACTIVE_IDENTITY_INCOMPLETE')
  }
  if (src.dataMode !== undefined && !DATA_MODES.includes(src.dataMode)) return reject('DATA_MODE_INVALID')
  if (identity && (identity.sectionId !== src.sectionId || identity.revision !== src.revision
      || identity.bundleSha256 !== src.approvedBundleSha256)) return reject('IDENTITY_CONTEXT_CONFLICT')
  if (receipt.sectionId !== src.sectionId) return reject('sectionMismatch')
  if (receipt.revision !== src.revision) return reject('revisionMismatch')
  if (receipt.approvedBundleSha256 !== src.approvedBundleSha256) return reject('bundleRevisionMismatch')

  // Canvas approval must be a real verdict event bound to exact identity.
  if (!canvasApproval?.verdictId || !canvasApproval?.approved
      || canvasApproval.sectionId !== src.sectionId || canvasApproval.revision !== src.revision
      || canvasApproval.bundleSha256 !== src.approvedBundleSha256) {
    return reject('canvasApprovalMissing')
  }

  // Candidate identity from ACTUAL bytes (candidate inventory is scope-derived, not receipt-chosen).
  if (!candidateFiles || typeof candidateFiles !== 'object') return reject('CONTEXT_CANDIDATES_REQUIRED')
  const claimed = Object.entries(receipt.candidateFileHashes ?? {})
  if (!claimed.length) return reject('candidateHashEmpty')
  const supplied = Object.keys(candidateFiles)
  if (supplied.length !== claimed.length || supplied.some((p) => !(p in (receipt.candidateFileHashes ?? {})))) {
    return reject('candidateInventoryMismatch')
  }
  for (const [path, hash] of claimed) {
    if (!HEX64.test(hash || '')) return reject('candidateHash', { path })
    if (!hasBytes(candidateFiles[path])) return reject('candidateFileMissing', { path })
    if (sha256(toBuf(candidateFiles[path])) !== hash) return reject('candidateFileHashMismatch', { path })
  }

  const gates = {}
  gates.G0_preflight = src.sectionId && Object.keys(candidateFiles).length && canvasApproval.verdictId ? 'PASS' : 'FAIL'
  const contractChecks = context.contractChecks
  gates.G1_contract = (canvasApproval.approved && canvasApproval.bundleSha256 === src.approvedBundleSha256
    && Array.isArray(contractChecks) && contractChecks.length > 0
    && contractChecks.every((c) => c && typeof c.name === 'string' && c.observed === true)) ? 'PASS' : 'FAIL'

  // Measurements: complete typed rows, expected===actual, verdict PASS, no duplicates.
  if (!Array.isArray(receipt.measurements) || !receipt.measurements.length) return reject('measurementsMissing')
  const seen = new Set()
  for (const m of receipt.measurements) {
    for (const f of MEASUREMENT_FIELDS) if (!(f in m)) return reject('measurementFieldMissing', { field: f })
    const key = `${m.profile}|${m.state}|${m.landmark}|${m.property}`
    if (seen.has(key)) return reject('measurementDuplicate', { key }); seen.add(key)
    if (m.expected === undefined || m.expected === null || m.actual === undefined || m.actual === null) {
      return reject('measurementValueMissing', { key })
    }
    if (typeof m.expected === 'number' && !Number.isFinite(m.expected)) return reject('measurementNaN', { key })
    if (typeof m.actual === 'number' && !Number.isFinite(m.actual)) return reject('measurementNaN', { key })
    if (m.expected !== m.actual) return reject('measurementContradiction', { key })
    if (m.verdict !== 'PASS') return reject('measurementFail', { key })
  }

  // Required viewport evidence: real PNG pairs + typed measurements each.
  if (!Array.isArray(context.requiredViewports) || !context.requiredViewports.length) {
    return reject('REQUIRED_VIEWPORTS_MISSING')
  }
  if (!viewportEvidence || typeof viewportEvidence !== 'object') return reject('VIEWPORT_EVIDENCE_REQUIRED')
  for (const vp of context.requiredViewports) {
    const ev = viewportEvidence[vp]
    if (!ev) return reject('viewportEvidenceMissing', { viewport: vp })
    if (!Buffer.isBuffer(ev.screenshot) || !Buffer.isBuffer(ev.candidateScreenshot)
        || !pngInfo(ev.screenshot) || !pngInfo(ev.candidateScreenshot)) {
      return reject('viewportCandidateMissing', { viewport: vp })
    }
    if (!Array.isArray(ev.measurements) || !ev.measurements.length) return reject('viewportMeasurementsMissing', { viewport: vp })
    for (const m of ev.measurements) {
      if (!MEASUREMENT_FIELDS.every((f) => f in m)) return reject('viewportMeasurementIncomplete', { viewport: vp })
      if (m.expected === undefined || m.actual === undefined) return reject('viewportMeasurementValueMissing', { viewport: vp })
      if (m.expected !== m.actual) return reject('viewportMeasurementDrift', { viewport: vp })
    }
    const digest = sha256(toBuf(ev.screenshot))
    if (receipt.viewportScreenshots?.[vp] && receipt.viewportScreenshots[vp] !== digest) {
      return reject('viewportScreenshotHashMismatch', { viewport: vp })
    }
  }

  // G2 recomputed via the single authority; G3 from real interaction postconditions.
  const g2 = recomputeG2(receipt, context)
  gates.G2_rendered_fidelity = g2.code === 'PARITY_PASS' ? 'PASS' : 'FAIL'
  if (!Array.isArray(interactionChecks) || !interactionChecks.length) return reject('interactionEvidenceMissing')
  for (const c of interactionChecks) {
    if (!c || typeof c !== 'object' || typeof c.name !== 'string' || typeof c.applicable !== 'boolean') {
      return reject('interactionMalformed')
    }
    if (c.applicable && (c.observed !== true || typeof c.value !== 'string'
        || /^(failed|fail|false|truthy|present)$/i.test(c.value)
        || c.before === undefined || c.after === undefined || c.before === c.after)) {
      return reject('interactionUnsupported', { name: c.name })
    }
  }
  gates.G3_state_interaction = 'PASS'

  // Receipt labels must AGREE with recomputed gates and overall verdict.
  // ALL required gates (G0, G1, G2, G3) must independently pass.
  for (const g of REQUIRED_GATES) {
    if (receipt.gateResults?.[g] !== gates[g]) return reject('gateDisagreement', { gate: g, expected: gates[g] })
    if (gates[g] !== 'PASS') return reject('gateNotVerified', { gate: g })
  }
  const consistent = gates.G2_rendered_fidelity === 'PASS' ? 'PARITY_PASS' : 'PARITY_FAIL'
  if (receipt.overallVerdict !== consistent) return reject('verdictDisagreement', { expected: consistent })
  return { code: 'OK', gates, verifiedViewports: context.requiredViewports.slice(),
    verifiedInteractions: interactionChecks.filter((c) => c.applicable).map((c) => c.name) }
}

/**
 * Advance lifecycle. Verify receipt BEFORE any positive transition. Active
 * identity is authoritative and binding. `current` increments once, on verified
 * completion only. Idempotent on repeat; stale/failed evidence never advances.
 */
export function advanceCheckpoint(active, receipt, context = {}) {
  const frozen = { ...active }
  const state = active?.state
  if (typeof receipt === 'string') return { ...frozen, code: 'RECEIPT_REQUIRED' }
  if (!active?.sectionId || !active?.revision || !HEX64.test(active?.approvedBundleSha256 || '')) {
    return { ...frozen, code: 'ACTIVE_IDENTITY_INCOMPLETE' }
  }
  // Active A with receipt/context B is rejected.
  if (receipt?.sectionId !== active.sectionId || receipt?.revision !== active.revision
      || receipt?.approvedBundleSha256 !== active.approvedBundleSha256) {
    return { ...frozen, code: 'RECEIPT_IDENTITY_MISMATCH' }
  }
  if (context.identity && (context.identity.sectionId !== active.sectionId
      || context.identity.revision !== active.revision
      || context.identity.bundleSha256 !== active.approvedBundleSha256)) {
    return { ...frozen, code: 'IDENTITY_CONTEXT_CONFLICT' }
  }
  const ca = context.canvasApproval
  if (!ca?.verdictId || !ca?.approved || ca.sectionId !== active.sectionId
      || ca.revision !== active.revision || ca.bundleSha256 !== active.approvedBundleSha256) {
    return { ...frozen, code: 'CANVAS_APPROVAL_INVALID' }
  }
  const fe = context.frameworkCompleteEvidence
  if (!fe?.identitySha256 || !HEX64.test(fe.identitySha256)) {
    return { ...frozen, code: 'FRAMEWORK_IMPLEMENTATION_INCOMPLETE' }
  }

  const verified = verifyReceipt(receipt, { ...context, active })
  if (state === STATES.SECTION_COMPLETE) return { ...frozen, code: 'ALREADY_COMPLETE' }
  if (state === STATES.PREVIEW_DRAFT) return { ...frozen, code: 'CANVAS_APPROVAL_REQUIRED' }

  if (state === STATES.PARITY_PENDING) {
    if (verified.code === 'OK') return { ...active, state: STATES.PARITY_PASS,
      code: 'PARITY_EVALUATED', verifiedReceiptSha256: sha256(JSON.stringify(receipt)) }
    return { ...active, state: STATES.REPAIR_REQUIRED, code: 'PARITY_MISMATCH', why: verified.why }
  }
  if (state === STATES.REPAIR_REQUIRED) return { ...active, state: STATES.PARITY_PENDING, code: 'REPAIR_APPLIED' }
  if (state !== STATES.PARITY_PASS) return { ...frozen, code: 'INVALID_LIFECYCLE_TRANSITION', state }
  if (verified.code !== 'OK') return { ...frozen, code: 'PARITY_NOT_VERIFIED', why: verified.why }
  return { ...active, current: active.current + 1, state: STATES.SECTION_COMPLETE,
    // Carried on the completion record so nobody downstream can read a fixture
    // section as production integration.
    dataMode: DATA_MODES.includes(active.dataMode) ? active.dataMode : 'fixture',
    verifiedReceiptSha256: sha256(JSON.stringify(receipt)) }
}

// Approved reference (immutable consent) vs candidate framework identity.
// standalone-html: the approved artifact is HTML and the candidate is a translation
// of it, so sharing bytes or paths means the translation never happened.
export const APPROVED_REFERENCE_KINDS = ['html', 'css', 'fonts', 'assets',
  'design-contract', 'shared-shell', 'capture-profile', 'state-fixtures']
export const CANDIDATE_KINDS = ['framework-implementation', 'framework-styles']

// framework-native: the owner approves the component that ships. The reference and
// the candidate are the SAME source, so identical digests are the contract.
export const NATIVE_APPROVED_REFERENCE_KINDS = ['component-source', 'component-imports',
  'design-contract', 'tokens', 'assets', 'preview-config', 'data-fixture']
export const NATIVE_CANDIDATE_KINDS = ['component-source', 'component-styles']

// Reference kinds whose change alters what the owner actually reviewed. A
// `data-fixture` swap changes data, not design, so it does not force a new
// approval -- it does force verification to rerun.
export const VISUAL_REFERENCE_KINDS = ['component-source', 'component-styles',
  'component-imports', 'design-contract', 'tokens', 'assets', 'preview-config']

export const DATA_MODES = Object.freeze(['fixture', 'production'])

// Order-independent digest over `{ path, sha256 }` entries.
export function computeRevisionFingerprint(entries) {
  const canonical = [...entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  return sha256(JSON.stringify(canonical))
}

// Native approval reference (DBN-06): the component source plus everything that
// shapes what it renders. Digests are supplied by the caller -- this module never
// reads project files, so the same set can be recomputed at acceptance time.
export function fingerprintNativeReference(reference) {
  const files = Array.isArray(reference?.files) ? reference.files : null
  if (!files?.length) return { code: 'NATIVE_REFERENCE_INCOMPLETE', why: 'missingFiles' }
  const seen = new Map()
  for (const file of files) {
    if (!NATIVE_APPROVED_REFERENCE_KINDS.includes(file?.kind)) {
      return { code: 'UNSUPPORTED_REFERENCE_KIND', kind: file?.kind }
    }
    if (typeof file.path !== 'string' || !file.path) return { code: 'NATIVE_REFERENCE_INCOMPLETE', why: 'missingPath' }
    if (!HEX64.test(file.sha256 || '')) return { code: 'NATIVE_REFERENCE_INCOMPLETE', why: 'invalidDigest', path: file.path }
    if (seen.has(file.path) && seen.get(file.path) !== file.sha256) {
      return { code: 'FINGERPRINT_CONFLICT', path: file.path }
    }
    seen.set(file.path, file.sha256)
  }
  if (!files.some((file) => file.kind === 'component-source')) {
    return { code: 'NATIVE_REFERENCE_INCOMPLETE', why: 'missingComponentSource' }
  }
  const entries = [...seen].map(([path, digest]) => ({ path, sha256: digest }))
  const visual = files.filter((file) => VISUAL_REFERENCE_KINDS.includes(file.kind))
  return {
    code: 'OK',
    revisionDigest: computeRevisionFingerprint(entries),
    designDigest: computeRevisionFingerprint(visual.map((file) => ({ path: file.path, sha256: file.sha256 }))),
    paths: entries.map((entry) => entry.path).sort(),
  }
}

// Approval stands only while the design inputs are unchanged. A non-visual change
// (fixture data swap) keeps the approval but invalidates the previous checks.
export function verifyApprovalRevision(approval, reference) {
  const current = fingerprintNativeReference(reference)
  if (current.code !== 'OK') return current
  if (!HEX64.test(approval?.revisionDigest || '') || !HEX64.test(approval?.designDigest || '')) {
    return { code: 'APPROVAL_BINDING_INCOMPLETE' }
  }
  if (approval.designDigest !== current.designDigest) {
    return { code: 'STALE_REVISION', reapprovalRequired: true, why: 'visualReferenceChanged',
      approvedDesignDigest: approval.designDigest, currentDesignDigest: current.designDigest }
  }
  if (approval.revisionDigest !== current.revisionDigest) {
    return { code: 'VERIFICATION_REQUIRED', reapprovalRequired: false, why: 'nonVisualReferenceChanged',
      revisionDigest: current.revisionDigest, designDigest: current.designDigest }
  }
  return { code: 'OK', revisionDigest: current.revisionDigest, designDigest: current.designDigest }
}

// A fixture-only section may complete, but it must never be recorded as
// production integration.
export function verifyCompletionScope(active, claim = 'production') {
  const dataMode = DATA_MODES.includes(active?.dataMode) ? active.dataMode : 'fixture'
  if (claim === 'production' && dataMode !== 'production') return { code: 'FIXTURE_ONLY', dataMode }
  return { code: 'OK', dataMode }
}

// Decision D6: one lifecycle vocabulary, mode-dependent meaning. No second set of
// state names, so resume, gates and receipts stay readable across both modes.
export const MODE_STATE_SEMANTICS = Object.freeze({
  'standalone-html': Object.freeze({
    PORT_IN_PROGRESS: 'porting approved HTML into a framework component',
    PARITY_PENDING: 'standalone-HTML-vs-served-application parity pending',
  }),
  'framework-native': Object.freeze({
    PORT_IN_PROGRESS: 'INTEGRATING: wiring the approved component into the app',
    PARITY_PENDING: 'rendered-integrity verification pending (no HTML reference exists)',
  }),
})

export function verifyIdentitySeparation(approved, candidate, previewMode = 'standalone-html') {
  if (!approved?.referenceSha256 || !HEX64.test(approved.referenceSha256)
      || !candidate?.implementationSha256 || !HEX64.test(candidate.implementationSha256)) {
    return { code: 'IDENTITY_INVALID', why: 'missingOrInvalidDigest' }
  }
  const aFiles = Array.isArray(approved.files) ? approved.files : null
  const cFiles = Array.isArray(candidate.files) ? candidate.files : null
  if (!aFiles?.length || !cFiles?.length) return { code: 'IDENTITY_INVALID', why: 'missingManifests' }
  if (previewMode === 'framework-native') {
    // Single source: the approved component source IS the implementation. Equal
    // digests and shared paths are expected here, and any divergence is drift.
    if (approved.referenceSha256 !== candidate.implementationSha256) {
      return { code: 'IDENTITY_DRIFT', why: 'nativeSourceDivergedFromApproval' }
    }
    return { code: 'OK', singleSource: true,
      referenceSha256: approved.referenceSha256,
      sharedPaths: aFiles.filter((p) => cFiles.includes(p)) }
  }
  if (approved.referenceSha256 === candidate.implementationSha256) return { code: 'IDENTITY_CONFLATED' }
  const overlap = aFiles.filter((p) => cFiles.includes(p))
  if (overlap.length) return { code: 'IDENTITY_CONFLATED', why: 'sharedPath', overlap }
  return { code: 'OK', referenceSha256: approved.referenceSha256, implementationSha256: candidate.implementationSha256 }
}

export function verifyFrameworkRepair(before, after) {
  if (!before?.referenceSha256 || !HEX64.test(before.referenceSha256)
      || !after?.referenceSha256 || !HEX64.test(after.referenceSha256)
      || !before?.implementationSha256 || !HEX64.test(before.implementationSha256)
      || !after?.implementationSha256 || !HEX64.test(after.implementationSha256)) {
    return { code: 'REPAIR_INVALID', why: 'invalidDigest' }
  }
  if (before.referenceSha256 !== after.referenceSha256) return { code: 'REPAIR_INVALID', why: 'approvedConsentChanged' }
  if (before.implementationSha256 === after.implementationSha256) return { code: 'NO_CHANGE', why: 'candidateUnchanged' }
  return { code: 'OK', parityEvidenceInvalidated: true, approvedConsentPreserved: true }
}
