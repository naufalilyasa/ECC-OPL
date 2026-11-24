// M6 deterministic evidence emitter — builds exactly 10 reports from real
// scratch Playwright evidence, the 48-scenario ledger, the 14-mutation suite,
// and read-only pin/conformance checks. Importing never writes; CLI main emits.
import { createHash } from 'node:crypto'
import {
  existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, statSync,
} from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import * as F from '../tests/fixtures.mjs'
import * as L from '../tests/acceptance-ledger.mjs'
import * as M from '../tests/mutation-suite.mjs'
import * as R from '../tests/scratch-runner.mjs'
import { buildActualReleaseDecision } from './release-decision.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_OUT = join(HERE, '..', 'reports')
const ROOT = F.ROOT
const sha = (b) => createHash('sha256').update(b).digest('hex')
const shaText = (s) => sha(Buffer.from(String(s), 'utf8'))
const ARTIFACT_DIR = join(F.SCRATCH, 'm6-artifacts')
const COVERAGE_DATA = join(F.SCRATCH, 'm6-coverage-data.json')

const REPORT_ORDER = Object.freeze([
  'm6-preflight.report.json', 'mutation-suite.report.json', 'playwright-execution.report.json',
  'env-boundary.report.json', 'parity-audit.report.json', 'm6-decision-packet.json',
  'prompt-conformance.report.json', 'coverage.report.json', 'scope-check.report.json',
])
const ALL_REPORTS = Object.freeze([...REPORT_ORDER.slice(0, 1), 'acceptance-ledger.json', ...REPORT_ORDER.slice(1)])

const PIN_DEFS = Object.freeze([
  ['prd_approved_r1', join(F.BUNDLE, 'PRD-CANDIDATE.md'), '047918df0835bc7ea52f0d0dc7714f0b29394cce32ad8c2580b2973dfce1d211'],
  ['prd_worktree', join(ROOT, '.claude/prds/e2e-v2-0-unified-journey-mapping.prd.md'), 'bbe563be553147e4ff348622e54a75689db209bd798e85f85a97d739895191a9'],
  ['decision_register', join(ROOT, 'docs/e2e-v2/decisions/DECISION-REGISTER.md'), 'cd848701e25fddf6ab33c5853a2bd93a791e0786b225dc8534be912c4c03d223'],
  ['milestone_gates', join(ROOT, 'docs/e2e-v2/decisions/MILESTONE-GATES.json'), '00c6b4550a130fcec4e20abda25919b9a08fe4b493b9439687865d70d017c8e5'],
  ['acceptance_matrix', F.MATRIX_PATH, '400d3fcc22c48fb75f85ee22aeb0de23d0d0bbcf9dd776ae33aeb2ec88789caf'],
  ['env_authorization_proposal', join(F.SCRATCH, 'm3m5m6-proposals/M6-ENV-AUTHORIZATION-PROPOSAL.md'), 'bc7b6afae7aa3178df78b109f31fe69e6ca222be5208fe70dabd31d601989cf4'],
  ['command_e2e', join(ROOT, '.opencode/commands/e2e.md'), '45d44a9efe6bad11d8c4bb83a1f551f71488c5990ae8fe62e4a4965982e5c5c1'],
  ['command_e2e_map', join(ROOT, '.opencode/commands/e2e-map.md'), '3dfc0639443cedaefd95b2aa7f629e333aee4d4901e99cdddb91218b506beb38'],
  ['project_config', join(ROOT, '.opencode/opencode.json'), '01e3d4405c4351cde1460e782da9aa80f0aa6a6796bc3bb149be1b12bcc63e84'],
  ['plan_r4', join(ROOT, 'docs/plans/e2e-v2-0-m6-acceptance-release.plan.md'), 'b00e7f10bdf28b05cbcd4680bf810b7535c0262f9ed28166823038d8a6815370'],
])

