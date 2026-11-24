// M4 (ECC-OPL /e2e V2.0) — Runner & Evidence Hardening reference harness.
// Zero-dependency `node --test`. Synthetic F10/F12 inputs only: no browser,
// no runner spawn, no network, no install, no registry write, no real consent.
// Live criteria remain DEFERRED_TO_M6. Registry paths must stay absent.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, existsSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import * as R from './runner.mjs'
import * as F from './fixtures.mjs'

const sha = (buf) => createHash('sha256').update(buf).digest('hex')

function disposable(t, label) {
  const base = mkdtempSync(join(tmpdir(), `m4-${label}-`))
  t.after(() => rmSync(base, { recursive: true, force: true }))
  return base
}

function gateRequest(variant = {}) {
  return {
    mode: 'run',
    target: F.TARGET_NONPROD,
    approval: F.APPROVAL_VALID,
    guardian: 'ALLOW',
    dependency: 'AVAILABLE',
    ...variant,
  }
}

function evidenceFixture(t, overrides = {}) {
  const base = disposable(t, 'evidence')
  const specRel = 'tests/e2e/checkout.spec.ts'
  const artifactRel = 'artifacts/checkout.trace.json'
  mkdirSync(join(base, 'tests', 'e2e'), { recursive: true })
  mkdirSync(join(base, 'artifacts'), { recursive: true })
  writeFileSync(join(base, specRel), "test('checkout completes to confirmation', async () => {})\n")
  writeFileSync(join(base, artifactRel), '{"trace":"[REDACTED_TOKEN]"}\n')
  writeFileSync(join(base, '.gitignore'), overrides.gitignore ?? F.GITIGNORE_MATCH)
  const expectedSha = sha(readFileSync(join(base, specRel)))
  const envelope = structuredClone(F.F10_ENVELOPE)
  envelope.spec_sha256 = expectedSha
  const observer = structuredClone(F.F10_OBSERVER)
  observer.spec_sha256 = expectedSha
  const ctx = {
    repoRoot: base,
    specRel,
    expectedSha,
    expectedTestId: F.REGISTERED_ROW.id,
    expectedNode: F.REGISTERED_ROW.node,
    expectedEnv: F.REGISTERED_ROW.environment,
    allowedCommands: [F.REGISTERED_ROW.allowedCommand],
    scopedRoot: join(base, 'artifacts'),
    artifactRootRel: 'artifacts/',
    fixtureGitignore: overrides.gitignore ?? F.GITIGNORE_MATCH,
    redactionSamples: F.REDACTED_SAMPLES,
    priorCounts: F.PRIOR_COUNTS_UNCHANGED,
  }
  return { base, ctx, envelope, observer, specRel, artifactRel }
}

// =====================================================================================
// D02 / AC-011 — pre-dispatch environment gate (F12)
// =====================================================================================
test('D02: approved non-production `run` dispatches exactly once', () => {
  let calls = 0
  const r = R.evaluateEnvironmentGate(gateRequest(), () => { calls += 1 })
  assert.equal(r.outcome, 'ALLOW')
  assert.equal(calls, 1, 'D02: exactly one spy call on the approved fixture')
  assert.equal(r.dispatchCount, 1)
})

test('D02: approved non-production `full` dispatches exactly once', () => {
  let calls = 0
  const r = R.evaluateEnvironmentGate(gateRequest({ mode: 'full' }), () => { calls += 1 })
  assert.equal(r.outcome, 'ALLOW')
  assert.equal(calls, 1)
  assert.equal(r.mode, 'full')
})

test('D02: production and unknown classifications are BLOCKED with zero dispatch', () => {
  for (const variant of [F.GATE_VARIANTS.production, F.GATE_VARIANTS.unknown]) {
    let calls = 0
    const r = R.evaluateEnvironmentGate(gateRequest(variant), () => { calls += 1 })
    assert.equal(r.outcome, 'BLOCKED')
    assert.equal(calls, 0, 'D02: unsafe classification must not reach the spy')
    assert.equal(r.dispatchCount, 0)
  }
})

