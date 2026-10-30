// 假 CLI：从 stdin 读 prompt，按公文种类和 FAKE_FLAGS 吐出约定好的输出，端到端测试用。
// 也会照「产出要求」在工作目录里真的写文件，好让隔离分支、提交、合并都有东西可验。
// FAKE_FORMAT=claude-stream 时模仿 claude -p --output-format stream-json：带会话 id、用量与花销。
import fs from 'node:fs';
import path from 'node:path';

const prompt = fs.readFileSync(0, 'utf8');
const flags = new Set(String(process.env.FAKE_FLAGS || '').split(',').filter(Boolean));
const format = process.env.FAKE_FORMAT || 'text';
const log = process.env.FAKE_LOG;
const args = process.argv.slice(2);
const resumeAt = args.indexOf('--resume');
const resumed = resumeAt >= 0 ? args[resumeAt + 1] : '';
const has = (...markers) => markers.some(marker => prompt.includes(marker));
// FAKE_PERM / FAKE_MODEL：插件按权限、岗位模型设的环境变量（模拟 dsh headless 的 DSH_PERMISSION_MODE / SANSHENG_DSH_MODEL）
const record = entry => {
  if (log) fs.appendFileSync(log, `${JSON.stringify({ ...entry, resumed, perm: process.env.FAKE_PERM || '', envModel: process.env.FAKE_MODEL || '', at: Date.now() })}\n`);
};
// 跨进程计数：同一种「只失败一次」的花样，第二次起照常
const once = key => {
  if (!log) return true;
  const file = `${log}.${key}`;
  if (fs.existsSync(file)) return false;
  fs.writeFileSync(file, '1');
  return true;
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function emit(text, session) {
  if (format !== 'claude-stream') return process.stdout.write(text);
  const id = session || resumed || 'sess-x';
  const lines = [
    { type: 'system', subtype: 'init', session_id: id },
    { type: 'assistant', session_id: id, message: { content: [{ type: 'text', text }] } },
    {
      type: 'result', subtype: 'success', is_error: false, session_id: id, result: text, total_cost_usd: 0.01,
      usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 3000, cache_creation_input_tokens: 500 },
    },
  ];
  return process.stdout.write(lines.map(line => JSON.stringify(line)).join('\n'));
}
const json = (value, session) => emit(JSON.stringify(value), session);

const TITLES = {
  吏部: 'personnel', 户部: 'revenue', 礼部: 'rites', 兵部: 'war', 刑部: 'justice', 工部: 'works',
  Censor: 'personnel', Quaestor: 'revenue', Pontifex: 'rites', Legate: 'war', Praetor: 'justice', Aedile: 'works',
};

function plan() {
  let steps = [
    { ministry: 'war', title: 'write hello', instruction: 'create hello.txt', deliverable: 'hello.txt' },
    { ministry: 'justice', title: 'check hello', instruction: 'check hello.txt', deliverable: 'check.txt' },
  ];
  if (flags.has('parallel')) {
    steps = [
      { ministry: 'war', title: 'part a', instruction: 'write a.txt', deliverable: 'a.txt', after: [] },
      { ministry: 'justice', title: 'part b', instruction: 'write b.txt', deliverable: 'b.txt', after: [] },
      { ministry: 'works', title: 'join', instruction: 'write c.txt', deliverable: 'c.txt', after: [1, 2] },
    ];
  }
  if (flags.has('manual')) {
    steps = [
      { ministry: 'war', title: 'write hello', instruction: 'create hello.txt', deliverable: 'hello.txt' },
      { ministry: 'rites', title: 'slides', instruction: 'make slides', deliverable: 'slides.pptx' },
    ];
  }
  if (flags.has('handoff') || flags.has('single')) steps = [{ ministry: 'war', title: 'fix bug', instruction: 'fix it', deliverable: 'fix.txt' }];
  return { summary: 'demo plan', steps, acceptance: ['hello.txt exists'] };
}

