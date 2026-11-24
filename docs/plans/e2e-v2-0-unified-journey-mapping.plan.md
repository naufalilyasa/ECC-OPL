# Implementation Plan: ECC-OPL /e2e V2.0 — Milestone 1 "Reconciliation & contract freeze"

Status: APPROVED
Revision: r3
Readiness: READY_FOR_EXECUTION
Scope: M1
Upstream digest (approved PRD, SHA-256): `047918df0835bc7ea52f0d0dc7714f0b29394cce32ad8c2580b2973dfce1d211`
Milestone: M1 (of 6) — scope strictly limited to M1
Evidence bundle: `/Users/ctp-itdev2/ecc-opl-e2e-v2.0-prd-r1-external-review.zip` (21 files; SHA256-MANIFEST.json lists 20 and self-excludes)

## Overview

M1 is evidence-and-contract work only. It freezes a hash-verified E2E source baseline, records the command-resolution (effective winner) uncertainty as formal evidence, freezes the command/journey/validator contracts from the approved PRD and R1 bundle, characterizes the existing static detectors with source-line mapping, and produces bundle-integrity and scope evidence. No product file behavior changes; no browser, Playwright, install, registry, or runtime activity.

## Affected User and Ideal State

**Affected user**:
1. **Owner** — invokes `/e2e` and `/e2e-map` today with unverified config precedence and no frozen reference; after M1 they approve M2+ against an immutable baseline.
2. **Downstream implementers (M2–M6 executor sessions, e2e-runner adaptations)** — today must re-derive detector/contract semantics from prompt markdown each session; after M1 they consume frozen contracts and acceptance specs.
3. **plan-reviewer / external reviewer** — verifies M1 output deterministically (hashes, manifest, scope) without executing anything.

| Row | Statement | Reason |
|---|---|---|
| IS-1 | Owner and implementers work from a frozen, hash-verified source baseline (5 E2E components + skills + config surfaces + frozen workflows) and the pinned PRD digest, with zero source-drift ambiguity | M2–M6 correctness depends on an immutable reference; unanchored references rot |
| IS-2 | The effective-winner uncertainty for `/e2e` command resolution is formally recorded (status `NOT_VERIFIED`, evidence of all declared config surfaces, deferred isolated probe defined) instead of silently assumed | PRD §9 lists this as an open risk; pretending it is resolved would poison M2 design |
| IS-3 | M2+ implementers build against frozen contracts: mode list + gate table, parser fail-closed rules, registry-path rules, State enum, journey mapping rules — each with named evidence artifacts | Contracts prevent silent behavior reinterpretation across milestones |
| IS-4 | Existing detector behavior is characterized with exact source lines and known semantic conflicts documented (`Command: /e2e <flow>` vs actual-CLI semantics; `stale` used as State) | AC-019 requires stack fidelity; characterization is the M1 deliverable, porting happens in M2+ |
| GAP-1 | Today the baseline exists only in an external ZIP and session notes; the repo has no frozen baseline artifact | M1 outcome per PRD §8 row 1 |
| GAP-2 | Command precedence is `NOT_VERIFIED`; no evidence record exists in-repo | Same |
| GAP-3 | No frozen contract artifacts (command contract, validator specs, journey contract freeze) exist in-repo | AC-001 scope for M1 |
| GAP-4 | Detector behavior uncharacterized; conflicts unrecorded | AC-019 scope for M1 |
| GAP-5 | No bundle-integrity or scope evidence (`bundle-validator`, `scope-check`) exists | E01/E04 |

## Requirements

