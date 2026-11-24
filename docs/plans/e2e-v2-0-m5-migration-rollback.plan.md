# Implementation Plan: ECC-OPL /e2e V2.0 M5 — Migration & Rollback: Parity, Disable-Default, Restore

**Status:** APPROVED  
**Revision:** r3  
**Readiness:** READY_FOR_EXECUTION  
**Milestone:** M5 — AC-015 through AC-018  
**Mode:** standard, approved-PRD-driven; frozen architecture  
**Upstream approved PRD digest:** `047918df0835bc7ea52f0d0dc7714f0b29394cce32ad8c2580b2973dfce1d211` (R1 `PRD-CANDIDATE.md`)  
**Execution authorization:** DRAFT — pending independent `plan-reviewer` review and explicit owner approval; no implementation permitted during planning.

## Summary

Design and specify the zero-dependency **reference migration, parity, and rollback harness** for Milestone M5. This plan covers PRD requirements `E2E-FR-014` through `E2E-FR-018`, acceptance criteria `AC-015` through `AC-018`, scenarios C12, B11, B12, D04, D06, D07, D08, D10, C09, D05, E02, E05, E06, and negative mutations 13 and 14.

M5 proves four critical invariants entirely at the reference layer without writing real repository registry files, modifying active OpenCode configurations, touching active HOME, executing browsers or Playwright, or making git modifications:
1. **Registry Field-Scoped Update (AC-015 / C12 / F07):** Updates touch only the matched Section 4 block and only the five permitted write fields (`State`, `Test file`, `Test node`, `Command`, `Evidence`); unpermitted fields and unmatched blocks fail closed; zero real registry writes.
2. **Write Conflict & Rebase (AC-016 / B11 / B12 / D04 / Mutation 13):** Hash-before-write concurrency control detects concurrent edits, yielding `WRITE_CONFLICT` and computing a non-clobber rebase proposal; path traversal (`../../`) and symlink escapes are rejected fail closed.
3. **Compatibility, Parity & Gated Disable-Default (AC-017 / D06 / D07 / D08 / Mutation 14 / DEC-04 / DEC-10):** Differential parity between `/e2e map` and legacy `/e2e-map` across benchmark stacks F01–F06 and collision fixture F13; legacy `/e2e <flow>` emits a migration deprecation hint and never silently runs; disable-default remains a gated proposal only.
4. **Terminal Outcome Enum & Rollback Rehearsal (AC-018 / Gate P4 / D10 / F14 / C09 / D05 / E06):** Strict canonical terminal outcome enum enforcement (`PASS`, `FAIL`, `BLOCKED`, `UNVERIFIED`, `CANCELLED`, `PARTIAL`); one-command byte-exact rollback rehearsal conducted inside an isolated 0700 scratch directory with all five configuration and command hashes verified before and after.

Because Gate P1 (effective command winner) remains `NOT_VERIFIED` (ASM-01 inconclusive in M2) and Gate P5 (owner deployment authorization) is `NOT GIVEN`, this plan does NOT claim live disable-default readiness. It produces the parity/rollback reference evidence and emits an explicit `m5-decision-packet.json` identifying the exact remaining gates for the owner.

## Affected User and Ideal State

**Affected users:**
- **Developer / Test Author:** Runs `/e2e` commands expecting backward-compatible behavior, clear deprecation hints instead of silent surprise runs, and deterministic outcomes.
- **Test Orchestrator / Subagent:** Consumes migration interfaces, updates registry proposals without corrupting unexecuted blocks or non-permitted fields, and handles concurrency conflicts safely.
- **Repository Owner:** Requires proof of differential parity between new and legacy commands, verified byte-exact rollback capability before any configuration change, and strict adherence to deployment governance.

| Row | Statement | Reason |
|---|---|---|
| IS-1 | A verified runner outcome updates only the matched Section 4 block in the registry and only the five permitted write fields (`State`, `Test file`, `Test node`, `Command`, `Evidence`); all other fields, blocks, and formatting are untouched, and unauthorized field writes are rejected. | The owner can trust that registered journey metadata and unexecuted blocks are never corrupted or silently modified by automated run reports. (AC-015) |
| GAP-1 | M3 provided `applyVerifiedPass` as an in-memory reference with five fields, but M5 requires end-to-end integration proving field-scoped updates against full F07/F14 migration fixtures, rejecting non-permitted fields, and verifying before/after file SHA hashes with zero real writes. | Current M3 reference does not provide the complete migration fixture suite or verify negative field mutations against persisted scratch fixtures. |
| IS-2 | Concurrent edits to the registry are detected via hash-before-write checking, producing `WRITE_CONFLICT` and requiring a clean rebase without clobbering; path traversal (`../../`) and symlink escapes are rejected fail closed. | Prevents silent overwriting (last-writer-wins) and filesystem escape when multiple agents or engineers modify tests concurrently. (AC-016) |
| GAP-2 | M3 implemented a standalone `checkWriteConflict` function, but lacked automated multi-writer race simulation, rebase proposal verification, path/symlink containment checks, and negative mutation 13 validation against scratch fixtures. | Concurrency and path safety have not been verified under realistic multi-step migration flows. |
| IS-3 | Legacy `/e2e <flow>` emits a clear deprecation hint (DEC-04) and never silently executes an unregistered flow; `/e2e map` and `/e2e-map` achieve byte/journey parity over F01–F06 + F13; and disable-default remains a gated proposal until all gates (P1–P5) pass. | Backward compatibility without surprise execution or coverage fabrication; transparent migration path for users from legacy commands. (AC-017) |
| GAP-3 | Legacy `/e2e-map` is still present across canonical and global config; parity has not been validated across all benchmark stacks (F01–F06) and collision fixtures (F13); and disable-default lacks an evidence-gated proposal packet. | Migration parity and discovery behavior have not been proven on disk. |
| IS-4 | Every terminal outcome is strictly explicit (`PASS`, `FAIL`, `BLOCKED`, `UNVERIFIED`, `CANCELLED`, `PARTIAL`), with flakiness reported separately, frozen artifacts byte-identical, and no false narrative pass permitted. | Ensures predictable, machine-checkable status codes for downstream tooling, CI pipelines, and audit trails. (AC-018) |
| GAP-4 | M4 runner evaluator defined outcomes for individual test envelopes, but cross-cutting migration, discovery, and rollback outcomes lack end-to-end normalization to the canonical terminal enum. | Terminal outcome mappings are split between M3 and M4 rather than unified under the full migration lifecycle. |
| IS-5 | Rollback of command and configuration changes is practiced and proven in a disposable 0700 scratch environment: backup hashes, rehearsal disable, exact byte restoration, and re-verification of all five file hashes (`ROLLBACK_VERIFIED`), with zero active-tree mutations. | The owner can deploy changes knowing that an exact, verified 1-step rollback exists and has been tested to restore exact pre-change state without registry loss. (Gate P4) |
| GAP-5 | Rollback was proposed in policy (`M5-PARITY-ROLLBACK-PROPOSAL.md`), but no executable rehearsal harness exists to verify byte-exact restoration across the 3 config files and 2 command definitions. | Rollback readiness cannot be claimed without a verified execution record. |
| IS-6 | The migration plan and report honestly reflect that effective command resolution (P1 / ASM-01) is `NOT_VERIFIED` and owner deployment authorization (P5) is `NOT GIVEN`, blocking live disable-default and delivering a complete decision packet for the owner. | Guarantees that automated processes never assume or bypass owner authorization for breaking configuration changes. (DEC-10) |
| GAP-6 | Previous proposals described gates P1–P5, but M5 must formally encode this boundary into machine-readable reports, ensuring that live disable-default is refused until P1 and P5 are satisfied. | Automated gating could risk premature disable-default if not strictly enforced in the harness. |

## Scope

