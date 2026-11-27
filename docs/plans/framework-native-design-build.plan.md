# Implementation Plan: Framework-Native Design-Build & Plan Canvas Live Preview (Revision r1)

- **Status**: **APPROVED r2** — owner verdict `approve` via Plan Canvas (`a9d119cd55f9`, 2026-11-27T08:10:10Z). O1/O2 resolved (see §10). Implementation may begin; every phase still ends with its stop condition + honest status.
- **Repo Baseline**: `dd39119c` (main) + three uncommitted working-tree files (see §1.3 Baseline Commit)
- **Governing Brief**: Owner Master Brief v1.0 — Framework-Native Single-Source Design Workflow (DBN-01..DBN-18)
- **Core Principle**: "What the owner reviews is what the application implements."
- **Nature**: Targeted evolution of `/design-build` + Plan Canvas. NOT a new orchestration framework.

---

## 1. Overview & Intent Announcement

**Intent: CLEAR** — The owner has issued an authoritative brief with 18 numbered architecture decisions (DBN-01..DBN-18), a fixed MVP target matrix, and explicit non-goals. No surviving forks except two owner decisions listed in §10. This plan adopts the brief verbatim and adds only what the verified source inventory forces.

This plan evolves ECC-OPL `/design-build` and Plan Canvas from the current **HTML-first → Canvas approval → framework port → rendered parity** lifecycle into a **framework-native single-source** lifecycle: the artifact the owner reviews in Plan Canvas IS the project's own component source rendered by the project's own dev server. HTML preview remains available as an explicit standalone mode (DBN-15). Legacy in-progress sessions finish compatibly (§9).

### 1.1 What changes in one paragraph

Today, Phase 6 of `skills/design-build/SKILL.md` writes `docs/design/sections/<NN>-<slug>.html` (SKILL.md:287), gets it approved on Canvas, then ports it to framework code and proves "parity" by screenshotting the approved HTML and the framework page side by side (`scripts/design-build-v2/compare-section.mjs:21,40,92-93`; `rendered-authority.mjs:42-73` requires paired screenshot bytes). This creates two implementations that diverge. The target state: detection picks the real project framework (Phase 1), the agent generates real `InventoryPage.tsx` / `InventoryView.vue` source (Phase 2), the project's own dev server renders it (Phase 4), Plan Canvas embeds that live URL instead of a static HTML artifact (Phase 2/5), approval binds to the native source + revision (Phase 6), and integration reuses the approved component verbatim (Phase 7). Gates G0–G3 keep their ordering and semantics but lose the mandatory HTML-pairing in native mode (Phase 6 of this plan).

### 1.2 Already true in the codebase (Phase 0 verified — do not re-do)

| DBN | Already satisfied by | Evidence |
|---|---|---|
| DBN-02 (partial) | `skills/frontend-scaffold/SKILL.md:50-64` Phase 1 already detects next / vite+react before generating | VERIFIED |
| DBN-03/13 | Design intelligence skills exist and are untouched: `design-contract-system`, `frontend-design-direction`, `a11y`, `typography-system`, `ux-typography`, `better-typography` | VERIFIED (no skill named `typography` exists; the three named files are correct) |
| DBN-05 | Plan Canvas is a 6-module service (`scripts/lib/plan-canvas/{server,sessions,ui,markdown,sdk,verdict-binding}.js` + `scripts/plan-canvas.js` CLI) — extended, not rebuilt | VERIFIED |
| DBN-14 | `/opl-design-build` is NOT a second command: `scripts/lib/install-targets/antigravity-cli.js:76,118-129` remaps `commands/design-build.md` → `skills/opl-design-build/SKILL.md` via `remapCommandToSkillName` + `contentTransform: 'antigravity-command-to-skill'` | VERIFIED |
| DBN-16 | Same mechanism proves no new public command is needed | VERIFIED |
| DBN-17 | Track A (`track-a-admission.mjs`, `closure-evidence.mjs`, `scripts/lib/design-build-antigravity-gate.mjs`) is release-compat infrastructure, currently not wired as a per-project hard requirement in the native path this plan builds | VERIFIED (stays untouched) |
| Baseline | `frontend-scaffold` Phase 3 already generates per-contract component files; the HTML-first assumption lives in the **section loop**, not the scaffold | VERIFIED |

### 1.3 Baseline Commit (MUST happen before Phase 1)

The working tree currently carries three uncommitted owner-approved changes that are **baseline, not this plan's work**:

- `scripts/lib/plan-canvas/ui.js` — six labelled viewport presets in `#viewportSel` (Fit, 1440, 1280, 1024, 768, 390, 360, Custom)
- `scripts/lib/plan-canvas/sessions.js` — `DEFAULT_MAX_TEXT_CHARS = 100000` (line 27; was a 4000 ceiling on non-antigravity sessions)
- `tests/lib/plan-canvas-ui.test.js` — updated assertion for the presets

These are already applied to the global runtime `~/.config/opencode`. **Action**: commit them as one baseline commit (e.g. `feat(plan-canvas): viewport presets + 100k prompt ceiling`) before Phase 1 starts, so every phase below has a clean revert boundary. Unrelated dirty files (`.guardian-angel/*`, `.opencode/workflows/active.json`) are runtime state and are excluded from the baseline commit.

---

## 2. Affected User and Ideal State

**Affected user**: The owner (design-build operator) reviewing and approving section designs in Plan Canvas; secondarily any developer running `/design-build` on OpenCode or `/opl-design-build` on Antigravity CLI against a real React/Vue/Laravel project.

| Row | Statement | Reason |
|---|---|---|
| IS-1 | The owner reviews the **actual project-native component** (real TSX/Vue SFC, real Tailwind/tokens/fonts/component library) rendered by the project's own dev server, inside Plan Canvas. | DBN-01/06/07: what is reviewed is what ships. |
| IS-2 | After approval, integration reuses the approved component source verbatim — no regeneration, no translation, no second design pass. | DBN-09/10: single source of UI truth. |
| IS-3 | Approval is bound to the exact reviewed revision; a source/visual-dep change after approval invalidates stale approval and forces re-review. | DBN-07 + Phase 5 brief: approval must correspond to the rendered revision. |
| IS-4 | Standalone HTML mode still works for explicit HTML use cases and legacy sessions; nothing old is deleted or reinterpreted. | DBN-15. |
| IS-5 | `/design-build` on OpenCode and `/opl-design-build` on Antigravity CLI remain one canonical workflow with runtime-isolated state. | DBN-14/16. |
| IS-6 | Gates G0–G3 keep ordering and completion semantics; a failed required gate never reports completion; fixture-only work is never reported as production integration. | Phase 8 brief. |

