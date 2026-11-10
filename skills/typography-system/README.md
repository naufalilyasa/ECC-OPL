# Typography System

Picking fonts for a real product is harder than it looks. You can spend an afternoon on Google Fonts, like two faces in isolation, and still end up with a site that feels generic — or worse, a headline that fights the paragraph, labels that disappear, and a body that falls apart at the width you actually ship.

This is an **experimental agent skill**. Drop the folder into a tool that loads Agent Skills (`SKILL.md`). The agent then chooses and applies **font pairings as a small system**: display, body, and UI, matched to the kind of work you are making.

It is built for **Cursor, Claude Code, Antigravity, and Codex**. Other coding agents that follow the same `SKILL.md` folder convention can use it the same way. A normal chat bot (ChatGPT’s website, a random Slack bot) will not pick this folder up by itself — you would have to paste the files or point that product at a skills directory.

It is a project by [Vamsi Batchu](https://x.com/vamsibatchuk). It is not a ranking of the “best fonts,” and it will not replace your eye. It is a considered starting point for people who keep hitting the same wall.

## The problem

Most pairing advice is a moodboard. “Serif plus sans.” A screenshot of a poster. A list of trendy families with no job assigned to each one.

When you sit down to typeset a dashboard, a journal, a shop, or docs in more than one language, you need different answers:

- What is the reader trying to do?
- Which face carries the long paragraph?
- Which face runs the buttons, prices, and navigation?
- How many families is too many?
- Will this still read in a narrow card, in Hindi, or when the webfont fails?

Agents without this skill often invent a fashionable pairing, load too many weights, or change the brand when you only asked for clearer hierarchy.

## What this skill does

It gives the agent a **curated library of 30 recipes** across editorial, product, commerce, hospitality, education, science, and multilingual work — plus instructions for using them on *your* copy, not a dummy pangram.

Each recipe assigns families to roles (display, body, UI, and code when it matters), with weights checked against a pinned Google Fonts catalog. The agent is told to:

1. Look at the actual product and copy first.
2. Pick a direction from context, not from fashion.
3. Preview the pairing in real interface shapes.
4. Load only what you use.
5. Leave brand, behavior, and unrelated layout alone unless you ask for more.

Forty-seven families. Thirty systems. Design judgments with source notes — not a scientific leaderboard.

## How it is made

The skill is a portable folder, not an app and not tied to one vendor:

- `SKILL.md` — how any compatible agent should think, and what it must not invent
- `AGENTS.md` — a short pointer so hosts that look for that filename still find the skill
- `references/pairings.json` and `pairings.md` — the recipes and when to reach for them
- `references/font-catalog.json` — verified family metadata at a pinned Google Fonts revision
- `references/` memos — selection, hierarchy, loading, and scripts beyond Latin
- `scripts/` — Python tools to list recipes, validate roles, and build a Google Fonts CSS URL (no API key)
- `agents/openai.yaml` — optional Codex label; the instructions still live in `SKILL.md`

Recipes were chosen as starting points for real contexts. Weights and axes are validated against catalog metadata. Live rendering, glyph coverage, and whether a pairing is *right for your product* still need your review.

## Install

Clone or download this repo. Keep the folder named `typography-system`, with `SKILL.md` next to `references/`, `scripts/`, `assets/`, and `agents/`. Copy that whole folder into your tool’s skills directory.

**Cursor** — `~/.cursor/skills/typography-system/` (all projects) or `.cursor/skills/typography-system/` (this project).

**Claude Code** — `~/.claude/skills/typography-system/` (all projects) or `.claude/skills/typography-system/` (this project).

**Antigravity** — `~/.gemini/antigravity/skills/typography-system/` (all workspaces) or `.agents/skills/typography-system/` (this workspace).

**Codex** — `~/.codex/skills/typography-system/` and invoke `$typography-system` when you want it by name.

**Other coding agents** — if that tool’s docs say “put a skill folder with `SKILL.md` here,” use that path. Same files. If it has no skills folder, this package will not auto-load.

Then ask the agent to improve typography, pair fonts, or audit hierarchy. You do not need a special slash command in every host; a clear prompt is enough.

### Example prompts

- “Use the typography-system skill to improve this dashboard’s hierarchy and readability while preserving its brand.”
- “Use the typography-system skill to compare three Google Fonts directions for this independent bookstore, using my actual copy.”
- “Use the typography-system skill to create a typography system for English, Japanese, and Hindi documentation.”

In Codex you can say `$typography-system` instead of “the typography-system skill.”

## Tools (optional)

```sh
python3 scripts/font_tools.py list --context editorial
python3 scripts/font_tools.py family 'Fraunces'
python3 scripts/font_tools.py css --recipe source-editorial
python3 scripts/font_tools.py validate
```

See `references/tooling.md`.

## A note from the author

This is an experimental project, made to help people who care about type but do not want another infinite scroll of “best font pairings.” If it gets you to a clearer paragraph and a calmer UI, it did its job.

— [Vamsi Batchu](https://x.com/vamsibatchuk)

Google Fonts families have their own licenses. The catalog links to each family’s license. Font files are not bundled here. Always check the typeset page with the real content.
