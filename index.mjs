// 三省六部 · DSH 插件宿主半入口
// 职责：管群臣（本机各 AI 工具）→ 排官职（三省六部）→ 接奏折（任务）→ 跑朝堂流程 → 上奏待批红。
// 浏览器半（client.js）通过 /sansheng-liubu/* 这组 HTTP 端点读写状态。
import fs from 'node:fs';
import path from 'node:path';
import { createStore } from './lib/store.mjs';
import { runAgent, probeAgent } from './lib/adapters.mjs';
import { runEdict } from './lib/court.mjs';
import { ministriesOf, MINISTRIES } from './lib/prompts.mjs';

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
const MINISTRY_IDS = new Set(MINISTRIES.map(item => item.id));

function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('请求体过大'));
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

function sanitizePreset(input, current) {
  const next = {
    agents: Array.isArray(input.agents) ? input.agents : current.agents,
    roles: input.roles && typeof input.roles === 'object' ? input.roles : current.roles,
    rules: { ...current.rules, ...(input.rules || {}) },
  };
  const allowedAdapters = new Set(['cli', 'self', 'manual']);
  const seen = new Set();
  next.agents = next.agents.map(raw => {
    const agent = {
      id: String(raw.id || '').trim(),
      name: String(raw.name || raw.id || '').trim(),
      adapter: allowedAdapters.has(raw.adapter) ? raw.adapter : 'cli',
      enabled: raw.enabled !== false,
      traits: Array.isArray(raw.traits) ? raw.traits.map(String) : [],
      command: String(raw.command || '').trim(),
      args: Array.isArray(raw.args) ? raw.args.map(String) : [],
      modelArgs: Array.isArray(raw.modelArgs) ? raw.modelArgs.map(String) : [],
      // 自治模式下追加的参数：放开 CLI 自己的权限确认（如 claude --permission-mode acceptEdits、codex --full-auto）
      autoArgs: Array.isArray(raw.autoArgs) ? raw.autoArgs.map(String) : [],
      models: Array.isArray(raw.models) ? raw.models.map(String).filter(Boolean) : [],
      promptMode: raw.promptMode === 'arg' ? 'arg' : 'stdin',
      timeoutMs: Math.max(10_000, Number(raw.timeoutMs) || 600_000),
      env: raw.env && typeof raw.env === 'object' ? raw.env : {},
    };
    if (!/^[a-z0-9-]{2,32}$/.test(agent.id)) throw new Error(`agent id 不合法：${agent.id}`);
    if (seen.has(agent.id)) throw new Error(`agent id 重复：${agent.id}`);
    seen.add(agent.id);
    if (agent.adapter === 'cli' && !agent.command) throw new Error(`${agent.name} 是 cli 适配器但没有 command`);
    return agent;
  });
  const agentIds = new Set(next.agents.map(agent => agent.id));
  for (const [roleId, role] of Object.entries(next.roles)) {
    if (!role || typeof role !== 'object') throw new Error(`官职 ${roleId} 配置不合法`);
    if (role.agentId && !agentIds.has(role.agentId)) throw new Error(`官职 ${roleId} 指向不存在的 agent：${role.agentId}`);
    // 每个岗位可以单独指定模型；留空 = 用该 CLI 的默认模型
    role.model = String(role.model || '').trim().slice(0, 80);
    // 职掌会写进拟旨 prompt，中书按它派活；界面上可改（如套用「短视频」官制）
    role.duty = String(role.duty || '').trim().slice(0, 200);
  }
  if (next.rules.separationOfPowers !== false && next.roles.zhongshu && next.roles.menxia
    && next.roles.zhongshu.agentId && next.roles.zhongshu.agentId === next.roles.menxia.agentId) {
    throw new Error('中书省与门下省不能由同一个 agent 担任（同源互审等于没审）');
  }
  next.rules.maxReviewRounds = Math.max(1, Math.min(5, Number(next.rules.maxReviewRounds) || 3));
  next.rules.maxSteps = Math.max(1, Math.min(12, Number(next.rules.maxSteps) || 8));
  next.rules.autonomous = next.rules.autonomous === true;
  const fixRounds = Number(next.rules.maxFixRounds);
  next.rules.maxFixRounds = Number.isFinite(fixRounds) ? Math.max(0, Math.min(3, Math.round(fixRounds))) : 2;
  next.rules.fallbackAgentId = String(next.rules.fallbackAgentId || '').trim();
  if (next.rules.fallbackAgentId) {
    const fallback = next.agents.find(agent => agent.id === next.rules.fallbackAgentId);
    if (!fallback) throw new Error(`代办人选不存在：${next.rules.fallbackAgentId}`);
    if (fallback.adapter !== 'cli') throw new Error('代办人选必须是命令行（cli）agent，否则代办不了');
  }
  return next;
}

