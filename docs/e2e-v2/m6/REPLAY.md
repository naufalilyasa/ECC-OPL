# M6 fail-closed corrections — replay

Node `v24.21.0`; Playwright `1.65.1` (scratch Chromium 1255). No install, no
HOME mutation, no Git/Guardian/active.json access. All paths are validated env
inputs; missing baselines yield `BLOCKED_*` rather than a guessed substitute.

## Required inputs

| Env | Purpose |
|-----|---------|
| `E2E_REPO_ROOT` | authoritative checkout (default: repo root derived from this file) |
| `E2E_SCRATCH_ROOT` | disposable scratch root (default: `TMPDIR/opencode`) |
| `E2E_MATRIX_ROOT` | extracted PRD-R1 bundle containing `ACCEPTANCE-MATRIX.csv` |
| `E2E_M6_R1_ROOT` / `E2E_M6_R1_ZIP` | approved M6-R1 baseline (digest `230af77b…`) |
| `E2E_R11_ROOT` / `E2E_R11_ZIP` | approved R1.1 baseline (digest `afe54431…`) |
| `E2E_EVIDENCE_ROOT` | M6 evidence output (default: `m6/evidence`) |
| `E2E_ACTIVE_CONFIG` | read-only active config observation (never a gate) |

## Commands (from `E2E_REPO_ROOT`)

```sh
node docs/e2e-v2/m6/scripts/emit-m6-reports.mjs
node docs/e2e-v2/m6/scripts/emit-r11-evidence.mjs
node docs/e2e-v2/m6/scripts/emit-r1-evidence.mjs
node --test \
  docs/e2e-v2/m6/tests/m6.test.mjs \
  docs/e2e-v2/m6/tests/conformance.test.mjs \
  docs/e2e-v2/m6/tests/r1-correctness.test.mjs \
  docs/e2e-v2/m6/tests/r1-1-correctness.test.mjs \
  docs/e2e-v2/m6/tests/m6-corrections.test.mjs
```

Expected: emitters exit 0 (R1.1 evidence 72/72 PASS, R1 evidence 68/68 PASS);
full suite exit 0 with 70/70 tests, zero skipped. Focused RED/GREEN logs are in
`evidence/red-green/`.

`m6-decision-packet.json` is derived from the single canonical ACTUAL decision
in `scripts/release-decision.mjs`: `PRODUCT_BOUNDARY_CLASS=REFERENCE_ONLY`,
`P3=BLOCKED`, `A08=NOT_RUN`, `gate_status=BLOCKED_DEPLOYMENT_GATED`. Simulated
gate veto probes are isolated in `evidence/simulated-gate-results.json` and are
never release authority.
