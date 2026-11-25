// Track A admission verifier: the precondition gate for Phase A5.
// An admission is valid only with a complete approved scope, decodable paired
// PNGs at every required viewport, authoritative G2 exit codes, and a coherent
// gate transition sequence. Uses pngInfo from rendered-authority (no rewrite).
import { createHash } from 'node:crypto'
import { pngInfo } from './rendered-authority.mjs'

export { pngInfo }
const sha = (b) => createHash('sha256').update(b).digest('hex')
const REQUIRED_VIEWPORTS = ['desktop-1440', 'mobile-390']
export const CANONICAL_GATE_SEQUENCE = ['G0_preflight', 'G1_contract', 'G2_rendered_fidelity', 'G3_state_interaction']

function blocked(reason, extra = {}) {
  return { status: 'BLOCKED', reason, ...extra }
}

/**
 * Verify a Track A admission certificate against the actual PNG bytes.
 * @param cert parsed track-a-admission.json
 * @param images { [viewport]: { reference: Buffer, candidate: Buffer } }
 */
export function verifyAdmissionCertificate(cert, images = {}) {
  if (!cert || typeof cert !== 'object') return blocked('INVALID_CERTIFICATE')

  // 1. Complete approved scope: required viewports all present.
  const captures = cert.captures || {}
  for (const vp of REQUIRED_VIEWPORTS) {
    if (!captures[vp]) return blocked('MISSING_VIEWPORT', { viewport: vp })
  }

  // 2. Paired PNGs decodable at declared profile dimensions, digests bound.
  const dims = cert.profileDimensions || {}
  for (const vp of REQUIRED_VIEWPORTS) {
    const pair = images[vp]
    if (!pair || !Buffer.isBuffer(pair.reference) || !Buffer.isBuffer(pair.candidate)) {
      return blocked('SCREENSHOT_PAIR_INCOMPLETE', { viewport: vp })
    }
    const ri = pngInfo(pair.reference), ci = pngInfo(pair.candidate)
    if (!ri || !ci) return blocked('INVALID_PNG', { viewport: vp })
    const expected = dims[vp]
    if (!expected || ri.width !== expected[0] || ri.height !== expected[1]
      || ci.width !== expected[0] || ci.height !== expected[1]) {
      return blocked('PROFILE_DIMENSION_MISMATCH', { viewport: vp })
    }
    const declared = captures[vp]
    if (sha(pair.reference) !== declared.referenceSha256
      || sha(pair.candidate) !== declared.candidateSha256) {
      return blocked('DIGEST_MISMATCH', { viewport: vp })
    }
  }

  // 3. Authoritative G2 exit code — PASS must be declared by rendered evidence.
  const gates = cert.gateResults || {}
  if (gates.G2_rendered_fidelity !== 'PASS') return blocked('G2_NOT_AUTHORITATIVE')
  for (const vp of REQUIRED_VIEWPORTS) {
    if (captures[vp].verdict !== 'PARITY_PASS') return blocked('G2_NOT_AUTHORITATIVE', { viewport: vp })
  }
  if (cert.renderedEvidence?.verified !== true || cert.renderedEvidence?.source !== 'chromium-playwright') {
    return blocked('G2_NOT_AUTHORITATIVE', { why: 'RENDERED_EVIDENCE_UNVERIFIED' })
  }

  // 4. Coherent gate transition sequence.
  const seq = Array.isArray(cert.gateSequence) ? cert.gateSequence : []
  if (seq.length !== CANONICAL_GATE_SEQUENCE.length
    || seq.some((g, i) => g !== CANONICAL_GATE_SEQUENCE[i])) {
    return blocked('GATE_SEQUENCE_INCOHERENT')
  }

  // 5. Approved bundle seal must be present and bound.
  if (!/^[0-9a-f]{64}$/.test(cert.approvedBundleSha256 || '')) return blocked('BUNDLE_SEAL_MISSING')

  return { status: 'ADMITTED', requiredViewports: REQUIRED_VIEWPORTS.slice(),
    verifiedViewports: REQUIRED_VIEWPORTS.slice(), gateSequence: seq.slice() }
}
