// 三省六部 · DSH 插件宿主半入口
// 职责：管群臣（本机各 AI 工具）→ 排官职（三省六部）→ 接奏折（任务）→ 跑朝堂流程 → 上奏待批红。
// 浏览器半（client.js）通过 /sansheng-liubu/* 这组 HTTP 端点读写状态。
//
// v0.6：每份奏折在 git worktree 里隔离办差（批红合并、驳回丢弃）；门下审议失败即关闭；
// 依赖图并行办差；人工岗位暂停等回填；史馆记忆跨奏折的教训；中 / 英（古罗马）两套官制。
import fs from 'node:fs';
import path from 'node:path';
import { createStore } from './lib/store.mjs';
import { spawn } from 'node:child_process';
import os from 'node:os';
import { runAgent, probeAgent } from './lib/adapters.mjs';
import { runEdict, normalizeVerdict, deliverablePath } from './lib/court.mjs';
import { ministriesOf, splitHandoff, extractJson } from './lib/prompts.mjs';
import { tr, fail, errorText, normalizeLocale, roleTitle, MINISTRY_IDS, ROLE_IDS } from './lib/i18n.mjs';
import { createAnnals, tokens } from './lib/annals.mjs';
import { impactOf } from './lib/impact.mjs';
import * as git from './lib/git.mjs';
import { WORKFLOW_TEMPLATES, resolveWorkflow, cleanWorkflow } from './lib/workflows.mjs';
import { createTreasury, costOf, savedOf, DEFAULT_PRICES } from './lib/treasury.mjs';
import { createWiki } from './lib/wiki.mjs';
import { historianPrompt } from './lib/prompts.mjs';
import { regimeOf, actualRegimeOf, puppetIndex, puppetVerdict, powerOf, POWERS, REGIMES, REGIME_TEXT } from './lib/regime.mjs';

// DSH 自带的 defineTool（dsh-openwrite 同款）。本插件以 link: 方式装进 profile 时可能解析不到，就按原样注册。
let defineTool = definition => definition;
try {
  ({ defineTool } = await import('@deepseek-ai/dsh-tools'));
} catch {
  /* 解析不到时用恒等函数 */
}

export const name = 'dsh-sansheng-liubu';
export const inject = ['tools', 'webServer'];

const ROUTE_PREFIX = '/sansheng-liubu';
const BACKGROUND_TYPES = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
const MINISTRY_SET = new Set(MINISTRY_IDS);
const ACTIVE_STATUSES = new Set(['running', 'queued', 'awaiting-input']);
const clampInt = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
};

// 下旨时选的权限，与 DSH 输入框一致：仅可查看 / 工作区内修改 / 完全权限
const PERMISSIONS = new Set(['read', 'workspace', 'full']);
function permissionOf(edict, rules) {
  if (PERMISSIONS.has(edict.permission)) return edict.permission;
  return rules.execWrites === false ? 'read' : 'workspace';
}

const ATTACH_MAX = 10 * 1024 * 1024;
const ATTACH_TOTAL = 20 * 1024 * 1024;
/** 随旨交下的文件：[{ name, data: base64 或 data URL }] → 存进奏折目录的 attachments/，返回 [{ name, path, size }] */
function saveAttachments(store, edict, list) {
  if (!Array.isArray(list) || !list.length) return [];
  const dir = path.join(store.root, 'edicts', edict.id, 'attachments');
  const saved = [];
  let total = 0;
  for (const item of list.slice(0, 12)) {
    // 只留文件名，去掉路径与 Windows 不允许的字符，防止写出目录
    const name = path.basename(String((item && item.name) || '')).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 120);
    const data = String((item && item.data) || '').replace(/^data:[^,]*,/, '');
    if (!name || !data) continue;
    const bytes = Buffer.from(data, 'base64');
    total += bytes.length;
    if (bytes.length > ATTACH_MAX || total > ATTACH_TOTAL) fail('errAttachSize');
    fs.mkdirSync(dir, { recursive: true });
    let target = path.join(dir, name);
    for (let n = 2; fs.existsSync(target); n += 1) target = path.join(dir, `${n}-${name}`);
    fs.writeFileSync(target, bytes);
    saved.push({ name: path.basename(target), path: target, size: bytes.length });
  }
  return saved;
}

/** DSH 侧栏里的工作区（$DSH_HOME/storages/workspace.json），按 DSH 自己的顺序；只读，不存在的目录跳过 */
function dshWorkspaces() {
  try {
    const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
    const data = JSON.parse(fs.readFileSync(path.join(home, 'storages', 'workspace.json'), 'utf8'));
    const table = (data.tables && data.tables.workspaces) || {};
    const ids = (data.global && Array.isArray(data.global.workspaceIds)) ? data.global.workspaceIds : Object.keys(table);
    return ids.map(id => table[id]).filter(item => item && item.path && fs.existsSync(item.path))
      .map(item => ({ path: item.path, title: String(item.title || '') }));
  } catch {
    return [];
  }
}

