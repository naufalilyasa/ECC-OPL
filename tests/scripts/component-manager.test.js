const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

const {
  ComponentManager,
  classifySkill,
  classifyCommand,
  classifyAgent
} = require('../../scripts/skill-manager-tui');

test('classifySkill assigns appropriate tiers and categories', () => {
  const tdd = classifySkill('tdd-workflow');
  assert.equal(tdd.tier, 1);
  assert.equal(tdd.category, 'Testing & Quality');

  const mkt = classifySkill('ad-creative');
  assert.equal(mkt.tier, 2);
  assert.equal(mkt.category, 'Marketing');

  const cpp = classifySkill('cpp-coding-standards');
  assert.equal(cpp.tier, 3);
  assert.equal(cpp.category, 'Niche / Disabled');
});

test('classifyCommand assigns appropriate tiers and categories', () => {
  const plan = classifyCommand('plan');
  assert.equal(plan.tier, 1);
  assert.equal(plan.category, 'Planning');

  const mkt = classifyCommand('marketing-ideas');
  assert.equal(mkt.tier, 2);
  assert.equal(mkt.category, 'Marketing');

  const cpp = classifyCommand('cpp-build');
  assert.equal(cpp.tier, 3);
  assert.equal(cpp.category, 'Niche / Language');
});

test('classifyAgent assigns appropriate tiers and categories', () => {
  const planner = classifyAgent('planner');
  assert.equal(planner.tier, 1);
  assert.equal(planner.category, 'Core Specialist');

  const py = classifyAgent('python-reviewer');
  assert.equal(py.tier, 2);
  assert.equal(py.category, 'Web & Quality');

  const rust = classifyAgent('rust-build-resolver');
  assert.equal(rust.tier, 3);
  assert.equal(rust.category, 'Niche / System');
});

test('ComponentManager initializes and loads all 3 modes', () => {
  const mgr = new ComponentManager(process.cwd(), 'skills');
  
  assert.ok(mgr.items.skills.size > 0, 'Skills should be loaded');
  assert.ok(mgr.items.commands.size > 0, 'Commands should be loaded');
  assert.ok(mgr.items.agents.size > 0, 'Agents should be loaded');

  assert.equal(mgr.mode, 'skills');
  assert.equal(mgr.getCurrentItems(), mgr.items.skills);

  mgr.mode = 'commands';
  assert.equal(mgr.getCurrentItems(), mgr.items.commands);

  mgr.mode = 'agents';
  assert.equal(mgr.getCurrentItems(), mgr.items.agents);
});

test('ComponentManager active status checks work without errors', () => {
  const mgr = new ComponentManager(process.cwd(), 'skills');
  
  const skill = mgr.items.skills.get('tdd-workflow');
  if (skill) {
    const act = mgr.isActive(skill);
    assert.equal(typeof act, 'boolean');
  }

  const cmd = mgr.items.commands.get('plan');
  if (cmd) {
    const act = mgr.isActive(cmd);
    assert.equal(typeof act, 'boolean');
  }

  const ag = mgr.items.agents.get('planner');
  if (ag) {
    const act = mgr.isActive(ag);
    assert.equal(typeof act, 'boolean');
  }
});
