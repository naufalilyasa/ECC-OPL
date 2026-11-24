// Deterministic, dependency-free JSX→HTML renderer for the synthetic P-WEB1
// AppLayout stand-in. Produces the DOM React would emit for this simple markup,
// so the browser measures a rendered implementation, not a TSX regex. No React
// runtime is installed and none is fetched. This is SSR-equivalent static markup.
// Supports: className=, aria-label=, role=, literal text children, {children} omitted.
export function jsxToHtml(tsx, drift = {}) {
  const body = tsx.replace(/^\s*import[\s\S]*?\n/, '').replace(/export\s+function[\s\S]*?\{/, '')
  const inner = body.slice(body.indexOf('return'), body.lastIndexOf(')'))
  let html = inner
    .replace(/return\s*\(?\s*/, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/className=/g, 'class=')
    .replace(/\{children\}/g, '')
    .replace(/<main>\s*<\/main>/g, '')
    .replace(/\s*aria-label=/g, ' aria-label=')
  // strip TS type annotation `({ children }: { children?: React.ReactNode })`
  html = html.replace(/^\s*\{[^)]*\}\)\s*/, '')
  // Intentional drift injected by the harness: hide the parent shell, or override
  // padding inline. Both are framework-side changes; approved canvas stays on disk.
  if (drift.hideParent) {
    html = html.replace('class="app-shell"', 'class="app-shell" style="display:none"')
  }
  if (drift.inlinePaddingTop !== undefined) {
    html = html.replace('class="topbar pt-4"', `class="topbar pt-4" style="padding-top:${drift.inlinePaddingTop}px"`)
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root { --bg:#0b1220; --fg:#e6edf7; }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--fg); font:14px/1.4 system-ui,sans-serif; }
.topbar { display:flex; align-items:center; gap:12px; padding:16px 16px; min-height:56px; }
.pt-4 { padding-top:16px; }
.warehouse-badge { display:inline-flex; align-items:center; gap:6px; border-radius:999px;
  padding:4px 10px; background:#13213a; font-variant-numeric:tabular-nums; }
.brand { font-weight:600; }
</style></head><body>${html}</body></html>`
}
