# Implementation Plan: ECC-OPL /design-build V2.0 — Design-to-Code Fidelity

- **Status**: DRAFT
- **Revision**: r2
- **Upstream Digest**:
  - Source Brief (`ecc-opl-design-build-v2-design-to-code-fidelity-engineering-brief.md`): `d53384183e7a6f274521939e0e8152b095d365595e3c1153bd56406967755dfa`
  - Baseline Audit (`ecc-opl-design-build-fidelity-audit-v1.zip`): `c8a2669cdede11ef3ecc5c41998631292160e92ac978fa40edf14393700d50e3`
- **Target Repo HEAD**: `3d30e0c4` (E2E V2.0 closure; preserve all 60 pre-existing dirty paths)
- **Mode**: Standard Planning (Brownfield engineering specification for owner review — authorizes NO implementation, deployment, protected-file change, or active HOME install until separately approved).
- **Runtime Resolution Status**: `CANONICAL_DESIGN_BUILD_RESOLUTION=STATIC_VERIFIED` (Brief §9.3 mandates runtime source selection is `STATIC_VERIFIED` until actual host invocation demonstrates the winner; static discovery establishes presence, not runtime precedence).

---

## Overview

The ECC-OPL `/design-build` workflow delivers high-quality creative direction on standalone HTML canvases, but handoff to framework components (React/Inertia, Astro, Vue, Svelte, Flutter, Kotlin Compose) currently suffers from visual fidelity loss. The baseline audit (`ecc-opl-design-build-fidelity-audit-v1.zip`) proved that fidelity is lost during component translation due to: (1) missing framework-adapter specifications (F1); (2) visual authority conflicts between taste scales (`4/6/8`, `8/12/20`) and rigid contract/scaffold audits (`8/12/16`, 4px grid) (F2); (3) three disjoint, non-equivalent verification gates that fail to compare served output to the approved canvas (F3); (4) manual, drifting approval hash records (F4); (5) uncoordinated mid-port typography re-decisions (F5); (6) fragmented skill variants across repo and HOME (F6); (7) competing design authorities and unapproved alternative references (F7); (8) unverified section-write plugin enforcement in OpenCode (F8); and (9) underspecified capture/tolerance environments (F9).

V2.0 transforms visual fidelity from passive documentation into an executable, reproducible engineering contract. It establishes lifecycle-based design authority, makes approved canvas bundles immutable inputs, introduces lightweight framework adapters that translate rather than redesign, unifies verification into an ordered gate chain (G0–G5) with structured evidence receipts, decouples canvas approval from section completion, and enforces a bounded repair loop (max 2 cycles) that repairs framework implementation rather than mutating the approved design reference. Delivery is structured across Milestones M0–M5 (Work Packages WP0–WP5), prioritizing an immediate thin vertical slice in M1 (real canvas → React/Inertia port → measured parity → repair → section completion).

---

## Affected User and Ideal State

**Affected User**: Product designers, frontend engineers, mobile developers, and autonomous coding agents using `/design-build` across web and native platforms. Today, an owner approves a canvas in an interactive browser review, but the resulting framework implementation frequently loses design elements (e.g. mobile headers hiding labels, padding jumping from 16px to 24px, tabular numerals reverting to proportional fonts, or uncoordinated generators creating completely different layouts scoring 9.95/10 against third-party screenshots). After V2.0, the approved canvas bundle is an immutable binding visual reference; port adapters translate faithfully into idiomatic code; automated parity checks verify computed geometry, tokens, typography, and screenshots against explicit tolerances; and section completion requires valid evidence receipts before advancing.

| Row | Statement | Reason |
|---|---|---|
| **IS-1** | Approved canvas is a binding visual reference; framework code preserves its composition, typography, density, geometry, and interaction intent. | Eliminates silent drift where framework defaults (preflight, unanchored CSS scoping, widget padding) alter the design after human sign-off. |
| **IS-2** | A single authoritative source governs each design decision at each lifecycle stage (pre-freeze vs post-freeze). | Prevents competing skills (`frontend-design-direction`, `design-system`, `gan-style-harness`) from re-deriving or overwriting approved decisions. |
| **IS-3** | Project-specific design rules prevail over hardcoded aesthetic defaults; custom scales (e.g. 20px radius, 6px gaps) are first-class when defined in the contract. | Reconciles the taste engine's sharp (`4/6/8`) and soft (`8/12/20`) scales with contract audits without requiring fake classes or manual rule weakening. |
| **IS-4** | Framework porting is governed by explicit adapter contracts that translate approved markup/CSS/tokens without redesigning or injecting unapproved styling. | Provides predictable, idiomatic implementation for React/Inertia, Vue, Svelte, Astro, Flutter, and Compose while preserving component lifecycle and maintainability. |
| **IS-5** | Section completion strictly requires reproducible rendered parity evidence against the exact approved canvas SHA; approval alone does not advance the loop. | Closes the loop-hole where `sectionApproved: true` advances the workflow before framework code is ported, verified, or repaired. |
| **IS-6** | Parity failures trigger a bounded repair loop (max 2 cycles) that fixes the implementation code, never mutating the approved reference or loosening tolerances. | Prevents infinite agent repair loops and guarantees that the human's approved baseline remains pristine unless an explicit contract amendment is authorized. |
| **IS-7** | Workflow state survives session restarts, compactions, and interruptions; stale or mutated dependencies automatically invalidate parity. | Ensures long sessions or context compactions cannot accidentally resume in an unverified state or advance without re-validating disk assets. |

| Row | Current Gap vs Ideal State | Why It Matters |
|---|---|---|
| **GAP-1** | Framework porting is ad hoc with no adapter specification (`SKILL.md:130-143`), leading to lossy manual translations and styling bugs (F1). | Implementations drop visible elements (e.g. Rlogic mobile warehouse labels) or invent component structures that diverge from the approved design. |
| **GAP-2** | Taste scale (`8/12/20`) conflicts with mandatory contract/scaffold `8/12/16` tiers and 4px grid regexes (F2). | Audit tests fail on approved taste outputs unless developers manually weaken audits or add ad-hoc CSS overrides (e.g. Nexvora `--radius-2xl: 20px`). |
| **GAP-3** | Three disjoint gates (`gate.mjs`, scaffold checklist, design-build parity) check different criteria with no shared evidence schema or canvas SHA binding (F3). | Suites report "green" while the served page looks wrong; taste gate checks house rules rather than canvas equivalence; scaffold checklist lacks pixel checks. |
| **GAP-4** | Approved canvas identity is recorded manually in free-form `BUILD-STATE.md` and drifts across session runs (F4). | Stale or conflicting file hashes (e.g. Nexvora 3 different hashes for `index.astro`) allow divergent code to ship without detecting reference mutation. |
| **GAP-5** | Typography is re-decided ad hoc during review/port; `/typography` is not wired into the pipeline (F5). | Per-section annotations churn fonts, sizes, and tabular numeral settings after freeze, creating inconsistent typography hierarchies across sections. |
| **GAP-6** | Divergent skill copies exist in repo vs active HOME vs `.agents/skills`, with active HOME pointing to non-existent `/gan-scaffold` (F6). | The same command produces different behaviors depending on current working directory and harness resolution. |
| **GAP-7** | Competing design authorities re-derive pages; section-write gate is unverified in active OpenCode config (F7, F8, F9). | Alternative generators produce conflicting pages scoring 9.95/10 against wrong references; agents can advance loops without verified host enforcement. |

---

## Requirements

### Must Have
- **R01 (Canonical Authority)**: Reconcile all skill variants and designate repo `skills/` as canonical source of truth for `design-build`, `design-contract-system`, `frontend-scaffold`, and typography skills.
- **R02 (Authority by Lifecycle)**: Pre-freeze: owner brief, brand, accessibility, taste emissions (`start.mjs css/brand`), and `/typography DESIGN` define visual direction. Post-freeze: frozen contract is sole authority for shared tokens/rules; approved canvas bundle is sole authority for section composition.
- **R03 (Project-Specific Contract V2)**: Upgrade contract schema to support project-defined radius/spacing scales (e.g. `4/6/8`, `8/12/20`, 6px gap) as first-class tokens. Update `frontend-scaffold` audit regexes to validate resolved token mappings rather than hardcoded 8/12/16.
- **R04 (Typography Lifecycle)**: Formalize `/typography` into three distinct lifecycle modes: `DESIGN` (pre-freeze selection and role mapping), `VERIFY` (read-only metrics comparison during port/parity without mutation), and `AMEND` (contract revision invalidating dependent approvals).
- **R05 (Immutable Design Bundle)**: Section preview approval binds exact SHA-256 digests of HTML, resolved CSS/JS, contract, asset/font identities, shell revision, and render profile into an immutable logical bundle.
- **R06 (State Separation & Completion Gate)**: Decouple canvas approval (`CANVAS_APPROVED`) from section completion (`SECTION_COMPLETE`). `current` section index advances if and only if G0–G3 parity gates pass with verified evidence receipts.
- **R07 (Resume & Invalidation Matrix)**: Formalize invalidation triggers (canvas HTML/CSS change, shared token/shell change, candidate edit). Resume re-validates disk hashes against `active.json` and preserves repair attempt counts.
- **R08 (Framework Port Adapters)**: Deliver lightweight, conditional adapter specifications under `skills/design-build/references/` for Web Common (React/Inertia, Vue, Svelte, Astro) and Native Common (Flutter, Kotlin Compose) with structured mapping receipts.
- **R09 (Ordered Parity Gate Chain G0–G5)**: Combine verification into an ordered chain: G0 (Preflight/Hash), G1 (Contract Compliance), G2 (Rendered Fidelity & Geometry), G3 (State & Interaction), G4 (Assembled Quality & Rhythm), G5 (Opt-in Harden Recheck).
- **R10 (Capture & Tolerance Profiles)**: Specify matched paired capture conditions (viewport, DPR=1, theme, locale, fixed fixture data, `document.fonts.ready`, reduced motion). Prohibit universal pixel-diff scores; enforce exact categorical properties plus named tolerances per profile.
- **R11 (Bounded Repair Loop)**: Cap implementation repairs at maximum 2 cycles per approved revision. Repairs must alter framework code only, never mutating approved canvas bytes, tokens, or tolerance thresholds.
- **R12 (Thin Vertical Slice M1)**: Deliver an end-to-end working vertical slice in Milestone M1 (real canvas → React/Inertia port → paired capture → intentional drift detection → repair → section completion checkpoint).
- **R13 (Real Project Pilots)**: Validate integration on real pilot scenarios: P-WEB1 (Rlogic WMS React/Inertia mobile header) and P-WEB2 (Nexvora Astro navbar/hero/metrics), with Vue/Svelte and Native targets evaluated under honest support levels.
- **R14 (Cooperative Enforcement Disclosure)**: Disclose runtime enforcement boundaries truthfully: report `COOPERATIVE_NOT_MANDATORY` if host plugin enforcement is unverified; do not make unverified TOCTOU security claims. Note that `design-taste-frontend` Stop hook is Claude-oriented and does not fire under OpenCode.
- **R15 (Staged Release & Rollback Rehearsal)**: Prepare staged distribution manifests and persistent backup/rollback procedures. STOP before active deployment to HOME.

