# Implementation Plan: ECC-OPL /e2e V2.0 — Milestone 2 "Unified interface, mode parser, deterministic validators & isolated command-resolution validation"

Status: APPROVED
Revision: r2
Readiness: READY_FOR_EXECUTION
Mode: standard (PRD-driven, owner-approved PRD)
Milestone: M2 (of 6) — scope strictly limited to M2
Upstream digest (approved PRD, SHA-256): `047918df0835bc7ea52f0d0dc7714f0b29394cce32ad8c2580b2973dfce1d211`
Worktree PRD copy SHA-256: `bbe563be553147e4ff348622e54a75689db209bd798e85f85a97d739895191a9` (includes owner-approval annotation)
M1 frozen baseline ZIP: `ecc-opl-e2e-v2.0-m1-r1-contract-evidence-reconciliation-review.zip` — SHA `9d1417f1709ab14933476cacf37b46b0dc512849011abea67984bb4fe073c22f`
Single entry document for M2: `docs/e2e-v2/m1/traceability-m1.md`

## Overview

M2 turns the frozen M1 contracts into a working unified `/e2e` interface: a fail-closed mode parser (6 modes + `run --ad-hoc` sub-mode per approved DEC-05), a deterministic target resolver, read-only `status`/`help`/no-args modes, a read-only `map` phase (discovery + proposal, never a write), and the `REGISTRY_REQUIRED` fail-closed behavior for unregistered `run`. It executes the 19 frozen validator cases (PS/RP/SE) plus the B10 stale-enum check as named tests in a zero-dependency `node --test` harness, validates detector portability against the frozen F01–F06 expected-output contracts (ASM-02), and executes the M1-specified isolated command-resolution probe in a repo-external sandbox HOME (ASM-01/ARGS + ASM-01/PRECEDENCE). No browser execution, no registry writes, no `/e2e-map` change, no installs.

## Affected User and Ideal State

**Affected user**:
1. **Owner** — today invokes `/e2e` with one implicit dangerous behavior (any argument can trigger unregistered execution, `e2e.md:33` "proceed exactly as before") and unknown config precedence; after M2 the owner gets explicit modes, fail-closed parsing, and probe-evidenced precedence.
2. **`e2e-runner` child agent** — today receives dispatch briefs with no mode contract; after M2 it is dispatched only by `run`/`full` on registered targets (or explicit `--ad-hoc`), with the frozen evidence contract referenced.
3. **M3–M6 implementer sessions** — today must re-derive parser/validator semantics; after M2 they consume executed validator reports, a reference parser, and resolved ASM gate evidence.
4. **plan-reviewer** — verifies M2 output deterministically (harness rerun, report status fields, scope check) without executing anything risky.

| Row | Statement | Reason |
|---|---|---|
| IS-1 | `/e2e` parses arguments fail-closed: exactly one of 6 modes (+ `run --ad-hoc` sub-mode), unknown/conflicting/injected input terminates before any Read/Write/Browser action with a usage message | Frozen command contract §1–§3; PRD E2E-FR-001/020 |
| IS-2 | Unregistered `run` never dispatches the runner: `REGISTRY_REQUIRED`, registry untouched; `run --ad-hoc` is explicit, sandboxed, non-production, and never earns registry coverage | Frozen contract §2/§4; DEC-05 approved policy; PRD E2E-FR-005/006 |
| IS-3 | Registry-path and symlink/escape rules are enforced by deterministic validators with named evidence artifacts, not by prompt prose alone | DETERMINISTIC-VERIFICATION §1–§2; validator-specs 19 cases |
| IS-4 | The effective command winner and `$ARGUMENTS` semantics are proven by raw sandbox probe evidence (or honestly `INCONCLUSIVE`), with the real `$HOME` byte-identical afterwards | ASM-01 gates; M1 `command-resolution-evidence.md` §4 |
| IS-5 | Map-phase discovery on F01–F06 fixtures matches the frozen expected-output contracts (locale dedup, exclusions, PARTIAL for dynamic, no invented routes) | ASM-02; PRD AC-002/AC-019; B01–B04, B05, B06 |
| GAP-1 | Today `/e2e` has no mode grammar: any `$ARGUMENTS` flows into the legacy run-ish orchestration | `e2e.md:8–10` — single implicit path, no fail-closed gate |
| GAP-2 | Today unregistered flows still execute (`e2e.md:33` "proceed exactly as before") | Direct contract violation E2E-FR-005; the PRD's core metric |
| GAP-3 | The 19 PS/RP/SE cases plus B10 are frozen specs with `NOT_RUN` companions; no executable validation exists | `validator-specs.md` "All NOT_RUN"; M1 traceability §2 |
| GAP-4 | Command precedence and `$ARGUMENTS` semantics are `NOT_VERIFIED` | M1 recorded the uncertainty; the probe is the M2 resolution path |
| GAP-5 | Detector portability (ASM-02) unvalidated; F01–F06 expected contracts `NOT_RUN` | M1 characterization is the spec; execution is M2 |
| GAP-6 | No M2 traceability or scope evidence exists | Every milestone closes with an artifact→AC→requirement map |

## Requirements

