# Implementation Plan: ECC-OPL Antigravity CLI Native Port (Master Plan A0–A6, Revision r2)

- **Status**: REVISED MASTER PLAN r2 (Under Review — Momus + Oracle Independent Review Required Before Implementation)
- **Target Host**: Google Antigravity CLI (`agy` v1.5.16), terminal-first exclusively
- **Reference Runtime**: OpenCode (active, stable, completely untouched by default)
- **Source Baseline**: Full commit `42fae4ebb5e995690d3a5752b461e475d229c40e` on `main`
- **Governing Brief**: `/Users/ctp-itdev2/Downloads/ecc-opl-antigravity-cli-native-port-engineering-brief.md` (Reconciled SHA-256: `5593df533bf74eca2d5b054419ca893f994df25c2a652fff4c304d570aa0d00b`)
- **Stop Rule Boundary**: Implementation authorizes **A0 preflight and A1 pilot ONLY**. Phase A1 MUST stop at exit gate (`CLI_TDD_PILOT=WORKFLOW_VERIFIED`) and await explicit owner sign-off before proceeding to A2.
- **Security Boundary**: Guardian Angel custom hook adapter is **EXCLUDED** per owner directive. Security relies strictly on native host sandbox (`--sandbox`) and CLI permission controls; no custom hook layer is introduced for Antigravity CLI.

---

## 1. Overview & Intent Announcement

**Intent: CLEAR** — This revision (r2) aligns the master plan directly with effective ECC-OPL agent architecture, authentic TDD execution contracts, explicit tool and model adaptation, verified installer infrastructure, and honest capability statuses. OpenCode remains the primary reference runtime; Antigravity CLI (`agy`) is ported as a native, terminal-first target via selective upstream backporting from a pinned snapshot into shared canonical sources, utilizing thin runtime adapters and rigorous phase gates.

This master implementation plan establishes the engineering blueprint across Phases A0 through A6:
1. **A0**: Bounded preflight, conditional PID inspection (PID 69840), baseline freeze (`42fae4ebb5e995690d3a5752b461e475d229c40e`), reconciled brief digest (`5593df53...`), and live `agy` capability probe.
2. **A1**: Authentic native CLI TDD implementation (first usable vertical slice: project-local `.agents/` projection via canonical installer infrastructure, namespaced `/opl-tdd` and `/opl-coding-standards`, authentic `opl-tdd-guide` and restricted `opl-code-reviewer`, immutable review scope packet, negative mutation probe, and real RED-GREEN-REFACTOR-REVIEW pilot in a disposable workspace).
3. **MANDATORY STOP RULE**: Strict exit gate review. Execution freezes until owner signs off on A1 evidence packet.
4. **A2**: Core workflow projections (`/opl-code-review-quick`, `/opl-refactor-clean` via `code-simplifier`, `/opl-docs-update`, `/opl-deep-research`), effective ECC-OPL agent adaptations, and target/session-isolated workflow state (`.agents/ecc-opl/workflows/active.json`) with worktree and conversation binding.
5. **A3**: Shared external Plan Canvas service reuse (`scripts/plan-canvas.js`), exact cryptographic verdict binding (`verdict: "approve"` bound to revision digest, workspace, and session), authentic `planner` (with inline Metis gap pass) and `plan-reviewer` (with Momus Pass 1 and Oracle Pass 2 in one invocation), with optional Canvas V2 extension (100k char prompt, image attachments) evaluated separately from base transport.
6. **A4**: Unified E2E V2 runner integration (`.opencode/scripts/e2e-registry.mjs` with target-aware resolver, `TESTS.md` governance), and preserved ECC-OPL read-only security audit (`/opl-security-audit` via `skills/security-review/` and security agent patterns).
7. **A5**: Design-build V2 & typography visual fidelity (strictly gated on Track A reference stabilization closure; complete approved section scope, decodable paired PNGs, and G0–G3 visual parity gates; typography DESIGN/VERIFY/AMEND lifecycle).
8. **A6**: Canonical distribution manager (`scripts/lib/install-manifests.js` + `scripts/lib/install-executor.js` + `scripts/lib/install-targets/antigravity-cli.js`), exact release manifest, atomic deployment, and rollback rehearsal for `antigravity-cli`.

---

## 2. Affected User and Ideal State

**Affected User**:
- **Engineering Lead / Operator (`ctp-itdev2`)**: Needs to run disciplined, test-first, autonomous engineering workflows (TDD, planning, code review, E2E, visual design-build) directly from terminal sessions using `agy` without host command collisions or losing customized ECC-OPL guarantees.
- **Autonomous Agents & Subagents**: Orchestrators, planners, and reviewers that require explicit, unambiguous tool boundaries, deterministic model mapping, and isolated state without synthetic or standalone proxy layers.
- **Reference Host (OpenCode) Sessions**: Developers working in OpenCode who must suffer zero regressions, zero shared-state corruption, and zero configuration drift.

| Row | Ideal State (IS-n) | Reason |
|---|---|---|
| **IS-1** | The developer can invoke customized ECC-OPL workflows in Antigravity CLI using collision-safe commands (`/opl-tdd`, `/opl-plan`, `/opl-code-review-quick`) that execute authentic test-first and review logic. | Eliminates silent collisions with native host commands and guarantees custom harness guarantees are preserved on `agy`. |
| **IS-2** | OpenCode remains 100% operational, backward-compatible, and isolated from all Antigravity CLI projections. | Prevents multi-runtime corruption, configuration drift, or accidental breaking changes to the active reference environment. |
| **IS-3** | Reviewer subagents on Antigravity CLI are strictly read-only, granted only read/grep/find tools, supplied with immutable diff evidence, and physically incapable of modifying source code. | Protects codebase integrity by enforcing that code reviewers evaluate code without self-approving or mutating candidate diffs. |
| **IS-4** | Workflow state and session checkpoints are fully isolated per target runtime, project, worktree, and conversation ID. | Prevents OpenCode and Antigravity CLI from clobbering each other's active workflow state (`.opencode/workflows/active.json` vs `.agents/ecc-opl/workflows/active.json`). |
| **IS-5** | Human plan review and approval seamlessly reuses the existing local Plan Canvas service with cryptographic verdict binding (`verdict: "approve"`). | Ensures no agent can synthesize consent or bypass architectural gates using conversational text or native host proceed buttons. |
| **IS-6** | Advanced visual workflows (`/opl-design-build`) are admitted only after reference implementation blockers in Track A are proven resolved. | Avoids transplanting known visual comparison failures or false PARITY_PASS states across runtimes. |
| **IS-7** | Distribution and installation via the canonical installer infrastructure is deterministic, project-local first, verifiable by exact SHA-256 manifests, and fully reversible with verified rollback. | Protects developer environment from global pollution, unmanaged file overwrites, or broken uninstall procedures. |

