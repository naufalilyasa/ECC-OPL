/**
 * Tests for scripts/lib/work-item/work-item.js — the .ecc-opl/ routing helper.
 * Everything runs from a temp project dir to prove cwd-based resolution.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HELPER = path.join(__dirname, '..', '..', 'scripts', 'lib', 'work-item', 'work-item.js');

function run(cwd, args) {
  const result = spawnSync(process.execPath, [HELPER, ...args], { cwd, encoding: 'utf8' });
  return { code: result.status, out: (result.stdout || '').trim(), err: (result.stderr || '').trim() };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function withProject(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-work-item-'));
  try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function progress(dir, id) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.ecc-opl', 'work-items', id, 'progress.json'), 'utf8'));
}

function manifest(dir, id) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.ecc-opl', 'work-items', id, 'manifest.json'), 'utf8'));
}

test('resolve returns none with no pointer', () => withProject((dir) => {
  assert.strictEqual(run(dir, ['resolve']).out, 'none');
}));

test('bind creates the layout, binds the pointer, and is idempotent', () => withProject((dir) => {
  const first = run(dir, ['bind', '--slug', 'Demo Feature']);
  assert.strictEqual(first.code, 0, first.err);
  assert.match(first.out, /^WI-\d{8}-001-demo-feature$/);
  for (const sub of ['research', 'prd', 'plan', 'implementation', 'review', 'design', 'e2e', 'audit', 'documentation', 'evidence', 'canvas']) {
    assert.ok(fs.existsSync(path.join(dir, '.ecc-opl', 'work-items', first.out, sub)), `missing ${sub}/`);
  }
  const second = run(dir, ['bind', '--slug', 'Demo Feature']);
  assert.strictEqual(second.out, first.out);
  assert.strictEqual(fs.readdirSync(path.join(dir, '.ecc-opl', 'work-items')).length, 1);
}));

// Review probe: `ensure --slug unrelated-feature-b` used to return feature-a.
test('a different objective creates a new item instead of attaching to the active one', () => withProject((dir) => {
  const a = run(dir, ['bind', '--slug', 'feature-a']).out;
  const b = run(dir, ['bind', '--slug', 'unrelated-feature-b']).out;
  assert.notStrictEqual(a, b);
  assert.match(b, /-002-unrelated-feature-b$/);
  assert.strictEqual(run(dir, ['resolve']).out, b);
  // And going back to the first objective resumes it rather than creating a third.
  assert.strictEqual(run(dir, ['bind', '--slug', 'feature-a']).out, a);
  assert.strictEqual(fs.readdirSync(path.join(dir, '.ecc-opl', 'work-items')).length, 2);
}));

// Review probe: an unknown explicit id used to print "none" with exit 0.
test('an unknown explicit id is an error in resolve and bind', () => withProject((dir) => {
  const resolved = run(dir, ['resolve', '--id', 'WI-19700101-001-nope']);
  assert.strictEqual(resolved.code, 1);
  assert.strictEqual(resolved.out, '');
  assert.match(resolved.err, /unknown work item/);
  const bound = run(dir, ['bind', '--id', 'WI-19700101-001-nope']);
  assert.strictEqual(bound.code, 1);
  assert.match(bound.err, /unknown work item/);
}));

test('append then progress is a pure rebuild', () => withProject((dir) => {
  const id = run(dir, ['bind', '--slug', 'x']).out;
  assert.strictEqual(run(dir, ['append', '--workflow', 'plan', '--artifact', 'plan', '--path', `plan/${id}.md`]).code, 0);
  assert.strictEqual(run(dir, ['append', '--workflow', 'tdd', '--artifact', 'red', '--path', 'implementation/a.tdd.md', '--note', 'red']).code, 0);
  assert.strictEqual(run(dir, ['progress']).code, 0);
  const file = path.join(dir, '.ecc-opl', 'work-items', id, 'progress.json');
  const before = fs.readFileSync(file, 'utf8');
  fs.rmSync(file);
  assert.strictEqual(run(dir, ['progress']).code, 0);
  assert.strictEqual(fs.readFileSync(file, 'utf8'), before);
  const p = JSON.parse(before);
  assert.strictEqual(p.eventCount, 3);
  assert.deepStrictEqual(Object.keys(p.workflows).sort(), ['plan', 'tdd', 'work-item']);
  // Artifact presence is not completion: no event claimed an outcome.
  assert.deepStrictEqual(p.outcomes, {});
}));

test('progress carries run, revision, outcome and evidence; blockers and approvals stay visible', () => withProject((dir) => {
  const id = run(dir, ['bind', '--slug', 'x']).out;
  run(dir, ['append', '--workflow', 'e2e', '--artifact', 'evidence', '--path', 'e2e/run.md',
    '--run', 'run-1', '--revision', 'abc1234', '--outcome', 'pass', '--evidence', 'e2e/shot.png']);
  run(dir, ['append', '--workflow', 'plan', '--artifact', 'plan', '--path', 'plan/p.md',
    '--run', 'run-1', '--outcome', 'pending_approval']);
  run(dir, ['append', '--workflow', 'audit', '--artifact', 'report', '--path', 'audit/r.md',
    '--run', 'run-2', '--outcome', 'blocked', '--note', 'no sandbox']);
  assert.strictEqual(run(dir, ['progress']).code, 0);
  const p = progress(dir, id);
  assert.deepStrictEqual(p.outcomes, { pass: 1, pending_approval: 1, blocked: 1 });
  assert.strictEqual(p.runs.length, 3);
  assert.strictEqual(p.runs[0].revision, 'abc1234');
  assert.strictEqual(p.runs[0].evidence, 'e2e/shot.png');
  assert.strictEqual(p.blockers[0].workflow, 'audit');
  assert.strictEqual(p.pendingApprovals[0].workflow, 'plan');
  assert.strictEqual(p.nextActions.length, 1);
  assert.match(p.nextActions[0], /await owner approval for plan/);
}));

test('append rejects an unknown outcome', () => withProject((dir) => {
  run(dir, ['bind', '--slug', 'x']);
  const bad = run(dir, ['append', '--workflow', 'x', '--artifact', 'y', '--path', 'z', '--outcome', 'done']);
  assert.strictEqual(bad.code, 1);
  assert.match(bad.err, /unknown --outcome/);
}));

test('close clears the pointer but keeps the directory', () => withProject((dir) => {
  const id = run(dir, ['bind', '--slug', 'x']).out;
  assert.strictEqual(run(dir, ['close']).code, 0);
  assert.strictEqual(run(dir, ['resolve']).out, 'none');
  assert.ok(fs.existsSync(path.join(dir, '.ecc-opl', 'work-items', id)));
  assert.strictEqual(manifest(dir, id).status, 'closed');
  assert.strictEqual(run(dir, ['append', '--workflow', 'plan', '--artifact', 'plan', '--path', 'p']).code, 1);
}));

// Review probe: rebinding a closed item left its manifest closed.
test('binding a closed item reopens it', () => withProject((dir) => {
  const id = run(dir, ['bind', '--slug', 'x']).out;
  run(dir, ['close']);
  assert.strictEqual(run(dir, ['bind', '--id', id]).out, id);
  assert.strictEqual(manifest(dir, id).status, 'active');
  assert.strictEqual(run(dir, ['resolve']).out, id);
  const again = run(dir, ['close']);
  assert.strictEqual(again.code, 0);
  assert.strictEqual(run(dir, ['reopen', '--id', id]).out, id);
  assert.strictEqual(manifest(dir, id).status, 'active');
}));

// Review probe: archiving an active item was accepted.
test('archive refuses an active item and moves a closed one', () => withProject((dir) => {
  const id = run(dir, ['bind', '--slug', 'x']).out;
  const early = run(dir, ['archive', id]);
  assert.strictEqual(early.code, 1);
  assert.match(early.err, /not closed/);
  assert.ok(fs.existsSync(path.join(dir, '.ecc-opl', 'work-items', id)));

  run(dir, ['close']);
  assert.strictEqual(run(dir, ['archive', id]).code, 0);
  assert.ok(fs.existsSync(path.join(dir, '.ecc-opl', 'archive', id)));
  assert.ok(!fs.existsSync(path.join(dir, '.ecc-opl', 'work-items', id)));
  assert.strictEqual(run(dir, ['resolve']).out, 'none');
  const index = JSON.parse(fs.readFileSync(path.join(dir, '.ecc-opl', 'archive', 'index.json'), 'utf8'));
  assert.strictEqual(index[0].id, id);
  assert.strictEqual(index[0].report, `.ecc-opl/reports/${id}.md`);
  const again = run(dir, ['archive', id]);
  assert.strictEqual(again.code, 1);
  assert.match(again.err, /already archived/);
}));

test('archive keeps external references in the index', () => withProject((dir) => {
  const id = run(dir, ['bind', '--slug', 'x']).out;
  run(dir, ['append', '--workflow', 'security-audit', '--artifact', 'report', '--path', '/srv/audits/run-1/REPORT.md']);
  run(dir, ['close']);
  run(dir, ['archive', id]);
  const index = JSON.parse(fs.readFileSync(path.join(dir, '.ecc-opl', 'archive', 'index.json'), 'utf8'));
  assert.deepStrictEqual(index[0].externalReferences, [
    { workflow: 'security-audit', artifact: 'report', path: '/srv/audits/run-1/REPORT.md' },
  ]);
}));

// Review probe: a newly created item could reuse an archived id.
test('an archived identity is not reused', () => withProject((dir) => {
  const id = run(dir, ['bind', '--slug', 'feature-a']).out;
  run(dir, ['close']);
  run(dir, ['archive', id]);
  const refused = run(dir, ['bind', '--slug', 'feature-a']);
  assert.strictEqual(refused.code, 1);
  assert.match(refused.err, /archived item/);
  const other = run(dir, ['bind', '--slug', 'feature-b']).out;
  assert.notStrictEqual(other, id);
}));

test('ignore rules are written only inside a git project', () => withProject((dir) => {
  run(dir, ['bind', '--slug', 'no-git']);
  assert.ok(!fs.existsSync(path.join(dir, '.ecc-opl', '.gitignore')));

  fs.mkdirSync(path.join(dir, '.git', 'info'), { recursive: true });
  const id = run(dir, ['bind', '--slug', 'with-git']).out;
  assert.ok(id);
  const rules = fs.readFileSync(path.join(dir, '.ecc-opl', '.gitignore'), 'utf8');
  assert.match(rules, /!reports\/\*\*/);
}));

