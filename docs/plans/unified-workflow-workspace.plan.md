# Implementation Plan: Unified Engineering-Artifact Workspace (`.ecc-opl/`)

## Overview

Introduce a project-local engineering-artifact workspace at `.ecc-opl/` that groups every working artifact a work item produces — research, PRD, plan, TDD record, review, design, e2e, audit, docs deltas, evidence, canvas — under one work-item directory, with a derived progress index and one consolidated report per work item. Existing state machines (the OpenCode workflow state file, markers) remain the sole execution authority; the workspace adds no second engine. Delivered in two stages: Stage 1 (workspace + resolution + research/plan + TDD/review/refactor routing + Pilots A/B) is shippable; Stage 2 (design-build/typography/Canvas, e2e, security-audit, docs-update, report finalization, runtime handoff, git hygiene, legacy) is gated behind an owner verdict after the pilots.

## Runtime surface facts (verified 2026-11-28)

- `.opencode/opencode.json` `"command"` maps commands to `{file: commands/<name>.md}` **resolved inside `.opencode/`**. For the OpenCode runtime the authoritative command bodies are `.opencode/commands/*.md`. Repo-root `commands/*.md` is the legacy/Claude-compat surface (AGENTS.md: `commands/` is legacy, `skills/` canonical).
- **38 commands registered** in `.opencode/opencode.json`: build-dashboard, build-fix, checkpoint, code-review, code-review-quick, database-review, deep-research, design-build, e2e, e2e-map, eval, evolve, go-build, go-review, go-test, init-deep, instinct-export, instinct-import, instinct-status, learn, orchestrate, plan, projects, promote, refactor-clean, rules-add, rules-map, security, security-audit, security-scan, setup-pm, skill-create, tdd, test-coverage, typography, update-codemaps, update-docs, verify.
- `.opencode/commands/` contains 46 files; `loop-start.md` exists as a file but is **not registered**.
- **`/plan-prd` is NOT registered** in `.opencode/opencode.json` and has no `.opencode/commands/plan-prd.md`. Its only body is root `commands/plan-prd.md` (legacy surface), writing `.claude/prds/{name}.prd.md`. Treated as an open decision (see Remaining Owner Decisions); this plan does **not** silently assume `/plan-prd` is active in OpenCode, and Stage 1 adds **nothing that depends on PRD production**.
- **38 agents registered**, including: planner, plan-reviewer, doc-updater, code-reviewer, explore, code-simplifier, security-hunter, security-verifier, intent-gate, pr-test-analyzer, tdd-guide, refactor-cleaner, build, build-error-resolver, e2e-runner, multimodal-looker. Dispatch steps below use these exact names.
- **Installer facts** (reviewer-verified): `package.json` `"files"` already contains `"scripts/lib/"` (line 164) — subpaths under it are stripped by `isCoveredByAncestor` in `tests/scripts/npm-publish-surface.test.js:161-164,183`, so adding `"scripts/lib/work-item/"` there fails the publish-surface test. The `shared-script-utils` module (`manifests/install-modules.json:1524-1556`) ships `scripts/lib/*` and targets `opencode` + `antigravity` (+ others) but **not** `antigravity-cli`, and lists neither `scripts/lib/work-item/work-item.js` nor `scripts/lib/state-store/file-lock.js`. `hooks-runtime` (the only other `scripts/lib` module) is excluded from the default `opencode` profile (`manifests/install-profiles.json:14-21`) and does not target `antigravity-cli` (`install-modules.json:107-113`).
- **Test invariants** (reviewer-verified): `tests/lib/antigravity-closure.test.js:91-94` asserts repo-root `commands/{design-build,typography}.md` stay byte-identical to their `.opencode/` counterparts. `tests/design-build-v2-invariants.test.js:135-146,535-552` and `tests/lib/design-build-direction-a11y.test.js:170-179` pin `skills/design-build/SKILL.md` content plus SHA-256/byte entries in `staging/distribution/design-build-v2-manifest.json` and `docs/plans/design-build-v2/foundation-manifest.json`. Any design-build/typography edit must be lockstep across all of these or `npm test` fails.
- `scripts/ci/catalog.js` + `scripts/ci/generate-command-registry.js` scan `commands/`, `agents/`, `skills/` only — `npm run command-registry:write` is **not** required for `.opencode/commands/`-only edits.
- **Namespace note**: the new `scripts/lib/work-item/work-item.js` (plain-file work-item routing for the artifact workspace) is unrelated to the existing `scripts/work-items.js` (SQLite-backed roadmap/control-pane CLI over `state-store`). No shared code, no shared storage.

## Affected User and Ideal State

**Affected user**: the developer operating ECC-OPL (and application projects consuming it) who runs `/plan` → `/tdd` → `/code-review-quick` → `/update-docs` chains across sessions. Today each workflow scatters artifacts across `docs/plans/`, `docs/research/`, `.claude/prds/`, `docs/design/`, `docs/releases/`, `.claude/plans/`, `~/security-audit-runs/` with no linkage; after, every artifact of one work item lives in one place with a derived progress view and one consolidated report.

| Row | Statement | Reason |
|---|---|---|
| IS-1 | The developer can start any workflow chain and find every artifact of that work item under `.ecc-opl/work-items/<id>/` without hunting five directories | one location per work item removes cross-session context loss |
| IS-2 | The developer can read `.ecc-opl/work-items/<id>/progress.json` (derived) to see what a work item has produced | derived index answers "where are we" without reading every file |
| IS-3 | Existing execution state (workflow state file phases/gates, markers) keeps working unchanged — the workflow-gate plugin never breaks | no second mutable state; zero regression risk to gated workflows |
| IS-4 | Old artifacts (`docs/plans/*`, `.claude/prds/*`, `docs/design/*`) stay readable and resumable; standalone workflows behave byte-identically to today | legacy resumability preserved; nothing destructively moved |
| IS-5 | One consolidated report per work item at `.ecc-opl/reports/<WI-ID>.md` replaces artifact-by-artifact narration | single review surface for the owner |
| GAP-1 | Today artifacts are scattered across ≥7 locations with no work-item linkage | context loss between sessions; manual archaeology per chain |
| GAP-2 | Today there is no per-work-item progress view; only a single global workflow state file | "where are we" requires reading state file + artifact dirs |
| GAP-3 | Today `/refactor-clean` writes to an ambiguous "approved artifact directory"; `/verify` reports exist only in chat | outputs evaporate or land nowhere defined |

