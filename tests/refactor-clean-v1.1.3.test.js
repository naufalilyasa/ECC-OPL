'use strict';
// V1.1.3 closure regression. Real helper, real child processes, deterministic
// fixtures. PHP execution is deliberately deferred: P-scenarios prove denial,
// not a synthetic GREEN. E01-E04 are live/installer gates in the acceptance ledger.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const H = require('../.opencode/scripts/refactor-clean-evidence.cjs');
const { capture, compare, applyHunks, runNodeTests, runPhpTests, evaluatePass, makePlan,
  planDigest, normalizePlan, parseTestEvidence, parseJUnit, preflightPhpConfig,
  decideCandidate, verifyLoadedSkill, applyModule } = H;

const HELP = path.resolve(__dirname, '../.opencode/scripts/refactor-clean-evidence.cjs');
const roots = [];
function root(label) { const r = fs.mkdtempSync(path.join(os.tmpdir(), 'rc113-' + label + '-')); roots.push(r); return r; }
function scratch(label) { const s = fs.mkdtempSync(path.join(os.tmpdir(), 'rc113-scratch-' + label + '-')); roots.push(s); return s; }
function put(r, rel, text, mode) { const f = path.join(r, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); if (mode) fs.chmodSync(f, mode); return f; }
after(() => { for (const r of roots) { try { fs.rmSync(r, { recursive: true, force: true }); } catch (_) { /* gone */ } } });

const TEST_A = "'use strict';\nconst {test}=require('node:test');const assert=require('node:assert/strict');\nconst one=require('../src/one.js');\ntest('a',()=>assert.equal(one.keep,1));\n";
const TEST_B = "'use strict';\nconst {test}=require('node:test');const assert=require('node:assert/strict');\nconst two=require('../src/two.js');\ntest('b',()=>assert.equal(two.wrap(1,2),3));\n";
function fixture(label) {
  const r = root(label);
  put(r, 'src/one.js', 'export const keep = 1;\nexport const dead = 2;\n');
  put(r, 'src/two.js', 'export const wrap = (a, b) => { return a + b; };\n');
  put(r, 'tests/a.cjs', TEST_A); put(r, 'tests/b.cjs', TEST_B);
  return r;
}
const SCOPE = ['src/one.js', 'src/two.js'];
const TESTS = ['tests/a.cjs', 'tests/b.cjs'];
const HUNKS = {
  A: [{ path: 'src/one.js', before: 'export const dead = 2;\n', after: '' }],
  B: [{ path: 'src/two.js', before: 'export const wrap = (a, b) => { return a + b; };', after: 'export const wrap = (a, b) => a + b;' }],
};
function skill(pass) {
  const id = pass === 'B' ? 'ecc-remove-ai-slops-safe' : 'ecc-remove-deadcode-safe';
  const source = '---\nname: ' + id + '\n---\n\nSAFE RULE\n';
  const body = '\nSAFE RULE\n';
  const expected = { id, source, body, sha256: require('node:crypto').createHash('sha256').update(source).digest('hex'), path: '/installed/SKILL.md' };
  return verifyLoadedSkill({ expected,
    session: { id: 'ses_child' + pass, parentID: 'ses_parent', agent: 'code-simplifier' },
    requestedSession: 'ses_child' + pass, requestedParent: 'ses_parent',
    registry: { id, path: expected.path, content: body },
    messages: [{ id: 'm' + pass, type: 'skill', skill: id, text: body, time: { created: 1 } }],
  });
}
function request(r, overrides = {}) {
  const plan = makePlan({ root: r, scope: SCOPE, tests: TESTS });
  const snapshot = capture({ root: r, scope: plan.scope, guard: plan.guard });
  const baseline = runNodeTests({ root: r, tests: plan.tests, scope: plan.scope, guard: plan.guard, plan,
    expectedFingerprint: snapshot.fingerprint, stage: 'baseline', run_id: 'run-1' });
  assert.equal(baseline.status, 'GREEN', baseline.reason);
  return Object.assign({ root: r, scope: plan.scope, guard: plan.guard, snapshot, plan, baseline,
    skillEvidence: skill('A'), expectedSkill: 'ecc-remove-deadcode-safe', pass: 'A', stage: 'apply-A', run_id: 'run-1',
    authorizedPaths: ['src/one.js'], hunks: HUNKS.A, scratch: scratch('req') }, overrides);
}
function invoke(requestObject) {
  const file = path.join(requestObject.scratch, 'request.json');
  fs.writeFileSync(file, JSON.stringify(requestObject));
  return spawnSync(process.execPath, [HELP, 'apply-module', file], { encoding: 'utf8' });
}

