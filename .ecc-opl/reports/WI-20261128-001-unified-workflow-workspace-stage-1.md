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
| `tests/scripts/work-item.test.js` | PASS 6/6 |
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

`npm test` aborts in its first step, `scripts/ci/check-unicode-safety.js`, on 48 violations
that already exist at HEAD (`docs/e2e-v2/**`, `docs/design/phase2-slice.md`, local
`.playwright-mcp/**`). The remaining gates were run individually: agents, commands, rules,
skills, skill-host-compat, hooks, hooks-schema-keys and carrier-closure pass; install-manifests,
context-profiles and no-personal-paths fail identically at HEAD (verified by stashing the Stage 2
tree and re-running the same validators).

## Limitations

- Command bodies are LLM instructions; bound routing was proven through the helper, not by a
  headless run of `/plan`, `/design-build` or the escape hatches.
- The Laravel/Inertia Vue Canvas adapter is still untested live (no such project available).
- Consumer projects must add `.ecc-opl/*` to their own `.gitignore`; the installer does not.
- `.ecc-opl/runtime/` stays local (pointer contract documented in `docs/CUSTOM-WORKFLOW.md` §6),
  so its `README.md` template is written but not tracked.
- A bound `security-audit`/`e2e`/`design-build` run has not been executed end to end; only the
  documented contract and helper behaviour are verified.

## Next step

Owner runs one real bound `/design-build` (or `/e2e`) in a project with `.ecc-opl/*` present and
reports the outcome; that closes the command-execution gap.
