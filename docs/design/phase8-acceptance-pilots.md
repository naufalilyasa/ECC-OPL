# Phase 8 — Acceptance pilots, negative scenarios, AC matrix

Status: executed 2026-11-27. Every row below cites what was actually run.
Vocabulary is fixed: VERIFIED / PARTIAL / UNVERIFIED / BLOCKED / NOT_SUPPORTED.

Pilot projects are disposable and live outside this repository
(`$TMPDIR/opencode/…`), so their artifact files are ephemeral. This document is
the durable record; the artifact names are listed so a rerun can regenerate them.

## Environment

- Repo HEAD at execution: `a54fd036`.
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
| revision-tied approval | `verifyApprovalRevision` → `OK` for `r2`; append one line → `STALE_REVISION` (`reapprovalRequired: true`); restore → `OK` | VERIFIED |
| reuse during integration | `frameworkCompleteEvidence.identitySha256` = shipped component digest = approved revision digest `eda9e035…` | VERIFIED |
| final build + verification | `npx vite build` exit 0 (30 modules); `npx tsc --noEmit` exit 2 — see gap G1 | PARTIAL |
| zero independent HTML | `docs/design/sections/**.html` count = `0` after the native run | VERIFIED |
| rendered parity gate | `section-gate.mjs` exit 0, `receipt OK`, `G2 PARITY_PASS`, 25 measurement rows matched, 0 drift, `SECTION_COMPLETE` | VERIFIED |
| approval carried through real HTTP | verdict produced by a real browser click on `#approve` in the Canvas page opened from `POST /api/sessions` | VERIFIED |

Artifacts: `artifacts/phase8/{step1-feedback.json, canvas-desktop.png,
canvas-mobile.png, canvas-change-request.png, step2.json, canvas-r2.png,
canvas-r2-approved.png, approved/*.png, candidate/*.png,
section-gate-request.json, step3.json}`.

Approved revision `r2`: revisionDigest `eda9e03578de…`, designDigest `96862228a3c2…`,
`completionScope: FIXTURE_ONLY`.

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
| production data adapter | `ReceivingData::fromDatabase()` exists as the seam and throws by design; no DB path was executed | PARTIAL |
| rendered integrity | production build (`npm run build` exit 0, hot file removed) served through the Laravel manifest: `builtAsset: true`, no `@vite/client`; 25/25 measurement rows matched across 5 viewports; filter `3 → 1 → 3` | VERIFIED |
| functional verification | `contractChecks` all observed; `G0–G3 PASS`, `SECTION_COMPLETE` | VERIFIED |
| revision-tied approval | append to the page component → `STALE_REVISION`; restore → `OK` | VERIFIED |
| zero independent HTML | `docs/design/sections/**.html` count = `0` | VERIFIED |

Artifacts: `artifacts/phase8/{pilot-b.json, canvas-r1.png, canvas-r1-approved.png,
approved/*.png, candidate/*.png, section-gate-request.json}`.

Approved revision `r1`: revisionDigest `ed993f4e…`, designDigest `ffeb6256…`.

TypeScript was not part of this pilot (`npx tsc --noEmit` exit 1, no TS sources,
no TS toolchain in the scaffold); it is not counted as a verification.

## Pilot C — Vue + Vite (secondary)

Detection: `framework: vue`, `variant: vue-vite`, `language: vue-sfc`,
`previewMode: framework-native`.

Canvas iframed `http://127.0.0.1:5290/`: `h1` "Receiving overview", 3 rows,
`chip: framework-native · receiving · c1`, zero page errors at 1440x900 and
390x844; filter interaction `3 → 1`, counter `1 of 3`; `#approve` verdict
`approve`; `verifyApprovalRevision` → `OK`.

Scope of this pilot was Canvas framework-independence. No parity gate was run for
Vue, so the Vue **gate** path is NOT_EXECUTED (not "unsupported").

Artifacts: `artifacts/phase8/{pilot-c.json, canvas-desktop.png, canvas-mobile.png}`.

## Negative scenarios — executed checklist

