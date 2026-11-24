# M2 TDD Record — ECC-OPL `/e2e` V2.0 unified interface

Harness: zero-dependency `node --test` (Node v24.21.0). Every stage below was executed in this
session; no entry is transcribed from another branch, session, or milestone.
Live prompt behaviour is **not** claimed by this record: every harness result is
`live_prompt_verification: DEFERRED_TO_M6`.

## Checkpoint log

| # | Stage | Target | Command | Result |
|---|-------|--------|---------|--------|
| 1 | RED | parser grammar (PS-01..08 + ad-hoc + legacy + happy) | `node --test docs/e2e-v2/m2/tests/m2.test.mjs` | FAIL — `ERR_MODULE_NOT_FOUND: …/tests/parser.mjs imported from m2.test.mjs` (intended: reference parser absent) |
| 2 | RED (detail) | same | same | became assertion-level after the module existed; failures were `expected {ok:true,mode:'map'} / actual {ok:true,mode:'no-args'}` and `usage lists the no-args mode` — both traced to the parser, not the harness |
| 3 | GREEN | same 13 parser tests | `node --test docs/e2e-v2/m2/tests/m2.test.mjs` | PASS — `tests 13 / pass 13 / fail 0` |
| 4 | REFACTOR | `parser.mjs` | same | no further change beyond the two fixes above; grammar stays one function, 70 lines |
| 5 | RED | static conformance of `.opencode/commands/e2e.md` (10 checks) | `node --test docs/e2e-v2/m2/tests/m2.test.mjs` | FAIL — `tests 23 / pass 13 / fail 10`; every conformance check failed against the legacy prompt (`argument-hint` was `[user flow, route, or TEST-E2E-NNN to test]`, no `REGISTRY_REQUIRED`, legacy "proceed exactly as before" present) |
| 6 | GREEN | same 23 tests after the prompt rewrite | same | PASS — `tests 23 / pass 23 / fail 0` |

## Stage notes

### Stage 1–3 — reference parser (`docs/e2e-v2/m2/tests/parser.mjs`)

* PS-01 unknown mode → fail-closed with the 6-mode usage; PS-02 `map run TEST-E2E-001` → "one mode
  per invocation" with no mode selected; PS-03 duplicate `--ad-hoc`; PS-04 empty/blank after `run`
  → no-args; PS-05 `;`/`&&`/`|`/redirect; PS-06 `$( )`; PS-07 backticks; PS-08 embedded newline.
* Extra grammar rules proven by the same suite: `--ad-hoc` only on `run`, only immediately after
  `run`, at most once; bare non-mode phrase → legacy-shorthand hint with `action: none` (DEC-04);
  a lone unknown token or a phrase carrying a path/flag/TEST-ID → fail-closed (keeps PS-01 and
  DEC-04 from collapsing into one another).
* Every fail-closed result carries `usage` + `usageModes` (exactly the 6 modes) + `action: none`.

### Fixes made during GREEN (implementation, not tests)

1. Usage text said `(no args: …)`; the harness asserts the mode name `no-args`. Implementation
   aligned to the mode name (harness assertion encodes the frozen mode list, not a wording style).
2. `parse('map')` returned `no-args` because every empty target short-circuited. Corrected: only
   `run` with an empty target degrades to no-args (PS-04); the other modes keep their mode.
| 7 | RED | validator suite (RP-01..06, SE-01..04, B10 ×4) | `node --test docs/e2e-v2/m2/tests/m2.test.mjs` | FAIL — `ERR_MODULE_NOT_FOUND: …/tests/validators.mjs` (intended: enforcement layer absent) |
| 8 | GREEN | same suite + parser + conformance | same | PASS — `tests 39 / pass 39 / fail 0` |
| 9 | EXECUTED | 6 evidence reports from the frozen matrix | `node docs/e2e-v2/m2/scripts/emit-reports.mjs` | 19 distinct case IDs (9 PS + 6 RP + 4 SE) + B10 ×4 emitted, 0 `FAIL` verdicts |

### Stage 7–8 — validators (`docs/e2e-v2/m2/tests/validators.mjs`)

* `resolveRegistry` — docs-map wins only when valid JSON **and** in-repo; RP-01 absolute, RP-02 `..`,
  RP-04 symlink-mediated escape, RP-05 dual location → `stop:true` with no path returned, RP-03
  realpath escape fails closed before a reader sees a path.
* `checkSpecPath` — RP-06 for absolute/`..`, SE-03 for a symlinked spec leaving the repo.
* `checkEvidence` — SE-04 missing, SE-01 symlink escape, SE-02 resolved-escape; `citable`/`coverable`
  are false in every rejection.
* `assessRow` — B10 `State: stale` → proposal with `applied:false`; covered + invalid evidence →
  `unverified`; covered + route gone → `assessment:'stale'` plus a separate State proposal; any other
  value → `STATE-INVALID` with no normalised proposal.

