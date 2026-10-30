// 三省六部的「公文模板」。改这里就能改朝堂的风气：严一点 / 松一点 / 换语言。
// 每个模板都有 zh（三省六部）与 en（古罗马元老院）两版，按奏折开朝时的语言选。
// 职掌取当前编制里 roles[].duty（界面上可改，也可套用「短视频」等官制模板）。
import { MINISTRY_IDS, ROLE_TEXT, roleTitle, roleDuty, normalizeLocale } from './i18n.mjs';

/** 默认六部（中文），给老代码和测试用 */
export const MINISTRIES = MINISTRY_IDS.map(id => ({ id, title: ROLE_TEXT.zh[id].title, duty: ROLE_TEXT.zh[id].duty }));

/** 六部清单：名称按语言，职掌取当前编制，缺省回落到该语言的默认值 */
export function ministriesOf(roles = {}, locale = 'zh') {
  return MINISTRY_IDS.map(id => ({ id, title: roleTitle(locale, id), duty: roleDuty(locale, id, (roles[id] || {}).duty) }));
}

const ministryList = ministries => ministries.map(item => `- ${item.id} ${item.title}: ${item.duty}`).join('\n');
const numbered = list => list.map((item, i) => `${i + 1}. ${item}`).join('\n');
const isEn = locale => normalizeLocale(locale) === 'en';
const workdir = edict => edict.execDir || edict.workspace;

// 丞相模式下发给每个岗位的「值守规矩」
const AUTONOMY = {
  zh: `【无人值守】本朝开启丞相模式，全程没有任何人工确认或人工操作：
- 不要提问，不要等待确认，不要把决定留给别人；遇到取舍自行决定，并在汇报里一句话写明理由。
- 需要的命令行工具（如 ffmpeg、python、node）先检查是否已安装；没有就尝试安装，装不了就换一种能达成目标的做法。
- 出错先自己排查、修正、重试；确实做不到时，交付最接近的可用替代，并写明与要求的差距。`,
  en: `[Unattended] Autonomy is on. Nobody will confirm or do anything by hand:
- Do not ask questions or wait for confirmation, and do not leave decisions to others. Make the call and state your reason in one sentence in your report.
- Check that the command-line tools you need (ffmpeg, python, node…) are installed. Install them if not; if you cannot, find another way to reach the goal.
- When something fails, investigate, fix and retry. If it truly cannot be done, deliver the closest usable alternative and state the gap.`,
};

/** 隔离副本说明：各部是在 git worktree 里办差，不是原目录 */
function isolationNote(edict, locale) {
  if (!edict.git || !edict.git.branch) return '';
  return isEn(locale)
    ? `\n[Isolated copy] You are working in a git worktree of the repository on branch ${edict.git.branch}. It only contains committed files: dependency folders (node_modules, .venv…) and untracked files such as .env are absent, so install dependencies first if you need them. Do not commit; the Senate commits the work for you.\n`
    : `\n【隔离副本】你在仓库的一份 git worktree 里办差（分支 ${edict.git.branch}），只包含已提交的文件：依赖目录（node_modules、.venv 等）和 .env 之类未跟踪文件都不在，需要时先安装依赖。不要自己提交，朝堂会统一提交。\n`;
}

/** 前朝经验：以往类似奏折留下的教训，拟旨与审议时都带上 */
function lessonsBlock(edict, locale) {
  const lessons = Array.isArray(edict.recalled) ? edict.recalled : [];
  const chronicle = chronicleBlock(edict, locale);
  if (!lessons.length) return chronicle;
  return `${chronicle}${isEn(locale)
    ? `\n[Annals] Lessons left by earlier, similar decrees. Avoid repeating these mistakes:\n${numbered(lessons.map(item => item.text))}\n`
    : `\n【前朝经验】以往类似奏折留下的教训，主动规避，不要再犯：\n${numbered(lessons.map(item => item.text))}\n`}`;
}

