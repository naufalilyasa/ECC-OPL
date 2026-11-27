# Phase 6 evidence — gates G0–G3 in native mode (DBN-11/12)

Date: 2026-11-27 · Plan: `docs/plans/framework-native-design-build.plan.md` (Phase 6)

## What changed

### `scripts/design-build-v2/rendered-authority.mjs`

- `PREVIEW_MODES = ['standalone-html', 'framework-native']`. An unknown mode is
  `PARITY_UNVERIFIED / PREVIEW_MODE_INVALID` — never silently downgraded to the legacy path.
- Native mode compares **the approved revision's own baseline capture** against the
  integrated capture. The baseline must be attributable to the approval: the evidence
  carries `referenceDesignDigest`, the context carries `approvedReference.designDigest`,
  and a mismatch returns `PARITY_UNVERIFIED / BASELINE_NOT_BOUND_TO_APPROVAL` instead of
  accepting any old screenshot.
- A missing baseline capture in native mode reports `BASELINE_CAPTURE_MISSING` (the legacy
  path keeps `SCREENSHOT_PAIR_INCOMPLETE`), so the failure names what is actually absent.
- No pixel comparison is performed in either mode — the authority checks evidence
  structure, per-profile digests, profile dimensions and typed measurement rows. Native
  same-source/different-context differences therefore surface as measurement rows and as
  `driftFindings` passed through on the result; they cannot masquerade as a pixel failure.
- The outcome now carries `mode` and `driftFindings`.

### `scripts/design-build-v2/section-gate.mjs`

`previewMode` is read from `req.active?.previewMode ?? 'standalone-html'` — authoritative
state, not the receipt or a caller flag — and forwarded into parity together with
`approvedReference.designDigest` and `evidence.referenceDesignDigest`. The hardcoded
screenshot-pair shape is now selected by mode.

### `scripts/design-build-v2/state-machine.mjs`

- `verifyReceipt` rejects an unknown `previewMode` on active state (`PREVIEW_MODE_INVALID`)
  and, in native mode, requires the approved design digest to be present
  (`NATIVE_REFERENCE_MISSING`) — a native completion cannot be claimed without it.
- `recomputeG2` passes mode and the approved design digest into the single parity authority,
  so the receipt-recomputed G2 and the command-reported G2 agree by construction.

### `scripts/lib/plan-canvas/sessions.js`

Preview meta also stores `designDigest` (valid 64-hex only), so the approval produced in
Phase 5 flows into the state the gate reads.

## Gate mapping

| Gate | Native behaviour |
|------|------------------|
| G0 | Unchanged predicate (section identity + real candidate bytes + a real Canvas verdict id). Preview-runtime readiness is proven implicitly: the candidate captures cannot exist without a live server, and Phase 4 owns the runtime. No extra flag is invented. |
| G1 | Unchanged predicate (approval bound to the bundle + contract checks observed). The native-specific binding — approval's design digest — is enforced at G2, where it is testable. |
| G2 | Baseline capture vs integrated capture per required profile, both PNG-validated, per-profile digests recomputed from bytes, profile dimensions enforced, typed measurement rows required. Baseline must match the approved design digest. |
| G3 | Unchanged: real interaction postconditions, `before !== after`, `observed === true`. |

A required gate that fails still blocks `SECTION_COMPLETE` through the existing
`gateNotVerified` / `verdictDisagreement` path; the native path adds no bypass.

## Verification

```
node tests/lib/design-build-native-state.test.js   → 30 passed, 0 failed
node tests/design-build-v2-hotfix.test.mjs         → 10 passed, 0 failed
node tests/design-build-v2-invariants.test.js      → 40 passed, 0 failed
```

New assertions: native G2 passes on baseline-vs-integrated captures of the approved
revision (`g2.mode === 'framework-native'`, `SECTION_COMPLETE`); a missing baseline capture
gives `BASELINE_CAPTURE_MISSING` and no completion; a baseline stamped with a different
design digest is `BASELINE_NOT_BOUND_TO_APPROVAL`; a fabricated digest claim in `g2` is
rejected against the real bytes and the gate exits non-zero; native mode without an approved
design digest is `NATIVE_REFERENCE_MISSING`; an unknown preview mode fails both the receipt
and G2; the legacy standalone-html pair path still completes unchanged.

## Known limits (honest status)

- Gate mechanics **VERIFIED** by tests. Rendered-integrity *quality* on real apps stays
  **PARTIAL** until Pilot A/B exercise it.
- The gate trusts `active.designDigest` as the approved revision's digest. It does not
  re-hash the reference file set from disk at gate time — that remains the approval-time
  check from Phase 5 (`verifyApprovalRevision`). If a section is edited *after* acceptance
  and before completion, the gate will not notice on its own.
- No pixel diffing exists in either mode, by design. Native drift is reported, not graded.
