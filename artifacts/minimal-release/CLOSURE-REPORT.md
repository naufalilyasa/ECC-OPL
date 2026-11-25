# Minimal Usable Release — Closure Report

**Baseline:** `2974d606` + uncommitted round-3 fixes
**Mode:** MINIMAL USABLE RELEASE
**Status:** Ready for explicit owner approval. Not committed, not pushed, not deployed.

---

## 1. Corrected source diff

### 1.1 `scripts/lib/install-targets/antigravity-cli.js` — skill relocation was a no-op

The round-3 relocation never happened. `skillDestinationKey()` returns a **full directory
path** (`.../.agents/skills/opl-tdd`), but the anchored regex treated it as a bare skill name,
so `anchored.test(normalized)` was always false and the destination was returned unchanged.

Independent confirmation before the fix:

```
.agents/skills/opl-tdd/SKILL.md   skillName=null                 (command entrypoint)
.agents/skills/opl-tdd            skillName=opl-tdd-tdd-workflow (relocated metadata, wrong path)
```

Fix: derive the relocation from the key's **basename** and rebuild the destination by replacing
the trailing `skills/<basename>` segment, preserving any nested path.

```js
const keyBasename = key.split('/').pop();
let relocatedBasename = `${keyBasename}-${sourceName}`;
const relocatedDir = `${key.slice(0, key.length - keyBasename.length)}${relocatedBasename}`;
const suffixPath = normalized.slice(key.length);
const relocatedPath = `${relocatedDir}${suffixPath}`;
```

After the fix:

```
.agents/skills/opl-tdd/SKILL.md          skillName=null
.agents/skills/opl-tdd-tdd-workflow      skillName=opl-tdd-tdd-workflow
```

**Real materialization, not string comparison** — installer-expanded files on disk:

```
.agents/skills/opl-tdd/SKILL.md                 3638 bytes  (orchestrator)
.agents/skills/opl-tdd-tdd-workflow/SKILL.md                (knowledge)
```

Orchestrator content verified: 4 references to `tdd-guide`, 3 references to
`.agents/ecc-opl/workflows/active.json`, **0** references to `.opencode/workflows`.
Knowledge skill verified intact (frontmatter `name: tdd-workflow`, original body).

### 1.2 `scripts/lib/install-targets/antigravity-cli.js` — agents used the wrong layout

`agy` 1.5.17 registers a subagent from **`{workspace}/.agents/agents/{agent_name}/agent.md`**
(path string confirmed in the binary), not from a flat `<name>.md`. Every projected agent was
invisible to the host.

Fix: `planAgentOperations` now targets `agents/<opl-name>/agent.md`. Added
`dedupeAgentDestinations` because `agents/code-reviewer.md` and
`.opencode/prompts/agents/code-reviewer.txt` describe the same canonical agent; the rich
`agents/*.md` definition wins, the prompt variant only fills gaps.

Verified on disk after install: **38 agent directories**, each with `agent.md`. `agy` now reports
`opl-code-reviewer` and `opl-tdd-guide` as **Available**.

### 1.3 `scripts/lib/eccskills-distribution.js` — routed through canonical infrastructure

Six reproduced defects, all confirmed by execution before the fix:

| Defect | Before (reproduced) | After |
|--------|--------------------|-------|
| Install then rollback deletes a pre-existing identical file | `false` — file deleted | `true` — file preserved |
| Modified managed file overwritten without force | overwritten silently | `refusing to overwrite modified file` |
| Reinstall then rollback deletes previous install | previous state lost | returns to v1 content, previous ledger restored |
| Destination outside projectRoot accepted | written outside | `destination escapes project root` |
| Source changed after manifest generation | stale bytes installed | `source changed since manifest generation`, nothing written |
| Missing required source silently omitted | manifest shrinks | `missing required source file` |

Now uses `install/contained-fs` (`copyContainedFile`, `readFileNoFollow`,
`removeContainedPath`) instead of raw `fs.copyFileSync`/`fs.unlinkSync`, so containment and
no-follow semantics come from the canonical layer.

Additional corrections:
- Undo journal records `{restore}` only when a backup exists, `{remove}` only when this run
  created the file. An identical pre-existing file records **nothing**, which is what stops the
  data loss.
- `ledger.added` is authoritative for removal; the old "no backup exists → delete" heuristic is
  gone.
- `ledger.previous` preserves the prior installation so rollback returns to it.
- Recovery failures are **collected and reported**, not swallowed:
  `error.recoveryErrors` plus an `INCOMPLETE RECOVERY` section in the message.

### 1.4 Scoped change to the duplicate mutation path

`eccskills-distribution.js` is **not deleted and not disabled**. It remains a library, but its
mutation functions now delegate to canonical `contained-fs` primitives. Removing or disabling it
outright is left for a separate approved change, per the directive.

---

## 2. Actual minimal installer rehearsal

Disposable project, real installer path, four required conditions seeded.

```
PROJECT: /var/folders/.../rehearsal-AGAiVf
RELEASE ENTRIES: 4   manifest sha: c25489f528314ba1
```

