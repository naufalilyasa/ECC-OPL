# React / Inertia port adapter (V2.0)

Translate — do not redesign. Preserve the approved landmark hierarchy, semantic
classes, and computed geometry.

| Canvas | React / Inertia |
|---|---|
| `<header class="topbar">` | `<header className="topbar">` (keep `role="banner"`) |
| spacing utility `pt-4` | Tailwind `pt-4` (16px) — preserve exact value |
| dynamic badge | JSX span with `aria-label`; never `dangerouslySetInnerHTML` |
| `./assets/x.svg` | `public/images/x.svg` or module import (no 404) |
| global `.class {}` | scoped CSS / Tailwind; no unanchored global rules |

## Rules
- Inertia layout stays in `AppLayout.tsx`; sub-component wrappers inherit
  `border-radius: inherit` where `overflow: visible` is enabled.
- Dynamic DOM from client JS must use scoped selectors (`[data-new]`), never
  bare global CSS.
- The validator `verifyAdapterReact` rejects global CSS spill, lost `className`,
  and lost `AppLayout`.
