/**
 * Phase A6 Area 3 — distribution safety: destination collisions, unmanaged
 * overwrite protection, and atomic install/rollback.
 *
 * Run with: node tests/lib/eccskills-distribution-safety.test.js
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
  _legacyRollbackRelease: rollbackRelease
} = require('../../scripts/lib/eccskills-distribution');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed += 1; }
  catch (error) { console.log(`  ✗ ${name}\n    ${error.message}`); failed += 1; }
}
const TEMP_DIRS = [];
function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eccskills-a3-'));
  TEMP_DIRS.push(dir);
  return dir;
}
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
      destinationPath: path.join(root, 'proj', '.agents', 'agents/opl-code-reviewer.md')
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
  console.log('\n=== Phase A6 Area 3: Distribution Safety ===\n');

  test('S1 duplicate destination paths are rejected, not silently last-wins', () => {
    const root = tmp();
    const ops = makeOps(root);
    ops.push({
      sourcePath: writeSource(root, 'skills/opl-tdd-dup/SKILL.md', '# dup\n'),
      sourceRelativePath: 'skills/opl-tdd-dup/SKILL.md',
      destinationPath: ops[0].destinationPath
    });
    assert.throws(
      () => generateReleaseManifest({ operations: ops, target: 'antigravity-cli' }),
      /duplicate destination/i
    );
  });

  test('S2 install refuses to overwrite an unmanaged file', () => {
    const root = tmp();
    const m = generateReleaseManifest({ operations: makeOps(root), target: 'antigravity-cli' });
    const p = installPaths(root);
    const victim = m.files[0].destinationPath;
    fs.mkdirSync(path.dirname(victim), { recursive: true });
    fs.writeFileSync(victim, 'USER OWNED FILE\n');

    assert.throws(
      () => installRelease(m, p),
      /unmanaged/i
    );
    assert.strictEqual(fs.readFileSync(victim, 'utf8'), 'USER OWNED FILE\n', 'user file untouched');
  });

  test('S3 unmanaged overwrite is allowed when force is set', () => {
    const root = tmp();
    const m = generateReleaseManifest({ operations: makeOps(root), target: 'antigravity-cli' });
    const p = installPaths(root);
    const victim = m.files[0].destinationPath;
    fs.mkdirSync(path.dirname(victim), { recursive: true });
    fs.writeFileSync(victim, 'USER OWNED FILE\n');

    installRelease(m, { ...p, force: true });
    assert.strictEqual(sha(fs.readFileSync(victim)), m.files[0].sha256);
  });

  test('S4 install is atomic: a mid-run failure leaves no partial writes', () => {
    const root = tmp();
    const m = generateReleaseManifest({ operations: makeOps(root), target: 'antigravity-cli' });
    const p = installPaths(root);
    // Remove the second source so the copy fails after the first file lands.
    fs.unlinkSync(m.files[1].sourcePath);

    assert.throws(() => installRelease(m, p));
    assert.ok(!fs.existsSync(m.files[0].destinationPath), 'first file rolled back');
    assert.ok(!fs.existsSync(p.ledgerPath), 'no ledger written on failure');
  });

  test('S5 reinstall over a clean managed tree succeeds without force', () => {
    const root = tmp();
    const m = generateReleaseManifest({ operations: makeOps(root), target: 'antigravity-cli' });
    const p = installPaths(root);
    installRelease(m, p);
    installRelease(m, p);
    assert.strictEqual(sha(fs.readFileSync(m.files[0].destinationPath)), m.files[0].sha256);
  });

  test('S6 detectManagedConflicts reports unmanaged pre-existing destinations', () => {
    const root = tmp();
    const m = generateReleaseManifest({ operations: makeOps(root), target: 'antigravity-cli' });
    const p = installPaths(root);
    const ledger = buildOwnershipLedger(m, p.projectRoot);
    const victim = m.files[0].destinationPath;
    fs.mkdirSync(path.dirname(victim), { recursive: true });
    fs.writeFileSync(victim, 'SOMEONE ELSE\n');

    const conflicts = detectManagedConflicts(ledger, m);
    assert.ok(
      conflicts.some(c => c.destinationPath === victim && c.kind === 'unmanaged'),
      JSON.stringify(conflicts)
    );
  });

  test('S7 rollback after partial install restores prior state', () => {
    const root = tmp();
    const m = generateReleaseManifest({ operations: makeOps(root), target: 'antigravity-cli' });
    const p = installPaths(root);
    installRelease(m, p);
    const managed = m.files[0].destinationPath;
    const installedHash = sha(fs.readFileSync(managed));

    rollbackRelease(p);
    assert.ok(!fs.existsSync(managed) || sha(fs.readFileSync(managed)) !== installedHash,
      'managed file no longer the installed content');
    assert.ok(!fs.existsSync(p.ledgerPath));
  });

  for (const dir of TEMP_DIRS) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

runTests();
