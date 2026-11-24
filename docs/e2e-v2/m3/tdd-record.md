# M3 TDD Record — ECC-OPL `/e2e` V2.0 registry governance

Harness: zero-dependency `node --test` (Node v24.21.0). Every stage below was executed in this
session against this worktree; no entry is transcribed from another branch, session, or milestone.
Live prompt behaviour is **not** claimed by this record: every result is
`live_prompt_verification: DEFERRED_TO_M6`.

Plan executed: `docs/plans/e2e-v2-0-m3-registry-governance.plan.md`, revision **r4**,
SHA-256 `4f57829b49c1a319357b637eb3fdbf77e81cd560639fbc1ce824b3e7da22b29a`
(`READY_FOR_EXECUTION`). Scope: AC-006, AC-007, AC-008, AC-009, AC-010 only.

## Checkpoint log

| # | Stage | Target | Command | Result |
|---|-------|--------|---------|--------|
| 0 | PREFLIGHT | upstream hashes + absence | `node docs/e2e-v2/m3/scripts/emit-m3-reports.mjs` | PASS — 6/6 pins MATCH, 20/20 M2-frozen artifacts IDENTICAL, `TESTS.md` absent, `.governance/docs-map.json` absent, Playwright absent → `reports/m3-preflight.report.json` |
| 1 | RED | registry lifecycle suite (24 cases) | `node --test docs/e2e-v2/m3/tests/*.test.mjs` | **FAIL** (exit 1) — `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/m3/tests/registry.mjs' imported from …/m3/tests/m3.test.mjs`; `tests 1 / pass 0 / fail 1`. Intended: the reference module does not exist yet |
| 2 | GREEN (first attempt) | same 24 cases | same | 23/24 — one failure only: `BOOTSTRAP: … byte-identically` → `AssertionError`, `actual 3510fe2f…` vs `expected f233af0a…` |
| 3 | FIX | `APPROVED_BOOTSTRAP_DIFF` trailing byte | same | constant re-spliced so it ends exactly where the proposal §3 block ends (one `\n` after `+}`); no test edited |
| 4 | GREEN | same 24 cases | same | **PASS** (exit 0) — `tests 24 / pass 24 / fail 0` |
| 5 | COVERAGE | `docs/e2e-v2/m3/tests/registry.mjs` | `node --test --experimental-test-coverage --test-coverage-include='docs/e2e-v2/m3/tests/registry.mjs' docs/e2e-v2/m3/tests/*.test.mjs` | `line 95.05% / branch 82.65% / funcs 95.24%` (≥ 80% lines and branches) |
| 6 | EXECUTED | 7 scenario reports + preflight | `node docs/e2e-v2/m3/scripts/emit-m3-reports.mjs` | `preflight PASS + 8 scenario reports written` (exit 0) |
| 7 | RED | static conformance of `.opencode/commands/e2e.md` | `node --test docs/e2e-v2/m3/tests/*.test.mjs` | **FAIL** (exit 1) — `tests 30 / pass 25 / fail 5`; failing: CONF-1 (DEC-06 approval-write flow), CONF-2 (ID discipline), CONF-3 (permitted-field sentence), CONF-4 (DEC-12), CONF-5 (bootstrap authorized separately). Intended: the prompt has no approval-write section |
| 8 | GREEN | same 30 cases after the `§5a` delta | same | **PASS** (exit 0) — `tests 30 / pass 30 / fail 0` |
| 9 | REFACTOR | `§5a` stale sentence wording | same + `node --test docs/e2e-v2/m2/tests/*.test.mjs` | M3 `30/30`, M2 `53/53` — rewording removed the literal `State:\s*stale` substring the M2 conformance check forbids, with no loss of M3 meaning |
| 10 | REGRESSION | M1 harness after the delta | `node --test docs/e2e-v2/m1/tests/m1.test.mjs` | `tests 13 / pass 11 / fail 2` — M1-01 and M1-11 fail because they pin the pre-delta `e2e.md` hash. Expected (plan R4); **not** fixed |
| 11 | SCOPE | write surface + delta + absence | `node docs/e2e-v2/m3/scripts/emit-m3-reports.mjs --scope` | PASS — `violations 0`, `authorized_delta_count 1`, `registry_files_absent true`, 20/20 frozen artifacts IDENTICAL, both decision files IDENTICAL, 16 files written |

## Stage notes

### Stage 0 — preflight (`reports/m3-preflight.report.json`)

| Input | Expected | Actual |
|---|---|---|
| `PRD-CANDIDATE.md` (R1 bundle) | `047918df…fce1d211` | MATCH |
| `.claude/prds/…-unified-journey-mapping.prd.md` | `bbe563be…895191a9` | MATCH (post-approval copy; never compared to `047918df…`) |
| `docs/e2e-v2/decisions/MILESTONE-GATES.json` | `00c6b455…017c8e5` | MATCH (independent) |
| `docs/e2e-v2/decisions/DECISION-REGISTER.md` | `cd848701…4c03d223` | MATCH (independent) |
| `M3-REGISTRY-DIFF-PROPOSAL.md` | `500704509…62069f` | MATCH |
| `docs/plans/…m3-registry-governance.plan.md` | `4f57829b…22b29a` | MATCH |