/** 实录：这个工作目录与相关岗位的长期记忆（✓ 已验证、? 未验证），省得各部每次从头摸索 */
function chronicleBlock(edict, locale) {
  const text = String(edict.chronicle || '').trim();
  if (!text) return '';
  return isEn(locale)
    ? `\n[Chronicle] What the Senate already knows about this folder and these offices (✓ verified, ? unverified). Use it; do not rediscover it:\n${text}\n`
    : `\n【实录】朝廷对这个目录与相关岗位已知的情况（✓ 已验证、? 未验证）。直接用，不要重新摸索：\n${text}\n`;
}

/** 圣意 + 随旨交下的附件路径（附件存在奏折目录里，不在工作目录） */
function willOf(edict) {
  const files = Array.isArray(edict.attachments) ? edict.attachments : [];
  if (!files.length) return edict.brief;
  const head = isEn(edict.locale)
    ? '[Attachments] Files Caesar handed over with the decree (read them as needed; do not modify or move them):'
    : '【附件】皇帝随旨交下的文件（按需读取，不要改动或移动）：';
  return [edict.brief, head, ...files.map(file => `- ${file.path}`)].join('\n');
}

export function draftPrompt(edict, issues = [], { ministries = MINISTRIES, autonomous = false, maxSteps = 8, locale = 'zh' } = {}) {
  const workflow = Array.isArray(edict.workflow) ? edict.workflow : [];
  const titleOf = id => (ministries.find(item => item.id === id) || {}).title || id;
  if (isEn(locale)) {
    const feedback = issues.length ? `\nThe Tribune's objections (answer every one; do not ignore any):\n${numbered(issues)}\n` : '';
    const fixed = workflow.length
      ? `\n[Fixed procedure] Caesar has set the order of work. steps must match the list below one to one (same ministry, same order, same count). Do not add, drop or reorder anything; your job is to make each step's instruction and deliverable concrete. Leave "after" out: the steps run in this order.\n${numbered(workflow.map(item => `${item.ministry} ${titleOf(item.ministry)}: ${item.title || '(per its remit)'}`))}\n`
      : '';
    return `You are the Consul's scribe. Your duty is to turn Caesar's will into an executable plan. Output a single JSON object and nothing else: no prose, no explanations, no code fences.

[Caesar's will] ${willOf(edict)}
[Working folder] ${workdir(edict)}
[Acceptance] ${edict.criteria || 'Not specified. Propose checkable criteria yourself (ideally numbers or files a command can verify).'}
${isolationNote(edict, locale)}${feedback}${lessonsBlock(edict, locale)}
[Magistrates] Use only these ministry ids and assign work by remit:
${ministryList(ministries)}
${fixed}
[Output format]
{"summary":"one-sentence summary of the plan","steps":[{"ministry":"war","title":"short title","instruction":"complete, executable instruction for that magistrate: which files to read, what to do, where the limits are","deliverable":"concrete output path inside the working folder","after":[1]}],"acceptance":["checkable acceptance criterion"]}

[Rules]
1. ${workflow.length ? `Exactly ${workflow.length} steps, following the fixed procedure.` : `At most ${maxSteps} steps, in dependency order. The same ministry may appear more than once.`}
2. File contract: every deliverable must be a concrete file or folder path inside the working folder. When a step uses an earlier step's output, its instruction names the path to read.
3. Dependencies: "after" lists the numbers (from 1) of the earlier steps this step needs. Steps that do not depend on each other get "after": [] and run in parallel. Leaving "after" out means "depends on the previous step". Parallel steps must write different files.
4. ${autonomous
    ? 'Nobody is watching: no step may require human confirmation or manual work. Make every creative call in the plan, or leave it to the magistrate doing the work.'
    : 'Do not plan steps that need a human to decide.'}
5. Do not claim anything has been done. You only draft.`;
  }
  const feedback = issues.length
    ? `\n门下省封驳意见（必须逐条回应，不要忽略）：\n${numbered(issues)}\n`
    : '';
  const fixed = workflow.length
    ? `\n【钦定流程】皇帝已定好办事顺序。steps 必须与下列逐条一一对应（同样的 ministry、同样的顺序、同样的条数），不得增删或调换；你只负责把每一步的 instruction 和 deliverable 写具体。不用写 after，按顺序办理：\n${numbered(workflow.map(item => `${item.ministry} ${titleOf(item.ministry)}：${item.title || '（按职掌）'}`))}\n`
    : '';
  return `你是中书省中书舍人，职责是把圣意拟成可执行的方案。只输出一个 JSON 对象，不要输出 JSON 以外的文字、解释或代码块标记。

【圣意】${willOf(edict)}
【工作目录】${workdir(edict)}
【验收要求】${edict.criteria || '未指定，请自行给出可检验的标准（尽量是能用命令检查的数字或文件）'}
${isolationNote(edict, locale)}${feedback}${lessonsBlock(edict, locale)}
【可选六部】只允许使用以下 ministry id，按职掌派活：
${ministryList(ministries)}
${fixed}
【输出格式】
{"summary":"一句话概括方案","steps":[{"ministry":"war","title":"短标题","instruction":"给该部的完整可执行指令：要读哪些文件、做什么、边界在哪","deliverable":"工作目录下的具体产物路径","after":[1]}],"acceptance":["可检查的验收标准"]}

【要求】
1. ${workflow.length ? `steps 正好 ${workflow.length} 个，严格按钦定流程` : `steps 不超过 ${maxSteps} 个，按依赖顺序排列；同一个部可以出现多次`}。
2. 文件契约：每一步的 deliverable 必须是工作目录下的具体文件或目录路径；后面的步骤要用前面的产出时，在 instruction 里写明读取哪个路径。
3. 依赖：after 写这一步依赖的前序步骤编号（从 1 开始）；互不依赖的步骤写 "after": [] 就能并行办理；不写 after 视为依赖上一步。并行的步骤必须写不同的文件。
4. ${autonomous
    ? '全程无人值守：不得安排任何需要人工确认、人工操作的步骤；所有创意与取舍由中书省在方案里定好，或交给执行的部自行决定。'
    : '不要安排需要人类拍板的步骤。'}
5. 不要声称已经执行，你只负责拟旨。`;
}

