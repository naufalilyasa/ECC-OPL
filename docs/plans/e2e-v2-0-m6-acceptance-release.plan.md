# Implementation Plan: ECC-OPL /e2e V2.0 M6 — Acceptance Release: 48 Scenarios & 14 Negative Mutations

**Status:** APPROVED  
**Revision:** r4  
**Readiness:** READY_FOR_EXECUTION  
**Milestone:** M6 — Acceptance release (AC-019..AC-022 / 48 scenarios + 14 mutations)  
**Mode:** standard, approved-PRD-driven; frozen architecture  
**Upstream approved PRD digest:** `047918df0835bc7ea52f0d0dc7714f0b29394cce32ad8c2580b2973dfce1d211` (R1 `PRD-CANDIDATE.md`)  
**Execution authorization:** DRAFT — pending independent `plan-reviewer` review and explicit owner approval; no implementation permitted during planning.

## Summary

Design and specify the complete, honest **acceptance release harness and evidence framework** for Milestone M6. This plan establishes the final verification and acceptance release for ECC-OPL /e2e V2.0, fulfilling PRD requirements `E2E-FR-001` through `E2E-FR-020`, `E2E-NFR-001` through `E2E-NFR-007`, acceptance criteria `AC-019` through `AC-022` (consolidating `AC-001` through `AC-018`), all 48 scenarios across Groups A through E (A01–A08, B01–B12, C01–C12, D01–D10, E01–E06), and all 14 negative mutations.

M6 provides the definitive bridge between prior milestone reference proofs (M1–M5) and formal acceptance delivery while strictly enforcing the following invariants:
1. **Unified 48-Scenario Acceptance Ledger (AC-021 / A01–E06):** Every single scenario from the approved acceptance matrix is evaluated, classified, and audited with honest status accounting: `PASS` strictly for real executed actions with verified evidence; `REFERENCE_VERIFIED` for deterministic harness assertions over synthetic fixtures; and `NOT_RUN` where live model behavior or external systems are unavailable. A simulated receipt is never labeled `PASS`.
2. **Complete 14 Negative Mutation Suite (AC-022 / E02 / Mutations 1–14):** All 14 negative mutations from `NEGATIVE-MUTATION-PLAN.md` are executed against independent oracles and proven `DETECTED`. Mutations 10 and 12 proven in M4; mutations 13 and 14 proven in M5; consolidated alongside mutations 1–9 and 11 into a single runnable suite, proving that every parser, safety, environment, and registry gate fails closed upon tampering.
3. **Owner-Authorized Scratch Playwright Execution (AC-014 / AC-011 / C04 / C05 / C06 / C07 / C10 / DEC-07 / DEC-08):** Playwright 1.65.1 + Chromium (installed exclusively in authorized scratch `/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright` with `PLAYWRIGHT_BROWSERS_PATH` pointing into `pw-browsers/`) is executed strictly against an ephemeral Node.js HTTP loopback server (target label: `E2E_NONPROD_LOCAL_FIXTURE`). Real exit codes, node IDs, timing, and scoped screenshot/trace artifacts with verified redaction are generated without modifying the repository `package.json`, installing any global npm packages, or writing to active HOME.
4. **Persistent Deployment Gates & Disable-Default Honesty (DEC-10 / Gate P1 / Gate P5 / D08 / D10):** Gate P1 (effective command winner) remains strictly `NOT_VERIFIED` and Gate P5 (owner deployment authorization) remains `NOT_GIVEN`. Live disablement of legacy `/e2e-map` remains strictly `BLOCKED_DEPLOYMENT_GATED`. Production targets remain strictly `BLOCKED`.
5. **Session Constraint & Deterministic Preference:** Execution bounds top-level model-invoking sessions to at most 3 sessions; deterministic Node.js test harness (`node --test`) is preferred and utilized for all automated verification.
6. **Zero Write Boundary Leakage & Environment Isolation:** All newly written files are confined strictly to `docs/e2e-v2/m6/**` and temporary scratch directories. An isolated scratch HOME fixture (`$SCRATCH/m6-home-fixture/.config/opencode/`) provides the pinned global configuration environment; active configuration files, active commands, frozen baselines M1–M5, and contracts remain byte-identical; active global configuration drift is recorded observationally as owner-authorized state without modification; `TESTS.md` and `.governance/docs-map.json` remain absent.

## Affected User and Ideal State

**Affected users:**
- **Repository Owner:** Requires unambiguous, auditable evidence that all 48 PRD scenarios and 14 negative mutations are accounted for, tested, and honestly reported before V2.0 release, with zero active config corruption and zero unauthorized deployment.
- **Test Engineer / Developer:** Uses `/e2e` commands expecting robust journey detection, deterministic Playwright execution, clear deprecation hints, and strict separation between covered and unverified tests.
- **Downstream CI / Agent Tools:** Consumes machine-readable acceptance ledger and evidence records with standardized terminal outcome enums.

| Row | Statement | Reason |
|---|---|---|
| IS-1 | All 48 scenarios have explicit, audited entries in a unified acceptance ledger (`acceptance-ledger.json`) with unambiguous statuses (`PASS`, `REFERENCE_VERIFIED`, `NOT_RUN`), exact evidence artifact paths, and SHA-256 hashes. | The owner can inspect a single authoritative ledger proving complete acceptance coverage without guessing or cross-referencing disparate milestone fragments. (AC-021) |
| GAP-1 | Previous milestones proved scenarios in isolated clusters (M1: A01/B05; M2: A01–A07/B01–B06; M3: A08/B07–B10/C02/C03; M4: C01/C04–C06/C08/C10/D02/D03; M5: C12/B11/B12/D04/D06–D08/D10); no unified 48-scenario acceptance ledger exists. | Prior evidence is fragmented across milestone subdirectories and requires holistic consolidation. |
| IS-2 | All 14 negative mutations are executed against independent oracles and proven `DETECTED` in `mutation-suite.report.json`, guaranteeing that safety gates, environment boundaries, and data boundaries cannot be silently bypassed. | Guarantees system resilience against tampering, malicious inputs, unauthorized writes, and premature disablement. (AC-022) |
| GAP-2 | M4 proved mutations 10 & 12; M5 proved mutations 13 & 14; mutations 1–9 and 11 have not been consolidated into a single executable 14-mutation suite with machine-readable detection evidence. | The complete 14-mutation suite has never been executed as a unified verification pass. |
| IS-3 | Real Playwright 1.65.1 execution is conducted strictly in an isolated scratch environment (`/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright`) against a temporary local HTTP loopback server (`E2E_NONPROD_LOCAL_FIXTURE`), producing actual browser screenshots, traces, exit codes, and timing without touching active repository dependencies or active HOME. | Real browser execution is verified safely on loopback without risking production calls, credential leaks, or dependency corruption. (AC-014, AC-011, DEC-07, DEC-08) |
| GAP-3 | M4 implemented a reference runner using synthetic records; live browser execution remained deferred to M6. | Live Playwright execution has not yet been executed and verified on disk. |
| IS-4 | Honest status accounting distinguishes executed evidence (`PASS`), deterministic harness verification (`REFERENCE_VERIFIED`), and unavailable model/external execution (`NOT_RUN`), with simulated receipts never labeled `PASS`. | Prevents false confidence or fabricated compliance claims; guarantees transparent auditability. (AC-018, PRD §8) |
| GAP-4 | Prior milestones marked live criteria as `DEFERRED_TO_M6`; M6 must resolve every deferred item into its true terminal acceptance category without false narrative passes. | Unresolved deferred markers must be audited and settled honestly. |
| IS-5 | Deployment gates P1 (`NOT_VERIFIED`) and P5 (`NOT_GIVEN`) remain strictly enforced, ensuring live `/e2e-map` disable-default is recorded as `BLOCKED_DEPLOYMENT_GATED` and production targets stay `BLOCKED`. | Precludes automated or premature configuration changes before explicit out-of-band owner instruction. (DEC-07, DEC-10) |
| GAP-5 | Reference rollback was rehearsed in M5, but M6 must formalize the final decision packet proving that live deployment remains gated. | Clear gating prevents accidental deployment during acceptance testing. |
| IS-6 | Frozen baselines (M1–M5, contracts, command preimages) remain byte-identical; repository registry files (`TESTS.md`, `.governance/docs-map.json`) remain absent. | Guarantees non-regression and architectural immutability across the entire development history. (E2E-NFR-005) |
| GAP-6 | M6 must verify that consolidating acceptance across all milestones does not mutate any prior deliverable. | Broad cross-cutting verification risks unintentional edits if not strictly bounded. |

## Scope

### Must
- Implement the zero-dependency Node.js acceptance harness strictly under `docs/e2e-v2/m6/**` using native `node:test`, `node:assert/strict`, `node:crypto`, `node:fs`, `node:path`, and `node:http`.
- Execute all 48 scenarios (A01–A08, B01–B12, C01–C12, D01–D10, E01–E06) from `ACCEPTANCE-MATRIX.csv` and emit `docs/e2e-v2/m6/reports/acceptance-ledger.json`.
- Execute all 14 negative mutations from `NEGATIVE-MUTATION-PLAN.md`, proving each is `DETECTED` by an independent oracle, and emit `docs/e2e-v2/m6/reports/mutation-suite.report.json`.
- Execute real Playwright 1.65.1 + Chromium strictly from the authorized scratch directory (`/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright` with `PLAYWRIGHT_BROWSERS_PATH` pointing to `pw-browsers/`) against an ephemeral local HTTP server on loopback (`E2E_NONPROD_LOCAL_FIXTURE`), capturing genuine screenshots, traces, timing, and exit codes into scratch storage and reporting them in `docs/e2e-v2/m6/reports/playwright-execution.report.json`.
- Enforce strict, honest status taxonomy across all 48 scenarios:
  - `PASS`: verified via executed real evidence (scratch Playwright on loopback, or deterministic invariant checks).
  - `REFERENCE_VERIFIED`: verified via deterministic Node.js harness over synthetic fixtures without live model/prompt invocation.
  - `NOT_RUN`: where live interactive model session behavior or external services are not executed.
  - Never label simulated or mock runs as `PASS`.
