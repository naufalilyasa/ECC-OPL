// M5 evidence emitter — runs the reference harness over synthetic fixtures and
// writes only the listed M5 report paths (plus disposable scratch fixtures).
// No child_process, shell, network, browser, install, git or registry write.
// Importing this module never writes; only the CLI main guard emits to disk.
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync, symlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import * as M from '../tests/migration.mjs'
import * as F from '../tests/fixtures.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_OUT = join(HERE, '..', 'reports')
const ROOT = join(HERE, '../../../..')
const sha = (b) => createHash('sha256').update(b).digest('hex')
const SCRATCH = F.SCRATCH

const STAMP = Object.freeze({
  generated_at: '2026-11-23T00:00:00Z',
  milestone: 'M5',
  method: 'reference-implementation harness (node --test): docs/e2e-v2/m5/tests/migration.mjs',
  status: 'EXECUTED',
  fixture_provenance: 'SYNTHETIC_REFERENCE',
  live_prompt_verification: 'DEFERRED_TO_M6',
  live_playwright_execution: 'DEFERRED_TO_M6',
  registry_writes: 0,
  applied: false,
  note: 'Fixture observations only. No real browser, runner spawn, registry mutation, config change or CLI execution. Recorded commands are data, never executed.',
})

const EXPECTED_SCENARIO_IDS = Object.freeze({
  'm5-preflight.report.json': 'PREFLIGHT',
  'registry-block.diff.json': 'C12',
  'concurrency.report.json': 'B12',
  'registry-path.reject.json': 'B11',
  'symlink-escape.reject.json': 'D04',
  'parity.report.json': 'D06',
  'alias-no-run.trace.json': 'D07',
  'discovery-after-disable.report.json': 'D08',
  'restore-rehearsal.report.json': 'D10',
  'terminal-outcomes.report.json': 'AC-018',
  'flakiness.report.json': 'C09',
  'mutation-suite.report.json': 'MUT',
  'm5-decision-packet.json': 'DECISION',
})

const FROZEN_TREES = Object.freeze([
  ['m1', 'docs/e2e-v2/m1', 16, '8416c0671af8ae60850d9d72f249968976c907cf4aa62b605d663bd5eb1625ca'],
  ['m2', 'docs/e2e-v2/m2', 27, '2f81da73f2068357f4265a3cfbaf6a9435a3e502d52dcd32d33b3b445fc97588'],
  ['m3', 'docs/e2e-v2/m3', 17, '2e8c7cf63a44b3d073185be0a4fe59de87fd9583ffc79abc6066b151066e23c7'],
  ['m4', 'docs/e2e-v2/m4', 20, '88c50d13760dd24dd47b9e5f2a2d8aa707b0f008abcf19b06fa7370641bc7807'],
  ['contracts', 'docs/e2e-v2/contracts', 3, 'a550f29ea751c7635cdc5d73bbc2e6a0a29d7cdf7153e43f23e429a4f4e05e8c'],
])

function walk(dir) {
  let out = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const fp = join(dir, e.name)
    if (e.isDirectory()) out = out.concat(walk(fp))
    else if (e.isFile()) out.push(fp)
  }
  return out
}
function treeHash(dir) {
  const h = createHash('sha256')
  const files = walk(dir).sort()
  // Canonical encoding uses repo-relative paths, not absolute paths.
  for (const f of files) h.update(f.slice(ROOT.length + 1) + '\t' + sha(readFileSync(f)) + '\n')
  return { files: files.length, sha256: h.digest('hex') }
}
function collectPreflight() {
  const trees = FROZEN_TREES.map(([name, rel, count, expected]) => {
    const got = treeHash(join(ROOT, rel))
    return { name, expectedFiles: count, observedFiles: got.files, expectedSha256: expected, observedSha256: got.sha256, match: got.files === count && got.sha256 === expected }
  })
  return {
    frozen_trees: trees,
    frozen_trees_all_match: trees.every((t) => t.match),
    registry_absent: {
      'TESTS.md': !existsSync(join(ROOT, 'TESTS.md')),
      '.governance/docs-map.json': !existsSync(join(ROOT, '.governance/docs-map.json')),
    },
    scratch_root: SCRATCH,
    scratch_root_mode: existsSync(SCRATCH) ? (statSync(SCRATCH).mode & 0o777).toString(8) : 'ABSENT',
  }
}

