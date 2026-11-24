// Single canonical ACTUAL release decision for all M6 reports.
// Reads the recorded boundary call-chain evidence; never infers product PASS
// from a reference helper, a recorded test flag or a simulated gate result.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import * as F from '../tests/fixtures.mjs'
import * as L from '../tests/acceptance-ledger.mjs'

export const M5_HELPER_BEFORE = '146c8cfd51e8f01679d08784077c0bd7e565747efa508ce392417e94de781f11'
export const M5_HELPER_AFTER = 'b5bb301655b713e484e449cb2e2549794b56a8307d0fec727a1ca96ac26cff80'

export function buildActualReleaseDecision({
  p2ParityReport = null, p4RollbackReport = null, acceptanceProvenance = null, a08Evidence = null,
} = {}) {
  const tracePath = join(F.EVIDENCE_ROOT, 'boundary-call-chain-final.json')
  let trace = null
  let readError = null
  try { trace = JSON.parse(readFileSync(tracePath, 'utf8')) } catch (e) { readError = String(e.message ?? e) }

  const classification = trace?.product_boundary_class ?? 'NOT_VERIFIED'
  const findings = [
    'S01/S02 M5 reference helpers remediated; no verifiable actual /e2e registry writer',
    'No deterministic production registry writer found in inspected source',
  ]
  const blockingLimitations = [
    trace?.limitation ?? 'product boundary trace unavailable',
    trace?.toctou ?? 'TOCTOU_NOT_FULLY_PROVEN',
  ]
  const productBoundary = {
    status: readError ? 'NOT_VERIFIED' : 'FAIL',
    blocker: true,
    classification,
    boundaryEvidence: { S01: { verified: false }, S02: { verified: false } },
    findings,
    blockingLimitations,
    product_writer_validation: trace?.product_writer_validation ?? 'PRODUCT_WRITER_NOT_VERIFIED',
    source: 'evidence/boundary-call-chain-final.json',
    m5_helper_sha256_before: M5_HELPER_BEFORE,
    m5_helper_sha256_after: M5_HELPER_AFTER,
    read_error: readError,
  }
  return L.evaluateM6Gates({
    p1WinnerVerified: false,
    p2ParityReport,
    p3RegistrySafety: { ok: false },
    p4RollbackReport,
    p5OwnerAuth: false,
    productBoundary,
    acceptanceProvenance,
    a08Evidence,
    mode: 'ACTUAL',
  })
}
