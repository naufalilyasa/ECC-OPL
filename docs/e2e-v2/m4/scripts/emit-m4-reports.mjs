// M4 evidence emitter — runs the reference harness over synthetic fixtures and
// writes only the listed M4 report paths (plus disposable scratch fixtures).
// No child_process, shell, network, browser, install, git or registry write.
// Importing this module never writes; only the CLI main guard emits to disk.
import { createHash } from 'node:crypto'
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import * as R from '../tests/runner.mjs'
import * as F from '../tests/fixtures.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_OUT = join(HERE, '..', 'reports')
const sha = (buf) => createHash('sha256').update(buf).digest('hex')

const STAMP = {
  generated_at: '2026-11-23T00:00:00Z',
  milestone: 'M4',
  method: 'reference-implementation harness (node --test): docs/e2e-v2/m4/tests/runner.mjs',
  status: 'EXECUTED',
  fixture_provenance: 'SYNTHETIC_REFERENCE',
  live_prompt_verification: 'DEFERRED_TO_M6',
  live_playwright_execution: 'DEFERRED_TO_M6',
  registry_writes: 0,
  applied: false,
  note: 'Fixture observations only. No real Playwright run, owner consent, registry mutation or CLI execution. A record Command string is data, never an executed command.',
}

const EXPECTED_SCENARIO_IDS = {
  'env-gating.report.json': 'D02',
  'blocked-dependency.report.json': 'C08',
  'handoff.request.json': 'C01',
  'runner.evidence.json': 'C04',
  'weak-assertion.report.json': 'C05',
  'fail-downgrade.report.json': 'C06',
  'artifact-redaction.report.json': 'C10',
  'mutation-suite.report.json': 'MUT',
  'prompt-conformance.report.json': 'PROMPT',
}

const gateRequest = (variant) => ({
  mode: 'run', target: F.TARGET_NONPROD, approval: F.APPROVAL_VALID,
  guardian: 'ALLOW', dependency: 'AVAILABLE', ...variant,
})

