#!/usr/bin/env node
// Framework/project discovery (DBN-01/02). Pure reads over the filesystem: no
// writes, no process starts, no persistent registry. Returns a runtime profile
// or an explicit `ambiguous`/`unsupported` result with the evidence that caused
// it -- never a guess based on "some dependency exists somewhere".
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const NATIVE_VARIANTS = new Set([
  'react-vite', 'vue-vite', 'laravel-inertia-react', 'laravel-inertia-vue',
])

function readJson(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null }
}

function fileIn(dir, names) {
  return names.find((n) => existsSync(join(dir, n))) ?? null
}

// Expands `apps/*` style workspace globs one level deep; deeper globs are rare
// in the target projects and an explicit miss is safer than a wrong guess.
function expandWorkspaces(root, patterns) {
  const dirs = []
  for (const pattern of patterns) {
    const [head, tail] = pattern.split('/')
    if (tail && tail.includes('*')) {
      const base = join(root, head)
      if (!existsSync(base)) continue
      for (const name of readdirSync(base)) {
        const dir = join(base, name)
        if (statSync(dir).isDirectory() && existsSync(join(dir, 'package.json'))) dirs.push(dir)
      }
    } else if (!pattern.includes('*') && existsSync(join(root, pattern, 'package.json'))) {
      dirs.push(join(root, pattern))
    }
  }
  return dirs
}

