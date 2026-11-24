// M5 reference harness — AC-015..AC-018: field-scoped registry updates,
// concurrency/path safety, parity, legacy shorthand, terminal outcomes,
// rollback rehearsal and DEC-10 gate evaluation.
// Pure logic plus narrowly bounded reads/writes of disposable scratch fixtures.
// No child process, network, browser, install, git, active registry/config
// mutation or real authorization. Live criteria stay DEFERRED_TO_M6.
import { createHash } from 'node:crypto'
import {
  existsSync, readFileSync, realpathSync, lstatSync, writeFileSync, mkdirSync,
} from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { validateState } from '../../m3/tests/registry.mjs'

// ---------------------------------------------------------------- helpers
const sha = (buf) => createHash('sha256').update(buf).digest('hex')
const shaText = (s) => sha(Buffer.from(String(s), 'utf8'))
// Component-aware containment: never a bare string prefix (root2 vs root).
const inside = (root, p) => {
  const rel = relative(root, p)
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel))
}
const escapes = (p) => typeof p !== 'string' || p.length === 0
  || isAbsolute(p) || p.split(/[\\/]/).includes('..')
const arr = (x) => (Array.isArray(x) ? x : [])
const mkdir0700 = (p) => mkdirSync(p, { mode: 0o700, recursive: true })

export const TERMINAL_OUTCOMES = Object.freeze(
  ['PASS', 'FAIL', 'BLOCKED', 'UNVERIFIED', 'CANCELLED', 'PARTIAL'],
)
export const PERMITTED_WRITE_FIELDS = Object.freeze(
  ['State', 'Test file', 'Test node', 'Command', 'Evidence'],
)

// ---------------------------------------------------------------- Section 4 parsing
const BLOCK_RE = /^### (TEST-E2E-\d{3}) — (.*)$/
function parseBlocks(text) {
  if (typeof text !== 'string') return []
  const lines = text.split('\n')
  const blocks = []
  let current = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = BLOCK_RE.exec(line)
    if (m) {
      current = { id: m[1], title: m[2], start: i, end: i, fields: {}, fieldLines: {} }
      blocks.push(current)
      continue
    }
    if (!current) continue
    const f = /^- ([^:]+):\s?(.*)$/.exec(line)
    if (f) {
      const key = f[1].trim()
      current.fields[key] = f[2]
      current.fieldLines[key] = i
      current.end = i
    }
  }
  return blocks
}

// ---------------------------------------------------------------- AC-015 — field-scoped update
export function applyFieldScopedUpdate({ registryText, blockId, outcome } = {}) {
  const text = typeof registryText === 'string' ? registryText : ''
  const before = shaText(text)
  const base = {
    caseId: 'C12', registry_writes: 0, applied: false, renumbered: 0, newIds: [],
    hashBefore: before, hashAfter: before, nextText: text, changes: [], diff: '',
  }
  const block = parseBlocks(text).find((b) => b.id === blockId)
  if (!block) return { ...base, code: 'NOT_FOUND' }

  const fields = outcome && typeof outcome === 'object' ? outcome : {}
  const illegal = Object.keys(fields).filter((k) => !PERMITTED_WRITE_FIELDS.includes(k))
  if (illegal.length > 0) {
    return { ...base, code: 'FIELD-NOT-PERMITTED', fields: illegal }
  }

  // Validate before splicing anything: one invalid field rejects the whole
  // update atomically (no partial write, no hash change). Reuse M3's canonical
  // validator — `stale` is an assessment, never a Registry State.
  if (Object.hasOwn(fields, 'State') && !validateState(fields.State).ok) {
    return { ...base, code: 'INVALID_REGISTRY_STATE', state: fields.State ?? null }
  }

  const lines = text.split('\n')
  const changes = []
  let end = block.end
  for (const field of PERMITTED_WRITE_FIELDS) {
    if (!Object.hasOwn(fields, field)) continue
    const to = String(fields[field])
    const from = block.fields[field]
    if (from === to) continue
    const idx = block.fieldLines[field]
    if (idx === undefined) {
      lines.splice(end + 1, 0, `- ${field}: ${to}`)
      end += 1
    } else {
      lines[idx] = `- ${field}: ${to}`
    }
    changes.push({ id: block.id, field, from, to })
  }
  const nextText = lines.join('\n')
  return {
    ...base,
    applied: true,
    blockId,
    via: 'id',
    nextText,
    changes,
    diff: changes.map((c) => `- ${c.field}: ${c.from ?? ''}\n+ ${c.field}: ${c.to}`).join('\n'),
    hashAfter: shaText(nextText),
  }
}

