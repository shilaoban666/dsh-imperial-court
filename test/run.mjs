// 跑 test/ 下所有 *.test.mjs。
// `node --test "test/*.test.mjs"` 要 Node 21+ 才认通配符（Node 20 当成文件名，一个都找不到），所以这里自己列文件。
// 在 GitHub Actions 里，失败的用例另写成 ::error 注解和任务摘要：不登录、不翻日志也看得到是哪一条挂了。
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(dir).filter(name => name.endsWith('.test.mjs')).sort().map(name => path.join(dir, name));
if (!files.length) {
  console.error('no test files in', dir);
  process.exit(1);
}

const inActions = Boolean(process.env.GITHUB_ACTIONS);
// CI 里固定用 tap：各版本 Node 的默认报告格式不一样，tap 好解析
const args = ['--test', ...(inActions ? ['--test-reporter=tap'] : []), ...process.argv.slice(2), ...files];
const child = spawn(process.execPath, args, { stdio: ['inherit', inActions ? 'pipe' : 'inherit', 'inherit'] });

let output = '';
if (inActions) {
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    output += chunk;
    process.stdout.write(chunk);
  });
}
child.on('error', err => {
  console.error(err.message);
  process.exit(1);
});
child.on('close', code => {
  if (code && inActions) report(failures(output));
  process.exit(code ?? 1);
});

/** tap 输出里失败的用例：名字 + 紧跟的 yaml 详情（错误信息、位置、调用栈） */
function failures(tap) {
  const lines = tap.split(/\r?\n/);
  const found = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = /^(\s*)not ok \d+ - (.*)$/.exec(lines[i]);
    if (!match) continue;
    const detail = [];
    if (/^\s*---\s*$/.test(lines[i + 1] || '')) {
      for (let j = i + 2; j < lines.length && !/^\s*\.\.\.\s*$/.test(lines[j]); j += 1) detail.push(lines[j].slice(match[1].length));
    }
    const text = detail.join('\n');
    // 文件、套件这一层只是「里面有用例挂了」，真正的原因在里面那条
    if (/failureType: 'subtestsFailed'/.test(text)) continue;
    found.push({ name: match[2].replace(/ # .*$/, ''), detail: text });
  }
  return found;
}

function report(list) {
  const escape = text => text.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  const where = `${process.platform}, node ${process.versions.node}`;
  for (const item of list.slice(0, 10)) {
    const title = `Test failed: ${item.name}`.replace(/%/g, '%25').replace(/\r|\n/g, ' ').replace(/:/g, '%3A').replace(/,/g, '%2C');
    console.log(`::error title=${title}::${escape(`${item.name} (${where})\n${item.detail}`.slice(0, 3000))}`);
  }
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (!summary) return;
  const body = list.length
    ? list.map(item => `#### ❌ ${item.name}\n\n\`\`\`yaml\n${item.detail.slice(0, 6000)}\n\`\`\`\n`).join('\n')
    : 'The test run failed, but no failed test was found in the output. See the log.\n';
  fs.appendFileSync(summary, `### ${list.length} failed test(s) on ${where}\n\n${body}\n`);
}
