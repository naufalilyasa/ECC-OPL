# WI-20261128-004 — Plan Canvas framework-native visual edit mode

deliveryStatus: COMPLETED_WITH_LIMITATIONS
verificationStatus: PARTIAL (real browser runs on React/Vite, Vue/Vite, Laravel+Inertia, a two-instance shared-component page, a two-instance real React component, and the phase-8 capture surface incl. an internal-scroll fixture; Svelte/Next/Nuxt/Angular and an Antigravity CLI canvas runtime unverified)

## Summary

Plan Canvas gained an opt-in **Edit** mode for reviewing a running app section instead of a
markdown artifact: the canvas frames the real dev-server page, the owner clicks a rendered
element, changes CSS properties, and one **Apply** posts a structured change set through the
existing feedback channel. The agent applies it to native source. Overrides live in a
memory-only constructable stylesheet, so no app file is touched until the agent does the work.

The honest-reporting rule is the core of the design: an override is only recorded when the
read-back proves the rendered value changed. A property that still loses the cascade is
reported, never fake-applied. A refused submission keeps every pending edit and reuses the
frozen change-set id, so a retry is a duplicate rather than a second edit. A DOM node the app
replaces marks the target stale and blocks Apply.

Proven in real browsers against three hosts: a React/Vite pilot, a Vue/Vite pilot, and the
owner-authorized `nexvora-hris` `/login` section (Laravel 13.40 + Inertia React 3), where the
loop ended in a real source edit (`mt-4` → `mt-6`).

Phase 8 adds two surfaces to the same canvas, without a second capture engine:

- **Content-only screenshots.** A drawer captures the current viewport, the full page, the
  selected element, every configured viewport, or every registered content state as PNG. Bytes
  come from the host-side Playwright browser re-opening the reviewed URL, so no canvas chrome,
  marker, handle or inspector can appear in the file, and the real viewport size and DPR are kept.
- **Content State Explorer.** A preview declares `states`/`themes` through `--review-meta`; the
  drawer offers exactly those. A state the preview did not declare is refused with 409 instead of
  silently rendering the default, and a state declared unavailable (`value: null`) is shown
  disabled. The app renders each state through its own framework — `?scenario=` in React, Vue and
  Inertia — so nothing is rewritten from outside and no data or role is faked.

Every capture lands under the work item's `evidence/design/captures/` with a manifest entry
carrying route, viewport, DPR, theme, state, source classification, revision, result and
limitations. A full-page capture that cannot include an application scroll container says
`partial` and names the container instead of pretending it is complete.


## Objective

Implement the accepted architecture for framework-native visual editing inside Plan Canvas and
close the 23-row functional acceptance matrix, without instrumenting app builds and without
adding a Babel/Vite transform — the SDK locates elements by authored source attribute only.

## Decisions

- **DEC-01** No Babel/Vite AST instrumentation. The SDK resolves ownership from `data-ecc-source`
  attributes that the existing `planCanvasAnnotations()` plugin already emits.
- **DEC-02** One SDK, three injection paths: standalone HTML (script tag), React/Vite and
  Vue/Vite (existing plugin), Laravel/Inertia (a published Blade partial, because Inertia serves
  the root document through Blade so `transformIndexHtml` never runs).
- **DEC-03** Edit mode is opt-in per session (`--edit-mode`); the default plan-review path is
  byte-for-byte unchanged.
- **Amendment 2** Never report success when the rendered property did not change. Transitions and
  animations are nulled for registered targets first, the probe reads after two animation frames,
  and a losing cascade is reported as `<prop> stays at <value> - another rule wins.`
- **Amendment 3** Clear overrides only at server ack. A refused or failed submission preserves
  edits and retries with the same frozen change-set id.
- **Amendment 4** Validate session and preview revision when `preview.mode === 'framework-native'`
  (`STALE_REVISION`, `SCOPE_UNCONFIRMED`, `PREVIEW_MODE_MISMATCH`).
- **Amendment 5** Only `origin: 'authored'` design tokens are clickable — a coincidental literal
  match is not treated as a token.
- **Amendment 6** Prove the SDK is absent from a production build (`vite build`, and a Laravel
  `APP_ENV=production` response).
- **Amendment 7** No public `ui-canvas` command; all evidence lives in this work item.

## What was built

Commits on `main`:

- `7b34e3bb` — framework-native visual edit mode: `scripts/lib/plan-canvas/sdk.js` (edit engine,
  override sheet, read-back probe, `revalidate()`), `scripts/lib/plan-canvas/edit-mode.js`
  (inspector, `submitEdits()` ack/reject branches), `scripts/lib/plan-canvas/change-set.js`
  (digest compare, scope/mode validation), CLI flags.
- `5cbfbb06` — `plan-canvas vendor <app-dir>` publishes
  `resources/views/vendor/ecc-plan-canvas/sdk.blade.php`, idempotent, refuses a directory with no
  `artisan`.
- `a6441f20` — the chrome keeps the preview visible at mobile width.
- `d7c2e458` — the transition fix: CSS transitions outrank `!important`, so a target's
  transitions/animations are now nulled before the read-back, and `data-ecc-edit` survives Reset.

Documentation: `docs/design/plan-canvas.md` gained a "Framework-native visual edit mode" section
(this change set).

Phase 8 — content-only capture and Content State Explorer:

- `scripts/lib/plan-canvas/capture.js` — viewport presets, `captureOne`, `captureBatch(items,
  shouldStop)`, draft replay from pending overrides, evidence-root resolution, manifest append,
  and the full-page scroll/fixed/virtualisation probes with honest `partial` reporting.
- `scripts/lib/plan-canvas/server.js` — `POST .../capture`, `POST .../capture-batch`,
  `POST .../capture-cancel`, `GET .../captures`, `GET .../captures/:id` (sha256 re-verified),
  `POST .../captures/:id/attach` (reuses the Canvas V2 attachment transport). State and theme are
  validated against what the preview declared.
- `scripts/lib/plan-canvas/ui.js` — screenshot drawer, gallery with per-file download and attach,
  batch download, cancellation, and status text that names element crops and limitation counts.
- `scripts/lib/plan-canvas/sdk.js` — `applyDraft`, `state` in `contextFor()`, retried `pc:ready`.
- `scripts/lib/plan-canvas/sessions.js` — `sanitizePreviewMeta` accepts state/theme declarations.
- `scripts/plan-canvas.js` — `--review-meta <file.json>`.


## Acceptance matrix

`plan/PLAN-CANVAS-VISUAL-EDIT-MODE-PLAN.md` §functional matrix now carries a per-row evidence
column. Roll-up:

| Category | Rows | State |
|---|---|---|
| select, edit, read-back, undo/redo/reset, submit, apply to source, ack ordering, source render | 1–6, 8, 9 | proven on React, Vue, Laravel |
| dev-only SDK injection / production absence | 7, 15 | proven on all three (§Amendment 6) |
| responsive layout, mobile inspector | 10, 16 | proven on Vue and Laravel; React pilot had no responsive pass |
| specificity / `@layer` conflict honesty | 17 | proven on React (specificity, `!important`) and on a layered page (layered `!important` rejected, unlayered-beats-layered read back) |
| multiple elements in one Apply | 18 | proven — `cs-mx09colh-muijzu`, 2 targets, both effective |
| failed submission preserves + retries | 19 | proven — live `STALE_REVISION`, edits kept, frozen-id retry accepted |
| HMR replacing the selected DOM marks stale | 20 | proven — node replacement marks stale and blocks Apply; frame reload clears pending and says so; a node-preserving Fast Refresh correctly stays valid |
| mode switching keeps pending edits | 21 | proven |
| interactions preserved outside Edit mode | 12 | proven on Laravel |
| revision-aware approval | 13 | suite-only (`tests/scripts/plan-canvas.test.js`) |
| legacy standalone HTML + ordinary plan review unchanged | 22 | suite-only |
| OpenCode/AGY install closure intact | 23 | suite-only (`validate-commands`, catalog check) |
| shared-component instance isolation | 11 | proven — two clones of one template; editing one leaves the sibling at `15px`, the selector matches one element, component scope is owner-confirmed |
| one real React component, two instances | 11 / 7 | proven — one `StatCard` definition, two call sites; runtime override and an instance-only source prop both leave the sibling at `26px` |

## Closure cycle (external verdict follow-up)

The external verdict was **ARCHITECTURE ACCEPTED** with eleven numbered closure
requirements. The editor was not rebuilt; every change landed in the existing
`scripts/lib/plan-canvas/` modules.

