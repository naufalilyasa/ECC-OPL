/**
 * Focused behavioural tests for the visual edit closure requirements.
 *
 * Run with: node tests/lib/plan-canvas-visual-edit-closure.test.js
 *
 * One test per reviewed scenario, split by where the behaviour actually lives:
 * the session store and change-set normalizer are invoked for real, the browser
 * code is asserted on the generated client source.
 */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { normalizeChangeSet } = require('../../scripts/lib/plan-canvas/change-set');
const { createSessionStore } = require('../../scripts/lib/plan-canvas/sessions');
const { editModeClientJs } = require('../../scripts/lib/plan-canvas/edit-mode');
const { artifactSdkJs } = require('../../scripts/lib/plan-canvas/sdk');

const js = editModeClientJs();
const sdk = artifactSdkJs();

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
    return false;
  }
}

const sha = seed => crypto.createHash('sha256').update(seed).digest('hex');
const R1 = sha('revision-1');
const R2 = sha('revision-2');
const DESIGN = sha('design-1');

function tempStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-closure-'));
  const artifact = path.join(dir, 'demo.plan.md');
  fs.writeFileSync(artifact, '# Plan\n');
  return createSessionStore({ stateDir: path.join(dir, 'state') });
}

function changeSet(key, mutate) {
  const base = {
    id: 'cs-1',
    version: 1,
    session: key,
    route: 'http://127.0.0.1:5199/pricing',
    preview: {
      mode: 'framework-native',
      framework: 'react',
      section: 'pricing',
      revision: 'r1',
      revisionDigest: R1,
      designDigest: DESIGN
    },
    viewport: { w: 1440, h: 900, dpr: 1 },
    scope: 'instance',
    targets: [
      {
        targetId: 'e1',
        selector: 'main > article:nth-of-type(1)',
        tag: 'article',
        testId: 'pricing-card',
        rect: { x: 120, y: 640, w: 345, h: 420 },
        edits: [{ prop: 'width', before: { computed: '320px' }, after: '300px', effective: true }]
      }
    ]
  };
  if (mutate) mutate(base);
  return base;
}

function rejectionOf(fn) {
  try {
    fn();
  } catch (error) {
    return error.code;
  }
  return null;
}

console.log('\n=== Testing visual edit closure ===\n');

if (test('1. one stale target does not clear another, and its overrides drop', () => {
  // Per-target set, not a single flag.
  assert.ok(js.includes('const staleTargets = new Set()'), 'stale tracked per target');
  assert.ok(js.includes('staleTargets.delete(msg.targetId)'), 'reselecting clears only itself');
  assert.ok(!js.includes('staleTargets.clear();\n        renderTarget'), 'no blanket clear');
  const targetsBlock = js.slice(js.indexOf("msg.type === 'pc:targets'"), js.indexOf("msg.type === 'pc:dom-changed'"));
  assert.ok(targetsBlock.includes('editPending = editPending.filter(r => r.targetId !== id)'),
    'overrides of a dead target are removed from the pending list');
  assert.ok(targetsBlock.includes('dropped'), 'the owner is told how many were dropped');
})) passed += 1; else failed += 1;

if (test('2. a retry reuses identity plus payload; a changed payload is a new request', () => {
  assert.ok(js.includes('const fingerprint = JSON.stringify(targets)'), 'payload is frozen');
  assert.ok(js.includes('editFrozen.fp !== fingerprint'), 'a different payload mints a new id');
  assert.ok(js.includes('clientId: editFrozen.id'), 'same id reused on an exact retry');
})) passed += 1; else failed += 1;

if (test('3. edits added while submitting survive the acknowledgement', () => {
  assert.ok(js.includes('const submittedKeys = targets.flatMap'), 'submitted keys are recorded');
  assert.ok(js.includes("keys: submittedKeys"), 'only those keys are cleared in the frame');
  assert.ok(js.includes('editPending = editPending.filter(r => !gone.has(editKey(r.targetId, r.prop)))'),
    'pending list is filtered, not emptied');
})) passed += 1; else failed += 1;

if (test('4. a reload during an in-flight override resets the editor state', () => {
  const readyBlock = js.slice(js.indexOf("msg.type === 'pc:ready'"), js.indexOf('undoBtn.addEventListener'));
  assert.ok(readyBlock.includes('editInFlight = 0'), 'in-flight counter reset');
  assert.ok(readyBlock.includes('editTarget = null'), 'dead selection dropped');
  assert.ok(readyBlock.includes('staleTargets.clear()'), 'stale marks reset for the new document');
  assert.ok(readyBlock.includes('editPending = []'), 'pending overrides cleared with the document');
})) passed += 1; else failed += 1;