Every task closes at least one GAP row. Stage 2 closes the remaining rows (design/e2e/audit routing, report finalization, runtime handoff).

## Requirements

### Must have
- `.ecc-opl/` project-local workspace: `active/`, `work-items/<id>/`, `runtime/`, `archive/`, `reports/`.
- Work-item dirs: `manifest.json`, `progress.json` (derived), `timeline.jsonl` (append-only), plus `research/ prd/ plan/ implementation/ review/ design/ e2e/ audit/ documentation/ evidence/ canvas/` — created lazily on first write.
- Work-item id `WI-YYYYMMDD-NNN-slug` with run/revision sub-identity in filenames (e.g. `plan.r2.md`, `review-run1.md`), not in the id.
- **Binding lifecycle**: a work item can be closed (unbind, directory intact) and archived (moved under `.ecc-opl/archive/`). Binding is never sticky: `close` clears the pointer.
- **Standalone escape hatch on every routed command**: `--standalone` flag, with precedence `explicit --standalone` > `$ECC_OPL_STANDALONE=1` > `.ecc-opl/active` pointer > standalone default (no pointer ⇒ standalone).
- One consolidated report per work item at `.ecc-opl/reports/<WI-ID>.md` with fixed delivery-status and verification-status enums.
- Existing state machines stay execution authority: the OpenCode workflow state file keeps phases/gates; markers keep incremental baselines. Workspace carries no gates.
- Progress index derived from `timeline.jsonl` — regenerable, never hand-edited, never a source of truth.
- Standalone workflows (no work item) keep current canonical paths unchanged.
- Works when invoked from an application project dir (cwd-based), not only the ECC repo; helper resolves across OpenCode, Antigravity CLI, and repo-checkout installs.
- Installer delivers every changed file via the `shared-script-utils` module (covers `opencode` + `antigravity-cli` targets).
- OpenCode and Antigravity share artifacts but keep isolated execution ownership.

### Must NOT have (scope guardrails)
- No new agents, no new DB, no MCP server, no orchestrator. `scripts/lib/state-store/` sqlite stays install-state-only.
- No relocation of `docs/CODEMAPS/`, `docs/GUIDES/`, `docs/adr/` (authoritative docs).
- No reactivation of retired surfaces: `.claude/PRPs/*`, `prp-*` commands, `multi-*` ccg-workflow commands; `e2e-map.md` stays unread by `/e2e`.
- No destructive migration: nothing is moved or deleted from legacy locations.
- **No auto-commit, no `git rm --cached`, no auto-untracking of any file.**
- No second state machine; no new dependencies.
- No changes to the `workflow-gate` plugin contract or the workflow state file schema (only `plan_ref.path` values change).
- No Stage 1 dependency on PRD production (deferred to Owner Decision 1).

## Artifact Producer → Consumer Map (current state)

| Workflow (command) | Producer (agent/command body) | Current output path | Type | Consumer | Lifetime | Authority | Git behaviour | Action |
|---|---|---|---|---|---|---|---|---|
| `/plan` | planner (subagent) | `docs/plans/<slug>.plan.md` | plan | plan-reviewer, `/tdd`, workflow state `plan_ref` | per feature | plan file | committed | **Stage 1: reroute to work item** |
| `/deep-research` | research agents | `docs/research/<topic-slug>.md` | research | planner, `/plan` | per topic | research file | committed | **Stage 1: reroute when work-item-bound** |
| `/plan-prd` (root legacy only, unregistered in OpenCode) | — | `.claude/prds/{name}.prd.md` | PRD | `/plan` | per feature | PRD file | committed | **Stage 1: routing DEFERRED (Owner Decision 1); no Stage 1 change** |
| `/tdd` | tdd-guide | `docs/releases/<v>/<name>.tdd.md` (also observed: `docs/design/*.tdd.md`, `.claude/tdd/`, `.github/tdd/`) | TDD record | doc-updater, PR review | per task | TDD record | committed | **Stage 1: reroute to work item** |
| `/code-review-quick` | code-reviewer | chat report + `.opencode/markers/code-review-quick.md` | review + baseline | developer, next run's delta | marker: rolling | marker = baseline | marker gitignored; report: chat only | **Stage 1: persist report to work item; marker stays** |
| `/refactor-clean` | code-simplifier | "approved artifact directory" (plan-bound, ambiguous) | report+JSON+diff+manifest | external review gate | per run | receipt | unset | **Stage 1: define as work item `review/`** |
| `/verify` | build agent | chat only | verification report | developer | ephemeral | — | none | **Stage 1: persist to work item `implementation/`** |
| `/design-build`, `/typography` | design pipeline | `docs/design/*` (DESIGN.md, `contracts/`, BUILD-STATE.md, ASSETS.md, `sections/`, `evidence/`, TYPOGRAPHY-MAP.md) | design artifacts | design-build resume, Canvas | per feature | contract files | committed | **Stage 2: route per-feature artifacts; BUILD-STATE resume retargeted; lockstep edit required** |
| `/e2e` | e2e-runner | `TESTS.md` + `.opencode/scripts/e2e-registry.mjs` + evidence | registry + evidence | e2e gates (DEC-06/07) | registry: durable | registry | committed | **Stage 2: registry stays; run evidence → work item `e2e/`** |
| `/security-audit` | security-hunter/verifier | `~/security-audit-runs/<repo>/run-<N>/` (outside repo) | findings, coverage ledger | auditor | per run | RUN_DIR | outside repo | **Stage 2: keep RUN_DIR; write pointer+summary into work item `audit/`** |
| `/update-docs`, `/update-codemaps` | doc-updater | `docs/CODEMAPS/`, `docs/GUIDES/`, README + `.opencode/markers/docs-sync.md` | authoritative docs + delta report | repo readers | docs: durable | docs | committed | **Stage 2: docs stay; delta report → work item `documentation/`; marker stays** |
| `/eval` | — | `.claude/evals/<feature>.md` (+`.log`) | eval defs/results | release gates | per feature | eval file | unset | **Stage 2: route to work item when bound** |
| `/loop-start` (unregistered file) | — | `.claude/plans/` runbook | runbook | loop-operator | per loop | runbook | unset | **Stage 2: route when bound** |
| Canvas | plan-canvas server | `~/.claude/plan-canvas*/` (host-owned) + `docs/design/sections/` | session store, HTML sections | design-build verdict gate | per session | server.json | host-owned | **Stage 2: pointer into work item `canvas/`** |
| `/build-dashboard` | build agent | `docs/design/contracts/[FEATURE]-CONTRACT.md` | design contract | design-build | per feature | contract | committed | **Stage 2: route when work-item-bound** |
| Execution state | all gated commands | `.opencode/workflows/` state file (`active.json`) | state (phases/gates) | workflow-gate plugin, every gated command | rolling | **execution authority** | untracked working state | **unchanged — never duplicated** |
| Incremental baselines | code-review-quick, update-docs | `.opencode/markers/*.md` | markers | same commands, next run | rolling | baseline | gitignored | **unchanged** |

