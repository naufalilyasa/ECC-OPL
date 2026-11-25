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

const CANONICAL_CLI_AGENT_TOOLS = Object.freeze({
  planner: ['read_file', 'grep_search', 'find_by_name', 'invoke_subagent'],
  'plan-reviewer': ['read_file', 'grep_search', 'find_by_name'],
  architect: ['read_file', 'grep_search', 'find_by_name'],
  explore: ['read_file', 'grep_search', 'find_by_name'],
  'code-reviewer': ['read_file', 'grep_search', 'find_by_name'],
  'docs-lookup': ['read_file', 'grep_search', 'find_by_name', 'read_url_content', 'search_web'],
  'tdd-guide': ['read_file', 'edit_file', 'write_file', 'grep_search', 'run_command'],
  'code-simplifier': ['read_file', 'edit_file', 'write_file', 'grep_search', 'find_by_name'],
  'doc-updater': ['read_file', 'edit_file', 'write_file', 'grep_search', 'find_by_name'],
  'e2e-runner': ['read_file', 'edit_file', 'write_file', 'grep_search', 'find_by_name', 'run_command'],
  build: ['read_file', 'edit_file', 'write_file', 'grep_search', 'find_by_name', 'run_command'],
});

const MODEL_NAMES = Object.freeze({
  haiku: 'flash',
  sonnet: 'pro',
  opus: 'pro',
});

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
        // Preserve explicitly declared MCP tools; they are host-provided and
        // cannot be reconstructed from the canonical built-in tool set.
        const declaredMcpTools = tools.filter(tool => tool.startsWith('mcp__'));
        tools = [...new Set([...canonicalTools, ...declaredMcpTools])];
      }
    }
    const isReviewer = (typeof frontmatter.name === 'string' && frontmatter.name.includes('reviewer'))
      || (typeof label === 'string' && label.includes('reviewer'));
    if (isCli && isReviewer) {
      tools = tools.filter(tool => !REVIEWER_DISALLOWED_CLI_TOOLS.has(tool));
    }
    adapted.tools = tools;
  }
  if (Object.hasOwn(frontmatter, 'model')) {
    adapted.model = Object.hasOwn(MODEL_NAMES, frontmatter.model)
      ? MODEL_NAMES[frontmatter.model]
      : frontmatter.model;
  }
  const serialized = require('js-yaml')
    .dump(adapted, { lineWidth: -1, noRefs: true })
    .trimEnd()
    .replace(/\n/g, headerEol);
  return `---${headerEol}${serialized}${headerEol}---${trailingFenceEol}${body}`;
}

function adaptAntigravityCommandToSkill(source, destinationPath) {
  const skillName = path.basename(path.dirname(destinationPath));
  const { frontmatter, body, headerEol, trailingFenceEol } = splitFrontmatter(source, destinationPath);
  // Spread first, then pin name so frontmatter cannot override the destination-derived name.
  const adapted = {
    ...frontmatter,
    name: skillName,
  };
  const serialized = require('js-yaml')
    .dump(adapted, { lineWidth: -1, noRefs: true })
    .trimEnd()
    .replace(/\n/g, headerEol);
  return `---${headerEol}${serialized}${headerEol}---${trailingFenceEol}${body}`;
}

module.exports = {
  adaptAntigravityAgent,
  adaptAntigravityCommandToSkill,
  CANONICAL_CLI_AGENT_TOOLS,
  MODEL_NAMES,
  TOOL_NAMES,
  CLI_TOOL_NAMES,
};
