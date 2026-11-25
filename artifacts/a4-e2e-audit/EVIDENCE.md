# Phase A4 Evidence — Unified E2E V2 Runner & Read-only Security Audit

- Baseline: `a7750323` (A3 commit). Owner ratified A3 exit gate with "commit dan lanjut phase selanjutnya".
- Scope: Phase A4 only (plan lines 458-495). A5 remains BLOCKED (Track A visual admission not certified).

## Files Touched
- `scripts/lib/e2e-antigravity-target.js` (NEW): `resolveMapperResource` (opencode → `.opencode/resources/e2e-journey-mapper.md`, antigravity-cli → `.agents/ecc-opl/e2e/e2e-journey-mapper.md`), `E2E_SUBCOMMANDS` (map/run/full/status/help), `READ_ONLY_AUDIT_TOOLS`, `isReadOnlyAuditTools`, `validateReceipt` (rejects malformed ID, non-int/negative assertions, bad timestamp/commit, skipped/zero-assertion, non-behavioral).
- `.opencode/scripts/e2e-registry.mjs`: `map` operation is now target-aware (reads `req.target`, defaults to opencode); agy mapper path is reported without requiring it to exist in the source repo (it is projected at install time).
- `scripts/lib/install/antigravity-agent.js`: added `security-reviewer` to `CANONICAL_CLI_AGENT_TOOLS` with read-only tools `[read_file, grep_search, find_by_name]`.
- `tests/lib/e2e-antigravity-runner.test.js` (NEW): 8-case contract suite.

## TDD Cycle
- RED: `node tests/lib/e2e-antigravity-runner.test.js` → `Cannot find module '../../scripts/lib/e2e-antigravity-target'` (compile-time RED on intended new module).
- GREEN: 8/8 PASS after implementation.

## Verification (all GREEN)
- `node --check` OK on 4 touched files.
- A4 suite 8/8; adapter 14/14; review-fixes 8/8; workflow-state 9/9; install-targets 60/60; antigravity-install-target 10/10; context-carriers exit 0 (22/22); plan-canvas-antigravity 13/13; plan-canvas-sessions pass; plan-canvas scripts pass.
- Carrier closure: 0 escapes, 0 dynamic requires, 35/35 relative specifiers resolved.
- Live `map` operation: opencode default → status OK, mapper `internal:.opencode/resources/e2e-journey-mapper.md`; agy target → status OK, mapper `internal:.agents/ecc-opl/e2e/e2e-journey-mapper.md`.

## Honest Gaps
- No live Playwright journey executed (requires installed project deps + disposable fixture); A4 verifies receipt schema and target resolution, not a full browser run.
- `verifyExecutionEvidence` from the existing e2e-runtime ledger is reused as-is (not re-implemented); receipt validation here is the lighter target-facing schema gate.
- A4 changes left uncommitted in working tree; `.guardian-angel/*` untouched.

## Status
`PHASE_A4=WORKFLOW_VERIFIED` — halted at A4 exit gate awaiting owner ratification before Phase A5 (which is gated on Track A visual admission).
