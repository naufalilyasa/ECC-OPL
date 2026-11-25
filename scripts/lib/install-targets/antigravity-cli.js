'use strict';

const fs = require('fs');
const path = require('path');

const {
  createFlatRuleOperations,
  createInstallTargetAdapter,
  createManagedOperation,
  createManagedScaffoldOperation,
  normalizeRelativePath,
  listRelativeFiles,
} = require('./helpers');

const SUPPORTED_SOURCE_PREFIXES = ['rules', 'agents', 'skills', 'commands', '.opencode/commands', '.opencode/prompts/agents'];

function supportsAntigravityCliSourcePath(sourceRelativePath) {
  const normalizedPath = normalizeRelativePath(sourceRelativePath);
  if (normalizedPath.split('/').includes('..')) return false;
  return SUPPORTED_SOURCE_PREFIXES.some(prefix => (
    normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
  ));
}

function isRulePackMarkdown(sourceRelativePath) {
  const segments = normalizeRelativePath(sourceRelativePath).split('/');
  return segments[0] === 'rules'
    && segments.length >= 3
    && /\.md$/i.test(segments[segments.length - 1]);
}

function withAntigravityRuleTrigger(operation) {
  return isRulePackMarkdown(operation.sourceRelativePath)
    ? { ...operation, contentTransform: 'antigravity-rule-frontmatter' }
    : operation;
}

const COMMAND_TO_SKILL_REMAP = Object.freeze({
  'code-review.md': 'opl-code-review-quick',
  'refactor-clean.md': 'opl-refactor-clean',
  'update-docs.md': 'opl-docs-update',
  'typography.md': 'opl-typography',
});

// Single source of truth for canonical opl-* naming across commands, skills,
// and agents. Aliases cover the few names that differ from their source.
const SKILL_NAME_ALIASES = Object.freeze({
  'tdd-workflow': 'opl-tdd',
  'typography-system': 'opl-typography',
});

function oplName(baseName) {
  if (Object.hasOwn(SKILL_NAME_ALIASES, baseName)) return SKILL_NAME_ALIASES[baseName];
  return baseName.startsWith('opl-') ? baseName : `opl-${baseName}`;
}

function remapCommandToSkillName(commandRelativePath) {
  if (!commandRelativePath) return '';
  const fileName = path.basename(commandRelativePath);
  if (Object.hasOwn(COMMAND_TO_SKILL_REMAP, fileName)) {
    return COMMAND_TO_SKILL_REMAP[fileName];
  }
  return oplName(fileName.replace(/\.md$/i, ''));
}

function remapSkillPath(skillRelativePath) {
  if (!skillRelativePath) return '';
  const segments = skillRelativePath.split('/');
  return [oplName(segments[0]), ...segments.slice(1)].join('/');
}

function remapAgentPath(agentRelativePath) {
  if (!agentRelativePath) return '';
  const segments = agentRelativePath.split('/');
  return [...segments.slice(0, -1), oplName(segments[segments.length - 1])].join('/');
}

/**
 * Returns the destination skill directory for an operation targeting
 * `<root>/skills/<name>/...`, or null for non-skill operations.
 */
function skillDestinationKey(operation) {
  const normalized = String(operation.destinationPath || '').replace(/\\/g, '/');
  const match = normalized.match(/^(.*\/skills\/[^/]+)/);
  return match ? match[1] : null;
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
  const byKey = new Map();
  for (const op of operations) {
    const key = skillDestinationKey(op);
    if (!key) continue;
    const prior = byKey.get(key);
    if (!prior) { byKey.set(key, op); continue; }
    // Command wins the public name.
    if (isCommandEntrypoint(op) && !isCommandEntrypoint(prior)) {
      byKey.set(key, op);
      continue;
    }
  }

  const publicKeys = new Set(byKey.keys());
  const kept = [];
  const seen = new Set();

  for (const op of operations) {
    const key = skillDestinationKey(op);
    if (!key) {
      if (!seen.has(op)) { seen.add(op); kept.push(op); }
      continue;
    }
    if (byKey.get(key) === op) {
      if (!seen.has(op)) { seen.add(op); kept.push(op); }
      continue;
    }
    // A colliding scaffold that lost the public name is relocated, not dropped.
    if (!isCommandEntrypoint(op)) {
      const sourceName = String(op.sourceRelativePath || '')
        .replace(/\\/g, '/')
        .split('/')
        .filter(Boolean)
        .pop() || 'workflow';
      let relocatedKey = `${key}-${sourceName}`;
      // Guard against an accidental second collision.
      let suffix = 2;
      while (publicKeys.has(relocatedKey)) {
        relocatedKey = `${key}-${sourceName}-${suffix}`;
        suffix += 1;
      }
      publicKeys.add(relocatedKey);
      const normalized = String(op.destinationPath).replace(/\\/g, '/');
      const relocatedPath = normalized.replace(key, relocatedKey);
      const relocated = {
        ...op,
        destinationPath: relocatedPath,
        skillName: relocatedKey.split('/').pop(),
      };
      if (!seen.has(relocated)) { seen.add(relocated); kept.push(relocated); }
      continue;
    }
    // Command entrypoint that lost to another command: keep the first.
    if (!seen.has(op)) { seen.add(op); kept.push(op); }
  }

  return kept;
}

