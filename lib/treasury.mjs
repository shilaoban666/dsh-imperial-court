// 国库：每一次调用花了多少 token、多少钱、缓存省了多少，哪些花在了被封驳的草稿、失败的重试上（废料）。
// 数据来自 CLI 自己报的用量（Claude Code 的 stream-json、Codex 的 --json）；报不出来的按字数估算并标明「估算」。
import fs from 'node:fs';
import path from 'node:path';

const MAX_LEDGER = 5000;

/**
 * 示例价格（美元 / 百万 token）。各家价格常变，国库页可以改；Claude Code 自己报 total_cost_usd 时以它为准。
 * 键按模型名前缀匹配（最长者胜），找不到用 default。
 */
export const DEFAULT_PRICES = {
  default: { input: 1.25, cacheRead: 0.125, cacheWrite: 1.25, output: 10 },
  opus: { input: 5, cacheRead: 0.5, cacheWrite: 6.25, output: 25 },
  sonnet: { input: 3, cacheRead: 0.3, cacheWrite: 3.75, output: 15 },
  haiku: { input: 1, cacheRead: 0.1, cacheWrite: 1.25, output: 5 },
  'gpt-5': { input: 1.25, cacheRead: 0.125, cacheWrite: 1.25, output: 10 },
  o3: { input: 2, cacheRead: 0.5, cacheWrite: 2, output: 8 },
  deepseek: { input: 0.28, cacheRead: 0.028, cacheWrite: 0.28, output: 0.42 },
  // DSH 本体没指定模型时按它的默认模型（DeepSeek）计价
  dsh: { input: 0.28, cacheRead: 0.028, cacheWrite: 0.28, output: 0.42 },
};

export function priceOf(model, prices = DEFAULT_PRICES) {
  const name = String(model || '').toLowerCase();
  const key = Object.keys(prices).filter(item => item !== 'default' && name.startsWith(item.toLowerCase()))
    .sort((a, b) => b.length - a.length)[0];
  return prices[key] || prices.default || DEFAULT_PRICES.default;
}

/** 中英混排的粗略 token 数：汉字约 1 token / 字，其余约 4 字符 / token */
export function estimateTokens(text) {
  const value = String(text || '');
  const cjk = (value.match(/[㐀-鿿豈-﫿]/g) || []).length;
  return Math.ceil(cjk + (value.length - cjk) / 4);
}

export function costOf(usage, model, prices) {
  const p = priceOf(model, prices);
  return ((usage.input || 0) * p.input + (usage.cacheRead || 0) * p.cacheRead
    + (usage.cacheWrite || 0) * p.cacheWrite + (usage.output || 0) * p.output) / 1e6;
}

/** 缓存省下的钱：读缓存的 token 若按全价输入要多花多少 */
export function savedOf(usage, model, prices) {
  const p = priceOf(model, prices);
  return ((usage.cacheRead || 0) * Math.max(0, p.input - p.cacheRead)) / 1e6;
}

const parseLines = raw => String(raw || '').split(/\r?\n/).map(line => {
  const text = line.trim();
  if (!text.startsWith('{')) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}).filter(Boolean);

/**
 * 把 CLI 的结构化输出拆成：正文、用量、会话 id。
 * format: 'claude-stream'（claude -p --output-format stream-json --verbose）
 *       | 'codex-json'（codex exec --json）| 'text'（不解析，按字数估算）
 * @returns {{ text, usage: { input, output, cacheRead, cacheWrite, costUsd, estimated }, sessionId }}
 */
