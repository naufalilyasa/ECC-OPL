# Residuals & Gates

All items below remain open and are enumerated in the decision packet:

- P1: prove effective command winner (ASM-01) in an isolated probe
- P3: productBoundary.status=FAIL
- P5: obtain explicit owner deployment AUTHORIZATION for exact scope
- A08: execute authorized live multi-phase orchestration smoke (currently NOT_RUN)
- AUTHORIZATION: explicit P5 scope, candidate digest, targets and operations approval missing
- PRODUCT_BOUNDARY_CLASS=REFERENCE_ONLY: helper fix is not a product writer fix
- PRODUCT-FINDING: S01/S02 M5 reference helpers remediated; no verifiable actual /e2e registry writer
- PRODUCT-FINDING: No deterministic production registry writer found in inspected source
- BLOCKING-LIMITATION: No deterministic production registry writer was found in the inspected source; prompt assurances are not a strong write-safety boundary. Remediation of M5 reference helpers cannot be advertised as product remediation.
- BLOCKING-LIMITATION: TOCTOU_NOT_FULLY_PROVEN

Additional:
- `TOCTOU_NOT_FULLY_PROVEN` — no race-safe write proof for any real writer.
- 2 pre-existing M5 conformance failures from owner active-HOME `opencode.jsonc` hash drift (out of scope, not product regressions).
- M5 amendment recorded without erasing historical M5 digest `267c3b8b…`.
