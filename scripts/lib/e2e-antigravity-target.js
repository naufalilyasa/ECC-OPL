'use strict';

/**
 * Antigravity CLI target resolution for the unified E2E V2 runner and the
 * preserved read-only security audit. Pure helpers, no I/O side effects.
 */

const path = require('path');
const fs = require('fs');

const E2E_SUBCOMMANDS = Object.freeze(['map', 'run', 'full', 'status', 'help']);
const READ_ONLY_AUDIT_TOOLS = Object.freeze(['read_file', 'grep_search', 'find_by_name']);

const MAPPER_RESOURCES = Object.freeze({
  opencode: '.opencode/resources/e2e-journey-mapper.md',
  'antigravity-cli': '.agents/ecc-opl/e2e/e2e-journey-mapper.md'
});

function resolveMapperResource(target, repoRoot) {
  const resource = MAPPER_RESOURCES[target];
  if (!resource) throw new Error(`unsupported E2E target: ${target}`);
  return {
    resource,
    absolutePath: path.join(repoRoot, resource),
    exists: fs.existsSync(path.join(repoRoot, resource))
  };
}

function isReadOnlyAuditTools(tools) {
  return Array.isArray(tools)
    && tools.length > 0
    && tools.every(tool => READ_ONLY_AUDIT_TOOLS.includes(tool));
}

const TEST_ID_RE = /^TEST-E2E-\d{3}$/;
const COMMIT_RE = /^[a-f0-9]{7,40}$/;

function validateReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object') return { ok: false, code: 'INVALID_RECEIPT' };
  if (typeof receipt.testId !== 'string' || !TEST_ID_RE.test(receipt.testId)) {
    return { ok: false, code: 'INVALID_TEST_ID' };
  }
  if (!Number.isInteger(receipt.assertionCount) || receipt.assertionCount < 0) {
    return { ok: false, code: 'INVALID_ASSERTIONS' };
  }
  if (typeof receipt.timestamp !== 'string' || !Number.isFinite(Date.parse(receipt.timestamp))) {
    return { ok: false, code: 'INVALID_TIMESTAMP' };
  }
  if (typeof receipt.commitHash !== 'string' || !COMMIT_RE.test(receipt.commitHash)) {
    return { ok: false, code: 'INVALID_COMMIT' };
  }
  if (receipt.status !== 'PASS' && receipt.status !== 'FAIL') {
    return { ok: false, code: 'INVALID_STATUS' };
  }
  if (receipt.skipped === true || receipt.assertionCount === 0) {
    return { ok: false, code: 'SKIPPED_NOT_COVERAGE' };
  }
  if (receipt.assertionKind !== 'behavioral') {
    return { ok: false, code: 'NOT_BEHAVIORAL' };
  }
  return { ok: true };
}

module.exports = {
  E2E_SUBCOMMANDS,
  MAPPER_RESOURCES,
  READ_ONLY_AUDIT_TOOLS,
  isReadOnlyAuditTools,
  resolveMapperResource,
  validateReceipt
};
