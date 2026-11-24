# M5 r1 Review — Two-Reviewer Reconciliation

**Plan:** `docs/plans/e2e-v2-0-m5-migration-rollback.plan.md`
**Plan revision:** r1
**Plan SHA-256:** `f946c165ddb00e49bc2c17b306eb7d5cf5ecddf11955d408df2c1f52a594f108`

## Conflicting verdicts

| Reviewer session | Verdict | Blockers |
|---|---|---|
| `ses_df7df3da5ffeaV1ifzWOsPKeCX` | APPROVE | 0 |
| `ses_df7deabe2ffeZ2MV1x27MY7WOv` | REQUEST_CHANGES | 4 material (all planner-patchable) |

Both verified the same pinned digest and the same upstream pins. The second reviewer additionally found four self-consistency/executability defects that the first reviewer missed. Because the four blockers are concrete and verifiable on disk, the stricter verdict governs: **r1 is not approvable**.

## Blockers carried to r2

1. **Step 8 (line 355) lacks a concrete validation command and failure-path QA.** Only prose "happy path" is present; no tool/command, no failure path.
2. **Path ambiguity `ECC/.opencode/opencode.json`** at lines 85, 172, 415. From repo root this resolves to `ECC/ECC/...` → `ENOENT`. Correct: `.opencode/opencode.json`.
3. **Missing required evidence artifact `symlink-escape.reject.json` for Scenario D04** (lines 111, 283, 431). D04 was conflated into `registry-path.reject.json` (which belongs to B11).
4. **Internal report-count contradiction**: lines 105/277/296 say "12 report files", lines 107–121 enumerate 14, and lines 309/328/329 add three more (15 total). Emitter scope must be stated exactly.

## Non-blocking notes

- Step 1 QA uses an inline `node -e "/* preflight hash verification script */"` stub; a concrete one-liner or report check would be clearer.
- DEC-12 is already implemented in M3; noting it avoids confusion (no action required).

## Effect on state

- Review round 1 recorded as `REQUEST_CHANGES` with 4 blockers; the APPROVE from the first reviewer is preserved in this reconciliation but does not supersede the stricter result.
- `gates.approved` remains false. Plan revision advanced to r2 for planner patching.
- Owner's "approve dan proceed" was given before this conflict was known; approval is held until r2 passes review.