### Must
- Implement **only a reference/harness-level model** under `docs/e2e-v2/m5/**`, using zero-dependency Node.js (`node:test`, `node:assert/strict`, `node:crypto`, `node:fs`, `node:path`) and isolated temporary scratch fixtures under `/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode`.
- Implement and test `AC-015` through `AC-018`, `E2E-FR-014` through `E2E-FR-018`, scenarios C12, B11, B12, D04, D06, D07, D08, D10, C09, D05, E02, E05, E06, and negative mutations 13 and 14.
- Provide field-scoped registry update validation: only matched Section 4 block, only 5 permitted fields (`State`, `Test file`, `Test node`, `Command`, `Evidence`), reject non-permitted fields (`FIELD-NOT-PERMITTED`), 0 real registry writes.
- Provide concurrency conflict detection: hash-before-write, `WRITE_CONFLICT` on change, non-clobber rebase proposal, and path/symlink containment checks.
- Provide parity evaluation: differential comparison between `/e2e map` and `/e2e-map` on benchmark stacks F01–F06 and collision fixture F13 (same route counts, deduplicated flows, exclusions, and PARTIAL flags).
- Provide legacy shorthand resolution: legacy `/e2e <flow>` yields `LEGACY_SHORTHAND_DEPRECATED` hint pointing to `/e2e run <flow>` or `/e2e map`, with zero runner invocations and zero coverage credit (DEC-04).
- Execute Gate P4 Rollback Rehearsal: copy the 3 configuration files and 2 command definitions into a disposable 0700 scratch directory, rehearse disablement only against a fixture copy, restore exact bytes, re-verify all 5 SHA-256 hashes, and output `ROLLBACK_VERIFIED`.
- Enforce canonical terminal outcome enum (`PASS`, `FAIL`, `BLOCKED`, `UNVERIFIED`, `CANCELLED`, `PARTIAL`).
- Maintain P1/P5 honesty: explicitly report P1 as `NOT_VERIFIED` and P5 as `NOT_GIVEN`; do NOT claim disable-default readiness; emit `m5-decision-packet.json` detailing remaining gates.
- Maintain frozen baselines: verify that M1, M2, M3, M4, and contract trees remain byte-identical; verify that `TESTS.md` and `.governance/docs-map.json` remain absent.
- Enforce code coverage ≥80% for lines, branches, and functions on each new non-test module (`migration.mjs` and `emit-m5-reports.mjs`).

### Must NOT
- No browser, Playwright, ad-hoc sandbox, live application request, network access, or package/CLI installation.
- No real registry writes: `TESTS.md` and `.governance/docs-map.json` must not be created or mutated in the active repository.
- No active configuration edits: `.opencode/opencode.json` (project configuration in repository root; `ECC` denotes repository context, not a path prefix), `~/.config/opencode/opencode.json`, and `~/.config/opencode/opencode.jsonc` must remain untouched.
- No active command edits or removals: `.opencode/commands/e2e.md` and `.opencode/commands/e2e-map.md` must remain untouched.
- No writes outside `docs/e2e-v2/m5/**` (and disposable temporary scratch directories).
- No git operations, no commit, no branch, no stash, no access to `.git` or `.guardian-angel`.
- No live `/e2e-map` disablement or active discovery changes.
- Never label simulated or reference results as live passes; all live and environment criteria remain `DEFERRED_TO_M6`.

## Pinned Sources and Patterns to Mirror

`SCRATCH` refers to `/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode`; `BUNDLE` refers to `$SCRATCH/e2e-v2-prd-r1/bundle/ecc-opl-e2e-v2.0-prd-r1-external-review`.

| Source | Pinned Digest / Path | Role & Invariants |
|---|---|---|
| `BUNDLE/PRD-CANDIDATE.md` | `047918df0835bc7ea52f0d0dc7714f0b29394cce32ad8c2580b2973dfce1d211` | Canonical approved PRD specification (§4, §7.4, §8, §9.2, §11). |
| `.claude/prds/e2e-v2-0-unified-journey-mapping.prd.md` | `bbe563be553147e4ff348622e54a75689db209bd798e85f85a97d739895191a9` | Worktree annotated PRD copy (deliberately distinct from R1 candidate). |
| `BUNDLE/SHA256-MANIFEST.json` | `6cf52ecd57a537578d0caf444b2bf0e914aae96c93e77a9c89e33c4d48083747` | Canonical bundle manifest. |
| `BUNDLE/ACCEPTANCE-MATRIX.csv` | `400d3fcc22c48fb75f85ee22aeb0de23d0d0bbcf9dd776ae33aeb2ec88789caf` | Scenarios C12, B11, B12, D04, D06, D07, D08, D10, C09, D05, E02, E05, E06. |
| `docs/e2e-v2/decisions/DECISION-REGISTER.md` | `cd848701e25fddf6ab33c5853a2bd93a791e0786b225dc8534be912c4c03d223` | Canonical decisions: DEC-04, DEC-06, DEC-07, DEC-08, DEC-10, DEC-12 (note: DEC-12 legacy stale assessment reconciliation was already implemented in M3 `registry.mjs`; no new action in M5). |
| `docs/e2e-v2/decisions/MILESTONE-GATES.json` | `00c6b4550a130fcec4e20abda25919b9a08fe4b493b9439687865d70d017c8e5` | Policy-only authorization; gate states; technical gates remain NOT_VERIFIED. |
| `$SCRATCH/m3m5m6-proposals/M5-PARITY-ROLLBACK-PROPOSAL.md` | `bc69bbc9d51a3eaaacf6406421ab97ab49fef9dc27e260a90db5bf08a5243a3c` | Approved proposal defining Gates P1–P5 and exact rollback protocol. |
| `.opencode/commands/e2e.md` | `c562e0a2a2707c49362431b04ac1895f02c091e3d7ae193837ab6bf35b9d8436` | Pinned active command definition (preimage). Read-only; do not edit. |
| `.opencode/commands/e2e-map.md` | `76b3d4037a0144df2d40dc0eca01777690762a7cccc5d9562b0330333dfdb142` | Pinned legacy command definition. Read-only; do not edit. |
| `.opencode/opencode.json` | `01e3d4405c4351cde1460e782da9aa80f0aa6a6796bc3bb149be1b12bcc63e84` | Project configuration file (repo-relative; repository context ECC) for rollback rehearsal target 1. |
| `~/.config/opencode/opencode.json` | `bd747d4f42d22e7c0dc1f14b65e815b043117083fd548292489509c653e26843` | Global configuration file for rollback rehearsal target 2. |
| `~/.config/opencode/opencode.jsonc` | `85378ac09a398760fccae61499ab3bd5207713d3ba214b71c92e5acf52071dbf` | Global configuration file for rollback rehearsal target 3. |
| `docs/e2e-v2/m1/**` | 16 files, tree hash `8416c0671af8ae60850d9d72f249968976c907cf4aa62b605d663bd5eb1625ca` | Frozen milestone 1 baseline. Must remain byte-identical. |
| `docs/e2e-v2/m2/**` | 27 files, tree hash `2f81da73f2068357f4265a3cfbaf6a9435a3e502d52dcd32d33b3b445fc97588` | Frozen milestone 2 baseline. Must remain byte-identical. |
| `docs/e2e-v2/m3/**` | 17 files, tree hash `2e8c7cf63a44b3d073185be0a4fe59de87fd9583ffc79abc6066b151066e23c7` | Frozen milestone 3 baseline. Reuse patterns from `registry.mjs`. |
| `docs/e2e-v2/m4/**` | 20 files, tree hash `88c50d13760dd24dd47b9e5f2a2d8aa707b0f008abcf19b06fa7370641bc7807` | Frozen milestone 4 baseline. Reuse patterns from `runner.mjs`. |
| `docs/e2e-v2/contracts/**` | 3 files, tree hash `a550f29ea751c7635cdc5d73bbc2e6a0a29d7cdf7153e43f23e429a4f4e05e8c` | Frozen contracts. Must remain byte-identical. |
| `agents/e2e-runner.md` | `94811f4bbc491c351cdf220ab103d6bd251fb1d88d9d46ba4c8162637a236a5b` | Read-only agent prompt. |
| `.opencode/prompts/agents/e2e-runner.txt` | `d7442445cbb276cb88d6cca5339b50ec3247683ed78ea512ccf4627ed666ad08` | Read-only agent prompt text. |

