// 群臣市场：市面上常见的 AI 工具，点「＋」就接进朝堂（没装的一键安装）。
//
// 每一项写明：是什么、长处短处、需要什么账号、怎么装、接进来以后怎么调用（与 role-preset.json 同一套字段）。
// 调用方式都核实过各家文档或 --help；拿不准的地方（模型名会变）只给常用候选，界面上可以改。
//
//   kind: agent —— 命令行 AI 员工，能担任官职、自动办差
//         gui   —— 只有图形界面（如千问办公）：能任职，但派到它的差事要你手动办完回填（丞相模式下转给代办）
//         tool  —— 不是员工，是给员工用的工具（如 seedance 生视频）：装好后写进工部职掌，办差的员工去调它
//
// prompt 怎么交给 CLI：
//   stdin —— 从标准输入喂（Claude Code、Codex、DSH、Gemini CLI……），不受命令行长度限制
//   file  —— 只收参数的 CLI（OpenCode、Cursor）：提示词写进临时文件，参数里只放「去读这个文件」一句话。
//            Windows 上 npm 装的 CLI 是 .cmd，经 cmd.exe 转一道，长提示词与换行会被截断或压平，所以不直接塞参数。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const IS_WIN = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';
const HOME = os.homedir();

// 只收参数的 CLI：参数里放这一句，提示词全文在 {promptFile}
const READ_FILE = 'Read the task in the file {promptFile} and carry it out exactly. The file is the full instruction.';
// Gemini CLI / Qwen Code：-p 的内容接在标准输入后面
const AFTER_STDIN = 'Carry out the instructions above.';

const npmPlan = pkg => ({ npm: pkg });
const scriptPlan = (win, unix) => ({ script: { win, unix } });

