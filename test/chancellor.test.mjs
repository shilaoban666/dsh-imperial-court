// 丞相府（Router–Worker）与 v1.1 的几处修复：真的 git 仓库 + 假 CLI。
//   接活、分拣、排队、派发、汇总；钦定流程直办与并行；路径规范化；Host 校验；「被打断」进索引。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createCourt, checkRequest, hostAllowed, handleRequest, chooseMode, routeMinistry } from '../index.mjs';
import { splitRequests, priorityOf, orderQueue, pickNext, triage, digest } from '../lib/chancellor.mjs';
import { normalizeSteps } from '../lib/court.mjs';
import { repoInfo } from '../lib/git.mjs';
import { cleanWorkflow, resolveWorkflow } from '../lib/workflows.mjs';
import { ROLE_IDS, MINISTRY_IDS } from '../lib/i18n.mjs';

const FAKE = fileURLToPath(new URL('./fake-agent.mjs', import.meta.url));
const tmp = prefix => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

function sh(cwd, ...args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (res.status) throw new Error(`git ${args.join(' ')}: ${res.stderr}`);
  return res.stdout.trim();
}

function makeRepo() {
  const dir = tmp('court-repo-');
  sh(dir, 'init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(dir, 'README.md'), '# demo\n');
  sh(dir, 'add', '-A');
  sh(dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'init');
  return dir;
}

function makeCourt({ flags = '', rules = {}, dataDir = tmp('court-data-'), configure = true } = {}) {
  const log = path.join(dataDir, 'fake.log');
  const court = createCourt({ dataDir }, { log: { info() {}, error() {} } });
  if (configure) {
    const fake = id => ({
      id, name: id, adapter: 'cli', command: process.execPath, args: [FAKE],
      env: { FAKE_FLAGS: flags, FAKE_LOG: log, FAKE_FORMAT: 'text' }, timeoutMs: 30000,
    });
    const roles = {};
    for (const id of ROLE_IDS) roles[id] = { agentId: 'fa', model: '' };
    roles.menxia.agentId = 'fb';
    court.api.savePreset({
      agents: [fake('fa'), fake('fb')], roles,
      rules: { ...court.store.state.rules, fallbackAgentId: '', mode: 'standard', historian: false, regimePowers: false, ...rules },
    });
    court.api.setUi({ style: 'ancient' });
  }
  const entries = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : []);
  return { court, api: court.api, entries, dataDir };
}

const SETTLED = ['awaiting-approval', 'done', 'failed', 'cancelled', 'rejected'];

// ---------- 接活：拆 ----------

test('splitRequests splits a list of unrelated tasks and keeps one coherent task whole', () => {
  assert.deepEqual(splitRequests('1. fix the login bug\n2. write the README\n3. add a dark theme'), ['fix the login bug', 'write the README', 'add a dark theme']);
  assert.deepEqual(splitRequests('- 修登录 bug\n- 写周报'), ['修登录 bug', '写周报']);
  assert.deepEqual(splitRequests('一、修登录 bug\n二、写周报'), ['修登录 bug', '写周报']);
  assert.deepEqual(splitRequests('① alpha task\n② beta task'), ['alpha task', 'beta task']);
  // 清单前面的话是共同的背景，拼到每一条前面；条目的续行跟着条目走
  assert.deepEqual(
    splitRequests('In the api repo:\n1. fix the login bug\n   it returns 500\n2. add rate limiting'),
    ['In the api repo:\nfix the login bug\n   it returns 500', 'In the api repo:\nadd rate limiting'],
  );
  // 一段连贯的话、只有一条的清单、「1.5 倍」这样的数字都不拆
  assert.deepEqual(splitRequests('把登录修好，然后补测试，并且更新文档'), ['把登录修好，然后补测试，并且更新文档']);
  assert.deepEqual(splitRequests('1. only one thing'), ['1. only one thing']);
  assert.deepEqual(splitRequests('1.5 倍速播放要支持\n2.0 倍也要'), ['1.5 倍速播放要支持\n2.0 倍也要']);
  // 代码块里的短横不是清单
  assert.equal(splitRequests('fix this output:\n```\n- a\n- b\n```').length, 1);
  // 两三个字的要点不是差事
  assert.equal(splitRequests('要求：\n- 快\n- 稳\n- 省').length, 1);
  // 最多 12 道，多出来的并进最后一道
  const many = splitRequests(Array.from({ length: 15 }, (_, i) => `${i + 1}. task number ${i + 1}`).join('\n'));
  assert.equal(many.length, 12);
  assert.match(many[11], /task number 12[\s\S]*task number 15/);
  assert.deepEqual(splitRequests('   '), []);
});

