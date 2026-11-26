/**
 * §4 — production section gate must never advance on failure.
 *
 * Drives the real entrypoint (scripts/design-build-v2/section-gate.mjs) as a
 * subprocess, the way the workflow calls it, and asserts both the exit code and
 * the reported checkpoint. A failed receipt or G2 must leave `current` untouched
 * and must never report SECTION_COMPLETE.
 *
 * Run with: node tests/lib/design-build-section-gate-advance.test.js
 */
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const GATE = path.join(REPO, 'scripts/design-build-v2/section-gate.mjs');
const PW_DIR = process.env.E2E_PLAYWRIGHT_DIR
  || '/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright';

let passed = 0;
let failed = 0;
const TEMP_DIRS = [];
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed += 1; }
  catch (error) { console.log(`  ✗ ${name}\n    ${error.message.split('\n')[0]}`); failed += 1; }
}
function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-gate-advance-'));
  TEMP_DIRS.push(dir);
  return dir;
}
function sha(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

function png(width, height, dir, name) {
  const out = path.join(dir, `${name}.png`);
  const script = `
    const { createRequire } = require('node:module');
    const req = createRequire(${JSON.stringify(path.join(PW_DIR, 'package.json'))});
    const { chromium } = req('playwright');
    (async () => {
      const b = await chromium.launch();
      const p = await b.newPage({ viewport: { width: ${width}, height: ${height} } });
      await p.setContent('<body style="background:#123"><h1>${name}</h1></body>');
      await p.screenshot({ path: ${JSON.stringify(out)} });
      await b.close();
    })();
  `;
  execFileSync(process.execPath, ['-e', script], { stdio: 'pipe' });
  return fs.readFileSync(out);
}

const SECTION = '01-demo-section';
const REVISION = 'r1';
const BUNDLE = 'a'.repeat(64);
const VIEWPORTS = ['desktop-1440', 'mobile-390'];

function buildRequest(dir, { breakReceipt = false } = {}) {
  const candidateSource = path.join(dir, 'candidate.txt');
  fs.writeFileSync(candidateSource, 'export const x = 1\n');
  const candidateHash = sha(fs.readFileSync(candidateSource));

  const viewportEvidence = {};
  const measurements = [];
  for (const vp of VIEWPORTS) {
    const [w, h] = vp === 'desktop-1440' ? [1440, 900] : [390, 844];
    const ref = png(w, h, dir, `${vp}-ref`);
    const cand = png(w, h, dir, `${vp}-cand`);
    fs.writeFileSync(path.join(dir, `${vp}-ref.png`), ref);
    fs.writeFileSync(path.join(dir, `${vp}-cand.png`), cand);
    viewportEvidence[vp] = {
      screenshot: `${vp}-ref.png`,
      candidateScreenshot: `${vp}-cand.png`,
      measurements: [{
        profile: vp, state: 'default', landmark: 'root', property: 'display',
        expected: 'block', actual: 'block', verdict: 'PASS'
      }]
    };
    measurements.push({
      profile: vp, state: 'default', landmark: 'root', property: 'display',
      expected: 'block', actual: 'block', verdict: 'PASS'
    });
  }

  const receipt = {
    schemaVersion: 2,
    sectionId: SECTION,
    revision: REVISION,
    approvedBundleSha256: BUNDLE,
    candidateFileHashes: { 'candidate.txt': candidateHash },
    measurements,
    viewportScreenshots: Object.fromEntries(VIEWPORTS.map(vp => [
      vp, sha(fs.readFileSync(path.join(dir, `${vp}-ref.png`)))
    ])),
    gateResults: {
      G0_preflight: 'PASS',
      G1_contract: 'PASS',
      G2_rendered_fidelity: 'PASS',
      G3_state_interaction: 'PASS'
    },
    overallVerdict: 'PARITY_PASS'
  };

  if (breakReceipt) {
    // Corrupt the declared candidate hash: the actual bytes no longer match.
    receipt.candidateFileHashes['candidate.txt'] = 'b'.repeat(64);
  }

  return {
    module: 'scripts/design-build-v2/section-gate.mjs',
    projectRoot: dir,
    identity: { sectionId: SECTION, revision: REVISION, bundleSha256: BUNDLE },
    active: {
      sectionId: SECTION,
      revision: REVISION,
      approvedBundleSha256: BUNDLE,
      state: 'PARITY_PASS',
      current: 0,
      steps: [SECTION, '02-next-section']
    },
    canvasApproval: {
      verdictId: 'fb-900',
      approved: true,
      sectionId: SECTION,
      revision: REVISION,
      bundleSha256: BUNDLE
    },
    candidateFiles: { 'candidate.txt': 'candidate.txt' },
    frameworkCompleteEvidence: { identitySha256: 'c'.repeat(64) },
    requiredViewports: VIEWPORTS,
    viewportEvidence,
    interactionChecks: [{
      name: 'open panel', applicable: true, observed: true,
      value: 'expanded', before: 'collapsed', after: 'expanded'
    }],
    contractChecks: [{ name: 'tokens', observed: true }],
    profileDimensions: { 'desktop-1440': [1440, 900], 'mobile-390': [390, 844] },
    receipt
  };
}

function runGate(request, dir) {
  const file = path.join(dir, 'request.json');
  fs.writeFileSync(file, JSON.stringify(request, null, 2));
  try {
    const stdout = execFileSync(process.execPath, [GATE, file], { encoding: 'utf8', stdio: 'pipe' });
    return { code: 0, out: JSON.parse(stdout) };
  } catch (error) {
    const out = error.stdout ? JSON.parse(error.stdout) : null;
    return { code: error.status, out };
  }
}

function runTests() {
  console.log('\n=== §4 section gate: failure never advances ===\n');

  test('a clean receipt reaches SECTION_COMPLETE and advances current', () => {
    const dir = tmp();
    const { code, out } = runGate(buildRequest(dir), dir);
    assert.strictEqual(code, 0, JSON.stringify(out?.checkpoint));
    assert.strictEqual(out.checkpoint.state, 'SECTION_COMPLETE');
    assert.strictEqual(out.checkpoint.current, 1, 'current must advance exactly once');
  });

  test('a corrupted candidate hash fails and does NOT advance', () => {
    const dir = tmp();
    const { code, out } = runGate(buildRequest(dir, { breakReceipt: true }), dir);
    assert.strictEqual(code, 1, 'gate must exit non-zero');
    assert.notStrictEqual(out.checkpoint.state, 'SECTION_COMPLETE');
    assert.strictEqual(out.checkpoint.current, 0, 'current must stay untouched');
    assert.strictEqual(out.receipt.code, 'INVALID_RECEIPT');
  });

  test('a failed G2 keeps the section below SECTION_COMPLETE', () => {
    const dir = tmp();
    const request = buildRequest(dir);
    // Remove one viewport's candidate screenshot: parity cannot be verified.
    request.viewportEvidence['mobile-390'].candidateScreenshot = 'missing.png';
    const { code, out } = runGate(request, dir);
    assert.strictEqual(code, 1);
    assert.notStrictEqual(out.checkpoint.state, 'SECTION_COMPLETE');
    assert.strictEqual(out.checkpoint.current, 0);
    assert.notStrictEqual(out.g2.code, 'PARITY_PASS');
  });

  test('a missing canvas approval blocks before any advancement', () => {
    const dir = tmp();
    const request = buildRequest(dir);
    request.canvasApproval = { verdictId: null, approved: false };
    const { code, out } = runGate(request, dir);
    assert.strictEqual(code, 1);
    assert.strictEqual(out.checkpoint.code, 'CANVAS_APPROVAL_INVALID');
    assert.strictEqual(out.checkpoint.current, 0);
  });

  test('PARITY_PENDING never jumps straight to SECTION_COMPLETE', () => {
    const dir = tmp();
    const request = buildRequest(dir);
    request.active.state = 'PARITY_PENDING';
    const { code, out } = runGate(request, dir);
    assert.strictEqual(code, 1, 'SECTION_COMPLETE is not reachable from PARITY_PENDING in one step');
    assert.strictEqual(out.checkpoint.state, 'PARITY_PASS');
    assert.strictEqual(out.checkpoint.current, 0, 'PARITY_PASS must not advance current');
  });

  for (const dir of TEMP_DIRS) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

runTests();
