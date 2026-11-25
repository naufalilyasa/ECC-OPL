# Design-Build V2 — Landmark Scope & Admission Closure

**Baseline:** `0b181171` + uncommitted Round-6 fixes
**Mode:** targeted closure, six named areas
**STOP:** reached after functional closure. Nothing committed, pushed, or deployed.

---

## 1. Track A admission authority

### What was wrong

`scripts/lib/design-build-antigravity-gate.mjs` was a **parallel declarative verifier**. It
checked that fields existed and looked plausible, then returned `ADMITTED`. It never called
`verifyAdmissionCertificate` — the canonical authority in
`scripts/design-build-v2/track-a-admission.mjs` that actually reads PNG bytes, checks
dimensions, and re-derives digests.

The consequence, reproduced in this batch: a certificate carrying a placeholder
`approvedBundleSha256`, four `PASS` labels, two captures containing only
`{ verdict: 'PARITY_PASS' }`, and `renderedEvidence.verified: true` was accepted. No
screenshot bytes were required, so any hand-built object could unlock design-build.

### What changed

`enforceTrackAAdmission(certificate, images, options)` now delegates:

```js
const verification = verifyAdmissionCertificate(certificate, images)
if (verification.status !== 'ADMITTED') {
  return blocked('TRACK_A_UNVERIFIED', {
    why: verification.reason || 'CANONICAL_VERIFICATION_FAILED',
    viewport: verification.viewport,
    designBuildReferenceAdmission: 'BLOCKED'
  })
}
```

The canonical verifier already enforces every requirement the directive named: all approved
capture profiles present, real paired PNGs decodable at the declared dimensions, and
`sha256(reference)` / `sha256(candidate)` equal to the declared digests. No parallel shape
check remains, and no new verifier was created.

New `loadAdmissionImages(certificate, certificatePath)` resolves the PNG pairs a certificate
names, relative to the certificate file. Missing bytes stay missing, so the verifier blocks
instead of the gate inventing evidence.

### Stale artifact protection

A failed or interrupted capture leaves the previous `track-a-admission.json` on disk. The
gate now accepts `options.currentRevisionSha256` and refuses when the certificate is bound to
a different revision:

- no `candidateRevisionSha256` → `ADMISSION_REVISION_UNBOUND`
- different value → `ADMISSION_REVISION_STALE`

This check runs before any evidence is examined, so a stale `ADMITTED` file cannot be reused
for a new candidate.

---

## 2. Comparison scope bound to approved landmarks

### What was wrong

Three probes reproduced, all of them silent false passes:

| Probe | Old behaviour |
|-------|--------------|
| Matching `profileKey` + explicit **subset** of landmarks | `PARITY_PASS` — only the subset compared |
| Explicit **empty** landmark array | `PARITY_PASS` — loop body never ran |
| Custom measurement, **no** explicit comparison array | Fell back to `DEFAULT_LANDMARKS` (P-WEB1 topbar) |

### What changed

`compareRendered` now derives the required scope from the measurement identity and refuses
any divergence, all returning `code: 'PARITY_FAIL'` with a `property: 'landmarkSet'` diff:

1. measurement `profileKey` mismatch → fail
2. `landmarks` omitted while the measurement carries a `profileKey` → fail
   (no silent fixture fallback)
3. `landmarks` empty → fail
4. `landmarkProfileKey(landmarks) !== measuredKey` → fail (covers reduced scope)

Viewport, state, and accessibility coverage are untouched — the comparison still runs every
landmark in the approved set across every required viewport.

---

## 3. Landmark validation completed

`resolveLandmarks` (the existing resolver — no new schema framework) now additionally rejects:

| Rejection | Reason |
|-----------|--------|
| Duplicate landmark `name` | Two entries collided in the measurement map, silently comparing one element twice |
| Unsupported measured property | A typo yields `undefined` on both sides, which read as a match |
| Malformed explicit profile | `landmarks` not an array, or unparseable JSON |

A new `ALLOWED_PROPS` allowlist covers the computed-style properties the measurement code
reads. Unknown names are rejected at resolve time rather than silently measuring nothing.

`compareRendered` also stops treating two missing values as agreement:

```js
if (avp === undefined || cvp === undefined) {
  diffs.push({ landmark: lm.name, property: p, missing: true, verdict: 'FAIL' })
  continue
}
```

Two `undefined`s are missing evidence, not equality.

---

## 4. R6 regression assertion corrected

R6-8 asserted `result.verdict`, but `compareRendered` returns `result.code`. The assertion
therefore compared `undefined !== 'PARITY_PASS'` and passed **vacuously** — it never tested
anything.

Corrected to assert the exact failure and the specific diff:

```js
assert.strictEqual(result.code, 'PARITY_FAIL')
assert.ok(result.diffs.some(d => d.property === 'landmarkSet'))
```

Two cases were added to the same suite:

- **R6-9** — omitted comparison scope for a custom measurement fails
- **R6-10** — empty and reduced comparison scopes fail

---

## 5. CSS asset handling

The replacement-string defect from R6 was already fixed. Two gaps remained, both now closed:

| Gap | Old behaviour | New behaviour |
|-----|---------------|---------------|
| `<link>` inside an HTML comment | Selected and inlined, corrupting the comment | Comments blanked before matching, then restored verbatim |
| `data-href="style.css"` | Matched as if it were the stylesheet | Only `rel="stylesheet"` elements are considered |

Unsupported configurations now fail explicitly instead of producing unstyled evidence:

- zero stylesheet links → `could not find a <link rel="stylesheet"> element to inline`
- more than one stylesheet link → `unsupported asset configuration: N stylesheet links found`
- stylesheet href that is not `style.css` → `unsupported asset configuration: cannot inline <href>`

