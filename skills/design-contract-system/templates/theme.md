# THEME — Dual-Mode & Contrast Architecture

> **Source of Truth**: `globals.css` (CSS variables mapped via `@theme static` and `html[data-theme="dark"]`).

---

## 1. Theme Mechanism

- **Selector**: Target attribute `data-theme="light"` or `data-theme="dark"` on `<html>`.
- **Storage**: Key `localStorage["[project_name]-theme"]` storing `"light"` or `"dark"`.
- **System Fallback**: Defaults to `window.matchMedia('(prefers-color-scheme: dark)')` when unselected.
- **FOUC Prevention**: Inline `<script>` injected in document `<head>` before framework hydration sets `data-theme` immediately to eliminate visual theme flash.

---

## 2. 19 Semantic Tokens: Light & Dark Pairing

Every token MUST have defined hex values for both Light and Dark modes.

### Surfaces & Canvas

| Token Name | Light Value | Dark Value | Semantic Purpose |
|---|---|---|---|
| `canvas` | `#F4F6F5` | `#121C2C` | Background of the entire application viewport |
| `surface` | `#FFFFFF` | `#1A2635` | Main cards, panels, and container background |
| `surface-subdued` | `#F8FAFC` | `#15202E` | Secondary/nested cards, table zebra striping |
| `surface-raised` | `#FFFFFF` | `#223246` | Floating popovers, tooltips, dialogs |

### Interactive & Brand

| Token Name | Light Value | Dark Value | Semantic Purpose |
|---|---|---|---|
| `primary` | `#1B2A41` | `#E8EDF5` | Primary action button background, high-priority icons |
| `primary-hover` | `#3A4A60` | `#D3DBE8` | Hover state for primary buttons |
| `primary-fg` | `#FFFFFF` | `#121C2C` | Text/icon foreground inside primary buttons |
| `accent` | `#3B82F6` | `#60A5FA` | Focus rings, active tab indicators, metric highlights |

### Text & Content

| Token Name | Light Value | Dark Value | Semantic Purpose |
|---|---|---|---|
| `text-strong` | `#0F172A` | `#F8FAFC` | High-contrast page titles, KPI values, table headers |
| `text-default` | `#334155` | `#CBD5E1` | Standard body paragraphs, form values |
| `text-muted` | `#64748B` | `#94A3B8` | Subtitles, helper captions, secondary labels |
| `text-subtle` | `#94A3B8` | `#64748B` | Placeholder text, disabled labels |

### Borders & Dividers

| Token Name | Light Value | Dark Value | Semantic Purpose |
|---|---|---|---|
| `border-subtle` | `#E2E8F0` | `#2D3E53` | Standard card borders, table dividers |
| `border-strong` | `#CBD5E1` | `#41556E` | Input borders, active panel outlines |

### Status Badges (Background & Foreground)

| Token Name | Light BG / FG | Dark BG / FG | Semantic Purpose |
|---|---|---|---|
| `success` | `#DCFCE7` / `#166534` | `#052E16` / `#86EFAC` | Positive status, successful completion |
| `warning` | `#FEF3C7` / `#92400E` | `#451A03` / `#FDE68A` | Pending status, threshold warning |
| `danger` | `#FEE2E2` / `#991B1B` | `#450A0A` / `#FCA5A5` | Critical alert, overdue item, failed state |
| `info` | `#E0F2FE` / `#075985` | `#082F49` / `#7DD3FC` | Neutral notice, system informative tag |
| `neutral` | `#F1F5F9` / `#475569` | `#1E293B` / `#94A3B8` | Unknown value, administrative or inactive state; never an error |

---

## 3. Contrast Ratios & WCAG Assurance

- Normal text (`text-default`, `text-strong`): Minimum **4.5:1** contrast ratio against its surface.
- Large text (bold 18px+ or 24px+): Minimum **3:1** contrast ratio against its surface.
- Form controls & borders: Minimum **3:1** contrast against adjacent canvas.
