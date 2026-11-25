'use strict';

/**
 * Antigravity CLI verdict binding and Canvas V2 limits.
 *
 * Strict binding applies ONLY when a canvas session was opened with
 * `target: 'antigravity-cli'`. Legacy OpenCode sessions keep the plain
 * `{kind:'verdict', verdict:'approve'}` path unchanged (see sessions.js).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAX_PROMPT_CHARS = 100000;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;
const ALLOWED_ATTACHMENT_MIMES = Object.freeze({
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp'
});

function computePlanDigest(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Validate a browser-submitted verdict against the exact bound context.
 * Returns `{ok:true, verdict}` or `{ok:false, reason}`. Never accepts chat
 * text or native host buttons as authorization.
 */
function validateBoundVerdict(raw, ctx = {}) {
  if (!raw || typeof raw !== 'object' || raw.kind !== 'verdict') {
    return { ok: false, reason: 'MISSING_BINDING' };
  }
  if (!isNonEmptyString(raw.verdict)
    || !isNonEmptyString(raw.revisionDigest)
    || !isNonEmptyString(raw.workspace)
    || !isNonEmptyString(raw.session)
    || !isNonEmptyString(raw.timestamp)) {
    return { ok: false, reason: 'MISSING_BINDING' };
  }
  if (raw.verdict !== 'approve' && raw.verdict !== 'request-changes') {
    return { ok: false, reason: 'UNSUPPORTED_VERDICT' };
  }
  if (!Number.isFinite(Date.parse(raw.timestamp))) {
    return { ok: false, reason: 'INVALID_TIMESTAMP' };
  }
  if (raw.workspace !== ctx.workspace) return { ok: false, reason: 'WORKSPACE_MISMATCH' };
  if (raw.session !== ctx.session) return { ok: false, reason: 'SESSION_MISMATCH' };
  if (raw.revisionDigest !== ctx.revisionDigest) return { ok: false, reason: 'STALE_REVISION' };
  return { ok: true, verdict: raw.verdict };
}

function isValidPromptLength(text) {
  return typeof text === 'string' && text.length <= MAX_PROMPT_CHARS;
}

function validateAttachments(items) {
  if (!Array.isArray(items)) return { ok: false, reason: 'INVALID_MIME' };
  if (items.length > MAX_ATTACHMENTS) return { ok: false, reason: 'COUNT_EXCEEDED' };
  for (const item of items) {
    if (!item || !Object.hasOwn(ALLOWED_ATTACHMENT_MIMES, item.mime)) {
      return { ok: false, reason: 'INVALID_MIME' };
    }
    if (!Buffer.isBuffer(item.data) || item.data.length > MAX_ATTACHMENT_BYTES) {
      return { ok: false, reason: 'TOO_LARGE' };
    }
  }
  return { ok: true };
}

function attachmentFilename(data, mime) {
  const extension = ALLOWED_ATTACHMENT_MIMES[mime];
  if (!extension) throw new Error(`unsupported attachment MIME: ${mime}`);
  return `${crypto.createHash('sha256').update(data).digest('hex')}.${extension}`;
}

/**
 * Persist validated Canvas V2 attachments as content-addressed files under
 * <sessionDir>/attachments/. Returns the stored relative paths. Invalid
 * batches throw before any write, so a bad item cannot leave a partial set.
 */
function persistAttachments(sessionDir, items) {
  const validation = validateAttachments(items);
  if (!validation.ok) throw Object.assign(new Error(validation.reason), { code: validation.reason });
  const attachmentsDir = path.join(sessionDir, 'attachments');
  fs.mkdirSync(attachmentsDir, { recursive: true });
  return items.map(item => {
    const filename = attachmentFilename(item.data, item.mime);
    fs.writeFileSync(path.join(attachmentsDir, filename), item.data);
    return `attachments/${filename}`;
  });
}

module.exports = {
  ALLOWED_ATTACHMENT_MIMES,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  MAX_PROMPT_CHARS,
  attachmentFilename,
  computePlanDigest,
  isValidPromptLength,
  persistAttachments,
  validateAttachments,
  validateBoundVerdict
};
