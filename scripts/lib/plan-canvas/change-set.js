'use strict';

/**
 * Plan Canvas structured change set.
 *
 * A visual edit is not a stylesheet. It is a description of the intent, plus
 * the evidence needed to apply it to real source: which preview, which route,
 * which element, which property, what it looked like before. The browser never
 * writes files, so this module only validates and shapes that description.
 *
 * Two rules drive every rejection here:
 *   1. Never silently rewrite what the owner asked for. Report and refuse.
 *   2. Never claim an effect the renderer did not confirm. `effective` is
 *      carried from the SDK's computed-value read-back, not inferred.
 */

const MAX_EDITS = 500;
const MAX_AFTER = 200;
const MAX_SELECTOR = 500;
const MAX_SNIPPET = 400;
const MAX_SOURCE_HINT = 200;
const MAX_ROUTE = 2000;

const SCOPES = new Set(['instance', 'component', 'section', 'token']);
const TOKEN_ORIGINS = new Set(['authored', 'confirmed']);
const PREVIEW_MODES = new Set(['framework-native', 'standalone-html']);

// Closed whitelist. Anything outside it belongs to the agent, not the canvas.
const PROPS = new Set([
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'padding-inline', 'padding-block',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'margin-inline', 'margin-block',
  'gap', 'row-gap', 'column-gap',
  'background-color',
  'color', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
  'border-width', 'border-style', 'border-color', 'border-radius',
  'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-right-radius', 'border-bottom-left-radius',
  'box-shadow', 'opacity'
]);

// A value lands inside a generated CSS rule, so structural characters are
// refused rather than escaped. The owner can type a colour, a length, a token.
const UNSAFE_VALUE = /[;{}<>]|[\r\n]/;
const SOURCE_HINT_RE = /^[^:*\s]+:\d+:\d+$/;
const TOKEN_RE = /^--[A-Za-z0-9_-]+$/;

class ChangeSetError extends Error {
  constructor(code, detail) {
    super(detail || code);
    this.name = 'ChangeSetError';
    this.code = code;
  }
}

function fail(code, detail) {
  throw new ChangeSetError(code, detail);
}

function text(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function numbers(raw, keys) {
  if (!isPlainObject(raw)) return null;
  const out = {};
  for (const key of keys) {
    const value = Number(raw[key]);
    if (Number.isFinite(value)) out[key] = Math.round(value * 100) / 100;
  }
  return Object.keys(out).length ? out : null;
}

function normalizeValue(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return String(value);
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_AFTER) return null;
  if (UNSAFE_VALUE.test(trimmed)) return null;
  return trimmed;
}

function normalizeEdit(raw, propSet) {
  if (!isPlainObject(raw)) fail('INVALID_EDIT', 'edit must be an object');
  const prop = typeof raw.prop === 'string' ? raw.prop : '';
  if (!PROPS.has(prop)) fail('INVALID_PROP', `prop not allowed: ${prop || '(empty)'}`);
  propSet.add(prop);

  const after = normalizeValue(raw.after);
  if (after === null) fail('INVALID_VALUE', `unusable value for ${prop}`);

  const before = isPlainObject(raw.before) ? raw.before : {};
  const edit = { prop, after };
  const authored = typeof before.authored === 'string' ? before.authored.slice(0, MAX_AFTER) : null;
  const computed = typeof before.computed === 'string' ? before.computed.slice(0, MAX_AFTER) : null;
  edit.before = { authored, computed };

  if (typeof raw.unit === 'string' && raw.unit) edit.unit = raw.unit.slice(0, 16);
  // Declared and rendered are different facts. A width can be declared 320px
  // and render 288px inside a constrained flex row.
  if (typeof raw.declared === 'string') edit.declared = raw.declared.slice(0, MAX_AFTER);
  if (typeof raw.rendered === 'string') edit.rendered = raw.rendered.slice(0, MAX_AFTER);
  if (typeof raw.effective === 'boolean') edit.effective = raw.effective;

  if (raw.token !== null && raw.token !== undefined) {
    // A token claim must be a token and must say how it was established. The
    // owner's intent is never defaulted into "authored".
    if (typeof raw.token !== 'string' || !TOKEN_RE.test(raw.token)) {
      fail('INVALID_TOKEN', `token must be a --name, got ${String(raw.token).slice(0, 40)}`);
    }
    if (!TOKEN_ORIGINS.has(raw.tokenOrigin)) {
      fail('INVALID_TOKEN_ORIGIN', 'tokenOrigin must be authored or confirmed');
    }
    edit.token = raw.token;
    edit.tokenOrigin = raw.tokenOrigin;
  } else {
    edit.token = null;
  }
  return edit;
}

