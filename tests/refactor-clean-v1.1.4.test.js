'use strict';
// V1.1.4 targeted closure: immutable verification guards and verified no-op
// completion. All cases run the real helper; model receipts here are explicitly
// synthetic/caller-supplied and never presented as live evidence.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const H = require('../.opencode/scripts/refactor-clean-evidence.cjs');
const { capture, applyHunks, applyModule, runNodeTests, evaluatePass, evaluateNoOp,
  makePlan, normalizePlan, planDigest, verifyLoadedSkill } = H;
const HELP = path.resolve(__dirname, '../.opencode/scripts/refactor-clean-evidence.cjs');
const roots = [];
function root(label) { const r = fs.mkdtempSync(path.join(os.tmpdir(), 'rc114-' + label + '-')); roots.push(r); return r; }
function scratch(label) { const s = fs.mkdtempSync(path.join(os.tmpdir(), 'rc114-scratch-' + label + '-')); roots.push(s); return s; }
function put(r, rel, text) { const f = path.join(r, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); return f; }
function sha(b) { return crypto.createHash('sha256').update(b).digest('hex'); }
after(() => { for (const r of roots) { try { fs.rmSync(r, { recursive: true, force: true }); } catch (_) { /* gone */ } } });

const VALUE_TEST = "'use strict';\nconst {test}=require('node:test');const assert=require('node:assert/strict');\nconst {value}=require('../lib.cjs');\ntest('control',()=>assert.equal(1,1));\ntest('behavior',()=>assert.equal(value,1));\n";
const SERVICE_TEST = "'use strict';\nconst {test}=require('node:test');const assert=require('node:assert/strict');\nconst {compute}=require('../service.cjs');\ntest('compute',()=>assert.equal(compute(2,3),5));\n";
const CONTROLS_TEST = "'use strict';\nconst {test}=require('node:test');const assert=require('node:assert/strict');\nconst {api,check}=require('../controls.cjs');\nconst registry={double:(n)=>n*2};\ntest('public',()=>assert.equal(api(3),6));\ntest('security',()=>assert.equal(check('abcdefgh'),true));\ntest('dynamic',()=>assert.equal(registry.double(4),8));\n";
function fixture(label, { safeSource = true, conditional = false } = {}) {
  const r = root(label);
  put(r, 'lib.cjs', safeSource ? 'exports.value = 1;\n' : 'exports.value = 1;\nconst dead = (x) => x;\n');
  put(r, 'service.cjs', "const {value}=require('./lib.cjs');\nexports.compute = (a, b) => { return a + b + value * 0; };\n");
  put(r, 'controls.cjs', "exports.api=(n)=>n*2;\nexports.check=(t)=>{ if(!t||t.length<8) throw new Error('weak'); return true; };\n");
  put(r, 'tests/value.test.cjs', conditional
    ? "'use strict';\nconst {test}=require('node:test');const assert=require('node:assert/strict');\nconst {value}=require('../lib.cjs');\ntest('control',()=>assert.equal(1,1));\nif (value === 1) test('behavior',()=>assert.equal(value,1));\n"
    : VALUE_TEST);
  put(r, 'tests/service.test.cjs', SERVICE_TEST);
  put(r, 'tests/controls.test.cjs', CONTROLS_TEST);
  put(r, 'owner.txt', 'owner bytes\n');
  put(r, 'big.bin', Buffer.alloc(5 * 1024 * 1024, 7));
  return r;
}
const TESTS = ['tests/controls.test.cjs', 'tests/service.test.cjs', 'tests/value.test.cjs'];
function planFor(r, scope = ['lib.cjs', 'service.cjs']) { return makePlan({ root: r, scope, tests: TESTS }); }
function baseline(r, plan, snap, stage = 'baseline', run_id = 'run-1') {
  return runNodeTests({ root: r, tests: plan.tests, scope: plan.scope, guard: plan.guard, plan,
    expectedFingerprint: snap.fingerprint, stage, run_id });
}
function skillEvidence(pass, child = 'ses_' + pass) {
  const id = pass === 'B' ? 'ecc-remove-ai-slops-safe' : 'ecc-remove-deadcode-safe';
  const source = '---\nname: ' + id + '\n---\n\nSAFE RULE\n'; const body = '\nSAFE RULE\n';
  const expected = { id, source, body, sha256: sha(Buffer.from(source)), path: '/installed/SKILL.md' };
  const evidence = verifyLoadedSkill({ expected,
    session: { id: child, parentID: 'ses_parent', agent: 'code-simplifier' }, requestedSession: child,
    requestedParent: 'ses_parent', registry: { id, path: expected.path, content: body },
    messages: [{ id: 'skill-' + pass, type: 'skill', skill: id, text: body, time: { created: 1 } }] });
  return { evidence: { ...evidence, pass }, expected };
}
function noOpReceipt(pass, run_id, fingerprint, child) {
  return { status: 'NO_CANDIDATES', analysis_complete: true, edits: 0, changed_paths: [],
    pass, stage: 'post-' + pass, run_id, child_session_id: child || ('ses_' + pass),
    skill_id: pass === 'B' ? 'ecc-remove-ai-slops-safe' : 'ecc-remove-deadcode-safe',
    snapshot_fingerprint: fingerprint, candidates: [{ decision: 'KEEP' }] };
}
function invoke(requestObject) {
  const file = path.join(requestObject.scratch, 'request.json'); fs.writeFileSync(file, JSON.stringify(requestObject));
  return spawnSync(process.execPath, [HELP, 'apply-module', file], { encoding: 'utf8' });
}
function applyRequest(r, plan, snap, base, pass, hunks, authorized, priorPass, child) {
  const sk = skillEvidence(pass, child);
  return { root: r, scope: plan.scope, guard: plan.guard, snapshot: snap, plan, baseline: base,
    skillEvidence: sk.evidence, expectedSkill: sk.expected.id, pass, stage: 'apply-' + pass, run_id: 'run-1',
    authorizedPaths: authorized, hunks, scratch: scratch('apply-' + pass), ...(priorPass ? { priorPass } : {}) };
}