## Architecture Changes

All new deliverables are confined strictly to `docs/e2e-v2/m5/**`:

- **New reference module:** `docs/e2e-v2/m5/tests/migration.mjs`
  - Pure migration, concurrency, parity, legacy resolver, rollback rehearsal, and terminal outcome evaluator.
  - No child processes, no network, no registry writes, no active config modifications.
- **New fixtures & tests:** `docs/e2e-v2/m5/tests/fixtures.mjs`, `docs/e2e-v2/m5/tests/m5.test.mjs`, `docs/e2e-v2/m5/tests/conformance.test.mjs`
  - Tests covering AC-015..AC-018, scenarios C12, B11, B12, D04, D06, D07, D08, D10, C09, D05, E02, E05, E06, and mutations 13 and 14.
- **New deterministic report generator:** `docs/e2e-v2/m5/scripts/emit-m5-reports.mjs`
  - Emits all 13 scenario and gate reports to `docs/e2e-v2/m5/reports/*.json` under CLI execution; pure function import does not write.
- **New reports:** `docs/e2e-v2/m5/reports/` (16 total: 13 scenario/gate reports via `emit-m5-reports.mjs`, 1 static conformance report via Step 6 `conformance.test.mjs`, and 2 verification reports via Step 7):
  *Emitted by `emit-m5-reports.mjs` (13 scenario and gate reports):*
  1. `m5-preflight.report.json`: Preflight input pins, frozen tree hashes, absence checks.
  2. `registry-block.diff.json`: Scenario C12 / F07 / E05 field-scoped update diff & hash record.
  3. `concurrency.report.json`: Scenario B12 / F11 hash-before-write conflict & rebase proposal.
  4. `registry-path.reject.json`: Scenario B11 / F09 registry path traversal (`../../`) rejection.
  5. `symlink-escape.reject.json`: Scenario D04 / F09 spec/artifact symlink escape fail-closed rejection.
  6. `parity.report.json`: Scenario D06 / F14 / F01–F06+F13 differential parity matrix.
  7. `alias-no-run.trace.json`: Scenario D07 / F13 legacy shorthand deprecation trace (0 runner calls).
  8. `discovery-after-disable.report.json`: Scenario D08 / F13 isolated discovery check (disposable HOME).
  9. `restore-rehearsal.report.json`: Scenario D10 / Gate P4 / F14 5-file rollback rehearsal verification.
  10. `terminal-outcomes.report.json`: AC-018 canonical terminal outcome enum validation.
  11. `flakiness.report.json`: Scenario C09 flakiness reporting separation.
  12. `mutation-suite.report.json`: Negative mutations 13 & 14 detection records.
  13. `m5-decision-packet.json`: Gate P1–P5 evaluation and owner decision packet.
  *Emitted by Phase 4 verification steps (3 reports):*
  14. `prompt-conformance.report.json`: Static command and configuration conformance (emitted by Step 6 `conformance.test.mjs`).
  15. `coverage.report.json`: Line, branch, function coverage report (≥80% threshold; emitted by Step 7 coverage run).
  16. `scope-check.report.json`: Filesystem write boundary audit confirming zero outside writes (emitted by Step 7 write audit).
- **New documentation & tracking:**
  - `docs/e2e-v2/m5/tdd-record.md`: TDD log tracking RED, GREEN, and REFACTOR stages with exact command outputs.
  - `docs/e2e-v2/m5/traceability-m5.md`: Complete two-layer traceability handoff (reference vs live) linking all 27 PRD requirements and M5 ACs.

## Reference Contract & Invariants to Implement

### 1. Registry Field-Scoped Update (AC-015 / C12 / F07 / E05)
- When a verified runner result is processed for a registered journey, update **only the matching Section 4 block**.
- Within that block, update **only the five permitted fields**: `State`, `Test file`, `Test node`, `Command`, `Evidence`.
- All other block fields (`Purpose`, `Source`, `Representative input`, `Observable expectation`, `Level`, `Execution group`, `Boundary`) must remain byte-identical.
- Any attempt to update non-permitted fields must fail closed with error code `FIELD-NOT-PERMITTED`, leaving the registry unchanged (`applied: false`).
- Other test blocks and journey index rows must remain unaltered; block ordering and ID sequences must not be renumbered or reordered.
- Real registry files (`TESTS.md`, `.governance/docs-map.json`) must never be written during evaluation; only in-memory text and disposable scratch fixtures are manipulated.

### 2. Concurrency Conflict, Rebase & Path Safety (AC-016 / B11 / B12 / D04 / Mutation 13)
- **Hash-Before-Write Concurrency Check:** Before proposing or applying any registry update, compute the SHA-256 hash of the registry. If the hash differs from the pre-flight hash (`hashBefore !== hashNow`), reject with `WRITE_CONFLICT` (`conflict: true`, `writePermitted: false`).
- **Non-Clobber Rebase:** Upon `WRITE_CONFLICT`, generate a rebase proposal against `registry@hashNow` that requires fresh approval, preventing last-writer-wins clobbering.
- **Path Traversal & Symlink Escape:** Validate all registry and artifact paths. Any path containing `..`, absolute paths outside the repository root, or symlink components resolving outside the scoped root must be rejected immediately with `PATH_REJECTED` or `SYMLINK_ESCAPE`.
- **Mutation 13 Carrier & Oracle:** Implement an independent concurrency oracle. In a simulated concurrent edit race, inject a bypass that skips the hash comparison and attempts an overwrite; verify the oracle flags this as `DETECTED` (expected write blocked vs observed write permitted).

### 3. Compatibility, Parity & Legacy Shorthand Resolution (AC-017 / D06 / D07 / D08 / Mutation 14 / DEC-04 / DEC-10)
- **Differential Parity (`evaluateParity`):** Compare output of `/e2e map` against legacy `/e2e-map` on benchmark stacks F01–F06 and collision fixture F13. Parity requires:
  - Exact match of detected routes and route counts.
  - Exact match of journey groupings and deduplicated flows.
  - Exact match of excluded non-UI endpoints (e.g., API routes).
  - Exact match of `PARTIAL` flags on ambiguous or unparsed components.
  - Emits a structured diff artifact (`parity.report.json`).
- **Legacy Shorthand Resolver (`resolveLegacyShorthand` / DEC-04):**
  - When invoked with legacy shorthand format (e.g., `/e2e auth` or `/e2e checkout`), emit a `LEGACY_SHORTHAND_DEPRECATED` migration hint.
  - Direct the user to the V2 equivalent: `/e2e run <flow>` or `/e2e map`.
  - Invariant: **Never invoke a runner, never spawn a process, and never mark coverage**. `runnerInvocations: 0`, `dispatched: false`, `coverageCredit: false`.
- **Discovery Check in Disposable HOME (D08):** In a synthetic disposable HOME environment, verify command discovery:
  - Default state: both `/e2e` and `/e2e-map` discoverable.
  - Simulated post-disable state: `/e2e` discoverable as the sole default command; `/e2e-map` absent from default discovery list.
- **Mutation 14 Carrier & Oracle:** In a simulated migration, attempt to disable `/e2e-map` before parity is verified or while the active command winner is unknown; verify the migration gate oracle detects this and returns `DETECTED` (`BLOCKED_PREMATURE_DISABLE`).

