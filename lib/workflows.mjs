// 钦定流程模板：皇帝在「确定工作流」里一键套用，也可以让模型调 sansheng_edict 时按名字指定。
import { MINISTRY_IDS } from './i18n.mjs';

export const WORKFLOW_TEMPLATES = {
  video: {
    name: { zh: '短视频', en: 'Short video' },
    steps: [
      { ministry: 'revenue', title: { zh: '对标爆款，定选题与话题', en: 'Study hit videos; pick topic and hashtags' } },
      { ministry: 'rites', title: { zh: '写脚本与分镜表', en: 'Write the script and shot list' } },
      { ministry: 'works', title: { zh: '逐镜生成画面', en: 'Generate the visuals shot by shot' } },
      { ministry: 'personnel', title: { zh: '配乐与音效', en: 'Music and sound effects' } },
      { ministry: 'war', title: { zh: '剪辑合成成片', en: 'Edit and render the final cut' } },
      { ministry: 'justice', title: { zh: '成片质检', en: 'Quality-check the final cut' } },
      { ministry: 'rites', title: { zh: '发布标题、描述与话题标签', en: 'Title, description and hashtags for publishing' } },
    ],
  },
  dev: {
    name: { zh: '研发', en: 'Engineering' },
    steps: [
      { ministry: 'war', title: { zh: '实现功能', en: 'Implement the feature' } },
      { ministry: 'justice', title: { zh: '测试与代码审查', en: 'Test and review the code' } },
      { ministry: 'rites', title: { zh: '写变更说明', en: 'Write the change notes' } },
    ],
  },
  report: {
    name: { zh: '报告', en: 'Report' },
    steps: [
      { ministry: 'revenue', title: { zh: '整理与分析数据', en: 'Clean and analyse the data' } },
      { ministry: 'rites', title: { zh: '撰写报告', en: 'Write the report' } },
      { ministry: 'justice', title: { zh: '核对数据与结论', en: 'Verify the numbers and conclusions' } },
    ],
  },
};

const VALID = new Set(MINISTRY_IDS);

/** 清洗一份流程：只留六部、标题截断、最多 12 步 */
export function cleanWorkflow(list) {
  return (Array.isArray(list) ? list : [])
    .map(item => ({
      ministry: String((item && item.ministry) || '').trim(),
      title: String((item && item.title) || '').trim().slice(0, 80),
    }))
    .filter(item => VALID.has(item.ministry))
    .slice(0, 12);
}

/**
 * 把各种写法解析成流程：数组原样清洗；"none" / "" = 不指定；"default" = 存档里的流程；
 * 模板名（video / dev / report）；或逗号分隔的部门 id（"war,justice"）。
 */
export function resolveWorkflow(spec, saved, locale = 'zh') {
  if (Array.isArray(spec)) return cleanWorkflow(spec);
  if (spec === undefined || spec === null || spec === 'default') return cleanWorkflow(saved);
  const text = String(spec).trim();
  if (!text || text === 'none') return [];
  const template = WORKFLOW_TEMPLATES[text];
  if (template) return template.steps.map(step => ({ ministry: step.ministry, title: step.title[locale] || step.title.zh }));
  return cleanWorkflow(text.split(/[,，\s→>]+/).map(ministry => ({ ministry, title: '' })));
}
