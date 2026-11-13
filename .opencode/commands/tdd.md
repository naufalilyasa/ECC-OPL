---
description: Enforce strict test-driven development by delegating to the tdd-guide subagent with session context
argument-hint: "[feature, function, or bug to implement test-first]"
---

# TDD Orchestration Command

You are the Lead Orchestrator handling the `/tdd` command. Your job is to gather session context and dispatch the specialized `tdd-guide` subagent to enforce the strict Red-Green-Refactor cycle.

**User Arguments**: $ARGUMENTS

## Orchestration Workflow

### 0. Arm the Workflow State (required, do this first)
Write `.opencode/workflows/active.json` before anything else, so the RED gate
survives context compression and `/aside`:

```json
{ "workflow": "tdd", "phase": "red", "steps": ["context", "RED", "implement", "GREEN", "refactor", "report"], "current": 1, "gates": { "redVerified": false } }
```

```bash
mkdir -p .opencode/workflows
cat > .opencode/workflows/active.json <<'EOF'
{ "workflow": "tdd", "phase": "red", "steps": ["context", "RED", "implement", "GREEN", "refactor", "report"], "current": 1, "gates": { "redVerified": false } }
EOF
```

The `workflow-gate` plugin reads this file and denies writes to production code
while `phase` is `red` and `redVerified` is false. It flips `redVerified`
automatically when a test command fails. Update `phase` to `green` once the
implementation passes, then `done` at the end.

Schema and rules: `workflow-state` skill.

### 1. Context Synthesis
Gather the target specification from the active session:
- **Target Feature/Function**: If `$ARGUMENTS` is provided, that is your target. If `$ARGUMENTS` is empty, extract the function, component, or bug just discussed in this session.
- **Interfaces & Types**: Include any schemas, types, or data models established in recent turns.
- **Plan Artifact**: If `docs/plans/<slug>.plan.md` exists (written by `/plan`), read it. Take each task's Acceptance and its happy + failure QA scenarios as the required test list, and its GAP rows as the behavior to prove. Do not invent a test list the plan already specifies.
- **Test Runner Context**: Detect the project test runner (npm, Bun, pnpm, Vitest, Jest, pytest, cargo test) and note it.

### 2. Dispatch TDD-Guide Subagent
Invoke the `tdd-guide` subagent with the synthesized brief:

```
subagent(agent="tdd-guide", description="TDD: <feature-or-function>")
"Implement the following feature using strict Test-Driven Development (TDD):

## Target Specification
<feature or function description with inputs, outputs, and edge cases>

## Session Context
<recent context, interfaces, and constraints from this session>

## Plan Context
Plan file: <path, or "none">
Required tests from the plan's Acceptance + QA:
- <task>: happy - <scenario>; failure - <scenario>

## Mandatory TDD Rules
1. RED: Write the failing test FIRST and verify it fails for the right reason.
2. GREEN: Write the minimal implementation to pass the test.
3. REFACTOR: Improve code cleanliness while keeping all tests passing.
4. Target 80%+ test coverage across unit and integration tests.
5. Do not write production code without an existing failing test.
6. If a plan file is supplied, every Acceptance criterion and QA scenario in it must be covered. A missing one is an unfinished task, not an optional extra."
```

### 3. Report to User
Present the test results, created test files, implementation summary, and coverage stats in the main conversation.

### 4. Close the Workflow State
Rewrite `.opencode/workflows/active.json` with `"phase": "done"` before reporting completion. A stale `red` phase keeps denying production edits in later unrelated work.