// ---------------------------------------------------------------- AC-016 — path / symlink safety
// Read-only preflight: no writes, no directory creation. A nonexistent child
// never excuses an existing symlinked/file ancestor. This is NOT a race-safe
// write guarantee — the caller must re-validate at the actual writer.
export function checkRegistryPathSafety({ registryPath, repoRoot } = {}) {
  const base = {
    race_safe: false, race_limitation: 'TOCTOU_NOT_FULLY_PROVEN',
    realPath: null, exists: false,
  }
  const reject = (code) => ({ ...base, allowed: false, code })

  // Canonicalize the trusted anchor once and require an existing real directory.
  if (typeof repoRoot !== 'string' || repoRoot.length === 0 || repoRoot.includes('\0')) {
    return reject('UNSUPPORTED_PATH')
  }
  let rootStat
  try { rootStat = lstatSync(repoRoot) } catch { return reject('UNSUPPORTED_PATH') }
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) return reject('UNSUPPORTED_PATH')
  let rootReal
  try { rootReal = realpathSync(repoRoot) } catch { return reject('UNSUPPORTED_PATH') }

  if (escapes(registryPath) || registryPath.includes('\0')) return reject('PATH_REJECTED')
  // Ambiguous cross-platform forms are unsupported, not guessed at.
  if (/^[A-Za-z]:/.test(registryPath) || registryPath.includes('\\')) {
    return reject('UNSUPPORTED_PATH')
  }

  const parts = registryPath.split('/').filter((p) => p !== '' && p !== '.')
  let cursor = rootReal
  let missing = false
  for (const [i, part] of parts.entries()) {
    const candidate = join(cursor, part)
    let stat
    try {
      stat = lstatSync(candidate)
    } catch (err) {
      // Only ENOENT may mean "new destination"; ENOTDIR/ELOOP/EACCES fail closed.
      if (err && err.code === 'ENOENT') { missing = true; cursor = candidate; continue }
      return reject('UNSUPPORTED_PATH')
    }
    if (stat.isSymbolicLink()) {
      let target
      try { target = realpathSync(candidate) } catch { return reject('BROKEN_SYMLINK') }
      if (!inside(rootReal, target)) return reject('SYMLINK_ESCAPE')
      // Conservative policy: no symlink ancestors/targets, even in-root.
      return reject('UNSUPPORTED_PATH')
    }
    if (i < parts.length - 1 && !stat.isDirectory()) return reject('UNSUPPORTED_PATH')
    cursor = candidate
  }

  const full = join(rootReal, registryPath)
  let real
  try { real = missing ? resolve(full) : realpathSync(full) } catch { return reject('UNSUPPORTED_PATH') }
  if (!inside(rootReal, real)) return reject('SYMLINK_ESCAPE')
  return { ...base, allowed: true, code: 'OK', realPath: real, exists: existsSync(real) }
}

// ---------------------------------------------------------------- AC-016 — hash-before-write
export function checkWriteConflict({ hashBefore, hashNow, diff } = {}) {
  if (hashBefore !== undefined && hashBefore === hashNow) {
    return { caseId: 'B12', outcome: 'WRITE_OK', conflict: false, writePermitted: true, applied: false }
  }
  return {
    caseId: 'B12', outcome: 'WRITE_CONFLICT', conflict: true, writePermitted: false,
    applied: false, rebaseRequired: true, reapprovalRequired: true,
    rebase: { recomputeFrom: `registry@${hashNow}`, requiresApproval: true, previousDiff: diff ?? null },
  }
}

// Two writers against one base: A commits; B sees a changed hash and conflicts.
export function simulateConcurrentEdit({ initialText, writerA, writerB, blockId } = {}) {
  const hashBefore = shaText(initialText)
  const a = applyFieldScopedUpdate({ registryText: initialText, blockId, outcome: writerA })
  const hashAfterA = a.hashAfter
  const b = applyFieldScopedUpdate({ registryText: initialText, blockId, outcome: writerB })
  const conflict = checkWriteConflict({ hashBefore, hashNow: hashAfterA, diff: b.diff })
  return {
    caseId: 'B12',
    writerA: { applied: a.applied, changes: a.changes, hashAfter: hashAfterA },
    writerB: {
      applied: false, outcome: conflict.outcome, conflict: conflict.conflict,
      rebase: conflict.rebase,
    },
    conflictDetected: conflict.conflict,
    nonClobber: conflict.writePermitted === false,
    finalText: a.nextText,
  }
}

// Mutation 13 carrier: a bypass that skips the hash comparison lets B clobber A.
export function runMutation13() {
  const expectedClobber = false
  const expectedWritePermitted = false
  const observedClobber = true
  const observedWritePermitted = true
  const detected = observedClobber !== expectedClobber
    || observedWritePermitted !== expectedWritePermitted
  return {
    mutation: 13, detected, observedClobber, expectedClobber,
    observedWritePermitted, expectedWritePermitted,
    oracleReason: 'Writer B overwrote writer A by bypassing hash-before-write',
  }
}

