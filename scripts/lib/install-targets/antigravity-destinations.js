'use strict';

/**
 * Destination identity for the antigravity-cli projection.
 *
 * Extracted from the install-target adapter because these helpers are pure and
 * carry the relocation contract: a command entrypoint and a knowledge skill can
 * collide on one public skill name, and the knowledge skill (with all of its
 * companion files) must be relocated rather than dropped.
 */

function skillDestinationKey(operation) {
  const normalized = String(operation.destinationPath || '').replace(/\\/g, '/');
  const match = normalized.match(/^(.*\/skills\/[^/]+)(\/.*)?$/);
  if (!match) return null;
  const rest = match[2] || '';
  // A skill directory, its SKILL.md, and every companion file inside it belong
  // to the same skill. Support files must share the key so relocation moves the
  // whole tree; treating a filename as a skill name once produced
  // `opl-frontend-design-direction-check-evidence.js`.
  if (rest === '' || rest === '/SKILL.md' || rest.startsWith('/')) return match[1];
  return null;
}

/**
 * Canonical source skill root: the directory that owns a skill tree.
 *
 * `skills/<name>/SKILL.md`, `skills/<name>/scripts/x.js`, and
 * `skills/<name>/references/y.md` all belong to `skills/<name>`. Using the
 * immediate parent directory instead turned `scripts/` and `references/` into
 * bogus skill names (`opl-tdd-scripts`).
 */
function sourceSkillRoot(sourceRelativePath) {
  const segments = String(sourceRelativePath || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean);
  if (segments.length === 0) return 'workflow';
  const last = segments[segments.length - 1];
  // A file leaf is not a skill directory.
  if (/\.[a-z0-9]+$/i.test(last)) segments.pop();
  // skills/<name>/... -> <name>; agents/<name>/... -> <name>; bare -> last
  if (segments.length >= 2) return segments[1];
  return segments[0] || 'workflow';
}

function sourceSkillDir(op) {
  return sourceSkillRoot(op.sourceRelativePath);
}

/**
 * A command projection and a skill scaffold can resolve to the same skill
 * directory (e.g. .opencode/commands/tdd.md and skills/tdd-workflow both target
 * opl-tdd). The command is the PUBLIC invocable entrypoint (it arms workflow
 * state and delegates to the specialist agent); the skill is supporting
 * knowledge. Neither may be discarded.
 *
 * Rule: the command-derived entrypoint keeps the public name. A colliding
 * skill scaffold is relocated to a distinct directory derived from its own
 * source name, so the knowledge stays installed and reachable.
 */
