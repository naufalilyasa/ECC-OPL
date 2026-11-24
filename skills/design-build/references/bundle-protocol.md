# Bundle sealing & identity protocol (V2.0)

Upon a canvas verdict `{ "kind": "verdict", "verdict": "approve" }`, the exact
bytes the owner saw become an immutable input. No port may mutate them.

## Seal
1. Compute SHA-256 over: preview HTML, resolved CSS, contract, each asset.
2. Write `approvedBundleSha256` (and the per-file map) into `active.json`.
3. The receipt binds to this sha; a later mismatch invalidates approval.

## Verify (G0)
Recompute each digest from live disk and compare to `active.json`. Any drift or
missing file returns `BUNDLE_INVALIDATED` — never a synthetic PASS. The validator
lives in `tests/design-build-v2-invariants.test.js` (`verifyBundleSeal`).

## Invalidation
If feedback contradicts the frozen contract, amend the contract first, then
re-approve and re-seal. Approvals bound to the old sha are void.
