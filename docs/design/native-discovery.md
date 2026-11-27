# Native Discovery Record (Phase 0)

Read-only source discovery for the framework-native design-build evolution.
Binding plan: `docs/plans/framework-native-design-build.plan.md` (approved r2, canvas `a9d119cd55f9`).

- **Repo baseline**: `dd39119c` + baseline commit `02fdc85f` (viewport presets, 100k prompt ceiling).
- **Discovery method**: file inspection only; no execution, no writes.

## 1. Where the HTML-first assumption actually lives

| Location | Evidence | Consequence |
|---|---|---|
| `skills/design-build/SKILL.md:287` | "Write or update `docs/design/sections/<NN>-<slug>.html`" | Section preview is mandated as static HTML |
| `skills/design-build/SKILL.md:329` | parity receipt recording (dev server vs canvas) | Mandatory port + parity step |
| `skills/design-build/SKILL.md:457` | anti-pattern: porting without verifying live parity | Reinforces the two-implementation loop |
| `scripts/design-build-v2/state-machine.mjs:211-213` | `APPROVED_REFERENCE_KINDS = ['html','css','fonts','assets',…]`; `CANDIDATE_KINDS = ['framework-implementation',…]` | Reference and candidate are different artifact kinds by construction |
| `scripts/design-build-v2/state-machine.mjs:16-22` | `PORT_IN_PROGRESS`, `PARITY_PENDING` states | Porting is a mandatory lifecycle stage |
| `scripts/design-build-v2/compare-section.mjs:21,40,92-93` | hardcoded approved HTML vs `/react-page.html` | Parity tooling is HTML-pair specific |
| `scripts/design-build-v2/reproduce-fixture-certificate.mjs` | `--html <file.html>` | Fixture certificates are HTML artifacts |

## 2. What already works and must be reused

| Area | Evidence | Reuse verdict |
|---|---|---|
| `/opl-design-build` is a projection, not a command | `scripts/lib/install-targets/antigravity-cli.js:76,118-129` remaps `commands/design-build.md` → `skills/opl-design-build/SKILL.md` (`contentTransform: 'antigravity-command-to-skill'`) | DBN-14/DBN-16 already satisfied |
| `frontend-scaffold` is framework-native | `skills/frontend-scaffold/SKILL.md:50-64` detects next / vite+react; Phase 3 emits per-contract component files | Reuse untouched |
| Plan Canvas service | `scripts/lib/plan-canvas/{server,sessions,ui,markdown,sdk,verdict-binding}.js` + `scripts/plan-canvas.js` | Extend, do not rebuild (DBN-05) |
| Verdict binding | `verdict-binding.js`: `computePlanDigest`, `validateBoundVerdict`, `validateAttachments`, `persistAttachments` | Reuse for native reference identity |
| Rendered authority | `scripts/design-build-v2/rendered-authority.mjs:42-73` requires real screenshot bytes per viewport | Reuse measurement, adapt inputs |
| Design intelligence | `design-contract-system`, `frontend-design-direction`, `a11y`, `typography-system`, `ux-typography`, `better-typography` | Reuse untouched (DBN-13) |
| Tests convention | plain-assert runners in `tests/lib/*.test.js`; `node --test` for `.mjs` suites | Follow |

## 3. Gaps forcing change (summary; full Metis pass in plan §5)

1. Canvas artifact route is a single `fs.readFileSync` — no way to display a live URL (`server.js:681-711`).
2. Section state has no preview-mode field; `session.target` is the only mode discriminator (`sessions.js:183,216`).
3. State machine cannot express a native reference kind or a port-free path.
4. `compare-section.mjs` and the fixture certificate are HTML-pair specific.
5. No fixture-vs-production marker anywhere in section state.
6. Policy text teaches exactly one (HTML-first) loop.

## 4. Explicitly out of scope (confirmed absent from the change)

No new command, no Canvas rewrite, no framework compiler, no workflow engine, no new agents, no new security/admission system, no per-project Track A certificate, no changes to Guardian Angel, model providers, or the AGY Bridge.
