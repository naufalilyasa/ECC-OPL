# Phase A2 Evidence — Core Workflow Projections, Agent Adaptations & Isolated Session State

- Baseline: `42fae4ebb5e995690d3a5752b461e475d229c40e`
- Sandbox: `/private/var/folders/xq/22yplbd15tz0jj4hnsr1m11c0000gp/T/antigravity/phase-a2-verification`
- Authorization: Owner ratification of A1 exit gate (`CLI_TDD_PILOT=WORKFLOW_VERIFIED`) → "yes lanjut"

## Closed gaps
- GAP-2 (core workflow projection), GAP-4 (isolated, worktree-aware session state).

## Files created / modified
- `scripts/lib/workflow-state.js` — NEW shared multi-runtime state utility (path resolution, 12h TTL, file lock, atomic swap, cross-runtime/cross-worktree clobber guards).
- `scripts/lib/install-targets/antigravity-cli.js` — `commands/` source support; `COMMAND_TO_SKILL_REMAP`; `remapCommandToSkillName`; `typography-system → opl-typography` remap; command→`.agents/skills/<name>/SKILL.md` operations with `antigravity-command-to-skill`.
- `scripts/lib/install/antigravity-agent.js` — `CANONICAL_CLI_AGENT_TOOLS` role allowlist (11 canonical agents), MCP-tool preservation, `adaptAntigravityCommandToSkill`.
- `scripts/lib/install/content-transform.js` — `antigravity-command-to-skill` transform dispatch.
- `scripts/lib/install/plan.js` — non-markdown bypass guard extended to `antigravity-command-to-skill`.
- `tests/lib/antigravity-workflow-state.test.js` — NEW 9-case contract suite.
- `tests/lib/antigravity-cli-adapter.test.js` — extended to 14 cases (core workflow projection, command→skill transform, canonical agent tool sets).

## Test evidence (all GREEN)
| Suite | Result |
|-------|--------|
| `node tests/lib/antigravity-cli-adapter.test.js` | 14 passed, 0 failed |
| `node tests/lib/antigravity-workflow-state.test.js` | 9 passed, 0 failed |
| `node tests/lib/install-targets.test.js` | 60 passed, 0 failed |
| `node tests/lib/antigravity-install-target.test.js` | 10 passed, 0 failed |
| `node tests/lib/context-carriers.test.js` | 22 passed, 0 failed |
| `node scripts/ci/validate-carrier-closure.js` | 10 projections, 5701 files, 0 escapes, 0 dynamic requires |

## Deterministic projection verification (sandbox)
- Applied 9 copy-file ops from canonical `antigravity-cli` adapter.
- Projected skills: `opl-code-review-quick`, `opl-docs-update`, `opl-refactor-clean`.
- Projected agents: `opl-planner`, `opl-code-reviewer`, `opl-code-simplifier`, `opl-doc-updater`, `opl-docs-lookup`, `opl-tdd-guide` — all `opl-` prefixed.
- `opl-code-reviewer.md`: frontmatter `name: opl-code-reviewer`; write/edit/command/subagent tools absent (read-only enforced).
- Workflow state: agy target active = `true`, OpenCode target active = `false` (isolation proven); state `target=antigravity-cli`, `ttl=43200`.

## Honest gaps
- Live `agy --print --agent opl-code-reviewer` invocation in A2 sandbox: **NOT PERFORMED** — host returned `Eligibility check failed: Your current account is not eligible for Antigravity` (account/auth environment condition). Native `.agents/agents/` discovery was already proven live in Phase A1 with the same adapter. No implementation change required; real-host acceptance remains gated on account eligibility.
- `skills/deep-research`, `skills/typography-system`, `commands/...` full-tree scaffold operations were validated at plan level (unit tests + carrier closure) but not materialized byte-for-byte in this sandbox (manual verifier applied only copy-file ops).

## Status
`PHASE_A2 = WORKFLOW_VERIFIED` (deterministic). Awaiting owner ratification before Phase A3.
