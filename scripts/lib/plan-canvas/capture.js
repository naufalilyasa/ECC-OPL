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

/**
 * The reviewed state is reproduced by the preview's own parameter names, so
 * whichever adapter the app already uses decides how a state is requested.
 * Nothing is rewritten in the DOM.
 */
function urlWithReviewContext(url, { state, theme, stateParam, themeParam } = {}) {
  if (!url) return url;
  let parsed;
  try { parsed = new URL(url); } catch { return url; }
  if (state && stateParam) parsed.searchParams.set(stateParam, state);
  if (theme && themeParam) parsed.searchParams.set(themeParam, theme);
  return parsed.toString();
}

function safeSlug(value, fallback) {
  const text = String(value == null ? '' : value).trim();
  if (!text) return fallback;
  return text.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || fallback;
}

/**
 * Where retained evidence lives. Explicit > explicit env > the active work item
 * that contains the session's plan file > a neutral fallback. Never writes into
 * application source directories.
 */
function resolveEvidenceRoot({ workItem, planFile, cwd = process.cwd() } = {}) {
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
  }
  const local = path.join(cwd, '.ecc-opl', 'work-items');
  try {
    const entries = fs.readdirSync(local, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('_'))
      .map(e => ({ name: e.name, mtime: fs.statSync(path.join(local, e.name)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    if (entries.length) return path.join(local, entries[0].name, 'evidence', 'design', 'captures');
  } catch { /* no work items yet */ }
  return path.join(cwd, '.ecc-opl', 'work-items', '_canvas-captures', 'evidence', 'design', 'captures');
}

function readManifest(root) {
  const file = path.join(root, 'manifest.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(parsed.captures) ? parsed : { captures: [] };
  } catch {
    return { captures: [] };
  }
}

function writeManifest(root, manifest) {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2));
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

// Replay draft overrides through the preview SDK's own override sheet. Only
// selectors and values travel; no styling rule is authored here.
const APPLY_DRAFT = `((items) => {
  const list = Array.isArray(items) ? items : [];
  window.postMessage({ type: 'pc:apply-draft', items: list }, '*');
  return list.length;
})`;

async function openPage(browser, url, vp) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr || DEFAULT_DPR
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 160)));
  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => null);
  return { context, page, response, errors };
}

/**
 * Capture one artefact.
 *
 * mode: 'viewport' | 'full' | 'element'
 * source: 'source-rendered' (default) | 'visual-draft'
 */
async function captureOne(options) {
  const {
    url, session, mode = 'viewport', viewport = 'desktop-1440',
    state = null, theme = null, selector = null, source = 'source-rendered',
    draftOverrides = [], evidenceRoot, section, revision, browserLimit
  } = options || {};

  const unavailable = captureUnavailable();
  if (unavailable) return { ok: false, ...unavailable };
  if (!url) return { ok: false, code: 'NO_PREVIEW_URL' };
  const vp = viewportFor(viewport) || VIEWPORTS[0];

  const chromium = loadChromium();
  const browser = await chromium.launch();
  const limitations = [];
  try {
    const { context, page, response, errors } = await openPage(browser, url, vp);
    try {
      // Give the app one frame to settle after network idle; cheap and avoids
      // capturing the pre-hydration skeleton.
      await page.waitForTimeout(150);

      if (source === 'visual-draft') {
        if (!draftOverrides.length) {
          limitations.push({ code: 'NO_PENDING_OVERRIDES', detail: 'no temporary overrides were applied' });
        } else {
          const applied = await page.evaluate(APPLY_DRAFT, draftOverrides);
          await page.waitForTimeout(120);
          limitations.push({
            code: 'DRAFT_REPLAY', detail: `${applied} override(s) replayed through the preview SDK`,
            verification: 'NOT_FINAL_EVIDENCE'
          });
        }
      }

      const probe = await page.evaluate(PROBE_SCROLL);
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

      let buffer;
      let resultStatus = 'complete';
      let elementBox = null;
      if (mode === 'element') {
        if (!selector) return { ok: false, code: 'NO_SELECTED_ELEMENT' };
        const locator = page.locator(selector).first();
        const box = await locator.boundingBox().catch(() => null);
        if (!box) {
          return { ok: false, code: 'ELEMENT_NOT_FOUND', selector };
        }
        buffer = await locator.screenshot({ animations: 'disabled' });
        elementBox = {
          x: Math.round(box.x), y: Math.round(box.y),
          width: Math.round(box.width), height: Math.round(box.height)
        };
      } else if (mode === 'full') {
        await page.evaluate(PREPARE_FULL);
        buffer = await page.screenshot({ fullPage: true, animations: 'disabled' });
        if (probe.scrollContainers.length || probe.virtualized) resultStatus = 'partial';
      } else {
        buffer = await page.screenshot({ animations: 'disabled' });
      }

      const sha = crypto.createHash('sha256').update(buffer).digest('hex');
      const id = 'cap-' + sha.slice(0, 12);
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
        result: resultStatus,
        capturedAt: new Date().toISOString(),
        limitations,
        consoleErrors: errors.slice(0, 5)
      };
      if (elementBox) meta.element = elementBox;
      if (mode === 'element') meta.selector = selector;

      appendManifest(evidenceRoot, meta);
      return { ok: true, capture: meta };
    } finally {
      await context.close().catch(() => {});
    }
  } catch (error) {
    return { ok: false, code: 'CAPTURE_FAILED', why: String(error && error.message || error).slice(0, 240) };
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * `shouldStop` is polled between jobs so an owner-triggered batch can be
 * cancelled; jobs already running finish rather than being torn down mid-write.
 */
async function captureBatch(items, shouldStop) {
  const list = Array.isArray(items) ? items.slice(0, MAX_BATCH) : [];
  const results = [];
  const queue = list.slice();
  const stop = typeof shouldStop === 'function' ? shouldStop : () => false;
  async function worker() {
    for (;;) {
      if (stop()) return;
      const job = queue.shift();
      if (!job) return;
      results.push(Object.assign({ combo: job.combo || null }, await captureOne(job)));
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length || 1) }, worker));
  const okCount = results.filter(r => r.ok).length;
  return {
    ok: okCount === results.length && results.length > 0,
    total: list.length, captured: okCount, failed: results.length - okCount,
    cancelled: results.length < list.length,
    results
  };
}

/** Draft overrides in the shape the preview SDK replays. */
function draftItemsFromPending(pending) {
  const list = Array.isArray(pending) ? pending : [];
  return list
    .filter(p => p && typeof p.selector === 'string' && typeof p.prop === 'string')
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
  resolveEvidenceRoot,
  readManifest,
  viewportFor,
  urlWithReviewContext
};
