'use strict';
// V1.1.2 targeted regression: every prior RED must now fail closed, and every
// supported path must still work. All cases run the real production helper.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const H = require('../.opencode/scripts/refactor-clean-evidence.cjs');
const { capture, compare, applyHunks, runNodeTests, runPhpTests, evaluatePass, verifyLoadedSkill, parseJUnit, resolvePhp, planDigest, makePlan } = H;

const roots = [];
const HELP = path.resolve(__dirname, '../.opencode/scripts/refactor-clean-evidence.cjs');
function root(label) { const r = fs.mkdtempSync(path.join(os.tmpdir(), 'rc112-' + label + '-')); roots.push(r); return r; }
function put(r, rel, text, mode) { const f = path.join(r, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); if (mode) fs.chmodSync(f, mode); return f; }
function scratch(label) { const s = fs.mkdtempSync(path.join(os.tmpdir(), 'rc112-scratch-' + label + '-')); roots.push(s); return s; }
after(() => { for (const r of roots) { try { fs.rmSync(r, { recursive: true, force: true }); } catch (_) { /* already gone */ } } });

const GREEN_TEST = `'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
test('behavior', () => { assert.strictEqual(2 + 2, 4); });
`;
function jsFixture(label) {
  const r = root(label);
  put(r, 'src/a.js', 'function helper() { return 1; }\nmodule.exports = helper;\n');
  put(r, 'tests/t.tap.js', GREEN_TEST);
  return r;
}

// --- F01 / F03: same-size drift and runner-scope binding --------------------
test('F01 same-size overwrite of an unhashed file during a real test is no longer GREEN', () => {
  const r = jsFixture('f01');
  const outside = put(r, 'other.txt', 'AAAA');
  put(r, 'tests/t.tap.js', `'use strict';
const fs = require('node:fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
test('behavior', () => { assert.strictEqual(1, 1); });
test('unrelated same-size write', () => { fs.writeFileSync('other.txt', 'BBBB'); assert.strictEqual(fs.readFileSync('other.txt', 'utf8'), 'BBBB'); });
`);
  const result = runNodeTests({ root: r, tests: ['tests/t.tap.js'], scope: ['src/a.js'] });
  assert.equal(result.status, 'STALE_SCOPE');
  assert.equal(fs.readFileSync(outside, 'utf8'), 'BBBB'); // the write happened; it is just not GREEN
  assert.notDeepEqual(result.test_plan.scope, ['tests/t.tap.js']);
});

test('F03 runner result is bound to scope, guard, plan and fingerprint; stale preflight never spawns', () => {
  const r = jsFixture('f03');
  put(r, 'tests.cfg', 'cfg\n');
  const plan = { id: 'f03-plan', stage: 'baseline' };
  const snap = capture({ root: r, scope: ['src/a.js'], guard: ['tests/t.tap.js', 'tests.cfg'] });
  const stale = runNodeTests({ root: r, tests: ['tests/t.tap.js'], scope: ['src/a.js'], guard: ['tests.cfg'], plan, expectedFingerprint: '0'.repeat(64) });
  assert.equal(stale.status, 'STALE_SCOPE');
  assert.equal(stale.spawned, false);
  const good = runNodeTests({ root: r, tests: ['tests/t.tap.js'], scope: ['src/a.js'], guard: ['tests.cfg'], plan, expectedFingerprint: snap.fingerprint, stage: 'baseline', run_id: 'f03-run' });
  assert.equal(good.status, 'GREEN');
  assert.equal(good.plan_digest, planDigest(plan));
  assert.equal(good.snapshot_fingerprint, snap.fingerprint);
  assert.equal(good.after_fingerprint, snap.fingerprint);
  assert.equal(good.run_id, 'f03-run');
  assert.deepEqual(good.test_plan.guard, ['tests.cfg', 'tests/t.tap.js']);
});

test('test files used as guards do not collide with the edit scope', () => {
  const r = jsFixture('guard-tests');
  const plan = { id: 'guard-tests-plan' };
  const snap = capture({ root: r, scope: ['src/a.js'], guard: ['tests/t.tap.js'] });
  const run = runNodeTests({ root: r, tests: ['tests/t.tap.js'], scope: ['src/a.js'], guard: ['tests/t.tap.js'], plan, expectedFingerprint: snap.fingerprint });
  assert.equal(run.status, 'GREEN');
  assert.deepEqual(run.test_plan.guard, ['tests/t.tap.js']);
  assert.equal(run.spawned, true);
  assert.deepEqual(run.test_plan.scope, ['src/a.js']);
});