| Row | Current Gap | Why It Matters |
|---|---|---|
| GAP-1 | Canvas can only display a single static HTML artifact: `serveArtifact()` reads exactly one file (`server.js:688`) and confines sibling assets to `dirname(session.file)` (`server.js:711`). No mechanism exists to embed a live dev-server URL. | The owner cannot review framework-native output at all today. |
| GAP-2 | The iframe hardcodes the artifact path (`ui.js:595`: `src="${artifactSrc}"`, sandbox `allow-scripts allow-forms allow-popups`) with no preview-mode indicator, no external-URL target, no per-revision refresh identity. | Even with a URL, the UI cannot present or label it as a live native preview. |
| GAP-3 | The session model (`sessions.js:183` `open()`, `:216` target only distinguishes `'antigravity-cli'`) has no preview-mode, preview-URL, framework, or revision fields. | No place to carry the native preview contract through Canvas. |
| GAP-4 | The state machine hardcodes the port lifecycle (`state-machine.mjs:16-20`: `PORT_IN_PROGRESS`, `PARITY_PENDING/PARITY_PASS`) and HTML-only reference kinds (`:211-213`: `APPROVED_REFERENCE_KINDS = ['html','css','fonts','assets',...]`). | Native mode cannot express "approved component source, no port step" without new kinds and a port-free path. |
| GAP-5 | `compare-section.mjs:21,40,92-93` hardcodes `docs/design/sections/01-app-shell.html` vs `/react-page.html` screenshot pairing; `rendered-authority.mjs:42-73` mandates **paired** screenshot bytes. | This is exactly the HTML-to-framework parity architecture DBN-10/11 remove from the native path; G2 needs native-baseline inputs instead. |
| GAP-6 | Policy sources teach HTML-first as the only loop: `skills/design-build/SKILL.md:287` (write `docs/design/sections/<NN>-<slug>.html`), `:329` (parity receipts), `:457` (anti-pattern reinforcing port-then-verify); `commands/design-build.md` (236 lines) mirrors it. | Without a two-mode policy edit, agents keep generating HTML even after the plumbing supports native preview. |
| GAP-7 | No framework/project discovery module exists: detection is prose inside `frontend-scaffold` only; nothing resolves monorepo app roots, dev commands, package managers, or styling systems for the design-build loop. | DBN-02: "Never select a framework just because a dependency exists somewhere" needs real evidence-gathering code. |
| GAP-8 | No fixture-vs-production data marker exists anywhere in the section state; a fixture-only preview is indistinguishable from integrated work. | Phase 3/8 brief: fixture-only implementation must NOT be reported as completed backend integration. |

---

## 3. Requirements & Scope Boundaries

### 3.1 Must have

- **R01 (DBN-01/02)**: Framework-native preview is the default mode for projects with a supported renderer; framework + language detected from real evidence (package.json, lockfiles, framework config, tsconfig, vite config, entrypoints, component dirs, routes, composer.json, Laravel/Inertia config, Tailwind config, global CSS/tokens, workspace config, dev scripts). Monorepo: resolve the real app package. Ask the owner only on genuine ambiguity.
- **R02 (DBN-03/04)**: Reuse project-installed dependencies, existing components, existing dev server. Never silently install/upgrade/replace dependencies — report the real blocker and request explicit approval.
- **R03 (DBN-05)**: Extend Plan Canvas in place: additive session fields, one new serve path for live-URL mode, minimal UI additions. No second Canvas service.
- **R04 (DBN-06/07/09/10)**: Approved reference = native component source + imported components + contract + tokens/fonts/assets + preview config + representative data context. Integration reuses it. No HTML-to-framework translation in native mode.
- **R05 (DBN-11/12)**: Native-mode G2 verifies rendered design integrity against the approved native baseline (real browser rendering, responsive profiles, typography/token consistency, app-shell compatibility, computed measurements where they add value) — without mandatory HTML pairing or universal pixel equality.
- **R06 (DBN-08)**: Preview isolation via simplest appropriate strategy (existing preview env, dev-only entrypoint, scoped draft components, dedicated preview route; worktree only when unsafe). Preview data via fixtures/mock callbacks; no production DB writes; content-state coverage (loading, empty, error, partial, success, permission).
- **R07 (DBN-15)**: Two preview modes: `framework-native` (default when a supported renderer exists) and `standalone-html` (explicit exploration + legacy). Silent fallback from native to HTML is prohibited — the real blocker is reported and the owner decides.
- **R08 (DBN-14/16)**: One canonical workflow; `/design-build` (OpenCode) and `/opl-design-build` (AGY projection) verified after changes; runtime-isolated workflow state (`skills/workflow-state` conventions) reused as-is.
- **R09 (Phases 8)**: Gates G0–G3 reordered semantics preserved; gates reuse existing infra with minimum change; a failed required gate cannot advance to `SECTION_COMPLETE`.
- **R10 (Pilots)**: Mandatory Pilot A (React+TS+Vite), mandatory Pilot B (Laravel+Inertia React — owner-authorized target or representative project), secondary Pilot C (Vue; honest `UNVERIFIED` if execution unavailable). Negative scenarios verified without building a validator per scenario.

### 3.2 Must NOT have (scope guardrails)

- No Plan Canvas rewrite, no universal framework compiler, no second design-build command, no new workflow engine.
- No new standalone Metis/Momus/Oracle/orchestration agents (gap pass is inline in this plan, §5).
- No new security/admission system; no unnecessary validators (one negative-scenario suite, not one validator per scenario).
- No per-project Track A certificates (Track A scripts untouched; they remain release-compat infrastructure).
- No touching Guardian Angel, model-provider config, or AGY Bridge.
- No dependency installs/upgrades without explicit owner approval.
- No deletion or reinterpretation of existing approved HTML sections or historical evidence.
- No modification of the active Rlogic product without owner authorization.
- No code written by this plan — implementation starts only after owner approval through Plan Canvas.

---

## 4. Architecture Changes & File Topology

### 4.1 Preview-mode flow (target state)

