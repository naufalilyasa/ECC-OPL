// M5 (ECC-OPL /e2e V2.0) — Migration & Rollback reference harness tests.
// Zero-dependency `node --test`. Synthetic fixtures only: no browser, runner
// spawn, network, install, registry write, active config mutation or real
// consent. Live criteria stay DEFERRED_TO_M6. Registry files must stay absent.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync, symlinkSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

import * as M from './migration.mjs'
import * as F from './fixtures.mjs'
import * as E from '../scripts/emit-m5-reports.mjs'

const sha = (b) => createHash('sha256').update(b).digest('hex')
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..')

function scratch(t, label) {
  const d = F.makeScratch(`m5-${label}-`)
  t.after(() => F.dropScratch(d))
  assert.equal((statSync(d).mode & 0o777), 0o700, 'scratch dir must be 0700')
  return d
}

// ============================================================================
// Group 1 — AC-015 / C12 / F07 / E05 : field-scoped registry update
// ============================================================================
test('AC-015: permitted fields update only the matched block; other block untouched', () => {
  const r = M.applyFieldScopedUpdate({
    registryText: F.F07_REGISTRY_BEFORE,
    blockId: F.F07_BLOCK_A_ID,
    outcome: F.F07_OUTCOME_PERMITTED,
  })
  assert.equal(r.applied, true)
  assert.equal(r.blockId, F.F07_BLOCK_A_ID)
  assert.equal(r.changes.length, 5)
  assert.equal(r.registry_writes, 0)
  assert.ok(r.nextText.includes('- State: covered'))
  assert.ok(r.nextText.includes(`- Test file: ${F.F07_OUTCOME_PERMITTED['Test file']}`))
  // Unmatched block B (header onward) remains byte-identical.
  const aAfter = r.nextText.slice(r.nextText.lastIndexOf(F.F07_BLOCK_B_ID))
  const aBefore = F.F07_REGISTRY_BEFORE.slice(F.F07_REGISTRY_BEFORE.lastIndexOf(F.F07_BLOCK_B_ID))
  assert.equal(aAfter, aBefore, 'block B must be byte-identical')
  // Non-write fields of the matched block survive.
  assert.ok(r.nextText.includes('- Purpose: verify checkout reaches confirmation'))
  assert.ok(r.nextText.includes('- Execution group: checkout'))
})

test('AC-015: before/after SHA recorded and diff is non-empty', () => {
  const r = M.applyFieldScopedUpdate({
    registryText: F.F07_REGISTRY_BEFORE, blockId: F.F07_BLOCK_A_ID, outcome: F.F07_OUTCOME_PERMITTED,
  })
  assert.equal(r.hashBefore, sha(F.F07_REGISTRY_BEFORE))
  assert.equal(r.hashAfter, sha(r.nextText))
  assert.notEqual(r.hashBefore, r.hashAfter)
  assert.ok(r.diff.includes('State'))
})

test('AC-015: non-permitted fields fail closed with FIELD-NOT-PERMITTED', () => {
  for (const outcome of [F.F07_OUTCOME_ILLEGAL, F.F07_OUTCOME_ILLEGAL_ONLY]) {
    const r = M.applyFieldScopedUpdate({
      registryText: F.F07_REGISTRY_BEFORE, blockId: F.F07_BLOCK_A_ID, outcome,
    })
    assert.equal(r.applied, false)
    assert.equal(r.code, 'FIELD-NOT-PERMITTED')
    assert.equal(r.nextText, F.F07_REGISTRY_BEFORE, 'registry unchanged on rejection')
    assert.equal(r.registry_writes, 0)
  }
})

test('AC-015: unmatched block id fails closed without touching text', () => {
  const r = M.applyFieldScopedUpdate({
    registryText: F.F07_REGISTRY_BEFORE, blockId: 'TEST-E2E-999', outcome: F.F07_OUTCOME_PERMITTED,
  })
  assert.equal(r.applied, false)
  assert.equal(r.code, 'NOT_FOUND')
  assert.equal(r.nextText, F.F07_REGISTRY_BEFORE)
})

test('AC-015: a permitted field absent from the block is inserted in-place', () => {
  const withoutEvidence = F.F07_REGISTRY_BEFORE
    .split('\n').filter((line) => !line.startsWith('- Evidence:')).join('\n')
  const r = M.applyFieldScopedUpdate({
    registryText: withoutEvidence, blockId: F.F07_BLOCK_A_ID,
    outcome: { Evidence: 'new evidence line' },
  })
  assert.equal(r.applied, true)
  assert.equal(r.changes.length, 1)
  assert.ok(r.nextText.includes('- Evidence: new evidence line'))
  assert.equal(r.nextText.split('- Evidence: new evidence line').length - 1, 1, 'inserted exactly once')
})

