'use strict';

// Count invoked Node assertion APIs in the isolated test process. This is evidence
// for trusted local tests, not a sandbox or proof against a malicious runner.
const assert = require('node:assert');
const strict = require('node:assert/strict');
let calls = 0;
const wrapped = new WeakMap();
for (const api of [assert, strict]) {
  for (const key of Object.keys(api)) {
    const fn = api[key];
    if (typeof fn !== 'function' || key === 'AssertionError' || key === 'CallTracker' || key === 'strict') continue;
    let counted = wrapped.get(fn);
    if (!counted) {
      counted = function (...args) { calls++; return Reflect.apply(fn, this, args); };
      wrapped.set(fn, counted); wrapped.set(counted, counted);
    }
    api[key] = counted;
  }
}
require('node:module').syncBuiltinESMExports();
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const directory = process.env.RC11_ASSERTION_DIR;
if (directory) {
  const stat = fs.lstatSync(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory() || (stat.mode & 0o077)) throw new Error('INVALID_ASSERTION_DIRECTORY');
  const output = path.join(directory, `${process.pid}-${crypto.randomUUID()}.json`);
  process.once('exit', () => {
    fs.writeFileSync(output, JSON.stringify({ pid: process.pid, assertions: calls, instrumentation: 'NODE_ASSERT_METHODS_ONLY' }) + '\n', { flag: 'wx', mode: 0o600 });
  });
}
