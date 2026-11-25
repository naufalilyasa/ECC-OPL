# ECC-OPL Antigravity CLI — Minimal Release Final Closure

Baseline: `ae1514ac2e84e995f1a0d4f4adf982d0287ba2b2`

MODE: minimal usable release. No master-plan reopening, no A0–A6 re-implementation,
no new agent/validator/PRD/adapter, no Guardian Angel, no global install,
no push, no deployment.

---

## 1. Corrected source diff

Six files changed. Every destination-identity and ownership defect the review
reported was reproduced first, then fixed.

### `scripts/lib/eccskills-distribution.js`

New single identity resolver used by **every** consumer (conflict detection,
ownership lookup, manifest verification, backup, installation, ledger,
rollback):

```js
function resolveDestination(root, destinationPath) {
  const absolute = path.resolve(root, destinationPath);
  const relative = toPosixRelative(path.relative(root, absolute));
  if (relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
    throw new Error(`destination escapes project root: ${destinationPath}`);
  }
  return { absolute, relative };
}
```

- `detectManagedConflicts` resolves against the **ledger root**, never `process.cwd()`.
- `buildOwnershipLedger` keys on the resolved project-relative path.
- `installRelease` / `rollbackRelease` use the same resolved identity for backup,
  write, ledger entry, and removal.
- **Ownership of identical unmanaged files**: an identical pre-existing file is
  skipped and **never adopted** into the ledger. The ledger claims only files
  this run wrote, or files a previous install already owned.
- `installRelease` and `rollbackRelease` are now **unavailable** (see §3); the
  previous implementations remain as `_legacyInstallRelease` /
  `_legacyRollbackRelease` for focused regression only.

### `scripts/lib/install-targets/antigravity-cli.js`

- `.opencode` accepted as a whole module directory and expanded into
  `.opencode/prompts/agents` + `.opencode/commands`.
- `withAntigravityStatePathRewrite` applied to **both** skill projection branches
  (whole-directory and single-skill).

### `scripts/lib/install/antigravity-agent.js`

- `adaptAntigravityCommandToSkill` synthesizes frontmatter when a command ships as
  plain Markdown (`loop-start`, `loop-status`, `model-route`, `quality-gate`), instead
  of failing the install.
- New `rewriteAntigravityStatePaths` rewrites `.opencode/workflows`, `.opencode/markers`,
  `.opencode/plans` onto the agy paths and **fails closed** if any literal OpenCode
  state path survives.

### `scripts/lib/install/content-transform.js`, `scripts/lib/install/plan.js`

- Wire the `antigravity-state-path-rewrite` transform.
- `applicableTransform` now correctly keeps the transform for `.md` files and drops it
  for binary/helper assets.

### `manifests/install-modules.json`

- `platform-configs` gains the `antigravity-cli` target, so `.opencode/commands` is
  actually projected for this target.

---

## 2. Focused reproduction results

Reproduced from an **external working directory** (`process.chdir` away from the
project), exactly as the review did.

| # | Defect | Before | After |
|---|--------|--------|-------|
| 1 | Relative destination resolved against `cwd` | installed into cwd | installed under `projectRoot` |
| 2 | Unmanaged file at real destination overwritten | overwritten silently | `refusing to overwrite unmanaged file` |
| 3 | Ledger keys wrong for relative destinations | `../../../../..` keys | `.agents/skills/opl-a/SKILL.md` |
| 4 | Install → rollback leaves file behind | file remained, ledger gone | file removed, ledger removed |
| 5 | Identical unmanaged file adopted as managed | adopted | **not adopted** |
| 6 | Upgrade to v2 overwrites user file | overwritten | `refusing to overwrite unmanaged file` |
| 7 | `force` path | n/a | upgrades, rollback restores user content |

Regression suite: `tests/lib/eccskills-identity-ownership.test.js` — **9/9 pass**
(D1–D4 identity, O1–O4 ownership, A1 authority).

---

## 3. Installation authority

The canonical installer is the **only** installation authority:

- `scripts/install-apply.js` → `scripts/lib/install/plan.js` + `scripts/lib/install/apply.js`
- canonical helpers: `contained-fs`, `ownership-guard`, `guarded-write`
- install state: `.agents/ecc-install-state.json`

`eccskills-distribution.js` generates raw-source manifests and copies raw bytes,
ignoring `contentTransform`, so its mutation path is **kept unavailable**:

```js
throw new Error('installRelease is unavailable for the minimal release: use scripts/install-apply.js ...')
```

