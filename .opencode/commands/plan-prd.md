---
description: "Generate a lean, problem-first PRD and hand off to /plan for implementation planning."
argument-hint: "[product/feature idea] (blank = start with questions)"
---

# PRD Command

OpenCode projection of the canonical `commands/plan-prd.md`. Produces a **Product Requirements
Document** — the requirements-phase artifact: *what* must be true for success and *why*. It stops
before *how*; decomposition belongs to `/plan`.

**Input**: `$ARGUMENTS`

| This command does | This command does NOT do |
|---|---|
| Frame the problem and users | Design the architecture |
| Capture success criteria and scope | Pick files or write patterns |
| List open questions and risks | Enumerate implementation tasks |
| Write the PRD into the work item's `prd/` | Produce an implementation plan — that is `/plan` |

**Anti-fluff rule**: when information is missing, write `TBD — needs validation via {method}`.
Never invent plausible-sounding requirements.

## Binding (work-item routing)

```bash
WI=""
for R in "$CLAUDE_PLUGIN_ROOT" \
         "${OPENCODE_CONFIG_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/opencode}" \
         "./.agents" "." "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"; do
  [ -n "$R" ] && [ -f "$R/scripts/lib/work-item/work-item.js" ] && { WI="$R/scripts/lib/work-item/work-item.js"; break; }
done
# TASK_SLUG is this task's identity, not the last active pointer.
TASK_SLUG="<kebab-slug-of-this-task>"
if [ -z "$WI" ]; then echo "work-item helper not found — running standalone (legacy paths)"; MODE=standalone
elif [ "$ECC_OPL_STANDALONE" = "1" ] || [ "${1:-}" = "--standalone" ]; then echo "legacy paths (explicit opt-out)"; MODE=standalone
elif [ -n "$EXPLICIT_ID" ]; then ITEM=$(node "$WI" bind --id "$EXPLICIT_ID") || exit 1; MODE=bound
else ITEM=$(node "$WI" bind --slug "$TASK_SLUG") || exit 1; MODE=bound; fi
[ "$MODE" = "bound" ] && echo "bound: $ITEM -> .ecc-opl/work-items/$ITEM"
```

`PRD_DIR` is `.ecc-opl/work-items/<ITEM>/prd` when bound, `.claude/prds` under the explicit
opt-outs. A missing pointer is not an opt-out.

## Workflow

Four phases. Each is a single gate: ask, wait for the owner, then move on. No nested loops.

### Phase 1 — FRAME

If `$ARGUMENTS` is empty, ask: *What do you want to build? One or two sentences.*

If provided, restate in one sentence and ask: *I understand: {restated}. Correct, or should I adjust?*

Then ask in one set: **Who** has this problem (specific role)? **What** is the observable pain
(behaviour, not assumed needs)? **Why** can't they solve it with what exists today? **Why now** —
what changed? Wait for answers. Do not proceed without them or an explicit "skip".

### Phase 2 — GROUND

Ask: *What evidence do you have that this problem is real and worth solving?* (quotes, tickets,
metrics, observed workarounds). With none, record Evidence as
`Assumption — needs validation via {user research | analytics | prototype}`.

### Phase 3 — DECIDE

One set: **Hypothesis** (*We believe {capability} will {solve problem} for {users}. We'll know we're
right when {measurable outcome}.*), **MVP**, **Out of scope**, **Open questions**. Wait.

### Phase 4 — GENERATE & HAND OFF

```bash
mkdir -p "<PRD_DIR>"
```

Output `<PRD_DIR>/<kebab-name>.prd.md` with the sections: Problem, Evidence, Users, Hypothesis,
Success Metrics, Scope (MVP + out of scope), Delivery Milestones (business outcomes, status
`pending`), Open Questions, Risks. End the file with one status line:

```
Status: DRAFT — requirements only. Implementation planning pending via /plan.
```

The owner flips it to `Status: APPROVED` when they approve. `/plan` only consumes an `APPROVED`
PRD, or a draft the owner names explicitly.

If bound, record it:

```bash
node "$WI" append --workflow plan-prd --artifact prd --path "<PRD_DIR>/<kebab-name>.prd.md" \
  --run "<run-id>" --outcome pending_approval
```

Then `node "$WI" progress`, and re-append with `--outcome pass` once the owner approves.

## Report to user

```
PRD created: <path>

Problem:    {one line}
Hypothesis: {one line}
MVP:        {one line}

Validation status:
  Problem  {validated | assumption}
  Users    {concrete | generic — refine}
  Metrics  {defined | TBD}

Open questions: {count}

Next step: /plan
  → /plan reads the approved PRD and plans the next pending milestone.
```

## Success criteria

`PROBLEM_CLEAR`, `USER_CONCRETE`, `HYPOTHESIS_TESTABLE`, `SCOPE_BOUNDED`,
`NO_IMPLEMENTATION_DETAIL`. If file paths, libraries or task breakdowns appear, move them to `/plan`.

Background: [docs/PLAN-PRD-PATTERN.md](../../docs/PLAN-PRD-PATTERN.md).
