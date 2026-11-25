/**
 * Contract and isolation tests for multi-runtime workflow state utility.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const {
  resolveWorkflowStatePath,
  resolveWorkflowLockPath,
  readWorkflowState,
  writeWorkflowState,
  clearWorkflowState,
  isWorkflowActive,
  DEFAULT_TTL_SECONDS,
  ERRORS,
} = require(path.join(REPO_ROOT, 'scripts', 'lib', 'workflow-state'));

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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-wf-state-test-'));
}

console.log('=== Testing Antigravity Workflow State Utility ===\n');

// 1. Path resolution tests
test('resolveWorkflowStatePath resolves correct paths per target', () => {
  const projectRoot = '/tmp/fake-project';
  const agyPath = resolveWorkflowStatePath({ projectRoot, target: 'antigravity-cli' });
  assert.strictEqual(
    agyPath,
    path.join(projectRoot, '.agents', 'ecc-opl', 'workflows', 'active.json')
  );

  const opencodePath = resolveWorkflowStatePath({ projectRoot, target: 'opencode' });
  assert.strictEqual(
    opencodePath,
    path.join(projectRoot, '.opencode', 'workflows', 'active.json')
  );
});

test('resolveWorkflowLockPath appends .lock suffix', () => {
  const statePath = '/tmp/fake-project/.agents/ecc-opl/workflows/active.json';
  assert.strictEqual(resolveWorkflowLockPath(statePath), `${statePath}.lock`);
});

// 2. State write and metadata enrichment
test('writeWorkflowState writes isolated state with enriched metadata', () => {
  const projectRoot = makeTempProjectDir();
  try {
    const inputState = {
      workflow: 'tdd',
      phase: 'red',
      steps: ['test', 'implement', 'refactor'],
      current: 0,
      worktreeId: 'wt-main',
      conversationId: 'ses_123',
      workflowId: 'wf_456',
      checkpointDigest: 'sha256:abc',
      gates: { redVerified: false },
    };

    const written = writeWorkflowState({
      projectRoot,
      target: 'antigravity-cli',
      state: inputState,
    });

    assert.strictEqual(written.target, 'antigravity-cli');
    assert.strictEqual(written.projectRoot, projectRoot);
    assert.strictEqual(written.worktreeId, 'wt-main');
    assert.strictEqual(written.workflow, 'tdd');
    assert.strictEqual(written.phase, 'red');
    assert.strictEqual(written.ttl, DEFAULT_TTL_SECONDS);
    assert.ok(typeof written.timestamp === 'string');
    assert.ok(typeof written.updatedAt === 'string');

    // Confirm file exists on disk
    const expectedPath = path.join(projectRoot, '.agents', 'ecc-opl', 'workflows', 'active.json');
    assert.ok(fs.existsSync(expectedPath), 'active.json must exist');

    // Confirm OpenCode state remains absent (Isolation proof)
    const opencodePath = path.join(projectRoot, '.opencode', 'workflows', 'active.json');
    assert.ok(!fs.existsSync(opencodePath), 'OpenCode active.json must NOT exist');

    // Lockfile must NOT be left behind
    assert.ok(!fs.existsSync(`${expectedPath}.lock`), 'Lockfile must be released');
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

// 3. State read and active status check
test('readWorkflowState and isWorkflowActive reflect written state', () => {
  const projectRoot = makeTempProjectDir();
  try {
    writeWorkflowState({
      projectRoot,
      target: 'antigravity-cli',
      state: { workflow: 'plan', phase: 'review', steps: ['a', 'b'], current: 1 },
    });

    const read = readWorkflowState({ projectRoot, target: 'antigravity-cli' });
    assert.ok(read !== null);
    assert.strictEqual(read.workflow, 'plan');
    assert.strictEqual(read.phase, 'review');

    assert.strictEqual(isWorkflowActive({ projectRoot, target: 'antigravity-cli' }), true);
    // OpenCode should not be active
    assert.strictEqual(isWorkflowActive({ projectRoot, target: 'opencode' }), false);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

// 4. TTL expiration
test('readWorkflowState ignores expired state (> 12h) by default', () => {
  const projectRoot = makeTempProjectDir();
  try {
    const expiredTimestamp = new Date(Date.now() - 13 * 3600 * 1000).toISOString();
    writeWorkflowState({
      projectRoot,
      target: 'antigravity-cli',
      state: {
        workflow: 'tdd',
        phase: 'red',
        timestamp: expiredTimestamp,
        updatedAt: expiredTimestamp,
      },
    });

    // Default read ignores expired
    const activeRead = readWorkflowState({ projectRoot, target: 'antigravity-cli' });
    assert.strictEqual(activeRead, null);
    assert.strictEqual(isWorkflowActive({ projectRoot, target: 'antigravity-cli' }), false);

    // Explicit includeExpired flag returns state with isExpired: true
    const expiredRead = readWorkflowState({
      projectRoot,
      target: 'antigravity-cli',
      includeExpired: true,
    });
    assert.ok(expiredRead !== null);
    assert.strictEqual(expiredRead.isExpired, true);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

// 5. Concurrency protection and lock contention
test('writeWorkflowState rejects when lockfile is held', () => {
  const projectRoot = makeTempProjectDir();
  try {
    const statePath = resolveWorkflowStatePath({ projectRoot, target: 'antigravity-cli' });
    const lockPath = resolveWorkflowLockPath(statePath);
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });

    // Simulate active lockfile held by current process
    fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, createdAt: Date.now() }));

    assert.throws(() => {
      writeWorkflowState({
        projectRoot,
        target: 'antigravity-cli',
        state: { workflow: 'tdd', phase: 'red' },
        lockTimeoutMs: 100, // fast fail for test
      });
    }, error => {
      return error.code === ERRORS.E_LOCK_CONTENTION;
    });
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

// 6. Cross-runtime clobber protection
test('writeWorkflowState guards against cross-runtime clobber without handoff', () => {
  const projectRoot = makeTempProjectDir();
  try {
    // Write state under antigravity-cli
    writeWorkflowState({
      projectRoot,
      target: 'antigravity-cli',
      state: { workflow: 'tdd', phase: 'red' },
    });

    // Attempt to write custom path pointing to same file but with target opencode
    const agyPath = resolveWorkflowStatePath({ projectRoot, target: 'antigravity-cli' });

    assert.throws(() => {
      writeWorkflowState({
        projectRoot,
        target: 'opencode',
        customPath: agyPath,
        state: { workflow: 'plan', phase: 'draft' },
      });
    }, error => {
      return error.code === ERRORS.E_CROSS_RUNTIME_CLOBBER;
    });

    // With explicit handoff flag, write succeeds
    const handedOff = writeWorkflowState({
      projectRoot,
      target: 'opencode',
      customPath: agyPath,
      state: { workflow: 'plan', phase: 'draft' },
      handoff: true,
    });
    assert.strictEqual(handedOff.target, 'opencode');
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

// 7. Cross-worktree clobber protection
test('writeWorkflowState guards against cross-worktree clobber without handoff', () => {
  const projectRoot = makeTempProjectDir();
  try {
    writeWorkflowState({
      projectRoot,
      target: 'antigravity-cli',
      state: { workflow: 'tdd', phase: 'red', worktreeId: 'wt-feature-a' },
    });

    assert.throws(() => {
      writeWorkflowState({
        projectRoot,
        target: 'antigravity-cli',
        state: { workflow: 'tdd', phase: 'green', worktreeId: 'wt-feature-b' },
      });
    }, error => {
      return error.code === ERRORS.E_CROSS_WORKTREE_CLOBBER;
    });

    // With explicit handoff flag, succeeds
    const handedOff = writeWorkflowState({
      projectRoot,
      target: 'antigravity-cli',
      state: { workflow: 'tdd', phase: 'green', worktreeId: 'wt-feature-b' },
      handoff: true,
    });
    assert.strictEqual(handedOff.worktreeId, 'wt-feature-b');
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

// 8. clearWorkflowState deactivates workflow
test('clearWorkflowState sets phase: "done" or removes file', () => {
  const projectRoot = makeTempProjectDir();
  try {
    writeWorkflowState({
      projectRoot,
      target: 'antigravity-cli',
      state: { workflow: 'tdd', phase: 'red' },
    });
    assert.strictEqual(isWorkflowActive({ projectRoot, target: 'antigravity-cli' }), true);

    clearWorkflowState({ projectRoot, target: 'antigravity-cli' });
    const readAfterClear = readWorkflowState({ projectRoot, target: 'antigravity-cli' });
    assert.strictEqual(readAfterClear.phase, 'done');
    assert.strictEqual(isWorkflowActive({ projectRoot, target: 'antigravity-cli' }), false);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
