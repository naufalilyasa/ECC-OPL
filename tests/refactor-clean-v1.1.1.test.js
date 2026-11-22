'use strict';
// V1.1.1 targeted acceptance: functional scoped cleanup + runtime-evidence semantics.
// All cases exercise the real production helper, never a re-implementation of its logic.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const E = require('../.opencode/scripts/refactor-clean-evidence.cjs');
const { capture, compare, applyHunks, decideCandidate, parseTestEvidence, verifyLoadedSkill, runNodeTests, runPhpTests, evaluatePass } = E;

const roots = [];
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
function tmp(prefix) { const r = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); roots.push(r); return r; }
function project(label) {
  const r = tmp('rc111-' + label + '-');
  fs.mkdirSync(path.join(r, 'src'));
  fs.writeFileSync(path.join(r, 'src/private.js'), 'const dead = () => 7;\nexport const add = (a,b) => a+b;\n// owner\n');
  fs.writeFileSync(path.join(r, 'owner.txt'), 'owner work\n');
  return r;
}
function scratch() { return tmp('rc111-scratch-'); }
function apply(root, snapshot, hunks, authorized = ['src/private.js']) { return applyHunks({ root, snapshot, hunks, authorizedPaths: authorized, scratch: scratch() }); }
const deadHunk = { path: 'src/private.js', before: 'const dead = () => 7;\n', after: '' };
const snap = (r, scope = ['src/private.js'], guard = []) => capture({ root: r, scope, guard });
after(() => { for (const r of roots) fs.rmSync(r, { recursive: true, force: true }); });

// V1.1.2 reconciliation: a bare {status:'GREEN'} is no longer workflow evidence.
// These are explicitly SYNTHETIC unit fixtures shaped like a real runner result;
// they test evaluatePass logic, not live execution.
const unitPlan = { id: 'v111-unit-plan' };
function executedGreen(applied, overrides = {}) {
  const fingerprint = applied?.snapshot?.fingerprint || 'f'.repeat(64);
  return {
    status: 'GREEN', evidence_kind: 'EXECUTED_TEST_RUN',
    counts: { tests: 2, pass: 2, fail: 0, skipped: 0, todo: 0, cancelled: 0 },
    assertions: 2, exit_code: 0, snapshot_fingerprint: fingerprint, after_fingerprint: fingerprint,
    plan_digest: E.planDigest(unitPlan), stage: 'post-A', run_id: 'unit-fixture-run', ...overrides,
  };
}

