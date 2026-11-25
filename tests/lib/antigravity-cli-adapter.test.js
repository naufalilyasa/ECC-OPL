/**
 * Unit and contract tests for Antigravity CLI adapter and transformer.
 */

'use strict';

const assert = require('assert');
const path = require('path');
const yaml = require('js-yaml');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const {
  adaptAntigravityAgent,
  CLI_TOOL_NAMES,
  TOOL_NAMES,
  MODEL_NAMES,
} = require(path.join(REPO_ROOT, 'scripts', 'lib', 'install', 'antigravity-agent'));
const { getInstallTargetAdapter } = require(path.join(REPO_ROOT, 'scripts', 'lib', 'install-targets', 'registry'));

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
    failed += 1;
  }
}

console.log('=== Testing Antigravity CLI adapter ===\n');

// 1. Tool dictionary verification
test('CLI_TOOL_NAMES maps all expected CLI tools', () => {
  assert.strictEqual(CLI_TOOL_NAMES.Read, 'read_file');
  assert.strictEqual(CLI_TOOL_NAMES.ReadFile, 'read_file');
  assert.strictEqual(CLI_TOOL_NAMES.NotebookRead, 'read_file');
  assert.strictEqual(CLI_TOOL_NAMES.Write, 'write_file');
  assert.strictEqual(CLI_TOOL_NAMES.Edit, 'edit_file');
  assert.strictEqual(CLI_TOOL_NAMES.MultiEdit, 'edit_file');
  assert.strictEqual(CLI_TOOL_NAMES.Grep, 'grep_search');
  assert.strictEqual(CLI_TOOL_NAMES.Glob, 'find_by_name');
  assert.strictEqual(CLI_TOOL_NAMES.Bash, 'run_command');
  assert.strictEqual(CLI_TOOL_NAMES.WebSearch, 'search_web');
  assert.strictEqual(CLI_TOOL_NAMES.WebFetch, 'read_url_content');
  assert.strictEqual(CLI_TOOL_NAMES.Task, 'invoke_subagent');
});

// 2. Editor runtime backward compatibility (default)
test('adaptAntigravityAgent defaults to editor runtime without breaking existing callers', () => {
  const source = [
    '---',
    'name: code-simplifier',
    'description: Simplifier',
    'tools: Read, Edit, Write, Grep, Glob, Bash',
    'model: sonnet',
    'color: teal',
    '---',
    '',
    'Body text',
  ].join('\n');

  const adapted = adaptAntigravityAgent(source, 'agents/code-simplifier.md');
  const parsed = yaml.load(adapted.match(/^---\n([\s\S]*?)\n---\n/)[1]);

  assert.strictEqual(parsed.model, 'sonnet');
  assert.deepStrictEqual(parsed.tools, [
    'view_file',
    'replace_file_content',
    'write_to_file',
    'grep_search',
    'find_by_name',
    'run_command',
  ]);
});

// 3. CLI runtime tool mapping
test('adaptAntigravityAgent with runtime: "cli" maps tools to native CLI names', () => {
  const source = [
    '---',
    'name: generic-mapper',
    'description: Generic tool mapping agent',
    'tools: Read, ReadFile, NotebookRead, Edit, MultiEdit, Write, Grep, Glob, Bash, Task, WebSearch, WebFetch',
    'model: opus',
    'color: purple',
    'hooks: pre-commit',
    '---',
    '',
    '## Instructions',
    'Follow TDD.',
  ].join('\n');

  const adapted = adaptAntigravityAgent(source, 'agents/generic-mapper.md', { runtime: 'cli' });
  const parsed = yaml.load(adapted.match(/^---\n([\s\S]*?)\n---\n/)[1]);

  assert.strictEqual(parsed.name, 'opl-generic-mapper');
  assert.strictEqual(parsed.model, 'opus');
  assert.strictEqual(Object.hasOwn(parsed, 'color'), false);
  assert.strictEqual(Object.hasOwn(parsed, 'hooks'), false);
  assert.deepStrictEqual(parsed.tools, [
    'read_file',
    'edit_file',
    'write_file',
    'grep_search',
    'find_by_name',
    'run_command',
    'invoke_subagent',
    'search_web',
    'read_url_content',
  ]);
  assert.ok(adapted.includes('Follow TDD.'));
});

