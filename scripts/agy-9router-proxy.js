#!/usr/bin/env node
'use strict';

/**
 * Header-translating proxy: Antigravity CLI (agy) → 9Router.
 *
 * `agy` sends its Gemini API key as `x-goog-api-key`; 9Router's Gemini-native
 * route only accepts `Authorization: Bearer`. Every other part of the protocol
 * already matches, so this proxy rewrites one header and pipes the rest through
 * untouched — SSE frames included, with no parsing.
 *
 * The key comes from the environment, never from agy's config: agy can hold any
 * placeholder value, and the real key never lands on disk in a second place.
 *
 *   AGY_PROXY_KEY=sk-... node scripts/agy-9router-proxy.js
 *   AGY_PROXY_KEY=sk-... node scripts/agy-9router-proxy.js --port 20999
 *
 * Then point agy at it:
 *
 *   GEMINI_API_KEY=placeholder \
 *   GOOGLE_GEMINI_BASE_URL=http://127.0.0.1:20999/v1beta \
 *   agy --settings=<custom-models.json> --model "<label>" --sandbox --print "..."
 *
 * Bind is loopback-only by design: this forwards a credential.
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const DEFAULT_PORT = 20999;
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_TARGET = 'http://127.0.0.1:20128';
// Only the Gemini-native surface is forwarded. Anything else is refused so this
// proxy can never be used as a general-purpose credential-bearing tunnel.
const PROXY_PATH_PREFIX = '/v1beta/models';

/**
 * `agy` appends `/v1beta/models/...` to whatever base URL it is given, so a
 * caller may set GOOGLE_GEMINI_BASE_URL with or without a trailing `/v1beta`.
 * Normalizing here means one proxy serves both, and a doubled prefix (which
 * would 404 upstream) is collapsed instead of forwarded.
 */
function normalizePath(url) {
  const doubled = `/v1beta${PROXY_PATH_PREFIX}`;
  if (url.startsWith(doubled)) return url.slice('/v1beta'.length);
  return url;
}
// Headers that belong to one hop and must not be forwarded (RFC 7230 §6.1).
const HOP_BY_HOP = new Set([
  'host',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length'
]);

/**
 * Rewrite request headers for the upstream: drop hop-by-hop headers, drop the
 * key header agy sent, and set the Bearer token the upstream actually accepts.
 */
function rewriteHeaders(incoming, apiKey) {
  const out = {};
  for (const [name, value] of Object.entries(incoming || {})) {
    const lower = name.toLowerCase();
    if (HOP_BY_HOP.has(lower)) continue;
    if (lower === 'x-goog-api-key') continue;
    if (lower === 'authorization') continue;
    out[name] = value;
  }
  out.Authorization = `Bearer ${apiKey}`;
  return out;
}

function createProxy({ target = DEFAULT_TARGET, apiKey, log = () => {} } = {}) {
  if (!apiKey) {
    throw new Error('an upstream API key is required (set AGY_PROXY_KEY)');
  }
  const targetUrl = new URL(target);
  const transport = targetUrl.protocol === 'https:' ? https : http;

  const server = http.createServer((req, res) => {
    // Log before the path gate: a refused request is exactly the one worth
    // seeing when agy and the proxy disagree about the route.
    log(`${req.method} ${req.url}`);
    const requestPath = normalizePath(req.url || '');
    if (!requestPath.startsWith(PROXY_PATH_PREFIX)) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: `only ${PROXY_PATH_PREFIX} is proxied` }));
      return;
    }

    const headers = rewriteHeaders(req.headers, apiKey);
    // The body is forwarded byte-for-byte, so its length must be recomputed for
    // the rewritten request rather than inherited from the client.
    const options = {
      protocol: targetUrl.protocol,
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      method: req.method,
      path: requestPath,
      headers
    };

    log(`${req.method} ${req.url}`);

    const upstream = transport.request(options, upstreamRes => {
      // Preserve the upstream status and headers (SSE needs its content-type and
      // no buffering), dropping only hop-by-hop entries.
      const responseHeaders = {};
      for (const [name, value] of Object.entries(upstreamRes.headers)) {
        if (HOP_BY_HOP.has(name.toLowerCase())) continue;
        responseHeaders[name] = value;
      }
      res.writeHead(upstreamRes.statusCode || 502, responseHeaders);
      upstreamRes.pipe(res);
    });

    upstream.on('error', error => {
      log(`upstream error: ${error.message}`);
      if (!res.headersSent) {
        res.writeHead(502, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'upstream unreachable' }));
      } else {
        res.end();
      }
    });

    req.pipe(upstream);
  });

  return server;
}

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 && index + 1 < argv.length ? argv[index + 1] : null;
}

function main(argv = process.argv.slice(2)) {
  const apiKey = process.env.AGY_PROXY_KEY || '';
  if (!apiKey) {
    process.stderr.write(
      'error: AGY_PROXY_KEY is required (the 9Router API key).\n' +
      '       The key is read from the environment so it never lands in agy config.\n'
    );
    process.exitCode = 1;
    return null;
  }

  const port = Number.parseInt(argValue(argv, '--port') || process.env.AGY_PROXY_PORT || '', 10) || DEFAULT_PORT;
  const host = argValue(argv, '--host') || DEFAULT_HOST;
  const target = argValue(argv, '--target') || process.env.AGY_PROXY_TARGET || DEFAULT_TARGET;

  const server = createProxy({
    target,
    apiKey,
    log: message => process.stderr.write(`[agy-proxy] ${message}\n`)
  });

  server.listen(port, host, () => {
    process.stderr.write(
      `[agy-proxy] ${host}:${port} -> ${target}${PROXY_PATH_PREFIX} (key from AGY_PROXY_KEY)\n`
    );
  });

  return server;
}

if (require.main === module) {
  main();
}

module.exports = { createProxy, rewriteHeaders, main, normalizePath, PROXY_PATH_PREFIX };
