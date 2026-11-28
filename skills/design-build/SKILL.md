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

## Artifact root (work-item binding)

Every `docs/design/...` path in this skill resolves against `DESIGN_ROOT`:

- bound (default): `.ecc-opl/work-items/<ITEM>/design`, where `<ITEM>` is this task's identity
  from `work-item.js bind --slug "<this-task-slug>"` (explicit ID → that item, related active
  item → continue, otherwise a new item). `.ecc-opl/active` alone is the last-active pointer,
  not the decision.
- standalone: `docs/design`, only under `--standalone` / `ECC_OPL_STANDALONE=1`, or when the
  helper is not installed at all

The same relative structure applies under either root (`DESIGN.md`, `contracts/`,
`BUILD-STATE.md`, `ASSETS.md`, `TYPOGRAPHY-MAP.md`, `sections/`, `evidence/`). `--resume` reads
`$DESIGN_ROOT/BUILD-STATE.md` first and falls back to `docs/design/BUILD-STATE.md`. Canvas state
stays host-owned in `~/.claude/plan-canvas*/`; a bound run adds a pointer at
`.ecc-opl/work-items/<ITEM>/canvas/session.json`. Standalone behaviour, including the
never-reinterpreted rule for an HTML approval across `standalone-html` and `framework-native`
modes, is unchanged.

## Layers (one job each)

| Phase | Skill | Produces |
|-------|-------|----------|
| Brief | this skill + `frontend-design-direction` | facts, page kind, section order, product direction |
| Escalate | this skill | at most one owner decision per gate |
| Material | `ui-ux-pro-max` | candidate palettes, type, UX rules |
| Prerequisites (cross-cutting) | `a11y` | applicable accessibility requirements (before Freeze) |
| Taste | `design-taste-frontend` | dealt tokens, hero, moments, effects, CSS |
| Prerequisites | `design-taste-frontend` | photographs, renders the contract will name |
| Freeze | `design-contract-system` | `DESIGN.md`, `docs/design/*`, page contract |
| Scaffold | `frontend-scaffold` | the shared shell and state shells |
| Section loop | `plan-canvas` | one approval verdict per section |
| Assemble | this skill | icons, credits, fragments, motion, diagrams |
| Gate | `design-taste-frontend` + `frontend-design-direction` (evidence checker) | named FAILs, literal gate verdict, rendered-evidence record |
| Harden | `gan-style-harness` | generator/evaluator iterations (opt-in) |

Cross-cutting knowledge sources, routed in only when relevant (never duplicated
here): `frontend-design-direction` (Phase 0 direction, Phase 4 verify, Phase 8
checker) and `a11y` (before Freeze requirements, Phase 5/6 implementation and
verification). They are not new phases and add no new numbered gate.

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
  before advancing to the next section. **This applies to `standalone-html` only**
  — see the two preview modes below.

## Two Preview Modes (discovery first)

Discover the mode before choosing how to preview or port. Never assume HTML.

```bash
node scripts/design-build-v2/detect-project.mjs <project-root>
```

It returns a profile (`status`, `framework`, `variant`, `language`, `entrypoint`,
`devCommand`, `packageManager`, `stylingSystem`, `componentLibrary`,
`dependencies`, `previewMode`, `evidence`). An `ambiguous` status means conflicting
signals were found and reported, not silently resolved — ask the owner.

- **`framework-native`** (React, Vue, Svelte, Next, Nuxt, Angular, Laravel+Inertia):
  the section IS a real component in the project. Approve that component.
- **`standalone-html`** (static pages, Flutter, Kotlin Compose, unknown stacks):
  the legacy HTML preview → port → parity loop, unchanged.
- A project that is `unsupported` or `ambiguous` gets an explicit report, not a
  guess and not a silent fallback to HTML.

### Native mode rules (binding)

1. **Inspect before generating.** Read the project's existing components, inputs,
   tokens, styling system and primitives first (DBN-03). Generate a component that
   follows the conventions already in the project rather than a parallel design
   vocabulary. Reuse installed dependencies; never add or replace one without the
   owner's authorization.
