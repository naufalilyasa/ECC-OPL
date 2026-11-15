# [PROJECT_NAME] Design System & Contracts Index

> **Single Source of Truth**: `apps/web/src/app/globals.css` (or main stylesheet) defines all token values. This directory governs the usage rules, architectural boundaries, and page-level contracts.
> **Progressive Disclosure**: AI agents should read ONLY the specific document required for their current task. Do NOT load all design documents simultaneously into working context.

---

## 1. Routing Table for AI Agents & Developers

| If you are working on... | Read this document first | Why |
|---|---|---|
| **Choosing colors, borders, or surfaces** | [`docs/design/TOKEN-MAP.md`](docs/design/TOKEN-MAP.md) | Maps semantic role tokens to CSS classes. Hardcoded hex codes are strictly forbidden. |
| **Spacing, radius, z-index, touch targets** | [`docs/design/STANDARDS.md`](docs/design/STANDARDS.md) | Enforces strict 4px spacing scale, exactly 3 radius tiers, and layout geometry. |
| **Dark mode, theme switching, contrast** | [`docs/design/THEME.md`](docs/design/THEME.md) | Details dual-mode token pairing (`data-theme`) and contrast requirements. |
| **Fonts, sizes, weights, numbers** | [`docs/design/TYPOGRAPHY-MAP.md`](docs/design/TYPOGRAPHY-MAP.md) | Font pairings, tabular-nums rule for business metrics vs monospace for codes. |
| **Brand identity, logo, visual atmosphere** | [`docs/design/BRAND.md`](docs/design/BRAND.md) | Core aesthetics, brand voice, visual personality, and anti-slop rules. |
| **Empty, loading, error, offline states** | [`docs/design/STATES-MATRIX.md`](docs/design/STATES-MATRIX.md) | Standard implementation patterns for all 10 mandatory system states. |
| **Charts, KPI visualizations, series colors** | [`docs/design/DATA-VIZ.md`](docs/design/DATA-VIZ.md) | Categorical vs severity namespaces, neutral structure, required chart states. Optional — read only when the product renders charts. |
| **Implementing a specific page/screen** | [`docs/design/contracts/[PAGE]-CONTRACT.md`](docs/design/contracts/) | Component layout, state handling, and data binding contract for that page. |

---

## 2. Core Non-Negotiable Directives

1. **Role-Based Tokens Only**: Never select colors by visual appearance (e.g. `bg-slate-900`). Always select by semantic role (e.g. `bg-primary`, `text-strong`, `border-subtle`).
2. **Exactly 3 Radius Tiers**:
   - `rounded-lg` (8px): Interactive controls (buttons, inputs, dropdown triggers, small chips).
   - `rounded-xl` (12px): Cards, panels, tables, popovers, nested wells.
   - `rounded-2xl` (16px): Modals, dialogs, drawers (`rounded-l-2xl`).
   - *Pill exception*: `rounded-full` is exclusively reserved for status badges, avatar chips, and progress bars.
3. **4px Spacing Grid**: All margins, paddings, and gaps must strictly adhere to multiples of 4px (`p-1`, `p-2`, `p-3`, `p-4`, `p-5`, `p-6`, `p-8`, `p-12`). Odd numbers and arbitrary brackets like `p-[13px]` are banned.
4. **Mandatory 10 System States**: Every user-facing view must handle: (1) Empty, (2) Loading Skeleton, (3) Error, (4) No Internet, (5) Slow Network, (6) No Search Result, (7) Permission Denied, (8) Session Expired, (9) Form Validation, and (10) Success feedback.
5. **Contract Before Code**: When scaffolding a new view or feature, generate its `docs/design/contracts/[FEATURE]-CONTRACT.md` before writing TSX/CSS components.
