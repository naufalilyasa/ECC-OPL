// M6 fixtures — scenario metadata, loopback pages and portable, fail-closed inputs.
// All machine-specific locations come from validated env options; nothing is
// hardcoded. Missing baseline => BLOCKED_* status, never a guessed substitute.
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  mkdtempSync, mkdirSync, rmSync, readFileSync, readdirSync, lstatSync, realpathSync, existsSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve, dirname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const env = (name, fallback) => {
  const v = process.env[name]
  return typeof v === 'string' && v.length > 0 ? v : fallback
}
const envPath = (name, fallback) => resolve(env(name, fallback))

export const ROOT = envPath('E2E_REPO_ROOT', join(HERE, '../../../..'))
export const SCRATCH_ROOT = envPath('E2E_SCRATCH_ROOT', join(tmpdir(), 'opencode'))
export const SCRATCH = SCRATCH_ROOT // legacy alias
export const PW_DIR = envPath('E2E_PLAYWRIGHT_DIR', join(SCRATCH_ROOT, 'm6-playwright'))
export const PW_BROWSERS = envPath('E2E_PW_BROWSERS', join(PW_DIR, 'pw-browsers'))
export const HOME_FIXTURE = envPath('E2E_HOME_FIXTURE', join(SCRATCH_ROOT, 'm6-home-fixture'))
export const ACTIVE_JSONC = envPath('E2E_ACTIVE_CONFIG', join(homedir(), '.config/opencode/opencode.jsonc'))
export const BUNDLE = envPath('E2E_MATRIX_ROOT', join(SCRATCH_ROOT, 'e2e-v2-prd-r1/bundle/ecc-opl-e2e-v2.0-prd-r1-external-review'))
export const MATRIX_PATH = envPath('E2E_MATRIX_PATH', join(BUNDLE, 'ACCEPTANCE-MATRIX.csv'))
export const EVIDENCE_ROOT = envPath('E2E_EVIDENCE_ROOT', join(HERE, '../evidence'))
export const TARGET_LABEL = 'E2E_NONPROD_LOCAL_FIXTURE'
export const SYNTHETIC_TOKEN = 'sk-ant-api03-test-token-secret'

// Approved baseline archives and their recorded SHA-256. No auto-download.
export const BASELINE_INPUTS = Object.freeze({
  PRD_R1: Object.freeze({
    env: 'E2E_PRD_R1_ZIP', rootEnv: 'E2E_PRD_R1_ROOT',
    expected: '7b73335f8cfe6b0fdc901cea644f6d666d96ce709c88478d9c3994ff01b57960',
  }),
  M6_R1: Object.freeze({
    env: 'E2E_M6_R1_ZIP', rootEnv: 'E2E_M6_R1_ROOT',
    expected: '230af77bcbd7f24aeea985c5f0f8c92270875e55cc1dd32f6f3fac139a2672e2',
  }),
  R11: Object.freeze({
    env: 'E2E_R11_ZIP', rootEnv: 'E2E_R11_ROOT',
    expected: 'afe544312a76ef6b199ee386f6c7413e862fa2f6e98a3aad5deaeda7ad7aa330',
  }),
})

export function baselineStatus(name) {
  const def = BASELINE_INPUTS[name]
  if (!def) return { status: 'BLOCKED_BASELINE_MISSING', reason: 'unknown baseline: ' + name }
  const zip = process.env[def.env]
  if (typeof zip !== 'string' || zip.length === 0) {
    return { status: 'BLOCKED_BASELINE_MISSING', reason: def.env + ' not set', expected_sha256: def.expected }
  }
  const path = resolve(zip)
  if (!existsSync(path)) {
    return { status: 'BLOCKED_BASELINE_MISSING', reason: 'archive not found', expected_sha256: def.expected }
  }
  const observed = createHash('sha256').update(readFileSync(path)).digest('hex')
  if (observed !== def.expected) {
    return { status: 'BLOCKED_BASELINE_DIGEST_MISMATCH', observed_sha256: observed,
      expected_sha256: def.expected, reason: 'archive digest does not match approved value' }
  }
  return { status: 'VERIFIED', path, sha256: observed, expected_sha256: def.expected }
}

