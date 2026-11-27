/**
 * Tests for the dev-server adapters that deliver the annotation SDK into a
 * framework-native preview (Vite plugin + Laravel/Blade include).
 *
 * Run with: node tests/lib/plan-canvas-adapters.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const VITE = path.join(REPO, 'scripts', 'lib', 'plan-canvas', 'adapters', 'vite.mjs');
const BLADE = path.join(REPO, 'scripts', 'lib', 'plan-canvas', 'adapters', 'blade', 'sdk.blade.php');

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

async function runTests() {
  let passed = 0;
  let failed = 0;

  console.log('\nvite adapter:');
  const { planCanvasAnnotations } = await import(VITE);
  const plugin = planCanvasAnnotations();

  if (test('runs only while serving, never in a build', () => {
    assert.equal(plugin.name, 'ecc-plan-canvas-annotations');
    assert.equal(plugin.apply, 'serve');
  })) passed++; else failed++;

  if (test('injects the SDK once, at the end of the body', () => {
    const html = '<html><body><div id="root"></div></body></html>';
    const first = plugin.transformIndexHtml.handler(html);
    assert.equal(first.tags.length, 1);
    assert.equal(first.tags[0].tag, 'script');
    assert.equal(first.tags[0].attrs.src, 'http://127.0.0.1:4517/sdk.js');
    assert.equal(first.tags[0].injectTo, 'body');

    const withTag = html.replace('</body>', '<script src="http://127.0.0.1:4517/sdk.js" defer></script></body>');
    assert.equal(plugin.transformIndexHtml.handler(withTag), withTag, 'already tagged, left alone');
  })) passed++; else failed++;

  if (test('honours a custom canvas URL without doubling the slash', () => {
    const custom = planCanvasAnnotations({ canvasUrl: 'http://127.0.0.1:4518/' });
    const out = custom.transformIndexHtml.handler('<html><body></body></html>');
    assert.equal(out.tags[0].attrs.src, 'http://127.0.0.1:4518/sdk.js');
  })) passed++; else failed++;

  if (test('can be switched off entirely', () => {
    const off = planCanvasAnnotations({ enabled: false });
    const html = '<html><body></body></html>';
    assert.equal(off.transformIndexHtml.handler(html), html);
  })) passed++; else failed++;

  console.log('\nblade adapter:');
  const blade = fs.readFileSync(BLADE, 'utf8');

  if (test('only renders in local or development', () => {
    assert.ok(blade.includes("@env(['local', 'development'])"), 'env guard');
    assert.ok(blade.includes('@endenv'));
  })) passed++; else failed++;

  if (test('points at the canvas SDK and nothing else', () => {
    assert.ok(blade.includes("env('ECC_PLAN_CANVAS_URL', 'http://127.0.0.1:4517')"));
    assert.ok(blade.includes('/sdk.js'));
    assert.ok(!/data-ecc-id/.test(blade), 'no project instrumentation');
  })) passed++; else failed++;

  console.log(`\nPassed: ${passed}, Failed: ${failed}`);
  process.exitCode = failed > 0 ? 1 : 0;
}

runTests();