### 4. Canonical Terminal Outcome Enum (AC-018 / C09 / D05 / E06)
- Normalize all terminal outcomes to the exact enum defined in PRD §6 and ADR-E2E-014:
  - `PASS`: Strong behavioral assertion, exit 0, valid evidence, verified non-production run.
  - `FAIL`: Nonzero exit or failed assertion; proposes `unverified` downgrade if previously covered.
  - `BLOCKED`: Missing authorization, production target, Guardian denial, or dependency failure.
  - `UNVERIFIED`: Incomplete evidence, weak assertions (visibility-only), or untrusted run facts.
  - `CANCELLED`: Owner denied or aborted operation.
  - `PARTIAL`: Mapping incomplete or partial route resolution.
- Prohibit any narrative or fabricated pass (e.g., `PASS (manual)`, `PASS_UNCHECKED`).
- **Flakiness Reporting (C09):** Retries and flakiness must be reported in a separate `retry` field and never folded into a silent `PASS`.

### 5. Rollback Rehearsal (Gate P4 / D10 / F14)
- Execute an exact rollback rehearsal inside an isolated temporary directory created with `mkdtemp` with `0700` permissions under `$SCRATCH`:
  1. Copy the 3 configuration files and 2 command definitions into a backup snapshot directory; record their SHA-256 hashes:
     - `.opencode/opencode.json` (`01e3d440…`) (repo-relative project config; `ECC` denotes repository context, not path prefix)
     - `~/.config/opencode/opencode.json` (`bd747d4f…`)
     - `~/.config/opencode/opencode.jsonc` (`85378ac0…`)
     - `.opencode/commands/e2e.md` (`c562e0a2…`)
     - `.opencode/commands/e2e-map.md` (`76b3d403…`)
  2. Create a disposable simulated HOME and project worktree fixture inside the scratch directory.
  3. Rehearse the disable-default mechanism against the fixture copies only (e.g., updating manifest/profile or command discovery map).
  4. Restore the exact backup bytes back over the fixture files.
  5. Re-verify all five SHA-256 hashes against the initial snapshot.
  6. Assert exact match across all five files; emit `ROLLBACK_VERIFIED` (or `ROLLBACK_FAILED` on mismatch).
  7. Strict invariant: **Zero writes, zero moves, and zero deletes in the active repository or actual user HOME**.

### 6. Gates P1–P5 Evaluation & Decision Packet (DEC-10 Honesty)
- Gate P1 (Effective Resolution): Current state is `NOT_VERIFIED` (ASM-01 was inconclusive in M2).
- Gate P2 (Parity): Reference parity proven on F01–F06 + F13 (`VERIFIED_IN_M5_REFERENCE`).
- Gate P3 (Registry Safety): Field-scoped updates, conflict detection, and DEC-04 deprecation hint proven (`VERIFIED_IN_M5_REFERENCE`).
- Gate P4 (Rollback Readiness): Byte-exact rehearsal proven in scratch fixture (`VERIFIED_IN_M5_REFERENCE`).
- Gate P5 (Owner Deployment Authorization): Current state is `NOT_GIVEN`.
- Implementation must evaluate `evaluateM5Gates()`: because P1 is `NOT_VERIFIED` and P5 is `NOT_GIVEN`, live disable-default status is strictly `BLOCKED_DEPLOYMENT_GATED`.
- Emit `m5-decision-packet.json` containing the verified P2–P4 reference evidence and presenting the exact owner decision needed to authorize deployment in M6.

## Implementation Phases

All QA validation commands below are specified for a separately authorized worker session and adhere to `skills/tdd-workflow/SKILL.md`. All temporary fixtures are allocated under `/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode` and cleaned up by their creating test via literal-path removal.

### Phase 0 — Preflight, Pinning & Frozen Baseline Verification

1. **Verify inputs, pins, and frozen tree manifests**  
   (Files: `docs/e2e-v2/m5/reports/m5-preflight.report.json`, `docs/e2e-v2/m5/tdd-record.md`)
   - Action: Using read-only standard-library hashing (`node:crypto` / `shasum -a 256`), verify all source pins listed in the Pinned Sources table. Verify that `TESTS.md` and `.governance/docs-map.json` are absent in the repository. Verify the five rollback target files and record their preflight hashes. Recompute the frozen tree manifests for M1, M2, M3, M4, and contracts using the canonical sorted `path<TAB>sha256<LF>` encoding:
     - `docs/e2e-v2/m1` (16 files): `8416c0671af8ae60850d9d72f249968976c907cf4aa62b605d663bd5eb1625ca`
     - `docs/e2e-v2/m2` (27 files): `2f81da73f2068357f4265a3cfbaf6a9435a3e502d52dcd32d33b3b445fc97588`
     - `docs/e2e-v2/m3` (17 files): `2e8c7cf63a44b3d073185be0a4fe59de87fd9583ffc79abc6066b151066e23c7`
     - `docs/e2e-v2/m4` (20 files): `88c50d13760dd24dd47b9e5f2a2d8aa707b0f008abcf19b06fa7370641bc7807`
     - `docs/e2e-v2/contracts` (3 files): `a550f29ea751c7635cdc5d73bbc2e6a0a29d7cdf7153e43f23e429a4f4e05e8c`
     Record all observed hashes in `docs/e2e-v2/m5/reports/m5-preflight.report.json` and initialize `docs/e2e-v2/m5/tdd-record.md`.
   - Why: Stops execution immediately if any upstream contract or prior milestone artifact has drifted.
   - Closes: Preparatory baseline safety.
   - References: `docs/e2e-v2/m4/reports/m4-preflight.report.json`, `docs/e2e-v2/decisions/DECISION-REGISTER.md`.
   - Acceptance: All pinned hashes match exactly; tree manifests match expected hashes; registry files absent; preflight report passes.
   - QA: Happy path — `node -e "const crypto = require('node:crypto'), fs = require('node:fs'), assert = require('node:assert/strict'); const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); assert.equal(sha('.claude/prds/e2e-v2-0-unified-journey-mapping.prd.md'), 'bbe563be553147e4ff348622e54a75689db209bd798e85f85a97d739895191a9'); assert.equal(sha('.opencode/commands/e2e.md'), 'c562e0a2a2707c49362431b04ac1895f02c091e3d7ae193837ab6bf35b9d8436'); assert.equal(sha('.opencode/commands/e2e-map.md'), '76b3d4037a0144df2d40dc0eca01777690762a7cccc5d9562b0330333dfdb142'); assert.equal(sha('.opencode/opencode.json'), '01e3d4405c4351cde1460e782da9aa80f0aa6a6796bc3bb149be1b12bcc63e84'); assert.ok(!fs.existsSync('TESTS.md'), 'TESTS.md must be absent'); assert.ok(!fs.existsSync('.governance/docs-map.json'), 'docs-map.json must be absent'); console.log('PREFLIGHT_PINS_OK');"` exits 0 and `m5-preflight.report.json` records `status: PASS`. Failure path — Any hash mismatch or unexpected file presence causes an assertion error, immediate `HALT`, and non-zero exit without editing any file.
   - Dependencies: Owner execution authorization. Complexity: Medium. Risk: Low.

### Phase 1 — TDD RED Gate: Synthetic Fixtures & Failing Tests