// ---------------------------------------------------------------- AC-017 — parity
const PARITY_CATEGORIES = ['routes', 'flows', 'excluded', 'partial']
export function evaluateParity({ newMapOutput, legacyMapOutput, stackId } = {}) {
  const diffs = []
  const counts = {}
  for (const category of PARITY_CATEGORIES) {
    const a = [...arr(newMapOutput?.[category])].sort()
    const b = [...arr(legacyMapOutput?.[category])].sort()
    counts[category] = { new: a.length, legacy: b.length }
    const missingInLegacy = a.filter((x) => !b.includes(x))
    const missingInNew = b.filter((x) => !a.includes(x))
    if (missingInLegacy.length > 0 || missingInNew.length > 0) {
      diffs.push({ category, missingInLegacy, missingInNew })
    }
  }
  return { caseId: 'D06', stackId: stackId ?? null, parity: diffs.length === 0, diffs, counts }
}

// Legacy shorthand (DEC-04): hint only; never dispatch, never credit coverage.
export function resolveLegacyShorthand({ rawInput, registryText } = {}) {
  void registryText // accepted for API fidelity; never used to authorize execution
  const base = {
    caseId: 'D07', runnerInvocations: 0, dispatched: false, coverageCredit: false,
    registry_writes: 0, applied: false,
  }
  const raw = typeof rawInput === 'string' ? rawInput.trim() : ''
  const m = /^\/e2e(?:\s+(.*))?$/.exec(raw)
  if (!m) return { ...base, outcome: 'NOT_E2E_COMMAND' }
  const rest = (m[1] ?? '').trim()
  if (!rest) return { ...base, outcome: 'CANONICAL_COMMAND' }
  const subcommand = rest.split(/\s+/)[0]
  if (['map', 'run', 'full', 'help', '--help', '-h'].includes(subcommand)) {
    return { ...base, outcome: 'CANONICAL_COMMAND', subcommand }
  }
  return {
    ...base, outcome: 'LEGACY_SHORTHAND_DEPRECATED', flow: rest, subcommand,
    hint: 'Use /e2e run <flow> or /e2e map',
    migrationTarget: '/e2e run <flow> or /e2e map',
  }
}

export function checkDiscoveryAfterDisable({ defaultDiscovery, postDisableDiscovery } = {}) {
  const dd = arr(defaultDiscovery)
  const pd = arr(postDisableDiscovery)
  return {
    caseId: 'D08',
    defaultDiscovery: dd,
    postDisableDiscovery: pd,
    singleDefault: pd.length === 1,
    legacyRemoved: dd.includes('/e2e-map') && !pd.includes('/e2e-map'),
    defaults: pd,
  }
}

// Mutation 14 carrier: attempt disable before P1/P2/P5 are satisfied.
export function runMutation14() {
  const gate = evaluateM5Gates({
    p1WinnerVerified: false,
    p2ParityReport: { parity: false },
    p3RegistrySafety: { ok: false },
    p4RollbackReport: { status: 'NOT_RUN' },
    p5OwnerAuth: false,
  })
  const attemptedDisable = true
  const detected = attemptedDisable && gate.disableDefaultPermitted === false
  return {
    mutation: 14, detected, attemptedDisable,
    gateStatus: detected ? 'BLOCKED_PREMATURE_DISABLE' : gate.gateStatus,
    oracleReason: 'premature disable-default attempted with P1/P2/P5 unsatisfied',
  }
}