```
                       ┌─────────────────────────────────────────────┐
                       │  detect-project.mjs (NEW)                   │
                       │  package.json/lockfiles/configs/dev scripts │
                       └───────────────┬─────────────────────────────┘
                                       │ profile {root, appRoot, framework, language,
                                       │  pkgManager, devCommand, styling, components, ...}
                                       ▼
   skills/design-build/SKILL.md (two-mode policy)  -- mode: framework-native -->
                                       │
        agent generates real component source (InventoryPage.tsx / InventoryView.vue)
        + fixture data + preview wrapper (project-convention entry/route)
                                       │
                                       ▼
        project's OWN dev server renders it  -->  preview URL (e.g. http://localhost:5173/preview/inventory)
                                       │
                                       ▼
   sessions.js: session.previewMode='framework-native', session.previewUrl=…, session.previewMeta={…}
                                       │
                                       ▼
   server.js: serveLivePreview() → iframe src = preview URL (absolute http) + open-separately link
                                       │
                                       ▼
   ui.js: mode indicator (framework + preview mode + section + revision), viewport presets (existing),
          refresh, open-separately, theme/content-state controls where supported
                                       │
                                       ▼
   verdict-binding.js (REUSED): approve bound to native reference digest (component source + imports +
   contract + tokens/assets + preview config + revision) — NOT the preview URL alone
                                       │
                                       ▼
   state-machine.mjs: native path skips PORT_IN_PROGRESS/PARITY_PENDING; new kinds;
   G2 = rendered integrity vs approved native baseline (rendered-authority.mjs, native inputs)
```

Standalone-HTML mode is the **existing flow, unchanged**: static artifact → `serveArtifact()` → approve → (legacy) port/parity via `compare-section.mjs`, retained for DBN-15.

### 4.2 Exact file topology

| File | Action | Change |
|---|---|---|
| `scripts/design-build-v2/detect-project.mjs` | **NEW** | Project/framework discovery (Phase 1). Pure functions over the filesystem; no side effects; no persistent registry. |
| `scripts/lib/plan-canvas/sessions.js` | MODIFY | Additive optional fields: `previewMode` (`'framework-native'\|'standalone-html'`), `previewUrl`, `previewMeta` (framework, language, section, revision, contentStates, viewportProfiles, readiness). Defaults preserve current behavior when absent. |
| `scripts/lib/plan-canvas/server.js` | MODIFY | Add `serveLivePreview()` route: when `session.previewMode === 'framework-native'`, the artifact endpoint serves a minimal wrapper that iframes the absolute `previewUrl` (with open-separately fallback link), instead of `fs.readFileSync(session.file)`. Existing `serveArtifact()` untouched for `standalone-html`. |
| `scripts/lib/plan-canvas/ui.js` | MODIFY | Mode indicator (framework + preview mode + section name + revision), "Open separately" link, explicit live-preview-unavailable state; reuse existing `#viewportSel` presets (`applyViewport`, ui.js:265), `reloadBtn`, annotate, theme. No redesign of planning screens. |
| `scripts/design-build-v2/state-machine.mjs` | MODIFY | Add native reference kinds to `APPROVED_REFERENCE_KINDS` (e.g. `'framework-component-source'`, `'framework-imports'`, `'preview-config'`); add port-free native transition path (native mode: `CANVAS_APPROVED → INTEGRATING (reuses PORT_IN_PROGRESS name? — see §10 decision D6) → PARITY_PENDING` where PARITY_PENDING now means "G2 rendered-integrity pending", not "port pending"). `compare-section` pairing excluded from native mode. |
| `scripts/design-build-v2/rendered-authority.mjs` | MODIFY | Accept native-mode inputs: single live screenshot set + approved-baseline reference (component source digest + baseline screenshots) instead of mandatory HTML/candidate **pairs** (lines 42-73). Legacy pair path preserved behind mode flag. |
| `skills/design-build/SKILL.md` | MODIFY | Two-mode policy: Phase 1 gains discovery step (calls detect-project conventions); Phase 6 branches on preview mode — native: generate real component source + fixture data + preview wrapper, request Canvas live preview; HTML: existing text unchanged. New rules: no silent HTML fallback; fixture-only ≠ production integration; reapproval triggers per brief Phase 6. |
| `commands/design-build.md` + `.opencode/commands/design-build.md` | MODIFY (lockstep pair) | Mirror of the SKILL.md changes. `commands/design-build.md` is the OpenCode entry point and the AGY transform source (`antigravity-cli.js:118-129`); `.opencode/commands/design-build.md` is an exact duplicate asserted by `tests/design-build-v2-invariants.test.js:491` and `tests/lib/design-build-direction-a11y.test.js:19,174` — both must change together or tests fail. |
| `scripts/design-build-v2/section-gate.mjs` | MODIFY (minimal) | Forward `previewMode` into the `verifyRenderedParity` context (`section-gate.mjs:62-81` currently hardcodes `screenshotPairs` and drops mode); native mode passes baseline-vs-integrated inputs, legacy keeps the pair path. |
| `scripts/design-build-v2/compare-section.mjs` | MODIFY (minimal) | Add explicit legacy-mode guard/comment: runs only for `standalone-html` sessions; no behavior change for legacy. Not deleted. |
| `tests/lib/design-build-project-discovery.test.js` | **NEW** | Detection unit tests (fixture project trees). |
| `tests/lib/plan-canvas-preview-mode.test.js` | **NEW** | Session fields, serve path selection, UI payload fields (plain-assert runner style). |
| `tests/lib/design-build-native-state.test.js` | **NEW** | State machine native transitions, native kinds, G2 native inputs, gate-order invariants. |
| `tests/lib/antigravity-closure.test.js` (existing) | EXTEND | Assert `/opl-design-build` projection still resolves after SKILL.md/command changes. |

**Reused untouched** (explicit inventory per brief requirement 5): `verdict-binding.js` (computePlanDigest, validateBoundVerdict, validateAttachments, persistAttachments), `scripts/plan-canvas.js` CLI, `markdown.js`, `sdk.js`, `track-a-admission.mjs`, `closure-evidence.mjs`, `scripts/lib/design-build-antigravity-gate.mjs`, `capture-*.mjs`, installer manifests + `install-targets/antigravity-cli.js`, `skills/frontend-scaffold`, `skills/design-contract-system`, `skills/frontend-design-direction`, `skills/a11y`, typography skills, `skills/workflow-state` (cooperative `.opencode/workflows/active.json` — no gate plugin is added, per guardrails).

---

## 5. Metis Gap Pass (inline — gaps between the brief and the current code)

Verdict after resolution: **Gap pass: 8 issues fixed** (each resolved in the phase that owns it; none left open).

