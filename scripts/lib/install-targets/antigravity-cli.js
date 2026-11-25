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

const SUPPORTED_SOURCE_PREFIXES = ['rules', 'agents', 'skills', 'commands'];

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

function remapCommandToSkillName(commandRelativePath) {
  if (!commandRelativePath) return '';
  const fileName = path.basename(commandRelativePath);
  if (Object.hasOwn(COMMAND_TO_SKILL_REMAP, fileName)) {
    return COMMAND_TO_SKILL_REMAP[fileName];
  }
  const baseName = fileName.replace(/\.md$/i, '');
  return baseName.startsWith('opl-') ? baseName : `opl-${baseName}`;
}

function remapSkillPath(skillRelativePath) {
  if (!skillRelativePath) return '';
  const segments = skillRelativePath.split('/');
  const skillName = segments[0];
  let targetSkillName;
  if (skillName === 'tdd-workflow') {
    targetSkillName = 'opl-tdd';
  } else if (skillName === 'typography-system') {
    targetSkillName = 'opl-typography';
  } else if (skillName.startsWith('opl-')) {
    targetSkillName = skillName;
  } else {
    targetSkillName = `opl-${skillName}`;
  }
  return [targetSkillName, ...segments.slice(1)].join('/');
}

function remapAgentPath(agentRelativePath) {
  if (!agentRelativePath) return '';
  const segments = agentRelativePath.split('/');
  const fileName = segments[segments.length - 1];
  const targetFileName = fileName.startsWith('opl-') ? fileName : `opl-${fileName}`;
  return [...segments.slice(0, -1), targetFileName].join('/');
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
 * directory (e.g. commands/typography.md and skills/typography-system both
 * target opl-typography). Applying both silently overwrites one with the
 * other. Keep exactly one operation per skill directory, preferring the full
 * skill scaffold over a command-derived SKILL.md.
 */
function dedupeSkillDestinations(operations) {
  const seen = new Map();
  const kept = [];
  for (const op of operations) {
    const key = skillDestinationKey(op);
    if (!key) {
      kept.push(op);
      continue;
    }
    const prior = seen.get(key);
    if (!prior) {
      seen.set(key, op);
      kept.push(op);
      continue;
    }
    const isScaffold = op.contentTransform !== 'antigravity-command-to-skill';
    const priorIsScaffold = prior.contentTransform !== 'antigravity-command-to-skill';
    if (isScaffold && !priorIsScaffold) {
      const index = kept.indexOf(prior);
      if (index >= 0) kept[index] = op;
      seen.set(key, op);
    }
    // Otherwise drop the duplicate: first seen or existing scaffold wins.
  }
  return kept;
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
    const {
      repoRoot,
      projectRoot,
      homeDir,
    } = input;
    const planningInput = {
      repoRoot,
      projectRoot,
      homeDir,
    };
    const targetRoot = adapter.resolveRoot(planningInput);

    const operations = modules.flatMap(module => {
      const paths = Array.isArray(module.paths) ? module.paths : [];
      return paths
        .filter(supportsAntigravityCliSourcePath)
        .flatMap(sourceRelativePath => {
          const normalizedSourcePath = normalizeRelativePath(sourceRelativePath);

          if (
            normalizedSourcePath === 'rules'
            || normalizedSourcePath.startsWith('rules/')
          ) {
            return createFlatRuleOperations({
              moduleId: module.id,
              repoRoot,
              sourceRelativePath: normalizedSourcePath,
              destinationDir: path.join(targetRoot, 'rules'),
            }).map(withAntigravityRuleTrigger);
          }

          if (
            normalizedSourcePath === 'commands'
            || normalizedSourcePath.startsWith('commands/')
          ) {
            if (normalizedSourcePath === 'commands') {
              const commandsDir = repoRoot ? path.join(repoRoot, 'commands') : null;
              if (!commandsDir || !fs.existsSync(commandsDir) || !fs.statSync(commandsDir).isDirectory()) {
                return [];
              }
              const files = listRelativeFiles(commandsDir);
              return files
                .filter(f => f.endsWith('.md'))
                .map(relFile => {
                  const skillName = remapCommandToSkillName(relFile);
                  return createManagedOperation({
                    moduleId: module.id,
                    sourceRelativePath: path.join('commands', relFile),
                    destinationPath: path.join(targetRoot, 'skills', skillName, 'SKILL.md'),
                    strategy: 'preserve-relative-path',
                    contentTransform: 'antigravity-command-to-skill',
                  });
                });
            }

            const commandRelativePath = normalizedSourcePath.slice('commands/'.length);
            const skillName = remapCommandToSkillName(commandRelativePath);
            return [
              createManagedOperation({
                moduleId: module.id,
                sourceRelativePath: normalizedSourcePath,
                destinationPath: path.join(targetRoot, 'skills', skillName, 'SKILL.md'),
                strategy: 'preserve-relative-path',
                contentTransform: 'antigravity-command-to-skill',
              }),
            ];
          }

          if (
            normalizedSourcePath === 'agents'
            || normalizedSourcePath.startsWith('agents/')
          ) {
            if (normalizedSourcePath === 'agents') {
              const agentsDir = repoRoot ? path.join(repoRoot, 'agents') : null;
              if (!agentsDir || !fs.existsSync(agentsDir) || !fs.statSync(agentsDir).isDirectory()) {
                return [];
              }
              const files = listRelativeFiles(agentsDir);
              return files
                .filter(f => f.endsWith('.md'))
                .map(relFile => {
                  const sourceRelativePath = path.join('agents', relFile);
                  const remapped = remapAgentPath(relFile);
                  return createManagedOperation({
                    moduleId: module.id,
                    sourceRelativePath,
                    destinationPath: path.join(targetRoot, 'agents', remapped),
                    strategy: 'preserve-relative-path',
                    contentTransform: 'antigravity-agent-frontmatter-cli',
                  });
                });
            }

            const agentRelativePath = normalizedSourcePath === 'agents'
              ? ''
              : normalizedSourcePath.slice('agents/'.length);
            const remappedPath = remapAgentPath(agentRelativePath);
            return [
              createManagedOperation({
                moduleId: module.id,
                sourceRelativePath: normalizedSourcePath,
                destinationPath: path.join(targetRoot, 'agents', remappedPath),
                strategy: 'preserve-relative-path',
                contentTransform: 'antigravity-agent-frontmatter-cli',
              }),
            ];
          }

          if (
            normalizedSourcePath === 'skills'
            || normalizedSourcePath.startsWith('skills/')
          ) {
            if (normalizedSourcePath === 'skills') {
              const skillsDir = repoRoot ? path.join(repoRoot, 'skills') : null;
              if (!skillsDir || !fs.existsSync(skillsDir) || !fs.statSync(skillsDir).isDirectory()) {
                return [];
              }
              const entries = fs.readdirSync(skillsDir, { withFileTypes: true })
                .filter(d => d.isDirectory() && !d.name.startsWith('.'));
              return entries.map(entry => {
                const sourceRelativePath = path.join('skills', entry.name);
                const remapped = remapSkillPath(entry.name);
                return createManagedScaffoldOperation(
                  module.id,
                  sourceRelativePath,
                  path.join(targetRoot, 'skills', remapped),
                  'preserve-relative-path'
                );
              });
            }

            const skillRelativePath = normalizedSourcePath === 'skills'
              ? ''
              : normalizedSourcePath.slice('skills/'.length);
            const remappedPath = remapSkillPath(skillRelativePath);
            return [
              createManagedScaffoldOperation(
                module.id,
                normalizedSourcePath,
                path.join(targetRoot, 'skills', remappedPath),
                'preserve-relative-path'
              ),
            ];
          }

          return [];
        });
    });

    return dedupeSkillDestinations(operations);
  },
});