// ---------- 分拣与排队 ----------

test('triage picks the procedure and urgency; the queue releases urgent first, then short work, then first come', () => {
  assert.equal(priorityOf('线上故障，紧急修复'), 2);
  assert.equal(priorityOf('hotfix the payment page ASAP'), 2);
  assert.equal(priorityOf('有空再整理一下文档'), 0);
  assert.equal(priorityOf('write a poem'), 1);
  assert.equal(priorityOf('write a poem', 'high'), 2, 'an explicit priority wins over the wording');
  assert.equal(priorityOf('紧急', 'low'), 0);

  const sorted = triage('写首诗', { chooseMode, routeMinistry });
  assert.deepEqual([sorted.mode, sorted.ministry, sorted.priority], ['express', 'rites', 1]);
  assert.equal(triage('x'.repeat(500), { chooseMode, routeMinistry }).mode, 'grand');

  const queue = [
    { id: 'a', at: 1, priority: 1, mode: 'standard', state: 'waiting' },
    { id: 'b', at: 2, priority: 1, mode: 'express', state: 'waiting' },
    { id: 'c', at: 3, priority: 2, mode: 'grand', state: 'waiting' },
    { id: 'd', at: 4, priority: 1, mode: 'standard', state: 'waiting' },
    { id: 'e', at: 0, priority: 2, mode: 'express', state: 'refused' },
  ];
  assert.deepEqual(orderQueue(queue.filter(item => item.state === 'waiting')).map(item => item.id), ['c', 'b', 'a', 'd']);
  assert.equal(pickNext(queue).id, 'c', 'refused entries are never released');
  assert.equal(pickNext(queue, item => item.id === 'c').id, 'b', 'a blocked entry does not hold up the rest');
  assert.equal(pickNext([]), null);
});

test('the digest lists only what needs the human', () => {
  const now = Date.now();
  const edicts = [
    { id: 'e1', brief: 'a', status: 'awaiting-approval', updatedAt: now },
    { id: 'e2', brief: 'b', status: 'awaiting-input', updatedAt: now },
    { id: 'e3', brief: 'c', status: 'running', updatedAt: now },
    { id: 'e4', brief: 'd', status: 'done', updatedAt: now },
    { id: 'e5', brief: 'e', status: 'failed', updatedAt: now },
    { id: 'e6', brief: 'f', status: 'failed', updatedAt: now - 5 * 86400000 },
    { id: 'e7', brief: 'g', status: 'failed', interrupted: true, updatedAt: now - 5 * 86400000 },
    { id: 'e8', brief: 'h', status: 'failed', interrupted: true, redoneAs: 'e9', updatedAt: now },
  ];
  const queue = [{ id: 'q-1', brief: 'x', state: 'waiting' }, { id: 'q-2', brief: 'y', state: 'refused', error: 'budget' }];
  const box = digest(edicts, queue, { now, activeIds: ['e3'] });
  assert.deepEqual(box.needsYou.map(item => `${item.id}:${item.kind}`), ['e1:approve', 'e2:input', 'e5:failed', 'e7:interrupted', 'q-2:refused']);
  assert.deepEqual([box.running, box.queued, box.doneToday, box.failedToday], [1, 1, 1, 1]);
});

// ---------- 修复 ----------

test('repoInfo finds the subfolder even when the path goes through a link (8.3 names, symlinks, junctions)', t => {
  const repo = makeRepo();
  fs.mkdirSync(path.join(repo, 'packages', 'app'), { recursive: true });
  assert.equal(repoInfo(repo).rel, '');
  assert.equal(repoInfo(path.join(repo, 'packages', 'app')).rel, path.join('packages', 'app'));
  // 换一个名字指向同一个仓库：git 报的是真实路径，按字符串比两边会得到一串 ..\..\
  const link = path.join(tmp('court-link-'), 'alias');
  try {
    fs.symlinkSync(repo, link, 'junction');
  } catch {
    t.diagnostic('cannot create a link here; skipping the aliased half');
    return;
  }
  const info = repoInfo(path.join(link, 'packages', 'app'));
  assert.equal(info.rel, path.join('packages', 'app'));
  assert.ok(!info.rel.startsWith('..'));
});

test('a decree issued through an aliased path still runs in its isolated worktree', async t => {
  const repo = makeRepo();
  const link = path.join(tmp('court-link-'), 'alias');
  try {
    fs.symlinkSync(repo, link, 'junction');
  } catch {
    t.diagnostic('cannot create a link here; skipping');
    return;
  }
  const { api, court } = makeCourt({ rules: { mode: 'express' } });
  const { id } = api.createEdict({ brief: 'write hello', workspace: link });
  await court.idle();
  const detail = api.getEdict(id);
  assert.equal(detail.status, 'awaiting-approval', detail.error);
  assert.ok(detail.git && detail.git.stat.files.some(item => item.file === 'hello.txt'));
});

