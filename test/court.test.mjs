// 端到端：真的 git 仓库 + 假 CLI（test/fake-agent.mjs），跑完整朝会。
// 运行：npm test（即 node --test）
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createCourt, checkRequest, readableReport, handleRequest, chooseMode, routeMinistry } from '../index.mjs';
import { parseOutput, tailLine, costOf } from '../lib/treasury.mjs';
import { parsePage, renderPage } from '../lib/wiki.mjs';
import { extractJson, splitHandoff } from '../lib/prompts.mjs';
import { normalizeSteps } from '../lib/court.mjs';
import { tokens } from '../lib/annals.mjs';
import { ROLE_IDS, MINISTRY_IDS } from '../lib/i18n.mjs';
import { resolveWorkflow } from '../lib/workflows.mjs';
import { regimeOf, familyOf, puppetIndex, actualRegimeOf, OFFICES } from '../lib/regime.mjs';

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

function makeCourt({ flags = '', rules = {}, manualRites = false, locale = '', execArgs = [], autoArgs = [], format = 'text' } = {}) {
  const dataDir = tmp('court-data-');
  const log = path.join(dataDir, 'fake.log');
  const court = createCourt({ dataDir }, { log: { info() {}, error() {} } });
  const fake = id => ({
    id, name: id, adapter: 'cli', command: process.execPath, args: [FAKE], execArgs, autoArgs,
    // 像 dsh headless 一样靠环境变量定权限、选模型
    permissionEnv: 'FAKE_PERM', modelEnv: 'FAKE_MODEL',
    outputFormat: format, resumeArgs: format === 'claude-stream' ? ['--resume', '{session}'] : [],
    env: { FAKE_FLAGS: flags, FAKE_LOG: log, FAKE_FORMAT: format }, timeoutMs: 30000,
  });
  const agents = [fake('fa'), fake('fb'), { id: 'man', name: 'Manual', adapter: 'manual' }];
  const roles = {};
  for (const id of ROLE_IDS) roles[id] = { agentId: 'fa', model: '' };
  roles.menxia.agentId = 'fb';
  if (manualRites) roles.rites.agentId = 'man';
  // 老用例按常朝跑；急递 / 大朝会 / 自动另有用例。史官默认关，免得多一次调用干扰计数
  court.api.savePreset({ agents, roles, rules: { ...court.store.state.rules, fallbackAgentId: '', mode: 'standard', historian: false, ...rules } });
  if (locale) court.api.setUi({ locale });
  const entries = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : []);
  return { court, api: court.api, entries, dataDir };
}

async function waitFor(api, id, statuses, timeout = 25000) {
  const until = Date.now() + timeout;
  for (;;) {
    const detail = api.getEdict(id);
    if (statuses.includes(detail.status)) return detail;
    if (Date.now() > until) throw new Error(`timed out in status ${detail.status}: ${detail.error || detail.note}`);
    await new Promise(resolve => setTimeout(resolve, 40));
  }
}

test('extractJson tolerates fences and chatter', () => {
  assert.deepEqual(extractJson('sure!\n```json\n{"a":{"b":"}"}}\n```'), { a: { b: '}' } });
  assert.equal(extractJson('no json here'), null);
});

test('splitHandoff strips the referral JSON from the report', () => {
  const { body, handoff } = splitHandoff('fixed it\n{"handoff":{"to":"justice","reason":"tests"}}', new Set(MINISTRY_IDS));
  assert.equal(body, 'fixed it');
  assert.deepEqual(handoff, { to: 'justice', reason: 'tests', deliverable: '' });
});

test('readableReport turns plans and verdicts into sentences', () => {
  const plan = readableReport('{"summary":"ship it","steps":[{"ministry":"war","title":"code"}]}', { parse: 'plan', locale: 'en' });
  assert.match(plan.summary, /ship it\nOrders \(1\): Legate · code/);
  const verdict = readableReport('{"verdict":"reject","issues":["no tests"]}', { parse: 'verdict', locale: 'zh' });
  assert.equal(verdict.summary, '封驳: no tests');
});

test('normalizeSteps maps "after" to sequence numbers and defaults to sequential', () => {
  const ids = new Set(MINISTRY_IDS);
  const steps = normalizeSteps([
    { ministry: 'war' }, { ministry: 'nope' }, { ministry: 'justice', after: [] }, { ministry: 'rites', after: [1, 3] }, { ministry: 'works' },
  ], 8, ids);
  assert.deepEqual(steps.map(step => [step.seq, step.after]), [[1, []], [2, []], [3, [1, 2]], [4, [3]]]);
  const fixed = normalizeSteps([{ ministry: 'war', after: [] }, { ministry: 'justice', after: [] }], 8, ids, { sequential: true });
  assert.deepEqual(fixed.map(step => step.after), [[], [1]]);
});