export const CATALOG = [
  {
    id: 'claude',
    agentId: 'cc',
    name: 'Claude Code',
    vendor: 'Anthropic',
    kind: 'agent',
    commands: ['claude'],
    site: 'https://claude.com/product/claude-code',
    desc: { zh: 'Anthropic 的命令行编程助手，读懂整个代码库再动手，规划与实现都强。', en: 'Anthropic\'s coding agent: reads the whole codebase before acting; strong at planning and implementation.' },
    pros: { zh: ['规划、架构、改大代码库最稳', '会话可续接，国库有真账', '可选思考深度（low → max）'], en: ['Most reliable on planning and large codebases', 'Resumable sessions; real usage numbers', 'Selectable effort (low → max)'] },
    cons: { zh: ['价格偏高', '需要 Claude 订阅或 Anthropic API Key'], en: ['On the expensive side', 'Needs a Claude plan or an Anthropic API key'] },
    needs: { zh: 'Claude 订阅（Pro / Max）或 Anthropic API Key', en: 'A Claude plan (Pro / Max) or an Anthropic API key' },
    install: scriptPlan('irm https://claude.ai/install.ps1 | iex', 'curl -fsSL https://claude.ai/install.sh | bash'),
    signIn: ['auth', 'login'],
    // 模板就是 role-preset.json 里的 cc
  },
  {
    id: 'codex',
    agentId: 'codex',
    name: 'Codex',
    vendor: 'OpenAI',
    kind: 'agent',
    commands: ['codex'],
    site: 'https://developers.openai.com/codex',
    desc: { zh: 'OpenAI 的命令行编程助手，审查与测试眼光毒，适合当「门下省」挑别家的毛病。', en: 'OpenAI\'s coding agent; a sharp reviewer and tester, ideal for checking another vendor\'s work.' },
    pros: { zh: ['审查、找 bug、写测试强', '自带沙箱，权限分级清楚', '可选推理强度'], en: ['Strong at review, bug hunting and tests', 'Built-in sandbox with clear permission levels', 'Selectable reasoning effort'] },
    cons: { zh: ['需要 ChatGPT 订阅或 OpenAI API Key', '会话续接暂未接入'], en: ['Needs a ChatGPT plan or an OpenAI API key', 'Session resume not wired up yet'] },
    needs: { zh: 'ChatGPT 订阅或 OpenAI API Key', en: 'A ChatGPT plan or an OpenAI API key' },
    install: npmPlan('@openai/codex'),
    signIn: ['login'],
  },
  {
    id: 'dsh',
    agentId: 'dsh',
    name: 'DSH',
    vendor: 'DeepSeek',
    kind: 'agent',
    commands: ['dsh'],
    site: 'https://dshbase.com/zh/plugins/',
    desc: { zh: 'DeepSeek Harness 本体（dsh headless），随 DSH 一起装好，用桌面端的登录。', en: 'DeepSeek Harness itself (dsh headless); comes with DSH and uses the desktop sign-in.' },
    pros: { zh: ['装好 DSH 就有，不用另外装', '便宜，中文与长文本好', '一个人能顶所有岗位'], en: ['Already there with DSH', 'Cheap; good at Chinese and long text', 'Can fill every office alone'] },
    cons: { zh: ['只有它一家时没有「别家来审」'], en: ['Alone, there is no second opinion from another vendor'] },
    needs: { zh: 'DSH 桌面端已登录，或 DEEPSEEK_API_KEY', en: 'DSH signed in, or DEEPSEEK_API_KEY' },
    install: null,
    builtIn: true,
  },
  {
    id: 'workbuddy',
    agentId: 'workbuddy',
    name: 'WorkBuddy',
    vendor: '腾讯 Tencent',
    kind: 'agent',
    commands: ['codebuddy'],
    site: 'https://www.workbuddy.ai/docs/cli/overview',
    desc: { zh: '腾讯 CodeBuddy 的命令行（codebuddy），可切换混元、GLM、Kimi、DeepSeek 等国产模型。', en: 'Tencent CodeBuddy\'s CLI (codebuddy), switching between Hunyuan, GLM, Kimi, DeepSeek and more.' },
    pros: { zh: ['国内网络直连', '一个账号切多家国产模型', '表格、文档、报表顺手'], en: ['Works on networks in mainland China', 'One account, many domestic models', 'Handy for spreadsheets and reports'] },
    cons: { zh: ['与 WorkBuddy 桌面端共用配置，偶有冲突', '用量暂按字数估算'], en: ['Shares config with the WorkBuddy desktop app', 'Usage is estimated from text length'] },
    needs: { zh: 'CodeBuddy / WorkBuddy 账号（首次运行登录）', en: 'A CodeBuddy / WorkBuddy account (sign in on first run)' },
    install: npmPlan('@tencent-ai/codebuddy-code'),
    signIn: [],
  },
  {
    id: 'gemini',
    agentId: 'gemini',
    name: 'Gemini CLI',
    vendor: 'Google',
    kind: 'agent',
    commands: ['gemini'],
    site: 'https://github.com/google-gemini/gemini-cli',
    desc: { zh: 'Google 的开源命令行助手，上下文窗口很长，适合读大量资料、写长文与数据整理。', en: 'Google\'s open-source CLI agent with a very long context: good for reading a lot, long writing and data work.' },
    pros: { zh: ['上下文超长，整仓阅读不吃力', '个人 Google 账号有免费额度', '开源'], en: ['Very long context', 'Free tier with a personal Google account', 'Open source'] },
    cons: { zh: ['国内网络需要代理', '会话续接与用量暂未接入'], en: ['Needs a proxy in mainland China', 'Session resume and usage not wired up yet'] },
    needs: { zh: 'Google 账号（首次运行登录）或 GEMINI_API_KEY', en: 'A Google account (sign in on first run) or GEMINI_API_KEY' },
    install: npmPlan('@google/gemini-cli'),
    signIn: [],
    agent: {
      id: 'gemini', name: 'Gemini CLI', adapter: 'cli', command: 'gemini',
      args: ['-p', AFTER_STDIN], promptMode: 'stdin',
      modelArgs: ['--model', '{model}'], models: ['gemini-2.5-pro', 'gemini-2.5-flash'],
      // 隔离分支里只放开改文件；丞相 / 完全权限才全放开
      execArgs: ['--approval-mode', 'auto_edit'], autoArgs: ['--approval-mode', 'yolo'],
      outputFormat: 'text', formatArgs: [], resumeArgs: [], timeoutMs: 900000,
      traits: ['长上下文', '资料', '长文', '数据'],
    },
  },
  {
    id: 'cursor',
    agentId: 'cursor',
    name: 'Cursor CLI',
    vendor: 'Cursor',
    kind: 'agent',
    commands: ['cursor-agent', 'agent'],
    site: 'https://cursor.com/docs/cli/overview',
    desc: { zh: 'Cursor 编辑器的命令行版（cursor-agent / agent），一个订阅里可用多家前沿模型。', en: 'The command-line side of the Cursor editor (cursor-agent / agent): several frontier models under one plan.' },
    pros: { zh: ['一个 Cursor 订阅用多家模型', '写代码快，适合当兵部'], en: ['Several vendors\' models under one plan', 'Fast at writing code'] },
    cons: { zh: ['需要 Cursor 账号或 CURSOR_API_KEY', '改文件要 --force（同时放开命令）', 'Windows 版较新'], en: ['Needs a Cursor account or CURSOR_API_KEY', 'Editing needs --force (also allows commands)', 'The Windows build is recent'] },
    needs: { zh: 'Cursor 账号（agent login）或 CURSOR_API_KEY', en: 'A Cursor account (agent login) or CURSOR_API_KEY' },
    install: scriptPlan("irm 'https://cursor.com/install?win32=true' | iex", 'curl https://cursor.com/install -fsS | bash'),
    signIn: ['login'],
    agent: {
      id: 'cursor', name: 'Cursor CLI', adapter: 'cli', command: 'cursor-agent',
      args: ['-p', '--output-format', 'text', READ_FILE], promptMode: 'file',
      modelArgs: ['--model', '{model}'], models: [],
      execArgs: ['--force'], autoArgs: ['--force'],
      outputFormat: 'text', formatArgs: [], resumeArgs: [], timeoutMs: 900000,
      traits: ['实现', '多模型'],
    },
  },
  {
    id: 'opencode',
    agentId: 'opencode',
    name: 'OpenCode',
    vendor: 'SST',
    kind: 'agent',
    commands: ['opencode'],
    site: 'https://opencode.ai/docs/cli',
    desc: { zh: '开源的终端编程助手，模型自带（provider/model），能接 DeepSeek、Kimi、Claude、OpenAI 等几十家。', en: 'An open-source terminal coding agent that brings your own model (provider/model): DeepSeek, Kimi, Claude, OpenAI and dozens more.' },
    pros: { zh: ['开源，不绑定厂家', '想用哪家模型就接哪家的 Key', '适合拿便宜模型跑量'], en: ['Open source, no vendor lock-in', 'Use any provider\'s key', 'Good for running volume on cheap models'] },
    cons: { zh: ['要先在 OpenCode 里配好模型与 Key', '模型名形如 deepseek/deepseek-chat，需手填'], en: ['Configure a provider and key in OpenCode first', 'Model ids look like deepseek/deepseek-chat'] },
    needs: { zh: '任意一家模型的 API Key（opencode auth login）', en: 'An API key from any provider (opencode auth login)' },
    install: npmPlan('opencode-ai'),
    signIn: ['auth', 'login'],
    agent: {
      id: 'opencode', name: 'OpenCode', adapter: 'cli', command: 'opencode',
      args: ['run', READ_FILE], promptMode: 'file',
      modelArgs: ['--model', '{model}'], models: [],
      execArgs: [], autoArgs: [],
      outputFormat: 'text', formatArgs: [], resumeArgs: [], timeoutMs: 900000,
      traits: ['开源', '自带模型', '实现'],
    },
  },
  {
    id: 'qwen-code',
    agentId: 'qwen-code',
    name: 'Qwen Code',
    vendor: '阿里 Alibaba',
    kind: 'agent',
    commands: ['qwen'],
    site: 'https://github.com/QwenLM/qwen-code',
    desc: { zh: '通义千问的命令行编程助手（qwen），千问办公能做的文字活它能自动办。', en: 'Alibaba Qwen\'s command-line agent (qwen); automates the writing work Qwen Office does by hand.' },
    pros: { zh: ['国内网络直连', '千问账号有免费额度', '中文写作好'], en: ['Works on networks in mainland China', 'Free tier with a Qwen account', 'Good Chinese writing'] },
    cons: { zh: ['非交互改文件要 --yolo（同时放开命令）', '用量暂按字数估算'], en: ['Editing without prompts needs --yolo (also allows commands)', 'Usage is estimated from text length'] },
    needs: { zh: '千问账号（首次运行登录）或 DashScope API Key', en: 'A Qwen account (sign in on first run) or a DashScope API key' },
    install: npmPlan('@qwen-code/qwen-code'),
    signIn: [],
    agent: {
      id: 'qwen-code', name: 'Qwen Code', adapter: 'cli', command: 'qwen',
      args: ['-p', AFTER_STDIN], promptMode: 'stdin',
      modelArgs: ['--model', '{model}'], models: ['qwen3-coder-plus'],
      execArgs: ['--yolo'], autoArgs: ['--yolo'],
      outputFormat: 'text', formatArgs: [], resumeArgs: [], timeoutMs: 900000,
      traits: ['中文', '文书', '实现'],
    },
  },
  {
    id: 'qwen',
    agentId: 'qwen',
    name: '千问办公',
    vendor: '阿里 Alibaba',
    kind: 'gui',
    commands: [],
    site: '',
    desc: { zh: '只有图形界面的办公助手：公文、PPT、会议纪要。派到它的差事会出工单，你在千问里办完回填。', en: 'A GUI-only office assistant (documents, slides, minutes). Orders sent to it become work orders you finish in Qwen and fill back.' },
    pros: { zh: ['公文、PPT、纪要排版好', '不用装命令行'], en: ['Good layouts for documents, slides and minutes', 'No command line needed'] },
    cons: { zh: ['不能自动办差：要你手动回填', '丞相模式下由代办接手'], en: ['Cannot work unattended: you fill in the result', 'In autonomy the deputy stands in'] },
    needs: { zh: '千问桌面端或网页版', en: 'The Qwen desktop app or website' },
    install: null,
    agent: { id: 'qwen', name: '千问办公', adapter: 'manual', models: [], traits: ['公文', 'PPT', '会议纪要'] },
  },
  {
    id: 'seedance',
    agentId: '',
    name: 'Seedance CLI',
    vendor: '第三方 · 字节 Seedance 模型',
    kind: 'tool',
    commands: ['seedance'],
    site: 'https://github.com/paperfoot/seedance-cli',
    desc: { zh: '用字节跳动 Seedance 生成视频的命令行（第三方开源）。它不是员工：装好后写进工部职掌，办差的员工直接调 seedance 命令出片。', en: 'A third-party open-source CLI that generates video with ByteDance Seedance. Not an officer: once installed it is written into the Aedile\'s remit and the magistrates call it to render clips.' },
    pros: { zh: ['短视频流水线的「画面生成」一步能自动办', '按秒计费'], en: ['Automates the visuals step of a short-video pipeline', 'Pay per second'] },
    cons: { zh: ['第三方工具，非字节官方', '需要 SEEDANCE_API_KEY（BytePlus ModelArk）', '没有一键安装：用 cargo 或 Homebrew 装'], en: ['Third-party, not official', 'Needs SEEDANCE_API_KEY (BytePlus ModelArk)', 'No one-click install: use cargo or Homebrew'] },
    needs: { zh: 'BytePlus ModelArk 的 SEEDANCE_API_KEY', en: 'SEEDANCE_API_KEY from BytePlus ModelArk' },
    install: { manual: 'cargo install seedance' },
    duty: { role: 'works', zh: '可用 seedance 命令行生成视频片段（seedance generate --prompt "…" --wait，需 SEEDANCE_API_KEY）', en: 'May render clips with the seedance CLI (seedance generate --prompt "…" --wait; needs SEEDANCE_API_KEY)' },
  },
];

