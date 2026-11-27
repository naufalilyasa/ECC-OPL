# Phase 7 evidence — compatibility, projection & migration (DBN-14/15)

Date: 2026-11-27 · Plan: `docs/plans/framework-native-design-build.plan.md` (Phase 7)

## What changed

No runtime code. Two surfaces and one policy.

### `skills/design-build/SKILL.md` — new section "Migration: sections already in flight"

Placed directly after the re-approval table, before "Workflow State". Binding rules:

- Mode is decided **per section** at discovery time and recorded; one project may hold both modes.
- A section already running under `standalone-html` finishes under the legacy
  HTML → port → parity loop. No mid-flight conversion — the approved HTML is the signed evidence.
- An HTML approval is **never** reinterpreted as a native approval. Rebuilding a legacy
  section as a component is a new section with a new approval; old HTML evidence stays untouched.
- Historical evidence is append-only: canvas sessions, receipts, `BUILD-STATE.md` fields and
  parity records are not rewritten or re-stamped.
- On resume the recorded `previewMode` wins; re-detection never switches a running section.
- Projects with no `active.json` are outside the workflow and untouched.

### `commands/design-build.md` + `.opencode/commands/design-build.md`

Four lines added to the mode paragraph pointing at the migration section. Both mirrors stay
byte-identical (`sha1 29fbe193291900aa00016fe52d9bb3102d38e796` after the edit; the AGY
projection reads the canonical file, so nothing is duplicated per runtime).

## Verification

```
node tests/lib/antigravity-closure.test.js          → 13 passed, 1 skipped (new C4c)
node tests/lib/design-build-native-state.test.js    → 39 passed (new legacy-semantics test)
node tests/design-build-v2-invariants.test.js       → 40 passed
node tests/lib/design-build-direction-a11y.test.js  → 10 passed
node tests/design-build-v2-hotfix.test.mjs          → 10 passed
node tests/lib/design-build-preview-runtime.test.js → 12 passed
node tests/lib/plan-canvas-{preview-mode,sessions,antigravity}.test.js → 12 / 16 / 13
node tests/lib/antigravity-{skill-tree,workflow-state}.test.js → 7 / 9
node scripts/ci/validate-context-profiles.js        → valid (380 skills)
```

New assertions:

- **C4c** — the OpenCode mirror is byte-identical to the canonical command; both the command
  and the skill state that an HTML approval is never reinterpreted; the AGY operation for
  `opl-design-build` sources `commands/design-build.md`; and a **dry run of
  `transformInstallContent`** proves the projected skill body carries the migration clause,
  synthesizes frontmatter, and retains no `.opencode/workflows|markers` path. This is the
  install dry-run the plan requires, captured as a test rather than a one-off command.
- **Legacy is never gated as native** — a `standalone-html` request completes with
  `g2.mode === 'standalone-html'` and `receipt.why === undefined` even when it carries a
  `designDigest`, so an old HTML section cannot be pulled into the native gate by a stray field.

## Manifests refreshed

- `staging/distribution/design-build-v2-manifest.json` — `skills/design-build/SKILL.md`
  (`ec98ae54b5e8` → `503ea2393aee`, 30845 → 31841 bytes), both command mirrors
  (`6b762ae2da3b` → `5c1ea494961d`, 12099 → 12313). Still 23 files.
- `docs/plans/design-build-v2/foundation-manifest.json` — same three entries.
- `manifests/context-packs/skill-triggers@1.json` — `registryDigest` only
  (`d6d2c775a879…` → `a04b9d9c524c…`). Triggers were not regenerated: the skill's
  `description` did not change, so the trigger set and `triggersDigest` are unchanged. Only the
  tree digest moved.

## Honest status

| Surface | Status | Evidence |
|---------|--------|----------|
| OpenCode `/design-build` resolves to the updated skill | **VERIFIED** (in-repo) | C4c byte-identity + skill content |
| AGY `/opl-design-build` projection | **PARTIAL** | closure test + transform dry run only; owner must run the CLI once |
| Shared Canvas across both runtimes | **VERIFIED** (in-repo) | unchanged Canvas code; `plan-canvas-antigravity` 13/13 |
| Runtime state isolation | **VERIFIED** (in-repo) | `antigravity-workflow-state` 9/9; projection rewrites `.opencode/workflows` → `.agents/ecc-opl/workflows` |
| Legacy in-progress HTML sessions finish | **VERIFIED** by tests | legacy gate path green; no migration code touches them |
| Old HTML approvals never read as native | **VERIFIED** by tests | legacy test above; native branch requires digests a legacy record does not have |
| Historical evidence not rewritten | **VERIFIED** by construction | append-only policy; no code path edits prior records |
| Track A | untouched | release-compat only, per DBN-15 |

## Known limits

- AGY stays **PARTIAL** until the owner runs `/opl-design-build` once on the CLI. No in-repo test
  can prove the installed runtime.
- The migration policy is prose enforced by review, not a validator. Consistent with the plan's
  "no unnecessary validators".
- The only code-level guarantee against misclassification is that the native branch fails
  closed when approval digests are absent — that is what keeps legacy records out, not a mode flag.
