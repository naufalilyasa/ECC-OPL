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
 *   bind --slug <slug> [--run <id>]  resolve, resume or create, then bind the pointer
 *   bind --id <id>                   bind an existing item (reopens it if closed)
 *   resolve [--id <id>]              print the bound id or "none"
 *   ensure --slug <slug> [--id <id>] alias of bind (kept for existing callers)
 *   append --workflow <n> --artifact <k> --path <p>
 *          [--run <id>] [--revision <rev>] [--outcome <state>] [--evidence <p>] [--note <n>]
 *   progress [--id <id>]             rebuild progress.json from timeline.jsonl
 *   close [--id <id>]                mark closed, clear the pointer, keep the directory
 *   reopen [--id <id>]               mark closed -> active and bind it
 *   archive <id> [--force]           move a closed item under archive/
 *
 * Resolution never guesses. `bind --slug` reuses an item only when the slug
 * matches exactly; a different objective always creates a new item. An unknown
 * explicit id is an error, not "none" — a preamble must never treat a failed
 * resolution as a successful binding.
 *
 * Exit: 0 success (including resolve -> "none"), 1 usage/resolution error,
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
const OUTCOMES = ['pass', 'fail', 'blocked', 'pending_approval', 'skipped', 'incomplete'];

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

function value(flag, key) {
  const v = flag[key];
  return v && v !== true ? String(v) : null;
}

function itemDir(id) { return ws('work-items', id); }
function archivedDir(id) { return ws('archive', id); }

/** A pointer to an archived item is not a binding. */
function readPointer() {
  try {
    const id = fs.readFileSync(ws('active'), 'utf8').trim();
    return id && fs.existsSync(itemDir(id)) ? id : null;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new FileError(`cannot read ${ws('active')}: ${error.message}`);
  }
}

function writePointer(id) {
  try {
    fs.mkdirSync(ws(), { recursive: true });
    for (const sub of ['reports', 'runtime']) fs.mkdirSync(ws(sub), { recursive: true });
    fs.writeFileSync(ws('active'), `${id}\n`);
  } catch (error) {
    throw new FileError(`cannot write ${ws('active')}: ${error.message}`);
  }
}

function clearPointer(id) {
  if (readPointer() === id) fs.rmSync(ws('active'), { force: true });
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

function listIds(dir) {
  try { return fs.readdirSync(dir).filter((n) => /^WI-/.test(n)); }
  catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new FileError(`cannot scan ${dir}: ${error.message}`);
  }
}

/** Ids are unique across active, closed and archived items. */
function nextId(slug) {
  const date = today();
  const taken = new Set([...listIds(ws('work-items')), ...listIds(ws('archive'))]);
  let max = 0;
  for (const name of taken) {
    const m = name.match(/^WI-(\d{8})-(\d{3})-/);
    if (m && `WI-${date}` === `WI-${m[1]}`) max = Math.max(max, Number(m[2]));
  }
  let n = max + 1;
  let id = `WI-${date}-${String(n).padStart(3, '0')}-${slug}`;
  while (taken.has(id)) { n += 1; id = `WI-${date}-${String(n).padStart(3, '0')}-${slug}`; }
  return id;
}

function readManifest(id) {
  const file = path.join(itemDir(id), 'manifest.json');
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') throw new UsageError(`unknown work item: ${id}`);
    throw new FileError(`cannot read ${file}: ${error.message}`);
  }
}

