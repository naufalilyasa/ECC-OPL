// G2 acceptance authority: only valid browser-rendered PAIRS per profile may
// grant PARITY_PASS. Source hints stay triage-only. Verdict is recomputed from
// CURRENT, INDEPENDENT evidence for every required capture profile.
import { createHash } from 'node:crypto'
const HEX64 = /^[0-9a-f]{64}$/
const sha = (b) => createHash('sha256').update(Buffer.isBuffer(b) ? b : Buffer.from(b)).digest('hex')
export const PREVIEW_MODES = Object.freeze(['standalone-html', 'framework-native'])
export const SOURCE_HINT_ONLY = Object.freeze({ classification: 'SOURCE_LEVEL_HINT', rendered: false })


// Minimal real PNG validation from bytes (no new dependency): magic + IHDR dims + IDAT + IEND.
// Minimum plausible PNG is 57 bytes (8-byte header + 25-byte IHDR + 12-byte IDAT + 12-byte IEND).
export function pngInfo(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 57) return null
  const magic = [137, 80, 78, 71, 13, 10, 26, 10]
  for (let i = 0; i < magic.length; i++) if (bytes[i] !== magic[i]) return null
  if (bytes.toString('ascii', 12, 16) !== 'IHDR') return null
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  if (bytes.indexOf(Buffer.from('IDAT')) === -1) return null
  if (bytes.toString('ascii', bytes.length - 8, bytes.length - 4) !== 'IEND') return null
  return { width, height, bytes: bytes.length }
}
const validRow = (r) => {
  if (!r || typeof r !== 'object') return false
  if (!['profile', 'state', 'landmark', 'property', 'expected', 'actual', 'verdict'].every((k) => k in r)) return false
  if (r.expected === undefined || r.expected === null || r.actual === undefined || r.actual === null) return false
  if (typeof r.expected === 'number' && !Number.isFinite(r.expected)) return false
  if (typeof r.actual === 'number' && !Number.isFinite(r.actual)) return false
  if (!['PASS', 'FAIL'].includes(r.verdict)) return false
  return true
}

export function verifyRenderedParity(result, context = {}) {
  const mode = context.previewMode ?? 'standalone-html'
  if (!PREVIEW_MODES.includes(mode)) {
    return { code: 'PARITY_UNVERIFIED', why: 'PREVIEW_MODE_INVALID', mode }
  }
  if (!result || result.source !== 'chromium-playwright') {
    return { code: 'PARITY_UNVERIFIED', why: 'NOT_RENDERED_EVIDENCE', mode }
  }
  // Native: the same component is approved and shipped, so the comparison is
  // baseline capture vs integrated capture of THAT revision. The baseline must
  // be attributable to the approval, otherwise any old screenshot would do.
  if (mode === 'framework-native') {
    const approved = context.approvedReference?.designDigest
    if (!HEX64.test(approved || '')) {
      return { code: 'PARITY_UNVERIFIED', why: 'APPROVED_REFERENCE_REQUIRED', mode }
    }
    if (result.evidence?.referenceDesignDigest !== approved) {
      return { code: 'PARITY_UNVERIFIED', why: 'BASELINE_NOT_BOUND_TO_APPROVAL', mode,
        approvedDesignDigest: approved, evidenceDesignDigest: result.evidence?.referenceDesignDigest ?? null }
    }
  }
  const required = context.requiredViewports ?? []
  if (!required.length) return { code: 'PARITY_UNVERIFIED', why: 'REQUIRED_VIEWPORTS_MISSING', mode }
  // One shared digest pair is NOT valid for multiple profiles.
  if (required.length > 1 && !result.evidence?.byProfile) {
    return { code: 'PARITY_UNVERIFIED', why: 'SHARED_DIGEST_PAIR_INVALID' }
  }
  const pairs = context.screenshotPairs ?? {}
  const vpm = context.viewportMeasurements ?? {}
  const hashes = result.evidence?.byProfile ?? {}
  const verifiedProfiles = [], diffs = []
  let matched = 0
  for (const vp of required) {
    const pair = pairs[vp]
    // Both actual images are MANDATORY — no `?? screenshot` fallback anywhere.
    if (!pair || !Buffer.isBuffer(pair.reference) || !Buffer.isBuffer(pair.candidate)) {
      return { code: 'PARITY_UNVERIFIED', mode,
        why: mode === 'framework-native' && !Buffer.isBuffer(pair?.reference)
          ? 'BASELINE_CAPTURE_MISSING' : 'SCREENSHOT_PAIR_INCOMPLETE', viewport: vp }
    }
    const ri = pngInfo(pair.reference), ci = pngInfo(pair.candidate)
    if (!ri || !ci) return { code: 'PARITY_UNVERIFIED', why: 'INVALID_PNG', viewport: vp }
    // Dimension expectations are declared by the capture profile, never hardcoded here.
    const dims = context.profileDimensions?.[vp]
    if (dims && (ri.width !== dims[0] || ri.height !== dims[1] || ci.width !== dims[0] || ci.height !== dims[1])) {
      return { code: 'PARITY_UNVERIFIED', why: 'PROFILE_DIMENSION_MISMATCH', viewport: vp,
        expected: dims, reference: [ri.width, ri.height], candidate: [ci.width, ci.height] }
    }
    if (ri.width !== ci.width || ri.height !== ci.height) {
      return { code: 'PARITY_UNVERIFIED', why: 'DIMENSION_MISMATCH', viewport: vp }
    }
    // Independent digest pair per profile.
    const h = hashes[vp]
    if (!h || !HEX64.test(h.approved || '') || !HEX64.test(h.candidate || '')) {
      return { code: 'PARITY_UNVERIFIED', why: 'PROFILE_HASH_MISSING', viewport: vp }
    }
    if (sha(pair.reference) !== h.approved || sha(pair.candidate) !== h.candidate) {
      return { code: 'PARITY_UNVERIFIED', why: 'PROFILE_HASH_MISMATCH', viewport: vp }
    }
    const rows = vpm[vp]
    if (!Array.isArray(rows) || !rows.length) return { code: 'PARITY_UNVERIFIED', why: 'MEASUREMENTS_MISSING', viewport: vp }
    let profilePass = true
    for (const r of rows) {
      if (!validRow(r) || r.profile !== vp) return { code: 'PARITY_UNVERIFIED', why: 'MEASUREMENT_MALFORMED', viewport: vp }
      if (r.verdict === 'FAIL' || r.expected !== r.actual) { profilePass = false; diffs.push({ viewport: vp, ...r }) }
      else matched++
    }
    if (!profilePass) continue
    verifiedProfiles.push(vp)
  }
  return { code: diffs.length ? 'PARITY_FAIL' : 'PARITY_PASS', mode, matched,
    verifiedProfiles, failedProfiles: diffs.map((d) => d.viewport), diffs,
    // Native drift is reported, not failed on pixels: the same component in a
    // different shell legitimately differs. Callers surface these as findings.
    driftFindings: result.driftFindings ?? [],
    requiredViewports: required.slice() }
}

// Source-level checks remain useful for fast static triage but cannot be G2 authority.
export function sourceHint(tsx) {
  const pt = /(?:^|\s)pt-(\d+)/.exec(tsx)
  const badge = /<span[^>]*warehouse-badge[^>]*>/.exec(tsx)?.[0] ?? ''
  return { ...SOURCE_HINT_ONLY, paddingTop: pt ? Number(pt[1]) * 4 : null,
    badgeToken: badge.length > 0 && !/hidden/.test(badge) }
}