export function parseOutput(format, raw, prompt = '') {
  const estimate = text => ({
    input: estimateTokens(prompt), output: estimateTokens(text), cacheRead: 0, cacheWrite: 0, costUsd: null, estimated: true,
  });
  if (format === 'claude-stream') {
    const events = parseLines(raw);
    if (!events.length) return { text: String(raw || ''), usage: estimate(raw), sessionId: '' };
    let sessionId = '';
    const texts = [];
    let result = null;
    for (const event of events) {
      if (event.session_id) sessionId = event.session_id;
      if (event.type === 'assistant' && event.message && Array.isArray(event.message.content)) {
        for (const block of event.message.content) if (block && block.type === 'text' && block.text) texts.push(block.text);
      }
      if (event.type === 'result') result = event;
    }
    const text = result && typeof result.result === 'string' ? result.result : texts.join('\n');
    if (!result || !result.usage) return { text, usage: estimate(text), sessionId };
    const u = result.usage;
    return {
      text,
      sessionId,
      usage: {
        input: Number(u.input_tokens) || 0,
        output: Number(u.output_tokens) || 0,
        cacheRead: Number(u.cache_read_input_tokens) || 0,
        cacheWrite: Number(u.cache_creation_input_tokens) || 0,
        costUsd: Number.isFinite(Number(result.total_cost_usd)) ? Number(result.total_cost_usd) : null,
        estimated: false,
      },
      isError: result.is_error === true,
    };
  }
  if (format === 'codex-json') {
    const events = parseLines(raw);
    if (!events.length) return { text: String(raw || ''), usage: estimate(raw), sessionId: '' };
    let sessionId = '';
    let text = '';
    let usage = null;
    for (const event of events) {
      const msg = event.msg || event;
      if (event.thread_id) sessionId = event.thread_id;
      if (msg.session_id) sessionId = msg.session_id;
      // 新格式：item.completed / agent_message；老格式：msg.type === 'agent_message'
      if (event.type === 'item.completed' && event.item && (event.item.type === 'agent_message' || event.item.item_type === 'assistant_message')) {
        text = event.item.text || text;
      }
      if (msg.type === 'agent_message' && msg.message) text = msg.message;
      const u = (event.type === 'turn.completed' && event.usage) || (msg.type === 'token_count' && (msg.info?.total_token_usage || msg));
      if (u && (u.input_tokens !== undefined || u.output_tokens !== undefined)) {
        const cached = Number(u.cached_input_tokens) || 0;
        usage = {
          // OpenAI 的 input_tokens 含缓存部分，拆开记
          input: Math.max(0, (Number(u.input_tokens) || 0) - cached),
          output: Number(u.output_tokens) || 0,
          cacheRead: cached,
          cacheWrite: 0,
          costUsd: null,
          estimated: false,
        };
      }
    }
    return { text: text || events.map(event => event.item?.text || '').filter(Boolean).join('\n'), usage: usage || estimate(text), sessionId };
  }
  if (format === 'dsh-json') {
    // dsh headless --json：session 开头、final 收尾，每一步的用量在 status/step_end 里（输入不含缓存部分）。
    // 中间可能夹着 DSH 自己的日志行（如「[llm-deepseek-account] model listing…」），parseLines 会跳过
    const events = parseLines(raw);
    if (!events.length) return { text: String(raw || ''), usage: estimate(raw), sessionId: '' };
    let sessionId = '';
    let final = null;
    let failed = '';
    const texts = [];
    const sum = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    let counted = false;
    for (const event of events) {
      if (event.type === 'session' && event.sessionId) sessionId = event.sessionId;
      if (event.type === 'text' && event.text) texts.push(event.text);
      if (event.type === 'final') final = String(event.text || '');
      if (event.type === 'error') failed = String(event.message || event.code || 'error');
      if (event.type === 'status' && event.phase === 'turn_end' && event.reason && event.reason.kind && event.reason.kind !== 'completed') {
        failed = failed || `turn ended: ${event.reason.kind}${event.reason.message ? ` (${event.reason.message})` : ''}`;
      }
      if (event.type === 'status' && event.phase === 'step_end' && event.usage) {
        counted = true;
        sum.input += Number(event.usage.inputTokens) || 0;
        sum.output += Number(event.usage.outputTokens) || 0;
        sum.cacheRead += Number(event.usage.cacheReadTokens) || 0;
        sum.cacheWrite += Number(event.usage.cacheWriteTokens) || 0;
      }
    }
    const text = final !== null && final !== '' ? final : texts.join('\n');
    return {
      text: failed && !text ? failed : text,
      sessionId,
      usage: counted ? { ...sum, costUsd: null, estimated: false } : estimate(text),
      isError: Boolean(failed),
    };
  }
  return { text: String(raw || ''), usage: estimate(raw), sessionId: '' };
}

/** 流式输出里给值房看的那条尾巴：结构化输出只留正文与工具动作 */
export function tailLine(format, line) {
  if (format !== 'claude-stream' && format !== 'codex-json' && format !== 'dsh-json') return line;
  const [event] = parseLines(line);
  if (!event) return '';
  if (format === 'dsh-json') {
    // final 与最后一条 text 内容相同，只取 text，免得值房里出现两遍
    if (event.type === 'text') return event.text || '';
    if (event.type === 'tool_call') {
      const input = event.input || {};
      const detail = input.command || input.path || input.file_path || '';
      return `▸ ${event.tool || 'tool'}${detail ? ` ${String(detail).slice(0, 160)}` : ''}`;
    }
    return '';
  }
  if (format === 'claude-stream') {
    if (event.type === 'assistant' && event.message && Array.isArray(event.message.content)) {
      return event.message.content.map(block => (block.type === 'text' ? block.text
        : block.type === 'tool_use' ? `▸ ${block.name}${block.input && (block.input.command || block.input.file_path) ? ` ${block.input.command || block.input.file_path}` : ''}` : '')).filter(Boolean).join('\n');
    }
    return '';
  }
  const item = event.item || {};
  if (item.type === 'agent_message' || item.type === 'reasoning') return item.text || '';
  if (item.type === 'command_execution') return `▸ ${item.command || ''}`;
  if (item.type === 'file_change') return `▸ edit ${(item.changes || []).map(change => change.path).join(', ')}`;
  return '';
}

const dayOf = ts => new Date(ts).toISOString().slice(0, 10);
const monthOf = ts => new Date(ts).toISOString().slice(0, 7);

