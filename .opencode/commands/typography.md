---
description: Design, systematize, and polish typography across brand selection (ux-typography), token scaling (typography-system), and craft rendering (better-typography)
argument-hint: "[--inspect | --fix | brief or brand description]"
---

# Typography Pipeline Command

Orchestrates complete web and product typography in three sequential stages:
1. **Discovery & Pairing (`ux-typography`)** — Typeface selection tied to brand personality, content type, and visual hierarchy.
2. **System & Tokens (`typography-system`)** — Mathematical modular type scales, CSS tokens, Google Fonts integration, and fluid scaling.
3. **Craft & Rendering (`better-typography`)** — Precise text rendering, line measure (45–75ch), text wrapping, tabular numbers, iOS zoom prevention, and punctuation polish.

**User Arguments**: $ARGUMENTS

## Pipeline Stages

```
Stage 1: Brand & Pairing (ux-typography)
       ↓
Stage 2: Tokens & Responsive Scale (typography-system)
       ↓
Stage 3: Rendering Craft & Polish (better-typography)
```

### Stage 1: Brand Discovery & Typeface Pairing (`ux-typography`)

1. **Analyze Context & Persona**:
   - Infer audience and product category (e.g. enterprise B2B, creative studio, consumer mobile, data-heavy dashboard).
   - Define brand character (e.g. authoritative, friendly, technical, luxury).
   - Determine density requirements: high-density UI requires compact sans with neutral x-height; editorial requires generous tracking and serif contrast.

2. **Select Typeface & Pairing**:
   - Select heading font (brand personality carrier) and body font (legibility floor).
   - Maximum 2 font families (3rd allowed only for code/mono).
   - Pair by deliberate contrast (e.g. Serif + Sans, Geometric + Humanist) or superfamily. Never pair two near-identical sans-serifs.

### Stage 2: System Architecture & Tokens (`typography-system`)

1. **Establish Modular Scale**:
   - Base size: 16px default for web; 14px for high-density desktop dashboards.
   - Modular ratio: Major Second (1.125) for compact UI, Minor Third (1.20) for mobile/cards, Major Third (1.25) for general SaaS, Perfect Fourth (1.333) for editorial.
2. **Define Role Tokens**:
   - Map roles: Display (`--text-display`), H1–H4, Body-lg, Body (`--text-body`), Caption, Overline/Badge, Code.
   - Calculate line-height: inverse to size (Display = 1.05–1.15; Body = 1.4–1.6; Caption = 1.3).
   - Set tracking (letter-spacing): negative for large headings (`-0.02em` to `-0.04em`), positive for small uppercase labels (`0.05em` to `0.1em`).
3. **Deliver Code-Ready Tokens**:
   - Generate CSS variables (`:root`) or Tailwind theme extensions (`theme.extend.fontSize`, `theme.extend.fontFamily`).
   - Use `clamp()` for responsive fluid typography instead of viewport units alone.

### Stage 3: Craft & Rendering Polish (`better-typography`)

1. **Line Measure & Structure**:
   - Cap prose reading width at `45ch` to `75ch` (`max-width: 65ch`).
   - Align text to `text-align: start` (left for LTR). Never use `justify` in application UI.
2. **Modern Text Wrapping**:
   - Apply `text-wrap: balance` to headings, titles, and callouts (under 6 lines).
   - Apply `text-wrap: pretty` to body text and paragraphs to eliminate single-word orphans.
   - Use `overflow-wrap: break-word` on dynamic user content and links.
3. **Data & Component Typography**:
   - Add `font-variant-numeric: tabular-nums` (Tailwind: `tabular-nums`) on prices, counters, timestamps, timers, and data tables.
   - Ensure form inputs use at least `16px` font size on mobile viewports to prevent iOS auto-zoom.
   - Punctuation hygiene: convert straight quotes to smart quotes, hyphens to proper en-dashes (`–`) for ranges and em-dashes (`—`) for parenthetical thoughts, and `...` to true ellipsis (`…`).

## Output Deliverables

1. **Typography Blueprint**:
   - Brand archetype & selected font families (heading, body, mono).
   - Modular type scale table (role, size, line-height, letter-spacing, font-weight).
2. **Implementation Tokens**:
   - CSS variables block (`:root { ... }`) or `tailwind.config.js` snippet.
   - Google Fonts or webfont `@import` / `<link>` tags.
3. **Craft Checklist**:
   - Verification of `text-wrap: balance/pretty`, tabular numbers, line lengths, and mobile input sizing.
