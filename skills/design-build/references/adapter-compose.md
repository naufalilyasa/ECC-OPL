# Jetpack Compose port adapter (V2.0)

| Canvas token | Compose |
|---|---|
| color hex | `MaterialTheme.colorScheme` / declared token |
| radius 20px | `RoundedCornerShape(20.dp)` |
| spacing 16px | `Modifier.padding(16.dp)` |
| font/weight | `TextStyle` from `MaterialTheme.typography` |
| wrapping row | `FlowRow` with `Arrangement`/`Alignment` |

Respect `WindowSizeClass` and `WindowInsets` (system bars). `Modifier` order is
significant — match approved geometry. Screenshot/semantics capture for parity.
Toolchain absent → `SPECIFIED` / `NOT_RUN`.