// --- F02: guard validation --------------------------------------------------
test('F02 missing, symlinked, special-file and overlapping guards are rejected before any edit', () => {
  const r = jsFixture('f02');
  put(r, 'tests.cfg', 'cfg\n');
  fs.symlinkSync('../src/a.js', path.join(r, 'tests', 'linked.js'));
  spawnSync('mkfifo', [path.join(r, 'tests', 'pipe.cfg')]);
  for (const guard of [['tests/missing.cfg'], ['tests/linked.js'], ['tests/pipe.cfg'], ['src']]) {
    assert.throws(() => capture({ root: r, scope: ['src/a.js'], guard }), /INVALID_GUARD|GUARD_SCOPE_OVERLAP/);
  }
  const ok = capture({ root: r, scope: ['src/a.js'], guard: ['tests.cfg'] });
  assert.ok(ok.inventory.find((row) => row.path === 'tests.cfg').sha256);
});

// --- PHP default disposition: no unproven profile may spawn ------------------
test('F04 PHP executable identity is a capability probe, not execution authority', () => {
  const r = root('f04');
  put(r, 'tests/Feature/X.php', '<?php\n');
  put(r, 'artisan', '<?php echo "PHP\n";\n', 0o755);
  const php = resolvePhp();
  assert.ok(php && /^PHP \d/.test(php.version));
  const result = runPhpTests({ root: r, tests: ['tests/Feature/X.php'], runner: { kind: 'artisan-test' }, env: { APP_ENV: 'testing', DB_CONNECTION: 'sqlite', DB_DATABASE: ':memory:' } });
  assert.equal(result.status, 'NOT_SUPPORTED');
  assert.equal(result.reason, 'PHP_ISOLATION_NOT_VERIFIED');
  assert.equal(result.spawned, false);
  assert.equal(result.command, undefined);
});
test('F05 JUnit parser reconciles nested suites and rejects contradictory aggregates', () => {
  const xml = '<testsuites tests="2" failures="0" errors="0" skipped="0" assertions="5"><testsuite name="unit" tests="2" failures="0" errors="0" assertions="5"/></testsuites>';
  assert.deepEqual(parseJUnit(xml), { tests: 2, failures: 0, errors: 0, skipped: 0, assertions: 5 });
  assert.equal(parseJUnit('<!DOCTYPE testsuite [<!ENTITY x "y">]><testsuites tests="1"/>'), null);
  const contradictory = '<testsuites tests="1" failures="0" errors="0" assertions="1"><testsuite tests="1" failures="1" errors="0" assertions="1"><testcase><failure/></testcase></testsuite></testsuites>';
  assert.equal(parseJUnit(contradictory), null);
  assert.equal(parseJUnit('<testsuites tests="1" failures="0" errors="0"/>').assertions, 0);
});
test('F05 parser-only fixture can never grant a production GREEN', () => {
  const r = root('f05');
  put(r, 'tests/Feature/X.php', '<?php\n');
  const marker = put(r, 'marker.txt', 'ORIGINAL');
  put(r, 'vendor/bin/phpunit', `#!/usr/bin/env php\n<?php file_put_contents(__DIR__.'/../../marker.txt','SPAWNED');\n`, 0o755);
  const result = runPhpTests({ root: r, tests: ['tests/Feature/X.php'], runner: { kind: 'relative-path', command: 'vendor/bin/phpunit' }, env: { APP_ENV: 'testing', DB_CONNECTION: 'sqlite', DB_DATABASE: ':memory:' } });
  assert.equal(result.status, 'NOT_SUPPORTED'); assert.equal(result.spawned, false);
  assert.equal(fs.readFileSync(marker, 'utf8'), 'ORIGINAL');
});
test('F06 pre-existing DB sentinel and helper DB creation are both denied before spawn', () => {
  const r = root('f06');
  put(r, 'tests/Feature/X.php', '<?php\n');
  const sentinel = put(r, 'rc111-test.sqlite', 'SENTINEL-ORIGINAL\n');
  const marker = path.join(r, 'spawned.marker');
  put(r, 'vendor/bin/phpunit', '#!/usr/bin/env php\n<?php file_put_contents($argv[1], "spawned");\n', 0o755);
  const dbs = scratch('f06');
  const before = fs.readdirSync(dbs).length;
  for (const env of [{ APP_ENV: 'testing', DB_CONNECTION: 'sqlite', DB_DATABASE: 'rc111-test.sqlite' }, { APP_ENV: 'testing', DB_CONNECTION: 'sqlite' }]) {
    const result = runPhpTests({ root: r, tests: ['tests/Feature/X.php'], runner: { kind: 'relative-path', command: 'vendor/bin/phpunit', args: [marker] }, env, dbDir: dbs });
    assert.equal(result.status, 'NOT_SUPPORTED'); assert.equal(result.reason, 'PHP_ISOLATION_NOT_VERIFIED');
    assert.equal(result.spawned, false);
  }
  assert.equal(fs.existsSync(marker), false);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'SENTINEL-ORIGINAL\n');
  assert.equal(fs.readdirSync(dbs).length, before);
});

