/**
 * Phase 4 — preview runtime coordination (DBN-04).
 *
 * Readiness must be proven against real sockets, ownership must refuse foreign
 * PIDs, and cleanup must stop only what this workflow started. Stub HTTP
 * servers and a throwaway child process keep the assertions real.
 *
 * Run with: node tests/lib/design-build-preview-runtime.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..', '..');
const RUNTIME = path.resolve(REPO, 'scripts', 'design-build-v2', 'preview-runtime.mjs');
const DETECT = path.resolve(REPO, 'scripts', 'design-build-v2', 'detect-project.mjs');

let passed = 0;
let failed = 0;
const SERVERS = [];
const TEMP_DIRS = [];
const KILLED = [];

function test(name, fn) {
  try { fn(); console.log(`  ok ${name}`); passed += 1; }
  catch (error) { console.log(`  FAIL ${name}\n    ${error.message.split('\n')[0]}`); failed += 1; }
}

async function asyncTest(name, fn) {
  try { await fn(); console.log(`  ok ${name}`); passed += 1; }
  catch (error) { console.log(`  FAIL ${name}\n    ${error.message.split('\n')[0]}`); failed += 1; }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function stub(status = 200) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => { res.writeHead(status); res.end('ok'); });
    server.listen(0, '127.0.0.1', () => {
      SERVERS.push(server);
      resolve({ server, url: `http://127.0.0.1:${server.address().port}/` });
    });
  });
}

function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-runtime-'));
  TEMP_DIRS.push(dir);
  return dir;
}

function writeServerScript(dir, banner) {
  const file = path.join(dir, 'server.js');
  fs.writeFileSync(file, `
const http = require('http');
const port = Number(process.argv[2]);
http.createServer((req, res) => { res.writeHead(200); res.end('ok'); })
  .listen(port, '127.0.0.1', () => console.log('${banner} on ' + port));
`);
  return file;
}

(async () => {
  const {
    probe, waitForReady, createOwnershipRegistry, ensurePreviewServer,
  } = await import(pathToFileURL(RUNTIME).href);
  const { detectProject } = await import(pathToFileURL(DETECT).href);

  console.log('\n=== Phase 4: preview runtime coordination ===\n');

  await asyncTest('probe reports ready for a live server and the real failure otherwise', async () => {
    const live = await stub(200);
    const ok = await probe(live.url);
    assert.strictEqual(ok.ready, true);
    assert.strictEqual(ok.status, 200);
    const closed = await probe(`http://127.0.0.1:${await freePort()}/`, { timeoutMs: 500 });
    assert.strictEqual(closed.ready, false);
    assert.ok(/ECONNREFUSED|FETCH_FAILED|AbortError/.test(closed.reason), closed.reason);
  });

  await asyncTest('a 5xx response is not readiness', async () => {
    const broken = await stub(503);
    const result = await probe(broken.url);
    assert.strictEqual(result.ready, false);
    assert.strictEqual(result.reason, 'HTTP 503');
  });

  await asyncTest('waitForReady tolerates a server that starts late', async () => {
    const port = await freePort();
    const url = `http://127.0.0.1:${port}/`;
    const dir = tmp();
    const script = writeServerScript(dir, 'late');
    const { spawn } = require('child_process');
    const child = spawn(process.execPath, [script, String(port)], { stdio: 'ignore', detached: true });
    KILLED.push(child.pid);
    const result = await waitForReady([url], { timeoutMs: 10000, intervalMs: 100 });
    assert.strictEqual(result.ready, true, JSON.stringify(result));
  });

  await asyncTest('dual-server readiness names the missing server (Laravel+Inertia shape)', async () => {
    const laravel = await stub(200);
    const dead = `http://127.0.0.1:${await freePort()}/`;
    const both = await waitForReady([laravel.url, (await stub(200)).url], { timeoutMs: 1000, intervalMs: 100 });
    assert.strictEqual(both.ready, true);
    const partial = await waitForReady([laravel.url, dead], { timeoutMs: 600, intervalMs: 100 });
    assert.strictEqual(partial.ready, false);
    assert.strictEqual(partial.code, 'PREVIEW_NOT_READY');
    assert.deepStrictEqual(partial.failures.map((f) => f.url), [dead]);
  });

  test('ownership guard refuses a PID it did not start', () => {
    const registry = createOwnershipRegistry();
    let killed = 0;
    const result = registry.stop(process.pid, { killImpl: () => { killed += 1; } });
    assert.strictEqual(result.code, 'NOT_OWNED');
    assert.strictEqual(killed, 0);
  });

  test('cleanup stops only owned PIDs and reports the ones that failed', () => {
    const registry = createOwnershipRegistry();
    registry.track(41001, { id: 'laravel' });
    registry.track(41002, { id: 'vite' });
    const calls = [];
    const result = registry.cleanup({
      killImpl: (pid) => {
        calls.push(pid);
        if (pid === 41002) { const error = new Error('denied'); error.code = 'EPERM'; throw error; }
      },
    });
    assert.deepStrictEqual(calls.sort(), [41001, 41002]);
    assert.deepStrictEqual(result.killed.map((k) => k.id), ['laravel']);
    assert.deepStrictEqual(result.skipped.map((s) => s.pid), [41002]);
    assert.strictEqual(registry.owns(41001), false);
    assert.strictEqual(registry.owns(41002), true, 'a failed stop stays tracked so the caller retries');
  });

  await asyncTest('an already-serving URL is reused without spawning', async () => {
    const live = await stub(200);
    const registry = createOwnershipRegistry();
    const result = await ensurePreviewServer({
      urls: [live.url],
      command: 'this-command-must-never-run',
      registry,
      spawnImpl: () => { throw new Error('spawn must not be called'); },
    });
    assert.strictEqual(result.reused, true);
    assert.strictEqual(result.started, false);
    assert.strictEqual(registry.entries().length, 0);
  });

  await asyncTest('a slow but live server is reused instead of double-spawned', async () => {
    // Cold Laravel boot / first Vite optimize can exceed the old 500ms poll,
    // which used to be read as "not running" and race a second process onto
    // the same port.
    const { server } = await stub(200);
    const port = server.address().port;
    const slow = http.createServer((req, res) => {
      setTimeout(() => { res.writeHead(200); res.end('slow'); }, 900);
    });
    await new Promise((resolve) => slow.listen(port + 1, '127.0.0.1', resolve));
    SERVERS.push(slow);
    const registry = createOwnershipRegistry();
    const result = await ensurePreviewServer({
      urls: [`http://127.0.0.1:${port + 1}/`],
      command: 'this-command-must-never-run',
      registry,
      spawnImpl: () => { throw new Error('spawn must not be called'); },
    });
    assert.strictEqual(result.reused, true, JSON.stringify(result));
    assert.strictEqual(registry.entries().length, 0);
  });

  await asyncTest('a started server is tracked and cleanup stops it', async () => {
    const port = await freePort();
    const url = `http://127.0.0.1:${port}/`;
    const dir = tmp();
    const script = writeServerScript(dir, 'started');
    const registry = createOwnershipRegistry();
    const result = await ensurePreviewServer({
      urls: [url],
      command: `${JSON.stringify(process.execPath)} ${JSON.stringify(script)} ${port}`,
      cwd: dir,
      registry,
      timeoutMs: 15000,
      intervalMs: 100,
    });
    assert.strictEqual(result.started, true, JSON.stringify(result));
    assert.ok(result.pid > 0);
    assert.strictEqual(registry.owns(result.pid), true);
    const cleaned = registry.cleanup();
    assert.strictEqual(cleaned.killed.length, 1);
    assert.strictEqual(cleaned.killed[0].pid, result.pid);
    const after = await probe(url, { timeoutMs: 1000 });
    assert.strictEqual(after.ready, false, 'the owned server must actually be gone');
  });

  await asyncTest('a chatty server cannot block on an unread stdout pipe', async () => {
    const port = await freePort();
    const url = `http://127.0.0.1:${port}/`;
    const dir = tmp();
    // `php artisan serve` logs every request to stdout; 1MB of it used to fill
    // the pipe buffer and hang the server before it ever answered.
    const script = path.join(dir, 'chatty.js');
    fs.writeFileSync(script, `
const http = require('http');
const port = Number(process.argv[2]);
process.stdout.write('x'.repeat(1024 * 1024));
http.createServer((req, res) => { process.stdout.write('GET /\\n'); res.writeHead(200); res.end('ok'); })
  .listen(port, '127.0.0.1', () => console.log('ready'));
`);
    const registry = createOwnershipRegistry();
    const result = await ensurePreviewServer({
      urls: [url],
      command: `${JSON.stringify(process.execPath)} ${JSON.stringify(script)} ${port}`,
      cwd: dir,
      registry,
      timeoutMs: 15000,
      intervalMs: 100,
    });
    assert.strictEqual(result.started, true, JSON.stringify(result));
    const page = await fetch(url);
    assert.strictEqual(page.status, 200);
    registry.cleanup();
  });

  await asyncTest('a failing command reports its real stderr and leaves no owned PID', async () => {
    const port = await freePort();
    const dir = tmp();
    const script = path.join(dir, 'fail.js');
    fs.writeFileSync(script, `
console.error('Error: Cannot find module @vitejs/plugin-react');
process.exit(1);
`);
    const registry = createOwnershipRegistry();
    const result = await ensurePreviewServer({
      urls: [`http://127.0.0.1:${port}/`],
      command: `${JSON.stringify(process.execPath)} ${JSON.stringify(script)}`,
      cwd: dir,
      registry,
      timeoutMs: 5000,
      intervalMs: 100,
    });
    assert.strictEqual(result.code, 'PREVIEW_START_FAILED');
    assert.strictEqual(result.reason, 'EXIT_1');
    assert.ok(/Cannot find module @vitejs\/plugin-react/.test(result.stderr), result.stderr);
    assert.strictEqual(registry.entries().length, 0, 'nothing may stay tracked after a failed start');
  });

  test('Laravel+Inertia profile carries both server commands; React+Vite carries one', () => {
    const laravelDir = tmp();
    fs.writeFileSync(path.join(laravelDir, 'composer.json'), JSON.stringify({
      require: { 'laravel/framework': '^11.0', 'inertiajs/inertia-laravel': '^1.0' },
    }));
    fs.writeFileSync(path.join(laravelDir, 'package.json'), JSON.stringify({
      dependencies: { react: '^18.0.0', '@inertiajs/react': '^1.0.0' },
      devDependencies: { vite: '^5.0.0' },
      scripts: { dev: 'vite' },
    }));
    fs.writeFileSync(path.join(laravelDir, 'vite.config.ts'), 'export default {}');
    const laravel = detectProject(laravelDir);
    assert.strictEqual(laravel.variant, 'laravel-inertia-react');
    assert.deepStrictEqual(laravel.previewServers.map((s) => s.id), ['laravel', 'vite']);
    assert.strictEqual(laravel.previewServers[0].command, 'php artisan serve');
    assert.ok(/run dev$/.test(laravel.previewServers[1].command));

    const reactDir = tmp();
    fs.writeFileSync(path.join(reactDir, 'package.json'), JSON.stringify({
      dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
      devDependencies: { vite: '^5.0.0' },
      scripts: { dev: 'vite' },
    }));
    fs.writeFileSync(path.join(reactDir, 'vite.config.ts'), 'export default {}');
    fs.writeFileSync(path.join(reactDir, 'index.html'), '<div id="root"></div>');
    const react = detectProject(reactDir);
    assert.strictEqual(react.variant, 'react-vite');
    assert.deepStrictEqual(react.previewServers.map((s) => s.id), ['app']);
  });

  for (const server of SERVERS) server.close();
  for (const pid of KILLED) { try { process.kill(-pid, 'SIGTERM'); } catch { try { process.kill(pid, 'SIGTERM'); } catch { /* gone */ } } }
  for (const dir of TEMP_DIRS) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ } }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
})();