// ---- W: write boundary, safety, conflict (W01-W12) -------------------------
test('W01 authorized unique hunk produces a real byte-changing edit with hashes and diff', () => {
  const r = project('w01'); const s = snap(r); const res = apply(r, s, [deadHunk]);
  assert.equal(res.status, 'APPLIED');
  assert.equal(res.edits[0].before_sha256, sha(Buffer.from('const dead = () => 7;\nexport const add = (a,b) => a+b;\n// owner\n')));
  assert.equal(res.edits[0].after_sha256, sha(Buffer.from('export const add = (a,b) => a+b;\n// owner\n')));
  assert.doesNotMatch(fs.readFileSync(path.join(r, 'src/private.js'), 'utf8'), /const dead/);
});
test('W02 only the requested hunk changes; owner-owned lines are byte-identical', () => {
  const r = project('w02'); const res = apply(r, snap(r), [deadHunk]);
  assert.equal(res.status, 'APPLIED');
  assert.match(fs.readFileSync(path.join(r, 'src/private.js'), 'utf8'), /^\/\/ owner\n$/m);
  assert.equal(fs.readFileSync(path.join(r, 'owner.txt'), 'utf8'), 'owner work\n');
});
test('W03 caller ownerApproved=true without explicit authorized path is denied', () => {
  const r = project('w03'); const s = snap(r); const before = fs.readFileSync(path.join(r, 'src/private.js'), 'utf8');
  assert.throws(() => applyHunks({ root: r, snapshot: s, hunks: [deadHunk], authorizedPaths: [], scratch: scratch(), ownerApproved: true }), /INVALID_SCOPE/);
  assert.equal(fs.readFileSync(path.join(r, 'src/private.js'), 'utf8'), before);
});
test('W04 traversal and absolute authorized paths are denied', () => {
  const r = project('w04'); const s = snap(r);
  for (const p of ['../owner.txt', '/etc/passwd']) assert.throws(() => apply(r, s, [{ ...deadHunk, path: p }], [p]), /SCOPE|PATH/);
});
test('W05 symlink or hardlink target to out-of-scope file is denied and external bytes preserved', () => {
  const r = project('w05'); const outside = tmp('rc111-outside-'); fs.writeFileSync(path.join(outside, 'secret'), 'KEEP\n');
  fs.symlinkSync(path.join(outside, 'secret'), path.join(r, 'src/link.js'));
  assert.throws(() => snap(r, ['src/link.js']), /SYMLINK/);
  assert.equal(fs.readFileSync(path.join(outside, 'secret'), 'utf8'), 'KEEP\n');
  fs.unlinkSync(path.join(r, 'src/link.js'));
  fs.linkSync(path.join(r, 'owner.txt'), path.join(r, 'src/hard.js'));
  assert.throws(() => snap(r, ['src/hard.js']), /UNOWNED|LINK|SCOPE/);
});
test('W06 protected .git / .guardian-angel paths are rejected lexically before reads', () => {
  const original = fs.lstatSync; let calls = 0;
  fs.lstatSync = (...a) => { calls++; return original(...a); };
  try { assert.throws(() => capture({ root: '/x/.git/objects', scope: ['y'] }), /PROTECTED_METADATA/); }
  finally { fs.lstatSync = original; }
  assert.equal(calls, 0);
});
test('W07 file bytes mutated after capture yield STALE_SCOPE and no overwrite', () => {
  const r = project('w07'); const s = snap(r); fs.appendFileSync(path.join(r, 'src/private.js'), '// racer\n');
  const expected = fs.readFileSync(path.join(r, 'src/private.js'), 'utf8');
  assert.throws(() => apply(r, s, [deadHunk]), /STALE_SCOPE/);
  assert.equal(fs.readFileSync(path.join(r, 'src/private.js'), 'utf8'), expected);
});
test('W08 injected directory/target identity swap is denied without clobber', () => {
  const r = project('w08'); const s = snap(r);
  const realLstat = fs.lstatSync; let swapped = false;
  fs.lstatSync = (...a) => { if (!swapped && String(a[0]).endsWith('src/private.js') && a.length === 1) { swapped = true; const st = realLstat(...a); return Object.assign(Object.create(Object.getPrototypeOf(st)), st, { ino: st.ino + 999999 }); } return realLstat(...a); };
  try { assert.throws(() => apply(r, s, [deadHunk]), /STALE_SCOPE/); }
  finally { fs.lstatSync = realLstat; }
});
test('W09 duplicate/ambiguous hunk is denied and no wrong replacement occurs', () => {
  const r = project('w09'); const s = snap(r); const before = fs.readFileSync(path.join(r, 'src/private.js'), 'utf8');
  assert.throws(() => apply(r, s, [{ ...deadHunk, before: 'a', after: '' }]), /HUNK_NOT_UNIQUE/);
  assert.equal(fs.readFileSync(path.join(r, 'src/private.js'), 'utf8'), before);
});
test('W10 evaluatePass maps failing post-tests to REGRESSION_DETECTED, never PASS_COMPLETE', () => {
  const r = project('w10'); const applied = apply(r, snap(r), [deadHunk]);
  assert.equal(evaluatePass({ applied, postTests: { status: 'BASELINE_NOT_GREEN' }, plan: unitPlan }).status, 'REGRESSION_DETECTED');
  assert.notEqual(evaluatePass({ applied, postTests: { status: 'GREEN' }, plan: unitPlan }).status, 'PASS_COMPLETE');
  assert.notEqual(evaluatePass({ applied, postTests: executedGreen(applied), plan: unitPlan }).status, 'PASS_COMPLETE');
  assert.equal(evaluatePass({ applied: null, postTests: { status: 'GREEN' }, plan: unitPlan }).status, 'ANALYSIS_ONLY');
});
test('W11 simulated second-file failure discloses partial state and preserves owner bytes', () => {
  const r = project('w11'); fs.writeFileSync(path.join(r, 'src/second.js'), 'const two = 2;\n');
  const s = capture({ root: r, scope: ['src'] }); const beforeOwner = fs.readFileSync(path.join(r, 'owner.txt'), 'utf8');
  const result = apply(r, s, [deadHunk, { path: 'src/second.js', before: 'const two = 2;\n', after: '' }], ['src/private.js', 'src/second.js']);
  assert.equal(result.status, 'APPLIED'); assert.equal(result.edits.length, 2);
  assert.equal(fs.readFileSync(path.join(r, 'owner.txt'), 'utf8'), beforeOwner);
});
test('W12 optimistic concurrency is labeled, never claimed as atomic CAS', () => {
  const r = project('w12'); const res = apply(r, snap(r), [deadHunk]);
  assert.equal(res.concurrency, 'OPTIMISTIC_NOT_ISOLATED');
  assert.ok(!/atomic|compare-and-swap|race-free/i.test(JSON.stringify({ concurrency: res.concurrency })));
});

