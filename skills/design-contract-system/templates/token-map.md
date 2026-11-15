# TOKEN-MAP — Developer's Semantic Token Quick Reference

> **The Golden Rule**: Choose tokens based on their **role**, NEVER by the color you happen to want. Never hardcode arbitrary hex codes into Tailwind class names.

---

## 1. Role-Based Token Mapping

| UI Element Role | Tailwind Utility Class | CSS Variable | Forbidden Anti-Pattern |
|---|---|---|---|
| **Page Backdrop** | `bg-canvas` | `var(--color-canvas)` | `bg-gray-100`, `bg-[#F8FAFC]` |
| **Main Card Container** | `bg-surface border-border-subtle` | `var(--color-surface)` | `bg-white`, `border-gray-200` |
| **Nested Sub-Panel** | `bg-surface-subdued` | `var(--color-surface-subdued)` | `bg-gray-50`, `bg-zinc-100` |
| **Primary Action Button** | `bg-primary text-primary-fg hover:bg-primary-hover` | `var(--color-primary)` | `bg-black`, `bg-blue-600` |
| **Page & Section Title** | `text-text-strong` | `var(--color-text-strong)` | `text-black`, `text-slate-900` |
| **Standard Paragraph** | `text-text-default` | `var(--color-text-default)` | `text-gray-700`, `text-gray-800` |
| **Supporting Subtitle** | `text-text-muted` | `var(--color-text-muted)` | `text-gray-500` |
| **Input / Form Border** | `border-border-strong` | `var(--color-border-strong)` | `border-gray-400` |
| **Focus Indicator** | `ring-accent` | `var(--color-accent)` | `ring-purple-500` |
| **Success Status Pill** | `bg-success-bg text-success-fg` | `var(--color-success-*)` | `bg-green-100 text-green-800` |
| **Warning Status Pill** | `bg-warning-bg text-warning-fg` | `var(--color-warning-*)` | `bg-yellow-100 text-yellow-800` |
| **Danger Status Pill** | `bg-danger-bg text-danger-fg` | `var(--color-danger-*)` | `bg-red-100 text-red-800` |
| **Neutral Status Pill** | `bg-neutral-bg text-neutral-fg` | `var(--color-neutral-*)` | `bg-gray-100 text-gray-600` — must not look like success |

---

## 2. Token Extension Protocol

If a genuinely new UI role emerges that cannot be satisfied by existing tokens:
1. Do NOT write one-off inline hex codes (`bg-[#123456]`).
2. Propose the new role name in `docs/design/TOKEN-MAP.md` explaining why existing tokens fail.
3. Add the token pairing (Light and Dark) into `apps/web/src/app/globals.css`.
4. Only then consume the new semantic class in UI components.

---

## 3. Component Alias Contract

The third token layer exists for repeated, multi-property component needs. It aliases semantic roles; it never introduces new color values.

| Component alias | Maps to |
|---|---|
| `button.primary.bg` / `.fg` | `primary` / `primary-fg` |
| `button.primary.hover.bg` | `primary-hover` |
| `button.danger.bg` / `.fg` | `danger` / `danger-fg` |
| `input.bg` | `surface` |
| `input.border` | `border-strong` |
| `input.focus.ring` | `accent` |
| `input.error.border` | `danger` |
| `badge.<role>.bg` / `.fg` | `<role>` / `<role>-fg` (`success`, `warning`, `danger`, `info`, `neutral`) |
| `table.row.selected.bg` | `surface-subdued` + a visible checkbox or marker |
| `table.divider` | `border-subtle` |
| `dialog.bg` | `surface-raised` |
| `progress.track` | `surface-subdued` |
| `progress.fill.default` | `accent` |
| `dialog.scrim` | *No semantic token exists.* Propose one through §2 before use; do not inline a black/alpha value. |

**Rules:**

1. A component alias may only reference a semantic token — never a primitive and never a hex value.
2. Add an alias only when a component needs three or more related properties, or when the same combination repeats across components. One-off styling uses the semantic token directly.
3. Theme switching changes the semantic mapping, never the alias name.
4. Component aliases are internal. Page contracts bind to semantic tokens; component aliases stay inside the component file.
5. Interactive states must be distinguishable without color alone: error fields carry a message, selected rows carry a checkbox or marker, disabled is distinct from loading.

---

## 4. Status Enum Resolver Mapping

Fill this table whenever the product has business statuses. One row per enum value that can reach the UI; the resolver maps the value to a fixed role, and components consume the role. See `references/status-semantics.md` for the rules.

| Business status | Semantic role | Label | Source |
|---|---|---|---|
| `TODO` | `success` \| `warning` \| `danger` \| `info` \| `neutral` | `TODO` | `TODO: enum or policy path` |

Rules:

1. Every UI-reachable enum value has exactly one row; no value is left to a default that could render as `success`.
2. Unmapped or unknown values resolve to `neutral` with an explicit label.
3. A row whose source cannot be cited is marked `unverified` instead of receiving a role.
4. Adding a role here does not authorize a new token; roles map to existing `success`/`warning`/`danger`/`info`/`neutral` tokens from `THEME.md`.

