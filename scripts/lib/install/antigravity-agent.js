'use strict';

const path = require('path');
const { normalizeAgentTools } = require('../agent-tools');

const TOOL_NAMES = Object.freeze({
  Read: 'view_file',
  ReadFile: 'view_file',
  NotebookRead: 'view_file',
  Write: 'write_to_file',
  Edit: 'replace_file_content',
  MultiEdit: 'replace_file_content',
  Grep: 'grep_search',
  Glob: 'find_by_name',
  Bash: 'run_command',
  WebSearch: 'search_web',
  WebFetch: 'read_url_content',
});

const CLI_TOOL_NAMES = Object.freeze({
  Read: 'read_file',
  ReadFile: 'read_file',
  NotebookRead: 'read_file',
  Write: 'write_file',
  Edit: 'edit_file',
  MultiEdit: 'edit_file',
  Grep: 'grep_search',
  Glob: 'find_by_name',
  Bash: 'run_command',
  WebSearch: 'search_web',
  WebFetch: 'read_url_content',
  Task: 'invoke_subagent',
});

const REVIEWER_DISALLOWED_CLI_TOOLS = new Set([
  'write_file',
  'edit_file',
  'run_command',
  'invoke_subagent',
]);

// Explicit review roles only. A name substring match would strip tools from
// unrelated agents whose name merely contains "reviewer".
const REVIEW_ROLE_NAMES = new Set([
  'code-reviewer',
  'security-reviewer',
  'plan-reviewer',
  'commit-reviewer',
  'a11y-architect',
  'bengali-reviewer',
  'cpp-reviewer',
  'csharp-reviewer',
  'database-reviewer',
  'django-reviewer',
  'fastapi-reviewer',
  'flutter-reviewer',
  'fsharp-reviewer',
  'go-reviewer',
  'healthcare-reviewer',
  'java-reviewer',
  'kotlin-reviewer',
  'mle-reviewer',
  'network-config-reviewer',
  'php-reviewer',
  'python-reviewer',
  'rag-pipeline-reviewer',
  'react-reviewer',
  'ruby-reviewer',
  'rust-reviewer',
  'swift-reviewer',
  'typescript-reviewer',
  'vue-reviewer',
]);

function isReviewRole(name, label) {
  const candidates = [
    typeof name === 'string' ? name : '',
    typeof label === 'string' ? path.basename(label.replace(/\\/g, '/'), '.md') : '',
  ];
  return candidates.some(candidate => (
    candidate && REVIEW_ROLE_NAMES.has(candidate.replace(/^opl-/, ''))
  ));
}

const CANONICAL_CLI_AGENT_TOOLS = Object.freeze({
  planner: ['read_file', 'grep_search', 'find_by_name', 'invoke_subagent'],
  'plan-reviewer': ['read_file', 'grep_search', 'find_by_name'],
  architect: ['read_file', 'grep_search', 'find_by_name'],
  explore: ['read_file', 'grep_search', 'find_by_name'],
  'code-reviewer': ['read_file', 'grep_search', 'find_by_name'],
  'security-reviewer': ['read_file', 'grep_search', 'find_by_name'],
  'docs-lookup': ['read_file', 'grep_search', 'find_by_name', 'read_url_content', 'search_web'],
  'tdd-guide': ['read_file', 'edit_file', 'write_file', 'grep_search', 'run_command'],
  'code-simplifier': ['read_file', 'edit_file', 'write_file', 'grep_search', 'find_by_name'],
  'doc-updater': ['read_file', 'edit_file', 'write_file', 'grep_search', 'find_by_name'],
  'e2e-runner': ['read_file', 'edit_file', 'write_file', 'grep_search', 'find_by_name', 'run_command'],
  build: ['read_file', 'edit_file', 'write_file', 'grep_search', 'find_by_name', 'run_command'],
});

// Agent frontmatter `model:` is passed through unchanged. Tier names
// (haiku/sonnet/opus) are host-relative and must not be translated into
// concrete model IDs the owner has not approved; the host selects the model.

