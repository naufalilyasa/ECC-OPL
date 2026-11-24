// Focused product-boundary regression for confirmed defects (RT13–RT27).
// Calls the actual product tool; synthetic evidence is a validator fixture,
// never proof of a real Playwright run.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(process.env.E2E_REPO_ROOT ?? join(HERE, '../../../..'))
const TOOL = resolve(process.env.E2E_PRODUCT_REGISTRY_TOOL ?? join(ROOT, '.opencode/scripts/e2e-registry.mjs'))
const SCRATCH_BASE = process.env.E2E_SCRATCH_ROOT ?? join(tmpdir(), 'opencode')
const sha = (s) => createHash('sha256').update(Buffer.from(String(s), 'utf8')).digest('hex')
const SPEC_TEXT = 'module.exports = () => 1\n'
const SPEC_SHA = sha(SPEC_TEXT)
const NODE = 'checkout flow > confirms'
const COMMAND = 'node tests/checkout.spec.cjs'
const auth = (op, digest) => ({ decision: 'DEC-06', approved_by: 'Owner', operation: op, approved_diff_sha256: digest })

function fx(withRegistry = true, state = 'missing') {
  const dir = mkdtempSync(join(SCRATCH_BASE, 'product-fc-'))
  const repo = join(dir, 'repo'); mkdirSync(repo, { mode: 0o700, recursive: true })
  mkdirSync(join(repo, 'tests'), { recursive: true }); writeFileSync(join(repo, 'tests/checkout.spec.cjs'), SPEC_TEXT)
  const reg = `# TESTS\n\n### TEST-E2E-001 — checkout flow\n- Purpose: checkout\n- State: ${state}\n- Test file: tests/checkout.spec.cjs\n- Test file sha256: ${SPEC_SHA}\n- Test node: ${NODE}\n- Representative input: cart\n- Observable expectation: confirmation\n- Boundary: local non-production\n`
  if (withRegistry) writeFileSync(join(repo, 'TESTS.md'), reg)
  return { dir, repo, file: join(repo, 'TESTS.md'), reg }
}
function run(op, body) {
  const req = join(body.repoRoot ?? body.evidenceRoot ?? dirname(HERE), `req-${Math.random().toString(16).slice(2)}.json`)
  writeFileSync(req, JSON.stringify(body))
  const r = spawnSync(process.execPath, [TOOL, op, req], { encoding: 'utf8', timeout: 20000 })
  let data = null; try { data = JSON.parse(r.stdout) } catch {}
  return { status: r.status, stdout: r.stdout, data }
}
function evidence(dir, overrides = {}) {
  const spec = NODE
  const baseRun = { executionMethod: 'real_playwright_scratch', targetLabel: 'E2E_NONPROD_LOCAL_FIXTURE',
    status: 'PASS', exitCode: 0, assertionKind: 'behavioral', testCount: 1, skipped: false }
  const run = { ...baseRun, ...(overrides.runs?.happy ?? {}) }
  const assertion = run.skipped || run.testCount === 0 ? 'none' : run.assertionKind
  const reporter = ['# PLAYWRIGHT REPORTER', 'status: ' + run.status, 'exit_code: ' + run.exitCode,
    'assertion: ' + assertion, 'test_count: ' + run.testCount, 'skipped: ' + Boolean(run.skipped),
    'test_id: TEST-E2E-001', 'command: ' + COMMAND].join('\n') + '\n'
  const art = 'evidence.txt'; writeFileSync(join(dir, art), reporter)
  const { runs: _ignoredRuns, ...restOverrides } = overrides
  const body = { scenario_id: 'C04', acceptance: ['C04'], spec: 'tests/checkout.spec.cjs', spec_sha256: SPEC_SHA,
    test_node: NODE, command: COMMAND, test_id: 'TEST-E2E-001',
    runs: { happy: { executionMethod: 'real_playwright_scratch', targetLabel: 'E2E_NONPROD_LOCAL_FIXTURE',
      status: 'PASS', exitCode: 0, assertionKind: 'behavioral', testCount: 1, skipped: false,
      artifacts: [{ path: art, bytes: Buffer.byteLength(reporter), sha256: sha(reporter) }] } }, ...restOverrides }
  const bytes = JSON.stringify(body)
  const path = join(dir, 'playwright-evidence.json'); writeFileSync(path, bytes)
  return { path, sha: sha(bytes), specSha: sha(spec), node: spec }
}
function proposeReconcile(f, ev, state = 'covered') {
  // Use the product's own reconciliation proposal so the approved diff is the
  // exact diff that reconcile will recompute from verified evidence.
  return run('reconcile-propose', { repoRoot: f.repo, registryPath: 'TESTS.md', blockId: 'TEST-E2E-001',
    baseSha256: sha(f.reg), evidenceRoot: f.dir, evidencePath: 'playwright-evidence.json',
    evidenceSha256: ev.sha, runKey: 'happy' })
}
function reconcile(f, ev, p, overrides = {}) {
  return run('reconcile', { repoRoot: f.repo, registryPath: 'TESTS.md', blockId: 'TEST-E2E-001',
    baseSha256: sha(f.reg), approvedDiffSha256: p.data.approved_diff_sha256,
    authorization: auth('reconcile', p.data.approved_diff_sha256),
    evidenceRoot: f.dir, evidencePath: 'playwright-evidence.json', evidenceSha256: ev.sha,
    specPath: 'tests/checkout.spec.cjs', specSha256: ev.specSha, testNode: ev.node, ...overrides })
}