test('local ignore mode writes prefixed rules to .git/info/exclude only', () => withProject((dir) => {
  fs.mkdirSync(path.join(dir, '.git', 'info'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'app.txt'), 'x');
  assert.strictEqual(run(dir, ['bind', '--slug', 'x', '--ignore-mode', 'local']).code, 0);
  assert.ok(!fs.existsSync(path.join(dir, '.ecc-opl', '.gitignore')));
  const exclude = fs.readFileSync(path.join(dir, '.git', 'info', 'exclude'), 'utf8');
  assert.match(exclude, /^\.ecc-opl\/\*$/m, 'exclude rules must be project-scoped');
  assert.match(exclude, /!\.ecc-opl\/reports\/\*\*/);
  // A bare `*` would ignore the whole repository.
  assert.doesNotMatch(exclude, /^\*$/m);
}));

test('bind creates reports/ and runtime/', () => withProject((dir) => {
  run(dir, ['bind', '--slug', 'x']);
  for (const sub of ['reports', 'runtime']) {
    assert.ok(fs.existsSync(path.join(dir, '.ecc-opl', sub)), `missing ${sub}/`);
  }
}));

test('unknown subcommand exits 1', () => withProject((dir) => {
  assert.strictEqual(run(dir, ['bogus']).code, 1);
}));

// Regression: a project with "type": "module" once made the CommonJS helper
// unloadable ("require is not defined"). The per-directory format markers fix it.
test('runs inside a project whose package.json declares "type": "module"', () => withProject((dir) => {
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
  const result = run(dir, ['ensure', '--slug', 'esm host']);
  assert.strictEqual(result.code, 0, result.err);
  assert.match(result.out, /^WI-\d{8}-001-esm-host$/);
}));

let passed = 0;
let failed = 0;
for (const t of tests) {
  try { t.fn(); console.log(`  PASS ${t.name}`); passed += 1; }
  catch (error) { console.log(`  FAIL ${t.name}\n    ${error.message}`); failed += 1; }
}
console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