test('requests whose Host is a foreign domain are refused, reads included (DNS rebinding)', () => {
  assert.equal(hostAllowed('localhost:7000'), true);
  assert.equal(hostAllowed('127.0.0.1:7000'), true);
  assert.equal(hostAllowed('[::1]:7000'), true);
  assert.equal(hostAllowed('dsh.localhost'), true);
  assert.equal(hostAllowed('192.168.1.20:7000'), true, 'an IP literal cannot be rebound');
  assert.equal(hostAllowed(''), true, 'non-browser clients may omit Host');
  assert.equal(hostAllowed('evil.example:7000'), false);
  assert.equal(hostAllowed('localhost.evil.example'), false);
  assert.equal(hostAllowed('dsh.corp.example', ['dsh.corp.example']), true);
  const rebound = { headers: { host: 'evil.example:7000', origin: 'http://evil.example:7000', 'content-type': 'application/json' } };
  assert.equal(checkRequest(rebound, 'GET'), 'errOrigin');
  assert.equal(checkRequest(rebound, 'POST'), 'errOrigin');
  assert.equal(checkRequest({ headers: { host: 'localhost:7000' } }, 'GET'), null);
});

test('an interrupted decree shows up in the list the inbox reads, until it is picked up again', async () => {
  const repo = makeRepo();
  const first = makeCourt({ flags: 'slow' });
  const { id } = first.api.createEdict({ brief: 'write hello', workspace: repo });
  first.court.dispose();
  await new Promise(resolve => setTimeout(resolve, 200));
  // 模拟 DSH 在办到一半时退出：磁盘上的状态还停在「办差中」
  const edict = first.court.store.getEdict(id);
  edict.status = 'running';
  first.court.store.saveEdict(edict);

  const again = makeCourt({ dataDir: first.dataDir, configure: false });
  const listed = again.api.getState().edicts.find(item => item.id === id);
  assert.equal(listed.interrupted, true);
  assert.deepEqual(again.api.inbox().needsYou.map(item => item.kind), ['interrupted']);
  const redo = again.api.redo(id);
  assert.equal(again.api.getState().edicts.find(item => item.id === id).redoneAs, redo.id);
  await again.court.idle();
  again.court.dispose();
});

// ---------- 丞相府端到端 ----------

test('the chancellor splits a list, starts what fits, queues the rest and releases urgent work first', async () => {
  const repo = makeRepo();
  const { api, court } = makeCourt({ flags: 'slow', rules: { maxConcurrent: 1, mode: 'express' } });
  const result = api.dispatch({ brief: '1. write alpha\n2. write beta\n3. urgent: write gamma', workspace: repo });
  assert.equal(result.accepted.length, 3);
  assert.deepEqual([result.started, result.queued, result.refused], [1, 2, 0]);
  assert.match(result.batch, /^batch-/);
  // 只有一个位子：第三条是急件，它先开朝；其余两条按先来后到候旨
  assert.deepEqual(result.accepted.map(item => item.state), ['queued', 'queued', 'started']);
  assert.deepEqual(result.accepted.slice(0, 2).map(item => item.position), [1, 2]);

  const state = api.getState();
  assert.equal(state.full, true);
  assert.deepEqual(state.queue.map(item => item.brief), ['write alpha', 'write beta']);
  assert.deepEqual([state.digest.running, state.digest.queued], [1, 2]);

  await court.idle();
  const edicts = api.getState().edicts.slice().sort((a, b) => a.createdAt - b.createdAt);
  assert.deepEqual(edicts.map(item => item.brief), ['urgent: write gamma', 'write alpha', 'write beta']);
  assert.equal(api.getState().queue.length, 0);
  const details = edicts.map(item => api.getEdict(item.id));
  for (const detail of details) assert.equal(detail.status, 'awaiting-approval', detail.error);
  // 每道旨一个隔离分支，互不相扰；同批、排过队的都记在案
  assert.equal(new Set(details.map(detail => detail.git.branch)).size, 3);
  assert.ok(details.every(detail => detail.batch === result.batch));
  assert.ok(details[1].waitedMs > 0);
  assert.equal(api.inbox().needsYou.length, 3);
  // 原仓库在批红之前一个字节都没动
  assert.equal(sh(repo, 'status', '--porcelain'), '');
  assert.equal(fs.existsSync(path.join(repo, 'hello.txt')), false);
});