// 4. Model tier mapping in CLI mode
test('adaptAntigravityAgent passes model through unchanged (no unapproved tier translation)', () => {
  const sourceHaiku = [
    '---',
    'name: quick-helper',
    'description: Fast helper',
    'tools: Read',
    'model: haiku',
    '---',
    'Helper body',
  ].join('\n');

  const adapted = adaptAntigravityAgent(sourceHaiku, 'agents/quick-helper.md', { runtime: 'cli' });
  const parsed = yaml.load(adapted.match(/^---\n([\s\S]*?)\n---\n/)[1]);
  assert.strictEqual(parsed.model, 'haiku');
});

// 5. Restricted Reviewer Tool Stripping
test('adaptAntigravityAgent strips write/edit/command/subagent tools for reviewer agents in CLI mode', () => {
  const reviewerSource = [
    '---',
    'name: opl-code-reviewer',
    'description: Expert reviewer agent',
    'tools: Read, Edit, Write, Grep, Glob, Bash, Task',
    'model: opus',
    '---',
    '',
    'Review only.',
  ].join('\n');

  const adapted = adaptAntigravityAgent(reviewerSource, 'agents/opl-code-reviewer.md', { runtime: 'cli' });
  const parsed = yaml.load(adapted.match(/^---\n([\s\S]*?)\n---\n/)[1]);

  // Reviewer MUST NOT have write_file, edit_file, run_command, invoke_subagent
  assert.deepStrictEqual(parsed.tools, [
    'read_file',
    'grep_search',
    'find_by_name',
  ]);
});

// 6. Fail-closed on unmapped tools in CLI mode
test('adaptAntigravityAgent throws descriptive error on unmapped tools in CLI mode', () => {
  const invalidSource = [
    '---',
    'name: weird-agent',
    'description: Agent with invalid tool',
    'tools: Read, UnknownCustomToolX, Grep',
    'model: sonnet',
    '---',
    'Body',
  ].join('\n');

  assert.throws(
    () => adaptAntigravityAgent(invalidSource, 'agents/weird-agent.md', { runtime: 'cli' }),
    /unmapped required tool\(s\): UnknownCustomToolX/i
  );
});

// 7. Registry resolution of antigravity-cli
test('registry resolves antigravity-cli target adapter', () => {
  const adapter = getInstallTargetAdapter('antigravity-cli');
  assert.strictEqual(adapter.id, 'antigravity-cli');
  assert.strictEqual(adapter.target, 'antigravity-cli');
  assert.strictEqual(adapter.kind, 'project');
});