### Must have
- **Unified mode parser** in `.opencode/commands/e2e.md`: exactly 6 modes (`map`, `run`, `full`, `status`, `help`, no-args) + `run --ad-hoc` sub-mode; fail-closed on unknown mode (PS-01), conflicting modes (PS-02), duplicate flags (PS-03), empty target after `run` → no-args (PS-04), shell metacharacters/`$()`/backticks/newline smuggling (PS-05..08); every parse failure emits the usage message listing the 6 modes and performs no Read/Write/Browser action.
- **`REGISTRY_REQUIRED` fail-closed run** replacing the legacy "proceed exactly as before" path (E2E-FR-005).
- **DEC-05 policy wired**: `run --ad-hoc` recognized, routed to the ad-hoc phase shape (warning → preflight → isolated execution → `PASS_AD_HOC_UNREGISTERED` → STOP), scratch evidence only, no registry coverage credit; production/unknown targets `BLOCKED` (DEC-07 contract text; execution machinery itself is M4).
- **Legacy shorthand safety (DEC-04 minimal application)**: a non-mode leading token (old `/e2e <flow>`) produces a migration hint pointing to `/e2e run <flow>` / `/e2e map` and executes nothing. The `legacy-command-shims/` surface itself stays M5.
- **Target resolver** (E2E-FR-004/AC-005): ID exact → unique title → route in `Representative input`; ambiguity → candidate list with one `(Recommended)` default, never a silent pick.
- **Read-only modes**: `status`, `help`, no-args never write, never load the browser runner (E2E-NFR-004); absent registry reported honestly, never created (AC-003/004; F08 shape).
- **Map phase, read-only**: discovery per the characterized detector rules + V2 correction overlay (D1–D4, dynamic → `PARTIAL`, `stale` assessment-only, `Command` = actual CLI), output = proposal only; no `TESTS.md` creation or write (DEC-06 is M3).
- **Deterministic validators executed**: all 19 PS/RP/SE cases + B10 stale-enum check as named tests, producing the M1-named evidence artifacts under `docs/e2e-v2/m2/reports/`.
- **ASM-01 isolated probe** executed exactly per `m1/command-resolution-evidence.md` §4 (sandbox candidates A–D + `$ARGUMENTS` echo), in repo-external session temp, real `$HOME` re-hashed after.
- **ASM-02 fixture validation**: F01–F06 disposable fixtures vs frozen expected contracts; B05 locale-dedup and B06 journey-grouping assertions executed over the same outputs.
- **M2 traceability + scope check** closing the milestone (GAP-6).

### Must NOT have (scope guardrails)
- No browser/Playwright execution, no Playwright/agent-browser/npm install, no lockfile change (E2E-NFR-002; DEC-09; Playwright verified absent — see Preflight).
- No `TESTS.md` creation, no registry write of any kind, no registry migration (DEC-06 is M3; bootstrap is *defined*, not executed).
- No edit to `.opencode/commands/e2e-map.md` (M3/M5), `agents/e2e-runner.md` or `.opencode/prompts/agents/e2e-runner.txt` (M4), `legacy-command-shims/commands/e2e.md` (M5), any config command map (M5), or any skill (`skills/e2e-testing`, `skills/test-collaboration`, `skills/click-path-audit` — deferred to their consuming milestones; see Decisions).
- No `/e2e-map` disablement (DEC-10 is M5; parity work is M5).
- No edits to frozen M1 artifacts (`docs/e2e-v2/m1/**`, `docs/e2e-v2/contracts/**`, `SOURCE-BASELINE-FROZEN.md`), the approved PRD, or plan r3 — except the explicitly authorized post-probe status update to `docs/e2e-v2/decisions/MILESTONE-GATES.json` (amendment artifact, not frozen M1 evidence).
- No `.git` / `.guardian-angel` access; no active-`$HOME` writes (global config reads are read-only; probe uses sandbox HOME only).
- No M3–M6 implementation: no registry writer, no concurrency write-probe (B12 → M3), no runner evidence contract, no parity/disable-default, no CI.
- No marking of ASM gates `VERIFIED` without raw probe/fixture evidence actually produced this milestone.

## Patterns to Mirror
- Harness style of `docs/e2e-v2/m1/tests/m1.test.mjs`: zero-dependency `node --test`, re-derives every fact from live sources, portable root resolution, fail-closed on missing inputs.
- Report naming: reuse the exact R1/M1 bundle artifact basenames (`parser-failclosed.report.json`, `registry-path.reject.json`, `symlink-escape.reject.json`, …) under `docs/e2e-v2/m2/reports/` so reviewers diff like-for-like; M1's frozen companions stay `NOT_RUN` untouched.
- Honest status discipline: every report carries `status` + `deferred_to` where execution did not happen; never fabricate a PASS.
- Plan header/structure of `docs/plans/e2e-v2-0-unified-journey-mapping.plan.md` r3.
- Frontmatter style of the existing `.opencode/commands/e2e.md` (`description`, `argument-hint`) — the config template `{file:commands/e2e.md}\n\n$ARGUMENTS` must keep resolving.

## Architecture Changes

Product behavior changes (authorized M2 surface per plan r3 Architecture Changes + DEC-05):

```
.opencode/commands/e2e.md        # REWRITTEN: unified interface — mode grammar, 6 modes +
                                 #   run --ad-hoc sub-mode routing, phase separation, resolver,
                                 #   REGISTRY_REQUIRED, registry-path rules, Command/Invocation,
                                 #   map-phase overlay referencing e2e-map.md procedure + V2 fixes
docs/e2e-v2/m2/                  # NEW milestone evidence tree
  tests/
    parser.mjs                   # reference parser implementation (normative grammar encoding)
    resolver.mjs                 # reference target resolver (ID → title → route)
    validators.mjs               # registry-path / symlink-escape / State-enum validators
    m2.test.mjs                  # node --test harness: 19 PS/RP/SE cases + B10 + AC-005 +
                                 #   F01–F06 fixture execution + static conformance of e2e.md
  reports/                       # evidence companions (M1 bundle basenames)
    m2-preflight.report.json
    command-resolution.report.json   # ASM-01 probe results (m1 companion stays frozen NOT_RUN)
    parser-failclosed.report.json    # PS-01..04, PS-08
    prompt-injection.report.json     # PS-05..07
    command-not-executed.trace.json  # PS-09
    registry-path.reject.json        # RP-01..06
    symlink-escape.reject.json       # SE-01..04
    stale-assessment.report.json     # B10
    F01-map-output.json … F04-F06-map-output.json  # CSV-named actual outputs (ASM-02/B01–B04)
    locale-dedup.report.json         # B05 assertions
    journey-grouping.report.json     # B06 assertions
    scope-check.report.json
  tdd-record.md                  # TDD evidence report (RED→GREEN log per tdd-workflow)
  traceability-m2.md             # artifact → scenario → AC → requirement map
docs/e2e-v2/decisions/MILESTONE-GATES.json  # ASM gate statuses updated ONLY after raw evidence
```

