// M6 static conformance — read-only verification of pinned surfaces under the
// isolated scratch HOME fixture. Active global config drift is recorded
// observationally and is never compared to a constant or used as a pass gate.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import * as F from './fixtures.mjs'

const sha = (b) => createHash('sha256').update(b).digest('hex')
const ROOT = F.ROOT
const HOME = process.env.HOME
const REPORTS = join(ROOT, 'docs/e2e-v2/m6/reports')

const PINS = {
  'e2e.md': [join(ROOT, '.opencode/commands/e2e.md'), '45d44a9efe6bad11d8c4bb83a1f551f71488c5990ae8fe62e4a4965982e5c5c1'],
  'e2e-map.md': [join(ROOT, '.opencode/commands/e2e-map.md'), '3dfc0639443cedaefd95b2aa7f629e333aee4d4901e99cdddb91218b506beb38'],
  'opencode.project.json': [join(ROOT, '.opencode/opencode.json'), '01e3d4405c4351cde1460e782da9aa80f0aa6a6796bc3bb149be1b12bcc63e84'],
  'opencode.global.json': [join(HOME, '.config/opencode/opencode.json'), 'bd747d4f42d22e7c0dc1f14b65e815b043117083fd548292489509c653e26843'],
  'opencode.global.jsonc': [join(HOME, '.config/opencode/opencode.jsonc'), null],
}

test('CONF-M6-0: pinned command definitions are byte-identical', () => {
  for (const name of ['e2e.md', 'e2e-map.md']) {
    const [path, expected] = PINS[name]
    assert.equal(existsSync(path), true, name)
    assert.equal(sha(readFileSync(path)), expected, name)
  }
})

test('CONF-M6-1: active project config and immutable global JSON pins are unchanged', () => {
  // opencode.global.jsonc is owner-controlled active config: drift is observed
  // in CONF-M6-4, never gated here (the file itself is never written by M6).
  for (const name of ['opencode.project.json', 'opencode.global.json']) {
    const [path, expected] = PINS[name]
    assert.equal(existsSync(path), true, name)
    assert.equal(sha(readFileSync(path)), expected, name)
  }
})

test('CONF-M6-2: TESTS.md and .governance/docs-map.json remain absent', () => {
  assert.equal(existsSync(join(ROOT, 'TESTS.md')), false)
  assert.equal(existsSync(join(ROOT, '.governance/docs-map.json')), false)
})

test('CONF-M6-3: frozen trees M1–M5 and contracts remain byte-identical', async () => {
  const result = (await import('./acceptance-ledger.mjs')).verifyFrozenTrees({ root: ROOT })
  assert.equal(result.trees.length, 6)
  assert.equal(result.allMatch, true)
  for (const t of result.trees) assert.equal(t.match, true, t.name)
})

test('CONF-M6-4: active owner config drift is observational only, never a gate', () => {
  const report = JSON.parse(readFileSync(join(REPORTS, 'm6-preflight.report.json'), 'utf8'))
  const observed = sha(readFileSync(F.ACTIVE_JSONC))
  assert.match(report.owner_config_drift.observed_sha256, /^[0-9a-f]{64}$/)
  assert.equal(report.owner_config_drift.observed_sha256, observed)
  assert.equal(report.owner_config_drift.affects_pass_fail, false)
  assert.equal(report.owner_config_drift.compared_to_constant, false)
  assert.equal(report.owner_config_drift.modification_or_restoration_performed, false)
  // The observed value is deliberately not compared to any pinned constant.
  assert.notEqual(PINS['opencode.global.jsonc'][1], observed)
})

test('CONF-M6-5: emitted prompt-conformance report agrees with live read-only observations', () => {
  const report = JSON.parse(readFileSync(join(REPORTS, 'prompt-conformance.report.json'), 'utf8'))
  assert.equal(report.status, 'PASS')
  assert.equal(report.registry_writes, 0)
  assert.equal(report.runtime_enforcement_claimed, false)
  assert.equal(report.live_prompt_verification, 'NOT_RUN')
  assert.equal(report.owner_config_drift.observed_sha256, sha(readFileSync(F.ACTIVE_JSONC)))
  assert.equal(report.command_preimages.every((p) => p.match), true)
  assert.equal(report.project_config.match, true)
  assert.equal(Object.values(report.registry_absent).every(Boolean), true)
})

test('CONF-M6-6: all M6 writes stay inside docs/e2e-v2/m6/**', () => {
  const scope = JSON.parse(readFileSync(join(REPORTS, 'scope-check.report.json'), 'utf8'))
  assert.equal(scope.outside_writes, 0)
  assert.equal(scope.frozen_trees_all_match, true)
  for (const f of scope.files) assert.ok(f.path.startsWith('docs/e2e-v2/m6/'), f.path)
})