test('a full court queues instead of refusing; queued decrees can be bumped or withdrawn', async () => {
  const repo = makeRepo();
  const { api, court } = makeCourt({ flags: 'slow', rules: { maxConcurrent: 1, mode: 'express' } });
  const first = api.submit({ brief: 'write one', workspace: repo });
  assert.equal(first.queued, false);
  assert.ok(first.id);

  const res = { status: 0, body: '', writeHead(code) { this.status = code; }, end(text) { this.body = text; } };
  const body = JSON.stringify({ brief: 'write two', workspace: repo });
  const req = {
    url: '/sansheng-liubu/edicts', method: 'POST', headers: { host: 'localhost', 'content-type': 'application/json' },
    on(event, handler) { if (event === 'data') handler(Buffer.from(body)); if (event === 'end') handler(); },
  };
  await handleRequest(api, req, res, court.uiLocale);
  assert.equal(res.status, 200, res.body);
  const second = JSON.parse(res.body);
  assert.equal(second.queued, true);
  assert.equal(second.position, 1);

  const third = api.submit({ brief: 'write three', workspace: repo });
  assert.equal(third.position, 2);
  // 同一毫秒递进来的也分得出先后：后来的排在后面
  const fourth = api.submit({ brief: 'write four', workspace: repo });
  const fifth = api.submit({ brief: 'write five', workspace: repo });
  assert.deepEqual([fourth.position, fifth.position], [3, 4]);
  api.unqueue(fourth.queueId);
  api.unqueue(fifth.queueId);
  assert.deepEqual(api.bump(third.queueId).queue.map(item => item.brief), ['write three', 'write two']);
  assert.deepEqual(api.unqueue(second.queueId).queue.map(item => item.brief), ['write three']);
  assert.throws(() => api.unqueue('q-nope'), /候旨队列里没有/);
  // 写不出需求、目录不存在的当场就拒，不进队列
  assert.throws(() => api.submit({ brief: '  ' }), /圣意不能为空/);
  assert.throws(() => api.submit({ brief: 'x', workspace: path.join(repo, 'no-such-dir') }), /no-such-dir/);

  await court.idle();
  assert.deepEqual(api.getState().edicts.map(item => item.brief).sort(), ['write one', 'write three']);
});

test('the queue survives a restart and picks up where it left off', async () => {
  const repo = makeRepo();
  const first = makeCourt({ flags: 'slow', rules: { maxConcurrent: 1, mode: 'express' } });
  const result = first.api.dispatch({ items: ['write one', 'write two'], workspace: repo });
  assert.deepEqual([result.started, result.queued], [1, 1]);
  first.court.dispose();
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal(first.api.getState().queue.length, 1, 'a disposed court does not release the queue');

  const again = makeCourt({ dataDir: first.dataDir, configure: false });
  assert.deepEqual(again.api.getState().queue.map(item => item.brief), ['write two']);
  await new Promise(resolve => setImmediate(resolve));
  await again.court.idle();
  const released = again.api.getState().edicts.find(item => item.brief === 'write two');
  assert.ok(released, 'the queued decree was released after the restart');
  assert.equal(again.api.getEdict(released.id).status, 'awaiting-approval');
  assert.equal(again.api.getState().queue.length, 0);
  again.court.dispose();
});

test('a batch can be handed over unattended: it repairs itself and archives without the human', async () => {
  const repo = makeRepo();
  const { api, court } = makeCourt({ rules: { maxConcurrent: 2, mode: 'standard' } });
  const result = api.dispatch({ items: ['write hello', 'write hello again'], workspace: repo, autonomous: true });
  assert.equal(result.started, 2);
  await court.idle();
  for (const item of result.accepted) {
    const detail = api.getEdict(item.edictId);
    assert.equal(detail.autonomous, true);
    assert.equal(detail.status, 'done', detail.error);
  }
  assert.equal(api.inbox().needsYou.length, 0, 'nothing is left for the human');
  assert.equal(api.inbox().doneToday, 2);
  // 存档里的朝规没被改：下一道照旧要批红
  assert.equal(api.getState().rules.autonomous, false);
});

// ---------- 钦定流程：直办与并行 ----------