const JSON_REMINDER = {
  zh: '\n\n【重申】你上一次的回复不是合法 JSON。这一次只输出一个 JSON 对象，第一个字符必须是 {，最后一个字符必须是 }。',
  en: '\n\n[Reminder] Your previous answer was not valid JSON. This time output a single JSON object only: the first character must be { and the last must be }.',
};
export const jsonReminder = locale => JSON_REMINDER[normalizeLocale(locale)];

export function reviewPrompt(edict, planText, { autonomous = false, locale = 'zh' } = {}) {
  const fixed = Array.isArray(edict.workflow) && edict.workflow.length;
  if (isEn(locale)) {
    return `You are the Tribune. Your duty is the veto: check whether the Consul's plan is feasible, complete, safe and within bounds. Output a single JSON object.

[Caesar's will] ${willOf(edict)}
[The Consul's plan]
${planText}
${lessonsBlock(edict, locale)}
[Output format]
{"verdict":"approve or reject","issues":["concrete problems, one per item"],"risks":["risks to watch"]}

[Standard] Reject only for concrete problems that would cause rework or clearly stray from Caesar's will. Style or wording preferences are no grounds for a veto. If the plan repeats a mistake listed in the annals, reject it.${fixed
    ? '\nThe ministries and their order were fixed by Caesar. Do not veto on order or assignment; judge only whether each instruction is feasible and the steps hand over correctly.'
    : ''}${autonomous
    ? '\nNobody is watching: if any step needs human confirmation or manual work, or the file handover between steps does not line up, you must reject and say so.'
    : ''}`;
  }
  return `你是门下省给事中，职责是封驳：审查中书省方案是否可行、有无遗漏、风险与越权。只输出一个 JSON 对象。

【圣意】${willOf(edict)}
【中书省方案】
${planText}
${lessonsBlock(edict, locale)}
【输出格式】
{"verdict":"approve 或 reject","issues":["具体问题，逐条"],"risks":["风险提示"]}

【判定标准】只有会导致返工或明显偏离圣意的具体问题才判 reject；文风、措辞偏好不构成驳回理由。方案若重犯「前朝经验」里列出的错误，判 reject。${fixed
    ? '\n步骤的部门与顺序是皇帝钦定的，不得以顺序或分工为由封驳，只审每一步的指令是否可行、衔接是否对得上。'
    : ''}${autonomous
    ? '\n本朝无人值守：方案里只要有需要人工确认或人工操作的步骤，或者步骤之间的文件衔接对不上，必须判 reject 并指出来。'
    : ''}`;
}

