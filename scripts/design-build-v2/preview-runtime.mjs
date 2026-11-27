#!/usr/bin/env node
// Preview runtime coordination (DBN-04). Not a process supervisor: probe
// readiness, start a dedicated process only when nothing is serving, remember
// which PIDs THIS workflow started, and stop only those. fetch/spawn/kill are
// injectable so the stubs in tests exercise the real control flow.
// The URL you probe must be the address the server actually binds: Vite defaults
// to `localhost`, which can resolve to ::1, so pass an explicit host.
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

// Any answer below 5xx proves the server accepts requests; a 404 still means
// the process is up and routing, which is what readiness needs.
const READY_STATUS_LIMIT = 500
const STDERR_TAIL = 2000

export async function probe(url, { fetchImpl = fetch, timeoutMs = 2000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, { signal: controller.signal, redirect: 'manual' })
    if (res.status < READY_STATUS_LIMIT) return { ready: true, url, status: res.status }
    return { ready: false, url, status: res.status, reason: `HTTP ${res.status}` }
  } catch (error) {
    // Report the real failure (connection refused, TLS, timeout) rather than a
    // generic "unreachable": the owner needs it in the completion report.
    const reason = error?.cause?.code ?? error?.code ?? error?.name ?? 'FETCH_FAILED'
    return { ready: false, url, reason }
  } finally {
    clearTimeout(timer)
  }
}

// Readiness requires EVERY url: Laravel+Inertia serves PHP pages and Vite
// assets as two processes, and a page that renders without its assets is not a
// preview the owner can approve.
export async function waitForReady(urls, {
  timeoutMs = 30000, intervalMs = 250, fetchImpl = fetch, sleepImpl = sleep,
} = {}) {
  if (!Array.isArray(urls) || !urls.length) {
    return { ready: false, code: 'PREVIEW_NOT_READY', why: 'NO_TARGETS', failures: [] }
  }
  const deadline = Date.now() + timeoutMs
  let failures = []
  for (;;) {
    failures = []
    for (const url of urls) {
      const result = await probe(url, { fetchImpl })
      if (!result.ready) failures.push({ url, reason: result.reason ?? `HTTP ${result.status}` })
    }
    if (!failures.length) return { ready: true, urls }
    if (Date.now() >= deadline) break
    await sleepImpl(intervalMs)
  }
  return { ready: false, code: 'PREVIEW_NOT_READY', failures }
}

export function createOwnershipRegistry() {
  const owned = new Map()
  // Servers are spawned detached so one PID covers its whole process group
  // (`npm run dev` is a shell plus a real server). Only owned PIDs ever reach
  // this function.
  const defaultKill = (pid) => {
    if (process.platform !== 'win32') {
      try { process.kill(-pid, 'SIGTERM'); return } catch (error) { if (error.code === 'EPERM') throw error }
    }
    process.kill(pid, 'SIGTERM')
  }
  return {
    track(pid, meta = {}) {
      if (!Number.isInteger(pid) || pid <= 0) return false
      owned.set(pid, { ...meta, pid })
      return true
    },
    owns(pid) { return owned.has(pid) },
    release(pid) { return owned.delete(pid) },
    entries() { return [...owned.values()] },
    // Refuses anything it did not start: a dev server the owner already had
    // running must survive the workflow.
    stop(pid, { killImpl = defaultKill } = {}) {
      if (!owned.has(pid)) return { code: 'NOT_OWNED', pid }
      const meta = owned.get(pid)
      try {
        killImpl(pid)
        owned.delete(pid)
        return { code: 'STOPPED', pid, meta }
      } catch (error) {
        // ESRCH means the process is already gone: the intent is satisfied.
        if (error?.code === 'ESRCH') {
          owned.delete(pid)
          return { code: 'ALREADY_GONE', pid, meta }
        }
        return { code: 'STOP_FAILED', pid, reason: error?.code ?? 'KILL_FAILED' }
      }
    },
    cleanup(options = {}) {
      const killed = []
      const skipped = []
      for (const pid of [...owned.keys()]) {
        const result = this.stop(pid, options)
        if (result.code === 'STOPPED' || result.code === 'ALREADY_GONE') {
          if (result.code === 'STOPPED') killed.push(result.meta)
        } else skipped.push({ pid, reason: result.reason ?? result.code })
      }
      return { killed, skipped }
    },
  }
}

// Start only if nothing is already serving. A process this function starts is
// tracked from the first moment its PID exists, so a failed readiness probe
// cannot leak it.
export async function ensurePreviewServer({
  url, urls, command, cwd, env, registry,
  spawnImpl = spawn, timeoutMs = 60000, intervalMs = 250,
  fetchImpl = fetch, sleepImpl = sleep,
} = {}) {
  const targets = urls ?? (url ? [url] : [])
  if (!targets.length) return { code: 'PREVIEW_NO_TARGET' }
  if (!command) return { code: 'PREVIEW_NO_COMMAND' }
  if (!registry) return { code: 'PREVIEW_NO_REGISTRY' }

  const already = await waitForReady(targets, { timeoutMs: 500, intervalMs: 100, fetchImpl, sleepImpl })
  if (already.ready) return { started: false, reused: true, pid: null, urls: targets }

  let child
  try {
    child = spawnImpl(command, {
      cwd, env, shell: true, stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    })
  } catch (error) {
    return { code: 'PREVIEW_START_FAILED', command, reason: error?.code ?? 'SPAWN_FAILED' }
  }

  let stderr = ''
  child.stderr?.on?.('data', (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-STDERR_TAIL)
  })

  let spawnError = null
  child.on?.('error', (error) => { spawnError = error?.code ?? 'SPAWN_FAILED' })
  child.on?.('exit', (code) => { if (code) spawnError = `EXIT_${code}` })

  if (!registry?.track(child.pid, { command, urls: targets })) {
    return { code: 'PREVIEW_TRACK_FAILED', pid: child.pid, reason: 'INVALID_PID' }
  }

  const ready = await waitForReady(targets, { timeoutMs, intervalMs, fetchImpl, sleepImpl })
  if (ready.ready) return { started: true, reused: false, pid: child.pid, urls: targets }

  const stopped = registry?.stop(child.pid)
  return {
    code: 'PREVIEW_START_FAILED',
    started: true,
    pid: child.pid,
    command,
    reason: spawnError ?? 'READINESS_TIMEOUT',
    stderr: stderr.trim().slice(-STDERR_TAIL),
    failures: ready.failures,
    stopped: stopped?.code === 'STOPPED' || stopped?.code === 'ALREADY_GONE',
  }
}

function main() {
  process.stderr.write('preview-runtime.mjs is a module: import probe/waitForReady/ensurePreviewServer\n')
  process.exit(2)
}

if (process.argv[1] && process.argv[1].endsWith('preview-runtime.mjs')) main()
