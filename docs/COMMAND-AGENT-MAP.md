# Command → Agent / Skill Map

This document lists each slash command and the primary agent(s) or skills it invokes, plus notable direct-invoke agents. Use it to discover which commands use which agents and to keep refactoring consistent.

| Command | Primary agent(s) | Notes |
|---------|------------------|--------|
| `/plan` | planner | Implementation planning before code; hands off to `tdd-workflow` and `plan-reviewer` |
| `/plan-prd` | planner | Lean PRD before planning |
| `/plan-canvas` | — (skill: plan-canvas) | Browser review canvas for plan artifacts: annotate, chat, approve/request changes |
| `/design-build` | — (skills: design-build, design-contract-system) | Section-by-section build with an owner approval loop |
| `/typography` | — (skill: typography-system) | Type contract for design-build |
| `/tdd` | tdd-guide | Test-driven development |
| `/code-review-quick` | code-reviewer | Quality and security review |
| `/refactor-clean` | refactor-cleaner | Dead code removal |
| `/e2e` | e2e-runner | Playwright E2E tests and the coverage map |
| `/deep-research` | — (skill: deep-research) | Cited research reports |
| `/security-audit` | security-reviewer, security-hunter, security-verifier | Six-phase adversarial audit |
| `/update-docs` | doc-updater | Documentation sync and codemaps |
| `/verify` | — (skill: verification-loop) | Six-phase verification; carries the UWW work-item binding block |

## Non-Slash CLI Surfaces

| CLI surface | Primary skill/runtime | Notes |
|-------------|-----------------------|-------|
| `ecc memory init` | unified-memory / `scripts/memory.js` | Initialize project, team, or user Markdown vault scopes |
| `ecc memory save` | unified-memory / `scripts/memory.js` | Create unreviewed memory; body must come from stdin or a regular file |
| `ecc memory handoff` | unified-memory / `scripts/memory.js` | Create a targeted, cross-harness handoff |
| `ecc memory search` | unified-memory / `scripts/memory.js` | Bounded lexical search over selected vault scopes |
| `ecc memory read` | unified-memory / `scripts/memory.js` | Read one memory plus derived backlinks |
| `ecc memory doctor` | unified-memory / `scripts/memory.js` | Audit malformed files, duplicate IDs, broken links, and symlinks |
| `ecc-memory-mcp` | unified-memory / `scripts/memory-mcp.mjs` | Optional stdio MCP adapter; exposes save/search/read/doctor only |

## Direct-Use Agents

| Direct agent | Purpose | Scope | Notes |
|--------------|---------|-------|-------|
| `typescript-reviewer` | TypeScript/JavaScript code review | TypeScript/JavaScript projects | Invoke the agent directly when a review needs TS/JS-specific findings and there is no dedicated slash command yet. |

## Skills referenced by commands

- **tdd-workflow**: `/tdd`; also the implementation step reached from `/plan`
- **plan-canvas**: `/plan-canvas`; approval gate inside `/design-build`
- **design-build**, **design-contract-system**: `/design-build`
- **typography-system**: `/typography`
- **deep-research**: `/deep-research`
- **verification-loop**: `/verify`
- **continuous-learning-v2**, **eval-harness**, **skill-host-compat**: no slash entrypoint; invoke the skill directly
- **strategic-compact**: suggested at compaction points (hooks)
- **unified-memory**: `ecc memory ...` and the opt-in `ecc-memory-mcp` server

## Direct-Use Skills

| Skill | Purpose | Entry point |
|-------|---------|-------------|
| [osint-investigation](../skills/osint-investigation/SKILL.md) | Public-source investigation methodology: competing hypotheses, falsification, visual verification, and evidence tracking | Invoke the self-contained skill directly using available host capabilities. |

## How to use this map

- **Discoverability:** Find which command triggers which agent (e.g. “use `/code-review` for code-reviewer”).
- **Refactoring:** When renaming or removing an agent, search this doc and the command files for references.
- **CI/docs:** The catalog script (`node scripts/ci/catalog.js`) outputs agent/command/skill counts; this map complements it with command–agent relationships.
