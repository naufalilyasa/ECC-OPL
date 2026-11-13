---
description: Map every route and user flow in the project to TEST-ID registry entries, then hand a per-flow checklist to /e2e without generating tests
argument-hint: "[path or route scope, e.g. 'app/', 'src/pages', or a single route]"
---

# E2E Route & Flow Map Command

You inventory routes, turn them into user flows, and reconcile them against the project's `TESTS.md` registry. You do NOT write Playwright tests — `/e2e` does that.

**User Arguments**: $ARGUMENTS

## Skills and agents to load

| Need | Load |
|---|---|
| Registry format and TEST-ID ownership | `skill(id: "test-collaboration")` — if unavailable, use the row formats embedded below |
| Flow, selector, and artifact conventions | `skill(id: "e2e-testing")` |
| Large repo or unknown layout | `subagent(agent="explore")` for route discovery |
| A flow whose state is hard to trace | `skill(id: "click-path-audit")` — optional, step 4 only |

Do not dispatch `e2e-runner`. It belongs to `/e2e`.

## Step 0 — Scope

Project root = current working directory. If `$ARGUMENTS` names a path or route, restrict to it. If the repo has no router file and no route directory, stop and report — never invent routes.

## Step 1 — Discover routes by stack

Read files only; no browser, no crawl. Run every detector that applies and report which matched, with a count.

| Stack | Source |
|---|---|
| Next.js App Router | `{app,src/app}/**/page.{ts,tsx,js,jsx}`; skip `route.ts` (API) unless asked |
| Next.js Pages | `{pages,src/pages}/**/*.{ts,tsx,js,jsx}`; skip `_app`, `_document`, `api/` |
| Astro | `src/pages/**/*.{astro,md,mdx}` |
| SvelteKit | `src/routes/**/+page.svelte` |
| Nuxt | `{pages,src/pages,app/pages}/**/*.vue` |
| Vue Router | `createRouter({ routes: [...] })`, `<Route path>` |
| React Router | `createBrowserRouter`, `<Route path>`, `path:` |
| Laravel | `routes/web.php`, `routes/api.php` |
| Yii2 | `config/web.php` `urlManager` rules + controller action names |
| Express / Fastify / Hono | grep `\.(get|post|put|patch|delete)\(['"]/` |

If no detector matches, report the directories you scanned and ask for the router entry point.

## Step 2 — Classify each route

For every route record: path, source file, static or dynamic (`[id]`, `:id`, `{id}`, `[...slug]`), public or authenticated (layout, guard, or middleware signal), has mutation (POST/PUT/PATCH/DELETE handler or form action), and locale variants.

Collapse i18n mirrors (`en/`, `id/`, `[locale]/`) into ONE flow with a locale parameter. Never list the same page twice per locale.

## Step 3 — Group routes into flows

A flow is a user journey, not a URL: `list → detail → edit`, `login → dashboard`, `cart → checkout → confirmation`. Name each flow in the project's own words. Mark flows that touch money, auth, or destructive actions as `critical path`.

## Step 4 — Reconcile with TESTS.md

Read `TESTS.md` at the repo root (or the path from `.governance/docs-map.json`). If `TESTS.md` does not exist, treat every discovered flow as `unmapped` (`covered` and `stale` are empty) and include creating `TESTS.md` in the proposal. Build three lists:

- `covered` — flow already has a TEST-ID
- `unmapped` — route exists, no TEST-ID
- `stale` — TEST-ID references a route that no longer exists

For a flow whose state is hard to follow, load `click-path-audit` to trace it before proposing rows.

## Step 5 — Propose registry rows

Section 2 of `TESTS.md` — one row per module or workflow:

| Module or workflow | Level | Purpose | Execution group | External dependencies | Test location | Assessment |
|---|---|---|---|---|---|---|
| `<flow name>` | E2E | critical path | specialized E2E | `<auth / payment sandbox / none>` | `tests/e2e/<slug>/` | missing |

Section 4 of `TESTS.md` — one block per required test point. ID format `TEST-E2E-NNN`: continue from the highest existing `TEST-E2E-NNN` in the registry, or start at `001` when none exist.

```markdown
### TEST-E2E-001 — <flow name>

- State: missing
- Purpose: critical path
- Source: route map, <path:line>
- Representative input: <starting route + the one action that matters>
- Observable expectation: <what the user sees when it works>
- Level: E2E
- Execution group: specialized E2E
- Boundary: browser against the running app; no mocked backend
- Test file: TODO
- Test node: TODO
- Command: `/e2e <flow name>`
- Evidence: TODO
```

Also produce the handoff checklist — one line per flow, ready to feed `/e2e`:

```
- [ ] <flow name> — start at /<route>, expect <outcome> — priority <critical|normal>
```

## Step 6 — Report, then write on approval

Print: detector table, route count, flow count, `covered` / `unmapped` / `stale` counts, and the three highest-value gaps.

Then stop. Write to `TESTS.md` only after explicit approval. Never delete or renumber existing TEST-IDs; only append, and mark stale ones `stale`.

## Rules

- Read-only until approval.
- `/e2e-map` maps; `/e2e` executes. Never generate Playwright specs here.
- `TESTS.md` is the only registry. Never create a second route list.
- Report what you did not detect instead of guessing.
