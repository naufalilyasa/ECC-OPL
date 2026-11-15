---
name: design-contract-system
description: "Extract and generate a complete, modular, anti-slop design contract system from visual mockups, screenshots, or HTML exports. Produces root DESIGN.md routing, docs/design/ specifications (BRAND, STANDARDS, THEME, TOKEN-MAP, TYPOGRAPHY-MAP, STATES-MATRIX), and per-page CONTRACT.md files with 10 mandatory system states and Tailwind/CSS variables. Use when starting a new frontend UI, extracting design systems from visual references or AI mockups (v0, Lovable, Stitch), or standardizing UI consistency."
metadata:
  origin: ECC
---

# Design Contract System

Extract, modularize, and enforce production-grade frontend design contracts from visual references, screenshots, or HTML exports.

## When to Activate

- Translating a visual reference (v0, Lovable, Stitch, screenshot, or HTML export) into a production design system
- Starting a new web/mobile frontend that needs a coherent, non-generic visual architecture
- Enforcing strict visual consistency across multiple pages/views in an existing project
- Eliminating AI-generated design slop (gratuitous gradients, floating hex codes, inconsistent radiuses)
- Defining and standardizing the 10 mandatory system states across all views
- Creating a new page or feature contract (`docs/design/contracts/[FEATURE]-CONTRACT.md`) before writing code

## Core Architectural Principles

1. **Role-Based Tokens, Never Raw Colors**: Colors are assigned by semantic role (`text-strong`, `surface`, `primary`, `border-subtle`), never by visual hue (`bg-slate-900`) or hardcoded hex.
2. **Exactly 3 Radius Tiers**:
   - `rounded-lg` (8px): Interactive controls (buttons, inputs, select triggers, alerts).
   - `rounded-xl` (12px): Containers and panels (cards, tables, nested wells, popovers).
   - `rounded-2xl` (16px): Large overlays and dialogs (modals, sheets).
   - *Capsule exception*: `rounded-full` is reserved for status badges, avatar chips, and progress bars.
3. **Strict 4px Spacing Grid**: All spacing values must be multiples of 4px (`p-1` through `p-12`). Arbitrary numbers like `p-[13px]` are banned.
4. **Mandatory 10 System States**: Every dynamic view must implement: (1) Initial Loading Skeleton, (2) Empty State, (3) No Search Result, (4) Error State, (5) No Internet / Offline, (6) Slow Network, (7) Permission Denied, (8) Session Expired, (9) Form Validation, and (10) Success Feedback.
5. **Progressive Disclosure**: Root `DESIGN.md` serves as a lightweight routing index. Detailed specifications live in `docs/design/` so agents load only relevant documentation into context.

## Workflow

```
[Visual Reference: Screenshot / HTML]
                 │
                 ▼
   Phase 1: Ingest & Extract DNA + Composition  <── (multimodal-looker for images / DOM parsing for HTML)
                 │
                 ▼
   Phase 2: Scaffold System Core  ──→ (root DESIGN.md + 6 docs/design/*.md + globals.css)
                 │
                 ▼
   Phase 3: Scaffold Page Contract ──→ (docs/design/contracts/[FEATURE]-CONTRACT.md)
                 │
                 ▼
   Phase 4: Audit & Verification  <── (Zero hardcoded hex, radius check, 10 states audit)
```

### Phase 1: Ingest & Extract Visual DNA

1. **If given an Image / Screenshot**:
   Dispatch the `multimodal-looker` subagent to analyze the reference:
   ```
   subagent(agent="multimodal-looker", description="Extract visual DNA from screenshot")
   "Read the image at `<path-to-image>`. Extract:
   1. Visual hierarchy: containers, cards, tables, headers, sidebars.
   2. Semantic color tokens: canvas backdrop, surface cards, primary buttons, text levels, borders, badges.
   3. Typography scale: display headings, card titles, body, caption, and number styling.
   4. Spacing and geometry: card padding, grid gaps, corner radiuses.
   5. Interactive states visible.
   Format as structured markdown with estimated hex codes and functional roles."
   ```
2. **Extract the Composition Spec, not only tokens**:
   Token extraction alone produces contracts that pass audit while drifting from the
   reference. Run `references/composition-extraction.md` over the same image: per-section
   grid structure, alignment, asymmetry ratio, scroll/floating behavior, per-element
   typography (size + weight), image treatment, and the image-gen prompt spec for every
   asset the reference shows. Output lands in the page contract's Section 5.
