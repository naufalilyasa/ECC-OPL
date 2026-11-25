// Phase A5 projection gate: Design-Build V2 & typography fidelity on agy CLI.
// Enforces Track A admission (precondition), the ordered G0-G3 gate chain, and
// the bounded repair loop. Reuses checkpoints from scripts/design-build-v2/;
// no parallel state machine.
import { readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { verifyAdmissionCertificate } from '../design-build-v2/track-a-admission.mjs'

export const DESIGN_BUILD_SUBCOMMANDS = Object.freeze(['design', 'typography', 'verify', 'amend'])
export const MAX_REPAIR_CYCLES = 2

// The certificate must carry a passing capture for every viewport Track A
// requires; a partial or arbitrary object cannot admit a page.
export const REQUIRED_VIEWPORTS = ['desktop-1440', 'mobile-390']
const GATE_SEQUENCE = Object.freeze(['G0_preflight', 'G1_contract', 'G2_rendered_fidelity', 'G3_state_interaction'])

function blocked(reason, extra = {}) {
  return { status: 'BLOCKED', reason, ...extra }
}

/** Resolve the canonical design-build authority per install target. */
export function resolveDesignBuildResource(target, repoRoot = '') {
  if (target === 'opencode') {
    return { status: 'OK', target, path: path.join(repoRoot, 'scripts/design-build-v2'),
      authority: 'scripts/design-build-v2/state-machine.mjs' }
  }
  if (target === 'antigravity-cli') {
    return { status: 'OK', target, path: path.join(repoRoot, '.agents/skills/opl-design-build'),
      authority: '.agents/skills/opl-design-build (projected at install time)' }
  }
  return blocked('UNSUPPORTED_TARGET', { target })
}

/**
 * Track A admission is a hard precondition for A5 (R12/IS-6/GAP-6).
 *
 * A declarative object is NOT admission. The certificate is handed to the
 * canonical verifier (`verifyAdmissionCertificate`), which re-reads the actual
 * persisted PNG bytes, checks their dimensions, and re-derives the digests.
 * Shape checks here only produce a clearer diagnosis before that call; they can
 * never grant admission on their own.
 *
 * @param certificate parsed track-a-admission.json
 * @param images      { [viewport]: { reference: Buffer, candidate: Buffer } }
 * @param options     { currentRevisionSha256 } to refuse a stale artifact
 */
export function enforceTrackAAdmission(certificate, images = {}, options = {}) {
  if (!certificate || certificate.status !== 'ADMITTED') {
    return blocked('TRACK_A_NOT_ADMITTED', {
      why: certificate?.reason || 'NO_ADMISSION_CERTIFICATE',
      designBuildReferenceAdmission: 'BLOCKED'
    })
  }

  // A certificate admitted for revision X must not admit revision Y. An
  // interrupted capture leaves the previous file in place, so the binding is
  // checked before any evidence is trusted. Production admission must always
  // carry a binding: omitting the current revision is a missing binding, never
  // a reason to skip the check.
  const currentRevision = options.currentRevisionSha256
  if (!currentRevision) {
    return blocked('TRACK_A_UNVERIFIED', {
      why: 'ADMISSION_REVISION_UNBOUND',
      detail: 'currentRevisionSha256 is required on admission paths',
      designBuildReferenceAdmission: 'BLOCKED'
    })
  }
  const bound = certificate.candidateRevisionSha256
  if (!bound) {
    return blocked('TRACK_A_UNVERIFIED', {
      why: 'ADMISSION_REVISION_UNBOUND',
      designBuildReferenceAdmission: 'BLOCKED'
    })
  }
  if (bound !== currentRevision) {
    return blocked('TRACK_A_UNVERIFIED', {
      why: 'ADMISSION_REVISION_STALE',
      expected: currentRevision,
      actual: bound,
      designBuildReferenceAdmission: 'BLOCKED'
    })
  }

  // The canonical verifier owns evidence integrity and the full applicable gate
  // chain. The anchor (when supplied) proves the reference bundle is the one
  // that was actually approved, not merely one the caller described.
  const verification = verifyAdmissionCertificate(certificate, images, {
    approvedBundleSha256: options.approvedBundleSha256,
    requireApprovedBundle: options.requireApprovedBundle
  })
  if (verification.status !== 'ADMITTED') {
    return blocked('TRACK_A_UNVERIFIED', {
      why: verification.reason || 'CANONICAL_VERIFICATION_FAILED',
      viewport: verification.viewport,
      gate: verification.gate,
      designBuildReferenceAdmission: 'BLOCKED'
    })
  }

  const chain = verifyGateChain(certificate.gateResults)
  if (chain.status !== 'OK') {
    return blocked('TRACK_A_UNVERIFIED', {
      why: 'GATE_CHAIN_FAILED',
      gate: chain.gate,
      expected: chain.expected,
      actual: chain.actual,
      designBuildReferenceAdmission: 'BLOCKED'
    })
  }

  return {
    status: 'OK',
    designBuildReferenceAdmission: 'ADMITTED',
    requiredViewports: verification.requiredViewports,
    verifiedViewports: verification.verifiedViewports,
    gateSequence: verification.gateSequence
  }
}

/**
 * Load the PNG pairs a certificate names, relative to the certificate file.
 * A capture may declare `<side>Path`/`<side>File`; when it declares nothing the
 * producer's naming convention (`<viewport>-<side>.png`) is used, so a
 * certificate written by capture-project-evidence.mjs round-trips.
 * Missing bytes stay missing so the canonical verifier blocks instead of the
 * gate inventing evidence.
 */
export function loadAdmissionImages(certificate, certificatePath) {
  const images = {}
  const baseDir = path.dirname(path.resolve(certificatePath))
  // Compare REAL paths: a symlink placed inside the evidence directory passes a
  // lexical prefix check while readFileSync follows it outside. Resolve the
  // directory once; if it cannot be resolved there is nothing safe to load.
  let realBase
  try {
    realBase = realpathSync(baseDir)
  } catch {
    return images
  }
  const captures = certificate?.captures || {}
  for (const viewport of REQUIRED_VIEWPORTS) {
    const capture = captures[viewport]
    if (!capture) continue
    const pair = {}
    for (const side of ['reference', 'candidate']) {
      const declared = capture[`${side}Path`] || capture[`${side}File`] || `${viewport}-${side}.png`
      if (!declared) continue
      const full = path.resolve(baseDir, declared)
      let real
      try {
        real = realpathSync(full)
      } catch {
        continue
      }
      // A certificate is untrusted input: refuse anything whose real location
      // is outside the real evidence directory.
      if (real !== realBase && !real.startsWith(realBase + path.sep)) continue
      pair[side] = readFileSync(real)
    }
    if (pair.reference || pair.candidate) images[viewport] = pair
  }
  return images
}

/** Ordered G0-G3 chain: every gate must be present and PASS. */
export function verifyGateChain(gateResults = {}) {
  for (const gate of GATE_SEQUENCE) {
    if (gateResults[gate] !== 'PASS') {
      return blocked('GATE_CHAIN_FAILED', { gate, expected: 'PASS', actual: gateResults[gate] ?? null })
    }
  }
  return { status: 'OK', gates: GATE_SEQUENCE.slice() }
}

/** Bounded repair loop: at most MAX_REPAIR_CYCLES per section revision. */
export function checkRepairCap(repairCycles) {
  const n = Number(repairCycles)
  if (!Number.isInteger(n) || n < 0) return blocked('INVALID_REPAIR_COUNT', { repairCycles })
  if (n > MAX_REPAIR_CYCLES) return blocked('REPAIR_CAP_EXCEEDED', { repairCycles: n, max: MAX_REPAIR_CYCLES })
  return { status: 'OK', repairCycles: n, remaining: MAX_REPAIR_CYCLES - n }
}
