// M6 acceptance ledger + deterministic reference verifiers.
// Aggregates the authoritative 48-row matrix, enforces the honest status taxonomy,
// and provides independent reference checks for gate/environment/parity/path/rollback.
// Pure logic plus read-only tree hashing and scratch-only rollback writes.
import { createHash } from 'node:crypto'
import {
  existsSync, readFileSync, readdirSync, realpathSync, lstatSync, writeFileSync, mkdirSync,
} from 'node:fs'
import { isAbsolute, join, resolve, sep, relative, basename } from 'node:path'

import {
  ROOT, EXECUTED_PASS_IDS, REFERENCE_VERIFIED_IDS, NOT_RUN_IDS, SCENARIO_IDS,
} from './fixtures.mjs'
import { validateRegistryState } from './registry-state.mjs'

const sha = (b) => createHash('sha256').update(b).digest('hex')
const shaText = (s) => sha(Buffer.from(String(s), 'utf8'))
const arr = (x) => (Array.isArray(x) ? x : [])
const inside = (root, p) => p === root || p.startsWith(root + sep)
const escapes = (p) => typeof p !== 'string' || p.length === 0
  || isAbsolute(p) || p.split(/[\\/]/).includes('..')
const mkdir0700 = (p) => mkdirSync(p, { mode: 0o700, recursive: true })
const HEX64 = /^[0-9a-f]{64}$/

// Scenario verdicts are derived from evidence predicates. The ID buckets imported
// from fixtures.mjs describe the planned evidence source only; they never award PASS.
const RUN_KIND = Object.freeze({ C04: 'happy', C05: 'weak', C06: 'broken', C07: 'skipped', C10: 'cred' })
export const RUN_PREDICATES = Object.freeze({
  // C04: a real behavioral run reached its expected state with valid evidence.
  // Exact booleans only: an omitted covered result is NOT proof of denial.
  C04: { id: 'HAPPY_BEHAVIOR_OBSERVED', evaluate: (run) => Number(run?.exitCode) === 0
    && run?.status === 'PASS' && run?.assertionKind === 'behavioral'
    && run?.testCount > 0 && run?.skipped === false && run?.covered === false },
  C05: { id: 'WEAK_ASSERTION_DENIED', evaluate: (run) => run?.exitCode === 0
    && run?.assertionKind === 'visibility-only' && run?.covered === false },
  C06: { id: 'BROKEN_BEHAVIOR_REJECTED', evaluate: (run) => Number(run?.exitCode) > 0
    && run?.status === 'FAIL' && run?.assertionKind === 'behavioral' && run?.covered === false },
  C07: { id: 'ZERO_SKIPPED_DENIED', evaluate: (run) => run?.skipped === true
    && run?.testCount === 0 && run?.assertionKind === 'none' && run?.covered === false },
  C10: { id: 'REDACTION_PROVEN', evaluate: (run) => run?.exitCode === 0
    && run?.assertionKind === 'behavioral' && run?.testCount > 0 && run?.skipped === false
    && Number.isInteger(run?.redactionsCount) && run.redactionsCount > 0 && run?.covered === false },
})
// D02, D05 and E01–E06 are deterministic executed checks: their evidence is a
// materialized report whose bytes are hashed by the emitter in the same run.
const DETERMINISTIC_REPORT_IDS = Object.freeze(new Set(['D02', 'D05', 'E01', 'E02', 'E03', 'E04', 'E05', 'E06']))

// Scenario-specific expected predicates for report-backed scenarios. A digest
// alone never certifies a report; the trusted binding must carry a result that
// was recomputed from the actual report content by the emitter.
export const REPORT_PREDICATES = Object.freeze({
  D02: 'ENVIRONMENT_GATE_DETERMINISTIC@r1',
  D05: 'FROZEN_TREE_HASH_VERIFIED@r1',
  E01: 'SCOPE_WRITE_CONTAINMENT@r1',
  E02: 'MUTATION_SUITE_ALL_DETECTED@r1',
  E03: 'COVERAGE_REPORT_RESOLVED@r1',
  E04: 'DECISION_PACKET_VETO_VERIFIED@r1',
  E05: 'SCOPE_ROOT_AND_FREEZE_VERIFIED@r1',
  E06: 'RELEASE_GATE_HONESTY_VERIFIED@r1',
})

// Recompute a deterministic scenario's assertion from actual report bodies.
export function reportAssertionResult(id, bodies = {}) {
  const env = bodies['env-boundary.report.json']
  const preflight = bodies['m6-preflight.report.json']
  const mutations = bodies['mutation-suite.report.json']
  const coverage = bodies['coverage.report.json']
  const decision = bodies['m6-decision-packet.json']
  const scope = bodies['scope-check.report.json']
  switch (id) {
    case 'D02': return env?.status === 'PASS' && env?.production_target === 'BLOCKED'
      && env?.production_code === 'BLOCKED_PRODUCTION_TARGET'
    case 'D05': return preflight?.status === 'PASS' && preflight?.frozen?.allMatch === true
    case 'E01': return scope?.status === 'PASS' && scope?.outside_writes === 0
    case 'E02': return mutations?.status === 'PASS' && mutations?.all_detected === true && mutations?.detected === 14
    case 'E03': return ['MEASURED', 'PASS'].includes(coverage?.status) && Array.isArray(coverage?.modules)
      && coverage.modules.length > 0 && coverage.modules.every((m) => m.exit === 0
        && m.lines >= 80 && m.branches >= 80 && m.functions >= 80)
    case 'E04': return decision?.status === 'BLOCKED' || decision?.gate_status === 'BLOCKED_DEPLOYMENT_GATED'
    case 'E05': return scope?.status === 'PASS' && scope?.frozen_trees_all_match === true
    case 'E06': return decision?.status === 'BLOCKED' || decision?.gate_status === 'BLOCKED_DEPLOYMENT_GATED'
    default: return false
  }
}

