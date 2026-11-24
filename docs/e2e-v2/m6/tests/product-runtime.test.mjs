// Focused product-boundary regression (RT01–RT12).
// These tests invoke the ACTUAL repository-local registry tool that /e2e uses,
// not an in-memory duplicate helper. All writes are confined to disposable scratch.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, existsSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(process.env.E2E_REPO_ROOT ?? join(HERE, '../../../..'))
const TOOL = resolve(process.env.E2E_PRODUCT_REGISTRY_TOOL ?? join(ROOT, '.opencode/scripts/e2e-registry.mjs'))
const SCRATCH_BASE = process.env.E2E_SCRATCH_ROOT ?? join(tmpdir(), 'opencode')
const NODE = process.execPath
const sha = (s) => createHash('sha256').update(Buffer.from(String(s), 'utf8')).digest('hex')

function fixture() {
  const dir = mkdtempSync(join(SCRATCH_BASE, 'product-rt-'))
  const root = join(dir, 'repo')
  mkdirSync(root, { mode: 0o700, recursive: true })
  const registry = [
    '# TESTS', '', '## 1 Scope', '', '## 2 Assets', '', '## 3 Coverage', '',
    '### TEST-E2E-001 — checkout flow',
    '- Purpose: verify checkout',
    '- State: missing',
    '- Test file: tests/checkout.spec.cjs',
    '- Test file sha256: ' + sha('module.exports = () => 1\n'),
    '- Test node: checkout flow > confirms',
    '- Representative input: cart -> checkout',
    '- Observable expectation: confirmation shown',
    '- Boundary: local non-production',
    '', '## 4 Registry', '',
  ].join('\n')
  writeFileSync(join(root, 'TESTS.md'), registry)
  return { dir, root, file: join(root, 'TESTS.md'), registry }
}
function request(dir, body) {
  const p = join(dir, `req-${Math.random().toString(16).slice(2)}.json`)
  writeFileSync(p, JSON.stringify(body))
  return p
}
function run(op, body) {
  const req = request(body.repoRoot ? dirname(body.repoRoot) : dirname(body.file ?? '.'), body)
  const r = spawnSync(NODE, [TOOL, op, req], { encoding: 'utf8', timeout: 20000 })
  let data = null
  try { data = JSON.parse(r.stdout) } catch { /* RED: tool absent or non-JSON */ }
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, data }
}

test('RT01 actual /e2e registry tool exists and is invoked by operation boundary', () => {
  assert.ok(existsSync(TOOL), `missing actual product tool: ${TOOL}`)
  const f = fixture()
  const r = run('inspect', { repoRoot: f.root, registryPath: 'TESTS.md' })
  assert.equal(r.status, 0, r.stderr || r.stdout)
  assert.equal(r.data?.operation, 'inspect')
  assert.equal(r.data?.target, 'TESTS.md')
  assert.ok(Array.isArray(r.data?.call_chain) && r.data.call_chain.length > 0)
  assert.ok(r.data.validators?.state === '.opencode/scripts/e2e-runtime/registry.mjs')
})

test('RT02 invalid State is rejected before write and registry bytes unchanged', () => {
  const f = fixture()
  const r = run('apply', { repoRoot: f.root, registryPath: 'TESTS.md', blockId: 'TEST-E2E-001',
    baseSha256: sha(f.registry), outcome: { State: 'stale' }, approvedDiffSha256: 'any' })
  assert.notEqual(r.status, 0)
  assert.match((r.data?.code ?? '') + r.stdout, /INVALID_REGISTRY_STATE/)
  assert.equal(readFileSync(f.file, 'utf8'), f.registry)
})

test('RT03 evidence field cannot inject registry structure', () => {
  const f = fixture()
  const r = run('apply', { repoRoot: f.root, registryPath: 'TESTS.md', blockId: 'TEST-E2E-001',
    baseSha256: sha(f.registry), outcome: { Evidence: 'ok\n- State: covered' }, approvedDiffSha256: 'any' })
  assert.notEqual(r.status, 0)
  assert.match((r.data?.code ?? '') + r.stdout, /STRUCTURAL_INJECTION/)
  assert.equal(readFileSync(f.file, 'utf8'), f.registry)
})

test('RT04 duplicate TEST-ID and duplicate fields are rejected', () => {
  const f = fixture()
  const dupId = f.registry.replace('### TEST-E2E-001', '### TEST-E2E-001') + '### TEST-E2E-001 — duplicate\n- State: missing\n'
  writeFileSync(join(f.root, 'DUPLICATE.md'), dupId)
  let r = run('validate', { repoRoot: f.root, registryPath: 'DUPLICATE.md' })
  assert.notEqual(r.status, 0); assert.match(r.stdout, /DUPLICATE_TEST_ID/)
  const dupField = f.registry.replace('- State: missing', '- State: missing\n- State: covered')
  writeFileSync(join(f.root, 'DUPFIELD.md'), dupField)
  r = run('validate', { repoRoot: f.root, registryPath: 'DUPFIELD.md' })
  assert.notEqual(r.status, 0); assert.match(r.stdout, /DUPLICATE_FIELD/)
})

