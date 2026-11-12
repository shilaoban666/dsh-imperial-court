// 丞相府：把「丞相模式」做成一个真正的 Router–Worker。
//
// 想法与 DeepSeek Harness 团队的 super-agent 设计一脉相承：人同时盯得住的会话只有三五个，瓶颈是人的注意力。
// 所以前面放一个常驻的「丞相」只管接活、分拣、排队、派发、汇总；真正动手的是一道道互相隔离的旨
// （每道一个 git worktree + 分支，就是 Worker）。丞相不拆解单个任务内部怎么做，那是中书省的事。
//
//   接活    一句话里写了几件互不相干的事 → 拆成几道旨（splitRequests）
//   分拣    每道旨走哪种朝制、急递归哪个部、急不急（triage；确定式，不耗 token）
//   排队    朝堂满了不再拒收，进候旨队列；同一个没隔离的目录也排队而不是报错
//   派发    有空位就按「急件优先、短活优先、先来先办」放行（pickNext）
//   汇总    只把要人出手的事报上来（digest）
//
// 本文件全是纯函数，队列的落盘与派发在 index.mjs。

const URGENT = /紧急|加急|十万火急|立刻|马上|尽快|线上故障|线上问题|事故|urgent|asap|hotfix|\bp0\b|outage|production (bug|issue|down)|right now/i;
const LOW = /不急|有空再|闲时|低优先|顺手|whenever|low priority|no rush|nice to have/i;

// 一行的开头像不像清单项：1. / 1、/ 1) /（1）/ ① / - / * / • / [ ] / 第一、
const ITEM = /^\s{0,3}(?:(?:\d{1,2}|[一二三四五六七八九十]{1,3})\s*[.、)）:：](?!\d)|[（(]\s*(?:\d{1,2}|[一二三四五六七八九十]{1,3})\s*[)）]|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫]|[-*•·]\s|\[[ xX]?\]\s?)\s*(.*)$/;

export const MAX_BATCH = 12;

/**
 * 把一段话拆成几件互不相干的差事。只认「清单」这一种写法（编号、短横、圆点、复选框），
 * 至少两条才拆；清单前面的话（「帮我做这几件事：」）当作共同的背景，拼到每一条前面。
 * 普通的一段话、带「然后 / 并且」的连贯需求不拆：那是一件事的几个步骤，归中书省去排。
 * @returns {string[]} 一条就是原文
 */
export function splitRequests(text, { max = MAX_BATCH } = {}) {
  const source = String(text || '').replace(/\r\n?/g, '\n').trim();
  if (!source) return [];
  const lines = source.split('\n');
  const preamble = [];
  const items = [];
  let fenced = false;
  for (const line of lines) {
    // 代码块里的短横、编号不是清单
    if (/^\s*```/.test(line)) fenced = !fenced;
    const match = fenced ? null : ITEM.exec(line);
    if (match && match[1].trim()) items.push([match[1].trim()]);
    else if (items.length) items[items.length - 1].push(line);
    else preamble.push(line);
  }
  if (items.length < 2) return [source];
  const context = preamble.join('\n').trim();
  // 背景太长说明这不是「几件事的清单」，而是一份带要点的长需求：不拆
  if (context.length > 400) return [source];
  const out = items.map(parts => parts.join('\n').trim()).filter(Boolean);
  // 每条都只有两三个字的清单多半是要点（「快」「稳」「省」），不是差事
  if (out.every(item => item.length < 4)) return [source];
  const merged = out.length > max ? [...out.slice(0, max - 1), out.slice(max - 1).join('\n')] : out;
  return merged.map(item => (context ? `${context}\n${item}` : item));
}

/** 急不急：2 急件 / 1 平常 / 0 不急。只看需求里的字眼，用户显式给的优先 */
export function priorityOf(brief, given) {
  if (given === 'high' || given === 2) return 2;
  if (given === 'low' || given === 0) return 0;
  if (given === 'normal' || given === 1) return 1;
  const text = String(brief || '');
  if (URGENT.test(text)) return 2;
  if (LOW.test(text)) return 0;
  return 1;
}

// 朝制越轻越先办（短作业优先：总等待时间最短）
const WEIGHT = { express: 0, standard: 1, grand: 2 };

/**
 * 分拣一条需求：走哪种朝制、急递归哪个部、急不急。chooseMode / routeMinistry 由调用方传入（它们在 index.mjs）。
 */
export function triage(brief, { chooseMode, routeMinistry, requested = 'auto', workflow = [], priority } = {}) {
  const chosen = chooseMode(requested, brief, workflow);
  return {
    mode: chosen.mode,
    reason: chosen.reason,
    ministry: chosen.mode === 'express' ? routeMinistry(brief) : '',
    priority: priorityOf(brief, priority),
  };
}

/** 候旨队列的次序：急件优先，同样急的短活优先，再按先来后到 */
export function orderQueue(queue) {
  return [...queue].sort((a, b) => (b.priority - a.priority)
    || ((WEIGHT[a.mode] ?? 1) - (WEIGHT[b.mode] ?? 1))
    || (a.at - b.at)
    || String(a.id).localeCompare(String(b.id)));
}

/**
 * 挑下一条能放行的：按次序找第一条不被挡住的。blocked(entry) 返回真表示此刻放不了
 * （比如它要改的目录正有一道没隔离的旨在办），跳过它看后面的，不让一条堵住整队。
 */
export function pickNext(queue, blocked = () => false) {
  return orderQueue(queue.filter(entry => entry.state === 'waiting')).find(entry => !blocked(entry)) || null;
}

/**
 * 丞相的汇总：只列要人出手的事，其余给个数。
 * @param {Array} edicts  store.listEdicts() 的摘要
 * @returns {{ needsYou: Array<{id, brief, kind, note}>, running: number, queued: number, doneToday: number, failedToday: number }}
 */
export function digest(edicts, queue = [], { now = Date.now(), activeIds = [] } = {}) {
  const active = new Set(activeIds);
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const needsYou = [];
  let doneToday = 0;
  let failedToday = 0;
  for (const item of edicts || []) {
    const today = (item.updatedAt || item.createdAt || 0) >= dayStart.getTime();
    if (item.status === 'awaiting-approval') needsYou.push({ id: item.id, brief: item.brief, kind: 'approve', note: item.note || '' });
    else if (item.status === 'awaiting-input') needsYou.push({ id: item.id, brief: item.brief, kind: 'input', note: item.note || '' });
    else if (item.status === 'failed' && !item.redoneAs && !active.has(item.id)) {
      // 办砸的只报当天的和被重启打断的，陈年旧账不反复打扰
      if (item.interrupted) needsYou.push({ id: item.id, brief: item.brief, kind: 'interrupted', note: item.note || '' });
      else if (today) needsYou.push({ id: item.id, brief: item.brief, kind: 'failed', note: item.note || '' });
      if (today) failedToday += 1;
    } else if (item.status === 'done' && today) doneToday += 1;
  }
  for (const entry of queue || []) {
    if (entry.state === 'refused') needsYou.push({ id: entry.id, brief: entry.brief, kind: 'refused', note: entry.error || '' });
  }
  return {
    needsYou,
    running: active.size,
    queued: (queue || []).filter(entry => entry.state === 'waiting').length,
    doneToday,
    failedToday,
  };
}
