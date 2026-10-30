// 朝局：按「谁在任上」算出朝中有几家工具、几家模型，对应五级朝局。
// 只看任命，不调模型、不耗 token；每份奏折办完再按实际调用算一次「本朝实际」。
//
//   1 加九锡   只有一家工具，模型也都出自同一家     —— 权臣一人包办，皇帝看不见也插不上手
//   2 权倾朝野 只有一家工具，但调了不同家的模型     —— 公文看得到，审议出自同一套工具，只能参考
//   3 两党争霸 两家工具（东西罗马）                 —— 封驳是真封驳，僵持要皇帝亲断
//   4 三巨头   三家工具                             —— 各领疆域，审议可以 2:1 表决
//   5 乾纲独断 四家及以上                           —— 量才授官，每件差事派给最合适的那家
import { MINISTRY_IDS } from './i18n.mjs';

export const REGIMES = ['jiuxi', 'quanchen', 'liangdang', 'sanju', 'qiangang'];

export const REGIME_TEXT = {
  zh: { jiuxi: '加九锡', quanchen: '权倾朝野', liangdang: '两党争霸', sanju: '三巨头', qiangang: '乾纲独断' },
  en: { jiuxi: 'Dictator Perpetuo', quanchen: 'Sejanus’ Rome', liangdang: 'East and West', sanju: 'Triumvirate', qiangang: 'Tetrarchy' },
};

// 会调模型的岗位。尚书省、锦衣卫由插件自己办，不算在哪一家头上
export const OFFICES = ['zhongshu', 'menxia', ...MINISTRY_IDS, 'yushi'];

// 模型名 → 出自哪一家。认不出的归到工具自己名下
const FAMILY_PATTERNS = [
  [/claude|opus|sonnet|haiku|anthropic/i, 'anthropic'],
  [/gpt|codex|^o\d|openai|chatgpt/i, 'openai'],
  [/deepseek/i, 'deepseek'],
  [/qwen|qwq|tongyi|千问/i, 'alibaba'],
  [/gemini|gemma|google/i, 'google'],
  [/glm|zhipu|chatglm/i, 'zhipu'],
  [/kimi|moonshot/i, 'moonshot'],
  [/doubao|seed|bytedance/i, 'bytedance'],
  [/hunyuan|\bhy\d/i, 'tencent'],
  [/minimax|abab/i, 'minimax'],
  [/llama|meta/i, 'meta'],
  [/mistral|codestral/i, 'mistral'],
  [/grok|xai/i, 'xai'],
];
// 不写模型时用工具自己的默认模型
const TOOL_FAMILY = [
  [/claude/i, 'anthropic'],
  [/codex/i, 'openai'],
  [/gemini/i, 'google'],
  [/qwen/i, 'alibaba'],
  [/kimi/i, 'moonshot'],
];

export function familyOf(model, agent) {
  const name = String(model || '').trim();
  if (name && !/^(auto|default)$/i.test(name)) {
    for (const [pattern, family] of FAMILY_PATTERNS) if (pattern.test(name)) return family;
    return `model:${name.toLowerCase()}`;
  }
  if (!agent) return 'unknown';
  if (agent.family) return String(agent.family);
  // DSH 自己办：默认是 DeepSeek
  if (agent.adapter === 'self') return 'deepseek';
  const command = `${agent.command || ''} ${agent.id || ''}`;
  for (const [pattern, family] of TOOL_FAMILY) if (pattern.test(command)) return family;
  return `tool:${agent.id}`;
}

const usable = agent => agent && agent.enabled !== false && (agent.adapter === 'cli' || agent.adapter === 'self');

/** 某个岗位实际由谁办：岗位上的人办不了时，丞相模式下由代办接手；常规模式下人工岗位就是皇帝自己拿那个工具办 */
export function holderOf(roleId, { agents = [], roles = {}, rules = {} }) {
  const role = roles[roleId] || {};
  const agent = agents.find(item => item.id === role.agentId) || null;
  const fallback = agents.find(item => item.id === rules.fallbackAgentId && item.adapter === 'cli' && item.enabled !== false) || null;
  if (agent && agent.enabled !== false && (agent.adapter === 'cli' || agent.adapter === 'self')) return { agent, model: role.model || '', deputy: false };
  if (rules.autonomous === true && fallback) return { agent: fallback, model: '', deputy: true };
  if (agent && agent.enabled !== false && agent.adapter === 'manual') return { agent, model: '', deputy: false, manual: true };
  return { agent: null, model: '', deputy: false };
}

/** 由「几家工具、几家模型」定朝局 */
export function levelOf(toolCount, familyCount) {
  if (toolCount >= 4) return 'qiangang';
  if (toolCount === 3) return 'sanju';
  if (toolCount === 2) return 'liangdang';
  return familyCount > 1 ? 'quanchen' : 'jiuxi';
}

// 各家所长：按工具的「特长」标签与岗位职掌对上号
const FIT = [
  [/审查|审议|测试|评审|异构|review|test|audit/i, ['menxia', 'justice', 'yushi']],
  [/实现|代码|编码|构建|implement|code|build/i, ['war', 'works']],
  [/规划|架构|方案|plan|architect/i, ['zhongshu']],
  [/数据|表格|报表|excel|data|sheet/i, ['revenue']],
  [/文书|文档|写作|ppt|汇报|中文|docs?|writ|slide/i, ['rites']],
  [/界面|设计|ui|design/i, ['works']],
  [/配置|账号|权限|运维|config|ops/i, ['personnel']],
];
function fitScore(agent, roleId) {
  let score = 0;
  for (const trait of agent.traits || []) {
    for (const [pattern, offices] of FIT) if (pattern.test(trait) && offices.includes(roleId)) score += 1;
  }
  return score;
}