test('D02: every missing/malformed target field is BLOCKED with zero dispatch', () => {
  for (const variant of [
    F.GATE_VARIANTS.noBaseUrl, F.GATE_VARIANTS.malformedBaseUrl, F.GATE_VARIANTS.noService,
    F.GATE_VARIANTS.noAccountClass, F.GATE_VARIANTS.noFixtureOwner,
    F.GATE_VARIANTS.noNetworkScope, F.GATE_VARIANTS.noOperations,
  ]) {
    let calls = 0
    const r = R.evaluateEnvironmentGate(gateRequest(variant), () => { calls += 1 })
    assert.equal(r.outcome, 'BLOCKED', `D02: variant ${JSON.stringify(variant.target)} blocked`)
    assert.equal(calls, 0)
  }
})

test('D02: missing, mismatched and partial approval are BLOCKED with zero dispatch', () => {
  for (const variant of [F.GATE_VARIANTS.noApproval, F.GATE_VARIANTS.approvalEnvMismatch]) {
    let calls = 0
    const r = R.evaluateEnvironmentGate(gateRequest(variant), () => { calls += 1 })
    assert.equal(r.outcome, 'BLOCKED')
    assert.equal(calls, 0)
  }
  let calls = 0
  const r = R.evaluateEnvironmentGate(gateRequest({
    target: F.HIGH_RISK_TARGET,
    approval: F.APPROVAL_HIGHRISK_PARTIAL,
  }), () => { calls += 1 })
  assert.equal(r.outcome, 'BLOCKED', 'D02: high-risk operations need explicit per-operation approval')
  assert.equal(calls, 0)
})

test('D02: Guardian denial is final and dispatches nothing', () => {
  let calls = 0
  const r = R.evaluateEnvironmentGate(gateRequest(F.GATE_VARIANTS.guardianDeny), () => { calls += 1 })
  assert.equal(r.outcome, 'BLOCKED')
  assert.match(r.reason, /guardian/i)
  assert.equal(calls, 0)
})

test('D02: an unapproved non-high-risk operation is BLOCKED; wildcard covers only non-high-risk ops', () => {
  let calls = 0
  const unapproved = R.evaluateEnvironmentGate(gateRequest({
    approval: { ...F.APPROVAL_VALID, operations: ['other.op'] },
  }), () => { calls += 1 })
  assert.equal(unapproved.outcome, 'BLOCKED')
  assert.equal(calls, 0)

  calls = 0
  const wildcard = R.evaluateEnvironmentGate(gateRequest({
    approval: { ...F.APPROVAL_VALID, operations: ['*'] },
  }), () => { calls += 1 })
  assert.equal(wildcard.outcome, 'ALLOW', 'wildcard is not a blanket approval for high-risk operations')
  assert.equal(calls, 1)

  calls = 0
  const highRiskWildcard = R.evaluateEnvironmentGate(gateRequest({
    target: F.HIGH_RISK_TARGET,
    approval: { ...F.APPROVAL_VALID, operations: ['*'] },
  }), () => { calls += 1 })
  assert.equal(highRiskWildcard.outcome, 'BLOCKED', 'high-risk operations never accept a wildcard')
  assert.equal(calls, 0)
})

test('Mutation 12 carrier: missing dependency short-circuits even the bypass', () => {
  const r = R.gateWithBypass(gateRequest({ dependency: 'MISSING' }))
  assert.equal(r.outcome, 'BLOCKED_DEPENDENCY')
  assert.equal(r.dispatchCount, 0)
  assert.equal(r.bypass, true)
})

// =====================================================================================
// C08 — injected dependency availability, no probe and no install
// =====================================================================================
test('C08: dependency available reaches the spy exactly once', () => {
  let calls = 0
  const r = R.evaluateEnvironmentGate(gateRequest(F.GATE_VARIANTS.approvedRun), () => { calls += 1 })
  assert.equal(r.outcome, 'ALLOW')
  assert.equal(calls, 1)
  assert.equal(r.installAttempts, 0, 'C08: no install path exists')
  assert.equal(r.playwrightProbes, 0, 'C08: no Playwright probe')
})

