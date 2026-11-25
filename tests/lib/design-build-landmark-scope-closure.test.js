/**
 * Design-Build V2 — landmark scope and admission closure (R7).
 *
 * Covers the six areas of the targeted closure directive:
 *   A. Track A admission must reuse the canonical verifier and real evidence.
 *   B. Comparison scope must be bound to the approved landmark set.
 *   C. Landmark validation must reject duplicates, bad props, missing values.
 *   D. R6-8 asserted the wrong result field.
 *   E. CSS inlining must find the real stylesheet element.
 *
 * Run with: node tests/lib/design-build-landmark-scope-closure.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..', '..');
const TEMP_DIRS = [];

let passed = 0;
let failed = 0;
const queue = [];

function test(name, fn) { queue.push({ name, fn }); }

function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-scope-closure-'));
  TEMP_DIRS.push(dir);
  return dir;
}

async function run() {
  for (const { name, fn } of queue) {
    try { await fn(); console.log(`  ✓ ${name}`); passed += 1; }
    catch (error) { console.log(`  ✗ ${name}\n    ${error.message.split('\n')[0]}`); failed += 1; }
  }
}

const load = rel => import(pathToFileURL(path.join(REPO, rel)).href);

// Minimal decodable PNG at a given size is not required here: the admission
// authority only needs to be *consulted*, so a stub verifier proves the wiring.

// ---------------------------------------------------------------- A. authority
test('A1 enforceTrackAAdmission consults the canonical verifier, not object shape', async () => {
  const gate = await load('scripts/lib/design-build-antigravity-gate.mjs');
  // The declarative certificate the external review reconstructed: every field
  // looks right, but no screenshot bytes exist.
  const forged = {
    status: 'ADMITTED',
    approvedBundleSha256: 'a'.repeat(64),
    gateResults: {
      G0_preflight: 'PASS', G1_contract: 'PASS',
      G2_rendered_fidelity: 'PASS', G3_state_interaction: 'PASS'
    },
    gateSequence: ['G0_preflight', 'G1_contract', 'G2_rendered_fidelity', 'G3_state_interaction'],
    captures: {
      'desktop-1440': { verdict: 'PARITY_PASS' },
      'mobile-390': { verdict: 'PARITY_PASS' }
    },
    renderedEvidence: { verified: true, source: 'chromium-playwright' }
  };

  // No evidence supplied at all: must stay blocked.
  const noEvidence = gate.enforceTrackAAdmission(forged);
  assert.notStrictEqual(noEvidence.status, 'OK',
    'a declarative certificate with no screenshot bytes must not admit');

  // Empty evidence map: still blocked.
  const emptyEvidence = gate.enforceTrackAAdmission(forged, {});
  assert.notStrictEqual(emptyEvidence.status, 'OK',
    'an empty evidence map must not admit');
});

test('A2 admission reports the canonical verifier reason', async () => {
  const gate = await load('scripts/lib/design-build-antigravity-gate.mjs');
  const forged = {
    status: 'ADMITTED',
    approvedBundleSha256: 'a'.repeat(64),
    candidateRevisionSha256: 'b'.repeat(64),
    gateResults: { G0_preflight: 'PASS', G1_contract: 'PASS', G2_rendered_fidelity: 'PASS', G3_state_interaction: 'PASS' },
    gateSequence: ['G0_preflight', 'G1_contract', 'G2_rendered_fidelity', 'G3_state_interaction'],
    captures: { 'desktop-1440': { verdict: 'PARITY_PASS' }, 'mobile-390': { verdict: 'PARITY_PASS' } },
    renderedEvidence: { verified: true, source: 'chromium-playwright' }
  };
  const result = gate.enforceTrackAAdmission(forged, {}, {
    currentRevisionSha256: 'b'.repeat(64)
  });
  assert.strictEqual(result.status, 'BLOCKED');
  // The reason must come from the canonical verifier vocabulary, not a bespoke
  // parallel check, so operators see the same diagnosis everywhere.
  assert.ok(
    /SCREENSHOT_PAIR_INCOMPLETE|MISSING_VIEWPORT|DIGEST_MISMATCH|INVALID_PNG/.test(JSON.stringify(result)),
    `expected a canonical verifier reason, got ${JSON.stringify(result)}`
  );
});

test('A3 a stale ADMITTED artifact cannot be reused for a different revision', async () => {
  const gate = await load('scripts/lib/design-build-antigravity-gate.mjs');
  assert.strictEqual(typeof gate.enforceTrackAAdmission, 'function');
  const cert = {
    status: 'ADMITTED',
    approvedBundleSha256: 'b'.repeat(64),
    candidateRevisionSha256: 'c'.repeat(64),
    gateResults: { G0_preflight: 'PASS', G1_contract: 'PASS', G2_rendered_fidelity: 'PASS', G3_state_interaction: 'PASS' },
    gateSequence: ['G0_preflight', 'G1_contract', 'G2_rendered_fidelity', 'G3_state_interaction'],
    captures: { 'desktop-1440': { verdict: 'PARITY_PASS' }, 'mobile-390': { verdict: 'PARITY_PASS' } },
    renderedEvidence: { verified: true, source: 'chromium-playwright' }
  };
  // A caller that supplies the certificate plus a *different* current revision
  // must be refused even before evidence is examined.
  const result = gate.enforceTrackAAdmission(cert, {}, { currentRevisionSha256: 'd'.repeat(64) });
  assert.notStrictEqual(result.status, 'OK',
    'a certificate bound to a different candidate revision must not admit');
  assert.match(JSON.stringify(result), /REVISION|STALE/i);
});

// ------------------------------------------------------------ B. comparison scope
test('B1 an empty comparison landmark array cannot pass', async () => {
  const mod = await load('scripts/design-build-v2/render-parity.mjs');
  const set = [{ name: 'header', selector: '.h', props: ['display'] }];
  const a = { landmarks: { header: { present: true, visible: true, styles: { display: 'block' }, box: { width: 10, height: 10 } } }, profileKey: mod.landmarkProfileKey(set) };
  const b = { landmarks: { header: { present: true, visible: true, styles: { display: 'block' }, box: { width: 10, height: 10 } } }, profileKey: mod.landmarkProfileKey(set) };
  const result = mod.compareRendered(a, b, 0.5, []);
  assert.strictEqual(result.code, 'PARITY_FAIL', 'empty scope must not pass');
});

test('B2 a reduced comparison scope cannot pass', async () => {
  const mod = await load('scripts/design-build-v2/render-parity.mjs');
  const full = [
    { name: 'header', selector: '.h', props: ['display'] },
    { name: 'footer', selector: '.f', props: ['display'] }
  ];
  const reduced = [full[0]];
  const mk = () => ({
    landmarks: {
      header: { present: true, visible: true, styles: { display: 'block' }, box: { width: 10, height: 10 } },
      footer: { present: true, visible: true, styles: { display: 'block' }, box: { width: 10, height: 10 } }
    },
    profileKey: mod.landmarkProfileKey(full)
  });
  const result = mod.compareRendered(mk(), mk(), 0.5, reduced);
  assert.strictEqual(result.code, 'PARITY_FAIL', 'a reduced scope must not pass');
  assert.match(JSON.stringify(result), /scope|landmarkSet/i);
});

test('B3 a custom measurement does not silently fall back to fixture defaults', async () => {
  const mod = await load('scripts/design-build-v2/render-parity.mjs');
  const custom = [{ name: 'app-header', selector: '.app-header', props: ['display'] }];
  const m = {
    landmarks: { 'app-header': { present: true, visible: true, styles: { display: 'flex' }, box: { width: 10, height: 10 } } },
    profileKey: mod.landmarkProfileKey(custom)
  };
  // No explicit comparison scope: must NOT default to P-WEB1 landmarks.
  const result = mod.compareRendered(m, m, 0.5);
  assert.strictEqual(result.code, 'PARITY_FAIL',
    'a custom measurement must not be compared against fixture defaults');
});

test('B4 matching identity and full scope passes', async () => {
  const mod = await load('scripts/design-build-v2/render-parity.mjs');
  const set = [{ name: 'header', selector: '.h', props: ['display'] }];
  const mk = () => ({
    landmarks: { header: { present: true, visible: true, styles: { display: 'block' }, box: { width: 10, height: 10 } } },
    profileKey: mod.landmarkProfileKey(set),
    screenshotSha256: 'x', source: 'chromium-playwright'
  });
  const result = mod.compareRendered(mk(), mk(), 0.5, set);
  assert.strictEqual(result.code, 'PARITY_PASS');
});

// ------------------------------------------------------------ C. landmark validation
test('C1 duplicate landmark names are rejected', async () => {
  const { resolveLandmarks } = await load('scripts/design-build-v2/render-parity.mjs');
  assert.throws(
    () => resolveLandmarks({
      landmarks: [
        { name: 'dup', selector: '.a', props: ['display'] },
        { name: 'dup', selector: '.b', props: ['display'] }
      ]
    }),
    /duplicate/i
  );
});

test('C2 unsupported measured properties are rejected', async () => {
  const { resolveLandmarks } = await load('scripts/design-build-v2/render-parity.mjs');
  assert.throws(
    () => resolveLandmarks({ landmarks: [{ name: 'x', selector: '.x', props: ['notARealCssProperty'] }] }),
    /property/i
  );
  assert.throws(
    () => resolveLandmarks({ landmarks: [{ name: 'x', selector: '.x', props: ['display', 'alsoFake'] }] }),
    /property/i
  );
});

test('C3 a malformed explicit profile throws instead of falling back', async () => {
  const { resolveLandmarks } = await load('scripts/design-build-v2/render-parity.mjs');
  const dir = tmp();
  const bad = path.join(dir, 'bad.json');
  fs.writeFileSync(bad, JSON.stringify({ landmarks: 'not-an-array' }));
  assert.throws(() => resolveLandmarks({ profilePath: bad }), /landmarks/i);

  const notJson = path.join(dir, 'broken.json');
  fs.writeFileSync(notJson, '{ nope');
  assert.throws(() => resolveLandmarks({ profilePath: notJson }));
});

test('C4 undefined vs undefined is not silently equal', async () => {
  const mod = await load('scripts/design-build-v2/render-parity.mjs');
  const set = [{ name: 'header', selector: '.h', props: ['display', 'minHeight'] }];
  // Both sides lack `minHeight`: that is missing evidence, not agreement.
  const mk = () => ({
    landmarks: { header: { present: true, visible: true, styles: { display: 'block' }, box: { width: 10, height: 10 } } },
    profileKey: mod.landmarkProfileKey(set),
    screenshotSha256: 'x', source: 'chromium-playwright'
  });
  const result = mod.compareRendered(mk(), mk(), 0.5, set);
  assert.strictEqual(result.code, 'PARITY_FAIL',
    'two missing measurements must not be treated as equal');
  assert.match(JSON.stringify(result), /missing|undefined/i);
});

// ----------------------------------------------------------------- D. R6-8 field
test('D1 compareRendered returns code, and the profile failure is landmarkSet', async () => {
  const mod = await load('scripts/design-build-v2/render-parity.mjs');
  const setA = [{ name: 'header', selector: '.foo', props: ['display'] }];
  const setB = [{ name: 'header', selector: '.bar', props: ['display'] }];
  const a = { landmarks: { header: { present: true, visible: true, styles: { display: 'block' }, box: { width: 1, height: 1 } } }, profileKey: mod.landmarkProfileKey(setA) };
  const b = { landmarks: { header: { present: true, visible: true, styles: { display: 'block' }, box: { width: 1, height: 1 } } }, profileKey: mod.landmarkProfileKey(setB) };
  const result = mod.compareRendered(a, b, 0.5, setA);
  assert.strictEqual(result.code, 'PARITY_FAIL');
  assert.ok(
    result.diffs.some(d => d.property === 'landmarkSet'),
    `expected a landmarkSet diff, got ${JSON.stringify(result.diffs)}`
  );
});

// ------------------------------------------------------------------ E. CSS assets
test('E1 inlining ignores a link tag inside an HTML comment', async () => {
  const mod = await load('scripts/design-build-v2/capture-project-evidence.mjs');
  const html = '<!-- <link rel="stylesheet" href="style.css"> --><link rel="stylesheet" href="style.css"><body></body>';
  const out = mod.inlineAssets(html, 'a{color:red}');
  // The comment must survive untouched; the real element must be replaced.
  assert.ok(out.includes('<!-- <link rel="stylesheet" href="style.css"> -->'),
    'the commented-out link must not be consumed');
  assert.ok(out.includes('<style>a{color:red}</style>'), 'the real link must be inlined');
});

test('E2 inlining ignores data-href lookalikes', async () => {
  const mod = await load('scripts/design-build-v2/capture-project-evidence.mjs');
  const html = '<link rel="preload" data-href="style.css"><link rel="stylesheet" href="style.css"><body></body>';
  const out = mod.inlineAssets(html, 'a{color:red}');
  assert.ok(out.includes('data-href="style.css"'), 'the preload element must not be inlined');
  assert.ok(out.includes('<style>a{color:red}</style>'));
});

test('E3 an unsupported asset configuration fails explicitly', async () => {
  const mod = await load('scripts/design-build-v2/capture-project-evidence.mjs');
  // Two real stylesheets: ambiguous, must not silently pick one.
  assert.throws(
    () => mod.inlineAssets(
      '<link rel="stylesheet" href="style.css"><link rel="stylesheet" href="other.css"><body></body>',
      'a{color:red}'
    ),
    /stylesheet|multiple|ambiguous/i
  );
  // A stylesheet href we cannot inline must fail, not pass through.
  assert.throws(
    () => mod.inlineAssets('<link rel="stylesheet" href="main.css"><body></body>', 'a{color:red}'),
    /style\.css|unsupported/i
  );
});

(async () => {
  console.log('\n=== Design-Build landmark scope & admission closure (R7) ===\n');
  await run();
  for (const dir of TEMP_DIRS) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
})();