- Restrict top-level model-invoking sessions to at most 3 sessions (preferring deterministic harness execution for all automated assertions).
- Maintain Gates P1 (`NOT_VERIFIED`) and P5 (`NOT_GIVEN`); mark live `/e2e-map` disable-default as `BLOCKED_DEPLOYMENT_GATED`; emit `docs/e2e-v2/m6/reports/m6-decision-packet.json`.
- Maintain production targets as strictly `BLOCKED`; only `E2E_NONPROD_LOCAL_FIXTURE` / loopback targets are permitted.
- Verify frozen baselines M1 (16 files), M2 (27 files), M3 (17 files), M4 (20 files), M5 (23 files), and contracts (3 files) match their exact pinned SHA-256 tree hashes.
- Verify that `TESTS.md` and `.governance/docs-map.json` remain absent from the active repository.
- Verify immutability of active commands (`.opencode/commands/e2e.md`, `.opencode/commands/e2e-map.md`) and active project config (`.opencode/opencode.json`); verify pinned global configurations via isolated scratch HOME fixture (`$SCRATCH/m6-home-fixture/.config/opencode/`); record active global `~/.config/opencode/opencode.jsonc` drift observationally as owner-authorized state without modification.
- Enforce code coverage ≥80% for lines, branches, and functions on each new non-test module under `docs/e2e-v2/m6/tests/` and `docs/e2e-v2/m6/scripts/`.
- Confine all file writes strictly to `docs/e2e-v2/m6/**` and temporary scratch directories under `/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode`.

### Must NOT (Scope Guardrails & Non-Goals)
- No package installations or modifications to the active repository `package.json`, `package-lock.json`, or active `node_modules`.
- No browser installation or downloads into active user directories (`~/.cache`, `~/Library/Caches`, etc.); only existing scratch Playwright in `/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright` is used.
- No live application, external network, or production requests. No real user accounts or real credentials.
- No real repository registry writes: `TESTS.md` and `.governance/docs-map.json` must not be created or edited.
- No active configuration edits or deletions in project or global OpenCode directories.
- No active command edits or removals.
- No live disablement of `/e2e-map`.
- No git operations (commit, branch, tag, stash, rebase, push). No access to `.git` or `.guardian-angel`.
- No post-M6 or V2.1 feature work (no CI automation per DEC-11, no multi-tenant registry, no distributed test runner).
- No simulated or narrative pass claims.

## Pinned Sources and Patterns to Mirror

`SCRATCH` denotes /private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode; `BUNDLE` denotes $SCRATCH/e2e-v2-prd-r1/bundle/ecc-opl-e2e-v2.0-prd-r1-external-review; `PW_DIR` denotes $SCRATCH/m6-playwright; `HOME_FIXTURE` denotes $SCRATCH/m6-home-fixture.

| Source | Pinned Digest / Path | Role & Invariants |
|---|---|---|
| `BUNDLE/PRD-CANDIDATE.md` | `047918df0835bc7ea52f0d0dc7714f0b29394cce32ad8c2580b2973dfce1d211` | Approved PRD specification (§4, §6, §7, §8 Milestone 6, §9, §11). |
| `.claude/prds/e2e-v2-0-unified-journey-mapping.prd.md` | `bbe563be553147e4ff348622e54a75689db209bd798e85f85a97d739895191a9` | Worktree annotated PRD copy (distinct from R1 candidate). |
| `BUNDLE/SHA256-MANIFEST.json` | `6cf52ecd57a537578d0caf444b2bf0e914aae96c93e77a9c89e33c4d48083747` | Canonical bundle manifest. |
| `BUNDLE/ACCEPTANCE-MATRIX.csv` | `400d3fcc22c48fb75f85ee22aeb0de23d0d0bbcf9dd776ae33aeb2ec88789caf` | Complete 48 scenarios (A01–A08, B01–B12, C01–C12, D01–D10, E01–E06). |
| `BUNDLE/NEGATIVE-MUTATION-PLAN.md` | Canonical bundle mutation plan | 14 negative mutations specification and expected oracle failure modes. |
| `docs/e2e-v2/decisions/DECISION-REGISTER.md` | `cd848701e25fddf6ab33c5853a2bd93a791e0786b225dc8534be912c4c03d223` | Canonical approved decisions DEC-01 through DEC-12. |
| `docs/e2e-v2/decisions/MILESTONE-GATES.json` | `00c6b4550a130fcec4e20abda25919b9a08fe4b493b9439687865d70d017c8e5` | Policy-only authorization; technical validation gates ASM-01/02 NOT_VERIFIED. |
| `$SCRATCH/m3m5m6-proposals/M6-ENV-AUTHORIZATION-PROPOSAL.md` | `bc7b6afae7aa3178df78b109f31fe69e6ca222be5208fe70dabd31d601989cf4` | Approved target environment specification: `E2E_NONPROD_LOCAL_FIXTURE`, loopback only. |
| `.opencode/commands/e2e.md` | `c562e0a2a2707c49362431b04ac1895f02c091e3d7ae193837ab6bf35b9d8436` | Active unified command definition. Read-only; do not edit. |
| `.opencode/commands/e2e-map.md` | `76b3d4037a0144df2d40dc0eca01777690762a7cccc5d9562b0330333dfdb142` | Active legacy command definition. Read-only; do not edit. |
| `.opencode/opencode.json` | `01e3d4405c4351cde1460e782da9aa80f0aa6a6796bc3bb149be1b12bcc63e84` | Project configuration file. Read-only; do not edit. |
| `~/.config/opencode/opencode.json` | `bd747d4f42d22e7c0dc1f14b65e815b043117083fd548292489509c653e26843` | Global configuration file (mirrored into isolated fixture). Read-only; do not edit. |
| `HOME_FIXTURE/.config/opencode/opencode.jsonc` | `85378ac09a398760fccae61499ab3bd5207713d3ba214b71c92e5acf52071dbf` | Isolated fixture global config (copied from backup `~/.config/opencode/opencode.jsonc.bak-freeai-add-6-20261123`). Pinned provenance for isolated HOME fixture. |
| `~/.config/opencode/opencode.jsonc` (Active global config) | **Not pinned.** `owner_config_drift.observed_sha256` is computed at report-generation time from the active file | Read-only observational record only; value is never compared to a constant, never used as a pass/fail criterion; zero modification/restoration performed. |
| `docs/e2e-v2/m1/**` | 16 files, tree hash `8416c0671af8ae60850d9d72f249968976c907cf4aa62b605d663bd5eb1625ca` | Frozen M1 baseline. Must remain byte-identical. |
| `docs/e2e-v2/m2/**` | 27 files, tree hash `2f81da73f2068357f4265a3cfbaf6a9435a3e502d52dcd32d33b3b445fc97588` | Frozen M2 baseline. Must remain byte-identical. |
| `docs/e2e-v2/m3/**` | 17 files, tree hash `2e8c7cf63a44b3d073185be0a4fe59de87fd9583ffc79abc6066b151066e23c7` | Frozen M3 baseline. Must remain byte-identical. |
| `docs/e2e-v2/m4/**` | 20 files, tree hash `88c50d13760dd24dd47b9e5f2a2d8aa707b0f008abcf19b06fa7370641bc7807` | Frozen M4 baseline. Must remain byte-identical. |
| `docs/e2e-v2/m5/**` | 23 files, tree hash `267c3b8bce980c97cadfc54b815fb79190d9a8f9f6951cb29ae92839dbf7b014` | Frozen M5 baseline. Must remain byte-identical. |
| `docs/e2e-v2/contracts/**` | 3 files, tree hash `a550f29ea751c7635cdc5d73bbc2e6a0a29d7cdf7153e43f23e429a4f4e05e8c` | Frozen contracts. Must remain byte-identical. |
| `PW_DIR` (Playwright 1.65.1) | Scratch directory with Chromium 1255 | Authorized scratch execution engine; browser path in `pw-browsers/`. |

## Architecture Changes

All new deliverables are confined strictly to `docs/e2e-v2/m6/**`:

- **New reference & execution modules:**
  - `docs/e2e-v2/m6/tests/acceptance-ledger.mjs`: Aggregates and validates the full 48-scenario acceptance ledger, maps requirements, checks fixture provenance, and enforces status honesty.
  - `docs/e2e-v2/m6/tests/mutation-suite.mjs`: Implements carriers and independent detection oracles for all 14 negative mutations.
  - `docs/e2e-v2/m6/tests/scratch-runner.mjs`: Invokes Playwright 1.65.1 from scratch against local loopback HTTP fixture, evaluates assertions, captures artifacts, and redacts credentials.
  - `docs/e2e-v2/m6/tests/fixtures.mjs`: Synthetic and loopback HTML fixtures, benchmark stack mappings, and ephemeral HTTP server management.
- **New test suites:**
  - `docs/e2e-v2/m6/tests/m6.test.mjs`: Complete test suite validating 48 scenarios, 14 mutations, scratch Playwright runs, and gate policies.
  - `docs/e2e-v2/m6/tests/conformance.test.mjs`: Static conformance checks for frozen baselines M1–M5, command preimages, absent registry files, and write boundaries.
- **New deterministic report generator:**
  - `docs/e2e-v2/m6/scripts/emit-m6-reports.mjs`: Deterministic emitter generating all 10 M6 reports under CLI execution; pure function import does not write.
