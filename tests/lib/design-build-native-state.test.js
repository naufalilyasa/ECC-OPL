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
  advanceCheckpoint,
  computeRevisionFingerprint,
  fingerprintNativeReference,
  verifyApprovalRevision,
  verifyCompletionScope,
  DATA_MODES
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

  // Tolerance only: section-gate does not read previewMode yet (Phase 6 wires
  // native G2). Do not cite this as mode-aware gate evidence.
  test('section-gate tolerates a previewMode field and keeps the completion contract', () => {
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

  // ---- Phase 5: approval identity, revision binding & dataMode ----

  const nativeReference = (overrides = {}) => ({
    files: [
      { kind: 'component-source', path: 'resources/js/Pages/Inventory.tsx', sha256: sha('component-v1') },
      { kind: 'component-imports', path: 'resources/js/Components/Table.tsx', sha256: sha('imports') },
      { kind: 'design-contract', path: 'docs/design/sections/05-inventory/CONTRACT.md', sha256: sha('contract') },
      { kind: 'tokens', path: 'resources/css/tokens.css', sha256: sha('tokens') },
      { kind: 'preview-config', path: 'vite.config.ts', sha256: sha('vite') },
      { kind: 'data-fixture', path: 'resources/js/fixtures/inventory.json', sha256: sha('fixture-v1') },
    ],
    ...overrides
  });

  test('reference fingerprint is stable and order-independent', () => {
    const a = fingerprintNativeReference(nativeReference());
    const shuffled = nativeReference({ files: [...nativeReference().files].reverse() });
    const b = fingerprintNativeReference(shuffled);
    assert.strictEqual(a.code, 'OK', JSON.stringify(a));
    assert.strictEqual(a.revisionDigest, b.revisionDigest);
    assert.strictEqual(a.designDigest, b.designDigest);
    assert.notStrictEqual(a.revisionDigest, a.designDigest);
    assert.strictEqual(computeRevisionFingerprint([{ path: 'a', sha256: sha('x') }]).length, 64);
  });

  test('a native reference without component-source is rejected', () => {
    const result = fingerprintNativeReference(nativeReference({
      files: [{ kind: 'tokens', path: 'tokens.css', sha256: sha('tokens') }]
    }));
    assert.strictEqual(result.code, 'NATIVE_REFERENCE_INCOMPLETE');
    assert.strictEqual(result.why, 'missingComponentSource');
  });

  test('an HTML reference kind cannot be smuggled into a native approval', () => {
    const result = fingerprintNativeReference(nativeReference({
      files: [...nativeReference().files, { kind: 'html', path: 'section.html', sha256: sha('html') }]
    }));
    assert.strictEqual(result.code, 'UNSUPPORTED_REFERENCE_KIND');
    assert.strictEqual(result.kind, 'html');
  });

  test('approval binds to the exact reference digest', () => {
    const fp = fingerprintNativeReference(nativeReference());
    const verdict = verifyApprovalRevision(
      { revisionDigest: fp.revisionDigest, designDigest: fp.designDigest },
      nativeReference());
    assert.strictEqual(verdict.code, 'OK');
  });

  test('source mutation between submit and accept is a stale re-approval', () => {
    const fp = fingerprintNativeReference(nativeReference());
    const mutated = nativeReference({
      files: nativeReference().files.map((file) => file.kind === 'component-source'
        ? { ...file, sha256: sha('component-v2') } : file)
    });
    const verdict = verifyApprovalRevision(
      { revisionDigest: fp.revisionDigest, designDigest: fp.designDigest }, mutated);
    assert.strictEqual(verdict.code, 'STALE_REVISION');
    assert.strictEqual(verdict.reapprovalRequired, true);
    assert.strictEqual(verdict.why, 'visualReferenceChanged');
  });

  test('a fixture data swap keeps the approval but forces verification', () => {
    const fp = fingerprintNativeReference(nativeReference());
    const swapped = nativeReference({
      files: nativeReference().files.map((file) => file.kind === 'data-fixture'
        ? { ...file, sha256: sha('fixture-v2') } : file)
    });
    const verdict = verifyApprovalRevision(
      { revisionDigest: fp.revisionDigest, designDigest: fp.designDigest }, swapped);
    assert.strictEqual(verdict.code, 'VERIFICATION_REQUIRED');
    assert.strictEqual(verdict.reapprovalRequired, false, 'fixture data is not design');
    assert.notStrictEqual(verdict.revisionDigest, fp.revisionDigest);
    assert.strictEqual(verdict.designDigest, fp.designDigest);
    assert.notStrictEqual(verdict.code, 'OK', 'the stale checks must rerun');
    // A rerun that cannot produce a valid receipt cannot reach completion: the
    // gate order, not the approval check, enforces the verification itself.
    const stale = advanceCheckpoint({ ...validRequest('framework-native', 'PARITY_PENDING').active },
      { schemaVersion: 2 });
    assert.notStrictEqual(stale.state, 'SECTION_COMPLETE');
  });

  test('missing approval digests are rejected, not defaulted', () => {
    const verdict = verifyApprovalRevision({}, nativeReference());
    assert.strictEqual(verdict.code, 'APPROVAL_BINDING_INCOMPLETE');
  });

  test('a fixture-only section cannot claim production integration', () => {
    assert.strictEqual(verifyCompletionScope({ dataMode: 'fixture' }, 'production').code, 'FIXTURE_ONLY');
    assert.strictEqual(verifyCompletionScope({}, 'production').code, 'FIXTURE_ONLY',
      'an unlabelled section defaults to fixture');
    assert.strictEqual(verifyCompletionScope({ dataMode: 'production' }, 'production').code, 'OK');
    assert.strictEqual(verifyCompletionScope({ dataMode: 'fixture' }, 'fixture').code, 'OK');
    assert.deepStrictEqual(DATA_MODES, ['fixture', 'production']);
  });

  test('the completion record carries dataMode', () => {
    const request = validRequest('framework-native', 'PARITY_PASS');
    request.active.dataMode = 'fixture';
    const result = runSectionGate(request);
    assert.strictEqual(result.out.checkpoint.state, 'SECTION_COMPLETE', JSON.stringify(result.out.checkpoint));
    assert.strictEqual(result.out.checkpoint.dataMode, 'fixture');
  });

  test('an unknown dataMode value blocks the gate instead of passing', () => {
    const request = validRequest('framework-native', 'PARITY_PASS');
    request.active.dataMode = 'synthetic-ish';
    const result = runSectionGate(request);
    assert.notStrictEqual(result.out.checkpoint.state, 'SECTION_COMPLETE');
    assert.strictEqual(result.out.checkpoint.why, 'DATA_MODE_INVALID');
  });

  test('preview meta carries the revision digest and dataMode, and nothing else', () => {
    const { createSessionStore } = require('../../scripts/lib/plan-canvas/sessions.js');
    const dir = tmp();
    const artifact = path.join(dir, '05-inventory.plan.md');
    fs.writeFileSync(artifact, '# Inventory\n');
    const store = createSessionStore({ stateDir: path.join(dir, 'state') });
    const digest = sha('reference');
    const { session } = store.open(artifact, {
      previewMode: 'framework-native',
      previewUrl: 'http://127.0.0.1:5199/',
      previewMeta: { section: SECTION, revision: REVISION, revisionDigest: digest,
        dataMode: 'fixture', injected: '<script>' }
    });
    assert.deepStrictEqual(store.get(session.key).previewMeta,
      { section: SECTION, revision: REVISION, revisionDigest: digest, dataMode: 'fixture' });
    // A non-digest revision stamp is dropped rather than stored as-is.
    const second = store.open(artifact, {
      reopen: true,
      previewMode: 'framework-native',
      previewUrl: 'http://127.0.0.1:5199/',
      previewMeta: { section: SECTION, revisionDigest: 'not-a-digest', dataMode: 'guessed' }
    });
    assert.deepStrictEqual(store.get(second.session.key).previewMeta, { section: SECTION });
  });

  for (const dir of TEMP_DIRS) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

runTests();
