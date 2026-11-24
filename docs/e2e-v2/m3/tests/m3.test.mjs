// M3 (ECC-OPL /e2e V2.0) — registry governance reference-implementation harness.
// Zero-dependency `node --test`. Every case carries its frozen matrix ID
// (C02, C03, A08, B08, B09, B12, B10-ext, mutation 8) so reports trace 1:1.
// Run: node --test docs/e2e-v2/m3/tests/
// Live prompt behaviour is NOT claimed here: live_prompt_verification: DEFERRED_TO_M6.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const registry = await import('./registry.mjs')
const { F07, PASS_OUTCOME } = await import('./fixtures.mjs')

const sha256 = (text) => createHash('sha256').update(text).digest('hex')

function disposable(t, label) {
  const base = mkdtempSync(join(tmpdir(), `m3-${label}-`))
  t.after(() => rmSync(base, { recursive: true, force: true }))
  return base
}

// =====================================================================================
// DEC-06 bootstrap proposal — byte fidelity against the owner-approved exact diff
// =====================================================================================
test('BOOTSTRAP: emits the owner-approved two-file diff byte-identically and writes nothing', () => {
  const p = registry.bootstrapProposal()
  assert.equal(p.caseId, 'BOOTSTRAP')
  assert.equal(
    sha256(p.diff),
    'f233af0a0f03736312440907c1eaef5ba5172ccbe5a47dd4242fea22f4880067',
    'BOOTSTRAP: diff must be the approved constant transcribed verbatim from proposal §3',
  )
  assert.deepEqual(p.writes, [], 'BOOTSTRAP: the proposal writes nothing')
  assert.deepEqual(p.files.map((f) => f.path), ['TESTS.md', '.governance/docs-map.json'], 'BOOTSTRAP: exactly two files')
  assert.ok(p.files.every((f) => f.action === 'create'), 'BOOTSTRAP: both are creations')
})

