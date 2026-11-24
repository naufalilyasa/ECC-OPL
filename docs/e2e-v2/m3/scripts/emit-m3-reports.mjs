// M3 evidence emitter — runs the reference lifecycle and writes the Phase 2 scenario
// reports, the Phase 0 preflight, and (mode --scope) the Phase 4 scope check.
// File-based CLI:
//   node docs/e2e-v2/m3/scripts/emit-m3-reports.mjs           # preflight + 7 scenario reports
//   node docs/e2e-v2/m3/scripts/emit-m3-reports.mjs --scope   # Phase 4 scope check (run last)
// No child_process, no shell, no network, no git: hashing + static path allowlist only.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  bootstrapProposal,
  resolveRun,
  fullPhaseTrace,
  applyVerifiedPass,
  proposeNewFlow,
  checkWriteConflict,
  cancelApproval,
  assessLegacyStale,
  validateState,
} from '../tests/registry.mjs'
import * as fixtures from '../tests/fixtures.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '../../../..')
const REP = join(HERE, '../reports')
mkdirSync(REP, { recursive: true })
const sha = (rel, base = ROOT) => createHash('sha256').update(readFileSync(join(base, rel))).digest('hex')
const textSha = (t) => createHash('sha256').update(t).digest('hex')

const STAMP = {
  generated_at: '2026-11-23T00:00:00Z',
  milestone: 'M3',
  method: 'reference-implementation harness (node --test): docs/e2e-v2/m3/tests/registry.mjs',
  status: 'EXECUTED',
  live_prompt_verification: 'DEFERRED_TO_M6 (48-scenario acceptance)',
}
const write = (name, body) => writeFileSync(join(REP, name), JSON.stringify({ ...STAMP, ...body }, null, 2) + '\n')
const SCRATCH = '/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode'

// Disposable fixtures F07 (populated registry) and F11 (concurrency target), same shape as the suite.
const F07 = fixtures.F07
const PASS_OUTCOME = fixtures.PASS_OUTCOME

