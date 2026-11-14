// 自动编制 / 一键推荐：按本机「真能用」的工具排岗位，开箱即用。
//   只装了 DSH：所有岗位由 DSH 担任，拟方案用强模型、审方案换一个模型，照样有把关；
//   接上别家（Claude Code、Codex、Gemini CLI、Cursor、OpenCode、Qwen Code、WorkBuddy）：各自接手最合适的岗位，
//   审方案的尽量和出方案的不是同一家，测试的尽量和写代码的不是同一家（别家来审才算审过）。
// 同时给出模型与思考深度：出方案、审方案往深里想，跑腿的岗位用快的。
// 新用户默认「自动」；用户自己改过岗位就转为「手动」，从此不再替他改（「一键推荐」是他主动要的，照样能用）。
import { ROLE_IDS } from './i18n.mjs';

// 每个岗位按顺序挑第一个能用的。没列到的工具（用户自己加的）排在最后，照样能被挑中
const PREFER = {
  zhongshu: ['cc', 'codex', 'gemini', 'cursor', 'opencode', 'qwen-code', 'workbuddy', 'dsh'],
  menxia: ['codex', 'cc', 'gemini', 'cursor', 'opencode', 'qwen-code', 'workbuddy', 'dsh'],
  shangshu: ['dsh', 'cc', 'codex'],
  personnel: ['cc', 'dsh', 'codex', 'gemini', 'workbuddy', 'qwen-code'],
  revenue: ['workbuddy', 'gemini', 'dsh', 'cc', 'codex', 'qwen-code'],
  rites: ['dsh', 'qwen-code', 'gemini', 'cc', 'workbuddy', 'codex'],
  war: ['cc', 'codex', 'cursor', 'opencode', 'workbuddy', 'qwen-code', 'gemini', 'dsh'],
  justice: ['codex', 'cc', 'gemini', 'cursor', 'opencode', 'dsh'],
  works: ['cc', 'gemini', 'cursor', 'dsh', 'codex', 'opencode'],
  yushi: ['dsh', 'gemini', 'cc', 'codex', 'workbuddy'],
};
// 这两对尽量不落在同一家：审方案的 ≠ 出方案的，测试的 ≠ 写代码的
const AVOID = { menxia: 'zhongshu', justice: 'war' };
// 同一家既出方案又审方案时，DSH 换个模型审（强模型出方案，快模型挑毛病）
const DSH_MODELS = { strong: 'deepseek-v4-pro', fast: 'deepseek-flash' };
// 思考深度：出方案、审方案、复核往深里想；写代码、测试适中；御史巡查求快。该 CLI 不认的档位不填
const EFFORT = { zhongshu: 'high', menxia: 'high', war: 'medium', justice: 'medium', yushi: 'low' };
// Claude Code 各岗位的模型：出方案、审方案用最强的，写代码用均衡的，巡查用快的
const CC_MODELS = { zhongshu: 'opus', menxia: 'opus', war: 'sonnet', justice: 'sonnet', yushi: 'haiku' };

/**
 * @param {{ agents: object[], roles: object, rules: object }} state 当前编制
 * @param {Set<string>} ready 现在真能用的 agent id
 * @returns {{ roles, rules, agents, changed: boolean } | null} 一个都不能用时返回 null（保持原样）
 */
export function autoStaff(state, ready) {
  if (!ready || !ready.size) return null;
  const agentsById = new Map((state.agents || []).map(agent => [agent.id, agent]));
  const roles = {};
  const pick = (roleId, avoid) => {
    const order = PREFER[roleId] || ['dsh', 'cc', 'codex'];
    const list = [...order.filter(id => ready.has(id)), ...[...ready].filter(id => !order.includes(id))];
    const other = avoid ? list.find(id => id !== avoid) : '';
    return other || list[0];
  };
  for (const roleId of ROLE_IDS) {
    const prev = (state.roles || {})[roleId] || {};
    if (roleId === 'jinyiwei') { roles[roleId] = { ...prev, agentId: '', model: '', effort: '' }; continue; }
    const avoid = AVOID[roleId] && roles[AVOID[roleId]] ? roles[AVOID[roleId]].agentId : '';
    roles[roleId] = { ...prev, agentId: pick(roleId, avoid), model: '', effort: '' };
  }
  // 模型：DSH 出方案用强模型；若审方案也落在 DSH，就换快模型审；御史巡查用快模型
  if (roles.zhongshu.agentId === 'dsh') roles.zhongshu.model = DSH_MODELS.strong;
  if (roles.menxia.agentId === 'dsh') roles.menxia.model = roles.zhongshu.agentId === 'dsh' ? DSH_MODELS.fast : DSH_MODELS.strong;
  if (roles.yushi.agentId === 'dsh') roles.yushi.model = DSH_MODELS.fast;
  for (const roleId of ROLE_IDS) {
    const role = roles[roleId];
    const agent = agentsById.get(role.agentId);
    if (!agent || roleId === 'shangshu' || roleId === 'jinyiwei') continue;
    if (role.agentId === 'cc' && CC_MODELS[roleId] && (agent.models || []).includes(CC_MODELS[roleId])) role.model = CC_MODELS[roleId];
    const effort = EFFORT[roleId];
    if (effort && Array.isArray(agent.efforts) && agent.efforts.includes(effort)) role.effort = effort;
  }

  const deputy = ready.has('dsh') ? 'dsh' : roles.zhongshu.agentId;
  const rules = {
    ...state.rules,
    fallbackAgentId: deputy,
    historianAgentId: deputy,
    historianModel: deputy === 'dsh' ? DSH_MODELS.fast : deputy === 'cc' ? 'haiku' : '',
  };
  const used = new Set(Object.values(roles).map(role => role.agentId).filter(Boolean));
  const agents = (state.agents || []).map(agent => (used.has(agent.id) ? { ...agent, enabled: true } : agent));
  const changed = ROLE_IDS.some(id => {
    const a = (state.roles || {})[id] || {};
    return a.agentId !== roles[id].agentId || (a.model || '') !== roles[id].model || (a.effort || '') !== roles[id].effort;
  });
  return { roles, rules, agents, changed };
}

/** 两份编制的任职是否不同（用户手动改了谁在哪个岗位、用什么模型、想多深） */
export function staffingChanged(before = {}, after = {}) {
  const same = (a, b, key) => ((a || {})[key] || '') === ((b || {})[key] || '');
  return ROLE_IDS.some(id => !same(before[id], after[id], 'agentId') || !same(before[id], after[id], 'model') || !same(before[id], after[id], 'effort'));
}

/** 两份编制差在哪：给「一键推荐」的提示条用 */
export function staffingDiff(before = {}, after = {}) {
  return ROLE_IDS.filter(id => ['agentId', 'model', 'effort'].some(key => ((before[id] || {})[key] || '') !== ((after[id] || {})[key] || '')))
    .map(id => ({ roleId: id, from: { ...(before[id] || {}) }, to: { ...(after[id] || {}) } }));
}