// --- F07: verification integrity -------------------------------------------
test('F07 legacy plans are diagnostics and cannot grant PASS_COMPLETE', () => {
  const r = jsFixture('f07');
  const plan = { id: 'f07-plan' };
  const applied = applyHunks({ root: r, snapshot: capture({ root: r, scope: ['src/a.js'], guard: ['tests/t.tap.js'] }),
    hunks: [{ path: 'src/a.js', before: 'function helper() { return 1; }', after: 'function helper() { return 2; }' }],
    authorizedPaths: ['src/a.js'], scratch: scratch('f07') });
  assert.equal(applied.status, 'APPLIED');
  const executed = runNodeTests({ root: r, tests: ['tests/t.tap.js'], scope: ['src/a.js'], plan,
    expectedFingerprint: applied.snapshot.fingerprint });
  assert.equal(executed.status, 'GREEN');
  assert.equal(executed.diagnostic, true);
  assert.equal(evaluatePass({ applied, postTests: { status: 'GREEN' }, plan }).status, 'APPLIED_PENDING_TESTS');
  assert.equal(evaluatePass({ applied, postTests: { ...executed, plan_digest: 'wrong' }, plan }).status, 'APPLIED_PENDING_TESTS');
  assert.equal(evaluatePass({ applied, postTests: { ...executed, assertions: 0 }, plan }).status, 'APPLIED_PENDING_TESTS');
  assert.equal(evaluatePass({ applied, postTests: executed, plan }).status, 'APPLIED_PENDING_TESTS');
});

// --- F08 / F09: supported channel and adapter dispatch ----------------------
test('F08 CLI apply stays deliberately blocked and names the supported module channel', () => {
  const r = jsFixture('f08');
  const request = path.join(r, 'request.json');
  fs.writeFileSync(request, JSON.stringify({ root: r, scope: ['src/a.js'], hunks: [], authorizedPaths: ['src/a.js'], scratch: scratch('f08') }));
  const result = spawnSync(process.execPath, [HELP, 'apply', request], { encoding: 'utf8' });
  const body = JSON.parse(result.stderr);
  assert.notEqual(result.status, 0);
  assert.equal(body.reason, 'BLOCKED_NATIVE_CHILD_AND_BASELINE_PROOF_REQUIRED');
  assert.equal(body.supported_channel, 'MODULE_APPLY');
});
test('F09 CLI tests maps an unproven PHP profile to NOT_SUPPORTED exit 2', () => {
  const r = root('f09');
  put(r, 'tests/Feature/X.php', '<?php\n');
  const request = path.join(r, 'request.json');
  fs.writeFileSync(request, JSON.stringify({ root: r, tests: ['tests/Feature/X.php'], runner: { kind: 'artisan-test' }, env: { APP_ENV: 'testing', DB_CONNECTION: 'sqlite', DB_DATABASE: ':memory:' } }));
  const result = spawnSync(process.execPath, [HELP, 'tests', request], { encoding: 'utf8' });
  const body = JSON.parse(result.stdout);
  assert.equal(result.status, 2);
  assert.equal(body.status, 'NOT_SUPPORTED');
  assert.equal(body.reason, 'PHP_ISOLATION_NOT_VERIFIED');
  assert.equal(body.spawned, false);
});

// --- F10 / F11: honest evidence classification and partial state ------------
test('F10 verifier output is explicitly not live evidence', () => {
  const source = '---\nname: ecc-remove-deadcode-safe\n---\n\nSAFE RULE\n';
  const body = '\nSAFE RULE\n';
  const expected = { id: 'ecc-remove-deadcode-safe', source, body, sha256: require('node:crypto').createHash('sha256').update(source).digest('hex'), path: '/installed/SKILL.md' };
  const result = verifyLoadedSkill({ expected,
    session: { id: 'ses_A', parentID: 'ses_P', agent: 'code-simplifier' }, requestedSession: 'ses_A', requestedParent: 'ses_P',
    registry: { id: expected.id, path: expected.path, content: body },
    messages: [{ id: 'm1', type: 'skill', skill: expected.id, text: body, time: { created: 1 } }] });
  assert.equal(result.status, 'LOADED');
  assert.equal(result.evidence_kind, 'CALLER_SUPPLIED_STRUCTURES');
  assert.equal(result.live_evidence, false);
});
test('F11 PARTIAL_CONFLICT preserves applied edits and recovery disclosure', () => {
  const disclosure = { status: 'PARTIAL_CONFLICT', edits: [{ path: 'src/a.js' }], recovery: '/scratch/preimage.json' };
  const result = evaluatePass({ applied: disclosure, postTests: { status: 'GREEN' } });
  assert.equal(result.status, 'PARTIAL_CONFLICT');
  assert.equal(result.edits, 1);
  assert.equal(result.recovery, '/scratch/preimage.json');
});

