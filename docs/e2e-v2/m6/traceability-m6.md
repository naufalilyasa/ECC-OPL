# M6 Traceability — ECC-OPL /e2e V2.0 Acceptance Release (AC-019..AC-022)

Plan: `docs/plans/e2e-v2-0-m6-acceptance-release.plan.md` (r4, APPROVED, SHA-256
`b00e7f10bdf28b05cbcd4680bf810b7535c0262f9ed28166823038d8a6815370`).
This is the final acceptance artifact for V2.0. It records honest terminal
outcomes for all 48 scenarios and all 14 negative mutations, with the gate
state that keeps live deployment blocked.

## 1. Status taxonomy (AC-018)

| Status | Meaning | Granted only when |
|---|---|---|
| `PASS` | Executed evidence exists | Real scratch Playwright run on loopback with genuine exit code/artifact hashes, or an executed deterministic invariant (gate, frozen hashes, bundle validation, mutation suite, focused tests, write-boundary audit, before/after hashes, release policy). |
| `REFERENCE_VERIFIED` | Deterministic harness over synthetic fixtures | A named assertion was executed over the authoritative fixture/matrix; no live model session or external system involved. Never presented as a live pass. |
| `NOT_RUN` | Not executed | Live interactive multi-phase model orchestration (A08) was not executed in an unattended run. |

A simulated receipt is **never** labeled `PASS`. Flaky/skipped/zero-assertion
runs are folded into `UNVERIFIED`/`NOT_EXECUTED`, never hidden inside a pass.

Final tally: **13 PASS · 34 REFERENCE_VERIFIED · 1 NOT_RUN = 48**.

## 2. Acceptance criteria coverage (AC-001..AC-022)

| AC | M6 disposition | Evidence |
|---|---|---|
| AC-001 | REFERENCE_VERIFIED (A01, A07, E01, E04) | `prompt-conformance.report.json`, `scope-check.report.json` |
| AC-002 | REFERENCE_VERIFIED (A02, B07) | `acceptance-ledger.json`, `parity-audit.report.json` |
| AC-003 | REFERENCE_VERIFIED (A03) | `prompt-conformance.report.json` |
| AC-004 | REFERENCE_VERIFIED (A04) | `prompt-conformance.report.json` |
| AC-005 | REFERENCE_VERIFIED (A05, A06) | `acceptance-ledger.json` |
| AC-006 | REFERENCE_VERIFIED (C02) | `acceptance-ledger.json` |
| AC-007 | REFERENCE_VERIFIED (C03) | `acceptance-ledger.json` |
| AC-008 | NOT_RUN (A08 live session) | `acceptance-ledger.json` |
| AC-009 | REFERENCE_VERIFIED (B06, B08, B09, D09) | `parity-audit.report.json` |
| AC-010 | REFERENCE_VERIFIED (B10, E03) | `parity-audit.report.json`, `coverage.report.json` |
| AC-011 | PASS (D02) + REFERENCE_VERIFIED (C08, D03) | `env-boundary.report.json` |
| AC-012 | PASS (C05, C07) | `playwright-execution.report.json` |
| AC-013 | PASS (C06) | `playwright-execution.report.json` |
| AC-014 | PASS (C01 executed evidence, C04, C10) | `playwright-execution.report.json`, `acceptance-ledger.json` |
| AC-015 | REFERENCE_VERIFIED (C12, E05) | `scope-check.report.json`, `acceptance-ledger.json` |
| AC-016 | REFERENCE_VERIFIED (B11, B12, D04) + mutation suite | `parity-audit.report.json`, `mutation-suite.report.json` |
| AC-017 | REFERENCE_VERIFIED (D06–D10) | `parity-audit.report.json` |
| AC-018 | PASS (D05, E03, E06) | `m6-preflight.report.json`, `coverage.report.json`, `m6-decision-packet.json` |
| AC-019 | REFERENCE_VERIFIED (B01–B06) | `parity-audit.report.json` |
| AC-020 | REFERENCE_VERIFIED (A07, C11, D01) | `prompt-conformance.report.json`, `env-boundary.report.json` |
| AC-021 | PASS — unified 48-scenario ledger | `acceptance-ledger.json` |
| AC-022 | PASS — 14/14 mutations DETECTED | `mutation-suite.report.json` |

## 3. PRD requirements

