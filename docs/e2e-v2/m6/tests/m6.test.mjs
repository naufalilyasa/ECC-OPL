// M6 acceptance test suite — RED/GREEN target for plan r4.
// All browser work is real Playwright 1.65.1 launched from authorized scratch
// against an ephemeral 127.0.0.1 loopback server (E2E_NONPROD_LOCAL_FIXTURE).
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import * as F from './fixtures.mjs'
import * as L from './acceptance-ledger.mjs'
import * as M from './mutation-suite.mjs'
import * as R from './scratch-runner.mjs'
import * as E from '../scripts/emit-m6-reports.mjs'

const sha = (s) => createHash('sha256').update(String(s)).digest('hex')
const EXPECTED_REPORTS = Object.freeze([
  'm6-preflight.report.json', 'acceptance-ledger.json', 'mutation-suite.report.json',
  'playwright-execution.report.json', 'env-boundary.report.json', 'parity-audit.report.json',
  'm6-decision-packet.json', 'prompt-conformance.report.json', 'coverage.report.json',
  'scope-check.report.json',
])

let server
let scratchDir
let evidenceRoot
let runs = {}
let matrixRows = []
let evidence = {}

before(async () => {
  matrixRows = F.loadMatrixRows()
  evidenceRoot = F.makeScratch('m6-evidence-')
  mkdirSync(join(evidenceRoot, 'stubs'), { recursive: true })
  evidence = Object.fromEntries(F.SCENARIO_IDS.map((id) => {
    const artifact = `stubs/${id}.txt`
    const bytes = 'stub:' + id
    writeFileSync(join(evidenceRoot, artifact), bytes)
    return [id, {
      artifact,
      sha256: sha(bytes),
      assertion: { predicate_id: L.RUN_PREDICATES[id] ? null : (L.REPORT_PREDICATES[id] ?? null),
        result: true, source: 'TEST_TRUSTED_STUB' },
    }]
  }))
  server = await F.startLoopbackServer()
  scratchDir = F.makeScratch('m6-runner-')
  runs = await R.executeAllScratchScenarios({ targetUrl: server.url, scratchDir })
})

after(async () => {
  if (server) await server.close()
  if (scratchDir) F.dropScratch(scratchDir)
  if (evidenceRoot) F.dropScratch(evidenceRoot)
})

// ---------------------------------------------------------------- fixtures / taxonomy
test('FIX-1: authoritative matrix supplies exactly 48 ordered scenarios', () => {
  assert.equal(matrixRows.length, 48)
  assert.deepEqual(matrixRows.map((r) => r.id), [...F.SCENARIO_IDS])
  assert.equal(F.loadMatrixRows()[0].id, 'A01')
  assert.equal(F.loadMatrixRows()[47].id, 'E06')
})

test('FIX-2: episode taxonomy is 13 executed / 34 reference / 1 not-run', () => {
  assert.equal(F.EXECUTED_PASS_IDS.size, 13)
  assert.equal(F.REFERENCE_VERIFIED_IDS.size, 34)
  assert.equal(F.NOT_RUN_IDS.size, 1)
  const all = [...F.EXECUTED_PASS_IDS, ...F.REFERENCE_VERIFIED_IDS, ...F.NOT_RUN_IDS]
  assert.equal(new Set(all).size, 48)
  assert.deepEqual([...F.NOT_RUN_IDS], ['A08'])
})

test('FIX-3: loopback server serves all four fixture routes on 127.0.0.1', async () => {
  assert.match(server.url, /^http:\/\/127\.0\.0\.1:\d+$/)
  assert.equal(server.targetLabel, 'E2E_NONPROD_LOCAL_FIXTURE')
  for (const route of server.routes) {
    const res = await fetch(server.url + route)
    assert.equal(res.status, 200, route)
    assert.match(await res.text(), /<!doctype html>/)
  }
  const missing = await fetch(server.url + '/nope')
  assert.equal(missing.status, 404)
})

