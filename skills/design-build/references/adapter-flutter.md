# Flutter port adapter (V2.0)

| Canvas token | Flutter |
|---|---|
| color hex | `ThemeData.colorScheme` / declared `Color` token |
| radius 20px | `BorderRadius.circular(20)` from token |
| spacing 16px | `EdgeInsets.all(16)` / `SizedBox` |
| font/weight | `TextStyle` from registered font asset |
| tabular figures | `fontFeatures: [FontFeature.tabularFigures()]` |

Respect `MediaQuery` window classes and safe areas. Capture widget/golden render
for parity evidence. Toolchain absent → `SPECIFIED` / `NOT_RUN`.
