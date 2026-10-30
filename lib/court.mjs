// 朝堂流程：中书拟旨 → 门下封驳 → 尚书派单 → 六部执行（按依赖并行，监察御史逐件巡查，锦衣卫督办）→ 门下复核 → 上奏待批红。
// 尚书省、锦衣卫由插件本身确定式完成，不额外消耗 token。
//
// 三种朝制（压编排税）：
//   express 急递    —— 不拟旨、不封驳、不复核，直接派给一个部，1 次调用起
//   standard 常朝   —— 完整流程；御史只做确定式巡查（产出在不在、回奏空不空）
//   grand 大朝会    —— 再加御史逐件调模型巡查，适合大活
//
// 审议是「失败即关闭」的：门下输出解析不了先重申格式再问一次，还解析不了就不放行。
// 同一岗位的后续轮次（重拟、再审、重办）续接上一轮会话，只发增量提示词。
// 人工类岗位（只有图形界面）在常规模式下会暂停等皇帝回填，回填或跳过后接着往下走。
//
// 丞相模式（edict.autonomous）：封驳到上限按最后一版执行；人工岗位由代办接手；
// 复核未达标则中书拟补救差事、六部补办，最多 maxFixRounds 轮；复核通过即自动归档。
import fs from 'node:fs';
import path from 'node:path';
import {
  ministriesOf, draftPrompt, reviewPrompt, taskPrompt, recheckPrompt, fixPrompt, extractJson, jsonReminder,
  pressureOf, lazySignal, inspectPrompt, redraftDelta, rereviewDelta, retryDelta,
} from './prompts.mjs';
import { tr, roleTitle } from './i18n.mjs';

const pad = number => String(number).padStart(2, '0');
const clampInt = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
};
// 办完了（不论成败）的差事：依赖它的差事可以开工了
const SETTLED = new Set(['done', 'failed', 'skipped', 'handed-off']);
// 移文最多额外占几件差事：防止各部互相转办把步数吃光
const HANDOFF_BUDGET = 3;

/**
 * 中书方案里的 steps → 尚书省的差事单。after 是方案里的步骤编号（从 1 起），换算成差事序号；
 * 没写 after 视为依赖上一步，钦定流程一律按顺序。
 */
export function normalizeSteps(raw, maxSteps, ministryIds, { firstSeq = 1, sequential = false, untitled = '' } = {}) {
  const list = Array.isArray(raw) ? raw : [];
  const steps = [];
  const seqOf = new Map();
  list.forEach((item, position) => {
    if (steps.length >= maxSteps || !item || typeof item !== 'object') return;
    const ministry = String(item.ministry || '').trim();
    if (!ministryIds.has(ministry)) return;
    const seq = firstSeq + steps.length;
    seqOf.set(position + 1, seq);
    let after;
    if (!sequential && Array.isArray(item.after)) {
      after = [...new Set(item.after.map(Number).filter(n => n >= 1 && n <= position && seqOf.has(n)).map(n => seqOf.get(n)))];
    } else {
      after = steps.length ? [seq - 1] : [];
    }
    steps.push({
      seq,
      ministry,
      title: String(item.title || '').slice(0, 120) || untitled,
      instruction: String(item.instruction || '').slice(0, 6000),
      deliverable: String(item.deliverable || '').slice(0, 500),
      after,
      status: 'pending',
      summary: '',
      depth: 0,
    });
  });
  return steps;
}

/** 模型可能输出 "Reject" / "驳回" / " approve "，统一成 approve | reject | 原值 */
export function normalizeVerdict(value) {
  const text = String(value || '').trim().toLowerCase();
  if (['reject', 'rejected', 'veto', 'impeach', '驳回', '封驳', '不通过', '弹劾'].includes(text)) return 'reject';
  if (['approve', 'approved', 'pass', 'passed', '准奏', '通过', '达标', '无误'].includes(text)) return 'approve';
  return text;
}