/**
 * 按任命算朝局。返回：
 *   level / rank（1–5）、tools（每家工具担任的岗位）、families、dominant（权柄最重的一家）、
 *   holders（每个岗位实际由谁办）、suggestions（再任用哪一家能升一级，以及「回避」提醒）
 */
export function regimeOf(state) {
  const { agents = [], roles = {}, rules = {} } = state || {};
  const offices = OFFICES.filter(roleId => roleId !== 'yushi' || roles.yushi);
  const holders = {};
  const tools = new Map();
  const families = new Set();
  for (const roleId of offices) {
    const holder = holderOf(roleId, { agents, roles, rules });
    if (!holder.agent) { holders[roleId] = null; continue; }
    const family = familyOf(holder.model, holder.agent);
    holders[roleId] = { agentId: holder.agent.id, agent: holder.agent.name, family, deputy: holder.deputy, manual: !!holder.manual };
    const bucket = tools.get(holder.agent.id) || { agentId: holder.agent.id, name: holder.agent.name, offices: [], families: [] };
    bucket.offices.push(roleId);
    if (!bucket.families.includes(family)) bucket.families.push(family);
    tools.set(holder.agent.id, bucket);
    families.add(family);
  }
  const list = [...tools.values()].sort((a, b) => b.offices.length - a.offices.length);
  const level = levelOf(list.length, families.size);
  const filled = Object.values(holders).filter(Boolean).length;
  const dominant = list[0] ? { ...list[0], share: filled ? list[0].offices.length / filled : 0 } : null;

  const suggestions = [];
  const rank = REGIMES.indexOf(level) + 1;
  if (rank < REGIMES.length) {
    // 还没上任的可用工具：交给它一个最对口、且最好是从权柄最重那家手里分出来的岗位（推恩分封）
    const idle = agents.filter(agent => usable(agent) && !tools.has(agent.id));
    const next = levelOf(list.length + 1, families.size + 1);
    const taken = new Set();
    for (const agent of idle) {
      const candidates = (dominant ? dominant.offices : offices)
        .filter(roleId => roleId !== 'yushi' && !taken.has(roleId))
        .map(roleId => ({ roleId, score: fitScore(agent, roleId) }))
        // 同样对口（或都不对口）时先分六部，拟旨、封驳这种要紧的岗位最后才动
        .sort((a, b) => b.score - a.score || (MINISTRY_IDS.includes(b.roleId) - MINISTRY_IDS.includes(a.roleId)));
      if (!candidates.length) continue;
      taken.add(candidates[0].roleId);
      suggestions.push({ kind: 'appoint', agentId: agent.id, agent: agent.name, roleId: candidates[0].roleId, fit: candidates[0].score > 0, to: next });
      if (suggestions.length >= 2) break;
    }
    if (!idle.length) suggestions.push({ kind: 'recruit', to: next });
  }
  // 回避：拟旨与封驳出自同一家时，朝中明明还有别家可审
  const draft = holders.zhongshu;
  const veto = holders.menxia;
  if (draft && veto && draft.agentId === veto.agentId && list.length >= 2) {
    const other = list.find(item => item.agentId !== draft.agentId);
    suggestions.push({ kind: 'recuse', roleId: 'menxia', agentId: other.agentId, agent: other.name });
  }

  return {
    level, rank,
    tools: list,
    families: [...families],
    dominant,
    holders,
    autonomous: rules.autonomous === true,
    suggestions,
  };
}

/** 一份奏折实际调用了几家：工具倒了由代办接手时，本朝实际会比任命时低 */
export function actualRegimeOf(calls = [], agents = []) {
  const tools = new Set();
  const families = new Set();
  for (const call of calls) {
    if (!call || !call.agentId || call.roleId === 'historian') continue;
    tools.add(call.agentId);
    families.add(familyOf(call.model, agents.find(item => item.id === call.agentId) || { id: call.agentId }));
  }
  if (!tools.size) return '';
  return levelOf(tools.size, families.size);
}

/**
 * 架空指数（0–100，越高越被架空）：朝局越集中越高；丞相模式代你拍板加分；
 * 你亲自批红 / 驳回 / 叫停过的奏折越多越低。
 */
export function puppetIndex(regime, entries = []) {
  const base = { jiuxi: 82, quanchen: 66, liangdang: 44, sanju: 28, qiangang: 14 }[regime.level] ?? 60;
  let score = base;
  if (regime.autonomous) score += 12;
  if (regime.dominant && regime.dominant.share > 0.6) score += Math.round((regime.dominant.share - 0.6) * 25);
  const settled = entries.filter(item => ['done', 'rejected', 'cancelled'].includes(item.outcome)).slice(0, 30);
  if (settled.length) {
    const ruled = settled.filter(item => item.ruledBy === 'emperor').length / settled.length;
    score += Math.round((0.5 - ruled) * 24);
  }
  return Math.max(0, Math.min(100, score));
}

export function puppetVerdict(score) {
  if (score >= 80) return 'figurehead';
  if (score >= 60) return 'slipping';
  if (score >= 40) return 'shared';
  if (score >= 20) return 'steady';
  return 'supreme';
}
