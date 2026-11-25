/**
 * Tests for Antigravity CLI unified E2E runner + read-only security audit.
 *
 * Run with: node tests/lib/e2e-antigravity-runner.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  E2E_SUBCOMMANDS,
  READ_ONLY_AUDIT_TOOLS,
  isReadOnlyAuditTools,
  resolveMapperResource,
  validateReceipt
} = require('../../scripts/lib/e2e-antigravity-target');
const { adaptAntigravityAgent } = require('../../scripts/lib/install/antigravity-agent');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed += 1; }
  catch (error) { console.log(`  ✗ ${name}`); console.log(`    ${error.message}`); failed += 1; }
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'a4-e2e-'));
  return { root };
}

function runTests() {
  console.log('\n=== Testing Antigravity CLI E2E runner (Phase A4) ===\n');
  const f = fixture();

  test('target-aware mapper resolution: opencode vs antigravity-cli', () => {
    const oc = resolveMapperResource('opencode', f.root);
    const agy = resolveMapperResource('antigravity-cli', f.root);
    assert.strictEqual(oc.resource, '.opencode/resources/e2e-journey-mapper.md');
    assert.strictEqual(agy.resource, '.agents/ecc-opl/e2e/e2e-journey-mapper.md');
    assert.strictEqual(oc.exists, false);
    assert.strictEqual(agy.exists, false);
  });

  test('unknown target is rejected', () => {
    assert.throws(() => resolveMapperResource('random-host', f.root), /unsupported E2E target/);
  });

  test('E2E V2 surface preserves map/run/full/status/help', () => {
    assert.deepStrictEqual([...E2E_SUBCOMMANDS], ['map', 'run', 'full', 'status', 'help']);
  });

  test('valid behavioral receipt is accepted', () => {
    const receipt = {
      testId: 'TEST-E2E-004',
      status: 'PASS',
      assertionCount: 3,
      assertionKind: 'behavioral',
      timestamp: new Date().toISOString(),
      commitHash: 'a7750323'
    };
    assert.deepStrictEqual(validateReceipt(receipt), { ok: true });
  });

  test('malformed receipts fail closed', () => {
    const good = {
      testId: 'TEST-E2E-004', status: 'PASS', assertionCount: 3,
      assertionKind: 'behavioral', timestamp: new Date().toISOString(), commitHash: 'a7750323'
    };
    assert.strictEqual(validateReceipt({ ...good, testId: 'BAD' }).code, 'INVALID_TEST_ID');
    assert.strictEqual(validateReceipt({ ...good, assertionCount: 2.5 }).code, 'INVALID_ASSERTIONS');
    assert.strictEqual(validateReceipt({ ...good, timestamp: 'nope' }).code, 'INVALID_TIMESTAMP');
    assert.strictEqual(validateReceipt({ ...good, commitHash: 'xyz' }).code, 'INVALID_COMMIT');
  });

  test('skipped and non-behavioral receipts cannot claim coverage', () => {
    const good = {
      testId: 'TEST-E2E-004', status: 'PASS', assertionCount: 3,
      assertionKind: 'behavioral', timestamp: new Date().toISOString(), commitHash: 'a7750323'
    };
    assert.strictEqual(validateReceipt({ ...good, skipped: true }).code, 'SKIPPED_NOT_COVERAGE');
    assert.strictEqual(validateReceipt({ ...good, assertionKind: 'visibility-only' }).code, 'NOT_BEHAVIORAL');
  });

  test('read-only audit tool allowlist is minimal', () => {
    assert.deepStrictEqual([...READ_ONLY_AUDIT_TOOLS], ['read_file', 'grep_search', 'find_by_name']);
    assert.strictEqual(isReadOnlyAuditTools(['read_file', 'grep_search', 'find_by_name']), true);
    assert.strictEqual(isReadOnlyAuditTools(['read_file', 'run_command']), false);
    assert.strictEqual(isReadOnlyAuditTools(['write_file']), false);
  });

  test('security-reviewer agent is restricted to read-only tools in CLI mode', () => {
    const source = `---\nname: security-reviewer\ndescription: audit\ntools: Read, Grep, Glob, Bash\nmodel: sonnet\n---\nBody`;
    const adapted = adaptAntigravityAgent(source, '/dst/opl-security-reviewer.md', { runtime: 'cli' });
    const lines = adapted.split('\n');
    const start = lines.findIndex(line => /^tools:/.test(line));
    assert.ok(start >= 0, adapted);
    const tools = [];
    for (const line of lines.slice(start + 1)) {
      const m = /^\s+-\s+(\S+)/.exec(line);
      if (!m) break;
      tools.push(m[1]);
    }
    assert.deepStrictEqual(tools, [...READ_ONLY_AUDIT_TOOLS]);
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

runTests();
