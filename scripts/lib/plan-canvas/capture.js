/**
 * Plan Canvas screenshot capture.
 *
 * The canvas cannot rasterise a framework-native preview from the parent page:
 * the preview is a cross-origin iframe, and the request forbids an html2canvas
 * style renderer. Capture therefore drives the same Playwright browser the
 * design-build evidence scripts already use (`scripts/design-build-v2/`,
 * resolved through E2E_PLAYWRIGHT_DIR) against the preview URL itself.
 *
 * A separate context is used by design, not by accident: it contains no canvas
 * toolbar, inspector, conversation panel, feedback UI, annotation markers or
 * selection highlights, so "content only" needs no masking pass. The reviewed
 * scenario is reproduced explicitly (state/theme query, draft overrides) and
 * anything that cannot be reproduced is reported, never silently dropped.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createRequire } = require('module');
const { PROPS } = require('./change-set');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

// Mirrors the preset names used by scripts/design-build-v2/capture-live-section.mjs
// and the toolbar width list, so there is one vocabulary, not a second profile
// registry. dpr is 2 on phone presets because that is how they are reviewed.
const VIEWPORTS = Object.freeze([
  { id: 'desktop-1440', label: '1440x900 desktop', width: 1440, height: 900, dpr: 1 },
  { id: 'desktop-1280', label: '1280x900 desktop', width: 1280, height: 900, dpr: 1 },
  { id: 'tablet-768', label: '768x1024 tablet', width: 768, height: 1024, dpr: 1 },
  { id: 'mobile-390', label: '390x844 mobile', width: 390, height: 844, dpr: 2 },
  { id: 'mobile-360', label: '360x800 mobile', width: 360, height: 800, dpr: 2 }
]);

const DEFAULT_DPR = 1;
const CONCURRENCY = 2;
const MAX_BATCH = 40;

const CAP_ID = /^cap-[a-f0-9]{12}$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;
// Same rule the preview SDK applies to an override value. A capture replays the
// same records, so it must not accept anything the SDK would refuse.
const SAFE_VALUE = /^[^;{}<>\r\n]{1,200}$/;

const EDIT_PROPS = new Set(PROPS);

function playwrightDir() {
  return path.resolve(process.env.E2E_PLAYWRIGHT_DIR || REPO_ROOT);
}

let cachedChromium = null;
function loadChromium() {
  if (cachedChromium) return cachedChromium;
  const req = createRequire(path.join(playwrightDir(), 'package.json'));
  cachedChromium = req('playwright').chromium;
  return cachedChromium;
}

function captureUnavailable() {
  try {
    loadChromium();
    return null;
  } catch (error) {
    return { code: 'CAPTURE_UNAVAILABLE', why: String(error && error.message || error).slice(0, 200) };
  }
}

function viewportFor(id) {
  return VIEWPORTS.find(v => v.id === id) || null;
}

// --- URL policy -------------------------------------------------------------

function parsePreviewUrl(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  let parsed;
  try { parsed = new URL(raw); } catch { return null; }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  return parsed;
}

function isLoopbackHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'localhost' || host === '::1' || host === '[::1]' || /^127(\.\d{1,3}){3}$/.test(host);
}

/**
 * The host-side Playwright browser would happily render an internal address and
 * the pixels are served back out, so a preview URL is confined to loopback
 * unless the owner explicitly opts in. Link-local metadata addresses are never
 * reachable through the default policy.
 */
function previewUrlAllowed(raw) {
  const parsed = parsePreviewUrl(raw);
  if (!parsed) return { ok: false, code: 'PREVIEW_URL_UNSUPPORTED', why: 'preview URL must be an absolute http(s) URL' };
  if (process.env.ECC_CANVAS_ALLOW_REMOTE_PREVIEW !== '1' && !isLoopbackHost(parsed.hostname)) {
    return {
      ok: false,
      code: 'PREVIEW_URL_NOT_LOOPBACK',
      why: `preview host "${parsed.hostname}" is not loopback; set ECC_CANVAS_ALLOW_REMOTE_PREVIEW=1 to allow it`
    };
  }
  return { ok: true, parsed };
}

/**
 * The reviewed state is reproduced by the preview's own parameter names, so
 * whichever adapter the app already uses decides how a state is requested.
 * Nothing is rewritten in the DOM.
 */
function urlWithReviewContext(url, { state, theme, stateParam, themeParam } = {}) {
  const parsed = parsePreviewUrl(url);
  if (!parsed) return null;
  if (state && stateParam) parsed.searchParams.set(stateParam, state);
  if (theme && themeParam) parsed.searchParams.set(themeParam, theme);
  return parsed.toString();
}