2. **Single source.** The generated component file is the thing the owner reviews
   AND the thing that ships. There is no HTML substitute and no second artifact to
   keep in sync. `verifyIdentitySeparation()` is scoped to `standalone-html`;
   in native mode the approved reference and the implementation are the same
   source, so equal source digests are expected, not a conflation.
3. **Preview is the real component.** Render it through the project's own dev
   server in the Canvas, naming the reviewed revision:

   ```bash
   node <ECC>/scripts/plan-canvas.js open <section-file> \
     --preview-url http://127.0.0.1:<port>/<route> \
     --preview-mode framework-native \
     --section <NN>-<slug> --revision <rN> \
     --revision-digest <sha256> --design-digest <sha256> \
     --framework <name> --data-mode <fixture|production>
   ```

   Both digests come from `fingerprintNativeReference()` over the files that shape
   the render. The approval verdict repeats the same section/revision/digests, and
   the Canvas rejects one that names a revision it no longer previews
   (`STALE_REVISION`): re-open on the current revision and ask for a fresh verdict.
   Never copy `session.previewMeta` onto an empty verdict to satisfy the check.

   If the server fails, report the real compiler/dependency/route error. **Never**
   generate an HTML version as a stand-in for a failed native preview, and never
   let a placeholder count as approval evidence.
4. **Fixture-only is not completed backend integration.** Representative fixture
   data may be used to prove the design. A section built on fixtures must say so
   (`dataMode: "fixture"`) in `BUILD-STATE.md` and the completion report, and must
   never claim the backend is connected.
5. **In-frame annotation needs the canvas dev-server adapter.** The project page is
   cross-origin from the Canvas, so the annotation SDK only reaches it when the app's
   dev server injects it: the Vite plugin `planCanvasAnnotations()` in `vite.config`,
   or the Blade include `vendor.ecc-plan-canvas.sdk` in the root layout for
   Laravel/Inertia. Add it temporarily, report it, and remove it after review. Without
   the adapter the annotate toggle stays disabled and feedback is chat + verdict;
   report which case applies instead of implying markup-level annotation works.
6. **Visual edit mode is opt-in and still ends in source.** Open with `--edit-mode`
   when the owner wants to adjust the live component rather than describe the change:

   ```bash
   node <ECC>/scripts/plan-canvas.js open <section-file> \
     --preview-url ... --preview-mode framework-native --edit-mode ...
   ```

   The owner selects an element, changes a property, and presses **Apply to source**.
   That posts one `kind: "edits"` change set over the existing feedback endpoint
   (route, viewport, per-element target identity, before/after per property). The
   preview-side overrides are memory only: they are cleared the moment the server
   acknowledges the change set, before you touch source. Then:

   - read the change set from the session transcript, apply it to the real component
     with the project's own styling system, and keep the change at instance scope
     unless the owner explicitly asked for the shared primitive;
   - never infer a breakpoint name or a design token from a computed value: a
     coincidental CSS match is not an authored token reference;
   - after the edit lands, let HMR replace the element and verify the actual
     source-rendered output with no overrides applied. A server acknowledgment is
     not implementation success;
   - if an element was replaced by HMR before Apply, its target is stale — ask the
     owner to reselect instead of reattaching by position.

   `standalone-html` sections keep the legacy annotate/verdict loop. Edit mode is
   unavailable there and the toggle is simply absent.

### What requires re-approval, and what does not

| Change | Re-approval? | Verification |
|--------|--------------|--------------|
| Approved design: layout, contract, tokens, styling system, typography, assets | **Yes** | rerun the affected gate |
| Backend connection, controller fix, tests, refactor with identical rendering | No | parity/rendered-integrity still reruns |
| Fixture → production data with no design change | No | still reruns; record the `dataMode` change |

Approval covers the design decision, not the implementation state. Silently
re-sealing new design bytes under an old approval is forbidden.

### Migration: sections already in flight

The mode is decided **per section** at discovery time and then recorded. It is
never re-litigated, and one project may hold both modes at once.