2. **Implement test fixtures and author RED test suite**  
   (Files: `docs/e2e-v2/m5/tests/fixtures.mjs`, `docs/e2e-v2/m5/tests/m5.test.mjs`, `docs/e2e-v2/m5/tdd-record.md`)
   - Action:
     - In `fixtures.mjs`, define synthetic fixtures for F07 (Section 4 before/after block), F09 (path traversal and symlink escape cases), F11 (concurrent edit base, writer A, writer B), F13 (collision and legacy shorthand inputs), and F14 (benchmark stack route outputs for F01–F06 and rollback targets). Include helper functions to create 0700 scratch fixture directories with automated cleanup.
     - In `m5.test.mjs`, write the complete test suite asserting all required M5 behaviors across six distinct test groups:
       1. Group 1 (AC-015 / C12 / F07 / E05): Field-scoped registry updates; permitted fields pass; non-permitted fields throw `FIELD-NOT-PERMITTED`; unmatched blocks untouched; before/after SHA hashes recorded; 0 repository writes.
       2. Group 2 (AC-016 / B11 / B12 / D04 / Mutation 13): Path traversal (`..`) and symlink escapes fail closed; concurrent edits yield `WRITE_CONFLICT` with clean rebase proposal; Mutation 13 concurrency oracle detects overwrite bypass.
       3. Group 3 (AC-017 / D06 / D07 / D08 / Mutation 14): Parity comparison across F01–F06 and F13; legacy `/e2e <flow>` shorthand emits `LEGACY_SHORTHAND_DEPRECATED` with zero runner invocations and zero coverage credit; discovery check in disposable HOME verifies single default `/e2e`; Mutation 14 oracle detects premature disablement.
       4. Group 4 (AC-018 / C09 / D05 / E06): Canonical terminal enum membership (`PASS`, `FAIL`, `BLOCKED`, `UNVERIFIED`, `CANCELLED`, `PARTIAL`); flakiness reported in separate field; frozen workflow hashes verified.
       5. Group 5 (Gate P4 / D10 / F14): Rollback rehearsal in 0700 scratch verifies backup, disablement, restoration, and byte-exact SHA-256 match across all five files (`ROLLBACK_VERIFIED`); zero active-HOME writes.
       6. Group 6 (Gate P1/P5 Honesty & Decision Packet): Evaluates P1–P5; asserts live disable-default is `BLOCKED_DEPLOYMENT_GATED` because P1 is `NOT_VERIFIED` and P5 is `NOT_GIVEN`; generates `m5-decision-packet.json`.
     - Execute `TMPDIR=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode node --test docs/e2e-v2/m5/tests/m5.test.mjs` before implementing `migration.mjs`.
     - Confirm runtime RED state: tests fail specifically due to missing exports in `migration.mjs`. Record the exact RED failure command and output excerpt in `docs/e2e-v2/m5/tdd-record.md`.
   - Why: Strict TDD gate requires executing failing tests that prove missing functionality before modifying any reference code.
   - Closes: GAP-1, GAP-2, GAP-3, GAP-4, GAP-5, GAP-6.
   - References: `skills/tdd-workflow/SKILL.md`, `docs/e2e-v2/m4/tests/m4.test.mjs`, `BUNDLE/ACCEPTANCE-MATRIX.csv`.
   - Acceptance: All tests compile and execute; test suite fails with clear missing-module or missing-export assertions; failure is recorded in TDD log.
   - QA: Happy path — `node --test docs/e2e-v2/m5/tests/m5.test.mjs` fails with expected missing export errors. Failure path — If tests pass prematurely or fail due to syntax/harness errors, halt and correct test definitions.
   - Dependencies: Step 1. Complexity: High. Risk: Medium.

### Phase 2 — Reference Implementation: Migration, Concurrency, Parity & Rollback (GREEN)

3. **Implement registry field-scoped updates and concurrency safety**  
   (Files: `docs/e2e-v2/m5/tests/migration.mjs`, `docs/e2e-v2/m5/tdd-record.md`)
   - Action:
     - Implement `applyFieldScopedUpdate({ registryText, blockId, outcome })`: Parses Section 4 blocks; matches block by exact ID; validates that all updated fields belong to `PERMITTED_WRITE_FIELDS` (`State`, `Test file`, `Test node`, `Command`, `Evidence`). Rejects non-permitted fields with `FIELD-NOT-PERMITTED` and returns `applied: false`. Replaces or inserts only permitted field lines; preserves all other lines, blocks, and ordering. Returns `applied: true`, `diff`, and `nextText`.
     - Implement `checkRegistryPathSafety({ registryPath, repoRoot })`: Validates that path contains no traversal (`..`), is relative or contained within `repoRoot`, and that realpath resolves inside root without escaping symlinks.
     - Implement `checkWriteConflict({ hashBefore, hashNow, diff })`: If `hashBefore === hashNow`, returns `writePermitted: true`. If `hashBefore !== hashNow`, returns `outcome: 'WRITE_CONFLICT'`, `conflict: true`, `writePermitted: false`, and computes rebase descriptor with `recomputeFrom: 'registry@' + hashNow`.
     - Implement `simulateConcurrentEdit({ initialText, writerA, writerB })`: Models two writers attempting updates; proves Writer A succeeds while Writer B encounters `WRITE_CONFLICT` and receives a non-clobber rebase proposal.
     - Implement Mutation 13 carrier `runMutation13()`: Mutates concurrency check by bypassing hash comparison; independent concurrency oracle detects that Writer B clobbers Writer A (`observedClobber: true`, `expectedClobber: false`), returning `detected: true`.
   - Why: Satisfies AC-015 and AC-016 by guaranteeing surgical field updates and preventing last-writer-wins clobbering.
   - Closes: GAP-1, GAP-2.
   - References: `docs/e2e-v2/m3/tests/registry.mjs` lines 154–196 & 256–270; `BUNDLE/REGISTRY-CONTRACT.md` §Permitted write fields.
   - Acceptance: AC-015 tests pass (permitted fields update, unpermitted fail closed, 0 writes); AC-016 tests pass (conflict detected, rebase computed, mutation 13 detected).
   - QA: Happy path — `node --test --test-name-pattern="AC-015|AC-016" docs/e2e-v2/m5/tests/m5.test.mjs` passes. Failure path — Field tampering or clobbering triggers immediate assertion failure.
   - Dependencies: Step 2 RED. Complexity: High. Risk: Medium.

4. **Implement parity evaluation, legacy resolver, rollback rehearsal & gate logic**  
   (Files: `docs/e2e-v2/m5/tests/migration.mjs`, `docs/e2e-v2/m5/tdd-record.md`)
   - Action:
     - Implement `evaluateParity({ newMapOutput, legacyMapOutput, stackId })`: Computes normalized diff between `/e2e map` and `/e2e-map` on routes, flow deduplication, exclusions, and PARTIAL flags. Returns `parity: true/false` and detailed item-level diff.
     - Implement `resolveLegacyShorthand({ rawInput, registryText })`: Intercepts `/e2e <flow>`; returns `outcome: 'LEGACY_SHORTHAND_DEPRECATED'`, `hint: 'Use /e2e run <flow> or /e2e map'`, `runnerInvocations: 0`, `dispatched: false`, `coverageCredit: false`.
     - Implement `rehearseRollback({ configFiles, commandFiles, scratchDir })`: Copies the 5 target files to a backup directory with SHA-256 recording; simulates disablement in a fixture HOME copy; restores backup bytes; re-verifies all 5 hashes; returns `status: 'ROLLBACK_VERIFIED'`, `verifiedFiles: 5`, `activeTreeWrites: 0`.
     - Implement `mapTerminalOutcome(rawOutcome)`: Maps and validates outcome against canonical enum `['PASS', 'FAIL', 'BLOCKED', 'UNVERIFIED', 'CANCELLED', 'PARTIAL']`. Flakiness and retries are split into dedicated metadata fields.
     - Implement `evaluateM5Gates({ p1WinnerVerified, p2ParityReport, p3RegistrySafety, p4RollbackReport, p5OwnerAuth })`: Enforces DEC-10 policy. Since P1 is `NOT_VERIFIED` and P5 is `NOT_GIVEN`, returns `disableDefaultPermitted: false`, `gateStatus: 'BLOCKED_DEPLOYMENT_GATED'`, and emits remaining requirements.
     - Implement Mutation 14 carrier `runMutation14()`: Attempts premature disable-default without P1/P2/P5; gate oracle flags `detected: true`.
     - Re-run the full M5 test suite: `TMPDIR=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode node --test docs/e2e-v2/m5/tests/m5.test.mjs`.
     - Verify all tests pass (GREEN). Record passing command and output excerpt in `docs/e2e-v2/m5/tdd-record.md`.
   - Why: Satisfies AC-017, AC-018, Gate P4, and DEC-10 policy honesty.
   - Closes: GAP-3, GAP-4, GAP-5, GAP-6.
   - References: `M5-PARITY-ROLLBACK-PROPOSAL.md`, `BUNDLE/ACCEPTANCE-MATRIX.csv`, `docs/e2e-v2/m4/tests/runner.mjs`.
   - Acceptance: All M5 tests pass; rollback rehearsal succeeds in scratch fixture; P1/P5 honesty strictly blocks live deployment.
   - QA: Happy path — `node --test docs/e2e-v2/m5/tests/m5.test.mjs` exits 0 with all test groups green. Failure path — Premature live disable claim or rollback hash mismatch fails immediately.
   - Dependencies: Step 3. Complexity: High. Risk: Medium.

