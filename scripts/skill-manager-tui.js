#!/usr/bin/env node
'use strict';

/**
 * ECC-OPL Skill Manager TUI
 * 
 * Interactive dual-card TUI to manage OpenCode/ECC skills:
 * - Card Kiri: NON-AKTIF (Library / Available / Disabled)
 * - Card Kanan: AKTIF (Enabled in current scope)
 * - Press [Enter] to move selected skill between cards (toggle on/off)
 * - Press [i] or [v] to view full SKILL.md rendered in a scrollable popup modal
 * - Filter by Tier (1, 2, 3) or Category
 * - Scope: Global (~/.config/opencode) or Project (<cwd>)
 *
 * Usage:
 *   node scripts/skill-manager-tui.js              # Launch interactive TUI
 *   node scripts/skill-manager-tui.js --status     # Print summary
 *   node scripts/skill-manager-tui.js --disable-t3 # Batch disable Tier 3
 */

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const os = require('node:os');
const { renderMarkdown, stripAnsi, visibleLength, padAnsi, truncateAnsi } = require('./lib/terminal-markdown');

// ── Paths Configuration ───────────────────────────────────────────────────────
const HOME = os.homedir();
const ECC_SKILLS_DIR = process.env.ECC_ROOT
  ? path.join(process.env.ECC_ROOT, 'skills')
  : path.resolve(__dirname, '..', 'skills');

const GLOBAL_OPENCODE_SKILLS = path.join(HOME, '.config', 'opencode', 'skills');
const GLOBAL_OPENCODE_DISABLED = path.join(HOME, '.config', 'opencode', 'skills-disabled');
const GLOBAL_AGENTS_SKILLS = path.join(HOME, '.agents', 'skills');
const GLOBAL_AGENTS_DISABLED = path.join(HOME, '.agents', 'skills-disabled');

// ── Tier & Category Classification Rules ──────────────────────────────────────
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
  // Tier 2C: Marketing
  if (MARKETING_SKILLS.has(id)) {
    return { tier: 2, subTier: '2C', tierLabel: 'T2C:Marketing', category: 'Marketing' };
  }

  // Tier 2B: Logistics & Merchandising
  if (
    id.startsWith('carrier-') || id.startsWith('customs-') || id.startsWith('inventory-') ||
    id.startsWith('logistics-') || id.startsWith('production-') || id.startsWith('returns-') ||
    id === 'quality-nonconformance' || id === 'energy-procurement' || id === 'retail-merchandising-analytics'
  ) {
    return { tier: 2, subTier: '2B', tierLabel: 'T2B:Logistics', category: 'Logistics' };
  }

  // Tier 2A: Mobile & Go
  if (
    id.startsWith('flutter') || id.startsWith('dart-') || id.startsWith('kotlin') ||
    id.startsWith('golang') || id.startsWith('android-') || id.startsWith('compose-') ||
    id === 'coil-compose' || id === 'r8-analyzer' || id === 'rxjava-to-coroutines-migration'
  ) {
    return { tier: 2, subTier: '2A', tierLabel: 'T2A:Mobile/Go', category: 'Mobile & Go' };
  }

  // Tier 2D: Science, Patent & Document Tools
  if (
    id.startsWith('scientific-') || id.startsWith('nutrient-') ||
    id.startsWith('visa-doc-') || id === 'generating-python-installer'
  ) {
    return { tier: 2, subTier: '2D', tierLabel: 'T2D:Science/Doc', category: 'Science & Doc' };
  }

  // Tier 2E: Heavy Data & AI
  if (
    id.startsWith('pytorch-') || id.startsWith('mle-') || id === 'ml-adoption-playbook' ||
    id.startsWith('recsys-') || id.includes('data-scientist') || id.includes('data-engineer') ||
    id === 'statistical-analyst' || id.startsWith('fastapi-')
  ) {
    return { tier: 2, subTier: '2E', tierLabel: 'T2E:Data/ML', category: 'Data & AI' };
  }

  // Tier 3: Niche / Disabled Candidates
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

  // Tier 1: Core Web, Fullstack, Architecture, TDD
  let cat = 'Fullstack';
  if (id.includes('react') || id.includes('vue') || id.includes('frontend') || id.includes('typography') || id.includes('design') || id.includes('a11y')) {
    cat = 'Frontend';
  } else if (id.includes('mysql') || id.includes('mongo') || id.includes('redis') || id.includes('database')) {
    cat = 'Database';
  } else if (id.includes('backend') || id.includes('api-design')) {
    cat = 'Backend';
  } else if (id.includes('test') || id.includes('tdd') || id.includes('verification')) {
    cat = 'Testing & Quality';
  } else if (id.includes('git') || id.includes('review') || id.includes('rules')) {
    cat = 'Workflow & Git';
  } else if (id.includes('memory') || id.includes('recall') || id.includes('remember') || id.includes('lesson')) {
    cat = 'Agent Memory';
  }

  return { tier: 1, subTier: '1', tierLabel: 'T1:Core', category: cat };
}