test('C08: missing/unavailable dependency yields BLOCKED_DEPENDENCY with zero spy calls', () => {
  for (const variant of [F.GATE_VARIANTS.dependencyMissing, F.GATE_VARIANTS.dependencyUnavailable]) {
    let calls = 0
    const r = R.evaluateEnvironmentGate(gateRequest(variant), () => { calls += 1 })
    assert.equal(r.outcome, 'BLOCKED_DEPENDENCY')
    assert.equal(calls, 0)
    assert.equal(r.installAttempts, 0)
    assert.equal(r.playwrightProbes, 0)
  }
})

test('Mutation 12: synthetic D02 bypass is DETECTED by an independent oracle', () => {
  const req = gateRequest(F.GATE_VARIANTS.production)
  const result = R.runMutation12(req)
  assert.equal(result.mutation, 12)
  assert.equal(result.detected, true, 'MUT12: the oracle must detect the observed bypass call')
  assert.equal(result.observedDispatchCount, 1, 'MUT12: the mutated path really invoked the spy')
  assert.equal(result.expectedDispatchCount, 0, 'MUT12: production must never dispatch')
  assert.equal(result.installAttempts, 0)
})

test('Mutation 12: the real gate still blocks the same request the mutant bypassed', () => {
  let calls = 0
  const r = R.evaluateEnvironmentGate(gateRequest(F.GATE_VARIANTS.production), () => { calls += 1 })
  assert.equal(r.outcome, 'BLOCKED')
  assert.equal(calls, 0)
})

// =====================================================================================
// C01 — registered-row handoff bound to immutable pre-tamper snapshot
// =====================================================================================
test('C01: handoff is built from a registered row and dispatches no runner', () => {
  const r = R.buildHandoff(F.REGISTERED_ROW)
  assert.equal(r.caseId, 'C01')
  assert.equal(r.dispatchCount, 0)
  assert.equal(r.handoff.id, F.REGISTERED_ROW.id)
  const v = R.validateHandoff({ handoff: r.handoff, rowSnapshot: r.rowSnapshot, allowlistSnapshot: r.allowlistSnapshot })
  assert.equal(v.bound, true)
  assert.equal(v.fixtureVerdict, 'PASS_VERIFIED')
  assert.equal(v.creditEligible, false, 'C01: fixture verdict never becomes live credit')
})

test('C01: changed observable expectation, spec or ID yields no fixture PASS_VERIFIED', () => {
  const built = R.buildHandoff(F.REGISTERED_ROW)
  for (const field of ['expectation', 'spec', 'id']) {
    const handoff = { ...built.handoff, [field]: `TAMPERED_${field}` }
    const v = R.validateHandoff({ handoff, rowSnapshot: built.rowSnapshot, allowlistSnapshot: built.allowlistSnapshot })
    assert.equal(v.bound, false, `C01: tampered ${field} must not bind`)
    assert.notEqual(v.fixtureVerdict, 'PASS_VERIFIED')
    assert.equal(v.creditEligible, false)
  }
})

test('C01: an echoed observer cannot re-authorize a tampered handoff', () => {
  const built = R.buildHandoff(F.REGISTERED_ROW)
  const handoff = { ...built.handoff, expectation: 'TAMPERED expectation', echoedByObserver: true }
  const v = R.validateHandoff({ handoff, rowSnapshot: built.rowSnapshot, allowlistSnapshot: built.allowlistSnapshot })
  assert.equal(v.bound, false)
  assert.equal(v.creditEligible, false)
})