function splitFrontmatter(source, label) {
  const raw = String(source || '');
  const match = raw.match(/^---(\r?\n)([\s\S]*?)\r?\n---(\r?\n)/);
  if (!match) {
    throw new Error(`Cannot adapt Antigravity agent ${label}: missing YAML frontmatter`);
  }

  // Keep YAML loading behind the transform boundary. Public help commands load
  // the installer graph without executing a transform, including in hermetic
  // packed-artifact checks where runtime dependencies are intentionally absent.
  const frontmatter = require('js-yaml').load(match[2]);
  if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
    throw new Error(`Cannot adapt Antigravity agent ${label}: frontmatter must be an object`);
  }

  return {
    frontmatter,
    body: raw.slice(match[0].length),
    headerEol: match[1],
    trailingFenceEol: match[3],
  };
}

function normalizeToolNames(value, toolDict, label, isCli = false) {
  const tools = normalizeAgentTools(value);
  if (isCli) {
    const unmapped = tools.filter(name => !Object.hasOwn(toolDict, name) && !name.startsWith('mcp__'));
    if (unmapped.length > 0) {
      throw new Error(`Cannot adapt Antigravity agent ${label}: unmapped required tool(s): ${unmapped.join(', ')}`);
    }
    return [...new Set(tools
      .filter(name => Object.hasOwn(toolDict, name) || name.startsWith('mcp__'))
      .map(name => Object.hasOwn(toolDict, name) ? toolDict[name] : name))];
  }
  return [...new Set(tools
    .filter(name => Object.hasOwn(toolDict, name))
    .map(name => toolDict[name]))];
}

function adaptAntigravityAgent(source, label = '<unknown>', options = {}) {
  const isCli = options.runtime === 'cli';
  const toolDict = isCli ? CLI_TOOL_NAMES : TOOL_NAMES;
  const { frontmatter, body, headerEol, trailingFenceEol } = splitFrontmatter(source, label);
  const { color: _claudeColor, hooks: _claudeHooks, ...supportedFrontmatter } = frontmatter;
  const adapted = { ...supportedFrontmatter };
  if (isCli && typeof adapted.name === 'string') {
    adapted.name = adapted.name.startsWith('opl-') ? adapted.name : `opl-${adapted.name}`;
  }
  if (Object.hasOwn(frontmatter, 'tools')) {
    let tools = normalizeToolNames(frontmatter.tools, toolDict, label, isCli);
    if (isCli) {
      // Normalize Windows separators so basename works on POSIX hosts too.
      const labelBase = typeof label === 'string'
        ? path.basename(label.replace(/\\/g, '/'), '.md')
        : '';
      let canonicalKey = null;
      for (const key of Object.keys(CANONICAL_CLI_AGENT_TOOLS)) {
        if (
          (typeof frontmatter.name === 'string' && (frontmatter.name === key || frontmatter.name === `opl-${key}`))
          || (labelBase === key || labelBase === `opl-${key}`)
        ) {
          canonicalKey = key;
          break;
        }
      }
      if (canonicalKey) {
        const canonicalTools = [...CANONICAL_CLI_AGENT_TOOLS[canonicalKey]];
        // The canonical table may only NARROW declared permissions. Adding a
        // tool the agent never declared would widen its authority.
        // Preserve explicitly declared MCP tools; they are host-provided and
        // cannot be reconstructed from the canonical built-in tool set.
        const declared = new Set(tools);
        const narrowed = canonicalTools.filter(tool => declared.has(tool));
        const declaredMcpTools = tools.filter(tool => tool.startsWith('mcp__'));
        tools = [...new Set([...narrowed, ...declaredMcpTools])];
      }
    }
    const isReviewer = isReviewRole(frontmatter.name, label);
    if (isCli && isReviewer) {
      tools = tools.filter(tool => !REVIEWER_DISALLOWED_CLI_TOOLS.has(tool));
    }
    adapted.tools = tools;
  }
  if (Object.hasOwn(frontmatter, 'model')) {
    // Pass through unchanged; see note above.
    adapted.model = frontmatter.model;
  }
  const serialized = require('js-yaml')
    .dump(adapted, { lineWidth: -1, noRefs: true })
    .trimEnd()
    .replace(/\n/g, headerEol);
  return `---${headerEol}${serialized}${headerEol}---${trailingFenceEol}${body}`;
}

