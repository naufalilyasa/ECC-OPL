# M4 Traceability — Runner & Evidence Hardening (reference layer)

**Status:** M4 reference harness EXECUTED; AC-011..AC-014 proven at reference/fixture layer only.
**Live status:** all live/browser/ASM criteria `NOT_RUN` / `DEFERRED_TO_M6`.
**Plan:** `docs/plans/e2e-v2-0-m4-runner-evidence.plan.md` r3, SHA-256 `848f35c3…` (approved).
**Boundary:** `docs/e2e-v2/m4/**` only; no prompt edit, no registry write, no frozen-tree change.

## 1. Two-layer claim

| Layer | What is proven | What is NOT proven |
|---|---|---|
| Reference/fixture (this milestone) | Gate fail-closed logic, evidence evaluator, outcome mapping, count regressions, fixture ignored-root rule, redaction sample check, mutations 10/12 detection — all over synthetic F10/F12 inputs | Real Playwright execution, real `/e2e` dispatch, real Guardian Angel enforcement, real owner consent, real registry mutation, real assertion quality, real redaction of traces/screenshots |
| Live (M6, separately authorized) | Not executed | Every live criterion below |

Fixture `PASS_VERIFIED` is a validator verdict over synthetic data with
`live_coverage_credit: false`. It is never a `covered` registry state and never an
actual user-coverage claim. A fixture `Command:` string is data; it was never executed.

## 2. AC / FR / scenario → test → report → status

| AC | FR / scenario | Test (all in `tests/m4.test.mjs` unless noted) | Report | Reference result | Live status |
|---|---|---|---|---|---|
| AC-011 | E2E-FR-011 / D02 | `D02: approved non-production run/full…`, `production and unknown…`, `every missing/malformed target field…`, `missing, mismatched and partial approval…`, `Guardian denial is final…`, `unapproved non-high-risk operation…` | `env-gating.report.json` | approved synthetic → spy exactly once; production/unknown/malformed/no-approval/partial/Guardian-DENY → `BLOCKED`, 0 spy calls | `DEFERRED_TO_M6` |
| AC-011 | E2E-FR-011 / C08 | `C08: dependency available…`, `C08: missing/unavailable dependency…` | `blocked-dependency.report.json` | available → 1 spy call; missing/unavailable → `BLOCKED_DEPENDENCY`, 0 calls, `install_attempts: 0`, `playwright_probes: 0` | `DEFERRED_TO_M6` |
| AC-011 | mutation 12 | `Mutation 12: synthetic D02 bypass is DETECTED…`, `Mutation 12: the real gate still blocks…`, `Mutation 12 carrier: missing dependency…` | `mutation-suite.report.json` | `DETECTED`: mutant observed dispatch 1 vs expected 0; independent D02 oracle (not a label assertion) | `DEFERRED_TO_M6` |
| AC-012 | E2E-FR-012 / C05 | `C05: weak-only (visibility/no assertions) yields PASS_UNVERIFIED…`, `C05: a strong behavioral assertion…` | `weak-assertion.report.json` | visibility/tautological/zero/unknown → `PASS_UNVERIFIED`, `credit_eligible: false`; strong behavioral → fixture-only `PASS_VERIFIED`, `live_coverage_credit: false` | `DEFERRED_TO_M6` |
| AC-012 | E2E-FR-012 / C07 | `C07: zero, skipped, fixme and all-filtered cases are NOT_EXECUTED…` | `runner.evidence.json` | `executionState: NOT_EXECUTED`, no credit | `DEFERRED_TO_M6` |
| AC-012 | mutation 10 | `Mutation 10: bypass crediting visibility-only assertions is DETECTED` | `mutation-suite.report.json` | `DETECTED`: mutant granted credit (1) vs oracle expected (0), with the actual weak-assertion reason quoted | `DEFERRED_TO_M6` |
| AC-012, AC-014 | count regression (§4) | `count regression: independent test-count and assertion-count drops…`, `unchanged and increased counts pass…`, `an anomaly prevents COMPLETE…` | `runner.evidence.json` | either count decrease → explicit anomaly, `completeEligible: false`, fixture verdict `UNVERIFIED`; unchanged passes count gate | `DEFERRED_TO_M6` |
| AC-013 | E2E-FR-012 / C06 | `C06: nonzero exit is FAIL with an unverified proposal…`, `C06: a trustworthy FAIL survives…` | `fail-downgrade.report.json` | `outcome: FAIL`, `proposed_state: unverified`, `applied: false`, `registry_writes: 0`, registry SHA before = after on a real scratch file | `DEFERRED_TO_M6` |
| AC-014 | E2E-FR-013 / C01 | `C01: handoff is built from a registered row…`, `changed observable expectation, spec or ID…`, `an echoed observer cannot re-authorize…`, `a tampered allowlist…` | `handoff.request.json` | exact ID/spec/node/expectation/environment/CLI bound to immutable pre-tamper snapshot; changed field → no fixture `PASS_VERIFIED`, no credit; `dispatchCount: 0` | `DEFERRED_TO_M6` |
| AC-014 | E2E-FR-012/013 / C04 | `C04: valid synthetic F10 record…`, `envelope/observer identity mismatches…`, `slash-command CLI…`, `spec SHA mismatch…`, `malformed exit codes…` | `runner.evidence.json` | independent observer/envelope comparison; real scratch spec SHA recomputed from bytes; repo-relative + realpath containment; non-allowlisted `/e2e`/shell CLI rejected | `DEFERRED_TO_M6` |
| AC-014 | E2E-FR-013 / C10 | `C10: matching literal fixture artifacts/ rule…`, `missing or unrelated…`, `missing, absolute, traversal and symlink-escaping artifacts…`, `fake redaction flag…`, `redacted safe samples…`, `fixture ignore check never inspects .git…`, edge non-regular artifact | `artifact-redaction.report.json` | matching literal fixture rule accepted; missing/unrelated rejected; symlink escape/traversal/missing/non-regular rejected; flag-only redaction rejected; `real_git_ignore_verified: false` | `DEFERRED_TO_M6` |
| AC-014 | prompt contract (static) | `tests/conformance.test.mjs` (7+1 cases), `tests/prompt-conformance.strict.mjs` (4 cases) | `prompt-conformance.report.json` | current preimage honestly `MISSING_CONTRACT` / `NOT_IMPLEMENTED`; forged insertion detected in memory and hashes to proposed postimage; altered insertion rejected; `applied: false` | `DEFERRED_TO_M6` |
| — | evidence emitter | `EMIT-1..EMIT-6` | all 8 scenario reports + prompt report | 9 reports parse as JSON, carry deferred labels, `registry_writes: 0`, no raw sentinels, no invented executed CLI; mismatched contract throws | — |