test('AC-015: real registry files remain absent after update evaluation', () => {
  M.applyFieldScopedUpdate({
    registryText: F.F07_REGISTRY_BEFORE, blockId: F.F07_BLOCK_A_ID, outcome: F.F07_OUTCOME_PERMITTED,
  })
  assert.equal(existsSync(join(ROOT, 'TESTS.md')), false)
  assert.equal(existsSync(join(ROOT, '.governance/docs-map.json')), false)
})

// ============================================================================
// Group 2 — AC-016 / B11 / B12 / D04 / mutation 13
// ============================================================================
test('B11: registry path traversal and absolute paths are rejected', () => {
  for (const p of F.F09_TRAVERSAL_PATHS) {
    const r = M.checkRegistryPathSafety({ registryPath: p, repoRoot: ROOT })
    assert.equal(r.allowed, false, `path ${JSON.stringify(p)} must be rejected`)
    assert.equal(r.code, 'PATH_REJECTED')
  }
})

test('B11: a contained relative registry path is allowed', () => {
  const r = M.checkRegistryPathSafety({ registryPath: 'docs/e2e-v2/m5/tests/fixtures.mjs', repoRoot: ROOT })
  assert.equal(r.allowed, true)
})

test('D04: a symlink component escaping the scoped root is rejected fail-closed', (t) => {
  const base = scratch(t, 'symlink')
  const repoRoot = F.subDir(base, 'repo')
  const outside = F.subDir(base, 'outside')
  writeFileSync(join(outside, 'TESTS.md'), 'synthetic\n')
  symlinkSync(outside, join(repoRoot, F.F09_SYMLINK_NAME))
  const r = M.checkRegistryPathSafety({ registryPath: `${F.F09_SYMLINK_NAME}/TESTS.md`, repoRoot })
  assert.equal(r.allowed, false)
  assert.equal(r.code, 'SYMLINK_ESCAPE')
})

test('B12: unchanged hash permits write; changed hash yields WRITE_CONFLICT + rebase', () => {
  const ok = M.checkWriteConflict({ hashBefore: 'abc', hashNow: 'abc', diff: 'd' })
  assert.equal(ok.outcome, 'WRITE_OK')
  assert.equal(ok.writePermitted, true)
  const bad = M.checkWriteConflict({ hashBefore: 'abc', hashNow: 'def', diff: 'd' })
  assert.equal(bad.outcome, 'WRITE_CONFLICT')
  assert.equal(bad.conflict, true)
  assert.equal(bad.writePermitted, false)
  assert.equal(bad.rebase.recomputeFrom, 'registry@def')
  assert.equal(bad.rebase.requiresApproval, true)
})

test('B12: two-writer race — writer A commits, writer B conflicts (non-clobber)', () => {
  const r = M.simulateConcurrentEdit({
    initialText: F.F07_REGISTRY_BEFORE, writerA: F.F11_WRITER_A, writerB: F.F11_WRITER_B,
    blockId: F.F07_BLOCK_A_ID,
  })
  assert.equal(r.writerA.applied, true)
  assert.equal(r.writerB.applied, false)
  assert.equal(r.writerB.outcome, 'WRITE_CONFLICT')
  assert.equal(r.conflictDetected, true)
  assert.equal(r.nonClobber, true)
  assert.ok(r.finalText.includes('writer-A verified'))
  assert.equal(r.finalText.includes('writer-B verified'), false)
})

test('MUT-13: concurrency oracle detects the overwrite-bypass clobber', () => {
  const r = M.runMutation13()
  assert.equal(r.mutation, 13)
  assert.equal(r.detected, true)
  assert.equal(r.observedClobber, true)
  assert.equal(r.expectedClobber, false)
})

// ============================================================================
// Group 3 — AC-017 / D06 / D07 / D08 / mutation 14
// ============================================================================
test('D06: parity holds for every benchmark stack F01–F06 + F13', () => {
  for (const id of F.F14_STACK_IDS) {
    const r = M.evaluateParity({
      newMapOutput: F.F14_NEW_MAP[id], legacyMapOutput: F.F14_LEGACY_MAP[id], stackId: id,
    })
    assert.equal(r.parity, true, `parity expected for ${id}`)
    assert.deepEqual(r.diffs, [])
  }
})

