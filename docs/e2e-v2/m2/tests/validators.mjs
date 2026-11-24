// M2 reference validators — deterministic enforcement of validator-specs §2–§4.
// Every result carries the frozen case ID so a report can trace 1:1 to the spec table.
// Prompt-side mirror: .opencode/commands/e2e.md §3.1 and §8.

import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs'
import { isAbsolute, join, resolve, sep } from 'node:path'

const STATES = ['missing', 'in progress', 'unverified', 'covered', 'not applicable']

const realOr = (p) => {
  try {
    return realpathSync(p)
  } catch {
    return resolve(p)
  }
}
const inside = (root, p) => p === root || p.startsWith(root + sep)
const escapes = (p) => isAbsolute(p) || p.split(/[\\/]/).includes('..')
const registryOf = (root) => join(root, 'TESTS.md')

// Registry location: docs-map wins only when valid and in-repo; else root TESTS.md (RP-01..RP-05).
export function resolveRegistry({ root, docsMapPath }) {
  const realRoot = realOr(root)
  const rootRegistry = registryOf(root)
  const rejections = []
  let candidate

  if (docsMapPath && existsSync(docsMapPath)) {
    let mapping
    try {
      const parsed = JSON.parse(readFileSync(docsMapPath, 'utf8'))
      mapping = typeof parsed === 'string' ? parsed : (parsed.registry ?? parsed.tests)
    } catch {
      rejections.push({ code: 'RP-04', reason: 'docs-map is not valid JSON; treated as untrusted data' })
    }
    if (typeof mapping === 'string' && mapping !== '') {
      if (isAbsolute(mapping)) {
        rejections.push({ code: 'RP-01', reason: `absolute registry path rejected: ${mapping}` })
      } else if (escapes(mapping)) {
        rejections.push({ code: 'RP-02', reason: `parent traversal rejected: ${mapping}` })
      } else {
        const lexical = join(root, mapping)
        if (inside(realRoot, realOr(lexical))) candidate = lexical
        else rejections.push({ code: 'RP-04', reason: 'docs-map maps outside the workspace; ignored' })
      }
    }
  }

  // Dual location: two different registries both exist → STOP, pick no winner (RP-05).
  if (candidate && existsSync(rootRegistry) && realOr(candidate) !== realOr(rootRegistry)) {
    return { ok: false, code: 'RP-05', stop: true, reason: 'TESTS.md and docs-map disagree; resolve the conflict explicitly' }
  }

  const path = candidate ?? rootRegistry
  // Symlinked registry whose realpath leaves the repo is never handed to a reader (RP-03).
  if (existsSync(path) && lstatSync(path).isSymbolicLink() && !inside(realRoot, realOr(path))) {
    return { ok: false, code: 'RP-03', reason: 'registry is a symlink escaping the repository' }
  }

  return { ok: true, source: candidate ? 'docs-map' : 'root', path, rejections }
}

// Spec path from a registry block or Section 2 asset row (RP-06, SE-03).
export function checkSpecPath({ root, path }) {
  if (escapes(path)) return { ok: false, code: 'RP-06', reason: `spec path rejected: ${path}` }
  const repoRoot = realOr(root)
  const full = join(repoRoot, path)
  if (existsSync(full) && !inside(repoRoot, realOr(full))) {
    return { ok: false, code: 'SE-03', reason: 'spec file is a symlink escaping the repository' }
  }
  return { ok: true, path: full }
}

// Evidence artifact must exist and stay inside the scoped root (SE-01, SE-02, SE-04).
export function checkEvidence({ root, scopedRoot, path }) {
  const full = isAbsolute(path) ? path : join(realOr(root), path)
  if (!existsSync(full)) {
    return { ok: false, code: 'SE-04', citable: false, coverable: false, reason: 'evidence path does not exist' }
  }
  const real = realOr(full)
  if (!inside(realOr(scopedRoot), real)) {
    const code = lstatSync(full).isSymbolicLink() ? 'SE-01' : 'SE-02'
    return { ok: false, code, citable: false, coverable: false, reason: 'evidence resolves outside the scoped root' }
  }
  return { ok: true, citable: true, coverable: true, path: real }
}

// State enum + `stale` reconciliation (B10, DEC-12). Nothing is ever migrated silently.
export function assessRow({ State, evidenceValid, routeExists }) {
  if (State === 'stale') {
    return {
      ok: false,
      code: 'B10',
      applied: false,
      proposal: { State: 'unverified' },
      reason: 'legacy State: stale is an assessment, not a State; propose the correction (DEC-12)',
    }
  }
  if (!STATES.includes(State)) {
    return { ok: false, code: 'STATE-INVALID', reason: `State ${JSON.stringify(State)} is outside the 5 controlled values` }
  }
  if (State === 'covered' && evidenceValid === false) {
    return { ok: true, proposedState: 'unverified', reason: 'evidence went invalid' }
  }
  if (State === 'covered' && routeExists === false) {
    return { ok: true, assessment: 'stale', proposedState: 'unverified', reason: 'route is gone' }
  }
  return { ok: true }
}