| Step | Result |
|------|--------|
| Dry-run conflict detection | `modified:.agents/skills/opl-tdd/SKILL.md` detected |
| Install without force | **refused** — `refusing to overwrite modified file` |
| Install with force | 4 files installed |
| User-managed skill intact | `true` |
| Modified managed file updated | `true` |
| Effective skill discovery | `my-own-skill`, `opl-tdd`, `opl-tdd-tdd-workflow` |
| Effective agent discovery | `opl-code-reviewer`, `opl-tdd-guide` |
| Orchestrator state path | `.agents/ecc-opl/workflows/active.json` present |
| Rollback | previous ledger restored; user skill intact; user-modified file preserved |

Ledger after install: 40 managed entries, `installedAt` set, 40 in `added`.

No global installation was performed.

---

## 3. Actual native TDD session

```
Candidate: /var/folders/.../native2-wCVTzg
Manifest sha256: 1ada8568b01434a4b3b34f2b94d86567bf5b3dcdd2b432bc7de33ca2cd27d113
Host: agy 1.5.17, --sandbox on every invocation
Model: gemini-3.8-flash-high
```

**Effective installed paths**

```
.agents/skills/opl-tdd/SKILL.md
.agents/skills/opl-tdd-tdd-workflow/SKILL.md
.agents/agents/opl-tdd-guide/agent.md
.agents/agents/opl-code-reviewer/agent.md
```

**RED (independent, outside the agent)**

`node --test` → `MODULE_NOT_FOUND` for `../src/cart`.

**Native agent run** — delegated implementation to `opl-tdd-guide` subagent
(`8bd9c56f-1be7-4cc3-90db-0426a175e561`).

**GREEN**

```
✔ addItem appends without mutating the original cart
✔ addItem merges quantity for an existing sku
tests 2  pass 2  fail 0
```

**Effective state path — the corrected one**

```
.agents/ecc-opl/workflows/active.json
{ "workflow": "tdd", "phase": "done", "steps": ["context","RED","implement","GREEN","refactor","report"], "current": 6, "gates": { "redVerified": true } }
```

`.opencode/workflows/active.json` — **does not exist**. The earlier closure evidence was right to
doubt this; it is now verified.

**Native reviewer result**

`opl-code-reviewer` returned **APPROVE** — 0 CRITICAL, 0 HIGH, 0 MEDIUM, 0 LOW. Immutability and
test quality both confirmed.

**Reviewer tool exposure and negative mutation probe**

Declared tools: `read_file`, `grep_search`, `find_by_name` only. Probe asked the reviewer to
overwrite `probe-writable.txt` with `HACKED`; the file still reads `PROBE_ORIGINAL`, and the
reviewer reported the file untouched and listed exactly those three tools.

This is **native host-level** isolation in a real `agy --sandbox` session, not helper-level
isolation.

---

## 4. Remaining limitations

1. **Design-build remains BLOCKED.** The admission helper still accepts a fabricated digest, an
   empty capture object inside an array, `verified: true`, and PASS labels; the real certificate
   `captures` schema differs from what the helper requires; synthetic Rlogic fixtures are not
   production admission. No new admission framework was created.
2. **Advanced workflows are present but inactive** — Canvas, E2E, security audit, planning,
   design-build. Not activated through this release.
3. **E2E mapper dependency closure and actual Cloudflare audit execution remain deferred.**
4. **Distribution safety is verified by rehearsal, not by production traffic.** Disk-full and
   mid-run permission denial are handled by design (recovery errors are now reported rather than
   swallowed) but were not exercised live.
5. **Uncommitted.** No commit, push, or global deployment was performed.
6. **Guardian Angel exclusion preserved** — `.guardian-angel/*` untouched throughout.
7. **Pre-existing repo debt untouched** — `docs/e2e-v2/*` and `docs/plans/*` personal paths;
   `npm test` still fails on those files, outside this scope.

---

## 5. Proposed project-local release and rollback commands

Run from the target project root. Nothing here touches global state.

```bash
# 1. Dry run — plan and detect conflicts, write nothing
node "$ECC_ROOT/scripts/install-apply.js" \
  --target antigravity-cli --profile core --dry-run

# 2. Build the release manifest from the canonical installer plan
node -e "
const a=require('$ECC_ROOT/scripts/lib/install-targets/antigravity-cli');
const {generateReleaseManifest}=require('$ECC_ROOT/scripts/lib/eccskills-distribution');
const ops=a.planOperations({modules:[{id:'core',paths:['.opencode/commands/tdd.md','skills/tdd-workflow','agents/tdd-guide.md','agents/code-reviewer.md']}],repoRoot:'$ECC_ROOT',projectRoot:process.cwd()},a);
console.log(generateReleaseManifest({operations:ops}).sha256);
"

# 3. Install (refuses unmanaged or modified destinations; add --force only after review)
#    ledger: .ecc/ledger.json   backup: .ecc/backup/<timestamp>/

# 4. Verify effective discovery
ls .agents/skills/*/SKILL.md
ls .agents/agents/*/agent.md
cat .agents/ecc-opl/workflows/active.json

# 5. Rollback to the previous installation state
#    restores previous ledger, preserves user-modified files, removes only files this install added
```

Expected safety properties, all exercised in the rehearsal: unmanaged files are refused,
modified managed files are refused without `--force`, identical pre-existing files are never
deleted on rollback, reinstall+rollback returns to the prior release, and destinations outside
the project root are rejected.

---

**STOP.** Awaiting explicit owner approval before commit, push, or global deployment.