const validatePlan = plan => (plan && Array.isArray(plan.steps) ? plan : null);
const validateVerdict = value => {
  if (!value || typeof value !== 'object') return null;
  const verdict = normalizeVerdict(value.verdict);
  if (verdict !== 'approve' && verdict !== 'reject') return null;
  return {
    ...value,
    verdict,
    issues: (Array.isArray(value.issues) ? value.issues : Array.isArray(value.findings) ? value.findings : []).map(String).filter(Boolean),
    risks: Array.isArray(value.risks) ? value.risks.map(String).filter(Boolean) : [],
  };
};

/** 产出要求像不像一个路径：像才查它在不在（「说明改了哪些文件」这种就不查） */
export function deliverablePath(text) {
  const value = String(text || '').trim().replace(/^[`'"]|[`'"]$/g, '');
  if (!value || value.length > 200 || /\s/.test(value)) return '';
  if (!/[./\\]/.test(value)) return '';
  return value;
}

function buildMemorial(edict, plan, review, steps, locale) {
  const T = (key, vars) => tr(locale, key, vars);
  const recheck = edict.recheck || {};
  const lines = [];
  lines.push(T('memHeading'), '');
  lines.push(`- ${T('memId')}: ${edict.id}`);
  lines.push(`- ${T('memBrief')}: ${edict.brief}`);
  lines.push(`- ${T('memWorkspace')}: ${edict.workspace}`);
  if (edict.isolationNote) lines.push(`- ${T('memIsolation')}: ${edict.isolationNote}`);
  lines.push(`- ${T('memMode')}: ${edict.autonomous ? T('memAuto') : T('memNormal')} · ${T(`mode${edict.mode === 'express' ? 'Express' : edict.mode === 'grand' ? 'Grand' : 'Standard'}`)}`);
  if (review) {
    lines.push(`- ${T('memReview')}: ${review.verdict === 'approve' ? T('memApprove') : (review.verdict || T('memUnreviewed'))}`);
    if (Array.isArray(review.issues) && review.issues.length) lines.push(`- ${T('memReviewIssues')}: ${review.issues.join('; ')}`);
  }
  lines.push(`- ${T('memRecheck')}: ${recheck.verdict === 'approve' ? T('memRecheckOk') : recheck.verdict === 'reject' ? T('memRecheckBad') : (recheck.verdict || T('memUnchecked'))}`);
  if (Array.isArray(recheck.issues) && recheck.issues.length) lines.push(`- ${T('memRecheckIssues')}: ${recheck.issues.join('; ')}`);
  if (edict.fixRounds) lines.push(`- ${T('memFix')}: ${T('memFixRounds', { n: edict.fixRounds })}`);
  if (Array.isArray(edict.recalled) && edict.recalled.length) lines.push(`- ${T('memLessons')}: ${edict.recalled.length}`);
  lines.push('', T('memPlan'), plan.summary ? String(plan.summary) : T('memNoSummary'), '');
  for (const step of steps) {
    lines.push(`### ${step.seq}. ${roleTitle(locale, step.ministry)} · ${step.title}`);
    lines.push(`- ${T('memStatus')}: ${step.status}${step.retried ? T('memRetried') : ''}${step.agent ? `, ${T('memHandler')}: ${step.agent}` : ''}`);
    if (step.deliverable) lines.push(`- ${T('memDeliverable')}: ${step.deliverable}`);
    if (step.impeachments && step.impeachments.length) lines.push(`- ${roleTitle(locale, 'yushi')}: ${step.impeachments.join('; ')}`);
    if (step.summary) lines.push('', '```text', step.summary.slice(0, 2000), '```');
    lines.push('');
  }
  if (Array.isArray(plan.acceptance) && plan.acceptance.length) {
    lines.push(T('memAcceptance'));
    plan.acceptance.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
  }
  lines.push('', '---', edict.autonomous ? T('memFootAuto') : T('memFootNormal'));
  return lines.join('\n');
}

export async function runEdict(runtime, edictId) {
  const { store } = runtime;
  const edict = store.getEdict(edictId);
  if (!edict) throw new Error('edict not found');

  const locale = edict.locale || 'zh';
  const T = (key, vars) => tr(locale, key, vars);
  const emit = (type, data = {}) => runtime.emit(edict, type, data);
  const stage = (stageId, note) => runtime.setStage(edict, stageId, note);
  const rules = store.state.rules || {};
  const autonomous = edict.autonomous === true;
  const mode = edict.mode || 'standard';
  const maxRounds = clampInt(rules.maxReviewRounds, 1, 5, 3);
  const workflow = Array.isArray(edict.workflow) ? edict.workflow : [];
  // 钦定流程有几步就放几步，不受朝规里的步数上限约束（上限 12 在下旨时已截断）
  const maxSteps = Math.max(clampInt(rules.maxSteps, 1, 12, 8), workflow.length);
  const maxFixRounds = autonomous && mode !== 'express' ? clampInt(rules.maxFixRounds, 0, 3, 2) : 0;
  const parallel = clampInt(rules.parallel, 1, 4, 2);
  // 每件差事最多重办几次（锦衣卫督办）；丞相模式至少 1 次
  const maxRetries = Math.max(autonomous ? 1 : 0, clampInt(rules.maxRetries, 0, 3, 1));
  const pressureStyle = ['off', 'gentle', 'standard'].includes(rules.pressure) ? rules.pressure : 'standard';
  const ministries = ministriesOf(store.state.roles, locale);
  const ministryIds = new Set(ministries.map(item => item.id));
  const roleName = roleId => roleTitle(locale, roleId);
  const roleOf = roleId => {
    const ministry = ministries.find(item => item.id === roleId);
    return { ...runtime.role(roleId), title: roleName(roleId), duty: ministry ? ministry.duty : '' };
  };
  // 叫停/驳回/锦衣卫停朝会 abort 这个信号。每次 await 回来都要看一眼。
  const signal = runtime.signal(edict.id);
  const checkAborted = () => {
    if (signal && signal.aborted) throw new Error(T('errAborted'));
  };
  const mark = (result, outcome) => { if (result && result.callId) runtime.markCall(edict, result.callId, outcome); };

  const summarizeResults = steps => steps
    .map(step => `[${roleName(step.ministry)}] ${step.title}\n${T('memStatus')}: ${step.status}${step.deliverable ? `\n${T('memDeliverable')}: ${step.deliverable}` : ''}\n${(step.summary || '').slice(0, 1500)}`)
    .join('\n\n');

  /** 要 JSON 的调用：解析不了就（在同一会话里）重申格式再问一次 */
  async function callJson(roleId, promptText, artifactName, meta, validate) {
    let result = await runtime.call(edict, roleId, promptText, artifactName, meta);
    checkAborted();
    if (!result.ok || result.handedOff) return { result, parsed: null };
    const parsed = validate(extractJson(result.output));
    if (parsed) return { result, parsed };
    mark(result, 'retried');
    result = await runtime.call(
      edict, roleId, promptText + jsonReminder(locale), artifactName.replace(/\.md$/, '-retry.md'),
      { ...meta, title: meta.retryTitle || meta.title, deltaPrompt: jsonReminder(locale).trim() },
    );
    checkAborted();
    if (!result.ok || result.handedOff) return { result, parsed: null };
    return { result, parsed: validate(extractJson(result.output)) };
  }

  let stepCap = maxSteps + HANDOFF_BUDGET;

  /**
   * 监察御史巡查一件刚办完的差事。确定式检查（不耗 token）：回奏不能是空的、写明的产出路径要真存在；
   * 大朝会再调模型细看。返回发现的问题（空数组 = 无误）。
   */
  async function inspect(step, result) {
    const findings = [];
    if (!String(result.body || result.output || '').trim()) findings.push(T('inspNoChange'));
    const target = deliverablePath(step.deliverable);
    if (target) {
      const base = edict.execDir || edict.workspace;
      const full = path.isAbsolute(target) ? target : path.join(base, target);
      if (!fs.existsSync(full)) findings.push(T('inspMissing', { path: target }));
    }
    if (!findings.length && mode === 'grand' && runtime.canRun('yushi')) {
      stage('executing', T('stageInspect', { role: roleName(step.ministry), title: step.title }));
      const checked = await callJson(
        'yushi',
        inspectPrompt(edict, step, result.body || result.output, runtime.changedFiles(edict), { locale }),
        `04-exec/${pad(step.seq)}-${step.ministry}-inspect${step.attempt > 1 ? `-${step.attempt}` : ''}.md`,
        { kind: 'inspect', from: 'shangshu', title: step.title, parse: 'verdict', quietReport: true },
        validateVerdict,
      );
      if (checked.parsed && checked.parsed.verdict === 'reject') findings.push(...(checked.parsed.issues.length ? checked.parsed.issues : [T('verdictImpeach')]));
      else if (checked.parsed) {
        runtime.message(edict, { from: 'yushi', to: step.ministry, kind: 'inspect', title: step.title, summary: T('inspectPass'), artifact: checked.result.artifact, durationMs: checked.result.durationMs, model: checked.result.model });
      }
    }
    return findings;
  }

  /** 办一件差事：派单 → 巡查 →（不实 / 推脱 / 失败则锦衣卫督办重办）→（人工岗位等回填）→ 移文 */
  async function runStep(step, steps, phase) {
    const role = roleOf(step.ministry);
    step.status = 'running';
    runtime.saveEdict(edict);
    stage(phase, T(phase === 'fixing' ? 'stageFixExec' : 'stageExec', { role: role.title, title: step.title }));

    // 前序产出：已经办过的差事（含补救轮之前的），让本部知道上游做了什么、东西放在哪
    const previous = steps
      .filter(item => item !== step && SETTLED.has(item.status))
      .map(item => ({ roleTitle: roleName(item.ministry), title: item.title, status: item.status, deliverable: item.deliverable, summary: item.summary }));
    const artifactName = attempt => `04-exec/${pad(step.seq)}-${step.ministry}${attempt > 1 ? `-r${attempt}` : ''}.md`;
    const run = (attempt, retryError, pressure) => runtime.call(
      edict,
      step.ministry,
      ({ substitute }) => taskPrompt(edict, step, role, { previous, retryError, substitute, autonomous, locale, ministries, pressure }),
      artifactName(attempt),
      {
        kind: attempt > 1 ? 'retry' : 'order', from: 'shangshu', title: attempt > 1 ? T('titleRedo', { title: step.title }) : step.title,
        summary: attempt > 1 ? pressure.split('\n')[0] : step.instruction.slice(0, 300), execute: true, seq: step.seq,
        sessionKey: `step:${step.seq}`, deltaPrompt: attempt > 1 ? retryDelta(retryError, pressure, locale) : '',
      },
    );

    let result = null;
    let lastError = '';
    for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
      step.attempt = attempt;
      const level = attempt - 1;
      const pressure = level ? pressureOf(level, locale, pressureStyle).text : '';
      if (result) mark(result, 'retried');
      result = await run(attempt, lastError, pressure);
      checkAborted();
      if (result.handedOff) break;
      let problem = '';
      if (!result.ok) problem = result.error || 'failed';
      else {
        const shirk = lazySignal(result.body || result.output);
        const findings = await inspect(step, result);
        checkAborted();
        if (findings.length) {
          step.impeachments = [...(step.impeachments || []), ...findings].slice(-6);
          runtime.message(edict, {
            from: 'yushi', to: step.ministry, kind: 'impeach', title: T('titleImpeach', { title: step.title }), ok: false,
            summary: T('impeachSummary', { role: role.title, title: step.title, findings: findings.join('; ') }),
          });
          problem = findings.join('; ');
        } else if (shirk) problem = `${shirk}: ${String(result.body || result.output).slice(0, 400)}`;
        if (shirk && !findings.length) step.shirked = shirk;
      }
      if (!problem) break;
      lastError = problem;
      if (attempt <= maxRetries) {
        step.retried = true;
        const next = pressureOf(attempt, locale, pressureStyle);
        runtime.message(edict, {
          from: 'jinyiwei', to: step.ministry, kind: 'admonish', title: step.title, ok: false,
          summary: T('guardLazy', { role: role.title, signal: problem.slice(0, 120), level: attempt, label: next.label || '—' }),
        });
        emit('guard', { ministry: step.ministry, level: attempt });
      } else {
        result = { ...result, ok: false, error: problem };
      }
    }

    if (result.handedOff && !autonomous) {
      // 人工岗位：出了工单，等皇帝在奏折页回填（或跳过）再往下走
      step.status = 'awaiting-input';
      step.workOrder = result.workOrder || '';
      runtime.saveEdict(edict);
      stage(phase, T('stageAwait', { role: role.title, title: step.title }));
      const filled = await runtime.waitForFill(edict, step);
      checkAborted();
      step.status = filled.skipped ? 'skipped' : 'done';
      step.agent = T('filledAgent');
      step.summary = filled.skipped ? T('skipped') : String(filled.text || '').slice(0, 6000);
      if (!filled.skipped) {
        runtime.writeArtifact(edict, artifactName(1), `${T('filledHead', { role: role.title })}\n\n${filled.text}\n`);
      }
      runtime.message(edict, {
        from: 'emperor', to: step.ministry, kind: 'fill', title: step.title,
        summary: filled.skipped ? T('skipped') : T('filled', { text: String(filled.text).slice(0, 300) }),
        artifact: filled.skipped ? '' : artifactName(1),
      });
    } else if (result.handedOff) {
      step.status = 'handed-off';
      step.summary = T('workOrderAuto');
    } else {
      step.status = result.ok ? 'done' : 'failed';
      step.agent = result.agentName || '';
      step.summary = (result.body || result.output || result.error || '').slice(0, 6000);
      if (!result.ok) mark(result, 'failed');
    }
    runtime.saveEdict(edict);
    emit('task', { ministry: step.ministry, title: step.title, status: step.status });

    // 移文：某部在回奏里声明需要他部配合时，由尚书省转办一次（只允许转一层，避免互相踢皮球）
    const handoff = result.handoff;
    if (handoff && step.status === 'done' && (step.depth || 0) < 1 && handoff.to !== step.ministry) {
      const reason = handoff.reason || T('handoffReason');
      if (steps.length < stepCap) {
        steps.push({
          seq: steps.length + 1,
          ministry: handoff.to,
          title: T('titleReferral', { title: step.title }),
          instruction: T('referralInstruction', { from: role.title, to: roleName(handoff.to), title: step.title, reason }),
          deliverable: handoff.deliverable || '',
          after: [step.seq],
          status: 'pending',
          summary: '',
          depth: (step.depth || 0) + 1,
        });
        runtime.message(edict, { from: step.ministry, to: handoff.to, kind: 'referral', title: step.title, summary: reason });
      } else {
        // 步数满了：不悄悄丢掉，在往来里留一条告示，复核与补救时能看到
        runtime.message(edict, {
          from: 'shangshu', to: 'emperor', kind: 'notice', title: step.title, ok: false,
          summary: T('handoffDropped', { from: role.title, to: roleName(handoff.to), reason, cap: stepCap }),
        });
      }
      runtime.saveEdict(edict);
    }
  }

  /** 按依赖调度：依赖都办完的差事同时开工，最多 parallel 件并行；移文追加的差事一并办掉 */
  async function executeSteps(steps, phase) {
    const running = new Map();
    for (;;) {
      checkAborted();
      const settledSeqs = new Set(steps.filter(step => SETTLED.has(step.status)).map(step => step.seq));
      const known = new Set(steps.map(step => step.seq));
      const ready = steps.filter(step => step.status === 'pending' && !running.has(step.seq)
        && (step.after || []).every(seq => settledSeqs.has(seq) || !known.has(seq)));
      while (running.size < parallel && ready.length) {
        const step = ready.shift();
        const task = runStep(step, steps, phase);
        running.set(step.seq, task);
        task.then(() => running.delete(step.seq), () => running.delete(step.seq));
      }
      if (!running.size) {
        // 依赖永远满足不了的（理论上没有，after 只能指向更早的步骤）：按顺序硬办，不让朝会卡死
        const stuck = steps.find(step => step.status === 'pending');
        if (!stuck) break;
        stuck.after = [];
        continue;
      }
      await Promise.race(running.values());
    }
  }

  async function recheck(plan, steps) {
    stage('rechecking', T('stageRecheck'));
    const { result, parsed } = await callJson(
      'menxia',
      recheckPrompt(edict, summarizeResults(steps), { acceptance: Array.isArray(plan.acceptance) ? plan.acceptance.map(String) : [], autonomous, locale }),
      edict.fixRounds ? `05-recheck-r${edict.fixRounds + 1}.md` : '05-recheck.md',
      { kind: 'audit', from: 'shangshu', parse: 'verdict', sessionKey: 'menxia-audit' },
      validateVerdict,
    );
    const verdict = parsed
      || (result.ok && !result.handedOff
        ? { verdict: 'unknown', issues: [T('recheckUnparsable')] }
        : { verdict: 'skipped', issues: [result.error || result.note || T('recheckSkipped')] });
    edict.recheck = { verdict: verdict.verdict, issues: verdict.issues || [] };
    runtime.saveEdict(edict);
    return edict.recheck;
  }

  try {
    emit('open', { brief: edict.brief, workspace: edict.workspace, autonomous, mode });
    if (Array.isArray(edict.recalled) && edict.recalled.length) {
      runtime.message(edict, {
        from: 'shangshu', to: 'zhongshu', kind: 'notice', title: T('lessonsUsed', { n: edict.recalled.length }),
        summary: edict.recalled.map(item => item.text).join('\n').slice(0, 800),
      });
    }
    let plan = null;
    let review = null;
    let steps = [];
    edict.vetoes = [];

    if (mode === 'express') {
      // 急递：不拟旨、不封驳，一件差事直送一个部
      const ministry = ministryIds.has(edict.expressMinistry) ? edict.expressMinistry : 'war';
      plan = { summary: edict.brief.slice(0, 300), steps: [], acceptance: edict.criteria ? [edict.criteria] : [] };
      edict.plan = plan;
      steps = [{
        seq: 1, ministry, title: edict.brief.replace(/\s+/g, ' ').slice(0, 60), instruction: `${edict.brief}${edict.criteria ? `\n\n${edict.criteria}` : ''}`,
        deliverable: '', after: [], status: 'pending', summary: '', depth: 0,
      }];
      edict.steps = steps;
      runtime.message(edict, { from: 'shangshu', to: ministry, kind: 'dispatch', title: T('modeExpress'), summary: T('expressTo', { role: roleName(ministry) }) });
      stage('dispatching', T('expressTo', { role: roleName(ministry) }));
    } else {
      for (let round = 1; round <= maxRounds; round += 1) {
        edict.rounds = round;
        stage('drafting', T('stageDraft', { n: round }));
        const drafted = await callJson(
          'zhongshu',
          draftPrompt(edict, issues(edict), { ministries, autonomous, maxSteps, locale }),
          `01-draft-r${round}.md`,
          {
            kind: 'draft', from: 'emperor', title: T('titleDraft', { n: round }), summary: edict.brief.slice(0, 200), parse: 'plan',
            sessionKey: 'zhongshu', deltaPrompt: round > 1 ? redraftDelta(issues(edict), locale) : '',
          },
          validatePlan,
        );
        if (!drafted.result.ok || drafted.result.handedOff) {
          throw new Error(T('errDraft', { error: drafted.result.error || drafted.result.note || T('errNoCli') }));
        }
        if (!drafted.parsed) throw new Error(T('errPlanJson'));
        plan = drafted.parsed;
        edict.plan = plan;
        runtime.saveEdict(edict);

        stage('reviewing', T('stageReview', { n: round }));
        const planText = JSON.stringify(plan, null, 2);
        const reviewed = await callJson(
          'menxia',
          reviewPrompt(edict, planText, { autonomous, locale }),
          `02-review-r${round}.md`,
          {
            kind: 'submit', from: 'zhongshu', title: T('titleReview', { n: round }), retryTitle: T('titleReviewRetry', { n: round }), quietReport: true,
            sessionKey: 'menxia', deltaPrompt: round > 1 ? rereviewDelta(planText, locale) : '',
          },
          validateVerdict,
        );
        if (!reviewed.result.ok || reviewed.result.handedOff) {
          throw new Error(T('errReview', { error: reviewed.result.error || reviewed.result.note || T('errNoCli') }));
        }
        const reviewMeta = { artifact: reviewed.result.artifact, durationMs: reviewed.result.durationMs, model: reviewed.result.model };
        if (!reviewed.parsed) {
          // 失败即关闭：拿不到审议结论就不放行（常规模式直接停朝；丞相模式照办，但结果仍须过复核）
          if (!autonomous) {
            runtime.message(edict, { from: 'menxia', to: 'zhongshu', kind: 'veto', title: T('titleRound', { n: round }), ok: false, summary: T('reviewUnparsable'), ...reviewMeta });
            throw new Error(T('reviewUnparsable'));
          }
          review = { verdict: 'unknown', issues: [], risks: [], unresolved: [T('reviewUnparsableAuto')] };
          runtime.message(edict, { from: 'shangshu', to: 'zhongshu', kind: 'overrule', title: T('titleRound', { n: round }), summary: T('reviewUnparsableAuto'), ...reviewMeta });
          break;
        }
        review = reviewed.parsed;
        if (review.verdict === 'reject') {
          const vetoIssues = review.issues.length ? review.issues : [T('vetoNoReason')];
          edict.vetoes.push({ round, issues: vetoIssues });
          mark(drafted.result, 'vetoed');
          runtime.message(edict, { from: 'menxia', to: 'zhongshu', kind: 'veto', title: T('titleRound', { n: round }), summary: vetoIssues.join('; '), ...reviewMeta });
          if (round < maxRounds) continue;
          if (!autonomous) throw new Error(T('errVetoed', { n: maxRounds }));
          // 自治：不停朝等人，按最后一版执行，把门下没解决的意见交给各部自己规避
          review.unresolved = vetoIssues;
          runtime.message(edict, { from: 'shangshu', to: 'zhongshu', kind: 'overrule', title: T('titleOverrule', { n: maxRounds }), summary: T('overruleSummary') });
          break;
        }
        runtime.message(edict, { from: 'menxia', to: 'zhongshu', kind: 'assent', title: T('titleRound', { n: round }), summary: review.risks.join('; ').slice(0, 300), ...reviewMeta });
        break;
      }
      edict.review = review;
      runtime.saveEdict(edict);

      stage('dispatching', T('stageDispatch'));
      steps = normalizeSteps(plan.steps, maxSteps, ministryIds, { sequential: workflow.length > 0, untitled: T('untitled') });
      if (!steps.length) throw new Error(T('errNoSteps'));
      if (review.unresolved && review.unresolved.length) {
        const note = `\n\n${locale === 'en' ? '[Tribune’s outstanding objections: avoid these]' : '【门下保留意见，办差时注意规避】'}\n${review.unresolved.map((item, i) => `${i + 1}. ${item}`).join('\n')}`;
        steps.forEach(step => { step.instruction += note; });
      }
      edict.steps = steps;
      runtime.saveEdict(edict);
      const roots = steps.filter(step => !step.after.length).length;
      runtime.message(edict, {
        from: 'shangshu', to: 'ministries', kind: 'dispatch', title: T('dispatchSummary', { n: steps.length, list: '' }).replace(/[:：]\s*$/, ''),
        summary: `${steps.map(step => `${step.seq}. ${roleName(step.ministry)} · ${step.title}`).join('\n')}${roots > 1 && parallel > 1 ? `\n${T('parallelNote', { n: roots }).trim()}` : ''}`,
      });
    }
    emit('dispatch', { count: steps.length, ministries: [...new Set(steps.map(step => step.ministry))] });

    await executeSteps(steps, 'executing');

    let verdict;
    if (mode === 'express') {
      // 急递不调门下复核：以御史的确定式巡查与差事结果为准，最后由你批红
      const failed = steps.filter(step => step.status === 'failed');
      verdict = failed.length
        ? { verdict: 'reject', issues: failed.map(step => `${step.title}: ${String(step.summary).split('\n')[0]}`) }
        : { verdict: 'approve', issues: [] };
      edict.recheck = verdict;
    } else {
      verdict = await recheck(plan, steps);
    }
    edict.fixRounds = 0;
    while (verdict.verdict === 'reject' && edict.fixRounds < maxFixRounds) {
      edict.fixRounds += 1;
      const round = edict.fixRounds;
      runtime.message(edict, { from: 'menxia', to: 'zhongshu', kind: 'remedy', title: T('titleRemedy', { n: round }), summary: verdict.issues.join('; ') });
      stage('fixing', T('stageFixDraft', { n: round }));
      const fix = await callJson(
        'zhongshu',
        fixPrompt(edict, verdict.issues, summarizeResults(steps), { ministries, maxSteps: 4, locale }),
        `03-fix-r${round}.md`,
        { kind: 'draft', from: 'menxia', title: T('titleFix', { n: round }), parse: 'plan', sessionKey: 'zhongshu' },
        validatePlan,
      );
      const fixSteps = normalizeSteps(fix.parsed && fix.parsed.steps, 4, ministryIds, { firstSeq: steps.length + 1, untitled: T('untitled') })
        .map(step => ({ ...step, title: T('titleRemedyStep', { title: step.title }) }));
      if (!fixSteps.length) {
        emit('remedy', { round, note: T('remedyNone') });
        break;
      }
      steps.push(...fixSteps);
      stepCap += fixSteps.length + 1;
      runtime.saveEdict(edict);
      await executeSteps(steps, 'fixing');
      verdict = await recheck(plan, steps);
    }

    stage('memorial', T('stageMemorial'));
    const memorial = buildMemorial(edict, plan, review, steps, locale);
    runtime.writeArtifact(edict, '06-memorial.md', memorial);
    runtime.message(edict, { from: 'shangshu', to: 'emperor', kind: 'memorial', title: T('titleMemorial'), summary: String(plan.summary || '').slice(0, 300), artifact: '06-memorial.md' });
    // 史官把这份奏折里值得长期记住的写进实录（批红前标 ?，批红后转 ✓）
    await runtime.chronicle(edict, memorial);
    checkAborted();

    if (autonomous && verdict.verdict === 'approve') {
      edict.status = 'done';
      edict.stage = 'done';
      edict.note = edict.fixRounds ? T('noteAutoDoneFix', { n: edict.fixRounds }) : T('noteAutoDone');
      emit('autoApprove', { fixRounds: edict.fixRounds });
    } else {
      edict.status = 'awaiting-approval';
      edict.stage = 'awaiting-approval';
      edict.note = autonomous
        ? T('noteAutoStuck', { fix: maxFixRounds ? T('noteAutoStuckFix', { n: edict.fixRounds }) : '', verdict: verdict.verdict || '?' })
        : T('noteAwaiting');
      emit('memorial', { steps: steps.length });
    }
    runtime.saveEdict(edict);
    return edict;
  } catch (error) {
    // 终态会覆盖 stage，先记下停在哪一步，界面上的流程条要用
    edict.haltedAt = edict.stage;
    (edict.steps || []).forEach(step => { if (step.status === 'running' || step.status === 'awaiting-input') step.status = 'failed'; });
    if (signal && signal.aborted) {
      // 叫停/驳回/锦衣卫停朝：由这里统一落盘终态。index 那边若直接改磁盘上的副本，会被本流程手里的这份覆盖掉。
      const reason = signal.reason && typeof signal.reason === 'object' ? signal.reason : {};
      edict.status = reason.status || 'cancelled';
      edict.stage = edict.status;
      edict.note = String(reason.note || T('noteCancelled'));
      if (reason.status === 'failed') edict.error = edict.note;
      emit(reason.event || 'cancel', { note: edict.note });
      return edict;
    }
    edict.status = 'failed';
    edict.stage = 'failed';
    edict.error = String(error && error.message ? error.message : error);
    emit('fail', { error: edict.error });
    runtime.saveEdict(edict);
    return edict;
  }
}

/** 最近一轮封驳意见（重拟要逐条回应） */
function issues(edict) {
  const last = (edict.vetoes || [])[edict.vetoes.length - 1];
  return last ? last.issues : [];
}
