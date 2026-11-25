/**
 * Configurable render-parity landmarks.
 *
 * The original implementation hardcoded P-WEB1 selectors (.topbar,
 * .warehouse-badge, .brand), which meant no other project could ever produce a
 * PARITY_PASS. Landmarks must come from a profile so Track A admission is
 * usable beyond one fixture — without letting a caller silently compare
 * against a different landmark set.
 *
 * Run with: node tests/lib/design-build-landmark-profiles.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');

let passed = 0;
let failed = 0;
const queued = [];
function test(name, fn) { queued.push([name, fn]); }
async function runQueued() {
  for (const [name, fn] of queued) {
    try { await fn(); console.log(`  ✓ ${name}`); passed += 1; }
    catch (error) { console.log(`  ✗ ${name}\n    ${error.message.split('\n')[0]}`); failed += 1; }
  }
}
const TEMP_DIRS = [];
function tmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'db-landmarks-'));
  TEMP_DIRS.push(d);
  return d;
}

async function loadModule() {
  return import(path.join(REPO, 'scripts/design-build-v2/render-parity.mjs'));
}

function runTests() {
  console.log('\n=== Configurable render-parity landmarks ===\n');
  test('L1 default profile still exposes the P-WEB1 landmark set', async () => {
    // Kept synchronous by asserting on the source contract via a require of the
    // module namespace below; see L2 for behavioural coverage.
    const src = fs.readFileSync(path.join(REPO, 'scripts/design-build-v2/render-parity.mjs'), 'utf8');
    assert.match(src, /DEFAULT_LANDMARKS/, 'must expose a named default set');
    assert.match(src, /\.topbar/, 'default set keeps the P-WEB1 topbar landmark');
  });

  test('L2 resolveLandmarks returns the default when no profile is given', async () => {
    const mod = await loadModule();
    const resolved = mod.resolveLandmarks();
    assert.ok(Array.isArray(resolved) && resolved.length > 0);
    assert.ok(resolved.some(lm => lm.selector === '.topbar'));
  });

  test('L3 a profile can declare its own landmark set', async () => {
    const mod = await loadModule();
    const custom = [
      { name: 'app-header', selector: '.app-header', props: ['display', 'fontSize'] },
      { name: 'zone-summary', selector: '.zone-summary', props: ['display', 'gap'] }
    ];
    const resolved = mod.resolveLandmarks({ landmarks: custom });
    assert.strictEqual(resolved.length, 2);
    assert.strictEqual(resolved[0].selector, '.app-header');
  });

  test('L4 landmarks missing a selector or props are rejected', async () => {
    const mod = await loadModule();
    assert.throws(() => mod.resolveLandmarks({ landmarks: [{ name: 'x' }] }), /selector/i);
    assert.throws(
      () => mod.resolveLandmarks({ landmarks: [{ name: 'x', selector: '.x' }] }),
      /props/i
    );
  });

  test('L5 comparison refuses to compare two different landmark sets', async () => {
    const mod = await loadModule();
    const setA = [{ name: 'a', selector: '.a', props: ['display'] }];
    const setB = [{ name: 'b', selector: '.b', props: ['display'] }];
    const approved = { landmarks: { a: { present: true, visible: true, styles: { display: 'flex' }, box: { width: 10, height: 10 } } }, screenshotSha256: 'x' };
    const candidate = { landmarks: { b: { present: true, visible: true, styles: { display: 'flex' }, box: { width: 10, height: 10 } } }, screenshotSha256: 'y', source: 'chromium-playwright' };
    const result = mod.compareRendered(approved, candidate, 0.5, setA);
    // Candidate has no landmark named 'a', so this must FAIL rather than pass by accident.
    assert.strictEqual(result.code, 'PARITY_FAIL');
    assert.ok(result.diffs.some(d => d.landmark === 'a' && d.property === 'presence'));
    // setB is a different set entirely; comparing with it must not silently succeed.
    const other = mod.compareRendered(approved, candidate, 0.5, setB);
    assert.strictEqual(other.code, 'PARITY_FAIL');
  });

  test('L6 a custom landmark set compares like for like and passes', async () => {
    const mod = await loadModule();
    const set = [{ name: 'zone', selector: '.zone', props: ['display', 'gap'] }];
    const mk = sha => ({
      landmarks: { zone: { present: true, visible: true, styles: { display: 'grid', gap: '12px' }, box: { width: 320, height: 100 } } },
      screenshotSha256: sha,
      source: 'chromium-playwright'
    });
    const result = mod.compareRendered(mk('aaa'), mk('bbb'), 0.5, set);
    assert.strictEqual(result.code, 'PARITY_PASS');
    assert.strictEqual(result.evidence.verified, true);
  });

  test('L7 landmark profile can be read from a JSON file', async () => {
    const mod = await loadModule();
    const dir = tmp();
    const file = path.join(dir, 'profile.json');
    fs.writeFileSync(file, JSON.stringify({
      landmarks: [{ name: 'hdr', selector: '.app-header', props: ['display'] }]
    }));
    const resolved = mod.resolveLandmarks({ profilePath: file });
    assert.strictEqual(resolved.length, 1);
    assert.strictEqual(resolved[0].selector, '.app-header');
  });

  for (const d of TEMP_DIRS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

runTests();
runQueued().then(() => {
  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
});