// ── Discovery & Inventory Manager ─────────────────────────────────────────────
class SkillManager {
  constructor(cwd = process.cwd()) {
    this.cwd = cwd;
    this.isProject = this.detectProject(cwd);
    this.scope = this.isProject ? 'project' : 'global';
    this.skills = new Map();
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

  getProjectSkillsDir() {
    return path.join(this.cwd, '.agents', 'skills');
  }

  loadAll() {
    this.skills.clear();

    const searchRoots = [
      ECC_SKILLS_DIR,
      GLOBAL_OPENCODE_SKILLS,
      GLOBAL_OPENCODE_DISABLED,
      GLOBAL_AGENTS_SKILLS,
      GLOBAL_AGENTS_DISABLED
    ];

    if (this.isProject) {
      searchRoots.push(this.getProjectSkillsDir());
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
            if (!this.skills.has(entry)) {
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
              this.skills.set(entry, {
                id: entry,
                name: entry,
                sourceDir: fullPath,
                description: desc,
                ...classification
              });
            }
          }
        }
      } catch {}
    }

    this.refreshActiveStates();
  }

  refreshActiveStates() {
    const projDir = this.isProject ? this.getProjectSkillsDir() : null;

    for (const [id, skill] of this.skills.entries()) {
      const inOpencode = fs.existsSync(path.join(GLOBAL_OPENCODE_SKILLS, id));
      const inAgents = fs.existsSync(path.join(GLOBAL_AGENTS_SKILLS, id));
      skill.isGlobalActive = inOpencode || inAgents;

      if (projDir && fs.existsSync(path.join(projDir, id))) {
        skill.isProjectActive = true;
      } else {
        skill.isProjectActive = false;
      }
    }
  }

  isActive(skill) {
    return this.scope === 'project' ? skill.isProjectActive : skill.isGlobalActive;
  }

  ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  activateSkill(id) {
    const skill = this.skills.get(id);
    if (!skill) return { success: false, message: `Skill ${id} not found` };

    if (this.scope === 'project') {
      const projDir = this.getProjectSkillsDir();
      this.ensureDir(projDir);
      const target = path.join(projDir, id);
      if (fs.existsSync(target)) {
        return { success: true, message: `Already active in project` };
      }
      try {
        fs.symlinkSync(skill.sourceDir, target, 'dir');
        skill.isProjectActive = true;
        return { success: true, message: `[Project] Activated: ${id}` };
      } catch (err) {
        return { success: false, message: `Symlink failed: ${err.message}` };
      }
    } else {
      const disOpencode = path.join(GLOBAL_OPENCODE_DISABLED, id);
      const actOpencode = path.join(GLOBAL_OPENCODE_SKILLS, id);
      if (fs.existsSync(disOpencode)) {
        this.ensureDir(GLOBAL_OPENCODE_SKILLS);
        fs.renameSync(disOpencode, actOpencode);
        skill.isGlobalActive = true;
        return { success: true, message: `[Global] Restored: ${id}` };
      }

      const disAgents = path.join(GLOBAL_AGENTS_DISABLED, id);
      const actAgents = path.join(GLOBAL_AGENTS_SKILLS, id);
      if (fs.existsSync(disAgents)) {
        this.ensureDir(GLOBAL_AGENTS_SKILLS);
        fs.renameSync(disAgents, actAgents);
        skill.isGlobalActive = true;
        return { success: true, message: `[Global] Restored in ~/.agents: ${id}` };
      }

      this.ensureDir(GLOBAL_OPENCODE_SKILLS);
      if (!fs.existsSync(actOpencode)) {
        try {
          fs.symlinkSync(skill.sourceDir, actOpencode, 'dir');
          skill.isGlobalActive = true;
          return { success: true, message: `[Global] Symlinked: ${id}` };
        } catch (err) {
          return { success: false, message: `Activate failed: ${err.message}` };
        }
      }
      skill.isGlobalActive = true;
      return { success: true, message: `Already active` };
    }
  }

  deactivateSkill(id) {
    const skill = this.skills.get(id);
    if (!skill) return { success: false, message: `Skill ${id} not found` };

    if (this.scope === 'project') {
      const projDir = this.getProjectSkillsDir();
      const target = path.join(projDir, id);
      if (fs.existsSync(target)) {
        try {
          const stat = fs.lstatSync(target);
          if (stat.isSymbolicLink()) {
            fs.unlinkSync(target);
          } else {
            fs.rmSync(target, { recursive: true, force: true });
          }
          skill.isProjectActive = false;
          return { success: true, message: `[Project] Deactivated: ${id}` };
        } catch (err) {
          return { success: false, message: `Deactivate failed: ${err.message}` };
        }
      }
      skill.isProjectActive = false;
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
            this.ensureDir(GLOBAL_OPENCODE_DISABLED);
            fs.renameSync(actOpencode, path.join(GLOBAL_OPENCODE_DISABLED, id));
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
            this.ensureDir(GLOBAL_AGENTS_DISABLED);
            fs.renameSync(actAgents, path.join(GLOBAL_AGENTS_DISABLED, id));
            moved = true;
          }
        } catch (err) {
          return { success: false, message: `Failed deactivating ${id}: ${err.message}` };
        }
      }

      skill.isGlobalActive = false;
      return { success: true, message: moved ? `[Global] Deactivated: ${id}` : `Already inactive` };
    }
  }

  toggleSkill(id) {
    const skill = this.skills.get(id);
    if (!skill) return { success: false, message: `Skill ${id} not found` };
    if (this.isActive(skill)) {
      return this.deactivateSkill(id);
    } else {
      return this.activateSkill(id);
    }
  }

  batchSetTier(tierNum, activate) {
    let count = 0;
    for (const [id, skill] of this.skills.entries()) {
      if (skill.tier === tierNum) {
        if (activate && !this.isActive(skill)) {
          this.activateSkill(id);
          count++;
        } else if (!activate && this.isActive(skill)) {
          this.deactivateSkill(id);
          count++;
        }
      }
    }
    return count;
  }
}

