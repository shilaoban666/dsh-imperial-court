// 现代风格「一人公司 / One-Person Company」：同一套编制与流程，换成大公司里人人都懂的职位与说法。
// 岗位 id 不变（zhongshu / menxia / war …），所以随时切换风格，旧奏折照常能看。
//
// 文案分两层：
//   1. 职位、状态、公司阶段这类有个性的词，写成明确的对照表（这里的 MODERN_ROLE_TEXT，以及客户端的几张表）；
//   2. 其余普通句子用词汇表 modernize() 一次性替换。替换是单遍的（所有词条合成一条正则），
//      所以「六部 → 各部门」之后不会再被「各部 → 各部门」改成「各部门门」。
// 提示词只替换模板里固定的文字（见 prompts.mjs 的 voiced 标签），用户写的需求、各部的回报原样保留。

export const MODERN_ROLE_TEXT = {
  zh: {
    emperor: { title: 'CEO' },
    ministries: { title: '各部门' },
    zhongshu: { title: '首席战略官', duty: '出方案、拆任务' },
    menxia: { title: '首席风控官', duty: '挑毛病，可一票否决' },
    shangshu: { title: '首席运营官', duty: '派活与汇总' },
    personnel: { title: 'IT 与行政部', duty: '账号、权限、配置' },
    revenue: { title: '财务与数据部', duty: '数据、表格、报表、财务' },
    rites: { title: '市场与公关部', duty: '文案、汇报、PPT、对外沟通' },
    war: { title: '研发部', duty: '写代码、构建、部署' },
    justice: { title: '质量与法务部', duty: '测试、审查、合规' },
    works: { title: '设计部', duty: '界面、视觉、设计' },
    jinyiwei: { title: 'PMO', duty: '盯进度：卡住就处理、推脱就督促、超预算就停' },
    yushi: { title: '内部审计', duty: '逐件核查各部门的产出，不实就退回重做' },
  },
  en: {
    emperor: { title: 'CEO' },
    ministries: { title: 'Departments' },
    zhongshu: { title: 'Chief Strategy Officer', duty: 'Drafts the plan and splits the work' },
    menxia: { title: 'Chief Risk Officer', duty: 'Finds the holes and can veto the plan' },
    shangshu: { title: 'Chief Operating Officer', duty: 'Assigns the work and sums it up' },
    personnel: { title: 'IT & Admin', duty: 'Accounts, permissions, configuration' },
    revenue: { title: 'Finance & Analytics', duty: 'Data, spreadsheets, reports, finance' },
    rites: { title: 'Marketing & Comms', duty: 'Copy, briefings, slides, outside communication' },
    war: { title: 'Engineering', duty: 'Code, builds, deployment' },
    justice: { title: 'QA & Legal', duty: 'Tests, review, compliance' },
    works: { title: 'Design', duty: 'UI, visuals, design' },
    jinyiwei: { title: 'PMO', duty: 'Watches progress: unblocks stalls, chases excuses, stops overspending' },
    yushi: { title: 'Internal Audit', duty: 'Checks each department\'s output and sends back what does not hold up' },
  },
};

