# P-WEB1 fixture (synthetic, disposable)

This directory is a **synthetic stand-in** and a **disposable** testbed for the
historical Rlogic WMS mobile-header snapshot. It exists so milestone M1 has an
exact, reproducible on-disk target without depending on audit-ZIP descriptions.

- No private/proprietary production code is copied here.
- `00-topbar.html` — approved-canvas stand-in (reference).
- `AppLayout.tsx` — React/Inertia component candidate (warehouse badge `▦ WH-01`,
  16px top padding) used for the deliberate negative-drift + bounded-repair repro.
- `capture-config.json` — capture profile (390×844, 360×800, dark, DPR=1).
- `active.json` — initialized section checkpoint.

Any fidelity result obtained from this fixture proves the *mechanism* only; it is
not a claim of real-project visual parity.
