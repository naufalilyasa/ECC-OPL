/**
 * Admission authority closure — reproduces the four confirmed defects from the
 * Final Product Execution Closure directive, then proves each is closed.
 *
 * (c) canonical verifier admits G1 FAIL
 * (d) digest check is self-referential: any valid PNGs admit when the caller
 *     writes their hashes into its own certificate
 * (e) revision binding fails open when options.currentRevisionSha256 is omitted
 * (f) a symlink inside the evidence dir loads bytes from outside it
 *
 * Run with: node tests/lib/design-build-admission-authority.test.js
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'admission-authority-'));
  TEMP_DIRS.push(dir);
  return dir;
}

function sha(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

const PW_DIR = process.env.E2E_PLAYWRIGHT_DIR
  || '/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright';

function png(width, height, background) {
  const { execFileSync } = require('child_process');
  const out = path.join(tmp(), `x-${width}x${height}-${background.replace('#', '')}.png`);
  const script = `
    const { createRequire } = require('node:module');
    const req = createRequire(${JSON.stringify(path.join(PW_DIR, 'package.json'))});
    const { chromium } = req('playwright');
    (async () => {
      const b = await chromium.launch();
      const p = await b.newPage({ viewport: { width: ${width}, height: ${height} } });
      await p.setContent('<body style="background:${background}"><h1>x</h1></body>');
      await p.screenshot({ path: ${JSON.stringify(out)} });
      await b.close();
    })();
  `;
  execFileSync(process.execPath, ['-e', script], { stdio: 'pipe' });
  return fs.readFileSync(out);
}

async function run() {
  console.log('\n=== Admission authority closure (c)(d)(e)(f) ===\n');

  const admission = await import('../../scripts/design-build-v2/track-a-admission.mjs');
  const gate = await import('../../scripts/lib/design-build-antigravity-gate.mjs');

  // Two visually unrelated but individually valid PNG pairs.
  const refA = png(1440, 900, '#111111');
  const candA = png(1440, 900, '#222222');
  const refB = png(390, 844, '#333333');
  const candB = png(390, 844, '#444444');

  const APPROVED_BUNDLE = 'b'.repeat(64);

  function cert(overrides = {}) {
    return {
      status: 'ADMITTED',
      approvedBundleSha256: APPROVED_BUNDLE,
      profileDimensions: { 'desktop-1440': [1440, 900], 'mobile-390': [390, 844] },
      gateResults: {
        G0_preflight: 'PASS',
        G1_contract: 'PASS',
        G2_rendered_fidelity: 'PASS',
        G3_state_interaction: 'PASS'
      },
      gateSequence: admission.CANONICAL_GATE_SEQUENCE.slice(),
      captures: {
        'desktop-1440': { verdict: 'PARITY_PASS', referenceSha256: sha(refA), candidateSha256: sha(candA) },
        'mobile-390': { verdict: 'PARITY_PASS', referenceSha256: sha(refB), candidateSha256: sha(candB) }
      },
      renderedEvidence: { verified: true, source: 'chromium-playwright' },
      ...overrides
    };
  }
  const images = {
    'desktop-1440': { reference: refA, candidate: candA },
    'mobile-390': { reference: refB, candidate: candB }
  };

  // --- (c) canonical verifier must reject a failed non-G2 gate ---------------
  await test('C1 canonical verifier rejects G1_contract FAIL', () => {
    const c = cert({ gateResults: { ...cert().gateResults, G1_contract: 'FAIL' } });
    const result = admission.verifyAdmissionCertificate(c, images);
    assert.strictEqual(result.status, 'BLOCKED', 'G1 FAIL must block at the canonical verifier');
  });

  await test('C2 canonical verifier rejects G0 and G3 FAIL', () => {
    for (const name of ['G0_preflight', 'G3_state_interaction']) {
      const c = cert({ gateResults: { ...cert().gateResults, [name]: 'FAIL' } });
      assert.strictEqual(admission.verifyAdmissionCertificate(c, images).status, 'BLOCKED', `${name} FAIL`);
    }
  });

  await test('C3 canonical verifier rejects a missing non-G2 gate', () => {
    const c = cert({ gateResults: { G2_rendered_fidelity: 'PASS' } });
    assert.strictEqual(admission.verifyAdmissionCertificate(c, images).status, 'BLOCKED');
  });

  // --- (d) reference identity must not be self-declared ----------------------
  await test('D1 unrelated PNG pair cannot admit against a different approved bundle', () => {
    const c = cert();
    // The caller can write any hashes it likes; the approved bundle seal is the
    // only independent anchor. Declaring a different seal must not admit.
    const result = admission.verifyAdmissionCertificate(c, images, {
      approvedBundleSha256: 'c'.repeat(64)
    });
    assert.strictEqual(result.status, 'BLOCKED', 'seal mismatch must block');
  });

  await test('D2 matching approved bundle seal admits', () => {
    const result = admission.verifyAdmissionCertificate(cert(), images, {
      approvedBundleSha256: APPROVED_BUNDLE
    });
    assert.strictEqual(result.status, 'ADMITTED', JSON.stringify(result));
  });

  await test('D3 production path requires the approved bundle anchor', () => {
    // No anchor supplied on a production verification is a missing binding,
    // not a silent pass.
    const result = admission.verifyAdmissionCertificate(cert(), images, { requireApprovedBundle: true });
    assert.strictEqual(result.status, 'BLOCKED');
    assert.match(String(result.reason), /BUNDLE|ANCHOR/i);
  });

  // --- (e) revision binding must not fail open ------------------------------
  await test('E1 omitted current revision cannot admit', () => {
    const c = cert({ candidateRevisionSha256: sha(Buffer.from('rev-1')) });
    const result = gate.enforceTrackAAdmission(c, images);
    assert.strictEqual(result.status, 'BLOCKED', 'omitting currentRevisionSha256 must not skip binding');
  });

  await test('E2 certificate without revision binding cannot admit', () => {
    const result = gate.enforceTrackAAdmission(cert(), images, {
      currentRevisionSha256: sha(Buffer.from('rev-1'))
    });
    assert.strictEqual(result.status, 'BLOCKED');
    assert.strictEqual(result.why, 'ADMISSION_REVISION_UNBOUND');
  });

  await test('E3 stale revision blocks', () => {
    const c = cert({ candidateRevisionSha256: sha(Buffer.from('rev-old')) });
    const result = gate.enforceTrackAAdmission(c, images, {
      currentRevisionSha256: sha(Buffer.from('rev-new'))
    });
    assert.strictEqual(result.status, 'BLOCKED');
    assert.strictEqual(result.why, 'ADMISSION_REVISION_STALE');
  });

  await test('E4 matching revision admits', () => {
    const rev = sha(Buffer.from('rev-current'));
    const c = cert({ candidateRevisionSha256: rev });
    const result = gate.enforceTrackAAdmission(c, images, { currentRevisionSha256: rev });
    assert.strictEqual(result.status, 'OK', JSON.stringify(result));
  });

  // --- (f) symlink escape ---------------------------------------------------
  await test('F1 symlink inside the evidence dir cannot load outside bytes', () => {
    const evidenceDir = tmp();
    const outsideDir = tmp();
    const outsidePng = path.join(outsideDir, 'outside.png');
    fs.writeFileSync(outsidePng, refA);
    fs.symlinkSync(outsidePng, path.join(evidenceDir, 'desktop-1440-reference.png'));
    fs.writeFileSync(path.join(evidenceDir, 'desktop-1440-candidate.png'), candA);
    fs.writeFileSync(path.join(evidenceDir, 'mobile-390-reference.png'), refB);
    fs.writeFileSync(path.join(evidenceDir, 'mobile-390-candidate.png'), candB);

    const loaded = gate.loadAdmissionImages(cert(), path.join(evidenceDir, 'cert.json'));
    assert.ok(!loaded['desktop-1440']?.reference, 'symlinked bytes outside the evidence dir must not load');
  });

  await test('F2 regular files inside the evidence dir still load', () => {
    const evidenceDir = tmp();
    fs.writeFileSync(path.join(evidenceDir, 'desktop-1440-reference.png'), refA);
    fs.writeFileSync(path.join(evidenceDir, 'desktop-1440-candidate.png'), candA);
    fs.writeFileSync(path.join(evidenceDir, 'mobile-390-reference.png'), refB);
    fs.writeFileSync(path.join(evidenceDir, 'mobile-390-candidate.png'), candB);

    const loaded = gate.loadAdmissionImages(cert(), path.join(evidenceDir, 'cert.json'));
    assert.ok(loaded['desktop-1440']?.reference, 'regular evidence must still load');
    assert.strictEqual(sha(loaded['desktop-1440'].reference), sha(refA));
  });

  for (const dir of TEMP_DIRS) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

run();
