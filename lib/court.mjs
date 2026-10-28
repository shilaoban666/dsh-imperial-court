// 朝堂流程：中书拟旨 → 门下封驳 → 尚书派单 → 六部执行 → 门下复核 → 上奏待批红。
// 尚书省 v0.1 由插件本身（都省文书）执行确定式派单与汇总，不额外消耗一次模型调用。
//
// 自治模式（edict.autonomous）：
//   - 门下封驳到上限仍不准奏：按最后一版方案执行，封驳意见转为各部的注意事项；
//   - 某部办差失败：带着失败原因重办一次；
//   - 复核未达标：中书拟补救差事 → 六部补办 → 再复核，最多 maxFixRounds 轮；
//   - 复核通过即自动批红归档；修不好才上奏等皇帝裁决。
import {
  ministriesOf, draftPrompt, reviewPrompt, taskPrompt, recheckPrompt, fixPrompt, extractJson,
} from './prompts.mjs';

const pad = number => String(number).padStart(2, '0');
const clampInt = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
};

/** 从回奏里解析「移文」请求：{"handoff":{"to":"justice","reason":"..."}} */
function extractHandoff(text, ministryIds) {
  if (!text || !text.includes('"handoff"')) return null;
  const index = text.indexOf('"handoff"');
  const start = text.lastIndexOf('{', index);
  if (start < 0) return null;
  const parsed = extractJson(text.slice(start));
  const handoff = parsed && parsed.handoff;
  if (!handoff || typeof handoff !== 'object') return null;
  const to = String(handoff.to || '').trim();
  if (!ministryIds.has(to)) return null;
  return {
    to,
    reason: String(handoff.reason || '请求协同处理').slice(0, 400),
    deliverable: String(handoff.deliverable || ''),
  };
}

function normalizeSteps(raw, maxSteps, ministryIds, firstSeq = 1) {
  const list = Array.isArray(raw) ? raw : [];
  const steps = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const ministry = String(item.ministry || '').trim();
    if (!ministryIds.has(ministry)) continue;
    steps.push({
      seq: firstSeq + steps.length,
      ministry,
      title: String(item.title || '').slice(0, 120) || '未命名差事',
      instruction: String(item.instruction || '').slice(0, 6000),
      deliverable: String(item.deliverable || '').slice(0, 500),
      status: 'pending',
      summary: '',
      depth: 0,
    });
    if (steps.length >= maxSteps) break;
  }
  return steps;
}

/** 模型可能输出 "Reject" / "驳回" / " approve "，统一成 approve | reject | 原值 */
function normalizeVerdict(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'reject' || text === '驳回' || text === '封驳') return 'reject';
  if (text === 'approve' || text === '准奏' || text === '通过') return 'approve';
  return text;
}

function buildMemorial(edict, plan, review, steps, runtime) {
  const recheck = edict.recheck || {};
  const lines = [];
  lines.push('# 奏折', '');
  lines.push(`- 奏折编号：${edict.id}`);
  lines.push(`- 圣意：${edict.brief}`);
  lines.push(`- 工作目录：${edict.workspace}`);
  lines.push(`- 模式：${edict.autonomous ? '自治（无人值守）' : '常规（待皇帝批红）'}`);
  lines.push(`- 门下意见：${review?.verdict === 'approve' ? '准奏' : (review?.verdict || '未审议')}`);
  if (Array.isArray(review?.issues) && review.issues.length) lines.push(`- 封驳要点：${review.issues.join('；')}`);
  lines.push(`- 门下复核：${recheck.verdict === 'approve' ? '达标' : recheck.verdict === 'reject' ? '未达标' : (recheck.verdict || '未复核')}`);
  if (Array.isArray(recheck.issues) && recheck.issues.length) lines.push(`- 复核意见：${recheck.issues.join('；')}`);
  if (edict.fixRounds) lines.push(`- 自我修复：${edict.fixRounds} 轮`);
  lines.push('', '## 中书省方案', plan.summary ? String(plan.summary) : '（未提供摘要）', '');
  for (const step of steps) {
    const role = runtime.role(step.ministry) || {};
    lines.push(`### ${role.title || step.ministry} · ${step.title}`);
    lines.push(`- 状态：${step.status}${step.retried ? '（重办过）' : ''}${step.agent ? `，办理：${step.agent}` : ''}`);
    if (step.deliverable) lines.push(`- 产出要求：${step.deliverable}`);
    if (step.summary) lines.push('', '```text', step.summary.slice(0, 2000), '```');
    lines.push('');
  }
  if (Array.isArray(plan.acceptance) && plan.acceptance.length) {
    lines.push('## 验收清单');
    plan.acceptance.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
  }
  lines.push('', '---', edict.autonomous ? '自治模式：复核通过即自动归档。' : '请皇帝批红：批准后归档，驳回则记录意见。');
  return lines.join('\n');
}