function planRuleOperations(moduleId, normalizedSourcePath, { repoRoot, targetRoot }) {
  return createFlatRuleOperations({
    moduleId,
    repoRoot,
    sourceRelativePath: normalizedSourcePath,
    destinationDir: path.join(targetRoot, 'rules'),
  }).map(withAntigravityRuleTrigger);
}

function planCommandOperations(moduleId, normalizedSourcePath, { repoRoot, targetRoot, sourceBase = '' }) {
  const sourceRoot = sourceBase ? path.join(repoRoot, sourceBase) : repoRoot;
  if (normalizedSourcePath === 'commands') {
    const commandsDir = sourceRoot ? path.join(sourceRoot, 'commands') : null;
    if (!commandsDir || !fs.existsSync(commandsDir) || !fs.statSync(commandsDir).isDirectory()) {
      return [];
    }
    return listRelativeFiles(commandsDir)
      .filter(file => file.endsWith('.md'))
      .map(relFile => createManagedOperation({
        moduleId,
        sourceRelativePath: path.join(sourceBase, 'commands', relFile),
        destinationPath: path.join(targetRoot, 'skills', remapCommandToSkillName(relFile), 'SKILL.md'),
        strategy: 'preserve-relative-path',
        contentTransform: 'antigravity-command-to-skill',
      }));
  }
  const commandRelativePath = normalizedSourcePath.slice('commands/'.length);
  return [createManagedOperation({
    moduleId,
    sourceRelativePath: path.join(sourceBase, normalizedSourcePath),
    destinationPath: path.join(targetRoot, 'skills', remapCommandToSkillName(commandRelativePath), 'SKILL.md'),
    strategy: 'preserve-relative-path',
    contentTransform: 'antigravity-command-to-skill',
  })];
}

function planAgentOperations(moduleId, normalizedSourcePath, { repoRoot, targetRoot }) {
  // `.opencode/prompts/agents/*.txt` carries agent prompts that have no
  // `agents/*.md` counterpart (plan-reviewer with Momus+Oracle dual pass).
  // Project them as agents so the canonical roles are actually installed.
  if (normalizedSourcePath === '.opencode/prompts/agents'
      || normalizedSourcePath.startsWith('.opencode/prompts/agents/')) {
    const dir = repoRoot ? path.join(repoRoot, '.opencode', 'prompts', 'agents') : null;
    if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
    return listRelativeFiles(dir)
      .filter(file => file.endsWith('.txt'))
      .map(relFile => {
        const baseName = relFile.replace(/\.txt$/i, '');
        return createManagedOperation({
          moduleId,
          sourceRelativePath: path.join('.opencode', 'prompts', 'agents', relFile),
          destinationPath: path.join(targetRoot, 'agents', `${oplName(baseName)}.md`),
          strategy: 'preserve-relative-path',
          contentTransform: 'antigravity-prompt-to-agent',
        });
      });
  }

  if (normalizedSourcePath === 'agents') {
    const agentsDir = repoRoot ? path.join(repoRoot, 'agents') : null;
    if (!agentsDir || !fs.existsSync(agentsDir) || !fs.statSync(agentsDir).isDirectory()) {
      return [];
    }
    return listRelativeFiles(agentsDir)
      .filter(file => file.endsWith('.md'))
      .map(relFile => createManagedOperation({
        moduleId,
        sourceRelativePath: path.join('agents', relFile),
        destinationPath: path.join(targetRoot, 'agents', remapAgentPath(relFile)),
        strategy: 'preserve-relative-path',
        contentTransform: 'antigravity-agent-frontmatter-cli',
      }));
  }
  const agentRelativePath = normalizedSourcePath.slice('agents/'.length);
  return [createManagedOperation({
    moduleId,
    sourceRelativePath: normalizedSourcePath,
    destinationPath: path.join(targetRoot, 'agents', remapAgentPath(agentRelativePath)),
    strategy: 'preserve-relative-path',
    contentTransform: 'antigravity-agent-frontmatter-cli',
  })];
}

