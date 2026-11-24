# ECC-OPL `/e2e` V2.0 — Canonical Decision Register (Amended)

**Register ID:** `DECISION-REGISTER-001`
**Amendment:** `DECISION-AMENDMENT-001` (owner approval, 2026-11-22)
**Supersedes:** OPEN / `PENDING_DEC` / `OWNER_DECISION_REQUIRED` status for DEC-04, DEC-05, DEC-06, DEC-07, DEC-09, DEC-10, DEC-11, DEC-12 in frozen M1 evidence (`docs/e2e-v2/m1/reports/scope-check.report.json`, `docs/e2e-v2/m1/traceability-m1.md`) and in workflow state (`.opencode/workflows/active.json` `plan_ref.prerequisites`).
**Does NOT modify:** approved PRD (`047918df…`), approved plan r3 (`ea20d4f2…`), or any frozen M1 artifact under `docs/e2e-v2/**` produced by M1-R1. Those remain byte-identical historical evidence.

---

## 1. Authority and scope of this amendment

Owner approved eight downstream decisions as **policy and architecture baseline for M2–M6** via explicit owner message on 2026-11-22. The approval is recorded verbatim in `DECISION-OWNER-APPROVAL-001.md`.

**Authorization boundary (owner, verbatim):**
> "Keputusan ini menyetujui policy dan architecture, bukan izin menjalankan browser, memodifikasi registry, atau menonaktifkan command sekarang."

Consequences:
- Approving a DEC changes its **status** to `APPROVED` and fixes its **policy** as canonical for the consuming milestone.
- It does **not** authorize browser/Playwright execution, registry writes, or `/e2e-map` disablement in this task. Those remain gated by their own runtime preflight and milestone execution.
- `ASM-01/ARGS`, `ASM-01/PRECEDENCE`, `ASM-02` remain **technical validation gates at M2** with status `NOT_VERIFIED` until their probes actually run. No DEC approval marks them VERIFIED.

---

## 2. Approved decisions (canonical, M2–M6 baseline)

| ID | Correct topic | Consuming milestone | Status | Approved policy (verbatim intent) |
|---|---|---|---|---|
| DEC-04 | Legacy `/e2e <flow>` shorthand | M5 | **APPROVED** | Deprecate legacy `/e2e <flow>` shorthand. Berikan migration hint, tanpa implicit execution. |
| DEC-05 | Explicit `run --ad-hoc` policy | M2 | **APPROVED** | Allow explicit `run --ad-hoc`, isolated sandbox, authorized non-production target, no registry coverage credit. |
| DEC-06 | Registry bootstrap / write policy | M3 | **APPROVED** | Registry bootstrap/write memerlukan explicit approval terhadap exact proposed diff. |
| DEC-07 | Per-environment execution authorization | M4 | **APPROVED** | Non-production execution only by default. Require per-environment and operation authorization. Production remains blocked. |
| DEC-09 | Agent Browser optional exploration | M4 | **APPROVED** | Agent Browser optional dan default OFF. Playwright deterministic execution menjadi baseline. No auto-install. |
| DEC-10 | `/e2e-map` disable-default after parity | M5 | **APPROVED** | Disable-default `/e2e-map` hanya setelah parity verification, effective runtime confirmation, dan rollback readiness. |
| DEC-11 | CI automation policy | M6 | **APPROVED** | CI automation deferred; tidak termasuk implementasi aktif V2.0. |
| DEC-12 | Legacy `State: stale` schema reconciliation | M5 | **APPROVED** | `stale` adalah journey assessment, bukan Registry State. Legacy `State: stale` memerlukan reviewed migration ke enum yang valid. |

Already-confirmed architecture decisions (not reopened, not part of this amendment): DEC-01, DEC-02, DEC-03, DEC-08 + ADR-E2E-001…014.

---

## 3. Policy semantics per decision (consumption guidance)

- **DEC-04 (M5):** legacy shorthand may remain only as a deprecation shim that emits a migration hint pointing to `/e2e run <flow>` / `/e2e map`. It must never execute or add coverage implicitly.
- **DEC-05 (M2):** `run --ad-hoc` is a permitted explicit sub-mode. It requires an isolated sandbox and an authorized non-production target; output is scratch evidence only with `PASS_AD_HOC_UNREGISTERED` — never registry coverage credit.
- **DEC-06 (M3):** creating or mutating registry candidate entries requires explicit owner approval of the exact proposed diff before any write. A hash/receipt is not owner consent.
- **DEC-07 (M4):** default execution target is non-production. Each environment and operation needs explicit authorization; production targets stay blocked regardless of registry state.
- **DEC-09 (M4):** Agent Browser exploration is optional and default OFF. The execution baseline is deterministic Playwright specs. No auto-install of browser, CLI, or packages.
- **DEC-10 (M5):** `/e2e-map` may be disabled by default only after all three prerequisites are evidenced: parity verification, effective-runtime winner confirmation, and rollback readiness. The decision authorizes future disablement, not present disablement.
- **DEC-11 (M6):** CI automation is out of active V2.0 implementation; recorded as deferred, not as a current deliverable.
- **DEC-12 (M5):** `stale` is a journey/route assessment label, never a Registry State value. Valid Registry States remain exactly: `missing`, `in progress`, `unverified`, `covered`, `not applicable`. A legacy `State: stale` row needs a reviewed migration proposal — no silent rewrite.

---

## 4. Technical validation gates (unchanged, M2)

These gates are **not** owner policy decisions and are **not** affected by this amendment. They stay open until probes actually execute.

| Gate | Stages / assertions | Status | Probe | Milestone |
|---|---|---|---|---|
| ASM-01/ARGS | `$ARGUMENTS` parsing and subcommand/flag passing semantics | `NOT_VERIFIED` | `DEFERRED_TO_M2` | M2 |
| ASM-01/PRECEDENCE | project vs dual-global effective command winner | `NOT_VERIFIED` | `DEFERRED_TO_M2` | M2 |
| ASM-02 | Detector portability across F01–F06 stacks | `NOT_VERIFIED` | `DEFERRED_TO_M2` | M2 |

Do not mark any of them `VERIFIED` before the probe runs and produces raw evidence.

---

## 5. Reconciliation map (frozen evidence → this register)

Frozen M1 artifacts are not edited. They remain historical evidence with their original `OWNER_DECISION_REQUIRED` values. This register is the authoritative current state:

| Frozen M1 location | Original value (preserved) | Current authoritative value (this register) |
|---|---|---|
| `scope-check.report.json` `dec_pending[]` | 8 × `OWNER_DECISION_REQUIRED` | 8 × `APPROVED` with policies above |
| `traceability-m1.md` §4 DEC table | `PENDING_DEC` | superseded by this register |
| `active.json` `plan_ref.prerequisites[]` | 8 × `OPEN` | 8 × `APPROVED` (workflow state updated separately) |
| `DECISIONS-AND-OPEN-QUESTIONS.md` (M1-R1 package) | `OPEN / PENDING_DEC` | superseded by this register |

Full step-by-step traceability is in `REQUIREMENT-TRACEABILITY.csv`; downstream gate state is in `MILESTONE-GATES.json`.
