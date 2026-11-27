---
description: Create a detailed implementation plan by gathering session context and delegating to the planner subagent
argument-hint: "[optional feature or task description]"
---

# Plan Orchestration Command

You are the Lead Orchestrator handling the `/plan` command. Your job is to bridge conversation context to the specialized `planner` subagent so planning never runs blind.

**User Arguments**: $ARGUMENTS

## Binding (work-item routing)

Resolve the workspace helper, then decide bound vs standalone. Precedence:
`--standalone` > `$ECC_OPL_STANDALONE=1` > `--work-item <id>` > `.ecc-opl/active` > standalone default.

```bash
WI=""
for R in "$CLAUDE_PLUGIN_ROOT" \
         "${OPENCODE_CONFIG_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/opencode}" \
         "./.agents" "." "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"; do
  [ -n "$R" ] && [ -f "$R/scripts/lib/work-item/work-item.js" ] && { WI="$R/scripts/lib/work-item/work-item.js"; break; }
done
if [ -z "$WI" ]; then echo "work-item helper not found — running standalone (legacy paths)"; MODE=standalone
elif [ "$ECC_OPL_STANDALONE" = "1" ] || [ "${1:-}" = "--standalone" ]; then MODE=standalone
elif [ -n "$EXPLICIT_ID" ]; then ITEM=$(node "$WI" resolve --id "$EXPLICIT_ID") && MODE=bound
else ITEM=$(node "$WI" resolve); [ "$ITEM" = "none" ] && MODE=standalone || MODE=bound; fi
```

Standalone mode is byte-identical to the pre-workspace behavior: no `.ecc-opl/` writes of any kind.

## Orchestration Workflow

### 0. Arm the Workflow State (required, do this first)
Write `.opencode/workflows/active.json` so the approval gate survives context
compression and `/aside`:

```bash
mkdir -p .opencode/workflows
cat > .opencode/workflows/active.json <<'EOF'
{ "workflow": "plan", "phase": "awaiting-approval", "steps": ["context", "plan", "review", "approval"], "current": 1, "gates": { "approved": false } }
EOF
```

While `phase` is `awaiting-approval`, the `workflow-gate` plugin denies writes to
non-markdown files. Schema and rules: `workflow-state` skill.

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
5. Write the finalized plan to docs/plans/<slug>.plan.md. When the session is bound to a work item (MODE=bound), write to .ecc-opl/work-items/<ITEM>/plan/<slug>.plan.md instead and keep the legacy path untouched.
6. Include: Affected User and Ideal State (IS/GAP table), Requirements with Must have / Must NOT have, Architecture Changes, Implementation Phases with file paths and per-step References + Acceptance + happy/failure QA, Testing Strategy, Risks & Mitigations, Decisions I made for you, and Success Criteria mapped to IS rows.
7. Do NOT execute or implement any code."
```

### 3. Present & Gate
Once the `planner` subagent returns:
0. If bound: append the artifact to the record layer and point execution state at it —
   `node "$WI" append --workflow plan --artifact plan --path <plan path>` and add
   `"plan_ref": { "path": "<plan path>" }` to `.opencode/workflows/active.json`
   (additive; the rest of the schema is unchanged). If `ensure` or the append fails,
   fall back to `docs/plans/` with a one-line warning — never abort the chain.
1. Present the plan overview, intent announcement, and the path to the written `.plan.md` file to the user.
2. Direct the user to verify the plan with `plan-reviewer` (Momus) if desired.
3. Prompt for user confirmation: "Proceed with this plan? (yes/no/modify)".
4. Do NOT start implementation until the user explicitly confirms.
5. On explicit confirmation, rewrite `.opencode/workflows/active.json` with `"phase": "approved", "gates": { "approved": true }`. On decline or abandonment, set `"phase": "done"`. Never leave `awaiting-approval` armed after the user has answered — it blocks every non-markdown write.
