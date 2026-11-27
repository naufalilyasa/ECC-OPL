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

const HEX64 = /^[0-9a-f]{64}$/;

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

/**
 * Native preview verdict binding. A framework-native verdict must carry the
 * identity of the exact preview the owner looked at — section, revision and
 * both digests — so a verdict drained from an old tab cannot approve a newer
 * draft. Compared against the *current* session.previewMeta, never the meta the
 * browser booted with.
 */
function validateNativeVerdict(raw, previewMeta) {
  if (!raw || typeof raw !== 'object' || raw.kind !== 'verdict') {
    return { ok: false, reason: 'MISSING_BINDING' };
  }
  // A session that lost its preview identity cannot bind anything. Failing
  // closed here is what stops a plain verdict from approving a native draft.
  if (!previewMeta || typeof previewMeta !== 'object') {
    return { ok: false, reason: 'MISSING_BINDING' };
  }
  if (!isNonEmptyString(previewMeta.section) || !isNonEmptyString(previewMeta.revision)
    || !HEX64.test(previewMeta.revisionDigest || '')
    || !HEX64.test(previewMeta.designDigest || '')) {
    return { ok: false, reason: 'MISSING_BINDING' };
  }
  if (raw.verdict !== 'approve' && raw.verdict !== 'request-changes') {
    return { ok: false, reason: 'UNSUPPORTED_VERDICT' };
  }
  if (!isNonEmptyString(raw.timestamp) || !Number.isFinite(Date.parse(raw.timestamp))) {
    return { ok: false, reason: 'INVALID_TIMESTAMP' };
  }
  if (!isNonEmptyString(raw.section) || !isNonEmptyString(raw.revision)
    || !HEX64.test(raw.revisionDigest || '') || !HEX64.test(raw.designDigest || '')) {
    return { ok: false, reason: 'MISSING_BINDING' };
  }
  if (raw.section !== previewMeta.section) return { ok: false, reason: 'STALE_SECTION' };
  if (raw.revision !== previewMeta.revision) return { ok: false, reason: 'STALE_REVISION' };
  if (raw.revisionDigest !== previewMeta.revisionDigest) return { ok: false, reason: 'STALE_REVISION' };
  if (raw.designDigest !== previewMeta.designDigest) return { ok: false, reason: 'STALE_DESIGN' };
  return {
    ok: true,
    verdict: raw.verdict,
    identity: {
      section: raw.section,
      revision: raw.revision,
      revisionDigest: raw.revisionDigest,
      designDigest: raw.designDigest
    }
  };
}

function isValidPromptLength(text) {
  return typeof text === 'string' && text.length <= MAX_PROMPT_CHARS;
}

/**
 * Real magic-byte signatures. A MIME label alone is a client claim; the bytes
 * must match the declared image type.
 */
const IMAGE_SIGNATURES = Object.freeze({
  'image/png': buffer => buffer.length >= 8
    && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/jpeg': buffer => buffer.length >= 3
    && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  'image/webp': buffer => buffer.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP',
});

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
    // The declared MIME must match the actual bytes.
    if (!IMAGE_SIGNATURES[item.mime](item.data)) {
      return { ok: false, reason: 'CONTENT_MISMATCH' };
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
  validateBoundVerdict,
  validateNativeVerdict
};