| # | Requirement | What changed | Evidence |
|---|---|---|---|
| 1 | per-target stale tracking | `staleTargets` set in `edit-mode.js`; `pc:select` drops only the reselected id; `pc:targets` prunes stale ids from pending and reports a dropped count | closure test 1 |
| 2 | freeze the payload, not the id | `editFrozen` carries `{id, fp}` where `fp = JSON.stringify(targets)`; a changed payload mints a new id; the ack clears only the submitted keys | closure tests 2, 3 |
| 3 | preview-only / submitted / applying / ready / failed | `VISUAL_EDIT_STATES` + `setVisualEdit` in `sessions.js`, `visualEditFor()` in `server.js`, `#editLifecycle` in `ui.js` | closure tests 5, 5b; browser run |
| 4 | full revision binding | `normalizeChangeSet()` rejects `MISSING_REVISION`, `SECTION_MISMATCH`, `REVISION_MISMATCH`, `DESIGN_MISMATCH`; exact `revisionDigest` equality for framework-native sessions | closure test 6; `plan-canvas-change-set.test.js` |
| 5 | reconcile document-scoped state | `quietTargets` in `sdk.js`; the quieting rule is emitted only while a read-back is pending, then stripped with `data-ecc-edit`; `dropOverrides(keys)` backs `pc:clear-overrides` with keys | closure tests 4, 7 |
| 6 | real inspector controls | typed `EDIT_FIELDS` (`length`/`number`/`color`/`select`/`text`), sliders + exact input + unit selects, `<details>` groups, breadcrumb, before/after pending rows, sticky footer, lifecycle line; raw CSS confined to `Advanced`; the whole inspector column collapses from an `Inspector` toolbar button next to `Panel` (`.layout[data-inspector="hidden"]`, aria-pressed mirrors state) so the preview can go full width | `evidence/phase7-item6-inspector-ui.md` |
| 7 | instance-only change in real source | `StatCard` rendered twice; override then a call-site prop; sibling untouched | `evidence/phase7-item7-react-component-instances.md` |
| 8 | Nexvora change stays uncommitted | no commit or push touching `nexvora-hris`; the frame exception remains `@env(['local','development'])` | `git status` on the owner app |
| 9 | installed-runtime closure | installed OpenCode canvas was missing `change-set.js`/`edit-mode.js` and four stale modules; synced and then loaded and run from the installed path | `evidence/phase7-item9-installed-runtime-closure.md` |
| 10 | focused behavioural tests | `tests/lib/plan-canvas-visual-edit-closure.test.js`, 9 assertions over the eight listed scenarios | suite run below |
| 11 | consolidated report | this document | — |

## Evidence

- `evidence/phase7-react-vite.md` — pilot, injection, authored tokens, edit loop, conflict honesty,
  post-review fix pass.
- `evidence/phase7-vue-vite.md` — pilot, amendment 5, full loop, mobile 375×667, two-element Apply.
- `evidence/phase7-laravel-inertia.md` — `vendor`, Blade partial, amendment 6, HMR.
- `evidence/phase7-nexvora-auth.md` — owner-authorized section: `mt-4` → `mt-6` change set
  `cs-mx08ox43-arst3v`, undo/redo/reset, mobile width, the transition root cause.
- `evidence/phase7-acceptance-gaps.md` — rows 17, 18, 19, 20, 21, 12 with the live status strings.
- `evidence/phase7-row11-shared-component.md` — row 11: two instances of one template, instance
  isolation, one-element selector, owner-confirmed component scope, sibling re-render.
- `evidence/phase7-review2-high-fixes.md` — the four HIGH findings from quick review run 2, each
  with the live status strings that prove the fix.
- `evidence/phase7-item6-inspector-ui.md` — the reworked inspector in a real browser: typed
  controls, no PENDING/EFFECT/status overlap, lifecycle `preview-only` → `submitted` → `ready`,
  390×844 stacking.
- `evidence/phase7-item7-react-component-instances.md` — one real `StatCard`, two call sites;
  runtime override and an instance-only source prop, sibling untouched.
- `evidence/phase7-item9-installed-runtime-closure.md` — the installed OpenCode canvas before and
  after the sync, module load map, and the installed server serving on `127.0.0.1:4731`.
- `evidence/item6-item7/*.png` — seven screenshots referenced by the three items above.
- `evidence/phase8-capture-states.md` — the 16 capture acceptance points with their live evidence,
  plus the phase's limitations (open-dialog capture and override carry-over not exercised).
- `evidence/design/captures/` — the produced PNGs and `manifest.json` (git-ignored).
- `evidence/design/review-meta.json`, `review-meta-vue.json`, `review-meta-laravel.json` — the
  state/theme declarations each pilot preview publishes.

Owner-app changes (authorized section only, `nexvora-hris`):

