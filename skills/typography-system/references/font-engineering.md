# Google Fonts engineering research

Research checked: 2026-09-05. Scope: dependable web delivery and verification of Google Fonts. “Documented” below means supported by the linked primary source or platform reference; “practice” means an engineering recommendation to validate in the actual product. Availability, files, browser support, and API responses can change.

## Decisions the skill should require

Before writing a font import, record the exact family, styles, weight positions or ranges, required languages, required OpenType features, delivery method, and fallback. A visually suitable family is not yet an implementable choice. A metadata check does not prove that the browser downloaded or rendered the intended face.

For an existing site, inspect its current font requests, declarations, computed roles, and rendered fonts before adding another provider, package, or stylesheet. Prefer its established delivery mechanism when it can serve the chosen Google Fonts correctly. This is a maintenance heuristic, not a font-design rule.

## 1. Google Fonts CSS2 requests

**Documented API facts.** Use `https://fonts.googleapis.com/css2`. Repeat `family=` for multiple families. Within a family, `:` introduces axes, `@` introduces values, commas separate axes/coordinates, semicolons separate tuples, and `..` specifies a continuous range. Sort axis tags alphabetically using `en-US` ordering; sort tuples numerically; tuples must not overlap or touch. Coordinates must be supported by that family. Omitted axes use defaults; omission can fail if an axis does not contain its default. Request discrete weights when those alone are used. Set loading behavior using `display=`. `text=` must be URL encoded, appears once, and applies to every family in that request. [Google Fonts CSS2 API](https://developers.google.com/fonts/docs/css2)

Original request examples, using the cataloged Alegreya family:

```text
https://fonts.googleapis.com/css2?family=Alegreya:wght@400;600;700&display=swap
https://fonts.googleapis.com/css2?family=Alegreya:ital,wght@0,400..700;1,400..700&display=swap
```

**Practice.** Reserve `text=` for truly fixed, public strings such as a stable wordmark. Do not build it from personal data, CMS prose, user input, or strings that can change with localization. A font reduced to yesterday's headline is not a safe general heading font.

Alegreya is a useful verified syntax example: its repository metadata lists distinct normal and italic variable files and a `wght` axis of 400–900. Its `weight: 400` face entry does **not** mean the file supports only 400. Read the axes as well. [Alegreya metadata](https://github.com/google/fonts/blob/5e35378e6bda803962ee6fd257e444a7d459660d/ofl/alegreya/METADATA.pb)

## 2. Delivery: hosted and self-hosted

**Documented.** Google generates CSS for the requesting user agent, then the browser fetches the appropriate font resource. Do not treat one captured response's file URLs as a permanent, universal API contract. The older browser-behavior section of this technical page should not override current CSS references. [Google Fonts technical considerations](https://developers.google.com/fonts/docs/technical_considerations)

**Documented.** An early stylesheet link and preconnection can reduce third-party discovery/connection costs. Preloading can compete with other critical resources and bypass normal `unicode-range` selection, so preload only a demonstrated critical face. [web.dev font best practices](https://web.dev/articles/font-best-practices)

Original hosted integration example:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Alegreya:ital,wght@0,400;0,600;1,400&amp;display=swap">
```

```css
.article {
  font-family: "Alegreya", Georgia, serif;
  font-weight: 400;
}
.article h2 { font-weight: 600; }
.article em { font-style: italic; }
```

**Documented.** Self-hosting removes the need for the font-provider connection. Delivery quality still depends on hosting, caching, and transport. WOFF2 is normally sufficient for modern browser targets; add older formats only when an actual support requirement needs them. [web.dev optimize web fonts](https://web.dev/learn/performance/optimize-web-fonts)

**Practice.** Choose hosted delivery for straightforward integration and provider-managed assets; choose self-hosting for pinned artifacts, first-party delivery, or existing project requirements. Compare real cold-load bytes and timing. Neither method is automatically fastest in every deployment. Serving all font resources from the site's own infrastructure removes those particular Google Fonts requests; that narrow technical statement does not determine a site's legal compliance.

Self-hosting example, **after** obtaining the correct licensed WOFF2 files and placing them at these illustrative paths:

```css
@font-face {
  font-family: "Alegreya";
  src: url("/fonts/alegreya-normal.woff2") format("woff2");
  font-style: normal;
  font-weight: 400 900;
  font-display: swap;
}
@font-face {
  font-family: "Alegreya";
  src: url("/fonts/alegreya-italic.woff2") format("woff2");
  font-style: italic;
  font-weight: 400 900;
  font-display: swap;
}
```

If measurement justifies a preload, its URL must exactly match the face actually used:

```html
<link rel="preload" href="/fonts/alegreya-normal.woff2"
      as="font" type="font/woff2" crossorigin>
```

A font preload needs the appropriate CORS mode, including for a same-origin font. [web.dev responsive typography, font loading](https://web.dev/learn/design/typography#font_loading)

Do not preload every family, weight, script subset, and italic. Do not import the same face through both a framework font loader and a Google stylesheet. Inspect the network waterfall for duplicate requests and unused preloads.

## 3. Variable fonts: control only what exists

**Documented.** Prefer `font-weight`, `font-style`, and other high-level properties for registered axes. `font-variation-settings` is the low-level escape hatch, particularly for custom axes. It can override the corresponding high-level setting, so a globally pinned `"wght"` can prevent a component's `font-weight` from behaving as intended. Axis tags are case-sensitive, and each font defines which axes and values exist. A variable `@font-face` must advertise its actual applicable weight range for matching. [MDN font-variation-settings](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-variation-settings)

**Documented.** `font-optical-sizing: auto` is the default and operates when the font has an optical-size axis. It adapts glyph design for size; it does not add an axis to a font that lacks one. [MDN font-optical-sizing](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-optical-sizing)

```css
.reading-copy {
  font-weight: 400;
  font-optical-sizing: auto;
}
.reading-copy strong { font-weight: 700; }
```

**Practice.** Keep optical sizing automatic unless an art-directed role needs a measured exception. Do not copy `"opsz"`, `"GRAD"`, `"wdth"`, or stylistic axis values from an unrelated font. Do not assume normal and italic share one file. Compare variable delivery against the specific static faces actually needed: “one variable file” is not proof of a smaller download. Check axis extremes for changing line breaks, clipped accents, and layout jitter before animating them.

**Documented.** Browsers can synthesize missing bold, italic, and other faces; `font-synthesis` controls that behavior. [MDN font-synthesis](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-synthesis)

**Practice.** Load real emphasis styles. `font-synthesis: none` can help a controlled specimen expose missing faces, but it is not a substitute for providing real emphasis. A global ban combined with absent italic/bold can erase visual distinctions in fallback text.

## 4. Loading behavior and fallback metrics

`font-display` is an **`@font-face` descriptor**, not a property to put on `body`. Its initial value is `auto`.

| Value | Documented behavior | Practical implication |
|---|---|---|
| `swap` | Extremely short block, unlimited swap window | Text becomes readable quickly; a late swap may reflow it. |
| `fallback` | Extremely short block, short swap window | A late font can still replace fallback during that window. |
| `optional` | Extremely short block, no swap window | The current view may remain in fallback. |
| `block` | Short block, unlimited swap window | Invisible text can delay reading and does not inherently prevent reflow. |
| `auto` | User-agent decision | Avoid assuming identical behavior across browsers. |

The browser defines the relevant timing details; the skill should not promise universal millisecond cutoffs. [MDN font-display](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@font-face/font-display)

**Practice.** Use `swap` as a reasonable starting point when the intended face should eventually appear; evaluate `optional` for speed-sensitive content where fallback is an acceptable final result. Choose deliberately and test on a cold, slow connection. Branding and long-form reading may make different tradeoffs.

**Documented.** `size-adjust` in a fallback `@font-face` scales that face's outlines and metrics. [MDN size-adjust](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@font-face/size-adjust) `ascent-override`, `descent-override`, and `line-gap-override` control font metrics used in layout; size adjustment also affects overridden metrics. [CSS Fonts Level 5, font metrics](https://www.w3.org/TR/css-fonts-5/#font-metrics-override-desc)

**Practice.** Calibrate a named fallback face against the actual target binary, chosen local fallback, weight, and content. Measure representative line widths as well as x-height and vertical metrics. A fallback that has the same x-height can still wrap differently. Never paste metric percentages from another pairing or claim zero CLS because the descriptors exist. Keep an unadjusted generic fallback at the end of the stack and test target browsers that may ignore a descriptor. MDN currently flags ascent overrides as having limited availability. [MDN ascent-override](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@font-face/ascent-override)

Do not confuse the descriptor above with the element-level `font-size-adjust` property, which preserves a selected size metric across fallback fonts. It can aid perceived-size consistency; it is not a general guarantee of identical text width. [MDN font-size-adjust](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-size-adjust)

## 5. Numerals and OpenType features

**Documented.** `font-variant-numeric` exposes tabular/proportional spacing, lining/oldstyle figures, fractions, ordinals, and slashed zero. Tabular figures give digits equal advance widths; lining figures align on the baseline. [MDN font-variant-numeric](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-variant-numeric)

Original role-based example:

```css
.amount, .timer, .metric {
  font-variant-numeric: lining-nums tabular-nums;
}
.reading-copy {
  font-variant-numeric: proportional-nums;
}
.identifier {
  font-variant-numeric: slashed-zero;
}
```

**Practice.** Apply tabular digits where values align or change, not indiscriminately to every number. Right-align comparable numeric table cells and use consistent precision when appropriate; tabular digits alone do not align varying decimal positions. Oldstyle figures can suit a prose role after review. Scope fractions to real fractions; do not accidentally transform dates or identifiers.

Prefer high-level `font-variant-*` controls when available. Use `font-feature-settings` for verified features without a suitable high-level control, such as a specific stylistic set. A tag in CSS does not create missing glyphs. [MDN font-feature-settings](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-feature-settings)

**Practice.** Inspect `GSUB`/`GPOS` and render the delivered web file before claiming that a family supports `tnum`, true small caps, `ss01`, or localized forms. Feature support can differ by face, script, language system, instance, or subset. A tabular-by-default font may work without an explicit `tnum` feature, so the visual result matters more than the tag's presence alone.

## 6. Multilingual coverage and shaping

**Documented.** `unicode-range` selects which characters a declared face may cover. When a matching character is used, the browser downloads the associated file; writing a range does not physically reduce that file. [MDN unicode-range](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@font-face/unicode-range)

**Documented.** OpenType `cmap` maps character codes to default glyphs, while shaping uses additional substitution and positioning rules organized by script and language system. Codepoint coverage therefore cannot, by itself, establish correct localized typography. [OpenType cmap specification](https://learn.microsoft.com/en-us/typography/opentype/spec/cmap), [OpenType layout organization](https://learn.microsoft.com/en-us/typography/opentype/spec/chapter2)

**Practice.** Use Google subset labels as candidate filters. Verify the exact languages and real product strings, including combining marks, punctuation, currencies, numerals, and user names. Distinguish “advertised subset,” “codepoints covered,” “shaping checked,” and “reviewed by a fluent reader.” Do not collapse these into one `supports_language: true` claim. Never assume a Latin hero pairing extends to Arabic, Devanagari, CJK, or another writing system.

Declare language on the document and on passages that change language. [W3C declaring language in HTML](https://www.w3.org/International/questions/qa-html-language-declarations) Use the HTML `dir` attribute to express text direction; language declaration does not imply direction. [W3C structural markup and RTL text](https://www.w3.org/International/questions/qa-html-dir)

```html
<html lang="en">
  <!-- ... -->
  <p lang="ar" dir="rtl">اللغة العربية</p>
</html>
```

Avoid Latin-style tracking on cursive scripts. CSS Text specifies that spacing must preserve joins and advises authors against applying letter spacing to cursive scripts when interoperable results are required. Per-letter animation wrappers can also interfere with shaping when they introduce formatting boundaries. [CSS Text Level 3, tracking and shaping](https://www.w3.org/TR/css-text-3/#letter-spacing-property)

**Practice.** Localize type roles and line-height as needed; do not apply a Western “all caps eyebrow,” negative headline tracking, or a tightly fixed line box to every script. Render mixed-script paragraphs, RTL numbers and punctuation, combining marks, and the application's longest strings. Use a fluent reviewer for unfamiliar scripts. A Latin-only visual check is not multilingual QA.

If self-subsetting, preserve required shaping behavior and intended discretionary features. FontTools' subsetter performs layout closure by default, and its feature preservation is configurable; dropping layout features or disabling closure is an explicit capability change. Preserve the features the product uses and test the output, not only the source font. [FontTools subset documentation](https://fonttools.readthedocs.io/en/latest/subset/index.html)

## 7. Licensing and provenance

The Google Fonts repository supplies font files, metadata, descriptions, and per-family license files. Its README identifies multiple licenses in the collection and specifically instructs users to read the license for each font. Self-hosting is permitted subject to those terms. [Google Fonts repository](https://github.com/google/fonts#license)

**Practice.** Record the source URL, repository revision or file version, downloaded binary checksum, license path, and license identifier. Keep the original copyright and required license notices with redistributed assets. Inspect any Reserved Font Name conditions before modifications or format/subset workflows. Do not mark every Google font “OFL,” “public domain,” or “no restrictions.”

Concrete evidence example: Alegreya's bundled license is SIL Open Font License 1.1, with conditions covering redistribution and modified versions; the license's font obligations do not automatically transfer to a document created using the font. Treat this as evidence for that artifact, not as a substitute for reading a different family's license. [Alegreya OFL file](https://github.com/google/fonts/blob/5e35378e6bda803962ee6fd257e444a7d459660d/ofl/alegreya/OFL.txt)

## 8. Using the shipped catalog and CLI

The bundled `font-catalog.json` has `schema_version: 1`, a pinned `google_fonts_revision`, `verified_at`, a limited `verification_scope`, and a `families` array. Each family records exact identity, designer, category, license evidence, metadata URL/hash, advertised subsets, family axis bounds, and faces. A static face uses `weight`; a variable face identifies `variable_axes` and `weight_range`. Its `metadata_weight` is not the variable range. `glyph_and_feature_verification: "not_checked"` explicitly records work the metadata snapshot cannot establish.

The paired `pairings.json` contains curated recipes with role families, numeric weights, optional `style` (`normal` or `italic`), and optional numeric `axes`. These role choices and contextual recommendations are design judgments. `wght` belongs in `weight`; `ital` is expressed by `style`. Same-family roles must specify the same axis key set, with explicit values allowed to differ. The current recipe schema uses scalar coordinates, not array ranges.

From the skill directory:

```sh
python3 scripts/font_tools.py family "Alegreya"
python3 scripts/font_tools.py list --context editorial
python3 scripts/font_tools.py validate
python3 scripts/font_tools.py css --recipe source-editorial
python3 scripts/font_tools.py css --recipe source-editorial --display optional
```

`--catalog PATH` and `--pairings PATH` override the bundled inputs, either before or after the subcommand. `family` prints a matching record; `list` prints a JSON array of recipes; `css` prints only the URL to stdout. Invalid input produces an explanatory stderr message and a nonzero exit. Validation checks actual static weights or variable ranges, style availability, axis bounds, selected-face axis support, and duplicate recipe IDs.

**Optical-size preservation.** When roles omit `opsz` and every eligible selected face supports it, the generator explicitly requests the cataloged optical-size range so `font-optical-sizing: auto` can work. Otherwise the CSS2 service can pin an omitted axis at its default. An explicit role `axes.opsz` remains a fixed coordinate. The automatic range adds no `font-variation-settings` declaration: keep automatic optical sizing in CSS. Other axes are requested only when roles specify them; duplicate role coordinates are removed. For example, the generated editorial request includes `Source+Serif+4:opsz,wght@8..60,400;8..60,600`. This complete request was accepted by the live CSS2 API during implementation; that one successful request does not establish all browsers, glyphs, or features.

### Verification beyond the catalog

1. Preserve the pinned metadata and validate the exact selected recipe before generating an import.
2. Request the generated URL using the intended browser class; require successful CSS and compare returned faces to the requested styles, weights, and axes.
3. Record selected font resources, byte counts, hashes, and actual binary axis/coverage/feature observations. OpenType `fvar` defines the axes, ranges, and named instances of a variable file. [OpenType fvar specification](https://learn.microsoft.com/en-us/typography/opentype/spec/fvar)
4. Render actual role text at relevant sizes, widths, features, and languages. Check the font that renders, including per-character fallback.
5. Test a cold load and blocked font requests. Verify readable fallback, measure layout movement, and compare the delivery result to the product's own budget.
6. Report passes, failures, and unavailable checks separately. Recheck when fonts, binaries, requests, languages, or browser requirements change.

`document.fonts.check()` is not proof that a requested face exists or rendered the string. It can return true when a specification can render without triggering an unloaded face, including through fallback. Pair font-loading observations with resource evidence and rendered-font inspection. [MDN FontFaceSet.check](https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/check)

The Google Fonts Developer API is an optional alternative metadata source. It requires an API key and provides variants, subsets, versions, files, and variable-axis data when requested with `capability=VF`; default responses may supply static instances. The shipped workflow uses pinned repository metadata and needs no API key. [Google Fonts Developer API](https://developers.google.com/fonts/docs/developer_api)

## 9. Source conflicts and anti-patterns to encode

- Some tutorials put `font-display` in ordinary element CSS or describe its initial value as `block`. Use the current descriptor/reference semantics above.
- Do not copy old CSS1 `subset=` examples into a CSS2 generator. Use CSS2's documented parameters and inspect returned subset declarations.
- Do not claim family-wide feature or language support from one file, specimen, or metadata category.
- Do not claim variable fonts are always lighter, hosted fonts always share a warm cross-site cache, self-hosting alone guarantees compliance, or metric matching guarantees zero layout shift.
- Do not add a font package, JavaScript loader, or full-repository clone solely to use a couple of Google families. Use the project's existing capabilities first.
- A completed engineering result includes the intended roles, requested faces, fallback behavior, real loaded resources, and evidence of rendering. An import URL alone is not completion.
