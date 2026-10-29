// 实录：仿 LLM Wiki 的长期记忆。不是一堆零散片段，而是一套人能读、能改、能追溯的 markdown 页：
//   wiki/index.md            目录（每次写入都重建）
//   wiki/log.md              只追加的编年（ingest / edit / lint 都记一笔）
//   wiki/projects/<slug>.md  每个工作目录一页：事实（怎么构建、怎么测）、约定、坑
//   wiki/offices/<role>.md   每个岗位一页：它常被封驳 / 弹劾 / 办砸的地方
// 每条记录带出处（奏折编号）与可信度：✓ 已批红验证、? 未验证、✗ 被驳回。被驳回的奏折不产出「事实」。
// 召回借鉴 dsh-memory：📌 置顶的先放，其余按新近，整体受字数预算约束，超出的只报条数。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { tokens } from './annals.mjs';

export const SECTIONS = ['facts', 'conventions', 'pitfalls'];
const HEADINGS = {
  zh: { facts: '事实', conventions: '约定', pitfalls: '坑' },
  en: { facts: 'Facts', conventions: 'Conventions', pitfalls: 'Pitfalls' },
};
const HEADING_TO_SECTION = {
  事实: 'facts', 约定: 'conventions', 坑: 'pitfalls', Facts: 'facts', Conventions: 'conventions', Pitfalls: 'pitfalls',
};
const MAX_PER_SECTION = 15;
const STALE_DAYS = 90;
// 一条记录：- 📌 文本 〔edict-…, edict-… · ✓ · 2026-10-29〕
const ENTRY_RE = /^-\s+(📌\s*)?(.*?)\s*〔([^〕]*)〕\s*$/;

export const slugOf = workspace => {
  const base = path.basename(path.resolve(String(workspace || 'workspace'))).toLowerCase().replace(/[^a-z0-9一-鿿-]+/g, '-').replace(/^-+|-+$/g, '') || 'workspace';
  const hash = crypto.createHash('sha1').update(path.resolve(String(workspace || '')).toLowerCase()).digest('hex').slice(0, 6);
  return `${base}-${hash}`;
};

function similar(a, b) {
  const x = tokens(a);
  const y = tokens(b);
  if (!x.size || !y.size) return 0;
  let shared = 0;
  for (const item of x) if (y.has(item)) shared += 1;
  return shared / Math.min(x.size, y.size);
}

/** 解析一页：frontmatter + 三段条目 + 段外的自由文字（用户手写的说明原样保留） */
export function parsePage(text) {
  const source = String(text || '');
  const meta = {};
  let body = source;
  const fm = source.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    body = source.slice(fm[0].length);
    for (const line of fm[1].split('\n')) {
      const match = line.match(/^(\w+):\s*(.*)$/);
      if (match) meta[match[1]] = match[2];
    }
  }
  const sections = { facts: [], conventions: [], pitfalls: [] };
  const notes = [];
  let current = null;
  for (const line of body.split('\n')) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      current = HEADING_TO_SECTION[heading[1]] || null;
      if (!current) notes.push(line);
      continue;
    }
    if (current) {
      const entry = line.match(ENTRY_RE);
      if (entry) {
        const [sourcesText, mark = '?', date = ''] = entry[3].split('·').map(part => part.trim());
        sections[current].push({
          pinned: Boolean(entry[1]),
          text: entry[2],
          sources: sourcesText ? sourcesText.split(/[,，]\s*/).filter(Boolean) : [],
          mark: mark || '?',
          date,
        });
        continue;
      }
      if (/^-\s+\S/.test(line)) {
        // 用户手写、没带出处的条目：当作置顶的人工事实
        sections[current].push({ pinned: true, text: line.replace(/^-\s+(📌\s*)?/, ''), sources: ['manual'], mark: '✓', date: '' });
        continue;
      }
      if (line.trim()) notes.push(line);
      continue;
    }
    if (line.trim() && !/^#\s/.test(line)) notes.push(line);
  }
  return { meta, sections, notes };
}