/** 没选工作目录时给这道旨新建的产出文件夹：文档/SanshengLiubu/<年月日-时分秒>（SANSHENG_OUTPUT_DIR 可改根目录） */
function outputRoot() {
  const docs = path.join(os.homedir(), 'Documents');
  return process.env.SANSHENG_OUTPUT_DIR || path.join(fs.existsSync(docs) ? docs : os.homedir(), 'SanshengLiubu');
}
function newOutputFolder(now = new Date()) {
  const base = outputRoot();
  const p = n => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  let dir = path.join(base, stamp);
  for (let n = 2; fs.existsSync(dir); n += 1) dir = path.join(base, `${stamp}-${n}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** 不是 git 仓库时，「改了哪些文件」只能看修改时间：列出开朝以后动过的文件（有上限，跳过依赖与缓存目录） */
const SKIP_DIRS = new Set(['node_modules', '.git', '.venv', 'venv', '__pycache__', 'dist', 'build', '.next', '.cache']);
export function recentFiles(root, since, { maxVisit = 3000, maxOut = 60 } = {}) {
  const out = [];
  const queue = [''];
  let visited = 0;
  while (queue.length && visited < maxVisit) {
    const rel = queue.shift();
    let entries = [];
    try {
      entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (++visited > maxVisit) break;
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) queue.push(child);
      } else if (entry.isFile()) {
        try {
          const stat = fs.statSync(path.join(root, child));
          if (stat.mtimeMs >= since - 1000) out.push({ file: child, add: 0, del: 0, mtime: stat.mtimeMs, size: stat.size });
        } catch {
          /* 读不到就跳过 */
        }
      }
    }
  }
  return out.sort((a, b) => b.mtime - a.mtime).slice(0, maxOut);
}

// 「打开」只对文档、图片、音视频这类直接用默认程序打开；脚本、程序一律只在文件夹里定位，不替用户执行
const OPENABLE = new Set(['html', 'htm', 'md', 'txt', 'log', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'mp3', 'wav', 'ogg', 'flac', 'm4a', 'mid', 'midi', 'mp4', 'webm', 'mov', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'json']);
export const canOpenFile = file => OPENABLE.has(path.extname(String(file)).slice(1).toLowerCase());

/** 用系统的文件管理器打开文件夹 / 在文件夹里选中文件 / 用默认程序打开文件 */
function openInOs(target, how) {
  let command;
  let args;
  let verbatim = false;
  if (process.platform === 'win32') {
    command = 'explorer.exe';
    verbatim = true;
    args = [how === 'reveal' ? `/select,"${target}"` : `"${target}"`];
  } else if (process.platform === 'darwin') {
    command = 'open';
    args = how === 'reveal' ? ['-R', target] : [target];
  } else {
    command = 'xdg-open';
    args = [how === 'reveal' ? path.dirname(target) : target];
  }
  const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsVerbatimArguments: verbatim });
  child.on('error', () => {});
  child.unref();
}

/** 系统的选文件夹对话框；取消或不支持时 path 为空 */
function pickFolderDialog(start) {
  return new Promise(resolve => {
    let command;
    let args;
    const env = { ...process.env, SANSHENG_START: start && fs.existsSync(start) ? start : '' };
    if (process.platform === 'win32') {
      command = 'powershell.exe';
      args = ['-NoProfile', '-STA', '-Command', [
        '[Console]::OutputEncoding = [Text.Encoding]::UTF8',
        'Add-Type -AssemblyName System.Windows.Forms',
        // 用一个置顶的隐形窗口当父窗口，对话框才会出现在 DSH 前面
        '$owner = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true; ShowInTaskbar = $false }',
        '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
        '$dialog.ShowNewFolderButton = $true',
        'if ($env:SANSHENG_START) { $dialog.SelectedPath = $env:SANSHENG_START }',
        "if ($dialog.ShowDialog($owner) -eq 'OK') { [Console]::Out.Write($dialog.SelectedPath) }",
      ].join('; ')];
    } else if (process.platform === 'darwin') {
      command = 'osascript';
      args = ['-e', 'POSIX path of (choose folder)'];
    } else {
      command = 'zenity';
      args = ['--file-selection', '--directory'];
    }
    let out = '';
    let child;
    try {
      child = spawn(command, args, { env, windowsHide: false, stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      resolve({ path: '', unsupported: true });
      return;
    }
    const timer = setTimeout(() => child.kill(), 10 * 60 * 1000);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', text => { out += text; });
    child.on('error', () => { clearTimeout(timer); resolve({ path: '', unsupported: true }); });
    child.on('close', () => {
      clearTimeout(timer);
      const picked = out.trim().replace(/[\\/]$/, '') || out.trim();
      resolve({ path: picked && fs.existsSync(picked) ? picked : '' });
    });
  });
}

function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('body too large'), { key: 'errBody', vars: {} }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

const isLoopback = host => /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/i.test(String(host || '').replace(/:\d+$/, ''));

/**
 * 跨站请求防护：改状态的请求会让本机 CLI 执行任务，不能让任意网页用一个表单就触发。
 * 1) 只收 application/json（表单发不出这个类型，跨站 fetch 发它又要过 CORS 预检，本端点不放行）；
 * 2) 浏览器标明跨站的直接拒；Origin 与 Host 对不上的拒（两边都是本机回环地址时放行，兼容开发代理）。
 * @returns {string | null} 拒绝原因的文案 key
 */
export function checkRequest(req, method) {
  if (method === 'GET' || method === 'HEAD') return null;
  const headers = req.headers || {};
  if (String(headers['sec-fetch-site'] || '') === 'cross-site') return 'errOrigin';
  const origin = headers.origin;
  if (origin && origin !== 'null') {
    let parsed = null;
    try {
      parsed = new URL(origin);
    } catch {
      return 'errOrigin';
    }
    if (/^https?:$/.test(parsed.protocol) && parsed.host !== headers.host && !(isLoopback(parsed.host) && isLoopback(headers.host))) {
      return 'errOrigin';
    }
  }
  if (!/application\/json/i.test(String(headers['content-type'] || ''))) return 'errJsonOnly';
  return null;
}

/**
 * 把一份回奏变成群聊里能读的样子：去掉给尚书省看的移文 JSON；方案 / 审议这类 JSON 输出换成一句话。
 * @returns {{ body, handoff, summary }}
 */
export function readableReport(output, { parse = '', locale = 'zh', ministryIds = MINISTRY_SET } = {}) {
  const { body, handoff } = splitHandoff(output, ministryIds);
  let summary = body;
  if (parse === 'plan') {
    const plan = extractJson(body);
    if (plan && Array.isArray(plan.steps)) {
      const list = plan.steps.map(step => `${roleTitle(locale, step && step.ministry)} · ${(step && step.title) || ''}`).join(' → ');
      summary = `${plan.summary || ''}\n${tr(locale, 'planSteps', { n: plan.steps.length, list })}`;
    }
  } else if (parse === 'verdict') {
    const verdict = extractJson(body);
    if (verdict && verdict.verdict) {
      const approve = normalizeVerdict(verdict.verdict) === 'approve';
      const issues = Array.isArray(verdict.issues) ? verdict.issues.filter(Boolean) : [];
      summary = `${tr(locale, approve ? 'verdictApprove' : 'verdictReject')}${issues.length ? `: ${issues.join('; ')}` : ''}`;
    }
  }
  return { body, handoff, summary: String(summary || '').trim() };
}

function sanitizePreset(input, current) {
  const next = {
    agents: Array.isArray(input.agents) ? input.agents : current.agents,
    roles: input.roles && typeof input.roles === 'object' ? input.roles : current.roles,
    rules: { ...current.rules, ...(input.rules || {}) },
  };
  const allowedAdapters = new Set(['cli', 'self', 'manual']);
  const seen = new Set();
  const list = value => (Array.isArray(value) ? value.map(String) : []);
  next.agents = next.agents.map(raw => {
    const agent = {
      id: String(raw.id || '').trim(),
      name: String(raw.name || raw.id || '').trim(),
      adapter: allowedAdapters.has(raw.adapter) ? raw.adapter : 'cli',
      enabled: raw.enabled !== false,
      traits: list(raw.traits),
      command: String(raw.command || '').trim(),
      args: list(raw.args),
      modelArgs: list(raw.modelArgs),
      // 结构化输出：国库要的用量、续接要的会话 id 都从这里来
      outputFormat: ['claude-stream', 'codex-json', 'dsh-json'].includes(raw.outputFormat) ? raw.outputFormat : 'text',
      // 不收模型参数的 CLI 用环境变量选模型（dsh headless：SANSHENG_DSH_MODEL）、定权限（DSH_PERMISSION_MODE）
      modelEnv: /^[A-Z][A-Z0-9_]{1,63}$/.test(String(raw.modelEnv || '')) ? String(raw.modelEnv) : '',
      permissionEnv: /^[A-Z][A-Z0-9_]{1,63}$/.test(String(raw.permissionEnv || '')) ? String(raw.permissionEnv) : '',
      formatArgs: list(raw.formatArgs),
      // 续接会话的参数模板（{session}）；留空 = 这个 CLI 不续接，每轮发完整提示词
      resumeArgs: list(raw.resumeArgs),
      // 常规模式执行差事时追加：放开写文件（各部在隔离分支里办差）
      execArgs: list(raw.execArgs),
      // 丞相模式下追加的参数：放开 CLI 自己的权限确认（如 claude --permission-mode acceptEdits、codex --full-auto）
      autoArgs: list(raw.autoArgs),
      models: list(raw.models).filter(Boolean),
      promptMode: raw.promptMode === 'arg' ? 'arg' : 'stdin',
      timeoutMs: Math.max(10_000, Number(raw.timeoutMs) || 600_000),
      env: raw.env && typeof raw.env === 'object' ? raw.env : {},
    };
    if (!/^[a-z0-9-]{2,32}$/.test(agent.id)) fail('errAgentId', { id: agent.id });
    if (seen.has(agent.id)) fail('errAgentDup', { id: agent.id });
    seen.add(agent.id);
    if (agent.adapter === 'cli' && !agent.command) fail('errNoCommand', { name: agent.name });
    return agent;
  });
  const agentIds = new Set(next.agents.map(agent => agent.id));
  for (const [roleId, role] of Object.entries(next.roles)) {
    if (!role || typeof role !== 'object') fail('errRoleConfig', { role: roleId });
    if (role.agentId && !agentIds.has(role.agentId)) fail('errRoleAgent', { role: roleId, agent: role.agentId });
    // 每个岗位可以单独指定模型；留空 = 用该 CLI 的默认模型
    role.model = String(role.model || '').trim().slice(0, 80);
    // 职掌会写进拟旨 prompt，中书按它派活；界面上可改（如套用「短视频」官制）
    role.duty = String(role.duty || '').trim().slice(0, 200);
  }
  const rules = next.rules;
  rules.maxReviewRounds = clampInt(rules.maxReviewRounds, 1, 5, 3);
  rules.maxSteps = clampInt(rules.maxSteps, 1, 12, 8);
  rules.autonomous = rules.autonomous === true;
  rules.maxFixRounds = clampInt(rules.maxFixRounds, 0, 3, 2);
  rules.isolation = rules.isolation === 'off' ? 'off' : 'worktree';
  rules.autoMerge = rules.autoMerge === true;
  rules.execWrites = rules.execWrites !== false;
  rules.parallel = clampInt(rules.parallel, 1, 4, 2);
  rules.maxConcurrent = clampInt(rules.maxConcurrent, 1, 4, 2);
  // 朝局定皇权（看得见多少、能不能驳回、几份几部同时办）；关掉就按上面两条朝规走
  rules.regimePowers = rules.regimePowers !== false;
  rules.useMemory = rules.useMemory !== false;
  rules.maxRetries = clampInt(rules.maxRetries, 0, 3, 1);
  rules.pressure = ['off', 'gentle', 'standard'].includes(rules.pressure) ? rules.pressure : 'standard';
  rules.stallSeconds = clampInt(rules.stallSeconds, 0, 3600, 300);
  rules.mode = ['auto', 'express', 'standard', 'grand'].includes(rules.mode) ? rules.mode : 'auto';
  rules.historian = rules.historian !== false;
  rules.historianAgentId = String(rules.historianAgentId || '').trim();
  rules.historianModel = String(rules.historianModel || '').trim().slice(0, 80);
  const money = rules.treasury && typeof rules.treasury === 'object' ? rules.treasury : {};
  rules.treasury = {
    currency: money.currency === 'USD' ? 'USD' : 'CNY',
    rate: Number(money.rate) > 0 ? Number(money.rate) : 7.1,
    budgetPerEdictUsd: Math.max(0, Number(money.budgetPerEdictUsd) || 0),
    monthlyBudgetUsd: Math.max(0, Number(money.monthlyBudgetUsd) || 0),
  };
  rules.prices = rules.prices && typeof rules.prices === 'object' ? rules.prices : {};
  rules.fallbackAgentId = String(rules.fallbackAgentId || '').trim();
  if (rules.fallbackAgentId) {
    const fallback = next.agents.find(agent => agent.id === rules.fallbackAgentId);
    if (!fallback) fail('errFallbackMissing', { id: rules.fallbackAgentId });
    if (fallback.adapter !== 'cli') fail('errFallbackCli');
  }
  return next;
}

function summarizeEdict(edict) {
  const steps = Array.isArray(edict.steps) ? edict.steps : [];
  const g = edict.git || null;
  return {
    id: edict.id,
    brief: edict.brief,
    workspace: edict.workspace,
    locale: edict.locale || 'zh',
    status: edict.status,
    stage: edict.stage,
    haltedAt: edict.haltedAt || '',
    note: edict.note || '',
    createdAt: edict.createdAt,
    updatedAt: edict.updatedAt,
    rounds: edict.rounds,
    autonomous: edict.autonomous === true,
    fixRounds: edict.fixRounds || 0,
    isolationNote: edict.isolationNote || '',
    recalled: Array.isArray(edict.recalled) ? edict.recalled.length : 0,
    mode: edict.mode || 'standard',
    modeReason: edict.modeReason || '',
    expressMinistry: edict.expressMinistry || '',
    chronicleUsed: edict.chronicleUsed || [],
    regime: edict.regime || null,
    permission: edict.permission || '',
    attachments: (edict.attachments || []).map(item => ({ name: item.name, size: item.size })),
    ruledBy: edict.ruledBy || '',
    spend: spendOf(edict),
    git: g ? {
      branch: g.branch, base: g.base, baseCommit: g.baseCommit, merged: !!g.merged, discarded: !!g.discarded,
      empty: !!g.empty, finalized: !!g.finalized, stat: g.stat || null, commitError: g.commitError || '', error: g.error || '',
    } : null,
    steps: steps.map(step => ({
      seq: step.seq, ministry: step.ministry, title: step.title, status: step.status,
      agent: step.agent || '', retried: step.retried === true, after: step.after || [], deliverable: step.deliverable || '',
      workOrder: step.workOrder || '', attempt: step.attempt || 0, impeachments: step.impeachments || [], shirked: step.shirked || '',
      instruction: step.status === 'awaiting-input' ? String(step.instruction || '').slice(0, 1200) : undefined,
    })),
    artifacts: edict.artifacts || [],
    error: edict.error || '',
  };
}

/** 一份奏折的花销：调用数、各类 token、金额（美元）、废料 */
function spendOf(edict) {
  const calls = Array.isArray(edict.calls) ? edict.calls : [];
  const sum = { calls: calls.length, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0, savedUsd: 0, wasteUsd: 0, estimated: false };
  for (const call of calls) {
    sum.input += call.input || 0;
    sum.output += call.output || 0;
    sum.cacheRead += call.cacheRead || 0;
    sum.cacheWrite += call.cacheWrite || 0;
    sum.costUsd += call.costUsd || 0;
    sum.savedUsd += call.savedUsd || 0;
    if (call.outcome && call.outcome !== 'used') sum.wasteUsd += call.costUsd || 0;
    if (call.estimated) sum.estimated = true;
  }
  return sum;
}

// 急递派给哪个部：按圣意里的关键词投票，平局归兵部
const ROUTE_KEYWORDS = {
  war: ['代码', 'bug', '修复', '实现', '重构', '构建', '部署', '编译', '函数', '接口', '脚本', '安装', '升级', '插件', 'code', 'fix', 'implement', 'refactor', 'build', 'deploy', 'function', 'api', 'script', 'crash', 'install', 'upgrade', 'plugin'],
  justice: ['测试', '审查', '合规', '检查', '安全', '漏洞', 'test', 'review', 'lint', 'audit', 'security', 'verify'],
  revenue: ['数据', '表格', '报表', 'csv', 'excel', '统计', '财务', '图表', 'data', 'spreadsheet', 'report', 'sql', 'chart', 'metrics'],
  // 写歌、写诗、写故事这类文字创作归礼部，不该落到写代码的兵部手里
  rites: ['文档', '文案', '周报', '汇报', 'ppt', '邮件', '翻译', 'readme', '说明', '公告', '歌', '诗', '词', '故事', '小说', '文章', '作文', '散文', '剧本', '演讲', '祝福', 'doc', 'docs', 'write', 'email', 'slides', 'translate', 'changelog', 'song', 'poem', 'lyrics', 'story', 'essay', 'article', 'speech'],
  works: ['界面', '设计', '样式', '前端', '页面', '布局', '图标', 'ui', 'css', 'design', 'layout', 'style', 'frontend', 'docker', 'infra'],
  personnel: ['权限', '账号', '配置', '环境变量', '密钥', 'config', 'permission', 'account', 'env', 'settings', 'credentials'],
};
export function routeMinistry(brief) {
  const text = String(brief || '').toLowerCase();
  let best = 'war';
  let bestScore = 0;
  for (const [ministry, words] of Object.entries(ROUTE_KEYWORDS)) {
    const score = words.reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0);
    if (score > bestScore) { best = ministry; bestScore = score; }
  }
  return best;
}

/** 选朝制：你指定的为准；自动时短而单一的走急递，长或多步的走大朝会，其余常朝 */
export function chooseMode(requested, brief, workflow = []) {
  if (['express', 'standard', 'grand'].includes(requested)) return { mode: requested, reason: 'reasonUser' };
  const text = String(brief || '');
  if (workflow.length >= 5 || text.length > 400) return { mode: 'grand', reason: 'reasonLong' };
  const clauses = text.split(/[，,。；;、\n]|并且|然后|同时|以及|再把|\band\b|\bthen\b/i).filter(part => part.trim().length > 1).length;
  if (!workflow.length && text.length <= 80 && clauses <= 2) return { mode: 'express', reason: 'reasonShort' };
  return { mode: 'standard', reason: 'reasonDefault' };
}

const samePath = (a, b) => {
  const x = path.resolve(a);
  const y = path.resolve(b);
  return process.platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y;
};
const overlaps = (a, b) => {
  const x = path.resolve(a) + path.sep;
  const y = path.resolve(b) + path.sep;
  const norm = value => (process.platform === 'win32' ? value.toLowerCase() : value);
  return norm(x).startsWith(norm(y)) || norm(y).startsWith(norm(x));
};

/** 老配置的 DSH 本体（adapter: self，只出待办）换成预设里的 dsh headless 命令行；用户自己改过的不动 */
function migrateDshAgent(store, preset) {
  const fresh = (preset.agents || []).find(agent => agent.id === 'dsh' && agent.adapter === 'cli');
  const index = (store.state.agents || []).findIndex(agent => agent.id === 'dsh');
  if (!fresh || index < 0) return;
  const saved = store.state.agents[index];
  if (saved.adapter !== 'self') return;
  store.state.agents[index] = { ...fresh, enabled: saved.enabled !== false };
  store.save();
}

/**
 * 朝堂本体：状态、流程、隔离、史馆。与 DSH 无关，便于测试。
 * @returns {{ api, runtime, store, annals, dispose }}
 */
export function createCourt(config = {}, { log = console } = {}) {
  const presetPath = new URL('./role-preset.json', import.meta.url);
  const preset = JSON.parse(fs.readFileSync(presetPath, 'utf8'));
  const store = createStore(config.dataDir);
  store.load(preset);
  migrateDshAgent(store, preset);
  if (!store.state.ui || typeof store.state.ui !== 'object') store.state.ui = { skin: 'default', theme: 'default' };
  const annals = createAnnals(store.root);
  const treasury = createTreasury(store.root);
  const wiki = createWiki(store.root);
  const worktreeRoot = path.join(store.root, 'worktrees');
  const controllers = new Map();
  const active = new Set();
  const live = new Map(); // callId → 正在办差的实时状态（只在内存，不落盘）
  const recent = []; // 刚办完的差事，值房里留一会儿
  const pendingFills = new Map(); // `${edictId}:${seq}` → { resolve }
  const rejectNotes = new Map();
  // 皇帝亲手驳回 / 叫停的奏折（还在跑的由流程收尾，收尾后在 afterRun 里记上「亲裁」）
  const ruledByEmperor = new Set();
  let callSeq = 0;
  const uiLocale = () => normalizeLocale(store.state.ui && store.state.ui.locale);
  const findBackground = () => Object.keys(BACKGROUND_TYPES)
    .map(ext => path.join(store.root, `background.${ext}`))
    .find(file => fs.existsSync(file)) || '';
  const removeBackground = () => {
    for (const ext of Object.keys(BACKGROUND_TYPES)) fs.rmSync(path.join(store.root, `background.${ext}`), { force: true });
  };

  /** 记录一份「公文往来」：from / to 是岗位 id（emperor、zhongshu、war、ministries…），界面按语言显示名字 */
  function pushMessage(edict, message) {
    if (!Array.isArray(edict.messages)) edict.messages = [];
    const last = edict.messages[edict.messages.length - 1];
    const entry = {
      // 超过 300 条会裁掉开头，用长度算序号会和已有的重复
      seq: (last ? Number(last.seq) || edict.messages.length : 0) + 1,
      at: Date.now(),
      from: message.from || '',
      to: message.to || '',
      kind: message.kind || 'notice',
      title: message.title || '',
      summary: String(message.summary || '').slice(0, 800),
      agent: message.agent || '',
      model: message.model || '',
      ok: message.ok !== false,
      artifact: message.artifact || '',
      durationMs: Number(message.durationMs) || 0,
    };
    edict.messages.push(entry);
    if (edict.messages.length > 300) edict.messages.splice(0, edict.messages.length - 300);
    store.appendEvent(edict, 'message', { from: entry.from, to: entry.to, kind: entry.kind, title: entry.title, ok: entry.ok });
    store.saveEdict(edict);
    return entry;
  }

  // ---------- 隔离 ----------
  function prepareIsolation(edict, info) {
    const T = (key, vars) => tr(edict.locale, key, vars);
    const rules = store.state.rules || {};
    if (rules.isolation === 'off') { edict.isolationNote = T('gitOff'); return; }
    if (!info) { edict.isolationNote = T('gitNotRepo'); return; }
    if (!info.head) { edict.isolationNote = T('gitNoCommit'); return; }
    try {
      const wt = git.createWorktree(info, edict.id, path.join(worktreeRoot, edict.id));
      edict.git = {
        root: info.root, rel: info.rel, base: info.base, baseCommit: info.head, branch: wt.branch, worktree: wt.worktree,
        dirty: info.dirty, merged: false, discarded: false, finalized: false,
      };
      edict.execDir = wt.execDir;
      edict.isolationNote = T('gitIsolated', { branch: wt.branch, base: info.base || info.head.slice(0, 8) })
        + (info.dirty ? `; ${T('gitDirty')}` : '');
    } catch (error) {
      edict.isolationNote = T('gitFailed', { error: String(error.message || error).slice(0, 300) });
    }
  }

  /** 朝会结束：把 worktree 里的改动提交到分支、出补丁、收掉 worktree（分支留着等批红合并或丢弃） */
  function finalizeGit(edict) {
    const g = edict.git;
    if (!g || g.finalized) return;
    const T = (key, vars) => tr(edict.locale, key, vars);
    try {
      if (fs.existsSync(g.worktree)) {
        const good = edict.status === 'awaiting-approval' || edict.status === 'done';
        const brief = edict.brief.replace(/\s+/g, ' ').slice(0, 60);
        const message = good
          ? T('commitMessage', { id: edict.id, brief })
          : T('snapshotMessage', { id: edict.id, status: edict.status, brief });
        try {
          g.commit = git.commitAll(g.worktree, message);
        } catch (error) {
          // 提交不了（比如仓库的 pre-commit 钩子拦了）：worktree 留着，改动不丢
          g.commitError = T('gitCommitFailed', { error: String(error.message || error).slice(-400) });
          g.finalized = true;
          store.saveEdict(edict);
          return;
        }
      }
      const diff = git.diffSummary(g.root, g.baseCommit, g.branch);
      g.stat = { files: diff.files.slice(0, 300), insertions: diff.insertions, deletions: diff.deletions };
      if (diff.files.length) store.writeArtifact(edict, '07-changes.patch', diff.patch);
      git.removeWorktree(g.root, g.worktree);
      if (!diff.files.length) {
        git.deleteBranch(g.root, g.branch, true);
        g.empty = true;
        edict.isolationNote = `${edict.isolationNote || ''} · ${T('gitNoChanges')}`;
      }
    } catch (error) {
      g.error = String(error.message || error).slice(0, 400);
    }
    g.finalized = true;
    store.saveEdict(edict);
  }

  function mergeEdict(edict) {
    const g = edict.git;
    if (!g || !g.finalized || g.merged || g.discarded || g.empty || !git.branchExists(g.root, g.branch)) fail('errNothingToMerge');
    const message = tr(edict.locale, 'commitMessage', { id: edict.id, brief: edict.brief.replace(/\s+/g, ' ').slice(0, 60) });
    const res = git.mergeBranch(g.root, g.base, g.branch, message);
    if (!res.ok) {
      if (res.reason === 'wrong-branch') fail('gitWrongBranch', { current: res.current, base: g.base });
      if (res.reason === 'detached') fail('gitDetached', { branch: g.branch });
      fail('gitMergeFailed', { error: res.error });
    }
    g.merged = true;
    g.mergeCommit = res.commit;
    git.deleteBranch(g.root, g.branch);
    store.appendEvent(edict, 'merge', { note: tr(edict.locale, 'gitMergedNote', { base: g.base }) });
  }

  function discardEdict(edict) {
    const g = edict.git;
    if (!g || g.merged || g.discarded || g.empty) fail('errNothingToDiscard');
    if (fs.existsSync(g.worktree)) git.removeWorktree(g.root, g.worktree);
    git.deleteBranch(g.root, g.branch, true);
    g.discarded = true;
    g.finalized = true;
    store.appendEvent(edict, 'discard', { note: tr(edict.locale, 'gitDiscarded', { branch: g.branch }) });
  }

  // 上次 DSH 退出时还在办的奏折，流程已经随进程没了；不收尾的话会永远显示「办差中」。隔离分支照常收尾，改动不丢。
  for (const item of store.listEdicts()) {
    if (!ACTIVE_STATUSES.has(item.status)) continue;
    const edict = store.getEdict(item.id);
    if (!edict) continue;
    edict.haltedAt = edict.stage;
    edict.status = 'failed';
    edict.stage = 'failed';
    edict.error = tr(edict.locale, edict.git ? 'noteRestart' : 'noteRestartPlain');
    store.appendEvent(edict, 'fail', { error: edict.error });
    store.saveEdict(edict);
    finalizeGit(edict);
  }

  function setStage(edict, stageId, note) {
    edict.stage = stageId;
    edict.status = (edict.steps || []).some(step => step.status === 'awaiting-input') ? 'awaiting-input' : 'running';
    edict.note = String(note || '');
    store.appendEvent(edict, 'stage', { stage: stageId, note: edict.note });
    store.saveEdict(edict);
  }

  const runtime = {
    store,
    role: roleId => (store.state.roles || {})[roleId] || {},
    state: () => store.state,
    saveEdict: edict => store.saveEdict(edict),
    writeArtifact: (edict, artifactName, text) => store.writeArtifact(edict, artifactName, text),
    emit: (edict, type, data = {}) => {
      store.appendEvent(edict, type, data);
      store.saveEdict(edict);
    },
    setStage,
    signal: edictId => controllers.get(edictId)?.signal,
    message: (edict, message) => pushMessage(edict, message),
    liveState: () => [...live.values()].map(item => ({
      callId: item.callId,
      edictId: item.edictId,
      roleId: item.roleId,
      role: item.role,
      agent: item.agent,
      model: item.model,
      kind: item.kind,
      title: item.title,
      status: item.status,
      startedAt: item.startedAt,
      elapsedMs: Date.now() - item.startedAt,
      tail: (item.tail || '').slice(-1600),
    })),
    /** 人工岗位出了工单后等回填；叫停 / 驳回会让它直接抛出 */
    /** 代办：没命令行的岗位交给谁去办——朝规里的代办人选，没有就是 DSH 本体 */
    deputy() {
      const agents = store.state.agents || [];
      const rules = store.state.rules || {};
      const runnable = agent => agent && agent.enabled !== false && agent.adapter === 'cli';
      const fallback = agents.find(agent => agent.id === rules.fallbackAgentId);
      if (runnable(fallback)) return fallback;
      return agents.find(agent => agent.id === 'dsh' && runnable(agent)) || null;
    },
    waitForFill(edict, step) {
      return new Promise((resolve, reject) => {
        const key = `${edict.id}:${step.seq}`;
        const signal = controllers.get(edict.id)?.signal;
        if (signal && signal.aborted) { reject(new Error('aborted')); return; }
        pendingFills.set(key, { resolve });
        if (signal) {
          signal.addEventListener('abort', () => {
            pendingFills.delete(key);
            reject(new Error('aborted'));
          }, { once: true });
        }
      });
    },
    /**
     * 让某个岗位办一件差事。prompt 可以是字符串，也可以是 ({ substitute }) => string：
     * 丞相模式下岗位上的人办不了（只有图形界面 / 停用 / 空缺）时，转给代办人选，prompt 需要知道这件事。
     * meta: { kind, from, title, summary, parse: 'plan'|'verdict', execute: 是否是动手的差事, quietReport: 回文由流程自己发 }
     */
    async call(edict, roleId, prompt, artifactName, meta = {}) {
      const locale = edict.locale || 'zh';
      const T = (key, vars) => tr(locale, key, vars);
      const role = runtime.role(roleId);
      const assigned = meta.agent || (store.state.agents || []).find(item => item.id === role.agentId) || null;
      const title = roleTitle(locale, roleId);
      const from = meta.from || 'shangshu';
      const rules = store.state.rules || {};
      let agent = assigned;
      let model = String(meta.model !== undefined ? meta.model : role.model || '');
      let substitute = null;

      const canRun = item => item && item.enabled !== false && item.adapter === 'cli';
      if (edict.autonomous && !canRun(assigned)) {
        const fallback = (store.state.agents || []).find(item => item.id === rules.fallbackAgentId);
        if (canRun(fallback)) {
          substitute = { original: assigned ? assigned.name : T('vacant', { role: title }) };
          agent = fallback;
          // 岗位上配的模型是给原来那个工具的，代办人用自己 CLI 的默认模型
          model = '';
        }
      }
      let promptText = typeof prompt === 'function' ? prompt({ substitute }) : prompt;

      if (!agent) {
        pushMessage(edict, { from, to: roleId, kind: meta.kind || 'order', title: meta.title || '', ok: false, summary: T('unbound') });
        store.writeArtifact(edict, artifactName, `# ${title}\n\n${T('unbound')}\n`);
        return { ok: false, output: '', error: T('unboundError', { role: title }) };
      }

      // 锦衣卫管钱袋子：这份奏折花到拨款就停朝，不再开新调用
      const money = rules.treasury || {};
      if (money.budgetPerEdictUsd > 0) {
        const spent = spendOf(edict).costUsd;
        if (spent >= money.budgetPerEdictUsd) {
          const note = T('guardBudget', { spent: `$${spent.toFixed(4)}`, budget: `$${money.budgetPerEdictUsd}` });
          pushMessage(edict, { from: 'jinyiwei', to: 'emperor', kind: 'guard', title: title, ok: false, summary: note });
          const controller = controllers.get(edict.id);
          if (controller && !controller.signal.aborted) controller.abort({ status: 'failed', note, event: 'guard' });
          return { ok: false, output: '', error: note };
        }
      }

      // 续接：同一岗位上一轮的会话还在，就只发增量（省下整段重复提示词，缓存也接得上）
      if (!edict.sessions || typeof edict.sessions !== 'object') edict.sessions = {};
      const sessionKey = meta.sessionKey || '';
      const canResume = Array.isArray(agent.resumeArgs) && agent.resumeArgs.length && !substitute;
      const session = sessionKey && canResume ? edict.sessions[sessionKey] || '' : '';
      if (session && meta.deltaPrompt) promptText = meta.deltaPrompt;

      callSeq += 1;
      const callId = `${edict.id}:${roleId}:${callSeq}`;
      const startedAt = Date.now();
      const state = {
        callId, edictId: edict.id, roleId, role: title, agent: agent.name, agentId: agent.id, model,
        kind: meta.kind || 'order', title: meta.title || '', startedAt, tail: '', status: 'running', seq: meta.seq || 0,
      };
      live.set(callId, state);
      if (!Array.isArray(edict.calls)) edict.calls = [];
      const record = {
        id: callId, roleId, agentId: agent.id, agentName: agent.name, model, kind: meta.kind || 'order', title: meta.title || '',
        seq: meta.seq || 0, startedAt, endedAt: 0, ok: null, resumed: Boolean(session), artifact: artifactName,
        input: 0, output: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0, savedUsd: 0, estimated: false, outcome: 'used',
      };
      edict.calls.push(record);
      pushMessage(edict, {
        from, to: roleId, kind: meta.kind || 'order', title: meta.title || '',
        agent: agent.name, model,
        summary: [
          substitute ? T('substitute', { original: substitute.original, agent: agent.name }) : '',
          session ? T('sessionResumed', { role: title }) : '',
          meta.summary || '',
        ].filter(Boolean).join(' '),
      });

      const permission = permissionOf(edict, rules);
      const writes = meta.execute && permission !== 'read' && Array.isArray(agent.execArgs) ? agent.execArgs : [];
      let result;
      try {
        result = await runAgent(agent, promptText, {
          cwd: edict.execDir || edict.workspace,
          model,
          locale,
          // 「完全权限」与丞相模式都放开 CLI 自己的确认；「仅可查看」什么都不放
          autonomous: permission !== 'read' && (edict.autonomous === true || permission === 'full'),
          extraArgs: writes,
          permission: meta.execute ? permission : 'read',
          session,
          stallMs: (Number(rules.stallSeconds) || 0) * 1000,
          signal: runtime.signal(edict.id),
          onData: chunk => {
            state.tail = (state.tail + chunk).slice(-4000);
            state.updatedAt = Date.now();
          },
        });
      } finally {
        live.delete(callId);
      }
      const durationMs = Date.now() - startedAt;
      recent.unshift({ ...state, endedAt: Date.now(), ok: !!(result && result.ok), status: result && result.ok ? 'done' : 'failed', tail: state.tail.slice(-1200) });
      recent.splice(12);

      // 入账：CLI 自己报的花销为准，没有就按价目表算；人工岗位不花 token
      const usage = result.usage || { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0, estimated: false };
      const prices = { ...DEFAULT_PRICES, ...(rules.prices || {}) };
      const priced = usage.costUsd !== null && usage.costUsd !== undefined ? usage.costUsd : costOf(usage, model || agent.id, prices);
      Object.assign(record, {
        endedAt: Date.now(), ok: !!result.ok, input: usage.input || 0, output: usage.output || 0,
        cacheRead: usage.cacheRead || 0, cacheWrite: usage.cacheWrite || 0, costUsd: result.handedOff ? 0 : priced,
        savedUsd: savedOf(usage, model || agent.id, prices), estimated: !!usage.estimated, stalled: !!result.stalled,
      });
      if (result.sessionId && sessionKey) edict.sessions[sessionKey] = result.sessionId;
      if (!result.handedOff) {
        treasury.record({ ...record, edictId: edict.id, brief: edict.brief.slice(0, 80), at: record.startedAt, durationMs });
      }
      if (result.stalled) {
        pushMessage(edict, { from: 'jinyiwei', to: roleId, kind: 'guard', title: meta.title || '', ok: false, summary: T('guardStall', { role: title, seconds: rules.stallSeconds }) });
      }

      if (result.handedOff) {
        const workOrder = [
          T('workOrderHead', { role: title, agent: `${agent.name}${model ? ` · ${model}` : ''}` }),
          '',
          T('workOrderNote'),
          '',
          T('workOrderTask'),
          promptText,
          '',
          T('workOrderMore'),
          result.note || '',
        ].join('\n');
        const orderName = artifactName.replace(/\.md$/, '-workorder.md');
        store.writeArtifact(edict, orderName, workOrder);
        pushMessage(edict, {
          from: roleId, to: from, kind: 'report', title: meta.title || '',
          summary: edict.autonomous ? T('workOrderAuto') : T('workOrderIssued'), artifact: orderName, ok: true, durationMs,
        });
        return { ...result, output: '', workOrder: orderName, agentName: agent.name, artifact: orderName, durationMs, model, callId };
      }

      store.writeArtifact(
        edict,
        artifactName,
        `# ${title} (${agent.name}${model ? ` · ${model}` : ''})\n\n${result.ok ? (result.output || T('reportEmpty')) : T('reportFailed', { error: result.error || '?' })}\n`,
      );
      const report = readableReport(result.output, { parse: meta.parse, locale });
      if (!meta.quietReport) {
        pushMessage(edict, {
          from: roleId, to: from, kind: 'report', title: meta.title || '',
          ok: result.ok, summary: (result.ok ? report.summary : result.error || '').slice(0, 500),
          artifact: artifactName, durationMs, model,
        });
      }
      return {
        ...result,
        body: report.body,
        handoff: result.ok ? report.handoff : null,
        artifact: artifactName,
        durationMs,
        model,
        callId,
        agentName: substitute ? `${agent.name} (${substitute.original})` : agent.name,
      };
    },
    /** 这个岗位有没有能自动调用的人 */
    canRun(roleId) {
      const role = runtime.role(roleId);
      const agent = (store.state.agents || []).find(item => item.id === role.agentId);
      return Boolean(agent && agent.enabled !== false && agent.adapter === 'cli');
    },
    /** 这次调用最后算不算数：used / vetoed / retried / failed / discarded（国库算废料用） */
    markCall(edict, callId, outcome) {
      const call = (edict.calls || []).find(item => item.id === callId);
      if (call) call.outcome = outcome;
    },
    /** 工作目录（或隔离副本）里此刻改动了哪些文件 */
    changedFiles(edict) {
      const dir = edict.execDir || edict.workspace;
      try {
        return git.statusFiles(edict.git && edict.git.worktree ? edict.git.worktree : dir).slice(0, 80);
      } catch {
        return [];
      }
    },
    /** 史官：调一次便宜的模型把值得长期记住的提炼进实录；再做确定式录入（封驳、弹劾、坑） */
    async chronicle(edict, memorial) {
      const rules = store.state.rules || {};
      let facts = [];
      const historian = (store.state.agents || []).find(item => item.id === (rules.historianAgentId || 'cc'));
      if (rules.historian !== false && historian && historian.enabled !== false && historian.adapter === 'cli') {
        const page = wiki.read(wiki.projectPath(edict.workspace));
        const result = await runtime.call(edict, 'historian', historianPrompt(edict, memorial, page, { locale: edict.locale }), '08-chronicle.md', {
          kind: 'chronicle', from: 'shangshu', agent: historian, model: rules.historianModel || '', quietReport: true,
        });
        const parsed = result.ok ? extractJson(result.output) : null;
        facts = parsed && Array.isArray(parsed.facts)
          ? parsed.facts.filter(item => item && item.text).slice(0, 6).map(item => ({ text: String(item.text), kind: ['facts', 'conventions', 'pitfalls'].includes(item.kind) ? item.kind : 'facts' }))
          : [];
        if (!parsed) runtime.markCall(edict, result.callId, 'failed');
      }
      const done = wiki.ingest(edict, { facts, roleTitle: id => roleTitle(edict.locale, id) });
      edict.chronicled = true;
      pushMessage(edict, {
        from: 'historian', to: 'emperor', kind: 'notice', title: done.project,
        summary: tr(edict.locale, 'historianDone', { n: done.added, page: done.project }),
      });
    },
  };

  /** 朝会收尾：提交隔离分支、结算国库、录实录与史馆、按朝规自动合并 */
  function afterRun(edictId) {
    const edict = store.getEdict(edictId);
    if (!edict) return;
    finalizeGit(edict);
    const rules = store.state.rules || {};
    if (rules.autoMerge && edict.status === 'done' && edict.git && !edict.git.empty && !edict.git.merged) {
      try {
        mergeEdict(edict);
        edict.note = tr(edict.locale, 'noteApprovedMerged', { base: edict.git.base });
      } catch (error) {
        edict.note = `${edict.note} · ${errorText(error, edict.locale)}`;
      }
    }
    if (ACTIVE_STATUSES.has(edict.status)) { store.saveEdict(edict); return; }
    settleRegime(edict);
    if (ruledByEmperor.delete(edict.id)) edict.ruledBy = 'emperor';
    else if (edict.status === 'done' && edict.autonomous) edict.ruledBy = 'regent';
    settleCalls(edict);
    // 没走到上奏的（失败、叫停、停朝）也把封驳与办砸的教训录进实录
    if (!edict.chronicled) wiki.ingest(edict, { roleTitle: id => roleTitle(edict.locale, id) });
    if (edict.status === 'done') wiki.settle(edict.id, 'done');
    store.saveEdict(edict);
    annals.record(edict, { rejectNote: rejectNotes.get(edictId) || '' });
    rejectNotes.delete(edictId);
  }

  /** 当前朝局（按任命）+ 架空指数（再看近来亲裁了多少） */
  /** 这道旨的产出此刻在磁盘上的哪个目录：办理中在隔离 worktree，合并后或没隔离在工作目录；办完还在分支里没合并的返回 '' */
  function diskRoot(edict) {
    const g = edict.git;
    if (g && g.worktree && fs.existsSync(g.worktree)) return edict.execDir || g.worktree;
    if (g && g.finalized && !g.merged && !g.empty && !g.discarded) return '';
    return edict.workspace && fs.existsSync(edict.workspace) ? edict.workspace : '';
  }

  /** 此刻的皇权（按现任官员算的朝局）：同时几份、几个部并行、能不能驳回、能不能亲选朝制 */
  function powerNow() {
    return powerOf(regimeOf(store.state).level, store.state.rules || {});
  }
  /** 同时能办几份奏折：受朝局约束时由朝局定，否则按朝规 */
  function capacityOf(rules) {
    const power = powerNow();
    return power.bound ? power.concurrent : clampInt(rules.maxConcurrent, 1, 4, 2);
  }
  function needReject(locale) {
    if (powerNow().reject) return;
    const level = regimeOf(store.state).level;
    fail('errNoReject', { regime: (REGIME_TEXT[locale] || REGIME_TEXT.zh)[level] });
  }

  function regimeWithPuppet() {
    const regime = regimeOf(store.state);
    const score = puppetIndex(regime, annals.list());
    return { ...regime, puppet: { score, verdict: puppetVerdict(score) }, power: powerOf(regime.level, store.state.rules || {}), powers: POWERS };
  }

  /** 本朝实际：按这份奏折真正调用了哪几家算；比任命时低（有人倒下、由代办接手），告诉皇帝 */
  function settleRegime(edict) {
    const actual = actualRegimeOf(edict.calls || [], store.state.agents || []);
    edict.regime = { ...(edict.regime || {}), actual };
    const appointed = edict.regime.appointed;
    if (actual && appointed && REGIMES.indexOf(actual) < REGIMES.indexOf(appointed)) {
      const names = REGIME_TEXT[normalizeLocale(edict.locale)];
      pushMessage(edict, {
        from: 'shangshu', to: 'emperor', kind: 'notice', title: names[actual],
        summary: tr(edict.locale, 'regimeFell', { from: names[appointed], to: names[actual] }),
      });
    }
  }

  /** 结算：没成的奏折，所有调用都算废料；然后同步到国库账本 */
  function settleCalls(edict) {
    const wasted = ['failed', 'cancelled', 'rejected'].includes(edict.status);
    const outcomes = {};
    for (const call of edict.calls || []) {
      if (wasted && call.outcome === 'used') call.outcome = 'discarded';
      outcomes[call.id] = call.outcome;
    }
    treasury.settle(edict.id, outcomes);
  }

  const api = {
    root: store.root,
    getState() {
      const locale = uiLocale();
      const edicts = store.listEdicts();
      const rules = store.state.rules || {};
      const capacity = capacityOf(rules);
      const workspaces = [];
      for (const item of edicts) {
        if (item.workspace && !workspaces.some(existing => samePath(existing, item.workspace))) workspaces.push(item.workspace);
        if (workspaces.length >= 8) break;
      }
      const now = Date.now();
      return {
        root: store.root,
        locale,
        agents: store.state.agents,
        roles: store.state.roles,
        rules,
        edicts,
        busy: [...active],
        capacity,
        full: active.size >= capacity,
        live: runtime.liveState(),
        recent: recent.filter(item => now - item.endedAt < 10 * 60 * 1000).map(item => ({
          edictId: item.edictId, roleId: item.roleId, role: item.role, agent: item.agent, kind: item.kind, title: item.title,
          ok: item.ok, endedAt: item.endedAt, durationMs: item.endedAt - item.startedAt, tail: item.tail,
        })),
        ui: store.state.ui,
        ministries: ministriesOf(store.state.roles, locale),
        workflow: store.state.workflow || [],
        workflowTemplates: WORKFLOW_TEMPLATES,
        recentWorkspaces: workspaces,
        // 不选工作目录时产出落在这里（每道旨一个子文件夹）；界面会把它登记成 DSH 侧栏里的一个工作区
        outputRoot: outputRoot(),
        annals: { count: annals.list().length, rubberStamp: annals.stats().rubberStamp },
        regime: regimeWithPuppet(),
        // 没命令行的岗位可以交给谁代办（界面上的「交给 DSH 代办」按钮）
        deputy: (() => { const agent = runtime.deputy(); return agent ? { id: agent.id, name: agent.name } : null; })(),
      };
    },
    /** 工作目录候选：DSH 侧栏里的工作区（按 DSH 的顺序）+ 朝堂最近用过的 */
    workspaces() {
      const list = [];
      const push = (dir, title, source) => {
        if (!dir || list.some(item => samePath(item.path, dir))) return;
        list.push({ path: dir, title: title || path.basename(dir) || dir, source });
      };
      for (const item of dshWorkspaces()) push(item.path, item.title, 'dsh');
      for (const item of store.listEdicts()) if (item.workspace) push(item.workspace, '', 'recent');
      return { workspaces: list.slice(0, 40) };
    },
    /** 弹系统的选文件夹对话框（Windows：FolderBrowserDialog；macOS：choose folder），取消返回空 */
    pickFolder(start) {
      return pickFolderDialog(String(start || ''));
    },
    /** 帝王传记：朝局、架空指数、任务雷达、皇帝能力雷达、在位纪年。全部来自已有的账，不调模型 */
    /** 成效：与一个工具单干相比，快了多少、交到你手上前的合格率高了多少（最近 200 份奏折） */
    impact() {
      const edicts = store.listEdicts().slice(0, 200).map(item => store.getEdict(item.id)).filter(Boolean);
      return impactOf(edicts);
    },
    biography() {
      const regime = regimeWithPuppet();
      const entries = annals.list();
      const stats = annals.stats();
      const money = treasury.stats();
      const settled = entries.filter(item => ['done', 'rejected', 'cancelled', 'failed'].includes(item.outcome));
      const decided = settled.filter(item => item.outcome !== 'failed');
      const done = settled.filter(item => item.outcome === 'done').length;
      const monthAgo = Date.now() - 30 * 86400000;
      const recentCount = entries.filter(item => item.at >= monthAgo).length;
      const pct = value => Math.max(0, Math.min(100, Math.round(value)));
      const recuse = regime.suggestions.some(item => item.kind === 'recuse');
      const abilities = {
        // 知人善任：朝局越分权越高；拟旨与封驳出自同一家扣分
        zhiren: pct(regime.rank * 20 - (recuse ? 10 : 0)),
        // 明察：拍板的奏折里，亲自批红 / 驳回 / 叫停的比例
        mingcha: decided.length ? pct(100 * decided.filter(item => item.ruledBy === 'emperor').length / decided.length) : null,
        // 节俭：废料越少、缓存命中越高越好
        jiejian: money.totals.calls ? pct(70 * (1 - money.wasteRate) + 30 * money.cacheHitRate) : null,
        // 圣明：圣意写得清，门下一次就准；给了验收标准加分
        shengming: stats.total ? pct(80 * stats.firstPassRate + 20 * (entries.filter(item => item.criteria).length / entries.length)) : null,
        // 勤政：近 30 天下了几道旨
        qinzheng: pct(recentCount * 8),
        // 治绩：办成的比例
        zhiji: settled.length ? pct(100 * done / settled.length) : null,
      };
      const regimes = {};
      for (const item of entries) if (item.regime) regimes[item.regime] = (regimes[item.regime] || 0) + 1;
      return {
        regime,
        abilities,
        tasks: stats.ministries,
        reign: {
          since: entries.length ? entries[entries.length - 1].at : 0,
          edicts: entries.length,
          done,
          rejected: settled.filter(item => item.outcome === 'rejected').length,
          cancelled: settled.filter(item => item.outcome === 'cancelled').length,
          failed: settled.filter(item => item.outcome === 'failed').length,
          ruled: decided.filter(item => item.ruledBy === 'emperor').length,
          regent: decided.filter(item => item.ruledBy === 'regent').length,
          costUsd: money.totals.costUsd,
          regimes,
        },
      };
    },
    setUi(input = {}) {
      const skins = new Set(['default', 'cinnabar', 'ink']);
      const themes = new Set(['default', 'gong', 'mo', 'zijin', 'marble', 'nox', 'roma']);
      const prev = store.state.ui || {};
      const skin = String(input.skin ?? prev.skin ?? 'default');
      const theme = String(input.theme ?? prev.theme ?? 'default');
      const dim = Number(input.backgroundDim ?? prev.backgroundDim ?? 0.45);
      const wantsCustom = (input.background ?? prev.background) === 'custom';
      const locale = input.locale ?? prev.locale;
      store.state.ui = {
        ...prev,
        skin: skins.has(skin) ? skin : 'default',
        theme: themes.has(theme) ? theme : 'default',
        // 背景压暗程度：图越亮越要压，否则界面文字看不清
        backgroundDim: Number.isFinite(dim) ? Math.max(0.1, Math.min(0.85, dim)) : 0.45,
        background: wantsCustom && findBackground() ? 'custom' : 'palace',
        ...(locale ? { locale: normalizeLocale(locale) } : {}),
      };
      store.save();
      return store.state.ui;
    },
    /** 自定义背景图：前端传 data URL，存进数据目录，GET /background 再读出来 */
    setBackground(dataUrl) {
      const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl || ''));
      if (!match) fail('errImageType');
      const bytes = Buffer.from(match[2], 'base64');
      if (bytes.length > 10 * 1024 * 1024) fail('errImageSize');
      removeBackground();
      fs.writeFileSync(path.join(store.root, `background.${match[1] === 'jpeg' ? 'jpg' : match[1]}`), bytes);
      store.state.ui = { ...(store.state.ui || {}), background: 'custom', backgroundVersion: Date.now() };
      store.save();
      return store.state.ui;
    },
    clearBackground() {
      removeBackground();
      store.state.ui = { ...(store.state.ui || {}), background: 'palace', backgroundVersion: Date.now() };
      store.save();
      return store.state.ui;
    },
    readBackground() {
      const file = findBackground();
      if (!file) fail('errNoBackground');
      return { file, type: BACKGROUND_TYPES[path.extname(file).slice(1)] };
    },
    savePreset(input) {
      const next = sanitizePreset(input || {}, store.state);
      store.state.agents = next.agents;
      store.state.roles = next.roles;
      store.state.rules = next.rules;
      store.save();
      return api.getState();
    },
    saveWorkflow(list) {
      store.state.workflow = cleanWorkflow(list);
      store.save();
      return store.state.workflow;
    },
    probe(agentId) {
      const agent = (store.state.agents || []).find(item => item.id === agentId);
      if (!agent) fail('errNoAgent');
      return probeAgent(agent);
    },
    probeAll() {
      const out = {};
      for (const agent of store.state.agents || []) out[agent.id] = probeAgent(agent);
      return out;
    },
    createEdict(input = {}) {
      const locale = normalizeLocale(input.locale || uiLocale());
      const brief = String(input.brief || '').trim();
      if (!brief) fail('errEmptyBrief');
      if (brief.length > 8000) fail('errBriefTooLong');
      const rules = store.state.rules || {};
      const capacity = capacityOf(rules);
      // 界面会在满额时禁用下旨，但工具 sansheng_edict 和直接调 HTTP 的不会，这里才是真正的闸门
      if (active.size >= capacity) fail('errFull', { n: capacity });
      // 锦衣卫管国库：本月预算用尽就不再开朝
      const money = rules.treasury || {};
      if (money.monthlyBudgetUsd > 0 && treasury.spentThisMonth() >= money.monthlyBudgetUsd) {
        fail('errBudgetMonth', { budget: `$${money.monthlyBudgetUsd}`, spent: `$${treasury.spentThisMonth().toFixed(2)}` });
      }
      const raw = input.workspace && String(input.workspace).trim();
      if (raw) {
        let isDir = false;
        try {
          isDir = fs.statSync(raw).isDirectory();
        } catch {
          isDir = false;
        }
        if (!isDir) fail('errWorkspace', { path: raw });
      }
      // 没选工作目录：在「文档/SanshengLiubu」下给这道旨新建一个文件夹。
      // 以前用的是 DSH 进程自己的目录（~/.dsh/profiles/...），产出混在 DSH 配置里，用户找不到
      const workspace = path.resolve(raw || newOutputFolder());
      let info = null;
      if (rules.isolation !== 'off') {
        try {
          info = git.repoInfo(workspace);
        } catch {
          info = null;
        }
      }
      // 不能隔离的奏折直接改原目录：两份同时改同一处会打架，拒掉
      if (!(info && info.head)) {
        for (const id of active) {
          const other = store.getEdict(id);
          if (other && !other.git && overlaps(other.workspace, workspace)) fail('errSameWorkspace', { id });
        }
      }
      const edict = store.newEdict({ brief, workspace, criteria: input.criteria });
      edict.locale = locale;
      // 权限：与 DSH 输入框一致的三档。不选就按朝规（各部可写文件 → 工作区内修改）
      if (PERMISSIONS.has(input.permission)) edict.permission = input.permission;
      // 附件：存在奏折自己的目录里（不进隔离分支，免得被合并进仓库），路径写进每一道公文
      edict.attachments = saveAttachments(store, edict, input.attachments);
      // 开朝那一刻的朝规定死这份奏折走不走自治，中途改设置不影响已经在办的
      edict.autonomous = rules.autonomous === true;
      // 开朝时的朝局（按任命算），办完再按实际调用算一次
      edict.regime = { appointed: regimeOf(store.state).level };
      // 钦定流程：皇帝在「确定工作流」里排好的部门顺序，中书只能照此拟旨
      edict.workflow = resolveWorkflow(input.workflow, store.state.workflow, locale);
      prepareIsolation(edict, info);
      edict.recalled = rules.useMemory !== false ? annals.recall(brief, workspace) : [];
      // 朝制：急递 / 常朝 / 大朝会（自动时按圣意长短与流程步数挑）
      // 傀儡皇帝选不了朝制，一律由权臣按「自动」定
      const chosen = chooseMode(powerNow().mode ? (input.mode || rules.mode) : 'auto', brief, edict.workflow);
      edict.mode = chosen.mode;
      edict.modeReason = chosen.reason;
      if (edict.mode === 'express') edict.expressMinistry = MINISTRY_SET.has(input.ministry) ? input.ministry : routeMinistry(brief);
      // 实录：这个目录的项目页与相关岗位页，按预算拼进提示词
      if (rules.useMemory !== false) {
        const recalled = wiki.recall(workspace, edict.mode === 'express' ? [edict.expressMinistry] : ['zhongshu', 'menxia']);
        edict.chronicle = recalled.text;
        edict.chronicleUsed = recalled.used;
      }
      store.saveEdict(edict);
      const modeKey = `mode${edict.mode === 'express' ? 'Express' : edict.mode === 'grand' ? 'Grand' : 'Standard'}`;
      pushMessage(edict, { from: 'shangshu', to: 'emperor', kind: 'notice', title: tr(locale, modeKey), summary: tr(locale, 'modeNote', { mode: tr(locale, modeKey), reason: tr(locale, edict.modeReason) }) });
      if (edict.isolationNote) {
        pushMessage(edict, { from: 'shangshu', to: 'emperor', kind: 'notice', title: edict.git ? edict.git.branch : '', summary: edict.isolationNote });
      }
      if (edict.chronicleUsed && edict.chronicleUsed.length) {
        pushMessage(edict, { from: 'historian', to: 'zhongshu', kind: 'notice', title: tr(locale, 'wikiUsed', { n: edict.chronicleUsed.length }), summary: edict.chronicle.slice(0, 800) });
      }
      const controller = new AbortController();
      controllers.set(edict.id, controller);
      active.add(edict.id);
      log.info?.(`[sansheng-liubu] open: ${edict.id}`);
      setImmediate(() => {
        runEdict(runtime, edict.id)
          .catch(error => log.error?.(`[sansheng-liubu] edict crashed: ${error && error.message ? error.message : error}`))
          .finally(() => {
            active.delete(edict.id);
            controllers.delete(edict.id);
            try {
              afterRun(edict.id);
            } catch (error) {
              log.error?.(`[sansheng-liubu] after-run: ${error && error.message ? error.message : error}`);
            }
          });
      });
      return { id: edict.id, status: 'running', isolation: edict.isolationNote || '', mode: edict.mode, modeReason: tr(locale, edict.modeReason), workspace: edict.workspace, newFolder: !raw };
    },
    getEdict(edictId) {
      const edict = store.getEdict(edictId);
      if (!edict) fail('errNoEdict');
      return {
        ...summarizeEdict(edict),
        criteria: edict.criteria || '',
        workflow: edict.workflow || [],
        plan: edict.plan,
        review: edict.review,
        recheck: edict.recheck,
        recalledLessons: edict.recalled || [],
        chronicle: edict.chronicle || '',
        calls: (edict.calls || []).slice(-200),
        // 各部回奏全文：朝堂中栏直接摆出来，不必翻到公文往来里看截断的摘要
        results: (edict.steps || []).filter(step => step.summary).map(step => ({ seq: step.seq, summary: String(step.summary) })),
        messages: edict.messages || [],
        events: edict.events.slice(-200),
        artifacts: store.listArtifacts(edict),
        live: runtime.liveState().filter(item => item.edictId === edictId),
      };
    },
    getArtifact(edictId, artifactName) {
      const edict = store.getEdict(edictId);
      if (!edict) fail('errNoEdict');
      return store.readArtifact(edict, artifactName);
    },
    /** 批红：有隔离分支的先合并，合并失败就不批（原仓库保持原样，奏折仍待批红） */
    approve(edictId) {
      const edict = store.getEdict(edictId);
      if (!edict) fail('errNoEdict');
      if (edict.status !== 'awaiting-approval') fail('errCannotApprove', { status: edict.status });
      const g = edict.git;
      const merge = g && g.finalized && !g.empty && !g.merged && !g.discarded;
      if (merge) mergeEdict(edict);
      edict.status = 'done';
      edict.stage = 'done';
      edict.note = merge ? tr(edict.locale, 'noteApprovedMerged', { base: g.base }) : tr(edict.locale, 'noteApproved');
      edict.ruledBy = 'emperor';
      store.appendEvent(edict, 'approve', {});
      store.saveEdict(edict);
      annals.record(edict);
      wiki.settle(edict.id, 'done');
      return summarizeEdict(edict);
    },
    /** 自治归档后的合并（或者批红时没合并上、处理完冲突再合） */
    merge(edictId) {
      const edict = store.getEdict(edictId);
      if (!edict) fail('errNoEdict');
      if (ACTIVE_STATUSES.has(edict.status)) fail('errStillRunning');
      mergeEdict(edict);
      edict.note = tr(edict.locale, 'noteMerged', { base: edict.git.base });
      store.saveEdict(edict);
      return summarizeEdict(edict);
    },
    discard(edictId) {
      const edict = store.getEdict(edictId);
      if (!edict) fail('errNoEdict');
      needReject(edict.locale);
      if (ACTIVE_STATUSES.has(edict.status)) fail('errStillRunning');
      discardEdict(edict);
      store.saveEdict(edict);
      return summarizeEdict(edict);
    },
    /** 回填人工岗位的结果，或跳过它；delegate = 交给代办（DSH 本体或丞相模式的代办人选）去办 */
    fill(edictId, seq, text, skip = false, delegate = false) {
      const edict = store.getEdict(edictId);
      if (!edict) fail('errNoEdict');
      const key = `${edictId}:${Number(seq)}`;
      const pending = pendingFills.get(key);
      if (!pending) fail('errNotAwaiting');
      if (delegate === true) {
        if (!runtime.deputy()) fail('errNoDeputy');
        pendingFills.delete(key);
        pending.resolve({ delegate: true });
        return { ok: true };
      }
      if (!skip && !String(text || '').trim()) fail('errFillEmpty');
      pendingFills.delete(key);
      pending.resolve({ text: String(text || '').slice(0, 20000), skipped: skip === true });
      return { ok: true };
    },
    reject(edictId, note) {
      const edict = store.getEdict(edictId);
      needReject(edict ? edict.locale : uiLocale());
      const text = String(note || '').trim() || tr(edict ? edict.locale : uiLocale(), 'noteRejected');
      rejectNotes.set(edictId, text);
      return stopEdict(edictId, { status: 'rejected', note: text, event: 'reject' }, ['awaiting-approval']);
    },
    cancel(edictId) {
      const edict = store.getEdict(edictId);
      return stopEdict(edictId, { status: 'cancelled', note: tr(edict ? edict.locale : uiLocale(), 'noteCancelled'), event: 'cancel' }, []);
    },
    annals() {
      return { entries: annals.list(), stats: annals.stats() };
    },
    /** 下旨前估价：会走哪种朝制、大约几次调用、大约多少钱（按历史均价，没有历史用经验值） */
    estimate(input = {}) {
      const rules = store.state.rules || {};
      const locale = normalizeLocale(input.locale || uiLocale());
      const brief = String(input.brief || '');
      const workflow = resolveWorkflow(input.workflow, store.state.workflow, locale);
      const chosen = chooseMode(input.mode || rules.mode, brief, workflow);
      const retries = clampInt(rules.maxRetries, 0, 3, 1);
      const steps = workflow.length || (chosen.mode === 'express' ? 1 : 3);
      const historian = rules.historian !== false ? 1 : 0;
      const calls = chosen.mode === 'express'
        ? [1 + historian, 1 + retries + historian]
        : [2 + steps + 1 + historian, 2 * clampInt(rules.maxReviewRounds, 1, 5, 3) + steps * (1 + retries) * (chosen.mode === 'grand' ? 2 : 1) + 2 + historian];
      const history = treasury.averageCost('order') || treasury.averageCost('draft');
      const avg = history || 0.05;
      return {
        mode: chosen.mode,
        reason: tr(locale, chosen.reason),
        ministry: chosen.mode === 'express' ? (MINISTRY_SET.has(input.ministry) ? input.ministry : routeMinistry(brief)) : '',
        calls,
        usd: calls.map(n => n * avg),
        basis: history ? 'history' : 'default',
      };
    },
    treasury() {
      const rules = store.state.rules || {};
      return { stats: treasury.stats(), settings: rules.treasury || {}, prices: { ...DEFAULT_PRICES, ...(rules.prices || {}) } };
    },
    saveTreasury(input = {}) {
      const state = store.state;
      const prices = {};
      for (const [key, value] of Object.entries(input.prices || {})) {
        if (!value || typeof value !== 'object') continue;
        const nums = ['input', 'cacheRead', 'cacheWrite', 'output'].map(field => Math.max(0, Number(value[field]) || 0));
        prices[String(key).slice(0, 40)] = { input: nums[0], cacheRead: nums[1], cacheWrite: nums[2], output: nums[3] };
      }
      api.savePreset({
        agents: state.agents, roles: state.roles,
        rules: { ...state.rules, treasury: { ...(state.rules.treasury || {}), ...(input.settings || {}) }, prices: input.prices ? prices : state.rules.prices },
      });
      return api.treasury();
    },
    wiki() {
      return { pages: wiki.list(), log: wiki.readLog(80) };
    },
    wikiPage(rel) {
      return { path: rel, text: wiki.read(rel) };
    },
    saveWikiPage(rel, text) {
      wiki.savePage(rel, text);
      return api.wikiPage(rel);
    },
    lintWiki() {
      const rejected = new Set(store.listEdicts().filter(item => item.status === 'rejected').map(item => item.id));
      return { issues: wiki.lintAll(rejected), ...api.wiki() };
    },
    /** 文书房：一份奏折改了哪些文件、各部的产出在不在 */
    files(edictId) {
      const edict = store.getEdict(edictId);
      if (!edict) fail('errNoEdict');
      const g = edict.git;
      const live = Boolean(g && g.worktree && fs.existsSync(g.worktree));
      const onBranch = Boolean(g && !g.empty && !g.discarded && !g.merged && g.finalized && git.branchExists(g.root, g.branch));
      let changed = [];
      try {
        if (live) changed = git.worktreeNumstat(g.worktree, g.baseCommit);
        else if (g && g.stat) changed = g.stat.files;
        else changed = git.statusFiles(edict.workspace).map(item => ({ file: item, add: 0, del: 0 }));
      } catch {
        changed = [];
      }
      // 不是 git 仓库：按修改时间找开朝以后动过的文件
      if (!g && !changed.length) changed = recentFiles(edict.workspace, edict.createdAt || 0);
      changed = changed.map(item => ({ ...item, openable: canOpenFile(item.file) }));
      const exists = rel => {
        try {
          if (live) return fs.existsSync(path.join(edict.execDir || g.worktree, rel));
          if (onBranch) return git.showFile(g.root, g.branch, path.posix.join((g.rel || '').replace(/\\/g, '/'), rel)) !== null;
          return fs.existsSync(path.join(edict.workspace, rel));
        } catch {
          return false;
        }
      };
      const deliverables = [...new Set((edict.steps || []).map(step => deliverablePath(step.deliverable)).filter(Boolean))].slice(0, 30)
        .map(rel => ({ path: rel, exists: exists(rel) }));
      const folder = diskRoot(edict);
      return { source: live ? 'worktree' : onBranch ? 'branch' : 'workspace', changed, deliverables, folder, workspace: edict.workspace };
    },
    /**
     * 在系统里打开这道旨的产出：how = folder（打开文件夹）/ reveal（在文件夹里选中）/ open（用默认程序打开）。
     * 只认这道旨的工作目录（或隔离 worktree）里的相对路径；还在隔离分支里没合并的文件不在磁盘上，打不开。
     */
    open(edictId, rel, how = 'folder') {
      const edict = store.getEdict(edictId);
      if (!edict) fail('errNoEdict');
      const root = diskRoot(edict);
      if (!root) fail('errOnBranch');
      const clean = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '');
      if (clean.split('/').includes('..') || path.isAbsolute(clean)) fail('errNoEdict');
      const target = clean ? path.join(root, clean) : root;
      if (!fs.existsSync(target)) fail('errNoFile', { path: clean || root });
      const mode = how === 'open' && clean && canOpenFile(clean) ? 'open' : clean && how !== 'folder' ? 'reveal' : 'folder';
      openInOs(mode === 'folder' && clean && fs.statSync(target).isFile() ? path.dirname(target) : target, mode);
      return { ok: true, path: target, how: mode };
    },
    file(edictId, rel, diff = false) {
      const edict = store.getEdict(edictId);
      if (!edict) fail('errNoEdict');
      const clean = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '');
      if (!clean || clean.split('/').includes('..') || path.isAbsolute(clean)) fail('errNoEdict');
      const g = edict.git;
      const live = Boolean(g && g.worktree && fs.existsSync(g.worktree));
      const onBranch = Boolean(g && !g.empty && !g.discarded && !g.merged && g.finalized && git.branchExists(g.root, g.branch));
      if (diff && g) {
        const text = live ? git.worktreeDiff(g.worktree, g.baseCommit, clean) : onBranch ? git.diffFile(g.root, g.baseCommit, g.branch, clean) : '';
        return { path: clean, diff: true, text: text || '' };
      }
      let text = null;
      try {
        if (live) {
          const full = path.join(g.worktree, clean);
          text = fs.existsSync(full) && fs.statSync(full).isFile() ? fs.readFileSync(full, 'utf8') : null;
        } else if (onBranch) text = git.showFile(g.root, g.branch, clean);
        else {
          const full = path.join(edict.workspace, clean);
          text = fs.existsSync(full) && fs.statSync(full).isFile() ? fs.readFileSync(full, 'utf8') : null;
        }
      } catch {
        text = null;
      }
      return { path: clean, diff: false, text: text === null ? null : text.slice(0, 200000) };
    },
    removeAnnal(id) {
      if (!annals.remove(id)) fail('errNoAnnal');
      return api.annals();
    },
    clearAnnals() {
      annals.clear();
      return api.annals();
    },
  };

  /**
   * 叫停 / 驳回。还在跑的奏折只 abort，由 runEdict 收尾落盘——直接改磁盘会被流程手里那份 edict 覆盖回去，
   * 而且流程不会停。不在跑的，只允许从 extraStatuses 里的状态转过去。
   */
  function stopEdict(edictId, reason, extraStatuses) {
    const edict = store.getEdict(edictId);
    if (!edict) fail('errNoEdict');
    const controller = controllers.get(edictId);
    if (controller && !controller.signal.aborted) {
      ruledByEmperor.add(edictId);
      controller.abort(reason);
      return { ...summarizeEdict(edict), status: reason.status, stage: reason.status, note: reason.note };
    }
    if (!extraStatuses.includes(edict.status)) {
      const en = normalizeLocale(edict.locale) === 'en';
      const action = reason.event === 'reject' ? (en ? 'reject' : '驳回') : (en ? 'halt' : '叫停');
      fail('errCannotStop', { action, status: edict.status });
    }
    edict.status = reason.status;
    edict.stage = reason.status;
    edict.note = reason.note;
    edict.ruledBy = 'emperor';
    store.appendEvent(edict, reason.event, { note: reason.note });
    store.saveEdict(edict);
    annals.record(edict, { rejectNote: reason.event === 'reject' ? reason.note : '' });
    if (reason.event === 'reject') {
      wiki.ingest(edict, { rejectNote: reason.note, roleTitle: id => roleTitle(edict.locale, id) });
      wiki.settle(edict.id, 'rejected');
    }
    settleCalls(edict);
    store.saveEdict(edict);
    rejectNotes.delete(edictId);
    return summarizeEdict(edict);
  }

  function dispose() {
    for (const controller of controllers.values()) controller.abort();
    controllers.clear();
    active.clear();
  }

  /** 测试用：等到没有奏折在办 */
  async function idle(timeoutMs = 30000) {
    const until = Date.now() + timeoutMs;
    while (active.size) {
      if (Date.now() > until) throw new Error('court still busy');
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }

  return { api, runtime, store, annals, dispose, idle, uiLocale };
}