// =====================================================================================
// C04/C10 — runner evidence contract, identity, CLI and counts
// =====================================================================================
test('C04: valid synthetic F10 record is fixture-valid with live fields NOT_RUN', (t) => {
  const f = evidenceFixture(t)
  const r = R.validateRunnerEvidence({ envelope: f.envelope, observer: f.observer, ctx: f.ctx })
  assert.equal(r.caseId, 'C04')
  assert.equal(r.valid, true, `C04: ${r.reasons.join('; ')}`)
  assert.equal(r.fixtureVerdict, 'PASS_VERIFIED')
  assert.equal(r.liveCoverageCredit, false)
  assert.equal(r.live.playwright_execution, 'NOT_RUN')
  assert.equal(r.live.actual_cli, 'NOT_RUN')
  assert.equal(r.live.browser, 'DEFERRED_TO_M6')
})

test('C04: envelope/observer identity mismatches are rejected', (t) => {
  const f = evidenceFixture(t)
  for (const field of ['test_id', 'test_node', 'target_environment', 'flow', 'exit_code']) {
    const envelope = { ...f.envelope, [field]: `TAMPERED_${field}` }
    const r = R.validateRunnerEvidence({ envelope, observer: f.observer, ctx: f.ctx })
    assert.equal(r.valid, false, `C04: tampered ${field} rejected`)
  }
})

test('C04: slash-command CLI, untrusted Command text and non-allowlisted CLI are rejected', (t) => {
  const f = evidenceFixture(t)
  for (const cmd of ['/e2e run TEST-E2E-001', 'rm -rf build', 'npx playwright test other.spec.ts']) {
    const envelope = { ...f.envelope, command: cmd }
    const observer = { ...f.observer, command: cmd, actual_cli: cmd }
    const r = R.validateRunnerEvidence({ envelope, observer, ctx: f.ctx })
    assert.equal(r.valid, false, `C04: command ${cmd} rejected`)
    assert.equal(r.checks.identity.ok, false)
  }
})

test('C01: a tampered allowlist (non-array or changed command) never binds', () => {
  const built = R.buildHandoff(F.REGISTERED_ROW)
  for (const allowlistSnapshot of [null, ['npx playwright test other.spec.ts']]) {
    const v = R.validateHandoff({
      handoff: built.handoff, rowSnapshot: built.rowSnapshot, allowlistSnapshot,
    })
    assert.equal(v.bound, false)
    assert.notEqual(v.fixtureVerdict, 'PASS_VERIFIED')
  }
})

test('C04: spec SHA mismatch, absolute path, traversal, symlink escape and missing file are rejected', (t) => {
  const f = evidenceFixture(t)
  const cases = [
    { name: 'sha', sha: '0'.repeat(64) },
    { name: 'absolute', spec: '/etc/passwd' },
    { name: 'traversal', spec: '../../etc/passwd' },
    { name: 'missing', spec: 'tests/e2e/missing.spec.ts' },
  ]
  for (const c of cases) {
    const r = R.checkSpec({ specRel: c.spec ?? f.ctx.specRel, expectedSha: c.sha ?? f.ctx.expectedSha, repoRoot: f.ctx.repoRoot })
    assert.equal(r.ok, false, `C04: spec case ${c.name} rejected`)
  }
  // Nested symlink component that resolves OUTSIDE the repo root.
  const outsideDir = mkdtempSync(join(tmpdir(), 'm4-outside-'))
  t.after(() => rmSync(outsideDir, { recursive: true, force: true }))
  const outside = join(outsideDir, 'outside.spec.ts')
  writeFileSync(outside, 'outside\n')
  const linkDir = join(f.base, 'tests', 'e2e', 'escape')
  mkdirSync(linkDir, { recursive: true })
  symlinkSync(outside, join(linkDir, 'checkout.spec.ts'))
  const r = R.checkSpec({ specRel: 'tests/e2e/escape/checkout.spec.ts', expectedSha: sha(readFileSync(outside)), repoRoot: f.base })
  assert.equal(r.ok, false, 'C04: symlink escape at a component rejected')
})