/**
 * @param {object} ctx
 * @param {Array} ctx.previous   已办完的前序差事（尚书省转来的回文）
 * @param {string} ctx.retryError 上次失败的原因（重办时）
 * @param {object} ctx.substitute 代办：{ original } 原定的工具没有命令行，由别人代办
 * @param {Array} ctx.ministries 六部清单（移文时可选的目标）
 */
export function taskPrompt(edict, step, role, { previous = [], retryError = '', substitute = null, autonomous = false, locale = 'zh', ministries = MINISTRIES, pressure = '' } = {}) {
  const targets = ministries.map(item => `${item.id} ${item.title}`).join(' / ');
  if (isEn(locale)) {
    const prior = previous.length
      ? `\n[Earlier work] Reports forwarded by the Proconsul (read the files when you need them; do not redo work that is already done):\n${previous.map((item, index) => [
          `${index + 1}. ${item.roleTitle} | ${item.title} | ${item.status}${item.deliverable ? ` | output: ${item.deliverable}` : ''}`,
          item.summary ? `   ${String(item.summary).slice(0, 2000).replace(/\n/g, '\n   ')}` : '',
        ].filter(Boolean).join('\n')).join('\n')}\n`
      : '';
    const sub = substitute
      ? `\n[Deputy] This order was meant for "${substitute.original}", which has no command line. You stand in: produce the same output with the command-line tools or APIs you can use.\n`
      : '';
    const retry = retryError
      ? `\n[Last attempt failed] ${String(retryError).slice(0, 1500)}\nThis is a retry. Work out why it failed and take a different approach; do not repeat the same mistake.\n`
      : '';
    return `You are the ${role.title}, carrying out the order below by order of the Proconsul. Working folder: ${workdir(edict)}

[Caesar's will] ${willOf(edict)}
[Your remit] ${role.duty || ''}
[Order] ${step.title}
[Instruction] ${step.instruction}
[Deliverable] ${step.deliverable || 'Deliver what Caesar asked for. Put text results straight into your report; if you changed files, list the files'}
[Scope] Do exactly what was asked, in the most direct way. When the result is text (a poem, lyrics, copy, an answer, a plan), write the finished piece in full in your report: no extra files, and never build a program, web page or player for it unless the will asks for one. Write files only when the will or the deliverable names them or the work is changing code.
${isolationNote(edict, locale)}${chronicleBlock(edict, locale)}${prior}${sub}${retry}${pressure ? `\n${pressure}\n` : ''}${autonomous ? `\n${AUTONOMY.en}\n` : ''}
[Referral] If this work needs another magistrate, add one line of JSON at the very end of your report (not mixed into the text):
{"handoff":{"to":"justice","reason":"needs a set of regression tests","deliverable":"optional"}}
Valid targets: ${targets}.
Do not output this JSON if no help is needed.

When done, report briefly: what you did, which files hold the output, and what is left undone. No pleasantries, do not repeat the instruction.`;
  }
  const prior = previous.length
    ? `\n【前序产出】尚书省转来的各部回文（需要时去读对应文件，不要重做别人已完成的部分）：\n${previous.map((item, index) => [
        `${index + 1}. ${item.roleTitle}｜${item.title}｜${item.status}${item.deliverable ? `｜产出：${item.deliverable}` : ''}`,
        item.summary ? `   ${String(item.summary).slice(0, 2000).replace(/\n/g, '\n   ')}` : '',
      ].filter(Boolean).join('\n')).join('\n')}\n`
    : '';
  const sub = substitute
    ? `\n【代办】这件差事原定由「${substitute.original}」办理，但它没有可调用的命令行。由你代办：用你能调用的命令行工具或 API 做出同样的产出。\n`
    : '';
  const retry = retryError
    ? `\n【上次失败】${String(retryError).slice(0, 1500)}\n这是重办：先弄清失败原因，换一种做法，不要重复同样的错误。\n`
    : '';
  return `你是${role.title}，奉尚书省派单执行下面这项工作。工作目录：${workdir(edict)}

【圣意】${willOf(edict)}
【本部职掌】${role.duty || ''}
【工单】${step.title}
【指令】${step.instruction}
【产出要求】${step.deliverable || '按圣意交付：文字类成果直接写在汇报里，改了文件就说明改了哪些'}
【分寸】只做圣意要的，用最直接的方式交付。成果是文字（诗、歌词、文案、答案、方案）就把完整成品直接写在汇报里，不必另写文件，更不要为此搭程序、网页或播放器，除非圣意明说要。只有圣意或产出要求点名要文件、或者差事本身就是改代码时才写文件。
${isolationNote(edict, locale)}${chronicleBlock(edict, locale)}${prior}${sub}${retry}${pressure ? `\n${pressure}\n` : ''}${autonomous ? `\n${AUTONOMY.zh}\n` : ''}
【协同】如果这项工作需要他部配合，在汇报的最后单独附一行 JSON（不要混进正文）：
{"handoff":{"to":"justice","reason":"需要补一组回归测试","deliverable":"可选项"}}
可选的 to：${targets}。
不需要协同就不要输出这段 JSON。

完成后用简短文字汇报：做了什么、产出在哪些文件、还有什么没做完。不要寒暄，不要重复指令。`;
}