// 8. Operation planning for antigravity-cli
test('antigravity-cli adapter plans skills with opl- namespace and omits duplicate workflows', () => {
  const adapter = getInstallTargetAdapter('antigravity-cli');
  const operations = adapter.planOperations({
    repoRoot: '/repo',
    projectRoot: '/project',
    homeDir: '/home/user',
    modules: [{
      id: 'test-module',
      paths: [
        'skills/tdd-workflow',
        'commands/tdd.md',
        'agents/code-reviewer.md',
      ],
    }],
  });

  // Skills should be projected to .agents/skills/opl-tdd
  const skillOp = operations.find(op => op.sourceRelativePath.includes('skills/tdd-workflow'));
  assert.ok(skillOp, 'Expected skill operation for tdd-workflow');
  assert.ok(
    skillOp.destinationPath.replace(/\\/g, '/').includes('.agents/skills/opl-tdd'),
    `Expected destination to include .agents/skills/opl-tdd, got: ${skillOp.destinationPath}`
  );

  // Agent should use antigravity-agent-frontmatter-cli and be named opl-code-reviewer
  const agentOp = operations.find(op => op.sourceRelativePath.includes('agents/code-reviewer.md'));
  assert.ok(agentOp, 'Expected agent operation for code-reviewer');
  assert.strictEqual(agentOp.contentTransform, 'antigravity-agent-frontmatter-cli');
  assert.ok(
    agentOp.destinationPath.replace(/\\/g, '/').includes('.agents/agents/opl-code-reviewer/agent.md'),
    `Expected destination to include .agents/agents/opl-code-reviewer/agent.md, got: ${agentOp.destinationPath}`
  );

  // Commands should NOT be projected to .agents/workflows/
  const workflowOp = operations.find(op => op.destinationPath.replace(/\\/g, '/').includes('.agents/workflows'));
  assert.strictEqual(workflowOp, undefined, 'Commands must not be duplicated into .agents/workflows');
});

// 9. MCP tool preservation in CLI mode
test('adaptAntigravityAgent preserves mcp__* tools in CLI mode without throwing', () => {
  const mcpSource = [
    '---',
    'name: generic-mcp-agent',
    'description: Lookup docs',
    'tools: Read, Grep, mcp__context7__resolve-library-id, mcp__context7__query-docs',
    'model: haiku',
    '---',
    'Body',
  ].join('\n');

  const adapted = adaptAntigravityAgent(mcpSource, 'agents/generic-mcp-agent.md', { runtime: 'cli' });
  const parsed = yaml.load(adapted.match(/^---\n([\s\S]*?)\n---\n/)[1]);

  assert.strictEqual(parsed.name, 'opl-generic-mcp-agent');
  assert.deepStrictEqual(parsed.tools, [
    'read_file',
    'grep_search',
    'mcp__context7__resolve-library-id',
    'mcp__context7__query-docs',
  ]);
});

// 10. Defensive reviewer tool stripping via label
test('adaptAntigravityAgent strips reviewer tools for an explicit review role resolved from the label', () => {
  const malformedSource = [
    '---',
    'name: custom-auditor',
    'description: Auditor agent',
    'tools: Read, Edit, Write, Grep, Bash, Task',
    'model: sonnet',
    '---',
    'Body',
  ].join('\n');

  // The label resolves to a canonical review role, so restriction applies.
  const adapted = adaptAntigravityAgent(malformedSource, 'agents/code-reviewer.md', { runtime: 'cli' });
  const parsed = yaml.load(adapted.match(/^---\n([\s\S]*?)\n---\n/)[1]);

  assert.deepStrictEqual(parsed.tools, [
    'read_file',
    'grep_search',
  ]);
});

test('adaptAntigravityAgent does not strip tools from a non-review role whose name contains "reviewer"', () => {
  const source = [
    '---',
    'name: reviewer-loop-runner',
    'description: Runs reviewer loops',
    'tools: Read, Edit, Write, Grep',
    'model: sonnet',
    '---',
    'Body',
  ].join('\n');

  const adapted = adaptAntigravityAgent(source, 'agents/reviewer-loop-runner.md', { runtime: 'cli' });
  const parsed = yaml.load(adapted.match(/^---\n([\s\S]*?)\n---\n/)[1]);

  assert.ok(parsed.tools.includes('write_file'), 'substring match must not strip a non-review role');
});