### Phase 3 — Deterministic Report Emitter & Evidence Emission

5. **Implement evidence emitter and generate scenario reports**  
   (Files: `docs/e2e-v2/m5/scripts/emit-m5-reports.mjs`, `docs/e2e-v2/m5/reports/*.json`)
   - Action:
     - In `emit-m5-reports.mjs`, mirror the pattern of M3 and M4 report emitters: CLI main guard executes harness logic over synthetic fixtures and writes exactly the 13 scenario and gate report files to `docs/e2e-v2/m5/reports/`. Importing the module does not perform file writes.
     - Every emitted report includes: `generated_at`, `milestone: 'M5'`, `status: 'EXECUTED'`, `fixture_provenance: 'SYNTHETIC_REFERENCE'`, `live_prompt_verification: 'DEFERRED_TO_M6'`, `live_playwright_execution: 'DEFERRED_TO_M6'`, `registry_writes: 0`, and `applied: false`.
     - Generate all 13 required scenario and gate reports:
       - `m5-preflight.report.json`: Preflight hashes and frozen tree verifications.
       - `registry-block.diff.json`: Field-scoped update diff on F07 (C12, E05).
       - `concurrency.report.json`: Hash-before-write conflict & rebase proposal on F11 (B12).
       - `registry-path.reject.json`: Rejection of registry path traversal (`../../`) on F09 (B11).
       - `symlink-escape.reject.json`: Rejection of spec/artifact symlink escapes on F09 (D04).
       - `parity.report.json`: Parity comparison over F01–F06 and F13 (D06).
       - `alias-no-run.trace.json`: Deprecation hint trace with zero runner invocations on F13 (D07).
       - `discovery-after-disable.report.json`: Simulated post-disable discovery verification (D08).
       - `restore-rehearsal.report.json`: Byte-exact rollback rehearsal verification across 5 files (D10 / P4).
       - `terminal-outcomes.report.json`: Canonical terminal outcome enum verification (AC-018).
       - `flakiness.report.json`: Flakiness separated from terminal pass (C09).
       - `mutation-suite.report.json`: Negative mutations 13 & 14 detection evidence (E02).
       - `m5-decision-packet.json`: Gating evaluation showing P2–P4 verified, P1 NOT_VERIFIED, P5 NOT_GIVEN, and live disable-default blocked (DEC-10).
     - Add assertion tests in `m5.test.mjs` validating that every emitted report parses as valid JSON, identifies its scenario ID, carries deferred labels, and records `registry_writes: 0`.
   - Why: Provides complete, auditable, machine-readable evidence for all M5 acceptance criteria.
   - Closes: GAP-1..GAP-6 (evidence artifacts).
   - References: `docs/e2e-v2/m4/scripts/emit-m4-reports.mjs`, `docs/e2e-v2/m4/reports/*.json`.
   - Acceptance: `node docs/e2e-v2/m5/scripts/emit-m5-reports.mjs` generates all 13 scenario/gate reports; reports parse cleanly and pass schema assertions.
   - QA: Happy path — Emitter runs without errors; all 13 scenario/gate report files exist, contain required fields, and pass JSON schema checks. Failure path — Missing scenario ID or nonzero registry write assertion causes emitter test to fail.
   - Dependencies: Steps 3 & 4. Complexity: Medium. Risk: Low.

### Phase 4 — Conformance, Regression, Coverage & Handoff

6. **Static conformance and command integrity checks**  
   (Files: `docs/e2e-v2/m5/tests/conformance.test.mjs`, `docs/e2e-v2/m5/reports/prompt-conformance.report.json`)
   - Action:
     - In `conformance.test.mjs`, verify that `.opencode/commands/e2e.md` remains byte-identical to its pinned preimage (`c562e0a2…`).
     - Verify that `.opencode/commands/e2e-map.md` exists, is discoverable, and matches its pinned preimage (`76b3d403…`).
     - Verify that `TESTS.md` and `.governance/docs-map.json` are absent in the repository.
     - Verify that no active configuration files in project or global HOME have been modified.
     - Emit `docs/e2e-v2/m5/reports/prompt-conformance.report.json` documenting static conformance without overclaiming runtime enforcement.
   - Why: Verifies that reference implementation respected all boundary constraints.
   - Closes: Non-regression and command stability.
   - References: `docs/e2e-v2/m4/tests/conformance.test.mjs`.
   - Acceptance: All conformance assertions pass; static checks confirm zero prompt or configuration mutations.
   - QA: Happy path — `node --test docs/e2e-v2/m5/tests/conformance.test.mjs` exits 0. Failure path — Any detected file modification fails test immediately.
   - Dependencies: Step 5. Complexity: Low. Risk: Low.

7. **Run regression suites, enforce coverage thresholds & emit scope check**  
   (Files: `docs/e2e-v2/m5/reports/coverage.report.json`, `docs/e2e-v2/m5/reports/scope-check.report.json`, `docs/e2e-v2/m5/tdd-record.md`)
   - Action:
     - Execute prior milestone test suites to guarantee non-regression:
       - `TMPDIR=$SCRATCH node --test docs/e2e-v2/m4/tests/*.test.mjs`
       - `TMPDIR=$SCRATCH node --test docs/e2e-v2/m3/tests/*.test.mjs`
       - `TMPDIR=$SCRATCH node --test docs/e2e-v2/m2/tests/*.test.mjs`
       (Note: M1 suite is not executed directly due to external dependencies and active-HOME checks; its 16 artifacts are verified via tree hash matching historical evidence).
     - Run coverage checks using Node's built-in coverage runner:
       - `node --experimental-test-coverage --test-coverage-include=docs/e2e-v2/m5/tests/migration.mjs --test-coverage-lines=80 --test-coverage-branches=80 --test-coverage-functions=80 --test docs/e2e-v2/m5/tests/m5.test.mjs`
       - `node --experimental-test-coverage --test-coverage-include=docs/e2e-v2/m5/scripts/emit-m5-reports.mjs --test-coverage-lines=80 --test-coverage-branches=80 --test-coverage-functions=80 --test docs/e2e-v2/m5/tests/m5.test.mjs`
       Save coverage results to `docs/e2e-v2/m5/reports/coverage.report.json`.
     - Audit filesystem writes: verify that all created files match the allowed write set (`docs/e2e-v2/m5/**`); verify zero outside writes; verify frozen tree hashes remain identical. Emit `docs/e2e-v2/m5/reports/scope-check.report.json`.
     - Complete `docs/e2e-v2/m5/tdd-record.md` with REFACTOR stage confirmations.
   - Why: Guarantees code quality, high test coverage, non-regression of prior work, and zero boundary leakage.
   - Closes: Verification gate requirements.
   - References: `docs/e2e-v2/m4/reports/coverage.report.json`, `docs/e2e-v2/m4/reports/scope-check.report.json`.
   - Acceptance: All test suites pass; coverage thresholds ≥80% for lines, branches, and functions on each module; zero outside writes; frozen tree hashes identical.
   - QA: Happy path — Coverage commands pass with ≥80% on all dimensions; scope check reports 0 outside writes. Failure path — Coverage below 80% or any modified file outside M5 fails the verification gate.
   - Dependencies: Steps 4, 5, 6. Complexity: Medium. Risk: Low.