M1 baseline ZIP `9d1417f1…` is **not present** in the worktree or scratch; plan r4 permits skipping
its re-verification when absent, so it is recorded as `present: false` rather than claimed.

The approved bootstrap diff, extracted from proposal §3, hashes to
`f233af0a0f03736312440907c1eaef5ba5172ccbe5a47dd4242fea22f4880067` (988 bytes). The lifecycle test
asserts the generator's output against that exact hash, so the emitter cannot drift from what the
owner approved.

### Stage 1–4 — reference lifecycle (`docs/e2e-v2/tests/registry.mjs`)

Cases carried verbatim from the frozen matrix: BOOTSTRAP ×2, C02 ×2, C03 ×2, A08 ×2, B08 ×2,
ID-ALLOC ×4, MATCH ×2, B09 ×2, B12 ×2, CANCELLED ×1, B10-ext ×1, MUTATION-8 ×1, AC-010 ×1.

* The single Stage 2 failure was a **transcription** defect in the embedded constant, not a test
  defect: my first literal ended with `+}\n+` instead of `+}\n`. Per plan R1 the authority is the
  hashed proposal, so the constant was corrected and the test left untouched.
* Deliberate negative assertions: a title-only match is `authorized: false` and
  `applyVerifiedPass` returns `TITLE_ONLY_NOT_AUTHORIZED`; a non-permitted outcome field returns
  `FIELD-NOT-PERMITTED` with the registry text unchanged; `validateState('stale')` is
  `STATE-INVALID` (mutation 8); `assessLegacyStale` never applies its proposal.
* B12 runs against a real temp-dir file (F11), including an actual concurrent owner edit, and
  asserts the owner bytes survive the `WRITE_CONFLICT` (`owner_bytes_intact: true`).
* Uncovered lines (9 lines, 95.05%) are defensive branches: `NOT_FOUND` fallbacks and the
  `STATE-INVALID` non-stale row path. No coverage figure is claimed for the prompt file — the
  conformance suite covers that.

### Stage 6 — scenario reports

`reports/registry-required.report.json` (C02), `ad-hoc.report.json` (C03),
`full-phase.trace.json` (A08), `registry-preserve.diff.json` (B08), `idempotence.report.json` (B09),
`concurrency.report.json` (B12), `stale-migration-proposal.report.json` (B10-ext + mutation 8), plus
`approval-cancelled.report.json` (CANCELLED). Every file carries `status: "EXECUTED"`,
`method: "reference-implementation harness (node --test)…"`, and
`live_prompt_verification: "DEFERRED_TO_M6 (48-scenario acceptance)"`; C03/A08/B12 additionally
carry `live_execution: "DEFERRED_TO_M4/M6 …"`.

### Stage 7–9 — prompt delta (`.opencode/commands/e2e.md`)

Sole `AUTHORIZED_DELTA`. One additive section `§5a` inserted between `§5` and `§6`; frontmatter,
`§1`–`§5` and `§6`–`§9` left byte-identical.

| | SHA-256 |
|---|---|
| before (pre-delta, = plan r4 pin) | `1fe90046b445b2ce1753211851799e231526f9c5aed0e13cf3c8060d70097074` |
| after | `c562e0a2a2707c49362431b04ac1895f02c091e3d7ae193837ab6bf35b9d8436` |

The before hash was captured by Stage 0 and re-read from `m3-preflight.report.json` by the scope
check, so the pre/post pairing is not a hand-copied value.

### Stage 10 — expected M1 regression (documented, not fixed)

`m1.test.mjs` freezes the M1-era `e2e.md` hash (`08b17f2c…`) and the M1 scope-check report. Both
cannot hold after an authorized M3 delta. Plan R4 anticipates exactly this; M1 artifacts are frozen
evidence and were not edited. M2's suite (53 checks) passes unchanged.

## Provenance

| Artifact | SHA-256 |
|---|---|
| `tests/registry.mjs` | `c65e6ee1492bd67d87bfb0cfa3efc57c63d36008132cb8ced3750bc73da9e635` |
| `tests/m3.test.mjs` | `87e37ba72f7dd6e9a0677a0dab25a881eedd0f668c444bbf083fa455a2b2116e` |
| `tests/fixtures.mjs` | `35c702c4d716b0d80d16e8aed06a6561baff2be793fee0611d05309d6a19f977` |
| `tests/conformance.test.mjs` | `4276706f23767114a32ca34b683c294c5471cb8e8b78fd96c2e096448791a718` |
| `scripts/emit-m3-reports.mjs` | `af5e851fc454d0ebf9922abf8479bdcae94513e4aef085140fb9d4cb1b3e4a86` |
| `.opencode/commands/e2e.md` (after) | `c562e0a2a2707c49362431b04ac1895f02c091e3d7ae193837ab6bf35b9d8436` |

## What this record does not prove

* No live prompt/spawn behaviour: every scenario is reference-implementation only. M6 owns the
  48-scenario acceptance run.
* No registry write: `TESTS.md` and `.governance/docs-map.json` are still absent. The DEC-06 write
  remains a separately authorized next task.
* B12 is a temp-dir fixture, not a live concurrent writer across sessions.
