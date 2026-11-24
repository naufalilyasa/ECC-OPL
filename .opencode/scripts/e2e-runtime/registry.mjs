// M3 reference registry lifecycle — the normative, testable encoding of
// REGISTRY-CONTRACT.md (R1) that `.opencode/commands/e2e.md` mirrors.
// Zero dependency; no filesystem writes, no child processes, no network.
// Every result carries its frozen case ID (C02, C03, A08, B08, B09, B12, B10-ext).

// Owner-approved bootstrap diff, transcribed verbatim from
// m3m5m6-proposals/M3-REGISTRY-DIFF-PROPOSAL.md §3 (proposal SHA-256 50070450…).
// Do not edit this constant: the preflight re-hashes the proposal, and BOOTSTRAP
// byte-compares the generator against it. A mismatch is a STOP, not a fix.
export const APPROVED_BOOTSTRAP_DIFF = `--- /dev/null
+++ b/TESTS.md
@@ -0,0 +1,26 @@
+# E2E Test Registry (ECC-OPL)
+<!-- Generated proposal. Owner approval required before any later field write. -->
+
+## Section 2 — Journey index
+<!-- One row per stable journey. ID owns identity; route title is data only. -->
+| ID | Journey | Source | Level | Execution group | State |
+|---|---|---|---|---|---|
+
+## Section 4 — Test blocks
+<!-- Block fields: Purpose, Source, Representative input, Observable expectation, Level, Execution group, Boundary, State, Test file, Test node, Command, Evidence -->
+<!-- Writable by a verified run: State, Test file, Test node, Command, Evidence only. -->
+<!-- Bootstrap is EMPTY: no test ID is fabricated before a real mapping/verified run. -->
+
+--- /dev/null
+++ b/.governance/docs-map.json
@@ -0,0 +1,6 @@
+{
+  "schema": "ecc-opl.e2e-docs-map/v1",
+  "registry": "TESTS.md",
+  "journeys": [],
+  "note": "Bootstrap empty; entries are added only through approved map/run outcomes."
+}` + '\n'

// Registry State enum: exactly the five controlled values (DEC-12 — `stale` is an
// assessment, never a State).
export const STATE_ENUM = ['missing', 'in progress', 'unverified', 'covered', 'not applicable']

// Only these Section 4 fields may move on a verified pass (REGISTRY-CONTRACT §Permitted write fields).
export const PERMITTED_WRITE_FIELDS = ['State', 'Test file', 'Test node', 'Command', 'Evidence']

// The `full` stage order (PRD E2E-FR-007 / A08).
export const FULL_STAGES = ['discovery', 'review', 'registry', 'generate', 'run', 'evidence']

const ID_RE = /^TEST-E2E-(\d{3})$/
const BLOCK_RE = /^### (TEST-E2E-\d{3}) — (.*)$/

// ---------- diff / registry parsing ----------