- **New reports under `docs/e2e-v2/m6/reports/` (10 total):**
  1. `m6-preflight.report.json`: Source pins, isolated HOME fixture verification, frozen tree hashes (M1–M5 + contracts), absent registry verification, and read-only `owner-config-drift` record (`owner_config_drift.observed_sha256 = sha256(read(activeJsonc))` computed at report-generation time, excluded from pass/fail and never compared against any pinned or historical constant).
  2. `acceptance-ledger.json`: Comprehensive audit ledger of all 48 scenarios (A01–E06) with statuses, methods, fixtures, and artifact hashes.
  3. `mutation-suite.report.json`: Execution results of all 14 negative mutations, expected vs observed bypass, oracle verdict (all 14 DETECTED).
  4. `playwright-execution.report.json`: Scratch Playwright runs against local loopback fixture, actual exit codes, timing, and artifact references.
  5. `env-boundary.report.json`: Verification that non-prod local fixture ran, production target was blocked, zero real credentials used.
  6. `parity-audit.report.json`: Consolidated parity audit over benchmark stacks F01–F06 and collision fixture F13.
  7. `m6-decision-packet.json`: Gate P1–P5 evaluation; P1 NOT_VERIFIED, P5 NOT_GIVEN; live disablement BLOCKED_DEPLOYMENT_GATED.
  8. `prompt-conformance.report.json`: Static immutability verification of active commands and config files, plus read-only observational record of owner-authorized config drift.
  9. `coverage.report.json`: Line, branch, and function coverage report (≥80% on each module).
  10. `scope-check.report.json`: Filesystem write boundary audit confirming zero outside writes.
- **New documentation & tracking:**
  - `docs/e2e-v2/m6/tdd-record.md`: TDD log tracking RED, GREEN, and REFACTOR stages with exact command outputs.
  - `docs/e2e-v2/m6/traceability-m6.md`: Complete traceability matrix mapping all 27 PRD requirements, 20+ ACs, 48 scenarios, and 14 mutations.

## Reference Contract & Invariants to Implement

### 1. 48-Scenario Acceptance Ledger Contract (AC-021 / A01–E06)
- **Unified Schema:** Each of the 48 entries in `acceptance-ledger.json` must contain:
  - `scenario_id`: Exact ID (A01–A08, B01–B12, C01–C12, D01–D10, E01–E06).
  - `group`: Interface, Mapping, Execution, Security, Migration, or Release.
  - `stimulus`: Exact stimulus string from `ACCEPTANCE-MATRIX.csv`.
  - `expected`: Expected behavior string.
  - `status`: Honest terminal status (`PASS`, `REFERENCE_VERIFIED`, `NOT_RUN`, or `BLOCKED`).
  - `execution_method`: `scratch_playwright_local`, `deterministic_harness`, `static_contract`, or `deferred_live_session`.
  - `fixture_ids`: Array of referenced fixtures (e.g. F01, F07, F10, F12, F13, F14).
  - `evidence_artifact`: Repo-relative path to evidence file.
  - `evidence_sha256`: SHA-256 hash of the generated evidence file.
  - `requirement_ids`: Array of mapped PRD requirements (e.g. E2E-FR-001).
  - `prd_ac`: Primary mapped acceptance criterion (e.g. AC-001..AC-020).
- **Status Classification Rules:**
  - `PASS` is granted **only** where actual execution took place:
    - Scratch Playwright executed on local HTTP loopback fixture (C04, C05, C06, C07, C10).
    - Real environment boundary enforcement blocking production targets (D02).
    - Cryptographic verification of frozen workflow hashes (D05).
    - Complete bundle schema validation (E01).
    - Complete 14-mutation detection execution (E02).
    - Unit-style focused tests execution (E03).
    - Complete write boundary audit (E04).
    - Manifest and before/after hash verification (E05).
    - Release gate policy verification (E06).
  - `REFERENCE_VERIFIED` is granted for scenarios proven via deterministic Node.js test harness over synthetic fixtures without live model invocation (A01–A07, B01–B12, C01–C03, C08, C09, C11, C12, D01, D03, D04, D06–D10).
  - `NOT_RUN` is assigned to A08 (live multi-phase model orchestration session) where live interactive LLM chat is not executed in unattended test runs.

### 2. Complete 14 Negative Mutation Suite Contract (AC-022 / E02)
All 14 negative mutations from `NEGATIVE-MUTATION-PLAN.md` must be modeled with executable carrier/oracle pairs in `mutation-suite.mjs`:
1. **Mutation 1 (Map triggers runner):** Carrier forces runner dispatch during `map` phase. Oracle asserts `runnerInvocations === 0`; flags `DETECTED`.
2. **Mutation 2 (Status writes TESTS.md):** Carrier attempts file write during `status` phase. Oracle asserts `registryWrites === 0`; flags `DETECTED`.
3. **Mutation 3 (Bare /e2e starts browser):** Carrier triggers browser launch on bare `/e2e`. Oracle asserts `browserInvocations === 0`; flags `DETECTED`.
4. **Mutation 4 (Unregistered run executes):** Carrier runs unregistered flow without `--ad-hoc`. Oracle asserts `outcome === 'REGISTRY_REQUIRED'`; flags `DETECTED`.
5. **Mutation 5 (Ad-hoc PASS sets covered):** Carrier sets `State: covered` for ad-hoc run. Oracle asserts `state !== 'covered'` and `registryWrites === 0`; flags `DETECTED`.
6. **Mutation 6 (Duplicate TEST-ID update proceeds):** Carrier injects duplicate ID in proposed update. Oracle asserts update rejected with `DUPLICATE_ID_REJECTED`; flags `DETECTED`.
7. **Mutation 7 (Path traversal / symlink escape):** Carrier provides `../../TESTS.md` or symlink escape. Oracle asserts path rejected with `PATH_REJECTED` / `SYMLINK_ESCAPE`; flags `DETECTED`.
8. **Mutation 8 (State: stale accepted as enum):** Carrier validates registry with `State: stale`. Oracle asserts schema error with `INVALID_REGISTRY_STATE`; flags `DETECTED`.
9. **Mutation 9 (Shell injection in Command executed):** Carrier passes raw shell characters in Command field to shell execution. Oracle asserts command treated as data only, `shellInvocations === 0`; flags `DETECTED`.
10. **Mutation 10 (Exit 0 with only visibility assertions sets covered):** Carrier treats visibility-only exit 0 test as covered. Oracle evaluates assertion quality and enforces `PASS_UNVERIFIED`; flags `DETECTED` (proven in M4).
11. **Mutation 11 (Skipped/zero tests produce covered):** Carrier marks skipped test as covered; Oracle asserts `testCountGate` enforces `NOT_EXECUTED` / `UNVERIFIED`; flags `DETECTED`.
12. **Mutation 12 (Unknown/production target executes without approval):** Carrier targets production URL without approval token. Oracle asserts target blocked with `BLOCKED_PRODUCTION_TARGET`; flags `DETECTED` (proven in M4).
13. **Mutation 13 (Concurrent TESTS.md edit overwritten):** Carrier bypasses hash check during concurrent edit. Oracle asserts `WRITE_CONFLICT` and prevents overwrite; flags `DETECTED` (proven in M5).
14. **Mutation 14 (Premature /e2e-map disablement):** Carrier disables `/e2e-map` before parity or with P1/P5 unverified. Oracle asserts migration gate blocks with `BLOCKED_PREMATURE_DISABLE`; flags `DETECTED` (proven in M5).

All 14 mutations must yield `detected: true`, resulting in a 14/14 pass rate recorded in `mutation-suite.report.json`.

### 3. Scratch Playwright Loopback Execution Contract (DEC-07 / DEC-08 / C04 / C05 / C06 / C07 / C10)
- **Execution Target:** Strictly `E2E_NONPROD_LOCAL_FIXTURE` on ephemeral localhost port (e.g. 127.0.0.1:0 assigned by Node `http.createServer`).
- **No Package Changes:** Uses only the pre-existing, owner-authorized Playwright 1.65.1 + Chromium installed in `/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright`.
- **Environment Isolation:** Executes with `PLAYWRIGHT_BROWSERS_PATH=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright/pw-browsers` and temporary output directory inside scratch.
- **Scenarios Exercised Live:**
  - C04 (Happy path): Valid journey flow executed; strong assertion passes; exit code 0; browser screenshot and trace captured in scratch; evidence hashed.
  - C05 (Weak assertion): Test passes with only `toBeVisible` / visibility check; evaluator assigns `PASS_UNVERIFIED`, denying covered status.
  - C06 (Failing run): Nonzero exit code or assertion failure observed; evaluator assigns `FAIL` and proposes downgrading previously covered entry.
  - C07 (Skipped run): Playwright test suite with `test.skip()` or 0 assertions; evaluator assigns `NOT_EXECUTED` / `UNVERIFIED`.
  - C10 (Artifact redaction): Synthetic sensitive tokens (e.g. `sk-ant-api03-test-token-secret`) injected into page text or network requests; verified that emitted artifacts and evidence JSON redact tokens to `[REDACTED]`.

### 4. Gate P1–P5 Evaluation & Decision Packet Contract (DEC-10)
- Gate P1 (Effective Resolution): Remains strictly `NOT_VERIFIED` (ASM-01 was inconclusive in M2; effective winner is not assumed).
- Gate P2 (Parity): Verified in M5 and re-verified in M6 across all 7 benchmark stacks (F01–F06 + F13).
- Gate P3 (Registry Safety): Verified in M3/M5 and re-verified in M6 (field-scoped updates, conflict detection, DEC-04 deprecation hint).
- Gate P4 (Rollback Readiness): Verified in M5 and re-verified in M6 (5-file byte-exact rehearsal in 0700 scratch).
- Gate P5 (Owner Deployment Authorization): Remains strictly `NOT_GIVEN` (pending explicit out-of-band owner instruction naming `/e2e-map`).
- Overall Deployment Status: Strictly `BLOCKED_DEPLOYMENT_GATED`. Live disablement of `/e2e-map` is refused. Emit `docs/e2e-v2/m6/reports/m6-decision-packet.json` detailing the exact remaining owner requirements.