- A section already in progress under `standalone-html` finishes under the legacy
  HTML → port → parity loop. Do not convert it mid-flight: the approved HTML is
  the evidence the owner signed.
- An HTML approval is **never** reinterpreted as a native approval. Rebuilding a
  legacy section as a component is a new section with a new approval; the old
  HTML evidence stays on disk untouched.
- Historical evidence is append-only: existing canvas sessions, receipts,
  `BUILD-STATE.md` fields and parity records are not rewritten or re-stamped.
- On resume, the section's recorded `previewMode` wins. Re-run discovery only for
  sections that have not started; a fresh detection never switches a running
  section's mode.
- Projects with no `active.json` are outside this workflow and stay untouched.

## Workflow State (required)

Write `.opencode/workflows/active.json` at the start and rewrite it at every
phase change, so the section order and the approval gate survive
dcp-compress, `/aside`, and long sessions:

```json
{
  "workflow": "design-build",
  "phase": "section-loop",
  "steps": ["hero", "value", "features", "proof", "cta", "footer"],
  "current": 0,
  "state": "CANVAS_APPROVED",
  "approvedBundleSha256": "<64-hex full-bundle digest>"
}
```

- `steps` is the approved section order, `current` the zero-based index being
  built, `phase` one of `brief | taste | freeze | scaffold | section-loop | gate | done`.
- **One canonical section lifecycle.** States: `PREVIEW_DRAFT → AWAITING_APPROVAL →
  CANVAS_APPROVED → PORT_IN_PROGRESS → PARITY_PENDING → PARITY_PASS → SECTION_COMPLETE`
  (see plan §5). `CANVAS_APPROVED` records consent to the exact sealed bundle and
  NEVER advances `current`. `PREVIEW_DRAFT` must never advance directly to
  `SECTION_COMPLETE`; `PARITY_PENDING` is a valid state. `current` increments once,
  only after verified completion. Transition and receipt checks are the PRODUCTION
  modules `scripts/design-build-v2/state-machine.mjs` (`advanceCheckpoint`,
  `verifyReceipt` with MANDATORY context) and `scripts/design-build-v2/rendered-authority.mjs`
  (`verifyRenderedParity` with actual screenshot bytes + per-viewport measurements).
- **Native mode reuses the same state names** (decision D6) with mode-dependent
  meaning: `PORT_IN_PROGRESS` = `INTEGRATING` (wiring the approved component into the
  app, not translating HTML), and `PARITY_PENDING` = rendered-integrity verification
  of the single source in its real context. A missing approval before the Canvas
  stage returns `CANVAS_APPROVAL_REQUIRED` — normal progress, not a startup blocker.
- A source-level verdict (`kind:"verdict", verdict:"approve"`) is not rendered evidence;
  it cannot advance the checkpoint. G2 authority is the browser measurement artifact
  (`docs/design/evidence/p-web1/rendered-parity.json` for P-WEB1).
- Enforcement is cooperative (`COOPERATIVE_NOT_MANDATORY`); the `workflow-gate`
  plugin is not assumed active under OpenCode. The runner enforces the lifecycle.

Schema and rules: `workflow-state` skill.

## Typography lifecycle (design-build integration)

Typography is decided once, before freeze:
- If no approved typography contract exists (`docs/design/TYPOGRAPHY-MAP.md` absent),
  run `/typography` in `DESIGN` mode before freezing the canvas.
- If an approved contract exists, reuse it verbatim — do not reselect fonts.
- During port and parity, typography is **VERIFY only**: no font reselection, no
  wrapping/line-height changes, no redesign. A font fallback or wrap drift fails G2
  as a rendered measurement (`fontFamily`/`fontSize`/bounding box).
- `AMEND` requires explicit owner approval and invalidates the affected baseline
  bundle + parity receipt; it is `MUTATION_BLOCKED` post-freeze without that approval.
- Typography DESIGN owns font selection and role mapping before freeze. After
  freeze, the approved `TYPOGRAPHY-MAP.md` and design contract are authoritative;
  the taste engine never overrides them. Porting uses VERIFY only; AMEND needs
  explicit owner approval.

