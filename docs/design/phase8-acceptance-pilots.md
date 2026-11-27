# Phase 8 — Acceptance pilots, negative scenarios, AC matrix

Status: executed 2026-11-27. Every row below cites what was actually run.
Vocabulary is fixed: VERIFIED / PARTIAL / UNVERIFIED / BLOCKED / NOT_SUPPORTED.

Pilot projects are disposable and live outside this repository
(`$TMPDIR/opencode/…`), so their artifact files are ephemeral. This document is
the durable record; the artifact names are listed so a rerun can regenerate them.

**Gap-closure run (after `5d22f798`, owner-authorized).** Four gaps were closed and
are reflected in the tables below: the Vue parity gate was executed, the Pilot B
database adapter was implemented and exercised, an axe-core 4.10.2 WCAG 2.2 AA scan
ran on all three pilots, and `@types/react` was added to the disposable Pilot A so
`tsc --noEmit` could finish. The a11y scan found a real contrast defect in the pilot
markup (9 nodes in A and B, 1 in C); fixing it changed the approved revision, so all
three pilots were re-run end-to-end with fresh Canvas approvals. The digests quoted
below are from those post-fix runs, except where a row explicitly cites the earlier
run. No product file and no product dependency changed.

## Environment

- Repo HEAD: `a54fd036` for the first pass, `5d22f798` for the gap-closure run.
- `node` v24.21.0, `php` 8.5.10 (`/opt/homebrew/bin/php`), `composer`, `npm`.
- Playwright from this repo's `node_modules`.
- Pilot A: React 19 + TypeScript + Vite 7 app (`design-build-pilot-react`).
- Pilot B: Laravel 13.44.1 + Inertia React 3 (`pilot-b-laravel`), scaffolded with
  `composer create-project` **outside** the product; Rlogic untouched.
- Pilot C: Vue 3.5 + Vite 7 (`pilot-c-vue`), minimal app written for this check.

## Pilot A — React + TS + Vite (mandatory)

Detection (`detect-project.mjs`): `framework: react`, `variant: react-vite`,
`language: typescript`, `previewMode: framework-native`, `runner: native`.

| Proof required | What was executed | Result |
|---|---|---|
| detection | `detect-project.mjs` on the pilot root | VERIFIED |
| native TSX generation | `src/sections/01-app-shell.tsx` is the shipped component; referenced as `component-source` | VERIFIED |
| dependency reuse | no install during the run; component imports only `react` (`imports: ["react"]`) | VERIFIED |
| live Canvas rendering | `POST /api/sessions` with `previewMode: framework-native`, Canvas UI iframed `http://127.0.0.1:5199/`; frames resolved to the real dev server | VERIFIED |
| interactive behavior | filter input narrowed rows `3 → 1`, counter `1 of 3`, clear restored `3` | VERIFIED |
| desktop + mobile | 5 viewports captured `1440x900, 1280x900, 768x1024, 390x844, 360x800` | VERIFIED |
| change-request lifecycle | Canvas `#changes` + chat message ("add a text filter…") drained as `request-changes` + chat; filter implemented; re-approved as `r2` | VERIFIED |
| revision-tied approval | `verifyApprovalRevision` → `OK` for the approved revision; append one line → `STALE_REVISION` (`reapprovalRequired: true`); restore → `OK` | VERIFIED |
| reuse during integration | `frameworkCompleteEvidence.identitySha256` = shipped component digest = approved revision digest | VERIFIED |
| final build + verification | `npx vite build` exit 0 (`step3.json build.code = 0`); `npx tsc --noEmit` exit 0 recorded in `typecheck.json`. `step3.json` itself records the workflow's own pre-install run as `BLOCKED_MISSING_DEV_DEPENDENCY` (exit 2) — the workflow refused to install, the owner added the type packages afterwards | VERIFIED |
| accessibility (WCAG 2.2 AA) | axe-core 4.10.2, tags `wcag2a/wcag2aa/wcag22aa`, 15 rule groups pass; first scan flagged `color-contrast` on 9 nodes, colours changed `#6b7688 → #55606f` / `#8a94a6 → #5c6675`, rescanned 0 violations | VERIFIED |
| zero independent HTML | `docs/design/sections/**.html` count = `0` after the native run | VERIFIED |
| rendered parity gate | `section-gate.mjs` exit 0, `receipt OK`, `G2 PARITY_PASS`, 25 measurement rows matched, 0 drift, `SECTION_COMPLETE` | VERIFIED |
| approval carried through real HTTP | verdict produced by a real browser click on `#approve` in the Canvas page opened from `POST /api/sessions` | VERIFIED |

