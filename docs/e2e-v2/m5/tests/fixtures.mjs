// M5 deterministic synthetic fixtures — reference/harness layer ONLY.
// Every value here is synthetic: no browser, runner, network, install,
// registry write, active config mutation or real owner consent. Scratch files
// are created by the tests inside the pinned disposable SCRATCH root only.
// Scenario / fixture IDs trace 1:1 to the R1 acceptance matrix and plan r3.

import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

// The one and only approved disposable scratch root (0700 via mkdtemp).
export const SCRATCH = '/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode'

// Create an isolated 0700 scratch dir; caller registers t.after(cleanup).
export function makeScratch(prefix = 'm5-') {
  return mkdtempSync(join(SCRATCH, prefix))
}
export function dropScratch(dir) {
  rmSync(dir, { recursive: true, force: true })
}
export function subDir(parent, name) {
  const d = join(parent, name)
  mkdirSync(d, { mode: 0o700, recursive: true })
  return d
}

// ---------------------------------------------------------------- F07 — Section 4 registry blocks (C12 / E05)
// Two blocks: the first is the exact-match target, the second must stay byte-identical.
export const F07_BLOCK_A_ID = 'TEST-E2E-001'
export const F07_BLOCK_B_ID = 'TEST-E2E-002'
export const F07_REGISTRY_BEFORE = [
  '# E2E Test Registry (ECC-OPL) — SYNTHETIC FIXTURE',
  '',
  '## Section 2 — Journey index',
  '| ID | Journey | State |',
  '|---|---|---|',
  '| TEST-E2E-001 | checkout | unverified |',
  '| TEST-E2E-002 | login | unverified |',
  '',
  '## Section 4 — Test blocks',
  `### ${F07_BLOCK_A_ID} — checkout completion`,
  '- Purpose: verify checkout reaches confirmation',
  '- Source: flow/checkout',
  '- Representative input: valid cart',
  '- Observable expectation: confirmation rendered with order id',
  '- Level: journey',
  '- Execution group: checkout',
  '- Boundary: non-production',
  '- State: unverified',
  '- Test file: (none)',
  '- Test node: (none)',
  '- Command: (none)',
  '- Evidence: (none)',
  '',
  `### ${F07_BLOCK_B_ID} — login completion`,
  '- Purpose: verify login reaches dashboard',
  '- Source: flow/login',
  '- Representative input: valid credentials',
  '- Observable expectation: dashboard rendered',
  '- Level: journey',
  '- Execution group: auth',
  '- Boundary: non-production',
  '- State: unverified',
  '- Test file: (none)',
  '- Test node: (none)',
  '- Command: (none)',
  '- Evidence: (none)',
  '',
].join('\n')

// All five permitted fields in one verified outcome.
export const F07_OUTCOME_PERMITTED = Object.freeze({
  State: 'covered',
  'Test file': 'tests/e2e/checkout.spec.ts',
  'Test node': 'checkout completes to confirmation',
  Command: 'node --test tests/e2e/checkout.spec.mjs',
  Evidence: 'SYNTHETIC_REFERENCE only; live DEFERRED_TO_M6',
})

// Attempts to touch non-permitted metadata — must fail closed.
export const F07_OUTCOME_ILLEGAL = Object.freeze({
  State: 'covered',
  Purpose: 'tampered purpose',
})
export const F07_OUTCOME_ILLEGAL_ONLY = Object.freeze({
  'Execution group': 'payment',
  Boundary: 'production',
})

// ---------------------------------------------------------------- F09 — path traversal / symlink escape (B11 / D04)
export const F09_TRAVERSAL_PATHS = Object.freeze([
  '../TESTS.md',
  'docs/e2e-v2/../../TESTS.md',
  '/etc/passwd',
  '',
  null,
])
// A symlink component named 'escape' resolves to the parent of repoRoot.
export const F09_SYMLINK_NAME = 'escape'

// ---------------------------------------------------------------- F11 — concurrent edit race (B12 / mutation 13)
export const F11_WRITER_A = Object.freeze({ State: 'covered', Evidence: 'writer-A verified' })
export const F11_WRITER_B = Object.freeze({ State: 'covered', Evidence: 'writer-B verified' })

// ---------------------------------------------------------------- F13 — collision + legacy shorthand (D07 / D08)
export const F13_LEGACY_SHORTHANDS = Object.freeze(['/e2e auth', '/e2e checkout', '/e2e payment'])
export const F13_CANONICAL = Object.freeze(['/e2e map', '/e2e run checkout', '/e2e full'])
export const F13_DEFAULT_DISCOVERY = Object.freeze(['/e2e', '/e2e-map'])
export const F13_POST_DISABLE_DISCOVERY = Object.freeze(['/e2e'])

// ---------------------------------------------------------------- F14 — benchmark stack route outputs (D06 / parity)
// Output shape produced by a map command: routes, flows, excluded, partial (all sets).
const stack = (id, routes, flows, excluded = ['/api/health'], partial = []) => ({
  stackId: id, routes, flows, excluded, partial,
})
export const F14_STACK_IDS = Object.freeze(['F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F13'])
export const F14_NEW_MAP = Object.freeze({
  F01: stack('F01', ['/', '/about'], ['home', 'about']),
  F02: stack('F02', ['/login', '/dashboard'], ['login'], ['/api/health'], ['/dashboard/:id']),
  F03: stack('F03', ['/cart', '/checkout'], ['checkout']),
  F04: stack('F04', ['/search'], ['search'], ['/api/search']),
  F05: stack('F05', ['/profile', '/settings'], ['profile', 'settings']),
  F06: stack('F06', ['/admin'], ['admin'], ['/api/admin'], ['/admin/:tab']),
  F13: stack('F13', ['/collision/a', '/collision/b'], ['collision'], ['/api/collision']),
})
// Legacy output is byte-for-byte equivalent in content for parity=true.
export const F14_LEGACY_MAP = Object.freeze(Object.fromEntries(
  F14_STACK_IDS.map((id) => [id, structuredClone(F14_NEW_MAP[id])]),
))
// A parity-differing legacy output for one stack (dropped route + flipped PARTIAL).
export const F14_LEGACY_MAP_DIVERGENT = Object.freeze({
  ...F14_LEGACY_MAP,
  F02: stack('F02', ['/login'], ['login'], ['/api/health'], []),
})

// ---------------------------------------------------------------- F14 — rollback targets (D10 / Gate P4)
// Bytes are supplied at runtime from read-only reads of the five pinned files;
// the harness never writes to those active paths. Names are stable identifiers.
export const ROLLBACK_TARGET_NAMES = Object.freeze([
  'opencode.project.json',
  'opencode.global.json',
  'opencode.global.jsonc',
  'command.e2e.md',
  'command.e2e-map.md',
])

// ---------------------------------------------------------------- AC-018 — terminal outcome inputs
export const TERMINAL_ENUM = Object.freeze(['PASS', 'FAIL', 'BLOCKED', 'UNVERIFIED', 'CANCELLED', 'PARTIAL'])
export const TERMINAL_FABRICATED = Object.freeze(['PASS (manual)', 'PASS_UNCHECKED', 'PASS (trusted)'])
export const TERMINAL_FLAKY = Object.freeze({ retries: 2, flaky: true })