## Implementation Phases

All QA validation commands below are specified for a separately authorized worker session and adhere to `skills/tdd-workflow/SKILL.md`. All temporary fixtures are allocated under `/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode` and cleaned up by their creating test via literal-path removal.

### Phase 0 — Preflight, Pinning & Frozen Baseline Verification

1. **Phase 0 environment isolation, preflight pinning, and frozen baseline verification**  
   (Files: `docs/e2e-v2/m6/reports/m6-preflight.report.json`, `docs/e2e-v2/m6/tdd-record.md`)
   - Action:
     - **Environment Isolation (Scratch HOME Fixture):** Create scratch HOME fixture directory at `$SCRATCH/m6-home-fixture/.config/opencode/`. Populate it with copies of the pinned global configuration files:
       - Copy `opencode.jsonc` from backup `~/.config/opencode/opencode.jsonc.bak-freeai-add-6-20261123` (pinned provenance `85378ac09a398760fccae61499ab3bd5207713d3ba214b71c92e5acf52071dbf`).
       - Copy `opencode.json` from `~/.config/opencode/opencode.json` (pinned hash `bd747d4f42d22e7c0dc1f14b65e815b043117083fd548292489509c653e26843`).
       Verify their hashes in `$SCRATCH/m6-home-fixture/.config/opencode/`.
     - **Read-Only Owner Config Drift Record:** At report-generation time, read active `~/.config/opencode/opencode.jsonc` and compute its SHA-256. Store the result as `owner_config_drift.observed_sha256` in `m6-preflight.report.json`. The value MUST be the hash observed during that same run; it MUST NOT be copied from any constant in this plan, compared to any pinned/historical value, or used as a pass/fail criterion. Record that the drift is owner-authorized (owner changed the default model) and that no restoration or modification of active configuration was performed. A historical planning-time observation may be mentioned only as non-normative context, never as required report content.
     - **Preflight Pinning Verification:** Running strictly with `HOME=$SCRATCH/m6-home-fixture` and `PLAYWRIGHT_BROWSERS_PATH=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright/pw-browsers`:
       - Using read-only standard-library hashing (`node:crypto` / `shasum -a 256`), verify all source pins listed in the Pinned Sources table.
       - Verify that scratch Playwright 1.65.1 and Chromium browser exist under `/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright`.
       - Verify that `TESTS.md` and `.governance/docs-map.json` are absent in the repository.
       - Verify target command preimages (`.opencode/commands/e2e.md`, `.opencode/commands/e2e-map.md`), project config (`.opencode/opencode.json`), and fixture global configs in `$SCRATCH/m6-home-fixture/.config/opencode/`.
       - Recompute frozen tree manifests for M1, M2, M3, M4, M5, and contracts using canonical sorted `path<TAB>sha256<LF>` encoding:
         - `docs/e2e-v2/m1` (16 files): `8416c0671af8ae60850d9d72f249968976c907cf4aa62b605d663bd5eb1625ca`
         - `docs/e2e-v2/m2` (27 files): `2f81da73f2068357f4265a3cfbaf6a9435a3e502d52dcd32d33b3b445fc97588`
         - `docs/e2e-v2/m3` (17 files): `2e8c7cf63a44b3d073185be0a4fe59de87fd9583ffc79abc6066b151066e23c7`
         - `docs/e2e-v2/m4` (20 files): `88c50d13760dd24dd47b9e5f2a2d8aa707b0f008abcf19b06fa7370641bc7807`
         - `docs/e2e-v2/m5` (23 files): `267c3b8bce980c97cadfc54b815fb79190d9a8f9f6951cb29ae92839dbf7b014`
         - `docs/e2e-v2/contracts` (3 files): `a550f29ea751c7635cdc5d73bbc2e6a0a29d7cdf7153e43f23e429a4f4e05e8c`
     Record all observed hashes and the owner-config-drift record in `docs/e2e-v2/m6/reports/m6-preflight.report.json` and initialize `docs/e2e-v2/m6/tdd-record.md`.
   - Why: Halts execution immediately if any upstream contract or prior milestone deliverable has drifted, or if scratch Playwright is missing, while isolating global configuration pins from owner-authorized host drift.
   - Closes: Preparatory baseline safety and environment isolation.
   - References: `docs/e2e-v2/m5/reports/m5-preflight.report.json`, `docs/e2e-v2/decisions/DECISION-REGISTER.md`.
   - Acceptance: Pinned hashes match fixture; tree manifests match expected hashes; registry files absent; scratch Playwright validated; preflight report passes with owner drift recorded observationally. `owner_config_drift.observed_sha256` MUST equal a SHA-256 independently computed from the active `~/.config/opencode/opencode.jsonc` during the same report-generation run, MUST be a valid 64-character lowercase hex string, and MUST NOT be compared to any pinned or historical constant.
   - QA: Happy path — after the preflight report is generated, run `HOME=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-home-fixture PLAYWRIGHT_BROWSERS_PATH=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright/pw-browsers ACTIVE_JSONC=/Users/ctp-itdev2/.config/opencode/opencode.jsonc node -e "const crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'); const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); assert.equal(sha('.claude/prds/e2e-v2-0-unified-journey-mapping.prd.md'), 'bbe563be553147e4ff348622e54a75689db209bd798e85f85a97d739895191a9'); assert.equal(sha('.opencode/commands/e2e.md'), 'c562e0a2a2707c49362431b04ac1895f02c091e3d7ae193837ab6bf35b9d8436'); assert.equal(sha('.opencode/commands/e2e-map.md'), '76b3d4037a0144df2d40dc0eca01777690762a7cccc5d9562b0330333dfdb142'); assert.ok(!fs.existsSync('TESTS.md'), 'TESTS.md must be absent'); assert.ok(!fs.existsSync('.governance/docs-map.json'), 'docs-map.json must be absent'); assert.ok(fs.existsSync('/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright/node_modules/playwright'), 'scratch playwright must exist'); const h = process.env.HOME; assert.equal(sha(path.join(h, '.config/opencode/opencode.json')), 'bd747d4f42d22e7c0dc1f14b65e815b043117083fd548292489509c653e26843'); assert.equal(sha(path.join(h, '.config/opencode/opencode.jsonc')), '85378ac09a398760fccae61499ab3bd5207713d3ba214b71c92e5acf52071dbf'); const report = JSON.parse(fs.readFileSync('docs/e2e-v2/m6/reports/m6-preflight.report.json', 'utf8')); const observed = sha(process.env.ACTIVE_JSONC); assert.match(report.owner_config_drift.observed_sha256, /^[0-9a-f]{64}$/); assert.equal(report.owner_config_drift.observed_sha256, observed); assert.equal(report.owner_config_drift.affects_pass_fail, false); assert.equal(report.status, 'PASS'); console.log('PREFLIGHT_PINS_AND_RUNTIME_DRIFT_OK');"` exits 0. This independently computes the active JSONC hash in the same run, verifies the report contains that fresh lowercase 64-character SHA-256, and verifies the observational field does not affect `status: PASS`; it never compares the active hash to a pinned constant and performs no active-file write or restoration. Failure path — Any fixture-pin mismatch, malformed or stale observational hash, pass/fail coupling, or missing dependency raises an AssertionError and immediately halts the run.
   - Dependencies: Owner execution authorization. Complexity: Medium. Risk: Low.

### Phase 1 — TDD RED Gate: Scratch Fixtures, Loopback Server & Failing M6 Suite

2. **Implement test fixtures, loopback server helper, and author failing RED test suite**  
   (Files: `docs/e2e-v2/m6/tests/fixtures.mjs`, `docs/e2e-v2/m6/tests/m6.test.mjs`, `docs/e2e-v2/m6/tdd-record.md`)
   - Action:
     - In `fixtures.mjs`:
       - Define synthetic HTML pages for local loopback serving: a happy path form page, a visibility-only weak assertion page, an intentionally broken page, and a page with synthetic sensitive credentials (`sk-ant-api03-test-token-secret`).
       - Implement `startLoopbackServer()`: Starts an ephemeral Node.js `http.createServer` on localhost port 0 (dynamic port), returns URL and a clean `close()` function.
       - Define benchmark stack fixtures F01–F06 and F13/F14 route descriptors for parity verification.
       - Define the 48-scenario metadata mapping from `ACCEPTANCE-MATRIX.csv`.
     - In `m6.test.mjs`, author the complete test suite asserting all required M6 behaviors across seven distinct test groups:
       1. Group 1 (AC-021 / Scenarios A01–A08): Interface mode validation, help listing, map preview, status readonly, resolver exact/ambiguous, fail-closed args, and A08 full trace.
       2. Group 2 (AC-019 / Scenarios B01–B12): Route detection across stacks F01–F06, locale dedup, journey grouping, registry bootstrap proposal, block preservation, idempotence, State: stale schema separation, path traversal rejection, and concurrency conflict.
       3. Group 3 (AC-014 / AC-018 / Scenarios C01–C12): Execution handoff, unregistered rejection, ad-hoc execution, scratch Playwright loopback execution (C04), weak assertion check (C05), failure downgrade (C06), skipped test handling (C07), blocked dependency (C08), flakiness isolation (C09), artifact redaction (C10), command shell injection safety (C11), and field-scoped updates (C12).
       4. Group 4 (Scenarios D01–D10): Security and migration verifications: prompt injection safety (D01), environment gating blocking production (D02), high-risk approval (D03), symlink escape rejection (D04), frozen workflow hashes (D05), differential parity over F01–F06+F13 (D06), legacy alias deprecation hint (D07), post-migration discovery in disposable HOME (D08), legacy ID readability (D09), and 5-file rollback rehearsal (D10).
       5. Group 5 (Scenarios E01–E06): Release gates: bundle scenario IDs present once (E01), 14 negative mutations detected (E02), focused tests (E03), scope check (E04), before/after SHA hashes (E05), and release gate evaluation (E06).
       6. Group 6 (AC-022 / Negative Mutation Suite): Direct execution of all 14 negative mutations via their carrier/oracle pairs, asserting `detected === true` for every mutation.
       7. Group 7 (DEC-10 Honesty & Gate Packet): Evaluation of Gates P1–P5 asserting live disablement is `BLOCKED_DEPLOYMENT_GATED` and generating `m6-decision-packet.json`.
     - Execute `HOME=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-home-fixture TMPDIR=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode PLAYWRIGHT_BROWSERS_PATH=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright/pw-browsers node --test docs/e2e-v2/m6/tests/m6.test.mjs` before implementing modules.
     - Confirm runtime RED state: tests fail specifically due to missing exports in `acceptance-ledger.mjs`, `mutation-suite.mjs`, and `scratch-runner.mjs`. Record the exact RED failure command and output excerpt in `docs/e2e-v2/m6/tdd-record.md`.
   - Why: Strict TDD gate requires executing failing tests that prove missing functionality before creating any implementation code.
   - Closes: GAP-1 through GAP-6.
   - References: `skills/tdd-workflow/SKILL.md`, `docs/e2e-v2/m5/tests/m5.test.mjs`, `BUNDLE/ACCEPTANCE-MATRIX.csv`.
   - Acceptance: Test suite compiles and executes; fails with expected missing-module or missing-export assertions; failure recorded in TDD log.
   - QA: Happy path — `HOME=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-home-fixture TMPDIR=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode PLAYWRIGHT_BROWSERS_PATH=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright/pw-browsers node --test docs/e2e-v2/m6/tests/m6.test.mjs` fails with expected missing module/export errors. Failure path — If tests pass prematurely or fail due to harness errors, halt and correct test definitions.
   - Dependencies: Step 1. Complexity: High. Risk: Medium.

