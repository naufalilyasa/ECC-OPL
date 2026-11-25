/**
 * Round-5 review fixes.
 *
 * Run with: node tests/lib/antigravity-review-fixes5.test.js
 */
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  generateReleaseManifest,
  buildOwnershipLedger,
  _legacyInstallRelease: installRelease,
  _legacyRollbackRelease: rollbackRelease
} = require('../../scripts/lib/eccskills-distribution');
const { dedupeAgentDestinations, dedupeSkillDestinations } = require('../../scripts/lib/install-targets/antigravity-destinations');
const { writeWorkflowState, clearWorkflowState } = require('../../scripts/lib/workflow-state');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed += 1; }
  catch (error) { console.log(`  ✗ ${name}\n    ${error.message.split('\n')[0]}`); failed += 1; }
}
const TEMP_DIRS = [];
function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'antigravity-r5-'));
  TEMP_DIRS.push(dir);
  return dir;
}
function sha(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

function makeOps(root) {
  const out = [];
  for (const [rel, content] of [
    ['skills/opl-tdd/SKILL.md', '# opl-tdd\n'],
    ['agents/opl-code-reviewer.md', 'name: opl-code-reviewer\n']
  ]) {
    const src = path.join(root, 'src', rel);
    fs.mkdirSync(path.dirname(src), { recursive: true });
    fs.writeFileSync(src, content);
    out.push({
      sourcePath: src,
      sourceRelativePath: rel,
      destinationPath: path.join(root, 'proj', '.agents', rel)
    });
  }
  return out;
}

function runTests() {
  console.log('\n=== Round-5 review fixes ===\n');

  // R5-1 (CRITICAL 2): rollback must never overwrite when the managed key is absent.
  test('R5-1 rollback preserves a file whose managed key is missing', () => {
    const root = tmp();
    const m = generateReleaseManifest({ operations: makeOps(root), target: 'antigravity-cli' });
    const projectRoot = path.join(root, 'proj');
    const ledgerPath = path.join(projectRoot, '.agents', '.ecc-managed-manifest.json');
    const backupRoot = path.join(projectRoot, '.agents', '.ecc-backup');
    installRelease(m, { projectRoot, ledgerPath, backupRoot });

    const target = m.files[0].destinationPath;
    fs.writeFileSync(target, 'USER EDIT AFTER INSTALL\n');
    const userHash = sha(fs.readFileSync(target));

    // Simulate a ledger whose managed map lost the key (corruption / older format).
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    delete ledger.managed[Object.keys(ledger.managed)[0]];
    fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));

    rollbackRelease({ projectRoot, ledgerPath, backupRoot });
    assert.strictEqual(
      sha(fs.readFileSync(target)), userHash,
      'user file must not be overwritten when the managed key is gone'
    );
  });

  // R5-2 (HIGH 3): companion files must follow a relocated skill.
  test('R5-2 companion files relocate with their skill', () => {
    const root = tmp();
    const ops = [
      {
        sourcePath: path.join(root, 'x'),
        sourceRelativePath: '.opencode/commands/tdd.md',
        destinationPath: path.join(root, '.agents/skills/opl-tdd/SKILL.md'),
        contentTransform: 'antigravity-command-to-skill'
      },
      {
        sourcePath: path.join(root, 'y'),
        sourceRelativePath: 'skills/tdd-workflow/SKILL.md',
        destinationPath: path.join(root, '.agents/skills/opl-tdd/SKILL.md'),
        contentTransform: 'antigravity-skill-scaffold'
      },
      {
        sourcePath: path.join(root, 'z'),
        sourceRelativePath: 'skills/tdd-workflow/reference.md',
        destinationPath: path.join(root, '.agents/skills/opl-tdd/reference.md'),
        contentTransform: 'antigravity-skill-scaffold'
      }
    ];
    const deduped = dedupeSkillDestinations(ops);
    const dests = deduped.map(op => op.destinationPath.replace(/\\/g, '/'));
    const companion = dests.find(d => d.endsWith('reference.md'));
    assert.ok(companion, `companion file missing: ${dests.join(', ')}`);
    assert.ok(
      companion.includes('opl-tdd-tdd-workflow'),
      `companion must move with the relocated skill, got ${companion}`
    );
    assert.ok(
      !dests.some(d => d.endsWith('/opl-tdd/reference.md')),
      'companion must not stay under the orchestrator skill'
    );
  });

  // R5-3 (HIGH 4): committable artifacts must stay ASCII-safe.
  test('R5-3 artifact reports contain no emoji', () => {
    const repo = path.resolve(__dirname, '..', '..');
    const files = [
      'artifacts/minimal-release/CLOSURE-REPORT.md',
      'artifacts/minimal-release/FINAL-CLOSURE.md'
    ];
    const emoji = /[\u2139\u2705\u2714\u25B6]/;
    for (const rel of files) {
      const full = path.join(repo, rel);
      if (!fs.existsSync(full)) continue;
      const lines = fs.readFileSync(full, 'utf8').split('\n');
      lines.forEach((line, i) => {
        assert.ok(!emoji.test(line), `${rel}:${i + 1} contains an emoji: ${line.slice(0, 60)}`);
      });
    }
  });

  // R5-4 (MEDIUM 5): agent dedupe must be exercised with real agent operations.
  test('R5-4 agent dedupe is case-insensitive', () => {
    const root = tmp();
    const ops = [
      {
        sourceRelativePath: 'agents/code-reviewer.md',
        destinationPath: path.join(root, '.agents/agents/opl-code-reviewer/agent.md'),
        contentTransform: 'antigravity-agent-frontmatter-cli'
      },
      {
        sourceRelativePath: '.opencode/prompts/agents/code-reviewer.txt',
        destinationPath: path.join(root, '.agents/agents/OPL-CODE-REVIEWER/agent.md'),
        contentTransform: 'antigravity-prompt-to-agent'
      }
    ];
    const deduped = dedupeAgentDestinations(ops);
    assert.strictEqual(deduped.length, 1, `expected 1 op, got ${deduped.length}`);
    assert.strictEqual(deduped[0].contentTransform, 'antigravity-agent-frontmatter-cli');
  });

  // R5-5 (MEDIUM 6): runtime behaviour, not source text.
  test('R5-5 untagged clobber error names the conversation honestly', () => {
    const root = tmp();
    writeWorkflowState({
      projectRoot: root,
      runtime: 'antigravity-cli',
      state: { workflow: 'tdd', phase: 'red', conversationId: 'conv-1' }
    });
    assert.throws(
      () => writeWorkflowState({
        projectRoot: root,
        runtime: 'antigravity-cli',
        state: { workflow: 'tdd', phase: 'red' }
      }),
      (error) => /an untagged conversation/.test(error.message)
        && !/"undefined"/.test(error.message)
    );
    clearWorkflowState({ projectRoot: root, runtime: 'antigravity-cli' });
  });

  // R5-6 (LOW 7): a truncated anchor must announce itself.
  test('R5-6 truncated anchor parts are marked', () => {
    const { normalizeFeedbackItem } = require('../../scripts/lib/plan-canvas/sessions');
    const longSelector = '.x'.repeat(400); // 800 chars > 500
    const item = normalizeFeedbackItem(
      {
        kind: 'annotation',
        text: 'check this',
        anchor: { selector: longSelector, tag: 'div', snippet: 'ok' }
      },
      1
    );
    assert.ok(item, 'item should still be accepted');
    assert.strictEqual(item.anchor.selector.length, 500);
    assert.strictEqual(item.anchor.truncated, true, 'truncation must be recorded');
  });

  for (const dir of TEMP_DIRS) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

runTests();