// ---- G: immutable verification inputs -------------------------------------
test('G01 exact selected test inside edit scope is rejected with zero edits', () => {
  const r = fixture('g01');
  assert.throws(() => makePlan({ root: r, scope: ['lib.cjs', 'tests/value.test.cjs'], tests: TESTS }), /VERIFICATION_TEST_SCOPE_OVERLAP/);
  assert.equal(fs.readFileSync(path.join(r, 'tests/value.test.cjs'), 'utf8'), VALUE_TEST);
});
test('G02 directory scope containing a selected test is rejected', () => {
  const r = fixture('g02');
  assert.throws(() => makePlan({ root: r, scope: ['.'], tests: TESTS }), /VERIFICATION_TEST_SCOPE_OVERLAP|INVALID_SCOPE_PATH|GUARD_SCOPE_OVERLAP/);
});
test('G03 hand-built plan omitting guard but including test in scope is rejected', () => {
  const r = fixture('g03');
  const plan = { schema: 'v1.3', root: r, scope: ['tests/value.test.cjs'], guard: [],
    tests: TESTS, adapter: 'node', executable: process.execPath,
    args: ['--require', path.join(path.dirname(HELP), 'refactor-clean-assertions.cjs'), '--test', '--test-reporter=tap', '--'],
    cwd: r, profile: 'cooperative-js', timeout: 60000 };
  assert.throws(() => normalizePlan(plan), /VERIFICATION_TEST_SCOPE_OVERLAP|INVALID_VERIFICATION_PLAN/);
});
test('G04 hand-built plan omitting guard for an out-of-scope test is rejected', () => {
  const r = fixture('g04');
  const plan = { schema: 'v1.3', root: r, scope: ['lib.cjs'], guard: [], tests: TESTS, adapter: 'node',
    executable: process.execPath, args: [], cwd: r, profile: 'cooperative-js', timeout: 60000 };
  assert.throws(() => normalizePlan(plan), /INVALID_VERIFICATION_PLAN/);
});
test('G05 alias and linked guard forms are rejected or normalized safely', () => {
  const r = fixture('g05');
  assert.throws(() => makePlan({ root: r, scope: ['lib.cjs'], tests: ['./tests/value.test.cjs'] }), /INVALID_SCOPE_PATH/);
  const outside = path.join(root('g05out'), 'secret.txt'); fs.writeFileSync(outside, 'KEEP');
  fs.symlinkSync(outside, path.join(r, 'tests/linked.test.cjs'));
  assert.throws(() => capture({ root: r, scope: ['lib.cjs'], guard: ['tests/linked.test.cjs'] }), /INVALID_GUARD|SYMLINK/);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'KEEP');
});
test('G06 apply-module batch with source plus guard edit is rejected before first write', () => {
  const r = fixture('g06'); const plan = planFor(r); const snap = capture({ root: r, scope: plan.scope, guard: plan.guard });
  const base = baseline(r, plan, snap);
  const req = applyRequest(r, plan, snap, base, 'A', [
    { path: 'lib.cjs', before: 'exports.value = 1;', after: 'exports.value = 2;' },
    { path: 'tests/value.test.cjs', before: "test('control'", after: "test('disabled'" }],
    ['lib.cjs', 'tests/value.test.cjs']);
  const out = invoke(req);
  assert.notEqual(out.status, 0);
  assert.match(JSON.parse(out.stderr).reason, /GUARD_EDIT_DENIED/);
  assert.match(fs.readFileSync(path.join(r, 'lib.cjs'), 'utf8'), /value = 1/);
  assert.equal(fs.readFileSync(path.join(r, 'tests/value.test.cjs'), 'utf8'), VALUE_TEST);
});
test('G07 hunk against a guard outside scope is rejected in module and file-based CLI', () => {
  const r = fixture('g07'); const plan = planFor(r); const snap = capture({ root: r, scope: plan.scope, guard: plan.guard });
  const base = baseline(r, plan, snap);
  assert.throws(() => applyModule(applyRequest(r, plan, snap, base, 'A',
    [{ path: 'tests/value.test.cjs', before: 'test(', after: 'xtest(' }], ['lib.cjs', 'tests/value.test.cjs'])), /GUARD_EDIT_DENIED/);
  const file = path.join(r, 'request.json');
  fs.writeFileSync(file, JSON.stringify(applyRequest(r, plan, snap, base, 'A',
    [{ path: 'tests/value.test.cjs', before: 'test(', after: 'xtest(' }], ['lib.cjs', 'tests/value.test.cjs'])));
  const out = spawnSync(process.execPath, [HELP, 'apply-module', file], { encoding: 'utf8' });
  assert.notEqual(out.status, 0); assert.match(JSON.parse(out.stderr).reason, /GUARD_EDIT_DENIED/);
});
test('G08 guard change after baseline blocks apply with STALE_SCOPE', () => {
  const r = fixture('g08'); const plan = planFor(r); const snap = capture({ root: r, scope: plan.scope, guard: plan.guard });
  const base = baseline(r, plan, snap);
  fs.writeFileSync(path.join(r, 'tests/value.test.cjs'), VALUE_TEST.replace('assert.equal(value,1)', 'assert.equal(value,9)'));
  assert.throws(() => applyModule(applyRequest(r, plan, snap, base, 'A',
    [{ path: 'lib.cjs', before: 'exports.value = 1;', after: 'exports.value = 2;' }], ['lib.cjs'])), /STALE_SCOPE/);
  assert.match(fs.readFileSync(path.join(r, 'lib.cjs'), 'utf8'), /value = 1/);
});
test('G09 recapture with mutated guards cannot advance the same run', () => {
  const r = fixture('g09'); const plan = planFor(r); const snap = capture({ root: r, scope: plan.scope, guard: plan.guard });
  const base = baseline(r, plan, snap);
  fs.writeFileSync(path.join(r, 'tests/value.test.cjs'), VALUE_TEST.replace('assert.equal(value,1)', 'assert.equal(value,9)'));
  const fresh = capture({ root: r, scope: plan.scope, guard: plan.guard });
  assert.notEqual(fresh.fingerprint, snap.fingerprint);
  assert.throws(() => applyModule(applyRequest(r, plan, fresh, base, 'A',
    [{ path: 'lib.cjs', before: 'exports.value = 1;', after: 'exports.value = 2;' }], ['lib.cjs'])), /BASELINE_NOT_GREEN|STALE_SCOPE/);
});
test('G10 same-size guard change during a real test run is not GREEN', () => {
  const r = fixture('g10');
  put(r, 'tests/value.test.cjs', "'use strict';\nconst fs=require('node:fs');const {test}=require('node:test');const assert=require('node:assert/strict');\ntest('guard writer',()=>{const p='tests/service.test.cjs';const before=fs.readFileSync(p,'utf8');fs.writeFileSync(p,before.replace('compute','Compute'));assert.equal(1,1);});\n");
  const plan = planFor(r); const snap = capture({ root: r, scope: plan.scope, guard: plan.guard });
  const run = baseline(r, plan, snap);
  assert.equal(run.status, 'STALE_SCOPE');
});
test('G11 fewer executed tests/assertions with unchanged roster cannot complete', () => {
  const r = fixture('g11', { conditional: true }); const plan = planFor(r); const snap = capture({ root: r, scope: plan.scope, guard: plan.guard });
  const base = baseline(r, plan, snap);
  const applied = applyModule(applyRequest(r, plan, snap, base, 'A',
    [{ path: 'lib.cjs', before: 'exports.value = 1;', after: 'exports.value = 1; // A' }], ['lib.cjs']));
  const post = runNodeTests({ root: r, tests: plan.tests, scope: plan.scope, guard: plan.guard, plan,
    expectedFingerprint: applied.snapshot.fingerprint, stage: 'post-A', run_id: 'run-1' });
  assert.equal(post.status, 'GREEN'); assert.equal(post.counts.tests, base.counts.tests);
  assert.equal(evaluatePass({ applied, postTests: post, plan, stage: 'post-A', run_id: 'run-1' }).status, 'PASS_COMPLETE');
  // Independent reduced-count run: same roster/plan but baseline counts differ.
  const r2 = fixture('g11b', { conditional: true }); put(r2, 'lib.cjs', 'exports.value = 2;\n');
  const plan2 = planFor(r2); const snap2 = capture({ root: r2, scope: plan2.scope, guard: plan2.guard });
  const reduced = baseline(r2, plan2, snap2);
  assert.ok(reduced.counts.tests < base.counts.tests);
  assert.notEqual(evaluatePass({ applied: { ...applied, snapshot: { fingerprint: reduced.after_fingerprint } }, postTests: reduced, plan: plan2, stage: 'post-A', run_id: 'run-1' }).status, 'PASS_COMPLETE');
});
test('G12 valid source-only plan still performs a real edit with unchanged test bytes', () => {
  const r = fixture('g12'); const before = fs.readFileSync(path.join(r, 'tests/value.test.cjs'), 'utf8');
  const plan = planFor(r); const snap = capture({ root: r, scope: plan.scope, guard: plan.guard });
  const base = baseline(r, plan, snap);
  const applied = applyModule(applyRequest(r, plan, snap, base, 'A',
    [{ path: 'lib.cjs', before: 'exports.value = 1;', after: 'exports.value = 1; // A' }], ['lib.cjs']));
  assert.equal(applied.status, 'APPLIED');
  const post = runNodeTests({ root: r, tests: plan.tests, scope: plan.scope, guard: plan.guard, plan,
    expectedFingerprint: applied.snapshot.fingerprint, stage: 'post-A', run_id: 'run-1' });
  assert.equal(post.status, 'GREEN');
  assert.equal(evaluatePass({ applied, postTests: post, plan, stage: 'post-A', run_id: 'run-1' }).status, 'PASS_COMPLETE');
  assert.equal(fs.readFileSync(path.join(r, 'tests/value.test.cjs'), 'utf8'), before);
});

