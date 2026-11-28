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

test('resolve returns none with no pointer', () => withProject((dir) => {
  assert.strictEqual(run(dir, ['resolve']).out, 'none');
}));

test('ensure creates the layout, binds the pointer, and is idempotent', () => withProject((dir) => {
  const first = run(dir, ['ensure', '--slug', 'Demo Feature']);
  assert.strictEqual(first.code, 0, first.err);
  assert.match(first.out, /^WI-\d{8}-001-demo-feature$/);
  for (const sub of ['research', 'prd', 'plan', 'implementation', 'review', 'design', 'e2e', 'audit', 'documentation', 'evidence', 'canvas']) {
    assert.ok(fs.existsSync(path.join(dir, '.ecc-opl', 'work-items', first.out, sub)), `missing ${sub}/`);
  }
  const second = run(dir, ['ensure', '--slug', 'Demo Feature']);
  assert.strictEqual(second.out, first.out);
  assert.strictEqual(fs.readdirSync(path.join(dir, '.ecc-opl', 'work-items')).length, 1);
}));

test('append then progress is a pure rebuild', () => withProject((dir) => {
  const id = run(dir, ['ensure', '--slug', 'x']).out;
  assert.strictEqual(run(dir, ['append', '--workflow', 'plan', '--artifact', 'plan', '--path', `plan/${id}.md`]).code, 0);
  assert.strictEqual(run(dir, ['append', '--workflow', 'tdd', '--artifact', 'red', '--path', 'implementation/a.tdd.md', '--note', 'red']).code, 0);
  assert.strictEqual(run(dir, ['progress']).code, 0);
  const file = path.join(dir, '.ecc-opl', 'work-items', id, 'progress.json');
  const before = fs.readFileSync(file, 'utf8');
  fs.rmSync(file);
  assert.strictEqual(run(dir, ['progress']).code, 0);
  assert.strictEqual(fs.readFileSync(file, 'utf8'), before);
  const progress = JSON.parse(before);
  assert.strictEqual(progress.eventCount, 3);
  assert.deepStrictEqual(Object.keys(progress.workflows).sort(), ['plan', 'tdd', 'work-item']);
}));

test('close clears the pointer but keeps the directory', () => withProject((dir) => {
  const id = run(dir, ['ensure', '--slug', 'x']).out;
  assert.strictEqual(run(dir, ['close']).code, 0);
  assert.strictEqual(run(dir, ['resolve']).out, 'none');
  assert.ok(fs.existsSync(path.join(dir, '.ecc-opl', 'work-items', id)));
  assert.strictEqual(run(dir, ['append', '--workflow', 'plan', '--artifact', 'plan', '--path', 'p']).code, 1);
}));

test('archive moves the directory and updates the index', () => withProject((dir) => {
  const id = run(dir, ['ensure', '--slug', 'x']).out;
  assert.strictEqual(run(dir, ['archive', id]).code, 0);
  assert.ok(fs.existsSync(path.join(dir, '.ecc-opl', 'archive', id)));
  assert.ok(!fs.existsSync(path.join(dir, '.ecc-opl', 'work-items', id)));
  assert.strictEqual(run(dir, ['resolve']).out, 'none');
  const index = JSON.parse(fs.readFileSync(path.join(dir, '.ecc-opl', 'archive', 'index.json'), 'utf8'));
  assert.strictEqual(index[0].id, id);
  const again = run(dir, ['archive', id]);
  assert.strictEqual(again.code, 1);
  assert.match(again.err, /already archived/);
}));

test('unknown id and unknown subcommand exit 1', () => withProject((dir) => {
  assert.strictEqual(run(dir, ['resolve', '--id', 'WI-19700101-001-nope']).out, 'none');
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
