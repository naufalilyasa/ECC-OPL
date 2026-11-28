/**
 * Tests for scripts/lib/plan-canvas/ui.js — panel toggle + viewport controls.
 *
 * Run with: node tests/lib/plan-canvas-ui.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { renderCanvasHtml, canvasClientJs, canvasCss, liveBridgeJs } = require('../../scripts/lib/plan-canvas/ui');

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
  console.log('\n=== Testing plan-canvas/ui.js controls ===\n');

  let passed = 0;
  let failed = 0;

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-ui-'));
  const file = path.join(root, 'plan.md');
  fs.writeFileSync(file, '# Plan\n');
  const html = renderCanvasHtml({ key: 'abc123def456', file, status: 'open', chat: [] });
  const js = canvasClientJs();
  const css = canvasCss();

  console.log('header controls:');

  if (test('panel toggle button lives in the top bar', () => {
    assert.ok(html.includes('id="panelBtn"'), 'panelBtn in header');
    const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
    assert.ok(header.includes('id="panelBtn"'), 'panelBtn inside <header>');
    assert.ok(header.includes('id="viewportSel"'), 'viewportSel inside <header>');
  })) passed++; else failed++;

  if (test('viewport select offers all six breakpoints, Fit and Custom', () => {
    assert.ok(html.includes('<option value="">Fit</option>'), 'Fit option');
    for (const [value, label] of [
      ['1440', '1440px desktop'],
      ['1280', '1280px desktop'],
      ['1024', '1024px tablet landscape'],
      ['768', '768px tablet portrait'],
      ['390', '390px mobile'],
      ['360', '360px mobile'],
    ]) {
      assert.ok(
        html.includes(`<option value="${value}">${label}</option>`),
        `${value} option labelled "${label}"`
      );
    }
    assert.ok(html.includes('value="custom"'), 'custom option');
    assert.ok(html.includes('id="viewportCustom"'), 'custom width input');
  })) passed++; else failed++;

  console.log('\nclient wiring:');

  if (test('panel button toggles layout data-panel attribute', () => {
    assert.ok(js.includes("layout.setAttribute('data-panel', 'hidden')"), 'hides panel');
    assert.ok(js.includes("layout.removeAttribute('data-panel')"), 'shows panel');
    assert.ok(js.includes("panelBtn.title = hidden ? 'Hide conversation panel' : 'Show conversation panel'"), 'title flips');
  })) passed++; else failed++;

  if (test('viewport apply clamps width to 240-4096 and custom input applies live', () => {
    assert.ok(js.includes('Math.min(4096, Math.max(240, width))'), 'clamped range');
    assert.ok(js.includes("vpSel.value === 'custom'"), 'custom branch');
    assert.ok(js.includes("vpCustom.addEventListener('input'"), 'live custom input');
  })) passed++; else failed++;

  if (test('annotate mode waits for the SDK in live previews', () => {
    assert.ok(js.includes("let sdkReady = boot.previewMode !== 'framework-native';"), 'artifact mode starts ready');
    assert.ok(js.includes("if (!sdkReady) return;"), 'setAnnotate refused until the app greets the canvas');
    assert.ok(js.includes("msg.type === 'pc:ready'"), 'readiness handshake handled');
    assert.ok(js.includes('add the canvas dev-server adapter'), 'toggle explains how to enable it');
  })) passed++; else failed++;

  console.log('\nthree-mode control:');

  if (test('ordinary sessions keep the annotate switch and no edit mode', () => {
    assert.ok(html.includes('id="annotate"'), 'legacy switch rendered');
    assert.ok(!html.includes('id="modeGroup"'), 'no segmented control without --edit-mode');
    assert.ok(js.includes("$('annotate').addEventListener"), 'legacy click path kept');
  })) passed++; else failed++;

  if (test('--edit-mode sessions render the three-way control instead', () => {
    const editHtml = renderCanvasHtml({ key: 'abc123def456', file, status: 'open', chat: [], editMode: true });
    assert.ok(editHtml.includes('id="modeGroup"'), 'segmented control rendered');
    assert.ok(!editHtml.includes('id="annotate"'), 'legacy switch replaced');
    for (const m of ['interact', 'annotate', 'edit']) {
      assert.ok(editHtml.includes(`data-mode="${m}"`), `${m} button`);
    }
    assert.ok(editHtml.includes('"editMode":true'), 'boot payload exposes the flag');
  })) passed++; else failed++;

  if (test('the segmented control posts the mode and keeps annotate shortcut', () => {
    assert.ok(js.includes("postToFrame({ type: 'pc:set-mode', mode })"), 'posts mode');
    assert.ok(js.includes("e.key.toLowerCase() === 'i'"), 'Cmd/Ctrl+I still toggles annotate');
    assert.ok(js.includes("btn.dataset.mode === mode"), 'active button follows the mode');
  })) passed++; else failed++;

  if (test('live bridge forwards only the pc: protocol between frame and chrome', () => {
    const bridge = liveBridgeJs();
    assert.ok(bridge.includes("msg.type.indexOf('pc:') === 0"), 'protocol filter');
    assert.ok(bridge.includes('e.source === frame.contentWindow'), 'accepts frame messages only');
    assert.ok(bridge.includes('e.source !== window.parent'), 'accepts chrome messages only');
    assert.ok(bridge.includes("getElementById('app-frame')"), 'targets the preview frame');
  })) passed++; else failed++;

  console.log('\ncss:');

  if (test('hidden panel and sized viewport have styles', () => {
    assert.ok(css.includes('.layout[data-panel="hidden"] .panel{display:none}'), 'panel hide rule');
    assert.ok(css.includes('.frame[data-viewport] iframe'), 'viewport frame rule');
    assert.ok(css.includes('.frame iframe{width:100%;height:100%;border:0;background:#fff;display:block;margin:0 auto;transition:width .15s,box-shadow .15s}'), 'iframe centering + transition');
  })) passed++; else failed++;

  if (test('edit inspector stacks under the preview below 760px', () => {
    assert.ok(css.includes('@media (max-width:760px)'), 'narrow-width rule');
    assert.ok(css.includes('.layout{flex-direction:column}'), 'row becomes column');
    assert.ok(css.includes('.inspector{order:2;width:auto;max-height:45%;'), 'inspector stops holding a fixed 300px');
  })) passed++; else failed++;

  console.log(`\nPassed: ${passed}, Failed: ${failed}`);
  process.exitCode = failed > 0 ? 1 : 0;
}

runTests();