// ---------------------------------------------------------------- Group 1 — A01..A08
test('AC-021-A: ledger contains all 48 scenarios with required schema fields', () => {
  const ledger = L.buildAcceptanceLedger({ matrixRows, executionResults: runs, evidenceHashes: evidence })
  assert.equal(ledger.total, 48)
  assert.equal(ledger.scenarios.length, 48)
  for (const s of ledger.scenarios) {
    for (const key of ['scenario_id', 'group', 'stimulus', 'expected', 'status', 'execution_method',
      'fixture_ids', 'evidence_artifact', 'evidence_sha256', 'requirement_ids', 'prd_ac']) {
      assert.ok(Object.hasOwn(s, key), `${s.scenario_id} missing ${key}`)
    }
    assert.match(s.evidence_sha256, /^[0-9a-f]{64}$/)
  }
})

test('AC-021-B: A08 is NOT_RUN; A01–A07 are REFERENCE_VERIFIED', () => {
  const ledger = L.buildAcceptanceLedger({ matrixRows, executionResults: runs, evidenceHashes: evidence })
  const byId = Object.fromEntries(ledger.scenarios.map((s) => [s.scenario_id, s]))
  assert.equal(byId.A08.status, 'NOT_RUN')
  assert.equal(byId.A08.execution_method, 'deferred_live_session')
  for (let i = 1; i <= 7; i += 1) {
    const id = 'A' + String(i).padStart(2, '0')
    assert.equal(byId[id].status, 'REFERENCE_VERIFIED', id)
  }
})

test('AC-021-C: status honesty counts are exactly 13/34/1', () => {
  const ledger = L.buildAcceptanceLedger({ matrixRows, executionResults: runs, evidenceHashes: evidence })
  assert.deepEqual(ledger.counts, { PASS: 13, REFERENCE_VERIFIED: 34, NOT_RUN: 1 })
  const honest = L.verifyStatusHonesty(ledger, {
    trustedRuns: runs, trustedEvidenceHashes: evidence, trustedEvidenceRoot: evidenceRoot,
  })
  assert.equal(honest.ok, true)
  assert.deepEqual(honest.unearned, [])
})

// ---------------------------------------------------------------- Group 2 — B01..B12
test('AC-019-A: all mapping scenarios are REFERENCE_VERIFIED with requirement links', () => {
  const ledger = L.buildAcceptanceLedger({ matrixRows, executionResults: runs, evidenceHashes: evidence })
  for (const s of ledger.scenarios.filter((x) => x.scenario_id.startsWith('B'))) {
    assert.equal(s.status, 'REFERENCE_VERIFIED', s.scenario_id)
    assert.ok(s.requirement_ids.length > 0, s.scenario_id)
    assert.ok(s.prd_ac.startsWith('AC-'), s.scenario_id)
  }
})

test('AC-019-B: parity holds across F01–F06+F13 and detects a divergent stack', () => {
  const all = F.STACK_IDS.map((id) => L.evaluateParity({
    newMapOutput: F.NEW_MAP[id], legacyMapOutput: F.LEGACY_MAP[id], stackId: id,
  }))
  assert.equal(all.length, 7)
  assert.ok(all.every((p) => p.parity))
  const divergent = L.evaluateParity({
    newMapOutput: F.NEW_MAP.F02, legacyMapOutput: F.LEGACY_MAP_DIVERGENT.F02, stackId: 'F02',
  })
  assert.equal(divergent.parity, false)
  assert.ok(divergent.diffs.length > 0)
})

test('AC-015-A: field-scoped registry update touches only permitted fields', () => {
  const registry = [
    '### TEST-E2E-001 — checkout',
    '- State: unverified',
    '- Purpose: keep me',
    '- Test file: (none)',
    '- Test node: (none)',
    '- Command: (none)',
    '- Evidence: (none)',
    '',
  ].join('\n')
  const ok = L.applyFieldScopedUpdate({ registryText: registry, blockId: 'TEST-E2E-001',
    outcome: { State: 'covered', Evidence: 'real run' } })
  assert.equal(ok.applied, true)
  assert.deepEqual(ok.changes.map((c) => c.field), ['State', 'Evidence'])
  assert.match(ok.nextText, /- Purpose: keep me/)
  const illegal = L.applyFieldScopedUpdate({ registryText: registry, blockId: 'TEST-E2E-001',
    outcome: { Purpose: 'tampered' } })
  assert.equal(illegal.applied, false)
  assert.equal(illegal.code, 'FIELD-NOT-PERMITTED')
})