export function recheckPrompt(edict, resultsText, { acceptance = [], autonomous = false, locale = 'zh' } = {}) {
  const criteria = [edict.criteria, ...acceptance.map((item, index) => `${index + 1}. ${item}`)].filter(Boolean).join('\n');
  if (isEn(locale)) {
    return `You are the Tribune, auditing the magistrates' results against the acceptance criteria. Output a single JSON object.

[Caesar's will] ${willOf(edict)}
[Working folder] ${workdir(edict)}
[Acceptance criteria]
${criteria || '(none given; judge by Caesar\'s will)'}
[Summary of the magistrates' work]
${resultsText}

Check the files in the working folder directly whenever you can; do not trust the summaries alone.${autonomous ? ' Nobody is watching: your verdict decides whether the decree is archived automatically.' : ''}

[Output format]
{"verdict":"approve or reject","issues":["each unmet criterion: which file, and what is missing"]}`;
  }
  return `你是门下省给事中，复核六部执行结果是否满足验收标准。只输出一个 JSON 对象。

【圣意】${willOf(edict)}
【工作目录】${workdir(edict)}
【验收标准】
${criteria || '（未指定，按圣意判断）'}
【六部产出摘要】
${resultsText}

能直接检查工作目录里的文件就去检查，不要只信摘要。${autonomous ? '本朝无人值守，你的结论决定是否自动归档。' : ''}

【输出格式】
{"verdict":"approve 或 reject","issues":["未达标的具体条目，写清是哪个文件、差在哪"]}`;
}

