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
  validateBoundVerdict,
  validateNativeVerdict
} = require('./verdict-binding');
const { normalizeEditItem, summarizeEdit } = require('./change-set');

// One verdict policy for both the queue and the drain path. A native session is
// validated against its preview identity; an AGY session additionally binds the
// workspace, the session and the plan file.
function validateVerdictSubmission(raw, session, key) {
  const workspace = session.workspace || path.dirname(session.file);
  if (session.previewMode === 'framework-native') {
    const binding = validateNativeVerdict(raw, session.previewMeta);
    if (!binding.ok) return { ok: false, reason: binding.reason };
    if (session.target !== 'antigravity-cli') {
      return { ok: true, identity: binding.identity, planDigest: null };
    }
    if (raw.workspace !== workspace) return { ok: false, reason: 'WORKSPACE_MISMATCH' };
    if (raw.session !== key) return { ok: false, reason: 'SESSION_MISMATCH' };
    // The plan digest travels separately here: revisionDigest names the preview.
    if (!/^[0-9a-f]{64}$/.test(raw.planDigest || '')) {
      return { ok: false, reason: 'MISSING_BINDING' };
    }
    const planDigest = planDigestOrNull(session.file);
    if (raw.planDigest !== planDigest) return { ok: false, reason: 'STALE_PLAN' };
    return { ok: true, identity: binding.identity, planDigest };
  }
  if (session.target !== 'antigravity-cli') return { ok: true, identity: null, planDigest: null };
  const planDigest = planDigestOrNull(session.file);
  const binding = validateBoundVerdict(raw, { workspace, session: key, revisionDigest: planDigest });
  if (!binding.ok) return { ok: false, reason: binding.reason };
  return { ok: true, identity: null, planDigest };
}

// A queued verdict is re-checked at drain time, so a preview that changed
// between the click and takeFeedback cannot be approved retroactively.
function verdictStillBound(session, item) {
  if (item.planDigest && item.planDigest !== planDigestOrNull(session.file)) return false;
  if (session.previewMode === 'framework-native') {
    const raw = { ...item, kind: 'verdict', timestamp: item.timestamp || item.at };
    return validateNativeVerdict(raw, session.previewMeta).ok;
  }
  return true;
}


// Anchor locators come from the browser, not the human. Truncating one keeps
// the commentary usable; rejecting it would discard what the user typed.
// Free-form prompt text is the operator's actual message, so the ceiling is
// generous for every session: a long review brief is legitimate input, and a
// silent truncation would lose the instruction the agent is meant to follow.
const DEFAULT_MAX_TEXT_CHARS = 100000;

const FEEDBACK_KINDS = new Set(['chat', 'annotation', 'verdict', 'edits']);
const VERDICTS = new Set(['approve', 'request-changes']);
const PREVIEW_MODES = new Set(['framework-native', 'standalone-html']);

// Everything that makes an approval name one specific preview. A queued verdict
// is only valid while this tuple is unchanged.
function previewIdentity(session) {
  const meta = (session && session.previewMeta) || {};
  return [
    (session && session.previewMode) || '',
    meta.section || '',
    meta.revision || '',
    meta.revisionDigest || '',
    meta.designDigest || ''
  ].join('\u0000');
}

function planDigestOrNull(file) {
  try {
    return computePlanDigest(file);
  } catch {
    return null;
  }
}

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