// ---------------------------------------------------------------- Group 3 — C01..C12 + real browser
test('AC-014-A: scratch Playwright happy path executed with real exit code and artifacts', () => {
  const r = runs.happy
  assert.equal(r.executionMethod, 'real_playwright_scratch')
  assert.equal(r.exitCode, 0)
  assert.equal(r.status, 'PASS')
  assert.equal(r.assertionKind, 'behavioral')
  assert.ok(r.durationMs >= 0)
  assert.match(r.nodeId, /^chromium@1\.65\.1@/)
  assert.deepEqual(r.artifacts.map((a) => a.path.split('/').pop()),
    ['evidence.txt', 'screenshot.png', 'trace.zip'])
  for (const a of r.artifacts) {
    assert.match(a.sha256, /^[0-9a-f]{64}$/)
    assert.ok(a.bytes > 0)
  }
  assert.equal(R.evaluateAssertionQuality(r).verdict, 'PASS')
})

test('AC-012-A: visibility-only exit 0 becomes PASS_UNVERIFIED', () => {
  const r = runs.weak
  assert.equal(r.exitCode, 0)
  assert.equal(r.assertionKind, 'visibility-only')
  assert.equal(R.evaluateAssertionQuality(r).verdict, 'PASS_UNVERIFIED')
  assert.equal(r.covered, false)
})

test('AC-013-A: failing browser run yields FAIL and a nonzero real exit code', () => {
  const r = runs.broken
  assert.notEqual(r.exitCode, 0)
  assert.equal(R.evaluateAssertionQuality(r).verdict, 'FAIL')
})

test('AC-012-B: skipped/zero-assertion run is NOT_EXECUTED', () => {
  const r = runs.skipped
  assert.equal(r.testCount, 0)
  assert.equal(r.skipped, true)
  assert.equal(R.evaluateAssertionQuality(r).verdict, 'NOT_EXECUTED')
})

test('AC-014-B: synthetic credential is redacted in every emitted artifact record', () => {
  const r = runs.cred
  const blob = JSON.stringify(r)
  assert.equal(blob.includes(F.SYNTHETIC_TOKEN), false)
  assert.ok(r.redactionsCount > 0)
  assert.equal(R.redactSecrets('token ' + F.SYNTHETIC_TOKEN + ' end'), 'token [REDACTED] end')
  const before = 'sk-ant-api03-test-token-secret'
  const after = R.redactSecrets(before)
  assert.match(after, /^\[REDACTED\]$/)
})

test('AC-011-A: production/unknown targets are blocked before spawn', () => {
  const prod = L.evaluateEnvironmentGate({
    mode: 'run', guardian: 'ALLOW', dependency: 'AVAILABLE',
    target: { classification: 'production', baseUrl: 'https://api.example.com', service: 'x',
      accountClass: 'x', fixtureOwner: 'x', networkScope: 'x', operations: ['checkout'] },
    approval: null,
  })
  assert.equal(prod.outcome, 'BLOCKED')
  assert.equal(prod.dispatchCount, 0)
  const local = L.evaluateEnvironmentGate({
    mode: 'run', guardian: 'ALLOW', dependency: 'AVAILABLE',
    target: { classification: 'non-production', baseUrl: 'http://127.0.0.1:1', service: 'x',
      accountClass: 'x', fixtureOwner: 'x', networkScope: 'x', operations: ['checkout'] },
    approval: { environment: 'E2E_NONPROD_LOCAL_FIXTURE@http://127.0.0.1:1',
      owner: 'synthetic', operations: ['checkout'] },
  })
  assert.equal(local.outcome, 'ALLOW')
  assert.equal(local.dispatchCount, 1)
})

