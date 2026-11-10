# Catalog and specimen tools

The tools use Python 3's standard library. Run the examples from the skill folder, or use the script's absolute path. They do not require a Google API key. Local catalog lookup and validation work offline; refreshing metadata and loading live specimen fonts require network access.

## Choose without loading the whole catalog

```sh
python3 scripts/font_tools.py list --context editorial
python3 scripts/font_tools.py family 'Fraunces'
python3 scripts/font_tools.py css --recipe source-editorial
python3 scripts/font_tools.py validate
```

`list` returns recipe JSON filtered by context; use its exact recipe ID with `css`. `family` returns one catalog record. `css` prints a CSS2 URL, not HTML or a complete design system. Escape `&` as `&amp;` when placing that URL in an HTML attribute. The generated request includes the roles in the selected recipe; remove an unused code or other role before requesting fonts for a narrower implementation.

The URL requests discrete weights used by the roles. For families whose requested faces all support `opsz`, it requests the optical-size range unless an explicit coordinate was supplied. This allows `font-optical-sizing: auto` to work in the delivered font. Other custom axes are loaded at the requested coordinates. Apply those custom coordinates in CSS as well. A recipe's display/body/UI roles can use different coordinates of one family; a missing axis is not permission to invent a value.

The validator rejects unknown families, unsupported weights/styles/axes, invalid coordinates, and inconsistent role definitions. It verifies against bundled repository metadata, not the live CSS API. A syntactically valid request still needs delivery and rendering checks before production use.

### Make a one-off selection

For a custom combination, keep the curated library intact and pass a temporary JSON file with just the roles needed for URL generation:

```json
{"recipes":[{"id":"shop","roles":{
  "display":{"family":"Fraunces","weight":600},
  "body":{"family":"Hanken Grotesk","weight":400},
  "ui":{"family":"Hanken Grotesk","weight":600}
}}]}
```

```sh
python3 scripts/font_tools.py css --recipe shop --pairings /tmp/shop-type.json
```

Save the JSON at the path passed to `--pairings`. Add a role such as `emphasis` with `style: "italic"` when the real content uses it; the same weight/style checks apply. This minimal format is for catalog validation and URL generation. The specimen builder needs complete recipe names, contexts, rationale, cautions, and specimens, as demonstrated in the bundled dataset.

## Compare with your content

```sh
python3 scripts/build_specimen.py --output /tmp/typography-specimens.html
```

Open the generated HTML in a browser. It is a portable file with a pink selector column occupying 40% of the desktop view and a live specimen in the remaining 60%. Scroll or use the keyboard to choose context and recipe. Enter your own headline and paragraph, adjust body size/leading/measure, preview a narrow container or fallback fonts. Barlow Condensed styles the finder; recipe fonts load on demand. On small screens the sections stack. Edited copy persists across recipe changes to support comparison; “Use this recipe’s sample” restores the contextual sample.

The live component gallery previews 12 common interface patterns using the selected display, body, and UI roles. It scrolls automatically, pauses on hover or keyboard focus, and offers manual navigation and a persistent pause button. Reduced-motion preferences disable autoplay. Size, leading, measure, and fallback controls apply to these cards; the article card also uses the entered headline and paragraph. Forms and actions are local demonstrations.

The browser status distinguishes loading success from network failure. Even when faces load successfully, a particular character or feature may still come from fallback or be absent. Inspect the actual glyphs. The numeric sample requests tabular lining figures but does not certify feature support. Script samples are illustrative and have not been approved by native readers.

The narrow container and Latin spacing controls are exploration aids. They do not replace actual viewport, browser zoom, text-only enlargement, supported-script spacing, or component-level accessibility tests. Slider pixel labels assume the common 16px root; the specimen's sizes use rem and leave the browser root setting intact.

## What is verified in the catalog?

`references/font-catalog.json` records 47 curated families from a pinned `google/fonts` revision, with the exact family name, category, designer, license, subsets, axes, face filenames/styles/weight capabilities, source links, timestamp, and metadata SHA-256. It is a focused shortlist, not the entire Google Fonts library. `references/pairings.json` contains 30 role-based recipes plus contextual specimens, design judgments, and primary-source rationale.

The font metadata has an important trap: a variable font face may have `metadata_weight: 400` while its real `wght` range is 100–900. Use `weight_range`, not the metadata anchor, for variable-weight validation. A static face uses `weight`. A visually heavy family can still have only CSS weight 400. `faces[].variable_axes` distinguishes actual variable faces from the family's aggregate axis list.

Subset labels do not certify complete language support. Metadata does not certify `tnum`, `lnum`, small caps, shaping, or glyph quality. The catalog explicitly marks glyph/feature verification as not checked. Check the actual delivered font file and real content when those capabilities matter. Do not infer script support from “Noto” alone.

## Refresh or extend deliberately

1. Resolve a current commit SHA from the public [Google Fonts repository](https://github.com/google/fonts). Use a pinned 40-character SHA to make the result reproducible.
2. Add or revise candidate recipes in a working copy of `pairings.json`. Keep design rationale separate from facts; cite primary descriptions/specimens.
3. Refresh just the families those recipes use:

```sh
python3 scripts/refresh_catalog.py --pairings references/pairings.json \
  --revision GOOGLE_FONTS_COMMIT_SHA \
  --output references/font-catalog.json
python3 scripts/font_tools.py validate
```

Replace `GOOGLE_FONTS_COMMIT_SHA` with the resolved SHA. Alternatively `--families` accepts a JSON array of exact family names. The refresh tries the standard OFL, Apache, and UFL family directories; if a name moved or needs a special directory, inspect the source and adapt the lookup rather than silently dropping it. A failed fetch leaves the existing catalog intact. `--cache-dir` optionally saves the raw metadata for research provenance.

4. Verify generated CSS2 requests and relevant delivered files. A repository update and API rollout need not be simultaneous.
5. Regenerate the specimen, compare real content at role sizes, and update the readable pairing reference when roles or judgments change. Record the observed result and remaining limits; do not promote a metadata refresh into a claim of visual approval.

Source format and license-directory organization: [Google Fonts repository documentation](https://github.com/google/fonts#readme). Request grammar and supported-axis behavior: [Google Fonts CSS2 API](https://developers.google.com/fonts/docs/css2).
