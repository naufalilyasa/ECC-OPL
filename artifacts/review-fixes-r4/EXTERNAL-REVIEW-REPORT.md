# Round-4 Review Fixes — External Review Report

**Commit:** `ae1514ac` — `fix(antigravity-cli): resolve round-4 review findings`
**Parent:** `2974d606` (minimal-release closure)
**Repo:** `naufalilyasa/ECC-OPL`, branch `main`
**State:** committed locally, **not pushed**, not deployed

---

## 1. Origin of this round

A `/code-review-quick` pass over the uncommitted minimal-release closure returned
**BLOCK** with 8 findings (0 CRITICAL, 2 HIGH, 4 MEDIUM, 2 LOW). Both HIGH findings
were re-read in source and confirmed as real defects before being recorded — neither
was speculative.

This report covers the remediation of all 8.

## 2. Findings and fixes

### HIGH 1 — Identical pre-existing file rewritten without undo protection
**File:** `scripts/lib/eccskills-distribution.js` (`installRelease`)

`installRelease` correctly detected `identical = existed && sha256(dest) === file.sha256`
and deliberately recorded **no** undo entry for that path — the design note reads
"an unmanaged file that already matches the release byte-for-byte is not an overwrite".
But the write still executed unconditionally.

Consequences:
- A mid-write failure (disk full, read-only mount, interrupted process) truncates a
  file the undo journal cannot restore, because no entry exists for it.
- A later failure in the same run triggers rollback, which also skips the path — the
  corrupted file survives as-is.

**Fix:** `if (identical) continue;` before any write. A destination that is already
byte-for-byte correct is never reopened for writing.

### HIGH 2 — Silent loss of user feedback on oversized anchors
**File:** `scripts/lib/plan-canvas/sessions.js` (`normalizeFeedbackItem`)

`softText()` caught `PROMPT_TOO_LARGE` and returned `null`. When `anchor.selector`
exceeded 500 characters or `anchor.textRange.text` exceeded 1000, the **entire**
feedback item was dropped. `queueFeedback` adds dropped items to neither `accepted`
nor `rejected`, so `server.js` replied `200 {status:'queued', accepted:0}` and the
browser displayed success while the human's typed commentary was discarded.

This is reachable in practice: utility-class-heavy component trees routinely produce
DOM selectors beyond 500 characters.

**Fix:** replaced `softText` with `truncate`. Anchor parts are browser-generated
locators, not user prose — clipping them preserves the commentary. Only the free-form
prompt still rejects hard via `sanitizeText`.

### MEDIUM 3 — Dedupe keyed off a path substring
**File:** `scripts/lib/install-targets/antigravity-cli.js` (`dedupeAgentDestinations`)

`if (!dest.includes('/agents/'))` matched every operation when the checkout path
itself contained `agents` (e.g. `/home/user/ai-agents/project`), so unrelated skill,
rule and command operations were treated as duplicate agents and dropped.

**Fix:** identify agent operations by `contentTransform`
(`antigravity-agent-frontmatter-cli` / `antigravity-prompt-to-agent`).

### MEDIUM 4 — Case-sensitive dedupe key
**File:** same function

`byDest` used original casing while `generateReleaseManifest` dedupes
case-insensitively for APFS/NTFS. A mixed-case agent/prompt pair escaped dedupe and
then hit a fatal duplicate-destination error.

**Fix:** key with `destinationPath.toLowerCase()`.

### MEDIUM 5 — Symlink followed out of the project root
**File:** `scripts/lib/eccskills-distribution.js` (`detectManagedConflicts`)

Used `fs.readFileSync`, which follows a symlinked destination outside the project
root, bypassing the `O_NOFOLLOW` boundary the rest of the module enforces.

**Fix:** read via `readFileNoFollow`; an unreadable or symlinked destination is
reported as `kind: 'unmanaged'` without reading through it.