Deliberately NOT changed in M2: `e2e-map.md` (map phase *references* its Step 1–3 detector procedure as the single source of detector truth until M5 disable — no duplication), runner agent/prompt, skills, shims, configs. The parser is **prompt-side** by frozen design (DETERMINISTIC-VERIFICATION §1: "$ARGUMENTS diparse dari prompt"); the reference implementation in the harness is the test oracle, not a shell-invoked product script — invoking a parser through a shell would itself create the injection surface PS-05..07 forbid.

## Implementation Steps

Gating legend: **[OFFLINE]** = pure deterministic work, no runtime dependency. **[RUNTIME-PROBE]** = executes the M1-specified sandbox probe (no browser, no network, no installs, no real-HOME writes; permitted by frozen M1 §4 spec + M2 scope). **[PRODUCT-EDIT]** = edits product behavior; performed only by the authorized M2 execution session, never during planning. Everything browser- or registry-write-shaped is **out of M2 entirely**.

### Phase 0: Preflight

1. **Baseline re-hash & environment facts** (File: `docs/e2e-v2/m2/reports/m2-preflight.report.json`)
   - Action: Re-hash the 8 M1 source files + 3 config surfaces against `SOURCE-BASELINE-FROZEN.md`; record: Playwright **not installed** (verified 2026-11-23: no `node_modules/playwright`, no global binary), `TESTS.md` absent, `.governance/docs-map.json` absent, Node v24.21.0, workflow-gate state from `.opencode/workflows/active.json`.
   - Why: M1 handoff step 5 — "re-hash before touching anything; drift = stop"; the absent-Playwright fact must be on record before any M2 claim about executable browser proofs.
   - Closes: supports GAP-3, GAP-4 (preconditions)
   - References: `docs/e2e-v2/SOURCE-BASELINE-FROZEN.md`; `docs/e2e-v2/m1/traceability-m1.md` §7
   - Acceptance: every hash matches the frozen table; environment facts recorded with observed evidence, not assumptions.
   - QA: happy — `shasum -a 256 .opencode/commands/e2e.md` = `08b17f2c…95dd` matches the frozen row; failure — any mismatch → `DRIFT_DETECTED` row and the milestone STOPS fail-closed before any other step.
   - Dependencies: None. **[OFFLINE]**
   - Risk: Low

### Phase 1: Isolated command-resolution probe (ASM-01)

2. **Execute the ASM-01 sandbox probe — ARGS + PRECEDENCE** (File: `docs/e2e-v2/m2/reports/command-resolution.report.json`; gate update: `docs/e2e-v2/decisions/MILESTONE-GATES.json`)
   - Action: Execute `m1/command-resolution-evidence.md` §4 verbatim, extended for ARGS: sandbox `<session-temp>/opencode/m2-probe/{home,project}` (never real `$HOME`); candidates A (project only), B (global json only), C (dual global), D (all three) with distinct sentinel templates; each sentinel template contains an `ARGS-ECHO:` line emitting `$ARGUMENTS` so one probe run records both the winner (echoed sentinel) and the substitution semantics (verbatim string vs split tokens, quoting behavior) per invocation of `/e2e help` and one args-bearing invocation. Record winner per candidate or `INCONCLUSIVE` with raw observed output — never "assume project wins". Then: literal-path delete of the sandbox; re-hash the real global configs against the frozen baseline. Only after raw evidence exists, update the `ASM-01/ARGS` and `ASM-01/PRECEDENCE` statuses in `MILESTONE-GATES.json` (amendment artifact — permitted; frozen M1 artifacts stay untouched) and record the update in the report.
   - Why: GAP-4 — the gates have been open since M1 precisely for this probe; the winner also determines whether the step-5 product edit is *effective* (see Risks R2).
   - Closes: GAP-4
   - References: `docs/e2e-v2/m1/command-resolution-evidence.md` §2–§4; `docs/e2e-v2/m1/reports/command-resolution.report.json` (frozen probe spec); `docs/e2e-v2/decisions/MILESTONE-GATES.json` §4
   - Acceptance: report contains per-candidate winner-or-INCONCLUSIVE with raw output; `ARGS-ECHO` results recorded; sandbox deleted; real-HOME hashes unchanged; gate statuses updated only where evidence exists (`INCONCLUSIVE` keeps the gate open with the evidence attached).
   - QA: happy — `jq '.candidates | length' command-resolution.report.json` = 4 and every candidate has `winner` or `INCONCLUSIVE` + raw output; failure — probe cannot run offline (e.g. runtime requires network) → record `INCONCLUSIVE` + the blocking observation, keep gates `NOT_VERIFIED`, do not retry via network.
   - Dependencies: Requires step 1 (hashes prove the baseline being probed against). **[RUNTIME-PROBE]**
   - Risk: Medium (see R1, R2)

### Phase 2: Mode parser (TDD)

