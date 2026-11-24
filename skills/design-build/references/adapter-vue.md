# Vue port adapter (V2.0)

| Canvas | Vue 3 SFC |
|---|---|
| `<header class="topbar">` | `<header class="topbar">` (keep landmark + aria) |
| dynamic row class `.log-new-row` | `:deep(.log-new-row)` scoped to a stable ancestor |
| modal inserted to `<body>` | `<Teleport to="body">` with scoped class |
| `./assets/x.svg` | `import x from './assets/x.svg'` or `public/images/` |

Preserve computed geometry and token classes. No unscoped global `.class {}`.
