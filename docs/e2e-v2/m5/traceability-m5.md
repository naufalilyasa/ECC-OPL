# M5 Traceability & M6 Handoff — Migration & Rollback (AC-015..AC-018)

Plan: `docs/plans/e2e-v2-0-m5-migration-rollback.plan.md` r3, SHA-256
`747a1c2a25ee52612cd002739d36f0cd882cb10bd2f580243fe7268170f94b59`
(review APPROVE, owner APPROVED). Scope is strictly `docs/e2e-v2/m5/**`.

## Two-layer claim

- **Reference layer (proven here):** all migration, concurrency, parity,
  discovery, terminal-outcome, rollback and gate logic is exercised by
  `docs/e2e-v2/m5/tests/m5.test.mjs` (27 tests, all passing) over synthetic
  F07/F09/F11/F13/F14 fixtures, with zero dependency, zero subprocess, zero
  browser, zero network, zero registry write and zero active config mutation.
- **Live layer (deferred):** no real registry was written; no live command was
  disabled; no browser or runner was spawned. Every report carries
  `live_prompt_verification: DEFERRED_TO_M6`,
  `live_playwright_execution: DEFERRED_TO_M6`, `fixture_provenance:
  SYNTHETIC_REFERENCE`, `registry_writes: 0`, `applied: false`. Live criteria
  are `DEFERRED_TO_M6` and are never claimed as passes.

## AC / requirement / scenario → test → report → status

| AC / FR | Scenarios | Test (m5.test.mjs) | Report | Reference outcome | Live status |
|---|---|---|---|---|---|
| AC-015 / E2E-FR-015 | C12, E05, F07 | `AC-015: permitted fields…`, `…before/after SHA…`, `…FIELD-NOT-PERMITTED`, `…unmatched block…`, `…absent field inserted…` | `registry-block.diff.json` | PASS — only matched block's 5 fields move; others byte-identical; illegal fields rejected | DEFERRED_TO_M6 |
| AC-016 / E2E-FR-016 | B11, B12, D04, F09, F11 | `B11: registry path traversal…`, `D04: a symlink component…`, `B12: unchanged hash…`, `B12: two-writer race…` | `registry-path.reject.json`, `symlink-escape.reject.json`, `concurrency.report.json` | PASS — `PATH_REJECTED`/`SYMLINK_ESCAPE`; `WRITE_CONFLICT` + rebase; non-clobber | DEFERRED_TO_M6 |
| AC-017 / E2E-FR-017 | D06, D07, D08, F01–F06, F13, DEC-04 | `D06: parity holds…`, `…dropped route…`, `D07: legacy…`, `…canonical…`, `D08: simulated post-disable…` | `parity.report.json`, `alias-no-run.trace.json`, `discovery-after-disable.report.json` | PASS — parity across all 7 stacks; legacy hint with 0 runner calls; single default `/e2e` in fixture | DEFERRED_TO_M6 |
| AC-018 / E2E-FR-018 | C09, D05, E06, F14, Gate P4 | `E06: canonical terminal enum…`, `…fabricated…`, `C09: retries/flakiness…`, `…unknown raw…`, `D10: rollback rehearsal…`, `…byte mismatch…` | `terminal-outcomes.report.json`, `flakiness.report.json`, `restore-rehearsal.report.json` | PASS — strict 6-value enum; `UNVERIFIED` on fabricated/unknown; flakiness isolated; `ROLLBACK_VERIFIED`, 5 hashes | DEFERRED_TO_M6 |
| DEC-10 (cross-cutting) | P1–P5, E02 | `DEC-10: P1 NOT_VERIFIED + P5 NOT_GIVEN…`, `MUT-13…`, `MUT-14…` | `m5-decision-packet.json`, `mutation-suite.report.json` | PASS — `BLOCKED_DEPLOYMENT_GATED`; mutations 13 & 14 detected | deployment pending owner |

Negative mutations:
- **Mutation 13** (concurrency overwrite bypass): carrier `runMutation13()`,
  oracle detects `observedClobber: true` vs `expectedClobber: false` →
  `detected: true`.
