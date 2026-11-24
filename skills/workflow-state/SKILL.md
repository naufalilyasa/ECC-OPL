---
name: workflow-state
description: Durable on-disk state for gated command workflows so dcp-compress, /aside, and long sessions cannot erase the current step. Use when a command has gated steps (plan approval, TDD RED gate, design-build section verdicts) or when a workflow step was skipped after context compression.
metadata:
  origin: ECC
---

# Workflow State

Command instructions live in the prompt. Context compression, `/aside`, and long
sessions can summarize them away, and the agent then skips a gate that was
already defined. This skill keeps the step sequence in a file on disk, where
compression cannot reach it.

## When to Activate

- Running a command that has gated steps: `/plan`, `/tdd`, `/design-build`, `/rules-add`, `/humanizer`, `/update-docs`
- Resuming work after compression, `/aside`, or a session restart
- A gate was skipped and the cause needs to be found

## State File

One active workflow per project:

```
<project>/.opencode/workflows/active.json
```

```json
{
  "workflow": "plan",
  "phase": "approved",
  "steps": ["context", "plan", "review", "approval"],
  "current": 3,
  "plan": {
    "path": "docs/plans/feature.plan.md",
    "revision": "r1",
    "sha256": "d41d8cd98f00b204e9800998ecf8427e...",
    "scope": "Milestone 1"
  },
  "review": {
    "verdict": "APPROVE",
    "reviewed_plan_sha256": "d41d8cd98f00b204e9800998ecf8427e...",
    "round": 1,
    "blockers_open": 0
  },
  "approval": {
    "status": "APPROVED",
    "approved_plan_sha256": "d41d8cd98f00b204e9800998ecf8427e..."
  },
  "gates": { "approved": true },
  "updatedAt": "2026-11-16T15:00:00.000Z"
}
```

Rules:

- `workflow` and `phase` are required; `phase: "done"` deactivates the file.
- `updatedAt` is refreshed on every write. State older than 12 hours is ignored.
- `current` is the zero-based index of the step in progress.
- `plan`, `review`, and `approval` bind the workflow state to exact plan bytes, review verdicts, and owner approvals.
- `gates` holds the booleans the command's gates read and write.

## Protocol

1. **Start** — write the file with `steps` and `current: 0` before doing any work.
2. **Each phase change** — rewrite the file with the new `phase`, `current`, and gate flags. Do it immediately, not at the end.
3. **Each gate pass** — set its flag (`redVerified`, `approved`, `sectionApproved`) in the same write.
4. **Finish or abandon** — set `phase: "done"`, or delete the file. Never leave a stale gate armed.

Writes are plain file writes; no tool or service is involved:

```bash
mkdir -p .opencode/workflows
cat > .opencode/workflows/active.json <<'EOF'
{ "workflow": "tdd", "phase": "red", "steps": ["write failing test", "RED", "implement", "GREEN", "report"], "current": 0, "gates": { "redVerified": false } }
EOF
```

## What the Runtime Enforces

The `workflow-gate` plugin re-injects this file into every prompt, so the current
step survives compression. It also denies three deterministic violations:

| Workflow | Phase | Denied | Unlock |
|----------|-------|--------|--------|
| `tdd` | `red` | write/edit to a non-test file | run a test command that fails (`redVerified` auto-set) |
| `design-build` | `section-loop` | writing section `n > current + 1` | `sectionApproved: true` for the current section |
| `plan` | `drafting`, `draft`, `review`, `awaiting-approval`, `approved` | write/edit to a non-markdown file | planning approval authorizes starting `/tdd` with verified preflight, not editing code directly in plan workflow |
| `tdd` | `red` (plan-linked) | write/edit to production code if plan hash is tampered | re-verify plan hash and obtain approval |

Guard rails that keep the gate from trapping you:

- Safe state paths stay writable: `.opencode/workflows/active.json`, `.opencode/plans/`, explicit markdown plan files, `intent-gate.log`, and `.tmp`. Wide `.opencode/` exemptions are eliminated.
- Read-only tools are never blocked; only write, edit, patch, and multiedit are. Direct shell execution (`bash`, `shell`) is a documented runtime boundary limitation.
- A test run only counts as failing when the exit code is non-zero. Text is a fallback, and `0 failed` is never treated as a failure.
- `updatedAt` falls back to the file's modification time, so an abandoned workflow still expires after 12 hours.
- In plan-linked TDD, `plan_ref` durably preserves the verified plan path, revision, SHA-256 digest, scope milestone, review verdict, and approval metadata across session compression and restarts.

## Escape Hatch

- Skip the gate for one file: record why in `note`, set the gate flag explicitly, and continue.
- Disable enforcement entirely: `OPENCODE_WORKFLOW_GATE_OFF=1`.
- Debug injection and denials: `OPENCODE_WORKFLOW_GATE_DEBUG=1`.

Never leave a gate flag set to bypass a check you did not actually run.

## Anti-Patterns

- Keeping the current step only in the conversation. Compression erases it.
- Writing the state file at the end of the workflow instead of at each transition.
- Setting a gate flag to `true` to unblock a tool call without running the check.
- Creating a second state file per command instead of updating the active one.

## Related

- `tdd-workflow` — the RED/GREEN/REFACTOR sequence this file tracks
- `design-build` — section loop with canvas verdicts
- `verification-loop` — the checks a gate should run before it is marked passed