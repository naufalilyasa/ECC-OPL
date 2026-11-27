/**
 * Phase 1 — framework/project discovery must be evidence-backed.
 *
 * Detection reads a real tree and reports what it found; conflicting evidence
 * must come back as `ambiguous`, never as a preference. Run with:
 *   node tests/lib/design-build-project-discovery.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const DETECT = path.resolve(__dirname, '..', '..', 'scripts', 'design-build-v2', 'detect-project.mjs');

let passed = 0;
let failed = 0;
const TEMP_DIRS = [];

function test(name, fn) {
  try { fn(); console.log(`  ok ${name}`); passed += 1; }
  catch (error) { console.log(`  FAIL ${name}\n    ${error.message.split('\n')[0]}`); failed += 1; }
}

function makeTree(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'detect-project-'));
  TEMP_DIRS.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    const target = path.join(dir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, typeof content === 'string' ? content : JSON.stringify(content));
  }
  return dir;
}

(async () => {
  const { detectProject } = await import(pathToFileURL(DETECT).href);

  test('React+Vite TypeScript is detected as a native preview target', () => {
    const dir = makeTree({
      'package.json': { dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' }, devDependencies: { vite: '^5.0.0', typescript: '^5.0.0' }, scripts: { dev: 'vite' } },
      'vite.config.ts': 'export default {}',
      'tsconfig.json': '{}',
      'index.html': '<div id="root"></div>',
      'src/main.tsx': 'console.log(1)',
      'package-lock.json': '{}',
    });
    const profile = detectProject(dir);
    assert.equal(profile.status, 'detected');
    assert.equal(profile.variant, 'react-vite');
    assert.equal(profile.framework, 'react');
    assert.equal(profile.language, 'typescript');
    assert.equal(profile.previewMode, 'framework-native');
    assert.equal(profile.runner, 'native');
    assert.equal(profile.devCommand, 'npm run dev');
    assert.equal(profile.entrypoint, 'src/main.tsx');
    assert.ok(profile.evidence.length >= 3);
  });

  test('monorepo resolves the workspace app, not the root shell', () => {
    const dir = makeTree({
      'package.json': { private: true, workspaces: ['apps/*'] },
      'apps/web/package.json': { dependencies: { vue: '^3.4.0' }, devDependencies: { vite: '^5.0.0' }, scripts: { dev: 'vite' } },
      'apps/web/vite.config.ts': 'export default {}',
      'apps/web/src/main.ts': 'console.log(1)',
      'apps/web/pnpm-lock.yaml': '',
    });
    const profile = detectProject(dir);
    assert.equal(profile.status, 'detected');
    assert.equal(profile.appRoot, path.join(dir, 'apps/web'));
    assert.equal(profile.appSource, 'workspace');
    assert.equal(profile.variant, 'vue-vite');
    assert.equal(profile.language, 'vue-sfc');
    assert.equal(profile.packageManager, 'pnpm');
  });

  test('Laravel + Inertia React is detected from composer.json and the adapter', () => {
    const dir = makeTree({
      'composer.json': { require: { 'laravel/framework': '^11.0', 'inertiajs/inertia-laravel': '^1.0' } },
      'package.json': { dependencies: { react: '^18.0.0', '@inertiajs/react': '^1.0.0' }, devDependencies: { vite: '^5.0.0' }, scripts: { dev: 'vite' } },
      'vite.config.js': "export default { build: { input: ['resources/css/app.css', 'resources/js/app.tsx'] } }",
      'tailwind.config.js': 'module.exports = {}',
      'resources/js/app.tsx': '',
      'package-lock.json': '{}',
    });
    const profile = detectProject(dir);
    assert.equal(profile.status, 'detected');
    assert.equal(profile.variant, 'laravel-inertia-react');
    assert.equal(profile.previewMode, 'framework-native');
    assert.equal(profile.stylingSystem, 'tailwind');
    assert.equal(profile.dependencies.inertia, true);
    assert.equal(profile.entrypoint, 'resources/js/app.tsx');
    assert.equal(profile.language, 'typescript');
  });

  test('Laravel without Inertia is detected but only as a generic runner', () => {
    const dir = makeTree({
      'composer.json': { require: { 'laravel/framework': '^11.0' } },
      'package.json': { devDependencies: { vite: '^5.0.0' } },
      'resources/views/welcome.blade.php': '',
    });
    const profile = detectProject(dir);
    assert.equal(profile.status, 'detected');
    assert.equal(profile.framework, 'laravel');
    assert.equal(profile.runner, 'generic');
    assert.equal(profile.previewMode, null);
  });

  test('conflicting root React dependency and workspace Vue app is ambiguous', () => {
    const dir = makeTree({
      'package.json': { dependencies: { react: '^18.0.0' }, workspaces: ['apps/*'] },
      'apps/admin/package.json': { dependencies: { vue: '^3.4.0' }, devDependencies: { vite: '^5.0.0' } },
      'apps/admin/vite.config.ts': 'export default {}',
    });
    const profile = detectProject(dir);
    assert.equal(profile.status, 'ambiguous');
    assert.ok(profile.evidence.some((line) => line.includes('react')));
    assert.ok(profile.evidence.some((line) => line.includes('vue')));
    assert.equal(profile.candidates.length, 1);
  });

  test('an empty directory reports standalone-html with an explicit note', () => {
    const dir = makeTree({ 'index.html': '<p>hi</p>' });
    const profile = detectProject(dir);
    assert.equal(profile.status, 'detected');
    assert.equal(profile.variant, 'standalone-html');
    assert.equal(profile.previewMode, 'standalone-html');
    assert.equal(profile.runner, null);
    assert.ok(profile.notes.some((note) => note.includes('standalone HTML')));
  });

  test('a missing directory is unsupported, not a crash', () => {
    const profile = detectProject(path.join(os.tmpdir(), 'definitely-not-a-real-dir-' + Date.now()));
    assert.equal(profile.status, 'unsupported');
  });

  test('a broken symlink inside a workspace glob is skipped, not fatal', () => {
    const dir = makeTree({
      'package.json': { private: true, workspaces: ['apps/*'] },
      'apps/web/package.json': { dependencies: { react: '^18.0.0' }, devDependencies: { vite: '^5.0.0' }, scripts: { dev: 'vite' } },
      'apps/web/src/main.jsx': '',
    });
    fs.symlinkSync(path.join(dir, 'apps', 'gone'), path.join(dir, 'apps', 'dangling'));
    const profile = detectProject(dir);
    assert.equal(profile.status, 'detected');
    assert.equal(profile.appRoot, path.join(dir, 'apps/web'));
  });

  test('a glob with a suffix after the wildcard only matches real app roots', () => {
    const dir = makeTree({
      'package.json': { private: true, workspaces: ['packages/*/app'] },
      // decoy: has package.json directly under the wildcard but no /app
      'packages/alpha/package.json': { dependencies: { vue: '^3.4.0' }, devDependencies: { vite: '^5.0.0' } },
      'packages/beta/app/package.json': { dependencies: { react: '^18.0.0' }, devDependencies: { vite: '^5.0.0' }, scripts: { dev: 'vite' } },
      'packages/beta/app/vite.config.ts': 'export default {}',
      'packages/beta/app/src/main.jsx': '',
    });
    const profile = detectProject(dir);
    assert.equal(profile.status, 'detected');
    assert.equal(profile.appRoot, path.join(dir, 'packages/beta/app'));
    assert.equal(profile.variant, 'react-vite');
  });

  for (const dir of TEMP_DIRS) fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\nPassed: ${passed}, Failed: ${failed}`);
  if (failed > 0) process.exitCode = 1;
})();
