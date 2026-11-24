# M5 Safety Remediation (S01 / S02)

- Source: `docs/e2e-v2/m5/tests/migration.mjs`, before `146c8cfd51e8f01679d08784077c0bd7e565747efa508ce392417e94de781f11`, after `b5bb301655b713e484e449cb2e2549794b56a8307d0fec727a1ca96ac26cff80`.
- S01: `applyFieldScopedUpdate` now validates every supplied field with M3 canonical `validateState()`; invalid `State` (`stale`, `blocked`, `failed`, wrong type/multiline) → `applied:false`, `registry_writes:0`, unchanged text/hash, `INVALID_REGISTRY_STATE`.
- S02: `checkRegistryPathSafety` now canonicalizes the root, walks existing ancestors with `lstatSync`/`realpathSync`, rejects symlink ancestors/targets, broken links, file ancestors, NUL and traversal; all results carry `race_safe:false` / `TOCTOU_NOT_FULLY_PROVEN`. No TOCTOU_SAFE claim.
- Trace: `boundary-call-chain-final.json` → `PRODUCT_BOUNDARY_CLASS=REFERENCE_ONLY`; `migration.mjs` is imported only by M5/M6 harnesses, not by `/e2e` prompt command. No deterministic production registry writer found in inspected source.
- Therefore: reference helper fixed, actual product writer remains `NOT_VERIFIED`. P3 stays BLOCKED.