// 11. Directory-level agents module path expands all files with opl- prefix
test('antigravity-cli adapter expands directory-level "agents" module path with opl- prefix', () => {
  const adapter = getInstallTargetAdapter('antigravity-cli');
  const operations = adapter.planOperations({
    repoRoot: REPO_ROOT,
    projectRoot: '/project',
    homeDir: '/home/user',
    modules: [{
      id: 'agents-core',
      paths: ['agents'],
    }],
  });

  assert.ok(operations.length > 50, `Expected at least 50 agents planned, got: ${operations.length}`);
  for (const op of operations) {
    const normalized = op.destinationPath.replace(/\\/g, '/');
    // agy registers a subagent from `.agents/agents/<name>/agent.md`.
    assert.ok(
      normalized.includes('/.agents/agents/opl-') && normalized.endsWith('/agent.md'),
      `Expected agent destination .agents/agents/opl-<name>/agent.md, got: ${op.destinationPath}`
    );
    assert.strictEqual(op.contentTransform, 'antigravity-agent-frontmatter-cli');
  }
});

// 12. Core workflow projections from commands and skills (A2.1)
test('antigravity-cli adapter projects core workflows into .agents/skills/ with opl- prefix and SKILL.md destination', () => {
  const adapter = getInstallTargetAdapter('antigravity-cli');
  const operations = adapter.planOperations({
    repoRoot: REPO_ROOT,
    projectRoot: '/project',
    homeDir: '/home/user',
    modules: [{
      id: 'core-workflows',
      paths: [
        'commands/code-review.md',
        'commands/refactor-clean.md',
        'commands/update-docs.md',
        'skills/deep-research',
        'skills/typography-system',
      ],
    }],
  });

  // commands/code-review.md -> .agents/skills/opl-code-review-quick/SKILL.md
  const crOp = operations.find(op => op.sourceRelativePath === 'commands/code-review.md');
  assert.ok(crOp, 'Expected operation for commands/code-review.md');
  assert.strictEqual(
    crOp.destinationPath.replace(/\\/g, '/'),
    '/project/.agents/skills/opl-code-review-quick/SKILL.md'
  );
  assert.strictEqual(crOp.contentTransform, 'antigravity-command-to-skill');

  // commands/refactor-clean.md -> .agents/skills/opl-refactor-clean/SKILL.md
  const rcOp = operations.find(op => op.sourceRelativePath === 'commands/refactor-clean.md');
  assert.ok(rcOp, 'Expected operation for commands/refactor-clean.md');
  assert.strictEqual(
    rcOp.destinationPath.replace(/\\/g, '/'),
    '/project/.agents/skills/opl-refactor-clean/SKILL.md'
  );
  assert.strictEqual(rcOp.contentTransform, 'antigravity-command-to-skill');

  // commands/update-docs.md -> .agents/skills/opl-docs-update/SKILL.md
  const udOp = operations.find(op => op.sourceRelativePath === 'commands/update-docs.md');
  assert.ok(udOp, 'Expected operation for commands/update-docs.md');
  assert.strictEqual(
    udOp.destinationPath.replace(/\\/g, '/'),
    '/project/.agents/skills/opl-docs-update/SKILL.md'
  );
  assert.strictEqual(udOp.contentTransform, 'antigravity-command-to-skill');

  // skills/deep-research -> .agents/skills/opl-deep-research
  const drOp = operations.find(op => op.sourceRelativePath.startsWith('skills/deep-research'));
  assert.ok(drOp, 'Expected operation for skills/deep-research');
  assert.ok(
    drOp.destinationPath.replace(/\\/g, '/').includes('.agents/skills/opl-deep-research'),
    `Expected destination to include .agents/skills/opl-deep-research, got: ${drOp.destinationPath}`
  );

  // skills/typography-system -> .agents/skills/opl-typography
  const typoOp = operations.find(op => op.sourceRelativePath.startsWith('skills/typography-system'));
  assert.ok(typoOp, 'Expected operation for skills/typography-system');
  assert.ok(
    typoOp.destinationPath.replace(/\\/g, '/').includes('.agents/skills/opl-typography'),
    `Expected destination to include .agents/skills/opl-typography, got: ${typoOp.destinationPath}`
  );
});