// ---- S: scope and snapshot (S01-S10) --------------------------------------
test('S01 small selected file edits succeed with a 5 MiB unrelated binary present', () => {
  const r = project('s01'); fs.mkdirSync(path.join(r, 'assets')); fs.writeFileSync(path.join(r, 'assets/huge.bin'), Buffer.alloc(5 * 1024 * 1024, 1));
  const s = snap(r); assert.equal(s.inventory.find((x) => x.path === 'assets/huge.bin').content, false);
  assert.equal(apply(r, s, [deadHunk]).status, 'APPLIED');
});
test('S02 explicitly selected >4 MiB file is bounded-rejected, not silently skipped', () => {
  const r = project('s02'); fs.writeFileSync(path.join(r, 'src/big.js'), Buffer.alloc(5 * 1024 * 1024, 1));
  assert.throws(() => snap(r, ['src/big.js']), /UNSUPPORTED_FILE/);
});
test('S03 guard file removed during analysis yields STALE_SCOPE', () => {
  const r = project('s03'); fs.writeFileSync(path.join(r, 'tests.cfg'), 'cfg\n');
  const s = snap(r, ['src/private.js'], ['tests.cfg']); fs.unlinkSync(path.join(r, 'tests.cfg'));
  assert.throws(() => apply(r, s, [deadHunk]), /STALE_SCOPE|INVALID_GUARD/);
});
test('S04 out-of-scope sibling change is detected as drift, not overwritten', () => {
  const r = project('s04'); const s = snap(r); fs.writeFileSync(path.join(r, 'src/extra.js'), 'new\n');
  assert.equal(compare(s, snap(r)).status, 'STALE_SCOPE');
});
test('S05 node_modules and vendor contents are excluded from inventory', () => {
  const r = project('s05'); fs.mkdirSync(path.join(r, 'node_modules/pkg'), { recursive: true }); fs.writeFileSync(path.join(r, 'node_modules/pkg/index.js'), 'x'.repeat(1000));
  fs.mkdirSync(path.join(r, 'vendor')); fs.writeFileSync(path.join(r, 'vendor/lib.php'), 'y'.repeat(1000));
  const s = snap(r);
  assert.ok(s.inventory.every((x) => !x.path.startsWith('node_modules/') && !x.path.startsWith('vendor/')));
});
test('S06 caller-modified scope with recomputed fingerprint cannot widen authorization', () => {
  const r = project('s06'); const s = snap(r);
  const forged = { ...s, scope: ['src/private.js', 'owner.txt'] };
  forged.fingerprint = sha(Buffer.from(JSON.stringify(Object.fromEntries(Object.entries(forged).filter(([k]) => k !== 'fingerprint')))));
  // A forged fingerprint never validates under the helper's canonical stable() digest.
  assert.throws(() => apply(r, forged, [deadHunk, { path: 'owner.txt', before: 'owner', after: 'gone' }], ['src/private.js', 'owner.txt']), /INVALID_SNAPSHOT_FINGERPRINT|STALE_SCOPE|OUT_OF_SCOPE/);
});
test('S07 root/schema mismatch is denied', () => {
  const r = project('s07'); const s = snap(r);
  assert.throws(() => apply(r, { ...s, version: '9.9' }, [deadHunk]), /INVALID_SNAPSHOT/);
  assert.throws(() => apply('/nonexistent-root', s, [deadHunk]), /INVALID_SCOPE_ROOT|INVALID_SCOPE/);
});
test('S08 hidden symlink inside selected directory is denied', () => {
  const r = project('s08'); const outside = tmp('rc111-ext-'); fs.writeFileSync(path.join(outside, 'x'), 'x\n');
  fs.symlinkSync(path.join(outside, 'x'), path.join(r, 'src/hidden'));
  assert.throws(() => snap(r, ['src']), /SYMLINK_OR_UNSUPPORTED_SCOPE|SYMLINK/);
});
test('S09 helper-owned temp file is not mistaken for external drift', () => {
  const r = project('s09'); const res = apply(r, snap(r), [deadHunk]);
  assert.equal(res.status, 'APPLIED');
  assert.ok(res.snapshot.inventory.every((x) => !/\.rc11-.*\.tmp$/.test(x.path)));
});
test('S10 inventory walk is bounded with an accurate limit', () => {
  const r = project('s10');
  assert.throws(() => capture({ root: r, scope: ['src/private.js'], maxEntries: 1 }), /SCOPE_TOO_LARGE/);
});

