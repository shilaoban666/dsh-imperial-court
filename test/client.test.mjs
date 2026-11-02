// 浏览器半在 Node 里加载（假的 window / document / React），核对界面文案：
//   现代风格（一人公司）下每条文案都不再出现古代 / 古罗马的官名；古代风格不受影响；词汇表与宿主一致。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { GLOSSARY } from '../lib/modern.mjs';

const CLIENT = fileURLToPath(new URL('../client.js', import.meta.url));

/** 加载 client.js，拿到 factory 返回的 __test */
export function loadClient() {
  let factory = null;
  const noop = () => {};
  const element = () => ({ style: {}, setAttribute: noop, appendChild: noop, remove: noop, classList: { add: noop, remove: noop } });
  const storage = new Map();
  const window = {
    __ModuleLoader__: { load: ({ factory: f }) => { factory = f; } },
    addEventListener: noop, removeEventListener: noop, matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
  };
  const context = {
    window,
    document: { createElement: element, getElementById: () => null, head: { appendChild: noop }, documentElement: element(), body: element(), addEventListener: noop, removeEventListener: noop, querySelector: () => null },
    localStorage: { getItem: key => (storage.has(key) ? storage.get(key) : null), setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    navigator: { language: 'zh-CN' },
    fetch: () => Promise.reject(new Error('no host in tests')),
    setTimeout, clearTimeout, setInterval, clearInterval, console, URL, Intl, Date, Math, JSON, Promise, Map, Set, WeakMap, RegExp, Error, Number, String, Object, Array, Symbol, encodeURIComponent, decodeURIComponent,
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(CLIENT, 'utf8'), context, { filename: 'client.js' });
  const hook = () => [null, noop];
  const React = {
    createElement: () => ({}), Fragment: 'Fragment',
    useState: init => [typeof init === 'function' ? init() : init, noop], useEffect: noop, useLayoutEffect: noop,
    useMemo: fn => fn(), useCallback: fn => fn, useRef: value => ({ current: value }), useReducer: hook,
  };
  const mod = factory(name => (name === 'react' ? React : {}));
  return mod.__test;
}

const ANCIENT_ZH = /圣旨|圣意|奏折|奏章|回奏|上奏|批红|封驳|朝堂|朝会|朝局|朝制|朝规|朝廷|皇帝|中书|门下|尚书|六部|吏部|户部|礼部|兵部|刑部|工部|弹劾|移文|国库|史馆|实录|本纪|群臣|值房|急递|常朝|丞相|差事|拟旨|御史|锦衣卫|朕|下旨|钦定|前朝|准奏/;
const ANCIENT_EN = /\b(Caesar|Consul|Tribune|Senate|[Dd]ecrees?|[Mm]agistrates?|Praetor|Legate|Quaestor|Pontifex|Aedile|Censor|[Aa]nnals|[Ii]mpeach\w*|[Ee]dicts?|Aerarium|Cohort|Officium)\b/;

test('client glossary is the same as the host one', () => {
  const api = loadClient();
  assert.deepEqual(JSON.parse(JSON.stringify(api.glossary.ZH)), GLOSSARY.zh);
  assert.deepEqual(JSON.parse(JSON.stringify(api.glossary.EN)), GLOSSARY.en);
});

test('modern style: every interface string speaks One-Person Company', () => {
  const api = loadClient();
  for (const lang of ['zh', 'en']) {
    api.set(lang, 'modern');
    const bad = [];
    for (const key of api.keys()) {
      const text = String(api.t(key));
      const hit = text.match(lang === 'en' ? ANCIENT_EN : ANCIENT_ZH);
      if (hit) bad.push(`${key}: ${text}`);
    }
    assert.deepEqual(bad, [], `${lang}-modern leftovers`);
    for (const status of ['queued', 'running', 'awaiting-approval', 'done', 'rejected']) assert.doesNotMatch(api.statusLabel(status), lang === 'en' ? ANCIENT_EN : ANCIENT_ZH);
    for (const kind of ['draft', 'veto', 'memorial', 'impeach', 'admonish', 'guard']) {
      assert.doesNotMatch(`${api.kindLabel(kind)} ${api.kindGloss(kind)}`, lang === 'en' ? ANCIENT_EN : ANCIENT_ZH, kind);
    }
    for (const id of ['emperor', 'zhongshu', 'menxia', 'war', 'jinyiwei']) assert.doesNotMatch(api.roleName(id), lang === 'en' ? ANCIENT_EN : ANCIENT_ZH, id);
  }
});

test('modern titles, and the ancient styles stay as they were', () => {
  const api = loadClient();
  api.set('zh', 'modern');
  assert.equal(api.roleName('menxia'), '首席风控官');
  assert.equal(api.regimeInfo('liangdang').name, '合伙人');
  assert.equal(api.statusLabel('awaiting-approval'), '待批准');
  api.set('en', 'modern');
  assert.equal(api.roleName('zhongshu'), 'Chief Strategy Officer');
  assert.equal(api.regimeInfo('jiuxi').name, 'Solo');
  api.set('zh', 'ancient');
  assert.equal(api.roleName('menxia'), '门下省');
  assert.equal(api.statusLabel('awaiting-approval'), '待批红');
  api.set('en', 'ancient');
  assert.equal(api.roleName('menxia'), 'Tribune');
});

test('the court is the default; office names carry a plain-language gloss, the modern skin needs none', () => {
  const api = loadClient();
  assert.equal(api.style(), 'ancient', 'a fresh browser opens the court');
  const ids = ['emperor', 'zhongshu', 'menxia', 'shangshu', 'personnel', 'revenue', 'rites', 'war', 'justice', 'works', 'jinyiwei', 'yushi', 'historian'];
  for (const lang of ['zh', 'en']) {
    api.set(lang, 'ancient');
    for (const id of ids) assert.ok(api.roleGloss(id), `${lang} ${id}`);
    api.set(lang, 'modern');
    for (const id of ids) assert.equal(api.roleGloss(id), '', `${lang}-modern ${id}`);
  }
  api.set('zh', 'ancient');
  assert.equal(api.roleGloss('menxia'), '审方案');
  assert.equal(api.roleGloss('门下省'), '审方案', 'old memorials store the Chinese title');
});
