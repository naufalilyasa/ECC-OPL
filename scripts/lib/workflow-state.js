/**
 * Multi-runtime workflow state utility for ECC-OPL.
 *
 * Provides isolated state tracking, concurrency locks, and clobber guards
 * across Antigravity CLI and OpenCode runtimes.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_TTL_SECONDS = 43200; // 12 hours
const DEFAULT_LOCK_TIMEOUT_MS = 5000;
const STALE_LOCK_TIMEOUT_MS = 30000; // 30 seconds
const LOCK_WRITE_GRACE_MS = 1000; // window for openSync('wx') -> writeSync payload

const ERRORS = Object.freeze({
  E_LOCK_CONTENTION: 'E_LOCK_CONTENTION',
  E_CROSS_RUNTIME_CLOBBER: 'E_CROSS_RUNTIME_CLOBBER',
  E_CROSS_WORKTREE_CLOBBER: 'E_CROSS_WORKTREE_CLOBBER',
  E_CROSS_CONVERSATION_CLOBBER: 'E_CROSS_CONVERSATION_CLOBBER',
  E_INVALID_STATE: 'E_INVALID_STATE',
});

function createWorkflowError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * Resolves the path to active.json based on projectRoot and target.
 */
function resolveWorkflowStatePath({ projectRoot = process.cwd(), target = 'antigravity-cli', customPath } = {}) {
  if (customPath) {
    return path.resolve(projectRoot, customPath);
  }
  if (target === 'opencode') {
    return path.join(projectRoot, '.opencode', 'workflows', 'active.json');
  }
  // Default to Antigravity CLI isolated namespace
  return path.join(projectRoot, '.agents', 'ecc-opl', 'workflows', 'active.json');
}

/**
 * Returns the corresponding lockfile path for an active.json path.
 */
function resolveWorkflowLockPath(statePath) {
  return `${statePath}.lock`;
}

/**
 * Checks whether a process is alive.
 */
function isProcessAlive(pid) {
  if (!pid || typeof pid !== 'number') return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM'; // Exists but no permission to signal
  }
}

/**
 * Acquires an exclusive file lock on lockPath.
 */