### Must have
- Recompute and freeze SHA-256 of: `.opencode/commands/e2e.md`, `.opencode/commands/e2e-map.md`, `agents/e2e-runner.md`, `.opencode/prompts/agents/e2e-runner.txt`, `legacy-command-shims/commands/e2e.md`, `skills/test-collaboration/SKILL.md`, `skills/e2e-testing/SKILL.md`, `skills/click-path-audit/SKILL.md`, `.opencode/opencode.json`, `~/.config/opencode/opencode.json`, `~/.config/opencode/opencode.jsonc` (global files read-only), plus frozen-workflow hashes for D05.
- Command-resolution evidence record: enumerate all declared command maps across the three config surfaces; record `NOT_VERIFIED` precedence status; define the bounded isolated runtime probe deferred to M2 (ASM-01).
- Frozen command contract (AC-001): mode list (`map`, `run`, `full`, `status`, `help`, no-args; `run --ad-hoc` sub-mode noted pending DEC-05), mode gate table, terminal/error outcomes, Registry State enum (`missing`, `in progress`, `unverified`, `covered`, `not applicable`; `stale` = assessment only, schema-mismatch rule per DEC-12 pending).
- Validator specs (A07 + deterministic-verification §2): negative-case tables for parser fail-closed and registry-path rejection; defined-but-NOT_RUN artifact names (`parser-failclosed.report.json`, `registry-path.reject.json`, `symlink-escape.reject.json`).
- Detector characterization (AC-019): per-stack source-line mapping of current detectors in `.opencode/commands/e2e-map.md` (lines 33–42 region) with exclusions and expected-output contract JSONs marked NOT_RUN (B01–B04).
- Journey contract freeze (B05, B06): locale-dedup and multi-route-grouping rules transcribed from JOURNEY-MAPPING-CONTRACT.md as frozen acceptance rules.
- Bundle validator (E01): verify 20/20 manifest-listed hashes match (manifest self-excludes; ZIP holds 21 files); verify all 48 ACCEPTANCE-MATRIX.csv IDs (A01–A08, B01–B12, C01–C12, D01–D10, E01–E06) appear exactly once with non-empty `stimulus`/`expected`/`evidence_artifact` (columns: `id,group,stimulus,expected,actual,status,fixture_ids,evidence_artifact,requirement_ids,prd_ac,method,source_ref`).
- Scope check (E04): bounded inventory of E2E components proving no out-of-scope writes occurred during M1.
- DEC register passthrough: DEC-04/05/06/07/09/10/11/12 recorded as OWNER_DECISION_REQUIRED downstream gates in the M1 evidence, not resolved.

### Must NOT have (scope guardrails)
- No edits to `.opencode/commands/e2e.md`, `.opencode/commands/e2e-map.md`, `agents/e2e-runner.md`, `.opencode/prompts/agents/e2e-runner.txt`, `legacy-command-shims/commands/e2e.md`, any config file, any frozen workflow (`/plan-prd`, `/tdd`, `/code-review-quick V1.1.2`, `/refactor-clean V1.1.4`, `/deep-research`, `/security-audit`, Intent Gate, A07b), or `.claude/prds/e2e-v2-0-unified-journey-mapping.prd.md`.
- No browser execution, Playwright runs, dependency installs (incl. Playwright or agent-browser), registry migrations, `TESTS.md` creation, or `/e2e-map` disablement.
- No resolution of DEC-04/05/06/07/09/10/11/12 into policy; no milestone 2–6 work (no parser implementation, no resolver, no registry writer, no runner changes).
- No writes inside the repo outside `docs/e2e-v2/**` and `docs/plans/**`. Repo-external session-temp scratch (e.g. ZIP extraction for read-only verification) is permitted and must be cleaned up after use; it is excluded from the step-9 written-file inventory.
- No `.git` / `.guardian-angel` access; no active-HOME writes (global config reads are read-only).

## Patterns to Mirror
- Evidence style of `SOURCE-BASELINE.md` (R1 bundle): table of component / canonical path / SHA-256 / global copy / match status.
- R1 bundle artifact naming: `<name>.report.json` / `<name>.reject.json` — M1 JSON companions reuse the exact bundle names so later milestones can diff.
- Plan header metadata style of existing `docs/plans/*.plan.md`.
- Hash-evidence command pattern: `shasum -a 256 <paths>` (verified this session against SOURCE-BASELINE.md — all five component hashes match).

## Architecture Changes
None to product behavior. New documentation/evidence tree only:

```
docs/e2e-v2/
  SOURCE-BASELINE-FROZEN.md          # frozen hashes + drift statement (IS-1)
  contracts/
    command-contract.md              # AC-001 frozen contract (IS-3)
    validator-specs.md               # A07 + parser/registry-path/stale-state specs (IS-3)
    journey-contract-freeze.md       # B05/B06 frozen rules (IS-3)
  m1/
    command-resolution-evidence.md   # IS-2: winner uncertainty record
    detector-characterization.md     # IS-4: AC-019 source-line mapping
    reports/                         # JSON evidence companions (bundle names)
      frozen-hashes.report.json      # D05
      command-resolution.report.json # NOT_VERIFIED record
      mode-parser.report.json        # A01 static contract check
      parser-failclosed.report.json  # A07 spec companion (NOT_RUN)
      registry-path.reject.json      # spec companion (NOT_RUN)
      symlink-escape.reject.json     # spec companion (NOT_RUN)
      F01-F06-map-output-expected.json # B01–B04 expected-output contracts (NOT_RUN)
      locale-dedup.report.json       # B05 rule spec (NOT_RUN)
      journey-grouping.report.json   # B06 rule spec (NOT_RUN)
      bundle-validator.report.json   # E01 (executable read-only check)
      scope-check.report.json        # E04 (executable read-only check)
```

Product files touched in M1: none. Files that M2–M6 may touch after DEC gates (explicitly out of M1): `.opencode/commands/e2e.md` (M2, DEC-04/05), `.opencode/commands/e2e-map.md` (M3/M5, DEC-10/12), `agents/e2e-runner.md` + prompt (M4, DEC-07/09), `legacy-command-shims/commands/e2e.md` (M5, DEC-04), config command maps (M5, DEC-10), `TESTS.md` (M3, DEC-06).

## Implementation Steps

### Phase 1: Baseline freeze (WP0 closure → GAP-1, GAP-2)

1. **Freeze source baseline hashes** (File: `docs/e2e-v2/SOURCE-BASELINE-FROZEN.md`)
   - Action: Recompute SHA-256 for the 8 repo files + 3 config surfaces listed under Must-have; compare against SOURCE-BASELINE.md values; write the frozen table with match status per row, plus the pinned PRD digest and bundle manifest reference. Include the two recorded facts: `TESTS.md` and `.governance/docs-map.json` absent in this repo; global test-collaboration skill absent.
   - Why: IS-1/GAP-1 — immutable reference for all later milestones.
   - Closes: GAP-1
   - References: SOURCE-BASELINE.md (bundle), `.opencode/commands/e2e.md`, `.opencode/commands/e2e-map.md`, `agents/e2e-runner.md`, `.opencode/prompts/agents/e2e-runner.txt`, `legacy-command-shims/commands/e2e.md`, `skills/test-collaboration/SKILL.md`, `skills/e2e-testing/SKILL.md`, `skills/click-path-audit/SKILL.md`
   - Acceptance: every row's recomputed hash equals the SOURCE-BASELINE.md value; any mismatch is recorded as a drift finding and STOPS the milestone (fail closed).
   - QA: happy — `shasum -a 256 .opencode/commands/e2e.md` returns `08b17f2c…95dd`, matches table (evidence: `docs/e2e-v2/SOURCE-BASELINE-FROZEN.md`); failure — any mismatch → drift row + milestone STOP, no downstream phase starts.
   - Dependencies: None
   - Risk: Low