// --- paths ------------------------------------------------------------------

/**
 * A path segment, never a path. Leading/trailing dots are stripped so `..`
 * cannot survive as a traversal segment, and nothing outside `[A-Za-z0-9._-]`
 * reaches the filesystem.
 */
function safeSlug(value, fallback) {
  const text = String(value == null ? '' : value).trim();
  if (!text) return fallback;
  const cleaned = text
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/^[-._]+|[-._]+$/g, '')
    .slice(0, 60);
  return cleaned || fallback;
}

/** Resolved path must stay inside the evidence root. */
function within(root, candidate) {
  const base = path.resolve(root);
  const target = path.resolve(candidate);
  return target === base || target.startsWith(base + path.sep);
}

/**
 * Where retained evidence lives. Explicit > explicit env > the active work item
 * that contains the session's plan file > a neutral fallback. Never writes into
 * application source directories, and never guesses an unrelated repository's
 * work item: a plan outside `work-items/` gets its own neutral root.
 */
function resolveEvidenceRoot({ workItem, planFile, workspace, cwd = process.cwd() } = {}) {
  if (workItem) return path.resolve(workItem, 'evidence', 'design', 'captures');
  const fromEnv = process.env.ECC_CANVAS_WORK_ITEM;
  if (fromEnv && String(fromEnv).trim()) {
    return path.resolve(String(fromEnv).trim(), 'evidence', 'design', 'captures');
  }
  if (planFile) {
    // <work-item>/plan/<file> or <work-item>/evidence/<file> — walk up to the
    // directory that sits directly under `work-items/`.
    let dir = path.dirname(path.resolve(planFile));
    for (let i = 0; i < 5; i += 1) {
      if (path.basename(path.dirname(dir)) === 'work-items') {
        return path.join(dir, 'evidence', 'design', 'captures');
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    // No work item owns this plan. Prefer the session's own workspace over the
    // daemon's cwd: a capture must never land in whatever repo the daemon
    // happened to be started from.
    const anchor = workspace ? path.resolve(workspace) : path.dirname(path.resolve(planFile));
    return path.join(anchor, '.ecc-opl', 'work-items', '_canvas-captures', 'evidence', 'design', 'captures');
  }
  return path.join(cwd, '.ecc-opl', 'work-items', '_canvas-captures', 'evidence', 'design', 'captures');
}

// --- manifest ---------------------------------------------------------------

/**
 * An entry is usable only when it is self-consistent: the id is the content
 * address of the hash, and the relative path cannot be absolute. Bytes are
 * always read through `relPath` under the evidence root; `file` is informational.
 */
function isValidManifestEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  const id = String(entry.id == null ? '' : entry.id);
  const sha = String(entry.sha256 == null ? '' : entry.sha256);
  if (!CAP_ID.test(id) || !SHA256_HEX.test(sha)) return false;
  if (id !== `cap-${sha.slice(0, 12)}`) return false;
  const rel = entry.relPath;
  return typeof rel === 'string' && rel.length > 0 && !path.isAbsolute(rel) && !rel.split(/[\\/]/).includes('..');
}

function readManifest(root) {
  const file = path.join(root, 'manifest.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(parsed.captures)) return { captures: [] };
    return { captures: parsed.captures.filter(isValidManifestEntry) };
  } catch {
    return { captures: [] };
  }
}

function writeManifest(root, manifest) {
  fs.mkdirSync(root, { recursive: true });
  const file = path.join(root, 'manifest.json');
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2));
  // An interrupted write must not leave a half file that readManifest would
  // silently reset to an empty list.
  fs.renameSync(tmp, file);
}

function appendManifest(root, entry) {
  const manifest = readManifest(root);
  // One row per artefact id; re-capturing the same combination replaces the
  // pointer instead of growing the file forever.
  manifest.captures = manifest.captures.filter(c => c.id !== entry.id).concat(entry);
  writeManifest(root, manifest);
  return manifest;
}

// --- page-side probes ------------------------------------------------------
// Runs inside the preview page. Kept as source strings so nothing is
// transmitted that the browser would otherwise reject.