function readWorkspacePatterns(root) {
  const pkg = readJson(join(root, 'package.json'))
  if (Array.isArray(pkg?.workspaces)) return pkg.workspaces
  if (pkg?.workspaces?.packages) return pkg.workspaces.packages
  const pnpm = join(root, 'pnpm-workspace.yaml')
  if (existsSync(pnpm)) {
    const text = readFileSync(pnpm, 'utf8')
    const listed = text.split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('- '))
      .map((l) => l.slice(2).replace(/^['"]|['"]$/g, ''))
    if (listed.length) return listed
  }
  return []
}

function detectPackageManager(dir) {
  if (existsSync(join(dir, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(join(dir, 'yarn.lock'))) return 'yarn'
  if (existsSync(join(dir, 'bun.lockb')) || existsSync(join(dir, 'bun.lock'))) return 'bun'
  if (existsSync(join(dir, 'package-lock.json'))) return 'npm'
  return null
}

const COMPONENT_LIBRARIES = {
  '@mui/material': 'mui', antd: 'antd', '@chakra-ui/react': 'chakra',
  '@mantine/core': 'mantine', bootstrap: 'bootstrap', vuetify: 'vuetify',
  primevue: 'primevue', 'element-plus': 'element-plus',
  '@headlessui/react': 'headlessui', 'flowbite-react': 'flowbite',
}

function detectStyling(dir, pkg) {
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies }
  const tailwindConfig = fileIn(dir, [
    'tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.cjs', 'tailwind.config.mjs',
  ])
  if (tailwindConfig || deps?.tailwindcss) return { stylingSystem: 'tailwind', evidence: tailwindConfig ?? 'tailwindcss dependency' }
  if (deps?.sass || deps?.['sass-embedded']) return { stylingSystem: 'scss', evidence: 'sass dependency' }
  if (deps?.['styled-components'] || deps?.['@emotion/react']) return { stylingSystem: 'css-in-js', evidence: 'styled-components/emotion' }
  return { stylingSystem: 'plain-css', evidence: 'no styling dependency detected' }
}

function jsFrameworkSignal(dir, pkg) {
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies }
  if (!deps) return null
  const has = (name) => Boolean(deps[name])
  if (has('next')) return 'next'
  if (has('nuxt')) return 'nuxt'
  if (has('@angular/core')) return 'angular'
  if (has('svelte') || has('@sveltejs/kit')) return 'svelte'
  if (has('react') || has('react-dom')) return 'react'
  if (has('vue')) return 'vue'
  return null
}

function buildTool(dir) {
  if (fileIn(dir, ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'])) return 'vite'
  if (fileIn(dir, ['next.config.js', 'next.config.mjs', 'next.config.ts'])) return 'next'
  if (fileIn(dir, ['nuxt.config.ts', 'nuxt.config.js'])) return 'nuxt'
  if (fileIn(dir, ['angular.json'])) return 'angular'
  if (fileIn(dir, ['svelte.config.js'])) return 'sveltekit'
  return null
}

function commandInputs(dir) {
  const config = fileIn(dir, ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'])
  if (!config) return null
  try {
    const text = readFileSync(join(dir, config), 'utf8')
    const match = text.match(/input\s*:\s*\[([^\]]+)\]/)
    if (!match) return null
    return match[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
  } catch { return null }
}

function entrypointFor(dir, framework, tool) {
  if (framework === 'laravel') {
    const inputs = commandInputs(dir) ?? []
    const script = inputs.find((p) => /\.(tsx|jsx|ts|js)$/.test(p))
    if (script) return { entrypoint: script, evidence: `${script} (vite input)` }
    const fallback = fileIn(join(dir, 'resources', 'js'), ['app.tsx', 'app.jsx', 'app.ts', 'app.js'])
    if (fallback) return { entrypoint: `resources/js/${fallback}`, evidence: `resources/js/${fallback}` }
    return { entrypoint: 'resources/views', evidence: 'resources/views (Blade)' }
  }
  if (tool === 'vite') {
    const source = fileIn(join(dir, 'src'), ['main.tsx', 'main.jsx', 'main.ts', 'main.js'])
    return { entrypoint: source ? `src/${source}` : 'index.html', evidence: source ? `src/${source}` : 'index.html' }
  }
  if (framework === 'next') {
    const appDir = existsSync(join(dir, 'app')) ? 'app' : null
    return { entrypoint: appDir ?? 'pages', evidence: appDir ? 'app/' : 'pages/' }
  }
  if (framework === 'nuxt') return { entrypoint: 'app.vue', evidence: 'nuxt convention' }
  return { entrypoint: null, evidence: 'no conventional entrypoint found' }
}

function languageFor(dir, pkg, framework, entrypoint) {
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies }
  if (framework === 'vue') return 'vue-sfc'
  if (framework === 'svelte') return 'svelte'
  if (entrypoint && /\.(tsx?|mts)$/.test(entrypoint)) return 'typescript'
  if (entrypoint && /\.jsx$/.test(entrypoint)) return 'javascript'
  if (existsSync(join(dir, 'tsconfig.json')) || deps?.typescript) return 'typescript'
  if (existsSync(join(dir, 'resources', 'js', 'app.tsx'))) return 'typescript'
  return 'javascript'
}

function variantFor(framework, tool, hasInertiaReact, hasInertiaVue) {
  if (hasInertiaReact) return 'laravel-inertia-react'
  if (hasInertiaVue) return 'laravel-inertia-vue'
  if (framework === 'react' && tool === 'vite') return 'react-vite'
  if (framework === 'vue' && tool === 'vite') return 'vue-vite'
  if (framework === 'react') return 'react-generic'
  if (framework === 'vue') return 'vue-generic'
  if (framework) return framework
  return null
}

function profileFor(appRoot, root, sourceLabel) {
  const pkg = readJson(join(appRoot, 'package.json'))
  const composer = readJson(join(appRoot, 'composer.json'))
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies }
  const requires = composer?.require ?? {}
  const evidence = []
  const notes = []

  const laravel = Boolean(requires['laravel/framework'])
  const inertiaServer = Boolean(requires['inertiajs/inertia-laravel'])
  const hasInertiaReact = Boolean(deps?.['@inertiajs/react']) || Boolean(inertiaServer && (deps?.react))
  const hasInertiaVue = Boolean(deps?.['@inertiajs/vue3']) || Boolean(inertiaServer && (deps?.vue))
  if (laravel) evidence.push('composer.json requires laravel/framework')

  const framework = laravel ? 'laravel' : jsFrameworkSignal(appRoot, pkg)
  if (framework && !laravel) evidence.push(`${framework} in package.json dependencies`)

  const tool = laravel ? 'vite' : buildTool(appRoot)
  if (tool) evidence.push(`${tool} config present`)

  const variant = variantFor(framework, tool, hasInertiaReact, hasInertiaVue)
  if (laravel && !variant) evidence.push('no Inertia adapter detected (Blade views)')

  const packageManager = detectPackageManager(appRoot) ?? detectPackageManager(root)
  const styling = detectStyling(appRoot, pkg)
  evidence.push(`styling: ${styling.evidence}`)

  const componentLibrary = Object.keys(COMPONENT_LIBRARIES)
    .find((name) => deps?.[name]) ?? null
  if (componentLibrary) evidence.push(`component library: ${componentLibrary}`)

  const scripts = pkg?.scripts ?? {}
  const devScript = scripts.dev ? 'dev' : scripts.start ? 'start' : null
  const devCommand = devScript
    ? `${packageManager ?? 'npm'} run ${devScript}`
    : laravel ? 'php artisan serve' : null
  if (!devScript && laravel) notes.push('Laravel: serve with `php artisan serve` plus the Vite asset server')
  if (!devScript && !laravel) notes.push('no dev script in package.json')

  const entry = entrypointFor(appRoot, framework, tool)
  evidence.push(`entry: ${entry.evidence}`)

  const previewMode = variant && NATIVE_VARIANTS.has(variant) ? 'framework-native' : null
  const runner = previewMode ? 'native'
    : framework || laravel ? 'generic'
    : null

  return {
    status: 'detected',
    projectRoot: root,
    appRoot,
    appSource: sourceLabel,
    framework,
    variant,
    language: languageFor(appRoot, pkg, framework, entry.entrypoint),
    packageManager,
    devCommand,
    entrypoint: entry.entrypoint,
    stylingSystem: styling.stylingSystem,
    componentLibrary,
    dependencies: {
      react: Boolean(deps?.react), vue: Boolean(deps?.vue),
      inertia: hasInertiaReact || hasInertiaVue, laravel,
      source: 'package.json/composer.json present at detection time',
    },
    previewMode,
    runner,
    evidence,
    notes,
  }
}

function laravelVariantAt(dir, root) {
  const composer = readJson(join(dir, 'composer.json'))
  if (!composer?.require?.['laravel/framework']) return null
  return profileFor(dir, root, dir === root ? 'root' : 'workspace')
}

export function detectProject(targetDir) {
  const root = resolve(targetDir)
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    return { status: 'unsupported', reason: 'not-a-directory', projectRoot: root, evidence: [] }
  }

  const laravelAtRoot = laravelVariantAt(root, root)
  if (laravelAtRoot) return laravelAtRoot

  const patterns = readWorkspacePatterns(root)
  const workspaceDirs = patterns.length ? expandWorkspaces(root, patterns) : []
  const rootPkg = readJson(join(root, 'package.json'))
  const rootSignal = jsFrameworkSignal(root, rootPkg)

  const apps = workspaceDirs
    .map((dir) => ({ dir, profile: profileFor(dir, root, 'workspace') }))
    .filter((entry) => entry.profile.framework)

  // Conflicting evidence is reported, never resolved by preference: a root
  // React dependency plus a different framework inside a workspace package is
  // exactly the case where an automatic choice would be a guess.
  const signals = new Set()
  if (rootSignal) signals.add(rootSignal)
  for (const app of apps) signals.add(app.profile.framework)

  if (signals.size > 1) {
    return {
      status: 'ambiguous',
      projectRoot: root,
      evidence: [
        rootSignal ? `root package.json depends on ${rootSignal}` : null,
        ...apps.map((a) => `${a.dir} is ${a.profile.framework}`),
      ].filter(Boolean),
      candidates: apps.map((a) => ({ appRoot: a.dir, variant: a.profile.variant })),
    }
  }

  if (apps.length > 1) {
    return {
      status: 'ambiguous',
      projectRoot: root,
      evidence: apps.map((a) => `${a.dir} is ${a.profile.framework}`),
      candidates: apps.map((a) => ({ appRoot: a.dir, variant: a.profile.variant })),
    }
  }

  if (apps.length === 1) return apps[0].profile

  if (rootSignal) return profileFor(root, root, 'root')

  return {
    status: 'detected',
    projectRoot: root,
    appRoot: root,
    appSource: 'root',
    framework: null,
    variant: 'standalone-html',
    language: null,
    packageManager: detectPackageManager(root),
    devCommand: null,
    entrypoint: null,
    stylingSystem: existsSync(join(root, 'index.html')) ? 'plain-css' : null,
    componentLibrary: null,
    dependencies: { react: false, vue: false, inertia: false, laravel: false },
    previewMode: 'standalone-html',
    runner: null,
    evidence: ['no framework signal found'],
    notes: ['No package.json framework dependency, composer.json Laravel, or workspace app: standalone HTML is the only supported mode here.'],
  }
}

function main() {
  const target = process.argv[2]
  if (!target) {
    process.stderr.write('usage: detect-project.mjs <project-dir>\n')
    process.exit(2)
  }
  process.stdout.write(JSON.stringify(detectProject(target), null, 2) + '\n')
}

if (process.argv[1] && process.argv[1].endsWith('detect-project.mjs')) main()
