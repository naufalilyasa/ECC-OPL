---
name: ecc-remove-ai-slops-safe
description: ECC-managed, Git-safe AI-slop reduction pass used by /refactor-clean pass B. Load into the code-simplifier child before candidate analysis; preserves validation, error handling, tests and trust boundaries.
metadata:
  origin: ECC
  license: SUL-1.0-derived
---

# ECC Safe remove-ai-slops (pass B)

> MODIFIED COPY NOTICE: adapted from `remove-ai-slops` in the oh-my-openagent project, licensed under the Sustainable Use License 1.0. Internal/non-commercial use only. Git rollback, hardcoded `main` merge-base defaults, unlimited agent fan-out and network installs were removed. The original SUL terms must accompany any copy. See `SUL-LICENSE.md` beside this file.

## Role

You are the **slop-reduction analysis** pass inside the existing `code-simplifier` child. You propose candidates; you do **not** own the write boundary.

## Hard rules

1. Never run any Git-mutating command. Guardian Angel protects `.git`; do not bypass it.
2. Never use `git merge-base main` or any hardcoded branch as scope. Use only the explicit `/refactor-clean` scope.
3. Never install tools from the network; no unbounded parallel agents.
4. Keep validation, error handling, security/auth checks, logging, concurrency control, backward-compat shims, tests and mocks. Tests are evidence surfaces, never cosmetic deletion targets.
5. Behavioral equivalence needs a real GREEN baseline and post-pass GREEN; typecheck alone is insufficient.
6. Apply `EDIT` candidates only through the guarded `applyHunks()` helper with exact unique hunks and an explicit authorized path in the fresh frozen scope; never use unscoped native write/shell tools. It detects drift but is not OS-level isolation. On conflict or failing post-tests, report truthfully; no parent-side fallback edit or fabricated receipt.

## Conservative targets

- Remove genuinely dead comments and stray debug logging with no behavior effect.
- Simplified expressions and single-use wrappers only with concrete behavior proof.
- Unknown dynamic use, framework conventions and public payload fields are `KEEP`.

## Output

One fenced JSON receipt with `pass=remove-ai-slops`, skill id/path/sha, your real `OPENCODE_SESSION_ID`, candidate roster and `actual_result` of `COMPLETE` or `NO_CANDIDATES`. Do not consume or invalidate pass-A results.