export function trustedEvidenceEntry(id, artifact, bytes, bodies = {}) {
  return {
    artifact,
    sha256: sha(bytes),
    assertion: {
      predicate_id: RUN_PREDICATES[id] ? null : (REPORT_PREDICATES[id] ?? null),
      result: RUN_PREDICATES[id] ? true : reportAssertionResult(id, bodies),
      source: 'REPORT_BYTES_RECOMPUTED',
    },
  }
}

function evidenceValid(evidence) {
  return typeof evidence?.artifact === 'string' && evidence.artifact.length > 0
    && typeof evidence?.sha256 === 'string' && HEX64.test(evidence.sha256)
}
function normalizedRunVerdict(run) {
  if (!run) return 'NOT_EXECUTED'
  if (run.skipped === true || run.testCount === 0 || run.assertionKind === 'none') return 'NOT_EXECUTED'
  if (run.assertionKind === 'visibility-only') return 'PASS_UNVERIFIED'
  if (Number(run.exitCode) > 0 || run.status === 'FAIL') return 'FAIL'
  if (run.status === 'PASS' && run.assertionKind === 'behavioral') return 'PASS_VERIFIED'
  return 'UNVERIFIED'
}

const FROZEN_TREES = Object.freeze([
  ['m1', 'docs/e2e-v2/m1', 16, '8416c0671af8ae60850d9d72f249968976c907cf4aa62b605d663bd5eb1625ca'],
  ['m2', 'docs/e2e-v2/m2', 27, '2f81da73f2068357f4265a3cfbaf6a9435a3e502d52dcd32d33b3b445fc97588'],
  ['m3', 'docs/e2e-v2/m3', 17, '2e8c7cf63a44b3d073185be0a4fe59de87fd9583ffc79abc6066b151066e23c7'],
  ['m4', 'docs/e2e-v2/m4', 20, '88c50d13760dd24dd47b9e5f2a2d8aa707b0f008abcf19b06fa7370641bc7807'],
  ['m5', 'docs/e2e-v2/m5', 23, '267c3b8bce980c97cadfc54b815fb79190d9a8f9f6951cb29ae92839dbf7b014'],
  ['contracts', 'docs/e2e-v2/contracts', 3, 'a550f29ea751c7635cdc5d73bbc2e6a0a29d7cdf7153e43f23e429a4f4e05e8c'],
])
const PERMITTED_FIELDS = Object.freeze(['State', 'Test file', 'Test node', 'Command', 'Evidence'])
const TERMINAL_ENUM = Object.freeze(['PASS', 'FAIL', 'BLOCKED', 'UNVERIFIED', 'CANCELLED', 'PARTIAL'])
// Approved narrow M5 amendment. Historical digest is retained verbatim and is
// never rewritten to disguise the patch; the post-amendment digest is recorded
// separately with its change-request identity.
const FROZEN_TREE_AMENDMENTS = Object.freeze({
  m5: Object.freeze({
    expectedFiles: 29,
    after_sha256: '524a975360ae6f244bc3e20908fafaa8fd17937231ada2388e74f9aca737b189',
    change_request: 'E2E-V2-M5-SAFETY-REMEDIATION-01',
    helper_before: '146c8cfd51e8f01679d08784077c0bd7e565747efa508ce392417e94de781f11',
    helper_after: 'b5bb301655b713e484e449cb2e2549794b56a8307d0fec727a1ca96ac26cff80',
    scope: 'REFERENCE_ONLY (docs/e2e-v2/m5/tests/migration.mjs helpers only)',
  }),
})

function walk(dir) {
  let out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const fp = join(dir, e.name)
    if (e.isDirectory()) out = out.concat(walk(fp))
    else if (e.isFile()) out.push(fp)
  }
  return out
}