test('C04: malformed exit codes, counts, timestamps and status/exit mismatch are rejected', (t) => {
  const f = evidenceFixture(t)
  const variants = [
    { exit_code: '0' },
    { exit_code: -1 },
    { test_counts: { ...F.F10_COUNTS, passed: -2 } },
    { test_counts: { ...F.F10_COUNTS, total: Number.NaN } },
    { start_time: 'not-a-date' },
    { end_time: '2026-11-23T09:00:00.000Z' },
    { runner_status: 'PASS', exit_code: 1 },
  ]
  for (const v of variants) {
    const envelope = { ...f.envelope, ...v }
    const observer = { ...f.observer, ...(Object.hasOwn(v, 'exit_code') ? { exit_code: v.exit_code } : {}) }
    const r = R.checkCountsAndStatus({ envelope, observer })
    assert.equal(r.ok, false, `C04: ${JSON.stringify(v)} rejected`)
  }
})

test('C07: zero, skipped, fixme and all-filtered cases are NOT_EXECUTED with no credit', (t) => {
  const f = evidenceFixture(t)
  for (const patch of [
    { total: 0, executed: 0 },
    { total: 3, executed: 2, skipped: 1 },
    { total: 3, executed: 2, fixme: 1 },
    { total: 3, executed: 0, filtered: 3 },
  ]) {
    const counts = { ...F.F10_COUNTS, ...patch }
    const envelope = { ...f.envelope, test_counts: counts }
    const observer = { ...f.observer, test_counts: counts }
    const r = R.validateRunnerEvidence({ envelope, observer, ctx: f.ctx })
    assert.equal(r.valid, false)
    assert.equal(r.executionState, 'NOT_EXECUTED')
    assert.equal(r.liveCoverageCredit, false)
  }
})

// =====================================================================================
// C05 / AC-012 — assertion quality and mutation 10
// =====================================================================================
test('C05: weak-only (visibility/no assertions) yields PASS_UNVERIFIED with no credit', () => {
  const weak = [
    { total: 1, kind: 'visibility-only', expected_behavior: 'element visible', observed_result: 'element visible' },
    { total: 1, kind: 'tautological', expected_behavior: 'x equals x', observed_result: 'x equals x' },
    { total: 0, kind: 'behavioral', expected_behavior: 'submit works', observed_result: 'submit works' },
    { total: 2, kind: 'unknown' },
  ]
  for (const assertion_summary of weak) {
    const outcome = R.proposeOutcome({ exit_code: 0, assertion_summary, evidenceValid: true, countRegression: { ok: true } })
    assert.equal(outcome.outcome, 'PASS_UNVERIFIED')
    assert.equal(outcome.creditEligible, false)
  }
})

test('C05: a strong behavioral assertion with valid evidence earns fixture-only PASS_VERIFIED', () => {
  const outcome = R.proposeOutcome({
    exit_code: 0,
    assertion_summary: F.F10_ASSERTIONS,
    evidenceValid: true,
    countRegression: { ok: true },
  })
  assert.equal(outcome.outcome, 'PASS_VERIFIED')
  assert.equal(outcome.creditEligible, false, 'fixture credit only')
  assert.equal(outcome.live_coverage_credit, false)
})

test('Mutation 10: bypass crediting visibility-only assertions is DETECTED', () => {
  const result = R.runMutation10()
  assert.equal(result.mutation, 10)
  assert.equal(result.observedCreditEligible, true, 'MUT10: the bypass really granted credit')
  assert.equal(result.detected, true, 'MUT10: independent oracle must detect the false credit')
  assert.equal(result.expectedCreditEligible, false)
})

