# Erratum: D05 Workflow Metadata Inconsistency (M1-R1)

**Erratum ID:** `ERR-D05-WORKFLOW-METADATA-01`  
**Date:** 2026-11-22  
**Status:** `KNOWN_STALE_NOT_MUTATED`  
**Target Milestone:** M1-R1 Evidence Reconciliation  
**Affected File:** `.opencode/workflows/active.json`  

---

## 1. Observed Inconsistency

In `.opencode/workflows/active.json`, the field:
`ac_status.D05 = "VERIFIED"`
records D05 as unconditionally `VERIFIED`.

However, the authoritative static evidence artifact:
`docs/e2e-v2/m1/reports/frozen-hashes.report.json`
declares:
`"status": "NOT_VERIFIED"`
with reason:
> *"D05 requires frozen workflows AND Guardian Angel AND the A07b/core guard AND Git policy to be byte-identical with no bypass. M1 is forbidden .git and .guardian-angel access, so only the workflow-file surface can be evidenced. This report is therefore NOT complete D05 evidence."*

Furthermore, the 9 workflow surfaces in `frozen-hashes.report.json` include:
- **7 `NO_PRIOR_REF` surfaces**: current hashes recorded; historical byte identity not established against a prior audit reference.
- **2 `/plan-prd` copies `BYTE_IDENTICAL`**: equal to one another, not matched to a prior historical baseline.
- **3 protected exclusions `NOT_VERIFIED`**: Guardian Angel, A07b/core guard, Git policy.

---

## 2. Desired Semantic Status

- **Scoped static workflow acceptance:** `PARTIAL_STATIC_VERIFIED` (recorded current hashes match across the 7 frozen workflows and 2 plan-prd surfaces).
- **Full D05 status:** `NOT_VERIFIED` (due to access boundaries on Guardian Angel, A07b, and `.git` metadata).

---

## 3. Why `active.json` Was Not Mutated in M1-R1

`.opencode/workflows/active.json` is located outside the approved M1 correction write boundary (`docs/e2e-v2/**`). It is governed by the OpenCode workflow state gate (`preflight-plan.js` / workflow manager). Mutating active workflow state directly during an artifact-level correction would violate boundary isolation rules and falsify workflow tracking.

Per brief Section 6, C3:
> *"Do not silently modify or omit the conflict. If workflow metadata remains stale at handoff, record `WORKFLOW_METADATA_STATUS=KNOWN_STALE_NOT_MUTATED`, not `ALL_STATUS_SURFACES_SYNCHRONIZED=YES`."*

---

## 4. Required Follow-up Process

Reconciliation of `.opencode/workflows/active.json` must be performed by the authorized workflow owner or via a dedicated workflow transition command (`/plan` or `/tdd` state transition) when the workflow officially advances to M2.

Reviewers and downstream consumers must treat `ac_status.D05="VERIFIED"` in `active.json` as **known stale reference metadata**, and rely strictly on `docs/e2e-v2/m1/reports/frozen-hashes.report.json` (`NOT_VERIFIED`) as the authoritative evidence source.
