/**
 * Tests for scripts/lib/plan-canvas/ui.js — panel toggle + viewport controls.
 *
 * Run with: node tests/lib/plan-canvas-ui.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { renderCanvasHtml, canvasClientJs, canvasCss } = require('../../scripts/lib/plan-canvas/ui');

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

  if (test('viewport select offers Fit, 1440, 768, 390 and Custom', () => {
    assert.ok(html.includes('<option value="">Fit</option>'), 'Fit option');
    assert.ok(html.includes('<option value="1440">1440</option>'), '1440 option');
    assert.ok(html.includes('<option value="768">768</option>'), '768 option');
    assert.ok(html.includes('<option value="390">390</option>'), '390 option');
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

  console.log('\ncss:');

  if (test('hidden panel and sized viewport have styles', () => {
    assert.ok(css.includes('.layout[data-panel="hidden"] .panel{display:none}'), 'panel hide rule');
    assert.ok(css.includes('.frame[data-viewport] iframe'), 'viewport frame rule');
    assert.ok(css.includes('.frame iframe{width:100%;height:100%;border:0;background:#fff;display:block;margin:0 auto;transition:width .15s,box-shadow .15s}'), 'iframe centering + transition');
  })) passed++; else failed++;

  console.log(`\nPassed: ${passed}, Failed: ${failed}`);
  process.exitCode = failed > 0 ? 1 : 0;
}

runTests();
