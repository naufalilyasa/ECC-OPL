// M2 step 10 — executes the reference detector over the F01–F06 fixture trees and writes
// per-fixture outputs plus the B05 (LD) and B06 (JG) companions that M1 deferred.
// File-based CLI: node docs/e2e-v2/m2/scripts/emit-map-reports.mjs
// Static only: reads fixture files, writes reports, never mutates a registry.
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { detect, groupJourneys, proposeIds } from '../tests/detector.mjs'
import { buildFixtures } from '../tests/fixtures.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REP = join(HERE, '../reports')
const FROZEN = join(HERE, '../../m1/reports/F01-F06-map-output-expected.json')

const STAMP = {
  generated_at: '2026-11-23T00:00:00Z',
  milestone: 'M2',
  method: 'reference-implementation harness (node --test): docs/e2e-v2/m2/tests/detector.mjs over docs/e2e-v2/m2/tests/fixtures.mjs',
  status: 'EXECUTED',
  live_prompt_verification: 'DEFERRED_TO_M6 (48-scenario acceptance)',
  writes_performed: false,
}
const write = (name, body) => writeFileSync(join(REP, name), JSON.stringify({ ...STAMP, ...body }, null, 2) + '\n')

const base = mkdtempSync(join(tmpdir(), 'm2-map-'))
const roots = buildFixtures(base)
const out = Object.fromEntries(Object.entries(roots).map(([id, root]) => [id, detect({ root })]))

const journeyNamed = (id, name) => out[id].journeys.filter((j) => j.name === name)
const uiRoutes = (id) => out[id].routes.filter((r) => r.kind === 'ui')
const check = (contract, observed, verdict) => ({ contract, observed, verdict: verdict ? 'PASS' : 'FAIL' })

