/**
 * Native design approval binding.
 *
 * A framework-native approval must name the preview the owner actually looked
 * at. Two cases only, per the closure directive: one successful native approval
 * and one stale tab. Legacy plain verdicts stay unchanged.
 *
 *   node tests/lib/plan-canvas-native-approval.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createSessionStore } = require('../../scripts/lib/plan-canvas/sessions');

const DIGEST_A = 'a'.repeat(64);
const DIGEST_B = 'b'.repeat(64);
const DESIGN_A = 'c'.repeat(64);
const DESIGN_B = 'd'.repeat(64);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  ok ${name}`); passed += 1; } catch (error) {
    console.log("  FAIL[" + name.slice(0,12) + "] " + error.message.split("\n")[0]);
    failed += 1;
  }
}

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-native-approval-'));
  const file = path.join(dir, 'section.md');
  fs.writeFileSync(file, '# Section\n');
  const store = createSessionStore({ stateDir: path.join(dir, 'state') });
  return { file, store };
}

function nativeMeta(revision, revisionDigest, designDigest) {
  return { section: 'hero', revision, revisionDigest, designDigest, dataMode: 'fixture', framework: 'react-vite' };
}

function verdict(meta, extra = {}) {
  return {
    kind: 'verdict',
    verdict: 'approve',
    section: meta.section,
    revision: meta.revision,
    revisionDigest: meta.revisionDigest,
    designDigest: meta.designDigest,
    timestamp: new Date().toISOString(),
    ...extra
  };
}

test('native approval carries the reviewed identity onto the item', () => {
  const { file, store } = fixture();
  const meta = nativeMeta('r1', DIGEST_A, DESIGN_A);
  store.open(file, { previewMode: 'framework-native', previewUrl: 'http://127.0.0.1:5199/', previewMeta: meta });
  const key = store.list()[0].key;

  const result = store.queueFeedback(key, [verdict(meta)]);
  assert.strictEqual(result.rejected.length, 0, 'no rejection');
  const { items } = store.takeFeedback(key);
  const [item] = items;
  assert.strictEqual(item.verdict, 'approve');
  assert.strictEqual(item.revision, 'r1');
  assert.strictEqual(item.revisionDigest, DIGEST_A);
  assert.strictEqual(item.designDigest, DESIGN_A);
});

test('a tab that booted on an older revision cannot approve the new one', () => {
  const { file, store } = fixture();
  const first = nativeMeta('r1', DIGEST_A, DESIGN_A);
  store.open(file, { previewMode: 'framework-native', previewMeta: first });
  const key = store.list()[0].key;

  // The preview moves on while the tab still shows r1.
  store.open(file, { previewMode: 'framework-native', previewMeta: nativeMeta('r2', DIGEST_B, DESIGN_B) });

  const result = store.queueFeedback(key, [verdict(first)]);
  assert.strictEqual(result.accepted.length, 0, 'stale verdict not accepted');
  assert.strictEqual(result.rejected[0].reason, 'STALE_REVISION');

  const fresh = nativeMeta('r2', DIGEST_B, DESIGN_B);
  const retry = store.queueFeedback(key, [verdict(fresh)]);
  assert.strictEqual(retry.accepted.length, 1, 'current revision is approvable');
});

test('an approval queued for r1 is dropped when r2 opens', () => {
  const { file, store } = fixture();
  const first = nativeMeta('r1', DIGEST_A, DESIGN_A);
  store.open(file, { previewMode: 'framework-native', previewMeta: first });
  const key = store.list()[0].key;
  store.queueFeedback(key, [verdict(first)]);

  store.open(file, { previewMode: 'framework-native', previewMeta: nativeMeta('r2', DIGEST_B, DESIGN_B) });
  assert.strictEqual(store.takeFeedback(key).status, 'waiting', 'stale queued approval is gone');
});

test('legacy sessions still accept a plain verdict', () => {
  const { file, store } = fixture();
  store.open(file);
  const key = store.list()[0].key;
  const result = store.queueFeedback(key, [{ kind: 'verdict', verdict: 'approve' }]);
  assert.strictEqual(result.accepted.length, 1);
  assert.strictEqual(result.rejected.length, 0);
});

test('AGY plan binding survives alongside the native preview identity', () => {
  const crypto = require('crypto');
  const { file, store } = fixture();
  const meta = nativeMeta('r1', DIGEST_A, DESIGN_A);
  const workspace = path.dirname(file);
  const { session } = store.open(file, {
    target: 'antigravity-cli',
    workspace,
    previewMode: 'framework-native',
    previewMeta: meta
  });
  const planDigest = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

  const result = store.queueFeedback(session.key, [{
    ...verdict(meta),
    workspace,
    session: session.key,
    planDigest
  }]);
  assert.strictEqual(result.rejected.length, 0, JSON.stringify(result.rejected));
  const { items } = store.takeFeedback(session.key);
  const [item] = items;
  assert.strictEqual(item.planDigest, planDigest, 'AGY plan digest preserved');
  assert.strictEqual(item.revisionDigest, DIGEST_A, 'revisionDigest names the reviewed preview');
  assert.strictEqual(item.previewRevisionDigest, undefined, 'no alias field: revisionDigest is the preview');

  const stale = store.queueFeedback(session.key, [{
    ...verdict(meta),
    workspace,
    session: session.key,
    planDigest: 'f'.repeat(64)
  }]);
  assert.strictEqual(stale.rejected[0].reason, 'STALE_PLAN');
});

test('switching to standalone drops the native preview identity', () => {
  const { file, store } = fixture();
  const meta = nativeMeta('r1', DIGEST_A, DESIGN_A);
  store.open(file, { previewMode: 'framework-native', previewUrl: 'http://127.0.0.1:5199/', previewMeta: meta });
  const key = store.list()[0].key;
  store.queueFeedback(key, [verdict(meta)]);

  const { session } = store.open(file, { previewMode: 'standalone-html' });
  assert.strictEqual(session.previewMode, 'standalone-html');
  assert.strictEqual(session.previewMeta, undefined, 'native meta must not survive the switch');
  assert.strictEqual(session.previewUrl, undefined, 'native preview url must not survive the switch');
  assert.strictEqual(store.takeFeedback(key).status, 'waiting', 'the queued native verdict is dropped');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