test('BOOTSTRAP: skeleton is empty — headers/comments only, no fabricated test ID', () => {
  const { files } = registry.bootstrapProposal()
  const tests = files.find((f) => f.path === 'TESTS.md').content
  assert.match(tests, /^# E2E Test Registry \(ECC-OPL\)$/m, 'TESTS.md: title line')
  assert.match(tests, /^## Section 2 — Journey index$/m, 'TESTS.md: Section 2 header')
  assert.match(tests, /^\| ID \| Journey \| Source \| Level \| Execution group \| State \|$/m, 'TESTS.md: journey-index table header')
  assert.match(tests, /^## Section 4 — Test blocks$/m, 'TESTS.md: Section 4 header')
  assert.doesNotMatch(tests, /TEST-E2E-\d{3}/, 'TESTS.md: no test ID is fabricated by the bootstrap')

  const map = JSON.parse(files.find((f) => f.path === '.governance/docs-map.json').content)
  assert.equal(map.schema, 'ecc-opl.e2e-docs-map/v1', 'docs-map: schema')
  assert.equal(map.registry, 'TESTS.md', 'docs-map: registry target')
  assert.deepEqual(map.journeys, [], 'docs-map: journeys empty')
  assert.match(map.note, /approved map\/run outcomes/i, 'docs-map: note names the approval path')
})

// =====================================================================================
// C02 / AC-006 — REGISTRY_REQUIRED, negative dispatch
// =====================================================================================
test('C02: run against an absent registry returns REGISTRY_REQUIRED and dispatches nothing', () => {
  const r = registry.resolveRun({ registryText: undefined, target: 'TEST-E2E-001' })
  assert.equal(r.caseId, 'C02')
  assert.equal(r.outcome, 'REGISTRY_REQUIRED')
  assert.equal(r.dispatched, false, 'C02: no runner invocation')
  assert.equal(r.runnerInvocations, 0, 'C02: zero runner invocations')
  assert.equal(r.registryChanged, false, 'C02: registry untouched')
  assert.match(r.next, /\/e2e-map/, 'C02: points at the map phase')
})

test('C02: run against an empty skeleton registry is also REGISTRY_REQUIRED', () => {
  const empty = registry.bootstrapProposal().files.find((f) => f.path === 'TESTS.md').content
  const r = registry.resolveRun({ registryText: empty, target: 'TEST-E2E-001' })
  assert.equal(r.outcome, 'REGISTRY_REQUIRED')
  assert.equal(r.dispatched, false)
  assert.equal(r.registryChanged, false)
})

// =====================================================================================
// C03 / AC-007 — ad-hoc labeling, no coverage credit, registry unchanged
// =====================================================================================
test('C03: ad-hoc PASS on an unregistered flow is PASS_AD_HOC_UNREGISTERED with no registry credit', () => {
  const r = registry.resolveRun({
    registryText: F07,
    target: 'refund flow',
    adHoc: true,
    runnerOutcome: 'PASS',
    targetEnvironment: 'non-production',
  })
  assert.equal(r.caseId, 'C03')
  assert.equal(r.outcome, 'PASS_AD_HOC_UNREGISTERED')
  assert.equal(r.coverageCredit, false, 'C03: ad-hoc earns no coverage credit')
  assert.equal(r.registryChanged, false, 'C03: registry never touched')
  assert.equal(r.registryAfter, F07, 'C03: registry text is byte-identical after the ad-hoc run')
})

test('C03: an ad-hoc request against a production target is BLOCKED under DEC-07', () => {
  const r = registry.resolveRun({
    registryText: F07,
    target: 'refund flow',
    adHoc: true,
    runnerOutcome: 'PASS',
    targetEnvironment: 'production',
  })
  assert.equal(r.outcome, 'BLOCKED')
  assert.equal(r.dispatched, false, 'C03: production ad-hoc dispatches nothing')
  assert.equal(r.registryChanged, false)
})

// =====================================================================================
// A08 / AC-008 — full-phase ordering, no skipped stage, gate halts before dispatch
// =====================================================================================
test('A08: full walks the six stages in order with no skipped stage', () => {
  const r = registry.fullPhaseTrace({ gates: { registryApproved: true, environmentAuthorized: true } })
  assert.equal(r.caseId, 'A08')
  assert.deepEqual(r.stages, ['discovery', 'review', 'registry', 'generate', 'run', 'evidence'], 'A08: frozen stage order')
  assert.deepEqual(r.completed, r.stages, 'A08: every stage completed')
  assert.deepEqual(r.skipped, [], 'A08: zero skipped stages')
  assert.equal(r.haltedAt, null)
  assert.equal(r.outcome, 'COMPLETE')
  assert.equal(r.dispatched, true)
})

test('A08: an unauthorized environment gate halts as BLOCKED before the run/dispatch stage', () => {
  const r = registry.fullPhaseTrace({ gates: { registryApproved: true, environmentAuthorized: false } })
  assert.equal(r.outcome, 'BLOCKED')
  assert.equal(r.haltedAt, 'run', 'A08: the environment gate sits at run')
  assert.equal(r.dispatched, false, 'A08: no runner invocation')
  assert.deepEqual(r.completed, ['discovery', 'review', 'registry', 'generate'], 'A08: generation before the gate is not retracted')
  assert.ok(!r.completed.includes('run'), 'A08: run never completed')
  assert.ok(!r.completed.includes('evidence'), 'A08: evidence never reached')
  assert.deepEqual(r.skipped, [], 'A08: stages were halted, not skipped')
})

// =====================================================================================
// B08 / F07 — permitted-field-only splice, zero renumber
// =====================================================================================
test('B08: a verified pass changes only the 5 permitted fields on the matched block', () => {
  const r = registry.applyVerifiedPass({ registryText: F07, blockId: 'TEST-E2E-001', outcome: PASS_OUTCOME })
  assert.equal(r.caseId, 'B08')
  assert.equal(r.applied, true)
  assert.equal(r.renumbered, 0, 'B08: zero renumbering')
  assert.deepEqual(
    r.changes.map((c) => c.field).sort(),
    ['Command', 'Evidence', 'State', 'Test file', 'Test node'],
    'B08: exactly the permitted fields changed',
  )

  const before = F07.split('\n')
  const after = r.nextText.split('\n')
  assert.equal(after.length, before.length, 'B08: no line added or removed (field lines only replaced)')
  const changed = []
  before.forEach((line, i) => { if (line !== after[i]) changed.push(line) })
  assert.equal(changed.length, r.changes.length, 'B08: the changed-line count equals the recorded change count')
  assert.match(r.nextText, /^### TEST-E2E-002 — login with email$/m, 'B08: the second block is untouched')
  assert.match(r.nextText, /^- Purpose: verify checkout completes$/m, 'B08: Purpose is untouched')
  assert.match(r.nextText, /^- Boundary: fixtures\/checkout$/m, 'B08: Boundary is untouched')
  assert.match(r.nextText, /^- State: covered$/m, 'B08: State is the outcome value')
})

test('B08: a non-permitted field in an outcome is rejected, nothing applied', () => {
  const r = registry.applyVerifiedPass({
    registryText: F07,
    blockId: 'TEST-E2E-001',
    outcome: { State: 'covered', Purpose: 'rewritten purpose' },
  })
  assert.equal(r.applied, false)
  assert.equal(r.code, 'FIELD-NOT-PERMITTED')
  assert.equal(r.nextText, F07, 'B08: the registry text is unchanged')
})

// =====================================================================================
// ID ownership — max+1, 001 base, reserved IDs never reused, malformed rows rejected
// =====================================================================================
test('ID allocation: empty registry starts at 001', () => {
  assert.equal(registry.allocateId([]).nextId, 'TEST-E2E-001')
})

test('ID allocation: existing max 014 yields 015', () => {
  assert.equal(registry.allocateId(['TEST-E2E-003', 'TEST-E2E-014']).nextId, 'TEST-E2E-015')
})

test('ID allocation: a reserved/removed ID is never reused', () => {
  const r = registry.allocateId(['TEST-E2E-014'], { reserved: ['TEST-E2E-015'] })
  assert.equal(r.nextId, 'TEST-E2E-016', 'ID-ALLOC: skips the reserved 015')
  assert.equal(registry.allocateId(['TEST-E2E-014'], { reserved: ['TEST-E2E-015', 'TEST-E2E-016'] }).nextId, 'TEST-E2E-017')
})

test('ID allocation: a malformed ID row is rejected, not normalised', () => {
  assert.throws(() => registry.allocateId(['TEST-E2E-14']), /malformed/i, 'ID-ALLOC: non-NNN ID rejected')
  assert.throws(() => registry.allocateId(['E2E-001']), /malformed/i)
})

// =====================================================================================
// Match order — exact ID first; title similarity alone never authorises an edit
// =====================================================================================
test('match order: an exact ID wins over a title match', () => {
  const m = registry.matchBlock(F07, { id: 'TEST-E2E-002', title: 'checkout to confirmation' })
  assert.equal(m.via, 'id')
  assert.equal(m.authorized, true)
  assert.equal(m.block.id, 'TEST-E2E-002')
})

test('match order: a title-only match never authorises a destructive edit', () => {
  const m = registry.matchBlock(F07, { title: 'login with email' })
  assert.equal(m.via, 'title')
  assert.equal(m.authorized, false, 'MATCH: title similarity alone is insufficient')
  const r = registry.applyVerifiedPass({ registryText: F07, outcome: PASS_OUTCOME, query: { title: 'login with email' } })
  assert.equal(r.applied, false)
  assert.equal(r.code, 'TITLE_ONLY_NOT_AUTHORIZED')
})

// =====================================================================================
// B09 — idempotence: replay twice yields zero new IDs
// =====================================================================================
test('B09: applying the same verified pass twice is idempotent', () => {
  const once = registry.applyVerifiedPass({ registryText: F07, blockId: 'TEST-E2E-001', outcome: PASS_OUTCOME })
  const twice = registry.applyVerifiedPass({ registryText: once.nextText, blockId: 'TEST-E2E-001', outcome: PASS_OUTCOME })
  assert.equal(twice.applied, true)
  assert.deepEqual(twice.changes, [], 'B09: the second replay changes nothing')
  assert.equal(twice.nextText, once.nextText, 'B09: byte-identical')
  assert.equal(twice.newIds.length, 0, 'B09: zero new IDs')
})

test('B09: a genuinely new flow gets exactly actual-max + 1', () => {
  const r = registry.proposeNewFlow({ registryText: F07, journey: 'refund flow', source: '/refund' })
  assert.equal(r.caseId, 'B09')
  assert.equal(r.id, 'TEST-E2E-003', 'B09: max(001,002) + 1')
  assert.equal(r.writes, 0, 'B09: a proposal, not a write')
  assert.equal(r.requiresApproval, true)
})

// =====================================================================================
// B12 / F11 — hash-before-write conflict, rebase, no clobber
// =====================================================================================
test('B12: unchanged registry between diff and write permits the write', () => {
  const h = sha256(F07)
  const r = registry.checkWriteConflict({ hashBefore: h, hashNow: h, diff: 'stub-diff' })
  assert.equal(r.caseId, 'B12')
  assert.equal(r.outcome, 'WRITE_OK')
  assert.equal(r.conflict, false)
  assert.equal(r.writePermitted, true)
})

test('B12: a concurrent registry change yields WRITE_CONFLICT + rebase, owner bytes intact', (t) => {
  const base = disposable(t, 'f11')
  const file = join(base, 'TESTS.md')
  writeFileSync(file, F07)

  const approvedText = readFileSync(file, 'utf8')
  const hashBefore = sha256(approvedText)

  // A real concurrent owner edit lands after the diff was computed.
  const ownerEdit = F07.replace('- Purpose: verify login', '- Purpose: verify login (owner edited)')
  writeFileSync(file, ownerEdit)
  const hashNow = sha256(readFileSync(file, 'utf8'))
  assert.notEqual(hashNow, hashBefore, 'B12: the fixture really changed')

  const r = registry.checkWriteConflict({ hashBefore, hashNow, diff: 'stale-diff' })
  assert.equal(r.outcome, 'WRITE_CONFLICT')
  assert.equal(r.conflict, true)
  assert.equal(r.writePermitted, false, 'B12: no last-writer-wins')
  assert.equal(r.rebaseRequired, true, 'B12: a rebase is required')
  assert.equal(r.reapprovalRequired, true, 'B12: the rebased diff needs re-approval')
  assert.match(r.rebase.recomputeFrom, new RegExp(hashNow), 'B12: the rebase anchors on the current bytes')
  assert.equal(r.applied, false, 'B12: nothing was written')

  // Owner bytes are exactly what the concurrent writer left — never the stale diff.
  assert.equal(sha256(readFileSync(file, 'utf8')), hashNow, 'B12: owner bytes intact after the conflict')
  assert.match(readFileSync(file, 'utf8'), /owner edited/, 'B12: the owner edit survives')
})

// =====================================================================================
// CANCELLED — approval denied/aborted, zero action
// =====================================================================================
test('CANCELLED: a denied or aborted approval performs zero unauthorised action', () => {
  for (const reason of ['denied', 'aborted']) {
    const r = registry.cancelApproval({ reason })
    assert.equal(r.caseId, 'CANCELLED')
    assert.equal(r.outcome, 'CANCELLED')
    assert.equal(r.action, 'none')
    assert.equal(r.registryChanged, false)
    assert.equal(r.writePermitted, false)
  }
})

// =====================================================================================
// AC-010 / B10-ext + mutation 8 — stale is an assessment, never a State
// =====================================================================================
test('B10-ext: a legacy State: stale row is a schema mismatch with a DEC-12 migration proposal', () => {
  const r = registry.assessLegacyStale({ id: 'TEST-E2E-002', State: 'stale' })
  assert.equal(r.caseId, 'B10-ext')
  assert.equal(r.ok, false, 'B10-ext: the row is not accepted as-is')
  assert.equal(r.code, 'B10')
  assert.equal(r.schemaMismatch, true)
  assert.equal(r.assessment, 'stale', 'B10-ext: stale survives as an assessment')
  assert.equal(r.applied, false, 'B10-ext: nothing is migrated')
  assert.deepEqual(r.proposal, { decision: 'DEC-12', field: 'State', from: 'stale', to: 'unverified' }, 'B10-ext: proposal names a valid target State')
})

test('mutation 8: State: stale is rejected by the State validator, never accepted as an enum value', () => {
  assert.deepEqual(registry.STATE_ENUM, ['missing', 'in progress', 'unverified', 'covered', 'not applicable'], 'MUT8: exactly the 5 controlled values')
  assert.equal(registry.STATE_ENUM.includes('stale'), false, 'MUT8: stale is not in the enum')
  const v = registry.validateState('stale')
  assert.equal(v.ok, false, 'MUT8: stale is rejected')
  assert.equal(v.code, 'STATE-INVALID')
  assert.equal(registry.validateState('covered').ok, true)
})

test('AC-010: valid rows pass the stale assessor with no proposal and no write', () => {
  const r = registry.assessLegacyStale({ id: 'TEST-E2E-001', State: 'covered' })
  assert.equal(r.ok, true)
  assert.equal(r.applied, false)
  assert.equal(r.proposal, null)
})