3. **RED — reference parser tests** (File: `docs/e2e-v2/m2/tests/m2.test.mjs`, `docs/e2e-v2/m2/tests/parser.mjs`)
   - Action: Write failing tests first for the parser grammar over the raw post-substitution `$ARGUMENTS` string: PS-01 unknown mode; PS-02 conflicting modes (`map run TEST-E2E-001`); PS-03 duplicate `--ad-hoc`; PS-04 empty/whitespace after `run` → no-args; PS-05 `;`/`&&`/`|`/redirect metacharacters; PS-06 `$( )`; PS-07 backticks; PS-08 embedded newline; `--ad-hoc` on a non-`run` mode → fail closed; bare non-mode leading token → legacy-shorthand result (hint, no execution); happy parses for all 6 modes + `run --ad-hoc TEST-E2E-NNN`. Assert fail-closed results carry the usage message listing exactly the 6 modes and `action: none`.
   - Why: TDD RED gate — no production grammar work before a failing test exists (tdd-workflow Step 3).
   - Closes: supports GAP-1
   - References: `docs/e2e-v2/contracts/validator-specs.md` §1; `docs/e2e-v2/contracts/command-contract.md` §1–§3; `docs/e2e-v2/m1/reports/parser-failclosed.report.json` (spec companion)
   - Acceptance: suite runs and fails for the intended reason (module absent / assertions unmet) — a written-but-never-executed test is not RED.
   - QA: happy — `node --test docs/e2e-v2/m2/tests/` exits nonzero with the new parser tests failing; failure — tests pass immediately → the grammar was pre-implemented; revert and restart RED.
   - Dependencies: None (parallel with Phase 1). **[OFFLINE]**
   - Risk: Low

4. **GREEN — implement reference parser** (File: `docs/e2e-v2/m2/tests/parser.mjs`)
   - Action: Minimal zero-dependency implementation making the step-3 tests pass: tokenize the raw string; newline anywhere → fail closed (PS-08); first token mode-match ∈ {map, run, full, status, help}; empty → no-args; non-mode leading token → legacy-shorthand outcome; `--ad-hoc` accepted only immediately after `run`, at most once; injection-character reject-list applied to every token before any further interpretation; output `{mode, subMode?, target}` or `{failClosed, reason, usage}`. Append RED→GREEN entries to `docs/e2e-v2/m2/tdd-record.md`.
   - Why: The parser is prompt-side by frozen design; this module is the normative, testable encoding of the grammar the prompt must mirror.
   - Closes: supports GAP-1, GAP-3 (PS grammar cases)
   - References: `DETERMINISTIC-VERIFICATION.md` §1 (R1 bundle); step 3 tests
   - Acceptance: all step-3 tests green; grammar rules trace 1:1 to PS case IDs.
   - QA: happy — `node --test docs/e2e-v2/m2/tests/` green for the parser suite; failure — any red → fix implementation, not tests (unless a test misencodes the frozen spec).
   - Dependencies: Requires step 3. **[OFFLINE]**
   - Risk: Low

5. **Rewrite `.opencode/commands/e2e.md` — unified interface** (File: `.opencode/commands/e2e.md`) **[PRODUCT-EDIT]**
   - Action: First write the static conformance test (RED against the *current* file): it asserts the file contains the exact 6-mode grammar + fail-closed rules + `REGISTRY_REQUIRED` behavior + resolver order + `Command`/`Invocation` separation + ad-hoc gate text + read-only guarantees for status/help/no-args + the map-phase overlay pointer. Then rewrite the file (GREEN): preserve frontmatter style (`description`, `argument-hint` updated to mode form, e.g. `"[map|run|full|status|help] [target | TEST-E2E-NNN] [--ad-hoc]"`); structure = §1 parse (grammar mirroring `parser.mjs`, fail-closed before any action) → §2 route per the frozen gate table (map/run/full/status/help/no-args + ad-hoc sub-mode row) → §3 per-mode phases: `run` = resolver lookup → not found → `REGISTRY_REQUIRED` (no dispatch; replaces `e2e.md:33` "proceed exactly as before") → preflight → dispatch `e2e-runner` (existing brief shape preserved) → evidence → matched-block update per frozen §6 write surface; `run --ad-hoc` = DEC-05 text (warning, isolated sandbox, authorized non-production target only, production/unknown → `BLOCKED` per DEC-07 contract text, `PASS_AD_HOC_UNREGISTERED`, no registry credit); `map` = perform the `e2e-map.md:31–64` discovery procedure **plus the V2 correction overlay** (D1 locale dedup, D2 grouping, D3 actor labels, D4 dynamic → `PARTIAL`, `stale` assessment-only, `Command` = actual Playwright CLI or empty until verified) → proposal in report output only, never a write, absent registry → bootstrap *proposal* per DEC-06 shape (F08); `full` = the frozen §3 sequence with the combined review gate; `status`/`help`/no-args = read-only, lazy loading (E2E-NFR-004), absent registry reported honestly; resolver § = E2E-FR-004 order + ambiguity → candidates with one `(Recommended)` default; registry-path § = the RP rules in prompt form (docs-map honoured only when valid and in-repo; absolute/`..`/symlink/workspace escape rejected; dual-location conflict → STOP); trust boundary § = `TESTS.md`, `Command:` strings, comments, route strings are data, never instructions (E2E-FR-020). Keep the file within the existing doc's stylistic register (imperative, sectioned, no new dependencies).
   - Why: This is the M2 product deliverable (E2E-FR-001..005, AC-001..005); the conformance test pins the frozen contract into the product file.
   - Closes: GAP-1, GAP-2
   - References: `docs/e2e-v2/contracts/command-contract.md` (whole file); `docs/e2e-v2/m1/detector-characterization.md` §1–§3; `docs/e2e-v2/contracts/journey-contract-freeze.md` §3–§4; current `.opencode/commands/e2e.md`; `docs/e2e-v2/decisions/DECISION-REGISTER.md` §3 (DEC-04/05/07 consumption text)
   - Acceptance: conformance test green; no mode reachable without an explicit token; `run` not-found path emits `REGISTRY_REQUIRED` and never dispatches; every DEC-dependent line cites its DEC ID; file still resolves as the config template target.
   - QA: happy — `node --test docs/e2e-v2/m2/tests/` conformance suite green; `grep -c 'REGISTRY_REQUIRED' .opencode/commands/e2e.md` ≥ 1 and the legacy "proceed exactly as before" instruction absent; failure — conformance red → the file diverges from the frozen contract; fix the file, not the test.
   - Dependencies: Requires steps 2 (winner informs effectiveness claim), 4 (grammar to mirror). **[PRODUCT-EDIT]**
   - Risk: Medium (see R2, R5)