// ---- per-fixture artifacts, one per ACCEPTANCE-MATRIX.csv name ----
const FIXTURE_REPORTS = {
  F01: {
    name: 'Next.js App Router',
    scenario_id: 'B01',
    expected_output: '3 journeys | 0 API-as-UI | confidence confirmed/partial',
    checks: () => {
      const dash = journeyNamed('F01', 'dashboard')
      const orders = journeyNamed('F01', 'orders')[0]
      return [
        check('must_output: UI pages under app/(grp)/[locale]/dashboard/page.tsx mapped', uiRoutes('F01').map((r) => r.file), uiRoutes('F01').some((r) => r.file.endsWith('[locale]/dashboard/page.tsx'))),
        check('must_output: locale variants collapsed into one parameterized flow', dash.length, dash.length === 1 && dash[0].routes.length === 3),
        check('must_output: layout guard detected as authenticated', dash[0]?.actor, dash[0]?.actor === 'authenticated'),
        check('must_not: route.ts (API) mapped as a UI page', out.F01.exclusions.find((e) => e.file.endsWith('route.ts'))?.reason, !out.F01.routes.some((r) => r.file.endsWith('route.ts'))),
        check('must_not: the same page listed once per locale', dash.length, dash.length === 1),
        check('must_not: a dynamic segment reported as confidence=confirmed', orders?.confidence, orders?.confidence === 'partial'),
        check('expected_output: 3 journeys', out.F01.journeys.length, out.F01.journeys.length === 3),
      ]
    },
  },
  F02: {
    name: 'Next.js Pages Router',
    scenario_id: 'B02',
    expected_output: '1 journey | 3 exclusions tercatat',
    checks: () => [
      check('must_output: pages/index.tsx mapped', uiRoutes('F02').map((r) => r.file), uiRoutes('F02').some((r) => r.file === 'pages/index.tsx')),
      check('must_output: 3 exclusions recorded explicitly', out.F02.exclusions.map((e) => e.file), out.F02.exclusions.length === 3),
      check('must_not: _app or _document mapped as UI pages', out.F02.routes.map((r) => r.file), !out.F02.routes.some((r) => /_app|_document/.test(r.file))),
      check('must_not: pages/api/* mapped as UI pages', out.F02.routes.map((r) => r.file), !out.F02.routes.some((r) => r.file.startsWith('pages/api/'))),
      check('expected_output: 1 journey', out.F02.journeys.length, out.F02.journeys.length === 1),
    ],
  },
  F03: {
    name: 'Laravel + Inertia React',
    scenario_id: 'B03',
    expected_output: '2 journeys | role labels | critical path flag',
    checks: () => {
      const dash = journeyNamed('F03', 'dashboard')[0]
      const src = dash?.sources.join(' ') ?? ''
      return [
        check('must_output: login -> dashboard -> edit journey spanning routes/web.php and resources/js/Pages', dash?.sources, /routes\/web\.php/.test(src) && /resources\/js\/Pages/.test(src)),
        check('must_output: auth role boundary labelled in actors', dash?.actor, dash?.actor === 'authenticated'),
        check('must_output: critical path flagged for the auth-gated flow', dash?.risk, dash?.risk === 'critical'),
        check('must_not: role-dependent paths merged without an actor label', dash?.routes, Array.isArray(dash?.routes) && Boolean(dash?.actor)),
        check('must_not: routes/api.php mapped as a browser journey', out.F03.journeys.map((j) => j.sources.join(' ')), !out.F03.journeys.some((j) => j.sources.join(' ').includes('routes/api.php'))),
        check('expected_output: 2 journeys', out.F03.journeys.length, out.F03.journeys.length === 2),
      ]
    },
  },
  F04: {
    name: 'React Router',
    scenario_id: 'B04',
    expected_output: '2 journeys | dynamic path PARTIAL',
    checks: () => {
      const products = journeyNamed('F04', 'products')[0]
      return [
        check('must_output: nested routes flattened to full paths', products?.routes, products?.routes.length === 3),
        check('must_output: guard wrapper correlated to its route children', out.F04.journeys.map((j) => j.actor), out.F04.journeys.every((j) => j.actor === 'authenticated')),
        check('must_not: a guarded route reported as public', out.F04.journeys.filter((j) => j.actor === 'public').length, out.F04.journeys.every((j) => j.actor !== 'public')),
        check('must_not: a dynamic route reported as confirmed', products?.confidence, products?.confidence === 'partial'),
        check('expected_output: 2 journeys', out.F04.journeys.length, out.F04.journeys.length === 2),
      ]
    },
  },
  F05: {
    name: 'SvelteKit / Astro / Nuxt',
    scenario_id: 'B04',
    expected_output: '3 stack reports | 0 invented path | PARTIAL untuk dynamic',
    checks: () => {
      const blog = out.F05.journeys.find((j) => j.routes.some((p) => p.includes('[slug]')))
      const glob = { sveltekit: /\+page\.svelte$/, astro: /\.astro$/, nuxt: /\.vue$/ }
      return [
        check('must_output: src/routes/**/+page.svelte matched only by the SvelteKit detector', out.F05.stacks.sveltekit, out.F05.stacks.sveltekit === 3),
        check('must_output: src/pages/**/*.astro matched only by the Astro detector', out.F05.stacks.astro, out.F05.stacks.astro === 1),
        check('must_output: pages/**/*.vue matched only by the Nuxt detector', out.F05.stacks.nuxt, out.F05.stacks.nuxt === 1),
        check('must_not: a route invented by a detector whose stack did not match', out.F05.routes.map((r) => `${r.stack}:${r.file}`), out.F05.routes.every((r) => glob[r.stack].test(r.file))),
        check('must_not: locale mirrors listed twice', out.F05.journeys.map((j) => j.journey_key), new Set(out.F05.journeys.map((j) => j.journey_key)).size === out.F05.journeys.length),
        check('must_not: a dynamic route reported as confidence=confirmed', blog?.confidence, blog?.confidence === 'partial'),
      ]
    },
  },
  F06: {
    name: 'Yii2 / Express / Fastify / Hono',
    scenario_id: 'B04',
    expected_output: '4 route groups | API flagged | PARTIAL untuk conditional',
    checks: () => {
      const server = out.F06.routes.filter((r) => ['express', 'fastify', 'hono'].includes(r.stack))
      return [
        check('must_output: urlManager rules and controller actions grouped', out.F06.routes.filter((r) => r.stack === 'yii2').map((r) => r.path), out.F06.stacks.yii2 >= 1),
        check('must_output: app.get/post registrations flagged as API, not browser', server.map((r) => `${r.path}:${r.kind}`), server.every((r) => r.kind === 'api')),
        check('must_output: confidence stated explicitly per group', out.F06.journeys.map((j) => j.confidence), out.F06.journeys.every((j) => ['confirmed', 'partial', 'unverified'].includes(j.confidence))),
        check('must_not: a server route presented as a browser journey', out.F06.journeys.map((j) => j.sources.join(' ')), !out.F06.journeys.some((j) => /server\.js|fastify\.js|hono\.js/.test(j.sources.join(' ')))),
        check('must_not: a conditional route reported as confirmed', out.F06.routes.filter((r) => r.stack === 'yii2').map((r) => r.confidence), out.F06.routes.filter((r) => r.stack === 'yii2').every((r) => r.confidence === 'partial')),
        check('expected_output: 4 route groups', Object.keys(out.F06.stacks), ['yii2', 'express', 'fastify', 'hono'].every((s) => out.F06.stacks[s] >= 1)),
      ]
    },
  },
}

