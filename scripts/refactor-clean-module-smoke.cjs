#!/usr/bin/env node
'use strict';
// V1.1.3 smoke for the SUPPORTED write channel (plan-bound `apply-module`).
// The CLI `apply` operation stays deliberately blocked; this is never labelled CLI.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const H = require('../.opencode/scripts/refactor-clean-evidence.cjs');
const HELP = path.resolve(__dirname, '../.opencode/scripts/refactor-clean-evidence.cjs');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const roots = [];
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'rc113-smoke-scratch-'));
fs.chmodSync(scratch, 0o700); roots.push(scratch);
const result = { mode: 'MODULE', generated_at: new Date().toISOString(), node: process.version };
const before = 'const dead = () => 7;\nexport const add = (a,b) => a+b;\n';
const testText = "const { test } = require('node:test');const assert = require('node:assert/strict');test('add',()=>assert.equal(3,3));\n";
function fixture(label) {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), label)); roots.push(r);
  fs.mkdirSync(path.join(r, 'src')); fs.mkdirSync(path.join(r, 'tests'));
  fs.writeFileSync(path.join(r, 'src/private.js'), before);
  fs.writeFileSync(path.join(r, 'tests/t.cjs'), testText);
  const scope = ['src/private.js']; const tests = ['tests/t.cjs'];
  const plan = H.makePlan({ root: r, scope, tests });
  const snapshot = H.capture({ root: r, scope: plan.scope, guard: plan.guard });
  const baseline = H.runNodeTests({ root: r, tests: plan.tests, scope: plan.scope, guard: plan.guard, plan,
    expectedFingerprint: snapshot.fingerprint, stage: 'baseline', run_id: 'module-smoke' });
  return { r, plan, scope, snapshot, baseline };
}
function skillEvidence() {
  const source = '---\nname: ecc-remove-deadcode-safe\n---\n\nSAFE RULE\n'; const body = '\nSAFE RULE\n';
  const expected = { id: 'ecc-remove-deadcode-safe', source, body, sha256: sha(Buffer.from(source)), path: '/installed/SKILL.md' };
  return H.verifyLoadedSkill({ expected,
    session: { id: 'ses_smoke_child', parentID: 'ses_smoke_parent', agent: 'code-simplifier' },
    requestedSession: 'ses_smoke_child', requestedParent: 'ses_smoke_parent',
    registry: { id: expected.id, path: expected.path, content: body },
    messages: [{ id: 'smoke-skill', type: 'skill', skill: expected.id, text: body, time: { created: 1 } }] });
}
try {
  const direct = fixture('rc113-module-smoke-');
  const hunks = [{ path: 'src/private.js', before: 'const dead = () => 7;\n', after: '' }];
  result.baseline = { status: direct.baseline.status, tests: direct.baseline.counts?.tests || 0,
    assertions: direct.baseline.assertions, snapshot_fingerprint: direct.baseline.snapshot_fingerprint,
    plan_digest: direct.baseline.plan_digest };
  const directRequest = { root: direct.r, scope: direct.scope, guard: direct.plan.guard, snapshot: direct.snapshot,
    plan: direct.plan, baseline: direct.baseline, skillEvidence: skillEvidence(), expectedSkill: 'ecc-remove-deadcode-safe',
    pass: 'A', stage: 'apply-A', run_id: 'module-smoke', scratch,
    authorizedPaths: ['src/private.js'], hunks };
  const applied = H.applyModule(directRequest);
  result.apply = { status: applied.status, edits: applied.edits.length,
    before_sha256: sha(Buffer.from(before)), after_sha256: sha(fs.readFileSync(path.join(direct.r, 'src/private.js'))),
    snapshot_fingerprint: applied.snapshot.fingerprint };
  const post = H.runNodeTests({ root: direct.r, tests: direct.plan.tests, scope: direct.plan.scope, guard: direct.plan.guard,
    plan: direct.plan, stage: 'post-A', run_id: 'module-smoke', expectedFingerprint: applied.snapshot.fingerprint });
  result.post_tests = { status: post.status, assertions: post.assertions,
    snapshot_fingerprint: post.snapshot_fingerprint, after_fingerprint: post.after_fingerprint };
  result.pass = H.evaluatePass({ applied, postTests: post, plan: direct.plan, stage: 'post-A', run_id: 'module-smoke' });

  // The supported child invocation is file-based `apply-module`, never inline interpreter.
  const child = fixture('rc113-apply-module-smoke-');
  const request = { root: child.r, scope: child.scope, guard: child.plan.guard, snapshot: child.snapshot,
    plan: child.plan, baseline: child.baseline, skillEvidence: skillEvidence(), expectedSkill: 'ecc-remove-deadcode-safe',
    pass: 'A', stage: 'apply-A', run_id: 'module-smoke', scratch,
    authorizedPaths: ['src/private.js'], hunks };
  const requestFile = path.join(scratch, 'apply-module-smoke.json');
  fs.writeFileSync(requestFile, JSON.stringify(request));
  const invoked = spawnSync(process.execPath, [HELP, 'apply-module', requestFile], { encoding: 'utf8' });
  const invokedBody = JSON.parse(invoked.stdout || '{}');
  result.apply_module_operation = { invocation: 'node evidence.cjs apply-module <request.json>', exit: invoked.status,
    status: invokedBody.status, mode: invokedBody.mode, stage: invokedBody.stage,
    edits: invokedBody.edits?.length || 0,
    supported: invokedBody.status === 'APPLIED' && invokedBody.mode === 'MODULE_INVOCATION' };
  fs.unlinkSync(requestFile);
  result.helper_sha256 = sha(fs.readFileSync(HELP));
  result.supported_channel = 'MODULE_APPLY';
  result.status = result.pass.status === 'PASS_COMPLETE' && result.apply_module_operation.supported ? 'PASS' : 'FAIL';
} catch (error) {
  result.status = 'FAIL'; result.reason = error.message;
} finally {
  for (const dir of roots) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* gone */ } }
}
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
