# WI-20261128-001-unified-workflow-workspace-stage-1 — Unified workflow workspace

deliveryStatus: COMPLETED_WITH_LIMITATIONS
verificationStatus: PARTIAL

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
| Bound `/design-build` Phase 0 in `cc-reminder` | PASS — `DESIGN_ROOT` resolved to `work-items/WI-20261128-002-.../design`, brief + `BUILD-STATE.md` written there, stops at `BRIEF_PENDING` |

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
- `design-build` was executed bound only through Phase 0 (brief); taste, contract freeze,
  scaffold and the section loop are unrun, so their routing is still untested.
- A bound `security-audit` or `e2e` run has not been executed; only their documented contracts
  are verified.
- `tests/scripts/npm-publish-surface.test.js` fails on a large pre-existing drift between
  `package.json#files` and the install-module graph; identical at HEAD.

## Next step

Owner answers the three brief questions in cc-reminder's
`.ecc-opl/work-items/WI-20261128-002-.../design/brief.md` and runs `/design-build --resume`;
that exercises contract freeze and the section loop. A bound `/e2e` or `/security-audit` run
remains the last untested surface.