test('D06: a dropped route and flipped PARTIAL flag break parity', () => {
  const r = M.evaluateParity({
    newMapOutput: F.F14_NEW_MAP.F02, legacyMapOutput: F.F14_LEGACY_MAP_DIVERGENT.F02, stackId: 'F02',
  })
  assert.equal(r.parity, false)
  assert.ok(r.diffs.some((d) => d.category === 'routes'))
  assert.ok(r.diffs.some((d) => d.category === 'partial'))
})

test('D07: legacy /e2e <flow> emits deprecation hint with zero runner/coverage', () => {
  for (const raw of F.F13_LEGACY_SHORTHANDS) {
    const r = M.resolveLegacyShorthand({ rawInput: raw, registryText: F.F07_REGISTRY_BEFORE })
    assert.equal(r.outcome, 'LEGACY_SHORTHAND_DEPRECATED')
    assert.match(r.hint, /\/e2e run <flow> or \/e2e map/)
    assert.equal(r.runnerInvocations, 0)
    assert.equal(r.dispatched, false)
    assert.equal(r.coverageCredit, false)
  }
})

test('D07: canonical /e2e subcommands are not treated as deprecated shorthand', () => {
  for (const raw of F.F13_CANONICAL) {
    const r = M.resolveLegacyShorthand({ rawInput: raw, registryText: F.F07_REGISTRY_BEFORE })
    assert.equal(r.outcome, 'CANONICAL_COMMAND')
    assert.equal(r.dispatched, false)
    assert.equal(r.coverageCredit, false)
  }
})

test('D08: simulated post-disable discovery leaves /e2e as sole default', () => {
  const r = M.checkDiscoveryAfterDisable({
    defaultDiscovery: F.F13_DEFAULT_DISCOVERY,
    postDisableDiscovery: F.F13_POST_DISABLE_DISCOVERY,
  })
  assert.equal(r.singleDefault, true)
  assert.equal(r.legacyRemoved, true)
  assert.equal(r.defaults[0], '/e2e')
})

test('MUT-14: premature disable-default is detected by the gate oracle', () => {
  const r = M.runMutation14()
  assert.equal(r.mutation, 14)
  assert.equal(r.detected, true)
  assert.equal(r.gateStatus, 'BLOCKED_PREMATURE_DISABLE')
})

// ============================================================================
// Group 4 — AC-018 / C09 / D05 / E06 : terminal outcome enum
// ============================================================================
test('E06: canonical terminal enum membership is exact', () => {
  assert.deepEqual([...M.TERMINAL_OUTCOMES], [...F.TERMINAL_ENUM])
  for (const v of F.TERMINAL_ENUM) {
    const r = M.mapTerminalOutcome({ raw: v, exitCode: 0, evidenceValid: true })
    assert.equal(r.outcome, v)
    assert.equal(r.allowed, true)
  }
})

test('E06: fabricated narrative passes are rejected and downgraded', () => {
  for (const raw of F.TERMINAL_FABRICATED) {
    const r = M.mapTerminalOutcome({ raw, exitCode: 0, evidenceValid: true })
    assert.equal(r.allowed, false)
    assert.equal(r.fabricatedPass, true)
    assert.equal(r.outcome, 'UNVERIFIED')
  }
})

test('C09: retries/flakiness are isolated in the retry field, never folded into PASS', () => {
  const r = M.mapTerminalOutcome({
    raw: 'PASS', exitCode: 0, evidenceValid: true,
    retries: F.TERMINAL_FLAKY.retries, flaky: F.TERMINAL_FLAKY.flaky,
  })
  assert.equal(r.outcome, 'PASS')
  assert.deepEqual(r.retry, { retries: 2, flaky: true })
  assert.equal(r.retryFoldedIntoPass, false)
})

test('C09: an unknown raw outcome maps to UNVERIFIED, never a fabricated pass', () => {
  const r = M.mapTerminalOutcome({ raw: 'MAYBE', exitCode: 0, evidenceValid: true })
  assert.equal(r.outcome, 'UNVERIFIED')
  assert.equal(r.allowed, false)
})

