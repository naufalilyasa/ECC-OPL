# M1 Traceability & Review Handoff (ECC-OPL /e2e V2.0)

Status: `M1 COMPLETE` (evidence-and-contract only)
Milestone: M1 of 6
Plan: `docs/plans/e2e-v2-0-unified-journey-mapping.plan.md` r3 — `ea20d4f2c549b34f54c19f0111c030bbc68aa6cb67833edf6ffd18da9a04b1dd`
Approved PRD digest: `047918df0835bc7ea52f0d0dc7714f0b29394cce32ad8c2580b2973dfce1d211`
Recorded: 2026-11-22

Read this file first if you are starting M2. It says what is proven, what is frozen, what is
deliberately not run, and what still needs an owner decision.

## 1. Artifact → scenario → AC → requirement

| Scenario | Artifact → evidence path | AC | Requirement | Status | Evidence kind |
|---|---|---|---|---|---|
| Baseline | `docs/e2e-v2/SOURCE-BASELINE-FROZEN.md` → 8 sources + 3 config surfaces | AC-001 (baseline chain) | E2E-NFR-005 | FROZEN, 8/8 MATCH, 0 drift | hash recomputation |
| D05 | `docs/e2e-v2/m1/reports/frozen-hashes.report.json` → 9 frozen-workflow surfaces | AC-018 | E2E-FR-018, E2E-NFR-005 | PARTIAL — `NOT_VERIFIED` | hash snapshot, no prior ref |
| ASM-01 | `docs/e2e-v2/m1/command-resolution-evidence.md` → 3 config surfaces | AC-017 (supporting) | E2E-FR-017 | `NOT_VERIFIED`, probe `DEFERRED_TO_M2` | read-only enumeration |
| ASM-01 | `docs/e2e-v2/m1/reports/command-resolution.report.json` → surface map + probe spec | AC-017 (supporting) | E2E-FR-017 | `NOT_VERIFIED` | JSON companion |
| A01 | `docs/e2e-v2/contracts/command-contract.md` → 6 modes + gate table + State enum | AC-001 | E2E-FR-001 | FROZEN | contract freeze |
| A01 | `docs/e2e-v2/m1/reports/mode-parser.report.json` → static contract check | AC-001 | E2E-FR-001, E2E-NFR-005 | `PASS` (static only) | static check |
| A07 | `docs/e2e-v2/contracts/validator-specs.md` → 19 PS/RP/SE negative cases | AC-001 | E2E-FR-001, E2E-FR-020, E2E-NFR-002 | FROZEN spec | spec of record |
| A07 | `docs/e2e-v2/m1/reports/parser-failclosed.report.json` → 9 PS cases | AC-001 | E2E-FR-001, E2E-FR-020, E2E-NFR-002 | `NOT_RUN` → M2 | deferred |
| B11 | `docs/e2e-v2/m1/reports/registry-path.reject.json` → 6 RP cases | AC-016 | E2E-FR-015, E2E-NFR-003 | `NOT_RUN` → M2 | deferred |
| D04 | `docs/e2e-v2/m1/reports/symlink-escape.reject.json` → 4 SE cases | AC-016 | E2E-FR-015 | `NOT_RUN` → M2 | deferred |
| AC-019 | `docs/e2e-v2/m1/detector-characterization.md` → 10 stack rows + 2 conflicts | AC-019 | E2E-FR-019 | CHARACTERIZED | source-line mapping |
| B01 | `docs/e2e-v2/m1/reports/F01-F06-map-output-expected.json` → F01 | AC-019 | E2E-FR-019 | `NOT_RUN` → M2 | expected-output contract |
| B02 | `docs/e2e-v2/m1/reports/F01-F06-map-output-expected.json` → F02 | AC-019 | E2E-FR-019 | `NOT_RUN` → M2 | expected-output contract |
| B03 | `docs/e2e-v2/m1/reports/F01-F06-map-output-expected.json` → F03 | AC-019 | E2E-FR-019 | `NOT_RUN` → M2 | expected-output contract |
| B04 | `docs/e2e-v2/m1/reports/F01-F06-map-output-expected.json` → F04–F06 | AC-019 | E2E-FR-019 | `NOT_RUN` → M2 | expected-output contract |
| B05 | `docs/e2e-v2/contracts/journey-contract-freeze.md` → D1/D3 rules | AC-019 | E2E-FR-019 | FROZEN | contract freeze |
| B05 | `docs/e2e-v2/m1/reports/locale-dedup.report.json` → 5 LD assertions | AC-019 | E2E-FR-019 | `NOT_RUN` → M2 | deferred |
| B06 | `docs/e2e-v2/contracts/journey-contract-freeze.md` → D2/D4 rules + 14 fields | AC-009 | E2E-FR-008, E2E-FR-019 | FROZEN | contract freeze |
| B06 | `docs/e2e-v2/m1/reports/journey-grouping.report.json` → 7 JG assertions | AC-009 | E2E-FR-008, E2E-FR-019 | `NOT_RUN` → M2 | deferred |
| E01 | `docs/e2e-v2/m1/reports/bundle-validator.report.json` → 20/20 hashes, 48 IDs | AC-001 | E2E-FR-001 | `PASS` | executable read-only |
| E04 | `docs/e2e-v2/m1/reports/scope-check.report.json` → inventory, 0 violations, 8 DECs | AC-001 | E2E-NFR-005 | `PASS` | executable read-only |
| Erratum | `docs/e2e-v2/m1/errata/workflow-active-d05.md` → active.json D05 mismatch | AC-018 | E2E-FR-018, E2E-NFR-005 | RECORDED | erratum |
| M1 guard | `docs/e2e-v2/m1/tests/m1.test.mjs` → 13 invariant checks | AC-001, AC-019 | E2E-NFR-005 | `PASS` (13/13) | `node --test` |

