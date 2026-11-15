# DATA-VIZ — Chart Token Contract

> Optional. Use this template only when the product actually renders charts or KPI visualizations. Charts carry a **separate color namespace** from status, because a categorical series color is not a business status.
>
> When generated, append the chart tokens below to `THEME.md` and define their Light/Dark values in `globals.css`, following the same kebab-case naming as the semantic tokens.

---

## 1. Two Namespaces, Never Mixed

| Namespace | Purpose | Token family |
|---|---|---|
| Categorical | Distinguish data series from each other | `chart-series-1…n` |
| Severity / status | Express a business judgment | `success`, `warning`, `danger`, `info`, `neutral` |

**Rule:** green and amber inside a categorical chart do **not** mean success and warning. If a chart genuinely visualizes status, use the status tokens and say so in the legend — do not reuse the categorical palette and hope the reader infers it.

Avoid overlapping meanings in one chart: if a categorical palette already contains green or amber and the same chart also shows a success/warning indicator, drop those hues from the categorical set and separate series by shape or pattern instead.

## 2. Structural Tokens

Keep the frame neutral so the data carries the color:

| Token | Role | Must stay neutral |
|---|---|---|
| `chart-grid` | Gridlines | yes |
| `chart-axis` | Axis line | yes |
| `chart-axis-label` | Tick text | yes |
| `chart-track` | Progress/track fill | yes |
| `surface-raised` | Tooltip container (existing token) | yes |

Never color axis labels, gridlines, or tooltip surfaces with a series color.

## 3. Series Rules

- Order series deterministically; `chart-series-1` is the default first measure.
- Cap the palette at 6 core series. Anything beyond that is "add only if truly needed" and must stay distinguishable.
- Pair series with a second channel — legend order, direct labels, line style, or marker shape — so the chart survives grayscale and color vision deficiency.
- Consistent meaning across screens: the same metric keeps the same series token everywhere.

## 4. Required States

A chart is not finished until all of these are specified:

| State | Requirement |
|---|---|
| Loading | Skeleton or placeholder preserving layout; never an empty axis |
| Empty | Explicit "no data" message; not a flat zero line |
| Single data point | Renders without implying a trend |
| Zero vs no data | Visually and textually different |
| Partial / stale data | Marked with a timestamp or badge |
| Error | Text error, not an empty chart |
| Overflow | Long labels truncate with a tooltip; long numbers stay readable |

## 5. Accessibility

- Meaning-bearing graphics need at least 3:1 contrast against adjacent colors.
- Provide a text or table alternative for any chart that carries information.
- Tooltips must be reachable by keyboard and not be the only place a value appears.
- Never rely on hue alone to separate two series.

## 6. Boundaries

- Do not alter data, aggregation, units, filters, or calculation logic to make a chart look better.
- Do not fabricate a series, target line, or threshold that the product does not define.
- Preserve existing chart behavior; change presentation only.