export function createTreasury(root) {
  const file = path.join(root, 'ledger.json');
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    data = { version: 1, entries: [] };
  }
  if (!Array.isArray(data.entries)) data.entries = [];
  const save = () => {
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data), 'utf8');
    fs.renameSync(tmp, file);
  };

  /** 一次调用入账（同 id 覆盖：收尾时会回填它最终算不算废料） */
  function record(entry) {
    const index = data.entries.findIndex(item => item.id === entry.id);
    if (index >= 0) data.entries[index] = { ...data.entries[index], ...entry };
    else data.entries.push(entry);
    if (data.entries.length > MAX_LEDGER) data.entries.splice(0, data.entries.length - MAX_LEDGER);
    save();
  }

  /** 收尾：给一份奏折的每次调用标上用途（used / vetoed / failed / retried / discarded） */
  function settle(edictId, outcomes) {
    let changed = false;
    for (const entry of data.entries) {
      if (entry.edictId === edictId && outcomes[entry.id] && entry.outcome !== outcomes[entry.id]) {
        entry.outcome = outcomes[entry.id];
        changed = true;
      }
    }
    if (changed) save();
  }

  const spentOf = filter => data.entries.filter(filter).reduce((sum, entry) => sum + (entry.costUsd || 0), 0);
  const spentByEdict = edictId => spentOf(entry => entry.edictId === edictId);
  const spentThisMonth = () => {
    const month = monthOf(Date.now());
    return spentOf(entry => monthOf(entry.at) === month);
  };

  /** 历史上每类调用平均花多少：下旨前的估价用 */
  function averageCost(kind) {
    const list = data.entries.filter(entry => entry.kind === kind && entry.costUsd).slice(-50);
    if (!list.length) return null;
    return list.reduce((sum, entry) => sum + entry.costUsd, 0) / list.length;
  }

  function stats() {
    const entries = data.entries;
    const totals = { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0, savedUsd: 0, wasteUsd: 0, estimatedCalls: 0 };
    const byRole = {};
    const byAgent = {};
    const byDay = {};
    const byEdict = {};
    const waste = {};
    const today = dayOf(Date.now());
    const month = monthOf(Date.now());
    let todayUsd = 0;
    let monthUsd = 0;
    for (const entry of entries) {
      totals.calls += 1;
      totals.input += entry.input || 0;
      totals.output += entry.output || 0;
      totals.cacheRead += entry.cacheRead || 0;
      totals.cacheWrite += entry.cacheWrite || 0;
      totals.costUsd += entry.costUsd || 0;
      totals.savedUsd += entry.savedUsd || 0;
      if (entry.estimated) totals.estimatedCalls += 1;
      const wasted = entry.outcome && entry.outcome !== 'used';
      if (wasted) {
        totals.wasteUsd += entry.costUsd || 0;
        waste[entry.outcome] = (waste[entry.outcome] || 0) + (entry.costUsd || 0);
      }
      const bump = (table, key) => {
        const bucket = table[key] || (table[key] = { calls: 0, tokens: 0, costUsd: 0, cacheRead: 0 });
        bucket.calls += 1;
        bucket.tokens += (entry.input || 0) + (entry.output || 0) + (entry.cacheRead || 0) + (entry.cacheWrite || 0);
        bucket.costUsd += entry.costUsd || 0;
        bucket.cacheRead += entry.cacheRead || 0;
      };
      bump(byRole, entry.roleId || '?');
      bump(byAgent, entry.agentName || entry.agentId || '?');
      bump(byDay, dayOf(entry.at));
      const edict = byEdict[entry.edictId] || (byEdict[entry.edictId] = { edictId: entry.edictId, brief: entry.brief || '', calls: 0, costUsd: 0, wasteUsd: 0 });
      edict.calls += 1;
      edict.costUsd += entry.costUsd || 0;
      if (wasted) edict.wasteUsd += entry.costUsd || 0;
      if (dayOf(entry.at) === today) todayUsd += entry.costUsd || 0;
      if (monthOf(entry.at) === month) monthUsd += entry.costUsd || 0;
    }
    const promptTokens = totals.input + totals.cacheRead + totals.cacheWrite;
    const days = [];
    for (let i = 13; i >= 0; i -= 1) {
      const key = dayOf(Date.now() - i * 86400000);
      days.push({ day: key, ...(byDay[key] || { calls: 0, tokens: 0, costUsd: 0, cacheRead: 0 }) });
    }
    return {
      totals,
      todayUsd,
      monthUsd,
      cacheHitRate: promptTokens ? totals.cacheRead / promptTokens : 0,
      wasteRate: totals.costUsd ? totals.wasteUsd / totals.costUsd : 0,
      waste,
      byRole,
      byAgent,
      days,
      topEdicts: Object.values(byEdict).sort((a, b) => b.costUsd - a.costUsd).slice(0, 8),
      recent: entries.slice(-30).reverse(),
    };
  }

  return { file, record, settle, spentByEdict, spentThisMonth, averageCost, stats, entries: () => data.entries };
}