const PROBE_SCROLL = `(() => {
  const doc = document.scrollingElement || document.documentElement;
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (!/(auto|scroll)/.test(cs.overflowY)) continue;
    const hidden = el.scrollHeight - el.clientHeight;
    if (hidden <= 4) continue;
    if (el === doc || el === document.body || el === document.documentElement) continue;
    const sel = el.id ? '#' + el.id
      : el.getAttribute('data-testid') ? '[data-testid="' + el.getAttribute('data-testid') + '"]'
      : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string'
          ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '');
    out.push({ selector: sel, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, hidden });
    if (out.length >= 8) break;
  }
  const fixed = document.querySelectorAll('body *');
  let sticky = 0;
  for (const el of fixed) {
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed' && el.offsetHeight > 0) sticky += 1;
  }
  const virtual = document.querySelector('[aria-rowcount]');
  const virtualRows = virtual ? Number(virtual.getAttribute('aria-rowcount')) : 0;
  const renderedRows = virtual ? virtual.querySelectorAll('[role="row"]').length : 0;
  return {
    documentHeight: doc.scrollHeight,
    viewportHeight: window.innerHeight,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    scrollContainers: out,
    fixedElements: sticky,
    virtualized: virtualRows && renderedRows && virtualRows > renderedRows * 1.5
      ? { declared: virtualRows, rendered: renderedRows } : null
  };
})()`;

// Scroll the whole document once so lazy content mounts, then restore the
// original scroll offset. Anything that still is not mounted is reported.
const PREPARE_FULL = `(async () => {
  const doc = document.scrollingElement || document.documentElement;
  const startX = window.scrollX;
  const startY = window.scrollY;
  const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
  for (let y = 0; y < doc.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise(r => setTimeout(r, 60));
  }
  window.scrollTo(0, doc.scrollHeight);
  await new Promise(r => setTimeout(r, 120));
  window.scrollTo(startX, startY);
  await new Promise(r => setTimeout(r, 60));
  return { startX, startY, height: doc.scrollHeight };
})()`;

// The preview SDK refuses to boot at top level (there is no canvas to drive),
// so the draft is replayed here instead of posted to it. Values and selectors
// were already filtered by draftItemsFromPending(), and the sheet is adopted in
// the throwaway capture context only.
const APPLY_DRAFT = `((items) => {
  const list = Array.isArray(items) ? items : [];
  const missing = [];
  let sheet = null;
  let applied = 0;
  try { sheet = new CSSStyleSheet(); } catch (_) { sheet = null; }
  for (const item of list) {
    let nodes = [];
    try { nodes = document.querySelectorAll(String(item.selector)); } catch (_) { nodes = []; }
    if (!nodes.length) { missing.push(String(item.selector)); continue; }
    if (sheet) {
      const rule = String(item.selector) + '{' + String(item.prop) + ':' + String(item.value) + ' !important}';
      try { sheet.insertRule(rule, sheet.cssRules.length); applied += 1; } catch (_) { missing.push(String(item.selector)); }
    } else {
      nodes.forEach(n => { if (n && n.style) n.style.setProperty(String(item.prop), String(item.value), 'important'); });
      applied += 1;
    }
  }
  if (sheet && sheet.cssRules.length && document.adoptedStyleSheets) {
    document.adoptedStyleSheets = Array.prototype.slice.call(document.adoptedStyleSheets).concat([sheet]);
  }
  return { applied, rules: sheet ? sheet.cssRules.length : null, missing: missing.slice(0, 5) };
})`;

// --- capture steps ---------------------------------------------------------

async function openPage(page, url) {
  let error = null;
  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    .catch(e => { error = e; return null; });
  // A refused connection or a timeout used to be screenshotted as about:blank
  // and recorded as complete. A failed navigation is a failed capture.
  if (!response) {
    return {
      ok: false,
      code: 'NAVIGATION_FAILED',
      why: String(error && error.message || 'navigation returned no response').slice(0, 240)
    };
  }
  return { ok: true, response };
}

async function replayDraft(page, draftOverrides) {
  const list = draftItemsFromPending(draftOverrides);
  if (!list.length) {
    return {
      ok: false,
      code: 'NO_PENDING_OVERRIDES',
      why: 'a draft capture needs at least one valid pending override'
    };
  }
  const out = await page.evaluate(APPLY_DRAFT, list);
  await page.waitForTimeout(120);
  if (!out || !out.applied) {
    return {
      ok: false,
      code: 'DRAFT_REPLAY_FAILED',
      why: 'none of the pending selectors matched an element in the preview'
    };
  }
  const limitations = [{
    code: 'DRAFT_REPLAY',
    detail: `${out.applied}/${list.length} override(s) replayed inside the capture context`,
    verification: 'NOT_FINAL_EVIDENCE'
  }];
  if (out.applied < list.length) {
    limitations.push({
      code: 'DRAFT_REPLAY_PARTIAL',
      detail: `${list.length - out.applied} pending override(s) had no matching element`,
      missing: out.missing
    });
  }
  return { ok: true, limitations };
}