// Safe extraction: reject traversal, absolute/drive/UNC forms, backslashes, NUL,
// symlink members and symlinks after extraction. No network, no dependency install.
export function safeExtractZip(zipPath, destDir) {
  const listing = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean)
  for (const entry of listing) {
    if (entry.includes('\0') || entry.includes('\\') || /^[A-Za-z]:/.test(entry)
      || entry.startsWith('/') || entry.split('/').includes('..')) {
      throw new Error('BLOCKED_UNSAFE_ARCHIVE_ENTRY:' + entry)
    }
  }
  const verbose = execFileSync('unzip', ['-Z', '-v', zipPath], { encoding: 'utf8' })
  if (/\blrwxrwxrwx\b/.test(verbose)) throw new Error('BLOCKED_UNSAFE_ARCHIVE_LINK')
  mkdirSync(destDir, { mode: 0o700, recursive: true })
  execFileSync('unzip', ['-qq', '-o', zipPath, '-d', destDir])
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const fp = join(dir, e.name)
      if (e.isSymbolicLink()) throw new Error('BLOCKED_UNSAFE_ARCHIVE_LINK:' + fp)
      if (e.isDirectory()) walk(fp)
    }
  }
  walk(destDir)
  return realpathSync(destDir)
}

const baselineCache = new Map()
export function getBaseline(name) {
  if (baselineCache.has(name)) return baselineCache.get(name)
  const def = BASELINE_INPUTS[name]
  if (!def) return { status: 'BLOCKED_BASELINE_MISSING', reason: 'unknown baseline: ' + name }
  const approvedRoot = process.env[def.rootEnv]
  if (typeof approvedRoot === 'string' && approvedRoot.length > 0) {
    const root = resolve(approvedRoot)
    if (existsSync(root) && lstatSync(root).isDirectory()) {
      const result = { status: 'VERIFIED', root: realpathSync(root), source: def.rootEnv }
      baselineCache.set(name, result)
      return result
    }
  }
  const status = baselineStatus(name)
  if (status.status !== 'VERIFIED') return status
  const dest = join(makeScratch('m6-baseline-'), name)
  try {
    const result = { status: 'VERIFIED', root: safeExtractZip(status.path, dest), source: def.env }
    baselineCache.set(name, result)
    return result
  } catch (e) {
    return { status: 'BLOCKED_BASELINE_MISSING', reason: String(e.message ?? e) }
  }
}

export function makeScratch(prefix = 'm6-') {
  return mkdtempSync(join(SCRATCH_ROOT, prefix))
}
export function dropScratch(dir) {
  rmSync(dir, { recursive: true, force: true })
}
export function subDir(parent, name) {
  const d = join(parent, name)
  mkdirSync(d, { mode: 0o700, recursive: true })
  return d
}
export function repoRelative(p) {
  const abs = resolve(p)
  const r = resolve(ROOT)
  return abs === r ? '.' : (abs.startsWith(r + sep) ? abs.slice(r.length + 1) : resolve(p))
}

// ---------------------------------------------------------------- loopback pages
const page = (body) => `<!doctype html><html><head><meta charset="utf-8"><title>M6</title></head><body>${body}</body></html>`

export const HAPPY_PAGE_HTML = page(`
  <h1 id="title">Checkout</h1>
  <input id="name" aria-label="name" />
  <button id="submit">Place order</button>
  <div id="result">(none)</div>
  <script>
    document.getElementById('submit').addEventListener('click', () => {
      const n = document.getElementById('name').value || 'anon'
      document.getElementById('result').textContent = 'ORDER_CONFIRMED:' + n
    })
  </script>`)

export const WEAK_PAGE_HTML = page(`
  <h1 id="title">Status</h1><div id="visible">VISIBLE_ONLY</div>`)

export const BROKEN_PAGE_HTML = page(`
  <h1 id="title">Broken</h1><div id="result">ACTUAL_VALUE</div>`)

export const CRED_PAGE_HTML = page(`
  <h1 id="title">Credentials</h1><div id="token">${SYNTHETIC_TOKEN}</div>`)

const ROUTES = Object.freeze({
  '/happy': HAPPY_PAGE_HTML,
  '/weak': WEAK_PAGE_HTML,
  '/broken': BROKEN_PAGE_HTML,
  '/cred': CRED_PAGE_HTML,
})

// Ephemeral loopback HTTP server: port 0, bound strictly to 127.0.0.1.
export function startLoopbackServer() {
  const server = createServer((req, res) => {
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname
    const body = ROUTES[pathname]
    if (body === undefined) {
      res.writeHead(404, { 'content-type': 'text/plain' })
      res.end('NOT_FOUND')
      return
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(body)
  })
  return new Promise((resolvePromise, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolvePromise({
        port,
        url: `http://127.0.0.1:${port}`,
        targetLabel: TARGET_LABEL,
        routes: Object.keys(ROUTES),
        close: () => new Promise((done) => server.close(done)),
      })
    })
  })
}