Artifacts: `artifacts/phase8/{step1-feedback.json, canvas-desktop.png,
canvas-mobile.png, canvas-change-request.png, step2.json, canvas-r2.png,
canvas-r2-approved.png, approved/*.png, candidate/*.png,
section-gate-request.json, step3.json, a11y.json, typecheck.json}`.

Approved revision after the contrast fix: revisionDigest `960e4e12ef68…`,
designDigest `ca5a0b4f2751…`, `completionScope: FIXTURE_ONLY`. The pre-fix run
approved `eda9e03578de…` / `96862228a3c2…`; that approval is not reused.

## Pilot B — Laravel + Inertia React (mandatory)

Detection: `framework: laravel`, `variant: laravel-inertia-react`,
`language: javascript`, `previewMode: framework-native`, `runner: native`,
`previewServers: [php artisan serve, npm run dev]`.

| Proof required | What was executed | Result |
|---|---|---|
| Laravel + Vite coordination | `php artisan serve` on `:8000` + `npm run dev` on `:5273`; Inertia page resolved with both healthy | VERIFIED |
| existing shell / components / CSS / fonts reuse | scaffold Blade shell + `HandleInertiaRequests` reused; `resources/css/app.css` loaded through `@vite` (`tailwindLoaded: true`); no component library or custom font exists in the scaffold to reuse | PARTIAL |
| fixture data | `ReceivingData::bag()` reads `database/fixtures/receiving.json`; Inertia props carry `dataMode: "fixture"` | VERIFIED |
| Inertia-compatible rendering | page JSON in `<script data-page="app">` → `component: "Receiving"`; component mounted in `#app` | VERIFIED |
| Canvas feedback / approval | Canvas iframed `:8000`, `#approve` clicked in the real UI, verdict `approve`, bound to `r1` (`OK`) | VERIFIED |
| component reuse | `resources/js/Pages/Receiving.jsx` digest = approved revision digest; present in `public/build/manifest.json` entry | VERIFIED |
| production data adapter | migrations `receiving_stats`/`receiving_rows`, `ReceivingSeeder` (fixture rows + one DB-only row `PO-2099`), real `fromDatabase()` via `DB::table`; `RECEIVING_SOURCE=production` rendered `data-mode: source: production`, 4 rows including the DB-only row, zero page errors | VERIFIED |
| rendered integrity | production build (`npm run build` exit 0, hot file removed) served through the Laravel manifest: `builtAsset: true`, no `@vite/client`; 25/25 measurement rows matched across 5 viewports; filter `3 → 1 → 3` | VERIFIED |
| functional verification | `contractChecks` all observed; `G0–G3 PASS`, `SECTION_COMPLETE` | VERIFIED |
| revision-tied approval | append to the page component → `STALE_REVISION`; restore → `OK` | VERIFIED |
| accessibility (WCAG 2.2 AA) | axe-core 4.10.2, 16 rule groups pass; first scan flagged `color-contrast` on 9 nodes, colours changed `#6b7688 → #55606f`, rescanned 0 violations | VERIFIED |
| zero independent HTML | `docs/design/sections/**.html` count = `0` | VERIFIED |

Artifacts: `artifacts/phase8/{pilot-b.json, canvas-r1.png, canvas-r1-approved.png,
approved/*.png, candidate/*.png, section-gate-request.json, a11y.json,
production-adapter.json, production-adapter.png}`.