| Row | Current Gap (GAP-n) | Why It Matters |
|---|---|---|
| **GAP-1** | Current transformer `scripts/lib/install/antigravity-agent.js` only supported IDE/editor tool names (`view_file`, `replace_file_content`, `write_to_file`) until CLI runtime mapping (`read_file`, `edit_file`, `write_file`, `grep_search`, `find_by_name`, `run_command`, `invoke_subagent`) is explicitly passed at call sites. | Agents deployed to `agy` CLI fail to invoke core tools, crash on unsupported editor names, or lose subagent delegation capabilities. |
| **GAP-2** | No collision-safe namespace exists for Antigravity skills/commands; native `/plan` or `/test` host commands conflict with custom ECC-OPL workflows. | Invoking commands in `agy` can trigger unconstrained host built-ins instead of the governed ECC-OPL pipeline. |
| **GAP-3** | Reviewer agent restrictions must rely on explicit role-based tool stripping, immutable review scope packets, and verified negative mutation probes rather than prompt cooperative text or name heuristics. | A malfunctioning reviewer agent could modify candidate files or execute destructive commands during review passes if tools are not structurally stripped. |
| **GAP-4** | Active workflow state path was hardcoded to `.opencode/workflows/active.json` across multiple scripts, causing cross-runtime state collisions. | A session in `agy` could overwrite or corrupt an in-flight OpenCode workflow state, breaking resume and audit trails. |
| **GAP-5** | Plan Canvas approval currently lacks target-aware URL and payload binding for `agy` CLI sessions. | A developer reviewing a plan in Canvas cannot bind approvals back to the active `agy` CLI session. |
| **GAP-6** | Track A visual design-build has known reference stabilization issues (Rlogic gate request discrepancies, topbar height measurements only). | Deploying `/design-build` to `agy` before resolving Track A would replicate flawed gates and false parity claims. |
| **GAP-7** | Installer infrastructure must register `antigravity-cli` target adapter across schema enums, module manifests, and target registries with exact candidate manifests and rollback rehearsals. | Developers cannot inspect, verify, or cleanly uninstall project-local Antigravity CLI projections without verified target adapter registration. |

---

## 3. Requirements & Scope Boundaries

### 3.1 Must Have
- **R01 (Exclusive CLI Target)**: Target Google Antigravity CLI (`agy` v1.5.16+) terminal-first only; no dependency on IDE, Desktop App, ACP flags, or experimental SDKs.
- **R02 (Clean Baseline & Reconciled Brief)**: Confirm baseline commit `42fae4ebb5e995690d3a5752b461e475d229c40e` on `main`; reconcile governing brief SHA-256 to `5593df533bf74eca2d5b054419ca893f994df25c2a652fff4c304d570aa0d00b`; inspect PID 69840 before signaling (do not kill if absent/unrelated).
- **R03 (Explicit CLI Tool & Model Transformation)**: Select `{ runtime: 'cli' }` explicitly at the installer call site. Map:
  - `Read / ReadFile / NotebookRead` -> `read_file`
  - `Write` -> `write_file`
  - `Edit / MultiEdit` -> `edit_file`
  - `Grep` -> `grep_search`
  - `Glob` -> `find_by_name`
  - `Bash` -> `run_command`
  - `WebSearch` -> `search_web`
  - `WebFetch` -> `read_url_content`
  - `Task` -> `invoke_subagent`
  - Pass through `mcp__*` tools without fail-closed rejection.
  - Do NOT automatically rewrite models across providers; resolve concrete approved model IDs from `agy models` (`gemini-3.8-flash-high`, `claude-sonnet-5-5-high`) and record actual model identity.
- **R04 (Namespaced Public Aliases)**: Project all workflow entrypoints with `opl-` prefix (`/opl-tdd`, `/opl-coding-standards`, `/opl-code-reviewer`, `/opl-code-review-quick`, `/opl-plan`, `/opl-plan-prd`, `/opl-e2e`, `/opl-design-build`, `/opl-typography`, `/opl-refactor-clean`, `/opl-docs-update`, `/opl-deep-research`, `/opl-security-audit`).
- **R05 (Skills-First Project Discovery)**: Project to `.agents/skills/<name>/SKILL.md` and `.agents/agents/<name>.md`. Never write to legacy `.agent/`.
- **R06 (Strict Reviewer Tool Boundary & Assigned Scope)**: `opl-code-reviewer` frontmatter must restrict tools to `[read_file, grep_search, find_by_name]`. Disallow `write_file`, `edit_file`, `run_command`, and `invoke_subagent` via explicit role allowlist (not name heuristics). Provide immutable assigned review scope and candidate diff in the review packet so reviewer operates without arbitrary shell access.
- **R07 (Authentic TDD Pilot & Disposable Sandbox)**: Execute A1 pilot in runtime-generated disposable directory (e.g. `/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/antigravity/pilot-tdd-<timestamp>`). Project authentic `skills/tdd-workflow/` (as `opl-tdd`), matching language skill (`skills/coding-standards/` as `opl-coding-standards`), `agents/tdd-guide.md` (as `opl-tdd-guide`), and `agents/code-reviewer.md` (as `opl-code-reviewer`). Run test runner independently outside agent response. Execute RED -> GREEN -> REFACTOR -> REVIEW.
- **R08 (Honest Enforcement Status)**: Execute safe negative mutation probe against disposable writable fixture. Compare entire workspace tree before and after reviewer execution. Report `ENFORCED_VERIFIED` only if host physically prevents write; report `COOPERATIVE` if boundary relies on tool table omission or agent instructions.
- **R09 (Isolated State Store & Concurrency Locks)**: Target workflow state must reside in `.agents/ecc-opl/workflows/active.json` with 12h TTL, worktree binding, conversation ID binding, and lock-guarded atomic writes.
- **R10 (Canvas Verdict Binding)**: External `scripts/plan-canvas.js` service must bind exact approvals via `{"kind":"verdict","verdict":"approve"}` bound to plan file SHA-256, active session, and workspace. Reject chat strings or host proceed buttons.
- **R11 (Effective ECC-OPL Agent Architecture)**: Use canonical ECC-OPL agents (`build`, `planner` with inline Metis gap pass, `plan-reviewer` with Momus Pass 1 and Oracle Pass 2 in one invocation, `architect`, `explore`, `docs-lookup`, `tdd-guide`, `code-reviewer`, `code-simplifier`, `doc-updater`, `e2e-runner`). Do not create or port standalone OMO agents (Sisyphus, Prometheus, Metis, Momus, Oracle, Librarian). Preserve existing code-simplifier-based refactor-clean workflow (do not revive refactor-cleaner).
- **R12 (Track A Visual Gate Precondition)**: Phase A5 (`/opl-design-build`) remains locked (`BLOCKED`) until Track A Rlogic visual stabilization is certified (complete region manifests, decodable paired PNGs, authoritative G2 exit codes). Preserve typography DESIGN/VERIFY/AMEND lifecycle.
- **R13 (Verified Canonical Installer Infrastructure)**: Implement target adapter `antigravity-cli` in `scripts/lib/install-targets/antigravity-cli.js`, registered in `registry.js`, `install-manifests.js`, and schema enums. Support directory expansion for `agents` and `skills` with `opl-` prefixes. Provide exact release manifests, dry-run previews, and verified rollback.
- **R14 (Strict Phase Stop Rules)**: Implementation authorizes Phases A0 and A1 only. Execution halts at Phase A1 exit gate (`CLI_TDD_PILOT=WORKFLOW_VERIFIED`) for owner review before proceeding to A2.

### 3.2 Must NOT Have (Scope Guardrails)
- **NO Standalone OMO Agents**: Do not create or port standalone Sisyphus, Prometheus, Metis, Momus, Oracle, or Librarian agent files.
- **NO Revived Refactor-Cleaner**: Do not revive `refactor-cleaner`; preserve the existing `code-simplifier`-based refactor-clean workflow.
- **NO Second Fork or Long-Lived Branch**: All code resides in canonical ECC-OPL.
- **NO Upstream Merge / Rebase**: Do not attempt a wholesale merge of 853 upstream commits.
- **NO Global Config Pollution**: Do not install into `~/.gemini/`, `~/.claude/`, or user home directories.
- **NO Chat-Based Approval Faking**: Do not treat conversational chat messages as Canvas verdicts.
- **NO Untracked File Bleed**: Never package `.guardian-angel/*` audit files or uncommitted assets into releases.
- **NO Guardian Angel Hook Adapter**: Guardian Angel custom hook adapter is completely dropped from Antigravity CLI.
- **NO TypeScript Skill for JavaScript Pilot**: Pilot uses `opl-coding-standards`, matching its JavaScript stack.

---

## 4. Architecture Changes & File Topology

### 4.1 System Architecture Diagram

