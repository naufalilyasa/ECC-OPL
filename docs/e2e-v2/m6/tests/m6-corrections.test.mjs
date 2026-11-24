// M6 final corrections — focused RED/GREEN regressions for H01–H03, G01–G02, T01–T03.
// These tests encode the NEW fail-closed contract and are run BEFORE the fix to
// capture RED. No dependency on browser or external ZIPs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync, readFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as L from './acceptance-ledger.mjs'
import * as F from './fixtures.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const M6 = join(HERE, '..')
const sha = (s) => createHash('sha256').update(String(s)).digest('hex')
const rows = F.loadMatrixRows()

const baseRuns = () => ({
  C04: { kind: 'happy', exitCode: 0, status: 'PASS', assertionKind: 'behavioral', testCount: 1, skipped: false, covered: false },
  C05: { kind: 'weak', exitCode: 0, status: 'PASS', assertionKind: 'visibility-only', testCount: 1, skipped: false, covered: false },
  C06: { kind: 'broken', exitCode: 1, status: 'FAIL', assertionKind: 'behavioral', testCount: 1, skipped: false, covered: false },
  C07: { kind: 'skipped', exitCode: 0, status: 'PASS', assertionKind: 'none', testCount: 0, skipped: true, covered: false },
  C10: { kind: 'cred', exitCode: 0, status: 'PASS', assertionKind: 'behavioral', testCount: 1, skipped: false, covered: false, redactionsCount: 1 },
})

function scratch() {
  const root = mkdtempSync(join(tmpdir(), 'm6-corrections-'))
  return { root, done: () => rmSync(root, { recursive: true, force: true }) }
}
function evidenceFor(root, artifactOf = (id) => `stubs/${id}.txt`) {
  mkdirSync(join(root, 'stubs'), { recursive: true })
  const map = {}
  for (const id of F.SCENARIO_IDS) {
    const artifact = artifactOf(id)
    const bytes = 'stub:' + id
    writeFileSync(join(root, artifact), bytes)
    map[id] = {
      artifact,
      sha256: sha(bytes),
      assertion: { predicate_id: L.REPORT_PREDICATES?.[id] ?? null, result: true, source: 'test-trusted-stub' },
    }
  }
  return map
}
const ledgerFor = (runs, ev) => L.buildAcceptanceLedger({ matrixRows: rows, executionResults: runs, evidenceHashes: ev })
const scenario = (l, id) => l.scenarios.find((s) => s.scenario_id === id)

// ---------------------------------------------------------------- H01 / H02 / H03
test('CORR-01: deterministic PASS without trusted inputs is NOT certified', () => {
  const t = scratch()
  try {
    const ev = evidenceFor(t.root)
    const l = ledgerFor(baseRuns(), ev)
    const honest = L.verifyStatusHonesty(l)
    assert.equal(honest.ok, false)
    assert.equal(honest.acceptance_satisfied, false)
    assert.ok(honest.unearned.some((x) => String(x).includes('trusted')))
  } finally { t.done() }
})

test('CORR-02: missing exact covered=false cannot back a forged PASS', () => {
  const t = scratch()
  try {
    const ev = evidenceFor(t.root)
    const runs = baseRuns()
    delete runs.C04.covered // omitted coverage result is NOT proof of denial
    const l = ledgerFor(runs, ev)
    scenario(l, 'C04').status = 'PASS'
    scenario(l, 'C04').scenario_assertion_result = 'MATCH'
    scenario(l, 'C04').coverage_credit = false
    const honest = L.verifyStatusHonesty(l, {
      trustedRuns: runs, trustedEvidenceHashes: ev, trustedEvidenceRoot: t.root,
    })
    assert.equal(honest.ok, false)
    assert.ok(honest.unearned.some((x) => String(x).includes('C04')), JSON.stringify(honest.unearned))
  } finally { t.done() }
})

