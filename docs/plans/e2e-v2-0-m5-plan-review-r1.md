# Plan Review Evidence — Round 1 (M5 migration & rollback)

Verdict: APPROVE

- Round: 1 of the review loop (cap 3). Reviewer session `ses_df7df3da5ffeaV1ifzWOsPKeCX` (Momus + Oracle passes).
- Material blockers: **0**.
- Nature: full review of the r1 plan, not a bounded header re-review.

## Digest verification

- On-disk plan: `docs/plans/e2e-v2-0-m5-migration-rollback.plan.md`
- Plan SHA-256 (verified via `shasum -a 256`): `f946c165ddb00e49bc2c17b306eb7d5cf5ecddf11955d408df2c1f52a594f108`
- Header: `Status: DRAFT`, `Revision: r1`, `Readiness: REVIEW_READY`, `Milestone: M5 — AC-015 through AC-018`

## Upstream pins verified on disk (all MATCH)

| Artifact | SHA-256 |
|---|---|
| PRD R1 candidate (`PRD-CANDIDATE.md`) | `047918df0835bc7ea52f0d0dc7714f0b29394cce32ad8c2580b2973dfce1d211` |
| Worktree PRD `.claude/prds/…prd.md` | `bbe563be553147e4ff348622e54a75689db209bd798e85f85a97d739895191a9` |
| `DECISION-REGISTER.md` | `cd848701e25fddf6ab33c5853a2bd93a791e0786b225dc8534be912c4c03d223` |
| `MILESTONE-GATES.json` | `00c6b4550a130fcec4e20abda25919b9a08fe4b493b9439687865d70d017c8e5` |
| `M5-PARITY-ROLLBACK-PROPOSAL.md` | `bc69bbc9d51a3eaaacf6406421ab97ab49fef9dc27e260a90db5bf08a5243a3c` |
| `.opencode/commands/e2e.md` (preimage) | `c562e0a2a2707c49362431b04ac1895f02c091e3d7ae193837ab6bf35b9d8436` |
| `.opencode/commands/e2e-map.md` (preimage) | `76b3d4037a0144df2d40dc0eca01777690762a7cccc5d9562b0330333dfdb142` |
| `.opencode/opencode.json` | `01e3d4405c4351cde1460e782da9aa80f0aa6a6796bc3bb149be1b12bcc63e84` |
| global `~/.config/opencode/opencode.json` | `bd747d4f42d22e7c0dc1f14b65e815b043117083fd548292489509c653e26843` |
| global `~/.config/opencode/opencode.jsonc` | `85378ac09a398760fccae61499ab3bd5207713d3ba214b71c92e5acf52071dbf` |
| `agents/e2e-runner.md` | `94811f4bbc491c351cdf220ab103d6bd251fb1d88d9d46ba4c8162637a236a5b` |
| `.opencode/prompts/agents/e2e-runner.txt` | `d7442445cbb276cb88d6cca5339b50ec3247683ed78ea512ccf4627ed666ad08` |
| `SHA256-MANIFEST.json` | `6cf52ecd57a537578d0caf444b2bf0e914aae96c93e77a9c89e33c4d48083747` |
| `ACCEPTANCE-MATRIX.csv` | `400d3fcc22c48fb75f85ee22aeb0de23d0d0bbcf9dd776ae33aeb2ec88789caf` |

`TESTS.md` and `.governance/docs-map.json` confirmed ABSENT.

## Frozen trees verified (sorted `path<TAB>sha256<LF>`)

- m1 16 / `8416c0671af8ae60850d9d72f249968976c907cf4aa62b605d663bd5eb1625ca`
- m2 27 / `2f81da73f2068357f4265a3cfbaf6a9435a3e502d52dcd32d33b3b445fc97588`
- m3 17 / `2e8c7cf63a44b3d073185be0a4fe59de87fd9583ffc79abc6066b151066e23c7`
- m4 20 / `88c50d13760dd24dd47b9e5f2a2d8aa707b0f008abcf19b06fa7370641bc7807`
- contracts 3 / `a550f29ea751c7635cdc5d73bbc2e6a0a29d7cdf7153e43f23e429a4f4e05e8c`

## Scope and fidelity (both passes)

- AC-015 field-scoped update with exactly 5 permitted write fields; unpermitted fields reject with `FIELD-NOT-PERMITTED`; zero repository registry writes.
- AC-016 hash-before-write conflict → `WRITE_CONFLICT` + non-clobber rebase; path traversal/symlink escape fail closed; Mutation 13 detected.
- AC-017 parity across F01–F06 + F13, legacy `/e2e <flow>` emits `LEGACY_SHORTHAND_DEPRECATED` without dispatch or coverage credit (DEC-04), isolated discovery check; Mutation 14 detected.
- AC-018 canonical terminal enum (`PASS`, `FAIL`, `BLOCKED`, `UNVERIFIED`, `CANCELLED`, `PARTIAL`), flakiness reporting, frozen-workflow and release-readiness gates.
- Gate honesty: P1 `NOT_VERIFIED` (ASM-01 inconclusive), P2/P3/P4 `VERIFIED_IN_M5_REFERENCE`, P5 `NOT_GIVEN` → live disable `BLOCKED_DEPLOYMENT_GATED`; decision packet emitted for owner.
- Forbidden surface intact: no active config/command edits, no git/HOME writes, deliverables confined to `docs/e2e-v2/m5/**`, no browser/Playwright/install/network.

## Non-blocking notes

1. Step 7 references `TMPDIR=$SCRATCH`; worker should export `SCRATCH` explicitly or use the literal scratch path as in Steps 2 and 4.
2. Step 1 uses an inline node hash preflight; acceptable for the preflight report before the Step 5 emitter exists.

## Conclusion

Plan r1 is executable, bounded, and faithful to the pinned upstream contracts, with honest gate statuses and no forbidden surface. Ready for owner approval gate.

Round 1, both passes complete, 0 material blockers.