export const catalogEntry = id => CATALOG.find(item => item.id === id) || null;
export const catalogOfAgent = agentId => CATALOG.find(item => item.agentId && item.agentId === agentId) || null;

// ---------- 找：PATH → npm 全局目录（装完以后 DSH 进程的 PATH 还是旧的） ----------
function onPath(command) {
  const res = spawnSync(IS_WIN ? 'where.exe' : 'which', [command], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
  if (res.status !== 0) return '';
  const lines = String(res.stdout || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return (IS_WIN ? lines.find(line => /\.(exe|cmd|bat)$/i.test(line)) : lines[0]) || '';
}

let npmPrefixCache = null;
function npmPrefix() {
  if (npmPrefixCache !== null) return npmPrefixCache;
  npmPrefixCache = '';
  const npm = onPath('npm');
  if (!npm) return npmPrefixCache;
  const res = IS_WIN
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', `"${npm}" prefix -g`], { encoding: 'utf8', windowsHide: true, timeout: 10_000, windowsVerbatimArguments: true })
    : spawnSync(npm, ['prefix', '-g'], { encoding: 'utf8', timeout: 10_000 });
  npmPrefixCache = String(res.stdout || '').trim().split(/\r?\n/).pop() || '';
  return npmPrefixCache;
}

function knownLocations(command) {
  const out = [];
  const prefix = npmPrefix();
  if (IS_WIN) {
    if (prefix) out.push(path.join(prefix, `${command}.cmd`));
    out.push(path.join(process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming'), 'npm', `${command}.cmd`));
    out.push(path.join(HOME, '.local', 'bin', `${command}.exe`), path.join(HOME, '.local', 'bin', `${command}.cmd`));
  } else {
    if (prefix) out.push(path.join(prefix, 'bin', command));
    out.push(path.join(HOME, '.local', 'bin', command), path.join(HOME, '.cargo', 'bin', command), '/opt/homebrew/bin/' + command, '/usr/local/bin/' + command);
  }
  return out;
}

const found = new Map();

/** 找这一项的命令行：返回 { path, command }，没找到 path 为空 */
export function locateEntry(entry, { fresh = false } = {}) {
  if (!entry || !entry.commands.length) return { path: '', command: '' };
  const hit = found.get(entry.id);
  if (!fresh && hit && Date.now() - hit.at < 60_000) return hit;
  let result = { path: '', command: entry.commands[0] };
  for (const command of entry.commands) {
    const file = onPath(command) || knownLocations(command).find(item => fs.existsSync(item)) || '';
    if (file) { result = { path: file, command }; break; }
  }
  const entryHit = { ...result, at: Date.now() };
  found.set(entry.id, entryHit);
  return entryHit;
}

export function forgetLocation(id) {
  found.delete(id);
}

/** 登录了没有：true / false / null（查不出来）。只做不花钱的检查：环境变量、凭据文件 */
export function catalogSignedIn(entry) {
  if (entry.id === 'gemini') {
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return true;
    return fs.existsSync(path.join(HOME, '.gemini', 'oauth_creds.json')) ? true : null;
  }
  if (entry.id === 'qwen-code') {
    if (process.env.DASHSCOPE_API_KEY) return true;
    return fs.existsSync(path.join(HOME, '.qwen', 'oauth_creds.json')) ? true : null;
  }
  if (entry.id === 'cursor' && process.env.CURSOR_API_KEY) return true;
  return null;
}

/**
 * 安装方式。npm 装的要本机有 npm；脚本装的走各家官方脚本；没有一键安装的给手动命令。
 * @returns {{ file, args } | { needNode: true } | { manual: string } | null}
 */
export function catalogInstallPlan(entry) {
  const plan = entry && entry.install;
  if (!plan) return null;
  if (plan.manual) return { manual: plan.manual };
  if (plan.npm) {
    const npm = onPath('npm');
    return npm ? { file: npm, args: ['install', '-g', plan.npm] } : { needNode: true };
  }
  if (plan.script) {
    return IS_WIN
      ? { file: 'powershell.exe', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', plan.script.win] }
      : { file: 'bash', args: ['-c', plan.script.unix] };
  }
  return null;
}

/** 给界面看的一句话：会执行什么安装命令（点之前就知道） */
export function installText(entry) {
  const plan = entry && entry.install;
  if (!plan) return '';
  if (plan.manual) return plan.manual;
  if (plan.npm) return `npm install -g ${plan.npm}`;
  if (plan.script) return IS_WIN ? plan.script.win : plan.script.unix;
  return '';
}

/**
 * 接进朝堂时的 agent 配置：有模板用模板（命令换成本机找到的那个名字），没有返回 null（用 role-preset.json 里的）。
 */
export function agentFromEntry(entry, located = {}) {
  if (!entry || !entry.agent) return null;
  const agent = structuredClone(entry.agent);
  if (agent.adapter === 'cli' && located.command) agent.command = located.command;
  agent.catalogId = entry.id;
  agent.enabled = true;
  return agent;
}

/** 在看得见的终端里跑登录命令（各家都会自己打开浏览器）。打不开窗口的平台返回要手动运行的命令 */
export function openTerminal(file, args, title) {
  const manual = `"${file}" ${args.join(' ')}`.trim();
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
