# Owner Approval Record — `/e2e` V2.0 Decision Amendment 001

**Record ID:** `DECISION-OWNER-APPROVAL-001`
**Amendment:** `DECISION-AMENDMENT-001`
**Date:** 2026-11-22
**Approver:** Owner
**Authority:** Explicit owner decision message (verbatim below)
**Scope of approval:** Policy and architecture baseline for milestones M2–M6 only.

---

## 1. Verbatim owner decision

> **Owner Decision — ECC-OPL `/e2e` V2.0**
>
> Approve keputusan berikut untuk baseline desain M2–M6:
>
> | Decision | Approved policy |
> |---|---|
> | DEC-04 | Deprecate legacy `/e2e <flow>` shorthand. Berikan migration hint, tanpa implicit execution. |
> | DEC-05 | Allow explicit `run --ad-hoc`, isolated sandbox, authorized non-production target, no registry coverage credit. |
> | DEC-06 | Registry bootstrap/write memerlukan explicit approval terhadap exact proposed diff. |
> | DEC-07 | Non-production execution only by default. Require per-environment and operation authorization. Production remains blocked. |
> | DEC-09 | Agent Browser optional dan default OFF. Playwright deterministic execution menjadi baseline. No auto-install. |
> | DEC-10 | Disable-default `/e2e-map` hanya setelah parity verification, effective runtime confirmation, dan rollback readiness. |
> | DEC-11 | CI automation deferred; tidak termasuk implementasi aktif V2.0. |
> | DEC-12 | `stale` adalah journey assessment, bukan Registry State. Legacy `State: stale` memerlukan reviewed migration ke enum yang valid. |
>
> Keputusan ini menyetujui **policy dan architecture**, bukan izin menjalankan browser, memodifikasi registry, atau menonaktifkan command sekarang.
>
> Perbarui canonical decision register, requirement traceability, dan downstream milestone gates secara konsisten.
>
> Jangan mengubah approved PRD atau frozen M1 artifacts secara diam-diam. Catat keputusan melalui prosedur amendment/approval yang berlaku.
>
> Pertahankan `ASM-01/ARGS`, `ASM-01/PRECEDENCE`, dan `ASM-02` sebagai technical validation gates pada M2. Jangan menandainya VERIFIED sebelum probe benar-benar dijalankan.
>
> Setelah decision register direkonsiliasi, lanjutkan M2 sesuai approved implementation plan tanpa mengulang M1.

---

## 2. What this record authorizes

- ✅ Update canonical decision register status → `APPROVED` for the 8 decisions above.
- ✅ Update requirement traceability and downstream milestone gates consistently.
- ✅ Record via explicit amendment (this directory); approved PRD, approved plan r3, and frozen M1 artifacts stay byte-identical.
- ✅ Continue M2 per an approved implementation plan.

## 3. What this record does NOT authorize

- ✘ Running browser/Playwright, modifying registry, or disabling `/e2e-map` as part of this reconciliation.
- ✘ Marking ASM-01/ARGS, ASM-01/PRECEDENCE, or ASM-02 as `VERIFIED` before probes execute.
- ✘ Silent edits to `.claude/prds/e2e-v2-0-unified-journey-mapping.prd.md` (approved digest `047918df…`) or `docs/plans/e2e-v2-0-unified-journey-mapping.plan.md` (r3 digest `ea20d4f2…`).
- ✘ Any Git mutation, Guardian bypass, active-HOME write, or change to frozen M1 artifacts.

---

## 4. Integrity anchors

| Item | Digest |
|---|---|
| Approved PRD (immutable snapshot) | `047918df0835bc7ea52f0d0dc7714f0b29394cce32ad8c2580b2973dfce1d211` |
| Approved plan r3 | `ea20d4f2c549b34f54c19f0111c030bbc68aa6cb67833edf6ffd18da9a04b1dd` |
| Baseline M1 review ZIP | `15d1ccfdcd4417371959f8d465ab335a61c76b3639e673a5a9ee06debcb23760` |
| Baseline M1-R1 review ZIP | `9d1417f1709ab14933476cacf37b46b0dc512849011abea67984bb4fe073c22f` |
