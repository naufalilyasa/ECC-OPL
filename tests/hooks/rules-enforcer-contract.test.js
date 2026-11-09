/**
 * Contract test for the OpenCode rules-enforcer plugin.
 *
 * The plugin at ~/.config/opencode/plugins/rules-enforcer.ts translates
 * OpenCode tool hooks into Hookify's Claude-shaped payload and delegates
 * evaluation to scripts/hooks/hookify-runtime.js. This test pins that contract:
 * if the payload field names or the runtime's output shape drift, enforcement
 * silently stops working, so these assertions must fail loudly.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const test = require('node:test');

const RUNTIME = path.join(__dirname, '..', '..', 'scripts', 'hooks', 'hookify-runtime.js');

function makeProject(rules) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-rules-enforcer-')));
  const claudeDir = path.join(root, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  for (const [name, body] of Object.entries(rules)) {
    fs.writeFileSync(path.join(claudeDir, `hookify.${name}.local.md`), body);
  }
  return root;
}

function runRule(root, payload) {
  const result = spawnSync(process.execPath, [RUNTIME], {
    input: JSON.stringify(payload),
    cwd: root,
    encoding: 'utf8',
    timeout: 10000,
    env: { ...process.env, ECC_HOOKIFY_ALLOW_TRACKED: '1' },
  });
  assert.strictEqual(result.status, 0, result.stderr);
  return result.stdout ? JSON.parse(result.stdout) : null;
}

test('file block rule denies a write to a matching path', () => {
  const root = makeProject({
    'block-env': `---
name: block-env
enabled: true
event: file
action: block
conditions:
  - field: file_path
    operator: regex_match
    pattern: \\.env$
---

Do not write to .env files.`,
  });

  const output = runRule(root, {
    hook_event_name: 'PreToolUse',
    tool_name: 'write',
    tool_input: { file_path: '/tmp/app/.env', content: 'API_KEY=1' },
  });

  assert.ok(output, 'expected a decision');
  assert.strictEqual(output.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /\.env/);
});

test('warn rule returns additionalContext on post-tool use', () => {
  const root = makeProject({
    'warn-debug': `---
name: warn-debug
enabled: true
event: file
action: warn
conditions:
  - field: new_string
    operator: contains
    pattern: console.log
---

Remove debug logging before finishing.`,
  });

  const output = runRule(root, {
    hook_event_name: 'PostToolUse',
    tool_name: 'edit',
    tool_input: {
      file_path: '/tmp/app/src/index.ts',
      old_string: '',
      new_string: 'console.log("debug")',
    },
  });

  assert.ok(output, 'expected warn context');
  assert.match(output.hookSpecificOutput.additionalContext, /debug logging/);
});

test('bash block rule denies a matching command', () => {
  const root = makeProject({
    'block-rm-rf': `---
name: block-rm-rf
enabled: true
event: bash
action: block
pattern: rm\\s+-rf
---

Destructive rm -rf is blocked.`,
  });

  const output = runRule(root, {
    hook_event_name: 'PreToolUse',
    tool_name: 'bash',
    tool_input: { command: 'rm -rf /tmp/data' },
  });

  assert.strictEqual(output.hookSpecificOutput.permissionDecision, 'deny');
});

test('invalid regex fails open instead of blocking', () => {
  const root = makeProject({
    'broken-rule': `---
name: broken-rule
enabled: true
event: file
action: block
pattern: ([a-z+
---

Broken pattern.`,
  });

  const output = runRule(root, {
    hook_event_name: 'PreToolUse',
    tool_name: 'write',
    tool_input: { file_path: '/tmp/app/index.ts', content: 'const a = 1' },
  });

  assert.strictEqual(output, null, 'a broken rule must not produce a decision');
});

test('disabled rule is ignored', () => {
  const root = makeProject({
    'off-rule': `---
name: off-rule
enabled: false
event: file
action: block
pattern: .*
---

Should never fire.`,
  });

  const output = runRule(root, {
    hook_event_name: 'PreToolUse',
    tool_name: 'write',
    tool_input: { file_path: '/tmp/app/index.ts', content: 'const a = 1' },
  });

  assert.strictEqual(output, null);
});