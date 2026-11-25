// Phase A5 projection gate: Design-Build V2 & typography fidelity on agy CLI.
// Enforces Track A admission (precondition), the ordered G0-G3 gate chain, and
// the bounded repair loop. Reuses checkpoints from scripts/design-build-v2/;
// no parallel state machine.
import path from 'node:path'

export const DESIGN_BUILD_SUBCOMMANDS = Object.freeze(['design', 'typography', 'verify', 'amend'])
export const MAX_REPAIR_CYCLES = 2
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
 * A bare `status: 'ADMITTED'` object is NOT sufficient: the certificate must
 * carry verified canonical evidence (bundle seal, gate results, rendered
 * evidence) and the full G0-G3 chain must pass. Synthetic fixture evidence is
 * not production admission.
 */
export function enforceTrackAAdmission(certificate) {
  if (!certificate || certificate.status !== 'ADMITTED') {
    return blocked('TRACK_A_NOT_ADMITTED', {
      why: certificate?.reason || 'NO_ADMISSION_CERTIFICATE',
      designBuildReferenceAdmission: 'BLOCKED'
    })
  }

  // A bare status flag cannot unlock execution.
  const missing = []
  if (!certificate.approvedBundleSha256 || !/^[a-f0-9]{64}$/.test(String(certificate.approvedBundleSha256))) {
    missing.push('approvedBundleSha256')
  }
  if (!certificate.gateResults || typeof certificate.gateResults !== 'object') {
    missing.push('gateResults')
  }
  // The certificate schema keys captures by viewport name (see
  // track-a-admission.mjs, which is the authority on this shape). An array here
  // would reject every certificate the real generator produces.
  const captures = certificate.captures
  if (!captures || typeof captures !== 'object' || Array.isArray(captures)
    || Object.keys(captures).length === 0) {
    missing.push('captures')
  }
  if (!certificate.renderedEvidence || certificate.renderedEvidence.verified !== true) {
    missing.push('renderedEvidence')
  }
  if (missing.length > 0) {
    return blocked('TRACK_A_UNVERIFIED', {
      why: 'ADMISSION_CERTIFICATE_INCOMPLETE',
      missing,
      designBuildReferenceAdmission: 'BLOCKED'
    })
  }

  const chain = verifyGateChain(certificate.gateResults)
  if (chain.status !== 'OK') {
    return blocked('TRACK_A_UNVERIFIED', {
      why: 'GATE_CHAIN_FAILED',
      gate: chain.gate,
      designBuildReferenceAdmission: 'BLOCKED'
    })
  }

  return { status: 'OK', designBuildReferenceAdmission: 'ADMITTED' }
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
