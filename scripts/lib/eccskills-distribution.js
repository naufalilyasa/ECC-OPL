'use strict';

/**
 * Phase A6 — canonical distribution manifest, project-local ownership ledger,
 * and atomic install/rollback for the antigravity-cli target.
 *
 * Uses only Node builtins; no Guardian Angel adapter (owner directive).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
  copyContainedFile,
  readFileNoFollow,
  removeContainedPath
} = require('./install/contained-fs');

// Canonical baseline for this port. A6.2 pins the code line of the port; the
// live HEAD (0f8e29db) is recorded separately by the caller when desired.
const A6_CANONICAL_COMMIT = '42fae4ebb5e995690d3a5752b461e475d229c40e';
const SUPPORTED_TARGETS = new Set(['antigravity-cli']);
const EXCLUDED_SOURCE_FRAGMENTS = ['.guardian-angel', 'audit.jsonl', 'session', '.env'];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// Ledger keys are POSIX-normalized; backup traversal on Windows yields '\'.
function toPosixRelative(value) {
  return String(value || '').replace(/\\/g, '/');
}

function isIncluded(sourceRelativePath) {
  const normalized = String(sourceRelativePath || '').replace(/\\/g, '/');
  return !EXCLUDED_SOURCE_FRAGMENTS.some(fragment => normalized.includes(fragment));
}

/**
 * Build a deterministic release manifest from a set of projected operations.
 * Same operations + target + commit always yield the same sha256.
 */
function generateReleaseManifest({ operations = [], sourceRoot = null, target = 'antigravity-cli', canonicalCommit = A6_CANONICAL_COMMIT, dependencyClosure = null } = {}) {
  if (!SUPPORTED_TARGETS.has(target)) {
    throw new Error(`unsupported target: ${target}`);
  }
  // Canonical installer operations carry sourceRelativePath + sourceRoot, and
  // some are whole-directory scaffolds. Both forms are normalized here.
  const expanded = [];
  for (const op of operations) {
    if (!op || !op.destinationPath || !isIncluded(op.sourceRelativePath)) continue;
    let sourcePath = op.sourcePath;
    if (!sourcePath && sourceRoot && op.sourceRelativePath) {
      sourcePath = path.join(sourceRoot, op.sourceRelativePath);
    }
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      // Silently dropping a required source would ship a manifest that claims
      // completeness while omitting files.
      throw new Error(`missing required source file: ${op.sourceRelativePath}`);
    }
    if (fs.statSync(sourcePath).isDirectory()) {
      for (const rel of listFiles(sourcePath)) {
        expanded.push({
          sourceRelativePath: `${String(op.sourceRelativePath).replace(/\\/g, '/')}/${rel}`,
          sourcePath: path.join(sourcePath, rel),
          destinationPath: path.join(op.destinationPath, rel)
        });
      }
    } else {
      expanded.push({ ...op, sourcePath });
    }
  }
  const files = expanded
    .map(op => {
      const bytes = fs.readFileSync(op.sourcePath);
      return {
        sourceRelativePath: op.sourceRelativePath,
        sourcePath: op.sourcePath,
        destinationPath: op.destinationPath,
        size: bytes.length,
        sha256: sha256(bytes)
      };
    })
    .sort((a, b) => a.destinationPath.localeCompare(b.destinationPath));
  // Two operations targeting one path would silently last-wins and ship the
  // wrong file. Compare case-insensitively because APFS and NTFS treat
  // `SKILL.md` and `skill.md` as the same file.
  const seen = new Map();
  for (const file of files) {
    const key = toPosixRelative(file.destinationPath).toLowerCase();
    const prior = seen.get(key);
    if (prior) {
      throw new Error(
        `duplicate destination path: ${key} from ${prior.sourceRelativePath} and ${file.sourceRelativePath}`
      );
    }
    seen.set(key, file);
  }
  const manifest = {
    target,
    canonicalCommit,
    dependencyClosure: dependencyClosure || {},
    files
  };
  // Binding hash excludes absolute sourcePath (machine-specific) so manifests
  // are reproducible across machines while still binding all file content.
  const binding = files.map(f => ({ d: f.destinationPath, s: f.sha256, z: f.size }));
  manifest.sha256 = sha256(JSON.stringify({
    target,
    canonicalCommit,
    dependencyClosure: manifest.dependencyClosure,
    files: binding
  }));
  return manifest;
}

/**
 * Ownership ledger: managed files keyed by destination-relative path with
 * expected sha256, plus any already-present files that are unmanaged.
 */
