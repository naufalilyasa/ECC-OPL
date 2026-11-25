# ECC-OPL Antigravity CLI — Final Full Rollout Report

**Status:** COMPLETE — installed, verified, design-build still blocked.
**Date:** 2026-11-25

---

## 1. Exact candidate identity

| Item | Value |
|------|-------|
| HEAD | `ae1514ac` (`fix(antigravity-cli): resolve round-4 review findings`) |
| State | **uncommitted working tree** — nothing committed, nothing pushed |
| Branch | `main`, 8 commits ahead of `origin/main` |
| Uncommitted tracked changes | 21 files modified |
| Uncommitted new files | `scripts/lib/install-targets/antigravity-destinations.js`, `tests/lib/antigravity-skill-tree.test.js`, `tests/lib/antigravity-review-fixes5.test.js`, plus artifacts |

No new commit or tag was created; identity is HEAD + working tree.

## 2. Corrections applied

### §1 — Skill-tree relocation (root cause fixed)

`sourceSkillDir` used the **immediate parent directory**, so a nested companion resolved
`skills/tdd-workflow/scripts/runner.js` to the bogus skill root `scripts`. Reproduced exactly:

```
before: .agents/skills/opl-tdd-scripts/scripts/runner.js
        .agents/skills/opl-tdd-references/references/examples.md
        .agents/skills/opl-a11y-scripts/scripts/scan.py   ← non-colliding skill also split
```

Fixed with `sourceSkillRoot()` (returns `skills/<name>` segment 2, not the parent) and by
grouping operations per skill tree. A collision is now detected only when two **different**
source roots share one destination key; **non-colliding trees pass through untouched**.

After:

```
.agents/skills/opl-tdd/SKILL.md                    (command orchestrator, public name)
.agents/skills/opl-tdd-tdd-workflow/SKILL.md       (knowledge skill, relocated)
.agents/skills/opl-tdd-tdd-workflow/scripts/runner.js
.agents/skills/opl-tdd-tdd-workflow/references/examples.md
.agents/skills/opl-a11y/scripts/scan.py            (unchanged)
```

### §2 — Command authority (explicit, not last-wins)

Two entrypoints could both project to `opl-tdd/SKILL.md`. Selection is now explicit with a
documented rank: `.opencode/commands/` (2) > `commands/` (1). Losing command entrypoints are
dropped; losing **knowledge** trees are relocated. Verified on installed bytes:
`opl-tdd/SKILL.md` has `name: opl-tdd`, 4 `tdd-guide` references, 4 `.agents/ecc-opl/workflows`
references, and writes the isolated state path — it is the customized ECC-OPL orchestrator, not
the upstream knowledge skill (which sits at `opl-tdd-tdd-workflow` with `name: tdd-workflow`).

### §3 — Module closure (two real gaps found)

The selector modules had been reduced to 0 and 1 paths. Two defects surfaced:

1. **`supportsModule` rejected any module with no paths**, so `antigravity-cli-tdd-minimal`
   and every dependent was skipped entirely. Now a module with dependencies is installable.
2. **`scripts/` and `.opencode/scripts/` were not in `SUPPORTED_SOURCE_PREFIXES`**, so
   runtime scripts declared by modules were silently dropped. `e2e-registry.mjs` was never
   projected even though `.opencode/commands/e2e.md` invokes it — `/opl-e2e` would have been
   broken on arrival. Both prefixes are now routed to `<root>/scripts/`.

**Honest note on module completeness:** `antigravity-cli-tdd-minimal` is genuinely empty and
`antigravity-cli-workflows-full` carries only `scripts/design-build-v2/section-gate.mjs` +
`.opencode/scripts/e2e-registry.mjs`, because `antigravity-cli` **inherits** every
`antigravity`-targeted module. An exact selected-module dry-run therefore planned 0 operations
before the `supportsModule` fix and 3 after. The rollout used the **core profile plus
`framework-language`**, which is what actually materializes the workflows.

## 3. Installation

| Item | Value |
|------|-------|
| Path | `<project>/.agents` |
| Previously existed | **NO** (`.agents/` was created by this install) |
| Snapshot | `<snapshots>/cc-reminder-pre-install-20261125` (taken **before** install) |
| Operations | **624** applied, 0 warnings, 0 skipped |
| Result | 78 agents, 248 skills, `rules/`, `scripts/`, `ecc-install-state.json` |

Exact command:

```bash
cd <project>
node <repo>/scripts/install-apply.js \
  --target antigravity-cli \
  --modules "rules-core,agents-core,commands-core,platform-configs,workflow-quality,shared-script-utils,antigravity-cli-workflows-full,framework-language"
```

Dry-run equivalent: append `--dry-run --json`.

## 4. Installed workflows and dependencies

**Workflow entrypoints present (verified on disk + frontmatter):**
`opl-tdd`, `opl-plan`, `opl-code-review-quick`, `opl-e2e`, `opl-e2e-map`,
`opl-security-audit`, `opl-design-build`, `opl-typography`, `opl-deep-research`,
`opl-refactor-clean`, `opl-docs-update`.

