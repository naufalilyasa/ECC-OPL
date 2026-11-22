#!/usr/bin/env node
'use strict';

// Run-local filesystem evidence; no workflow state, Git access or agent dispatch.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const EXCLUDED = new Set(['.git', '.guardian-angel', 'node_modules', '.cache', '.venv', '__pycache__', 'dist', 'vendor']);
const SELF_TEMP = /^\.rc11-[0-9a-f-]+\.tmp$/;
const MAX_INVENTORY = 50000;
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const stable = (value) => JSON.stringify(value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, JSON.parse(stable(value[key]))]))
  : Array.isArray(value) ? value.map((item) => JSON.parse(stable(item))) : value);
function fail(code) { throw new Error(code); }
function relative(value) {
  if (typeof value !== 'string' || !value || path.isAbsolute(value) || value.includes('\\') || value.includes('\0')
      || value.split('/').some((part) => !part || part === '.' || part === '..' || EXCLUDED.has(part))) fail('INVALID_SCOPE_PATH');
  return value;
}
function rejectProtected(absolute) {
  if (absolute.split(/[\\/]/).some((part) => part === '.git' || part === '.guardian-angel')) fail('PROTECTED_METADATA');
  return absolute;
}
function checkedRoot(root) {
  if (typeof root !== 'string' || !path.isAbsolute(root)) fail('INVALID_SCOPE_ROOT');
  const absolute = rejectProtected(path.resolve(root));
  let rootStat;
  try { rootStat = fs.lstatSync(absolute); } catch (error) { fail('INVALID_SCOPE_ROOT'); }
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) fail('SYMLINK_OR_INVALID_ROOT');
  return rejectProtected(fs.realpathSync(absolute));
}
function checkedPath(root, rel) {
  let file = root;
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || fs.realpathSync(root) !== root) fail('SYMLINK_SCOPE');
  for (const part of relative(rel).split('/')) {
    file = path.join(file, part);
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink()) fail('SYMLINK_SCOPE');
  }
  if (fs.realpathSync(file) !== file) fail('SYMLINK_SCOPE');
  return file;
}
function readRegular(file) {
  rejectProtected(path.resolve(file));
  rejectProtected(fs.realpathSync(file));
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const before = fs.fstatSync(fd);
    if (!before.isFile() || before.size > 4 * 1024 * 1024) fail('UNSUPPORTED_FILE');
    const data = fs.readFileSync(fd); const after = fs.fstatSync(fd);
    if (before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) fail('STALE_SCOPE');
    return { data, stat: after };
  } finally { fs.closeSync(fd); }
}
// Bounded scoped inventory: walk metadata for every visible entry (cheap, bounded),
// but read full bytes/hash only for the selected edit set and explicit guard files.
// Out-of-scope large files are metadata-only and never block a small scoped edit.
function capture({ root, scope, guard = [], gitMode = 'NOT_INSPECTED', maxEntries = MAX_INVENTORY }) {
  const canonical = checkedRoot(root);
  if (!Array.isArray(scope) || !scope.length) fail('EXPLICIT_SCOPE_REQUIRED');
  if (!Array.isArray(guard) || !Number.isSafeInteger(maxEntries) || maxEntries < 1) fail('INVALID_SCOPE');
  const selected = [...new Set(scope.map(relative))].sort();
  const guarded = [...new Set(guard.map(relative))].sort();
  const contentSet = new Set([...selected, ...guarded]);
  const inventory = [];
  let entries = 0;
  function walk(dir, prefix = '') {
    for (const name of fs.readdirSync(dir).sort()) {
      if (EXCLUDED.has(name) || SELF_TEMP.test(name)) continue;
      if (++entries > maxEntries) fail('SCOPE_TOO_LARGE');
      const rel = prefix ? `${prefix}/${name}` : name;
      const file = path.join(dir, name);
      const stat = fs.lstatSync(file);
      let checkPath = file;
      if (stat.isSymbolicLink()) {
        try { checkPath = fs.realpathSync(file); } catch (_) { fail('INVALID_SYMLINK'); }
      }
      rejectProtected(checkPath);
      // Timestamps are mandatory on every row: metadata-only entries need them to
      // detect a same-size overwrite of an unhashed file by an unrelated writer.
      const row = { path: rel, mode: stat.mode & 0o777, uid: stat.uid, ino: stat.ino, dev: stat.dev, nlink: stat.nlink, mtimeMs: stat.mtimeMs, ctimeMs: stat.ctimeMs };
      if (stat.isSymbolicLink()) inventory.push({ ...row, type: 'symlink', mode: 0o777, target: fs.readlinkSync(file) });
      else if (stat.isDirectory()) { const { nlink, ...directory } = row; inventory.push({ ...directory, type: 'directory' }); walk(file, rel); }
      else if (stat.isFile()) {
        // bytes are hashed in a second pass, after selected directories expand
        inventory.push({ ...row, type: 'file', size: stat.size, content: false });
      } else inventory.push({ ...row, type: 'special' });
    }
  }
  walk(canonical);
  // Expand selected/guard directories to every descendant file; keep the 4 MiB
  // cap only on these paths. Out-of-scope assets remain metadata-only.
  const hashSet = new Set();
  for (const seed of contentSet) {
    const row = inventory.find((item) => item.path === seed);
    if (row && row.type === 'directory') {
      for (const item of inventory) if (item.type === 'file' && item.path.startsWith(seed + '/')) hashSet.add(item.path);
    } else {
      hashSet.add(seed);
    }
  }
  for (const row of inventory) {
    if (row.type !== 'file' || !hashSet.has(row.path)) continue;
    const { data, stat: readStat } = readRegular(path.join(canonical, row.path));
    if (row.ino !== readStat.ino || row.dev !== readStat.dev) fail('STALE_SCOPE');
    row.size = data.length; row.sha256 = sha(data); row.content = true;
  }
  for (const rel of selected) {
    const parts = rel.split('/');
    for (let i = 1; i <= parts.length; i++) {
      const row = inventory.find((item) => item.path === parts.slice(0, i).join('/'));
      if (!row) fail('SCOPE_NOT_FOUND');
      if (row.type === 'symlink') fail('SYMLINK_SCOPE');
      if (row.type !== 'file' && row.type !== 'directory') fail('UNSUPPORTED_SCOPE');
    }
    const leaf = inventory.find((item) => item.path === rel);
    if (leaf && leaf.type === 'file' && (leaf.nlink !== 1 || (process.getuid && leaf.uid !== process.getuid()))) fail('UNOWNED_SCOPE');
    if (inventory.some((row) => row.path.startsWith(rel + '/') && (row.type === 'symlink' || row.type === 'special' || row.type === 'file' && (row.nlink !== 1 || process.getuid && row.uid !== process.getuid())))) fail('SYMLINK_OR_UNSUPPORTED_SCOPE');
  }
  // Guards are read-only verification inputs: validate them as strictly as selected
  // paths. A missing, linked, special or overlapping guard is not acceptable evidence.
  for (const rel of guarded) {
    const row = inventory.find((item) => item.path === rel);
    if (!row || !['file', 'directory'].includes(row.type)) fail('INVALID_GUARD');
    if (row.type === 'file' && (row.nlink !== 1 || (process.getuid && row.uid !== process.getuid()))) fail('INVALID_GUARD');
    if (selected.some((s) => rel === s || rel.startsWith(s + '/') || s.startsWith(rel + '/'))) fail('GUARD_SCOPE_OVERLAP');
    const descendants = inventory.filter((item) => item.path.startsWith(rel + '/'));
    if (descendants.some((item) => !['file', 'directory'].includes(item.type))) fail('INVALID_GUARD');
    if (descendants.some((item) => item.type === 'file' && (item.nlink !== 1 || (process.getuid && item.uid !== process.getuid())))) fail('INVALID_GUARD');
    if ((row.type === 'file' || descendants.some((item) => item.type === 'file'))
        && !(row.type === 'file' ? row.sha256 : descendants.some((item) => item.type === 'file' && item.sha256))) fail('INVALID_GUARD');
  }
  const snapshot = { version: '1.2', root: canonical, scope: selected, guard: guarded, git_mode: gitMode, index_provenance: 'UNKNOWN', inventory };
  return { ...snapshot, fingerprint: sha(stable(snapshot)) };
}
function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || snapshot.version !== '1.2') fail('INVALID_SNAPSHOT');
  const { fingerprint, ...body } = snapshot;
  if (fingerprint !== sha(stable(body))) fail('INVALID_SNAPSHOT_FINGERPRINT');
  if (!Array.isArray(snapshot.inventory) || !Array.isArray(snapshot.scope) || !Array.isArray(snapshot.guard)
      || snapshot.inventory.some((row) => !Number.isFinite(row.mtimeMs) || !Number.isFinite(row.ctimeMs)
        || row.type === 'file' && row.content && typeof row.sha256 !== 'string')) fail('INVALID_SNAPSHOT');
}
function compare(before, after) {
  validateSnapshot(before); validateSnapshot(after);
  return { status: before.fingerprint === after.fingerprint ? 'MATCH' : 'STALE_SCOPE', before: before.fingerprint, after: after.fingerprint };
}
function inScope(file, selected) { return selected.some((rel) => file === rel || file.startsWith(rel + '/')); }
function applyHunks({ root, snapshot, hunks, authorizedPaths, scratch }) {
  // Guarded write channel. Authorization comes only from an explicit authorized
  // path set already present in the fingerprinted, freshly revalidated snapshot —
  // never from a caller-supplied boolean such as ownerApproved/quiescent.
  validateSnapshot(snapshot);
  if (checkedRoot(root) !== snapshot.root || !Array.isArray(hunks) || !hunks.length
      || !Array.isArray(authorizedPaths) || !authorizedPaths.length) fail('INVALID_SCOPE');
  const recoveryRoot = checkedRoot(scratch);
  if (recoveryRoot === snapshot.root || recoveryRoot.startsWith(snapshot.root + path.sep)
      || (fs.statSync(recoveryRoot).mode & 0o077)) fail('PRIVATE_EXTERNAL_SCRATCH_REQUIRED');
  const authorized = authorizedPaths.map(relative);
  const fresh = () => capture({ root, scope: snapshot.scope, guard: snapshot.guard || [], gitMode: snapshot.git_mode });
  if (compare(snapshot, fresh()).status !== 'MATCH') fail('STALE_SCOPE');
  const planned = new Map(); const preimages = new Map();
  for (const hunk of hunks) {
    const rel = relative(hunk.path);
    if (!authorized.includes(rel) || !inScope(rel, snapshot.scope)) fail('OUT_OF_SCOPE');
    if (typeof hunk.before !== 'string' || !hunk.before || typeof hunk.after !== 'string' || hunk.before === hunk.after) fail('INVALID_HUNK');
    if (!preimages.has(rel)) preimages.set(rel, readRegular(checkedPath(snapshot.root, rel)).data);
    const old = planned.get(rel) ?? preimages.get(rel);
    if (!Buffer.from(old.toString('utf8')).equals(old)) fail('UNSUPPORTED_HUNK_ENCODING');
    const text = old.toString('utf8'); const first = text.indexOf(hunk.before);
    if (first < 0 || text.indexOf(hunk.before, first + 1) >= 0) fail('HUNK_NOT_UNIQUE');
    planned.set(rel, Buffer.from(text.slice(0, first) + hunk.after + text.slice(first + hunk.before.length)));
  }
  const recovery = path.join(recoveryRoot, `preimage-${crypto.randomUUID()}.json`);
  fs.writeFileSync(recovery, JSON.stringify({ fingerprint: snapshot.fingerprint, files: [...preimages].map(([file, data]) => ({ path: file, before_sha256: sha(data), before_b64: data.toString('base64') })) }), { flag: 'wx', mode: 0o600, flush: true });
  const edits = []; let temporary;
  try {
    for (const [rel, next] of planned) {
      if (compare(snapshot, fresh()).status !== 'MATCH') fail('STALE_SCOPE_PARTIAL_PRESERVE');
      const file = checkedPath(snapshot.root, rel); const expected = snapshot.inventory.find((item) => item.path === rel);
      if (!expected || expected.type !== 'file') fail('STALE_SCOPE');
      const parent = path.dirname(file); const parentStat = fs.lstatSync(parent);
      temporary = path.join(parent, `.rc11-${crypto.randomUUID()}.tmp`);
      const fd = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
      try {
        for (let offset = 0; offset < next.length;) {
          const count = fs.writeSync(fd, next, offset, next.length - offset, offset);
          if (count < 1) fail('SHORT_WRITE'); offset += count;
        }
        fs.fchmodSync(fd, expected.mode); fs.fsyncSync(fd);
      } finally { fs.closeSync(fd); }
      // Optimistic checks are not an OS compare-and-swap: uncooperative concurrent
      // writers still require an externally quiescent workspace; never claim isolation.
      checkedPath(snapshot.root, rel);
      const currentParent = fs.lstatSync(parent); const current = readRegular(file);
      if (currentParent.ino !== parentStat.ino || currentParent.dev !== parentStat.dev
          || current.stat.ino !== expected.ino || current.stat.dev !== expected.dev
          || current.stat.nlink !== 1 || sha(current.data) !== expected.sha256) fail('STALE_SCOPE');
      const parentRel = path.relative(snapshot.root, parent);
      const justBefore = fresh();
      // Creating our own staging file legitimately updates the parent directory's
      // timestamps; ignore exactly that effect, never any other row.
      const withoutTemp = justBefore.inventory
        .filter((row) => row.path !== path.relative(snapshot.root, temporary))
        .map((row) => {
          const beforeParent = snapshot.inventory.find((item) => item.path === parentRel);
          return row.path === parentRel && beforeParent
            ? { ...row, mtimeMs: beforeParent.mtimeMs, ctimeMs: beforeParent.ctimeMs }
            : row;
        });
      if (stable(withoutTemp) !== stable(snapshot.inventory)) fail('STALE_SCOPE');
      checkedPath(snapshot.root, rel);
      fs.renameSync(temporary, file); temporary = null;
      edits.push({ path: rel, before_sha256: expected.sha256, after_sha256: sha(next), before: preimages.get(rel).toString('utf8'), after: next.toString('utf8') });
      const nextSnapshot = fresh();
      const parentAfter = fs.lstatSync(parent);
      // Rename itself changes the inode's ctime: take the committed stat, not the staged one.
      const committed = fs.lstatSync(file);
      const expectedInventory = snapshot.inventory.map((item) => item.path === rel
        ? { ...item, ino: committed.ino, dev: committed.dev, nlink: committed.nlink, size: next.length,
            mtimeMs: committed.mtimeMs, ctimeMs: committed.ctimeMs, sha256: sha(next) }
        : item.path === parentRel
          ? { ...item, mtimeMs: parentAfter.mtimeMs, ctimeMs: parentAfter.ctimeMs }
          : item);
      if (stable(nextSnapshot.inventory) !== stable(expectedInventory)) fail('STALE_SCOPE_AFTER_WRITE');
      snapshot = nextSnapshot;
    }
    return { status: 'APPLIED', edits, snapshot, recovery, concurrency: 'OPTIMISTIC_NOT_ISOLATED' };
  } catch (error) {
    error.recovery = recovery; error.edits = edits; throw error;
  } finally {
    if (temporary) {
      // Clean only our same-directory staging file; keep preimages for manual recovery.
      try { if (fs.realpathSync(path.dirname(temporary)) === path.dirname(temporary)) fs.unlinkSync(temporary); } catch (_) { /* target bytes are never restored here */ }
    }
  }
}
function decideCandidate(candidate) {
  const keep = ['dynamic', 'publicContract', 'testConsumer', 'sideEffects', 'differentErrors', 'trustBoundary', 'testFile', 'tautologicalTest', 'frameworkConvention', 'frameworkRegistration', 'externalPayload', 'migrationOrRelation'];
  if (keep.some((key) => candidate[key] === true)) return { decision: 'KEEP', reason: 'PROTECTED_CONSUMER_OR_BEHAVIOR' };
  if (candidate.ownership !== 'EXPLICIT_SCOPE') return { decision: 'DEFER', reason: 'DIRTY_TARGET_REQUIRES_OWNER_SCOPE' };
  const kinds = candidate.pass === 'remove-deadcode' ? ['private-helper', 'unused-import'] : candidate.pass === 'remove-ai-slops' ? ['redundant-wrapper', 'obvious-comment', 'equivalent-expression'] : [];
  if (candidate.risk !== 'LOW' || !kinds.includes(candidate.kind) || candidate.referenceEvidence !== true || candidate.behaviorEvidence !== true) return { decision: 'DEFER', reason: 'INSUFFICIENT_BEHAVIOR_PROOF' };
  return { decision: 'EDIT', reason: 'SCOPED_LOW_RISK_PROVEN' };
}
function parseTestEvidence({ stdout = '', exitCode, assertions = 0, error = null }) {
  if (error) return { status: 'NO_BASELINE', reason: String(error), assertions: 0 };
  const values = {};
  for (const key of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) {
    const matches = [...stdout.matchAll(new RegExp(`^# ${key} (\\d+)\\s*$`, 'gm'))];
    if (matches.length > 1) return { status: 'NO_BASELINE', reason: 'AMBIGUOUS_TEST_SUMMARY' };
    values[key] = matches.length ? Number(matches[0][1]) : 0;
  }
  if (exitCode !== 0 || values.fail || values.cancelled) return { status: 'BASELINE_NOT_GREEN', counts: values, exit_code: exitCode, assertions };
  if (!Number.isSafeInteger(assertions) || assertions < 1 || !values.tests || !values.pass || values.tests !== values.pass || values.skipped || values.todo) return { status: 'NO_BASELINE', counts: values, assertions };
  return { status: 'GREEN', counts: values, assertions, exit_code: exitCode };
}
function verifyLoadedSkill({ expected, session, requestedSession, requestedParent, registry, messages }) {
  const sourceBody = typeof expected?.source === 'string' ? expected.source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '') : null;
  if (!expected || !registry || sourceBody !== expected.body || sha(expected.source) !== expected.sha256
      || registry.id !== expected.id || registry.path !== expected.path || registry.content !== expected.body) fail('SKILL_UNSAFE_OR_UNAVAILABLE');
  if (!session || !requestedParent || session.id !== requestedSession || session.parentID !== requestedParent || session.agent !== 'code-simplifier') fail('SKILL_NOT_LOADED_CHILD');
  if (!Array.isArray(messages)) fail('SKILL_NOT_LOADED');
  const loaded = messages.filter((message) => message.type === 'skill' && message.skill === expected.id && message.text === expected.body);
  if (loaded.length !== 1 || !loaded[0].id || !Number.isFinite(loaded[0].time?.created)) fail('SKILL_NOT_LOADED');
  const mutating = messages.filter((message) => message.type === 'shell' || message.type === 'tool' && ['edit', 'write', 'apply_patch', 'shell', 'bash'].includes(message.tool));
  if (mutating.some((message) => !Number.isFinite(message.time?.created) || message.time.created <= loaded[0].time.created)) fail('SKILL_LOAD_ORDER');
  return { status: 'LOADED', skill_id: expected.id, loading_session_id: session.id, parent_session_id: requestedParent, load_message_id: loaded[0].id,
    loaded_before_observed_tools: true, body_sha256: sha(expected.body), effective_skill_sha256: sha(expected.source), effective_skill_path: expected.path,
    evidence_kind: 'CALLER_SUPPLIED_STRUCTURES', live_evidence: false,
    limitation: 'VERIFIER_CONSUMES_MESSAGES_SUPPLIED_BY_CALLER; ONLY RAW FETCHED SESSION EVENTS CAN PROVE A LIVE CHILD LOAD' };
}
const unique = (values) => [...new Set(values)].sort();
const PLAN_SCHEMA = 'v1.3';
const WORKFLOW_STAGES = ['baseline', 'apply-A', 'post-A', 'apply-B', 'post-B', 'final'];
const NODE_ARGS = () => ['--require', path.join(__dirname, 'refactor-clean-assertions.cjs'), '--test', '--test-reporter=tap', '--'];
const planDigest = (plan) => sha(stable(plan && typeof plan === 'object' && plan.schema === PLAN_SCHEMA ? normalizePlan(plan) : plan));
// One immutable plan contract shared by the runner, the supported apply channel and
// the pass evaluator. A digest alone is never proof of what was actually executed.
function normalizePlan(plan) {
  if (!plan || typeof plan !== 'object' || plan.schema !== PLAN_SCHEMA) fail('INVALID_VERIFICATION_PLAN');
  const root = checkedRoot(plan.root);
  if (!Array.isArray(plan.scope) || !Array.isArray(plan.guard) || !Array.isArray(plan.tests)) fail('INVALID_VERIFICATION_PLAN');
  const scope = unique(plan.scope.map(relative));
  const guard = unique(plan.guard.map(relative));
  const tests = unique(plan.tests.map(relative));
  if (!scope.length || !tests.length) fail('INVALID_VERIFICATION_PLAN');
  // Every selected test is immutable verification input: exact guard membership,
  // never an editable path (test-as-scope is no longer a valid workflow plan).
  for (const test of tests) {
    if (!guard.includes(test)) fail('INVALID_VERIFICATION_PLAN');
    if (scope.some((s) => s === test || s.startsWith(test + '/') || test.startsWith(s + '/'))) fail('VERIFICATION_TEST_SCOPE_OVERLAP');
  }
  if (guard.some((g) => scope.some((s) => g === s || g.startsWith(s + '/') || s.startsWith(g + '/')))) fail('GUARD_SCOPE_OVERLAP');
  const adapter = plan.adapter;
  if (adapter !== 'node' && adapter !== 'php') fail('INVALID_VERIFICATION_PLAN');
  const timeout = plan.timeout;
  if (!Number.isSafeInteger(timeout) || timeout < 1) fail('INVALID_VERIFICATION_PLAN');
  const profile = plan.profile;
  if (adapter === 'node') {
    if (profile !== 'cooperative-js') fail('INVALID_VERIFICATION_PLAN');
    if (plan.executable !== process.execPath) fail('VERIFICATION_PLAN_MISMATCH');
    const args = NODE_ARGS();
    if (!Array.isArray(plan.args) || plan.args.length !== args.length || plan.args.some((a, i) => a !== args[i])) fail('VERIFICATION_PLAN_MISMATCH');
  } else if (profile !== 'php-deferred') fail('INVALID_VERIFICATION_PLAN');
  if (plan.cwd !== root) fail('VERIFICATION_PLAN_MISMATCH');
  return { schema: PLAN_SCHEMA, root, scope, guard, tests, adapter, executable: plan.executable,
    args: adapter === 'node' ? NODE_ARGS() : [], cwd: root, profile, timeout, capture_policy_version: '1.2' };
}
// Fill the invariant fields from one explicit request. Run/stage/fingerprint are
// deliberately absent: they are per-execution bindings, not plan fields.
function makePlan({ root, scope, guard = [], tests, adapter = 'node', timeout = 60000 }) {
  const canonical = checkedRoot(root);
  if (!Array.isArray(scope) || !scope.length || !Array.isArray(tests) || !tests.length) fail('INVALID_VERIFICATION_PLAN');
  const selected = unique(scope.map(relative));
  const selectedTests = unique(tests.map(relative));
  // Tests are always guards; if that overlaps edit scope, normalizePlan rejects it.
  const guards = unique([...guard.map(relative), ...selectedTests]);
  return normalizePlan({ schema: PLAN_SCHEMA, root: canonical, scope: selected, guard: guards, tests: selectedTests,
    adapter, executable: adapter === 'node' ? process.execPath : '',
    args: adapter === 'node' ? NODE_ARGS() : [], cwd: canonical,
    profile: adapter === 'node' ? 'cooperative-js' : 'php-deferred', timeout });
}
// Full byte identity of every immutable guard. A plan that cannot produce a digest
// for a guard is invalid; metadata-only accounting is never verification evidence.
function guardDigests(snapshot, guard) {
  if (!snapshot || !Array.isArray(snapshot.inventory) || !Array.isArray(guard)) fail('INVALID_SNAPSHOT');
  return unique(guard).map((file) => {
    const row = snapshot.inventory.find((item) => item.path === file);
    if (!row || row.type !== 'file' || row.content !== true || typeof row.sha256 !== 'string') fail('INVALID_GUARD');
    return { path: file, sha256: row.sha256 };
  });
}
function overlapsGuard(file, guard) {
  return guard.some((g) => file === g || file.startsWith(g + '/') || g.startsWith(file + '/'));
}
function planMismatch(plan, fields, observed) {
  if (plan.root !== fields.root) return 'VERIFICATION_PLAN_MISMATCH';
  if (stable(plan.scope) !== stable(fields.scope) || stable(plan.guard) !== stable(fields.guard)
      || stable(plan.tests) !== stable(fields.tests)) return 'VERIFICATION_PLAN_MISMATCH';
  if (plan.adapter !== observed.adapter || plan.cwd !== observed.cwd) return 'VERIFICATION_PLAN_MISMATCH';
  if (observed.adapter === 'node' && (plan.executable !== observed.executable
      || stable(plan.args) !== stable(observed.args))) return 'VERIFICATION_PLAN_MISMATCH';
  if (observed.timeout !== undefined && observed.timeout !== plan.timeout) return 'VERIFICATION_PLAN_MISMATCH';
  return null;
}
function runNodeTests({ root, tests, scope = [], guard = [], expectedFingerprint, plan, stage, run_id, timeout = 60000 }) {
  const started = new Date().toISOString(); const begin = Date.now();
  let scratch;
  const evidence = (over) => ({ started_at: started, ended_at: new Date().toISOString(), elapsed_ms: Date.now() - begin, ...over });
  try {
    const canonical = checkedRoot(root);
    if (!Array.isArray(tests) || !tests.length) fail('NO_BASELINE');
    for (const test of tests) {
      if (!/\.(?:[cm]?js|ts)$/.test(relative(test))) fail('UNSUPPORTED_TEST_FILE');
      if (!fs.lstatSync(checkedPath(canonical, test)).isFile()) fail('NO_BASELINE');
    }
    // With an explicit edit scope, test files are read-only guards; folding them
    // into scope would make the mandatory test guard overlap. Without one, keep
    // the legacy tests-as-scope capture so standalone baselines still work.
    const editScope = unique(scope);
    const fields = editScope.length
      ? { root: canonical, scope: editScope, guard: unique([...tests.map(relative), ...guard]), tests: unique(tests) }
      : { root: canonical, scope: unique(tests), guard: unique(guard), tests: unique(tests) };
    // A v1.3 plan is authoritative: validate the actual request against it before
    // spawn, and execute only its canonical roster. Legacy plans are diagnostics.
    const strict = plan && plan.schema === PLAN_SCHEMA ? normalizePlan(plan) : null;
    const mismatch = strict && planMismatch(strict, fields, {
      adapter: 'node', cwd: canonical, executable: process.execPath, args: NODE_ARGS(), timeout,
    });
    const digest = strict ? planDigest(strict) : plan ? planDigest(plan) : planDigest(fields);
    const guardList = strict ? strict.guard : fields.guard;
    const testPlan = { scope: strict ? strict.scope : fields.scope, guard: strict ? strict.guard : fields.guard,
      tests: strict ? strict.tests : fields.tests,
      runner: { adapter: 'node', executable: process.execPath, args: NODE_ARGS(), cwd: canonical } };
    const common = { plan_digest: digest, test_plan: testPlan, plan_schema: strict ? PLAN_SCHEMA : null,
      diagnostic: !strict, roster_executed: null, capture_policy_version: '1.2',
      snapshot_fingerprint: null, after_fingerprint: null, guard_digests: null, after_guard_digests: null,
      stage: stage || null, run_id: run_id || null };
    if (strict && strict.adapter !== 'node')
      return evidence({ status: 'NOT_SUPPORTED', reason: 'PHP_ISOLATION_NOT_VERIFIED', assertions: 0, spawned: false, ...common });
    if (mismatch) return evidence({ status: 'VERIFICATION_PLAN_MISMATCH', reason: mismatch, assertions: 0, spawned: false, ...common });
    const executableTests = strict ? strict.tests : fields.tests;
    const snapshot = capture(fields);
    common.snapshot_fingerprint = snapshot.fingerprint;
    common.guard_digests = guardDigests(snapshot, guardList);
    if (expectedFingerprint && expectedFingerprint !== snapshot.fingerprint)
      return evidence({ status: 'STALE_SCOPE', reason: 'BASELINE_FINGERPRINT_MISMATCH', assertions: 0, spawned: false, ...common });
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'rc11-assertions-'));
    fs.chmodSync(scratch, 0o700);
    const preload = path.join(__dirname, 'refactor-clean-assertions.cjs');
    const command = [process.execPath, ...NODE_ARGS(), ...executableTests.map((test) => checkedPath(canonical, test))];
    const output = spawnSync(command[0], command.slice(1), { cwd: canonical, encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024,
      env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, LANG: 'C.UTF-8', RC11_ASSERTION_DIR: scratch } });
    const stdout = output.stdout || ''; const stderr = output.stderr || '';
    const assertionRecords = fs.readdirSync(scratch).map((file) => JSON.parse(readRegular(path.join(scratch, file)).data));
    const assertions = assertionRecords.reduce((sum, record) => sum + (Number.isSafeInteger(record.assertions) && record.assertions >= 0 ? record.assertions : 0), 0);
    const result = parseTestEvidence({ stdout, exitCode: output.status, assertions, error: output.error?.message });
    const current = capture(fields);
    if (compare(snapshot, current).status !== 'MATCH') result.status = 'STALE_SCOPE';
    common.after_fingerprint = current.fingerprint;
    common.after_guard_digests = guardDigests(current, guardList);
    return evidence({ ...result, evidence_kind: 'EXECUTED_TEST_RUN', command, cwd: canonical, exit_code: output.status,
      stdout, stderr, assertion_records: assertionRecords, assertion_channel: 'PRIVATE_PRELOAD_FILES_NOT_STDIO',
      runner_sha256: sha(readRegular(preload).data), stdout_sha256: sha(stdout), stderr_sha256: sha(stderr),
      spawned: true, ...common, roster_executed: executableTests, plan_digest: digest });
  } catch (error) {
    return evidence({ status: 'NO_BASELINE', reason: error.message, assertions: 0, spawned: false });
  } finally { if (scratch) fs.rmSync(scratch, { recursive: true }); }
}
// PHP/Laravel adapter: verified PHP executable, conservative config/DB preflight,
// helper-owned JUnit report. It never installs dependencies or edits configuration.
const APPROVED_PHP = ['/opt/homebrew/bin/php', '/usr/local/bin/php', '/usr/bin/php'];
function resolvePhp(requested) {
  const approvedReal = APPROVED_PHP.map((path) => { try { return fs.realpathSync(path); } catch (_) { return null; } }).filter(Boolean);
  for (const candidate of requested ? [requested, ...APPROVED_PHP] : APPROVED_PHP) {
    try {
      const stat = fs.lstatSync(candidate);
      const real = fs.realpathSync(candidate);
      // Homebrew's /opt/homebrew/bin/php is a symlink into Cellar; that is fine,
      // but the resolved executable must be one of the approved PHP paths.
      if (!stat.isFile() && !stat.isSymbolicLink()) continue;
      if (!approvedReal.includes(real)) continue;
      const target = fs.statSync(real);
      if (!target.isFile() || !(target.mode & 0o111)) continue;
      const version = ((spawnSync(candidate, ['-v'], { encoding: 'utf8', timeout: 5000 }).stdout || '').split('\n')[0] || '');
      if (!/^PHP \d+\.\d+/.test(version)) continue;
      return { path: candidate, realpath: real, version, sha256: sha(fs.readFileSync(real)) };
    } catch (_) { /* try the next approved PHP path */ }
  }
  return null;
}
function approvedPhpRunner(root, requested) {
  if (typeof requested !== 'string') return null;
  const rel = requested.replace(/^\.\//, '');
  if (!['vendor/bin/pest', 'vendor/bin/phpunit'].includes(rel)) return null;
  try {
    const base = fs.realpathSync(root);
    const vendor = fs.realpathSync(path.join(base, 'vendor'));
    const real = fs.realpathSync(path.join(base, rel));
    if (!real.startsWith(vendor + path.sep)) return null;
    const stat = fs.lstatSync(real);
    if (!stat.isFile() || !(stat.mode & 0o111)) return null;
    return { path: real, relative: rel };
  } catch (_) { return null; }
}
// Conservative blocklist of effective configuration: this is not a PHP evaluator.
// Any ambiguity or conflicting known connection blocks the run before spawn.
function xmlAttributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([A-Za-z_:][-\w:.]*)\s*=\s*(["'])(.*?)\2/g)) result[match[1]] = match[3];
  return result;
}
function preflightPhpConfig(root, dbTarget) {
  try { if (fs.lstatSync(path.join(root, 'bootstrap/cache/config.php')).isFile()) return { ok: false, reason: 'CONFIG_CACHE_PRESENT' }; }
  catch (_) { /* no cached config */ }
  for (const name of ['.env.testing', 'phpunit.xml', 'phpunit.xml.dist']) {
    let text;
    try { const file = path.join(root, name); if (!fs.lstatSync(file).isFile()) continue; text = fs.readFileSync(file, 'utf8'); }
    catch (_) { continue; }
    if (text.length > 1024 * 1024) return { ok: false, reason: 'CONFIG_TOO_LARGE' };
    if (/<!DOCTYPE|<!ENTITY|SYSTEM\s+["']/.test(text)) return { ok: false, reason: 'CONFIG_AMBIGUOUS' };
    const seen = new Map();
    // XML tags may span lines; scan the whole document, not individual lines.
    for (const tag of text.matchAll(/<(?:env|server|php)\b([\s\S]*?)\/?>/gi)) {
      const a = xmlAttributes(tag[1]);
      const key = a.name;
      if (key && /^(APP_ENV|DB_CONNECTION|DB_DATABASE|DB_URL|DB_HOST|DB_PORT)$/.test(key)) {
        if (seen.has(key) && seen.get(key) !== a.value) return { ok: false, reason: 'CONFIG_AMBIGUOUS' };
        seen.set(key, a.value);
      }
    }
    for (const line of text.split(/\r?\n/)) {
      const dotenv = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (dotenv && /^(APP_ENV|DB_CONNECTION|DB_DATABASE|DB_URL|DB_HOST|DB_PORT)$/.test(dotenv[1])) {
        const value = dotenv[2].trim().replace(/^["']|["']$/g, '');
        if (seen.has(dotenv[1]) && seen.get(dotenv[1]) !== value) return { ok: false, reason: 'CONFIG_AMBIGUOUS' };
        seen.set(dotenv[1], value);
      }
    }
    for (const [key, value] of seen) {
      if (/[$<{]/.test(value)) return { ok: false, reason: 'CONFIG_AMBIGUOUS' };
      if (key === 'APP_ENV' && value !== 'testing') return { ok: false, reason: 'DB_CONFIG_CONFLICT' };
      if (key === 'DB_CONNECTION' && value !== 'sqlite') return { ok: false, reason: 'DB_CONFIG_CONFLICT' };
      if (key === 'DB_DATABASE' && value !== ':memory:'
          && (!path.isAbsolute(value) || value !== dbTarget)) return { ok: false, reason: 'DB_CONFIG_CONFLICT' };
      if (['DB_URL', 'DB_HOST', 'DB_PORT'].includes(key)) return { ok: false, reason: 'DB_CONFIG_CONFLICT' };
    }
  }
  return { ok: true };
}
function preparePhpDb(root, env, dbDir) {
  if (env.APP_ENV !== 'testing' || env.DB_CONNECTION !== 'sqlite') return { ok: false, reason: 'TEST_DB_NOT_VERIFIED_ISOLATED' };
  if (env.DB_DATABASE === ':memory:') return { ok: true, mode: 'MEMORY', target: ':memory:' };
  // A caller-chosen path is never trusted, even when its name says rc111-test.
  if (env.DB_DATABASE != null) return { ok: false, reason: 'TEST_DB_NOT_VERIFIED_ISOLATED' };
  if (typeof dbDir !== 'string' || !path.isAbsolute(dbDir)) return { ok: false, reason: 'TEST_DB_NOT_VERIFIED_ISOLATED' };
  try {
    const dir = checkedRoot(dbDir);
    if (dir === root || dir.startsWith(root + path.sep) || (fs.statSync(dir).mode & 0o077)) return { ok: false, reason: 'TEST_DB_NOT_VERIFIED_ISOLATED' };
    const name = `rc111-test-${crypto.randomUUID()}.sqlite`;
    const file = path.join(dir, name);
    const fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    fs.closeSync(fd);
    return { ok: true, mode: 'FILE', target: file, created: true };
  } catch (_) { return { ok: false, reason: 'TEST_DB_NOT_VERIFIED_ISOLATED' }; }
}
function parseJUnit(xml) {
  if (typeof xml !== 'string' || !xml.length || xml.length > 2 * 1024 * 1024) return null;
  if (/<!DOCTYPE|<!ENTITY|<\?xml[^>]*SYSTEM|&\w+;/.test(xml)) return null;
  for (const tag of xml.match(/<[^>]+>/g) || []) {
    const names = [...tag.matchAll(/([A-Za-z_:][-\w:.]*)\s*=/g)].map((m) => m[1]);
    if (new Set(names).size !== names.length) return null; // duplicate/conflicting attributes
  }
  const ordered = [...xml.matchAll(/<\/?(testsuites|testsuite|testcase)\b[^>]*>/g)];
  const stack = [];
  for (const tag of ordered) {
    const closing = tag[0].startsWith('</'); const name = tag[1];
    if (tag[0].trim().endsWith('/>')) continue; // self-closing suite is balanced by itself
    if (closing ? stack.pop() !== name : stack.push(name) > 32) return null;
  }
  if (stack.length) return null;
  const root = xml.match(/<testsuites\b([^>]*)>/);
  const suites = [...xml.matchAll(/<testsuite\b([^>]*?)(?:\/>|>)/g)];
  const cases = [...xml.matchAll(/<testcase\b[^>]*>/g)];
  const failureNodes = [...xml.matchAll(/<failure\b/g)].length;
  const errorNodes = [...xml.matchAll(/<error\b/g)].length;
  const skippedNodes = [...xml.matchAll(/<skipped\b/g)].length;
  if (!root && !suites.length && !cases.length) return null;
  const int = (attrs, key) => {
    if (!(key in attrs)) return null;
    const value = attrs[key];
    if (!/^\d+$/.test(value)) return null;
    const number = Number(value);
    return Number.isSafeInteger(number) ? number : null;
  };
  const sum = (key) => suites.reduce((total, item) => {
    const value = int(xmlAttributes(item[1]), key);
    return value === null ? total : total + value;
  }, 0);
  const counts = {
    tests: suites.length ? sum('tests') : (root ? int(xmlAttributes(root[1]), 'tests') : null),
    failures: suites.length ? sum('failures') : (root ? int(xmlAttributes(root[1]), 'failures') : null),
    errors: suites.length ? sum('errors') : (root ? int(xmlAttributes(root[1]), 'errors') : null),
    skipped: suites.length ? sum('skipped') : (root ? int(xmlAttributes(root[1]), 'skipped') : null),
    assertions: suites.length ? sum('assertions') : (root ? int(xmlAttributes(root[1]), 'assertions') : null),
  };
  if (counts.tests === null || counts.failures === null || counts.errors === null) return null;
  if (cases.length && counts.tests !== cases.length) return null;
  if (failureNodes && counts.failures !== failureNodes) return null;
  if (errorNodes && counts.errors !== errorNodes) return null;
  if (skippedNodes && counts.skipped !== skippedNodes) return null;
  if (root) {
    const aggregate = xmlAttributes(root[1]);
    for (const key of Object.keys(counts)) {
      const value = int(aggregate, key);
      if (value !== null && value !== counts[key]) return null; // contradictory aggregate
    }
  }
  counts.skipped = counts.skipped ?? 0;
  counts.assertions = counts.assertions ?? 0;
  if (!Object.values(counts).every((value) => Number.isSafeInteger(value) && value >= 0)) return null;
  if (counts.tests < 1 || counts.failures + counts.errors + counts.skipped > counts.tests) return null;
  return counts;
}
function runPhpTests({ root, tests, runner, env = {}, dbDir, scope = [], guard = [], expectedFingerprint, plan, stage, run_id, timeout = 60000 }) {
  const started = new Date().toISOString(); const begin = Date.now();
  const evidence = (over) => ({ started_at: started, ended_at: new Date().toISOString(), elapsed_ms: Date.now() - begin, ...over });
  const base = (over = {}) => ({ status: 'NO_BASELINE', assertions: 0, spawned: false, stage: stage || null, run_id: run_id || null, ...over });
  // V1.1.3 default disposition: no independently proven isolated PHP profile exists.
  // Fail closed before any config evaluation, DB creation, application boot or spawn.
  return evidence(base({ status: 'NOT_SUPPORTED', reason: 'PHP_ISOLATION_NOT_VERIFIED',
    evidence_kind: 'PHP_PROFILE_DISPOSITION', adapter: 'php', diagnostic: true }));
}
// A helper can evaluate already executed structured results; it cannot authenticate
// arbitrary caller input. Only plan-bound, non-diagnostic runner evidence qualifies.
function executedEvidence(postTests, applied, plan, stage, run_id) {
  let expected;
  try { expected = normalizePlan(plan); } catch (_) { return false; }
  if (!postTests || postTests.evidence_kind !== 'EXECUTED_TEST_RUN' || postTests.status !== 'GREEN') return false;
  if (postTests.diagnostic || postTests.plan_schema !== PLAN_SCHEMA || postTests.spawned !== true) return false;
  if (!postTests.counts || !(postTests.counts.tests > 0) || postTests.counts.pass !== postTests.counts.tests
      || !(postTests.assertions > 0) || postTests.exit_code !== 0) return false;
  if (postTests.plan_digest !== planDigest(expected)) return false;
  if (!stage || !WORKFLOW_STAGES.includes(stage) || !run_id || postTests.stage !== stage || postTests.run_id !== run_id) return false;
  if (!postTests.test_plan || stable(postTests.test_plan.tests) !== stable(expected.tests)) return false;
  if (!Array.isArray(postTests.roster_executed) || stable(postTests.roster_executed) !== stable(expected.tests)) return false;
  if (!applied?.snapshot?.fingerprint || applied.plan_digest !== planDigest(expected) || applied.run_id !== run_id) return false;
  // Immutable guard bytes and exact executed counts must persist through the whole run.
  if (Array.isArray(applied.guard_digests)
      && (!Array.isArray(postTests.guard_digests) || stable(postTests.guard_digests) !== stable(applied.guard_digests)
          || !Array.isArray(postTests.after_guard_digests) || stable(postTests.after_guard_digests) !== stable(applied.guard_digests))) return false;
  if (applied.expected_counts && postTests.counts.tests !== applied.expected_counts.tests) return false;
  if (applied.expected_assertions && postTests.assertions !== applied.expected_assertions) return false;
  return postTests.snapshot_fingerprint === applied.snapshot.fingerprint
    && postTests.after_fingerprint === applied.snapshot.fingerprint;
}
function evaluatePass({ applied, postTests, plan, stage, run_id }) {
  if (applied?.status === 'PARTIAL_CONFLICT') return { status: 'PARTIAL_CONFLICT', edits: applied.edits?.length || 0, recovery: applied.recovery };
  if (!applied || applied.status !== 'APPLIED') return { status: 'ANALYSIS_ONLY', reason: 'NO_APPLIED_EDIT' };
  const edits = applied.edits.length;
  if (postTests?.status === 'BASELINE_NOT_GREEN' || postTests?.status === 'STALE_SCOPE')
    return { status: 'REGRESSION_DETECTED', edits, recovery: applied.recovery };
  let expected;
  try { expected = normalizePlan(plan); } catch (error) {
    return { status: 'APPLIED_PENDING_TESTS', edits, recovery: applied.recovery, reason: error.message };
  }
  const applyStage = stage === 'post-A' ? 'apply-A' : stage === 'post-B' ? 'apply-B' : null;
  if (!applyStage || applied.stage !== applyStage || applied.run_id !== run_id
      || applied.plan_digest !== planDigest(expected))
    return { status: 'APPLIED_PENDING_TESTS', edits, recovery: applied.recovery, reason: 'LIFECYCLE_MISMATCH' };
  if (!executedEvidence(postTests, applied, plan, stage, run_id))
    return { status: 'APPLIED_PENDING_TESTS', edits, recovery: applied.recovery, reason: 'NO_MATCHING_EXECUTED_TEST_EVIDENCE' };
  return { status: 'PASS_COMPLETE', completion_kind: 'EDITED', edits, run_id: postTests.run_id, stage: postTests.stage,
    pass: applyStage === 'apply-A' ? 'A' : 'B', snapshot_fingerprint: postTests.after_fingerprint,
    plan_digest: postTests.plan_digest, guard_digests: postTests.guard_digests,
    counts: { tests: postTests.counts.tests, assertions: postTests.assertions },
    child_session_id: applied.preconditions?.child_session_id || null };
}
// A genuine zero-candidate pass is a first-class completed disposition. It must
// never manufacture an apply record or reuse a baseline/post result as a test run.
function evaluateNoOp({ receipt, baseline, postTests, plan, stage, run_id, expectedSnapshot, priorPass }) {
  const deny = (reason) => ({ status: 'ANALYSIS_ONLY', reason });
  const passId = stage === 'post-A' ? 'A' : stage === 'post-B' ? 'B' : null;
  if (!passId || !run_id) return deny('INVALID_STAGE');
  if (!receipt || receipt.status !== 'NO_CANDIDATES' || receipt.analysis_complete !== true
      || receipt.edits !== 0 || !Array.isArray(receipt.changed_paths) || receipt.changed_paths.length
      || (Array.isArray(receipt.hunks) && receipt.hunks.length)
      || (Array.isArray(receipt.requested_hunks) && receipt.requested_hunks.length)
      || (Array.isArray(receipt.candidates) && receipt.candidates.some((c) => c.decision === 'EDIT' || (Array.isArray(c.hunks) && c.hunks.length))))
    return deny('NO_OP_RECEIPT_INCOMPLETE');
  let expected;
  try { expected = normalizePlan(plan); } catch (error) { return deny(error.message); }
  const requiredSkill = passId === 'B' ? 'ecc-remove-ai-slops-safe' : 'ecc-remove-deadcode-safe';
  const planHash = planDigest(expected);
  if (receipt.pass !== passId || receipt.stage !== stage || receipt.run_id !== run_id
      || receipt.skill_id !== requiredSkill || !receipt.child_session_id
      || (receipt.plan_digest !== undefined && receipt.plan_digest !== planDigest(expected))) return deny('NO_OP_ASSIGNMENT_MISMATCH');
  if (passId === 'B') {
    if (!priorPass || priorPass.status !== 'PASS_COMPLETE' || priorPass.stage !== 'post-A'
        || priorPass.run_id !== run_id || priorPass.plan_digest !== planHash || priorPass.pass !== 'A'
        || !['EDITED', 'NO_CANDIDATES'].includes(priorPass.completion_kind)
        || !priorPass.child_session_id || priorPass.child_session_id === receipt.child_session_id
        || priorPass.snapshot_fingerprint !== expectedSnapshot?.fingerprint) return deny('PRIOR_PASS_NOT_VERIFIED');
  }
  const expectedBaselineStage = passId === 'A' ? 'baseline' : 'post-A';
  if (!baseline || baseline.evidence_kind !== 'EXECUTED_TEST_RUN' || baseline.status !== 'GREEN'
      || baseline.diagnostic || baseline.plan_digest !== planHash || baseline.stage !== expectedBaselineStage
      || baseline.run_id !== run_id || !baseline.counts || !(baseline.counts.tests > 0) || !(baseline.assertions > 0)
      || !Array.isArray(baseline.guard_digests)) return deny('BASELINE_NOT_GREEN');
  const evidence = { status: 'GREEN', evidence_kind: 'EXECUTED_TEST_RUN', diagnostic: false,
    plan_schema: PLAN_SCHEMA, spawned: true, exit_code: 0, plan_digest: planHash, stage, run_id };
  if (!executedEvidence({ ...evidence, ...postTests }, { snapshot: expectedSnapshot, plan_digest: planHash, run_id,
    guard_digests: baseline.guard_digests, expected_counts: baseline.counts, expected_assertions: baseline.assertions }, plan, stage, run_id))
    return deny('NO_MATCHING_EXECUTED_TEST_EVIDENCE');
  const post = postTests;
  if (!post || !Array.isArray(post.guard_digests) || stable(post.guard_digests) !== stable(baseline.guard_digests)
      || !Array.isArray(post.after_guard_digests) || stable(post.after_guard_digests) !== stable(baseline.guard_digests)
      || post.counts.tests !== baseline.counts.tests || post.assertions !== baseline.assertions) return deny('NO_OP_EVIDENCE_MISMATCH');
  if (!expectedSnapshot || receipt.snapshot_fingerprint !== expectedSnapshot.fingerprint
      || baseline.after_fingerprint !== expectedSnapshot.fingerprint
      || post.snapshot_fingerprint !== expectedSnapshot.fingerprint
      || post.after_fingerprint !== expectedSnapshot.fingerprint) return deny('NO_OP_SNAPSHOT_DRIFT');
  return { status: 'PASS_COMPLETE', completion_kind: 'NO_CANDIDATES', edits: 0, pass: passId, stage, run_id,
    plan_digest: planHash, snapshot_fingerprint: expectedSnapshot.fingerprint, child_session_id: receipt.child_session_id,
    skill_id: requiredSkill, guard_digests: baseline.guard_digests,
    counts: { tests: post.counts.tests, assertions: post.assertions } };
}
// File-based invocation of the guarded module for a real assigned child.
// The plan, run identity, stage lineage, executed baseline and skill assignment
// are all validated here; raw preimages never leave the helper.
function applyModule(request) {
  if (!request || typeof request !== 'object') fail('INVALID_REQUEST');
  const { snapshot, baseline, skillEvidence, plan, expectedSkill, pass, scope, guard, hunks, authorizedPaths } = request;
  const planContract = normalizePlan(plan);
  if (planContract.adapter === 'php') fail('PHP_ISOLATION_NOT_VERIFIED');
  const run_id = request.run_id; const stage = request.stage;
  if (!run_id || !['apply-A', 'apply-B'].includes(stage)) fail('INVALID_STAGE');
  const passId = stage === 'apply-A' ? 'A' : 'B';
  if (pass && pass !== passId) fail('STAGE_PASS_MISMATCH');
  const requiredSkill = passId === 'B' ? 'ecc-remove-ai-slops-safe' : 'ecc-remove-deadcode-safe';
  if (expectedSkill && expectedSkill !== requiredSkill) fail('SKILL_NOT_LOADED');
  if (!skillEvidence || skillEvidence.status !== 'LOADED' || skillEvidence.live_evidence !== false
      || skillEvidence.skill_id !== requiredSkill
      || (skillEvidence.pass && skillEvidence.pass !== passId)) fail('SKILL_NOT_LOADED');
  const expectedBaselineStage = passId === 'A' ? 'baseline' : 'post-A';
  const planHash = planDigest(planContract);
  const expectedGuards = guardDigests(snapshot, planContract.guard);
  if (!baseline || baseline.evidence_kind !== 'EXECUTED_TEST_RUN' || baseline.status !== 'GREEN'
      || baseline.diagnostic || !baseline.counts || !(baseline.counts.tests > 0) || !(baseline.assertions > 0)
      || baseline.exit_code !== 0 || baseline.spawned !== true || baseline.plan_digest !== planHash
      || baseline.run_id !== run_id || baseline.stage !== expectedBaselineStage
      || !baseline.test_plan || stable(baseline.test_plan.tests) !== stable(planContract.tests)
      || !Array.isArray(baseline.roster_executed) || stable(baseline.roster_executed) !== stable(planContract.tests)
      || !Array.isArray(baseline.guard_digests) || stable(baseline.guard_digests) !== stable(expectedGuards)
      || !snapshot || baseline.snapshot_fingerprint !== snapshot.fingerprint
      || baseline.after_fingerprint !== snapshot.fingerprint) fail('BASELINE_NOT_GREEN');
  if (passId === 'B') {
    const prior = request.priorPass;
    if (!prior || prior.status !== 'PASS_COMPLETE' || prior.stage !== 'post-A' || prior.run_id !== run_id
        || prior.plan_digest !== planHash || prior.pass !== 'A' || !prior.child_session_id
        || !['EDITED', 'NO_CANDIDATES'].includes(prior.completion_kind)
        || !Array.isArray(prior.guard_digests) || stable(prior.guard_digests) !== stable(expectedGuards)
        || prior.snapshot_fingerprint !== snapshot.fingerprint) fail('PRIOR_PASS_NOT_VERIFIED');
  }
  if (!Array.isArray(scope) || !scope.length || !Array.isArray(hunks) || !hunks.length
      || !Array.isArray(authorizedPaths) || !authorizedPaths.length) fail('INVALID_SCOPE');
  if (stable(scope.map(relative)) !== stable(planContract.scope)) fail('VERIFICATION_PLAN_MISMATCH');
  if (guard !== undefined && stable(guard.map(relative)) !== stable(planContract.guard)) fail('VERIFICATION_PLAN_MISMATCH');
  if (!snapshot || stable(snapshot.scope) !== stable(planContract.scope)
      || stable(snapshot.guard) !== stable(planContract.guard)) fail('VERIFICATION_PLAN_MISMATCH');
  if (authorizedPaths.some((file) => !snapshot.scope.includes(file) || overlapsGuard(file, planContract.guard))) fail('GUARD_EDIT_DENIED');
  if (hunks.some((hunk) => overlapsGuard(relative(hunk.path), planContract.guard))) fail('GUARD_EDIT_DENIED');
  const applied = applyHunks({ root: request.root, snapshot, hunks, authorizedPaths, scratch: request.scratch });
  return { ...applied, mode: 'MODULE_INVOCATION', stage, pass: passId, run_id, plan_digest: planHash,
    completion_kind: 'EDITED', before_fingerprint: snapshot.fingerprint, after_fingerprint: applied.snapshot.fingerprint,
    guard_digests: expectedGuards, after_guard_digests: guardDigests(applied.snapshot, planContract.guard),
    expected_counts: baseline.counts, expected_assertions: baseline.assertions,
    prior_stage: passId === 'B' ? 'post-A' : 'baseline',
    edits: applied.edits.map(({ path, before_sha256, after_sha256 }) => ({ path, before_sha256, after_sha256 })),
    preconditions: { pass: passId, stage, skill_id: skillEvidence.skill_id,
      child_session_id: skillEvidence.loading_session_id, baseline_fingerprint: baseline.snapshot_fingerprint,
      plan_digest: planHash, run_id, stage_lineage: passId === 'B' ? ['baseline', 'post-A', 'apply-B'] : ['baseline', 'apply-A'] },
    authorization: 'OWNER_SCOPE_ONLY' };
}
module.exports = { capture, compare, applyHunks, decideCandidate, parseTestEvidence, verifyLoadedSkill,
  runNodeTests, runPhpTests, evaluatePass, evaluateNoOp, planDigest, makePlan, normalizePlan, parseJUnit, resolvePhp,
  preparePhpDb, preflightPhpConfig, applyModule };

if (require.main === module) {
  try {
    const [operation, requestPath] = process.argv.slice(2);
    if (!['capture', 'compare', 'candidate', 'tests', 'apply', 'apply-module'].includes(operation) || !requestPath)
      fail('USAGE: evidence.cjs capture|compare|candidate|tests|apply|apply-module request.json');
    const request = JSON.parse(readRegular(path.resolve(requestPath)).data);
    if (operation === 'apply') {
      // Deliberately blocked: use apply-module, which enforces the same baseline,
      // skill, plan and snapshot preconditions through the guarded module.
      const blocked = new Error('BLOCKED_NATIVE_CHILD_AND_BASELINE_PROOF_REQUIRED');
      blocked.supported_channel = 'MODULE_APPLY';
      blocked.supported_operation = 'apply-module';
      throw blocked;
    }
    const result = operation === 'apply-module' ? applyModule(request)
      : operation === 'capture' ? capture(request)
      : operation === 'compare' ? compare(request.before, request.after)
      : operation === 'candidate' ? decideCandidate(request)
      : operation === 'tests'
        ? (request.plan?.adapter === 'php' || request.runner || (Array.isArray(request.tests) && request.tests.some((t) => /\.php$/i.test(t)))
            ? runPhpTests(request) : runNodeTests(request))
        : null;
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (['STALE_SCOPE', 'NO_BASELINE', 'BASELINE_NOT_GREEN'].includes(result.status)) process.exitCode = 1;
    else if (['NOT_VERIFIED', 'NOT_SUPPORTED', 'BLOCKED'].includes(result.status)) process.exitCode = 2;
  } catch (error) {
    const body = { status: 'BLOCKED', reason: error.message };
    if (error.supported_channel) body.supported_channel = error.supported_channel;
    if (error.supported_operation) body.supported_operation = error.supported_operation;
    // A partial write must never be reported as a clean BLOCKED with no applied paths.
    if (Array.isArray(error.edits)) body.edits = error.edits.map(({ path, before_sha256, after_sha256 }) => ({ path, before_sha256, after_sha256 }));
    if (error.recovery) body.recovery = error.recovery;
    process.stderr.write(JSON.stringify(body) + '\n');
    process.exitCode = 1;
  }
}