const frozen = JSON.parse(readFileSync(FROZEN, 'utf8'))
const specs = Object.entries(FIXTURE_REPORTS).map(([id, spec]) => {
  const checks = spec.checks()
  return {
    artifact: frozen.fixtures.find((f) => f.fixture_id === id)?.matrices_artifact ?? `${id}-map-output.json`,
    body: {
      fixture_id: id,
      scenario_id: spec.scenario_id,
      name: spec.name,
      expected_output: spec.expected_output,
      spec_of_record: 'docs/e2e-v2/m1/reports/F01-F06-map-output-expected.json + docs/e2e-v2/m1/detector-characterization.md §1',
      contract_checks: checks,
      contract_passed: checks.every((c) => c.verdict === 'PASS'),
      observed: {
        stacks: out[id].stacks,
        route_count: out[id].routes.length,
        ui_route_count: uiRoutes(id).length,
        exclusions: out[id].exclusions,
        journeys: out[id].journeys,
      },
    },
  }
})

// F04/F05/F06 share one frozen artifact name, so they are emitted as one file with three fixture entries.
for (const artifact of new Set(specs.map((s) => s.artifact))) {
  const group = specs.filter((s) => s.artifact === artifact).map((s) => s.body)
  write(
    artifact,
    group.length === 1
      ? group[0]
      : {
          fixtures: group,
          contract_passed: group.every((g) => g.contract_passed),
          artifact_name_note: 'F04/F05/F06 share this artifact name in docs/e2e-v2/m1/reports/F01-F06-map-output-expected.json.',
        },
  )
}

