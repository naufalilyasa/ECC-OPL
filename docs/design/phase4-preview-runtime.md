# Phase 4 evidence — preview runtime coordination (DBN-04)

Date: 2026-11-27 · Plan: `docs/plans/framework-native-design-build.plan.md` (Phase 4)

## What was added

`scripts/design-build-v2/preview-runtime.mjs` (module, ~140 lines):

| Export | Behaviour |
|--------|-----------|
| `probe(url)` | Single HTTP GET; any status below 500 counts as ready. Returns the real failure code (`ECONNREFUSED`, `AbortError`, …) instead of a generic "unreachable". |
| `waitForReady(urls)` | Polls until **every** URL answers or the deadline passes; returns `PREVIEW_NOT_READY` plus the failing URL(s). |
| `createOwnershipRegistry()` | Tracks PIDs the workflow started. `stop()` refuses a foreign PID (`NOT_OWNED`); `cleanup()` stops only owned PIDs and keeps retryable failures tracked. |
| `ensurePreviewServer({urls, command, cwd})` | Reuses an already-serving URL, otherwise spawns detached (so one PID covers `npm run dev`'s whole group), tracks the PID, waits for readiness, and on failure kills what it started while returning the process's real stderr. |

`scripts/design-build-v2/detect-project.mjs` now also returns `previewServers`:

- `laravel-inertia-*`: `[{ id: 'laravel', command: 'php artisan serve' }, { id: 'vite', command: '<pm> run dev' }]`
- single-server stacks: `[{ id: 'app', command: devCommand }]`
- `standalone-html`: `[]`

## Verification

```
node tests/lib/design-build-preview-runtime.test.js   → 12 passed, 0 failed
node tests/lib/design-build-project-discovery.test.js → 9 passed, 0 failed
```

The suite covers: live/closed/5xx probes, a server that starts late, dual-server
Laravel shape with the missing URL named, refusal to stop a foreign PID, cleanup
that only touches owned PIDs, reuse-without-spawn (including a server slower than
the old 500 ms poll), a real spawned process that is tracked and then actually
gone after cleanup, a chatty server that writes 1 MB to stdout before answering,
and a failing command whose stderr (`Cannot find module @vitejs/plugin-react`) is
reported with nothing left tracked.

## Review fixes applied

- stdout is no longer piped: `php artisan serve` logs every request there, and an
  unconsumed pipe blocks the server once the ~64 KB buffer fills.
- `PREVIEW_TRACK_FAILED` now kills the child it spawned instead of leaking it.
- Reuse pre-check is one probe round, not a 500 ms poll, so a live-but-warming
  server is not double-spawned on the same port.
- `cleanup()` uses a local `stop` closure instead of `this`.
- `stop`/`cleanup` collapsed to one branch; a process already gone is not reported
  as a failure.

## Phase 2 slice re-validated through the helper

The disposable React+Vite+TS pilot (`$TMPDIR/opencode/design-build-pilot-react`),
driven only through `ensurePreviewServer`:

```
{"started":true,"reused":false,"pid":79893}
page 200 449 bytes
cleanup {"killed":[{"command":"npm run dev -- --port 5199 --strictPort --host 127.0.0.1",...,"pid":79893}],"skipped":[]}
after {"ready":false,"url":"http://127.0.0.1:5199/","reason":"ECONNREFUSED"}
```

## Findings

- **Bind-address mismatch is a real failure mode.** Vite defaults to `localhost`,
  which resolved to `::1` on this machine, so a probe against `127.0.0.1` failed
  even though a server was running. The helper reported `PREVIEW_START_FAILED`
  rather than a false ready — the workflow must pass an explicit `--host` that
  matches the URL it probes. Recorded in the module header.
- Process-group kill needed `detached: true` plus `process.kill(-pid)`;
  `SIGTERM` to the shell alone left Vite alive. Verified by re-probing after cleanup.

## Status

- Readiness, ownership, cleanup, dual-server readiness: **VERIFIED** by tests.
- Real Laravel coordination (`php artisan serve` + Vite against a live app):
  **UNVERIFIED** until Pilot B runs it.
- Preview runtime is not yet wired into `section-gate.mjs`/`SKILL.md`; that is
  Phase 6 work, so no workflow path is claimed to use it yet.
