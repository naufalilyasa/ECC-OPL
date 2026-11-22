---
description: Git-safe, two-pass behavior-preserving cleanup via existing code-simplifier workers with a plan-bound guarded write channel
argument-hint: "[explicit target path or module]"
---

# Refactor Clean Orchestration (V1.1.4)

You are the Main Orchestrator. You are read-only for application source: inspect, dispatch, verify and report. Never hand-edit source.

**User scope (the only authorization that counts):** $ARGUMENTS

## Non-negotiable boundaries

- Guardian Angel owns `.git` / `.guardian-angel`: never read or write them, and never bypass policy. `git_mode=NOT_INSPECTED`, `index_provenance=UNKNOWN`; no Git write, commit, stash, reset, checkout or deployment.
- The installed ECC-managed `refactor-clean-evidence.cjs` is the single guarded write channel. Supported invocation: `node <installed helper> apply-module <private-scratch/request.json>`. Raw CLI `apply` stays deliberately blocked. No inline interpreter, no unscoped native edit/write/shell, no caller-supplied authorization boolean.
- `makePlan()` freezes one immutable plan (schema `v1.3`): canonical root, explicit scope, immutable guard roster including every selected test, exact test roster, adapter, runner identity/args, cwd, profile and timeout. Run/stage/fingerprint are per-execution bindings, never plan fields. Any changed test file, guard, runner or root is `VERIFICATION_PLAN_MISMATCH` with `spawned:false` — a matching digest alone is never proof of execution.
- Optimistic revalidation hashes content and checks `mtimeMs`/`ctimeMs` on every inventory row (`OPTIMISTIC_NOT_ISOLATED`, `CONCURRENT_WRITER_NOT_GUARANTEED`). Guard files are read-only; missing, linked, special, unsafe-owned or scope-overlapping guards are rejected. Hashes and receipts are accounting, not owner consent or a sandbox (`TOOL_LAYER_SCOPE_ENFORCEMENT=NOT_VERIFIED`).
- PHP/Laravel execution is **deferred**: without an independently proven isolated profile, `runPhpTests`, CLI `tests` and `apply-module` return `NOT_SUPPORTED / PHP_ISOLATION_NOT_VERIFIED` before any config evaluation, DB creation, boot or spawn. Never treat `APP_ENV=testing`, `:memory:`, a directory name, a caller flag or a parser fixture as isolation. No fallback to Node.

## 1. Freeze plan and baseline (read-only)

1. Require explicit scope from `$ARGUMENTS`; otherwise `ANALYSIS_ONLY`. Build the plan once with `makePlan({ root, scope, tests, guard })`. Every selected test is an immutable full-content guard and must be disjoint from editable scope; an overlap is `VERIFICATION_TEST_SCOPE_OVERLAP` and stops before spawn/edit. Discovery/globs resolve to explicit files once; a later roster change requires a new run and new baseline.
2. Capture S0 with `capture({ root, scope: plan.scope, guard: plan.guard })`. Run the baseline with `runNodeTests({ root, tests: plan.tests, scope: plan.scope, guard: plan.guard, plan, stage:'baseline', run_id, expectedFingerprint: S0.fingerprint })`. Require GREEN, positive tests/assertions, `spawned:true`, and actual `roster_executed` equal to `plan.tests`. Legacy/no-plan runs are `diagnostic:true` and ineligible for writes or completion.
3. Allocate one run identity for the whole workflow. Stages are `baseline → apply-A → post-A → apply-B → post-B → final`. Missing, foreign or reused stage/run evidence never advances the workflow.

## 2. Skill preflight

Resolve the ECC-managed safe skills actually loaded by the runtime: pass A `ecc-remove-deadcode-safe`, pass B `ecc-remove-ai-slops-safe`. Record id, path, source SHA and text SHA. Never load the global originals into a writable context. A missing safe skill is `SKILL_UNSAFE_OR_UNAVAILABLE`, never `NO_CANDIDATES`.

## 3. Pass A — remove-deadcode

Dispatch exactly one existing `code-simplifier` child; it loads the safe skill with the native `skill` tool before analysis or edit. The child writes a request JSON in private scratch containing the plan, S0, the executed baseline, its loaded-skill result, `stage:'apply-A'`, the same run id, and exact unique hunks with `authorizedPaths` inside the frozen scope; then calls file-based `apply-module`. KEEP/DEFER is mandatory for public contracts, dynamic lookup, framework registration, test consumers, security/validation/logging, migrations and external payloads. Empty genuine analysis is `NO_CANDIDATES`, not a forced edit.

A genuine zero-candidate pass is a completed disposition, not a failure: return a `NO_CANDIDATES` receipt with completed analysis, candidate dispositions, zero hunks/changed paths and the unchanged snapshot fingerprint. Do not call `apply-module` or manufacture an edit. The parent validates it with `evaluateNoOp(...)` and a fresh full-roster post-A run; only `PASS_COMPLETE` with `completion_kind: NO_CANDIDATES` advances. Parent corroborates the child with raw fetched session events (the helper verifier consumes caller-supplied structures and is explicitly non-live), rechecks guard bytes, and runs post-A with the SAME plan/roster on S1. `REGRESSION_DETECTED`, `STALE_SCOPE`, invalid/incomplete receipt or any unprotected write stops the workflow — B never starts.

## 4. Pass B — remove-ai-slops

Only after post-A is a verified `PASS_COMPLETE` — edited **or** genuine no-op — on S1. Dispatch a fresh child, load the pass-B skill before work, and either call `apply-module` with `stage:'apply-B'`, `pass:'B'`, `priorPass` carrying the verified post-A completion, or return a verified `NO_CANDIDATES` receipt evaluated with `evaluateNoOp(..., stage:'post-B', priorPass)`. A missing/foreign/contradictory prior completion never advances B. S1 may equal S0 for a no-op. Mechanical equivalence only; preserve behavior, errors, validation, security and logging. Run post-B on S2, then final verification.

## 5. Final

Run the full frozen roster against S2 and call `evaluatePass({ applied, postTests, plan, stage, run_id })` only with an actual executed runner result. Bare GREEN, foreign run/stage, a reduced roster or a stale fingerprint yields `APPLIED_PENDING_TESTS`, never `PASS_COMPLETE`. Preserve `REGRESSION_DETECTED` / `PARTIAL_CONFLICT` / `ANALYSIS_ONLY` and exact applied paths. Write report, structured JSON, raw sanitized events, true unified diff and SHA-256 manifest to the approved artifact directory. `PASS_COMPLETE` is coverage accounting, not merge approval. Stop for external review.