### Phase 2 — Implementation & Execution: Acceptance Ledger, Mutation Suite & Scratch Runner (GREEN)

3. **Implement 14 negative mutation carriers and independent detection oracles**  
   (Files: `docs/e2e-v2/m6/tests/mutation-suite.mjs`, `docs/e2e-v2/m6/tdd-record.md`)
   - Action:
     - In `mutation-suite.mjs`, implement carrier and oracle pairs for all 14 negative mutations:
       - Carrier 1 & Oracle 1: Map runner bypass → Carrier forces dispatch; Oracle checks `runnerInvocations === 0`, flags `observedDispatch: true` → `detected: true`.
       - Carrier 2 & Oracle 2: Status write bypass → Carrier writes file; Oracle checks `registryWrites === 0`, flags `observedWrite: true` → `detected: true`.
       - Carrier 3 & Oracle 3: Bare browser bypass → Carrier triggers browser; Oracle checks `browserInvocations === 0`, flags `observedBrowser: true` → `detected: true`.
       - Carrier 4 & Oracle 4: Unregistered run bypass → Carrier executes without registry entry; Oracle checks `outcome === 'REGISTRY_REQUIRED'`, flags `observedUnregisteredExec: true` → `detected: true`.
       - Carrier 5 & Oracle 5: Ad-hoc covered bypass → Carrier marks ad-hoc run as covered; Oracle checks `state !== 'covered'`, flags `observedCovered: true` → `detected: true`.
       - Carrier 6 & Oracle 6: Duplicate ID bypass → Carrier permits duplicate TEST-E2E ID; Oracle checks ID collision rejection, flags `observedDuplicate: true` → `detected: true`.
       - Carrier 7 & Oracle 7: Path traversal bypass → Carrier permits `../../` or symlink escape; Oracle checks path containment, flags `observedEscape: true` → `detected: true`.
       - Carrier 8 & Oracle 8: State: stale enum bypass → Carrier accepts `stale` as State; Oracle checks schema validity, flags `observedInvalidState: true` → `detected: true`.
       - Carrier 9 & Oracle 9: Shell injection in Command bypass → Carrier passes Command text to child_process; Oracle checks shell invocation, flags `observedShellExec: true` → `detected: true`.
       - Carrier 10 & Oracle 10: Weak assertion bypass → Carrier assigns covered to visibility-only test; Oracle evaluates assertions, enforces `PASS_UNVERIFIED`, flags `observedCovered: true` → `detected: true` (ported from M4).
       - Carrier 11 & Oracle 11: Skipped/zero test bypass → Carrier marks skipped test as covered; Oracle enforces `NOT_EXECUTED` / `UNVERIFIED`, flags `observedCovered: true` → `detected: true`.
       - Carrier 12 & Oracle 12: Production target bypass → Carrier targets production without authorization; Oracle enforces `BLOCKED_PRODUCTION_TARGET`, flags `observedSpawn: true` → `detected: true` (ported from M4).
       - Carrier 13 & Oracle 13: Concurrency overwrite bypass → Carrier skips hash check and overwrites; Oracle detects hash mismatch and clobber, flags `observedClobber: true` → `detected: true` (ported from M5).
       - Carrier 14 & Oracle 14: Premature disable-default bypass → Carrier disables `/e2e-map` before parity/P1/P5; Oracle detects missing gate, enforces `BLOCKED_PREMATURE_DISABLE`, flags `observedDisable: true` → `detected: true` (ported from M5).
     - Implement `runFullMutationSuite()`: Executes all 14 carriers and oracles; verifies that every mutation yields `detected: true`; returns structured summary object with total 14, detected 14, bypassed 0.
   - Why: Satisfies AC-022 and PRD §7/§8 by guaranteeing behavioral safety gates cannot be bypassed.
   - Closes: GAP-2.
   - References: `BUNDLE/NEGATIVE-MUTATION-PLAN.md`, `docs/e2e-v2/m4/tests/runner.mjs`, `docs/e2e-v2/m5/tests/migration.mjs`.
   - Acceptance: Group 6 tests pass; all 14 mutations return `detected: true`; zero undetected bypasses.
   - QA: Happy path — `HOME=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-home-fixture TMPDIR=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode PLAYWRIGHT_BROWSERS_PATH=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright/pw-browsers node --test --test-name-pattern="Mutation" docs/e2e-v2/m6/tests/m6.test.mjs` passes with 14/14 detected. Failure path — Any unintercepted carrier bypass causes test failure.
   - Dependencies: Step 2 RED. Complexity: High. Risk: Low.

4. **Implement scratch Playwright runner bridge and 48-scenario acceptance ledger**  
   (Files: `docs/e2e-v2/m6/tests/scratch-runner.mjs`, `docs/e2e-v2/m6/tests/acceptance-ledger.mjs`, `docs/e2e-v2/m6/tdd-record.md`)
   - Action:
     - In `scratch-runner.mjs`:
       - Implement `executeScratchPlaywright({ testSpec, targetUrl, scratchDir })`:
         - Sets environment `PLAYWRIGHT_BROWSERS_PATH=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright/pw-browsers`.
         - Resolves Playwright module from `/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright/node_modules/playwright`.
         - Spawns Chromium headless against the local loopback `targetUrl`.
         - Executes test actions (navigation, form input, click, assertions).
         - Captures screenshot into `scratchDir/artifacts/screenshot.png` and trace to `scratchDir/artifacts/trace.zip`.
         - Computes SHA-256 of artifacts and redacts credentials matching regex patterns (e.g. `sk-[a-zA-Z0-9-]+` → `[REDACTED]`).
         - Returns structured execution record: `status: 'PASS' | 'FAIL'`, `exitCode`, `durationMs`, `nodeId`, `artifacts`, `redactionsCount`.
       - Implement test-quality evaluator:
         - Inspects assertion types in the spec: if only visibility assertions present, returns `PASS_UNVERIFIED`.
         - If skipped or 0 assertions, returns `NOT_EXECUTED` / `UNVERIFIED`.
         - If non-zero exit, returns `FAIL`.
         - If behavioral assertion (state transition, text match, submission confirmation) passes with exit 0, returns `PASS`.
     - In `acceptance-ledger.mjs`:
       - Implement `buildAcceptanceLedger({ matrixPath, executionResults })`:
         - Parses `ACCEPTANCE-MATRIX.csv` (48 rows).
         - Evaluates each scenario against either real scratch execution (C04, C05, C06, C07, C10, D02, D05, E01–E06) or deterministic reference harness assertions (A01–A07, B01–B12, C01–C03, C08, C09, C11, C12, D01, D03, D04, D06–D10).
         - Assigns honest statuses: `PASS` (13 scenarios), `REFERENCE_VERIFIED` (34 scenarios), `NOT_RUN` (1 scenario: A08 live multi-phase model orchestration).
         - Resolves and attaches evidence artifact paths and computes their SHA-256 hashes.
         - Returns complete ledger structure.
       - Implement `evaluateM6Gates()`: Evaluates Gates P1–P5; asserts live disablement remains `BLOCKED_DEPLOYMENT_GATED`.
     - Re-run full test suite: `HOME=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-home-fixture TMPDIR=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode PLAYWRIGHT_BROWSERS_PATH=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright/pw-browsers node --test docs/e2e-v2/m6/tests/m6.test.mjs`.
     - Verify all test groups pass (GREEN). Record command and output excerpt in `docs/e2e-v2/m6/tdd-record.md`.
   - Why: Satisfies AC-014, AC-018, AC-021, DEC-07, DEC-08, and PRD §8 by uniting real Playwright loopback execution and deterministic reference verification into an auditable ledger.
   - Closes: GAP-1, GAP-3, GAP-4, GAP-5.
   - References: `BUNDLE/ACCEPTANCE-MATRIX.csv`, `docs/e2e-v2/m4/tests/runner.mjs`, `docs/e2e-v2/m5/tests/migration.mjs`.
   - Acceptance: All 48 scenarios mapped and evaluated; scratch Playwright loopback runs pass; honest status taxonomy verified; all tests green.
   - QA: Happy path — `HOME=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-home-fixture TMPDIR=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode PLAYWRIGHT_BROWSERS_PATH=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright/pw-browsers node --test docs/e2e-v2/m6/tests/m6.test.mjs` exits 0 with all test groups passing. Failure path — If any scenario is missing, has an unapproved status, or Playwright fails to launch, tests fail immediately.
   - Dependencies: Steps 2 & 3. Complexity: High. Risk: Medium.