| # | Gap found | Evidence (own verification) | Resolution |
|---|---|---|---|
| G-1 | Canvas physically cannot display a live URL: the artifact endpoint is a single `fs.readFileSync` of one file with assets confined to that file's directory. The brief's "iframe embed of the real URL" has no server-side carrier. | `server.js:681` `serveArtifact(res, key, assetPath)`; `:688` `fs.readFileSync(session.file, 'utf8')`; `:700` injects `/sdk.js`; `:711` `baseDir = path.dirname(session.file)` | Phase 2 adds `serveLivePreview()` wrapper route; static path untouched. |
| G-2 | The iframe is a build-time template literal of the artifact path only — no conditional src, no mode label, no separate-open affordance. | `ui.js:595` `src="${artifactSrc}" data-artifact-src="${artifactSrc}" sandbox="allow-scripts allow-forms allow-popups"` | Phase 2 extends payload + header; reuses existing viewport presets (`ui.js:262-287`) rather than new viewport code. |
| G-3 | Session schema has no fields to carry preview mode/URL/framework/revision; `target` is the only runtime discriminator and it gates `MAX_PROMPT_CHARS`, not preview behavior. | `sessions.js:183` `open(filePath, { reopen, target, sessionDir, workspace })`; `:199` `if (target) session.target = target`; `:216` `const strict = session.target === 'antigravity-cli'`; `:242` strict length choice | Phase 2 additive fields with defaults; no schema migration needed (JSON store). |
| G-4 | State machine cannot express the native lifecycle: the only route from `CANVAS_APPROVED` to completion runs through `PORT_IN_PROGRESS → PARITY_PENDING → PARITY_PASS` (`state-machine.mjs:18-19,195-206`), and approved-reference kinds are HTML-shaped. | `state-machine.mjs:16-20` STATES; `:211-213` `APPROVED_REFERENCE_KINDS = ['html','css','fonts','assets',…]`, `CANDIDATE_KINDS = ['framework-implementation','framework-styles']` | Phase 3 adds native kinds + port-free transition; keeps state names where semantically equivalent (brief Phase 6 allows this). |
| G-5 | The parity engine IS the HTML-pairing architecture the brief retires: it hardcodes one specific approved file and one specific React page, and shoots both. | `compare-section.mjs:21` `const refHtml = join(W, 'docs/design/sections/01-app-shell.html')`; `:40` `map = { '/approved': refHtml, '/react-page.html': … }`; `:92-93` `shoot('html', …/approved)` + `shoot('react', …/react-page.html)` | Phase 3 gates it to legacy HTML mode; Phase 6 replaces its role in native G2 with native-baseline verification via `rendered-authority.mjs` inputs. |
| G-6 | `rendered-authority.mjs` requires **paired** screenshot bytes from both sides — in native mode there is no HTML approved reference to pair against, so the function as written would always return `PARITY_UNVERIFIED` for native sections. | `rendered-authority.mjs:42-73`: "Both actual images are MANDATORY — no `?? screenshot` fallback anywhere"; `SCREENSHOT_PAIR_INCOMPLETE`, `DIMENSION_MISMATCH`, `PROFILE_HASH_MISMATCH` branches | Phase 6 adapts inputs: approved-native baseline evidence (source digest + baseline captures) vs integrated captures; pair logic kept for legacy mode. |
| G-7 | Policy teaches exactly one loop. The skill's own anti-pattern list forbids the very thing the new default makes unnecessary, and its Phase 6 step writes the HTML file unconditionally. | `skills/design-build/SKILL.md:287` "Write or update `docs/design/sections/<NN>-<slug>.html`"; `:329` parity receipt recording; `:457` "Porting approved canvas HTML to framework components without verifying live parity…" | Phase 3 two-mode rewrite of SKILL.md + lockstep `commands/design-build.md` (both feed the AGY projection, `antigravity-cli.js:118-129`). |
| G-8 | Two silent-failure traps the brief explicitly forbids have no guard today: (a) a native preview that fails to start could tempt an HTML substitute; (b) fixture-only sections are indistinguishable from integrated ones in any recorded state. | No fixture/production marker exists in `state-machine.mjs` or section records (grep over `scripts/design-build-v2/` returns no `dataMode`/fixture-state field); skill failure path only says record `status: blocked` in BUILD-STATE.md (SKILL.md:318) | Phase 3 policy rule (never substitute HTML; report the real compiler/route/env error) + Phase 5 `dataMode` field on section state (`'fixture' \| 'production'`), surfaced in Canvas payload and gate evidence. |

---

## 6. Implementation Steps

Ordering principle: **vertical slice first** (detection + native preview + Canvas display on one real project), then lifecycle/gate rewiring, with legacy HTML working at every step. Each phase lists goal, files, tests, stop condition, rollback, and honest-status wording.

### Phase 0 — Baseline freeze & discovery record

- **Goal**: Clean revert boundary; discovery facts on disk.
- **Files**: none modified (commit only) + `docs/design/native-discovery.md` (NEW, evidence record of §1.2 table).
- **Tests**: `node --test tests/lib/plan-canvas-ui.test.js` passes on the baseline commit (proves the uncommitted presets/ceiling are green before anything else moves).
- **Stop condition**: baseline commit exists; discovery record committed; `git status` clean except runtime state files.
- **Rollback**: trivially none needed (commit is additive).
- **Status wording**: VERIFIED when tests pass on the baseline commit.

### Phase 1 — Framework/project discovery (`detect-project.mjs`)

- **Goal**: DBN-01/02 — evidence-backed detection producing a runtime profile; no framework chosen because a dependency exists somewhere; monorepo app-root resolution.
- **Files**: `scripts/design-build-v2/detect-project.mjs` (NEW); `tests/lib/design-build-project-discovery.test.js` (NEW).
- **Actions**: pure detection functions reading: package.json (+workspaces), lockfiles (package-lock/yarn/pnpm/bun), composer.json, framework configs (vite/next/nuxt/svelte/angular/tsconfig), Tailwind config, global CSS/token files, entrypoints, component dirs, routes, Laravel/Inertia config, dev scripts. Output profile per brief Phase 1. Ambiguity → explicit `ambiguous` result with the conflicting evidence (owner question), never a guess. MVP targets: React+Vite (TSX/JSX), Vue+Vite (SFC), Laravel+Inertia React, Laravel+Inertia Vue, standalone HTML; generic-runner candidates (Next.js, Nuxt, SvelteKit, Angular, Blade) detected but marked `runner: 'generic'` — **support claims only after functional execution in Phase 8** (NOT_SUPPORTED until then).
- **Tests** (node --test / plain-assert): fixture trees asserting — React+Vite TS detected from `vite.config.ts` + `react` dep + tsx entry; monorepo workspace resolves the app package, not the root; Laravel detected from `composer.json` + Inertia config; conflicting signals (react dep in root, vue app in workspace) → `ambiguous`; empty dir → `standalone-html` candidate with explicit note.
- **Stop condition**: detection tests green; no registry file created (DBN: reuse project state).
- **Rollback**: `git revert` the single new-file commit; nothing else references it yet.
- **Status wording**: detection table entries for MVP five = VERIFIED by tests; generic-runner entries = NOT_SUPPORTED (detection only) until Phase 8 execution evidence.

