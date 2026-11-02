// 现代风格（一人公司）：每条文案、每个提示词在现代说法下都不能再出现古代 / 古罗马的官名与术语；
// 古代风格保持原样；用户写的内容（需求、方案、回报）不被改写。
import test from 'node:test';
import assert from 'node:assert/strict';
import { TEXT, tr, roleTitle, roleDuty, normalizeLocale, langOf, isModern, voiceOf, ROLE_IDS } from '../lib/i18n.mjs';
import { modernize } from '../lib/modern.mjs';
import {
  draftPrompt, reviewPrompt, taskPrompt, recheckPrompt, fixPrompt, inspectPrompt, historianPrompt,
  redraftDelta, rereviewDelta, retryDelta, pressureOf, ministriesOf,
} from '../lib/prompts.mjs';

const ANCIENT_ZH = /圣旨|圣意|奏折|奏章|回奏|上奏|批红|封驳|朝堂|朝会|朝局|朝制|朝规|朝廷|皇帝|中书|门下|尚书|六部|吏部|户部|礼部|兵部|刑部|工部|弹劾|移文|国库|史馆|实录|本纪|群臣|值房|急递|常朝|丞相|差事|拟旨|御史|锦衣卫|朕|下旨|钦定|前朝|准奏/;
const ANCIENT_EN = /\b(Caesar|Consul|Tribune|Senate|[Dd]ecrees?|[Mm]agistrates?|Praetor|Legate|Quaestor|Pontifex|Aedile|Censor|[Aa]nnals|[Ii]mpeach\w*|[Ee]dicts?|Aerarium|Cohort|Officium)\b/;

const leftover = (text, lang) => {
  const match = String(text).match(lang === 'en' ? ANCIENT_EN : ANCIENT_ZH);
  return match ? match[0] : null;
};

test('locale 带风格：zh / en / zh-m / en-m', () => {
  assert.equal(normalizeLocale('zh'), 'zh');
  assert.equal(normalizeLocale('en-GB'), 'en');
  assert.equal(normalizeLocale('zh-m'), 'zh-m');
  assert.equal(normalizeLocale('EN-modern'), 'en-m');
  assert.equal(langOf('en-m'), 'en');
  assert.equal(isModern('zh-m'), true);
  assert.equal(isModern('zh'), false);
  assert.equal(voiceOf('zh', 'modern'), 'zh-m');
  assert.equal(voiceOf('en', 'ancient'), 'en');
});

test('现代风格：每条宿主文案都换成了现代说法', () => {
  for (const lang of ['zh', 'en']) {
    for (const key of Object.keys(TEXT[lang])) {
      const text = tr(`${lang}-m`, key);
      assert.equal(leftover(text, lang), null, `${lang}-m ${key}: ${text}`);
    }
  }
});

test('古代风格不受影响', () => {
  assert.equal(tr('zh', 'stageReview', { n: 1 }), '门下省封驳（第 1 轮）');
  assert.equal(tr('en', 'stageReview', { n: 1 }), 'Tribune reviewing (round 1)');
  assert.equal(roleTitle('zh', 'menxia'), '门下省');
  assert.equal(roleTitle('en', 'menxia'), 'Tribune');
});

test('现代职位与职掌', () => {
  assert.equal(roleTitle('zh-m', 'zhongshu'), '首席战略官');
  assert.equal(roleTitle('en-m', 'menxia'), 'Chief Risk Officer');
  assert.equal(roleTitle('zh-m', 'war'), '研发部');
  for (const id of ROLE_IDS) {
    assert.ok(roleTitle('zh-m', id) && roleTitle('en-m', id), id);
    // 默认职掌跟着风格换；用户自己改过的原样保留
    assert.equal(roleDuty('zh-m', id, roleDuty('zh', id, '')), roleDuty('zh-m', id, ''));
  }
  assert.equal(roleDuty('zh-m', 'war', '只写 Rust'), '只写 Rust');
});

test('占位符不被翻译，汉字与英文词之间留空格', () => {
  assert.equal(tr('en-m', 'errNoReject', { regime: 'Solo' }).includes('"Solo"'), true);
  assert.equal(modernize('{regime} 之下', 'zh'), '{regime} 之下');
  assert.equal(modernize('请皇帝裁决', 'zh'), '请 CEO 裁决');
  assert.equal(modernize('六部各部', 'zh'), '各部门各部门');
});

const edict = {
  id: 'edict-x', brief: '<BRIEF>', workspace: '/w', criteria: '<CRITERIA>', attachments: [{ path: '/a.txt' }],
  workflow: [{ ministry: 'war', title: '<STEP>' }], git: { branch: 'court/x' },
  recalled: [{ text: '<LESSON>' }], chronicle: '<CHRONICLE>',
};
const step = { seq: 1, ministry: 'war', title: '<TITLE>', instruction: '<INSTR>', deliverable: '<DELIV>' };

function allPrompts(locale) {
  const ministries = ministriesOf({}, locale);
  const role = { title: roleTitle(locale, 'war'), duty: roleDuty(locale, 'war', '') };
  const e = { ...edict, locale };
  return {
    draft: draftPrompt(e, ['<ISSUE>'], { ministries, autonomous: true, locale }),
    draftPlain: draftPrompt({ ...e, workflow: [] }, [], { ministries, autonomous: false, locale }),
    review: reviewPrompt(e, '<PLAN>', { autonomous: true, locale }),
    task: taskPrompt(e, step, role, {
      previous: [{ roleTitle: role.title, title: '<PREV>', status: 'done', summary: '<SUM>' }], retryError: '<ERR>',
      substitute: { original: '<ORIG>' }, autonomous: true, locale, ministries, pressure: pressureOf(2, locale).text,
    }),
    recheck: recheckPrompt(e, '<RESULTS>', { acceptance: ['<ACC>'], autonomous: true, locale }),
    fix: fixPrompt(e, ['<ISSUE>'], '<RESULTS>', { ministries, locale }),
    inspect: inspectPrompt(e, step, '<REPORT>', ['a.txt'], { locale }),
    historian: historianPrompt(e, '<MEMORIAL>', '<PAGE>', { locale }),
    redraft: redraftDelta(['<ISSUE>'], locale),
    rereview: rereviewDelta('<PLAN>', locale),
    retry: retryDelta('<ERR>', pressureOf(3, locale).text, locale),
    gentle: pressureOf(1, locale, 'gentle').text,
  };
}

test('现代风格：每个提示词里都没有古代官名，用户内容原样保留', () => {
  for (const lang of ['zh', 'en']) {
    for (const [name, text] of Object.entries(allPrompts(`${lang}-m`))) {
      assert.equal(leftover(text, lang), null, `${lang}-m ${name}:\n${text}`);
    }
    const draft = allPrompts(`${lang}-m`).draft;
    for (const marker of ['<BRIEF>', '<CRITERIA>', '<ISSUE>', '<LESSON>', '<CHRONICLE>']) assert.ok(draft.includes(marker), marker);
  }
});

test('提示词里用户写的古代词不被改写', () => {
  const text = draftPrompt({ ...edict, brief: '写一首关于皇帝批红奏折的诗', locale: 'zh-m' }, [], { locale: 'zh-m', ministries: ministriesOf({}, 'zh-m') });
  assert.ok(text.includes('写一首关于皇帝批红奏折的诗'));
  assert.ok(text.includes('首席战略官'));
});

test('古代风格的提示词逐字不变', () => {
  const zh = allPrompts('zh');
  assert.ok(zh.draft.startsWith('你是中书省中书舍人'));
  const en = allPrompts('en');
  assert.ok(/Consul/.test(en.draft));
});