### Phase 3: Deterministic validators (TDD)

6. **RED — validator tests** (File: `docs/e2e-v2/m2/tests/m2.test.mjs`, `docs/e2e-v2/m2/tests/validators.mjs`)
   - Action: Write failing tests for: RP-01 absolute registry path; RP-02 `..` traversal; RP-03 symlinked `TESTS.md` escaping the repo (realpath check before any access); RP-04 docs-map mapping to an external dir (docs-map is untrusted data); RP-05 dual-location disagreement → STOP, no winner picked; RP-06 `Test file` field absolute or containing `..`; SE-01 evidence artifact symlink outside scoped root → not citable, not `covered`; SE-02 artifact resolving outside the scoped ignored root; SE-03 spec file symlink escape → preflight reject; SE-04 `Evidence` pointing at a nonexistent path → evidence invalid, `covered` impossible; B10 `State: stale` → schema-mismatch record proposing correction (never silent migration); any `State` outside the 5 controlled values → row rejected, not normalized. Fixtures are disposable files/symlinks created under the session temp dir at test time and deleted after.
   - Why: TDD RED for the deterministic enforcement layer (DETERMINISTIC-VERIFICATION §2).
   - Closes: supports GAP-3
   - References: `docs/e2e-v2/contracts/validator-specs.md` §2–§4; `docs/e2e-v2/contracts/command-contract.md` §4, §6
   - Acceptance: suite red for the intended reason.
   - QA: happy — `node --test docs/e2e-v2/m2/tests/` shows the new validator tests failing; failure — instant pass → restart RED.
   - Dependencies: None. **[OFFLINE]**
   - Risk: Low

7. **GREEN — implement validators** (File: `docs/e2e-v2/m2/tests/validators.mjs`)
   - Action: Minimal zero-dependency implementations: registry-path resolver (candidate = docs-map mapping only when the docs-map parses, is in-repo, and its target resolves in-repo; else root `TESTS.md`; rejection classes per RP; dual-location → STOP result), escape checks via `fs.realpath` comparisons against the repo/scoped roots, State-enum validator emitting the B10 mismatch/correction records. Append RED→GREEN to `tdd-record.md`.
   - Why: These are the functions the prompt's registry-path § mirrors and the reports are generated from.
   - Closes: GAP-3 (RP/SE/B10 cases)
   - References: step 6 tests; `REGISTRY-CONTRACT.md` §2 (R1 bundle, via validator-specs transcription)
   - Acceptance: all step-6 tests green; every validator result maps to a named case ID.
   - QA: happy — validator suite green; failure — red → fix implementation.
   - Dependencies: Requires step 6. **[OFFLINE]**
   - Risk: Low

8. **Execute the full matrices → evidence reports** (Files: `docs/e2e-v2/m2/reports/parser-failclosed.report.json`, `prompt-injection.report.json`, `command-not-executed.trace.json`, `registry-path.reject.json`, `symlink-escape.reject.json`, `stale-assessment.report.json`)
   - Action: Run the harness and emit one report per M1-named artifact with per-case records: PS-01..04+PS-08 → `parser-failclosed` (reference parser), PS-05..07 → `prompt-injection` (reference parser reject-list; each record states the token was rejected before any shell boundary and nothing executed), PS-09 → `command-not-executed.trace` (fixture registry whose `Command:` holds shell text; assert the resolver/parser treat it as untrusted data — no evaluation, no execution, `Invocation` built separately), RP-01..06, SE-01..04, B10. Every report carries `status`, `method: "reference-implementation harness (node --test)"`, and `live_prompt_verification: "DEFERRED_TO_M6 (48-scenario acceptance)"` — harness-level proof of the grammar/validator logic, honestly labeled; the live prompt behaviors are M6's scenario runs.
   - Why: GAP-3 — turns the frozen 19-case spec of record into executed, traceable evidence without faking live behavior.
   - Closes: GAP-3
   - References: `docs/e2e-v2/contracts/validator-specs.md` (all tables); `docs/e2e-v2/m1/reports/*.json` (frozen NOT_RUN companions — untouched)
   - Acceptance: all 19 cases + B10 appear exactly once across the reports with concrete observed outcomes; zero cases say "verify it works"; M1 companions remain byte-identical.
   - QA: happy — `grep -cE '"(PS|RP|SE)-[0-9]+"' docs/e2e-v2/m2/reports/*.json` totals ≥ 19 distinct IDs; `jq '.status'` per report is a concrete executed status; failure — a case missing or vague → the matrix is incomplete, phase not done.
   - Dependencies: Requires steps 4, 7. **[OFFLINE]**
   - Risk: Low

### Phase 4: Resolver + map-phase validation (ASM-02, B05/B06)

9. **Target resolver tests (AC-005)** (File: `docs/e2e-v2/m2/tests/resolver.mjs` + `m2.test.mjs`)
   - Action: TDD (RED first): resolver over fixture registries — exact `TEST-E2E-NNN` wins over title and route; unique title matches; route match via `Representative input`; multiple candidates → ordered candidate list + single `(Recommended)` default, no silent pick; zero candidates in `run` context → `REGISTRY_REQUIRED`; resolver output never executes `Command:` values (PS-09 overlap). Then implement minimally. Record RED→GREEN.
   - Why: E2E-FR-004/AC-005 is M2 scope; the resolver is the second deterministic core of the unified interface.
   - Closes: supports GAP-1, GAP-2
   - References: `.opencode/commands/e2e.md` (current match-order text, to be preserved); `command-contract.md` §5
   - Acceptance: resolver suite green; ambiguity never auto-resolves; `REGISTRY_REQUIRED` on empty match.
   - QA: happy — `node --test docs/e2e-v2/m2/tests/` resolver suite green; failure — a test red → fix implementation.
   - Dependencies: None (parallel with Phase 3). **[OFFLINE]**
   - Risk: Low