### Phase 3 — Deterministic Report Emitter & Evidence Emission

5. **Implement evidence emitter and generate M6 scenario reports and acceptance ledger**  
   (Files: `docs/e2e-v2/m6/scripts/emit-m6-reports.mjs`, `docs/e2e-v2/m6/reports/*.json`)
   - Action:
     - In `emit-m6-reports.mjs`, mirror the pattern of M3, M4, and M5 report emitters: CLI main guard executes harness logic, manages ephemeral loopback server, invokes scratch Playwright, runs mutation suite, and writes exactly the 10 required report files to `docs/e2e-v2/m6/reports/`. Importing the module does not perform file writes.
     - Generate all 10 required reports:
       1. `m6-preflight.report.json`: Source pins, isolated HOME fixture verification, frozen tree hashes (M1–M5 + contracts), absent registry verification, and read-only `owner-config-drift` record (`owner_config_drift.observed_sha256 = sha256(read(activeJsonc))` computed at report-generation time, excluded from pass/fail and never compared against any pinned or historical constant).
       2. `acceptance-ledger.json`: Full 48-scenario audit ledger (A01–E06) with statuses, methods, fixtures, and artifact hashes.
       3. `mutation-suite.report.json`: 14 negative mutations execution results, expected vs observed bypass, oracle verdict (14/14 DETECTED).
       4. `playwright-execution.report.json`: Scratch Playwright runs against local loopback fixture, actual exit codes, timing, and artifact references.
       5. `env-boundary.report.json`: Verification that non-prod local fixture ran, production target was blocked, zero real credentials used.
       6. `parity-audit.report.json`: Consolidated parity audit over benchmark stacks F01–F06 and collision fixture F13.
       7. `m6-decision-packet.json`: Gate P1–P5 evaluation; P1 NOT_VERIFIED, P5 NOT_GIVEN; live disablement BLOCKED_DEPLOYMENT_GATED.
       8. `prompt-conformance.report.json`: Static immutability verification of active commands and config files, plus read-only observational record of owner-authorized config drift.
       9. `coverage.report.json`: Line, branch, and function coverage report (≥80% on each module).
       10. `scope-check.report.json`: Filesystem write boundary audit confirming zero outside writes.
     - Add assertion tests in `m6.test.mjs` validating that every emitted report parses as valid JSON, identifies its scenario IDs, carries appropriate status labels, and records `registry_writes: 0`.
   - Why: Provides complete, auditable, machine-readable evidence for all M6 acceptance criteria and the final V2.0 acceptance release.
   - Closes: GAP-1..GAP-6 (evidence artifacts).
   - References: `docs/e2e-v2/m5/scripts/emit-m5-reports.mjs`, `docs/e2e-v2/m5/reports/*.json`.
   - Acceptance: `node docs/e2e-v2/m6/scripts/emit-m6-reports.mjs` executes cleanly; all 10 reports exist, parse as valid JSON, and pass schema assertions.
   - QA: Happy path — Emitter runs without errors; all 10 report files exist and pass validation tests. Failure path — Missing report or invalid JSON schema raises non-zero exit code.
   - Dependencies: Steps 3 & 4. Complexity: Medium. Risk: Low.

### Phase 4 — Conformance, Regression, Coverage & Scope Verification

6. **Static conformance, command integrity, and baseline immutability checks**  
   (Files: `docs/e2e-v2/m6/tests/conformance.test.mjs`, `docs/e2e-v2/m6/reports/prompt-conformance.report.json`)
   - Action:
     - In `conformance.test.mjs`, executed with `HOME=$SCRATCH/m6-home-fixture` and `PLAYWRIGHT_BROWSERS_PATH=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright/pw-browsers`, verify that:
       - `.opencode/commands/e2e.md` matches pinned preimage (`c562e0a2…`).
       - `.opencode/commands/e2e-map.md` matches pinned preimage (`76b3d403…`).
       - `.opencode/opencode.json` matches pinned preimage (`01e3d440…`).
       - Isolated HOME fixture `$HOME/.config/opencode/opencode.json` matches pinned preimage (`bd747d4f…`).
       - Isolated HOME fixture `$HOME/.config/opencode/opencode.jsonc` matches isolated fixture provenance (`85378ac0…`). M6 must never read the active global jsonc as a pass criterion.
       - Active global `~/.config/opencode/opencode.jsonc` drift is recorded at report-generation time as read-only `owner_config_drift.observed_sha256 = sha256(read(activeJsonc))`, explicitly noting owner-authorization and exclusion from pass/fail criteria; it is never compared against any pinned or historical constant, with zero modification or restoration performed.
       - `TESTS.md` and `.governance/docs-map.json` remain absent in the repository.
       - Frozen baselines M1 (16 files), M2 (27 files), M3 (17 files), M4 (20 files), M5 (23 files), and contracts (3 files) match their exact pinned SHA-256 hashes.
       - No files outside `docs/e2e-v2/m6/**` and approved scratch directories were modified or created.
     - Emit `docs/e2e-v2/m6/reports/prompt-conformance.report.json` with the observational `owner-config-drift` record.
   - Why: Verifies that M6 execution strictly respected all immutability and write boundary constraints without failing on owner-authorized configuration changes.
   - Closes: Non-regression and command stability.
   - References: `docs/e2e-v2/m5/tests/conformance.test.mjs`.
   - Acceptance: All conformance assertions pass under isolated HOME fixture; static checks confirm zero baseline mutations; active drift recorded observationally.
   - QA: Happy path — `HOME=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-home-fixture PLAYWRIGHT_BROWSERS_PATH=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright/pw-browsers node --test docs/e2e-v2/m6/tests/conformance.test.mjs` exits 0. Failure path — Any modified file or hash mismatch triggers immediate test failure.
   - Dependencies: Step 5. Complexity: Low. Risk: Low.

7. **Run regression suites, enforce coverage thresholds & emit scope check**  
   (Files: `docs/e2e-v2/m6/reports/coverage.report.json`, `docs/e2e-v2/m6/reports/scope-check.report.json`, `docs/e2e-v2/m6/tdd-record.md`)
   - Action:
     - Execute prior milestone test suites with `HOME=$SCRATCH/m6-home-fixture`, `TMPDIR=$SCRATCH`, and `PLAYWRIGHT_BROWSERS_PATH=$SCRATCH/m6-playwright/pw-browsers` to guarantee non-regression (isolating M5 conformance assertions from active global config drift):
       - `HOME=$SCRATCH/m6-home-fixture TMPDIR=$SCRATCH PLAYWRIGHT_BROWSERS_PATH=$SCRATCH/m6-playwright/pw-browsers node --test docs/e2e-v2/m5/tests/*.test.mjs`
       - `HOME=$SCRATCH/m6-home-fixture TMPDIR=$SCRATCH PLAYWRIGHT_BROWSERS_PATH=$SCRATCH/m6-playwright/pw-browsers node --test docs/e2e-v2/m4/tests/*.test.mjs`
       - `HOME=$SCRATCH/m6-home-fixture TMPDIR=$SCRATCH PLAYWRIGHT_BROWSERS_PATH=$SCRATCH/m6-playwright/pw-browsers node --test docs/e2e-v2/m3/tests/*.test.mjs`
       - `HOME=$SCRATCH/m6-home-fixture TMPDIR=$SCRATCH PLAYWRIGHT_BROWSERS_PATH=$SCRATCH/m6-playwright/pw-browsers node --test docs/e2e-v2/m2/tests/*.test.mjs`
       (Note: M1 suite is verified via historical tree hash matching per approved plan).
     - Run coverage checks using Node's built-in coverage runner (with `HOME=$SCRATCH/m6-home-fixture`, `TMPDIR=$SCRATCH`, and `PLAYWRIGHT_BROWSERS_PATH=$SCRATCH/m6-playwright/pw-browsers`):
       - `HOME=$SCRATCH/m6-home-fixture TMPDIR=$SCRATCH PLAYWRIGHT_BROWSERS_PATH=$SCRATCH/m6-playwright/pw-browsers node --experimental-test-coverage --test-coverage-include=docs/e2e-v2/m6/tests/acceptance-ledger.mjs --test-coverage-lines=80 --test-coverage-branches=80 --test-coverage-functions=80 --test docs/e2e-v2/m6/tests/m6.test.mjs`
       - `HOME=$SCRATCH/m6-home-fixture TMPDIR=$SCRATCH PLAYWRIGHT_BROWSERS_PATH=$SCRATCH/m6-playwright/pw-browsers node --experimental-test-coverage --test-coverage-include=docs/e2e-v2/m6/tests/mutation-suite.mjs --test-coverage-lines=80 --test-coverage-branches=80 --test-coverage-functions=80 --test docs/e2e-v2/m6/tests/m6.test.mjs`
       - `HOME=$SCRATCH/m6-home-fixture TMPDIR=$SCRATCH PLAYWRIGHT_BROWSERS_PATH=$SCRATCH/m6-playwright/pw-browsers node --experimental-test-coverage --test-coverage-include=docs/e2e-v2/m6/tests/scratch-runner.mjs --test-coverage-lines=80 --test-coverage-branches=80 --test-coverage-functions=80 --test docs/e2e-v2/m6/tests/m6.test.mjs`
       - `HOME=$SCRATCH/m6-home-fixture TMPDIR=$SCRATCH PLAYWRIGHT_BROWSERS_PATH=$SCRATCH/m6-playwright/pw-browsers node --experimental-test-coverage --test-coverage-include=docs/e2e-v2/m6/scripts/emit-m6-reports.mjs --test-coverage-lines=80 --test-coverage-branches=80 --test-coverage-functions=80 --test docs/e2e-v2/m6/tests/m6.test.mjs`
       Save coverage results to `docs/e2e-v2/m6/reports/coverage.report.json`.
     - Audit filesystem writes: verify that all created files match the allowed write set (`docs/e2e-v2/m6/**`); verify zero outside writes; verify frozen tree hashes remain identical. Emit `docs/e2e-v2/m6/reports/scope-check.report.json`.
     - Complete `docs/e2e-v2/m6/tdd-record.md` with REFACTOR stage confirmations.
   - Why: Guarantees code quality, high test coverage, non-regression of prior work under isolated environment, and zero boundary leakage.
   - Closes: Verification gate requirements.
   - References: `docs/e2e-v2/m5/reports/coverage.report.json`, `docs/e2e-v2/m5/reports/scope-check.report.json`.
   - Acceptance: All regression test suites pass; coverage thresholds ≥80% for lines, branches, and functions on each module; zero outside writes; frozen tree hashes identical.
   - QA: Happy path — Coverage commands pass with ≥80% on all dimensions; regression passes cleanly under isolated HOME fixture; scope check reports 0 outside writes. Failure path — Coverage below 80% or any modified file outside M6 fails the verification gate.
   - Dependencies: Steps 4, 5, 6. Complexity: Medium. Risk: Low.