function normalizeTarget(raw, editBudget) {
  if (!isPlainObject(raw)) fail('INVALID_TARGET', 'target must be an object');
  const selector = typeof raw.selector === 'string' ? raw.selector.trim() : '';
  if (!selector) fail('INVALID_TARGET', 'target selector is required');
  if (selector.length > MAX_SELECTOR) fail('INVALID_SELECTOR', 'target selector too long');

  if (!Array.isArray(raw.edits) || raw.edits.length === 0) {
    fail('INVALID_TARGET', 'target must carry at least one edit');
  }
  if (editBudget.used + raw.edits.length > MAX_EDITS) {
    fail('TOO_MANY_EDITS', `more than ${MAX_EDITS} edits`);
  }
  editBudget.used += raw.edits.length;

  const target = {
    targetId: typeof raw.targetId === 'string' && raw.targetId ? raw.targetId.slice(0, 64) : '',
    selector,
    tag: text(raw.tag, 60),
    role: text(raw.role, 200),
    testId: text(raw.testId, 200),
    name: text(raw.name, 200),
    snippet: text(raw.snippet, MAX_SNIPPET),
    rect: numbers(raw.rect, ['x', 'y', 'w', 'h']),
    sourceHint: null,
    edits: raw.edits.map(edit => normalizeEdit(edit, editBudget.props))
  };

  if (typeof raw.sourceHint === 'string' && raw.sourceHint) {
    const hint = raw.sourceHint.trim();
    // Repo-relative only: an absolute path or a `..` segment points outside
    // the project the agent is allowed to edit.
    const escapes = hint.startsWith('/') || hint.split('/').includes('..');
    if (escapes || hint.length > MAX_SOURCE_HINT || !SOURCE_HINT_RE.test(hint)) {
      fail('INVALID_SOURCE_HINT', 'sourceHint must be file:line:column from data-ecc-source');
    }
    target.sourceHint = hint;
  }
  return target;
}

/**
 * Validate a change set against the live session.
 *
 * Throws a coded ChangeSetError. Callers map the code into a rejected entry so
 * the chrome can keep exactly the failed item and tell the owner why.
 */