// ---------------------------------------------------------------- AC-021 ledger
export function buildAcceptanceLedger({ matrixRows = [], executionResults = {}, evidenceHashes = {}, expectedEvidenceHashes = {} } = {}) {
  const scenarios = matrixRows.map((row) => {
    const id = row.id
    const evidence = evidenceHashes[id] ?? {}
    const expectedRow = expectedEvidenceHashes[id]
    const expectedSha = typeof expectedRow === 'string' ? expectedRow : expectedRow?.sha256
    const evidenceOk = evidenceValid(evidence)
      && (expectedSha === undefined || evidence.sha256 === expectedSha)
    const run = executionResults[id] ?? executionResults[RUN_KIND[id] ?? ''] ?? null
    let status = 'NOT_RUN'
    let executionMethod = 'deferred_live_session'
    let evidenceLevel = 'NOT_EXECUTED'
    let predicateId = null
    let assertionResult = 'NOT_EVALUATED'

    if (RUN_PREDICATES[id]) {
      const predicate = RUN_PREDICATES[id]
      predicateId = `${predicate.id}@r1`
      executionMethod = 'scratch_playwright_local'
      evidenceLevel = run ? 'ACTUAL_EXECUTION' : 'NOT_EXECUTED'
      assertionResult = run && evidenceOk && predicate.evaluate(run) ? 'MATCH' : 'MISMATCH'
      status = assertionResult === 'MATCH' ? 'PASS' : 'FAIL'
    } else if (DETERMINISTIC_REPORT_IDS.has(id)) {
      predicateId = 'DETERMINISTIC_REPORT_VERIFIED@r1'
      executionMethod = 'deterministic_executed'
      evidenceLevel = 'ACTUAL_EXECUTION'
      assertionResult = evidenceOk ? 'MATCH' : 'MISMATCH'
      status = assertionResult === 'MATCH' ? 'PASS' : 'FAIL'
    } else if (REFERENCE_VERIFIED_IDS.has(id)) {
      status = evidenceOk ? 'REFERENCE_VERIFIED' : 'NOT_RUN'
      executionMethod = 'deterministic_harness'
      evidenceLevel = evidenceOk ? 'DETERMINISTIC_REFERENCE' : 'NOT_EXECUTED'
    }
    if (NOT_RUN_IDS.has(id)) {
      status = 'NOT_RUN'; executionMethod = 'deferred_live_session'; evidenceLevel = 'NOT_EXECUTED'
    }
    return {
      scenario_id: id,
      group: row.group,
      stimulus: row.stimulus,
      expected: row.expected,
      status,
      execution_method: executionMethod,
      fixture_ids: row.fixture_ids,
      evidence_artifact: evidence.artifact ?? 'docs/e2e-v2/m6/reports/acceptance-ledger.json',
      evidence_sha256: evidence.sha256 ?? null,
      evidence_verification: evidenceOk ? 'REPORT_BYTES_HASH_VERIFIED' : 'EVIDENCE_MISSING',
      raw_trace_verification: 'RAW_ARTIFACT_NOT_BUNDLED',
      evidence_level: evidenceLevel,
      scenario_predicate_id: predicateId,
      scenario_assertion_result: assertionResult,
      normalized_run_verdict: normalizedRunVerdict(run),
      coverage_credit: RUN_PREDICATES[id] ? status === 'PASS' && run?.covered === true : false,
      observed_run: run ? {
        kind: run.kind ?? RUN_KIND[id] ?? null,
        exit_code: run.exitCode ?? null,
        status: run.status ?? null,
        assertion_kind: run.assertionKind ?? null,
        test_count: run.testCount ?? null,
        skipped: Boolean(run.skipped),
        redactions_count: run.redactionsCount ?? null,
        target_label: run.targetLabel ?? null,
      } : null,
      requirement_ids: row.requirement_ids,
      prd_ac: row.prd_ac,
      matrix_status: row.matrix_status,
      executed_evidence: run ? {
        kind: run.kind ?? RUN_KIND[id] ?? null,
        exit_code: run.exitCode ?? null, run_status: run.status ?? null,
        assertion_kind: run.assertionKind ?? null, redactions_count: run.redactionsCount ?? null,
        target_label: run.targetLabel ?? null, test_count: run.testCount ?? null,
        skipped: run.skipped === true,
      } : null,
      simulated_receipt_labeled_pass: false,
    }
  })
  const counts = {}
  for (const s of scenarios) counts[s.status] = (counts[s.status] ?? 0) + 1
  return {
    scenario_id: 'ACCEPTANCE_LEDGER',
    acceptance: ['AC-018', 'AC-021'],
    fixture_provenance: 'ACCEPTANCE_MATRIX_CSV + OBSERVED_EXECUTION_EVIDENCE',
    registry_writes: 0,
    applied: false,
    total: scenarios.length,
    counts,
    scenarios,
  }
}

const LEDGER_STATUSES = Object.freeze(['PASS', 'REFERENCE_VERIFIED', 'NOT_RUN', 'FAIL', 'BLOCKED', 'UNVERIFIED'])
const SELF_EVIDENCE_ARTIFACT = 'docs/e2e-v2/m6/reports/acceptance-ledger.json'
const RUN_FIELDS = Object.freeze([
  ['exit_code', 'exitCode'], ['status', 'status'], ['assertion_kind', 'assertionKind'],
  ['redactions_count', 'redactionsCount'], ['target_label', 'targetLabel'],
  ['kind', 'kind'], ['test_count', 'testCount'], ['skipped', 'skipped'],
])
const has = (obj, key) => obj !== null && typeof obj === 'object' && Object.hasOwn(obj, key)

// Canonical containment: reject absolute/traversal/backslash/NUL paths, then
// verify every component with lstat (no symlink), then check ancestor identity.
function safeEvidenceRead(root, rel) {
  if (typeof root !== 'string' || root.length === 0 || !isAbsolute(root)) {
    return { ok: false, code: 'TRUSTED_ROOT_MISSING' }
  }
  if (typeof rel !== 'string' || rel.length === 0 || isAbsolute(rel) || rel.includes('\\')
    || rel.includes('\0') || /^[A-Za-z]:/.test(rel) || rel.split('/').includes('..')) {
    return { ok: false, code: 'UNSAFE_EVIDENCE_PATH' }
  }
  let rootReal
  try {
    if (!lstatSync(root).isDirectory()) return { ok: false, code: 'TRUSTED_ROOT_INVALID' }
    rootReal = realpathSync(root)
  } catch { return { ok: false, code: 'TRUSTED_ROOT_INVALID' } }
  let cursor = rootReal
  for (const part of rel.split('/').filter(Boolean)) {
    cursor = join(cursor, part)
    let st
    try { st = lstatSync(cursor) } catch { return { ok: false, code: 'EVIDENCE_FILE_MISSING' } }
    if (st.isSymbolicLink()) return { ok: false, code: 'SYMLINK_ESCAPE' }
  }
  const full = resolve(rootReal, rel)
  const relCheck = relative(rootReal, full)
  if (relCheck.startsWith('..') || isAbsolute(relCheck)) return { ok: false, code: 'EVIDENCE_PATH_ESCAPE' }
  try {
    if (!lstatSync(full).isFile()) return { ok: false, code: 'EVIDENCE_NOT_FILE' }
    return { ok: true, bytes: readFileSync(full) }
  } catch { return { ok: false, code: 'EVIDENCE_UNREADABLE' } }
}