## 3. Authorization and safety gates

| Gate | Record | Status |
|---|---|---|
| DEC-07 non-production + per-operation approval | synthetic gate tests; policy-only M6 proposal pinned `bc7b6afa…` | Reference behavior proven; real operation authorization NOT granted |
| DEC-08 coverage authority (persistent spec + observed run) | `runner.evidence.json` identity/SHA/CLI observer checks | Fixture-only; actual Playwright observation DEFERRED_TO_M6 |
| DEC-09 Agent Browser default OFF / Playwright baseline | `prompt-conformance.report.json` classifies preimage as missing this rule; delta PROPOSAL ONLY | NOT_IMPLEMENTED at source; no live precedence claim |
| Guardian Angel denial final | D02 Guardian-denial case: 0 spy calls | Reference logic only; real Guardian not inspected (forbidden surface) |
| Registry writes | every report `registry_writes: 0`; downgrade `applied: false`; `TESTS.md` and docs-map absent | Verified at reference layer |

## 4. Gates that remain NOT_VERIFIED / NOT COMPLETE

- `ASM-01/ARGS`, `ASM-01/PRECEDENCE`, `ASM-02`: `NOT_VERIFIED` (no isolated command-resolution probe; no detector portability claim).
- `D05` Guardian/Git policy/core behavior: `NOT_VERIFIED` (no `.git`/`.guardian-angel` access; only frozen workflow files re-hashed).
- `AC-015`, `AC-016`, `AC-017`, `AC-018`: `NOT COMPLETE` (outside M4 scope).
- Live prompt verification, live Playwright execution, real assertion provenance,
  binary-artifact redaction: `DEFERRED_TO_M6`.
- Frozen gate metadata `prd_acs` mismatch with PRD §8 is preserved as-is; PRD §8 controls this mapping.

## 5. Phase 4 prompt delta — PROPOSAL ONLY

The owner approved the M4 plan r3, which explicitly leaves the `.opencode/commands/e2e.md`
delta to a separate exact-diff approval. That approval was NOT given. Therefore:

- No byte of `.opencode/commands/e2e.md` was changed (still `c562e0a2…`).
- Proposed insertion bytes/hashes are recorded in `prompt-conformance.report.json` with
  `status: PROPOSAL_ONLY`, `applied: false`.
- Strict classification lives in `tests/prompt-conformance.strict.mjs` (intentionally
  outside the `*.test.mjs` glob) so no static test silently claims the delta is live.

## 6. Frozen baseline

m1 (16, `8416c067…`), m2 (27, `2f81da73…`), m3 (17, `2e8c7cf6…`), contracts
(3, `a550f29e…`) — all byte-identical before and after. M2 20-file manifest: 0 drift.
M1 frozen-hashes workflow files: 0 drift. Pre-existing M1-01/M1-11 deltas are
`AUTHORIZED_DELTA` carried from M3, not repaired here. See `reports/m4-preflight.report.json`.