### Must NOT Have (Binding Scope Guardrails)
- **NO Universal Design Language**: Do not build a global design language or token framework replacing existing brand/design systems.
- **NO CSS-to-Native Compiler**: Do not build an automated AST or mechanical CSS-to-Flutter/Compose transpiler; adapters provide mapping guidelines, idiomatic patterns, and verification.
- **NO Screenshot-to-Code Generator**: Do not implement prompt-based or computer-vision-driven visual reconstruction that bypasses approved markup/CSS.
- **NO Framework Migrations or Rewrites**: Do not migrate project frameworks, update major dependency versions, or force Kotlin Views projects to Jetpack Compose.
- **NO New Subagents or Commands**: Do not introduce new subagents, slash commands, or standalone policy engines. Reuse `design-build`, `design-contract-system`, `frontend-scaffold`, `/typography`, `multimodal-looker`, and `plan-canvas`.
- **NO Synthetic Parity Receipts**: Never synthesize or hardcode a `PASS` verdict. A parity pass requires actual running dev server/emulator capture and measurement.
- **NO Production or External Network Writes**: No execution against live production, no automated dependency installations (`npm install`, `cargo`, etc.), and no external credential transmissions.
- **NO Mutation of Unrelated Workflows or Guardrails**: Do not touch `/` + `e2e`, `/plan-prd`, `/plan`, `/tdd`, `/security-audit`, `/refactor-clean`, Guardian Angel approvals (`.guardian-angel/*`), global permissions, or any of the 60 pre-existing dirty repo files.
---

## Audit Traceability Matrix

Every audit finding (F1–F9) from `ecc-opl-design-build-fidelity-audit-v1.zip` is traced to its root cause, V2 requirement, milestone/work package, and acceptance criteria / regression probes:

| Audit ID | Severity | Source-Grounded Finding | Root Cause in V1 | V2 Requirement | Milestone / WP | Acceptance ID & Probe |
|---|---|---|---|---|---|---|
| **F1** | HIGH | Port is ad hoc; no framework adapter specification | `design-build` SKILL §Step 6.3 names scoping tips but no adapter skills; developers write unguided translations. | R08, R12 | M1, M3 (WP3) | DB-AC01, DB-AC13, DB-AC14, DB-AC15, R03 |
| **F2** | HIGH | Conflicting visual authority: taste scale (`4/6/8`, `8/12/20`) vs contract/scaffold `8/12/16` and 4px grid | Hardcoded radius tiers in contract templates and scaffold audit regexes reject valid taste outputs. | R03 | M1, M2 (WP1) | DB-AC03, DB-AC04, R01, R02 |
| **F3** | HIGH | Three disjoint gates with no shared evidence schema or canvas SHA binding | Taste `gate.mjs` checks house rules; scaffold checklist is subjective; `design-build` live parity is manual. | R09, R10 | M1, M4 (WP4) | DB-AC16, DB-AC17, DB-AC18, DB-AC21, R10, R12 |
| **F4** | HIGH | Approved-canvas identity recorded manually and drifts (e.g. Nexvora 3 different hashes) | `BUILD-STATE.md` text is not verified against disk bytes; no automated digest check on resume. | R05, R07 | M1, M2 (WP2) | DB-AC08, DB-AC09, DB-AC11, R06, R07 |
| **F5** | MEDIUM | Typography re-decided ad hoc during review/port; `/typography` uncoordinated | `/typography` is not integrated into design-build lifecycle; annotations churn fonts per section. | R04 | M2 (WP1) | DB-AC04, DB-AC05, R05 |
| **F6** | MEDIUM | Fragmented skill variants across repo, HOME, and `.agents/skills`; stale `/gan-scaffold` reference | Lack of canonical source resolution and distribution sync; HOME copy carries legacy dead code. | R01, R15 | M0 (WP0), M5 (WP5) | DB-AC01, DB-AC26 |
| **F7** | MEDIUM | Competing design authorities (`frontend-design-direction`, `design-system`, `/gan-scaffold` 9.95/10 against third-party comp) | Lifecycle authority boundaries undefined; downstream tools allowed to re-derive visual direction post-freeze. | R02, R11 | M1, M2 (WP1, WP2) | DB-AC02, R10, R15 |
| **F8** | MEDIUM | Section-write gate unverified in active runtime; `workflow-gate` not in OpenCode config | Workflow claimed host enforcement while `design-quality-check.js` is explicitly non-blocking. | R06, R14 | M1, M2 (WP2), M4 (WP5) | DB-AC10, DB-AC24, R08 |
| **F9** | LOW | Capture environment underspecified (viewport, scale, theme, font readiness, fixture data) | Command A1.5 mentions only copy and console; lacks deterministic rendering pre-conditions. | R10 | M1, M4 (WP4) | DB-AC16, DB-AC19, R11 |

---

## Complete Acceptance Criteria Coverage Table (DB-AC01–DB-AC26)

All 26 acceptance conditions mandated by Brief §11 are explicitly mapped to their implementing milestone, responsible step, test mechanism, and exact validation criteria:

| ID | Name & Required Condition (Guarantee) | Implementing Milestone & Step | Verification Probe / Test Mechanism | Exact Assertion & Pass Criteria |
|---|---|---|---|---|
| **DB-AC01** | **Canonical source and runtime resolution**: Compare exact command/skill copies and observed effective path/version from repo and non-repo fixture; mark static resolution as `STATIC_VERIFIED`. | M0 (WP0) — Step 1 | `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="AC01"` | Asserts repo `skills/` is locked as canonical source; all 8 hashes match live disk; runtime status reports `STATIC_VERIFIED`. |
| **DB-AC02** | **No conflicting post-freeze design authority**: Actual port loads only contract consumer/adapter in verify mode; attempted redesign by downstream tools blocks or triggers amendment. | M2 (WP1) — Step 8 | Probe R10, R15 (`tests/design-build-v2-probes.test.js`) | Asserts downstream tools attempting to re-derive visual direction post-freeze are blocked with `CONTRACT_CONFLICT`. |
| **DB-AC03** | **Project-defined radius/spacing accepted**: 4/6/8, 8/12/20, approved 6px spacing/custom rounded-md accepted in matching contract; undeclared value fails. | M2 (WP1) — Step 8 | Probe R01, R02 (`tests/design-build-v2-probes.test.js`) | Asserts declared 20px radius and 6px gap pass audit; unapproved arbitrary values (`p-[13px]`) are rejected. |
| **DB-AC04** | **Contract and typography coherent**: Roles, units, families, fallbacks, state applicability validated; taste conflict resolved before freeze. | M2 (WP1) — Step 8, 10 | `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="AC04"` | Contract validator confirms complete typography token roles, font fallback chains, and state coverage without syntax or semantic errors. |
| **DB-AC05** | **Typography lifecycle**: DESIGN produces map; VERIFY detects wrong face/weight/wrap without mutation; AMEND invalidates dependent approvals. | M2 (WP1) — Step 10 | Probe R05 (`tests/design-build-v2-probes.test.js`) | Asserts VERIFY mode detects font mismatch without editing files; AMEND triggers invalidation of affected canvas approvals. |
| **DB-AC06** | **Technical scaffold preserves design**: Actual rendered shell uses project tokens without component library default style substitution. | M2 (WP1) — Step 9 | P-WEB1 & P-WEB2 rendered shell test (`tests/design-build-v2-invariants.test.js`) | Asserts rendered shell consumes contract CSS variables; zero component library default color or radius overrides present. |
| **DB-AC07** | **Prerequisites before freeze / shell before preview**: Missing asset blocks or approved placeholder; preview reference includes current shell. | M1 (WP2) — Step 4 | `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="AC07"` | Asserts contract freeze fails if referenced assets lack verified hashes or approved placeholders; preview requires shell context. |
| **DB-AC08** | **Exact canvas approval identity**: Actual approve event tied to displayed bundle; plain ok/stale revision/duplicate event cannot unlock port. | M1 (WP2) — Step 4 | Probe R07 (`tests/design-build-v2-probes.test.js`) | Asserts canvas verdict event with matching revision unlocks port; plain chat or mismatched verdict ID is rejected. |
| **DB-AC09** | **Dependency closure and immutability**: HTML/CSS/font/image/shell change invalidates affected verdict; historical reference bytes remain unchanged. | M1, M2 (WP2) — Step 4, 11 | Probe R06 (`tests/design-build-v2-probes.test.js`) | Asserts modifying canvas CSS after approval flags `BUNDLE_INVALIDATED`; historical canvas HTML bytes remain unchanged on disk. |
| **DB-AC10** | **State completion separation**: Canvas approval does not advance `current`; required parity PASS and checkpoint advance exactly once. | M1, M2 (WP2) — Step 7, 11 | Probe R08 (`tests/design-build-v2-probes.test.js`) | Asserts `sectionApproved: true` leaves `current` unchanged; advancement occurs only after G0–G3 parity receipt is sealed. |
| **DB-AC11** | **Resume / interruption**: Revalidate state after restart/compaction; changed candidate invalidates parity; repair count preserved. | M2 (WP2) — Step 11 | Probe R09 (`tests/design-build-v2-probes.test.js`) | Asserts workflow resume re-verifies disk hashes; modified candidate resets parity to PENDING; repair attempt counter is preserved. |
| **DB-AC12** | **Contract amendment**: Scoped owner change → contract first → affected preview revision → new verdict; unrelated references preserved only if proven. | M2 (WP2) — Step 11 | `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="AC12"` | Asserts contract amendment invalidates only dependent section approvals based on shared token dependency graph. |
| **DB-AC13** | **Web conversion fidelity**: Reuse approved markup/CSS/asset identity with idiomatic framework events; compare actual rendered geometry and styles. | M1, M3 (WP3) — Step 5, 12 | P-WEB1 & P-WEB2 component diffs (`tests/design-build-v2-invariants.test.js`) | Asserts framework component preserves DOM landmark hierarchy, semantic classes, and computed box dimensions from canvas. |
| **DB-AC14** | **Web dynamic behavior**: Scoped dynamic DOM, dropdown clipping/radius, responsive visibility, hydration, and actual interaction checked. | M3 (WP3) — Step 12 | P-WEB3 dynamic DOM & drawer test (`tests/design-build-v2-invariants.test.js`) | Asserts dynamic DOM nodes retain scoped styles via `:global()`/`:deep()`; floating dropdowns retain inherited border radius. |
| **DB-AC15** | **Native equivalence**: Actual per-target profile, token/theme/font mapping, screenshot/semantics, and approved adaptations; NOT_RUN if no toolchain. | M3 (WP3) — Step 13 | P-NATIVE1/2 target mapping test (`tests/design-build-v2-invariants.test.js`) | Asserts logical px/dp/sp conversions and ThemeData/MaterialTheme mappings; absent emulator reports `NOT_RUN` without failing build. |
| **DB-AC16** | **Comparable capture**: Same viewport/density, locale, theme, fixture, state, fonts, shell, motion checkpoint; stale or missing input blocks. | M4 (WP4) — Step 15 | Probe R11 (`tests/design-build-v2-probes.test.js`) | Asserts capture profile asserts DPR=1, font readiness, fixed fixture, and reduced motion; missing dev server returns `BLOCKED_UNMEASURABLE`. |
| **DB-AC17** | **Measured drift detection**: Deliberately altered padding/visibility/font fails despite passing token audit where appropriate. | M1, M4 (WP4) — Step 6 | Probe R04 (`tests/design-build-v2-probes.test.js`) | Asserts deliberate 8px padding delta and hidden label in P-WEB1 topbar fail G2 geometry check with exact discrepancy logs. |
| **DB-AC18** | **Evidence integrity**: Missing/wrong screenshot, wrong bundle/candidate/profile, malformed/contradictory PASS rejected. | M4 (WP4) — Step 15 | Probe R12 (`tests/design-build-v2-probes.test.js`) | Asserts receipt validator rejects receipt claiming PASS when individual measurements contain FAIL or screenshot digest is stale. |
| **DB-AC19** | **Required states and behavior**: Required state not captured or interaction broken blocks; explicit N/A justified by contract. | M4 (WP4) — Step 15 | `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="AC19"` | Asserts all in-scope system states (loading, empty, error) are verified; out-of-scope states require explicit contract rationale. |
| **DB-AC20** | **Repair preserves reference**: Actual implementation fixed; reference hash unchanged; max 2 repairs then blocked. | M1, M4 (WP4) — Step 7 | P-WEB1 repair test (`tests/design-build-v2-invariants.test.js`) | Asserts framework fix restores visual parity while approved canvas HTML/CSS SHA-256 remains byte-identical; max 2 repairs enforced. |
| **DB-AC21** | **Final assembly gate**: Individually green sections cannot hide shared CSS/shell drift; final current-revision gate required, OFF not PASS. | M4 (WP4) — Step 16 | Probe R13 (`tests/design-build-v2-probes.test.js`) | Asserts G4 assembled gate checks full-page layout rhythm and shared shell; rejects gate result if `gate.mjs` outputs `GATE: OFF`. |
| **DB-AC22** | **Harden scope**: Opt-in budget; same baseline; unauthorized visual change rejected or amended; affected gates rerun. | M4 (WP4) — Step 17 | Probe R15 (`tests/design-build-v2-probes.test.js`) | Asserts `--harden` modifies only craft details; unauthorized layout/token changes fail G5 recheck and are reverted. |
| **DB-AC23** | **Actual host runtime**: Real command/skill/adapter path, approval event, capture, terminal section completion; no helper-only claim. | M5 (WP5) — Step 20 | Host smoke test (`tests/design-build-v2-invariants.test.js`) | Asserts full execution through `/design-build` host command path; unexecuted host environment reports `STATIC_VERIFIED`. |
| **DB-AC24** | **Scoped enforcement disclosure**: Actual loaded/advisory/blocking status established; no unsupported mandatory enforcement claims. | M0 (WP0) — Step 2 | Config audit assertion (`tests/design-build-v2-invariants.test.js`) | Asserts runtime enforcement status is explicitly recorded as `COOPERATIVE_NOT_MANDATORY`; tool bypass boundaries documented. |
| **DB-AC25** | **Compatibility and protected scope**: Existing command flags/other workflows unaffected; no Guardian Angel or global config changes before authorization. | M3, M5 — Step 14, 18 | `git diff --stat` & `tests/design-build-v2-invariants.test.js --test-name-pattern="AC25"` | Asserts `--resume`, `--section`, `--harden` flags maintain compatibility; all 60 pre-existing dirty repo paths remain untouched. |
| **DB-AC26** | **Release reproducibility**: Exact candidate file/dependency hashes, safe staging install, persistent backup/rollback, honest target support matrix. | M5 (WP5) — Step 18, 19, 20 | Rollback rehearsal (`scripts/rehearse-rollback.sh`) | Asserts staged distribution bundle has exact manifest digests; backup rehearsal successfully restores pre-change state with 0 diff. |