test('RT13 fabricated evidence SHA is rejected and registry unchanged', () => {
  const f = fx(); const ev = evidence(f.dir)
  const p = proposeReconcile(f, ev)
  const r = reconcile(f, ev, p, { evidenceSha256: sha('fabricated') })
  assert.notEqual(r.status, 0); assert.match(r.stdout, /EVIDENCE_SHA_MISMATCH/)
  assert.equal(readFileSync(f.file, 'utf8'), f.reg)
})

test('RT14 missing evidence file is rejected', () => {
  const f = fx(); const p = run('propose', { repoRoot: f.repo, registryPath: 'TESTS.md', blockId: 'TEST-E2E-001', outcome: { State: 'covered', Evidence: 'x' } })
  const r = reconcile(f, { sha: sha('x'), specSha: sha('x'), node: 'x' }, p, { evidencePath: 'missing.json', evidenceSha256: sha('x') })
  assert.notEqual(r.status, 0); assert.match(r.stdout, /EVIDENCE_FILE_MISSING/)
})

test('RT15 mismatched TEST-ID is rejected', () => {
  const f = fx(); const ev = evidence(f.dir, { test_id: 'TEST-E2E-999' })
  const p = proposeReconcile(f, ev)
  const r = reconcile(f, ev, p)
  assert.notEqual(r.status, 0); assert.match(r.stdout, /TEST_ID_MISMATCH/)
})

test('RT16 missing/invalid DEC-06 authorization is rejected, not silently passed', () => {
  const f = fx(); const ev = evidence(f.dir); const p = proposeReconcile(f, ev)
  for (const a of [undefined, { decision: 'SELF_APPROVED' }, { decision: 'DEC-06', approved_by: 'Owner', operation: 'apply', approved_diff_sha256: p.data.approved_diff_sha256 }]) {
    const r = reconcile(f, ev, p, { authorization: a })
    assert.notEqual(r.status, 0); assert.match(r.stdout, /DEC06_APPROVAL_REQUIRED/)
  }
  assert.equal(readFileSync(f.file, 'utf8'), f.reg)
})