// ---- N: verified no-op completion -----------------------------------------
function noOpSetup(label, safeSource = true) {
  const r = fixture(label, { safeSource });
  const plan = planFor(r); const snap = capture({ root: r, scope: plan.scope, guard: plan.guard });
  const base = baseline(r, plan, snap);
  const post = runNodeTests({ root: r, tests: plan.tests, scope: plan.scope, guard: plan.guard, plan,
    expectedFingerprint: snap.fingerprint, stage: 'post-A', run_id: 'run-1' });
  return { r, plan, snap, base, post };
}
test('N01 verified A no-op yields PASS_COMPLETE with completion_kind NO_CANDIDATES', () => {
  const s = noOpSetup('n01');
  const result = evaluateNoOp({ receipt: noOpReceipt('A', 'run-1', s.snap.fingerprint), baseline: s.base,
    postTests: s.post, plan: s.plan, stage: 'post-A', run_id: 'run-1', expectedSnapshot: s.snap });
  assert.equal(result.status, 'PASS_COMPLETE'); assert.equal(result.completion_kind, 'NO_CANDIDATES'); assert.equal(result.edits, 0);
});
test('N02 verified A no-op authorizes a real B edit', () => {
  const s = noOpSetup('n02');
  const a = evaluateNoOp({ receipt: noOpReceipt('A', 'run-1', s.snap.fingerprint), baseline: s.base,
    postTests: s.post, plan: s.plan, stage: 'post-A', run_id: 'run-1', expectedSnapshot: s.snap });
  const b = applyModule(applyRequest(s.r, s.plan, s.snap, s.post, 'B',
    [{ path: 'service.cjs', before: 'exports.compute = (a, b) => { return a + b + value * 0; };', after: 'exports.compute = (a, b) => a + b;' }],
    ['service.cjs'], a));
  assert.equal(b.status, 'APPLIED');
  const postB = runNodeTests({ root: s.r, tests: s.plan.tests, scope: s.plan.scope, guard: s.plan.guard, plan: s.plan,
    expectedFingerprint: b.snapshot.fingerprint, stage: 'post-B', run_id: 'run-1' });
  assert.equal(evaluatePass({ applied: b, postTests: postB, plan: s.plan, stage: 'post-B', run_id: 'run-1' }).status, 'PASS_COMPLETE');
});
test('N03 A edited then B verified no-op completes without a fabricated B edit', () => {
  const s = noOpSetup('n03');
  // A real byte change: a comment-equivalent but distinct source line.
  const a2 = applyModule(applyRequest(s.r, s.plan, s.snap, s.base, 'A',
    [{ path: 'lib.cjs', before: 'exports.value = 1;', after: 'exports.value = 1; // retained' }], ['lib.cjs']));
  assert.equal(a2.status, 'APPLIED');
  const postA = runNodeTests({ root: s.r, tests: s.plan.tests, scope: s.plan.scope, guard: s.plan.guard, plan: s.plan,
    expectedFingerprint: a2.snapshot.fingerprint, stage: 'post-A', run_id: 'run-1' });
  const evalA = evaluatePass({ applied: a2, postTests: postA, plan: s.plan, stage: 'post-A', run_id: 'run-1' });
  const postB = runNodeTests({ root: s.r, tests: s.plan.tests, scope: s.plan.scope, guard: s.plan.guard, plan: s.plan,
    expectedFingerprint: a2.snapshot.fingerprint, stage: 'post-B', run_id: 'run-1' });
  const result = evaluateNoOp({ receipt: noOpReceipt('B', 'run-1', a2.snapshot.fingerprint, 'ses_B'),
    baseline: postA, postTests: postB, plan: s.plan, stage: 'post-B', run_id: 'run-1',
    expectedSnapshot: a2.snapshot, priorPass: evalA });
  assert.equal(result.status, 'PASS_COMPLETE'); assert.equal(result.edits, 0);
  assert.match(fs.readFileSync(path.join(s.r, 'service.cjs'), 'utf8'), /return a \+ b \+ value/);
});
test('N04 both passes verified no-op with distinct children and four GREEN stages', () => {
  const s = noOpSetup('n04');
  const a = evaluateNoOp({ receipt: noOpReceipt('A', 'run-1', s.snap.fingerprint, 'ses_A'), baseline: s.base,
    postTests: s.post, plan: s.plan, stage: 'post-A', run_id: 'run-1', expectedSnapshot: s.snap });
  const postB = runNodeTests({ root: s.r, tests: s.plan.tests, scope: s.plan.scope, guard: s.plan.guard, plan: s.plan,
    expectedFingerprint: s.snap.fingerprint, stage: 'post-B', run_id: 'run-1' });
  const b = evaluateNoOp({ receipt: noOpReceipt('B', 'run-1', s.snap.fingerprint, 'ses_B'), baseline: s.post,
    postTests: postB, plan: s.plan, stage: 'post-B', run_id: 'run-1', expectedSnapshot: s.snap, priorPass: a });
  assert.equal(a.status, 'PASS_COMPLETE'); assert.equal(b.status, 'PASS_COMPLETE');
  assert.notEqual(a.child_session_id, b.child_session_id); assert.equal(a.edits + b.edits, 0);
});
test('N05 missing skill or interrupted analysis never becomes a verified no-op', () => {
  const s = noOpSetup('n05');
  const receipt = noOpReceipt('A', 'run-1', s.snap.fingerprint);
  for (const bad of [{ ...receipt, analysis_complete: false }, { ...receipt, skill_id: 'wrong' }, { ...receipt, status: 'INTERRUPTED' }]) {
    assert.equal(evaluateNoOp({ receipt: bad, baseline: s.base, postTests: s.post, plan: s.plan,
      stage: 'post-A', run_id: 'run-1', expectedSnapshot: s.snap }).status, 'ANALYSIS_ONLY');
  }
});
test('N06 wrong pass/run/plan or reused child cannot complete a no-op', () => {
  const s = noOpSetup('n06'); const receipt = noOpReceipt('A', 'run-1', s.snap.fingerprint);
  for (const bad of [{ ...receipt, pass: 'B' }, { ...receipt, run_id: 'other' }, { ...receipt, plan_digest: 'wrong' }]) {
    assert.equal(evaluateNoOp({ receipt: bad, baseline: s.base, postTests: s.post, plan: s.plan,
      stage: 'post-A', run_id: 'run-1', expectedSnapshot: s.snap }).status, 'ANALYSIS_ONLY');
  }
  const a = evaluateNoOp({ receipt, baseline: s.base, postTests: s.post, plan: s.plan,
    stage: 'post-A', run_id: 'run-1', expectedSnapshot: s.snap });
  const postB = runNodeTests({ root: s.r, tests: s.plan.tests, scope: s.plan.scope, guard: s.plan.guard, plan: s.plan,
    expectedFingerprint: s.snap.fingerprint, stage: 'post-B', run_id: 'run-1' });
  assert.equal(evaluateNoOp({ receipt: noOpReceipt('B', 'run-1', s.snap.fingerprint, 'ses_A'), baseline: s.post,
    postTests: postB, plan: s.plan, stage: 'post-B', run_id: 'run-1', expectedSnapshot: s.snap, priorPass: a }).status, 'ANALYSIS_ONLY');
});
test('N07 a no-op receipt claiming edits or hunks is rejected', () => {
  const s = noOpSetup('n07'); const receipt = noOpReceipt('A', 'run-1', s.snap.fingerprint);
  for (const bad of [{ ...receipt, edits: 1 }, { ...receipt, changed_paths: ['lib.cjs'] },
    { ...receipt, candidates: [{ decision: 'EDIT' }] }, { ...receipt, hunks: [{ path: 'lib.cjs' }] }]) {
    assert.equal(evaluateNoOp({ receipt: bad, baseline: s.base, postTests: s.post, plan: s.plan,
      stage: 'post-A', run_id: 'run-1', expectedSnapshot: s.snap }).status, 'ANALYSIS_ONLY');
  }
});
test('N08 snapshot, guard or inventory drift during a no-op blocks completion', () => {
  const s = noOpSetup('n08'); const receipt = noOpReceipt('A', 'run-1', s.snap.fingerprint);
  assert.equal(evaluateNoOp({ receipt: { ...receipt, snapshot_fingerprint: '0'.repeat(64) }, baseline: s.base,
    postTests: s.post, plan: s.plan, stage: 'post-A', run_id: 'run-1', expectedSnapshot: s.snap }).status, 'ANALYSIS_ONLY');
  assert.equal(evaluateNoOp({ receipt, baseline: s.base, postTests: { ...s.post, after_guard_digests: [] },
    plan: s.plan, stage: 'post-A', run_id: 'run-1', expectedSnapshot: s.snap }).status, 'ANALYSIS_ONLY');
});
test('N09 bare, diagnostic, baseline-reused or wrong-stage evidence is rejected', () => {
  const s = noOpSetup('n09'); const receipt = noOpReceipt('A', 'run-1', s.snap.fingerprint);
  for (const post of [{ status: 'GREEN' }, { ...s.base, stage: 'baseline' }, { ...s.post, diagnostic: true }]) {
    assert.equal(evaluateNoOp({ receipt, baseline: s.base, postTests: post, plan: s.plan,
      stage: 'post-A', run_id: 'run-1', expectedSnapshot: s.snap }).status, 'ANALYSIS_ONLY');
  }
});
test('N10 a failing post-no-op test or changed roster blocks advancement', () => {
  const s = noOpSetup('n10'); const receipt = noOpReceipt('A', 'run-1', s.snap.fingerprint);
  assert.equal(evaluateNoOp({ receipt, baseline: s.base, postTests: { ...s.post, status: 'BASELINE_NOT_GREEN' },
    plan: s.plan, stage: 'post-A', run_id: 'run-1', expectedSnapshot: s.snap }).status, 'ANALYSIS_ONLY');
  assert.equal(evaluateNoOp({ receipt, baseline: s.base, postTests: { ...s.post, roster_executed: [TESTS[0]] },
    plan: s.plan, stage: 'post-A', run_id: 'run-1', expectedSnapshot: s.snap }).status, 'ANALYSIS_ONLY');
});
test('N11 missing or contradictory prior completion blocks B apply and no-op', () => {
  const s = noOpSetup('n11');
  const bRequest = applyRequest(s.r, s.plan, s.snap, s.post, 'B',
    [{ path: 'service.cjs', before: 'exports.compute = (a, b) => { return a + b + value * 0; };', after: 'exports.compute = (a, b) => a + b;' }],
    ['service.cjs'], null);
  assert.throws(() => applyModule(bRequest), /PRIOR_PASS_NOT_VERIFIED/);
  const bogus = { status: 'PASS_COMPLETE', completion_kind: 'NO_CANDIDATES', stage: 'post-A', run_id: 'run-1',
    plan_digest: planDigest(s.plan), snapshot_fingerprint: s.snap.fingerprint, child_session_id: 'ses_A',
    guard_digests: s.post.guard_digests };
  assert.throws(() => applyModule({ ...bRequest, priorPass: bogus }), /PRIOR_PASS_NOT_VERIFIED/);
  const postB = runNodeTests({ root: s.r, tests: s.plan.tests, scope: s.plan.scope, guard: s.plan.guard, plan: s.plan,
    expectedFingerprint: s.snap.fingerprint, stage: 'post-B', run_id: 'run-1' });
  assert.equal(evaluateNoOp({ receipt: noOpReceipt('B', 'run-1', s.snap.fingerprint, 'ses_B'), baseline: s.post,
    postTests: postB, plan: s.plan, stage: 'post-B', run_id: 'run-1', expectedSnapshot: s.snap, priorPass: bogus }).status, 'ANALYSIS_ONLY');
});