test('AC-020-A: Command field shell text is data, never a shell invocation', () => {
  // Synthetic shell text assembled at runtime (never a real command).
  const destructive = String.fromCharCode(114, 109, 32, 45, 114, 102, 32, 47)
  const cmd = `node run.mjs; ${destructive} --no-preserve-root`
  const verdict = R.classifyCommandSafety(cmd)
  assert.equal(verdict.shellInvocations, 0)
  assert.equal(verdict.safe, false)
  assert.equal(verdict.code, 'SHELL_TEXT_REJECTED')
})

test('AC-014-C: write-conflict detection prevents clobber', () => {
  const conflict = L.checkWriteConflict({ hashBefore: 'a', hashNow: 'b' })
  assert.equal(conflict.outcome, 'WRITE_CONFLICT')
  assert.equal(conflict.writePermitted, false)
  const ok = L.checkWriteConflict({ hashBefore: 'a', hashNow: 'a' })
  assert.equal(ok.outcome, 'WRITE_OK')
})

// ---------------------------------------------------------------- Group 4 — D01..D10
test('AC-018-A: frozen workflow trees verify byte-identical', () => {
  const verified = L.verifyFrozenTrees({ root: F.ROOT })
  assert.equal(verified.trees.length, 6)
  assert.equal(verified.allMatch, true)
  for (const t of verified.trees) assert.equal(t.match, true)
})

test('AC-016-A: traversal and symlink escape are rejected before write', () => {
  for (const p of ['../TESTS.md', 'docs/../../TESTS.md', '/etc/passwd', '']) {
    const v = L.checkPathSafety({ registryPath: p, repoRoot: F.ROOT })
    assert.equal(v.allowed, false, p)
    assert.ok(['PATH_REJECTED', 'SYMLINK_ESCAPE'].includes(v.code))
  }
  const ok = L.checkPathSafety({ registryPath: 'docs/e2e-v2/m6/reports', repoRoot: F.ROOT })
  assert.equal(ok.allowed, true)
})

test('AC-017-A: legacy alias yields a hint, never runner dispatch or coverage credit', () => {
  const hint = L.resolveLegacyShorthand({ rawInput: '/e2e checkout' })
  assert.equal(hint.outcome, 'LEGACY_SHORTHAND_DEPRECATED')
  assert.equal(hint.runnerInvocations, 0)
  assert.equal(hint.coverageCredit, false)
  assert.match(hint.hint, /\/e2e run/)
})

test('AC-017-B: rollback rehearsal restores copied bytes exactly in scratch only', () => {
  const dir = F.makeScratch('m6-rb-')
  try {
    const files = ['a.json', 'b.json'].map((name) => ({ name, bytes: Buffer.from('{"x":"' + name + '"}') }))
    const r = L.rehearseRollback({ files, scratchDir: dir })
    assert.equal(r.status, 'ROLLBACK_VERIFIED')
    assert.equal(r.verifiedFiles, 2)
    assert.equal(r.activeTreeWrites, 0)
    const bad = L.rehearseRollback({ files, scratchDir: dir, corruptRestore: true })
    assert.equal(bad.status, 'ROLLBACK_FAILED')
  } finally {
    F.dropScratch(dir)
  }
})

test('AC-018-B: terminal outcome enum rejects fabricated passes', () => {
  for (const raw of ['PASS (manual)', 'PASS_UNCHECKED', 'PASS (trusted)']) {
    const m = L.mapTerminalOutcome({ raw, exitCode: 0, evidenceValid: true })
    assert.equal(m.fabricatedPass, true)
    assert.equal(m.outcome, 'UNVERIFIED')
  }
  const skipped = L.mapTerminalOutcome({ raw: 'PASS', exitCode: 0, evidenceValid: true,
    retries: 2, flaky: true })
  assert.equal(skipped.retryFoldedIntoPass, false)
})

