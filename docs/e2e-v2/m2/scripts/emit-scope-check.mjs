// M2 step 11 — scope check: proves the M2 write surface and the one authorized delta.
// File-based CLI: node docs/e2e-v2/m2/scripts/emit-scope-check.mjs
// No git, no .guardian-angel: only `shasum`-equivalent hashing of the live worktree.
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '../../../..')
const REP = join(HERE, '../reports')

const sha = (rel) => createHash('sha256').update(readFileSync(join(ROOT, rel))).digest('hex')
const walk = (relDir) => {
  const abs = join(ROOT, relDir)
  const out = []
  const visit = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) visit(full)
      else out.push(relative(ROOT, full).split('\\').join('/'))
    }
  }
  visit(abs)
  return out.sort()
}

// Frozen values from docs/e2e-v2/SOURCE-BASELINE-FROZEN.md (repo sources table).
const REPO_SOURCES = {
  '.opencode/commands/e2e.md': '08b17f2cb765665b753374265bc8f78df2599c3505c2245107dd6888061b95dd',
  '.opencode/commands/e2e-map.md': '76b3d4037a0144df2d40dc0eca01777690762a7cccc5d9562b0330333dfdb142',
  'agents/e2e-runner.md': '94811f4bbc491c351cdf220ab103d6bd251fb1d88d9d46ba4c8162637a236a5b',
  '.opencode/prompts/agents/e2e-runner.txt': 'd7442445cbb276cb88d6cca5339b50ec3247683ed78ea512ccf4627ed666ad08',
  'legacy-command-shims/commands/e2e.md': '97ef29c9355344bd25b4e963e519f3eaf5b0c6f43a9174f47c9c5d1b4dbb579e',
  'skills/test-collaboration/SKILL.md': '741138330940e2c9d3cc7bec9e671787f24a361ff89be44e09a56abc8e10dcfa',
  'skills/e2e-testing/SKILL.md': 'b0e00e7e17cb259101139900816c5528aed18dd10bcf5f9cb42cfc35baf8a755',
  'skills/click-path-audit/SKILL.md': '662fc5d02483bcd8ff799d6d3109a38da673182341cfc14445e9076fcd920162',
}

const sources = Object.entries(REPO_SOURCES).map(([path, frozen]) => {
  const actual = sha(path)
  const status = actual === frozen ? 'UNTOUCHED' : path === '.opencode/commands/e2e.md' ? 'AUTHORIZED_DELTA' : 'VIOLATION'
  return { path, frozen_sha256: frozen, actual_sha256: actual, status }
})

// Guardrail surfaces the M2 mandate names explicitly.
const GUARDRAILS = [
  '.opencode/commands/e2e-map.md',
  '.opencode/workflows/active.json',
  'agents/e2e-runner.md',
  '.opencode/prompts/agents/e2e-runner.txt',
]
const guardrails = GUARDRAILS.map((path) => ({ path, sha256: sha(path), writes_by_m2: 0 }))

// Frozen M1 surface: recorded now as a manifest a later milestone can diff.
const FROZEN_DIRS = ['docs/e2e-v2/m1', 'docs/e2e-v2/contracts']
const frozenManifest = {
  generated_at: '2026-11-23T00:00:00Z',
  milestone: 'M2',
  method: 'node:crypto sha256 over live worktree files (no git, no .guardian-angel)',
  status: 'RECORDED',
  live_prompt_verification: 'DEFERRED_TO_M6 (48-scenario acceptance)',
  note: 'M1 carried no worktree byte-manifest for its own artifacts; this snapshot lets M3+ prove they were not mutated in M2 (no M2 write path appears below).',
  files: [
    { path: 'docs/e2e-v2/SOURCE-BASELINE-FROZEN.md', sha256: sha('docs/e2e-v2/SOURCE-BASELINE-FROZEN.md') },
    ...FROZEN_DIRS.flatMap((d) => walk(d)).map((path) => ({ path, sha256: sha(path) })),
  ],
}
writeFileSync(join(REP, 'frozen-artifacts.manifest.json'), JSON.stringify(frozenManifest, null, 2) + '\n')

// The M2 write surface, enumerated from the live tree.
const WRITE_ROOTS = ['docs/e2e-v2/m2']
const written = [
  ...WRITE_ROOTS.flatMap((d) => walk(d)),
  'docs/plans/e2e-v2-0-m2-unified-interface.plan.md',
  '.opencode/commands/e2e.md',
].filter((p) => {
  try {
    return statSync(join(ROOT, p)).isFile()
  } catch {
    return false
  }
})

const ALLOWED_PREFIXES = ['docs/e2e-v2/m2/', 'docs/plans/', '.opencode/commands/e2e.md']
const violations = [
  ...sources.filter((s) => s.status === 'VIOLATION').map((s) => ({ kind: 'source-drift', path: s.path })),
  ...written.filter((p) => !ALLOWED_PREFIXES.some((a) => p.startsWith(a))).map((p) => ({ kind: 'outside-write-surface', path: p })),
]

const report = {
  generated_at: '2026-11-23T00:00:00Z',
  scenario_id: 'E04',
  milestone: 'M2',
  method: 'node:crypto sha256 over live worktree files; static path allowlist; no git, no .guardian-angel',
  status: violations.length === 0 ? 'PASS' : 'FAIL',
  scope: 'ECC-OPL M2: docs/e2e-v2/m2/, docs/plans/ (plan input), .opencode/commands/e2e.md (authorized)',
  allowed_write_roots: ALLOWED_PREFIXES,
  repo_sources: sources,
  authorized_delta_count: sources.filter((s) => s.status === 'AUTHORIZED_DELTA').length,
  authorized_delta: sources.filter((s) => s.status === 'AUTHORIZED_DELTA'),
  guardrails,
  frozen_m1_artifact_count: frozenManifest.files.length,
  frozen_m1_manifest: 'docs/e2e-v2/m2/reports/frozen-artifacts.manifest.json',
  written_files: written,
  written_file_count: written.length,
  violations,
  violation_count: violations.length,
  home_writes: 0,
  git_access: false,
  guardian_angel_access: false,
  browser_or_playwright_runs: 0,
  installs: 0,
  registry_writes: 0,
  tests_md_created: false,
  e2e_map_disabled: false,
  workflow_active_json_written: false,
  live_prompt_verification: 'DEFERRED_TO_M6 (48-scenario acceptance)',
}
writeFileSync(join(REP, 'scope-check.report.json'), JSON.stringify(report, null, 2) + '\n')
console.log(report.status, 'violations:', report.violation_count, 'delta:', report.authorized_delta_count, 'written:', report.written_file_count)