function symlinkEscapeEvidence() {
  const base = F.makeScratch('m5-emit-sym-')
  try {
    const repoRoot = F.subDir(base, 'repo')
    const outside = F.subDir(base, 'outside')
    writeFileSync(join(outside, 'TESTS.md'), 'synthetic\n')
    symlinkSync(outside, join(repoRoot, F.F09_SYMLINK_NAME))
    return {
      rejected: M.checkRegistryPathSafety({ registryPath: `${F.F09_SYMLINK_NAME}/TESTS.md`, repoRoot }),
      traversal_rejects: F.F09_TRAVERSAL_PATHS.map((p) => ({
        path: p, result: M.checkRegistryPathSafety({ registryPath: p, repoRoot: ROOT }),
      })),
    }
  } finally {
    F.dropScratch(base)
  }
}

function rollbackEvidence() {
  const base = F.makeScratch('m5-emit-rb-')
  try {
    const sources = [
      ['opencode.project.json', join(ROOT, '.opencode/opencode.json')],
      ['opencode.global.json', join(process.env.HOME, '.config/opencode/opencode.json')],
      ['opencode.global.jsonc', join(process.env.HOME, '.config/opencode/opencode.jsonc')],
      ['command.e2e.md', join(ROOT, '.opencode/commands/e2e.md')],
      ['command.e2e-map.md', join(ROOT, '.opencode/commands/e2e-map.md')],
    ]
    const files = sources.map(([name, p]) => ({ name, bytes: readFileSync(p) }))
    return M.rehearseRollback({ files, scratchDir: base })
  } finally {
    F.dropScratch(base)
  }
}