// =====================================================================================
// C06 / AC-013 — nonzero exit FAIL and no-write downgrade proposal
// =====================================================================================
test('C06: nonzero exit is FAIL with an unverified proposal, applied=false, zero registry writes', (t) => {
  const base = disposable(t, 'registry')
  const registryPath = join(base, 'TESTS.md')
  const before = '# E2E Test Registry (ECC-OPL)\n\n### TEST-E2E-001\n- State: covered\n'
  writeFileSync(registryPath, before)
  const beforeSha = sha(readFileSync(registryPath))
  const envelope = { ...F.F10_ENVELOPE, exit_code: 1, runner_status: 'FAIL' }
  const r = R.proposeFailDowngrade({
    envelope,
    currentState: 'covered',
    rowId: F.REGISTERED_ROW.id,
    registryText: before,
    evidenceValid: true,
  })
  assert.equal(r.caseId, 'C06')
  assert.equal(r.outcome, 'FAIL')
  assert.equal(r.proposed_state, 'unverified')
  assert.equal(r.applied, false)
  assert.equal(r.registry_writes, 0)
  assert.equal(r.registry_before_sha, beforeSha)
  assert.equal(r.registry_after_sha, beforeSha)
  assert.equal(r.registry_bytes_unchanged, true)
  assert.equal(sha(readFileSync(registryPath)), beforeSha, 'C06: real bytes untouched')
  assert.equal(existsSync(join(base, '.governance', 'docs-map.json')), false)
})

test('C06: a trustworthy FAIL survives even when ancillary evidence is incomplete', () => {
  const r = R.proposeOutcome({ exit_code: 2, assertion_summary: F.F10_ASSERTIONS, evidenceValid: false, countRegression: { ok: false } })
  assert.equal(r.outcome, 'FAIL', 'C06: precedence keeps the nonzero exit visible')
  assert.equal(r.creditEligible, false)
})

// =====================================================================================
// Count regression (DETERMINISTIC-VERIFICATION §4)
// =====================================================================================
test('count regression: independent test-count and assertion-count drops are anomalies', () => {
  const cur = { tests: 3, assertions: 3 }
  for (const [label, prior] of [
    ['tests', F.PRIOR_COUNTS_TEST_DROP],
    ['assertions', F.PRIOR_COUNTS_ASSERTION_DROP],
  ]) {
    const r = R.checkCountRegression({ current: cur, prior })
    assert.equal(r.ok, false, `count regression: ${label} drop detected`)
    assert.equal(r.completeEligible, false)
    assert.ok(r.anomalies.some((a) => a.includes(label)))
  }
})

test('count regression: unchanged and increased counts pass the count gate', () => {
  assert.equal(R.checkCountRegression({ current: { tests: 3, assertions: 3 }, prior: F.PRIOR_COUNTS_UNCHANGED }).ok, true)
  assert.equal(R.checkCountRegression({ current: { tests: 5, assertions: 6 }, prior: F.PRIOR_COUNTS_UNCHANGED }).ok, true)
})

test('count regression: an anomaly prevents COMPLETE and fixture credit end-to-end', (t) => {
  const f = evidenceFixture(t)
  f.ctx.priorCounts = F.PRIOR_COUNTS_TEST_DROP
  const r = R.validateRunnerEvidence({ envelope: f.envelope, observer: f.observer, ctx: f.ctx })
  assert.equal(r.countRegression.ok, false)
  assert.equal(r.completeEligible, false)
  assert.equal(r.fixtureVerdict, 'UNVERIFIED')
  assert.equal(r.liveCoverageCredit, false)
})

// =====================================================================================
// C10 — fixture ignored-root rule, artifact safety and redaction
// =====================================================================================
test('C10: matching literal fixture artifacts/ rule is accepted', () => {
  const r = R.checkFixtureIgnoreRule({ fixtureGitignore: F.GITIGNORE_MATCH, artifactRootRel: 'artifacts/' })
  assert.equal(r.ok, true)
  assert.equal(r.rule, 'artifacts/')
})

test('C10: missing or unrelated fixture ignore rules are rejected before credit', () => {
  for (const fixtureGitignore of [F.GITIGNORE_MISSING, F.GITIGNORE_UNRELATED]) {
    const r = R.checkFixtureIgnoreRule({ fixtureGitignore, artifactRootRel: 'artifacts/' })
    assert.equal(r.ok, false)
  }
})