test('checkRequest blocks cross-site and non-JSON writes', () => {
  const req = headers => ({ headers: { host: 'localhost:7000', ...headers } });
  assert.equal(checkRequest(req({}), 'GET'), null);
  assert.equal(checkRequest(req({ 'content-type': 'text/plain' }), 'POST'), 'errJsonOnly');
  assert.equal(checkRequest(req({ 'content-type': 'application/json', origin: 'https://evil.example' }), 'POST'), 'errOrigin');
  assert.equal(checkRequest(req({ 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' }), 'POST'), 'errOrigin');
  assert.equal(checkRequest(req({ 'content-type': 'application/json', origin: 'http://localhost:7000' }), 'POST'), null);
  assert.equal(checkRequest(req({ 'content-type': 'application/json', origin: 'http://127.0.0.1:5173' }), 'POST'), null);
});

test('HTTP layer refuses a form-style POST and answers in the requested language', async () => {
  const { api, court } = makeCourt();
  const res = { status: 0, body: '', writeHead(status) { this.status = status; }, end(text) { this.body = text; } };
  const req = { url: '/sansheng-liubu/edicts', method: 'POST', headers: { host: 'localhost', 'content-type': 'text/plain', 'x-court-locale': 'en' } };
  await handleRequest(api, req, res, court.uiLocale);
  assert.equal(res.status, 403);
  assert.match(JSON.parse(res.body).error, /application\/json/);
});

test('resolveWorkflow understands templates, ids and "none"', () => {
  assert.equal(resolveWorkflow('dev', [], 'en')[0].title, 'Implement the feature');
  assert.deepEqual(resolveWorkflow('war, justice', []).map(step => step.ministry), ['war', 'justice']);
  assert.deepEqual(resolveWorkflow('none', [{ ministry: 'war' }]), []);
  assert.deepEqual(resolveWorkflow(undefined, [{ ministry: 'war', title: 'x' }]), [{ ministry: 'war', title: 'x' }]);
});

test('tokens split CJK into bigrams and latin into words', () => {
  assert.deepEqual([...tokens('汇总报表 for reports')].sort(), ['for', 'reports', '报表', '总报', '汇总'].sort());
});

test('standard mode: work happens on an isolated branch, approval merges it', async () => {
  const repo = makeRepo();
  const { api, entries } = makeCourt({ execArgs: ['--may-write'] });
  const { id } = api.createEdict({ brief: 'write a hello file', workspace: repo });
  const detail = await waitFor(api, id, ['awaiting-approval', 'failed']);
  assert.equal(detail.status, 'awaiting-approval', detail.error);
  assert.equal(detail.git.branch, `court/${id}`);
  assert.ok(detail.git.stat.files.some(file => file.file === 'hello.txt'));
  assert.ok(!fs.existsSync(path.join(repo, 'hello.txt')), 'original folder untouched before approval');
  assert.ok(detail.artifacts.includes('07-changes.patch'));
  // 执行差事带写权限参数，拟旨 / 审议不带
  const tasks = entries().filter(entry => entry.kind === 'task');
  assert.ok(tasks.length >= 2 && tasks.every(entry => entry.args.includes('--may-write')));
  assert.ok(tasks.every(entry => !entry.cwd.toLowerCase().startsWith(repo.toLowerCase())), 'agents ran inside the worktree');
  assert.ok(entries().find(entry => entry.kind === 'draft').isolated);

  const approved = api.approve(id);
  assert.equal(approved.status, 'done');
  assert.ok(approved.git.merged);
  // Windows 上 core.autocrlf 可能把换行换成 CRLF
  assert.equal(fs.readFileSync(path.join(repo, 'hello.txt'), 'utf8').replace(/\r\n/g, '\n'), 'war was here\n');
  assert.equal(sh(repo, 'branch', '--list', `court/${id}`), '', 'branch deleted after merge');
});

test('approval refuses to merge onto the wrong branch and leaves the decree pending', async () => {
  const repo = makeRepo();
  const { api } = makeCourt();
  const { id } = api.createEdict({ brief: 'write a hello file', workspace: repo });
  const waiting = await waitFor(api, id, ['awaiting-approval']);
  // 朝堂中栏要的是各部回奏全文，按差事序号对得上
  assert.ok(waiting.results.length >= 1);
  assert.ok(waiting.results.every(item => waiting.steps.some(step => step.seq === item.seq) && item.summary.includes('done: wrote')));
  sh(repo, 'checkout', '-q', '-b', 'other');
  assert.throws(() => api.approve(id), /other/);
  assert.equal(api.getEdict(id).status, 'awaiting-approval');
  sh(repo, 'checkout', '-q', 'main');
  assert.equal(api.approve(id).status, 'done');
});

test('rejecting keeps a snapshot branch that can be discarded', async () => {
  const repo = makeRepo();
  const { api } = makeCourt();
  const { id } = api.createEdict({ brief: 'write a hello file', workspace: repo });
  await waitFor(api, id, ['awaiting-approval']);
  api.reject(id, 'wrong file name, use greeting.txt');
  assert.ok(sh(repo, 'branch', '--list', `court/${id}`));
  const discarded = api.discard(id);
  assert.ok(discarded.git.discarded);
  assert.equal(sh(repo, 'branch', '--list', `court/${id}`), '');
  // 驳回理由进了史馆
  const lessons = api.annals().entries.find(entry => entry.id === id).lessons;
  assert.ok(lessons.some(lesson => lesson.kind === 'rejected' && lesson.text.includes('greeting.txt')));
});

test('review is fail-closed: unparsable verdicts never pass in standard mode', async () => {
  const { api } = makeCourt({ flags: 'review-garbage' });
  const dir = tmp('court-plain-');
  const { id } = api.createEdict({ brief: 'anything', workspace: dir });
  const detail = await waitFor(api, id, ['failed', 'awaiting-approval']);
  assert.equal(detail.status, 'failed');
  assert.match(detail.error, /JSON/);
  assert.equal(detail.steps.length, 0, 'nothing was dispatched');
});

test('an unparsable review is retried once with a format reminder', async () => {
  const { api, entries } = makeCourt({ flags: 'review-garbage-once' });
  const { id } = api.createEdict({ brief: 'anything', workspace: tmp('court-plain-') });
  const detail = await waitFor(api, id, ['failed', 'awaiting-approval']);
  assert.equal(detail.status, 'awaiting-approval', detail.error);
  assert.deepEqual(entries().filter(entry => entry.kind === 'review').map(entry => entry.retry), [false, true]);
});

test('independent orders run in parallel and the join waits for both', async () => {
  const { api, entries } = makeCourt({ flags: 'parallel,slow', rules: { parallel: 2 } });
  const { id } = api.createEdict({ brief: 'parallel work', workspace: tmp('court-plain-') });
  const detail = await waitFor(api, id, ['awaiting-approval', 'failed']);
  assert.equal(detail.status, 'awaiting-approval', detail.error);
  const tasks = entries().filter(entry => entry.kind === 'task');
  const a = tasks.find(entry => entry.ministry === 'war');
  const b = tasks.find(entry => entry.ministry === 'justice');
  const c = tasks.find(entry => entry.ministry === 'works');
  assert.ok(a.start < b.end && b.start < a.end, 'war and justice overlapped');
  assert.ok(c.start >= Math.max(a.end, b.end), 'join started after both');
});

test('referrals become orders, and the JSON never reaches the chat', async () => {
  const { api } = makeCourt({ flags: 'handoff' });
  const { id } = api.createEdict({ brief: 'fix a bug', workspace: tmp('court-plain-') });
  const detail = await waitFor(api, id, ['awaiting-approval', 'failed']);
  assert.deepEqual(detail.steps.map(step => [step.ministry, step.after]), [['war', []], ['justice', [1]]]);
  assert.ok(detail.messages.some(item => item.kind === 'referral' && item.to === 'justice'));
  assert.ok(detail.messages.every(item => !item.summary.includes('"handoff"')));
});

test('GUI-only offices pause for input, then the session carries on', async () => {
  const { api } = makeCourt({ flags: 'manual', manualRites: true });
  const { id } = api.createEdict({ brief: 'deck and code', workspace: tmp('court-plain-') });
  const waiting = await waitFor(api, id, ['awaiting-input', 'failed']);
  const step = waiting.steps.find(item => item.status === 'awaiting-input');
  assert.equal(step.ministry, 'rites');
  assert.ok(step.workOrder.endsWith('-workorder.md'));
  assert.throws(() => api.fill(id, step.seq, '   '), /回填|empty/);
  api.fill(id, step.seq, 'slides saved to deck.pptx');
  const detail = await waitFor(api, id, ['awaiting-approval', 'failed']);
  assert.equal(detail.status, 'awaiting-approval', detail.error);
  assert.equal(detail.steps.find(item => item.ministry === 'rites').status, 'done');
});

test('halting while waiting for input ends the session cleanly', async () => {
  const { api } = makeCourt({ flags: 'manual', manualRites: true });
  const { id } = api.createEdict({ brief: 'deck', workspace: tmp('court-plain-') });
  await waitFor(api, id, ['awaiting-input']);
  api.cancel(id);
  const detail = await waitFor(api, id, ['cancelled']);
  assert.equal(detail.status, 'cancelled');
});

test('the annals remember vetoes and feed them to the next similar decree', async () => {
  const { api, entries } = makeCourt({ flags: 'veto-always', rules: { maxReviewRounds: 1 } });
  const dir = tmp('court-plain-');
  const first = api.createEdict({ brief: 'refactor the CSV report parser', workspace: dir });
  await waitFor(api, first.id, ['failed']);
  const stats = api.annals().stats;
  assert.equal(stats.vetoes, 1);
  const second = api.createEdict({ brief: 'refactor the CSV report parser again', workspace: dir });
  await waitFor(api, second.id, ['failed']);
  assert.ok(api.getEdict(second.id).recalled > 0);
  const drafts = entries().filter(entry => entry.kind === 'draft');
  assert.equal(drafts.at(-1).lessons, true, 'lessons reached the Consul');
});

test('unisolated decrees may not share a folder; isolated ones may', async () => {
  const { api } = makeCourt({ flags: 'slow', rules: { maxConcurrent: 3 } });
  const plain = tmp('court-plain-');
  const first = api.createEdict({ brief: 'one', workspace: plain });
  assert.throws(() => api.createEdict({ brief: 'two', workspace: plain }), /目录|folder/);
  const repo = makeRepo();
  const a = api.createEdict({ brief: 'a', workspace: repo });
  const b = api.createEdict({ brief: 'b', workspace: repo });
  assert.ok(a.id && b.id);
  await Promise.all([first.id, a.id, b.id].map(id => waitFor(api, id, ['awaiting-approval', 'failed'])));
});

test('autonomous mode retries, remedies and auto-merges when allowed', async () => {
  const repo = makeRepo();
  const { api } = makeCourt({ rules: { autonomous: true, autoMerge: true } });
  const { id } = api.createEdict({ brief: 'write a hello file', workspace: repo });
  const detail = await waitFor(api, id, ['done', 'awaiting-approval', 'failed']);
  assert.equal(detail.status, 'done', detail.error);
  // 自动合并在 afterRun 里，稍等它落盘
  const until = Date.now() + 5000;
  while (!api.getEdict(id).git.merged && Date.now() < until) await new Promise(resolve => setTimeout(resolve, 30));
  assert.ok(fs.existsSync(path.join(repo, 'hello.txt')));
});

test('English locale speaks Roman', async () => {
  const { api } = makeCourt({ locale: 'en' });
  const { id } = api.createEdict({ brief: 'write a hello file', workspace: tmp('court-plain-') });
  const detail = await waitFor(api, id, ['awaiting-approval', 'failed']);
  assert.equal(detail.locale, 'en');
  assert.match(detail.note, /Awaiting your seal/);
  const memorial = api.getArtifact(id, '06-memorial.md');
  assert.match(memorial, /^# Report to Caesar/);
  assert.match(memorial, /Legate · write hello/);
  assert.match(api.getState().ministries.find(item => item.id === 'justice').title, /Praetor/);
});

// ---------------- v0.7：朝制、锦衣卫、御史、国库、实录、文书房 ----------------

test('parseOutput reads Claude stream-json usage, cost and session', () => {
  const raw = [
    '{"type":"system","subtype":"init","session_id":"s1"}',
    '{"type":"assistant","message":{"content":[{"type":"text","text":"hi"},{"type":"tool_use","name":"Bash","input":{"command":"npm test"}}]}}',
    '{"type":"result","subtype":"success","is_error":false,"result":"all done","session_id":"s1","total_cost_usd":0.042,"usage":{"input_tokens":10,"output_tokens":20,"cache_read_input_tokens":300,"cache_creation_input_tokens":40}}',
  ].join('\n');
  const parsed = parseOutput('claude-stream', raw);
  assert.equal(parsed.text, 'all done');
  assert.equal(parsed.sessionId, 's1');
  assert.deepEqual(parsed.usage, { input: 10, output: 20, cacheRead: 300, cacheWrite: 40, costUsd: 0.042, estimated: false });
  assert.equal(tailLine('claude-stream', raw.split('\n')[1]), 'hi\n▸ Bash npm test');
});

test('parseOutput reads Codex --json usage and splits cached input', () => {
  const raw = [
    '{"type":"thread.started","thread_id":"t9"}',
    '{"type":"item.completed","item":{"id":"i1","type":"command_execution","command":"ls"}}',
    '{"type":"item.completed","item":{"id":"i2","type":"agent_message","text":"{\\"verdict\\":\\"approve\\"}"}}',
    '{"type":"turn.completed","usage":{"input_tokens":5000,"cached_input_tokens":4000,"output_tokens":100}}',
  ].join('\n');
  const parsed = parseOutput('codex-json', raw);
  assert.equal(parsed.text, '{"verdict":"approve"}');
  assert.equal(parsed.sessionId, 't9');
  assert.deepEqual(parsed.usage, { input: 1000, output: 100, cacheRead: 4000, cacheWrite: 0, costUsd: null, estimated: false });
  assert.ok(costOf(parsed.usage, 'gpt-5-codex') > 0);
});

test('plain text output is estimated, never silently free', () => {
  const parsed = parseOutput('text', '你好 world', '一二三四 abcd efgh');
  assert.equal(parsed.usage.estimated, true);
  assert.ok(parsed.usage.input > 0 && parsed.usage.output > 0);
});

test('chooseMode and routeMinistry keep small jobs cheap', () => {
  assert.equal(chooseMode('auto', '修复登录页的 bug').mode, 'express');
  assert.equal(chooseMode('auto', 'x'.repeat(500)).mode, 'grand');
  assert.equal(chooseMode('auto', '把 CSV 汇总成月报，然后写周报，并且跑测试').mode, 'standard');
  assert.equal(chooseMode('grand', 'tiny').reason, 'reasonUser');
  assert.equal(routeMinistry('把 reports 里的 CSV 做成报表'), 'revenue');
  assert.equal(routeMinistry('translate the README'), 'rites');
  assert.equal(routeMinistry('随便看看'), 'war');
});

test('express mode is one call: no draft, no review, no audit', async () => {
  const { api, entries } = makeCourt({ rules: { mode: 'express' } });
  const { id, mode } = api.createEdict({ brief: 'write a hello file', workspace: tmp('court-plain-') });
  assert.equal(mode, 'express');
  const detail = await waitFor(api, id, ['awaiting-approval', 'failed']);
  assert.equal(detail.status, 'awaiting-approval', detail.error);
  const kinds = entries().map(entry => entry.kind);
  assert.deepEqual(kinds, ['task']);
  assert.equal(detail.steps.length, 1);
  assert.equal(detail.spend.calls, 1);
});

test('the treasury books every call and flags vetoed drafts as waste', async () => {
  const { api, court } = makeCourt({ flags: 'veto-once', format: 'claude-stream' });
  const { id } = api.createEdict({ brief: 'two step job, then check it', workspace: tmp('court-plain-') });
  const detail = await waitFor(api, id, ['awaiting-approval', 'failed']);
  assert.equal(detail.status, 'awaiting-approval', detail.error);
  assert.ok(detail.spend.costUsd > 0);
  assert.ok(detail.spend.cacheRead > 0);
  const vetoed = detail.calls.filter(call => call.outcome === 'vetoed');
  assert.equal(vetoed.length, 1, 'round-1 draft counted as waste');
  const { stats } = api.treasury();
  assert.ok(stats.totals.wasteUsd > 0 && stats.wasteRate > 0);
  assert.ok(stats.cacheHitRate > 0.5);
  assert.ok(court.store.root);
});

test('redrafts resume the same session and send only the delta', async () => {
  const { api, entries } = makeCourt({ flags: 'veto-once', format: 'claude-stream' });
  const { id } = api.createEdict({ brief: 'two step job, then check it', workspace: tmp('court-plain-') });
  await waitFor(api, id, ['awaiting-approval', 'failed']);
  const resumed = entries().filter(entry => entry.kind === 'resume');
  assert.ok(resumed.some(entry => entry.session === 'sess-draft' && /门下省封驳了你的方案|vetoed your plan/.test(entry.delta)));
  assert.ok(resumed.some(entry => entry.session === 'sess-review'));
  assert.ok(api.getEdict(id).calls.some(call => call.resumed));
});

test('the Praetorian Guard admonishes a shirking report and the redo escalates', async () => {
  const { api, entries } = makeCourt({ flags: 'lazy-once,single', rules: { maxRetries: 2 } });
  const { id } = api.createEdict({ brief: 'two step job, then check it', workspace: tmp('court-plain-') });
  const detail = await waitFor(api, id, ['awaiting-approval', 'failed']);
  assert.equal(detail.status, 'awaiting-approval', detail.error);
  assert.ok(detail.messages.some(item => item.kind === 'admonish' && item.from === 'jinyiwei'));
  const tasks = entries().filter(entry => entry.kind === 'task');
  assert.equal(tasks[0].lazy, true);
  assert.match(tasks[1].pressure, /申饬|Admonition/);
  assert.equal(detail.calls.filter(call => call.outcome === 'retried').length, 1);
});

test('the inspector impeaches a missing deliverable without spending a token', async () => {
  const { api } = makeCourt({ flags: 'no-file-once,single' });
  const { id } = api.createEdict({ brief: 'two step job, then check it', workspace: tmp('court-plain-') });
  const detail = await waitFor(api, id, ['awaiting-approval', 'failed']);
  assert.ok(detail.messages.some(item => item.kind === 'impeach' && item.from === 'yushi'));
  assert.equal(detail.steps[0].status, 'done');
  assert.ok(detail.steps[0].impeachments.length);
});

test('grand mode sends every order to the inspector', async () => {
  const { api, entries } = makeCourt({ flags: 'impeach-once,single', rules: { mode: 'grand' } });
  const { id } = api.createEdict({ brief: 'two step job, then check it', workspace: tmp('court-plain-') });
  const detail = await waitFor(api, id, ['awaiting-approval', 'failed']);
  assert.equal(detail.status, 'awaiting-approval', detail.error);
  assert.equal(entries().filter(entry => entry.kind === 'inspect').length, 2, 'impeached once, passed on redo');
  assert.ok(detail.messages.some(item => item.kind === 'inspect'));
});

test('a silent agent is seized by the Guard', async () => {
  const { api } = makeCourt({ flags: 'hang,single', rules: { stallSeconds: 1, maxRetries: 1 } });
  const { id } = api.createEdict({ brief: 'two step job, then check it', workspace: tmp('court-plain-') });
  const detail = await waitFor(api, id, ['awaiting-approval', 'failed']);
  assert.ok(detail.messages.some(item => item.kind === 'guard' && item.from === 'jinyiwei'));
  assert.ok(detail.calls.some(call => call.stalled));
  assert.equal(detail.status, 'awaiting-approval', 'the redo succeeded');
});

test('the per-decree allotment halts spending', async () => {
  const { api } = makeCourt({ format: 'claude-stream', rules: { treasury: { budgetPerEdictUsd: 0.015 } } });
  const { id } = api.createEdict({ brief: 'two step job, then check it', workspace: tmp('court-plain-') });
  const detail = await waitFor(api, id, ['failed', 'awaiting-approval']);
  assert.equal(detail.status, 'failed');
  assert.ok(detail.messages.some(item => item.kind === 'guard'));
  assert.ok(detail.spend.costUsd <= 0.03);
});

test('the monthly budget refuses new decrees once spent', async () => {
  const { api } = makeCourt({ format: 'claude-stream', rules: { mode: 'express' } });
  const first = api.createEdict({ brief: 'write a hello file', workspace: tmp('court-plain-') });
  await waitFor(api, first.id, ['awaiting-approval']);
  const state = api.getState();
  api.savePreset({ agents: state.agents, roles: state.roles, rules: { ...state.rules, treasury: { ...state.rules.treasury, monthlyBudgetUsd: 0.005 } } });
  assert.throws(() => api.createEdict({ brief: 'again', workspace: tmp('court-plain-') }), /预算|budget/);
});

test('the chronicle records facts with provenance, upgrades them on seal and recalls them', async () => {
  const repo = makeRepo();
  const { api, entries } = makeCourt({ rules: { historian: true, historianAgentId: 'fa', mode: 'standard' } });
  const first = api.createEdict({ brief: 'two step job, then check it', workspace: repo });
  await waitFor(api, first.id, ['awaiting-approval']);
  const page = api.wiki().pages.find(item => item.group === 'projects');
  assert.ok(page, 'a project page exists');
  let text = api.wikiPage(page.path).text;
  assert.match(text, /Tests run with: npm test 〔edict-[^·]+ · \?/);
  api.approve(first.id);
  text = api.wikiPage(page.path).text;
  assert.match(text, /Tests run with: npm test 〔edict-[^·]+ · ✓/);
  const second = api.createEdict({ brief: 'another two step job, then check it', workspace: repo });
  await waitFor(api, second.id, ['awaiting-approval']);
  assert.ok(api.getEdict(second.id).chronicleUsed.length);
  assert.ok(entries().filter(entry => entry.kind === 'draft').at(-1).chronicle, 'the Consul saw the chronicle');
  assert.ok(entries().filter(entry => entry.kind === 'task').at(-1).chronicle, 'the magistrates saw it too');
  assert.ok(api.wiki().log.some(line => line.includes('ingest')));
});

test('wiki pages parse, render and lint without losing pinned or manual entries', () => {
  const page = parsePage('---\ntitle: demo\n---\n# demo\n\nhand-written note\n\n## 事实\n- 📌 build with make 〔manual · ✓〕\n- build with make. 〔edict-1 · ?〕\n- plain manual line\n## 坑\n');
  assert.equal(page.sections.facts.length, 3);
  assert.ok(page.sections.facts[2].pinned);
  const text = renderPage(page, 'zh');
  assert.match(text, /hand-written note/);
  assert.match(text, /📌 build with make/);
});

test('the files office lists changes and shows content and diffs from the branch', async () => {
  const repo = makeRepo();
  const { api } = makeCourt();
  const { id } = api.createEdict({ brief: 'two step job, then check it', workspace: repo });
  await waitFor(api, id, ['awaiting-approval']);
  const files = api.files(id);
  assert.equal(files.source, 'branch');
  assert.ok(files.changed.some(item => item.file === 'hello.txt'));
  assert.ok(files.deliverables.find(item => item.path === 'hello.txt').exists);
  assert.match(api.file(id, 'hello.txt').text, /war was here/);
  assert.match(api.file(id, 'hello.txt', true).text, /\+war was here/);
  assert.throws(() => api.file(id, '../secret.txt'));
});

test('estimate predicts the procedure and a cost range before issuing', () => {
  const { api } = makeCourt({ rules: { mode: 'auto' } });
  const small = api.estimate({ brief: '修个错别字' });
  assert.equal(small.mode, 'express');
  assert.ok(small.calls[0] >= 1 && small.usd[0] > 0);
  const big = api.estimate({ brief: '汇总数据，然后写报告，并且检查结论，再做一页 PPT' });
  assert.equal(big.mode, 'standard');
  assert.ok(big.calls[1] > small.calls[1]);
});

test('the regime follows who holds office: tools, then model houses', () => {
  const dsh = { id: 'dsh', name: 'DSH', adapter: 'self' };
  const cc = { id: 'cc', name: 'Claude Code', adapter: 'cli', command: 'claude', traits: ['实现'] };
  const codex = { id: 'codex', name: 'Codex', adapter: 'cli', command: 'codex', traits: ['审查', '测试'] };
  const wb = { id: 'wb', name: 'WorkBuddy', adapter: 'cli', command: 'codebuddy', traits: ['表格'] };
  const qwen = { id: 'qwen', name: 'Qwen Office', adapter: 'manual' };
  const all = (agentId, model = '') => Object.fromEntries(OFFICES.map(id => [id, { agentId, model }]));
  const agents = [dsh, cc, codex, wb, qwen];
  const run = (roles, rules = {}) => regimeOf({ agents, roles, rules });

  // 只用 DSH、模型同出一家：加九锡；换了别家模型：权倾朝野
  const jiuxi = run({ ...all('dsh', 'deepseek-chat'), menxia: { agentId: 'dsh', model: 'deepseek-reasoner' } });
  assert.equal(jiuxi.level, 'jiuxi');
  assert.equal(jiuxi.dominant.share, 1);
  assert.equal(run({ ...all('dsh', 'deepseek-chat'), menxia: { agentId: 'dsh', model: 'qwen-max' } }).level, 'quanchen');
  // DSH + 一家：两党争霸；三家：三巨头；四家：乾纲独断
  const two = run({ ...all('dsh'), war: { agentId: 'cc' } });
  assert.equal(two.level, 'liangdang');
  assert.equal(run({ ...all('dsh'), war: { agentId: 'cc' }, justice: { agentId: 'codex' } }).level, 'sanju');
  const four = run({ ...all('dsh'), war: { agentId: 'cc' }, justice: { agentId: 'codex' }, rites: { agentId: 'qwen' } });
  assert.equal(four.level, 'qiangang');
  assert.equal(four.rank, 5);
  // 丞相模式下人工岗位由代办接手：千问不再算一家
  const regent = run({ ...all('dsh'), war: { agentId: 'cc' }, justice: { agentId: 'codex' }, rites: { agentId: 'qwen' } }, { autonomous: true, fallbackAgentId: 'cc' });
  assert.equal(regent.level, 'sanju');
  assert.equal(regent.holders.rites.deputy, true);
  // 升级建议：把对口的岗位从权柄最重那家分给闲着的工具
  const tip = two.suggestions.find(item => item.kind === 'appoint' && item.agentId === 'codex');
  assert.ok(tip && ['menxia', 'justice'].includes(tip.roleId) && tip.to === 'sanju', JSON.stringify(two.suggestions));
  // 回避：拟旨与封驳同出一家，而朝中另有别家
  assert.ok(two.suggestions.some(item => item.kind === 'recuse' && item.agentId === 'cc'));
  // 模型认家
  assert.equal(familyOf('claude-sonnet-4-5', cc), 'anthropic');
  assert.equal(familyOf('', codex), 'openai');
  assert.equal(familyOf('glm-5.3', wb), 'zhipu');
  assert.equal(familyOf('auto', wb), 'tool:wb');
  // 一家独大、丞相代办，比四家分权、亲自批红更像傀儡
  assert.ok(puppetIndex({ ...jiuxi, autonomous: true }, []) > puppetIndex(four, [{ outcome: 'done', ruledBy: 'emperor' }]));
  assert.equal(actualRegimeOf([{ agentId: 'dsh', model: 'deepseek-chat' }, { agentId: 'cc', model: '' }], agents), 'liangdang');
});

test('the biography knows who ruled: sealing by hand counts, the regime is recorded', async () => {
  const repo = makeRepo();
  const { api } = makeCourt();
  assert.equal(api.getState().regime.level, 'liangdang');
  const { id } = api.createEdict({ brief: 'write a hello file', workspace: repo, criteria: 'hello.txt exists' });
  await waitFor(api, id, ['awaiting-approval']);
  api.approve(id);
  const detail = api.getEdict(id);
  assert.equal(detail.ruledBy, 'emperor');
  assert.deepEqual(detail.regime, { appointed: 'liangdang', actual: 'liangdang' });
  const bio = api.biography();
  assert.equal(bio.reign.edicts, 1);
  assert.equal(bio.reign.ruled, 1);
  assert.equal(bio.abilities.mingcha, 100);
  assert.equal(bio.reign.regimes.liangdang, 1);
  assert.ok(bio.tasks.war && bio.tasks.war.done >= 1);
  assert.ok(bio.regime.puppet.score >= 0 && bio.regime.puppet.verdict);
});

test('DSH headless --json is parsed: answer, session, usage; its stray log lines are skipped', () => {
  // 真实 dsh headless --json 的输出形状（中间夹着一行 DSH 自己的日志）
  const raw = [
    '{"type":"session","sessionId":"session-1","cwd":"C:\\\\work"}',
    '{"type":"status","phase":"turn_start","turn":1}',
    '[llm-deepseek-account] model listing from https://api.deepseek.com/models loaded 2 model(s), skipped 0 row(s)',
    '{"type":"text","text":"OK"}',
    '{"type":"status","phase":"step_end","turn":1,"step":1,"usage":{"inputTokens":713,"outputTokens":2,"cacheReadTokens":5760,"cacheWriteTokens":0,"totalTokens":6475}}',
    '{"type":"status","phase":"turn_end","turn":1,"reason":{"kind":"completed"}}',
    '{"type":"final","text":"OK"}',
  ].join('\n');
  const parsed = parseOutput('dsh-json', raw);
  assert.equal(parsed.text, 'OK');
  assert.equal(parsed.sessionId, 'session-1');
  assert.deepEqual(parsed.usage, { input: 713, output: 2, cacheRead: 5760, cacheWrite: 0, costUsd: null, estimated: false });
  assert.ok(!parsed.isError);
  // 值房尾巴：正文与工具动作，final 不重复
  assert.equal(tailLine('dsh-json', '{"type":"final","text":"OK"}'), '');
  assert.equal(tailLine('dsh-json', '{"type":"tool_call","tool":"bash","input":{"command":"npm test"}}'), '▸ bash npm test');
  const failed = parseOutput('dsh-json', '{"type":"session","sessionId":"s"}\n{"type":"status","phase":"turn_end","turn":1,"reason":{"kind":"error"}}\n{"type":"final","text":""}');
  assert.ok(failed.isError);
});

test('the decree permission reaches the tools: read-only never writes, full lifts confirmations', async () => {
  const repo = makeRepo();
  const { api, entries } = makeCourt({ execArgs: ['--may-write'], autoArgs: ['--full-auto'], flags: 'single' });
  const { id } = api.createEdict({ brief: 'look around', workspace: repo, permission: 'read' });
  await waitFor(api, id, ['awaiting-approval', 'failed']);
  const readTasks = entries().filter(entry => entry.kind === 'task');
  assert.ok(readTasks.length, 'a magistrate ran');
  assert.ok(readTasks.every(entry => !entry.args.includes('--may-write') && !entry.args.includes('--full-auto') && entry.perm === 'read-only'));
  assert.ok(entries().filter(entry => entry.kind === 'draft').every(entry => entry.perm === 'read-only'), 'drafting is always read-only');
  assert.equal(api.getEdict(id).permission, 'read');

  // 岗位模型走环境变量（dsh headless 没有 --model 参数）
  const state = api.getState();
  api.savePreset({ agents: state.agents, roles: { ...state.roles, war: { ...state.roles.war, model: 'deepseek-flash' } }, rules: state.rules });
  const second = api.createEdict({ brief: 'fix it', workspace: repo, permission: 'full' });
  await waitFor(api, second.id, ['awaiting-approval', 'failed']);
  const fullTasks = entries().filter(entry => entry.kind === 'task').slice(readTasks.length);
  assert.ok(fullTasks.length && fullTasks.every(entry => entry.args.includes('--full-auto') && entry.perm === 'danger-full-access'));
  assert.ok(fullTasks.every(entry => entry.envModel === 'deepseek-flash'));
});

test('attachments travel with the decree, and a GUI-only office can be handed to the deputy', async () => {
  const repo = makeRepo();
  const { api, entries, dataDir } = makeCourt({ flags: 'manual', manualRites: true, rules: { fallbackAgentId: 'fb' } });
  const data = Buffer.from('a,b\n1,2\n').toString('base64');
  const { id } = api.createEdict({ brief: 'make slides', workspace: repo, attachments: [{ name: '../evil/data.csv', data: `data:text/csv;base64,${data}` }] });
  // 附件只留文件名，存进奏折目录，不进工作目录
  const saved = path.join(dataDir, 'edicts', id, 'attachments', 'data.csv');
  assert.equal(fs.readFileSync(saved, 'utf8'), 'a,b\n1,2\n');
  assert.ok(!fs.existsSync(path.join(repo, 'data.csv')));
  const waiting = await waitFor(api, id, ['awaiting-input', 'failed']);
  assert.equal(waiting.status, 'awaiting-input', waiting.error);
  assert.deepEqual(waiting.attachments, [{ name: 'data.csv', size: 8 }]);
  assert.ok(entries().find(entry => entry.kind === 'draft').attach, 'the drafter saw the attachment');
  assert.equal(api.getState().deputy.id, 'fb');

  const step = waiting.steps.find(item => item.status === 'awaiting-input');
  api.fill(id, step.seq, '', false, true);
  const detail = await waitFor(api, id, ['awaiting-approval', 'failed']);
  assert.equal(detail.status, 'awaiting-approval', detail.error);
  assert.equal(detail.steps.find(item => item.seq === step.seq).status, 'done');
  assert.ok(entries().some(entry => entry.kind === 'task' && entry.ministry === 'rites'), 'the deputy did the Rites order');
});

test('one agent may both draft and review: allowed, and read as the jiuxi regime', () => {
  const { api } = makeCourt();
  const state = api.getState();
  api.savePreset({ agents: state.agents, roles: { ...state.roles, menxia: { ...state.roles.menxia, agentId: 'fa' } }, rules: state.rules });
  const regime = api.getState().regime;
  assert.equal(regime.level, 'jiuxi');
  assert.ok(regime.suggestions.some(item => item.kind === 'appoint' && item.agentId === 'fb'));
});

test('workspace candidates come from DSH’s own sidebar list; an old DSH-itself agent becomes the headless CLI', () => {
  const home = tmp('dsh-home-');
  const ws = tmp('ws-');
  fs.mkdirSync(path.join(home, 'storages'), { recursive: true });
  fs.writeFileSync(path.join(home, 'storages', 'workspace.json'), JSON.stringify({
    global: { workspaceIds: ['a', 'b'] },
    tables: { workspaces: { a: { path: ws, title: 'Demo' }, b: { path: path.join(ws, 'missing'), title: 'Gone' } } },
  }));
  const previous = process.env.DSH_HOME;
  process.env.DSH_HOME = home;
  try {
    const { api } = makeCourt();
    const list = api.workspaces().workspaces;
    assert.equal(list[0].path, ws);
    assert.equal(list[0].title, 'Demo');
    assert.ok(!list.some(item => item.title === 'Gone'), 'missing folders are skipped');
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previous;
  }

  // 老存档：DSH 本体是 self（只出待办）→ 升级成 dsh headless
  const dataDir = tmp('court-old-');
  fs.writeFileSync(path.join(dataDir, 'state.json'), JSON.stringify({ agents: [{ id: 'dsh', name: 'DSH', adapter: 'self', enabled: true }] }));
  const court = createCourt({ dataDir }, { log: { info() {}, error() {} } });
  const dsh = court.api.getState().agents.find(agent => agent.id === 'dsh');
  assert.equal(dsh.adapter, 'cli');
  assert.equal(dsh.outputFormat, 'dsh-json');
  assert.equal(dsh.permissionEnv, 'DSH_PERMISSION_MODE');
});
