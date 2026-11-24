# M6 Evidence Correction

- `verifyStatusHonesty` now requires trustedRuns/trustedEvidenceHashes/trustedEvidenceRoot for every PASS, recomputes predicates, compares observed_run fields, exact `covered=false`, coverage credit, evidence bytes under canonical root containment, rejects circular self-hash and cross-scenario substitution. Declared `MATCH` is never authority.
- Placeholders removed: M611-C02 (digest contract), M611-F03 (protected-surface fingerprint), V611-11 (real suite spawn + TAP), N611-17 (real D04 verifier mutation), M611-D05 (exact digest equality), generic fallbacks → BLOCKED with reason.
- Single authoritative release decision (`scripts/release-decision.mjs`); simulations isolated in `evidence/simulated-gate-results.json` with `release_authority:false`.
- Portable inputs via `E2E_REPO_ROOT`, `E2E_MATRIX_ROOT`, `E2E_PRD_R1_ZIP`, `E2E_M6_R1_ZIP`, `E2E_R11_ZIP`, `E2E_SCRATCH_ROOT`, `E2E_ACTIVE_CONFIG`; safe archive extraction; `BLOCKED_BASELINE_MISSING` when absent.
- Packaging bug fixed in this cycle: baseline ZIP extracts into a named subdirectory; D04 verifier target resolution now uses the directory that contains `README.md`.
