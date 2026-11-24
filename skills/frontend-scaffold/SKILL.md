---
name: frontend-scaffold
description: Turn a frozen design contract (DESIGN.md + docs/design/ + page CONTRACT.md) into a running frontend skeleton — project structure, wired design tokens, page shells with all 10 system states, and correct routing for image generation and animation. Use when a design-contract-system contract exists and implementation must start, or when scaffolding a new frontend that must stay consistent with an established design system.
metadata:
  origin: ECC
---

# Frontend Scaffold

Turn frozen design contracts into a running skeleton. The contract decides
*what* is built; this skill builds the smallest structure that satisfies it —
tokens wired, page shells generated, all 10 system states present, assets and
animation routed correctly.

## When to Activate

- `DESIGN.md` + `docs/design/` contracts exist (from `design-contract-system`) and implementation starts
- Scaffolding a new page or feature that must consume an existing page contract
- Adding image generation or animation to a frontend and needing the correct routing
- A skeleton exists but drifted from the contract (re-scaffold the affected files)

## Inputs (fail-closed gate)

Required on disk before any scaffolding:

1. `DESIGN.md` at project root — routing index to the 6 `docs/design/` files
2. `docs/design/TOKEN-MAP.md` + `docs/design/STATES-MATRIX.md` — the two files this skill consumes most
3. `docs/design/contracts/[FEATURE]-CONTRACT.md` for the page being built

If any is missing, STOP — run `design-contract-system` first. Never invent
tokens or states that the contract does not declare. The contract is a
read-only input; this skill generates code, it does not redesign.

> **Plans must name this skill.** A skill cannot force the harness to load it —
> an agent working from a plan file alone bypasses every phase below, including
> the Phase 5 audit gate. A plan implementing a contract-driven scaffold must
> say "execute under `frontend-scaffold`" (observed failure: a scaffold built
> from the plan alone shipped 14 contract violations under a green suite).

## Workflow

### Phase 0 — Read the Contract

Read `DESIGN.md`, then the page contract. Extract:
- Composition Spec (Section 5) — the measured per-section layout, alignment, typography, and behavior targets. Phase 5 verifies the render against these; they are not optional decoration.
- Component-to-token binding table (Section 3) — what to generate
- State matrix (Section 4) — which of the 10 states are in-scope vs `OUT_OF_SCOPE`
- Authorized roles and responsive breakpoints (1440 / 768 / 375)

### Phase 1 — Project Structure

Detect the framework before generating:

| Signal | Structure |
|--------|-----------|
| `next` in deps | Next.js App Router: `app/(group)/[feature]/page.tsx`, `loading.tsx`, `error.tsx` |
| `vite` + `react` in deps | `src/routes/[feature]/` + route-level `Suspense`/error boundaries |
| Greenfield full-stack SaaS | If a `saas-scaffolder` skill is available in your harness (operator-local, not repo-shipped), delegate the boilerplate to it, then return here for contract-driven pages |

Never mix conventions from both structures.

### Phase 2 — Wire Tokens

Copy the token architecture from `docs/design/THEME.md` into the project's
`globals.css` verbatim (both `html[data-theme="light"]` and `[data-theme="dark"]`
blocks). Rules:
- CSS custom properties are the only source of color values; components reference `var(--color-*)` or semantic Tailwind classes (`bg-surface`, `text-text-strong`)
- **Contract-driven geometry, not global regex.** Read the exact radius/spacing
  declarations from `docs/design/TOKEN-MAP.md` + the page contract. A declared
  `rounded-md -> 6px` mapping or an approved `gap-6px` is valid even if a
  global class-name regex would flag it; an undeclared value is still rejected.
- Spacing/radius is whatever the contract declares (e.g. a declared 6px gap or
  a custom tier); do not assume a 4px-only grid or a fixed 3-tier radius set.
- Metrics and money: follow the contract's typography declaration; never invent
  a `font-mono` override if the contract says `tabular-nums`.
- A token missing from the contract is a contract gap, not a license to invent —
  flag it and stop. Frontend-scaffold **consumes** design decisions; it must not
  emit competing visual defaults of its own.

### Phase 3 — Generate Page Shells

For each row of the contract's component table, generate one component file.
For each state the page contract marks applicable to this view, generate its component.
States marked not-applicable are omitted, not forced onto every view.
Canonical 10 states (names match `page-contract.md`):