function probeLimitations(probe, mode) {
  const limitations = [];
  if (probe.scrollContainers.length) {
    limitations.push({
      code: 'PARTIAL_SCROLL_CONTAINER',
      detail: 'application scroll containers are captured at their visible height only',
      containers: probe.scrollContainers
    });
  }
  if (probe.fixedElements && mode === 'full') {
    limitations.push({
      code: 'FIXED_ELEMENTS', detail: `${probe.fixedElements} fixed element(s) may repeat or overlay in a tall capture`
    });
  }
  if (probe.virtualized) {
    limitations.push({
      code: 'VIRTUALIZED_LIST',
      detail: `list declares ${probe.virtualized.declared} rows but renders ${probe.virtualized.rendered}`
    });
  }
  return limitations;
}

async function shoot(page, mode, selector) {
  if (mode === 'element') {
    if (!selector) return { ok: false, code: 'NO_SELECTED_ELEMENT' };
    const locator = page.locator(selector).first();
    const box = await locator.boundingBox().catch(() => null);
    if (!box) return { ok: false, code: 'ELEMENT_NOT_FOUND', selector };
    const buffer = await locator.screenshot({ animations: 'disabled' });
    return {
      ok: true,
      buffer,
      elementBox: {
        x: Math.round(box.x), y: Math.round(box.y),
        width: Math.round(box.width), height: Math.round(box.height)
      }
    };
  }
  if (mode === 'full') {
    await page.evaluate(PREPARE_FULL);
    return { ok: true, buffer: await page.screenshot({ fullPage: true, animations: 'disabled' }) };
  }
  return { ok: true, buffer: await page.screenshot({ animations: 'disabled' }) };
}

function persistCapture({ url, vp, mode, source, state, theme, selector, evidenceRoot,
  section, revision, buffer, elementBox, limitations, errors, probe, response }) {
  const sha = crypto.createHash('sha256').update(buffer).digest('hex');
  const id = `cap-${sha.slice(0, 12)}`;
  const dir = path.join(
    evidenceRoot,
    safeSlug(section, 'section'), safeSlug(revision, 'revision'), vp.id
  );
  const fileName = [
    safeSlug(state || 'default', 'default'),
    safeSlug(theme || 'default', 'default'),
    mode,
    source
  ].join('__') + '.png';
  const file = path.join(dir, fileName);
  if (!within(evidenceRoot, file) || !within(evidenceRoot, dir)) {
    return { ok: false, code: 'EVIDENCE_PATH_ESCAPE', why: 'resolved capture path leaves the evidence root' };
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, buffer);

  const meta = {
    id,
    file,
    relPath: path.relative(evidenceRoot, file),
    section: section || null,
    revision: revision || null,
    route: new URL(url).pathname + new URL(url).search,
    url,
    mode,
    source,
    viewport: { id: vp.id, width: vp.width, height: vp.height, dpr: vp.dpr || DEFAULT_DPR },
    state: state || null,
    theme: theme || null,
    status: response ? response.status() : null,
    sha256: sha,
    bytes: buffer.length,
    width: mode === 'viewport' ? vp.width
      : (elementBox ? Math.round(elementBox.width * (vp.dpr || DEFAULT_DPR)) : null),
    result: mode === 'full' && (probe.scrollContainers.length || probe.virtualized) ? 'partial' : 'complete',
    capturedAt: new Date().toISOString(),
    limitations,
    consoleErrors: errors.slice(0, 5)
  };
  if (elementBox) meta.element = elementBox;
  if (mode === 'element') meta.selector = selector;

  appendManifest(evidenceRoot, meta);
  return { ok: true, capture: meta };
}

/**
 * One capture inside one fresh context. The browser is owned by the caller so a
 * batch launches Chromium once instead of once per combination.
 */
