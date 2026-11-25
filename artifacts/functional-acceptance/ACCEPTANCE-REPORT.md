# ECC-OPL Antigravity CLI — Functional Release Acceptance

Candidate identity: working tree on `ae1514ac` (8 commits ahead of `origin/main`, unpushed).
Host: `agy` 1.5.17. Model: `gemini-3.8-flash-high`. Nothing committed, pushed, or deployed.

---

## 1. Minimal release materialized

### Selected dependency set (explicit, not a profile)

New module `antigravity-cli-tdd-minimal` in `manifests/install-modules.json`, targeting
`antigravity-cli` only, `defaultInstall: false`, dependency `shared-script-utils`:

```
.opencode/commands/tdd.md
skills/tdd-workflow/SKILL.md
skills/coding-standards/SKILL.md
skills/typescript-patterns/SKILL.md
agents/tdd-guide.md
agents/code-reviewer.md
.opencode/prompts/agents/plan-reviewer.txt
```

`scripts/setup-package-manager.js` and `scripts/lib/package-manager.js` moved from
`platform-configs` into `shared-script-utils` because the validator forbids one path
being claimed by two modules, and both are shared runtime utilities rather than
platform config.

### Result: 7 files, not 427 operations

```
.agents/skills/opl-tdd/SKILL.md
.agents/skills/opl-tdd-tdd-workflow/SKILL.md
.agents/skills/opl-coding-standards/SKILL.md
.agents/skills/opl-typescript-patterns/SKILL.md
.agents/agents/opl-tdd-guide/agent.md
.agents/agents/opl-code-reviewer/agent.md
.agents/agents/opl-plan-reviewer/agent.md
.agents/ecc-install-state.json
```

68 projected agents and 427 operations came from `--profile core` pulling `agents-core`
and `workflow-quality` wholesale. Selecting files explicitly removes both.

### Effective TDD authority is the customized ECC-OPL workflow

`.agents/skills/opl-tdd/SKILL.md` is projected from `.opencode/commands/tdd.md`
(`name: opl-tdd`, 4 references to `tdd-guide`), **not** from `skills/tdd-workflow`.
The knowledge skill is relocated to `opl-tdd-tdd-workflow` instead of being dropped or
silently overwriting the orchestrator. Verified by projection and by the native run in §2,
which read the orchestrator and delegated to `tdd-guide`.

### Transformed bytes verified

| Artifact | sha256 (first 16) |
|---|---|
| `skills/opl-tdd/SKILL.md` | `363f0f186b8d3f51` |
| `skills/opl-tdd-tdd-workflow/SKILL.md` | `7563a0c47d928cbd` |
| `skills/opl-coding-standards/SKILL.md` | `e80544c3d1eac5b1` |
| `skills/opl-typescript-patterns/SKILL.md` | `826b574c2dfc0421` |
| `agents/opl-tdd-guide/agent.md` | `ccdd9849c3ee7564` |
| `agents/opl-code-reviewer/agent.md` | `f0fc800e089e093f` |
| `agents/opl-plan-reviewer/agent.md` | `cea6d0777ff2d4f3` |

Reviewer tool table after transform: `read_file`, `grep_search`, `find_by_name` only.
`tdd-guide`: `read_file`, `edit_file`, `write_file`, `grep_search`, `run_command`.
Model passes through unchanged (`model: sonnet`) — no translation.

### Advanced workflows not exposed

No Canvas, planning, E2E, security-audit, or design-build artifact is installed by this
module. Only the TDD set above exists in the target tree.

---

## 2. Native engineering cycle completed

### Defect repaired at root cause

Pilot `src/cart.js` merged into the caller's array in place. Reviewer round 1 returned
**WARNING (1 HIGH)**: `target.push(...)` and `found.qty += ...` mutate caller state.
Fix clones before merging:

```js
const next = target.map(item => ({ ...item }));
for (const item of incoming) {
  const found = next.find(i => i.sku === item.sku);
  if (found) found.qty += item.qty;
  else next.push({ ...item });
}
return next;
```

The reviewer was not weakened and the TDD workflow was not edited to earn approval.

### Independent regression (outside the agent)