export function renderPage(page, locale = page.meta && page.meta.lang) {
  const h = HEADINGS[locale === 'en' ? 'en' : 'zh'];
  const meta = { ...page.meta, updated: new Date().toISOString().slice(0, 10) };
  const lines = ['---', ...Object.entries(meta).map(([key, value]) => `${key}: ${value}`), '---', `# ${meta.title || ''}`, ''];
  if (page.notes && page.notes.length) lines.push(...page.notes, '');
  for (const section of SECTIONS) {
    lines.push(`## ${h[section]}`);
    for (const entry of page.sections[section]) {
      lines.push(`- ${entry.pinned ? '📌 ' : ''}${entry.text} 〔${entry.sources.join(', ')} · ${entry.mark}${entry.date ? ` · ${entry.date}` : ''}〕`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function createWiki(root) {
  const dir = path.join(root, 'wiki');
  fs.mkdirSync(path.join(dir, 'projects'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'offices'), { recursive: true });
  const logFile = path.join(dir, 'log.md');
  if (!fs.existsSync(logFile)) fs.writeFileSync(logFile, '# log\n\n', 'utf8');

  const resolve = rel => {
    const file = path.resolve(dir, String(rel || ''));
    if (!file.startsWith(dir + path.sep) || !file.endsWith('.md')) throw new Error('invalid wiki path');
    return file;
  };
  const read = rel => {
    try {
      return fs.readFileSync(resolve(rel), 'utf8');
    } catch {
      return '';
    }
  };
  const write = (rel, text) => {
    const file = resolve(rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, text, 'utf8');
    fs.renameSync(tmp, file);
  };
  const log = (action, detail) => {
    fs.appendFileSync(logFile, `- ${new Date().toISOString().replace('T', ' ').slice(0, 16)} · ${action} · ${String(detail).replace(/\n/g, ' ').slice(0, 300)}\n`, 'utf8');
  };

  const projectPath = workspace => `projects/${slugOf(workspace)}.md`;
  const officePath = roleId => `offices/${roleId}.md`;

  function loadPage(rel, defaults) {
    const text = read(rel);
    const page = text ? parsePage(text) : { meta: {}, sections: { facts: [], conventions: [], pitfalls: [] }, notes: [] };
    page.meta = { ...defaults, ...page.meta };
    return page;
  }

  /** 往一页里并入条目：相似的不重复记，只补出处；被驳回过的条目降级 */
  function merge(page, section, items) {
    const today = new Date().toISOString().slice(0, 10);
    let added = 0;
    for (const item of items) {
      const text = String(item.text || '').replace(/\s+/g, ' ').trim().slice(0, 280);
      if (!text) continue;
      const list = page.sections[section];
      const twin = list.find(entry => similar(entry.text, text) >= 0.6);
      if (twin) {
        if (item.source && !twin.sources.includes(item.source)) twin.sources.push(item.source);
        if (item.mark === '✓' && twin.mark !== '✗') twin.mark = '✓';
        twin.date = today;
        continue;
      }
      list.push({ pinned: false, text, sources: item.source ? [item.source] : [], mark: item.mark || '?', date: today });
      added += 1;
    }
    return added;
  }

  /** 体检：去重、按置顶与新近保留每段前 15 条、标出陈旧条目、剔除只来自被驳回奏折的事实 */
  function lintPage(page, rejected = new Set()) {
    const issues = [];
    const cutoff = Date.now() - STALE_DAYS * 86400000;
    for (const section of SECTIONS) {
      const seen = [];
      const kept = [];
      for (const entry of page.sections[section]) {
        if (seen.some(text => similar(text, entry.text) >= 0.8)) { issues.push(`dup: ${entry.text}`); continue; }
        if (section !== 'pitfalls' && entry.sources.length && entry.sources.every(id => rejected.has(id))) {
          issues.push(`rejected: ${entry.text}`);
          continue;
        }
        if (entry.date && Date.parse(entry.date) < cutoff && !entry.pinned && !entry.text.startsWith('(stale)')) {
          entry.text = `(stale) ${entry.text}`;
          issues.push(`stale: ${entry.text}`);
        }
        seen.push(entry.text);
        kept.push(entry);
      }
      kept.sort((a, b) => Number(b.pinned) - Number(a.pinned) || String(b.date).localeCompare(String(a.date)));
      if (kept.length > MAX_PER_SECTION) issues.push(`trimmed ${kept.length - MAX_PER_SECTION} in ${section}`);
      page.sections[section] = kept.slice(0, MAX_PER_SECTION);
    }
    return issues;
  }

  function list() {
    const out = [];
    for (const group of ['projects', 'offices']) {
      for (const name of fs.readdirSync(path.join(dir, group))) {
        if (!name.endsWith('.md')) continue;
        const rel = `${group}/${name}`;
        const page = parsePage(read(rel));
        const count = SECTIONS.reduce((sum, section) => sum + page.sections[section].length, 0);
        const verified = SECTIONS.reduce((sum, section) => sum + page.sections[section].filter(entry => entry.mark === '✓').length, 0);
        out.push({ path: rel, group, title: page.meta.title || name, workspace: page.meta.workspace || '', updated: page.meta.updated || '', count, verified });
      }
    }
    return out.sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
  }

  function rebuildIndex() {
    const pages = list();
    const lines = ['# index', ''];
    for (const group of ['projects', 'offices']) {
      lines.push(`## ${group}`);
      for (const page of pages.filter(item => item.group === group)) {
        lines.push(`- [${page.title}](${page.path}) · ${page.count} entries · ${page.verified} verified · ${page.updated}`);
      }
      lines.push('');
    }
    write('index.md', lines.join('\n'));
  }

  /**
   * 录入一份奏折（确定式部分）：门下封驳 → 中书岗位页；办砸 / 被御史弹劾 → 该部岗位页；
   * 复核不过与皇帝驳回 → 项目页的「坑」；史官提炼的事实 → 项目页（未批红前标 ?）。
   */
  function ingest(edict, { facts = [], rejectNote = '', roleTitle = id => id } = {}) {
    const locale = edict.locale === 'en' ? 'en' : 'zh';
    const source = edict.id;
    const sealed = edict.status === 'done';
    const rejected = edict.status === 'rejected';
    const projectRel = projectPath(edict.workspace);
    const project = loadPage(projectRel, { title: path.basename(edict.workspace || '') || 'workspace', type: 'project', workspace: edict.workspace, lang: locale });
    let added = 0;
    if (!rejected) {
      for (const section of SECTIONS) {
        added += merge(project, section, facts.filter(item => (item.kind || 'facts') === section).map(item => ({ text: item.text, source, mark: sealed ? '✓' : '?' })));
      }
    }
    const pitfalls = [];
    if (edict.recheck && edict.recheck.verdict === 'reject') pitfalls.push(...(edict.recheck.issues || []));
    if (rejectNote) pitfalls.push(rejectNote);
    added += merge(project, 'pitfalls', pitfalls.map(text => ({ text, source, mark: '✓' })));
    lintPage(project);
    write(projectRel, renderPage(project, locale));

    const touchOffice = (roleId, items) => {
      if (!items.length) return;
      const rel = officePath(roleId);
      const page = loadPage(rel, { title: roleTitle(roleId), type: 'office', role: roleId, lang: locale });
      added += merge(page, 'pitfalls', items.map(text => ({ text, source, mark: '✓' })));
      lintPage(page);
      write(rel, renderPage(page, locale));
    };
    touchOffice('zhongshu', (edict.vetoes || []).flatMap(round => round.issues || []).slice(0, 6));
    const byMinistry = {};
    for (const step of edict.steps || []) {
      const notes = [...(step.impeachments || [])];
      if (step.status === 'failed') notes.push(`${step.title}: ${String(step.summary || '').split('\n').find(Boolean) || 'failed'}`);
      if (notes.length) (byMinistry[step.ministry] = byMinistry[step.ministry] || []).push(...notes);
    }
    for (const [roleId, items] of Object.entries(byMinistry)) touchOffice(roleId, items.slice(0, 6));

    rebuildIndex();
    log('ingest', `${source} [${edict.status}] +${added} · ${edict.brief}`);
    return { added, project: projectRel };
  }

  /** 批红后把这份奏折贡献的 ? 升级成 ✓；驳回则把它独有的事实剔除 */
  function settle(edictId, outcome) {
    for (const page of list()) {
      const parsed = parsePage(read(page.path));
      let changed = false;
      for (const section of SECTIONS) {
        for (const entry of parsed.sections[section]) {
          if (!entry.sources.includes(edictId)) continue;
          if (outcome === 'done' && entry.mark === '?') { entry.mark = '✓'; changed = true; }
          if (outcome === 'rejected' && section !== 'pitfalls' && entry.mark !== '✓') { entry.mark = '✗'; changed = true; }
        }
      }
      if (changed) {
        lintPage(parsed, outcome === 'rejected' ? new Set([edictId]) : new Set());
        write(page.path, renderPage(parsed));
      }
    }
    log('settle', `${edictId} → ${outcome}`);
    rebuildIndex();
  }

  /**
   * 召回：这个工作目录的项目页 + 中书 / 门下 / 相关部的岗位页，按预算拼成一段。
   * 📌 与 ✓ 先放，✗ 不放；超出预算的只报条数（dsh-memory 的做法）。
   * @returns {{ text, used: string[], omitted: number }}
   */
  function recall(workspace, roleIds = [], budget = 2400) {
    const pages = [{ rel: projectPath(workspace), label: 'project' }, ...roleIds.map(id => ({ rel: officePath(id), label: id }))];
    const blocks = [];
    const used = [];
    let size = 0;
    let omitted = 0;
    for (const { rel, label } of pages) {
      const text = read(rel);
      if (!text) continue;
      const page = parsePage(text);
      const entries = SECTIONS.flatMap(section => page.sections[section].filter(entry => entry.mark !== '✗').map(entry => ({ ...entry, section })))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || Number(b.mark === '✓') - Number(a.mark === '✓') || String(b.date).localeCompare(String(a.date)));
      const lines = [];
      for (const entry of entries) {
        const line = `- [${label}/${entry.section}] ${entry.text} (${entry.mark}${entry.sources[0] ? ` ${entry.sources[0]}` : ''})`;
        if (size + line.length > budget) { omitted += 1; continue; }
        size += line.length;
        lines.push(line);
      }
      if (lines.length) {
        blocks.push(...lines);
        used.push(rel);
      }
    }
    if (omitted) blocks.push(`- … ${omitted} more`);
    return { text: blocks.join('\n'), used, omitted };
  }

  function lintAll(rejected = new Set()) {
    const issues = [];
    for (const page of list()) {
      const parsed = parsePage(read(page.path));
      const found = lintPage(parsed, rejected);
      if (found.length) {
        write(page.path, renderPage(parsed));
        issues.push(...found.map(item => `${page.path}: ${item}`));
      }
    }
    rebuildIndex();
    log('lint', `${issues.length} issues`);
    return issues;
  }

  function savePage(rel, text) {
    write(rel, String(text || ''));
    rebuildIndex();
    log('edit', rel);
  }

  function readLog(limit = 200) {
    return read('log.md').split('\n').filter(line => line.startsWith('- ')).slice(-limit).reverse();
  }

  return { dir, list, read, savePage, ingest, settle, recall, lintAll, readLog, projectPath, officePath, rebuildIndex };
}
