/**
 * Regression tests for the Phase A2 quick-review findings (review baseline 42fae4eb).
 * Covers: TOCTOU lock, RMW race, destination collision, OpenCode isolation,
 * busy-wait, PID-checked release, directory fallthrough, clobber guards,
 * Windows label normalization.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const {
  resolveWorkflowStatePath,
  resolveWorkflowLockPath,
  writeWorkflowState,
  updateWorkflowState,
  releaseWorkflowLock,
  ERRORS,
} = require(path.join(REPO_ROOT, 'scripts', 'lib', 'workflow-state'));
const {
  adaptAntigravityAgent,
} = require(path.join(REPO_ROOT, 'scripts', 'lib', 'install', 'antigravity-agent'));
const { getInstallTargetAdapter } = require(path.join(REPO_ROOT, 'scripts', 'lib', 'install-targets', 'registry'));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
    failed += 1;
  }
}

function makeTempProjectDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-review-fix-test-'));
}

console.log('=== Regression tests for A2 quick-review findings ===\n');

// F1 [CRITICAL] TOCTOU: fresh unparseable lockfile must not be unlinked.
test('F1: fresh unparseable lockfile is preserved and contention is raised', () => {
  const projectRoot = makeTempProjectDir();
  try {
    const lockPath = resolveWorkflowLockPath(resolveWorkflowStatePath({ projectRoot }));
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    // Simulate the window between openSync('wx') and writeSync: empty lock file.
    fs.writeFileSync(lockPath, '');
    assert.throws(() => writeWorkflowState({
      projectRoot,
      state: { workflow: 'tdd', phase: 'red' },
      lockTimeoutMs: 200,
    }), error => error.code === ERRORS.E_LOCK_CONTENTION);
    assert.ok(fs.existsSync(lockPath), 'fresh corrupt lockfile must be preserved, not unlinked');
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

// F2 [CRITICAL] updateWorkflowState must merge correctly and release the lock.
test('F2: updateWorkflowState reads under lock, merges, and releases lock', () => {
  const projectRoot = makeTempProjectDir();
  try {
    writeWorkflowState({
      projectRoot,
      state: { workflow: 'tdd', phase: 'red', current: 0 },
    });
    const updated = updateWorkflowState({
      projectRoot,
      updates: { phase: 'green', current: 1 },
    });
    assert.strictEqual(updated.phase, 'green');
    assert.strictEqual(updated.current, 1);
    assert.strictEqual(updated.workflow, 'tdd');
    const lockPath = resolveWorkflowLockPath(resolveWorkflowStatePath({ projectRoot }));
    assert.ok(!fs.existsSync(lockPath), 'lockfile must be released after update');
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

// F3 [CRITICAL] command and skill projections must never collide on a skill destination.
test('F3: command and skill projections never collide on skill destination', () => {
  const adapter = getInstallTargetAdapter('antigravity-cli');
  const operations = adapter.planOperations({
    repoRoot: REPO_ROOT,
    projectRoot: '/project',
    homeDir: '/home/user',
    modules: [{ id: 'design', paths: ['commands/typography.md', 'skills/typography-system'] }],
  });
  const typoOps = operations.filter(op =>
    /\/skills\/opl-typography(?:-system)?(?:\/|$)/.test(op.destinationPath.replace(/\\/g, '/')));
  assert.strictEqual(
    typoOps.length,
    1,
    `expected exactly one typography skill projection, got ${typoOps.length}`
  );
});

// F4 [HIGH] releaseWorkflowLock must not unlink a lock owned by another PID.
test('F4: releaseWorkflowLock preserves a lock owned by another PID', () => {
  const projectRoot = makeTempProjectDir();
  try {
    const lockPath = resolveWorkflowLockPath(resolveWorkflowStatePath({ projectRoot }));
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(lockPath, JSON.stringify({ pid: 999999999, createdAt: Date.now() }));
    releaseWorkflowLock(lockPath);
    assert.ok(fs.existsSync(lockPath), 'foreign lockfile must not be unlinked');
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

// F6 [HIGH] missing source directory must not fall through to a bogus single-file op.
test('F6: missing commands directory produces no bogus operation', () => {
  const repoRoot = makeTempProjectDir();
  try {
    const adapter = getInstallTargetAdapter('antigravity-cli');
    const operations = adapter.planOperations({
      repoRoot,
      projectRoot: '/project',
      homeDir: '/home/user',
      modules: [{ id: 'x', paths: ['commands'] }],
    });
    assert.strictEqual(
      operations.length,
      0,
      `expected no operations, got ${JSON.stringify(operations.map(op => op.destinationPath))}`
    );
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});

// F8 [MEDIUM] worktree clobber guard must reject an untagged write over an active worktree.
test('F8: worktree guard rejects untagged write over an active worktree', () => {
  const projectRoot = makeTempProjectDir();
  try {
    writeWorkflowState({
      projectRoot,
      state: { workflow: 'tdd', phase: 'red', worktreeId: 'wt-a' },
    });
    assert.throws(() => writeWorkflowState({
      projectRoot,
      state: { workflow: 'tdd', phase: 'green' },
    }), error => error.code === ERRORS.E_CROSS_WORKTREE_CLOBBER);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

// F9 [MEDIUM] cross-runtime clobber guard must not block on a done state.
test('F9: cross-runtime guard skips done states', () => {
  const projectRoot = makeTempProjectDir();
  try {
    const agyPath = resolveWorkflowStatePath({ projectRoot, target: 'antigravity-cli' });
    writeWorkflowState({
      projectRoot,
      target: 'antigravity-cli',
      state: { workflow: 'tdd', phase: 'done' },
    });
    const handedOff = writeWorkflowState({
      projectRoot,
      target: 'opencode',
      customPath: agyPath,
      state: { workflow: 'plan', phase: 'draft' },
    });
    assert.strictEqual(handedOff.target, 'opencode');
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

// F10 [LOW] Windows-style label must resolve canonical agent tools.
test('F10: Windows-style label resolves canonical agent tools', () => {
  const source = [
    '---',
    'name: custom-agent',
    'description: test',
    'tools: Read, Write',
    '---',
    'body',
  ].join('\n');
  const adapted = adaptAntigravityAgent(source, 'agents\\code-reviewer.md', { runtime: 'cli' });
  const fm = yaml.load(adapted.match(/^---\n([\s\S]*?)\n---\n/)[1]);
  assert.deepStrictEqual(fm.tools, ['read_file', 'grep_search', 'find_by_name']);
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