test('RT17 empty-project bootstrap writes both approved files', () => {
  const f = fx(false)
  const bad = run('bootstrap', { repoRoot: f.repo, registryPath: 'TESTS.md', approvedDiffSha256: sha('wrong') })
  assert.notEqual(bad.status, 0); assert.match(bad.stdout, /APPROVAL_MISMATCH/)
  assert.equal(existsSync(f.file), false)
  const p = run('bootstrap-propose', { repoRoot: f.repo, registryPath: 'TESTS.md' })
  assert.equal(p.status, 0, p.stdout)
  const r = run('bootstrap', { repoRoot: f.repo, registryPath: 'TESTS.md', approvedDiffSha256: p.data.approved_diff_sha256,
    authorization: auth('bootstrap', p.data.approved_diff_sha256) })
  assert.equal(r.status, 0, r.stdout)
  assert.ok(existsSync(f.file))
  assert.ok(existsSync(join(f.repo, '.governance/docs-map.json')))
  assert.equal(r.data.registry_writes, 2)
})

test('RT18 append journey with approved diff and stable ID', () => {
  const f = fx()
  const p = run('propose-append', { repoRoot: f.repo, registryPath: 'TESTS.md',
    journey: { title: 'search', purpose: 'search', representativeInput: 'q', observableExpectation: 'results', boundary: 'local' } })
  assert.equal(p.status, 0, p.stdout)
  const r = run('append', { repoRoot: f.repo, registryPath: 'TESTS.md', baseSha256: sha(f.reg),
    approvedDiffSha256: p.data.approved_diff_sha256, authorization: auth('append', p.data.approved_diff_sha256),
    journey: { title: 'search', purpose: 'search', representativeInput: 'q', observableExpectation: 'results', boundary: 'local' } })
  assert.equal(r.status, 0, r.stdout)
  assert.equal(r.data.test_id, 'TEST-E2E-002')
  assert.ok(readFileSync(f.file, 'utf8').includes('TEST-E2E-002'))
})

test('RT19 stable ID allocation does not reuse existing IDs', () => {
  const f = fx()
  const r = run('allocate', { repoRoot: f.repo, registryPath: 'TESTS.md', reserved: ['TEST-E2E-002'] })
  assert.equal(r.status, 0)
  assert.equal(r.data.test_id, 'TEST-E2E-003')
})

test('RT20 synthetic evidence is a validator fixture, not actual Playwright proof', () => {
  const f = fx(); const ev = evidence(f.dir); const p = proposeReconcile(f, ev)
  const r = reconcile(f, ev, p)
  assert.equal(r.status, 0, r.stdout)
  assert.equal(r.data.outcome.State, 'covered')
  assert.equal(r.data.coverage_credit, true)
  assert.equal(r.data.evidence.code, 'VERIFIED') // validator verdict only
  // This fixture is synthetic; it must not be presented as a browser run.
  assert.ok(!r.data.runner_completion_receipt)
})

test('RT21 skipped/failed execution never gains coverage and covered can be downgraded', () => {
  for (const shape of [
    { status: 'PASS', exitCode: 0, assertionKind: 'none', testCount: 0, skipped: true },
    { status: 'FAIL', exitCode: 1, assertionKind: 'behavioral', testCount: 1, skipped: false },
  ]) {
    const f = fx(true, 'covered'); const ev = evidence(f.dir, { runs: { happy: { executionMethod: 'real_playwright_scratch',
      targetLabel: 'E2E_NONPROD_LOCAL_FIXTURE', ...shape } } })
    const p = proposeReconcile(f, ev, 'unverified')
    const r = reconcile(f, ev, p)
    assert.equal(r.status, 0, r.stdout)
    assert.equal(r.data.outcome.State, 'unverified')
    assert.equal(r.data.coverage_credit, false)
    assert.equal(r.data.evidence.eligible, false)
    assert.ok(readFileSync(f.file, 'utf8').includes('- State: unverified'))
  }
})

test('RT22 tool uses shipped runtime deps, not docs/tests', () => {
  const s = readFileSync(TOOL, 'utf8')
  assert.ok(!s.includes('docs/e2e-v2'))
  assert.ok(s.includes('./e2e-runtime/registry.mjs'))
  assert.ok(existsSync(join(ROOT, '.opencode/resources/e2e-journey-mapper.md')))
})