function buildOwnershipLedger(manifest, projectRoot) {
  const root = projectRoot ? path.resolve(projectRoot) : '';
  const managed = {};
  for (const file of manifest.files) {
    const rel = root
      ? path.relative(root, file.destinationPath)
      : file.destinationPath;
    managed[rel.replace(/\\/g, '/')] = file.sha256;
  }
  return { format: 1, target: manifest.target, root, managed, userModified: [], releaseSha256: manifest.sha256 };
}

function detectManagedConflicts(ledger, manifest) {
  const conflicts = [];
  const root = ledger.root ? path.resolve(ledger.root) : '';
  // A ledger built from a manifest is a PLAN, not proof of ownership. Only a
  // ledger written by a completed install may claim a pre-existing file.
  const installed = Boolean(ledger.installedAt);
  for (const file of manifest.files) {
    if (!fs.existsSync(file.destinationPath)) continue;
    const rel = root
      ? path.relative(root, file.destinationPath).replace(/\\/g, '/')
      : file.destinationPath;
    // A symlinked destination would otherwise be read through, escaping the
    // project root. Treat it as unmanaged without reading its content.
    let actual;
    try {
      actual = sha256(readFileNoFollow(file.destinationPath));
    } catch {
      conflicts.push({ destinationPath: file.destinationPath, kind: 'unmanaged' });
      continue;
    }
    const expected = installed
      ? (ledger.managed[rel] || ledger.managed[file.destinationPath])
      : null;
    if (!expected) {
      // Present on disk but never written by ECC: installing would clobber it.
      conflicts.push({ destinationPath: file.destinationPath, actual, kind: 'unmanaged' });
    } else if (actual !== expected) {
      conflicts.push({ destinationPath: file.destinationPath, expected, actual, kind: 'modified' });
    }
  }
  return conflicts;
}

function installRelease(manifest, { projectRoot, ledgerPath, backupRoot, force = false } = {}) {
  if (!projectRoot || !ledgerPath || !backupRoot) {
    throw new Error('installRelease requires projectRoot, ledgerPath, and backupRoot');
  }
  const root = path.resolve(projectRoot);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const thisBackup = path.resolve(path.join(backupRoot, stamp));
  // Records what to undo: `restore` when a backup exists, `remove` when this
  // run created the file. An identical pre-existing file records NOTHING, so
  // rollback can never delete a file ECC did not write.
  const undo = [];
  const previousLedger = fs.existsSync(ledgerPath)
    ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8'))
    : null;

  // Refuse before touching anything: a destination outside the project root, a
  // modified managed file, or an unmanaged file with DIFFERENT content is not
  // ours to overwrite. An unmanaged file that already matches the release
  // byte-for-byte is not an overwrite — nothing would be written — so it is
  // allowed and recorded as "already correct".
  if (!force) {
    const conflicts = detectManagedConflicts(previousLedger || { managed: {}, root }, manifest);
    const blocking = conflicts.filter(conflict => {
      if (conflict.kind !== 'unmanaged') return true;
      const file = manifest.files.find(f => f.destinationPath === conflict.destinationPath);
      return !file || conflict.actual !== file.sha256;
    });
    if (blocking.length > 0) {
      throw new Error(
        `refusing to overwrite ${blocking[0].kind} file: ${blocking[0].destinationPath} (pass force to override)`
      );
    }
  }

  try {
    for (const file of manifest.files) {
      // Containment is enforced by the canonical helper, not by string math.
      // Relative destinations resolve against the project root, never cwd.
      const dest = path.resolve(root, file.destinationPath);
      const rel = toPosixRelative(path.relative(root, dest));
      if (rel.startsWith('..') || path.isAbsolute(rel)) {
        throw new Error(`destination escapes project root: ${file.destinationPath}`);
      }
      // The canonical helper resolves against an existing trusted root.
      fs.mkdirSync(root, { recursive: true });

      const existed = fs.existsSync(dest);
      const identical = existed && sha256(readFileNoFollow(dest)) === file.sha256;

      // Already byte-for-byte correct: writing again would only risk
      // truncating a file the undo journal deliberately does not cover.
      if (identical) continue;

      if (existed) {
        const backupFile = path.join(thisBackup, rel);
        fs.mkdirSync(thisBackup, { recursive: true });
        copyContainedFile(dest, backupFile, thisBackup, 'backup');
        undo.push({ target: dest, restore: backupFile });
      } else if (!existed) {
        undo.push({ target: dest, remove: true });
      }

      // Bind to the actual release bytes: verify the SOURCE digest before the
      // copy, so a source changed after manifest generation is caught instead
      // of shipping content that no longer matches the manifest.
      const sourceBytes = readFileNoFollow(file.sourcePath);
      if (sha256(sourceBytes) !== file.sha256) {
        throw new Error(`source changed since manifest generation: ${file.sourceRelativePath}`);
      }
      copyContainedFile(file.sourcePath, dest, root, 'install');
      if (sha256(readFileNoFollow(dest)) !== file.sha256) {
        throw new Error(`digest verification failed for ${file.destinationPath}`);
      }
    }

    const ledger = buildOwnershipLedger(manifest, root);
    ledger.backupDir = thisBackup;
    ledger.installedAt = new Date().toISOString();
    // Only files this install CREATED may be removed on rollback. A file that
    // already existed (even with identical content) is never ours to delete.
    ledger.added = undo.filter(entry => entry.remove).map(entry => toPosixRelative(path.relative(root, entry.target)));
    // Preserve the previous ledger so a later rollback can return to it.
    if (previousLedger) ledger.previous = previousLedger;
    fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
    fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));

    return { installed: manifest.files.map(f => f.destinationPath), backupDir: thisBackup, ledgerPath };
  } catch (error) {
    const recoveryErrors = [];
    for (const entry of undo.reverse()) {
      try {
        if (entry.restore) {
          copyContainedFile(entry.restore, entry.target, root, 'rollback');
        } else if (entry.remove) {
          removeContainedPath(entry.target, root, 'rollback');
        }
      } catch (recoveryError) {
        // Never claim atomic recovery while an error was swallowed.
        recoveryErrors.push(`${entry.target}: ${recoveryError.message}`);
      }
    }
    if (recoveryErrors.length > 0) {
      error.message += `\nINCOMPLETE RECOVERY (${recoveryErrors.length} path(s)):\n${recoveryErrors.join('\n')}`;
      error.recoveryErrors = recoveryErrors;
    }
    throw error;
  }
}