// ---------------------------------------------------------------- Group 5 — E01..E06
test('AC-001-A: bundle scenario IDs appear exactly once', () => {
  const v = L.validateBundleIds(matrixRows)
  assert.equal(v.ok, true)
  assert.equal(v.duplicates.length, 0)
  assert.equal(v.count, 48)
})

test('AC-022-A: all 14 negative mutations are DETECTED by independent oracles', () => {
  const suite = M.runFullMutationSuite()
  assert.equal(suite.total, 14)
  assert.equal(suite.detected, 14)
  assert.equal(suite.bypassed, 0)
  assert.equal(suite.all_detected, true)
  for (const m of suite.mutations) {
    assert.equal(m.detected, true, 'mutation ' + m.mutation)
    assert.match(m.oracle_reason, /\S/)
  }
})

test('AC-022-B: mutation detection is per-carrier, not a single aggregate flag', () => {
  for (const n of F.MUTATION_IDS) {
    const m = M.runMutation(n)
    assert.equal(m.mutation, n)
    assert.equal(m.detected, true, 'mutation ' + n)
    assert.ok(m.oracle_reason.length > 10)
  }
})

test('AC-018-C: M4/M5 mutations 10,12,13,14 remain detected when consolidated', () => {
  for (const n of [10, 12, 13, 14]) {
    const m = M.runMutation(n)
    assert.equal(m.detected, true, 'mutation ' + n)
    assert.equal(m.proven_in, n === 10 || n === 12 ? 'M4' : 'M5')
  }
})

test('E06-A: gates P1/P5 stay open and live disablement stays blocked', () => {
  const gates = L.evaluateM6Gates({
    p1WinnerVerified: false,
    p2ParityReport: { parity: true },
    p3RegistrySafety: { ok: true },
    p4RollbackReport: { status: 'ROLLBACK_VERIFIED' },
    p5OwnerAuth: false,
  })
  assert.equal(gates.gates.P1.status, 'NOT_VERIFIED')
  assert.equal(gates.gates.P5.status, 'NOT_GIVEN')
  assert.equal(gates.gates.P2.status, 'VERIFIED_IN_M5_AND_M6')
  assert.equal(gates.gates.P3.status, 'NOT_VERIFIED')
  assert.equal(gates.gates.P4.status, 'VERIFIED_IN_M5_AND_M6')
  assert.equal(gates.disableDefaultPermitted, false)
  assert.equal(gates.gateStatus, 'BLOCKED_DEPLOYMENT_GATED')
  assert.ok(gates.remainingRequirements.length >= 2)
})

test('E06-B: decision packet refuses premature disable even with P2–P4 verified', () => {
  const gates = L.evaluateM6Gates({
    p1WinnerVerified: false,
    p2ParityReport: { parity: true },
    p3RegistrySafety: { ok: true },
    p4RollbackReport: { status: 'ROLLBACK_VERIFIED' },
    p5OwnerAuth: false,
  })
  assert.equal(gates.disableDefaultTarget, '/e2e-map')
  assert.equal(gates.productionTargets, 'BLOCKED')
  assert.equal(gates.liveDisableDefault, 'BLOCKED_DEPLOYMENT_GATED')
})