---

## Gap Pass (Metis, inline)

A structured evaluation across the 6 Metis axes conducted prior to finalizing this plan:

1. **Contradictions**:
   - *Conflict*: Taste engine produces sharp (`4/6/8`) or soft (`8/12/20`) scales, while `design-contract-system` and `frontend-scaffold` enforce mandatory `8/12/16` tiers and flag anything else as contract violations.
     *Resolution*: `RESOLVED` via DB-WP1. Contract rules become project-specific. If the frozen contract records `--radius-2xl: 20px` or `compactGap: 6px`, the scaffold audit accepts it; unapproved arbitrary values are rejected.
   - *Conflict*: GAN harness / visual evaluators scoring 9.95/10 against alternative references vs approved canvas binding.
     *Resolution*: `RESOLVED` via DB-WP2. Post-freeze, the approved canvas bundle is the sole visual authority. Hardening is strictly opt-in, bounded by budget, and cannot alter approved composition.
2. **Ambiguity**:
   - *Term*: `sectionApproved` in V1 active.json was conflated with section completion, advancing `current` before framework porting was verified.
     *Resolution*: `RESOLVED` via DB-WP2. Clear state decoupling: `CANVAS_APPROVED` unlocks the port; `SECTION_COMPLETE` requires `PARITY_PASS` on the live candidate.
   - *Term*: "Native pixel-diff". CSS pixels cannot match physical mobile pixels 1:1 due to DPI, platform typography leading, and system safe areas.
     *Resolution*: `RESOLVED` via DB-WP3/WP4. Native targets target visual equivalence under explicit target profiles (dp/sp, homologous content regions) with approved platform adaptations; no universal pixel diff.
3. **Missing Constraints**:
   - *Runtime Enforcement*: Audit showed `workflow-gate` and `ecc-hooks` are not active in OpenCode's explicit plugin list, and the taste `design-taste-frontend` Stop hook is Claude-oriented (`--hook claude`) and does not fire under OpenCode (Brief §1.2).
     *Resolution*: `RESOLVED` by implementing cooperative section gating in the canonical workflow path, recording `COOPERATIVE_NOT_MANDATORY`, and documenting tool-bypass limits without false security claims.
   - *Pilot Environment Prerequisites*: Native toolchains (Flutter SDK, Android/Gradle emulator) may be absent in the execution environment.
     *Resolution*: `RESOLVED` via DB-WP3/WP5. Web pilots (React/Inertia, Astro) run first; native targets report honest support levels (`SPECIFIED` vs `RENDER_VERIFIED` vs `NOT_RUN`). Rollout of web is not blocked by absent native toolchains.
4. **Execution Risks**:
   - *Non-Existent Skills*: Audit identified references to `design-scaffold`, `/gan-scaffold`, `svelte-patterns`, and `flutter-patterns`.
     *Resolution*: `RESOLVED`. Never create dummy aliases. Improve canonical `frontend-scaffold`, remove stale `/gan-scaffold` from HOME, and map Flutter/Svelte to existing `dart-flutter-patterns` and web common.
   - *Pre-existing Repo State*: 60 files currently dirty in repo HEAD `3d30e0c4`.
     *Resolution*: `RESOLVED`. Plan strictly isolates changes to designated `design-build` and related skill files; zero edits to existing dirty files.
5. **Topology Gaps**:
   - *Gate Confusion*: Three separate gates had undefined precedence.
     *Resolution*: `RESOLVED` via DB-WP4. Single ordered gate chain G0–G5 with explicit entry and exit conditions sharing one evidence receipt schema.
6. **Brownfield Risks**:
   - *V1 Active Workflows*: Overwriting active workflow state could corrupt running tasks.
     *Resolution*: `RESOLVED`. V2 preserves active.json schema compatibility (`workflow`, `phase`, `steps`, `current`, `gates`) and only extends design-build specific properties.

**Gap Pass Verdict**: `Gap pass: 8 issues resolved, 12 open (OWNER_DECISION_REQUIRED - DB-DEC01-12 proposed for owner approval)`.
---

## Architecture Changes & Specifications

### 1. Authority Lifecycle Model
Visual authority is governed by lifecycle phase rather than a static global priority list:

```
PRE-FREEZE (Exploration & Design)
├── Owner Brief & Brand Constraints   ──> Establishes domain, tone, boundaries
├── Material Candidate Research (ui-ux-pro-max) ──> Provides candidate palettes & UX patterns
├── Taste Engine (design-taste-frontend) ──> Emits candidate visual direction (css/brand)
└── Typography Lifecycle DESIGN (/typography) ──> Reconciles typeface pairing & role tokens
                                       │
                                       ▼
                       [4 FREEZE CONTRACT GATE]
                                       │
POST-FREEZE (Production Porting & Verification)
├── Frozen Contract (DESIGN.md + docs/design/*) ──> SOLE authority for shared tokens, theme, standards
├── Approved Canvas Bundle (sections/NN-*.html + CSS) ──> SOLE authority for section composition & intent
├── Framework Port Adapters (React, Vue, Svelte, Astro, Flutter, Compose) ──> Translates syntax & layout
├── Ordered Parity Gate Chain (G0–G5) ──> Verifies 1:1 fidelity against canvas & contract
└── Implementation Code ──> Evidence, NEVER the source of visual truth
```

*Conflict Rule*: If canvas implementation contradicts the frozen contract post-freeze, it is flagged as `CONTRACT_CONFLICT`. Porting halts until either: (a) contract is formally amended (`AMEND` lifecycle) and affected previews re-approved; or (b) preview is corrected to conform to contract. Implementation code is NEVER re-extracted as a new authority baseline. Note also that the taste engine's Stop hook is Claude-oriented (`--hook claude`) and does not fire under OpenCode (Brief §1.2); post-freeze enforcement is governed by cooperative section gating within `/design-build`.

---

### 2. Canonical File Map, Hash Baseline & Shadowing Resolution

Repo `skills/` is designated as the single canonical authoring source. Commands act as thin shims. HOME and Codex mirrors are updated strictly via staged distribution sync in WP5.
*Hash Baseline Note*: Audit hash prefixes (e.g. `cddc381c0bcd`, `efbfe33b1d2a`, `999f152819ea`, `b0e42224820a`) are 12-character identification shorthand; full 64-character SHA-256 digests are computed and verified from live disk bytes in WP0 Step 1.
*Runtime Status*: In accordance with Brief §9.3, runtime source selection status is explicitly designated as `CANONICAL_DESIGN_BUILD_RESOLUTION=STATIC_VERIFIED`. Static discovery confirms file presence and hash integrity across the repo, but actual host execution precedence (DB-AC23) remains unproven until exercised on the running host.