// --- apply-module: strict plan, run/stage lineage and file-based invocation -
function moduleRequest(overrides = {}) {
  const r = jsFixture('module');
  const scope = ['src/a.js']; const tests = ['tests/t.tap.js'];
  const plan = makePlan({ root: r, scope, tests });
  const snapshot = capture({ root: r, scope, guard: plan.guard });
  const baseline = runNodeTests({ root: r, tests, scope, guard: plan.guard, plan,
    expectedFingerprint: snapshot.fingerprint, stage: 'baseline', run_id: 'module-run' });
  const source = '---\nname: ecc-remove-deadcode-safe\n---\n\nSAFE RULE\n';
  const body = '\nSAFE RULE\n';
  const expected = { id: 'ecc-remove-deadcode-safe', source, body,
    sha256: require('node:crypto').createHash('sha256').update(source).digest('hex'), path: '/installed/SKILL.md' };
  const skillEvidence = verifyLoadedSkill({ expected,
    session: { id: 'ses_childA', parentID: 'ses_parent', agent: 'code-simplifier' },
    requestedSession: 'ses_childA', requestedParent: 'ses_parent',
    registry: { id: expected.id, path: expected.path, content: body },
    messages: [{ id: 'm1', type: 'skill', skill: expected.id, text: body, time: { created: 1 } }] });
  assert.equal(baseline.status, 'GREEN', baseline.reason);
  return Object.assign({
    root: r, scope, guard: plan.guard, snapshot, plan, baseline, skillEvidence,
    expectedSkill: 'ecc-remove-deadcode-safe', pass: 'A', stage: 'apply-A', run_id: 'module-run',
    authorizedPaths: ['src/a.js'], scratch: scratch('module'),
    hunks: [{ path: 'src/a.js', before: 'function helper() { return 1; }', after: 'function helper() { return 2; }' }],
  }, overrides);
}
function invokeModule(request) {
  const file = path.join(request.scratch, 'module-request.json');
  fs.writeFileSync(file, JSON.stringify(request));
  return spawnSync(process.execPath, [HELP, 'apply-module', file], { encoding: 'utf8' });
}
test('apply-module applies a guarded edit from a file request, without inline interpreter', () => {
  const request = moduleRequest();
  const result = invokeModule(request);
  assert.equal(result.status, 0, result.stderr);
  const body = JSON.parse(result.stdout);
  assert.equal(body.status, 'APPLIED');
  assert.equal(body.mode, 'MODULE_INVOCATION');
  assert.equal(body.stage, 'apply-A');
  assert.equal(body.edits.length, 1);
  assert.equal(body.edits[0].path, 'src/a.js');
  assert.equal(body.edits[0].before, undefined);
  assert.match(fs.readFileSync(path.join(request.root, 'src/a.js'), 'utf8'), /return 2/);
  assert.equal(body.preconditions.skill_id, 'ecc-remove-deadcode-safe');
});
test('apply-module fails closed without plan-bound baseline, skill, run or stage', () => {
  const cases = [
    [{ baseline: null }, /BASELINE/],
    [{ skillEvidence: null }, /SKILL/],
    [{ plan: { id: 'another-plan' } }, /INVALID_VERIFICATION_PLAN|BASELINE/],
    [{ expectedSkill: 'ecc-remove-ai-slops-safe' }, /SKILL/],
    [{ run_id: 'foreign-run' }, /BASELINE/],
    [{ stage: 'apply-B' }, /SKILL|STAGE|PRIOR_PASS_NOT_VERIFIED/],
  ];
  for (const [overrides, pattern] of cases) {
    const result = invokeModule(moduleRequest(overrides));
    assert.notEqual(result.status, 0, JSON.stringify(overrides));
    assert.match(JSON.parse(result.stderr).reason, pattern);
  }
});