```
+---------------------------------------------------------------------------------------+
|                              CANONICAL ECC-OPL REPOSITORY                             |
|    (commands/, skills/, agents/, rules/, scripts/lib/, scripts/plan-canvas.js)        |
+---------------------------------------------------------------------------------------+
                                           |
                 [Canonical Installer: scripts/lib/install-manifests.js]
                 [Target Adapter: scripts/lib/install-targets/antigravity-cli.js]
                 [Transform: adaptAntigravityAgent({ runtime: 'cli' })]
                                           |
                   +-----------------------+-----------------------+
                   |                                               |
      (OpenCode Target - Untouched)                  (Antigravity CLI Target - New)
                   |                                               |
         .opencode/ (commands, skills)                  .agents/ (skills-first projection)
  .opencode/workflows/active.json              .agents/ecc-opl/workflows/active.json
                   |                                               |
                   v                                               v
        OpenCode Host Runtime                          Google Antigravity CLI (agy)
        (Reference Baseline)                           (Terminal-first, --sandbox)
                   |                                               |
                   +-----------------------+-----------------------+
                                           |
                             [Shared External Operations]
                - Local Plan Canvas Service (scripts/plan-canvas.js)
                - Playwright E2E Runner (.opencode/scripts/e2e-registry.mjs)
                - Visual Parity Compare Engine (scripts/design-build-v2/)
```

### 4.2 Target File Changes

| File Path | Action | Description | Phase |
|---|---|---|---|
| `scripts/lib/install/antigravity-agent.js` | Modify | Support `{ runtime: 'cli' }`, `CLI_TOOL_NAMES`, MCP tool passthrough (`mcp__*`), frontmatter `name:` `opl-` prefixing, explicit role-based reviewer tool stripping with defensive `label` fallback. | A1 |
| `scripts/lib/install/content-transform.js` | Modify | Wire `antigravity-agent-frontmatter-cli` transform to call `adaptAntigravityAgent(..., { runtime: 'cli' })`. | A1 |
| `scripts/lib/install/plan.js` | Modify | Add `antigravity-agent-frontmatter-cli` to non-markdown transform bypass guard. | A1 |
| `scripts/lib/install-targets/antigravity-cli.js` | Create | First-class target adapter for `antigravity-cli`, root `.agents/`, `opl-` namespacing, directory expansion for `agents` and `skills` with `opl-` prefix, omitting duplicate workflows. | A1 |
| `scripts/lib/install-targets/registry.js` | Modify | Register `antigravity-cli` adapter in `ADAPTERS`. | A1 |
| `scripts/lib/install-manifests.js` | Modify | Add `antigravity-cli` to `SUPPORTED_INSTALL_TARGETS` and module target compatibility checks. | A1 |
| `schemas/ecc-install-config.schema.json` | Modify | Add `antigravity-cli` to target enum. | A1 |
| `schemas/context-carrier.schema.json` | Modify | Add `antigravity-cli` to target enum. | A1 |
| `schemas/install-modules.schema.json` | Modify | Add `antigravity-cli` to target enum. | A1 |
| `tests/lib/antigravity-cli-adapter.test.js` | Create | Unit tests validating CLI tool table translation, model tier mapping, MCP passthrough, reviewer stripping, non-md bypass, and directory expansion. | A1 |
| `scripts/lib/workflow-state.js` | Create | Shared state utility module adding runtime-aware state path resolution (`.agents/ecc-opl/workflows/active.json` vs `.opencode/workflows/active.json`), worktree/session binding, concurrency locks, and 12h TTL checks. | A2 |
| `tests/lib/antigravity-workflow-state.test.js` | Create | Contract tests for multi-runtime isolated workflow state, concurrency locks, and atomic resume. | A2 |
| `scripts/lib/plan-canvas/server.js` | Modify | Add session-target parameter handling; evaluate Canvas V2 long prompt (100k char) and image attachment extensions separately from base transport. | A3 |
| `tests/lib/plan-canvas-antigravity.test.js` | Create | End-to-end verdict binding (`verdict: "approve"`) and transport tests for `agy` CLI sessions. | A3 |
| `.opencode/scripts/e2e-registry.mjs` | Modify | Support target-aware path resolution for `.agents/` projects, preserving E2E V2 `map/run/full/status/help` and structured CLI receipts. | A4 |
| `tests/lib/e2e-antigravity-runner.test.js` | Create | Runner execution and registry governance integration tests. | A4 |
| `scripts/design-build-v2/state-machine.mjs` | Modify | Integrate `agy` target resolution and strict G0–G3 gate receipts (BLOCKED until Track A admission certified). | A5 |
| `tests/lib/design-build-antigravity-gate.test.js` | Create | Gate verification tests for paired rendered captures (desktop 1440, mobile 390) and framework adapters. | A5 |
| `scripts/ecc.js` / `scripts/install-apply.js` | Modify | Wire canonical installer CLI to `--target antigravity-cli`, generating exact candidate manifests and rollback rehearsals. | A6 |
| `tests/lib/eccskills-antigravity-cli.test.js` | Create | Distribution, ownership ledger, and rollback verification tests. | A6 |

---

## 5. Metis Gap Pass (Inline Pre-Execution Audit)

1. **Contradictions**:
   - *Finding*: Standalone OMO agents (Sisyphus, Prometheus, etc.) were proposed, but ECC-OPL uses canonical agents (`build`, `planner`, `plan-reviewer`, `code-simplifier`, etc.).
   - *Resolution*: Standalone OMO agent requirements removed completely. Canonical ECC-OPL agents adapted directly.
   - *Finding*: Pilot loaded `opl-typescript-patterns` for a JavaScript-only pilot.
   - *Resolution*: Replaced with `opl-coding-standards`, accurately matching the pilot stack.
2. **Ambiguity**:
   - *Finding*: Reviewer tool restriction was previously inferred from name heuristics (`name.includes('reviewer')`), vulnerable to frontmatter omissions.
   - *Resolution*: Role-based allowlist applied with defensive fallback checking both `frontmatter.name` and file `label`/path. Immutable review scope and diff provided in review packet so reviewer operates without shell access.
3. **Missing Constraints**:
   - *Finding*: PID 69840 was assumed alive without checking current process table.
   - *Resolution*: Preflight checks process table conditionally: if absent, records clean state; if present, terminates safely.
   - *Finding*: Read-only marker check alone does not prove native enforcement.
   - *Resolution*: Mandate full recursive source tree comparison before/after review, explicit tool inspection, and safe negative mutation probe against disposable writable fixture.
4. **Topology Gaps**:
   - *Finding*: Module `agents-core` has path `'agents'` (directory). `preserve-relative-path` copied files without `opl-` prefix.
   - *Resolution*: Added explicit directory expansion in `antigravity-cli.js` so all 72 agents receive `opl-` prefix.
5. **Installer Identity**:
   - *Finding*: Assumed `eccskills` executable or `ecc-skill-bundles.js` existed.
   - *Resolution*: Reconciled to actual canonical installer infrastructure: `scripts/lib/install-manifests.js`, `scripts/lib/install-executor.js`, and `scripts/lib/install-targets/antigravity-cli.js`.

---

## 6. Implementation Steps (Phases A0 through A6)

