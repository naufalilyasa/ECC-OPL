# Phase 6 evidence — gates G0–G3 in native mode (DBN-11/12)

Date: 2026-11-27 · Plan: `docs/plans/framework-native-design-build.plan.md` (Phase 6)

## What changed

### `scripts/design-build-v2/rendered-authority.mjs`

- `PREVIEW_MODES = ['standalone-html', 'framework-native']`. An unknown mode is
  `PARITY_UNVERIFIED / PREVIEW_MODE_INVALID` — never silently downgraded to the legacy path.
- Native mode compares **the approved revision's own baseline capture** against the
  integrated capture. The baseline must be attributable to the approval: the evidence
  carries `referenceDesignDigest` (from the capture step), the context carries
  `approvedReference.designDigest` (from active state), and a mismatch returns
  `PARITY_UNVERIFIED / BASELINE_NOT_BOUND_TO_APPROVAL` instead of accepting any old
  screenshot. **The two digests come from different inputs on purpose** — a gate that fed
  both from one field would compare a value with itself and accept anything.
- A missing baseline capture in native mode reports `BASELINE_CAPTURE_MISSING` (the legacy
  path keeps `SCREENSHOT_PAIR_INCOMPLETE`), so the failure names what is actually absent.
- No pixel *grading* is performed in either mode — the authority checks evidence structure,
  per-profile digests, profile dimensions and typed measurement rows. It does **detect**
  native drift: when the baseline and integrated captures hash differently it emits
  `{ viewport, kind: 'PIXEL_DRIFT', referenceSha256, candidateSha256 }` into `driftFindings`,
  so the finding no longer depends on the caller remembering to supply it. Duplicate
  rows the capture step also reports are collapsed on `viewport:kind`, so one diff is
  reported once.
- The outcome now carries `mode` and `driftFindings`.

### `scripts/design-build-v2/section-gate.mjs`

`previewMode` is read from the active-state block of the request
(`req.active?.previewMode ?? 'standalone-html'`) — authoritative state, not the receipt — and
forwarded into parity together with `approvedReference.designDigest` and
`evidence.referenceDesignDigest` (the latter from `req.baselineDesignDigest`). The hardcoded
screenshot-pair shape is now selected by mode. The outcome reports `previewMode` and
`previewModeDefaulted`. An absent mode is no longer a silent permissive default: a
native-shaped request (a 64-hex `active.designDigest`, or a `baselineDesignDigest`) with no
`active.previewMode` is stopped with `PREVIEW_MODE_LOST` and exit 2, because running it under
the legacy contract would complete a native section against a cheaper gate.

### `scripts/design-build-v2/state-machine.mjs`

- `verifyReceipt` rejects an unknown `previewMode` (`PREVIEW_MODE_INVALID`) and, in native
  mode, requires **three independent records to agree**:
  1. `active.designDigest` exists (`NATIVE_REFERENCE_MISSING`);
  2. the Canvas approval event carries a digest (`APPROVAL_BINDING_INCOMPLETE`) that equals
     the active one (`APPROVAL_STATE_CONFLICT`);
  3. the reference set is supplied (`NATIVE_REFERENCE_SET_MISSING`) and re-fingerprinted now,
     so a source edit after acceptance is `STALE_REVISION`. `VERIFICATION_REQUIRED` is
     allowed through — this gate run is the rerun.
- `recomputeG2` passes mode, the active design digest and `context.baselineDesignDigest`
  into the single parity authority, so the receipt-recomputed G2 and the command-reported G2
  agree by construction while the compared values stay independent.
- `advanceCheckpoint` records `completionScope` (`OK` / `FIXTURE_ONLY`) on the completion
  record and refuses an explicit `completionClaim: 'production'` for a fixture section.

### `scripts/lib/plan-canvas/sessions.js`

Preview meta also stores `designDigest` (valid 64-hex only), so the approval produced in
Phase 5 flows into the state the gate reads.

## Gate mapping

| Gate | Native behaviour |
|------|------------------|
| G0 | Unchanged predicate (section identity + real candidate bytes + a real Canvas verdict id). Preview-runtime readiness is proven implicitly: the candidate captures cannot exist without a live server, and Phase 4 owns the runtime. No extra flag is invented. |
| G1 | Unchanged predicate (approval bound to the bundle + contract checks observed). The native-specific binding — approval's design digest — is enforced at G2, where it is testable. |
| G2 | Baseline capture vs integrated capture per required profile, both PNG-validated, per-profile digests recomputed from bytes, profile dimensions enforced, typed measurement rows required. The baseline's claimed digest (from the capture step) must equal the digest in active state and in the Canvas approval event. |
| G3 | Unchanged: real interaction postconditions, `before !== after`, `observed === true`. |

A required gate that fails still blocks `SECTION_COMPLETE` through the existing
`gateNotVerified` / `verdictDisagreement` path; the native path adds no bypass. Completion
also records `completionScope`, so a fixture-backed section carries `FIXTURE_ONLY` on its
own record.

## Verification

```
node tests/lib/design-build-native-state.test.js        → 40 passed, 0 failed
node tests/design-build-v2-hotfix.test.mjs              → 10 passed, 0 failed
node tests/design-build-v2-invariants.test.js           → 40 passed, 0 failed
node tests/lib/design-build-preview-runtime.test.js     → 12 passed, 0 failed
node tests/lib/plan-canvas-preview-mode.test.js         → 12 passed, 0 failed
node tests/lib/plan-canvas-sessions.test.js             → 16 passed, 0 failed
node tests/lib/plan-canvas-antigravity.test.js          → 13 passed, 0 failed
node tests/lib/design-build-direction-a11y.test.js      → 10 passed, 0 failed
```

New assertions: native G2 passes on baseline-vs-integrated captures of the approved
revision (`g2.mode === 'framework-native'`, `SECTION_COMPLETE`); a missing baseline capture
gives `BASELINE_CAPTURE_MISSING` and no completion; a baseline stamped with a different
design digest is `BASELINE_NOT_BOUND_TO_APPROVAL` **through the pipeline**, not only in a
direct API call; a fabricated digest claim in `g2` is rejected against the real bytes and the
gate exits non-zero; a visual change after acceptance is `STALE_REVISION` while a fixture
swap passes (this gate run is the rerun); active state disagreeing with the Canvas approval
is `APPROVAL_STATE_CONFLICT`; a missing reference set is `NATIVE_REFERENCE_SET_MISSING`;
differing native captures produce a `PIXEL_DRIFT` finding; two digests for one path are
`FINGERPRINT_CONFLICT`; a fixture section claiming production completion is `FIXTURE_ONLY`;
an unknown preview mode fails both the receipt and G2; a native-shaped section that lost its
`previewMode` is stopped with `PREVIEW_MODE_LOST` instead of falling back to the legacy gate;
a drift row reported by both the authority and the capture step is collapsed to one; every
digest in the distribution manifest is re-hashed against disk; the legacy standalone-html pair
path still completes unchanged.

## Known limits (honest status)

- Gate mechanics **VERIFIED** by tests. Rendered-integrity *quality* on real apps stays
  **PARTIAL** until Pilot A/B exercise it.
- The gate re-fingerprints the reference set it is **given**; it does not read project files
  from disk. A caller that supplies a reference set matching a forged approval would still
  pass. The trust anchor is the Canvas verdict event: its `designDigest` must equal active
  state *and* be the digest the reference set reproduces now, so a post-acceptance edit is
  caught (`STALE_REVISION`). Disk-level re-hashing remains a caller duty.
- No pixel *grading* exists in either mode, by design. Native drift is detected and reported,
  never scored.
