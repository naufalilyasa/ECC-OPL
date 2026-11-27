#!/usr/bin/env node
'use strict';

/**
 * Work-item routing for the project-local `.ecc-opl/` engineering workspace.
 *
 * Plain files only. Every path resolves from `process.cwd()` or an explicit
 * `--root`, so this runs inside an application project, not just the ECC repo.
 *
 * Not to be confused with `scripts/work-items.js` (SQLite roadmap CLI).
 *
 *   resolve [--id <id>]              print the bound id or "none"
 *   ensure --slug <slug> [--id <id>] create lazily, bind the pointer
 *   append --workflow <n> --artifact <k> --path <p> [--note <n>]
 *   progress [--id <id>]             rebuild progress.json from timeline.jsonl
 *   close [--id <id>]                clear the pointer, keep the directory
 *   archive <id>                     move the directory under archive/
 *
 * Exit: 0 success (including resolve -> "none"), 1 resolution/usage error,
 * 2 filesystem error.
 */

const fs = require('fs');
const path = require('path');
const { withStateStoreLock } = require(path.join(__dirname, '..', 'state-store', 'file-lock.js'));

const WS = '.ecc-opl';
const ARTIFACT_DIRS = [
  'research', 'prd', 'plan', 'implementation', 'review',
  'design', 'e2e', 'audit', 'documentation', 'evidence', 'canvas',
];

class UsageError extends Error {}
class FileError extends Error {}

function root() {
  const flag = argv().root;
  if (!flag) return process.cwd();
  if (!fs.existsSync(flag)) throw new UsageError(`--root does not exist: ${flag}`);
  return path.resolve(flag);
}

function ws(...parts) {
  return path.join(root(), WS, ...parts);
}

function argv() {
  const out = { _: [] };
  const args = process.argv.slice(3);
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i += 1; }
    } else out._.push(a);
  }
  return out;
}

function readPointer() {
  try {
    const id = fs.readFileSync(ws('active'), 'utf8').trim();
    return id && fs.existsSync(ws('work-items', id)) ? id : null;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new FileError(`cannot read ${ws('active')}: ${error.message}`);
  }
}

function writePointer(id) {
  try {
    fs.mkdirSync(ws(), { recursive: true });
    fs.writeFileSync(ws('active'), `${id}\n`);
  } catch (error) {
    throw new FileError(`cannot write ${ws('active')}: ${error.message}`);
  }
}

function itemDir(id) { return ws('work-items', id); }

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

