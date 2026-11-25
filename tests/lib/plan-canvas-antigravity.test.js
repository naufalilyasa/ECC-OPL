/**
 * Tests for Antigravity CLI Plan Canvas integration.
 *
 * Contract (master plan A3): strict verdict binding for `antigravity-cli`
 * targets only, stale revision rejection, Canvas V2 prompt/attachment limits,
 * and `/opl-plan` command projection. OpenCode legacy verdict path is intact.
 *
 * Run with: node tests/lib/plan-canvas-antigravity.test.js
 */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  ALLOWED_ATTACHMENT_MIMES,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  MAX_PROMPT_CHARS,
  attachmentFilename,
  computePlanDigest,
  isValidPromptLength,
  validateAttachments,
  validateBoundVerdict
} = require('../../scripts/lib/plan-canvas/verdict-binding');
const { createSessionStore } = require('../../scripts/lib/plan-canvas/sessions');
const antigravityCliAdapter = require('../../scripts/lib/install-targets/antigravity-cli');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${error.message}`);
    failed += 1;
  }
}

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-canvas-agy-'));
  const file = path.join(dir, 'plan.md');
  fs.writeFileSync(file, '# Plan v1\n');
  return {
    dir,
    file,
    digest: computePlanDigest(file),
    store: createSessionStore({ stateDir: path.join(dir, 'state') })
  };
}

function boundVerdict(overrides = {}, f) {
  return {
    kind: 'verdict',
    verdict: 'approve',
    revisionDigest: f.digest,
    workspace: f.dir,
    session: 'abc123def456',
    timestamp: new Date().toISOString(),
    ...overrides
  };
}

function runTests() {
  console.log('\n=== Testing Antigravity CLI Plan Canvas (Phase A3) ===\n');

  const f = fixture();

  test('computePlanDigest is stable sha256 of file content', () => {
    assert.match(f.digest, /^[a-f0-9]{64}$/);
    assert.strictEqual(computePlanDigest(f.file), f.digest);
    fs.writeFileSync(f.file, '# Plan v2\n');
    assert.notStrictEqual(computePlanDigest(f.file), f.digest);
    fs.writeFileSync(f.file, '# Plan v1\n');
  });

  test('strict verdict accepts exact bound approve', () => {
    const result = validateBoundVerdict(boundVerdict({}, f), {
      workspace: f.dir,
      session: 'abc123def456',
      revisionDigest: f.digest
    });
    assert.deepStrictEqual(result, { ok: true, verdict: 'approve' });
  });

  test('strict verdict rejects plain legacy verdict (no binding)', () => {
    const result = validateBoundVerdict({ kind: 'verdict', verdict: 'approve' }, {
      workspace: f.dir,
      session: 'abc123def456',
      revisionDigest: f.digest
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'MISSING_BINDING');
  });

  test('strict verdict rejects chat prose and host proceed buttons', () => {
    for (const raw of [
      { kind: 'chat', text: 'I approve the plan' },
      { kind: 'verdict', verdict: 'approve', source: 'native-button' },
      'approve'
    ]) {
      const result = validateBoundVerdict(raw, {
        workspace: f.dir,
        session: 'abc123def456',
        revisionDigest: f.digest
      });
      assert.strictEqual(result.ok, false, JSON.stringify(raw));
    }
  });

  test('strict verdict rejects workspace/session/digest mismatch', () => {
    const ctx = { workspace: f.dir, session: 'abc123def456', revisionDigest: f.digest };
    assert.strictEqual(validateBoundVerdict(boundVerdict({ workspace: '/elsewhere' }, f), ctx).reason, 'WORKSPACE_MISMATCH');
    assert.strictEqual(validateBoundVerdict(boundVerdict({ session: 'other' }, f), ctx).reason, 'SESSION_MISMATCH');
    assert.strictEqual(validateBoundVerdict(boundVerdict({ revisionDigest: 'deadbeef' }, f), ctx).reason, 'STALE_REVISION');
  });

  test('strict verdict rejects invalid timestamp and unsupported verdict', () => {
    const ctx = { workspace: f.dir, session: 'abc123def456', revisionDigest: f.digest };
    assert.strictEqual(validateBoundVerdict(boundVerdict({ timestamp: 'not-a-date' }, f), ctx).reason, 'INVALID_TIMESTAMP');
    assert.strictEqual(validateBoundVerdict(boundVerdict({ verdict: 'maybe' }, f), ctx).reason, 'UNSUPPORTED_VERDICT');
  });

  test('legacy OpenCode store still accepts plain verdict unchanged', () => {
    const store = createSessionStore({ stateDir: path.join(f.dir, 'legacy-state') });
    store.open(f.file);
    const key = store.findByFile(f.file).key;
    const result = store.queueFeedback(key, [{ kind: 'verdict', verdict: 'approve' }]);
    assert.strictEqual(result.accepted.length, 1);
    assert.strictEqual(result.accepted[0].verdict, 'approve');
  });

  test('agy-target store queues bound verdict and rejects plain verdict', () => {
    const store = createSessionStore({ stateDir: path.join(f.dir, 'agy-state') });
    store.open(f.file, {
      target: 'antigravity-cli',
      sessionDir: path.join(f.dir, 'canvas'),
      workspace: f.dir
    });
    const key = store.findByFile(f.file).key;
    const accepted = store.queueFeedback(key, [boundVerdict({ session: key }, f)]);
    assert.strictEqual(accepted.accepted.length, 1);
    const rejected = store.queueFeedback(key, [{ kind: 'verdict', verdict: 'approve' }]);
    assert.strictEqual(rejected.accepted.length, 0);
    assert.strictEqual(rejected.rejected[0].reason, 'MISSING_BINDING');
  });

  test('agy-target store flags STALE_REVISION after plan file changes', () => {
    const store = createSessionStore({ stateDir: path.join(f.dir, 'stale-state') });
    store.open(f.file, {
      target: 'antigravity-cli',
      sessionDir: path.join(f.dir, 'canvas'),
      workspace: f.dir
    });
    const key = store.findByFile(f.file).key;
    fs.writeFileSync(f.file, '# Plan edited after load\n');
    const result = store.queueFeedback(key, [boundVerdict({ session: key }, f)]);
    assert.strictEqual(result.accepted.length, 0);
    assert.strictEqual(result.rejected[0].reason, 'STALE_REVISION');
    fs.writeFileSync(f.file, '# Plan v1\n');
  });

  test('Canvas V2 prompt length limit is 100000 chars', () => {
    assert.strictEqual(MAX_PROMPT_CHARS, 100000);
    assert.strictEqual(isValidPromptLength('x'.repeat(100000)), true);
    assert.strictEqual(isValidPromptLength('x'.repeat(100001)), false);
    assert.strictEqual(isValidPromptLength(null), false);
  });

  test('Canvas V2 attachments validate MIME and size', () => {
    assert.deepStrictEqual(Object.keys(ALLOWED_ATTACHMENT_MIMES).sort(), ['image/jpeg', 'image/png', 'image/webp']);
    assert.strictEqual(MAX_ATTACHMENT_BYTES, 10 * 1024 * 1024);
    assert.strictEqual(MAX_ATTACHMENTS, 5);
    const png = { mime: 'image/png', data: Buffer.from('89504e470d0a1a0a', 'hex') };
    assert.strictEqual(validateAttachments([png]).ok, true);
    assert.strictEqual(validateAttachments([{ mime: 'application/pdf', data: Buffer.from('x') }]).reason, 'INVALID_MIME');
    assert.strictEqual(validateAttachments([{ mime: 'image/png', data: Buffer.alloc(MAX_ATTACHMENT_BYTES + 1) }]).reason, 'TOO_LARGE');
    assert.strictEqual(validateAttachments(Array.from({ length: 6 }, () => png)).reason, 'COUNT_EXCEEDED');
  });

  test('attachment filename is content-addressed sha256.ext', () => {
    const data = Buffer.from('sample-image');
    const name = attachmentFilename(data, 'image/png');
    assert.strictEqual(name, `${crypto.createHash('sha256').update(data).digest('hex')}.png`);
  });

  test('plan commands project to /opl-plan and /opl-plan-prd', () => {
    const adapter = antigravityCliAdapter;
    const ops = adapter.planOperations(
      {
        modules: [{
          id: 'core',
          paths: ['commands/plan.md', 'commands/plan-prd.md']
        }],
        projectRoot: f.dir
      },
      adapter
    );
    const destinations = ops.map(op => op.destinationPath.replace(/\\/g, '/'));
    assert.ok(destinations.some(p => p.endsWith('/skills/opl-plan/SKILL.md')), destinations.join(', '));
    assert.ok(destinations.some(p => p.endsWith('/skills/opl-plan-prd/SKILL.md')), destinations.join(', '));
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

runTests();