// <glossary> 这一段原样复制在 client.js 里（test/modern.test.mjs 校验两边一致）
// 古代 → 现代。中文按字面替换；单字（朕、旨、奏、部）只在不会误伤的组合里出现。
const ZH = [
  ['中书省中书舍人', '首席战略官'], ['门下省给事中', '首席风控官'], ['中书舍人', '首席战略官'], ['给事中', '首席风控官'],
  ['中书省', '首席战略官'], ['门下省', '首席风控官'], ['尚书省', '首席运营官'],
  ['中书', '首席战略官'], ['门下', '首席风控官'], ['尚书', '首席运营官'], ['国库预算', '预算'],
  ['三省六部', '一人公司'], ['三省', '高管'], ['六部', '各部门'],
  ['吏部', 'IT 与行政部'], ['户部', '财务与数据部'], ['礼部', '市场与公关部'], ['兵部', '研发部'], ['刑部', '质量与法务部'], ['工部', '设计部'],
  ['锦衣卫', 'PMO'], ['监察御史', '内部审计'], ['御史', '审计'],
  ['史臣曰', '点评'], ['史官', '知识管理员'], ['史臣', '知识管理员'], ['史馆', '知识库'], ['实录', '知识库'], ['修史', '整理知识'],
  ['帝王传记', '创始人档案'], ['皇帝六能', 'CEO 六项能力'], ['傀儡皇帝', '甩手掌柜'], ['皇帝', 'CEO'], ['皇上', 'CEO'], ['圣上', 'CEO'], ['陛下', '您'], ['帝王', '创始人'], ['朕', '我'],
  ['丞相模式', '全权交办'], ['丞相', '全权交办'],
  ['再下一道旨', '再派一个任务'], ['下一道旨', '派一个任务'], ['一道旨', '一个任务'], ['道旨', '个任务'],
  ['圣旨', '任务'], ['圣意', '需求'], ['旨意', '需求'], ['奉旨', '按要求'], ['领旨', '接到任务'], ['遵旨', '收到'],
  ['下旨', '派任务'], ['拟旨', '出方案'], ['新旨', '新任务'],
  ['大朝会', '全面评审'], ['急递', '快速'], ['常朝', '标准'],
  ['朝会全景', '协作全景'], ['朝会', '任务'], ['开朝', '开工'], ['停朝', '停工'],
  ['朝制', '评审方式'], ['朝规', '公司规则'], ['朝局', '公司阶段'], ['朝堂', '公司'], ['朝廷', '公司'], ['朝中', '公司里'], ['本朝', '本次'],
  ['前朝经验', '过往经验'], ['前朝', '过往'], ['皇权', '决策权'], ['权臣', '一家独大的工具'], ['傀儡', '甩手掌柜'],
  ['加九锡', '单打独斗'], ['权倾朝野', '多面手'], ['两党争霸', '合伙人'], ['三巨头', '董事会'], ['乾纲独断', '集团化'], ['架空指数', '放权指数'],
  ['奏折编号', '任务编号'], ['以上奏折', '以上任务'], ['份奏折', '个任务'], ['奏折', '任务'], ['奏章', '任务'], ['上奏', '提交汇报'], ['回奏', '汇报'], ['回文', '汇报'],
  ['批红', '批准'], ['朱批', '批示'], ['准奏', '通过'], ['封驳', '否决'], ['驳回', '打回'], ['弹劾', '退回'], ['督办', '督促'],
  ['移文', '协作请求'], ['派单', '派活'], ['办差中', '进行中'], ['办差', '干活'], ['差事', '工作'], ['部务', '部门工作'],
  ['公文往来', '部门往来'], ['公文', '消息'], ['告示', '通知'],
  ['群臣', 'AI 员工'], ['百官', '全员'], ['官职', '职位'], ['值房', '工作台'], ['殿宇', '外观'], ['本纪', '创始人档案'], ['功勋', '成就'], ['国库', '预算'],
  ['官制模板', '职位模板'], ['官制', '职位设置'], ['职掌', '职责'], ['上朝', '上手'],
  ['钦定流程', '指定流程'], ['钦定', '指定'], ['起手式', '快速开始'], ['亲裁', '亲自决定'],
  // 锦衣卫督办的四级说法
  ['申饬', '提醒'], ['诏狱问话', '追问'], ['考成', '逐项复盘'], ['革职留任', '最后机会'],
  ['执行的部(?!门)', '执行的部门'], ['各部(?!门)', '各部门'], ['个部(?!门)', '个部门'], ['本部(?!门)', '本部门'], ['该部(?!门)', '该部门'], ['他部(?!门)', '其他部门'],
];

