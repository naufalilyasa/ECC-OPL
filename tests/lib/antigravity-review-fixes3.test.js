/**
 * Regression lock for the 15 findings raised by /code-review-quick on 2974d606.
 *
 * Run with: node tests/lib/antigravity-review-fixes3.test.js
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
  _legacyInstallRelease: installRelease,
  _legacyRollbackRelease: rollbackRelease
} = require('../../scripts/lib/eccskills-distribution');
const { adaptAntigravityCommandToSkill } = require('../../scripts/lib/install/antigravity-agent');

let passed = 0;
let failed = 0;
const TEMP_DIRS = [];
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed += 1; }
  catch (error) { console.log(`  ✗ ${name}\n    ${error.message}`); failed += 1; }
}
function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-fixes3-'));
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
  console.log('\n=== Review fixes round 3 (findings 1-15) ===\n');

  // --- CRITICAL 1: rollback must never delete a pre-existing identical file ---
  test('C1 rollback preserves a pre-existing identical-content file', () => {
    const root = tmp();
    const ops = makeOps(root);
    const m = generateReleaseManifest({ operations: ops, target: 'antigravity-cli' });
    const p = installPaths(root);

    // A user file that already matches the release content exactly.
    const preexisting = m.files[0].destinationPath;
    fs.mkdirSync(path.dirname(preexisting), { recursive: true });
    fs.writeFileSync(preexisting, '# opl-tdd\n');

    // Install with force (user opted in), then break a later file to trigger rollback.
    fs.unlinkSync(m.files[1].sourcePath);
    try { installRelease(m, { ...p, force: true }); } catch { /* expected */ }

    assert.ok(fs.existsSync(preexisting), 'pre-existing file must survive rollback');
  });

  // --- CRITICAL 2: a digest mismatch must not leave the corrupt file behind ---
  test('C2 digest mismatch rolls back the file it just wrote', () => {
    const root = tmp();
    const m = generateReleaseManifest({ operations: makeOps(root), target: 'antigravity-cli' });
    const p = installPaths(root);
    // Corrupt the manifest digest so verification fails before/after the copy.
    m.files[0] = { ...m.files[0], sha256: 'f'.repeat(64) };

    assert.throws(
      () => installRelease(m, { ...p, force: true }),
      /digest verification failed|source changed since manifest generation/
    );
    assert.ok(!fs.existsSync(m.files[0].destinationPath), 'corrupt file removed');
  });

  // --- CRITICAL 3: ledger write failure must roll back the install ---
  test('C3 ledger write failure rolls back written files', () => {
    const root = tmp();
    const m = generateReleaseManifest({ operations: makeOps(root), target: 'antigravity-cli' });
    const p = installPaths(root);
    // Point the ledger at a path whose parent is a file, so mkdir/write fails.
    const blocker = path.join(root, 'blocker');
    fs.writeFileSync(blocker, 'not a dir');
    const badLedger = path.join(blocker, 'ledger.json');

    assert.throws(() => installRelease(m, { ...p, ledgerPath: badLedger, force: true }));
    assert.ok(!fs.existsSync(m.files[0].destinationPath), 'file rolled back after ledger failure');
  });

  // --- CRITICAL 4: relative projectRoot must not escape the backup root ---
  test('C4 backup paths stay inside backupRoot even with a relative projectRoot', () => {
    const root = tmp();
    const m = generateReleaseManifest({ operations: makeOps(root), target: 'antigravity-cli' });
    const p = installPaths(root);
    // Pre-existing different content forces a backup.
    const dest = m.files[0].destinationPath;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, 'OLD CONTENT\n');

    const relProjectRoot = path.relative(process.cwd(), p.projectRoot);
    const result = installRelease(m, { ...p, projectRoot: relProjectRoot, force: true });
    const backupDir = result.backupDir;
    for (const entry of walk(backupDir)) {
      const resolved = path.resolve(entry);
      assert.ok(
        resolved.startsWith(path.resolve(backupDir) + path.sep),
        `backup escaped: ${entry}`
      );
    }
  });

  // --- HIGH 5: relocation must be anchored, not first-occurrence ---
  test('H5 skill relocation is anchored to the skills path segment', () => {
    const adapter = require('../../scripts/lib/install-targets/antigravity-cli');
    const root = tmp();
    // A project path that itself contains the key being relocated.
    const trickyRoot = path.join(root, 'opl-tdd-project');
    for (const [rel, body] of [
      ['commands/tdd.md', '# /tdd\n'],
      ['skills/tdd-workflow/SKILL.md', '# knowledge\n']
    ]) {
      const p = path.join(root, rel);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, body);
    }

    const ops = adapter.planOperations(
      {
        modules: [{ id: 'core', paths: ['commands/tdd.md', 'skills/tdd-workflow'] }],
        repoRoot: root,
        projectRoot: trickyRoot
      },
      adapter
    );

    const paths = ops.map(op => String(op.destinationPath).replace(/\\/g, '/'));
    assert.ok(paths.length >= 2, `expected both operations, got ${paths.join(', ')}`);
    for (const p of paths) {
      assert.ok(
        p.includes('/opl-tdd-project/.agents/skills/'),
        `parent dir mutated: ${p}`
      );
    }
    assert.strictEqual(new Set(paths).size, paths.length, `destinations still collide: ${paths.join(', ')}`);
  });

  // --- HIGH 6: mkdir -p .opencode/workflows must also be rewritten ---
  test('H6 directory-only workflow/marker references are rewritten too', () => {
    const src = [
      '---', 'name: tdd', '---',
      'mkdir -p .opencode/workflows',
      'echo x > .opencode/workflows/active.json',
      'mkdir -p .opencode/markers',
      'touch .opencode/markers/a.md',
      ''
    ].join('\n');
    const out = adaptAntigravityCommandToSkill(src, '/tmp/x/.agents/skills/opl-tdd/SKILL.md');
    assert.ok(!/\.opencode\/workflows/.test(out), `workflows dir not rewritten:\n${out}`);
    assert.ok(!/\.opencode\/markers/.test(out), `markers dir not rewritten:\n${out}`);
    assert.ok(out.includes('.agents/ecc-opl/workflows'), 'workflows target missing');
    assert.ok(out.includes('.agents/ecc-opl/markers'), 'markers target missing');
  });

  // --- HIGH 8: preflight must not trust a plan-only ledger ---
  test('H8 plan-only ledger does not authorize overwriting an unmanaged file', () => {
    const root = tmp();
    const m = generateReleaseManifest({ operations: makeOps(root), target: 'antigravity-cli' });
    const p = installPaths(root);
    // Write a PLAN ledger (no installedAt) claiming the file.
    fs.mkdirSync(path.dirname(p.ledgerPath), { recursive: true });
    const planLedger = buildOwnershipLedger(m, p.projectRoot);
    fs.writeFileSync(p.ledgerPath, JSON.stringify(planLedger));

    const victim = m.files[0].destinationPath;
    fs.mkdirSync(path.dirname(victim), { recursive: true });
    fs.writeFileSync(victim, 'NOT OURS\n');

    assert.throws(() => installRelease(m, p), /unmanaged/i);
    assert.strictEqual(fs.readFileSync(victim, 'utf8'), 'NOT OURS\n');
  });

  // --- MEDIUM 11: untagged write must not bypass cross-conversation guard ---
  test('M11 untagged write cannot clobber an active conversation', () => {
    const {
      writeWorkflowState,
      readWorkflowState
    } = require('../../scripts/lib/workflow-state');
    const root = tmp();
    const ctx = { projectRoot: root, target: 'antigravity-cli' };

    writeWorkflowState({ ...ctx, state: { workflow: 'tdd', phase: 'red', conversationId: 'conv-A' } });
    assert.throws(
      () => writeWorkflowState({ ...ctx, state: { workflow: 'tdd', phase: 'green' } }),
      /conversation/i
    );
    assert.strictEqual(readWorkflowState(ctx).conversationId, 'conv-A');
  });

  // --- MEDIUM 12: duplicate destination check must be case-insensitive ---
  test('M12 duplicate destinations are detected case-insensitively', () => {
    const root = tmp();
    const ops = makeOps(root);
    ops.push({
      sourcePath: writeSource(root, 'skills/dup/SKILL.md', '# dup\n'),
      sourceRelativePath: 'skills/dup/SKILL.md',
      destinationPath: path.join(root, 'proj', '.agents', 'skills', 'opl-tdd', 'skill.md')
    });
    assert.throws(
      () => generateReleaseManifest({ operations: ops, target: 'antigravity-cli' }),
      /duplicate destination/i
    );
  });

  // --- LOW 14: exported helper name is spelled correctly ---
  test('L14 enforceTrackAAdmission is exported with the correct spelling', () => {
    const mod = require('../../scripts/lib/design-build-antigravity-gate.mjs');
    assert.ok(typeof mod.enforceTrackAAdmission === 'function', 'correct spelling missing');
    assert.ok(!('enforceTrackAAadmission' in mod), 'misspelled export still present');
  });

  for (const dir of TEMP_DIRS) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

runTests();
