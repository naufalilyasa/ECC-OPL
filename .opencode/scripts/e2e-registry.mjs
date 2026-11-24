#!/usr/bin/env node
// Actual product registry tool used by /e2e. Self-contained: imports only the
// shipped e2e-runtime copies of the validated M3/M5/M6 logic, never docs/tests.
// Operations: inspect | propose | apply | reconcile | validate | map | release
//             | bootstrap | append | allocate.
import { createHash } from 'node:crypto'
import { constants as FS } from 'node:fs'
import { readFileSync, writeFileSync, lstatSync, realpathSync, openSync, closeSync, writeSync, fsyncSync, fchmodSync, renameSync, unlinkSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve, relative, isAbsolute, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { validateState, parseRegistry, allocateId, bootstrapProposal, APPROVED_BOOTSTRAP_DIFF } from './e2e-runtime/registry.mjs'
import { applyFieldScopedUpdate, checkRegistryPathSafety, checkWriteConflict as m5Conflict } from './e2e-runtime/migration.mjs'
import { evaluateM6Gates, verifyExecutionEvidence } from './e2e-runtime/acceptance-ledger.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO = resolve(HERE, '../..')
const VALIDATORS = Object.freeze({
  state: '.opencode/scripts/e2e-runtime/registry.mjs',
  field: '.opencode/scripts/e2e-runtime/migration.mjs',
  path: '.opencode/scripts/e2e-runtime/migration.mjs',
  evidence: '.opencode/scripts/e2e-runtime/acceptance-ledger.mjs',
  decision: '.opencode/scripts/e2e-runtime/acceptance-ledger.mjs',
})
const ID_RE = /^TEST-E2E-\d{3}$/
const ALLOWED_FIELDS = new Set(['Purpose', 'State', 'Test file', 'Test node', 'Command', 'Evidence',
  'Representative input', 'Observable expectation', 'Boundary', 'Level', 'Execution group', 'Source', 'Test location', 'Assessment', 'Test file sha256'])
const sha = (s) => createHash('sha256').update(Buffer.from(String(s), 'utf8')).digest('hex')
const fail = (code, extra = {}) => { const e = new Error(code); e.code = code; e.extra = extra; throw e }

function targetFor(req, allowMissing = false) {
  const root = resolve(req.repoRoot ?? REPO)
  const rel = req.registryPath ?? 'TESTS.md'
  if (typeof rel !== 'string' || rel.length === 0 || isAbsolute(rel) || rel.includes('\0')) fail('PATH_REJECTED')
  const safety = checkRegistryPathSafety({ registryPath: rel, repoRoot: root })
  if (!safety.allowed && !allowMissing) fail(safety.code)
  if (!safety.allowed && allowMissing && !['OK'].includes(safety.code)) fail(safety.code)
  return { root, rel, file: safety.exists ? safety.realPath : join(root, rel), safety }
}
function readRegistry(file) {
  try { return readFileSync(file, 'utf8') } catch (e) { fail('REGISTRY_UNREADABLE', { reason: String(e.message) }) }
}
function fullValidate(text, rel = 'TESTS.md') {
  const { blocks } = parseRegistry(text)
  const seen = new Set()
  const findings = []
  for (const b of blocks) {
    if (!ID_RE.test(b.id)) findings.push({ code: 'MALFORMED_TEST_ID', id: b.id })
    if (seen.has(b.id)) findings.push({ code: 'DUPLICATE_TEST_ID', id: b.id })
    seen.add(b.id)
    const fieldSeen = new Set()
    for (const line of text.split('\n').slice(b.start, b.end + 1)) {
      const m = /^- ([^:]+):\s?(.*)$/.exec(line)
      if (!m) continue
      const key = m[1].trim()
      if (fieldSeen.has(key)) findings.push({ code: 'DUPLICATE_FIELD', id: b.id, field: key })
      fieldSeen.add(key)
      if (!ALLOWED_FIELDS.has(key)) findings.push({ code: 'FIELD-NOT-PERMITTED', id: b.id, field: key })
      if (key === 'State' && !validateState(m[2].trim()).ok) {
        findings.push({ code: 'INVALID_REGISTRY_STATE', id: b.id, value: m[2].trim() })
      }
    }
  }
  return { valid: findings.length === 0, findings, ids: [...seen], blocks }
}
function rejectInjection(outcome) {
  const fields = outcome && typeof outcome === 'object' ? outcome : {}
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v !== 'string') fail('INVALID_FIELD_TYPE', { field: k })
    if (/[\r\n]/.test(v) || /^- [^:]+:/m.test(v)) fail('STRUCTURAL_INJECTION', { field: k })
  }
}
function proposalFor(text, blockId, outcome) {
  rejectInjection(outcome)
  const p = applyFieldScopedUpdate({ registryText: text, blockId, outcome })
  if (!p.applied) fail(p.code ?? 'PROPOSAL_REJECTED', { detail: p })
  const check = fullValidate(p.nextText)
  if (!check.valid) fail('RESULTING_REGISTRY_INVALID', { findings: check.findings })
  return { ...p, diff: p.diff || `- State: ${outcome.State ?? ''}` }
}
function appendProposal(text, journey) {
  if (!journey || typeof journey !== 'object') fail('INVALID_JOURNEY')
  for (const k of ['title', 'purpose', 'representativeInput', 'observableExpectation', 'boundary']) {
    if (typeof journey[k] !== 'string' || !journey[k] || /[\r\n]/.test(journey[k])) fail('INVALID_JOURNEY_FIELD', { field: k })
  }
  const { ids } = fullValidate(text)
  const alloc = allocateId(ids)
  const id = alloc?.nextId ?? alloc
  if (!ID_RE.test(id)) fail('ID_ALLOCATION_FAILED')
  const specLines = journey.spec ? `\n- Test file: ${journey.spec}\n- Test file sha256: ${journey.specSha256 ?? ''}\n- Test node: ${journey.testNode ?? ''}` : ''
  for (const v of [journey.spec, journey.specSha256, journey.testNode]) {
    if (v !== undefined && (typeof v !== 'string' || /[\r\n]/.test(v) || /^- [^:]+:/m.test(v))) fail('INVALID_JOURNEY_FIELD')
  }
  const block = `\n### ${id} — ${journey.title}\n- Purpose: ${journey.purpose}\n- State: missing${specLines}\n- Representative input: ${journey.representativeInput}\n- Observable expectation: ${journey.observableExpectation}\n- Boundary: ${journey.boundary}\n`
  const nextText = text.endsWith('\n') ? text + block : text + '\n' + block
  const check = fullValidate(nextText)
  if (!check.valid) fail('RESULTING_REGISTRY_INVALID', { findings: check.findings })
  const diff = `@@ -0,0 +1,7 @@\n+${block.trim().split('\n').join('\n+')}`
  return { id, nextText, diff, hashAfter: sha(nextText) }
}
function atomicWrite(file, nextText, baseSha, create = false) {
  const current = existsSync(file) ? readFileSync(file, 'utf8') : null
  if (!create && (current === null || sha(current) !== baseSha)) fail('WRITE_CONFLICT')
  if (create && current !== null) fail('ALREADY_EXISTS')
  const mode = create ? 0o600 : lstatSync(file).mode & 0o777
  if (!create && (lstatSync(file).isSymbolicLink() || !lstatSync(file).isFile())) fail('UNSUPPORTED_TARGET')
  mkdirSync(dirname(file), { mode: 0o700, recursive: true })
  const tmp = join(dirname(file), `.e2e-registry-${process.pid}-${Date.now()}.tmp`)
  let fd
  try {
    fd = openSync(tmp, FS.O_WRONLY | FS.O_CREAT | FS.O_EXCL | FS.O_NOFOLLOW, 0o600)
    const buf = Buffer.from(nextText, 'utf8')
    let off = 0
    while (off < buf.length) off += writeSync(fd, buf, off, buf.length - off)
    fsyncSync(fd); fchmodSync(fd, mode); closeSync(fd); fd = null
    renameSync(tmp, file)
  } catch (e) { if (fd !== null) { try { closeSync(fd) } catch {} } fail('WRITE_FAILED', { reason: String(e.message) }) }
  finally { if (existsSync(tmp)) { try { unlinkSync(tmp) } catch {} } }
  const after = readFileSync(file, 'utf8')
  return { hashAfter: sha(after), verified: after === nextText, race_safe: false }
}
function bootstrapPlan(root, registryPath) {
  const approvedFiles = bootstrapProposal().files
  const actions = []
  for (const f of approvedFiles) {
    const dest = join(root, f.path)
    const safety = checkRegistryPathSafety({ registryPath: f.path, repoRoot: root })
    if (!safety.allowed && safety.code !== 'PATH_REJECTED') fail(safety.code)
    const exists = existsSync(dest)
    if (!exists) {
      actions.push({ path: f.path, action: 'create', content: f.content, before: '' })
      continue
    }
    const current = readFileSync(dest, 'utf8')
    if (current === f.content) {
      actions.push({ path: f.path, action: 'keep', content: current, before: current })
      continue
    }
    // Preserve an existing docs-map that already points at the registry.
    if (f.path !== registryPath && f.path.endsWith('docs-map.json')) {
      let parsed
      try { parsed = JSON.parse(current) } catch { fail('BOOTSTRAP_DOCSMAP_INVALID') }
      if (parsed?.registry !== registryPath) fail('BOOTSTRAP_DOCSMAP_CONFLICT', { registry: parsed?.registry })
      actions.push({ path: f.path, action: 'keep', content: current, before: current })
      continue
    }
    // A conflicting existing registry is a preflight failure, never a partial rewrite.
    fail('BOOTSTRAP_TARGET_EXISTS', { path: f.path })
  }
  if (!actions.some((a) => a.path === registryPath)) fail('BOOTSTRAP_TARGET_NOT_IN_DIFF')
  const chunks = []
  for (const a of actions) {
    if (a.action === 'keep') continue
    const beforeLines = a.before ? a.before.replace(/\n$/, '').split('\n') : []
    const afterLines = a.content.replace(/\n$/, '').split('\n')
    chunks.push(`--- ${a.action === 'create' ? '/dev/null' : 'a/' + a.path}\n+++ b/${a.path}\n@@ -1,${beforeLines.length} +1,${afterLines.length} @@\n`
      + beforeLines.map((l) => '-' + l).join('\n') + (beforeLines.length ? '\n' : '')
      + afterLines.map((l) => '+' + l).join('\n') + '\n')
  }
  return { actions, diff: chunks.join(''), writes: actions.filter((a) => a.action !== 'keep') }
}
function callChain(op, extra = {}) {
  return [
    { step: 'command', id: '/e2e', operation: op },
    { step: 'registry_tool', id: '.opencode/scripts/e2e-registry.mjs', operation: op },
    { step: 'validation', validators: VALIDATORS, operation: op },
    { step: 'controlled_writer', id: 'applyFieldScopedUpdate+atomicWrite', operation: op,
      enabled: ['apply', 'reconcile', 'bootstrap', 'append'].includes(op) },
    { step: 'registry', target: extra.target ?? 'TESTS.md' },
  ]
}
function scrubEvidence(ev) {
  return { ok: ev.ok, code: ev.code, eligible: ev.eligible, verdict: ev.verdict,
    sha256: ev.sha256, bytes: ev.bytes, artifacts_verified: ev.artifacts_verified,
    run: ev.run, spec: ev.spec, spec_sha256: ev.spec_sha256, test_node: ev.test_node, test_id: ev.test_id }
}
function output(o) { process.stdout.write(JSON.stringify(o, null, 2) + '\n') }
function requireApproval(req, diff, baseSha, operation) {
  if (typeof req.baseSha256 !== 'string' || req.baseSha256 !== baseSha) fail('WRITE_CONFLICT')
  if (typeof req.approvedDiffSha256 !== 'string' || sha(diff) !== req.approvedDiffSha256) fail('APPROVAL_MISMATCH')
  // DEC-06 requires an explicit owner decision. A digest alone is accounting, not consent.
  const a = req.authorization
  if (!a || typeof a !== 'object' || a.decision !== 'DEC-06' || a.approved_by !== 'Owner'
      || typeof a.approved_diff_sha256 !== 'string' || a.approved_diff_sha256 !== sha(diff)
      || typeof a.operation !== 'string' || a.operation !== operation) {
    fail('DEC06_APPROVAL_REQUIRED')
  }
}

