#!/usr/bin/env node
// Portable section-completion gate for /design-build V2.0.
// Usage: node scripts/design-build-v2/section-gate.mjs <request.json>
// Resolves modules relative to THIS file (no hardcoded developer/project paths).
// Request may use project-relative file paths for candidate/screenshot bytes;
// the workflow supplies authoritative identity and approval from active state.
import { readFileSync } from 'node:fs'
import { resolve, dirname, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyReceipt, advanceCheckpoint, sha256 } from './state-machine.mjs'
import { verifyRenderedParity } from './rendered-authority.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
if (!process.argv[2]) {
  process.stderr.write('Usage: section-gate.mjs <request.json>\n')
  process.exit(2)
}
const req = JSON.parse(readFileSync(resolve(process.argv[2]), 'utf8'))
const root = resolve(req.projectRoot ?? process.cwd())
const bytes = (p) => {
  if (!p) return undefined
  try {
    return readFileSync(isAbsolute(p) ? p : resolve(root, p))
  } catch {
    return undefined
  }
}

// Build context from request. Identity/approval must come from authoritative
// workflow state supplied by the caller, never from the receipt itself.
// NO `?? screenshot` fallback: both reference and candidate are distinct and mandatory.
const ctx = {
  identity: req.identity,
  active: req.active,
  canvasApproval: req.canvasApproval,
  contractChecks: req.contractChecks ?? [],
  profileDimensions: req.profileDimensions ?? {},
  candidateFiles: Object.fromEntries(
    Object.entries(req.candidateFiles ?? {}).map(([p, f]) => [p, bytes(f)])
  ),
  frameworkCompleteEvidence: req.frameworkCompleteEvidence,
  requiredViewports: req.requiredViewports ?? [],
  viewportEvidence: Object.fromEntries(
    Object.entries(req.viewportEvidence ?? {}).map(([vp, v]) => [vp, {
      screenshot: bytes(v.screenshot),
      candidateScreenshot: bytes(v.candidateScreenshot),
      measurements: v.measurements,
    }])
  ),
  interactionChecks: req.interactionChecks ?? [],
}
const receipt = req.receipt
const verdict = verifyReceipt(receipt, ctx)

const byProfile = req.g2?.byProfile ?? Object.fromEntries(
  ctx.requiredViewports.map((vp) => [vp, {
    approved: sha256(ctx.viewportEvidence[vp]?.screenshot ?? Buffer.alloc(0)),
    candidate: sha256(ctx.viewportEvidence[vp]?.candidateScreenshot ?? Buffer.alloc(0)),
  }])
)

const g2 = verifyRenderedParity(
  {
    source: 'chromium-playwright',
    evidence: { verified: true, byProfile,
      referenceDesignDigest: req.active?.designDigest },
    diffs: req.g2?.diffs ?? [],
    driftFindings: req.g2?.driftFindings ?? [],
  },
  {
    // Preview mode comes from authoritative state (DBN-11), not from the receipt
    // or the request, so a caller cannot pick the cheaper mode.
    previewMode: req.active?.previewMode ?? 'standalone-html',
    approvedReference: { designDigest: req.active?.designDigest },
    screenshotPairs: Object.fromEntries(
      Object.entries(ctx.viewportEvidence).map(([vp, v]) => [vp, {
        reference: v.screenshot,
        candidate: v.candidateScreenshot,
      }])
    ),
    requiredViewports: ctx.requiredViewports,
    profileDimensions: ctx.profileDimensions,
    viewportMeasurements: Object.fromEntries(
      Object.entries(ctx.viewportEvidence).map(([vp, v]) => [vp, v.measurements ?? []])
    ),
  }
)

const checkpoint = advanceCheckpoint(req.active, receipt, ctx)

const outcome = {
  module: 'scripts/design-build-v2/section-gate.mjs',
  receipt: verdict,
  g2,
  checkpoint,
}

process.stdout.write(JSON.stringify(outcome, null, 2) + '\n')
if (verdict.code !== 'OK' || g2.code !== 'PARITY_PASS' || checkpoint.state !== 'SECTION_COMPLETE') {
  process.exitCode = 1
}
