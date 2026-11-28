'use strict';

/**
 * Publishes the Laravel/Inertia Blade partial into a Laravel app.
 *
 * Inertia serves the root document from Blade, so the Vite plugin never injects
 * the SDK there. The partial is inert until a Plan Canvas session watches the
 * page, and it carries its own `@env(['local','development'])` guard, so the
 * app only needs the include inside <head> of its root layout.
 */

const fs = require('fs');
const path = require('path');

const PARTIAL = path.join(__dirname, 'sdk.blade.php');
const RELATIVE_DEST = path.join('resources', 'views', 'vendor', 'ecc-plan-canvas', 'sdk.blade.php');
const INCLUDE_BLOCK = "@env(['local', 'development'])\n  @include('vendor.ecc-plan-canvas.sdk')\n@endenv";

function publishBladeAdapter(appDir) {
  const root = path.resolve(appDir);
  // `artisan` is the one marker every Laravel app has and nothing else does.
  if (!fs.existsSync(path.join(root, 'artisan'))) {
    return { status: 'error', error: `not a Laravel app (no artisan in ${root})` };
  }

  const dest = path.join(root, RELATIVE_DEST);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const existed = fs.existsSync(dest);
  fs.writeFileSync(dest, fs.readFileSync(PARTIAL, 'utf8'));

  return {
    status: existed ? 'updated' : 'created',
    path: dest,
    include: INCLUDE_BLOCK,
    next_step: 'Add the include block inside <head> of resources/views/app.blade.php.'
  };
}

module.exports = { publishBladeAdapter, INCLUDE_BLOCK, RELATIVE_DEST };
