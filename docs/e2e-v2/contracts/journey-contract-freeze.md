# Journey Contract — FROZEN (B05 / B06)

Status: `FROZEN`
Frozen: M1, 2026-11-22
Transcribed verbatim in substance from: `JOURNEY-MAPPING-CONTRACT.md` and `REGISTRY-CONTRACT.md`
(R1 bundle, manifest-verified).

A journey is a unit of user behaviour with identity, actors, state and evidence. Mapping produces a
**transient proposal** in report/runner output — never a second registry. `TESTS.md` stays the only
registry.

## 1. Journey fields (14, `Wajib` flags preserved)

| Field | Wajib | Aturan |
|---|---|---|
| `journey_key` | ya | slug stabil, human-readable; berasal dari journey + actor + state boundary, bukan URL semata |
| `name` | ya | nama dalam bahasa project |
| `actors` | ya | role/persona; role boundaries eksplisit |
| `entry_point` | ya | rute lokal; absolut eksternal → tidak di-browse |
| `steps[]` | ya | `action`, `state_before`, `state_after` untuk tiap langkah |
| `expected_behavior` | ya | kondisi terverifikasi; bukan tautologi/visibility-only |
| `negative_paths[]` | ya bila relevan | authorization-denied, validation-error, duplicate-input |
| `alternate_paths[]` | ya bila ada | variasi locale/role tanpa duplikasi identitas |
| `dependencies[]` | ya | auth, service, fixture, external sandbox |
| `risk` | ya | `critical|high|normal|low` per §6.3 brief |
| `side_effects[]` | ya | create/update/delete/notification; kosong jika none |
| `confidence` | ya | `confirmed|partial|unverified` |
| `sources[]` | ya | `path:line` dari file source |
| `test_registry_ids[]` | ya bila ada | `TEST-E2E-NNN`; kosong → unmapped |

Field count: 14. `test_registry_ids[]` is mandatory-carried: a journey with an empty list is
`unmapped` and must produce a registry proposal, never a silent gap.

## 2. State transitions (journey assessment)

These are assessment states, distinct from the Registry State enum:

- `unmapped` → `mapped` once source evidence is confirmed.
- `mapped` → `stale` when the route or spec disappears.
- `stale` → `covered` only after a verified run.
- `covered` → `unverified` when evidence becomes invalid or the run fails.

`stale` here is an **assessment** label, never a Registry `State`
(see `contracts/command-contract.md` §4 and `PENDING_DEC DEC-12`).

## 3. Identity & dedup rules (4)

#### D1 — Locale mirrors collapse to one parameterized flow
`en/`, `id/`, `[locale]/` variants of the same page become ONE flow with a locale parameter. The
same page is never listed twice per locale.

#### D2 — Multiple routes may form one journey
Several routes are one journey when outcome, actor, state and risk are the same
(e.g. `list → detail → edit`, `login → dashboard`, `cart → checkout → confirmation`). One journey,
not one test per URL.

#### D3 — Role-dependent authorization is not merged without an actor label
Two paths that differ only by permission are separate journeys unless each carries an explicit
`actors` entry. Merging them silently hides an authorization boundary.

#### D4 — Dynamic / conditional / generated routes are `PARTIAL`
`confidence` is `partial`, never `confirmed`, for dynamic, conditional or generated routes.

## 4. Mapping to the registry

- Every journey with an empty `test_registry_ids[]` yields a proposed Section 2 row **and** a
  Section 4 block.
- New ID = maksimum numerik aktual + 1; start at `001` when the registry is empty. Reserved or
  removed IDs are never reused.
- Match by ID first, then stable journey + source. Route-title similarity alone never justifies a
  destructive edit.
- Existing fields are preserved; only the permitted write surface changes
  (`contracts/command-contract.md` §6). Actual mutation needs `PENDING_DEC DEC-06`.

## 5. Rule-check companions (B05 / B06)

Both are specification artifacts, `status: NOT_RUN`, `deferred_to: M2`. They state exactly what a
later milestone must assert; they record no outcome.

| Scenario | Companion | Deferred to |
|---|---|---|
| B05 — locale dedup + alternate paths | `m1/reports/locale-dedup.report.json` | M2 |
| B06 — multi-route journey grouping | `m1/reports/journey-grouping.report.json` | M2 |

## 6. Explicit non-goals in M1

No journey is mapped, no route is discovered, no registry row is proposed, `TESTS.md` is not
created. This file freezes rules only.
