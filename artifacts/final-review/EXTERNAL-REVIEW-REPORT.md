# ECC-OPL → Antigravity CLI Native Port — Final External Review Report

**Baseline:** `42fae4eb` · **HEAD:** `2974d606` + uncommitted round-3 fixes
**Commits:** 7 local (none pushed to `origin/main`)
**Test total:** **188 passed, 0 failed** across 15 suites
**Deployment authorization:** NOT GIVEN

---

## 1. Executive summary

This report covers the complete port of ECC-OPL from OpenCode to the Google Antigravity CLI
(`agy`), from initial assessment through seven committed phases and three independent review
rounds. The work is functionally complete and every automated suite is green. It is **not**
cleared for deployment, and this report says why rather than rounding up.

Three review rounds each found real defects, including four that could destroy user data. All
were fixed and locked with regression tests. The final round closed 15 of 15 findings.

## 2. Scope and approach

The port targets `agy` **terminal-first**. OpenCode remains the reference runtime and is left
intact; the only shared surface is the Plan Canvas service, reused rather than forked.

| Decision | Choice |
|----------|--------|
| Distribution | Skills-first projection into `.agents/` |
| Naming | Namespaced `/opl-*` to avoid host command collisions |
| Upstream | Selective backport, no full merge of 853 commits, no second fork |
| Security | Native `agy --sandbox` + host permissions; no third-party hook adapter |
| State | Isolated at `.agents/ecc-opl/workflows/active.json`, 12h TTL, lock-guarded |

## 3. Delivered phases

| Phase | Deliverable | State |
|-------|-------------|-------|
| A0 | Preflight, baseline lock, CLI discovery (`agy` 1.5.16 → 1.5.17) | Complete |
| A1 | Native TDD pilot, restricted reviewer, sandbox proof | Complete |
| A2 | Core workflows, canonical agent adaptation, isolated workflow state | Complete |
| A3 | Plan Canvas strict verdict binding + Canvas V2 (100k prompt, attachments) | Complete |
| A4 | Target-aware E2E runner + read-only security audit | Complete |
| A5 | Track A admission certificate + design-build fidelity gate | Complete |
| A6 | Canonical distribution manifest + atomic rollback engine | Complete |
| Closure | Seven external-review correction areas | Complete |
| Round 3 | Fifteen code-review findings | Complete |

## 4. What the native pilot actually proved

Run on `agy` **1.5.17** with `--sandbox` on every invocation, in a disposable workspace:

1. The agent armed workflow state and reported `phase: "red"`.
2. It independently verified the RED failure (`MODULE_NOT_FOUND`).
3. It dispatched the `opl-tdd-guide` subagent.
4. It implemented the module and got 3/3 tests passing.
5. It closed the state machine at `phase: "done"` with `gates.redVerified: true`.

A native reviewer round then returned **BLOCK** with two genuine HIGH findings (argument
mutation, missing branch coverage). After remediation the same reviewer returned **Warning** —
zero CRITICAL or HIGH — leaving two MEDIUM suggestions open by design of the fixture.

The reviewer's projected tool set is `read_file`, `grep_search`, `find_by_name` only. No write,
edit, shell, or subagent-delegation tool is present, and a negative mutation probe confirmed the
reviewer could not modify any file.

## 5. Verification

| Suite | Result |
|-------|--------|
| `antigravity-review-fixes3` (round-3 findings) | 10/10 |
| `eccskills-distribution-safety` | 7/7 |
| `eccskills-antigravity-cli` | 7/7 |
| `antigravity-closure` | 11/11 |
| `antigravity-review-fixes2` | 6/6 |
| `antigravity-review-fixes` | 8/8 |
| `antigravity-cli-adapter` | 15/15 |
| `antigravity-install-target` | 10/10 |
| `antigravity-workflow-state` | 9/9 |
| `install-targets` | 60/60 |
| `design-build-antigravity-gate` | 6/6 |
| `design-build-track-a-admission` | 8/8 |
| `e2e-antigravity-runner` | 8/8 |
| `plan-canvas-antigravity` | 13/13 |
| `design-build-direction-a11y` | 10/10 |
| **Total** | **188 passed, 0 failed** |

Additional gates: `command-registry:check` up to date · carrier closure 0 escapes, 0 dynamic
requires, 35/35 relative specifiers · `node --check` OK on all changed modules.

## 6. The data-loss defects (round 3)

The most serious findings were in the distribution engine's "atomic" install, which could
**permanently delete a pre-existing user file**:

1. **Rollback deleted pre-existing identical files.** A backup was skipped when content already
   matched the release, but the path was still recorded as installed. On a later failure the
   rollback found no backup and unlinked the file.
2. **Digest mismatch left a corrupt file.** The throw fired before the path was recorded, so
   rollback never saw it.
3. **Ledger write failure skipped rollback entirely.** The write sat outside the guard; files
   stayed written with no ledger, and the next run refused with "unmanaged file".
4. **Path traversal.** An unresolved `projectRoot` let backups land outside `backupRoot`.

The install path was rebuilt around a typed undo journal — `{restore: backup}` only when a backup
exists, `{remove: true}` only when this run created the file — recorded **before** each write and
replayed in reverse. A failure at any stage now restores the tree.

## 7. Honest gaps

These are the reasons this is not a deployment clearance.

- **Uncommitted round-3 fixes.** HEAD is `2974d606`; the 15 fixes live in the working tree and are
  not committed.
- **Nothing pushed.** All seven commits are local only. No remote has this work.
- **Distribution safety is unit-proven, not field-proven.** No install ran into a real project
  directory and no rollback was rehearsed against a live tree. Disk-full and mid-run permission
  denial are covered by design, not by test.
- **Pilot scope is narrow.** Only the minimal TDD set ran natively. E2E, security audit, and
  design-build were not exercised end-to-end through `agy`.
- **Reviewer verdict is "Warning", not APPROVE.** Two MEDIUM suggestions remain open.
- **Pre-existing repo debt untouched.** `docs/e2e-v2/*` and `docs/plans/*` still carry personal
  paths flagged by `validate-no-personal-paths.js`; `npm test` still fails on those files. They
  predate this work and are outside its scope.
- **No live browser walkthrough** of the Canvas verdict approve button; verified via HTTP smoke
  and unit contract instead.

## 8. What the reviewer should check

1. **Undo journal correctness** — every written path has an undo entry recorded before the write;
   an identical pre-existing file records nothing.
2. **Rollback ordering** — reverse replay cannot resurrect a file a later step legitimately
   replaced.
3. **Ledger trust** — a plan-only ledger (no `installedAt`) can never authorize an overwrite, in
   both preflight and `detectManagedConflicts`.
4. **Anchored relocation** — the regex cannot match outside the `.agents/skills/` segment.
5. **Tool narrowing** — the canonical table can only narrow a declared set, never widen it.
6. **Claim discipline** — confirm no phase is described as verified beyond what was actually run.

## 9. Recommendation

**Do not deploy.** Commit the round-3 fixes, push the branch for review, and run one install +
rollback rehearsal against a disposable real project tree. After that the remaining risk is pilot
breadth, not correctness.