8. **Publish M5 Traceability Matrix and M6 Handoff**  
   (Files: `docs/e2e-v2/m5/traceability-m5.md`)
   - Action: Author the comprehensive M5 traceability document:
     - Document the two-layer claim (reference layer proven vs live criteria deferred).
     - Map every AC (`AC-015` through `AC-018`), PRD requirement (`E2E-FR-014` through `E2E-FR-018`), scenario (C12, B11, B12, D04, D06, D07, D08, D10, C09, D05, E02, E05, E06), and mutation (13, 14) to its test name, emitted report, reference outcome, and live status.
     - Formally record the status of Gates P1–P5:
       - Gate P1 (Effective resolution): `NOT_VERIFIED` (ASM-01 inconclusive).
       - Gate P2 (Parity): `VERIFIED_IN_M5_REFERENCE` (diff committed).
       - Gate P3 (Registry safety): `VERIFIED_IN_M5_REFERENCE` (field-scoped updates & DEC-04 hint).
       - Gate P4 (Rollback readiness): `VERIFIED_IN_M5_REFERENCE` (5-file rehearsal verified).
       - Gate P5 (Owner deployment authorization): `NOT_GIVEN` (pending explicit owner instruction).
     - State clearly that live `/e2e-map` disablement remains strictly blocked until the owner reviews `m5-decision-packet.json`, verifies P1, and provides explicit P5 authorization.
     - Document frozen tree hashes and pre-existing authorized deltas carried forward.
   - Why: Establishes complete traceability and ensures a clean, unambiguous handoff to Milestone M6.
   - Closes: Complete milestone traceability and governance.
   - References: `docs/e2e-v2/m4/traceability-m4.md`, `docs/e2e-v2/decisions/REQUIREMENT-TRACEABILITY.csv`.
   - Acceptance: Traceability document complete, accurate, self-contained, and consistent with all generated reports.
   - QA: Happy path — `test -s docs/e2e-v2/m5/traceability-m5.md && node -e "const fs = require('node:fs'), assert = require('node:assert/strict'); const t = fs.readFileSync('docs/e2e-v2/m5/traceability-m5.md', 'utf8'); for (const ac of ['AC-015', 'AC-016', 'AC-017', 'AC-018']) assert.ok(t.includes(ac), 'missing ' + ac); for (const sc of ['C12', 'B11', 'B12', 'D04', 'D06', 'D07', 'D08', 'D10', 'C09', 'D05', 'E02', 'E05', 'E06', 'Mutation 13', 'Mutation 14']) assert.ok(t.includes(sc), 'missing ' + sc); assert.ok(t.includes('BLOCKED_DEPLOYMENT_GATED'), 'missing BLOCKED_DEPLOYMENT_GATED'); assert.ok(t.includes('NOT_VERIFIED'), 'missing NOT_VERIFIED'); console.log('TRACEABILITY_OK');"` exits 0. Failure path — If `traceability-m5.md` is missing, empty, or omits any required AC, scenario, mutation, or gate status token (e.g. `BLOCKED_DEPLOYMENT_GATED`), the assertion throws an AssertionError and the step fails immediately.
   - Dependencies: Steps 1 through 7. Complexity: Low. Risk: Low.

## Testing Strategy

- **Test Framework:** Zero-dependency native Node.js test runner (`node --test`) with strict assertions (`node:assert/strict`). No external testing libraries or npm packages.
- **TDD Workflow:** Strictly enforce RED → GREEN → REFACTOR. Tests must be executed and confirmed failing before reference implementation; same tests rerun to confirm passing; TDD record maintained at each stage.
- **Unit & Reference Tests (`m5.test.mjs`):**
  - Section 4 block matching: exact ID, title similarity rejection, field filtering.
  - Permitted write fields: allow `State`, `Test file`, `Test node`, `Command`, `Evidence`; reject all other fields with `FIELD-NOT-PERMITTED`.
  - Concurrency & race simulation: hash comparison, `WRITE_CONFLICT` trigger, rebase descriptor computation, non-clobber verification.
  - Path security: traversal (`..`), absolute paths, and symlink escapes outside repository root.
  - Parity differential: route counts, deduplication, endpoint exclusions, PARTIAL status matching across F01–F06 and F13.
  - Legacy shorthand: deprecation hint emission, zero runner calls, zero coverage credit.
  - Rollback rehearsal: isolated 0700 scratch directory, backup, simulated disablement, restoration, 5-file SHA-256 re-verification.
  - Terminal outcomes: canonical enum membership validation, flakiness field isolation.
  - Negative mutations: mutation 13 (overwrite clobber) and mutation 14 (premature disablement) detection by independent oracles.
  - Gating logic: P1–P5 gate evaluator, live deployment blocked when P1 or P5 incomplete.
- **Static Conformance Tests (`conformance.test.mjs`):**
  - Read-only hash checks for pinned command preimages (`.opencode/commands/e2e.md`, `.opencode/commands/e2e-map.md`).
  - Absence verification for `TESTS.md` and `.governance/docs-map.json`.
  - Immutability check for active project and global configuration files.
- **Regression Testing:**
  - Execute M4 test suite (`docs/e2e-v2/m4/tests/*.test.mjs`).
  - Execute M3 test suite (`docs/e2e-v2/m3/tests/*.test.mjs`).
  - Execute M2 test suite (`docs/e2e-v2/m2/tests/*.test.mjs`).
  - Verify frozen tree manifests across M1, M2, M3, M4, and contracts.
- **Coverage Requirements:**
  - Enforce ≥80% lines, ≥80% branches, and ≥80% functions individually for each non-test module (`docs/e2e-v2/m5/tests/migration.mjs` and `docs/e2e-v2/m5/scripts/emit-m5-reports.mjs`).

## Risks & Mitigations

| Risk | Description | Mitigation |
|---|---|---|
| **Accidental Active-HOME or Config Mutation** | Writing to real configuration files during rollback rehearsal or discovery testing. | All rollback and discovery operations run strictly inside disposable 0700 scratch fixtures (`mkdtemp`). Zero writes to active HOME or repository configuration files. Conformance tests explicitly assert immutability of active files. |
| **Premature Disable-Default Claim** | Claiming that `/e2e-map` can be disabled live before effective winner is verified. | Gate P1 is explicitly pinned as `NOT_VERIFIED`, Gate P5 as `NOT_GIVEN`. The gating engine and decision packet explicitly mark live disable-default as `BLOCKED_DEPLOYMENT_GATED`. |
| **Silent Registry Clobbering (Last-Writer-Wins)** | Concurrent updates overwriting intermediate changes without conflict notification. | Hash-before-write concurrency check evaluates SHA-256 before any proposed write. Any hash mismatch returns `WRITE_CONFLICT` and generates a clean rebase proposal. Mutation 13 tests verify detection. |
| **Non-Permitted Field Pollution** | Automated updates overwriting journey metadata (e.g., `Purpose`, `Observable expectation`). | Strict field allowlist (`PERMITTED_WRITE_FIELDS`). Any non-permitted field immediately aborts with `FIELD-NOT-PERMITTED` and leaves registry text unchanged. Tested via Scenario C12. |
| **Path Traversal & Symlink Escapes** | Malicious or malformed paths escaping workspace boundaries. | Realpath resolution and containment checks verify all paths remain inside the scoped fixture root. Path traversal (`..`) and escaping symlinks fail closed. Tested via Scenarios B11 and D04. |
| **Legacy Command Silent Execution** | Legacy shorthand `/e2e <flow>` executing untested code or inventing coverage. | `resolveLegacyShorthand` intercepts shorthand calls, emits `LEGACY_SHORTHAND_DEPRECATED` migration hint, and enforces `runnerInvocations: 0`, `dispatched: false`, `coverageCredit: false`. |
| **Frozen Tree Baseline Drift** | Modifying prior milestone files (M1–M4) or contract files during M5 work. | Preflight and postflight checks verify exact tree hashes for M1, M2, M3, M4, and contracts. Any drift halts the process immediately. |