export async function runEdict(runtime, edictId) {
  const { store } = runtime;
  const edict = store.getEdict(edictId);
  if (!edict) throw new Error('奏折不存在');

  const emit = (type, data = {}) => runtime.emit(edict, type, data);
  const stage = (stageId, note) => runtime.setStage(edict, stageId, note);
  const rules = store.state.rules || {};
  const autonomous = edict.autonomous === true;
  const maxRounds = clampInt(rules.maxReviewRounds, 1, 5, 3);
  // 钦定流程有几步就放几步，不受朝规里的步数上限约束（上限 12 在下旨时已截断）
  const maxSteps = Math.max(clampInt(rules.maxSteps, 1, 12, 8), Array.isArray(edict.workflow) ? edict.workflow.length : 0);
  const maxFixRounds = autonomous ? clampInt(rules.maxFixRounds, 0, 3, 2) : 0;
  const ministries = ministriesOf(store.state.roles);
  const ministryIds = new Set(ministries.map(item => item.id));
  const roleTitle = roleId => (runtime.role(roleId) || {}).title || roleId;
  // 叫停/驳回会 abort 这个信号。每次 await 回来都要看一眼，否则六部循环会把剩下的差事逐个「失败」跑完再上奏。
  const signal = runtime.signal(edict.id);
  const checkAborted = () => {
    if (signal && signal.aborted) throw new Error('朝会已中止');
  };

  const summarizeResults = steps => steps
    .map(step => `【${roleTitle(step.ministry)}】${step.title}\n状态：${step.status}${step.deliverable ? `\n产出：${step.deliverable}` : ''}\n${(step.summary || '').slice(0, 1200)}`)
    .join('\n\n');

  /** 依次办理 steps[from..]；移文会往 steps 末尾追加，循环会一并办掉 */
  async function executeSteps(steps, from, phase, stepCap) {
    for (let index = from; index < steps.length; index += 1) {
      const step = steps[index];
      const role = runtime.role(step.ministry);
      if (!role || !role.title) throw new Error(`未知官职：${step.ministry}`);
      runtime.message(edict, {
        from: '尚书省', to: role.title, kind: '派单', title: step.title,
        summary: step.instruction.slice(0, 300),
      });
      stage(phase, `${role.title}${phase === 'fixing' ? '补办' : '执行'}：${step.title}`);

      // 前序产出：已经办过的差事（含补救轮之前的），让本部知道上游做了什么、东西放在哪
      const previous = steps.slice(0, index)
        .filter(item => item.status !== 'pending')
        .map(item => ({ roleTitle: roleTitle(item.ministry), title: item.title, status: item.status, deliverable: item.deliverable, summary: item.summary }));
      const artifactName = `04-exec/${pad(step.seq)}-${step.ministry}.md`;
      const run = retryError => runtime.call(
        edict,
        step.ministry,
        ({ substitute }) => taskPrompt(edict, step, role, { previous, retryError, substitute, autonomous }),
        artifactName,
        { kind: retryError ? '重办' : '差事', from: '尚书省', title: step.title },
      );

      let result = await run('');
      checkAborted();
      if (!result.ok && !result.handedOff && autonomous) {
        step.retried = true;
        result = await run(result.error || '未知错误');
        checkAborted();
      }
      step.status = result.handedOff ? 'handed-off' : result.ok ? 'done' : 'failed';
      step.agent = result.agentName || '';
      step.summary = (result.output || result.note || result.error || '').slice(0, 6000);
      runtime.saveEdict(edict);
      emit('部务', { ministry: step.ministry, title: step.title, status: step.status });

      // 移文：某部在回奏里声明需要他部配合时，由尚书省转办一次（只允许转一层，避免互相踢皮球）
      const handoff = extractHandoff(result.output || '', ministryIds);
      if (handoff && (step.depth || 0) < 1 && steps.length < stepCap && handoff.to !== step.ministry) {
        steps.push({
          seq: steps.length + 1,
          ministry: handoff.to,
          title: `移文 · ${step.title}`,
          instruction: `【移文】${role.title}在办理「${step.title}」时请求${roleTitle(handoff.to)}协同：${handoff.reason}\n请按本部职掌处理，完成后简要汇报。`,
          deliverable: handoff.deliverable || '',
          status: 'pending',
          summary: '',
          depth: (step.depth || 0) + 1,
        });
        runtime.message(edict, {
          from: role.title, to: roleTitle(handoff.to), kind: '移文', title: step.title, summary: handoff.reason,
        });
        runtime.saveEdict(edict);
      }
    }
  }

  async function recheck(plan, steps) {
    stage('rechecking', '门下省复核');
    const rechecked = await runtime.call(
      edict,
      'menxia',
      recheckPrompt(edict, summarizeResults(steps), { acceptance: Array.isArray(plan.acceptance) ? plan.acceptance.map(String) : [], autonomous }),
      edict.fixRounds ? `05-recheck-r${edict.fixRounds + 1}.md` : '05-recheck.md',
      { kind: '复核', from: '尚书省' },
    );
    checkAborted();
    const verdict = rechecked.ok && !rechecked.handedOff
      ? (extractJson(rechecked.output) || { verdict: 'unknown', issues: ['门下省复核输出不是合法 JSON'] })
      : { verdict: 'skipped', issues: [rechecked.error || rechecked.note || '复核未执行'] };
    verdict.verdict = normalizeVerdict(verdict.verdict);
    verdict.issues = Array.isArray(verdict.issues) ? verdict.issues.map(String) : [];
    edict.recheck = verdict;
    runtime.saveEdict(edict);
    return verdict;
  }

  try {
    emit('开朝', { brief: edict.brief, workspace: edict.workspace, autonomous });
    let plan = null;
    let review = null;
    let issues = [];

    for (let round = 1; round <= maxRounds; round += 1) {
      edict.rounds = round;
      stage('drafting', `中书省拟旨（第 ${round} 轮）`);
      const draft = await runtime.call(
        edict,
        'zhongshu',
        draftPrompt(edict, issues, { ministries, autonomous, maxSteps }),
        `01-draft-r${round}.md`,
        { kind: '拟旨', from: '皇帝', title: `第 ${round} 轮拟旨`, summary: edict.brief.slice(0, 200) },
      );
      checkAborted();
      if (!draft.ok || draft.handedOff) {
        throw new Error(`中书省无法拟旨：${draft.error || draft.note || '未绑定可自动调用的 agent'}`);
      }
      plan = extractJson(draft.output);
      if (!plan || !Array.isArray(plan.steps)) throw new Error('中书省没有按约定格式输出 JSON 方案');
      edict.plan = plan;
      runtime.saveEdict(edict);

      stage('reviewing', `门下省封驳（第 ${round} 轮）`);
      const reviewed = await runtime.call(
        edict,
        'menxia',
        reviewPrompt(edict, JSON.stringify(plan, null, 2), { autonomous }),
        `02-review-r${round}.md`,
        { kind: '送审', from: '中书省', title: `第 ${round} 轮封驳` },
      );
      checkAborted();
      if (!reviewed.ok || reviewed.handedOff) {
        throw new Error(`门下省无法审议：${reviewed.error || reviewed.note || '未绑定可自动调用的 agent'}`);
      }
      // 门下输出无法解析时按准奏放行，但必须在往来里留痕，不能悄悄跳过封驳
      review = extractJson(reviewed.output)
        || { verdict: 'approve', issues: [], risks: ['门下省输出不是合法 JSON，按准奏处理，请人工核对审议意见'] };
      review.verdict = normalizeVerdict(review.verdict);
      if (review.verdict === 'reject') {
        issues = Array.isArray(review.issues) && review.issues.length
          ? review.issues.map(item => String(item))
          : ['门下驳正但未说明理由，请重拟'];
        runtime.message(edict, { from: '门下省', to: '中书省', kind: '封驳', title: `第 ${round} 轮`, summary: issues.join('；') });
        if (round < maxRounds) continue;
        if (!autonomous) throw new Error(`门下省 ${maxRounds} 次封驳，奏折驳回，请皇帝裁决`);
        // 自治：不停朝等人，按最后一版执行，把门下没解决的意见交给各部自己规避
        review.unresolved = issues;
        runtime.message(edict, {
          from: '尚书省', to: '中书省', kind: '保留', title: `${maxRounds} 轮封驳未决`,
          summary: '自治模式：按最后一版方案执行，门下意见转为各部注意事项',
        });
        break;
      }
      runtime.message(edict, {
        from: '门下省', to: '中书省', kind: '准奏', title: `第 ${round} 轮`,
        summary: (Array.isArray(review.risks) ? review.risks.join('；') : '').slice(0, 300),
      });
      break;
    }
    edict.review = review;
    runtime.saveEdict(edict);

    stage('dispatching', '尚书省派单');
    const steps = normalizeSteps(plan.steps, maxSteps, ministryIds);
    if (!steps.length) throw new Error('中书方案没有可执行的六部差事');
    if (review.unresolved && review.unresolved.length) {
      const note = `\n\n【门下保留意见，办差时注意规避】\n${review.unresolved.map((item, i) => `${i + 1}. ${item}`).join('\n')}`;
      steps.forEach(step => { step.instruction += note; });
    }
    edict.steps = steps;
    runtime.saveEdict(edict);
    emit('派单', { count: steps.length, ministries: [...new Set(steps.map(step => step.ministry))] });

    let stepCap = maxSteps;
    await executeSteps(steps, 0, 'executing', stepCap);

    let verdict = await recheck(plan, steps);
    edict.fixRounds = 0;
    while (verdict.verdict === 'reject' && edict.fixRounds < maxFixRounds) {
      edict.fixRounds += 1;
      const round = edict.fixRounds;
      runtime.message(edict, { from: '门下省', to: '中书省', kind: '补救', title: `第 ${round} 轮自我修复`, summary: verdict.issues.join('；') });
      stage('fixing', `中书省拟补救差事（第 ${round} 轮）`);
      const fix = await runtime.call(
        edict,
        'zhongshu',
        fixPrompt(edict, verdict.issues, summarizeResults(steps), { ministries, maxSteps: 4 }),
        `03-fix-r${round}.md`,
        { kind: '拟旨', from: '门下省', title: `第 ${round} 轮补救` },
      );
      checkAborted();
      const fixPlan = fix.ok && !fix.handedOff ? extractJson(fix.output) : null;
      const fixSteps = normalizeSteps(fixPlan && fixPlan.steps, 4, ministryIds, steps.length + 1)
        .map(step => ({ ...step, title: `补救 · ${step.title}` }));
      if (!fixSteps.length) {
        emit('补救', { round, note: '中书未拟出可执行的补救差事' });
        break;
      }
      const from = steps.length;
      steps.push(...fixSteps);
      stepCap += fixSteps.length + 1;
      runtime.saveEdict(edict);
      await executeSteps(steps, from, 'fixing', stepCap);
      verdict = await recheck(plan, steps);
    }

    stage('memorial', '尚书省汇总上奏');
    runtime.writeArtifact(edict, '06-memorial.md', buildMemorial(edict, plan, review, steps, runtime));
    runtime.message(edict, { from: '尚书省', to: '皇帝', kind: '上奏', title: '奏折', summary: String(plan.summary || '').slice(0, 300) });

    if (autonomous && verdict.verdict === 'approve') {
      edict.status = 'done';
      edict.stage = 'done';
      edict.note = edict.fixRounds ? `自治：自我修复 ${edict.fixRounds} 轮后复核通过，已自动归档` : '自治：复核通过，已自动归档';
      emit('自动批红', { fixRounds: edict.fixRounds });
    } else {
      edict.status = 'awaiting-approval';
      edict.stage = 'awaiting-approval';
      edict.note = autonomous
        ? `自治：${maxFixRounds ? `自我修复 ${edict.fixRounds} 轮后` : ''}复核仍未通过（${verdict.verdict || '未知'}），请皇帝裁决`
        : '奏折已上呈，等待批红';
      emit('上奏', { steps: steps.length });
    }
    runtime.saveEdict(edict);
    return edict;
  } catch (error) {
    // 终态会覆盖 stage，先记下停在哪一步，界面上的流程条要用
    edict.haltedAt = edict.stage;
    if (signal && signal.aborted) {
      // 叫停/驳回：由这里统一落盘终态。index 那边若直接改磁盘上的副本，会被本流程手里的这份覆盖掉。
      const reason = signal.reason && typeof signal.reason === 'object' ? signal.reason : {};
      edict.status = reason.status || 'cancelled';
      edict.stage = edict.status;
      edict.note = String(reason.note || '皇帝叫停');
      emit(reason.event || '叫停', { note: edict.note });
      return edict;
    }
    edict.status = 'failed';
    edict.stage = 'failed';
    edict.error = String(error && error.message ? error.message : error);
    emit('失败', { error: edict.error });
    runtime.saveEdict(edict);
    return edict;
  }
}