3. **If given an HTML / CSS Export**:
   Inspect `:root`, `@theme`, and utility classes to harvest unique backgrounds, typography hierarchies, borders, and interaction states. See `references/visual-extraction.md`.

### Phase 2: Scaffold System Core Files

Generate the core design architecture using bundled templates in `templates/`:

1. `<project-root>/DESIGN.md` from `templates/root-design.md`: Routing index for agents.
2. `<project-root>/docs/design/BRAND.md` from `templates/brand.md`: Brand identity, visual atmosphere, and aesthetics.
3. `<project-root>/docs/design/STANDARDS.md` from `templates/standards.md`: The 3-tier radius rule, 4px grid, z-index ladder, and touch targets.
4. `<project-root>/docs/design/THEME.md` from `templates/theme.md`: Dual-mode token pairings (`data-theme="light|dark"`) and contrast guarantees.
5. `<project-root>/docs/design/TOKEN-MAP.md` from `templates/token-map.md`: Developer quick-reference table for semantic classes.
6. `<project-root>/docs/design/TYPOGRAPHY-MAP.md` from `templates/typography-map.md`: Font pairings and the Sans vs Mono number rule.
7. `<project-root>/docs/design/STATES-MATRIX.md` from `templates/states-matrix.md`: Standard implementation specs for all 10 system states.
8. *(Optional)* `<project-root>/docs/design/DATA-VIZ.md` from `templates/data-viz.md`: Chart namespace, structural tokens, and required chart states. Generate only when the product actually renders charts or KPI visualizations.
9. Update `globals.css` with CSS custom properties defining Light and Dark values for all semantic tokens.

Whenever the product has business statuses, apply `references/status-semantics.md` and record the enum-to-role mapping in `TOKEN-MAP.md` or the page contract.

### Phase 3: Scaffold Feature & Page Contracts

Before writing UI components for any new view or screen:

1. Create `docs/design/contracts/[FEATURE]-CONTRACT.md` using `templates/page-contract.md`.
2. Define:
   - View purpose and authorized user roles.
   - Desktop (1440px+), Tablet (768px-1024px), and Mobile (375px) responsive layouts.
   - Component-to-token binding table.
   - Specific UI designs for each of the 10 mandatory system states.

### Phase 4: Audit & Verification Gate

Run this verification before approving any UI implementation.

**Automatable checks** — grep the changed files. Use `git diff HEAD` when changes are unstaged; in a non-git project pass the explicit file list instead:

```bash
# 1. Check for forbidden hardcoded hex values in classes
git diff HEAD | grep -E "bg-\[#|text-\[#|border-\[#|fill-\[#" && { echo "VIOLATION: Hardcoded hex found!"; exit 1; }

# 2. Check for unauthorized radius classes
git diff HEAD | grep -E "rounded-sm|rounded-md|rounded-3xl|rounded-\[" && { echo "VIOLATION: Invalid radius tier!"; exit 1; }

# 3. Check for fractional spacing
git diff HEAD | grep -E "gap-1\.5|gap-2\.5|p-3\.5|m-\[" && { echo "VIOLATION: Non-4px spacing found!"; exit 1; }
```

**Verification checklist** — confirm on the rendered result, in both light and dark:

- [ ] All shared components consume semantic or component tokens; no new hardcoded color in page components without a documented reason.
- [ ] Business statuses resolve through one resolver to fixed roles; `unknown` renders neutral and never falls back to success (`references/status-semantics.md`).
- [ ] Empty, zero, and failed are visually and textually distinct.
- [ ] Administrative states (draft, archived, paused, inactive, closed) are not presented as errors.
- [ ] Badges carry a text label and stay distinguishable in grayscale and in red-green color vision deficiency.
- [ ] All 10 states from `docs/design/STATES-MATRIX.md` are handled in the component.
- [ ] Hover, focus, selected, pressed, disabled, loading, error, and empty were checked on canvas, card, table, and dialog surfaces.
- [ ] Normal text meets 4.5:1, large text 3:1, and meaningful non-text graphics 3:1 against adjacent colors.
- [ ] Keyboard focus is visible and never clipped; every interaction works without a mouse.
- [ ] Charts use the chart namespace, keep grid and axis neutral, never rely on hue alone, and define loading, empty, and zero states (`templates/data-viz.md`).
- [ ] No unauthorized change to business logic, permissions, data contracts, or frontend architecture.