export function verifyStatusHonesty(ledger, {
  trustedRuns = null, trustedEvidenceHashes = null, trustedEvidenceRoot = null,
  liveEvidencePolicy = null, trustedLiveOrchestrationReceipt = null,
} = {}) {
  const unearned = []
  const misplaced = []
  const seen = new Set()
  const expectedIds = new Set(SCENARIO_IDS)
  const scenarios = arr(ledger?.scenarios)
  const runFor = (id) => (trustedRuns && (trustedRuns[id] ?? trustedRuns[RUN_KIND[id] ?? ''])) || null
  const evFor = (id) => trustedEvidenceHashes?.[id] ?? null
  const computed = {}
  const trustReasons = []
  if (!trustedRuns) trustReasons.push('trustedRuns absent')
  if (!trustedEvidenceHashes) trustReasons.push('trustedEvidenceHashes absent')
  if (!trustedEvidenceRoot) trustReasons.push('trustedEvidenceRoot absent')
  let passCount = 0

  for (const s of scenarios) {
    const id = s.scenario_id
    if (seen.has(id) || typeof id !== 'string' || !expectedIds.has(id)) {
      unearned.push(id + ':invalid-id'); continue
    }
    seen.add(id)
    computed[s.status] = (computed[s.status] ?? 0) + 1
    if (!LEDGER_STATUSES.includes(s.status)) misplaced.push(id + ':bad-status')

    // A08 is a live-orchestration scenario. No synthetic or reference receipt
    // may promote it without an explicitly authorized live evidence policy.
    if (id === 'A08' && s.status !== 'NOT_RUN') {
      const liveOk = trustedLiveOrchestrationReceipt?.verified === true
        && liveEvidencePolicy === 'AUTHORIZED_LIVE'
      if (!liveOk) misplaced.push('A08:unauthorized-promotion')
    }

    if (s.status !== 'PASS') continue
    passCount += 1

    // 1. Trust roots are mandatory for every PASS; a per-scenario run is
    // mandatory for the five run-backed scenarios, report assertion for the rest.
    const run = runFor(id)
    const trusted = evFor(id)
    const predicate = RUN_PREDICATES[id]
    if (predicate && !run) unearned.push(id + ':trusted-run-missing')
    if (!trusted) unearned.push(id + ':trusted-evidence-missing')
    if (!trustedEvidenceRoot) unearned.push(id + ':trusted-root-missing')

    // 2. Recompute the scenario predicate from trusted inputs. Declared MATCH
    // and static ID membership are never authority.
    if (predicate) {
      if (!run || !predicate.evaluate(run)) unearned.push(id + ':predicate-mismatch')
    } else if (DETERMINISTIC_REPORT_IDS.has(id)) {
      const expectedPredicate = REPORT_PREDICATES[id]
      if (trusted?.assertion?.predicate_id !== expectedPredicate
        || trusted?.assertion?.result !== true) {
        unearned.push(id + ':report-assertion-not-recomputed')
      }
    } else {
      unearned.push(id + ':no-eligible-predicate')
    }

    // 3. Exact trusted binding: artifact path, digest bytes and scenario identity.
    if (!evidenceValid({ artifact: s.evidence_artifact, sha256: s.evidence_sha256 })) {
      unearned.push(id + ':bad-evidence')
    }
    if (trusted && s.evidence_sha256 !== trusted.sha256) unearned.push(id + ':evidence-hash-mismatch')
    if (trusted && s.evidence_artifact !== trusted.artifact) unearned.push(id + ':evidence-path-mismatch')
    if (s.evidence_artifact === SELF_EVIDENCE_ARTIFACT
      || basename(String(s.evidence_artifact)) === 'acceptance-ledger.json') {
      unearned.push(id + ':circular-self-hash')
    }
    const read = safeEvidenceRead(trustedEvidenceRoot, s.evidence_artifact)
    if (!read.ok) unearned.push(id + ':evidence-' + read.code)
    else if (sha(read.bytes) !== s.evidence_sha256) unearned.push(id + ':evidence-bytes-mismatch')

    // 4. Mandatory observed_run / executed_evidence field comparison against the
    // trusted run for run-backed scenarios. Missing fields are contradictions.
    if (predicate) {
      if (!s.observed_run || typeof s.observed_run !== 'object') {
        unearned.push(id + ':observed-run-missing')
      } else {
        for (const [key, runKey] of RUN_FIELDS) {
          const execKey = key === 'status' ? 'run_status' : key
          const expected = key === 'skipped' ? (run?.skipped === true)
            : key === 'kind' ? (run?.kind ?? RUN_KIND[id] ?? null)
              : (run?.[runKey] ?? null)
          if (!has(s.observed_run, key)) unearned.push(id + ':observed-run-missing:' + key)
          else if (s.observed_run[key] !== expected) unearned.push(id + ':observed-run-mismatch:' + key)
          if (!has(s.executed_evidence, execKey)) unearned.push(id + ':executed-evidence-missing:' + execKey)
          else if (s.executed_evidence[execKey] !== expected) unearned.push(id + ':executed-evidence-mismatch:' + execKey)
          if (s.executed_evidence && s.observed_run[key] !== s.executed_evidence[execKey]) {
            unearned.push(id + ':observed-executed-contradiction:' + key)
          }
        }
      }
      if (!s.executed_evidence || typeof s.executed_evidence !== 'object') {
        unearned.push(id + ':no-executed-evidence')
      }
    }
    // 5. Coverage credit is an exact boolean derived from covered === true.
    const expectedCredit = predicate ? run?.covered === true : false
    if (typeof s.coverage_credit !== 'boolean' || s.coverage_credit !== expectedCredit) {
      unearned.push(id + ':coverage-credit-mismatch')
    }
    if (s.scenario_assertion_result !== 'MATCH') unearned.push(id + ':no-predicate')
    if (s.simulated_receipt_labeled_pass !== false) unearned.push(id + ':simulated')
  }

  for (const id of expectedIds) if (!seen.has(id)) misplaced.push(id + ':missing')
  const declared = ledger?.counts ?? {}
  const counts = { PASS: 0, REFERENCE_VERIFIED: 0, NOT_RUN: 0, FAIL: 0, BLOCKED: 0, UNVERIFIED: 0 }
  const countsOk = Object.keys(counts).every((k) => (declared[k] ?? 0) === (computed[k] ?? 0))
  const totalOk = scenarios.length === expectedIds.size && (ledger?.total ?? -1) === expectedIds.size
  const ledgerConsistent = misplaced.length === 0 && countsOk && totalOk
  const acceptanceSatisfied = unearned.length === 0
  const trust = {
    status: passCount === 0 ? 'NOT_REQUIRED'
      : (trustReasons.length ? 'TRUST_INPUTS_MISSING' : 'TRUSTED'),
    reasons: passCount === 0 ? [] : trustReasons,
  }
  return {
    ok: ledgerConsistent && acceptanceSatisfied,
    ledger_consistent: ledgerConsistent,
    acceptance_satisfied: acceptanceSatisfied,
    trust,
    unearned, misplaced, countsOk, totalOk, derived_counts: computed,
  }
}

