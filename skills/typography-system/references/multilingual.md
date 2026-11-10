# Multilingual typography routing

Research checked 2026-09-06 UTC. These are practical safeguards, not a complete language specification. W3C layout notes and drafts describe script requirements; they are not additional WCAG success criteria. No native-reader validation has been performed on the examples below.

## Start with language, script, and region

Record the supported locales and actual content: names, numbers, punctuation, symbols, quotations, and forms. Set HTML `lang` on the document and relevant language changes; set `dir` independently for direction. Language affects processing and font selection, while alignment alone does not establish bidirectional behavior. [W3C: Declaring language](https://www.w3.org/International/questions/qa-html-language-declarations), [W3C: Structural markup and RTL text](https://www.w3.org/International/questions/qa-html-dir)

Use [font-catalog.json](font-catalog.json) as a shortlist with metadata evidence. Subset labels do not prove complete glyph coverage, correct shaping, regional suitability, or successful delivery. Give every script a deliberate fallback; match companions by perceived size, darkness, and rhythm rather than equal CSS numbers. Required script companions do not count as gratuitous extra design voices.

## Latin accents and Vietnamese

Check the exact languages instead of assuming “Latin” is enough. Test upper- and lowercase accented letters, combining sequences, punctuation, and currencies in normal, bold, and italic styles actually used. The catalog records Vietnamese subsets for candidates including Alegreya, Source Sans 3, Noto Sans, and Noto Serif; inspect those candidates in context before selecting one.

Vietnamese tone marks may appear with another diacritic, so clearance, positioning, and differentiation matter. Inspect stacked marks at the smallest supported text size and at display scale; check that upper accents and below-base marks survive tight cards, buttons, and line heights. Donny Trương's specialist guide explains the design of these combinations. [Vietnamese Typography: Diacritical Details](https://vietnamesetypography.com/diacritical-details/), [Tone Marks](https://vietnamesetypography.com/tone-marks/)

As a robustness test, compare canonically equivalent text in composed and decomposed forms; do not remove accents to simplify rendering or force user content into a different spelling. Unicode normalization concerns equivalent encodings, not permission to discard distinctions. [Unicode: Normalization Forms](https://www.unicode.org/reports/tr15/)

## Arabic: direction and connected shaping

Begin with cataloged Noto Naskh Arabic or Noto Sans Arabic according to intended voice, then test actual text and weights. Do not infer Persian or Urdu suitability from a successful Arabic sentence; script, language, and typographic tradition remain distinct. Arabic letters change shape with context, and numbers or Latin identifiers introduce mixed-direction runs. [W3C: Arabic & Persian Layout Requirements](https://www.w3.org/TR/alreq/)

Use `dir="rtl"` for an Arabic block. Isolate a known LTR identifier with direction markup; use `bdi` or an appropriate `dir="auto"` wrapper for unknown-direction inserted content. Include punctuation and adjacent numbers in the test because their order can expose failures hidden by an Arabic-only sentence. Do not manually reverse characters. [W3C: Inline markup and bidirectional text](https://www.w3.org/International/articles/inline-bidi-markup/)

Avoid global tracking and character-by-character animation wrappers. CSS requires preserving cursive joins and warns about inconsistent letter-spacing behavior; padding, margins, and certain inline boundaries can interrupt shaping. Animate a whole word or block when correct shaping is uncertain. Inspect vowel marks and descenders before reducing line height. [CSS Text: tracking and shaping](https://www.w3.org/TR/css-text-3/#letter-spacing-property)

## Devanagari: preserve meaningful clusters

Noto Sans Devanagari and Noto Serif Devanagari are cataloged starting candidates. Test the requested language: Hindi samples do not verify Marathi, Nepali, Sanskrit, or every Devanagari extension.

Consonant combinations, vowel signs, and modifiers form units that cannot safely be treated as independent displayed letters. Preserve orthographic syllables when styling initials, introducing breaks, or animating text. Never split by JavaScript code unit; even a grapheme-based implementation still needs actual conjunct and browser checks. W3C's Indic layout draft discusses these units; consult its newer Devanagari resource index for current issues. [W3C: Indic Layout Requirements](https://www.w3.org/TR/ilreq/), [Devanagari Script Resources](https://www.w3.org/TR/deva-lreq/)

Inspect marks above and below, conjunct formation, selection, and wrapping with the final font. Keep shaping features enabled. When a title clips, adjust its container and line geometry; do not delete a mark or break a cluster to make it fit.

## CJK: route by locale, not a single umbrella font

Cataloged Noto Sans JP and Noto Serif JP are Japanese candidates. This catalog currently has no dedicated Chinese or Korean families. Verify appropriate Google Fonts families for those locales before promising support. Shared Han code points can have different preferred regional glyphs; Unicode recommends locally appropriate fonts for optimal results. A glyph being present does not prove its form is right for the reader. [Unicode: Chinese and Japanese FAQ](https://unicode.org/faq/han_cjk.html)

Japanese composition has rules restricting line starts and ends, including punctuation and brackets; Chinese composition also has contextual punctuation rules. Start with browser language-aware wrapping, then test narrow columns containing quotations and mixed Latin text. Avoid blanket `word-break: break-all` or `keep-all` as a universal CJK fix. Choose stricter or looser behavior for the actual language and product after inspection. [W3C: Japanese Text Layout](https://www.w3.org/TR/jlreq/), [Chinese Text Layout](https://www.w3.org/TR/clreq/)

If Korean is supported, evaluate its word-based and syllable-based break conventions separately; do not transplant Japanese behavior. Ruby, vertical writing, and emphasis dots need their own review when present. [W3C: Approaches to line breaking](https://www.w3.org/International/articles/typography/linebreak.en)

## Thai: segmentation is part of layout

Thai is written left to right, and spaces generally separate phrases rather than individual words. Browsers therefore need language-sensitive segmentation to find useful breaks. Test paragraphs and narrow controls without inserting artificial spaces between every word. Avoid treating `split(" ")` as a word-segmentation solution. [W3C: Thai Script Resources](https://www.w3.org/TR/thai-lreq/), [Approaches to line breaking](https://www.w3.org/International/articles/typography/linebreak.en)

The catalog currently has no dedicated Thai family: verify a Google Fonts candidate's metadata and delivered fonts before implementation. Inspect vowels and tone marks above/below the line, especially in buttons and emphasized text. Give the script sufficient height; equal Latin and Thai CSS line heights need not yield equivalent clearance. [W3C: Text size in translation](https://www.w3.org/International/articles/article-text-size)

## Neutral starter specimens

These original test sentences are layout fixtures, not approved translations or exhaustive glyph tests. Add the product's real content and native-reader review where available.

| HTML language | Test string | Inspect |
| --- | --- | --- |
| `fr` | Bibliothèque ouverte — Élodie, Noël, façade. | Accents, punctuation, italic |
| `vi` | Thư viện mở cửa lúc 8 giờ. Nguyễn, tiếng Việt, Ắ Ệ Ỡ ự. | Stacked and below-base marks |
| `ar`, `dir="rtl"` | المكتبة مفتوحة اليوم. | Joining and line height |
| `hi` | पुस्तकालय में आपका स्वागत है। किताब, क्षेत्र, दृष्टि, ज्ञान, फ़ाइल। | Vowels, conjuncts, nukta |
| `ja` | 図書館は午前9時に開きます。「新着案内」をご覧ください。 | Brackets, punctuation, mixed digits |
| `zh-Hans` | 图书馆上午九点开放。请查看“最新消息”。 | Simplified regional forms |
| `zh-Hant-TW` | 圖書館上午九點開放。請查看「最新消息」。 | Traditional regional forms |
| `ko` | 도서관은 오전 9시에 문을 엽니다. | Word/syllable wrapping |
| `th` | ห้องสมุดเปิดเวลาเก้าโมง กรุณาอ่านข้อมูลเพิ่มเติม | Segmentation and stacked marks |

Use a mixed-direction fixture too:

```html
<p lang="ar" dir="rtl">
  رقم الطلب: <bdi dir="ltr">AB-123 (2026)</bdi>.
</p>
```

Render fixtures at heading, paragraph, and smallest control sizes; at narrow widths; in all used styles; and with web fonts unavailable. Check missing-glyph boxes, accidental fallback within words, clipping, line-break behavior, and direction. Reuse the zoom and spacing checks in [typography-systems.md](typography-systems.md). Record unresolved script issues explicitly instead of declaring multilingual quality from one screenshot.