```
Target File Structure:
skills/design-build/
├── SKILL.md                                 # Canonical orchestrator & lifecycle authority
└── references/
    ├── web-common.md                        # Web translation rules (DOM, CSS, assets, hydration)
    ├── adapter-react.md                     # React / Inertia component & JSX adapter
    ├── adapter-vue.md                       # Vue 3 SFC & scoped CSS (:deep) adapter
    ├── adapter-svelte.md                    # Svelte template & dynamic selector adapter
    ├── adapter-astro.md                     # Astro layout & island scoping adapter
    ├── native-common.md                     # Native equivalence, viewports & homologous regions
    ├── adapter-flutter.md                   # Flutter widget, ThemeData & logical px adapter
    ├── adapter-compose.md                   # Kotlin Jetpack Compose & Modifier adapter
    ├── capture-profile-spec.md              # Matched paired render capture requirements
    └── tolerance-profile-spec.md            # Categorical & geometric tolerance definitions

skills/design-contract-system/
├── SKILL.md                                 # Contract lifecycle, state applicability, token rules
└── templates/
    ├── standards.md                         # Project-specific standards (removes hardcoded 8/12/16)
    ├── token-map.md                         # Token mapping schema supporting custom scales
    └── page-contract.md                     # Page contract template with Section 5 Composition

skills/frontend-scaffold/
├── SKILL.md                                 # Technical shell & canonical contract audit consumer
└── references/
    └── fidelity-checklist.md               # Measured structural checklist (multimodal-looker)

commands/
├── design-build.md                          # Thin command shim (preserves arguments & CLI adapters)
└── typography.md                            # Typography command (wires DESIGN / VERIFY / AMEND modes)

.opencode/commands/
├── design-build.md                          # Synced copy of command shim
└── typography.md                            # Synced copy of typography command

tests/
├── design-build-v2-invariants.test.js       # Real invariant assertion test (bundle, state, tokens)
├── design-build-v2-probes.test.js           # Regression test suite covering Probes R01–R15
└── fixtures/
    └── p-web1-rlogic/                       # Disposable minimal M1 vertical slice fixture
        ├── 00-topbar.html                   # Approved HTML preview of WMS mobile header
        ├── AppLayout.tsx                    # React/Inertia component candidate
        ├── capture-config.json              # Render profile (390x844, 360x800, dark, DPR=1)
        ├── active.json                      # Isolated workflow state checkpoint for P-WEB1
        └── README.md                        # Labels fixture as synthetic, disposable test stand-in
```

---

### 3. Project Contract Schema V2 (`schemaVersion: 2`)

Replaces rigid hardcoded aesthetic values with project-specific validated token contracts. Stored in `docs/design/contracts/[FEATURE]-CONTRACT.json` (or machine-readable frontmatter/sidecar):

```json
{
  "$schema": "https://ecc.tools/schemas/design-contract-v2.json",
  "schemaVersion": 2,
  "revision": "r1",
  "projectId": "rlogic-wms",
  "pageId": "receiving",
  "authorityStatus": "FROZEN",
  "ownerDecisionRef": "DB-DEC01",
  "tokens": {
    "color": {
      "semantic": {
        "surface": {"light": "#ffffff", "dark": "#0f172a"},
        "text-strong": {"light": "#0f172a", "dark": "#f8fafc"},
        "primary": {"light": "#2563eb", "dark": "#3b82f6"}
      }
    },
    "radius": {
      "scale": "sharp",
      "sm": {"value": 4, "unit": "px"},
      "md": {"value": 6, "unit": "px"},
      "lg": {"value": 8, "unit": "px"},
      "full": {"value": 9999, "unit": "px"}
    },
    "spacing": {
      "grid": 4,
      "compactGap": {"value": 6, "unit": "px", "reason": "WMS dense data table"}
    },
    "typography": {
      "roles": {
        "h1": {"family": "Inter", "weight": 700, "size": 32, "lineHeight": 40, "unit": "px"},
        "body": {"family": "Inter", "weight": 400, "size": 14, "lineHeight": 20, "unit": "px"},
        "kpi-number": {"family": "Inter", "weight": 600, "size": 24, "lineHeight": 32, "numeric": "tabular-nums"}
      }
    }
  },
  "stateApplicability": {
    "loading": {"required": true},
    "empty": {"required": true},
    "error": {"required": true},
    "noPermission": {"required": true},
    "slowNetwork": {"required": false, "reason": "Internal intranet tool"}
  },
  "toleranceProfile": "dense-data-app"
}
```

---

### 4. Approved Design Bundle Specification

When canvas review produces `{"kind":"verdict","verdict":"approve"}`, the bundle is sealed into an immutable record:

```json
{
  "schemaVersion": 2,
  "pageId": "receiving",
  "sectionId": "00-topbar",
  "revision": "r1",
  "timestamp": "2026-11-24T12:00:00.000Z",
  "artifacts": {
    "previewHtml": {"path": "docs/design/sections/00-topbar.html", "sha256": "3a8c..."},
    "resolvedCss": {"path": "docs/design/sections/00-topbar.css", "sha256": "9b1e..."},
    "contract": {"path": "docs/design/contracts/receiving-CONTRACT.md", "sha256": "4f2a..."},
    "shellRevision": "s1",
    "assets": [
      {"id": "logo-icon", "path": "docs/design/assets/logo.svg", "sha256": "8c4d..."}
    ]
  },
  "approval": {
    "sessionId": "canvas:rlogic-topbar@2026-11-24T11:58:10.000Z",
    "verdictId": "verdict-89",
    "verdict": "approve",
    "bundleDigest": "e72b4c1a89f3... (SHA-256 of canonical artifact digest list)"
  },
  "renderProfile": {
    "viewports": [
      {"name": "desktop", "width": 1440, "height": 900},
      {"name": "mobile-390", "width": 390, "height": 844},
      {"name": "mobile-360", "width": 360, "height": 800}
    ],
    "dpr": 1,
    "theme": "dark",
    "locale": "id-ID",
    "fontsReadyRequired": true,
    "reducedMotion": true
  }
}
```

---

### 5. Section State Machine & Invalidation Matrix

```
[PREVIEW_DRAFT] ──> Generate HTML & Preview
       │
       ▼
[AWAITING_APPROVAL] ──> Open plan-canvas & await verdict
       │
       ├─► Reject / Change Request ──> Annotate & return to [PREVIEW_DRAFT]
       ▼
[CANVAS_APPROVED] ──> Bundle sealed (SHA-256 bound)
       │
       ▼
[PORT_IN_PROGRESS] ──> Framework adapter translates code
       │
       ▼
[PARITY_PENDING] ──> Run G0 (Preflight), G1 (Tokens), G2 (Geometry/Render), G3 (State)
       │
       ├─► Parity FAIL (attempts < 2) ──> [REPAIR_REQUIRED] ──> Fix component code ──┐
       │                                         ▲                                   │
       │                                         └───────────────────────────────────┘
       ├─► Parity FAIL (attempts >= 2) ──> [BLOCKED] (Escalate to Owner)
       ▼
[PARITY_PASS] ──> Evidence receipt sealed & verified
       │
       ▼
[SECTION_COMPLETE] ──> Advance current section in active.json ──> Next section or [ASSEMBLE]
```

**Invalidation Matrix**:
- **Canvas HTML/CSS mutated**: Affected approval invalidated immediately. Workflow resets to `PREVIEW_DRAFT` for that section.
- **Shared token/theme/shell mutated**: All sections dependent on that shell/token are invalidated; prior parity passes revoked; must re-verify.
- **Framework component code mutated**: Approved canvas bundle stays immutable. Current candidate parity is invalidated; must rerun G0–G3.
- **Owner requests visual change post-approval**: Requires formal `AMEND` lifecycle. Contract updated first, preview updated, fresh canvas verdict obtained. Never patch live app directly.

---

### 6. Ordered Gate Chain (G0–G5)

Replaces conflicting gates with a unified, ordered chain where every gate references the same approved bundle SHA:

| Gate | Name | Purpose | Method / Tool | Pass Criteria |
|---|---|---|---|---|
| **G0** | Reference Preflight | Validates that approval event, dependencies, and disk hashes match active checkpoint. | Hash comparison against `active.json` bundle manifest via `tests/design-build-v2-invariants.test.js`. | Exact hash match; no drift or missing files. |
| **G1** | Contract Compliance | Verifies implementation code consumes defined semantic tokens, not raw values. | Project canonical test (`tests/design-contract-audit.test.js`). | 100% tokens resolved; zero undeclared arbitrary geometry/colors. |
| **G2** | Rendered Fidelity | Measures live served component against approved canvas across required viewports. | Matched paired browser captures, computed styles, DOM bounds measurement. | All critical landmarks within defined tolerance; zero hidden elements. |
| **G3** | State & Interaction | Confirms required dynamic system states and interactions function without error. | Dev server execution, console error log check, component state trigger. | 0 console errors, 0 hydration mismatches; required states verified. |
| **G4** | Assembled Quality | Evaluates whole assembled page for section transitions, rhythm, and shell cohesion. | Final page render, `consistency.mjs`, `copy-lint.mjs`, layout rhythm. | Literal PASS verdict from assembled check; inter-section rhythm verified. |
| **G5** | Harden Recheck | (Opt-in only) Verifies that optional GAN hardening did not alter approved design. | Rerun G0–G3 over hardened candidate. | Zero visual composition deviation from approved bundle. |

---

### 7. Common Evidence Receipt Schema

Stored in `docs/design/evidence/<pageId>/<sectionId>-receipt.json`:

```json
{
  "schemaVersion": 2,
  "sectionId": "00-topbar",
  "revision": "r1",
  "approvedBundleSha256": "e72b4c1a89f3...",
  "candidateCommitSha": "3d30e0c4",
  "candidateFileHashes": {
    "src/layouts/AppLayout.tsx": "a1b2c3d4..."
  },
  "captureProfile": {
    "viewport": {"width": 390, "height": 844},
    "dpr": 1,
    "theme": "dark"
  },
  "gateResults": {
    "G0_preflight": "PASS",
    "G1_contract": "PASS",
    "G2_rendered_fidelity": "PASS",
    "G3_state_interaction": "PASS"
  },
  "measurements": [
    {
      "landmark": "topbar-container",
      "property": "padding-top",
      "expected": 16,
      "actual": 16,
      "unit": "px",
      "tolerance": 0,
      "verdict": "PASS"
    },
    {
      "landmark": "warehouse-badge",
      "property": "visibility",
      "expected": "visible",
      "actual": "visible",
      "verdict": "PASS"
    }
  ],
  "screenshots": {
    "reference": "docs/design/evidence/receiving/topbar-ref-390.png",
    "referenceSha256": "7c8d9e...",
    "candidate": "docs/design/evidence/receiving/topbar-live-390.png",
    "candidateSha256": "1a2b3c..."
  },
  "overallVerdict": "PARITY_PASS",
  "repairAttempts": 1,
  "timestamp": "2026-11-24T12:05:30.000Z"
}
```
---

## Implementation Steps

### Phase 0: M0 — Targeted Preflight, Canonical Mapping & Approved Plan (WP0)
1. **Reconcile Canonical File Baseline & Hash Drift** (Files: `skills/design-build/SKILL.md`, `commands/design-build.md`, `.opencode/commands/design-build.md`, `tests/design-build-v2-invariants.test.js`)
   - Action: Check current bytes of all target files against audit baseline (`SOURCE-HASHES.json`). Note that audit hash prefixes are 12-char shorthand and recompute full 64-char SHA-256 digests from live disk. Designate repo `skills/` as single canonical source. Formally document runtime source selection status as `CANONICAL_DESIGN_BUILD_RESOLUTION=STATIC_VERIFIED`.
   - Why: Closes F4 and F6. Resolves multi-version divergence between repo, HOME, and `.agents/skills/`.
   - Closes: GAP-4, GAP-6
   - References: `source/effective-resolution-report.md`, `SOURCE-HASHES.json`
   - Acceptance: File manifest with exact current 64-char SHA-256 hashes for all 8 target skills/commands created without drift; canonical authoring root locked to `skills/`; runtime status set to `STATIC_VERIFIED`.
   - QA: happy - `shasum -a 256 skills/design-build/SKILL.md commands/design-build.md` matches declared baseline; failure - `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="AC01 hash mismatch"` detects drift and exits with code 1.
   - Dependencies: None
   - Risk: Low
