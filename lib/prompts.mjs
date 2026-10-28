// 三省六部的「公文模板」。改这里就能改朝堂的风气：严一点 / 松一点 / 换语言。
// 默认职掌；实际拟旨时以当前编制里 roles[].duty 为准（界面上可改，也可套用「短视频」等官制模板）。
export const MINISTRIES = [
  { id: 'personnel', title: '吏部', duty: '人事、账号、权限、配置' },
  { id: 'revenue', title: '户部', duty: '数据、表格、报表、财务' },
  { id: 'rites', title: '礼部', duty: '文书、汇报、PPT、对外沟通' },
  { id: 'war', title: '兵部', duty: '写代码、构建、部署' },
  { id: 'justice', title: '刑部', duty: '测试、审查、合规' },
  { id: 'works', title: '工部', duty: '界面、设计、基础设施' },
];

/** 六部清单：名称与职掌取当前编制，缺省回落到默认值 */
export function ministriesOf(roles = {}) {
  return MINISTRIES.map(item => {
    const role = roles[item.id] || {};
    return { id: item.id, title: role.title || item.title, duty: String(role.duty || item.duty) };
  });
}

const ministryList = ministries => ministries.map(item => `- ${item.id} ${item.title}：${item.duty}`).join('\n');

// 自治模式下发给每个岗位的「值守规矩」
const AUTONOMY = `【无人值守】本朝开启自治模式，全程没有任何人工确认或人工操作：
- 不要提问，不要等待确认，不要把决定留给别人；遇到取舍自行决定，并在汇报里一句话写明理由。
- 需要的命令行工具（如 ffmpeg、python、node）先检查是否已安装；没有就尝试安装，装不了就换一种能达成目标的做法。
- 出错先自己排查、修正、重试；确实做不到时，交付最接近的可用替代，并写明与要求的差距。`;

export function draftPrompt(edict, issues = [], { ministries = MINISTRIES, autonomous = false, maxSteps = 8 } = {}) {
  const feedback = issues.length
    ? `\n门下省封驳意见（必须逐条回应，不要忽略）：\n${issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}\n`
    : '';
  const workflow = Array.isArray(edict.workflow) ? edict.workflow : [];
  const titleOf = id => (ministries.find(item => item.id === id) || {}).title || id;
  const fixed = workflow.length
    ? `\n【钦定流程】皇帝已定好办事顺序。steps 必须与下列逐条一一对应（同样的 ministry、同样的顺序、同样的条数），不得增删或调换；你只负责把每一步的 instruction 和 deliverable 写具体：\n${workflow.map((item, i) => `${i + 1}. ${item.ministry} ${titleOf(item.ministry)}：${item.title || '（按职掌）'}`).join('\n')}\n`
    : '';
  return `你是中书省中书舍人，职责是把圣意拟成可执行的方案。只输出一个 JSON 对象，不要输出 JSON 以外的文字、解释或代码块标记。

【圣意】${edict.brief}
【工作目录】${edict.workspace}
【验收要求】${edict.criteria || '未指定，请自行给出可检验的标准（尽量是能用命令检查的数字或文件）'}
${feedback}
【可选六部】只允许使用以下 ministry id，按职掌派活：
${ministryList(ministries)}
${fixed}
【输出格式】
{"summary":"一句话概括方案","steps":[{"ministry":"war","title":"短标题","instruction":"给该部的完整可执行指令：要读哪些文件、做什么、边界在哪","deliverable":"工作目录下的具体产物路径"}],"acceptance":["可检查的验收标准"]}

【要求】
1. ${workflow.length ? `steps 正好 ${workflow.length} 个，严格按钦定流程` : `steps 不超过 ${maxSteps} 个，按依赖顺序排列；同一个部可以出现多次`}。
2. 文件契约：每一步的 deliverable 必须是工作目录下的具体文件或目录路径；后面的步骤要用前面的产出时，在 instruction 里写明读取哪个路径。
3. 不同步骤写不同文件/目录，避免多个部同时改同一文件。
4. ${autonomous
    ? '全程无人值守：不得安排任何需要人工确认、人工操作的步骤；所有创意与取舍由中书省在方案里定好，或交给执行的部自行决定。'
    : '不要安排需要人类拍板的步骤。'}
5. 不要声称已经执行，你只负责拟旨。`;
}

