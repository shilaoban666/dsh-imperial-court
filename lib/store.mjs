// 简易持久化：state.json 存群臣/官职/奏折索引，每份奏折一个目录存全文与产物。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const DEFAULT_DIR = path.join(
  process.env.DSH_HOME || path.join(os.homedir(), '.dsh'),
  'sansheng-liubu',
);

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

export function createStore(dataDir) {
  const root = dataDir && String(dataDir).trim() ? path.resolve(dataDir) : DEFAULT_DIR;
  const edictsDir = path.join(root, 'edicts');
  fs.mkdirSync(edictsDir, { recursive: true });
  const stateFile = path.join(root, 'state.json');

  const state = { version: 1, agents: [], roles: {}, rules: {}, edicts: {} };

  function load(preset) {
    const saved = readJson(stateFile, null);
    const base = structuredClone(preset);
    if (saved && typeof saved === 'object') {
      // 与预设按 id 合并：老版本 state.json 缺的新字段（modelArgs/models/roles[].model）自动补上，
      // 用户改过的命令、参数、任职关系仍然保留。
      if (Array.isArray(saved.agents)) {
        const savedById = new Map(saved.agents.filter(item => item && item.id).map(item => [item.id, item]));
        base.agents = (base.agents || []).map(item => ({ ...item, ...(savedById.get(item.id) || {}) }));
        for (const item of saved.agents) {
          if (item && item.id && !base.agents.some(existing => existing.id === item.id)) base.agents.push(item);
        }
      }
      if (saved.roles && typeof saved.roles === 'object') {
        const merged = { ...(base.roles || {}) };
        for (const [roleId, role] of Object.entries(saved.roles)) {
          merged[roleId] = { ...(merged[roleId] || {}), ...(role || {}) };
        }
        base.roles = merged;
      }
      base.rules = { ...(base.rules || {}), ...(saved.rules || {}) };
      if (saved.ui && typeof saved.ui === 'object') base.ui = { ...(base.ui || {}), ...saved.ui };
      if (Array.isArray(saved.workflow)) base.workflow = saved.workflow;
      if (saved.edicts && typeof saved.edicts === 'object') base.edicts = saved.edicts;
    }
    if (!Array.isArray(base.workflow)) base.workflow = [];
    Object.assign(state, base);
    if (!state.edicts) state.edicts = {};
    save();
    return state;
  }

  function save() {
    writeJson(stateFile, state);
  }

  const edictFile = id => path.join(edictsDir, id, 'edict.json');

  function newEdict({ brief, workspace, criteria }) {
    const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const id = `edict-${stamp}-${Math.random().toString(36).slice(2, 6)}`;
    const edict = {
      id,
      brief: String(brief || '').trim(),
      workspace: workspace && String(workspace).trim() ? path.resolve(String(workspace)) : process.cwd(),
      criteria: String(criteria || '').trim(),
      status: 'queued',
      stage: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      rounds: 0,
      plan: null,
      steps: [],
      events: [],
      artifacts: [],
    };
    state.edicts[id] = {
      id, brief: edict.brief, workspace: edict.workspace, status: edict.status, createdAt: edict.createdAt, updatedAt: edict.createdAt,
    };
    save();
    saveEdict(edict);
    return edict;
  }

  function saveEdict(edict) {
    edict.updatedAt = Date.now();
    writeJson(edictFile(edict.id), edict);
    if (state.edicts[edict.id]) {
      state.edicts[edict.id].status = edict.status;
      state.edicts[edict.id].stage = edict.stage;
      state.edicts[edict.id].note = edict.note || '';
      state.edicts[edict.id].workspace = edict.workspace;
      state.edicts[edict.id].locale = edict.locale || 'zh';
      state.edicts[edict.id].autonomous = edict.autonomous === true;
      state.edicts[edict.id].updatedAt = edict.updatedAt;
      save();
    }
  }

  function getEdict(id) {
    // id 会拼进路径，必须先校验，否则 ../ 可以跳出 edicts 目录
    if (!/^[A-Za-z0-9-]{1,64}$/.test(String(id || ''))) return null;
    return readJson(edictFile(id), null);
  }

  function listEdicts() {
    return Object.values(state.edicts).sort((a, b) => b.createdAt - a.createdAt);
  }

  function appendEvent(edict, type, data = {}) {
    edict.events.push({ at: Date.now(), type, data });
    if (edict.events.length > 500) edict.events.splice(0, edict.events.length - 500);
  }

  function artifactPath(edict, name) {
    const file = path.resolve(edictsDir, edict.id, String(name));
    const base = path.resolve(edictsDir, edict.id);
    if (!file.startsWith(base + path.sep)) throw new Error('非法产物路径');
    return file;
  }

  function writeArtifact(edict, name, text) {
    const file = artifactPath(edict, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, String(text ?? ''), 'utf8');
    if (!edict.artifacts.includes(name)) edict.artifacts.push(name);
    saveEdict(edict);
    return file;
  }

  function readArtifact(edict, name) {
    try {
      return fs.readFileSync(artifactPath(edict, name), 'utf8');
    } catch {
      return '';
    }
  }

  function listArtifacts(edict) {
    const base = path.join(edictsDir, edict.id);
    const out = [];
    const walk = (dir, prefix) => {
      let entries = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.name === 'edict.json') continue;
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) walk(path.join(dir, entry.name), rel);
        else out.push(rel);
      }
    };
    walk(base, '');
    return out.sort();
  }

  return {
    root,
    state,
    load,
    save,
    newEdict,
    saveEdict,
    getEdict,
    listEdicts,
    appendEvent,
    writeArtifact,
    readArtifact,
    listArtifacts,
  };
}
