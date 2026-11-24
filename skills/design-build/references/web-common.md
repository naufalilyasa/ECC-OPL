# Web common adapter (V2.0)

Shared rules for all web targets. Translate the approved canvas; do not redesign.

## Asset remap
Canvas-relative `./assets/x.svg` → `public/images/x.svg`, `public/assets/x.svg`,
or a module import. Never leave a `./assets` path in bundled output — verify no
HTTP 404 in the live app. Validator rejects `ASSET_404: ./assets/icon.svg not remapped`.

## Scoped selectors (compiler scoping)
Frameworks that scope `<style>` need anchored selectors for dynamic DOM:
- Astro: `.dashboard-table :global(.log-new-row)`
- Vue: `.dashboard-table :deep(.log-new-row)`
- Svelte: dynamic globals via `:global()` on a stable ancestor class.

Never emit unanchored global CSS that spills beyond the component.

## Responsive & hydration
Keep approved breakpoints (390/768/1440). Preserve markup so SSR/hydration
produces no mismatch. Tabular figures and radius come from declared tokens.

## Actual fidelity requirements (browser-measured)
The port must preserve, and G2 measures in a real browser (matching viewport, DPR,
theme, locale, fonts, fixture data, interaction state):
- approved CSS values and computed styles (padding, display, visibility, radius);
- markup hierarchy and landmark bounding boxes;
- asset URLs (no 404) and declared typography (family/size/weight/wrap);
- responsive geometry at every declared viewport and each applicable state.
A source-level regex is a triage hint only — it can never grant `PARITY_PASS`.
See `parity-chain.md` and `docs/design/evidence/p-web1/rendered-parity.json`.
