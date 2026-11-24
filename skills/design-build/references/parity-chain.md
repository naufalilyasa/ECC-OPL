# Ordered parity gate chain (V2.0)

Replaces three conflicting finish verdicts with one ordered chain, all bound to
the same `approvedBundleSha256`.

| Gate | Name | Pass criteria |
|---|---|---|
| G0 | Reference Preflight | exact disk-hash match to `active.json` |
| G1 | Contract Compliance | 100% tokens resolved; zero undeclared values |
| G2 | Rendered Fidelity | all landmarks within tolerance; zero hidden elements |
| G3 | State & Interaction | 0 console errors, 0 hydration mismatches |
| G4 | Assembled Quality | literal PASS from assembled check; rhythm verified |
| G5 | Harden Recheck (opt-in) | G0–G3 unchanged after hardening |

## Evidence receipt
`docs/design/evidence/<pageId>/<sectionId>-receipt.json` schemaVersion 2: binds
bundle sha, candidate hashes, capture profile (390×844, DPR=1, dark), ordered
gate results, measurement rows, screenshots, and `overallVerdict`. A receipt that
says PASS while any gate or measurement is FAIL is `INVALID_RECEIPT`.

## Bounded repair
Max 2 fix-and-recheck cycles per approval; a 3rd consecutive failure halts with
`REPAIR_LIMIT_EXCEEDED`. Repair the implementation, never the approved canvas —
the canvas SHA must remain byte-identical. `verifyParity` + `verifyRepairLimit`
in `tests/design-build-v2-invariants.test.js` enforce this.
