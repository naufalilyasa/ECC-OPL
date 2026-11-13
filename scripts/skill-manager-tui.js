#!/usr/bin/env node
'use strict';

/**
 * ECC-OPL Component Manager TUI (Skills, Commands, Agents)
 * 
 * Interactive dual-card TUI to manage OpenCode/ECC components:
 * - Tab 1: SKILLS (Workflow skills, patterns, standards)
 * - Tab 2: COMMANDS (Slash commands)
 * - Tab 3: AGENTS (Specialized subagents)
 * 
 * Features:
 * - Card Kiri: NON-AKTIF (Library / Available / Disabled in scope)
 * - Card Kanan: AKTIF (Enabled in current scope)
 * - Press [Enter] or [Space] to move selected item between cards (toggle On/Off)
 * - Press [i] or [v] to view full markdown content rendered in a fullscreen scrollable modal
 * - Press [T] or [M] or [[] / []] to switch between SKILLS, COMMANDS, and AGENTS
 * - Filter by Tier (1, 2, 3, 0=All) or Category [C]
 * - Scope: Global (~/.config/opencode) or Project (<cwd>) via [S]
 * - Mouse & Trackpad scroll support (5 lines/scroll in modal, 3 items/scroll in list)
 * - Live search [/] with blinking cursor and [Esc] reset
 *
 * Usage:
 *   ecc-skills                                  # Interactive TUI
 *   ecc-skills --status                         # Print summary for all components
 *   ecc-skills --mode <skills|commands|agents>  # Start in specific mode
 *   ecc-skills --enable <id> [--mode <m>]       # Programmatically enable item
 *   ecc-skills --disable <id> [--mode <m>]      # Programmatically disable item
 *   ecc-skills --disable-tier <1|2|3>           # Batch disable tier in mode
 *   ecc-skills --view <id>                      # Print rendered markdown to stdout
 */

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const os = require('node:os');
const { renderMarkdown, stripAnsi, visibleLength, padAnsi, truncateAnsi } = require('./lib/terminal-markdown');

// ── Paths Configuration ───────────────────────────────────────────────────────
const HOME = os.homedir();
const ECC_ROOT = process.env.ECC_ROOT || path.resolve(__dirname, '..');

const ECC_SKILLS_DIR = path.join(ECC_ROOT, 'skills');
const ECC_COMMANDS_DIR = path.join(ECC_ROOT, 'commands');
const ECC_AGENTS_DIR = path.join(ECC_ROOT, 'agents');

const GLOBAL_OPENCODE_DIR = path.join(HOME, '.config', 'opencode');
const GLOBAL_OPENCODE_SKILLS = path.join(GLOBAL_OPENCODE_DIR, 'skills');
const GLOBAL_OPENCODE_SKILLS_DISABLED = path.join(GLOBAL_OPENCODE_DIR, 'skills-disabled');
const GLOBAL_OPENCODE_COMMANDS = path.join(GLOBAL_OPENCODE_DIR, 'commands');
const GLOBAL_OPENCODE_COMMANDS_DISABLED = path.join(GLOBAL_OPENCODE_DIR, 'commands-disabled');
const GLOBAL_OPENCODE_AGENTS = path.join(GLOBAL_OPENCODE_DIR, 'agents');
const GLOBAL_OPENCODE_AGENTS_DISABLED = path.join(GLOBAL_OPENCODE_DIR, 'agents-disabled');
const GLOBAL_OPENCODE_JSON = path.join(GLOBAL_OPENCODE_DIR, 'opencode.json');

const GLOBAL_AGENTS_SKILLS = path.join(HOME, '.agents', 'skills');
const GLOBAL_AGENTS_SKILLS_DISABLED = path.join(HOME, '.agents', 'skills-disabled');

// ── Classification Rules: Skills ──────────────────────────────────────────────
const MARKETING_SKILLS = new Set([
  'ab-testing', 'ad-creative', 'ads', 'ai-seo', 'analytics', 'aso', 'attribution',
  'churn-prevention', 'co-marketing', 'cold-email', 'community-marketing',
  'competitor-profiling', 'competitors', 'content-strategy', 'conversion-tracking',
  'copy-editing', 'copywriting', 'cro', 'customer-research', 'directory-submissions',
  'emails', 'events', 'free-tools', 'image', 'influencer-marketing', 'launch',
  'lead-magnets', 'link-building', 'marketing-council', 'marketing-ideas',
  'marketing-loops', 'marketing-plan', 'marketing-psychology', 'offers', 'onboarding',
  'paywalls', 'popups', 'pricing', 'product-marketing', 'programmatic-seo',
  'prospecting', 'public-relations', 'referrals', 'reverse-engineer-marketing',
  'revops', 'sales-enablement', 'schema', 'seo-audit', 'signup', 'site-architecture',
  'sms', 'social', 'video'
]);

function classifySkill(id) {
  if (MARKETING_SKILLS.has(id)) {
    return { tier: 2, subTier: '2C', tierLabel: 'T2C:Marketing', category: 'Marketing' };
  }
  if (
    id.startsWith('carrier-') || id.startsWith('customs-') || id.startsWith('inventory-') ||
    id.startsWith('logistics-') || id.startsWith('production-') || id.startsWith('returns-') ||
    id === 'quality-nonconformance' || id === 'energy-procurement' || id === 'retail-merchandising-analytics'
  ) {
    return { tier: 2, subTier: '2B', tierLabel: 'T2B:Logistics', category: 'Logistics' };
  }
  if (
    id.startsWith('flutter') || id.startsWith('dart-') || id.startsWith('kotlin') ||
    id.startsWith('golang') || id.startsWith('android-') || id.startsWith('compose-') ||
    id === 'coil-compose' || id === 'r8-analyzer' || id === 'rxjava-to-coroutines-migration'
  ) {
    return { tier: 2, subTier: '2A', tierLabel: 'T2A:Mobile/Go', category: 'Mobile & Go' };
  }
  if (
    id.startsWith('scientific-') || id.startsWith('nutrient-') ||
    id.startsWith('visa-doc-') || id === 'generating-python-installer'
  ) {
    return { tier: 2, subTier: '2D', tierLabel: 'T2D:Science/Doc', category: 'Science & Doc' };
  }
  if (
    id.startsWith('pytorch-') || id.startsWith('mle-') || id === 'ml-adoption-playbook' ||
    id.startsWith('recsys-') || id.includes('data-scientist') || id.includes('data-engineer') ||
    id === 'statistical-analyst' || id.startsWith('fastapi-')
  ) {
    return { tier: 2, subTier: '2E', tierLabel: 'T2E:Data/ML', category: 'Data & AI' };
  }
  if (
    id.startsWith('cpp-') || id.startsWith('rust-') || id.startsWith('csharp-') ||
    id.startsWith('dotnet-') || id.startsWith('fsharp-') || id.startsWith('java-') ||
    id.startsWith('springboot-') || id.startsWith('quarkus-') || id.startsWith('jpa-') ||
    id.startsWith('mybatis-') || id === 'tinystruct-patterns' || id.startsWith('swift') ||
    id.startsWith('ios-') || id === 'liquid-glass-design' || id === 'apple-hig-expert' ||
    id === 'xcodebuildmcp' || id === 'foundation-models-on-device' || id.startsWith('perl-') ||
    id.startsWith('rails-') || id.startsWith('healthcare-') || id.startsWith('hipaa-') ||
    id.startsWith('cisco-') || id.startsWith('netmiko-') || id.startsWith('network-') ||
    id.startsWith('homelab-') || id.startsWith('ito-') || id.startsWith('prediction-market-') ||
    id.startsWith('defi-') || id.startsWith('evm-') || id.startsWith('llm-trading-') ||
    id === 'nodejs-keccak256' || id === 'agent-payment-x402' || id === 'bengali-nlp' ||
    id === 'gan-style-harness' || id === 'nasiko-control-plane'
  ) {
    return { tier: 3, subTier: '3', tierLabel: 'T3:Disabled', category: 'Niche / Disabled' };
  }

  let cat = 'Fullstack';
  if (id.includes('react') || id.includes('vue') || id.includes('frontend') || id.includes('typography') || id.includes('design') || id.includes('a11y')) {
    cat = 'Frontend';
  } else if (id.includes('mysql') || id.includes('mongo') || id.includes('redis') || id.includes('database')) {
    cat = 'Database';
  } else if (id.includes('backend') || id.includes('api-design')) {
    cat = 'Backend';
  } else if (id.includes('test') || id.includes('tdd') || id.includes('verification') || id.includes('workflow-state')) {
    cat = 'Testing & Quality';
  } else if (id.includes('git') || id.includes('review') || id.includes('rules')) {
    cat = 'Workflow & Git';
  } else if (id.includes('memory') || id.includes('recall') || id.includes('remember') || id.includes('lesson')) {
    cat = 'Agent Memory';
  }
  return { tier: 1, subTier: '1', tierLabel: 'T1:Core', category: cat };
}

