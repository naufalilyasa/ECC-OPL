/**
 * Round-6: skill-tree relocation and command authority.
 *
 * Run with: node tests/lib/antigravity-skill-tree.test.js
 */
'use strict';

const assert = require('assert');
const {
  dedupeSkillDestinations,
  dedupeAgentDestinations,
  skillDestinationKey,
  sourceSkillRoot
} = require('../../scripts/lib/install-targets/antigravity-destinations');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed += 1; }
  catch (error) { console.log(`  ✗ ${name}\n    ${error.message.split('\n')[0]}`); failed += 1; }
}

function op(sourceRelativePath, destinationPath, contentTransform = 'scaffold') {
  return { sourceRelativePath, destinationPath, contentTransform };
}

function dests(ops) {
  return dedupeSkillDestinations(ops).map(o => o.destinationPath);
}

function runTests() {
  console.log('\n=== Round-6: skill tree + command authority ===\n');

  test('T1 nested companions relocate with their skill', () => {
    const out = dests([
      op('.opencode/commands/tdd.md', '.agents/skills/opl-tdd/SKILL.md', 'antigravity-command-to-skill'),
      op('skills/tdd-workflow/SKILL.md', '.agents/skills/opl-tdd/SKILL.md'),
      op('skills/tdd-workflow/scripts/runner.js', '.agents/skills/opl-tdd/scripts/runner.js'),
      op('skills/tdd-workflow/references/examples.md', '.agents/skills/opl-tdd/references/examples.md')
    ]);
    assert.deepStrictEqual(out, [
      '.agents/skills/opl-tdd/SKILL.md',
      '.agents/skills/opl-tdd-tdd-workflow/SKILL.md',
      '.agents/skills/opl-tdd-tdd-workflow/scripts/runner.js',
      '.agents/skills/opl-tdd-tdd-workflow/references/examples.md'
    ]);
  });

  test('T2 non-colliding skill tree is preserved unchanged', () => {
    const out = dests([
      op('skills/a11y/SKILL.md', '.agents/skills/opl-a11y/SKILL.md'),
      op('skills/a11y/scripts/scan.py', '.agents/skills/opl-a11y/scripts/scan.py'),
      op('skills/a11y/references/wcag.md', '.agents/skills/opl-a11y/references/wcag.md')
    ]);
    assert.deepStrictEqual(out, [
      '.agents/skills/opl-a11y/SKILL.md',
      '.agents/skills/opl-a11y/scripts/scan.py',
      '.agents/skills/opl-a11y/references/wcag.md'
    ]);
  });

  test('T3 sourceSkillRoot resolves the skill root, not the parent dir', () => {
    assert.strictEqual(sourceSkillRoot('skills/tdd-workflow/scripts/runner.js'), 'tdd-workflow');
    assert.strictEqual(sourceSkillRoot('skills/tdd-workflow/references/examples.md'), 'tdd-workflow');
    assert.strictEqual(sourceSkillRoot('skills/tdd-workflow/SKILL.md'), 'tdd-workflow');
    assert.strictEqual(sourceSkillRoot('skills/a11y/scripts/scan.py'), 'a11y');
    assert.strictEqual(sourceSkillRoot('skills/a11y'), 'a11y');
  });

  test('T4 every operation in a relocated tree shares one destination root', () => {
    const out = dedupeSkillDestinations([
      op('.opencode/commands/tdd.md', '.agents/skills/opl-tdd/SKILL.md', 'antigravity-command-to-skill'),
      op('skills/tdd-workflow/SKILL.md', '.agents/skills/opl-tdd/SKILL.md'),
      op('skills/tdd-workflow/scripts/runner.js', '.agents/skills/opl-tdd/scripts/runner.js')
    ]);
    const roots = new Set(out.map(o => o.destinationPath.replace(/\/[^/]*$/, '')));
    assert.ok(
      [...roots].every(r => r === '.agents/skills/opl-tdd' || r.startsWith('.agents/skills/opl-tdd-tdd-workflow')),
      `unexpected roots: ${[...roots].join(', ')}`
    );
    assert.ok(
      out.every(o => !o.destinationPath.includes('opl-tdd-scripts')),
      'parent-directory naming must not leak into a destination'
    );
  });

  test('T5 skillDestinationKey still isolates a skill directory', () => {
    assert.strictEqual(skillDestinationKey({ destinationPath: '.agents/skills/opl-x/SKILL.md' }), '.agents/skills/opl-x');
    assert.strictEqual(skillDestinationKey({ destinationPath: '.agents/skills/opl-x/scripts/a.js' }), '.agents/skills/opl-x');
    assert.strictEqual(skillDestinationKey({ destinationPath: '.agents/agents/opl-y/agent.md' }), null);
  });

  test('T6 command authority: one entrypoint per public skill name', () => {
    const out = dedupeSkillDestinations([
      op('commands/tdd.md', '.agents/skills/opl-tdd/SKILL.md', 'antigravity-command-to-skill'),
      op('.opencode/commands/tdd.md', '.agents/skills/opl-tdd/SKILL.md', 'antigravity-command-to-skill')
    ]);
    const entrypoints = out.filter(o => o.destinationPath === '.agents/skills/opl-tdd/SKILL.md');
    assert.strictEqual(entrypoints.length, 1, 'exactly one opl-tdd/SKILL.md entrypoint may survive');
  });

  test('T7 agent dedupe still keeps the rich agents/*.md form', () => {
    const out = dedupeAgentDestinations([
      op('agents/code-reviewer.md', '.agents/agents/opl-code-reviewer/agent.md', 'antigravity-agent-frontmatter-cli'),
      op('.opencode/prompts/agents/code-reviewer.txt', '.agents/agents/opl-code-reviewer/agent.md', 'antigravity-prompt-to-agent')
    ]);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].contentTransform, 'antigravity-agent-frontmatter-cli');
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

runTests();