test('RT23 legacy wrapper has no independent write instructions', () => {
  const s = readFileSync(join(ROOT, '.opencode/commands/e2e-map.md'), 'utf8')
  assert.match(s, /compatibility wrapper/i)
  assert.match(s, /\/e2e map/)
})

test('RT24 generic apply cannot set State covered', () => {
  const f = fx()
  const p = run('propose', { repoRoot: f.repo, registryPath: 'TESTS.md', blockId: 'TEST-E2E-001', outcome: { State: 'covered', Evidence: 'x' } })
  const r = run('apply', { repoRoot: f.repo, registryPath: 'TESTS.md', blockId: 'TEST-E2E-001', baseSha256: sha(f.reg),
    approvedDiffSha256: p.data.approved_diff_sha256, authorization: auth('apply', p.data.approved_diff_sha256), outcome: { State: 'covered', Evidence: 'x' } })
  assert.notEqual(r.status, 0); assert.match(r.stdout, /COVERAGE_REQUIRES_RECONCILE/)
})

test('RT25 spec digest, test node and runner artifact hashes are bound', () => {
  const f = fx(); const ev = evidence(f.dir); const p = proposeReconcile(f, ev)
  const badDigest = JSON.parse(readFileSync(ev.path, 'utf8')); badDigest.spec_sha256 = sha('wrong')
  writeFileSync(ev.path, JSON.stringify(badDigest))
  let r = reconcile(f, ev, p, { evidenceSha256: sha(JSON.stringify(badDigest)) })
  assert.notEqual(r.status, 0); assert.match(r.stdout, /SPEC_DIGEST_MISMATCH/)
  const badNode = JSON.parse(readFileSync(ev.path, 'utf8')); badNode.spec_sha256 = SPEC_SHA; badNode.test_node = 'wrong'
  writeFileSync(ev.path, JSON.stringify(badNode))
  r = reconcile(f, ev, p, { evidenceSha256: sha(JSON.stringify(badNode)) })
  assert.notEqual(r.status, 0); assert.match(r.stdout, /TEST_NODE_MISMATCH/)
  const tampered = JSON.parse(readFileSync(ev.path, 'utf8')); tampered.test_node = NODE
  tampered.runs.happy.artifacts[0].sha256 = sha('tampered'); writeFileSync(ev.path, JSON.stringify(tampered))
  r = reconcile(f, ev, p, { evidenceSha256: sha(JSON.stringify(tampered)) })
  assert.notEqual(r.status, 0); assert.match(r.stdout, /RUNNER_ARTIFACT_HASH_MISMATCH/)
})

test('RT26 failed/skipped evidence with missing artifacts fails closed', () => {
  const f = fx(); const ev = evidence(f.dir, { runs: { happy: { executionMethod: 'real_playwright_scratch',
    targetLabel: 'E2E_NONPROD_LOCAL_FIXTURE', status: 'FAIL', exitCode: 1, assertionKind: 'behavioral', testCount: 1, skipped: false,
    artifacts: [{ path: 'absent.txt', bytes: 1, sha256: sha('x') }] } } })
  const p = proposeReconcile(f, ev, 'unverified')
  const raw = JSON.parse(readFileSync(ev.path, 'utf8'))
  raw.runs.happy.artifacts[0].path = 'absent.txt'
  writeFileSync(ev.path, JSON.stringify(raw))
  const r = reconcile(f, ev, p, { evidenceSha256: sha(JSON.stringify(raw)) })
  assert.notEqual(r.status, 0); assert.match(r.stdout, /RUNNER_ARTIFACT_MISSING/)
})

test('RT27 command uses corrected internal mapper path', () => {
  const s = readFileSync(join(ROOT, '.opencode/commands/e2e.md'), 'utf8')
  assert.ok(s.includes('.opencode/resources/e2e-journey-mapper.md'))
  assert.ok(!s.includes('docs/e2e-v2/m6/resources/e2e-journey-mapper.md'))
})