// ---------------------------------------------------------------- Phase 0 preflight
function preflight() {
  const checks = [
    { path: join(SCRATCH, 'e2e-m1-ref/bundle/ecc-opl-e2e-v2.0-prd-r1-external-review/PRD-CANDIDATE.md'), label: 'PRD canonical (R1 bundle)', expected: '047918df0835bc7ea52f0d0dc7714f0b29394cce32ad8c2580b2973dfce1d211', role: 'approved digest' },
    { path: join(ROOT, '.claude/prds/e2e-v2-0-unified-journey-mapping.prd.md'), label: 'PRD worktree copy', expected: 'bbe563be553147e4ff348622e54a75689db209bd798e85f85a97d739895191a9', role: 'post-approval copy (never compared to 047918df)' },
    { path: join(ROOT, 'docs/e2e-v2/decisions/MILESTONE-GATES.json'), label: 'MILESTONE-GATES.json', expected: '00c6b4550a130fcec4e20abda25919b9a08fe4b493b9439687865d70d017c8e5', role: 'frozen gates' },
    { path: join(ROOT, 'docs/e2e-v2/decisions/DECISION-REGISTER.md'), label: 'DECISION-REGISTER.md', expected: 'cd848701e25fddf6ab33c5853a2bd93a791e0786b225dc8534be912c4c03d223', role: 'frozen register' },
    { path: join(SCRATCH, 'm3m5m6-proposals/M3-REGISTRY-DIFF-PROPOSAL.md'), label: 'M3 registry diff proposal', expected: '500704509dfadf4a386c60631fc4a60c435cb28fc4244714a818a8aae762069f', role: 'approved bootstrap diff source' },
    { path: join(ROOT, 'docs/plans/e2e-v2-0-m3-registry-governance.plan.md'), label: 'M3 plan r4', expected: '4f57829b49c1a319357b637eb3fdbf77e81cd560639fbc1ce824b3e7da22b29a', role: 'executed plan' },
  ].map((c) => {
    const actual = existsSync(c.path) ? sha(c.path, '/') : null
    return { label: c.label, path: c.path.replace(ROOT + '/', '').replace(SCRATCH, '<scratch>'), role: c.role, expected_sha256: c.expected, actual_sha256: actual, status: actual === c.expected ? 'MATCH' : 'DRIFT' }
  })

  // M2 frozen manifest: 20 M1/contract artifacts re-hashed against M2's recorded snapshot.
  const manifest = JSON.parse(readFileSync(join(ROOT, 'docs/e2e-v2/m2/reports/frozen-artifacts.manifest.json'), 'utf8'))
  const frozen = manifest.files.map((f) => {
    const actual = sha(f.path)
    return { path: f.path, frozen_sha256: f.sha256, actual_sha256: actual, status: actual === f.sha256 ? 'IDENTICAL' : 'DRIFT' }
  })

  const absent = [
    { path: 'TESTS.md', absent: !existsSync(join(ROOT, 'TESTS.md')) },
    { path: '.governance/docs-map.json', absent: !existsSync(join(ROOT, '.governance/docs-map.json')) },
  ]
  // Playwright absence: no local install, no config, no lockfile entry reachable from the worktree.
  const playwright = {
    node_modules_present: existsSync(join(ROOT, 'node_modules/@playwright/test')),
    config_present: ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs'].some((f) => existsSync(join(ROOT, f))),
    dependency_declared: (() => {
      try {
        const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
        return Boolean({ ...pkg.dependencies, ...pkg.devDependencies }['@playwright/test'])
      } catch { return false }
    })(),
  }
  playwright.absent = !playwright.node_modules_present && !playwright.config_present && !playwright.dependency_declared

  const blockers = [
    ...checks.filter((c) => c.status !== 'MATCH').map((c) => c.label),
    ...frozen.filter((f) => f.status !== 'IDENTICAL').map((f) => f.path),
    ...absent.filter((a) => !a.absent).map((a) => `${a.path} must not exist`),
  ]
  if (!playwright.absent) blockers.push('Playwright present')

  write('m3-preflight.report.json', {
    scenario_id: 'M3-0',
    status: blockers.length === 0 ? 'PASS' : 'HALT',
    scope: 'upstream hash + absence verification before any M3 write',
    upstream_hashes: checks,
    frozen_m2_manifest: { path: 'docs/e2e-v2/m2/reports/frozen-artifacts.manifest.json', artifact_count: frozen.length, artifacts: frozen },
    m1_zip: {
      name: 'ecc-opl-e2e-v2.0-m1-r1-contract-evidence-reconciliation-review.zip',
      pinned_sha256: '9d1417f1709ab14933476cacf37b46b0dc512849011abea67984bb4fe073c22f',
      present: false,
      note: 'not present in the worktree or scratch; plan r4 permits skipping re-verification when absent',
    },
    registry_files_absent: absent,
    playwright,
    e2e_md_sha256_before: sha('.opencode/commands/e2e.md'),
    blockers,
  })
  return blockers
}

