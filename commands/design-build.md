---
description: Build a frontend page section by section with an interactive canvas approval loop. Policy lives in the design-build skill; this shim carries only the arguments and the host CLI adapters.
subtask: false
---

# Design Build

This command is a shim. The policy — pipeline order, design authority, approval
protocol, resume fields, asset entitlements, gate rules, and safety — lives in the
**`design-build` skill**. Load it first and follow it. Everything below is either
an argument or a host adapter (an exact CLI invocation the skill deliberately
does not carry).

## Arguments

- `$ARGUMENTS` — the brief. If empty, read the project's README/context and ask
  only what the brief step requires.
- `--harden` — after the gate passes, run the generator and evaluator loop
  (`gan-style-harness`). Expensive: state the budget first.
- `--resume` — continue from `docs/design/BUILD-STATE.md`. Revalidate the files
  on disk before trusting any recorded approval.
- `--section <name>` — build exactly one section, record its approval, and stop.
  Report what remains; the next run with `--resume` continues the loop. Omit it
  to build the whole page in one run, which keeps the contract and dealt tokens
  loaded across sections.

## Design root (work-item binding)

Every `docs/design/...` path below and in the skill resolves against `DESIGN_ROOT`:

```bash
# Bound by default: bind this task's identity, then design inside its item.
# TASK_SLUG is what this run is about, not the last active pointer.
ITEM=$(node <helper> bind --slug "<kebab-slug-of-this-task>") || exit 1
DESIGN_ROOT=".ecc-opl/work-items/$ITEM/design"
# legacy paths only under --standalone or ECC_OPL_STANDALONE=1:
#   DESIGN_ROOT="docs/design"
```

Resolve the helper (`scripts/lib/work-item/work-item.js`) at `$CLAUDE_PLUGIN_ROOT`,
`${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}`, `./.agents`, `.`,
`${CLAUDE_CONFIG_DIR:-$HOME/.claude}`. A missing helper still means standalone, so an
uninstalled project is never blocked — but a missing pointer is not an opt-out.

`--resume` reads `$DESIGN_ROOT/BUILD-STATE.md` first, then falls back to
`docs/design/BUILD-STATE.md`, so a build started before binding still resumes. Canvas state stays
host-owned in `~/.claude/plan-canvas*/` (never moved); a bound run also writes
`.ecc-opl/work-items/<ITEM>/canvas/session.json` with the canvas key and section paths — a pointer,
not a gate.

## Framework detection (conditional skill load)

Detect the target from project manifests (`package.json` → React/Inertia, Vue,
Svelte, or Astro; `pubspec.yaml` → Flutter; `build.gradle.kts` → Kotlin Jetpack
Compose) and by running the discovery profile. Discovery decides the **preview
mode**, and the mode decides the whole section loop:

```bash
node ./scripts/design-build-v2/detect-project.mjs <project-root>
```

`previewMode: "framework-native"` means the section is a real project component
and the Canvas previews the project dev server. `previewMode: "standalone-html"`
means the legacy HTML → port → parity loop. `ambiguous` or `unsupported` is a
report to the owner, never a guess.

Mode is per section. A section already running under `standalone-html` finishes
there, and an old HTML approval is never reinterpreted as a native one — see
"Migration: sections already in flight" in the skill.

Then load **only the relevant** framework pattern skill (e.g. `react-patterns`,
`vue-patterns`, `dart-flutter-patterns`, `compose-multiplatform-patterns`) plus
its matching `skills/design-build/references/adapter-*.md`. Do not load mobile
skills for a web target (or vice versa). If a needed skill is absent, continue
with the core rules and report the gap — never halt solely for a missing
optional pattern skill.

## Load the skill

Read and follow `design-build` (installed skill) or its canonical copy at
`skills/design-build/SKILL.md`. If neither resolves, stop and report — do not
improvise the policy here.

Phase 0 loads `frontend-design-direction` for product direction; before Freeze,
load `a11y` for applicable accessibility requirements. Both are resolved from
installed skills (canonical `skills/frontend-design-direction/` and the
installed `a11y` skill), never from a hardcoded developer path. Do not also
load `accessibility`, `frontend-a11y`, or `a11y-architect` unless a real gap
exists. Routing policy is in the skill; this shim only carries the invocations.

## Pipeline

```
0 Brief → 0.5 Escalate → 1 Material → 2 Taste → 3 Prerequisites → 4 Freeze
       → 5 Scaffold shell → 6 Section loop (Preview → Approval → Port/Integrate → Parity Gate)
       → 7 Assemble → 8 Gate → 9 Harden
```

Prerequisites precede Freeze, and Scaffold precedes the section loop. Both
orderings are binding; the skill explains why.

## Adapters

### A1 — Canvas (approval surface)

The `ecc-plan-canvas` binary is **not on PATH**. Use the script directly:

```bash
node ~/ECC/scripts/plan-canvas.js open docs/design/sections/<NN>-<slug>.html
node ~/ECC/scripts/plan-canvas.js await docs/design/sections/<NN>-<slug>.html
node ~/ECC/scripts/plan-canvas.js await <file> --reply "..."
node ~/ECC/scripts/plan-canvas.js end <file>
```