function acquireWorkflowLock(lockPath, { lockTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS, staleTimeoutMs = STALE_LOCK_TIMEOUT_MS } = {}) {
  const lockDir = path.dirname(lockPath);
  fs.mkdirSync(lockDir, { recursive: true });

  const startTime = Date.now();

  while (true) {
    try {
      // 'wx' flag fails if file exists
      const fd = fs.openSync(lockPath, 'wx');
      try {
        const lockPayload = JSON.stringify({
          pid: process.pid,
          createdAt: Date.now(),
        });
        fs.writeSync(fd, lockPayload);
      } finally {
        fs.closeSync(fd);
      }
      return; // Lock successfully acquired
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }

      // Lockfile exists, inspect if stale
      try {
        const raw = fs.readFileSync(lockPath, 'utf8');
        const lockData = JSON.parse(raw);
        const age = Date.now() - (lockData.createdAt || 0);

        const isStale = age > staleTimeoutMs || !isProcessAlive(lockData.pid);
        if (isStale) {
          try {
            fs.unlinkSync(lockPath);
            continue; // Retry acquisition immediately
          } catch {
            // Another worker might have unlinked or recreated it
          }
        }
      } catch {
        // Corrupt/empty lockfile: may be mid-write by another process between
        // openSync('wx') and writeSync. Only reclaim if older than the grace
        // window, otherwise treating it as stale would unlink a live lock and
        // let two workers hold it at once (TOCTOU race).
        try {
          const stat = fs.statSync(lockPath);
          if (Date.now() - stat.mtimeMs > LOCK_WRITE_GRACE_MS) {
            fs.unlinkSync(lockPath);
            continue;
          }
        } catch {
          // Already removed by another worker; retry.
        }
      }

      if (Date.now() - startTime >= lockTimeoutMs) {
        throw createWorkflowError(
          ERRORS.E_LOCK_CONTENTION,
          `Workflow state lock contention at ${lockPath} (timed out after ${lockTimeoutMs}ms)`
        );
      }

      // Sleep without pegging a CPU core during contention. Atomics.wait is
      // available synchronously in Node's main thread.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
}

/**
 * Releases the lockfile.
 */
function releaseWorkflowLock(lockPath) {
  try {
    const raw = fs.readFileSync(lockPath, 'utf8');
    const lockData = JSON.parse(raw);
    // Only unlink a lock we own. If another process reclaimed it as stale and
    // replaced it, deleting it here would clobber that process's active lock.
    if (lockData && lockData.pid === process.pid) {
      fs.unlinkSync(lockPath);
    }
  } catch {
    // Missing or unreadable lockfile: nothing to release.
  }
}

/**
 * Whether a state object is past its TTL.
 */
function isStateExpired(state, statePath) {
  const ttlSeconds = typeof state.ttl === 'number' ? state.ttl : DEFAULT_TTL_SECONDS;
  const updatedAtTime = state.updatedAt ? new Date(state.updatedAt).getTime() : 0;
  const timestampTime = state.timestamp ? new Date(state.timestamp).getTime() : 0;
  let mtimeMs = 0;
  if (statePath && fs.existsSync(statePath)) {
    mtimeMs = fs.statSync(statePath).mtimeMs;
  }
  const baseTime = updatedAtTime || timestampTime || mtimeMs;
  return (Date.now() - baseTime) > ttlSeconds * 1000;
}

/**
 * Reads workflow state.
 */
function readWorkflowState({ projectRoot, target, customPath, includeExpired = false } = {}) {
  const statePath = resolveWorkflowStatePath({ projectRoot, target, customPath });
  if (!fs.existsSync(statePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(statePath, 'utf8');
    const state = JSON.parse(raw);
    const isExpired = isStateExpired(state, statePath);

    if (isExpired) {
      if (includeExpired) {
        return { ...state, isExpired: true };
      }
      return null;
    }

    return state;
  } catch {
    return null;
  }
}

/**
 * Writes workflow state with concurrency lock and clobber guards.
 */
function writeWorkflowState({
  projectRoot = process.cwd(),
  target = 'antigravity-cli',
  customPath,
  state,
  lockTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS,
  handoff = false,
  force = false,
  skipLock = false,
} = {}) {
  if (!state || typeof state !== 'object') {
    throw createWorkflowError(ERRORS.E_INVALID_STATE, 'State must be an object');
  }

  const statePath = resolveWorkflowStatePath({ projectRoot, target, customPath });
  const lockPath = resolveWorkflowLockPath(statePath);

  if (!skipLock) {
    acquireWorkflowLock(lockPath, { lockTimeoutMs });
  }

  try {
    // Check existing state for clobber guards
    if (fs.existsSync(statePath) && !force && !handoff) {
      try {
        const rawExisting = fs.readFileSync(statePath, 'utf8');
        const existing = JSON.parse(rawExisting);

        // A completed or expired state must not permanently block other
        // runtimes/worktrees; only active state warrants a handoff guard.
        const existingIsTerminal = existing.phase === 'done' || isStateExpired(existing, statePath);

        // Guard 1: Cross-runtime clobbering (active state only)
        if (!existingIsTerminal && existing.target && existing.target !== target) {
          throw createWorkflowError(
            ERRORS.E_CROSS_RUNTIME_CLOBBER,
            `Existing workflow state belongs to runtime "${existing.target}". Explicit handoff required to switch to "${target}".`
          );
        }

        // Guard 2: Cross-worktree clobbering (active state only). An untagged
        // incoming write must not silently clobber an active worktree's state.
        if (
          !existingIsTerminal &&
          existing.worktreeId &&
          existing.worktreeId !== state.worktreeId
        ) {
          throw createWorkflowError(
            ERRORS.E_CROSS_WORKTREE_CLOBBER,
            `Existing workflow state belongs to worktree "${existing.worktreeId}". Explicit handoff required to switch to "${state.worktreeId}".`
          );
        }

        // Guard 3: Cross-conversation clobbering (active state only). Two
        // conversations in the same worktree share one state file; the one
        // that did not open the workflow must not overwrite it.
        if (
          !existingIsTerminal &&
          existing.conversationId &&
          state.conversationId &&
          existing.conversationId !== state.conversationId
        ) {
          throw createWorkflowError(
            ERRORS.E_CROSS_CONVERSATION_CLOBBER,
            `Existing workflow state belongs to conversation "${existing.conversationId}". Explicit handoff required to switch to "${state.conversationId}".`
          );
        }
      } catch (err) {
        if (
          err.code === ERRORS.E_CROSS_RUNTIME_CLOBBER
          || err.code === ERRORS.E_CROSS_WORKTREE_CLOBBER
          || err.code === ERRORS.E_CROSS_CONVERSATION_CLOBBER
        ) {
          throw err;
        }
        // If file was corrupt, allow overwrite
      }
    }

    const nowIso = new Date().toISOString();
    const payload = {
      ...state,
      target,
      projectRoot,
      updatedAt: state.updatedAt || nowIso,
      timestamp: state.timestamp || nowIso,
      ttl: typeof state.ttl === 'number' ? state.ttl : DEFAULT_TTL_SECONDS,
    };

    const targetDir = path.dirname(statePath);
    fs.mkdirSync(targetDir, { recursive: true });

    // Atomic write via tmp file rename
    const tmpPath = `${statePath}.tmp.${process.pid}.${Date.now()}`;
    fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
    fs.renameSync(tmpPath, statePath);

    return payload;
  } finally {
    if (!skipLock) {
      releaseWorkflowLock(lockPath);
    }
  }
}

/**
 * Updates partial fields in workflow state. The read-merge-write sequence is
 * performed under a single lock so two concurrent updates cannot clobber each
 * other (read-modify-write race).
 */
function updateWorkflowState({
  projectRoot = process.cwd(),
  target = 'antigravity-cli',
  customPath,
  updates,
  lockTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS,
  handoff = false,
  force = false,
} = {}) {
  const statePath = resolveWorkflowStatePath({ projectRoot, target, customPath });
  const lockPath = resolveWorkflowLockPath(statePath);

  acquireWorkflowLock(lockPath, { lockTimeoutMs });

  try {
    const current = readWorkflowState({ projectRoot, target, customPath, includeExpired: true }) || {};
    const merged = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    return writeWorkflowState({
      projectRoot,
      target,
      customPath,
      state: merged,
      lockTimeoutMs,
      handoff,
      force,
      skipLock: true, // lock already held by this read-merge-write
    });
  } finally {
    releaseWorkflowLock(lockPath);
  }
}

/**
 * Clears or deactivates workflow state.
 */
function clearWorkflowState({ projectRoot, target, customPath, archive = false } = {}) {
  const statePath = resolveWorkflowStatePath({ projectRoot, target, customPath });
  if (!fs.existsSync(statePath)) {
    return;
  }

  if (archive) {
    updateWorkflowState({
      projectRoot,
      target,
      customPath,
      updates: { phase: 'done', current: -1 },
    });
  } else {
    const lockPath = resolveWorkflowLockPath(statePath);
    acquireWorkflowLock(lockPath);
    try {
      const current = readWorkflowState({ projectRoot, target, customPath, includeExpired: true }) || {};
      const payload = {
        ...current,
        phase: 'done',
        updatedAt: new Date().toISOString(),
      };
      const tmpPath = `${statePath}.tmp.${process.pid}.${Date.now()}`;
      fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
      fs.renameSync(tmpPath, statePath);
    } finally {
      releaseWorkflowLock(lockPath);
    }
  }
}

/**
 * Determines whether a workflow is currently active (exists, not expired, phase !== 'done').
 */
function isWorkflowActive({ projectRoot, target, customPath } = {}) {
  const state = readWorkflowState({ projectRoot, target, customPath, includeExpired: false });
  if (!state) return false;
  return state.phase !== 'done';
}

module.exports = {
  resolveWorkflowStatePath,
  resolveWorkflowLockPath,
  acquireWorkflowLock,
  releaseWorkflowLock,
  readWorkflowState,
  writeWorkflowState,
  updateWorkflowState,
  clearWorkflowState,
  isWorkflowActive,
  DEFAULT_TTL_SECONDS,
  ERRORS,
};
