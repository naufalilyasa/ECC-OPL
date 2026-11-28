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
  // kind: 'length' gets slider + exact input + unit select, 'number' a slider
  // and an exact input, 'color' a picker plus a text field for rgb()/keywords,
  // 'select' a fixed option list, 'text' the raw value only.
  const EDIT_FIELDS = [
    { prop: 'width', label: 'Width', group: 'Size', kind: 'length', min: 0, max: 1600, step: 1, unit: 'px' },
    { prop: 'height', label: 'Height', group: 'Size', kind: 'length', min: 0, max: 1200, step: 1, unit: 'px' },
    { prop: 'padding', label: 'Padding', group: 'Spacing', kind: 'length', min: 0, max: 240, step: 1, unit: 'px' },
    { prop: 'margin', label: 'Margin', group: 'Spacing', kind: 'length', min: -240, max: 240, step: 1, unit: 'px' },
    { prop: 'gap', label: 'Gap', group: 'Spacing', kind: 'length', min: 0, max: 160, step: 1, unit: 'px' },
    { prop: 'background-color', label: 'Background', group: 'Fill', kind: 'color' },
    { prop: 'color', label: 'Text color', group: 'Text', kind: 'color' },
    { prop: 'font-size', label: 'Font size', group: 'Text', kind: 'length', min: 8, max: 96, step: 1, unit: 'px' },
    { prop: 'font-weight', label: 'Weight', group: 'Text', kind: 'number', min: 100, max: 900, step: 100 },
    { prop: 'line-height', label: 'Line height', group: 'Text', kind: 'number', min: 0.8, max: 3, step: 0.05 },
    { prop: 'letter-spacing', label: 'Tracking', group: 'Text', kind: 'length', min: -4, max: 16, step: 0.25, unit: 'px' },
    { prop: 'border-radius', label: 'Radius', group: 'Border', kind: 'length', min: 0, max: 200, step: 1, unit: 'px' },
    { prop: 'border-width', label: 'Border', group: 'Border', kind: 'length', min: 0, max: 24, step: 1, unit: 'px' },
    { prop: 'border-style', label: 'Border style', group: 'Border', kind: 'select', options: ['none', 'solid', 'dashed', 'dotted'] },
    { prop: 'border-color', label: 'Border color', group: 'Border', kind: 'color' },
    { prop: 'box-shadow', label: 'Shadow', group: 'Effect', kind: 'text' },
    { prop: 'opacity', label: 'Opacity', group: 'Effect', kind: 'number', min: 0, max: 1, step: 0.05 }
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
    const breadcrumbEl = $('editBreadcrumb');
    const undoBtn = $('editUndo');
    const redoBtn = $('editRedo');
    const resetBtn = $('editReset');
    let rows = new Map();
    // Stale is per target: reloading one element must not mark an unrelated,
    // still-live selection unusable.
    const staleTargets = new Set();
    const targetStale = t => Boolean(t) && staleTargets.has(t);

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
        const snapshot = editSnapshots.get(r.targetId) || {};
        const ctx = snapshot.context || {};
        const where = [ctx.tag, ctx.testId ? '#' + ctx.testId : '', ctx.name || '']
          .filter(Boolean).join(' ') || r.targetId;
        const before = editBaseline.get(editKey(r.targetId, r.prop));
        const li = document.createElement('li');
        const at = document.createElement('span');
        at.className = 'ei-where';
        at.textContent = where + ' \\u00b7 ' + r.prop;
        const from = document.createElement('span');
        from.className = 'ei-before';
        from.textContent = before == null ? '\\u2014' : String(before);
        const to = document.createElement('span');
        to.className = 'ei-after';
        to.textContent = String(r.value);
        li.appendChild(at);
        li.appendChild(from);
        li.appendChild(to);
        listEl.appendChild(li);
      });
      const count = last.size;
      // Read by the verdict guard above; a resolved change set must land
      // before the owner can approve the design it produced.
      window.__pcPendingEdits = count;
      // The screenshot drawer replays these into its own browser context for a
      // visual-draft capture. Selectors travel, not styling rules.
      window.__pcPendingOverrides = Array.from(last.values()).map(r => {
        const ctx = (editSnapshots.get(r.targetId) || {}).context || {};
        return { targetId: r.targetId, selector: ctx.selector || null, prop: r.prop, value: String(r.value) };
      }).filter(r => r.selector);
      // The SDK echoes state after an ack; that echo must not erase the "sent"
      // message the owner just saw.
      if (ackNotice) setStatus(ackNotice, false);
      else setStatus(count ? count + ' pending override' + (count === 1 ? '' : 's') : 'No overrides yet.', false);
      refreshApply();
    }
    function renderTarget() {
      if (!editTarget) {
        breadcrumbEl.textContent = '';
        nameEl.textContent = 'Nothing selected';
        bodyEl.innerHTML = '<p class="edit-empty">Switch to Edit and click an element in the preview.</p>';
        rows = new Map();
        undoBtn.disabled = redoBtn.disabled = resetBtn.disabled = true;
        return;
      }
      const ctx = editTarget.context || {};
      breadcrumbEl.textContent = Array.isArray(ctx.path) && ctx.path.length ? ctx.path.join(' \\u203a ') : '';
      nameEl.textContent = '<' + (ctx.tag || '?') + '>' + (ctx.testId ? ' #' + ctx.testId : '') + (ctx.name ? ' - ' + ctx.name : '');
      undoBtn.disabled = redoBtn.disabled = resetBtn.disabled = targetStale(editTarget.targetId) && !editPending.length;
    }
    // #rrggbb for the native color picker; value arrives as rgb() from computed
    // style, or already hex from an override.
    function toHex(value) {
      const m = /^rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/.exec(String(value || ''));
      if (!m) return /^#[0-9a-f]{3,8}$/i.test(String(value || '')) ? value : '#000000';
      return '#' + [1, 2, 3].map(i => Number(m[i]).toString(16).padStart(2, '0')).join('');
    }
    function renderRows(values) {
      bodyEl.innerHTML = '';
      rows = new Map();
      let group = null;
      let groupEl = null;
      EDIT_FIELDS.forEach(field => {
        if (field.group !== group) {
          group = field.group;
          // Collapsible: <details> keeps keyboard and screen-reader behaviour
          // without any toggle code.
          groupEl = document.createElement('details');
          groupEl.className = 'edit-group';
          groupEl.open = true;
          const summary = document.createElement('summary');
          summary.textContent = group;
          groupEl.appendChild(summary);
          const groupBody = document.createElement('div');
          groupBody.className = 'edit-group-body';
          groupEl.appendChild(groupBody);
          bodyEl.appendChild(groupEl);
          groupEl = groupBody;
        }
        const row = document.createElement('div');
        row.className = 'edit-row';
        row.dataset.prop = field.prop;
        const name = document.createElement('span');
        name.className = 'edit-row-label';
        name.textContent = field.label;
        row.appendChild(name);
        const current = (values && values[field.prop]) || '';
        const commit = value => {
          const v = String(value || '').trim();
          if (!v) return;
          if (!applyEdit(editTarget.targetId, field.prop, v)) return;
          editTokens.delete(editKey(editTarget.targetId, field.prop));
          // Raw values are looked up against the real stylesheets, so the
          // owner can pick the authored token instead of a literal.
          postToFrame({ type: 'pc:scan-tokens', targetId: editTarget.targetId, prop: field.prop, value: v });
        };
        let unitSel = null;
        if (field.kind === 'length' || field.kind === 'number') {
          const range = document.createElement('input');
          range.type = 'range';
          range.className = 'edit-range';
          range.min = String(field.min);
          range.max = String(field.max);
          range.step = String(field.step || 1);
          const numeric = parseFloat(current);
          range.value = String(Number.isFinite(numeric) ? numeric : field.min);
          range.disabled = submitting || targetStale(editTarget.targetId);
          const text = document.createElement('input');
          text.type = 'text';
          text.className = 'edit-value';
          text.value = current;
          text.disabled = range.disabled;
          range.addEventListener('input', () => {
            text.value = range.value + (field.kind === 'length' && unitSel && unitSel.value !== 'auto' ? unitSel.value : '');
          });
          range.addEventListener('change', () => commit(text.value));
          text.addEventListener('change', () => commit(text.value));
          row.appendChild(range);
          row.appendChild(text);
          if (field.kind === 'length') {
            const unit = document.createElement('select');
            unit.className = 'edit-unit';
            ['px', 'rem', 'em', '%', 'auto'].forEach(u => {
              const opt = document.createElement('option');
              opt.value = u;
              opt.textContent = u;
              unit.appendChild(opt);
            });
            unit.disabled = range.disabled;
            unit.addEventListener('change', () => {
              if (unit.value === 'auto') { text.value = 'auto'; commit('auto'); return; }
              const num = parseFloat(text.value);
              text.value = (Number.isFinite(num) ? num : 0) + unit.value;
              commit(text.value);
            });
            unitSel = unit;
            row.appendChild(unit);
          }
        } else if (field.kind === 'color') {
          const picker = document.createElement('input');
          picker.type = 'color';
          picker.className = 'edit-color';
          picker.value = toHex(current);
          picker.disabled = submitting || targetStale(editTarget.targetId);
          const text = document.createElement('input');
          text.type = 'text';
          text.className = 'edit-value';
          text.value = current;
          text.disabled = picker.disabled;
          picker.addEventListener('change', () => { text.value = picker.value; commit(picker.value); });
          text.addEventListener('change', () => commit(text.value));
          row.appendChild(picker);
          row.appendChild(text);
        } else if (field.kind === 'select') {
          const select = document.createElement('select');
          select.className = 'edit-value';
          (field.options || []).forEach(option => {
            const opt = document.createElement('option');
            opt.value = option;
            opt.textContent = option;
            select.appendChild(opt);
          });
          select.value = current && field.options.includes(current) ? current : field.options[0];
          select.disabled = submitting || targetStale(editTarget.targetId);
          select.addEventListener('change', () => commit(select.value));
          row.appendChild(select);
        } else {
          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'edit-value wide';
          input.value = current;
          input.disabled = submitting || targetStale(editTarget.targetId);
          input.addEventListener('change', () => commit(input.value));
          row.appendChild(input);
        }
        groupEl.appendChild(row);
        rows.set(field.prop, row);
        // Candidate chips land here; only authored tokens are clickable.
        const chips = document.createElement('div');
        chips.className = 'edit-chips';
        chips.dataset.prop = field.prop;
        groupEl.appendChild(chips);
      });
      // Raw CSS stays available but out of the way. It only accepts the same
      // closed property set, so it is an input shortcut, not a bypass.
      const advanced = document.createElement('details');
      advanced.className = 'edit-group edit-advanced';
      const summary = document.createElement('summary');
      summary.textContent = 'Advanced';
      advanced.appendChild(summary);
      const area = document.createElement('textarea');
      area.rows = 2;
      area.className = 'edit-raw';
      area.placeholder = 'padding: 24px; border-radius: 12px';
      area.disabled = submitting || targetStale(editTarget.targetId);
      const rawBtn = document.createElement('button');
      rawBtn.type = 'button';
      rawBtn.className = 'icon-btn';
      rawBtn.textContent = 'Apply declarations';
      rawBtn.disabled = area.disabled;
      rawBtn.addEventListener('click', () => {
        const allowed = new Set(EDIT_FIELDS.map(f => f.prop));
        String(area.value || '').split(';').forEach(pair => {
          const at = pair.indexOf(':');
          if (at === -1) return;
          const prop = pair.slice(0, at).trim().toLowerCase();
          const value = pair.slice(at + 1).trim();
          if (!allowed.has(prop) || !value) return;
          applyEdit(editTarget.targetId, prop, value);
        });
        area.value = '';
      });
      advanced.appendChild(area);
      advanced.appendChild(rawBtn);
      bodyEl.appendChild(advanced);
    }
    function renderCandidates(msg) {
      // msg.prop reaches a CSS attribute selector below; anything the field
      // list does not declare has no row and must not be interpolated.
      if (!EDIT_FIELDS.some(f => f.prop === msg.prop)) return;
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
      if (submitting || targetStale(targetId)) return false;
      if (!editTarget || targetId !== editTarget.targetId) return false;
      ackNotice = '';
      editInFlight += 1;
      postToFrame({ type: 'pc:override', targetId: targetId, prop: prop, value: value });
      return true;
    }
    function refreshApply() {
      if (!applyBtn) return;
      // A stale target's overrides are dropped, so they cannot be submitted;
      // one stale selection must not disable submission for the others.
      const live = editPending.filter(r => !staleTargets.has(r.targetId)).length;
      applyBtn.disabled = submitting || live === 0 || editInFlight > 0;
      applyBtn.textContent = submitting ? 'Submitting...' : 'Apply to source';
    }
    async function submitEdits() {
      if (submitting) return;
      // A change still travelling to the frame is not in buildTargets() yet.
      if (editInFlight > 0) { setStatus('Waiting for the last change to render...', true); return; }
      const targets = buildTargets();
      if (!targets.length) { setStatus('No effective overrides to submit.', true); return; }
      // Freeze the payload, not just the id: an identical retry is the same
      // change request and keeps its id, while a payload the owner edited after
      // the last attempt is a new request and gets a new id.
      const fingerprint = JSON.stringify(targets);
      if (!editFrozen || editFrozen.fp !== fingerprint) {
        editFrozen = {
          id: 'cs-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
          fp: fingerprint
        };
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
      // Only the submitted keys are cleared on an ack. Overrides the owner adds
      // while the request is in flight stay pending instead of disappearing.
      const submittedKeys = targets.flatMap(t => t.edits.map(edit => editKey(t.targetId, edit.prop)));
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
          // clear those overrides so verification sees real source output.
          postToFrame({ type: 'pc:clear-overrides', keys: submittedKeys });
          const gone = new Set(submittedKeys);
          editPending = editPending.filter(r => !gone.has(editKey(r.targetId, r.prop)));
          gone.forEach(key => {
            editBaseline.delete(key);
            editApplied.delete(key);
            editTokens.delete(key);
          });
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
        // The screenshot drawer captures the selected element by its recorded
        // selector; the selection itself stays inside the frame.
        window.__pcSelectedTarget = {
          targetId: msg.targetId,
          selector: (msg.context || {}).selector || null,
          label: [(msg.context || {}).tag, (msg.context || {}).testId, (msg.context || {}).name]
            .filter(Boolean).join(' ') || msg.targetId
        };
        editSnapshots.set(msg.targetId, { context: msg.context || {}, values: {} });
        // Selecting a live target clears only its own stale mark.
        staleTargets.delete(msg.targetId);
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
        renderList();
        if (editTarget) {
          postToFrame({ type: 'pc:probe', targetId: editTarget.targetId, props: EDIT_FIELDS.map(f => f.prop) });
        }
        refreshApply();
      } else if (msg.type === 'pc:targets') {
        const list = Array.isArray(msg.stale) ? msg.stale : [];
        let dropped = 0;
        list.forEach(entry => {
          const id = entry && entry.targetId;
          if (!id) return;
          staleTargets.add(id);
          const before = editPending.length;
          // A replaced element's overrides no longer exist in the document.
          // Drop them explicitly so a submission never names a dead target.
          editPending = editPending.filter(r => r.targetId !== id);
          dropped += before - editPending.length;
        });
        if (editTarget && staleTargets.has(editTarget.targetId)) {
          // The element is gone; the canvas-wide selection must not keep
          // pointing at it or an element capture targets a dead selector.
          window.__pcSelectedTarget = null;
          renderTarget();
        }
        if (dropped) {
          renderList();
          setStatus(dropped + ' edit' + (dropped === 1 ? '' : 's') + ' for replaced elements were dropped. Reselect and re-apply them.', true);
        } else if (editTarget && staleTargets.has(editTarget.targetId)) {
          setStatus('The selected element was replaced by a reload. Reselect it to continue.', true);
        }
        refreshApply();
      } else if (msg.type === 'pc:dom-changed') {
        // The app re-rendered. Only targets that actually detached get marked.
        const ids = editPending.map(r => r.targetId);
        if (editTarget) ids.push(editTarget.targetId);
        postToFrame({ type: 'pc:revalidate', targetIds: Array.from(new Set(ids)) });
      } else if (msg.type === 'pc:ready') {
        // The document was rebuilt: memory-only overrides are gone with it, and
        // any selection or in-flight count describes the old document. Reset
        // all of it so the inspector does not keep a dead selection or a stuck
        // "waiting for the last change" state.
        const had = Boolean(editTarget) || editPending.length > 0 || editInFlight > 0;
        editPending = [];
        editBaseline.clear();
        editApplied.clear();
        editTokens.clear();
        editFrozen = null;
        editInFlight = 0;
        staleTargets.clear();
        editTarget = null;
        window.__pcSelectedTarget = null;
        rows = new Map();
        ackNotice = '';
        renderTarget();
        renderList();
        refreshApply();
        if (had) setStatus('Preview reloaded. Pending visual edits were cleared; reselect and re-apply.', true);
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
      // Reset clears the overrides, not the selection: the inspector is still
      // pointing at the same element and an element capture must keep working.
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
