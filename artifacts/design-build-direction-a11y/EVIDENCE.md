# Focused acceptance — design-build V2 product direction + accessibility integration

MODE: targeted skill orchestration improvement (no V3, no new orchestrator/agent/command,
no second validator framework, no duplicate design contract). Owner decision: a11y findings
are **blocking** at the relevant gate.

## Affected source files
- `skills/design-build/SKILL.md` — routing by reference (Phase 0 direction, Phase 4 verify,
  cross-cutting a11y, content states, G0–G3 extension, Phase 8 checker), layers table updated.
- `commands/design-build.md` + `.opencode/commands/design-build.md` — shim adapters A7
  (checker) + skill-resolution note; policy stays in the skill.
- `staging/distribution/design-build-v2-manifest.json` — `dependencies.skills` +
  `design_contract`, refreshed hashes for 3 changed files.
- `docs/plans/design-build-v2/foundation-manifest.json` — refreshed canonical hashes for
  the 3 changed canonical files (integrity bind).
- `tests/lib/design-build-direction-a11y.test.js` (NEW) — 10 focused acceptance cases.

## Before → after skill routing
| Phase | Before | After |
|-------|--------|-------|
| 0 Brief | this skill only | + `frontend-design-direction` product direction (by reference) |
| Pre-Freeze | (none) | `a11y` applicable requirements (primary source) |
| 5/6 | framework skills | + a11y foundations / preview inspection / port semantics |
| 8 Gate | `design-taste-frontend` only | + `frontend-design-direction` evidence checker (A7) |

No phase renumbering; pipeline 0/0.5/1/2/3/4/5/6/7/8/9 unchanged. State machine,
section lifecycle, Plan Canvas approval, typography lifecycle, and bounded repair
(max 2 cycles) untouched.

## Product direction & accessibility contract
- Direction captured in existing contract artifacts (no second authority): purpose/domain,
  audience/jobs, actions, hierarchy, density, tone, responsive constraints, interaction
  patterns, required content states, design-system/framework/a11y requirements.
- Enterprise/operational surfaces: scanability and stable data density, no marketing hero.
- a11y requirements before Freeze: semantics, names/roles/states, text+non-text contrast,
  keyboard/focus order, visible focus, form labels/errors, dialog focus, touch targets,
  resize/reflow, reduced motion, live announcements, table semantics. WCAG 2.2 AA baseline.
- Six content states with trigger/feedback/action/recovery/a11y semantics; non-applicable
  needs a reason; unavailable access = UNTESTED not NOT_APPLICABLE.
- G1 `contractChecks` and G3 `interactionChecks` are blocking via the existing state machine.

## Checker execution (real)
- From an authorized app worktree (`<app-worktree>`), report at
  `docs/design/evidence/direction-a11y-integration/report.json`, two real rendered PNGs
  (desktop-1440 / mobile-390 from the authorized p-web1 Rlogic fixture):
  `node <repo>/skills/frontend-design-direction/scripts/check-evidence.js <report>` →
  **PASS** (`Evidence record complete; visual correctness still requires rendered inspection.`).

## Negative / missing-evidence detection
- Missing required viewport in `renderedEvidence` → checker **FAIL** (`missing target viewport 1440x900`).
- `not-applicable` state without reason → checker **FAIL**.
- Escaping artifact path (`../`) → checker **FAIL** (path containment).
- Low-contrast negative HTML fixture via `a11y/scripts/a11y_scanner.py` → **6 issues,
  3 CRITICAL** (img-alt-missing, keyboard-click-no-key, form-input-no-label) and
  `contrast_checker.py gray white` → **FAIL AA Normal Text** (3.95:1).

## Focused regression (all GREEN)
- `tests/lib/design-build-direction-a11y.test.js`: 10/10.
- `tests/design-build-v2-invariants.test.js`: 40/40; `...probes`: 55/55;
  `...functional-completion` and `...hotfix`: fail 0.
- A0–A6 spot check: adapter 14/14, install-targets 60/60, plan-canvas-antigravity 13/13,
  e2e-runner 8/8. `node --check` OK.

## Distribution dependency status (resolved from app worktree)
- Repo checker: RESOLVED; global checker: RESOLVED; installed `a11y` skill: RESOLVED
  (11 references + 2 scripts); global design-build skill: PRESENT.
- Canonical names only — no developer-specific hardcoded paths; user-managed skills untouched;
  global runtime untouched.

## Remaining blockers / honest gaps
- No live `agy --sandbox` end-to-end (account eligibility block from A2 persists).
- Rendered evidence reused from the authorized p-web1 Rlogic fixture; a fresh full app
  section build + live browser walkthrough was not performed in this batch (STOP boundary).
- Checker validates record completeness and local artifact presence only; it does not judge
  screenshot quality or prove WCAG compliance. Real a11y checks executed where tooling allowed.
- No commit/push/deploy performed (owner did not authorize).