```
+-------------------------------------------------------------------------------------------------+
|                                 PHASE A0: PREFLIGHT & BASELINE LOCK                            |
|          Inspect PID 69840 | Verify agy 1.5.16 | Pin HEAD 42fae4ebb5e9... | Verify Brief SHA     |
+-------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+-------------------------------------------------------------------------------------------------+
|                               PHASE A1: AUTHENTIC NATIVE CLI TDD PILOT                          |
|         Canonical Installer Projection | /opl-tdd & /opl-coding-standards | opl-tdd-guide       |
|         Restricted opl-code-reviewer | Immutable Diff Packet | Negative Mutation Probe          |
|         RED -> GREEN -> REFACTOR -> REVIEW in runtime-generated disposable sandbox             |
+-------------------------------------------------------------------------------------------------+
                                                 |
=================================================v=================================================
||                     MANDATORY STOP RULE ENFORCEMENT GATE (A1 EXIT)                           ||
||              CLI_TDD_PILOT=WORKFLOW_VERIFIED | HALT EXECUTION | REQUIRE OWNER SIGN-OFF        ||
=================================================v=================================================
                                                 | (Upon Explicit Owner Ratification)
                                                 v
+-------------------------------------------------------------------------------------------------+
|                               PHASE A2: CORE WORKFLOWS & STATE ISOLATION                        |
|       /opl-code-review-quick | /opl-refactor-clean (code-simplifier) | /opl-docs-update         |
|       Canonical ECC-OPL Agent Adaptations | .agents/ecc-opl/workflows/active.json & Locks       |
+-------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+-------------------------------------------------------------------------------------------------+
|                               PHASE A3: SHARED PLAN CANVAS & PRD                                |
|       scripts/plan-canvas.js Reuse | Exact Verdict {"kind":"verdict","verdict":"approve"}       |
|       planner (inline Metis) & plan-reviewer (Momus Pass 1 + Oracle Pass 2 in 1 invocation)    |
|       Base Canvas Transport Verified | Optional Canvas V2 (100k char / image) Evaluated         |
+-------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+-------------------------------------------------------------------------------------------------+
|                               PHASE A4: UNIFIED E2E V2 & SECURITY AUDIT                         |
|       .opencode/scripts/e2e-registry.mjs agy Resolver | /opl-e2e (map/run/full/status/help)     |
|       Preserved /opl-security-audit (skills/security-review/ & security agent patterns)         |
+-------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+-------------------------------------------------------------------------------------------------+
|                               PHASE A5: DESIGN-BUILD V2 & TYPOGRAPHY                            |
|       (PREREQUISITE: Track A Visual Admission Certified) | G0-G3 Visual Parity Gates            |
|       /opl-design-build & /opl-typography | Paired 1440/390 Captures | DESIGN/VERIFY/AMEND      |
+-------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+-------------------------------------------------------------------------------------------------+
|                               PHASE A6: CANONICAL DISTRIBUTION & ROLLBACK                       |
|       Canonical Installer --target antigravity-cli | Exact Release Manifest | Rollback Rehearsal|
+-------------------------------------------------------------------------------------------------+
```

---

### Phase A0: Bounded Preflight, Baseline Lock & Probe Inspection

- **Goal**: Establish a verified, non-interfering environment, inspect process table, freeze canonical source revision, reconcile brief digest, and confirm live `agy` CLI capabilities.
- **Closes**: GAP-1, GAP-2 (preconditions).
- **Files Touched / Inspected**:
  - Process table: PID 69840
  - CLI binary: `/Users/ctp-itdev2/.local/bin/agy`
  - Repository baseline: HEAD `42fae4ebb5e995690d3a5752b461e475d229c40e` on `main`
  - Governing brief: `/Users/ctp-itdev2/Downloads/ecc-opl-antigravity-cli-native-port-engineering-brief.md`
- **Action Steps**:
  1. **A0.1 Process Inspection**: Inspect PID 69840 (`ps -p 69840 -o pid,stat,command`). If absent, record clean state. If running and confirmed as an orphaned `agy` probe, terminate via `kill -TERM 69840` (verify termination with `kill -0 69840` returning exit 1). If unrelated, do NOT terminate.
  2. **A0.2 Baseline & Brief Reconcile**:
     - Record full source git commit: `42fae4ebb5e995690d3a5752b461e475d229c40e`.
     - Record exact governing brief SHA-256: `5593df533bf74eca2d5b054419ca893f994df25c2a652fff4c304d570aa0d00b`.
     - Confirm working tree status (untracked `.guardian-angel/*` audit files preserved, zero dirty production code files).
  3. **A0.3 CLI Capability Probe**: Run non-destructive discovery probes with bounded timeouts (30s) and capture stdout/stderr to `artifacts/a0-preflight/`:
     - `agy --version` -> verify current version (1.5.16)
     - `agy --help` -> verify available CLI flags (`--sandbox`, `--print-timeout`, `--output-format`, `--agent`, `--model`)
     - `agy models` -> record concrete approved model IDs (`gemini-3.8-flash-high`, `claude-sonnet-5-5-high`)
     - `agy agents` -> verify baseline project-level discovery state
  4. **A0.4 Target Path Lock**: Allocate runtime-generated disposable pilot directory: `/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/antigravity/pilot-tdd-<timestamp>`.
- **References**: Brief §1, §6; Findings AGY-F01, AGY-F02.
- **Acceptance Criteria**:
  - PID 69840 confirmed absent or safely terminated.
  - Current `agy` version 1.5.16 confirmed executable.
  - Source baseline `42fae4ebb5e995690d3a5752b461e475d229c40e` frozen.
  - Governing brief SHA-256 reconciled to `5593df53...`.
- **Dependencies**: None.
- **Risk**: Low.

---

### Phase A1: Authentic Native CLI TDD Implementation (First Usable Vertical Slice)

- **Goal**: Implement the thin Antigravity CLI projection adapter in the canonical installer, support explicit CLI tool mapping (`read_file`, `edit_file`, `write_file`, `grep_search`, `find_by_name`, `run_command`, `invoke_subagent`), project authentic `/opl-tdd`, `/opl-coding-standards`, `opl-tdd-guide`, and restricted `opl-code-reviewer`, provide immutable assigned review scope, execute negative mutation probe, and run an authentic RED-GREEN-REFACTOR-REVIEW pilot in a disposable workspace.
- **Closes**: GAP-1, GAP-2, GAP-3.
- **Files Touched**:
  - `scripts/lib/install/antigravity-agent.js`
  - `scripts/lib/install/content-transform.js`
  - `scripts/lib/install/plan.js`
  - `scripts/lib/install-targets/antigravity-cli.js` (New)
  - `scripts/lib/install-targets/registry.js`
  - `scripts/lib/install-manifests.js`
  - `schemas/ecc-install-config.schema.json`
  - `schemas/context-carrier.schema.json`
  - `schemas/install-modules.schema.json`
  - `tests/lib/antigravity-cli-adapter.test.js` (New)
  - Disposable Pilot Directory: `/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/antigravity/pilot-tdd-<timestamp>/`
