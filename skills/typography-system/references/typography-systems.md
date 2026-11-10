# Typography systems: evidence and practical decisions

Research checked 2026-09-06 UTC. Scope: responsive websites, product interfaces, reading experiences, and improvement of existing generic designs. This is an original synthesis of primary standards, design-system guidance, and research; it does not establish a new accessibility standard.

## Evidence labels

- **Requirement** means a named WCAG 2.2 success criterion at its stated level. Meeting these typography-related items alone does not establish whole-site conformance.
- **Published guidance** means a recommendation or practice in a named design system, not a universal rule.
- **Skill heuristic** means a proposed starting decision to test against actual content, fonts, users, devices, and languages.

The normative source is [WCAG 2.2](https://www.w3.org/TR/WCAG22/). Its Understanding documents explain application and exceptions; they are informative. WCAG does not prescribe a universal body font, 16px minimum, font-family count, modular-scale ratio, or serif-versus-sans choice.

Use [selection-and-audit.md](selection-and-audit.md) for the brief, family budget, pairing decisions, and repair loop. This reference covers the layered system, reading geometry, and accessibility checks. Use [multilingual.md](multilingual.md) for script-specific routing.

## 1. Build layered roles, not arbitrary font sizes

Use a compact role inventory. The following is a **skill heuristic**, not a required list:

| Layer / token | Job | Distinguishing treatment | Common mistake |
| --- | --- | --- | --- |
| `display` | One major brand or editorial moment | Largest scale; strongest personality | Applying hero styling to every heading |
| `page-title` | Identify this page or task | Clear prominence with dependable wrapping | Confusing title with promotional slogan |
| `section-title` | Make the content map visible | Stable size/weight; generous space above | Headings visually attach to prior content |
| `subsection-title` | Group related detail | Modest weight or size contrast | Too many nearly identical heading levels |
| `body` / `reading` | Carry meaning over sentences | Comfortable density, measure, and emphasis | Low contrast and an overwide text column |
| `label` / `control` | Explain an action or field | High clarity at small scale | Script face, tiny caps, overly tight buttons |
| `supporting` | Dates, metadata, captions, helper text | Quieter but still clearly readable | Hiding necessary instructions in faint gray |
| `data` / `code` | Compare values or inspect syntax | Appropriate numerals or monospace | Using a new font as technical decoration |

For each role store family, size, weight, line height, tracking, measure, and surrounding spacing together. Use one token repeatedly for the same job. Do not force every token to have a unique size: a label and paragraph can share size but differ in weight, placement, or spacing.

Carbon maintains productive and expressive type sets: productive headings are fixed, while many expressive headings change across viewport sizes. Its published bases are 14px and 16px respectively. This is evidence that reading mode and information density can justify different systems; it is not blanket permission to make every product small. [Carbon: Type sets](https://carbondesignsystem.com/elements/typography/type-sets/)

Carbon's productive/expressive distinction also allows controlled blending. **Skill heuristic:** a campaign landing page can use expressive titles while checkout and account settings retain quieter, stable controls. A product's empty state may be expressive without turning every table into editorial typography. [Carbon: Style strategies](https://carbondesignsystem.com/elements/typography/style-strategies/)

### Semantic hierarchy is independent of visual size

Use actual heading elements for the content outline; select heading rank for structure, not its default browser appearance. Avoid jumping down levels when introducing subsections; returning from a nested section to an earlier level is normal. Stable sidebar sections can retain ranks across pages. **Skill heuristic:** use a clear page-level heading, then map section and subsection headings; do not claim that an “exactly one h1” convention is itself a universal WCAG rule. [W3C WAI: Headings](https://www.w3.org/WAI/tutorials/page-structure/headings/)

## 2. Reading geometry: tune the combination

USWDS recommends an effective body size around 16px or above for most text, roughly 66 characters for long text within a broader 45–90 range, and at least 1.5 line height for extended reading. It explicitly allows exceptions for short or specialized text. It also recommends making a heading closer to the content it introduces, preserving normal body tracking, and reserving long bold/italic/all-cap treatments for limited use. These are design-system recommendations, not WCAG mandates. [USWDS: Typography](https://designsystem.digital.gov/components/typography/)

**Skill heuristic starting ranges for Latin text:**

| Role | Initial CSS size | Initial unitless line height | Adjustment trigger |
| --- | --- | --- | --- |
| General body | 1–1.125rem | 1.5–1.65 | Increase for low apparent size, long reading, or audience needs |
| Sustained editorial reading | 1.125–1.25rem | 1.5–1.7 | Tune with column width; avoid loose disconnected lines |
| Compact product text | 0.875–1rem | 1.35–1.5 | Require actual-size testing; keep key instructions comfortable |
| Short supporting text | 0.875–1rem | 1.35–1.5 | Distinguish with placement before reducing size further |
| Multi-line headings | Context-dependent | 1.1–1.3 | Add room for accents, tall scripts, and wraps |
| Oversized display | Content-dependent | Inspect visually | Short line height can work only without overlap or clipping |

These examples assume an unchanged browser root size, commonly 16px; respect user settings. Do not shrink the root to make the arithmetic easier. A small-x-height face can need more CSS size than a large-x-height face. USWDS itself normalizes final sizes by family rather than equating a token's reference pixel number with every font's output. [USWDS: Font size](https://designsystem.digital.gov/design-tokens/typesetting/font-size/)

Start an ordinary Latin reading column near `60–70ch`, then inspect actual line lengths. `ch` is based on the advance of the zero glyph, so `65ch` does not guarantee 65 proportional text characters. The same width token changes appearance when the font changes. [CSS Values and Units: font-relative lengths](https://www.w3.org/TR/css-values-4/#font-relative-lengths)

**Skill heuristic:** keep body copy aligned to the reading start edge. Reserve centered copy for a brief introduction, quotation, or deliberately composed message. Prefer controlled line length and adequate gutters to filling the entire desktop viewport. Short mobile lines are expected; do not make text smaller merely to preserve a desktop character target. A paragraph, alert, and card title need different measures.

## 3. Accessibility requirements and traps

| Criterion | Level | Typography implication |
| --- | --- | --- |
| [1.4.3 Contrast Minimum](https://www.w3.org/TR/WCAG22/#contrast-minimum) | AA | Ordinary text needs 4.5:1; large text 3:1, with stated exceptions. Large generally means at least 18pt regular or 14pt bold: 24px or about 18.67px. |
| [1.4.4 Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) | AA | Text must enlarge up to 200% without lost content/function, apart from the criterion's captions/images-of-text exceptions. |
| [1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) | AA | Vertically scrolling content must work at 320 CSS px width without two-direction scrolling, with exceptions for content whose meaning/use requires two dimensions. |
| [1.4.12 Text Spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html) | AA | Support simultaneous user overrides: line height 1.5× font size, paragraph-after space 2×, letter spacing .12×, and word spacing .16×, without loss. |
| [1.4.8 Visual Presentation](https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html) | AAA | A mechanism enables specified presentation choices, including at most 80 characters/glyphs per line (40 CJK), no full justification, color selection, spacing, and enlargement. This is not an AA fixed-width mandate or an obligation to author every block to those values. |

**Published clarification:** the text-spacing values are override resilience tests, not mandatory default CSS. Language/script combinations only need properties applicable to them. Truncation after spacing can be acceptable where full text remains available through an accessible mechanism; silent loss is not. [W3C: Understanding Text Spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html)

**Published clarification:** contrast is assessed using specified foreground/background colors, not anti-aliased edge pixels. Very thin faces can appear weak despite a numerical pass; prefer stronger strokes or greater contrast. Placeholders and focus/hover text also need sufficient contrast. Branding outside logos is not a general exception. [W3C: Understanding Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

**Skill heuristic:** test the smallest essential text first, including form hints, prices, error messages, chart labels, and card metadata in every theme. Do not infer that a passing hero implies accessible typography everywhere. Do not round a failing contrast value upward.

**Published clarification:** responsive type changes must still permit 200% enlargement relative to the original default rendering. Simply using `rem`, or mixing it into a fluid `clamp()`, is not proof. Verify how the actual page behaves under zoom and text enlargement. [W3C: Understanding Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)

**Skill heuristic:** test at 100%, 200%, and 400% browser zoom plus intermediate zoom states when responsive breakpoints alter font sizes; verify 200% text-only enlargement where supported. Use the effective 320 CSS px viewport reflow check, not a physically tiny screenshot alone. A legitimate wide table can scroll inside its own region while the rest of the page reflows. [W3C: Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)

## 4. Readability evidence and numerical typography

An adult interlude-reading study found substantial individual differences across fonts and concluded that a single font does not suit everyone. This supports personalization and audience testing; it does not establish one best Google Font, a guarantee of speed improvement, or a universal serif/sans ranking. Reading speed, preference, comprehension, and task accuracy are different outcomes. [Wallace et al., 2022: Towards Individuated Reading Experiences](https://research.adobe.com/publication/towards-individuated-reading-experiences-different-fonts-increase-reading-speed-for-different-individuals/)

**Skill heuristic:** describe genre associations as design judgments, not science: “this serif supports a literary tone” is defensible as a rationale; “serifs are always more readable” is not. Do not label a font “WCAG compliant” in isolation or claim a special dyslexia cure. A common family can still deliver excellent typography when composition and tuning fit the work.

For numerical content, width and numeral form are independent choices: tabular/proportional and lining/oldstyle are separate axes of `font-variant-numeric`. Use tabular figures when repeated values must align, and verify actual font support. Mono may be right for code, identifiers, or a deliberate voice; it is unnecessary merely to align numbers. [MDN: font-variant-numeric](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-variant-numeric)

## Source limits

Design-system recommendations describe their own contexts: USWDS public-service reading guidance and Carbon product sizes should remain distinct. Google Fonts Knowledge pairing and hierarchy pages returned empty article text in the research browser and are not used as evidence here. A font catalog or language-subset label does not verify delivered glyphs, shaping, or native-reader suitability. Consult [multilingual.md](multilingual.md) for those checks.
