/**
 * Track A admission certificate verification (master plan A5 precondition).
 * Certificate must bind a complete approved scope, decodable paired PNGs at
 * desktop-1440 and mobile-390, authoritative G2 exit codes, and a coherent
 * gate transition sequence.
 *
 * Run with: node tests/lib/design-build-track-a-admission.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  pngInfo,
  verifyAdmissionCertificate
} = require('../../scripts/design-build-v2/track-a-admission.mjs');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed += 1; }
  catch (error) { console.log(`  ✗ ${name}`); console.log(`    ${error.message}`); failed += 1; }
}

const ROOT = path.resolve(__dirname, '../..');
const EVIDENCE_DIR = path.join(ROOT, 'docs/design/evidence/p-web1');
const CERT_PATH = path.join(EVIDENCE_DIR, 'track-a-admission.json');

function fixture() {
  const cert = JSON.parse(fs.readFileSync(CERT_PATH, 'utf8'));
  const images = {};
  for (const [vp, pair] of Object.entries(cert.captures)) {
    images[vp] = {
      reference: fs.readFileSync(path.join(EVIDENCE_DIR, pair.reference)),
      candidate: fs.readFileSync(path.join(EVIDENCE_DIR, pair.candidate))
    };
  }
  return { cert, images };
}

function runTests() {
  console.log('\n=== Testing Track A admission certificate ===\n');

  const { cert, images } = fixture();

  test('valid certificate returns ADMITTED', () => {
    const result = verifyAdmissionCertificate(cert, images);
    assert.strictEqual(result.status, 'ADMITTED', JSON.stringify(result));
  });

  test('requires both desktop-1440 and mobile-390 pairs', () => {
    assert.deepStrictEqual(Object.keys(cert.captures).sort(), ['desktop-1440', 'mobile-390']);
  });

  test('both PNGs in each pair are decodable at declared profile dimensions', () => {
    for (const [vp, dims] of Object.entries(cert.profileDimensions)) {
      const pair = images[vp];
      for (const kind of ['reference', 'candidate']) {
        const info = pngInfo(pair[kind]);
        assert.ok(info, `${vp}/${kind} not a decodable PNG`);
        assert.deepStrictEqual([info.width, info.height], dims, `${vp}/${kind} wrong dims`);
      }
    }
  });

  test('certificate digest bound to approved bundle seal', () => {
    const active = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/p-web1-rlogic/active.json'), 'utf8'));
    assert.strictEqual(cert.approvedBundleSha256, active.approvedBundleSha256);
  });

  test('rejects certificate missing a required viewport', () => {
    const tampered = JSON.parse(JSON.stringify(cert));
    delete tampered.captures['desktop-1440'];
    const result = verifyAdmissionCertificate(tampered, images);
    assert.strictEqual(result.status, 'BLOCKED');
    assert.strictEqual(result.reason, 'MISSING_VIEWPORT');
  });

  test('rejects corrupt PNG bytes', () => {
    const tamperedImages = {};
    for (const [vp, pair] of Object.entries(images)) {
      tamperedImages[vp] = { reference: pair.reference, candidate: pair.candidate };
    }
    tamperedImages['mobile-390'].reference = Buffer.from('not-a-png');
    const result = verifyAdmissionCertificate(cert, tamperedImages);
    assert.strictEqual(result.status, 'BLOCKED');
    assert.strictEqual(result.reason, 'INVALID_PNG');
  });

  test('rejects non-PASS G2 gate result', () => {
    const tampered = JSON.parse(JSON.stringify(cert));
    tampered.gateResults.G2_rendered_fidelity = 'FAIL';
    const result = verifyAdmissionCertificate(tampered, images);
    assert.strictEqual(result.status, 'BLOCKED');
    // G2 FAIL is now caught by the complete-chain check, which runs before the
    // rendered-evidence check. Either reason blocks; the gate is what matters.
    assert.ok(
      ['GATE_CHAIN_FAILED', 'G2_NOT_AUTHORITATIVE'].includes(result.reason),
      `unexpected reason: ${result.reason}`
    );
  });

  test('rejects incoherent gate transition sequence', () => {
    const tampered = JSON.parse(JSON.stringify(cert));
    tampered.gateSequence = ['G0_preflight', 'G2_rendered_fidelity', 'G1_contract', 'G3_state_interaction'];
    const result = verifyAdmissionCertificate(tampered, images);
    assert.strictEqual(result.status, 'BLOCKED');
    assert.strictEqual(result.reason, 'GATE_SEQUENCE_INCOHERENT');
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

runTests();