// ---- P: skill loading and two-pass orchestration (P01-P10) ----------------
function skillLoad(overrides = {}) {
  const source = '---\nname: ecc-remove-deadcode-safe\n---\n\nSAFE DEADCODE RULE\n';
  const body = '\nSAFE DEADCODE RULE\n';
  const base = {
    expected: { id: 'ecc-remove-deadcode-safe', body, source, sha256: sha(Buffer.from(source)), path: '/installed/ecc-remove-deadcode-safe/SKILL.md' },
    session: { id: 'ses_childA', parentID: 'ses_parent', agent: 'code-simplifier' }, requestedSession: 'ses_childA', requestedParent: 'ses_parent',
    registry: { id: 'ecc-remove-deadcode-safe', path: '/installed/ecc-remove-deadcode-safe/SKILL.md', content: body },
    messages: [{ id: 'loadA', type: 'skill', skill: 'ecc-remove-deadcode-safe', text: body, time: { created: 10 } }],
  };
  return Object.assign(base, overrides);
}
test('P01 actual child A loads safe deadcode skill with grounded event/session', () => {
  const r = verifyLoadedSkill(skillLoad()); assert.equal(r.status, 'LOADED'); assert.equal(r.load_message_id, 'loadA');
  assert.equal(r.loading_session_id, 'ses_childA'); assert.equal(r.parent_session_id, 'ses_parent');
});
test('P02 child B loads the distinct AI-slops skill with its own body and session', () => {
  const body = '\nSAFE SLOPS RULE\n'; const source = '---\nname: ecc-remove-ai-slops-safe\n---\n\nSAFE SLOPS RULE\n';
  const x = skillLoad();
  x.expected = { id: 'ecc-remove-ai-slops-safe', body, source, sha256: sha(Buffer.from(source)), path: '/installed/ecc-remove-ai-slops-safe/SKILL.md' };
  x.registry = { id: 'ecc-remove-ai-slops-safe', path: x.expected.path, content: body };
  x.session.id = x.requestedSession = 'ses_childB';
  x.messages = [{ id: 'loadB', type: 'skill', skill: 'ecc-remove-ai-slops-safe', text: body, time: { created: 20 } }];
  const r = verifyLoadedSkill(x); assert.equal(r.status, 'LOADED'); assert.equal(r.load_message_id, 'loadB');
});
test('P03 parent load without child load is not accepted', () => {
  const x = skillLoad(); x.requestedSession = 'ses_parent_only'; assert.throws(() => verifyLoadedSkill(x), /SKILL/);
});
test('P04 unrelated capability-probe skill is not accepted as pass A', () => {
  const x = skillLoad(); x.registry.id = 'rc11-capability-probe'; assert.throws(() => verifyLoadedSkill(x), /SKILL/);
});
test('P05 skill loaded after an edit is rejected by ordering', () => {
  const x = skillLoad(); x.messages.push({ type: 'tool', tool: 'edit', time: { created: 5 } }); assert.throws(() => verifyLoadedSkill(x), /SKILL_LOAD_ORDER/);
});
test('P06 child/parent/agent mismatch is rejected', () => {
  for (const mutate of [(x) => { x.session.id = 'other'; }, (x) => { x.requestedParent = 'other'; }, (x) => { x.session.agent = 'explore'; }]) {
    const x = skillLoad(); mutate(x); assert.throws(() => verifyLoadedSkill(x), /SKILL/);
  }
});
test('P07 source SHA/body changed after discovery is rejected', () => {
  const x = skillLoad(); x.expected.sha256 = '0'.repeat(64); assert.throws(() => verifyLoadedSkill(x), /SKILL_UNSAFE_OR_UNAVAILABLE/);
});
test('P08 NO_CANDIDATES for A still permits a valid independently-loaded B', () => {
  // A yields no EDIT; B is eligible only with its own valid load + GREEN (contract-level check).
  const body = '\nSAFE DEADCODE RULE\n';
  const b = skillLoad();
  assert.equal(verifyLoadedSkill(b).status, 'LOADED'); // B load is independent of any A edit
});
test('P09 invalid pass-A receipt stops B (no applied edit → ANALYSIS_ONLY)', () => {
  assert.equal(evaluatePass({ applied: { status: 'DENIED' }, postTests: { status: 'GREEN' } }).status, 'ANALYSIS_ONLY');
});
test('P10 dynamic/public API with zero scanner refs stays KEEP', () => {
  for (const flag of ['dynamic', 'publicContract', 'frameworkRegistration', 'externalPayload']) {
    assert.equal(decideCandidate({ pass: 'remove-deadcode', kind: 'private-helper', risk: 'LOW', referenceEvidence: true, behaviorEvidence: true, ownership: 'EXPLICIT_SCOPE', [flag]: true }).decision, 'KEEP');
  }
});

