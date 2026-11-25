/**
 * Round-6 review fixes: a11y import + configurable landmark regressions.
 *
 * Run with: node tests/lib/design-build-landmarks-review-fixes.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const TEMP_DIRS = [];

let passed = 0;
let failed = 0;
const queue = [];

function test(name, fn) { queue.push({ name, fn }); }

function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-lm-review-'));
  TEMP_DIRS.push(dir);
  return dir;
}

async function run() {
  for (const { name, fn } of queue) {
    try { await fn(); console.log(`  ✓ ${name}`); passed += 1; }
    catch (error) { console.log(`  ✗ ${name}\n    ${error.message.split('\n')[0]}`); failed += 1; }
  }
}

// --- R6-1 (CRITICAL): skills/a11y must be on the npm publish surface.
test('R6-1 skills/a11y is in package.json files', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
  const files = pkg.files || [];
  assert.ok(
    files.includes('skills/a11y/'),
    `package.json files is missing "skills/a11y/" (found ${files.length} entries)`
  );
});

// --- R6-2 (CRITICAL): the skill-triggers manifest must not be stale.
test('R6-2 skill-triggers manifest matches the current skill count', async () => {
  const { execFileSync } = require('child_process');
  // The validator is the authority; it fails loudly when the manifest is stale.
  execFileSync(process.execPath, [path.join(REPO, 'scripts/ci/validate-context-profiles.js')], {
    cwd: REPO, stdio: 'pipe'
  });
});

// --- R6-3 (CRITICAL): CSS inlining must not interpret replacement patterns.
test('R6-3 inlineAssets preserves $ sequences and escapes </style>', async () => {
  const mod = await import(
    require('url').pathToFileURL(
      path.join(REPO, 'scripts/design-build-v2/capture-project-evidence.mjs')
    ).href
  );
  const html = '<link rel="stylesheet" href="style.css"><body></body>';

  // `$&` in a replacement string expands to the matched text.
  const dollarCss = 'a{color:red} .x::after{content:"$&"}';
  const outDollar = mod.inlineAssets(html, dollarCss);
  assert.ok(outDollar.includes('$&'), `$& was interpreted as a replacement pattern: ${outDollar}`);
  assert.ok(!outDollar.includes('<link'), `original link tag was re-inserted: ${outDollar}`);

  // A closing style tag inside CSS would break out of the element.
  const breakoutCss = 'a{color:red}</style><script>alert(1)</script>';
  const outBreakout = mod.inlineAssets(html, breakoutCss);
  assert.ok(
    !outBreakout.includes('</style><script>'),
    `CSS could break out of the style element: ${outBreakout}`
  );

  // Single quotes, leading slash, and ./-prefixed hrefs must all match.
  for (const variant of [
    "<link rel='stylesheet' href='style.css'>",
    '<link rel="stylesheet" href="/style.css">',
    '<link rel="stylesheet" href="./style.css">'
  ]) {
    const out = mod.inlineAssets(variant + '<body></body>', 'a{color:red}');
    assert.ok(out.includes('<style>'), `href variant not inlined: ${variant} -> ${out}`);
  }

  // A missing link tag must throw, not silently return unstyled HTML.
  assert.throws(
    () => mod.inlineAssets('<body></body>', 'a{color:red}'),
    /stylesheet/i
  );
});

// --- R6-4 (HIGH): a failed verification must never be written as ADMITTED.
test('R6-4 certificate status is derived from verification', async () => {
  const mod = await import(
    require('url').pathToFileURL(
      path.join(REPO, 'scripts/design-build-v2/capture-project-evidence.mjs')
    ).href
  );
  assert.strictEqual(
    typeof mod.deriveAdmissionStatus, 'function',
    'capture script must expose deriveAdmissionStatus so status cannot diverge from verification'
  );
  assert.strictEqual(mod.deriveAdmissionStatus({ status: 'ADMITTED' }), 'ADMITTED');
  assert.strictEqual(mod.deriveAdmissionStatus({ status: 'BLOCKED' }), 'BLOCKED');
  assert.strictEqual(mod.deriveAdmissionStatus(null), 'BLOCKED');
  assert.strictEqual(mod.deriveAdmissionStatus(undefined), 'BLOCKED');
});

// --- R6-5 (HIGH): the default landmark set must not be mutable by callers.
test('R6-5 resolveLandmarks returns a fresh default set', async () => {
  const { resolveLandmarks, DEFAULT_LANDMARKS } = await import(
    require('url').pathToFileURL(path.join(REPO, 'scripts/design-build-v2/render-parity.mjs')).href
  );
  const first = resolveLandmarks({});
  first.push({ name: 'INJECTED', selector: '.x', props: ['display'] });
  const second = resolveLandmarks({});
  assert.strictEqual(
    second.length, DEFAULT_LANDMARKS.length,
    'mutating a returned set must not change the default for later callers'
  );
  assert.ok(!second.some(lm => lm.name === 'INJECTED'));

  // Nested props arrays must also be isolated.
  second[0].props.push('INJECTED_PROP');
  const third = resolveLandmarks({});
  assert.ok(
    !third[0].props.includes('INJECTED_PROP'),
    'mutating a nested props array must not leak into the default'
  );
});

// --- R6-6 (HIGH): landmark entries need a name; a malformed profile must throw.
test('R6-6 resolveLandmarks validates name and rejects a profile without landmarks', async () => {
  const { resolveLandmarks } = await import(
    require('url').pathToFileURL(path.join(REPO, 'scripts/design-build-v2/render-parity.mjs')).href
  );

  assert.throws(
    () => resolveLandmarks({ landmarks: [{ selector: '.a', props: ['display'] }] }),
    /name/i,
    'a landmark without a name must be rejected'
  );
  assert.throws(
    () => resolveLandmarks({ landmarks: [{ name: '   ', selector: '.a', props: ['display'] }] }),
    /name/i
  );

  const dir = tmp();
  const emptyProfile = path.join(dir, 'empty.json');
  fs.writeFileSync(emptyProfile, JSON.stringify({}));
  assert.throws(
    () => resolveLandmarks({ profilePath: emptyProfile }),
    /landmarks/i,
    'a profile file without a landmarks array must throw, not silently fall back'
  );
});

// --- R6-7 (MEDIUM): the gate must require the real viewport captures.
test('R6-7 enforceTrackAAdmission rejects an arbitrary captures object', async () => {
  const { enforceTrackAAdmission } = await import(
    require('url').pathToFileURL(
      path.join(REPO, 'scripts/lib/design-build-antigravity-gate.mjs')
    ).href
  );

  const base = {
    status: 'ADMITTED',
    approvedBundleSha256: 'a'.repeat(64),
    gateResults: { G0_preflight: 'PASS', G1_contract: 'PASS', G2_rendered_fidelity: 'PASS', G3_state_interaction: 'PASS' },
    gateSequence: ['G0_preflight', 'G1_contract', 'G2_rendered_fidelity', 'G3_state_interaction'],
    renderedEvidence: { verified: true }
  };

  const bogus = enforceTrackAAdmission({ ...base, captures: { arbitraryKey: true } });
  assert.notStrictEqual(bogus.status, 'OK', 'arbitrary captures object must not unlock design-build');

  const partial = enforceTrackAAdmission({ ...base, captures: { 'desktop-1440': { verdict: 'PARITY_PASS' } } });
  assert.notStrictEqual(partial.status, 'OK', 'a missing mobile-390 capture must not unlock design-build');
});

// --- R6-8 (MEDIUM): comparing across different landmark sets must fail.
test('R6-8 compareRendered refuses mismatched landmark sets', async () => {
  const mod = await import(
    require('url').pathToFileURL(path.join(REPO, 'scripts/design-build-v2/render-parity.mjs')).href
  );
  assert.strictEqual(
    typeof mod.compareRendered, 'function'
  );

  // Two measurements that carry different landmark profiles must not compare as equal.
  const setA = [{ name: 'header', selector: '.foo', props: ['display'] }];
  const setB = [{ name: 'header', selector: '.bar', props: ['display'] }];

  const measuredA = { landmarks: { header: { present: true, props: { display: 'block' } } }, profileKey: mod.landmarkProfileKey(setA) };
  const measuredB = { landmarks: { header: { present: true, props: { display: 'block' } } }, profileKey: mod.landmarkProfileKey(setB) };

  assert.notStrictEqual(
    measuredA.profileKey, measuredB.profileKey,
    'different landmark sets must produce different profile keys'
  );

  const result = mod.compareRendered(measuredA, measuredB, 0, setA);
  // compareRendered returns `code`, not `verdict`: asserting the wrong field
  // made this check pass vacuously.
  assert.strictEqual(result.code, 'PARITY_FAIL',
    'measurements from different landmark profiles must not pass');
  assert.ok(
    result.diffs.some(d => d.property === 'landmarkSet'),
    `expected a landmarkSet diff, got ${JSON.stringify(result.diffs)}`
  );
});

// An omitted comparison scope for a custom measurement must not fall back to
// the P-WEB1 fixture defaults.
test('R6-9 omitted comparison scope for a custom measurement fails', async () => {
  const mod = await import(
    require('url').pathToFileURL(path.join(REPO, 'scripts/design-build-v2/render-parity.mjs')).href
  );
  const custom = [{ name: 'app-header', selector: '.app-header', props: ['display'] }];
  const measured = {
    landmarks: { 'app-header': { present: true, visible: true, styles: { display: 'flex' }, box: { width: 10, height: 10 } } },
    profileKey: mod.landmarkProfileKey(custom)
  };
  const result = mod.compareRendered(measured, measured, 0.5);
  assert.strictEqual(result.code, 'PARITY_FAIL',
    'a custom measurement must not be compared against fixture defaults');
});

// A reduced or empty explicit scope must not pass either.
test('R6-10 empty or reduced comparison scope fails', async () => {
  const mod = await import(
    require('url').pathToFileURL(path.join(REPO, 'scripts/design-build-v2/render-parity.mjs')).href
  );
  const full = [
    { name: 'header', selector: '.h', props: ['display'] },
    { name: 'footer', selector: '.f', props: ['display'] }
  ];
  const mk = () => ({
    landmarks: {
      header: { present: true, visible: true, styles: { display: 'block' }, box: { width: 1, height: 1 } },
      footer: { present: true, visible: true, styles: { display: 'block' }, box: { width: 1, height: 1 } }
    },
    profileKey: mod.landmarkProfileKey(full)
  });
  assert.strictEqual(mod.compareRendered(mk(), mk(), 0.5, []).code, 'PARITY_FAIL',
    'an empty scope must not pass');
  assert.strictEqual(mod.compareRendered(mk(), mk(), 0.5, [full[0]]).code, 'PARITY_FAIL',
    'a reduced scope must not pass');
});

(async () => {
  console.log('\n=== Round-6 review fixes ===\n');
  await run();
  for (const dir of TEMP_DIRS) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
})();