- **Action Steps**:
  1. **A1.1 Adapt `antigravity-agent.js`**:
     - Define `CLI_TOOL_NAMES`:
       `Read/ReadFile/NotebookRead -> read_file`, `Write -> write_file`, `Edit/MultiEdit -> edit_file`, `Grep -> grep_search`, `Glob -> find_by_name`, `Bash -> run_command`, `WebSearch -> search_web`, `WebFetch -> read_url_content`, `Task -> invoke_subagent`.
     - When `options.runtime === 'cli'`, use `CLI_TOOL_NAMES`. Preserve default editor tool names for editor targets.
     - Unmapped tool check: allow `mcp__*` tools through; throw descriptive validation error for unmapped built-ins.
     - Prefix agent frontmatter `name:` with `opl-` in CLI mode (`adapted.name = adapted.name.startsWith('opl-') ? adapted.name : 'opl-' + adapted.name`).
     - Role-based reviewer restriction: if `frontmatter.name` or `label` contains `'reviewer'`, strip `write_file`, `edit_file`, `run_command`, and `invoke_subagent`.
     - Remove automatic haiku-to-flash or sonnet/opus-to-pro assumptions; use concrete model IDs or permitted host models.
  2. **A1.2 Content Transform, Plan Guard & Adapter**:
     - Wire `antigravity-agent-frontmatter-cli` in `content-transform.js`.
     - Add `antigravity-agent-frontmatter-cli` to non-markdown transform bypass guard in `plan.js`.
     - Implement `scripts/lib/install-targets/antigravity-cli.js`:
       - Target root: `.agents/`.
       - Namespacing: prefix skills and agents with `opl-`.
       - Directory expansion: when `sourceRelativePath === 'agents'`, expand all `.md` files from `repoRoot/agents` and assign `destinationPath: .../.agents/agents/opl-<name>.md`.
       - Omit duplicate workflows.
     - Register `antigravity-cli` in `registry.js`, `install-manifests.js`, and schema enums.
  3. **A1.3 Unit Test Suite (`tests/lib/antigravity-cli-adapter.test.js`)**:
     - Verify tool mapping, MCP tool passthrough, reviewer tool stripping, fail-closed unmapped tool rejection, frontmatter name prefixing, non-markdown bypass, and directory expansion.
  4. **A1.4 Authentic Installer Projection into Disposable Sandbox**:
     - Create runtime-generated disposable directory: `/private/var/.../pilot-tdd-<timestamp>`.
     - Initialize minimal `package.json` with Node native test runner (`node --test`).
     - Materialize projection using canonical installer target `antigravity-cli`:
       - `.agents/skills/opl-tdd/SKILL.md` (from `skills/tdd-workflow/SKILL.md`)
       - `.agents/skills/opl-coding-standards/SKILL.md` (from `skills/coding-standards/SKILL.md` — matching JavaScript pilot stack)
       - `.agents/agents/opl-tdd-guide.md` (from `agents/tdd-guide.md`)
       - `.agents/agents/opl-code-reviewer.md` (from `agents/code-reviewer.md`)
     - Create disposable writable probe fixture: `probe-writable.txt`.
     - Record full SHA-256 recursive tree hash of the workspace.
  5. **A1.5 Authentic RED -> GREEN -> REFACTOR -> REVIEW Execution**:
     - **RED**: Agent creates failing test `test/adjustment.test.js`. Execute test runner independently outside agent: `node --test test/adjustment.test.js` -> exit code > 0 confirmed, failure excerpt captured.
     - **GREEN**: Agent implements minimal logic in `src/adjustment.js`. Execute test runner independently: `node --test test/adjustment.test.js` -> exit code 0 confirmed, 4/4 pass.
     - **REFACTOR**: Agent cleans code structure (guards, readability). Execute test runner independently: `node --test test/adjustment.test.js` -> exit code 0 confirmed green.
     - **REVIEW (Assigned Scope)**: Prepare immutable review scope packet (`diff` + target files `src/adjustment.js`, `test/adjustment.test.js`). Invoke reviewer:
       `agy --sandbox --agent opl-code-reviewer --model gemini-3.8-flash-high --print-timeout 120s --output-format json -p "Review the assigned adjustment diff: <diff_content>. Do not modify any files."`.
     - **Negative Mutation Probe**: Run safe negative mutation probe against `probe-writable.txt` confirming reviewer has no write capability.
     - **Tree Integrity Check**: Compare full workspace tree hash before and after reviewer execution.
     - **Status Reporting**: Report `REVIEWER_TOOL_RESTRICTION=ENFORCED_VERIFIED` if host structurally denies write tool execution; report `COOPERATIVE` if boundary relies on prompt compliance. Distinguish native delegation vs separate CLI invocation.
- **References**: Brief §1.2, §7.1, §7.2, §7.3; `skills/tdd-workflow/SKILL.md`, `agents/tdd-guide.md`, `agents/code-reviewer.md`.
- **Acceptance Criteria**:
  - `tests/lib/antigravity-cli-adapter.test.js` passes 100%.
  - Canonical installer projects `.agents/skills/opl-tdd`, `.agents/skills/opl-coding-standards`, `.agents/agents/opl-tdd-guide.md`, and `.agents/agents/opl-code-reviewer.md`.
  - True RED (exit code > 0) captured via independent test runner.
  - True GREEN (exit code 0) captured via independent test runner.
  - Focused REFACTOR verified green via independent test runner.
  - Reviewer produces structured review from assigned immutable diff packet without shell access.
  - Tree comparison confirms zero unauthorized file mutations.
- **Dependencies**: Phase A0 completion.
- **Risk**: Medium.

---

### *** MANDATORY STOP RULE ENFORCEMENT GATE (A1 EXIT) ***

> **CRITICAL EXECUTION GATE**:
> Upon completion of Phase A1, implementation **MUST IMMEDIATELY HALT**.
> The executor must compile the Phase A1 Evidence Packet:
> - `AGY_VERSION=1.5.16`
> - `CANONICAL_SOURCE_ID=42fae4ebb5e995690d3a5752b461e475d229c40e`
> - `GOVERNING_BRIEF_DIGEST=5593df533bf74eca2d5b054419ca893f994df25c2a652fff4c304d570aa0d00b`
> - `CLI_DISCOVERY=TOOL_VERIFIED`
> - `CLI_TOOL_MAPPING=TOOL_VERIFIED`
> - `TDD_PILOT=WORKFLOW_VERIFIED`
> - `CUSTOM_REVIEWER_INVOCATION=WORKFLOW_VERIFIED`
> - `REVIEWER_TOOL_RESTRICTION=ENFORCED_VERIFIED` (or `COOPERATIVE` based on probe)
> - `TDD_GUARD_PARITY=COOPERATIVE`
>
> The report and evidence diff must be presented to the **Owner**.
> **NO STEP IN PHASE A2 THROUGH A6 MAY COMMENCE WITHOUT EXPLICIT WRITTEN OWNER RATIFICATION.**

---

### Phase A2: Core Workflow Projections, ECC-OPL Agent Adaptations & Isolated Session State

- **Goal**: Expand projected workflows to the core suite (`/opl-code-review-quick`, `/opl-refactor-clean` via `code-simplifier`, `/opl-docs-update`, `/opl-deep-research`), adapt canonical ECC-OPL agents for native CLI execution, and establish isolated, worktree-aware session state with concurrency locks.
- **Closes**: GAP-2, GAP-4.
- **Files Touched**:
  - `scripts/lib/install-targets/antigravity-cli.js`
  - `scripts/lib/install/antigravity-agent.js`
  - `scripts/lib/workflow-state.js` (New shared utility)
  - `tests/lib/antigravity-workflow-state.test.js` (New)
- **Action Steps**:
  1. **A2.1 Project Core Workflows**:
     - Map and project canonical workflow skills under `.agents/skills/`:
       - `opl-code-review-quick` (from quick review contract in `commands/code-review.md`)
       - `opl-refactor-clean` (from `commands/refactor-clean.md` using `code-simplifier`; do NOT revive `refactor-cleaner`)
       - `opl-docs-update` (from `commands/update-docs.md` + `agents/doc-updater.md`)
       - `opl-deep-research` (from `skills/deep-research/` with search/fetch tool check)
       - `opl-typography` (from `skills/typography-system/` and `commands/typography.md`)
  2. **A2.2 Native ECC-OPL Agent Adaptations**:
     - Project effective canonical agents (no standalone Sisyphus/Prometheus/Metis/Momus/Oracle/Librarian):
       - `build` -> `[read_file, edit_file, write_file, grep_search, find_by_name, run_command]`
       - `planner` (with inline Metis gap pass) -> `[read_file, grep_search, find_by_name, invoke_subagent]` (read-only for product source)
       - `plan-reviewer` (with Momus Pass 1 and Oracle Pass 2 in one invocation) -> `[read_file, grep_search, find_by_name]` (strictly read-only)
       - `architect` -> `[read_file, grep_search, find_by_name]`
       - `explore` -> `[read_file, grep_search, find_by_name]`
       - `docs-lookup` -> `[read_file, grep_search, find_by_name, read_url_content, search_web]`
       - `tdd-guide` -> `[read_file, edit_file, write_file, grep_search, run_command]`
       - `code-reviewer` -> `[read_file, grep_search, find_by_name]` (strictly read-only)
       - `code-simplifier` -> `[read_file, edit_file, write_file, grep_search, find_by_name]`
       - `doc-updater` -> `[read_file, edit_file, write_file, grep_search, find_by_name]`
       - `e2e-runner` -> `[read_file, edit_file, write_file, grep_search, find_by_name, run_command]`
  3. **A2.3 Multi-Runtime Workflow State Isolation & Concurrency Locks**:
     - In `scripts/lib/workflow-state.js`, resolve state path dynamically:
       - OpenCode target: `.opencode/workflows/active.json`
       - Antigravity CLI target: `.agents/ecc-opl/workflows/active.json`
     - Record metadata: `target: "antigravity-cli"`, `projectRoot`, `worktreeId`, `conversationId`, `workflowId`, `phase`, `checkpointDigest`, `timestamp`, `ttl: 43200` (12 hours).
     - Concurrency protection: implement lockfile (`.active.json.lock`) alongside atomic swap write (`.active.json.tmp` -> rename).
     - Guard against cross-runtime or cross-worktree clobbering: refuse silent overwrite if lock is held or runtime mismatches; require explicit handoff.
  4. **A2.4 Test Suite (`tests/lib/antigravity-workflow-state.test.js`)**:
     - Verify state isolation between `.opencode/` and `.agents/ecc-opl/`.
     - Verify 12h TTL expiry, lockfile contention rejection, and atomic write.
