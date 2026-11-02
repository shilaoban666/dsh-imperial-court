// 一键接入 Claude Code / Codex：开箱即用的关键一步。
//   1. 先找：PATH → 官方安装位置 → 桌面版自带的那一份（Claude 桌面版、Codex 桌面版都带着同一个命令行程序）
//   2. 找到了查登录：claude auth status / codex login status，都不调模型、不花钱
//   3. 没装就用官方方式装（Claude Code 官方安装脚本；Codex 用 npm），装在用户自己的目录里，不要管理员权限
//   4. 没登录就打开官方登录（浏览器里点一下），界面每隔几秒查一次，登上了自动接入
// 这里只管「找、查、装、登」，不改编制；谁担任哪个岗位由 staffing.mjs 决定。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const IS_WIN = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';
const HOME = os.homedir();
const LOCAL = process.env.LOCALAPPDATA || path.join(HOME, 'AppData', 'Local');
const ROAMING = process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming');

export const TOOLS = {
  claude: {
    name: 'Claude Code',
    agentId: 'cc',
    command: 'claude',
    needs: { zh: '需要 Claude 订阅（Pro / Max）或 Anthropic API Key', en: 'Needs a Claude subscription (Pro / Max) or an Anthropic API key' },
    site: 'https://claude.com/product/claude-code',
  },
  codex: {
    name: 'Codex',
    agentId: 'codex',
    command: 'codex',
    needs: { zh: '需要 ChatGPT 订阅或 OpenAI API Key', en: 'Needs a ChatGPT plan or an OpenAI API key' },
    site: 'https://developers.openai.com/codex',
  },
};

/** 版本号比较：2.1.309 > 2.1.295 */
const versionKey = text => String(text).split(/[.-]/).map(part => (/^\d+$/.test(part) ? Number(part) : 0));
function newerVersion(a, b) {
  const x = versionKey(a); const y = versionKey(b);
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  }
  return 0;
}

const safeDirs = dir => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name);
  } catch {
    return [];
  }
};
const mtime = file => {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return 0;
  }
};

/**
 * 桌面版自带的 Claude Code：<应用数据>/…/claude-code/<版本>/<哈希>/claude(.exe)。
 * 目录名随版本变，所以每次按版本号挑最新的一份。
 */
function bundledClaude() {
  const bin = IS_WIN ? 'claude.exe' : 'claude';
  const roots = IS_WIN
    ? safeDirs(LOCAL).filter(name => /^(claude|anthropic)/i.test(name)).map(name => path.join(LOCAL, name))
    : IS_MAC ? safeDirs(path.join(HOME, 'Library', 'Application Support')).filter(name => /^claude/i.test(name)).map(name => path.join(HOME, 'Library', 'Application Support', name)) : [];
  const found = [];
  const visit = (dir, depth) => {
    if (depth > 3) return;
    for (const name of safeDirs(dir)) {
      const sub = path.join(dir, name);
      if (name === 'claude-code') {
        for (const version of safeDirs(sub)) {
          const direct = path.join(sub, version, bin);
          if (fs.existsSync(direct)) found.push({ file: direct, version });
          for (const hash of safeDirs(path.join(sub, version))) {
            const file = path.join(sub, version, hash, bin);
            if (fs.existsSync(file)) found.push({ file, version });
          }
        }
      } else {
        visit(sub, depth + 1);
      }
    }
  };
  roots.forEach(root => visit(root, 0));
  found.sort((a, b) => newerVersion(b.version, a.version) || mtime(b.file) - mtime(a.file));
  return found.length ? found[0].file : '';
}

/** Codex 桌面版自带的命令行：%LOCALAPPDATA%\OpenAI\Codex\bin\<哈希>\codex.exe，挑最新的一份 */
function bundledCodex() {
  if (IS_WIN) {
    const base = path.join(LOCAL, 'OpenAI', 'Codex', 'bin');
    const files = safeDirs(base).map(hash => path.join(base, hash, 'codex.exe')).filter(file => fs.existsSync(file));
    files.sort((a, b) => mtime(b) - mtime(a));
    return files[0] || '';
  }
  const mac = '/Applications/Codex.app/Contents/Resources/codex';
  return IS_MAC && fs.existsSync(mac) ? mac : '';
}

