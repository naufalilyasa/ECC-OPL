// M1 (ECC-OPL /e2e V2.0) evidence-and-contract checks.
// Read-only: re-derives every fact from live sources and the R1 bundle ZIP.
// Run: node --test docs/e2e-v2/m1/tests/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const thisDir = dirname(fileURLToPath(import.meta.url))
// Portable root & E2E resolution: works in-repo (docs/e2e-v2/m1/tests) or in package (artifacts/m1/tests)
const E2E = existsSync(join(thisDir, '../../contracts/command-contract.md'))
  ? join(thisDir, '../..')
  : join(thisDir, '../../../../docs/e2e-v2')
const M1 = join(E2E, 'm1')
const REP = join(M1, 'reports')
const ROOT = process.env.ECC_ROOT || (existsSync(join(thisDir, '../../../../.opencode'))
  ? join(thisDir, '../../../..')
  : '/Users/ctp-itdev2/ECC')
const DEFAULT_ZIP = '/Users/ctp-itdev2/ecc-opl-e2e-v2.0-prd-r1-external-review.zip'
const ZIP = process.env.E2E_R1_ZIP || DEFAULT_ZIP
if (!existsSync(ZIP)) {
  throw new Error(`BLOCKED_INPUT_MISSING: R1 PRD ZIP not found at ${ZIP}`)
}
const BUNDLE = 'ecc-opl-e2e-v2.0-prd-r1-external-review'
const PRD_DIGEST = '047918df0835bc7ea52f0d0dc7714f0b29394cce32ad8c2580b2973dfce1d211'

const sha = (p) => execFileSync('shasum', ['-a', '256', p], { encoding: 'utf8' }).split(/\s+/)[0]
const zipEntry = (name) => execFileSync('unzip', ['-p', ZIP, `${BUNDLE}/${name}`], { encoding: 'utf8', maxBuffer: 1 << 26 })
const zipEntrySha = (name) =>
  execFileSync('sh', ['-c', `unzip -p "$1" "$2" | shasum -a 256`, 'sh', ZIP, `${BUNDLE}/${name}`], { encoding: 'utf8' }).split(/\s+/)[0]
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const md = (p) => readFileSync(p, 'utf8')

// Minimal RFC4180 reader — independent of whatever produced the report.
function parseCsv(text) {
  const rows = []
  let row = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (c !== '\r') cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.length > 1)
}

