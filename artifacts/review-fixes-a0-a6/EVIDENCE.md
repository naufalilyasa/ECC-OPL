# Review Fixes Evidence — Phases A0–A6 BLOCK verdict

Fixes all 9 review findings from the `/code-review-quick` run on diff `42fae4eb...d8dfbe49`.

## Findings Fixed
1. **[CRITICAL] Arbitrary file write in `/api/attachments`** — `server.js`: now requires `sessionKey`, resolves the live session, and confines `sessionDir` within the session's workspace (403 otherwise). Client-supplied `workspace` no longer trusted (fixes #8 dead param by replacing it with session-bound boundary).
2. **[CRITICAL] UI verdict binding** — `ui.js`: `renderCanvasHtml` bootstraps `target`/`workspace`/`revisionDigest` for agy sessions; client `makeVerdictItem()` emits the exact bound payload. Legacy path unchanged.
3. **[CRITICAL] Windows path rollback** — `eccskills-distribution.js`: `toPosixRelative()` normalizes backup entries; ledger lookup uses normalized key.
4. **[HIGH] Ignored `projectRoot`** — `rollbackRelease` now honors explicit `projectRoot` before `ledger.root` before fallback.
5. **[HIGH] Emoji CI failure** — `artifacts/a1-pilot/EVIDENCE.md` emojis replaced with ASCII (`>`, `[ok]`, `info:`). Remaining unicode-check violations are all in pre-existing `docs/e2e-v2/*` files outside the A0–A6 diff.
6. **[MEDIUM] FD leak** — `workflow-state.js`: `fs.closeSync(fd)` wrapped in `try/finally`.
7. **[MEDIUM] Monolithic `planOperations`** — `antigravity-cli.js`: decomposed into `planRuleOperations`/`planCommandOperations`/`planAgentOperations`/`planSkillOperations` + `planSourcePath` dispatcher; behavior identical.
8. **[MEDIUM] Dead `workspace` param** — folded into containment check (#1).
9. **[LOW] Duplicate remap conventions** — consolidated into single `oplName()` + `SKILL_NAME_ALIASES`.

## TDD
- New guard: `tests/lib/antigravity-review-fixes2.test.js` — RED 0/6 → GREEN 6/6 (path normalization, explicit root, Windows rollback, UI bootstrap, client helper, attachment containment/session binding).

## Verification (all GREEN)
- review-fix2 6/6; A6 7/7; adapter 14/14; workflow-state 9/9; review-fixes 8/8; install-targets 60/60; antigravity-install-target 10/10; context-carriers exit 0; plan-canvas-antigravity 13/13; plan-canvas core/sessions/markdown/e2e exit 0; e2e-antigravity-runner 8/8; Track A admission 8/8; design-build gate 6/6.
- carrier closure: 0 escapes / 0 dynamic requires / 35-35 specifiers. `node --check` OK on all 5 changed JS files.

## Honest Gaps
- UI verdict binding verified via string/structure assertions on `renderCanvasHtml`/`canvasClientJs`, not a live browser click (account eligibility still blocks `agy --sandbox`).
- Pre-existing unicode violations in `docs/e2e-v2/*` remain; not in scope of this diff and untouched.

## Status
All 9 review findings resolved. Commit: new commit on top of A6 (`d8dfbe49`); A0–A6 history unchanged.