2. **Frozen-workflow hash evidence (D05)** (File: `docs/e2e-v2/m1/reports/frozen-hashes.report.json`)
   - Action: Hash the 7 resolved frozen-workflow surfaces — `.opencode/commands/tdd.md`, `.opencode/commands/code-review-quick.md`, `.opencode/commands/refactor-clean.md`, `.opencode/commands/deep-research.md`, `.opencode/commands/security-audit.md`, `.opencode/commands/plan.md`, `commands/plan-prd.md` (with the `pi/core/commands/plan-prd.md` copy noted as a second copy of the same workflow), and `.opencode/prompts/agents/intent-gate.txt` (Intent Gate surface) — and record them with expected-status `BYTE_IDENTICAL` vs the historical audit references; JSON companion with `generated_at`, tool, and per-file results. A07b is a guard behavior, not a file surface: it has no hash row here.
   - Why: D05 requires frozen workflows byte-identical, no bypass — proves M1 touched none of them. Scope note: E2E-NFR-005/D05 also covers Guardian Angel, the A07b/core guard, and Git policy byte-identical; this plan forbids `.guardian-angel`/`.git` access, so those three are recorded as `NOT_VERIFIED — review-constraint exclusion`. `frozen-hashes.report.json` therefore covers workflow files only and is NOT complete D05 evidence.
   - Closes: supports GAP-1
   - References: ACCEPTANCE-MATRIX.csv row D05; `glob .opencode/commands/*.md`
   - Acceptance: JSON lists every frozen workflow with hash; no hash differs from the historical audit reference (where a historical reference exists); absent historical reference is recorded as `NO_PRIOR_REF` rather than assumed equal.
   - QA: happy — `jq '.files | length' frozen-hashes.report.json` ≥ 7 (the 7 resolved surfaces listed above), all `status` fields populated; failure — any diff → `DRIFT_DETECTED` entry and STOP.
   - Dependencies: Requires step 1 (tooling/paths settled)
   - Risk: Low

3. **Command-resolution evidence (winner uncertainty)** (File: `docs/e2e-v2/m1/command-resolution-evidence.md` + `reports/command-resolution.report.json`)
   - Action: Read-only enumeration of the three config surfaces (project `.opencode/opencode.json`; global `~/.config/opencode/opencode.json`; global `~/.config/opencode/opencode.jsonc`); record each file's declared `command` map entries for `e2e`/`e2e-map` verbatim; record `opencode.jsonc` has plugin declarations and NO e2e map; set precedence status `NOT_VERIFIED` with rationale (OpenCode v2.3.2 precedence between dual global files + project override is undocumented/unknown); define the M2 isolated runtime probe (temporary sandbox HOME + project dir, invoke `/e2e help`, observe which definition wins) as the deferred resolution path per ASM-01. No config or runtime writes.
   - Why: IS-2/GAP-2 — PRD §8 M1 outcome is literally "winner uncertainty recorded".
   - Closes: GAP-2
   - References: SOURCE-BASELINE.md "Precedence… NOT_VERIFIED"; PRD §9 ASM-01; `.opencode/opencode.json`
   - Acceptance: report lists all three surfaces with verbatim map excerpts; status field = `NOT_VERIFIED`; probe spec is concrete (steps, sandbox location under the session temp dir, cleanup) but marked `DEFERRED_TO_M2`.
   - QA: happy — `grep -c 'NOT_VERIFIED' command-resolution.report.json` = 1 and all three surfaces present; failure — if a surface is unreadable, record `INACCESSIBLE` with reason, never guess contents.
   - Dependencies: Requires step 1
   - Risk: Low

### Phase 2: Contract freeze (AC-001 → GAP-3)

4. **Freeze command contract** (File: `docs/e2e-v2/contracts/command-contract.md` + `reports/mode-parser.report.json`)
   - Action: Transcribe from MODE-AND-STATE-MACHINE.md and REGISTRY-CONTRACT.md into a frozen contract: mode list, per-mode Reads/Writes/Browser/Gate table, terminal + error outcome table, Registry State enum, `stale` = assessment-only rule, `Command` = actual Playwright CLI vs `Invocation` separation. Mark every DEC-dependent item (`--ad-hoc` per DEC-05, registry write per DEC-06, environment gate per DEC-07, disable-default per DEC-10) as `PENDING_DEC` inline — contract text frozen, policy not resolved. Companion JSON: static check that all 6 modes appear, no dangerous default mode, gate table complete.
   - Why: IS-3/GAP-3 — AC-001 M1 deliverable ("static command contract test" per A01).
   - Closes: GAP-3
   - References: MODE-AND-STATE-MACHINE.md; REGISTRY-CONTRACT.md; DECISIONS.md; `.opencode/commands/e2e.md` (read-only, current behavior for comparison)
   - Acceptance: contract lists exactly the 6 modes + `run --ad-hoc` sub-mode; every mode row has Gate and Browser columns; every PENDING_DEC item cites its DEC ID; A01 companion passes (modes complete, no default-run).
   - QA: happy — `grep -E '^\| (map|run|full|status|help|no-args)' contracts/command-contract.md` yields 6 rows; failure — missing mode row → A01 companion reports `MODE_LIST_INCOMPLETE`.
   - Dependencies: None (parallel with Phase 1)
   - Risk: Low