Every M1 artifact appears in at least one row above.

## 2. Execution artifacts deliberately NOT run

These are declared, named, and deferred. They are **not** missing work — a reviewer can verify they
were not faked by reading their `status` and `deferred_to` fields.

| Artifact | status | deferred_to | Why deferred |
|---|---|---|---|
| `reports/parser-failclosed.report.json` | `NOT_RUN` | M2 | No parser exists until M2 |
| `reports/registry-path.reject.json` | `NOT_RUN` | M2 | Path validator is M2 |
| `reports/symlink-escape.reject.json` | `NOT_RUN` | M2 | Symlink resolution is M2 |
| `reports/F01-F06-map-output-expected.json` | `NOT_RUN` | M2 | Fixture execution is ASM-02 |
| `reports/locale-dedup.report.json` | `NOT_RUN` | M2 | Needs a journey map to assert over |
| `reports/journey-grouping.report.json` | `NOT_RUN` | M2 | Needs a discovered route set |
| `reports/command-resolution.report.json` probe | `DEFERRED_TO_M2` | M2 | Runtime discovery = ASM-01 |

## 3. Unvalidated assumptions (VALIDATION_REQUIRED)

| ID | Assumption | Deferred to | Resolution path |
|---|---|---|---|
| ASM-01 | OpenCode `/e2e` invocation and resolution semantics (`ASM-01/ARGS` + `ASM-01/PRECEDENCE`) | M2 | Isolated sandbox probe specified in `command-resolution-evidence.md` §4 |
| ASM-02 | Detector portability across F01–F06 stacks | M2 | Fixture execution against the frozen expected-output contracts |

## 4. Owner decisions carried forward (OWNER_DECISION_REQUIRED)

Not resolved in M1. Listed with the milestone that consumes each one.

| DEC | Topic | Owning milestone | M1 treatment |
|---|---|---|---|
| DEC-04 | Legacy `/e2e <flow>` shorthand | M5 | `PENDING_DEC` in command contract §7 |
| DEC-05 | `run --ad-hoc` policy | M2 | `PENDING_DEC`; sub-mode shape frozen, policy open |
| DEC-06 | Registry bootstrap/write authorization | M3 | `PENDING_DEC`; no file created in M1 |
| DEC-07 | Per-environment execution authorization | M4 | `PENDING_DEC`; environment gate text only |
| DEC-09 | Agent Browser optional exploration | M4 | Noted in baseline facts; no install |
| DEC-10 | `/e2e-map` disable-default after parity | M5 | `PENDING_DEC`; `/e2e-map` not disabled |
| DEC-11 | CI automation policy | M6 | Noted; not in M1 scope |
| DEC-12 | Legacy `State: stale` schema reconciliation | M5 | `PENDING_DEC`; conflict documented, not migrated |

## 5. Test evidence (M1 harness)

Runner: `node --test docs/e2e-v2/m1/tests/m1.test.mjs` (Node v24.21.0, no dependencies).

The harness re-derives every fact rather than trusting the reports: it recomputes live source hashes,
re-reads the R1 ZIP and re-hashes all 20 manifest entries, re-parses `ACCEPTANCE-MATRIX.csv` with its
own CSV reader, and walks `docs/e2e-v2/` to detect untracked writes.

| Check | Guarantee |
|---|---|
| M1-01 | 8 source + 3 config hashes frozen and still matching live files |
| M1-02 | ≥7 frozen workflows hashed; D05 exclusions honest; no fabricated byte-identity |
| M1-03 | 3 config surfaces enumerated verbatim; winner `NOT_VERIFIED`; probe deferred |
| M1-04 | Exactly 6 modes, complete gate table, exact State enum, `stale` assessment-only |
| M1-05 | A01 static contract check `PASS`, no dangerous default |
| M1-06 | ≥12 negative cases; report companions `NOT_RUN` (not faked) |
| M1-07 | ≥9 stack rows anchored to real `e2e-map.md` lines; exactly 2 conflicts |
| M1-08 | F01–F06 expected-output contracts complete and `NOT_RUN` |
| M1-09 | 14 journey fields, 4 transitions, 4 dedup rules, ID ownership |
| M1-10 | 20/20 manifest hashes, manifest self-excluded, digest match, 48 unique IDs |
| M1-11 | 0 scope violations, 8 pending DECs, protected paths untouched |
| M1-12 | This file maps every artifact with no M2–M6 artifact claimed as done |
| M1-13 | 11 report companions parse and declare status |

## 6. Boundary of the M1 claim

M1 changed no product behaviour. Specifically not done in M1: no edit to `.opencode/commands/e2e.md`,
`e2e-map.md`, `agents/e2e-runner.md`, its prompt, `legacy-command-shims/commands/e2e.md`, any config,
any frozen workflow, or the PRD; no `.git`/`.guardian-angel` access; no `HOME` write; no browser, no
Playwright, no install, no registry migration, no `TESTS.md`, no `/e2e-map` disablement, no DEC resolved.

## 7. Handoff to M2

Start with:

1. `contracts/command-contract.md` — the mode/gate/state contract to implement.
2. `contracts/validator-specs.md` — 19 case IDs that become M2 test names.
3. `m1/detector-characterization.md` — what M2+ must preserve or consciously change.
4. `m1/command-resolution-evidence.md` §4 — ASM-01 probe to execute first.
5. `SOURCE-BASELINE-FROZEN.md` — re-hash before touching anything; drift = stop.

Nothing in M2–M6 is claimed as started.
