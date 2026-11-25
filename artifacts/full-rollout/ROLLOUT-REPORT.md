# ECC-OPL — Antigravity CLI Full Active Workflow Rollout

Candidate: working tree on `ae1514ac` (8 commits ahead of `origin/main`, unpushed).
Host: `agy` 1.5.17. Model: `gemini-3.8-flash-high`. No push, no global install, no OpenCode change.

---

## 1. Installed workflow list

12 public entrypoints, one per workflow, all discovered natively:

| Workflow | Entrypoint | Source |
|---|---|---|
| deep research | `opl-deep-research` | `.opencode/commands/deep-research.md` |
| planning | `opl-plan` | `.opencode/commands/plan.md` |
| PRD | `opl-plan-prd` | `commands/plan-prd.md` |
| TDD | `opl-tdd` | `.opencode/commands/tdd.md` |
| code review | `opl-code-review-quick` | `.opencode/commands/code-review-quick.md` |
| refactor | `opl-refactor-clean` | `.opencode/commands/refactor-clean.md` |
| docs | `opl-docs-update` | `.opencode/commands/update-docs.md` |
| typography | `opl-typography` | `.opencode/commands/typography.md` |
| security audit | `opl-security-audit` | `.opencode/commands/security-audit.md` |
| E2E V2 | `opl-e2e` + `opl-e2e-map` | `.opencode/commands/e2e.md`, `e2e-map.md` |
| design-build V2 | `opl-design-build` | `.opencode/commands/design-build.md` |

Supporting knowledge skills keep their own names so the entrypoint stays unambiguous:
`opl-design-build-knowledge` (frontmatter `name: design-build`), `opl-deep-research-knowledge`,
`opl-tdd-tdd-workflow`, `opl-typography-typography-system`.

## 2. Installed agents and skills

**13 agents** (native `agents/<name>/agent.md` layout):
`opl-planner`, `opl-plan-reviewer`, `opl-build`, `opl-architect`, `opl-a11y-architect`,
`opl-explore`, `opl-docs-lookup`, `opl-tdd-guide`, `opl-code-reviewer`,
`opl-code-simplifier`, `opl-doc-updater`, `opl-e2e-runner`, `opl-security-reviewer`.

**36 skills** — 12 entrypoints + 24 knowledge/support:
better-typography, coding-standards, compose-multiplatform-patterns, dart-flutter-patterns,
design-contract-system, design-system, frontend-a11y, frontend-design-direction,
frontend-scaffold, gan-style-harness, image, plan-canvas, react-patterns, security-scan,
taste, typescript-patterns, ux-typography, vue-patterns, workflow-state,
plus the four `-knowledge` pairs above and
`opl-frontend-design-direction/scripts/check-evidence.js`.

**Runtime dependencies**: `.opencode/prompts/security-audit/`, 4 `scripts/security-audit/*`
validators, `scripts/e2e-registry.mjs`, `.opencode/scripts/e2e-registry.mjs`,
`scripts/design-build-v2/section-gate.mjs`.

Preserved as required: inline Metis stays inside `opl-planner`; Momus+Oracle stay as two
passes inside one `opl-plan-reviewer` invocation. No standalone OMO agents. No retired agent
revived. No tool permission widened — `opl-code-reviewer` is `read_file`, `grep_search`,
`find_by_name`; `opl-planner` keeps `invoke_subagent`. Models pass through unchanged
(`sonnet`, `opus`) — no silent retiering.

## 3. Installation scope and paths

Project-local only: `<project>/.agents/`. Global installation was **not** performed: the
installer has no verified global target for `antigravity-cli`, and §7 forbids inventing one.

49 artifacts installed, 0 conflicts, 0 skipped.

## 4. Commands

Dry-run (verified, 49 operations, 0 warnings):

```bash
node <repo>/scripts/install-apply.js --target antigravity-cli \
  --modules antigravity-cli-workflows-full --dry-run --json
```

Install:

```bash
node <repo>/scripts/install-apply.js --target antigravity-cli \
  --modules antigravity-cli-workflows-full
```

Module resolution: `antigravity-cli-workflows-full` depends on
`antigravity-cli-tdd-minimal` and `shared-script-utils`, so the TDD set is never duplicated.

## 5. Native discovery results

```
12/12 workflow entrypoints discoverable   (opl-* listed by agy)
13/13 agents discoverable                 (project agents, .agents/agents/)
```

