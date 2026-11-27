---
description: Entry point for deep research. Loads the canonical deep-research skill and supplies host adapters — the methodology lives in the skill, not here.
argument-hint: "<research-topic or question>"
---

# /deep-research

This command is an **entry point**, not a second methodology. The workflow —
grounding, clarify gate, plan, collection, evidence standard, gap register,
adversarial pass, report contract, prose policy, delivery — lives in the
`deep-research` skill and nowhere else.

## 1. Load the skill

Call the `skill` tool with `id: "deep-research"`.

- If the skill is available: follow it exactly. Do not paraphrase it from memory
  and do not add steps it does not contain.
- If it is not available: stop and report a configuration blocker — name the
  missing skill and the roots you checked. Do not run a remembered workflow.

## 2. Topic

The user's topic is the text appended after this file by the command template.
It may span multiple lines. Treat it as the complete query, once.

This file contains no argument placeholder, so the topic is not duplicated. Do
not re-read or re-expand an argument here.

## 3. Host adapters

Facts about this runtime that the skill cannot know. Everything else comes from
the skill.

| Capability | State in this environment |
|---|---|
| `explore` subagent | available; read-only + bash; foreground (blocks until it returns) |
| `docs-lookup` subagent | available; library/API docs via Context7 |
| `web_search_exa`, `web_fetch_exa` | available |
| `context7`, `grep_app`, `webfetch` | available |
| `firecrawl_*` | **not configured — do not call** |
| `humanizer-lint` | `node ~/.config/opencode/skills/humanizer-lint/scripts/analyze.mjs --stdin --lang auto --json` — advisory only |

If a capability the skill asks for is missing, record it as a limitation and
continue with what exists.

## 4. Boundary

Research only. Do not change application code, dependencies, or configuration as
part of a research run. Save the report where the skill says to save it
(`docs/research/<topic-slug>.md` for an explicit `/deep-research` invocation).

**Bound work items.** When `.ecc-opl/active` names a work item (and neither
`--standalone` nor `ECC_OPL_STANDALONE=1` is set), save to
`.ecc-opl/work-items/<ITEM>/research/<topic-slug>.md` instead and append
`node <work-item helper> append --workflow deep-research --artifact research --path <report>`.
Resolve the helper across `$CLAUDE_PLUGIN_ROOT`,
`${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}`, `./.agents`, `.`,
`${CLAUDE_CONFIG_DIR:-$HOME/.claude}`. No bound item or no helper: keep
`docs/research/` — the standalone path is unchanged.

**PRD routing is deferred.** This command never writes PRDs. `/plan-prd` is not
registered in `.opencode/opencode.json`; its only body is the legacy
`commands/plan-prd.md`. Do not create `.ecc-opl/work-items/<id>/prd/` output
until that decision is made.

## 5. Hard stops

- Clarify gate: at most 2 questions.
- Search rounds: at most 2.
- Prose lint: advisory; it never blocks delivery.
- If a gap survives both rounds, report it as unverified instead of filling it.