### Phase 2 — Vertical slice: native preview through Canvas (one real React+Vite project)

- **Goal**: Prove end-to-end early: detected project → real TSX component → project dev server → Canvas shows it with mode indicator. This is the slice that de-risks everything else.
- **Files**: `scripts/lib/plan-canvas/sessions.js` (preview fields), `scripts/lib/plan-canvas/server.js` (`serveLivePreview`), `scripts/lib/plan-canvas/ui.js` (indicator + open-separately + unavailable state), `tests/lib/plan-canvas-preview-mode.test.js` (NEW).
- **Actions**:
  1. `sessions.js`: accept optional `previewMode/previewUrl/previewMeta` in `open()`; serialize them; absent fields = today's behavior byte-for-byte.
  2. `server.js`: when `previewMode === 'framework-native'`, artifact route returns a minimal HTML wrapper iframing the absolute `previewUrl` (sandbox unchanged: `allow-scripts allow-forms allow-popups`) plus a visible "Open separately" link and a "live preview unavailable" state when the URL is unreachable; `standalone-html` path calls existing `serveArtifact` unchanged. No proxying of dev-server assets — the iframe loads them from the dev server origin (decision D2).
  3. `ui.js`: header chip showing `framework · preview mode · section · revision`; wire existing `reloadBtn` semantics to the live frame; keep annotate/theme/panel as-is.
  4. Slice demo: on a small real React+Vite+TS project (or representative fixture app created for the pilot), generate one section as real TSX with fixture data, start `npm run dev`, open Canvas via `scripts/plan-canvas.js open`, confirm the live component renders in the iframe, feedback annotation works, approve binds (existing verdict flow).
- **Tests** (plain-assert): session round-trip with/without preview fields; route selection (native → wrapper with previewUrl present; legacy → file content); UI payload contains mode/section/revision fields; absence of `previewMode` produces identical legacy payload (regression guard).
- **Stop condition**: slice demo recorded (screenshot + session JSON) on one real project; all legacy Canvas tests (`tests/lib/plan-canvas-*.test.js`) still green.
- **Rollback**: revert the three module commits; legacy behavior restored because all changes are additive/conditional.
- **Status wording**: interactive behavior inside the iframe (clicks, forms) = VERIFIED only if exercised in the slice demo; otherwise PARTIAL with the specific unproven interaction named.

### Phase 3 — Two-mode policy (SKILL.md + commands/design-build.md) & state machine native path

- **Goal**: The workflow text stops teaching HTML-first as the only loop; the state machine can express native sections.
- **Files**: `skills/design-build/SKILL.md`, `commands/design-build.md` + `.opencode/commands/design-build.md` (lockstep pair), `staging/distribution/design-build-v2-manifest.json` (hash refresh), `scripts/design-build-v2/state-machine.mjs`, `scripts/design-build-v2/compare-section.mjs` (legacy guard), `tests/lib/design-build-native-state.test.js` (NEW), `tests/lib/antigravity-closure.test.js` (extend).
- **Actions**:
  1. SKILL.md Phase 1: add discovery step referencing the detect-project profile; Phase 6: branch — **native mode**: inspect existing components/inputs/tokens first (DBN-03), generate real component source + fixture data + preview wrapper per project conventions, request live Canvas preview, never generate an HTML substitute on preview failure (report the real error); **HTML mode**: existing text preserved verbatim. Add: fixture-only ≠ completed backend integration; reapproval triggers (design/contract/styling/typography/assets change or owner request) vs non-triggers (backend connect, controller fix, tests, fixture→production data swap without design change — verification still reruns).
  2. `commands/design-build.md` + `.opencode/commands/design-build.md`: identical lockstep mirror (both asserted by invariants + direction/a11y tests).
  3. `state-machine.mjs`: add native kinds; native transitions: `PREVIEW_DRAFT → AWAITING_APPROVAL → CANVAS_APPROVED → INTEGRATING → PARITY_PENDING(G2) → PARITY_PASS → SECTION_COMPLETE` where `INTEGRATING` reuses `PORT_IN_PROGRESS` state name with mode-dependent semantics (decision D6) and `PARITY_PENDING` now means "rendered-integrity verification pending". Missing approval before the Canvas stage = normal progress (`CANVAS_APPROVAL_REQUIRED`), not a startup blocker. Note in the code/policy: `verifyIdentitySeparation()` (`state-machine.mjs:215`) is scoped to `standalone-html`; native single-source integration intentionally reuses the approved component source verbatim, so `approved.referenceSha256 === candidate.implementationSha256` is expected and must not trip the separation check.
  4. `compare-section.mjs`: refuse native-mode input with explicit `LEGACY_ONLY` code (one guard, no rewrite).
  5. `staging/distribution/design-build-v2-manifest.json`: update the `sha256`/`bytes` for `skills/design-build/SKILL.md` and the command mirror. **Baseline finding**: D10 in `tests/lib/design-build-direction-a11y.test.js` is already red at `dd39119c` ("stale hash for skills/design-build/SKILL.md"); editing SKILL.md without refreshing the manifest keeps it red, so this phase must fix it rather than inherit it.
- **Tests**: native transition sequence reaches `SECTION_COMPLETE` without ever passing through a port step; legacy sequence unchanged (existing `design-build-section-gate-advance.test.js` still green); native kinds accepted by `validateAttachments`-style checks; legacy guard fires on native input; closure test asserts `/opl-design-build` projection resolves post-edit.
- **Stop condition**: all design-build tests green on both modes, including the three that are red at baseline `dd39119c` (`design-build-section-gate-advance`, `design-build-direction-a11y` D10, `design-build-v2-invariants`). Baseline red is recorded in the Phase 1 report; this phase must not claim "unchanged, therefore fine".
- **Rollback**: revert SKILL.md+command+state-machine commits as one unit (they must move together); AGY runtime picks up changes on next install/projection reload (re-run installer or re-project skills — no daemon to restart).
- **Status wording**: state-machine semantics = VERIFIED by tests; real-agent policy adherence = PARTIAL until Pilot A executes the native loop.

### Phase 4 — Preview runtime coordination