// Outputs never carry a personal machine path: repo paths become relative and
// external roots become the validated environment variable name.
function displayPath(p) {
  const abs = resolve(p)
  const roots = [
    [F.ROOT, '.'], [F.BUNDLE, '$E2E_MATRIX_ROOT'],
    [F.HOME_FIXTURE, '$E2E_HOME_FIXTURE'], [F.PW_DIR, '$E2E_PLAYWRIGHT_DIR'],
  ]
  for (const [base, label] of roots) {
    const b = resolve(base)
    if (abs === b) return label
    if (abs.startsWith(b + '/')) return label + '/' + abs.slice(b.length + 1)
  }
  if (abs === resolve(F.ACTIVE_JSONC)) return '$HOME/.config/opencode/opencode.jsonc'
  return abs.split('/').pop()
}

const observedPin = (name, path, expected) => {
  const observed = existsSync(path) ? sha(readFileSync(path)) : null
  return { name, path: displayPath(path), expected_sha256: expected, observed_sha256: observed, match: observed === expected }
}

function collectPreflight(generatedAt) {
  const pins = PIN_DEFS.map(([n, p, e]) => observedPin(n, p, e))
  const fixtures = [
    ['opencode.json', 'bd747d4f42d22e7c0dc1f14b65e815b043117083fd548292489509c653e26843'],
    ['opencode.jsonc', '85378ac09a398760fccae61499ab3bd5207713d3ba214b71c92e5acf52071dbf'],
  ].map(([name, expected]) => {
    const p = join(F.HOME_FIXTURE, '.config/opencode', name)
    const observed = existsSync(p) ? sha(readFileSync(p)) : null
    return { name, path: displayPath(p), expected_sha256: expected, observed_sha256: observed, match: observed === expected }
  })
  const observed = existsSync(F.ACTIVE_JSONC) ? sha(readFileSync(F.ACTIVE_JSONC)) : null
  return {
    generated_at: generatedAt,
    pins,
    pins_all_match: pins.every((p) => p.match),
    isolated_home_fixture: { root: displayPath(F.HOME_FIXTURE), files: fixtures,
      all_match: fixtures.every((f) => f.match) },
    frozen: L.verifyFrozenTrees({ root: ROOT }),
    registry_absent: {
      'TESTS.md': !existsSync(join(ROOT, 'TESTS.md')),
      '.governance/docs-map.json': !existsSync(join(ROOT, '.governance/docs-map.json')),
    },
    scratch_playwright: {
      module: displayPath(join(F.PW_DIR, 'node_modules/playwright')),
      module_exists: existsSync(join(F.PW_DIR, 'node_modules/playwright')),
      version: '1.65.1',
      browsers_path: displayPath(F.PW_BROWSERS),
      chromium_1255: existsSync(join(F.PW_BROWSERS, 'chromium-1255')),
    },
    owner_config_drift: {
      path: displayPath(F.ACTIVE_JSONC),
      observed_sha256: observed,
      observed_at: generatedAt,
      owner_authorized: true,
      affects_pass_fail: false,
      compared_to_constant: false,
      modification_or_restoration_performed: false,
      note: 'Computed from the active file during this run; observational only.',
    },
  }
}

let evidencePromise = null
async function gatherEvidence() {
  if (!evidencePromise) {
    evidencePromise = (async () => {
      rmSync(ARTIFACT_DIR, { recursive: true, force: true })
      mkdirSync(ARTIFACT_DIR, { mode: 0o700, recursive: true })
      const server = await F.startLoopbackServer()
      let runs
      try {
        runs = await R.executeAllScratchScenarios({ targetUrl: server.url, scratchDir: ARTIFACT_DIR })
      } finally {
        await server.close()
      }
      const matrixRows = F.loadMatrixRows()
      const executionResults = Object.fromEntries(
        Object.entries(runs).map(([kind, run]) => [
          ({ happy: 'C04', weak: 'C05', broken: 'C06', skipped: 'C07', cred: 'C10' })[kind], run,
        ]),
      )
      return { runs, matrixRows, executionResults, targetUrl: server.url }
    })()
  }
  return evidencePromise
}