2. **Catalog Host Capabilities & Enforcement Resolution** (Files: `docs/plans/design-build-v2-fidelity.plan.md`, `tests/design-build-v2-invariants.test.js`)
   - Action: Audit active OpenCode configuration. Document that `workflow-gate` and `ecc-hooks` are absent from the active plugin list, `design-quality-check.js` is non-blocking, and the taste Stop hook is Claude-oriented and does not fire under OpenCode. Explicitly mark runtime enforcement mode as `COOPERATIVE_NOT_MANDATORY`.
   - Why: Closes F8. Prevents false security/enforcement claims and guarantees that gates are called cooperatively by the canonical workflow path.
   - Closes: GAP-7
   - References: `source/enforcement/active-opencode-config.jsonc`, `source/enforcement/design-quality-check.js`
   - Acceptance: Enforcement reality recorded in plan and skill documentation with clear boundaries.
   - QA: happy - `jq -e '.plugins | index("workflow-gate") == null and index("ecc-hooks") == null' ~/.config/opencode/opencode.jsonc || grep -q 'COOPERATIVE_NOT_MANDATORY' docs/plans/design-build-v2-fidelity.plan.md` returns exit 0; failure - `grep -E 'MANDATORY_HOST_ENFORCEMENT|TOCTOU_PROTECTED' docs/plans/design-build-v2-fidelity.plan.md` returns exit 1 (no unsupported claims).
   - Dependencies: Step 1
   - Risk: Low
3. **Formalize Pilot Selection & Support Matrix Baseline** (Files: `docs/plans/design-build-v2-fidelity.plan.md`, `tests/design-build-v2-invariants.test.js`)
   - Action: Select P-WEB1 (Rlogic WMS React/Inertia mobile header) as M1 vertical slice pilot, P-WEB2 (Nexvora Astro) for M4. Baseline native targets as `SPECIFIED` (NOT_RUN until toolchain verified).
   - Why: Delivers immediate value on web while establishing honest boundaries for mobile/native platforms.
   - Closes: GAP-1, GAP-7
   - References: Brief §9.2, §10
   - Acceptance: Pilot datasets, viewports, and targets explicitly locked in plan.
   - QA: happy - `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="pilot specification baseline"` returns exit 0; failure - `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="pilot missing viewport"` asserts expected rejection `PILOT_VIEWPORT_UNDEFINED`.
   - Dependencies: Step 2
   - Risk: Low
4. **Stage Minimal Disposable M1 Fixture (P-WEB1 Rlogic)** (Files: `tests/fixtures/p-web1-rlogic/00-topbar.html`, `AppLayout.tsx`, `capture-config.json`, `active.json`, `README.md`, `tests/design-build-v2-invariants.test.js`)
   - Action: Stage a minimal, disposable, clearly-labeled fixture under `tests/fixtures/p-web1-rlogic/` containing: `00-topbar.html` (HTML preview of WMS mobile header), `AppLayout.tsx` (React/Inertia component candidate with warehouse badge `▦ WH-01` and 16px top padding), `capture-config.json` (viewports 390x844 and 360x800, dark theme, DPR=1), `active.json` (initialized section checkpoint), and `README.md` labeling this as a synthetic test stand-in for the historical rlogic snapshot without copying private code.
   - Why: Fulfills Blocker B4. Provides an exact, reproducible testbed on disk for M1 without relying on audit ZIP descriptions.
   - Closes: GAP-1, GAP-4
   - References: Brief §9.2, `evidence/rlogic/BUILD-STATE.md:80-98`
   - Acceptance: Fixture files exist on disk with verified digests; `README.md` explicitly documents synthetic stand-in status.
   - QA: happy - `test -f tests/fixtures/p-web1-rlogic/00-topbar.html && test -f tests/fixtures/p-web1-rlogic/AppLayout.tsx` returns exit 0; failure - `grep -q "CONFIDENTIAL" tests/fixtures/p-web1-rlogic/*` returns exit 1 (no private app code leaked).
   - Dependencies: Step 3
   - Risk: Low

---

### Phase 1: M1 — Thin Vertical Slice: Canvas → React/Inertia Port → Measured Parity → Repair → Completion (Core WP1/WP2/WP3/WP4)
5. **Implement Core Design Bundle Sealing & Identity Protocol** (Files: `skills/design-build/SKILL.md`, `skills/design-build/references/bundle-protocol.md`, `tests/design-build-v2-invariants.test.js`)
   - Action: Extend Step 6.2 in `design-build/SKILL.md` to compute and bind SHA-256 digests of preview HTML, resolved CSS, contract, and assets upon `kind:"verdict", verdict:"approve"`. Write `active.json` with `approvedBundleSha256`. Define bundle verification in `tests/design-build-v2-invariants.test.js` validating resolved bytes and relative paths without synthetic PASS generation.
   - Why: Closes F4. Guarantees that the exact canvas viewed by the owner is the immutable input to the port.
   - Closes: GAP-4
   - References: `skills/design-build/SKILL.md:118-129`, `evidence/rlogic/active.json`
   - Acceptance: Bundle manifest generated with verified SHA-256 digests; tampering with HTML/CSS invalidates the approval state.
   - QA: happy - `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="bundle verification protocol"` returns exit 0; failure - `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="bundle tampering invalidation"` asserts `BUNDLE_INVALIDATED`.
   - Dependencies: Phase 0 (Steps 1-4)
   - Risk: Medium
6. **Implement React/Inertia Framework Port Adapter Reference** (Files: `skills/design-build/references/adapter-react.md`, `tests/design-build-v2-invariants.test.js`)
   - Action: Author the React/Inertia port adapter. Specify JSX translation rules: className/htmlFor, controlled forms, asset path remapping (`./assets` → `public/images/` or imports), scoped CSS/Tailwind mapping, preservation of Inertia layout (`AppLayout.tsx`), and explicit preservation of dense data labels.
   - Why: Closes F1. Replaces ad-hoc porting with a repeatable, idiomatic translation specification.
   - Closes: GAP-1
   - References: Brief §7.2, `evidence/rlogic/BUILD-STATE.md:80-98`
   - Acceptance: Adapter specification defines exact Landmark → Component → Token → Event mapping for React/Inertia.
   - QA: happy - `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="adapter-react translation rules"` returns exit 0; failure - `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="adapter-react unanchored global css"` asserts expected error `GLOBAL_CSS_SPILL_DETECTED`.
   - Dependencies: Step 5
   - Risk: Medium
7. **Implement G0–G3 Parity Verification & Negative Drift Repro on P-WEB1 Fixture** (Files: `skills/design-build/SKILL.md`, `skills/design-build/references/parity-chain.md`, `tests/fixtures/p-web1-rlogic/AppLayout.tsx`, `tests/design-build-v2-invariants.test.js`)
   - Action: Implement minimal G0 (Preflight), G1 (Tokens), G2 (Geometry), G3 (Console) verification. Introduce deliberate regression on `tests/fixtures/p-web1-rlogic/AppLayout.tsx` (hide warehouse badge, change top padding from 16px to 24px `pt-6`). Verify gate FAILS with structured measurement diffs.
   - Why: Closes F3, F9. Proves the gate detects real regressions instead of rubber-stamping code.
   - Closes: GAP-3, GAP-7
   - References: Brief §8.1, §8.3, Probe R04
   - Acceptance: G2 gate detects missing warehouse badge and 8px padding delta at 390×844; returns `PARITY_FAIL` with exact diffs.
   - QA: happy - `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="probe R04 negative drift"` asserts `PARITY_FAIL` with padding delta 8px; failure - passing buggy candidate fails the test suite.
   - Dependencies: Step 6
   - Risk: Medium
8. **Execute Bounded Repair on P-WEB1 Fixture & Achieve Section Completion Checkpoint** (Files: `skills/design-build/SKILL.md`, `docs/design/BUILD-STATE.md`, `.opencode/workflows/active.json`, `tests/fixtures/p-web1-rlogic/AppLayout.tsx`, `tests/design-build-v2-invariants.test.js`)
   - Action: Repair `tests/fixtures/p-web1-rlogic/AppLayout.tsx` (restore warehouse badge, revert to 16px padding). Rerun G0–G3. Verify `PARITY_PASS`. Record evidence receipt and advance `active.json` state to `SECTION_COMPLETE`. Confirm approved canvas HTML bytes remain unchanged.
   - Why: Closes F4, F8, F20. Proves the thin vertical slice functions end-to-end: failure → bounded repair → verification → checkpoint advance.
   - Closes: GAP-1, GAP-3, GAP-4, GAP-6
   - References: Brief §8.5, `evidence/rlogic/BUILD-STATE.md:140-175`
   - Acceptance: G2 passes; evidence receipt sealed; `active.json` advances `current` from 0 to 1; canvas HTML SHA-256 untouched.
   - QA: happy - `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="step 8 repair topbar"` returns exit 0 (asserts repair restores badge, G2 passes, active.json advances, 00-topbar.html SHA untouched); failure - `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="step 8 repair limit exceeded"` asserts 3rd consecutive parity failure halts with exit code 1 and logs `REPAIR_LIMIT_EXCEEDED`.
   - Dependencies: Step 7
   - Risk: Medium

---

### Phase 2: M2 — Authority, Contract & Typography System V2 (WP1 & WP2 Complete)
9. **Update Design Contract System for Project-Specific Scales** (Files: `skills/design-contract-system/SKILL.md`, `skills/design-contract-system/templates/standards.md`, `templates/token-map.md`, `tests/design-build-v2-invariants.test.js`)
   - Action: Remove hardcoded `8/12/16` radius tiers and strict 4px grid as mandatory global limits. Define them as defaults for projects without established brand systems. Support taste sharp (`4/6/8`) and soft (`8/12/20`) scales, and custom gaps (e.g. 6px) as first-class declared tokens.
   - Why: Closes F2. Reconciles taste emissions with contract law without forcing unnatural CSS conversions.
   - Closes: GAP-2
   - References: Brief §5.2, `source/skills/design-contract-system/SKILL.md:24-29`
   - Acceptance: Contract templates accept 20px radius and 6px gaps when declared; unapproved arbitrary values (`p-[13px]`) remain blocked.
   - QA: happy - `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="custom radius 20px declared"` returns exit 0; failure - `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="undeclared arbitrary radius"` asserts expected rejection `CONTRACT_VIOLATION: undeclared radius 21px`.
   - Dependencies: Phase 1
   - Risk: Medium