export function reviewPrompt(edict, planText, { autonomous = false } = {}) {
  return `你是门下省给事中，职责是封驳：审查中书省方案是否可行、有无遗漏、风险与越权。只输出一个 JSON 对象。

【圣意】${edict.brief}
【中书省方案】
${planText}

【输出格式】
{"verdict":"approve 或 reject","issues":["具体问题，逐条"],"risks":["风险提示"]}

【判定标准】只有会导致返工或明显偏离圣意的具体问题才判 reject；文风、措辞偏好不构成驳回理由。${Array.isArray(edict.workflow) && edict.workflow.length
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
 */
export function taskPrompt(edict, step, role, { previous = [], retryError = '', substitute = null, autonomous = false } = {}) {
  const prior = previous.length
    ? `\n【前序产出】尚书省转来的各部回文（需要时去读对应文件，不要重做别人已完成的部分）：\n${previous.map((item, index) => [
        `${index + 1}. ${item.roleTitle}｜${item.title}｜${item.status}${item.deliverable ? `｜产出：${item.deliverable}` : ''}`,
        item.summary ? `   ${String(item.summary).slice(0, 1200).replace(/\n/g, '\n   ')}` : '',
      ].filter(Boolean).join('\n')).join('\n')}\n`
    : '';
  const sub = substitute
    ? `\n【代办】这件差事原定由「${substitute.original}」办理，但它没有可调用的命令行。由你代办：用你能调用的命令行工具或 API 做出同样的产出。\n`
    : '';
  const retry = retryError
    ? `\n【上次失败】${String(retryError).slice(0, 1500)}\n这是重办：先弄清失败原因，换一种做法，不要重复同样的错误。\n`
    : '';
  return `你是${role.title}，奉尚书省派单执行下面这项工作。工作目录：${edict.workspace}

【圣意】${edict.brief}
【本部职掌】${role.duty || ''}
【工单】${step.title}
【指令】${step.instruction}
【产出要求】${step.deliverable || '按指令产出，并说明改了哪些文件'}
${prior}${sub}${retry}${autonomous ? `\n${AUTONOMY}\n` : ''}
【协同】如果这项工作需要他部配合，在汇报的最后单独附一行 JSON（不要混进正文）：
{"handoff":{"to":"justice","reason":"需要补一组回归测试","deliverable":"可选项"}}
可选的 to：personnel 吏部 / revenue 户部 / rites 礼部 / war 兵部 / justice 刑部 / works 工部。
不需要协同就不要输出这段 JSON。

完成后用简短文字汇报：做了什么、产出在哪些文件、还有什么没做完。不要寒暄，不要重复指令。`;
}

export function recheckPrompt(edict, resultsText, { acceptance = [], autonomous = false } = {}) {
  const criteria = [edict.criteria, ...acceptance.map((item, index) => `${index + 1}. ${item}`)].filter(Boolean).join('\n');
  return `你是门下省给事中，复核六部执行结果是否满足验收标准。只输出一个 JSON 对象。

【圣意】${edict.brief}
【工作目录】${edict.workspace}
【验收标准】
${criteria || '（未指定，按圣意判断）'}
【六部产出摘要】
${resultsText}
${autonomous ? '\n本朝无人值守，你的结论决定是否自动归档：能直接检查工作目录里的文件就去检查，不要只信摘要。\n' : ''}
【输出格式】
{"verdict":"approve 或 reject","issues":["未达标的具体条目，写清是哪个文件、差在哪"]}`;
}

/** 复核未达标时，让中书省拟补救差事 */
export function fixPrompt(edict, issues, resultsText, { ministries = MINISTRIES, maxSteps = 4 } = {}) {
  return `你是中书省中书舍人。门下省复核认为执行结果未达标，请拟补救差事。只输出一个 JSON 对象，不要输出其它文字。

【圣意】${edict.brief}
【工作目录】${edict.workspace}
【未达标条目】
${issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}
【已办差事摘要】
${resultsText}

【可选六部】
${ministryList(ministries)}

【输出格式】
{"summary":"补救思路","steps":[{"ministry":"war","title":"短标题","instruction":"只针对未达标条目的可执行指令，写明要读、要改的文件","deliverable":"产物路径"}]}

【要求】只补未达标的部分，不要重做已达标的；steps 1-${maxSteps} 个；全程无人值守，不得安排人工步骤。`;
}

/** 从模型输出里抠出第一个完整 JSON 对象（容忍 ```json 包裹和前后废话） */
export function extractJson(text) {
  if (!text) return null;
  const fenced = String(text).match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : String(text);
  const start = body.indexOf('{');
  if (start < 0) return null;
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
      if (depth === 0) {
        try {
          return JSON.parse(body.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