// 古罗马 → 现代英文。区分大小写、按整词；替换成小写冠词开头的，句首再改成大写。
const EN = [
  ['[Caesar’s will]', '[Brief]'], ["[Caesar's will]", '[Brief]'],
  ['Caesar’s will', 'the brief'], ["Caesar's will", 'the brief'], ['his will', 'the brief'],
  ['Caesar’s seal', 'your approval'], ["Caesar's seal", 'your approval'],
  ['Awaiting your seal', 'Awaiting your approval'], ['Awaiting seal', 'Awaiting approval'], ['your seal', 'your approval'],
  ['Auto-sealed', 'Auto-approved'], ['Sealed', 'Approved'], ['sealed', 'approved'], ['seal', 'approve'], ['Seal', 'Approve'],
  ['treasury budget', 'budget'],
  ['Report to Caesar', 'Report'], ['Halted by Caesar', 'Stopped by the CEO'],
  ['Caesar', 'the CEO'],
  ['Consul’s scribe', 'CSO'], ["Consul's scribe", 'CSO'],
  ['Proconsul', 'COO'], ['Consul', 'CSO'], ['Tribune', 'CRO'],
  ['Praetorian Guard', 'PMO'], ['Praetorian', 'PMO'], ['Praetor', 'QA & Legal'], ['Censor', 'IT & Admin'], ['Quaestor', 'Finance'],
  ['Pontifex', 'Marketing'], ['Legate', 'Engineering'], ['Aedile', 'Design'],
  ['Agens in rebus', 'Internal Audit'], ['agens in rebus', 'internal auditor'], ['Annalist', 'Knowledge manager'], ['annalist', 'knowledge manager'],
  ['the Guard', 'the PMO'], ['Guard', 'PMO'], ['agentes in rebus', 'internal auditors'],
  ['magistrates', 'departments'], ['Magistrates', 'Departments'], ['magistrate', 'department'], ['Magistrate', 'Department'],
  ['decrees', 'tasks'], ['Decrees', 'Tasks'], ['decree', 'task'], ['Decree', 'Task'], ['edicts', 'tasks'], ['edict', 'task'],
  ['Imperial Senate', 'One-Person Company'], ['Senate floor', 'team chat'], ['the Senate', 'the company'], ['Senate', 'company'],
  ['impeachment', 'flag'], ['Impeachment', 'Flag'], ['impeached', 'flagged'], ['impeaches', 'flags'], ['impeach', 'flag'], ['Impeach', 'Flag'],
  ['admonition', 'nudge'], ['Admonition', 'Nudge'], ['admonishes', 'nudges'], ['admonish', 'nudge'],
  ['the annals', 'the knowledge base'], ['annals', 'knowledge base'], ['the Annals', 'the knowledge base'], ['Annals', 'knowledge base'],
  ['the chronicle', 'the knowledge base'], ['chronicle', 'knowledge base'], ['Chronicle', 'knowledge base'],
  ['treasury', 'budget'], ['Treasury', 'Budget'], ['Aerarium', 'Budget'],
  ['Cohort', 'Team'], ['Officium', 'Live desk'], ['Res Gestae', 'Founder profile'],
  ['standing orders', 'company rules'], ['strongman', 'dominant tool'],
  ['Dictator Perpetuo', 'Solo'], ['Sejanus’ Rome', 'Generalist'], ['East and West', 'Partners'], ['Triumvirate', 'Board'], ['Tetrarchy', 'Group'],
  ['Cursus publicus', 'Quick'], ['by courier', 'on the Quick path'], ['Acta', 'Run'], ['Comitia', 'Full review'],
  ['regimes', 'stages'], ['regime', 'stage'], ['Regime', 'Stage'],
  ['houses', 'vendors'], ['house', 'vendor'],
  ['offices', 'roles'], ['Offices', 'Roles'], ['office', 'role'], ['Office', 'Role'],
  ['Referral', 'Handoff'], ['referral', 'handoff'], ['Assent', 'Approved'],
];
// </glossary>

const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function compile(entries, wordBoundary) {
  // 中文词条自带的 (?!门) 之类是正则，其余转义；长的在前，单遍替换不会互相覆盖
  const sorted = [...entries].sort((a, b) => b[0].length - a[0].length);
  const lookup = new Map();
  const parts = sorted.map(([from, to]) => {
    const plain = from.replace(/\(\?!.*?\)$/, '');
    lookup.set(plain, to);
    const body = from === plain ? escape(from) : `${escape(plain)}${from.slice(plain.length)}`;
    // 整词：前后不能是字母、数字或下划线（sansheng_edict 这种工具名不能动）
    return wordBoundary ? `(?<![\w])${body}(?![\w])` : body;
  });
  // {role} 这类占位符排在最前面原样放过：里面的词（如 {regime}）不能被换掉，否则填不进值
  return { re: new RegExp(['\\{\\w+\\}', ...parts].join('|'), 'g'), lookup };
}

const COMPILED = { zh: compile(ZH, false), en: compile(EN, true) };
const cache = { zh: new Map(), en: new Map() };
const CJK = /[㐀-鿿]/;
// 句首：开头、句号后、换行后、方括号或引号后（"knowledge base memory" 这类界面上的名字也大写）
const SENTENCE_START = /(^|[.!?]\s+|\n\s*|[["“]\s*)$/;

/** 古代文案 → 现代文案。lang 是 'zh' 或 'en' */
export function modernize(text, lang) {
  if (text === null || text === undefined) return text;
  const value = String(text);
  const key = lang === 'en' ? 'en' : 'zh';
  const memo = cache[key];
  if (memo.has(value)) return memo.get(value);
  const { re, lookup } = COMPILED[key];
  const out = value.replace(re, (match, offset, whole) => {
    let to = lookup.get(match);
    if (to === undefined) return match;
    if (key === 'en') {
      // 换进来的 the CEO / the brief 落在句首时首字母大写；原文自己的大小写不动
      if (/^[a-z]/.test(to) && SENTENCE_START.test(whole.slice(0, offset))) to = to[0].toUpperCase() + to.slice(1);
      return to;
    }
    // 中文里换进来的英文词（CEO、PMO、AI）和汉字之间留一个空格
    const before = whole[offset - 1];
    const after = whole[offset + match.length];
    if (/^[A-Za-z]/.test(to) && before && CJK.test(before)) to = ` ${to}`;
    if (/[A-Za-z]$/.test(to) && after && CJK.test(after)) to = `${to} `;
    return to;
  });
  if (memo.size < 5000) memo.set(value, out);
  return out;
}

export const GLOSSARY = { zh: ZH, en: EN };