function rollbackRelease({ projectRoot: explicitRoot, ledgerPath, backupRoot } = {}) {
  if (!fs.existsSync(ledgerPath)) return { rolledBack: [] };
  const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  const backupDir = ledger.backupDir || backupRoot;
  const projectRoot = explicitRoot
    ? path.resolve(explicitRoot)
    : (ledger.root ? path.resolve(ledger.root) : path.dirname(path.dirname(ledgerPath)));
  const rolledBack = [];
  if (backupDir && fs.existsSync(backupDir)) {
    for (const entry of listFiles(backupDir)) {
      const rel = toPosixRelative(entry);
      const target = path.join(projectRoot, rel);
      // Restore only files the user has not touched since install.
      const expected = ledger.managed && ledger.managed[rel];
      if (expected && fs.existsSync(target)) {
        if (sha256(readFileNoFollow(target)) !== expected) {
          // User-modified file: preserve it (do not overwrite).
          continue;
        }
      }
      copyContainedFile(path.join(backupDir, entry), target, projectRoot, 'rollback');
      rolledBack.push(target);
    }
  }
  // Remove ONLY files this install created and the user has not modified.
  // `ledger.added` is authoritative; falling back to "no backup exists" would
  // delete a pre-existing identical file that was never ours.
  const added = Array.isArray(ledger.added) ? ledger.added : [];
  for (const rel of added) {
    const target = path.join(projectRoot, rel);
    const expected = ledger.managed && ledger.managed[rel];
    if (!fs.existsSync(target) || !expected) continue;
    if (sha256(readFileNoFollow(target)) !== expected) continue;
    removeContainedPath(target, projectRoot, 'rollback');
  }
  // Restore the previous installation state instead of erasing it, so rolling
  // back a reinstall returns to the prior release rather than to nothing.
  if (ledger.previous) {
    fs.writeFileSync(ledgerPath, JSON.stringify(ledger.previous, null, 2));
  } else {
    fs.unlinkSync(ledgerPath);
  }
  return { rolledBack, restoredPrevious: Boolean(ledger.previous) };
}

function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full).map(f => path.join(entry.name, f)));
    else out.push(entry.name);
  }
  return out;
}

module.exports = {
  A6_CANONICAL_COMMIT,
  SUPPORTED_TARGETS,
  generateReleaseManifest,
  buildOwnershipLedger,
  detectManagedConflicts,
  installRelease,
  rollbackRelease,
  toPosixRelative
};