| Requirement family | Coverage |
|---|---|
| E2E-FR-001 (parser/mode) | A01, A07, E01 — `prompt-conformance.report.json`, `scope-check.report.json` |
| E2E-FR-002 (proposal bootstrap) | A02, B07 — `acceptance-ledger.json` |
| E2E-FR-003 (status/no-write) | A02–A04 — `prompt-conformance.report.json` |
| E2E-FR-004 (resolver) | A05, A06 — `acceptance-ledger.json` |
| E2E-FR-005 (registry required) | C02 — `acceptance-ledger.json` |
| E2E-FR-006 (ad-hoc label) | C03 — `acceptance-ledger.json` |
| E2E-FR-007 (full phases) | A08 — NOT_RUN |
| E2E-FR-008 / 009 (registry fields/idempotence) | B06, B08, B09, D09, C12 — `parity-audit.report.json`, `scope-check.report.json` |
| E2E-FR-010 (state enum) | B10, E03 — `parity-audit.report.json`, `coverage.report.json` |
| E2E-FR-011 (environment gate) | C08, D02, D03 — `env-boundary.report.json` |
| E2E-FR-012 (assertion quality/outcomes) | C04–C07 — `playwright-execution.report.json` |
| E2E-FR-013 (handoff/evidence/redaction) | C01, C04, C10 — `playwright-execution.report.json` |
| E2E-FR-014 (field-scoped updates) | C12, E05 — `acceptance-ledger.json`, `scope-check.report.json` |
| E2E-FR-015 (path safety) | B11, D04 — `parity-audit.report.json` |
| E2E-FR-016 / 017 (alias/discovery/rollback) | D06–D10 — `parity-audit.report.json` |
| E2E-FR-018 (frozen hashes/outcomes/gates) | D05, E03, E06 — `m6-preflight.report.json`, `m6-decision-packet.json` |
| E2E-FR-019 (route mapping) | B01–B06 — `parity-audit.report.json` |
| E2E-FR-020 (untrusted input) | A07, C11, D01 — `prompt-conformance.report.json`, `env-boundary.report.json` |
| E2E-NFR-001 (environment isolation) | D02 — `env-boundary.report.json` |
| E2E-NFR-002 (no auto-install / fail closed) | C08, D02 — `env-boundary.report.json` |
| E2E-NFR-003 (path/credential safety) | B11, C10, D04 — `playwright-execution.report.json`, `parity-audit.report.json` |
| E2E-NFR-004 (read-only modes) | A03, D01 — `prompt-conformance.report.json` |
| E2E-NFR-005 (frozen baselines/registry absent) | D05, E01, E04 — `m6-preflight.report.json`, `scope-check.report.json` |
| E2E-NFR-006 (rollback) | D10, E05 — `parity-audit.report.json`, `scope-check.report.json` |
| E2E-NFR-007 (flakiness separation) | C07, C09 — `playwright-execution.report.json`, `acceptance-ledger.json` |

## 4. 48-scenario ledger (authoritative matrix order)

`PASS` = executed evidence; `RV` = REFERENCE_VERIFIED; `NR` = NOT_RUN.
Full per-scenario fields (stimulus, expected, fixture IDs, requirement IDs,
PRD AC, evidence artifact path + SHA-256) are in `reports/acceptance-ledger.json`.

| ID | Group | Status | Evidence report |
|---|---|---|---|
| A01 | Interface | RV | prompt-conformance |
| A02 | Interface | RV | prompt-conformance |
| A03 | Interface | RV | prompt-conformance |
| A04 | Interface | RV | prompt-conformance |
| A05 | Interface | RV | prompt-conformance |
| A06 | Interface | RV | prompt-conformance |
| A07 | Interface | RV | prompt-conformance |
| A08 | Interface | **NR** (live multi-phase model session) | prompt-conformance |
| B01–B06 | Mapping | RV | parity-audit |
| B07–B12 | Mapping | RV | parity-audit |
| C01 | Execution | RV | env-boundary |
| C02 | Execution | RV | env-boundary |
| C03 | Execution | RV | env-boundary |
| C04 | Execution | **PASS** | playwright-execution |
| C05 | Execution | **PASS** | playwright-execution |
| C06 | Execution | **PASS** | playwright-execution |
| C07 | Execution | **PASS** | playwright-execution |
| C08 | Execution | RV | env-boundary |
| C09 | Execution | RV | env-boundary |
| C10 | Execution | **PASS** | playwright-execution |
| C11 | Execution | RV | env-boundary |
| C12 | Execution | RV | env-boundary |
| D01 | Security | RV | parity-audit |
| D02 | Security | **PASS** | env-boundary |
| D03 | Security | RV | parity-audit |
| D04 | Security | RV | parity-audit |
| D05 | Security | **PASS** (frozen hashes) | m6-preflight |
| D06–D10 | Migration | RV | parity-audit |
| E01 | Release | **PASS** (bundle validator) | scope-check |
| E02 | Release | **PASS** (14/14 mutations) | mutation-suite |
| E03 | Release | **PASS** (focused tests + coverage) | coverage |
| E04 | Release | **PASS** (write-boundary audit) | scope-check |
| E05 | Release | **PASS** (before/after hashes) | scope-check |
| E06 | Release | **PASS** (release gate policy) | m6-decision-packet |

## 5. Scratch Playwright loopback execution (DEC-07 / DEC-08)

- Engine: Playwright **1.65.1** + Chromium **1255**, installed only under
  `/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright`.