test('CORR-03: observed_run target_label/kind/test_count/skipped are compared to trusted run', () => {
  const t = scratch()
  try {
    const ev = evidenceFor(t.root)
    const runs = baseRuns()
    const l = ledgerFor(runs, ev)
    const s = scenario(l, 'C04')
    s.observed_run.target_label = 'FORGED_TARGET'
    s.observed_run.kind = 'FORGED_KIND'
    s.observed_run.test_count = 99
    s.observed_run.skipped = true
    s.executed_evidence.run_status = 'FORGED_STATUS'
    const honest = L.verifyStatusHonesty(l, {
      trustedRuns: runs, trustedEvidenceHashes: ev, trustedEvidenceRoot: t.root,
    })
    assert.equal(honest.ok, false)
    for (const field of ['target_label', 'kind', 'test_count', 'skipped', 'status']) {
      assert.ok(honest.unearned.some((x) => String(x).includes(field)), `missing ${field}: ${JSON.stringify(honest.unearned)}`)
    }
  } finally { t.done() }
})

test('CORR-04: symlink evidence path is rejected despite lexical containment', () => {
  const t = scratch()
  try {
    const outside = mkdtempSync(join(tmpdir(), 'm6-corrections-out-'))
    try {
      const real = join(t.root, 'real'); mkdirSync(real, { recursive: true })
      const bytes = 'trusted-bytes'
      writeFileSync(join(outside, 'evidence.txt'), bytes)
      symlinkSync(outside, join(t.root, 'link'))
      const ev = { D05: { artifact: 'link/evidence.txt', sha256: sha(bytes),
        assertion: { predicate_id: L.REPORT_PREDICATES?.D05, result: true, source: 'test' } } }
      const l = ledgerFor(baseRuns(), ev)
      const honest = L.verifyStatusHonesty(l, {
        trustedRuns: baseRuns(), trustedEvidenceHashes: ev, trustedEvidenceRoot: t.root,
      })
      assert.equal(honest.ok, false)
      assert.ok(honest.unearned.some((x) => /SYMLINK|UNSAFE|ESCAPE/.test(String(x))), JSON.stringify(honest.unearned))
    } finally { rmSync(outside, { recursive: true, force: true }) }
  } finally { t.done() }
})

test('CORR-05: circular self-hash evidence artifact is rejected', () => {
  const t = scratch()
  try {
    const bytes = 'ledger-bytes'
    const artifact = 'docs/e2e-v2/m6/reports/acceptance-ledger.json'
    mkdirSync(join(t.root, dirname(artifact)), { recursive: true })
    writeFileSync(join(t.root, artifact), bytes)
    const ev = { D05: { artifact, sha256: sha(bytes),
      assertion: { predicate_id: L.REPORT_PREDICATES?.D05, result: true, source: 'test' } } }
    const l = ledgerFor(baseRuns(), ev)
    const honest = L.verifyStatusHonesty(l, {
      trustedRuns: baseRuns(), trustedEvidenceHashes: ev, trustedEvidenceRoot: t.root,
    })
    assert.equal(honest.ok, false)
    assert.ok(honest.unearned.some((x) => String(x).includes('circular')), JSON.stringify(honest.unearned))
  } finally { t.done() }
})

test('CORR-06: A08 cannot be promoted to REFERENCE_VERIFIED without live receipt', () => {
  const t = scratch()
  try {
    const ev = evidenceFor(t.root)
    const l = ledgerFor(baseRuns(), ev)
    scenario(l, 'A08').status = 'REFERENCE_VERIFIED'
    scenario(l, 'A08').evidence_sha256 = ev.A08.sha256
    const honest = L.verifyStatusHonesty(l, {
      trustedRuns: baseRuns(), trustedEvidenceHashes: ev, trustedEvidenceRoot: t.root,
    })
    assert.equal(honest.ok, false)
    assert.ok(honest.misplaced.some((x) => String(x).includes('A08')), JSON.stringify(honest.misplaced))
  } finally { t.done() }
})

test('CORR-07: exact 48 IDs (duplicate / unknown / missing) detected', () => {
  const t = scratch()
  try {
    const ev = evidenceFor(t.root)
    const l = ledgerFor(baseRuns(), ev)
    l.scenarios.push({ ...scenario(l, 'A01') })
    const dup = L.verifyStatusHonesty(l, {
      trustedRuns: baseRuns(), trustedEvidenceHashes: ev, trustedEvidenceRoot: t.root,
    })
    assert.equal(dup.ok, false)
    const l2 = ledgerFor(baseRuns(), ev)
    l2.scenarios.pop()
    const missing = L.verifyStatusHonesty(l2, {
      trustedRuns: baseRuns(), trustedEvidenceHashes: ev, trustedEvidenceRoot: t.root,
    })
    assert.equal(missing.ok, false)
  } finally { t.done() }
})

