---
description: Inventory the rules that already govern this project and report duplicates, conflicts, staleness, and unenforced rules without changing anything
argument-hint: "[optional module or path to focus on]"
---

# Rules Map Command

Read-only inventory of the rules that already govern this project. This command never writes or edits a file.

**User Arguments**: $ARGUMENTS

## Steps

### 1. Determine Scope

1. Project root: the current working directory.
2. If `$ARGUMENTS` names a module or path, focus the findings on rules that apply there, but still list global rules separately.
3. Label every source `global` (applies to all projects) or `project` (this repository only).

### 2. Collect Rule Sources

Read every source that exists. Do not invent a rule that is not written down anywhere.

| Source | What it holds |
|--------|---------------|
| `AGENTS.md`, `CLAUDE.md` (root and nested) | always-on project rules |
| `.ai-style-rules.md` | style and convention rules produced by `inherit-legacy-style` |
| `instructions[]` in `~/.config/opencode/opencode.json` | files loaded into every session |
| `rules/common/*.md` and `rules/<language>/*.md` | ECC baseline rules, only when this repository is ECC |
| `.claude/hookify.*.local.md` | mechanically enforced rules |
| `docs/adr/*` | decisions with rationale, not enforced rules |

### 3. Normalize Every Rule

For each rule record: id, statement (`MUST` / `MUST NOT` / `SHOULD`), scope, enforcement (`instruction` / `hook` / `review` / `none`), and `path:line`.

For every `.claude/hookify.*.local.md` file, read its frontmatter and record `name`, `enabled`, `event`, `action`, and either `pattern` or its `conditions`. A hook counts as enforcement only when `enabled: true`.

### 4. Report Problems

Flag only these classes, each with evidence:

- **Duplicate**: the same intent written twice in different words.
- **Conflict**: two rules that cannot both hold.
- **Stale**: the rule references a file, symbol, or command that no longer exists.
- **Unenforced**: the rule says `MUST` but no hook and no review checklist checks it.
- **Disabled hook**: a hook file exists with `enabled: false`, so its rule is documented but not enforced.
- **Orphan**: a rule with no stated reason and no owner.

### 5. Output

1. A table of every rule found: `Rule | Statement | Scope | Enforcement | Source`.
2. Counts by class (duplicate, conflict, stale, unenforced, orphan).
3. The three highest-value fixes, one line each.
4. Next step: `/rules-add` to add a rule, or the `architect` subagent when a conflict needs an architecture decision.

## Rules

- Never modify a file. This command is read-only.
- Do not report style preferences as problems. Report only the five classes above.
- Quote `path:line` for every finding so the owner can verify it.
- When the project has no written rules yet, say so plainly and point to `/rules-add` or the `inherit-legacy-style` skill.