// ---------------------------------------------------------------- parity / bundle
const PARITY_KEYS = ['routes', 'flows', 'excluded', 'partial']
export function evaluateParity({ newMapOutput, legacyMapOutput, stackId } = {}) {
  const diffs = []
  const counts = {}
  for (const key of PARITY_KEYS) {
    const a = [...arr(newMapOutput?.[key])].sort()
    const b = [...arr(legacyMapOutput?.[key])].sort()
    counts[key] = { new: a.length, legacy: b.length }
    const missingInLegacy = a.filter((x) => !b.includes(x))
    const missingInNew = b.filter((x) => !a.includes(x))
    if (missingInLegacy.length || missingInNew.length) {
      diffs.push({ category: key, missingInLegacy, missingInNew })
    }
  }
  return { caseId: 'D06', stackId: stackId ?? null, parity: diffs.length === 0, diffs, counts }
}

export function validateBundleIds(rows = []) {
  const ids = rows.map((r) => r.id)
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i)
  return {
    ok: ids.length === 48 && duplicates.length === 0,
    count: ids.length,
    duplicates: [...new Set(duplicates)],
  }
}

// ---------------------------------------------------------------- registry reference checks
export function applyFieldScopedUpdate({ registryText, blockId, outcome } = {}) {
  const text = typeof registryText === 'string' ? registryText : ''
  const hashBefore = shaText(text)
  const base = {
    caseId: 'C12', applied: false, registry_writes: 0, renumbered: 0, newIds: [],
    hashBefore, hashAfter: hashBefore, nextText: text, changes: [], diff: '',
  }
  const lines = text.split('\n')
  const start = lines.findIndex((l) => l.startsWith('### ' + blockId + ' '))
  if (start < 0) return { ...base, code: 'NOT_FOUND' }
  let end = start
  while (end + 1 < lines.length && /^- [^:]+:/.test(lines[end + 1])) end += 1
  const fields = outcome && typeof outcome === 'object' ? outcome : {}
  const illegal = Object.keys(fields).filter((k) => !PERMITTED_FIELDS.includes(k))
  if (illegal.length) return { ...base, code: 'FIELD-NOT-PERMITTED', fields: illegal }
  if (Object.hasOwn(fields, 'State')) {
    const check = validateRegistryState(fields.State)
    if (!check.valid || /[\r\n]/.test(String(fields.State))) return { ...base, code: check.code }
  }
  for (const [key, value] of Object.entries(fields)) {
    if (/[\r\n]/.test(String(value))) return { ...base, code: 'MULTILINE_FIELD_REJECTED' }
  }
  const changes = []
  for (const key of PERMITTED_FIELDS) {
    if (!Object.hasOwn(fields, key)) continue
    const to = String(fields[key])
    let idx = -1
    for (let i = start + 1; i <= end; i += 1) {
      if (lines[i].startsWith('- ' + key + ':')) { idx = i; break }
    }
    const from = idx >= 0 ? lines[idx].slice(2 + key.length + 1).trim() : undefined
    if (from === to) continue
    if (idx >= 0) lines[idx] = `- ${key}: ${to}`
    else { lines.splice(end + 1, 0, `- ${key}: ${to}`); end += 1 }
    changes.push({ id: blockId, field: key, from, to })
  }
  const nextText = lines.join('\n')
  return {
    ...base,
    applied: true,
    via: 'id',
    nextText,
    changes,
    diff: changes.map((c) => `- ${c.field}: ${c.from ?? ''}\n+ ${c.field}: ${c.to}`).join('\n'),
    hashAfter: shaText(nextText),
  }
}

export function checkWriteConflict({ hashBefore, hashNow, diff } = {}) {
  if (hashBefore !== undefined && hashBefore === hashNow) {
    return { caseId: 'B12', outcome: 'WRITE_OK', conflict: false, writePermitted: true, applied: false }
  }
  return {
    caseId: 'B12', outcome: 'WRITE_CONFLICT', conflict: true, writePermitted: false,
    applied: false, rebaseRequired: true, reapprovalRequired: true,
    rebase: { recomputeFrom: `registry@${hashNow}`, requiresApproval: true, previousDiff: diff ?? null },
  }
}