// Derives the two file bodies from the approved unified diff. The proposal writes
// nothing; these bodies exist only as a target for a later, authorized write.
export function parseUnifiedDiff(diff) {
  const files = []
  let current = null
  for (const line of diff.split('\n')) {
    if (line.startsWith('--- ')) { current = null; continue }
    if (line.startsWith('+++ ')) {
      current = { path: line.slice(4).replace(/^b\//, ''), action: 'create', lines: [] }
      files.push(current)
      continue
    }
    if (line.startsWith('@@') || line.startsWith('+++')) continue
    if (current && line.startsWith('+')) {
      const v = line.slice(1)
      if (v === '--- /dev/null') continue
      current.lines.push(v)
    }
  }
  return files.map((f) => ({ path: f.path, action: f.action, content: f.lines.join('\n') + '\n' }))
}

export function bootstrapProposal() {
  return { caseId: 'BOOTSTRAP', diff: APPROVED_BOOTSTRAP_DIFF, files: parseUnifiedDiff(APPROVED_BOOTSTRAP_DIFF), writes: [] }
}

// Section 4 blocks are `### TEST-E2E-NNN — title` followed by `- Field: value` lines.
// A malformed ID row is rejected, never normalised (G10).
export function parseRegistry(text) {
  if (typeof text !== 'string') return { ids: [], blocks: [] }
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
    if (/^###\s/.test(line) && line.includes('TEST-E2E-')) {
      throw new Error(`malformed registry ID row: ${line}`)
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
  return { ids: blocks.map((b) => b.id), blocks }
}

// ---------- match order: exact ID wins; title similarity never authorises an edit ----------

export function matchBlock(registryText, query = {}) {
  const { blocks } = parseRegistry(registryText)
  if (typeof query.id === 'string' && ID_RE.test(query.id)) {
    const block = blocks.find((b) => b.id === query.id)
    if (block) return { caseId: 'MATCH', via: 'id', authorized: true, block }
  }
  if (query.journey && query.source) {
    const block = blocks.find((b) => b.fields.Source === query.source && b.title.includes(query.journey))
    if (block) return { caseId: 'MATCH', via: 'journey+source', authorized: true, block }
  }
  if (typeof query.title === 'string' && query.title) {
    const block = blocks.find((b) => b.title === query.title || b.title.includes(query.title))
    if (block) {
      return {
        caseId: 'MATCH',
        via: 'title',
        authorized: false,
        block,
        reason: 'title-similarity alone never authorizes a destructive edit',
      }
    }
  }
  return { caseId: 'MATCH', via: null, authorized: false, block: null, code: 'NOT_FOUND' }
}

// ---------- ID ownership: actual numeric max + 1, 001 base, reserved never reused ----------

function idNumber(id) {
  const m = ID_RE.exec(String(id))
  if (!m) throw new Error(`malformed registry ID: ${id}`)
  return Number(m[1])
}

export function allocateId(existingIds = [], { reserved = [] } = {}) {
  const nums = existingIds.map(idNumber)
  const max = nums.length ? Math.max(...nums) : 0
  let next = nums.length ? max + 1 : 1
  const reservedNums = new Set(reserved.map(idNumber))
  while (reservedNums.has(next)) next += 1
  return { caseId: 'ID-ALLOC', nextId: `TEST-E2E-${String(next).padStart(3, '0')}`, max }
}

export function proposeNewFlow({ registryText, journey, source } = {}) {
  const { ids } = parseRegistry(registryText)
  return { caseId: 'B09', id: allocateId(ids).nextId, journey, source, requiresApproval: true, writes: 0 }
}

// ---------- permitted-field-only splice on the matched block ----------

export function applyVerifiedPass({ registryText, blockId, outcome = {}, query } = {}) {
  const match = query ? matchBlock(registryText, query) : matchBlock(registryText, { id: blockId })
  if (!match.block) return { caseId: 'B08', applied: false, code: 'NOT_FOUND', nextText: registryText, changes: [], renumbered: 0, newIds: [] }
  if (!match.authorized) {
    return { caseId: 'B08', applied: false, code: 'TITLE_ONLY_NOT_AUTHORIZED', nextText: registryText, changes: [], renumbered: 0, newIds: [], reason: match.reason }
  }

  const illegal = Object.keys(outcome).filter((k) => !PERMITTED_WRITE_FIELDS.includes(k))
  if (illegal.length > 0) {
    return { caseId: 'B08', applied: false, code: 'FIELD-NOT-PERMITTED', fields: illegal, nextText: registryText, changes: [], renumbered: 0, newIds: [] }
  }

  const lines = registryText.split('\n')
  const changes = []
  const block = match.block
  let end = block.end
  for (const field of PERMITTED_WRITE_FIELDS) {
    if (!(field in outcome)) continue
    const to = String(outcome[field])
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

  return {
    caseId: 'B08',
    applied: true,
    blockId: block.id,
    via: match.via,
    nextText: lines.join('\n'),
    changes,
    diff: changes.map((c) => `- ${c.field}: ${c.from ?? ''}\n+ ${c.field}: ${c.to}`).join('\n'),
    renumbered: 0,
    newIds: [],
  }
}

// ---------- run: resolve, ad-hoc labeling, REGISTRY_REQUIRED ----------

export function resolveRun({ registryText, target, adHoc = false, runnerOutcome, targetEnvironment = 'non-production' } = {}) {
  const text = typeof registryText === 'string' ? registryText : ''
  const match = target ? matchBlock(text, { id: target, title: target }) : { block: null, authorized: false }
  const registered = Boolean(match.block && match.authorized)

  if (registered) {
    return { caseId: 'RUN', outcome: 'RESOLVED', blockId: match.block.id, requiresExecution: true, dispatched: false, registryChanged: false }
  }

  if (!adHoc) {
    return {
      caseId: 'C02',
      outcome: 'REGISTRY_REQUIRED',
      dispatched: false,
      runnerInvocations: 0,
      registryChanged: false,
      next: 'flow belum terdaftar — jalankan /e2e-map',
    }
  }

  if (targetEnvironment !== 'non-production') {
    return {
      caseId: 'C03',
      outcome: 'BLOCKED',
      dispatched: false,
      runnerInvocations: 0,
      registryChanged: false,
      reason: `ad-hoc execution refused for ${targetEnvironment} target (DEC-07)`,
    }
  }

  const base = { caseId: 'C03', registryAfter: text, registryChanged: false, coverageCredit: false }
  if (runnerOutcome !== 'PASS') {
    return { ...base, outcome: runnerOutcome === 'SKIP' ? 'NOT_EXECUTED' : 'NOT_EXECUTED', dispatched: Boolean(runnerOutcome) }
  }
  return { ...base, outcome: 'PASS_AD_HOC_UNREGISTERED', dispatched: true, runnerInvocations: 1 }
}

// ---------- A08: full-phase trace, gates halt the chain before the stage they guard ----------

export function fullPhaseTrace({ gates = {} } = {}) {
  const completed = []
  for (const stage of FULL_STAGES) {
    if (stage === 'registry' && gates.registryApproved !== true) {
      return { caseId: 'A08', stages: FULL_STAGES, completed, skipped: [], haltedAt: 'registry', outcome: 'BLOCKED', dispatched: false, reason: 'registry approval gate not satisfied (DEC-06)' }
    }
    if (stage === 'run' && gates.environmentAuthorized !== true) {
      return { caseId: 'A08', stages: FULL_STAGES, completed, skipped: [], haltedAt: 'run', outcome: 'BLOCKED', dispatched: false, reason: 'environment gate not authorized (DEC-07); BLOCKED sebelum spawn' }
    }
    completed.push(stage)
  }
  return { caseId: 'A08', stages: FULL_STAGES, completed, skipped: [], haltedAt: null, outcome: 'COMPLETE', dispatched: true }
}

// ---------- B12: hash-before-write, conflict never clobbers ----------

export function checkWriteConflict({ hashBefore, hashNow, diff } = {}) {
  if (hashBefore !== undefined && hashBefore === hashNow) {
    return { caseId: 'B12', outcome: 'WRITE_OK', conflict: false, writePermitted: true, applied: false }
  }
  return {
    caseId: 'B12',
    outcome: 'WRITE_CONFLICT',
    conflict: true,
    writePermitted: false,
    applied: false,
    rebaseRequired: true,
    reapprovalRequired: true,
    rebase: { recomputeFrom: `registry@${hashNow}`, requiresApproval: true, previousDiff: diff ?? null },
  }
}

export function cancelApproval({ reason } = {}) {
  return { caseId: 'CANCELLED', outcome: 'CANCELLED', reason: reason ?? 'approval denied or aborted', action: 'none', writePermitted: false, registryChanged: false }
}

// ---------- AC-010 / DEC-12: stale is an assessment, never a State ----------

export function validateState(value) {
  if (STATE_ENUM.includes(value)) return { ok: true, state: value }
  return { ok: false, code: 'STATE-INVALID', reason: `State "${value}" is outside the 5 controlled values` }
}

export function assessLegacyStale(row = {}) {
  const state = row.State
  if (state === 'stale') {
    return {
      caseId: 'B10-ext',
      id: row.id,
      ok: false,
      code: 'B10',
      schemaMismatch: true,
      assessment: 'stale',
      applied: false,
      proposal: { decision: 'DEC-12', field: 'State', from: 'stale', to: 'unverified' },
      reason: 'legacy State: stale is an assessment, not a Registry State; propose the correction (DEC-12)',
    }
  }
  const v = validateState(state)
  if (!v.ok) {
    return { caseId: 'B10-ext', id: row.id, ok: false, code: 'STATE-INVALID', schemaMismatch: true, applied: false, proposal: null, reason: v.reason }
  }
  return { caseId: 'B10-ext', id: row.id, ok: true, applied: false, proposal: null }
}