Verified this round: dry-run produces **427 operations** including the correctly
transformed `skills/opl-tdd/SKILL.md` (orchestrator, `name: opl-tdd`) and the
relocated `skills/opl-tdd-tdd-workflow/SKILL.md` (knowledge, `name: tdd-workflow`).

### Exact supported commands

Run from the project root you want to install into:

```bash
# dry run — no writes
node <repo>/scripts/install-apply.js --target antigravity-cli --profile core --dry-run

# install
node <repo>/scripts/install-apply.js --target antigravity-cli --profile core
```

Selected dependency set for `--profile core`:

| Module | Purpose |
|--------|---------|
| `rules-core` | baseline rules |
| `agents-core` | canonical agents → `.agents/agents/<opl-name>/agent.md` |
| `commands-core` | command surface → `.agents/skills/<opl-name>/SKILL.md` |
| `platform-configs` | `.opencode/commands` + `.opencode/prompts/agents` projection |
| `workflow-quality` | TDD / verification / design-build skills |
| `shared-script-utils` | shared script helpers |

`hooks-runtime` is skipped for this target (no hook runtime on `agy`).

### Rollback procedure

The canonical installer has **no rollback command**. Project-local rollback is:

```bash
# 1. capture the pre-install state
cp -a .agents .agents.pre-install

# 2. install
node <repo>/scripts/install-apply.js --target antigravity-cli --profile core

# 3. roll back
rm -rf .agents && mv .agents.pre-install .agents
```

This is stated plainly rather than presented as a managed rollback: a managed
rollback would require reconciling `eccskills-distribution.js` with the canonical
installer, which is out of scope here.

---

## 4. Native TDD session result

Disposable project, `agy` **1.5.17**, `--sandbox`, model `gemini-3.8-flash-high`.

| Check | Result |
|-------|--------|
| `/opl-tdd` discovered | ok `.agents/skills/opl-tdd/SKILL.md`, `name: opl-tdd` |
| Native `opl-tdd-guide` invocation | ok delegated to the subagent |
| Independent RED | ok `Cannot find module '../src/cart'`, `pass 0` |
| Independent GREEN (outside the agent) | ok `pass 2, fail 0` |
| Correct state path | ok `.agents/ecc-opl/workflows/active.json` |
| OpenCode state mutation | ok **none** — `.opencode/` does not exist in the project |
| Native `opl-code-reviewer` | ok ran, verdict **BLOCK** (1 CRITICAL, 2 HIGH, 0 MEDIUM, 1 LOW) |
| Reviewer read-only | ok `probe-writable.txt` still `PROBE_ORIGINAL`; tools limited to `read_file`, `grep_search`, `find_by_name` |

Final state file:

```json
{
  "workflow": "tdd",
  "phase": "done",
  "steps": ["context", "RED", "implement", "GREEN", "refactor", "report"],
  "current": 5,
  "gates": { "redVerified": true },
  "updatedAt": "2026-11-25T11:35:30.000Z"
}
```

The reviewer's BLOCK is a genuine finding, not a harness failure: the pilot
implementation mutates its input array. It is recorded as-is.

Advanced workflows remain inactive.

---

## 5. Remaining limitations

1. **Reviewer verdict is BLOCK**, not APPROVE. The pilot `src/cart.js` mutates its
   argument; the workflow completed correctly, the code did not.
2. **No managed rollback.** Rollback is a directory snapshot (§3), not a reconciled
   engine. `eccskills-distribution.js` remains a duplicate mutation path, deliberately
   disabled rather than deleted.
3. **Legacy flat agent files** (`.agents/agents/<name>.md`) are not migrated; only the
   `<name>/agent.md` layout is written. Existing projects need a reinstall.
4. **`--agent` flag does not resolve projected agents**; they are reachable through
   natural-language delegation. `agy --print "list available agents"` shows all 68
   `opl-*` agents as available.
5. **Full `tests/run-all.js` not run** (2000+ tests, timeout); 10 focused suites run
   instead: 144 tests, 0 failures.
6. **Not pushed, not deployed, no global install.**
7. `.guardian-angel/*` excluded from every commit by standing owner decision.

---

## Verification summary

| Check | Result |
|-------|--------|
| Focused suites | 10 suites / **144 tests / 0 failures** |
| Carrier closure | 0 escapes, 0 dynamic requires, 35/35 specifiers |
| Command registry | up to date |
| `node --check` | OK on all 5 changed JS files |
| OpenCode state refs in projected skills | **0** |
| Native end-to-end | RED → GREEN → reviewer, sandboxed |

STOP — minimal project-local release readiness reached. No commit, push, or
deployment performed.
