# Curated Google Fonts systems

Thirty considered recipes, not an objective ranking. Roles and contextual fit are design judgments; the evidence lines describe primary-source facts. Start with the reader’s task, then compare candidates with actual content. One family is a valid complete system. For selection and repair use [selection-and-audit.md](selection-and-audit.md).

Numeric role choices are checked against the bundled repository catalog during release. Actual delivery, OpenType features, required glyphs, and the final site’s rendering need their own checks. See [tooling.md](tooling.md) for the specimen lab and validation commands. Custom axis values must be loaded and applied; optical sizing only works when the delivered font retains the optical-size axis.

## Recipe index

| Recipe ID | Contexts | Display → body → UI |
|---|---|---|
| `source-editorial` | editorial, journalism, knowledge base | Source Serif 4 → Source Serif 4 → Source Sans 3 |
| `newsreader-public` | news, policy journalism, nonprofit publishing | Public Sans → Newsreader → Public Sans |
| `literata-library` | digital library, essays, education, documentation | Literata → Literata → Source Sans 3 |
| `alegreya-literary` | literature, cultural journal, independent publisher | Alegreya → Alegreya → Alegreya Sans |
| `plex-product` | SaaS, dashboard, finance operations, enterprise | IBM Plex Sans → IBM Plex Sans → IBM Plex Sans |
| `schibsted-marketplace` | marketplace, SaaS, search, dashboard | Schibsted Grotesk → Schibsted Grotesk → Schibsted Grotesk |
| `commissioner-civic` | civic, professional services, membership, education | Commissioner → Commissioner → Commissioner |
| `hanken-saas` | SaaS, collaboration, productivity, commerce | Hanken Grotesk → Hanken Grotesk → Hanken Grotesk |
| `plex-developer` | developer tools, API documentation, technical SaaS | IBM Plex Sans → IBM Plex Sans → IBM Plex Sans |
| `recursive-tool` | developer tools, interactive education, technical portfolio | Recursive → Recursive → Recursive |
| `space-technical` | creative technology, architecture tools, engineering portfolio | Space Grotesk → Source Sans 3 → Source Sans 3 |
| `bricolage-studio` | creative studio, arts portfolio, cultural events | Bricolage Grotesque → Public Sans → Public Sans |
| `instrument-portfolio` | portfolio, architecture, design studio | Instrument Serif → Instrument Sans → Instrument Sans |
| `bodoni-luxury` | luxury, fashion, beauty, design retail | Bodoni Moda → Manrope → Manrope |
| `cormorant-culture` | museum, gallery, heritage, classical performance | Cormorant Garamond → Work Sans → Work Sans |
| `dm-hospitality` | hospitality, restaurant, travel, boutique hotel | DM Serif Display → DM Sans → DM Sans |
| `fraunces-food` | food, bakery, independent retail, hospitality | Fraunces → Hanken Grotesk → Hanken Grotesk |
| `barlow-outdoors` | outdoors, sport, travel, events | Barlow Condensed → Barlow → Barlow |
| `archivo-campaign` | ecommerce, sport, events, campaign | Archivo Black → Archivo → Archivo |
| `bitter-commerce` | ecommerce, home goods, product guides, membership | Bitter → Figtree → Figtree |
| `lora-care` | wellbeing, community, coaching, personal publishing | Lora → Lora → Nunito Sans |
| `atkinson-service` | public services, education, care services, accessible products | Atkinson Hyperlegible Next → Atkinson Hyperlegible Next → Atkinson Hyperlegible Next |
| `fredoka-learning` | children's learning, family activities, playful products | Fredoka → Nunito → Nunito |
| `space-exhibition` | arts, data exhibition, experimental portfolio, creative technology | Space Mono → Work Sans → Work Sans |
| `inria-science` | science, research institute, university lab, technical publishing | Inria Sans → Inria Serif → Inria Sans |
| `noto-multilingual` | multilingual publishing, civic, education, international organizations | Noto Serif → Noto Serif → Noto Sans |
| `noto-japanese` | Japanese, multilingual, editorial, cultural publishing | Noto Serif JP → Noto Serif JP → Noto Sans JP |
| `noto-arabic` | Arabic, multilingual, editorial, education | Noto Naskh Arabic → Noto Naskh Arabic → Noto Sans Arabic |
| `noto-devanagari` | Devanagari, Hindi, multilingual, education | Noto Serif Devanagari → Noto Serif Devanagari → Noto Sans Devanagari |
| `plex-finance-editorial` | finance, data journalism, professional services, annual reports | IBM Plex Serif → IBM Plex Sans → IBM Plex Sans |