// ── Classification Rules: Commands ────────────────────────────────────────────
function classifyCommand(id) {
  if ([
    'plan', 'tdd', 'rules-map', 'rules-add', 'design-build', 'code-review',
    'code-review-quick', 'refactor-clean', 'humanizer', 'typography',
    'commit', 'checkpoint', 'aside', 'deep-research', 'verify'
  ].includes(id)) {
    let cat = 'Core Workflow';
    if (id.includes('plan') || id.includes('blueprint')) cat = 'Planning';
    else if (id.includes('review')) cat = 'Review & Git';
    else if (id.includes('tdd') || id.includes('verify')) cat = 'Testing & Quality';
    else if (id.includes('design') || id.includes('typography')) cat = 'Frontend & Design';
    else if (id.includes('rules')) cat = 'Rules & Governance';
    return { tier: 1, subTier: '1', tierLabel: 'T1:Core', category: cat };
  }

  if (id.startsWith('marketing-') || id === 'ads' || id.startsWith('seo-') || id.startsWith('social-') || id.startsWith('content-')) {
    return { tier: 2, subTier: '2C', tierLabel: 'T2C:Marketing', category: 'Marketing' };
  }
  if (id.startsWith('flutter') || id.startsWith('dart-') || id.startsWith('kotlin') || id.startsWith('golang') || id.startsWith('go-')) {
    return { tier: 2, subTier: '2A', tierLabel: 'T2A:Mobile/Go', category: 'Mobile & Go' };
  }
  if (id.startsWith('data-') || id.startsWith('mle-') || id.startsWith('pytorch-') || id.startsWith('eval-')) {
    return { tier: 2, subTier: '2E', tierLabel: 'T2E:Data/ML', category: 'Data & AI' };
  }
  if (id.startsWith('docker-') || id.startsWith('k8s-') || id.startsWith('deploy-') || id.startsWith('ci-cd-')) {
    return { tier: 2, subTier: '2D', tierLabel: 'T2D:DevOps', category: 'DevOps & Cloud' };
  }

  if (
    id.startsWith('cpp-') || id.startsWith('rust-') || id.startsWith('csharp-') || id.startsWith('dotnet-') ||
    id.startsWith('java-') || id.startsWith('spring-') || id.startsWith('quarkus-') || id.startsWith('rails-') ||
    id.startsWith('laravel-') || id.startsWith('perl-') || id.startsWith('swift-') || id.startsWith('homelab-') ||
    id.startsWith('crypto-') || id.startsWith('solana-') || id.startsWith('ito-') || id.startsWith('fsharp-') ||
    id.startsWith('epic-') || id.startsWith('gan-')
  ) {
    return { tier: 3, subTier: '3', tierLabel: 'T3:Disabled', category: 'Niche / Language' };
  }

  let cat = 'General';
  if (id.includes('test') || id.includes('audit')) cat = 'Testing & Quality';
  else if (id.includes('review') || id.includes('git')) cat = 'Review & Git';
  else if (id.includes('ui-') || id.includes('frontend')) cat = 'Frontend & Design';
  return { tier: 1, subTier: '1', tierLabel: 'T1:Core', category: cat };
}

// ── Classification Rules: Agents ──────────────────────────────────────────────
function classifyAgent(id) {
  if ([
    'build', 'planner', 'architect', 'plan-reviewer', 'code-reviewer', 'tdd-guide',
    'security-reviewer', 'build-error-resolver', 'doc-updater', 'refactor-cleaner',
    'code-simplifier', 'explore', 'intent-gate'
  ].includes(id)) {
    return { tier: 1, subTier: '1', tierLabel: 'T1:Core', category: 'Core Specialist' };
  }

  if ([
    'database-reviewer', 'python-reviewer', 'fastapi-reviewer', 'django-reviewer',
    'react-reviewer', 'vue-reviewer', 'e2e-runner', 'pr-test-analyzer',
    'type-design-analyzer', 'silent-failure-hunter', 'docs-lookup', 'mle-reviewer',
    'rag-pipeline-reviewer'
  ].includes(id)) {
    return { tier: 2, subTier: '2', tierLabel: 'T2:Specialist', category: 'Web & Quality' };
  }

  if ([
    'go-reviewer', 'go-build-resolver', 'kotlin-reviewer', 'kotlin-build-resolver',
    'flutter-reviewer', 'dart-build-resolver'
  ].includes(id)) {
    return { tier: 2, subTier: '2A', tierLabel: 'T2A:Mobile/Go', category: 'Mobile & Go' };
  }

  if (
    id.startsWith('cpp-') || id.startsWith('rust-') || id.startsWith('csharp-') ||
    id.startsWith('java-') || id.startsWith('ruby-') || id.startsWith('swift-') ||
    id.startsWith('php-') || id.startsWith('harmonyos-') || id.startsWith('network-') ||
    id.startsWith('homelab-') || id.startsWith('healthcare-') || id.startsWith('opensource-') ||
    id.startsWith('gan-') || id.startsWith('bengali-') || id.startsWith('fsharp-')
  ) {
    return { tier: 3, subTier: '3', tierLabel: 'T3:Disabled', category: 'Niche / System' };
  }

  return { tier: 2, subTier: '2', tierLabel: 'T2:Specialist', category: 'General Agent' };
}

// ── Unified Component Inventory Manager ───────────────────────────────────────
class ComponentManager {
  constructor(cwd = process.cwd(), initialMode = 'skills') {
    this.cwd = cwd;
    this.isProject = this.detectProject(cwd);
    this.scope = this.isProject ? 'project' : 'global';
    this.mode = initialMode; // 'skills' | 'commands' | 'agents'

    this.items = {
      skills: new Map(),
      commands: new Map(),
      agents: new Map()
    };

    this.loadAll();
  }

  detectProject(dir) {
    if (dir === HOME || dir === path.dirname(HOME)) return false;
    const indicators = ['.git', 'package.json', 'composer.json', '.opencode', 'go.mod', 'pubspec.yaml'];
    for (const ind of indicators) {
      if (fs.existsSync(path.join(dir, ind))) return true;
    }
    return false;
  }

  ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  getProjectDir(type, disabled = false) {
    const sub = disabled ? `${type}-disabled` : type;
    if (type === 'skills') {
      return path.join(this.cwd, '.agents', sub);
    }
    return path.join(this.cwd, '.opencode', sub);
  }

  loadAll() {
    this.loadSkills();
    this.loadCommands();
    this.loadAgents();
    this.refreshActiveStates();
  }