## Source authorities (exact files per workflow)

- `/plan`: `.opencode/commands/plan.md` (writes the workflow state file at lines 20–22 — **note: it does not currently write `plan_ref`; adding `plan_ref.path` in Step 3 is additive**, dispatches planner, writes `docs/plans/<slug>.plan.md`).
- `/tdd`: `.opencode/commands/tdd.md` (reads plan, TDD record per `skills/tdd-workflow/SKILL.md` path convention).
- `/code-review-quick`: `.opencode/commands/code-review-quick.md` (marker read/write at lines ~24–69).
- `/refactor-clean`: `.opencode/commands/refactor-clean.md` (artifact-directory sentence, line ~42).
- `/verify`: `.opencode/commands/verify.md`.
- `/deep-research`: `.opencode/commands/deep-research.md` (line 51: output path).
- PRD: `commands/plan-prd.md` (root legacy; lines 19–144). **No `.opencode/` body exists; `/plan` does not produce PRDs.**
- `/design-build`: `.opencode/commands/design-build.md` **and** root `commands/design-build.md` (byte-identical per closure test); `/typography`: both counterparts likewise.
- Design skill: `skills/design-build/SKILL.md` (content-pinned by invariants tests).
- `/e2e`: `.opencode/commands/e2e.md` (registry ops via `.opencode/scripts/e2e-registry.mjs`).
- `/security-audit`: `.opencode/commands/security-audit.md` (RUN_DIR, lines ~37–129).
- `/update-docs`: `.opencode/commands/update-docs.md` (docs-sync marker, lines ~21–112); `/update-codemaps`: `.opencode/commands/update-codemaps.md`.
- State schema: `skills/workflow-state/SKILL.md`.
- Installer authorities: `manifests/install-modules.json` (`shared-script-utils` at lines 1524–1556), `manifests/install-components.json`, `manifests/install-profiles.json`, `package.json` (`bin`, `files`), `agent.yaml`, `tests/scripts/npm-publish-surface.test.js` (explicit pack assertions ~lines 219–328), `staging/distribution/design-build-v2-manifest.json`, `docs/plans/design-build-v2/foundation-manifest.json`.

## State / Progress Architecture (no second mutable state)

Three layers, strictly separated:

1. **Execution state (authority, unchanged)** — `.opencode/workflows/active.json` keeps `workflow/phase/gates/write_policy`. The `workflow-gate` plugin reads only this. Markers (`.opencode/markers/`) keep incremental baselines. **No workflow state is ever written to `.ecc-opl/`.**
2. **Routing pointer (new, minimal, non-sticky)** — `.ecc-opl/active` (plain text work-item id, one line). Written by `ensure`/explicit bind; cleared by `close`. It carries **no phases, no gates** — it answers "which work item am I appending to", nothing else. Commands without a bound item — and every command invoked with `--standalone` or `ECC_OPL_STANDALONE=1` — ignore it.
3. **Record layer (new, derived)** — `timeline.jsonl` is append-only event log (`{ts, workflow, artifact, path, note}`); `progress.json` is a pure function of `timeline.jsonl` (regenerable via the helper; never hand-edited; never consulted by gates). `manifest.json` is write-once identity (id, slug, created, workflows[]) plus a `status` field updated only by explicit lifecycle events (`close`/`archive`).

Contradiction check: "no second mutable state" vs `manifest.status` — resolved: `status` mirrors lifecycle events from `timeline.jsonl` and is regenerable like progress; gates never read it.

## Shared Helper (one new module, no new infrastructure)

**Decision: add `scripts/lib/work-item/work-item.js` (zero-dep CommonJS, ~200 lines). Do NOT extend `scripts/lib/state-store/`** — that module is a sqlite projection of install state with its own schema/migrations; work-item routing is plain-file and must work in any application project without a DB. Do NOT extend `scripts/lib/plan-canvas/` — canvas-specific. (Distinct from `scripts/work-items.js`, the SQLite roadmap CLI — see Runtime surface facts.)

CLI contract (all paths resolved from `process.cwd()` or explicit `--root`, never from the ECC install root):

```
node <helper> resolve [--id <id>] [--root <dir>]     # print bound/explicit work item id or "none"; exit 0 either way
node <helper> ensure --slug <slug> [--id <id>]       # create WI-YYYYMMDD-NNN-slug lazily; idempotent; binds pointer
node <helper> append --workflow <n> --artifact <k> --path <p> [--note <n>]  # append timeline event (file-locked)
node <helper> progress [--id <id>]                   # rebuild progress.json from timeline.jsonl
node <helper> close [--id <id>]                      # clear .ecc-opl/active; append work-item.closed event; dir intact
node <helper> archive <id>                           # move .ecc-opl/work-items/<id> → .ecc-opl/archive/<id>; update archive index
```

