# Design-Build V2 — Product Direction & Accessibility Skill Integration
## External Review Report

**Scope:** targeted skill-orchestration improvement to the existing design-build V2 workflow.
**Mode:** integration BY REFERENCE — no V3, no new orchestrator, no new agent, no new command,
no second validator framework, no duplicate design contract.
**Owner decision:** accessibility findings are **blocking** at the relevant gate (not advisory).
**Repo HEAD at packaging:** `f4c7e9cd` — these changes are **UNCOMMITTED** in the working tree.

---

## 1. Problem statement

Design-build V2 could produce a visually approved page that had no recorded product direction
and no accessibility requirements captured before the design contract was frozen. Two
capabilities existed but were not wired in:

- `frontend-design-direction` — decides purpose, audience, hierarchy, density, tone, responsive
  constraints, interaction patterns, and required content states; ships an evidence checker.
- `a11y` — installed global OpenCode skill with three modes (Audit & Tooling; Concepts &
  Cross-Platform; Frontend Code Patterns), 11 references and 2 scripts.

Neither was reachable from the design-build pipeline, so direction and accessibility were
improvised per section instead of being fixed before Freeze.

## 2. Approach — reference routing, not duplication

Both skills are routed **by reference**. Their content is never copied into
`skills/design-build/SKILL.md`; each is loaded only at the phase that needs it. The pipeline
order `0/0.5/1/2/3/4/5/6/7/8/9`, the section state machine, the section lifecycle, Plan Canvas
approval, the typography lifecycle, and the bounded repair cap (max 2 cycles) are unchanged.

### Before → after routing

| Phase | Before | After |
|-------|--------|-------|
| 0 Brief | this skill only | + `frontend-design-direction` product direction (by reference) |
| Prerequisites (cross-cutting) | — | `a11y` applicable requirements, established before Freeze |
| 5 Scaffold / 6 Preview+Port | framework skills | + a11y foundations, preview inspection, port semantics |
| 8 Gate | `design-taste-frontend` only | + `frontend-design-direction` evidence checker (shim A7) |

No phase renumbering. No new numbered gate. `contractChecks` (G1) and `interactionChecks` (G3)
are blocking through the **existing** state machine.

## 3. What is now enforced

**Product direction (Phase 0).** Recorded in the existing contract artifacts (`DESIGN.md`,
`docs/design/*`, page `CONTRACT.md`) — no second design authority, no new document. Captures
purpose/domain, audience and repeated jobs, primary/secondary actions, hierarchy, density, tone,
responsive constraints, interaction patterns, required content states, and design-system,
framework and accessibility requirements. Enterprise/operational surfaces prioritize scanability,
task efficiency, stable layout and readable data density rather than marketing heroes. Marketing
and editorial surfaces may stay expressive. No universal visual style is imposed.

**Accessibility (before Freeze, WCAG 2.2 AA baseline).** Semantic structure; accessible names,
roles and states; text and non-text contrast; keyboard interaction and focus order; visible
unobscured focus; form labeling and error feedback; dialog/overlay focus management; touch target
size; text resize and reflow; reduced motion; dynamic status announcements; table semantics.
Flutter and Kotlin Compose use native platform semantics and tooling.

`a11y` is declared the **primary** source: `accessibility`, `frontend-a11y` and `a11y-architect`
must not be loaded in parallel unless a real capability gap exists.

**Content states.** Six states — `loading`, `empty`, `error`, `partial`, `success`, `permission`.
Each applicable state records trigger, visible feedback, user action, recovery behavior and
accessibility semantics. A non-applicable state requires a specific reason; unavailable test
access is `UNTESTED`, never `NOT_APPLICABLE`. Business behavior, permission actions and data are
never fabricated to demonstrate a state.

**Freeze boundary.** After Freeze the direction skill is VERIFICATION only. It is not a competing
source of tokens, typography, spacing, radius or composition. Any change to approved visual
decisions goes through the existing amendment process and invalidates the affected approval and
parity evidence.

## 4. Files changed