1. `Loading Skeleton` — aspect-ratio-matched skeleton grid
2. `Empty State` — first-run graphic + primary onboarding action
3. `No Search Result` — "clear filters" secondary state
4. `Error State` — component-level retry + human-readable message
5. `No Internet` — offline banner + cached-data timestamp
6. `Slow Network` — stale-data indicator without unmounting content
7. `Permission Denied` — access-restricted card
8. `Session Expired` — re-auth dialog trigger
9. `Form Validation` — inline field errors + border tokens
10. `Success State` — ephemeral toast/confirmation

States the contract marks `OUT_OF_SCOPE` are NOT generated — implement only
what the view actually has (e.g. a read-only dashboard skips Form Validation).
Data fetching uses `useQuery`-style hooks with explicit loading/error branches
(`frontend-patterns`); every branch renders a state component, never a bare
spinner.

### Phase 4 — Route Assets & Animation

**Image generation** (default path — no new keys):
- Use the harness tool `experimental_image_generate`
- Available models (catalog, all `cloudflare-workers-ai`): `@cf/black-forest-labs/flux-2-klein-9b` (general/UI reference), `@cf/leonardo/lucid-origin` and `@cf/leonardo/phoenix-1.0` (artistic/illustrative), `@cf/bytedance/stable-diffusion-xl-lightning` (fast drafts)
- Direction skills `imagegen-frontend-web` / `imagegen-frontend-mobile` (operator-local, not repo-shipped) govern prompt composition when available: one image per section, composition variety, single palette. If absent, compose prompts directly with those rules
- Verify output with `multimodal-looker`; save accepted images into the repo (`assets/` or `public/`) — the experimental tool is not a production CDN
- Programmatic/batch generation (fal.ai, OpenAI, Google AI Studio) is a separate opt-in requiring an owner-supplied key — not part of the default path

**Animation routing — by deliverable, not by preference:**

| Deliverable | Tool | Skill |
|-------------|------|-------|
| In-app UI animation (enter/exit, gestures, layout, scroll-linked) | `motion/react` | `motion-foundations` → `motion-patterns` → `motion-advanced` |
| Rendered video file (MP4 — demos, social, hero loops) | Remotion | `remotion-video-creation` |
| Presentation decks | — | `frontend-slides` |

Default is `motion/react`: hardware-accelerated, MIT license, 60/120fps while
the JS thread is busy. Reach for Remotion only when the deliverable is a video
file. GSAP is not recommended for general use (Webflow-owned license, banned
in Webflow competitors).

### Phase 5 — Audit Gate (canonical audit file, contract-owned)

Do NOT write your own audit test and do NOT audit only the staged diff — a
diff-scoped grep misses files committed earlier in the same session, and a
self-written audit is how contracts get quietly weakened (observed failure:
an agent whitelisted its own `rounded-md` output and dropped the spacing
check entirely, shipping 14 violations under a green suite).

**Write the canonical audit file into the project** so it runs in `npm test`
and CI, then make the code pass it:

`tests/design-contract-audit.test.js` (adapt the runner block to the project's
test framework; the rules below are the contract):

```js
// Contract-owned: rules mirror docs/design/STANDARDS.md + the page contract.
// Weakening these rules to make output pass is itself a contract violation.
// Contract-owned: parse declared values from TOKEN-MAP.md / page contract.
// A declared 6px gap or approved rounded-md mapping MUST pass; undeclared
// arbitrary geometry MUST fail. No hardcoded tier/shape list.
const CONTRACT = loadContract(); // { declaredSpacing:[...], declaredRadius:[...], states:[...] }
const declaredSpacing = (v) => CONTRACT.declaredSpacing.includes(v);
const declaredRadius = (v) => CONTRACT.declaredRadius.includes(v);
const rawGeometry = (cls) => /(?:gap|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr)-\[([^\]]+)\]/.exec(cls)?.[1];
const rawRadius = (cls) => /rounded-\[([^\]]+)\]/.exec(cls)?.[1];

it('audit rules must stay canonical (self-check)', () => {
  assert.ok(!declaredSpacing('7px') && !declaredRadius('7px'), 'undeclared geometry must be rejected');
  assert.ok(rawGeometry('gap-[7px]') === '7px', 'arbitrary parser must extract value');
});

// Immutable project fixture: 6px is ALREADY declared in the approved TOKEN-MAP.
// Never insert candidate values into the contract to manufacture a pass.
const APPROVED = loadContractFixture('docs/design/TOKEN-MAP.md'); // 6px already declared
assert.ok(APPROVED.declaredSpacing.includes('6px'), 'fixture must contain approved 6px');
const UNDECLARED = loadContractFixture('docs/design/TOKEN-MAP.md'); // 7px not declared
assert.ok(!UNDECLARED.declaredSpacing.includes('7px'), '7px undeclared in THIS project');

// EXAMPLE only (not an executed assertion): it('zero arbitrary hex', () => assertNoRawHex());
it('radius matches the Contract Section 3 declared tiers/values', () => {
  // Parse declared radius from the contract (e.g. 6px rounded-md, or taste
  // 4/6/8, 8/12/16, 8/12/20). Only undeclared arbitrary values are violations.
});
it('spacing matches the Contract Section 3 declared grid', () => {
  // Parse the declared spacing grid from the contract. Declared 6px gaps or
  // other non-4px values are valid; arbitrary undeclared geometry is not.
});
```

