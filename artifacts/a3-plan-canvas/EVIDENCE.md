# Phase A3 Evidence — Shared Plan Canvas & Exact Verdict Binding

- Baseline: `4d9f132d` (A0–A2 commit, owner chose "Commit A2 dulu")
- Scope per owner: strict binding for `antigravity-cli` target ONLY; Canvas V2 **implemented** (not deferred); OpenCode legacy path untouched.

## Files Touched
- `scripts/lib/plan-canvas/verdict-binding.js` (NEW): strict binding validator, 100k prompt limit, MIME/size/count attachment validation, content-addressed persistence.
- `scripts/lib/plan-canvas/sessions.js`: `open()` accepts `target`/`workspace`/`sessionDir`; `queueFeedback()` enforces strict verdict binding for agy sessions, rejects plain/chat/host-button verdicts, flags `STALE_REVISION` from live file digest.
- `scripts/lib/plan-canvas/server.js`: `POST /api/sessions` forwards target metadata; `POST /api/attachments` stores bounded base64 batches.
- `scripts/plan-canvas.js`: `open --target --workspace --session-dir` flags.
- `tests/lib/plan-canvas-antigravity.test.js` (NEW): 13-case contract suite.

## TDD Cycle
- RED: `node tests/lib/plan-canvas-antigravity.test.js` → `Cannot find module '../../scripts/lib/plan-canvas/verdict-binding'` (compile-time RED on intended new module).
- GREEN: 13/13 PASS after implementation.

## Verification (all GREEN)
- A3 suite: 13/13; plan-canvas sessions 16/16; markdown 64/64; scripts 0 fail; hooks 4/4 + pending; e2e integration 9/9.
- A1/A2 regression: adapter 14/14, workflow-state 9/9, review-fixes 8/8, install-targets 60/60, antigravity-install-target 10/10, context-carriers 22/22, carrier closure 0 escapes / 0 dynamic requires.
- `node --check` OK on 4 changed JS files.

## Live HTTP Smoke (ephemeral loopback server)
- OPEN target=antigravity-cli: 200 open.
- BOUND verdict (revisionDigest+workspace+session+timestamp): accepted 1.
- PLAIN legacy verdict on agy session: accepted 0 (rejected).
- Canvas V2 attachment (image/png): 200 stored, content-addressed file exists (16 bytes); invalid MIME → 400.

## Honest Gaps
- No live `agy --sandbox` invocation in A3 (account eligibility block from A2 persists; native `.agents/` discovery already proven in A1). Verdict binding verified via native Node HTTP server, which is the same transport `ecc-plan-canvas` uses.
- No full `tests/run-all.js` re-run (18 pre-existing/registry failures from A2 remain untouched).

## Status
`PHASE_A3=WORKFLOW_VERIFIED` — halted at A3 exit gate awaiting owner ratification before Phase A4.
