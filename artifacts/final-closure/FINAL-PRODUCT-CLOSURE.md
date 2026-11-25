# Design-Build V2 — Final Product Execution Closure

**Baseline:** `ecc-opl` HEAD `0b181171` + uncommitted admission fixes
**Target application:** `/Users/ctp-itdev2/Documents/my-project/rlogic-wms` (Laravel 13.43 + Inertia + React)
**Section executed:** `04-receiving-scan-task`, revision `redo-3`
**Verdict:** admission authority **CLOSED**; real section gate **BLOCKED** on a genuine pre-existing finding.

---

## §1 Admission authority — four defects closed

All four were reproduced as failing tests before being fixed. No second verifier was created; every fix lands in `scripts/design-build-v2/track-a-admission.mjs`, `scripts/lib/design-build-antigravity-gate.mjs`, or the producer.

| Defect | Before | After |
|--------|--------|-------|
| **(c)** Canonical verifier admits G1 FAIL | Only `G2_rendered_fidelity` was inspected (line 54); G0/G1/G3 never read | Every gate in `CANONICAL_GATE_SEQUENCE` must be present and `PASS`; a declared FAIL or absent gate blocks with `GATE_CHAIN_FAILED` |
| **(d)** Self-referential digest check | `sha(pair.reference) !== declared.referenceSha256` compared against the caller's own certificate — any two valid PNGs admitted once the caller wrote their hashes. `approvedBundleSha256` was a hex-format regex only | New `options.approvedBundleSha256` anchor: when supplied the seal must match; `requireApprovedBundle: true` blocks with `APPROVED_BUNDLE_ANCHOR_MISSING` when no anchor exists |
| **(e)** Revision binding fails open | `if (currentRevision) { ... }` — omitting `options.currentRevisionSha256` skipped the entire binding block | A missing current revision is itself a binding failure (`ADMISSION_REVISION_UNBOUND`). Stale binding still yields `ADMISSION_REVISION_STALE` |
| **(f)** Symlink escapes the evidence dir | Guard compared the **unresolved** path; a symlink inside the dir passed the prefix check and `readFileSync` followed it outside | `realpathSync` on both the base dir and each candidate file; anything whose real location is outside the real base is refused. Missing bytes stay missing |

Test suite `tests/lib/design-build-admission-authority.test.js` — **RED 5/12 → GREEN 12/12**.
The anchor binds to the recorded `canvasApproval.bundleSha256` (owner decision), not a new registry file.

## §2 Landmark scope preserved

No change to the configurable-landmark mechanism. `compareRendered` still fails on an omitted, empty, or reduced comparison scope, and `landmarkProfileKey` remains the scope identity. The 55 measurements in the section gate were compared against the approved contract profile.

## §3 One real application section executed

The section was rendered from the **running Laravel/Inertia application**, not a static HTML imitation.

**Runtime prerequisites resolved** (no `.env` modified — env overrides only):
- `DB_HOST=pgsql` is a Docker service name that does not resolve on this host → `DB_HOST=127.0.0.1` (local Postgres reachable)
- `SESSION_DRIVER=redis`, `CACHE_STORE=redis`, `QUEUE_CONNECTION=redis` but the `redis` PHP extension is **not installed** → overridden to `file`/`file`/`sync`
- `php artisan serve --host=127.0.0.1 --port=8000`, login as `operator@nexvora.local` (19 users exist)

**Captured from the live app** — `scripts/design-build-v2/capture-live-section.mjs`, real Chromium, real login, real session:

| Viewport | HTTP | h1 | Font resolved | `--color-primary` | Bytes |
|----------|------|----|---------------|-------------------|-------|
| 1440x900 | 200 | Scan workstation | Instrument Sans | `#1b2a41` | 100,979 |
| 1280x900 | 200 | Scan workstation | Instrument Sans | `#1b2a41` | 99,894 |
| 768x1024 | 200 | Scan workstation | Instrument Sans | `#1b2a41` | 49,042 |
| 390x844 | 200 | Scan workstation | Instrument Sans | `#1b2a41` | 41,702 |
| 360x800 | 200 | Scan workstation | Instrument Sans | `#1b2a41` | 40,111 |