Rules for this file:

1. **Whitelist explicitly, by exact value** — every arbitrary geometry value the
   page contract approves (hero heights, card heights, focus-ring width, and any
   declared radius such as `rounded-md -> 6px`) is stripped before the
   arbitrary-value check. Never whitelist by prefix (`min-h-[` would excuse
   `min-h-[1px]`). When the resolved `rounded-md` value is explicitly approved in
   the contract, it is valid — do not prohibit the class by name.
2. **The self-check test is mandatory** — it crashes the suite if any rule is
   weakened, which is what makes the audit tamper-evident.
3. **Fixing means changing the code, not the rules** — if the audit flags
   something the contract genuinely allows, add the exact value to the
   whitelist AND cite the contract section in a comment.

Then verify every in-scope state from the contract's Section 4 has a component,
and every generated component consumes tokens (no raw colors anywhere).

**Composition fidelity gate (separate layer, not optional).** The audit file above
proves token compliance; it says nothing about whether the page looks like the
reference. Run `references/fidelity-checklist.md`: dev server, capture at
1440 / 768 / 375, dispatch `multimodal-looker` with the reference plus the screenshots
against the contract's Section 5, and record PASS / FAIL per section row. Fix the
render, not the checklist. This gate is a measured checklist, never a pixel diff.

The canonical `design-contract-system` Phase 4 greps (hex / radius / spacing)
remain valid as a quick manual pre-check, but the file above is the enforced
gate — greps on a staged diff are not.

## Anti-Patterns

- **Inventing tokens**: a color/spacing value that is not in `TOKEN-MAP.md`/`THEME.md` — flag the contract gap instead
- **Happy-path shells**: page components without their state components — the single most common scaffold failure
- **Wrong animation tool**: Remotion for a hover animation, or `motion/react` for a rendered marketing video
- **Contract drift**: regenerating a page by hand after the contract changed — re-scaffold from the contract
- **Skipping the audit gate**: the canonical audit file exists because hex/radius/spacing violations are invisible in review screenshots
- **Writing your own audit test** (self-approval): a hand-rolled test that whitelists the output it was meant to check — the observed real-world failure. Only the canonical audit file (Phase 5), contract-owned, with the self-check test
- **Token-green, composition-drift**: treating a passing token audit as visual fidelity — the observed real-world failure (8 composition complaints under a 19/19 green token audit).
- **Treating the image tool as production storage**: generated images must land in the repo

## Related Skills

- `design-contract-system` — upstream: produces the contracts this skill consumes
- `frontend-patterns` — component composition, hooks, data fetching
- `a11y` — WCAG 2.2 AA: contrast, keyboard, screen-reader semantics on every state component
- `frontend-design-direction` — aesthetic direction when no contract exists yet
- `motion-foundations` / `motion-patterns` / `motion-advanced` — in-app animation
- `remotion-video-creation` — video-file deliverables
- `imagegen-frontend-web` / `imagegen-frontend-mobile` — image direction (operator-local, when present in the harness)
- `multimodal-looker` — dispatch this subagent to visually verify generated assets (it is an agent, not a skill)
- `saas-scaffolder` — operator-local full-stack boilerplate skill, when present in the harness