- `resources/views/app.blade.php` — SDK include behind `@env(['local','development'])`.
- `resources/js/pages/auth/login.tsx` — `mt-4` → `mt-6` (the applied visual edit).
- `app/Http/Middleware/SecurityHeaders.php` — `X-Frame-Options` now production-only, because the
  canvas frames the dev server. **Owner confirmation for this header change is still pending.**

The `// hmr probe` line added during the HMR investigation was removed; the file diff is the
`mt-4` → `mt-6` change only.

## Verification

```
node tests/run-all.js plan-canvas   338 / 338 passed (16 files)
node tests/lib/plan-canvas-visual-edit-closure.test.js   9 / 9 passed
node tests/lib/plan-canvas-capture.test.js               22 / 22 passed
node scripts/ci/validate-commands.js                     7 command files
npm run command-registry:check                           up to date
npm run catalog:check                                    72 agents / 7 commands / 380 skills
```

Test-count reconciliation. The report previously recorded **300 / 300 (14
files)**. Reworking the assertions for the closure requirements (per-target
stale, keyed clear, payload fingerprint, reset marker removal, the 58% inspector
stack) moved the same suite to **304 / 304 (14 files)**; one earlier run was
recorded as 303 because it predated an assertion that was added in the same
pass. The closure work item added a fifteenth file,
`tests/lib/plan-canvas-visual-edit-closure.test.js`, with 9 assertions, so the
authoritative figure is **313 / 313 (15 files)**. Only the last number is a
measurement of the current tree.

Phase 8 added `tests/lib/plan-canvas-capture.test.js`, now 22 assertions after the review-run-3
fixes, so the current figure is **338 / 338 (16 files)**. The capture assertions cover the viewport
presets, state/theme declaration rules (undeclared → 409, `value: null` → 409), the batch bound,
batch theme/mode rejection, the drawer's `batchBody` forwarding, the manifest-entry validator,
`safeSlug` traversal rejection, cancellation on an idle session, sha-verified GET and attachment,
a non-PNG / traversal refusal, the evidence path, and the drawer rendering; the browser runs behind
them are listed in `evidence/phase8-capture-states.md`.

### Review run 3 fixes

`/code-review-quick` run 3 returned BLOCK with 4 CRITICAL, 8 HIGH, 8 MEDIUM and 4 LOW findings
(`.ecc-opl/work-items/WI-20261128-004-plan-canvas-visual-edit-mode/review/2026-11-28-plan-canvas-visual-edit-mode-run3.md`).
All were addressed:

- **CRITICAL** — `safeSlug` no longer allows a `.`-only segment as a path segment and `within()`
  bounds every write; capture GET/attach re-reads bytes through the confined sibling-asset reader,
  requires the PNG magic and re-hashes against the manifest entry; `parsePreviewUrl` /
  `previewUrlAllowed` confine the preview to loopback unless `ECC_CANVAS_ALLOW_REMOTE_PREVIEW=1`;
  both POST capture routes require a JSON object and `renderCandidates` only accepts `EDIT_FIELDS`.
- **HIGH** — navigation failure is a failed capture, not `about:blank`; draft replay reports matched
  vs. missing selectors; batch validation rejects an undeclared theme (409) / unknown mode (400)
  up front instead of dropping combos; a concurrent batch is a 409 and holders stop on
  `endSession`/`close()`; `batchBody` keeps the selector and forwards theme/state; `failed`
  reopens; the manifest write is temp-file + `renameSync`; `captureOne` decomposed into
  `captureInContext`/`openPage`/`replayDraft`/`probeLimitations`/`shoot`/`persistCapture`.
- **MEDIUM** — `captureRootFor` passes `session.workspace`; one shared Chromium per batch with a
  fresh context per job; attach honours `session.sessionDir` within the workspace; `loadShots()`
  surfaces non-2xx, `shotDownloadAll` guards re-entry, `reloadArtifact` rebuilds the state/theme
  options; reset and stale-target handling keep the canvas selection consistent; the live bridge
  reads the declared `stateParam` and `resetAll` guards `requestAnimationFrame`; initial SSE
  presence includes `visualEdit`; `--review-meta` rejects a missing value or a non-object.
- **LOW** — dead `allThemes` and unused destructures removed, duplicated manifest lookup
  centralised in `findCapture`, empty `label`/non-string `value` sanitising tightened, temp
  directories cleaned on exit.

Closure suite, all passing:

