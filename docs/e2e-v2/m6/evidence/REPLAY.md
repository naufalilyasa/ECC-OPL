# Replay

Node v24.21.0. No dependency install. Set `TMPDIR` to the scratch PARENT (so `tmpdir()/opencode` resolves correctly), and set baseline env inputs:
`E2E_PRD_R1_ZIP`, `E2E_M6_R1_ZIP`, `E2E_R11_ZIP` (exact paths to the three baseline ZIPs), optionally `E2E_MATRIX_ROOT`, `E2E_SCRATCH_ROOT`, `E2E_ACTIVE_CONFIG`.

Commands:
```sh
node --test docs/e2e-v2/m5/tests/m5.test.mjs docs/e2e-v2/m5/tests/safety-remediation.test.mjs   docs/e2e-v2/m6/tests/m6.test.mjs docs/e2e-v2/m6/tests/conformance.test.mjs   docs/e2e-v2/m6/tests/r1-correctness.test.mjs docs/e2e-v2/m6/tests/r1-1-correctness.test.mjs   docs/e2e-v2/m6/tests/m6-corrections.test.mjs
# 117 pass / 0 fail
node docs/e2e-v2/m6/scripts/emit-m6-reports.mjs
node docs/e2e-v2/m6/scripts/emit-r11-evidence.mjs
```
Missing baseline inputs produce `BLOCKED_BASELINE_MISSING`, never PASS. Playwright 1.65.1 scratch-only where previously used.