The `$`-expansion and `</style>` protections from R6 are retained.

---

## 6. Functional closure — real browser evidence

`scripts/design-build-v2/closure-evidence.mjs` runs Chromium against a **non-P-WEB1** custom
landmark profile for a notification-panel section:

```js
{ name: 'panel-header',  selector: '.panel-header',  props: ['display', 'minHeight', 'fontWeight'] }
{ name: 'status-pill',   selector: '.status-pill',   props: ['display', 'borderRadius', 'fontVariantNumeric'] }
{ name: 'reminder-row',  selector: '.reminder-row',  props: ['display', 'gap', 'paddingTop'] }
```

Result — **7/7 checks passed**:

| # | Check | Result |
|---|-------|--------|
| 1 | Complete approved landmark coverage | PASS — all three landmarks present at both viewports |
| 2 | Matching candidate passes at every viewport | PASS — `PARITY_PASS, PARITY_PASS` |
| 3 | Deliberate mismatch in one required landmark fails | PASS — `PARITY_FAIL, PARITY_FAIL`, diff on `panel-header` |
| 4 | Missing required measurement fails | PASS — `presence` diff on `reminder-row` |
| 5 | Admission blocked without real evidence | PASS — verifier `BLOCKED/SCREENSHOT_PAIR_INCOMPLETE`, gate `BLOCKED` |
| 5b | Same certificate admits **only** with the real PNGs | PASS — `ADMITTED` |
| 6 | Canonical a11y import and frontend direction intact | PASS |

Check 5b is the decisive one: the identical certificate object is rejected without bytes and
accepted with them. That proves the gate is wired to evidence rather than to object shape.

Real artifacts written to `artifacts/landmark-scope-closure/`:
`desktop-1440-{reference,candidate}.png` (13.0K each), `mobile-390-{reference,candidate}.png`
(9.3K each), plus `closure-evidence.json`.

**This is not a Track A admission certificate.** It is measurement evidence for this closure.
No admission was manufactured for any production project, and no claim is made about Rlogic
acceptance from synthetic fixtures.

---

## 7. Test results

| Suite | Result |
|-------|--------|
| `design-build-landmark-scope-closure` (new) | RED 4/15 → **GREEN 15/15** |
| `design-build-landmarks-review-fixes` | 10/10 (R6-8 corrected, R6-9/R6-10 added) |
| `design-build-antigravity-gate` | 7/7 (placeholder-certificate test rewritten) |
| `design-build-landmark-profiles` | 7/7 |
| `design-build-track-a-admission` | 8/8 |
| `design-build-direction-a11y` | 10/10 |
| `design-build-v2-invariants` | 40/40 |
| `design-build-v2-probes` | 55/55 |
| Carrier closure | 5771 files, 0 escapes, 35/35 specifiers |
| `command-registry:check` | up to date |
| `validate-context-profiles` | valid, 380 skills |

Two pre-existing tests had to be **rewritten, not supplemented**, because they encoded the
behaviour this batch removes:

- `design-build-antigravity-gate.test.js` previously asserted a placeholder-shape certificate
  returned `OK`. It now asserts the same certificate stays `BLOCKED` without evidence, plus a
  new case for the stale-revision refusal.
- `design-build-landmarks-review-fixes.test.js` R6-3 expected the error message to mention
  `style.css`; the new contract reports a missing `<link rel="stylesheet">` first.

---

## 8. Remaining blockers

1. **No Track A certificate for any real project.** `cc-reminder`'s existing certificate is a
   baseline admission where reference and candidate are the same bytes; it also lacks
   `candidateRevisionSha256`, so it now reports `ADMISSION_REVISION_UNBOUND` when a caller
   supplies a current revision. Design-build stays blocked for it until a certificate is
   regenerated with real repair evidence and a revision binding.
2. **Committed evidence artifacts were left untouched** — per the directive, no
   `docs/design/evidence/**` file was modified. The gate blocks rather than the batch
   rewriting history.
3. **No live `agy --sandbox` design-build run.** The gate is exercised directly with real
   browser measurements; the CLI projection is unchanged from the prior rollout.
4. **Pre-existing 57-skill npm publish drift** — recorded separately in the R6 report and not
   touched here. `skills/a11y/` was the only gap this batch's predecessor closed.
5. **Nothing committed, pushed, or deployed.**
6. **`.guardian-angel/*` excluded** from every diff by standing owner decision.

---

## 9. Diff summary

| File | Change |
|------|--------|
| `scripts/lib/design-build-antigravity-gate.mjs` | Admission delegates to the canonical verifier; revision binding; `loadAdmissionImages` |
| `scripts/design-build-v2/render-parity.mjs` | `ALLOWED_PROPS`; duplicate-name rejection; scope binding in `compareRendered`; undefined ≠ equal |
| `scripts/design-build-v2/capture-project-evidence.mjs` | `inlineAssets` ignores comments and `data-href`; fails on unsupported wiring |
| `scripts/design-build-v2/closure-evidence.mjs` | **New** — real browser closure evidence |
| `tests/lib/design-build-landmark-scope-closure.test.js` | **New** — 15 focused cases |
| `tests/lib/design-build-landmarks-review-fixes.test.js` | R6-8 corrected; R6-9/R6-10 added |
| `tests/lib/design-build-antigravity-gate.test.js` | Placeholder-certificate assertion rewritten |
| `artifacts/landmark-scope-closure/*` | **New** — 4 real PNGs + evidence JSON |

No new agents, commands, state machines, validators, or design-build V3. The canonical a11y
import and distribution infrastructure are unchanged.