`agy --agent <name>` still does not resolve project agents; natural-language delegation
works and was used for every smoke test.

## 6. Workflow smoke tests

| Family | Status | Evidence |
|---|---|---|
| Planning | WORKFLOW_VERIFIED | Reported `workflow: plan`, start phase `awaiting-approval`, dispatches `planner` |
| TDD | WORKFLOW_VERIFIED | Real RED → native `opl-tdd-guide` delegation → GREEN 2/2 → state `phase: done`, `redVerified: true` |
| Code review | DISCOVERABLE | Reviewer read-only tool table confirmed; not executed this round |
| Deep research | DISCOVERABLE | Reported delegation to `explore` + `docs-lookup` |
| Refactor | DISCOVERABLE | Reported 2 passes (deadcode, slops) via `code-simplifier` |
| Documentation | DISCOVERABLE | Reported `explore` + `doc-updater` |
| Typography | DISCOVERABLE | Reported 3 modes (DESIGN/VERIFY/AMEND) |
| Security audit | DISCOVERABLE | Reported 2 modes + `validate-findings.cjs` |
| E2E V2 | DISCOVERABLE | Reported 5 subcommands + `e2e-registry.mjs` |
| Design-build V2 | **BLOCKED** | Track A admission absent — execution correctly refused |

State isolation verified: installed artifacts reference `.agents/ecc-opl/workflows/active.json`
only; zero `.opencode/workflows|markers` references; no `.opencode/` directory created.

## 7. Unresolved blockers

1. **Design-build execution blocked** — Track A reference admission is not certified. The
   implementation and dependencies are installed; execution refuses with
   `TRACK_A_NOT_ADMITTED`. No admission certificate was manufactured.
2. **`agy --agent` does not resolve project agents** — natural-language delegation works.
3. **E2E mapper dependency closure not exercised live** — registry and mapper are installed;
   a live journey was not run.
4. **Global installation not supported** — installer has no verified global target for this
   host; project-local only.
5. **Full `tests/run-all.js` not run** — 11 focused suites, 161 tests, 0 failures.
6. **Nothing committed, pushed, or deployed.**

## 8. Backup and restore

Snapshot before install (no snapshot existed, so one was taken in the rehearsal):

```bash
cp -a .agents .agents.pre-install
```

Restore without deleting the current tree:

```bash
mv .agents .agents.failed-install
cp -a .agents.pre-install .agents
```

The canonical installer has no rollback command; recovery is a directory snapshot by design
of this scope. No new rollback engine was introduced.

## 9. Candidate identity

- Repo HEAD: `ae1514ac`, 8 commits ahead of `origin/main` (unpushed)
- Working tree: 15 modified tracked files + 4 untracked (installer guard fix, two install
  modules, projection fixes, acceptance artifacts)
- Installed artifact sample digests (sha256, first 16):
  `opl-tdd/SKILL.md` `363f0f186b8d3f51`, `opl-plan/SKILL.md` `5205d022a2d1b9a0`,
  `opl-planner/agent.md` `e41e2feddaa9e293`, `opl-code-reviewer/agent.md` `f0fc800e089e093f`

## 10. Quick start

From any application project root:

```bash
# 1. Install the suite (once per project)
node <repo>/scripts/install-apply.js \
  --target antigravity-cli --modules antigravity-cli-workflows-full

# 2. Snapshot first if .agents already exists
cp -a .agents .agents.pre-install

# 3. Run a workflow
agy --sandbox --print "Read .agents/skills/opl-tdd/SKILL.md and follow it for <task>"
agy --sandbox --print "Use the opl-plan project agent to plan <feature>"

# 4. Check workflow state
cat .agents/ecc-opl/workflows/active.json
```

---

## Installer safety fix (§2)

Root cause: `ownership-guard.js:82` gated skipping on `editedConfig`, which
`hasEditedCodexUserConfig` returns `false` for on every non-Codex target. Managed files whose
bytes had drifted were overwritten unconditionally.

Fix: the guard now reads the destination digest (no-follow, ino/dev recheck, containment via
`assertWithinTrustedRoot`) and compares it with the recorded `contentSha256`. Drift, or a
missing digest, preserves the file and reports it. The destination is rechecked immediately
before mutation. Two tests that encoded the old overwrite contract were inverted to encode
preservation.

Verified through the real entrypoint: install, edit a managed file, reinstall →
`Preserved user-modified managed file … bytes differ from the recorded digest`, hash
unchanged.