function nextId(slug) {
  const date = today();
  let max = 0;
  try {
    for (const name of fs.readdirSync(ws('work-items'))) {
      const m = name.match(/^WI-\d{8}-(\d{3})-/);
      if (m && name.startsWith(`WI-${date}-`)) max = Math.max(max, Number(m[1]));
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw new FileError(`cannot scan work items: ${error.message}`);
  }
  return `WI-${date}-${String(max + 1).padStart(3, '0')}-${slug}`;
}

function readTimeline(id) {
  const file = path.join(itemDir(id), 'timeline.jsonl');
  try {
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new FileError(`cannot read ${file}: ${error.message}`);
  }
}

function appendEvent(id, event) {
  const file = path.join(itemDir(id), 'timeline.jsonl');
  const line = `${JSON.stringify(event)}\n`;
  try {
    fs.mkdirSync(itemDir(id), { recursive: true });
    withStateStoreLock(file, () => fs.appendFileSync(file, line));
  } catch (error) {
    throw new FileError(`cannot append to ${file}: ${error.message}`);
  }
}

function requireId(flag) {
  const explicit = flag.id && flag.id !== true ? flag.id : null;
  if (explicit) {
    if (!fs.existsSync(itemDir(explicit))) throw new UsageError(`unknown work item: ${explicit}`);
    return explicit;
  }
  const bound = readPointer();
  if (!bound) throw new UsageError('no active work item (pass --id or run ensure first)');
  return bound;
}

function cmdResolve(flag) {
  const explicit = flag.id && flag.id !== true ? flag.id : null;
  if (explicit) return fs.existsSync(itemDir(explicit)) ? explicit : 'none';
  return readPointer() || 'none';
}

function cmdEnsure(flag) {
  if (!flag.slug || flag.slug === true) throw new UsageError('ensure requires --slug');
  const slug = String(flag.slug).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  if (!slug) throw new UsageError('--slug produced an empty slug');
  const explicit = flag.id && flag.id !== true ? flag.id : null;
  const existing = explicit || readPointer();
  const id = existing || nextId(slug);
  const dir = itemDir(id);
  try {
    fs.mkdirSync(dir, { recursive: true });
    for (const sub of ARTIFACT_DIRS) fs.mkdirSync(path.join(dir, sub), { recursive: true });
    const manifest = path.join(dir, 'manifest.json');
    if (!fs.existsSync(manifest)) {
      fs.writeFileSync(manifest, `${JSON.stringify({
        id, slug: explicit ? id.replace(/^WI-\d{8}-\d{3}-/, '') : slug,
        created: new Date().toISOString(), status: 'active', workflows: [],
      }, null, 2)}\n`);
      appendEvent(id, { ts: new Date().toISOString(), workflow: 'work-item', artifact: 'manifest', path: manifest, note: 'created' });
    }
    writePointer(id);
  } catch (error) {
    if (error instanceof FileError) throw error;
    throw new FileError(`cannot create ${dir}: ${error.message}`);
  }
  return id;
}

function cmdAppend(flag) {
  if (!flag.workflow || !flag.artifact || !flag.path) {
    throw new UsageError('append requires --workflow, --artifact and --path');
  }
  const id = requireId(flag);
  appendEvent(id, {
    ts: new Date().toISOString(),
    workflow: String(flag.workflow),
    artifact: String(flag.artifact),
    path: String(flag.path),
    ...(flag.note && flag.note !== true ? { note: String(flag.note) } : {}),
  });
  return id;
}

/** Pure rebuild: identical bytes for an unchanged timeline (no wall-clock reads). */
function cmdProgress(flag) {
  const id = requireId(flag);
  const events = readTimeline(id);
  const workflows = {};
  for (const e of events) {
    const wf = workflows[e.workflow] || (workflows[e.workflow] = { artifacts: {}, firstAt: e.ts, lastAt: e.ts, count: 0 });
    (wf.artifacts[e.artifact] || (wf.artifacts[e.artifact] = [])).push(e.path);
    wf.firstAt = e.ts < wf.firstAt ? e.ts : wf.firstAt;
    wf.lastAt = e.ts > wf.lastAt ? e.ts : wf.lastAt;
    wf.count += 1;
  }
  const progress = {
    workItem: id,
    derivedFrom: 'timeline.jsonl',
    eventCount: events.length,
    updatedAt: events.length ? events[events.length - 1].ts : null,
    workflows,
  };
  const file = path.join(itemDir(id), 'progress.json');
  try {
    fs.writeFileSync(file, `${JSON.stringify(progress, null, 2)}\n`);
  } catch (error) {
    throw new FileError(`cannot write ${file}: ${error.message}`);
  }
  return id;
}

function cmdClose(flag) {
  const id = requireId(flag);
  try {
    if (readPointer() === id) fs.rmSync(ws('active'), { force: true });
    const manifest = path.join(itemDir(id), 'manifest.json');
    const data = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    data.status = 'closed';
    fs.writeFileSync(manifest, `${JSON.stringify(data, null, 2)}\n`);
  } catch (error) {
    if (error.code === 'ENOENT') throw new FileError(`missing work item files for ${id}: ${error.message}`);
    throw new FileError(`cannot close ${id}: ${error.message}`);
  }
  appendEvent(id, { ts: new Date().toISOString(), workflow: 'work-item', artifact: 'lifecycle', path: itemDir(id), note: 'closed' });
  return id;
}

function cmdArchive(flag) {
  const id = flag._[0];
  if (!id) throw new UsageError('archive requires a work item id');
  const from = itemDir(id);
  const to = ws('archive', id);
  if (!fs.existsSync(from)) {
    if (fs.existsSync(to)) throw new UsageError(`already archived: ${id}`);
    throw new UsageError(`unknown work item: ${id}`);
  }
  try {
    fs.mkdirSync(ws('archive'), { recursive: true });
    if (readPointer() === id) fs.rmSync(ws('active'), { force: true });
    fs.renameSync(from, to);
    const indexFile = ws('archive', 'index.json');
    const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : [];
    index.push({ id, archivedAt: new Date().toISOString() });
    fs.writeFileSync(indexFile, `${JSON.stringify(index, null, 2)}\n`);
  } catch (error) {
    throw new FileError(`cannot archive ${id}: ${error.message}`);
  }
  return id;
}

function main() {
  const command = process.argv[2];
  const flag = argv();
  try {
    switch (command) {
      case 'resolve': console.log(cmdResolve(flag)); break;
      case 'ensure': console.log(cmdEnsure(flag)); break;
      case 'append': console.log(cmdAppend(flag)); break;
      case 'progress': console.log(cmdProgress(flag)); break;
      case 'close': console.log(cmdClose(flag)); break;
      case 'archive': console.log(cmdArchive(flag)); break;
      default:
        throw new UsageError(`unknown subcommand: ${command || '(none)'} — expected resolve|ensure|append|progress|close|archive`);
    }
    return 0;
  } catch (error) {
    const code = error instanceof FileError ? 2 : 1;
    process.stderr.write(`${error.message}\n`);
    return code;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = { main };
