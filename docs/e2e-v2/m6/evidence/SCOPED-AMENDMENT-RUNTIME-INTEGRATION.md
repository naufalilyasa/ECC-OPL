# Scoped Amendment Record — Runtime Integration V2.0

## Authorization

Owner authorized source-level implementation and focused regression for the runtime integration,
not deployment and not P5. Guardian Angel, Git protection and active OpenCode HOME are untouched.

## Modified files (all E2E V2.0 scope)

| File | Before SHA-256 | After SHA-256 | Reason |
|---|---|---|---|
| `.opencode/commands/e2e.md` | `c562e0a2a2707c49362431b04ac1895f02c091e3d7ae193837ab6bf35b9d8436` | see manifest | Deterministic registry operations, internal mapper, migration hint |
| `.opencode/commands/e2e-map.md` | `76b3d4037a0144df2d40dc0eca01777690762a7cccc5d9562b0330333dfdb142` | see manifest | Compatibility wrapper pointing to internal mapper |
| `.opencode/scripts/e2e-registry.mjs` | new | see manifest | Actual product registry tool |
| `docs/e2e-v2/m6/resources/e2e-journey-mapper.md` | new | see manifest | Internal reusable mapper extracted from legacy command |
| `docs/e2e-v2/m6/tests/product-runtime.test.mjs` | new | see manifest | RT01–RT12 product-boundary regression |
| `docs/e2e-v2/m6/tests/acceptance-ledger.mjs` | `1dd92f7b9a8a84c33414f6f690970292649f21998e038be254dc9ad994821b6f` | see manifest | E06 contradiction + REFERENCE_VERIFIED evidence validation |
| `docs/e2e-v2/m5/tests/conformance.test.mjs`, `docs/e2e-v2/m6/tests/conformance.test.mjs`, `docs/e2e-v2/m6/scripts/emit-m6-reports.mjs` | prior | see manifest | Pin reconciliation to amended command hashes; owner config drift observational |
| M5 frozen-tree expected hash | `267c3b8bce980c97cadfc54b815fb79190d9a8f9f6951cb29ae92839dbf7b014` | source-only encoding recorded in `acceptance-ledger.mjs` | Deterministic source-only digest excluding generated reports/evidence |

Historical hashes are preserved above and in the prior review ZIPs; they are not rewritten to hide
this amendment. No M1–M4 source, PRD, plan, Guardian Angel, Git control or active config was modified.
