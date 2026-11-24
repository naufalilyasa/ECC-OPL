// RED reproductions for BUG-01 and BUG-02 against the actual product tool.
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
const SCRATCH = process.env.E2E_SCRATCH_ROOT ?? join(tmpdir(), 'opencode')
const sha = (s) => createHash('sha256').update(Buffer.from(String(s), 'utf8')).digest('hex')
function run(op, body) {
  const req = join(SCRATCH, `rc-${op}-${Math.random().toString(16).slice(2)}.json`)
  writeFileSync(req, JSON.stringify(body))
  const r = spawnSync(process.execPath, [TOOL, op, req], { encoding: 'utf8', timeout: 20000 })
  let data = null; try { data = JSON.parse(r.stdout) } catch {}
  return { status: r.status, stdout: r.stdout, data }
}

test('BUG-01 RED: unrelated spec, no digest/test node, zero artifacts cannot get covered', () => {
  const dir = mkdtempSync(join(SCRATCH, 'bug01-'))
  const repo = join(dir, 'repo'); mkdirSync(repo, { mode: 0o700, recursive: true })
  const reg = '# TESTS\n\n### TEST-E2E-001 — real flow\n- Purpose: real\n- State: missing\n- Test file: tests/real.spec.cjs\n- Test node: real > confirms\n- Representative input: /\n- Observable expectation: real\n- Boundary: local non-production\n'
  writeFileSync(join(repo, 'TESTS.md'), reg)
  // Delegating evidence: unrelated spec, no spec digest, no test node, zero artifacts.
  const body = { scenario_id: 'C04', test_id: 'TEST-E2E-001', spec: 'tests/unrelated.spec.cjs',
    runs: { happy: { executionMethod: 'real_playwright_scratch', targetLabel: 'E2E_NONPROD_LOCAL_FIXTURE',
      status: 'PASS', exitCode: 0, assertionKind: 'behavioral', testCount: 1, skipped: false, artifacts: [] } } }
  const path = join(dir, 'evidence.json'); writeFileSync(path, JSON.stringify(body))
  const r = run('reconcile-propose', { repoRoot: repo, registryPath: 'TESTS.md', blockId: 'TEST-E2E-001',
    baseSha256: sha(reg), evidenceRoot: dir, evidencePath: 'evidence.json', evidenceSha256: sha(JSON.stringify(body)) })
  assert.notEqual(r.status, 0, `BUG-01 still grants coverage: ${r.stdout}`)
  assert.match(r.stdout, /SPEC_IDENTITY|TEST_NODE|SPEC_DIGEST|ARTIFACT/)
})

test('BUG-02 RED: bootstrap with existing docs-map must preflight all targets before any write', () => {
  const dir = mkdtempSync(join(SCRATCH, 'bug02-'))
  const repo = join(dir, 'repo'); mkdirSync(repo, { mode: 0o700, recursive: true })
  const docsMap = '{"schema":"ecc-opl.e2e-docs-map/v1","registry":"TESTS.md","journeys":[],"owner":"keep-me"}\n'
  mkdirSync(join(repo, '.governance'), { recursive: true })
  writeFileSync(join(repo, '.governance/docs-map.json'), docsMap)
  const p = run('bootstrap-propose', { repoRoot: repo, registryPath: 'TESTS.md' })
  assert.equal(p.status, 0, p.stdout)
  const r = run('bootstrap', { repoRoot: repo, registryPath: 'TESTS.md',
    approvedDiffSha256: p.data.approved_diff_sha256,
    authorization: { decision: 'DEC-06', approved_by: 'Owner', operation: 'bootstrap', approved_diff_sha256: p.data.approved_diff_sha256 } })
  assert.equal(r.status, 0, `partial bootstrap: ${r.stdout}`)
  assert.ok(existsSync(join(repo, 'TESTS.md')))
  assert.equal(readFileSync(join(repo, '.governance/docs-map.json'), 'utf8'), docsMap)
})
