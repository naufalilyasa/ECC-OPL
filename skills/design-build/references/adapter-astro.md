# Astro port adapter (V2.0)

| Canvas | Astro |
|---|---|
| static layout section | `.astro` component in `src/layouts/` or `src/components/` |
| `<header class="topbar">` | same markup inside the island/layout |
| dynamic row | `.dashboard-table :global(.log-new-row)` |
| `./assets/x.svg` | `public/images/` or import |

Astro scopes styles by default; cross-boundary/dynamic elements need `:global()`
anchored to a parent class. Islands hydrate without changing approved markup.
Never substitute an unapproved reference image (e.g. an alternative hero photo).