- **References**: Brief §5, §8.1, §8.2, §8.3; AGY-D08, AGY-D09.
- **Acceptance Criteria**:
  - Core workflow skills projected into `.agents/skills/` with `opl-` namespacing.
  - Effective ECC-OPL agents mapped with verified tool allowlists (no standalone OMO agents).
  - Workflow state in `agy` reads and writes exclusively to `.agents/ecc-opl/workflows/active.json` with lock protection.
  - OpenCode state at `.opencode/workflows/active.json` remains completely untouched.
- **Dependencies**: Phase A1 completion and Owner Gate Authorization.
- **Risk**: Low-Medium.

---

### Phase A3: Shared Plan Canvas, Exact Verdict Binding & Planning Lifecycle

- **Goal**: Connect Antigravity CLI planning sessions (`/opl-plan`, `/opl-plan-prd`) to the existing local Plan Canvas service (`scripts/plan-canvas.js`), enforcing exact cryptographic verdict binding (`verdict: "approve"`) with authentic `planner` and `plan-reviewer` agents, evaluating Canvas V2 extensions separately from base transport.
- **Closes**: GAP-5.
- **Files Touched**:
  - `scripts/plan-canvas.js`
  - `scripts/lib/plan-canvas/server.js`
  - `scripts/lib/plan-canvas/sessions.js`
  - `tests/lib/plan-canvas-antigravity.test.js` (New)
- **Action Steps**:
  1. **A3.1 Canvas Transport Integration**:
     - Bind `scripts/plan-canvas.js` to localhost (`127.0.0.1`) on dynamic/configured port.
     - Add target identifier to canvas session metadata: `target: 'antigravity-cli'`, `sessionDir: '.agents/ecc-opl/canvas/'`.
     - Verify base transport: `ecc-plan-canvas await` polls asynchronously from `agy` CLI with bounded timeout (300s).
  2. **A3.2 Cryptographic Verdict Binding**:
     - Require exact JSON verdict event: `{"kind":"verdict","verdict":"approve","revisionDigest":"<sha256>","workspace":"<path>","session":"<id>","timestamp":"<iso>"}`.
     - Reject conversational chat phrases or host UI buttons as plan authorization.
     - If plan file is modified after canvas load, flag `STALE_REVISION` and require re-render and re-approval.
  3. **A3.3 Planning Lifecycle (Planner & Plan-Reviewer)**:
     - Execute `/opl-plan` using canonical ECC-OPL agents:
       - `planner` creates implementation plan including inline Metis gap analysis. Planning is strictly read-only for product source.
       - `plan-reviewer` performs independent critique with Momus Pass 1 (executability/disk audit) and Oracle Pass 2 (architecture/edge cases) within ONE reviewer invocation and ONE verdict.
       - Maximum 3 review rounds enforced.
       - Owner reviews rendered plan in browser Canvas and submits approval verdict.
       - Owner-approved implementation belongs to a separate worker session (`build` / `tdd-guide`).
  4. **A3.4 Optional Canvas V2 Extension (Evaluated Separately)**:
     - Once base transport is accepted, evaluate Canvas V2 long prompt (100k char) and image attachment capabilities.
     - Accept image attachments with MIME validation (`image/png`, `image/jpeg`, `image/webp`), max 10MB per file, max 5 files, stored in `.agents/ecc-opl/canvas/attachments/<sha256>.<ext>`.
  5. **A3.5 Test Suite (`tests/lib/plan-canvas-antigravity.test.js`)**:
     - Test verdict parsing and SHA-256 revision validation bound to workspace and session.
     - Test rejection of stale plan digests.
     - Test base transport acceptance independently of image extensions.
- **References**: Brief §9.1, §9.2, §9.3; AGY-D10, AGY-D11; `scripts/plan-canvas.js`.
- **Acceptance Criteria**:
  - `scripts/plan-canvas.js` seamlessly launches from `agy` CLI and awaits verdict.
  - Verdict is strictly cryptographically bound to plan file SHA-256, session, and workspace.
  - Stale plan modification rejects approval and prevents build step.
  - Planning lifecycle enforces planner/reviewer separation and max 3 review rounds.
- **Dependencies**: Phase A2 completion.
- **Risk**: Low-Medium.

---

### Phase A4: Unified E2E V2 Runner, Security Audit & Integration Verification

- **Goal**: Enable the unified E2E V2 test runner (`/opl-e2e`) and preserved security audit workflow (`/opl-security-audit`) on Antigravity CLI with target-aware path resolution, registry governance, and deterministic evidence logging.
- **Closes**: GAP-2.
- **Files Touched**:
  - `.opencode/scripts/e2e-registry.mjs`
  - `skills/e2e-testing/` -> projected as `skills/opl-e2e/`
  - `skills/security-review/` -> projected as `skills/opl-security-audit/`
  - `tests/lib/e2e-antigravity-runner.test.js` (New)
- **Action Steps**:
  1. **A4.1 E2E Registry Target Resolver**:
     - Update `.opencode/scripts/e2e-registry.mjs` to resolve registry paths relative to active target root:
       - OpenCode: `.opencode/resources/e2e-journey-mapper.md` / project `TESTS.md`
       - Antigravity CLI: `.agents/ecc-opl/e2e/e2e-journey-mapper.md` / project `TESTS.md`
     - Preserve full E2E V2 surface: `map`, `run`, `full`, `status`, `help`.
     - Project `TESTS.md` remains canonical single source of truth for test IDs and coverage.
     - Playwright runs using installed project dependencies without attempting remote installs.
  2. **A4.2 E2E Execution & Negative Receipt Checking**:
     - Execute journey test on disposable project.
     - Enforce evidence schema: valid test ID, runner status (PASS/FAIL), integer assertion counts, execution timestamp, commit hash.
     - Reject malformed, skipped, or non-behavioral tests from claiming coverage in `TESTS.md`.
  3. **A4.3 Preserved Security Audit (`/opl-security-audit`)**:
     - Preserve existing ECC-OPL security audit capability from `skills/security-review/` and specialized security reviewer patterns rather than substituting a generic checklist.
     - Operate in strictly read-only mode with restricted tools (`read_file`, `grep_search`, `find_by_name`).
     - Audit secret leakage, injection vectors, input validation, CSRF, and dependency risks.
     - Isolate read-only audit findings from automatic code repair (which requires separate TDD/refactor workflow approval).
  4. **A4.4 Test Suite (`tests/lib/e2e-antigravity-runner.test.js`)**:
     - Verify target-aware registry resolution.
     - Verify E2E V2 subcommands (`map`, `run`, `status`).
     - Verify malformed test result rejection.
     - Verify read-only audit tool restrictions.
