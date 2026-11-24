// M2 reference resolver — E2E-FR-004 / AC-005 match order.
// Deterministic and inert: a registry block's `Command:` is data, never an invocation.

const FIELDS = ['State', 'Representative input', 'Observable expectation', 'Boundary', 'Test file', 'Command', 'Evidence']

export function parseRegistry(text) {
  const blocks = []
  const lines = String(text ?? '').split(/\r?\n/)
  let current
  for (const line of lines) {
    const head = line.match(/^###\s+(TEST-E2E-\d+)\s+—\s+(.*)$/)
    if (head) {
      current = { id: head[1], title: head[2].trim(), fields: {} }
      blocks.push(current)
      continue
    }
    if (!current) continue
    const field = line.match(/^-\s+([A-Za-z ]+?):\s*(.*)$/)
    if (field && FIELDS.includes(field[1])) current.fields[field[1]] = field[2].trim()
  }
  return blocks
}

const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

export function resolveTarget({ registryText, query }) {
  const blocks = parseRegistry(registryText)
  const q = norm(query)
  if (q === '') return { ok: false, code: 'REGISTRY_REQUIRED', next: '/e2e-map' }

  // 1. exact id, 2. title, 3. route inside Representative input — first tier with a hit wins.
  const tiers = [
    ['id', (b) => norm(b.id) === q],
    ['title', (b) => norm(b.title) === q],
    ['route', (b) => norm(b.fields['Representative input']).split(',').map(norm).includes(q)],
  ]

  for (const [via, hit] of tiers) {
    const matches = blocks.filter(hit)
    if (matches.length === 0) continue
    if (matches.length > 1) {
      const ordered = [...matches].sort((a, b) => a.id.localeCompare(b.id))
      const candidates = ordered.map((b) => ({ id: b.id, title: b.title, route: b.fields['Representative input'] ?? '' }))
      return {
        ok: false,
        code: 'AMBIGUOUS',
        via,
        candidates,
        recommended: candidates[0].id,
        question: `Which flow did you mean? ${candidates.map((c, i) => `${i + 1}. ${c.id} — ${c.title}${c.id === candidates[0].id ? ' (Recommended)' : ''}`).join('; ')}`,
      }
    }
    const b = matches[0]
    return {
      ok: true,
      via,
      match: {
        id: b.id,
        title: b.title,
        state: b.fields.State,
        route: b.fields['Representative input'],
        expectation: b.fields['Observable expectation'],
        boundary: b.fields.Boundary,
        spec: b.fields['Test file'] ?? b.fields['Test location'],
        command: b.fields.Command,
      },
      executed: false,
    }
  }

  return { ok: false, code: 'REGISTRY_REQUIRED', next: '/e2e-map', query }
}