Exit codes (all subcommands): `0` success (including `resolve` returning "none"); `1` resolution/usage error (no active work item for `append`/`progress`/`close` without `--id`, unknown subcommand, bad flag); `2` filesystem error (unwritable dir, lock failure). `archive` on a nonexistent id → exit 1; on an already-archived id → exit 1 with "already archived".

- Id generation: scan `.ecc-opl/work-items/WI-<date>-*` for next `NNN` — stateless, no counter file.
- Concurrency: reuse `scripts/lib/state-store/file-lock.js` (`withStateStoreLock`) for `timeline.jsonl` appends — already cross-platform, already tested.
- **Helper resolution order** (multi-root, matching the pattern in `.opencode/commands/design-build.md:181-183`; works for plugin installs, OpenCode config installs, Antigravity CLI, and repo checkouts):

```bash
WI=""
for R in "$CLAUDE_PLUGIN_ROOT" \
         "${OPENCODE_CONFIG_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/opencode}" \
         "./.agents" "." "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"; do
  if [ -n "$R" ] && [ -f "$R/scripts/lib/work-item/work-item.js" ]; then
    WI="$R/scripts/lib/work-item/work-item.js"; break
  fi
done
```

- **Fallback rule (single documented behaviour)**: if no `work-item.js` resolves, the command **proceeds in standalone (legacy) mode and says so in one line** (`"work-item helper not found — running standalone (legacy paths)"`). It **never** silently writes `.ecc-opl/` from an inline heredoc, and it never aborts the chain. This is the only fallback; there is no second one.

## Implementation Steps

### Stage 1 (shippable increment; ends in a working chain)

#### Phase 1.1 — Workspace foundation + helper

1. **Create workspace layout + gitignore** (File: `.gitignore`)
   - Action: Stage 1 ignores the whole workspace with a pattern that permits later un-ignores: `.ecc-opl/*` plus explicit un-ignores **commented but disabled in Stage 1** (`# !.ecc-opl/reports/` — Git does not descend into a fully-ignored directory, so `.ecc-opl/` as a bare rule would make the Stage 2 un-ignore a no-op). Create `.ecc-opl/{active,work-items,runtime,archive,reports}/` via the helper's first run only — no checked-in empty dirs. Local-only alternative documented: `.git/info/exclude` (never committed) for developers who want the workspace invisible without touching the shared `.gitignore`.
   - Why: owner ratified gitignored working artifacts; the `.ecc-opl/*` form keeps Stage 2 un-ignores possible.
   - Closes: GAP-1 (foundation).
   - References: `.gitignore` lines 101–120 (existing `.opencode/` ignores).
   - Acceptance: `git check-ignore -v .ecc-opl/work-items/x` matches the `.ecc-opl/*` rule; `git status --porcelain` clean after helper runs.
   - QA happy: run helper `ensure` in a temp project → dirs exist, `git status --porcelain` clean. QA failure: run `ensure` twice with same slug same day → same id returned, no duplicate dir.
   - Dependencies: None. Risk: Low.

2. **Implement work-item helper** (File: `scripts/lib/work-item/work-item.js`, tests at `tests/scripts/work-item.test.js`)
   - Action: implement `resolve/ensure/append/progress/close/archive` per the CLI contract above; reuse `file-lock.js`; JSDoc; ~200 lines.
   - Why: single shared routing brain with a complete binding lifecycle; avoids per-command path drift and sticky-binding hijack.
   - Closes: GAP-1, GAP-2.
   - References: `scripts/lib/state-store/file-lock.js`, `scripts/lib/state-store/index.js` (style reference), `scripts/work-items.js` (namespace disambiguation only).
   - Acceptance: all six subcommands work from a temp dir that is not the ECC repo; `progress` output is a pure rebuild (delete progress.json, rerun, identical bytes); `close` clears `.ecc-opl/active` and leaves the directory; `archive` moves the dir and updates the index.
   - QA happy: `ensure --slug demo && append ... && progress && close && archive` → pointer gone, dir under `.ecc-opl/archive/`, exit 0 each step. QA failure: `append` after `close` → exit 1 "no active work item"; `archive` twice → exit 1 "already archived".
   - Dependencies: None. Risk: Low.

#### Phase 1.2 — Stage 1 routing changes (OpenCode commands)

Every routed command below gains the same binding preamble, stated once here and referenced by steps 3–6:

```bash
# binding precedence: --standalone flag > $ECC_OPL_STANDALONE=1 > --work-item <id> > .ecc-opl/active > standalone default
# --work-item <id> is passed through so explicit binding works before any pointer exists.
if [ "$1" = "--standalone" ] || [ "$ECC_OPL_STANDALONE" = "1" ]; then MODE=standalone
elif [ -n "$EXPLICIT_ID" ]; then WI=$(node "$WI_HELPER" resolve --id "$EXPLICIT_ID") && MODE=bound
else WI=$(node "$WI_HELPER" resolve); [ "$WI" = "none" ] && MODE=standalone || MODE=bound; fi
```

Standalone mode is **byte-identical to today's behavior** — no `.ecc-opl/` writes of any kind.

3. **`/plan` routing** (File: `.opencode/commands/plan.md`)
   - Action: after context synthesis, if bound (per the preamble) → `ensure` the item and write the plan to `.ecc-opl/work-items/<id>/plan/<slug>.plan.md`; write the state file with `plan_ref.path` set to that path (**additive** — `plan.md:20-22` does not write `plan_ref` today; schema otherwise unchanged). Standalone → keep `docs/plans/<slug>.plan.md`. Append timeline event on write.
   - Why: plan is the chain root; consumers (plan-reviewer, tdd) read whatever `plan_ref.path` says.
   - Closes: GAP-1.
   - References: `.opencode/commands/plan.md` lines 14–63; `skills/workflow-state/SKILL.md`.
   - Acceptance: work-item-bound `/plan` produces file under work item + timeline event + `plan_ref.path` pointing there; standalone `/plan` output byte-identical to today's behavior.
   - QA happy: simulate bound plan in temp project → file exists at work-item path, state file valid JSON with new path. QA failure: `ensure` fails (unwritable dir) → plan falls back to `docs/plans/` with a warning line, never aborts the chain.
   - Dependencies: Steps 1–2. Risk: Medium (touches the gated command).