`node --test` → **6 tests, 6 pass, 0 fail**, 100% line/branch/function coverage on
`src/cart.js`.

### Native re-review verdict

**APPROVE** — CRITICAL 0, HIGH 0, MEDIUM 0, LOW 0.
> "Mutation defect resolved, zero issues flagged, test suite passing. Merge ready."

### Session evidence

| Field | Value |
|---|---|
| Session identity | `fda2c989-38ab-43c0-b323-6f54b6dbae35` |
| Resolved model | `gemini-3.8-flash-high` |
| Effective state path | `.agents/ecc-opl/workflows/active.json` |
| Final state | `{"workflow":"tdd","phase":"done","steps":[context,RED,implement,GREEN,refactor,report],"current":5,"gates":{"redVerified":true,"greenVerified":true}}` |
| OpenCode state mutation | none — `.opencode/` does not exist in the project |
| Reviewer write probe | `probe-writable.txt` unchanged (`PROBE_ORIGINAL`) |

Native run also delegated implementation to a `tdd-guide` subagent
(`1dfa9c65-e8d3-46c0-85cf-495c6e3515f5`) and reported RED before GREEN.

---

## 3. Real installation boundary

Performed with `scripts/install-apply.js` in a disposable project. The legacy
distribution helper was not used.

| Check | Result |
|---|---|
| Existing unmanaged file preservation | **PASS** — `Skipped user-owned file … not recorded in ECC install-state`; content intact |
| Identical unmanaged file ownership | **PASS** — file preserved, hash unchanged, not adopted into the ledger |
| Actual transformed artifact hashes | **PASS** — 7 artifacts hashed and recorded (§1 table) |
| Verified snapshot backup and restore | **PASS** — `.agents.pre-restore` 8/8 files hash-matched; `.agents` left in place |

### One check did not pass

| Check | Result |
|---|---|
| Existing modified managed file protection | **FAIL — data loss** |

Reproduced twice. Edit a file the installer previously wrote, then reinstall: the file is
replaced with no warning and no backup. `ownership-guard.js` only skips a file when the
destination is *not* in the recorded managed set; a managed file that the user has since
edited is treated as updateable and is overwritten. The guard has no content-digest
comparison against the recorded state for this case.

This is a pre-existing defect in the canonical installer's ownership guard, not introduced
by this release, and it is outside the three tasks. It is reported rather than patched
because changing the guard affects every target.

---

## Commands

Dry-run:

```bash
node <repo>/scripts/install-apply.js --target antigravity-cli \
  --modules antigravity-cli-tdd-minimal --dry-run
```

Install (project-local, from the project root):

```bash
node <repo>/scripts/install-apply.js --target antigravity-cli \
  --modules antigravity-cli-tdd-minimal
```

Snapshot before installing (the canonical installer has no rollback command):

```bash
cp -a .agents .agents.pre-install
```

Restore without deleting the current tree:

```bash
mv .agents .agents.failed-install
cp -a .agents.pre-install .agents
```

---

## Remaining limitations

1. **Modified managed files are overwritten without warning** (§3). Pre-existing
   canonical-installer defect; affects every target, not only this release.
2. **No managed rollback.** Recovery is a directory snapshot, by design of this scope.
3. **Legacy flat `.agents/agents/<name>.md`** from earlier installs is not migrated; `agy`
   ignores them, and they are not deleted because the installer has no ownership proof.
4. **`agy --agent <name>` does not resolve projected agents**; natural-language delegation
   works and was used for both reviewer rounds.
5. **Full `tests/run-all.js` not run** (2000+ tests). Eleven focused suites ran: 152 tests,
   0 failures.
6. **Canvas, planning, E2E, security audit, design-build remain deferred** and uninstalled.
7. **Nothing pushed or deployed.** No global installation was performed.

---

## Functional acceptance

Task 1: minimal release materialized at 7 artifacts with verified transformed bytes and the
customized TDD authority winning. Task 2: native cycle completed with APPROVE and the
mutation defect repaired at root cause. Task 3: four of five boundary checks pass; the
fifth exposed a real, pre-existing installer data-loss defect.

STOPPED. Explicit owner approval is required before any scoped release.