function writeManifest(id, data) {
  const file = path.join(itemDir(id), 'manifest.json');
  try { fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`); }
  catch (error) { throw new FileError(`cannot write ${file}: ${error.message}`); }
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
  const explicit = value(flag, 'id');
  if (explicit) {
    if (!fs.existsSync(itemDir(explicit))) throw new UsageError(`unknown work item: ${explicit}`);
    return explicit;
  }
  const bound = readPointer();
  if (!bound) throw new UsageError('no active work item (pass --id or run bind first)');
  return bound;
}

/**
 * Minimal consumer ignore setup. Only consolidated reports stay reviewable;
 * every working artifact under `.ecc-opl/` stays out of Git.
 * `--ignore-mode local` writes the same rule to `.git/info/exclude` instead,
 * `--ignore-mode none` writes nothing. Never touches an existing .gitignore.
 */
function ensureIgnore() {
  const mode = value(argv(), 'ignore-mode') || 'project';
  if (mode === 'none') return;
  const projectRoot = root();
  const isGit = fs.existsSync(path.join(projectRoot, '.git'));
  if (!isGit) return; // never initialise Git in a non-Git project
  const header = '# Generated by the ECC-OPL work-item helper. Do not edit by hand.';
  // Inside `.ecc-opl/` the rules are already relative; in the repo-wide exclude
  // they must be prefixed or a bare `*` would ignore the whole project.
  const rule = (prefix) => [header,
    `${prefix}*`, `!${prefix}reports`, `!${prefix}reports/**`, ''].join('\n');
  try {
    if (mode === 'local') {
      const exclude = path.join(projectRoot, '.git', 'info', 'exclude');
      const current = fs.existsSync(exclude) ? fs.readFileSync(exclude, 'utf8') : '';
      if (!current.includes('.ecc-opl')) {
        fs.mkdirSync(path.dirname(exclude), { recursive: true });
        fs.appendFileSync(exclude, `\n${rule(`${WS}/`)}`);
      }
      return;
    }
    const file = path.join(projectRoot, WS, '.gitignore');
    if (!fs.existsSync(file)) fs.writeFileSync(file, rule(''));
  } catch (error) {
    // Ignore setup is convenience, never a reason to fail a bind.
    process.stderr.write(`warning: could not write ignore rules: ${error.message}\n`);
  }
}

function cmdResolve(flag) {
  const explicit = value(flag, 'id');
  if (explicit) {
    if (fs.existsSync(itemDir(explicit))) return explicit;
    throw new UsageError(`unknown work item: ${explicit}`);
  }
  return readPointer() || 'none';
}

/** Create the item layout and, for a fresh item, its manifest. */
function materialise(id, slug) {
  const dir = itemDir(id);
  try {
    fs.mkdirSync(dir, { recursive: true });
    for (const sub of ARTIFACT_DIRS) fs.mkdirSync(path.join(dir, sub), { recursive: true });
    if (!fs.existsSync(path.join(dir, 'manifest.json'))) {
      fs.writeFileSync(path.join(dir, 'manifest.json'), `${JSON.stringify({
        id, slug, created: new Date().toISOString(), status: 'active', workflows: [],
      }, null, 2)}\n`);
      appendEvent(id, {
        ts: new Date().toISOString(), workflow: 'work-item', artifact: 'manifest',
        path: path.join(dir, 'manifest.json'), note: 'created',
      });
    }
  } catch (error) {
    if (error instanceof FileError) throw error;
    throw new FileError(`cannot create ${dir}: ${error.message}`);
  }
  return id;
}

function reopenIfClosed(id) {
  const manifest = readManifest(id);
  if (manifest.status === 'active') return id;
  manifest.status = 'active';
  manifest.reopenedAt = new Date().toISOString();
  writeManifest(id, manifest);
  appendEvent(id, {
    ts: manifest.reopenedAt, workflow: 'work-item', artifact: 'lifecycle',
    path: itemDir(id), note: 'reopened',
  });
  return id;
}

function cmdBind(flag) {
  const explicit = value(flag, 'id');
  if (explicit) {
    if (!fs.existsSync(itemDir(explicit))) throw new UsageError(`unknown work item: ${explicit}`);
    reopenIfClosed(explicit);
    writePointer(explicit);
    ensureIgnore();
    return explicit;
  }
  const raw = value(flag, 'slug');
  if (!raw) throw new UsageError('bind requires --slug or --id');
  const slug = raw.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  if (!slug) throw new UsageError('--slug produced an empty slug');

  // Exact slug match, including the bound item. A different objective creates
  // a new item rather than attaching to whatever was active last.
  const match = [...listIds(ws('work-items')), ...listIds(ws('archive'))]
    .filter((n) => n.replace(/^WI-\d{8}-\d{3}-/, '') === slug)
    .sort()
    .pop();
  if (match && fs.existsSync(itemDir(match))) {
    reopenIfClosed(match);
    writePointer(match);
    ensureIgnore();
    return match;
  }
  if (match && fs.existsSync(archivedDir(match))) {
    throw new UsageError(`slug "${slug}" belongs to archived item ${match} — pass --id to reuse it deliberately`);
  }

  const id = materialise(nextId(slug), slug);
  writePointer(id);
  ensureIgnore();
  return id;
}

function cmdAppend(flag) {
  if (!value(flag, 'workflow') || !value(flag, 'artifact') || !value(flag, 'path')) {
    throw new UsageError('append requires --workflow, --artifact and --path');
  }
  const outcome = value(flag, 'outcome');
  if (outcome && !OUTCOMES.includes(outcome)) {
    throw new UsageError(`unknown --outcome "${outcome}" — expected ${OUTCOMES.join('|')}`);
  }
  const id = requireId(flag);
  appendEvent(id, {
    ts: new Date().toISOString(),
    workflow: value(flag, 'workflow'),
    artifact: value(flag, 'artifact'),
    path: value(flag, 'path'),
    ...(value(flag, 'run') ? { run: value(flag, 'run') } : {}),
    ...(value(flag, 'revision') ? { revision: value(flag, 'revision') } : {}),
    ...(outcome ? { outcome } : {}),
    ...(value(flag, 'evidence') ? { evidence: value(flag, 'evidence') } : {}),
    ...(value(flag, 'note') ? { note: value(flag, 'note') } : {}),
  });
  return id;
}

/**
 * Pure rebuild: identical bytes for an unchanged timeline (no wall-clock reads).
 * Outcomes are only ever what an event states; nothing is inferred from the
 * presence of an artifact or the number of events.
 */
function cmdProgress(flag) {
  const id = requireId(flag);
  const events = readTimeline(id);
  const workflows = {};
  const runs = [];
  const outcomes = {};
  const blockers = [];
  const pendingApprovals = [];

  for (const e of events) {
    const wf = workflows[e.workflow] || (workflows[e.workflow] = { artifacts: {}, firstAt: e.ts, lastAt: e.ts, count: 0 });
    (wf.artifacts[e.artifact] || (wf.artifacts[e.artifact] = [])).push(e.path);
    wf.firstAt = e.ts < wf.firstAt ? e.ts : wf.firstAt;
    wf.lastAt = e.ts > wf.lastAt ? e.ts : wf.lastAt;
    wf.count += 1;
    if (e.outcome) outcomes[e.outcome] = (outcomes[e.outcome] || 0) + 1;
    if (e.run) {
      runs.push({
        run: e.run,
        workflow: e.workflow,
        artifact: e.artifact,
        ...(e.revision ? { revision: e.revision } : {}),
        ...(e.outcome ? { outcome: e.outcome } : {}),
        ...(e.evidence ? { evidence: e.evidence } : {}),
        at: e.ts,
      });
    }
    if (e.outcome === 'blocked') blockers.push({ workflow: e.workflow, ...(e.run ? { run: e.run } : {}), note: e.note || null, at: e.ts });
    if (e.outcome === 'pending_approval') pendingApprovals.push({ workflow: e.workflow, ...(e.run ? { run: e.run } : {}), path: e.path, at: e.ts });
  }

  const progress = {
    workItem: id,
    derivedFrom: 'timeline.jsonl',
    eventCount: events.length,
    updatedAt: events.length ? events[events.length - 1].ts : null,
    outcomes,
    pendingApprovals,
    blockers,
    nextActions: pendingApprovals.length
      ? pendingApprovals.map((p) => `await owner approval for ${p.workflow}${p.run ? ` run ${p.run}` : ''} (${p.path})`)
      : [],
    runs,
    workflows,
  };
  const file = path.join(itemDir(id), 'progress.json');
  try { fs.writeFileSync(file, `${JSON.stringify(progress, null, 2)}\n`); }
  catch (error) { throw new FileError(`cannot write ${file}: ${error.message}`); }
  return id;
}

function cmdClose(flag) {
  const id = requireId(flag);
  const manifest = readManifest(id);
  if (manifest.status !== 'closed') {
    manifest.status = 'closed';
    manifest.closedAt = new Date().toISOString();
    writeManifest(id, manifest);
    appendEvent(id, {
      ts: manifest.closedAt, workflow: 'work-item', artifact: 'lifecycle',
      path: itemDir(id), note: 'closed',
    });
  }
  clearPointer(id);
  return id;
}

function cmdReopen(flag) {
  const id = requireId(flag);
  reopenIfClosed(id);
  writePointer(id);
  return id;
}

/**
 * Archiving is manual and only applies to a closed item. The index keeps the
 * report reference and the external references the item depends on, so a later
 * reader can still find what the item pointed at after the directory moves.
 */
function cmdArchive(flag) {
  const id = flag._[0];
  if (!id) throw new UsageError('archive requires a work item id');
  const from = itemDir(id);
  const to = archivedDir(id);
  if (!fs.existsSync(from)) {
    if (fs.existsSync(to)) throw new UsageError(`already archived: ${id}`);
    throw new UsageError(`unknown work item: ${id}`);
  }
  const manifest = readManifest(id);
  if (manifest.status !== 'closed' && !flag.force) {
    throw new UsageError(`${id} is ${manifest.status}, not closed — close it first or pass --force`);
  }
  const workspace = ws();
  const externals = readTimeline(id)
    .filter((e) => e.path && (e.path.startsWith('/') || e.path.startsWith('~')))
    .filter((e) => !e.path.startsWith(workspace))
    .map((e) => ({ workflow: e.workflow, artifact: e.artifact, path: e.path }));
  try {
    fs.mkdirSync(ws('archive'), { recursive: true });
    clearPointer(id);
    fs.renameSync(from, to);
    const indexFile = ws('archive', 'index.json');
    const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : [];
    index.push({
      id,
      archivedAt: new Date().toISOString(),
      status: manifest.status,
      report: `${WS}/reports/${id}.md`,
      archivedPath: `${WS}/archive/${id}`,
      externalReferences: externals,
      note: externals.length ? 'external references are owned outside this workspace' : 'no external references',
    });
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
      case 'bind':
      case 'ensure': console.log(cmdBind(flag)); break;
      case 'append': console.log(cmdAppend(flag)); break;
      case 'progress': console.log(cmdProgress(flag)); break;
      case 'close': console.log(cmdClose(flag)); break;
      case 'reopen': console.log(cmdReopen(flag)); break;
      case 'archive': console.log(cmdArchive(flag)); break;
      default:
        throw new UsageError(`unknown subcommand: ${command || '(none)'} — expected bind|resolve|append|progress|close|reopen|archive`);
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