Approved revision after the contrast fix: revisionDigest `a2a4867fba87…`,
designDigest `c37064160349…`. The pre-fix approval `ed993f4e…` / `ffeb6256…` is not
reused.

The production adapter proof is a separate mode from the gate run: the gate was
measured on fixture props, then `RECEIVING_SOURCE=production` was started to show the
database path returns different data (`PO-2099`, present only in the database). That
is why AC-14 still holds — the two modes are labelled by `dataMode`, never blended.

TypeScript was not part of this pilot (`npx tsc --noEmit` exit 1, no TS sources,
no TS toolchain in the scaffold); it is not counted as a verification.

## Pilot C — Vue + Vite

Detection: `framework: vue`, `variant: vue-vite`, `language: vue-sfc`,
`previewMode: framework-native`, `stylingSystem: plain-css`.

Canvas iframed `http://127.0.0.1:5290/`: `h1` "Receiving overview", 3 rows,
`chip: framework-native · receiving · c1`, zero page errors at 1440x900 and
390x844; filter interaction `3 → 1`, counter `1 of 3`; `#approve` verdict
`approve`; `verifyApprovalRevision` → `OK` → edit → `STALE_REVISION` → restore `OK`.

The full native gate was later executed on this project (originally out of scope):
`npx vite build` → `vite preview` on `:5301` → `section-gate.mjs` exit 0,
`receipt OK`, `G2 PARITY_PASS`, 25/25 measurement rows matched across 5 viewports,
`SECTION_COMPLETE`; production HTML `builtAsset: true`, no `@vite/client`.
Accessibility: axe-core 4.10.2, 16 rule groups pass, 0 violations after the
contrast fix.

Approved revision after the contrast fix: revisionDigest `284afd63f4ee…`,
designDigest `284afd63f4ee…` (single component, no separate design contract).

Artifacts: `artifacts/phase8/{pilot-c.json, pilot-c-gate.json, canvas-desktop.png,
canvas-mobile.png, canvas-gate.png, approved/*.png, candidate/*.png,
section-gate-request.json, a11y.json}`.

## Negative scenarios — executed checklist