  // ── Load Skills ─────────────────────────────────────────────────────────────
  loadSkills() {
    const map = this.items.skills;
    map.clear();

    const searchRoots = [
      ECC_SKILLS_DIR,
      GLOBAL_OPENCODE_SKILLS,
      GLOBAL_OPENCODE_SKILLS_DISABLED,
      GLOBAL_AGENTS_SKILLS,
      GLOBAL_AGENTS_SKILLS_DISABLED
    ];

    if (this.isProject) {
      searchRoots.push(this.getProjectDir('skills', false));
      searchRoots.push(this.getProjectDir('skills', true));
    }

    for (const root of searchRoots) {
      if (!fs.existsSync(root)) continue;
      try {
        const entries = fs.readdirSync(root);
        for (const entry of entries) {
          if (entry.startsWith('.') || entry.includes('disabled-caveman')) continue;
          const fullPath = path.join(root, entry);
          let stat;
          try { stat = fs.statSync(fullPath); } catch { continue; }
          if (stat.isDirectory()) {
            if (!map.has(entry)) {
              let desc = '';
              const skillMd = path.join(fullPath, 'SKILL.md');
              if (fs.existsSync(skillMd)) {
                try {
                  const content = fs.readFileSync(skillMd, 'utf8').slice(0, 500);
                  const m = content.match(/description:\s*([^\n]+)/i);
                  if (m) desc = m[1].replace(/["']/g, '').trim();
                } catch {}
              }

              const classification = classifySkill(entry);
              map.set(entry, {
                type: 'skill',
                id: entry,
                name: entry,
                sourcePath: fullPath,
                description: desc,
                ...classification
              });
            }
          }
        }
      } catch {}
    }
  }

  // ── Load Commands ───────────────────────────────────────────────────────────
  loadCommands() {
    const map = this.items.commands;
    map.clear();

    const searchRoots = [
      ECC_COMMANDS_DIR,
      GLOBAL_OPENCODE_COMMANDS,
      GLOBAL_OPENCODE_COMMANDS_DISABLED
    ];

    if (this.isProject) {
      searchRoots.push(this.getProjectDir('commands', false));
      searchRoots.push(this.getProjectDir('commands', true));
    }

    for (const root of searchRoots) {
      if (!fs.existsSync(root)) continue;
      try {
        const entries = fs.readdirSync(root);
        for (const entry of entries) {
          if (!entry.endsWith('.md') || entry.startsWith('.')) continue;
          const id = entry.replace(/\.md$/, '');
          if (id.includes('.bak-') || id.includes('.tmp')) continue;
          const fullPath = path.join(root, entry);
          let stat;
          try { stat = fs.statSync(fullPath); } catch { continue; }
          if (stat.isFile()) {
            if (!map.has(id)) {
              let desc = '';
              try {
                const content = fs.readFileSync(fullPath, 'utf8').slice(0, 600);
                const m = content.match(/description:\s*([^\n]+)/i);
                if (m) desc = m[1].replace(/["']/g, '').trim();
                else {
                  const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('---'));
                  if (lines.length > 0) desc = lines[0].slice(0, 100);
                }
              } catch {}

              const classification = classifyCommand(id);
              map.set(id, {
                type: 'command',
                id,
                name: `/${id}`,
                sourcePath: fullPath,
                description: desc,
                ...classification
              });
            }
          }
        }
      } catch {}
    }
  }

  // ── Load Agents ─────────────────────────────────────────────────────────────
  loadAgents() {
    const map = this.items.agents;
    map.clear();

    const searchRoots = [
      ECC_AGENTS_DIR,
      GLOBAL_OPENCODE_AGENTS,
      GLOBAL_OPENCODE_AGENTS_DISABLED
    ];

    if (this.isProject) {
      searchRoots.push(this.getProjectDir('agents', false));
      searchRoots.push(this.getProjectDir('agents', true));
    }

    for (const root of searchRoots) {
      if (!fs.existsSync(root)) continue;
      try {
        const entries = fs.readdirSync(root);
        for (const entry of entries) {
          if (!entry.endsWith('.md') || entry.startsWith('.')) continue;
          const id = entry.replace(/\.md$/, '');
          const fullPath = path.join(root, entry);
          let stat;
          try { stat = fs.statSync(fullPath); } catch { continue; }
          if (stat.isFile()) {
            if (!map.has(id)) {
              let desc = '';
              try {
                const content = fs.readFileSync(fullPath, 'utf8').slice(0, 600);
                const m = content.match(/description:\s*([^\n]+)/i);
                if (m) desc = m[1].replace(/["']/g, '').trim();
              } catch {}

              const classification = classifyAgent(id);
              map.set(id, {
                type: 'agent',
                id,
                name: `@${id}`,
                sourcePath: fullPath,
                description: desc,
                ...classification
              });
            }
          }
        }
      } catch {}
    }

    // Also parse opencode.json for any agents configured there
    if (fs.existsSync(GLOBAL_OPENCODE_JSON)) {
      try {
        const raw = fs.readFileSync(GLOBAL_OPENCODE_JSON, 'utf8');
        const cfg = JSON.parse(raw);
        const agObj = cfg.agent || cfg.agents || {};
        for (const [id, def] of Object.entries(agObj)) {
          if (!map.has(id)) {
            const classification = classifyAgent(id);
            const promptRef = typeof def.prompt === 'string' ? def.prompt : '';
            let src = path.join(GLOBAL_OPENCODE_DIR, 'agents', `${id}.md`);
            if (promptRef.startsWith('{file:') && promptRef.endsWith('}')) {
              src = path.join(GLOBAL_OPENCODE_DIR, promptRef.slice(6, -1));
            }
            map.set(id, {
              type: 'agent',
              id,
              name: `@${id}`,
              sourcePath: src,
              description: def.description || '',
              ...classification
            });
          }
        }
      } catch {}
    }
  }

  // ── Refresh Active States ───────────────────────────────────────────────────
  refreshActiveStates() {
    // 1. Skills
    const projSkillDir = this.isProject ? this.getProjectDir('skills', false) : null;
    for (const [id, item] of this.items.skills.entries()) {
      const inOpencode = fs.existsSync(path.join(GLOBAL_OPENCODE_SKILLS, id));
      const inAgents = fs.existsSync(path.join(GLOBAL_AGENTS_SKILLS, id));
      item.isGlobalActive = inOpencode || inAgents;
      item.isProjectActive = Boolean(projSkillDir && fs.existsSync(path.join(projSkillDir, id)));
    }

    // 2. Commands
    const projCmdDir = this.isProject ? this.getProjectDir('commands', false) : null;
    for (const [id, item] of this.items.commands.entries()) {
      const fileName = `${id}.md`;
      const inGlobal = fs.existsSync(path.join(GLOBAL_OPENCODE_COMMANDS, fileName));
      item.isGlobalActive = inGlobal;
      item.isProjectActive = Boolean(projCmdDir && fs.existsSync(path.join(projCmdDir, fileName)));
    }

    // 3. Agents
    let cfgAgents = {};
    if (fs.existsSync(GLOBAL_OPENCODE_JSON)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(GLOBAL_OPENCODE_JSON, 'utf8'));
        cfgAgents = cfg.agent || cfg.agents || {};
      } catch {}
    }
    const projAgentDir = this.isProject ? this.getProjectDir('agents', false) : null;

    for (const [id, item] of this.items.agents.entries()) {
      const fileName = `${id}.md`;
      const inGlobalDir = fs.existsSync(path.join(GLOBAL_OPENCODE_AGENTS, fileName));
      const inConfig = Boolean(cfgAgents[id]);
      const isConfigDisabled = inConfig && (cfgAgents[id].disable === true || cfgAgents[id].disabled === true);

      // Active globally if in agents/ dir OR (configured in opencode.json AND not disabled)
      item.isGlobalActive = inGlobalDir || (inConfig && !isConfigDisabled);
      item.isProjectActive = Boolean(projAgentDir && fs.existsSync(path.join(projAgentDir, fileName)));
    }
  }

  isActive(item) {
    return this.scope === 'project' ? item.isProjectActive : item.isGlobalActive;
  }

  getCurrentItems() {
    return this.items[this.mode];
  }

  // ── Activation / Deactivation Handlers ───────────────────────────────────────
  toggleItem(id) {
    const map = this.getCurrentItems();
    const item = map.get(id);
    if (!item) return { success: false, message: `Item ${id} not found` };

    if (this.isActive(item)) {
      return this.deactivateItem(item);
    } else {
      return this.activateItem(item);
    }
  }

  activateItem(item) {
    if (item.type === 'skill') return this.activateSkill(item.id);
    if (item.type === 'command') return this.activateCommand(item.id);
    if (item.type === 'agent') return this.activateAgent(item.id);
    return { success: false, message: 'Unknown type' };
  }

  deactivateItem(item) {
    if (item.type === 'skill') return this.deactivateSkill(item.id);
    if (item.type === 'command') return this.deactivateCommand(item.id);
    if (item.type === 'agent') return this.deactivateAgent(item.id);
    return { success: false, message: 'Unknown type' };
  }

  // ── Skill Toggle ────────────────────────────────────────────────────────────
  activateSkill(id) {
    const item = this.items.skills.get(id);
    if (!item) return { success: false, message: `Skill ${id} not found` };

    if (this.scope === 'project') {
      const projDir = this.getProjectDir('skills', false);
      this.ensureDir(projDir);
      const target = path.join(projDir, id);
      if (fs.existsSync(target)) return { success: true, message: `Already active in project` };
      try {
        fs.symlinkSync(item.sourcePath, target, 'dir');
        item.isProjectActive = true;
        return { success: true, message: `[Project] Activated skill: ${id}` };
      } catch (err) {
        return { success: false, message: `Symlink failed: ${err.message}` };
      }
    } else {
      const disOpencode = path.join(GLOBAL_OPENCODE_SKILLS_DISABLED, id);
      const actOpencode = path.join(GLOBAL_OPENCODE_SKILLS, id);
      if (fs.existsSync(disOpencode)) {
        this.ensureDir(GLOBAL_OPENCODE_SKILLS);
        fs.renameSync(disOpencode, actOpencode);
        item.isGlobalActive = true;
        return { success: true, message: `[Global] Restored skill: ${id}` };
      }

      const disAgents = path.join(GLOBAL_AGENTS_SKILLS_DISABLED, id);
      const actAgents = path.join(GLOBAL_AGENTS_SKILLS, id);
      if (fs.existsSync(disAgents)) {
        this.ensureDir(GLOBAL_AGENTS_SKILLS);
        fs.renameSync(disAgents, actAgents);
        item.isGlobalActive = true;
        return { success: true, message: `[Global] Restored skill in ~/.agents: ${id}` };
      }

      this.ensureDir(GLOBAL_OPENCODE_SKILLS);
      if (!fs.existsSync(actOpencode)) {
        try {
          fs.symlinkSync(item.sourcePath, actOpencode, 'dir');
          item.isGlobalActive = true;
          return { success: true, message: `[Global] Symlinked skill: ${id}` };
        } catch (err) {
          return { success: false, message: `Activate failed: ${err.message}` };
        }
      }
      item.isGlobalActive = true;
      return { success: true, message: `Already active` };
    }
  }

  deactivateSkill(id) {
    const item = this.items.skills.get(id);
    if (!item) return { success: false, message: `Skill ${id} not found` };

    if (this.scope === 'project') {
      const projDir = this.getProjectDir('skills', false);
      const target = path.join(projDir, id);
      if (fs.existsSync(target)) {
        try {
          const stat = fs.lstatSync(target);
          if (stat.isSymbolicLink()) fs.unlinkSync(target);
          else fs.rmSync(target, { recursive: true, force: true });
          item.isProjectActive = false;
          return { success: true, message: `[Project] Deactivated skill: ${id}` };
        } catch (err) {
          return { success: false, message: `Deactivate failed: ${err.message}` };
        }
      }
      item.isProjectActive = false;
      return { success: true, message: `Already inactive in project` };
    } else {
      let moved = false;
      const actOpencode = path.join(GLOBAL_OPENCODE_SKILLS, id);
      if (fs.existsSync(actOpencode)) {
        try {
          const stat = fs.lstatSync(actOpencode);
          if (stat.isSymbolicLink()) {
            fs.unlinkSync(actOpencode);
            moved = true;
          } else {
            this.ensureDir(GLOBAL_OPENCODE_SKILLS_DISABLED);
            fs.renameSync(actOpencode, path.join(GLOBAL_OPENCODE_SKILLS_DISABLED, id));
            moved = true;
          }
        } catch (err) {
          return { success: false, message: `Failed deactivating ${id}: ${err.message}` };
        }
      }

      const actAgents = path.join(GLOBAL_AGENTS_SKILLS, id);
      if (fs.existsSync(actAgents)) {
        try {
          const stat = fs.lstatSync(actAgents);
          if (stat.isSymbolicLink()) {
            fs.unlinkSync(actAgents);
            moved = true;
          } else {
            this.ensureDir(GLOBAL_AGENTS_SKILLS_DISABLED);
            fs.renameSync(actAgents, path.join(GLOBAL_AGENTS_SKILLS_DISABLED, id));
            moved = true;
          }
        } catch (err) {
          return { success: false, message: `Failed deactivating ${id}: ${err.message}` };
        }
      }

      item.isGlobalActive = false;
      return { success: true, message: moved ? `[Global] Deactivated skill: ${id}` : `Already inactive` };
    }
  }

  // ── Command Toggle ──────────────────────────────────────────────────────────
  activateCommand(id) {
    const item = this.items.commands.get(id);
    if (!item) return { success: false, message: `Command /${id} not found` };
    const fileName = `${id}.md`;

    if (this.scope === 'project') {
      const projDir = this.getProjectDir('commands', false);
      const disDir = this.getProjectDir('commands', true);
      this.ensureDir(projDir);
      const target = path.join(projDir, fileName);
      const disTarget = path.join(disDir, fileName);

      if (fs.existsSync(disTarget)) {
        fs.renameSync(disTarget, target);
        item.isProjectActive = true;
        return { success: true, message: `[Project] Restored command: /${id}` };
      }
      if (fs.existsSync(target)) return { success: true, message: `Already active in project` };

      try {
        fs.symlinkSync(item.sourcePath, target, 'file');
        item.isProjectActive = true;
        return { success: true, message: `[Project] Activated command: /${id}` };
      } catch (err) {
        return { success: false, message: `Symlink failed: ${err.message}` };
      }
    } else {
      const actPath = path.join(GLOBAL_OPENCODE_COMMANDS, fileName);
      const disPath = path.join(GLOBAL_OPENCODE_COMMANDS_DISABLED, fileName);

      if (fs.existsSync(disPath)) {
        this.ensureDir(GLOBAL_OPENCODE_COMMANDS);
        fs.renameSync(disPath, actPath);
        item.isGlobalActive = true;
        return { success: true, message: `[Global] Restored command: /${id}` };
      }

      this.ensureDir(GLOBAL_OPENCODE_COMMANDS);
      if (!fs.existsSync(actPath)) {
        try {
          fs.symlinkSync(item.sourcePath, actPath, 'file');
          item.isGlobalActive = true;
          return { success: true, message: `[Global] Symlinked command: /${id}` };
        } catch (err) {
          return { success: false, message: `Symlink failed: ${err.message}` };
        }
      }
      item.isGlobalActive = true;
      return { success: true, message: `Already active` };
    }
  }

  deactivateCommand(id) {
    const item = this.items.commands.get(id);
    if (!item) return { success: false, message: `Command /${id} not found` };
    const fileName = `${id}.md`;

    if (this.scope === 'project') {
      const projDir = this.getProjectDir('commands', false);
      const disDir = this.getProjectDir('commands', true);
      const target = path.join(projDir, fileName);

      if (fs.existsSync(target)) {
        try {
          const stat = fs.lstatSync(target);
          if (stat.isSymbolicLink()) {
            fs.unlinkSync(target);
          } else {
            this.ensureDir(disDir);
            fs.renameSync(target, path.join(disDir, fileName));
          }
          item.isProjectActive = false;
          return { success: true, message: `[Project] Deactivated command: /${id}` };
        } catch (err) {
          return { success: false, message: `Deactivate failed: ${err.message}` };
        }
      }
      item.isProjectActive = false;
      return { success: true, message: `Already inactive in project` };
    } else {
      const actPath = path.join(GLOBAL_OPENCODE_COMMANDS, fileName);
      const disPath = path.join(GLOBAL_OPENCODE_COMMANDS_DISABLED, fileName);

      if (fs.existsSync(actPath)) {
        try {
          const stat = fs.lstatSync(actPath);
          if (stat.isSymbolicLink()) {
            fs.unlinkSync(actPath);
          } else {
            this.ensureDir(GLOBAL_OPENCODE_COMMANDS_DISABLED);
            fs.renameSync(actPath, disPath);
          }
          item.isGlobalActive = false;
          return { success: true, message: `[Global] Deactivated command: /${id}` };
        } catch (err) {
          return { success: false, message: `Failed deactivating: ${err.message}` };
        }
      }
      item.isGlobalActive = false;
      return { success: true, message: `Already inactive` };
    }
  }

  // ── Agent Toggle ────────────────────────────────────────────────────────────
  activateAgent(id) {
    const item = this.items.agents.get(id);
    if (!item) return { success: false, message: `Agent @${id} not found` };
    const fileName = `${id}.md`;

    if (this.scope === 'project') {
      const projDir = this.getProjectDir('agents', false);
      const disDir = this.getProjectDir('agents', true);
      this.ensureDir(projDir);
      const target = path.join(projDir, fileName);
      const disTarget = path.join(disDir, fileName);

      if (fs.existsSync(disTarget)) {
        fs.renameSync(disTarget, target);
        item.isProjectActive = true;
        return { success: true, message: `[Project] Restored agent: @${id}` };
      }
      if (fs.existsSync(target)) return { success: true, message: `Already active in project` };

      try {
        fs.symlinkSync(item.sourcePath, target, 'file');
        item.isProjectActive = true;
        return { success: true, message: `[Project] Activated agent: @${id}` };
      } catch (err) {
        return { success: false, message: `Symlink failed: ${err.message}` };
      }
    } else {
      let toggled = false;
      // 1. If configured in opencode.json, un-disable it
      if (fs.existsSync(GLOBAL_OPENCODE_JSON)) {
        try {
          const cfg = JSON.parse(fs.readFileSync(GLOBAL_OPENCODE_JSON, 'utf8'));
          const agObj = cfg.agent || cfg.agents;
          if (agObj && agObj[id]) {
            delete agObj[id].disable;
            delete agObj[id].disabled;
            const tmp = `${GLOBAL_OPENCODE_JSON}.${Date.now()}.tmp`;
            fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
            fs.renameSync(tmp, GLOBAL_OPENCODE_JSON);
            toggled = true;
          }
        } catch {}
      }

      // 2. If in agents-disabled/, restore it
      const actPath = path.join(GLOBAL_OPENCODE_AGENTS, fileName);
      const disPath = path.join(GLOBAL_OPENCODE_AGENTS_DISABLED, fileName);
      if (fs.existsSync(disPath)) {
        this.ensureDir(GLOBAL_OPENCODE_AGENTS);
        fs.renameSync(disPath, actPath);
        toggled = true;
      } else if (!toggled && !fs.existsSync(actPath) && fs.existsSync(item.sourcePath)) {
        this.ensureDir(GLOBAL_OPENCODE_AGENTS);
        try {
          fs.symlinkSync(item.sourcePath, actPath, 'file');
          toggled = true;
        } catch {}
      }

      item.isGlobalActive = true;
      return { success: true, message: toggled ? `[Global] Activated agent: @${id}` : `Already active` };
    }
  }

  deactivateAgent(id) {
    const item = this.items.agents.get(id);
    if (!item) return { success: false, message: `Agent @${id} not found` };
    const fileName = `${id}.md`;

    if (this.scope === 'project') {
      const projDir = this.getProjectDir('agents', false);
      const disDir = this.getProjectDir('agents', true);
      const target = path.join(projDir, fileName);

      if (fs.existsSync(target)) {
        try {
          const stat = fs.lstatSync(target);
          if (stat.isSymbolicLink()) {
            fs.unlinkSync(target);
          } else {
            this.ensureDir(disDir);
            fs.renameSync(target, path.join(disDir, fileName));
          }
          item.isProjectActive = false;
          return { success: true, message: `[Project] Deactivated agent: @${id}` };
        } catch (err) {
          return { success: false, message: `Deactivate failed: ${err.message}` };
        }
      }
      item.isProjectActive = false;
      return { success: true, message: `Already inactive in project` };
    } else {
      let toggled = false;
      // 1. If configured in opencode.json, set disable: true
      if (fs.existsSync(GLOBAL_OPENCODE_JSON)) {
        try {
          const cfg = JSON.parse(fs.readFileSync(GLOBAL_OPENCODE_JSON, 'utf8'));
          const agObj = cfg.agent || cfg.agents;
          if (agObj && agObj[id]) {
            agObj[id].disable = true;
            const tmp = `${GLOBAL_OPENCODE_JSON}.${Date.now()}.tmp`;
            fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
            fs.renameSync(tmp, GLOBAL_OPENCODE_JSON);
            toggled = true;
          }
        } catch {}
      }

      // 2. If file in agents/, move to agents-disabled/
      const actPath = path.join(GLOBAL_OPENCODE_AGENTS, fileName);
      const disPath = path.join(GLOBAL_OPENCODE_AGENTS_DISABLED, fileName);
      if (fs.existsSync(actPath)) {
        try {
          const stat = fs.lstatSync(actPath);
          if (stat.isSymbolicLink()) {
            fs.unlinkSync(actPath);
          } else {
            this.ensureDir(GLOBAL_OPENCODE_AGENTS_DISABLED);
            fs.renameSync(actPath, disPath);
          }
          toggled = true;
        } catch {}
      }

      item.isGlobalActive = false;
      return { success: true, message: toggled ? `[Global] Deactivated agent: @${id}` : `Already inactive` };
    }
  }

  // ── Batch Set Tier ──────────────────────────────────────────────────────────
  batchSetTier(tierNum, activate) {
    const map = this.getCurrentItems();
    let count = 0;
    for (const [id, item] of map.entries()) {
      if (item.tier === tierNum) {
        if (activate && !this.isActive(item)) {
          this.activateItem(item);
          count++;
        } else if (!activate && this.isActive(item)) {
          this.deactivateItem(item);
          count++;
        }
      }
    }
    return count;
  }
}

// ── TUI Renderer & Interactive Event Loop ─────────────────────────────────────
class ComponentTUI {
  constructor(manager) {
    this.mgr = manager;
    this.focusPanel = 'left'; // 'left' = Non-aktif, 'right' = Aktif
    this.selectedIndex = { left: 0, right: 0 };
    this.scrollOffset = { left: 0, right: 0 };
    this.tierFilter = 'ALL';
    this.categoryFilter = 'ALL';
    this.searchQuery = '';
    this.isSearching = false;
    this.statusMessage = 'Gunakan [Enter/Space] untuk toggle card, [i/v] untuk detail, [T/M] ganti mode.';
    this.statusTime = Date.now();

    // Modal Details State
    this.isViewingDetails = false;
    this.modalScrollOffset = 0;
    this.modalLines = [];
    this.modalItem = null;

    // Search Blink Cursor & Mouse State
    this.blinkTimer = null;
    this.cursorVisible = true;
    this.originalStdinEmit = null;
  }

  startBlink() {
    this.stopBlink();
    this.cursorVisible = true;
    this.blinkTimer = setInterval(() => {
      this.cursorVisible = !this.cursorVisible;
      if (this.isSearching) {
        this.render();
      } else {
        this.stopBlink();
      }
    }, 500);
  }

  stopBlink() {
    if (this.blinkTimer) {
      clearInterval(this.blinkTimer);
      this.blinkTimer = null;
    }
    this.cursorVisible = true;
  }

  cycleMode() {
    const modes = ['skills', 'commands', 'agents'];
    const curIdx = modes.indexOf(this.mgr.mode);
    const nextMode = modes[(curIdx + 1) % modes.length];
    this.setMode(nextMode);
  }

  prevMode() {
    const modes = ['skills', 'commands', 'agents'];
    const curIdx = modes.indexOf(this.mgr.mode);
    const nextMode = modes[(curIdx - 1 + modes.length) % modes.length];
    this.setMode(nextMode);
  }

  setMode(mode) {
    if (this.mgr.mode === mode) return;
    this.mgr.mode = mode;
    this.selectedIndex = { left: 0, right: 0 };
    this.scrollOffset = { left: 0, right: 0 };
    this.searchQuery = '';
    this.tierFilter = 'ALL';
    this.categoryFilter = 'ALL';
    this.setStatus(`Beralih ke mode: ${mode.toUpperCase()}`);
    this.render();
  }

  handleMouseData(str) {
    const sgrRegex = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g;
    let match;
    let handled = false;
    while ((match = sgrRegex.exec(str)) !== null) {
      const btn = parseInt(match[1], 10);
      const isRelease = match[4] === 'm';
      if (!isRelease) {
        if (btn === 64) {
          this.handleWheel(-1);
          handled = true;
        } else if (btn === 65) {
          this.handleWheel(1);
          handled = true;
        }
      }
    }
    return handled;
  }

  handleWheel(direction) {
    if (this.isViewingDetails) {
      const scrollSpeed = 5; // 5 lines per mouse wheel scroll
      const rows = process.stdout.rows || 32;
      const innerHeight = Math.max(5, rows - 4);
      const maxScroll = Math.max(0, this.modalLines.length - innerHeight);

      if (direction < 0) {
        this.modalScrollOffset = Math.max(0, this.modalScrollOffset - scrollSpeed);
      } else {
        this.modalScrollOffset = Math.min(maxScroll, this.modalScrollOffset + scrollSpeed);
      }
      this.render();
    } else {
      const lists = this.getFilteredLists();
      const curList = lists[this.focusPanel];
      if (curList.length === 0) return;

      const delta = direction * 3;
      const nextIdx = Math.max(0, Math.min(curList.length - 1, this.selectedIndex[this.focusPanel] + delta));
      if (nextIdx !== this.selectedIndex[this.focusPanel]) {
        this.selectedIndex[this.focusPanel] = nextIdx;
        this.render();
      }
    }
  }

  setStatus(msg) {
    this.statusMessage = msg;
    this.statusTime = Date.now();
    this.render();
  }

  getFilteredLists() {
    const map = this.mgr.getCurrentItems();
    const left = [];
    const right = [];

    const query = this.searchQuery.toLowerCase().trim();

    for (const item of map.values()) {
      if (this.tierFilter !== 'ALL' && String(item.tier) !== this.tierFilter) {
        continue;
      }
      if (this.categoryFilter !== 'ALL' && item.category !== this.categoryFilter) {
        continue;
      }
      if (query) {
        const matchId = item.id.toLowerCase().includes(query);
        const matchDesc = item.description.toLowerCase().includes(query);
        const matchCat = item.category.toLowerCase().includes(query);
        if (!matchId && !matchDesc && !matchCat) continue;
      }

      if (this.mgr.isActive(item)) {
        right.push(item);
      } else {
        left.push(item);
      }
    }

    left.sort((a, b) => a.id.localeCompare(b.id));
    right.sort((a, b) => a.id.localeCompare(b.id));

    return { left, right };
  }

  getCategoriesForCurrentMode() {
    if (this.mgr.mode === 'skills') {
      return ['ALL', 'Frontend', 'Backend', 'Database', 'Mobile & Go', 'Marketing', 'Logistics', 'Science & Doc', 'Data & AI', 'Testing & Quality', 'Agent Memory', 'Niche / Disabled'];
    }
    if (this.mgr.mode === 'commands') {
      return ['ALL', 'Core Workflow', 'Planning', 'Testing & Quality', 'Review & Git', 'Frontend & Design', 'Refactor & Clean', 'Rules & Governance', 'Research & Docs', 'Marketing', 'Mobile & Go', 'DevOps & Cloud', 'Niche / Language'];
    }
    if (this.mgr.mode === 'agents') {
      return ['ALL', 'Core Specialist', 'Web & Quality', 'Mobile & Go', 'Architecture & Plan', 'Build & Resolver', 'Testing & Harness', 'Domain & Specialty', 'Niche / System'];
    }
    return ['ALL'];
  }

  cycleCategory() {
    const cats = this.getCategoriesForCurrentMode();
    const curIdx = cats.indexOf(this.categoryFilter);
    this.categoryFilter = cats[(curIdx + 1) % cats.length];
    this.selectedIndex.left = 0;
    this.selectedIndex.right = 0;
    this.render();
  }

  openItemDetails(item) {
    let filePath = item.sourcePath;
    if (item.type === 'skill') {
      filePath = path.join(item.sourcePath, 'SKILL.md');
    }

    let rawMarkdown = '';
    if (fs.existsSync(filePath)) {
      try {
        rawMarkdown = fs.readFileSync(filePath, 'utf8');
      } catch (err) {
        rawMarkdown = `Error membaca file: ${err.message}`;
      }
    } else {
      rawMarkdown = `# ${item.name}\n\n**Deskripsi:** ${item.description || 'Tidak ada deskripsi'}\n\n*File sumber:* \`${filePath}\` (tidak ditemukan di disk)`;
    }

    const cols = process.stdout.columns || 110;
    const innerWidth = Math.max(20, cols - 4);

    this.modalLines = renderMarkdown(rawMarkdown, innerWidth);
    this.modalItem = item;
    this.modalScrollOffset = 0;
    this.isViewingDetails = true;
    this.render();
  }

  closeItemDetails() {
    this.isViewingDetails = false;
    this.modalItem = null;
    this.modalLines = [];
    this.modalScrollOffset = 0;
    this.render();
  }

  handleKeypress(str, key) {
    if (!key) return;

    if (key.ctrl && key.name === 'c') {
      this.exit();
      return;
    }

    // ── Detail Modal View Active ──────────────────────────────────────────────
    if (this.isViewingDetails) {
      const rows = process.stdout.rows || 32;
      const innerHeight = Math.max(5, rows - 4);
      const maxScroll = Math.max(0, this.modalLines.length - innerHeight);

      if (key.name === 'escape' || key.name === 'q' || str === 'i' || str === 'v') {
        this.closeItemDetails();
      } else if (key.name === 'up' || str === 'k') {
        this.modalScrollOffset = Math.max(0, this.modalScrollOffset - 1);
        this.render();
      } else if (key.name === 'down' || str === 'j') {
        this.modalScrollOffset = Math.min(maxScroll, this.modalScrollOffset + 1);
        this.render();
      } else if (key.name === 'pageup') {
        this.modalScrollOffset = Math.max(0, this.modalScrollOffset - innerHeight);
        this.render();
      } else if (key.name === 'pagedown') {
        this.modalScrollOffset = Math.min(maxScroll, this.modalScrollOffset + innerHeight);
        this.render();
      } else if (str === 'g') {
        this.modalScrollOffset = 0;
        this.render();
      } else if (str === 'G') {
        this.modalScrollOffset = maxScroll;
        this.render();
      } else if (key.name === 'return' || key.name === 'space') {
        if (this.modalItem) {
          const res = this.mgr.toggleItem(this.modalItem.id);
          this.setStatus(res.message);
          this.render();
        }
      }
      return;
    }

    // ── Search Input Mode ─────────────────────────────────────────────────────
    if (this.isSearching) {
      if (key.name === 'escape') {
        this.isSearching = false;
        this.stopBlink();
        this.searchQuery = '';
        this.selectedIndex.left = 0;
        this.selectedIndex.right = 0;
        this.scrollOffset.left = 0;
        this.scrollOffset.right = 0;
        this.render();
        return;
      }
      if (key.name === 'return') {
        this.isSearching = false;
        this.stopBlink();
        this.selectedIndex.left = 0;
        this.selectedIndex.right = 0;
        this.render();
        return;
      }
      if (key.name === 'backspace') {
        this.searchQuery = this.searchQuery.slice(0, -1);
      } else if (str && str.length === 1 && !key.ctrl && !key.meta) {
        this.searchQuery += str;
      }
      this.selectedIndex.left = 0;
      this.selectedIndex.right = 0;
      this.scrollOffset.left = 0;
      this.scrollOffset.right = 0;
      this.render();
      return;
    }

    // ── Normal Card Navigation ────────────────────────────────────────────────
    const lists = this.getFilteredLists();
    const curList = lists[this.focusPanel];

    if (key.name === 'q' || (key.name === 'escape' && !this.searchQuery)) {
      this.exit();
    } else if (key.name === 'escape' && this.searchQuery) {
      this.searchQuery = '';
      this.selectedIndex.left = 0;
      this.selectedIndex.right = 0;
      this.scrollOffset.left = 0;
      this.scrollOffset.right = 0;
      this.render();
    } else if (key.name === 'tab' || key.name === 'left' || key.name === 'right') {
      this.focusPanel = this.focusPanel === 'left' ? 'right' : 'left';
      this.render();
    } else if (key.name === 'up' || str === 'k') {
      if (this.selectedIndex[this.focusPanel] > 0) {
        this.selectedIndex[this.focusPanel]--;
        this.render();
      }
    } else if (key.name === 'down' || str === 'j') {
      if (this.selectedIndex[this.focusPanel] < curList.length - 1) {
        this.selectedIndex[this.focusPanel]++;
        this.render();
      }
    } else if (key.name === 'pageup') {
      this.selectedIndex[this.focusPanel] = Math.max(0, this.selectedIndex[this.focusPanel] - 10);
      this.render();
    } else if (key.name === 'pagedown') {
      this.selectedIndex[this.focusPanel] = Math.min(curList.length - 1, this.selectedIndex[this.focusPanel] + 10);
      this.render();
    } else if (str === 't' || str === 'T' || str === 'm' || str === 'M') {
      this.cycleMode();
    } else if (str === '[') {
      this.prevMode();
    } else if (str === ']') {
      this.cycleMode();
    } else if (str === 'i' || str === 'v' || str === 'I' || str === 'V') {
      if (curList.length > 0) {
        const item = curList[this.selectedIndex[this.focusPanel]];
        if (item) this.openItemDetails(item);
      }
    } else if (key.name === 'return' || key.name === 'space') {
      if (curList.length > 0) {
        const item = curList[this.selectedIndex[this.focusPanel]];
        if (item) {
          const res = this.mgr.toggleItem(item.id);
          this.setStatus(res.message);
          const newLists = this.getFilteredLists();
          const nextLen = newLists[this.focusPanel].length;
          if (this.selectedIndex[this.focusPanel] >= nextLen && nextLen > 0) {
            this.selectedIndex[this.focusPanel] = nextLen - 1;
          }
        }
      }
    } else if (str === '/') {
      this.isSearching = true;
      this.startBlink();
      this.render();
    } else if (str === 's' || str === 'S') {
      this.mgr.scope = this.mgr.scope === 'global' ? 'project' : 'global';
      this.mgr.refreshActiveStates();
      this.selectedIndex.left = 0;
      this.selectedIndex.right = 0;
      this.setStatus(`Scope diganti ke: ${this.mgr.scope.toUpperCase()}`);
    } else if (str === '1') {
      this.tierFilter = this.tierFilter === '1' ? 'ALL' : '1';
      this.selectedIndex.left = 0;
      this.selectedIndex.right = 0;
      this.render();
    } else if (str === '2') {
      this.tierFilter = this.tierFilter === '2' ? 'ALL' : '2';
      this.selectedIndex.left = 0;
      this.selectedIndex.right = 0;
      this.render();
    } else if (str === '3') {
      this.tierFilter = this.tierFilter === '3' ? 'ALL' : '3';
      this.selectedIndex.left = 0;
      this.selectedIndex.right = 0;
      this.render();
    } else if (str === '0' || str === '*') {
      this.tierFilter = 'ALL';
      this.categoryFilter = 'ALL';
      this.searchQuery = '';
      this.selectedIndex.left = 0;
      this.selectedIndex.right = 0;
      this.render();
    } else if (str === 'c' || str === 'C') {
      this.cycleCategory();
    } else if (str === 'a' || str === 'A') {
      const leftItems = lists.left;
      let count = 0;
      for (const item of leftItems) {
        this.mgr.activateItem(item);
        count++;
      }
      this.setStatus(`[OK] Diaktifkan ${count} ${this.mgr.mode} yang sedang difilter.`);
    } else if (str === 'd' || str === 'D') {
      const rightItems = lists.right;
      let count = 0;
      for (const item of rightItems) {
        this.mgr.deactivateItem(item);
        count++;
      }
      this.setStatus(`[OK] Dinonaktifkan ${count} ${this.mgr.mode} yang sedang difilter.`);
    }
  }

  render() {
    const cols = process.stdout.columns || 110;
    const rows = process.stdout.rows || 32;

    const lists = this.getFilteredLists();

    const emitLine = (line) => {
      const truncated = visibleLength(line) > cols - 1 ? truncateAnsi(line, cols - 2).text : line;
      return truncated + '\x1b[K\n';
    };

    let buf = '\x1b[H'; // Cursor to top-left

    // Color definitions
    const C_RESET = '\x1b[0m';
    const C_BOLD = '\x1b[1m';
    const C_DIM = '\x1b[2m';
    const C_CYAN = '\x1b[36m';
    const C_GREEN = '\x1b[32m';
    const C_YELLOW = '\x1b[33m';
    const C_MAGENTA = '\x1b[35m';
    const C_GRAY = '\x1b[90m';
    const C_WHITE = '\x1b[37m';
    const C_BG_SEL = '\x1b[48;5;238m';
    const C_BG_SEL_ACTIVE = '\x1b[48;5;24m';
    const C_BG_TAB_ACTIVE = '\x1b[48;5;24m\x1b[37m\x1b[1m';

    // ── 1. Top Header ─────────────────────────────────────────────────────────
    const scopeLabel = this.mgr.scope === 'global'
      ? `${C_YELLOW}${C_BOLD}[GLOBAL]${C_RESET} (~/.config/opencode)`
      : `${C_GREEN}${C_BOLD}[PROJECT]${C_RESET} (${path.basename(this.mgr.cwd)})`;

    let headerLine = `${C_CYAN}${C_BOLD}=== ECC-OPL COMPONENT MANAGER ===${C_RESET}  Scope: ${scopeLabel}  ${C_GRAY}(Tekan [S] toggle Scope)${C_RESET}`;
    if (cols < 95) {
      headerLine = `${C_CYAN}${C_BOLD}=== ECC-OPL COMPONENT MANAGER ===${C_RESET}  Scope: ${scopeLabel}`;
    }
    buf += emitLine(headerLine);

    // ── Mode Tab Bar (Skills | Commands | Agents) ──────────────────────────────
    const counts = {
      skills: { active: 0, total: this.mgr.items.skills.size },
      commands: { active: 0, total: this.mgr.items.commands.size },
      agents: { active: 0, total: this.mgr.items.agents.size }
    };
    for (const s of this.mgr.items.skills.values()) if (this.mgr.isActive(s)) counts.skills.active++;
    for (const c of this.mgr.items.commands.values()) if (this.mgr.isActive(c)) counts.commands.active++;
    for (const a of this.mgr.items.agents.values()) if (this.mgr.isActive(a)) counts.agents.active++;

    const tabSkills = this.mgr.mode === 'skills'
      ? `${C_BG_TAB_ACTIVE} [1. SKILLS (${counts.skills.active}/${counts.skills.total})] ${C_RESET}`
      : `${C_GRAY}[1. SKILLS (${counts.skills.active}/${counts.skills.total})]${C_RESET}`;

    const tabCommands = this.mgr.mode === 'commands'
      ? `${C_BG_TAB_ACTIVE} [2. COMMANDS (${counts.commands.active}/${counts.commands.total})] ${C_RESET}`
      : `${C_GRAY}[2. COMMANDS (${counts.commands.active}/${counts.commands.total})]${C_RESET}`;

    const tabAgents = this.mgr.mode === 'agents'
      ? `${C_BG_TAB_ACTIVE} [3. AGENTS (${counts.agents.active}/${counts.agents.total})] ${C_RESET}`
      : `${C_GRAY}[3. AGENTS (${counts.agents.active}/${counts.agents.total})]${C_RESET}`;

    const modeLine = `TAB: ${tabSkills}  ${tabCommands}  ${tabAgents}  ${C_DIM}[T/M: Ganti Tab]${C_RESET}`;
    buf += emitLine(modeLine);
    
    // Filters line
    const tierStatus = `Tier: ${C_BOLD}${this.tierFilter}${C_RESET} ${C_GRAY}[1/2/3/0]${C_RESET}`;
    const catStatus = `Kategori: ${C_BOLD}${this.categoryFilter}${C_RESET} ${C_GRAY}[C]${C_RESET}`;
    let searchStatus = '';
    if (this.isSearching) {
      const cursorChar = this.cursorVisible ? `${C_CYAN}█${C_RESET}` : ' ';
      searchStatus = `${C_CYAN}${C_BOLD}Cari:${C_RESET} ${C_BOLD}${this.searchQuery}${C_RESET}${cursorChar}`;
    } else if (this.searchQuery) {
      searchStatus = `${C_BOLD}Cari:${C_RESET} ${C_BOLD}${this.searchQuery}${C_RESET} ${C_GRAY}[/ ubah, Esc reset]${C_RESET}`;
    } else {
      searchStatus = `${C_GRAY}Cari: none [/]${C_RESET}`;
    }

    buf += emitLine(`Filter: ${tierStatus} │ ${catStatus} │ ${searchStatus}`);

    // ── 2. Modal Overlay View (Fullscreen) ────────────────────────────────────
    if (this.isViewingDetails && this.modalItem) {
      const innerWidth = Math.max(20, cols - 4);
      const innerHeight = Math.max(5, rows - 4);
      const maxScroll = Math.max(0, this.modalLines.length - innerHeight);

      const isAct = this.mgr.isActive(this.modalItem);
      const actBadge = isAct ? `${C_GREEN}${C_BOLD}[STATUS: AKTIF]${C_RESET}` : `${C_MAGENTA}${C_BOLD}[STATUS: NON-AKTIF]${C_RESET}`;
      
      const typeLabel = this.modalItem.type.toUpperCase();
      const titleText = ` DETAIL ${typeLabel}: ${this.modalItem.name} (${this.modalItem.tierLabel}) `;
      const titleLen = visibleLength(titleText);
      const topBarLen = Math.max(0, cols - titleLen - 3);
      
      buf = '\x1b[H\x1b[2J'; // Clear screen completely so nothing from cards leaks through
      buf += `${C_CYAN}${C_BOLD}┌─${titleText}${'─'.repeat(topBarLen)}┐${C_RESET}\n`;
      
      // Modal Sub-header
      const subHeader = `${actBadge}  ${C_DIM}Tekan [Enter/Space]: Toggle On/Off  │  [Esc/q]: Tutup modal${C_RESET}`;
      buf += `${C_CYAN}│${C_RESET} ${padAnsi(subHeader, innerWidth)} ${C_CYAN}│${C_RESET}\n`;
      buf += `${C_CYAN}├${'─'.repeat(cols - 2)}┤${C_RESET}\n`;

      // Modal Body Lines
      for (let r = 0; r < innerHeight; r++) {
        const lineIdx = this.modalScrollOffset + r;
        const rawL = lineIdx < this.modalLines.length ? this.modalLines[lineIdx] : '';
        buf += `${C_CYAN}│${C_RESET} ${padAnsi(rawL, innerWidth)} ${C_CYAN}│${C_RESET}\n`;
      }

      // Modal Footer
      const pct = maxScroll === 0 ? 100 : Math.round((this.modalScrollOffset / maxScroll) * 100);
      const scrollInfo = ` Baris ${this.modalScrollOffset + 1}-${Math.min(this.modalScrollOffset + innerHeight, this.modalLines.length)}/${this.modalLines.length} (${pct}%) │ [↑/↓/PgUp/PgDn/Mouse] `;
      const footLen = Math.max(0, cols - visibleLength(scrollInfo) - 3);
      buf += `${C_CYAN}${C_BOLD}└─${scrollInfo}${'─'.repeat(footLen)}┘${C_RESET}`;

      process.stdout.write(buf);
      return;
    }

    // ── 3. Dual Card Layout ───────────────────────────────────────────────────
    const cardGap = 2;
    const cardWidth = Math.floor((cols - 3 - cardGap) / 2);
    const visibleCards = Math.max(5, rows - 9);

    const leftTitle = `NON-AKTIF / LIBRARY (${lists.left.length})`;
    const rightTitle = `AKTIF (${lists.right.length})`;

    const isLeftFocus = this.focusPanel === 'left';
    const leftBorderColor = isLeftFocus ? `${C_CYAN}${C_BOLD}` : C_GRAY;
    const rightBorderColor = !isLeftFocus ? `${C_GREEN}${C_BOLD}` : C_GRAY;

    // Card Top Borders
    const lTopLen = Math.max(0, cardWidth - visibleLength(leftTitle) - 3);
    const rTopLen = Math.max(0, cardWidth - visibleLength(rightTitle) - 3);

    const cardTop = `${leftBorderColor}┌─ ${C_BOLD}${leftTitle}${C_RESET}${leftBorderColor} ${'─'.repeat(lTopLen)}┐${C_RESET}` +
                    ' '.repeat(cardGap) +
                    `${rightBorderColor}┌─ ${C_BOLD}${rightTitle}${C_RESET}${rightBorderColor} ${'─'.repeat(rTopLen)}┐${C_RESET}`;
    buf += emitLine(cardTop);

    // Adjust scroll offsets
    for (const p of ['left', 'right']) {
      const list = lists[p];
      let sel = this.selectedIndex[p];
      if (sel >= list.length) {
        sel = Math.max(0, list.length - 1);
        this.selectedIndex[p] = sel;
      }
      let offset = this.scrollOffset[p];
      if (sel < offset) {
        offset = sel;
      } else if (sel >= offset + visibleCards) {
        offset = sel - visibleCards + 1;
      }
      this.scrollOffset[p] = Math.max(0, offset);
    }

    // Render Card Rows
    for (let r = 0; r < visibleCards; r++) {
      const renderItemCell = (panel, isFocus) => {
        const list = lists[panel];
        const idx = this.scrollOffset[panel] + r;
        const innerW = cardWidth - 2;

        if (idx >= list.length) {
          return ' '.repeat(innerW);
        }

        const item = list[idx];
        const isSel = isFocus && idx === this.selectedIndex[panel];

        let tierColor = C_GRAY;
        if (item.tier === 1) tierColor = C_CYAN;
        else if (item.tier === 2) tierColor = C_YELLOW;
        else if (item.tier === 3) tierColor = C_MAGENTA;

        const tierBadge = `${tierColor}[${item.tierLabel}]${C_RESET}`;
        const prefix = isSel ? '► ' : '  ';
        const rawPrefixLen = 2 + visibleLength(`[${item.tierLabel}] `);
        const maxNameLen = Math.max(5, innerW - rawPrefixLen);

        let nameStr = item.name || item.id;
        if (visibleLength(nameStr) > maxNameLen) {
          nameStr = truncateAnsi(nameStr, maxNameLen - 1).text + '…';
        }

        let lineText = '';
        if (isSel) {
          const bg = isFocus && panel === 'right' ? C_BG_SEL_ACTIVE : C_BG_SEL;
          const content = `${prefix}${tierBadge} ${C_BOLD}${C_WHITE}${nameStr}${C_RESET}`;
          lineText = bg + padAnsi(content, innerW) + C_RESET;
        } else {
          const content = `${prefix}${tierBadge} ${nameStr}`;
          lineText = padAnsi(content, innerW);
        }
        return lineText;
      };

      const leftCell = renderItemCell('left', isLeftFocus);
      const rightCell = renderItemCell('right', !isLeftFocus);

      const rowLine = `${leftBorderColor}│${C_RESET}${leftCell}${leftBorderColor}│${C_RESET}` +
                      ' '.repeat(cardGap) +
                      `${rightBorderColor}│${C_RESET}${rightCell}${rightBorderColor}│${C_RESET}`;
      buf += emitLine(rowLine);
    }

    // Card Bottom Borders
    const lPct = lists.left.length ? Math.round(((this.selectedIndex.left + 1) / lists.left.length) * 100) : 100;
    const rPct = lists.right.length ? Math.round(((this.selectedIndex.right + 1) / lists.right.length) * 100) : 100;

    const lBottomText = lists.left.length ? `[${this.selectedIndex.left + 1}/${lists.left.length} (${lPct}%)]` : `[Kosong]`;
    const rBottomText = lists.right.length ? `[${this.selectedIndex.right + 1}/${lists.right.length} (${rPct}%)]` : `[Kosong]`;

    const lBotLen = Math.max(0, cardWidth - visibleLength(lBottomText) - 3);
    const rBotLen = Math.max(0, cardWidth - visibleLength(rBottomText) - 3);

    const cardBot = `${leftBorderColor}└─ ${lBottomText} ${'─'.repeat(lBotLen)}┘${C_RESET}` +
                    ' '.repeat(cardGap) +
                    `${rightBorderColor}└─ ${rBottomText} ${'─'.repeat(rBotLen)}┘${C_RESET}`;
    buf += emitLine(cardBot);

    // ── 4. Selected Item Description ──────────────────────────────────────────
    const curFocusList = lists[this.focusPanel];
    const selItem = curFocusList.length > 0 ? curFocusList[this.selectedIndex[this.focusPanel]] : null;
    let descLine = `${C_GRAY}Deskripsi: -${C_RESET}`;
    if (selItem) {
      const typeTag = selItem.type.toUpperCase();
      const prefixText = `[${typeTag}: ${selItem.name}] [${selItem.category}] `;
      const availWidth = Math.max(10, cols - visibleLength(prefixText) - 2);
      const rawDesc = selItem.description || '(Tidak ada deskripsi)';
      const safeDesc = visibleLength(rawDesc) > availWidth ? truncateAnsi(rawDesc, availWidth - 1).text + '…' : rawDesc;
      descLine = `${C_BOLD}${C_CYAN}[${typeTag}: ${selItem.name}]${C_RESET} ${C_DIM}[${selItem.category}]${C_RESET} ${safeDesc}`;
    }
    buf += emitLine(descLine);

    // ── 5. Status Line ────────────────────────────────────────────────────────
    buf += emitLine(`${C_YELLOW}${this.statusMessage}${C_RESET}`);

    // ── 6. Responsive Footer Help Bar ─────────────────────────────────────────
    let footerBar = '';
    if (cols >= 115) {
      footerBar = `${C_DIM}[Enter/Space Toggle] [i/v Detail] [Tab/←/→ Card] [T/M Mode] [S Scope] [1-3 Tier] [C Kategori] [/ Cari] [A/D Batch] [q Keluar]${C_RESET}`;
    } else if (cols >= 85) {
      footerBar = `${C_DIM}[Enter Toggle] [i Detail] [Tab Card] [T Mode] [S Scope] [1-3 Tier] [C Kat] [/ Cari] [q Keluar]${C_RESET}`;
    } else {
      footerBar = `${C_DIM}[Enter] Toggle  [i] Detail  [T] Mode  [Tab] Card  [/] Cari  [q] Keluar${C_RESET}`;
    }
    buf += emitLine(footerBar);

    // Clear any leftover rows at the bottom of the screen
    buf += '\x1b[K\x1b[J';

    process.stdout.write(buf);
  }

  start() {
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    // Enable mouse reporting (SGR mode)
    process.stdout.write('\x1b[?1000h\x1b[?1006h');

    // Intercept mouse data events before readline parses them as keypresses
    this.originalStdinEmit = process.stdin.emit;
    const self = this;
    process.stdin.emit = function (type, ...args) {
      if (type === 'data') {
        const chunk = args[0];
        const str = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
        if (str.includes('\x1b[<')) {
          const handled = self.handleMouseData(str);
          if (handled) return true;
        }
      }
      return self.originalStdinEmit.apply(this, [type, ...args]);
    };

    process.stdin.on('keypress', (str, key) => {
      this.handleKeypress(str, key);
    });

    process.stdout.on('resize', () => {
      this.render();
    });

    // Enter alternative screen buffer & hide cursor
    process.stdout.write('\x1b[?1049h\x1b[?25l');

    this.render();
  }

  exit() {
    this.stopBlink();
    // Disable mouse reporting
    process.stdout.write('\x1b[?1000l\x1b[?1006l');

    // Restore original stdin emit
    if (this.originalStdinEmit) {
      process.stdin.emit = this.originalStdinEmit;
      this.originalStdinEmit = null;
    }

    // Show cursor & leave alternative screen buffer
    process.stdout.write('\x1b[?25h\x1b[?1049l');
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.exit(0);
  }
}

// ── CLI / Headless Runner ─────────────────────────────────────────────────────
function runCli() {
  const args = process.argv.slice(2);
  let mode = 'skills';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mode' && args[i + 1]) {
      mode = args[i + 1].toLowerCase();
    }
  }

  const mgr = new ComponentManager(process.cwd(), mode);

  if (args.includes('--status')) {
    console.log(`\n=== ECC-OPL COMPONENT MANAGER STATUS ===`);
    console.log(`Scope: [${mgr.scope.toUpperCase()}] (${mgr.scope === 'global' ? '~/.config/opencode' : mgr.cwd})`);
    
    for (const m of ['skills', 'commands', 'agents']) {
      mgr.mode = m;
      const items = mgr.getCurrentItems();
      let active = 0;
      let t1 = 0, t2 = 0, t3 = 0;
      let t1Act = 0, t2Act = 0, t3Act = 0;

      for (const item of items.values()) {
        const act = mgr.isActive(item);
        if (act) active++;
        if (item.tier === 1) { t1++; if (act) t1Act++; }
        else if (item.tier === 2) { t2++; if (act) t2Act++; }
        else if (item.tier === 3) { t3++; if (act) t3Act++; }
      }

      console.log(`\n${m.toUpperCase()} (${active}/${items.size} Aktif):`);
      console.log(`  Tier 1 (Core):       ${t1Act}/${t1} aktif`);
      console.log(`  Tier 2 (On-Demand):  ${t2Act}/${t2} aktif`);
      console.log(`  Tier 3 (Disabled):   ${t3Act}/${t3} aktif`);
    }
    console.log('');
    process.exit(0);
  }

  if (args.includes('--view')) {
    const idx = args.indexOf('--view');
    const id = args[idx + 1];
    if (!id) {
      console.error('Error: Masukkan ID (contoh: ecc-skills --view tdd-workflow)');
      process.exit(1);
    }

    // Search in current mode or auto-detect
    let item = mgr.getCurrentItems().get(id);
    if (!item) {
      for (const m of ['skills', 'commands', 'agents']) {
        if (mgr.items[m].has(id)) {
          item = mgr.items[m].get(id);
          break;
        }
      }
    }

    if (!item) {
      console.error(`Error: Komponen "${id}" tidak ditemukan.`);
      process.exit(1);
    }

    let filePath = item.sourcePath;
    if (item.type === 'skill') {
      filePath = path.join(item.sourcePath, 'SKILL.md');
    }
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = renderMarkdown(content, Math.min(100, (process.stdout.columns || 90) - 2));
      console.log(`\n${lines.join('\n')}\n`);
    } else {
      console.log(`\n# ${item.name}\nDeskripsi: ${item.description}\nFile tidak ditemukan: ${filePath}\n`);
    }
    process.exit(0);
  }