5. **Validator specs: parser fail-closed, registry path, stale/state enum** (File: `docs/e2e-v2/contracts/validator-specs.md` + `reports/parser-failclosed.report.json`, `registry-path.reject.json`, `symlink-escape.reject.json`)
   - Action: Write negative-case spec tables (input class → required outcome → evidence artifact): unknown mode, conflicting modes, duplicate flags, injection tokens (`; rm`, `$(...)`, backticks, newline smuggling) → fail closed + usage message; registry path: absolute path, `..`, symlink escape, workspace escape, dual-location conflict → reject/STOP. State the stale/State-enum schema-mismatch rule (legacy `State: stale` row → propose correction, no silent migration — DEC-12 pending, recorded as gate). Each case gets an ID (PS-01…, RP-01…, SE-01…) so M2 tests can trace to it. Artifacts marked `NOT_RUN` — M1 defines them; M2+ executes.
   - Why: IS-3/GAP-3 — A07 "parser negative test" needs a frozen negative matrix before any parser exists.
   - Closes: GAP-3
   - References: DETERMINISTIC-VERIFICATION.md §1–§2; REGISTRY-CONTRACT.md "Stale assessment"; ACCEPTANCE-MATRIX.csv A07
   - Acceptance: every DETERMINISTIC-VERIFICATION §1 rule has ≥1 spec case; every §2 rejection class has ≥1 case; each case has ID, input, expected outcome, artifact name; zero cases say "verify it works" without a concrete expected outcome.
   - QA: happy — `grep -cE '^\| (PS|RP|SE)-[0-9]+' validator-specs.md` ≥ 12; failure — a rule from §1/§2 with no case → spec incomplete, phase not done.
   - Dependencies: None (parallel)
   - Risk: Low

### Phase 3: Detector characterization (AC-019 → GAP-4)

6. **Characterize existing static detectors** (File: `docs/e2e-v2/m1/detector-characterization.md` + `reports/F01-F06-map-output-expected.json`)
   - Action: For each stack row in `.opencode/commands/e2e-map.md` (lines ~33–42: Next App Router, Next Pages, Astro, SvelteKit, Nuxt, Vue/React Router, Laravel, Yii2, Express/Fastify/Hono), record: exact glob/rule text, source line number, exclusion rules (e.g. `route.ts` API vs UI page), and observed gaps vs the V2 contract (e.g. dynamic/conditional routes → `PARTIAL` not yet encoded). Document the two known conflicts: template writes `Command: /e2e <flow name>` (line ~89) vs `/e2e` documenting `Command:` as executed Playwright CLI; `stale` used as a list/State label (lines ~62, ~101) vs V2 assessment-only rule. Produce expected-output contract JSON per fixture F01–F06 describing what a conforming detector MUST output (routes, exclusions, journey grouping hints), status `NOT_RUN` — fixture execution is M2+ (ASM-02 validation).
   - Why: IS-4/GAP-4 — AC-019 M1 deliverable; characterization freezes what M2+ must preserve or consciously change.
   - Closes: GAP-4
   - References: `.opencode/commands/e2e-map.md`; FIXTURE-MATRIX.md; JOURNEY-MAPPING-CONTRACT.md; PRD E2E-FR-019
   - Acceptance: every detector row has glob + source line + exclusions; both conflicts documented with line numbers; F01–F06 expected-output entries exist with status `NOT_RUN`.
   - QA: happy — `grep -c 'source line' detector-characterization.md` ≥ 9 (one per stack row); failure — a stack with no rule text or line → characterization incomplete.
   - Dependencies: Requires step 1 (hashes confirm the file version being characterized)
   - Risk: Low

