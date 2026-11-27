/**
 * Phase 3 — two preview modes share one lifecycle.
 *
 * Native mode (framework-native) approves the component that ships, so the
 * approved reference and the candidate implementation are the SAME source.
 * That must not trip the standalone-HTML identity-separation guard, and it must
 * not require a second set of state names.
 *
 * Run with: node tests/lib/design-build-native-state.test.js
 */
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const {
  STATES,
  MODE_STATE_SEMANTICS,
  APPROVED_REFERENCE_KINDS,
  CANDIDATE_KINDS,
  NATIVE_APPROVED_REFERENCE_KINDS,
  NATIVE_CANDIDATE_KINDS,
  verifyIdentitySeparation,
  advanceCheckpoint
} = require('../../scripts/design-build-v2/state-machine.mjs');

let passed = 0;
let failed = 0;
const TEMP_DIRS = [];
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed += 1; }
  catch (error) { console.log(`  ✗ ${name}\n    ${error.message.split('\n')[0]}`); failed += 1; }
}
function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-native-state-'));
  TEMP_DIRS.push(dir);
  return dir;
}
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

// A real 1x1 PNG: the validators check PNG structure, not image content.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/wD/1QAAAABJRU5ErkJggg==',
  'base64'
);

const SECTION = '01-app-shell';
const REVISION = 'r1';
const BUNDLE = 'a'.repeat(64);
const VIEWPORT = 'desktop-1440';
const ROW = { profile: VIEWPORT, state: 'default', landmark: 'root', property: 'display',
  expected: 'block', actual: 'block', verdict: 'PASS' };

function validRequest(previewMode, state) {
  const source = Buffer.from('export function AppShell() { return null }\n');
  return {
    active: { sectionId: SECTION, revision: REVISION, approvedBundleSha256: BUNDLE,
      state, current: 0, steps: [SECTION, '02-next'], previewMode },
    canvasApproval: { verdictId: 'canvas:abc@2026-11-27T00:00:00Z', approved: true,
      sectionId: SECTION, revision: REVISION, bundleSha256: BUNDLE },
    candidateFiles: { 'AppShell.tsx': source },
    frameworkCompleteEvidence: { identitySha256: 'c'.repeat(64) },
    contractChecks: [{ name: 'tokens', observed: true }],
    requiredViewports: [VIEWPORT],
    viewportEvidence: { [VIEWPORT]: { screenshot: PNG, candidateScreenshot: PNG,
      measurements: [{ ...ROW }] } },
    interactionChecks: [{ name: 'toggle', applicable: true, observed: true,
      value: 'expanded', before: 'collapsed', after: 'expanded' }],
    receipt: {
      schemaVersion: 2,
      sectionId: SECTION,
      revision: REVISION,
      approvedBundleSha256: BUNDLE,
      candidateFileHashes: { 'AppShell.tsx': sha(source) },
      measurements: [{ ...ROW }],
      viewportScreenshots: { [VIEWPORT]: sha(PNG) },
      gateResults: { G0_preflight: 'PASS', G1_contract: 'PASS',
        G2_rendered_fidelity: 'PASS', G3_state_interaction: 'PASS' },
      overallVerdict: 'PARITY_PASS'
    }
  };
}

function runSectionGate(request) {
  const dir = tmp();
  // The entrypoint reads bytes from project-relative FILE paths, so materialize
  // every in-memory buffer the validators need.
  const materialize = (bytes, name) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, bytes);
    return name;
  };
  const req = JSON.parse(JSON.stringify(request));
  req.projectRoot = dir;
  for (const [name, bytes] of Object.entries(request.candidateFiles)) {
    req.candidateFiles[name] = materialize(bytes, name);
  }
  for (const [vp, evidence] of Object.entries(request.viewportEvidence)) {
    req.viewportEvidence[vp] = {
      ...evidence,
      screenshot: materialize(evidence.screenshot, `${vp}-ref.png`),
      candidateScreenshot: materialize(evidence.candidateScreenshot, `${vp}-cand.png`)
    };
  }
  const file = path.join(dir, 'request.json');
  fs.writeFileSync(file, JSON.stringify(req, null, 2));
  try {
    const out = execFileSync(process.execPath,
      [path.join(REPO, 'scripts/design-build-v2/section-gate.mjs'), file],
      { encoding: 'utf8', stdio: 'pipe' });
    return { code: 0, out: JSON.parse(out) };
  } catch (error) {
    return { code: error.status, out: error.stdout ? JSON.parse(error.stdout) : null };
  }
}

