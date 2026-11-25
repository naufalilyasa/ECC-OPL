/**
 * Regression guards for the code-review BLOCK findings on phases A0-A6.
 *
 * Run with: node tests/lib/antigravity-review-fixes2.test.js
 */
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const { renderCanvasHtml, canvasClientJs } = require('../../scripts/lib/plan-canvas/ui');
const { _legacyRollbackRelease: rollbackRelease, toPosixRelative } = require('../../scripts/lib/eccskills-distribution');
const { createSessionStore } = require('../../scripts/lib/plan-canvas/sessions');
const { createPlanCanvasServer } = require('../../scripts/lib/plan-canvas/server');
const { computePlanDigest } = require('../../scripts/lib/plan-canvas/verdict-binding');

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed += 1; }
  catch (error) { console.log(`  ✗ ${name}\n    ${error.message}`); failed += 1; }
}
function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'review-fix2-')); }
function sha(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

async function runTests() {
  console.log('\n=== Review fixes (A0-A6 BLOCK) ===\n');

  // CRITICAL #3 + HIGH #4 — rollback path handling
  await test('toPosixRelative normalizes Windows separators', () => {
    assert.strictEqual(toPosixRelative('skills\\opl-tdd\\SKILL.md'), 'skills/opl-tdd/SKILL.md');
    assert.strictEqual(toPosixRelative('skills/opl-tdd/SKILL.md'), 'skills/opl-tdd/SKILL.md');
  });

  await test('rollbackRelease honors explicit projectRoot even with nested ledgerPath', () => {
    const root = tmp();
    const projectRoot = path.join(root, 'deep', 'nested', 'proj');
    const ledgerPath = path.join(root, 'elsewhere', 'state', 'ledger.json');
    const backupRoot = path.join(root, 'backups');
    const stamp = path.join(backupRoot, 's1');
    fs.mkdirSync(stamp, { recursive: true });
    fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
    const orig = 'ORIGINAL MANAGED\n';
    const backupContent = 'PREVIOUS VERSION\n';
    fs.writeFileSync(path.join(stamp, 'managed.md'), backupContent);
    fs.mkdirSync(projectRoot, { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'managed.md'), orig);
    fs.writeFileSync(ledgerPath, JSON.stringify({
      format: 1, target: 'antigravity-cli', root: null,
      managed: { 'managed.md': sha(Buffer.from(orig)) },
      backupDir: stamp
    }));
    rollbackRelease({ projectRoot, ledgerPath, backupRoot });
    // Explicit root must receive the restored file; wrong fallback root leaves orig.
    assert.strictEqual(fs.readFileSync(path.join(projectRoot, 'managed.md'), 'utf8'), backupContent);
    assert.ok(!fs.existsSync(ledgerPath));
  });

  await test('rollback restores managed file when backup entry uses Windows separators', () => {
    const root = tmp();
    const projectRoot = path.join(root, 'proj');
    fs.mkdirSync(projectRoot, { recursive: true });
    const ledgerPath = path.join(projectRoot, '.agents', '.ecc-managed-manifest.json');
    fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
    const backupDir = path.join(projectRoot, '.agents', '.ecc-backup', 's1');
    fs.mkdirSync(backupDir, { recursive: true });
    const orig = 'ORIGINAL\n';
    const backupContent = 'PREVIOUS\n';
    // POSIX-valid filename containing literal backslashes simulates a Windows path entry.
    fs.writeFileSync(path.join(backupDir, 'skills\\opl-tdd\\SKILL.md'), backupContent);
    const targetRel = 'skills/opl-tdd/SKILL.md';
    const target = path.join(projectRoot, targetRel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, orig); // matches expected -> should be restored from backup
    fs.writeFileSync(ledgerPath, JSON.stringify({
      format: 1, target: 'antigravity-cli', root: projectRoot,
      managed: { [targetRel]: sha(Buffer.from(orig)) }, backupDir
    }));
    rollbackRelease({ projectRoot, ledgerPath, backupRoot: path.dirname(backupDir) });
    assert.strictEqual(fs.readFileSync(target, 'utf8'), backupContent);
  });

  // CRITICAL #2 — UI verdict binding for agy sessions
  await test('renderCanvasHtml bootstraps target/workspace/revisionDigest for agy session', () => {
    const root = tmp();
    const file = path.join(root, 'plan.md');
    fs.writeFileSync(file, '# Plan\n');
    const html = renderCanvasHtml({
      key: 'abc123def456', file, status: 'open', chat: [],
      target: 'antigravity-cli', workspace: root, sessionDir: path.join(root, 'canvas')
    });
    assert.ok(html.includes('"target":"antigravity-cli"'), 'target in bootstrap');
    assert.ok(html.includes('"workspace"'), 'workspace in bootstrap');
    assert.ok(html.includes('"revisionDigest"'), 'revisionDigest in bootstrap');
    assert.ok(html.includes(computePlanDigest(file)), 'digest value in bootstrap');
  });

  await test('client verdict helper emits bound fields for agy and plain for legacy', () => {
    const js = canvasClientJs();
    assert.ok(js.includes('makeVerdictItem'), 'makeVerdictItem present');
    assert.ok(js.includes('revisionDigest: boot.revisionDigest'), 'bound digest emitted');
    assert.ok(js.includes("boot.target === 'antigravity-cli'"), 'target-gated binding');
    assert.ok(js.includes("send([makeVerdictItem('approve')])"), 'approve uses helper');
    assert.ok(js.includes("send([makeVerdictItem('request-changes')])"), 'changes uses helper');
  });

  // CRITICAL #1 — /api/attachments containment + session binding
  await test('api/attachments rejects sessionDir outside workspace and unknown session', async () => {
    const root = tmp();
    const file = path.join(root, 'plan.md');
    fs.writeFileSync(file, '# Plan\n');
    const stateDir = path.join(root, 'state');
    const store = createSessionStore({ stateDir });
    const { session } = store.open(file, { target: 'antigravity-cli', workspace: root, sessionDir: path.join(root, 'canvas') });
    const canvas = createPlanCanvasServer({ store, host: '127.0.0.1', log: () => {} });
    const { port } = await canvas.listen(0);
    function post(body) {
      return new Promise((res, rej) => {
        const data = JSON.stringify(body);
        const req = http.request({ host: '127.0.0.1', port, path: '/api/attachments', method: 'POST', headers: { host: `127.0.0.1:${port}`, 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } }, resp => {
          let out = ''; resp.on('data', c => out += c); resp.on('end', () => res({ status: resp.statusCode, body: JSON.parse(out) }));
        });
        req.on('error', rej); req.end(data);
      });
    }
    const png = Buffer.from('89504e470d0a1a0a', 'hex').toString('base64');
    try {
      const outside = await post({ sessionKey: session.key, sessionDir: path.join(root, '..', 'evil'), workspace: root, items: [{ mime: 'image/png', data: png }] });
      assert.strictEqual(outside.status, 403, 'outside workspace rejected');
      const unknown = await post({ sessionKey: 'deadbeef1234', sessionDir: path.join(root, 'canvas'), workspace: root, items: [{ mime: 'image/png', data: png }] });
      assert.strictEqual(unknown.status, 404, 'unknown session rejected');
      const good = await post({ sessionKey: session.key, sessionDir: path.join(root, 'canvas'), workspace: root, items: [{ mime: 'image/png', data: png }] });
      assert.strictEqual(good.status, 200, 'valid session accepted');
    } finally {
      await canvas.close();
    }
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

runTests();