export function checkPathSafety({ registryPath, repoRoot } = {}) {
  if (escapes(registryPath)) return { allowed: false, code: 'PATH_REJECTED', realPath: null }
  let rootReal
  try { rootReal = realpathSync(repoRoot ?? ROOT) } catch {
    return { allowed: false, code: 'ROOT_NOT_FOUND', realPath: null }
  }
  // Validate every existing ancestor by canonical realpath. A nonexistent final
  // child is resolved lexically only after all existing ancestors are proven inside.
  const parts = registryPath.split(/[\\/]/).filter(Boolean)
  let cursor = rootReal
  for (const part of parts) {
    const candidate = join(cursor, part)
    let stat
    try { stat = lstatSync(candidate) } catch { stat = null }
    if (!stat) { cursor = candidate; continue }
    let resolved
    try { resolved = realpathSync(candidate) } catch {
      return { allowed: false, code: 'BROKEN_SYMLINK', realPath: candidate }
    }
    if (!inside(rootReal, resolved)) return { allowed: false, code: 'SYMLINK_ESCAPE', realPath: resolved }
    cursor = resolved
  }
  const full = join(rootReal, registryPath)
  if (!inside(rootReal, cursor)) return { allowed: false, code: 'SYMLINK_ESCAPE', realPath: cursor }
  return { allowed: true, code: 'OK', realPath: cursor, exists: existsSync(full), race_safe: false }
}

export function resolveLegacyShorthand({ rawInput } = {}) {
  const base = {
    caseId: 'D07', runnerInvocations: 0, dispatched: false, coverageCredit: false,
    registry_writes: 0, applied: false,
  }
  const raw = typeof rawInput === 'string' ? rawInput.trim() : ''
  const m = /^\/e2e(?:\s+(.*))?$/.exec(raw)
  if (!m) return { ...base, outcome: 'NOT_E2E_COMMAND' }
  const rest = (m[1] ?? '').trim()
  if (!rest) return { ...base, outcome: 'CANONICAL_COMMAND' }
  const subcommand = rest.split(/\s+/)[0]
  if (['map', 'run', 'full', 'help', '--help', '-h'].includes(subcommand)) {
    return { ...base, outcome: 'CANONICAL_COMMAND', subcommand }
  }
  return {
    ...base,
    outcome: 'LEGACY_SHORTHAND_DEPRECATED',
    flow: rest,
    subcommand,
    hint: 'Use /e2e run <flow> or /e2e map',
    migrationTarget: '/e2e run <flow> or /e2e map',
  }
}

// ---------------------------------------------------------------- environment / D02
export function evaluateEnvironmentGate(request = {}) {
  const t = request?.target ?? {}
  const approval = request?.approval
  const reasons = []
  if (!['run', 'full'].includes(request?.mode)) reasons.push('mode cannot dispatch')
  if (request?.guardian !== 'ALLOW') reasons.push('Guardian denial is final')
  if (t.classification !== 'non-production') {
    reasons.push(`classification ${JSON.stringify(t.classification)} is not an approved non-production target`)
  }
  let parsed = null
  try { parsed = new URL(t.baseUrl) } catch { reasons.push('base URL is not parseable') }
  if (parsed && !['http:', 'https:'].includes(parsed.protocol)) reasons.push('base URL scheme is not http(s)')
  for (const [key, label] of [['service', 'named service'], ['accountClass', 'account class'],
    ['fixtureOwner', 'fixture owner'], ['networkScope', 'network scope']]) {
    if (typeof t[key] !== 'string' || t[key].trim() === '') reasons.push(`missing ${label}`)
  }
  if (!Array.isArray(t.operations) || t.operations.length === 0) reasons.push('missing operation list')
  const expected = `E2E_NONPROD_LOCAL_FIXTURE@${t.baseUrl ?? ''}`
  if (!approval || typeof approval !== 'object') reasons.push('no authorization bound to this environment')
  else {
    if (approval.environment !== expected) reasons.push('authorization environment mismatch')
    if (typeof approval.owner !== 'string' || approval.owner.trim() === '') reasons.push('authorization has no owner')
    if (!Array.isArray(approval.operations)) reasons.push('authorization has no operation list')
    else for (const op of arr(t.operations)) {
      if (!approval.operations.includes(op) && !approval.operations.includes('*')) {
        reasons.push(`operation ${op} is not approved`)
      }
    }
  }
  const base = { mode: request?.mode, installAttempts: 0, playwrightProbes: 0 }
  if (reasons.length) {
    return { ...base, caseId: 'D02', outcome: 'BLOCKED', reason: reasons.join('; '), reasons, dispatchCount: 0 }
  }
  if (request.dependency !== 'AVAILABLE') {
    return { ...base, caseId: 'C08', outcome: 'BLOCKED_DEPENDENCY', reason: 'dependency unavailable', reasons: [], dispatchCount: 0 }
  }
  return { ...base, caseId: 'D02', outcome: 'ALLOW', reason: 'synthetic non-production gate pass', reasons: [], dispatchCount: 1 }
}

// ---------------------------------------------------------------- rollback / frozen trees
export function rehearseRollback({ files = [], scratchDir, corruptRestore } = {}) {
  const items = arr(files)
  const backup = join(scratchDir, 'backup')
  const fixture = join(scratchDir, 'fixture')
  mkdir0700(backup)
  mkdir0700(fixture)
  const initial = items.map((f) => ({ ...f, sha: sha(f.bytes) }))
  for (const f of initial) {
    writeFileSync(join(backup, f.name), f.bytes)
    writeFileSync(join(fixture, f.name), f.bytes)
  }
  for (const f of initial) {
    writeFileSync(join(fixture, f.name), Buffer.concat([f.bytes, Buffer.from('\n--disabled--\n')]))
  }
  for (const [i, f] of initial.entries()) {
    const restored = corruptRestore && i === 0
      ? Buffer.concat([f.bytes, Buffer.from('\nCORRUPT\n')]) : f.bytes
    writeFileSync(join(fixture, f.name), restored)
  }
  const rows = initial.map((f) => {
    const actual = sha(readFileSync(join(fixture, f.name)))
    return { name: f.name, sha256: actual, expected: f.sha, matched: actual === f.sha }
  })
  const verified = rows.filter((r) => r.matched).length
  return {
    caseId: 'D10',
    status: verified === rows.length ? 'ROLLBACK_VERIFIED' : 'ROLLBACK_FAILED',
    verifiedFiles: verified,
    totalFiles: rows.length,
    activeTreeWrites: 0,
    fixtureChangedDuringRehearsal: true,
    files: rows,
  }
}

