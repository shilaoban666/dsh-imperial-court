// 群臣市场、增删员工、一键推荐、思考深度、提示词走文件：真的 git 仓库 + 假 CLI。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createCourt } from '../index.mjs';
import { CATALOG, agentFromEntry, locateEntry, catalogEntry } from '../lib/catalog.mjs';
import { autoStaff, staffingDiff } from '../lib/staffing.mjs';
import { ROLE_IDS } from '../lib/i18n.mjs';

const FAKE = fileURLToPath(new URL('./fake-agent.mjs', import.meta.url));
const tmp = prefix => fs.mkdtempSync(path.join(os.tmpdir(), prefix));
const IS_WIN = process.platform === 'win32';

function makeRepo() {
  const dir = tmp('roster-repo-');
  const sh = (...args) => { const res = spawnSync('git', args, { cwd: dir, encoding: 'utf8' }); if (res.status) throw new Error(res.stderr); };
  sh('init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(dir, 'README.md'), '# demo\n');
  sh('add', '-A');
  sh('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'init');
  return dir;
}

function makeCourt({ agents: extra = [], rules = {} } = {}) {
  const dataDir = tmp('roster-data-');
  const log = path.join(dataDir, 'fake.log');
  const court = createCourt({ dataDir }, { log: { info() {}, error() {} } });
  const fake = (id, more = {}) => ({
    id, name: id, adapter: 'cli', command: process.execPath, args: [FAKE],
    env: { FAKE_LOG: log, FAKE_FORMAT: 'text' }, timeoutMs: 30000, ...more,
  });
  const agents = [
    fake('fa', { models: ['big', 'small'], efforts: ['low', 'medium', 'high'], effortArgs: ['--effort', '{effort}'] }),
    fake('fb'),
    ...extra.map(item => fake(item.id, item)),
  ];
  const roles = {};
  for (const id of ROLE_IDS) roles[id] = { agentId: 'fa', model: '' };
  roles.menxia.agentId = 'fb';
  court.api.savePreset({ agents, roles, rules: { ...court.store.state.rules, fallbackAgentId: 'fa', historianAgentId: 'fa', mode: 'express', historian: false, regimePowers: false, ...rules } });
  court.api.setUi({ style: 'ancient' });
  const entries = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : []);
  return { court, api: court.api, entries };
}

/** 在 PATH 前面放一个假的命令（Windows 上是 .cmd），模拟「本机装了这个工具」 */
function fakeCommand(name) {
  const dir = tmp('roster-bin-');
  if (IS_WIN) fs.writeFileSync(path.join(dir, `${name}.cmd`), '@echo off\r\necho fake\r\n');
  else {
    fs.writeFileSync(path.join(dir, name), '#!/bin/sh\necho fake\n');
    fs.chmodSync(path.join(dir, name), 0o755);
  }
  const before = process.env.PATH;
  process.env.PATH = `${dir}${path.delimiter}${before}`;
  return () => { process.env.PATH = before; };
}

test('the catalog lists the common tools, each with a description, pros, cons and a working template', () => {
  const ids = CATALOG.map(entry => entry.id);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  for (const want of ['claude', 'codex', 'dsh', 'workbuddy', 'qwen', 'cursor', 'opencode', 'gemini', 'seedance', 'qwen-code']) assert.ok(ids.includes(want), want);
  for (const entry of CATALOG) {
    assert.ok(['agent', 'gui', 'tool'].includes(entry.kind), entry.id);
    for (const key of ['desc', 'pros', 'cons', 'needs']) assert.ok(entry[key] && entry[key].zh && entry[key].en, `${entry.id} ${key}`);
    if (entry.kind === 'tool') assert.ok(entry.duty && entry.duty.role, `${entry.id} says which office uses it`);
    const agent = agentFromEntry(entry, { command: entry.commands[0] });
    if (entry.agent) {
      assert.equal(agent.id, entry.agentId);
      assert.equal(agent.catalogId, entry.id);
      if (agent.promptMode === 'file') assert.ok(agent.args.some(arg => arg.includes('{promptFile}')), `${entry.id} points the CLI at the prompt file`);
    }
  }
  // 市场里的模板都过得了保存时的校验
  const { api, court } = makeCourt();
  const state = court.store.state;
  const templates = CATALOG.map(entry => agentFromEntry(entry, { command: entry.commands[0] })).filter(Boolean)
    .filter(agent => !state.agents.some(item => item.id === agent.id));
  api.savePreset({ agents: [...state.agents, ...templates], roles: state.roles, rules: state.rules });
  for (const agent of templates) assert.ok(court.store.state.agents.some(item => item.id === agent.id), agent.id);
  court.dispose();
});

test('a tool found on this machine joins the roster with one click; a missing one offers its install command', () => {
  const restore = fakeCommand('gemini');
  try {
    const { api, court } = makeCourt();
    assert.equal(locateEntry(catalogEntry('gemini'), { fresh: true }).command, 'gemini');
    const before = api.catalog({ fresh: true }).entries.find(entry => entry.id === 'gemini');
    assert.equal(before.found, true);
    assert.equal(before.added, false);
    const result = api.addFromCatalog('gemini');
    assert.equal(result.ok, true);
    const agent = court.store.state.agents.find(item => item.id === 'gemini');
    assert.equal(agent.command, 'gemini');
    assert.deepEqual(agent.execArgs, ['--approval-mode', 'auto_edit']);
    assert.equal(agent.catalogId, 'gemini');
    assert.equal(result.entries.find(entry => entry.id === 'gemini').added, true);
    // 再点一次不会多出一个
    api.addFromCatalog('gemini');
    assert.equal(court.store.state.agents.filter(item => item.id === 'gemini').length, 1);
    // 千问办公只有界面：不用装，直接接成人工员工
    court.store.state.agents = court.store.state.agents.filter(item => item.id !== 'qwen');
    assert.equal(api.addFromCatalog('qwen').ok, true);
    assert.equal(court.store.state.agents.find(item => item.id === 'qwen').adapter, 'manual');
    court.dispose();
  } finally {
    restore();
  }
  // 没装、又没有一键安装的（seedance 走 cargo）：给出手动命令
  const { api, court } = makeCourt();
  const missing = api.catalog({ fresh: true }).entries.find(entry => entry.id === 'seedance');
  if (!missing.found) {
    const result = api.addFromCatalog('seedance');
    assert.equal(result.ok, false);
    assert.equal(result.installText, 'cargo install seedance');
  }
  court.dispose();
});

test('a tool such as seedance is not an officer: it is written into the Aedile\'s remit', () => {
  const restore = fakeCommand('seedance');
  try {
    const { api, court } = makeCourt();
    const agentsBefore = court.store.state.agents.length;
    assert.equal(api.addFromCatalog('seedance').ok, true);
    assert.equal(court.store.state.agents.length, agentsBefore, 'no new officer');
    assert.deepEqual(court.store.state.rules.toolkit, ['seedance']);
    assert.match(court.store.state.roles.works.duty, /seedance generate/);
    api.addFromCatalog('seedance');
    assert.equal(court.store.state.roles.works.duty.split('seedance generate').length, 2, 'written once');
    assert.equal(api.catalog().entries.find(entry => entry.id === 'seedance').added, true);
    court.dispose();
  } finally {
    restore();
  }
});

test('custom officers can be added by hand, and removing one vacates its offices', () => {
  const { api, court } = makeCourt();
  const added = api.addCustomAgent({ name: 'Kimi CLI', command: 'kimi', args: '-p', models: 'k2, k2-turbo', promptMode: 'file' });
  const kimi = court.store.state.agents.find(item => item.id === added.id);
  assert.equal(added.id, 'kimi-cli');
  assert.deepEqual(kimi.models, ['k2', 'k2-turbo']);
  assert.equal(kimi.promptMode, 'file');
  assert.equal(api.addCustomAgent({ name: 'Kimi CLI', command: 'kimi' }).id, 'kimi-cli-2', 'ids never collide');
  const gui = api.addCustomAgent({ name: '某办公软件', adapter: 'manual' });
  assert.equal(court.store.state.agents.find(item => item.id === gui.id).adapter, 'manual');

  // fa 担任大多数官职，还是代办与史官
  api.removeAgent('fa');
  const state = court.store.state;
  assert.equal(state.agents.some(item => item.id === 'fa'), false);
  for (const roleId of ROLE_IDS) assert.notEqual(state.roles[roleId].agentId, 'fa', roleId);
  assert.equal(state.roles.war.agentId, '');
  assert.equal(state.rules.fallbackAgentId, '');
  assert.equal(state.rules.historianAgentId, '');
  assert.throws(() => api.removeAgent('nobody'));
  court.dispose();
});

test('recommend staffs from the tools that are reachable: two vendors plan and review, efforts follow the office', () => {
  const ready = new Set(['cc', 'codex', 'dsh']);
  const state = {
    agents: [
      { id: 'cc', adapter: 'cli', models: ['opus', 'sonnet', 'haiku'], efforts: ['low', 'medium', 'high', 'xhigh', 'max'] },
      { id: 'codex', adapter: 'cli', models: ['gpt-5-codex'], efforts: ['low', 'medium', 'high'] },
      { id: 'dsh', adapter: 'cli', models: ['deepseek-flash', 'deepseek-v4-pro'] },
      { id: 'gemini', adapter: 'cli', models: [] },
    ],
    roles: {}, rules: {},
  };
  const next = autoStaff(state, ready);
  assert.equal(next.roles.zhongshu.agentId, 'cc');
  assert.equal(next.roles.zhongshu.model, 'opus');
  assert.equal(next.roles.zhongshu.effort, 'high');
  assert.equal(next.roles.menxia.agentId, 'codex', 'a different vendor reviews the plan');
  assert.equal(next.roles.menxia.effort, 'high');
  assert.equal(next.roles.war.model, 'sonnet');
  assert.equal(next.roles.war.effort, 'medium');
  assert.notEqual(next.roles.justice.agentId, next.roles.war.agentId, 'a different vendor tests the code');
  assert.equal(next.roles.yushi.agentId, 'dsh');
  assert.equal(next.roles.yushi.effort, '', 'DSH has no effort switch, so none is set');
  assert.ok(ROLE_IDS.every(id => next.roles[id].agentId !== 'gemini'), 'tools that are not reachable are never picked');
  // 自己加的、市场之外的工具也挑得中
  const only = autoStaff({ agents: [{ id: 'mine', adapter: 'cli' }], roles: {}, rules: {} }, new Set(['mine']));
  assert.equal(only.roles.war.agentId, 'mine');
  assert.deepEqual(staffingDiff({ war: { agentId: 'a' } }, { war: { agentId: 'b' } }).map(item => item.roleId), ['war']);

  // 走一遍接口：两个假工具都连得通
  const { api, court } = makeCourt();
  api.probeAll();
  assert.deepEqual(api.getState().connected.slice().sort(), ['fa', 'fb']);
  const result = api.recommend();
  assert.deepEqual(result.ready.slice().sort(), ['fa', 'fb']);
  const roles = court.store.state.roles;
  assert.notEqual(roles.zhongshu.agentId, roles.menxia.agentId);
  assert.notEqual(roles.war.agentId, roles.justice.agentId);
  const faRole = ROLE_IDS.find(id => roles[id].agentId === 'fa' && id === 'zhongshu') || ROLE_IDS.find(id => roles[id].agentId === 'fa' && ['menxia', 'war', 'justice'].includes(id));
  if (faRole) assert.ok(['high', 'medium'].includes(roles[faRole].effort), 'fa supports effort, so it gets one');
  court.dispose();
});

test('the effort chosen for an office reaches the CLI; a deputy does not inherit it', async () => {
  const repo = makeRepo();
  const { api, court, entries } = makeCourt();
  const roles = court.store.state.roles;
  api.savePreset({ agents: court.store.state.agents, roles: { ...roles, war: { ...roles.war, agentId: 'fa', model: 'big', effort: 'high' } }, rules: court.store.state.rules });
  const { id } = api.createEdict({ brief: 'fix the bug in the code', workspace: repo, ministry: 'war' });
  await court.idle();
  assert.equal(api.getEdict(id).status, 'awaiting-approval', api.getEdict(id).error);
  const task = entries().find(entry => entry.kind === 'task');
  const at = task.args.indexOf('--effort');
  assert.ok(at >= 0, `args: ${task.args.join(' ')}`);
  assert.equal(task.args[at + 1], 'high');

  // 不在该 CLI 档位里的值不传
  entries().length;
  api.savePreset({ agents: court.store.state.agents, roles: { ...court.store.state.roles, war: { ...court.store.state.roles.war, effort: 'max' } }, rules: court.store.state.rules });
  const second = api.createEdict({ brief: 'fix the other bug in the code', workspace: repo, ministry: 'war' });
  await court.idle();
  assert.equal(api.getEdict(second.id).status, 'awaiting-approval');
  const tasks = entries().filter(entry => entry.kind === 'task');
  assert.equal(tasks[tasks.length - 1].args.includes('--effort'), false);
  court.dispose();
});

test('CLIs that only take arguments get the prompt through a temporary file, which is removed afterwards', async () => {
  const repo = makeRepo();
  const { api, court, entries } = makeCourt({ agents: [{ id: 'fc', promptMode: 'file', args: [FAKE, '--prompt-file', '{promptFile}'] }] });
  const roles = court.store.state.roles;
  api.savePreset({ agents: court.store.state.agents, roles: { ...roles, war: { ...roles.war, agentId: 'fc' } }, rules: court.store.state.rules });
  const { id } = api.createEdict({ brief: 'fix the bug in the code', workspace: repo, ministry: 'war' });
  await court.idle();
  const detail = api.getEdict(id);
  assert.equal(detail.status, 'awaiting-approval', detail.error);
  const task = entries().find(entry => entry.kind === 'task');
  assert.ok(task.promptFile, 'the CLI was handed a prompt file');
  assert.match(path.basename(task.promptFile), /^sansheng-prompt-/);
  assert.equal(fs.existsSync(task.promptFile), false, 'the prompt file is cleaned up');
  court.dispose();
});