| # | Scenario | Executed | Observed |
|---|---|---|---|
| 1 | unsupported framework → explicit result | `detect-project.mjs` on a Svelte-only project | `framework: svelte`, `runner: generic`, `previewMode: null` — explicit, no silent HTML/native conversion |
| 2 | missing dependency → reported, not installed | Pilot A `npx tsc --noEmit` without `@types/react` | exit 2, `TS7016`, recorded as `BLOCKED_MISSING_DEV_DEPENDENCY`; the workflow installed nothing and stopped. (The owner later added the type packages to the disposable pilot so the gap could be closed — see the gap-closure note; the workflow's refusal to install is what this row records) |
| 3 | failed dev server → reported | `ensurePreviewServer` with `node -e "process.exit(3)"` | `PREVIEW_START_FAILED`, `reason: EXIT_3`, `ECONNREFUSED`; child stopped |
| 4 | failed compilation → visible error state | one syntax error injected into the Pilot A component while the dev server ran | `vite-error-overlay` visible with `Missing semicolon`, app not rendered (`renderedApp: false`); the Canvas frames that same URL. Component restored afterwards |
| 5 | revision change → stale approval rejected | all three native pilots | `STALE_REVISION` in A, B, C, `OK` again after restore |
| 6 | missing approval → integration blocked | Pilot A gate request with `canvasApproval` removed | exit 1, `INVALID_RECEIPT / APPROVAL_BINDING_INCOMPLETE`, checkpoint stayed `PARITY_PASS` (no completion) |
| 7 | failed final verification → no completion | one measurement `actual` tampered | exit 1, `INVALID_RECEIPT / measurementContradiction`, checkpoint stayed `PARITY_PASS` |
| 8 | legacy HTML session → still completes | `node --test tests/lib/plan-canvas-*.test.js tests/lib/design-build-*.test.js` | pass 17, fail 0 |
| 9 | user-owned dev process → survives cleanup | Pilot A owned preview killed by the runtime registry; Pilot B `php artisan serve` never owned | owned preview killed only itself; Pilot A dev server and Pilot B Laravel server both still answering after cleanup |

Record: `$TMPDIR/opencode/phase8-negatives/{negatives.json, failed-compilation.png}`.

## AC matrix (plan §11)

| AC | Status | Evidence |
|---|---|---|
| 01 framework detected from real evidence | VERIFIED | detections for react-vite, laravel-inertia-react, vue-vite; explicit generic result for Svelte |
| 02 native preview uses actual language/framework | VERIFIED | shipped `.tsx`, `.jsx`, `.vue` sources rendered through their own stacks |
| 03 existing deps/components reused | VERIFIED | no install during any workflow run; Pilot A imports only `react`; Pilot B reuses the Laravel/Blade/Inertia scaffold (scaffolding installs happened while creating the representative app, before the workflow run) |
| 04 Canvas displays actual framework output | VERIFIED | Canvas iframe resolved to each dev-server URL for React, Laravel/Inertia and Vue; screenshots per pilot |
| 05 interactive behavior supported | VERIFIED | filter interactions in A, B, C |
| 06 desktop+mobile functional | VERIFIED | 5 viewports per pilot; 15 measured screenshots total |
| 07 feedback/approval operational | VERIFIED | verdicts drained for A (`request-changes` then `approve`), B, C |
| 08 approval identifies reviewed revision | VERIFIED | `verifyApprovalRevision` `OK`, staleness rejected on change in all three pilots, `OK` after restore |
| 09 approved implementation reused in integration | VERIFIED | identity digest = approved revision digest in A and B |
| 10 no duplicate HTML-to-framework implementation | VERIFIED | zero `docs/design/sections/*.html` in the native runs |
| 11 final rendered verification operational | VERIFIED | native G2 `PARITY_PASS` for A (25 rows), B (25 rows) and C (25 rows), 0 drift |
| 12 typography and a11y intact | VERIFIED | typography parity measured; axe-core 4.10.2 WCAG 2.2 AA scan on all three pilots: 1 serious `color-contrast` violation found and fixed in the pilot markup, rescanned 0 violations (A 15 rule groups pass, B 16, C 16) |
| 13 gates can't report false completion | VERIFIED | scenarios 6 and 7 refused completion with explicit codes |
| 14 fixtures not mistaken for production | VERIFIED | `dataMode: fixture` in session, gate and checkpoint; `completionScope: FIXTURE_ONLY`; the database path was exercised only in a separately labelled `source: production` mode |
| 15 OpenCode+AGY compatible | PARTIAL | OpenCode path executed end-to-end in all three pilots; AGY still not run by the owner |
| 16 legacy HTML usable | VERIFIED | suite pass 17 |
| 17 original Canvas planning not regressed | VERIFIED | full `plan-canvas-*` + `design-build-*` suites green |
| 18 no silent HTML fallback | VERIFIED | skill policy + unsupported-framework result (`previewMode: null`) requires an owner decision; no HTML was generated in any native run |
| 19 workflow-owned processes cleaned up | VERIFIED | owned `vite preview` killed; user-owned dev/Laravel processes survived |
| 20 framework support claims backed by execution | VERIFIED for react-vite, laravel-inertia-react, vue-vite; NOT_SUPPORTED for every other framework | only executed variants are claimed native |

## Honest gaps

- **G1 — Pilot A type check: CLOSED.** `tsc --noEmit` exit 0. The pilot lacked
  `@types/react`; the workflow refused to install it (correctly — see negative
  scenario 2), and the owner then added `@types/react`/`@types/react-dom` to the
  disposable pilot so the check could finish. The install touched only the pilot.
- **G2 — Pilot B production data path: CLOSED.** Real migration, seeder and
  `DB::table` adapter; `RECEIVING_SOURCE=production` returned a DB-only row that the
  fixture cannot produce.
- **G3 — Pilot B font/component reuse: open, PARTIAL.** The scaffold ships no component
  library and its optional webfont plugin was not exercised; only the Tailwind CSS
  pipeline was loaded. There is nothing to reuse, so this cannot be raised by more work
  in the pilot.
- **G4 — a11y depth: CLOSED for automated checks.** axe-core 4.10.2 WCAG 2.2 AA on all
  three pilots: 0 violations after fixing a real `color-contrast` defect. This is not a
  manual screen-reader audit; keyboard focus order and screen-reader announcements were
  not tested.
- **G5 — AGY path: open.** AC-15 stays PARTIAL until the owner runs
  `/opl-design-build` in AGY. No amount of repo-side work closes it.

## Rerun

```sh
# Pilot A (vite dev on :5199 first)
node "$TMPDIR/opencode/design-build-pilot-react/pilot-a-step2.mjs"
node "$TMPDIR/opencode/design-build-pilot-react/pilot-a-step3.mjs"
# Pilot B (php artisan serve :8000 and npm run dev :5273 first)
node "$TMPDIR/opencode/pilot-b-laravel/pilot-b-step1.mjs"
# Pilot C (vite dev on :5290 first); covers Canvas approval AND the parity gate
node "$TMPDIR/opencode/pilot-c-vue/pilot-c-gate.mjs"
# Negative scenarios
node "$TMPDIR/opencode/phase8-negatives.mjs"
```

Accessibility rerun is a Playwright script: load each pilot URL, `addScriptTag` with
`axe-core@4.10.2` from unpkg, then `axe.run(document, {runOnly: {type: 'tag',
values: ['wcag2a','wcag2aa','wcag22aa']}})`. Results are written to each pilot's
`artifacts/phase8/a11y.json`.

Pilots require their dev servers; Pilot B's script stops Vite itself before the
production build and expects the Laravel server to stay up.

## Cross-check of this document (evidence review)

Every numeric claim above was re-derived from the artifact files, not from the
narrative. What was read and what it returned:

| Claim | Artifact read | Value |
|---|---|---|
| Pilot A gate | `step3.json` / `section-gate-request.json` | `receipt OK`, `PARITY_PASS`, `SECTION_COMPLETE`, 25 rows all `PASS`, G0–G3 `PASS`, `build.code 0`, `htmlFiles []`, `imports ["from 'react'"]` |
| Pilot A approval | `step2.json` | `bound OK`, `stale STALE_REVISION`, `restored OK`, fp `960e4e12ef68…`, design `ca5a0b4f2751…` |
| Pilot B gate | `pilot-b.json` | `receipt OK`, `PARITY_PASS`, `SECTION_COMPLETE`, 25 rows all `PASS`, `bound OK`, `stale STALE_REVISION`, `restoredBinding OK`, fp `a2a4867fba87…`, design `c37064160349…` |
| Pilot B production data | `production-adapter.json` | `mode: source: production`, 4 rows, `PO-2099` present, 0 page errors |
| Pilot C gate | `pilot-c-gate.json` | `receipt OK`, `PARITY_PASS`, `SECTION_COMPLETE`, 25 rows all `PASS`, fp `284afd63f4ee…`, `builtAsset true` / `noViteClient true` |
| a11y | three `a11y.json` | 0 violations, 15/16/16 rule groups passing |
| Pilot A type check | `typecheck.json` | exit 0 (post-install run) |

Two corrections were made during this review:

1. The Pilot A type-check row originally claimed VERIFIED without an artifact
   behind the exit-0 run. `typecheck.json` was written and the row now cites it,
   while `step3.json` keeps the workflow's own `BLOCKED_MISSING_DEV_DEPENDENCY`
   record — both are true and both are shown.
2. Pilot A's per-row measurements are not in `step3.json` (that file carries a
   boolean `measurementsPass`); the 25 rows live in `section-gate-request.json`.
   The table above now points at the right file.

Claims this review could not strengthen: the pilot directories are ephemeral, so
the artifacts vanish with `$TMPDIR`; AC-15 stays PARTIAL without an AGY run; the
a11y result is an automated axe pass, not a manual screen-reader audit; and Pilot B
font/component reuse has nothing to reuse in the scaffold, so it cannot rise.