- **References**: Brief §10.1, §10.2, §10.3; AGY-F13; `.opencode/scripts/e2e-registry.mjs`.
- **Acceptance Criteria**:
  - `/opl-e2e` executes Playwright tests across `map/run/status`, updating `TESTS.md` with structured receipts.
  - Malformed or skipped tests fail closed and do not register as passing.
  - `/opl-security-audit` operates in strictly read-only mode, outputting findings without mutating source files.
- **Dependencies**: Phase A2 completion.
- **Risk**: Low-Medium.

---

### Phase A5: Design-Build V2 & Typography Fidelity (Gated on Reference Admission)

- **Goal**: Project `/opl-design-build` and `/opl-typography` to Antigravity CLI, enforcing G0–G3 visual fidelity gates, paired rendered captures, and framework adapters, strictly gated on Track A reference stabilization.
- **Closes**: GAP-6.
- **Files Touched**:
  - `scripts/design-build-v2/state-machine.mjs`
  - `scripts/design-build-v2/compare-section.mjs`
  - `scripts/design-build-v2/rendered-authority.mjs`
  - `scripts/design-build-v2/section-gate.mjs`
  - `commands/design-build.md` -> projected as `skills/opl-design-build/`
  - `commands/typography.md` -> projected as `skills/opl-typography/`
  - `tests/lib/design-build-antigravity-gate.test.js` (New)
- **Precondition Gate**: Track A OpenCode visual stabilization must certify that reference admission blockers (complete approved section scope, decodable paired PNGs across desktop 1440 and mobile 390, authoritative G2 exit codes) are resolved. If Track A is pending, Phase A5 marks `DESIGN_BUILD_REFERENCE_ADMISSION=BLOCKED` and remains inactive.
- **Action Steps**:
  1. **A5.1 Reference Admission Verification**:
     - Verify Track A admission certificate: full region manifests, decodable PNG captures across desktop-1440 and mobile-390, and coherent gate transitions.
  2. **A5.2 Framework Adapter Integration**:
     - Project framework translation specifications:
       - React/Inertia (Primary pilot): component structure, Inertia page props, Tailwind token preservation, shell inheritance.
       - Vue/Svelte/Astro & Native (Compose/Flutter): scoped styles, reactivity, platform density rules.
  3. **A5.3 Ordered Gate Chain (G0–G3) & Final Assembled Gate**:
     - G0 (Preflight): Validate design bundle hashes and clean git working tree.
     - G1 (Contract Compliance): Verify token usage against `DESIGN.md` and typography scales.
     - G2 (Rendered Fidelity): Execute paired screenshot comparison (original HTML canvas vs rendered framework component) with exact tolerance profiles.
     - G3 (Interaction): Verify focus states, responsive navigation toggles, and modal behaviors.
     - Final Assembled Gate: verify assembled page layout coherence across all sections.
  4. **A5.4 Typography Lifecycle (`/opl-typography`)**:
     - Preserve canonical DESIGN / VERIFY / AMEND lifecycle.
     - Check type scales, contrast ratios, and font loading parity.
  5. **A5.5 Bounded Repair Loop**:
     - Limit automated repairs to maximum 2 cycles per section revision.
     - Repairs modify only framework component code, never touching approved canvas references or relaxing tolerances.
  6. **A5.6 Test Suite (`tests/lib/design-build-antigravity-gate.test.js`)**:
     - Test G0–G3 gate execution on sample HTML vs React component.
     - Test failed G2 visual parity halts section advancement.
     - Test max 2 repair loop cap enforcement.
- **References**: Brief §11.1, §11.2, §11.3, §11.4; AGY-F12; `docs/plans/design-build-v2-fidelity.plan.md`.
- **Acceptance Criteria**:
  - Track A prerequisite gate strictly enforced.
  - G0–G3 gate chain halts section progression if visual discrepancies exceed tolerance.
  - Paired captures verified across desktop (1440px) and mobile (390px).
  - Repaired framework code preserves immutable canvas reference bytes.
- **Dependencies**: Phase A3 completion AND Track A Admission Certification.
- **Risk**: High.

---

### Phase A6: Canonical Distribution Manager, Packaging & Rollback Engine

- **Goal**: Reconcile distribution tooling to the actual canonical installer infrastructure (`scripts/lib/install-manifests.js`, `scripts/lib/install-executor.js`, `scripts/lib/install-targets/antigravity-cli.js`), generate deterministic SHA-256 release manifests, manage project-local ownership ledgers, and provide verified, atomic rollback rehearsals.
- **Closes**: GAP-7.
- **Security Boundary**: Guardian Angel custom hook adapter is completely dropped per owner directive. Antigravity CLI security relies strictly on native host sandbox and permission controls.
- **Files Touched**:
  - `scripts/ecc.js` / `scripts/install-apply.js`
  - `scripts/lib/install-targets/antigravity-cli.js`
  - `scripts/lib/install-targets/registry.js`
  - `scripts/lib/install-manifests.js`
  - `tests/lib/eccskills-antigravity-cli.test.js` (New)
- **Action Steps**:
  1. **A6.1 Target Adapter Registration**:
     - Verify `antigravity-cli` target adapter is registered across `registry.js`, `install-manifests.js`, and schema enums.
     - Ensure CLI entrypoint (`scripts/ecc.js` / `scripts/install-apply.js`) accepts `--target antigravity-cli` and resolves project-local `.agents/` root without global pollution.
  2. **A6.2 Deterministic Candidate Manifest**:
     - Implement manifest generator capturing:
       - Target: `antigravity-cli`
       - Canonical commit hash (`42fae4ebb5e995690d3a5752b461e475d229c40e`)
       - List of all projected files, source paths, destination paths, file sizes, and SHA-256 digests.
       - Dependency closure: runtime Node version, `js-yaml` presence, `agy` CLI version.
     - Strictly exclude untracked audit files, session logs, or private credentials.
  3. **A6.3 Project-Local Ownership Ledger**:
     - Record installed files in `.agents/.ecc-managed-manifest.json`.
     - Distinguish managed canonical files from user-custom / unmanaged files.
     - During updates, detect modified managed files and prompt with diff/conflict rather than blindly overwriting.
  4. **A6.4 Atomic Installation & Rollback Engine**:
     - Install process:
       1. Dry-run conflict check.
       2. Backup existing managed files to `.agents/.ecc-backup/<timestamp>/`.
       3. Write new files and verify hashes.
       4. Update ownership ledger.
     - Rollback process:
       1. Restore replaced files from backup.
       2. Remove newly added managed files matching the release hash.
       3. Preserve user-modified files.
       4. Restore previous ownership ledger.
       5. Verify smoke test passes.
  5. **A6.5 Test Suite (`tests/lib/eccskills-antigravity-cli.test.js`)**:
     - Test installer `--dry-run --target antigravity-cli`.
     - Test install -> modify user file -> rollback -> verify user file preserved and managed files restored.
- **References**: Brief §13.1, §13.2, §13.3; AGY-F14; `scripts/lib/install-manifests.js`.
- **Acceptance Criteria**:
  - Canonical installer CLI supports `--target antigravity-cli`.
  - Scoped dry-run displays planned operations without disk writes.
  - Atomic installation verifies all SHA-256 digests.
  - Rollback cleanly restores prior state and preserves user-authored files.
- **Dependencies**: Phase A1 completion; Phase A2-A5 components as applicable.
- **Risk**: Low-Medium.

---

## 7. Testing Strategy

The testing architecture follows a strict four-layer pyramid:

