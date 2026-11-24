// RED reproductions for the two remaining external probes.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(process.env.E2E_REPO_ROOT ?? join(HERE, '../../../..'))
const TOOL = resolve(process.env.E2E_PRODUCT_REGISTRY_TOOL ?? join(ROOT, '.opencode/scripts/e2e-registry.mjs'))
const SCRATCH = process.env.E2E_SCRATCH_ROOT ?? join(tmpdir(), 'opencode')
const sha = (s) => createHash('sha256').update(Buffer.from(String(s), 'utf8')).digest('hex')
function run(op, body) {
  const req = join(SCRATCH, `tc-${op}-${Math.random().toString(16).slice(2)}.json`)
  writeFileSync(req, JSON.stringify(body))
  const r = spawnSync(process.execPath, [TOOL, op, req], { encoding: 'utf8', timeout: 20000 })
  let data = null; try { data = JSON.parse(r.stdout) } catch {}
  return { status: r.status, stdout: r.stdout, data }
}
const auth = (digest, op = 'reconcile') => ({ decision: 'DEC-06', approved_by: 'Owner', operation: op, approved_diff_sha256: digest })
function fixture(spec = 'tests/real.spec.cjs', specSha = sha('real spec')) {
  const dir = mkdtempSync(join(SCRATCH, 'targeted-'))
  const repo = join(dir, 'repo'); mkdirSync(repo, { mode: 0o700, recursive: true })
  mkdirSync(join(repo, 'tests'), { recursive: true })
  writeFileSync(join(repo, spec), 'real spec')
  const reg = `# TESTS\n\n### TEST-E2E-001 — real flow\n- Purpose: real\n- State: missing\n- Test file: ${spec}\n- Test file sha256: ${specSha}\n- Test node: real > confirms\n- Representative input: /\n- Observable expectation: real\n- Boundary: local non-production\n`
  writeFileSync(join(repo, 'TESTS.md'), reg)
  return { dir, repo, reg }
}
function evidence(dir, spec, specSha, overrides = {}) {
  const artifact = 'not a browser report or execution output\n'
  writeFileSync(join(dir, 'run.txt'), artifact)
  const body = { scenario_id: 'C04', test_id: 'TEST-E2E-001', spec, spec_sha256: specSha,
    test_node: 'real > confirms', command: 'node ' + spec,
    runs: { happy: { executionMethod: 'real_playwright_scratch', targetLabel: 'E2E_NONPROD_LOCAL_FIXTURE',
      status: 'PASS', exitCode: 0, assertionKind: 'behavioral', testCount: 1, skipped: false,
      artifacts: [{ path: 'run.txt', sha256: sha(artifact), bytes: Buffer.byteLength(artifact) }] } }, ...overrides }
  const path = join(dir, 'evidence.json'); writeFileSync(path, JSON.stringify(body))
  return { path, sha: sha(JSON.stringify(body)) }
}

test('PROBE-01 RED: text artifact cannot grant covered even with valid hash', () => {
  const f = fixture(); const specSha = sha('real spec'); const ev = evidence(f.dir, 'tests/real.spec.cjs', specSha)
  const p = run('reconcile-propose', { repoRoot: f.repo, registryPath: 'TESTS.md', blockId: 'TEST-E2E-001',
    baseSha256: sha(f.reg), evidenceRoot: f.dir, evidencePath: 'evidence.json', evidenceSha256: ev.sha })
  assert.notEqual(p.status, 0, `false coverage still possible: ${p.stdout}`)
  assert.match(p.stdout, /REPORTER|EXECUTION_ARTIFACT|NOT_VERIFIED/)
})

test('PROBE-02 RED: req.testProposal cannot override registered spec identity', () => {
  const f = fixture(); const ev = evidence(f.dir, 'tests/other.spec.cjs', sha('other spec'))
  const p = run('reconcile-propose', { repoRoot: f.repo, registryPath: 'TESTS.md', blockId: 'TEST-E2E-001',
    baseSha256: sha(f.reg), evidenceRoot: f.dir, evidencePath: 'evidence.json', evidenceSha256: ev.sha,
    testProposal: { spec: 'tests/other.spec.cjs', sha256: sha('other spec'), node: 'real > confirms' } })
  assert.notEqual(p.status, 0, `registered identity overridden: ${p.stdout}`)
  assert.match(p.stdout, /SPEC_IDENTITY|SPEC_DIGEST|TEST_PROPOSAL/)
})