```
1.  one stale target does not clear another, and its overrides drop
2.  a retry reuses identity plus payload; a changed payload is a new request
3.  edits added while submitting survive the acknowledgement
4.  a reload during an in-flight override resets the editor state
5.  the lifecycle moves submitted -> applying -> ready and blocks verdicts
5b. an agent reply that does not move the digest marks the change failed
6.  a native edit must bind section, revision, digest and design
7.  reset and apply leave no editor-owned styling behind
8.  the inspector exposes real controls per property kind
```

Real-browser runs behind those assertions: React/Vite inspector session
`3bee5e31caad` (desktop 1440x900 and narrow 390x844), React component instances
session `070be98d1f0e`, and the installed-runtime server on `127.0.0.1:4731`. Phase 8 capture
runs: React `stat-cards` session `dba9c83591cb` (all modes, 5/5 viewports, 25/25 state×viewport,
draft replay, attach, cancellation 12/25), Vue `pricing` session `3fa033b6984e`, Laravel/Inertia
`welcome` session `6dcc9f7050ef`, and the internal-scroll fixture session `6001184a5d29`.

Pre-existing, unrelated failures in this repo are unchanged and not caused by this work item:

- `install-modules.json` schema: `/modules/47/paths` must NOT have fewer than 1 items.
- `tests/scripts/npm-publish-surface.test.js`: 2 failures.
- ESLint is unusable locally (`Cannot find module '.../eslint-visitor-keys'`).

## Limitations

- Svelte, Next, Nuxt and Angular hosts are unverified. DEC-01 makes none of them a requirement,
  but no claim should be made about them.
- The Laravel `X-Frame-Options` change is live in the owner app and awaits owner sign-off. Nothing
  was committed or pushed inside `nexvora-hris`.
- Verdict reconciliation. The **external** verdict is ARCHITECTURE ACCEPTED (the eleven closure
  items above are the follow-up). The **internal** quick review run 2 returned BLOCK on four HIGH
  findings; all four are fixed and re-proven in a browser
  (`evidence/phase7-review2-high-fixes.md`). Run 2's MEDIUM and LOW items were deferred at that
  time; the later run 3 review re-raised them together with new CRITICAL/HIGH findings and all of
  run 3's findings are now fixed (see "Review run 3 fixes"). The internal verdict for the current
  tree is therefore clean on the plan-canvas suite, with the capture browser path unit-tested only.
- The Plan Canvas session store is in-memory: restarting the canvas server discards sessions. This
  is why failed-submission retry was proven by mutating the session digest rather than killing the
  server.
- Row 20's stale detection follows **node identity**. A Fast Refresh that keeps the node correctly
  does not mark stale; a re-render that replaces it does.
- **Runtime preview isolation is not source-level component isolation.** The override sheet scopes
  rules per target id, so the sibling instance is unreachable at runtime. A source edit is
  instance-scoped only because it was placed at one call site (a prop). If an agent instead edits
  the shared component definition, every instance changes — which is the correct behaviour for that
  edit, and is why `Scope: Shared component` exists and warns.
- The installed **Antigravity CLI has no plan-canvas runtime**: no `scripts/lib/plan-canvas`, no
  canvas skill directory, no `ecc-plan-canvas` on `PATH`. Its edit-mode closure is therefore not
  verified there. Fixing that means installing a new surface, not closing this one.
- Resize handles are deferred by the external verdict (allowed to follow). Drag-reparenting and
  anything Figma-shaped stays out of scope.
- Installed-runtime closure was checked on this machine only, by loading and running the synced
  modules. No other machine or package-manager install was exercised.
- Capture limitations. Open-dialog capture is not exercised: the capture context is fresh, so it
  can only show a dialog the state itself renders. Override carry-over onto unrelated elements
  after a state switch is not exercised negatively. Cancellation acts between jobs, so a capture
  already running finishes and is counted. The Laravel pilot prints a PHP deprecation notice into
  the page body, which is visible in those captures and is a pilot-environment issue.
- State declaration is a per-preview contract (`--review-meta`), not a per-adapter API. The Vite
  and Blade adapters still only inject the SDK; a project using them must publish its own
  `states`/`themes` file. No adapter currently ships defaults.

## Next permitted step

Owner review of this report, of the phase-8 capture evidence, and of the `nexvora-hris`
`SecurityHeaders.php` change. Every row of the functional matrix and every capture acceptance
point is now either proven in a browser or covered by the suite, with the gaps named above; no
open row remains for the accepted architecture.