4. **`/tdd` routing** (File: `.opencode/commands/tdd.md`)
   - Action: plan lookup order becomes: explicit path arg → state file `plan_ref.path` (read it first — do not guess) → work-item `plan/` via helper resolve → `docs/plans/<slug>.plan.md` (legacy). TDD record path: bound → `.ecc-opl/work-items/<id>/implementation/<name>.tdd.md` (+ evidence under `implementation/`); standalone → keep the three legacy locations from `skills/tdd-workflow/SKILL.md`. Append timeline events at RED/GREEN checkpoints.
   - Why: TDD record is the highest-volume artifact; closes the three-location ambiguity for bound work.
   - Closes: GAP-1, GAP-3.
   - References: `.opencode/commands/tdd.md` line 40; `skills/tdd-workflow/SKILL.md` (Plan Handoff, record paths).
   - Acceptance: bound run writes record into work item; a legacy plan (or `plan_ref.path` target) still found by the lookup chain.
   - QA happy: bound tdd run in temp project → `.tdd.md` in `implementation/`, timeline has red+green events. QA failure: helper unreachable → tdd proceeds with legacy paths (documented fallback), chain not blocked.
   - Dependencies: Step 3. Risk: Medium.

5. **`/code-review-quick` + `/verify` + `/refactor-clean` persistence** (Files: `.opencode/commands/code-review-quick.md`, `.opencode/commands/verify.md`, `.opencode/commands/refactor-clean.md`)
   - Action: bound runs write outputs to `.ecc-opl/work-items/<id>/review/<date>-<slug>-run<N>.md` (review), `implementation/verify-<date>.md` (verify), and `review/refactor-<pass>-run<N>.{md,json}` + diff + SHA-256 manifest (refactor-clean — its "approved artifact directory" becomes the work item `review/` dir when bound). Markers stay in `.opencode/markers/` untouched. Standalone → current behavior (chat-only for verify; existing behavior for the others).
   - Why: closes GAP-3; refactor-clean's ambiguous destination becomes concrete.
   - Closes: GAP-3.
   - References: `code-review-quick.md` lines 24–69; `refactor-clean.md` line 42.
   - Acceptance: bound runs leave files; markers unchanged in content and location.
   - QA happy: bound code-review-quick → report file + marker updated. QA failure: work item absent → verify prints report to chat exactly as today.
   - Dependencies: Steps 1–2. Risk: Low.

6. **`/deep-research` routing + PRD disposition** (Files: `.opencode/commands/deep-research.md`; PRD: documentation only)
   - Action: deep-research bound → `.ecc-opl/work-items/<id>/research/<topic-slug>.md`; standalone → `docs/research/` unchanged. **PRD authoring is NOT attributed to `/plan`** — the only PRD producer is `commands/plan-prd.md` (unregistered in OpenCode). Stage 1 records PRD routing as **DEFERRED pending Owner Decision 1** and documents both branches: **(A)** project `commands/plan-prd.md` → `.opencode/commands/plan-prd.md` + register in `.opencode/opencode.json` (makes `/plan-prd` real; bound output → `<id>/prd/`), or **(B)** `/plan` gains an explicit PRD-artifact mode (bound output → `<id>/prd/`). No Stage 1 step depends on PRD production.
   - Closes: GAP-1.
   - References: `deep-research.md` line 51; `commands/plan-prd.md` lines 72–144.
   - Acceptance: bound research lands in work item; standalone unchanged; no PRD code shipped in Stage 1.
   - QA happy/failure: same pattern as step 3.
   - Dependencies: Steps 1–2. Risk: Low.

7. **Installer delivery** (Files: `manifests/install-modules.json`, `tests/scripts/npm-publish-surface.test.js`)
   - Action: add **`scripts/lib/work-item/work-item.js`** and **`scripts/lib/state-store/file-lock.js`** to the `paths` array of the **`shared-script-utils`** module (`manifests/install-modules.json:1524-1556`), and add **`"antigravity-cli"`** to that module's `targets` array (`opencode` is already present). Do **NOT** add `"scripts/lib/work-item/"` to `package.json` `"files"` — `"scripts/lib/"` already covers it and a duplicate subpath fails `isCoveredByAncestor` (`tests/scripts/npm-publish-surface.test.js:161-164,183`). Instead add `scripts/lib/work-item/work-item.js` to the explicit `npm pack` assertion list in that test (~lines 219–328). No `catalog:sync`/`command-registry:write` needed — those scan `commands/`, `agents/`, `skills/` only.
   - Why: installer must deliver changed files to OpenCode **and** Antigravity CLI targets — a hard owner constraint; `hooks-runtime` cannot be used because the default `opencode` profile excludes it and it lacks the `antigravity-cli` target.
   - Closes: GAP-1 (portability).
   - References: `manifests/install-modules.json:1524-1556`; `manifests/install-profiles.json:14-21`; `tests/scripts/npm-publish-surface.test.js:161-164,183,219-328`; `CONTRIBUTING.md` "Before You Push".
   - Acceptance: `npm test` green including publish-surface test; a fresh `shared-script-utils` install into an OpenCode config dir and an Antigravity CLI target both contain `scripts/lib/work-item/work-item.js`.
   - QA happy: `npm test` passes; simulate install → helper file present at `${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}/scripts/lib/work-item/work-item.js` and the Antigravity CLI scripts destination. QA failure: remove the helper from the installed tree → publish-surface/install assertions fail (proves the gate works).
   - Dependencies: Steps 2–6. Risk: Medium.

#### Phase 1.3 — Pilots (owner-gated evidence)

