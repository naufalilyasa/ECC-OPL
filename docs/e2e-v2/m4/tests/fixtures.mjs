// M4 deterministic synthetic fixtures — reference/harness layer ONLY.
// Everything here is explicitly synthetic: no browser, no runner, no install,
// no registry write, no real owner consent. Scratch files are created by the tests.
// Scenario/mutation IDs trace 1:1 to the R1 acceptance matrix.

// ---------------------------------------------------------------- gate (D02 / C08 / mutation 12)
export const TARGET_NONPROD = Object.freeze({
  baseUrl: 'http://127.0.0.1:4321',
  classification: 'non-production',
  service: 'order-api-test',
  accountClass: 'synthetic-fixture-account',
  fixtureOwner: 'm4-harness',
  networkScope: 'loopback',
  operations: ['checkout.submit'],
})

export const APPROVAL_VALID = Object.freeze({
  environment: 'E2E_NONPROD_LOCAL_FIXTURE@http://127.0.0.1:4321',
  operations: ['checkout.submit'],
  owner: 'synthetic-owner',
  policy: 'DEC-07',
})

export const APPROVAL_HIGHRISK_PARTIAL = Object.freeze({
  environment: 'E2E_NONPROD_LOCAL_FIXTURE@http://127.0.0.1:4321',
  operations: ['checkout.submit'],
  owner: 'synthetic-owner',
  policy: 'DEC-07',
})

export const HIGH_RISK_TARGET = Object.freeze({
  ...TARGET_NONPROD,
  operations: ['checkout.submit', 'payment.capture', 'stock.decrement'],
})

export const GATE_VARIANTS = Object.freeze({
  approvedRun: { mode: 'run', guardian: 'ALLOW', dependency: 'AVAILABLE' },
  approvedFull: { mode: 'full', guardian: 'ALLOW', dependency: 'AVAILABLE' },
  production: { target: { classification: 'production' }, guardian: 'ALLOW', dependency: 'AVAILABLE' },
  unknown: { target: { classification: 'unknown' }, guardian: 'ALLOW', dependency: 'AVAILABLE' },
  noBaseUrl: { target: { baseUrl: undefined } },
  malformedBaseUrl: { target: { baseUrl: 'not a url' } },
  noService: { target: { service: '' } },
  noAccountClass: { target: { accountClass: undefined } },
  noFixtureOwner: { target: { fixtureOwner: undefined } },
  noNetworkScope: { target: { networkScope: undefined } },
  noOperations: { target: { operations: [] } },
  noApproval: { approval: null },
  approvalEnvMismatch: { approval: { environment: 'OTHER@http://127.0.0.1:4321' } },
  guardianDeny: { guardian: 'DENY' },
  dependencyMissing: { mode: 'run', guardian: 'ALLOW', dependency: 'MISSING' },
  dependencyUnavailable: { mode: 'run', guardian: 'ALLOW', dependency: 'UNAVAILABLE' },
})

// ---------------------------------------------------------------- C01 registered-row handoff
// A registered fixture row (synthetic). Handoff construction must bind to the
// immutable pre-tamper snapshot, not to any later echoed value.
export const REGISTERED_ROW = Object.freeze({
  id: 'TEST-E2E-001',
  spec: 'tests/e2e/checkout.spec.ts',
  node: 'checkout completes to confirmation',
  expectation: 'order confirmation rendered with a non-empty order id',
  allowedCommand: 'npx playwright test tests/e2e/checkout.spec.ts --reporter=json',
  environment: 'E2E_NONPROD_LOCAL_FIXTURE@http://127.0.0.1:4321',
})

// ---------------------------------------------------------------- C04/C10 runner evidence (F10)
export const F10_COUNTS = Object.freeze({ total: 3, executed: 3, passed: 3, failed: 0, skipped: 0, fixme: 0, filtered: 0 })
export const F10_ASSERTIONS = Object.freeze({
  total: 3,
  kind: 'behavioral',
  expected_behavior: 'submit transitions cart to confirmation with an order id',
  observed_result: 'confirmation heading and order-id element rendered',
})
export const F10_ENVELOPE = Object.freeze({
  test_id: 'TEST-E2E-001',
  flow: 'checkout',
  spec: 'tests/e2e/checkout.spec.ts',
  spec_sha256: 'REPLACE_AT_RUNTIME', // recomputed from scratch spec bytes by the test
  test_node: 'checkout completes to confirmation',
  command: 'npx playwright test tests/e2e/checkout.spec.ts --reporter=json',
  exit_code: 0,
  runner_status: 'PASS',
  assertion_summary: F10_ASSERTIONS,
  target_environment: 'E2E_NONPROD_LOCAL_FIXTURE@http://127.0.0.1:4321',
  artifacts: ['artifacts/checkout.trace.json'],
  start_time: '2026-11-23T10:00:00.000Z',
  end_time: '2026-11-23T10:00:09.000Z',
  redaction_status: 'passed',
  test_counts: F10_COUNTS,
  retry: { retries: 0, flaky: false },
})