The first two forms are the **legacy / standalone-html** path: the artifact file is
the design document, and the verdict is plain
`{"kind":"verdict","verdict":"approve"}`. Use them only for vanilla projects, or for
a section whose recorded mode is `standalone-html`. Do not use them to approve a
framework-native section.

`await` blocks: run it as a background task. Server: `127.0.0.1:4517`.

**Native mode** previews the live component instead of an HTML file:

```bash
node ~/ECC/scripts/plan-canvas.js open <section-path> \
  --preview-url http://127.0.0.1:<dev-port>/<route> \
  --preview-mode framework-native \
  --section <NN>-<slug> --revision <rN> \
  --revision-digest <sha256 of the reviewed reference set> \
  --design-digest <sha256 of the approved reference set> \
  --framework <react-vite|laravel-inertia-react|vue-vite> \
  --data-mode <fixture|production> \
  --edit-mode
```

Both digests are required for native mode: the Canvas refuses a native session
without them, because it cannot bind the owner's approval to the exact preview
they reviewed. `--data-mode` says which data the preview renders, so nobody
mistakes a fixture for production.

Derive them from the files that shape the render, not by hand:

```bash
node --input-type=module -e "
import { fingerprintNativeReference } from './scripts/design-build-v2/state-machine.mjs';
console.log(JSON.stringify(fingerprintNativeReference({ files: [
  { kind: 'component-source', path: 'src/sections/Hero.tsx', sha256: '<sha256>' },
  { kind: 'design-contract',  path: 'DESIGN.md',             sha256: '<sha256>' }
]}), null, 2))"
```

`revisionDigest` covers everything in the reference; `designDigest` covers only the
visual inputs. Pass them through unchanged.

The Canvas serves a wrapper that frames the project dev server. The preview URL is
stored only for `framework-native`; `standalone-html` never stores one. In-frame
annotation in native mode needs the canvas dev-server adapter (Vite plugin
`planCanvasAnnotations()` or the Blade include `vendor.ecc-plan-canvas.sdk`), added
temporarily and reported; without it the toggle stays disabled and feedback is chat
+ verdict. If the dev server is down, report the real error — do not produce an HTML
substitute.

The approval arrives as a verdict naming the reviewed identity:

```json
{"kind":"verdict","verdict":"approve","section":"<NN>-<slug>","revision":"rN",
 "revisionDigest":"…","designDigest":"…","timestamp":"…"}
```

Treat `STALE_REVISION` / `STALE_DESIGN` as "the owner reviewed an older draft":
re-open the Canvas on the current revision and wait for a fresh verdict. Never
copy `session.previewMeta` onto a meagre verdict to make it pass — that is exactly
the stale-approval path the binding exists to block.

### A1.5 — Live Parity & Scoping Gate (standalone-html only)

Canvas approval validates only the standalone HTML preview, so this adapter exists
to survive the HTML→framework port. **Native mode skips it entirely** — the
approved component is already the implementation and step 3 is integration, not
translation.

In `standalone-html` mode, immediately after porting approved markup into target
framework components (`.astro`, `.tsx`, `.vue`):

1. **Compiler Scoping & DOM**: Ensure client-generated dynamic elements use narrowly
   anchored scoped selectors (`:global(.dynamic-class)` in Astro, `:deep()` in Vue)
   or utility classes so styles persist. Ensure wrappers declare or inherit border-radius.
2. **Asset URL Mapping**: Remap canvas-relative `./assets` to framework `public/images/`
   or module imports. Check for 404s.
3. **Live Dev Server Parity**: Inspect the running app (`http://localhost:<port>/`) against
   `docs/design/sections/<NN>-<slug>.html`:
   - Discover active port; if offline, make one 10s startup attempt. If unreachable, mark
     blocked in `BUILD-STATE.md` and stop — never pass parity blindly.
   - Verify copy, i18n dictionaries (`ui.ts`), pill capsules, and arrow offsets match 1:1.
   - Verify browser console has zero hydration errors or failed scripts.
   - Max 2 auto-fix cycles: if discrepancies persist, log diffs and escalate to owner.

### A1.6 — Section completion gate (production modules)

Section completion is NOT a helper test. Use the portable entrypoint
`section-gate.mjs` (resolves modules relative to itself; resolves from global install
or repository path, no hardcoded developer paths):

```bash
GATE="${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}/scripts/design-build-v2/section-gate.mjs"
[ -f "$GATE" ] || GATE="./scripts/design-build-v2/section-gate.mjs"
node "$GATE" <request.json>
```

`request.json` supplies authoritative `identity`/`active`/`canvasApproval` from
the current workflow state, project-relative candidate and screenshot FILE paths,
`frameworkCompleteEvidence`, `contractChecks`, `profileDimensions`,
`requiredViewports`, per-viewport PNG pairs + measurements, real interaction
checks, and the receipt. Omitting context is a rejection. `active.previewMode`
selects the input shape: `framework-native` compares integrated rendering against
the approved baseline captures (there is no HTML reference pair); `standalone-html`
keeps the approved-vs-candidate pair path. The entrypoint runs
`verifyReceipt`, `verifyRenderedParity` (G2) and `advanceCheckpoint`; `current`
increments once only on verified completion. Capture the command/session evidence
in `docs/design/evidence/`.

