'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const evidence = require('../.opencode/scripts/refactor-clean-evidence.cjs');
const { capture, compare, decideCandidate, parseTestEvidence, verifyLoadedSkill, runNodeTests } = evidence;
function applyHunks(request) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'rc11-scratch-')); roots.push(scratch);
  return evidence.applyHunks({ ...request, scratch });
}

const roots = [];
const hash = (x) => crypto.createHash('sha256').update(x).digest('hex');
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rc11-unit-'));
  roots.push(root);
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src/calc.ts'), 'const unusedPrivate = () => 7;\nexport const add = (a: number, b: number) => a + b;\n// owner hunk\n');
  fs.writeFileSync(path.join(root, 'owner.txt'), 'owner work\n');
  return root;
}
function bytes(root, rel = 'src/calc.ts') { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function scope(root) { return capture({ root, scope: ['src/calc.ts'] }); }
const hunk = { path: 'src/calc.ts', before: 'const unusedPrivate = () => 7;\n', after: '' };
after(() => { for (const r of roots) fs.rmSync(r, { recursive: true, force: true }); });

test('RC11-G02 filesystem scope works without Git and reports unknown index provenance', () => {
  const r = fixture(); const s = scope(r);
  assert.equal(s.git_mode, 'NOT_INSPECTED'); assert.equal(s.index_provenance, 'UNKNOWN');
  assert.equal(compare(s, scope(r)).status, 'MATCH');
});
const ORIGINAL = 'const unusedPrivate = () => 7;\nexport const add = (a: number, b: number) => a + b;\n// owner hunk\n';
test('RC11-G08 authorized scoped edit changes only the unique hunk, owner bytes preserved', () => {
  const r = fixture(); const s = scope(r);
  const result = applyHunks({ root: r, snapshot: s, hunks: [hunk], authorizedPaths: ['src/calc.ts'] });
  assert.equal(result.status, 'APPLIED'); assert.equal(result.edits.length, 1);
  assert.equal(bytes(r), 'export const add = (a: number, b: number) => a + b;\n// owner hunk\n');
  assert.equal(bytes(r, 'owner.txt'), 'owner work\n');
});
test('RC11-G09 stale source blocks write and preserves concurrent owner bytes', () => {
  const r = fixture(); const s = scope(r); fs.appendFileSync(path.join(r, 'src/calc.ts'), '// concurrent\n');
  const expected = bytes(r);
  assert.throws(() => applyHunks({ root: r, snapshot: s, hunks: [hunk], authorizedPaths: ['src/calc.ts'] }), /STALE_SCOPE/);
  assert.equal(bytes(r), expected);
});
test('RC11-G10 stale output blocks write and preserves later owner bytes', () => {
  const r = fixture(); const s = scope(r);
  fs.appendFileSync(path.join(r, 'src/calc.ts'), '// later owner\n'); const expected = bytes(r);
  assert.throws(() => applyHunks({ root: r, snapshot: s, hunks: [hunk], authorizedPaths: ['src/calc.ts'] }), /STALE_SCOPE/);
  assert.equal(bytes(r), expected);
});
test('RC11-G11 external symlink is rejected and external bytes preserved', () => {
  const r = fixture(); const outside = fixture(); const target = path.join(outside, 'owner.txt');
  fs.symlinkSync(target, path.join(r, 'src/link.ts'));
  assert.throws(() => capture({ root: r, scope: ['src/link.ts'] }), /SYMLINK/);
  assert.equal(fs.readFileSync(target, 'utf8'), 'owner work\n');
});
test('RC11-G12 traversal and absolute external paths are rejected', () => {
  const r = fixture(); for (const p of ['../owner.txt', 'src/../../owner.txt', '/etc/passwd']) {
    assert.throws(() => capture({ root: r, scope: [p] }), /SCOPE|PATH|EXCLUDED/);
  }
  assert.equal(bytes(r, 'owner.txt'), 'owner work\n');
});
test('RC11-G13 outside-scope new file is preserved and scope drift detected', () => {
  const r = fixture(); const s = scope(r); fs.writeFileSync(path.join(r, 'new-owner.txt'), 'new owner\n');
  assert.equal(compare(s, scope(r)).status, 'STALE_SCOPE');
  assert.throws(() => applyHunks({ root: r, snapshot: s, hunks: [hunk], authorizedPaths: ['src/calc.ts'] }), /STALE_SCOPE/);
  assert.equal(bytes(r, 'new-owner.txt'), 'new owner\n'); assert.match(bytes(r), /unusedPrivate/);
});
test('scoped edits reject out-of-scope and non-unique hunks without touching bytes', () => {
  const r = fixture(); const s = scope(r);
  assert.throws(() => applyHunks({ root: r, snapshot: s, hunks: [{ path: 'owner.txt', before: 'owner', after: 'lost' }], authorizedPaths: ['src/calc.ts'] }), /OUT_OF_SCOPE/);
  assert.throws(() => applyHunks({ root: r, snapshot: s, hunks: [{ ...hunk, before: 'a', after: '' }], authorizedPaths: ['src/calc.ts'] }), /HUNK_NOT_UNIQUE/);
  assert.equal(bytes(r, 'owner.txt'), 'owner work\n'); assert.equal(bytes(r), ORIGINAL);
});
test('snapshot binds mode, file identity and tamper-resistant fingerprint', () => {
  const r = fixture(); const s = scope(r); fs.chmodSync(path.join(r, 'src/calc.ts'), 0o755);
  assert.equal(compare(s, scope(r)).status, 'STALE_SCOPE');
  assert.throws(() => applyHunks({ root: r, snapshot: { ...s, fingerprint: '0'.repeat(64) }, hunks: [hunk], authorizedPaths: ['src/calc.ts'] }), /INVALID_SNAPSHOT_FINGERPRINT/);
});

const eligible = { path: 'src/calc.ts', pass: 'remove-deadcode', kind: 'private-helper', risk: 'LOW', referenceEvidence: true, behaviorEvidence: true, sideEffects: false, ownership: 'EXPLICIT_SCOPE' };
test('RC11-G07 unknown/dirty ownership is deferred absent explicit authorization', () => {
  for (const ownership of ['DIRTY', 'UNKNOWN', undefined]) assert.equal(decideCandidate({ ...eligible, ownership }).decision, 'DEFER');
});
test('RC11-C01 unused private TS helper eligible only with reference and behavior proof', () => {
  assert.equal(decideCandidate(eligible).decision, 'EDIT');
  assert.equal(decideCandidate({ ...eligible, referenceEvidence: false }).decision, 'DEFER');
  assert.equal(decideCandidate({ ...eligible, behaviorEvidence: false }).decision, 'DEFER');
});
for (const [id, flag] of [['C02', 'dynamic'], ['C03', 'publicContract'], ['C04', 'testConsumer'], ['C05', 'sideEffects'], ['C06', 'differentErrors'], ['C07', 'trustBoundary'], ['C08', 'tautologicalTest'], ['C09', 'frameworkConvention'], ['C10', 'frameworkRegistration'], ['C11', 'externalPayload'], ['C12', 'migrationOrRelation']]) {
  test(`RC11-${id} keep ${flag} even when a scanner claims unused`, () => {
    assert.equal(decideCandidate({ ...eligible, [flag]: true }).decision, 'KEEP');
  });
}
test('candidate deletion and unknown transformations do not become EDIT', () => {
  for (const kind of ['delete-file', 'dependency', 'public-export', 'unknown']) assert.notEqual(decideCandidate({ ...eligible, kind }).decision, 'EDIT');
});

test('RC11-B01 TAP baseline requires actual passed cases and observed assertions', () => {
  const log = '# tests 2\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
  assert.equal(parseTestEvidence({ stdout: log, exitCode: 0, assertions: 3 }).status, 'GREEN');
});
test('RC11-B03 failed baseline is never GREEN', () => {
  assert.equal(parseTestEvidence({ stdout: '# tests 2\n# pass 1\n# fail 1\n', exitCode: 1, assertions: 2 }).status, 'BASELINE_NOT_GREEN');
});
test('RC11-B04 exit zero with no assertions, no tests or skipped selection is not GREEN', () => {
  for (const e of [
    { stdout: '', assertions: 0 },
    { stdout: '# tests 1\n# pass 1\n# fail 0\n# skipped 0\n', assertions: 0 },
    { stdout: '# tests 1\n# pass 0\n# fail 0\n# skipped 1\n', assertions: 1 },
    { stdout: '# tests 0\n# pass 0\n# fail 0\n# skipped 0\n', assertions: 1 },
  ]) assert.notEqual(parseTestEvidence({ ...e, exitCode: 0 }).status, 'GREEN');
});
test('contradictory/duplicate test summary and hidden cancellation do not pass', () => {
  for (const text of ['# tests 2\n# pass 1\n# fail 0\n# skipped 0\n', '# tests 1\n# pass 1\n# fail 0\n# cancelled 1\n', '# tests 1\n# pass 1\n# fail 0\n# pass 2\n']) assert.notEqual(parseTestEvidence({ stdout: text, exitCode: 0, assertions: 1 }).status, 'GREEN');
});

function nativeLoad({ child = 'ses_child1', loaded = 'ses_child1', body = '\nSAFE RULE\n', id = 'ecc-remove-deadcode', parent = 'ses_parent1' } = {}) {
  const source = '---\nname: ecc-remove-deadcode\n---\n\nSAFE RULE\n';
  return { expected: { id: 'ecc-remove-deadcode', body: '\nSAFE RULE\n', source, sha256: hash(source), path: '/installed/skills/ecc-remove-deadcode/SKILL.md' },
    session: { id: child, parentID: parent, agent: 'code-simplifier' }, requestedSession: loaded, requestedParent: 'ses_parent1',
    registry: { id, content: '\nSAFE RULE\n', path: '/installed/skills/ecc-remove-deadcode/SKILL.md' },
    messages: [{ id: 'msg_load', type: 'skill', skill: id, text: body, time: { created: 1 } }] };
}
test('native child skill body binds selected ID/path/session rather than caller receipt', () => {
  const result = verifyLoadedSkill(nativeLoad()); assert.equal(result.status, 'LOADED'); assert.equal(result.load_message_id, 'msg_load');
});
test('RC11-A05 unexpected collision body/path is blocked', () => {
  const x = nativeLoad(); x.registry.path = '/unsafe/global/SKILL.md';
  assert.throws(() => verifyLoadedSkill(x), /SKILL_UNSAFE_OR_UNAVAILABLE/);
});
test('RC11-A06 missing skill has no edit eligibility', () => {
  const x = nativeLoad(); x.registry = null;
  assert.throws(() => verifyLoadedSkill(x), /SKILL_UNSAFE_OR_UNAVAILABLE/);
});
test('RC11-A07 unrelated session load is not actual child proof', () => {
  assert.throws(() => verifyLoadedSkill(nativeLoad({ loaded: 'ses_unrelated' })), /SKILL_NOT_LOADED/);
});
test('wrong agent, missing parent and absent raw load never establish child load', () => {
  for (const change of [(x) => { x.session.agent = 'build'; }, (x) => { delete x.session.parentID; }, (x) => { x.messages = []; }, (x) => { x.messages = [{ loaded_before_edit: true }]; }]) {
    const x = nativeLoad(); change(x); assert.throws(() => verifyLoadedSkill(x), /SKILL_NOT_LOADED/);
  }
});
test('RC11-A08 wrong body is rejected even with correct child and skill name', () => {
  assert.throws(() => verifyLoadedSkill(nativeLoad({ body: 'unsafe instructions' })), /SKILL_NOT_LOADED/);
});
test('RC11-A09 slop pass cannot borrow deadcode loading evidence', () => {
  const x = nativeLoad(); x.expected.id = 'ecc-remove-ai-slops'; assert.throws(() => verifyLoadedSkill(x), /SKILL/);
});

test('skill load after an edit or under another parent is not accepted', () => {
  const late = nativeLoad(); late.messages.push({ type: 'tool', tool: 'edit', time: { created: 0 } });
  assert.throws(() => verifyLoadedSkill(late), /SKILL_LOAD_ORDER/);
  const wrong = nativeLoad(); wrong.requestedParent = 'ses_other';
  assert.throws(() => verifyLoadedSkill(wrong), /SKILL_NOT_LOADED_CHILD/);
});
test('skill source bytes, SHA and body must agree independently', () => {
  const x = nativeLoad(); x.expected.sha256 = '0'.repeat(64);
  assert.throws(() => verifyLoadedSkill(x), /SKILL_UNSAFE_OR_UNAVAILABLE/);
});
function runnerFixture(source) {
  const r = fixture(); fs.mkdirSync(path.join(r, 'tests'));
  fs.writeFileSync(path.join(r, 'tests/behavior.cjs'), source); return r;
}
test('RC11-B04 runner rejects a zero-assertion test printing a forged marker', () => {
  const r = runnerFixture("const {test}=require('node:test'); test('empty',()=>{console.error('RC11_ASSERTIONS=9');});\n");
  const result = runNodeTests({ root: r, tests: ['tests/behavior.cjs'] });
  assert.equal(result.status, 'NO_BASELINE'); assert.equal(result.assertions, 0);
  assert.match(bytes(r), /unusedPrivate/); assert.equal(bytes(r, 'owner.txt'), 'owner work\n');
});
test('RC11-B01 actual Node runner observes executed strict assertions', () => {
  const r = runnerFixture("const {test}=require('node:test'); const a=require('node:assert/strict'); test('behavior',()=>a.equal(2+3,5));\n");
  const result = runNodeTests({ root: r, tests: ['tests/behavior.cjs'] });
  assert.equal(result.status, 'GREEN', result.stderr); assert.ok(result.assertions >= 1);
  assert.equal(result.counts.pass, 1); assert.ok(result.started_at); assert.equal(result.exit_code, 0);
});
test('RC11-B02 missing test is NO_BASELINE without source edits', () => {
  const r = fixture(); const before = bytes(r);
  assert.equal(runNodeTests({ root: r, tests: ['missing.cjs'] }).status, 'NO_BASELINE');
  assert.equal(bytes(r), before);
});
test('RC11-B05 runner detects unexpected source mutation and does not restore it', () => {
  const r = runnerFixture("const {test}=require('node:test'); const a=require('node:assert/strict'); test('mutates',()=>{require('node:fs').appendFileSync('owner.txt','new owner\\n');a.equal(1,1);});\n");
  const result = runNodeTests({ root: r, tests: ['tests/behavior.cjs'] });
  assert.equal(result.status, 'STALE_SCOPE'); assert.equal(bytes(r, 'owner.txt'), 'owner work\nnew owner\n');
});
test('injected I/O failure during staging leaves target unchanged with recovery evidence', () => {
  const r = fixture(); const snapshot = scope(r); const before = bytes(r);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'rc11-recovery-')); roots.push(scratch);
  const original = fs.writeSync;
  fs.writeSync = (fd, buffer, ...args) => { if (Buffer.isBuffer(buffer) && buffer.toString().startsWith('export const add')) throw Object.assign(new Error('injected I/O'), { code: 'EIO' }); return original(fd, buffer, ...args); };
  let thrown;
  try { evidence.applyHunks({ root: r, snapshot, hunks: [hunk], authorizedPaths: ['src/calc.ts'], scratch }); } catch (error) { thrown = error; }
  finally { fs.writeSync = original; }
  assert.equal(thrown.message, 'injected I/O'); assert.ok(thrown.recovery);
  assert.equal(bytes(r), before);
});
test('multi-file authorized hunks apply both edits; out-of-scope second file is denied', () => {
  const r = fixture(); fs.writeFileSync(path.join(r, 'src/second.ts'), 'const unusedTwo = 2;\n');
  const snapshot = capture({ root: r, scope: ['src'] });
  const result = applyHunks({ root: r, snapshot, authorizedPaths: ['src/calc.ts', 'src/second.ts'], hunks: [hunk, { path: 'src/second.ts', before: 'const unusedTwo = 2;\n', after: '' }] });
  assert.equal(result.status, 'APPLIED'); assert.equal(result.edits.length, 2);
  assert.equal(bytes(r, 'src/second.ts'), ''); assert.match(bytes(r), /owner hunk/); assert.doesNotMatch(bytes(r), /unusedPrivate/);
  const r2 = fixture(); const s2 = scope(r2);
  assert.throws(() => applyHunks({ root: r2, snapshot: s2, authorizedPaths: ['src/calc.ts'], hunks: [hunk, { path: 'owner.txt', before: 'owner', after: 'lost' }] }), /OUT_OF_SCOPE/);
  assert.equal(bytes(r2, 'owner.txt'), 'owner work\n');
});
test('invalid hunk in a multi-hunk plan fails before any write', () => {
  const r = fixture(); const before = bytes(r); const snapshot = scope(r);
  assert.throws(() => applyHunks({ root: r, snapshot, authorizedPaths: ['src/calc.ts'], hunks: [hunk, { ...hunk, before: 'missing hunk' }] }), /HUNK_NOT_UNIQUE/);
  assert.equal(bytes(r), before);
});
test('caller-authored booleans cannot replace explicit authorized scope', () => {
  const r = fixture(); const before = bytes(r); const snapshot = scope(r);
  assert.throws(() => evidence.applyHunks({ root: r, snapshot, hunks: [hunk], authorizedPaths: [], quiescent: true, skillLoaded: true, baseline: 'GREEN', ownerApproved: true }), /INVALID_SCOPE/);
  assert.equal(bytes(r), before); assert.equal(compare(snapshot, scope(r)).status, 'MATCH');
});
test('protected absolute roots are rejected lexically before any filesystem read', () => {
  const original = fs.lstatSync; let calls = 0;
  fs.lstatSync = (...args) => { calls++; return original(...args); };
  try { assert.throws(() => capture({ root: '/unreadable/.git/objects', scope: ['example'] }), /PROTECTED_METADATA/); }
  finally { fs.lstatSync = original; }
  assert.equal(calls, 0);
});
test('runner treats leading-dash test path as a path, not an option', () => {
  const r = runnerFixture("throw new Error('not selected');\n");
  fs.mkdirSync(path.join(r, '--require=.'));
  fs.writeFileSync(path.join(r, '--require=./only.cjs'), "const {test}=require('node:test');const a=require('node:assert/strict');test('selected',()=>a.equal(1,1));\n");
  const result = runNodeTests({ root: r, tests: ['--require=./only.cjs'] });
  assert.equal(result.status, 'GREEN', JSON.stringify(result)); assert.equal(result.counts.tests, 1);
});