// ── TUI Renderer & Event Loop ─────────────────────────────────────────────────
class SkillTUI {
  constructor(manager) {
    this.mgr = manager;
    this.focusPanel = 'left'; // 'left' = Non-aktif, 'right' = Aktif
    this.selectedIndex = { left: 0, right: 0 };
    this.scrollOffset = { left: 0, right: 0 };
    this.tierFilter = 'ALL';
    this.categoryFilter = 'ALL';
    this.searchQuery = '';
    this.isSearching = false;
    this.statusMessage = 'Gunakan [Enter] untuk memindahkan antar card, [i/v] untuk lihat SKILL.md.';
    this.statusTime = Date.now();

    // Modal Details State
    this.isViewingDetails = false;
    this.modalScrollOffset = 0;
    this.modalLines = [];
    this.modalSkill = null;

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

  handleMouseData(str) {
    // SGR mouse mode: \x1b[<btn;x;yM or m
    const sgrRegex = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g;
    let match;
    let handled = false;
    while ((match = sgrRegex.exec(str)) !== null) {
      handled = true;
      const btn = parseInt(match[1], 10);
      const isRelease = match[4] === 'm';
      if (!isRelease) {
        if (btn === 64) {
          this.handleWheel(-1); // UP
        } else if (btn === 65) {
          this.handleWheel(1);  // DOWN
        }
      }
    }

    // Legacy X10 mouse mode: \x1b[M followed by 3 bytes
    const legacyRegex = /\x1b\[M([\s\S])([\s\S])([\s\S])/g;
    while ((match = legacyRegex.exec(str)) !== null) {
      handled = true;
      const btn = match[1].charCodeAt(0) - 32;
      if (btn === 64) {
        this.handleWheel(-1); // UP
      } else if (btn === 65) {
        this.handleWheel(1);  // DOWN
      }
    }

    return handled;
  }

  handleWheel(dir) {
    const rows = process.stdout.rows || 32;

    if (this.isViewingDetails && this.modalSkill) {
      const innerHeight = Math.max(5, rows - 4);
      const maxScroll = Math.max(0, this.modalLines.length - innerHeight);
      const SCROLL_SPEED = 5; // Scroll speed 5

      if (dir < 0) {
        this.modalScrollOffset = Math.max(0, this.modalScrollOffset - SCROLL_SPEED);
      } else {
        this.modalScrollOffset = Math.min(maxScroll, this.modalScrollOffset + SCROLL_SPEED);
      }
      this.render();
      return;
    }

    // Dual card list mode: scroll active card panel by 3
    const lists = this.getFilteredLists();
    const curList = lists[this.focusPanel];
    if (curList.length > 0) {
      if (dir < 0) {
        this.selectedIndex[this.focusPanel] = Math.max(0, this.selectedIndex[this.focusPanel] - 3);
      } else {
        this.selectedIndex[this.focusPanel] = Math.min(curList.length - 1, this.selectedIndex[this.focusPanel] + 3);
      }
      this.render();
    }
  }

  getFilteredLists() {
    const leftList = [];
    const rightList = [];

    const sortedSkills = Array.from(this.mgr.skills.values()).sort((a, b) => a.id.localeCompare(b.id));

    for (const s of sortedSkills) {
      if (this.tierFilter !== 'ALL') {
        if (this.tierFilter === '1' && s.tier !== 1) continue;
        if (this.tierFilter === '2' && s.tier !== 2) continue;
        if (this.tierFilter === '3' && s.tier !== 3) continue;
        if (this.tierFilter.startsWith('2') && s.subTier !== this.tierFilter) continue;
      }

      if (this.categoryFilter !== 'ALL' && s.category !== this.categoryFilter) {
        continue;
      }

      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        if (!s.id.toLowerCase().includes(q) && !s.category.toLowerCase().includes(q)) {
          continue;
        }
      }

      if (this.mgr.isActive(s)) {
        rightList.push(s);
      } else {
        leftList.push(s);
      }
    }

    return { left: leftList, right: rightList };
  }

  openSkillDetails(skill) {
    if (!skill) return;
    this.modalSkill = skill;
    this.isViewingDetails = true;
    this.modalScrollOffset = 0;

    const skillMdPath = path.join(skill.sourceDir, 'SKILL.md');
    let content = '';
    if (fs.existsSync(skillMdPath)) {
      try {
        content = fs.readFileSync(skillMdPath, 'utf8');
      } catch (err) {
        content = `Error reading SKILL.md: ${err.message}`;
      }
    } else {
      content = `# ${skill.name}\n\n(File SKILL.md tidak ditemukan di ${skill.sourceDir})`;
    }

    const cols = process.stdout.columns || 110;
    const innerWidth = Math.max(30, cols - 4);

    this.modalLines = renderMarkdown(content, { width: innerWidth });
    process.stdout.write('\x1b[H\x1b[2J');
    this.render();
  }

  start() {
    if (!process.stdin.isTTY) {
      console.log('Error: TUI requires an interactive TTY terminal.');
      process.exit(1);
    }

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    // Enable alternate screen buffer, hide native cursor, and enable mouse tracking (SGR mode 1006 + 1000)
    process.stdout.write('\x1b[?1049h\x1b[H\x1b[?25l');
    process.stdout.write('\x1b[?1000h\x1b[?1006h');

    // Intercept mouse escape sequences from stdin before readline keypress parser splits them
    const self = this;
    const originalEmit = process.stdin.emit;
    this.originalStdinEmit = originalEmit;

    process.stdin.emit = function (event, ...args) {
      if (event === 'data') {
        const chunk = args[0];
        const str = chunk ? chunk.toString() : '';
        if (str.startsWith('\x1b[<') || str.startsWith('\x1b[M')) {
          self.handleMouseData(str);
          return true; // Suppress mouse data from readline keypress parser!
        }
      }
      return originalEmit.apply(this, [event, ...args]);
    };

    process.stdin.on('keypress', (str, key) => this.handleKeypress(str, key));
    process.stdout.on('resize', () => {
      if (this.isViewingDetails && this.modalSkill) {
        this.openSkillDetails(this.modalSkill);
      } else {
        this.render();
      }
    });

    this.render();
  }

  exit() {
    this.stopBlink();
    if (this.originalStdinEmit) {
      process.stdin.emit = this.originalStdinEmit;
    }
    // Disable mouse reporting, restore main screen buffer, show native cursor
    process.stdout.write('\x1b[?1000l\x1b[?1006l\x1b[?1049l\x1b[?25h');
    process.exit(0);
  }

  setStatus(msg) {
    this.statusMessage = msg;
    this.statusTime = Date.now();
    this.render();
  }

  handleKeypress(str, key) {
    if (key.ctrl && key.name === 'c') {
      this.exit();
    }

    // ── Modal Mode Keypress Handling ──────────────────────────────────────────
    if (this.isViewingDetails) {
      const rows = process.stdout.rows || 32;
      const modalHeight = Math.min(rows - 4, 30);
      const innerHeight = Math.max(5, modalHeight - 4);
      const maxScroll = Math.max(0, this.modalLines.length - innerHeight);

      if (key.name === 'escape' || str === 'q' || str === 'Q' || str === 'i' || str === 'v') {
        this.isViewingDetails = false;
        this.modalSkill = null;
        process.stdout.write('\x1b[H\x1b[2J');
        this.render();
        return;
      }

      if (key.name === 'up' || str === 'k') {
        this.modalScrollOffset = Math.max(0, this.modalScrollOffset - 1);
        this.render();
        return;
      }
      if (key.name === 'down' || str === 'j') {
        this.modalScrollOffset = Math.min(maxScroll, this.modalScrollOffset + 1);
        this.render();
        return;
      }
      if (key.name === 'pageup') {
        this.modalScrollOffset = Math.max(0, this.modalScrollOffset - 10);
        this.render();
        return;
      }
      if (key.name === 'pagedown') {
        this.modalScrollOffset = Math.min(maxScroll, this.modalScrollOffset + 10);
        this.render();
        return;
      }
      if (str === 'g' || key.name === 'home') {
        this.modalScrollOffset = 0;
        this.render();
        return;
      }
      if (str === 'G' || key.name === 'end') {
        this.modalScrollOffset = maxScroll;
        this.render();
        return;
      }

      // Enter/Space inside modal toggles active status!
      if (key.name === 'return' || key.name === 'space') {
        if (this.modalSkill) {
          const res = this.mgr.toggleSkill(this.modalSkill.id);
          this.setStatus(res.message);
        }
        return;
      }

      return;
    }

    // ── Search Mode Keypress Handling ─────────────────────────────────────────
    if (this.isSearching) {
      if (key.name === 'escape') {
        // Direct escape cancels search immediately, clears query, restores full list!
        this.isSearching = false;
        this.searchQuery = '';
        this.stopBlink();
        this.selectedIndex.left = 0;
        this.selectedIndex.right = 0;
        this.scrollOffset.left = 0;
        this.scrollOffset.right = 0;
        this.render();
        return;
      }
      if (key.name === 'return') {
        // Return keeps the current search filter and returns to card navigation
        this.isSearching = false;
        this.stopBlink();
        this.render();
        return;
      }
      if (key.name === 'backspace') {
        this.searchQuery = this.searchQuery.slice(0, -1);
      } else if (str && str.length === 1 && !key.ctrl && !key.meta) {
        this.searchQuery += str;
      }
      this.cursorVisible = true; // Solid cursor immediately when user types
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
    } else if (str === 'i' || str === 'v' || str === 'I' || str === 'V') {
      // OPEN DETAIL MODAL!
      if (curList.length > 0) {
        const item = curList[this.selectedIndex[this.focusPanel]];
        if (item) {
          this.openSkillDetails(item);
        }
      }
    } else if (key.name === 'return' || key.name === 'space') {
      // TOGGLE ON ENTER!
      if (curList.length > 0) {
        const item = curList[this.selectedIndex[this.focusPanel]];
        if (item) {
          const res = this.mgr.toggleSkill(item.id);
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
    } else if (str === 'a' || str === 'A') {
      const leftItems = lists.left;
      let count = 0;
      for (const item of leftItems) {
        this.mgr.activateSkill(item.id);
        count++;
      }
      this.setStatus(`[OK] Diaktifkan ${count} skill yang sedang difilter.`);
    } else if (str === 'd' || str === 'D') {
      const rightItems = lists.right;
      let count = 0;
      for (const item of rightItems) {
        this.mgr.deactivateSkill(item.id);
        count++;
      }
      this.setStatus(`[OK] Dinonaktifkan ${count} skill yang sedang difilter.`);
    } else if (str === 'c' || str === 'C') {
      const cats = ['ALL', 'Frontend', 'Backend', 'Database', 'Mobile & Go', 'Marketing', 'Logistics', 'Science & Doc', 'Data & AI', 'Testing & Quality', 'Niche / Disabled'];
      const curIdx = cats.indexOf(this.categoryFilter);
      this.categoryFilter = cats[(curIdx + 1) % cats.length];
      this.selectedIndex.left = 0;
      this.selectedIndex.right = 0;
      this.render();
    }
  }

  render() {
    const cols = process.stdout.columns || 110;
    const rows = process.stdout.rows || 32;

    const lists = this.getFilteredLists();

    // Helper to safely format each line: truncates to cols - 1 to prevent terminal auto-wrap
    // and clears from cursor to end of line (\x1b[K) so no ghost text remains from prior renders
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
    const C_BG_MODAL = '\x1b[48;5;235m';

    // ── 1. Top Header ─────────────────────────────────────────────────────────
    const scopeLabel = this.mgr.scope === 'global'
      ? `${C_YELLOW}${C_BOLD}[GLOBAL]${C_RESET} (~/.config/opencode)`
      : `${C_GREEN}${C_BOLD}[PROJECT]${C_RESET} (${path.basename(this.mgr.cwd)})`;

    let headerLine = `${C_CYAN}${C_BOLD}=== ECC-OPL SKILL MANAGER ===${C_RESET}  Scope: ${scopeLabel}  ${C_GRAY}(Tekan [S] untuk toggle Scope)${C_RESET}`;
    if (cols < 95) {
      headerLine = `${C_CYAN}${C_BOLD}=== ECC-OPL SKILL MANAGER ===${C_RESET}  Scope: ${scopeLabel}`;
    }
    buf += emitLine(headerLine);
    
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
    if (this.isViewingDetails && this.modalSkill) {
      const innerWidth = Math.max(20, cols - 4);
      const innerHeight = Math.max(5, rows - 4);
      const maxScroll = Math.max(0, this.modalLines.length - innerHeight);

      const isAct = this.mgr.isActive(this.modalSkill);
      const actBadge = isAct ? `${C_GREEN}${C_BOLD}[STATUS: AKTIF]${C_RESET}` : `${C_MAGENTA}${C_BOLD}[STATUS: NON-AKTIF]${C_RESET}`;
      
      const titleText = ` DETAIL SKILL: ${this.modalSkill.id} (${this.modalSkill.tierLabel}) `;
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

      // Modal Footer Bar with scroll percentage
      const totalL = this.modalLines.length;
      const curL = Math.min(totalL, this.modalScrollOffset + innerHeight);
      const pct = totalL > 0 ? Math.round((curL / totalL) * 100) : 100;
      const footerInfo = ` [Baris ${this.modalScrollOffset + 1}-${curL}/${totalL} (${pct}%)] [↑/↓ Scroll] [q/Esc Tutup] `;
      const footerPadLen = Math.max(0, cols - visibleLength(footerInfo) - 3);
      
      buf += `${C_CYAN}${C_BOLD}└─${'─'.repeat(footerPadLen)}${footerInfo}┘${C_RESET}`;

      process.stdout.write(buf);
      return;
    }

    // ── 3. Dual Panel Calculations ───────────────────────────────────────────
    const halfWidth = Math.max(30, Math.floor((cols - 3) / 2));
    const cardHeight = Math.max(8, rows - 9);

    for (const side of ['left', 'right']) {
      const curIdx = this.selectedIndex[side];
      const curOffset = this.scrollOffset[side];
      if (curIdx < curOffset) {
        this.scrollOffset[side] = curIdx;
      } else if (curIdx >= curOffset + cardHeight) {
        this.scrollOffset[side] = curIdx - cardHeight + 1;
      }
    }

    const leftFocused = this.focusPanel === 'left';
    const rightFocused = this.focusPanel === 'right';

    const leftBorderColor = leftFocused ? `${C_CYAN}${C_BOLD}` : C_GRAY;
    const rightBorderColor = rightFocused ? `${C_CYAN}${C_BOLD}` : C_GRAY;

    const leftTitle = `[1] NON-AKTIF (Library) (${lists.left.length})`;
    const rightTitle = `[2] AKTIF (${this.mgr.scope.toUpperCase()}) (${lists.right.length})`;

    const leftTopLen = Math.max(0, halfWidth - visibleLength(leftTitle) - 5);
    const rightTopLen = Math.max(0, halfWidth - visibleLength(rightTitle) - 5);

    const leftTopBar = `${leftBorderColor}┌─ ${C_BOLD}${leftTitle}${C_RESET}${leftBorderColor} ${'─'.repeat(leftTopLen)}┐${C_RESET}`;
    const rightTopBar = `${rightBorderColor}┌─ ${C_BOLD}${rightTitle}${C_RESET}${rightBorderColor} ${'─'.repeat(rightTopLen)}┐${C_RESET}`;

    buf += emitLine(`${leftTopBar} ${rightTopBar}`);

    function formatTierBadge(s) {
      if (s.tier === 1) return `${C_GREEN}[T1]${C_RESET}`;
      if (s.tier === 2) return `${C_YELLOW}[${s.subTier}]${C_RESET}`;
      return `${C_MAGENTA}[T3]${C_RESET}`;
    }

    // ── 4. Render Card Rows ──────────────────────────────────────────────────
    const innerWidth = halfWidth - 2;

    for (let r = 0; r < cardHeight; r++) {
      // Left row
      const leftIdx = this.scrollOffset.left + r;
      let leftRowContent = ' '.repeat(innerWidth);
      if (leftIdx < lists.left.length) {
        const item = lists.left[leftIdx];
        const isSel = leftFocused && leftIdx === this.selectedIndex.left;
        const prefix = isSel ? '> ' : '  ';
        const badge = formatTierBadge(item);
        const badgeLen = 4;
        const maxNameLen = Math.max(4, innerWidth - 2 - badgeLen - 2);
        const name = item.id.length > maxNameLen ? item.id.slice(0, maxNameLen - 1) + '…' : item.id;
        const padLen = Math.max(1, innerWidth - 2 - visibleLength(name) - badgeLen);
        const pad = ' '.repeat(padLen);
        
        if (isSel) {
          leftRowContent = `${C_BG_SEL}${C_CYAN}${prefix}${C_RESET}${C_BG_SEL}${C_BOLD}${name}${C_RESET}${C_BG_SEL}${pad}${badge}${C_RESET}`;
        } else {
          leftRowContent = `${prefix}${name}${pad}${badge}`;
        }
      }

      // Right row
      const rightIdx = this.scrollOffset.right + r;
      let rightRowContent = ' '.repeat(innerWidth);
      if (rightIdx < lists.right.length) {
        const item = lists.right[rightIdx];
        const isSel = rightFocused && rightIdx === this.selectedIndex.right;
        const prefix = isSel ? '> ' : '  ';
        const badge = formatTierBadge(item);
        const badgeLen = 4;
        const maxNameLen = Math.max(4, innerWidth - 2 - badgeLen - 2);
        const name = item.id.length > maxNameLen ? item.id.slice(0, maxNameLen - 1) + '…' : item.id;
        const padLen = Math.max(1, innerWidth - 2 - visibleLength(name) - badgeLen);
        const pad = ' '.repeat(padLen);

        if (isSel) {
          rightRowContent = `${C_BG_SEL_ACTIVE}${C_GREEN}${prefix}${C_RESET}${C_BG_SEL_ACTIVE}${C_BOLD}${name}${C_RESET}${C_BG_SEL_ACTIVE}${pad}${badge}${C_RESET}`;
        } else {
          rightRowContent = `${prefix}${name}${pad}${badge}`;
        }
      }

      const leftCol = `${leftBorderColor}│${C_RESET}${padAnsi(leftRowContent, innerWidth)}${leftBorderColor}│${C_RESET}`;
      const rightCol = `${rightBorderColor}│${C_RESET}${padAnsi(rightRowContent, innerWidth)}${rightBorderColor}│${C_RESET}`;

      buf += emitLine(`${leftCol} ${rightCol}`);
    }

    const leftBottom = `${leftBorderColor}└─${'─'.repeat(Math.max(0, halfWidth - 3))}┘${C_RESET}`;
    const rightBottom = `${rightBorderColor}└─${'─'.repeat(Math.max(0, halfWidth - 3))}┘${C_RESET}`;
    buf += emitLine(`${leftBottom} ${rightBottom}`);

    // ── 5. Selected Skill Details ────────────────────────────────────────────
    const activeList = lists[this.focusPanel];
    const activeItem = activeList[this.selectedIndex[this.focusPanel]];
    let descLine = `${C_DIM}Pilih skill untuk melihat deskripsi... [i/v untuk baca SKILL.md]${C_RESET}`;
    if (activeItem) {
      const prefixText = ` ${activeItem.id} (${activeItem.category} - ${activeItem.tierLabel}): `;
      const suffixText = ` [i/v Detail]`;
      const availDescWidth = Math.max(10, cols - visibleLength(prefixText) - visibleLength(suffixText) - 2);
      const rawDesc = (activeItem.description || '(Tidak ada deskripsi SKILL.md)').replace(/[\r\n\t]+/g, ' ').trim();
      const cleanDesc = visibleLength(rawDesc) > availDescWidth
        ? rawDesc.slice(0, Math.max(1, availDescWidth - 3)) + '...'
        : rawDesc;
      descLine = ` ${C_BOLD}${activeItem.id}${C_RESET} ${C_GRAY}(${activeItem.category} - ${activeItem.tierLabel}):${C_RESET} ${cleanDesc} ${C_CYAN}[i/v Detail]${C_RESET}`;
    }
    buf += emitLine(descLine);

    // ── 6. Status & Footer ───────────────────────────────────────────────────
    const statusColor = this.statusMessage.startsWith('[OK]') ? C_GREEN : (this.statusMessage.startsWith('[Global]') || this.statusMessage.startsWith('[Project]') ? C_GREEN : C_YELLOW);
    buf += emitLine(` Status: ${statusColor}${this.statusMessage}${C_RESET}`);

    // Quick Command Keys (responsive so it never wraps)
    let footerHelp = `${C_DIM}[Enter] On/Off │ [i/v] Detail SKILL.md │ [Tab/←/→] Ganti Card │ [1/2/3] Tier │ [A] Aktif Semua │ [D] Nonaktif │ [Q] Keluar${C_RESET}`;
    if (cols < 115) {
      footerHelp = `${C_DIM}[Enter] On/Off │ [i] Detail │ [Tab] Ganti │ [1/2/3] Tier │ [A/D] Batch │ [Q] Keluar${C_RESET}`;
    }
    if (cols < 80) {
      footerHelp = `${C_DIM}[Enter] On/Off │ [i] Detail │ [Tab] Card │ [Q] Keluar${C_RESET}`;
    }

    // Final line: clear line and clear anything remaining down to the bottom
    const truncatedFooter = visibleLength(footerHelp) > cols - 1 ? truncateAnsi(footerHelp, cols - 2).text : footerHelp;
    buf += truncatedFooter + '\x1b[K\x1b[J';

    process.stdout.write(buf);
  }
}

// ── CLI / Headless Arguments Mode ─────────────────────────────────────────────
function runCli(args, mgr) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
ECC-OPL Skill Manager
Usage:
  node scripts/skill-manager-tui.js [options]

Interactive:
  node scripts/skill-manager-tui.js              Launch dual-card interactive TUI

CLI Flags:
  --status              Print current active/inactive summary
  --list                List all skills with their tier and state
  --view <id>           View rendered SKILL.md in terminal
  --enable <id>         Enable a skill
  --disable <id>        Disable a skill
  --disable-tier <1|2|3> Batch disable a specific tier
  --enable-tier <1|2|3>  Batch enable a specific tier
  --scope <global|project> Set target scope
    `);
    process.exit(0);
  }

  if (args.includes('--view')) {
    const idx = args.indexOf('--view');
    const id = args[idx + 1];
    const skill = mgr.skills.get(id);
    if (!skill) {
      console.log(`Error: Skill ${id} not found.`);
      process.exit(1);
    }
    const skillMd = path.join(skill.sourceDir, 'SKILL.md');
    if (!fs.existsSync(skillMd)) {
      console.log(`Error: SKILL.md not found in ${skill.sourceDir}`);
      process.exit(1);
    }
    const content = fs.readFileSync(skillMd, 'utf8');
    const lines = renderMarkdown(content, { width: (process.stdout.columns || 80) - 2 });
    console.log(lines.join('\n'));
    process.exit(0);
  }

  if (args.includes('--status')) {
    const lists = new SkillTUI(mgr).getFilteredLists();
    console.log(`\n=== ECC-OPL Skill Status ===`);
    console.log(`Scope: ${mgr.scope.toUpperCase()} (${mgr.scope === 'global' ? GLOBAL_OPENCODE_SKILLS : mgr.getProjectSkillsDir()})`);
    console.log(`Total Skills Discovered: ${mgr.skills.size}`);
    console.log(`  - Aktif (Right):      ${lists.right.length}`);
    console.log(`  - Non-aktif (Left):   ${lists.left.length}\n`);
    process.exit(0);
  }

  if (args.includes('--disable-tier')) {
    const idx = args.indexOf('--disable-tier');
    const tierNum = parseInt(args[idx + 1], 10);
    if (![1, 2, 3].includes(tierNum)) {
      console.log('Error: Tier must be 1, 2, or 3');
      process.exit(1);
    }
    const count = mgr.batchSetTier(tierNum, false);
    console.log(`[OK] Dinonaktifkan ${count} skill di Tier ${tierNum} (${mgr.scope} scope).`);
    process.exit(0);
  }

  if (args.includes('--enable-tier')) {
    const idx = args.indexOf('--enable-tier');
    const tierNum = parseInt(args[idx + 1], 10);
    if (![1, 2, 3].includes(tierNum)) {
      console.log('Error: Tier must be 1, 2, or 3');
      process.exit(1);
    }
    const count = mgr.batchSetTier(tierNum, true);
    console.log(`[OK] Diaktifkan ${count} skill di Tier ${tierNum} (${mgr.scope} scope).`);
    process.exit(0);
  }

  if (args.includes('--enable')) {
    const idx = args.indexOf('--enable');
    const id = args[idx + 1];
    const res = mgr.activateSkill(id);
    console.log(res.message);
    process.exit(res.success ? 0 : 1);
  }

  if (args.includes('--disable')) {
    const idx = args.indexOf('--disable');
    const id = args[idx + 1];
    const res = mgr.deactivateSkill(id);
    console.log(res.message);
    process.exit(res.success ? 0 : 1);
  }
}

// ── Main Entrypoint ───────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  const mgr = new SkillManager(process.cwd());

  if (args.includes('--scope')) {
    const idx = args.indexOf('--scope');
    const sc = args[idx + 1];
    if (sc === 'global' || sc === 'project') {
      mgr.scope = sc;
      mgr.refreshActiveStates();
    }
  }

  if (args.length > 0 && (args.includes('--status') || args.includes('--list') || args.includes('--enable') || args.includes('--disable') || args.includes('--enable-tier') || args.includes('--disable-tier') || args.includes('--view') || args.includes('--help') || args.includes('-h'))) {
    runCli(args, mgr);
    return;
  }

  const tui = new SkillTUI(mgr);
  tui.start();
}

if (require.main === module) {
  main();
}

module.exports = {
  SkillManager,
  SkillTUI,
  classifySkill,
};
