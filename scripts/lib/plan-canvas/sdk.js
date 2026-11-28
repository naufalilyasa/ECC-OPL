'use strict';

/**
 * Plan Canvas artifact SDK — the script injected into the reviewed artifact.
 *
 * The artifact runs in a sandboxed iframe without allow-same-origin, so this
 * script can only talk to the chrome via postMessage. It renders all of its
 * own UI inside a shadow root so it never annotates itself and never leaks
 * styles into the artifact.
 */

const { PROPS, MAX_AFTER } = require('./change-set');

function artifactSdkJs() {
  // Same allowlist as the server-side normalizer, interpolated at generation
  // time so an in-frame prop can never be accepted while the server rejects it.
  const editPropList = Array.from(PROPS).map(p => "'" + p + "'").join(', ');
  return `'use strict';
(() => {
  if (window.parent === window) return; // only meaningful inside the canvas
  if (window.__eccPlanCanvasSdk) return;
  window.__eccPlanCanvasSdk = true;

  // Inactive until the canvas chrome answers the ready handshake. A dev server
  // that serves this script for other reasons stays untouched.
  // mode: interact | annotate | edit. annotate mirrors mode === 'annotate'
  // so the existing annotation paths need no second condition.
  let mode = 'interact';
  let annotate = false;
  let acked = false;
  let card = null;

  // --- visual edit state --------------------------------------------------
  // Overrides live only in a constructable sheet in this document. Nothing is
  // serialized, so a reload removes every one of them by construction.
  let editCurrent = null;
  let editSeq = 0;
  let overlaySheet = null;
  let overlayStyleEl = null;
  let probeEl = null;
  let internalUntil = 0;
  const editTargets = new Map();   // targetId -> { targetId, el, selector, identity }
  const records = [];              // applied overrides, in order; last wins
  const redo = [];
  // shortcut: local undo depth capped at 400; the server caps submitted edits
  // at 500 anyway. Raise both together if owners want deeper undo.
  const MAX_LOCAL_RECORDS = 400;
  const EDIT_PROPS = new Set([${editPropList}]);
  const SIZE_PROPS = new Set(['width', 'height']);
  // A shorthand reads back as longhands; the shorthand itself is not what the
  // renderer reports. Only real CSS properties reach getComputedStyle.
  const READBACK = {
    'padding': ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
    'margin': ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
    'padding-inline': ['padding-left', 'padding-right'],
    'padding-block': ['padding-top', 'padding-bottom'],
    'margin-inline': ['margin-left', 'margin-right'],
    'margin-block': ['margin-top', 'margin-bottom'],
    'gap': ['row-gap', 'column-gap'],
    'border-width': ['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'],
    'border-color': ['border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'],
    'border-radius': ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius']
  };
  const PROBE_CSS = 'position:absolute;left:-9999px;top:0;width:1px;height:1px;visibility:hidden;pointer-events:none';

  const post = msg => window.parent.postMessage(msg, '*');

  // --- shadow-root UI host --------------------------------------------
  const host = document.createElement('div');
  host.setAttribute('data-ecc-plan-canvas', 'ui');
  host.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;z-index:2147483647';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = \`
  <style>
    :host{all:initial}
    .hl{position:fixed;pointer-events:none;border:1.5px solid #6885e8;background:rgba(104,133,232,0.12);border-radius:4px;display:none;z-index:2147483646;transition:all .06s ease-out}
    .selhint{position:absolute;display:none;z-index:2147483647;background:#101218;color:#dfe2e9;border:1px solid #272c3e;border-radius:6px;padding:4px 10px;font:600 11.5px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;cursor:pointer;box-shadow:0 8px 32px rgba(0,0,0,0.6)}
    .selhint:hover{border-color:#6885e8}
    .card{position:absolute;display:none;z-index:2147483647;width:300px;background:#101218;border:1px solid #272c3e;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.6);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#dfe2e9}
    .card h4{margin:0;padding:10px 12px 0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#80859a}
    .card .snippet{padding:4px 12px 0;font:10.5px 'SF Mono','Fira Code',monospace;color:#4acbbe;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .card textarea{display:block;width:calc(100% - 24px);margin:8px 12px;min-height:56px;resize:vertical;background:#13161e;border:1px solid #1d2130;border-radius:6px;color:#dfe2e9;font:12.5px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:7px 9px;outline:none;box-sizing:border-box}
    .card textarea:focus{border-color:#6885e8}
    .card .row{display:flex;justify-content:flex-end;gap:8px;padding:0 12px 12px}
    .card button{border-radius:6px;font:600 11.5px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:5px 12px;cursor:pointer}
    .card .cancel{background:none;border:1px solid #1d2130;color:#80859a}
    .card .cancel:hover{color:#dfe2e9;border-color:#272c3e}
    .card .queue{background:#6885e8;border:1px solid #6885e8;color:#fff}
    .card .queue:hover{background:#3d5ab8}
    .card .keys{padding:0 12px 10px;font-size:9.5px;color:#4c5168}
  </style>
  <div class="hl"></div>
  <button class="selhint" type="button">Annotate selection</button>
  <div class="card">
    <h4></h4>
    <div class="snippet"></div>
    <textarea placeholder="What should change here?"></textarea>
    <div class="row">
      <button class="cancel" type="button">Cancel</button>
      <button class="queue" type="button">Queue</button>
    </div>
    <div class="keys">Enter to queue &middot; Cmd/Ctrl+Enter to queue &amp; send</div>
  </div>\`;
  const attach = () => document.body ? document.body.appendChild(host) : null;
  if (document.body) attach();
  else document.addEventListener('DOMContentLoaded', attach);

  const hl = root.querySelector('.hl');
  const selhint = root.querySelector('.selhint');
  const cardEl = root.querySelector('.card');
  const cardTitle = cardEl.querySelector('h4');
  const cardSnippet = cardEl.querySelector('.snippet');
  const cardText = cardEl.querySelector('textarea');

  // --- selectors & context ---------------------------------------------
  const esc = v => (window.CSS && CSS.escape) ? CSS.escape(v) : v.replace(/[^a-zA-Z0-9_-]/g, '\\\\$&');
  function selectorFor(el) {
    const parts = [];
    let node = el;
    for (let depth = 0; node && node.nodeType === 1 && depth < 6; depth++) {
      if (node.id) { parts.unshift('#' + esc(node.id)); return parts.join(' > '); }
      const tag = node.tagName.toLowerCase();
      if (tag === 'body' || tag === 'html') { parts.unshift(tag); break; }
      let nth = 1;
      let sib = node;
      while ((sib = sib.previousElementSibling)) if (sib.tagName === node.tagName) nth++;
      parts.unshift(tag + ':nth-of-type(' + nth + ')');
      node = node.parentElement;
    }
    return parts.join(' > ');
  }
  function snippetFor(el) {
    return (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 200);
  }
  // Annotation mode owns every click, including controls: selecting a button
  // must not run the app action underneath. Interact mode is the toggle.
  const isOurs = el => el === host || host.contains(el);
  function nameFor(el) {
    const aria = el.getAttribute('aria-label')
      || (el.getAttribute('aria-labelledby') ? '' : '')
      || el.getAttribute('title');
    const text = (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();
    const fallback = el.getAttribute('placeholder') || el.getAttribute('name') || el.getAttribute('alt') || '';
    return (aria || text || fallback).slice(0, 120);
  }
  function contextFor(el) {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      selector: selectorFor(el),
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') || '',
      testId: el.getAttribute('data-testid') || '',
      name: nameFor(el),
      snippet: snippetFor(el),
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
      viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 },
      styles: {
        display: cs.display,
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight
      }
    };
  }

  // --- visual edit engine ------------------------------------------------
  // The chrome owns the inspector UI. This side owns the document: selection,
  // the override sheet, read-back, undo/redo/reset, revalidation.
  function safeValue(v) {
    return typeof v === 'string' && v.length > 0 && v.length <= ${MAX_AFTER} && !/[;{}<>]|[\\r\\n]/.test(v);
  }
  function ensureSheet() {
    if (overlaySheet) {
      // HMR can replace adoptedStyleSheets wholesale; re-adopt when lost.
      const list = Array.prototype.slice.call(document.adoptedStyleSheets || []);
      if (list.indexOf(overlaySheet) === -1 && document.adoptedStyleSheets) {
        document.adoptedStyleSheets = list.concat([overlaySheet]);
      }
      return overlaySheet;
    }
    try {
      overlaySheet = new CSSStyleSheet();
      document.adoptedStyleSheets = Array.prototype.slice.call(document.adoptedStyleSheets || []).concat([overlaySheet]);
      return overlaySheet;
    } catch (err) {
      if (!overlayStyleEl) {
        overlayStyleEl = document.createElement('style');
        overlayStyleEl.setAttribute('data-ecc-plan-canvas', 'overrides');
        (document.head || document.documentElement).appendChild(overlayStyleEl);
      }
      return overlayStyleEl;
    }
  }
  function renderOverrides() {
    internalUntil = Date.now() + 200;
    const sheet = ensureSheet();
    const byTarget = new Map();
    records.forEach(r => {
      if (!byTarget.has(r.targetId)) byTarget.set(r.targetId, []);
      byTarget.get(r.targetId).push(r);
    });
    let css = '';
    editTargets.forEach((t, targetId) => {
      if (!t || !t.el || !t.el.isConnected) return;
      t.el.setAttribute('data-ecc-edit', targetId);
      const sel = '[data-ecc-edit="' + targetId + '"]';
      // Transitions and animations outrank even !important declarations, so a
      // target with transition-all reports every override as ineffective while
      // the change animates, and each probe restarts the transition.
      css += sel + '{transition:none !important;animation:none !important}\\n';
      (byTarget.get(targetId) || []).forEach(r => {
        if (EDIT_PROPS.has(r.prop) && safeValue(r.value)) {
          css += sel + '{' + r.prop + ':' + r.value + ' !important}\\n';
        }
      });
    });
    if (overlaySheet && typeof overlaySheet.replaceSync === 'function') overlaySheet.replaceSync(css);
    else if (overlayStyleEl) overlayStyleEl.textContent = css;
  }
  function probe() {
    if (!probeEl || !probeEl.isConnected) {
      probeEl = document.createElement('div');
      (document.body || document.documentElement).appendChild(probeEl);
    }
    probeEl.style.cssText = PROBE_CSS;
    return probeEl;
  }
  function readValues(prop, el) {
    const props = READBACK[prop] || [prop];
    const cs = getComputedStyle(el);
    return props.map(p => cs.getPropertyValue(p).trim()).join('|');
  }
  // Canonical form of a declaration: apply it to the hidden probe and read back
  // what the renderer reports. Units, colours and functions all normalize the
  // same way they would on the target, and an invalid declaration is caught
  // because the browser refuses it (the probe keeps no value).
  // shortcut: the probe inherits from body, so a relative unit can normalize
  // differently on a target with another font context; upgrade to a probe
  // cloned beside the target if that shows up as a false negative.
  function canonical(prop, value, el) {
    const p = probe();              // cssText reset clears the previous value
    const longhands = READBACK[prop] || [prop];
    try { p.style.setProperty(prop, resolveVar(value, el)); } catch (err) { return null; }
    if (!p.style.getPropertyValue(prop)) return null;
    const cs = getComputedStyle(p);
    return longhands.map(x => cs.getPropertyValue(x).trim()).join('|');
  }
  // Honest read-back: true only when the rendered value is the requested one.
  // A rule that beats the override is reported as ineffective, never success.
  function effectivelyApplied(prop, value, el) {
    const want = canonical(prop, value, el);
    return Boolean(want) && want === readValues(prop, el);
  }
  function targetFor(el) {
    let found = null;
    editTargets.forEach(t => { if (t.el === el) found = t; });
    if (found) return found;
    const id = 'e' + (++editSeq);
    const ctx = contextFor(el);
    const t = {
      targetId: id,
      el,
      selector: ctx.selector,
      identity: { testId: ctx.testId, name: ctx.name, tag: ctx.tag }
    };
    editTargets.set(id, t);
    // Register the quieting rule now, so the baseline probe reads a settled
    // value instead of a mid-transition one.
    renderOverrides();
    return t;
  }
  function selectAt(el) {
    if (!el || isOurs(el) || el === document.body || el === document.documentElement) return;
    internalUntil = Date.now() + 200;
    hl.style.display = 'none';
    const t = targetFor(el);
    editCurrent = t;
    post({ type: 'pc:select', targetId: t.targetId, context: contextFor(el), rect: contextFor(el).rect });
  }
  function reportApplied(targetId, prop, value, computed, error) {
    post({
      type: 'pc:applied', targetId, prop, requested: value,
      computed: computed, declared: value, rendered: null,
      effective: false, error: error || null
    });
  }
  function applyOverride(targetId, prop, value) {
    const t = editTargets.get(targetId);
    const el = t && t.el;
    if (!t || !el || !el.isConnected) return reportApplied(targetId, prop, value, null, 'STALE_TARGET');
    if (!EDIT_PROPS.has(prop)) return reportApplied(targetId, prop, value, null, 'INVALID_PROP');
    if (!safeValue(value)) return reportApplied(targetId, prop, value, null, 'INVALID_VALUE');
    records.push({ targetId: targetId, prop: prop, value: value });
    if (records.length > MAX_LOCAL_RECORDS) records.splice(0, records.length - MAX_LOCAL_RECORDS);
    renderOverrides();
    // A freshly adopted stylesheet only takes effect on the next rendering
    // lifecycle in Chromium, so reading computed styles in the same task reports
    // the old value on large sheets (Tailwind) and turns a good edit into a fake
    // cascade conflict. Read back after two frames instead.
    const finalize = () => {
      if (!el.isConnected) { records.pop(); renderOverrides(); post({ type: 'pc:override-state', records: records.slice(), redo: redo.length }); return reportApplied(targetId, prop, value, null, 'STALE_TARGET'); }
      const after = readValues(prop, el);
      const effective = effectivelyApplied(prop, value, el);
      if (!effective) {
        // A declaration that did not render is not a pending edit. Keeping it
        // would let a bad value sit on top of a good one for the same property
        // and hide it from the pending list, or make undo restore junk.
        records.pop();
        renderOverrides();
        post({ type: 'pc:override-state', records: records.slice(), redo: redo.length });
      } else {
        redo.length = 0;
      }
      const rect = el.getBoundingClientRect();
      const rendered = SIZE_PROPS.has(prop) ? Math.round(prop === 'width' ? rect.width : rect.height) : null;
      post({
        type: 'pc:applied', targetId: targetId, prop: prop, requested: value,
        computed: after, declared: value, rendered: rendered, effective: effective
      });
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(finalize));
    else finalize();
  }
  function undoLast() {
    const r = records.pop();
    if (!r) return;
    redo.push(r);
    renderOverrides();
    post({ type: 'pc:override-state', records: records.slice(), redo: redo.length });
  }
  function redoLast() {
    const r = redo.pop();
    if (!r) return;
    records.push(r);
    renderOverrides();
    post({ type: 'pc:override-state', records: records.slice(), redo: redo.length });
  }
  function resetAll() {
    records.length = 0;
    redo.length = 0;
    internalUntil = Date.now() + 200;
    renderOverrides();
    // Keep data-ecc-edit: the attribute carries the transition:none quieting
    // rule, and dropping it makes the reset read-back land mid-transition.
    editCurrent = null;
    post({ type: 'pc:override-state', records: [], redo: 0 });
  }
  function probeTarget(targetId, props) {
    const t = editTargets.get(targetId);
    if (!t || !t.el || !t.el.isConnected) {
      return post({ type: 'pc:probe-result', targetId: targetId, values: null, error: 'STALE_TARGET' });
    }
    // Same rendering-lifecycle lag as apply: a probe that lands right after the
    // sheet is rewritten would report the previous value.
    const read = () => {
      if (!t.el || !t.el.isConnected) {
        return post({ type: 'pc:probe-result', targetId: targetId, values: null, error: 'STALE_TARGET' });
      }
      const cs = getComputedStyle(t.el);
      const values = {};
      (Array.isArray(props) ? props : []).forEach(p => {
        if (!EDIT_PROPS.has(p)) return;
        const longhands = READBACK[p] || [p];
        values[p] = longhands.map(x => cs.getPropertyValue(x).trim()).join(' ');
      });
      post({ type: 'pc:probe-result', targetId: targetId, values: values, rect: contextFor(t.el).rect });
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(read));
    else read();
  }
  function revalidate(ids) {
    const list = Array.isArray(ids) && ids.length ? ids : Array.from(editTargets.keys());
    const resolved = [];
    const stale = [];
    list.forEach(id => {
      const t = editTargets.get(id);
      if (!t) { stale.push({ targetId: id, reason: 'unknown' }); return; }
      let el = t.el;
      if (!el || !el.isConnected) {
        el = null;
        // A re-rendered component is a new element; a matching selector is not
        // identity. Only a matching testId may reattach automatically.
        if (t.identity.testId && t.selector) {
          const candidate = document.querySelector(t.selector);
          if (candidate && candidate.getAttribute('data-testid') === t.identity.testId) el = candidate;
        }
        if (el) {
          t.el = el;
          el.setAttribute('data-ecc-edit', id);
        }
      }
      if (el && el.isConnected) resolved.push({ targetId: id, rect: contextFor(el).rect });
      else {
        stale.push({ targetId: id, reason: 'missing' });
        // Release the detached node once no override still points at it.
        if (!records.some(r => r.targetId === id)) editTargets.delete(id);
      }
    });
    if (records.length) renderOverrides();
    post({ type: 'pc:targets', resolved: resolved, stale: stale });
  }
  // --- token candidates ---------------------------------------------------
  // A computed value matching a token is not proof the author used the token.
  // Authored means a rule that the element actually matches declares
  // var(--name) for this property. Everything else is a coincidence and needs
  // the owner's confirmation before it can reach source.
  function scanTokens(targetId, prop, value) {
    const t = editTargets.get(targetId);
    const el = t && t.el;
    if (!el || !el.isConnected || !safeValue(value)) {
      post({ type: 'pc:token-candidates', targetId: targetId, prop: prop, value: value, candidates: [] });
      return;
    }
    const longhands = READBACK[prop] || [prop];
    const seen = Object.create(null);
    const out = [];
    const push = (name, origin, selector) => {
      const k = origin + ':' + (name || '') + ':' + (selector || '');
      if (seen[k]) return;
      seen[k] = 1;
      out.push({ name: name || null, origin: origin, selector: selector || null });
    };
    function walk(rules) {
      Array.prototype.forEach.call(rules || [], rule => {
        if (rule.style) {
          let matches = false;
          try { matches = Boolean(rule.selectorText) && el.matches(rule.selectorText); } catch (err) { matches = false; }
          // A shorthand such as margin with a var() declares no longhand, so
          // both the shorthand and its longhands have to be read.
          const seenProps = Object.create(null);
          const readProps = [prop].concat(longhands).filter(x => {
            if (seenProps[x]) return false;
            seenProps[x] = 1;
            return true;
          });
          readProps.forEach(lh => {
            const declared = (rule.style.getPropertyValue(lh) || '').trim();
            if (!declared) return;
            const varMatch = /^var\\(\\s*(--[\\w-]+)\\s*\\)$/.exec(declared);
            if (varMatch) {
              // Only a rule this element matches is an authored reference.
              if (matches) push(varMatch[1], 'authored', rule.selectorText);
              return;
            }
            // A shorthand can embed the token among literals.
            const varRefs = declared.match(/var\\(\\s*--[\\w-]+\\s*\\)/g) || [];
            if (varRefs.length && matches) {
              varRefs.forEach(ref => {
                const name = /var\\(\\s*(--[\\w-]+)\\s*\\)/.exec(ref)[1];
                push(name, 'authored', rule.selectorText);
              });
              return;
            }
            if (declared === value.trim()) push(null, 'coincidental', rule.selectorText);
          });
        }
        if (rule.cssRules) walk(rule.cssRules);
      });
    }
    Array.prototype.forEach.call(document.styleSheets || [], sheet => {
      // Never scan our own override sheet: the var() we injected would come
      // back as an "authored" token.
      if (sheet.ownerNode === overlayStyleEl) return;
      let rules = null;
      // Cross-origin sheets throw here. Skipping is the only safe answer;
      // their contents are not readable.
      try { rules = sheet.cssRules; } catch (err) { return; }
      walk(rules);
    });
    post({ type: 'pc:token-candidates', targetId: targetId, prop: prop, value: value, candidates: out.slice(0, 8) });
  }
  // var() is resolved before the read-back so a token override is judged by the
  // value that actually rendered, not by the literal text of the rule.
  function resolveVar(value, el) {
    // shortcut: one nesting level; upgrade if calc(var()) chains are needed
    return String(value).replace(/var\\(\\s*(--[\\w-]+)\\s*\\)/g, (m, name) => {
      const v = getComputedStyle(el).getPropertyValue(name).trim();
      return v || m;
    });
  }
  // Report detached targets once per set change. A stale node no longer in the
  // document would otherwise fire on every mutation in body and be retained.
  let reportedStale = '';
  function watchDom() {
    if (!document.body || typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(() => {
      if (Date.now() < internalUntil) return;
      const dead = [];
      editTargets.forEach((t, id) => { if (t.el && !t.el.isConnected) dead.push(id); });
      const key = dead.sort().join(',');
      if (key === reportedStale) return;
      reportedStale = key;
      if (!key) return;
      post({ type: 'pc:dom-changed', reason: 'target-detached', targetIds: dead });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) watchDom();
  else document.addEventListener('DOMContentLoaded', watchDom);

  // --- annotation card ---------------------------------------------------
  function openCard(target) {
    card = target;
    cardTitle.textContent = target.kindLabel;
    cardSnippet.textContent = target.anchor.snippet || target.anchor.selector;
    cardText.value = '';
    cardEl.style.display = 'block';
    const x = Math.min(target.x, window.innerWidth - 320) + window.scrollX;
    const y = target.y + 12 + window.scrollY;
    cardEl.style.left = Math.max(8, x) + 'px';
    cardEl.style.top = y + 'px';
    cardText.focus();
  }
  function closeCard() {
    card = null;
    cardEl.style.display = 'none';
  }
  function queueCard(sendNow) {
    if (!card) return;
    const text = cardText.value.trim();
    if (!text) { cardText.focus(); return; }
    post({
      type: sendNow ? 'pc:queue-and-send' : 'pc:queue',
      item: { kind: 'annotation', text, anchor: card.anchor }
    });
    closeCard();
  }
  cardEl.querySelector('.cancel').addEventListener('click', closeCard);
  cardEl.querySelector('.queue').addEventListener('click', () => queueCard(false));
  cardText.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); queueCard(true); }
    else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); queueCard(false); }
    else if (e.key === 'Escape') closeCard();
  });

  // --- element hover / click ---------------------------------------------
  document.addEventListener('mousemove', e => {
    if ((mode !== 'annotate' && mode !== 'edit') || card) { hl.style.display = 'none'; return; }
    const el = e.target;
    if (!el || isOurs(el) || el === document.body || el === document.documentElement) {
      hl.style.display = 'none';
      return;
    }
    const rect = el.getBoundingClientRect();
    hl.style.display = 'block';
    hl.style.left = rect.left - 2 + 'px';
    hl.style.top = rect.top - 2 + 'px';
    hl.style.width = rect.width + 'px';
    hl.style.height = rect.height + 'px';
  }, true);

  document.addEventListener('click', e => {
    if (!acked) return;
    const el = e.target;
    // Edit mode owns the click too. Letting it through would run the app's own
    // handler while the owner is trying to select an element for editing.
    if (mode === 'edit') {
      if (isOurs(el)) return;
      e.preventDefault();
      e.stopPropagation();
      selectAt(el);
      return;
    }
    if (!annotate) return;
    if (isOurs(el)) return;
    if (card) { if (!cardEl.contains(e.composedPath()[0])) closeCard(); return; }
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return; // handled by selection flow
    if (el === document.body || el === document.documentElement) return;
    e.preventDefault();
    e.stopPropagation();
    hl.style.display = 'none';
    openCard({
      kindLabel: 'Annotate <' + el.tagName.toLowerCase() + '>',
      anchor: contextFor(el),
      x: e.clientX,
      y: e.clientY
    });
  }, true);

  // --- text selection -------------------------------------------------------
  document.addEventListener('mouseup', e => {
    if (!annotate || card || isOurs(e.target)) return;
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection ? String(selection).replace(/\\s+/g, ' ').trim() : '';
      if (!text || !selection.rangeCount) { selhint.style.display = 'none'; return; }
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      selhint.style.display = 'block';
      selhint.style.left = rect.left + window.scrollX + 'px';
      selhint.style.top = rect.bottom + 6 + window.scrollY + 'px';
      selhint.onclick = () => {
        selhint.style.display = 'none';
        const anchorNode = selection.anchorNode;
        const el = anchorNode && anchorNode.nodeType === 1 ? anchorNode : anchorNode && anchorNode.parentElement;
        openCard({
          kindLabel: 'Annotate selection',
          anchor: {
            selector: el ? selectorFor(el) : 'body',
            tag: 'text',
            snippet: text.slice(0, 200),
            textRange: { text: text.slice(0, 1000) }
          },
          x: rect.left,
          y: rect.bottom
        });
      };
    }, 0);
  }, true);
  document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) selhint.style.display = 'none';
  });

  // --- chrome bridge ---------------------------------------------------------
  window.addEventListener('message', e => {
    // Only the embedding canvas drives the SDK; a nested iframe inside the
    // previewed app must not.
    if (e.source !== window.parent) return;
    const msg = e.data || {};
    if (msg.type === 'pc:set-mode') {
      acked = true;
      // mode is the current protocol; annotate is the legacy one and stays
      // accepted so an older chrome cannot draw a dead overlay.
      const next = msg.mode === 'edit' || msg.mode === 'interact' || msg.mode === 'annotate'
        ? msg.mode
        : (msg.annotate ? 'annotate' : 'interact');
      mode = next;
      annotate = mode === 'annotate';
      if (mode !== 'annotate') { hl.style.display = 'none'; selhint.style.display = 'none'; closeCard(); }
    } else if (msg.type === 'pc:restore-scroll') {
      window.scrollTo(msg.x || 0, msg.y || 0);
    } else if (msg.type === 'pc:override') {
      applyOverride(msg.targetId, msg.prop, msg.value);
    } else if (msg.type === 'pc:undo') {
      undoLast();
    } else if (msg.type === 'pc:redo') {
      redoLast();
    } else if (msg.type === 'pc:reset' || msg.type === 'pc:clear-overrides') {
      // The chrome sends this only after the server acknowledged the change
      // set. A failed submission keeps every override for the retry.
      resetAll();
    } else if (msg.type === 'pc:probe') {
      probeTarget(msg.targetId, msg.props);
    } else if (msg.type === 'pc:revalidate') {
      revalidate(msg.targetIds);
    } else if (msg.type === 'pc:scan-tokens') {
      scanTokens(msg.targetId, msg.prop, msg.value);
    }
  });
  document.addEventListener('keydown', e => {
    if (!acked) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      post({ type: 'pc:toggle-mode' });
    } else if (e.key === 'Escape' && card) closeCard();
  }, true);

  let scrollTimer = null;
  window.addEventListener('scroll', () => {
    if (scrollTimer) return;
    scrollTimer = setTimeout(() => {
      scrollTimer = null;
      post({ type: 'pc:scroll', x: window.scrollX, y: window.scrollY });
    }, 150);
  }, { passive: true });

  post({ type: 'pc:ready' });
})();`;
}

module.exports = { artifactSdkJs };
