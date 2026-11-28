'use strict';

/**
 * Plan Canvas visual edit inspector — chrome side.
 *
 * Runs in the canvas chrome, never in the preview document. The preview SDK
 * owns the DOM and the overrides; this module draws property rows over the
 * postMessage protocol and keeps the pending list. Nothing here writes files.
 *
 * Injected into canvasClientJs() so it shares the existing `$`, `postToFrame`
 * and `boot` bindings; the whole block is inert unless the session was opened
 * with --edit-mode (no #inspector element otherwise).
 */
function editModeClientJs() {
  return `
  // --- visual edit inspector ---------------------------------------------
  const EDIT_FIELDS = [
    { prop: 'width', label: 'Width', group: 'Size' },
    { prop: 'height', label: 'Height', group: 'Size' },
    { prop: 'padding', label: 'Padding', group: 'Spacing' },
    { prop: 'margin', label: 'Margin', group: 'Spacing' },
    { prop: 'gap', label: 'Gap', group: 'Spacing' },
    { prop: 'background-color', label: 'Background', group: 'Fill' },
    { prop: 'color', label: 'Text color', group: 'Text' },
    { prop: 'font-size', label: 'Font size', group: 'Text' },
    { prop: 'font-weight', label: 'Weight', group: 'Text' },
    { prop: 'line-height', label: 'Line height', group: 'Text' },
    { prop: 'letter-spacing', label: 'Tracking', group: 'Text' },
    { prop: 'border-radius', label: 'Radius', group: 'Border' },
    { prop: 'border-width', label: 'Border', group: 'Border' },
    { prop: 'border-style', label: 'Border style', group: 'Border' },
    { prop: 'border-color', label: 'Border color', group: 'Border' },
    { prop: 'box-shadow', label: 'Shadow', group: 'Effect' },
    { prop: 'opacity', label: 'Opacity', group: 'Effect' }
  ];
  let editTarget = null;
  let editPending = [];
  let editInFlight = 0;              // overrides posted, not yet answered
  const editKey = (t, p) => t + ':' + p;
  const editSnapshots = new Map();   // targetId -> { context, values }
  const editBaseline = new Map();    // targetId:prop -> computed before the first override
  const editApplied = new Map();     // targetId:prop -> last pc:applied
  const editTokens = new Map();      // targetId:prop -> { name, origin }
  let editScope = 'instance';
  let scopeConfirmedBy = null;
  let editFrozen = null;             // { id } assigned at freeze, stable across retries
  let submitting = false;
  let ackNotice = '';                // survives the state sync that follows an ack

  function initEditMode() {
    const inspector = $('inspector');
    if (!inspector) return;
    const bodyEl = $('inspectorBody');
    const listEl = $('editList');
    const statusEl = $('editStatus');
    const nameEl = $('editTargetName');
    const undoBtn = $('editUndo');
    const redoBtn = $('editRedo');
    const resetBtn = $('editReset');
    let rows = new Map();
    let stale = false;

    function setStatus(text, bad) {
      statusEl.textContent = text || '';
      statusEl.classList.toggle('bad', Boolean(bad));
    }
    function renderList() {
      // One line per target+prop; the SDK applies them in order and the last
      // value wins, so the list shows the final value only.
      const last = new Map();
      editPending.forEach(r => last.set(editKey(r.targetId, r.prop), r));
      listEl.innerHTML = '';
      last.forEach(r => {
        const li = document.createElement('li');
        li.textContent = r.prop + ': ' + r.value;
        listEl.appendChild(li);
      });
      const count = listEl.childElementCount;
      // Read by the verdict guard above; a resolved change set must land
      // before the owner can approve the design it produced.
      window.__pcPendingEdits = count;
      // The SDK echoes state after an ack; that echo must not erase the "sent"
      // message the owner just saw.
      if (ackNotice) setStatus(ackNotice, false);
      else setStatus(count ? count + ' pending override' + (count === 1 ? '' : 's') : 'No overrides yet.', false);
      refreshApply();
    }
    function renderTarget() {
      if (!editTarget) {
        nameEl.textContent = 'Nothing selected';
        bodyEl.innerHTML = '<p class="edit-empty">Switch to Edit and click an element in the preview.</p>';
        rows = new Map();
        undoBtn.disabled = redoBtn.disabled = resetBtn.disabled = true;
        return;
      }
      const ctx = editTarget.context || {};
      nameEl.textContent = '<' + (ctx.tag || '?') + '>' + (ctx.testId ? ' #' + ctx.testId : '') + (ctx.name ? ' - ' + ctx.name : '');
      undoBtn.disabled = redoBtn.disabled = resetBtn.disabled = stale && !editPending.length;
    }
    function renderRows(values) {
      bodyEl.innerHTML = '';
      rows = new Map();
      let group = null;
      let groupEl = null;
      EDIT_FIELDS.forEach(field => {
        if (field.group !== group) {
          group = field.group;
          groupEl = document.createElement('div');
          groupEl.className = 'edit-group';
          const h = document.createElement('div');
          h.className = 'edit-group-title';
          h.textContent = group;
          groupEl.appendChild(h);
          bodyEl.appendChild(groupEl);
        }
        const row = document.createElement('label');
        row.className = 'edit-row';
        row.dataset.prop = field.prop;
        const name = document.createElement('span');
        name.textContent = field.label;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = (values && values[field.prop]) || '';
        input.disabled = stale || submitting;
        input.addEventListener('change', () => {
          const value = input.value.trim();
          if (!value) return;
          if (!applyEdit(editTarget.targetId, field.prop, value)) return;
          editTokens.delete(editKey(editTarget.targetId, field.prop));
          // Raw values are looked up against the real stylesheets, so the
          // owner can pick the authored token instead of a literal.
          postToFrame({ type: 'pc:scan-tokens', targetId: editTarget.targetId, prop: field.prop, value: value });
        });
        row.appendChild(name);
        row.appendChild(input);
        groupEl.appendChild(row);
        rows.set(field.prop, row);
        // Candidate chips land here; only authored tokens are clickable.
        const chips = document.createElement('div');
        chips.className = 'edit-chips';
        chips.dataset.prop = field.prop;
        groupEl.appendChild(chips);
      });
    }
    function renderCandidates(msg) {
      const row = rows.get(msg.prop);
      const chips = row && row.parentNode
        ? row.parentNode.querySelector('.edit-chips[data-prop="' + msg.prop + '"]')
        : null;
      if (!chips) return;
      chips.innerHTML = '';
      const authored = (msg.candidates || []).filter(c => c.origin === 'authored');
      const coincidental = (msg.candidates || []).filter(c => c.origin !== 'authored');
      authored.slice(0, 4).forEach(c => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'edit-chip';
        b.textContent = c.name;
        b.title = 'Use this design token';
        b.addEventListener('click', () => {
          if (!applyEdit(msg.targetId, msg.prop, 'var(' + c.name + ')')) return;
          editTokens.set(editKey(msg.targetId, msg.prop), { name: c.name, origin: 'authored' });
        });
        chips.appendChild(b);
      });
      if (!authored.length && coincidental.length) {
        // Same rendered value, no authored reference. Keep token null and say so.
        const note = document.createElement('span');
        note.className = 'edit-chip-note';
        note.textContent = 'Same value as an existing rule; not an authored token.';
        chips.appendChild(note);
      }
    }
    function markConflict(prop, text) {
      const row = rows.get(prop);
      if (row) row.classList.add('conflict');
      setStatus(text, true);
    }
    function clearConflict(prop) {
      const row = rows.get(prop);
      if (row) row.classList.remove('conflict');
    }

    // --- freeze & submit -------------------------------------------------
    const applyBtn = $('editApply');
    function unitOf(value) {
      const m = /^(-?\\d+(?:\\.\\d+)?)(px|em|rem|%|vh|vw|pt|ch)$/.exec(String(value).trim());
      return m ? m[2] : null;
    }
    function routeFor() {
      const meta = boot.previewMeta || {};
      return meta.route || boot.previewUrl || location.href;
    }
    function viewportBlock() {
      let v = null;
      editSnapshots.forEach(s => { if (!v && s.context && s.context.viewport) v = s.context.viewport; });
      if (v) return { w: v.w, h: v.h, dpr: v.dpr };
      return { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 };
    }
    function buildTargets() {
      const byTarget = new Map();
      editPending.forEach(r => {
        if (!byTarget.has(r.targetId)) byTarget.set(r.targetId, new Map());
        // Last value per prop wins, matching the override sheet.
        byTarget.get(r.targetId).set(r.prop, r);
      });
      const targets = [];
      byTarget.forEach((byProp, targetId) => {
        const snap = editSnapshots.get(targetId) || {};
        const ctx = snap.context || {};
        const edits = [];
        byProp.forEach(r => {
          const key = editKey(targetId, r.prop);
          const applied = editApplied.get(key);
          const tok = editTokens.get(key) || null;
          edits.push({
            prop: r.prop,
            before: { authored: null, computed: editBaseline.get(key) || null },
            after: r.value,
            unit: unitOf(r.value),
            declared: r.value,
            rendered: applied && applied.rendered != null ? String(applied.rendered) : null,
            effective: applied ? applied.effective !== false : true,
            // change-set.js takes the token name plus its origin, not the chip object.
            token: tok ? tok.name : null,
            tokenOrigin: tok ? tok.origin : null
          });
        });
        if (!edits.length) return;
        targets.push({
          targetId: targetId,
          selector: ctx.selector,
          tag: ctx.tag || '',
          role: ctx.role || '',
          testId: ctx.testId || '',
          name: ctx.name || '',
          snippet: ctx.snippet || '',
          rect: ctx.rect || null,
          sourceHint: null,
          edits: edits
        });
      });
      return targets;
    }
    // Every override goes through here: an input blur, a token chip click and
    // anything added later. A chip used to post directly and skipped both the
    // in-flight counter and the stale/submitting guards.
    function applyEdit(targetId, prop, value) {
      if (submitting || stale) return false;
      if (!editTarget || targetId !== editTarget.targetId) return false;
      ackNotice = '';
      editInFlight += 1;
      postToFrame({ type: 'pc:override', targetId: targetId, prop: prop, value: value });
      return true;
    }
    function refreshApply() {
      if (!applyBtn) return;
      const pending = Number(window.__pcPendingEdits) || 0;
      applyBtn.disabled = submitting || stale || pending === 0 || editInFlight > 0;
      applyBtn.textContent = submitting ? 'Submitting...' : 'Apply to source';
    }
    async function submitEdits() {
      if (submitting) return;
      // A change still travelling to the frame is not in buildTargets() yet.
      if (editInFlight > 0) { setStatus('Waiting for the last change to render...', true); return; }
      const targets = buildTargets();
      if (!targets.length) { setStatus('No effective overrides to submit.', true); return; }
      // The id is assigned once at freeze and reused by every retry, so a
      // resubmitted batch is a duplicate, not a second change.
      if (!editFrozen) {
        editFrozen = { id: 'cs-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) };
      }
      const payload = {
        kind: 'edits',
        text: '',
        clientId: editFrozen.id,
        changeSet: {
          id: editFrozen.id,
          version: 1,
          session: boot.key,
          route: routeFor(),
          preview: {
            mode: boot.previewMode || 'standalone-html',
            framework: (boot.previewMeta || {}).framework || null,
            section: (boot.previewMeta || {}).section || null,
            revision: (boot.previewMeta || {}).revision || null,
            revisionDigest: (boot.previewMeta || {}).revisionDigest || null,
            designDigest: (boot.previewMeta || {}).designDigest || null
          },
          viewport: viewportBlock(),
          breakpoint: null,
          scope: editScope,
          scopeConfirmedBy: editScope === 'instance' ? null : scopeConfirmedBy,
          targets: targets
        }
      };
      const frozenId = editFrozen.id;
      submitting = true;
      refreshApply();
      setStatus('Submitting to your agent...');
      try {
        const res = await fetch('/api/session/' + boot.key + '/feedback', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ items: [payload] })
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || ('HTTP ' + res.status));
        const accepted = Array.isArray(body.acceptedIds) ? body.acceptedIds : [];
        const rejected = (body.rejected || [])[0];
        // A duplicate id means the server already holds this exact change set
        // (an earlier attempt landed but the response was lost). That is an
        // acknowledgement, not a refusal.
        const acknowledged = accepted.indexOf(frozenId) !== -1 ||
          (rejected && rejected.reason === 'DUPLICATE_CHANGE_SET');
        if (acknowledged) {
          // Acknowledged. Only now is the preview state no longer the truth:
          // clear the overrides so verification sees real source output.
          postToFrame({ type: 'pc:clear-overrides' });
          editPending = [];
          editBaseline.clear();
          editApplied.clear();
          editTokens.clear();
          editFrozen = null;
          ackNotice = 'Sent. Your agent is updating source.';
          renderList();
        } else {
          ackNotice = '';
          setStatus('Not accepted: ' + ((rejected && rejected.reason) || 'unknown') + '. Edits kept for retry.', true);
        }
      } catch (err) {
        // Network or server failure is not an application. Nothing is cleared.
        ackNotice = '';
        setStatus('Submission failed: ' + err.message + '. Edits kept for retry.', true);
      } finally {
        submitting = false;
        refreshApply();
      }
    }
    if (applyBtn) applyBtn.addEventListener('click', submitEdits);

    window.addEventListener('message', e => {
      if (e.source !== frame.contentWindow) return;
      const msg = e.data || {};
      if (msg.type === 'pc:select') {
        editTarget = { targetId: msg.targetId, context: msg.context || {} };
        editSnapshots.set(msg.targetId, { context: msg.context || {}, values: {} });
        stale = false;
        renderTarget();
        postToFrame({ type: 'pc:probe', targetId: msg.targetId, props: EDIT_FIELDS.map(f => f.prop) });
      } else if (msg.type === 'pc:probe-result') {
        if (!editTarget || msg.targetId !== editTarget.targetId) return;
        if (msg.error) { setStatus('The selected element was replaced. Reselect it.', true); return; }
        const values = msg.values || {};
        const snap = editSnapshots.get(msg.targetId);
        if (snap) snap.values = values;
        // First read for a prop is the pre-edit truth. Later probes see the
        // override, so they must not overwrite the baseline.
        Object.keys(values).forEach(prop => {
          const key = editKey(msg.targetId, prop);
          if (!editBaseline.has(key)) editBaseline.set(key, values[prop]);
        });
        renderRows(values);
        refreshApply();
      } else if (msg.type === 'pc:token-candidates') {
        if (!editTarget || msg.targetId !== editTarget.targetId) return;
        renderCandidates(msg);
      } else if (msg.type === 'pc:applied') {
        // A reply can land after the owner selected another element. Settle the
        // counter and the record anyway, or Apply stays locked for good.
        if (editInFlight > 0) editInFlight -= 1;
        const key = editKey(msg.targetId, msg.prop);
        editApplied.set(key, msg);
        const selected = Boolean(editTarget && msg.targetId === editTarget.targetId);
        if (msg.error) {
          if (selected) markConflict(msg.prop, 'Could not apply ' + msg.prop + ': ' + msg.error + '.');
        } else if (!msg.effective) {
          // The SDK rolled the failed declaration back; the pending list is
          // reconciled by the pc:override-state that follows.
          if (selected) markConflict(msg.prop, msg.prop + ' stays at ' + msg.computed + ' - another rule wins.');
        } else {
          if (selected) clearConflict(msg.prop);
          const existing = editPending.filter(r => editKey(r.targetId, r.prop) !== key);
          existing.push({ targetId: msg.targetId, prop: msg.prop, value: msg.requested });
          editPending = existing;
          renderList();
        }
        refreshApply();
      } else if (msg.type === 'pc:override-state') {
        editPending = (msg.records || []).map(r => ({ targetId: r.targetId, prop: r.prop, value: r.value }));
        // The record list is authoritative: token metadata survives only while a
        // record with that key still carries the same var() value.
        const alive = new Map(editPending.map(r => [editKey(r.targetId, r.prop), r.value]));
        editTokens.forEach((tok, k) => {
          if (alive.get(k) !== 'var(' + tok.name + ')') editTokens.delete(k);
        });
        if (!msg.records || !msg.records.length) editApplied.clear();
        if (!stale) renderList();
        if (editTarget) {
          postToFrame({ type: 'pc:probe', targetId: editTarget.targetId, props: EDIT_FIELDS.map(f => f.prop) });
        }
        refreshApply();
      } else if (msg.type === 'pc:targets') {
        const list = msg.stale || [];
        const pendingStale = list.filter(s => editPending.some(r => r.targetId === s.targetId));
        if (editTarget && list.some(s => s.targetId === editTarget.targetId)) {
          stale = true;
          renderTarget();
        }
        if (pendingStale.length) {
          setStatus('Some edited elements were replaced by the app. Reselect and re-apply them.', true);
        } else if (stale) {
          setStatus('The element was replaced by a reload. Reselect it to continue.', true);
        }
        refreshApply();
      } else if (msg.type === 'pc:dom-changed') {
        // The app re-rendered. Only targets that actually detached get marked.
        const ids = editPending.map(r => r.targetId);
        if (editTarget) ids.push(editTarget.targetId);
        postToFrame({ type: 'pc:revalidate', targetIds: Array.from(new Set(ids)) });
      } else if (msg.type === 'pc:ready') {
        // The preview document was rebuilt: memory-only overrides are gone with
        // it. Say so instead of leaving a pending list that no longer exists.
        if (editPending.length) {
          editPending = [];
          editBaseline.clear();
          editApplied.clear();
          editTokens.clear();
          editFrozen = null;
          ackNotice = '';
          stale = true;
          renderTarget();
          renderList();
          refreshApply();
          setStatus('Preview reloaded. Pending visual edits were cleared by the reload; re-apply them.', true);
        }
      }
    });

    undoBtn.addEventListener('click', () => {
      if (submitting) return;
      ackNotice = '';
      postToFrame({ type: 'pc:undo' });
    });
    redoBtn.addEventListener('click', () => {
      if (submitting) return;
      ackNotice = '';
      postToFrame({ type: 'pc:redo' });
    });
    const scopeEl = $('editScope');
    if (scopeEl) {
      scopeEl.addEventListener('change', () => {
        const next = scopeEl.value;
        if (next === editScope) return;
        if (next !== 'instance') {
          // Changing the shared primitive is not an instance edit. It needs an
          // explicit yes here and an explicit scope in the change set.
          const ok = window.confirm('This changes the shared component, not just this instance. Continue?');
          if (!ok) { scopeEl.value = editScope; return; }
          scopeConfirmedBy = 'owner';
        } else {
          scopeConfirmedBy = null;
        }
        editScope = next;
        setStatus(next === 'instance' ? 'Scope: this instance.' : 'Scope: shared component, confirmed.', false);
      });
    }
    resetBtn.addEventListener('click', () => {
      if (submitting) return;
      postToFrame({ type: 'pc:reset' });
      ackNotice = '';
      editPending = [];
      editBaseline.clear();
      editApplied.clear();
      editTokens.clear();
      editFrozen = null;
      renderList();
      if (editTarget) postToFrame({ type: 'pc:probe', targetId: editTarget.targetId, props: EDIT_FIELDS.map(f => f.prop) });
    });

    // No verdict while an override still exists only in the preview: approving
    // it would certify something the source does not render.
    document.addEventListener('click', e => {
      if (!e.target || !e.target.closest) return;
      if (!e.target.closest('#approve, #changes')) return;
      // An override posted on input blur may still be in flight.
      if (!editPending.length && !editInFlight) return;
      e.preventDefault();
      e.stopPropagation();
      setStatus('Apply or reset the pending visual edits before sending a verdict.', true);
    }, true);

    renderTarget();
    renderList();
    refreshApply();
  }
  if (boot.editMode) initEditMode();
`;
}

module.exports = { editModeClientJs };
