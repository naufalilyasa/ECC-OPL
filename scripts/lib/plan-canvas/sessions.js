'use strict';

/**
 * Plan Canvas session store.
 *
 * Sessions are keyed by the canonical artifact file path so agents never
 * juggle opaque ids. State is persisted as JSON in the Plan Canvas state
 * dir so queued human feedback survives a server restart.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  MAX_PROMPT_CHARS,
  computePlanDigest,
  validateBoundVerdict
} = require('./verdict-binding');

// Anchor locators come from the browser, not the human. Truncating one keeps
// the commentary usable; rejecting it would discard what the user typed.
// Free-form prompt text is the operator's actual message, so the ceiling is
// generous for every session: a long review brief is legitimate input, and a
// silent truncation would lose the instruction the agent is meant to follow.
const DEFAULT_MAX_TEXT_CHARS = 100000;

const FEEDBACK_KINDS = new Set(['chat', 'annotation', 'verdict']);
const VERDICTS = new Set(['approve', 'request-changes']);
const PREVIEW_MODES = new Set(['framework-native', 'standalone-html']);

// A preview URL comes from the agent, and the canvas will embed it. Only an
// absolute http(s) URL is accepted: anything else (data:, javascript:, file:)
// would be a way to smuggle content past the artifact CSP. Credentials are
// dropped because the URL is rendered as visible text as well as used as a
// frame src.
function sanitizePreviewUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.username = '';
    url.password = '';
    return url.href;
  } catch {
    return null;
  }
}

// Only the two labels the canvas actually renders. Anything else a caller
// sends is dropped so a large object cannot bloat the session file that every
// broadcast re-reads.
function sanitizePreviewMeta(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const meta = {};
  for (const field of ['section', 'revision']) {
    const text = value[field];
    if (typeof text === 'string' && text.length > 0) meta[field] = text.slice(0, 120);
  }
  // Phase 5: the preview is stamped with the revision it shows, so a verdict
  // can be matched against the exact reference the owner reviewed.
  if (typeof value.revisionDigest === 'string' && /^[0-9a-f]{64}$/.test(value.revisionDigest)) {
    meta.revisionDigest = value.revisionDigest;
  }
  if (value.dataMode === 'fixture' || value.dataMode === 'production') {
    meta.dataMode = value.dataMode;
  }
  return Object.keys(meta).length > 0 ? meta : null;
}

// The producer and the SessionStart/Stop hooks must land on one directory. The
// hooks resolve CLAUDE_CONFIG_DIR (they cannot require this file: managed
// installs ship scripts/ without scripts/lib/, see #3259), so writing to
// ~/.claude here regardless would hide queued feedback from them whenever a
// session runs under a second profile.
function resolveClaudeConfigDir(env = process.env) {
  const configured = env.CLAUDE_CONFIG_DIR;
  const trimmed = configured ? String(configured).trim() : '';
  if (!trimmed) return path.join(os.homedir(), '.claude');
  if (trimmed.startsWith('~')) {
    const remainder = trimmed.slice(1).replace(/^[/\\]+/, '');
    return remainder ? path.join(os.homedir(), remainder) : os.homedir();
  }
  return path.resolve(trimmed);
}

function resolveStateDir(env = process.env) {
  const override = env.ECC_PLAN_CANVAS_STATE_DIR;
  if (override && String(override).trim()) return path.resolve(String(override).trim());
  return path.join(resolveClaudeConfigDir(env), 'plan-canvas');
}

// Canonicalize so `./plan.md`, symlinks, and absolute paths all land on the
// same session.
function canonicalizeArtifactPath(filePath) {
  const absolute = path.resolve(filePath);
  try {
    return fs.realpathSync(absolute);
  } catch {
    return absolute;
  }
}

function sessionKeyFor(canonicalPath) {
  return crypto.createHash('sha256').update(canonicalPath).digest('hex').slice(0, 12);
}

function nowIso() {
  return new Date().toISOString();
}

function sanitizeText(value, maxLength = DEFAULT_MAX_TEXT_CHARS) {
  if (typeof value !== 'string') return '';
  // Oversized input is REJECTED by the caller, never silently truncated: a
  // truncated prompt would reach the agent as a different instruction.
  if (maxLength && value.length > maxLength) {
    const error = new Error(`text exceeds ${maxLength} characters`);
    error.code = 'PROMPT_TOO_LARGE';
    throw error;
  }
  return value;
}

function truncate(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

// A clipped selector may no longer match the element it came from, so the
// anchor records that it was shortened instead of silently lying.
function clipAnchorPart(value, maxLength) {
  if (typeof value !== 'string') return { value: '', truncated: false };
  if (value.length <= maxLength) return { value, truncated: false };
  return { value: value.slice(0, maxLength), truncated: true };
}

// Normalize one browser-submitted feedback item into the shape delivered to
// the agent. Returns null for unusable input rather than throwing so a
// malformed item can never wedge the queue.
function normalizeFeedbackItem(raw, counter, maxTextLength = DEFAULT_MAX_TEXT_CHARS) {
  if (!raw || typeof raw !== 'object') return null;
  const kind = FEEDBACK_KINDS.has(raw.kind) ? raw.kind : null;
  if (!kind) return null;
  const item = {
    id: `fb-${counter}`,
    kind,
    text: sanitizeText(raw.text, maxTextLength),
    at: nowIso()
  };
  if (kind === 'verdict') {
    if (!VERDICTS.has(raw.verdict)) return null;
    item.verdict = raw.verdict;
  }
  if (kind === 'annotation') {
    const anchor = raw.anchor && typeof raw.anchor === 'object' ? raw.anchor : null;
    if (!anchor || typeof anchor.selector !== 'string') return null;
    // Anchor parts are browser-generated locators, not user prose. Truncate an
    // oversized one instead of dropping the item: discarding it would silently
    // throw away the commentary the human actually typed.
    const selectorPart = clipAnchorPart(anchor.selector, 500);
    const tagPart = clipAnchorPart(anchor.tag, 60);
    const snippetPart = clipAnchorPart(anchor.snippet, 400);
    item.anchor = {
      selector: selectorPart.value,
      tag: tagPart.value,
      snippet: snippetPart.value
    };
    if (selectorPart.truncated || tagPart.truncated || snippetPart.truncated) {
      item.anchor.truncated = true;
    }
    if (anchor.textRange && typeof anchor.textRange === 'object') {
      const textPart = clipAnchorPart(anchor.textRange.text, 1000);
      item.anchor.textRange = { text: textPart.value };
      if (textPart.truncated) item.anchor.truncated = true;
    }
    if (!item.text) return null;
  }
  if (kind === 'chat' && !item.text) return null;
  return item;
}

function createSessionStore({ stateDir = resolveStateDir() } = {}) {
  const stateFile = path.join(stateDir, 'sessions.json');
  let state = { sessions: {}, feedbackCounter: 0 };

  function load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      if (parsed && typeof parsed === 'object' && parsed.sessions) {
        state = {
          sessions: parsed.sessions,
          feedbackCounter: Number(parsed.feedbackCounter) || 0
        };
      }
    } catch {
      // Missing or corrupt state starts fresh; queued feedback loss on a
      // corrupt file beats refusing to start at all.
    }
  }

  function persist() {
    fs.mkdirSync(stateDir, { recursive: true });
    const tmpFile = `${stateFile}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2));
    fs.renameSync(tmpFile, stateFile);
  }

  load();

  function get(key) {
    return state.sessions[key] || null;
  }

  function findByFile(filePath) {
    const canonical = canonicalizeArtifactPath(filePath);
    return get(sessionKeyFor(canonical));
  }

  // Open (or resume) a session. A session the *user* ended from the browser
  // is sticky: it refuses a plain reopen so agents do not pop the browser
  // back up uninvited. Pass reopen:true only when the human asked.
  function open(filePath, {
    reopen = false,
    target = null,
    sessionDir = null,
    workspace = null,
    previewMode = null,
    previewUrl = null,
    previewMeta = null
  } = {}) {
    const canonical = canonicalizeArtifactPath(filePath);
    const key = sessionKeyFor(canonical);
    const existing = state.sessions[key];
    if (existing && existing.status === 'ended' && existing.endedBy === 'user' && !reopen) {
      return { session: existing, refused: true };
    }
    const session = existing || {
      key,
      file: canonical,
      chat: [],
      pendingFeedback: [],
      createdAt: nowIso()
    };
    session.status = 'open';
    delete session.endedBy;
    if (target) session.target = target;
    if (sessionDir) session.sessionDir = sessionDir;
    if (workspace) session.workspace = workspace;
    // Preview fields are opt-in: a caller that passes none gets exactly the
    // legacy session shape, so old sessions and old agents keep working.
    const mode = PREVIEW_MODES.has(previewMode) ? previewMode : null;
    if (mode) {
      session.previewMode = mode;
      const url = mode === 'framework-native' ? sanitizePreviewUrl(previewUrl) : null;
      if (url) session.previewUrl = url;
      const meta = sanitizePreviewMeta(previewMeta);
      if (meta) session.previewMeta = meta;
    }
    session.updatedAt = nowIso();
    state.sessions[key] = session;
    persist();
    return { session, refused: false };
  }

  // Queue feedback from the browser. Chat-shaped items are mirrored into the
  // session transcript immediately so the conversation panel stays coherent
  // across reloads.
  function queueFeedback(key, rawItems, { endSession = false } = {}) {
    const session = get(key);
    if (!session || session.status === 'ended') return null;
    // Strict verdict binding applies only to sessions opened for the agy CLI.
    // Legacy sessions keep the plain-verdict path byte-for-byte compatible.
    const strict = session.target === 'antigravity-cli';
    const workspace = session.workspace || path.dirname(session.file);
    const accepted = [];
    const rejected = [];
    for (const raw of Array.isArray(rawItems) ? rawItems : []) {
      state.feedbackCounter += 1;
      if (strict && raw && raw.kind === 'verdict') {
        let currentDigest = null;
        try {
          currentDigest = computePlanDigest(session.file);
        } catch {
          currentDigest = null;
        }
        const binding = validateBoundVerdict(raw, {
          workspace,
          session: key,
          revisionDigest: currentDigest
        });
        if (!binding.ok) {
          rejected.push({ reason: binding.reason, verdict: raw.verdict });
          continue;
        }
      }
      let item = null;
      try {
        item = normalizeFeedbackItem(
          raw,
          state.feedbackCounter,
          strict ? MAX_PROMPT_CHARS : DEFAULT_MAX_TEXT_CHARS
        );
      } catch (error) {
        // One oversized item must not reject the whole batch: the browser sent
        // several things and the rest is still valid.
        rejected.push({ reason: error.code || 'INVALID_ITEM' });
        continue;
      }
      if (item) accepted.push(item);
    }
    session.pendingFeedback.push(...accepted);
    for (const item of accepted) {
      session.chat.push({ role: 'user', kind: item.kind, text: chatLineFor(item), at: item.at });
    }
    if (endSession) {
      session.status = 'ended';
      session.endedBy = 'user';
    } else if (accepted.length > 0) {
      session.status = 'feedback';
    }
    session.updatedAt = nowIso();
    persist();
    return { accepted, rejected, pending: session.pendingFeedback.length, session };
  }

  // Deliver-and-drain: feedback is handed to exactly one await call, after
  // which the session flips back to open. An ended session keeps reporting
  // ended (with attribution) so agents know to stop polling.
  function takeFeedback(key) {
    const session = get(key);
    if (!session) return { status: 'missing' };
    if (session.pendingFeedback.length > 0) {
      const items = session.pendingFeedback;
      session.pendingFeedback = [];
      const result = { status: 'feedback', items };
      if (session.status === 'ended') {
        result.sessionEnded = true;
        result.endedBy = session.endedBy;
      } else {
        session.status = 'open';
      }
      session.updatedAt = nowIso();
      persist();
      return result;
    }
    if (session.status === 'ended') {
      return { status: 'ended', endedBy: session.endedBy };
    }
    return { status: 'waiting' };
  }

  function addAgentReply(key, text) {
    const session = get(key);
    if (!session) return null;
    const entry = { role: 'agent', kind: 'chat', text: sanitizeText(text), at: nowIso() };
    session.chat.push(entry);
    session.updatedAt = nowIso();
    persist();
    return entry;
  }

  function end(key, endedBy) {
    const session = get(key);
    if (!session) return null;
    session.status = 'ended';
    session.endedBy = endedBy === 'user' ? 'user' : 'agent';
    session.updatedAt = nowIso();
    persist();
    return session;
  }

  function list() {
    return Object.values(state.sessions).map(session => ({
      key: session.key,
      file: session.file,
      status: session.status,
      endedBy: session.endedBy,
      pending: session.pendingFeedback.length,
      updatedAt: session.updatedAt
    }));
  }

  function hasOpenSessions() {
    return Object.values(state.sessions).some(session => session.status !== 'ended');
  }

  return {
    stateDir,
    stateFile,
    open,
    get,
    findByFile,
    queueFeedback,
    takeFeedback,
    addAgentReply,
    end,
    list,
    hasOpenSessions
  };
}

// One-line rendering of a feedback item for the conversation transcript.
function chatLineFor(item) {
  if (item.kind === 'verdict') {
    const label = item.verdict === 'approve' ? 'Approved the plan' : 'Requested changes';
    return item.text ? `${label}: ${item.text}` : label;
  }
  if (item.kind === 'annotation') {
    const where = item.anchor.snippet || item.anchor.selector;
    return `[${where}] ${item.text}`;
  }
  return item.text;
}

module.exports = {
  canonicalizeArtifactPath,
  createSessionStore,
  normalizeFeedbackItem,
  resolveStateDir,
  sessionKeyFor
};