10. **Update Frontend Scaffold Audit Consumer & Fidelity Checklist** (Files: `skills/frontend-scaffold/SKILL.md`, `skills/frontend-scaffold/references/fidelity-checklist.md`, `tests/design-build-v2-invariants.test.js`)
    - Action: Update `tests/design-contract-audit.test.js` generation template in `frontend-scaffold`. Ensure regexes validate resolved tokens against project contract instead of hardcoding `rounded-md` as a universal syntax error. Eliminate stale `/gan-scaffold` reference.
    - Why: Closes F2, F6. Prevents contract audit tests from breaking on valid custom project tokens.
    - Closes: GAP-2, GAP-6
    - References: Brief §5.2, §5.4, `skills/frontend-scaffold/SKILL.md:135-152`
    - Acceptance: Scaffold canonical test dynamically configures allowed token sets from `docs/design/TOKEN-MAP.md`; stale command references removed.
    - QA: happy - `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="scaffold audit dynamic tokens"` returns exit 0; failure - `grep -q '/gan-scaffold' skills/frontend-scaffold/SKILL.md` returns exit 1 (stale command completely excised).
    - Dependencies: Step 9
    - Risk: Medium
11. **Implement Typography Lifecycle (DESIGN, VERIFY, AMEND)** (Files: `commands/typography.md`, `.opencode/commands/typography.md`, `skills/ux-typography/SKILL.md`, `skills/typography-system/SKILL.md`, `skills/better-typography/SKILL.md`, `tests/design-build-v2-invariants.test.js`)
    - Action: Wire `/typography` into three explicit lifecycle modes: `DESIGN` (pre-freeze pairing/scales), `VERIFY` (read-only comparison of live computed font-family, weight, line-height, wrap, and tabular figures against contract without mutation), and `AMEND` (formal contract amendment invalidating dependent approvals).
    - Why: Closes F5. Prevents mid-port typography re-decisions and preserves tabular number rules.
    - Closes: GAP-5
    - References: Brief §5.3, `source/commands/typography.repo.opencode.md`
    - Acceptance: Running `/typography` post-freeze defaults to read-only `VERIFY`; detected discrepancies flag `TYPOGRAPHY_MISMATCH` without editing files.
    - QA: happy - `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="typography verify mode"` returns exit 0; failure - `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="typography post-freeze redesign blocked"` asserts `MUTATION_BLOCKED: contract is frozen`.
    - Dependencies: Step 10
    - Risk: Medium
12. **Implement Complete Resume & Invalidation Matrix in Workflow State** (Files: `skills/design-build/SKILL.md`, `skills/workflow-state/SKILL.md`, `tests/design-build-v2-invariants.test.js`)
    - Action: Formalize state machine in `SKILL.md`. Ensure session resume re-validates disk hashes of HTML, CSS, assets, and contract against `active.json`. Enforce that `CANVAS_APPROVED` never increments `current` section index.
    - Why: Closes F4, F8. Ensures state compactions and restarts cannot bypass parity checks or advance sections prematurely.
    - Closes: GAP-4, GAP-7
    - References: Brief §6.3, §6.4, `source/skills/workflow-state/SKILL.md`
    - Acceptance: State machine rejects advancement on unverified parity; resume re-verifies disk hashes and preserves failure count.
    - QA: happy - `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="workflow resume hash revalidation"` returns exit 0; failure - `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="workflow resume altered canvas"` asserts `BUNDLE_INVALIDATED: canvas hash mismatch`.
    - Dependencies: Step 11
    - Risk: Medium

---

### Phase 3: M3 — Framework Adapter Coverage & Technical Translations (WP3 Complete)
13. **Implement Web Common Adapter & Scoped Framework Specifications** (Files: `skills/design-build/references/web-common.md`, `adapter-vue.md`, `adapter-svelte.md`, `adapter-astro.md`, `tests/design-build-v2-invariants.test.js`)
    - Action: Write lightweight technical adapter specifications for Vue (scoped styles, `:deep()`, Teleport), Svelte (template bindings, dynamic global selectors), and Astro (islands, static layouts, `:global()`). Cover compiler scoping, asset roots, responsive breakpoints, and hydration.
    - Why: Closes F1. Extends web framework coverage with clear translation rules that preserve approved markup and CSS.
    - Closes: GAP-1
    - References: Brief §7.2, `source/skills/vue-patterns/SKILL.md`
    - Acceptance: Adapter guides provide copy-pasteable translation rules, asset mapping tables, and compiler scoping patterns for each framework.
    - QA: happy - `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="web common scoped selectors"` returns exit 0; failure - `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="web common missing asset remap"` asserts expected error `ASSET_404: ./assets/icon.svg not remapped`.
    - Dependencies: Phase 2
    - Risk: Medium
14. **Implement Native Common & Platform-Specific Adapters (Flutter & Compose)** (Files: `skills/design-build/references/native-common.md`, `adapter-flutter.md`, `adapter-compose.md`, `tests/design-build-v2-invariants.test.js`)
    - Action: Write Native Common adapter defining logical units (dp/sp), viewport/window classes, safe-area insets, homologous content regions, and font metric adjustments. Specify Flutter (`ThemeData`, `TextStyle`, `Padding`) and Jetpack Compose (`MaterialTheme`, `Modifier`, `FlowRow`).
    - Why: Closes F1. Provides native equivalence without making false claims of universal pixel identity or mechanical CSS compilation.
    - Closes: GAP-1
    - References: Brief §7.3, `source/skills/dart-flutter-patterns/SKILL.md`, `source/skills/compose-multiplatform-patterns/SKILL.md`
    - Acceptance: Native adapters define exact token mapping tables, optical tolerance rules, and explicit platform adaptation templates.
    - QA: happy - `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="native token mapping flutter compose"` returns exit 0; failure - `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="native raw webview rejected"` asserts `NATIVE_VIOLATION: silent webview substitution rejected`.
    - Dependencies: Step 13
    - Risk: Medium
15. **Integrate Conditional Skill Loading in Command Shim** (Files: `commands/design-build.md`, `.opencode/commands/design-build.md`, `tests/design-build-v2-invariants.test.js`)
    - Action: Update `commands/design-build.md` to detect target framework from project dependencies (`package.json`, `pubspec.yaml`, `build.gradle.kts`) and load only the relevant framework pattern skill (`react-patterns`, `vue-patterns`, `dart-flutter-patterns`, `compose-multiplatform-patterns`).
    - Why: Closes F1, F6. Eliminates context pollution by loading only the skill needed for the active target.
    - Closes: GAP-1, GAP-6
    - References: Brief §3.2, §7.1
    - Acceptance: Command loads target adapter conditionally; reports missing skills gracefully without halting if core rules suffice.
    - QA: happy - `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="conditional skill load react"` returns exit 0; failure - `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="unconditional skill load blocked"` asserts mobile skills are omitted for Astro project.
    - Dependencies: Step 14
    - Risk: Low

---

### Phase 4: M4 — Reproducible Parity, Multi-View Pilots & Final Gate (WP4 Complete)
16. **Implement Full Gate Chain (G0–G5) & Structured Receipt Validator** (Files: `skills/design-build/references/parity-chain.md`, `skills/design-build/references/capture-profile-spec.md`, `skills/design-build/references/tolerance-profile-spec.md`, `tests/design-build-v2-invariants.test.js`)
    - Action: Implement G0 (Reference), G1 (Contract), G2 (Rendered Fidelity), G3 (State), G4 (Assembled Quality), G5 (Harden Recheck). Define schema and validator for `evidence-receipt.json`. Specify capture conditions (DPR=1, font readiness, reduced motion, fixed synthetic fixture).
    - Why: Closes F3, F9. Replaces three conflicting finish verdicts with one deterministic, reproducible evidence chain.
    - Closes: GAP-3, GAP-7
    - References: Brief §8.1, §8.2, §8.4
    - Acceptance: Receipt schema enforces exact hash binding, viewport metadata, measurement rows, and derived pass verdicts.
    - QA: happy - `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="receipt schema valid"` returns exit 0; failure - `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="receipt schema reject contradiction"` asserts `INVALID_RECEIPT: overallVerdict cannot be PASS while measurement has FAIL`.
    - Dependencies: Phase 3
    - Risk: Medium
17. **Execute Pilot P-WEB2 (Nexvora Astro Navbar/Hero/Metrics)** (Files: `evidence/nexvora/*`, `docs/design/BUILD-STATE.md`, `tests/design-build-v2-invariants.test.js`)
    - Action: Execute pilot P-WEB2 on Nexvora Astro marketing page. Verify approved liquid-glass navbar, hero composition, 20px radius token, Montserrat display font, and tabular numbers in metrics strip. Run G4 assembled gate.
    - Why: Closes F2, F5, F7. Demonstrates full resolution of conflicting historical revisions, typography coordination, and final assembly gating.
    - Closes: GAP-2, GAP-5, GAP-7
    - References: Brief §9.2, `evidence/nexvora/BUILD-STATE.md`
    - Acceptance: P-WEB2 passes G0–G4; 20px radius accepted; tabular numbers verified; assembled rhythm passes without unapproved redesign.
    - QA: happy - `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="pilot p-web2 nexvora astro"` returns exit 0; failure - `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="pilot p-web2 gate off rejected"` asserts G4 failure if `gate.mjs` outputs `GATE: OFF`.
    - Dependencies: Step 16
    - Risk: Medium
18. **Execute Regression Probes R01–R15 Suite** (File: `tests/design-build-v2-probes.test.js`)
    - Action: Implement automated test suite covering all 15 regression probes: R01 (approved 20px radius), R02 (custom rounded-md 6px), R03 (framework button padding), R04 (mobile header label hiding), R05 (font fallback / wrap change), R06 (canvas asset change post-approval), R07 (stale approve event), R08 (`sectionApproved` without parity), R09 (resume after 2 failures), R10 (unrelated reference image), R11 (missing font/asset), R12 (contradictory PASS receipt), R13 (shared layout drift), R14 (native text scale change), R15 (unauthorized harden change).
    - Why: Guarantees that every known failure mode and invariant has automated regression coverage.
    - Closes: GAP-1, GAP-2, GAP-3, GAP-4, GAP-5, GAP-7
    - References: Brief §11.1
    - Acceptance: All 15 probes pass their defined failure/rejection assertions.
    - QA: happy - `node --test tests/design-build-v2-probes.test.js` returns 15/15 passing with exit 0; failure - any probe safety violation exits with non-zero status.
    - Dependencies: Step 17
    - Risk: Medium

---

### Phase 5: M5 — Release Prep, Staging Sync & Rollout Verification (WP5 Complete)
19. **Stage Distribution Copies & Update Command Registries** (Files: `.agents/skills/*`, `manifests/context-packs/skill-triggers@1.json`, `docs/COMMAND-REGISTRY.json`)
    - Action: Stage updated skill copies for Codex (`.agents/skills/`) ensuring frontmatter adheres to Codex validator. Update trigger manifests and command registries. Prepare staged HOME sync bundle in `staging/distribution/`.
    - Why: Closes F6. Prepares reproducible release artifacts without touching active HOME directories.
    - Closes: GAP-6
    - References: Brief §12, §13.2
    - Acceptance: Distribution manifest generated with exact file paths, sizes, and SHA-256 digests; active HOME left untouched.
    - QA: happy - `npm run catalog:sync && npm run command-registry:write` returns exit 0; failure - unstaged divergence between repo and mirror flags non-zero exit.
    - Dependencies: Phase 4
    - Risk: Low
