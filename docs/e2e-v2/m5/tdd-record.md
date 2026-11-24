# M5 TDD Record — Migration & Rollback (AC-015..AC-018)

Strict RED → GREEN → REFACTOR evidence for plan r3
(`docs/plans/e2e-v2-0-m5-migration-rollback.plan.md`,
SHA-256 `747a1c2a25ee52612cd002739d36f0cd882cb10bd2f580243fe7268170f94b59`,
review verdict APPROVE / owner APPROVED). All commands run from repo root
`/Users/ctp-itdev2/ECC`; Node `v24.21.0`; `TMPDIR` pinned to the disposable
SCRATCH root. Prior-milestone and contract trees verified byte-identical in
Phase 0 (see `reports/m5-preflight.report.json`).

## Checkpoint log

| Stage | Command | Exit | Result excerpt | Source SHA-256 |
|-------|---------|------|----------------|----------------|
| RED | `TMPDIR=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode node --test docs/e2e-v2/m5/tests/m5.test.mjs` | 1 | `ERR_MODULE_NOT_FOUND: Cannot find module '.../m5/tests/migration.mjs' imported from '.../m5/tests/m5.test.mjs'`; `ℹ tests 1 / pass 0 / fail 1` | test `320b44a8…`, fixtures `4c76fc15…` |

### RED detail

- Failing target compiles/loads the test file; the failure is the intended
  missing-implementation signal: `migration.mjs` does not exist yet.
- TAP: `ℹ tests 1`, `ℹ pass 0`, `ℹ fail 1`, duration ~35 ms.
- No production code was written before this RED was captured.
- Absence preconditions held: `TESTS.md` and `.governance/docs-map.json` absent;
  all five frozen trees matched their pinned hashes.

## GREEN

| Stage | Command | Exit | Result excerpt | Implementation digest |
|-------|---------|------|----------------|----------------------|
| GREEN | `TMPDIR=/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/opencode node --test docs/e2e-v2/m5/tests/m5.test.mjs` | 0 | `ℹ tests 26 / pass 26 / fail 0 / cancelled 0 / skipped 0 / todo 0` | `migration.mjs` + `emit-m5-reports.mjs` |

- Same target command rerun after minimal implementation; all six test groups
  (AC-015..AC-018, Mutations 13/14, Gate P4, DEC-10, emitter contract) pass.
- `migration.mjs` SHA-256: see final deliverable table (Phase 0/4 digests).
- No production code changed after GREEN except optional REFACTOR below (kept green).

## REFACTOR

No refactor required — implementation is minimal and mirrors M3 (`registry.mjs`)
and M4 (`runner.mjs`) patterns without editing those frozen files. GREEN retained.

## Coverage (measured — module-level only, no project-wide claim)

Commands (Node v24.21.0, both exit 0):

```
TMPDIR=… node --experimental-test-coverage --test-coverage-include=docs/e2e-v2/m5/tests/migration.mjs --test-coverage-lines=80 --test-coverage-branches=80 --test-coverage-functions=80 --test docs/e2e-v2/m5/tests/m5.test.mjs
TMPDIR=… node --experimental-test-coverage --test-coverage-include=docs/e2e-v2/m5/scripts/emit-m5-reports.mjs --test-coverage-lines=80 --test-coverage-branches=80 --test-coverage-functions=80 --test docs/e2e-v2/m5/tests/m5.test.mjs
```

| Module | Lines % | Branches % | Functions % | Exit | Evidence |
|---|---|---|---|---|---|
| `tests/migration.mjs` | 100.00 | 81.42 | 100.00 | 0 | `all files \| 100.00 \| 81.42 \| 100.00` |
| `scripts/emit-m5-reports.mjs` | 99.24 | 87.10 | 100.00 | 0 | `all files \| 99.24 \| 87.10 \| 100.00` |

Both meet the ≥80% threshold on all three dimensions. Full result:
`reports/coverage.report.json`. Project-wide coverage: `NOT_MEASURED` (no
project coverage tool configured for these standalone reference modules).

## Verification summary

- `m5.test.mjs`: 27/27 pass · `conformance.test.mjs`: 4/4 pass.
- Regression: M4 54/54, M3 30/30, M2 53/53 pass; M1 via frozen tree hash.
- Reports: 16 total (13 emitter + prompt-conformance + coverage + scope-check).
- Post-GREEN fix: emitter tree-hash encoding changed to repo-relative paths
  (preflight report was hashing absolute paths). Re-ran same test target (27/27)
  and both coverage commands — still green. No frozen file touched.

## Created-file digests (SHA-256)

