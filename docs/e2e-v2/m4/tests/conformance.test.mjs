// M4 static prompt conformance — honest characterization of `.opencode/commands/e2e.md`.
// Reads the pinned command read-only. The Phase 4 delta is NOT approved, so its
// absence is reported as NOT_IMPLEMENTED, never as a failing release claim.
// Static text is not runtime enforcement: live_prompt_verification: DEFERRED_TO_M6.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as R from './runner.mjs'
import * as F from './fixtures.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '../../../..')
const CMD = join(ROOT, '.opencode/commands/e2e.md')
const sha = (b) => createHash('sha256').update(b).digest('hex')
const raw = readFileSync(CMD)
const text = raw.toString('utf8')
const insertion = Buffer.from(F.PROMPT_DELTA_INSERTION_B64, 'base64').toString('utf8')

test('CONF-M4-0: the pinned command preimage is byte-identical (no Phase 4 edit happened)', () => {
  assert.equal(sha(raw), F.PROMPT_PREIMAGE_SHA)
  assert.equal(existsSync(CMD), true)
})

test('CONF-M4-1: current preimage is honestly classified MISSING_CONTRACT', () => {
  const c = R.classifyPrompt(text)
  assert.equal(c.status, 'MISSING_CONTRACT')
  assert.equal(c.delta_status, 'NOT_IMPLEMENTED')
  for (const field of ['spec_sha256', 'assertion_summary', 'exit_code', 'runner_status',
    'target_environment', 'artifacts', 'start_time', 'end_time', 'redaction_status',
    'test_counts', 'no_auto_install', 'agent_browser_off', 'per_operation_approval']) {
    assert.ok(c.missing.includes(field), `CONF-M4-1: ${field} must be reported missing`)
  }
})

test('CONF-M4-2: classification also records what IS present (no blanket "all missing")', () => {
  const c = R.classifyPrompt(text)
  assert.ok(c.present.includes('environment_gate_named'), 'CONF-M4-2: DEC-07 gate is named')
  assert.ok(c.present.includes('registry_trust_boundary'), 'CONF-M4-2: §8 trust boundary is present')
  assert.ok(c.present.includes('state_enum'), 'CONF-M4-2: §9 State enum is present')
})

test('CONF-M4-3: a forged in-memory insertion is detected and hashes to the proposed postimage', () => {
  assert.equal(insertion.endsWith('\n\n'), true)
  assert.equal(sha(Buffer.from(insertion, 'utf8')), F.PROMPT_DELTA_INSERTION_SHA)
  assert.equal(text.split(F.PROMPT_DELTA_MARKER).length - 1, 1, 'CONF-M4-3: unique insertion marker')
  const forged = text.replace(F.PROMPT_DELTA_MARKER, insertion + F.PROMPT_DELTA_MARKER)
  assert.equal(sha(Buffer.from(forged, 'utf8')), F.PROMPT_POSTIMAGE_SHA)
  assert.equal(R.detectInsertion(forged, insertion).present, true)
  assert.equal(R.classifyPrompt(forged).status, 'CONTRACT_PRESENT')
})

test('CONF-M4-4: an altered or missing insertion is rejected by the comparator', () => {
  const forged = text.replace(F.PROMPT_DELTA_MARKER, insertion + F.PROMPT_DELTA_MARKER)
  const altered = insertion.replace('BLOCKED', 'ALLOWED')
  assert.equal(R.detectInsertion(forged, altered).present, false)
  assert.equal(R.detectInsertion(text, insertion).present, false)
  assert.equal(R.detectInsertion(forged, insertion).matching_bytes, true)
})

test('CONF-M4-5: no static test claims runner behavior, security enforcement or live credit', () => {
  const c = R.classifyPrompt(text)
  assert.equal(c.live_prompt_verification, 'DEFERRED_TO_M6')
  assert.equal(c.runtime_enforcement_claimed, false)
  assert.equal(c.security_boundary_claimed, false)
})

test('CONF-M4-5b: invalid insertion inputs fail closed', () => {
  for (const [text, insertion] of [[null, 'x'], ['x', null], ['x', ''], [42, 'x']]) {
    const r = R.detectInsertion(text, insertion)
    assert.equal(r.present, false)
    assert.equal(r.matching_bytes, false)
    assert.equal(r.sha256, null)
  }
})

test('CONF-M4-6: read-only classification leaves the pinned bytes unchanged', () => {
  assert.equal(sha(readFileSync(CMD)), F.PROMPT_PREIMAGE_SHA)
})