export function verifyFrozenTrees({ root = ROOT } = {}) {
  const trees = FROZEN_TREES.map(([name, relative, count, expected]) => {
    const dir = join(root, relative)
    const files = walk(dir).sort()
    const h = createHash('sha256')
    for (const f of files) h.update(relativePath(root, f) + '\t' + sha(readFileSync(f)) + '\n')
    const observedSha256 = h.digest('hex')
    const historicalMatch = files.length === count && observedSha256 === expected
    const amendment = FROZEN_TREE_AMENDMENTS[name]
    const amendmentMatch = Boolean(amendment && files.length === amendment.expectedFiles
      && observedSha256 === amendment.after_sha256)
    return {
      name, expectedFiles: count, observedFiles: files.length,
      expectedSha256: expected, observedSha256,
      encoding: 'sorted repo-relative path<TAB>sha256<LF>',
      historical_expected_sha256: expected,
      historical_match: historicalMatch,
      amendment: amendment ? { after_sha256: amendment.after_sha256,
        change_request: amendment.change_request, helper_before: amendment.helper_before,
        helper_after: amendment.helper_after, scope: amendment.scope } : undefined,
      match_basis: historicalMatch ? 'HISTORICAL_BASELINE' : (amendmentMatch ? 'APPROVED_AMENDMENT' : 'NONE'),
      match: historicalMatch || amendmentMatch,
    }
  })
  return { trees, allMatch: trees.every((t) => t.match) }
}
function relativePath(root, file) {
  const r = resolve(root)
  const f = resolve(file)
  return f.startsWith(r + sep) ? f.slice(r.length + 1) : file
}

