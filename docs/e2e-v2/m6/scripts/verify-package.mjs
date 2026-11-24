// Minimal M6-only package verifier used by M6-R1.1 N611 packaging mutations.
import { readFileSync, readdirSync, lstatSync, realpathSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, resolve, relative, isAbsolute } from 'node:path'

const root = resolve(process.argv[2] || '.')
const sha = (b) => createHash('sha256').update(b).digest('hex')
const manifestPath = join(root, 'SHA256-MANIFEST.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const exclusions = new Set(manifest.declared_exclusions ?? [manifestPath])
const listed = new Map(manifest.files.map((f) => [f.path, f]))
const errors = []

for (const f of manifest.files) {
  const p = join(root, f.path)
  if (!p.startsWith(root + '/')) { errors.push('TRAVERSAL:' + f.path); continue }
  try {
    const bytes = readFileSync(p)
    if (bytes.length !== f.bytes) errors.push('BYTES:' + f.path)
    if (sha(bytes) !== f.sha256) errors.push('HASH:' + f.path)
  } catch { errors.push('MISSING:' + f.path) }
}
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const full = join(dir, e.name)
  if (e.isSymbolicLink()) { errors.push('SYMLINK:' + relative(root, full)); return [] }
  return e.isDirectory() ? walk(full) : [full]
})
for (const p of walk(root)) {
  const rel = relative(root, p)
  if (!listed.has(rel) && !exclusions.has(rel) && rel !== 'SHA256-MANIFEST.json' && rel !== 'SHA256-MANIFEST.sha256') {
    errors.push('UNLISTED:' + rel)
  }
}
if (manifest.files.length !== new Set(manifest.files.map((f) => f.path)).size) errors.push('DUPLICATE_PATHS')
if (errors.length) {
  console.error('VERIFY_FAIL ' + errors.join(' ')); process.exit(1)
}
console.log('VERIFY_OK ' + manifest.files.length + ' files')