/** 复核未达标时，让中书省拟补救差事 */
export function fixPrompt(edict, issues, resultsText, { ministries = MINISTRIES, maxSteps = 4, locale = 'zh' } = {}) {
  if (isEn(locale)) {
    return `You are the Consul's scribe. The Tribune's audit found the results falling short. Draft remedial orders. Output a single JSON object and nothing else.

[Caesar's will] ${willOf(edict)}
[Working folder] ${workdir(edict)}
[Unmet criteria]
${numbered(issues)}
[Work done so far]
${resultsText}

[Magistrates]
${ministryList(ministries)}

[Output format]
{"summary":"approach to the remedy","steps":[{"ministry":"war","title":"short title","instruction":"executable instruction addressing only the unmet criteria; name the files to read and change","deliverable":"output path","after":[]}]}

[Rules] Fix only what is unmet; do not redo what already passes. 1-${maxSteps} steps. Nobody is watching: no manual steps.`;
  }
  return `你是中书省中书舍人。门下省复核认为执行结果未达标，请拟补救差事。只输出一个 JSON 对象，不要输出其它文字。

【圣意】${willOf(edict)}
【工作目录】${workdir(edict)}
【未达标条目】
${numbered(issues)}
【已办差事摘要】
${resultsText}

【可选六部】
${ministryList(ministries)}

【输出格式】
{"summary":"补救思路","steps":[{"ministry":"war","title":"短标题","instruction":"只针对未达标条目的可执行指令，写明要读、要改的文件","deliverable":"产物路径","after":[]}]}

【要求】只补未达标的部分，不要重做已达标的；steps 1-${maxSteps} 个；全程无人值守，不得安排人工步骤。`;
}

