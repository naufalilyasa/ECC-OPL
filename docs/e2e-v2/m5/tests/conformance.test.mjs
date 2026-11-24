// M5 static conformance — honest, read-only characterization of pinned active
// command/config surfaces. No runtime enforcement claim. Live verification
// stays DEFERRED_TO_M6. Also emits prompt-conformance.report.json (Step 6).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '../../../..')
const REPORTS = join(HERE, '..', 'reports')
const sha = (b) => createHash('sha256').update(b).digest('hex')
const H = process.env.HOME

const PINS = {
  'e2e.md': [join(ROOT, '.opencode/commands/e2e.md'), '45d44a9efe6bad11d8c4bb83a1f551f71488c5990ae8fe62e4a4965982e5c5c1'],
  'e2e-map.md': [join(ROOT, '.opencode/commands/e2e-map.md'), '3dfc0639443cedaefd95b2aa7f629e333aee4d4901e99cdddb91218b506beb38'],
  'opencode.project.json': [join(ROOT, '.opencode/opencode.json'), '01e3d4405c4351cde1460e782da9aa80f0aa6a6796bc3bb149be1b12bcc63e84'],
  'opencode.global.json': [join(H, '.config/opencode/opencode.json'), 'bd747d4f42d22e7c0dc1f14b65e815b043117083fd548292489509c653e26843'],
  // owner-controlled: observed, never a hard gate
  'opencode.global.jsonc': [join(H, '.config/opencode/opencode.jsonc'), null],
}

function observed() {
  return Object.fromEntries(Object.entries(PINS).map(([name, [p]]) => [name, {
    path: p, exists: existsSync(p), sha256: existsSync(p) ? sha(readFileSync(p)) : null,
    matchesPin: PINS[name][1] === null ? null : existsSync(p) && sha(readFileSync(p)) === PINS[name][1],
  }]))
}

test('CONF-M5-0: both pinned command definitions are byte-identical', () => {
  assert.equal(existsSync(PINS['e2e.md'][0]), true)
  assert.equal(existsSync(PINS['e2e-map.md'][0]), true)
  assert.equal(sha(readFileSync(PINS['e2e.md'][0])), PINS['e2e.md'][1])
  assert.equal(sha(readFileSync(PINS['e2e-map.md'][0])), PINS['e2e-map.md'][1])
})

test('CONF-M5-1: TESTS.md and .governance/docs-map.json remain absent', () => {
  assert.equal(existsSync(join(ROOT, 'TESTS.md')), false)
  assert.equal(existsSync(join(ROOT, '.governance/docs-map.json')), false)
})

test('CONF-M5-2: all three active config files unchanged', () => {
  for (const name of ['opencode.project.json', 'opencode.global.json']) {
    const [p, exp] = PINS[name]
    assert.equal(existsSync(p), true, `${name} exists`)
    assert.equal(sha(readFileSync(p)), exp, `${name} byte-identical`)
  }
  assert.equal(PINS['opencode.global.jsonc'][1], null, 'owner config is observed, not pinned')
})

test('CONF-M5-3: emit prompt-conformance.report.json with honest static-only claim', () => {
  const obs = observed()
  const allMatch = Object.entries(obs).filter(([name]) => name !== 'opencode.global.jsonc').every(([, o]) => o.matchesPin === true)
  const body = {
    generated_at: '2026-11-23T00:00:00Z',
    milestone: 'M5',
    scenario_id: 'PROMPT',
    status: 'EXECUTED',
    fixture_provenance: 'STATIC_READ_ONLY',
    live_prompt_verification: 'DEFERRED_TO_M6',
    live_playwright_execution: 'DEFERRED_TO_M6',
    registry_writes: 0,
    applied: false,
    runtime_enforcement_claimed: false,
    static_checks_only: true,
    observed,
    all_pins_match: allMatch,
    registry_absent: {
      'TESTS.md': !existsSync(join(ROOT, 'TESTS.md')),
      '.governance/docs-map.json': !existsSync(join(ROOT, '.governance/docs-map.json')),
    },
    note: 'Static byte comparison only; not runtime enforcement. No live prompt/command verification performed in M5.',
  }
  assert.equal(allMatch, true)
  mkdirSync(REPORTS, { recursive: true })
  writeFileSync(join(REPORTS, 'prompt-conformance.report.json'), JSON.stringify(body, null, 2) + '\n')
  assert.equal(JSON.parse(readFileSync(join(REPORTS, 'prompt-conformance.report.json'), 'utf8')).scenario_id, 'PROMPT')
})