8. **Pilot A — full chain in one work item** (no production file changes; exercise in a scratch project or this repo on a throwaway branch)
   - Action: run `/deep-research` (bound) → `/plan` (bound) → `plan-reviewer` → approve → `/tdd` (bound, one trivial slice) → `/code-review-quick` (bound) → `close`. Verify: one work-item dir contains research/, plan/, implementation/, review/; progress.json reflects all; state-file transitions survive; consolidated report drafted manually per the report contract (Stage 2 automates); after `close`, a subsequent `/verify` runs standalone.
   - Closes: GAP-1, GAP-2, GAP-3 (proof).
   - References: steps 2–6 outputs.
   - Acceptance: checklist of 8 artifact paths all present under one `<id>/`; no writes to legacy paths during the bound run; pointer cleared after `close`.
   - QA happy: directory listing + progress.json contents recorded in pilot notes. QA failure: intentionally kill mid-chain → resume via state file + work item id works (legacy resumability contract).
   - Dependencies: Steps 1–7. Risk: Medium.

9. **Pilot B — standalone coexistence, order-independent** (no production file changes)
   - Action: run `/deep-research` standalone (via `--standalone`, and in a separate pass via no-pointer) and one bound review-only work item in the same project, **in both orders** (bound-then-standalone and standalone-then-bound) to prove binding is not sticky. Verify standalone writes to `docs/research/` unchanged while bound writes to the work item; no cross-contamination of `.ecc-opl/active`; after `close`, standalone is the default again.
   - Closes: IS-4 (standalone support proof).
   - References: step 2 `close`; step 6 routing.
   - Acceptance: both outputs in expected locations in both orderings; `.ecc-opl/active` unchanged by standalone runs and cleared by `close`.
   - QA happy: paths verified in both orders. QA failure: run bound command with stale `.ecc-opl/active` pointing at deleted item → helper returns "none", command falls back to standalone with warning.
   - Dependencies: Steps 1–7 (parallel with Step 8). Risk: Low.

### Stage 2 (gated behind owner verdict on Pilot A/B — do not start without it)

10. **Design-build/typography/Canvas routing — lockstep edit** (Files: `.opencode/commands/design-build.md`, `.opencode/commands/typography.md`, `commands/design-build.md`, `commands/typography.md`, `skills/design-build/SKILL.md`, `staging/distribution/design-build-v2-manifest.json`, `docs/plans/design-build-v2/foundation-manifest.json`)
    - Action: route per-feature design artifacts: `docs/design/DESIGN.md`, `contracts/*-CONTRACT.md`, `ASSETS.md`, `TYPOGRAPHY-MAP.md`, `sections/<NN>-<slug>.html`, `evidence/<pageId>/<sectionId>-receipt.json` → `.ecc-opl/work-items/<id>/design/...` (same relative structure) when bound; standalone keeps `docs/design/`. `BUILD-STATE.md` → `<id>/design/BUILD-STATE.md`; `--resume` resolves via work item first, then legacy `docs/design/BUILD-STATE.md`. Canvas: keep `~/.claude/plan-canvas*/` host-owned; write a pointer file `<id>/canvas/session.json` (canvas key + section paths).
    - **Lockstep requirement** (test-enforced): edit repo-root `commands/design-build.md` + `commands/typography.md` **and** their `.opencode/commands/` counterparts **byte-identically** (`tests/lib/antigravity-closure.test.js:91-94`), update `skills/design-build/SKILL.md` content (pinned by `tests/design-build-v2-invariants.test.js:135-146,535-552` and `tests/lib/design-build-direction-a11y.test.js:170-179`), and refresh the SHA-256/byte entries in both distribution manifests in the same commit.
    - Closes: GAP-1 (design lane). Dependencies: owner gate. Risk: High (resume path + evidence receipts + manifest hashes).
    - References: paths listed above; `.opencode/commands/design-build.md:20,85-86,167,196,299-300`.
    - Acceptance: `npm test` green (closure + invariants + a11y tests); bound design-build run writes under `<id>/design/`; `--resume` finds a bound BUILD-STATE.
    - QA happy: bound run in temp project → `design/sections/` populated, resume succeeds from work item. QA failure: deliberately diverge the root and `.opencode/` copies → closure test fails (proves the lockstep gate).
11. **E2E routing** (File: `.opencode/commands/e2e.md`)
    - Action: `TESTS.md` + registry script stay canonical and committed (authority). Bound runs write run evidence (traces, screenshots, reconciliation) to `<id>/e2e/`. Registry-change proposals unchanged (DEC-06).
    - Closes: GAP-1 (e2e lane). Risk: Medium.
    - References: `.opencode/commands/e2e.md` (boundary table, DEC-06/07); `TESTS.md`; `.opencode/scripts/e2e-registry.mjs`.
    - Acceptance: bound `run` leaves evidence under `<id>/e2e/`; registry writes still gated.
    - QA happy: bound e2e run → evidence files in work item, `TESTS.md` untouched by evidence. QA failure: registry write attempted without DEC-06 approval → command refuses (unchanged behavior).
12. **Security-audit pointer** (File: `.opencode/commands/security-audit.md`)
    - Action: `RUN_DIR` stays at `~/security-audit-runs/<repo>/run-<N>/` (outside repo, by design). Bound runs append a pointer + top-line summary to `<id>/audit/run-<N>.md`. Validators unchanged.
    - Closes: GAP-1 (audit lane). Risk: Low.
    - References: `.opencode/commands/security-audit.md:37,54-57,125-129`.
    - Acceptance: bound audit leaves pointer file; RUN_DIR location unchanged.
    - QA happy: bound audit run → `<id>/audit/run-<N>.md` exists with RUN_DIR path. QA failure: RUN_DIR unwritable → command fails as today; no pointer written.