7. **Journey contract freeze (dedup + grouping)** (File: `docs/e2e-v2/contracts/journey-contract-freeze.md` + `reports/locale-dedup.report.json`, `journey-grouping.report.json`)
   - Action: Freeze the journey field table, state-transition rules, identity/dedup rules (locale mirrors → one parameterized flow; multi-route → one journey; role-dependent authorization not merged without actor label; dynamic routes → `PARTIAL`), and registry-mapping rules (ID = max+1, no reuse) verbatim from JOURNEY-MAPPING-CONTRACT.md and REGISTRY-CONTRACT.md. JSON companions: rule-check specs with the concrete assertions B05/B06 will run in later milestones, status `NOT_RUN`.
   - Why: B05/B06 are M1-relevant contract rows; freezing rules now prevents M3 drift.
   - Closes: supports GAP-3, GAP-4
   - References: JOURNEY-MAPPING-CONTRACT.md; REGISTRY-CONTRACT.md "ID ownership"
   - Acceptance: all 14 journey fields present with Wajib flags (including `test_registry_ids[]`); 4 transition rules; 4 dedup rules; ID-ownership rule stated.
   - QA: happy — field-table rows ≥ 14 (verify `test_registry_ids[]` present); failure — missing field/transition → contract freeze incomplete.
   - Dependencies: None (parallel)
   - Risk: Low

### Phase 4: Bundle integrity & scope (E01, E04 → GAP-5)

8. **Bundle validator** (File: `docs/e2e-v2/m1/reports/bundle-validator.report.json`)
   - Action: Read-only verification: extract ZIP to repo-external session temp (permitted scratch per the write-scope rule; clean up after; excluded from the step-9 inventory), `shasum -a 256` the 20 manifest-listed files against `SHA256-MANIFEST.json` (manifest self-excludes; ZIP holds 21 files); verify PRD-CANDIDATE.md digest equals `047918df…d211`; verify all 48 ACCEPTANCE-MATRIX.csv IDs appear exactly once with non-empty `stimulus`/`expected`/`evidence_artifact`; record per-file results in JSON.
   - Why: E01 — IDs present once, evidence path present; also re-proves the pinned digest chain.
   - Closes: GAP-5
   - References: SHA256-MANIFEST.json; ACCEPTANCE-MATRIX.csv; provenance.json
   - Acceptance: 20/20 manifest-listed hashes match; manifest present and self-excluded; digest match confirmed; all 48 IDs each appear exactly once.
   - QA: happy — `jq '.digest_match' bundle-validator.report.json` = true and `jq '.id_counts | all(. == 1)'` = true; failure — any hash mismatch → `MANIFEST_MISMATCH` and STOP (bundle not trustworthy as upstream reference).
   - Dependencies: None (parallel)
   - Risk: Low

9. **Scope check** (File: `docs/e2e-v2/m1/reports/scope-check.report.json`)
   - Action: Bounded inventory: list every file written during M1 inside the repo (must be only `docs/e2e-v2/**` + this plan file; repo-external session-temp scratch is excluded from this inventory); confirm the Must-NOT-have list is clean via targeted existence/mtime reads of the protected paths (no `.git`/`.guardian-angel` access — use filesystem metadata only); record DEC pending statuses verbatim from DECISIONS.md as `OWNER_DECISION_REQUIRED` gates for M2+.
   - Why: E04 — inventory check bounded to E2E components; also the audit trail proving M1 touched nothing else.
   - Closes: GAP-5
   - References: DECISIONS.md; this plan's Must-NOT-have section
   - Acceptance: written-file list ⊆ allowed set; every protected path recorded `UNTOUCHED`; 8 DEC IDs recorded with status PENDING.
   - QA: happy — `jq '.violations | length' scope-check.report.json` = 0 and `jq '.dec_pending | length'` = 8; failure — any violation → immediate revert of the offending write and re-check.
   - Dependencies: Requires steps 1–8 (final gate)
   - Risk: Low

### Phase 5: Traceability & handoff