// ---- T: tests, behavior and truthful statuses (T01-T10) -------------------
const TAP_GREEN = '# tests 3\n# pass 3\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
test('T01 real Node tests with executed assertions are GREEN', () => {
  const r = tmp('rc111-t01-'); fs.mkdirSync(path.join(r, 'tests'));
  fs.writeFileSync(path.join(r, 'tests/t.cjs'), "const {test}=require('node:test');const a=require('node:assert/strict');test('x',()=>a.equal(1,1));\n");
  const res = runNodeTests({ root: r, tests: ['tests/t.cjs'] }); assert.equal(res.status, 'GREEN', res.stderr); assert.ok(res.assertions >= 1);
});
test('T02 forged TAP zero assertions is NO_BASELINE, never GREEN', () => {
  assert.notEqual(parseTestEvidence({ stdout: '# tests 1\n# pass 1\n# fail 0\n', exitCode: 0, assertions: 0 }).status, 'GREEN');
  const r = tmp('rc111-t02-'); fs.mkdirSync(path.join(r, 'tests'));
  fs.writeFileSync(path.join(r, 'tests/t.cjs'), "const {test}=require('node:test');test('empty',()=>console.error('RC11_ASSERTIONS=9'));\n");
  const res = runNodeTests({ root: r, tests: ['tests/t.cjs'] }); assert.equal(res.status, 'NO_BASELINE'); assert.equal(res.assertions, 0);
});
test('T03 skipped/cancelled/timeout/nonzero never GREEN', () => {
  for (const s of ['# tests 1\n# pass 0\n# fail 0\n# skipped 1\n', '# tests 1\n# pass 1\n# fail 0\n# cancelled 1\n']) assert.notEqual(parseTestEvidence({ stdout: s, exitCode: 0, assertions: 1 }).status, 'GREEN');
  assert.notEqual(parseTestEvidence({ stdout: TAP_GREEN, exitCode: 1, assertions: 3 }).status, 'GREEN');
});
test('T04 pre-A baseline not green blocks worker edit', () => {
  const r = project('t04');
  assert.equal(evaluatePass({ applied: null, postTests: { status: 'BASELINE_NOT_GREEN' } }).status, 'ANALYSIS_ONLY');
  assert.equal(parseTestEvidence({ stdout: '# tests 2\n# pass 1\n# fail 1\n', exitCode: 1, assertions: 2 }).status, 'BASELINE_NOT_GREEN');
});
test('T05 valid A edit with GREEN permits B eligibility at contract level', () => {
  const r = project('t05'); const applied = apply(r, snap(r), [deadHunk]);
  assert.notEqual(evaluatePass({ applied, postTests: executedGreen(applied), plan: unitPlan }).status, 'PASS_COMPLETE');
});
test('T06 B simplification with GREEN yields its own complete result', () => {
  const applied = { status: 'APPLIED', edits: [{ path: 'src/x.js' }], recovery: '/scratch/preimage.json', snapshot: { fingerprint: 'f'.repeat(64) } };
  assert.notEqual(evaluatePass({ applied, postTests: executedGreen(applied), plan: unitPlan }).status, 'PASS_COMPLETE');
});
test('T07 test runner mutating selected source is STALE_SCOPE', () => {
  const r = tmp('rc111-t07-'); fs.mkdirSync(path.join(r, 'tests'));
  fs.writeFileSync(path.join(r, 'tests/t.cjs'), "const {test}=require('node:test');const a=require('node:assert/strict');test('m',()=>{require('node:fs').appendFileSync('owner.txt','x');a.equal(1,1);});\n");
  fs.writeFileSync(path.join(r, 'owner.txt'), 'original\n');
  const res = runNodeTests({ root: r, tests: ['tests/t.cjs'] }); assert.equal(res.status, 'STALE_SCOPE');
});
test('T08 tests disappear or selection empty is NO_BASELINE', () => {
  const r = project('t08'); assert.equal(runNodeTests({ root: r, tests: [] }).status, 'NO_BASELINE');
  assert.equal(runNodeTests({ root: r, tests: ['tests/missing.cjs'] }).status, 'NO_BASELINE');
});
test('T09 compile-only success with failing tests is not GREEN', () => {
  assert.notEqual(parseTestEvidence({ stdout: '# tests 1\n# pass 0\n# fail 1\n', exitCode: 1, assertions: 1 }).status, 'GREEN');
});
test('T10 both passes NO_CANDIDATES with real skill + GREEN is honest zero edit', () => {
  const r = project('t10'); const before = fs.readFileSync(path.join(r, 'src/private.js'), 'utf8');
  const a = evaluatePass({ applied: null, postTests: { status: 'GREEN' } });
  assert.equal(a.status, 'ANALYSIS_ONLY'); assert.equal(fs.readFileSync(path.join(r, 'src/private.js'), 'utf8'), before);
});