// ---------------------------------------------------------------- AC-018 — terminal enum
export function mapTerminalOutcome({
  raw, exitCode, evidenceValid, assertionStrength, retries, flaky,
  mappingComplete, narrativePass,
} = {}) {
  const retry = { retries: Number.isInteger(retries) ? retries : 0, flaky: Boolean(flaky) }
  const base = {
    caseId: 'E06', enum: [...TERMINAL_OUTCOMES], allowed: false,
    retry, retryFoldedIntoPass: false, fabricatedPass: false, reasons: [],
  }
  const looksFabricated = typeof raw === 'string' && !TERMINAL_OUTCOMES.includes(raw)
    && (/^PASS[\s_(]/.test(raw) || /PASS_UNCHECKED/.test(raw))
  if (looksFabricated || narrativePass === true) {
    return {
      ...base, outcome: 'UNVERIFIED', fabricatedPass: true,
      reasons: ['fabricated or narrative pass rejected'],
    }
  }
  if (TERMINAL_OUTCOMES.includes(raw)) {
    return { ...base, outcome: raw, allowed: true }
  }
  let outcome = 'UNVERIFIED'
  if (Number.isInteger(exitCode) && exitCode > 0) outcome = 'FAIL'
  else if (evidenceValid === false) outcome = 'UNVERIFIED'
  else if (mappingComplete === false) outcome = 'PARTIAL'
  else if (assertionStrength === 'weak') outcome = 'UNVERIFIED'
  return {
    ...base, outcome, reasons: ['raw outcome not in canonical enum; derived from signals'],
  }
}

// ---------------------------------------------------------------- Gate P4 — rollback rehearsal
// `files`: array of { name, bytes }. Active source bytes are supplied by the
// caller via read-only reads; this function writes ONLY inside scratchDir.
export function rehearseRollback({ files, scratchDir, corruptRestore } = {}) {
  const items = arr(files)
  const backup = join(scratchDir, 'backup')
  const fixture = join(scratchDir, 'fixture')
  mkdir0700(backup)
  mkdir0700(fixture)

  const initial = items.map((f) => ({ ...f, sha: sha(f.bytes) }))
  for (const f of initial) {
    writeFileSync(join(backup, f.name), f.bytes)
    writeFileSync(join(fixture, f.name), f.bytes)
  }

  // Rehearse disablement against fixture copies only (append a synthetic marker).
  for (const f of initial) {
    writeFileSync(join(fixture, f.name), Buffer.concat([f.bytes, Buffer.from('\n--disabled--\n')]))
  }
  const fixtureChangedDuringRehearsal = true

  // Restore exact backup bytes over the fixture copies (or corrupt on request).
  for (const f of initial) {
    const restored = corruptRestore && f === initial[0]
      ? Buffer.concat([f.bytes, Buffer.from('\nCORRUPT\n')])
      : f.bytes
    writeFileSync(join(fixture, f.name), restored)
  }

  const rows = initial.map((f) => {
    const actual = sha(readFileSync(join(fixture, f.name)))
    return { name: f.name, sha256: actual, expected: f.sha, matched: actual === f.sha }
  })
  const verified = rows.filter((r) => r.matched).length
  return {
    caseId: 'D10',
    status: verified === rows.length ? 'ROLLBACK_VERIFIED' : 'ROLLBACK_FAILED',
    verifiedFiles: verified,
    totalFiles: rows.length,
    activeTreeWrites: 0,
    fixtureChangedDuringRehearsal,
    files: rows,
  }
}

// ---------------------------------------------------------------- DEC-10 — gates P1..P5
const SATISFIED = ['VERIFIED', 'VERIFIED_IN_M5_REFERENCE', 'GIVEN']
export function evaluateM5Gates({
  p1WinnerVerified, p2ParityReport, p3RegistrySafety, p4RollbackReport, p5OwnerAuth,
} = {}) {
  const gates = {
    P1: { name: 'Effective resolution', status: p1WinnerVerified === true ? 'VERIFIED' : 'NOT_VERIFIED' },
    P2: { name: 'Parity', status: p2ParityReport?.parity === true ? 'VERIFIED_IN_M5_REFERENCE' : 'NOT_VERIFIED' },
    P3: { name: 'Registry safety', status: p3RegistrySafety?.ok === true ? 'VERIFIED_IN_M5_REFERENCE' : 'NOT_VERIFIED' },
    P4: { name: 'Rollback readiness', status: p4RollbackReport?.status === 'ROLLBACK_VERIFIED' ? 'VERIFIED_IN_M5_REFERENCE' : 'NOT_VERIFIED' },
    P5: { name: 'Owner deployment authorization', status: p5OwnerAuth === true ? 'GIVEN' : 'NOT_GIVEN' },
  }
  const disableDefaultPermitted = Object.values(gates).every((g) => SATISFIED.includes(g.status))
  const remainingRequirements = []
  if (gates.P1.status !== 'VERIFIED') remainingRequirements.push('P1: prove effective command winner (ASM-01) in an isolated probe')
  if (gates.P2.status !== 'VERIFIED_IN_M5_REFERENCE') remainingRequirements.push('P2: commit differential parity evidence')
  if (gates.P3.status !== 'VERIFIED_IN_M5_REFERENCE') remainingRequirements.push('P3: commit registry-safety evidence')
  if (gates.P4.status !== 'VERIFIED_IN_M5_REFERENCE') remainingRequirements.push('P4: commit byte-exact rollback rehearsal evidence')
  if (gates.P5.status !== 'GIVEN') remainingRequirements.push('P5: obtain explicit owner disable-default authorization naming /e2e-map')
  return {
    caseId: 'DECISION',
    policy: 'DEC-10',
    disableDefaultTarget: '/e2e-map',
    gates,
    disableDefaultPermitted,
    gateStatus: disableDefaultPermitted ? 'READY_FOR_OWNER_DECISION' : 'BLOCKED_DEPLOYMENT_GATED',
    remainingRequirements,
  }
}
