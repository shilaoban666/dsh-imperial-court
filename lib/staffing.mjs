// 自动编制：按本机「真能用」的工具排岗位，开箱即用。
//   只装了 DSH：所有岗位由 DSH 担任，拟方案用强模型、审方案换一个模型，照样有把关；
//   接上 Claude Code / Codex：它们接手最合适的岗位，审方案的尽量和出方案的不是同一家（别家来审才算审过）。
// 新用户默认「自动」；用户自己改过岗位就转为「手动」，从此不再替他改。
import { ROLE_IDS } from './i18n.mjs';

// 每个岗位按顺序挑第一个能用的
const PREFER = {
  zhongshu: ['cc', 'codex', 'dsh'],
  menxia: ['codex', 'cc', 'dsh'],
  shangshu: ['dsh', 'cc', 'codex'],
  personnel: ['cc', 'dsh', 'codex'],
  revenue: ['workbuddy', 'dsh', 'cc', 'codex'],
  rites: ['dsh', 'cc', 'codex'],
  war: ['cc', 'codex', 'dsh'],
  justice: ['codex', 'cc', 'dsh'],
  works: ['cc', 'dsh', 'codex'],
  yushi: ['dsh', 'cc', 'codex'],
};
// 这两对尽量不落在同一家：审方案的 ≠ 出方案的，测试的 ≠ 写代码的
const AVOID = { menxia: 'zhongshu', justice: 'war' };
// 同一家既出方案又审方案时，DSH 换个模型审（强模型出方案，快模型挑毛病）
const DSH_MODELS = { strong: 'deepseek-v4-pro', fast: 'deepseek-flash' };

/**
 * @param {{ agents: object[], roles: object, rules: object }} state 当前编制
 * @param {Set<string>} ready 现在真能用的 agent id
 * @returns {{ roles, rules, agents, changed: boolean } | null} 一个都不能用时返回 null（保持原样）
 */
export function autoStaff(state, ready) {
  if (!ready || !ready.size) return null;
  const roles = {};
  const pick = (roleId, avoid) => {
    const list = (PREFER[roleId] || ['dsh', 'cc', 'codex']).filter(id => ready.has(id));
    const other = avoid ? list.find(id => id !== avoid) : '';
    return other || list[0] || [...ready][0];
  };
  for (const roleId of ROLE_IDS) {
    const prev = (state.roles || {})[roleId] || {};
    if (roleId === 'jinyiwei') { roles[roleId] = { ...prev, agentId: '', model: '' }; continue; }
    const avoid = AVOID[roleId] && roles[AVOID[roleId]] ? roles[AVOID[roleId]].agentId : '';
    roles[roleId] = { ...prev, agentId: pick(roleId, avoid), model: '' };
  }
  // 模型：DSH 出方案用强模型；若审方案也落在 DSH，就换快模型审；御史巡查用快模型
  if (roles.zhongshu.agentId === 'dsh') roles.zhongshu.model = DSH_MODELS.strong;
  if (roles.menxia.agentId === 'dsh') roles.menxia.model = roles.zhongshu.agentId === 'dsh' ? DSH_MODELS.fast : DSH_MODELS.strong;
  if (roles.yushi.agentId === 'dsh') roles.yushi.model = DSH_MODELS.fast;
  if (roles.yushi.agentId === 'cc') roles.yushi.model = 'haiku';

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
    return a.agentId !== roles[id].agentId || (a.model || '') !== roles[id].model;
  });
  return { roles, rules, agents, changed };
}

/** 两份编制的任职是否不同（用户手动改了谁在哪个岗位） */
export function staffingChanged(before = {}, after = {}) {
  return ROLE_IDS.some(id => ((before[id] || {}).agentId || '') !== ((after[id] || {}).agentId || '')
    || ((before[id] || {}).model || '') !== ((after[id] || {}).model || ''));
}
