/**
 * Tests for scripts/lib/plan-canvas/change-set.js
 *
 * Run with: node tests/lib/plan-canvas-change-set.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  normalizeChangeSet,
  summarizeEdit
} = require('../../scripts/lib/plan-canvas/change-set');
const { createSessionStore } = require('../../scripts/lib/plan-canvas/sessions');

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

function changes(mutate) {
  const base = {
    id: 'cs-1',
    version: 1,
    session: 'abcdef123456',
    route: 'http://127.0.0.1:5199/pricing',
    preview: { mode: 'framework-native', framework: 'react', revision: 'r2', revisionDigest: 'digest-a' },
    viewport: { w: 1440, h: 900, dpr: 1 },
    scope: 'instance',
    targets: [
      {
        targetId: 'e1',
        selector: 'main > article:nth-of-type(1)',
        tag: 'article',
        testId: 'pricing-card',
        name: 'MOST POPULAR',
        rect: { x: 120, y: 640, w: 345, h: 420 },
        edits: [{ prop: 'width', before: { computed: '345px' }, after: '320px', unit: 'px', rendered: '320px' }]
      }
    ]
  };
  if (mutate) mutate(base);
  return base;
}

function code(fn) {
  try {
    fn();
  } catch (error) {
    return error.code;
  }
  return null;
}

const liveSession = {
  key: 'abcdef123456',
  previewMode: 'framework-native',
  previewMeta: { revision: 'r2', revisionDigest: 'digest-a' }
};

function runTests() {
  console.log('\n=== Testing plan-canvas change-set.js ===\n');

  let passed = 0;
  let failed = 0;

  console.log('Normalization:');

  if (test('a valid multi-target set normalizes', () => {
    const raw = changes(cs => {
      cs.targets.push({
        targetId: 'e2',
        selector: '#cta',
        rect: { x: 10, y: 20, w: 100, h: 40 },
        edits: [{ prop: 'background-color', after: 'var(--bg-raised)', token: '--bg-raised', tokenOrigin: 'authored' }]
      });
    });
    const set = normalizeChangeSet(raw, liveSession);
    assert.strictEqual(set.id, 'cs-1');
    assert.strictEqual(set.targets.length, 2);
    assert.strictEqual(set.targets[0].rect.w, 345);
    assert.strictEqual(set.targets[1].edits[0].token, '--bg-raised');
    assert.strictEqual(set.targets[1].edits[0].tokenOrigin, 'authored');
  })) passed++; else failed++;

  if (test('token-less edits store token null', () => {
    const set = normalizeChangeSet(changes(), liveSession);
    assert.strictEqual(set.targets[0].edits[0].token, null);
  })) passed++; else failed++;

  if (test('no breakpoint is invented from viewport width', () => {
    const set = normalizeChangeSet(changes(), liveSession);
    assert.strictEqual(set.breakpoint, null);
  })) passed++; else failed++;

  console.log('\nRejections:');

  if (test('unknown property is rejected, not dropped', () => {
    assert.strictEqual(code(() => normalizeChangeSet(changes(cs => {
      cs.targets[0].edits[0].prop = 'transform';
    }), liveSession)), 'INVALID_PROP');
  })) passed++; else failed++;

  if (test('a value that would break the rule is rejected', () => {
    assert.strictEqual(code(() => normalizeChangeSet(changes(cs => {
      cs.targets[0].edits[0].after = 'red } body { display: none';
    }), liveSession)), 'INVALID_VALUE');
  })) passed++; else failed++;

  if (test('a missing changeSet.id is rejected', () => {
    assert.strictEqual(code(() => normalizeChangeSet(changes(cs => { delete cs.id; }), liveSession)), 'MISSING_CHANGE_SET_ID');
  })) passed++; else failed++;

  if (test('a change set for another session is rejected', () => {
    assert.strictEqual(code(() => normalizeChangeSet(changes(), { ...liveSession, key: 'zzzzzzzzzzzz' })), 'STALE_SESSION');
  })) passed++; else failed++;

  if (test('a stale preview revision is rejected', () => {
    assert.strictEqual(code(() => normalizeChangeSet(changes(cs => {
      cs.preview.revisionDigest = 'digest-old';
    }), liveSession)), 'STALE_REVISION');
  })) passed++; else failed++;

  if (test('standalone-html has no revision to compare', () => {
    const set = normalizeChangeSet(changes(cs => {
      cs.preview = { mode: 'standalone-html' };
    }), { key: 'abcdef123456', previewMode: 'standalone-html' });
    assert.strictEqual(set.preview.mode, 'standalone-html');
  })) passed++; else failed++;

  if (test('non-instance scope needs explicit owner confirmation', () => {
    assert.strictEqual(code(() => normalizeChangeSet(changes(cs => { cs.scope = 'section'; }), liveSession)), 'SCOPE_UNCONFIRMED');
    const set = normalizeChangeSet(changes(cs => { cs.scope = 'section'; cs.scopeConfirmedBy = 'owner'; }), liveSession);
    assert.strictEqual(set.scope, 'section');
    assert.strictEqual(set.scopeConfirmedBy, 'owner');
  })) passed++; else failed++;

  if (test('free-form sourceHint is rejected; data-ecc-source wins', () => {
    assert.strictEqual(code(() => normalizeChangeSet(changes(cs => {
      cs.targets[0].sourceHint = 'somewhere in the hero';
    }), liveSession)), 'INVALID_SOURCE_HINT');
    const set = normalizeChangeSet(changes(cs => {
      cs.targets[0].sourceHint = 'src/sections/Hero.tsx:42:7';
    }), liveSession);
    assert.strictEqual(set.targets[0].sourceHint, 'src/sections/Hero.tsx:42:7');
  })) passed++; else failed++;

  if (test('an empty target list is rejected', () => {
    assert.strictEqual(code(() => normalizeChangeSet(changes(cs => { cs.targets = []; }), liveSession)), 'MISSING_TARGETS');
  })) passed++; else failed++;

  if (test('more than 500 edits is rejected', () => {
    assert.strictEqual(code(() => normalizeChangeSet(changes(cs => {
      cs.targets[0].edits = Array.from({ length: 501 }, () => ({ prop: 'opacity', after: '0.5' }));
    }), liveSession)), 'TOO_MANY_EDITS');
  })) passed++; else failed++;

  if (test('null input throws a coded error, not a TypeError', () => {
    assert.strictEqual(code(() => normalizeChangeSet(null, liveSession)), 'INVALID_CHANGE_SET');
  })) passed++; else failed++;

  console.log('\nSummary line:');

  if (test('summarizeEdit names the element and properties', () => {
    const set = normalizeChangeSet(changes(), liveSession);
    const line = summarizeEdit(set);
    assert.match(line, /1 element/);
    assert.match(line, /width/);
  })) passed++; else failed++;

  console.log('\nSession store:');

  if (test('an edits item is accepted and a repeat is refused', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-canvas-cs-'));
    const artifact = path.join(dir, 'demo.plan.md');
    fs.writeFileSync(artifact, '# Plan\n');
    const store = createSessionStore({ stateDir: path.join(dir, 'state') });
    const { session } = store.open(artifact, {
      previewMode: 'framework-native',
      previewMeta: { revision: 'r2', revisionDigest: 'digest-a' }
    });
    const item = { kind: 'edits', clientId: 'c-1', changeSet: changes(cs => { cs.session = session.key; }) };

    const first = store.queueFeedback(session.key, [item]);
    assert.strictEqual(first.accepted.length, 1);
    assert.strictEqual(first.accepted[0].kind, 'edits');
    assert.match(first.accepted[0].text, /Visual edits/);

    const again = store.queueFeedback(session.key, [item]);
    assert.strictEqual(again.accepted.length, 0);
    assert.strictEqual(again.rejected[0].reason, 'DUPLICATE_CHANGE_SET');
    assert.strictEqual(again.rejected[0].id, 'c-1');
  })) passed++; else failed++;

  if (test('a rejected edit reports its code and client id', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-canvas-cs-'));
    const artifact = path.join(dir, 'demo.plan.md');
    fs.writeFileSync(artifact, '# Plan\n');
    const store = createSessionStore({ stateDir: path.join(dir, 'state') });
    const { session } = store.open(artifact, {
      previewMode: 'framework-native',
      previewMeta: { revision: 'r2', revisionDigest: 'digest-a' }
    });
    const bad = {
      kind: 'edits',
      clientId: 'c-9',
      changeSet: changes(cs => {
        cs.session = session.key;
        cs.targets[0].edits[0].prop = 'float';
      })
    };
    const result = store.queueFeedback(session.key, [bad]);
    assert.strictEqual(result.accepted.length, 0);
    assert.strictEqual(result.rejected[0].reason, 'INVALID_PROP');
    assert.strictEqual(result.rejected[0].id, 'c-9');
  })) passed++; else failed++;

  if (test('a token claim must arrive with its origin', () => {
    const raw = changes();
    raw.targets[0].edits[0].token = '--brand';
    raw.targets[0].edits[0].tokenOrigin = 'coincidental';
    assert.strictEqual(code(() => normalizeChangeSet(raw, liveSession)), 'INVALID_TOKEN_ORIGIN');
    raw.targets[0].edits[0].tokenOrigin = 'authored';
    const ok = normalizeChangeSet(raw, liveSession);
    assert.strictEqual(ok.targets[0].edits[0].tokenOrigin, 'authored');
  })) passed++; else failed++;

  if (test('a non-string scope is refused instead of coerced', () => {
    const raw = changes(cs => { cs.scope = 123; });
    assert.strictEqual(code(() => normalizeChangeSet(raw, liveSession)), 'INVALID_SCOPE');
  })) passed++; else failed++;

  if (test('the client cannot downgrade the session preview mode', () => {
    const raw = changes(cs => { cs.preview = { mode: 'standalone-html' }; });
    assert.strictEqual(code(() => normalizeChangeSet(raw, liveSession)), 'PREVIEW_MODE_MISMATCH');
  })) passed++; else failed++;

  if (test('a source hint cannot point outside the repo', () => {
    const raw = changes();
    raw.targets[0].sourceHint = '../../etc/passwd:1:1';
    assert.strictEqual(code(() => normalizeChangeSet(raw, liveSession)), 'INVALID_SOURCE_HINT');
    raw.targets[0].sourceHint = '/etc/passwd:1:1';
    assert.strictEqual(code(() => normalizeChangeSet(raw, liveSession)), 'INVALID_SOURCE_HINT');
    raw.targets[0].sourceHint = 'src/styles/app.css:12:3';
    assert.strictEqual(normalizeChangeSet(raw, liveSession).targets.length, 1);
  })) passed++; else failed++;

  if (test('a verdict is refused while a change set is still queued', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-canvas-cs-'));
    const artifact = path.join(dir, 'demo.plan.md');
    fs.writeFileSync(artifact, '# Plan\n');
    const store = createSessionStore({ stateDir: path.join(dir, 'state') });
    const { session } = store.open(artifact, {
      previewMode: 'framework-native',
      previewMeta: { revision: 'r2', revisionDigest: 'digest-a' }
    });
    const edits = { kind: 'edits', clientId: 'c-1', changeSet: changes(cs => { cs.session = session.key; }) };
    assert.strictEqual(store.queueFeedback(session.key, [edits]).accepted.length, 1);
    // Same batch and a later batch both have to wait for source to exist.
    const together = store.queueFeedback(session.key, [
      { kind: 'edits', clientId: 'c-2', changeSet: changes(cs => { cs.id = 'cs-2'; cs.session = session.key; }) },
      { kind: 'verdict', verdict: 'approve' }
    ]);
    assert.strictEqual(together.rejected[0].reason, 'PENDING_EDITS');
    const alone = store.queueFeedback(session.key, [{ kind: 'verdict', verdict: 'approve' }]);
    assert.strictEqual(alone.rejected[0].reason, 'PENDING_EDITS');
  })) passed++; else failed++;

  console.log(`\nPassed: ${passed}`);
  console.log(`Failed: ${failed}`);
  return failed === 0;
}

if (require.main === module) {
  process.exitCode = runTests() ? 0 : 1;
}

module.exports = { runTests };