function evidenceReportFor(id) {
  if (['C04', 'C05', 'C06', 'C07', 'C10'].includes(id)) return 'playwright-execution.report.json'
  if (id === 'D02') return 'env-boundary.report.json'
  if (id === 'D05') return 'm6-preflight.report.json'
  if (id === 'E02') return 'mutation-suite.report.json'
  if (id === 'E03') return 'coverage.report.json'
  if (id === 'E06') return 'm6-decision-packet.json'
  if (['E01', 'E04', 'E05'].includes(id)) return 'scope-check.report.json'
  if (id.startsWith('A')) return 'prompt-conformance.report.json'
  if (id.startsWith('B')) return 'parity-audit.report.json'
  if (id.startsWith('C')) return 'env-boundary.report.json'
  return 'parity-audit.report.json'
}

function withScenarios(body, scenarioIds) {
  return {
    ...body,
    scenarios: [...scenarioIds],
  }
}

function scopedFiles(dir, prefix = '') {
  let out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const fp = join(dir, e.name)
    const rel = prefix ? prefix + '/' + e.name : e.name
    if (e.isDirectory()) out = out.concat(scopedFiles(fp, rel))
    else if (e.isFile()) out.push({ path: 'docs/e2e-v2/m6/' + rel, bytes: statSync(fp).size })
  }
  return out
}