// ---- R01: deterministic replay of the accepted edited -> edited path ------
test('R01 edited A then edited B replay preserves all guards and completes both passes', () => {
  const s = noOpSetup('r01');
  const a = applyModule(applyRequest(s.r, s.plan, s.snap, s.base, 'A',
    [{ path: 'lib.cjs', before: 'exports.value = 1;', after: 'exports.value = 1; // A' }], ['lib.cjs']));
  const postA = runNodeTests({ root: s.r, tests: s.plan.tests, scope: s.plan.scope, guard: s.plan.guard, plan: s.plan,
    expectedFingerprint: a.snapshot.fingerprint, stage: 'post-A', run_id: 'run-1' });
  const evalA = evaluatePass({ applied: a, postTests: postA, plan: s.plan, stage: 'post-A', run_id: 'run-1' });
  const b = applyModule(applyRequest(s.r, s.plan, a.snapshot, postA, 'B',
    [{ path: 'service.cjs', before: 'exports.compute = (a, b) => { return a + b + value * 0; };', after: 'exports.compute = (a, b) => a + b;' }],
    ['service.cjs'], evalA));
  const postB = runNodeTests({ root: s.r, tests: s.plan.tests, scope: s.plan.scope, guard: s.plan.guard, plan: s.plan,
    expectedFingerprint: b.snapshot.fingerprint, stage: 'post-B', run_id: 'run-1' });
  const evalB = evaluatePass({ applied: b, postTests: postB, plan: s.plan, stage: 'post-B', run_id: 'run-1' });
  assert.equal(evalA.status, 'PASS_COMPLETE'); assert.equal(evalB.status, 'PASS_COMPLETE');
  assert.equal(evalB.completion_kind, 'EDITED');
  assert.equal(fs.readFileSync(path.join(s.r, 'tests/value.test.cjs'), 'utf8'), VALUE_TEST);
  assert.equal(fs.readFileSync(path.join(s.r, 'owner.txt'), 'utf8'), 'owner bytes\n');
});
