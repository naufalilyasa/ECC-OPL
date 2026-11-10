---
name: design-build
description: "Coordinate a section-by-section frontend build with an owner approval loop — one design authority, prerequisite assets before freeze, per-section canvas verdicts, engine-granted assets, and a gate that verifies the final revision. Use when building or redesigning a page with the taste engine and design-contract-system, or when /design-build is invoked."
metadata:
  origin: ECC
---

# Design Build

Orchestration rules for a page build that a human approves section by section.
This skill decides **what** each phase must produce and **when** a gate is real.
It never reimplements a layer: the command shim carries the CLI invocations, and
each phase delegates to the skill named for it.

## When to Activate

- `/design-build` is invoked.
- The owner wants to design a page top to bottom with comments at each section.
- A page must be built from dealt design tokens and frozen into a contract
  before code exists.

Do not use it for a one-shot component edit or a review of an existing page.

## Layers (one job each)

| Phase | Skill | Produces |
|-------|-------|----------|
| Brief | this skill | facts, page kind, section order |
| Escalate | this skill | at most one owner decision per gate |
| Material | `ui-ux-pro-max` | candidate palettes, type, UX rules |
| Taste | `design-taste-frontend` | dealt tokens, hero, moments, effects, CSS |
| Prerequisites | `design-taste-frontend` | photographs, renders the contract will name |
| Freeze | `design-contract-system` | `DESIGN.md`, `docs/design/*`, page contract |
| Scaffold | `frontend-scaffold` | the shared shell and state shells |
| Section loop | `plan-canvas` | one approval verdict per section |
| Assemble | this skill | icons, credits, fragments, motion, diagrams |
| Gate | `design-taste-frontend` | named FAILs and a literal gate verdict |
| Harden | `gan-style-harness` | generator/evaluator iterations (opt-in) |

## Pipeline Order

```
0 Brief → 0.5 Escalate → 1 Material → 2 Taste → 3 Prerequisites → 4 Freeze
       → 5 Scaffold shell → 6 Section loop (Preview → Approval → Port → Parity Gate)
       → 7 Assemble → 8 Gate → 9 Harden
```

Three orderings are deliberate and must not be reverted:

- **Prerequisites before Freeze.** A contract must not promise a photograph or
  render that does not exist yet. Resolve it, or record an approved placeholder,
  before the contract is frozen.
- **Scaffold before the section loop.** Approving a standalone file that later
  gets re-integrated invalidates the approval. Build the shared shell first, then
  review sections against it.
- **Parity verification inside each section loop iteration.** Approving a section
  in canvas only validates the standalone HTML preview. Porting that markup into a
  framework component is lossy unless verified 1:1 against the served application
  before advancing to the next section.

## One Design Authority

The taste engine is the single source for palette, type, radius, motion, and
spacing. Everything downstream maps it, never re-derives it.

- `deal` prints **candidates**. It is not the design. Emit the real system with
  `start.mjs css` (or `start.mjs brand` for client colours) before Freeze.
- The contract records the emitted values verbatim in `TOKEN-MAP.md` and
  `THEME.md`. Where a downstream skill's default scale differs (for example the
  taste scale `4/6/8` and `8/12/20` versus a contract/scaffold default of
  `8/12/16`), the taste value wins and the mapping is written down.
- `frontend-scaffold` consumes `TOKEN-MAP.md`. It must not fall back to its own
  defaults for any token the map defines.
- When `ui-ux-pro-max` and the taste engine disagree, taste wins (its LILA RULE
  bans the violet accents the database returns for fintech).

## Section Order

Derive the order from the page kind and the brief. The generic
Hero → Value → Features → Proof → CTA → Footer is a fallback for a simple
marketing page, not a template. Record the chosen order in `BUILD-STATE.md`;
never reorder later without recording why.

## Section Loop & Live Parity Protocol (Step 6)

For each section in the chosen order (or the single section specified by `--section`):

1. **Preview & Annotation (Canvas):**
   - Write or update `docs/design/sections/<NN>-<slug>.html`.
   - Open and await feedback via `plan-canvas`. Apply annotations to preview HTML.
2. **Approval Verdict:**
   - An approval exists only as a canvas verdict item:
     ```json
     { "kind": "verdict", "verdict": "approve" }
     ```
   - Accept only an item whose `kind` is `verdict` and whose `verdict` is `approve`.
     Chat text, a bare status update, or a terminal "ok" is not approval.
   - Delegate chat replies, change requests, owner-ended sessions, and transport
     recovery to `plan-canvas`; do not invent a substitute loop.
   - Never batch-approve. Never skip a section.
   - If feedback contradicts the frozen contract, revise the contract first, then
     the section, and invalidate approvals the change affects.
3. **Framework Porting & Scoping:**
   - Immediately upon verdict approval, integrate the approved markup into target component(s).
   - **Compiler Scoping & Dynamic DOM:**
     - For elements created dynamically at runtime by client JS (`document.createElement`,
       rotating log rows, dynamic badge chips, modal inserts), ensure styles survive compiler scoping.
     - In frameworks with scoped `<style>` (Astro, Svelte, Vue), use narrowly anchored scoped
       selectors (e.g. `.dashboard-table :global(.log-new-row)` in Astro, `:deep(.log-new-row)` in Vue)
       or utility classes (Tailwind) rather than unanchored global CSS pollution.
     - Sub-component wrappers (glass overlays, floating navbars, card borders) must explicitly declare
       or inherit border-radius (`border-radius: inherit`) so enabling `overflow: visible` for dropdowns
       does not render square 90-degree corners.
   - **Asset & URL Mapping:**
     - Remap canvas-relative paths (`./assets/...`) to framework asset roots (`public/images/`,
       `public/assets/`, or module imports). Verify no asset returns HTTP 404 in the live app.