| Path | SHA-256 |
|---|---|
| `tests/fixtures.mjs` | `4c76fc159f3dfc0eb4b9967be307d61a23faf9907d0d9fa1fee50acd9b355ff7` |
| `tests/migration.mjs` | `146c8cfd51e8f01679d08784077c0bd7e565747efa508ce392417e94de781f11` |
| `tests/m5.test.mjs` | `3e253c4c84bdc63a071ad98fd64f6bd15bd76d350822ec7af07eaaba875db9b4` |
| `tests/conformance.test.mjs` | `99ad26752db9363775ef80aebb09d4f3238c88dbea6f0291f12fbdd7960f4096` |
| `scripts/emit-m5-reports.mjs` | `33502f5b5cdc497b661d46e66871d8e6efbda9bd45e65e8b2c6eab092cd15d2b` |
| `traceability-m5.md` | `0b8b9f6745537581ac84d5a8bee882a0cdfb37e925e4af1f464c676d08e2bae2` |
| `reports/m5-preflight.report.json` | `570bcc28a9220a6f48fc1ef905125fc00651f9c57df69e9b06057802b6b8540b` |
| `reports/registry-block.diff.json` | `cf6d099f34f41fafad3233cba4b1cd09d8fc7407df2401c059e37b854afb9165` |
| `reports/concurrency.report.json` | `0af13a92b2747d5abf3810c3d661563ba17ee9187f98399a6c9001a0c9057237` |
| `reports/registry-path.reject.json` | `ae5c9c035c6a8c4a261a7567ce793ce3bf22c7960aa2543638672b2b58d39e34` |
| `reports/symlink-escape.reject.json` | `bca0af13dc84b555ff66e7a4b2b3ada0e208d878ec8ea00127483126e447a3bb` |
| `reports/parity.report.json` | `6c41e4c0ccaff302b25435fa40ff6e64a9f0bb0ef44d7a8ccba65974299f658c` |
| `reports/alias-no-run.trace.json` | `8226e246b00c03013980df238870b09c1e912c649c340b38e8ce7f242ae28d9b` |
| `reports/discovery-after-disable.report.json` | `e6eb662bf7d5b8770cec9e5c5c64719feef99dae52ec5aee7239e9ae110c7830` |
| `reports/restore-rehearsal.report.json` | `606da1862be28e7fdc5a446dffa78500eaa7354d80a80976acb063654a38fce6` |
| `reports/terminal-outcomes.report.json` | `c90302b7009e9edbb01dcef1e35900a7162931d9e495a8de23d421deba1ffa98` |
| `reports/flakiness.report.json` | `9a520537fb57f8c3c0c4bfcbaa50d70525b3af2a335c88a6ba4013554149944b` |
| `reports/mutation-suite.report.json` | `7b58a39de75549b19e90b1345c35ec474f7375f0197d21af446dbca1ab61d5b1` |
| `reports/m5-decision-packet.json` | `f2b88325f41e6e3ce44d3e4f764a1a46681328d04d359851a02ea17b2a92ad5f` |
| `reports/prompt-conformance.report.json` | `1f075b093df2620e2144f249d0071b06514f1b97726c796b69125206db7242eb` |
| `reports/coverage.report.json` | `97482bdd1ad33e83a3d9c957e3b043fb5aed99b2b9657b5c80315f6dd93d2fe3` |
| `reports/scope-check.report.json` | `7b0f4d8e20999f0c310fd4e1f7a6c5b4f16e1481d04deafbb3f4e7a7359eb6ee` |
| `tdd-record.md` | (this file — digest taken at delivery) |

AUTHORIZED_DELTA: none.

---

# Amendment — E2E-V2-M5-SAFETY-REMEDIATION-01 (S01 / S02)

New section. The historical record above is unchanged. This amendment is a
narrow, owner-authorized patch to the **M5 reference helpers only**.

- Change request: `E2E-V2-M5-SAFETY-REMEDIATION-01`
- Owner basis: owner-authorized narrow amendment for defects S01 (invalid
  registry `State` accepted) and S02 (unsafe registry destination / symlink
  ancestor escape) in `docs/e2e-v2/m5/tests/migration.mjs`. Write scope limited
  to `docs/e2e-v2/m5/**`. Brief §7 ( WP1 ) used as contract. No M6, PRD, plan,
  command, active HOME, registry, Guardian, Git, install or active.json change.
- Canonical State source (read-only, reused by import): M3
  `docs/e2e-v2/m3/tests/registry.mjs` → `validateState()` / `STATE_ENUM`.
  The M3 file was NOT edited and no second enum was created. Relative import
  from `m5/tests/migration.mjs` is `../../m3/tests/registry.mjs`.
- Node: `v24.21.0`; `TMPDIR` pinned to the approved disposable SCRATCH root.

## Before / after source identity

| Artifact | SHA-256 |
|---|---|
| `tests/migration.mjs` BEFORE (historical baseline) | `146c8cfd51e8f01679d08784077c0bd7e565747efa508ce392417e94de781f11` |
| `tests/migration.mjs` AFTER (this amendment) | `b5bb301655b713e484e449cb2e2549794b56a8307d0fec727a1ca96ac26cff80` |
| `tests/safety-remediation.test.mjs` (new, unchanged since RED) | `e45d2043123fc7e228490c66f2ac56e765deac538cb49f3603dd3c338cae6e35` |