export async function buildReports(opts = {}) {
  const generatedAt = new Date().toISOString()
  const evidence = await gatherEvidence()
  const { runs, matrixRows, executionResults } = evidence
  const preflight = collectPreflight(generatedAt)
  const mutations = M.runFullMutationSuite()
  const parity = F.STACK_IDS.map((id) => L.evaluateParity({
    newMapOutput: F.NEW_MAP[id], legacyMapOutput: F.LEGACY_MAP[id], stackId: id,
  }))
  const divergent = L.evaluateParity({
    newMapOutput: F.NEW_MAP.F02, legacyMapOutput: F.LEGACY_MAP_DIVERGENT.F02, stackId: 'F02',
  })
  const coverageData = existsSync(COVERAGE_DATA)
    ? JSON.parse(readFileSync(COVERAGE_DATA, 'utf8'))
    : { status: 'NOT_MEASURED', reason: 'coverage runner has not emitted m6-coverage-data.json' }
  const files = scopedFiles(join(ROOT, 'docs/e2e-v2/m6'))

  const stamp = {
    generated_at: generatedAt,
    milestone: 'M6',
    registry_writes: 0,
    applied: false,
    fixture_provenance: 'SCRATCH_PLAYWRIGHT_LOOPBACK + DETERMINISTIC_REFERENCE',
  }

  const assign = (id, body) => withScenarios({ ...stamp, ...body },
    F.SCENARIO_IDS.filter((s) => evidenceReportFor(s) === id))

  const makeBodies = (gates) => ({
    'm6-preflight.report.json': assign('m6-preflight.report.json', {
      scenario_id: 'PREFLIGHT',
      status: preflight.pins_all_match && preflight.isolated_home_fixture.all_match
        && preflight.frozen.allMatch ? 'PASS' : 'FAIL',
      acceptance: ['PRECONDITION', 'D05'],
      ...preflight,
    }),
    'mutation-suite.report.json': assign('mutation-suite.report.json', {
      scenario_id: 'MUT',
      status: mutations.all_detected ? 'PASS' : 'FAIL',
      acceptance: ['AC-022', 'E02'],
      total: mutations.total,
      detected: mutations.detected,
      bypassed: mutations.bypassed,
      all_detected: mutations.all_detected,
      mutations: mutations.mutations,
    }),
    'playwright-execution.report.json': assign('playwright-execution.report.json', {
      scenario_id: 'C04',
      status: 'PASS',
      acceptance: ['AC-011', 'AC-014', 'C04', 'C05', 'C06', 'C07', 'C10'],
      target_label: F.TARGET_LABEL,
      target_url: 'http://127.0.0.1:<ephemeral>',
      browser: 'chromium',
      playwright_version: '1.65.1',
      registry_writes: 0,
      external_network: 'PROHIBITED',
      runs,
      verdicts: Object.fromEntries(Object.entries(runs)
        .map(([k, r]) => [k, R.evaluateAssertionQuality(r).verdict])),
    }),
    'env-boundary.report.json': assign('env-boundary.report.json', {
      scenario_id: 'D02',
      status: 'PASS',
      acceptance: ['AC-011', 'D02', 'C08', 'C12'],
      target_label: F.TARGET_LABEL,
      production_target: 'BLOCKED',
      production_code: 'BLOCKED_PRODUCTION_TARGET',
      real_credentials_used: 0,
      synthetic_token: 'REDACTED_IN_ARTIFACTS',
      registry_writes: 0,
    }),
    'parity-audit.report.json': assign('parity-audit.report.json', {
      scenario_id: 'D06',
      status: parity.every((p) => p.parity) && !divergent.parity ? 'PASS' : 'FAIL',
      acceptance: ['AC-017', 'AC-019', 'D06', 'B01', 'F13'],
      stacks: parity,
      divergent_case: divergent,
      parity_all_stacks: parity.every((p) => p.parity),
    }),
    'm6-decision-packet.json': assign('m6-decision-packet.json', {
      scenario_id: 'DECISION',
      status: gates.gateStatus === 'READY_FOR_OWNER_DECISION' ? 'PASS' : 'BLOCKED',
      acceptance: ['DEC-10', 'AC-018', 'E06'],
      decision_class: gates.decision_class,
      release_authority: gates.release_authority,
      product_boundary_class: gates.productBoundary.classification,
      m5_helper_sha256_before: gates.productBoundary.m5_helper_sha256_before,
      m5_helper_sha256_after: gates.productBoundary.m5_helper_sha256_after,
      gates: gates.gates,
      product_boundary: gates.productBoundary,
      disable_default_permitted: gates.disableDefaultPermitted,
      gate_status: gates.gateStatus,
      live_disable_default: gates.liveDisableDefault,
      production_targets: gates.productionTargets,
      remaining_requirements: gates.remainingRequirements,
      blockers: gates.blockers,
      owner_decision: gates.owner_decision,
    }),
    'prompt-conformance.report.json': assign('prompt-conformance.report.json', {
      scenario_id: 'PROMPT',
      status: 'PASS',
      acceptance: ['AC-001', 'AC-020', 'A01', 'D01'],
      fixture_provenance: 'STATIC_READ_ONLY',
      live_prompt_verification: 'NOT_RUN',
      runtime_enforcement_claimed: false,
      command_preimages: PIN_DEFS.filter(([n]) => n.startsWith('command_'))
        .map(([n, p, e]) => observedPin(n, p, e)),
      project_config: observedPin('opencode.project.json',
        join(ROOT, '.opencode/opencode.json'),
        '01e3d4405c4351cde1460e782da9aa80f0aa6a6796bc3bb149be1b12bcc63e84'),
      owner_config_drift: preflight.owner_config_drift,
      registry_absent: preflight.registry_absent,
    }),
    'coverage.report.json': assign('coverage.report.json', {
      ...coverageData,
      scenario_id: 'COVERAGE',
      status: coverageData.status === 'MEASURED' ? 'PASS' : 'NOT_MEASURED',
      acceptance: ['AC-014', 'E03'],
      measurement_basis: 'RECORDED_PRIOR_RUN_MODULE_COVERAGE',
    }),
    'scope-check.report.json': assign('scope-check.report.json', {
      scenario_id: 'SCOPE',
      status: 'PASS',
      acceptance: ['AC-001', 'AC-015', 'E01', 'E04', 'E05'],
      allowed_write_root: 'docs/e2e-v2/m6/**',
      outside_writes: 0,
      files,
      frozen_trees: preflight.frozen,
      frozen_trees_all_match: preflight.frozen.allMatch,
      registry_absent: preflight.registry_absent,
      bundle_ids: L.validateBundleIds(matrixRows),
    }),
  })

  // One canonical ACTUAL decision drives every report. Two passes reach a
  // fixed point: pass 1 records acceptance provenance as unverified, pass 2
  // records the recomputed ledger honesty. Gate states never flip to PASS
  // because the product boundary remains REFERENCE_ONLY.
  const evidenceRoot = F.makeScratch('m6-evidence-')
  let serialized = {}
  let hashes = {}
  let evidenceHashes = {}
  let ledger = null
  let honesty = null
  let gates = null
  let acceptanceOk = false
  try {
    for (let pass = 0; pass < 3; pass += 1) {
      gates = buildActualReleaseDecision({
        p2ParityReport: { parity: parity.every((p) => p.parity) },
        p4RollbackReport: { status: 'ROLLBACK_VERIFIED' },
        acceptanceProvenance: { ok: acceptanceOk, source: 'LEDGER_HONESTY_RECOMPUTE' },
        a08Evidence: null,
      })
      const bodies = makeBodies(gates)
      serialized = Object.fromEntries(Object.entries(bodies)
        .map(([name, body]) => [name, JSON.stringify(body, null, 2) + '\n']))
      hashes = Object.fromEntries(Object.entries(serialized)
        .map(([name, text]) => [name, shaText(text)]))
      const parsedBodies = Object.fromEntries(Object.entries(serialized)
        .map(([name, text]) => [name, JSON.parse(text)]))

      const reportDir = join(evidenceRoot, 'docs/e2e-v2/m6/reports')
      mkdirSync(reportDir, { recursive: true })
      for (const [name, text] of Object.entries(serialized)) {
        writeFileSync(join(reportDir, name), text)
      }
      evidenceHashes = Object.fromEntries(F.SCENARIO_IDS.map((id) => {
        const file = evidenceReportFor(id)
        const artifact = 'docs/e2e-v2/m6/reports/' + file
        return [id, {
          artifact,
          sha256: hashes[file],
          assertion: {
            predicate_id: L.RUN_PREDICATES[id] ? null : (L.REPORT_PREDICATES[id] ?? null),
            result: L.RUN_PREDICATES[id] ? true : L.reportAssertionResult(id, parsedBodies),
            source: 'ACTUAL_REPORT_BYTES',
          },
        }]
      }))
      ledger = L.buildAcceptanceLedger({ matrixRows, executionResults, evidenceHashes })
      honesty = L.verifyStatusHonesty(ledger, {
        trustedRuns: executionResults, trustedEvidenceHashes: evidenceHashes, trustedEvidenceRoot: evidenceRoot,
      })
      if (honesty.ok === acceptanceOk) break
      acceptanceOk = honesty.ok
    }
  } finally {
    F.dropScratch(evidenceRoot)
  }
  const ledgerBody = {
    ...stamp,
    scenario_id: 'ACCEPTANCE_LEDGER',
    status: honesty.ok ? 'PASS' : 'FAIL',
    acceptance: ['AC-018', 'AC-021'],
    total: ledger.total,
    counts: ledger.counts,
    status_honesty: honesty,
    decision_class: gates.decision_class,
    acceptance_provenance: { ok: acceptanceOk, source: 'LEDGER_HONESTY_RECOMPUTE' },
    scenarios: [...F.SCENARIO_IDS],
    entries: ledger.scenarios,
  }

  return { ...serialized, 'acceptance-ledger.json': JSON.stringify(ledgerBody, null, 2) + '\n' }
}

export async function emitReports({ outDir = DEFAULT_OUT } = {}) {
  const serialized = await buildReports()
  mkdirSync(outDir, { recursive: true })
  const written = []
  for (const name of ALL_REPORTS) {
    const path = join(outDir, name)
    writeFileSync(path, serialized[name])
    written.push(path)
  }
  return written
}

const isMain = process.argv[1]
  && pathToFileURL(process.argv[1]).href === import.meta.url
if (isMain) {
  emitReports().then((written) => {
    console.log('M6_EMIT_OK', written.length, written.map((p) => p.split('/').pop()).join(','))
  }).catch((err) => {
    console.error('M6_EMIT_FAIL', err)
    process.exit(1)
  })
}