4. **Live Parity Verification (Dev Server vs Canvas Preview):**
   - **Server Readiness & Discovery:** Discover the running dev server port (e.g. `localhost:4321`).
     If offline, make one startup attempt with a 10s readiness timeout. If unreachable, record
     `status: blocked (dev server offline)` in `BUILD-STATE.md` and stop — never pass parity blindly.
   - **Visual & Geometry Parity:** Inspect live route at matching viewport, locale, and theme.
     Verify headings, CTA text, translation dictionaries (e.g. `ui.ts`), container widths,
     pill shapes, and annotation arrow offsets match the approved preview 1:1.
   - **Runtime & Hydration Parity:** Inspect browser console for hydration mismatches,
     unhandled exceptions, or failed script requests. Trigger dynamic interactions to verify
     client scripts execute without errors.
   - **Bounded Auto-fix (Max 2 Cycles):** Allow up to 2 fix-and-recheck cycles per approved
     revision. If discrepancies persist after 2 cycles, stop, log the diffs in `BUILD-STATE.md`,
     and escalate to the owner with concrete visual evidence before proceeding.
5. **Checkpoint:**
   - Record parity status and SHA-256 hashes in `BUILD-STATE.md` before advancing to the next section.

## Resume Protocol

`BUILD-STATE.md` is a handoff, not a diary. It must carry:

| Field | Why |
|-------|-----|
| target path, page kind | what is being built |
| deal reference (palette, type, radius, history files) | reproduce the system |
| contract hash, preview revision or hash | detect divergence |
| feedback ids received and applied | no double-applying a comment |
| approval evidence (verdict id or timestamp) | prove the approval is current |
| parity status (served route, port, verified at) | prove live framework rendering matches canvas |
| blocked reason | why the run stopped |

Write the checkpoint **before** ending a canvas session. On resume, revalidate
the files on disk: a missing or changed contract, preview, or asset invalidates
the approval that referenced it.

## Asset Policy

The taste engine decides which asset kinds each page type receives. Take only
what its entitlement table grants; never add a withheld kind, and never
hand-write a hero, moment, effect, or scene the engine should have dealt.

| Purpose | Medium |
|---------|--------|
| Show the actual product | real screenshot or product UI |
| Show place, people, atmosphere | photograph, licensed stand-in when the client has none |
| Explain a flow or mechanism | animated diagram, or video when a video deliverable is requested |
| Micro-feedback (hover, state change) | motion or CSS |
| Decoration only | none |

Image generation is the last resort: only for an object or render the engine has
no file for, and only when the brief asks for it. On quota exhaustion emit a
local SVG or CSS placeholder — a placeholder unblocks construction but never
counts as a gate pass.

Video is opt-in. Check that the video skill is actually installed before naming
it in the plan; if it is not, an animated diagram is the correct fallback.

## Gate On The Final Revision

- Point every checker at the **final** artifact: the served URL or the built
  output root. A framework source shell is not a valid target, and a hardcoded
  `index.html` is wrong for anything but a static page.
- Require the literal pass verdict. `GATE: OFF` is not a pass.
- Rerun the gate after any fix, any assembly change, and after Harden. Evidence
  from a previous revision is stale.
- Cap at three rounds. Then report the named FAILs and stop; do not keep
  regenerating blindly.
- If the owner ships as-is, record their words verbatim.

## Safety And Provenance

- Never invent prices, certifications, legal wording, or an irreversible scope.
  Ask in Step 0.5, or mark the copy `TBD` in the contract.
- Quote values passed to a CLI when they come from the owner's text.
- Constrain writes to the approved project root; never write outside it.
- Validate that an annotation's target selector exists before applying it.
- Get consent before overwriting an existing contract or asset.
- The asset manifest records path, purpose, engine source, status, fallback,
  source URL, author, license, and the credit reference. Provenance is not
  optional for photographs.

## Environment Limits

- Canvas serves assets from beneath the artifact directory. Copy a shared asset
  next to the preview; do not reference a parent directory or escape a symlink.
- The taste engine suppresses real contact formats and uses `.example`
  endpoints. Say explicitly which parts are demonstration-only.
- Without git, use a whole-source audit. Never initialize or stage a repository
  to make a diff work.
- A canvas outage preserves the checkpoint and reconnects. An owner-ended review
  stops the build; it does not reopen silently.

## Anti-Patterns

- Approving a preview before the shared shell and its assets exist.
- Letting scaffold or contract defaults override the dealt tokens.
- Treating `deal` output as the final system.
- Treating chat text or a terminal "ok" as approval.
- Porting approved canvas HTML to framework components without verifying live parity on the dev server.
- Writing scoped CSS for dynamic client-rendered elements without `:global(...)`.
- Leaving translation dictionary copy stale while updating only component markup.
- Gating a stale revision, or reporting success while the gate is OFF.
- Promising a deliverable that is really a demonstration.