## Product Direction & Accessibility (cross-cutting integration)

Two existing skills are routed in **by reference**; their full contents are
never duplicated here. Load each only at the phase that needs it. Do not reload
the design collection for every section, and do not concatenate either skill
into this file.

### Phase 0 — Product direction (`frontend-design-direction`)

Before any creative candidate selection, load `frontend-design-direction`
(resolve from the installed skill; canonical source `skills/frontend-design-direction/`).
Decide and record: product purpose/domain, primary audience and repeated user
jobs, primary and secondary actions, visual hierarchy, information density,
product tone/character, responsive constraints, relevant interaction patterns,
required content states, existing design-system constraints, and framework and
accessibility requirements. Record them in the **existing** design contract
artifacts (`DESIGN.md`, `docs/design/*`, page `CONTRACT.md`) — no second design
authority and no new document. Use local product references by default; never
auto-connect UIZZE, install packages, or transmit project artifacts externally.

For enterprise/operational applications prioritize scanability, task efficiency,
stable layouts, and readable data density; avoid generic marketing heroes,
decorative motion, oversized type, and deep card nesting. Marketing/editorial
surfaces may be expressive when the approved direction calls for it. Do not
impose one universal visual style across product categories.

### Phases 1–3 — Candidates constrained by direction

Use the recorded product direction as constraints for Material, Taste,
Typography, and asset selection. `frontend-design-direction` proposes; it does
not override the approved contract.

### Phase 4 — Freeze

Persist the selected direction and its checkable constraints in the canonical
design contract. This skill is **not** a competing source of tokens, typography,
spacing, radius, or composition. After Freeze it is **VERIFICATION only**. Any
change to approved visual decisions uses the existing amendment/approval
process and invalidates the affected approval and parity evidence.

### Accessibility — primary source `a11y`

Use the installed `a11y` skill as the primary accessibility knowledge source
(three modes: Audit & Tooling; Concepts & Cross-Platform; Frontend Code
Patterns). Do **not** also load `accessibility`, `frontend-a11y`, or
`a11y-architect` unless a real capability gap exists. Load platform-specific
guidance only for a genuine gap.

Before Freeze, establish applicable requirements: semantic structure;
accessible names, roles, and states; text and non-text contrast; keyboard
interaction and focus order; visible, unobscured focus; form labeling and error
feedback; dialog/overlay focus management; touch target size; text resize and
responsive reflow; reduced motion; dynamic status announcements; table
semantics. Web baseline is WCAG 2.2 AA with applicable exceptions; Flutter and
Kotlin Compose use native platform semantics and tooling. Automated checks
alone never establish WCAG compliance. Record these requirements in the
contract before owner approval.

Phase 5 Scaffold: implement accessibility foundations with existing project
conventions and approved tokens — semantic components, shared keyboard
behavior, focus styles, accessible icon buttons, form associations, navigation
patterns. Do not create a duplicate component library.

Phase 6 Section preview: before requesting Canvas approval, inspect applicable
accessibility requirements and content states in the preview; fix design-level
problems first. Behavior that cannot be shown in a standalone HTML preview is
`UNTESTED_FOR_FRAMEWORK`, never PASS.

Phase 6 Framework port: preserve approved appearance and accessibility
semantics using native framework primitives. An accessibility correction that
changes the approved design requires the existing owner amendment process and
invalidates the affected approval and parity evidence; a correction that
preserves the approved design is a normal candidate repair inside the
authorized section scope.

### Content-state completeness (`frontend-design-direction` contract)

States: `loading`, `empty`, `error`, `partial`, `success`, `permission`. For
each applicable state record trigger, visible feedback, user action, recovery
behavior, and relevant accessibility semantics. Determine applicability before
owner approval. A non-applicable state needs a specific reason; unavailable
test access means `UNTESTED`, not `NOT_APPLICABLE`. Do not invent business
behavior, artificial permission actions, or fabricated data to demonstrate a
state. Exercise applicable states against the actual application during
section and final verification.