10. **F01–F06 fixture execution vs frozen expected contracts (ASM-02) + B05/B06 assertions** (Files: `docs/e2e-v2/m2/reports/F01-map-output.json`, `F02-map-output.json`, `F03-map-output.json`, `F04-F06-map-output.json`, `locale-dedup.report.json`, `journey-grouping.report.json`)
   - Action: Build the six disposable fixture projects in the session temp dir per `FIXTURE-MATRIX.md` F01–F06 setups (literal-path cleanup afterwards). Implement the reference detector in the harness as: the characterized base rules (`detector-characterization.md` §1, verbatim globs/exclusions per stack) **composed with the V2 correction overlay** (the same overlay the step-5 map phase uses). Run it per fixture and diff against the frozen `m1/reports/F01-F06-map-output-expected.json` `must_output`/`must_not` rows. Execute the B05 locale-dedup assertions (5 LD) and B06 journey-grouping assertions (7 JG) over the same outputs (they are properties of F01/F03/F05 grouping behavior). Emit per-fixture actual outputs under their ACCEPTANCE-MATRIX.csv names with per-fixture `MATCH`/`MISMATCH`/`INCONCLUSIVE` and raw evidence.
   - Why: GAP-5 — ASM-02 is the last open technical gate owned by M2; AC-002's verification column is F01–F06.
   - Closes: GAP-5
   - References: `docs/e2e-v2/m1/reports/F01-F06-map-output-expected.json` (frozen contracts); `docs/e2e-v2/m1/detector-characterization.md`; FIXTURE-MATRIX.md (R1 bundle); `journey-contract-freeze.md` §3
   - Acceptance: every fixture's actual output satisfies its `must_output` and violates none of its `must_not`; any mismatch is recorded as `MISMATCH` with the diff — never silently accepted; B05/B06 assertion counts match their frozen specs (5 LD, 7 JG).
   - QA: happy — `jq '.fixtures[] | select(.status=="MATCH") | .fixture_id' F01-map-output.json …` covers F01–F06; failure — a `must_not` violation (e.g. `route.ts` mapped as UI) → `MISMATCH` record + fix the overlay/implementation, re-run; a detector inventing a route is an automatic failure.
   - Dependencies: Requires step 1 (baseline), step 4 (overlay encoded once, shared with step 5). **[OFFLINE]**
   - Risk: Medium (see R6)

### Phase 5: Closure

11. **M2 scope check** (File: `docs/e2e-v2/m2/reports/scope-check.report.json`)
   - Action: Inventory every file written during M2 — allowed set: `docs/e2e-v2/m2/**`, `docs/plans/e2e-v2-0-m2-unified-interface.plan.md`, `.opencode/commands/e2e.md`, `docs/e2e-v2/decisions/MILESTONE-GATES.json` (gate-status update only, post-evidence). Re-hash the M1 frozen artifacts (`docs/e2e-v2/m1/**`, `contracts/**`, `SOURCE-BASELINE-FROZEN.md`) proving byte-identity. Record `.opencode/commands/e2e.md` as `AUTHORIZED_DELTA` with before (`08b17f2c…`) and after hashes — the *expected* consequence of the M2 product edit, not a violation. Confirm protected paths untouched (filesystem metadata only; no `.git`/`.guardian-angel` access) and real `$HOME` configs byte-identical.
   - Why: E04-pattern audit trail; without the AUTHORIZED_DELTA record the M1 harness's M1-01 check would read as unexplained drift.
   - Closes: supports GAP-6
   - References: `docs/e2e-v2/m1/reports/scope-check.report.json` (pattern); `SOURCE-BASELINE-FROZEN.md`
   - Acceptance: written-file set ⊆ allowed set; all frozen M1 artifacts byte-identical; exactly one AUTHORIZED_DELTA (e2e.md) plus the gated MILESTONE-GATES.json update; no HOME writes.
   - QA: happy — `jq '.violations | length' scope-check.report.json` = 0 and `jq '.authorized_deltas | length'` = 1..2; failure — any out-of-set write → revert it and re-check before proceeding.
   - Dependencies: Requires steps 1–10 (final gate). **[OFFLINE]**
   - Risk: Low

12. **M2 traceability + TDD evidence + review handoff** (Files: `docs/e2e-v2/m2/traceability-m2.md`, `docs/e2e-v2/m2/tdd-record.md`)
   - Action: Map every M2 artifact → scenario ID → AC → requirement (probe→ASM-01/AC-001-supporting; parser suite→PS-01..08/E2E-FR-001/AC-001; e2e.md rewrite→AC-001..005; validator reports→RP/SE/E2E-FR-020; stale report→B10/E2E-FR-010-supporting; F01–F06→B01–B04/AC-002/AC-019 + ASM-02; B05/B06 reports→AC-019/AC-009-supporting; resolver suite→AC-005). State explicitly what M2 did NOT do (no browser, no registry write, no B12 — deferred to M3 with rationale, no runner/skill/config edits). Then hand the plan + artifacts to `plan-reviewer` per the verification gate (user-run; fix blockers on follow-up; cap 3 rounds).
   - Why: Closes the M2 loop; becomes M3's entry document alongside the M1 handoff.
   - Closes: GAP-6
   - References: `docs/e2e-v2/m1/traceability-m1.md` (format); `REQUIREMENTS-TRACEABILITY.csv` (bundle)
   - Acceptance: every M2 artifact appears ≥1 row; no M3–M6 artifact claimed done; ASM gate status changes each cite their raw-evidence report; B12 deferral to M3 recorded with rationale.
   - QA: happy — `grep -c '→' traceability-m2.md` ≥ 12 rows; failure — an artifact with no row → traceability incomplete.
   - Dependencies: Requires steps 1–11. **[OFFLINE]**
   - Risk: Low