- `PLAYWRIGHT_BROWSERS_PATH` pinned to `.../m6-playwright/pw-browsers`.
- Target: ephemeral Node `http.createServer` bound to `127.0.0.1:0`, label
  `E2E_NONPROD_LOCAL_FIXTURE`. No external network, no production target.
- Real worker process exit codes: happy `0` (behavioral assertion, 3 hashed
  artifacts: evidence.txt, screenshot.png, trace.zip), weak `0`
  (`PASS_UNVERIFIED`), broken `1` (`FAIL`), skipped `0` / zero tests
  (`NOT_EXECUTED`), credential run with synthetic token redacted (`2` redactions).
- Full records: `reports/playwright-execution.report.json`.

## 6. 14 negative mutations (AC-022)

All 14 carriers were executed against independent oracle invariants; all are
`DETECTED`. Mutations 10 and 12 are honestly reused from M4; 13 and 14 from M5.

| Mutation | Carrier / expected gate | Result |
|---|---|---|
| Mutation 1 | `/e2e map` runner dispatch → `runnerInvocations === 0` | DETECTED |
| Mutation 2 | `/e2e status` registry write → `registryWrites === 0` | DETECTED |
| Mutation 3 | bare `/e2e` browser launch → `browserInvocations === 0` | DETECTED |
| Mutation 4 | unregistered run → `REGISTRY_REQUIRED` | DETECTED |
| Mutation 5 | ad-hoc PASS → state ≠ covered, zero registry writes | DETECTED |
| Mutation 6 | duplicate TEST-E2E ID → `DUPLICATE_ID_REJECTED` | DETECTED |
| Mutation 7 | `../../` / symlink escape → `PATH_REJECTED` | DETECTED |
| Mutation 8 | `State: stale` → `INVALID_REGISTRY_STATE` | DETECTED |
| Mutation 9 | shell text in Command → `shellInvocations === 0` | DETECTED |
| Mutation 10 | visibility-only exit 0 → `PASS_UNVERIFIED` (M4) | DETECTED |
| Mutation 11 | skipped/zero tests → `NOT_EXECUTED` | DETECTED |
| Mutation 12 | production target → `BLOCKED_PRODUCTION_TARGET` (M4) | DETECTED |
| Mutation 13 | concurrent overwrite → `WRITE_CONFLICT` (M5) | DETECTED |
| Mutation 14 | premature `/e2e-map` disable → `BLOCKED_PREMATURE_DISABLE` (M5) | DETECTED |

Evidence: `reports/mutation-suite.report.json` (14/14, zero bypasses).

## 7. Final gate state (DEC-10)

| Gate | Status |
|---|---|
| P1 — Effective command resolution | **NOT_VERIFIED** (ASM-01 inconclusive in M2) |
| P2 — Parity | VERIFIED_IN_M5_AND_M6 (F01–F06 + F13) |
| P3 — Registry safety | VERIFIED_IN_M3_M5_M6 |
| P4 — Rollback readiness | VERIFIED_IN_M5_AND_M6 (5-file byte-exact rehearsal) |
| P5 — Owner deployment authorization | **NOT_GIVEN** |

Overall deployment status: **BLOCKED_DEPLOYMENT_GATED**. Live `/e2e-map`
disablement is refused. Production targets: **BLOCKED**. Owner must provide
a P1 probe result and an explicit out-of-band P5 instruction naming `/e2e-map`
before any live change. Evidence: `reports/m6-decision-packet.json`.

## 8. Frozen baselines (all byte-identical)

| Tree | Files | SHA-256 |
|---|---|---|
| m1 | 16 | `8416c0671af8ae60850d9d72f249968976c907cf4aa62b605d663bd5eb1625ca` |
| m2 | 27 | `2f81da73f2068357f4265a3cfbaf6a9435a3e502d52dcd32d33b3b445fc97588` |
| m3 | 17 | `2e8c7cf63a44b3d073185be0a4fe59de87fd9583ffc79abc6066b151066e23c7` |
| m4 | 20 | `88c50d13760dd24dd47b9e5f2a2d8aa707b0f008abcf19b06fa7370641bc7807` |
| m5 | 23 | `267c3b8bce980c97cadfc54b815fb79190d9a8f9f6951cb29ae92839dbf7b014` |
| contracts | 3 | `a550f29ea751c7635cdc5d73bbc2e6a0a29d7cdf7153e43f23e429a4f4e05e8c` |

Canonical encoding: sorted `repo-relative path<TAB>file sha256<LF>`.
`TESTS.md` and `.governance/docs-map.json` remain absent. Active
`~/.config/opencode/opencode.jsonc` drift is recorded observationally as
`owner_config_drift.observed_sha256` computed at report-generation time,
owner-authorized, excluded from pass/fail, never compared to a constant, with
zero modification or restoration.

**AUTHORIZED_DELTA: none.**