  if (args.includes('--enable')) {
    const idx = args.indexOf('--enable');
    const id = args[idx + 1];
    let item = mgr.getCurrentItems().get(id);
    if (!item) {
      for (const m of ['skills', 'commands', 'agents']) {
        if (mgr.items[m].has(id)) {
          mgr.mode = m;
          item = mgr.items[m].get(id);
          break;
        }
      }
    }
    if (!item) {
      console.error(`Error: Komponen "${id}" tidak ditemukan.`);
      process.exit(1);
    }
    const res = mgr.activateItem(item);
    console.log(res.message);
    process.exit(res.success ? 0 : 1);
  }

  if (args.includes('--disable')) {
    const idx = args.indexOf('--disable');
    const id = args[idx + 1];
    let item = mgr.getCurrentItems().get(id);
    if (!item) {
      for (const m of ['skills', 'commands', 'agents']) {
        if (mgr.items[m].has(id)) {
          mgr.mode = m;
          item = mgr.items[m].get(id);
          break;
        }
      }
    }
    if (!item) {
      console.error(`Error: Komponen "${id}" tidak ditemukan.`);
      process.exit(1);
    }
    const res = mgr.deactivateItem(item);
    console.log(res.message);
    process.exit(res.success ? 0 : 1);
  }

  if (args.includes('--disable-t3') || args.includes('--disable-tier')) {
    let t = 3;
    const idx = args.indexOf('--disable-tier');
    if (idx !== -1 && args[idx + 1]) t = parseInt(args[idx + 1], 10);
    const count = mgr.batchSetTier(t, false);
    console.log(`[OK] Dinonaktifkan ${count} ${mgr.mode} Tier ${t}.`);
    process.exit(0);
  }

  if (args.includes('--enable-t1') || args.includes('--enable-tier')) {
    let t = 1;
    const idx = args.indexOf('--enable-tier');
    if (idx !== -1 && args[idx + 1]) t = parseInt(args[idx + 1], 10);
    const count = mgr.batchSetTier(t, true);
    console.log(`[OK] Diaktifkan ${count} ${mgr.mode} Tier ${t}.`);
    process.exit(0);
  }

  // Interactive Mode
  const tui = new ComponentTUI(mgr);
  tui.start();
}

if (require.main === module) {
  runCli();
}

module.exports = {
  ComponentManager,
  classifySkill,
  classifyCommand,
  classifyAgent
};