// Only the labels the canvas actually renders. Anything else a caller sends is
// dropped so a large object cannot bloat the session file that every broadcast
// re-reads. An invalid digest is dropped rather than stored: a session without
// a usable digest fails closed at verdict time.
function sanitizePreviewMeta(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const meta = {};
  for (const field of ['section', 'revision', 'framework']) {
    const text = value[field];
    if (typeof text === 'string' && text.length > 0) meta[field] = text.slice(0, 120);
  }
  // Phase 5: the preview is stamped with the revision it shows, so a verdict
  // can be matched against the exact reference the owner reviewed.
  if (typeof value.revisionDigest === 'string' && /^[0-9a-f]{64}$/.test(value.revisionDigest)) {
    meta.revisionDigest = value.revisionDigest;
  }
  // The design digest is what native gates bind the baseline capture to.
  if (typeof value.designDigest === 'string' && /^[0-9a-f]{64}$/.test(value.designDigest)) {
    meta.designDigest = value.designDigest;
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

// Numeric anchor fields are browser measurements, so a non-finite entry is
// dropped rather than turned into null or NaN on the agent side.
function numericFields(raw, keys) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  for (const key of keys) {
    const value = Number(raw[key]);
    if (Number.isFinite(value)) out[key] = Math.round(value * 100) / 100;
  }
  return Object.keys(out).length ? out : null;
}

const STYLE_KEYS = ['display', 'color', 'backgroundColor', 'fontFamily', 'fontSize', 'fontWeight'];

// Normalize one browser-submitted feedback item into the shape delivered to
// the agent. Returns null for unusable input rather than throwing so a
// malformed item can never wedge the queue.
function normalizeFeedbackItem(raw, counter, maxTextLength = DEFAULT_MAX_TEXT_CHARS, session = null) {
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
  if (kind === 'edits') {
    // Structural rules live in change-set.js and throw a coded error, so the
    // batch can report which item was refused and why instead of a generic
    // failure. Text is optional here; a summary keeps the transcript readable.
    item.changeSet = normalizeEditItem(raw, session);
    if (!item.text) item.text = summarizeEdit(item.changeSet);
    return item;
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
    // Element context captured in the live document: enough to re-locate the
    // target without any data-ecc-id instrumentation in the project.
    for (const key of ['role', 'testId', 'name']) {
      const part = clipAnchorPart(anchor[key], 200);
      if (part.value) item.anchor[key] = part.value;
      if (part.truncated) item.anchor.truncated = true;
    }
    const rect = numericFields(anchor.rect, ['x', 'y', 'w', 'h']);
    if (rect) item.anchor.rect = rect;
    const viewport = numericFields(anchor.viewport, ['w', 'h', 'dpr']);
    if (viewport) item.anchor.viewport = viewport;
    if (anchor.styles && typeof anchor.styles === 'object') {
      const styles = {};
      for (const key of STYLE_KEYS) {
        const part = clipAnchorPart(anchor.styles[key], 120);
        if (part.value) styles[key] = part.value;
      }
      if (Object.keys(styles).length) item.anchor.styles = styles;
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
    previewMeta = null,
    editMode = false
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
    // The visual editor is opt-in per session. Without the flag the chrome
    // renders exactly the legacy control set, so ordinary plan review and old
    // sessions are untouched.
    if (editMode) session.editMode = true;
    // Preview fields are opt-in: a caller that passes none gets exactly the
    // legacy session shape, so old sessions and old agents keep working.
    const mode = PREVIEW_MODES.has(previewMode) ? previewMode : null;
    if (mode) {
      // A queued verdict names exactly one preview. Any change to the mode,
      // section, revision label or either digest makes it stale, so it is
      // dropped here instead of being drained as approval of the newer draft.
      const before = previewIdentity(session);
      session.previewMode = mode;
      if (mode === 'framework-native') {
        const url = sanitizePreviewUrl(previewUrl);
        if (url) session.previewUrl = url;
        const meta = sanitizePreviewMeta(previewMeta);
        if (meta) session.previewMeta = meta;
        else delete session.previewMeta;
      } else {
        // Legacy mode carries no native identity; leftover preview fields would
        // still render a native frame and a stale-revision banner.
        delete session.previewUrl;
        delete session.previewMeta;
      }
      if (previewIdentity(session) !== before && Array.isArray(session.pendingFeedback)) {
        session.pendingFeedback = session.pendingFeedback.filter(item => item.kind !== 'verdict');
      }
    }
    session.updatedAt = nowIso();
    state.sessions[key] = session;
    persist();
    return { session, refused: false };
  }

  // One item through the same policy: validate a verdict, then normalize.
  // Returns the accepted item or the rejection the batch reports.
  function acceptOneFeedback(raw, session, key, id, limit, batchHasEdits) {
    // The browser knows a change set by its own id before submission; a
    // rejected item never gets an fb-<n>. Echo clientId so the chrome can tell
    // which queued entry failed in a mixed batch.
    const clientId = raw && typeof raw.clientId === 'string' ? raw.clientId.slice(0, 128) : undefined;
    const reject = (reason, extra) => ({ rejected: { reason, ...(clientId ? { id: clientId } : {}), ...extra } });

    let binding = { ok: true, identity: null, planDigest: null };
    if (raw && raw.kind === 'verdict') {
      // A verdict must describe source output. An override that only lives in
      // the preview (in this batch or still queued) has not reached source yet.
      const undrained = (session.pendingFeedback || []).some(item => item.kind === 'edits');
      if (batchHasEdits || undrained) return reject('PENDING_EDITS', { verdict: raw.verdict });
      binding = validateVerdictSubmission(raw, session, key);
      if (!binding.ok) return reject(binding.reason, { verdict: raw.verdict });
    }
    if (raw && raw.kind === 'edits') {
      const changeSetId = raw.changeSet && typeof raw.changeSet.id === 'string' ? raw.changeSet.id.trim() : '';
      // Retry must be safe: the same frozen set submitted twice is one change.
      if (changeSetId && (session.seenChangeSetIds || []).includes(changeSetId)) {
        return reject('DUPLICATE_CHANGE_SET');
      }
    }
    let item;
    try {
      item = normalizeFeedbackItem(raw, id, limit, session);
    } catch (error) {
      // One oversized or malformed item must not reject the whole batch: the
      // browser sent several things and the rest is still valid. The code is
      // reported verbatim so the owner sees why the value was refused.
      return reject(error.code || 'INVALID_ITEM');
    }
    // A malformed item normalizes to null instead of throwing; one bad entry
    // must not abort the batch.
    if (!item) return reject('INVALID_ITEM');
    // Echo the caller's own id on success too. The chrome clears the matching
    // overrides from this list; without it a mixed batch is uncorrelatable.
    if (clientId) item.clientId = clientId;
    if (item.kind === 'verdict' && (binding.identity || binding.planDigest)) {
      // Keep the reviewed identity on the item, so a later reader can tell which
      // revision was approved without trusting the current session meta.
      if (binding.identity) Object.assign(item, binding.identity);
      if (binding.planDigest) {
        item.planDigest = binding.planDigest;
        // No preview identity: pre-native AGY, where revisionDigest names the plan.
        if (!binding.identity) item.revisionDigest = binding.planDigest;
      }
    }
    return { item };
  }

  // Queue feedback from the browser. Chat-shaped items are mirrored into the
  // session transcript immediately so the conversation panel stays coherent
  // across reloads.
  function queueFeedback(key, rawItems, { endSession = false } = {}) {
    const session = get(key);
    if (!session || session.status === 'ended') return null;
    // Strict binding applies only to sessions opened for the agy CLI. Legacy
    // sessions keep the plain-verdict path byte-for-byte compatible.
    const limit = session.target === 'antigravity-cli' ? MAX_PROMPT_CHARS : DEFAULT_MAX_TEXT_CHARS;
    const accepted = [];
    const rejected = [];
    const rawList = Array.isArray(rawItems) ? rawItems : [];
    // A batch that carries both edits and a verdict would certify overrides
    // that only exist in the preview. The verdict is rejected below.
    const batchHasEdits = rawList.some(item => item && item.kind === 'edits');
    for (const raw of rawList) {
      state.feedbackCounter += 1;
      const result = acceptOneFeedback(raw, session, key, state.feedbackCounter, limit, batchHasEdits);
      if (result.item) {
        accepted.push(result.item);
        // Recorded now, so a duplicate inside the same batch is caught too.
        if (result.item.kind === 'edits' && result.item.changeSet) {
          session.seenChangeSetIds = session.seenChangeSetIds || [];
          session.seenChangeSetIds.push(result.item.changeSet.id);
          if (session.seenChangeSetIds.length > 1000) session.seenChangeSetIds.shift();
        }
      } else rejected.push(result.rejected);
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

  function takeFeedback(key) {
    const session = get(key);
    if (!session) return { status: 'missing' };
    if (session.pendingFeedback.length > 0) {
      // Re-check every verdict against the session as it is NOW: a preview that
      // moved on between the click and this drain invalidates the queued one.
      const rejected = [];
      const items = session.pendingFeedback.filter(item => {
        if (item.kind !== 'verdict' || verdictStillBound(session, item)) return true;
        rejected.push({ reason: 'STALE_REVISION', verdict: item.verdict });
        return false;
      });
      session.pendingFeedback = [];
      // Every queued verdict was stale: nothing is waiting any more, so the
      // session must not stay in the 'feedback' state.
      if (items.length === 0 && session.status === 'feedback') session.status = 'open';
      if (items.length > 0) {
        const result = { status: 'feedback', items };
        if (rejected.length > 0) result.rejected = rejected;
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
      session.updatedAt = nowIso();
      persist();
      if (session.status === 'ended') {
        return { status: 'ended', endedBy: session.endedBy, rejected };
      }
      return { status: 'waiting', rejected };
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
      updatedAt: session.updatedAt,
      previewMode: session.previewMode,
      previewMeta: session.previewMeta || null
    }));
  }

  function hasOpenSessions() {
    return Object.values(state.sessions).some(session => session.status !== 'ended');
  }

  return {
    stateDir,
    stateFile,
    previewModes: PREVIEW_MODES,
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
    const label = item.verdict !== 'approve'
      ? 'Requested changes'
      : item.designDigest ? 'Approved the design' : 'Approved the plan';
    return item.text ? `${label}: ${item.text}` : label;
  }
  if (item.kind === 'annotation') {
    const where = item.anchor.snippet || item.anchor.selector;
    return `[${where}] ${item.text}`;
  }
  if (item.kind === 'edits') {
    // item.text already carries summarizeEdit() when the owner left no note.
    return item.text || summarizeEdit(item.changeSet);
  }
  return item.text;
}

module.exports = {
  PREVIEW_MODES,
  canonicalizeArtifactPath,
  createSessionStore,
  normalizeFeedbackItem,
  resolveStateDir,
  sessionKeyFor
};