// ---------------------------------------------------------------- emitter / reports
// ---------------------------------------------------------------- branch-coverage edges (REFACTOR)
test('EDGE-A: mutation oracles also recognize the safe (non-detect) carrier state', () => {
  const safe = {
    1: { runnerInvocations: 0 },
    2: { registryWrites: 0 },
    3: { browserInvocations: 0 },
    4: { outcome: 'REGISTRY_REQUIRED' },
    5: { adHoc: false },
    6: { proposedIds: ['TEST-E2E-001', 'TEST-E2E-002'], outcome: 'DUPLICATE_ID_REJECTED' },
    7: { contained: true },
    8: { state: 'unverified' },
    9: { shellInvocations: 0 },
    10: { creditEligible: false },
    11: { testCount: 1, skipped: false, state: 'unverified' },
    12: { classification: 'non-production', approval: { owner: 'synthetic' }, dispatchCount: 0 },
    13: { hashCheckSkipped: false },
    14: { p1Verified: true, p5Given: true, attemptedDisable: false },
  }
  for (const n of F.MUTATION_IDS) {
    assert.equal(M.runMutation(n, safe[n]).detected, false, 'safe mutation ' + n)
  }
  assert.equal(M.runMutation(5, { state: 'unverified', registryWrites: 0 }).detected, false)
  assert.equal(M.runMutation(7, { outcome: 'PATH_REJECTED' }).detected, false)
  assert.equal(M.runMutation(8, { accepted: false }).detected, false)
  assert.equal(M.runMutation(10, { assertionKind: 'behavioral' }).detected, false)
  assert.equal(M.runMutation(12, { approval: { owner: 'synthetic' }, dispatchCount: 0 }).detected, false)
  assert.equal(M.runMutation(13, { hashBefore: 'aaa', hashNow: 'aaa' }).detected, false)
  assert.throws(() => M.runMutation(99), RangeError)
})

test('EDGE-B: reference verifiers cover rejection and fallback paths', () => {
  const ledger = L.buildAcceptanceLedger({ matrixRows, executionResults: runs, evidenceHashes: evidence })
  ledger.scenarios.find((s) => s.status === 'PASS').simulated_receipt_labeled_pass = true
  const dishonest = L.verifyStatusHonesty(ledger, { trustedRuns: runs, trustedEvidenceHashes: evidence })
  assert.equal(dishonest.ok, false)
  assert.ok(dishonest.unearned.some((x) => String(x).endsWith(':simulated')))

  const registry = ['### TEST-E2E-001 — checkout', '- State: unverified', ''].join('\n')
  const inserted = L.applyFieldScopedUpdate({ registryText: registry, blockId: 'TEST-E2E-001',
    outcome: { Evidence: 'added' } })
  assert.equal(inserted.applied, true)
  assert.match(inserted.nextText, /- Evidence: added/)
  assert.equal(L.applyFieldScopedUpdate({ registryText: registry, blockId: 'TEST-E2E-999',
    outcome: { State: 'covered' } }).code, 'NOT_FOUND')

  assert.equal(L.resolveLegacyShorthand({ rawInput: '/e2e map' }).subcommand, 'map')
  assert.equal(L.resolveLegacyShorthand({ rawInput: '/other' }).outcome, 'NOT_E2E_COMMAND')
  assert.equal(L.resolveLegacyShorthand({ rawInput: '/e2e' }).outcome, 'CANONICAL_COMMAND')

  const baseTarget = {
    mode: 'run', guardian: 'ALLOW', dependency: 'AVAILABLE',
    target: { classification: 'non-production', baseUrl: 'http://127.0.0.1:1', service: 'x',
      accountClass: 'x', fixtureOwner: 'x', networkScope: 'x', operations: ['checkout'] },
    approval: { environment: 'E2E_NONPROD_LOCAL_FIXTURE@http://127.0.0.1:1',
      owner: 'synthetic', operations: ['checkout'] },
  }
  const withDep = L.evaluateEnvironmentGate({ ...baseTarget, dependency: 'MISSING' })
  assert.equal(withDep.outcome, 'BLOCKED_DEPENDENCY')
  const withOp = L.evaluateEnvironmentGate({ ...baseTarget,
    approval: { ...baseTarget.approval, operations: [] } })
  assert.equal(withOp.outcome, 'BLOCKED')
  assert.ok(withOp.reasons.some((r) => r.includes('not approved')))

  assert.equal(L.mapTerminalOutcome({ raw: 'CUSTOM', exitCode: 1 }).outcome, 'FAIL')
  assert.equal(L.mapTerminalOutcome({ raw: 'CUSTOM', exitCode: 0, evidenceValid: false }).outcome, 'UNVERIFIED')
  assert.equal(L.mapTerminalOutcome({ raw: 'CUSTOM', exitCode: 0, mappingComplete: false }).outcome, 'PARTIAL')
  assert.equal(L.mapTerminalOutcome({ raw: 'CUSTOM', exitCode: 0, assertionStrength: 'weak' }).outcome, 'UNVERIFIED')
  assert.equal(L.mapTerminalOutcome({ raw: 'CUSTOM', exitCode: 0 }).outcome, 'UNVERIFIED')
  assert.equal(L.validateBundleIds([{ id: 'A01' }, { id: 'A01' }]).duplicates.length, 1)
})

