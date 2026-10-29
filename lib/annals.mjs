// 史馆：跨奏折的记忆。每份奏折办完留下「教训」（门下封驳了什么、复核卡在哪、哪个部办砸了、皇帝为何驳回），
// 下次遇到相似的圣意，拟旨与审议时把相关的几条带上，同样的错误不再犯第二次。
// 同时统计门下封驳率、各部成败，防止门下省形同虚设。
import fs from 'node:fs';
import path from 'node:path';
import { roleTitle, normalizeLocale } from './i18n.mjs';

const MAX_ENTRIES = 80;
const PREFIX = {
  zh: { veto: '门下封驳', audit: '复核未过', failure: '办砸', rejected: '皇帝驳回', success: '成功先例' },
  en: { veto: 'Vetoed', audit: 'Failed audit', failure: 'Failed', rejected: 'Rejected by Caesar', success: 'Precedent' },
};

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/** 相似度用的词元：中日韩按相邻两字，拉丁文按单词 */
export function tokens(text) {
  const out = new Set();
  const source = String(text || '').toLowerCase();
  const cjk = source.replace(/[^㐀-鿿]+/g, ' ').split(' ').filter(Boolean);
  for (const run of cjk) {
    if (run.length === 1) out.add(run);
    for (let i = 0; i < run.length - 1; i += 1) out.add(run.slice(i, i + 2));
  }
  for (const word of source.match(/[a-z0-9_.-]{3,}/g) || []) out.add(word);
  return out;
}

function similarity(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const item of a) if (b.has(item)) shared += 1;
  return shared / Math.sqrt(a.size * b.size);
}

const clip = (text, n) => {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length > n ? `${value.slice(0, n)}…` : value;
};

/** 从一份办完的奏折里提炼教训 */
export function lessonsOf(edict, extra = {}) {
  const locale = normalizeLocale(edict.locale);
  const p = PREFIX[locale];
  const lessons = [];
  const seen = new Set();
  const add = (kind, text) => {
    const value = clip(text, 220);
    if (!value || seen.has(value)) return;
    seen.add(value);
    lessons.push({ kind, text: `${p[kind]}: ${value}` });
  };
  for (const round of edict.vetoes || []) for (const issue of round.issues || []) add('veto', issue);
  if (edict.recheck && edict.recheck.verdict === 'reject') for (const issue of edict.recheck.issues || []) add('audit', issue);
  for (const step of edict.steps || []) {
    if (step.status !== 'failed') continue;
    add('failure', `${roleTitle(locale, step.ministry)} · ${step.title} — ${String(step.summary || '').split('\n').find(Boolean) || ''}`);
  }
  if (extra.rejectNote) add('rejected', extra.rejectNote);
  if (!lessons.length && (edict.status === 'done' || edict.status === 'awaiting-approval') && edict.plan) {
    const titles = (edict.steps || []).map(step => `${roleTitle(locale, step.ministry)}:${step.title}`).join(' → ');
    add('success', `${edict.plan.summary || ''} [${titles}]`);
  }
  return lessons.slice(0, 8);
}

export function createAnnals(root) {
  const file = path.join(root, 'annals.json');
  const data = readJson(file, null) || { version: 1, entries: [] };
  if (!Array.isArray(data.entries)) data.entries = [];

  const save = () => {
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  };

  /** 记一份奏折（同一份奏折再记会覆盖，批红 / 驳回时更新结果） */
  function record(edict, extra = {}) {
    const previous = data.entries.find(item => item.id === edict.id);
    const keepRejected = previous ? previous.lessons.filter(item => item.kind === 'rejected').map(item => item.text.replace(/^[^:]+:\s*/, '')) : [];
    const entry = {
      id: edict.id,
      at: edict.createdAt || Date.now(),
      updatedAt: Date.now(),
      brief: clip(edict.brief, 300),
      workspace: edict.workspace || '',
      locale: normalizeLocale(edict.locale),
      outcome: edict.status,
      reviewRounds: Number(edict.rounds) || 0,
      vetoes: (edict.vetoes || []).length,
      fixRounds: Number(edict.fixRounds) || 0,
      steps: (edict.steps || []).map(step => ({ ministry: step.ministry, status: step.status })),
      lessons: lessonsOf(edict, { rejectNote: extra.rejectNote || keepRejected[0] || '' }),
    };
    data.entries = [entry, ...data.entries.filter(item => item.id !== edict.id)]
      .sort((a, b) => b.at - a.at)
      .slice(0, MAX_ENTRIES);
    save();
    return entry;
  }

  function remove(id) {
    const before = data.entries.length;
    data.entries = data.entries.filter(item => item.id !== id);
    if (data.entries.length !== before) save();
    return before !== data.entries.length;
  }

  function clear() {
    data.entries = [];
    save();
  }

  /**
   * 找与这道圣意相似的往事，取其中的教训。
   * @returns {Array<{ edictId, text }>}
   */
  function recall(brief, workspace, limit = 6) {
    const query = tokens(brief);
    const now = Date.now();
    const scored = data.entries
      .filter(item => item.lessons && item.lessons.length)
      .map(item => {
        const ageDays = (now - (item.updatedAt || item.at)) / 86400000;
        const sameWorkspace = workspace && item.workspace && path.resolve(item.workspace) === path.resolve(workspace);
        const base = similarity(query, tokens(item.brief)) + (sameWorkspace ? 0.2 : 0);
        return { item, score: base * (1 - Math.min(ageDays, 90) / 180) };
      })
      .filter(entry => entry.score >= 0.18)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    const out = [];
    for (const { item } of scored) {
      for (const lesson of item.lessons) {
        if (out.length >= limit) break;
        out.push({ edictId: item.id, text: `「${clip(item.brief, 40)}」${lesson.text}` });
      }
    }
    return out;
  }

  /** 门下封驳率、首轮准奏率、各部成败 */
  function stats() {
    const entries = data.entries;
    const outcomes = {};
    const ministries = {};
    let reviewRounds = 0;
    let vetoes = 0;
    let firstPass = 0;
    let fixRounds = 0;
    for (const item of entries) {
      outcomes[item.outcome] = (outcomes[item.outcome] || 0) + 1;
      reviewRounds += item.reviewRounds;
      vetoes += item.vetoes;
      fixRounds += item.fixRounds;
      if (item.reviewRounds && !item.vetoes) firstPass += 1;
      for (const step of item.steps || []) {
        const bucket = ministries[step.ministry] || (ministries[step.ministry] = { total: 0, done: 0, failed: 0 });
        bucket.total += 1;
        if (step.status === 'done') bucket.done += 1;
        if (step.status === 'failed') bucket.failed += 1;
      }
    }
    const reviewed = entries.filter(item => item.reviewRounds).length;
    return {
      total: entries.length,
      outcomes,
      reviewRounds,
      vetoes,
      vetoRate: reviewRounds ? vetoes / reviewRounds : 0,
      firstPassRate: reviewed ? firstPass / reviewed : 0,
      fixRounds,
      ministries,
      // 五份以上奏折门下一次都没驳过：审议多半在走过场
      rubberStamp: reviewed >= 5 && vetoes === 0,
    };
  }

  return { file, list: () => data.entries, record, remove, clear, recall, stats };
}