20. **Rehearse Backup and Rollback Procedures** (Files: `scripts/rehearse-rollback.sh`, `docs/plans/design-build-v2-rollback.md`)
    - Action: Author and test a rollback script that creates persistent backups before any file replacement and demonstrates restoration to exact pre-change bytes.
    - Why: Fulfills release and rollback contract (DB-R6).
    - Closes: GAP-6
    - References: Brief §13.1, §13.2
    - Acceptance: Rollback rehearsal successfully restores previous file bytes with zero byte delta.
    - QA: happy - `bash scripts/rehearse-rollback.sh --dry-run` confirms pre-change SHA-256 restored with 0 diff; failure - `bash scripts/rehearse-rollback.sh --verify-residual` detects residual modified files and exits with code 1.
    - Dependencies: Step 19
    - Risk: Low
21. **Assemble Review Package & Generate Status Contract** (Files: `docs/releases/design-build-v2/status-contract.txt`, `docs/plans/design-build-v2-fidelity.plan.md`)
    - Action: Compile the 28 status contract variables from Brief §14 based on actual verified evidence. Package the final review summary. Set `CANONICAL_DESIGN_BUILD_RESOLUTION=STATIC_VERIFIED`, `OWNER_DEPLOYMENT_AUTHORIZATION=NOT_GIVEN`, and `ACTIVE_RUNTIME_DEPLOYED=NO`. STOP execution.
    - Why: Respects owner deployment authority (DB-R7). Prevents premature deployment.
    - Closes: GAP-7
    - References: Brief §14
    - Acceptance: Status contract generated with evidence-derived values; implementation pauses at owner sign-off boundary.
    - QA: happy - `grep -q 'OWNER_DEPLOYMENT_AUTHORIZATION=NOT_GIVEN' docs/releases/design-build-v2/status-contract.txt && grep -q 'ACTIVE_RUNTIME_DEPLOYED=NO' docs/releases/design-build-v2/status-contract.txt && grep -q 'CANONICAL_DESIGN_BUILD_RESOLUTION=STATIC_VERIFIED' docs/releases/design-build-v2/status-contract.txt` returns exit 0; failure - `grep -q 'ACTIVE_RUNTIME_DEPLOYED=YES' docs/releases/design-build-v2/status-contract.txt` returns exit 1 (deployment not authorized without explicit sign-off).
    - Dependencies: Step 20
    - Risk: Low
---

## Pilot Specifications

### Pilot P-WEB1: Rlogic WMS Mobile Header (React / Inertia) — Milestone M1
- **Target Stack**: React 18, TypeScript, Inertia.js, Tailwind CSS (`AppLayout.tsx`).
- **Fixture Staging**: Minimal disposable fixture staged at `tests/fixtures/p-web1-rlogic/` (`00-topbar.html`, `AppLayout.tsx`, `capture-config.json`, `active.json`, `README.md`). Stands in as an isolated, synthetic testbed for the historical rlogic snapshot without copying private code.
- **Approved Reference**: Standalone mobile topbar preview (`00-topbar.html`) at 390×844 and 360×800 viewports.
- **Critical Elements**: Warehouse indicator badge (`▦ WH-01`), user name/role (`Admin Utama`, `Admin`), profile link, notifications trigger.
- **Deliberate Drift Injection**: Hide warehouse badge; change top padding from 16px to 24px (`pt-6`).
- **Required Verification**:
  1. G0 Preflight: Verifies bundle hash binding.
  2. G1 Token Compliance: Verifies custom compact spacing and surface tokens.
  3. G2 Rendered Parity: Detects missing warehouse badge and 8px padding delta. Must return `FAIL`.
  4. Bounded Repair: Edit `tests/fixtures/p-web1-rlogic/AppLayout.tsx` only. Re-run G0–G2. Must return `PARITY_PASS`.
  5. Checkpoint: Advance `active.json` to `SECTION_COMPLETE`. Confirm approved HTML canvas SHA-256 untouched.

### Pilot P-WEB2: Nexvora Marketing Hero & Metrics (Astro) — Milestone M4
- **Target Stack**: Astro 4+, Tailwind CSS, scoped CSS (`index.astro`, `globals.css`).
- **Approved Reference**: Reconciled original canvas (`00-navbar.html`, `01-hero.html`) with smoked liquid-glass navbar capsule and live dashboard hero stage.
- **Critical Elements**: Liquid-glass capsule navigation, 20px radius tokens (`--radius-2xl`), Montserrat display typography, JetBrains Mono tabular figures for metrics strip.
- **Required Verification**:
  1. Token Compliance: Verifies project-specific 20px radius token is accepted without audit failure.
  2. Authority Guard: Verifies no alternative references (e.g. `compro1.webp`) are substituted.
  3. Typography Verification: Verifies metrics strip tabular numeral alignment without ad-hoc font re-selection.
  4. G4 Assembled Gate: Runs full page consistency check (`consistency.mjs`, `copy-lint.mjs`) and verifies inter-section rhythm.

### Pilot P-WEB3: Dynamic Component Fixtures (Vue & Svelte) — Milestone M3
- **Target Stack**: Vue 3 SFC (with `:deep()` dynamic styling) and Svelte 4/5.
- **Required Verification**: Dynamic DOM inserts (e.g. rotating table log rows, dynamic badge chips) retain scoped styles; responsive drawer overlays preserve rounded corners (`border-radius: inherit`).

### Pilot P-NATIVE1: Flutter Local Screen Fixture — Milestone M3
- **Target Stack**: Flutter SDK, Dart (`dart-flutter-patterns`).
- **Required Verification**: Logical unit translation (px → logical px), `ThemeData` token mapping, registered font asset rendering, safe-area adaptation, and widget/golden render capture. If local Flutter toolchain absent, report support level as `SPECIFIED`, gate as `NOT_RUN`.

### Pilot P-NATIVE2: Kotlin Jetpack Compose UI Fixture — Milestone M3
- **Target Stack**: Kotlin, Jetpack Compose (`compose-multiplatform-patterns`).
- **Required Verification**: `Modifier` order, dp/sp mapping, `MaterialTheme` token extensions, system window insets, and screenshot/semantics testing. If local Android toolchain absent, report support level as `SPECIFIED`, gate as `NOT_RUN`.

---

## Testing Strategy & Regression Probes

### 1. Test Levels & Runners
- **Unit & Invariant Tests** (`tests/design-build-v2-invariants.test.js`): Fast Node.js native test suite (`node --test`) testing contract schema validation, bundle hashing, relative path resolution, state machine transitions, and adapter mapping logic. Does NOT generate synthetic PASS receipts.
- **Integration Tests** (`tests/design-build-v2-probes.test.js`): Exercises the 15 regression probes (R01–R15) simulating negative drift, stale events, and invalid receipts.
- **Rendered Pilot Smoke**: Real headless browser captures (Playwright / Chrome DevTools) executed against running dev servers for P-WEB1 and P-WEB2.

### 2. Regression Probes Specification (R01–R15)

| Probe | Mutation / Scenario | Target Component | Required Assertion & Outcome |
|---|---|---|---|
| **R01** | Approved 20px radius declared in contract; audit checks project rules. | `design-contract-system` / `frontend-scaffold` | PASS: Contract accepts declared 20px radius. Reject undeclared 20px in standard contract. |
| **R02** | Custom `rounded-md` resolves to approved 6px. | Token Resolver | PASS: Accepts `rounded-md` mapping to 6px; FAILS if resolved computed style != 6px. |
| **R03** | Framework default button adds unapproved padding/radius/tint. | Framework Adapter / G2 Gate | PARITY_FAIL: Detects computed style divergence from approved canvas button. |
| **R04** | Mobile topbar hides warehouse badge, changes 16px padding to 24px. | P-WEB1 / G2 Gate | PARITY_FAIL: Detects hidden landmark and 8px padding delta at 390×844. |
| **R05** | Font fallback triggered or line-wrap altered due to default font. | Typography VERIFY / G2 Gate | TYPOGRAPHY_FAIL: Flags font face discrepancy even if visual layout looks plausible. |
| **R06** | Canvas CSS modified after approval; preview HTML hash unchanged. | Bundle Preflight (G0) | PREFLIGHT_FAIL: Approval invalidated; bundle digest mismatch detected. |
| **R07** | Stale or duplicate canvas approve verdict delivered from prior run. | Approval Transport (Step 6.2) | REJECT_VERDICT: Verdict ignored; does not match active preview revision. |
| **R08** | `sectionApproved: true` set manually in `active.json` without parity receipt. | State Machine / Step 6.5 | BLOCK_ADVANCEMENT: `current` index cannot increment without valid G0–G3 receipt. |
| **R09** | Session resumed after 2 failed repair attempts. | State Machine / Resume Protocol | BLOCKED_REPAIR_LIMIT: Attempt counter preserved at 2; requires owner intervention. |
| **R10** | Alternative reference image substituted (e.g. GAN 9.95/10 against compro1). | Visual Evaluator / G2 Gate | REJECT_REFERENCE: Evaluator rejects comparison against unapproved baseline image. |
| **R11** | Dev server offline, missing webfont, or unmatched viewport profile. | Capture Profile (G0/G2) | BLOCKED_UNMEASURABLE: Halts immediately; never returns false PASS. |
| **R12** | Evidence receipt claims PASS while measurement row contains FAIL. | Receipt Schema Validator | INVALID_RECEIPT: Schema validator rejects contradictory or malformed receipt. |
| **R13** | Shared `AppLayout.tsx` modified after Section 1 was completed. | Invalidation Matrix | INVALIDATE_DEPENDENTS: Section 1 parity revoked; must re-verify against new shell. |
| **R14** | Mobile OS dynamic text scaling increases font size by 20%. | Native Adapter / G2 Gate | DETECT_ADAPTATION: Flags text clipping; presents approved adaptation request. |
| **R15** | Opt-in `--harden` modifies approved hero layout and CTA button styling. | Harden Recheck (G5) | REJECT_HARDEN: Unapproved visual modifications rolled back. |

### 3. Framework Support Level Reporting

Every target framework must report its evaluated status honestly using standard levels:
- **SPECIFIED**: Adapter mapping rules defined; no running render test performed.
- **TOOL_VERIFIED**: Unit tests validate token and syntax translations.
- **RENDER_VERIFIED**: Matched paired captures prove visual equivalence on a representative fixture.
- **WORKFLOW_VERIFIED**: End-to-end execution of `/design-build` through host command, canvas approval, port, and parity gate.
- **BLOCKED / NOT_RUN**: Toolchain or emulator unavailable (with explicit explanation).