**Agents (78):** including `opl-tdd-guide`, `opl-code-reviewer`, `opl-plan-reviewer`,
`opl-planner`, `opl-security-reviewer`, `opl-a11y-architect`.

**Dependencies verified:**

| Dependency | Status |
|---|---|
| `frontend-design-direction` skill + `check-evidence.js` | INSTALLED (`skills/opl-frontend-design-direction/`) |
| Shared Plan Canvas transport | INSTALLED (`skills/opl-plan-canvas/SKILL.md`) |
| E2E unified registry | INSTALLED (`scripts/e2e-registry.mjs`) |
| E2E journey mapper | INSTALLED (`skills/opl-e2e-map/SKILL.md`) — kept as compatibility alias to unified E2E V2 |
| Cloudflare security-audit skill | INSTALLED (`skills/opl-security-audit/SKILL.md`) |
| Design-build section gate | INSTALLED (`scripts/design-build-v2/section-gate.mjs`) |
| Workflow-state skill | INSTALLED (`skills/opl-workflow-state/SKILL.md`) |
| `a11y` (primary accessibility source) | **NOT INSTALLED** — see limitations |

## 5. Native discovery and runtime isolation

**Agents** — `agy --sandbox --print "list project agents"` returned the full `opl-*` set
including `opl-code-reviewer`, `opl-tdd-guide`, `opl-plan-reviewer`, `opl-planner`.

**Skills** — native listing returned `opl-code-review-quick`, `opl-design-build`, `opl-e2e`,
`opl-e2e-map`, `opl-deep-research`, `opl-docs-update`, `opl-plan`, and the rest of the `opl-*`
surface.

**Runtime isolation** — a native sandboxed run read `opl-plan` and reported back:

```
Frontmatter name: opl-plan
Workflow state file path: .agents/ecc-opl/workflows/active.json
Dispatched agent: planner
```

Confirmed on disk: **0** residual `.opencode/workflows|markers` references under `.agents/`,
**6** correct `.agents/ecc-opl/workflows` references, and **no `.opencode/` directory was
created** in the target project.

**Ownership guard (live proof, not a unit test):** appending a user edit to
`skills/opl-tdd/SKILL.md` and re-running the installer preserved the edit byte-for-byte and
emitted:

> `Preserved user-modified managed file …/skills/opl-tdd/SKILL.md: bytes differ from the
> recorded digest, or no digest was recorded. ECC no longer manages this file; apply future
> updates manually.`

The file was then restored to its managed form (hash `363f0f18…`, 4 `ecc-opl/workflows` refs).

## 6. Remaining capability limitations

1. **`a11y` skill is not installed.** It exists only as a global OpenCode skill
   (`~/.config/opencode/skills/a11y/`), not as a repo module. `opl-design-build` references it
   by name, so a native session in this project cannot resolve it. Resolving this needs a
   decision: add `a11y` to a repo module, or document it as a host-provided dependency.
2. **Design-build execution remains BLOCKED.** No Track A admission certificate exists in the
   target project; `section-gate.mjs` refuses with `TRACK_A_NOT_ADMITTED`. No admission
   evidence was manufactured.
3. **`agy --agent <name>` does not resolve project agents.** Natural-language delegation works
   (`--print "use the opl-code-reviewer project agent…"`).
4. **`skills/taste` is not installed** — it is owned by `media-generation`, which does not
   target `antigravity`, so it is neither inherited nor claimed. `opl-design-build` degrades
   without it.
5. **No live TDD replay in this round.** Prior native TDD evidence stands; projected runtime
   bytes for `opl-tdd` are unchanged (`363f0f18…`), so that evidence still applies.
6. **Legacy flat `.agents/agents/<name>.md` files are not migrated** (none exist here — the
   target was empty).
7. **Nothing was committed, pushed, or installed globally.** OpenCode was not modified.

## 7. Backup and restore

Snapshot taken **before** installation:

```
<snapshots>/cc-reminder-pre-install-20261125
```

It contains `SNAPSHOT-STATE.txt` recording `TARGET_PREVIOUSLY_EXISTED=NO`.

Restore (target had no `.agents/` before install):

```bash
cd <project>
mv .agents .agents.failed-install
# no prior .agents existed, so nothing to copy back
```

If a prior `.agents/` had existed, the snapshot directory would hold a `cp -a` copy and the
restore would be `cp -a <snapshot>/.agents .agents`.

## 8. Verification summary

| Check | Result |
|---|---|
| `antigravity-skill-tree` (T1–T7) | 7/7 |
| `antigravity-cli-adapter` | 15/15 |
| `install-targets` | 60/60 |
| `antigravity-install-target` | 10/10 |
| `antigravity-closure` | 11/11 |
| `antigravity-minimal-projection` | 5/5 |
| `eccskills-identity-ownership` | 9/9 |
| `antigravity-review-fixes4` / `fixes5` | 9/9, 6/6 |
| `ownership-guard` | 25/25 |
| Carrier closure | 0 escapes / 0 dynamic requires / 35-35 specifiers |
| Installation | 624 ops, 0 warnings, 0 skipped |
| Native discovery | agents + skills resolved |
| Runtime isolation | verified natively |

**STOP.** Installation is complete and verified. Daily usage can begin.
