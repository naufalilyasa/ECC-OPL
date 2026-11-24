// M4 strict prompt-delta probe. Intentionally NOT named *.test.mjs so it never
// joins the normal glob. The Phase 4 delta is a PROPOSAL ONLY and NOT APPROVED:
// this file classifies the current preimage honestly and detects forged/altered
// insertions entirely in memory. Run separately:
//   node --test docs/e2e-v2/m4/tests/prompt-conformance.strict.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as R from './runner.mjs'
import * as F from './fixtures.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const CMD = join(HERE, '../../../..', '.opencode/commands/e2e.md')
const sha = (b) => createHash('sha256').update(b).digest('hex')
const current = readFileSync(CMD, 'utf8')
const insertion = Buffer.from(F.PROMPT_DELTA_INSERTION_B64, 'base64').toString('utf8')

test('STRICT-PROMPT: current preimage is missing the proposed M4 contract', () => {
  assert.equal(sha(Buffer.from(current, 'utf8')), F.PROMPT_PREIMAGE_SHA)
  assert.equal(R.detectInsertion(current, insertion).present, false)
  assert.equal(R.classifyPrompt(current).status, 'MISSING_CONTRACT')
})

test('STRICT-PROMPT: an exact insertion would produce the pinned postimage', () => {
  const forge = current.replace(F.PROMPT_DELTA_MARKER, insertion + F.PROMPT_DELTA_MARKER)
  assert.equal(sha(Buffer.from(forge, 'utf8')), F.PROMPT_POSTIMAGE_SHA)
  assert.equal(R.detectInsertion(forge, insertion).matching_bytes, true)
})

test('STRICT-PROMPT: forged/altered insertions are DETECTED, not accepted', () => {
  const forge = current.replace(F.PROMPT_DELTA_MARKER, insertion + F.PROMPT_DELTA_MARKER)
  const oneByteOff = insertion.slice(0, -3) + 'x\n\n'
  assert.equal(R.detectInsertion(forge, oneByteOff).present, false)
  assert.equal(R.detectInsertion(current, insertion).present, false)
  assert.equal(R.classifyPrompt(forge).status, 'CONTRACT_PRESENT')
})

test('STRICT-PROMPT: applied=false — no source edit was made or requested here', () => {
  assert.equal(sha(readFileSync(CMD)), F.PROMPT_PREIMAGE_SHA, 'STRICT-PROMPT: source untouched')
})
