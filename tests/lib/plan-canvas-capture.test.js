/**
 * Screenshot capture and content-state explorer.
 *
 * Adds no browser launch: the extraction helpers and the HTTP contract are
 * exercised here, and the real capture is proven in the browser run recorded in
 * the work-item evidence. Run with:
 *   node tests/lib/plan-canvas-capture.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const {
  VIEWPORTS,
  MAX_BATCH,
  draftItemsFromPending,
  readManifest,
  resolveEvidenceRoot,
  urlWithReviewContext,
  viewportFor
} = require('../../scripts/lib/plan-canvas/capture');
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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pc-capture-'));
}

function request(base, method, pathname, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const url = new URL(base + pathname);
    const req = http.request({
      hostname: url.hostname, port: url.port, path: url.pathname + url.search, method,
      headers: payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        let json = null;
        try { json = JSON.parse(buffer.toString('utf8')); } catch { /* binary */ }
        resolve({ status: res.statusCode, headers: res.headers, body: buffer, json });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function bootstrapOf(html) {
  const match = html.match(/<script id="pc-session" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(match, 'bootstrap script present');
  return JSON.parse(match[1]);
}

function sessionFile(dir, name) {
  // A `work-items/<item>/` parent is what makes the evidence root resolve
  // inside the temp tree instead of the repository's newest work item.
  const file = path.join(dir, 'work-items', 'WI-1', name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '# plan\n');
  return file;
}

const HEX = n => String(n).repeat(64).slice(0, 64);

(async () => {
  console.log('\n=== plan canvas: screenshot capture ===\n');

  await test('viewport presets expose the reviewed sizes with their real DPR', () => {
    assert.equal(VIEWPORTS.length, 5);
    const desktop = viewportFor('desktop-1440');
    assert.deepEqual([desktop.width, desktop.height, desktop.dpr], [1440, 900, 1]);
    const phone = viewportFor('mobile-390');
    assert.deepEqual([phone.width, phone.height, phone.dpr], [390, 844, 2]);
    assert.equal(viewportFor('nope'), null);
    assert.ok(MAX_BATCH >= VIEWPORTS.length);
  });

  await test('state and theme are requested through the app own parameter names', () => {
    const url = urlWithReviewContext('http://127.0.0.1:5199/stat-cards?tab=1', {
      state: 'empty', theme: 'dark', stateParam: 'scenario', themeParam: 'mode'
    });
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('scenario'), 'empty');
    assert.equal(parsed.searchParams.get('mode'), 'dark');
    assert.equal(parsed.searchParams.get('tab'), '1', 'existing query survives');
  });

  await test('no state means no query parameter is invented', () => {
    const url = urlWithReviewContext('http://127.0.0.1:5199/stat-cards', { stateParam: 'state' });
    assert.equal(new URL(url).search, '');
  });

  await test('draft overrides keep selector, prop and value only', () => {
    const items = draftItemsFromPending([
      { targetId: 'a', selector: '.stat-value', prop: 'color', value: '#111', extra: 'dropped' },
      { targetId: 'b', prop: 'color', value: '#222' },
      { targetId: 'c', selector: '.x', value: '1' }
    ]);
    assert.deepEqual(items, [{ selector: '.stat-value', prop: 'color', value: '#111' }]);
  });

  await test('evidence root follows the active work item, not the app source tree', () => {
    const root = path.join(tempDir(), 'work-items');
    const item = path.join(root, 'WI-1');
    assert.equal(resolveEvidenceRoot({ workItem: item }), path.join(item, 'evidence', 'design', 'captures'));
    const plan = path.join(item, 'plan', 'x.plan.md');
    fs.mkdirSync(path.dirname(plan), { recursive: true });
    fs.writeFileSync(plan, 'x');
    assert.equal(resolveEvidenceRoot({ planFile: plan }), path.join(item, 'evidence', 'design', 'captures'));
  });

  await test('a missing manifest reads as empty instead of throwing', () => {
    assert.deepEqual(readManifest(path.join(tempDir(), 'none')), { captures: [] });
  });

  // --- HTTP contract -------------------------------------------------------
  const store = createSessionStore({ dir: tempDir() });
  const canvas = createPlanCanvasServer({ store, idleTimeoutMs: 0 });
  const { port } = await canvas.listen(0);
  const base = `http://127.0.0.1:${port}`;
  const dir = tempDir();

  const nativeMeta = {
    section: '02-stat-cards', revision: 'r3', framework: 'react',
    revisionDigest: HEX('a'), designDigest: HEX('b'),
    stateParam: 'scenario',
    states: [
      { id: 'loading', label: 'Loading', value: 'loading' },
      { id: 'empty', label: 'Empty', value: 'empty' },
      { id: 'permission', label: 'Permission', value: null }
    ],
    themes: ['light', 'dark']
  };

  const native = store.open(sessionFile(dir, 'native.plan.md'), {
    reopen: true,
    previewMode: 'framework-native',
    previewUrl: 'http://127.0.0.1:5199/stat-cards.html',
    previewMeta: nativeMeta
  }).session;

  const legacy = store.open(sessionFile(dir, 'legacy.plan.md'), { reopen: true }).session;

  await test('previewMeta declares states and the request parameter names', () => {
    assert.equal(native.previewMeta.stateParam, 'scenario');
    assert.deepEqual(native.previewMeta.states.map(s => s.id), ['loading', 'empty', 'permission']);
    assert.equal(native.previewMeta.states[2].value, null, 'unavailable keeps its null value');
    assert.deepEqual(native.previewMeta.themes, ['light', 'dark']);
  });

  await test('a state outside the declaration is refused, never substituted', async () => {
    const res = await request(base, 'POST', `/api/session/${native.key}/capture`, {
      mode: 'viewport', viewport: 'desktop-1440', state: 'ghost'
    });
    assert.equal(res.status, 409);
    assert.match(res.json.error, /not declared/);
  });

  await test('a state declared unavailable is refused explicitly', async () => {
    const res = await request(base, 'POST', `/api/session/${native.key}/capture`, {
      mode: 'viewport', viewport: 'desktop-1440', state: 'permission'
    });
    assert.equal(res.status, 409);
    assert.match(res.json.error, /unavailable/);
  });

  await test('a theme the preview did not declare is refused as well', async () => {
    const res = await request(base, 'POST', `/api/session/${native.key}/capture`, {
      mode: 'viewport', viewport: 'desktop-1440', theme: 'solarized'
    });
    assert.equal(res.status, 409);
    assert.match(res.json.error, /not declared/);
  });

  await test('an unknown viewport is refused before anything launches', async () => {
    const res = await request(base, 'POST', `/api/session/${native.key}/capture`, {
      mode: 'viewport', viewport: 'watch-99'
    });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /unknown viewport/);
  });

  await test('element capture without a selection is refused', async () => {
    const res = await request(base, 'POST', `/api/session/${native.key}/capture`, {
      mode: 'element', viewport: 'desktop-1440'
    });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /selector/);
  });

  await test('a session without a live preview cannot be captured', async () => {
    const res = await request(base, 'POST', `/api/session/${legacy.key}/capture`, {
      mode: 'viewport', viewport: 'desktop-1440'
    });
    assert.equal(res.status, 409);
    assert.match(res.json.error, /framework-native/);
  });

  await test('batch refuses a combination above the bound', async () => {
    const res = await request(base, 'POST', `/api/session/${native.key}/capture-batch`, {
      viewports: VIEWPORTS.map(v => v.id),
      states: ['loading', 'empty'],
      themes: ['light', 'dark'],
      modes: ['viewport', 'full', 'element']
    });
    assert.equal(res.status, 400);
    assert.match(res.json.error, new RegExp(String(MAX_BATCH)));
  });

  await test('the capture list starts empty and reports its root', async () => {
    const res = await request(base, 'GET', `/api/session/${native.key}/captures`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.json.captures, []);
    assert.match(res.json.root, /evidence\/design\/captures$/);
  });

  await test('cancelling an idle session reports nothing to cancel', async () => {
    const res = await request(base, 'POST', `/api/session/${native.key}/capture-cancel`, {});
    assert.equal(res.status, 200);
    assert.equal(res.json.cancelling, false);
  });

  await test('an unknown capture id 404s instead of reading an arbitrary path', async () => {
    const res = await request(base, 'GET', `/api/session/${native.key}/captures/cap-000000000000`);
    assert.equal(res.status, 404);
  });

  await test('a capture attaches through the existing Canvas V2 transport', async () => {
    const root = path.join(tempDir(), 'work-items', 'WI-1');
    fs.mkdirSync(path.join(root, 'plan'), { recursive: true });
    const plan = path.join(root, 'plan', 'x.plan.md');
    fs.writeFileSync(plan, '# plan\n');
    const session = store.open(plan, {
      reopen: true,
      previewMode: 'framework-native',
      previewUrl: 'http://127.0.0.1:5199/stat-cards.html',
      previewMeta: { section: 's', revision: 'r1', framework: 'react', revisionDigest: HEX('a'), designDigest: HEX('b') }
    }).session;
    const captures = path.join(root, 'evidence', 'design', 'captures', 's', 'r1', 'desktop-1440');
    fs.mkdirSync(captures, { recursive: true });
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex');
    const file = path.join(captures, 'x.png');
    fs.writeFileSync(file, png);
    fs.writeFileSync(path.join(root, 'evidence', 'design', 'captures', 'manifest.json'), JSON.stringify({
      captures: [{ id: 'cap-111111111111', file, sha256: require('crypto').createHash('sha256').update(png).digest('hex'), mode: 'viewport' }]
    }));

    const ok = await request(base, 'POST', `/api/session/${session.key}/captures/cap-111111111111/attach`);
    assert.equal(ok.status, 200);
    assert.equal(ok.json.ok, true);
    const stored = path.join(root, 'plan', ok.json.files[0]);
    assert.ok(fs.existsSync(stored), 'attachment lands beside the plan file');

    // A file that no longer hashes to its manifest pointer must not be attached.
    fs.writeFileSync(file, Buffer.from('tampered'));
    const bad = await request(base, 'POST', `/api/session/${session.key}/captures/cap-111111111111/attach`);
    assert.equal(bad.status, 409);
  });

  await test('the drawer offers only declared states and shows the unavailable one disabled', () => {
    const html = renderCanvasHtml(native);
    assert.ok(html.includes('id="shotDrawer"'), 'drawer renders for a live preview');
    assert.ok(html.includes('id="shotsBtn"'), 'toolbar control renders');
    assert.ok(html.includes('Empty</option>'));
    assert.match(html, /value="permission" disabled/, 'unavailable state is visible and disabled');
    const boot = bootstrapOf(html);
    assert.equal(boot.previewMeta.stateParam, 'scenario');
  });

  await test('a legacy session renders neither the control nor the drawer', () => {
    const html = renderCanvasHtml(legacy);
    assert.ok(!html.includes('id="shotDrawer"'));
    assert.ok(!html.includes('id="shotsBtn"'));
  });

  await canvas.close();

  console.log(`\n=== capture: ${passed} passed, ${failed} failed ===\n`);
  process.exitCode = failed ? 1 : 0;
})();
