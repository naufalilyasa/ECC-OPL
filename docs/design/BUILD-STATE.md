# Design Build State (V2.0) — P-WEB1 rendered vertical slice

- Fixture: `tests/fixtures/p-web1-rlogic/` (synthetic disposable stand-in, no private code).
- Approved canvas: `00-topbar.html`. Full-bundle identity (HTML + CSS/contracts/assets/
  capture/state fixtures) sealed in `active.json.approvedBundleSha256`.
- Renderer: no React runtime installed and no deps fetched. The JSX stand-in is rendered
  as SSR-equivalent static DOM (`jsx-to-html.mjs`), then measured in a **real browser** via
  Playwright + local Chromium (`scripts/design-build-v2/render-parity.mjs`).
- Browser evidence: `docs/design/evidence/p-web1/rendered-parity.json` + paired PNGs.
  Profile matched: 390x844, DPR 1, dark, en-US, reduced-motion, fonts ready.

## Demonstrated sequence (actual browser)
1. Approved canvas rendered and measured (computed styles, bounding boxes, visibility,
   typography). Screenshot `00-topbar-approved.png`.
2. Exact bundle identity verified (`verifyBundleSeal` over full bundle).
3. Ported DOM rendered at the same profile — `repaired` screenshot hash == approved.
4. Intentional drift A: parent `display:none` → browser `PARITY_FAIL` (visibility false).
5. Intentional drift B: inline `padding-top:32px` → browser `PARITY_FAIL` (delta 16px).
6. Repair applied to framework DOM only; approved canvas bytes unchanged.
7. Re-render → browser `PARITY_PASS`, screenshot byte-identical to approved.
8. Verified receipt (`00-topbar-receipt.json`) advances checkpoint to `SECTION_COMPLETE`;
   `CANVAS_APPROVED` never advances `current` on its own.

Source-level regex is now a triage hint only (`SOURCE_LEVEL_HINT`) and cannot grant G2.

## Boundaries
- Enforcement: `COOPERATIVE_NOT_MANDATORY`; no host plugin assumed under OpenCode.
- Runtime resolution: `STATIC_VERIFIED`. Native Flutter/Compose: `SPECIFIED`, toolchain `NOT_RUN`.
- Fidelity claim: mechanism proven on a disposable fixture only — NOT a real-project claim.
- Deployment authorization: `NOT_GIVEN`. Active HOME / Guardian / protected workflows untouched.
