# Native common adapter (V2.0)

Native equivalence — not universal pixel identity, and never a silent webview.

## Units & layout
- px → logical px (Flutter `dp`, Compose `dp`); typography px → `sp` with font-scale.
- Map canvas viewport classes to window-size classes; preserve safe-area insets.
- Homologous content regions keep the same hierarchy and dense data labels.

## Explicit native adaptation contract
Every native port declares, per target, before porting: logical geometry (dp),
font metrics (sp + font-scale), density buckets, safe-area insets, constraint/layout
behavior, and native default widget styling that differs from the canvas. A deviation
from the approved canvas that is not in this declaration requires explicit adaptation
approval and invalidates the affected baseline. Do not claim Flutter or Compose
verified without actual native rendering on a local toolchain.

## Optical tolerance
Named tolerances per property (alignment, spacing, radius) — no single global
similarity score. Record measurements in the evidence receipt.

## Webview guard
A webview substitute that wraps approved HTML is a `NATIVE_VIOLATION: silent
webview substitution rejected`. Native targets must render native widgets.

If the local toolchain is absent, report support level `SPECIFIED` and gate
`NOT_RUN` — do not claim parity that was not measured.
