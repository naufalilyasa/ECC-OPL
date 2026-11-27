# Phase 2 — native preview slice (Canvas ↔ project dev server)

Recorded 2026-11-27. Plan: `docs/plans/framework-native-design-build.plan.md` §Phase 2.

## What was proven

One real React + Vite + TypeScript component, written as project-native TSX, is
served by the project's own dev server and shown inside Plan Canvas with a mode
chip, while legacy HTML artifacts keep their old path byte-for-byte.

Pilot app (disposable, outside this repo):
`$TMPDIR/opencode/design-build-pilot-react` — `src/sections/01-app-shell.tsx`
(fixture data, no design-system dependency), Vite dev server on `:5199`.

```bash
# pilot
npm run dev                       # vite --port 5199 --strictPort

# canvas (isolated port + state dir so the owner's canvas is untouched)
ECC_PLAN_CANVAS_PORT=4519 \
ECC_PLAN_CANVAS_STATE_DIR=<pilot>/.canvas \
node scripts/plan-canvas.js open \
  <pilot>/src/sections/01-app-shell.tsx \
  --preview-url http://localhost:5199/ \
  --section 01-app-shell --revision r1 --no-open
```

## Evidence

| Check | Result | Evidence |
|---|---|---|
| Wrapper route returns the dev-server frame | VERIFIED | `GET /artifact/<key>/` → 200, `content-security-policy: default-src 'none'; style-src 'unsafe-inline'; frame-src http://localhost:5199` |
| Live component renders in the canvas | VERIFIED | `docs/design/evidence/phase2-native-canvas.png`; a11y tree contains the pilot's headings and rows inside `iframe > iframe` |
| Mode chip + open-separately | VERIFIED | chip reads `framework-native · 01-app-shell · r1`; both link to `http://localhost:5199/` |
| Browser feedback reaches the session | VERIFIED | typed in the composer → `sessions.json` `pendingFeedback[0] = {kind:"chat", text:"Phase 2 slice check…"}` (`docs/design/evidence/phase2-feedback.png`) |
| Legacy artifact session unchanged | VERIFIED | `tests/plan-canvas-preview-mode` case "legacy artifact route still serves the file itself"; `tests/scripts/plan-canvas.test.js` 96/96 |
| In-frame click-to-annotate | **NOT_SUPPORTED** | clicking a heading inside the live frame with annotate on queued nothing. The annotation SDK is injected into artifact HTML by `serveArtifact`; in native mode the document is the project's own page, and the nested frame is cross-origin, so the canvas cannot observe its clicks. Feedback in native mode is chat + verdict. |
| Verdict click in native mode | UNVERIFIED | not exercised in this slice; the verdict path is unchanged legacy code covered by `tests/lib/plan-canvas-sessions.test.js` |

## Finding that changed the implementation

The canvas artifact iframe is sandboxed `allow-scripts allow-forms allow-popups`.
Sandbox flags are **inherited by nested frames**, so the wrapper document got an
opaque origin and the dev server's module requests were rejected
(`Access to script at http://localhost:5199/@vite/client from origin 'null' has
been blocked by CORS policy`). The frame stayed blank.

Fix: `ui.js` grants `allow-same-origin` **only** when `previewMode ===
'framework-native'`, i.e. only to our own generated wrapper — never to a raw
artifact. The nested frame is still a different origin, so it stays isolated from
the canvas.

## Consequence to decide later (not in this phase)

Click-to-annotate is the one HTML-era capability native mode loses. Restoring it
would require injecting the canvas SDK into the project's own page (a Vite
plugin or a dev-only entry), which is a project modification — out of scope
under DBN-01/03 and not done here.