## Recipes

### 01. A coherent editorial system

`source-editorial` · editorial, journalism, knowledge base

- **Display:** Source Serif 4 600
- **Body:** Source Serif 4 400
- **Ui:** Source Sans 3 600

Let the serif carry both the story title and sustained reading; the sans identifies navigation and actions. Related proportions make the role change feel intentional without requiring every heading to shout.

**Watch:** Enable optical sizing when the loaded font supports it; test the actual body size and longest headline. Do not add a third display family merely to make the hero different.

**Basis:** Source Serif 4 was designed to complement Source Sans 3 through related proportions and typographic color; Source Sans was designed for interfaces. [Source 1](https://raw.githubusercontent.com/google/fonts/main/ofl/sourceserif4/DESCRIPTION.en_us.html), [Source 2](https://raw.githubusercontent.com/google/fonts/main/ofl/sourcesans3/DESCRIPTION.en_us.html)

**Specimens:** [Source Serif 4](https://fonts.google.com/specimen/Source+Serif+4), [Source Sans 3](https://fonts.google.com/specimen/Source+Sans+3)

### 02. Reporting with a clear front door

`newsreader-public` · news, policy journalism, nonprofit publishing

- **Display:** Public Sans 700
- **Body:** Newsreader 400
- **Ui:** Public Sans 600

Use sturdy sans headlines for rapid scanning and the more articulated serif for the article itself. Sharing the headline family with navigation keeps a content-heavy publication from accumulating extra voices.

**Watch:** Evaluate Newsreader at reading size, with optical sizing when available. A compact news index can use Public Sans throughout; do not force article typography into tiny summary cards.

**Basis:** Newsreader was designed for continuous on-screen reading. Public Sans was developed by the United States Web Design System for interfaces, text, and headings. [Source 1](https://raw.githubusercontent.com/google/fonts/main/ofl/newsreader/DESCRIPTION.en_us.html), [Source 2](https://raw.githubusercontent.com/google/fonts/main/ofl/publicsans/DESCRIPTION.en_us.html)

**Specimens:** [Public Sans](https://fonts.google.com/specimen/Public+Sans), [Newsreader](https://fonts.google.com/specimen/Newsreader)

### 03. A digital reading room

`literata-library` · digital library, essays, education, documentation

- **Display:** Literata 600
- **Body:** Literata 400
- **Ui:** Source Sans 3 600

Keep the reading voice continuous from title to paragraph and let a restrained sans organize search, contents, and notes. This suits a product where reading is the primary experience.

**Watch:** Test the italic with real emphasis and citations; its upright construction has a distinct texture. Support reader font-size preferences; an editorial face cannot compensate for a narrow reading area or cramped leading.

**Basis:** Literata originated in Google Play Books and its current design includes optical sizes for editorial text across headlines, paragraphs, and captions. [Source 1](https://www.type-together.com/literata-font), [Source 2](https://raw.githubusercontent.com/google/fonts/main/ofl/sourcesans3/DESCRIPTION.en_us.html)

**Specimens:** [Literata](https://fonts.google.com/specimen/Literata), [Source Sans 3](https://fonts.google.com/specimen/Source+Sans+3)

### 04. Literary warmth from one type system

`alegreya-literary` · literature, cultural journal, independent publisher

- **Display:** Alegreya 700
- **Body:** Alegreya 400
- **Ui:** Alegreya Sans 700

The serif's moving, calligraphic rhythm gives essays a human voice, while its sans sibling keeps contents and labels related. Bold creates hierarchy without introducing an unrelated display style.

**Watch:** Inspect the small apparent size of UI labels before settling on CSS size. Reserve the strongest weights and extended italics for purposeful emphasis; do not make every pull quote decorative.

**Basis:** Alegreya and Alegreya Sans are sibling families originally intended for literature; both draw on humanist or calligraphic forms. [Source 1](https://raw.githubusercontent.com/google/fonts/main/ofl/alegreya/DESCRIPTION.en_us.html), [Source 2](https://raw.githubusercontent.com/google/fonts/main/ofl/alegreyasans/DESCRIPTION.en_us.html)

**Specimens:** [Alegreya](https://fonts.google.com/specimen/Alegreya), [Alegreya Sans](https://fonts.google.com/specimen/Alegreya+Sans)

### 05. One family for a working product

`plex-product` · SaaS, dashboard, finance operations, enterprise

- **Display:** IBM Plex Sans 600
- **Body:** IBM Plex Sans 400
- **Ui:** IBM Plex Sans 500

Build the hierarchy with size, spacing, and a few weights. The combination of curved exteriors and engineered details can give a practical interface recognizable character without interrupting data work.

**Watch:** Verify tabular figures in the delivered font before using them for aligned financial columns. IBM Plex has a recognizable origin; use it when that technical voice suits the product, not as a universal replacement for every sans.

**Basis:** IBM describes Plex as a system balancing natural and engineered forms, with related Sans, Serif, Mono, and Condensed families. [Source 1](https://www.ibm.com/design/impact/plex/)

**Specimens:** [IBM Plex Sans](https://fonts.google.com/specimen/IBM+Plex+Sans)

### 06. A focused marketplace interface

`schibsted-marketplace` · marketplace, SaaS, search, dashboard

- **Display:** Schibsted Grotesk 700
- **Body:** Schibsted Grotesk 400
- **Ui:** Schibsted Grotesk 500

Use a single sans voice across search results, seller details, and transactional controls. Keep large headings expressive through composition while leaving dense information predictable.

**Watch:** Judge the family with actual product names, prices, and filter labels at narrow widths. Do not compress letter spacing in dense results to fit more content; adjust columns or label copy first.

**Basis:** Schibsted Grotesk is explicitly described by its project as a digital-first family crafted for user interfaces. [Source 1](https://raw.githubusercontent.com/google/fonts/main/ofl/schibstedgrotesk/DESCRIPTION.en_us.html)

**Specimens:** [Schibsted Grotesk](https://fonts.google.com/specimen/Schibsted+Grotesk)

### 07. A civic voice with adjustable character

`commissioner-civic` · civic, professional services, membership, education

- **Display:** Commissioner 600
- **Body:** Commissioner 400
- **Ui:** Commissioner 500

Use the restrained default voice for services and forms. If the brand needs more character, introduce a measured amount of flair only in larger headings after comparing it with the default.

**Watch:** Keep custom flair and volume axes at defaults until a concrete visual comparison supports a change. Do not mistake a variable font's many possibilities for a requirement to use all of them.

**Basis:** Commissioner is a low-contrast humanist sans with classical proportions and custom axes that can change terminal forms. [Source 1](https://raw.githubusercontent.com/google/fonts/main/ofl/commissioner/DESCRIPTION.en_us.html)

**Specimens:** [Commissioner](https://fonts.google.com/specimen/Commissioner)

### 08. A personable product workhorse

`hanken-saas` · SaaS, collaboration, productivity, commerce

- **Display:** Hanken Grotesk 700
- **Body:** Hanken Grotesk 400
- **Ui:** Hanken Grotesk 600

Use a solid weight difference for headings and keep descriptions even. Its grotesque construction can support a friendly product tone while one family keeps component styling manageable.

**Watch:** Compare the 400 and 600 weights in the smallest real control; equal CSS sizes can look different across platforms. Personality should also come from language and composition; changing this font alone will not repair weak hierarchy.

**Basis:** The Hanken Grotesk project describes its geometry, metrics, and OpenType work as supporting text, interfaces, websites, and mobile applications. [Source 1](https://raw.githubusercontent.com/google/fonts/main/ofl/hankengrotesk/DESCRIPTION.en_us.html)

**Specimens:** [Hanken Grotesk](https://fonts.google.com/specimen/Hanken+Grotesk)

### 09. A related voice for prose and code

`plex-developer` · developer tools, API documentation, technical SaaS

- **Display:** IBM Plex Sans 600
- **Body:** IBM Plex Sans 400
- **Ui:** IBM Plex Sans 500
- **Code:** IBM Plex Mono 400

Let proportional text explain the product and a related mono distinguish executable examples. Shared family details connect the two without making ordinary documentation occupy code-like widths.

**Watch:** Apply the mono to code and identifiers, not every paragraph or label. Verify ambiguous characters, punctuation, and code wrapping in real snippets; a mono's name is not a legibility guarantee.

**Basis:** IBM explicitly uses Plex Mono for code snippets and Plex Sans for informative supporting text. [Source 1](https://www.ibm.com/design/language/typography/typeface/), [Source 2](https://www.ibm.com/brand/experience-guides/developer/brand/typography/)

**Specimens:** [IBM Plex Sans](https://fonts.google.com/specimen/IBM+Plex+Sans), [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono)

### 10. A variable system for a technical playground

`recursive-tool` · developer tools, interactive education, technical portfolio

- **Display:** Recursive 650; MONO 0, CASL 1
- **Body:** Recursive 400; MONO 0, CASL 0
- **Ui:** Recursive 500; MONO 0, CASL 0
- **Code:** Recursive 400; MONO 1, CASL 0

Use the casual proportional style to introduce the experience, a linear proportional style for explanation, and mono for code. The character change has an explicit job within a single family.

**Watch:** The loader must request MONO and CASL axes; a weight-only request cannot reproduce this recipe. Keep code at MONO 1 and test punctuation; do not animate axis values during reading.

**Basis:** Recursive's designer documents a MONO axis spanning proportional and fixed-width forms, plus a CASL axis spanning linear and casual forms. [Source 1](https://www.recursive.design/)

**Specimens:** [Recursive](https://fonts.google.com/specimen/Recursive)

### 11. A distinctive title above practical text

`space-technical` · creative technology, architecture tools, engineering portfolio

- **Display:** Space Grotesk 600
- **Body:** Source Sans 3 400
- **Ui:** Source Sans 3 600

The heading retains visible traces of monospaced construction, while a UI-oriented sans supplies the supporting text. Make the scale difference clear so two sans families do not compete in the same role.

**Watch:** If the two voices look redundant at the project's real sizes, simplify to one family. Avoid assigning Space Grotesk a coding role merely because of its name; it is proportional.

**Basis:** Space Grotesk is a proportional adaptation of Space Mono that retains idiosyncratic details; Source Sans was designed for interfaces. [Source 1](https://raw.githubusercontent.com/google/fonts/main/ofl/spacegrotesk/DESCRIPTION.en_us.html), [Source 2](https://raw.githubusercontent.com/google/fonts/main/ofl/sourcesans3/DESCRIPTION.en_us.html)

**Specimens:** [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk), [Source Sans 3](https://fonts.google.com/specimen/Source+Sans+3)

### 12. Expressive headings with a steady support voice

`bricolage-studio` · creative studio, arts portfolio, cultural events

- **Display:** Bricolage Grotesque 700
- **Body:** Public Sans 400
- **Ui:** Public Sans 600

Let the headline's irregular character occupy a few large moments and keep practical copy direct. The quieter supporting face makes the display choice more legible as a deliberate editorial decision.

**Watch:** Use a few large headlines; avoid carrying exaggerated width or tight tracking into mobile body text. The display family has optical and width axes; inspect which instance the loader actually delivers.

**Basis:** Bricolage Grotesque blends French and British grotesque sources, with more neutral forms at small optical sizes; Public Sans targets text and interfaces. [Source 1](https://raw.githubusercontent.com/google/fonts/main/ofl/bricolagegrotesque/DESCRIPTION.en_us.html), [Source 2](https://raw.githubusercontent.com/google/fonts/main/ofl/publicsans/DESCRIPTION.en_us.html)

**Specimens:** [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque), [Public Sans](https://fonts.google.com/specimen/Public+Sans)

### 13. A considered creative portfolio

`instrument-portfolio` · portfolio, architecture, design studio

- **Display:** Instrument Serif 400
- **Body:** Instrument Sans 400
- **Ui:** Instrument Sans 500

A condensed serif headline can provide a distinct signature while leaving descriptions and navigation precise. Their shared brand origin offers a plausible starting relationship, not a guarantee that any settings will fit.

**Watch:** Instrument Serif is a display face; keep project descriptions and small card titles in the sans when the serif becomes fragile. Do not request a synthetic bold for the serif. Its regular style can establish hierarchy through size and space.

**Basis:** Instrument Serif was designed for large sizes; Instrument Sans is the variable neo-grotesque family created for the same brand. [Source 1](https://github.com/Instrument/instrument-serif/blob/main/README.md), [Source 2](https://raw.githubusercontent.com/google/fonts/main/ofl/instrumentsans/DESCRIPTION.en_us.html)

**Specimens:** [Instrument Serif](https://fonts.google.com/specimen/Instrument+Serif), [Instrument Sans](https://fonts.google.com/specimen/Instrument+Sans)

### 14. Precise contrast for premium objects

`bodoni-luxury` · luxury, fashion, beauty, design retail

- **Display:** Bodoni Moda 500
- **Body:** Manrope 400
- **Ui:** Manrope 600

Use Bodoni's strong thick–thin rhythm as a display accent and Manrope for product facts and purchase controls. This can create a composed retail voice without sacrificing the information that supports a decision.

**Watch:** Check hairlines against the actual background on modest displays; do not use light, high-contrast serifs for small prices or controls. Avoid Manrope faux italics; use a supported emphasis strategy if the selected release lacks italics.

**Basis:** Bodoni Moda's project includes optical sizes, weights, and italics; Manrope is a variable sans-serif family. [Source 1](https://raw.githubusercontent.com/google/fonts/main/ofl/bodonimoda/DESCRIPTION.en_us.html), [Source 2](https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/DESCRIPTION.en_us.html)

**Specimens:** [Bodoni Moda](https://fonts.google.com/specimen/Bodoni+Moda), [Manrope](https://fonts.google.com/specimen/Manrope)

### 15. A gallery voice with readable practical details

`cormorant-culture` · museum, gallery, heritage, classical performance

- **Display:** Cormorant Garamond 500
- **Body:** Work Sans 400
- **Ui:** Work Sans 600

A finely drawn display serif can frame artwork or a performance while the sans handles schedules, accessibility information, and tickets. Broad spacing around the heading matters as much as the family itself.

**Watch:** Cormorant is a display project; do not assume its Garamond name makes it suitable for long small text. Keep dates and ticket controls in the supporting sans; test the serif at the smallest responsive headline size.

**Basis:** Cormorant is explicitly a display family. Work Sans's middle weights were optimized for medium-sized on-screen text. [Source 1](https://raw.githubusercontent.com/google/fonts/main/ofl/cormorantgaramond/DESCRIPTION.en_us.html), [Source 2](https://raw.githubusercontent.com/google/fonts/main/ofl/worksans/DESCRIPTION.en_us.html)

**Specimens:** [Cormorant Garamond](https://fonts.google.com/specimen/Cormorant+Garamond), [Work Sans](https://fonts.google.com/specimen/Work+Sans)

### 16. A welcoming place to stay

`dm-hospitality` · hospitality, restaurant, travel, boutique hotel

- **Display:** DM Serif Display 400
- **Body:** DM Sans 400
- **Ui:** DM Sans 500

Use the serif for the place's name and story, and the sans for room details, menus, and booking controls. Rounded supporting forms keep the strong display contrast from feeling overly formal.

**Watch:** DM Serif Display is intended for large settings; switch small titles to DM Sans. Use the serif's actual regular or italic style; do not synthesize a bold weight.

**Basis:** DM Serif Display is a high-contrast transitional design for large settings, while DM Sans is a low-contrast geometric design intended for smaller text. [Source 1](https://raw.githubusercontent.com/google/fonts/main/ofl/dmserifdisplay/DESCRIPTION.en_us.html), [Source 2](https://raw.githubusercontent.com/google/fonts/main/ofl/dmsans/DESCRIPTION.en_us.html)

**Specimens:** [DM Serif Display](https://fonts.google.com/specimen/DM+Serif+Display), [DM Sans](https://fonts.google.com/specimen/DM+Sans)

### 17. Character for food made with care

`fraunces-food` · food, bakery, independent retail, hospitality

- **Display:** Fraunces 650
- **Body:** Hanken Grotesk 400
- **Ui:** Hanken Grotesk 600

Give a short headline Fraunces's soft, irregular energy and let the sans handle ingredients, prices, and ordering. This can suggest warmth and craft without setting the whole experience in a decorative voice.

**Watch:** Choose and test the optical instance; Fraunces's softness and wonk axes can change the tone substantially. Do not turn every food brand into a retro bakery. If the brand needs precision, reduce the display treatment or choose another route.

**Basis:** Fraunces was developed as a characterful display family inspired by an informal Old Style genre; its designer documents optical-size, softness, and wonk axes. [Source 1](https://fraunces.undercase.xyz/), [Source 2](https://raw.githubusercontent.com/google/fonts/main/ofl/hankengrotesk/DESCRIPTION.en_us.html)

**Specimens:** [Fraunces](https://fonts.google.com/specimen/Fraunces), [Hanken Grotesk](https://fonts.google.com/specimen/Hanken+Grotesk)

### 18. Movement without sacrificing clarity

`barlow-outdoors` · outdoors, sport, travel, events

- **Display:** Barlow Condensed 700
- **Body:** Barlow 400
- **Ui:** Barlow 600

Use condensed headings to create vertical energy and the regular width for itinerary details or product copy. Shared construction connects both roles while width establishes a visible difference.

**Watch:** Do not use the condensed family to squeeze long paragraphs or form labels into fixed boxes. Test long place names and translated headings; narrower letters do not eliminate reflow needs.

**Basis:** Barlow is a slightly rounded, low-contrast grotesque informed by California transport lettering; Condensed and regular-width families belong to its superfamily. [Source 1](https://raw.githubusercontent.com/google/fonts/main/ofl/barlowcondensed/DESCRIPTION.en_us.html)

**Specimens:** [Barlow Condensed](https://fonts.google.com/specimen/Barlow+Condensed), [Barlow](https://fonts.google.com/specimen/Barlow)

### 19. Direct impact for a retail campaign

`archivo-campaign` · ecommerce, sport, events, campaign

- **Display:** Archivo Black 400
- **Body:** Archivo 400
- **Ui:** Archivo 600

Let the heavy headline establish a clear campaign voice and use the related regular family for product information. Strong weight contrast can do the work of extra decoration.

**Watch:** Archivo Black looks heavy but its normal CSS weight is 400 in the common Google release; verify the catalog and do not request 900 by appearance. Keep the Black face to brief headlines; for a leaner payload, compare using Archivo's heavy variable weights alone.

**Basis:** Archivo was created for highlights and headlines and references nineteenth-century American grotesques; its current variable family includes width and weight axes. [Source 1](https://raw.githubusercontent.com/google/fonts/main/ofl/archivo/DESCRIPTION.en_us.html), [Source 2](https://raw.githubusercontent.com/google/fonts/main/ofl/archivoblack/DESCRIPTION.en_us.html)

**Specimens:** [Archivo Black](https://fonts.google.com/specimen/Archivo+Black), [Archivo](https://fonts.google.com/specimen/Archivo)

### 20. Substantial headings, clear product decisions

`bitter-commerce` · ecommerce, home goods, product guides, membership

- **Display:** Bitter 600
- **Body:** Figtree 400
- **Ui:** Figtree 600

Bitter's sturdy slab forms give categories and buying guides substance; Figtree keeps descriptions and actions lighter in texture. Compare their apparent sizes instead of matching their CSS numbers blindly.

**Watch:** Bitter can create a dark paragraph texture; if it is used for long copy, retune size and leading. Check actual price glyphs and tabular features in Figtree before relying on numeric alignment.

**Basis:** Bitter is a slab-serif text design with a large x-height and relatively low stroke contrast; Figtree's designer describes it as a friendly geometric sans. [Source 1](https://raw.githubusercontent.com/google/fonts/main/ofl/bitter/DESCRIPTION.en_us.html), [Source 2](https://github.com/erikdkennedy/figtree)

**Specimens:** [Bitter](https://fonts.google.com/specimen/Bitter), [Figtree](https://fonts.google.com/specimen/Figtree)

### 21. A human voice for reflective content

`lora-care` · wellbeing, community, coaching, personal publishing

- **Display:** Lora 600
- **Body:** Lora 400
- **Ui:** Nunito Sans 600

Lora's calligraphic details can carry a calm reading experience while the non-rounded sans makes practical guidance and navigation distinct. Use comfortable spacing and direct language to avoid a sentimental tone.

**Watch:** Do not assume a serif makes information trustworthy; accuracy, organization, and accessible presentation still carry that burden. For task-heavy forms, use Nunito Sans for explanatory paragraphs as well as controls.

**Basis:** Lora is a moderate-contrast serif with calligraphic roots intended for body text. Nunito Sans is the non-rounded-terminal companion to Nunito. [Source 1](https://raw.githubusercontent.com/google/fonts/main/ofl/lora/DESCRIPTION.en_us.html), [Source 2](https://raw.githubusercontent.com/google/fonts/main/ofl/nunitosans/DESCRIPTION.en_us.html)

**Specimens:** [Lora](https://fonts.google.com/specimen/Lora), [Nunito Sans](https://fonts.google.com/specimen/Nunito+Sans)

### 22. A service designed around character distinction

`atkinson-service` · public services, education, care services, accessible products

- **Display:** Atkinson Hyperlegible Next 700
- **Body:** Atkinson Hyperlegible Next 400
- **Ui:** Atkinson Hyperlegible Next 600

Use one family and straightforward hierarchy when distinguishing characters is particularly valuable. Keep labels explicit and layouts spacious so the font's distinctive shapes support the task.

**Watch:** The family's low-vision design intent does not guarantee accessibility or make it a universal dyslexia solution. Still test with users, zoom, spacing overrides, contrast, and the actual device; typography includes more than letter shapes.

**Basis:** Braille Institute describes Atkinson Hyperlegible Next as a 2025 expansion designed around distinctive letters and numbers for readers with low vision, with additional weights and language coverage. [Source 1](https://www.brailleinstitute.org/freefont/)

**Specimens:** [Atkinson Hyperlegible Next](https://fonts.google.com/specimen/Atkinson+Hyperlegible+Next)

### 23. Playful introductions, steady instructions

`fredoka-learning` · children's learning, family activities, playful products

- **Display:** Fredoka 600
- **Body:** Nunito 400
- **Ui:** Nunito 700

Use Fredoka's full, rounded forms for activity names and Nunito's lighter texture for instructions. Shared roundness creates kinship while a firm scale and weight difference keeps roles separate.

**Watch:** A playful font is not proof of suitability for early literacy; test letterforms against the curriculum and age group. Keep directions and feedback in the support face. Limit animated or distorted display text while a child is reading.

**Basis:** Fredoka is designed for rounded, playful headlines and large text; Nunito began as a rounded-terminal sans and was expanded to a broader family. [Source 1](https://raw.githubusercontent.com/google/fonts/main/ofl/fredoka/DESCRIPTION.en_us.html), [Source 2](https://raw.githubusercontent.com/google/fonts/main/ofl/nunito/DESCRIPTION.en_us.html)

**Specimens:** [Fredoka](https://fonts.google.com/specimen/Fredoka), [Nunito](https://fonts.google.com/specimen/Nunito)

### 24. A coded voice for an arts or data exhibition

`space-exhibition` · arts, data exhibition, experimental portfolio, creative technology

- **Display:** Space Mono 700
- **Body:** Work Sans 400
- **Ui:** Work Sans 500

Use fixed-width headings as a deliberate curatorial voice and the proportional sans for interpretation and visitor details. The width contrast makes the two roles apparent even in a restrained palette.

**Watch:** Space Mono consumes horizontal space quickly; test actual titles on mobile. A monospaced display face is not automatically the best choice for dense source code or financial tables.

**Basis:** Space Mono is the fixed-width family identified as Space Grotesk's source; Work Sans's middle weights target on-screen text. [Source 1](https://raw.githubusercontent.com/google/fonts/main/ofl/spacegrotesk/DESCRIPTION.en_us.html), [Source 2](https://raw.githubusercontent.com/google/fonts/main/ofl/worksans/DESCRIPTION.en_us.html)

**Specimens:** [Space Mono](https://fonts.google.com/specimen/Space+Mono), [Work Sans](https://fonts.google.com/specimen/Work+Sans)

### 25. Research with a coherent serif and sans

`inria-science` · science, research institute, university lab, technical publishing

- **Display:** Inria Sans 700
- **Body:** Inria Serif 400
- **Ui:** Inria Sans 700

Let the sans state the research topic clearly and the serif carry the explanation. Their shared design origins connect a technical interface to longer editorial material without treating science as a futuristic costume.

**Watch:** Check the weights in the Google release; the foundry's current family may contain styles not distributed there. For mathematics, use a tested math typesetting system and its required fonts; a research-oriented text family does not establish mathematical coverage.

**Basis:** Black Foundry designed Inria Sans and Inria Serif as related styles for the research institute, with both intended for body text and display. [Source 1](https://black-foundry.com/case-studies/inria-identity-font/)

**Specimens:** [Inria Sans](https://fonts.google.com/specimen/Inria+Sans), [Inria Serif](https://fonts.google.com/specimen/Inria+Serif)

### 26. A foundation for Latin, Greek, and Cyrillic

`noto-multilingual` · multilingual publishing, civic, education, international organizations

- **Display:** Noto Serif 600
- **Body:** Noto Serif 400
- **Ui:** Noto Sans 600

Use the serif for extended reading and the sans for navigation while maintaining a coordinated language foundation. Additional scripts should be designed as explicit extensions to these roles.

**Watch:** Noto Sans and Noto Serif alone do not cover all scripts. Add the appropriate script-specific Noto families and language-aware stacks. Test real names, accents, punctuation, and locale-specific forms with fluent readers; a subset label is not full language QA.

**Basis:** The primary Noto Sans and Noto Serif families cover Latin, Cyrillic, and Greek, and are intended to complement script-specific Noto families. [Source 1](https://raw.githubusercontent.com/google/fonts/main/ofl/notoserif/DESCRIPTION.en_us.html), [Source 2](https://raw.githubusercontent.com/google/fonts/main/ofl/notosans/DESCRIPTION.en_us.html)

**Specimens:** [Noto Serif](https://fonts.google.com/specimen/Noto+Serif), [Noto Sans](https://fonts.google.com/specimen/Noto+Sans)

### 27. A Japanese reading and navigation system

`noto-japanese` · Japanese, multilingual, editorial, cultural publishing

- **Display:** Noto Serif JP 600
- **Body:** Noto Serif JP 400
- **Ui:** Noto Sans JP 500

Use the modulated Japanese face for editorial reading and the unmodulated face for interface roles. Judge kana, kanji, Latin text, and punctuation together in the real layout.

**Watch:** Use the JP family for Japanese rather than substituting SC, TC, or KR merely because characters render. Avoid importing Latin tracking or line-length rules unchanged. Check Japanese line breaking, punctuation, and mixed-script sizing with a fluent reviewer.

**Basis:** Noto Serif JP and Noto Sans JP are designed for Japanese and cover hiragana, katakana, and kanji, with Latin and other supporting glyphs. [Source 1](https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifjp/DESCRIPTION.en_us.html), [Source 2](https://raw.githubusercontent.com/google/fonts/main/ofl/notosansjp/DESCRIPTION.en_us.html)

**Specimens:** [Noto Serif JP](https://fonts.google.com/specimen/Noto+Serif+JP), [Noto Sans JP](https://fonts.google.com/specimen/Noto+Sans+JP)

### 28. An Arabic reading system with distinct UI roles

`noto-arabic` · Arabic, multilingual, editorial, education

- **Display:** Noto Naskh Arabic 600
- **Body:** Noto Naskh Arabic 400
- **Ui:** Noto Sans Arabic 500

Use Naskh forms for article titles and reading, with the less modulated sans for controls. Give both enough vertical room and treat right-to-left structure as part of the component design.

**Watch:** Apply the correct lang and direction, use logical CSS properties, and inspect mixed Arabic and Latin strings. Avoid letter-spacing that breaks the intended appearance of connected text. Do not treat Naskh as a universal substitute for every language's preferred Arabic-script style.

**Basis:** Noto documents Naskh Arabic as a modulated design suitable for longer texts and Sans Arabic as an unmodulated design. Its guidance calls for adequate shaping support and vertical space. [Source 1](https://notofonts.github.io/noto-docs/specimen/NotoNaskhArabic/), [Source 2](https://notofonts.github.io/noto-docs/specimen/NotoSansArabic/), [Source 3](https://notofonts.github.io/noto-docs/website/use/)

**Specimens:** [Noto Naskh Arabic](https://fonts.google.com/specimen/Noto+Naskh+Arabic), [Noto Sans Arabic](https://fonts.google.com/specimen/Noto+Sans+Arabic)

### 29. A Devanagari reading and learning system

`noto-devanagari` · Devanagari, Hindi, multilingual, education

- **Display:** Noto Serif Devanagari 600
- **Body:** Noto Serif Devanagari 400
- **Ui:** Noto Sans Devanagari 600

Separate reading from controls through modulation and weight while preserving script-appropriate forms. Start with generous vertical room and inspect conjuncts, vowel marks, and mixed Latin notation.

**Watch:** Use Hindi specimens only to test Hindi; confirm coverage and conventions for each other Devanagari language. Do not force Latin line heights, tracking, or faux italics onto the script. Test shaping and mark clipping in inputs as well as paragraphs.

**Basis:** Noto Serif Devanagari is the modulated design and Noto Sans Devanagari the unmodulated design for the script; Noto's usage guidance explains the need for complex shaping and adequate line height. [Source 1](https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifdevanagari/DESCRIPTION.en_us.html), [Source 2](https://raw.githubusercontent.com/google/fonts/main/ofl/notosansdevanagari/DESCRIPTION.en_us.html), [Source 3](https://notofonts.github.io/noto-docs/website/use/)

**Specimens:** [Noto Serif Devanagari](https://fonts.google.com/specimen/Noto+Serif+Devanagari), [Noto Sans Devanagari](https://fonts.google.com/specimen/Noto+Sans+Devanagari)

### 30. Financial insight connected to a working interface

`plex-finance-editorial` · finance, data journalism, professional services, annual reports

- **Display:** IBM Plex Serif 600
- **Body:** IBM Plex Sans 400
- **Ui:** IBM Plex Sans 500

Use the serif to frame an analysis or report and the sans for explanations, filters, and figures. The related construction helps an editorial introduction lead naturally into a functional data view.

**Watch:** Confirm lining/tabular numerals and currency symbols in the delivered sans, then right-align comparable numeric values. Do not set every KPI in the serif just to make it feel prestigious; prioritize rapid comparison and stable alignment.

**Basis:** IBM Plex Serif, Sans, Mono, and Condensed were designed as a coordinated family; IBM documents currency symbols and OpenType features across the system. [Source 1](https://www.ibm.com/design/language/typography/typeface/)

**Specimens:** [IBM Plex Serif](https://fonts.google.com/specimen/IBM+Plex+Serif), [IBM Plex Sans](https://fonts.google.com/specimen/IBM+Plex+Sans)