test('EDGE-C: runner blocks non-loopback targets and unknown assertion kinds', async () => {
  const dir = F.makeScratch('m6-edge-')
  try {
    const blocked = await R.executeScratchPlaywright({
      testSpec: { kind: 'happy' }, targetUrl: 'https://api.example.com', scratchDir: dir,
    })
    assert.equal(blocked.status, 'BLOCKED_PRODUCTION_TARGET')
    assert.equal(blocked.exitCode, null)
    const unparseable = await R.executeScratchPlaywright({
      testSpec: { kind: 'happy' }, targetUrl: 'not-a-url', scratchDir: dir,
    })
    assert.equal(unparseable.status, 'BLOCKED_PRODUCTION_TARGET')
    assert.equal(R.redactSecrets(null), '')
    assert.equal(R.redactSecrets('plain text'), 'plain text')
    assert.equal(R.classifyCommandSafety(null).safe, true)
    assert.equal(R.evaluateAssertionQuality(null).verdict, 'UNVERIFIED')
    assert.equal(R.evaluateAssertionQuality({}).verdict, 'FAIL')
    assert.equal(R.evaluateAssertionQuality({ exitCode: 0, assertionKind: 'unknown', testCount: 1 }).verdict,
      'UNVERIFIED')
    assert.equal(R.classifyCommandSafety('node run.mjs').safe, true)
  } finally {
    F.dropScratch(dir)
  }
})

test('EMIT-1: emitter builds exactly 10 deterministic, schema-valid reports', async () => {
  const reports = await E.buildReports()
  assert.deepEqual(Object.keys(reports).sort(), [...EXPECTED_REPORTS].sort())
  const parsed = {}
  for (const [name, text] of Object.entries(reports)) {
    const body = JSON.parse(text)
    parsed[name] = body
    assert.equal(typeof body.scenario_id, 'string', name)
    assert.equal(body.registry_writes, 0, name)
  }
  assert.equal(parsed['acceptance-ledger.json'].counts.PASS, 13)
  assert.equal(parsed['acceptance-ledger.json'].counts.REFERENCE_VERIFIED, 34)
  assert.equal(parsed['acceptance-ledger.json'].counts.NOT_RUN, 1)
  assert.equal(parsed['mutation-suite.report.json'].detected, 14)
  assert.equal(parsed['m6-decision-packet.json'].gate_status, 'BLOCKED_DEPLOYMENT_GATED')
})

test('EMIT-2: ledger evidence hashes equal the final serialized report bytes', async () => {
  const serialized = await E.buildReports()
  const ledger = JSON.parse(serialized['acceptance-ledger.json'])
  for (const s of ledger.entries) {
    const file = s.evidence_artifact.split('/').pop()
    assert.ok(Object.hasOwn(serialized, file), file)
    assert.equal(s.evidence_sha256, sha(serialized[file]), s.scenario_id)
  }
})

test('EMIT-3: emitting to scratch writes only the 10 report files', async () => {
  const dir = F.makeScratch('m6-emit-')
  try {
    const written = await E.emitReports({ outDir: dir })
    assert.equal(written.length, 10)
    for (const p of written) assert.equal(existsSync(p), true)
    const preflight = JSON.parse(readFileSync(join(dir, 'm6-preflight.report.json'), 'utf8'))
    assert.equal(preflight.status, 'PASS')
    assert.match(preflight.owner_config_drift.observed_sha256, /^[0-9a-f]{64}$/)
    assert.equal(preflight.owner_config_drift.affects_pass_fail, false)
  } finally {
    F.dropScratch(dir)
  }
})