export function apply(ctx, config = {}) {
  const log = typeof ctx.logger === 'function' ? ctx.logger(name) : console;
  const court = createCourt(config, { log });
  registerHttp(ctx, court);
  registerTools(ctx, court);
  ctx.effect(() => () => court.dispose(), 'sansheng-liubu.lifecycle');
}

function registerHttp(ctx, court) {
  const { api } = court;
  const webServer = ctx.webServer;
  if (!webServer || typeof webServer.register !== 'function') {
    console.warn('[sansheng-liubu] webServer unavailable; the UI cannot read or write state');
    return;
  }
  // register 返回注销函数；放进 effect，插件卸载/重载时路由随之撤掉（dsh-pet 同款写法）
  ctx.effect(() => webServer.register({
    kind: 'prefix',
    path: ROUTE_PREFIX,
    handler: (req, res) => handleRequest(api, req, res, court.uiLocale),
  }));
}

/** 单独导出，测试可以直接喂假的 req / res */
export async function handleRequest(api, req, res, uiLocale = () => 'zh') {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const route = url.pathname.slice(ROUTE_PREFIX.length) || '/';
  const method = (req.method || 'GET').toUpperCase();
  const locale = normalizeLocale((req.headers && req.headers['x-court-locale']) || uiLocale());
  const body = async limit => JSON.parse(await readBody(req, limit) || '{}');
  try {
    const refused = checkRequest(req, method);
    if (refused) return sendJson(res, 403, { error: tr(locale, refused) });
    if (route === '/state' && method === 'GET') return sendJson(res, 200, api.getState());
    if (route === '/ui' && method === 'PUT') return sendJson(res, 200, api.setUi(await body()));
    if (route === '/background' && method === 'GET') {
      const { file, type } = api.readBackground();
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'max-age=31536000' });
      return fs.createReadStream(file).pipe(res);
    }
    // base64 比原图大三分之一，10MB 的图需要放宽请求体上限
    if (route === '/background' && method === 'PUT') return sendJson(res, 200, api.setBackground((await body(16 * 1024 * 1024)).dataUrl));
    if (route === '/background' && method === 'DELETE') return sendJson(res, 200, api.clearBackground());
    if (route === '/preset' && method === 'PUT') return sendJson(res, 200, api.savePreset(await body()));
    if (route === '/workflow' && method === 'PUT') return sendJson(res, 200, { workflow: api.saveWorkflow((await body()).workflow) });
    if (route === '/probe' && method === 'POST') return sendJson(res, 200, api.probe((await body()).agentId));
    if (route === '/probe-all' && method === 'POST') return sendJson(res, 200, api.probeAll());
    // 下旨可带附件（base64），放宽到 25 MB
    if (route === '/edicts' && method === 'POST') return sendJson(res, 200, api.createEdict({ locale, ...(await body(25 * 1024 * 1024)) }));
    if (route === '/annals' && method === 'GET') return sendJson(res, 200, api.annals());
    if (route === '/biography' && method === 'GET') return sendJson(res, 200, api.biography());
    if (route === '/impact' && method === 'GET') return sendJson(res, 200, api.impact());
    if (route === '/workspaces' && method === 'GET') return sendJson(res, 200, api.workspaces());
    if (route === '/pick-folder' && method === 'POST') return sendJson(res, 200, await api.pickFolder((await body()).start));
    if (route === '/estimate' && method === 'POST') return sendJson(res, 200, api.estimate({ locale, ...(await body()) }));
    if (route === '/treasury' && method === 'GET') return sendJson(res, 200, api.treasury());
    if (route === '/treasury' && method === 'PUT') return sendJson(res, 200, api.saveTreasury(await body()));
    if (route === '/wiki' && method === 'GET') return sendJson(res, 200, api.wiki());
    if (route === '/wiki/page' && method === 'GET') return sendJson(res, 200, api.wikiPage(url.searchParams.get('path') || ''));
    if (route === '/wiki/page' && method === 'PUT') { const input = await body(); return sendJson(res, 200, api.saveWikiPage(input.path, input.text)); }
    if (route === '/wiki/lint' && method === 'POST') return sendJson(res, 200, api.lintWiki());
    if (route === '/annals' && method === 'DELETE') return sendJson(res, 200, api.clearAnnals());
    const annal = route.match(/^\/annals\/([A-Za-z0-9-]+)$/);
    if (annal && method === 'DELETE') return sendJson(res, 200, api.removeAnnal(annal[1]));
    const match = route.match(/^\/edicts\/([A-Za-z0-9-]+)(\/[a-z-]+)?$/);
    if (match) {
      const [, edictId, action] = match;
      if (method === 'GET' && !action) return sendJson(res, 200, api.getEdict(edictId));
      if (method === 'POST' && action === '/approve') return sendJson(res, 200, api.approve(edictId));
      if (method === 'GET' && action === '/files') return sendJson(res, 200, api.files(edictId));
      if (method === 'POST' && action === '/open') {
        const input = await body();
        return sendJson(res, 200, api.open(edictId, input.path, input.how));
      }
      if (method === 'GET' && action === '/file') return sendJson(res, 200, api.file(edictId, url.searchParams.get('path'), url.searchParams.get('diff') === '1'));
      if (method === 'POST' && action === '/cancel') return sendJson(res, 200, api.cancel(edictId));
      if (method === 'POST' && action === '/merge') return sendJson(res, 200, api.merge(edictId));
      if (method === 'POST' && action === '/discard') return sendJson(res, 200, api.discard(edictId));
      if (method === 'POST' && action === '/reject') return sendJson(res, 200, api.reject(edictId, (await body()).note));
      if (method === 'POST' && action === '/fill') {
        const input = await body();
        return sendJson(res, 200, api.fill(edictId, input.seq, input.text, input.skip === true, input.delegate === true));
      }
    }
    if (route === '/artifact' && method === 'GET') {
      const edictId = url.searchParams.get('id') || '';
      const artifactName = url.searchParams.get('name') || '';
      return sendJson(res, 200, { name: artifactName, text: api.getArtifact(edictId, artifactName) });
    }
    return sendJson(res, 404, { error: tr(locale, 'errEndpoint', { method, route }) });
  } catch (error) {
    return sendJson(res, 400, { error: errorText(error, locale) });
  }
}