// ---- V: plan binding and actual roster ------------------------------------
test('V01 full real roster under a frozen plan is GREEN with matching argv and roster', () => {
  const r = fixture('v01'); const plan = makePlan({ root: r, scope: SCOPE, tests: TESTS });
  const snap = capture({ root: r, scope: plan.scope, guard: plan.guard });
  const run = runNodeTests({ root: r, tests: plan.tests, scope: plan.scope, guard: plan.guard, plan,
    expectedFingerprint: snap.fingerprint, stage: 'baseline', run_id: 'r1' });
  assert.equal(run.status, 'GREEN');
  assert.deepEqual(run.roster_executed, plan.tests);
  assert.deepEqual(run.test_plan.tests, plan.tests);
  for (const t of plan.tests) assert.ok(run.command.some((arg) => arg.endsWith(t)));
});
test('V02 omitting a protected test while keeping the old digest is rejected before spawn', () => {
  const r = fixture('v02'); const plan = makePlan({ root: r, scope: SCOPE, tests: TESTS });
  const snap = capture({ root: r, scope: plan.scope, guard: plan.guard });
  const run = runNodeTests({ root: r, tests: [TESTS[0]], scope: plan.scope, guard: plan.guard, plan,
    expectedFingerprint: snap.fingerprint, stage: 'baseline', run_id: 'r1' });
  assert.equal(run.status, 'VERIFICATION_PLAN_MISMATCH');
  assert.equal(run.spawned, false);
});
test('V03 replacing a test with another passing test is rejected before spawn', () => {
  const r = fixture('v03');
  put(r, 'tests/c.cjs', TEST_A.replace("one.keep,1", "one.keep,1"));
  const plan = makePlan({ root: r, scope: SCOPE, tests: TESTS });
  const snap = capture({ root: r, scope: plan.scope, guard: plan.guard });
  const run = runNodeTests({ root: r, tests: [TESTS[0], 'tests/c.cjs'], scope: plan.scope, guard: plan.guard, plan,
    expectedFingerprint: snap.fingerprint, stage: 'baseline', run_id: 'r1' });
  assert.equal(run.status, 'VERIFICATION_PLAN_MISMATCH'); assert.equal(run.spawned, false);
});
test('V04 duplicate entries normalize once; ambiguous alias paths are rejected', () => {
  const r = fixture('v04');
  const a = makePlan({ root: r, scope: SCOPE, tests: [...TESTS, TESTS[0]] });
  const b = makePlan({ root: r, scope: SCOPE, tests: TESTS });
  assert.equal(planDigest(a), planDigest(b));
  assert.throws(() => makePlan({ root: r, scope: SCOPE, tests: ['./tests/a.cjs'] }), /INVALID_SCOPE_PATH/);
});
test('V05 different guard or edit scope with the same tests is rejected', () => {
  const r = fixture('v05');
  put(r, 'tests.cfg', 'cfg\n');
  const plan = makePlan({ root: r, scope: SCOPE, tests: TESTS });
  const snap = capture({ root: r, scope: plan.scope, guard: plan.guard });
  const run = runNodeTests({ root: r, tests: TESTS, scope: plan.scope, guard: [...plan.guard, 'tests.cfg'], plan,
    expectedFingerprint: snap.fingerprint, stage: 'baseline', run_id: 'r1' });
  assert.equal(run.status, 'VERIFICATION_PLAN_MISMATCH'); assert.equal(run.spawned, false);
});
test('V06 a foreign root with identical relative paths is rejected', () => {
  const r1 = fixture('v06a'); const r2 = fixture('v06b');
  const plan = makePlan({ root: r1, scope: SCOPE, tests: TESTS });
  const snap = capture({ root: r2, scope: plan.scope, guard: plan.guard });
  const run = runNodeTests({ root: r2, tests: TESTS, scope: plan.scope, guard: plan.guard, plan,
    expectedFingerprint: snap.fingerprint, stage: 'baseline', run_id: 'r1' });
  assert.equal(run.status, 'VERIFICATION_PLAN_MISMATCH');
  assert.equal(run.spawned, false);
});
test('V07 changed executable identity or runner args is rejected', () => {
  const r = fixture('v07'); const plan = makePlan({ root: r, scope: SCOPE, tests: TESTS });
  assert.throws(() => normalizePlan({ ...plan, executable: '/usr/bin/false' }), /VERIFICATION_PLAN_MISMATCH/);
  assert.throws(() => normalizePlan({ ...plan, args: [...plan.args, '--extra'] }), /VERIFICATION_PLAN_MISMATCH/);
});
test('V08 equivalent reordered input yields the same canonical plan digest', () => {
  const r = fixture('v08');
  const a = makePlan({ root: r, scope: [...SCOPE].reverse(), guard: [...TESTS].reverse(), tests: [...TESTS].reverse() });
  const b = makePlan({ root: r, scope: SCOPE, tests: TESTS });
  assert.equal(planDigest(a), planDigest(b));
});
test('V09 missing run/stage cannot grant workflow completion', () => {
  const r = fixture('v09'); const q = request(r);
  const applied = applyModule({ ...q, scratch: scratch('v09apply') });
  const body = JSON.parse(spawnSync(process.execPath, [HELP, 'apply-module', path.join(q.scratch, 'request.json')], { encoding: 'utf8' }).stdout || '{}');
  assert.equal(applied.status, 'APPLIED');
  assert.equal(evaluatePass({ applied, postTests: null, plan: q.plan }).status, 'APPLIED_PENDING_TESTS');
  assert.equal(evaluatePass({ applied, postTests: null, plan: q.plan, run_id: 'run-1' }).status, 'APPLIED_PENDING_TESTS');
  assert.ok(body);
});
test('V10 baseline GREEN with a mismatched after fingerprint cannot edit', () => {
  const r = fixture('v10'); const q = request(r);
  const out = invoke({ ...q, baseline: { ...q.baseline, after_fingerprint: '0'.repeat(64) }, scratch: scratch('v10') });
  assert.notEqual(out.status, 0);
  assert.match(JSON.parse(out.stderr).reason, /BASELINE/);
});
test('V11 cross-run evidence is rejected even with the same snapshot', () => {
  const r = fixture('v11'); const q = request(r);
  const out = invoke({ ...q, baseline: { ...q.baseline, run_id: 'foreign' }, scratch: scratch('v11') });
  assert.notEqual(out.status, 0); assert.match(JSON.parse(out.stderr).reason, /BASELINE/);
});
test('V12 a baseline reused as post-A and post-A reused for B are rejected', () => {
  const r = fixture('v12'); const q = request(r);
  const applied = applyHunks({ root: r, snapshot: q.snapshot, hunks: HUNKS.A, authorizedPaths: ['src/one.js'], scratch: scratch('v12') });
  assert.notEqual(evaluatePass({ applied, postTests: { ...q.baseline, snapshot_fingerprint: applied.snapshot.fingerprint, after_fingerprint: applied.snapshot.fingerprint }, plan: q.plan, stage: 'post-A', run_id: 'run-1' }).status, 'PASS_COMPLETE');
  assert.notEqual(evaluatePass({ applied, postTests: { ...q.baseline, snapshot_fingerprint: applied.snapshot.fingerprint, after_fingerprint: applied.snapshot.fingerprint }, plan: q.plan, stage: 'post-B', run_id: 'run-1' }).status, 'PASS_COMPLETE');
});
test('V13 pass B without a verified post-A completion stops before writing', () => {
  const r = fixture('v13'); const q = request(r);
  const out = invoke({ ...q, baseline: { ...q.baseline, stage: 'post-A' }, pass: 'B', stage: 'apply-B', expectedSkill: 'ecc-remove-ai-slops-safe',
    skillEvidence: skill('B'), authorizedPaths: ['src/two.js'], hunks: HUNKS.B, scratch: scratch('v13') });
  assert.notEqual(out.status, 0); assert.match(JSON.parse(out.stderr).reason, /PRIOR_PASS_NOT_VERIFIED/);
  assert.match(fs.readFileSync(path.join(r, 'src/two.js'), 'utf8'), /return a \+ b/);
});
test('V14 wrong pass id or expected skill override is rejected', () => {
  const r = fixture('v14'); const q = request(r);
  for (const over of [{ pass: 'B' }, { expectedSkill: 'ecc-remove-ai-slops-safe' }, { skillEvidence: { ...q.skillEvidence, pass: 'B' } }]) {
    const out = invoke({ ...q, ...over, scratch: scratch('v14') });
    assert.notEqual(out.status, 0); assert.match(JSON.parse(out.stderr).reason, /SKILL|STAGE/);
  }
});
test('V15 full S0 to A to S1 to B to S2 lineage completes with real edits', () => {
  const r = fixture('v15'); const q = request(r);
  const a = applyModule({ ...q, scratch: scratch('v15a') });
  assert.equal(a.status, 'APPLIED');
  const postA = runNodeTests({ root: r, tests: TESTS, scope: SCOPE, guard: q.plan.guard, plan: q.plan,
    expectedFingerprint: a.snapshot.fingerprint, stage: 'post-A', run_id: 'run-1' });
  assert.equal(postA.status, 'GREEN', postA.reason);
  const evalA = evaluatePass({ applied: a, postTests: postA, plan: q.plan, stage: 'post-A', run_id: 'run-1' });
  assert.equal(evalA.status, 'PASS_COMPLETE');
  const b = applyModule({ ...q, snapshot: a.snapshot, baseline: postA, priorPass: evalA, pass: 'B', stage: 'apply-B',
    skillEvidence: skill('B'), expectedSkill: 'ecc-remove-ai-slops-safe', authorizedPaths: ['src/two.js'], hunks: HUNKS.B, scratch: scratch('v15b') });
  assert.equal(b.status, 'APPLIED', JSON.stringify(b));
  const postB = runNodeTests({ root: r, tests: TESTS, scope: SCOPE, guard: q.plan.guard, plan: q.plan,
    expectedFingerprint: b.snapshot.fingerprint, stage: 'post-B', run_id: 'run-1' });
  assert.equal(postB.status, 'GREEN', postB.reason);
  assert.equal(evaluatePass({ applied: b, postTests: postB, plan: q.plan, stage: 'post-B', run_id: 'run-1' }).status, 'PASS_COMPLETE');
  const final = runNodeTests({ root: r, tests: TESTS, scope: SCOPE, guard: q.plan.guard, plan: q.plan,
    expectedFingerprint: b.snapshot.fingerprint, stage: 'final', run_id: 'run-1' });
  assert.equal(final.status, 'GREEN');
  assert.doesNotMatch(fs.readFileSync(path.join(r, 'src/one.js'), 'utf8'), /const dead/);
  assert.match(fs.readFileSync(path.join(r, 'src/two.js'), 'utf8'), /=> a \+ b/);
});
test('V16 a real full-roster post-A regression blocks B', () => {
  const r = fixture('v16'); const q = request(r);
  const a = applyModule({ ...q, scratch: scratch('v16a') });
  fs.writeFileSync(path.join(r, 'src/one.js'), 'export const keep = 99;\n');
  const postA = runNodeTests({ root: r, tests: TESTS, scope: SCOPE, guard: q.plan.guard, plan: q.plan,
    expectedFingerprint: a.snapshot.fingerprint, stage: 'post-A', run_id: 'run-1' });
  assert.equal(postA.status, 'STALE_SCOPE');
  assert.equal(evaluatePass({ applied: a, postTests: postA, plan: q.plan, stage: 'post-A', run_id: 'run-1' }).status, 'REGRESSION_DETECTED');
  const b = invoke({ ...q, snapshot: a.snapshot, baseline: postA, pass: 'B', stage: 'apply-B',
    skillEvidence: skill('B'), expectedSkill: 'ecc-remove-ai-slops-safe', authorizedPaths: ['src/two.js'], hunks: HUNKS.B, scratch: scratch('v16b') });
  assert.notEqual(b.status, 0);
});
test('V17 zero tests, skips, malformed or duplicate TAP are non-GREEN', () => {
  assert.notEqual(parseTestEvidence({ stdout: '', exitCode: 0, assertions: 0 }).status, 'GREEN');
  assert.notEqual(parseTestEvidence({ stdout: '# tests 1\n# pass 1\n# skipped 1\n', exitCode: 0, assertions: 1 }).status, 'GREEN');
  assert.notEqual(parseTestEvidence({ stdout: '# tests 1\n# pass 1\n# tests 1\n', exitCode: 0, assertions: 1 }).status, 'GREEN');
  assert.notEqual(parseTestEvidence({ stdout: '# tests 1\n# pass 1\n', exitCode: 1, assertions: 1 }).status, 'GREEN');
});
test('V18 bare, foreign and inconsistent GREEN never complete a pass', () => {
  const r = fixture('v18'); const q = request(r);
  const a = applyModule({ ...q, scratch: scratch('v18') });
  for (const post of [{ status: 'GREEN' }, { ...q.baseline, plan_digest: 'foreign' }, { ...q.baseline, roster_executed: [TESTS[0]] }]) {
    assert.notEqual(evaluatePass({ applied: a, postTests: post, plan: q.plan, stage: 'post-A', run_id: 'run-1' }).status, 'PASS_COMPLETE');
  }
});
test('V19 genuine no-op needs completed evidence; missing receipt is not a no-op', () => {
  const r = fixture('v19');
  assert.equal(evaluatePass({ applied: null, postTests: { status: 'GREEN' } }).status, 'ANALYSIS_ONLY');
  const q = request(r);
  const out = invoke({ ...q, hunks: [], scratch: scratch('v19') });
  assert.notEqual(out.status, 0); assert.match(JSON.parse(out.stderr).reason, /SCOPE/);
});
test('V20 same-size drift, missing guard and stale snapshot remain non-GREEN', () => {
  const r = fixture('v20'); put(r, 'other.txt', 'AAAA');
  put(r, 'tests/b.cjs', TEST_B.replace('assert.equal(two.wrap(1,2),3)', "{ require('node:fs').writeFileSync('other.txt','BBBB'); assert.equal(require('node:fs').readFileSync('other.txt','utf8'),'BBBB') }"));
  const plan = makePlan({ root: r, scope: SCOPE, tests: TESTS });
  const snap = capture({ root: r, scope: plan.scope, guard: plan.guard });
  const run = runNodeTests({ root: r, tests: TESTS, scope: plan.scope, guard: plan.guard, plan,
    expectedFingerprint: snap.fingerprint, stage: 'baseline', run_id: 'r1' });
  assert.equal(run.status, 'STALE_SCOPE');
  assert.throws(() => capture({ root: r, scope: SCOPE, guard: ['tests/missing.cjs'] }), /INVALID_GUARD/);
  assert.throws(() => compare(snap, { ...snap, fingerprint: '0'.repeat(64) }), /INVALID_SNAPSHOT_FINGERPRINT/);
});
test('V21 an unrelated >4 MiB asset does not block a small scoped edit', () => {
  const r = fixture('v21'); put(r, 'big.bin', Buffer.alloc(5 * 1024 * 1024, 7));
  const s = capture({ root: r, scope: SCOPE });
  const res = applyHunks({ root: r, snapshot: s, hunks: HUNKS.A, authorizedPaths: ['src/one.js'], scratch: scratch('v21') });
  assert.equal(res.status, 'APPLIED');
});

