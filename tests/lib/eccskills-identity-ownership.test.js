/**
 * Minimal release closure — destination identity (§1) and unmanaged identical
 * file ownership (§2).
 *
 * Run with: node tests/lib/eccskills-identity-ownership.test.js
 */
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  generateReleaseManifest,
  _legacyInstallRelease: installRelease,
  _legacyRollbackRelease: rollbackRelease
} = require('../../scripts/lib/eccskills-distribution');

let passed = 0;
let failed = 0;
const TEMP_DIRS = [];
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed += 1; }
  catch (e) { console.log(`  ✗ ${name}\n    ${e.message.split('\n')[0]}`); failed += 1; }
}
function tmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TEMP_DIRS.push(d);
  return d;
}
function sha(b) { return crypto.createHash('sha256').update(b).digest('hex'); }
function src(root, rel, content) {
  const p = path.join(root, 'src', rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  return p;
}
function opsFor(root, version) {
  return [{
    sourcePath: src(root, 'skills/opl-a/SKILL.md', `# a ${version}\n`),
    sourceRelativePath: 'skills/opl-a/SKILL.md',
    destinationPath: '.agents/skills/opl-a/SKILL.md'
  }];
}
function paths(proj) {
  return {
    projectRoot: proj,
    ledgerPath: path.join(proj, '.agents', '.ecc-managed.json'),
    backupRoot: path.join(proj, '.agents', '.ecc-backup')
  };
}
/** Run fn with cwd moved to an unrelated directory. */
function fromElsewhere(fn) {
  const previous = process.cwd();
  const elsewhere = tmp('elsewhere-');
  process.chdir(elsewhere);
  try { return fn(); } finally { process.chdir(previous); }
}

function runTests() {
  console.log('\n=== Minimal release closure: identity + ownership ===\n');

  // ---- §1 destination identity ----

  test('D1 relative destination resolves against projectRoot, not cwd', () => {
    const root = tmp('id1-');
    const proj = path.join(root, 'proj');
    const m = generateReleaseManifest({ operations: opsFor(root, 'v1'), target: 'antigravity-cli' });
    fromElsewhere(() => installRelease(m, paths(proj)));

    assert.ok(fs.existsSync(path.join(proj, '.agents/skills/opl-a/SKILL.md')), 'installed under projectRoot');
    assert.strictEqual(fs.readFileSync(path.join(proj, '.agents/skills/opl-a/SKILL.md'), 'utf8'), '# a v1\n');
  });

  test('D2 pre-existing unmanaged destination is refused, not overwritten', () => {
    const root = tmp('id2-');
    const proj = path.join(root, 'proj');
    const dest = path.join(proj, '.agents/skills/opl-a/SKILL.md');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, 'USER PRECIOUS\n');

    const m = generateReleaseManifest({ operations: opsFor(root, 'v1'), target: 'antigravity-cli' });
    assert.throws(() => fromElsewhere(() => installRelease(m, paths(proj))), /unmanaged/i);
    assert.strictEqual(fs.readFileSync(dest, 'utf8'), 'USER PRECIOUS\n');
  });

  test('D3 ledger keys are project-relative, never contain ..', () => {
    const root = tmp('id3-');
    const proj = path.join(root, 'proj');
    const p = paths(proj);
    const m = generateReleaseManifest({ operations: opsFor(root, 'v1'), target: 'antigravity-cli' });
    fromElsewhere(() => installRelease(m, p));

    const ledger = JSON.parse(fs.readFileSync(p.ledgerPath, 'utf8'));
    const keys = Object.keys(ledger.managed);
    assert.ok(keys.length > 0);
    for (const key of keys) {
      assert.ok(!key.includes('..'), `ledger key escapes: ${key}`);
      assert.strictEqual(key, '.agents/skills/opl-a/SKILL.md');
    }
  });

  test('D4 fresh relative install then rollback removes the installed file', () => {
    const root = tmp('id4-');
    const proj = path.join(root, 'proj');
    const p = paths(proj);
    const m = generateReleaseManifest({ operations: opsFor(root, 'v1'), target: 'antigravity-cli' });
    fromElsewhere(() => installRelease(m, p));

    const dest = path.join(proj, '.agents/skills/opl-a/SKILL.md');
    assert.ok(fs.existsSync(dest));

    fromElsewhere(() => rollbackRelease(p));
    assert.ok(!fs.existsSync(dest), 'installed file removed by rollback');
    assert.ok(!fs.existsSync(p.ledgerPath), 'ledger removed');
  });

  // ---- §2 identical unmanaged file ownership ----

  test('O1 identical unmanaged file is not adopted into the ledger', () => {
    const root = tmp('own1-');
    const proj = path.join(root, 'proj');
    const p = paths(proj);
    const dest = path.join(proj, '.agents/skills/opl-a/SKILL.md');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, '# a v1\n');   // user owns a file that already matches v1

    const m = generateReleaseManifest({ operations: opsFor(root, 'v1'), target: 'antigravity-cli' });
    fromElsewhere(() => installRelease(m, p));

    const ledger = JSON.parse(fs.readFileSync(p.ledgerPath, 'utf8'));
    assert.ok(!Object.hasOwn(ledger.managed, '.agents/skills/opl-a/SKILL.md'),
      'user-owned file must not be claimed as managed');
    assert.deepStrictEqual(ledger.added, [], 'nothing was created');
  });

  test('O2 upgrading to v2 refuses to overwrite the still-unmanaged file', () => {
    const root = tmp('own2-');
    const proj = path.join(root, 'proj');
    const p = paths(proj);
    const dest = path.join(proj, '.agents/skills/opl-a/SKILL.md');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, '# a v1\n');

    const m1 = generateReleaseManifest({ operations: opsFor(root, 'v1'), target: 'antigravity-cli' });
    fromElsewhere(() => installRelease(m1, p));

    const m2 = generateReleaseManifest({ operations: opsFor(root, 'v2'), target: 'antigravity-cli' });
    assert.throws(() => fromElsewhere(() => installRelease(m2, p)), /unmanaged/i);
    assert.strictEqual(fs.readFileSync(dest, 'utf8'), '# a v1\n', 'user file untouched');
  });

  test('O3 explicit force adopts and upgrades, then rollback restores user content', () => {
    const root = tmp('own3-');
    const proj = path.join(root, 'proj');
    const p = paths(proj);
    const dest = path.join(proj, '.agents/skills/opl-a/SKILL.md');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, '# a v1\n');

    const m1 = generateReleaseManifest({ operations: opsFor(root, 'v1'), target: 'antigravity-cli' });
    fromElsewhere(() => installRelease(m1, p));

    const m2 = generateReleaseManifest({ operations: opsFor(root, 'v2'), target: 'antigravity-cli' });
    fromElsewhere(() => installRelease(m2, { ...p, force: true }));
    assert.strictEqual(fs.readFileSync(dest, 'utf8'), '# a v2\n');

    fromElsewhere(() => rollbackRelease(p));
    assert.strictEqual(fs.readFileSync(dest, 'utf8'), '# a v1\n', 'rollback restores pre-force content');
  });

  test('O4 owned file upgraded without force updates normally', () => {
    const root = tmp('own4-');
    const proj = path.join(root, 'proj');
    const p = paths(proj);
    const m1 = generateReleaseManifest({ operations: opsFor(root, 'v1'), target: 'antigravity-cli' });
    fromElsewhere(() => installRelease(m1, p));

    const m2 = generateReleaseManifest({ operations: opsFor(root, 'v2'), target: 'antigravity-cli' });
    fromElsewhere(() => installRelease(m2, p));

    const dest = path.join(proj, '.agents/skills/opl-a/SKILL.md');
    assert.strictEqual(fs.readFileSync(dest, 'utf8'), '# a v2\n');
  });

  test('A1 public installRelease is unavailable; canonical installer is the authority', () => {
    const mod = require('../../scripts/lib/eccskills-distribution');
    assert.throws(() => mod.installRelease({ files: [] }, {}), /canonical installer/i);
    assert.throws(() => mod.rollbackRelease({}), /canonical installer/i);
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  for (const dir of TEMP_DIRS) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ } }
  if (failed > 0) process.exitCode = 1;
}

runTests();
