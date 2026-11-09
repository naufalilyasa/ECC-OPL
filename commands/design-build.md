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

## Load the skill

Read and follow `design-build` (installed skill) or its canonical copy at
`skills/design-build/SKILL.md`. If neither resolves, stop and report — do not
improvise the policy here.

## Pipeline

```
0 Brief → 0.5 Escalate → 1 Material → 2 Taste → 3 Prerequisites → 4 Freeze
       → 5 Scaffold shell → 6 Section loop → 7 Assemble → 8 Gate → 9 Harden
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

`await` blocks: run it as a background task. Accept only an item shaped
`{"kind":"verdict","verdict":"approve"}`. Server: `127.0.0.1:4517`.

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

## Output

- `docs/design/BUILD-STATE.md` — the handoff record defined by the skill
- `docs/design/ASSETS.md` — path, purpose, engine source, status, fallback,
  source URL, author, license, credit
- the running app, gate **PASS** on the current revision
- a one-screen summary: what shipped, what is placeholder, what was skipped

## Do not

- Restate the skill's policy here instead of reading it.
- Approve a preview before the shell and prerequisite assets exist.
- Treat `deal` output, chat text, or a terminal "ok" as the final system or an
  approval.
- Gate a stale revision or report success while the gate is OFF.
- Write outside the approved project root, or overwrite a contract or asset
  without consent.
- Invent prices, certifications, legal wording, or an irreversible scope.