13. **Docs-update delta routing** (Files: `.opencode/commands/update-docs.md`, `.opencode/commands/update-codemaps.md`)
    - Action: authoritative docs (`docs/CODEMAPS/`, `docs/GUIDES/`, README) stay put. Exploration-delta report and run summary → `<id>/documentation/`. Marker stays in `.opencode/markers/`.
    - Closes: GAP-1 (docs lane). Risk: Low.
    - References: `.opencode/commands/update-docs.md:17,21,62,89,112`; `.opencode/commands/update-codemaps.md:11-38`.
    - Acceptance: bound docs run writes delta report into work item; authoritative docs still land in `docs/`.
    - QA happy: bound update-docs → delta report in `<id>/documentation/`, marker updated. QA failure: marker write fails → docs update proceeds, warning only (marker is baseline, not gate).
14. **Consolidated report generation via existing doc-updater** (File: `.opencode/commands/update-docs.md` — a work-item report mode appended; no new command file unless owner prefers)
    - Action: final phase of a work item invokes `doc-updater` (existing agent) with the work item's timeline + progress + artifact index as input; output written to **`.ecc-opl/reports/<WI-ID>.md`** — one stable filename, no slug duplication (`<WI-ID>` already embeds the slug). Fixed report fields: **delivery status** ∈ {`COMPLETED`, `COMPLETED_WITH_LIMITATIONS`, `BLOCKED`, `PARTIALLY_COMPLETED`, `CANCELLED`} and **verification status** ∈ {`VERIFIED`, `PARTIAL`, `UNVERIFIED`, `BLOCKED`, `NOT_RUN`, `NOT_SUPPORTED`}, plus artifact index and timeline summary. No new agent, no new orchestrator.
    - Closes: GAP-2, IS-5. Risk: Low.
    - References: `.opencode/commands/update-docs.md`; `doc-updater` agent registration in `.opencode/opencode.json`.
    - Acceptance: bound work item finalization produces `.ecc-opl/reports/<WI-ID>.md` containing both status enums.
    - QA happy: finalize a pilot work item → report exists with `deliveryStatus` and `verificationStatus` fields. QA failure: doc-updater dispatch fails → report generated from timeline+progress by the command itself with `verificationStatus: UNVERIFIED` (never silently skipped).
15. **Runtime handoff (`runtime/`) + git hygiene** (Files: `.gitignore`, `.ecc-opl/runtime/README.md`)
    - Action: `runtime/` holds cross-runtime handoff pointers (`opencode.json`, `antigravity.json`) recording which runtime owns in-flight execution — pointers only, never gates. Git hygiene: keep the `.ecc-opl/*` ignore rule and **enable** the un-ignores: `!.ecc-opl/reports/` and (per Owner Decision 3) un-ignore each intermediate directory before `manifest.json`: `!.ecc-opl/work-items/`, `!.ecc-opl/work-items/*/`, `.ecc-opl/work-items/*/*`, `!.ecc-opl/work-items/*/manifest.json` (a bare `!.ecc-opl/work-items/*/manifest.json` never applies while `work-items/` is ignored); document `.git/info/exclude` as the local-only alternative. **Guardrails: never `git rm --cached`, never auto-untrack, never auto-commit.** Antigravity projection: `scripts/lib/install-targets/antigravity-cli.js` projects `.opencode/` directly at install time, so `.opencode/commands/*.md` edits reach Antigravity CLI through the normal install flow; **`staging/distribution/design-build-v2-manifest.json` is a 36-file OpenCode `~/.config/opencode/` manifest, not an Antigravity pattern** — it is refreshed only by the Step 10 lockstep requirement.
    - Closes: IS-5 (durability), owner constraint "OpenCode + Antigravity share artifacts, isolated execution ownership". Risk: Medium.
    - References: `.gitignore` (Stage 1 rule from step 1); `scripts/lib/install-targets/antigravity-cli.js:333-334`; `staging/distribution/design-build-v2-manifest.json`.
    - Acceptance: `git check-ignore .ecc-opl/reports/<WI-ID>.md` returns non-matching (tracked-able); `git status` shows reports as untracked-not-ignored; no commit is made by any workflow.
    - QA happy: create report → `git status --porcelain` lists it as `??` (untracked, not ignored). QA failure: attempt `git rm --cached` in a workflow step → forbidden by plan guardrail; reviewer rejects.
16. **Legacy compatibility close-out** (no file moves)
    - Action: document in `docs/GUIDES/` (via update-docs) that `docs/plans/`, `.claude/prds/`, `docs/design/`, `docs/releases/*/…tdd.md` remain readable archives; new work routes to `.ecc-opl/`. Verify `/tdd` fallback finds a legacy plan end-to-end.
    - Closes: IS-4. Risk: Low.
    - References: `docs/GUIDES/`; `skills/tdd-workflow/SKILL.md` record paths.
    - Acceptance: guide section exists; legacy lookup test passes.
    - QA happy: `/tdd` with only a legacy `docs/plans/*.plan.md` present → plan found via fallback chain. QA failure: neither work-item plan nor legacy plan exists → tdd prompts for a plan path (unchanged behavior).

## Runtime projection changes

- **OpenCode**: all Stage 1/2 edits land in `.opencode/commands/*.md` (authoritative bodies). Root `commands/*.md` is legacy-compat — updated **only** where a legacy surface actively produces artifacts or a closure test demands lockstep (`design-build`, `typography` in Stage 2), never to diverge behavior.
- **Antigravity CLI**: `scripts/lib/install-targets/antigravity-cli.js` projects `.opencode/` directly at install time; helper delivery goes through `shared-script-utils` (Step 7). No Antigravity-specific logic in Stage 1.
- **Registration gap**: `/plan-prd` is unregistered in OpenCode. Stage 1 defers all PRD routing; Owner Decision 1 picks branch A (register the command) or branch B (`/plan` PRD-artifact mode).

## Migration / Legacy Compatibility

