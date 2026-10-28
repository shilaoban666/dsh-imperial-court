// 适配器：把不同形态的桌面工具统一成「接一道旨意 → 交一份结果」的调用。
//
// adapter:
//   cli    —— 命令行 agent，spawn 子进程，prompt 走 stdin 或参数
//   self   —— DSH 本体（本插件宿主）：不自动执行，生成待办交回主 agent/朝堂
//   manual —— 只有图形界面（如千问办公）：生成工单，人工完成后回填
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

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
  if (res.status !== 0) return '';
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
  if (agent.enabled === false) return { ok: false, output: '', error: `${agent.name} 已停用` };
  if (agent.adapter === 'self') {
    return { ok: true, output: '', handedOff: true, note: '交由 DSH 本体处理（v0.1 不自动执行，已生成待办）' };
  }
  if (agent.adapter === 'manual') {
    return { ok: true, output: '', handedOff: true, note: `${agent.name} 目前只有图形界面，已生成工单，请人工完成` };
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

function runCli(agent, prompt, { cwd, timeoutMs, signal, model, onData, autonomous } = {}) {
  return new Promise(resolve => {
    const mode = agent.promptMode || 'stdin';
    const args = (agent.args || []).map(arg => String(arg).replaceAll('{prompt}', prompt));
    // 自治模式：无人能点「允许」，CLI 自己的权限确认必须预先放开，否则写文件、跑命令会被拒
    if (autonomous && Array.isArray(agent.autoArgs)) args.push(...agent.autoArgs.map(String));
    // 岗位指定的模型：拼在该 CLI 的 modelArgs 模板后面（如 claude --model sonnet）
    const chosenModel = String(model || '').trim();
    if (chosenModel && Array.isArray(agent.modelArgs) && agent.modelArgs.length) {
      args.push(...agent.modelArgs.map(arg => String(arg).replaceAll('{model}', chosenModel)));
    }

    if (signal && signal.aborted) return resolve({ ok: false, output: '', error: '已取消' });

    let child;
    try {
      const plan = buildSpawn(agent.command, args);
      child = spawn(plan.file, plan.args, {
        cwd: cwd || undefined,
        env: { ...process.env, ...(agent.env || {}) },
        shell: plan.shell,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      return resolve({ ok: false, output: '', error: `启动失败：${err.message}` });
    }

    let out = '';
    let errText = '';
    let done = false;
    let timer = null;
    let onAbort = null;

    const finish = (ok, error) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      if (signal && onAbort) signal.removeEventListener('abort', onAbort);
      resolve({ ok, output: out.trim(), error: error || undefined });
    };

    // 按 utf8 解码流：中文等多字节字符可能被切在两个 chunk 之间，逐块 toString 会出乱码
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', text => {
      if (out.length < MAX_OUTPUT) out += text;
      if (onData) onData(text);
    });
    child.stderr.on('data', text => {
      if (errText.length < 40_000) errText += text;
    });
    // 子进程提前退出（命令不存在、参数错）时写 stdin 会 EPIPE；不接住会变成未捕获异常，把整个宿主带崩
    child.stdin.on('error', () => {});
    child.on('error', err => finish(false, `子进程错误：${err.message}`));
    child.on('close', code => {
      if (code === 0) finish(true);
      else finish(false, `退出码 ${code}${errText ? `：${errText.trim().slice(-1200)}` : ''}`);
    });

    const limit = Number(timeoutMs || agent.timeoutMs || 600000);
    timer = setTimeout(() => {
      killTree(child);
      finish(false, `超时（${Math.round(limit / 1000)}s）已终止`);
    }, limit);

    if (signal) {
      onAbort = () => {
        killTree(child);
        finish(false, '已取消');
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
