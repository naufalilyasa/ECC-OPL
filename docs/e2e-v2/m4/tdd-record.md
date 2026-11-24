# M4 TDD Record — Runner & Evidence Hardening

Factual execution log. Every entry quotes the actual command and output excerpt.
No live/browser/ASM criterion is verified here. Frozen M1/M2/M3 trees stay byte-identical.

Plan: `docs/plans/e2e-v2-0-m4-runner-evidence.plan.md` r3,
SHA-256 `848f35c350c6f7c73bf4afd28d59352b314031ffe08315c852300ac141215b34` (verified on disk).
Review APPROVE r3 (`docs/plans/e2e-v2-0-m4-plan-review-r3.md`); owner APPROVED r3
(`docs/plans/e2e-v2-0-m4-plan-approval-r3.md`). Phase 4 prompt delta: PROPOSAL ONLY, NOT approved,
NOT applied.

## Checkpoint log

| Stage | Command | Result | Notes |
|-------|---------|--------|-------|
| RED | `TMPDIR=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode node --test docs/e2e-v2/m4/tests/m4.test.mjs` | EXIT 1 — `tests 39 / pass 0 / fail 39` | all failures are `Error: M4_NOT_IMPLEMENTED: <export>` from the export-stub `runner.mjs`/`emit-m4-reports.mjs`; the intended missing behavior, not a loader/setup error |
| RED (prompt) | `TMPDIR=... node --test docs/e2e-v2/m4/tests/conformance.test.mjs` | EXIT 1 | same stub reason for `classifyPrompt` / `detectInsertion` |
| GREEN | same target `node --test docs/e2e-v2/m4/tests/m4.test.mjs` | EXIT 0 — `tests 46 / pass 46 / fail 0 / skipped 0` | identical target command, RE-EXECUTED after the minimal implementation; no test skipped/renamed/deleted |
| GREEN (prompt) | `TMPDIR=... node --test docs/e2e-v2/m4/tests/conformance.test.mjs` | EXIT 0 — `tests 8 / pass 8 / fail 0` | honest MISSING_CONTRACT classification; no prompt edit |
| GREEN (strict probe) | `TMPDIR=... node --test docs/e2e-v2/m4/tests/prompt-conformance.strict.mjs` | EXIT 0 — `tests 4 / pass 4 / fail 0` | separate file; not in the `*.test.mjs` glob |
| REFACTOR | full M4 suite after simplification | EXIT 0 — `tests 54 / pass 54 / fail 0` | removed two redundant symlink-component loops (realpath already covers any component); added 8 branch tests; kept green |
| COVERAGE (runner) | `node --experimental-test-coverage ... --test-coverage-include=docs/e2e-v2/m4/tests/runner.mjs ... --test docs/e2e-v2/m4/tests/*.test.mjs` | EXIT 0 — `100.00% lines / 84.93% branches / 89.19% functions` | first measurement failed at 78.40% branches; see coverage.report.json |
| COVERAGE (emitter) | same command with `--test-coverage-include=docs/e2e-v2/m4/scripts/emit-m4-reports.mjs` | EXIT 0 — `100.00% lines / 94.74% branches / 83.33% functions` | measured separately; no pooling |
| REGRESSION (M3) | `TMPDIR=... node --test docs/e2e-v2/m3/tests/*.test.mjs` | EXIT 0 — `tests 30 / pass 30 / fail 0` | frozen tree unchanged |
| REGRESSION (M2) | `TMPDIR=... node --test docs/e2e-v2/m2/tests/*.test.mjs` | EXIT 0 — `tests 53 / pass 53 / fail 0` | frozen tree unchanged |
| EMITTER CLI | `TMPDIR=... node docs/e2e-v2/m4/scripts/emit-m4-reports.mjs` | EXIT 0 | 9 M4 reports written, all parsed as JSON |

### RED evidence detail

Exact command (exit `1`):

```
TMPDIR=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode \
  node --test docs/e2e-v2/m4/tests/m4.test.mjs
```

Result excerpt (verbatim):

```
✖ D02: approved non-production `run` dispatches exactly once (0.440167ms)
✖ D02: approved non-production `full` dispatches exactly once (0.048542ms)
...
ℹ tests 39
ℹ suites 0
ℹ pass 0
ℹ fail 39
ℹ skipped 0
ℹ duration_ms 61.748542

test at docs/e2e-v2/m4/tests/m4.test.mjs:70:1
✖ D02: approved non-production `run` dispatches exactly once
  Error: M4_NOT_IMPLEMENTED: evaluateEnvironmentGate
      at Module.<anonymous> (file:///Users/ctp-itdev2/ECC/docs/e2e-v2/m4/tests/runner.mjs:3:36)
      at TestContext.<anonymous> (file:///Users/ctp-itdev2/ECC/docs/e2e-v2/m4/tests/m4.test.mjs:72:15)
```