- **Mutation 14** (premature disable-default): carrier `runMutation14()`, gate
  oracle returns `BLOCKED_PREMATURE_DISABLE`, `detected: true`.

## Gate P1–P5 status (DEC-10 honesty)

| Gate | Status | Basis |
|---|---|---|
| P1 Effective resolution | **NOT_VERIFIED** | ASM-01 inconclusive in M2; winner not assumed. |
| P2 Parity | VERIFIED_IN_M5_REFERENCE | `parity.report.json` — F01–F06 + F13. |
| P3 Registry safety | VERIFIED_IN_M5_REFERENCE | field-scoped updates + DEC-04 hint + conflict/path checks. |
| P4 Rollback readiness | VERIFIED_IN_M5_REFERENCE | `restore-rehearsal.report.json` — 5-file byte-exact rehearsal in 0700 scratch → `ROLLBACK_VERIFIED`. |
| P5 Owner deployment authorization | **NOT_GIVEN** | No explicit disable-default instruction naming `/e2e-map`. |

Live `/e2e-map` disable-default is strictly **BLOCKED_DEPLOYMENT_GATED**: P1 is
`NOT_VERIFIED` and P5 is `NOT_GIVEN`. The harness returns
`disableDefaultPermitted: false` and emits `m5-decision-packet.json`. M5 makes
**no** claim of disable readiness. M6 may proceed only after the owner reviews
that packet, verifies P1 in an isolated probe, and issues explicit P5
authorization.

## Rollback rehearsal (Gate P4)

`rehearseRollback()` copies the 5 pinned targets' bytes into disposable 0700
scratch, records SHA-256 for each, rehearses disablement against fixture copies
only, restores exact backup bytes, and re-verifies all five hashes →
`ROLLBACK_VERIFIED`, `verifiedFiles: 5`, `activeTreeWrites: 0`. A corruption
probe returns `ROLLBACK_FAILED`. Active repository and HOME were never written.

## Frozen baselines & boundary

| Tree | Files | SHA-256 | Verified |
|---|---|---|---|
| m1 | 16 | `8416c0671af8ae60850d9d72f249968976c907cf4aa62b605d663bd5eb1625ca` | identical |
| m2 | 27 | `2f81da73f2068357f4265a3cfbaf6a9435a3e502d52dcd32d33b3b445fc97588` | identical |
| m3 | 17 | `2e8c7cf63a44b3d073185be0a4fe59de87fd9583ffc79abc6066b151066e23c7` | identical |
| m4 | 20 | `88c50d13760dd24dd47b9e5f2a2d8aa707b0f008abcf19b06fa7370641bc7807` | identical |
| contracts | 3 | `a550f29ea751c7635cdc5d73bbc2e6a0a29d7cdf7153e43f23e429a4f4e05e8c` | identical |

Pinned active command/config preimages remain byte-identical (`e2e.md`
`c562e0a2…`, `e2e-map.md` `76b3d403…`, three config files unchanged). `TESTS.md`
and `.governance/docs-map.json` remain absent. Write boundary audit:
`scope-check.report.json` (0 outside writes). No pre-existing authorized delta
is carried into M5. AUTHORIZED_DELTA: none.

## Verification evidence

- `m5.test.mjs`: 27/27 pass (node v24.21.0).
- Conformance `conformance.test.mjs`: 4/4 pass.
- Regression: M4 54/54, M3 30/30, M2 53/53 pass (M1 verified by tree hash only,
  per plan).
- Coverage (module-level, ≥80/80/80): `migration.mjs`
  100.00/81.42/100.00 (lines/branches/functions); `emit-m5-reports.mjs`
  99.24/87.10/100.00. See `coverage.report.json`.
- Reports: 16 total — 13 emitted by `emit-m5-reports.mjs`, plus
  `prompt-conformance.report.json`, `coverage.report.json`,
  `scope-check.report.json`.
- TDD RED/GREEN/coverage log: `tdd-record.md`.