// SOURCE-BASELINE.md values, transcribed from the R1 bundle (authoritative reference).
const BASELINE = {
  '.opencode/commands/e2e.md': '08b17f2cb765665b753374265bc8f78df2599c3505c2245107dd6888061b95dd',
  '.opencode/commands/e2e-map.md': '76b3d4037a0144df2d40dc0eca01777690762a7cccc5d9562b0330333dfdb142',
  'agents/e2e-runner.md': '94811f4bbc491c351cdf220ab103d6bd251fb1d88d9d46ba4c8162637a236a5b',
  '.opencode/prompts/agents/e2e-runner.txt': 'd7442445cbb276cb88d6cca5339b50ec3247683ed78ea512ccf4627ed666ad08',
  'legacy-command-shims/commands/e2e.md': '97ef29c9355344bd25b4e963e519f3eaf5b0c6f43a9174f47c9c5d1b4dbb579e',
  'skills/test-collaboration/SKILL.md': '741138330940e2c9d3cc7bec9e671787f24a361ff89be44e09a56abc8e10dcfa',
  'skills/e2e-testing/SKILL.md': 'b0e00e7e17cb259101139900816c5528aed18dd10bcf5f9cb42cfc35baf8a755',
  'skills/click-path-audit/SKILL.md': '662fc5d02483bcd8ff799d6d3109a38da673182341cfc14445e9076fcd920162',
}
const CONFIG_SURFACES = [
  join(ROOT, '.opencode/opencode.json'),
  join(process.env.HOME, '.config/opencode/opencode.json'),
  join(process.env.HOME, '.config/opencode/opencode.jsonc'),
]
const EXPECTED_IDS = [
  ...Array.from({ length: 8 }, (_, i) => `A0${i + 1}`),
  ...Array.from({ length: 12 }, (_, i) => `B${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 12 }, (_, i) => `C${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 10 }, (_, i) => `D${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 6 }, (_, i) => `E0${i + 1}`),
]
const CSV_COLUMNS = ['id', 'group', 'stimulus', 'expected', 'actual', 'status', 'fixture_ids',
  'evidence_artifact', 'requirement_ids', 'prd_ac', 'method', 'source_ref']

// ---------- Step 1: frozen source baseline (IS-1 / GAP-1) ----------
test('M1-01 SOURCE-BASELINE-FROZEN.md freezes 8 sources + 3 config surfaces with matching hashes', () => {
  const p = join(E2E, 'SOURCE-BASELINE-FROZEN.md')
  assert.ok(existsSync(p), 'docs/e2e-v2/SOURCE-BASELINE-FROZEN.md missing')
  const text = md(p)
  for (const [rel, want] of Object.entries(BASELINE)) {
    assert.ok(text.includes(want), `frozen baseline does not record hash for ${rel}`)
    assert.equal(sha(join(ROOT, rel)), want, `drift: live ${rel} no longer matches SOURCE-BASELINE.md`)
  }
  for (const surface of CONFIG_SURFACES) {
    assert.ok(existsSync(surface), `config surface missing: ${surface}`)
    assert.ok(text.includes(sha(surface)), `frozen baseline does not record hash for ${surface}`)
  }
  assert.ok(text.includes(PRD_DIGEST), 'pinned PRD digest not recorded')
  assert.equal(sha(join(ROOT, '.claude/prds/e2e-v2-0-unified-journey-mapping.prd.md')),
    'bbe563be553147e4ff348622e54a75689db209bd798e85f85a97d739895191a9',
    'worktree PRD digest changed — the approval annotation baseline moved')
  assert.match(text, /drift/i, 'no drift statement')
  assert.match(text, /TESTS\.md/, 'absent-TESTS.md fact not recorded')
  assert.match(text, /docs-map\.json/, 'absent .governance/docs-map.json fact not recorded')
})

// ---------- Step 2: D05 frozen-workflow hash evidence ----------
test('M1-02 frozen-hashes.report.json lists >=7 workflows with populated status and honest D05 exclusions', () => {
  const r = readJson(join(REP, 'frozen-hashes.report.json'))
  assert.ok(Array.isArray(r.files) && r.files.length >= 7, `expected >=7 frozen surfaces, got ${r.files?.length}`)
  for (const f of r.files) {
    assert.ok(f.path && /^[0-9a-f]{64}$/.test(f.sha256), `bad hash row: ${JSON.stringify(f)}`)
    assert.ok(f.status, `status missing for ${f.path}`)
    assert.equal(sha(join(ROOT, f.path)), f.sha256, `frozen workflow ${f.path} drifted since report generation`)
  }
  assert.ok(r.files.some((f) => f.status === 'NO_PRIOR_REF'), 'no honest NO_PRIOR_REF row')
  const ex = JSON.stringify(r.exclusions ?? [])
  for (const surface of ['Guardian Angel', 'A07b', 'Git policy']) {
    assert.ok(ex.includes(surface), `D05 exclusion not recorded: ${surface}`)
  }
  assert.match(ex, /NOT_VERIFIED/, 'exclusions must be NOT_VERIFIED')
  assert.match(ex, /review-constraint/, 'exclusion reason must cite the review-constraint limit')
  assert.equal(r.status, 'NOT_VERIFIED', 'top-level D05 status must stay NOT_VERIFIED (incomplete evidence)')
  assert.equal(r.d05_scope, 'WORKFLOW_FILES_ONLY', 'D05 scope must be declared workflow-files-only')
})

// ---------- Step 3: command resolution / ASM-01 ----------
test('M1-03 command-resolution evidence enumerates 3 config surfaces and keeps winner NOT_VERIFIED', () => {
  const r = readJson(join(REP, 'command-resolution.report.json'))
  assert.equal(r.surfaces?.length, 3, 'must enumerate all three config surfaces')
  const paths = r.surfaces.map((s) => s.path)
  assert.ok(paths.some((p) => p.endsWith('.opencode/opencode.json')), 'project surface missing')
  assert.ok(paths.some((p) => p.endsWith('.config/opencode/opencode.json')), 'global json surface missing')
  assert.ok(paths.some((p) => p.endsWith('.config/opencode/opencode.jsonc')), 'global jsonc surface missing')
  assert.equal(r.precedence?.status, 'NOT_VERIFIED', 'winner must remain NOT_VERIFIED in M1')
  assert.equal(r.probe?.status, 'DEFERRED_TO_M2', 'ASM-01 probe must be deferred to M2')
  assert.ok(r.probe.steps?.length >= 3, 'ASM-01 probe needs concrete steps')
  assert.ok(r.probe.cleanup, 'ASM-01 probe needs a cleanup step')
  assert.match(r.probe.sandbox, /opencode|temp/i, 'ASM-01 probe needs a sandboxed HOME')
  // Verbatim declarations must match the live files.
  const proj = readJson(join(ROOT, '.opencode/opencode.json')).command
  const glob = readJson(join(process.env.HOME, '.config/opencode/opencode.json')).command
  const surf = (suffix) => r.surfaces.find((s) => s.path.endsWith(suffix))
  assert.equal(surf('.opencode/opencode.json').commands.e2e.template, proj.e2e.template)
  assert.equal(surf('.opencode/opencode.json').commands['e2e-map'].template, proj['e2e-map'].template)
  assert.equal(surf('config/opencode/opencode.json').commands.e2e.template, glob.e2e.template)
  const jsonc = r.surfaces.find((s) => s.path.endsWith('.jsonc'))
  assert.equal(jsonc.commands, null, 'jsonc has no command map; must be recorded as null not invented')
  assert.ok(r.subassertions, 'subassertions must be defined on command-resolution report')
  assert.equal(r.subassertions['ASM-01/ARGS']?.status, 'VALIDATION_REQUIRED')
  assert.equal(r.subassertions['ASM-01/PRECEDENCE']?.status, 'VALIDATION_REQUIRED')
  const t = md(join(M1, 'command-resolution-evidence.md'))
  assert.match(t, /NOT_VERIFIED/)
  assert.match(t, /ASM-01\/ARGS/)
  assert.match(t, /ASM-01\/PRECEDENCE/)
})

// ---------- Step 4: command contract (AC-001 / A01) ----------
test('M1-04 command-contract.md freezes exactly 6 modes with a complete gate table', () => {
  const t = md(join(E2E, 'contracts/command-contract.md'))
  const rows = t.split('\n').filter((l) => /^\| (map|run|full|status|help|no-args)\b/.test(l))
  const modes = rows.map((l) => l.split('|')[1].trim())
  assert.deepEqual([...modes].sort(), ['full', 'help', 'map', 'no-args', 'run', 'status'],
    `expected exactly the 6 contract modes, got ${JSON.stringify(modes)}`)
  for (const row of rows) {
    const cells = row.split('|').map((c) => c.trim())
    assert.ok(cells.length >= 7, `gate table row needs 5 columns: ${row}`)
    assert.ok(cells[4] && cells[4] !== '—', `Browser column empty: ${row}`)
    assert.ok(cells[5] && cells[5] !== '—', `Gate column empty: ${row}`)
  }
  for (const state of ['`missing`', '`in progress`', '`unverified`', '`covered`', '`not applicable`']) {
    assert.ok(t.includes(state), `Registry State enum missing ${state}`)
  }
  assert.match(t, /The only modes eligible to mutate the registry are `map`, `run`, and `full`/,
    '3 conditionally writable modes invariant missing')
  assert.doesNotMatch(t, /Exactly two modes may touch the registry/i,
    'contradictory two-mode invariant must not remain')
  assert.match(t, /FAIL.*unverified/i, 'FAIL reconciliation to unverified missing')
  assert.match(t, /`stale`[^\n]*assessment/i, 'stale=assessment-only rule missing')
  assert.match(t, /DEC-12/, 'stale schema-mismatch must cite DEC-12 (pending)')
  assert.match(t, /--ad-hoc/, 'run --ad-hoc sub-mode missing')
  assert.match(t, /DEC-05/, '--ad-hoc must be marked pending DEC-05')
  for (const dec of ['DEC-06', 'DEC-07', 'DEC-10']) assert.match(t, new RegExp(dec), `${dec} pending marker missing`)
  assert.match(t, /PENDING_DEC/, 'PENDING_DEC convention missing')
  assert.match(t, /Invocation/, 'Command vs Invocation separation missing')
  assert.doesNotMatch(t, /default mode.*=.*run/i, 'no dangerous default-run mode may be declared')
})

test('M1-05 mode-parser.report.json (A01) passes static contract check with 6 registered modes', () => {
  const r = readJson(join(REP, 'mode-parser.report.json'))
  assert.equal(r.scenario_id, 'A01')
  assert.equal(r.status, 'PASS')
  assert.equal(r.modes?.length, 6, 'A01 expects 6 registered modes')
  assert.deepEqual(r.modes.map((m) => m.id).sort(), ['full', 'help', 'map', 'no-args', 'run', 'status'])
  assert.equal(r.checks?.modes_complete, 'PASS')
  assert.equal(r.checks?.no_dangerous_default, 'PASS')
  assert.equal(r.checks?.mode_write_gates_consistent, 'PASS')
  assert.deepEqual(r.eligible_write_modes?.slice().sort(), ['full', 'map', 'run'])
  assert.deepEqual(r.readonly_modes?.slice().sort(), ['help', 'no-args', 'status'])
  assert.equal(r.execution_deferred, true, 'A01 is a static contract check; runtime stays deferred')
})

// ---------- Step 5: validator specs (A07) ----------
test('M1-06 validator-specs.md defines >=12 negative-case IDs and all report companions are NOT_RUN', () => {
  const t = md(join(E2E, 'contracts/validator-specs.md'))
  const ids = t.split('\n').filter((l) => /^\| (PS|RP|SE)-\d+/.test(l))
  assert.ok(ids.length >= 12, `expected >=12 PS/RP/SE cases, got ${ids.length}`)
  assert.ok(ids.some((l) => /^\| PS-/.test(l)), 'no parser-safety cases')
  assert.ok(ids.some((l) => /^\| RP-/.test(l)), 'no registry-path cases')
  assert.ok(ids.some((l) => /^\| SE-/.test(l)), 'no symlink-escape case')
  for (const l of ids) assert.ok(l.split('|').filter((c) => c.trim()).length >= 4, `case row too thin: ${l}`)
  for (const name of ['parser-failclosed.report.json', 'registry-path.reject.json', 'symlink-escape.reject.json']) {
    const r = readJson(join(REP, name))
    assert.equal(r.status, 'NOT_RUN', `${name} must not claim a run`)
    assert.ok(r.deferred_to, `${name} missing deferred_to`)
    assert.match(r.deferred_to, /M2/, `${name} deferred_to must name M2`)
    assert.ok(Array.isArray(r.cases) && r.cases.length > 0, `${name} has no traced cases`)
  }
})

// ---------- Step 6: detector characterization (AC-019 / B01-B04) ----------
test('M1-07 detector-characterization.md maps >=9 stacks to real e2e-map.md source lines and records 2 conflicts', () => {
  const t = md(join(M1, 'detector-characterization.md'))
  const map = md(join(ROOT, '.opencode/commands/e2e-map.md')).split('\n')
  const rows = t.split('\n').filter((l) => /^\|.*e2e-map\.md:\d+/.test(l))
  assert.ok(rows.length >= 9, `expected >=9 stack rows with source lines, got ${rows.length}`)
  assert.match(t, /Rule source line/, 'the stack table needs an explicit source-line column')
  const anchors = [...t.matchAll(/e2e-map\.md:(\d+)/g)].map((m) => Number(m[1]))
  assert.ok(anchors.length >= 9, `expected >=9 e2e-map.md line anchors, got ${anchors.length}`)
  for (const n of new Set(anchors)) {
    if (n >= 33 && n <= 42) assert.match(map[n - 1], /^\| .+ \| .+/, `line ${n} is not a detector row`)
  }
  for (let n = 33; n <= 42; n++) assert.ok(anchors.includes(n), `detector row e2e-map.md:${n} uncharacterized`)
  for (const n of [62, 89, 101]) assert.ok(anchors.includes(n), `conflict anchor e2e-map.md:${n} not cited`)
  assert.match(t, /Command: `?\/e2e <flow/i, 'conflict 1 (Command semantics) not stated')
  assert.match(t, /stale/i, 'conflict 2 (stale as State) not stated')
  assert.equal((t.match(/^##+ Conflict/gm) || []).length, 2, 'exactly 2 conflicts must be documented')
})

test('M1-08 F01-F06 expected-output contracts exist, are NOT_RUN, and cover B01-B04', () => {
  const r = readJson(join(REP, 'F01-F06-map-output-expected.json'))
  assert.equal(r.status, 'NOT_RUN')
  assert.match(r.deferred_to, /M2/)
  const ids = r.fixtures.map((f) => f.fixture_id)
  for (const f of ['F01', 'F02', 'F03', 'F04', 'F05', 'F06']) assert.ok(ids.includes(f), `missing fixture ${f}`)
  for (const f of r.fixtures) {
    assert.equal(f.status, 'NOT_RUN', `${f.fixture_id} must be NOT_RUN`)
    assert.ok(f.expected_output, `${f.fixture_id} has no expected output`)
    assert.ok(Array.isArray(f.must_not) && f.must_not.length, `${f.fixture_id} has no negative expectations`)
  }
  const covered = JSON.stringify(r.matrix_rows ?? [])
  for (const row of ['B01', 'B02', 'B03', 'B04']) assert.ok(covered.includes(row), `${row} not mapped`)
})

// ---------- Step 7: journey contract freeze (B05/B06) ----------
test('M1-09 journey-contract-freeze.md carries all 14 fields incl test_registry_ids[], 4 transitions, 4 dedup rules', () => {
  const t = md(join(E2E, 'contracts/journey-contract-freeze.md'))
  const fields = [...t.matchAll(/^\| `([a-z_]+(?:\[\])?)` \| (ya|ya bila [a-z ]+) \|/gm)].map((m) => m[1])
  assert.ok(fields.length >= 14, `expected >=14 journey fields, got ${fields.length}`)
  for (const f of ['journey_key', 'name', 'actors', 'entry_point', 'steps[]', 'expected_behavior',
    'negative_paths[]', 'alternate_paths[]', 'dependencies[]', 'risk', 'side_effects[]',
    'confidence', 'sources[]', 'test_registry_ids[]']) {
    assert.ok(fields.includes(f), `journey field missing: ${f}`)
  }
  const transitions = [...t.matchAll(/`[a-z_]+`\s*→\s*`[a-z_]+`/g)]
  assert.ok(transitions.length >= 4, `expected >=4 transitions, got ${transitions.length}`)
  const dedup = t.split('\n').filter((l) => /^####? D\d/.test(l) || /^\| D\d /.test(l))
  assert.ok(dedup.length >= 4, `expected 4 dedup rules, got ${dedup.length}`)
  assert.match(t, /max(imum)? numerik|max\+1|maksimum numerik/i, 'ID ownership rule missing')
  for (const name of ['locale-dedup.report.json', 'journey-grouping.report.json']) {
    const r = readJson(join(REP, name))
    assert.equal(r.status, 'NOT_RUN', `${name} must be NOT_RUN`)
    assert.match(r.deferred_to, /M[2-6]/)
    assert.ok(r.assertions?.length > 0, `${name} has no assertions`)
  }
})

// ---------- Step 8: bundle validator (E01 / A01 chain) ----------
test('M1-10 bundle-validator.report.json proves 20/20 manifest hashes, digest match, and 48 unique IDs', () => {
  const manifest = JSON.parse(zipEntry('SHA256-MANIFEST.json'))
  assert.equal(manifest.files.length, 20, 'manifest must list 20 files')
  for (const f of manifest.files) {
    assert.equal(zipEntrySha(f.path), f.sha256, `ZIP bytes changed for ${f.path}`)
  }
  assert.equal(zipEntrySha('PRD-CANDIDATE.md'), PRD_DIGEST, 'PRD digest mismatch in bundle')
  assert.equal(manifest.files.filter((f) => f.path === 'SHA256-MANIFEST.json').length, 0,
    'manifest must self-exclude')

  const csv = parseCsv(zipEntry('ACCEPTANCE-MATRIX.csv'))
  const [header, ...rows] = csv
  assert.deepEqual(header, CSV_COLUMNS, 'ACCEPTANCE-MATRIX.csv columns changed')
  const idIdx = header.indexOf('id')
  const counts = new Map()
  for (const row of rows) counts.set(row[idIdx], (counts.get(row[idIdx]) ?? 0) + 1)
  assert.equal(counts.size, 48, `expected 48 IDs, got ${counts.size}`)
  for (const id of EXPECTED_IDS) assert.equal(counts.get(id), 1, `${id} missing or duplicated`)
  for (const col of ['stimulus', 'expected', 'evidence_artifact']) {
    const i = header.indexOf(col)
    for (const row of rows) assert.ok(row[i]?.trim(), `${row[idIdx]} has empty ${col}`)
  }

  const r = readJson(join(REP, 'bundle-validator.report.json'))
  assert.equal(r.manifest_listed, 20)
  assert.equal(r.hashes_matched, 20, 'report must show 20/20')
  assert.equal(r.manifest_self_excluded, true)
  assert.equal(r.digest_match, true)
  assert.equal(r.id_counts_total, 48)
  assert.equal(r.id_duplicates, 0)
  assert.equal(r.fabricated_hashes, 0)
  assert.deepEqual([...r.acceptance_ids].sort(), [...EXPECTED_IDS].sort(), 'report must enumerate all 48 IDs')
  assert.deepEqual(r.missing_required_columns, [], 'no required column may be missing')
  assert.ok(r.files.every((f) => f.match === true), 'all per-file results must be match=true')
})

// ---------- Step 9: scope check (E04) ----------
test('M1-11 scope-check.report.json shows 0 violations, 8 pending DECs, and no out-of-scope writes', () => {
  const r = readJson(join(REP, 'scope-check.report.json'))
  assert.deepEqual(r.violations, [], 'violations must be empty')
  assert.equal(r.dec_pending.length, 8, `expected 8 pending DECs, got ${r.dec_pending?.length}`)
  const ids = r.dec_pending.map((d) => d.id).sort()
  assert.deepEqual(ids, ['DEC-04', 'DEC-05', 'DEC-06', 'DEC-07', 'DEC-09', 'DEC-10', 'DEC-11', 'DEC-12'])
  const CANONICAL_DECS = {
    'DEC-04': { topic: 'Legacy /e2e <flow> shorthand', milestone: 'M5' },
    'DEC-05': { topic: 'run --ad-hoc policy', milestone: 'M2' },
    'DEC-06': { topic: 'Registry bootstrap/write policy', milestone: 'M3' },
    'DEC-07': { topic: 'Per-environment execution authorization', milestone: 'M4' },
    'DEC-09': { topic: 'Agent Browser optional exploration', milestone: 'M4' },
    'DEC-10': { topic: '/e2e-map disable-default after parity', milestone: 'M5' },
    'DEC-11': { topic: 'CI automation policy', milestone: 'M6' },
    'DEC-12': { topic: 'Legacy State: stale schema reconciliation', milestone: 'M5' }
  }
  for (const d of r.dec_pending) {
    assert.equal(d.status, 'OWNER_DECISION_REQUIRED')
    const exp = CANONICAL_DECS[d.id]
    assert.ok(exp, `unexpected DEC id: ${d.id}`)
    assert.equal(d.topic, exp.topic, `DEC topic mismatch for ${d.id}`)
    assert.equal(d.milestone, exp.milestone, `DEC milestone mismatch for ${d.id}`)
  }
  assert.ok(r.written_files.length > 0, 'written-file inventory empty')
  for (const f of r.written_files) {
    assert.match(f, /^docs\/(e2e-v2|plans)\//, `out-of-scope write recorded: ${f}`)
    assert.ok(existsSync(join(ROOT, f)), `inventory lists a nonexistent file: ${f}`)
  }
  // Independent recursive walk: all files under docs/e2e-v2 including tests/
  const walk = (dir, acc = []) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) walk(p, acc)
      else acc.push(relative(E2E, p))
    }
    return acc
  }
  const onDisk = walk(E2E).sort()
  const expectedRel = r.written_files.map((f) => f.replace(/^docs\/e2e-v2\//, '')).sort()
  assert.equal(onDisk.length, expectedRel.length, `inventory count mismatch: on-disk ${onDisk.length} vs recorded ${expectedRel.length}`)
  for (let i = 0; i < onDisk.length; i++) {
    assert.equal(onDisk[i], expectedRel[i], `untracked or mismatched M1 write: on-disk "${onDisk[i]}" vs "${expectedRel[i]}"`)
  }
  for (const p of r.protected_paths) {
    assert.equal(p.status, 'UNTOUCHED', `${p.path} not recorded UNTOUCHED`)
    if (p.sha256) assert.equal(sha(join(ROOT, p.path)), p.sha256, `${p.path} modified during M1`)
  }
})

// ---------- Step 10: traceability ----------
test('M1-12 traceability-m1.md maps every M1 artifact to a scenario and AC, with deferred probes visible', () => {
  const t = md(join(M1, 'traceability-m1.md'))
  const rows = t.split('\n').filter((l) => l.includes('→') && /^\|/.test(l))
  assert.ok(rows.length >= 11, `expected >=11 traceability rows, got ${rows.length}`)
  for (const id of ['A01', 'A07', 'B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'D05', 'E01', 'E04']) {
    assert.ok(rows.some((l) => new RegExp(`\\|\\s*${id}\\b`).test(l)), `scenario ${id} has no row`)
  }
  assert.ok(rows.some((l) => l.includes('AC-001')), 'AC-001 not mapped')
  assert.ok(rows.some((l) => l.includes('AC-019')), 'AC-019 not mapped')
  for (const probe of ['ASM-01', 'ASM-02']) assert.match(t, new RegExp(probe), `${probe} not recorded`)
  for (const dec of ['DEC-04', 'DEC-05', 'DEC-06', 'DEC-07', 'DEC-09', 'DEC-10', 'DEC-11', 'DEC-12']) {
    assert.match(t, new RegExp(dec), `${dec} not carried forward`)
  }
  assert.match(t, /OWNER_DECISION_REQUIRED/)
  assert.match(t, /NOT_RUN/)
  assert.match(t, /M2/)
})

// ---------- Cross-cutting: every report must at least be valid JSON ----------
test('M1-13 every report companion parses as JSON and declares a status', () => {
  const names = ['frozen-hashes.report.json', 'command-resolution.report.json', 'mode-parser.report.json',
    'parser-failclosed.report.json', 'registry-path.reject.json', 'symlink-escape.reject.json',
    'F01-F06-map-output-expected.json', 'locale-dedup.report.json', 'journey-grouping.report.json',
    'bundle-validator.report.json', 'scope-check.report.json']
  assert.deepEqual(readdirSync(REP).filter((f) => f.endsWith('.json')).sort(), [...names].sort(),
    'reports/ must contain exactly the 11 plan-named companions')
  for (const n of names) {
    const r = readJson(join(REP, n))
    assert.ok(r.status, `${n} has no status field`)
    if (r.status === 'NOT_RUN') assert.ok(r.deferred_to, `${n} NOT_RUN without deferred_to`)
  }
})