RED source digests (at the moment RED was recorded):

| File | SHA-256 |
|------|---------|
| `docs/e2e-v2/m4/tests/m4.test.mjs` | `6e1a804340d8c49407f6436e321971ed91cb0491bdecb0767fc08e311c64779b` |
| `docs/e2e-v2/m4/tests/conformance.test.mjs` | `9fd081e3f6e0ed645a37563be86fdbbf21333840fd03d1157e31af2eab68c1d5` |
| `docs/e2e-v2/m4/tests/prompt-conformance.strict.mjs` | `01c45b9cf39d6145de0d4727d40ea82c18fbbd69822cd179a8b393cc3c6c385d` |
| `docs/e2e-v2/m4/tests/fixtures.mjs` | `0944b0d33ae05659f938565ed2b715b90c1251da1ada3599e86593c4d070560e` |
| `docs/e2e-v2/m4/tests/runner.mjs` (stub) | `13314c16984135400e1f4735044a1d697964e50b584e3836c3a3cf513788304f` |
| `docs/e2e-v2/m4/scripts/emit-m4-reports.mjs` (stub) | `b891da5f411fd97b0ade347c515410cac0a5c87d79c1d2612fe13aacbbd07465` |

The target test file compiled and executed 39 assertions; failure is the missing
implementation the tests were written to demand. No production behavior existed before RED.

### GREEN evidence detail

Exact command (exit `0`):

```
TMPDIR=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode \
  node --test docs/e2e-v2/m4/tests/m4.test.mjs
```

Result excerpt (verbatim):

```
ℹ tests 46
ℹ suites 0
ℹ pass 46
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ duration_ms 69.983167
```

The same target that failed 39/39 at RED passes 46/46 at GREEN (8 additional
branch-focused cases were added during the RED→GREEN cycle; none skipped).

### REFACTOR evidence detail

Full glob after simplification (exit `0`):

```
TMPDIR=... node --test docs/e2e-v2/m4/tests/*.test.mjs
ℹ tests 54 / pass 54 / fail 0 / skipped 0
```

Removed the redundant `lstatSync` symlink-component loops from `checkSpec` and
`checkArtifacts`: `realpathSync(full)` already resolves a symlink at any path
component, so an escaping component is caught by the containment check. No
behavior was weakened; the C04 symlink-escape and C10 artifact-escape tests
still fail closed.

### Coverage evidence detail

First `runner.mjs` measurement (exit `1`):

```
ℹ Error: 78.40% branch coverage does not meet threshold of 80%.
ℹ     runner.mjs |  95.74 |    78.40 |   89.19 | ...
```

Threshold was NOT weakened. Added branch cases (unapproved operation, wildcard
non-high-risk/high-risk, bypass dependency short-circuit, tampered allowlist,
missing assertion summary, non-regular artifact, uninspectable redaction sample,
non-integer prior count) and simplified the redundant loops. Final:

```
runner.mjs           | 100.00 | 84.93 | 89.19 |   EXIT 0
emit-m4-reports.mjs  | 100.00 | 94.74 | 83.33 |   EXIT 0
```

### Regression evidence detail

```
M3: ℹ tests 30 / pass 30 / fail 0   EXIT 0
M2: ℹ tests 53 / pass 53 / fail 0   EXIT 0
```

M1 suite intentionally NOT executed (external ZIP, active-HOME reads and
external process spawns are out of scope). M1 artifacts were re-hashed instead:
tree and workflow-file hashes identical; the pre-existing M1-01/M1-11
`AUTHORIZED_DELTA` from M3 remains historical evidence, not a new pass or a fix.

### Final source digests

| File | SHA-256 |
|------|---------|
| `docs/e2e-v2/m4/tests/runner.mjs` | `36a5b37f9ccdc19ec2672aa7ca851fd2229c1ef3438adc1258c9c4c1f2bca2d1` |
| `docs/e2e-v2/m4/tests/m4.test.mjs` | `213d9ff289bfa1f3013f6b5f11749480fb002f1244aecd553443ee380dcb1169` |
| `docs/e2e-v2/m4/tests/fixtures.mjs` | `0944b0d33ae05659f938565ed2b715b90c1251da1ada3599e86593c4d070560e` |
| `docs/e2e-v2/m4/tests/conformance.test.mjs` | `3c63f262a5101b2331d5bf6aceea395ac8a9e25d3b2b9e97ef6bd58cdf580eba` |
| `docs/e2e-v2/m4/tests/prompt-conformance.strict.mjs` | `01c45b9cf39d6145de0d4727d40ea82c18fbbd69822cd179a8b393cc3c6c385d` |
| `docs/e2e-v2/m4/scripts/emit-m4-reports.mjs` | `f87bc8e863230c71ea7cfe8e6ccb725f5f1ef3027ae96bf2a862450bb9e2599d` |