function runTests() {
  console.log('\n=== Phase 3: two modes, one lifecycle ===\n');

  test('native reference kinds are separate from the HTML reference kinds', () => {
    // design-contract/tokens/assets/state-fixtures are shared artifacts on purpose;
    // only the mode-specific kinds must not collide.
    const modeSpecific = ['component-source', 'component-imports', 'preview-config', 'data-fixture'];
    for (const kind of modeSpecific) {
      assert.ok(NATIVE_APPROVED_REFERENCE_KINDS.includes(kind), `${kind} missing from native kinds`);
      assert.ok(!APPROVED_REFERENCE_KINDS.includes(kind),
        `${kind} must not also be an HTML reference kind`);
    }
    for (const kind of NATIVE_CANDIDATE_KINDS) {
      assert.ok(!CANDIDATE_KINDS.includes(kind),
        `${kind} must not also be an HTML candidate kind`);
    }
  });

  test('D6: PORT_IN_PROGRESS means INTEGRATING in native mode, porting in HTML mode', () => {
    assert.strictEqual(MODE_STATE_SEMANTICS['framework-native'].PORT_IN_PROGRESS.split(':')[0],
      'INTEGRATING');
    assert.ok(/port/i.test(MODE_STATE_SEMANTICS['standalone-html'].PORT_IN_PROGRESS));
    assert.ok(/rendered-integrity/.test(MODE_STATE_SEMANTICS['framework-native'].PARITY_PENDING));
    // One vocabulary: no second state set was introduced for native mode.
    assert.deepStrictEqual(Object.keys(MODE_STATE_SEMANTICS['framework-native']).sort(),
      Object.keys(MODE_STATE_SEMANTICS['standalone-html']).sort());
    assert.ok(!('INTEGRATING' in STATES));
  });

  test('native single source: equal digests and shared paths are expected', () => {
    const d = 'e'.repeat(64);
    const result = verifyIdentitySeparation(
      { referenceSha256: d, files: ['resources/js/pages/01-app-shell.tsx'] },
      { implementationSha256: d, files: ['resources/js/pages/01-app-shell.tsx'] },
      'framework-native');
    assert.strictEqual(result.code, 'OK');
    assert.strictEqual(result.singleSource, true);
    assert.deepStrictEqual(result.sharedPaths, ['resources/js/pages/01-app-shell.tsx']);
  });

  test('native source that diverges from the approval is drift, not success', () => {
    const result = verifyIdentitySeparation(
      { referenceSha256: 'e'.repeat(64), files: ['a.tsx'] },
      { implementationSha256: 'f'.repeat(64), files: ['a.tsx'] },
      'framework-native');
    assert.strictEqual(result.code, 'IDENTITY_DRIFT');
  });

  test('standalone HTML mode keeps the conflation guard', () => {
    const d = 'e'.repeat(64);
    const same = verifyIdentitySeparation(
      { referenceSha256: d, files: ['preview.html'] },
      { implementationSha256: d, files: ['Component.tsx'] });
    assert.strictEqual(same.code, 'IDENTITY_CONFLATED');
    const sharedPath = verifyIdentitySeparation(
      { referenceSha256: 'e'.repeat(64), files: ['x.tsx'] },
      { implementationSha256: 'f'.repeat(64), files: ['x.tsx'] });
    assert.strictEqual(sharedPath.code, 'IDENTITY_CONFLATED');
    assert.strictEqual(sharedPath.why, 'sharedPath');
  });

  test('both modes still require real manifests', () => {
    for (const mode of ['standalone-html', 'framework-native']) {
      const result = verifyIdentitySeparation(
        { referenceSha256: 'e'.repeat(64), files: [] },
        { implementationSha256: 'e'.repeat(64), files: ['a.tsx'] }, mode);
      assert.strictEqual(result.code, 'IDENTITY_INVALID', mode);
    }
  });

  test('missing approval before the canvas stage is normal progress, not a blocker', () => {
    const req = validRequest('framework-native', 'PREVIEW_DRAFT');
    const out = advanceCheckpoint(req.active, req.receipt, req);
    assert.strictEqual(out.code, 'CANVAS_APPROVAL_REQUIRED');
    assert.strictEqual(out.state, 'PREVIEW_DRAFT');
    assert.strictEqual(out.current, 0);
  });

  test('native receipt completes the section without a port state in between', () => {
    const req = validRequest('framework-native', 'PARITY_PASS');
    const out = advanceCheckpoint(req.active, req.receipt, req);
    assert.strictEqual(out.code, undefined);
    assert.strictEqual(out.state, 'SECTION_COMPLETE');
    assert.strictEqual(out.current, 1);
    for (const state of [out.state]) assert.ok(state in STATES);
  });

  test('native PARITY_PENDING evaluates to PARITY_PASS without advancing', () => {
    const req = validRequest('framework-native', 'PARITY_PENDING');
    const out = advanceCheckpoint(req.active, req.receipt, req);
    assert.strictEqual(out.code, 'PARITY_EVALUATED');
    assert.strictEqual(out.state, 'PARITY_PASS');
    assert.strictEqual(out.current, 0);
  });

  test('a tampered native candidate hash still fails the receipt', () => {
    const req = validRequest('framework-native', 'PARITY_PASS');
    req.receipt.candidateFileHashes['AppShell.tsx'] = 'b'.repeat(64);
    const out = advanceCheckpoint(req.active, req.receipt, req);
    assert.strictEqual(out.code, 'PARITY_NOT_VERIFIED');
    assert.strictEqual(out.why, 'candidateFileHashMismatch');
    assert.strictEqual(out.state, 'PARITY_PASS');
    assert.strictEqual(out.current, 0);
  });

  test('section-gate accepts previewMode and keeps the same completion contract', () => {
    const native = runSectionGate(validRequest('framework-native', 'PARITY_PASS'));
    const legacy = runSectionGate(validRequest('standalone-html', 'PARITY_PASS'));
    for (const result of [native, legacy]) {
      assert.strictEqual(result.code, 0, JSON.stringify(result.out?.checkpoint));
      assert.strictEqual(result.out.checkpoint.state, 'SECTION_COMPLETE');
      assert.strictEqual(result.out.checkpoint.current, 1);
      assert.strictEqual(result.out.g2.code, 'PARITY_PASS');
    }
  });

  test('compare-section refuses native input instead of fabricating an HTML reference', () => {
    const dir = tmp();
    let stdout = '';
    let status = 0;
    try {
      stdout = execFileSync(process.execPath,
        [path.join(REPO, 'scripts/design-build-v2/compare-section.mjs'), dir, dir],
        { encoding: 'utf8', stdio: 'pipe',
          env: { ...process.env, DB2_PREVIEW_MODE: 'framework-native' } });
    } catch (error) {
      status = error.status;
      stdout = error.stdout || '';
    }
    assert.strictEqual(status, 1, 'native input must exit non-zero');
    const out = JSON.parse(stdout.trim());
    assert.strictEqual(out.code, 'LEGACY_ONLY');
  });

  for (const dir of TEMP_DIRS) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

runTests();
