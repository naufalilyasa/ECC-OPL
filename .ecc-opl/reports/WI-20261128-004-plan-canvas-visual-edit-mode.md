# WI-20261128-004 — Plan Canvas framework-native visual edit mode

deliveryStatus: COMPLETED_WITH_LIMITATIONS
verificationStatus: PARTIAL (real browser runs on React/Vite, Vue/Vite, Laravel+Inertia and a two-instance shared-component page; Svelte/Next/Nuxt/Angular unverified)

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

Owner-app changes (authorized section only, `nexvora-hris`):

- `resources/views/app.blade.php` — SDK include behind `@env(['local','development'])`.
- `resources/js/pages/auth/login.tsx` — `mt-4` → `mt-6` (the applied visual edit).
- `app/Http/Middleware/SecurityHeaders.php` — `X-Frame-Options` now production-only, because the
  canvas frames the dev server. **Owner confirmation for this header change is still pending.**

The `// hmr probe` line added during the HMR investigation was removed; the file diff is the
`mt-4` → `mt-6` change only.

## Verification

```
node tests/run-all.js plan-canvas   300 / 300 passed (14 files)
node scripts/ci/validate-commands.js
node scripts/ci/command-registry.js --check
npm run catalog:check
```

Pre-existing, unrelated failures in this repo are unchanged and not caused by this work item:

- `install-modules.json` schema: `/modules/47/paths` must NOT have fewer than 1 items.
- `tests/scripts/npm-publish-surface.test.js`: 2 failures.
- ESLint is unusable locally (`Cannot find module '.../eslint-visitor-keys'`).

## Limitations

- Svelte, Next, Nuxt and Angular hosts are unverified. DEC-01 makes none of them a requirement,
  but no claim should be made about them.
- The Laravel `X-Frame-Options` change is live in the owner app and awaits owner sign-off.
- The Plan Canvas session store is in-memory: restarting the canvas server discards sessions. This
  is why failed-submission retry was proven by mutating the session digest rather than killing the
  server.
- Row 20's stale detection follows **node identity**. A Fast Refresh that keeps the node correctly
  does not mark stale; a re-render that replaces it does.

## Next permitted step

Owner review of this report and of the `nexvora-hris` `SecurityHeaders.php` change. Every row of
the functional matrix is now either proven in a browser or covered by the suite; no open row
remains for the accepted architecture.
