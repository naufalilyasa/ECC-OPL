/**
 * Closure tests for the external-review corrections (bounded functional closure).
 *
 * Covers: workflow entrypoint projection, agent model/tool adaptation, and
 * workflow-state conversation ownership.
 *
 * Run with: node tests/lib/antigravity-closure.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const adapter = require(path.join(REPO, 'scripts/lib/install-targets/antigravity-cli'));
const { adaptAntigravityAgent } = require(path.join(REPO, 'scripts/lib/install/antigravity-agent'));
const workflowState = require(path.join(REPO, 'scripts/lib/workflow-state'));

let passed = 0;
let failed = 0;
const STATE_TEMP_DIRS = [];
function test(name, fn) {
  try { fn(); console.log(`  ok ${name}`); passed += 1; }
  catch (error) { console.log(`  FAIL ${name}\n    ${error.message.split('\n')[0]}`); failed += 1; }
}

function plan(paths) {
  return adapter.planOperations(
    { modules: [{ id: 'core', paths }], repoRoot: REPO, projectRoot: '/tmp/closure-proj' },
    adapter
  );
}

function dests(ops) {
  return ops.map(op => op.destinationPath.replace(/\\/g, '/').replace('/tmp/closure-proj/', ''));
}

console.log('\n=== Antigravity closure corrections ===\n');

// --- Area 1: workflow entrypoint projection ------------------------------

test('C1: /tdd orchestrator survives projection alongside tdd-workflow skill', () => {
  const ops = plan(['.opencode/commands/tdd.md', 'skills/tdd-workflow']);
  const paths = dests(ops);
  const orchestrator = ops.find(op => paths.indexOf('.agents/skills/opl-tdd/SKILL.md') === ops.indexOf(op));
  assert.ok(orchestrator, `opl-tdd entrypoint missing; got: ${paths.join(', ')}`);
  assert.strictEqual(
    orchestrator.contentTransform,
    'antigravity-command-to-skill',
    'the invocable /tdd orchestrator must win over the knowledge skill'
  );
});

test('C2: tdd-workflow knowledge skill is preserved under a distinct destination', () => {
  const ops = plan(['.opencode/commands/tdd.md', 'skills/tdd-workflow']);
  const paths = dests(ops);
  const knowledge = paths.filter(p => p.startsWith('.agents/skills/') && p.includes('tdd'));
  assert.ok(knowledge.length >= 2, `expected orchestrator + knowledge skill, got: ${knowledge.join(', ')}`);
});

test('C3: orchestrator body carries workflow-state arming and tdd-guide delegation', () => {
  const ops = plan(['.opencode/commands/tdd.md']);
  const op = ops.find(o => o.destinationPath.includes('opl-tdd'));
  assert.ok(op, 'opl-tdd operation missing');
  const source = fs.readFileSync(path.join(REPO, op.sourceRelativePath), 'utf8');
  assert.ok(/workflows\/active\.json|workflow/i.test(source), 'orchestrator must arm workflow state');
  assert.ok(/tdd-guide/.test(source), 'orchestrator must delegate to tdd-guide');
});

test('C4: plan-reviewer (Momus+Oracle) is projected from its canonical prompt', () => {
  const ops = plan(['.opencode/prompts/agents/plan-reviewer.txt', 'agents/planner.md']);
  const paths = dests(ops);
  assert.ok(paths.some(p => p.includes('plan-reviewer')), `plan-reviewer missing; got: ${paths.join(', ')}`);
  assert.ok(paths.some(p => p.includes('planner')), 'planner missing');
});

// --- Area 2: agent adaptation -------------------------------------------

function agentSource(model, tools, name) {
  return `---\nname: ${name}\ntools: ${tools}\nmodel: ${model}\n---\n\nBody.\n`;
}

test('C5: unapproved tier->model translations are gone (haiku/sonnet/opus)', () => {
  for (const tier of ['haiku', 'sonnet', 'opus']) {
    const out = adaptAntigravityAgent(agentSource(tier, 'Read, Grep', 'sample-agent'), 'sample-agent.md', { runtime: 'cli' });
    assert.ok(out.includes(`model: ${tier}`), `${tier} must not be rewritten; got: ${out.split('\n').find(l => l.includes('model:'))}`);
  }
});

test('C6: reviewer restriction is role-based, not a name substring', () => {
  // A name containing "reviewer" but not a review role must keep write access.
  const notAReviewer = adaptAntigravityAgent(
    agentSource('sonnet', 'Read, Write, Edit, Grep', 'reviewer-loop-runner'),
    'reviewer-loop-runner.md',
    { runtime: 'cli' }
  );
  assert.ok(/write_file/.test(notAReviewer), 'non-review role must not be stripped by substring match');
});

test('C7: canonical reviewer roles stay read-only', () => {
  const out = adaptAntigravityAgent(
    agentSource('sonnet', 'Read, Write, Edit, Bash, Grep', 'code-reviewer'),
    'code-reviewer.md',
    { runtime: 'cli' }
  );
  assert.ok(!/write_file/.test(out), 'code-reviewer must not receive write_file');
  assert.ok(!/run_command/.test(out), 'code-reviewer must not receive run_command');
});

test('C8: canonical tool allowlists do not widen declared permissions', () => {
  // Declaring only read tools must never gain write/exec from a canonical table.
  const out = adaptAntigravityAgent(
    agentSource('sonnet', 'Read, Grep', 'code-simplifier'),
    'code-simplifier.md',
    { runtime: 'cli' }
  );
  assert.ok(!/write_file/.test(out), 'declared read-only tools must not be widened to write_file');
  assert.ok(!/run_command/.test(out), 'declared read-only tools must not be widened to run_command');
});

// --- Area 4: workflow state ownership -----------------------------------

function stateFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'closure-state-'));
  STATE_TEMP_DIRS.push(dir);
  return { dir, customPath: path.join(dir, 'active.json') };
}

function baseState(overrides = {}) {
  return {
    workflow: 'tdd', phase: 'red', current: 1,
    workspace: '/tmp/ws',
    worktreeId: 'wt-1', conversationId: 'conv-A',
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

test('C9: a different conversation cannot overwrite active state', () => {
  const f = stateFixture();
  workflowState.writeWorkflowState({ customPath: f.customPath, state: baseState() });
  assert.throws(
    () => workflowState.writeWorkflowState({
      customPath: f.customPath,
      state: baseState({ conversationId: 'conv-B', phase: 'green' })
    }),
    /conversation|handoff/i
  );
});

test('C10: explicit handoff allows conversation replacement', () => {
  const f = stateFixture();
  workflowState.writeWorkflowState({ customPath: f.customPath, state: baseState() });
  workflowState.writeWorkflowState({
    customPath: f.customPath,
    state: baseState({ conversationId: 'conv-B', phase: 'green' }),
    handoff: true
  });
  const read = workflowState.readWorkflowState({ customPath: f.customPath });
  assert.strictEqual(read.conversationId, 'conv-B');
});

test('C11: same conversation can advance its own state', () => {
  const f = stateFixture();
  workflowState.writeWorkflowState({ customPath: f.customPath, state: baseState() });
  workflowState.writeWorkflowState({
    customPath: f.customPath,
    state: baseState({ phase: 'green', current: 3 })
  });
  assert.strictEqual(workflowState.readWorkflowState({ customPath: f.customPath }).phase, 'green');
});

for (const dir of STATE_TEMP_DIRS) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exitCode = 1;