## Amendment checkpoint log

| Stage | Command | Exit | Result excerpt | Evidence |
|---|---|---|---|---|
| RED | `TMPDIR=… node --test docs/e2e-v2/m5/tests/m5.test.mjs docs/e2e-v2/m5/tests/safety-remediation.test.mjs` | 1 | `tests 47 / pass 30 / fail 17`; `invalid State must be rejected` (`true !== false`) ×7; `destination must be rejected` / `preflight must not claim race safety` ×10 | `evidence/safety-remediation-RED.log`, `evidence/safety-remediation-RED.md` |
| GREEN | same target command rerun | 0 | `tests 47 / pass 47 / fail 0 / skipped 0 / todo 0` | `evidence/safety-remediation-GREEN.log` |
| FULL M5 | `TMPDIR=… node --test docs/e2e-v2/m5/tests/*.mjs` (explicit files) | 1 | `tests 53 / pass 51 / fail 2` — both failures are **pre-existing** `CONF-M5-2/CONF-M5-3` active-HOME config pin drift (see below); all 47 amended-target tests pass | `evidence/safety-remediation-FULL-SUITE.log` |
| COVERAGE | `node --experimental-test-coverage … --test-coverage-lines=80 --test-coverage-branches=80 --test-coverage-functions=80 --test …` | 0 | `migration.mjs`: lines 98.99 / branches 82.88 / functions 100.00 | `evidence/safety-remediation-COVERAGE.log` |

## RED detail

The new test file was written first and run against the unmodified baseline
(`migration.mjs` SHA `146c8cfd…`). It failed on the intended assertions:
`stale`, `blocked`, `failed`, `COVERED`, empty, multiline and object States were
all applied (S01), and the outside-symlink/nonexistent-child, in-root symlink,
broken symlink, file ancestor, NUL path and symlink-root cases were accepted
(S02). No helper code was changed before this RED was captured.

## GREEN / implementation summary

- S01: `applyFieldScopedUpdate()` now calls M3 `validateState()` on every
  supplied `State` **before** any line splice. Invalid State returns
  `{applied:false, registry_writes:0, nextText===registryText,
  hashAfter===hashBefore, code:'INVALID_REGISTRY_STATE'}` — the whole update is
  rejected atomically, including otherwise-permitted fields. Valid states
  remain subject to the existing field whitelist and all prior rules; no
  renumbering, new IDs or unrelated block changes.
- S02: `checkRegistryPathSafety()` now validates the root (existing, real,
  non-symlink directory, canonicalized once), rejects empty/absolute/traversal/
  NUL/unsupported path forms, and inspects every **existing** path component
  via `lstatSync`/`realpathSync` with component-aware containment. Nonexistent
  children no longer excuse a symlinked/file ancestor. Rejections carry
  `SYMLINK_ESCAPE`, `BROKEN_SYMLINK`, `PATH_REJECTED` or `UNSUPPORTED_PATH`;
  non-ENOENT errors fail closed. Every result now carries `race_safe:false`
  and `race_limitation:'TOCTOU_NOT_FULLY_PROVEN'`. No `TOCTOU_SAFE` claim.
- REFACTOR: none required; the patch is the smallest change that satisfies both
  defects and GREEN was retained.

## Full-suite caveat (not caused by this amendment)

`conformance.test.mjs` fails 2/4 with and without this patch: it pins active
HOME `~/.config/opencode/opencode.jsonc` to
`85378ac09a398760fccae61499ab3bd5207713d3ba214b71c92e5acf52071dbf`, but the
current read-only hash is `b194d4b4343e7d20fdb82ba6f12387bd739e553bbf7f4cfb4501d67d3c49f719`.
That file is outside the authorized write scope and was NOT touched. It imports
no `migration.mjs`; this is pre-existing environment drift, not a regression.

## Product-boundary honesty note

This is a **REFERENCE helper patch only**. `docs/e2e-v2/m5/tests/migration.mjs`
is not imported by the prompt-driven `/e2e` command; only the M5 and M6 harness
layers reference it. `PRODUCT_BOUNDARY_CLASS=REFERENCE_ONLY`. Passing these
tests does **not** prove the actual `/e2e` command's runtime registry writer is
safe, does not close P3, and does not authorize disable-default. TOCTOU remains
`TOCTOU_NOT_FULLY_PROVEN`: this is a read-only preflight, not a race-safe write
guarantee; a real writer must re-validate containment, identity/hash/approval
and final bytes at the mutation point.

AUTHORIZED_DELTA (amendment): `docs/e2e-v2/m5/tests/migration.mjs`,
`docs/e2e-v2/m5/tests/safety-remediation.test.mjs`,
`docs/e2e-v2/m5/tdd-record.md`, `docs/e2e-v2/m5/evidence/*` only.