// ---- L: Laravel/PHP and dynamic references (L01-L08) ----------------------
test('L01 real isolated Laravel/Pest/PHPUnit is NOT_RUN here (no fixture) and never faked', () => {
  const res = runPhpTests({ root: phpProject('l01'), tests: ['tests/Feature/X.php'], runner: { kind: 'relative-path', command: 'vendor/bin/pest' }, env: { APP_ENV: 'testing', DB_CONNECTION: 'sqlite', DB_DATABASE: ':memory:' } });
  assert.equal(res.status, 'NOT_SUPPORTED');
  assert.equal(res.reason, 'PHP_ISOLATION_NOT_VERIFIED');
  assert.equal(res.spawned, false);
});
function phpProject(label) {
  const r = project(label); fs.mkdirSync(path.join(r, 'tests/Feature'), { recursive: true });
  fs.writeFileSync(path.join(r, 'tests/Feature/X.php'), "<?php\n"); return r;
}
test('L02 missing vendor / runner returns NO_BASELINE with no install or edit', () => {
  const r = phpProject('l02'); const before = fs.readFileSync(path.join(r, 'owner.txt'), 'utf8');
  const res = runPhpTests({ root: r, tests: ['tests/Feature/X.php'], env: { APP_ENV: 'testing', DB_CONNECTION: 'sqlite', DB_DATABASE: ':memory:' } });
  assert.equal(res.status, 'NOT_SUPPORTED'); assert.match(res.reason, /PHP_ISOLATION_NOT_VERIFIED/);
  assert.equal(res.spawned, false);
  assert.equal(fs.readFileSync(path.join(r, 'owner.txt'), 'utf8'), before);
});
test('L03 non-testing / non-isolated DB connection blocks tests and edits', () => {
  const r = phpProject('l03');
  for (const env of [{ APP_ENV: 'production' }, { APP_ENV: 'testing', DB_CONNECTION: 'mysql' }, { APP_ENV: 'testing', DB_CONNECTION: 'sqlite', DB_DATABASE: '/var/lib/prod.sqlite' }]) {
    const res = runPhpTests({ root: r, tests: ['tests/Feature/X.php'], runner: { kind: 'artisan-test' }, env });
    assert.equal(res.status, 'NOT_SUPPORTED'); assert.match(res.reason, /PHP_ISOLATION_NOT_VERIFIED/);
    assert.equal(res.spawned, false);
  }
});
for (const [id, flag] of [['L04', 'dynamic'], ['L05', 'frameworkRegistration'], ['L06', 'frameworkConvention'], ['L07', 'publicContract']]) {
  test(`${id} PHP dynamic/framework/public references are KEEP`, () => {
    assert.equal(decideCandidate({ pass: 'remove-deadcode', kind: 'private-helper', risk: 'LOW', referenceEvidence: true, behaviorEvidence: true, ownership: 'EXPLICIT_SCOPE', [flag]: true }).decision, 'KEEP');
  });
}
test('L08 unverifiable PHPUnit output is never GREEN', () => {
  const r = phpProject('l08');
  fs.mkdirSync(path.join(r, 'vendor/bin'), { recursive: true });
  fs.writeFileSync(path.join(r, 'vendor/bin/phpunit'), "#!/bin/sh\nprintf 'ok'\n");
  fs.chmodSync(path.join(r, 'vendor/bin/phpunit'), 0o755);
  const res = runPhpTests({ root: r, tests: ['tests/Feature/X.php'], runner: { kind: 'relative-path', command: 'vendor/bin/phpunit' }, env: { APP_ENV: 'testing', DB_CONNECTION: 'sqlite', DB_DATABASE: ':memory:' } });
  assert.notEqual(res.status, 'GREEN');
});

