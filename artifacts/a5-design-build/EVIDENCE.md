# Phase A5 Evidence — Design-Build V2 & Typography Fidelity

- Baseline: `22262b8a` (A4 commit)
- Owner decision: gate A5 **honored** — "Buat sertifikat Track A dulu" (waive ditolak).

## Track A Admission Certificate (precondition R12/IS-6/GAP-6)
- `docs/design/evidence/p-web1/track-a-admission.json` — status `ADMITTED`, bound to approved bundle seal `b1200df0…`.
- Paired browser-rendered PNGs at BOTH required viewports:
  - desktop-1440 (1440x900): `00-topbar-approved-1440.png` + `00-topbar-repaired-1440.png`
  - mobile-390 (390x844): `00-topbar-approved.png` + `00-topbar-repaired.png`
- Gate results G0–G3 all PASS; coherent sequence; `renderedEvidence.source=chromium-playwright, verified=true`.
- Verifier `scripts/design-build-v2/track-a-admission.mjs` rejects missing viewport, corrupt PNG, bad dims, digest mismatch, non-PASS G2, and incoherent gate order. Test: 8/8.
- Scope honesty: disposable fixture only, `COOPERATIVE_NOT_MANDATORY`, `Deployment authorization: NOT_GIVEN`.

## A5 Gate Module (TDD RED → GREEN)
- RED: `node tests/lib/design-build-antigravity-gate.test.js` → `Cannot find module '../../scripts/lib/design-build-antigravity-gate.mjs'`.
- GREEN: 6/6.
- `scripts/lib/design-build-antigravity-gate.mjs`: `resolveDesignBuildResource` (opencode → `scripts/design-build-v2/`, agy → `.agents/skills/opl-design-build`), `enforceTrackAAadmission` (hard BLOCKED unless ADMITTED), `verifyGateChain` (G0–G3 all PASS in order), `checkRepairCap` (max 2 cycles), `DESIGN_BUILD_SUBCOMMANDS` = design/typography/verify/amend.
- Projection verified: `commands/design-build.md` → `.agents/skills/opl-design-build/SKILL.md`, `commands/typography.md` → `.agents/skills/opl-typography/SKILL.md` (default remap, no explicit entry needed).

## Verification (all GREEN)
- A5 admission 8/8; A5 gate 6/6; design-build V2 suites 13+10+40+55 pass / 0 fail.
- Regression: adapter 14/14, install-targets 60/60, antigravity-install-target 10/10, workflow-state/review-fixes/context-carriers/plan-canvas-antigravity/e2e-antigravity-runner all exit 0.
- Carrier closure: 0 escapes, 0 dynamic requires, 35/35 relative specifiers.
- `node --check` OK on both new modules.

## Honest Gaps
- No live `/opl-design-build` invocation via `agy --sandbox` (account eligibility block persists from A2; native `.agents/` discovery proven in A1).
- Fidelity remains a mechanism proof on a disposable fixture, not a production claim; deployment still NOT_GIVEN.

## Status
`PHASE_A5=WORKFLOW_VERIFIED` — Track A prerequisite satisfied via certificate; halted at exit gate awaiting owner before A6.