### MEDIUM 6 — Relative destination resolved against `process.cwd()`
**File:** `scripts/lib/eccskills-distribution.js` (`installRelease`)

`path.resolve(file.destinationPath)` resolved relative paths against the current
working directory rather than the project root, so a valid relative destination was
falsely rejected as escaping the root.

**Fix:** `path.resolve(root, file.destinationPath)`.

### LOW 7 — Orphaned legacy agent files
**File:** `scripts/lib/install-targets/antigravity-cli.js`

Switching to `.agents/agents/<name>/agent.md` leaves flat `.agents/agents/<name>.md`
files behind on previously installed projects. `agy` ignores them but they linger.

**Fix:** documented as a migration boundary. Deliberately **not** auto-deleted — a
flat file may carry user edits and the installer has no ownership proof for it.

### LOW 8 — Unreadable clobber error
**File:** `scripts/lib/workflow-state.js`

An untagged clobber rendered as `switch to "undefined"`.

**Fix:** now reads `switch to an untagged conversation`.

## 3. Verification

TDD: `tests/lib/antigravity-review-fixes4.test.js` written first — **RED 4/9 → GREEN 9/9**.

| Suite | Result |
|-------|--------|
| `antigravity-review-fixes4` (new) | 9/9 |
| `eccskills-distribution-safety` | 7/7 |
| `eccskills-antigravity-cli` | 7/7 |
| `antigravity-closure` | 11/11 |
| `antigravity-review-fixes3` | 10/10 |
| `antigravity-cli-adapter` | 15/15 |
| `antigravity-install-target` | 10/10 |
| `antigravity-review-fixes` | 8/8 |
| `antigravity-review-fixes2` | 6/6 |
| `antigravity-workflow-state` | 9/9 |
| `install-targets` | 60/60 |
| `design-build-antigravity-gate` | 6/6 |
| `plan-canvas-antigravity` | 13/13 |
| `plan-canvas-sessions` | 16/16 |
| `plan-canvas` (scripts) | 96/96 |

Plus `command-registry:check` up to date, and carrier closure at 0 escapes /
0 dynamic requires / 35-35 relative specifiers.

Both HIGH fixes are covered by dedicated regression tests:
- R1 asserts the inode and mtime of an identical pre-existing file are unchanged.
- R1b asserts that file survives a later failure in the same run.
- R2/R2b assert the commentary survives an oversized selector / text range.

## 4. Remaining limitations

1. **No live `agy --sandbox` run in this round.** The fixes are installer and
   canvas-store logic, verified by unit and regression tests. The last native session
   (previous round) still stands as the host-level proof.
2. **No browser click-through.** HIGH 2 is verified at the store layer (item accepted,
   commentary preserved, anchor clipped), not by driving the real Canvas UI.
3. **Legacy agent files are not migrated.** Projects installed before the
   `<name>/agent.md` layout change keep inert flat files until removed manually.
4. **Full `tests/run-all.js` was not run** (2000+ tests, timeout). 15 targeted suites
   were run instead.
5. **Not pushed, not deployed.** Commit is local only; `main` is now 8 commits ahead
   of `origin/main`.
6. **`.guardian-angel/*` remains excluded** from every commit by standing owner
   decision.

## 5. What the reviewer should check

1. **HIGH 1 ordering** — confirm the `continue` sits before both the backup copy and
   the install copy, so no path can be written without a journal entry.
2. **HIGH 2 truncation vs rejection** — confirm clipping an anchor cannot smuggle a
   different instruction to the agent, and that the hard rejection for free-form
   prompts is preserved.
3. **Dedupe by transform** — confirm `antigravity-agent-frontmatter-cli` and
   `antigravity-prompt-to-agent` are the only transforms that should be treated as
   agent operations.
4. **Containment** — confirm `readFileNoFollow` failures are treated as unmanaged
   rather than silently skipped.
5. **Migration boundary** — accept or reject the decision not to auto-delete legacy
   flat agent files.