- Nothing is moved, renamed, or deleted. All legacy paths remain readable; `plan_ref.path`, `--resume`, and plan lookups use fallback chains (explicit arg → state pointer → work item → legacy).
- `.ecc-opl/` is additive; Stage 1 leaves zero legacy file touched except the six command bodies + `.gitignore` + installer manifest + publish-surface test.
- Rollback = `git revert` the slice; `.ecc-opl/` is untracked data in Stage 1, delete at will. **Stage 2 caveat**: once `!.ecc-opl/reports/` un-ignores tracked artifacts, reverting `.gitignore` alone does not hide them — clean or locally exclude (`.git/info/exclude`) the workspace files; and reverting command/helper changes on **installed** targets requires re-running `scripts/install-apply.js` (repo `git revert` does not touch installed copies).

## Testing Strategy

- Unit: `tests/scripts/work-item.test.js` — resolve/ensure idempotency, NNN sequencing, append locking, progress purity (rebuild determinism), cwd independence (run from nested dir), standalone returns "none", `close` clears pointer, `archive` moves + index, exit codes 0/1/2 per contract.
- Integration: scripted chain in a temp project — ensure → plan → tdd → review → progress rebuild → close → archive; fallback paths (helper missing → standalone notice, stale active pointer, legacy plan lookup, `--standalone`/`ECC_OPL_STANDALONE` precedence).
- E2E (manual, pilots): Pilot A/B checklists above, including both orderings in Pilot B; evidence recorded in pilot notes under the work item itself (dogfooding).
- Regression: `npm test` full roster after each slice (publish-surface pack assertions, antigravity-closure + design-build invariants for Stage 2, catalog sync — no command-registry regeneration needed for `.opencode/`-only edits).

## Risks & Mitigations

- **Risk**: editing gated commands (`plan.md`, `tdd.md`) breaks the workflow-gate contract. Mitigation: state-file schema untouched; only `plan_ref.path` (additive) changes; Pilot A exercises the gate before Stage 2.
- **Risk**: `.ecc-opl/active` pointer sticks and hijacks later standalone work. Mitigation: `close` subcommand, `--standalone`/`ECC_OPL_STANDALONE` escape hatches, Pilot B order-independence test.
- **Risk**: helper unresolvable in some install shape. Mitigation: five-root resolution order matching `design-build.md`'s pattern; single documented standalone fallback with one-line notice.
- **Risk**: concurrent appends corrupt `timeline.jsonl`. Mitigation: `file-lock.js` (proven in state-store).
- **Risk**: gitignored workspace loses plans on machine loss. Mitigation: Stage 2 tracks `reports/` (+ optional manifest); owner decision on plan durability recorded below.
- **Risk**: installer misses new files. Mitigation: `shared-script-utils` delivery + explicit pack assertion in `npm-publish-surface.test.js`.
- **Risk**: Stage 2 lockstep edits break pinned manifest hashes. Mitigation: refresh SHA-256/byte entries in the same commit; invariants tests gate the merge.

## Decisions I made for you

| Decision | Default chosen | Reversible? |
|---|---|---|
| Helper vs extend state-store | New `scripts/lib/work-item/work-item.js`; state-store stays install-state-only (only `file-lock.js` reused) | yes |
| Helper delivery | `shared-script-utils` module paths + `antigravity-cli` target; pack assertion in publish-surface test; no `package.json` files change | yes |
| Current-work-item binding | `.ecc-opl/active` plain-text pointer + `--work-item` override + `close`/`archive` lifecycle | yes |
| Binding precedence | `--standalone` > `$ECC_OPL_STANDALONE=1` > `.ecc-opl/active` > standalone default | yes |
| `progress.json` mutability | Pure function of timeline.jsonl, regenerable, never hand-edited | yes |
| Standalone workflows | Keep current canonical paths byte-for-byte; single fallback = standalone with one-line notice | yes |
| PRD production in OpenCode | **DEFERRED** (Owner Decision 1); no Stage 1 PRD dependency; both branches documented | yes |
| Stage 1 git behaviour | `.ecc-opl/*` ignored (un-ignore-ready form); reports un-ignored in Stage 2 | yes |
| Refactor-clean artifact dir | Work item `review/` when bound; unchanged when standalone | yes |
| TDD record location (bound) | Single location `<id>/implementation/` (collapses the three-legacy-location ambiguity for new work) | yes |
| `BUILD-STATE.md` classification | Working artifact → work item `design/`; resume uses fallback chain | yes |
| Report filename | `.ecc-opl/reports/<WI-ID>.md` (no slug duplication) with fixed status enums | yes |

## Success Criteria

| IS row | Proven by | QA evidence |
|---|---|---|
| IS-1 | Pilot A checklist (step 8) | work-item dir listing: research/, plan/, implementation/, review/ populated |
| IS-2 | Helper `progress` (steps 2, 8) | `progress.json` contents after chain run |
| IS-3 | Pilot A resume test (step 8 failure QA) | state-file transitions recorded; workflow-gate never errors |
| IS-4 | Pilot B both orderings (step 9) + step 16 fallback test | standalone output at legacy path in both orders; legacy plan found by `/tdd` |
| IS-5 | Stage 2 step 14 | `.ecc-opl/reports/<WI-ID>.md` exists with both status enums, generated by doc-updater |

## Remaining Owner Decisions

1. **`/plan-prd` in OpenCode**: branch A — project `commands/plan-prd.md` into `.opencode/commands/plan-prd.md` + register it in `.opencode/opencode.json` (makes `/plan-prd` real), or branch B — `/plan` gains a PRD-artifact mode. (Default adopted: deferred; Stage 1 has no PRD dependency either way.)
2. **Plan durability**: Stage 1 gitignores plans inside the workspace. Should `.ecc-opl/work-items/*/plan/` also be git-tracked (un-ignored) so plans survive machine loss and code review, or is the Stage 2 consolidated report sufficient durable record? (Default: report-only; plans local.)
3. **`manifest.json` tracking** in Stage 2 git hygiene: track (identity record; requires `!.ecc-opl/work-items/*/manifest.json` un-ignore) vs gitignore (pure local). (Default: track.)
4. **`archive/` policy**: manual `archive` subcommand only (default) vs automatic archive when a work item's report is finalized.
5. **Consolidated report command surface**: extend `/update-docs` with a work-item report mode (default) vs a new registered command file.