// Independent mock-observer record. The envelope is never allowed to attest to itself:
// observable fields are compared against this separately supplied record.
export const F10_OBSERVER = Object.freeze({
  test_id: 'TEST-E2E-001',
  flow: 'checkout',
  spec: 'tests/e2e/checkout.spec.ts',
  spec_sha256: 'REPLACE_AT_RUNTIME',
  test_node: 'checkout completes to confirmation',
  command: 'npx playwright test tests/e2e/checkout.spec.ts --reporter=json',
  exit_code: 0,
  runner_status: 'PASS',
  target_environment: 'E2E_NONPROD_LOCAL_FIXTURE@http://127.0.0.1:4321',
  artifacts: ['artifacts/checkout.trace.json'],
  test_counts: F10_COUNTS,
  actual_cli: 'npx playwright test tests/e2e/checkout.spec.ts --reporter=json',
})

export const PRIOR_COUNTS_UNCHANGED = Object.freeze({ tests: 3, assertions: 3 })
export const PRIOR_COUNTS_TEST_DROP = Object.freeze({ tests: 4, assertions: 3 })
export const PRIOR_COUNTS_ASSERTION_DROP = Object.freeze({ tests: 3, assertions: 4 })

// ---------------------------------------------------------------- C10 fixture ignore rule / redaction
export const GITIGNORE_MATCH = 'artifacts/\n'
export const GITIGNORE_MISSING = '# no artifact rule\nnode_modules/\n'
export const GITIGNORE_UNRELATED = 'coverage/\nnode_modules/\n'

// Explicit safe synthetic sentinels — never real secrets, never logged verbatim in reports.
export const SENSITIVE_SAMPLES = Object.freeze({
  token: 'SYNTH_TOKEN_PLACEHOLDER_DO_NOT_USE',
  cookie: 'session=SYNTH_COOKIE_PLACEHOLDER',
  password: 'password=SYNTH_PASSWORD_PLACEHOLDER',
  pii: 'email=synth.user@example.invalid',
  privateUrl: 'https://internal.synth.invalid/admin',
})

export const REDACTED_SAMPLES = Object.freeze({
  token: '[REDACTED_TOKEN]',
  cookie: '[REDACTED_COOKIE]',
  password: '[REDACTED_PASSWORD]',
  pii: '[REDACTED_PII]',
  privateUrl: '[REDACTED_PRIVATE_URL]',
})