/** 从 start 处的 { 起找到配对的 }，返回结束下标（不含）；找不到返回 -1 */
function matchBrace(body, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < body.length; i += 1) {
    const ch = body[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/** 从模型输出里抠出第一个完整 JSON 对象（容忍 ```json 包裹和前后废话） */
export function extractJson(text) {
  if (!text) return null;
  const fenced = String(text).match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : String(text);
  const start = body.indexOf('{');
  if (start < 0) return null;
  const end = matchBrace(body, start);
  if (end < 0) return null;
  try {
    return JSON.parse(body.slice(start, end));
  } catch {
    return null;
  }
}

/**
 * 把回奏拆成「正文」与「移文请求」。移文 JSON 是给尚书省看的，界面上不该原样露出来。
 * @returns {{ body: string, handoff: null | { to, reason, deliverable } }}
 */
export function splitHandoff(text, ministryIds) {
  const source = String(text || '');
  const index = source.lastIndexOf('"handoff"');
  if (index < 0) return { body: source, handoff: null };
  const start = source.lastIndexOf('{', index);
  if (start < 0) return { body: source, handoff: null };
  const end = matchBrace(source, start);
  if (end < 0) return { body: source, handoff: null };
  let parsed = null;
  try {
    parsed = JSON.parse(source.slice(start, end));
  } catch {
    return { body: source, handoff: null };
  }
  const raw = parsed && parsed.handoff;
  const body = `${source.slice(0, start)}${source.slice(end)}`.replace(/```(?:json)?\s*```/g, '').trim();
  if (!raw || typeof raw !== 'object') return { body, handoff: null };
  const to = String(raw.to || '').trim();
  if (!ministryIds.has(to)) return { body, handoff: null };
  return {
    body,
    handoff: { to, reason: String(raw.reason || '').slice(0, 400), deliverable: String(raw.deliverable || '').slice(0, 500) },
  };
}

// ---------- 锦衣卫督办：仿 pua 的压力阶梯，但每一级都给出可执行的方法，而不只是加压 ----------
const PRESSURE = {
  zh: [
    { label: '申饬', text: '【锦衣卫·申饬】上一次没办成。不许原样重试：换一个本质不同的做法（不同的工具、路径或思路），并说明为什么新做法能绕开上次的问题。' },
    { label: '诏狱问话', text: '【锦衣卫·诏狱问话】第二次没办成。先把完整的报错与日志读完，用命令核实你的每个假设（文件在不在、版本对不对、命令能不能跑），列出三个可能原因并逐一验证，再动手。' },
    { label: '考成', text: '【锦衣卫·考成】第三次没办成，按七条清单逐项过：1 读完整报错；2 找工具自己的日志；3 用命令核实环境与假设；4 换一种工具或库；5 做最小复现；6 检查同类问题是否别处也有；7 用构建或测试输出证明结果。每条在汇报里写一句结论。' },
    { label: '革职留任', text: '【锦衣卫·革职留任】最后一次机会。穷尽所有办法；确实做不到，就交付最接近的可用替代，并写清楚与要求的差距和你试过的全部做法。不许空手回奏，不许把活推回给人。' },
  ],
  en: [
    { label: 'Admonition', text: '[Praetorian admonition] The last attempt failed. Do not retry the same way: switch to a fundamentally different approach (another tool, path or idea) and say why it avoids the last problem.' },
    { label: 'Interrogation', text: '[Praetorian interrogation] Second failure. Read the full error and logs first, verify every assumption with a command (does the file exist, is the version right, does the command run), list three possible causes and test each before changing anything.' },
    { label: 'Review', text: '[Praetorian review] Third failure. Work through the seven-point checklist: 1 read the full error; 2 find the tool\'s own logs; 3 verify environment and assumptions with commands; 4 try another tool or library; 5 build a minimal reproduction; 6 check whether the same problem exists elsewhere; 7 prove the result with build or test output. One line per item in your report.' },
    { label: 'Last chance', text: '[Praetorian last chance] Final attempt. Exhaust every option; if it truly cannot be done, deliver the closest usable alternative and state the gap and everything you tried. Do not come back empty-handed and do not push the work back to a human.' },
  ],
};

/** 第 level 级督办（1 起）：返回 { label, text } */
export function pressureOf(level, locale = 'zh', style = 'standard') {
  if (style === 'off' || level < 1) return { label: '', text: '' };
  const ladder = PRESSURE[isEn(locale) ? 'en' : 'zh'];
  const item = ladder[Math.min(ladder.length, level) - 1];
  if (style === 'gentle') {
    return { label: item.label, text: item.text.replace(/^【[^】]+】/, isEn(locale) ? '[Encouragement] ' : '【勉励】').replace(/^\[[^\]]+\]/, '[Encouragement]') };
  }
  return item;
}

// 推脱的说法：没办成却不承认、把活推回给人、没验证就说完成
const LAZY_PATTERNS = [
  [/(无法|不能|没法)(完成|实现|处理|访问|执行)/, '无法完成'],
  [/(请|需要)(您|你)(手动|自行|自己)/, '推回给人'],
  [/建议(您|你)/, '只给建议'],
  [/\bI (can(?:no|')t|am unable to|was unable to)\b/i, 'I cannot'],
  [/\b(you (?:can|could|should|need to) (?:manually|run|install))\b/i, 'pushed back to the user'],
  [/\b(out of scope|beyond (?:my|the) scope)\b/i, 'out of scope'],
  [/(权限不足|permission denied|access denied)/i, '权限问题未处理'],
];

/** 回奏里的推脱信号；没有返回 '' */
export function lazySignal(text) {
  const value = String(text || '');
  for (const [pattern, label] of LAZY_PATTERNS) if (pattern.test(value)) return label;
  return '';
}

/** 监察御史巡查一件差事（大朝会才调模型；常朝只做确定式检查） */
export function inspectPrompt(edict, step, report, changes, { locale = 'zh' } = {}) {
  const files = changes.length ? changes.map(item => `- ${item}`).join('\n') : (isEn(locale) ? '(no changes)' : '（没有改动）');
  if (isEn(locale)) {
    return `You are an agens in rebus, inspecting one magistrate's work for Caesar. Output a single JSON object.

[Order] ${step.title}
[Instruction] ${step.instruction}
[Deliverable] ${step.deliverable || '(none named)'}
[Working folder] ${workdir(edict)}
[Files changed]
${files}
[The magistrate's report]
${String(report || '').slice(0, 3000)}

Check the files directly. Impeach only for concrete problems: the deliverable is missing or empty, the report claims something the files do not show, or the work clearly does not do what the instruction asked.

[Output format]
{"verdict":"pass or impeach","findings":["concrete problem: which file, what is wrong"]}`;
  }
  return `你是监察御史，替皇帝巡查一件差事。只输出一个 JSON 对象。

【差事】${step.title}
【指令】${step.instruction}
【产出要求】${step.deliverable || '（未指定）'}
【工作目录】${workdir(edict)}
【改动的文件】
${files}
【该部回奏】
${String(report || '').slice(0, 3000)}

直接去看文件。只有具体问题才弹劾：产出缺失或为空、回奏说的与文件对不上、明显没按指令办。

【输出格式】
{"verdict":"pass 或 impeach","findings":["具体问题：哪个文件、错在哪"]}`;
}

/** 史官：把一份奏折里值得长期记住的事实提炼进实录（只记有依据的，不许猜） */
export function historianPrompt(edict, memorial, pageText, { locale = 'zh' } = {}) {
  if (isEn(locale)) {
    return `You are the Senate's annalist. From the report below, extract at most 6 durable facts about this working folder that will save future work. Output a single JSON object.

[Working folder] ${edict.workspace}
[Current chronicle page]
${String(pageText || '(empty)').slice(0, 3000)}
[Report]
${String(memorial || '').slice(0, 6000)}

Rules: only facts the report supports (how to build, how to run tests, where things live, conventions, traps). No speculation, no task-specific details, nothing already on the page. "kind" is facts, conventions or pitfalls.

[Output format]
{"facts":[{"kind":"facts","text":"Tests run with: npm test (Node 20+)"}]}`;
  }
  return `你是朝廷的史官。从下面这份奏折里，提炼最多 6 条对这个工作目录长期有用、能省下以后功夫的事实。只输出一个 JSON 对象。

【工作目录】${edict.workspace}
【现有实录页】
${String(pageText || '（空）').slice(0, 3000)}
【奏折】
${String(memorial || '').slice(0, 6000)}

要求：只记奏折里有依据的（怎么构建、怎么跑测试、东西放在哪、约定、坑）；不猜测、不记这次任务的细节、不重复页里已有的。kind 取 facts / conventions / pitfalls。

【输出格式】
{"facts":[{"kind":"facts","text":"测试命令：npm test（需 Node 20+）"}]}`;
}

// ---------- 续接会话时只发增量：上下文与缓存都在，省下重复的整段提示词 ----------
export function redraftDelta(issues, locale = 'zh') {
  return isEn(locale)
    ? `The Tribune vetoed your plan. Answer every objection and output the full revised plan as a single JSON object in the same format:\n${numbered(issues)}`
    : `门下省封驳了你的方案。逐条回应下列意见，按原格式重新输出完整方案（只输出一个 JSON 对象）：\n${numbered(issues)}`;
}

export function rereviewDelta(planText, locale = 'zh') {
  return isEn(locale)
    ? `The Consul revised the plan. Review it by the same standard and output the same JSON format:\n${planText}`
    : `中书省按你的意见改了方案。按同样的标准再审，输出同样格式的 JSON：\n${planText}`;
}

export function retryDelta(error, pressureText, locale = 'zh') {
  return isEn(locale)
    ? `That attempt did not succeed: ${String(error || '').slice(0, 1500)}\n${pressureText}\nTry again, then report as before.`
    : `上次没办成：${String(error || '').slice(0, 1500)}\n${pressureText}\n重办，完成后照旧汇报。`;
}
