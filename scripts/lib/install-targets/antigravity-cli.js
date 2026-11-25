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
const {
  dedupeAgentDestinations,
  dedupeSkillDestinations,
} = require('./antigravity-destinations');

const SUPPORTED_SOURCE_PREFIXES = [
  'rules',
  'agents',
  'skills',
  'commands',
  '.opencode/commands',
  '.opencode/prompts/agents',
  // Runtime scripts the projected workflows actually invoke. Without these the
  // modules that declare them plan zero operations and the installed
  // entrypoints reference files that were never materialized.
  '.opencode/scripts',
  'scripts',
];

function supportsAntigravityCliSourcePath(sourceRelativePath) {
  const normalizedPath = normalizeRelativePath(sourceRelativePath);
  if (normalizedPath.split('/').includes('..')) return false;
  // A module may list the `.opencode` directory itself; expand it to the two
  // sub-trees this target projects so the planSourcePath routes can run.
  if (normalizedPath === '.opencode') return true;
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
  // `agy` registers a subagent from `.agents/agents/<name>/agent.md` (verified
  // against the 1.5.17 binary), not from a flat `<name>.md` file.
  //
  // Migration boundary: projects installed before this layout change still hold
  // flat `.agents/agents/<name>.md` files. `agy` ignores them, so they are
  // inert, but they are not removed here — a flat file may carry user edits and
  // this installer has no proof of ownership for it. Reinstalling does not
  // clean them up; remove them manually once the new layout is confirmed.
  const agentDestination = baseName =>
    path.join(targetRoot, 'agents', oplName(baseName), 'agent.md');

  // `.opencode/prompts/agents/*.txt` carries agent prompts that have no
  // `agents/*.md` counterpart (plan-reviewer with Momus+Oracle dual pass).
  // Project them as agents so the canonical roles are actually installed.
  if (normalizedSourcePath === '.opencode/prompts/agents'
      || normalizedSourcePath.startsWith('.opencode/prompts/agents/')) {
    const dir = repoRoot ? path.join(repoRoot, '.opencode', 'prompts', 'agents') : null;
    if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
    // A module may claim one prompt file; only a whole-directory claim expands.
    const claimed = normalizedSourcePath.slice('.opencode/prompts/agents'.length).replace(/^\//, '');
    const promptFiles = claimed
      ? (fs.existsSync(path.join(dir, claimed)) ? [claimed] : [])
      : listRelativeFiles(dir).filter(file => file.endsWith('.txt'));
    return promptFiles
      .filter(file => file.endsWith('.txt'))
      .map(relFile => {
        const baseName = relFile.replace(/\.txt$/i, '');
        return createManagedOperation({
          moduleId,
          sourceRelativePath: path.join('.opencode', 'prompts', 'agents', relFile),
          destinationPath: agentDestination(baseName),
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
        destinationPath: agentDestination(relFile.replace(/\.md$/i, '')),
        strategy: 'preserve-relative-path',
        contentTransform: 'antigravity-agent-frontmatter-cli',
      }));
  }
  const agentRelativePath = normalizedSourcePath.slice('agents/'.length);
  // A module may claim an individual agent file (e.g. `agents/tdd-guide.md`).
  // Only a whole-directory claim expands to every agent; naming one file must
  // project exactly that file, otherwise a minimal release installs all agents.
  return [createManagedOperation({
    moduleId,
    sourceRelativePath: normalizedSourcePath,
    destinationPath: agentDestination(
      agentRelativePath.split('/').pop().replace(/\.md$/i, '')
    ),
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
      ))
      .map(withAntigravityStatePathRewrite);
  }
  const skillRelativePath = normalizedSourcePath.slice('skills/'.length);
  const segments = skillRelativePath.split('/');
  const lastSegment = segments[segments.length - 1];
  const isSingleSkillFile = lastSegment.toLowerCase() === 'skill.md';
  const skillName = segments[0];

  if (isSingleSkillFile) {
    // A module may claim one skill by its SKILL.md; keep the `<name>/SKILL.md`
    // pair because a bare file is not a discoverable skill.
    const destination = path.join(targetRoot, 'skills', remapSkillPath(skillName), 'SKILL.md');
    return [createManagedScaffoldOperation(
      moduleId,
      normalizedSourcePath,
      destination,
      'preserve-relative-path'
    )].map(withAntigravityStatePathRewrite);
  }

  if (segments.length > 1) {
    // A support file inside a skill (script, reference) is not a skill. Project
    // it into the owning skill's directory, keeping its relative path.
    const destination = path.join(
      targetRoot,
      'skills',
      remapSkillPath(skillName),
      ...segments.slice(1)
    );
    return [createManagedOperation({
      kind: 'copy-file',
      moduleId,
      sourceRelativePath: normalizedSourcePath,
      destinationPath: destination,
      strategy: 'preserve-relative-path',
      contentTransform: 'antigravity-state-path-rewrite',
    })];
  }

  const destination = path.join(targetRoot, 'skills', remapSkillPath(skillName));
  return [createManagedScaffoldOperation(
    moduleId,
    normalizedSourcePath,
    destination,
    'preserve-relative-path'
  )].map(withAntigravityStatePathRewrite);
}

// Skills that document the OpenCode state path must be projected onto the agy
// state path, otherwise an agent reading the projected skill writes OpenCode
// state. The operation may be a whole directory scaffold, so no extension
// guard here: plan.js drops the transform for non-Markdown files.
function withAntigravityStatePathRewrite(operation) {
  return { ...operation, contentTransform: 'antigravity-state-path-rewrite' };
}

function planSourcePath(moduleId, normalizedSourcePath, context) {
  // `.opencode` listed as a whole directory: project both sub-trees.
  if (normalizedSourcePath === '.opencode') {
    return [
      ...planAgentOperations(moduleId, '.opencode/prompts/agents', context),
      ...planCommandOperations(moduleId, 'commands', { ...context, sourceBase: '.opencode' })
    ];
  }
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
  // Runtime scripts keep their relative path under `<root>/scripts/`.
  if (normalizedSourcePath === '.opencode/scripts'
      || normalizedSourcePath.startsWith('.opencode/scripts/')) {
    const relative = normalizedSourcePath.slice('.opencode/scripts'.length).replace(/^\//, '');
    const files = relative
      ? [relative]
      : listRelativeFiles(path.join(context.repoRoot, '.opencode', 'scripts'));
    return files.map(rel => createManagedOperation({
      moduleId,
      sourceRelativePath: path.join('.opencode', 'scripts', rel),
      destinationPath: path.join(context.targetRoot, 'scripts', rel),
      strategy: 'preserve-relative-path',
    }));
  }
  if (normalizedSourcePath === 'scripts' || normalizedSourcePath.startsWith('scripts/')) {
    const relative = normalizedSourcePath.slice('scripts'.length).replace(/^\//, '');
    const files = relative
      ? [relative]
      : listRelativeFiles(path.join(context.repoRoot, 'scripts'));
    return files.map(rel => createManagedOperation({
      moduleId,
      sourceRelativePath: path.join('scripts', rel),
      destinationPath: path.join(context.targetRoot, 'scripts', rel),
      strategy: 'preserve-relative-path',
    }));
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
    // A module can carry no paths of its own and still be installable: its
    // content may come entirely from its dependencies, which this target also
    // supports. Rejecting it here skipped whole module families (and their
    // dependents) just because they are selector modules.
    if (!module) return false;
    const paths = Array.isArray(module.paths) ? module.paths : [];
    if (paths.length > 0) return true;
    const dependencies = Array.isArray(module.dependencies) ? module.dependencies : [];
    return dependencies.length > 0;
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

    return dedupeAgentDestinations(dedupeSkillDestinations(operations));
  },
});