function adaptAntigravityCommandToSkill(source, destinationPath) {
  const skillName = path.basename(path.dirname(destinationPath));
  // Some OpenCode commands ship as plain Markdown with no YAML frontmatter.
  // Synthesize one from the destination name instead of failing the install.
  const hasFrontmatter = /^\uFEFF?---\r?\n/.test(source);
  const { frontmatter, body, headerEol, trailingFenceEol } = hasFrontmatter
    ? splitFrontmatter(source, destinationPath)
    : {
        frontmatter: {
          name: skillName,
          description: `Projected from the canonical command ${path.basename(destinationPath, '.md')}.`,
        },
        body: source,
        headerEol: '\n',
        trailingFenceEol: '\n',
      };
  // Spread first, then pin name so frontmatter cannot override the destination-derived name.
  const adapted = {
    ...frontmatter,
    name: skillName,
  };
  // The projected workflow must own its state under the agy target, not the
  // OpenCode runtime's path. Match the bare directory too: commands run
  // `mkdir -p .opencode/workflows` without a trailing `/active.json`, so a
  // filename-only rewrite leaves the script creating the old dir and then
  // failing ENOENT on the new one.
  const projectedBody = body
    .replace(/\.opencode\/workflows(\/active\.json)?/g, '.agents/ecc-opl/workflows$1')
    .replace(/\.opencode\/markers(\/)?/g, '.agents/ecc-opl/markers$1');
  // Belt and braces: no projected workflow may retain a literal OpenCode state
  // path, whatever shape the source used (backticks, mkdir, prose).
  if (/\.opencode\/(workflows|markers)/.test(projectedBody)) {
    throw new Error(`projected command still references OpenCode state: ${destinationPath}`);
  }
  const serialized = require('js-yaml')
    .dump(adapted, { lineWidth: -1, noRefs: true })
    .trimEnd()
    .replace(/\n/g, headerEol);
  return `---${headerEol}${serialized}${headerEol}---${trailingFenceEol}${projectedBody}`;
}

/**
 * Project a plain-text agent prompt (`.opencode/prompts/agents/<name>.txt`)
 * into a Markdown agent with CLI frontmatter. These prompts carry no YAML
 * frontmatter, so one is synthesized from the destination name.
 */
function adaptAntigravityPromptToAgent(source, destinationPath) {
  const baseName = path.basename(destinationPath, '.md');
  const description = `${baseName.replace(/^opl-/, '')} agent (projected from the canonical prompt).`;
  const frontmatter = {
    name: baseName,
    description,
    tools: ['read_file', 'grep_search', 'find_by_name'],
  };
  const headerEol = '\n';
  const serialized = require('js-yaml')
    .dump(frontmatter, { lineWidth: -1, noRefs: true })
    .trimEnd()
    .replace(/\n/g, headerEol);
  const body = String(source || '').trimStart();
  return `---${headerEol}${serialized}${headerEol}---${headerEol}${headerEol}${body}`;
}

/**
 * Rewrite OpenCode state paths inside a projected skill document onto the agy
 * state paths. A skill that still names `.opencode/workflows/active.json` makes
 * the agent write OpenCode state, which the antigravity-cli target must never
 * mutate. Fails closed if any literal OpenCode state path survives.
 */
function rewriteAntigravityStatePaths(source, destinationPath) {
  const rewritten = String(source)
    .replace(/\.opencode\/workflows(\/active\.json)?/g, '.agents/ecc-opl/workflows$1')
    .replace(/\.opencode\/markers(\/)?/g, '.agents/ecc-opl/markers$1')
    .replace(/\.opencode\/plans\//g, '.agents/ecc-opl/plans/');
  if (/\.opencode\/(workflows|markers)/.test(rewritten)) {
    throw new Error(`projected skill still references OpenCode state: ${destinationPath}`);
  }
  return rewritten;
}

module.exports = {
  adaptAntigravityAgent,
  adaptAntigravityCommandToSkill,
  adaptAntigravityPromptToAgent,
  rewriteAntigravityStatePaths,
  CANONICAL_CLI_AGENT_TOOLS,
  REVIEW_ROLE_NAMES,
  TOOL_NAMES,
  CLI_TOOL_NAMES,
};