- **Goal**: DBN-04 — reliable, polite lifecycle around the project's own dev server; Laravel/Inertia two-server reality handled.
- **Files**: `scripts/design-build-v2/preview-runtime.mjs` (NEW, small); tests appended to `tests/lib/design-build-native-state.test.js` or a small NEW test file.
- **Actions**: health/readiness probe (HTTP poll with timeout), start-dedicated-process-only-if-needed, never terminate a process the workflow did not start (PID/ownership recorded at start), refresh/reconnect handling, cleanup of workflow-owned processes on session end, structured error reporting of real compiler/dependency/route/env failures. **No universal process supervisor** — this is one helper module using existing runtime/process utilities. Laravel+Inertia: profile carries both `laravelServer` (artisan serve) and `viteAssets` commands; readiness requires both; Inertia page resolution documented (see §8).
- **Tests**: readiness probe against a stub HTTP server; ownership guard refuses to kill a foreign PID; cleanup kills only owned PIDs; dual-server readiness for the Laravel profile shape.
- **Stop condition**: tests green; slice from Phase 2 re-validated through the helper.
- **Rollback**: revert single module; Phase 2 slice still works with manual dev-server start (skill text covers it).
- **Status wording**: process behaviors VERIFIED by tests against stubs; real Laravel coordination = UNVERIFIED until Pilot B.

### Phase 5 — Approval identity, revision binding & dataMode

- **Goal**: DBN-06/07 — approval bound to the actual reviewed revision; fixture/production distinguishable.
- **Files**: `scripts/design-build-v2/state-machine.mjs` (reference-kind validation for native approvals), `scripts/lib/plan-canvas/sessions.js` (revision stamp on preview meta), `scripts/design-build-v2/preview-runtime.mjs` (revision fingerprint: digest of component source + imported components + tokens/assets inputs), `tests/lib/design-build-native-state.test.js` (extend).
- **Actions**: native approved reference = component source digest + imports manifest + contract ref + styling/tokens/fonts/assets refs + preview config + representative data context (brief Phase 6). Reuse `computePlanDigest`/`validateBoundVerdict` mechanics from `verdict-binding.js` — no crypto framework, just the existing digest pattern applied to the native reference set. Reconciliation: if source or relevant visual deps change between approval submission and acceptance, the revision fingerprint mismatches → approval is rejected as stale with an explicit code; owner re-reviews. Add `dataMode: 'fixture' | 'production'` to section state; gate evidence and completion reports must carry it.
- **Tests**: approval binds to reference digest; source mutation between submit and accept → stale-rejection; non-visual change (fixture data swap with identical rendered design digest) does NOT force reapproval but DOES rerun applicable verification (assert via gate-order test); fixture-only section cannot emit a "production integration complete" record.
- **Stop condition**: binding tests green; Canvas approve/reject flow re-validated on the slice project.
- **Rollback**: revert phase commits; legacy verdict binding untouched throughout (separate code paths).
- **Status wording**: VERIFIED by tests for binding mechanics; multi-section real-project behavior PARTIAL until pilots.

### Phase 6 — Gates G0–G3 adaptation (native mode)

- **Goal**: DBN-11/12 — rendered integrity without the parity problem; ordering preserved.
- **Files**: `scripts/design-build-v2/rendered-authority.mjs` (native inputs), `scripts/design-build-v2/section-gate.mjs` (forward `previewMode` — `section-gate.mjs:62-81` currently hardcodes `screenshotPairs`), `scripts/design-build-v2/state-machine.mjs` (gate wiring), tests extended.
- **Actions**: G2 native = actual browser rendering of the integrated component, compared against the approved baseline evidence (baseline captures + source digest), across required responsive profiles (desktop/tablet/mobile per session), typography consistency, token/layout consistency, app-shell compatibility, computed measurements where they add value (reuse existing landmark/`capture-*` evidence where it helps; no excessive landmark inventories, no universal pixel equality). Same-source-different-context drift (CSS inheritance, app layout, data content) must surface as meaningful-drift findings, not hard pixel failures. `section-gate.mjs` forwards `req.active?.previewMode ?? 'standalone-html'` into the parity context so it selects the native input shape instead of the hardcoded pair. G0 = discovery + dependency availability + preview runtime readiness; G1 = contract + typography + direction + approved native preview; G3 = functional behavior (navigation, callbacks, forms, validation, dialogs, search/filter, loading/error/permission states, keyboard, focus, contrast, responsive interactions, backend data) — retain TDD/E2E where relevant. A failed required gate never advances to `SECTION_COMPLETE` (existing invariant, re-asserted in tests for native path).
- **Tests**: native G2 accepts baseline-vs-integrated evidence and rejects missing baseline captures; legacy pair path still passes existing tests; gate-order invariant holds for native transitions; a fabricated G2 pass without captures is rejected.
- **Stop condition**: all gate tests green both modes.
- **Rollback**: revert rendered-authority + state-machine commits; legacy parity intact.
- **Status wording**: mechanics VERIFIED by tests; real rendered-integrity quality = PARTIAL until Pilot A/B exercise it on real apps.

### Phase 7 — Compatibility, projection & migration

- **Goal**: DBN-14/15 — one workflow, two runtimes, legacy preserved.
- **Files**: `tests/lib/antigravity-closure.test.js` (extend), `skills/design-build/SKILL.md` (migration section), no new runtime code.
- **Actions**: verify `/design-build` on OpenCode and `/opl-design-build` on AGY resolve to the same updated skill; shared Canvas works for both; runtime state isolation per `skills/workflow-state` conventions (`.opencode/workflows/active.json` vs AGY-equivalent) unchanged; legacy in-progress HTML sessions finish under old semantics; old HTML approvals are never reinterpreted as native; migration = new sections choose mode by detection, old sections stay HTML; no historical evidence rewritten. Track A untouched (release-compat only).
- **Tests**: closure test asserts projection integrity + both command surfaces; a legacy-mode session fixture completes its lifecycle unchanged.
- **Stop condition**: compatibility suite green; AGY projection spot-checked (install dry-run).
- **Rollback**: revert SKILL.md/test commits; projection is content-transform-based so rollback is automatic on next projection.
- **Status wording**: OpenCode = VERIFIED in-repo; AGY = PARTIAL until owner runs `/opl-design-build` on the CLI (in-repo evidence is the closure test + dry-run only).

### Phase 8 — Acceptance pilots & negative scenarios