| # | Scenario | Executed | Observed |
|---|---|---|---|
| 1 | unsupported framework → explicit result | `detect-project.mjs` on a Svelte-only project | `framework: svelte`, `runner: generic`, `previewMode: null` — explicit, no silent HTML/native conversion |
| 2 | missing dependency → reported, not installed | Pilot A `npx tsc --noEmit` without `@types/react` | exit 2, `TS7016`, recorded as `BLOCKED_MISSING_DEV_DEPENDENCY`, nothing installed |
| 3 | failed dev server → reported | `ensurePreviewServer` with `node -e "process.exit(3)"` | `PREVIEW_START_FAILED`, `reason: EXIT_3`, `ECONNREFUSED`; child stopped |
| 4 | failed compilation → visible error state | one syntax error injected into the Pilot A component while the dev server ran | `vite-error-overlay` visible with `Missing semicolon`, app not rendered (`renderedApp: false`); the Canvas frames that same URL. Component restored afterwards |
| 5 | revision change → stale approval rejected | both native pilots | `STALE_REVISION` in Pilot A and Pilot B, `OK` again after restore |
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
| 03 existing deps/components reused | VERIFIED | no install during either workflow run; Pilot A imports only `react`; Pilot B reuses the Laravel/Blade/Inertia scaffold (dependency installs happened while scaffolding the representative app, before the workflow run) |
| 04 Canvas displays actual framework output | VERIFIED | Canvas iframe resolved to each dev-server URL; screenshots per pilot |
| 05 interactive behavior supported | VERIFIED | filter interactions in A, B, C |
| 06 desktop+mobile functional | VERIFIED | 5 viewports per native pilot, 2 for Vue |
| 07 feedback/approval operational | VERIFIED | verdicts drained for A (`request-changes` then `approve`), B, C |
| 08 approval identifies reviewed revision | VERIFIED | `verifyApprovalRevision` `OK`, staleness rejected on change, `OK` after restore |
| 09 approved implementation reused in integration | VERIFIED | identity digest = approved revision digest in A and B |
| 10 no duplicate HTML-to-framework implementation | VERIFIED | zero `docs/design/sections/*.html` in the native runs |
| 11 final rendered verification operational | VERIFIED | native G2 `PARITY_PASS` for A (25 rows) and B (25 rows) with 0 drift |
| 12 typography and a11y intact | PARTIAL | typography parity measured (`h1` 20px, table/heading properties) and the filter carries `aria-label` + `aria-live`; no automated axe/a11y scan was run |
| 13 gates can't report false completion | VERIFIED | scenarios 6 and 7 refused completion with explicit codes |
| 14 fixtures not mistaken for production | VERIFIED | `dataMode: fixture` in session, gate, and checkpoint; `completionScope: FIXTURE_ONLY`; production adapter not exercised |
| 15 OpenCode+AGY compatible | PARTIAL | OpenCode path executed end-to-end in all three pilots; AGY still not run by the owner |
| 16 legacy HTML usable | VERIFIED | suite pass 17 |
| 17 original Canvas planning not regressed | VERIFIED | full `plan-canvas-*` + `design-build-*` suites green |
| 18 no silent HTML fallback | VERIFIED | skill policy + unsupported-framework result (`previewMode: null`) requires an owner decision; no HTML was generated in any native run |
| 19 workflow-owned processes cleaned up | VERIFIED | owned `vite preview` killed; user-owned dev/Laravel processes survived |
| 20 framework support claims backed by execution | VERIFIED for react-vite, laravel-inertia-react, vue-vite; NOT_SUPPORTED for every other framework | only executed variants are claimed native |

## Honest gaps

- **G1 — Pilot A type check blocked.** The pilot scaffold never carried
  `@types/react`; Phase 8 forbids installing dependencies during a pilot, so
  `tsc --noEmit` was recorded `BLOCKED_MISSING_DEV_DEPENDENCY` rather than fixed by
  adding a package. The build and the rendered gate passed regardless.
- **G2 — Pilot B production data path.** Only the fixture adapter ran. The
  database adapter is a declared seam that throws; treating it as proven would
  be dishonest.
- **G3 — Pilot B font/component reuse.** The scaffold has no component library and
  its optional webfont plugin was not exercised; only the Tailwind CSS pipeline was
  loaded. Reported PARTIAL.
- **G4 — a11y depth.** Landmark typography and ARIA attributes were checked, but no
  automated accessibility audit was executed.

## Rerun

```sh
# Pilot A
node "$TMPDIR/opencode/design-build-pilot-react/pilot-a-step2.mjs"
node "$TMPDIR/opencode/design-build-pilot-react/pilot-a-step3.mjs"
# Pilot B (start php artisan serve :8000 and npm run dev :5273 first)
node "$TMPDIR/opencode/pilot-b-laravel/pilot-b-step1.mjs"
# Pilot C (vite dev on :5290 first)
node "$TMPDIR/opencode/pilot-c-vue/pilot-c-canvas.mjs"
# Negative scenarios
node "$TMPDIR/opencode/phase8-negatives.mjs"
```

Pilots require their dev servers; Pilot B's script stops Vite itself before the
production build and expects the Laravel server to stay up.
