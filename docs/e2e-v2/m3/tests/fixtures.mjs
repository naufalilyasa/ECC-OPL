// M3 deterministic fixtures — the same F07 shape the lifecycle suite and the report
// emitter exercise. Literal constants only: nothing here is written to the repo root,
// and F11 (the concurrency target) is a temp-dir copy created and deleted per test.
// Canonical ECC has no TESTS.md today; this fixture never becomes one.

// F07 — a populated registry: Section 2 rows + 2 Section 4 blocks.
export const F07 = `# E2E Test Registry (ECC-OPL)

## Section 2 — Journey index
| ID | Journey | Source | Level | Execution group | State |
|---|---|---|---|---|---|
| TEST-E2E-001 | checkout | /checkout | ui | g1 | covered |
| TEST-E2E-002 | login | /login | ui | g1 | missing |

## Section 4 — Test blocks
<!-- Writable by a verified run: State, Test file, Test node, Command, Evidence only. -->

### TEST-E2E-001 — checkout to confirmation
- Purpose: verify checkout completes
- Source: /checkout
- Representative input: /checkout, /cart
- Observable expectation: order confirmation rendered
- Level: ui
- Execution group: g1
- Boundary: fixtures/checkout
- State: unverified
- Test file: tests/e2e/checkout.spec.ts
- Test node: checkout to confirmation
- Command: npx playwright test tests/e2e/checkout.spec.ts
- Evidence: evidence/checkout.json

### TEST-E2E-002 — login with email
- Purpose: verify login
- Source: /login
- Representative input: /login
- Observable expectation: session cookie set
- Level: ui
- Execution group: g1
- Boundary: fixtures/login
- State: missing
- Test file:
- Test node:
- Command:
- Evidence:
`

// A verified-run outcome: exactly the 5 permitted fields.
export const PASS_OUTCOME = {
  State: 'covered',
  'Test file': 'tests/e2e/checkout-flow.spec.ts',
  'Test node': 'checkout completes',
  Command: 'npx playwright test tests/e2e/checkout-flow.spec.ts --reporter=json',
  Evidence: 'evidence/checkout-2026-11-23.json',
}
