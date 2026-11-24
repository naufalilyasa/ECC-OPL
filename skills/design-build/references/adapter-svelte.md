# Svelte port adapter (V2.0)

| Canvas | Svelte 4/5 |
|---|---|
| `<header class="topbar">` | `<header class="topbar">` |
| dynamic global selector | `:global(.log-new-row)` on a stable wrapper |
| store-driven visible state | reactive `$:` / runes, preserve `aria-*` |
| `./assets/x.svg` | `import` or `public/images/` |

Svelte scopes component CSS; dynamic DOM inserted after mount needs anchored
`:global()` rules. Keep `border-radius: inherit` on wrappers with `overflow: visible`.
