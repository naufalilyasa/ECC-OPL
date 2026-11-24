# Source Baseline — FROZEN (ECC-OPL /e2e V2.0, Milestone 1)

Status: `FROZEN`
Frozen at: 2026-11-22 (M1 execution)
Method: `shasum -a 256 <path>` on the live worktree; no Git inspection, no `.guardian-angel` access.
Reference: `SOURCE-BASELINE.md` inside the R1 bundle `ecc-opl-e2e-v2.0-prd-r1-external-review.zip`
(itself manifest-verified at 20/20 by `m1/reports/bundle-validator.report.json`).

Immutable inputs pinned by this freeze:

| Item | Value |
|---|---|
| Approved PRD digest (immutable snapshot, R1 `PRD-CANDIDATE.md`) | `047918df0835bc7ea52f0d0dc7714f0b29394cce32ad8c2580b2973dfce1d211` |
| Worktree PRD digest (`.claude/prds/e2e-v2-0-unified-journey-mapping.prd.md`) | `bbe563be553147e4ff348622e54a75689db209bd798e85f85a97d739895191a9` |
| Approved plan revision | r3 — `ea20d4f2c549b34f54c19f0111c030bbc68aa6cb67833edf6ffd18da9a04b1dd` |
| R1 bundle manifest | `SHA256-MANIFEST.json` — 20 listed files, manifest self-excluded, ZIP holds 21 |

The worktree PRD digest differs from the approved digest because the worktree copy carries the
owner-approval annotation; the authoritative immutable bytes remain `047918df…d211`. Both are
recorded so a later milestone cannot mistake the annotation for source drift.

## Repo sources (8)

| Component | Canonical path | Baseline SHA-256 (SOURCE-BASELINE.md) | Recomputed SHA-256 | Match |
|---|---|---|---|---|
| /e2e command | `.opencode/commands/e2e.md` | `08b17f2cb765665b753374265bc8f78df2599c3505c2245107dd6888061b95dd` | `08b17f2cb765665b753374265bc8f78df2599c3505c2245107dd6888061b95dd` | MATCH |
| /e2e-map command | `.opencode/commands/e2e-map.md` | `76b3d4037a0144df2d40dc0eca01777690762a7cccc5d9562b0330333dfdb142` | `76b3d4037a0144df2d40dc0eca01777690762a7cccc5d9562b0330333dfdb142` | MATCH |
| e2e-runner agent | `agents/e2e-runner.md` | `94811f4bbc491c351cdf220ab103d6bd251fb1d88d9d46ba4c8162637a236a5b` | `94811f4bbc491c351cdf220ab103d6bd251fb1d88d9d46ba4c8162637a236a5b` | MATCH |
| e2e-runner prompt | `.opencode/prompts/agents/e2e-runner.txt` | `d7442445cbb276cb88d6cca5339b50ec3247683ed78ea512ccf4627ed666ad08` | `d7442445cbb276cb88d6cca5339b50ec3247683ed78ea512ccf4627ed666ad08` | MATCH |
| Legacy shim | `legacy-command-shims/commands/e2e.md` | `97ef29c9355344bd25b4e963e519f3eaf5b0c6f43a9174f47c9c5d1b4dbb579e` | `97ef29c9355344bd25b4e963e519f3eaf5b0c6f43a9174f47c9c5d1b4dbb579e` | MATCH |
| test-collaboration skill | `skills/test-collaboration/SKILL.md` | `741138330940e2c9d3cc7bec9e671787f24a361ff89be44e09a56abc8e10dcfa` | `741138330940e2c9d3cc7bec9e671787f24a361ff89be44e09a56abc8e10dcfa` | MATCH |
| e2e-testing skill | `skills/e2e-testing/SKILL.md` | `b0e00e7e17cb259101139900816c5528aed18dd10bcf5f9cb42cfc35baf8a755` | `b0e00e7e17cb259101139900816c5528aed18dd10bcf5f9cb42cfc35baf8a755` | MATCH |
| click-path-audit skill | `skills/click-path-audit/SKILL.md` | `662fc5d02483bcd8ff799d6d3109a38da673182341cfc14445e9076fcd920162` | `662fc5d02483bcd8ff799d6d3109a38da673182341cfc14445e9076fcd920162` | MATCH |

Legend: `Baseline` = value recorded in the R1 bundle's `SOURCE-BASELINE.md`.
`Recomputed` = value observed now, at M1 execution time.

## Config surfaces (3)

`SOURCE-BASELINE.md` states these surfaces' *behavior* in prose but records no canonical hash for
them, so a byte-level historical reference does not exist. Their hashes are frozen here as a
current-state snapshot with status `NO_PRIOR_REF` — not as a proven match.

| Surface | Scope | SHA-256 (frozen now) | Prior reference | Status |
|---|---|---|---|---|
| `.opencode/opencode.json` | project | `01e3d4405c4351cde1460e782da9aa80f0aa6a6796bc3bb149be1b12bcc63e84` | none | NO_PRIOR_REF |
| `~/.config/opencode/opencode.json` | global (read-only) | `bd747d4f42d22e7c0dc1f14b65e815b043117083fd548292489509c653e26843` | none | NO_PRIOR_REF |
| `~/.config/opencode/opencode.jsonc` | global (read-only) | `9263d862ba18d99054bbb932b974fbf423312e282059ff11add59e8ee7c1e551` | none | NO_PRIOR_REF |

Declared `command` map entries for the two E2E commands, verbatim, are recorded in
`m1/command-resolution-evidence.md`. The jsonc surface has no `command` key at all (it carries
7 plugin declarations), so it cannot win the `e2e` command resolution even under the most
permissive precedence model.

## Recorded baseline facts (carried forward, not acted on)

- `TESTS.md` — absent in this repository. Fact about this repo, not proof about any target project.
- `.governance/docs-map.json` — absent. Registry bootstrap therefore resolves to root `TESTS.md`.
- Global `skills/test-collaboration/SKILL.md` — absent. Canonical copy exists only in-repo.
- `legacy-command-shims/commands/e2e.md` exists with a distinct hash; it is a legacy shim to the
  `e2e-testing` skill, not a config command mapping. It must not be silently deleted (DEC-04).
- `agents/e2e-runner.md` contains `npm install -g agent-browser && agent-browser install` and
  blanket `test.fixme()/test.skip()` quarantine guidance. V2 forbids auto-install and silent
  quarantine; adaptation is M4 work under DEC-09.

## Drift statement

All 8 repo-source rows MATCH their `SOURCE-BASELINE.md` value. Drift rows: **0**. No milestone STOP
condition was triggered by step 1.

The 3 config surfaces carry no historical byte reference; they are frozen as `NO_PRIOR_REF`
snapshots. If any hash in this file no longer matches the live worktree, that is drift and every
downstream milestone must stop and re-freeze — `m1/tests/m1.test.mjs` (M1-01..M1-03) fails loudly
on exactly this.