---

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation Strategy |
|---|---|---|---|
| **R-1: Pre-existing Dirty Repo Files** | Collision or corruption of ongoing tasks in the 60 dirty repo paths. | High | Strict write isolation: Plan touches zero dirty files. All new adapters and specs live in clean paths under `skills/design-build/references/`. |
| **R-2: Dev Server Startup / Port Flakiness** | Parity checks stall or fail if local server is slow to boot or port is occupied. | Medium | Enforce bounded discovery (single 10s readiness timeout). If unreachable, record `BLOCKED_UNMEASURABLE` and halt cleanly without hanging. |
| **R-3: Font Loading & Sub-pixel Optical Drift** | Subtle rendering differences across browsers/operating systems cause false parity failures. | Medium | Mandatory capture pre-conditions: DPR=1, `document.fonts.ready` assertion, reduced motion enabled, and profile-specific geometric tolerance thresholds. |
| **R-4: Infinite Repair Loops** | Agent repeatedly attempts to patch CSS, exhausting context and token budget. | Medium | Hard cap of maximum 2 auto-repair attempts per revision persisted in `active.json` and `BUILD-STATE.md`. Third failure triggers owner escalation. |
| **R-5: Unverified Native Toolchains** | Inability to run Flutter or Android Compose tests locally stalls release. | High | Decouple Web rollout from Native tooling. Web pilots establish release readiness; native adapters are marked `SPECIFIED` or `NOT_RUN` until verified. |
| **R-6: Active HOME Overwrite** | Modifying installed global skills disrupts other user workflows outside ECC. | High | Strict distribution gating (WP5): All sync artifacts staged in repo or isolated directories; active HOME modification requires explicit owner authorization. |

---

## Decisions & Owner Governance

### Decisions I Made For You (Reversible Technical Defaults)
| Decision | Default Chosen | Reversible? | Rationale |
|---|---|---|---|
| **Contract File Format** | Stored in `docs/design/contracts/[FEATURE]-CONTRACT.md` with JSON/YAML frontmatter sidecar. | Yes | Preserves human-readable documentation while enabling deterministic programmatic parsing. |
| **Web Capture Viewports** | Default set: Desktop 1440×900, Tablet 768×1024, Mobile 390×844 and 360×800. | Yes | Covers standard desktop, tablet, and the two dominant mobile viewport classes observed in audit. |
| **Adapter Placement** | Sub-files under `skills/design-build/references/adapter-*.md`. | Yes | Keeps core `SKILL.md` lean (<300 lines) while organizing adapters under progressive disclosure. |
| **Dev Server Readiness** | 10-second bounded timeout with single startup attempt. | Yes | Prevents hanging background processes or recursive restart attempts when servers fail. |
| **Evidence Receipt Storage** | Stored under `docs/design/evidence/<pageId>/<sectionId>-receipt.json`. | Yes | Co-located with project design artifacts; easily git-tracked and inspected. |

---

### Proposed Owner Decisions (DB-DEC01–12) — `OWNER_DECISION_REQUIRED`

The following 12 policy decisions are proposed in the engineering brief. They have recommended defaults but are cross-cutting owner governance choices requiring formal sign-off:

| Decision ID | Proposed Policy & Recommended Default | Alternatives Considered | Impact / Trade-offs | Status |
|---|---|---|---|---|
| **DB-DEC01** | **Project-Specific Contract**: Approved visual values in project contract prevail over generic ECC defaults (e.g. custom 20px radius or 6px spacing accepted if defined). | Enforce global mandatory 8/12/16 scale across all projects. | Recommended default allows brand diversity and respects taste emissions while preserving auditability. | `OWNER_DECISION_REQUIRED` |
| **DB-DEC02** | **Lifecycle Design Authority**: Taste proposes/emits direction pre-freeze; `/typography` owns exclusive font decisions; frozen contract is downstream authority. | Allow taste engine or downstream tools to re-derive tokens post-freeze. | Recommended default prevents competing design authorities from altering approved pages during porting. | `OWNER_DECISION_REQUIRED` |
| **DB-DEC03** | **Strict Canvas Approval Protocol**: Canvas verdict event `{"kind":"verdict","verdict":"approve"}` tied to exact revision is sole approval; chat "ok" rejected. | Allow chat-based text approvals or terminal confirmations. | Recommended default ensures unambiguous, audit-trailed human sign-off bound to immutable file bytes. | `OWNER_DECISION_REQUIRED` |
| **DB-DEC04** | **Web Reuse & Native Equivalence**: Web ports reuse approved markup/CSS; native targets achieve visual equivalence via explicit mapping (no webviews). | Require 100% pixel-identical rendering or compile CSS to native widgets. | Recommended default respects platform idioms and accessibility while maintaining high visual fidelity. | `OWNER_DECISION_REQUIRED` |
| **DB-DEC05** | **No Global Similarity Score**: Categorical property checks plus named geometric tolerances per profile; no AI percentage scores. | Use global 95% image diff or AI evaluator score. | Recommended default eliminates "9.95/10 against wrong reference" loopholes and focuses on actual geometry/tokens. | `OWNER_DECISION_REQUIRED` |
| **DB-DEC06** | **Cap Section Repairs at 2 Cycles**: Maximum 2 auto-repair cycles per revision; third failure halts and escalates to owner. | Unbounded auto-repair loops or immediate failure after 1 attempt. | Recommended default balances autonomous correction with runaway token/context prevention. | `OWNER_DECISION_REQUIRED` |
| **DB-DEC07** | **Cooperative Section Gating**: Acknowledge that host plugin enforcement is unverified; enforce gating cooperatively in canonical workflow. | Block project until mandatory OpenCode C++ plugin sandbox is developed. | Recommended default allows immediate, practical productivity while honestly reporting enforcement limits. | `OWNER_DECISION_REQUIRED` |
| **DB-DEC08** | **Canonical Repo Source & Staged Distribution**: Repo `skills/` is single canonical source; HOME/global distribution requires separate approval. | Directly edit active global `~/.claude` and `~/.opencode` skills. | Recommended default protects active user environments from unreviewed breaking changes. | `OWNER_DECISION_REQUIRED` |
| **DB-DEC09** | **Optional Harden Without Redesign**: `--harden` is opt-in with stated budget; cannot alter approved composition or visual direction. | Allow GAN harness to freely optimize layout and color post-approval. | Recommended default keeps the human owner as the sole creative authority; GAN refines craft only. | `OWNER_DECISION_REQUIRED` |
| **DB-DEC10** | **Pilot Sequencing & Support Matrix**: Pilot React and Astro first; evaluate Vue, Svelte, Flutter, and Compose based on available toolchains. | Delay all releases until all 6 frameworks have verified live emulator pilots. | Recommended default delivers immediate web value without making unsupported claims about native. | `OWNER_DECISION_REQUIRED` |
| **DB-DEC11** | **Preserve Command Signature**: Maintain existing `/design-build` CLI arguments (`--resume`, `--section`, `--harden`) and `/typography` compatibility. | Redesign command arguments or introduce separate `/design-build-native`. | Recommended default ensures complete backwards compatibility for existing users and scripts. | `OWNER_DECISION_REQUIRED` |
| **DB-DEC12** | **Staged Rollout & Backup Rehearsal**: Candidate distribution staged; persistent backup created; rollback rehearsed before active deployment. | In-place live overwrites without rollback rehearsal. | Recommended default guarantees recovery and zero downtime or data loss for existing ECC installs. | `OWNER_DECISION_REQUIRED` |

---

## Status Contract (§14)

Upon completion of the implementation phases, the review package must derive literal values for the following 28 status variables from actual execution evidence (never filled with `PASS` by default):

```text
CANONICAL_DESIGN_BUILD_RESOLUTION=STATIC_VERIFIED
DESIGN_AUTHORITY_RECONCILED=
PROJECT_SPECIFIC_CONTRACT=
TYPOGRAPHY_DESIGN_VERIFY_AMEND=
SCAFFOLD_CONTRACT_COMPLIANCE=
APPROVED_BUNDLE_BINDING=
CANVAS_VERDICT_REVISION_BINDING=
SECTION_COMPLETION_GATE=
RESUME_AND_INVALIDATION=
WEB_ADAPTER_REACT=
WEB_ADAPTER_VUE=
WEB_ADAPTER_SVELTE=
WEB_ADAPTER_ASTRO=
NATIVE_ADAPTER_FLUTTER=
NATIVE_ADAPTER_COMPOSE=
VISUAL_PARITY_MEASURED=
STATE_INTERACTION_PARITY=
REFERENCE_IMMUTABILITY=
REAL_PROJECT_PILOT_NEXVORA=
REAL_PROJECT_PILOT_RLOGIC=
ACTUAL_RUNTIME_SMOKE=
HOST_ENFORCEMENT=COOPERATIVE_NOT_MANDATORY
FINAL_ASSEMBLED_GATE=
PROTECTED_WORKFLOWS_MODIFIED=NO (verified)
GUARDIAN_ANGEL_MODIFIED=NO (verified)
CURRENT_CANDIDATE_ROLLBACK=
OWNER_DEPLOYMENT_AUTHORIZATION=NOT_GIVEN (until explicitly granted by owner)
ACTIVE_RUNTIME_DEPLOYED=NO (until authorized and executed)
RELEASE_READINESS=
```

---

## Success Criteria

Every Ideal State guarantee and all 26 Acceptance Criteria (DB-AC01–DB-AC26) are linked to their verification proof and executable QA commands:

| Ideal State / Acceptance Row | Proven By | QA Evidence / Command |
|---|---|---|
| **IS-1 (Visual Fidelity)** | P-WEB1 (Rlogic) and P-WEB2 (Nexvora) pilots; probe R04. Covers DB-AC13, DB-AC17. | `node --test tests/design-build-v2-probes.test.js --test-name-pattern="R04"` confirms 0px padding drift and visible warehouse label. |
| **IS-2 (Lifecycle Authority)** | Probes R10, R15; `SKILL.md` authority protocol. Covers DB-AC02, DB-AC22. | `node --test tests/design-build-v2-probes.test.js --test-name-pattern="R10|R15"` confirms post-freeze redesign attempts are blocked. |
| **IS-3 (Project Tokens)** | Probes R01, R02; `standards.md` & scaffold audit. Covers DB-AC03, DB-AC04. | `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="custom radius 20px declared"` confirms 20px radius and 6px gaps pass when declared. |
| **IS-4 (Framework Adapters)** | `adapter-react.md`, `adapter-astro.md`, etc.; pilot ports. Covers DB-AC13, DB-AC14, DB-AC15. | `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="adapter-"` confirms DOM landmarks and semantic token mapping across targets. |
| **IS-5 (Completion Gate)** | Probe R08; State machine tests. Covers DB-AC08, DB-AC10, DB-AC16, DB-AC18, DB-AC19. | `node --test tests/design-build-v2-probes.test.js --test-name-pattern="R08"` asserts setting `sectionApproved: true` without G0–G3 receipt fails to advance `current`. |
| **IS-6 (Bounded Repair)** | Probe R09; P-WEB1 deliberate drift repair. Covers DB-AC11, DB-AC20. | `node --test tests/design-build-v2-invariants.test.js --test-name-pattern="step 8 repair limit exceeded"` asserts 3rd failure halts and logs blocker. |
| **IS-7 (Resumability & Hash Integrity)** | Probe R06; Session crash and compaction resume tests. Covers DB-AC01, DB-AC07, DB-AC09, DB-AC12, DB-AC21, DB-AC23, DB-AC24, DB-AC25, DB-AC26. | `node --test tests/design-build-v2-probes.test.js --test-name-pattern="R06"` asserts modified canvas HTML/CSS causes resume command to report `BUNDLE_INVALIDATED`. |
