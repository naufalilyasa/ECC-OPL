/**
 * Round-4 review fixes: install atomicity on identical files, feedback
 * preservation, agent dedupe robustness, and path/containment correctness.
 *
 * Run with: node tests/lib/antigravity-review-fixes4.test.js
 */
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  generateReleaseManifest,
  buildOwnershipLedger,
  detectManagedConflicts,
  installRelease,
  rollbackRelease
} = require('../../scripts/lib/eccskills-distribution');
const { createSessionStore } = require('../../scripts/lib/plan-canvas/sessions');
const { ERROR_CODES } = (() => {
  try { return require('../../scripts/lib/workflow-state'); }
  catch { return { ERROR_CODES: null }; }
})();

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed += 1; }
  catch (error) { console.log(`  ✗ ${name}\n    ${error.message}`); failed += 1; }
}
function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'review4-')); }
function sha(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

function writeSource(root, rel, content) {
  const p = path.join(root, 'src', rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  return p;
}
function makeOps(root) {
  return [
    {
      sourcePath: writeSource(root, 'skills/opl-tdd/SKILL.md', '# opl-tdd\n'),
      sourceRelativePath: 'skills/opl-tdd/SKILL.md',
      destinationPath: path.join(root, 'proj', '.agents', 'skills/opl-tdd/SKILL.md')
    },
    {
      sourcePath: writeSource(root, 'agents/opl-code-reviewer.md', 'name: opl-code-reviewer\n'),
      sourceRelativePath: 'agents/opl-code-reviewer.md',
      destinationPath: path.join(root, 'proj', '.agents', 'agents/opl-code-reviewer/agent.md')
    }
  ];
}
function installPaths(root) {
  const projectRoot = path.join(root, 'proj');
  return {
    projectRoot,
    ledgerPath: path.join(projectRoot, '.agents', '.ecc-managed-manifest.json'),
    backupRoot: path.join(projectRoot, '.agents', '.ecc-backup')
  };
}

function runTests() {
  console.log('\n=== Round-4 review fixes ===\n');

  // --- HIGH 1: identical pre-existing file must not be rewritten ---------
  test('R1 identical pre-existing file is not rewritten at all', () => {
    const root = tmp();
    const m = generateReleaseManifest({ operations: makeOps(root), target: 'antigravity-cli' });
    const p = installPaths(root);
    const dest = m.files[0].destinationPath;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, fs.readFileSync(m.files[0].sourcePath));

    const before = fs.statSync(dest).mtimeMs;
    const ino = fs.statSync(dest).ino;
    installRelease(m, p);
    const after = fs.statSync(dest);
    assert.strictEqual(after.ino, ino, 'inode unchanged — file not replaced');
    assert.strictEqual(after.mtimeMs, before, 'mtime unchanged — no write happened');
  });

  test('R1b identical file survives a later failure in the same run', () => {
    const root = tmp();
    const m = generateReleaseManifest({ operations: makeOps(root), target: 'antigravity-cli' });
    const p = installPaths(root);
    const dest = m.files[0].destinationPath;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const original = fs.readFileSync(m.files[0].sourcePath);
    fs.writeFileSync(dest, original);
    // Second source disappears → run fails after the first entry.
    fs.unlinkSync(m.files[1].sourcePath);

    assert.throws(() => installRelease(m, p));
    assert.deepStrictEqual(fs.readFileSync(dest), original, 'pre-existing file intact');
  });

  // --- HIGH 2: oversized anchor must not discard user commentary ---------
  test('R2 oversized selector keeps the user commentary', () => {
    const root = tmp();
    const artifact = path.join(root, 'plan.md');
    fs.writeFileSync(artifact, '# Plan\n');
    const store = createSessionStore({ stateDir: path.join(root, 'state') });
    store.open(artifact);
    const key = store.findByFile(artifact).key;

    const result = store.queueFeedback(key, [{
      kind: 'annotation',
      text: 'this heading is wrong',
      anchor: { selector: 'x'.repeat(900), tag: 'h1', snippet: 'Heading' }
    }]);
    assert.strictEqual(result.accepted.length, 1, 'item accepted, not dropped');
    assert.ok(result.accepted[0].text.includes('heading is wrong'));
    assert.ok(result.accepted[0].anchor.selector.length <= 500, 'selector truncated');
  });

  test('R2b oversized text range keeps the user commentary', () => {
    const root = tmp();
    const artifact = path.join(root, 'plan.md');
    fs.writeFileSync(artifact, '# Plan\n');
    const store = createSessionStore({ stateDir: path.join(root, 'state') });
    store.open(artifact);
    const key = store.findByFile(artifact).key;

    const result = store.queueFeedback(key, [{
      kind: 'annotation',
      text: 'see highlighted text',
      anchor: { selector: '#a', tag: 'p', snippet: 's', textRange: { text: 'y'.repeat(5000) } }
    }]);
    assert.strictEqual(result.accepted.length, 1);
    assert.ok(result.accepted[0].anchor.textRange.text.length <= 1000);
  });

  // --- MEDIUM 3: dedupe must not key off a path substring ----------------
  test('R3 agent dedupe ignores a checkout path containing "agents"', () => {
    const adapter = require('../../scripts/lib/install-targets/antigravity-cli');
    const root = path.join(tmp(), 'ai-agents', 'checkout');
    fs.mkdirSync(root, { recursive: true });
    const ops = adapter.planOperations(
      {
        modules: [{ id: 'core', paths: ['commands/plan.md', 'skills/tdd-workflow'] }],
        repoRoot: path.join(__dirname, '..', '..'),
        projectRoot: root
      },
      adapter
    );
    const dests = ops.map(o => o.destinationPath.replace(/\\/g, '/'));
    assert.ok(dests.some(d => d.endsWith('/skills/opl-plan/SKILL.md')), 'command projection survived');
    assert.ok(dests.some(d => d.includes('opl-tdd')), 'skill projection survived');
  });

  // --- MEDIUM 4: case-insensitive dedupe keys ----------------------------
  test('R4 agent dedupe is case-insensitive', () => {
    const root = tmp();
    const ops = makeOps(root);
    // Same destination differing only in case must be caught by the manifest.
    ops.push({
      sourcePath: writeSource(root, 'skills/dup/SKILL.md', '# dup\n'),
      sourceRelativePath: 'skills/dup/SKILL.md',
      destinationPath: ops[0].destinationPath.replace('SKILL.md', 'skill.md')
    });
    assert.throws(
      () => generateReleaseManifest({ operations: ops, target: 'antigravity-cli' }),
      /duplicate destination/i
    );
  });

  // --- MEDIUM 5: symlinked destination must not be followed --------------
  test('R5 detectManagedConflicts does not follow a symlinked destination', () => {
    const root = tmp();
    const m = generateReleaseManifest({ operations: makeOps(root), target: 'antigravity-cli' });
    const p = installPaths(root);
    const outside = path.join(root, 'outside.txt');
    fs.writeFileSync(outside, 'SECRET OUTSIDE\n');
    const dest = m.files[0].destinationPath;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.symlinkSync(outside, dest);

    const ledger = buildOwnershipLedger(m, p.projectRoot);
    const conflicts = detectManagedConflicts(ledger, m);
    assert.ok(
      conflicts.some(c => c.destinationPath === dest && c.kind === 'unmanaged'),
      'symlink treated as unmanaged, content not read through it'
    );
  });

  // --- MEDIUM 6: relative destination resolves against root --------------
  test('R6 relative destination resolves against projectRoot, not cwd', () => {
    const root = tmp();
    const m = generateReleaseManifest({ operations: makeOps(root), target: 'antigravity-cli' });
    const p = installPaths(root);
    const relManifest = {
      ...m,
      files: m.files.map(f => ({
        ...f,
        destinationPath: path.relative(p.projectRoot, f.destinationPath)
      }))
    };
    installRelease(relManifest, p);
    for (const f of m.files) {
      assert.ok(fs.existsSync(f.destinationPath), `installed ${f.destinationPath}`);
    }
  });

  // --- LOW 8: untagged clobber message is readable -----------------------
  test('R8 untagged clobber error does not say "undefined"', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'scripts/lib/workflow-state.js'),
      'utf8'
    );
    assert.ok(
      !/switch to "\$\{state\.conversationId\}"/.test(src),
      'error message no longer interpolates a bare conversationId'
    );
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

runTests();