### A2 — Material (candidates only)

Use the absolute path; the relative path in that skill's docs breaks outside home.

```bash
python3 ~/.opencode/skills/ui-ux-pro-max/scripts/search.py \
  "<product> <goal>" --design-system -p "<project>"
```

### A3 — Taste (deals and emits the system)

`deal` prints candidates. Emit the real system with `css` or `brand` **before**
Freeze.

```bash
S=~/.agents/skills/design-taste-frontend

node $S/scripts/start.mjs deal --page <kind>

# client has no brand colours
node $S/scripts/start.mjs css --page <kind> --palette <id> --type <id> \
  --radius <sharp|soft|round> --history .taste-skill/history.json

# client supplied brand colours
node $S/scripts/start.mjs brand --page <kind> \
  --bg "#..." --ink "#..." --accent "#..." --type <id> --radius <sharp|soft|round>

node $S/assets/layout/deal.mjs --type <page type> \
  --has <photo,ui,film,object,setting> --history .taste-skill/layout-history.json

node $S/scripts/moments.mjs pick --page <kind> --count <1|2> \
  --fits section,statement --photo --history .taste-skill/history.json

# tech / gaming / software only
node $S/scripts/effects.mjs pick --page <kind> --palette <light|dark|colour> \
  --slots <hero,card,...> --history .taste-skill/effects-history.json
```

Radius convention: `sharp` fintech/dev-tools, `soft` default, `round` consumer.

### A4 — Prerequisites (before Freeze)

```bash
node $S/scripts/photos.mjs search "<subject>"
node $S/scripts/photos.mjs credits <photo-id>
```

Resolve every photograph, render, or object the contract will name, or record an
approved placeholder. Image generation is last resort and only when the brief asks.

### A5 — Assemble (markup-dependent, after sections exist)

```bash
node $S/scripts/icons.mjs scan <entry>.html --out assets/icons --colour
```

Paste UI fragments from `$S/assets/ui/<name>/fragment.html`, rename every label
and number to the client's, and apply `data-diagram="<preset>"` with client
labels. Mount every effect, moment, and scene as its reference file describes.

### A6 — Gate (final revision only)

```bash
node $S/scripts/copy-lint.mjs <url-or-file> --kind <kind>
node $S/scripts/consistency.mjs <url-or-file> \
  --widths 1440,1024,820,768,390 --rhythm-widths 1440,820,768,390 \
  --profile <profile dir> --page <kind> \
  --category "<what is sold>" --primary "<main action>"
node $S/scripts/perf.mjs <url-or-file> --profile <profile dir>
node $S/scripts/shoot.mjs --url <url-or-file> --w 1440 --out shots/1440.png \
  --profile <profile dir>
node $S/scripts/gate.mjs <url-or-file>
```

Point every checker at the built output or served URL — not a framework source
shell. `shoot.mjs` also produces the share image. Rerun after fixes and after
Harden; `GATE: OFF` is not a pass. If the owner ships as-is, record it verbatim
with `gate.mjs --done "<what they said>"`.

### A7 — Rendered finish evidence checker (Phase 8)

Resolve `frontend-design-direction` from the installed skill and run its bundled
checker against a **local** JSON report built from real observations:

```bash
FD="${OPENCODE_CONFIG_DIR:-$HOME/.config/opencode}/skills/frontend-design-direction"
[ -f "$FD/scripts/check-evidence.js" ] || FD="./skills/frontend-design-direction"
node "$FD/scripts/check-evidence.js" <local-report.json>
```

The report schema is `contract`, `targetViewports`, `accessibility`,
`responsive`, `contentStates` (six states), and `renderedEvidence`. Viewport
labels must match exactly between `targetViewports` and `renderedEvidence`;
artifact paths stay relative to the report directory. The checker validates
record completeness and local artifact presence only — it does not judge visual
quality or prove accessibility. Never write placeholder observations to pass it.
A11y findings are blocking at the relevant gate; an evidence PASS never
overrides a failed G0–G3 gate.

## Output

- `docs/design/BUILD-STATE.md` — the handoff record defined by the skill
- `docs/design/ASSETS.md` — path, purpose, engine source, status, fallback,
  source URL, author, license, credit
- the running app, gate **PASS** on the current revision
- a one-screen summary: what shipped, what is placeholder, what was skipped

## Do not

- Restate the skill's policy here instead of reading it.
- Assume HTML preview without running discovery.
- Generate an HTML substitute for a native section whose dev server failed.
- Claim completed backend integration for a fixture-only section.
- Approve a preview before the shell and prerequisite assets exist.
- Treat `deal` output, chat text, or a terminal "ok" as the final system or an
  approval.
- Gate a stale revision or report success while the gate is OFF.
- Write outside the approved project root, or overwrite a contract or asset
  without consent.
- Invent prices, certifications, legal wording, or an irreversible scope.