// M2 reference detector — characterized stack rules (detector-characterization §1, e2e-map.md:33–42)
// composed with the V2 correction overlay (D1 locale dedup, D2 grouping, D3 actor labels, D4 dynamic → PARTIAL).
// Static only: it reads files and emits a proposal; it never writes the registry.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const EXCLUDED = [
  [/^_app\.(t|j)sx?$/, '_app is a Next.js shell, not a UI page'],
  [/^_document\.(t|j)sx?$/, '_document is a Next.js shell, not a UI page'],
  [/^route\.(t|j)sx?$/, 'route.ts is an API handler, not a UI page'],
]

const STACKS = [
  { name: 'next-app', test: (p) => /^(?:src\/)?app\/(?:.*\/)?page\.(?:ts|tsx|js|jsx)$/.test(p) },
  { name: 'next-pages', test: (p) => /^(?:src\/)?pages\/.*\.(?:ts|tsx|js|jsx)$/.test(p) },
  { name: 'astro', test: (p) => /^(?:src\/)?pages\/.*\.(?:astro|md|mdx)$/.test(p) },
  { name: 'sveltekit', test: (p) => /^src\/routes\/.*\+page\.svelte$/.test(p) },
  { name: 'nuxt', test: (p) => /^(?:app\/)?(?:src\/)?pages\/.*\.vue$/.test(p) },
  { name: 'react-router', test: (p, text) => /createBrowserRouter|<Route\b/.test(text) },
  { name: 'vue-router', test: (p, text) => /createRouter\(\{/.test(text) },
  { name: 'laravel', test: (p) => /^routes\/(?:web|api)\.php$/.test(p) },
  { name: 'yii2', test: (p, text) => /urlManager/.test(text) },
  { name: 'server', test: (p, text) => /\.(?:get|post|put|patch|delete)\(\s*['"]\//.test(text) },
]

const CRITICAL = ['login', 'auth', 'checkout', 'payment', 'orders', 'account']
const LOCALES = ['[locale]', 'en', 'id', 'fr', 'de']

const walk = (root) => {
  const out = []
  const visit = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) visit(full)
      else out.push(relative(root, full).split(sep).join('/'))
    }
  }
  visit(root)
  return out.sort()
}

const readSafe = (root, file) => {
  try {
    return readFileSync(join(root, file), 'utf8')
  } catch {
    return ''
  }
}

const routeFromFile = (p) =>
  '/' +
  p
    .replace(/^(?:src\/)?app\//, '')
    .replace(/^(?:src\/)?pages\//, '')
    .replace(/^src\/routes\//, '')
    .replace(/\/?page\.(?:ts|tsx|js|jsx)$/, '')
    .replace(/\/?\+page\.svelte$/, '')
    .replace(/\.(?:ts|tsx|js|jsx|astro|md|mdx|vue)$/, '')
    .replace(/\((?:[^)]*)\)\//g, '')
    .replace(/\/index$/, '')
    .replace(/^\/?$/, '/')

const isDynamic = (route) => route.split('/').some((s) => s.startsWith(':') || /^\[.+\]$/.test(s))
const normalizeSegment = (s) => (s.startsWith(':') || /^\[.+\]$/.test(s) ? ':id' : s)
const normalizedKey = (route) =>
  route
    .split('/')
    .filter((s) => s && !LOCALES.includes(s))
    .map(normalizeSegment)
    .join('/')

const GUARD = /redirect\(\s*['"]\/login|Protected|middleware|middleware\(['"]auth/i

export function detect({ root }) {
  const files = walk(root)
  const guardDirs = files
    .filter((f) => /layout\.(?:t|j)sx?$/.test(f) && GUARD.test(readSafe(root, f)))
    .map((f) => f.split('/').slice(0, -1).join('/'))

  const routes = []
  const exclusions = []

  for (const file of files) {
    const base = file.split('/').pop()
    const exclusion = EXCLUDED.find(([re]) => re.test(base))
    if (exclusion) {
      exclusions.push({ file, reason: exclusion[1] })
      continue
    }
    if (/(^|\/)(?:src\/)?(?:app|pages)\/api\//.test(file)) {
      exclusions.push({ file, reason: 'API directory is not a browser surface' })
      continue
    }

    const text = readSafe(root, file)
    const stack = STACKS.find((s) => s.test(file, text))
    if (!stack) continue
    const guardedByLayout = guardDirs.some((d) => d === '' || file.startsWith(d + '/'))
    const inertia = files.filter((f) => f.startsWith('resources/js/Pages/') && /\.(?:tsx|jsx|vue|svelte)$/.test(f))

    if (stack.name === 'react-router' || stack.name === 'vue-router') {
      for (const m of text.matchAll(/path:\s*['"]([^'"]+)['"]/g)) {
        routes.push(makeRoute({ stack: stack.name, file, route: m[1], text }))
      }
      continue
    }
    if (stack.name === 'laravel') {
      const kind = file.endsWith('api.php') ? 'api' : 'ui'
      for (const line of text.split(/\r?\n/)) {
        for (const m of line.matchAll(/Route::(?:get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g)) {
          routes.push(makeRoute({ stack: 'laravel', file, route: m[1], text: line, kind, component: matchInertia(m[1], inertia) }))
        }
      }
      continue
    }
    if (stack.name === 'yii2') {
      // Only `'<url rule>' => '<controller>/<action>'` is a route; `'rules' => [` and `'class'` are config.
      for (const m of text.matchAll(/['"]([a-z0-9\-/<>:\\+]+)['"]\s*=>\s*['"]([a-z0-9\-/]+)['"]/g)) {
        routes.push(makeRoute({ stack: 'yii2', file, route: '/' + m[1], text, conditional: true }))
      }
      continue
    }
    if (stack.name === 'server') {
      const name = /fastify\./.test(text) ? 'fastify' : /new Hono/.test(text) ? 'hono' : 'express'
      for (const m of text.matchAll(/\.(?:get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g)) {
        routes.push(makeRoute({ stack: name, file, route: m[1], text, kind: 'api' }))
      }
      continue
    }

    routes.push(makeRoute({ stack: stack.name, file, route: routeFromFile(file), text, guardHint: guardedByLayout }))
  }

  // D1: a layout guard on the `[locale]` segment guards every mirror of that page.
  const variants = new Map()
  for (const r of routes) {
    if (r.kind !== 'ui') continue
    const key = `${r.stack}|${normalizedKey(r.path)}`
    variants.set(key, [...(variants.get(key) ?? []), r])
  }
  const guardedKeys = new Set([...variants].filter(([, g]) => g.some((r) => r.guard)).map(([k]) => k))
  const effective = routes.map((r) =>
    guardedKeys.has(`${r.stack}|${normalizedKey(r.path)}`) ? { ...r, guard: true, actor: 'authenticated' } : r,
  )

  const journeys = groupJourneys(effective)
  const stacks = {}
  for (const r of effective) stacks[r.stack] = (stacks[r.stack] ?? 0) + 1

  return { routes: effective, exclusions, journeys, stacks }
}

function makeRoute({ stack, file, route, text, kind = 'ui', conditional = false, guardHint = false, component }) {
  const guard = guardHint || GUARD.test(text)
  return {
    stack,
    file,
    path: route,
    kind,
    component,
    dynamic: isDynamic(route),
    conditional,
    guard,
    actor: guard ? 'authenticated' : 'public',
    confidence: isDynamic(route) || conditional ? 'partial' : 'confirmed',
  }
}

// A Laravel route is served by an Inertia page; correlate by the route's own name segments.
function matchInertia(route, inertiaFiles) {
  const segments = String(route).split('/').filter((s) => s && !/^[<>:]/.test(s)).map((s) => s.toLowerCase())
  const hit = inertiaFiles.find((f) => {
    const p = f.toLowerCase()
    return segments.some((s) => p.includes(`/${s}`) || p.includes(`/${s}.`))
  })
  return hit
}

// D1/D2/D3/D4 — collapse locale mirrors, group by actor + noun, never invent a journey.
export function groupJourneys(routes) {
  const variants = new Map()
  for (const r of routes) {
    if (r.kind !== 'ui') continue
    const key = `${r.stack}|${normalizedKey(r.path)}`
    const entry = variants.get(key) ?? { key, routes: [] }
    entry.routes.push(r)
    variants.set(key, entry)
  }

  const groups = new Map()
  const add = (stack, noun, actor, variant) => {
    // D3: an unlabelled path is never merged across variants — only locale/route mirrors of one key merge.
    const gkey = actor ? `${stack}|${noun}|${actor}` : `${stack}|${noun}|${variant.key}`
    const g = groups.get(gkey) ?? { stack, noun, actor, variants: [] }
    g.variants.push(variant)
    groups.set(gkey, g)
  }

  for (const v of variants.values()) {
    const stack = v.key.split('|')[0]
    const noun = v.key.split('|')[1].split('/').filter(Boolean)[0] ?? 'root'
    const labelled = v.routes.filter((r) => r.actor)
    if (labelled.length !== v.routes.length) {
      // LD-04: an unlabelled path is never merged — one journey per path.
      for (const r of v.routes) add(stack, noun, r.actor, { key: v.key, routes: [r] })
      continue
    }
    for (const actor of new Set(labelled.map((r) => r.actor))) {
      add(stack, noun, actor, { key: v.key, routes: labelled.filter((r) => r.actor === actor) })
    }
  }

  return [...groups.values()].map((g) => {
    const paths = g.variants.flatMap((v) => v.routes.map((r) => r.path))
    const mirrors = g.variants.flatMap((v) => v.routes.slice(1).map((r) => r.path))
    const sources = [
      ...new Set(
        g.variants.flatMap((v) =>
          v.routes.flatMap((r) => [r.file + ':1', ...(r.component ? [r.component + ':1'] : [])]),
        ),
      ),
    ]
    return {
      journey_key: `${g.stack}:${g.noun}:${g.actor ?? 'unlabelled'}`,
      name: g.noun,
      actor: g.actor,
      risk: CRITICAL.includes(g.noun) || g.variants.some((v) => v.routes.some((r) => r.guard)) ? 'critical' : 'normal',
      confidence: g.variants.some((v) => v.routes.some((r) => r.confidence === 'partial')) ? 'partial' : 'confirmed',
      routes: paths,
      alternate_paths: mirrors,
      sources,
    }
  })
}

// JG-06/JG-07: registry proposal mechanics for an unmapped journey.
export function proposeIds(existingIds) {
  const max = existingIds.reduce((acc, id) => {
    const n = Number(String(id).replace(/^TEST-E2E-/, ''))
    return Number.isFinite(n) && n > acc ? n : acc
  }, 0)
  return { section2Rows: 1, section4Blocks: 1, nextId: `TEST-E2E-${String(max + 1).padStart(3, '0')}` }
}