1. **Unit & Transform Tests (Deterministic Code)**:
   - `tests/lib/antigravity-cli-adapter.test.js`: Verifies CLI tool table mapping, MCP tool passthrough, frontmatter name prefixing, non-markdown transform bypass, reviewer tool stripping, and directory expansion.
   - `tests/lib/antigravity-workflow-state.test.js`: Verifies state isolation, lockfile contention rejection, and 12h TTL expiry.
   - `tests/lib/plan-canvas-antigravity.test.js`: Verifies Canvas verdict cryptographic binding, payload bounds, and stale digest rejection.
   - `tests/lib/e2e-antigravity-runner.test.js`: Verifies target resolver and Playwright runner execution receipts.
   - `tests/lib/design-build-antigravity-gate.test.js`: Verifies G0–G3 gate evaluations and bounded repair counting.
   - `tests/lib/eccskills-antigravity-cli.test.js`: Verifies manifest generation, installation atomicity, and rollback accuracy.

2. **Negative Boundary Probes (Mandatory Fail-Closed Tests)**:
   | Test Probe | Expected Deterministic Outcome |
   |---|---|
   | Agent requires unmapped tool | Transform throws validation error; fails closed. |
   | Agent declares `mcp__*` tools | Transform allows MCP tools through without error. |
   | CLI target accidentally uses project tool names (`view_file`) | Operation rejected; incompatible runtime reported. |
   | User-authored file collides with managed release path | Installer flags conflict; halts without overwrite. |
   | Canvas verdict digest != current plan file SHA-256 | Approval rejected (409 Conflict); workflow stays paused. |
   | Reviewer agent attempts to modify writable fixture | Safe negative mutation probe demonstrates tool absence / denial; tree hash unmodified. |
   | Cross-runtime workflow state access without handoff | Access denied; state isolated to `.agents/ecc-opl/`. |
   | E2E test output has skipped/error status or missing IDs | Test marked failed; coverage excluded from `TESTS.md`. |
   | Design-build component has visual discrepancy > tolerance | G2 gate fails with exit code 1; bounded repair triggered. |
   | Rollback executed in project with user edits | Owned files reverted; user edits preserved intact. |

3. **Authentic Disposable Pilot Workflow Execution (Phase A1)**:
   - Real CLI execution in `/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/antigravity/pilot-tdd-<timestamp>`.
   - Complete TDD cycle on domain logic (`validateAdjustment`).
   - True RED (failing test via independent runner) -> True GREEN (passing test via independent runner) -> True REFACTOR (structure cleaned, still green) -> True REVIEW (restricted reviewer pass with immutable diff packet).
   - Recursive workspace tree hash verification.

4. **Reference Host Regression Gate (OpenCode)**:
   - Before and after every phase, verify that OpenCode commands (`commands/plan.md`, `commands/design-build.md`), OpenCode state (`.opencode/workflows/active.json`), and OpenCode tests continue to pass with zero modifications.

---

## 8. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation Strategy |
|---|---|---|---|
| **Hung Process Interference** | High | Low | Preflight step A0.1 explicitly inspects PID 69840 conditionally before any signal. |
| **Tool Name Mismatch in CLI** | High | Low | Explicit `{ runtime: 'cli' }` passed to `adaptAntigravityAgent`, mapping `read_file`, `write_file`, `edit_file`, `grep_search`, `find_by_name`, `run_command`, `invoke_subagent`. |
| **Silent Command Collisions** | High | Low | All projected skills and agent commands use strict `opl-` namespacing (`/opl-tdd`, `/opl-plan`, etc.). |
| **Reviewer File Mutation** | Critical | Low | Reviewer agent frontmatter stripped of write/edit/command tools; immutable diff packet provided; pre/post recursive tree hash verification. |
| **Cross-Runtime State Bleed** | High | Low | Strict isolation of active state to `.agents/ecc-opl/workflows/active.json` with worktree and conversation ID binding and lockfile protection. |
| **Canvas Approval Spoofing** | Critical | Low | Strict JSON cryptographic verdict verification (`{"kind":"verdict","verdict":"approve"}`) bound to exact plan SHA-256, session, and workspace. |
| **Design-Build Quality Regression** | High | Medium | Phase A5 remains strictly BLOCKED until Track A OpenCode visual stabilization is independently certified. |
| **Distribution Clutter / Overwrite** | Medium | Low | Target-specific ownership ledger in canonical installer; backup creation before write; fully rehearsed rollback. |

---

## 9. Decisions I Made For You

| Decision | Default Chosen | Reversible? |
|---|---|---|
| **Pilot Directory Location** | `/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/antigravity/pilot-tdd-<timestamp>` (runtime-generated temp root). | Yes (configurable via env) |
| **Reviewer Model Mapping** | Concrete model IDs verified via `agy models` (`gemini-3.8-flash-high`, `claude-sonnet-5-5-high`). | Yes (via agent frontmatter) |
| **State File Storage Path** | `.agents/ecc-opl/workflows/active.json` with lockfile for target isolation. | Yes (path resolver parameter) |
| **Canvas V2 Feedback Cap** | 100,000 characters for long-form feedback; 10MB per attachment (max 5 images), evaluated separately from base transport. | Yes (server config parameter) |
| **Phase A1 Stop Rule** | Mandatory full stop upon A1 exit gate (`CLI_TDD_PILOT=WORKFLOW_VERIFIED`); require explicit owner approval for A2. | No (Safety invariant) |
| **Track A Precondition on A5** | Phase A5 strictly gated on Track A visual stabilization admission. | No (Quality invariant) |
| **Guardian Angel Exclusion** | Completely dropped from Antigravity CLI scope per owner directive; security relies strictly on native host sandbox and permission controls. | Yes (Owner decision) |

---

## 10. Success Criteria & Evidence Matrix

| IS Row | Proven By | QA Evidence Command / Path |
|---|---|---|
| **IS-1 (CLI Workflows)** | Phase A1 TDD pilot execution; Phase A2 core workflow projections. | `agy --sandbox -p '/opl-tdd ...'` producing clean RED-GREEN-REFACTOR output in pilot workspace. |
| **IS-2 (OpenCode Untouched)** | Git diff inspection across all phases; targeted OpenCode regression tests. | `git diff -- .opencode/ commands/` returns zero changes; `npm test` passes. |
| **IS-3 (Reviewer Read-Only)** | Phase A1 reviewer tree integrity check & negative mutation probe; Phase A2 code review. | Full recursive tree hash before and after reviewer execution returns identical digest; negative mutation probe fails closed. |
| **IS-4 (State Isolation)** | Phase A2 workflow state contract tests; multi-runtime execution. | `node tests/lib/antigravity-workflow-state.test.js` passes; `.opencode/workflows/active.json` unmodified. |
| **IS-5 (Canvas Verdict Binding)** | Phase A3 Plan Canvas pilot with live approval and stale revision rejection. | `node tests/lib/plan-canvas-antigravity.test.js` passes; 409 Conflict verified on altered plan. |
| **IS-6 (Visual Fidelity Gate)** | Phase A5 G0–G3 gate chain with paired rendered captures (contingent on Track A). | `node tests/lib/design-build-antigravity-gate.test.js` passes; paired 1440/390 PNG receipts recorded. |
| **IS-7 (Reversible Distribution)** | Phase A6 canonical installer manifest generation and rollback rehearsal. | `node tests/lib/eccskills-antigravity-cli.test.js` passes; rollback restores prior state exactly. |

---

## 11. Hand-off & Next Action

1. **Plan Persistence**: This revised plan (r2) is written and persisted to disk at:
   `docs/plans/ecc-opl-antigravity-cli-native-port.plan.md`
2. **Review & Verification**: Subagent `plan-reviewer` will be invoked to run BOTH Momus (Pass 1) and Oracle (Pass 2) within one reviewer invocation and return a single review verdict.
3. **Execution Authorization**:
   - The executor must STOP after plan review is delivered.
   - Implementation of Phase A0 and Phase A1 will NOT begin until the owner explicitly approves this revised r2 plan.
