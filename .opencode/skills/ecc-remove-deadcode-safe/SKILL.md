---
name: ecc-remove-deadcode-safe
description: ECC-managed, Git-safe dead-code analysis pass used by /refactor-clean pass A. Load into the code-simplifier child before candidate analysis; never performs Git mutation or parent-side edits.
metadata:
  origin: ECC
  license: SUL-1.0-derived
---

# ECC Safe remove-deadcode (pass A)

> MODIFIED COPY NOTICE: adapted from `remove-deadcode` by the oh-my-openagent project, licensed under the Sustainable Use License 1.0. Internal/non-commercial use only. All Git-mutation, network-install and unbounded parallel-fanout instructions from the original were removed. The original SUL terms must accompany any copy. See `SUL-LICENSE.md` beside this file.

## Role

You are the **dead-code analysis** pass inside the existing `code-simplifier` child. You propose candidates; you do **not** own the write boundary.

## Hard rules

1. Never run `git add`, `commit`, `reset`, `checkout`, `restore`, `revert`, `clean`, `switch`, `stash`, branch/tag writes or `update-index`. Guardian Angel protects `.git`; do not bypass it.
2. Never install tools from the network. Use locally available analyzers only; missing tooling is `NOT_AVAILABLE`.
3. Do not spawn unbounded parallel agents. Optional read-only `explore` scouts only.
4. A zero-reference result is supporting evidence, not deletion authorization. Dynamic imports, string registries, barrels, `package.json` exports, tests, entry points and framework conventions are consumers.
5. Classify each candidate `EDIT`/`KEEP`/`DEFER` with reference evidence, behavior evidence, risk and ownership. Tests and mocks are consumers: `KEEP`.
6. For an `EDIT` candidate, apply only through the guarded `applyHunks()` helper with exact unique before→after bytes, an explicit authorized path inside the frozen scope, and a fresh snapshot check. Never bypass it with native unscoped write/shell tools. The helper detects drift but is not OS-level isolation (`CONCURRENT_WRITER_NOT_GUARANTEED`). On any conflict or failed post-pass test, report truthfully; never fabricate a parent-side edit or receipt.

## Detection (supporting evidence only)

- Local `tsc --noEmit --noUnusedLocals`, knip/depcheck/ts-prune if already installed.
- Grep every symbol including dynamic forms (`import()`, `require()`, string keys, route/manifest names).

## Output

One fenced JSON receipt with `pass=remove-deadcode`, skill id/path/sha, your real `OPENCODE_SESSION_ID`, candidate roster and `actual_result` of `COMPLETE` or `NO_CANDIDATES`.