function main() {
  const [operation, requestPath] = process.argv.slice(2)
  if (!operation || !requestPath) fail('USAGE: e2e-registry.mjs <op> <request.json>')
  const req = JSON.parse(readFileSync(resolve(requestPath), 'utf8'))
  const base = { operation, call_chain: callChain(operation, req), validators: VALIDATORS, registry_writes: 0, applied: false }

  if (operation === 'map') {
    const res = '.opencode/resources/e2e-journey-mapper.md'
    if (!existsSync(join(REPO, res))) fail('INTERNAL_MAPPER_MISSING')
    if (!existsSync(join(REPO, 'agents/e2e-runner.md'))) fail('RUNNER_MISSING')
    output({ ...base, status: 'OK', mapper: { resource: `internal:${res}`, legacy_command_read: 0 },
      runner: 'agents/e2e-runner.md', legacy_command_read: 0, legacy_compatibility: req.legacy === true })
    return
  }
  if (operation === 'release') {
    const d = evaluateM6Gates({
      p1WinnerVerified: req.p1WinnerVerified === true, p2ParityReport: req.p2ParityReport ?? null,
      p3RegistrySafety: { ok: req.p3Ok === true }, p4RollbackReport: req.p4RollbackReport ?? null,
      p5OwnerAuth: req.p5OwnerAuth === true, productBoundary: req.productBoundary ?? { status: 'NOT_VERIFIED' },
      a08Evidence: req.a08Evidence ?? null, mode: 'ACTUAL',
    })
    const blocked = d.gateStatus !== 'READY_FOR_OWNER_DECISION' || d.disableDefaultPermitted !== true
    output({ ...base, status: blocked ? 'BLOCKED' : 'READY', release_readiness: blocked ? 'BLOCKED' : 'READY',
      disable_default_permitted: d.disableDefaultPermitted, gate_status: d.gateStatus,
      gates: d.gates, blockers: d.blockers })
    return
  }
  if (operation === 'allocate') {
    const { root, file } = targetFor(req, true)
    const text = existsSync(file) ? readRegistry(file) : ''
    const { ids } = fullValidate(text)
    const alloc = allocateId(ids, { reserved: Array.isArray(req.reserved) ? req.reserved : [] })
    const id = alloc?.nextId ?? alloc
    output({ ...base, status: 'OK', test_id: id, next_id: id, existing_ids: ids, stable: true })
    return
  }

  if (operation === 'bootstrap-propose') {
    const root = resolve(req.repoRoot ?? REPO)
    const p = bootstrapPlan(root, req.registryPath ?? 'TESTS.md')
    output({ ...base, status: 'PROPOSED', diff: p.diff, approved_diff_sha256: sha(p.diff),
      files: p.actions.map((f) => ({ path: f.path, action: f.action, content_sha256: sha(f.content) })) })
    return
  }
  if (operation === 'bootstrap') {
    const root = resolve(req.repoRoot ?? REPO)
    const rel = req.registryPath ?? 'TESTS.md'
    const plan = bootstrapPlan(root, rel)
    const diff = plan.diff
    if (typeof req.approvedDiffSha256 !== 'string' || sha(diff) !== req.approvedDiffSha256) fail('APPROVAL_MISMATCH')
    const a = req.authorization
    if (!a || typeof a !== 'object' || a.decision !== 'DEC-06' || a.approved_by !== 'Owner'
        || a.approved_diff_sha256 !== sha(diff) || a.operation !== 'bootstrap') fail('DEC06_APPROVAL_REQUIRED')
    for (const act of plan.writes) {
      const check = act.path === rel ? fullValidate(act.content, act.path) : { valid: true, ids: [] }
      if (!check.valid) fail('RESULTING_REGISTRY_INVALID', { findings: check.findings })
    }
    const written = []
    try {
      for (const act of plan.writes) {
        const before = existsSync(join(root, act.path)) ? sha(readFileSync(join(root, act.path), 'utf8')) : sha('')
        const w = atomicWrite(join(root, act.path), act.content, before, act.action === 'create')
        written.push({ path: act.path, action: act.action, hashAfter: w.hashAfter, verified: w.verified })
      }
    } catch (e) {
      for (const w of written.filter((x) => x.action === 'create')) {
        const p = join(root, w.path)
        try { if (existsSync(p)) unlinkSync(p) } catch { /* bounded recovery */ }
      }
      fail('BOOTSTRAP_PARTIAL_RECOVERED', { reason: String(e.message), recovered: written.map((x) => x.path) })
    }
    output({ ...base, target: rel, status: 'BOOTSTRAPPED', applied: true, registry_writes: written.length,
      approved_diff_sha256: sha(diff), files: written,
      kept: plan.actions.filter((x) => x.action === 'keep').map((x) => x.path),
      blocks: fullValidate(readRegistry(join(root, rel)), rel).ids, race_safe: false })
    return
  }
  if (!['inspect','validate','propose','apply','reconcile','append','propose-append','reconcile-propose'].includes(operation)) fail('UNSUPPORTED_OPERATION')
  const { root, rel, file, safety } = targetFor(req)
  const text = readRegistry(file)
  const full = fullValidate(text, rel)
  if (!full.valid) fail('REGISTRY_INVALID', { findings: full.findings })
  const t = { ...base, target: rel, root, base_sha256: sha(text), race_limitation: 'TOCTOU_NOT_FULLY_PROVEN', path_safety: { allowed: true, race_safe: false } }
  if (operation === 'inspect' || operation === 'validate') { output({ ...t, status: 'PASS', blocks: full.ids }); return }
  const blockId = req.blockId

  if (operation === 'reconcile-propose') {
    if (typeof req.baseSha256 !== 'string' || req.baseSha256 !== t.base_sha256) fail('WRITE_CONFLICT')
    // Registered identity is authoritative. A caller proposal can never replace it.
    if (req.testProposal !== undefined) fail('TEST_PROPOSAL_NOT_ALLOWED')
    const block = full.blocks.find((b) => b.id === blockId)
    const identity = { spec: block?.fields['Test file'], sha256: block?.fields['Test file sha256'],
      node: block?.fields['Test node'] }
    if (!identity.spec || !identity.sha256 || !identity.node) fail('SPEC_IDENTITY_UNREGISTERED')
    const ev = verifyExecutionEvidence({
      evidenceRoot: resolve(req.evidenceRoot ?? t.root), evidencePath: req.evidencePath,
      expectedSha256: req.evidenceSha256, testId: blockId,
      specPath: identity.spec, specSha256: identity.sha256, testNode: identity.node,
      specRoot: t.root,
      runKey: req.runKey ?? 'happy', authorizedTarget: req.authorizedTarget ?? 'E2E_NONPROD_LOCAL_FIXTURE',
    })
    if (!ev.ok) fail('EVIDENCE_NOT_VERIFIED', { evidence: ev })
    const state = ev.eligible ? 'covered' : 'unverified'
    const outcome = { State: state, Evidence: `verified:${ev.sha256}:${ev.run.key}`,
      'Test file': ev.spec, 'Test node': ev.test_node ?? '', Command: ev.command || '' }
    const p = proposalFor(text, blockId, outcome)
    output({ ...t, status: 'PROPOSED', outcome, diff: p.diff, approved_diff_sha256: sha(p.diff),
      evidence: scrubEvidence(ev) })
    return
  }
  if (operation === 'propose-append') {
    const p = appendProposal(text, req.journey)
    output({ ...t, status: 'PROPOSED', test_id: p.id, diff: p.diff, approved_diff_sha256: sha(p.diff), next_sha256: p.hashAfter })
    return
  }
  if (operation === 'append') {
    if (blockId !== undefined && !ID_RE.test(blockId)) fail('INVALID_TARGET_ID')
    const p = appendProposal(text, req.journey)
    if (blockId && p.id !== blockId) fail('ID_ALLOCATION_MISMATCH', { allocated: p.id })
    requireApproval(req, p.diff, t.base_sha256, 'append')
    const w = atomicWrite(file, p.nextText, t.base_sha256)
    output({ ...t, status: 'APPENDED', applied: true, registry_writes: 1, test_id: p.id,
      approved_diff_sha256: sha(p.diff), hashAfter: w.hashAfter, race_safe: false })
    return
  }
  if (!ID_RE.test(blockId ?? '')) fail('INVALID_TARGET_ID')

  if (operation === 'propose') {
    const p = proposalFor(text, blockId, req.outcome ?? {})
    output({ ...t, status: 'PROPOSED', diff: p.diff, approved_diff_sha256: sha(p.diff), next_sha256: p.hashAfter, changes: p.changes })
    return
  }

  if (operation === 'reconcile') {
    // Bind to expected base hash before any evidence work or write.
    if (typeof req.baseSha256 !== 'string' || req.baseSha256 !== t.base_sha256) fail('WRITE_CONFLICT')
    // Registered identity is authoritative. A caller proposal can never replace it.
    if (req.testProposal !== undefined) fail('TEST_PROPOSAL_NOT_ALLOWED')
    const block = full.blocks.find((b) => b.id === blockId)
    const identity = { spec: block?.fields['Test file'], sha256: block?.fields['Test file sha256'],
      node: block?.fields['Test node'] }
    if (!identity.spec || !identity.sha256 || !identity.node) fail('SPEC_IDENTITY_UNREGISTERED')
    const ev = verifyExecutionEvidence({
      evidenceRoot: resolve(req.evidenceRoot ?? t.root), evidencePath: req.evidencePath,
      expectedSha256: req.evidenceSha256, testId: blockId,
      specPath: identity.spec, specSha256: identity.sha256, testNode: identity.node,
      specRoot: t.root,
      runKey: req.runKey ?? 'happy', authorizedTarget: req.authorizedTarget ?? 'E2E_NONPROD_LOCAL_FIXTURE',
    })
    if (!ev.ok) fail('EVIDENCE_NOT_VERIFIED', { evidence: ev })
    const state = ev.eligible ? 'covered' : 'unverified'
    // Bind the registry fields to the verified evidence, not to caller text.
    const outcome = { State: state,
      Evidence: `verified:${ev.sha256}:${ev.run.key}`,
      'Test file': ev.spec,
      'Test node': ev.test_node ?? '',
      Command: ev.command || '' }
    for (const [k, v] of Object.entries(outcome)) {
      if (typeof v !== 'string' || /[\r\n]/.test(v)) fail('EVIDENCE_FIELD_INVALID', { field: k })
    }
    const p = proposalFor(text, blockId, outcome)
    // DEC-06: explicit owner decision plus the exact recomputed diff.
    requireApproval(req, p.diff, t.base_sha256, 'reconcile')
    const conflict = m5Conflict({ hashBefore: req.baseSha256, hashNow: sha(text), diff: p.diff })
    if (conflict.conflict) fail('WRITE_CONFLICT')
    const w = atomicWrite(file, p.nextText, t.base_sha256)
    output({ ...t, status: 'RECONCILED', applied: true, registry_writes: 1, outcome: { State: state },
      coverage_credit: state === 'covered', evidence: scrubEvidence(ev), approved_diff_sha256: sha(p.diff),
      hashAfter: w.hashAfter, race_safe: false })
    return
  }

  if ((req.outcome ?? {}).State === 'covered') fail('COVERAGE_REQUIRES_RECONCILE')
  requireApproval(req, proposalFor(text, blockId, req.outcome ?? {}).diff, t.base_sha256, 'apply')
  const p = proposalFor(text, blockId, req.outcome ?? {})
  const conflict = m5Conflict({ hashBefore: req.baseSha256, hashNow: sha(text), diff: p.diff })
  if (conflict.conflict) fail('WRITE_CONFLICT')
  const w = atomicWrite(file, p.nextText, t.base_sha256)
  output({ ...t, status: 'APPLIED', applied: true, registry_writes: 1, changes: p.changes, hashAfter: w.hashAfter,
    verified: w.verified, race_safe: false, write_conflict: false })
}

try { main() } catch (e) {
  output({ status: 'BLOCKED', code: e.code ?? 'ERROR', reason: String(e.message), ...(e.extra ?? {}) })
  process.exitCode = 1
}