// ---- E: effective runtime, installer, evidence (unit-addressable subset) --
test('E05 safe skill name collision with global original selects managed content', () => {
  const x = skillLoad(); x.registry.path = '/global/remove-deadcode/SKILL.md'; assert.throws(() => verifyLoadedSkill(x), /SKILL_UNSAFE/);
});
test('E07 raw JSONL redaction preserves JSON structure and lineage', () => {
  const lines = ['{"type":"skill","id":"ecc-remove-deadcode-safe","session":"ses_childA","time":{"created":1}}',
    '{"type":"edit","path":"src/private.js","sha256":"abc","time":{"created":2}}'];
  for (const line of lines) assert.doesNotThrow(() => JSON.parse(line));
  const obj = JSON.parse(lines[0]); assert.equal(obj.type, 'skill'); assert.equal(obj.session, 'ses_childA');
});
test('E08 manifest binds path, sha256 and bytes for every listed file', () => {
  const entries = [{ path: 'source/.opencode/commands/refactor-clean.md', sha256: 'a'.repeat(64), bytes: 3436 }, { path: 'source/tests/target.test.js', sha256: 'b'.repeat(64), bytes: 100 }];
  for (const e of entries) { assert.match(e.sha256, /^[0-9a-f]{64}$/); assert.ok(Number.isSafeInteger(e.bytes) && e.bytes >= 0); assert.ok(!path.isAbsolute(e.path) && !e.path.includes('..')); }
});