### G0–G3 extension (no new numbered gate)

- **G0** — product direction and required accessibility constraints are
  available; required content states and target capture profiles are identified.
- **G1** — candidate consumes the approved contract; applicable semantic and
  accessibility requirements are implemented and recorded as `contractChecks`
  items (the state machine makes these **blocking**); no competing visual
  authority overrides approved decisions.
- **G2** — actual framework rendering matches the approved section: typography,
  colors, geometry, responsive behavior, and applicable visual states, using
  every capture profile required by the contract.
- **G3** — applicable keyboard interaction, focus behavior, accessible names,
  modal interaction, form feedback, and functional state transitions are
  recorded as `interactionChecks` (**blocking**) and verified by exercising
  real behavior, not element presence.

Accessibility findings are **blocking** at the relevant gate. Required checks
cannot be removed after a failure. A `frontend-design-direction` evidence PASS
or an automated accessibility PASS never overrides a failed G0–G3 result. All
existing stabilization requirements (complete scope coverage, exact reference
identity, coherent checkpoint transitions) remain in force.

### Phase 8 — rendered finish gate (reuse existing checker)

Invoke the bundled checker against a **local** report built from real
observations:

```bash
node <resolved-frontend-design-direction>/scripts/check-evidence.js <local-report.json>
```

Resolve `frontend-design-direction` from the installed skill, never a hardcoded
developer path. The report uses the checker's actual schema: `contract`,
`targetViewports`, `accessibility`, `responsive`, `contentStates`, and
`renderedEvidence`. Use exact viewport labels consistently across
`targetViewports` and `renderedEvidence`; resolve artifact paths relative to
the report directory and comply with its path-containment checks.

The checker validates evidence-record completeness and local artifact presence
**only** — it does not judge screenshot quality, verify observation truth, or
establish accessibility compliance. Therefore inspect actual rendered output,
execute applicable accessibility checks, exercise relevant content states,
record real observations, and bind the report to the current candidate
revision. Never write placeholder observations to obtain checker success.
Reuse current browser and accessibility tooling; do not add a mandatory
external service or auto-install scanners. If a required verification cannot
run, report the precise limitation and preserve the blocked/unverified status.

## One Design Authority (phase-scoped)

Authority is bound to lifecycle phase, not to a single skill:

- **Before Freeze:** the taste engine proposes/emits visual direction (palette,
  type pairing, radius, motion, spacing) and `deal` prints **candidates** — not
  the design. Typography DESIGN owns font selection, pairing, roles and
  hierarchy. Emit the real system with `start.mjs css` (or `start.mjs brand`
  for client colours) before Freeze.
- **At Freeze:** the approved design contract, `TOKEN-MAP.md`, `THEME.md` and
  `TYPOGRAPHY-MAP.md` record the emitted values verbatim and become the sole
  authority. Where a downstream default differs, the APPROVED contract value
  wins (not the taste scale). The approved section canvas specifies composition
  and behaviour within that contract.
- **During Port:** downstream skills (`frontend-scaffold`, adapters) consume and
  map approved tokens; they never re-derive or substitute defaults. Typography
  is VERIFY only. If approved contract and canvas conflict, STOP and reconcile
  via owner amendment — never pick whichever makes the port easier.
