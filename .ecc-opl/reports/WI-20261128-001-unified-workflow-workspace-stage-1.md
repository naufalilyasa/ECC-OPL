# WI-20261128-001-unified-workflow-workspace-stage-1 — Unified workflow workspace

deliveryStatus: COMPLETED_WITH_LIMITATIONS
verificationStatus: VERIFIED

## Summary

`.ecc-opl/` workspace, work-item helper and routing for the OpenCode command surface
(Stage 1), plus Stage 2 routing for design-build/typography, e2e evidence, security-audit
pointers, docs deltas, the consolidated report contract and git hygiene.

## Objective

One work item, one engineering workspace, one consolidated report — without a second
execution engine, new agents, or destructive migration.

## Decisions

- `.opencode/workflows/active.json` stays the only execution state; `progress.json` is derived.
- Binding precedence: `--standalone` > `ECC_OPL_STANDALONE=1` > `--work-item <id>` >
  `.ecc-opl/active` > standalone.
- Only `reports/` and `work-items/*/manifest.json` are tracked.
- PRD routing remains DEFERRED (no PRD producer in OpenCode).

## Artifacts

| Artifact | Path |
|---|---|
| Helper + tests | `scripts/lib/work-item/work-item.js`, `tests/scripts/work-item.test.js` |
| Routing (Stage 1) | `.opencode/commands/{plan,tdd,code-review-quick,verify,refactor-clean,deep-research}.md` |
| Routing (Stage 2) | `.opencode/commands/{design-build,typography,e2e,security-audit,update-docs,update-codemaps}.md` |
| Lockstep mirrors | `commands/design-build.md`, `commands/typography.md` |
| Skill | `skills/design-build/SKILL.md` |
| Manifests | `staging/distribution/design-build-v2-manifest.json`, `docs/plans/design-build-v2/foundation-manifest.json` |
| Installer | `manifests/install-modules.json` (`shared-script-utils` + `antigravity-cli`) |
| Git | `.gitignore` (`.ecc-opl/*` + un-ignores) |
| Docs | `docs/CUSTOM-WORKFLOW.md` §6, `docs/plans/unified-workflow-workspace.plan.md` |
| Pilot evidence | `evidence/pilot-a.md`, `evidence/pilot-b.md` |

## Verification

| Check | Result |
|---|---|
| `tests/scripts/work-item.test.js` | PASS 7/7 (includes the `type: module` host regression) |
| `tests/lib/antigravity-closure.test.js` | PASS 13/13 (root and `.opencode/` bodies byte-identical) |
| `tests/design-build-v2-invariants.test.js` | PASS (manifest digests re-verified) |
| `tests/lib/design-build-direction-a11y.test.js` | PASS 10/10 |
| `tests/lib/install-manifests.test.js` | PASS 43/43 |
| Installer dry-run (`opencode`, `antigravity-cli`) | helper delivered at both targets |
| Pilot A (full chain) | VERIFIED at helper level |
| Pilot B (order independence) | PARTIAL — escape hatches reviewed, not executed |
| `node tests/run-all.js` (Stage 2 tree) | 7897 passed, 141 failed |
| `node tests/run-all.js` (HEAD baseline, same tree) | 7897 passed, 141 failed |
| Failure-set diff (HEAD vs Stage 2) | 0 new, 0 fixed — identical sets |
| `npm run catalog:check` / `command-registry:check` | PASS (no doc-table drift: no new command) |
| Bound run in consumer project `cc-reminder` | PASS — bind, artifact routing, `progress.json` rebuild, report, close |
| `cc-reminder` `node --test` during that run | 27/30 pass; 3 failures are an incomplete `googleapis` install, not code |
| `cc-reminder` after `npm ci` | `node --test` 57/57 pass, exit 0 |
| Bound `/security-audit` in `cc-reminder` | PASS — `RUN_DIR` stayed in `~/security-audit-runs/`, pointer written to `work-items/WI-20261128-002-.../audit/run-1.md`, all three validators PASS |
| Bound `/design-build` Phase 0 in `cc-reminder` | PASS — `DESIGN_ROOT` resolved to `work-items/WI-20261128-002-.../design`, brief + `BUILD-STATE.md` written there |
| Bound `/design-build` full run in `cc-reminder` | PASS — brief → taste → contract freeze → 3 sections previewed, owner-approved, ported; runtime gate passed via bound `/e2e` |
| Bound `/e2e` in `cc-reminder` | PASS — 8 flows, Chromium, fresh scratch DB, 0 console errors; `PASS_AD_HOC_UNREGISTERED` (project has no `TESTS.md`); evidence in `work-items/WI-20261128-002-.../e2e/dashboard-states-2026-11-28/` |