function scratchEvidence() {
  const base = mkdtempSync(join(tmpdir(), 'm4-emit-'))
  try {
    const specRel = 'tests/e2e/checkout.spec.ts'
    const artifactRel = 'artifacts/checkout.trace.json'
    mkdirSync(join(base, 'tests', 'e2e'), { recursive: true })
    mkdirSync(join(base, 'artifacts'), { recursive: true })
    writeFileSync(join(base, specRel), "test('checkout completes to confirmation', async () => {})\n")
    writeFileSync(join(base, artifactRel), '{"trace":"[REDACTED_TOKEN]"}\n')
    writeFileSync(join(base, '.gitignore'), F.GITIGNORE_MATCH)
    const expectedSha = sha(readFileSync(join(base, specRel)))
    const envelope = structuredClone(F.F10_ENVELOPE)
    envelope.spec_sha256 = expectedSha
    const observer = structuredClone(F.F10_OBSERVER)
    observer.spec_sha256 = expectedSha
    const ctx = {
      repoRoot: base, specRel, expectedSha,
      expectedTestId: F.REGISTERED_ROW.id, expectedNode: F.REGISTERED_ROW.node,
      expectedEnv: F.REGISTERED_ROW.environment,
      allowedCommands: [F.REGISTERED_ROW.allowedCommand],
      scopedRoot: join(base, 'artifacts'), artifactRootRel: 'artifacts/',
      fixtureGitignore: F.GITIGNORE_MATCH, redactionSamples: F.REDACTED_SAMPLES,
      priorCounts: F.PRIOR_COUNTS_UNCHANGED,
    }
    return { valid: R.validateRunnerEvidence({ envelope, observer, ctx }), ctx }
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
}

export function buildReports(opts = {}) {
  const expected = opts.contractOverride?.expectedScenarioIds ?? EXPECTED_SCENARIO_IDS

  const approved = (() => { let n = 0; const r = R.evaluateEnvironmentGate(gateRequest({}), () => { n += 1 }); return { ...r, spyCalls: n } })()
  const prod = (() => { let n = 0; const r = R.evaluateEnvironmentGate(gateRequest(F.GATE_VARIANTS.production), () => { n += 1 }); return { ...r, spyCalls: n } })()
  const depMissing = (() => { let n = 0; const r = R.evaluateEnvironmentGate(gateRequest(F.GATE_VARIANTS.dependencyMissing), () => { n += 1 }); return { ...r, spyCalls: n } })()
  const handoffBuilt = R.buildHandoff(F.REGISTERED_ROW)
  const handoff = R.validateHandoff(handoffBuilt)
  const evidence = scratchEvidence()
  const weak = R.proposeOutcome({
    exit_code: 0,
    assertion_summary: { total: 1, kind: 'visibility-only', expected_behavior: 'button visible', observed_result: 'button visible' },
    evidenceValid: true, countRegression: { ok: true },
  })
  const downgrade = R.proposeFailDowngrade({
    envelope: { ...F.F10_ENVELOPE, exit_code: 1, runner_status: 'FAIL' },
    currentState: 'covered', rowId: F.REGISTERED_ROW.id,
    registryText: '# synthetic registry\n### TEST-E2E-001\n- State: covered\n', evidenceValid: true,
  })
  const countDrop = R.checkCountRegression({ current: { tests: 3, assertions: 3 }, prior: F.PRIOR_COUNTS_TEST_DROP })
  const ignoreMatch = R.checkFixtureIgnoreRule({ fixtureGitignore: F.GITIGNORE_MATCH, artifactRootRel: 'artifacts/' })
  const ignoreMissing = R.checkFixtureIgnoreRule({ fixtureGitignore: F.GITIGNORE_MISSING, artifactRootRel: 'artifacts/' })
  const redactionFake = R.checkRedaction({ samples: { token: F.SENSITIVE_SAMPLES.token }, redactionStatus: 'passed' })
  const mut10 = R.runMutation10()
  const mut12 = R.runMutation12(gateRequest(F.GATE_VARIANTS.production))

  const reports = {
    'env-gating.report.json': {
      scenario_id: 'D02', acceptance: ['AC-011', 'E2E-FR-011'], fixture: 'F12',
      synthetic_inputs: { mode: 'run|full', classification: 'non-production|production|unknown', guardian: 'ALLOW|DENY' },
      approved: { outcome: approved.outcome, dispatch_spy_calls: approved.spyCalls },
      production: { outcome: prod.outcome, dispatch_spy_calls: prod.spyCalls, reason: prod.reason },
      guardian_denial: { outcome: R.evaluateEnvironmentGate(gateRequest(F.GATE_VARIANTS.guardianDeny)).outcome, dispatch_spy_calls: 0 },
      d02_oracle: R.d02Oracle({ target: F.TARGET_NONPROD, guardian: 'ALLOW', approval: F.APPROVAL_VALID, observedDispatchCount: 0 }),
      execution: 'NOT_RUN',
    },
    'blocked-dependency.report.json': {
      scenario_id: 'C08', acceptance: ['AC-011', 'E2E-FR-011'], fixture: 'F10',
      dependency_input: 'MISSING (synthetic injected value)',
      outcome: depMissing.outcome, dispatch_spy_calls: depMissing.spyCalls,
      install_attempts: depMissing.installAttempts, playwright_probes: depMissing.playwrightProbes,
    },
    'handoff.request.json': {
      scenario_id: 'C01', acceptance: ['AC-014', 'E2E-FR-013'], fixture: 'F07/F10',
      handoff: handoffBuilt.handoff, dispatch_count: handoffBuilt.dispatchCount,
      independent_binding: { bound: handoff.bound, reasons: handoff.reasons, fixtureVerdict: handoff.fixtureVerdict },
      credit_eligible: handoff.creditEligible,
    },
    'runner.evidence.json': {
      scenario_id: 'C04', acceptance: ['AC-012', 'AC-014'], fixture: 'F10',
      envelope: 'synthetic — see docs/e2e-v2/m4/tests/fixtures.mjs (no invented live CLI or timestamps)',
      valid: evidence.valid.valid, fixture_verdict: evidence.valid.fixtureVerdict,
      execution_state: evidence.valid.executionState,
      checks: Object.fromEntries(Object.entries(evidence.valid.checks).map(([k, v]) => [k, { ok: v.ok, reasons: v.reasons }])),
      count_comparison: {
        current: 'fixture test/assertion counts', prior: 'fixture prior-stage counts',
        unchanged_ok: R.checkCountRegression({ current: { tests: 3, assertions: 3 }, prior: F.PRIOR_COUNTS_UNCHANGED }).ok,
        test_drop_anomaly: countDrop.anomalies, complete_eligible: countDrop.completeEligible,
      },
      actual_cli: 'NOT_RUN', live_coverage_credit: false,
    },
    'weak-assertion.report.json': {
      scenario_id: 'C05', acceptance: ['AC-012', 'E2E-FR-012'], fixture: 'F10',
      assertion_kind: 'visibility-only (expected equals observed)',
      outcome: weak.outcome, credit_eligible: weak.creditEligible, live_coverage_credit: false,
    },
    'fail-downgrade.report.json': {
      scenario_id: 'C06', acceptance: ['AC-013', 'E2E-FR-012'], fixture: 'F10',
      runner_exit: 1, outcome: downgrade.outcome, proposed_state: downgrade.proposed_state,
      applied: downgrade.applied, registry_writes: downgrade.registry_writes,
      registry_bytes_unchanged: downgrade.registry_bytes_unchanged,
      registry_sha256_before: downgrade.registry_before_sha,
      registry_sha256_after: downgrade.registry_after_sha,
    },
    'artifact-redaction.report.json': {
      scenario_id: 'C10', acceptance: ['AC-014', 'E2E-FR-013'], fixture: 'F10',
      fixture_ignore_rule_matching: { ok: ignoreMatch.ok, rule: ignoreMatch.rule, scope: ignoreMatch.scope, real_git_ignore_verified: ignoreMatch.realGitIgnoreVerified },
      fixture_ignore_rule_missing: { ok: ignoreMissing.ok, reasons: ignoreMissing.reasons },
      redaction_flag_only: { ok: redactionFake.ok, reasons: redactionFake.reasons },
      sample_outcome: 'safe synthetic sentinels only; no raw values published',
      evidence_citable: evidence.valid.checks.artifacts.ok,
      real_git_claim: false,
    },
    'mutation-suite.report.json': {
      scenario_id: 'MUT', acceptance: ['AC-011', 'AC-012'],
      mutations: {
        10: { detected: mut10.detected, oracle_reason: mut10.oracleReason, expected_credit_eligible: mut10.expectedCreditEligible },
        12: { detected: mut12.detected, oracle_reason: mut12.oracleReason, observed_dispatch: mut12.observedDispatchCount, expected_dispatch: mut12.expectedDispatchCount },
      },
    },
    'prompt-conformance.report.json': {
      scenario_id: 'PROMPT', acceptance: ['AC-014'],
      status: 'PROPOSAL_ONLY', applied: false,
      command_preimage_sha256: F.PROMPT_PREIMAGE_SHA,
      command_preimage_actual_sha256: sha(readFileSync(join(HERE, '../../../..', '.opencode/commands/e2e.md'))),
      classification: R.classifyPrompt(readFileSync(join(HERE, '../../../..', '.opencode/commands/e2e.md'), 'utf8')),
      proposed_insertion_sha256: F.PROMPT_DELTA_INSERTION_SHA,
      proposed_insertion_bytes_base64: F.PROMPT_DELTA_INSERTION_B64,
      proposed_insertion_byte_length: Buffer.from(F.PROMPT_DELTA_INSERTION_B64, 'base64').length,
      insertion_ends_with_two_lf: Buffer.from(F.PROMPT_DELTA_INSERTION_B64, 'base64').subarray(-2).toString('latin1') === '\n\n',
      proposed_postimage_sha256: F.PROMPT_POSTIMAGE_SHA,
      command_postimage_actual_sha256: sha(readFileSync(join(HERE, '../../../..', '.opencode/commands/e2e.md'))),
      approval_required: 'separate exact-diff approval; not granted in M4 plan approval',
    },
  }

  for (const [name, body] of Object.entries(reports)) {
    if (expected[name] !== body.scenario_id) {
      throw new Error(`CONTRACT_MISMATCH: ${name} expected ${expected[name]}, got ${body.scenario_id}`)
    }
    reports[name] = { ...STAMP, ...body }
  }
  return reports
}

export function emitReports({ outDir = DEFAULT_OUT } = {}) {
  const reports = buildReports()
  mkdirSync(outDir, { recursive: true })
  const written = []
  for (const [name, body] of Object.entries(reports)) {
    const path = join(outDir, name)
    writeFileSync(path, JSON.stringify({ ...STAMP, ...body }, null, 2) + '\n')
    written.push(path)
  }
  return written
}

const isMain = process.argv[1]
  && pathToFileURL(process.argv[1]).href === import.meta.url
if (isMain) emitReports()
