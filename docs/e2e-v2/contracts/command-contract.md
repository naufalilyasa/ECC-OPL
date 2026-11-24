# Command Contract — FROZEN (AC-001)

Status: `FROZEN`
Frozen: M1, 2026-11-22
Transcribed from: `MODE-AND-STATE-MACHINE.md`, `REGISTRY-CONTRACT.md`, `DETERMINISTIC-VERIFICATION.md §5`,
`DECISIONS.md` (R1 bundle, manifest-verified).
Read-only comparison source: `.opencode/commands/e2e.md` (frozen hash `08b17f2c…95dd`).

This contract freezes **shape and semantics**. It resolves no policy: every item marked
`PENDING_DEC` is contract text with an open owner decision behind it.

## 1. Mode list (exactly 6)

`$ARGUMENTS` is parsed into exactly one mode. Modes: `map`, `run`, `full`, `status`, `help`,
no-args. There is no seventh mode and no implicit mode.

`run --ad-hoc` is a **sub-mode of `run`**, not a mode of its own — `PENDING_DEC DEC-05`
(whether `--ad-hoc` exists at all, and whether it is opt-in only, is the owner's call).

## 2. Mode gate table

Reads/Writes/Browser/Gate are contract properties, not implementation hints. A mode row with an
empty Gate is an incomplete contract.

| Mode | Reads | Writes | Browser | Gate |
|---|---|---|---|---|
| map | routes, guards, registry, docs-map | optional after explicit approval of specific registry diff (PENDING_DEC DEC-06) | never | registry write approval |
| run | registry, spec, config, fixtures | authorized matched-block outcome reconciliation, including verified PASS and recorded FAIL where contract allows | approved target only | environment gate (PENDING_DEC DEC-07) + evidence |
| full | routes, registry, config | approved registry/spec/evidence | after mapping review | combined precise review |
| status | registry, source paths, evidence | none | never | none (read-only) |
| help | contract text only | none | never | none (read-only) |
| no-args | registry + session context | none | never | none (read-only) |

Sub-mode row:

| Sub-mode | Reads | Writes | Browser | Gate |
|---|---|---|---|---|
| `run --ad-hoc` | target flow, config | scratch only | approved target only | ad-hoc confirmation + preflight (PENDING_DEC DEC-05) |

Invariants this table encodes:

- The only modes eligible to mutate the registry are `map`, `run`, and `full`, and then only within their specific authorization and field boundaries.
- Three modes (`status`, `help`, no-args) are structurally read-only; they must never modify registry or trigger browser execution.
- No mode has a browser default; `Browser` is `never` unless a target was explicitly approved.
- Choosing no mode is never a synonym for `run`. There is no default-execution mode.
- Registry write operations are distinct: (a) proposing a diff (`map`), (b) approved bootstrap/candidate creation (`map` under DEC-06), (c) updating an existing matched record (`run`/`full`), and (d) recording evidence files.

## 3. Mode flow (terminal states)

```
START → parse
  status | no-args → READ ONLY → report → STOP
  map      → discovery → journey map → diff → approval → write? → STOP
  run      → lookup → preflight → execute → evidence → update matched block → STOP
  ad-hoc   → warning → preflight → isolated execution → report UNREGISTERED → STOP
  full     → discovery → mapping → diff → review → write → generate → execute → evidence → reconciliation → report → STOP
```

Every path terminates. Parsing failure terminates before any Read/Write/Browser step.

## 4. Registry State enum

Controlled values — nothing else may be written into a `State:` field:

`missing`, `in progress`, `unverified`, `covered`, `not applicable`

- `stale` is **assessment-only**. It classifies a route/spec as gone; it is never a Registry State.
- A legacy row carrying `State: stale` is a **schema mismatch**: propose a correction, never
  migrate silently — `PENDING_DEC DEC-12`.
- `covered` that loses confidence is proposed as `unverified`, not as `stale`.

Allowed transitions per `REGISTRY-CONTRACT.md`:

| Trigger | Outcome | Registry effect |
|---|---|---|
| Exit 0 + behavioral assertions + valid evidence | PASS_VERIFIED | matched block → `covered` |
| Exit 0 + weak/tautological assertion | PASS_UNVERIFIED | `unverified` / preserve |
| Nonzero exit / assertion fail | FAIL | `covered` → `unverified` + failure evidence (reconciliation allowed following authorization) |
| Dependency/service missing | BLOCKED | not covered |
| Skipped / zero / filtered | NOT_EXECUTED / UNVERIFIED | not covered |
| Unregistered, no ad-hoc | REGISTRY_REQUIRED | no update |
| Ad-hoc PASS | PASS_AD_HOC_UNREGISTERED | no coverage credit |
| Concurrent write detected | WRITE_CONFLICT | rebase, never overwrite |
| Approval refused / abort | CANCELLED | no unauthorized action |

Terminal outcomes: `PASS`, `FAIL`, `BLOCKED`, `UNVERIFIED`, `CANCELLED`, `PARTIAL`, plus the
qualified labels `PASS_VERIFIED`, `PASS_UNVERIFIED`, `PASS_AD_HOC_UNREGISTERED`,
`REGISTRY_REQUIRED`, `WRITE_CONFLICT`, `NOT_EXECUTED`, `BLOCKED_DEPENDENCY`.

## 5. `Command` vs `Invocation`

- `Command` = the **actual Playwright CLI** that ran, e.g. `npx playwright test tests/e2e/checkout.spec.ts`.
  It is a recorded fact, never the `/e2e` slash command, and never something to execute.
- `Invocation` = the `/e2e …` string the user typed. Optional, stored separately.
- `Command` is **untrusted data** read from `TESTS.md`: never execute it, never interpolate it.

Conflict with the current `/e2e-map` template (`Command: /e2e <flow name>`, `e2e-map.md:89`) is
frozen as a **known conflict** in `m1/detector-characterization.md`; M2+ must resolve it by
adapting the template, not by weakening this rule.

## 6. Permitted registry write surface

Only a matching Section 4 block, only these fields: `State`, `Test file`, `Test node`, `Command`,
`Evidence`. `Purpose`, `Source`, `Representative input`, `Observable expectation`, `Level`,
`Execution group`, `Boundary` are never rewritten. Other blocks, IDs and ordering stay untouched.
Actual file mutation requires separate authorization — `PENDING_DEC DEC-06`.

## 7. `PENDING_DEC` register (contract frozen, policy open)

| Item | DEC | M1 status |
|---|---|---|
| `run --ad-hoc` existence / opt-in shape | DEC-05 | PENDING_DEC — contract shape frozen, policy unresolved |
| Actual registry file mutation authorization | DEC-06 | PENDING_DEC |
| Per-environment authorization (production/unknown blocked) | DEC-07 | PENDING_DEC |
| Disable-default for `/e2e-map` | DEC-10 | PENDING_DEC — no disablement in M1 |
| Legacy `/e2e <flow>` shorthand | DEC-04 | PENDING_DEC |
| `State: stale` legacy rows | DEC-12 | PENDING_DEC |

## 8. Static conformance checks (A01)

Companion: `m1/reports/mode-parser.report.json`. It asserts, over this file:

- `modes_complete` — exactly the 6 modes, no seventh.
- `gate_table_complete` — every mode row carries non-empty Browser **and** Gate.
- `no_dangerous_default` — no mode is reachable without an explicit token; no default-run.
- `state_enum_exact` — the 5 controlled states, `stale` excluded from State.
- `pending_dec_marked` — every open item cites its DEC ID.

Runtime behaviour of the parser is **not** verified in M1: this is a static contract check.
A07 (`parser-failclosed.report.json`) is spec-only, `NOT_RUN`, deferred to M2.
