/**
 * Focused functional acceptance for the design-build V2 product-direction and
 * accessibility integration (no V3, no new gate, no new validator framework).
 *
 * Run with: node tests/lib/design-build-direction-a11y.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..', '..');
const { resolveOpencodeConfigRoot } = require(path.join(REPO, 'scripts/lib/opencode-paths'));
const SKILL = fs.readFileSync(path.join(REPO, 'skills/design-build/SKILL.md'), 'utf8');
const SHIM = fs.readFileSync(path.join(REPO, 'commands/design-build.md'), 'utf8');
const SHIM_OS = fs.readFileSync(path.join(REPO, '.opencode/commands/design-build.md'), 'utf8');
const CHECKER = path.join(REPO, 'skills/frontend-design-direction/scripts/check-evidence.js');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(REPO, 'staging/distribution/design-build-v2-manifest.json'), 'utf8'));
// a11y is an installed (unbundled) skill; resolve through the canonical config-root
// helper so OPENCODE_CONFIG_DIR / XDG_CONFIG_HOME are honored, not a fixed home.
const A11Y_ROOT = path.join(resolveOpencodeConfigRoot(), 'skills', 'a11y');
const A11Y_CONTRAST = path.join(A11Y_ROOT, 'scripts/contrast_checker.py');
const A11Y_SKILL = path.join(A11Y_ROOT, 'SKILL.md');

let passed = 0;
let failed = 0;
let skipped = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed += 1; }
  catch (error) { console.log(`  ✗ ${name}\n    ${error.message.split('\n')[0]}`); failed += 1; }
}
function skip(name, reason) {
  console.log(`  ⊘ ${name} — skipped: ${reason}`);
  skipped += 1;
}

const TEMP_DIRS = [];
function tmpReport(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-direction-a11y-'));
  TEMP_DIRS.push(dir);
  // Minimal valid PNG (1x1).
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000100f6c8ce550000000049454e44ae426082', 'hex');
  fs.writeFileSync(path.join(dir, 'shot.png'), png);
  const base = {
    contract: 'Rlogic WMS item master — dense, scannable, task-first',
    targetViewports: ['1440x900'],
    accessibility: { status: 'pass', evidence: 'keyboard order verified on served route' },
    responsive: { status: 'pass', evidence: 'no overflow at 390px and 1440px' },
    contentStates: {
      loading: { status: 'pass', evidence: 'table skeleton observed' },
      empty: { status: 'not-applicable', reason: 'fixture always seeds one row' },
      error: { status: 'pass', evidence: 'save error alert observed' },
      partial: { status: 'pass', evidence: 'two columns hidden with reason' },
      success: { status: 'pass', evidence: 'save confirmation observed' },
      permission: { status: 'not-applicable', reason: 'single authorized role in fixture' }
    },
    renderedEvidence: [{
      viewport: '1440x900', artifact: 'shot.png',
      observation: 'rendered table matches approved contract'
    }],
    ...overrides
  };
  const file = path.join(dir, 'report.json');
  fs.writeFileSync(file, JSON.stringify(base));
  return { dir, file, base };
}

function runChecker(file) {
  try {
    const out = execFileSync(process.execPath, [CHECKER, file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, out };
  } catch (error) {
    return { ok: false, out: String(error.stderr || '') };
  }
}

async function runTests() {
  console.log('\n=== design-build product-direction + a11y integration ===\n');

  // 1. Actual routing present in canonical skill + both shims.
  await test('D1 routing: frontend-design-direction and a11y wired by reference', () => {
    assert.match(SKILL, /frontend-design-direction/);
    assert.match(SKILL, /primary accessibility knowledge source/);
    assert.match(SHIM, /Phase 0 loads `frontend-design-direction`/);
    assert.match(SHIM_OS, /Phase 0 loads `frontend-design-direction`/);
    assert.match(SHIM, /A7 — Rendered finish evidence checker/);
    assert.match(SHIM_OS, /A7 — Rendered finish evidence checker/);
  });

  // 2. Product-appropriate direction + content states + G0-G3 extension.
  await test('D2 direction, content states, blocking G0-G3 recorded in skill', () => {
    for (const s of ['loading', 'empty', 'error', 'partial', 'success', 'permission']) {
      assert.ok(SKILL.includes(s), `missing state ${s}`);
    }
    for (const g of ['**G0**', '**G1**', '**G2**', '**G3**']) assert.ok(SKILL.includes(g), `missing ${g}`);
    assert.match(SKILL, /Accessibility findings are \*\*blocking\*\*/);
    assert.match(SKILL, /UNTESTED_FOR_FRAMEWORK/);
  });

  // 3-5. Checker: valid report, missing rendered evidence, placeholder observation.
  await test('D3 checker accepts complete local evidence report', () => {
    const r = tmpReport();
    const result = runChecker(r.file);
    assert.strictEqual(result.ok, true, result.out);
  });

  await test('D4 checker rejects missing required viewport evidence', () => {
    const r = tmpReport({ renderedEvidence: [] });
    const result = runChecker(r.file);
    assert.strictEqual(result.ok, false);
    assert.match(result.out, /renderedEvidence is missing target viewport 1440x900/);
  });

  await test('D5 checker rejects not-applicable without reason (placeholder gap)', () => {
    const r = tmpReport();
    const states = { ...r.base.contentStates, error: { status: 'not-applicable' } };
    fs.writeFileSync(r.file, JSON.stringify({ ...r.base, contentStates: states }));
    const result = runChecker(r.file);
    assert.strictEqual(result.ok, false);
    assert.match(result.out, /contentStates.error needs a passing observation or a not-applicable reason/);
  });

  // 6. Representative a11y failure detected via disposable negative fixture.
  if (fs.existsSync(A11Y_CONTRAST)) {
    await test('D6 a11y negative fixture detected (low contrast fails AA)', () => {
      let out;
      try {
        out = execFileSync('python3', [A11Y_CONTRAST, 'gray', 'white'], { encoding: 'utf8' });
      } catch (error) {
        out = String(error.stdout || ''); // scanner exits 1 when a FAIL is found
      }
      assert.match(out, /\[FAIL\] AA Normal Text/);
    });
  } else {
    skip('D6 a11y negative fixture detected (low contrast fails AA)', 'a11y skill not installed at resolved config root');
  }

  // 7. Path containment enforced.
  await test('D7 checker rejects escaping artifact paths', () => {
    const r = tmpReport({
      renderedEvidence: [{ viewport: '1440x900', artifact: '../escape.png', observation: 'x' }]
    });
    const result = runChecker(r.file);
    assert.strictEqual(result.ok, false);
    assert.match(result.out, /must stay inside the report directory/);
  });

  // 8. Existing state machine / gates intact.
  await test('D8 existing G0-G3 state machine untouched and functional', async () => {
    const sm = await import(pathToFileURL(path.join(REPO, 'scripts/design-build-v2/state-machine.mjs')).href);
    assert.deepStrictEqual(sm.STATES.PARITY_PENDING, 'PARITY_PENDING');
    assert.ok(Object.values(sm.STATES).includes('SECTION_COMPLETE'));
    const missing = sm.verifyReceipt({ schemaVersion: 2 }, null);
    assert.strictEqual(missing.why, 'CONTEXT_REQUIRED');
  });

  // 9. No silent post-approval redesign: repair validator still binds reference.
  await test('D9 repair cannot change approved reference', async () => {
    const sm = await import(pathToFileURL(path.join(REPO, 'scripts/design-build-v2/state-machine.mjs')).href);
    const before = { referenceSha256: 'a'.repeat(64), implementationSha256: 'b'.repeat(64) };
    const after = { referenceSha256: 'c'.repeat(64), implementationSha256: 'd'.repeat(64) };
    assert.strictEqual(sm.verifyFrameworkRepair(before, after).why, 'approvedConsentChanged');
  });

  // 10. Distribution dependency resolution + manifest freshness.
  if (fs.existsSync(A11Y_SKILL)) {
    await test('D10 distribution resolves checker and records updated hashes', () => {
      assert.ok(fs.existsSync(CHECKER), 'repo checker missing');
      assert.ok(MANIFEST.dependencies?.skills, 'manifest missing skills dependencies');
      const crypto = require('crypto');
      for (const rel of ['commands/design-build.md', '.opencode/commands/design-build.md', 'skills/design-build/SKILL.md']) {
        const entry = MANIFEST.files.find(f => f.path === rel);
        const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(REPO, rel))).digest('hex');
        assert.strictEqual(entry.sha256, hash, `stale hash for ${rel}`);
      }
    });
  } else {
    skip('D10 distribution resolves checker and records updated hashes', 'a11y skill not installed at resolved config root');
  }

  // Always clean up disposable report directories, even on a failing run.
  for (const dir of TEMP_DIRS) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }

  console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  if (failed > 0) process.exitCode = 1;
}

runTests().catch(e => { console.error(e); process.exitCode = 1; });
