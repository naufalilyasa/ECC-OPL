# Phase 5 evidence — approval identity, revision binding & dataMode (DBN-06/07)

Date: 2026-11-27 · Plan: `docs/plans/framework-native-design-build.plan.md` (Phase 5)

## What was added

`scripts/design-build-v2/state-machine.mjs`:

| Export | Behaviour |
|--------|-----------|
| `computeRevisionFingerprint(entries)` | Order-independent sha256 over `{path, sha256}` pairs. Same digest pattern as `verdict-binding.js`, no new crypto. |
| `fingerprintNativeReference(reference)` | Validates the approved reference set (native kinds only, one `component-source` required, digest-per-path conflicts rejected) and returns `revisionDigest` (all reference inputs) plus `designDigest` (visual inputs only). Never reads project files — the caller supplies digests, so the same set is recomputable at acceptance time. |
| `verifyApprovalRevision(approval, reference)` | `designDigest` mismatch → `STALE_REVISION` (`reapprovalRequired: true`); only `revisionDigest` mismatch → `VERIFICATION_REQUIRED` (`reapprovalRequired: false`). Missing digests → `APPROVAL_BINDING_INCOMPLETE` (never defaulted to OK). |
| `verifyCompletionScope(active, claim)` | A section whose `dataMode` is not `production` (or absent, which defaults to `fixture`) cannot return a production-complete claim → `FIXTURE_ONLY`. |
| `DATA_MODES` | `['fixture', 'production']`. |

`advanceCheckpoint` now rejects an unknown `dataMode` (`DATA_MODE_INVALID`) on the active
state and stamps the completion record with the resolved `dataMode`, so a fixture section
cannot be read downstream as production integration.

`scripts/lib/plan-canvas/sessions.js` — `sanitizePreviewMeta` stores `revisionDigest`
(only when it is a valid 64-hex digest) and `dataMode` (only for the two allowed values).
Anything else is dropped, not passed through.

`scripts/design-build-v2/preview-runtime.mjs` — re-exports the fingerprint helpers so the
approval loop has one import for preview + revision concerns.

### Wired into the gate (Phase 6 review follow-up)

`verifyApprovalRevision` and `verifyCompletionScope` now have real callers:

- `verifyReceipt` re-fingerprints `context.nativeReference` at gate time and compares it with
  the Canvas approval event, so an edit made *after* acceptance but before completion is
  caught (`STALE_REVISION`). `VERIFICATION_REQUIRED` is allowed through because the gate run
  itself is the rerun.
- `advanceCheckpoint` records `completionScope` on the completion record and refuses an
  explicit `completionClaim: 'production'` for a fixture section (`FIXTURE_ONLY`).

Path normalization note: `fingerprintNativeReference` compares paths literally, so
`a/b.tsx` and `./a/b.tsx` are different entries. Submit-time and acceptance-time callers must
normalize paths the same way; a mismatch fails closed (digests differ) rather than passing.

## Verification

```
node tests/lib/design-build-native-state.test.js      → 23 passed, 0 failed
node tests/lib/design-build-preview-runtime.test.js   → 12 passed, 0 failed
node tests/lib/plan-canvas-preview-mode.test.js       → 12 passed, 0 failed
```

New Phase 5 assertions: order-independent fingerprint; missing `component-source` rejected;
an `html` kind cannot be smuggled into a native approval; approval binds to the exact digest;
source mutation → `STALE_REVISION`; fixture swap → `VERIFICATION_REQUIRED` with an unchanged
`designDigest`; missing digests rejected; fixture-only completion claim refused; completion
record carries `dataMode`; unknown `dataMode` blocks the gate; preview meta keeps only the
digest and the mode.

## Slice re-validation (real app)

`$TMPDIR/opencode/design-build-pilot-react` (Vite + React + TS), driven by
`slice-phase5.mjs`:

```
server {"started":true,"reused":false}
preview 200 bytes 449
fingerprint OK 5d36c2068925 design 9ac67c2b3529
session meta {"section":"05-inventory","revision":"r1","revisionDigest":"5d36…","dataMode":"fixture"}
approve {"accepted":1,"rejected":0}
afterSourceChange STALE_REVISION true
afterFixtureSwap VERIFICATION_REQUIRED false
scope {"code":"FIXTURE_ONLY","dataMode":"fixture"}
cleanup {"killed":[{"pid":27679,…}],"skipped":[]}
afterCleanup {"ready":false,"reason":"ECONNREFUSED"}
```

So on a live dev server: a Canvas approve lands against the stamped revision, editing the
component after approval makes the approval stale, a fixture-only data swap keeps the
approval but invalidates prior verification, and cleanup leaves no owned process behind.

## Status

Binding mechanics **VERIFIED** by tests and the slice. Multi-section behaviour on a real
product repo stays **PARTIAL** until Pilot A/B. `yarn.lock` is still stale relative to
`package.json` (pre-existing, unrelated to this phase).