- **Goal**: AC-01..AC-20 evidence on real projects; honest statuses.
- **Files**: none in ECC-OPL product code (pilots run in separate project dirs); evidence records under `docs/design/native-discovery.md` successor + BUILD-STATE style records in the pilot projects.
- **Actions**:
  - **Pilot A (mandatory)**: React+TypeScript+Vite real project. Prove: detection, native TSX generation, dependency reuse, live Canvas rendering, interactive behavior, desktop+mobile, change-request lifecycle, revision-tied approval, reuse during integration, final build + required verification, and **zero independent HTML design implementation generated** (checked by absence of new `docs/design/sections/*.html` in the native run).
  - **Pilot B (mandatory)**: Laravel+Inertia React on a **disposable representative project** created outside the active product (O1 resolved; Rlogic is not touched). Prove: Laravel+Vite coordination, existing shell/components/CSS/fonts reuse, fixture data, Inertia-compatible rendering, Canvas feedback/approval, component reuse, production data adapter, rendered integrity, functional verification.
  - **Pilot C (secondary)**: Vue+Vite — proves Canvas framework-independence; report `UNVERIFIED` if no Vue execution environment is available.
  - **Negative scenarios** (one suite, executed as checklist, no per-scenario validator): unsupported framework → explicit result; missing dependency → reported, not installed; failed dev server → reported; failed compilation → visible in Canvas/error state; revision change → stale approval rejected; missing approval → integration blocked; failed final verification → no completion; legacy HTML session → still completes; user-owned dev process → survives workflow cleanup.
- **Stop condition**: AC matrix (§11) fully populated with honest statuses; owner reviews evidence.
- **Rollback**: pilots are external; ECC-OPL rollback = per-phase reverts above.
- **Status wording**: every AC row carries VERIFIED / PARTIAL / UNVERIFIED / BLOCKED / NOT_SUPPORTED with the exact evidence or the exact reason it is not.

---

## 7. Testing Strategy

- **Runner**: repo uses `node --test` plus `tests/lib/plan-canvas-*.test.js` / `tests/lib/design-build-*.test.js` plain-assert runners — all new tests follow that style; no new test framework.
- **Unit**: `design-build-project-discovery.test.js` (detection over fixture trees); `plan-canvas-preview-mode.test.js` (session fields, route selection, payload, legacy regression guard); `design-build-native-state.test.js` (transitions, kinds, binding, dataMode, gate order).
- **Regression guards**: every phase re-runs the full existing `tests/lib/plan-canvas-*.test.js` + `tests/lib/design-build-*.test.js` suites; the legacy HTML lifecycle must stay green at every phase boundary — this is the "legacy stays working" gate.
- **Integration (manual, recorded)**: Phase 2 slice demo; Phase 8 pilots A/B/C with screenshots, session JSON, approval receipts, and absence-of-HTML evidence as artifacts.
- **Projection**: `antigravity-closure.test.js` extension + installer dry-run spot-check.
- **Coverage intent**: new logic (detection, route selection, transitions, binding) is pure and unit-testable; no coverage-number goal is invented for prose skill changes — their proof is pilot execution, stated honestly.

## 8. Laravel/Inertia Reality Check

An Inertia page is not a static file the Vite server can serve alone. Rendering one requires, in order:

1. **Laravel HTTP server** (`php artisan serve` or equivalent) receiving the request;
2. **A route** (`routes/web.php`) returning `Inertia::render('Inventory', ['props' => …])`;
3. **Inertia page resolution** mapping the component name to the built JS page via `app.blade.php` + `@vite` directives;
4. **The Vite asset server** (`npm run dev`) serving/transforming the JS+CSS bundle the Blade shell loads;
5. **Shared props / auth context** (`HandleInertiaRequests::share`) that the page component may depend on (auth user, flash, locale);
6. **Server-side props** that stand in for real data in preview (fixture data is passed as Inertia props — same component, different data source).

Consequences for this plan: the `laravel-inertia` runtime profile carries **two** processes and readiness requires both (Phase 4); the preview wrapper for a section is a dev-only route + fixture props, never a raw component file opened through Vite alone; the preview must not trigger production DB writes (fixture props only). **Proof without touching the active Rlogic product**: Pilot B runs against either an owner-authorized Rlogic section (read-only execution against a dev environment, no code modification without authorization) or a disposable representative Laravel+Inertia project scaffolded outside the product repo. Either way the evidence demanded is the same: both servers healthy, Inertia page resolves with fixture props, existing app shell renders around the section, Canvas shows it live.

---

## 9. Legacy Compatibility Requirements

- `standalone-html` mode is permanent (DBN-15), reached by explicit choice or when detection yields no supported renderer **and the owner decides** (never silent).
- In-progress legacy HTML sessions complete under old semantics; their approvals and parity receipts are not reinterpreted.
- Existing approved HTML sections on disk are never deleted or invalidated; new native sections live alongside them.
- `compare-section.mjs` and `reproduce-fixture-certificate.mjs` remain functional for legacy runs (guard added to the former; the latter untouched).
- Historical docs (`docs/plans/design-build-v2-fidelity.plan.md`) are not edited — they describe the legacy architecture.

## 10. Decisions I Made For You

| # | Decision | Rationale | Reversible? |
|---|---|---|---|
| D1 | Additive optional session fields with legacy-identical defaults, no schema version bump | JSON store; absent fields = today's behavior; smallest diff | yes |
| D2 | Canvas iframes the dev-server URL directly; no asset proxying through the Canvas server | The dev server already serves its own assets/HMR; proxying would duplicate transport logic and break HMR; "open separately" covers embed-blocked cases | yes |
| D3 | `detect-project.mjs` lives in `scripts/design-build-v2/` (not a new lib dir) | Follows existing topology where all design-build scripts live | yes |
| D4 | No persistent discovery registry file — profile is computed per session and stored in session/section state | Brief: "Don't create a new persistent registry if existing project state suffices" | yes |
| D5 | Native reference kinds added to the existing `APPROVED_REFERENCE_KINDS` array rather than a new schema | Reuses `validateAttachments` machinery; minimal change | yes |
| D6 | `INTEGRATING` reuses the existing `PORT_IN_PROGRESS` state name with mode-dependent semantics instead of adding a new state | Brief Phase 6: "existing names may stay where semantically equivalent"; avoids renaming churn across evidence records | yes |
| D7 | `compare-section.mjs` gets a legacy guard, not deletion | DBN-15 + zero risk to legacy runs | yes |
| D8 | One `dataMode` field instead of a fixture validator subsystem | Guardrail: no unnecessary validators; the field is carried into gate evidence | yes |
| D9 | Vue pilot may report UNVERIFIED | Brief explicitly permits this honest outcome | yes |
| D10 | Tests use the repo's existing plain-assert runners; no new test framework | Consistency; guardrail | yes |
| **O1** | **RESOLVED 2026-11-27: disposable representative Laravel+Inertia project** (owner chose the representative project over an Rlogic WMS section). Created outside the active product; Rlogic is not touched. | Brief prefers real Rlogic but forbids touching it without authorization; the owner chose the safe representative path | resolved |
| **O2** | **RESOLVED 2026-11-27: commit the three uncommitted Plan Canvas files as-is.** Baseline commit is `02fdc85f`. | Gives clean phase reverts; content was already runtime-applied | resolved |

