// M6 scratch Playwright bridge — REAL browser execution from authorized scratch
// against an ephemeral 127.0.0.1 loopback server only. A local node worker emits
// a genuine process exit code; screenshots/traces are real files in scratch.
// No installs, no shell, no external network, no active HOME writes.
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  mkdirSync, readFileSync, readdirSync, writeFileSync, statSync,
} from 'node:fs'
import { join } from 'node:path'

import { PW_DIR, PW_BROWSERS, TARGET_LABEL } from './fixtures.mjs'

const sha = (b) => createHash('sha256').update(b).digest('hex')
const TOKEN_RE = /sk-[a-zA-Z0-9-]+/g
const SESSION_RE = /session=[^\s\[\]]+/g
const PASSWORD_RE = /password=[^\s\[\]]+/g

export function redactSecrets(text) {
  return redactWithCount(text).text
}
function redactWithCount(text) {
  const source = typeof text === 'string' ? text : ''
  let count = 0
  const out = source
    .replace(TOKEN_RE, () => { count += 1; return '[REDACTED]' })
    .replace(SESSION_RE, () => { count += 1; return '[REDACTED]' })
    .replace(PASSWORD_RE, () => { count += 1; return '[REDACTED]' })
  return { text: out, count }
}

// C11 — untrusted Command text is classified as data, never executed.
export function classifyCommandSafety(command) {
  const text = typeof command === 'string' ? command : ''
  const dangerous = /[;&|`$<>]/.test(text)
  return {
    safe: !dangerous,
    code: dangerous ? 'SHELL_TEXT_REJECTED' : 'DATA_ONLY',
    shellInvocations: 0,
    treated_as_data: true,
    reason: dangerous
      ? 'Command field contains shell metacharacters; invocation must be built separately'
      : 'Command text is inert data',
  }
}

export function evaluateAssertionQuality(record) {
  if (!record || typeof record !== 'object') return { verdict: 'UNVERIFIED', ok: false }
  if (record.exitCode !== 0 || record.status === 'FAIL') return { verdict: 'FAIL', ok: false }
  if (record.skipped === true || record.testCount === 0 || record.assertionKind === 'none') {
    return { verdict: 'NOT_EXECUTED', ok: false }
  }
  if (record.assertionKind === 'visibility-only') return { verdict: 'PASS_UNVERIFIED', ok: false }
  if (record.assertionKind === 'behavioral') return { verdict: 'PASS', ok: true }
  return { verdict: 'UNVERIFIED', ok: false }
}

function workerSource(playwrightPath) {
  return `'use strict'
const { chromium } = require(${JSON.stringify(playwrightPath)})
const fs = require('node:fs')
const path = require('node:path')
const spec = JSON.parse(process.argv[2])
const outDir = process.argv[3]
const result = {
  kind: spec.kind, assertionKind: 'none', testCount: 0, skipped: false,
  covered: false, exitCode: 1, nodeId: 'chromium@1.65.1@worker-' + process.pid,
  startedAt: new Date().toISOString(), evidenceText: '',
}
;(async () => {
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
    await context.tracing.start({ screenshots: true, snapshots: true })
    const page = await context.newPage()
    if (spec.kind !== 'skipped') {
      await page.goto(spec.url, { waitUntil: 'domcontentloaded' })
      if (spec.kind === 'happy') {
        result.assertionKind = 'behavioral'
        result.testCount = 1
        await page.fill('#name', spec.name || 'Ada')
        await page.click('#submit')
        const text = await page.textContent('#result')
        result.evidenceText = 'observed=' + text
        if (text !== 'ORDER_CONFIRMED:' + (spec.name || 'Ada')) throw new Error('behavioral assertion failed')
      } else if (spec.kind === 'weak') {
        result.assertionKind = 'visibility-only'
        result.testCount = 1
        const visible = await page.locator('#visible').isVisible()
        result.evidenceText = 'visible=' + visible
        if (!visible) throw new Error('visibility probe failed')
      } else if (spec.kind === 'broken') {
        result.assertionKind = 'behavioral'
        result.testCount = 1
        const text = await page.textContent('#result')
        result.evidenceText = 'observed=' + text
        if (text !== 'NEVER_APPEARS') throw new Error('behavioral assertion failed')
      } else if (spec.kind === 'cred') {
        result.assertionKind = 'behavioral'
        result.testCount = 1
        const token = await page.textContent('#token')
        result.evidenceText = 'token=' + token
        if (!token || token.indexOf('sk-') !== 0) throw new Error('credential fixture probe failed')
      }
    } else {
      result.skipped = true
      result.evidenceText = 'skipped=0-tests'
    }
    await page.screenshot({ path: path.join(outDir, 'screenshot.png') })
    await context.tracing.stop({ path: path.join(outDir, 'trace.zip') })
    result.exitCode = 0
  } catch (err) {
    result.error = String(err && err.message ? err.message : err)
    result.exitCode = 1
  } finally {
    if (browser) await browser.close()
  }
  result.endedAt = new Date().toISOString()
  fs.writeFileSync(path.join(outDir, 'evidence.txt'), result.evidenceText)
  console.log('M6_RESULT:' + JSON.stringify(result))
  process.exit(result.exitCode)
})()
`
}

function loopbackOnly(targetUrl) {
  try {
    const url = new URL(targetUrl)
    return (url.hostname === '127.0.0.1' || url.hostname === 'localhost') && url.protocol === 'http:'
  } catch {
    return false
  }
}

export async function executeScratchPlaywright({ testSpec = {}, targetUrl, scratchDir }) {
  if (!loopbackOnly(targetUrl)) {
    return {
      executionMethod: 'blocked', status: 'BLOCKED_PRODUCTION_TARGET',
      exitCode: null, targetLabel: TARGET_LABEL,
      reason: 'only ephemeral loopback targets are permitted',
    }
  }
  const kind = String(testSpec.kind ?? 'happy')
  const url = new URL(testSpec.path ?? '/' + kind, targetUrl).href
  const runDir = join(scratchDir, 'run-' + kind)
  mkdirSync(runDir, { mode: 0o700, recursive: true })
  const workerPath = join(scratchDir, 'pw-worker-' + kind + '.cjs')
  writeFileSync(workerPath, workerSource(join(PW_DIR, 'node_modules/playwright')))

  const started = Date.now()
  // Async spawn keeps this process's event loop alive so its loopback HTTP
  // server can answer the child browser's navigation requests.
  const child = await new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [workerPath, JSON.stringify({ ...testSpec, kind, url }), runDir], {
      cwd: PW_DIR,
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: PW_BROWSERS },
      shell: false,
    })
    let stdout = ''
    let stderr = ''
    proc.stdout.setEncoding('utf8')
    proc.stderr.setEncoding('utf8')
    proc.stdout.on('data', (chunk) => { stdout += chunk })
    proc.stderr.on('data', (chunk) => { stderr += chunk })
    proc.once('error', reject)
    proc.once('close', (code) => resolve({ status: code, stdout, stderr }))
  })
  const durationMs = Date.now() - started

  let raw = null
  for (const line of String(child.stdout ?? '').split(/\r?\n/)) {
    if (line.startsWith('M6_RESULT:')) {
      try { raw = JSON.parse(line.slice('M6_RESULT:'.length)) } catch { raw = null }
    }
  }
  const fallbackExit = Number.isInteger(child.status) ? child.status : 1
  const record = raw ?? {
    kind, assertionKind: 'none', testCount: 0, skipped: false,
    error: String(child.stderr ?? '').slice(-400) || 'worker produced no result record',
  }

  // Redact at rest: rewrite every text artifact inside this scratch run directory.
  let redactionsCount = 0
  for (const name of readdirSync(runDir)) {
    const file = join(runDir, name)
    if (!statSync(file).isFile() || /\.(png|zip)$/.test(name)) continue
    const scrubbed = redactWithCount(readFileSync(file, 'utf8'))
    redactionsCount += scrubbed.count
    if (scrubbed.count > 0) writeFileSync(file, scrubbed.text)
  }
  const scrubbedJson = redactWithCount(JSON.stringify(record))
  redactionsCount += scrubbedJson.count
  const safeRecord = JSON.parse(scrubbedJson.text)

  const artifacts = readdirSync(runDir).sort().map((name) => {
    const bytes = readFileSync(join(runDir, name))
    return {
      path: 'scratch/' + kind + '/' + name,
      bytes: bytes.length,
      sha256: sha(bytes),
    }
  })

  return {
    executionMethod: 'real_playwright_scratch',
    targetLabel: TARGET_LABEL,
    kind,
    status: fallbackExit === 0 ? 'PASS' : 'FAIL',
    exitCode: fallbackExit,
    durationMs,
    nodeId: safeRecord.nodeId ?? 'chromium@1.65.1@unknown',
    assertionKind: safeRecord.assertionKind ?? 'none',
    testCount: safeRecord.testCount ?? 0,
    skipped: Boolean(safeRecord.skipped),
    covered: false,
    observedEvidence: safeRecord.evidenceText ?? '',
    error: safeRecord.error ?? null,
    artifacts,
    redactionsCount,
    startedAt: safeRecord.startedAt ?? null,
    endedAt: safeRecord.endedAt ?? null,
  }
}

export async function executeAllScratchScenarios({ targetUrl, scratchDir }) {
  const out = {}
  for (const kind of ['happy', 'weak', 'broken', 'skipped', 'cred']) {
    out[kind] = await executeScratchPlaywright({ testSpec: { kind }, targetUrl, scratchDir })
  }
  return out
}
