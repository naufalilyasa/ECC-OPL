# Implementation Plan: ECC-OPL /e2e V2.0 — Milestone 3 "Mapping & registry governance — registry-first, ID discipline, approval write"

Status: APPROVED
Revision: r4
Readiness: READY_FOR_EXECUTION
Mode: standard (PRD-driven, owner-approved PRD; DEC-06/DEC-12 approved policy)
Milestone: M3 (of 6) — scope strictly limited to M3
Upstream digest (approved PRD, SHA-256, CANONICAL): `047918df0835bc7ea52f0d0dc7714f0b29394cce32ad8c2580b2973dfce1d211` — this digest belongs to the R1 bundle `PRD-CANDIDATE.md` (immutable approved text)
PRD working copy `.claude/prds/e2e-v2-0-unified-journey-mapping.prd.md` (SHA-256): `bbe563be553147e4ff348622e54a75689db209bd798e85f85a97d739895191a9` — post-approval copy; only delta vs candidate is the approval-ledger rows 157–162; never hashed against `047918df…`
Owner-approved M3 proposal (policy + exact bootstrap diff, SHA-256): `500704509dfadf4a386c60631fc4a60c435cb28fc4244714a818a8aae762069f` — `/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m3m5m6-proposals/M3-REGISTRY-DIFF-PROPOSAL.md`
M1 frozen baseline ZIP `ecc-opl-e2e-v2.0-m1-r1-contract-evidence-reconciliation-review.zip` (SHA-256): `9d1417f1709ab14933476cacf37b46b0dc512849011abea67984bb4fe073c22f` (as pinned in `docs/plans/e2e-v2-0-m2-unified-interface.plan.md`; re-verify at preflight if the ZIP is present)
`docs/e2e-v2/decisions/MILESTONE-GATES.json` hash (MUST stay byte-identical): `00c6b4550a130fcec4e20abda25919b9a08fe4b493b9439687865d70d017c8e5`
`docs/e2e-v2/decisions/DECISION-REGISTER.md` hash (MUST stay byte-identical): `cd848701e25fddf6ab33c5853a2bd93a791e0786b225dc8534be912c4c03d223`
Approved R1 registry contract: `REGISTRY-CONTRACT.md` (R1 bundle, extracted at `/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/e2e-m1-ref/bundle/ecc-opl-e2e-v2.0-prd-r1-external-review/`)
Single entry document for M3: `docs/e2e-v2/m2/traceability-m2.md` (§5 open items) + `m2-final-state-snapshot.json`
Revision r3 note: plan-reviewer round 2 — M-1 fixed (AC-008 environment-gate halt position corrected to before the run/dispatch stage, per `e2e.md` §6 and `DETERMINISTIC-VERIFICATION.md` §6; generate/evidence stages before it are not retracted) plus 6 non-blocking folds (emit-script in Architecture Changes, GAP-4 novelty softened, matrix row/line clarification, G1 extended to DEC-12, scope-check before-hash re-record clause, DEC-05 stale-handoff note). The stale "11 steps / 6 phases" structural descriptor does not occur in this plan (actual: 7 numbered steps / 5 phase headings, Phase 0–4) — nothing to fix.
Revision r2 note: review findings applied — B1 (per-file hash pins for MILESTONE-GATES.json vs DECISION-REGISTER.md), B2 (canonical digest re-anchored to bundle `PRD-CANDIDATE.md`; `.claude` working copy recorded at `bbe563be…`), plus non-blocking folds (verbatim-copy rule for the §3 constant, named conformance test file, `NOT_VERIFIED` wording, B12/G3 overclaim reword, AC-015/AC-016 supporting-only labeling). Scope and boundaries unchanged from r1.

## Overview

M3 turns the approved registry governance policy into a deterministic, testable lifecycle: bootstrap **proposal** generation that is byte-faithful to the owner-approved exact two-file diff (DEC-06), `REGISTRY_REQUIRED` fail-closed behavior for unregistered `run` (AC-006), explicit `run --ad-hoc` no-coverage-credit labeling (AC-007), the `full` phase-ordering trace with no skipped stage (AC-008), ID discipline and preservation on an existing registry — max+1 allocation, no reuse/renumber, match-by-ID-first, only the 5 permitted fields on the matched Section 4 block (AC-009, B08/B09/F07) — and the `stale` assessment/State separation with a DEC-12 migration **proposal** for legacy `State: stale` rows, never a silent rewrite (AC-010, B10 extension + negative mutation 8). It also executes the B12 write-conflict probe (deferred from M2): hash-before-write detection → `WRITE_CONFLICT` → rebase proposal, no clobber (fixture F11). **The actual registry write is NOT part of this milestone's execution**: the approved two-file skeleton (`TESTS.md`, `.governance/docs-map.json`) remains a target diff; creating those files is a later, separately authorized action against that exact diff. No browser, no Playwright, no installs, no network.

## Affected User and Ideal State