// ---------------------------------------------------------------- terminal outcomes
export function mapTerminalOutcome({
  raw, exitCode, evidenceValid, assertionStrength, retries, flaky, mappingComplete, narrativePass,
} = {}) {
  const retry = { retries: Number.isInteger(retries) ? retries : 0, flaky: Boolean(flaky) }
  const base = {
    caseId: 'E06', enum: [...TERMINAL_ENUM], allowed: false,
    retry, retryFoldedIntoPass: false, fabricatedPass: false, reasons: [],
  }
  const looksFabricated = typeof raw === 'string' && !TERMINAL_ENUM.includes(raw)
    && (/^PASS[\s_(]/.test(raw) || /PASS_UNCHECKED/.test(raw))
  if (looksFabricated || narrativePass === true) {
    return { ...base, outcome: 'UNVERIFIED', fabricatedPass: true, reasons: ['fabricated or narrative pass rejected'] }
  }
  if (TERMINAL_ENUM.includes(raw)) return { ...base, outcome: raw, allowed: true }
  let outcome = 'UNVERIFIED'
  if (Number.isInteger(exitCode) && exitCode > 0) outcome = 'FAIL'
  else if (evidenceValid === false) outcome = 'UNVERIFIED'
  else if (mappingComplete === false) outcome = 'PARTIAL'
  else if (assertionStrength === 'weak') outcome = 'UNVERIFIED'
  return { ...base, outcome, reasons: ['raw outcome not in canonical enum; derived from signals'] }
}

// ---------------------------------------------------------------- DEC-10 gate packet
export function evaluateM6Gates({
  p1WinnerVerified, p2ParityReport, p3RegistrySafety, p4RollbackReport, p5OwnerAuth,
  productBoundary, acceptanceProvenance, a08Evidence, mode = 'ACTUAL',
} = {}) {
  // One canonical actual decision. A recorded test-helper PASS never unlocks P3:
  // strict product pass needs an ACTUAL boundary, blocker === false, verified
  // S01/S02 evidence, no findings and no blocking limitation.
  const pb = productBoundary && typeof productBoundary === 'object' ? productBoundary : null
  const findings = Array.isArray(pb?.findings) ? [...pb.findings] : []
  const limitations = Array.isArray(pb?.blockingLimitations) ? [...pb.blockingLimitations] : []
  const s01 = pb?.boundaryEvidence?.S01?.verified === true
  const s02 = pb?.boundaryEvidence?.S02?.verified === true
  const actualBoundary = pb?.classification === 'ACTUAL_PRODUCT_BOUNDARY'
  const strictPass = pb?.status === 'PASS' && pb?.blocker === false && s01 && s02
    && actualBoundary && findings.length === 0 && limitations.length === 0
  let pbStatus
  if (strictPass) pbStatus = 'VERIFIED'
  else if (!pb || !['PASS', 'FAIL', 'NOT_RUN', 'NOT_VERIFIED'].includes(pb.status)) pbStatus = 'NOT_VERIFIED'
  else if (pb.status === 'FAIL') pbStatus = 'BLOCKED'
  else if (pb.status === 'NOT_RUN') pbStatus = 'NOT_VERIFIED'
  else pbStatus = 'BLOCKED' // PASS but contradictory/incomplete
  const pbBlocker = pbStatus !== 'VERIFIED'
  const pbReason = pbStatus === 'VERIFIED' ? 'strict actual product boundary evidence verified'
    : !pb ? 'product boundary evidence absent'
      : pb.status !== 'PASS' ? `productBoundary.status=${pb.status}`
        : pb.blocker === true ? 'productBoundary.blocker=true'
          : !actualBoundary ? 'PRODUCT_BOUNDARY_CLASS=REFERENCE_ONLY; no verified actual product writer'
            : (!s01 || !s02) ? 'verified S01/S02 boundary evidence missing'
              : findings.length ? 'unresolved product findings: ' + findings.join(', ')
                : limitations.length ? 'blocking limitations: ' + limitations.join(', ')
                  : 'product boundary evidence incomplete'

  const gates = {
    P1: { name: 'Effective resolution', status: p1WinnerVerified === true ? 'VERIFIED' : 'NOT_VERIFIED' },
    P2: { name: 'Parity', status: p2ParityReport?.parity === true ? 'VERIFIED_IN_M5_AND_M6' : 'NOT_VERIFIED' },
    P3: { name: 'Registry safety', status: pbStatus === 'VERIFIED' && p3RegistrySafety?.ok === true
      ? 'VERIFIED_IN_M3_M5_M6' : pbStatus === 'BLOCKED' ? 'BLOCKED' : 'NOT_VERIFIED', reason: pbReason },
    P4: { name: 'Rollback readiness', status: p4RollbackReport?.status === 'ROLLBACK_VERIFIED' ? 'VERIFIED_IN_M5_AND_M6' : 'NOT_VERIFIED' },
    P5: { name: 'Owner deployment authorization', status: p5OwnerAuth === true ? 'GIVEN' : 'NOT_GIVEN' },
    A08: { name: 'Live orchestration smoke', status: a08Evidence?.status === 'VERIFIED' && a08Evidence?.authorized === true
      ? 'VERIFIED' : (a08Evidence?.status ? 'NOT_VERIFIED' : 'NOT_RUN') },
  }
  const satisfied = ['VERIFIED', 'VERIFIED_IN_M5_AND_M6', 'VERIFIED_IN_M3_M5_M6', 'GIVEN']
  const remainingRequirements = []
  if (gates.P1.status !== 'VERIFIED') remainingRequirements.push('P1: prove effective command winner (ASM-01) in an isolated probe')
  if (gates.P2.status !== 'VERIFIED_IN_M5_AND_M6') remainingRequirements.push('P2: prove new/legacy mapper parity from actual source-backed tests')
  if (gates.P3.status !== 'VERIFIED_IN_M3_M5_M6') remainingRequirements.push('P3: ' + pbReason)
  if (gates.P4.status !== 'VERIFIED_IN_M5_AND_M6') remainingRequirements.push('P4: prove reversible ROLLBACK rehearsal and snapshot integrity')
  if (gates.P5.status !== 'GIVEN') remainingRequirements.push('P5: obtain explicit owner deployment AUTHORIZATION for exact scope')
  if (gates.A08.status !== 'VERIFIED') remainingRequirements.push('A08: execute authorized live multi-phase orchestration smoke (currently ' + gates.A08.status + ')')
  if (acceptanceProvenance?.ok !== true) remainingRequirements.push('ACCEPTANCE_PROVENANCE: verify acceptance/provenance evidence and regenerate non-circular receipts')
  if (p5OwnerAuth !== true) remainingRequirements.push('AUTHORIZATION: explicit P5 scope, candidate digest, targets and operations approval missing')
  if (p4RollbackReport?.status !== 'ROLLBACK_VERIFIED') remainingRequirements.push('ROLLBACK: staged rehearsal and exact restore digests missing')
  if (pb?.classification === 'REFERENCE_ONLY') remainingRequirements.push('PRODUCT_BOUNDARY_CLASS=REFERENCE_ONLY: helper fix is not a product writer fix')
  for (const f of findings) remainingRequirements.push('PRODUCT-FINDING: ' + f)
  for (const l of limitations) remainingRequirements.push('BLOCKING-LIMITATION: ' + l)

  const disableDefaultPermitted = Object.values(gates).every((g) => satisfied.includes(g.status))
    && remainingRequirements.length === 0
  // No blocked state may ever carry an empty blocker list.
  if (!disableDefaultPermitted && remainingRequirements.length === 0) {
    remainingRequirements.push('DECISION: unresolved release prerequisite (no canonical verified decision)')
  }
  const isSimulation = mode === 'SIMULATION'
  return {
    caseId: 'DECISION',
    policy: 'DEC-10',
    decision_class: isSimulation ? 'SIMULATION' : 'ACTUAL',
    release_authority: !isSimulation,
    disableDefaultTarget: '/e2e-map',
    disableDefaultPermitted,
    productionTargets: 'BLOCKED',
    liveDisableDefault: 'BLOCKED_DEPLOYMENT_GATED',
    gates,
    gateStatus: disableDefaultPermitted ? 'READY_FOR_OWNER_DECISION' : 'BLOCKED_DEPLOYMENT_GATED',
    productBoundary: {
      status: pb?.status ?? 'NOT_VERIFIED', gate_effect: pbStatus,
      blocker: pbBlocker, classification: pb?.classification ?? 'NOT_VERIFIED',
      reason: pbReason, findings, blockingLimitations: limitations,
      boundaryEvidence: { S01: { verified: s01 }, S02: { verified: s02 } },
      product_writer_validation: pb?.product_writer_validation ?? 'PRODUCT_WRITER_NOT_VERIFIED',
    },
    remainingRequirements,
    blockers: [...remainingRequirements],
    owner_decision: disableDefaultPermitted
      ? 'All technical prerequisites verified; owner P5 instruction still required for any live change'
      : 'Blocked: ' + remainingRequirements.join('; '),
  }
}