if (test('5. the lifecycle moves submitted -> applying -> ready and blocks verdicts', () => {
  const store = tempStore();
  const { session } = store.open(path.join(os.tmpdir(), 'unused'), {
    previewMode: 'framework-native',
    previewMeta: { section: 'pricing', revision: 'r1', revisionDigest: R1, designDigest: DESIGN }
  });
  const queued = store.queueFeedback(session.key, [
    { kind: 'edits', clientId: 'c-1', changeSet: changeSet(session.key) }
  ]);
  assert.strictEqual(queued.accepted.length, 1, 'change set accepted');
  assert.strictEqual(queued.session.visualEdits.state, 'submitted');

  const blocked = store.queueFeedback(session.key, [{ kind: 'verdict', verdict: 'approved' }]);
  assert.strictEqual(blocked.rejected[0].reason, 'PENDING_EDITS', 'a queued edit blocks the verdict');

  const drained = store.takeFeedback(session.key);
  assert.ok(drained.items.some(item => item.kind === 'edits'), 'change set drained');
  assert.strictEqual(store.get(session.key).visualEdits.state, 'applying', 'agent is working');

  const applying = store.queueFeedback(session.key, [{ kind: 'verdict', verdict: 'approved' }]);
  assert.strictEqual(applying.rejected[0].reason, 'VISUAL_EDIT_UNRESOLVED', 'verdict waits for source');

  store.open(session.file, {
    previewMode: 'framework-native',
    previewMeta: { section: 'pricing', revision: 'r2', revisionDigest: R2, designDigest: DESIGN }
  });
  assert.strictEqual(store.get(session.key).visualEdits.state, 'ready', 'new digest means source rendered');
})) passed += 1; else failed += 1;

if (test('5b. an agent reply that does not move the digest marks the change failed', () => {
  const store = tempStore();
  const { session } = store.open(path.join(os.tmpdir(), 'unused'), {
    previewMode: 'framework-native',
    previewMeta: { section: 'pricing', revision: 'r1', revisionDigest: R1, designDigest: DESIGN }
  });
  store.queueFeedback(session.key, [{ kind: 'edits', clientId: 'c-1', changeSet: changeSet(session.key) }]);
  store.takeFeedback(session.key);
  store.addAgentReply(session.key, 'Applied the change.');
  assert.strictEqual(store.get(session.key).visualEdits.state, 'failed');
  const blocked = store.queueFeedback(session.key, [{ kind: 'verdict', verdict: 'approved' }]);
  assert.strictEqual(blocked.rejected[0].reason, 'VISUAL_EDIT_UNRESOLVED', 'unresolved change still blocks');
})) passed += 1; else failed += 1;

if (test('6. a native edit must bind section, revision, digest and design', () => {
  const live = {
    key: 'abcdef123456',
    previewMode: 'framework-native',
    previewMeta: { section: 'pricing', revision: 'r1', revisionDigest: R1, designDigest: DESIGN }
  };
  assert.strictEqual(rejectionOf(() => normalizeChangeSet(changeSet('abcdef123456'), live)), null,
    'fully bound edit is accepted');
  assert.strictEqual(rejectionOf(() => normalizeChangeSet(changeSet('abcdef123456', cs => {
    cs.preview.revisionDigest = undefined;
  }), live)), 'STALE_REVISION', 'no digest has nothing to bind to');
  assert.strictEqual(rejectionOf(() => normalizeChangeSet(changeSet('abcdef123456', cs => {
    cs.preview.section = 'checkout';
  }), live)), 'SECTION_MISMATCH');
  assert.strictEqual(rejectionOf(() => normalizeChangeSet(changeSet('abcdef123456', cs => {
    cs.preview.revision = 'r9';
  }), live)), 'REVISION_MISMATCH');
  assert.strictEqual(rejectionOf(() => normalizeChangeSet(changeSet('abcdef123456', cs => {
    cs.preview.designDigest = sha('other-design');
  }), live)), 'DESIGN_MISMATCH');
  assert.strictEqual(rejectionOf(() => normalizeChangeSet(changeSet('abcdef123456'), {
    ...live,
    previewMeta: { section: 'pricing', revision: 'r1' }
  })), 'MISSING_REVISION', 'a session with no live digest cannot accept edits');
})) passed += 1; else failed += 1;

if (test('7. reset and apply leave no editor-owned styling behind', () => {
  const resetBody = sdk.slice(sdk.indexOf('function resetAll'), sdk.indexOf('function probeTarget'));
  assert.ok(resetBody.includes("removeAttribute('data-ecc-edit')"), 'marker removed');
  assert.ok(resetBody.includes('quietTargets.delete(targetId)'), 'quieting removed');
  assert.ok(sdk.includes('const quiet = quietTargets.has(targetId)'), 'the quieting rule is only emitted while quieting');
})) passed += 1; else failed += 1;

if (test('8. the inspector exposes real controls per property kind', () => {
  assert.ok(js.includes("kind: 'length', min: 0, max: 1600, step: 1, unit: 'px'"), 'sized slider');
  assert.ok(js.includes("kind: 'color'"), 'colour picker');
  assert.ok(js.includes("kind: 'select', options: ['none', 'solid', 'dashed', 'dotted']"), 'enum control');
  assert.ok(js.includes("range.type = 'range'"), 'slider element');
  assert.ok(js.includes("['px', 'rem', 'em', '%', 'auto']"), 'unit select');
  assert.ok(js.includes("picker.type = 'color'"), 'native colour input');
  assert.ok(js.includes('edit-advanced'), 'raw CSS kept as an advanced group');
  assert.ok(js.includes('edit-row-label'), 'each control has a visible label');
})) passed += 1; else failed += 1;

console.log(`\nPassed: ${passed}, Failed: ${failed}`);
process.exitCode = failed > 0 ? 1 : 0;
