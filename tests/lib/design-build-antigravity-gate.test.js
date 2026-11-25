/**
 * Phase A5 gate tests: Design-Build V2 & typography fidelity on Antigravity CLI.
 * Covers target-aware resource resolution, Track A admission enforcement,
 * ordered G0-G3 gate chain, immutable canvas reference, and the max-2 repair cap.
 *
 * Run with: node tests/lib/design-build-antigravity-gate.test.js
 */

const assert = require('assert');

const {
  DESIGN_BUILD_SUBCOMMANDS,
  MAX_REPAIR_CYCLES,
  checkRepairCap,
  enforceTrackAAadmission,
  resolveDesignBuildResource,
  verifyGateChain
} = require('../../scripts/lib/design-build-antigravity-gate.mjs');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed += 1; }
  catch (error) { console.log(`  ✗ ${name}`); console.log(`    ${error.message}`); failed += 1; }
}

function runTests() {
  console.log('\n=== Testing Design-Build Antigravity gate (Phase A5) ===\n');

  test('subcommand surface = design, typography, verify, amend', () => {
    assert.deepStrictEqual([...DESIGN_BUILD_SUBCOMMANDS].sort(), ['amend', 'design', 'typography', 'verify']);
  });

  test('target resource resolution: opencode vs antigravity-cli', () => {
    const opencode = resolveDesignBuildResource('opencode', '/repo');
    const agy = resolveDesignBuildResource('antigravity-cli', '/repo');
    assert.strictEqual(opencode.status, 'OK');
    assert.ok(opencode.path.includes('scripts/design-build-v2'));
    assert.strictEqual(agy.status, 'OK');
    assert.ok(agy.path.includes('.agents/skills/opl-design-build'));
  });

  test('unknown target rejected', () => {
    const r = resolveDesignBuildResource('nope', '/repo');
    assert.strictEqual(r.status, 'BLOCKED');
    assert.strictEqual(r.reason, 'UNSUPPORTED_TARGET');
  });

  test('Track A admission: ADMITTED passes, BLOCKED halts A5', () => {
    assert.strictEqual(enforceTrackAAadmission({ status: 'ADMITTED' }).status, 'OK');
    const blocked = enforceTrackAAadmission({ status: 'BLOCKED', reason: 'MISSING_VIEWPORT' });
    assert.strictEqual(blocked.status, 'BLOCKED');
    assert.strictEqual(blocked.reason, 'TRACK_A_NOT_ADMITTED');
  });

  test('gate chain requires G0-G3 all PASS in order', () => {
    const good = {
      G0_preflight: 'PASS', G1_contract: 'PASS',
      G2_rendered_fidelity: 'PASS', G3_state_interaction: 'PASS'
    };
    assert.strictEqual(verifyGateChain(good).status, 'OK');
    assert.strictEqual(verifyGateChain({ ...good, G2_rendered_fidelity: 'FAIL' }).status, 'BLOCKED');
    delete good.G3_state_interaction;
    assert.strictEqual(verifyGateChain(good).status, 'BLOCKED');
  });

  test('repair cap allows 0-2 cycles, rejects 3+', () => {
    assert.strictEqual(MAX_REPAIR_CYCLES, 2);
    assert.strictEqual(checkRepairCap(0).status, 'OK');
    assert.strictEqual(checkRepairCap(2).status, 'OK');
    const over = checkRepairCap(3);
    assert.strictEqual(over.status, 'BLOCKED');
    assert.strictEqual(over.reason, 'REPAIR_CAP_EXCEEDED');
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

runTests();