Console errors: **0** at every viewport.

**Section gate result** (`scripts/design-build-v2/section-gate.mjs`, 5 required viewports):

```
receipt : INVALID_RECEIPT | candidateFileHashMismatch | resources/js/Scanning/ScanField.tsx
gates   : null (not reached)
g2      : PARITY_PASS | matched: 55 | failed: []
checkpoint: PARITY_NOT_VERIFIED
```

**This is an honest block, not a tooling failure.** Rendered parity against the approved reference passes at all five viewports (55 measurements matched, 0 failed). What fails is source-identity: three of the five files the approval receipt pins have changed since `redo-3` was approved.

| File | Receipt hash | Current hash |
|------|--------------|--------------|
| `resources/js/Pages/Inbound/Receipts/Create.tsx` | `db6d6029…` | `db6d6029…` ✓ |
| `resources/js/Scanning/ScanField.tsx` | `a9431d3d…` | `a9bd5a14…` ✗ |
| `resources/js/Pages/Inbound/Receipts/create.test.tsx` | `2805fee8…` | `2805fee8…` ✓ |
| `resources/js/Scanning/ScanField.test.ts` | `9550e699…` | `16b84796…` ✗ |
| `app/Http/Controllers/Inbound/InboundReceiptController.php` | `2ce5bd23…` | `d4bc7022…` ✗ |

The receipt was recorded 2026-11-25 02:47; the files were last committed in `ce2f003 feat(ui): reconcile Rlogic WMS with Nexvora UI and RBAC`. The approval predates the current source. **A new approval is required before this section can gate.**

## §4 Honest blockers

1. **Section `04-receiving-scan-task` needs re-approval.** Source changed after the `redo-3` receipt. I did not manufacture a receipt or reuse the stale one — the gate refuses, correctly.
2. **The application does not implement the frozen v2.0 contract.** `REF-01-CONTRACT.md` is `FROZEN v2.0` (Urbanist + DM Mono, `#111111`/`#1A4BE0`), but the running app resolves `Instrument Sans` and `--color-primary: #1b2a41`. Per owner decision, the gate ran against what exists (v1.1) and the result is reported as v1.1.
3. **`BUILD-STATE.md` is inaccurate.** It claims v2.0 token work in `resources/css/app.css` and `vite.config.js` and lists Urbanist/DM Mono font files that **do not exist on disk**. `git status` on those paths is clean — the v2.0 work was never committed.
4. **Runtime overrides were required** (DB host, session/cache/queue drivers). A deployment needs either the Docker network or a real Redis extension.
5. **Historical certificates lack `candidateRevisionSha256`.** Both `ecc-opl/docs/design/evidence/p-web1/track-a-admission.json` and `cc-reminder/.../track-a-admission.json` now report `ADMISSION_REVISION_UNBOUND`. Per owner decision they must be reproduced; not done in this round.
6. **No `agy --sandbox` design-build run.** Admission is blocked, so Antigravity design-build stays inactive.
7. **Nothing committed, pushed, or deployed.**

## §5 What was changed

Small diff, no new verifier, no new workflow/agent/PRD/validator:

- `scripts/design-build-v2/track-a-admission.mjs` — complete gate chain; approved-bundle anchor; `requireApprovedBundle`
- `scripts/lib/design-build-antigravity-gate.mjs` — mandatory revision binding; passes anchor through; realpath-contained image loading
- `scripts/design-build-v2/capture-live-section.mjs` (new) — renders the real running app through real login at 5 viewports
- `tests/lib/design-build-admission-authority.test.js` (new) — 12 cases reproducing (c)(d)(e)(f)
- 3 existing suites updated to the stricter contract (not weakened)

Regression: **all green** — authority 12/12, gate 7/7, track-a 8/8, admission-review-fixes 8/8, scope-closure 15/15, landmarks-review-fixes 10/10, landmark-profiles 7/7; `closure-evidence.mjs` live run 7/7.

**STOP.** No further execution without owner re-approval of section 04.