async function task(ministry, deliverable) {
  const start = Date.now();
  if (flags.has('slow')) await sleep(500);
  if (flags.has('hang') && ministry === 'war' && once('hang')) {
    await sleep(8000);
  }
  if (flags.has('task-fail') && ministry === 'justice') {
    process.stderr.write('justice exploded');
    process.exit(3);
  }
  if (flags.has('lazy-once') && ministry === 'war' && once('lazy')) {
    record({ kind: 'task', ministry, lazy: true, start, end: Date.now(), cwd: process.cwd(), args, pressure: '' });
    return emit('I cannot do this here. You can manually run the build yourself.', `sess-task-${ministry}`);
  }
  const skipFile = flags.has('no-file') || (flags.has('no-file-once') && ministry === 'war' && once('nofile'));
  if (!skipFile && deliverable) {
    const file = path.join(process.cwd(), deliverable.trim());
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${ministry} was here\n`);
  }
  record({
    kind: 'task', ministry, start, end: Date.now(), cwd: process.cwd(), args,
    pressure: (prompt.match(/【锦衣卫·([^】]+)】|\[Praetorian ([a-z ]+)\]/) || [])[0] || '',
    chronicle: has('【实录】', '[Chronicle]'),
  });
  let out = `done: wrote ${deliverable.trim()}`;
  if (flags.has('handoff') && ministry === 'war' && !prompt.includes('【移文】') && !prompt.includes('[Referral] While')) {
    out += '\n{"handoff":{"to":"justice","reason":"needs regression tests"}}';
  }
  return emit(out, `sess-task-${ministry}`);
}

async function main() {
  // 续接会话时只收到增量提示词，靠会话 id 认出是谁
  if (resumed) {
    record({ kind: 'resume', session: resumed, delta: prompt.slice(0, 60) });
    if (resumed === 'sess-draft') return json(plan(), 'sess-draft');
    if (resumed === 'sess-review') {
      if (flags.has('veto-always')) return json({ verdict: 'reject', issues: ['missing regression tests for the parser'], risks: [] }, 'sess-review');
      return json({ verdict: 'approve', issues: [], risks: ['none'] }, 'sess-review');
    }
    if (resumed.startsWith('sess-task-')) return task(resumed.slice('sess-task-'.length), 'hello.txt');
  }
  if (has('职责是把圣意拟成可执行的方案', "turn Caesar's will into an executable plan")) {
    record({ kind: 'draft', attach: has('【附件】', '[Attachments]'), lessons: has('【前朝经验】', '[Annals]'), chronicle: has('【实录】', '[Chronicle]'), isolated: has('【隔离副本】', '[Isolated copy]') });
    if (flags.has('draft-garbage')) return emit('I will think about it.', 'sess-draft');
    return json(plan(), 'sess-draft');
  }
  if (has('请拟补救差事', 'Draft remedial orders')) {
    return json({ summary: 'remedy', steps: [{ ministry: 'war', title: 'patch', instruction: 'write patch.txt', deliverable: 'patch.txt' }] }, 'sess-draft');
  }
  if (has('职责是封驳', 'Your duty is the veto')) {
    record({ kind: 'review', retry: has('【重申】', '[Reminder]'), lessons: has('【前朝经验】', '[Annals]') });
    if (flags.has('review-garbage') || (flags.has('review-garbage-once') && !has('【重申】', '[Reminder]'))) return emit('Looks fine to me.', 'sess-review');
    if (flags.has('veto-always') || (flags.has('veto-once') && once('veto'))) return json({ verdict: 'reject', issues: ['missing regression tests for the parser'], risks: [] }, 'sess-review');
    return json({ verdict: 'approve', issues: [], risks: ['none'] }, 'sess-review');
  }
  if (has('复核六部执行结果', "auditing the magistrates' results")) {
    record({ kind: 'recheck' });
    if (flags.has('recheck-reject')) return json({ verdict: 'reject', issues: ['patch.txt missing'] });
    return json({ verdict: 'approve', issues: [] });
  }
  if (has('你是监察御史', 'You are an agens in rebus')) {
    record({ kind: 'inspect' });
    if (flags.has('impeach-once') && once('impeach')) return json({ verdict: 'impeach', findings: ['hello.txt is a placeholder'] });
    return json({ verdict: 'pass', findings: [] });
  }
  if (has('你是朝廷的史官', 'the Senate’s annalist', "the Senate's annalist")) {
    record({ kind: 'historian' });
    return json({ facts: [{ kind: 'facts', text: 'Tests run with: npm test' }, { kind: 'conventions', text: 'Outputs go to the repo root' }] });
  }
  if (has('奉尚书省派单', 'by order of the Proconsul')) {
    const head = prompt.slice(0, 80);
    const ministry = Object.entries(TITLES).find(([title]) => head.includes(title))?.[1] || 'unknown';
    const deliverable = (prompt.match(/【产出要求】(.+)/) || prompt.match(/\[Deliverable\] (.+)/) || [])[1] || 'out.txt';
    // 急递没写产出要求时，照惯例写 hello.txt
    return task(ministry, /说明|list the files/i.test(deliverable) ? 'hello.txt' : deliverable);
  }
  emit('unrecognised prompt');
}

main();