function summarizeEdict(edict) {
  const steps = Array.isArray(edict.steps) ? edict.steps : [];
  return {
    id: edict.id,
    brief: edict.brief,
    status: edict.status,
    stage: edict.stage,
    haltedAt: edict.haltedAt || '',
    note: edict.note || '',
    createdAt: edict.createdAt,
    updatedAt: edict.updatedAt,
    rounds: edict.rounds,
    autonomous: edict.autonomous === true,
    fixRounds: edict.fixRounds || 0,
    steps: steps.map(step => ({
      seq: step.seq, ministry: step.ministry, title: step.title, status: step.status,
      agent: step.agent || '', retried: step.retried === true,
    })),
    artifacts: edict.artifacts || [],
    error: edict.error || '',
  };
}

export function apply(ctx, config = {}) {
  const presetPath = new URL('./role-preset.json', import.meta.url);
  const preset = JSON.parse(fs.readFileSync(presetPath, 'utf8'));
  const store = createStore(config.dataDir);
  store.load(preset);
  if (!store.state.ui || typeof store.state.ui !== 'object') store.state.ui = { skin: 'default', theme: 'default' };
  const log = typeof ctx.logger === 'function' ? ctx.logger(name) : console;
  const controllers = new Map();
  const active = new Set();
  const live = new Map(); // `${edictId}:${roleId}` → 正在办差的实时状态（只在内存，不落盘）
  const findBackground = () => Object.keys(BACKGROUND_TYPES)
    .map(ext => path.join(store.root, `background.${ext}`))
    .find(file => fs.existsSync(file)) || '';
  const removeBackground = () => {
    for (const ext of Object.keys(BACKGROUND_TYPES)) fs.rmSync(path.join(store.root, `background.${ext}`), { force: true });
  };

  // 上次 DSH 退出时还在办的奏折，流程已经随进程没了；不收尾的话会永远显示「办差中」
  for (const item of store.listEdicts()) {
    if (item.status !== 'running' && item.status !== 'queued') continue;
    const edict = store.getEdict(item.id);
    if (!edict) continue;
    edict.status = 'failed';
    edict.stage = 'failed';
    edict.error = '插件重启，朝会中断';
    store.appendEvent(edict, '失败', { error: edict.error });
    store.saveEdict(edict);
  }

  /** 记录一份「公文往来」：谁发给谁、什么性质、摘要、模型、产物、耗时 */
  function pushMessage(edict, message) {
    if (!Array.isArray(edict.messages)) edict.messages = [];
    const last = edict.messages[edict.messages.length - 1];
    const entry = {
      // 超过 300 条会裁掉开头，用长度算序号会和已有的重复
      seq: (last ? Number(last.seq) || edict.messages.length : 0) + 1,
      at: Date.now(),
      from: message.from || '',
      to: message.to || '',
      kind: message.kind || '文书',
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
    store.appendEvent(edict, '公文', { from: entry.from, to: entry.to, kind: entry.kind, title: entry.title, ok: entry.ok });
    store.saveEdict(edict);
    return entry;
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
    setStage: (edict, stageId, note) => {
      edict.stage = stageId;
      edict.status = 'running';
      edict.note = String(note || '');
      store.appendEvent(edict, '阶段', { stage: stageId, note: edict.note });
      store.saveEdict(edict);
    },
    signal: edictId => controllers.get(edictId)?.signal,
    message: (edict, message) => pushMessage(edict, message),
    liveState: () => [...live.values()].map(item => ({
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
    /**
     * 让某个岗位办一件差事。prompt 可以是字符串，也可以是 ({ substitute }) => string：
     * 自治模式下岗位上的人办不了（只有图形界面 / 停用 / 空缺）时，转给代办人选，prompt 需要知道这件事。
     */
    async call(edict, roleId, prompt, artifactName, meta = {}) {
      const role = runtime.role(roleId);
      const assigned = (store.state.agents || []).find(item => item.id === role.agentId) || null;
      const title = role.title || roleId;
      const from = meta.from || '尚书省';
      let agent = assigned;
      let model = String(role.model || '');
      let substitute = null;

      const canRun = item => item && item.enabled !== false && item.adapter === 'cli';
      if (edict.autonomous && !canRun(assigned)) {
        const rules = store.state.rules || {};
        const fallback = (store.state.agents || []).find(item => item.id === rules.fallbackAgentId);
        if (canRun(fallback)) {
          substitute = { original: assigned ? assigned.name : `${title}（空缺）` };
          agent = fallback;
          // 岗位上配的模型是给原来那个工具的，代办人用自己 CLI 的默认模型
          model = '';
        }
      }
      const promptText = typeof prompt === 'function' ? prompt({ substitute }) : prompt;

      if (!agent) {
        pushMessage(edict, { from, to: title, kind: meta.kind || '差事', title: meta.title || '', ok: false, summary: '未绑定 agent，无法办差' });
        store.writeArtifact(edict, artifactName, `# ${title}\n\n未绑定 agent，无法办差。\n`);
        return { ok: false, output: '', error: `${title} 未绑定 agent` };
      }

      const key = `${edict.id}:${roleId}`;
      const startedAt = Date.now();
      const state = {
        edictId: edict.id, roleId, role: title, agent: agent.name, agentId: agent.id, model,
        kind: meta.kind || '差事', title: meta.title || '', startedAt, tail: '', status: 'running',
      };
      live.set(key, state);
      pushMessage(edict, {
        from, to: title, kind: meta.kind || '差事', title: meta.title || '',
        agent: agent.name, model,
        summary: substitute ? `${substitute.original} 没有命令行，由 ${agent.name} 代办。${meta.summary || ''}` : (meta.summary || ''),
      });

      let result;
      try {
        result = await runAgent(agent, promptText, {
          cwd: edict.workspace,
          model,
          autonomous: edict.autonomous === true,
          signal: runtime.signal(edict.id),
          onData: chunk => {
            state.tail = (state.tail + chunk).slice(-4000);
            state.updatedAt = Date.now();
          },
        });
      } finally {
        live.delete(key);
      }
      const durationMs = Date.now() - startedAt;

      if (result.handedOff) {
        const workOrder = [
          `# ${title} · 工单（${agent.name}${model ? ` · ${model}` : ''}）`,
          '',
          '> 这个工具没有可自动调用的命令行，已生成工单，请人工完成后把结果回填到奏折。',
          '',
          '## 任务',
          promptText,
          '',
          '## 说明',
          result.note || '',
        ].join('\n');
        const orderName = artifactName.replace(/\.md$/, '-工单.md');
        store.writeArtifact(edict, orderName, workOrder);
        pushMessage(edict, {
          from: title, to: from, kind: '回文', title: meta.title || '',
          summary: '已出工单，待人工或本体处理', artifact: orderName, ok: true, durationMs,
        });
        return { ...result, output: '', agentName: agent.name };
      }

      if (!result.ok) {
        store.writeArtifact(edict, artifactName, `# ${title}（${agent.name}${model ? ` · ${model}` : ''}）\n\n执行失败：${result.error || '未知错误'}\n`);
      } else {
        store.writeArtifact(edict, artifactName, `# ${title}（${agent.name}${model ? ` · ${model}` : ''}）\n\n${result.output || '（无输出）'}\n`);
      }
      pushMessage(edict, {
        from: title, to: from, kind: '回文', title: meta.title || '',
        ok: result.ok, summary: (result.output || result.error || '').slice(0, 500),
        artifact: artifactName, durationMs,
      });
      return { ...result, agentName: substitute ? `${agent.name}（代 ${substitute.original}）` : agent.name };
    },
  };

  const api = {
    root: store.root,
    getState() {
      return {
        root: store.root,
        agents: store.state.agents,
        roles: store.state.roles,
        rules: store.state.rules,
        edicts: store.listEdicts(),
        busy: [...active],
        live: runtime.liveState(),
        ui: store.state.ui,
        ministries: ministriesOf(store.state.roles),
      };
    },
    setUi(input = {}) {
      const skins = new Set(['default', 'cinnabar', 'ink']);
      const themes = new Set(['default', 'gong', 'mo', 'zijin']);
      const prev = store.state.ui || {};
      const skin = String(input.skin ?? prev.skin ?? 'default');
      const theme = String(input.theme ?? prev.theme ?? 'default');
      const dim = Number(input.backgroundDim ?? prev.backgroundDim ?? 0.45);
      const wantsCustom = (input.background ?? prev.background) === 'custom';
      store.state.ui = {
        ...prev,
        skin: skins.has(skin) ? skin : 'default',
        theme: themes.has(theme) ? theme : 'default',
        // 背景压暗程度：图越亮越要压，否则界面文字看不清
        backgroundDim: Number.isFinite(dim) ? Math.max(0.1, Math.min(0.85, dim)) : 0.45,
        background: wantsCustom && findBackground() ? 'custom' : 'palace',
      };
      store.save();
      return store.state.ui;
    },
    /** 自定义背景图：前端传 data URL，存进数据目录，GET /background 再读出来 */
    setBackground(dataUrl) {
      const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl || ''));
      if (!match) throw new Error('只支持 png / jpg / webp / gif 图片');
      const bytes = Buffer.from(match[2], 'base64');
      if (bytes.length > 10 * 1024 * 1024) throw new Error('图片太大了（上限 10MB）');
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
      if (!file) throw new Error('没有自定义背景');
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
    probe(agentId) {
      const agent = (store.state.agents || []).find(item => item.id === agentId);
      if (!agent) throw new Error('没有这个 agent');
      return probeAgent(agent);
    },
    createEdict(input) {
      const brief = String(input && input.brief ? input.brief : '').trim();
      if (!brief) throw new Error('圣意不能为空');
      if (brief.length > 8000) throw new Error('圣意太长了（上限 8000 字）');
      // 界面会在忙时禁用下旨，但工具 sansheng_edict 和直接调 HTTP 的不会，这里才是真正的串行闸门
      if (active.size) throw new Error(`朝堂正在办差（${[...active][0]}），同一时间只受理一份奏折`);
      const workspace = input.workspace && String(input.workspace).trim();
      if (workspace) {
        let isDir = false;
        try {
          isDir = fs.statSync(workspace).isDirectory();
        } catch {
          isDir = false;
        }
        if (!isDir) throw new Error(`工作目录不存在：${workspace}`);
      }
      const edict = store.newEdict({ brief, workspace: input.workspace, criteria: input.criteria });
      // 开朝那一刻的朝规定死这份奏折走不走自治，中途改设置不影响已经在办的
      edict.autonomous = (store.state.rules || {}).autonomous === true;
      // 钦定流程：皇帝在「确定工作流」里排好的部门顺序，中书只能照此拟旨
      edict.workflow = (Array.isArray(input.workflow) ? input.workflow : [])
        .map(item => ({
          ministry: String((item && item.ministry) || '').trim(),
          title: String((item && item.title) || '').trim().slice(0, 80),
        }))
        .filter(item => MINISTRY_IDS.has(item.ministry))
        .slice(0, 12);
      store.saveEdict(edict);
      const controller = new AbortController();
      controllers.set(edict.id, controller);
      active.add(edict.id);
      log.info?.(`[三省六部] 开朝：${edict.id}`);
      setImmediate(() => {
        runEdict(runtime, edict.id)
          .catch(error => log.error?.(`[三省六部] 朝会异常：${error && error.message ? error.message : error}`))
          .finally(() => {
            active.delete(edict.id);
            controllers.delete(edict.id);
          });
      });
      return { id: edict.id, status: 'running' };
    },
    getEdict(edictId) {
      const edict = store.getEdict(edictId);
      if (!edict) throw new Error('奏折不存在');
      return {
        ...summarizeEdict(edict),
        plan: edict.plan,
        review: edict.review,
        recheck: edict.recheck,
        messages: edict.messages || [],
        events: edict.events.slice(-200),
        artifacts: store.listArtifacts(edict),
        live: runtime.liveState().filter(item => item.edictId === edictId),
      };
    },
    getArtifact(edictId, artifactName) {
      const edict = store.getEdict(edictId);
      if (!edict) throw new Error('奏折不存在');
      return store.readArtifact(edict, artifactName);
    },
    approve(edictId) {
      const edict = store.getEdict(edictId);
      if (!edict) throw new Error('奏折不存在');
      if (edict.status !== 'awaiting-approval') throw new Error(`当前状态不能批红：${edict.status}`);
      edict.status = 'done';
      edict.stage = 'done';
      edict.note = '已批红归档';
      store.appendEvent(edict, '批红', {});
      store.saveEdict(edict);
      return summarizeEdict(edict);
    },
    reject(edictId, note) {
      const text = String(note || '驳回，未说明理由');
      return stopEdict(edictId, { status: 'rejected', note: text, event: '驳回' }, ['awaiting-approval']);
    },
    cancel(edictId) {
      return stopEdict(edictId, { status: 'cancelled', note: '皇帝叫停', event: '叫停' }, []);
    },
  };

  /**
   * 叫停 / 驳回。还在跑的奏折只 abort，由 runEdict 收尾落盘——直接改磁盘会被流程手里那份 edict 覆盖回去，
   * 而且流程不会停。不在跑的，只允许从 extraStatuses 里的状态转过去。
   */
  function stopEdict(edictId, reason, extraStatuses) {
    const edict = store.getEdict(edictId);
    if (!edict) throw new Error('奏折不存在');
    const controller = controllers.get(edictId);
    if (controller && !controller.signal.aborted) {
      controller.abort(reason);
      return { ...summarizeEdict(edict), status: reason.status, stage: reason.status, note: reason.note };
    }
    if (!extraStatuses.includes(edict.status)) throw new Error(`当前状态不能${reason.event}：${edict.status}`);
    edict.status = reason.status;
    edict.stage = reason.status;
    edict.note = reason.note;
    store.appendEvent(edict, reason.event, { note: reason.note });
    store.saveEdict(edict);
    return summarizeEdict(edict);
  }

  registerHttp(ctx, api);
  registerTools(ctx, api);

  ctx.effect(() => {
    return () => {
      for (const controller of controllers.values()) controller.abort();
      controllers.clear();
      active.clear();
    };
  }, 'sansheng-liubu.lifecycle');
}

function registerHttp(ctx, api) {
  const webServer = ctx.webServer;
  if (!webServer || typeof webServer.register !== 'function') {
    console.warn('[三省六部] webServer 服务不可用，前端页面将无法读写状态');
    return;
  }
  // register 返回注销函数；放进 effect，插件卸载/重载时路由随之撤掉（dsh-pet 同款写法）
  ctx.effect(() => webServer.register({
    kind: 'prefix',
    path: ROUTE_PREFIX,
    handler: async (req, res) => {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      const route = url.pathname.slice(ROUTE_PREFIX.length) || '/';
      const method = (req.method || 'GET').toUpperCase();
      try {
        if (route === '/state' && method === 'GET') return sendJson(res, 200, api.getState());
        if (route === '/ui' && method === 'PUT') {
          const body = JSON.parse(await readBody(req) || '{}');
          return sendJson(res, 200, api.setUi(body));
        }
        if (route === '/background' && method === 'GET') {
          const { file, type } = api.readBackground();
          res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'max-age=31536000' });
          return fs.createReadStream(file).pipe(res);
        }
        if (route === '/background' && method === 'PUT') {
          // base64 比原图大三分之一，10MB 的图需要放宽请求体上限
          const body = JSON.parse(await readBody(req, 16 * 1024 * 1024) || '{}');
          return sendJson(res, 200, api.setBackground(body.dataUrl));
        }
        if (route === '/background' && method === 'DELETE') return sendJson(res, 200, api.clearBackground());
        if (route === '/preset' && method === 'PUT') {
          const body = JSON.parse(await readBody(req) || '{}');
          return sendJson(res, 200, api.savePreset(body));
        }
        if (route === '/probe' && method === 'POST') {
          const body = JSON.parse(await readBody(req) || '{}');
          return sendJson(res, 200, api.probe(body.agentId));
        }
        if (route === '/edicts' && method === 'POST') {
          const body = JSON.parse(await readBody(req) || '{}');
          return sendJson(res, 200, api.createEdict(body));
        }
        const match = route.match(/^\/edicts\/([A-Za-z0-9-]+)(\/[a-z-]+)?$/);
        if (match) {
          const [, edictId, action] = match;
          if (method === 'GET' && !action) return sendJson(res, 200, api.getEdict(edictId));
          if (method === 'POST' && action === '/approve') return sendJson(res, 200, api.approve(edictId));
          if (method === 'POST' && action === '/cancel') return sendJson(res, 200, api.cancel(edictId));
          if (method === 'POST' && action === '/reject') {
            const body = JSON.parse(await readBody(req) || '{}');
            return sendJson(res, 200, api.reject(edictId, body.note));
          }
        }
        if (route === '/artifact' && method === 'GET') {
          const edictId = url.searchParams.get('id') || '';
          const artifactName = url.searchParams.get('name') || '';
          const text = api.getArtifact(edictId, artifactName);
          return sendJson(res, 200, { name: artifactName, text });
        }
        return sendJson(res, 404, { error: `未知端点：${method} ${route}` });
      } catch (error) {
        return sendJson(res, 400, { error: String(error && error.message ? error.message : error) });
      }
    },
  }));
}

function registerTools(ctx, api) {
  const tools = ctx.tools;
  if (!tools || typeof tools.register !== 'function') {
    console.warn('[三省六部] tools 服务不可用，模型无法下旨');
    return;
  }

  const textOutput = {
    schema: { type: 'string' },
    render: (_args, value) => [{ type: 'text', text: String(value ?? '') }],
  };

  // parameters 用 DSH 自己的参数表写法：{ 参数名: { type, required, description } }（与 dsh-openwrite 一致），
  // 不是 JSON Schema。单个工具注册失败不应该拖垮整个插件，所以逐个兜底。
  const safeRegister = definition => {
    try {
      tools.register(defineTool(definition));
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      console.warn(`[三省六部] 工具注册失败（${definition.name}）：${message}`);
    }
  };

  safeRegister({
    name: 'sansheng_edict',
    description: '三省六部：皇帝下旨。把一个跨工具、跨领域的任务交给朝堂处理（中书拟旨→门下封驳→六部执行→上奏）。会在后台异步执行，立刻返回奏折编号；用 sansheng_status 查看进度。开启自治模式时全程无人值守，复核通过自动归档。',
    parameters: {
      brief: { type: 'string', required: true, description: '圣意：要完成的完整任务描述（目标、范围、期望结果）' },
      workspace: { type: 'string', description: '办事的工作目录绝对路径，缺省为 DSH 当前工作目录' },
      criteria: { type: 'string', description: '可选：验收标准' },
    },
    output: textOutput,
    async execute(args = {}) {
      const result = api.createEdict(args);
      return `已开朝，奏折编号 ${result.id}。\n后台流程：中书拟旨 → 门下封驳 → 尚书派单 → 六部执行 → 上奏。\n用 sansheng_status 传入该编号查看进度。`;
    },
  });

  safeRegister({
    name: 'sansheng_status',
    description: '三省六部：查看奏折进度。不传 id 时列出最近奏折。',
    parameters: {
      id: { type: 'string', description: '奏折编号，缺省列出最近 10 份' },
    },
    output: textOutput,
    async execute(args = {}) {
      if (!args.id) {
        const list = api.getState().edicts.slice(0, 10);
        if (!list.length) return '朝堂还没有奏折。用 sansheng_edict 下旨。';
        return list
          .map(item => `- ${item.id} [${item.status}] ${String(item.brief || '').slice(0, 60)}`)
          .join('\n');
      }
      const detail = api.getEdict(String(args.id));
      const lines = [
        `奏折 ${detail.id}`,
        `状态：${detail.status}${detail.note ? `（${detail.note}）` : ''}`,
        `圣意：${detail.brief}`,
        `阶段：${detail.stage}，中书/门下共 ${detail.rounds} 轮`,
      ];
      if (detail.steps.length) {
        lines.push('六部：');
        detail.steps.forEach(step => lines.push(`- ${step.ministry}｜${step.title}｜${step.status}`));
      }
      if (detail.messages && detail.messages.length) {
        lines.push('往来（最近 6 条）：');
        detail.messages.slice(-6).forEach(item => lines.push(`- ${item.from} → ${item.to}［${item.kind}${item.model ? ` · ${item.model}` : ''}］${String(item.summary || '').slice(0, 60)}`));
      }
      if (detail.status === 'awaiting-approval') lines.push('已上奏，可直接批红：sansheng_approve。');
      if (detail.error) lines.push(`失败原因：${detail.error}`);
      lines.push(`产物：${detail.artifacts.join('、') || '无'}`);
      return lines.join('\n').slice(0, 12000);
    },
  });

  safeRegister({
    name: 'sansheng_approve',
    description: '三省六部：皇帝批红，批准已上奏的奏折并归档。',
    parameters: {
      id: { type: 'string', required: true, description: '奏折编号' },
    },
    output: textOutput,
    async execute(args = {}) {
      const result = api.approve(String(args.id || ''));
      return `已批红：${result.id}（${result.brief.slice(0, 40)}）`;
    },
  });

  safeRegister({
    name: 'sansheng_assign',
    description: '三省六部：任命/调任。把某个 agent 派到某个官职（三省或六部），可同时指定该岗位使用的模型，立即生效。',
    parameters: {
      role: { type: 'string', required: true, description: '官职 id：zhongshu / menxia / shangshu / personnel / revenue / rites / war / justice / works' },
      agentId: { type: 'string', required: true, description: 'agents 列表里的 agent id' },
      model: { type: 'string', description: '可选：该岗位使用的模型（如 opus / gpt-5-codex / auto；留空用该 CLI 默认）' },
    },
    output: textOutput,
    async execute(args = {}) {
      const state = api.getState();
      const roles = { ...state.roles };
      if (!roles[args.role]) throw new Error(`没有这个官职：${args.role}`);
      if (!state.agents.some(agent => agent.id === args.agentId)) throw new Error(`没有这个 agent：${args.agentId}`);
      roles[args.role] = {
        ...roles[args.role],
        agentId: args.agentId,
        ...(args.model !== undefined ? { model: String(args.model || '') } : {}),
      };
      api.savePreset({ agents: state.agents, roles, rules: state.rules });
      return `已任命：${roles[args.role].title} ← ${args.agentId}${args.model ? `（${args.model}）` : ''}`;
    },
  });
}
