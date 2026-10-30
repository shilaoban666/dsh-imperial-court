// 成效：同样这些活，用三省六部和「一个工具单干」相比，快了多少、交到你手上的东西好了多少。
// 只用已经记下的数据（每次调用的起止时间、公文往来、复核结论），不调模型、不花钱。
//
//   单干对照  同一批办差调用（六部执行、重办）由一个工具一件件做：耗时 = 这些调用的时长之和；
//             没有封驳、巡查、复核，问题会原样交到你手上，所以「交到你手上前合格率」= 一次就办对的比例。
//   三省六部  办差调用并行，耗时按调用区间的并集（墙钟时间）算；另付审议成本（拟旨、封驳、巡查、复核）。
//             合格率 = 最后通过复核（或你批红）的比例：拦下的问题已经在你看到之前补好了。
//
// 「返工省下的时间」是估算：每拦下一个问题，按一次办差的平均时长算你少返工一次。界面上明说是估算。

const EXEC_KINDS = new Set(['order', 'retry']);
const REVIEW_KINDS = new Set(['draft', 'submit', 'audit', 'inspect']);
// 在你看到之前被拦下的问题：门下封驳、御史弹劾、锦衣卫督办与看守、复核不过后的补救
export const CATCH_KINDS = ['veto', 'impeach', 'admonish', 'guard', 'remedy'];
const SETTLED = new Set(['done', 'awaiting-approval', 'failed', 'rejected', 'cancelled']);

const durationOf = call => Math.max(0, (call.endedAt || 0) - (call.startedAt || 0));

/** 区间并集的总长：并行办的几件差事只算一次墙钟时间 */
export function unionMs(intervals) {
  const sorted = intervals.filter(([start, end]) => end > start).sort((a, b) => a[0] - b[0]);
  let total = 0;
  let current = null;
  for (const [start, end] of sorted) {
    if (!current || start > current[1]) {
      if (current) total += current[1] - current[0];
      current = [start, end];
    } else if (end > current[1]) current[1] = end;
  }
  if (current) total += current[1] - current[0];
  return total;
}

/** 一份奏折的成效 */
export function edictImpact(edict) {
  const calls = (edict.calls || []).filter(call => call.endedAt && call.roleId !== 'historian');
  const exec = calls.filter(call => EXEC_KINDS.has(call.kind));
  const review = calls.filter(call => REVIEW_KINDS.has(call.kind));
  const soloMs = exec.reduce((sum, call) => sum + durationOf(call), 0);
  const execWallMs = unionMs(exec.map(call => [call.startedAt, call.endedAt]));
  const reviewMs = unionMs(review.map(call => [call.startedAt, call.endedAt]));
  const catches = {};
  for (const kind of CATCH_KINDS) catches[kind] = 0;
  for (const message of edict.messages || []) if (message.kind in catches) catches[message.kind] += 1;
  const caught = CATCH_KINDS.reduce((sum, kind) => sum + catches[kind], 0);
  const drafter = calls.find(call => call.roleId === 'zhongshu');
  const reviewer = calls.find(call => call.roleId === 'menxia' && call.kind === 'submit');
  const recheck = edict.recheck && edict.recheck.verdict;
  // 交到你手上前合格：复核通过，或你批红了；办砸、被驳回、叫停的不算
  const passed = edict.status === 'done' || (edict.status === 'awaiting-approval' && recheck !== 'reject');
  return {
    id: edict.id,
    brief: String(edict.brief || '').slice(0, 80),
    status: edict.status,
    mode: edict.mode || 'standard',
    at: edict.createdAt || 0,
    soloMs,
    execWallMs,
    reviewMs,
    parallelSavedMs: Math.max(0, soloMs - execWallMs),
    execCalls: exec.length,
    catches,
    caught,
    // 跨家审议：拟旨与封驳出自两家工具（急递没有审议，记 null）
    crossCheck: drafter && reviewer ? drafter.agentId !== reviewer.agentId : null,
    audited: calls.some(call => call.kind === 'audit' || call.kind === 'inspect'),
    passed,
    // 单干时也合格：没被拦下任何问题、最后也通过了
    firstPass: passed && caught === 0,
    costUsd: calls.reduce((sum, call) => sum + (call.costUsd || 0), 0),
    reviewCostUsd: review.reduce((sum, call) => sum + (call.costUsd || 0), 0),
    savedUsd: calls.reduce((sum, call) => sum + (call.savedUsd || 0), 0),
  };
}

const ratio = (a, b) => (b ? a / b : null);

/** 全部奏折的成效：与单干相比快了多少、合格率高了多少、拦下了哪些问题 */
export function impactOf(edicts = [], { recent = 12 } = {}) {
  const rows = edicts.filter(edict => SETTLED.has(edict.status) && (edict.calls || []).length).map(edictImpact)
    .sort((a, b) => b.at - a.at);
  const sum = key => rows.reduce((total, row) => total + (row[key] || 0), 0);
  const soloMs = sum('soloMs');
  const execWallMs = sum('execWallMs');
  const reviewMs = sum('reviewMs');
  const parallelSavedMs = sum('parallelSavedMs');
  const execCalls = sum('execCalls');
  const catches = {};
  for (const kind of CATCH_KINDS) catches[kind] = rows.reduce((total, row) => total + row.catches[kind], 0);
  const caught = sum('caught');
  const avgExecMs = execCalls ? soloMs / execCalls : 0;
  const reworkSavedMs = Math.round(caught * avgExecMs);
  const reviewable = rows.filter(row => row.crossCheck !== null);
  const passed = rows.filter(row => row.passed).length;
  const firstPass = rows.filter(row => row.firstPass).length;
  const withCatches = rows.filter(row => row.caught > 0);
  const passRate = ratio(passed, rows.length);
  const firstPassRate = ratio(firstPass, rows.length);
  const crossRate = ratio(reviewable.filter(row => row.crossCheck).length, reviewable.length);
  const auditRate = ratio(rows.filter(row => row.audited).length, rows.length);
  const rescueRate = withCatches.length ? ratio(withCatches.filter(row => row.passed).length, withCatches.length) : null;
  // 把关分：交叉审议、逐件巡查/复核、最终合格、被拦下的问题救回来的比例（没拦下过就不计这一项）
  const parts = [[crossRate, 0.3], [auditRate, 0.2], [passRate, 0.3], [rescueRate, 0.2]].filter(([value]) => value !== null);
  const weight = parts.reduce((total, [, w]) => total + w, 0);
  const qualityScore = weight ? Math.round((parts.reduce((total, [value, w]) => total + value * w, 0) / weight) * 100) : null;
  return {
    count: rows.length,
    time: {
      soloMs,
      execWallMs,
      reviewMs,
      parallelSavedMs,
      reworkSavedMs,
      netSavedMs: parallelSavedMs + reworkSavedMs - reviewMs,
      // 执行阶段快了多少：单干耗时 / 并行耗时
      speedup: execWallMs ? soloMs / execWallMs : null,
    },
    quality: {
      passRate,
      firstPassRate,
      upliftPts: passRate !== null && firstPassRate !== null ? Math.round((passRate - firstPassRate) * 100) : null,
      crossRate,
      auditRate,
      rescueRate,
      score: qualityScore,
    },
    catches,
    caught,
    money: { costUsd: sum('costUsd'), reviewCostUsd: sum('reviewCostUsd'), savedUsd: sum('savedUsd') },
    recent: rows.slice(0, recent),
  };
}