test('C10: missing, absolute, traversal and symlink-escaping artifacts are rejected', (t) => {
  const f = evidenceFixture(t)
  const outside = join(f.base, 'outside.json')
  writeFileSync(outside, '{}')
  const cases = [
    ['artifacts/missing.json', 'missing'],
    ['/etc/passwd', 'absolute'],
    ['../../etc/passwd', 'traversal'],
  ]
  for (const [path, label] of cases) {
    const r = R.checkArtifacts({ artifacts: [path], scopedRoot: f.ctx.scopedRoot, fixtureGitignore: F.GITIGNORE_MATCH, artifactRootRel: 'artifacts/' })
    assert.equal(r.ok, false, `C10: ${label} artifact rejected`)
  }
  const link = join(f.base, 'artifacts', 'link.json')
  symlinkSync(outside, link)
  const r = R.checkArtifacts({ artifacts: ['artifacts/link.json'], scopedRoot: f.ctx.scopedRoot, fixtureGitignore: F.GITIGNORE_MATCH, artifactRootRel: 'artifacts/' })
  assert.equal(r.ok, false, 'C10: symlink escape rejected')
  assert.equal(r.checks[0].citable, false)
})

test('C10: fake redaction flag with raw sensitive sentinels is rejected', () => {
  const raw = { token: F.SENSITIVE_SAMPLES.token, cookie: F.SENSITIVE_SAMPLES.cookie }
  const r = R.checkRedaction({ samples: raw, redactionStatus: 'passed' })
  assert.equal(r.ok, false, 'C10: flag alone is not sufficient')
  assert.ok(r.reasons.length > 0)
})

test('C10: redacted safe samples with status passed are accepted', () => {
  const r = R.checkRedaction({ samples: F.REDACTED_SAMPLES, redactionStatus: 'passed' })
  assert.equal(r.ok, true)
})

test('C10: fixture ignore check never inspects .git or claims real Git behavior', () => {
  const r = R.checkFixtureIgnoreRule({ fixtureGitignore: F.GITIGNORE_MATCH, artifactRootRel: 'artifacts/' })
  assert.match(r.scope, /fixture/i)
  assert.equal(r.realGitIgnoreVerified, false)
})

// =====================================================================================
// Edge branches — unknown/uninspectable inputs fail closed
// =====================================================================================
test('EDGE: a missing assertion summary is weak with unknown strength', () => {
  for (const summary of [null, undefined, 42]) {
    const r = R.checkAssertionQuality(summary)
    assert.equal(r.ok, false)
    assert.equal(r.strength, 'unknown')
  }
})

test('EDGE: a non-regular artifact (directory) is not citable', (t) => {
  const f = evidenceFixture(t)
  const r = R.checkArtifacts({
    artifacts: ['artifacts'], scopedRoot: f.ctx.scopedRoot,
    fixtureGitignore: F.GITIGNORE_MATCH, artifactRootRel: 'artifacts/',
  })
  assert.equal(r.ok, false)
  assert.equal(r.checks[0].citable, false)
  assert.match(r.checks[0].reason, /regular file/)
})

test('EDGE: uninspectable redaction samples are rejected', () => {
  const r = R.checkRedaction({ samples: { trace: null }, redactionStatus: 'passed' })
  assert.equal(r.ok, false)
  assert.ok(r.reasons.some((x) => x.includes('uninspectable')))
})

test('EDGE: non-integer prior counts produce an explicit count anomaly', () => {
  const r = R.checkCountRegression({ current: { tests: 3, assertions: 3 }, prior: { tests: '3', assertions: 3 } })
  assert.equal(r.ok, false)
  assert.ok(r.anomalies.some((x) => x.includes('non-integer')))
})

// =====================================================================================
// Emitter / report conformance (no report writes on import)
// =====================================================================================
const emit = await import('../scripts/emit-m4-reports.mjs')