// ---- B05 locale dedup (LD-01..05) ----
const f01 = out.F01
const f04 = out.F04
const dash = journeyNamed('F01', 'dashboard')
const unlabelled = [
  { stack: 'next-app', kind: 'ui', path: '/admin', file: 'a', actor: undefined, guard: false, dynamic: false, confidence: 'confirmed' },
  { stack: 'next-app', kind: 'ui', path: '/admin/settings', file: 'b', actor: undefined, guard: false, dynamic: false, confidence: 'confirmed' },
]
const ldChecks = [
  ['LD-01', 'D1', 'en/, id/ and [locale]/ mirrors of one page produce exactly one journey_key with a locale parameter', 'journey_count == 1', dash.length],
  ['LD-02', 'D1', 'no page appears twice across locale variants', 'distinct (name, actors) count == journey count', `${new Set(f01.journeys.map((j) => j.journey_key)).size} distinct / ${f01.journeys.length} journeys`],
  ['LD-03', 'D1', 'locale variants are recorded in alternate_paths[], not as new journeys', 'alternate_paths non-empty, journeys unchanged', dash[0]?.alternate_paths],
  ['LD-04', 'D3', 'two role-dependent paths are only merged when each carries an actor label', 'merged == false without actors', `${groupJourneys(unlabelled).length} journeys for 2 unlabelled paths`],
  ['LD-05', 'D2', 'several routes with the same outcome/actor/state/risk produce one journey', 'routes 3 -> journeys 1', journeyNamed('F04', 'products')[0]?.routes],
]
write('locale-dedup.report.json', {
  scenario_id: 'B05',
  stimulus: 'locale variants + journeys',
  expected: 'satu parameterized flow; beberapa rute jadi satu journey',
  spec_of_record: 'docs/e2e-v2/contracts/journey-contract-freeze.md §3 (D1, D3)',
  fixture_ids: ['F01', 'F04', 'F05'],
  observed_results: { F01: { journeys: f01.journeys.length, dashboard: dash[0] }, F04: { journeys: f04.journeys.length } },
  assertions: ldChecks.map(([id, rule, assertion, expected, observed]) => ({
    id,
    rule,
    assertion,
    expected,
    observed,
    runner_status:
      id === 'LD-01' ? (dash.length === 1 ? 'PASS' : 'FAIL')
      : id === 'LD-02' ? (new Set(f01.journeys.map((j) => j.journey_key)).size === f01.journeys.length ? 'PASS' : 'FAIL')
      : id === 'LD-03' ? (dash[0]?.alternate_paths.length === 2 ? 'PASS' : 'FAIL')
      : id === 'LD-04' ? (groupJourneys(unlabelled).length === 2 ? 'PASS' : 'FAIL')
      : journeyNamed('F04', 'products').length === 1 && journeyNamed('F04', 'products')[0].routes.length === 3 ? 'PASS' : 'FAIL',
  })),
  requirement_ids: ['E2E-FR-019'],
  prd_ac: 'AC-019',
})

// ---- B06 journey grouping (JG-01..07) ----
const f03 = out.F03
const names = Object.values(out).flatMap((d) => d.journeys.map((j) => j.name))
const proposal = proposeIds(['TEST-E2E-001', 'TEST-E2E-007'])
const jg = [
  ['JG-01', 'D2', 'list -> detail -> edit collapses into one journey, not three', 'journeys == 1', journeyNamed('F03', 'dashboard').length === 1],
  ['JG-02', 'D2', 'one journey is never emitted per URL', 'journeys < routes', f04.journeys.length < f04.routes.length],
  ['JG-03', 'D2', "journey name uses the project's own words, not a URL slug", 'name not a path', names.every((n) => !n.includes('/') && !n.startsWith(':'))],
  ['JG-04', 'D2', 'money/auth/destructive flows are flagged risk=critical', 'risk == critical', f03.journeys.some((j) => j.risk === 'critical')],
  ['JG-05', 'D4', 'dynamic/conditional/generated routes report confidence=partial', 'confidence != confirmed', journeyNamed('F04', 'products')[0].confidence === 'partial' && out.F06.routes.filter((r) => r.stack === 'yii2').every((r) => r.confidence === 'partial')],
  ['JG-06', '§4', 'a journey with empty test_registry_ids[] yields a Section 2 row AND a Section 4 block proposal', 'proposals == 1 + 1', proposal.section2Rows === 1 && proposal.section4Blocks === 1],
  ['JG-07', '§4', 'new ID is max(existing numeric) + 1; no reserved or removed ID reused', 'id == max + 1', proposal.nextId === 'TEST-E2E-008'],
]
write('journey-grouping.report.json', {
  scenario_id: 'B06',
  stimulus: 'multi-route grouping',
  expected: 'satu journey, bukan satu test per URL',
  spec_of_record: 'docs/e2e-v2/contracts/journey-contract-freeze.md §3 (D2, D4) + §4',
  fixture_ids: ['F03', 'F06'],
  observed_results: { F03: f03.journeys, F04: f04.journeys, proposal },
  assertions: jg.map(([id, rule, assertion, expected, ok]) => ({ id, rule, assertion, expected, runner_status: ok ? 'PASS' : 'FAIL' })),
  requirement_ids: ['E2E-FR-008', 'E2E-FR-019'],
  prd_ac: 'AC-009',
})

rmSync(base, { recursive: true, force: true })