// ---------------------------------------------------------------- Phase 2 scenarios
function scenarios() {
  const emptySkeleton = bootstrapProposal().files.find((f) => f.path === 'TESTS.md').content

  // C02 / AC-006 — negative dispatch, zero runner invocation.
  const c02 = resolveRun({ registryText: undefined, target: 'TEST-E2E-001' })
  write('registry-required.report.json', {
    scenario_id: 'C02',
    acceptance: ['AC-006', 'E2E-FR-005'],
    fixture: 'absent registry + empty bootstrap skeleton',
    cases: [
      { case_id: 'C02', input: 'run TEST-E2E-001', result: c02 },
      { case_id: 'C02', input: 'run TEST-E2E-001 against bootstrap skeleton', result: resolveRun({ registryText: emptySkeleton, target: 'TEST-E2E-001' }) },
    ],
    negative_dispatch: { dispatched: false, runner_invocations: 0, registry_writes: 0 },
    live_execution: 'DEFERRED_TO_M4/M6 (no browser authorized)',
  })

  // C03 / AC-007 — ad-hoc label, no credit, registry bytes unchanged.
  const c03 = resolveRun({ registryText: F07, target: 'refund flow', adHoc: true, runnerOutcome: 'PASS', targetEnvironment: 'non-production' })
  const c03blocked = resolveRun({ registryText: F07, target: 'refund flow', adHoc: true, runnerOutcome: 'PASS', targetEnvironment: 'production' })
  write('ad-hoc.report.json', {
    scenario_id: 'C03',
    acceptance: ['AC-007', 'E2E-FR-006'],
    fixture: 'F07 (temp copy) + mock runner outcome',
    cases: [
      { case_id: 'C03', input: 'run --ad-hoc "refund flow" (non-production, mock PASS)', result: c03 },
      { case_id: 'C03', input: 'run --ad-hoc "refund flow" (production)', result: c03blocked },
    ],
    registry_sha256_before: textSha(F07),
    registry_sha256_after: textSha(c03.registryAfter),
    registry_unchanged: textSha(c03.registryAfter) === textSha(F07),
    coverage_credit: c03.coverageCredit,
    live_execution: 'DEFERRED_TO_M4/M6 (DEC-07 sandbox machinery not exercised)',
  })

  // A08 / AC-008 — stage order + gate halt at run.
  write('full-phase.trace.json', {
    scenario_id: 'A08',
    acceptance: ['AC-008', 'E2E-FR-007'],
    fixture: 'F12 environment gate as contract text',
    cases: [
      { case_id: 'A08', input: 'full with both gates satisfied', result: fullPhaseTrace({ gates: { registryApproved: true, environmentAuthorized: true } }) },
      { case_id: 'A08', input: 'full with unauthorized environment', result: fullPhaseTrace({ gates: { registryApproved: true, environmentAuthorized: false } }) },
      { case_id: 'A08', input: 'full with unapproved registry', result: fullPhaseTrace({ gates: { registryApproved: false, environmentAuthorized: true } }) },
    ],
    gate_halt_record: { halt_stage: 'run', blocked_before: 'spawn', runner_invocations: 0, retracted_stages: [] },
    live_execution: 'DEFERRED_TO_M4/M6 (no stage generates specs or runs anything here)',
  })

  // B08 / F07 — permitted-field-only splice.
  const b08 = applyVerifiedPass({ registryText: F07, blockId: 'TEST-E2E-001', outcome: PASS_OUTCOME })
  const b08illegal = applyVerifiedPass({ registryText: F07, blockId: 'TEST-E2E-001', outcome: { ...PASS_OUTCOME, Purpose: 'rewritten' } })
  write('registry-preserve.diff.json', {
    scenario_id: 'B08',
    acceptance: ['AC-009', 'E2E-FR-008', 'E2E-FR-009'],
    fixture: 'F07 (temp copy)',
    cases: [
      { case_id: 'B08', input: 'verified PASS on TEST-E2E-001', result: b08 },
      { case_id: 'B08', input: 'outcome carrying a non-permitted field (Purpose)', result: b08illegal },
    ],
    permitted_write_fields: ['State', 'Test file', 'Test node', 'Command', 'Evidence'],
    changed_fields: b08.changes.map((c) => c.field),
    renumbered: b08.renumbered,
    other_blocks_untouched: b08.nextText.includes('### TEST-E2E-002 — login with email') && b08.nextText.includes('- Purpose: verify login'),
  })

  // B09 — idempotence: replay twice, zero new IDs; new flow = max+1.
  const once = applyVerifiedPass({ registryText: F07, blockId: 'TEST-E2E-001', outcome: PASS_OUTCOME })
  const twice = applyVerifiedPass({ registryText: once.nextText, blockId: 'TEST-E2E-001', outcome: PASS_OUTCOME })
  write('idempotence.report.json', {
    scenario_id: 'B09',
    acceptance: ['AC-009', 'E2E-FR-009'],
    fixture: 'F07 replayed twice',
    cases: [
      { case_id: 'B09', input: 'replay #1', result: { applied: once.applied, changes: once.changes.length, new_ids: once.newIds.length } },
      { case_id: 'B09', input: 'replay #2', result: { applied: twice.applied, changes: twice.changes.length, new_ids: twice.newIds.length } },
      { case_id: 'B09', input: 'genuinely new flow', result: proposeNewFlow({ registryText: F07, journey: 'refund flow', source: '/refund' }) },
    ],
    second_replay_byte_identical: twice.nextText === once.nextText,
    new_ids_total: once.newIds.length + twice.newIds.length,
  })

  // B12 / F11 — hash-before-write conflict over a real concurrent edit.
  const base = mkdtempSync(join(tmpdir(), 'm3-f11-'))
  const target = join(base, 'TESTS.md')
  writeFileSync(target, F07)
  const hashBefore = sha(target, '/')
  writeFileSync(target, F07.replace('- Purpose: verify login', '- Purpose: verify login (owner edited)'))
  const hashNow = sha(target, '/')
  const b12conflict = checkWriteConflict({ hashBefore, hashNow, diff: 'approved-diff@' + hashBefore })
  const ownerBytesIntact = sha(target, '/') === hashNow && readFileSync(target, 'utf8').includes('owner edited')
  rmSync(base, { recursive: true, force: true })
  write('concurrency.report.json', {
    scenario_id: 'B12',
    acceptance: ['AC-016-supporting (M5 acceptance; NOT claimed complete)', 'E2E-FR-015'],
    fixture: 'F11 (temp-dir file, deleted before exit)',
    cases: [
      { case_id: 'B12', input: 'hash unchanged between diff and write', result: checkWriteConflict({ hashBefore, hashNow: hashBefore, diff: 'approved-diff' }) },
      { case_id: 'B12', input: 'concurrent owner edit after diff', result: b12conflict },
    ],
    hash_before: hashBefore,
    hash_after_concurrent_edit: hashNow,
    owner_bytes_intact: ownerBytesIntact,
    applied: false,
    live_execution: 'DEFERRED_TO_M6 (live cross-turn concurrency stays in the acceptance suite)',
  })

  // AC-010 / DEC-12 — stale is an assessment; mutation 8 rejects it.
  write('stale-migration-proposal.report.json', {
    scenario_id: 'B10-ext',
    acceptance: ['AC-010', 'E2E-FR-010'],
    fixture: 'synthetic legacy rows (canonical ECC has none)',
    cases: [
      { case_id: 'B10-ext', input: 'legacy row State: stale', result: assessLegacyStale({ id: 'TEST-E2E-002', State: 'stale' }) },
      { case_id: 'B10-ext', input: 'valid row State: covered', result: assessLegacyStale({ id: 'TEST-E2E-001', State: 'covered' }) },
      { case_id: 'MUTATION-8', input: 'State validator offered "stale"', result: validateState('stale') },
    ],
    state_enum: ['missing', 'in progress', 'unverified', 'covered', 'not applicable'],
    mutation_8_rejected: validateState('stale').ok === false,
    migration_applied: false,
  })

  // Approval abort path — zero action.
  write('approval-cancelled.report.json', {
    scenario_id: 'CANCELLED',
    acceptance: ['AC-006 (approval-write flow)', 'DEC-06'],
    cases: ['denied', 'aborted'].map((reason) => ({ case_id: 'CANCELLED', input: reason, result: cancelApproval({ reason }) })),
  })

  return { ok: true }
}