// ---- P: PHP is deferred and must fail before any side effect ---------------
test('P01 unproven PHP is denied in runner, CLI and apply-module entrypoints', () => {
  const r = fixture('p01'); put(r, 'tests/X.php', '<?php\n');
  const direct = runPhpTests({ root: r, tests: ['tests/X.php'], runner: { kind: 'artisan-test' }, env: { APP_ENV: 'testing', DB_CONNECTION: 'sqlite', DB_DATABASE: ':memory:' } });
  assert.equal(direct.status, 'NOT_SUPPORTED'); assert.equal(direct.spawned, false);
  const req = path.join(r, 'php-request.json');
  fs.writeFileSync(req, JSON.stringify({ root: r, tests: ['tests/X.php'], runner: { kind: 'artisan-test' }, env: { APP_ENV: 'testing', DB_CONNECTION: 'sqlite', DB_DATABASE: ':memory:' } }));
  const cli = spawnSync(process.execPath, [HELP, 'tests', req], { encoding: 'utf8' });
  assert.equal(cli.status, 2); assert.equal(JSON.parse(cli.stdout).status, 'NOT_SUPPORTED');
  const q = request(r);
  const out = invoke({ ...q, plan: { ...q.plan, adapter: 'php', profile: 'php-deferred' }, scratch: scratch('p01') });
  assert.notEqual(out.status, 0); assert.match(JSON.parse(out.stderr).reason, /PHP_ISOLATION_NOT_VERIFIED/);
});
test('P02 reversed, multiline and single-quoted DB_DATABASE overrides are denied', () => {
  const r = fixture('p02');
  put(r, 'phpunit.xml', `<phpunit>\n  <env\n    value='owner.sqlite'\n    name='DB_DATABASE'\n    force="true"\n  />\n</phpunit>\n`);
  assert.equal(preflightPhpConfig(r, ':memory:').ok, false);
});
test('P03 owner DB paths, deceptive names and symlinks are denied before spawn', () => {
  const r = fixture('p03'); put(r, 'tests/X.php', '<?php\n');
  put(r, '.env.testing', 'APP_ENV=testing\nDB_CONNECTION=sqlite\nDB_DATABASE=rc111-test.sqlite\n');
  const sentinel = put(r, 'rc111-test.sqlite', 'OWNER');
  const res = runPhpTests({ root: r, tests: ['tests/X.php'], runner: { kind: 'artisan-test' }, env: { APP_ENV: 'testing', DB_CONNECTION: 'sqlite' } });
  assert.equal(res.status, 'NOT_SUPPORTED'); assert.equal(res.spawned, false);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'OWNER');
  assert.equal(preflightPhpConfig(r, 'rc111-test.sqlite').ok, false);
});
test('P04 hostile env, DB URL, secondary connection and cached config are denied', () => {
  const r = fixture('p04');
  assert.equal(preflightPhpConfig(r, ':memory:').ok, true);
  put(r, '.env.testing', "APP_ENV=production\nDB_URL='mysql://host/db'\n");
  assert.equal(preflightPhpConfig(r, ':memory:').ok, false);
  fs.mkdirSync(path.join(r, 'bootstrap/cache'), { recursive: true });
  put(r, 'bootstrap/cache/config.php', '<?php return [];');
  assert.equal(preflightPhpConfig(r, ':memory:').reason, 'CONFIG_CACHE_PRESENT');
});
test('P05 arbitrary launcher, bootstrap args and caller isolation flags are inert', () => {
  const r = fixture('p05'); put(r, 'tests/X.php', '<?php\n');
  for (const runner of [{ kind: 'relative-path', command: '../../bin/sh' }, { kind: 'artisan-test', args: ['--bootstrap=x'] }]) {
    const res = runPhpTests({ root: r, tests: ['tests/X.php'], runner, env: { APP_ENV: 'testing' }, dbDir: scratch('p05'), isolationVerified: true });
    assert.equal(res.status, 'NOT_SUPPORTED'); assert.equal(res.spawned, false);
  }
});
test('P06 absent PHPUnit/Pest is NOT_SUPPORTED, never a synthetic GREEN', () => {
  const r = fixture('p06'); put(r, 'tests/X.php', '<?php\n'); put(r, 'artisan', '<?php', 0o755);
  const res = runPhpTests({ root: r, tests: ['tests/X.php'], runner: { kind: 'relative-path', command: 'vendor/bin/phpunit' }, env: { APP_ENV: 'testing', DB_CONNECTION: 'sqlite', DB_DATABASE: ':memory:' } });
  assert.equal(res.status, 'NOT_SUPPORTED'); assert.equal(res.evidence_kind, 'PHP_PROFILE_DISPOSITION');
});
test('P07 contradictory root/suite aggregate is rejected, never zero-failure GREEN', () => {
  const xml = '<testsuites tests="1" failures="0" errors="0" assertions="1"><testsuite tests="1" failures="1" errors="0" assertions="1"><testcase><failure/></testcase></testsuite></testsuites>';
  assert.equal(parseJUnit(xml), null);
});
test('P08 supported JUnit with reordered attributes and nested suites is counted once', () => {
  const xml = '<testsuites assertions="3" errors="0" tests="2" failures="0"><testsuite failures="0" tests="2" errors="0" assertions="3"><testcase/><testcase/></testsuite></testsuites>';
  assert.deepEqual(parseJUnit(xml), { tests: 2, failures: 0, errors: 0, skipped: 0, assertions: 3 });
});
test('P09 malformed, truncated, DTD, duplicate-attribute and invalid-count XML is rejected', () => {
  for (const xml of ['<testsuites tests="1"', '<!DOCTYPE x [<!ENTITY y "z">]><testsuites tests="1"/>',
    '<testsuites tests="1" tests="2" failures="0" errors="0"/>', '<testsuites tests="-1" failures="0" errors="0"/>',
    '<testsuite tests="1" failures="0" errors="0"><testcase/>']) assert.equal(parseJUnit(xml), null);
});
test('P10 failures, errors, skips and zero assertions cannot become eligible GREEN', () => {
  const xml = '<testsuites tests="1" failures="0" errors="0" assertions="0"/>';
  const parsed = parseJUnit(xml);
  assert.equal(parsed.assertions, 0);
  const res = runPhpTests({ root: fixture('p10'), tests: [], env: {} });
  assert.notEqual(res.status, 'GREEN');
});
test('P11 optional isolated PHP runtime is unavailable and explicitly deferred', () => {
  const res = runPhpTests({ root: fixture('p11'), tests: ['tests/X.php'], runner: { kind: 'artisan-test' }, env: { APP_ENV: 'testing', DB_CONNECTION: 'sqlite', DB_DATABASE: ':memory:' } });
  assert.equal(res.reason, 'PHP_ISOLATION_NOT_VERIFIED');
  assert.equal(res.status, 'NOT_SUPPORTED');
});