// 13. adaptAntigravityCommandToSkill transforms command frontmatter into valid SKILL.md
test('adaptAntigravityCommandToSkill sets skill name matching directory', () => {
  const { adaptAntigravityCommandToSkill } = require(path.join(REPO_ROOT, 'scripts', 'lib', 'install', 'antigravity-agent'));
  const sourceCommand = [
    '---',
    'description: Quick code review command',
    'argument-hint: "[target]"',
    '---',
    '',
    '# Code Review',
    'Instructions',
  ].join('\n');

  const destinationPath = '/project/.agents/skills/opl-code-review-quick/SKILL.md';
  const transformed = adaptAntigravityCommandToSkill(sourceCommand, destinationPath);
  const parsed = yaml.load(transformed.match(/^---\n([\s\S]*?)\n---\n/)[1]);

  assert.strictEqual(parsed.name, 'opl-code-review-quick');
  assert.strictEqual(parsed.description, 'Quick code review command');
  assert.strictEqual(parsed['argument-hint'], '[target]');
  assert.ok(transformed.includes('# Code Review'));
});

// 14. Canonical ECC-OPL agent tool adaptations (A2.2)
test('adaptAntigravityAgent narrows (never widens) canonical ECC-OPL agent tool sets in CLI mode', () => {
  // planner declares only read tools: the canonical table must not add
  // invoke_subagent, which the agent never asked for.
  const plannerSource = [
    '---',
    'name: planner',
    'description: Planner',
    'tools: Read, Grep, Glob',
    'model: opus',
    '---',
    'body',
  ].join('\n');
  const plannerAdapted = yaml.load(
    adaptAntigravityAgent(plannerSource, 'agents/planner.md', { runtime: 'cli' }).match(/^---\n([\s\S]*?)\n---\n/)[1]
  );
  assert.deepStrictEqual(plannerAdapted.tools, ['read_file', 'grep_search', 'find_by_name']);

  // planner that declares Task keeps it (canonical allows it).
  const plannerWithTask = yaml.load(
    adaptAntigravityAgent(
      plannerSource.replace('tools: Read, Grep, Glob', 'tools: Read, Grep, Glob, Task'),
      'agents/planner.md',
      { runtime: 'cli' }
    ).match(/^---\n([\s\S]*?)\n---\n/)[1]
  );
  assert.deepStrictEqual(plannerWithTask.tools, ['read_file', 'grep_search', 'find_by_name', 'invoke_subagent']);

  // code-simplifier -> [read_file, edit_file, write_file, grep_search, find_by_name] (NO run_command)
  const simplifierSource = [
    '---',
    'name: code-simplifier',
    'description: Simplifier',
    'tools: Read, Write, Edit, Bash, Grep, Glob',
    'model: sonnet',
    '---',
    'body',
  ].join('\n');
  const simplifierAdapted = yaml.load(
    adaptAntigravityAgent(simplifierSource, 'agents/code-simplifier.md', { runtime: 'cli' }).match(/^---\n([\s\S]*?)\n---\n/)[1]
  );
  assert.deepStrictEqual(simplifierAdapted.tools, ['read_file', 'edit_file', 'write_file', 'grep_search', 'find_by_name']);

  // doc-updater -> [read_file, edit_file, write_file, grep_search, find_by_name] (NO run_command)
  const docUpdaterSource = [
    '---',
    'name: doc-updater',
    'description: Doc updater',
    'tools: Read, Write, Edit, Bash, Grep, Glob',
    'model: haiku',
    '---',
    'body',
  ].join('\n');
  const docUpdaterAdapted = yaml.load(
    adaptAntigravityAgent(docUpdaterSource, 'agents/doc-updater.md', { runtime: 'cli' }).match(/^---\n([\s\S]*?)\n---\n/)[1]
  );
  assert.deepStrictEqual(docUpdaterAdapted.tools, ['read_file', 'edit_file', 'write_file', 'grep_search', 'find_by_name']);
});

console.log(`\nResults: Passed: ${passed}, Failed: ${failed}\n`);
if (failed > 0) {
  process.exit(1);
}
