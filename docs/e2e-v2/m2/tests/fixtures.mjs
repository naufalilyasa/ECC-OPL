// M2 F01–F06 fixture projects (FIXTURE-MATRIX setups, materialized as throwaway trees).
// Each fixture is the minimum file set that exercises its frozen `must_output` / `must_not` contract.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const put = (root, file, body = '') => {
  const p = join(root, file)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, body)
}

export const FIXTURES = {
  F01: {
    name: 'Next.js App Router',
    files: {
      'app/(grp)/[locale]/layout.tsx': "export default function L({children}){ if(!session) redirect('/login'); return children }\n",
      'app/(grp)/[locale]/page.tsx': 'export default function Home(){ return <main/> }\n',
      'app/(grp)/[locale]/dashboard/page.tsx': 'export default function P(){ return <div/> }\n',
      'app/(grp)/en/dashboard/page.tsx': 'export default function P(){ return <div/> }\n',
      'app/(grp)/id/dashboard/page.tsx': 'export default function P(){ return <div/> }\n',
      'app/(grp)/[locale]/orders/[id]/page.tsx': 'export default function P(){ return <div/> }\n',
      'app/api/orders/route.ts': 'export async function GET(){ return Response.json([]) }\n',
    },
  },
  F02: {
    name: 'Next.js Pages Router',
    files: {
      'pages/index.tsx': 'export default function Home(){ return <div/> }\n',
      'pages/_app.tsx': 'export default function App({Component,pageProps}){ return <Component {...pageProps}/> }\n',
      'pages/_document.tsx': 'export default function Doc(){ return <html/> }\n',
      'pages/api/health.ts': 'export default function handler(req,res){ res.json({ok:true}) }\n',
    },
  },
  F03: {
    name: 'Laravel + Inertia React',
    files: {
      'routes/web.php': [
        "Route::get('/login', [AuthController::class, 'show']);",
        "Route::get('/dashboard', [DashboardController::class, 'index'])->middleware('auth');",
        "Route::get('/dashboard/edit', [DashboardController::class, 'edit'])->middleware('auth');",
        '',
      ].join('\n'),
      'routes/api.php': "Route::get('/api/users', [UserController::class, 'index']);\n",
      'resources/js/Pages/Auth/Login.tsx': 'export default function Login(){ return <form/> }\n',
      'resources/js/Pages/Dashboard.tsx': 'export default function Dashboard(){ return <main/> }\n',
    },
  },
  F04: {
    name: 'React Router',
    files: {
      'src/App.tsx': [
        "import { createBrowserRouter } from 'react-router-dom'",
        'export const router = createBrowserRouter([',
        "  { path: '/products', element: <List/> },",
        "  { path: '/products/:id', element: <Detail/> },",
        "  { path: '/products/:id/edit', element: <Protected><Edit/></Protected> },",
        "  { path: '/orders/:id', element: <Protected><Order/></Protected> },",
        '])',
        '',
      ].join('\n'),
    },
  },
  F05: {
    name: 'SvelteKit / Astro / Nuxt',
    files: {
      'src/routes/+page.svelte': '<h1>home</h1>\n',
      'src/routes/about/+page.svelte': '<h1>about</h1>\n',
      'src/routes/blog/[slug]/+page.svelte': '<h1>{data.title}</h1>\n',
      'src/pages/index.astro': '--- const t = 1 ---\n<h1>astro</h1>\n',
      'pages/index.vue': '<template><h1>nuxt</h1></template>\n',
    },
  },
  F06: {
    name: 'Yii2 / Express / Fastify / Hono',
    files: {
      'config/web.php': [
        "'urlManager' => [",
        "  'rules' => [",
        "    'site/login' => 'site/login',",
        "    'post/<id:\\d+>' => 'post/view',",
        '  ],',
        '],',
        '',
      ].join('\n'),
      'server.js': [
        "const app = express()",
        "app.get('/api/users', listUsers)",
        "app.post('/api/orders', createOrder)",
        '',
      ].join('\n'),
      'api/fastify.js': "fastify.get('/api/health', async () => ({ ok: true }))\n",
      'api/hono.js': "const app = new Hono()\napp.get('/api/ping', (c) => c.text('pong'))\n",
    },
  },
}

export function buildFixtures(baseDir) {
  const roots = {}
  for (const [id, fixture] of Object.entries(FIXTURES)) {
    const root = join(baseDir, id)
    mkdirSync(root, { recursive: true })
    for (const [file, body] of Object.entries(fixture.files)) put(root, file, body)
    roots[id] = root
  }
  return roots
}