// ---------------------------------------------------------------- G01 / G02
const greenGates = {
  p1WinnerVerified: true,
  p2ParityReport: { parity: true },
  p3RegistrySafety: { ok: true },
  p4RollbackReport: { status: 'ROLLBACK_VERIFIED' },
  p5OwnerAuth: true,
  acceptanceProvenance: { ok: true },
  a08Evidence: { status: 'VERIFIED' },
}
const actualBoundary = {
  status: 'PASS', blocker: false, classification: 'ACTUAL_PRODUCT_BOUNDARY',
  boundaryEvidence: { S01: { verified: true }, S02: { verified: true } },
  findings: [], blockingLimitations: [],
}

test('CORR-08: REFERENCE_ONLY PASS cannot unlock P3 or disable-default', () => {
  const g = L.evaluateM6Gates({ ...greenGates, productBoundary: { ...actualBoundary, classification: 'REFERENCE_ONLY' } })
  assert.notEqual(g.gates.P3.status, 'VERIFIED')
  assert.equal(g.disableDefaultPermitted, false)
})

test('CORR-09: blocked decision never has an empty blocker list', () => {
  const g = L.evaluateM6Gates({ ...greenGates }) // no productBoundary at all
  assert.equal(g.disableDefaultPermitted, false)
  assert.ok(g.remainingRequirements.length > 0)
  assert.ok(g.blockers.length > 0)
})

test('CORR-10: remainingRequirements enumerates every unsatisfied gate and finding', () => {
  const g = L.evaluateM6Gates({
    p1WinnerVerified: false, p2ParityReport: null, p3RegistrySafety: null,
    p4RollbackReport: null, p5OwnerAuth: false,
    productBoundary: { status: 'FAIL', blocker: true, findings: ['FIND-X', 'FIND-Y'] },
    acceptanceProvenance: { ok: false },
  })
  const text = g.remainingRequirements.join(' | ')
  for (const token of ['P1', 'P2', 'P3', 'P4', 'P5', 'A08', 'FIND-X', 'FIND-Y', 'ACCEPTANCE', 'AUTH', 'ROLLBACK']) {
    assert.ok(text.includes(token), `missing ${token}: ${text}`)
  }
})

// ---------------------------------------------------------------- T01 / T02 portability
test('CORR-11: emitters contain no unconditional success branch', () => {
  for (const file of ['emit-r11-evidence.mjs', 'emit-m6-reports.mjs', 'emit-r1-evidence.mjs']) {
    const text = readFileSync(join(M6, 'scripts', file), 'utf8')
    assert.doesNotMatch(text, /=\s*\(\)\s*=>\s*true/, `${file}: ()=>true`)
    assert.doesNotMatch(text, /\breturn\s+true\s*\b/, `${file}: return true`)
    assert.doesNotMatch(text, /hash\.length\s*===\s*64/, `${file}: digest-shape fallback`)
  }
})

test('CORR-12: no hardcoded personal absolute paths in M6 code', () => {
  for (const dir of ['scripts', 'tests']) {
    for (const f of readdirSyncSafe(join(M6, dir))) {
      if (!f.endsWith('.mjs')) continue
      const text = readFileSync(join(M6, dir, f), 'utf8')
      assert.doesNotMatch(text, /\/Users\/|\/private\/var\//, `${dir}/${f}`)
    }
  }
})
function readdirSyncSafe(dir) { const { readdirSync } = requireFs(); return readdirSync(dir) }
function requireFs() { return { readdirSync: fsReaddir } }
import { readdirSync as fsReaddir } from 'node:fs'

// ---------------------------------------------------------------- M5 amended frozen tree
test('CORR-13: M5 frozen tree records amendment without erasing historical digest', () => {
  const v = L.verifyFrozenTrees({ root: F.ROOT })
  const m5 = v.trees.find((t) => t.name === 'm5')
  assert.equal(m5.historical_expected_sha256, '267c3b8bce980c97cadfc54b815fb79190d9a8f9f6951cb29ae92839dbf7b014')
  assert.equal(m5.match, true)
  assert.equal(m5.amendment?.after_sha256, '341c555e67a69064e22aefe6669553f282e9c6a374b11f7457fe6eab977c0a1b')
})
