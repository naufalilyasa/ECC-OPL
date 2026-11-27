/**
 * Phase 2 — native preview mode in Plan Canvas.
 *
 * Addition only: a session without preview fields must behave exactly as
 * before, and a framework-native session must frame the project dev server
 * without proxying it. Run with:
 *   node tests/lib/plan-canvas-preview-mode.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const { createSessionStore } = require('../../scripts/lib/plan-canvas/sessions');
const { renderCanvasHtml } = require('../../scripts/lib/plan-canvas/ui');
const { createPlanCanvasServer } = require('../../scripts/lib/plan-canvas/server');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try { await fn(); console.log(`  ok ${name}`); passed += 1; }
  catch (error) { console.log(`  FAIL ${name}\n    ${error.message.split('\n')[0]}`); failed += 1; }
}

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pc-preview-'));
}

function bootstrapOf(html) {
  const match = html.match(/<script id="pc-session" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(match, 'bootstrap script present');
  return JSON.parse(match[1]);
}

function get(base, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get(base + pathname, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
  });
}

(async () => {
  console.log('\n=== plan canvas: native preview mode ===\n');

  const preview = {
    previewMode: 'framework-native',
    previewUrl: 'http://127.0.0.1:5199/',
    previewMeta: { section: '01-app-shell', revision: 'r3', framework: 'react' }
  };

  await test('preview fields survive a store reload', () => {
    const stateDir = tempDir();
    const file = path.join(stateDir, 'section.html');
    fs.writeFileSync(file, '<p>legacy</p>');
    const store = createSessionStore({ stateDir });
    const { session } = store.open(file, preview);
    assert.equal(session.previewMode, 'framework-native');
    assert.equal(session.previewUrl, 'http://127.0.0.1:5199/');
    assert.deepEqual(session.previewMeta, preview.previewMeta);

    const reloaded = createSessionStore({ stateDir }).get(session.key);
    assert.equal(reloaded.previewMode, 'framework-native');
    assert.equal(reloaded.previewUrl, 'http://127.0.0.1:5199/');
    assert.equal(reloaded.previewMeta.section, '01-app-shell');
  });

  await test('no preview fields leaves the legacy session shape', () => {
    const stateDir = tempDir();
    const file = path.join(stateDir, 'plan.md');
    fs.writeFileSync(file, '# Plan\n');
    const { session } = createSessionStore({ stateDir }).open(file);
    assert.equal('previewMode' in session, false);
    assert.equal('previewUrl' in session, false);
    assert.equal('previewMeta' in session, false);
  });

  await test('non-http preview URLs are refused', () => {
    const stateDir = tempDir();
    const file = path.join(stateDir, 'plan.md');
    fs.writeFileSync(file, '# Plan\n');
    const { session } = createSessionStore({ stateDir }).open(file, {
      previewMode: 'framework-native',
      previewUrl: 'javascript:alert(1)',
      previewMeta: { section: 'x' }
    });
    assert.equal(session.previewMode, 'framework-native');
    assert.equal('previewUrl' in session, false);
  });

  await test('standalone-html keeps the mode but never stores a URL', () => {
    const stateDir = tempDir();
    const file = path.join(stateDir, 'section.html');
    fs.writeFileSync(file, '<p>html</p>');
    const { session } = createSessionStore({ stateDir }).open(file, {
      previewMode: 'standalone-html',
      previewUrl: 'http://127.0.0.1:5199/'
    });
    assert.equal(session.previewMode, 'standalone-html');
    assert.equal('previewUrl' in session, false);
  });

  await test('native canvas payload carries mode chip and open-separately', () => {
    const dir = tempDir();
    const file = path.join(dir, 'section.html');
    fs.writeFileSync(file, '<p>legacy</p>');
    const { session } = createSessionStore({ stateDir: dir }).open(file, preview);
    const html = renderCanvasHtml(session);
    assert.ok(html.includes('id="modeChip"'));
    assert.ok(html.includes('framework-native · 01-app-shell · r3'));
    assert.ok(html.includes('id="openSeparate"'));
    assert.ok(html.includes('href="http://127.0.0.1:5199/"'));
    const boot = bootstrapOf(html);
    assert.equal(boot.previewMode, 'framework-native');
    assert.equal(boot.previewUrl, 'http://127.0.0.1:5199/');
    assert.equal(boot.previewMeta.section, '01-app-shell');
  });

  await test('legacy canvas payload has no preview chrome', () => {
    const dir = tempDir();
    const file = path.join(dir, 'plan.md');
    fs.writeFileSync(file, '# Plan\n');
    const { session } = createSessionStore({ stateDir: dir }).open(file);
    const html = renderCanvasHtml(session);
    assert.ok(!html.includes('id="modeChip"'));
    assert.ok(!html.includes('id="openSeparate"'));
    const boot = bootstrapOf(html);
    assert.equal('previewMode' in boot, false);
    assert.equal('previewUrl' in boot, false);
    assert.deepEqual(boot.chat, []);
  });

  const stateDir = tempDir();
  const legacyFile = path.join(stateDir, 'legacy.html');
  fs.writeFileSync(legacyFile, '<p>legacy content</p>');
  const nativeFile = path.join(stateDir, 'native.html');
  fs.writeFileSync(nativeFile, '<p>should not be served</p>');
  const store = createSessionStore({ stateDir });
  const legacy = store.open(legacyFile).session;
  const native = store.open(nativeFile, preview).session;

  const canvas = createPlanCanvasServer({ store, idleTimeoutMs: 0 });
  const port = await canvas.listen(0);
  const base = `http://127.0.0.1:${canvas.server.address().port}`;

  try {
    await test('native artifact route serves the dev-server wrapper', async () => {
      const res = await get(base, `/artifact/${native.key}/`);
      assert.equal(res.status, 200);
      assert.equal(res.headers['content-security-policy'],
        "default-src 'none'; style-src 'unsafe-inline'; frame-src http://127.0.0.1:5199");
      assert.ok(res.body.includes('src="http://127.0.0.1:5199/"'));
      assert.ok(res.body.includes('Open separately'));
      assert.ok(res.body.includes('01-app-shell'));
      assert.ok(!res.body.includes('should not be served'));
    });

    await test('native session has no sibling assets to serve', async () => {
      const res = await get(base, `/artifact/${native.key}/style.css`);
      assert.equal(res.status, 404);
    });

    await test('legacy artifact route still serves the file itself', async () => {
      const res = await get(base, `/artifact/${legacy.key}/`);
      assert.equal(res.status, 200);
      assert.ok(res.body.includes('legacy content'));
      assert.ok(!res.body.includes('Open separately'));
    });
  } finally {
    await canvas.close();
    fs.rmSync(stateDir, { recursive: true, force: true });
  }

  console.log(`\nPassed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exitCode = 1;
})();