## Testing Strategy
- **Runner**: `node --test docs/e2e-v2/m2/tests/` — zero-dependency, mirroring the M1 harness. Coverage on the new JS modules (`parser.mjs`, `resolver.mjs`, `validators.mjs`) via `node --test --experimental-test-coverage`; target ≥ 80% lines/branches on the new modules (TDD discipline applies to this code; the prompt file is verified by the conformance suite, not coverage).
- **TDD**: RED→GREEN logged per step in `docs/e2e-v2/m2/tdd-record.md` (stage, exact command, result excerpt). No production grammar/validator work before a confirmed RED.
- **Two-layer honesty**: harness results prove the reference implementation; `live_prompt_verification: DEFERRED_TO_M6` is stamped on every report — the 48 live scenarios + 14 negative mutations are M6 acceptance work (PRD §8), and anything requiring a browser is `NOT_RUN` (Playwright absent, no install permitted).
- **Fixtures**: all disposable, created under the session temp dir at test time, literal-path cleanup; no fixture ever lives in-repo; no test touches the real `$HOME`.
- **Static conformance**: the e2e.md conformance suite is the contract-to-product pin; it is written before the rewrite (RED) and re-run after every product edit.

## Risks & Mitigations
- **R1 — Probe inconclusive**: the OpenCode runtime may not resolve commands in a bare sandbox, or may require network (update checks) that the guardrails forbid.
  - Mitigation: `INCONCLUSIVE` with raw observed output is a first-class outcome (the M1 spec says so verbatim); gates stay open with evidence attached; no retry via network; precedence remains an M5 input.
- **R2 — Global surface wins the probe**: the project-side `e2e.md` edit would not be the effective definition, and HOME writes are forbidden.
  - Mitigation: sequence the probe (step 2) before the rewrite (step 5); if a global surface wins, M2 records `implemented, deployment-effective: NO — global surface shadows project edit` and the global-sync/deployment decision routes to M5 (DEC-10 scope) with an explicit owner authorization for any HOME write. M2 never writes HOME.
- **R3 — Workflow gate blocks non-markdown writes** (`.opencode/workflows/active.json`, `gates.approved=false` during drafting).
  - Mitigation: M1's carried mitigation — md-primary evidence; JSON companions are execution-phase work after owner approval; if the gate is still active, emit markdown tables in the same paths and defer JSON to the first authorized write phase.
- **R4 — `m1.test.mjs` M1-01 fails after the `e2e.md` edit** (the M1 harness re-hashes live files).
  - Mitigation: expected and documented — the M1 harness is frozen-commit evidence of M1 state; the M2 scope check records the AUTHORIZED_DELTA with before/after hashes. Do not "fix" M1 artifacts to make the old harness pass.
- **R5 — Reference-implementation drift vs prompt grammar**: two encodings of the same rules can diverge.
  - Mitigation: the static conformance suite cross-checks the normative tokens (mode list, reject-list, REGISTRY_REQUIRED, resolver order) between `e2e.md` and `parser.mjs`; M6 live scenarios are the final behavioral arbiter.
- **R6 — Detector reference vs frozen expected contracts mismatch** (e.g. Laravel/Inertia journey spanning backend+frontend).
  - Mitigation: `MISMATCH` is a legitimate recorded outcome with the diff; the fix loop is overlay/implementation-only (never weakening a `must_not`); if a frozen expectation is itself wrong, record the discrepancy for owner review instead of editing the frozen contract.
- **R7 — Symlink fixtures behave differently across filesystems** (macOS APFS vs CI Linux).
  - Mitigation: fixtures are created at test time on the host filesystem; `realpath`-based checks are POSIX-portable; any platform-specific anomaly is recorded in the report rather than absorbed.

## Decisions I made for you
| Decision | Default chosen | Reversible? |
|---|---|---|
| Validator case scope | Execute **all 19** PS/RP/SE cases + B10 — the frozen spec of record and "turn each spec case into a named test" outrank the handoff goal line's truncated ranges (PS-01..06/RP-01..04) | yes |
| Parser architecture | Prompt-side grammar (per DETERMINISTIC-VERIFICATION §1) + reference implementation as test oracle in the harness; **no** shell-invoked parser script (it would create the very injection surface PS-05..07 forbid) | yes |
| Map-phase detector source | `e2e.md` map phase *references* the `e2e-map.md:31–64` procedure + a V2 correction overlay, instead of duplicating detector text; `e2e-map.md` stays the single detector source until M5 disable | yes |
| B12 (concurrency) | Deferred to **M3** with recorded rationale — registry writes don't exist until DEC-06's consuming milestone; executing it in M2 is impossible without faking or violating the write ban | yes (scheduling note; no frozen artifact edited) |
| B10 (stale enum) | Executed in M2 — read-only, explicitly deferred to M2 by validator-specs §4 | yes |
| Runner agent/prompt + skills edits | Deferred to M3/M4 — AC-001..005 need none; task list marks them "MAY touch", not "must" | yes |
| Evidence location | `docs/e2e-v2/m2/reports/` with M1 bundle basenames; M1's frozen `NOT_RUN` companions untouched | yes |
| MILESTONE-GATES.json updates | ASM statuses updated only after raw evidence exists; it is an amendment artifact, not frozen M1 evidence | yes |
| TDD record location | `docs/e2e-v2/m2/tdd-record.md` (milestone tree, near the harness it evidences) | yes |
| Legacy shorthand in M2 | Minimal DEC-04 application inside the parser (migration hint, zero execution); the `legacy-command-shims/` surface and full deprecation UX stay M5 | yes |