## Decisions I Made for You

| Decision | Default Chosen | Reversible? |
|---|---|---|
| **Reference-Only Scope** | All M5 work is implemented as reference and fixture harnesses under `docs/e2e-v2/m5/**`. No live runtime changes. | Yes; live integration is reserved for M6 upon explicit owner authorization. |
| **Rollback Rehearsal Isolation** | Rehearse rollback strictly against copies inside a disposable 0700 scratch directory, never against active files. | Yes; ensures absolute zero risk to active environment. |
| **Zero Repository Registry Writes** | All registry update and concurrency tests operate on in-memory strings and scratch fixtures; `TESTS.md` is not written. | Yes; aligns with DEC-06 requiring explicit approval of exact proposed diffs. |
| **P1 / P5 Honesty** | Maintain P1 as `NOT_VERIFIED` and P5 as `NOT_GIVEN`; emit `m5-decision-packet.json` instead of claiming deployment readiness. | Yes; owner can authorize P1 verification probe and P5 disablement separately. |
| **Legacy Shorthand Behavior** | Deprecate legacy `/e2e <flow>` with an informative migration hint; never dispatch runner or credit coverage (DEC-04). | Yes; owner policy can amend hint wording or format if desired. |
| **DEC-12 Schema Reconciliation** | DEC-12 (reconciling legacy `State: stale` as journey assessment, not Registry State) was already implemented in M3 (`registry.mjs` / `stale-migration-proposal.report.json`); no new M5 action needed; verified non-regression. | No (canonical policy). |
| **Zero External Dependencies** | Implement all logic using native Node.js standard library modules (`node:test`, `node:crypto`, `node:fs`, etc.). | Yes; preserves repository zero-dependency footprint. |
| **Module-Level Coverage Thresholds** | Enforce ≥80% line, branch, and function coverage independently on `migration.mjs` and `emit-m5-reports.mjs`. | Yes; guarantees high test quality without pooling metrics. |

## Inline Metis Gap Pass

| Finding / Category | Disposition | Resolution or Required Handling |
|---|---|---|
| **Effective Command Winner (ASM-01) is Unverified** | RESOLVED (Honesty) | Gate P1 remains strictly `NOT_VERIFIED`. The M5 harness does NOT assume the winner, does NOT alter discovery, and emits `m5-decision-packet.json` blocking live disable-default until an isolated probe is executed. |
| **Owner Deployment Authorization (P5) is Not Given** | RESOLVED (Honesty) | Gate P5 remains `NOT_GIVEN`. M5 provides the complete reference evidence packet (P2, P3, P4) enabling the owner to grant P5 separately when ready. |
| **Active Config & Commands Must Not Be Modified** | RESOLVED | Rollback rehearsal targets are copied to a disposable 0700 scratch directory. Active `.opencode/opencode.json` (repo-relative project config; `ECC` denotes repository context, not path prefix), `~/.config/opencode/opencode.json`, `~/.config/opencode/opencode.jsonc`, `.opencode/commands/e2e.md`, and `.opencode/commands/e2e-map.md` are verified unchanged before and after. |
| **Real Registry Files Absent** | RESOLVED | `TESTS.md` and `.governance/docs-map.json` remain absent in the repository. All field-scoped update and concurrency tests operate on synthetic F07/F11 fixture text with zero repository writes. |
| **Negative Mutations 13 & 14 Execution** | RESOLVED | Implemented as runnable carrier/oracle pairs in `migration.mjs` and tested in `m5.test.mjs`: mutation 13 detects concurrency clobbers, mutation 14 detects premature disable-default. |
| **Benchmark Stack Parity Across F01–F06 & F13** | RESOLVED | Synthetic route and flow fixtures representing all benchmark stacks are evaluated by `evaluateParity()`, producing a structured diff artifact in `parity.report.json`. |
| **Legacy Shorthand Execution Risk (DEC-04)** | RESOLVED | `resolveLegacyShorthand()` strictly returns `LEGACY_SHORTHAND_DEPRECATED` with `runnerInvocations: 0` and `dispatched: false`, eliminating any possibility of silent execution. |
| **Prior Milestone Baselines Frozen** | RESOLVED | Exact file counts and tree hashes for M1 (16), M2 (27), M3 (17), M4 (20), and contracts (3) are checked in preflight and postflight. |
| **External Dependency & Browser Execution Prohibited** | RESOLVED | Zero-dependency implementation; no Playwright probe or browser spawn; all live criteria marked `DEFERRED_TO_M6`. |
| **Secret & Sensitive Data Handling** | RESOLVED | Any temporary scratch artifacts containing synthetic secrets or tokens are sanitized and deleted via Python/Node literal-path removal, never shell wildcards. |

**Gap pass: 10 issue groups resolved; 0 blocking issues open; live criteria deferred to M6.**

## Success Criteria

| IS Row / Approved AC | Proven at Reference Layer By | Required QA Evidence Artifact | Live Status |
|---|---|---|---|
| **IS-1 / AC-015** (Field-Scoped Update) | Steps 2, 3, 5: C12 / F07 / E05 field-scoped update on matched block; non-permitted fields rejected with `FIELD-NOT-PERMITTED`; unmatched blocks untouched; before/after hashes recorded; 0 repository writes. | `m5.test.mjs`, `registry-block.diff.json` | `DEFERRED_TO_M6`; no real registry mutation. |
| **IS-2 / AC-016** (Concurrency & Path Safety) | Steps 2, 3, 5: B11 / B12 / D04 / Mutation 13 hash-before-write concurrency control; `WRITE_CONFLICT` and rebase proposal; path traversal and symlink escapes rejected fail closed; mutation 13 detected. | `m5.test.mjs`, `concurrency.report.json`, `registry-path.reject.json`, `symlink-escape.reject.json`, `mutation-suite.report.json` | `DEFERRED_TO_M6`; no concurrent repository writes. |
| **IS-3 / AC-017** (Parity & Compatibility) | Steps 2, 4, 5: D06 / D07 / D08 / Mutation 14 parity comparison across F01–F06 and F13; legacy shorthand deprecation hint with 0 runner calls; single default `/e2e` in fixture discovery; mutation 14 detected. | `m5.test.mjs`, `parity.report.json`, `alias-no-run.trace.json`, `discovery-after-disable.report.json`, `mutation-suite.report.json` | `DEFERRED_TO_M6`; no live command disablement. |
| **IS-4 / AC-018** (Terminal Outcome Enum) | Steps 2, 4, 5: C09 / D05 / E06 strict canonical terminal outcome enum enforcement; flakiness reported in separate field; frozen workflow hashes verified. | `m5.test.mjs`, `terminal-outcomes.report.json`, `flakiness.report.json` | `DEFERRED_TO_M6`; no live execution outcomes. |
| **IS-5 / Gate P4** (Rollback Rehearsal) | Steps 2, 4, 5: D10 / F14 5-file rollback rehearsal in isolated 0700 scratch directory; backup, simulated disablement, restoration, and byte-exact SHA-256 match across all five files; zero active-HOME writes. | `m5.test.mjs`, `restore-rehearsal.report.json` | `DEFERRED_TO_M6`; no real rollback executed. |
| **IS-6 / DEC-10** (P1/P5 Honesty & Decision Packet) | Steps 2, 4, 5: Gating evaluator blocks live disable-default due to P1 `NOT_VERIFIED` and P5 `NOT_GIVEN`; emits complete owner decision packet. | `m5.test.mjs`, `m5-decision-packet.json` | `DEFERRED_TO_M6`; deployment authorization pending. |

## Review Handoff

The independent `plan-reviewer` subagent should be chained against this plan file (`docs/plans/e2e-v2-0-m5-migration-rollback.plan.md`) to perform executability and adversarial review passes.

Upon approval by the reviewer, owner approval must be formally granted before any implementation commences. Implementation will proceed in a separate worker session strictly following the phased TDD steps outlined herein.