test('EMIT-1: buildReports returns all eight scenario reports with deferred labels', () => {
  const reports = emit.buildReports()
  const expected = [
    'env-gating.report.json', 'blocked-dependency.report.json', 'handoff.request.json',
    'runner.evidence.json', 'weak-assertion.report.json', 'fail-downgrade.report.json',
    'artifact-redaction.report.json', 'mutation-suite.report.json', 'prompt-conformance.report.json',
  ]
  assert.deepEqual(Object.keys(reports).sort(), expected.sort())
  for (const [name, body] of Object.entries(reports)) {
    assert.equal(typeof body, 'object', `${name} is an object`)
    assert.equal(body.live_playwright_execution, 'DEFERRED_TO_M6', `${name} defers live Playwright`)
    assert.equal(body.live_prompt_verification, 'DEFERRED_TO_M6', `${name} defers live prompt`)
    assert.equal(body.registry_writes, 0, `${name} records zero registry writes`)
    assert.equal(body.fixture_provenance, 'SYNTHETIC_REFERENCE')
  }
})

test('EMIT-2: scenario/A F ids and both mutation detections are present', () => {
  const reports = emit.buildReports()
  assert.equal(reports['env-gating.report.json'].scenario_id, 'D02')
  assert.equal(reports['blocked-dependency.report.json'].scenario_id, 'C08')
  assert.equal(reports['handoff.request.json'].scenario_id, 'C01')
  assert.equal(reports['runner.evidence.json'].scenario_id, 'C04')
  assert.equal(reports['weak-assertion.report.json'].scenario_id, 'C05')
  assert.equal(reports['fail-downgrade.report.json'].scenario_id, 'C06')
  assert.equal(reports['artifact-redaction.report.json'].scenario_id, 'C10')
  assert.deepEqual(reports['runner.evidence.json'].acceptance, ['AC-012', 'AC-014'])
  assert.equal(reports['mutation-suite.report.json'].mutations['10'].detected, true)
  assert.equal(reports['mutation-suite.report.json'].mutations['12'].detected, true)
})

test('EMIT-3: prompt delta is PROPOSAL ONLY, applied=false with exact hashes', () => {
  const r = emit.buildReports()['prompt-conformance.report.json']
  assert.equal(r.status, 'PROPOSAL_ONLY')
  assert.equal(r.applied, false)
  assert.equal(r.command_preimage_sha256, F.PROMPT_PREIMAGE_SHA)
  assert.equal(r.proposed_insertion_sha256, F.PROMPT_DELTA_INSERTION_SHA)
  assert.equal(r.proposed_postimage_sha256, F.PROMPT_POSTIMAGE_SHA)
  assert.equal(r.insertion_ends_with_two_lf, true)
  assert.equal(r.command_postimage_actual_sha256, F.PROMPT_PREIMAGE_SHA)
})

test('EMIT-4: emitter writes only to an injected scratch outDir and reports parse as JSON', (t) => {
  const outDir = disposable(t, 'emit')
  const written = emit.emitReports({ outDir })
  assert.ok(written.length >= 9)
  for (const p of written) {
    assert.ok(p.startsWith(outDir), `EMIT-4: wrote only inside scratch (${p})`)
    const body = JSON.parse(readFileSync(p, 'utf8'))
    assert.equal(typeof body, 'object')
  }
})

test('EMIT-5: emitter refuses a mismatched observer/contract fixture', () => {
  assert.throws(
    () => emit.buildReports({ contractOverride: { expectedScenarioIds: ['D02', 'NOT_A_SCENARIO'] } }),
    /CONTRACT_MISMATCH|conformance/i,
    'EMIT-5: altered contract must not emit a success claim',
  )
})

test('EMIT-6: sanitized reports never carry raw sensitive sentinels or an invented CLI', () => {
  const reports = emit.buildReports()
  const blob = JSON.stringify(reports)
  for (const value of Object.values(F.SENSITIVE_SAMPLES)) {
    assert.equal(blob.includes(value), false, 'EMIT-6: no raw sentinel in reports')
  }
  assert.equal(blob.includes('/e2e run TEST-E2E-001'), false, 'EMIT-6: no slash command presented as executed CLI')
  assert.equal(blob.includes('actual_cli": "/e2e'), false)
})