function planSkillOperations(moduleId, normalizedSourcePath, { repoRoot, targetRoot }) {
  if (normalizedSourcePath === 'skills') {
    const skillsDir = repoRoot ? path.join(repoRoot, 'skills') : null;
    if (!skillsDir || !fs.existsSync(skillsDir) || !fs.statSync(skillsDir).isDirectory()) {
      return [];
    }
    return fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
      .map(entry => createManagedScaffoldOperation(
        moduleId,
        path.join('skills', entry.name),
        path.join(targetRoot, 'skills', remapSkillPath(entry.name)),
        'preserve-relative-path'
      ));
  }
  const skillRelativePath = normalizedSourcePath.slice('skills/'.length);
  return [createManagedScaffoldOperation(
    moduleId,
    normalizedSourcePath,
    path.join(targetRoot, 'skills', remapSkillPath(skillRelativePath)),
    'preserve-relative-path'
  )];
}

function planSourcePath(moduleId, normalizedSourcePath, context) {
  if (normalizedSourcePath === '.opencode/prompts/agents'
      || normalizedSourcePath.startsWith('.opencode/prompts/agents/')) {
    return planAgentOperations(moduleId, normalizedSourcePath, context);
  }
  if (normalizedSourcePath === '.opencode/commands'
      || normalizedSourcePath.startsWith('.opencode/commands/')) {
    return planCommandOperations(
      moduleId,
      `commands${normalizedSourcePath.slice('.opencode/commands'.length)}`,
      { ...context, sourceBase: '.opencode' }
    );
  }
  if (normalizedSourcePath === 'rules' || normalizedSourcePath.startsWith('rules/')) {
    return planRuleOperations(moduleId, normalizedSourcePath, context);
  }
  if (normalizedSourcePath === 'commands' || normalizedSourcePath.startsWith('commands/')) {
    return planCommandOperations(moduleId, normalizedSourcePath, context);
  }
  if (normalizedSourcePath === 'agents' || normalizedSourcePath.startsWith('agents/')) {
    return planAgentOperations(moduleId, normalizedSourcePath, context);
  }
  if (normalizedSourcePath === 'skills' || normalizedSourcePath.startsWith('skills/')) {
    return planSkillOperations(moduleId, normalizedSourcePath, context);
  }
  return [];
}

module.exports = createInstallTargetAdapter({
  id: 'antigravity-cli',
  target: 'antigravity-cli',
  kind: 'project',
  rootSegments: ['.agents'],
  installStatePathSegments: ['ecc-install-state.json'],
  supportsModule(module) {
    const paths = Array.isArray(module && module.paths) ? module.paths : [];
    return paths.length > 0;
  },
  planOperations(input, adapter) {
    const modules = Array.isArray(input.modules)
      ? input.modules
      : (input.module ? [input.module] : []);
    const { repoRoot, projectRoot, homeDir } = input;
    const targetRoot = adapter.resolveRoot({ repoRoot, projectRoot, homeDir });
    const context = { repoRoot, targetRoot };

    const operations = modules.flatMap(module => {
      const paths = Array.isArray(module.paths) ? module.paths : [];
      return paths
        .filter(supportsAntigravityCliSourcePath)
        .flatMap(sourceRelativePath =>
          planSourcePath(module.id, normalizeRelativePath(sourceRelativePath), context));
    });

    return dedupeSkillDestinations(operations);
  },
});