function normalizeChangeSet(raw, session = null) {
  if (!isPlainObject(raw)) fail('INVALID_CHANGE_SET', 'changeSet must be an object');
  if (Number(raw.version) !== 1) fail('UNSUPPORTED_VERSION', 'only changeSet version 1 is accepted');

  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  if (!id) fail('MISSING_CHANGE_SET_ID', 'changeSet.id is required');
  if (id.length > 120) fail('INVALID_CHANGE_SET_ID', 'changeSet.id too long');

  const sessionKey = typeof raw.session === 'string' ? raw.session : '';
  if (!sessionKey) fail('MISSING_SESSION', 'changeSet.session is required');
  if (session && session.key !== sessionKey) fail('STALE_SESSION', 'changeSet belongs to another session');

  const route = typeof raw.route === 'string' ? raw.route.trim() : '';
  if (!route) fail('MISSING_ROUTE', 'changeSet.route is required');
  if (route.length > MAX_ROUTE) fail('INVALID_ROUTE', 'changeSet.route too long');

  const preview = isPlainObject(raw.preview) ? raw.preview : {};
  const mode = PREVIEW_MODES.has(preview.mode) ? preview.mode : null;
  if (!mode) fail('INVALID_PREVIEW_MODE', 'preview.mode must be framework-native or standalone-html');
  // The client never gets to downgrade the session's preview mode: a
  // standalone-html claim on a native session would skip the digest check.
  if (session && session.previewMode && mode !== session.previewMode) {
    fail('PREVIEW_MODE_MISMATCH', `session previews as ${session.previewMode}`);
  }

  // Only a framework-native preview keeps previewMeta; a standalone HTML
  // session has nothing to bind to and no digest to compare.
  if (mode === 'framework-native' && session && session.previewMode === 'framework-native') {
    const live = session.previewMeta || {};
    const digest = typeof preview.revisionDigest === 'string' ? preview.revisionDigest : '';
    // Every field that names the reviewed revision has to match the live
    // preview. A matching digest alone let an edit claim another section or a
    // stale revision label, and a native edit with no digest had nothing to
    // bind to at all.
    if (!live.revisionDigest) {
      fail('MISSING_REVISION', 'the session has no live preview revision to bind this edit to');
    }
    if (digest !== live.revisionDigest) {
      fail('STALE_REVISION', 'the reviewed preview revision moved on');
    }
    if ((preview.section || '') !== (live.section || '')) {
      fail('SECTION_MISMATCH', `session previews section ${live.section || '(none)'}`);
    }
    if ((preview.revision || '') !== (live.revision || '')) {
      fail('REVISION_MISMATCH', `session previews revision ${live.revision || '(none)'}`);
    }
    if (live.designDigest && (preview.designDigest || '') !== live.designDigest) {
      fail('DESIGN_MISMATCH', 'the edit was drawn against another design revision');
    }
  }

  if (raw.scope !== undefined && raw.scope !== null && typeof raw.scope !== 'string') {
    fail('INVALID_SCOPE', 'scope must be a string');
  }
  const scope = typeof raw.scope === 'string' && raw.scope ? raw.scope : 'instance';
  if (!SCOPES.has(scope)) fail('INVALID_SCOPE', `scope not allowed: ${scope}`);
  // Widening a change past the selected instance is an owner decision, never a
  // default. Without an explicit confirmation the only safe reading is instance.
  if (scope !== 'instance' && raw.scopeConfirmedBy !== 'owner') {
    fail('SCOPE_UNCONFIRMED', `scope "${scope}" needs explicit owner confirmation`);
  }

  if (!Array.isArray(raw.targets) || raw.targets.length === 0) {
    fail('MISSING_TARGETS', 'changeSet.targets must not be empty');
  }

  const budget = { used: 0, props: new Set() };
  const targets = raw.targets.map(target => normalizeTarget(target, budget));

  // A breakpoint name is only real when the project declares one. Without
  // evidence it stays null; viewport width is not a breakpoint.
  const breakpoint = typeof raw.breakpoint === 'string' && raw.breakpoint.trim()
    ? raw.breakpoint.trim().slice(0, 60)
    : null;

  return {
    id,
    version: 1,
    session: sessionKey,
    route,
    preview: {
      mode,
      framework: text(preview.framework, 40) || null,
      section: text(preview.section, 120) || null,
      revision: text(preview.revision, 120) || null,
      revisionDigest: text(preview.revisionDigest, 128) || null,
      designDigest: text(preview.designDigest, 128) || null
    },
    viewport: numbers(raw.viewport, ['w', 'h', 'dpr']),
    breakpoint,
    scope,
    scopeConfirmedBy: scope === 'instance' ? null : 'owner',
    targets
  };
}

// Called by the session store from the `edits` branch. Keeps the feedback
// envelope (`text`) while delegating every structural rule above.
function normalizeEditItem(raw, session = null) {
  return normalizeChangeSet(raw.changeSet, session);
}

// One line for the conversation panel, so an edits item with no note is still
// readable in the transcript.
function summarizeEdit(changeSet) {
  if (!changeSet || !Array.isArray(changeSet.targets)) return 'Visual edits';
  const targetCount = changeSet.targets.length;
  const props = new Set();
  for (const target of changeSet.targets) {
    for (const edit of target.edits) props.add(edit.prop);
  }
  const list = Array.from(props).slice(0, 4).join(', ');
  const more = props.size > 4 ? `, +${props.size - 4}` : '';
  return `Visual edits: ${targetCount} element${targetCount === 1 ? '' : 's'} (${list}${more})`;
}

module.exports = {
  ChangeSetError,
  MAX_AFTER,
  MAX_EDITS,
  PROPS,
  SCOPES,
  normalizeChangeSet,
  normalizeEditItem,
  summarizeEdit
};
