// M6-R1 correctness checks — RED first. These assert evidence-derived verdicts,
// canonical registry State, and realpath-ancestor containment.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import * as L from './acceptance-ledger.mjs'
import * as F from './fixtures.mjs'
import { runMutation8 } from './mutation-suite.mjs'

const matrixRows = F.loadMatrixRows()
const validSha = createHash('sha256').update('evidence').digest('hex')
const evidence = Object.fromEntries(F.SCENARIO_IDS.map((id) => [id, {
  artifact: 'docs/e2e-v2/m6/reports/playwright-execution.report.json', sha256: validSha,
}]))

const baseRuns = () => ({
  C04: { kind: 'happy', exitCode: 0, status: 'PASS', assertionKind: 'behavioral', testCount: 1, skipped: false, covered: false },
  C05: { kind: 'weak', exitCode: 0, status: 'PASS', assertionKind: 'visibility-only', testCount: 1, skipped: false, covered: false },
  C06: { kind: 'broken', exitCode: 1, status: 'FAIL', assertionKind: 'behavioral', testCount: 1, skipped: false, covered: false },
  C07: { kind: 'skipped', exitCode: 0, status: 'PASS', assertionKind: 'none', testCount: 0, skipped: true, covered: false },
  C10: { kind: 'cred', exitCode: 0, status: 'PASS', assertionKind: 'behavioral', testCount: 1, skipped: false, covered: false, redactionsCount: 1 },
})
const statusOf = (runs) => Object.fromEntries(L.buildAcceptanceLedger({ matrixRows, executionResults: runs, evidenceHashes: evidence })
  .scenarios.map((s) => [s.scenario_id, s.status]))

test('L03: happy run with exit 1 must not make C04 PASS', () => {
  const runs = baseRuns(); runs.C04 = { ...runs.C04, exitCode: 1, status: 'FAIL' }
  assert.notEqual(statusOf(runs).C04, 'PASS')
})
test('L04: weak run receiving coverage must not make C05 PASS', () => {
  const runs = baseRuns(); runs.C05 = { ...runs.C05, covered: true }
  assert.notEqual(statusOf(runs).C05, 'PASS')
})
test('L05: broken run unexpectedly succeeding must not make C06 PASS', () => {
  const runs = baseRuns(); runs.C06 = { ...runs.C06, exitCode: 0, status: 'PASS', observedEvidence: 'unexpected-success' }
  assert.notEqual(statusOf(runs).C06, 'PASS')
})
test('L06: skipped run receiving coverage must not make C07 PASS', () => {
  const runs = baseRuns(); runs.C07 = { ...runs.C07, covered: true }
  assert.notEqual(statusOf(runs).C07, 'PASS')
})
test('L07: credential run without redaction proof must not make C10 PASS', () => {
  const runs = baseRuns(); runs.C10 = { ...runs.C10, redactionsCount: 0 }
  assert.notEqual(statusOf(runs).C10, 'PASS')
})
test('L08: forged PASS without predicate result fails honesty', () => {
  const ledger = L.buildAcceptanceLedger({ matrixRows, executionResults: baseRuns(), evidenceHashes: evidence })
  const forged = { ...ledger, scenarios: ledger.scenarios.map((s) => s.scenario_id === 'C04' ? { ...s, status: 'PASS', scenario_assertion_result: 'MISMATCH' } : s) }
  assert.equal(L.verifyStatusHonesty(forged, { trustedRuns: baseRuns(), trustedEvidenceHashes: evidence }).ok, false)
})
test('S03: State stale is rejected without modifying registry bytes or hashes', () => {
  const registryText = '### TEST-E2E-001 x\n- State: missing\n- Command: /e2e run x\n'
  const r = L.applyFieldScopedUpdate({ registryText, blockId: 'TEST-E2E-001', outcome: { State: 'stale' } })
  assert.equal(r.applied, false)
  assert.equal(r.code, 'INVALID_REGISTRY_STATE')
  assert.equal(r.nextText, registryText)
  assert.equal(r.hashAfter, r.hashBefore)
  assert.equal(r.registry_writes, 0)
})
test('S04: mutation 8 uses canonical State enum (neither blocked nor missing is a defect)', () => {
  assert.equal(runMutation8({ state: 'blocked', accepted: true }).detected, true) // invalid accepted => detect
  assert.equal(runMutation8({ state: 'missing', accepted: true }).detected, false) // valid accepted => no defect
  assert.equal(runMutation8({ state: 'stale', accepted: true }).detected, true)
})

const scratch = mkdtempSync(join(tmpdir(), 'm6r1-red-'))
after(() => { try { rmSync(scratch, { recursive: true, force: true }) } catch {} })
test('P02: symlink ancestor with nonexistent destination is rejected', () => {
  const root = join(scratch, 'repo'); mkdirSync(root, { mode: 0o700, recursive: true })
  const outside = join(scratch, 'outside'); mkdirSync(outside, { mode: 0o700, recursive: true })
  writeFileSync(join(outside, 'sentinel.txt'), 'owner')
  symlinkSync(outside, join(root, 'link'))
  const result = L.checkPathSafety({ registryPath: 'link/new-TESTS.md', repoRoot: root })
  assert.equal(result.allowed, false)
  assert.match(result.code, /SYMLINK_ESCAPE|PATH_REJECTED/)
  assert.equal(readSentinel(), 'owner')
})
function readSentinel() { const { readFileSync } = requireFs(); return readFileSync(join(scratch, 'outside/sentinel.txt'), 'utf8') }
function requireFs() { return { readFileSync: fsReadSync } }
import { readFileSync as fsReadSync } from 'node:fs'