test('workflow steps can be marked to run alongside the previous one', () => {
  const ids = new Set(MINISTRY_IDS);
  const raw = ['war', 'justice', 'works', 'rites'].map(ministry => ({ ministry, title: ministry, instruction: 'x' }));
  const chain = normalizeSteps(raw, 8, ids, { sequential: true });
  assert.deepEqual(chain.map(step => step.after), [[], [1], [2], [3]], 'unmarked steps stay a chain');
  const grouped = normalizeSteps(raw, 8, ids, { sequential: true, parallel: [false, true, true, false] });
  assert.deepEqual(grouped.map(step => step.after), [[], [], [], [1, 2, 3]], 'the step after a group waits for the whole group');
  const middle = normalizeSteps(raw, 8, ids, { sequential: true, parallel: [false, false, true, false] });
  assert.deepEqual(middle.map(step => step.after), [[], [1], [1], [2, 3]]);
  // 流程存档只在标了并行时才带这个字段
  assert.deepEqual(cleanWorkflow([{ ministry: 'war', title: 'a' }, { ministry: 'works', title: 'b', parallel: true }, { ministry: 'nope' }]),
    [{ ministry: 'war', title: 'a' }, { ministry: 'works', title: 'b', parallel: true }]);
  assert.equal(resolveWorkflow('video', [], 'en').filter(step => step.parallel).length, 1, 'the video template scores the film while the visuals render');
});

test('a fixed workflow goes straight to work: no draft, no veto round, fewer calls, same audit', async () => {
  const repo = makeRepo();
  const workflow = 'war,justice,rites';

  const classic = makeCourt();
  const a = classic.api.createEdict({ brief: 'ship the feature', workspace: repo, workflow });
  await classic.court.idle();
  assert.equal(classic.api.getEdict(a.id).status, 'awaiting-approval');
  const classicCalls = classic.entries().map(entry => entry.kind);
  assert.deepEqual(classicCalls.filter(kind => kind === 'draft' || kind === 'review'), ['draft', 'review']);

  const direct = makeCourt({ rules: { workflowDirect: true } });
  const b = direct.api.createEdict({ brief: 'ship the feature', workspace: repo, workflow });
  assert.equal(b.direct, true);
  await direct.court.idle();
  const detail = direct.api.getEdict(b.id);
  assert.equal(detail.status, 'awaiting-approval', detail.error);
  assert.equal(detail.direct, true);
  assert.deepEqual(detail.steps.map(step => `${step.ministry}:${step.status}`), ['war:done', 'justice:done', 'rites:done']);
  assert.deepEqual(detail.steps.map(step => step.after), [[], [1], [2]]);
  const directCalls = direct.entries().map(entry => entry.kind);
  assert.deepEqual(directCalls.filter(kind => kind === 'draft' || kind === 'review'), [], 'no drafting and no veto round');
  assert.equal(directCalls.filter(kind => kind === 'recheck').length, 1, 'the result is still audited');
  assert.deepEqual(directCalls.slice().sort(), ['recheck', 'task', 'task', 'task'], 'three steps and one audit: the draft and review calls are gone');
  assert.ok(detail.messages.some(message => /直办|straight to work/i.test(`${message.title} ${message.summary}`)));

  // 没有钦定流程的旨不受这条朝规影响；逐道也可以关掉
  const free = direct.api.createEdict({ brief: 'ship the feature', workspace: repo, workflow: 'none' });
  assert.equal(free.direct, false);
  const off = direct.api.createEdict({ brief: 'ship the feature', workspace: repo, workflow, direct: false });
  assert.equal(off.direct, false);
  await direct.court.idle();
});

test('parallel workflow steps really overlap in time', async () => {
  const repo = makeRepo();
  const { api, court, entries } = makeCourt({ flags: 'slow', rules: { workflowDirect: true, parallel: 2 } });
  const workflow = [{ ministry: 'war', title: 'visuals' }, { ministry: 'works', title: 'music', parallel: true }, { ministry: 'justice', title: 'check' }];
  const { id } = api.createEdict({ brief: 'make the film', workspace: repo, workflow });
  await court.idle();
  const detail = api.getEdict(id);
  assert.equal(detail.status, 'awaiting-approval', detail.error);
  assert.deepEqual(detail.steps.map(step => step.after), [[], [], [1, 2]]);
  assert.deepEqual(entries().filter(entry => entry.kind === 'task').map(entry => entry.ministry).sort(), ['justice', 'war', 'works']);
  // 用朝堂自己记的派出、收回时刻来比：子进程里记的时刻含启动耗时，机器忙时两个进程能差出半秒以上
  const call = ministry => detail.calls.find(item => item.roleId === ministry);
  const [war, works, justice] = [call('war'), call('works'), call('justice')];
  assert.ok(war.startedAt < works.endedAt && works.startedAt < war.endedAt, 'the two marked steps ran at the same time');
  assert.ok(justice.startedAt >= Math.max(war.endedAt, works.endedAt), 'the next step waited for both');
});