10. **M1 traceability addendum + review handoff** (File: `docs/e2e-v2/m1/traceability-m1.md`)
    - Action: Map each M1 artifact → scenario ID(s) → AC → requirement: A01→step 4, A07→step 5, B01–B04→step 6, B05/B06→step 7, D05→step 2, E01→step 8, E04→step 9; record ASM-01/ASM-02 as `VALIDATION_REQUIRED` (deferred probes); record DEC-04/05/06/07/09/10/11/12 as `OWNER_DECISION_REQUIRED` downstream gates with their M2–M5 milestone mapping from PRD §8. Then hand the plan + artifacts to plan-reviewer per the verification gate.
    - Why: Closes the M1 loop; gives M2 a single entry document.
    - Closes: supports GAP-1…GAP-5 (index)
    - References: REQUIREMENTS-TRACEABILITY.csv; COVERAGE-SUMMARY.md; PRD §8
    - Acceptance: every M1 artifact appears ≥1 row; no M2–M6 artifact claimed as done; every pending DEC listed with owning milestone.
    - QA: happy — `grep -c '→' traceability-m1.md` ≥ 11 rows; failure — an artifact with no scenario row → traceability incomplete.
    - Dependencies: Requires steps 1–9
    - Risk: Low

## Testing Strategy
- M1 has no product code, so no unit/integration/E2E test runs. Verification is deterministic and read-only:
  - Hash comparison (steps 1, 2, 8): `shasum -a 256` vs frozen references — the only executable checks, and they write nothing outside `docs/e2e-v2/`.
  - Static contract completeness checks (steps 4, 5, 7): grep/jq counts against the acceptance criteria stated per step.
  - NOT_RUN discipline: every JSON companion whose execution belongs to M2+ carries `"status": "NOT_RUN"` and a `deferred_to` field — a later reviewer can mechanically verify M1 did not fake execution evidence.
- When M2+ executes the validator specs, each PS/RP/SE case ID from step 5 becomes a named test case (the spec file is the test plan of record).

## Risks & Mitigations
- **Risk**: Workflow gate (`.opencode/workflows/active.json`; phase is dynamic across drafting→review→approval while `gates.approved=false`) denies non-markdown writes — the JSON report companions are non-markdown.
  - Mitigation: JSON emission is execution-phase work, performed only after owner approval flips the gate. Fallback if the gate is still active during an early execution session: emit evidence as markdown tables in the same files and defer JSON companions to the first authorized write phase; contract content is identical.
- **Risk**: Global config paths (`~/.config/opencode/*`) — reads could be construed as active-HOME writes.
  - Mitigation: Steps 1 and 3 are read-only on HOME; the plan forbids any HOME write; scope check (step 9) asserts it.
- **Risk**: A frozen-workflow historical reference is unavailable for some file (e.g. Intent Gate, A07b live outside `.opencode/commands/`).
  - Mitigation: Record `NO_PRIOR_REF` honestly instead of fabricating a match; D05 evidence remains valid as a current-state snapshot.
- **Risk**: Detector characterization drifts if `.opencode/commands/e2e-map.md` changes mid-milestone.
  - Mitigation: Step 6 depends on step 1's hash freeze; any change re-triggers step 1 (fail closed).
- **Risk**: Reviewer mistakes NOT_RUN artifacts for missing work.
  - Mitigation: Traceability addendum (step 10) states explicitly which artifacts are execution-deferred and to which milestone.

## Decisions I made for you
| Decision | Default chosen | Reversible? |
|---|---|---|
| Artifact home | `docs/e2e-v2/` tree (new; no existing evidence dir in repo) | yes |
| Evidence format | markdown-primary + JSON companions reusing exact R1 bundle artifact names | yes |
| Winner status | recorded as `NOT_VERIFIED` + deferred M2 probe (this IS the M1 outcome per PRD §8 row 1; no runtime probing in M1) | yes |
| M1 scripts | none — deterministic checks are documented `shasum`/`jq`/`grep` commands; validator scripts deferred to M2 with the parser | yes |
| Frozen-workflow path resolution | glob `.opencode/commands/` + repo search for Intent Gate / A07b surfaces at execution time, recorded per-file | yes |

