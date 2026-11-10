# Selection and repair

These are design judgments and operating heuristics, not universal laws. Research checked 2026-09-06 UTC.

## Define the job before the mood

Record a compact brief: primary activity (read, scan, compare, purchase, explore); audience and languages; content density; desired voice; existing identity; delivery constraints. “Premium” or “modern” alone is not enough. A premium research publisher and a premium skincare shop have different reading tasks.

Practical selection considers text length, intended size, style range, glyphs, and project longevity. Contrast and related families can both produce useful pairings. The choice remains contextual. [Google Design: choosing web fonts](https://design.google/library/choosing-web-fonts-beginners-guide)

Do not translate this into a rule that serif is always more readable, sans is always accessible, or a decorative face is always bad. Test the specific design. Avoid presenting font choice as a treatment for dyslexia or a guarantee of trust, conversion, intelligence, or luxury.

## Useful vocabulary for decisions

| Attribute | Inspect | Consequence to test |
|---|---|---|
| Apparent size | x-height, cap height, ascenders, proportions | Equal CSS sizes can look unequal; align by the role's visual importance. |
| Width and spacing | Condensed/wide construction, sidebearings, word spaces | Navigation fit, long headlines, paragraph rhythm; do not compress fonts with transforms to fit. |
| Stroke contrast | Thin details against thick strokes | Delicate display text may degrade at small sizes or on weaker screens. |
| Apertures and counters | Openings in e/c/s and internal spaces | Crowding and ambiguity at the actual text size. |
| Character differentiation | I/l/1, O/0, rn/m, punctuation | Identifiers, tables, critical labels, and mixed-language strings. |
| Texture and rhythm | Repeated paragraphs, dark/light distribution | Reading comfort and consistency matter more than a beautiful isolated word. |
| Shape and construction | Humanist, geometric, grotesque, slab, high-contrast, handwritten | Use these to describe observed character, not to assign universal emotional meaning. |
| Family depth | Real weights/italics, optical sizes, width variants | Ability to handle future content without improvised extra faces. |

## Context changes the shortlist

| Context | Prioritize | Where character can live | Common failure |
|---|---|---|---|
| Dense SaaS/admin | Clear compact labels, numerals, distinct weights | Page titles, density/rhythm, one family used well | Marketing-size headings crowd every panel. |
| Editorial/research | Sustained reading, italics, punctuation, text measure | Masthead, article title, pull quotes | Display serif used for tiny long paragraphs. |
| Commerce | Product names, prices, variant labels, purchase flow | Campaign and collection titles | Expressive checkout labels slow scanning. |
| Architecture/art portfolio | Project-led tone, image-caption relationship | Large titles, spatial composition, restrained metadata | Characterful display face competes with every image. |
| Hospitality/food | Menu readability, prices, languages, personality | Menu section names and short invitations | Script everywhere; thin prices and allergen notes. |
| Learning/play | Age/task fit, clear instructions, language needs | Short encouraging headings | Decorative letterforms obscure instructional text. |
| Finance/science/developer | Symbols, precise figures, units, code if needed | Restrained titles, coherent data rhythm | Assumes monospace is required for all numbers. |
| Civic/service/health information | Comprehension, unfamiliar users, translation | Calm hierarchy and comfortable body text | Thin small text presented as sophistication. |

These are task-based hypotheses, not fixed fonts-for-industries rules. Choose recipes in `pairings.md` only after identifying the actual task. A recipe used elsewhere can be the better fit.

## How many families?

Begin with the fewest that can do the job. One family with weights/styles often suffices for a product. A second can separate brand expression from routine reading. A third needs a named role: code, special notation, another script, or an intentional editorial structure. Related families can count as multiple files even when they feel like one visual system. Font-file count, bytes, and the number of distinct voices are different measures.

Do not enforce “maximum two fonts” mechanically on multilingual sites or editorial projects. Do not add a mono family purely to make ordinary navigation look technical. When removing a family, inspect all its roles before deleting its imports.

## Pairing method

Select a body/UI candidate first for content-heavy work; for an expressive campaign, explore the headline voice early but validate its text partner before committing. Make a small specimen with the same actual copy in each direction. A heading/body pairing is directional: swapping roles creates a different result, not an equivalent pairing. The research literature also models header/body roles as asymmetric. [Jiang et al.: Visual Font Pairing](https://arxiv.org/abs/1811.08015)

Compare at the intended sizes. Choose a useful contrast and a unifying property. For example: sculptural serif display against a steady sans paragraph, sharing a warm tone; or related serif and sans sharing construction but separating reading from controls. Two sans faces can work when width and assigned role make the difference visible. Two nearly interchangeable faces add little unless a specific requirement justifies them.

Record why the winner serves the task, a failure condition, and the roles each face owns. Do not claim a numerical “pairing compatibility score” measures beauty. When a second family adds no usable distinction, keep one.

## Audit existing work

Inventory representative page types rather than counting declarations without context. Check computed styles and actual font downloads when possible; local fonts and fallback can hide missing loads. Capture the same content and viewport for before/after comparisons.

| Symptom | Diagnose first | Candidate repair |
|---|---|---|
| Everything looks equally important | Size/weight/spacing differences between roles | Establish a clear page/section/body order; reduce repetitive emphasis. |
| “Generic” despite unusual fonts | Copy length, composition, role consistency | Rework proportions and rhythm; another font may add nothing. |
| Paragraphs feel exhausting | Measure, line height, density, contrast | Narrow or expand measure and adjust leading together. |
| Small text looks fragile | Weight, contrast, rendering, face's intended use | Stronger text cut or weight; readable size. |
| Mixed styles feel accidental | Redundant families and unrelated token values | Assign family roles; consolidate repeated values. |
| Titles break awkwardly | Container width, actual copy, fluid sizing | Tune maximum size/measure; test long strings. Use manual breaks only for controlled editorial text. |
| Buttons or cards clip | Fixed height, line height, translation, user overrides | Allow growth/wrapping; adjust component padding. |
| Prices jump or columns wobble | Digit widths, numeral features, alignment | Test tabular numerals and end alignment; preserve units and locale. |
| Italics or bold look wrong | Downloaded styles and variable ranges | Load real supported styles; remove impossible requests. |

Prioritize broken reading and interactions, then hierarchy, then expressive refinements. A scoped typography repair can change adjacent spacing to accommodate type, but should not quietly redesign the whole product.

## Review loop

1. State the observed issue and representative content.
2. Make one coherent role/system change, not a scatter of per-element overrides.
3. Compare identical content at wide and narrow widths with real and fallback fonts.
4. Check long text, translated text, text scaling, spacing overrides, and impacted controls.
5. Keep changes that improve the task; revise the smallest failed decision.

For future skill maintenance, save the failing request, minimal fixture, observed output, and why it failed. Add a narrow correction only if existing guidance did not cover the issue. Preserve successful behavior; don't turn a single aesthetic preference into a ban.