// ---------------------------------------------------------------- Phase 4 prompt delta (PROPOSAL ONLY)
// Verbatim UTF-8 bytes extracted from plan r3 §4 (lines 167-174), base64 so the
// em-dash and backticks cannot be corrupted by JS literal escaping. SHA-256 of the
// decoded bytes is 7693c0427d589e0c423d6b3a704eaf7ffc884fa3b8479bd5ad87fddf076c7cbd.
export const PROMPT_DELTA_INSERTION_B64 = 'KipERUMtMDcvMDgvMDkgc2FmZXR5IGFuZCBldmlkZW5jZSBvdmVycmlkZSoqIOKAlCB0aGVzZSByZXF1aXJlbWVudHMgdGFrZSBwcmVjZWRlbmNlIG92ZXIgY29uZmxpY3RpbmcgYGUyZS1ydW5uZXJgIGRlZmF1bHRzOgoKLSBQcm9kdWN0aW9uIG9yIHVua25vd24gdGFyZ2V0cyBhcmUgYEJMT0NLRURgIGJlZm9yZSBydW5uZXIgZGlzcGF0Y2gsIHByb2Nlc3Mgc3Bhd24sIG9yIG5ldHdvcmsgYWNjZXNzLiBOb24tcHJvZHVjdGlvbiByZXF1aXJlcyBleHBsaWNpdCBvd25lciBhdXRob3JpemF0aW9uIGZvciB0aGUgZXhhY3QgZW52aXJvbm1lbnQgYW5kIGVhY2ggcmVxdWVzdGVkIG9wZXJhdGlvbiwgaW5jbHVkaW5nIGhpZ2gtcmlzayBzaWRlIGVmZmVjdHM7IGEgR3VhcmRpYW4gZGVuaWFsIGlzIGZpbmFsLiBNaXNzaW5nLCB1bmNsZWFyLCBvciBtaXNtYXRjaGVkIGF1dGhvcml6YXRpb24gaXMgYEJMT0NLRURgLgotIFByZWZsaWdodCBtdXN0IGlkZW50aWZ5IHRoZSBiYXNlIFVSTCwgY2xhc3NpZmljYXRpb24sIG5hbWVkIHNlcnZpY2UsIGFjY291bnQgY2xhc3MsIGZpeHR1cmUgb3duZXIsIG5ldHdvcmsgc2NvcGUsIGFuZCBhbGxvd2VkIG11dGF0aW9ucy4gVXNlIHNhZmUgZml4dHVyZXMuIE5ldmVyIGluZmVyIGV4ZWN1dGlvbiBwZXJtaXNzaW9uIGZyb20gcG9saWN5IGFwcHJvdmFsIG9yIGEgcmVnaXN0cnkgZW50cnkuCi0gVXNlIGEgcGVyc2lzdGVudCBQbGF5d3JpZ2h0IHNwZWMgYW5kIGFuIGFscmVhZHktaW5zdGFsbGVkIFBsYXl3cmlnaHQgcnVubmVyOyBuZXZlciBhdXRvLWluc3RhbGwgYSBwYWNrYWdlLCBicm93c2VyLCBvciBDTEkuIEFnZW50IEJyb3dzZXIgaXMgb3B0aW9uYWwsIGRlZmF1bHQgT0ZGLCBhbmQgY2Fubm90IGVzdGFibGlzaCBjb3ZlcmFnZS4gTm8gZXh0ZXJuYWwgYXJ0aWZhY3QgdXBsb2FkIHdpdGhvdXQgYXBwcm92YWwuCi0gVGhlIHJ1bm5lciByZXR1cm5zIG9ic2VydmVkIGB0ZXN0X2lkYCwgZmxvdywgc3BlYyBwYXRoIGFuZCBTSEEtMjU2LCBleGFjdCB0ZXN0IG5vZGUsIGFjdHVhbCBQbGF5d3JpZ2h0IENMSSwgZXhpdCBjb2RlLCBydW5uZXIgc3RhdHVzLCBhc3NlcnRpb24gc3VtbWFyeSwgdGFyZ2V0IGVudmlyb25tZW50LCBhcnRpZmFjdHMsIHN0YXJ0L2VuZCB0aW1lcywgcmVkYWN0aW9uIHN0YXR1cywgYW5kIHRlc3QgY291bnRzLiBOZXZlciBleGVjdXRlIHJlY29yZGVkIHJlZ2lzdHJ5IGBDb21tYW5kOmAgdGV4dCBvciBpbnZlbnQgbWlzc2luZyBldmlkZW5jZS4KLSBgY292ZXJlZGAgcmVxdWlyZXMgbWVhbmluZ2Z1bCBiZWhhdmlvcmFsIGFzc2VydGlvbnMsIGF0IGxlYXN0IG9uZSBleGVjdXRlZCB0ZXN0LCBleGl0IDAsIGFuIGV4YWN0IGlkZW50aXR5IG1hdGNoLCBhbmQgZXhpc3RpbmcgcmVkYWN0ZWQgYXJ0aWZhY3RzIGluc2lkZSB0aGUgc2NvcGVkIGlnbm9yZWQgcm9vdC4gU2tpcHBlZCwgZmlsdGVyZWQsIHplcm8tdGVzdCwgd2VhaywgbWlzc2luZywgaW5jb25zaXN0ZW50LCBvciB1bnZlcmlmaWFibGUgZXZpZGVuY2UgbmV2ZXIgZWFybnMgY292ZXJhZ2U7IGZhaWx1cmVzIHN0YXkgZmFpbHVyZXMsIGFuZCByZXRyaWVzIGFyZSByZXBvcnRlZCBzZXBhcmF0ZWx5LiBQcm9wb3NlIGFueSByZWdpc3RyeSBjaGFuZ2Ugb25seSB1bmRlciBpdHMgc2VwYXJhdGUgYXV0aG9yaXphdGlvbiBnYXRlLgoK'

export const PROMPT_PREIMAGE_SHA = 'c562e0a2a2707c49362431b04ac1895f02c091e3d7ae193837ab6bf35b9d8436'
export const PROMPT_DELTA_INSERTION_SHA = '7693c0427d589e0c423d6b3a704eaf7ffc884fa3b8479bd5ad87fddf076c7cbd'
export const PROMPT_POSTIMAGE_SHA = 'f3e33e02aba9392308941ff98d5749a0aa50bd74d71684c29ff6afcf2aa1aab1'
export const PROMPT_DELTA_MARKER = '### 3.3 Dispatch the runner\n'
