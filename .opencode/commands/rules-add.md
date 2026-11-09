---
description: Add or revise a project rule with owner approval - draft it, conflict-check it, then write only after explicit confirmation
argument-hint: "<the rule in plain language>"
---

# Rules Add Command

Turns a requested rule into an enforceable entry. The owner makes the final decision, and nothing is written before explicit approval.

**User Arguments**: $ARGUMENTS

## Steps

### 1. Understand the Rule

State the rule back in one sentence. If `$ARGUMENTS` is empty or ambiguous, ask exactly one question and stop.

### 2. Check What Already Exists

Run the same collection as `/rules-map`, scoped to this rule's topic. You are looking for:

- an existing rule that already covers it (then revise that rule instead of adding a duplicate),
- a rule it contradicts (resolve the conflict before writing),
- a stale reference the new rule would inherit.

### 3. Two Filters

1. Can evidence answer it? Read the code and decide. Do not ask.
2. Can a defensible default answer it? Decide and record it under "Decisions I made for you".

Ask the owner only when the choice is irreversible, cross-cutting, or a genuine product call: public config surface, data or schema shape, distribution, real budget, expected scale, compliance. Ask at most one question.

### 4. Draft the Rule

Write it in canonical form:

- **Statement**: `MUST` / `MUST NOT` / `SHOULD`, one sentence.
- **Rationale**: one line explaining what breaks without it.
- **Scope**: which paths, modules, or languages it applies to.
- **Enforcement**: `instruction` (always loaded), `hook` (blocked mechanically), or `review` (checked during review).
- **Violation example**: one short wrong/right pair.

### 5. Apply the Architect Criteria

Judge the draft before proposing it:

- **Maintainable**: one place to change; no rule that restates another rule.
- **Scalable**: still correct when new modules, languages, or services are added.
- **Reviewable**: a reviewer can tell pass from fail without judgment calls.
- **Minimal**: no rule without a real violation or a stable existing convention behind it.

Dispatch the `architect` subagent only when the rule touches cross-module boundaries, data or schema shape, a public API or config surface, or contradicts an existing always-on rule. Otherwise do not pay the latency.

### 6. Choose the Target

| Rule kind | Target |
|-----------|--------|
| Always-on project rule | `## Project Rules` in the project `AGENTS.md` |
| Detailed style or convention set | hand off to the `inherit-legacy-style` skill (`ai-style-rules.md`) |
| Must be blocked mechanically | `hookify-rules` skill |
| Cross-cutting decision with durable rationale | `architecture-decision-records` skill, plus a one-line rule in `AGENTS.md` pointing to the ADR |
| Principle recurring across many skills | `rules-distill` skill |

### 7. Emit the Machine-Checkable Form

A hook can enforce a rule only when it reduces to deterministic signals. Decide before proposing:

| Rule shape | Checkable? | Hook form |
|------------|-----------|-----------|
| Forbidden call, string, or token in matching files | Yes | `event: file`, condition on `new_text`/`content` with `contains` |
| Required import or helper in matching files | Partly | `file_path` regex plus `new_text` contains; absence still needs review |
| Forbidden path or file name | Yes | `file_path` regex |
| Forbidden shell command | Yes | `event: bash`, `pattern` |
| "Must use dependency injection" | No | instruction plus review only |

When the rule is checkable, add a Hookify file next to the human rule:

```markdown
---
name: block-<verb>-<target>
enabled: true
event: file|bash
action: block|warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: <path regex>
  - field: new_text
    operator: contains
    pattern: <forbidden text>
---

<What this protects and how to fix a violation.>
```

Rules for the emitted hook:

- File name is `.claude/hookify.<name>.local.md`. The leading dot belongs to `.claude`, not to the file name.
- Use `action: block` only for deterministic violations with no legitimate exception. Use `warn` whenever the pattern can produce a false positive.
- Keep the human explanation in `AGENTS.md`. The hook file carries the pattern and a short fix message only.
- Never emit a regex with nested quantifiers. The runtime rejects catastrophic-backtracking shapes and fails open.

Both harnesses read the same file: Claude Code through its native Hookify runtime, OpenCode through the `rules-enforcer` plugin, which delegates to `scripts/hooks/hookify-runtime.js`.

### 8. Propose, Then Wait

Show the exact file, placement, and before/after text. Ask the owner to approve. Do not write before approval. If the owner edits the wording, use their wording.

### 8. Write and Verify

After approval:

1. Write the rule to the chosen target.
2. If step 7 emitted a hook, write `.claude/hookify.<name>.local.md` too.
3. Re-read both files and confirm the rule sits in the intended section.
4. Confirm no duplicate or conflict was introduced.
5. If the rule is always-on and the harness needs registration, add its file to `instructions[]` in `~/.config/opencode/opencode.json`.
6. Report: target path, hook path (if any), rule statement, enforcement level, and what changed.

## Rules

- Owner approval is required before any write.
- One rule per invocation. Do not bundle unrelated rules.
- Never weaken an existing rule to make a new one fit. Resolve the conflict explicitly.
- Run `/rules-map` after writing to confirm the inventory is still clean.