`npm test` aborts in its first step, `scripts/ci/check-unicode-safety.js`, on 48 violations
that already exist at HEAD (`docs/e2e-v2/**`, `docs/design/phase2-slice.md`, local
`.playwright-mcp/**`). The remaining gates were run individually: agents, commands, rules,
skills, skill-host-compat, hooks, hooks-schema-keys and carrier-closure pass; install-manifests,
context-profiles and no-personal-paths fail identically at HEAD (verified by stashing the Stage 2
tree and re-running the same validators).

## Consumer-project bound run (`cc-reminder`)

First run outside the ECC repo, on `/Users/ctp-itdev2/Documents/my-project/cc-reminder`
(Node 24, `"type": "module"`, not a git repo, pre-existing `.agents/` install).

| Step | Result |
|---|---|
| `work-item.js resolve` before binding | `none`, exit 0 |
| `ensure --slug unified-workflow-workspace-bound-verification` | created `WI-20261128-001-...`, wrote `.ecc-opl/active` |
| artifact dirs | all 11 created (`research` … `canvas`) |
| `append --workflow verify --artifact evidence` | timeline event recorded |
| `progress` | `progress.json` rebuilt from the timeline |
| consolidated report | `.ecc-opl/reports/<WI-ID>.md` written |
| `close` | pointer cleared, directory kept, `manifest.json` `status: closed` |
| `node --test` | 27 pass / 3 fail; all 3 fail on a missing `googleapis/build`, not code |

Defect found and fixed: the helper is CommonJS, but a project with `"type": "module"`
makes `.js` files ESM, so it died with `require is not defined`. Fix is the standard
per-directory format marker — `scripts/lib/work-item/package.json` and
`scripts/lib/state-store/package.json` containing `{"type":"commonjs"}` — both added to
the `shared-script-utils` install module so the installer ships them. Regression test:
`tests/scripts/work-item.test.js` now runs `ensure` inside a `type: module` host.

## Limitations

- Command bodies are LLM instructions; the bound run executed the documented `/verify`
  steps directly, not through a headless command runner.
- The Laravel/Inertia Vue Canvas adapter is still untested live (no such project available).
- Consumer projects must add `.ecc-opl/*` to their own `.gitignore`; the installer does not.
- `.ecc-opl/runtime/` stays local (pointer contract documented in `docs/CUSTOM-WORKFLOW.md` §6),
  so its `README.md` template is written but not tracked.
- Bound `design-build` was exercised end to end in `standalone-html` preview mode only. The
  React/Next and Laravel/Inertia Vue preview adapters remain unrun.
- The bound `e2e` run is ad hoc: `cc-reminder` has no `TESTS.md`, so the outcome is
  `PASS_AD_HOC_UNREGISTERED` and the run is not repeatable by a second person without
  re-deriving the steps.
- `tests/scripts/npm-publish-surface.test.js` fails on a large pre-existing drift between
  `package.json#files` and the install-module graph; identical at HEAD.

## Next step

No surface from the follow-up list is unrun. Promoting the ad hoc e2e run to a repeatable
suite needs a `TESTS.md` entry plus a committed Playwright spec in the consumer project,
which is a registry change requiring its own approval.
