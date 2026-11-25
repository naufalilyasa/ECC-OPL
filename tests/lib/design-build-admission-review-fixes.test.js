/**
 * Round-7 review fixes.
 *
 * Run with: node tests/lib/design-build-admission-review-fixes.test.js
 */
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

let passed = 0;
let failed = 0;
const TEMP_DIRS = [];

async function test(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed += 1; }
  catch (error) { console.log(`  ✗ ${name}\n    ${error.message.split('\n')[0]}`); failed += 1; }
}

function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-admission-r7-'));
  TEMP_DIRS.push(dir);
  return dir;
}

function sha(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

// Minimal decodable PNGs at two distinct sizes, mirroring real evidence.
// Playwright lives in the E2E scratch dir, not the repo's node_modules.
const PW_DIR = process.env.E2E_PLAYWRIGHT_DIR
  || '/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright';

function png(width, height) {
  const { execFileSync } = require('child_process');
  const out = path.join(tmp(), `x-${width}x${height}.png`);
  const script = `
    const { createRequire } = require('node:module');
    const req = createRequire(${JSON.stringify(path.join(PW_DIR, 'package.json'))});
    const { chromium } = req('playwright');
    (async () => {
      const b = await chromium.launch();
      const p = await b.newPage({ viewport: { width: ${width}, height: ${height} } });
      await p.setContent('<body style="background:#123"><h1>x</h1></body>');
      await p.screenshot({ path: ${JSON.stringify(out)} });
      await b.close();
    })();
  `;
  execFileSync(process.execPath, ['-e', script], { stdio: 'pipe' });
  return fs.readFileSync(out);
}

async function run() {
  console.log('\n=== Round-7 admission review fixes ===\n');

  const gate = await import('../../scripts/lib/design-build-antigravity-gate.mjs');
  const admission = await import('../../scripts/design-build-v2/track-a-admission.mjs');
  const capture = await import('../../scripts/design-build-v2/capture-project-evidence.mjs');

  const desktop = png(1440, 900);
  const mobile = png(390, 844);

  function cert(overrides = {}) {
    return {
      status: 'ADMITTED',
      approvedBundleSha256: 'a'.repeat(64),
      profileDimensions: { 'desktop-1440': [1440, 900], 'mobile-390': [390, 844] },
      gateResults: {
        G0_preflight: 'PASS',
        G1_contract: 'PASS',
        G2_rendered_fidelity: 'PASS',
        G3_state_interaction: 'PASS'
      },
      gateSequence: admission.CANONICAL_GATE_SEQUENCE,
      captures: {
        'desktop-1440': { verdict: 'PARITY_PASS', referenceSha256: sha(desktop), candidateSha256: sha(desktop) },
        'mobile-390': { verdict: 'PARITY_PASS', referenceSha256: sha(mobile), candidateSha256: sha(mobile) }
      },
      renderedEvidence: { verified: true, source: 'chromium-playwright' },
      ...overrides
    };
  }
  const images = { 'desktop-1440': { reference: desktop, candidate: desktop }, 'mobile-390': { reference: mobile, candidate: mobile } };

  // A1 (HIGH 1): a FAILED G0/G1/G3 must block even when evidence is perfect.
  await test('A1 non-G2 gate failure blocks admission', () => {
    for (const gateName of ['G0_preflight', 'G1_contract', 'G3_state_interaction']) {
      const c = cert({ gateResults: { ...cert().gateResults, [gateName]: 'FAIL' } });
      const result = gate.enforceTrackAAdmission(c, images);
      assert.strictEqual(result.status, 'BLOCKED', `${gateName} FAIL must block`);
    }
  });

  await test('A2 missing G0/G1/G3 entry blocks admission', () => {
    const c = cert({ gateResults: { G2_rendered_fidelity: 'PASS' } });
    const result = gate.enforceTrackAAdmission(c, images);
    assert.strictEqual(result.status, 'BLOCKED');
  });

  await test('A3 complete chain with real evidence admits', () => {
    const rev = sha(Buffer.from('rev-a3'));
    const result = gate.enforceTrackAAdmission(
      cert({ candidateRevisionSha256: rev }),
      images,
      { currentRevisionSha256: rev }
    );
    assert.strictEqual(result.status, 'OK', JSON.stringify(result));
  });

  // A4 (HIGH 2): a producer-built certificate must survive load → enforce.
  await test('A4 producer certificate round-trips through loadAdmissionImages', async () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'desktop-1440-reference.png'), desktop);
    fs.writeFileSync(path.join(dir, 'desktop-1440-candidate.png'), desktop);
    fs.writeFileSync(path.join(dir, 'mobile-390-reference.png'), mobile);
    fs.writeFileSync(path.join(dir, 'mobile-390-candidate.png'), mobile);
    const rev = sha(Buffer.from('rev-a4'));
    const producer = cert({ candidateRevisionSha256: rev });
    const certPath = path.join(dir, 'track-a-admission.json');
    fs.writeFileSync(certPath, JSON.stringify(producer, null, 2));

    const loaded = gate.loadAdmissionImages(producer, certPath);
    assert.ok(loaded['desktop-1440'], 'desktop images must load from the certificate directory convention');
    assert.strictEqual(sha(loaded['desktop-1440'].reference), sha(desktop));
    const result = gate.enforceTrackAAdmission(producer, loaded, { currentRevisionSha256: rev });
    assert.strictEqual(result.status, 'OK', JSON.stringify(result));
  });

  // A5 (MEDIUM): loader must not read outside the evidence directory.
  await test('A5 loader refuses paths outside the certificate directory', () => {
    const dir = tmp();
    const outside = path.join(tmp(), 'secret.png');
    fs.writeFileSync(outside, desktop);
    const c = cert({
      captures: {
        'desktop-1440': { verdict: 'PARITY_PASS', referencePath: '../../../../' + path.basename(outside) },
        'mobile-390': { verdict: 'PARITY_PASS' }
      }
    });
    const loaded = gate.loadAdmissionImages(c, path.join(dir, 'cert.json'));
    assert.ok(!loaded['desktop-1440'], 'traversal must be refused');
  });

  // A6 (MEDIUM): vacuous ternary in the evidence generator.
  await test('A6 closure evidence derives verdicts, never hardcodes PARITY_PASS', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../scripts/design-build-v2/closure-evidence.mjs'), 'utf8');
    assert.ok(
      !/find\(r => r\.code\)\s*\?\s*'PARITY_PASS'\s*:\s*'PARITY_PASS'/.test(src),
      'a ternary with identical branches is not a verdict'
    );
  });

  // A7 (MEDIUM): comment restore must not corrupt literal placeholder text.
  await test('A7 inlineAssets does not corrupt literal placeholder text', () => {
    const dir = tmp();
    // Literal text that resembles the old sentinel must survive verbatim.
    const html = '<html><head><link rel="stylesheet" href="style.css"></head><body>A\u0000COMMENT0\u0000B</body></html>';
    fs.writeFileSync(path.join(dir, 'index.html'), html);
    fs.writeFileSync(path.join(dir, 'style.css'), 'body{color:red}');
    const out = capture.inlineAssets(html, 'body{color:red}');
    assert.ok(out.includes('A\u0000COMMENT0\u0000B'), 'literal placeholder text must survive');
    assert.ok(!/undefined/.test(out), 'no placeholder may resolve to undefined');
    assert.ok(out.includes('<style>body{color:red}</style>'), 'css must be inlined');
  });

  // A8 (LOW): landmarkProfileKey must be order-independent.
  await test('A8 landmarkProfileKey is order-independent', async () => {
    const rp = await import('../../scripts/design-build-v2/render-parity.mjs');
    const a = [{ name: 'a', selector: '.a', props: ['display'] }, { name: 'b', selector: '.b', props: ['display'] }];
    const b = [a[1], a[0]];
    assert.strictEqual(rp.landmarkProfileKey(a), rp.landmarkProfileKey(b));
  });

  for (const dir of TEMP_DIRS) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

run();
