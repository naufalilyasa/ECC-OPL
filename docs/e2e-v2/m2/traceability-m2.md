# M2 Traceability & Review Handoff (ECC-OPL /e2e V2.0)

Status: `M2 COMPLETE` (unified interface, mode parser, deterministic validators, isolated command-resolution validation)
Milestone: M2 of 6
Plan: `docs/plans/e2e-v2-0-m2-unified-interface.plan.md` r2 — `6c16df5b4e9d0638054552f854c68a5040bbaa0983d8e4d9cdb798267b5d5037`
Approved PRD digest: `047918df0835bc7ea52f0d0dc7714f0b29394cce32ad8c2580b2973dfce1d211`
Recorded: 2026-11-23

Read this after `docs/e2e-v2/m1/traceability-m1.md`. It says what M2 proves, what it ran, what it
deliberately did not do, and which gaps stay open for M3–M6.

## 0. Two-layer honesty (applies to every row below)

Every report in `docs/e2e-v2/m2/reports/` carries
`live_prompt_verification: "DEFERRED_TO_M6 (48-scenario acceptance)"`.
Harness results prove the **reference implementation** (parser grammar, validators, resolver,
detector) and the frozen case matrix. They do **not** prove that the live `.opencode/commands/e2e.md`
prompt behaves identically — that is M6's 48-scenario acceptance run. No browser, Playwright, shell
execution of a recorded `Command:`, registry write, install, or network call occurred.

## 1. Artifact → scenario → AC → requirement

| Scenario | Artifact → evidence path | AC | Requirement | Status | Evidence kind |
|---|---|---|---|---|---|
| Preflight | `m2/reports/m2-preflight.report.json` → 8 repo sources vs frozen table | AC-001 (baseline chain) | E2E-NFR-005 | `PASS`, 0 drift | hash recomputation |
| ASM-01 | `m2/reports/command-resolution.report.json` → cold private instance probe | AC-017 (supporting) | E2E-FR-017 | `INCONCLUSIVE` — gate stays open | raw CLI output, sandbox deleted |
| A01 | `.opencode/commands/e2e.md` → 6-mode parse/gate/run/resolve/read-only sections | AC-001..AC-005 | E2E-FR-001..005 | REWRITTEN (1 `AUTHORIZED_DELTA`) | product file |
| A01 | `m2/tests/parser.mjs` + `m2.test.mjs` → parser suite (PS-01..PS-08 grammar) | AC-001 | E2E-FR-001, E2E-NFR-002 | `PASS` 53/53 suite | `node --test` |
| A07 | `m2/reports/parser-failclosed.report.json` → PS-01/02/03/04/08 | AC-001 | E2E-FR-001, E2E-FR-020, E2E-NFR-002 | `EXECUTED`, 5/5 PASS | executable harness |
| A07 | `m2/reports/prompt-injection.report.json` → PS-05/06/07 | AC-001 | E2E-FR-001, E2E-NFR-002 | `EXECUTED`, 3/3 PASS, 0 executions | executable harness |
| B09 | `m2/reports/command-not-executed.trace.json` → PS-09 | AC-001 | E2E-FR-001, E2E-NFR-002 | `EXECUTED`, verbatim data, `executed:false` | executable harness |
| B11 | `m2/reports/registry-path.reject.json` → RP-01..06 | AC-016 | E2E-FR-020, E2E-NFR-003 | `EXECUTED`, 6/6 PASS | executable harness |
| D04 | `m2/reports/symlink-escape.reject.json` → SE-01..04 | AC-016 | E2E-FR-015 | `EXECUTED`, 4/4 PASS | executable harness |
| B10 | `m2/reports/stale-assessment.report.json` → 4 State/assessment rows | AC-016 (supporting) | E2E-FR-010, E2E-FR-015 | `EXECUTED`, 4/4 PASS | executable harness |
| AC-005 | `m2/tests/resolver.mjs` + `m2.test.mjs` → 6 resolver checks | AC-005 | E2E-FR-004 | `PASS` | `node --test` |
| ASM-02 / B01 | `m2/reports/F01-map-output.json` → F01 Next.js App Router | AC-002, AC-019 | E2E-FR-019 | `EXECUTED`, contract_passed | fixture execution |
| ASM-02 / B02 | `m2/reports/F02-map-output.json` → F02 Next.js Pages | AC-002, AC-019 | E2E-FR-019 | `EXECUTED`, contract_passed | fixture execution |
| ASM-02 / B03 | `m2/reports/F03-map-output.json` → F03 Laravel + Inertia | AC-002, AC-019 | E2E-FR-019 | `EXECUTED`, contract_passed | fixture execution |
| ASM-02 / B04 | `m2/reports/F04-F06-map-output.json` → F04/F05/F06 | AC-002, AC-019 | E2E-FR-019 | `EXECUTED`, contract_passed | fixture execution |
| B05 | `m2/reports/locale-dedup.report.json` → LD-01..05 | AC-019 | E2E-FR-019 | `EXECUTED`, 5/5 PASS | journey-contract check |
| B06 | `m2/reports/journey-grouping.report.json` → JG-01..07 | AC-009 (supporting) | E2E-FR-008, E2E-FR-019 | `EXECUTED`, 7/7 PASS | journey-contract check |
| E04 | `m2/reports/scope-check.report.json` → write surface, 1 delta, 0 violations | AC-001 | E2E-NFR-005 | `PASS` | executable read-only |
| — | `m2/reports/frozen-artifacts.manifest.json` → 20 frozen M1 files + hashes | AC-001 | E2E-NFR-005 | RECORDED snapshot | hash snapshot |
| M2 guard | `m2/tests/m2.test.mjs` → 53 invariant checks | AC-001..AC-005, AC-016, AC-019 | E2E-NFR-002/005 | `PASS` 53/53 | `node --test` |
| Process | `m2/tdd-record.md` → RED/GREEN/REFACTOR checkpoints 1–14e | — | — | APPEND-ONLY | execution log |