// ---------------------------------------------------------------- benchmark stacks (F01–F06, F13)
const stack = (id, routes, flows, excluded = ['/api/health'], partial = []) => ({
  stackId: id, routes, flows, excluded, partial,
})
export const STACK_IDS = Object.freeze(['F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F13'])
export const NEW_MAP = Object.freeze({
  F01: stack('F01', ['/', '/about'], ['home', 'about']),
  F02: stack('F02', ['/login', '/dashboard'], ['login'], ['/api/health'], ['/dashboard/:id']),
  F03: stack('F03', ['/cart', '/checkout'], ['checkout']),
  F04: stack('F04', ['/search'], ['search'], ['/api/search']),
  F05: stack('F05', ['/profile', '/settings'], ['profile', 'settings']),
  F06: stack('F06', ['/admin'], ['admin'], ['/api/admin'], ['/admin/:tab']),
  F13: stack('F13', ['/collision/a', '/collision/b'], ['collision'], ['/api/collision']),
})
export const LEGACY_MAP = Object.freeze(Object.fromEntries(
  STACK_IDS.map((id) => [id, structuredClone(NEW_MAP[id])]),
))
export const LEGACY_MAP_DIVERGENT = Object.freeze({
  ...LEGACY_MAP,
  F02: stack('F02', ['/login'], ['login'], ['/api/health'], []),
})

// ---------------------------------------------------------------- scenario taxonomy (plan r4)
export const SCENARIO_IDS = Object.freeze([
  ...['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08'],
  ...Array.from({ length: 12 }, (_, i) => 'B' + String(i + 1).padStart(2, '0')),
  ...Array.from({ length: 12 }, (_, i) => 'C' + String(i + 1).padStart(2, '0')),
  ...Array.from({ length: 10 }, (_, i) => 'D' + String(i + 1).padStart(2, '0')),
  ...Array.from({ length: 6 }, (_, i) => 'E' + String(i + 1).padStart(2, '0')),
])
const set = (...ids) => new Set(ids)
export const EXECUTED_PASS_IDS = Object.freeze(set(
  'C04', 'C05', 'C06', 'C07', 'C10', 'D02', 'D05',
  'E01', 'E02', 'E03', 'E04', 'E05', 'E06',
))
export const REFERENCE_VERIFIED_IDS = Object.freeze(set(
  ...['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07'],
  ...Array.from({ length: 12 }, (_, i) => 'B' + String(i + 1).padStart(2, '0')),
  'C01', 'C02', 'C03', 'C08', 'C09', 'C11', 'C12',
  'D01', 'D03', 'D04', 'D06', 'D07', 'D08', 'D09', 'D10',
))
export const NOT_RUN_IDS = Object.freeze(set('A08'))
export const MUTATION_IDS = Object.freeze(Array.from({ length: 14 }, (_, i) => i + 1))

// ---------------------------------------------------------------- matrix parsing (authoritative CSV)
function parseCsvLine(line) {
  const out = []
  let field = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i]
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { field += '"'; i += 1 } else quoted = !quoted
    } else if (c === ',' && !quoted) {
      out.push(field); field = ''
    } else field += c
  }
  out.push(field)
  return out
}
export function parseMatrix(text) {
  const lines = String(text).split(/\r?\n/).filter((l) => l.trim() !== '')
  const head = parseCsvLine(lines.shift())
  return lines.map((line) => {
    const cells = parseCsvLine(line)
    const row = Object.fromEntries(head.map((h, i) => [h, cells[i] ?? '']))
    return {
      id: row.id,
      group: row.group,
      stimulus: row.stimulus,
      expected: row.expected,
      matrix_status: row.status,
      fixture_ids: String(row.fixture_ids).split(',').map((s) => s.trim()).filter(Boolean),
      evidence_artifact: row.evidence_artifact,
      requirement_ids: String(row.requirement_ids).split(',').map((s) => s.trim()).filter(Boolean),
      prd_ac: row.prd_ac,
      method: row.method,
      source_ref: row.source_ref,
    }
  })
}
export function loadMatrixRows() {
  return parseMatrix(readFileSync(MATRIX_PATH, 'utf8'))
}