// ============================================================================
// Group 5 — Gate P4 / D10 / F14 : rollback rehearsal in 0700 scratch
// ============================================================================
test('D10: rollback rehearsal verifies all 5 file hashes with zero active writes', (t) => {
  const base = scratch(t, 'rollback')
  const sources = [
    ['opencode.project.json', join(ROOT, '.opencode/opencode.json')],
    ['opencode.global.json', join(process.env.HOME, '.config/opencode/opencode.json')],
    ['opencode.global.jsonc', join(process.env.HOME, '.config/opencode/opencode.jsonc')],
    ['command.e2e.md', join(ROOT, '.opencode/commands/e2e.md')],
    ['command.e2e-map.md', join(ROOT, '.opencode/commands/e2e-map.md')],
  ]
  const files = sources.map(([name, p]) => ({ name, bytes: readFileSync(p) }))
  assert.deepEqual(files.map((f) => f.name), [...F.ROLLBACK_TARGET_NAMES])
  const r = M.rehearseRollback({ files, scratchDir: base })
  assert.equal(r.status, 'ROLLBACK_VERIFIED')
  assert.equal(r.verifiedFiles, 5)
  assert.equal(r.activeTreeWrites, 0)
  assert.equal(r.fixtureChangedDuringRehearsal, true)
  for (const row of r.files) assert.equal(row.matched, true)
})

test('D10: a byte mismatch after restore yields ROLLBACK_FAILED', (t) => {
  const base = scratch(t, 'rollback-fail')
  const files = F.ROLLBACK_TARGET_NAMES.map((name) => ({ name, bytes: Buffer.from('synthetic-' + name) }))
  const r = M.rehearseRollback({ files, scratchDir: base, corruptRestore: true })
  assert.equal(r.status, 'ROLLBACK_FAILED')
  assert.equal(r.totalFiles, 5)
  assert.equal(r.verifiedFiles, 4, 'four of five hashes match; the corrupted one fails')
  assert.ok(r.files.some((row) => row.matched === false))
})

// ============================================================================
// Group 6 — Gate P1/P5 honesty + decision packet
// ============================================================================
test('DEC-10: P1 NOT_VERIFIED + P5 NOT_GIVEN blocks live disable-default', () => {
  const r = M.evaluateM5Gates({
    p1WinnerVerified: false,
    p2ParityReport: { parity: true },
    p3RegistrySafety: { ok: true },
    p4RollbackReport: { status: 'ROLLBACK_VERIFIED' },
    p5OwnerAuth: false,
  })
  assert.equal(r.gates.P1.status, 'NOT_VERIFIED')
  assert.equal(r.gates.P5.status, 'NOT_GIVEN')
  assert.equal(r.gates.P2.status, 'VERIFIED_IN_M5_REFERENCE')
  assert.equal(r.gates.P3.status, 'VERIFIED_IN_M5_REFERENCE')
  assert.equal(r.gates.P4.status, 'VERIFIED_IN_M5_REFERENCE')
  assert.equal(r.disableDefaultPermitted, false)
  assert.equal(r.gateStatus, 'BLOCKED_DEPLOYMENT_GATED')
  assert.ok(r.remainingRequirements.length >= 2)
})

// ============================================================================
// Phase 3 — emitter contract
// ============================================================================
test('EMIT: all 13 scenario/gate reports build with scenario ids and deferred labels', () => {
  const reports = E.buildReports()
  const names = Object.keys(reports)
  assert.equal(names.length, 13)
  const expectedIds = {
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
  }
  for (const [name, body] of Object.entries(reports)) {
    assert.equal(body.scenario_id, expectedIds[name], `scenario id for ${name}`)
    assert.equal(body.milestone, 'M5')
    assert.equal(body.status, 'EXECUTED')
    assert.equal(body.fixture_provenance, 'SYNTHETIC_REFERENCE')
    assert.equal(body.live_prompt_verification, 'DEFERRED_TO_M6')
    assert.equal(body.live_playwright_execution, 'DEFERRED_TO_M6')
    assert.equal(body.registry_writes, 0)
    assert.equal(body.applied, false)
    assert.ok(typeof body.generated_at === 'string')
  }
})

test('EMIT: emitter writes exactly 13 files into a supplied outDir', (t) => {
  const base = scratch(t, 'emit')
  const out = join(base, 'reports')
  const written = E.emitReports({ outDir: out })
  assert.equal(written.length, 13)
  assert.equal(readdirSync(out).length, 13)
  for (const p of written) assert.equal(JSON.parse(readFileSync(p, 'utf8')).milestone, 'M5')
})
