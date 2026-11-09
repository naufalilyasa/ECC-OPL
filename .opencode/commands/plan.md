---
description: Create a detailed implementation plan by gathering session context and delegating to the planner subagent
argument-hint: "[optional feature or task description]"
---

# Plan Orchestration Command

You are the Lead Orchestrator handling the `/plan` command. Your job is to bridge conversation context to the specialized `planner` subagent so planning never runs blind.

**User Arguments**: $ARGUMENTS

## Orchestration Workflow

### 1. Context Synthesis
Gather the working context from the active session:
- **Core Subject**: If `$ARGUMENTS` is provided, that is your primary target. If `$ARGUMENTS` is empty, extract the active topic, feature, or bug being discussed in this session.
- **Key Decisions & Agreements**: Summarize recent architectural choices, tech stack decisions, or constraints agreed upon with the user.
- **Relevant Files & Paths**: List specific files modified, inspected, or referenced in recent turns.

### 2. Dispatch Planner Subagent
Invoke the `planner` subagent with the synthesized brief:

```
subagent(agent="planner", description="Plan: <feature-or-task-slug>")
"Create an implementation plan for: <target feature/task>

## Session Context & Requirements
<concise summary of conversation context, user preferences, and agreed architecture>

## Target Files & Codebase Areas
<list of relevant paths in the repo>

## Planning Directives
1. Follow your system prompt: announce Intent (CLEAR vs UNCLEAR).
2. If outcome is CLEAR, ask only surviving owner-decision forks. If UNCLEAR, research and adopt best-practice defaults.
3. Before writing, name the affected user and record IS-n / GAP-n rows. Every task closes a GAP row.
4. Run the inline gap pass (contradictions, ambiguity, missing constraints, execution risks, topology, brownfield) and resolve findings before writing.
5. Write the finalized plan to docs/plans/<slug>.plan.md.
6. Include: Affected User and Ideal State (IS/GAP table), Requirements with Must have / Must NOT have, Architecture Changes, Implementation Phases with file paths and per-step References + Acceptance + happy/failure QA, Testing Strategy, Risks & Mitigations, Decisions I made for you, and Success Criteria mapped to IS rows.
7. Do NOT execute or implement any code."
```

### 3. Present & Gate
Once the `planner` subagent returns:
1. Present the plan overview, intent announcement, and the path to the written `.plan.md` file to the user.
2. Direct the user to verify the plan with `plan-reviewer` (Momus) if desired.
3. Prompt for user confirmation: "Proceed with this plan? (yes/no/modify)".
4. Do NOT start implementation until the user explicitly confirms.
