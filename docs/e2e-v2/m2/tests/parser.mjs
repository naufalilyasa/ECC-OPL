// M2 reference parser — normative encoding of the prompt-side `/e2e` grammar.
// This module is the test oracle for .opencode/commands/e2e.md §1; it is never shell-invoked,
// because passing $ARGUMENTS through a shell is the injection surface PS-05..PS-07 forbid.

const MODES = ['map', 'run', 'full', 'status', 'help']
const USAGE_MODES = ['map', 'run', 'full', 'status', 'help', 'no-args']
const USAGE = [
  'Usage: /e2e [map|run|full|status|help] [target | TEST-E2E-NNN] [--ad-hoc]',
  '       /e2e   (no-args: read-only preview)',
].join('\n')

// Any shell- or substitution-significant character is rejected as a whole-token failure.
const INJECTION = /[;&|<>$`\\]/

const failClosed = (reason) => ({ ok: false, failClosed: true, action: 'none', reason, usage: USAGE, usageModes: USAGE_MODES })
const isMode = (t) => MODES.includes(t)
const isPathLike = (t) => /[\\/]/.test(t) || /^-/.test(t) || /^TEST-/i.test(t)

export function parse(raw) {
  const text = String(raw ?? '')
  const trimmed = text.trim()
  if (trimmed === '') return { ok: true, mode: 'no-args' }

  // PS-08: a newline may not smuggle a second mode; blank-only whitespace was handled above.
  if (/[\r\n]/.test(trimmed)) return failClosed('embedded newline rejected: one mode per invocation')

  const tokens = trimmed.split(/\s+/)

  // PS-05..PS-07: reject injection tokens before any further interpretation.
  for (const t of tokens) {
    if (INJECTION.test(t)) return failClosed(`token rejected before any shell boundary: ${JSON.stringify(t)}`)
  }

  if (!isMode(tokens[0])) {
    // PS-01 vs DEC-04: a lone unknown token, or a phrase carrying a path/flag/TEST-ID, is a
    // mistyped invocation. A plain multi-word phrase keeps the legacy `/e2e <flow>` hint only.
    if (tokens.length === 1 || tokens.some(isPathLike)) {
      return failClosed(`unknown mode: ${JSON.stringify(tokens[0])}`)
    }
    return {
      ok: true,
      mode: 'legacy-shorthand',
      action: 'none',
      hint: 'Legacy `/e2e <flow>` shorthand (DEC-04) is not executed here. Use `/e2e run <flow>` so the target resolves through the registry.',
    }
  }

  const mode = tokens[0]
  const rest = tokens.slice(1)

  if (rest.some(isMode)) return failClosed('one mode per invocation')

  const adHocCount = rest.filter((t) => t === '--ad-hoc').length
  if (adHocCount > 1) return failClosed('duplicate flag: --ad-hoc may appear at most once')
  if (adHocCount === 1 && rest[0] !== '--ad-hoc') return failClosed('--ad-hoc is only valid immediately after run')
  if (adHocCount === 1 && mode !== 'run') return failClosed('--ad-hoc is only valid on the run mode')

  const targetTokens = adHocCount === 1 ? rest.slice(1) : rest
  const target = targetTokens.join(' ')

  // PS-04: an empty argument list is a read-only preview, never `run` with an empty target.
  if (target === '') {
    if (adHocCount === 1) return failClosed('--ad-hoc requires a target flow')
    if (mode === 'run') return { ok: true, mode: 'no-args' }
    return { ok: true, mode }
  }

  return adHocCount === 1
    ? { ok: true, mode: 'run', subMode: 'ad-hoc', target }
    : { ok: true, mode, target }
}