## Success Criteria
| IS row | Proven by | QA evidence |
|---|---|---|
| IS-1 | Step 1 | `docs/e2e-v2/SOURCE-BASELINE-FROZEN.md` all rows match; `shasum -a 256 .opencode/commands/e2e.md` = `08b17f2c…95dd` |
| IS-2 | Step 3 | `command-resolution.report.json` status `NOT_VERIFIED`, 3 surfaces enumerated, probe spec present |
| IS-3 | Steps 4, 5, 7 | contract files complete per acceptance; mode rows = 6; spec case IDs ≥ 12 |
| IS-4 | Step 6 | `detector-characterization.md`: ≥9 stack rows with source lines; 2 conflicts documented |
| IS-1 (bundle chain) | Step 8 | `bundle-validator.report.json`: 20/20 manifest-listed hashes, manifest self-excluded, digest match true |
| Scope integrity | Steps 2, 9 | `frozen-hashes.report.json` no drift; `scope-check.report.json` violations = 0, dec_pending = 8 |

## Metis gap pass (inline)

| # | Finding | Disposition |
|---|---|---|
| G1 | Apparent contradiction: REGISTRY-CONTRACT bootstrap allows map to generate proposals, but M1 forbids registry/TESTS.md activity | RESOLVED — M1 freezes the bootstrap rule as contract text only; generates no proposals, creates no files |
| G2 | Ambiguity: "winner resolution evidence without writing config/runtime" — how can precedence be resolved read-only? | RESOLVED — PRD §8 M1 outcome is to *record* the uncertainty; evidence = enumerated config surfaces + `NOT_VERIFIED` + deferred probe spec (ASM-01) |
| G3 | Execution risk: JSON report artifacts vs workflow-gate non-markdown denial during drafting | RESOLVED — JSON emission deferred to post-approval execution phase; markdown fallback documented in Risks |
| G4 | Missing constraint: where M1 artifacts live | RESOLVED — defaulted to `docs/e2e-v2/` (Decisions table) |
| G5 | Brownfield: global test-collaboration skill absent; `TESTS.md`/docs-map absent | RESOLVED — recorded as baseline facts in step 1; no action permitted in M1 (no installs) |
| G6 | Unvalidated assumptions ASM-01 ($ARGUMENTS semantics), ASM-02 (detector portability) | VALIDATION_REQUIRED — deferred isolated probes, owned by M2 |
| G7 | DEC-04/05/06/07/09/10/11/12 unresolved | OWNER_DECISION_REQUIRED — recorded as downstream gates in steps 9–10; NOT resolved by this plan |
| G8 | Playwright version TBD | DEFERRED — no Playwright activity in M1; version capture moves to M4 preflight |
| G9 | Historical reference may be missing for some frozen-workflow files | RESOLVED — `NO_PRIOR_REF` honest-recording rule (Risks) |

Gap pass: 0 BLOCKING · 0 open OWNER_DECISION_REQUIRED *for this milestone* (G7 items are downstream gates by design) · 2 VALIDATION_REQUIRED deferred to M2 · rest resolved.

## References
- PRD (pinned): ZIP → `PRD-CANDIDATE.md`, digest `047918df0835bc7ea52f0d0dc7714f0b29394cce32ad8c2580b2973dfce1d211`
- R1 bundle: SOURCE-BASELINE.md, DECISIONS.md, DETERMINISTIC-VERIFICATION.md, REGISTRY-CONTRACT.md, JOURNEY-MAPPING-CONTRACT.md, MODE-AND-STATE-MACHINE.md, FIXTURE-MATRIX.md, ACCEPTANCE-MATRIX.csv, REQUIREMENTS-TRACEABILITY.csv, SECURITY-AND-SAFETY.md, MIGRATION-ROLLBACK.md, NEGATIVE-MUTATION-PLAN.md, AGENT-INTERFACE.md, ADR-RECONCILIATION.md, CHANGELOG-R1.md
- Read-only codebase: `.opencode/commands/e2e.md` (08b17f2c…), `.opencode/commands/e2e-map.md` (76b3d403…), `agents/e2e-runner.md` (94811f4b…), `.opencode/prompts/agents/e2e-runner.txt` (d7442445…), `legacy-command-shims/commands/e2e.md` (97ef29c9…), `skills/{test-collaboration,e2e-testing,click-path-audit}/SKILL.md`, `.opencode/opencode.json`, `~/.config/opencode/opencode.json{,c}`
- Workflow gate: `.opencode/workflows/active.json` (workflow=plan; phase dynamic — drafting→review→approval; `gates.approved=false` at time of writing)