Every M2 artifact appears in at least one row above. No M3–M6 artifact is claimed done.

## 2. Case coverage (19 PS/RP/SE + B10, each exactly once)

| Report | Case IDs | Verdicts |
|---|---|---|
| `parser-failclosed.report.json` | PS-01, PS-02, PS-03, PS-04, PS-08 | 5 PASS |
| `prompt-injection.report.json` | PS-05, PS-06, PS-07 | 3 PASS |
| `command-not-executed.trace.json` | PS-09 | 1 PASS |
| `registry-path.reject.json` | RP-01..RP-06 | 6 PASS |
| `symlink-escape.reject.json` | SE-01..SE-04 | 4 PASS |
| `stale-assessment.report.json` | B10-1..B10-4 | 4 PASS |
| **Total** | **19 distinct PS/RP/SE + 4 B10** | **22 PASS, 0 FAIL** |

Fixture contracts: F01 7/7, F02 5/5, F03 6/6, F04 5/5, F05 6/6, F06 6/6 checks PASS.
B05: 5/5. B06: 7/7.

## 3. What M2 explicitly did NOT do

| Not done | Why | Owner milestone |
|---|---|---|
| Browser / Playwright execution | Guardrail: no browser run authorized in M2 | M4/M6 |
| Registry write, `TESTS.md` creation | DEC-06 still `OWNER_DECISION_REQUIRED` | M3 |
| B12 cross-turn concurrency test | Deferred by plan; needs M3 registry writes first | M3 |
| `/e2e-map` behaviour change | AC-019 parity work is M5; M2 only validates the mapped output | M5 |
| Runner agent / prompt / skills / config edits | M2 needs none; task list marks them "MAY touch" | M3/M4 |
| `.opencode/workflows/active.json` edit | Forbidden by mandate (D05 erratum already recorded) | — |
| Live prompt verification (48 scenarios) | Honest two-layer labelling; harness proves the reference implementation only | M6 |
| MILESTONE-GATES.json promotion | ASM-01 probe returned `INCONCLUSIVE`; zero gates promoted, file untouched | M6 (with new evidence) |

## 4. Authorized delta and guardrail evidence

- Exactly one repo source changed: `.opencode/commands/e2e.md`
  (`08b17f2c…95dd` → `1fe90046…7074`), authorized by plan step 5.
- `scope-check.report.json`: 0 violations, 1 `AUTHORIZED_DELTA`, 29 enumerated write-surface files, all inside
  `docs/e2e-v2/m2/`, `docs/plans/`, or the authorized command file.
- M1 suite: `node --test docs/e2e-v2/m1/tests/m1.test.mjs` → 11/13 PASS. Two expected consequences
  of authorized M2 work, both recorded in `m2/tdd-record.md`:
  - `M1-01` — asserts live `e2e.md` still equals the frozen baseline hash; the authorized edit
    invalidates that assertion by design.
  - `M1-11` — asserts the whole `docs/e2e-v2` tree equals M1's 20-file inventory; M2 adds files.
  Neither failure indicates an M1 artifact was mutated. `frozen-artifacts.manifest.json` snapshots
  the 20 frozen M1 files + 3 contracts for M3+ to diff.
- Home writes 0, git access false, Guardian Angel access false, browser runs 0, installs 0,
  registry writes 0.

## 5. Open items carried into M3

1. `ASM-01` stays `INCONCLUSIVE`: no v2.3.2 surface expands a command template without a model turn
   (`GET /api/command` on a cold private instance returns `data: []`). Gate unpromoted.
2. `ASM-02` fixture contracts are proven against the **reference** detector, not against the live
   `/e2e-map` prompt — parity remains M5 work.
3. DEC-05 (`run --ad-hoc`) remains `OWNER_DECISION_REQUIRED`; M2 encodes the gate behaviour, not a
   policy decision.
4. Coverage is measured only for the M2 reference modules, not for the project. Node's built-in
   `node --test --experimental-test-coverage` over the suite reports 99.50% lines / 95.38% branches /
   100% functions for the files the M2 suite loads (`docs/e2e-v2/m2/tests/*.mjs`). No coverage tool
   is configured in this repo and none was installed; this is a runtime figure, not a project-wide
   claim. Everything outside those modules stays unmeasured.