export function buildReports(opts = {}) {
  const expected = opts.contractOverride?.expectedScenarioIds ?? EXPECTED_SCENARIO_IDS

  const preflight = collectPreflight()
  const update = M.applyFieldScopedUpdate({
    registryText: F.F07_REGISTRY_BEFORE, blockId: F.F07_BLOCK_A_ID, outcome: F.F07_OUTCOME_PERMITTED,
  })
  const illegal = M.applyFieldScopedUpdate({
    registryText: F.F07_REGISTRY_BEFORE, blockId: F.F07_BLOCK_A_ID, outcome: F.F07_OUTCOME_ILLEGAL,
  })
  const race = M.simulateConcurrentEdit({
    initialText: F.F07_REGISTRY_BEFORE, writerA: F.F11_WRITER_A, writerB: F.F11_WRITER_B,
    blockId: F.F07_BLOCK_A_ID,
  })
  const noConflict = M.checkWriteConflict({ hashBefore: 'same', hashNow: 'same', diff: 'd' })
  const sym = symlinkEscapeEvidence()
  const parityAll = F.F14_STACK_IDS.map((id) => M.evaluateParity({
    newMapOutput: F.F14_NEW_MAP[id], legacyMapOutput: F.F14_LEGACY_MAP[id], stackId: id,
  }))
  const parityDivergent = M.evaluateParity({
    newMapOutput: F.F14_NEW_MAP.F02, legacyMapOutput: F.F14_LEGACY_MAP_DIVERGENT.F02, stackId: 'F02',
  })
  const legacy = F.F13_LEGACY_SHORTHANDS.map((raw) => M.resolveLegacyShorthand({
    rawInput: raw, registryText: F.F07_REGISTRY_BEFORE,
  }))
  const discovery = M.checkDiscoveryAfterDisable({
    defaultDiscovery: F.F13_DEFAULT_DISCOVERY, postDisableDiscovery: F.F13_POST_DISABLE_DISCOVERY,
  })
  const rollback = rollbackEvidence()
  const terminal = F.TERMINAL_ENUM.map((raw) => M.mapTerminalOutcome({ raw, exitCode: 0, evidenceValid: true }))
  const fabricated = F.TERMINAL_FABRICATED.map((raw) => M.mapTerminalOutcome({ raw, exitCode: 0, evidenceValid: true }))
  const flaky = M.mapTerminalOutcome({
    raw: 'PASS', exitCode: 0, evidenceValid: true,
    retries: F.TERMINAL_FLAKY.retries, flaky: F.TERMINAL_FLAKY.flaky,
  })
  const mut13 = M.runMutation13()
  const mut14 = M.runMutation14()
  const gates = M.evaluateM5Gates({
    p1WinnerVerified: false,
    p2ParityReport: { parity: parityAll.every((p) => p.parity) },
    p3RegistrySafety: { ok: update.applied && !illegal.applied },
    p4RollbackReport: { status: rollback.status },
    p5OwnerAuth: false,
  })

  const reports = {
    'm5-preflight.report.json': {
      scenario_id: 'PREFLIGHT', acceptance: ['PRECONDITION'], fixture: 'PINS/FROZEN',
      ...preflight,
    },
    'registry-block.diff.json': {
      scenario_id: 'C12', acceptance: ['AC-015', 'E2E-FR-015', 'E05'], fixture: 'F07',
      update_result: update,
      non_permitted_rejection: illegal,
    },
    'concurrency.report.json': {
      scenario_id: 'B12', acceptance: ['AC-016', 'E2E-FR-016'], fixture: 'F11',
      two_writer_race: race,
      no_conflict_baseline: noConflict,
    },
    'registry-path.reject.json': {
      scenario_id: 'B11', acceptance: ['AC-016'], fixture: 'F09',
      traversal_rejects: sym.traversal_rejects,
    },
    'symlink-escape.reject.json': {
      scenario_id: 'D04', acceptance: ['AC-016', 'E2E-FR-016'], fixture: 'F09',
      symlink_escape: sym.rejected,
    },
    'parity.report.json': {
      scenario_id: 'D06', acceptance: ['AC-017', 'E2E-FR-017'], fixture: 'F14/F01-F06/F13',
      stacks: parityAll,
      divergent_case: parityDivergent,
      parity_all_stacks: parityAll.every((p) => p.parity),
    },
    'alias-no-run.trace.json': {
      scenario_id: 'D07', acceptance: ['AC-017', 'DEC-04'], fixture: 'F13',
      legacy_inputs: legacy,
      runner_invocations: legacy.reduce((n, r) => n + r.runnerInvocations, 0),
      coverage_credit: legacy.some((r) => r.coverageCredit),
    },
    'discovery-after-disable.report.json': {
      scenario_id: 'D08', acceptance: ['AC-017', 'DEC-10'], fixture: 'F13',
      discovery: discovery, execution: 'NOT_RUN',
    },
    'restore-rehearsal.report.json': {
      scenario_id: 'D10', acceptance: ['AC-018', 'E2E-FR-018', 'GATE-P4'], fixture: 'F14',
      rehearsal: rollback,
    },
    'terminal-outcomes.report.json': {
      scenario_id: 'AC-018', acceptance: ['AC-018', 'E2E-FR-018', 'D05', 'E06'], fixture: 'ENUM',
      canonical_enum: [...M.TERMINAL_OUTCOMES],
      mapped: terminal,
      fabricated_rejected: fabricated,
    },
    'flakiness.report.json': {
      scenario_id: 'C09', acceptance: ['AC-018', 'C09'], fixture: 'RETRY',
      mapped: flaky,
      folded_into_pass: flaky.retryFoldedIntoPass,
    },
    'mutation-suite.report.json': {
      scenario_id: 'MUT', acceptance: ['AC-016', 'AC-017', 'E02'], fixture: 'MUT13/MUT14',
      mutations: {
        13: { detected: mut13.detected, oracle_reason: mut13.oracleReason },
        14: { detected: mut14.detected, oracle_reason: mut14.oracleReason },
      },
    },
    'm5-decision-packet.json': {
      scenario_id: 'DECISION', acceptance: ['DEC-10', 'GATES-P1-P5'], fixture: 'NONE',
      gates: gates.gates,
      disable_default_permitted: gates.disableDefaultPermitted,
      gate_status: gates.gateStatus,
      remaining_requirements: gates.remainingRequirements,
      owner_decision: 'P1 probe + explicit P5 disable-default instruction required before any live change',
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