Report per module: files changed, token mapping, statuses needing clarification, contrast results, and before/after screenshots.

## Code Examples

### Example 1: globals.css Token Architecture (Tailwind v4 / CSS Variables)

```css
@theme static {
  --color-canvas: #F4F6F5;
  --color-surface: #FFFFFF;
  --color-surface-subdued: #F8FAFC;
  --color-primary: #1B2A41;
  --color-primary-hover: #3A4A60;
  --color-primary-fg: #FFFFFF;
  --color-text-strong: #0F172A;
  --color-text-default: #334155;
  --color-text-muted: #64748B;
  --color-border-subtle: #E2E8F0;
  --color-border-strong: #CBD5E1;
  --color-accent: #3B82F6;
}

html[data-theme="dark"] {
  --color-canvas: #121C2C;
  --color-surface: #1A2635;
  --color-surface-subdued: #15202E;
  --color-primary: #E8EDF5;
  --color-primary-hover: #D3DBE8;
  --color-primary-fg: #121C2C;
  --color-text-strong: #F8FAFC;
  --color-text-default: #CBD5E1;
  --color-text-muted: #94A3B8;
  --color-border-subtle: #2D3E53;
  --color-border-strong: #41556E;
  --color-accent: #60A5FA;
}
```

### Example 2: Strict Component Consumption

```tsx
// PASS: Role-based tokens, 4px grid, exactly 3 radius tiers
export function StatCard({ title, value, change }: StatCardProps) {
  return (
    <div className="bg-surface border border-border-subtle rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-text-muted">{title}</span>
        <span className="bg-success-bg text-success-fg text-[11px] font-semibold px-2 py-0.5 rounded-full">
          {change}
        </span>
      </div>
      <div className="mt-2 text-2xl font-bold text-text-strong font-sans tabular-nums">
        {value}
      </div>
    </div>
  );
}

// FAIL: Hardcoded colors, arbitrary radius, fractional spacing
export function BadStatCard({ title, value }: StatCardProps) {
  return (
    <div className="bg-[#FFFFFF] border border-gray-200 rounded-[14px] p-3.5 shadow-xl">
      <span className="text-gray-500">{title}</span>
      <div className="text-black font-mono">{value}</div>
    </div>
  );
}
```

## Anti-Patterns

- **Hex Code Hardcoding**: Writing inline styles or arbitrary Tailwind hex classes (`bg-[#1a2b3c]`).
- **Radius Soup**: Mixing `rounded-sm`, `rounded-md`, `rounded-xl`, and `rounded-3xl` across buttons and cards.
- **Monolithic Design Files**: Storing a 2000-line `DESIGN.md` file that exhausts agent token context. Use progressive disclosure via `docs/design/`.
- **Happy-Path Blindness**: Shipping a page without explicit skeletons, error states, and empty states.
- **Neon AI Aesthetic**: Defaulting to purple/cyan gradient glow buttons and dark glassmorphic cards for enterprise utilities.
- **Typewriter Monospace for Money**: Using `font-mono` on sales totals or dashboard revenue figures instead of `font-sans tabular-nums`.

## Best Practices

- Always run `multimodal-looker` on reference screenshots to extract visual proportions before writing code.
- Treat `globals.css` as the ultimate source of truth for values; treat `docs/design/` as the governance authority.
- When adding a new view, draft its page contract first; code review checks the implementation against that contract.
- Keep the number of radius tiers strictly at 3 (`8px`, `12px`, `16px`) plus capsule badges (`rounded-full`).
- Re-verify dark mode contrast whenever an accent or surface token is tweaked.
- Name the consuming skill in implementation plans: write "execute under `frontend-scaffold`" when the plan implements a frozen contract. A skill cannot force the harness to load it — an agent working from the plan alone skips the consumer's audit gate (observed failure: 14 contract violations shipped under a green suite).

## Related Skills

- `frontend-patterns`: Component composition, React hooks, and rendering best practices.
- `frontend-scaffold`: Downstream consumer — turns a frozen contract from this skill into a running skeleton with the audit gate.
- `a11y`: Accessibility standards, WCAG 2.2 Level AA contrast, and screen-reader semantics.
- `design-system`: Auditing existing CSS codebases for consistency.
- `frontend-design-direction`: High-level aesthetic direction and typography curation.