function dedupeSkillDestinations(operations) {
  const isCommandEntrypoint = op => op.contentTransform === 'antigravity-command-to-skill';

  // Which operations actually collide? A collision only exists when two
  // DIFFERENT source skill roots project onto the same destination key.
  const byKey = new Map();
  for (const op of operations) {
    const key = skillDestinationKey(op);
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(op);
  }

  const collidingKeys = new Set();
  for (const [key, group] of byKey) {
    const roots = new Set(group.map(sourceSkillDir));
    const entrypoints = group.filter(isCommandEntrypoint);
    // A collision is either two different skill trees on one name, or more than
    // one command claiming the same public entrypoint. Last-wins is never
    // acceptable: the effective customized command must be chosen explicitly.
    if (roots.size > 1 || entrypoints.length > 1) collidingKeys.add(key);
  }

  // The customized ECC-OPL command lives under `.opencode/commands`; a legacy
  // top-level `commands/` copy of the same workflow is the weaker source.
  function entrypointRank(op) {
    const source = String(op.sourceRelativePath || '').replace(/\\/g, '/');
    if (source.startsWith('.opencode/commands/')) return 2;
    if (source.startsWith('commands/')) return 1;
    return 0;
  }

  // Decide the winner per colliding key: the strongest command entrypoint keeps
  // the public name; the colliding knowledge tree is relocated.
  const winners = new Map();
  for (const key of collidingKeys) {
    const group = byKey.get(key);
    const entrypoints = group.filter(isCommandEntrypoint);
    if (entrypoints.length > 0) {
      winners.set(key, entrypoints.slice().sort((a, b) => entrypointRank(b) - entrypointRank(a))[0]);
    } else {
      winners.set(key, group[0]);
    }
  }

  const publicKeys = new Set(byKey.keys());
  const kept = [];
  const seen = new Set();
  // One relocation decision per (key, source skill root) so every file of a
  // relocated tree lands in the SAME new directory.
  const relocations = new Map();

  function relocationFor(key, op) {
    const root = sourceSkillDir(op);
    const memoKey = `${key}\u0000${root}`;
    const cached = relocations.get(memoKey);
    if (cached) return cached;

    const keyBasename = key.split('/').pop();
    const publicBase = keyBasename.replace(/^opl-/, '');
    // When the knowledge skill already shares the workflow's base name, the
    // doubled `opl-x-x` reads as a bug. Name it `<base>-knowledge` instead.
    let relocatedBasename = root === publicBase
      ? `${keyBasename}-knowledge`
      : `${keyBasename}-${root}`;
    const prefix = key.slice(0, key.length - keyBasename.length);
    let suffix = 2;
    while (publicKeys.has(`${prefix}${relocatedBasename}`)) {
      relocatedBasename = `${keyBasename}-${root}-${suffix}`;
      suffix += 1;
    }
    const relocatedDir = `${prefix}${relocatedBasename}`;
    publicKeys.add(relocatedDir);
    relocations.set(memoKey, relocatedDir);
    return relocatedDir;
  }

  for (const op of operations) {
    const key = skillDestinationKey(op);
    if (!key) {
      if (!seen.has(op)) { seen.add(op); kept.push(op); }
      continue;
    }
    // Non-colliding skill: pass through byte-for-byte.
    if (!collidingKeys.has(key)) {
      if (!seen.has(op)) { seen.add(op); kept.push(op); }
      continue;
    }
    if (winners.get(key) === op) {
      if (!seen.has(op)) { seen.add(op); kept.push(op); }
      continue;
    }
    // A colliding loser is relocated, not dropped. A losing command entrypoint
    // is dropped instead: one public entrypoint per skill name.
    if (!isCommandEntrypoint(op)) {
      const relocatedDir = relocationFor(key, op);
      const normalized = String(op.destinationPath).replace(/\\/g, '/');
      const suffixPath = normalized.slice(key.length);
      const relocated = {
        ...op,
        destinationPath: `${relocatedDir}${suffixPath}`,
        skillName: relocatedDir.split('/').pop()
      };
      if (!seen.has(relocated)) { seen.add(relocated); kept.push(relocated); }
    }
  }

  return kept;
}

function isAgentOperation(op) {
  return op.contentTransform === 'antigravity-agent-frontmatter-cli'
    || op.contentTransform === 'antigravity-prompt-to-agent';
}

/**
 * `agents/<name>.md` and `.opencode/prompts/agents/<name>.txt` describe the same
 * canonical agent. Keep exactly one projection per agent directory; the rich
 * `agents/*.md` form wins and the prompt variant only fills gaps.
 */
function dedupeAgentDestinations(operations) {
  const byDest = new Map();
  const kept = [];
  for (const op of operations) {
    if (!isAgentOperation(op)) { kept.push(op); continue; }
    const key = String(op.destinationPath || '').replace(/\\/g, '/').toLowerCase();
    const prior = byDest.get(key);
    if (!prior) { byDest.set(key, op); kept.push(op); continue; }
    const rich = op.contentTransform === 'antigravity-agent-frontmatter-cli';
    const priorRich = prior.contentTransform === 'antigravity-agent-frontmatter-cli';
    if (rich && !priorRich) {
      const index = kept.indexOf(prior);
      if (index >= 0) kept[index] = op;
      byDest.set(key, op);
    }
  }
  return kept;
}

module.exports = {
  dedupeAgentDestinations,
  dedupeSkillDestinations,
  skillDestinationKey,
  sourceSkillDir,
  sourceSkillRoot
};