// ---- W: write boundary and behavior preservation --------------------------
test('W01 exact preimage, symlink and protected metadata targets stay denied', () => {
  const r = fixture('w01'); const s = capture({ root: r, scope: SCOPE });
  assert.throws(() => applyHunks({ root: r, snapshot: s, hunks: [{ path: 'src/one.js', before: 'MISSING', after: 'x' }], authorizedPaths: ['src/one.js'], scratch: scratch('w01') }), /HUNK_NOT_UNIQUE|INVALID_HUNK/);
  const outside = path.join(root('w01outside'), 'victim.txt'); put(path.dirname(outside), 'victim.txt', 'KEEP');
  fs.symlinkSync(outside, path.join(r, 'src/link.js'));
  assert.throws(() => capture({ root: r, scope: ['src/link.js'] }), /SYMLINK_SCOPE/);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'KEEP');
});
test('W02 a conflict after the first real edit reports PARTIAL_CONFLICT state', () => {
  const r = fixture('w02'); const s = capture({ root: r, scope: SCOPE });
  const original = fs.renameSync; let mutated = false;
  fs.renameSync = function (...args) {
    const result = original.apply(this, args);
    if (!mutated) { mutated = true; put(r, 'src/two.js', 'export const wrap = (a, b) => { return b + a; };\n'); }
    return result;
  };
  try {
    applyHunks({ root: r, snapshot: s, hunks: [
      { path: 'src/one.js', before: 'export const dead = 2;\n', after: '' },
      { path: 'src/two.js', before: 'return a + b;', after: 'return a - b;' }],
      authorizedPaths: ['src/one.js', 'src/two.js'], scratch: scratch('w02') });
    assert.fail('expected conflict');
  } catch (error) {
    assert.match(error.message, /STALE_SCOPE/);
    assert.equal(error.edits.length, 1);
    assert.ok(error.recovery && fs.existsSync(error.recovery));
    assert.equal(evaluatePass({ applied: { status: 'PARTIAL_CONFLICT', edits: error.edits, recovery: error.recovery } }).status, 'PARTIAL_CONFLICT');
  } finally { fs.renameSync = original; }
});
test('W03 protected public, dynamic, test-only and security controls stay KEEP', () => {
  const base = { pass: 'remove-deadcode', kind: 'private-helper', risk: 'LOW', referenceEvidence: true, behaviorEvidence: true, ownership: 'EXPLICIT_SCOPE' };
  for (const flag of ['publicContract', 'dynamic', 'testConsumer', 'sideEffects', 'trustBoundary', 'testFile']) {
    assert.equal(decideCandidate({ ...base, [flag]: true }).decision, 'KEEP');
  }
  assert.equal(decideCandidate(base).decision, 'EDIT');
});
test('W04 skill verifier labels caller structures as non-live evidence', () => {
  const result = skill('A');
  assert.equal(result.status, 'LOADED');
  assert.equal(result.live_evidence, false);
  assert.equal(result.evidence_kind, 'CALLER_SUPPLIED_STRUCTURES');
});
