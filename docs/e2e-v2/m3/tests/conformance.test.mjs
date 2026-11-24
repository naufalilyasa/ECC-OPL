// M3 conformance — static cross-check of `.opencode/commands/e2e.md` against the
// reference lifecycle in `registry.mjs` (R2 mitigation: two encodings, one token set).
// Reads the live worktree file only; no shell, no writes, no browser.
// RED before the Phase 3 delta, GREEN after. M6 live scenarios remain the final arbiter.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { STATE_ENUM, PERMITTED_WRITE_FIELDS, FULL_STAGES } from './registry.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = process.env.ECC_ROOT || (existsSync(join(HERE, '../../../../.opencode')) ? join(HERE, '../../../..') : '/Users/ctp-itdev2/ECC')
const CMD = join(ROOT, '.opencode/commands/e2e.md')
const text = readFileSync(CMD, 'utf8')

test('CONF-1 DEC-06: the approval-write flow runs proposal → approval → hash recheck → write | WRITE_CONFLICT', () => {
  assert.match(text, /DEC-06/, 'e2e.md: the approval-write flow must cite DEC-06')
  assert.match(text, /proposal/, 'e2e.md: step 1 is a proposal')
  for (const step of [/approv/i, /hash/i, /WRITE_CONFLICT/, /rebase/i, /CANCELLED/]) {
    assert.match(text, step, `e2e.md: approval-write flow is missing ${step}`)
  }
  assert.match(text, /explicit owner approval/i, 'e2e.md: approval means owner approval of the exact diff')
})

test('CONF-2 ID discipline: max+1, 001 base, no reuse, ID-first match, title similarity insufficient', () => {
  assert.match(text, /TEST-E2E-\d{3}/, 'e2e.md: the canonical ID shape appears')
  assert.match(text, /\b001\b/, 'e2e.md: ID base 001 stated')
  assert.match(text, /max\+1|max \+ 1|highest existing[^.]*\+\s*1/i, 'e2e.md: new ID = numeric max + 1')
  assert.match(text, /never reuse/i, 'e2e.md: reserved/removed IDs are never reused')
  assert.match(text, /match[^.]{0,40}ID first|exact ID/i, 'e2e.md: match order starts from the exact ID')
  assert.match(text, /title[^.]{0,80}(insufficient|never authoris|never authoriz)/i, 'e2e.md: title similarity alone is insufficient')
})

test('CONF-3 permitted write fields: exactly the 5 the lifecycle module enforces', () => {
  for (const field of PERMITTED_WRITE_FIELDS) {
    assert.ok(text.includes(field), `e2e.md: permitted write field "${field}" is missing`)
  }
  const sentence = text.split('\n').find((l) => l.includes('Test node') && l.includes('Evidence') && l.includes('Test file'))
  assert.ok(sentence, 'e2e.md: a single sentence lists the permitted write fields')
  for (const forbidden of ['Purpose', 'Source', 'Observable expectation', 'Boundary']) {
    assert.equal(sentence.includes(forbidden), false, `e2e.md: "${forbidden}" is not writable by a verified run`)
  }
})

test('CONF-4 DEC-12: stale is assessment-only; a legacy State: stale row gets a reviewed migration proposal', () => {
  assert.match(text, /DEC-12/, 'e2e.md: the stale rule must cite DEC-12')
  assert.match(text, /stale[^.]{0,80}assessment/i, 'e2e.md: stale is an assessment, not a State')
  assert.match(text, /migration proposal/i, 'e2e.md: a legacy stale row gets a migration proposal')
  assert.match(text, /never (a )?silent|never rewrite|not silently/i, 'e2e.md: no silent rewrite')
  for (const state of STATE_ENUM) assert.ok(text.includes(state), `e2e.md: State enum value "${state}" missing`)
})

test('CONF-5 bootstrap: the skeleton files are created only by a separately authorized write', () => {
  assert.match(text, /bootstrap/i, 'e2e.md: bootstrap is named')
  assert.match(text, /separately authoris|separately authoriz/i, 'e2e.md: creation needs a separate authorization')
  assert.match(text, /TESTS\.md/, 'e2e.md: the registry filename is named')
  assert.match(text, /\.governance\/docs-map\.json/, 'e2e.md: the map filename is named')
})

test('CONF-6 the six full-phase stages stay stated in order', () => {
  for (const stage of FULL_STAGES) assert.ok(text.includes(stage), `e2e.md: stage "${stage}" missing`)
})