Implementation corrections made during GREEN (not tests): RP-04's test now encodes the *relative but
symlink-escaping* class (an absolute path is RP-01's class); the validator returns paths rooted at the
caller's own root, because macOS realpath (`/var` → `/private/var`) made canonical paths uncomparable.
| 10 | RED | resolver suite (6 checks) | `node --test docs/e2e-v2/m2/tests/m2.test.mjs` | FAIL — `ERR_MODULE_NOT_FOUND: …/tests/resolver.mjs` (intended: resolver absent) |
| 11 | GREEN | same suite (45 total) | same | PASS — `tests 45 / pass 45 / fail 0` |

### Stage 10–11 — resolver (`docs/e2e-v2/m2/tests/resolver.mjs`)

Match order is id → title → route, first tier with a hit wins; >1 hit returns `AMBIGUOUS` with
id-ordered candidates and exactly one `recommended`; zero hits returns `REGISTRY_REQUIRED` with
`next: /e2e-map`. A `Command:` value is echoed verbatim and `executed` is always `false` (PS-09).
| 12 | RED | F01–F06 contract suite + LD-01..05 + JG-01..07 against the frozen expected output | `node --test docs/e2e-v2/m2/tests/m2.test.mjs` | FAIL — 4 tests, assertion failures: F01 `locale mirrors collapse to one flow`, F03 `Cannot read properties of undefined (reading 'join')` (no `sources[]`), F06 group/type error, LD-01 `exactly one journey_key` | intended: detector lacked guard inheritance across locale mirrors, journey sources, yii2 value-target rule |
| 13 | GREEN | same suite (53 total) | same | PASS — `tests 53 / pass 53 / fail 0` |

### Stage 12–13 — detector + fixtures (`docs/e2e-v2/m2/tests/detector.mjs`, `fixtures.mjs`)

RED was a real assertion failure, not a missing module: the detector ran and produced wrong
journeys. Three implementation corrections (not test relaxations) made it green:

* a layout guard on `[locale]` now applies to every locale mirror of that page (D1 identity), so
  `en/`, `id/` and `[locale]/` never split one flow into two actors;
* journeys carry `sources[]` (`path:1`), and a Laravel route correlates to its Inertia page by its
  own name segments — that is what proves the F03 journey "spans web.php and resources/js/Pages";
* Yii2 only treats `'<rule>' => '<controller>/<action>'` as a route, so `'rules' => [` is config,
  not an invented path.

Two test corrections, both recorded: the F03 assertion had been written as "no `routes/api.php`
route exists" when the contract is "it exists with `kind: api`", and LD-04's synthetic pair was
re-pointed at two paths under one noun. Implementation fix for LD-04: unlabelled paths are never
merged across variants (only mirrors of one normalized key merge), so D3 holds.

### Stage 14 — evidence emission and closure

| Stage | What | Command | Result |
|---|---|---|---|
| 14a | per-artifact case reports (19 PS/RP/SE + B10) | `node docs/e2e-v2/m2/scripts/emit-reports.mjs` | 6 reports, 22 case verdicts, 0 FAIL |
| 14b | fixture + B05/B06 reports | `node docs/e2e-v2/m2/scripts/emit-map-reports.mjs` | 4 map artifacts (`contract_passed: true`), LD 5/5, JG 7/7 |
| 14c | scope + frozen manifest | `node docs/e2e-v2/m2/scripts/emit-scope-check.mjs` | 0 violations, 1 `AUTHORIZED_DELTA` (`e2e.md` `08b17f2c…` → `1fe90046…`), 20 frozen M1 files snapshotted |
| 14d | M1 regression (expected) | `node --test docs/e2e-v2/m1/tests/m1.test.mjs` | 11/13 PASS — `M1-01` and `M1-11` are the two documented `AUTHORIZED_DELTA` consequences, not M1 artifact mutations |
| 14e | M2 regression | `node --test docs/e2e-v2/m2/tests/m2.test.mjs` | 53/53 PASS |

Coverage: **NOT_MEASURED** — this repo configures no coverage tool and none was installed or run.
No number is claimed.

### Stage 15 — stamp normalisation (closure gate)

Traceability claims every report carries `generated_at`, `milestone`, `method`, `status`,
`live_prompt_verification`. A machine check over all 16 files found four gaps: the fixture/B05/B06
emitter omitted `milestone`; `scope-check.report.json` omitted `method`;
`frozen-artifacts.manifest.json` carried only `generated_at`/`milestone`/`note`; and the
hand-authored `m2-preflight.report.json` / `command-resolution.report.json` lacked
`live_prompt_verification` / `status`. Fixed in the generators (not by hand-editing their output)
and in the two hand-authored files, then re-emitted.

| Stage | Command | Result |
|---|---|---|
| 15 | `node docs/e2e-v2/m2/scripts/emit-map-reports.mjs && node docs/e2e-v2/m2/scripts/emit-scope-check.mjs` | all 16 reports carry the 5-key stamp; map artifacts `contract_passed: true`; scope `PASS`, 0 violations, 1 delta, 29 write-surface files |
| 15 | `node --test docs/e2e-v2/m2/tests/m2.test.mjs` | 53/53 PASS (unchanged by the stamp work) |

### Stage 16 — coverage (measured, scoped)

`node --test --experimental-test-coverage docs/e2e-v2/m2/tests/m2.test.mjs` →
`all files 99.50% lines / 95.38% branches / 100.00% functions`, 53/53 PASS.

This is Node's built-in runtime coverage over the files the M2 suite loads
(`docs/e2e-v2/m2/tests/parser.mjs`, `validators.mjs`, `resolver.mjs`, `detector.mjs`). No
coverage tool is configured in this repo and none was installed, so the figure is quoted for those
modules only — it is **not** a project-wide coverage claim. Stage 14e's `NOT_MEASURED` remains the
correct statement about *tool-configured* coverage; this row supersedes it only for the measured
scope above.
