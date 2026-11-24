// Amendment E2E-V2-M5-SAFETY-REMEDIATION-01 — focused RED/GREEN regressions for
// S01 (invalid canonical registry State) and S02 (unsafe registry destination).
// Reference-helper tests only: zero child process, network, install, git, active
// HOME/registry mutation. All filesystem fixtures are disposable 0700 scratch.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as M from './migration.mjs'
import * as F from './fixtures.mjs'
import { STATE_ENUM } from '../../m3/tests/registry.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..')
const REJECT_CODES = ['PATH_REJECTED', 'SYMLINK_ESCAPE', 'BROKEN_SYMLINK', 'UNSUPPORTED_PATH']

function scratch(t, label) {
  const d = F.makeScratch(`m5-safety-${label}-`)
  t.after(() => F.dropScratch(d))
  return d
}

// Every S02 result must be honest about TOCTOU: a read-only preflight is never
// a race-safe write guarantee.
function assertHonest(r) {
  assert.equal(r.race_safe, false, 'preflight must not claim race safety')
  assert.equal(r.race_limitation, 'TOCTOU_NOT_FULLY_PROVEN')
  assert.notEqual(r.code, 'TOCTOU_SAFE')
}
function assertRejected(r, label) {
  assert.equal(r.allowed, false, `${label}: destination must be rejected`)
  assert.ok(REJECT_CODES.includes(r.code), `${label}: explicit rejection code required, got ${r.code}`)
  assertHonest(r)
}

// ============================================================================
// S01 — canonical State enum is the M3 validateState() contract
// ============================================================================

test('S01: the canonical State enum is exactly the five M3 values', () => {
  assert.deepEqual([...STATE_ENUM], [
    'missing', 'in progress', 'unverified', 'covered', 'not applicable',
  ])
})

test('S01: all five canonical States are accepted by the field-scoped update', () => {
  for (const state of STATE_ENUM) {
    const r = M.applyFieldScopedUpdate({
      registryText: F.F07_REGISTRY_BEFORE,
      blockId: F.F07_BLOCK_A_ID,
      outcome: { State: state },
    })
    assert.equal(r.applied, true, `canonical State ${JSON.stringify(state)} must be accepted`)
    assert.equal(r.registry_writes, 0)
  }
})

test('S01: an allowed State does not bypass the permitted-field whitelist', () => {
  const r = M.applyFieldScopedUpdate({
    registryText: F.F07_REGISTRY_BEFORE,
    blockId: F.F07_BLOCK_A_ID,
    outcome: { State: 'covered', Purpose: 'tampered' },
  })
  assert.equal(r.applied, false)
  assert.equal(r.code, 'FIELD-NOT-PERMITTED')
})

const INVALID_STATES = [
  'stale', 'blocked', 'failed', 'COVERED', '', 'covered\nin progress', { value: 'covered' },
]
for (const [i, state] of INVALID_STATES.entries()) {
  test(`S01: invalid State #${i + 1} (${JSON.stringify(state)}) is rejected atomically`, () => {
    const r = M.applyFieldScopedUpdate({
      registryText: F.F07_REGISTRY_BEFORE,
      blockId: F.F07_BLOCK_A_ID,
      // Evidence is a *permitted* field: it must not be partially written when
      // State is invalid. The whole update is rejected before any diff.
      outcome: { State: state, Evidence: 'MUST-NOT-APPEAR' },
    })
    assert.equal(r.applied, false, 'invalid State must be rejected')
    assert.equal(r.code, 'INVALID_REGISTRY_STATE')
    assert.equal(r.registry_writes, 0)
    assert.equal(r.nextText, F.F07_REGISTRY_BEFORE, 'registry text must be byte-identical')
    assert.equal(r.hashAfter, r.hashBefore, 'hash must be unchanged')
    assert.equal(r.nextText.includes('MUST-NOT-APPEAR'), false, 'no partial field write')
    assert.deepEqual(r.changes, [])
    assert.equal(r.diff, '')
  })
}

// ============================================================================
// S02 — component-aware containment, symlink ancestors, fail-closed preflight
// ============================================================================

test('S02: outside symlink ancestor with a nonexistent child is rejected', (t) => {
  const base = scratch(t, 'symlink-ancestor')
  const repo = F.subDir(base, 'repo')
  const outside = F.subDir(base, 'outside')
  const sentinel = join(outside, 'SENTINEL.txt')
  writeFileSync(sentinel, 'SENTINEL-BYTES')
  symlinkSync(outside, join(repo, 'escape'))

  const r = M.checkRegistryPathSafety({
    registryPath: 'escape/nested/deeper/TESTS.md', repoRoot: repo,
  })
  assertRejected(r, 'outside symlink ancestor + nonexistent child')
  assert.equal(r.code, 'SYMLINK_ESCAPE')
  assert.equal(readFileSync(sentinel, 'utf8'), 'SENTINEL-BYTES', 'outside sentinel unchanged')
  assert.equal(existsSync(join(outside, 'nested')), false, 'no outside-root directory created')
})