async function captureInContext(browser, options) {
  const {
    url, vp, mode = 'viewport', state = null, theme = null, selector = null,
    source = 'source-rendered', draftOverrides = [], evidenceRoot, section, revision
  } = options;
  const limitations = [];
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr || DEFAULT_DPR
  });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e).slice(0, 160)));

    const nav = await openPage(page, url);
    if (!nav.ok) return nav;

    // Give the app one frame to settle after network idle; cheap and avoids
    // capturing the pre-hydration skeleton.
    await page.waitForTimeout(150);

    if (source === 'visual-draft') {
      const draft = await replayDraft(page, draftOverrides);
      if (!draft.ok) return draft;
      limitations.push(...draft.limitations);
    }

    const probe = await page.evaluate(PROBE_SCROLL);
    limitations.push(...probeLimitations(probe, mode));

    const shot = await shoot(page, mode, selector);
    if (!shot.ok) return shot;

    return persistCapture({
      url, vp, mode, source, state, theme, selector, evidenceRoot, section, revision,
      buffer: shot.buffer, elementBox: shot.elementBox || null,
      limitations, errors, probe, response: nav.response
    });
  } finally {
    await context.close().catch(() => {});
  }
}

/**
 * Capture one artefact.
 *
 * mode: 'viewport' | 'full' | 'element'
 * source: 'source-rendered' (default) | 'visual-draft'
 */
async function captureOne(options) {
  const opts = options || {};
  const unavailable = captureUnavailable();
  if (unavailable) return { ok: false, ...unavailable };
  if (!opts.url) return { ok: false, code: 'NO_PREVIEW_URL' };
  const allowed = previewUrlAllowed(opts.url);
  if (!allowed.ok) return { ok: false, code: allowed.code, why: allowed.why };

  const ownsBrowser = !opts.browser;
  const browser = opts.browser || await loadChromium().launch();
  try {
    return await captureInContext(browser, Object.assign({}, opts, {
      vp: viewportFor(opts.viewport) || VIEWPORTS[0]
    }));
  } catch (error) {
    return { ok: false, code: 'CAPTURE_FAILED', why: String(error && error.message || error).slice(0, 240) };
  } finally {
    if (ownsBrowser) await browser.close().catch(() => {});
  }
}

/**
 * `shouldStop` is polled between jobs so an owner-triggered batch can be
 * cancelled; jobs already running finish rather than being torn down mid-write.
 */
async function captureBatch(items, shouldStop) {
  const list = Array.isArray(items) ? items.slice(0, MAX_BATCH) : [];
  const stop = typeof shouldStop === 'function' ? shouldStop : () => false;
  if (!list.length) {
    return { ok: false, total: 0, captured: 0, failed: 0, cancelled: false, results: [] };
  }
  const unavailable = captureUnavailable();
  if (unavailable) {
    return {
      ok: false, total: list.length, captured: 0, failed: list.length, cancelled: false,
      results: list.map(job => Object.assign({ combo: job.combo || null }, unavailable))
    };
  }

  const results = [];
  const queue = list.slice();
  const browser = await loadChromium().launch();
  try {
    async function worker() {
      for (;;) {
        if (stop()) return;
        const job = queue.shift();
        if (!job) return;
        results.push(Object.assign({ combo: job.combo || null }, await captureOne({ ...job, browser })));
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, worker));
  } finally {
    await browser.close().catch(() => {});
  }
  const okCount = results.filter(r => r.ok).length;
  return {
    ok: okCount === results.length && results.length > 0,
    total: list.length, captured: okCount, failed: results.length - okCount,
    cancelled: results.length < list.length,
    results
  };
}

/**
 * Draft overrides in the shape the capture replay accepts. Anything the preview
 * SDK would refuse is dropped here too, so a screenshot can never claim an
 * override that the live editor would not have applied.
 */
function draftItemsFromPending(pending) {
  const list = Array.isArray(pending) ? pending : [];
  return list
    .filter(p => p && typeof p.selector === 'string' && typeof p.prop === 'string')
    .filter(p => EDIT_PROPS.has(p.prop) && SAFE_VALUE.test(String(p.value)))
    // A selector reaches a document.querySelectorAll() and a CSS rule; braces
    // would let one escape the rule it is meant to build.
    .filter(p => p.selector.length > 0 && p.selector.length <= 300 && !/[{}<>]/.test(p.selector))
    .map(p => ({ selector: p.selector, prop: p.prop, value: String(p.value) }))
    .slice(0, 60);
}

module.exports = {
  VIEWPORTS,
  MAX_BATCH,
  captureUnavailable,
  captureOne,
  captureBatch,
  draftItemsFromPending,
  isValidManifestEntry,
  previewUrlAllowed,
  readManifest,
  resolveEvidenceRoot,
  safeSlug,
  viewportFor,
  within,
  writeManifest,
  urlWithReviewContext
};
