# RED evidence — E2E-V2-M5-SAFETY-REMEDIATION-01

Owner-authorized narrow amendment to M5 reference helpers only.

- Change request: `E2E-V2-M5-SAFETY-REMEDIATION-01`
- Owner basis: owner-authorized narrow amendment for S01/S02 in `docs/e2e-v2/m5/tests/migration.mjs`; write scope limited to `docs/e2e-v2/m5/**`.
- Node: `v24.21.0`
- Source under test (unmodified baseline): `docs/e2e-v2/m5/tests/migration.mjs`
  SHA-256 `146c8cfd51e8f01679d08784077c0bd7e565747efa508ce392417e94de781f11`
- New test file: `docs/e2e-v2/m5/tests/safety-remediation.test.mjs`
  SHA-256 `e45d2043123fc7e228490c66f2ac56e765deac538cb49f3603dd3c338cae6e35`
- Canonical State source (read-only): `docs/e2e-v2/m3/tests/registry.mjs` `validateState()` / `STATE_ENUM`.

## Command

```sh
TMPDIR=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode \
  node --test docs/e2e-v2/m5/tests/m5.test.mjs \
           docs/e2e-v2/m5/tests/safety-remediation.test.mjs
```

- Exit: `1`
- TAP: `tests 47 / pass 30 / fail 17 / skipped 0 / todo 0`
- Raw log: `evidence/safety-remediation-RED.log`

## Failing assertions (exact defect)

S01 — invalid registry State accepted (7 failures), each:
`AssertionError: invalid State must be rejected` — `actual: true, expected: false`
at `safety-remediation.test.mjs:81` for `stale`, `blocked`, `failed`, `COVERED`, `''`,
`'covered\nin progress'`, and `{value:'covered'}`. The baseline helper applies the
whole diff (including the permitted `Evidence` field) despite the invalid State.

S02 — unsafe destination accepted / dishonest preflight (10 failures):
- `outside symlink ancestor + nonexistent child: destination must be rejected` — `actual: true`
  at `safety-remediation.test.mjs:107` (the `realOr()` lexical fallback accepted a child below an outside-pointing symlink).
- `outside symlink ancestor + multiple absent children: destination must be rejected` — `actual: true` at `:122`.
- `in-root symlink leaf: destination must be rejected` — `actual: true` at `:147`.
- `broken symlink ancestor: destination must be rejected` — `actual: true` at `:157`.
- `a regular file used as an ancestor directory: destination must be rejected` — `actual: true` at `:179` (ENOTDIR fell through to the lexical fallback).
- `NUL byte: destination must be rejected` — `actual: true` at `:184`.
- `symlink repoRoot: destination must be rejected` — `actual: true` at `:196`.
- `preflight must not claim race safety` — `actual: undefined, expected: false` at `:27`
  (baseline emits neither `race_safe:false` nor `TOCTOU_NOT_FULLY_PROVEN`), affecting
  the outside-symlink-leaf, chained-symlink and contained-destination cases.

No production/helper code was changed before this RED was captured.
PRODUCT_BOUNDARY_CLASS=REFERENCE_ONLY (M5 helper; not imported by the `/e2e` command).
