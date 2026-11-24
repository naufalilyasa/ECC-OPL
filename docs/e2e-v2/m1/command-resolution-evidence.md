# Command Resolution Evidence — effective winner uncertainty (IS-2 / GAP-2 / ASM-01)

Status: `NOT_VERIFIED`
Recorded: M1, 2026-11-22
Companion: `reports/command-resolution.report.json`

## 1. The question M1 had to answer

Which definition of `/e2e` actually wins when two global config files and a project override are all
present? OpenCode v2.3.2 is the observed runtime; Node v24.21.0. The precedence between the two
active global files (`opencode.json`, `opencode.jsonc`) and a project-level override is
**undocumented in the material available to this milestone**.

The M1 outcome per PRD §8 is explicitly to **record the uncertainty**, not to resolve it. A
read-only session cannot prove a runtime winner: proving precedence requires running the command
discovery in an isolated context, which is runtime activity and therefore out of scope.

## 2. Declared command maps, verbatim (3 surfaces)

### Surface 1 — project, `.opencode/opencode.json`

```json
"e2e": {
  "description": "Generate and run E2E tests with Playwright",
  "template": "{file:commands/e2e.md}\n\n$ARGUMENTS"
},
"e2e-map": {
  "description": "Map routes and flows to TEST-ID registry entries, then hand a checklist to /e2e",
  "template": "{file:commands/e2e-map.md}\n\n$ARGUMENTS"
}
```

### Surface 2 — global, `~/.config/opencode/opencode.json` (read-only)

```json
"e2e": {
  "description": "Generate and run E2E tests with Playwright",
  "template": "{file:commands/e2e.md}\n\n$ARGUMENTS"
},
"e2e-map": {
  "description": "Map routes and flows to TEST-ID registry entries, then hand a checklist to /e2e",
  "template": "{file:commands/e2e-map.md}\n\n$ARGUMENTS"
}
```

Both surfaces resolve to the **same relative template path**, so the winner differs only in which
`commands/` root is consulted — project-local or global install.

### Surface 3 — global, `~/.config/opencode/opencode.jsonc` (read-only)

Top-level keys: `$schema`, `experimental`, `plugin`, `lsp`, `permission`, `mcp`, `providers`, `agent`.

There is **no `command` key at all** on this surface. It declares 7 plugins
(`@tarquinen/opencode-dcp@latest`, `@dietrichgebert/ponytail`, `./plugins/agy-delegate-guard.js`,
`./plugins/agentmemory-capture.ts`, `./plugins/agy-task-bridge.js`,
`./plugins/design-quality-check.js`, `./plugins/dcp-auto-compress.ts`) and agent config, including an
`e2e-runner` agent entry. It cannot win the `e2e` command mapping under any precedence model,
because it declares nothing to map.

## 3. Precedence status

`NOT_VERIFIED`

Rationale, stated as a limitation rather than a conclusion:

1. Two global files exist and both are active surfaces; which one is merged last is not documented.
2. Project-level `command` maps are widely believed to override global ones, but "believed" is not
   evidence, and the observed config gives a *file reference*, not an inline template — so the
   winner is really "which `commands/e2e.md` gets loaded", not "which JSON wins".
3. Hash evidence sharpens the ambiguity rather than settling it: the project and global templates
   are identical strings, so a byte-diff of *observed output* could not distinguish the winner even
   if a run were permitted.

The three surfaces and their frozen hashes are in `../SOURCE-BASELINE-FROZEN.md`.

## 4. Deferred resolution — ASM-01 isolated probe (M2)

`DEFERRED_TO_M2`. ASM-01 represents **OpenCode /e2e invocation and resolution semantics**, combining two explicit subassertions:

- **`ASM-01/ARGS`**: `$ARGUMENTS` parsing and subcommand/flag passing semantics to `/e2e` (`status: VALIDATION_REQUIRED`, probe: `DEFERRED_TO_M2`).
- **`ASM-01/PRECEDENCE`**: Project-level `.opencode/opencode.json` vs dual-global (`opencode.json` vs `opencode.jsonc`) effective command winner resolution (`status: VALIDATION_REQUIRED`, probe: `DEFERRED_TO_M2`).

Producing actual evidence requires running command discovery and invocation probes, which M1 forbids.
The precedence probe is fully specified so M2 can execute it without re-deriving intent:

1. Create a sandbox under the session temp dir: `…/opencode/m2-probe/home` and
   `…/opencode/m2-probe/project`, never the real `$HOME`.
2. Candidate A — project override only: sandbox `project/.opencode/opencode.json` maps `e2e` to a
   sentinel template; no global config present.
3. Candidate B — global json only: sandbox `HOME/.config/opencode/opencode.json` maps `e2e` to a
   different sentinel; no project config.
4. Candidate C — dual global: sandbox `HOME/.config/opencode/opencode.json` and `.jsonc` both
   declare `e2e` with distinct sentinels, no project config.
5. Candidate D — all three present: project + both globals, each sentinel distinct.
6. In each case invoke `/e2e help` with `HOME` redirected to the sandbox and record which sentinel
   the help output echoes. The echoed sentinel is the winner for that configuration.
7. Record the winner per configuration, or `INCONCLUSIVE` with the observed output — never "assume
   project wins".
8. Cleanup: delete the sandbox tree with a literal-path delete; verify the real `$HOME` config
   hashes are unchanged against `../SOURCE-BASELINE-FROZEN.md`.

Guardrails for the probe: no config writes outside the sandbox, no installs, no network, no
production target, and the real global config stays byte-identical (re-hash after).

## 5. Why this is not a blocker for M1

Every M1 contract is written against **behaviour**, not against a file location. The contracts do
not depend on which surface wins, because both E2E-mapping surfaces point at byte-identical
templates. The uncertainty becomes blocking only for parity/disable-default work — i.e. M5 under
`PENDING_DEC DEC-10` — which is exactly where the probe is scheduled.

## 6. What M1 did not do

No config was written, no `HOME` write, no command was invoked, no runtime discovery was attempted.
The probe was not run and is not reported as run.