| File | Change |
|------|--------|
| `skills/design-build/SKILL.md` | New "Product Direction & Accessibility" section; layers table rows added; +144 lines |
| `commands/design-build.md` | Shim adapter A7 (checker invocation, config-root resolution) |
| `.opencode/commands/design-build.md` | Same shim, edited separately (copies were not byte-identical) |
| `staging/distribution/design-build-v2-manifest.json` | `dependencies.skills` + `design_contract`; refreshed hashes |
| `docs/plans/design-build-v2/foundation-manifest.json` | Refreshed canonical hashes (AC01 integrity bind) |
| `tests/lib/design-build-direction-a11y.test.js` | NEW — 10 focused acceptance cases |
| `artifacts/design-build-direction-a11y/EVIDENCE.md` | NEW — evidence report |

## 5. Verification

| Check | Result |
|-------|--------|
| `tests/lib/design-build-direction-a11y.test.js` | **10/10 pass** |
| Portability (empty `OPENCODE_CONFIG_DIR`) | **8 pass, 0 fail, 2 skip** — degrades, does not break |
| design-build V2 invariants | **40/40** |
| design-build V2 probes | **55/55** |
| functional-completion / hotfix | **0 failures** |
| A0–A6 spot check (adapter / install-targets / plan-canvas / e2e) | **14/14, 60/60, 13/13, 8/8** |
| Real checker run on an authorized app worktree | **PASS** — `Evidence record complete` |
| Temp-dir leak check (before/after one run) | **28 → 28** (no new leaks) |
| Personal-path scan on touched files | **CLEAN** |

**Negative controls (proving the checker actually fails):**

- Missing required viewport in `renderedEvidence` → **FAIL** (`missing target viewport 1440x900`)
- `not-applicable` state without a reason → **FAIL**
- Artifact path escaping with `../` → **FAIL** (path containment)
- Low-contrast HTML fixture via `a11y/scripts/a11y_scanner.py` → **6 issues, 3 CRITICAL**
  (`img-alt-missing`, `keyboard-click-no-key`, `form-input-no-label`)
- `contrast_checker.py gray white` → **FAIL AA Normal Text** (3.95:1)

## 6. Prior review round and remediation

A `/code-review-quick` pass over these changes returned **REQUEST CHANGES** (2 HIGH, 1 MEDIUM).
All three were fixed:

1. **HIGH** — test hardcoded `~/.config/opencode/skills/a11y`, ignoring `OPENCODE_CONFIG_DIR`,
   so a fresh clone or CI without the unbundled skill would fail. Now resolved through the
   canonical `resolveOpencodeConfigRoot` helper, with explicit `skip` when the skill is absent.
2. **HIGH** — `tmpReport()` created temp dirs with no cleanup, leaking PNG/JSON every run.
   Now tracked in `TEMP_DIRS` and removed with `rmSync(recursive, force)`.
3. **MEDIUM** — absolute personal path in a committable artifact. Replaced with `<app-worktree>`.

## 7. Honest gaps

- **No live `agy --sandbox` end-to-end run.** The account eligibility block from phase A2
  persists (`Eligibility check failed`). Native `.agents/` discovery was proven live in A1;
  this integration was verified through unit contracts and a real checker run.
- **Rendered evidence is reused** from the authorized p-web1 Rlogic fixture. A fresh full-app
  section build with a live browser walkthrough was not performed in this batch.
- **The checker is not a compliance oracle.** It validates record completeness and local artifact
  presence. It does not judge screenshot quality and does not prove WCAG compliance; automated
  checks alone never establish compliance.
- **Uncommitted.** No commit, push or deploy was authorized or performed.
- **Pre-existing personal paths** remain in `docs/e2e-v2/*` and `docs/plans/*` (including the
  A0–A6 master plan), outside this change's scope and intentionally untouched.

## 8. What the reviewer should check

1. **No duplication** — confirm `SKILL.md` routes to the two skills without copying their content,
   and that no second design authority or validator framework was introduced.
2. **Gate authority** — confirm `contractChecks` (G1) and `interactionChecks` (G3) are genuinely
   blocking via the existing state machine, and that the Freeze boundary leaves the direction
   skill in verification-only mode.
3. **a11y primacy** — confirm the instruction to treat `a11y` as the single primary source is
   unambiguous, and that WCAG 2.2 AA is stated as a baseline rather than a claim of compliance.
4. **Failure modes** — confirm the negative controls above are sufficient evidence that the
   checker fails closed rather than silently passing.
5. **Portability** — confirm the test suite degrades by skipping (not failing) when the unbundled
   `a11y` skill is unavailable.
