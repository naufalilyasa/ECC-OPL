# Detector Characterization (AC-019)

Status: `CHARACTERIZED` / execution `NOT_RUN`
Frozen against: `.opencode/commands/e2e-map.md` @ `76b3d4037a0144df2d40dc0eca01777690762a7cccc5d9562b0330333dfdb142`
(see `../SOURCE-BASELINE-FROZEN.md`)
Characterized: M1, 2026-11-22
Rule text is quoted **verbatim** from the source lines named below. M1 characterizes what exists;
it ports nothing. Porting is M3/M5 work after the DEC gates.

Every stack row below is one detector in `.opencode/commands/e2e-map.md` Step 1 (`e2e-map.md:31-42`).
`Rule source line` points at the exact line; the anchor form is `e2e-map.md:NN`.

## 1. Stack detectors (10 rows)

| Stack | Glob / rule text (verbatim) | Rule source line | Exclusions as written | Observed gap vs V2 contract |
|---|---|---|---|---|
| Next.js App Router | ``{app,src/app}/**/page.{ts,tsx,js,jsx}``; skip `route.ts` (API) unless asked | e2e-map.md:33 (source line 33) | `route.ts` (API) unless asked | Dynamic `[...slug]` / route groups not classified → `PARTIAL` not encoded |
| Next.js Pages | ``{pages,src/pages}/**/*.{ts,tsx,js,jsx}``; skip `_app`, `_document`, `api/` | e2e-map.md:34 (source line 34) | `_app`, `_document`, `api/` | `getServerSideProps`-only pages indistinguishable from UI pages |
| Astro | ``src/pages/**/*.{astro,md,mdx}`` | e2e-map.md:35 (source line 35) | none stated | Content-only `.md`/`.mdx` can enter as UI routes without a browser surface |
| SvelteKit | ``src/routes/**/+page.svelte`` | e2e-map.md:36 (source line 36) | none stated | `+layout.server.ts` guards and `+error.svelte` not read → auth signal missed |
| Nuxt | ``{pages,src/pages,app/pages}/**/*.vue`` | e2e-map.md:37 (source line 37) | none stated | `definePageMeta` middleware guard not read → `public/authenticated` unknown |
| Vue Router | ``createRouter({ routes: [...] })``, `<Route path>` | e2e-map.md:38 (source line 38) | none stated | Config-object routes need parsing; `path:` in nested children not flattened |
| React Router | ``createBrowserRouter``, `<Route path>`, `path:` | e2e-map.md:39 (source line 39) | none stated | Guard wrappers (`<Protected>`) not correlated to route children |
| Laravel | ``routes/web.php``, ``routes/api.php`` | e2e-map.md:40 (source line 40) | none stated | `api.php` is a browser/API split that is detected but not classified as API-only |
| Yii2 | ``config/web.php`` `urlManager` rules + controller action names | e2e-map.md:41 (source line 41) | none stated | Rule arrays are runtime-composed; static read gives `PARTIAL` at best |
| Express / Fastify / Hono | grep ``\.(get|post|put|patch|delete)\(['"]/`` | e2e-map.md:42 (source line 42) | none stated | Server routes are all API; no browser surface — must be flagged, not mapped as UI |

Rows characterized: **10** (≥9 required). Anchors 33–42 are each covered exactly once.

Fallback rule (`e2e-map.md:44`): "If no detector matches, report the directories you scanned and
ask for the router entry point." This is the required honest-reporting behaviour and is preserved
by contract — a detector must never invent a route it did not match.

## 2. Post-detection rules the detectors depend on

| Rule | Source line | V2 relationship |
|---|---|---|
| Classify: path, static/dynamic, public/authenticated, has mutation, locale variants | e2e-map.md:48 (source line 48) | Feeds `journey_key`, `risk`, `side_effects[]`; dynamic → `PARTIAL` (D4) |
| Collapse i18n mirrors into ONE flow with a locale parameter | e2e-map.md:50 (source line 50) | Identical to freeze rule D1 (B05) |
| Group routes into flows, mark money/auth/destructive as `critical path` | e2e-map.md:54 (source line 54) | Identical to freeze rules D2 + `risk` field (B06) |
| Read `TESTS.md` at root or docs-map path | e2e-map.md:58 (source line 58) | Matches §2 registry-path resolution; docs-map honoured only when valid and in-repo |
| `click-path-audit` for hard-to-follow state | e2e-map.md:64 (source line 64) | Preserved skill dependency |

## 3. Known semantic conflicts (2)

## Conflict 1 — `Command:` means two different things

- `.opencode/commands/e2e-map.md:89` writes `Command: /e2e <flow name>` into the Section 4 template.
- `.opencode/commands/e2e.md:69` defines `Command:` as "the exact Playwright CLI command `e2e-runner`
  executed (e.g. `npx playwright test ...`) — not the `/e2e` slash command".

The map template therefore emits a value that the run contract explicitly forbids in that field.
V2 resolution: `Command` = actual Playwright CLI; `Invocation` = the `/e2e …` string, stored
separately (`contracts/command-contract.md` §5). M2+ must fix the template — M1 must not touch it.

## Conflict 2 — `stale` used as a State label

- `.opencode/commands/e2e-map.md:62` lists `stale` as a flow bucket alongside `covered`/`unmapped`
  ("TEST-ID references a route that no longer exists").
- `.opencode/commands/e2e-map.md:101` reports `covered` / `unmapped` / `stale` counts as a status
  summary, reinforcing the reading that `stale` is a state.
- `e2e-map.md:103` says "mark stale ones `stale`", and `e2e-map.md:79` shows `- State: missing`
  in the same block — so `stale` is one edit away from landing in the `State:` field.

V2 resolution: `stale` is an **assessment-only** classification; the Registry `State` enum is
`missing`, `in progress`, `unverified`, `covered`, `not applicable`. A legacy `State: stale` row is
a schema mismatch — propose a correction, never migrate silently — `PENDING_DEC DEC-12`.
`e2e-map.md` is frozen in M1 and must not be edited; the correction is M3/M5 work.

## 4. Expected-output contracts (F01–F06)

Companion: `reports/F01-F06-map-output-expected.json`, `status: NOT_RUN`, `deferred_to: M2`.

Each fixture entry describes what a conforming detector **must** output and what it must never
output. Fixture execution is ASM-02 validation, deferred to M2; no detector was run in M1.

| Scenario | Fixture | Contract |
|---|---|---|
| B01 | F01 — Next.js App Router | 3 journeys, API `route.ts` excluded, locale dedup, guard detected |
| B02 | F02 — Next.js Pages Router | 1 journey, 3 exclusions (`_app`, `_document`, `api/`) |
| B03 | F03 — Laravel + Inertia | 2 journeys, role labels, critical-path flag |
| B04 | F04 — React Router | 2 journeys, guarded + nested detected, dynamic `PARTIAL` |
| B04 | F05 — SvelteKit / Astro / Nuxt | 3 stack reports, 0 invented paths, dynamic `PARTIAL` |
| B04 | F06 — Yii2 / Express / Fastify / Hono | 4 route groups, API flagged, conditional `PARTIAL` |

## 5. What M1 did not do

No detector was executed, no route was discovered, no fixture was run, no journey was mapped.
`/e2e-map` was not disabled and `e2e-map.md` was not edited. Characterization is static: source
lines, quoted rules, and the contract each rule must eventually satisfy.