### Phase 5 — Traceability, Decision Packet & Milestone Closure

8. **Publish M6 Traceability Matrix, Decision Packet, and Acceptance Release Ledger**  
   (Files: `docs/e2e-v2/m6/traceability-m6.md`)
   - Action: Author the comprehensive M6 traceability and release document:
     - Document the status taxonomy (PASS vs REFERENCE_VERIFIED vs NOT_RUN).
     - Map every AC (`AC-001` through `AC-022`), PRD requirement (`E2E-FR-001` through `E2E-FR-020`, `E2E-NFR-001` through `E2E-NFR-007`), scenario (A01–A08, B01–B12, C01–C12, D01–D10, E01–E06), and mutation (1–14) to its test name, emitted report, outcome, and evidence artifact.
     - Document the scratch Playwright loopback execution evidence on `E2E_NONPROD_LOCAL_FIXTURE`.
     - Formally record the final status of Gates P1–P5:
       - Gate P1 (Effective resolution): `NOT_VERIFIED` (ASM-01 inconclusive in M2).
       - Gate P2 (Parity): `VERIFIED_IN_M5_AND_M6` (parity differential confirmed over F01–F06+F13).
       - Gate P3 (Registry safety): `VERIFIED_IN_M3_M5_M6` (field-scoped updates, conflict detection, DEC-04 hint).
       - Gate P4 (Rollback readiness): `VERIFIED_IN_M5_AND_M6` (5-file rehearsal verified).
       - Gate P5 (Owner deployment authorization): `NOT_GIVEN` (pending explicit owner instruction).
     - State clearly that live `/e2e-map` disablement remains strictly `BLOCKED_DEPLOYMENT_GATED` until the owner authorizes deployment out-of-band.
     - Document frozen tree hashes for M1 through M5 and contracts.
   - Why: Establishes complete traceability, seals the V2.0 acceptance release, and provides an auditable closure artifact for the owner.
   - Closes: Complete milestone acceptance release.
   - References: `docs/e2e-v2/m5/traceability-m5.md`, `BUNDLE/REQUIREMENTS-TRACEABILITY.csv`.
   - Acceptance: Traceability document complete, accurate, self-contained, and consistent with all generated reports.
   - QA: Happy path — `test -s docs/e2e-v2/m6/traceability-m6.md && node -e "const fs = require('node:fs'), assert = require('node:assert/strict'); const t = fs.readFileSync('docs/e2e-v2/m6/traceability-m6.md', 'utf8'); for (const ac of ['AC-019', 'AC-020', 'AC-021', 'AC-022']) assert.ok(t.includes(ac), 'missing ' + ac); for (let i = 1; i <= 14; i++) assert.ok(t.includes('Mutation ' + i), 'missing Mutation ' + i); assert.ok(t.includes('BLOCKED_DEPLOYMENT_GATED'), 'missing BLOCKED_DEPLOYMENT_GATED'); assert.ok(t.includes('NOT_VERIFIED'), 'missing NOT_VERIFIED'); console.log('TRACEABILITY_OK');"` exits 0. Failure path — If `traceability-m6.md` is missing or omits any required AC, mutation, or gate status, the check throws an AssertionError and fails immediately.
   - Dependencies: Steps 1 through 7. Complexity: Low. Risk: Low.

## Testing Strategy

- **Test Framework:** Zero-dependency native Node.js test runner (`node --test`) with strict assertions (`node:assert/strict`). No external testing libraries or npm packages installed into the active project.
- **Node v24 Test Invocation Note:** Do not use bare directory arguments like `node --test docs/e2e-v2/m6/tests` on Node v24 (ESM resolution fails); use explicit `.test.mjs` files or `*.test.mjs` globs.
- **TDD Workflow:** Strictly enforce RED → GREEN → REFACTOR. Tests must be executed and confirmed failing before reference/runner implementation; same tests rerun to confirm passing; TDD record maintained at each stage.
- **Unit & Reference Tests (`m6.test.mjs`):**
  - Scenario coverage: Validates all 48 scenarios across Groups A through E.
  - Acceptance ledger integrity: Validates that `acceptance-ledger.json` contains all 48 scenario IDs with correct mappings, methods, and SHA-256 evidence hashes.
  - Negative mutation suite: Validates that all 14 negative mutations are detected by their independent oracles.
  - Playwright loopback execution: Validates that scratch Playwright executes against the ephemeral loopback server on `E2E_NONPROD_LOCAL_FIXTURE`, evaluates exit codes, captures artifacts, and redacts sensitive credentials.
  - Concurrency, path safety, and parity: Re-verifies M3/M4/M5 core invariants at the final release level.
  - Gating logic: Validates P1–P5 evaluator; live deployment strictly blocked when P1 or P5 incomplete.
- **Static Conformance Tests (`conformance.test.mjs`):**
  - Read-only hash checks for pinned command preimages (`.opencode/commands/e2e.md`, `.opencode/commands/e2e-map.md`).
  - Immutability checks for active project configuration and isolated scratch HOME global configuration files.
  - Read-only observational recording of active global `~/.config/opencode/opencode.jsonc` drift (`owner_config_drift.observed_sha256 = sha256(read(activeJsonc))` at report-generation time), excluded from pass/fail criteria and never compared against any pinned or historical constant.
  - Absence verification for `TESTS.md` and `.governance/docs-map.json`.
  - Frozen tree manifest checks across M1, M2, M3, M4, M5, and contracts.
- **Regression Testing:**
  - Execute M5 test suite with isolated HOME fixture (`HOME=$SCRATCH/m6-home-fixture TMPDIR=$SCRATCH PLAYWRIGHT_BROWSERS_PATH=$SCRATCH/m6-playwright/pw-browsers node --test docs/e2e-v2/m5/tests/*.test.mjs`).
  - Execute M4 test suite (`docs/e2e-v2/m4/tests/*.test.mjs`).
  - Execute M3 test suite (`docs/e2e-v2/m3/tests/*.test.mjs`).
  - Execute M2 test suite (`docs/e2e-v2/m2/tests/*.test.mjs`).
- **Coverage Requirements:**
  - Enforce ≥80% lines, ≥80% branches, and ≥80% functions independently on each non-test module under `docs/e2e-v2/m6/tests/` and `docs/e2e-v2/m6/scripts/`.

## Risks & Mitigations

| Risk | Description | Mitigation |
|---|---|---|
| **Accidental Package/Lockfile Mutation** | Installing Playwright or browser binaries into the active repository or active user HOME. | Playwright 1.65.1 + Chromium is executed strictly from the pre-existing authorized scratch directory (`/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright`). No `npm install`, `npx playwright install`, or lockfile mutation is permitted. |
| **Production Target Leakage** | Tests accidentally issuing requests to real external or production endpoints. | Execution target is strictly pinned to `E2E_NONPROD_LOCAL_FIXTURE` on an ephemeral localhost loopback server managed by the test process. Any non-loopback URL triggers an immediate `BLOCKED_PRODUCTION_TARGET` gate block. |
| **False Pass Reporting (Simulation as Pass)** | Reporting simulated or mock run receipts as genuine live passes. | Strict status taxonomy: `PASS` is granted only for real executed evidence with real exit codes and hashes. Synthetic harness checks are labeled `REFERENCE_VERIFIED`. Unavailable live model sessions are labeled `NOT_RUN`. |
| **Premature Disable-Default Claim** | Claiming that legacy `/e2e-map` is disabled live in the repository. | Gate P1 remains `NOT_VERIFIED` and Gate P5 remains `NOT_GIVEN`. The gating engine and decision packet explicitly mark live disable-default as `BLOCKED_DEPLOYMENT_GATED`. |
| **Registry Pollution** | Real `TESTS.md` or `.governance/docs-map.json` created or modified in the active repository. | All registry update tests operate on in-memory strings and scratch fixtures; active repo files remain absent. Conformance tests verify absence before and after. |
| **Baseline Tree Drift** | Modifying prior milestone deliverables (M1–M5) or contracts during M6 work. | Preflight and postflight checks verify exact sorted tree hashes for M1 (16), M2 (27), M3 (17), M4 (20), M5 (23), and contracts (3). Any drift halts execution immediately. |
| **Active Global Configuration Drift** | Active global `~/.config/opencode/opencode.jsonc` drifted from pinned hash due to owner-authorized default model change, threatening M5 regression and conformance failure. | Establish isolated scratch HOME fixture (`$SCRATCH/m6-home-fixture/.config/opencode/`) containing pinned copies from backup (`85378ac0…`) and `opencode.json` (`bd747d4f…`). Execute preflight, conformance, and regression with `HOME=$SCRATCH/m6-home-fixture`. Active drift is recorded observationally as owner-authorized state without modification or restoration; M6 never reads active global jsonc as a pass criterion. |
| **Credential Leakage in Artifacts** | Screenshots, traces, or logs capturing real API keys or tokens. | Automated redaction scrubber checks all emitted artifacts and JSON reports, replacing any token pattern (e.g. `sk-[a-zA-Z0-9-]+`) with `[REDACTED]`. |

