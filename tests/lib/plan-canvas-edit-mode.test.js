/**
 * Tests for the Plan Canvas visual edit inspector and the SDK override engine.
 *
 * Both are generated browser source, not importable modules, so these are
 * static assertions. Behavioural acceptance (real cascade, real HMR, real
 * browser) belongs to the pilot runs recorded in the work item.
 *
 * Run with: node tests/lib/plan-canvas-edit-mode.test.js
 */

const assert = require('assert');
const { editModeClientJs } = require('../../scripts/lib/plan-canvas/edit-mode');
const { artifactSdkJs } = require('../../scripts/lib/plan-canvas/sdk');
const { canvasClientJs } = require('../../scripts/lib/plan-canvas/ui');

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
    return false;
  }
}

function runTests() {
  console.log('\n=== Testing plan-canvas visual edit mode ===\n');

  const js = editModeClientJs();
  const sdk = artifactSdkJs();
  let passed = 0;
  let failed = 0;

  if (test('the inspector is inert without --edit-mode', () => {
    assert.ok(js.includes('if (boot.editMode) initEditMode();'), 'gated on the boot flag');
    assert.ok(js.includes("const inspector = $('inspector');"), 'mounts only on the inspector element');
  })) passed++; else failed++;

  if (test('inspector rows post overrides and submit only through the feedback API', () => {
    assert.ok(js.includes("type: 'pc:override'"), 'posts pc:override');
    // The only network call is the existing feedback endpoint; the chrome has
    // no file access, so source changes can only happen on the agent side.
    assert.ok(js.includes("fetch('/api/session/' + boot.key + '/feedback'"), 'submits via feedback');
    assert.strictEqual(js.match(/\bfetch\s*\(/g).length, 1, 'exactly one fetch');
    assert.ok(!js.includes('document.adoptedStyleSheets'), 'chrome never touches the preview sheet');
  })) passed++; else failed++;

  if (test('an ineffective override is reported and kept out of pending', () => {
    assert.ok(js.includes('msg.effective'), 'reads the effective flag');
    assert.ok(js.includes('markConflict(msg.prop'), 'records the conflict');
    assert.ok(js.includes('another rule wins'), 'explains the cascade conflict');
    // The SDK drops the declaration that did not render and reconciles the
    // pending list, so a bad value can never hide a good one.
    assert.ok(sdk.includes('records.pop()'), 'ineffective record rolled back');
    assert.ok(!js.includes('editIneffective'), 'no hidden-key set in the chrome');
  })) passed++; else failed++;

  if (test('undo, redo and reset go through the SDK stack', () => {
    assert.ok(js.includes("type: 'pc:undo'"), 'undo message');
    assert.ok(js.includes("type: 'pc:redo'"), 'redo message');
    assert.ok(js.includes("type: 'pc:reset'"), 'reset message');
  })) passed++; else failed++;

  if (test('a replaced element blocks further editing', () => {
    assert.ok(js.includes("msg.type === 'pc:targets'"), 'handles revalidation results');
    assert.ok(js.includes('stale = true'), 'marks the selection stale');
    assert.ok(js.includes('input.disabled = stale'), 'disables inputs');
  })) passed++; else failed++;

  if (test('the SDK overrides through a constructable sheet with a fallback', () => {
    assert.ok(sdk.includes('new CSSStyleSheet()'), 'constructable sheet');
    assert.ok(sdk.includes('document.adoptedStyleSheets'), 'adopted into the document');
    assert.ok(sdk.includes("overlayStyleEl = document.createElement('style')"), 'style-element fallback');
    assert.ok(sdk.includes("replaceSync(css)"), 'rules replaced wholesale');
  })) passed++; else failed++;

  if (test('override values cannot escape the generated rule', () => {
    assert.ok(sdk.includes('/[;{}<>]|'), 'structural characters refused');
    assert.ok(sdk.includes("if (!safeValue(value)) return reportApplied"), 'refused values reported');
  })) passed++; else failed++;

  if (test('the SDK reads the cascade back instead of assuming success', () => {
    assert.ok(sdk.includes('function effectivelyApplied'), 'read-back exists');
    assert.ok(sdk.includes('getComputedStyle(el)'), 'computed style read');
    assert.ok(sdk.includes('const effective = effectivelyApplied(prop, value, el)'), 'effective is measured, not inferred');
    assert.ok(sdk.includes('effective: false, error: error || null'), 'failures never claim success');
  })) passed++; else failed++;

  if (test('shorthand properties read back as longhands', () => {
    assert.ok(sdk.includes("'padding': ['padding-top'"), 'padding expands');
    assert.ok(sdk.includes("'gap': ['row-gap', 'column-gap']"), 'gap expands');
    assert.ok(sdk.includes("'border-radius': ["), 'radius expands');
  })) passed++; else failed++;

  if (test('revalidation reports resolved and stale targets', () => {
    assert.ok(sdk.includes("post({ type: 'pc:targets', resolved: resolved, stale: stale })"), 'targets reported');
    assert.ok(sdk.includes("t.identity.testId"), 'identity gate before reattaching');
    assert.ok(sdk.includes("reason: 'missing'"), 'missing targets marked stale');
  })) passed++; else failed++;

  if (test('reset removes every rule and target attribute', () => {
    assert.ok(sdk.includes('records.length = 0'), 'records cleared');
    assert.ok(sdk.includes("removeAttribute('data-ecc-edit')"), 'attributes removed');
    assert.ok(sdk.includes("type: 'pc:override-state'"), 'state reported');
  })) passed++; else failed++;

  if (test('clear-overrides waits for the chrome and is the only reset path', () => {
    assert.ok(sdk.includes("msg.type === 'pc:reset' || msg.type === 'pc:clear-overrides'"), 'both accepted');
    assert.ok(sdk.includes('A failed submission keeps every override for the retry.') ||
      sdk.includes('failed submission keeps every override'), 'failure keeps the pending state');
  })) passed++; else failed++;

  if (test('chrome client stays parseable with the edit block injected', () => {
    const client = canvasClientJs();
    assert.ok(client.includes('function initEditMode()'), 'edit block present');
    assert.doesNotThrow(() => new Function(client), 'generated chrome parses');
  })) passed++; else failed++;

  if (test('overrides are cleared only after the server acknowledges the change set', () => {
    assert.ok(js.includes('acceptedIds'), 'reads acceptedIds');
    assert.ok(js.includes('accepted.indexOf(frozenId)'), 'matches this change set');
    const ackAt = js.indexOf("postToFrame({ type: 'pc:clear-overrides' })");
    const checkAt = js.indexOf('accepted.indexOf(frozenId)');
    assert.ok(checkAt !== -1 && ackAt > checkAt, 'clear happens after the ack check');
    assert.ok(js.includes('clear-overrides'), 'uses clear-overrides, not reset');
  })) passed++; else failed++;

  if (test('a failed or rejected submission keeps the pending edits for retry', () => {
    assert.ok(js.includes('Edits kept for retry'), 'tells the owner the edits survive');
    assert.ok(js.includes('Submission failed: '), 'network failures reported');
    assert.ok(js.includes('editFrozen = null;', 0) || js.includes('editFrozen = null'), 'freeze reset on success');
    // On failure editFrozen must hold, so the retry reuses the same id.
    const catchAt = js.indexOf('} catch (err) {');
    const clearAt = js.indexOf('editFrozen = null;');
    assert.ok(catchAt !== -1 && clearAt < catchAt, 'freeze is cleared only on the success path');
  })) passed++; else failed++;

  if (test('the feedback response exposes which change sets landed', () => {
    const source = require('fs').readFileSync(
      require('path').join(__dirname, '../../scripts/lib/plan-canvas/server.js'), 'utf8');
    assert.ok(source.includes('acceptedIds: result.accepted.map'), 'acceptedIds mapped');
    assert.ok(source.includes('item.clientId || (item.changeSet && item.changeSet.id) || item.id'),
      'correlation id falls back to the change set then the item');
    assert.ok(/accepted: result\.accepted\.length/.test(source), 'accepted stays a numeric count');
  })) passed++; else failed++;

  if (test('the frozen change set id is reused across retries', () => {
    assert.ok(js.includes('if (!editFrozen) {'), 'freeze once');
    assert.ok(js.includes("'cs-' + Date.now()"), 'ids are generated locally');
    assert.ok(js.includes('clientId: editFrozen.id'), 'clientId echoes the same id');
    assert.ok(js.includes('id: editFrozen.id'), 'changeSet.id matches clientId');
  })) passed++; else failed++;

  if (test('a verdict is blocked while visual edits are still pending', () => {
    assert.ok(js.includes("closest('#approve, #changes')"), 'guards both verdict buttons');
    assert.ok(js.includes('Apply or reset the pending visual edits'), 'explains the block');
    assert.ok(js.includes('capture: true') || js.includes('}, true);'), 'intercepts before the handler');
  })) passed++; else failed++;

  if (test('the change set carries the reviewed preview and viewport', () => {
    assert.ok(js.includes('revisionDigest:'), 'revision digest forwarded');
    assert.ok(js.includes('revision:'), 'revision forwarded');
    assert.ok(js.includes('designDigest:'), 'design digest forwarded');
    assert.ok(js.includes('viewport: viewportBlock()'), 'real viewport, not a guess');
    assert.ok(js.includes('route: routeFor()'), 'actual preview route');
    assert.ok(js.includes("breakpoint: null"), 'no inferred breakpoint');
  })) passed++; else failed++;

  if (test('declared and rendered values stay separate facts', () => {
    assert.ok(js.includes('declared: r.value'), 'declared comes from the request');
    assert.ok(js.includes('applied.rendered'), 'rendered comes from the read-back');
    assert.ok(js.includes('effective: applied ? applied.effective !== false : true'), 'effective is measured');
  })) passed++; else failed++;

  if (test('only an authored token reference is offered as a chip', () => {
    assert.ok(sdk.includes('function scanTokens'), 'scan exists');
    assert.ok(sdk.includes("push(varMatch[1], 'authored', rule.selectorText)"), 'authored needs a matched rule');
    assert.ok(sdk.includes("if (matches) push(varMatch[1], 'authored'"), 'match gate present');
    assert.ok(sdk.includes("push(null, 'coincidental', rule.selectorText)"), 'coincidence has no name');
    assert.ok(sdk.includes('try { rules = sheet.cssRules; } catch (err) { return; }'), 'cross-origin sheets skipped');
  })) passed++; else failed++;

  if (test('a coincidental match stays token:null until the owner confirms', () => {
    assert.ok(js.includes("c.origin === 'authored'"), 'only authored chips are clickable');
    assert.ok(js.includes('not an authored token'), 'coincidence is named as such');
    assert.ok(js.includes("editTokens.set(key, { name: c.name, origin: 'authored' })"), 'tokens only set from a chip');
    assert.ok(js.includes('token: tok ? tok.name : null'), 'token carries the name');
    assert.ok(js.includes('tokenOrigin: tok ? tok.origin : null'), 'token origin travels too');
  })) passed++; else failed++;

  if (test('a token override is read back through the resolved var()', () => {
    assert.ok(sdk.includes('function resolveVar'), 'resolver exists');
    assert.ok(sdk.includes('resolveVar(value, el)'), 'comparison uses the resolved value');
    assert.ok(js.includes("value: 'var(' + c.name + ')'"), 'chip submits var()');
  })) passed++; else failed++;

  if (test('shared-component scope needs an explicit owner confirmation', () => {
    assert.ok(js.includes("if (next !== 'instance')"), 'non-instance branch');
    assert.ok(js.includes('window.confirm('), 'asks the owner');
    assert.ok(js.includes("scopeConfirmedBy = 'owner'"), 'records the confirmation');
    assert.ok(js.includes("scope: editScope"), 'scope travels in the change set');
    assert.ok(js.includes("scopeConfirmedBy: editScope === 'instance' ? null : scopeConfirmedBy"), 'instance sends null');
  })) passed++; else failed++;

  if (test('token chips land under their own property row', () => {
    assert.ok(js.includes('.edit-chips[data-prop="' + "' + msg.prop + '" + '"]'), 'chip lookup is per property');
    assert.ok(js.includes('chips.dataset.prop = field.prop'), 'chips carry their property');
  })) passed++; else failed++;

  if (test('a preview reload cannot leave a phantom pending list', () => {
    assert.ok(js.includes("msg.type === 'pc:ready'"), 'reload is observed');
    assert.ok(js.includes('Pending visual edits were cleared by the reload'), 'the owner is told');
  })) passed++; else failed++;

  if (test('an override still in flight blocks the verdict', () => {
    assert.ok(js.includes('editInFlight += 1'), 'input blur counts as in flight');
    assert.ok(js.includes('if (!editPending.length && !editInFlight) return;'), 'verdict waits for it');
    assert.ok(js.includes('editInFlight > 0) { setStatus('), 'submit waits for it too');
  })) passed++; else failed++;

  if (test('submission freezes its id and survives later state changes', () => {
    const idx = js.indexOf('const frozenId = editFrozen.id;');
    const bodyIdx = js.indexOf("fetch('/api/session/' + boot.key + '/feedback'");
    assert.ok(idx !== -1 && idx < bodyIdx, 'id captured before the request');
    assert.ok(js.includes('accepted.indexOf(frozenId)'), 'ack matched on the captured id');
    assert.ok(js.includes("rejected.reason === 'DUPLICATE_CHANGE_SET'"), 'an already-stored set counts as acknowledged');
  })) passed++; else failed++;

  if (test('stale cannot trap the owner without reset', () => {
    assert.ok(js.includes('stale && !editPending.length'), 'reset stays available while edits exist');
  })) passed++; else failed++;

  if (test('the ack message survives the state sync that follows it', () => {
    assert.ok(js.includes("ackNotice = 'Sent. Your agent is updating source.'"), 'ack sets the notice');
    assert.ok(js.includes('if (ackNotice) setStatus(ackNotice, false);'), 'list render prefers it');
    // A new edit must not keep claiming the old batch was sent.
    assert.ok(js.includes('ackNotice = \'\';'), 'cleared on new activity');
  })) passed++; else failed++;

  if (test('reattachment needs a matching testId', () => {
    assert.ok(sdk.includes('if (t.identity.testId && t.selector)'), 'no testId means no reattach');
    assert.ok(!sdk.includes('if (el && t.identity.testId &&'), 'selector fallback removed');
    assert.ok(sdk.includes('editTargets.delete(id)'), 'detached targets are released');
  })) passed++; else failed++;

  if (test('the in-frame bridge only obeys its parent frame', () => {
    assert.ok(sdk.includes('if (e.source !== window.parent) return;'), 'sender checked');
  })) passed++; else failed++;

  console.log(`\nPassed: ${passed}`);
  console.log(`Failed: ${failed}`);
  return failed === 0;
}

if (require.main === module) {
  process.exitCode = runTests() ? 0 : 1;
}

module.exports = { runTests };
