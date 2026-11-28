/**
 * Tests for the Plan Canvas SDK mode machine.
 *
 * The SDK runs in the preview document and cannot be imported, so these are
 * static assertions over the generated source. Behavioural acceptance (§10 of
 * the plan) needs a real browser and is recorded in the work item.
 *
 * Run with: node tests/lib/plan-canvas-edit-sdk.test.js
 */

const assert = require('assert');
const { artifactSdkJs } = require('../../scripts/lib/plan-canvas/sdk');

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
    return false;
  }
}

function runTests() {
  console.log('\n=== Testing plan-canvas sdk mode machine ===\n');

  const sdk = artifactSdkJs();
  let passed = 0;
  let failed = 0;

  if (test('accepts the three-mode protocol', () => {
    assert.ok(sdk.includes("msg.mode === 'edit'"), 'edit mode accepted');
    assert.ok(sdk.includes("msg.mode === 'interact'"), 'interact mode accepted');
    assert.ok(sdk.includes("msg.mode === 'annotate'"), 'annotate mode accepted');
  })) passed++; else failed++;

  if (test('a legacy {annotate} message still maps to a mode', () => {
    assert.ok(sdk.includes("(msg.annotate ? 'annotate' : 'interact')"), 'legacy mapping kept');
  })) passed++; else failed++;

  if (test('edit mode swallows the click so the app never runs it', () => {
    assert.ok(sdk.includes("if (mode === 'edit')"), 'edit branch exists');
    const branch = sdk.slice(sdk.indexOf("if (mode === 'edit')"));
    assert.ok(branch.slice(0, 300).includes('e.preventDefault()'), 'click prevented');
    assert.ok(branch.slice(0, 300).includes('e.stopPropagation()'), 'click stopped');
  })) passed++; else failed++;

  if (test('leaving a mode clears the annotation overlay', () => {
    assert.ok(sdk.includes("if (mode !== 'annotate')"), 'overlay cleared outside annotate');
  })) passed++; else failed++;

  if (test('the SDK never fetches or writes files', () => {
    assert.ok(!/\bfetch\s*\(/.test(sdk), 'no fetch');
    assert.ok(!sdk.includes('outerHTML'), 'no source export');
    assert.ok(!sdk.includes('Blob('), 'no download');
  })) passed++; else failed++;

  console.log(`\nPassed: ${passed}`);
  console.log(`Failed: ${failed}`);
  return failed === 0;
}

if (require.main === module) {
  process.exitCode = runTests() ? 0 : 1;
}

module.exports = { runTests };
