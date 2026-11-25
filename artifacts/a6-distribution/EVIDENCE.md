# Phase A6 Evidence — Canonical Distribution Manager & Rollback Engine

- Baseline: `0f8e29db` (A5 commit); owner decision: commit lokal saja, review anchor = diff `42fae4eb..HEAD`.
- Canonical commit constant A6.2 = `42fae4ebb5e995690d3a5752b461e475d229c40e` (plan value; live HEAD recorded separately by caller).

## Files Touched
- `scripts/lib/eccskills-distribution.js` (NEW): `generateReleaseManifest` (deterministic SHA-256, excludes audit/session/creds, expands directory scaffolds, accepts canonical installer operations via `sourceRoot`), `buildOwnershipLedger`, `detectManagedConflicts` (dry-run, no writes), `installRelease` (backup → write → digest verify → ledger), `rollbackRelease` (restore unmodified managed files, preserve user edits, remove added files, drop ledger).
- `tests/lib/eccskills-antigravity-cli.test.js` (NEW): 7 cases (determinism, per-file digest/size, exclusions + closure, ledger, conflict dry-run, install+rollback with user-edit preservation, unknown target reject).
- This evidence file.

## A6.1 Registration (verified, no code change)
- `antigravity-cli` registered in `scripts/lib/install-targets/registry.js` ADAPTERS.
- `scripts/install-apply.js --target antigravity-cli --dry-run --profile core` → root `.agents/`, 407 ops, no writes.
- Schema enums (`schemas/{context-carrier,ecc-install-config,install-modules}.schema.json`) already include `antigravity-cli` (from A1).

## TDD Cycle
- RED: `node tests/lib/eccskills-antigravity-cli.test.js` → `Cannot find module '../../scripts/lib/eccskills-distribution'`.
- GREEN: 7/7.

## Verification (all GREEN)
- A6 7/7; adapter 14/14; workflow-state 9/9; review-fixes 8/8; install-targets 60/60; antigravity-install-target 10/10; context-carriers exit 0; plan-canvas-antigravity 13/13; e2e-antigravity-runner 8/8; Track A admission 8/8; design-build gate 6/6.
- carrier closure: 0 escapes / 0 dynamic requires / 35-35 specifiers. `node --check` OK.
- Real-plan integration: `resolveInstallPlan` (agy, core) → 404-file manifest, deterministic SHA `2d54b4a6ce0f63de...`, ledger 404 entries.

## Honest Gaps
- Rollback tested with synthetic file fixtures, not a full 404-file production replay (would write into `.agents/`); mechanism proven with user-edit preservation.
- No `--target antigravity-cli` install executed against a live project (dry-run only); full install deferred to owner.
- `scripts/ecc.js` high-level command surface not modified; canonical `install-apply.js` already accepts the target.

## Status
`PHASE_A6=WORKFLOW_VERIFIED`. All phases A0–A6 complete.
