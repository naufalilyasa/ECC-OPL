/**
 * Minimal-release projection: a module that names individual agent/skill files
 * must project exactly those files, not expand a whole directory, and must keep
 * `<name>/SKILL.md` shape.
 *
 * Run with: node tests/lib/antigravity-minimal-projection.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const adapter = require('../../scripts/lib/install-targets/antigravity-cli');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed += 1; }
  catch (error) { console.log(`  ✗ ${name}\n    ${error.message}`); failed += 1; }
}
const REPO = path.resolve(__dirname, '..', '..');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'agy-minimal-'));

function plan(paths, projectRoot) {
  return adapter.planOperations(
    { modules: [{ id: 'antigravity-cli-tdd-minimal', paths }], projectRoot, repoRoot: REPO },
    adapter
  );
}
const rel = (op, root) => op.destinationPath.replace(/\\/g, '/').split(root.replace(/\\/g, '/') + '/').pop();

function runTests() {
  console.log('\n=== Minimal release projection ===\n');

  test('naming one agent file projects only that agent', () => {
    const root = tmp();
    const ops = plan(['agents/tdd-guide.md', 'agents/code-reviewer.md'], root);
    const dests = ops.map(op => rel(op, root)).sort();
    assert.deepStrictEqual(dests, [
      '.agents/agents/opl-code-reviewer/agent.md',
      '.agents/agents/opl-tdd-guide/agent.md'
    ]);
  });

  test('naming one prompt file projects only that prompt', () => {
    const root = tmp();
    const ops = plan(['.opencode/prompts/agents/plan-reviewer.txt'], root);
    assert.strictEqual(ops.length, 1);
    assert.ok(rel(ops[0], root).endsWith('.agents/agents/opl-plan-reviewer/agent.md'));
  });

  test('a skill claimed by its SKILL.md stays <name>/SKILL.md', () => {
    const root = tmp();
    for (const skillPath of ['skills/tdd-workflow/SKILL.md', 'skills/coding-standards/SKILL.md']) {
      const ops = plan([skillPath], root);
      const dest = rel(ops[0], root);
      assert.match(dest, /^\.agents\/skills\/[^/]+\/SKILL\.md$/, `${skillPath} -> ${dest}`);
    }
  });

  test('a whole agents directory still expands (existing behaviour)', () => {
    const root = tmp();
    const ops = plan(['agents'], root);
    assert.ok(ops.length > 20, `expected directory expansion, got ${ops.length}`);
  });

  test('command orchestrator wins the public skill name', () => {
    const root = tmp();
    const ops = plan(['.opencode/commands/tdd.md', 'skills/tdd-workflow/SKILL.md'], root);
    const dests = ops.map(op => rel(op, root));
    assert.ok(dests.some(d => d === '.agents/skills/opl-tdd/SKILL.md'), dests.join(', '));
    assert.ok(
      dests.some(d => d.startsWith('.agents/skills/opl-tdd-tdd-workflow')),
      `knowledge skill should relocate, got ${dests.join(', ')}`
    );
    assert.ok(!dests.some(d => d.includes('SKILL.md/')), 'no file-name-as-directory paths');
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

runTests();