function registerTools(ctx, court) {
  const { api } = court;
  const tools = ctx.tools;
  if (!tools || typeof tools.register !== 'function') {
    console.warn('[sansheng-liubu] tools service unavailable; the model cannot issue edicts');
    return;
  }
  const L = () => court.uiLocale();
  const say = (zh, en) => (L() === 'en' ? en : zh);
  const run = fn => async (args = {}) => {
    try {
      return await fn(args);
    } catch (error) {
      throw new Error(errorText(error, L()));
    }
  };

  const textOutput = {
    schema: { type: 'string' },
    render: (_args, value) => [{ type: 'text', text: String(value ?? '') }],
  };

  // parameters 用 DSH 自己的参数表写法：{ 参数名: { type, required, description } }（与 dsh-openwrite 一致），
  // 不是 JSON Schema。单个工具注册失败不应该拖垮整个插件，所以逐个兜底。
  const safeRegister = definition => {
    try {
      tools.register(defineTool({ output: textOutput, ...definition, execute: run(definition.execute) }));
    } catch (error) {
      console.warn(`[sansheng-liubu] tool registration failed (${definition.name}): ${error && error.message ? error.message : error}`);
    }
  };

  safeRegister({
    name: 'sansheng_edict',
    description: 'Imperial Court / 三省六部: issue an edict. Hands a cross-tool task to the court (draft → review/veto → dispatch to six ministries, in parallel where possible → audit → report). Runs in the background in an isolated git branch when the folder is a repo, and returns the edict id at once; follow it with sansheng_status.',
    parameters: {
      brief: { type: 'string', required: true, description: 'The full task: goal, scope, expected result / 圣意' },
      workspace: { type: 'string', description: 'Absolute path of the working folder; defaults to the DSH working folder' },
      criteria: { type: 'string', description: 'Optional acceptance criteria / 验收标准' },
      workflow: { type: 'string', description: 'Optional fixed procedure: "default" (the saved one), "none", a template (video / dev / report), or ministry ids like "war,justice"' },
    },
    async execute(args) {
      const result = api.createEdict({ ...args, locale: L() });
      return say(
        `已开朝，奏折编号 ${result.id}。${result.isolation ? `\n${result.isolation}` : ''}\n用 sansheng_status 传入该编号查看进度。`,
        `The Senate is in session. Decree ${result.id}.${result.isolation ? `\n${result.isolation}` : ''}\nFollow it with sansheng_status.`,
      );
    },
  });

  safeRegister({
    name: 'sansheng_status',
    description: 'Imperial Court / 三省六部: show an edict\'s progress, or list recent edicts when no id is given.',
    parameters: { id: { type: 'string', description: 'Edict id; omit to list the 10 most recent' } },
    async execute(args) {
      if (!args.id) {
        const list = api.getState().edicts.slice(0, 10);
        if (!list.length) return say('朝堂还没有奏折。用 sansheng_edict 下旨。', 'No decrees yet. Issue one with sansheng_edict.');
        return list.map(item => `- ${item.id} [${item.status}] ${String(item.brief || '').slice(0, 60)}`).join('\n');
      }
      const detail = api.getEdict(String(args.id));
      const locale = detail.locale;
      const lines = [
        `${detail.id} [${detail.status}]${detail.note ? ` ${detail.note}` : ''}`,
        `${say('圣意', 'Brief')}: ${detail.brief}`,
        `${say('阶段', 'Stage')}: ${detail.stage} · ${say('拟旨轮数', 'draft rounds')} ${detail.rounds}`,
      ];
      if (detail.isolationNote) lines.push(detail.isolationNote);
      detail.steps.forEach(step => lines.push(`- #${step.seq} ${roleTitle(locale, step.ministry)} | ${step.title} | ${step.status}${step.after.length ? ` (after ${step.after.join(',')})` : ''}`));
      const waiting = detail.steps.filter(step => step.status === 'awaiting-input');
      if (waiting.length) lines.push(say(`待回填：${waiting.map(step => `#${step.seq}`).join('、')}，用 sansheng_fill 填写结果。`, `Awaiting input: ${waiting.map(step => `#${step.seq}`).join(', ')}. Fill in with sansheng_fill.`));
      detail.messages.slice(-6).forEach(item => lines.push(`  ${roleTitle(locale, item.from)} → ${roleTitle(locale, item.to)} [${item.kind}] ${String(item.summary || '').slice(0, 80)}`));
      if (detail.git && detail.git.stat) lines.push(`git: ${detail.git.branch} +${detail.git.stat.insertions} -${detail.git.stat.deletions} (${detail.git.stat.files.length} files)${detail.git.merged ? ' merged' : ''}`);
      if (detail.status === 'awaiting-approval') lines.push(say('已上奏，可批红：sansheng_approve（有分支时一并合并）。', 'Report delivered. Seal it with sansheng_approve (merges its branch, if any).'));
      if (detail.error) lines.push(`${say('失败原因', 'Error')}: ${detail.error}`);
      return lines.join('\n').slice(0, 12000);
    },
  });

  safeRegister({
    name: 'sansheng_approve',
    description: 'Imperial Court / 三省六部: approve (seal) a reported edict and archive it, merging its isolated branch into the original branch.',
    parameters: { id: { type: 'string', required: true, description: 'Edict id' } },
    async execute(args) {
      const result = api.approve(String(args.id || ''));
      return `${result.id}: ${result.note}`;
    },
  });

  safeRegister({
    name: 'sansheng_reject',
    description: 'Imperial Court / 三省六部: reject a reported edict (or halt a running one) with a reason. The reason is remembered as a lesson for future edicts.',
    parameters: {
      id: { type: 'string', required: true, description: 'Edict id' },
      note: { type: 'string', description: 'Why it is rejected' },
    },
    async execute(args) {
      const result = api.reject(String(args.id || ''), args.note);
      return `${result.id}: ${result.status} · ${result.note}`;
    },
  });

  safeRegister({
    name: 'sansheng_fill',
    description: 'Imperial Court / 三省六部: fill in the result of an order that is waiting for input (a GUI-only or DSH-itself office), or skip it. The session then carries on.',
    parameters: {
      id: { type: 'string', required: true, description: 'Edict id' },
      seq: { type: 'number', required: true, description: 'Order number (#) shown by sansheng_status' },
      text: { type: 'string', description: 'The result: what was done and where the output is' },
      skip: { type: 'boolean', description: 'true to skip this order instead' },
      delegate: { type: 'boolean', description: 'true to hand this order to the deputy (DSH itself by default) instead of filling it in' },
    },
    async execute(args) {
      api.fill(String(args.id || ''), Number(args.seq), args.text, args.skip === true, args.delegate === true);
      return say('已回填，朝会继续。', 'Filled in; the session continues.');
    },
  });

  safeRegister({
    name: 'sansheng_assign',
    description: 'Imperial Court / 三省六部: appoint an agent to an office (one of the three departments or six ministries), optionally with a model for that office. Takes effect at once.',
    parameters: {
      role: { type: 'string', required: true, description: `Office id: ${ROLE_IDS.join(' / ')}` },
      agentId: { type: 'string', required: true, description: 'Agent id from the roster' },
      model: { type: 'string', description: 'Optional model for this office (e.g. opus / gpt-5-codex / auto); empty = the CLI default' },
    },
    async execute(args) {
      const state = api.getState();
      const roles = { ...state.roles };
      if (!roles[args.role]) fail('errNoRole', { role: args.role });
      if (!state.agents.some(agent => agent.id === args.agentId)) fail('errNoAgent');
      roles[args.role] = {
        ...roles[args.role],
        agentId: args.agentId,
        ...(args.model !== undefined ? { model: String(args.model || '') } : {}),
      };
      api.savePreset({ agents: state.agents, roles, rules: state.rules });
      return `${roleTitle(L(), args.role)} ← ${args.agentId}${args.model ? ` (${args.model})` : ''}`;
    },
  });
}