/** 官方安装方式装出来的位置：装完以后 DSH 进程的 PATH 还是旧的，要直接按位置找 */
function installedLocations(id) {
  if (id === 'claude') {
    return IS_WIN
      ? [path.join(HOME, '.local', 'bin', 'claude.exe'), path.join(ROAMING, 'npm', 'claude.cmd'), path.join(HOME, '.claude', 'local', 'claude.exe')]
      : [path.join(HOME, '.local', 'bin', 'claude'), path.join(HOME, '.claude', 'local', 'claude'), '/opt/homebrew/bin/claude', '/usr/local/bin/claude'];
  }
  if (id === 'codex') {
    return IS_WIN
      ? [path.join(ROAMING, 'npm', 'codex.cmd'), path.join(HOME, '.local', 'bin', 'codex.exe')]
      : ['/opt/homebrew/bin/codex', '/usr/local/bin/codex', path.join(HOME, '.local', 'bin', 'codex')];
  }
  return [];
}

function onPath(command) {
  const res = spawnSync(IS_WIN ? 'where.exe' : 'which', [command], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
  if (res.status !== 0) return '';
  const lines = String(res.stdout || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return (IS_WIN ? lines.find(line => /\.(exe|cmd|bat)$/i.test(line)) : lines[0]) || '';
}

const cache = new Map();

/**
 * 找某个工具的命令行程序。
 * @returns {{ path: string, source: 'path'|'installed'|'bundled'|'' }}
 */
export function locateTool(id, { fresh = false } = {}) {
  const hit = cache.get(id);
  if (!fresh && hit && Date.now() - hit.at < 60_000 && (!hit.path || fs.existsSync(hit.path))) return hit;
  const tool = TOOLS[id];
  let result = { path: '', source: '' };
  if (tool) {
    const fromPath = onPath(tool.command);
    if (fromPath) result = { path: fromPath, source: 'path' };
    else {
      const installed = installedLocations(id).find(file => fs.existsSync(file));
      if (installed) result = { path: installed, source: 'installed' };
      else {
        const bundled = id === 'claude' ? bundledClaude() : bundledCodex();
        if (bundled) result = { path: bundled, source: 'bundled' };
      }
    }
  }
  const entry = { ...result, at: Date.now() };
  cache.set(id, entry);
  return entry;
}

/** 命令名（claude / codex）在 PATH 里找不到时，退到官方安装位置和桌面版自带的那一份 */
export function fallbackCommand(command) {
  const id = Object.keys(TOOLS).find(key => TOOLS[key].command === String(command || '').toLowerCase());
  return id ? locateTool(id).path : '';
}

function runQuiet(file, args, timeout = 10_000) {
  const batch = IS_WIN && /\.(cmd|bat)$/i.test(file);
  const res = batch
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', `"${file}" ${args.join(' ')}`], { encoding: 'utf8', windowsHide: true, timeout, windowsVerbatimArguments: true })
    : spawnSync(file, args, { encoding: 'utf8', windowsHide: true, timeout });
  return { status: res.status, stdout: String(res.stdout || ''), stderr: String(res.stderr || '') };
}

/** 登录了没有：true / false / null（查不出来） */
export function signedIn(id, file) {
  if (!file) return false;
  if (id === 'claude') {
    if (process.env.ANTHROPIC_API_KEY) return true;
    const res = runQuiet(file, ['auth', 'status', '--json']);
    try {
      const data = JSON.parse(res.stdout.slice(res.stdout.indexOf('{')));
      return data.loggedIn === true;
    } catch {
      return res.status === 0 ? true : null;
    }
  }
  if (id === 'codex') {
    if (process.env.OPENAI_API_KEY) return true;
    const res = runQuiet(file, ['login', 'status']);
    if (res.status === 0) return true;
    return /not logged in/i.test(res.stdout + res.stderr) ? false : null;
  }
  return null;
}

/** 一个工具此刻的状态，给界面用 */
export function toolStatus(id) {
  const where = locateTool(id);
  return {
    id,
    name: TOOLS[id].name,
    agentId: TOOLS[id].agentId,
    found: !!where.path,
    path: where.path,
    source: where.source,
    signedIn: where.path ? signedIn(id, where.path) : false,
    needs: TOOLS[id].needs,
    site: TOOLS[id].site,
  };
}

// ---------- 一键安装：同一时间每个工具只有一个安装任务，日志留尾巴给界面看 ----------
const jobs = new Map();

export function installJob(id) {
  const job = jobs.get(id);
  return job ? { state: job.state, log: job.log.slice(-2000), error: job.error, startedAt: job.startedAt, endedAt: job.endedAt } : null;
}

/** 官方安装方式：Claude Code 走官方安装脚本；Codex 走 npm（本机没有 npm 时返回 needNode，界面给手动指引） */
export function installPlan(id) {
  if (id === 'claude') {
    return IS_WIN
      ? { file: 'powershell.exe', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'irm https://claude.ai/install.ps1 | iex'] }
      : { file: 'bash', args: ['-c', 'curl -fsSL https://claude.ai/install.sh | bash'] };
  }
  if (id === 'codex') {
    const npm = onPath('npm');
    if (!npm) return { needNode: true };
    return { file: npm, args: ['install', '-g', '@openai/codex'] };
  }
  return null;
}

/**
 * 开始安装（后台跑，立刻返回）。plan 可以由测试注入。
 * @returns {{ started: boolean, needNode?: boolean, already?: boolean }}
 */
export function startInstall(id, { plan = installPlan(id), onDone } = {}) {
  if (!TOOLS[id]) throw new Error(`unknown tool ${id}`);
  const current = jobs.get(id);
  if (current && current.state === 'running') return { started: false, already: true };
  if (!plan) throw new Error(`no install plan for ${id}`);
  if (plan.needNode) return { started: false, needNode: true };
  const job = { state: 'running', log: '', error: '', startedAt: Date.now(), endedAt: 0 };
  jobs.set(id, job);
  const batch = IS_WIN && /\.(cmd|bat)$/i.test(plan.file);
  const child = batch
    ? spawn('cmd.exe', ['/d', '/s', '/c', `"${plan.file}" ${plan.args.join(' ')}`], { windowsHide: true, windowsVerbatimArguments: true })
    : spawn(plan.file, plan.args, { windowsHide: true });
  const add = chunk => { job.log = (job.log + chunk.toString()).slice(-8000); };
  child.stdout && child.stdout.on('data', add);
  child.stderr && child.stderr.on('data', add);
  child.on('error', error => { job.state = 'failed'; job.error = error.message; job.endedAt = Date.now(); if (onDone) onDone(job); });
  child.on('close', code => {
    if (job.state !== 'running') return;
    cache.delete(id);
    const found = locateTool(id, { fresh: true }).path;
    job.state = code === 0 && found ? 'done' : 'failed';
    if (job.state === 'failed') job.error = code === 0 ? 'installed but the program was not found' : `exit ${code}`;
    job.endedAt = Date.now();
    if (onDone) onDone(job);
  });
  return { started: true };
}

/**
 * 打开官方登录：在一个看得见的终端窗口里跑 claude auth login / codex login（会自动打开浏览器）。
 * 打不开窗口的平台返回要手动运行的命令。
 */
export function openSignIn(id) {
  const where = locateTool(id);
  if (!where.path) return { opened: false, reason: 'missing' };
  const args = id === 'claude' ? ['auth', 'login'] : ['login'];
  const title = `${TOOLS[id].name} sign in`;
  const manual = `"${where.path}" ${args.join(' ')}`;
  try {
    if (IS_WIN) {
      spawn('cmd.exe', ['/d', '/s', '/c', `start "${title}" ${manual}`], { detached: true, stdio: 'ignore', windowsHide: false, windowsVerbatimArguments: true }).unref();
      return { opened: true };
    }
    if (IS_MAC) {
      const script = `tell application "Terminal" to do script ${JSON.stringify(manual)}`;
      spawn('osascript', ['-e', script, '-e', 'tell application "Terminal" to activate'], { detached: true, stdio: 'ignore' }).unref();
      return { opened: true };
    }
    const term = onPath('x-terminal-emulator') || onPath('gnome-terminal');
    if (term) {
      spawn(term, ['-e', `sh -c '${manual}; exec sh'`], { detached: true, stdio: 'ignore' }).unref();
      return { opened: true };
    }
  } catch {
    /* 落到手动 */
  }
  return { opened: false, manual };
}
