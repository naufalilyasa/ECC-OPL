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

// Canonical baseline for this port. A6.2 pins the code line of the port; the
// live HEAD (0f8e29db) is recorded separately by the caller when desired.
const A6_CANONICAL_COMMIT = '42fae4ebb5e995690d3a5752b461e475d229c40e';
const SUPPORTED_TARGETS = new Set(['antigravity-cli']);
const EXCLUDED_SOURCE_FRAGMENTS = ['.guardian-angel', 'audit.jsonl', 'session', '.env'];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
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
    if (!sourcePath || !fs.existsSync(sourcePath)) continue;
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
  for (const file of manifest.files) {
    if (!fs.existsSync(file.destinationPath)) continue;
    const actual = sha256(fs.readFileSync(file.destinationPath));
    const rel = root
      ? path.relative(root, file.destinationPath).replace(/\\/g, '/')
      : file.destinationPath;
    const expected = ledger.managed[rel] || ledger.managed[file.destinationPath];
    if (expected && actual !== expected) {
      conflicts.push({ destinationPath: file.destinationPath, expected, actual });
    }
  }
  return conflicts;
}

function installRelease(manifest, { projectRoot, ledgerPath, backupRoot } = {}) {
  if (!projectRoot || !ledgerPath || !backupRoot) {
    throw new Error('installRelease requires projectRoot, ledgerPath, and backupRoot');
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const thisBackup = path.join(backupRoot, stamp);
  const installed = [];

  for (const file of manifest.files) {
    fs.mkdirSync(path.dirname(file.destinationPath), { recursive: true });
    // Backup an existing file only if it is not already the desired content.
    if (fs.existsSync(file.destinationPath)) {
      const current = fs.readFileSync(file.destinationPath);
      if (sha256(current) !== file.sha256) {
        const rel = path.relative(projectRoot, file.destinationPath);
        const backupFile = path.join(thisBackup, rel);
        fs.mkdirSync(path.dirname(backupFile), { recursive: true });
        fs.copyFileSync(file.destinationPath, backupFile);
      }
    }
    fs.copyFileSync(file.sourcePath, file.destinationPath);
    if (sha256(fs.readFileSync(file.destinationPath)) !== file.sha256) {
      throw new Error(`digest verification failed for ${file.destinationPath}`);
    }
    installed.push(file.destinationPath);
  }

  const ledger = buildOwnershipLedger(manifest, projectRoot);
  ledger.backupDir = thisBackup;
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
  return { installed, backupDir: thisBackup, ledgerPath };
}

function rollbackRelease({ ledgerPath, backupRoot } = {}) {
  if (!fs.existsSync(ledgerPath)) return { rolledBack: [] };
  const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  const backupDir = ledger.backupDir || backupRoot;
  const projectRoot = ledger.root
    ? path.resolve(ledger.root)
    : path.dirname(path.dirname(ledgerPath));
  const rolledBack = [];
  if (backupDir && fs.existsSync(backupDir)) {
    for (const entry of listFiles(backupDir)) {
      const target = path.join(projectRoot, entry);
      // Restore only files the user has not touched since install.
      if (fs.existsSync(target) && ledger.managed && ledger.managed[entry]) {
        const current = sha256(fs.readFileSync(target));
        if (current !== ledger.managed[entry]) {
          // User-modified file: preserve it (do not overwrite).
          continue;
        }
      }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(backupDir, entry), target);
      rolledBack.push(target);
    }
  }
  // Remove files added by the release that the user has not modified.
  if (ledger.managed && backupDir) {
    for (const [rel, expected] of Object.entries(ledger.managed)) {
      const target = path.join(projectRoot, rel);
      const backedUp = path.join(backupDir, rel);
      if (fs.existsSync(target) && !fs.existsSync(backedUp)) {
        const current = sha256(fs.readFileSync(target));
        if (current === expected) fs.unlinkSync(target);
      }
    }
  }
  fs.unlinkSync(ledgerPath);
  return { rolledBack };
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
  rollbackRelease
};
