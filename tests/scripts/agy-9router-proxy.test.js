/**
 * Tests for scripts/agy-9router-proxy.js
 *
 * Run with: node tests/scripts/agy-9router-proxy.test.js
 */
'use strict';

const assert = require('assert');
const http = require('http');
const path = require('path');

const { createProxy, rewriteHeaders, normalizePath } = require(path.join(
  __dirname, '..', '..', 'scripts', 'agy-9router-proxy'
));

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (error) {
    console.log(`  ✗ ${name}\n    ${error.message.split('\n')[0]}`);
    failed += 1;
  }
}

function listen(server) {
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

function post(port, pathname, headers, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: pathname, method: 'POST', headers },
      res => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    req.end(body);
  });
}

async function run() {
  console.log('\n=== agy-9router-proxy ===\n');

  await test('P1 x-goog-api-key becomes Authorization: Bearer', () => {
    const out = rewriteHeaders(
      { 'x-goog-api-key': 'secret-key', 'content-type': 'application/json' },
      'secret-key'
    );
    assert.strictEqual(out['Authorization'], 'Bearer secret-key');
    assert.strictEqual(out['authorization'], undefined, 'no duplicate casing');
    assert.strictEqual(out['x-goog-api-key'], undefined, 'incoming key header dropped');
    assert.strictEqual(out['content-type'], 'application/json');
  });

  await test('P2 an existing Authorization header is replaced, not duplicated', () => {
    const out = rewriteHeaders(
      { 'x-goog-api-key': 'from-agy', Authorization: 'Bearer stale' },
      'real-key'
    );
    assert.strictEqual(out['Authorization'], 'Bearer real-key');
    assert.strictEqual(out['x-goog-api-key'], undefined);
  });

  await test('P3 hop-by-hop headers are not forwarded', () => {
    const out = rewriteHeaders(
      { host: '127.0.0.1:1234', connection: 'keep-alive', 'content-length': '9', 'x-goog-api-key': 'k' },
      'k'
    );
    assert.strictEqual(out.host, undefined);
    assert.strictEqual(out.connection, undefined);
    assert.strictEqual(out['content-length'], undefined);
  });

  await test('P4 proxy forwards the request and injects the env key', async () => {
    let seen = null;
    const upstream = http.createServer((req, res) => {
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => {
        seen = { url: req.url, auth: req.headers.authorization, key: req.headers['x-goog-api-key'], body };
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        res.write('data: {"candidates":[]}\n\n');
        res.end();
      });
    });
    const upstreamPort = await listen(upstream);

    const proxy = createProxy({
      target: `http://127.0.0.1:${upstreamPort}`,
      apiKey: 'env-key',
    });
    const proxyPort = await listen(proxy);

    const res = await post(
      proxyPort,
      '/v1beta/models/cbai/x:streamGenerateContent?alt=sse',
      { 'x-goog-api-key': 'placeholder-from-agy', 'content-type': 'application/json' },
      '{"contents":[]}'
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(seen.auth, 'Bearer env-key', 'env key wins over the placeholder');
    assert.strictEqual(seen.key, undefined);
    assert.strictEqual(seen.url, '/v1beta/models/cbai/x:streamGenerateContent?alt=sse');
    assert.strictEqual(seen.body, '{"contents":[]}');
    assert.ok(res.body.includes('data: {"candidates":[]}'), 'SSE body passed through');

    await new Promise(r => proxy.close(r));
    await new Promise(r => upstream.close(r));
  });

  await test('P5 upstream status and error body pass through unchanged', async () => {
    const upstream = http.createServer((req, res) => {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end('{"error":"unauthorized"}');
    });
    const upstreamPort = await listen(upstream);

    const proxy = createProxy({ target: `http://127.0.0.1:${upstreamPort}`, apiKey: 'k' });
    const proxyPort = await listen(proxy);

    const res = await post(proxyPort, '/v1beta/models/x:streamGenerateContent', { 'x-goog-api-key': 'k' }, '{}');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body, '{"error":"unauthorized"}');

    await new Promise(r => proxy.close(r));
    await new Promise(r => upstream.close(r));
  });

  await test('P6 only the /v1beta/models prefix is proxied', async () => {
    const proxy = createProxy({ target: 'http://127.0.0.1:1', apiKey: 'k' });
    const proxyPort = await listen(proxy);
    const res = await post(proxyPort, '/api/secret', { 'x-goog-api-key': 'k' }, '{}');
    assert.strictEqual(res.status, 404, 'unrelated paths are refused, not forwarded');
    await new Promise(r => proxy.close(r));
  });

  await test('P7 a doubled /v1beta prefix is collapsed', () => {
    assert.strictEqual(
      normalizePath('/v1beta/v1beta/models/x:streamGenerateContent'),
      '/v1beta/models/x:streamGenerateContent'
    );
    assert.strictEqual(
      normalizePath('/v1beta/models/x:streamGenerateContent'),
      '/v1beta/models/x:streamGenerateContent'
    );
  });

  await test('P8 a doubled prefix is still proxied end to end', async () => {
    let seenUrl = null;
    const upstream = http.createServer((req, res) => {
      seenUrl = req.url;
      req.resume();
      req.on('end', () => { res.writeHead(200); res.end('ok'); });
    });
    const upstreamPort = await listen(upstream);
    const proxy = createProxy({ target: `http://127.0.0.1:${upstreamPort}`, apiKey: 'k' });
    const proxyPort = await listen(proxy);

    const res = await post(proxyPort, '/v1beta/v1beta/models/x:streamGenerateContent', { 'x-goog-api-key': 'k' }, '{}');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(seenUrl, '/v1beta/models/x:streamGenerateContent');

    await new Promise(r => proxy.close(r));
    await new Promise(r => upstream.close(r));
  });

  await test('P9 a missing API key fails closed at startup', () => {
    assert.throws(() => createProxy({ target: 'http://127.0.0.1:1', apiKey: '' }), /API key/i);
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

run();