## Success Criteria
| IS row | Proven by | QA evidence |
|---|---|---|
| IS-1 | Steps 3–5 | `node --test docs/e2e-v2/m2/tests/` parser + conformance suites green; `parser-failclosed.report.json` covers PS-01..04, PS-08 with fail-closed outcomes |
| IS-2 | Step 5 (+ resolver step 9) | `e2e.md` contains `REGISTRY_REQUIRED` not-found path and DEC-05 ad-hoc gate text; conformance suite asserts both; legacy "proceed exactly as before" absent |
| IS-3 | Steps 6–8 | `registry-path.reject.json` (RP-01..06), `symlink-escape.reject.json` (SE-01..04), `stale-assessment.report.json` (B10) all executed with concrete outcomes |
| IS-4 | Step 2 | `command-resolution.report.json`: 4 candidates, winner-or-INCONCLUSIVE each, ARGS echo recorded, real-HOME hashes unchanged; `MILESTONE-GATES.json` statuses match evidence |
| IS-5 | Step 10 | F01–F06 actual outputs `MATCH` frozen expected contracts (or honest `MISMATCH` + diff); B05 (5) and B06 (7) assertions executed |
| IS-1 (scope integrity) | Steps 1, 11 | preflight zero drift; `scope-check.report.json` violations = 0, frozen M1 artifacts byte-identical, exactly the authorized deltas recorded |

## Metis gap pass (inline)

| # | Finding | Disposition |
|---|---|---|
| G1 | Handoff goal line says PS-01..06 / RP-01..04; frozen spec has 19 cases and the task directive says "M2 turns each spec case into a named test" | RESOLVED — spec of record authoritative; execute all 19 + B10 (Decisions table) |
| G2 | `validator-specs.md` §5 defers B12 (concurrency) to M2, but registry writes are M3 (DEC-06 consuming milestone); no write path exists in M2 | DEFERRED — B12 → M3, recorded in traceability-m2; no frozen artifact edited; never faked |
| G3 | ASM-02 tagged M2 in `MILESTONE-GATES.json` but absent from the handoff's M2 goal list | RESOLVED — PRD §8 puts AC-002 (verification: F01–F06) in M2; detector validation is in scope via the reference implementation + fixtures (step 10) |
| G4 | If the probe shows a global surface wins, the project-side product edit is ineffective and HOME writes are forbidden | RESOLVED — probe sequenced first; `implemented vs deployment-effective` recorded separately; global sync routes to M5/owner (Risks R2) |
| G5 | `m1.test.mjs` M1-01 will fail after the authorized `e2e.md` edit | RESOLVED — AUTHORIZED_DELTA record in scope check (Risks R4); M1 artifacts untouched |
| G6 | Workflow gate may block non-markdown report writes during drafting | RESOLVED — md-primary + post-approval JSON emission (M1 mitigation carried; Risks R3) |
| G7 | PS cases exercise a reference implementation, not live prompt behavior — risk of overclaiming | RESOLVED — every report stamped `live_prompt_verification: DEFERRED_TO_M6`; static conformance cross-checks prompt vs reference; M6 owns the 48 live scenarios |
| G8 | Playwright absent (verified 2026-11-23); no auto-install permitted | RESOLVED — no browser-dependent proof attempted; recorded in preflight; DEC-09/E2E-NFR-002 upheld |
| G9 | `$ARGUMENTS` substitution semantics unknown until the probe runs | RESOLVED — grammar operates on the raw post-substitution string (shape-agnostic); probe informs; INCONCLUSIVE → opaque-string safe default |
| G10 | `TESTS.md` absent in this repo — resolver/registry paths have no live target | RESOLVED — M2 validates against disposable fixture registries; absent-registry behavior (honest report, F08-shaped proposal, no write) is itself specified and tested |
| G11 | Topology: the config template `{file:commands/e2e.md}\n\n$ARGUMENTS` must keep resolving after the rewrite | RESOLVED — frontmatter style preserved; conformance suite asserts template compatibility |
| G12 | Legacy `/e2e <flow>` must not leave a silent-execution hole before M5's full shim work | RESOLVED — parser routes non-mode leading tokens to a migration hint with zero execution (minimal DEC-04 application) |

Gap pass: 0 BLOCKING · 0 open OWNER_DECISION_REQUIRED for this milestone · 1 DEFERRED (G2 → M3, forced by the DEC-06 write ban) · rest RESOLVED.

## References
- Approved PRD (pinned digest `047918df…`): `.claude/prds/e2e-v2-0-unified-journey-mapping.prd.md` — §4 E2E-FR-001..005, §7 AC-001..005, §8 milestone table
- Decision register + gates: `docs/e2e-v2/decisions/DECISION-REGISTER.md`, `docs/e2e-v2/decisions/MILESTONE-GATES.json`, `docs/e2e-v2/decisions/DECISION-OWNER-APPROVAL-001.md`
- Frozen M1 contracts: `docs/e2e-v2/contracts/command-contract.md`, `validator-specs.md`, `journey-contract-freeze.md`
- M1 handoff + evidence: `docs/e2e-v2/m1/traceability-m1.md`, `m1/command-resolution-evidence.md` (§4 probe spec), `m1/detector-characterization.md`, `m1/reports/*` (frozen NOT_RUN companions), `m1/tests/m1.test.mjs`, `docs/e2e-v2/SOURCE-BASELINE-FROZEN.md`
- Precedent plan: `docs/plans/e2e-v2-0-unified-journey-mapping.plan.md` (r3, digest `ea20d4f2…`)
- R1 bundle (ZIP, read-only): DETERMINISTIC-VERIFICATION.md, FIXTURE-MATRIX.md, REGISTRY-CONTRACT.md, ACCEPTANCE-MATRIX.csv
- Product surfaces (read for style; only `e2e.md` edited): `.opencode/commands/e2e.md` (`08b17f2c…`), `.opencode/commands/e2e-map.md` (`76b3d403…`), `agents/e2e-runner.md`, `.opencode/prompts/agents/e2e-runner.txt`, `skills/{e2e-testing,test-collaboration,click-path-audit}/SKILL.md`
