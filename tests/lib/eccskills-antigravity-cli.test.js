/**
 * Phase A6 — Canonical Distribution Manager, Packaging & Rollback Engine.
 *
 * Run with: node tests/lib/eccskills-antigravity-cli.test.js
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
  _legacyInstallRelease: installRelease,
  _legacyRollbackRelease: rollbackRelease,
  A6_CANONICAL_COMMIT
} = require('../../scripts/lib/eccskills-distribution');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed += 1; }
  catch (error) { console.log(`  ✗ ${name}\n    ${error.message}`); failed += 1; }
}
function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'eccskills-a6-')); }
function sha(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

function makeOps(root) {
  const ops = [];
  for (const [rel, content] of [
    ['skills/opl-tdd/SKILL.md', '# opl-tdd\n'],
    ['agents/opl-code-reviewer.md', 'name: opl-code-reviewer\n'],
  ]) {
    const src = path.join(root, 'src', rel);
    fs.mkdirSync(path.dirname(src), { recursive: true });
    fs.writeFileSync(src, content);
    ops.push({ sourcePath: src, sourceRelativePath: rel, destinationPath: path.join(root, 'proj', '.agents', rel) });
  }
  return ops;
}

function runTests() {
  console.log('\n=== Phase A6: Distribution Manager & Rollback ===\n');

  test('manifest is deterministic and bound to canonical commit + target', () => {
    const root = tmp();
    const ops = makeOps(root);
    const a = generateReleaseManifest({ operations: ops, target: 'antigravity-cli' });
    const b = generateReleaseManifest({ operations: ops, target: 'antigravity-cli' });
    assert.strictEqual(a.sha256, b.sha256);
    assert.strictEqual(a.canonicalCommit, A6_CANONICAL_COMMIT);
    assert.strictEqual(a.target, 'antigravity-cli');
    assert.match(a.sha256, /^[a-f0-9]{64}$/);
  });

  test('manifest records source/destination/size/sha256 per file, sorted', () => {
    const root = tmp();
    const ops = makeOps(root);
    const m = generateReleaseManifest({ operations: ops, target: 'antigravity-cli' });
    assert.strictEqual(m.files.length, 2);
    assert.strictEqual(m.files[0].destinationPath, m.files.map(f => f.destinationPath).sort()[0]);
    for (const f of m.files) {
      assert.match(f.sha256, /^[a-f0-9]{64}$/);
      assert.strictEqual(f.size, Buffer.byteLength(fs.readFileSync(f.sourcePath)));
    }
  });

  test('manifest excludes audit/session files and supports dependency closure', () => {
    const root = tmp();
    const ops = makeOps(root);
    ops.push({ sourcePath: path.join(root, 'audit.jsonl'), sourceRelativePath: '.guardian-angel/audit.jsonl', destinationPath: path.join(root, 'proj', '.guardian-angel/audit.jsonl') });
    const m = generateReleaseManifest({ operations: ops, target: 'antigravity-cli', dependencyClosure: { node: process.version, agy: '1.5.16' } });
    assert.ok(!m.files.some(f => f.sourceRelativePath.includes('guardian-angel')));
    assert.strictEqual(m.dependencyClosure.agy, '1.5.16');
  });

  test('ownership ledger separates managed files from user files', () => {
    const root = tmp();
    const m = generateReleaseManifest({ operations: makeOps(root), target: 'antigravity-cli' });
    const ledger = buildOwnershipLedger(m, path.join(root, 'proj'));
    assert.ok(ledger.managed[Object.keys(ledger.managed)[0]]);
    assert.deepStrictEqual(ledger.userModified, []);
  });

  test('dry-run conflict detection reports modified managed files without writing', () => {
    const root = tmp();
    const m = generateReleaseManifest({ operations: makeOps(root), target: 'antigravity-cli' });
    const projectRoot = path.join(root, 'proj');
    const ledger = buildOwnershipLedger(m, projectRoot);
    const dest = m.files[0].destinationPath;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, 'USER EDIT\n');
    const conflicts = detectManagedConflicts(ledger, m);
    assert.ok(conflicts.some(c => c.destinationPath === dest));
  });

  test('install writes files + ledger; rollback restores & preserves user edits', () => {
    const root = tmp();
    const m = generateReleaseManifest({ operations: makeOps(root), target: 'antigravity-cli' });
    const projectRoot = path.join(root, 'proj');
    const ledgerPath = path.join(projectRoot, '.agents', '.ecc-managed-manifest.json');
    const backupRoot = path.join(projectRoot, '.agents', '.ecc-backup');

    installRelease(m, { projectRoot, ledgerPath, backupRoot });
    const installed = m.files[0].destinationPath;
    assert.strictEqual(sha(fs.readFileSync(installed)), m.files[0].sha256);
    assert.ok(fs.existsSync(ledgerPath));

    // User edits one managed file after install.
    fs.writeFileSync(installed, 'USER LATER EDIT\n');
    const userHash = sha(fs.readFileSync(installed));

    rollbackRelease({ projectRoot, ledgerPath, backupRoot });
    assert.strictEqual(sha(fs.readFileSync(installed)), userHash, 'user edit preserved');
    assert.ok(!fs.existsSync(ledgerPath), 'ledger removed after rollback');
  });

  test('unknown target is rejected', () => {
    assert.throws(() => generateReleaseManifest({ operations: [], target: 'bogus' }), /unsupported target/);
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

runTests();