## Decisions I Made for You

| Decision | Default Chosen | Reversible? |
|---|---|---|
| **Scratch Playwright Usage** | Utilize existing scratch Playwright 1.65.1 in `/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright` against ephemeral localhost loopback server only. | Yes; owner can authorize alternative non-production targets if desired. |
| **Status Taxonomy (PASS / REFERENCE_VERIFIED / NOT_RUN)** | Distinguish real executed evidence (`PASS`), deterministic harness verification (`REFERENCE_VERIFIED`), and unavailable model sessions (`NOT_RUN`). | Yes; aligns with PRD honesty requirements. |
| **A08 Full Trace Status** | Mark scenario A08 as `NOT_RUN (Live Model Session Deferred)` in ledger, while verifying its structural state machine trace in reference harness. | Yes; live interactive LLM session execution can be authorized separately if needed. |
| **14-Mutation Suite Consolidation** | Consolidate mutations 10/12 (M4), 13/14 (M5), and 1–9/11 into a single runnable suite under `docs/e2e-v2/m6/tests/mutation-suite.mjs`. | Yes; ensures unified verification of all negative safety gates. |
| **P1 / P5 Gate Persistence** | Keep Gate P1 as `NOT_VERIFIED` and Gate P5 as `NOT_GIVEN`; emit `m6-decision-packet.json` blocking live disable-default. | Yes; owner deployment authorization is preserved as an explicit owner-decision. |
| **Zero Active Dependency Footprint** | Active repository `package.json` and `node_modules` are never modified; all harness logic runs on native Node.js standard library. | Yes; preserves repo zero-dependency invariant. |
| **Ephemeral Loopback Port** | Ephemeral server binds to port 0 (dynamic allocation) to prevent port collisions on host. | Yes; standard network testing best practice. |
| **Module Coverage Enforcement** | Enforce ≥80% lines, branches, and functions independently on each M6 non-test module. | Yes; guarantees high test quality without pooling metrics. |
| **Isolated HOME Fixture for Global Config Pins** | Establish `$SCRATCH/m6-home-fixture/.config/opencode/` containing pinned copies of `opencode.json` (`bd747d4f…`) and `opencode.jsonc` (`85378ac0…`, sourced from backup), running preflight/conformance/regression with `HOME=$SCRATCH/m6-home-fixture`; active global jsonc drift is recorded at report-generation time as `owner_config_drift.observed_sha256 = sha256(read(activeJsonc))`, observational and excluded from pass/fail, never compared against any pinned or historical constant, and without modification or restoration. | Yes; prevents active global config drift from failing regression while respecting owner's authorized default model change. |

## Inline Metis Gap Pass

| Finding / Category | Disposition | Resolution or Required Handling |
|---|---|---|
| **Effective Command Winner (ASM-01) is Unverified** | RESOLVED (Honesty) | Gate P1 remains strictly `NOT_VERIFIED`. M6 does NOT assume the winner, does NOT alter discovery, and emits `m6-decision-packet.json` marking live disable-default as `BLOCKED_DEPLOYMENT_GATED`. |
| **Owner Deployment Authorization (P5) is Not Given** | RESOLVED (Honesty) | Gate P5 remains `NOT_GIVEN`. M6 provides the complete acceptance evidence packet enabling the owner to grant P5 separately when ready. |
| **Playwright Dependency & Binary Boundaries** | RESOLVED | Playwright 1.65.1 + Chromium is executed strictly from scratch `/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode/m6-playwright` with `PLAYWRIGHT_BROWSERS_PATH` pointing into `pw-browsers/`. Active `package.json`, active `node_modules`, and active HOME cache remain completely untouched. |
| **Target Environment Boundary (DEC-07)** | RESOLVED | Target is strictly `E2E_NONPROD_LOCAL_FIXTURE` on ephemeral localhost loopback. Production target execution is blocked by the environment gate with code `BLOCKED_PRODUCTION_TARGET`. Zero real credentials used. |
| **Simulated vs Real Pass Distinction (AC-018)** | RESOLVED | Statuses are strictly partitioned: `PASS` is granted only for real executed evidence with real exit codes and hashes (13 scenarios + 14 mutations). Synthetic harness checks are labeled `REFERENCE_VERIFIED` (34 scenarios). Live model sessions are labeled `NOT_RUN` (1 scenario: A08). |
| **Negative Mutation Coverage (14 Mutations)** | RESOLVED | All 14 mutations from `NEGATIVE-MUTATION-PLAN.md` are implemented with carrier/oracle pairs in `mutation-suite.mjs` and executed in `m6.test.mjs`, returning 14/14 DETECTED. |
| **Prior Milestone Baselines Frozen (M1–M5 + Contracts)** | RESOLVED | Preflight and postflight checks verify exact sorted tree hashes for M1 (16), M2 (27), M3 (17), M4 (20), M5 (23), and contracts (3). |
| **Active Registry Absence** | RESOLVED | `TESTS.md` and `.governance/docs-map.json` remain absent from the active repository. All acceptance tests operate on synthetic/scratch fixtures with zero repository registry writes. |
| **Active Global Config Drift (opencode.jsonc)** | RESOLVED (Environment Isolation) | Active `~/.config/opencode/opencode.jsonc` remains owner-modified (default model change). Resolved by creating scratch HOME fixture (`$SCRATCH/m6-home-fixture/.config/opencode/`) containing pinned copies from backup (`85378ac0…`) and `opencode.json` (`bd747d4f…`), executing all steps reading global HOME pins with `HOME=$SCRATCH/m6-home-fixture`, and recording active drift at report-generation time as read-only `owner_config_drift.observed_sha256 = sha256(read(activeJsonc))`, excluded from pass/fail and never compared against any pinned or historical constant. Zero modification/restoration of active config. |
| **Top-Level Model-Invoking Sessions Limit** | RESOLVED | At most 3 model-invoking sessions in M6 execution; deterministic harness preferred for all automated checks. |
| **Sensitive Data Redaction in Artifacts** | RESOLVED | Automated token scrubber redacts sensitive patterns to `[REDACTED]` before artifacts are referenced in reports. |

**Gap pass: 11 issue groups resolved; 0 blocking issues open; live deployment gated.**

## Success Criteria

| IS Row / Approved AC | Proven at Acceptance Layer By | Required QA Evidence Artifact | Live Status |
|---|---|---|---|
| **IS-1 / AC-021** (Unified 48-Scenario Ledger) | Steps 2, 4, 5: All 48 scenarios mapped, audited, and recorded in `acceptance-ledger.json` with honest statuses, fixture provenance, and SHA-256 evidence hashes. | `m6.test.mjs`, `acceptance-ledger.json` | 13 PASS, 34 REFERENCE_VERIFIED, 1 NOT_RUN (honest accounting). |
| **IS-2 / AC-022** (14 Negative Mutations Suite) | Steps 2, 3, 5: All 14 negative mutations executed against independent oracles; all 14 confirmed DETECTED; zero bypasses. | `m6.test.mjs`, `mutation-suite.report.json` | PASS; 14/14 DETECTED with zero unblocked mutations. |
| **IS-3 / AC-014 / AC-011** (Scratch Playwright on Loopback) | Steps 2, 4, 5: Scratch Playwright 1.65.1 executed against ephemeral local loopback server on `E2E_NONPROD_LOCAL_FIXTURE`; exit codes, timing, artifacts, and redactions captured. | `m6.test.mjs`, `playwright-execution.report.json`, `env-boundary.report.json` | PASS on local loopback; production remains strictly BLOCKED. |
| **IS-4 / AC-018** (Honest Status Taxonomy) | Steps 2, 4, 5: Strict separation of PASS, REFERENCE_VERIFIED, and NOT_RUN; no simulated receipt labeled PASS; flakiness separated from terminal outcome. | `m6.test.mjs`, `acceptance-ledger.json` | Status taxonomy strictly enforced and auditable. |
| **IS-5 / Gate P1 & P5** (Deployment Gate Honesty) | Steps 2, 4, 5: Gating evaluator blocks live disablement due to P1 NOT_VERIFIED and P5 NOT_GIVEN; emits complete owner decision packet. | `m6.test.mjs`, `m6-decision-packet.json` | Live disablement strictly BLOCKED_DEPLOYMENT_GATED. |
| **IS-6 / E2E-NFR-005** (Frozen Baseline Immutability) | Steps 1, 6, 7: M1 (16), M2 (27), M3 (17), M4 (20), M5 (23), and contracts (3) verified identical; active commands and configs untouched; registry files absent; isolated HOME fixture used for global config pins; active jsonc drift recorded observationally without mutation; 0 outside writes. | `m6.test.mjs`, `conformance.test.mjs`, `prompt-conformance.report.json`, `scope-check.report.json` | All baselines verified identical; zero active config mutations. |

## Review Handoff

The independent `plan-reviewer` subagent should be chained against this plan file (`docs/plans/e2e-v2-0-m6-acceptance-release.plan.md`) to perform executability and adversarial review passes.

Upon approval by the reviewer, owner approval must be formally granted before any implementation commences. Implementation will proceed in a separate worker session strictly following the phased TDD steps outlined herein.