test('S02: multiple absent children below an outside symlink are rejected', (t) => {
  const base = scratch(t, 'symlink-multilevel')
  const repo = F.subDir(base, 'repo')
  const outside = F.subDir(base, 'outside')
  symlinkSync(outside, join(repo, 'escape'))

  const r = M.checkRegistryPathSafety({
    registryPath: 'escape/a/b/c/d/TESTS.md', repoRoot: repo,
  })
  assertRejected(r, 'outside symlink ancestor + multiple absent children')
  assert.equal(existsSync(outside + '/a'), false, 'no outside-root directories created')
})

test('S02: existing outside symlink leaf is rejected', (t) => {
  const base = scratch(t, 'symlink-leaf')
  const repo = F.subDir(base, 'repo')
  const outside = F.subDir(base, 'outside')
  writeFileSync(join(outside, 'TESTS.md'), 'OUTSIDE-BYTES')
  symlinkSync(join(outside, 'TESTS.md'), join(repo, 'TESTS.md'))

  const r = M.checkRegistryPathSafety({ registryPath: 'TESTS.md', repoRoot: repo })
  assertRejected(r, 'outside symlink leaf')
  assert.equal(r.code, 'SYMLINK_ESCAPE')
  assert.equal(readFileSync(join(outside, 'TESTS.md'), 'utf8'), 'OUTSIDE-BYTES')
})

test('S02: in-root symlink leaf is rejected under the conservative policy', (t) => {
  const base = scratch(t, 'symlink-inroot')
  const repo = F.subDir(base, 'repo')
  const real = F.subDir(repo, 'real')
  writeFileSync(join(real, 'TESTS.md'), 'INSIDE-BYTES')
  symlinkSync(join(real, 'TESTS.md'), join(repo, 'link.md'))

  const r = M.checkRegistryPathSafety({ registryPath: 'link.md', repoRoot: repo })
  assertRejected(r, 'in-root symlink leaf')
})

test('S02: broken symlink ancestor is rejected', (t) => {
  const base = scratch(t, 'broken-symlink')
  const repo = F.subDir(base, 'repo')
  const outside = F.subDir(base, 'outside')
  symlinkSync(join(outside, 'does-not-exist'), join(repo, 'broken'))

  const r = M.checkRegistryPathSafety({ registryPath: 'broken/TESTS.md', repoRoot: repo })
  assertRejected(r, 'broken symlink ancestor')
  assert.equal(r.code, 'BROKEN_SYMLINK')
})

test('S02: chained symlink ending outside the root is rejected', (t) => {
  const base = scratch(t, 'chained-symlink')
  const repo = F.subDir(base, 'repo')
  const outside = F.subDir(base, 'outside')
  writeFileSync(join(outside, 'TESTS.md'), 'OUTSIDE-BYTES')
  symlinkSync(join(repo, 'b'), join(repo, 'a'))
  symlinkSync(outside, join(repo, 'b'))

  const r = M.checkRegistryPathSafety({ registryPath: 'a/TESTS.md', repoRoot: repo })
  assertRejected(r, 'chained symlink ending outside')
})

test('S02: a regular file used as an ancestor directory is rejected', (t) => {
  const base = scratch(t, 'file-ancestor')
  const repo = F.subDir(base, 'repo')
  writeFileSync(join(repo, 'afile'), 'FILE-BYTES')

  const r = M.checkRegistryPathSafety({ registryPath: 'afile/TESTS.md', repoRoot: repo })
  assertRejected(r, 'file ancestor (ENOTDIR must fail closed)')
})

test('S02: NUL byte in the registry path is rejected', () => {
  const r = M.checkRegistryPathSafety({ registryPath: 'TESTS.md\u0000.txt', repoRoot: ROOT })
  assertRejected(r, 'NUL byte')
  assert.equal(r.code, 'PATH_REJECTED')
})

test('S02: a repoRoot that is itself a symlink is rejected', (t) => {
  const base = scratch(t, 'symlink-root')
  const realRepo = F.subDir(base, 'realrepo')
  writeFileSync(join(realRepo, 'TESTS.md'), 'ROOT-SENTINEL')
  const linkRoot = join(base, 'rootlink')
  symlinkSync(realRepo, linkRoot)

  const r = M.checkRegistryPathSafety({ registryPath: 'TESTS.md', repoRoot: linkRoot })
  assertRejected(r, 'symlink repoRoot')
  assert.equal(readFileSync(join(realRepo, 'TESTS.md'), 'utf8'), 'ROOT-SENTINEL')
})

test('S02: contained existing and new nested destinations are allowed', (t) => {
  const base = scratch(t, 'contained')
  const repo = F.subDir(base, 'repo')
  const sub = F.subDir(repo, 'sub')
  writeFileSync(join(sub, 'TESTS.md'), 'INSIDE-BYTES')

  const existing = M.checkRegistryPathSafety({ registryPath: 'sub/TESTS.md', repoRoot: repo })
  assert.equal(existing.allowed, true)
  assert.equal(existing.exists, true)
  assertHonest(existing)

  const fresh = M.checkRegistryPathSafety({
    registryPath: 'sub/new/deeper/TESTS.md', repoRoot: repo,
  })
  assert.equal(fresh.allowed, true)
  assert.equal(fresh.exists, false)
  assertHonest(fresh)
  assert.equal(existsSync(join(sub, 'new')), false, 'preflight created no directory')
})
