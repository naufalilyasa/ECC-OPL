// M6-R1.1 RED tests — written against unmodified R1 source.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import * as L from './acceptance-ledger.mjs'
import * as F from './fixtures.mjs'

const sha = (s) => createHash('sha256').update(String(s)).digest('hex')
const rows = F.loadMatrixRows()
const runs = () => ({
  C04: { kind: 'happy', exitCode: 0, status: 'PASS', assertionKind: 'behavioral', testCount: 1, skipped: false, covered: false },
  C05: { kind: 'weak', exitCode: 0, status: 'PASS', assertionKind: 'visibility-only', testCount: 1, skipped: false, covered: false },
  C06: { kind: 'broken', exitCode: 1, status: 'FAIL', assertionKind: 'behavioral', testCount: 1, skipped: false, covered: false },
  C07: { kind: 'skipped', exitCode: 0, status: 'PASS', assertionKind: 'none', testCount: 0, skipped: true, covered: false },
  C10: { kind: 'cred', exitCode: 0, status: 'PASS', assertionKind: 'behavioral', testCount: 1, skipped: false, covered: false, redactionsCount: 1 },
})
const ev = Object.fromEntries(F.SCENARIO_IDS.map((id) => [id, { artifact: 'docs/e2e-v2/m6/reports/playwright-execution.report.json', sha256: sha('evidence') }]))
const ledger = (r = runs()) => L.buildAcceptanceLedger({ matrixRows: rows, executionResults: r, evidenceHashes: ev, expectedEvidenceHashes: ev })

// B: forged MATCH must be rejected by independent recomputation
test('B01: forged C04 MATCH with FAIL observed run is rejected', () => {
  const l = ledger(); const c04 = l.scenarios.find((s) => s.scenario_id === 'C04')
  c04.observed_run.exit_code = 1; c04.observed_run.status = 'FAIL'; c04.scenario_assertion_result = 'MATCH'; c04.status = 'PASS'
  assert.equal(L.verifyStatusHonesty(l).ok, false)
})
test('B02: forged C05 MATCH with covered=true is rejected', () => {
  const l = ledger(); const s = l.scenarios.find((x) => x.scenario_id === 'C05')
  s.coverage_credit = true; s.scenario_assertion_result = 'MATCH'; s.status = 'PASS'
  assert.equal(L.verifyStatusHonesty(l).ok, false)
})
test('B03: forged C06 MATCH when broken run unexpectedly passes is rejected', () => {
  const l = ledger(); const s = l.scenarios.find((x) => x.scenario_id === 'C06')
  s.observed_run.exit_code = 0; s.observed_run.status = 'PASS'; s.scenario_assertion_result = 'MATCH'; s.status = 'PASS'
  assert.equal(L.verifyStatusHonesty(l).ok, false)
})
test('B04: forged C07 MATCH with zero/skipped coverage is rejected', () => {
  const l = ledger(); const s = l.scenarios.find((x) => x.scenario_id === 'C07')
  s.coverage_credit = true; s.scenario_assertion_result = 'MATCH'; s.status = 'PASS'
  assert.equal(L.verifyStatusHonesty(l).ok, false)
})
test('B05: forged C10 MATCH without redaction proof is rejected', () => {
  const l = ledger(); const s = l.scenarios.find((x) => x.scenario_id === 'C10')
  s.observed_run.redactions_count = 0; s.scenario_assertion_result = 'MATCH'; s.status = 'PASS'
  assert.equal(L.verifyStatusHonesty(l).ok, false)
})

// E: product boundary hard veto even when other gates green
test('E01: product boundary FAIL blocks all green gates', () => {
  const g = L.evaluateM6Gates({ p1WinnerVerified: true, p2ParityReport: { parity: true },
    p3RegistrySafety: { ok: true }, p4RollbackReport: { status: 'ROLLBACK_VERIFIED' }, p5OwnerAuth: true,
    productBoundary: { status: 'FAIL', blocker: true } })
  assert.equal(g.disableDefaultPermitted, false)
  assert.notEqual(g.gates.P3.status, 'VERIFIED')
})
test('E02: missing product boundary fails closed', () => {
  const g = L.evaluateM6Gates({ p1WinnerVerified: true, p2ParityReport: { parity: true },
    p3RegistrySafety: { ok: true }, p4RollbackReport: { status: 'ROLLBACK_VERIFIED' }, p5OwnerAuth: true })
  assert.equal(g.disableDefaultPermitted, false)
  assert.equal(g.gates.P3.status, 'NOT_VERIFIED')
})