## 11. Success Criteria & Evidence Matrix (AC-01..AC-20)

Only baseline behaviors (AC-16 legacy HTML lifecycle, AC-17 existing Canvas planning) are VERIFIED at plan time. Every AC whose implementation lands in a later phase reads UNVERIFIED/PENDING until that phase's tests actually exist and pass.

| AC | Proven by | Evidence | Honest status at plan time |
|---|---|---|---|
| 01 framework detected from real evidence | Phase 1 tests + Pilot A/B logs | test output + detection record | UNVERIFIED (pending Phase 1 tests) / real-project PARTIAL |
| 02 native preview uses actual language/framework | Pilot A TSX file + rendered output | file + screenshot | UNVERIFIED → pilot |
| 03 existing deps/components reused | Pilot A/B integration diff shows reuse, no dep installs | git diff of pilot repo | UNVERIFIED → pilot |
| 04 Canvas displays actual framework output | Phase 2 slice + pilots | session JSON + screenshot | UNVERIFIED → slice |
| 05 interactive behavior supported | Pilot A interaction exercise | recording/notes | UNVERIFIED → pilot |
| 06 desktop+mobile functional | existing viewport presets + pilot | screenshots both widths | UNVERIFIED → pilot |
| 07 feedback/approval operational | Phase 2 slice + pilots | verdict receipt | UNVERIFIED → slice |
| 08 approval identifies reviewed revision | Phase 5 binding tests | test output + receipt | UNVERIFIED (pending Phase 5 tests) |
| 09 approved implementation reused in integration | Pilot A/B integration diff | git diff | UNVERIFIED → pilot |
| 10 no duplicate HTML-to-framework implementation | absence check in native pilot run | file listing | UNVERIFIED → pilot |
| 11 final rendered verification operational | Phase 6 tests + pilot G2 | test output + G2 record | UNVERIFIED (pending Phase 6 tests) / PARTIAL (quality) |
| 12 typography and a11y intact | G1/G3 with existing skills; pilot checks | gate records | UNVERIFIED → pilot |
| 13 gates can't report false completion | gate-order invariant tests | test output | UNVERIFIED (pending Phase 6 native tests; legacy invariant green) |
| 14 fixtures not mistaken for production | dataMode test + pilot | test output + gate record | UNVERIFIED (pending Phase 5 tests) |
| 15 OpenCode+AGY compatible | closure test + owner AGY run | test output; AGY status | PARTIAL until owner AGY run |
| 16 legacy HTML usable | legacy lifecycle test + optional legacy run | test output | VERIFIED (tests) |
| 17 original Canvas planning not regressed | full plan-canvas test suite per phase | CI/local run log | VERIFIED per phase |
| 18 no silent HTML fallback | policy rule + negative scenario | skill text + scenario record | UNVERIFIED (pending Phase 3 policy + Phase 8 scenario) |
| 19 workflow-owned processes cleaned up | Phase 4 tests | test output | UNVERIFIED (pending Phase 4 tests) |
| 20 framework support claims backed by execution | Pilots only; generic runners stay NOT_SUPPORTED until executed | pilot evidence | NOT_SUPPORTED until proven |

## 12. Risks & Mitigations

- **Risk**: iframe embedding blocked by dev-server frame headers (e.g. Vite CSP changes). *Mitigation*: "Open separately" link is a first-class fallback; never disable app-wide frame restrictions (brief Phase 5).
- **Risk**: Preview wrapper leaks into production (routes/fixtures becoming features). *Mitigation*: Phase 7 policy rule + Phase 8 negative scenario; wrapper isolated in dev-only entry per project conventions.
- **Risk**: State-name reuse (D6) confuses legacy evidence tooling. *Mitigation*: mode is recorded in section state; legacy tests assert unchanged semantics; evidence records carry mode.
- **Risk**: Detection false positives on odd monorepos. *Mitigation*: `ambiguous` result forces owner question; never guess (R01).
- **Risk**: Laravel dual-server flakiness. *Mitigation*: readiness requires both; explicit error naming which server failed; Pilot B is the proof gate.
- **Risk**: Scope creep into a "framework compiler". *Mitigation*: hard guardrail — Canvas only iframes URLs; the project compiles its own code (brief Phase 4).

## 13. Rollback Strategy (per phase, summarized)

Every phase is 1–3 contiguous commits; rollback = `git revert` in **reverse phase order** (not arbitrary order). Phases 2, 3, 5, and 6 share `state-machine.mjs` and `sessions.js`, so reverting an earlier phase requires reverting the later ones that layered onto it first. Within a phase, the commits are a single unit. Because all Canvas changes are additive/conditional and the legacy path is never rewritten, reverting the whole stack restores prior behavior exactly. AGY/runtime projections reload on the next installer run or skill re-projection — no daemon restarts, no state migrations. Phase 8 pilots live outside the repo and need no rollback beyond deleting their project dirs.

## 14. Hand-off & Next Action

**Plan file**: `docs/plans/framework-native-design-build.plan.md` (this file, revision r1).

**Next actions, in order**:
1. ~~Owner resolves O1 (Pilot B target) and O2 (baseline commit confirmation)~~ — resolved 2026-11-27: representative Laravel+Inertia project; baseline commit `02fdc85f`.
2. Owner runs the `plan-reviewer` sub-agent against this file; planner fixes blockers on follow-up; cap 3 rounds.
3. Owner approves through Plan Canvas (existing approval protocol — implementation begins only after that verdict).
4. Implementation worker session executes Phase 0 → 8 in order; every phase ends with the full regression suite green and an honest status line.

**Deliverables at completion (listed, not produced now)**: updated canonical design-build workflow (SKILL.md + command); updated Canvas native preview; framework detection results; native preview demonstration; component source identity + reuse evidence; React/Vite result; Laravel/Inertia result; Vue result; OpenCode+AGY compatibility status; updated G0–G3 behavior; legacy compatibility result; installer projection changes; docs; remaining unsupported capabilities; rollback instructions.