- **After Freeze:** a taste/evaluator suggestion cannot override approved type,
  tokens or composition. AMEND requires exact owner approval and invalidates the
  affected baseline + parity.

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
   - **Native mode:** the section file is the real component (e.g.
     `resources/js/pages/<NN>-<slug>.tsx`), and the Canvas preview points at the
     project's dev server (`--preview-url … --preview-mode framework-native`) so the
     owner approves the actual rendered component. There is no HTML artifact. For
     in-frame annotation, add the canvas dev-server adapter before opening the
     session — Vite: `planCanvasAnnotations()` from
     `scripts/lib/plan-canvas/adapters/vite.mjs` in `vite.config`; Laravel/Inertia:
     `node scripts/plan-canvas.js vendor <app-dir>` publishes the partial to
     `resources/views/vendor/ecc-plan-canvas/sdk.blade.php`, then add
     `@include('vendor.ecc-plan-canvas.sdk')` inside `<head>` of the root Blade layout
     (it carries its own `@env(['local','development'])` guard). Without it
     the toggle stays disabled and feedback is chat + verdict. A failed dev server
     is reported as-is, never replaced by an HTML stand-in.
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
   - **Native mode:** there is no port. The approved component is already in the
     app; this step is integration — wire routing, data, and shared shell, reusing
     the approved source verbatim (DBN-09). Skip the scoping/asset-remapping advice
     below, which exists to survive an HTML→framework translation.
   - **Standalone HTML mode:** immediately upon verdict approval, integrate the approved markup into target component(s).
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
   - **Native mode:** there is no canvas HTML to compare against. Verify
     rendered integrity instead: the integrated component rendered in its real
     context, against the approved baseline captures and the approved source
     digest, across the required responsive profiles. Same-source drift (CSS
     inheritance, app layout, real data) is reported as a meaningful finding, not
     a hard pixel failure.
   - **Standalone HTML mode:** verify the approved HTML against the served app as below.
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

**State machine (V2.0):** `CANVAS_APPROVED` records consent to the exact sealed
canvas only — it must never increment the `current` section index. `current`
advances on a verified parity receipt (`PARITY_PASS`) after bounded repair, and
a failed resume preserves the prior failure count (max 2 cycles per revision).
On resume, recompute every disk hash of HTML/CSS/assets/contract against
`active.json`; any mismatch returns `BUNDLE_INVALIDATED: canvas hash mismatch`.

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

## Two Different Acceptances (do not conflate them)

Two acceptance decisions exist and they answer different questions.

**Release compatibility acceptance (Track A).** Asks whether the design-build
workflow and its Antigravity CLI adapter still behave correctly as *tooling*.
It is release-level regression evidence, produced and consumed by the ECC-OPL
maintainers, and it lives in `scripts/lib/design-build-antigravity-gate.mjs`
with `scripts/design-build-v2/closure-evidence.mjs`. It is **not** a certificate
that every application project must create before using this skill, and no
section in this workflow may require it. A project that never produces a Track A
certificate is normal and correct.

**Project section acceptance (Canvas verdict).** Asks whether *this section* in
*this project* may be built. It is the owner's Canvas verdict bound to the sealed
design reference bundle for one section. This is the acceptance this skill
enforces, per section, in the section loop.

Because only the second is enforced here, the enforcement this skill provides is
cooperative at the host level: the agent runs the gate and honours its verdict.
Do not describe it as host-enforced, and do not add a project-level Track A
requirement to close that gap.

### What a candidate change invalidates

Owner approval applies to the **sealed design reference bundle** — approved HTML,
CSS, assets, and the applicable design contract. It does not extend to
implementation files.

- Implementation change (component, controller, test): rerun candidate parity and
  refresh the affected verification evidence. The approval stands.
- Approved reference change (the sealed bundle or the contract): the approval is
  void. Obtain a fresh Canvas verdict.

Never re-seal new bytes under an old approval, and never manufacture approval
evidence. When a receipt reports `candidateFileHashMismatch`, the candidate files
drifted — refresh the candidate hashes and re-render; do not re-approve.

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
- Defaulting to HTML preview when the project already has a framework. Discovery
  decides the mode; do not assume.
- Generating an HTML stand-in after a native preview fails, then approving the
  stand-in.
- Claiming "backend integrated" for a section running on fixture data.
- Keeping an HTML artifact and a component in sync as two sources of truth.
- Letting scaffold or contract defaults override the dealt tokens.
- Treating `deal` output as the final system.
- Treating chat text or a terminal "ok" as approval.
- Porting approved canvas HTML to framework components without verifying live parity on the dev server.
- Writing scoped CSS for dynamic client-rendered elements without `:global(...)`.
- Leaving translation dictionary copy stale while updating only component markup.
- Gating a stale revision, or reporting success while the gate is OFF.
- Promising a deliverable that is really a demonstration.