**Affected user**:
1. **Owner** — today approves registry changes only as prose policy (DEC-06) with no mechanical exact-diff gate; after M3 every proposed registry mutation arrives as a byte-exact diff with a hash-before-write recheck, and an abort leaves zero unauthorized action.
2. **Main `/e2e` orchestrator** — today `map`'s bootstrap proposal shape and `run`'s ID/write-field discipline live only in prompt prose; after M3 they are backed by a tested reference lifecycle module the prompt mirrors (same two-layer pattern as M2's parser).
3. **`e2e-runner` child agent** — receives briefs whose test IDs are stable (never renumbered, never reused) and whose matched block is the only write surface.
4. **M4–M6 implementer sessions** — consume executed registry-governance reports (`registry-required`, `concurrency`, `registry-preserve`, `idempotence`, `stale-migration-proposal`) instead of re-deriving DEC-06/DEC-12 semantics.

| Row | Statement | Reason |
|---|---|---|
| IS-1 | A registry-absent `run` returns `REGISTRY_REQUIRED` and dispatches nothing; `map` emits a bootstrap **proposal** byte-identical to the owner-approved exact diff, and no file is created without a separate, later write authorization | DEC-06 approved policy ("explicit approval terhadap exact proposed diff"); REGISTRY-CONTRACT §Bootstrap; PRD E2E-FR-005 |
| IS-2 | `run --ad-hoc` on a pass yields `PASS_AD_HOC_UNREGISTERED`, leaves the registry byte-identical, and earns no coverage credit | DEC-05 approved policy; PRD AC-007; C03 |
| IS-3 | `full` walks discovery → review → registry → generate → run → evidence with every gate honored and no stage skipped; an unauthorized gate stops the chain | PRD E2E-FR-007; A08; F12 |
| IS-4 | Re-mapping an existing registry preserves every ID, field, block and ordering; new IDs are actual-max+1 starting at `001`, never reused; a repeat map is idempotent | PRD E2E-FR-008/009; B08/B09/F07; REGISTRY-CONTRACT §ID ownership |
| IS-5 | A legacy `State: stale` row is reported as a schema mismatch with a reviewable migration proposal; `stale` remains an assessment label, never a written State; the migration itself stays M5 | DEC-12 approved policy; PRD E2E-FR-010/AC-010; negative mutation 8 |
| IS-6 | A registry changed between diff-approval and write produces `WRITE_CONFLICT` + a rebase proposal; owner bytes are never clobbered; a denied/aborted approval produces `CANCELLED` and zero action | REGISTRY-CONTRACT §Error outcomes; DETERMINISTIC-VERIFICATION §3; B12 (deferred into M3 by M2 plan) |
| GAP-1 | Today `map`'s bootstrap proposal and the DEC-06 approval-write flow exist only as prompt sentences with no deterministic enforcement or byte-fidelity check | `.opencode/commands/e2e.md` §5 says "produce a bootstrap proposal in the DEC-06 shape" — shape is unverified |
| GAP-2 | `REGISTRY_REQUIRED`, ad-hoc labeling, and the `full` phase order are frozen text with no executed scenario evidence (`C02`, `C03`, `A08` all `NOT_VERIFIED` in the matrix verification column; status `NOT_RUN (PRD phase)`) | ACCEPTANCE-MATRIX.csv file lines 9, 23, 24 (data rows 8, 22, 23) |
| GAP-3 | ID discipline and matched-block-only field writes are untested against a populated registry fixture (F07); B12 concurrency is `NOT_VERIFIED` and was explicitly deferred from M2 | `m2/traceability-m2.md` §3 ("needs M3 registry writes first" — but detection does not require a live write; F11 is a synthetic fixture); B08/B09/F07/F11 |
| GAP-4 | Legacy `State: stale` handling stops at the M2 enum check (B10-1, which already rejects `State: stale` with `proposal: {State: unverified}`); no *named* migration-proposal artifact exists and mutation 8 is unexecuted as a lifecycle-level case | `m2/reports/stale-assessment.report.json` covers the B10-1 enum rejection; the M3 artifact is an additive, named lifecycle-level mutation-8 case, not the first rejection; DEC-12 proposal generation as a named artifact is new |
| GAP-5 | No M3 traceability, scope check, or TDD record exists | Every milestone closes with an artifact→AC→requirement map |

## Requirements

### Must have
- **Bootstrap proposal generator** (deterministic, in the M3 harness): emits the exact two-file diff from the owner-approved proposal §3 — `TESTS.md` (Section 2 journey-index header + empty table, Section 4 test-blocks header + comment lines) and `.governance/docs-map.json` (`ecc-opl.e2e-docs-map/v1`, `registry: TESTS.md`, `journeys: []`, plus its `note` key) — and proves **byte-fidelity** against the approved-diff constant derived from proposal SHA `50070450…`. Copy §3 of the proposal **verbatim** into the test constant; do not reconstruct the diff from this description, and do **not** assert a 26-line count (the `+1,26` hunk header is a diff hunk marker, not a content-line count). The generator writes nothing.
- **`REGISTRY_REQUIRED` scenario (C02/AC-006)**: unregistered `run` → outcome `REGISTRY_REQUIRED`, zero runner invocation, registry untouched (negative-dispatch assertion).
- **Ad-hoc labeling (C03/AC-007)**: a mock-runner PASS on an unregistered flow under `--ad-hoc` → `PASS_AD_HOC_UNREGISTERED`, registry hash unchanged, no coverage credit. Reference-level only; live sandbox execution stays M4/M6.
- **`full` phase trace (A08/AC-008)**: the six-stage sequence asserted in order with no skipped stage; an unauthorized environment gate stops the chain as `BLOCKED` before the **run/dispatch** stage (no runner invocation), per `e2e.md` §6 (run's environment gate for execution) and `DETERMINISTIC-VERIFICATION.md` §6 (`BLOCKED` sebelum spawn); spec generation/evidence stages before it are not retracted by this gate.
- **ID discipline + preservation (B08/B09/F07, AC-009)**: over fixture F07 (a `TESTS.md` with 2 Section 4 blocks + Section 2 rows): re-map preserves all IDs/fields/blocks/ordering (diff = only permitted fields on a verified pass; 0 renumber); new ID = actual numeric max + 1, starting `001` when empty; reserved/removed IDs never reused; repeat mapping is idempotent — new IDs only for genuinely new flows; match order = ID exact → stable journey + source, route-title similarity alone never authorizes a destructive edit.
- **Permitted-write-field enforcement**: a simulated verified pass mutates **only** `State`, `Test file`, `Test node`, `Command`, `Evidence` on the matched Section 4 block; `Purpose`, `Source`, `Representative input`, `Observable expectation`, `Level`, `Execution group`, `Boundary`, block order, and all other IDs are byte-identical.
- **WRITE_CONFLICT + rebase (B12, F11)**: hash-before-write probe per DETERMINISTIC-VERIFICATION §3 — registry content changed after the diff was computed → `WRITE_CONFLICT`, recompute diff + re-approval required, no last-writer-wins, owner bytes intact.
- **CANCELLED outcome**: approval denied or aborted → `CANCELLED`, no unauthorized action, registry untouched.
- **Stale governance (AC-010)**: `stale` stays assessment-only (M2 B10 carried forward); a legacy `State: stale` row → schema-mismatch record + a DEC-12 migration **proposal** artifact naming the target valid State (`unverified` default per REGISTRY-CONTRACT §Stale assessment) — the proposal is emitted, never applied; negative mutation 8 (enum accepting `stale`) must fail.
- **`.opencode/commands/e2e.md` delta**: the DEC-06 approval-write flow made mechanical — proposal → owner approval of the exact diff → hash-before-write recheck → write or `WRITE_CONFLICT`/rebase → `CANCELLED` on abort — plus ID-discipline and permitted-field sentences citing DEC-06/DEC-12. One `AUTHORIZED_DELTA`, conformance-tested (same pattern as M2 step 5).
- **Closure artifacts**: `docs/e2e-v2/m3/` reports, TDD record, traceability, scope check.

### Must NOT have (scope guardrails)
- **No actual registry write**: `TESTS.md` and `.governance/docs-map.json` must NOT exist after M3 execution. The approved exact diff is a *target*; creating the files is a later, separately authorized task against that diff (DEC-06: policy approval ≠ write permission). The scope check proves their absence.
- No mutation of `docs/e2e-v2/decisions/MILESTONE-GATES.json` (hash `00c6b455…`) or `docs/e2e-v2/decisions/DECISION-REGISTER.md` (hash `cd8487…`) — each pinned and asserted byte-identical independently; no M3 gate status change is warranted (DEC-06/DEC-12 are already APPROVED).
- No browser/Playwright execution, no install, no lockfile change, no network (E2E-NFR-002; Playwright verified absent in M2 preflight).
- No edits to frozen M1/M2 artifacts (`docs/e2e-v2/m1/**`, `docs/e2e-v2/m2/**`, `docs/e2e-v2/contracts/**`, `SOURCE-BASELINE-FROZEN.md`), the approved PRD, or prior plans.
- No DEC-04/05/10/11 milestone work pulled forward: no legacy-shim surface (M5), no ad-hoc sandbox execution machinery (M4), no `/e2e-map` disablement or parity/rollback execution (M5 — F13/F14 stay M5; M3 only records their status), no CI (M6).
- No migration of any legacy `State: stale` row applied to any file (DEC-12 execution is M5; M3 emits proposals only).
- No `.git` / `.guardian-angel` access; no active-`$HOME` writes; no Git mutations.

## Patterns to Mirror
- **M2 two-layer honesty**: every M3 report carries `method: "reference-implementation harness (node --test)"` and `live_prompt_verification: "DEFERRED_TO_M6 (48-scenario acceptance)"` — the harness proves the reference lifecycle; live prompt behavior is M6.
- **M2 TDD discipline**: RED (module-absent or assertion-level, actually executed) → GREEN → append to `docs/e2e-v2/m3/tdd-record.md`; zero-dependency `node --test`; disposable temp-dir fixtures with literal-path cleanup.
- **M2 named-case tracing**: every test result carries its frozen case ID (C02, C03, A08, B08, B09, B12, B10-ext, mutation IDs) so reports trace 1:1 to ACCEPTANCE-MATRIX.csv / NEGATIVE-MUTATION-PLAN.md.
- **M2 scope-check + AUTHORIZED_DELTA**: written-file set ⊆ allowed set; frozen-artifact re-hash proves byte-identity; the `e2e.md` edit is recorded with before/after hashes.
- **M2 conformance-test-before-product-edit**: static conformance suite written RED against the current `e2e.md`, then the edit turns it GREEN.

## Architecture Changes
- **New**: `docs/e2e-v2/m3/tests/registry.mjs` — zero-dependency registry lifecycle reference module (bootstrap-proposal emitter, ID allocator, match/order engine, permitted-field applier, conflict detector, stale assessor, outcome mapper). Mirrors REGISTRY-CONTRACT.md §Bootstrap/§Stale/§Error outcomes/§Permitted write fields/§ID ownership.
- **New**: `docs/e2e-v2/m3/tests/m3.test.mjs` — the M3 harness (all named cases).
- **New**: `docs/e2e-v2/m3/tests/conformance.test.mjs` — static conformance suite pinning the `.opencode/commands/e2e.md` DEC-06/DEC-12 delta (RED before the edit, GREEN after).
- **New**: `docs/e2e-v2/m3/scripts/emit-m3-reports.mjs` — deterministic emitter that runs the harness and writes the Phase 2 scenario reports.
- **New**: `docs/e2e-v2/m3/reports/*.json` — `registry-required.report.json`, `ad-hoc.report.json`, `full-phase.trace.json`, `registry-preserve.diff.json`, `idempotence.report.json`, `concurrency.report.json`, `stale-migration-proposal.report.json`, `m3-preflight.report.json`, `scope-check.report.json`.
- **New**: `docs/e2e-v2/m3/tdd-record.md`, `docs/e2e-v2/m3/traceability-m3.md`.
- **Modified**: `.opencode/commands/e2e.md` — DEC-06 approval-write flow + ID-discipline section (sole product delta, conformance-pinned).
- **Unchanged**: `docs/e2e-v2/m2/tests/validators.mjs` / `resolver.mjs` stay frozen M2 evidence; M3 imports/reuses their *patterns* (re-implements the small pieces it needs inside `m3/tests/` rather than editing M2 files).

## Implementation Steps

### Phase 0: Preflight (integrity baseline)

1. **M3 preflight — upstream hash + absence verification** (File: `docs/e2e-v2/m3/reports/m3-preflight.report.json`)
   - Action: Re-hash and record: the R1 bundle `PRD-CANDIDATE.md` (must equal the canonical approved digest `047918df…`) and separately the `.claude/prds/…` working copy (must equal `bbe563be…`; recorded as the post-approval copy, never compared against `047918df…`); `docs/e2e-v2/decisions/MILESTONE-GATES.json` (must equal `00c6b455…`) and `docs/e2e-v2/decisions/DECISION-REGISTER.md` (must equal `cd8487…`) — each asserted byte-unchanged **independently**; the M3 proposal file (must equal `50070450…`); M2 frozen artifacts (`docs/e2e-v2/m2/**` + snapshot `m2-final-state-snapshot.json`); and the approved registry contract extract. Assert `TESTS.md` and `.governance/docs-map.json` do **not** exist at canonical ECC root. Confirm Playwright still absent.
   - Why: Every later byte-fidelity and no-write claim anchors to these hashes (GAP-1, IS-1).
   - Closes: supports GAP-1
   - References: `m2-final-state-snapshot.json`; `MILESTONE-GATES.json` §invariants; M3 proposal header
   - Acceptance: all hashes match their pinned values or the plan halts; `MILESTONE-GATES.json` (`00c6b455…`) and `DECISION-REGISTER.md` (`cd8487…`) each byte-unchanged independently; absence assertions true.
   - QA: happy — `shasum -a 256 docs/e2e-v2/decisions/MILESTONE-GATES.json` = `00c6b455…`, `shasum -a 256 docs/e2e-v2/decisions/DECISION-REGISTER.md` = `cd8487…`, and `test ! -e TESTS.md` succeeds; failure — any hash drift on either file → STOP, record drift, do not proceed (frozen-baseline violation).
   - Dependencies: None. **[OFFLINE]**
   - Risk: Low

### Phase 1: Registry lifecycle core (TDD)

2. **RED — registry lifecycle tests** (Files: `docs/e2e-v2/m3/tests/m3.test.mjs`, target module `docs/e2e-v2/m3/tests/registry.mjs`)
   - Action: Write failing tests first, each carrying its case ID: (a) bootstrap-proposal emitter returns the exact two-file diff text — byte-compare against the approved constant — and performs no filesystem write; (b) C02: `run` against an absent/empty fixture registry → `{outcome: 'REGISTRY_REQUIRED', dispatched: false, registryChanged: false}`; (c) C03: mock-runner PASS on unregistered flow with `adHoc: true` → `PASS_AD_HOC_UNREGISTERED`, registry hash unchanged, `coverageCredit: false`; (d) A08: full-phase trace over a fixture run-plan asserts the exact 6-stage order, no skipped stage, and that an unauthorized environment gate halts as `BLOCKED` before the **run/dispatch** stage — no runner invocation, per `e2e.md` §6 (run's environment gate for execution) and `DETERMINISTIC-VERIFICATION.md` §6 (`BLOCKED` sebelum spawn); generate/evidence stages before it are not retracted by this gate; (e) B08/F07: apply a verified-pass outcome to fixture F07 → diff contains only the 5 permitted fields on the matched block, 0 renumber, all other bytes identical; (f) ID allocator: empty registry → `001`; existing max `014` → `015`; reserved/removed IDs rejected; (g) B09: run the mapper twice over F07 → second run produces zero new IDs (idempotent); a genuinely new flow gets max+1; (h) match order: exact ID beats title; title-similarity alone never authorizes an edit; (i) B12/F11: registry bytes change between diff computation and write → `WRITE_CONFLICT` + rebase proposal, owner bytes intact, no overwrite; (j) approval denied/abort → `CANCELLED`, zero action; (k) legacy `State: stale` row → schema-mismatch record + migration proposal object (target State `unverified`), nothing applied; a State validator offered `stale` (mutation 8) must reject it.
   - Why: TDD RED gate — no lifecycle code before a failing, *executed* test exists (tdd-workflow Step 3).
   - Closes: supports GAP-2, GAP-3, GAP-4
   - References: `REGISTRY-CONTRACT.md` (all sections); M3 proposal §2–§3; `docs/e2e-v2/contracts/validator-specs.md` §4 (B10 pattern); DETERMINISTIC-VERIFICATION §3; ACCEPTANCE-MATRIX.csv rows C02/C03/A08/B08/B09/B12
   - Acceptance: suite runs and fails for the intended reason (module absent / assertions unmet).
   - QA: happy — `node --test docs/e2e-v2/m3/tests/` exits nonzero with the new tests failing; failure — instant pass → restart RED.
   - Dependencies: Requires step 1. **[OFFLINE]**
   - Risk: Low

3. **GREEN — implement the registry lifecycle module** (File: `docs/e2e-v2/m3/tests/registry.mjs`)
   - Action: Minimal zero-dependency implementation: `bootstrapProposal()` (returns the approved diff text as a constant + `writes: []`); `resolveRun({registry, target, adHoc})` (absent/zero-match → REGISTRY_REQUIRED; ad-hoc PASS → PASS_AD_HOC_UNREGISTERED with no registry mutation); `fullPhaseTrace(plan, gates)` (ordered stages, gate halts); `allocateId(existingIds)` (max+1, `001` base, reserved-set rejection); `applyVerifiedPass({registryText, blockId, outcome})` (permitted-field-only splice on the matched Section 4 block); `checkWriteConflict({hashBefore, hashNow})` (WRITE_CONFLICT + rebase proposal object); `cancel()` (CANCELLED, no action); `assessLegacyStale(row)` (B10-ext mismatch + DEC-12 proposal). Every result carries its case ID. Append RED→GREEN to `docs/e2e-v2/m3/tdd-record.md`.
   - Why: This module is the normative, testable encoding of REGISTRY-CONTRACT that the `e2e.md` prompt mirrors — the same reference-implementation pattern M2 established for the parser.
   - Closes: GAP-2, GAP-3, GAP-4 (mechanism level)
   - References: step 2 tests; REGISTRY-CONTRACT §Error outcomes/§Permitted write fields/§ID ownership
   - Acceptance: all step-2 tests green; every function result maps to a named case ID; `bootstrapProposal()` byte-matches the approved diff.
   - QA: happy — `node --test docs/e2e-v2/m3/tests/` green for the lifecycle suite; failure — any red → fix the implementation, not the test (unless a test misencodes the approved contract).
   - Dependencies: Requires step 2. **[OFFLINE]**
   - Risk: Low

### Phase 2: Scenario evidence reports

4. **Emit the M3 scenario reports** (Files: `docs/e2e-v2/m3/reports/registry-required.report.json`, `ad-hoc.report.json`, `full-phase.trace.json`, `registry-preserve.diff.json`, `idempotence.report.json`, `concurrency.report.json`, `stale-migration-proposal.report.json`; emitter `docs/e2e-v2/m3/scripts/emit-m3-reports.mjs`)
   - Action: Run the harness and emit one report per M1-named artifact: C02 → `registry-required` (with the negative-dispatch record); C03 → `ad-hoc` (label + registry-hash-unchanged + no-credit); A08 → `full-phase.trace` (stage order + BLOCKED-halt record, F12 environment gate honored as contract text); B08 → `registry-preserve.diff` (the F07 diff showing only permitted fields, 0 renumber); B09 → `idempotence` (replay-twice result); B12 → `concurrency` (hash-before-write probe, F11 fixture, conflict + rebase + owner-bytes-intact); AC-010 → `stale-migration-proposal` (schema-mismatch record + DEC-12 proposal object + mutation-8 rejection). Every report: `status`, `method`, `live_prompt_verification: "DEFERRED_TO_M6 (48-scenario acceptance)"`, and for C03/A08 an explicit `live_execution: "DEFERRED_TO_M4/M6 (no browser authorized)"`.
   - Why: GAP-2/3/4 — turns the frozen `NOT_VERIFIED` scenario rows into executed, traceable evidence without faking live behavior.
   - Closes: GAP-2, GAP-3, GAP-4
   - References: step 3 module; `m2/scripts/emit-reports.mjs` (pattern); ACCEPTANCE-MATRIX.csv; NEGATIVE-MUTATION-PLAN.md (mutation 8)
   - Acceptance: each named artifact exists with concrete per-case outcomes; zero cases say "verify it works"; M1/M2 frozen companions untouched.
   - QA: happy — `jq '.status' docs/e2e-v2/m3/reports/*.json` all concrete-executed; `jq '.cases | length' concurrency.report.json` ≥ 1 with `WRITE_CONFLICT` + `ownerBytesIntact: true`; failure — a missing case or a vague record → phase not done.
   - Dependencies: Requires step 3. **[OFFLINE]**
   - Risk: Low

### Phase 3: Command-file delta (DEC-06 approval-write flow)

5. **Conformance RED → rewrite `.opencode/commands/e2e.md`** (File: `.opencode/commands/e2e.md`) **[PRODUCT-EDIT]**
   - Action: First write the static conformance test — `docs/e2e-v2/m3/tests/conformance.test.mjs` (RED against the current file) — asserting the presence of: the DEC-06 approval-write flow (proposal → explicit owner approval of the exact diff → hash-before-write recheck → write or `WRITE_CONFLICT`+rebase → `CANCELLED` on abort); the ID-discipline sentence (max+1, `001` base, no reuse, match-by-ID-first, title-similarity insufficient); the permitted-write-fields list (exactly `State`, `Test file`, `Test node`, `Command`, `Evidence`); the DEC-12 sentence (`stale` assessment-only; legacy `State: stale` → reviewed migration proposal, never silent rewrite); and an explicit "the bootstrap skeleton files are created only by a separately authorized write action" line. Then edit the file (GREEN): extend §5 (map) and add a short §5a/§10 approval-write subsection — minimal delta, no restructure of M2 sections, frontmatter untouched.
   - Why: GAP-1 — the approval-write flow must be prompt-mirrored and conformance-pinned like every other frozen contract (E2E-FR-014/015 prompt side).
   - Closes: GAP-1
   - References: `.opencode/commands/e2e.md` §5/§8/§9 (current); M3 proposal §2; REGISTRY-CONTRACT §Bootstrap/§Error outcomes; `DECISION-REGISTER.md` §3 (DEC-06/DEC-12 consumption text)
   - Acceptance: conformance suite green; every DEC-dependent line cites its DEC ID; M2 sections byte-stable except the additive delta.
   - QA: happy — `node --test docs/e2e-v2/m3/tests/` conformance suite green; `grep -c 'WRITE_CONFLICT' .opencode/commands/e2e.md` ≥ 1; failure — conformance red → fix the file, not the test.
   - Dependencies: Requires step 3 (the module the prompt mirrors). **[PRODUCT-EDIT]**
   - Risk: Medium (see R2, R4)

### Phase 4: Closure

6. **M3 scope check** (File: `docs/e2e-v2/m3/reports/scope-check.report.json`)
   - Action: Inventory every file written during M3 — allowed set: `docs/e2e-v2/m3/**`, `docs/plans/e2e-v2-0-m3-registry-governance.plan.md`, `.opencode/commands/e2e.md`. Re-hash M1/M2 frozen artifacts plus, independently, `MILESTONE-GATES.json` (`00c6b455…`) and `DECISION-REGISTER.md` (`cd8487…`) proving byte-identity of each. Record the `e2e.md` edit as the single `AUTHORIZED_DELTA` with before (`1fe90046…` — re-record the actual hash at execution if the file changed since this plan was written; the pin is accurate on disk now but was carried from r1) and after hashes. **Assert `TESTS.md` and `.governance/docs-map.json` still do not exist** — the decisive no-write proof. Confirm protected paths untouched (filesystem metadata only), no HOME writes, no git access.
   - Why: The DEC-06 boundary is only credible if mechanically proven (IS-1); without the AUTHORIZED_DELTA record the M1/M2 harness drift checks would read as unexplained.
   - Closes: supports GAP-5
   - References: `m2/reports/scope-check.report.json` (pattern); `m2/reports/frozen-artifacts.manifest.json`
   - Acceptance: written-file set ⊆ allowed set; all frozen artifacts byte-identical; exactly one AUTHORIZED_DELTA; registry files absent; 0 violations.
   - QA: happy — `jq '.violations | length' scope-check.report.json` = 0 and `jq '.registry_files_absent'` = true; failure — any out-of-set write (especially a created `TESTS.md`) → record the violation, revert it, re-check.
   - Dependencies: Requires steps 1–5 (final gate). **[OFFLINE]**
   - Risk: Low

7. **M3 traceability + TDD evidence + review handoff** (Files: `docs/e2e-v2/m3/traceability-m3.md`, `docs/e2e-v2/m3/tdd-record.md`)
   - Action: Map every M3 artifact → scenario ID → AC → requirement (bootstrap generator→DEC-06/IS-1; registry-required→C02/AC-006/E2E-FR-005; ad-hoc→C03/AC-007/E2E-FR-006; full-phase→A08/AC-008/E2E-FR-007; preserve+idempotence→B08/B09/F07/AC-009/E2E-FR-008/009; concurrency→B12/AC-016-supporting/E2E-FR-015 (AC-015 and AC-016 are M5 acceptance criteria — record AC-016-*supporting* evidence only, never mark either complete); stale-migration-proposal→B10-ext+mutation-8/AC-010/E2E-FR-010; e2e.md delta→AC-006..010 prompt side). State explicitly what M3 did NOT do: no registry write (files still absent), no browser, no DEC-04/05-execution/10/11 milestone work, F13/F14 untouched (M5), MILESTONE-GATES.json untouched, stale migration not applied (M5). Note: `traceability-m2.md` §5 item 3 still reads DEC-05 `OWNER_DECISION_REQUIRED` (stale vs the approved register) — M3 follows the approved register (DEC-05 APPROVED); treat it as a stale handoff note, not an open prerequisite. Record the DEC-06 write as the named next authorization: "create `TESTS.md` + `.governance/docs-map.json` with the exact approved diff, hash-verified against proposal SHA `50070450…`, in a separately authorized task". Then hand the plan + artifacts to `plan-reviewer` per the verification gate (user-run; fix blockers on follow-up; cap 3 rounds).
   - Why: Closes the M3 loop; becomes M4's entry document.
   - Closes: GAP-5
   - References: `docs/e2e-v2/m2/traceability-m2.md` (format); REQUIREMENTS-TRACEABILITY.csv (bundle)
   - Acceptance: every M3 artifact appears ≥1 row; no M4–M6 artifact claimed done; AC-015/AC-016 not claimed as completed M3 acceptance (AC-016-supporting label only); the write-deferral and F13/F14 status are explicit rows.
   - QA: happy — `grep -c '→' traceability-m3.md` ≥ 10 rows and the write-deferral sentence present; failure — an artifact with no row → traceability incomplete.
   - Dependencies: Requires steps 1–6. **[OFFLINE]**
   - Risk: Low

## Testing Strategy
- **Runner**: `node --test docs/e2e-v2/m3/tests/` — zero-dependency, mirroring M2. Coverage on `registry.mjs` via `node --test --experimental-test-coverage`; target ≥ 80% lines/branches on the new module (the prompt file is verified by the conformance suite, not coverage).
- **TDD**: RED→GREEN logged per step in `docs/e2e-v2/m3/tdd-record.md` (stage, exact command, result excerpt). No lifecycle code before a confirmed, executed RED.
- **Deterministic fixtures**: fixture F07 (populated `TESTS.md`: 2 Section 4 blocks + Section 2 rows) and F11 (concurrency target) are built as literal string constants / temp-dir files at test time and deleted after; no fixture lives in-repo; no test touches the real `$HOME`, `.git`, or `.guardian-angel`.
- **Byte-fidelity**: the bootstrap-proposal test embeds the approved diff text and byte-compares; the proposal SHA itself is re-verified in preflight (step 1).
- **Two-layer honesty**: harness results prove the reference lifecycle; every report stamps `live_prompt_verification: DEFERRED_TO_M6` and, where a browser would be needed, `live_execution: DEFERRED_TO_M4/M6`.

## Risks & Mitigations
- **R1 — Byte-fidelity drift between the approved proposal and the embedded constant**: a transcription typo would make the generator emit a diff the owner never approved.
  - Mitigation: preflight re-hashes the proposal file against `50070450…`; the test byte-compares against a constant transcribed verbatim from §3 of the hashed file; any mismatch is a STOP, not a "fix the constant to match the code".
- **R2 — Reference lifecycle vs prompt divergence** (two encodings of DEC-06 rules):
  - Mitigation: static conformance suite cross-checks the normative tokens (permitted-field list, WRITE_CONFLICT, CANCELLED, ID rule, DEC IDs) between `e2e.md` and `registry.mjs`; M6 live scenarios are the final arbiter.
- **R3 — Scope ambiguity: "approval write" in the M3 outcome line could be read as permission to write**:
  - Mitigation: this plan's Must-NOT-have + scope-check absence assertion + traceability write-deferral row make the boundary mechanical; the write is a named, separately authorized next action (DEC-06 verbatim: approval of the exact diff, not a hash/receipt, is consent).
- **R4 — `m1.test.mjs` M1-01/M1-11 and M2 invariants fail again after the `e2e.md` edit**:
  - Mitigation: expected and documented — AUTHORIZED_DELTA with before/after hashes in the scope check; M1/M2 artifacts never "fixed" to satisfy old harnesses.
- **R5 — DEC-12 consuming milestone is M5 but AC-010 is M3**: risk of pulling migration execution forward.
  - Mitigation: M3 emits the migration *proposal* and the schema-mismatch record only; the plan forbids applying it; the M5 boundary is restated in traceability.
- **R6 — B12 at reference level could be mistaken for a live concurrency proof**:
  - Mitigation: the report states `method: reference-implementation harness` and that F11 is a temp-dir fixture; live cross-turn concurrency remains covered by the M6 acceptance suite.
- **R7 — Workflow gate blocks non-markdown writes during drafting**:
  - Mitigation: M1/M2 mitigation carried — md-primary evidence; JSON companions are execution-phase work after owner plan approval (M2 precedent: JSON reports emitted post-approval).

## Decisions I made for you
| Decision | Default chosen | Reversible? |
|---|---|---|
| Registry write timing | **Deferred entirely**: M3 implements + proves the lifecycle; `TESTS.md`/`.governance` creation is a separate, later, owner-authorized task against the exact approved diff (DEC-06 verbatim boundary) | no (policy-fixed by DEC-06) |
| B12 execution level | Reference-implementation harness over fixture F11 (no real concurrent writer needed); live cross-turn concurrency stays M6 | yes |
| AC-007 execution level | Deterministic label/hash assertions with a mock runner outcome (F10 pattern); live ad-hoc sandbox execution stays M4 (DEC-07 machinery) | yes |
| AC-008 execution level | Phase-order trace + gate-halt assertion at reference level; no stage actually generates specs or runs anything | yes |
| DEC-12 migration proposal target State | `unverified` (per REGISTRY-CONTRACT §Stale assessment: "covered yang kehilangan confidence → unverified"; stale rows lose their claimed confidence) | yes |
| F13/F14 | Explicitly out of M3 scope (M5 parity/rollback); only a status row in traceability | yes |
| M3 module location | `docs/e2e-v2/m3/tests/registry.mjs` (milestone tree, mirroring M2's `m2/tests/*` layout); M2 modules reused by pattern, not by import-edit | yes |
| MILESTONE-GATES.json | Not touched — no M3 gate exists to promote; DEC-06/DEC-12 already APPROVED in the register | yes |
| Legacy `State: stale` fixtures | Synthetic fixture rows in temp dir only (canonical ECC has none today — confirmed by M2 and re-asserted in preflight) | yes |

## Success Criteria
| IS row | Proven by | QA evidence |
|---|---|---|
| IS-1 | Steps 1–3, 6 | `registry-required.report.json` C02 pass; bootstrap proposal byte-matches approved diff; `scope-check.report.json` `registry_files_absent: true`, violations 0 |
| IS-2 | Steps 2–4 | `ad-hoc.report.json`: `PASS_AD_HOC_UNREGISTERED`, registry hash unchanged, `coverageCredit: false` |
| IS-3 | Steps 2–4 | `full-phase.trace.json`: 6 stages in order, 0 skipped, unauthorized gate → `BLOCKED` halt |
| IS-4 | Steps 2–4 | `registry-preserve.diff.json`: only permitted fields changed, 0 renumber; `idempotence.report.json`: replay produces 0 new IDs; allocator max+1/`001`/no-reuse tests green |
| IS-5 | Steps 2–4 | `stale-migration-proposal.report.json`: mismatch record + proposal emitted, nothing applied; mutation-8 rejection green |
| IS-6 | Steps 2–4 | `concurrency.report.json`: `WRITE_CONFLICT` + rebase + owner bytes intact; CANCELLED zero-action test green |
| IS-1 (scope integrity) | Steps 1, 6 | preflight hashes match pins; frozen M1/M2 artifacts byte-identical; exactly one AUTHORIZED_DELTA (`e2e.md`) |

## Metis gap pass (inline)

| # | Finding | Disposition |
|---|---|---|
| G1 | `MILESTONE-GATES.json` lists DEC-06 `prd_acs: ["AC-010","AC-011"]` while PRD §8 scopes M3 as AC-006..AC-010 — register/gate metadata disagrees with the PRD | RESOLVED — PRD §8 is authoritative for milestone AC scoping (directive pins AC-006..AC-010); the register is not mutated (hash frozen) and the discrepancy is noted in traceability, not "corrected" in a frozen artifact. Same pattern for DEC-12: `MILESTONE-GATES.json` lists `prd_acs: ["AC-009"]`/`E2E-FR-013` while PRD scopes stale governance to AC-010/E2E-FR-010; PRD §8 remains authoritative for both |
| G2 | DEC-12 consuming milestone is M5 (register §3) while AC-010 sits in M3's AC range | RESOLVED — split: M3 = detection + proposal generation + mutation-8 rejection (read-only); M5 = reviewed migration execution. Recorded in Decisions + R5 |
| G3 | B12 was deferred from M2 "because registry writes don't exist yet" — but M3 also performs no write | RESOLVED — B12 is a *detection* behavior, fully testable at reference level against fixture F11 without any real write; the deferral rationale is satisfied by the lifecycle module, and the report labels the proof level honestly (R6) |
| G4 | Directive separates (a) lifecycle implementation from (b) actual registry write; the approved proposal's §3 diff could be misread as "create the files now" | RESOLVED — two-lane structure enforced: Must-NOT-have, scope-check absence assertion, and a named next-authorization row in traceability (R3) |
| G5 | `e2e.md` already contains §3.4/§5/§8/§9 covering much of the governance text — risk of duplicative rewrite | RESOLVED — additive minimal delta only (approval-write flow + ID discipline + DEC-12 sentence), M2 sections byte-stable, conformance-pinned (step 5) |
| G6 | M1/M2 harnesses re-hash live `e2e.md` and will fail after the edit | RESOLVED — AUTHORIZED_DELTA record with before/after hashes (R4); frozen artifacts untouched |
| G7 | AC-007/AC-008 nominally require execution machinery that is M4 (DEC-07 sandbox/environment) | RESOLVED — reference-level assertions only; `live_execution: DEFERRED_TO_M4/M6` stamped; no browser, no mock-that-claims-live |
| G8 | Playwright absent (verified M2); F10/F11/F12 are fixture-level concepts | RESOLVED — all scenario evidence is harness-level over deterministic fixtures; recorded in preflight |
| G9 | Bootstrap fidelity depends on transcribing the approved diff into a test constant | RESOLVED — double anchor: proposal file re-hashed at preflight + byte-compare test; mismatch = STOP (R1) |
| G10 | ID allocation "actual numeric max" requires parsing Section 2/4 IDs from arbitrary registry text | RESOLVED — deterministic ID-line parser over the frozen Section 2/4 formats; malformed ID rows are rejected (not normalized), consistent with the M2 State-enum rule |
| G11 | Canonical ECC has no legacy `State: stale` row to test against | RESOLVED — synthetic fixture rows in temp dir; preflight re-asserts canonical absence; DEC-12 proposal generation is still fully exercisable |
| G12 | Topology: the config template `{file:commands/e2e.md}` + `$ARGUMENTS` must keep resolving after the edit | RESOLVED — frontmatter untouched; conformance suite asserts template compatibility (M2 G11 pattern) |
| G13 | r1 attributed `00c6b455…` to `DECISION-REGISTER.md`; that hash belongs to `MILESTONE-GATES.json` (register = `cd8487…`) | RESOLVED in r2 — each file pinned separately at header, Must-NOT-have, preflight (step 1), scope check (step 6), and References; step 1 asserts both byte-unchanged independently, drift → STOP |
| G14 | r1 hashed `.claude/prds/…prd.md` against `047918df…`; that digest belongs to the bundle `PRD-CANDIDATE.md` (working copy = `bbe563be…`, approval-ledger delta only) | RESOLVED in r2 — `047918df…` kept canonical against `PRD-CANDIDATE.md`; working copy recorded at `bbe563be…` with its one-line provenance note; never silently re-pinned |

Gap pass: 0 BLOCKING · 0 open OWNER_DECISION_REQUIRED · 0 DEFERRED beyond the plan's own explicit M4/M5/M6 deferrals · 14 findings, all RESOLVED (G13/G14 fixed in r2 per review).

## References
- Approved PRD — canonical digest `047918df…` = R1 bundle `PRD-CANDIDATE.md` (immutable); working copy `.claude/prds/e2e-v2-0-unified-journey-mapping.prd.md` = `bbe563be…` (post-approval copy, approval-ledger delta only) — §4 E2E-FR-005..010/014/015, §7 AC-006..AC-010, §8 milestone table, §9 DEC table
- Owner-approved M3 proposal (SHA `50070450…`): `M3-REGISTRY-DIFF-PROPOSAL.md` — §2 bootstrap rules, §3 exact two-file diff, §4 exclusions
- Approved R1 registry contract: `REGISTRY-CONTRACT.md` (R1 bundle extract) — Bootstrap, Stale assessment, Error outcomes, Permitted write fields, ID ownership
- Decision gates `docs/e2e-v2/decisions/MILESTONE-GATES.json` (hash `00c6b455…`) and decision register `docs/e2e-v2/decisions/DECISION-REGISTER.md` (hash `cd8487…`) — each pinned separately, do not mutate
- M2 final state + handoff: `m3m5m6-proposals/m2-final-state-snapshot.json`, `docs/e2e-v2/m2/traceability-m2.md` (§3 not-done, §5 open items), `docs/e2e-v2/m2/tests/*` (patterns), `docs/e2e-v2/m2/reports/*` (report shapes)
- R1 bundle (read-only): `DETERMINISTIC-VERIFICATION.md` §3 (concurrency), `FIXTURE-MATRIX.md` (F07/F10/F11/F12/F13/F14), `ACCEPTANCE-MATRIX.csv` (A08/B08/B09/B12/C02/C03), `NEGATIVE-MUTATION-PLAN.md` (mutation 8)
- Product surface: `.opencode/commands/e2e.md` (M2 delta, current state)
- Precedent plans: `docs/plans/e2e-v2-0-m2-unified-interface.plan.md` (r2), `docs/plans/e2e-v2-0-unified-journey-mapping.plan.md` (r3)
