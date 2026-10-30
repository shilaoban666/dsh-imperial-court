// 适配器：把不同形态的桌面工具统一成「接一道旨意 → 交一份结果」的调用。
//
// adapter:
//   cli    —— 命令行 agent，spawn 子进程，prompt 走 stdin 或参数。DSH 本体也走这里：dsh headless（一次性任务模式）
//   self   —— 老配置里的 DSH 本体：不自动执行，生成待办交回主 agent/朝堂（新预设已改成 cli）
//   manual —— 只有图形界面（如千问办公）：生成工单，人工完成后回填
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseOutput, tailLine } from './treasury.mjs';

// 插件根目录：参数里的 {pluginDir} 换成它（如 dsh headless 的 --patch 文件）
export const PLUGIN_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 下旨时选的权限 → DSH 自己的 DSH_PERMISSION_MODE（与 DSH 输入框里的三档一致）
const DSH_PERMISSION = { read: 'read-only', workspace: 'workspace-write', full: 'danger-full-access' };

/** Windows 卸载信息里记的 DSH 安装目录（装到别的盘时只有这里查得到） */
function dshInstallLocations() {
  const found = [];
  for (const hive of ['HKCU', 'HKLM']) {
    const key = `${hive}\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall`;
    const search = spawnSync('reg', ['query', key, '/s', '/f', 'DeepSeek Harness', '/d'], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
    const keys = String(search.stdout || '').split(/\r?\n/).map(line => line.trim()).filter(line => /^HKEY_/i.test(line));
    for (const sub of keys) {
      const value = spawnSync('reg', ['query', sub, '/v', 'InstallLocation'], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
      const match = /InstallLocation\s+REG_\w+\s+(.+)/i.exec(String(value.stdout || ''));
      if (match) found.push(match[1].trim());
    }
  }
  return found;
}

/**
 * DSH 的命令行不一定在 PATH 里（安装时没勾「添加命令行」）：按 DSH_CLI、宿主进程所在的安装目录、常见安装位置去找
 * resources/runtime/cli/bin/dsh(.cmd)。插件宿主本身就跑在 DSH 里，process.execPath 往上几层通常就是安装目录。
 */
let dshCliCache = null;
export function findDshCli() {
  if (dshCliCache && fs.existsSync(dshCliCache)) return dshCliCache;
  dshCliCache = locateDshCli();
  return dshCliCache;
}
function locateDshCli() {
  const tail = ['resources', 'runtime', 'cli', 'bin', IS_WIN ? 'dsh.cmd' : 'dsh'];
  const roots = [];
  let dir = path.dirname(process.execPath);
  for (let i = 0; i < 5; i += 1) {
    roots.push(dir);
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  if (IS_WIN) {
    const bases = [path.join(process.env.LOCALAPPDATA || '', 'Programs'), process.env.ProgramFiles, process.env['ProgramFiles(x86)']];
    for (const base of bases.filter(Boolean)) roots.push(path.join(base, 'DeepSeek Harness'));
    roots.push(...dshInstallLocations());
  } else {
    roots.push('/Applications/DeepSeek Harness.app/Contents');
  }
  const candidates = [process.env.DSH_CLI, ...roots.map(root => path.join(root, ...tail))].filter(Boolean);
  return candidates.find(file => fs.existsSync(file)) || '';
}

const MAX_OUTPUT = 400 * 1024; // 单个 agent 输出上限，防止把上下文撑爆
const IS_WIN = process.platform === 'win32';

// cmd.exe 元字符。shell 模式下参数是原样拼进命令行的，不转义的话带空格/引号/&| 的参数会被拆开，甚至被当成命令执行。
const CMD_META = /([()\][%!^"`<>&|;, *?])/g;

function escapeCmdCommand(command) {
  return String(command).replace(CMD_META, '^$1');
}

function escapeCmdArg(arg, doubleEscape) {
  // cmd 不支持参数里带换行，压成空格
  let text = String(arg).replace(/\r?\n/g, ' ');
  // 按 CommandLineToArgvW 规则处理反斜杠与引号，再整体加引号
  text = text.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, '$1$1');
  text = `"${text}"`.replace(CMD_META, '^$1');
  // npm 装的 claude/codex/codebuddy 是 .cmd shim，会再过一遍 cmd 解析，元字符要转义两次
  return doubleEscape ? text.replace(CMD_META, '^$1') : text;
}

/** 把命令解析成绝对路径：带路径的直接查文件，否则 Windows 用 where.exe、其它用 which */
function resolveCommand(command) {
  const cmd = String(command || '').trim();
  if (!cmd) return '';
  if (cmd.includes('/') || cmd.includes('\\')) {
    return fs.existsSync(cmd) ? path.resolve(cmd) : '';
  }
  const finder = IS_WIN ? 'where.exe' : 'which';
  const res = spawnSync(finder, [cmd], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
  if (res.status !== 0) return cmd === 'dsh' ? findDshCli() : '';
  const lines = String(res.stdout || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!IS_WIN) return lines[0] || '';
  // where 会把无扩展名的 shell 脚本也列出来（npm 同时装 claude 和 claude.cmd），优先可直接执行的
  return lines.find(line => /\.(exe|com|cmd|bat)$/i.test(line)) || lines[0] || '';
}

/** 探测命令是否存在 */
export function probeAgent(agent) {
  if (!agent) return { ok: false, detail: '未配置' };
  if (agent.adapter !== 'cli') return { ok: true, detail: `适配器 ${agent.adapter}，无需命令` };
  try {
    const resolved = resolveCommand(agent.command);
    return resolved
      ? { ok: true, detail: resolved }
      : { ok: false, detail: `未找到 ${agent.command}（PATH 里没有，或绝对路径不存在）` };
  } catch (err) {
    return { ok: false, detail: String(err && err.message ? err.message : err) };
  }
}

/**
 * 调用一个 agent。
 * @returns {Promise<{ok:boolean, output:string, error?:string, handedOff?:boolean, note?:string}>}
 */
export async function runAgent(agent, prompt, options = {}) {
  if (!agent) return { ok: false, output: '', error: '未配置 agent' };
  if (agent.enabled === false) return { ok: false, output: '', error: `${agent.name} disabled / 已停用` };
  if (agent.adapter === 'self') {
    return { ok: true, output: '', handedOff: true, note: options.locale === 'en'
      ? 'Handed to DSH itself: the main agent (sansheng_fill) or you fill in the result'
      : '交由 DSH 本体：主 agent（sansheng_fill）或你本人回填结果' };
  }
  if (agent.adapter === 'manual') {
    return { ok: true, output: '', handedOff: true, note: options.locale === 'en'
      ? `${agent.name} only has a graphical interface. A work order was issued; do it by hand and fill in the result`
      : `${agent.name} 只有图形界面，已生成工单，请人工完成后回填` };
  }
  return runCli(agent, prompt, options);
}

/** 结束子进程及其子孙：Windows 上走 shell 时 child 只是 cmd.exe，直接 kill 会把真正的 CLI 留成孤儿 */
function killTree(child) {
  if (!child || !child.pid || child.exitCode !== null) return;
  if (IS_WIN) {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }).on('error', () => {});
      return;
    } catch {
      /* 落回下面的 kill */
    }
  }
  try {
    child.kill('SIGKILL');
  } catch {
    /* ignore */
  }
}

/** 算出真正要 spawn 的命令、参数与是否走 shell */
function buildSpawn(command, args) {
  if (!IS_WIN) return { file: command, args, shell: false };
  const resolved = resolveCommand(command);
  if (resolved && /\.(exe|com)$/i.test(resolved)) return { file: resolved, args, shell: false };
  // .cmd/.bat（或解析不到、交给 cmd 自己报错）必须经 cmd.exe，参数逐个转义
  const isBatch = /\.(cmd|bat)$/i.test(resolved);
  return {
    file: escapeCmdCommand(resolved || command),
    args: args.map(arg => escapeCmdArg(arg, isBatch)),
    shell: true,
  };
}

/**
 * @param {object} options
 * @param {string} options.session  要续接的会话 id（agent.resumeArgs 里的 {session}）；续接时 prompt 只需写增量
 * @param {number} options.stallMs  锦衣卫看守：这么久没有任何输出就拿下（结束进程，记为失败）
 */
function runCli(agent, prompt, { cwd, timeoutMs, signal, model, onData, autonomous, extraArgs, session, stallMs, permission } = {}) {
  return new Promise(resolve => {
    const mode = agent.promptMode || 'stdin';
    const format = agent.outputFormat || 'text';
    const args = (agent.args || []).map(arg => String(arg).replaceAll('{prompt}', prompt).replaceAll('{pluginDir}', PLUGIN_DIR));
    const env = { ...process.env, ...(agent.env || {}) };
    // 结构化输出：拿得到用量与会话 id，国库才有真账（claude --output-format stream-json --verbose / codex --json）
    if (Array.isArray(agent.formatArgs)) args.push(...agent.formatArgs.map(String));
    // 续接同一岗位上一轮的会话：上下文与缓存都还在，这一轮只发增量
    if (session && Array.isArray(agent.resumeArgs) && agent.resumeArgs.length) {
      args.push(...agent.resumeArgs.map(arg => String(arg).replaceAll('{session}', session)));
    }
    // 丞相模式：无人能点「允许」，CLI 自己的权限确认必须预先放开，否则写文件、跑命令会被拒
    if (autonomous && Array.isArray(agent.autoArgs)) args.push(...agent.autoArgs.map(String));
    // 常规模式的执行差事：放开写文件（execArgs）。各部在隔离分支里办差，批红前不碰原目录
    else if (Array.isArray(extraArgs)) args.push(...extraArgs.map(String));
    // 岗位指定的模型：拼在该 CLI 的 modelArgs 模板后面（如 claude --model sonnet）
    const chosenModel = String(model || '').trim();
    if (chosenModel && Array.isArray(agent.modelArgs) && agent.modelArgs.length) {
      args.push(...agent.modelArgs.map(arg => String(arg).replaceAll('{model}', chosenModel)));
    }
    // 不收模型参数、靠环境变量选模型的 CLI（dsh headless 经 --patch 读 SANSHENG_DSH_MODEL）
    if (chosenModel && agent.modelEnv) env[agent.modelEnv] = chosenModel;
    // 靠环境变量定权限的 CLI（dsh headless 的 DSH_PERMISSION_MODE）
    if (agent.permissionEnv && DSH_PERMISSION[permission]) env[agent.permissionEnv] = DSH_PERMISSION[permission];

    if (signal && signal.aborted) return resolve({ ok: false, output: '', error: 'cancelled / 已取消' });

    let child;
    try {
      const plan = buildSpawn(agent.command, args);
      child = spawn(plan.file, plan.args, {
        cwd: cwd || undefined,
        env,
        shell: plan.shell,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      return resolve({ ok: false, output: '', error: `spawn failed / 启动失败：${err.message}` });
    }

    let out = '';
    let errText = '';
    let pending = '';
    let done = false;
    let timer = null;
    let stallTimer = null;
    let onAbort = null;
    const startedAt = Date.now();

    const finish = (ok, error, extra = {}) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      if (stallTimer) clearTimeout(stallTimer);
      if (signal && onAbort) signal.removeEventListener('abort', onAbort);
      const parsed = parseOutput(format, out, prompt);
      resolve({
        ok: ok && !parsed.isError,
        output: String(parsed.text || '').trim(),
        raw: out,
        usage: parsed.usage,
        sessionId: parsed.sessionId || '',
        durationMs: Date.now() - startedAt,
        error: error || (parsed.isError ? String(parsed.text || 'error').slice(-1200) : undefined),
        ...extra,
      });
    };

    const armStall = () => {
      if (!stallMs) return;
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        killTree(child);
        finish(false, `stalled ${Math.round(stallMs / 1000)}s / 锦衣卫：${Math.round(stallMs / 1000)} 秒无动静，已拿下`, { stalled: true });
      }, stallMs);
    };
    armStall();

    // 按 utf8 解码流：中文等多字节字符可能被切在两个 chunk 之间，逐块 toString 会出乱码
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', text => {
      if (out.length < MAX_OUTPUT) out += text;
      armStall();
      if (!onData) return;
      if (format === 'text') { onData(text); return; }
      // 结构化输出按行解析，只把正文与工具动作给值房看
      pending += text;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop();
      for (const line of lines) {
        const shown = tailLine(format, line);
        if (shown) onData(`${shown}\n`);
      }
    });
    child.stderr.on('data', text => {
      if (errText.length < 40_000) errText += text;
      armStall();
    });
    // 子进程提前退出（命令不存在、参数错）时写 stdin 会 EPIPE；不接住会变成未捕获异常，把整个宿主带崩
    child.stdin.on('error', () => {});
    child.on('error', err => finish(false, `process error / 子进程错误：${err.message}`));
    child.on('close', code => {
      if (code === 0) finish(true);
      else finish(false, `exit ${code}${errText ? `: ${errText.trim().slice(-1200)}` : ''}`);
    });

    const limit = Number(timeoutMs || agent.timeoutMs || 600000);
    timer = setTimeout(() => {
      killTree(child);
      finish(false, `timeout ${Math.round(limit / 1000)}s / 超时已终止`);
    }, limit);

    if (signal) {
      onAbort = () => {
        killTree(child);
        finish(false, 'cancelled / 已取消');
      };
      signal.addEventListener('abort', onAbort, { once: true });
    }

    if (mode === 'arg') {
      // 参数模式：prompt 已替换进 args，无需 stdin
      child.stdin.end();
    } else {
      child.stdin.end(prompt);
    }
  });
}
