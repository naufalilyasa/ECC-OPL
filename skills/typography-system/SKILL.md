---
name: typography-system
description: Design and repair website and application typography using Google Fonts, context-specific font selection, curated pairings, responsive role-based type systems, and browser verification. Use for typography audits, font pairing, type hierarchy, or improving generic AI-generated interfaces while preserving the product and brand.
---

# Typography system

Make the content feel deliberately typeset and make the interface easier to use. Work from the reader's task, actual copy, language, and brand. An uncommon font is an option, not a quality test. Google Fonts is the default source for new fonts; preserve user-specified or established brand fonts unless replacement is requested.

## Start with the work in front of you

For an existing site, inspect its implementation and rendered pages before prescribing fonts. Identify the current families, loaded files and weights, role tokens, text widths, spacing, and representative components. If only a screenshot is available, separate visible observations from implementation guesses; do not claim to know the font, DOM semantics, network behavior, or accessibility from pixels alone.

For a new experience, infer the brief from available context: audience and reading task; product versus marketing surfaces; desired tone; content density; actual languages; technical constraints. Ask only when a missing answer materially changes the work. When proceeding with an assumption, state it briefly.

Respect scope: a typography repair normally changes type, text measure, rhythm, and the component dimensions needed to accommodate those changes. Preserve product behavior, copy, navigation, brand colors, and unrelated layout unless the request authorizes broader changes. Do not rewrite content just to fit a font.

## Choose the appropriate references

- **Choosing a direction or repairing generic styling:** read [selection-and-audit.md](references/selection-and-audit.md).
- **Selecting actual families:** read the relevant contexts in [pairings.md](references/pairings.md). Treat the recipes as curated starting points; preview them with the project's content.
- **Defining sizes, hierarchy, responsive behavior, or accessibility:** read [typography-systems.md](references/typography-systems.md).
- **Loading or implementing fonts:** read [font-engineering.md](references/font-engineering.md).
- **Working outside Latin text:** read [multilingual.md](references/multilingual.md) before choosing families or applying tracking.
- **Checking capabilities, generating a load URL, or previewing recipes:** read [tooling.md](references/tooling.md). The verified catalog is [font-catalog.json](references/font-catalog.json); load only the needed records, not the entire dataset by default.

## Build a system, not a font collection

1. **Choose the text foundation.** Test body and UI candidates using a real paragraph, labels, numbers, and a narrow component. Look for readable character distinctions, usable weight/style coverage, correct script support, suitable width, and tone. A display face does not establish that its paragraphs or controls will work.
2. **Give every family a job.** One versatile family can serve the whole product. Two families are a useful starting budget when display and text need different voices. Add a third only for a concrete role such as code or a required script; this is a complexity heuristic, not a standard or hard cap. A fallback family is not another branding voice, but its metrics still matter.
3. **Choose a relationship.** Contrast one or two meaningful traits—construction, width, stroke contrast, texture—while keeping the overall tone and apparent scale compatible. Related serif/sans families are another valid approach. Same-category pairings can work if their distinct roles are perceptible. “Serif plus sans” alone is not a rationale.
4. **Assign semantic roles.** Map the roles the content needs: display, page title, section title, card title, lead, body, label, caption, data/code. Each role specifies family, weight, size behavior, line height, tracking, and measure where relevant. Do not invent a separate size or font for every element. Visual role classes are independent of correct HTML heading levels.
5. **Tune in context.** Match apparent size and texture optically, not by identical CSS numbers. Adjust measure and paragraph rhythm together. Preserve a readable body anchor on mobile; reduce headline drama before reducing text legibility. Apply tracking by face, role, and script, not globally.
6. **Implement and inspect.** Load only used families, weights, styles, and appropriate subsets. Confirm exact Google family names and capabilities, and inspect the actual delivered font when a feature matters. Consolidate existing tokens/loaders instead of stacking new ones. Compare representative pages at wide and narrow widths, with loaded and fallback fonts.

## Distinction without a new template

Find an observable problem: weak hierarchy, inappropriate tone, cramped paragraphs, indistinguishable labels, oversized repeated headlines, monotonous emphasis, unreliable numerals, or too many unassigned styles. Fix that problem directly. Avoid substituting one fashionable pairing across every domain.

For an open-ended brief, compare two or three materially different directions using the same real copy. For a specific edit or an established identity, skip unnecessary alternatives. Select the direction that best supports the content; do not present subjective taste as scientific proof. A dense application can gain character through proportions, rhythm, and consistent emphasis while keeping a familiar family.

## Verification that changes the outcome

Check representative text at its real sizes and widths: a long title, body paragraph, navigation, form label and error, button, price/table, and required scripts. Verify real font loading, available weight/style, line breaks, character coverage, and interactions. Use browser automation if available; otherwise provide the implementation and explicitly identify unverified rendering checks.

For web work, preserve semantic headings and labels, text resizing, reflow, text-spacing overrides, and contrast. The detailed reference distinguishes WCAG requirements from starting values. Neither a `clamp()` formula nor a contrast calculation alone establishes accessibility.

When a visual test fails, change the smallest relevant decision and retest the affected context. Stop when the requested scope works and remaining checks are clear; do not keep collecting fonts without a design reason.

## Deliver

Complete the requested implementation when files or tools are available. Report the selected families and their roles, why they fit this content, what changed, and what was actually verified. Include reusable tokens and the loading strategy when relevant. For a recommendations-only request, provide a concise implementable specification. Mention material limitations, not an exhaustive process log.
