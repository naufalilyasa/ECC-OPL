# Status Semantics — Business State to Semantic Role

> A status color is a **contract**, not a decoration. The same business condition must resolve to the same semantic role in every module, screen, and theme. This file governs that mapping; the palette itself lives in `THEME.md`.

---

## 1. One Resolver, Fixed Roles

- Define a single status resolver that maps each business enum value to one semantic role: `success`, `warning`, `danger`, `info`, `neutral`.
- Components consume the role, never the raw enum: `<Badge role={resolver(status)} />`.
- Never create a unique color per API status. A new enum value is a mapping decision, not a new token.
- The role is stable across light and dark. The theme changes the value, never the role.

## 2. Mapping Rules

| Rule | Requirement |
|---|---|
| Unknown value | `neutral` + explicit label (`Unknown`, `Not available`). **Never** fall back to `success`. |
| Empty vs zero vs failed | Three different states. Empty is `neutral` with `—` or `N/A`; `0` is data; failed is `danger`. Never conflate them. |
| Pending / awaiting decision | `warning` (action needed), not `danger`. |
| Confirmed negative outcome | `danger` only when the condition is verified by policy or data. |
| System failure | `danger`, and visually distinct from an adverse *user* status. A sync or integration error is not a user input violation. |
| Administrative state | `neutral`. Draft, archived, paused, suspended, inactive, and closed-by-policy records are **not errors**. |
| Informational process | `info`. Onboarding, in-progress, submitted-and-waiting. |
| Deadline risk | `warning` **only** when a real policy threshold exists. Never invent expiry windows to justify a color. |
| Purely descriptive attribute | `neutral` tag. Department, job title, grade, contract type, location, gender, and other identity attributes must never carry an evaluative color. |
| Categorical grouping | Use the categorical chart palette (`templates/data-viz.md`), not status roles. |

## 3. Non-Negotiable Boundaries

- **Color is never the only carrier.** Every status also has a label; where space allows, an icon or shape. Badges must stay distinguishable in grayscale and in red-green color vision deficiency.
- **Never change business logic to fit the design.** Do not alter a state machine, backend enum, permission, or data contract to produce a nicer color. Record the mismatch and escalate instead.
- **Never invent statuses, thresholds, or SLAs.** If the enum or policy is not in the codebase, map what exists and list the rest as open questions.
- **Scope the tint.** Color the badge, dot, or severity bar — not the entire row, card, or page. One focal point per region.
- **Selected state does not erase status.** Row selection, hover, and focus must remain visually distinct from status badges and error markers.

## 4. Output Contract

When generating a contract, emit a table the implementer can follow directly:

| Business status | Semantic role | Label | Notes |
|---|---|---|---|
| Active | success | `Active` | Operational state, not a quality score |
| Pending approval | warning | `Pending` | Awaiting decision |
| Unknown | neutral | `Unknown` | Never rendered as success |
| Archived | neutral | `Archived` | Administrative, not a failure |
| Sync failed | danger | `Sync failed` | System error, separate from record status |

Every generated status row must cite where the enum comes from (model, enum file, or policy doc). If it cannot be cited, mark it `unverified` instead of choosing a color.