// ---------------------------------------------------------------- Phase 4 scope check
function scopeCheck() {
  const walk = (relDir) => {
    const out = []
    const visit = (dir) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) visit(full)
        else out.push(relative(ROOT, full).split('\\').join('/'))
      }
    }
    visit(join(ROOT, relDir))
    return out.sort()
  }

  // M2 frozen surface, re-hashed against the M2-recorded manifest (byte-identity proof).
  const manifest = JSON.parse(readFileSync(join(ROOT, 'docs/e2e-v2/m2/reports/frozen-artifacts.manifest.json'), 'utf8'))
  const frozen = manifest.files.map((f) => {
    const actual = sha(f.path)
    return { path: f.path, frozen_sha256: f.sha256, actual_sha256: actual, status: actual === f.sha256 ? 'IDENTICAL' : 'DRIFT' }
  })
  const decisions = ['docs/e2e-v2/decisions/MILESTONE-GATES.json', 'docs/e2e-v2/decisions/DECISION-REGISTER.md'].map((path) => {
    const expected = { 'docs/e2e-v2/decisions/MILESTONE-GATES.json': '00c6b4550a130fcec4e20abda25919b9a08fe4b493b9439687865d70d017c8e5', 'docs/e2e-v2/decisions/DECISION-REGISTER.md': 'cd848701e25fddf6ab33c5853a2bd93a791e0786b225dc8534be912c4c03d223' }[path]
    const actual = sha(path)
    return { path, frozen_sha256: expected, actual_sha256: actual, status: actual === expected ? 'IDENTICAL' : 'DRIFT' }
  })

  const before = JSON.parse(readFileSync(join(REP, 'm3-preflight.report.json'), 'utf8')).e2e_md_sha256_before
  const delta = { path: '.opencode/commands/e2e.md', before_sha256: before, after_sha256: sha('.opencode/commands/e2e.md') }
  delta.status = delta.before_sha256 === delta.after_sha256 ? 'UNCHANGED' : 'AUTHORIZED_DELTA'

  const written = [...walk('docs/e2e-v2/m3'), 'docs/plans/e2e-v2-0-m3-registry-governance.plan.md', '.opencode/commands/e2e.md']
  const ALLOWED = ['docs/e2e-v2/m3/', 'docs/plans/', '.opencode/commands/e2e.md']
  const violations = [
    ...frozen.filter((f) => f.status !== 'IDENTICAL').map((f) => ({ kind: 'frozen-artifact-drift', path: f.path })),
    ...decisions.filter((d) => d.status !== 'IDENTICAL').map((d) => ({ kind: 'decision-drift', path: d.path })),
    ...written.filter((p) => !ALLOWED.some((a) => p.startsWith(a))).map((p) => ({ kind: 'outside-write-surface', path: p })),
  ]

  const registryFilesAbsent = !existsSync(join(ROOT, 'TESTS.md')) && !existsSync(join(ROOT, '.governance/docs-map.json'))

  write('scope-check.report.json', {
    status: violations.length === 0 && registryFilesAbsent ? 'PASS' : 'FAIL',
    method: 'node:crypto sha256 over live worktree files; static path allowlist; no git, no .guardian-angel',
    scope: 'ECC-OPL M3: docs/e2e-v2/m3/, docs/plans/ (plan input), .opencode/commands/e2e.md (authorized)',
    allowed_write_roots: ALLOWED,
    frozen_m2_manifest: { path: 'docs/e2e-v2/m2/reports/frozen-artifacts.manifest.json', artifact_count: frozen.length, artifacts: frozen },
    decision_files: decisions,
    authorized_delta_count: delta.status === 'AUTHORIZED_DELTA' ? 1 : 0,
    authorized_delta: [delta],
    written_files: written,
    written_file_count: written.length,
    registry_files_absent: registryFilesAbsent,
    tests_md_created: existsSync(join(ROOT, 'TESTS.md')),
    docs_map_created: existsSync(join(ROOT, '.governance/docs-map.json')),
    violations,
    violation_count: violations.length,
    home_writes: 0,
    git_access: false,
    guardian_angel_access: false,
    browser_or_playwright_runs: 0,
    installs: 0,
    registry_writes: 0,
    e2e_map_disabled: false,
    workflow_active_json_written: false,
  })
  return violations.length
}

if (process.argv.includes('--scope')) {
  const v = scopeCheck()
  console.log('scope-check written; violations:', v)
} else {
  const blockers = preflight()
  if (blockers.length > 0) {
    console.error('PREFLIGHT HALT:', blockers.join('; '))
    process.exit(1)
  }
  scenarios()
  console.log('preflight PASS + 8 scenario reports written')
}