test('RT05 symlink ancestor escape is rejected with no outside mutation', () => {
  const f = fixture()
  const outside = join(f.dir, 'outside'); mkdirSync(outside, { mode: 0o700 })
  const sentinel = join(outside, 'new-TESTS.md'); writeFileSync(sentinel, 'original')
  symlinkSync(outside, join(f.root, 'link'))
  const r = run('apply', { repoRoot: f.root, registryPath: 'link/new-TESTS.md', blockId: 'TEST-E2E-001',
    baseSha256: sha(f.registry), outcome: { State: 'covered' }, approvedDiffSha256: 'any' })
  assert.notEqual(r.status, 0)
  assert.match(r.stdout, /SYMLINK_ESCAPE|PATH_REJECTED/)
  assert.equal(readFileSync(sentinel, 'utf8'), 'original')
})

test('RT06 changed registry hash cancels apply', () => {
  const f = fixture()
  const proposal = run('propose', { repoRoot: f.root, registryPath: 'TESTS.md', blockId: 'TEST-E2E-001',
    outcome: { State: 'unverified' } })
  assert.equal(proposal.status, 0, proposal.stderr || proposal.stdout)
  writeFileSync(f.file, f.registry + '\n<!-- concurrent owner edit -->\n')
  const r = run('apply', { repoRoot: f.root, registryPath: 'TESTS.md', blockId: 'TEST-E2E-001',
    baseSha256: proposal.data.base_sha256, outcome: { State: 'unverified' },
    approvedDiffSha256: proposal.data.approved_diff_sha256 })
  assert.notEqual(r.status, 0); assert.match(r.stdout, /WRITE_CONFLICT/)
  assert.ok(readFileSync(f.file, 'utf8').includes('concurrent owner edit'))
})

test('RT07 unauthorized or mismatched diff is rejected', () => {
  const f = fixture()
  const r = run('apply', { repoRoot: f.root, registryPath: 'TESTS.md', blockId: 'TEST-E2E-001',
    baseSha256: sha(f.registry), outcome: { State: 'unverified' }, approvedDiffSha256: sha('wrong diff') })
  assert.notEqual(r.status, 0); assert.match(r.stdout, /APPROVAL_MISMATCH/)
  assert.equal(readFileSync(f.file, 'utf8'), f.registry)
})

test('RT08 failed validation preserves original registry bytes', () => {
  const f = fixture()
  const bad = f.registry.replace('### TEST-E2E-001', '### TEST-E2E-ABC')
  writeFileSync(f.file, bad)
  const r = run('apply', { repoRoot: f.root, registryPath: 'TESTS.md', blockId: 'TEST-E2E-001',
    baseSha256: sha(bad), outcome: { State: 'covered' }, approvedDiffSha256: 'x' })
  assert.notEqual(r.status, 0)
  assert.equal(readFileSync(f.file, 'utf8'), bad)
})

test('RT09 internal mapper resolves without legacy command dependency', () => {
  const r = run('map', { repoRoot: ROOT, registryPath: 'TESTS.md' })
  assert.equal(r.status, 0, r.stderr || r.stdout)
  assert.ok(r.data?.mapper?.resource?.includes('internal'))
  assert.equal(r.data?.legacy_command_read, 0)
})

test('RT10 legacy mapping parity remains available', () => {
  const r = run('map', { repoRoot: ROOT, registryPath: 'TESTS.md', legacy: true })
  assert.equal(r.status, 0, r.stderr || r.stdout)
  assert.equal(r.data?.legacy_compatibility, true)
})

test('RT11 missing or contradictory evidence gets no verified status', () => {
  const f = fixture()
  const r = run('reconcile', { repoRoot: f.root, registryPath: 'TESTS.md', blockId: 'TEST-E2E-001',
    baseSha256: sha(f.registry), approvedDiffSha256: sha('x'), authorization: { decision: 'DEC-06' },
    evidenceRoot: f.dir, evidencePath: 'missing.json', evidenceSha256: sha('x') })
  assert.notEqual(r.status, 0)
  assert.match(r.stdout, /EVIDENCE_FILE_MISSING/)
  assert.equal(readFileSync(f.file, 'utf8'), f.registry)
})

test('RT12 product safety failure blocks release decision', () => {
  const r = run('release', { repoRoot: ROOT, registryPath: 'TESTS.md', productBoundary: { status: 'FAIL', blocker: true } })
  assert.equal(r.status, 0, r.stderr || r.stdout)
  assert.equal(r.data?.release_readiness, 'BLOCKED')
  assert.equal(r.data?.disable_default_permitted, false)
})
