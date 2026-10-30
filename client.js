// 三省六部 · 浏览器半（DSH Web 客户端插件）
// 零构建：直接是 IIFE，通过 window.__ModuleLoader__ 注册；UI 走宿主半注册的 /sansheng-liubu/* 端点。
(function () {
  const API = '/sansheng-liubu';
  // 界面语言：zh = 三省六部，en = 古罗马元老院。宿主存档里有就用存档，没有按浏览器语言猜
  // 上次的选择缓存在本机：宿主存档要异步拉，宿主先渲染的标签（头部视图名、侧栏名）也能一开始就对
  const LOCALE_KEY = 'sansheng-liubu.locale';
  let currentLocale = (() => {
    try {
      const saved = localStorage.getItem(LOCALE_KEY);
      if (saved === 'zh' || saved === 'en') return saved;
      return /^zh/i.test(navigator.language || '') ? 'zh' : 'en';
    } catch {
      return 'zh';
    }
  })();

  async function apiJson(path, options = {}) {
    // Content-Type 必须是 JSON：宿主半据此拒绝跨站表单请求；X-Court-Locale 让报错按当前语言返回
    const res = await fetch(API + path, {
      headers: { 'Content-Type': 'application/json', 'X-Court-Locale': currentLocale },
      ...options,
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  // ---------- 样式：插件自己的 .ssl-* 类，颜色全部取 DSH 语义 token，自动适配明暗与主题 ----------
  // 只作用于本插件渲染的节点，不覆盖 DSH 自身的任何样式。
  const STYLE_ID = 'sansheng-liubu-style';
  const CSS = `
.ssl, .ssl-overlay {
  --ssl-fg: var(--dsw-alias-label-primary, #1f2328);
  --ssl-fg2: var(--dsw-alias-label-secondary, #4b5563);
  --ssl-mut: var(--dsw-alias-label-tertiary, #6b7280);
  --ssl-cap: var(--dsw-alias-label-caption, #9ca3af);
  --ssl-line: var(--dsw-alias-border-l1, rgba(0,0,0,.08));
  --ssl-line2: var(--dsw-alias-border-l2, rgba(0,0,0,.14));
  --ssl-line3: var(--dsw-alias-border-l3, rgba(0,0,0,.2));
  --ssl-panel: var(--dsw-alias-bg-layer-1, #fff);
  --ssl-sunken: var(--dsw-alias-bg-layer-2, #f4f4f2);
  --ssl-raised: var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-layer-1, #fff));
  --ssl-hover: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,.04));
  --ssl-brand: var(--dsw-alias-brand-primary, #1f2328);
  --ssl-brand-fg: var(--dsw-alias-brand-primary-invert, #fff);
  --ssl-seal: var(--dsw-alias-state-business-primary, #b4362b);
  --ssl-ok: var(--dsw-alias-state-success-primary, #2f7d4f);
  --ssl-warn: var(--dsw-alias-state-warn-primary, #b7791f);
  --ssl-err: var(--dsw-alias-state-error-primary, #c0392b);
  --ssl-info: var(--dsw-alias-button-info-fill, #3d6f8e);
  --ssl-serif: "Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", "SimSun", serif;
  --ssl-mono: "Cascadia Mono", "JetBrains Mono", Consolas, ui-monospace, monospace;
  --sc-serif: "Palatino Linotype", "Book Antiqua", Palatino, Georgia, "Times New Roman", serif;
  color: var(--ssl-fg);
  font-size: 13px;
  line-height: 1.55;
}
/* DSH 不给插件元素设 border-box：外层自己也要设，否则 width:100% 再加内边距会把右边挤出窗口 */
.ssl, .ssl *, .ssl-root, .ssl-scroll, .ssl-overlay, .ssl-overlay *, [class*="ssl-"] { box-sizing: border-box; }
/* min-width: 0：宿主容器若是 flex，单行省略的长标题会按全文宽度撑开整页 */
.ssl { padding: 22px 28px 96px; max-width: 1200px; min-width: 0; width: 100%; margin: 0 auto; }
/* 外壳自己滚动，并作为容器查询的基准：宽窄按插件实际拿到的宽度算，而不是整个窗口（DSH 侧栏、右侧面板都会吃掉宽度） */
.ssl-root { container-type: inline-size; flex: 1 1 auto; width: 100%; min-width: 0; height: 100%; overflow-x: hidden; overflow-y: auto; }
.ssl-root.is-embedded { height: auto; overflow: visible; }

/* 头部 */
.ssl-head { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.ssl-seal {
  width: 42px; height: 42px; flex: 0 0 42px; border-radius: 9px; display: grid; place-items: center;
  background: var(--ssl-seal); color: #fff; font: 700 22px/1 var(--ssl-serif);
  box-shadow: inset 0 0 0 2px color-mix(in srgb, #fff 22%, transparent), 0 2px 8px color-mix(in srgb, var(--ssl-seal) 30%, transparent);
}
.ssl-head-text { flex: 1; min-width: 220px; }
.ssl-h1 { margin: 0; font: 700 20px/1.3 var(--ssl-serif); letter-spacing: .04em; color: var(--ssl-fg); }
.ssl-sub { margin: 2px 0 0; font-size: 12.5px; color: var(--ssl-mut); }
.ssl-stats { display: flex; gap: 8px; }
.ssl-stat {
  min-width: 74px; padding: 7px 12px; border-radius: 10px; border: 1px solid var(--ssl-line);
  background: var(--ssl-panel); text-align: left;
}
.ssl-stat b { display: block; font-size: 18px; line-height: 1.2; font-variant-numeric: tabular-nums; color: var(--ssl-fg); }
.ssl-stat span { font-size: 11px; color: var(--ssl-mut); }
.ssl-stat--warn b { color: var(--ssl-warn); }
.ssl-stat--seal b { color: var(--ssl-seal); }

/* 页签：照 DSH 插件市场的样子，纯文字，选中加粗 + 下划线；放不下就横向滑动 */
.ssl-nav {
  display: flex; gap: 4px 26px; margin: 18px 0 18px; padding: 0 2px; max-width: 100%;
  overflow-x: auto; overflow-y: hidden; scrollbar-width: none;
}
.ssl-nav::-webkit-scrollbar { display: none; }
.ssl-nav button {
  position: relative; flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 6px 0 9px; border: 0;
  background: transparent; color: var(--ssl-fg2); font: inherit; font-size: 14.5px; cursor: pointer; white-space: nowrap;
  transition: color .15s;
}
.ssl-nav button:hover { color: var(--ssl-fg); }
.ssl-nav button.is-active { color: var(--ssl-fg); font-weight: 700; }
.ssl-nav button.is-active::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 2px; border-radius: 1px; background: currentColor;
}
.ssl-count {
  min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; display: inline-grid; place-items: center;
  font-size: 11px; font-weight: 600; background: color-mix(in srgb, var(--ssl-warn) 18%, transparent); color: var(--ssl-warn);
}
.ssl-count--seal { background: color-mix(in srgb, var(--ssl-seal) 16%, transparent); color: var(--ssl-seal); }

/* 卡片与分区 */
.ssl-card {
  background: var(--ssl-panel); border: 1px solid var(--ssl-line); border-radius: 12px; padding: 16px 18px;
  transition: border-color .2s, box-shadow .2s;
}
.ssl-card + .ssl-card { margin-top: 12px; }
.ssl-card-h { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.ssl-card-t { margin: 0; font-size: 14px; font-weight: 600; color: var(--ssl-fg); }
.ssl-section { display: flex; align-items: center; gap: 10px; margin: 26px 0 10px; }
.ssl-section h3 { margin: 0; flex: none; white-space: nowrap; font: 600 14px/1 var(--ssl-serif); letter-spacing: .12em; color: var(--ssl-fg); }
.ssl-section span { min-width: 0; }
.ssl-section span { font-size: 12px; color: var(--ssl-mut); }
.ssl-section::after { content: ""; flex: 1; height: 1px; background: var(--ssl-line); }
.ssl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(268px, 100%), 1fr)); gap: 12px; }
.ssl-grid > .ssl-card + .ssl-card { margin-top: 0; }
.ssl-cols { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr); gap: 12px; align-items: start; }
.ssl-cols > .ssl-card + .ssl-card { margin-top: 0; }
.ssl-row { display: flex; gap: 12px; align-items: flex-start; }
.ssl-grow { flex: 1; min-width: 0; }
.ssl-between { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.ssl-caption { font-size: 12px; color: var(--ssl-mut); }
.ssl-muted { color: var(--ssl-mut); }
.ssl-ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ssl-mono { font-family: var(--ssl-mono); font-size: 11.5px; }
.ssl-empty { padding: 22px 12px; text-align: center; color: var(--ssl-mut); font-size: 12.5px; }

/* 表单 */
.ssl-field { display: block; margin-top: 10px; }
.ssl-label { display: block; margin-bottom: 4px; font-size: 11.5px; font-weight: 500; color: var(--ssl-mut); }
.ssl-input {
  width: 100%; padding: 7px 10px; border-radius: 8px; border: 1px solid var(--ssl-line2);
  background: var(--ssl-panel); color: var(--ssl-fg); font: inherit; font-size: 13px; outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.ssl-input:hover { border-color: var(--ssl-line3); }
.ssl-input:focus { border-color: var(--ssl-brand); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ssl-brand) 14%, transparent); }
.ssl-input:disabled { opacity: .55; cursor: not-allowed; }
.ssl-input::placeholder { color: var(--ssl-cap); }
textarea.ssl-input { min-height: 96px; resize: vertical; line-height: 1.6; }
select.ssl-input { cursor: pointer; }
.ssl-hint { margin-top: 6px; font-size: 11.5px; color: var(--ssl-warn); }

/* 按钮 */
.ssl-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0 14px;
  border-radius: 8px; border: 1px solid var(--ssl-line2); background: var(--ssl-panel); color: var(--ssl-fg);
  font: inherit; font-size: 13px; cursor: pointer; white-space: nowrap; transition: background .15s, border-color .15s, opacity .15s;
}
.ssl-btn:hover:not(:disabled) { background: var(--ssl-hover); border-color: var(--ssl-line3); }
.ssl-btn:disabled { opacity: .45; cursor: not-allowed; }
.ssl-btn:focus-visible { outline: 2px solid var(--ssl-brand); outline-offset: 2px; }
.ssl-btn--primary { background: var(--ssl-brand); border-color: var(--ssl-brand); color: var(--ssl-brand-fg); font-weight: 600; }
.ssl-btn--primary:hover:not(:disabled) { background: var(--ssl-brand); filter: brightness(1.08); }
.ssl-btn--seal { background: var(--ssl-seal); border-color: var(--ssl-seal); color: #fff; font-weight: 600; }
.ssl-btn--seal:hover:not(:disabled) { background: var(--ssl-seal); filter: brightness(1.08); }
.ssl-btn--danger { color: var(--ssl-err); border-color: color-mix(in srgb, var(--ssl-err) 40%, transparent); }
.ssl-btn--danger:hover:not(:disabled) { background: color-mix(in srgb, var(--ssl-err) 8%, transparent); border-color: var(--ssl-err); }
.ssl-btn--ghost { border-color: transparent; background: transparent; color: var(--ssl-fg2); }
.ssl-btn--sm { height: 26px; padding: 0 10px; font-size: 12px; border-radius: 7px; }

/* 状态 */
.ssl-pill {
  display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 9px; border-radius: 11px;
  font-size: 11.5px; font-weight: 500; white-space: nowrap; color: var(--ssl-mut);
  background: color-mix(in srgb, var(--ssl-mut) 12%, transparent);
}
.ssl-pill--warn { color: var(--ssl-warn); background: color-mix(in srgb, var(--ssl-warn) 14%, transparent); }
.ssl-pill--ok { color: var(--ssl-ok); background: color-mix(in srgb, var(--ssl-ok) 14%, transparent); }
.ssl-pill--err { color: var(--ssl-err); background: color-mix(in srgb, var(--ssl-err) 13%, transparent); }
.ssl-pill--seal { color: var(--ssl-seal); background: color-mix(in srgb, var(--ssl-seal) 13%, transparent); }
.ssl-pill--info { color: var(--ssl-info); background: color-mix(in srgb, var(--ssl-info) 14%, transparent); }
.ssl-pill--plain { color: var(--ssl-fg2); background: transparent; border: 1px solid var(--ssl-line2); }
.ssl-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex: 0 0 6px; }
.ssl-dot--pulse { animation: ssl-pulse 1.4s ease-in-out infinite; }
@keyframes ssl-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .3; transform: scale(.75); } }

/* 流程条 */
.ssl-flow { display: flex; align-items: flex-start; gap: 0; overflow-x: auto; padding: 2px 0; }
.ssl-flow-step { flex: 1; min-width: 76px; display: flex; flex-direction: column; align-items: center; gap: 6px; position: relative; }
.ssl-flow-step::before {
  content: ""; position: absolute; top: 11px; right: 50%; width: 100%; height: 2px; background: var(--ssl-line2); z-index: 0;
}
.ssl-flow-step:first-child::before { display: none; }
.ssl-flow-step.is-done::before, .ssl-flow-step.is-active::before, .ssl-flow-step.is-halted::before { background: var(--ssl-ok); }
.ssl-flow-node {
  position: relative; z-index: 1; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center;
  font-size: 11px; font-weight: 700; background: var(--ssl-panel); border: 2px solid var(--ssl-line2); color: var(--ssl-mut);
}
.ssl-flow-step.is-done .ssl-flow-node { background: var(--ssl-ok); border-color: var(--ssl-ok); color: #fff; }
.ssl-flow-step.is-active .ssl-flow-node {
  border-color: var(--ssl-warn); color: var(--ssl-warn);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--ssl-warn) 18%, transparent); animation: ssl-ring 1.6s ease-in-out infinite;
}
.ssl-flow-step.is-halted .ssl-flow-node { background: var(--ssl-err); border-color: var(--ssl-err); color: #fff; }
.ssl-flow-label { font-size: 11.5px; color: var(--ssl-mut); white-space: nowrap; }
.ssl-flow-step.is-active .ssl-flow-label, .ssl-flow-step.is-done .ssl-flow-label { color: var(--ssl-fg); }
.ssl-flow-step.is-active .ssl-flow-label { font-weight: 600; }
.ssl-flow-step.is-halted .ssl-flow-label { color: var(--ssl-err); font-weight: 600; }
@keyframes ssl-ring { 0%, 100% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--ssl-warn) 20%, transparent); } 50% { box-shadow: 0 0 0 7px color-mix(in srgb, var(--ssl-warn) 6%, transparent); } }

/* 官职卡 */
.ssl-role { display: flex; flex-direction: column; }
.ssl-role.is-live { border-color: color-mix(in srgb, var(--ssl-warn) 65%, transparent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ssl-warn) 10%, transparent); }
.ssl-role-head { display: flex; align-items: center; gap: 11px; }
.ssl-glyph {
  width: 36px; height: 36px; flex: 0 0 36px; border-radius: 9px; display: grid; place-items: center;
  font: 700 18px/1 var(--ssl-serif); color: var(--ssl-fg); background: var(--ssl-sunken); border: 1px solid var(--ssl-line);
}
.ssl-role.is-live .ssl-glyph { color: var(--ssl-warn); background: color-mix(in srgb, var(--ssl-warn) 10%, transparent); border-color: color-mix(in srgb, var(--ssl-warn) 30%, transparent); }
.ssl-role-title { font-size: 14px; font-weight: 600; color: var(--ssl-fg); }
.ssl-inline {
  display: block; width: 100%; margin: 1px 0 0 -5px; padding: 1px 5px; border: 1px solid transparent; border-radius: 5px;
  background: transparent; color: var(--ssl-mut); font: inherit; font-size: 12px; text-overflow: ellipsis; outline: none;
}
.ssl-inline:hover { border-color: var(--ssl-line2); }
.ssl-inline:focus { border-color: var(--ssl-brand); background: var(--ssl-panel); color: var(--ssl-fg); }
.ssl-rules { display: grid; grid-template-columns: minmax(0, 1.4fr) repeat(3, minmax(0, 1fr)); gap: 0 14px; align-items: end; }
.ssl-rules .ssl-field { margin-top: 0; }
.ssl-auto { display: flex; align-items: center; gap: 12px; }
.ssl-card.is-auto { border-color: color-mix(in srgb, var(--ssl-ok) 45%, transparent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ssl-ok) 8%, transparent); }
.ssl-role-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 0 10px; }
.ssl-live { margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--ssl-line2); }

/* 终端输出 */
.ssl-term {
  margin: 6px 0 0; padding: 10px 12px; border-radius: 9px; background: #16171b; color: #d6d3cd;
  font: 11.5px/1.6 var(--ssl-mono); white-space: pre-wrap; word-break: break-word; overflow: auto;
  border: 1px solid rgba(255,255,255,.06);
}
.ssl-term::-webkit-scrollbar { width: 8px; }
.ssl-term::-webkit-scrollbar-thumb { background: rgba(255,255,255,.14); border-radius: 4px; }
.ssl-term--empty { color: #8a8780; font-style: italic; }
.ssl-doc {
  margin: 0; padding: 14px 16px; border-radius: 9px; background: var(--ssl-sunken); border: 1px solid var(--ssl-line);
  font: 12px/1.7 var(--ssl-mono); color: var(--ssl-fg); white-space: pre-wrap; word-break: break-word; max-height: 460px; overflow: auto;
}

/* 列表 */
.ssl-list { display: flex; flex-direction: column; gap: 2px; }
.ssl-item {
  display: block; width: 100%; text-align: left; padding: 10px 12px; border-radius: 9px; border: 1px solid transparent;
  background: transparent; color: inherit; font: inherit; cursor: pointer; transition: background .15s, border-color .15s;
}
.ssl-item:hover { background: var(--ssl-hover); }
.ssl-item.is-active { background: var(--ssl-panel); border-color: var(--ssl-line2); box-shadow: inset 3px 0 0 var(--ssl-seal); }
.ssl-item-t { font-size: 13px; font-weight: 500; color: var(--ssl-fg); }
.ssl-item-m { display: flex; align-items: center; gap: 8px; margin-top: 5px; font-size: 11.5px; color: var(--ssl-mut); }

/* 奏折 */
.ssl-split { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 16px; align-items: start; }
.ssl-side { position: sticky; top: 12px; max-height: calc(100vh - 40px); overflow: auto; padding: 8px; background: var(--ssl-sunken); border: 1px solid var(--ssl-line); border-radius: 12px; }
.ssl-filter { display: flex; gap: 4px; flex-wrap: wrap; padding: 2px 2px 8px; }
.ssl-chip {
  height: 24px; padding: 0 10px; border-radius: 12px; border: 1px solid var(--ssl-line2); background: transparent;
  color: var(--ssl-mut); font: inherit; font-size: 12px; cursor: pointer;
}
.ssl-chip:hover { color: var(--ssl-fg); }
.ssl-chip.is-active { background: var(--ssl-fg); border-color: var(--ssl-fg); color: var(--ssl-panel); }
.ssl-brief { margin: 0; font: 600 16px/1.5 var(--ssl-serif); color: var(--ssl-fg); }
.ssl-meta { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 6px; font-size: 12px; color: var(--ssl-mut); }
.ssl-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.ssl-alert {
  margin-top: 12px; padding: 10px 12px; border-radius: 9px; font-size: 12.5px;
  color: var(--ssl-err); background: color-mix(in srgb, var(--ssl-err) 8%, transparent); border: 1px solid color-mix(in srgb, var(--ssl-err) 22%, transparent);
}
.ssl-alert--info { color: var(--ssl-fg2); background: var(--ssl-sunken); border-color: var(--ssl-line); }
.ssl-detail-cols { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 12px; margin-top: 12px; align-items: start; }
.ssl-detail-cols > .ssl-card + .ssl-card, .ssl-stack > .ssl-card + .ssl-card { margin-top: 12px; }

/* 公文往来时间线 */
.ssl-tl { position: relative; padding-left: 18px; }
.ssl-tl::before { content: ""; position: absolute; left: 5px; top: 6px; bottom: 6px; width: 1px; background: var(--ssl-line2); }
.ssl-tl-item { position: relative; padding: 0 0 14px; }
.ssl-tl-item:last-child { padding-bottom: 0; }
.ssl-tl-item::before {
  content: ""; position: absolute; left: -17px; top: 6px; width: 9px; height: 9px; border-radius: 50%;
  background: var(--ssl-panel); border: 2px solid var(--ssl-line3);
}
.ssl-tl-item.tone-ok::before { border-color: var(--ssl-ok); }
.ssl-tl-item.tone-err::before { border-color: var(--ssl-err); background: var(--ssl-err); }
.ssl-tl-item.tone-warn::before { border-color: var(--ssl-warn); }
.ssl-tl-item.tone-seal::before { border-color: var(--ssl-seal); background: var(--ssl-seal); }
.ssl-tl-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12.5px; }
.ssl-tl-route { font-weight: 600; color: var(--ssl-fg); }
.ssl-tl-route i { font-style: normal; color: var(--ssl-cap); margin: 0 4px; }
.ssl-tl-body { margin-top: 3px; font-size: 12.5px; color: var(--ssl-fg2); line-height: 1.6; }
.ssl-tl-foot { display: flex; align-items: center; gap: 10px; margin-top: 4px; font-size: 11.5px; color: var(--ssl-cap); }
.ssl-link { padding: 0; border: 0; background: none; color: var(--ssl-brand); font: inherit; font-size: 11.5px; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }

/* 六部差事 */
.ssl-steps { display: flex; flex-direction: column; }
.ssl-step { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-top: 1px solid var(--ssl-line); }
.ssl-step:first-child { border-top: 0; padding-top: 2px; }
.ssl-step-no { width: 22px; height: 22px; flex: 0 0 22px; border-radius: 6px; display: grid; place-items: center; font-size: 11px; font-weight: 600; background: var(--ssl-sunken); color: var(--ssl-mut); }

/* 产物 */
.ssl-files { display: flex; flex-wrap: wrap; gap: 6px; }
.ssl-file {
  display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 7px;
  border: 1px solid var(--ssl-line2); background: var(--ssl-panel); color: var(--ssl-fg2); font: 12px var(--ssl-mono); cursor: pointer;
}
.ssl-file:hover { border-color: var(--ssl-line3); color: var(--ssl-fg); }
.ssl-file.is-active { border-color: var(--ssl-brand); color: var(--ssl-fg); box-shadow: 0 0 0 2px color-mix(in srgb, var(--ssl-brand) 14%, transparent); }

/* 朝会记录 */
.ssl-details > summary { cursor: pointer; list-style: none; display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; }
.ssl-details > summary::-webkit-details-marker { display: none; }
.ssl-details > summary::before { content: "▸"; color: var(--ssl-mut); transition: transform .15s; }
.ssl-details[open] > summary::before { transform: rotate(90deg); }
.ssl-events { margin-top: 10px; display: grid; grid-template-columns: auto auto 1fr; gap: 4px 12px; font-size: 12px; }
.ssl-events .t { color: var(--ssl-cap); font-variant-numeric: tabular-nums; }
.ssl-events .k { color: var(--ssl-fg); font-weight: 500; }
.ssl-events .d { color: var(--ssl-mut); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 殿宇 */
.ssl-swatch {
  height: 74px; border-radius: 8px; overflow: hidden; display: flex; border: 1px solid var(--ssl-line2); margin-bottom: 12px;
}
.ssl-swatch-side { width: 26%; padding: 8px 6px; display: flex; flex-direction: column; gap: 5px; }
.ssl-swatch-main { flex: 1; padding: 9px 10px; display: flex; flex-direction: column; gap: 6px; }
.ssl-swatch-line { height: 5px; border-radius: 3px; }
.ssl-pick { cursor: pointer; text-align: left; font: inherit; color: inherit; width: 100%; }
.ssl-pick:hover { border-color: var(--ssl-line3); }
.ssl-skin-preview .ssl-swatch { margin-bottom: 0; }
.ssl-pick.is-active { border-color: var(--ssl-seal); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ssl-seal) 14%, transparent); }
.ssl-feature { display: flex; gap: 10px; padding: 10px 0; border-top: 1px solid var(--ssl-line); }
.ssl-feature:first-child { border-top: 0; padding-top: 0; }
.ssl-feature b { display: block; font-size: 13px; font-weight: 600; color: var(--ssl-fg); }
.ssl-feature span { font-size: 12px; color: var(--ssl-mut); }

/* 群臣 */
.ssl-agent.is-off { opacity: .66; }
/* 群臣卡片默认收起成一行，点名字或 ▾ 展开 */
.ssl-agents { grid-template-columns: repeat(auto-fill, minmax(min(340px, 100%), 1fr)); align-items: start; }
.ssl-agent { padding: 12px 14px; }
.ssl-agent.is-open { grid-column: 1 / -1; padding: 16px 18px; }
.ssl-agent .ssl-role-head { align-items: center; }
.ssl-agent-toggle { display: block; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.ssl-agent-toggle .ssl-role-title { display: flex; align-items: center; gap: 6px; }
.ssl-agent-toggle .ssl-dot.is-ok { color: var(--ssl-ok); }
.ssl-agent-toggle .ssl-dot.is-err { color: var(--ssl-err); }
.ssl-chevron { width: 28px; padding: 0; justify-content: center; font-size: 15px; }
.ssl-agent-fields { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 0 12px; }
.ssl-probe { margin-top: 10px; display: flex; align-items: center; gap: 8px; font-size: 12px; }
.ssl-switch { position: relative; width: 34px; height: 20px; flex: 0 0 34px; }
.ssl-switch input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: pointer; z-index: 1; }
.ssl-switch span { position: absolute; inset: 0; border-radius: 10px; background: var(--ssl-line3); transition: background .15s; }
.ssl-switch span::after {
  content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff;
  box-shadow: 0 1px 2px rgba(0,0,0,.25); transition: transform .15s;
}
.ssl-switch input:checked + span { background: var(--ssl-ok); }
.ssl-switch input:checked + span::after { transform: translateX(14px); }
.ssl-switch input:focus-visible + span { outline: 2px solid var(--ssl-brand); outline-offset: 2px; }
.ssl-savebar {
  position: sticky; bottom: 12px; z-index: 5; margin-top: 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 12px 10px 16px; border-radius: 12px; background: var(--ssl-raised); border: 1px solid var(--ssl-line2);
  box-shadow: 0 8px 24px rgba(0,0,0,.12);
}

/* 奏折式下旨框：锦缎封面 + 经折装宣纸 + 朱丝栏，竖排右起书写，朱印落款即下旨。
   纸张在任何主题下都是浅色实物，墨色固定，不跟主题走。 */
.zz { position: relative; }
.zz-book {
  position: relative; padding: 9px 13px; border-radius: 7px;
  background:
    radial-gradient(circle at 25% 25%, rgba(255, 240, 185, .55) 0 1.5px, transparent 2.5px) 0 0 / 11px 11px,
    radial-gradient(circle at 75% 75%, rgba(110, 62, 0, .32) 0 1.5px, transparent 2.5px) 0 0 / 11px 11px,
    linear-gradient(180deg, #ddb03a, #b8821a 55%, #a06d12);
  box-shadow: 0 1px 0 rgba(255, 255, 255, .25) inset, 0 10px 26px rgba(40, 20, 0, .28), 0 2px 5px rgba(40, 20, 0, .2);
}
.zz-paper {
  position: relative; display: flex; flex-direction: row-reverse; height: 232px; overflow: hidden; border-radius: 2px;
  color: #2b1d12;
  background:
    linear-gradient(90deg, rgba(95, 62, 22, .07), transparent 14%, transparent 86%, rgba(95, 62, 22, .07)) 0 0 / 136px 100%,
    radial-gradient(ellipse at 30% 20%, rgba(255, 252, 240, .7), transparent 60%),
    #f4e8cf;
  box-shadow:
    inset 0 7px 0 #f4e8cf, inset 0 9px 0 rgba(168, 46, 34, .55),
    inset 0 -7px 0 #f4e8cf, inset 0 -9px 0 rgba(168, 46, 34, .55),
    inset 0 0 0 1px rgba(95, 62, 22, .18);
  transition: box-shadow .2s;
}
.zz-book:focus-within { box-shadow: 0 1px 0 rgba(255, 255, 255, .25) inset, 0 0 0 3px rgba(224, 180, 70, .35), 0 12px 30px rgba(40, 20, 0, .32); }
.zz-head, .zz-tail {
  flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: space-between;
  padding: 20px 0 18px; writing-mode: vertical-rl;
}
/* 竖排下 flex 会把标题压到一个字高、拆成多列，必须禁止收缩与换行 */
.zz-head > *, .zz-tail > * { flex: none; white-space: nowrap; }
.zz-head { width: 62px; border-left: 1px solid rgba(168, 46, 34, .45); flex-direction: row; justify-content: flex-start; gap: 10px; }
.zz-title { font: 700 23px/1 var(--ssl-serif); letter-spacing: .45em; color: #9c2f24; }
.zz-sub { font: 12.5px/1.4 var(--ssl-serif); letter-spacing: .18em; color: #8a6a45; }
.zz-tail { width: 86px; border-right: 1px solid rgba(168, 46, 34, .45); flex-direction: row; justify-content: space-between; padding-left: 12px; padding-right: 12px; }
.zz-date { font: 12.5px/1.2 var(--ssl-serif); letter-spacing: .12em; color: #8a6a45; }
.zz-text {
  flex: 1; min-width: 0; height: 100%; margin: 0; padding: 20px 0 18px; border: 0; outline: none; resize: none;
  writing-mode: vertical-rl; overflow-x: auto; overflow-y: hidden;
  font: 400 18px/34px var(--ssl-serif); letter-spacing: .08em; color: #2b1d12; caret-color: #9c2f24;
  background: repeating-linear-gradient(to left, transparent 0 33px, rgba(168, 46, 34, .32) 33px 34px);
  background-attachment: local;
}
.zz-text::placeholder { color: rgba(110, 76, 40, .42); }
.zz-text::-webkit-scrollbar { height: 6px; }
.zz-text::-webkit-scrollbar-thumb { background: rgba(156, 47, 36, .25); border-radius: 3px; }
.zz-text:disabled { cursor: not-allowed; }
.zz-seal {
  writing-mode: horizontal-tb; position: relative; width: 58px; height: 58px; padding: 0; border-radius: 6px; cursor: pointer;
  display: grid; place-items: center; color: #fff6ea; font: 700 19px/1 var(--ssl-serif);
  background: radial-gradient(circle at 35% 30%, #d4513f, #a72a1d 70%);
  border: 0; box-shadow: inset 0 0 0 3px rgba(255, 236, 214, .55), inset 0 0 0 5px #a72a1d, 0 3px 8px rgba(120, 20, 10, .35);
  transform: rotate(-4deg); transition: transform .15s, filter .15s, opacity .15s;
}
.zz-seal span { writing-mode: vertical-rl; letter-spacing: .12em; }
.zz-seal:hover:not(:disabled) { transform: rotate(-4deg) scale(1.06); filter: brightness(1.08); }
.zz-seal:active:not(:disabled) { transform: rotate(-4deg) scale(.96); }
.zz-seal:disabled { cursor: not-allowed; opacity: .38; filter: grayscale(.4); }
.zz-seal:focus-visible { outline: 2px solid #e0b446; outline-offset: 3px; }
.zz-stamp {
  position: absolute; left: 34%; top: 50%; width: 104px; height: 104px; margin: -52px 0 0 -52px; pointer-events: none;
  display: grid; place-items: center; border: 5px solid #c0392b; border-radius: 10px; color: #c0392b;
  font: 800 62px/1 var(--ssl-serif); mix-blend-mode: multiply; opacity: 0;
  box-shadow: inset 0 0 0 3px rgba(244, 232, 207, .9), inset 0 0 0 6px #c0392b;
  animation: zz-stamp 2.4s cubic-bezier(.2, .8, .3, 1) forwards;
}
@keyframes zz-stamp {
  0% { opacity: 0; transform: scale(2.3) rotate(-14deg); }
  22% { opacity: .92; transform: scale(.94) rotate(-14deg); }
  30% { transform: scale(1) rotate(-14deg); }
  80% { opacity: .9; }
  100% { opacity: 0; transform: scale(1) rotate(-14deg); }
}
.zz-slips { display: flex; flex-wrap: wrap; gap: 0 12px; margin-top: 4px; }
.zz-slips > * { flex: 1; min-width: 180px; }
.zz-caption { margin-top: 10px; font-size: 12px; color: var(--ssl-mut); }
/* 窄处（右侧面板）用横排信笺 */
.zz--compact .zz-book { padding: 7px 10px; }
.zz--compact .zz-paper { height: 128px; }
.zz--compact .zz-head { width: 40px; padding: 14px 0; }
.zz--compact .zz-title { font-size: 17px; }
.zz--compact .zz-sub { display: none; }
.zz--compact .zz-tail { width: 64px; padding: 0 8px; justify-content: center; }
.zz--compact .zz-date { display: none; }
.zz--compact .zz-seal { width: 46px; height: 46px; font-size: 15px; }
.zz--compact .zz-text {
  writing-mode: horizontal-tb; overflow-x: hidden; overflow-y: auto; padding: 12px 12px 10px;
  font-size: 14.5px; line-height: 28px;
  background: repeating-linear-gradient(to bottom, transparent 0 27px, rgba(168, 46, 34, .28) 27px 28px);
  background-position: 0 12px; background-attachment: local;
}
.zz--compact .zz-stamp { width: 70px; height: 70px; margin: -35px 0 0 -35px; font-size: 40px; left: 46%; }

/* 提示条 */
.ssl-toast {
  position: fixed; left: 50%; bottom: 84px; transform: translateX(-50%); z-index: 90; max-width: min(560px, 90vw);
  display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 10px; font-size: 13px;
  background: var(--dsw-alias-toast-bg, #2b2b2b); color: var(--dsw-alias-toast-label, #fff); box-shadow: 0 10px 30px rgba(0,0,0,.25);
  animation: ssl-in .18s ease-out;
}
.ssl-toast .ssl-dot { width: 8px; height: 8px; flex-basis: 8px; }
.ssl-toast--ok .ssl-dot { background: #5fc48a; }
.ssl-toast--err .ssl-dot { background: #f2776b; }
@keyframes ssl-in { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }

/* 浮层：值房胶囊 + 下旨弹窗 */
.ssl-hud { position: fixed; right: 18px; bottom: 18px; z-index: 60; }
.ssl-hud-pill {
  display: flex; align-items: center; gap: 8px; height: 34px; padding: 0 14px 0 12px; border-radius: 17px; cursor: pointer;
  border: 1px solid var(--ssl-line2); background: var(--ssl-raised); color: var(--ssl-fg); font: inherit; font-size: 12.5px;
  box-shadow: 0 6px 20px rgba(0,0,0,.16);
}
.ssl-hud-pill .ssl-dot { color: var(--ssl-warn); width: 8px; height: 8px; flex-basis: 8px; }
.ssl-hud-panel {
  position: absolute; right: 0; bottom: 44px; width: 340px; max-height: 56vh; overflow: auto; padding: 12px;
  border-radius: 14px; border: 1px solid var(--ssl-line2); background: var(--ssl-raised); box-shadow: 0 14px 40px rgba(0,0,0,.22);
  animation: ssl-up .16s ease-out;
}
.ssl-hud-item + .ssl-hud-item { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--ssl-line); }
@keyframes ssl-up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.ssl-mask {
  position: fixed; inset: 0; z-index: 80; display: flex; align-items: center; justify-content: center; padding: 16px;
  background: var(--dsw-alias-bg-mask-1, rgba(0,0,0,.36)); animation: ssl-fade .15s ease-out;
}
@keyframes ssl-fade { from { opacity: 0; } to { opacity: 1; } }
.ssl-modal {
  width: 640px; max-width: 100%; padding: 20px 22px; border-radius: 16px; border: 1px solid var(--ssl-line2);
  background: var(--ssl-panel); box-shadow: 0 24px 70px rgba(0,0,0,.3); animation: ssl-up .18s ease-out;
}
.ssl-modal-h { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
.ssl-modal-h .ssl-seal { width: 34px; height: 34px; flex-basis: 34px; font-size: 18px; border-radius: 8px; }
.ssl-header-btn {
  display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 10px; border-radius: 7px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.14)); background: transparent; cursor: pointer;
  color: var(--dsw-alias-label-secondary, #4b5563); font: inherit; font-size: 12px; white-space: nowrap; flex-shrink: 0;
}
.ssl-header-btn:hover { color: var(--dsw-alias-label-primary, #1f2328); background: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,.04)); }
.ssl-header-btn b { width: 16px; height: 16px; border-radius: 4px; display: grid; place-items: center; background: var(--dsw-alias-state-business-primary, #b4362b); color: #fff; font: 700 10px/1 var(--ssl-serif, serif); }

/* 头部视图与右侧面板：宿主给的是一块定高区域，滚动由我们自己管 */
.ssl-scroll { container-type: inline-size; height: 100%; overflow-x: hidden; overflow-y: auto; }
.ssl.ssl-view { padding-top: 18px; }
.ssl.ssl-pane { padding: 12px 12px 40px; max-width: none; }
.ssl-pane .ssl-card { padding: 14px; }
.ssl-pane .ssl-flow-step { min-width: 50px; }
.ssl-pane .ssl-flow-label { font-size: 10.5px; }
.ssl-view-head { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
.ssl-seal--sm { width: 32px; height: 32px; flex-basis: 32px; font-size: 17px; border-radius: 8px; }
.ssl-seal--xs { width: 16px; height: 16px; flex-basis: 16px; font-size: 10px; border-radius: 4px; box-shadow: none; }
.ssl-pane-title { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; line-height: 1; }

/* 钦定流程 */
.ssl-chain { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 10px 12px; margin-bottom: 8px; border-radius: 9px; background: var(--ssl-sunken); }
.ssl-chain-node { padding: 3px 9px; border-radius: 11px; font-size: 12px; color: var(--ssl-fg); background: var(--ssl-panel); border: 1px solid var(--ssl-line2); }
.ssl-chain-node.is-fixed { color: var(--ssl-mut); border-style: dashed; }
.ssl-chain-arrow { color: var(--ssl-cap); font-size: 12px; }
.ssl-wf-row { display: grid; grid-template-columns: 22px 120px minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 7px 0; border-top: 1px solid var(--ssl-line); }

/* 各部门沟通 */
.ssl.ssl-chat { position: relative; height: 100%; display: flex; flex-direction: column; padding: 0; max-width: none; }
.ssl-chat-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--ssl-line); }
.ssl-chat-head .ssl-input { flex: 1; min-width: 0; height: 30px; padding: 0 8px; }
.ssl-chat-list { flex: 1; min-height: 0; overflow: auto; padding: 14px 12px 6px; }
.ssl-chat-compose { padding: 10px 12px 12px; border-top: 1px solid var(--ssl-line); background: var(--ssl-panel); }
.ssl-msg { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 14px; }
.ssl-msg.is-mine { flex-direction: row-reverse; }
.ssl-avatar {
  width: 28px; height: 28px; flex: 0 0 28px; border-radius: 8px; display: grid; place-items: center;
  color: #fff; font: 700 13px/1 var(--ssl-serif); box-shadow: inset 0 0 0 1px rgba(255,255,255,.18);
}
.ssl-msg-main { min-width: 0; max-width: 86%; }
.ssl-msg.is-mine .ssl-msg-main { display: flex; flex-direction: column; align-items: flex-end; }
.ssl-msg-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 4px; font-size: 11px; color: var(--ssl-mut); }
.ssl-msg-meta b { color: var(--ssl-fg); font-weight: 600; font-size: 12px; }
.ssl-msg-meta .ssl-pill { height: 18px; padding: 0 7px; font-size: 10.5px; }
.ssl-bubble {
  padding: 8px 11px; border-radius: 4px 12px 12px 12px; background: var(--ssl-sunken); border: 1px solid var(--ssl-line);
  font-size: 12.5px; line-height: 1.6; color: var(--ssl-fg); white-space: pre-wrap; word-break: break-word;
}
.ssl-msg.is-mine .ssl-bubble {
  border-radius: 12px 4px 12px 12px; background: color-mix(in srgb, var(--ssl-seal) 14%, var(--ssl-panel));
  border-color: color-mix(in srgb, var(--ssl-seal) 30%, transparent);
}
.ssl-bubble.is-err { border-color: color-mix(in srgb, var(--ssl-err) 45%, transparent); }
.ssl-bubble.is-live { border-style: dashed; border-color: color-mix(in srgb, var(--ssl-warn) 50%, transparent); }
.ssl-bubble .ssl-mono { color: var(--ssl-fg2); margin-bottom: 4px; }
.ssl-bubble-foot { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px; font-size: 11px; color: var(--ssl-cap); }
.ssl-typing { display: inline-flex; gap: 3px; color: var(--ssl-warn); }
.ssl-typing i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; animation: ssl-pulse 1.2s ease-in-out infinite; }
.ssl-typing i:nth-child(2) { animation-delay: .2s; }
.ssl-typing i:nth-child(3) { animation-delay: .4s; }
.ssl-chat-doc {
  position: absolute; inset: 8px; z-index: 5; display: flex; flex-direction: column; border-radius: 12px;
  background: var(--ssl-raised); border: 1px solid var(--ssl-line2); box-shadow: 0 14px 40px rgba(0,0,0,.25);
}

/* 拉丁字母的印章：字多就缩小字号 */
.ssl-seal.is-latin { font-family: var(--sc-serif); letter-spacing: .04em; }
.ssl-glyph.is-latin, .ssl-avatar.is-latin { font-family: var(--sc-serif); font-size: 11px; letter-spacing: .02em; }
.ssl-glyph.is-latin { font-size: 12.5px; }
.ssl[data-locale="en"] .ssl-h1, .ssl[data-locale="en"] .ssl-section h3, .ssl[data-locale="en"] .ssl-brief { font-family: var(--sc-serif); letter-spacing: .02em; }
.ssl[data-locale="en"] .ssl-section h3 { letter-spacing: .14em; text-transform: uppercase; font-size: 12.5px; }

/* 语言切换 */
.ssl-lang { display: inline-flex; padding: 2px; border-radius: 8px; border: 1px solid var(--ssl-line2); background: var(--ssl-sunken); }
.ssl-lang button { height: 24px; padding: 0 10px; border: 0; border-radius: 6px; background: transparent; color: var(--ssl-mut); font: inherit; font-size: 12px; cursor: pointer; }
.ssl-lang button.is-active { background: var(--ssl-panel); color: var(--ssl-fg); font-weight: 600; box-shadow: 0 0 0 1px var(--ssl-line); }

/* 奏折横排（长路径、英文、代码片段写起来更顺） */
.zz--h .zz-text {
  writing-mode: horizontal-tb; overflow-x: hidden; overflow-y: auto; padding: 18px 16px 12px;
  font-size: 16px; line-height: 32px; letter-spacing: .02em;
  background: repeating-linear-gradient(to bottom, transparent 0 31px, rgba(168, 46, 34, .28) 31px 32px);
  background-position: 0 18px; background-attachment: local;
}
.zz-tools { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 10px; }
.zz-tools .zz-caption { margin-top: 0; }

/* 罗马卷轴下旨框：木轴 + 莎草纸 + 火漆印（SPQR），盖下去是一枚「APPROBATVM」 */
.sc { position: relative; }
.sc-scroll { position: relative; display: flex; align-items: stretch; filter: drop-shadow(0 10px 16px rgba(30, 15, 5, .28)); }
.sc-rod {
  position: relative; flex: 0 0 20px; border-radius: 10px; margin: 8px 0;
  background: linear-gradient(90deg, #2e1a0c, #7a4a20 30%, #c48a4a 50%, #7a4a20 72%, #2a170a);
}
.sc-rod::before, .sc-rod::after {
  content: ""; position: absolute; left: 50%; width: 30px; height: 15px; margin-left: -15px; border-radius: 8px;
  background: radial-gradient(circle at 40% 35%, #f6d985, #b8862f 60%, #6e4c14);
  box-shadow: 0 2px 3px rgba(0, 0, 0, .35);
}
.sc-rod::before { top: -9px; }
.sc-rod::after { bottom: -9px; }
.sc-paper {
  position: relative; flex: 1; min-width: 0; display: flex; flex-direction: column; padding: 16px 24px 14px; margin: 0 -3px;
  color: #3a2614; overflow: hidden;
  background:
    repeating-linear-gradient(0deg, rgba(120, 80, 30, .045) 0 2px, transparent 2px 5px),
    repeating-linear-gradient(90deg, rgba(120, 80, 30, .055) 0 1px, transparent 1px 7px),
    radial-gradient(ellipse at 50% 40%, #f7ecd3, #ead8b0 72%, #dbc290);
  box-shadow: inset 0 0 34px rgba(120, 80, 30, .28), inset 0 2px 0 rgba(255, 255, 255, .4);
}
.sc-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding-bottom: 6px; border-bottom: 1px solid rgba(122, 31, 31, .32); }
.sc-title { font: 700 20px/1 var(--sc-serif); letter-spacing: .34em; color: #7a1f1f; }
.sc-sub { font: italic 12.5px/1.2 var(--sc-serif); color: #7a5a3a; }
.sc-text {
  flex: 1; min-height: 150px; margin: 8px 0 0; padding: 0 2px; border: 0; outline: none; resize: none;
  font: 16px/30px var(--sc-serif); color: #2e1d0e; caret-color: #7a1f1f;
  background: repeating-linear-gradient(to bottom, transparent 0 29px, rgba(122, 31, 31, .16) 29px 30px); background-attachment: local;
}
.sc-text::placeholder { color: rgba(110, 76, 40, .5); font-style: italic; }
.sc-text:disabled { cursor: not-allowed; }
.sc-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 8px; }
.sc-date { font: 600 12px/1 var(--sc-serif); letter-spacing: .22em; color: #7a5a3a; }
.sc-seal {
  position: relative; flex: 0 0 auto; width: 64px; height: 64px; padding: 0; border: 0; border-radius: 50%; cursor: pointer;
  display: grid; place-items: center; color: #fbe3d0; font: 700 12.5px/1 var(--sc-serif); letter-spacing: .1em;
  background: radial-gradient(circle at 38% 32%, #d6493d, #9d1f17 62%, #6d120c);
  box-shadow: inset 0 -4px 8px rgba(0, 0, 0, .35), 0 3px 8px rgba(80, 10, 5, .45), 0 0 0 3px #a3271d, 0 0 0 6px rgba(163, 39, 29, .28);
  transform: rotate(-6deg); transition: transform .15s, filter .15s, opacity .15s;
}
.sc-seal span { width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; border: 1.5px solid rgba(255, 220, 200, .55); }
.sc-seal:hover:not(:disabled) { transform: rotate(-6deg) scale(1.06); filter: brightness(1.08); }
.sc-seal:active:not(:disabled) { transform: rotate(-6deg) scale(.95); }
.sc-seal:disabled { cursor: not-allowed; opacity: .4; filter: grayscale(.4); }
.sc-seal:focus-visible { outline: 2px solid #e0b446; outline-offset: 3px; }
.sc-stamp {
  position: absolute; left: 50%; top: 54%; width: 128px; height: 128px; margin: -64px 0 0 -64px; border-radius: 50%; pointer-events: none;
  display: grid; place-items: center; text-align: center; color: #9d1f17; border: 5px double #9d1f17;
  font: 800 15px/1.25 var(--sc-serif); letter-spacing: .14em; mix-blend-mode: multiply; opacity: 0;
  animation: zz-stamp 2.4s cubic-bezier(.2, .8, .3, 1) forwards;
}
.sc-stamp b { display: block; font-size: 23px; letter-spacing: .2em; }
.sc--compact .sc-paper { padding: 10px 14px 10px; }
.sc--compact .sc-head { display: none; }
.sc--compact .sc-text { min-height: 78px; margin-top: 0; font-size: 14px; line-height: 26px; background: repeating-linear-gradient(to bottom, transparent 0 25px, rgba(122, 31, 31, .16) 25px 26px); }
.sc--compact .sc-date { display: none; }
.sc--compact .sc-seal { width: 46px; height: 46px; font-size: 9.5px; }
.sc--compact .sc-seal span { width: 32px; height: 32px; }
.sc--compact .sc-stamp { width: 92px; height: 92px; margin: -46px 0 0 -46px; font-size: 11px; }
.sc--compact .sc-stamp b { font-size: 16px; }

/* 上手检查 */
.ssl-ready { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(230px, 100%), 1fr)); gap: 6px 14px; margin-top: 10px; }
.ssl-ready-item { display: flex; align-items: center; gap: 8px; font-size: 12.5px; min-width: 0; }
.ssl-ready-item .ssl-dot { width: 8px; height: 8px; flex-basis: 8px; }
.ssl-ready-item b { flex: 0 0 auto; white-space: nowrap; }
.ssl-ready-item.ok .ssl-dot { color: var(--ssl-ok); }
.ssl-ready-item.warn .ssl-dot { color: var(--ssl-warn); }
.ssl-ready-item.err .ssl-dot { color: var(--ssl-err); }
.ssl-steps-guide { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
.ssl-steps-guide > div { padding: 10px 12px; border-radius: 10px; background: var(--ssl-sunken); border: 1px solid var(--ssl-line); font-size: 12px; color: var(--ssl-mut); }
.ssl-steps-guide b { display: block; margin-bottom: 2px; font-size: 13px; color: var(--ssl-fg); }

/* 术语表 */
.ssl-gloss { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(250px, 100%), 1fr)); gap: 8px 18px; margin-top: 10px; }
.ssl-gloss-item { display: flex; gap: 8px; align-items: baseline; font-size: 12.5px; color: var(--ssl-fg2); }
.ssl-gloss-item .ssl-pill { flex: 0 0 auto; }

/* 朝规第二行 */
.ssl-rules2 { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0 14px; align-items: end; margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--ssl-line2); }
.ssl-rules2 .ssl-field { margin-top: 0; }
.ssl-check { display: flex; align-items: center; gap: 8px; height: 34px; font-size: 12.5px; color: var(--ssl-fg2); cursor: pointer; }
.ssl-check input { margin: 0; accent-color: var(--ssl-ok); }

/* 隔离分支与改动 */
.ssl-git-files { display: flex; flex-direction: column; margin-top: 8px; max-height: 220px; overflow: auto; }
.ssl-git-file { display: flex; align-items: center; gap: 10px; padding: 4px 0; font: 12px var(--ssl-mono); border-top: 1px solid var(--ssl-line); }
.ssl-git-file:first-child { border-top: 0; }
.ssl-git-file .add { color: var(--ssl-ok); }
.ssl-git-file .del { color: var(--ssl-err); }
.ssl-branch { display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px; border-radius: 6px; background: var(--ssl-sunken); border: 1px solid var(--ssl-line); font: 11.5px var(--ssl-mono); color: var(--ssl-fg2); }

/* 待回填 */
.ssl-card.is-fill { border-color: color-mix(in srgb, var(--ssl-info) 55%, transparent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ssl-info) 10%, transparent); }
.ssl-quote { margin: 8px 0 0; padding: 8px 10px; border-left: 3px solid var(--ssl-line3); background: var(--ssl-sunken); border-radius: 0 8px 8px 0; font-size: 12px; color: var(--ssl-fg2); white-space: pre-wrap; max-height: 140px; overflow: auto; }

/* 史馆 */
.ssl-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.ssl-kpi { padding: 12px 14px; border-radius: 12px; background: var(--ssl-panel); border: 1px solid var(--ssl-line); }
.ssl-kpi b { display: block; font-size: 22px; line-height: 1.2; font-variant-numeric: tabular-nums; color: var(--ssl-fg); }
.ssl-kpi span { font-size: 11.5px; color: var(--ssl-mut); }
.ssl-meter { height: 6px; border-radius: 3px; background: color-mix(in srgb, var(--ssl-mut) 16%, transparent); overflow: hidden; display: flex; }
.ssl-meter i { display: block; height: 100%; }
.ssl-meter .ok { background: var(--ssl-ok); }
.ssl-meter .err { background: var(--ssl-err); }
.ssl-annal + .ssl-annal { margin-top: 10px; }
.ssl-lessons { margin: 8px 0 0; padding-left: 18px; font-size: 12.5px; color: var(--ssl-fg2); }
.ssl-lessons li + li { margin-top: 3px; }

/* ---------- v0.7 ---------- */
/* 金额：币 + 真实货币 */
.ssl-money { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; font-variant-numeric: tabular-nums; }
.ssl-money-coin { display: inline-flex; align-items: center; gap: 3px; }
.ssl-money-coin b { font-weight: 600; color: var(--ssl-fg); }
.ssl-money-coin i { font-style: normal; font-size: 11px; color: var(--ssl-mut); }
.ssl-money-real { font-size: 11.5px; color: var(--ssl-mut); }
.ssl-money-est { font-size: 10.5px; padding: 0 5px; border-radius: 6px; color: var(--ssl-warn); background: color-mix(in srgb, var(--ssl-warn) 14%, transparent); }
.ssl-money.is-big { gap: 10px; margin-top: 4px; }
.ssl-money.is-big .ssl-money-coin b { font-size: 20px; }
.ssl-money.is-big .ssl-money-real { font-size: 13px; }
.ssl-coin { flex: 0 0 auto; filter: drop-shadow(0 1px 1px rgba(0,0,0,.25)); }
.ssl-treasury-head { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }

/* 朝制选择与估价 */
.ssl-modes { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.ssl-estimate { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-left: 6px; font-size: 12px; color: var(--ssl-mut); }
.ssl-estimate i { font-style: normal; font-size: 11px; color: var(--ssl-cap); }

/* 旁白 */
.ssl-narrator { display: flex; align-items: flex-start; gap: 8px; margin-top: 12px; padding: 8px 12px; border-radius: 9px; font-size: 12.5px; color: var(--ssl-fg2); background: var(--ssl-sunken); border: 1px solid var(--ssl-line); }
.ssl-narrator .ssl-dot { margin-top: 6px; color: var(--ssl-mut); }
.ssl-narrator.is-live { border-color: color-mix(in srgb, var(--ssl-warn) 40%, transparent); }
.ssl-narrator.is-live .ssl-dot { color: var(--ssl-warn); }

/* 朝会全景 */
.ssl-pano-grid { display: grid; grid-template-columns: 132px minmax(0, 1fr); gap: 6px 10px; align-items: center; }
.ssl-pano.is-compact .ssl-pano-grid { grid-template-columns: 30px minmax(0, 1fr); gap: 4px 6px; }
.ssl-pano.is-compact { padding: 10px 12px; margin-top: 12px; }
.ssl-pano-lane { display: flex; align-items: center; gap: 7px; min-width: 0; font-size: 12px; color: var(--ssl-fg2); }
.ssl-pano-glyph { width: 22px; height: 22px; flex: 0 0 22px; border-radius: 6px; display: grid; place-items: center; color: #fff; font: 700 11px/1 var(--ssl-serif); }
.ssl-pano-glyph.is-latin { font: 700 8px/1 var(--sc-serif); }
.ssl-pano-track { position: relative; height: 22px; border-radius: 6px; background: var(--ssl-sunken); border: 1px solid var(--ssl-line); }
.ssl-pano-bar { position: absolute; top: 4px; bottom: 4px; padding: 0; border: 0; border-radius: 4px; cursor: pointer; background: var(--ssl-ok); opacity: .9; }
.ssl-pano-bar:hover { opacity: 1; outline: 2px solid color-mix(in srgb, var(--ssl-fg) 25%, transparent); }
.ssl-pano-bar.is-live { background: var(--ssl-warn); animation: ssl-pulse 1.4s ease-in-out infinite; }
.ssl-pano-bar.is-veto { background: var(--ssl-err); }
.ssl-pano-bar.is-retry { background: repeating-linear-gradient(135deg, var(--ssl-warn) 0 4px, color-mix(in srgb, var(--ssl-warn) 50%, transparent) 4px 8px); }
.ssl-pano-bar.is-fail { background: var(--ssl-err); opacity: .65; }
.ssl-pano-bar.is-waste { background: var(--ssl-mut); opacity: .5; }
.ssl-pano-bar.is-resumed { box-shadow: inset 0 0 0 2px color-mix(in srgb, #fff 55%, transparent); }
.ssl-pano-mark { position: absolute; top: -3px; width: 9px; height: 9px; margin-left: -4px; transform: rotate(45deg); border-radius: 2px; background: var(--ssl-seal); box-shadow: 0 0 0 2px var(--ssl-panel); }
.ssl-pano-mark.is-admonish { background: var(--ssl-warn); }
.ssl-pano-mark.is-fill { background: var(--ssl-info); }
.ssl-pano-mark.is-veto { background: var(--ssl-err); }
.ssl-pano-axis { position: relative; height: 14px; font-size: 10.5px; color: var(--ssl-cap); }
.ssl-pano-axis span { position: absolute; transform: translateX(-50%); white-space: nowrap; }
.ssl-pano-axis span:first-child { transform: none; }
.ssl-pano-axis span:last-child { transform: translateX(-100%); }
.ssl-pano-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 10px; font-size: 11.5px; color: var(--ssl-mut); }
.ssl-pano-legend span { display: inline-flex; align-items: center; gap: 6px; }
.ssl-pano-legend .ssl-pano-bar { position: static; display: inline-block; width: 18px; height: 8px; cursor: default; }
.ssl-pano-legend .ssl-pano-mark { position: static; display: inline-block; margin: 0; }

/* 文书房 */
.ssl-file.is-missing { color: var(--ssl-err); border-color: color-mix(in srgb, var(--ssl-err) 45%, transparent); cursor: default; }
.ssl-git-file .ssl-link { font-size: 11px; }
.ssl-diff span { display: block; }
.ssl-diff .add { background: color-mix(in srgb, var(--ssl-ok) 14%, transparent); color: var(--ssl-ok); }
.ssl-diff .del { background: color-mix(in srgb, var(--ssl-err) 12%, transparent); color: var(--ssl-err); }
.ssl-diff .hunk { color: var(--ssl-info); }

/* 实录 */
.ssl-wiki h3 { margin: 0 0 10px; font: 600 16px/1.3 var(--ssl-serif); }
.ssl-wiki h4 { margin: 14px 0 6px; font-size: 13px; color: var(--ssl-fg); }
.ssl-wiki p { margin: 4px 0; }
.ssl-wiki-entry { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-top: 1px solid var(--ssl-line); font-size: 12.5px; }
.ssl-wiki-entry.is-refuted { opacity: .55; text-decoration: line-through; }
.ssl-wiki-entry .ssl-pill { height: 18px; padding: 0 6px; }
.ssl-wiki-log { max-height: 180px; overflow: auto; padding: 0 6px; font: 11px/1.6 var(--ssl-mono); color: var(--ssl-mut); }

/* 国库 */
.ssl-days { display: grid; grid-template-columns: repeat(14, minmax(0, 1fr)); gap: 6px; align-items: end; height: 130px; }
.ssl-day { display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; font-size: 10.5px; color: var(--ssl-cap); }
.ssl-day-bar { flex: 1; width: 100%; display: flex; align-items: flex-end; border-radius: 5px; background: var(--ssl-sunken); overflow: hidden; }
.ssl-day-bar i { display: block; width: 100%; min-height: 2px; background: linear-gradient(180deg, #e2b23c, #a87b16); }
.ssl-bars { display: flex; flex-direction: column; gap: 7px; }
.ssl-bars-row { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 2fr) 76px; gap: 10px; align-items: center; font-size: 12px; }
.ssl-bars-track { height: 8px; border-radius: 4px; background: var(--ssl-sunken); overflow: hidden; }
.ssl-bars-track i { display: block; height: 100%; border-radius: 4px; background: var(--ssl-seal); }
.ssl-bars-val { text-align: right; font-variant-numeric: tabular-nums; color: var(--ssl-mut); }
.ssl-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.ssl-table th { text-align: left; font-weight: 500; color: var(--ssl-mut); padding: 6px 8px; border-bottom: 1px solid var(--ssl-line2); white-space: nowrap; }
.ssl-table td { padding: 6px 8px; border-bottom: 1px solid var(--ssl-line); white-space: nowrap; }
.ssl-table tr.is-waste td { color: var(--ssl-mut); }
.ssl-table .ssl-input { height: 28px; padding: 0 6px; min-width: 70px; }

@container (max-width: 900px) {
  .ssl-rules2 { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .ssl-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ssl-steps-guide { grid-template-columns: minmax(0, 1fr); }
}
@container (max-width: 900px) {
  .ssl { padding: 16px 16px 80px; }
  .ssl-cols, .ssl-split, .ssl-detail-cols { grid-template-columns: minmax(0, 1fr); }
  .ssl-rules { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px 12px; }
  .ssl-rules .ssl-auto { grid-column: 1 / -1; }
  .ssl-side { position: static; max-height: 300px; }
  .ssl-stats { width: 100%; }
  .ssl-stat { flex: 1; }
}
@container (max-width: 560px) {
  .ssl { padding: 12px 12px 64px; }
  .ssl-role-fields, .ssl-agent-fields, .ssl-rules, .ssl-rules2 { grid-template-columns: minmax(0, 1fr); }
  .ssl-wf-row { grid-template-columns: 22px 84px minmax(0, 1fr) auto; gap: 6px; }
  .ssl-head-text { min-width: 0; }
  .ssl-sub { display: none; }
  .ssl-nav { gap: 4px 18px; margin: 12px 0 14px; }
  .ssl-nav button { font-size: 13.5px; }
  .ssl-kpis { grid-template-columns: minmax(0, 1fr); }
  .zz-sub, .zz-date { display: none; }
  .zz-head { width: 46px; }
  .zz-tail { width: 72px; padding-left: 7px; padding-right: 7px; justify-content: center; }
}

/* 下旨工具条：照 DSH 输入框 */
.ssl-decree { width: 100%; }
.ssl-decree-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 10px; }
.ssl-tool {
  position: relative; display: inline-flex; align-items: center; gap: 5px; max-width: 100%; height: 30px; padding: 0 10px; border-radius: 8px;
  border: 1px solid var(--ssl-line); background: var(--ssl-panel); color: var(--ssl-fg2); font: inherit; font-size: 12.5px; cursor: pointer; white-space: nowrap;
}
.ssl-tool:hover, .ssl-tool:focus-within { border-color: var(--ssl-line2); color: var(--ssl-fg); }
.ssl-tool.is-on { color: var(--ssl-fg); border-color: var(--ssl-line2); background: var(--ssl-sunken); }
.ssl-tool--icon { width: 30px; padding: 0; justify-content: center; font-size: 17px; line-height: 1; }
.ssl-tool-ic { font-size: 12px; opacity: .75; }
.ssl-tool-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.ssl-tool--folder { max-width: min(320px, 100%); }
/* 原生下拉盖在整块按钮上：点哪里都能选，样式由按钮自己画 */
.ssl-tool select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; font: inherit; }
.ssl-decree-files { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.ssl-file-chip {
  display: inline-flex; align-items: center; gap: 6px; max-width: 260px; height: 26px; padding: 0 4px 0 9px; border-radius: 7px;
  background: var(--ssl-sunken); border: 1px solid var(--ssl-line); font-size: 12px; color: var(--ssl-fg2);
}
.ssl-file-chip i { font-style: normal; font-size: 11px; color: var(--ssl-mut); flex: none; }
.ssl-file-chip button { flex: none; width: 20px; height: 20px; border: 0; border-radius: 5px; background: transparent; color: var(--ssl-mut); cursor: pointer; font-size: 14px; line-height: 1; }
.ssl-file-chip button:hover { background: var(--ssl-line); color: var(--ssl-fg); }
.ssl-decree-criteria { margin-top: 8px; }
.ssl-decree-estimate { display: flex; margin: 8px 0 0; }

/* 朝局 */
.ssl-regime-chip {
  display: inline-flex; align-items: center; gap: 7px; height: 32px; padding: 0 11px; border-radius: 9px; cursor: pointer;
  border: 1px solid var(--ssl-line); background: var(--ssl-panel); color: var(--ssl-fg); font: inherit; font-size: 12.5px; white-space: nowrap;
}
.ssl-regime-chip:hover { border-color: var(--ssl-line2); }
.ssl-regime-dots { display: inline-flex; gap: 3px; }
.ssl-regime-dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--ssl-line2); }
.ssl-regime-dots i.on { background: var(--ssl-seal); }
.ssl-ladder { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; margin: 4px 0 0; padding: 0; list-style: none; }
.ssl-ladder li {
  position: relative; display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 8px 10px; border-radius: 9px;
  border: 1px solid var(--ssl-line); background: var(--ssl-sunken); color: var(--ssl-mut);
}
.ssl-ladder li b { font-size: 11px; font-weight: 600; }
.ssl-ladder-name { font: 600 13.5px/1.3 var(--ssl-serif); color: var(--ssl-fg2); }
.ssl-ladder-when { font-size: 11px; line-height: 1.35; }
.ssl-ladder li.is-past { color: var(--ssl-mut); }
.ssl-ladder li.is-current { border-color: var(--ssl-seal); background: color-mix(in srgb, var(--ssl-seal) 10%, var(--ssl-panel)); color: var(--ssl-fg2); }
.ssl-ladder li.is-current .ssl-ladder-name { color: var(--ssl-seal); }
.ssl-regime-body { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 16px; margin-top: 12px; }
.ssl-regime-story { margin: 0 0 8px; font: 13px/1.6 var(--ssl-serif); color: var(--ssl-fg2); }
.ssl-regime-row { display: flex; align-items: flex-start; gap: 8px; margin-top: 6px; font-size: 12.5px; }
.ssl-regime-row .ssl-pill { flex: none; }
.ssl-regime-house { display: flex; gap: 8px; align-items: baseline; padding: 4px 0; border-bottom: 1px dashed var(--ssl-line); font-size: 12.5px; }
.ssl-regime-house b { flex: none; }
.ssl-regime-tips { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--ssl-line); }
.ssl-regime-tip { display: flex; align-items: center; gap: 10px; font-size: 12.5px; }
/* 帝王传记 */
.ssl-bio-head { display: flex; flex-wrap: wrap; gap: 16px 24px; align-items: flex-start; }
.ssl-bio-title { margin: 2px 0 0; font: 700 22px/1.3 var(--ssl-serif); letter-spacing: .04em; color: var(--ssl-fg); }
.ssl-puppet { flex: 0 1 320px; min-width: 240px; }
.ssl-puppet > .ssl-between b { font: 700 15px/1.3 var(--ssl-serif); }
.ssl-meter { position: relative; height: 8px; margin: 8px 0 4px; border-radius: 4px; background: var(--ssl-sunken); overflow: hidden; box-shadow: inset 0 0 0 1px var(--ssl-line); }
.ssl-meter i { position: absolute; inset: 0 auto 0 0; border-radius: 4px; background: var(--ssl-ok); }
.ssl-puppet.is-shared .ssl-meter i { background: var(--ssl-warn); }
.ssl-puppet.is-slipping .ssl-meter i, .ssl-puppet.is-figurehead .ssl-meter i { background: var(--ssl-err); }
.ssl-bio-radars { margin-top: 12px; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
.ssl-radar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
.ssl-radar svg { flex: 0 1 310px; width: 310px; max-width: 100%; height: auto; }
.ssl-radar-grid { fill: none; stroke: var(--ssl-line); stroke-width: 1; }
.ssl-radar-area { fill: color-mix(in srgb, var(--ssl-seal) 22%, transparent); stroke: var(--ssl-seal); stroke-width: 2; stroke-linejoin: round; }
.ssl-radar-dot { fill: var(--ssl-seal); stroke: var(--ssl-panel); stroke-width: 2; }
.ssl-radar-dot.is-empty { fill: var(--ssl-panel); stroke: var(--ssl-mut); stroke-width: 1.5; }
.ssl-radar-label { font-size: 13px; fill: var(--ssl-fg2); }
.ssl-radar-list { flex: 1 1 140px; margin: 0; padding: 0; list-style: none; font-size: 12.5px; }
.ssl-radar-list li { display: flex; align-items: baseline; gap: 8px; padding: 3px 0; border-bottom: 1px dashed var(--ssl-line); }
.ssl-radar-list span { flex: 1; color: var(--ssl-fg2); }
.ssl-radar-list b { font-variant-numeric: tabular-nums; }
.ssl-radar-list i { font-style: normal; font-size: 11px; color: var(--ssl-mut); }
@container (max-width: 900px) {
  .ssl-regime-body { grid-template-columns: minmax(0, 1fr); }
  .ssl-bio-radars { grid-template-columns: minmax(0, 1fr); }
}
@container (max-width: 560px) {
  .ssl-ladder { grid-template-columns: minmax(0, 1fr); }
  .ssl-ladder-when { display: none; }
}

/* 朝堂页只放下旨框：跟 DSH 的输入框一样，框下面不再挂别的卡片 */
.ssl-court { margin-top: 2px; }
.ssl-court > .ssl-card { padding: 18px 20px 14px; }
.ssl-court-note {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; margin-bottom: 12px; padding: 9px 12px; border-radius: 10px; font-size: 12.5px;
  border: 1px solid color-mix(in srgb, var(--ssl-warn) 40%, var(--ssl-line)); background: color-mix(in srgb, var(--ssl-warn) 8%, transparent);
}
.ssl-court-note .ssl-grow { min-width: 200px; }

/* 朝堂三栏工作台（照 Claude Code 桌面版）：左奏折目录 | 中圣旨与回奏 | 右流程；整页定高，三栏各自滚动 */
.ssl-root.is-bench { overflow-y: auto; }
.ssl.is-bench { display: flex; flex-direction: column; height: 100%; max-width: none; padding: 18px 20px 14px; }
.ssl.is-bench > .ssl-nav { margin-bottom: 12px; }
.ssl-bench { position: relative; flex: 1 1 auto; min-height: 480px; display: grid; grid-template-columns: 236px minmax(0, 1fr) 316px; gap: 12px; }
.ssl-root.is-embedded .ssl-bench { flex: none; height: 78vh; }
.ssl-bench > * { min-height: 0; min-width: 0; }
.ssl-bench-list { overflow-y: auto; padding: 8px; background: var(--ssl-sunken); border: 1px solid var(--ssl-line); border-radius: 12px; }
.ssl-bench-new {
  display: flex; align-items: center; gap: 8px; width: 100%; height: 36px; margin-bottom: 8px; padding: 0 12px; border-radius: 9px; cursor: pointer;
  border: 1px solid var(--ssl-line2); background: var(--ssl-panel); color: var(--ssl-fg); font: inherit; font-size: 13px; font-weight: 600;
}
.ssl-bench-new:hover { border-color: var(--ssl-seal); }
.ssl-bench-new.is-active { border-color: var(--ssl-seal); box-shadow: inset 3px 0 0 var(--ssl-seal); }
.ssl-bench-new span { color: var(--ssl-seal); font-size: 15px; }
.ssl-bench-main { position: relative; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--ssl-line); border-radius: 12px; background: var(--ssl-panel); }
.ssl-bench-head { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 8px 14px; border-bottom: 1px solid var(--ssl-line); }
.ssl-bench-title { font-weight: 600; font-size: 13.5px; }
.ssl-bench-pick { display: none; flex: 1 1 auto; min-width: 0; height: 30px; padding: 0 8px; }
.ssl-bench-flowbtn { display: none; }
.ssl-bench-flowbtn { height: 34px; padding: 0 16px; gap: 6px; font-size: 13.5px; font-weight: 600; flex: none; }
.ssl-bench-flowbtn span { font-size: 16px; line-height: 1; }
.ssl-bench-flowbtn.is-on { color: var(--ssl-fg); background: var(--ssl-sunken); border-color: var(--ssl-seal); }
.ssl-bench-thread { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 18px 18px 10px; }
.ssl-bench-blank { max-width: 980px; margin: 0 auto; }
.ssl-bench-compose { padding: 10px 14px 12px; border-top: 1px solid var(--ssl-line); }
/* 底部的圣旨框压矮一点，把高度让给回奏 */
.ssl-bench-compose .zz--compact .zz-paper { height: 92px; }
.ssl-bench-compose .zz--compact .zz-head { padding: 8px 0; }
.ssl-bench-compose .zz--compact .zz-seal { width: 40px; height: 40px; font-size: 13px; }
.ssl-bench-compose .sc--compact .sc-text { min-height: 52px; }
.ssl-bench-compose .zz-slips .ssl-decree-bar { margin-top: 8px; }
.ssl-bench-side { overflow-y: auto; padding-right: 2px; }
.ssl-bench-side .ssl-card { padding: 14px; }
.ssl-bench-side .ssl-card-h { margin-bottom: 10px; }
.ssl-bench-side .ssl-pano.is-compact { margin-top: 0; padding: 0; border: 0; background: transparent; box-shadow: none; }
.ssl-bench .ssl-chat-doc { inset: 6px; }
/* 中栏的来回：回奏占满宽度，好读长文 */
.ssl-thread .ssl-msg--result .ssl-msg-main { flex: 1; max-width: none; }
.ssl-thread .ssl-msg.is-mine .ssl-msg-main { max-width: 80%; }
.ssl-thread-pills { justify-content: flex-end; margin-top: 6px; }
.ssl-thread-plan { margin: 6px 0 0; padding-left: 20px; }
.ssl-thread-plan li { margin: 2px 0; }
.ssl-thread-block { margin: 4px 0 14px 36px; }
.ssl-thread > .ssl-narrator { margin: 0 0 14px 36px; }
.ssl-thread > .ssl-alert { margin: 0 0 14px 36px; }
.ssl-thread > .ssl-card { margin: 0 0 12px 36px; }
.ssl-verdict.is-awaiting { border-color: color-mix(in srgb, var(--ssl-seal) 55%, var(--ssl-line)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ssl-seal) 10%, transparent); }
/* 回奏正文的 Markdown */
.ssl-bubble .ssl-md { white-space: normal; }
.ssl-md { font-size: 13px; line-height: 1.7; }
.ssl-md > :first-child { margin-top: 0; }
.ssl-md > :last-child { margin-bottom: 0; }
.ssl-md p { margin: 0 0 8px; white-space: pre-wrap; }
.ssl-md ul, .ssl-md ol { margin: 0 0 8px; padding-left: 22px; }
.ssl-md li { margin: 2px 0; }
.ssl-md-h { margin: 12px 0 6px; font-weight: 700; font-size: 13.5px; color: var(--ssl-fg); }
.ssl-md code { padding: 1px 5px; border-radius: 4px; background: var(--ssl-panel); border: 1px solid var(--ssl-line); font: 12px/1.5 var(--ssl-mono, ui-monospace, monospace); }
.ssl-md-code { margin: 0 0 8px; padding: 10px 12px; border-radius: 8px; overflow-x: auto; white-space: pre; background: var(--ssl-panel); border: 1px solid var(--ssl-line); font: 12px/1.55 var(--ssl-mono, ui-monospace, monospace); }
/* 竖排流程 */
.ssl-vflow { margin: 0; padding: 0; list-style: none; }
.ssl-vflow li { position: relative; display: flex; gap: 10px; padding: 0 0 12px; color: var(--ssl-mut); }
.ssl-vflow li:last-child { padding-bottom: 0; }
.ssl-vflow li::before { content: ""; position: absolute; left: 10px; top: 22px; bottom: 0; width: 2px; background: var(--ssl-line2); }
.ssl-vflow li:last-child::before { display: none; }
.ssl-vflow li.is-done::before { background: var(--ssl-ok); }
.ssl-vflow-node {
  position: relative; z-index: 1; width: 22px; height: 22px; flex: 0 0 22px; border-radius: 50%; display: grid; place-items: center;
  border: 1.5px solid var(--ssl-line2); background: var(--ssl-panel); font-size: 11px; font-weight: 600;
}
.ssl-vflow-label { padding-top: 2px; font-size: 12.5px; }
.ssl-vflow li.is-done .ssl-vflow-node { background: var(--ssl-ok); border-color: var(--ssl-ok); color: #fff; }
.ssl-vflow li.is-done .ssl-vflow-label { color: var(--ssl-fg2); }
.ssl-vflow li.is-active .ssl-vflow-node { border-color: var(--ssl-warn); color: var(--ssl-warn); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ssl-warn) 18%, transparent); }
.ssl-vflow li.is-active .ssl-vflow-label { color: var(--ssl-fg); font-weight: 600; }
.ssl-vflow li.is-halted .ssl-vflow-node { background: var(--ssl-err); border-color: var(--ssl-err); color: #fff; }
.ssl-vflow li.is-halted .ssl-vflow-label { color: var(--ssl-err); font-weight: 600; }
/* 右栏的往来摘要 */
.ssl-mini-list { display: flex; flex-direction: column; gap: 2px; }
.ssl-mini {
  display: block; width: 100%; padding: 6px 8px; border: 0; border-radius: 8px; background: transparent; color: inherit;
  font: inherit; text-align: left; cursor: pointer;
}
.ssl-mini:hover { background: var(--ssl-hover); }
.ssl-mini.is-err .ssl-mini-route { color: var(--ssl-err); }
.ssl-mini-h { display: flex; align-items: center; gap: 6px; }
.ssl-mini-h .ssl-pill { height: 18px; padding: 0 6px; font-size: 10.5px; flex: none; }
.ssl-mini-h .ssl-caption { flex: none; margin-left: auto; }
.ssl-mini-route { min-width: 0; font-size: 12px; font-weight: 600; color: var(--ssl-fg); }
/* 各部在办什么（白话） */
.ssl-act { display: flex; flex-direction: column; gap: 6px; }
.ssl-act-now { font-size: 12.5px; color: var(--ssl-fg); }
.ssl-act-counts { display: flex; flex-wrap: wrap; gap: 4px; }
.ssl-act-counts .ssl-pill { height: 20px; padding: 0 7px; font-size: 11px; }
.ssl-act-said { font-size: 12px; color: var(--ssl-mut); font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ssl-act-raw summary { cursor: pointer; font-size: 11.5px; color: var(--ssl-mut); }
.ssl-act-raw .ssl-term { margin-top: 6px; }
.ssl-bubble .ssl-act { white-space: normal; margin-bottom: 4px; }
/* 朝局遮住的那一层 */
.ssl-veil {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; font-size: 12.5px; color: var(--ssl-fg2);
  border: 1px dashed color-mix(in srgb, var(--ssl-seal) 40%, var(--ssl-line2)); background: color-mix(in srgb, var(--ssl-seal) 6%, transparent);
}
.ssl-veil.is-compact { padding: 8px 10px; font-size: 12px; }
.ssl-stack > .ssl-veil { margin-top: 12px; }
.ssl-veil-ic { flex: none; width: 22px; height: 22px; border-radius: 6px; display: grid; place-items: center; background: color-mix(in srgb, var(--ssl-seal) 18%, transparent); color: var(--ssl-seal); font: 700 12px/1 var(--ssl-serif); }
.ssl-no-power { margin-top: 8px; }
.ssl-tool.is-locked { cursor: not-allowed; opacity: .75; }
/* 皇权 */
.ssl-power-row { display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 8px; padding: 4px 0; font-size: 12.5px; border-bottom: 1px dashed var(--ssl-line); }
.ssl-power-row b { color: var(--ssl-mut); font-weight: 500; }
.ssl-power-row em { font-style: normal; color: var(--ssl-err); }
.ssl-power-next { margin-top: 8px; }
.ssl-power-wrap { margin-top: 14px; overflow-x: auto; }
.ssl-power-table td { white-space: normal; vertical-align: top; }
.ssl-power-table tr.is-current td { background: color-mix(in srgb, var(--ssl-seal) 10%, transparent); }
.ssl-power-table tr.is-current td:first-child { box-shadow: inset 3px 0 0 var(--ssl-seal); }
/* 文书房：产出所在的文件夹 */
.ssl-files-where { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; padding: 6px 8px; border-radius: 8px; background: var(--ssl-sunken); }
/* 再接一家工具 */
.ssl-upgrade {
  display: flex; align-items: center; flex-wrap: wrap; gap: 10px 14px; margin-bottom: 12px; padding: 12px 14px; border-radius: 12px; font-size: 12.5px; color: var(--ssl-fg2);
  border: 1px solid color-mix(in srgb, var(--ssl-seal) 45%, var(--ssl-line)); background: color-mix(in srgb, var(--ssl-seal) 9%, transparent);
}
.ssl-upgrade .ssl-grow { min-width: 260px; }
.ssl-upgrade b { color: var(--ssl-fg); margin-right: 4px; }
/* 新旨的起手式 */
.ssl-starters { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 12px; }
.ssl-starters > span { font-size: 12px; color: var(--ssl-mut); margin-right: 2px; }
/* 功勋 */
.ssl-badges { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(190px, 100%), 1fr)); gap: 10px; }
.ssl-badge { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--ssl-line); background: var(--ssl-sunken); opacity: .72; }
.ssl-badge.is-won { opacity: 1; border-color: color-mix(in srgb, var(--ssl-seal) 45%, var(--ssl-line)); background: color-mix(in srgb, var(--ssl-seal) 8%, var(--ssl-panel)); }
.ssl-badge-seal { flex: none; width: 34px; height: 34px; border-radius: 8px; display: grid; place-items: center; font: 700 15px/1 var(--ssl-serif); color: var(--ssl-mut); border: 1.5px dashed var(--ssl-line2); }
.ssl-badge.is-won .ssl-badge-seal { color: #fff; background: var(--ssl-seal); border: 0; box-shadow: inset 0 0 0 2px color-mix(in srgb, #fff 22%, transparent); }
.ssl-badge-seal.is-latin { font: 700 9px/1 var(--sc-serif); }
.ssl-badge .ssl-meter { margin: 6px 0 0; height: 5px; }
/* 成效 */
.ssl-impact-hero { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.ssl-impact-big { display: flex; flex-direction: column; gap: 4px; }
.ssl-impact-hero > .ssl-card, .ssl-cols > .ssl-card { margin-top: 0; }
.ssl-impact-big > b { font: 700 30px/1.15 var(--ssl-serif); color: var(--ssl-fg); font-variant-numeric: tabular-nums; }
.ssl-impact-big > b small { font: 500 13px/1 inherit; color: var(--ssl-mut); }
.ssl-cmp { padding: 10px 0; border-bottom: 1px dashed var(--ssl-line); }
.ssl-cmp:last-child { border-bottom: 0; }
.ssl-cmp-label { font-size: 12.5px; color: var(--ssl-fg2); margin-bottom: 6px; }
.ssl-cmp-row { display: grid; grid-template-columns: 64px minmax(0, 1fr) 120px; gap: 10px; align-items: center; margin: 3px 0; font-size: 12px; }
.ssl-cmp-who { color: var(--ssl-mut); }
.ssl-cmp-track { height: 10px; border-radius: 5px; background: var(--ssl-sunken); overflow: hidden; }
.ssl-cmp-track i { display: block; height: 100%; border-radius: 0 4px 4px 0; }
.ssl-cmp-track i.is-solo { background: color-mix(in srgb, var(--ssl-mut) 55%, transparent); }
.ssl-cmp-track i.is-court { background: var(--ssl-seal); }
.ssl-cmp-row b { font-variant-numeric: tabular-nums; color: var(--ssl-fg); }
.ssl-cmp-row b em { font-style: normal; font-weight: 500; color: var(--ssl-ok); }
.ssl-ledger > div { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 6px 0; border-bottom: 1px dashed var(--ssl-line); font-size: 12.5px; }
.ssl-ledger > div.is-total { border-bottom: 0; border-top: 1px solid var(--ssl-line2); margin-top: 2px; font-weight: 700; }
.ssl-ledger b { font-variant-numeric: tabular-nums; }
.ssl-ledger .is-plus { color: var(--ssl-ok); }
.ssl-ledger .is-minus { color: var(--ssl-err); }
.ssl-catch { display: flex; align-items: center; gap: 14px; }
.ssl-catch > b { font: 700 26px/1 var(--ssl-serif); min-width: 34px; text-align: center; color: var(--ssl-mut); }
.ssl-catch.is-hit > b { color: var(--ssl-seal); }
@container (max-width: 900px) {
  .ssl-impact-hero { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@container (max-width: 560px) {
  .ssl-impact-hero { grid-template-columns: minmax(0, 1fr); }
  .ssl-cmp-row { grid-template-columns: 52px minmax(0, 1fr) 90px; }
}
/* 朝会页 */
.ssl-forum-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.ssl-forum-bar .ssl-input { flex: 1 1 auto; min-width: 0; max-width: 520px; height: 32px; padding: 0 8px; }
.ssl-forum-chat { max-height: 70vh; overflow-y: auto; padding-right: 4px; }
@container (max-width: 1120px) {
  .ssl-bench { grid-template-columns: 216px minmax(0, 1fr); }
  .ssl-bench-flowbtn { display: inline-flex; }
  .ssl-bench-side {
    display: none; position: absolute; top: 0; right: 0; bottom: 0; z-index: 6; width: min(340px, 92%); padding: 10px;
    border-radius: 12px; background: var(--ssl-raised); border: 1px solid var(--ssl-line2); box-shadow: -10px 0 32px rgba(0,0,0,.22);
  }
  .ssl-bench-side.is-open { display: block; }
}
@container (max-width: 760px) {
  .ssl.is-bench { padding: 12px 12px 10px; }
  .ssl-bench { grid-template-columns: minmax(0, 1fr); min-height: 420px; }
  .ssl-bench-list { display: none; }
  .ssl-bench-pick { display: block; }
  .ssl-bench-title { display: none; }
  .ssl-bench-thread { padding: 14px 12px 8px; }
  .ssl-thread-block, .ssl-thread > .ssl-narrator, .ssl-thread > .ssl-alert, .ssl-thread > .ssl-card { margin-left: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .ssl *, .ssl-overlay * { animation: none !important; transition: none !important; }
}
`;

  function ensureStyles() {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  window.__ModuleLoader__.load({
    id: 'dsh-sansheng-liubu',
    factory: function (require) {
      const React = require('react');
      const h = React.createElement;
      const { useState, useEffect, useCallback, useMemo, useRef } = React;
      ensureStyles();

      // ---------- 皮肤：走官方 ctx.theme.overrideTokens（不是 hack） ----------
      // 规则：每个令牌必须同时给 light / dark 两个值，否则用户切主题会瞎。
      // 只改语义别名（背景/描边/主色），不动文字色，保证对比度。
      const SKINS = {
        default: { name: '默认', desc: '完全不动 DSH 的颜色', tokens: null },
        cinnabar: {
          name: '朱批',
          desc: '朱红主色 + 纸色底，暗色偏暖',
          tokens: {
            '--dsw-alias-brand-primary': { light: '#b4362b', dark: '#e5796d' },
            '--dsw-alias-state-business-primary': { light: '#b4362b', dark: '#e5796d' },
            '--dsw-alias-link': { light: '#a93327', dark: '#f0948a' },
            '--dsw-alias-bg-base': { light: '#faf7f2', dark: '#171310' },
            '--dsw-alias-bg-layer-1': { light: '#fffdf9', dark: '#1e1915' },
            '--dsw-alias-bg-layer-2': { light: '#f5efe6', dark: '#241d18' },
            '--dsw-specific-sidebar-fill': { light: '#f4eee4', dark: '#1b1611' },
            '--dsw-alias-border-l1': { light: '#e6ddd0', dark: '#33291f' },
            '--dsw-alias-border-l2': { light: '#d9cdbb', dark: '#43362a' },
          },
        },
        ink: {
          name: '黛青',
          desc: '青黛主色，冷调背景，适合长时间盯代码',
          tokens: {
            '--dsw-alias-brand-primary': { light: '#2e6472', dark: '#7fb6c4' },
            '--dsw-alias-state-business-primary': { light: '#2e6472', dark: '#7fb6c4' },
            '--dsw-alias-link': { light: '#255966', dark: '#9ccbd6' },
            '--dsw-alias-bg-base': { light: '#f6f8f8', dark: '#121618' },
            '--dsw-alias-bg-layer-1': { light: '#fbfdfd', dark: '#181e21' },
            '--dsw-alias-bg-layer-2': { light: '#eef3f3', dark: '#1d2528' },
            '--dsw-specific-sidebar-fill': { light: '#eff4f4', dark: '#161c1f' },
            '--dsw-alias-border-l1': { light: '#dde5e5', dark: '#283134' },
            '--dsw-alias-border-l2': { light: '#ccd8d8', dark: '#354043' },
          },
        },
      };

      let themeApi = null;       // ctx.theme（可选服务，老版本没有）
      let skinDisposer = null;   // 当前叠加层的注销函数
      let activeSkin = 'default';
      let activeTheme = 'default';

      // ---------- 整套主题：走官方 ctx.theme.register ----------
      // 令牌名取自 ui-theme 的 design-platform.css（明暗两套 alias 表），
      // 这里按 colorScheme 各给一套值；缺的令牌会落回该 colorScheme 的基准调色板，不会瞎。
      const THEMES = {
        gong: {
          name: '宫廷 · 朱',
          desc: '宣纸底 + 朱红主色 + 墨字，浅色专用',
          colorScheme: 'light',
          tokens: {
            '--dsw-alias-bg-base': '#f7f2e8',
            '--dsw-alias-bg-layer-1': '#fffdf7',
            '--dsw-alias-bg-layer-2': '#f6eee1',
            '--dsw-alias-bg-layer-3': '#efe4d3',
            '--dsw-alias-bg-overlay': '#ede1cf',
            '--dsw-alias-bg-module-platform': '#f2e9da',
            '--dsw-alias-bg-multi-select': '#f2e9da',
            '--dsw-alias-bg-document-preview': '#f3ece0',
            '--dsw-alias-bg-document-selection': 'rgba(156, 47, 36, 0.35)',
            '--dsw-alias-bg-skeleton': 'rgba(90, 60, 30, 0.05)',
            '--dsw-alias-bg-mask-1': 'rgba(40, 25, 10, 0.24)',
            '--dsw-alias-bg-mask-2': 'rgba(40, 25, 10, 0.12)',
            '--dsw-alias-bg-mask-3': 'rgba(40, 25, 10, 0.48)',
            '--dsw-alias-border-l1': 'rgba(90, 60, 30, 0.10)',
            '--dsw-alias-border-l2': 'rgba(90, 60, 30, 0.16)',
            '--dsw-alias-border-l3': 'rgba(90, 60, 30, 0.20)',
            '--dsw-alias-border-l4': 'rgba(90, 60, 30, 0.26)',
            '--dsw-alias-brand-primary': '#9c2f24',
            '--dsw-alias-brand-primary-invert': '#fdf8ef',
            '--dsw-alias-brand-text': '#3a2a1e',
            '--dsw-alias-button-primary-fill': '#9c2f24',
            '--dsw-alias-button-primary-hover': '#82251c',
            '--dsw-alias-button-primary-dimmed': '#e8d6cc',
            '--dsw-alias-button-contrast-fill': '#463224',
            '--dsw-alias-button-elevated-fill': '#fffdf7',
            '--dsw-alias-button-floating-fill': '#fffdf7',
            '--dsw-alias-button-floating-hover': '#f3ead9',
            '--dsw-alias-button-ghost-active-fill': '#ece0cd',
            '--dsw-alias-button-ghost-active-hover': '#e2d3bd',
            '--dsw-alias-button-ghost-active-border': '#a08a6f',
            '--dsw-alias-button-info-fill': '#3d6f8e',
            '--dsw-alias-button-info-hover': '#5486a3',
            '--dsw-alias-label-primary': '#2b2118',
            '--dsw-alias-label-secondary': '#5c4a38',
            '--dsw-alias-label-tertiary': '#7e6a54',
            '--dsw-alias-label-caption': '#9a8671',
            '--dsw-alias-label-dimmed': '#e6dac7',
            '--dsw-alias-label-primary-inverted': '#fffdf7',
            '--dsw-alias-label-primary-foreground': '#fffdf7',
            '--dsw-alias-label-primary-bluish': '#7a3a2a',
            '--dsw-alias-label-primary-dimmed': '#3f2f22',
            '--dsw-alias-menu-icon': '#4a3a2b',
            '--dsw-alias-link': '#a02c22',
            '--dsw-alias-markdown-code-block': '#f4ecdd',
            '--dsw-alias-markdown-code-block-banner': '#efe5d3',
            '--dsw-alias-markdown-code-segment-selected': '#fffdf7',
            '--dsw-alias-markdown-code-segment-unselected': '#efe5d3',
            '--dsw-alias-markdown-inline-code': '#f1e9db',
            '--dsw-alias-markdown-tag': '#ece1cf',
            '--dsw-alias-markdown-citation': '#f1e9db',
            '--dsw-alias-markdown-placeholder': '#f4ecdd',
            '--dsw-alias-scrollbar-bg-l1': '#dccdb6',
            '--dsw-alias-scrollbar-bg-l2': '#dccdb6',
            '--dsw-alias-scrollbar-hover-l1': '#c9b69a',
            '--dsw-alias-scrollbar-hover-l2': '#c9b69a',
            '--dsw-alias-state-business-primary': '#9c2f24',
            '--dsw-alias-state-business-tertiary': '#f0ded8',
            '--dsw-alias-state-error-primary': '#a8342a',
            '--dsw-alias-state-error-secondary': '#cf6a5e',
            '--dsw-alias-state-success-primary': '#4a7d55',
            '--dsw-alias-state-success-secondary': '#6fa377',
            '--dsw-alias-state-success-tertiary': '#e6f0e4',
            '--dsw-alias-state-warn-primary': '#b8862f',
            '--dsw-alias-state-warn-secondary': '#d8a24a',
            '--dsw-alias-state-warn-tertiary': '#f7ecd7',
            '--dsw-alias-state-warn-label': '#8a6419',
            '--dsw-alias-state-idle-primary': '#cbbba5',
            '--dsw-alias-switch-thumb': '#fffdf7',
            '--dsw-alias-toast-bg': '#33251a',
            '--dsw-alias-toast-label': '#fff8ec',
            '--dsw-alias-tooltip-bg': '#2e2117',
            '--dsw-alias-interactive-bg-hover': 'rgba(90, 60, 30, 0.06)',
            '--dsw-alias-interactive-bg-active': 'rgba(90, 60, 30, 0.10)',
            '--dsw-alias-interactive-bg-hover-accent': 'rgba(90, 60, 30, 0.14)',
            '--dsw-alias-interactive-bg-hover-solid': '#efe4d3',
            '--dsw-alias-interactive-bg-hover-danger': 'rgba(168, 52, 42, 0.06)',
            '--dsw-alias-turn-trigger-bg': '#f4ecdd',
            '--dsw-alias-turn-trigger-bg-hover': 'rgba(90, 60, 30, 0.06)',
            '--dsw-alias-file-diff-added-bg': '#e8f0e4',
            '--dsw-alias-file-diff-added-gutter': '#f0f6ec',
            '--dsw-alias-file-diff-added-marker': '#3f7a52',
            '--dsw-alias-file-diff-deleted-bg': '#f7e4df',
            '--dsw-alias-file-diff-deleted-gutter': '#fbece8',
            '--dsw-alias-file-diff-deleted-marker': '#a8342a',
            '--dsw-alias-illustration-background': '#faf4e9',
            '--dsw-alias-illustration-backing': '#e2d3bd',
            '--dsw-alias-illustration-detail': '#d9c8b0',
            '--dsw-alias-illustration-surface': '#efe4d3',
            '--dsw-specific-bubble': '#f4e8d9',
            '--dsw-specific-bubble-highlight': '#e9d5bb',
            '--dsw-specific-input-major': '#fffdf7',
            '--dsw-specific-login-input': '#faf5ea',
            '--dsw-specific-selector': '#f2e9da',
            '--dsw-specific-sidebar-fill': '#f1e8d9',
            '--dsw-specific-sidebar-nav-item-active': '#e8dbc7',
            '--dsw-specific-sidebar-nav-item-active-accent': '#ddcab0',
            '--dsw-specific-tip': '#f2e9da',
            '--dsw-specific-menu': 'rgba(255, 250, 240, 0.62)',
            '--dsw-menu-surface-fill': 'rgba(255, 250, 240, 0.62)',
            '--dsw-alias-menu-group-header-fill': 'rgba(250, 244, 232, 0.94)',
          },
        },
        mo: {
          name: '墨夜 · 金',
          desc: '墨底 + 鎏金，深色专用',
          colorScheme: 'dark',
          tokens: {
            '--dsw-alias-bg-base': '#14100c',
            '--dsw-alias-bg-layer-1': '#1c1712',
            '--dsw-alias-bg-layer-2': '#231c15',
            '--dsw-alias-bg-layer-3': '#2a2219',
            '--dsw-alias-bg-overlay': '#3a2f23',
            '--dsw-alias-bg-module-platform': '#2a2219',
            '--dsw-alias-bg-multi-select': '#2a2219',
            '--dsw-alias-bg-document-preview': '#14100c',
            '--dsw-alias-bg-skeleton': 'rgba(255, 240, 220, 0.07)',
            '--dsw-alias-border-l1': 'rgba(255, 240, 220, 0.07)',
            '--dsw-alias-border-l2': 'rgba(255, 240, 220, 0.13)',
            '--dsw-alias-border-l3': 'rgba(255, 240, 220, 0.17)',
            '--dsw-alias-border-l4': 'rgba(255, 240, 220, 0.22)',
            '--dsw-alias-brand-primary': '#e9d8bc',
            '--dsw-alias-brand-primary-invert': '#14100c',
            '--dsw-alias-brand-text': '#e9d8bc',
            '--dsw-alias-button-primary-fill': '#e9d8bc',
            '--dsw-alias-button-primary-hover': '#f6ead4',
            '--dsw-alias-button-primary-dimmed': '#3a2f23',
            '--dsw-alias-button-contrast-fill': '#e9d8bc',
            '--dsw-alias-button-elevated-fill': '#2a2219',
            '--dsw-alias-button-floating-fill': '#231c15',
            '--dsw-alias-button-floating-hover': '#2f2619',
            '--dsw-alias-button-ghost-active-fill': '#3a2f23',
            '--dsw-alias-button-ghost-active-hover': '#463a2b',
            '--dsw-alias-button-ghost-active-border': '#7d6c57',
            '--dsw-alias-button-info-fill': '#7fa8c4',
            '--dsw-alias-button-info-hover': '#9dc0d8',
            '--dsw-alias-label-primary': '#f3e9d9',
            '--dsw-alias-label-secondary': '#c9b8a1',
            '--dsw-alias-label-tertiary': '#9c8a73',
            '--dsw-alias-label-caption': '#7d6c57',
            '--dsw-alias-label-dimmed': '#3a2f23',
            '--dsw-alias-label-primary-inverted': '#231c15',
            '--dsw-alias-label-primary-foreground': '#14100c',
            '--dsw-alias-label-primary-bluish': '#e9cfae',
            '--dsw-alias-label-primary-dimmed': '#f3e9d9',
            '--dsw-alias-menu-icon': '#e9cfae',
            '--dsw-alias-link': '#e9a882',
            '--dsw-alias-markdown-code-block': '#1a1510',
            '--dsw-alias-markdown-code-block-banner': '#221b14',
            '--dsw-alias-markdown-code-segment-selected': '#2a2219',
            '--dsw-alias-markdown-code-segment-unselected': '#1a1510',
            '--dsw-alias-markdown-inline-code': '#221b14',
            '--dsw-alias-markdown-tag': '#2a2219',
            '--dsw-alias-markdown-citation': '#221b14',
            '--dsw-alias-markdown-placeholder': '#2a2219',
            '--dsw-alias-scrollbar-bg-l1': '#463a2b',
            '--dsw-alias-scrollbar-bg-l2': '#5a4a37',
            '--dsw-alias-scrollbar-hover-l1': '#5a4a37',
            '--dsw-alias-scrollbar-hover-l2': '#6d5a44',
            '--dsw-alias-state-business-primary': '#e0846c',
            '--dsw-alias-state-business-tertiary': '#3a221c',
            '--dsw-alias-state-error-primary': '#f0877a',
            '--dsw-alias-state-error-secondary': '#f0877a',
            '--dsw-alias-state-success-primary': '#6cba87',
            '--dsw-alias-state-success-secondary': '#8acda0',
            '--dsw-alias-state-success-tertiary': '#23301f',
            '--dsw-alias-state-warn-primary': '#e0aa4e',
            '--dsw-alias-state-warn-secondary': '#ecc367',
            '--dsw-alias-state-warn-tertiary': '#392f1c',
            '--dsw-alias-state-warn-label': '#d8a24a',
            '--dsw-alias-state-idle-primary': '#6b5a47',
            '--dsw-alias-switch-thumb': '#c9b8a1',
            '--dsw-alias-toast-bg': '#2e2419',
            '--dsw-alias-toast-label': '#fff8ec',
            '--dsw-alias-tooltip-bg': '#2a2118',
            '--dsw-alias-interactive-bg-hover': 'rgba(255, 240, 220, 0.08)',
            '--dsw-alias-interactive-bg-active': 'rgba(255, 240, 220, 0.14)',
            '--dsw-alias-interactive-bg-hover-accent': 'rgba(255, 240, 220, 0.22)',
            '--dsw-alias-interactive-bg-hover-solid': '#2a2219',
            '--dsw-alias-turn-trigger-bg': 'rgba(255, 240, 220, 0.08)',
            '--dsw-alias-turn-trigger-bg-hover': 'rgba(255, 240, 220, 0.14)',
            '--dsw-alias-file-diff-added-bg': '#1f3124',
            '--dsw-alias-file-diff-added-gutter': '#132016',
            '--dsw-alias-file-diff-added-marker': '#41c977',
            '--dsw-alias-file-diff-deleted-bg': '#3c1f1b',
            '--dsw-alias-file-diff-deleted-gutter': '#28130e',
            '--dsw-alias-file-diff-deleted-marker': '#fa423e',
            '--dsw-alias-illustration-background': '#1c1712',
            '--dsw-alias-illustration-backing': '#3a2f23',
            '--dsw-alias-illustration-detail': '#5a4a37',
            '--dsw-alias-illustration-surface': '#2a2219',
            '--dsw-specific-bubble': '#2a2119',
            '--dsw-specific-bubble-highlight': '#3a2f23',
            '--dsw-specific-input-major': '#231c15',
            '--dsw-specific-login-input': '#1a1510',
            '--dsw-specific-selector': '#2a2219',
            '--dsw-specific-sidebar-fill': '#1b1611',
            '--dsw-specific-sidebar-nav-item-active': '#3a2f23',
            '--dsw-specific-sidebar-nav-item-active-accent': '#2a2219',
            '--dsw-specific-tip': '#2a2219',
            '--dsw-specific-menu': 'rgba(48, 40, 32, 0.55)',
            '--dsw-menu-surface-fill': 'rgba(48, 40, 32, 0.55)',
            '--dsw-alias-menu-group-header-fill': 'rgba(44, 36, 28, 0.94)',
          },
        },
      };

      // ---------- 紫禁城 · 朝堂：宫殿背景 + 半透明面板 ----------
      // 背景图是插件自绘的原创矢量插画（不是照片），也可以在「殿宇」换成自己的图。
      const PALACE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1431"/><stop offset=".42" stop-color="#5b2a3b"/><stop offset=".7" stop-color="#c4683b"/><stop offset="1" stop-color="#f1b66b"/></linearGradient>
<radialGradient id="glow" cx=".5" cy=".42" r=".42"><stop offset="0" stop-color="#ffdca0" stop-opacity=".85"/><stop offset="1" stop-color="#ffdca0" stop-opacity="0"/></radialGradient>
<linearGradient id="roof" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4c94a"/><stop offset="1" stop-color="#a6720f"/></linearGradient>
<linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9c2418"/><stop offset="1" stop-color="#66120c"/></linearGradient>
<linearGradient id="stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ece5d6"/><stop offset="1" stop-color="#b3a891"/></linearGradient>
<linearGradient id="plaza" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d7862"/><stop offset="1" stop-color="#33281f"/></linearGradient>
<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1b66b" stop-opacity="0"/><stop offset=".5" stop-color="#f1b66b" stop-opacity=".28"/><stop offset="1" stop-color="#f1b66b" stop-opacity="0"/></linearGradient>
<pattern id="tiles" width="9" height="9" patternUnits="userSpaceOnUse"><line x1="4.5" y1="0" x2="4.5" y2="9" stroke="#6e4808" stroke-opacity=".4" stroke-width="2"/></pattern>
<radialGradient id="vig" cx=".5" cy=".48" r=".78"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></radialGradient>
</defs>
<rect width="1600" height="900" fill="url(#sky)"/>
<rect width="1600" height="900" fill="url(#glow)"/>
<circle cx="800" cy="300" r="74" fill="#ffe6b0" opacity=".55"/>
<g fill="#ffe2b8" opacity=".16"><ellipse cx="300" cy="220" rx="230" ry="24"/><ellipse cx="1270" cy="180" rx="270" ry="20"/><ellipse cx="930" cy="250" rx="170" ry="13"/><ellipse cx="560" cy="150" rx="140" ry="10"/></g>
<g fill="none" stroke="#2a1a24" stroke-width="2.4" stroke-linecap="round" opacity=".7"><path d="M330 170q8-7 16 0q8-7 16 0"/><path d="M380 196q6-5 12 0q6-5 12 0"/><path d="M1150 130q7-6 14 0q7-6 14 0"/></g>
<g opacity=".92">
<rect x="110" y="660" width="250" height="22" fill="#9d927d"/><rect x="125" y="602" width="220" height="58" fill="#6a1c14"/>
<path d="M88 600Q110 614 136 614L334 614Q360 614 382 600L328 568L142 568Z" fill="#b48526"/>
<rect x="1240" y="660" width="250" height="22" fill="#9d927d"/><rect x="1255" y="602" width="220" height="58" fill="#6a1c14"/>
<path d="M1218 600Q1240 614 1266 614L1464 614Q1490 614 1512 600L1458 568L1272 568Z" fill="#b48526"/>
</g>
<rect y="540" width="1600" height="170" fill="url(#haze)"/>
<rect y="752" width="1600" height="148" fill="url(#plaza)"/>
<path d="M770 752L830 752L960 900L640 900Z" fill="#b19d80" opacity=".5"/>
<g stroke="#241a13" stroke-opacity=".28" stroke-width="2"><line x1="0" y1="772" x2="1600" y2="772"/><line x1="0" y1="798" x2="1600" y2="798"/><line x1="0" y1="832" x2="1600" y2="832"/><line x1="0" y1="874" x2="1600" y2="874"/><line x1="800" y1="752" x2="-500" y2="900"/><line x1="800" y1="752" x2="200" y2="900"/><line x1="800" y1="752" x2="1400" y2="900"/><line x1="800" y1="752" x2="2100" y2="900"/></g>
<rect x="380" y="700" width="840" height="52" fill="url(#stone)"/><rect x="380" y="700" width="840" height="5" fill="#f7f2e7"/>
<rect x="450" y="650" width="700" height="50" fill="url(#stone)"/><rect x="450" y="650" width="700" height="5" fill="#f7f2e7"/>
<rect x="520" y="610" width="560" height="40" fill="url(#stone)"/><rect x="520" y="610" width="560" height="4" fill="#f7f2e7"/>
<g fill="#efe9dc"><rect x="380" y="690" width="840" height="3"/><rect x="450" y="640" width="700" height="3"/><rect x="520" y="601" width="560" height="3"/></g>
<g fill="#ddd4c2">
<rect x="384" y="688" width="5" height="12"/><rect x="424" y="688" width="5" height="12"/><rect x="464" y="688" width="5" height="12"/><rect x="504" y="688" width="5" height="12"/><rect x="544" y="688" width="5" height="12"/><rect x="584" y="688" width="5" height="12"/><rect x="624" y="688" width="5" height="12"/><rect x="664" y="688" width="5" height="12"/><rect x="704" y="688" width="5" height="12"/><rect x="890" y="688" width="5" height="12"/><rect x="930" y="688" width="5" height="12"/><rect x="970" y="688" width="5" height="12"/><rect x="1010" y="688" width="5" height="12"/><rect x="1050" y="688" width="5" height="12"/><rect x="1090" y="688" width="5" height="12"/><rect x="1130" y="688" width="5" height="12"/><rect x="1170" y="688" width="5" height="12"/><rect x="1210" y="688" width="5" height="12"/>
<rect x="454" y="638" width="5" height="12"/><rect x="494" y="638" width="5" height="12"/><rect x="534" y="638" width="5" height="12"/><rect x="574" y="638" width="5" height="12"/><rect x="614" y="638" width="5" height="12"/><rect x="654" y="638" width="5" height="12"/><rect x="694" y="638" width="5" height="12"/><rect x="900" y="638" width="5" height="12"/><rect x="940" y="638" width="5" height="12"/><rect x="980" y="638" width="5" height="12"/><rect x="1020" y="638" width="5" height="12"/><rect x="1060" y="638" width="5" height="12"/><rect x="1100" y="638" width="5" height="12"/><rect x="1140" y="638" width="5" height="12"/>
</g>
<path d="M752 752L848 752L828 610L772 610Z" fill="#f4efe4"/>
<g stroke="#cbbfa8" stroke-width="1.5"><line x1="756" y1="736" x2="844" y2="736"/><line x1="759" y1="718" x2="841" y2="718"/><line x1="762" y1="700" x2="838" y2="700"/><line x1="765" y1="682" x2="835" y2="682"/><line x1="767" y1="664" x2="833" y2="664"/><line x1="769" y1="646" x2="831" y2="646"/><line x1="771" y1="628" x2="829" y2="628"/></g>
<path d="M788 752L812 752L806 610L794 610Z" fill="#cdbfa5"/>
<g fill="#5b4632"><ellipse cx="430" cy="684" rx="16" ry="11"/><rect x="420" y="668" width="20" height="8" rx="3"/><ellipse cx="1170" cy="684" rx="16" ry="11"/><rect x="1160" y="668" width="20" height="8" rx="3"/></g>
<rect x="560" y="496" width="480" height="114" fill="url(#wall)"/>
<g fill="#b8301f"><rect x="575" y="508" width="11" height="102"/><rect x="623" y="508" width="11" height="102"/><rect x="671" y="508" width="11" height="102"/><rect x="719" y="508" width="11" height="102"/><rect x="767" y="508" width="11" height="102"/><rect x="822" y="508" width="11" height="102"/><rect x="870" y="508" width="11" height="102"/><rect x="918" y="508" width="11" height="102"/><rect x="966" y="508" width="11" height="102"/><rect x="1014" y="508" width="11" height="102"/></g>
<g fill="#4c0e09" opacity=".55"><rect x="590" y="530" width="30" height="80"/><rect x="638" y="530" width="30" height="80"/><rect x="686" y="530" width="30" height="80"/><rect x="734" y="530" width="30" height="80"/><rect x="782" y="530" width="36" height="80"/><rect x="837" y="530" width="30" height="80"/><rect x="885" y="530" width="30" height="80"/><rect x="933" y="530" width="30" height="80"/><rect x="981" y="530" width="30" height="80"/></g>
<rect x="560" y="496" width="480" height="13" fill="#2c5560"/><g fill="#e2b74a"><circle cx="600" cy="502" r="3"/><circle cx="680" cy="502" r="3"/><circle cx="760" cy="502" r="3"/><circle cx="840" cy="502" r="3"/><circle cx="920" cy="502" r="3"/><circle cx="1000" cy="502" r="3"/></g>
<rect x="520" y="488" width="560" height="9" fill="#3a120b"/>
<path d="M466 470Q498 489 540 489L1060 489Q1102 489 1134 470L1012 446L588 446Z" fill="url(#roof)"/>
<path d="M466 470Q498 489 540 489L1060 489Q1102 489 1134 470L1012 446L588 446Z" fill="url(#tiles)"/>
<rect x="620" y="404" width="360" height="44" fill="url(#wall)"/>
<g fill="#b8301f"><rect x="634" y="414" width="9" height="34"/><rect x="694" y="414" width="9" height="34"/><rect x="754" y="414" width="9" height="34"/><rect x="837" y="414" width="9" height="34"/><rect x="897" y="414" width="9" height="34"/><rect x="957" y="414" width="9" height="34"/></g>
<rect x="620" y="404" width="360" height="10" fill="#2c5560"/>
<rect x="768" y="418" width="64" height="24" fill="#1f3c46" stroke="#e2b74a" stroke-width="2"/>
<rect x="608" y="410" width="384" height="8" fill="#3a120b"/>
<path d="M556 392Q588 411 630 411L970 411Q1012 411 1044 392L932 336L668 336Z" fill="url(#roof)"/>
<path d="M556 392Q588 411 630 411L970 411Q1012 411 1044 392L932 336L668 336Z" fill="url(#tiles)"/>
<rect x="662" y="327" width="276" height="11" fill="#94650e"/>
<path d="M664 338C650 318 664 302 682 308C674 316 678 326 688 332Z" fill="#8a5c0c"/>
<path d="M936 338C950 318 936 302 918 308C926 316 922 326 912 332Z" fill="#8a5c0c"/>
<path d="M0 556L156 598L156 900L0 900Z" fill="#7a1a12"/><path d="M0 542L166 588L166 604L0 560Z" fill="#c4922c"/>
<path d="M1600 556L1444 598L1444 900L1600 900Z" fill="#7a1a12"/><path d="M1600 542L1434 588L1434 604L1600 560Z" fill="#c4922c"/>
<rect width="1600" height="900" fill="url(#vig)"/>
</svg>`;
      const PALACE_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PALACE_SVG)}`;

      THEMES.zijin = {
        name: '紫禁城 · 朝堂',
        desc: '宫殿背景 + 半透明面板，可换成自己的图',
        colorScheme: 'dark',
        backdrop: true,
        art: PALACE_URL,
        // 在墨夜·金的基础上，把各层背景改成半透明，让背景图透出来
        tokens: {
          ...THEMES.mo.tokens,
          '--dsw-alias-bg-base': 'rgba(14, 9, 7, 0.36)',
          '--dsw-alias-bg-layer-1': 'rgba(24, 15, 11, 0.74)',
          '--dsw-alias-bg-layer-2': 'rgba(34, 22, 16, 0.70)',
          '--dsw-alias-bg-layer-3': 'rgba(44, 29, 21, 0.78)',
          '--dsw-alias-bg-overlay': 'rgba(30, 20, 15, 0.96)',
          '--dsw-alias-bg-module-platform': 'rgba(34, 22, 16, 0.70)',
          '--dsw-alias-bg-document-preview': 'rgba(18, 12, 9, 0.86)',
          '--dsw-specific-sidebar-fill': 'rgba(12, 8, 6, 0.60)',
          '--dsw-specific-input-major': 'rgba(24, 15, 11, 0.84)',
          '--dsw-specific-bubble': 'rgba(64, 38, 25, 0.80)',
          '--dsw-specific-menu': 'rgba(30, 20, 15, 0.92)',
          '--dsw-menu-surface-fill': 'rgba(30, 20, 15, 0.92)',
          '--dsw-alias-markdown-code-block': 'rgba(10, 7, 5, 0.72)',
          '--dsw-alias-border-l1': 'rgba(240, 200, 140, 0.10)',
          '--dsw-alias-border-l2': 'rgba(240, 200, 140, 0.18)',
          '--dsw-alias-border-l3': 'rgba(240, 200, 140, 0.24)',
          '--dsw-alias-border-l4': 'rgba(240, 200, 140, 0.30)',
          '--dsw-alias-brand-primary': '#e9c46a',
          '--dsw-alias-brand-primary-invert': '#1a0f08',
          '--dsw-alias-button-primary-fill': '#e9c46a',
          '--dsw-alias-button-primary-hover': '#f3d68e',
          '--dsw-alias-state-business-primary': '#e2614b',
          '--dsw-alias-label-primary': '#f7ecd8',
          '--dsw-alias-label-secondary': '#dcc8a6',
          '--dsw-alias-label-tertiary': '#ad9674',
          '--dsw-alias-link': '#f2b77c',
        },
      };

      // 背景图层：主题服务只管颜色，图片只能由插件自己挂一层样式。只在带 backdrop 的主题下存在，切走或卸载即移除。
      const BACKDROP_ID = 'sansheng-liubu-backdrop';
      const backdrop = { image: 'palace', version: 0, dim: 0.45 };
      // 自定义图对所有带背景的主题生效；没上传时用该主题自带的插画（紫禁城 / 罗马广场）
      const backdropUrl = (image = backdrop.image, version = backdrop.version, themeKey = activeTheme) => (image === 'custom'
        ? `${API}/background?v=${version}`
        : (THEMES[themeKey] && THEMES[themeKey].art) || PALACE_URL);

      function setBackdropOptions(ui = {}) {
        backdrop.image = ui.background === 'custom' ? 'custom' : 'palace';
        backdrop.version = ui.backgroundVersion || 0;
        backdrop.dim = Number(ui.backgroundDim) || 0.45;
        syncBackdrop();
      }

      /** rgba(…, 0.96) → rgb(…)：把半透明的颜色压成不透明的 */
      const solidOf = color => {
        const match = String(color || '').match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        return match ? `rgb(${match[1]}, ${match[2]}, ${match[3]})` : (color || '#1e140f');
      };

      function syncBackdrop() {
        if (typeof document === 'undefined') return;
        const root = document.documentElement;
        let style = document.getElementById(BACKDROP_ID);
        if (!(THEMES[activeTheme] && THEMES[activeTheme].backdrop)) {
          if (style) style.remove();
          root.removeAttribute('data-sansheng-backdrop');
          return;
        }
        if (!style) {
          style = document.createElement('style');
          style.id = BACKDROP_ID;
          document.head.appendChild(style);
        }
        const dim = Math.max(0.1, Math.min(0.85, backdrop.dim));
        root.setAttribute('data-sansheng-backdrop', '');
        // 图挂在 body::before（z-index -1）；body 自己的底色必须透明，否则会盖住它（负 z 层画在 body 背景之下）
        style.textContent = [
          `html[data-sansheng-backdrop]{background-color:#120b08;}`,
          `html[data-sansheng-backdrop] body{background:transparent!important;}`,
          `html[data-sansheng-backdrop] body::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;`
            + `background:linear-gradient(rgba(12,7,5,${dim}),rgba(12,7,5,${Math.min(0.9, dim + 0.12)})),url("${backdropUrl()}") center/cover no-repeat;}`,
          `html[data-sansheng-backdrop] .ssl-card{backdrop-filter:blur(8px);}`,
          // 盖在别的内容上面的浮层（文书预览、窄屏的流程抽屉）不能半透明，否则底下的字会透上来
          `html[data-sansheng-backdrop] .ssl-chat-doc,html[data-sansheng-backdrop] .ssl-bench-side.is-open,html[data-sansheng-backdrop] .ssl-hud-panel{background:${solidOf(THEMES[activeTheme].tokens['--dsw-alias-bg-overlay'])};backdrop-filter:none;}`,
        ].join('\n');
      }

      const themeIdOf = key => `sansheng-${key}`;

      function restoreUserTheme() {
        const current = typeof themeApi.getTheme === 'function' ? themeApi.getTheme() : null;
        const pref = current && current.preference;
        themeApi.setTheme(pref === 'dark' ? 'dark' : pref === 'light' ? 'light' : 'system');
      }

      function applyTheme(themeKey) {
        const next = THEMES[themeKey] ? themeKey : 'default';
        const prev = activeTheme;
        activeTheme = next;
        syncBackdrop();
        if (!themeApi || typeof themeApi.setTheme !== 'function') return;
        // 本来就没在用我们的主题时不碰 setTheme：每次刷新都 setTheme('system') 会把用户自己的明暗设置冲掉
        if (next === 'default' && prev === 'default') return;
        try {
          if (next === 'default') restoreUserTheme();
          else themeApi.setTheme(themeIdOf(next));
        } catch (error) {
          console.warn('[三省六部] 主题切换失败：', error);
        }
      }

      function applySkin(skinId) {
        const id = SKINS[skinId] ? skinId : 'default';
        activeSkin = id;
        if (!themeApi || typeof themeApi.overrideTokens !== 'function') return;
        if (skinDisposer) {
          try {
            skinDisposer();
          } catch {
            /* ignore */
          }
          skinDisposer = null;
        }
        const skin = SKINS[id];
        if (!skin || !skin.tokens) return;
        try {
          skinDisposer = themeApi.overrideTokens('sansheng-liubu', skin.tokens);
        } catch (error) {
          console.warn('[三省六部] 皮肤叠加失败：', error);
        }
      }

      // ---------- 通用 ----------
      const cx = (...list) => list.filter(Boolean).join(' ');

      // ---------- 罗马主题：大理石 · 紫 / 帝国之夜 · 金 / 罗马广场（带背景插画） ----------
      THEMES.marble = {
        colorScheme: 'light',
        tokens: {
          ...THEMES.gong.tokens,
          '--dsw-alias-bg-base': '#f3f0eb',
          '--dsw-alias-bg-layer-1': '#fbfaf7',
          '--dsw-alias-bg-layer-2': '#eeeae3',
          '--dsw-alias-bg-layer-3': '#e6e0d6',
          '--dsw-alias-bg-overlay': '#ebe5db',
          '--dsw-alias-bg-module-platform': '#efebe4',
          '--dsw-alias-bg-multi-select': '#efebe4',
          '--dsw-alias-bg-document-preview': '#f1eee8',
          '--dsw-alias-bg-document-selection': 'rgba(107, 31, 58, 0.30)',
          '--dsw-alias-border-l1': 'rgba(60, 40, 50, 0.09)',
          '--dsw-alias-border-l2': 'rgba(60, 40, 50, 0.15)',
          '--dsw-alias-border-l3': 'rgba(60, 40, 50, 0.20)',
          '--dsw-alias-border-l4': 'rgba(60, 40, 50, 0.26)',
          '--dsw-alias-brand-primary': '#6b1f3a',
          '--dsw-alias-brand-primary-invert': '#fbf8f5',
          '--dsw-alias-brand-text': '#2a1d22',
          '--dsw-alias-button-primary-fill': '#6b1f3a',
          '--dsw-alias-button-primary-hover': '#561731',
          '--dsw-alias-button-primary-dimmed': '#e3d3d9',
          '--dsw-alias-button-contrast-fill': '#3a2a30',
          '--dsw-alias-label-primary': '#221a1d',
          '--dsw-alias-label-secondary': '#4d4046',
          '--dsw-alias-label-tertiary': '#76686d',
          '--dsw-alias-label-caption': '#9b8e92',
          '--dsw-alias-label-primary-bluish': '#5a2a3c',
          '--dsw-alias-menu-icon': '#3e3036',
          '--dsw-alias-link': '#7a2343',
          '--dsw-alias-state-business-primary': '#8c1c24',
          '--dsw-alias-state-business-tertiary': '#f2dfe0',
          '--dsw-alias-state-warn-primary': '#a8781f',
          '--dsw-alias-interactive-bg-hover': 'rgba(60, 40, 50, 0.05)',
          '--dsw-alias-interactive-bg-active': 'rgba(60, 40, 50, 0.09)',
          '--dsw-alias-interactive-bg-hover-solid': '#e9e3da',
          '--dsw-alias-toast-bg': '#2a1d22',
          '--dsw-alias-tooltip-bg': '#2a1d22',
          '--dsw-alias-markdown-code-block': '#f0ece6',
          '--dsw-alias-markdown-inline-code': '#ece6de',
          '--dsw-alias-scrollbar-bg-l1': '#d6cdc4',
          '--dsw-alias-scrollbar-bg-l2': '#d6cdc4',
          '--dsw-specific-bubble': '#ece3e4',
          '--dsw-specific-bubble-highlight': '#e0d0d4',
          '--dsw-specific-input-major': '#fbfaf7',
          '--dsw-specific-selector': '#eee9e2',
          '--dsw-specific-sidebar-fill': '#ebe6de',
          '--dsw-specific-sidebar-nav-item-active': '#e0d8cd',
          '--dsw-specific-sidebar-nav-item-active-accent': '#d4c9bb',
          '--dsw-specific-tip': '#eee9e2',
          '--dsw-specific-menu': 'rgba(251, 249, 245, 0.66)',
          '--dsw-menu-surface-fill': 'rgba(251, 249, 245, 0.66)',
          '--dsw-alias-menu-group-header-fill': 'rgba(245, 241, 235, 0.94)',
        },
      };
      THEMES.nox = {
        colorScheme: 'dark',
        tokens: {
          ...THEMES.mo.tokens,
          '--dsw-alias-bg-base': '#120d12',
          '--dsw-alias-bg-layer-1': '#1a1319',
          '--dsw-alias-bg-layer-2': '#21181f',
          '--dsw-alias-bg-layer-3': '#2a1f27',
          '--dsw-alias-bg-overlay': '#36283a',
          '--dsw-alias-bg-module-platform': '#2a1f27',
          '--dsw-alias-bg-multi-select': '#2a1f27',
          '--dsw-alias-bg-document-preview': '#120d12',
          '--dsw-alias-border-l1': 'rgba(240, 220, 230, 0.07)',
          '--dsw-alias-border-l2': 'rgba(240, 220, 230, 0.13)',
          '--dsw-alias-border-l3': 'rgba(240, 220, 230, 0.18)',
          '--dsw-alias-border-l4': 'rgba(240, 220, 230, 0.24)',
          '--dsw-alias-brand-primary': '#dcb86c',
          '--dsw-alias-brand-primary-invert': '#120d12',
          '--dsw-alias-brand-text': '#dcb86c',
          '--dsw-alias-button-primary-fill': '#dcb86c',
          '--dsw-alias-button-primary-hover': '#ebcd8c',
          '--dsw-alias-label-primary': '#f2e8e6',
          '--dsw-alias-label-secondary': '#cfbfc3',
          '--dsw-alias-label-tertiary': '#9e8b91',
          '--dsw-alias-label-caption': '#7b696f',
          '--dsw-alias-link': '#e7a985',
          '--dsw-alias-state-business-primary': '#db6253',
          '--dsw-alias-state-business-tertiary': '#3a1d22',
          '--dsw-alias-interactive-bg-hover': 'rgba(240, 220, 230, 0.07)',
          '--dsw-alias-interactive-bg-active': 'rgba(240, 220, 230, 0.12)',
          '--dsw-alias-interactive-bg-hover-solid': '#2a1f27',
          '--dsw-specific-bubble': '#2c1f29',
          '--dsw-specific-bubble-highlight': '#3a2a36',
          '--dsw-specific-input-major': '#21181f',
          '--dsw-specific-selector': '#2a1f27',
          '--dsw-specific-sidebar-fill': '#150f14',
          '--dsw-specific-sidebar-nav-item-active': '#36283a',
          '--dsw-specific-sidebar-nav-item-active-accent': '#2a1f27',
          '--dsw-specific-tip': '#2a1f27',
          '--dsw-specific-menu': 'rgba(44, 32, 42, 0.58)',
          '--dsw-menu-surface-fill': 'rgba(44, 32, 42, 0.58)',
          '--dsw-alias-menu-group-header-fill': 'rgba(38, 28, 36, 0.94)',
        },
      };

      // 罗马广场：插件自绘的原创矢量插画（神庙、柱廊、远处的圆形剧场、柏树、夕阳）
      const FORUM_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1430"/><stop offset=".4" stop-color="#4b2747"/><stop offset=".68" stop-color="#b8603f"/><stop offset="1" stop-color="#efb36a"/></linearGradient>
<radialGradient id="sun" cx=".62" cy=".5" r=".4"><stop offset="0" stop-color="#ffd99a" stop-opacity=".9"/><stop offset="1" stop-color="#ffd99a" stop-opacity="0"/></radialGradient>
<linearGradient id="mb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3ece0"/><stop offset="1" stop-color="#b9ad98"/></linearGradient>
<linearGradient id="col" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#bfb39d"/><stop offset=".35" stop-color="#f5eee2"/><stop offset=".7" stop-color="#d9cfbd"/><stop offset="1" stop-color="#a99d88"/></linearGradient>
<linearGradient id="pav" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8c7a64"/><stop offset="1" stop-color="#2e251d"/></linearGradient>
<linearGradient id="hz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#efb36a" stop-opacity="0"/><stop offset=".55" stop-color="#efb36a" stop-opacity=".3"/><stop offset="1" stop-color="#efb36a" stop-opacity="0"/></linearGradient>
<radialGradient id="vg" cx=".5" cy=".48" r=".78"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".72"/></radialGradient>
</defs>
<rect width="1600" height="900" fill="url(#sk)"/>
<rect width="1600" height="900" fill="url(#sun)"/>
<circle cx="1000" cy="420" r="70" fill="#ffe3b0" opacity=".6"/>
<g fill="#ffdcb0" opacity=".14"><ellipse cx="320" cy="200" rx="240" ry="20"/><ellipse cx="1250" cy="160" rx="260" ry="18"/><ellipse cx="860" cy="250" rx="160" ry="11"/></g>
<path d="M0 560Q200 500 420 540T880 520T1300 530T1600 510L1600 640L0 640Z" fill="#5a3a3e" opacity=".55"/>
<g opacity=".7">
<path d="M1120 560Q1120 470 1300 462Q1480 470 1480 560Z" fill="#7d5747"/>
<path d="M1120 560L1480 560L1480 600L1120 600Z" fill="#6c4a3c"/>
<g fill="#3d2924"><rect x="1140" y="520" width="16" height="30" rx="8"/><rect x="1176" y="510" width="16" height="40" rx="8"/><rect x="1212" y="503" width="16" height="47" rx="8"/><rect x="1248" y="499" width="16" height="51" rx="8"/><rect x="1284" y="497" width="16" height="53" rx="8"/><rect x="1320" y="497" width="16" height="53" rx="8"/><rect x="1356" y="499" width="16" height="51" rx="8"/><rect x="1392" y="503" width="16" height="47" rx="8"/><rect x="1428" y="510" width="16" height="40" rx="8"/></g>
<g fill="#3d2924"><rect x="1150" y="568" width="14" height="24" rx="7"/><rect x="1190" y="568" width="14" height="24" rx="7"/><rect x="1230" y="568" width="14" height="24" rx="7"/><rect x="1270" y="568" width="14" height="24" rx="7"/><rect x="1310" y="568" width="14" height="24" rx="7"/><rect x="1350" y="568" width="14" height="24" rx="7"/><rect x="1390" y="568" width="14" height="24" rx="7"/><rect x="1430" y="568" width="14" height="24" rx="7"/></g>
</g>
<g fill="#24161c" opacity=".85"><path d="M118 640C104 560 112 470 124 420C136 470 144 560 130 640Z"/><path d="M168 640C156 580 162 510 172 470C182 510 188 580 178 640Z"/><path d="M1530 640C1518 570 1524 500 1536 452C1548 500 1554 570 1542 640Z"/><path d="M1490 640C1480 590 1484 540 1492 510C1500 540 1504 590 1496 640Z"/></g>
<rect y="560" width="1600" height="150" fill="url(#hz)"/>
<rect y="740" width="1600" height="160" fill="url(#pav)"/>
<g stroke="#21180f" stroke-opacity=".3" stroke-width="2"><line x1="0" y1="764" x2="1600" y2="764"/><line x1="0" y1="796" x2="1600" y2="796"/><line x1="0" y1="836" x2="1600" y2="836"/><line x1="0" y1="884" x2="1600" y2="884"/><line x1="800" y1="740" x2="-400" y2="900"/><line x1="800" y1="740" x2="250" y2="900"/><line x1="800" y1="740" x2="1350" y2="900"/><line x1="800" y1="740" x2="2000" y2="900"/></g>
<rect x="430" y="700" width="740" height="40" fill="url(#mb)"/><rect x="430" y="700" width="740" height="4" fill="#faf5ec"/>
<rect x="470" y="666" width="660" height="34" fill="url(#mb)"/><rect x="470" y="666" width="660" height="4" fill="#faf5ec"/>
<rect x="510" y="634" width="580" height="32" fill="url(#mb)"/><rect x="510" y="634" width="580" height="4" fill="#faf5ec"/>
<g fill="url(#col)">
<rect x="534" y="420" width="34" height="214"/><rect x="600" y="420" width="34" height="214"/><rect x="666" y="420" width="34" height="214"/><rect x="732" y="420" width="34" height="214"/><rect x="834" y="420" width="34" height="214"/><rect x="900" y="420" width="34" height="214"/><rect x="966" y="420" width="34" height="214"/><rect x="1032" y="420" width="34" height="214"/>
</g>
<g stroke="#a59985" stroke-opacity=".55" stroke-width="2"><line x1="544" y1="424" x2="544" y2="630"/><line x1="556" y1="424" x2="556" y2="630"/><line x1="610" y1="424" x2="610" y2="630"/><line x1="622" y1="424" x2="622" y2="630"/><line x1="676" y1="424" x2="676" y2="630"/><line x1="688" y1="424" x2="688" y2="630"/><line x1="742" y1="424" x2="742" y2="630"/><line x1="754" y1="424" x2="754" y2="630"/><line x1="844" y1="424" x2="844" y2="630"/><line x1="856" y1="424" x2="856" y2="630"/><line x1="910" y1="424" x2="910" y2="630"/><line x1="922" y1="424" x2="922" y2="630"/><line x1="976" y1="424" x2="976" y2="630"/><line x1="988" y1="424" x2="988" y2="630"/><line x1="1042" y1="424" x2="1042" y2="630"/><line x1="1054" y1="424" x2="1054" y2="630"/></g>
<g fill="#e9e1d2"><rect x="528" y="408" width="46" height="14"/><rect x="594" y="408" width="46" height="14"/><rect x="660" y="408" width="46" height="14"/><rect x="726" y="408" width="46" height="14"/><rect x="828" y="408" width="46" height="14"/><rect x="894" y="408" width="46" height="14"/><rect x="960" y="408" width="46" height="14"/><rect x="1026" y="408" width="46" height="14"/></g>
<rect x="770" y="470" width="60" height="164" fill="#2c1d18" opacity=".55"/>
<rect x="506" y="372" width="588" height="36" fill="url(#mb)"/>
<rect x="506" y="372" width="588" height="6" fill="#faf5ec"/>
<g fill="#b3a68f"><rect x="520" y="388" width="10" height="12"/><rect x="560" y="388" width="10" height="12"/><rect x="600" y="388" width="10" height="12"/><rect x="640" y="388" width="10" height="12"/><rect x="680" y="388" width="10" height="12"/><rect x="720" y="388" width="10" height="12"/><rect x="760" y="388" width="10" height="12"/><rect x="800" y="388" width="10" height="12"/><rect x="840" y="388" width="10" height="12"/><rect x="880" y="388" width="10" height="12"/><rect x="920" y="388" width="10" height="12"/><rect x="960" y="388" width="10" height="12"/><rect x="1000" y="388" width="10" height="12"/><rect x="1040" y="388" width="10" height="12"/><rect x="1080" y="388" width="10" height="12"/></g>
<path d="M494 372L800 270L1106 372Z" fill="url(#mb)"/>
<path d="M534 362L800 284L1066 362Z" fill="#d8ceba"/>
<circle cx="800" cy="334" r="16" fill="none" stroke="#a89a83" stroke-width="3"/>
<path d="M494 372L800 270L1106 372" fill="none" stroke="#faf5ec" stroke-width="5"/>
<g opacity=".95"><rect x="250" y="560" width="40" height="180" fill="url(#col)"/><rect x="244" y="548" width="52" height="14" fill="#e9e1d2"/><path d="M250 560L290 560L284 545L272 552L262 540Z" fill="#cfc4b0"/>
<rect x="330" y="640" width="40" height="100" fill="url(#col)"/><path d="M330 640L370 640L362 628L350 634L338 624Z" fill="#cfc4b0"/>
<rect x="1240" y="600" width="40" height="140" fill="url(#col)"/><rect x="1234" y="588" width="52" height="14" fill="#e9e1d2"/></g>
<rect x="210" y="736" width="200" height="10" fill="#9d917c"/><rect x="1200" y="736" width="140" height="10" fill="#9d917c"/>
<rect width="1600" height="900" fill="url(#vg)"/>
</svg>`;
      const FORUM_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(FORUM_SVG)}`;

      THEMES.roma = {
        colorScheme: 'dark',
        backdrop: true,
        art: FORUM_URL,
        // 在帝国之夜的基础上，各层背景半透明，让罗马广场透出来
        tokens: {
          ...THEMES.nox.tokens,
          '--dsw-alias-bg-base': 'rgba(12, 8, 12, 0.34)',
          '--dsw-alias-bg-layer-1': 'rgba(22, 15, 21, 0.74)',
          '--dsw-alias-bg-layer-2': 'rgba(32, 22, 30, 0.70)',
          '--dsw-alias-bg-layer-3': 'rgba(42, 30, 40, 0.78)',
          '--dsw-alias-bg-overlay': 'rgba(30, 21, 29, 0.96)',
          '--dsw-alias-bg-module-platform': 'rgba(32, 22, 30, 0.70)',
          '--dsw-alias-bg-document-preview': 'rgba(18, 12, 17, 0.86)',
          '--dsw-specific-sidebar-fill': 'rgba(10, 7, 10, 0.60)',
          '--dsw-specific-input-major': 'rgba(22, 15, 21, 0.84)',
          '--dsw-specific-bubble': 'rgba(60, 38, 54, 0.80)',
          '--dsw-specific-menu': 'rgba(30, 21, 29, 0.92)',
          '--dsw-menu-surface-fill': 'rgba(30, 21, 29, 0.92)',
          '--dsw-alias-markdown-code-block': 'rgba(10, 7, 10, 0.72)',
          '--dsw-alias-border-l1': 'rgba(240, 210, 160, 0.10)',
          '--dsw-alias-border-l2': 'rgba(240, 210, 160, 0.18)',
          '--dsw-alias-border-l3': 'rgba(240, 210, 160, 0.24)',
          '--dsw-alias-border-l4': 'rgba(240, 210, 160, 0.30)',
          '--dsw-alias-brand-primary': '#e6c272',
          '--dsw-alias-button-primary-fill': '#e6c272',
          '--dsw-alias-state-business-primary': '#e0644f',
          '--dsw-alias-label-primary': '#f7eee4',
          '--dsw-alias-label-secondary': '#dccab3',
          '--dsw-alias-label-tertiary': '#ad977f',
        },
      };

      // ---------- 语言：zh = 三省六部，en = 古罗马元老院 ----------
      const localeStore = {
        listeners: new Set(),
        set(value) {
          if ((value !== 'zh' && value !== 'en') || value === currentLocale) return;
          currentLocale = value;
          try {
            localStorage.setItem(LOCALE_KEY, value);
          } catch {
            /* 存不了就只在本次生效 */
          }
          for (const listener of localeStore.listeners) listener(value);
        },
      };
      const isEn = () => currentLocale === 'en';
      function useLocale() {
        const [, force] = useState(0);
        useEffect(() => {
          const listener = () => force(n => n + 1);
          localeStore.listeners.add(listener);
          return () => localeStore.listeners.delete(listener);
        }, []);
        return currentLocale;
      }
      function t(key, vars) {
        const table = TEXT[currentLocale] || TEXT.zh;
        let text = table[key] !== undefined ? table[key] : (TEXT.zh[key] !== undefined ? TEXT.zh[key] : key);
        if (vars) text = String(text).replace(/\{(\w+)\}/g, (match, name) => (vars[name] !== undefined ? String(vars[name]) : match));
        return text;
      }

      // 岗位：id 不变，按语言换名字、印章字与默认职掌
      const ROLE_TEXT = {
        zh: {
          emperor: { title: '皇帝', glyph: '朕' },
          ministries: { title: '六部', glyph: '六' },
          zhongshu: { title: '中书省', glyph: '中', duty: '起草方案（拟旨）' },
          menxia: { title: '门下省', glyph: '门', duty: '审议封驳' },
          shangshu: { title: '尚书省', glyph: '尚', duty: '派单与汇总' },
          personnel: { title: '吏部', glyph: '吏', duty: '人事、账号、权限、配置' },
          revenue: { title: '户部', glyph: '户', duty: '数据、表格、报表、财务' },
          rites: { title: '礼部', glyph: '礼', duty: '文书、汇报、PPT、对外沟通' },
          war: { title: '兵部', glyph: '兵', duty: '写代码、构建、部署' },
          justice: { title: '刑部', glyph: '刑', duty: '测试、审查、合规' },
          works: { title: '工部', glyph: '工', duty: '界面、设计、基础设施' },
          jinyiwei: { title: '锦衣卫', glyph: '锦', duty: '看守朝会：卡死即拿下、推脱即督办、超支即停朝' },
          yushi: { title: '监察御史', glyph: '御', duty: '巡查各部产出，不实即弹劾重办' },
          historian: { title: '史官', glyph: '史' },
        },
        en: {
          emperor: { title: 'Caesar', glyph: 'IMP' },
          ministries: { title: 'Magistrates', glyph: 'MAG' },
          zhongshu: { title: 'Consul', glyph: 'COS', duty: 'Drafts the plan (the decree)' },
          menxia: { title: 'Tribune', glyph: 'TR', duty: 'Reviews the plan and wields the veto' },
          shangshu: { title: 'Proconsul', glyph: 'PRO', duty: 'Dispatches orders and reports back' },
          personnel: { title: 'Censor', glyph: 'CEN', duty: 'People, accounts, permissions, configuration' },
          revenue: { title: 'Quaestor', glyph: 'Q', duty: 'Data, spreadsheets, reports, finance' },
          rites: { title: 'Pontifex', glyph: 'PON', duty: 'Documents, briefings, slides, public communication' },
          war: { title: 'Legate', glyph: 'LEG', duty: 'Code, builds, deployment' },
          justice: { title: 'Praetor', glyph: 'PR', duty: 'Tests, review, compliance' },
          works: { title: 'Aedile', glyph: 'AED', duty: 'UI, design, infrastructure' },
          jinyiwei: { title: 'Praetorian Guard', glyph: 'PG', duty: 'Guards the session: seizes stalled work, admonishes excuses, halts overspending' },
          yushi: { title: 'Agens in rebus', glyph: 'AR', duty: 'Inspects each magistrate’s output and impeaches what does not hold up' },
          historian: { title: 'Annalist', glyph: 'ANN' },
        },
      };
      // 老奏折里公文的 from / to 存的是中文官名，换回岗位 id 再按当前语言显示
      const LEGACY_PARTY = {};
      Object.entries(ROLE_TEXT.zh).forEach(([id, item]) => { LEGACY_PARTY[item.title] = id; });
      const partyId = key => LEGACY_PARTY[key] || key;
      const roleName = key => {
        const item = ROLE_TEXT[currentLocale][partyId(key)];
        return item ? item.title : String(key || '');
      };
      const roleGlyph = key => {
        const item = ROLE_TEXT[currentLocale][partyId(key)];
        return item ? item.glyph : String(key || '?').slice(0, 1);
      };
      /** 职掌：用户改过的原样显示；还是某种语言的默认值时，按当前语言显示 */
      const roleDuty = (id, duty) => {
        const own = String(duty || '').trim();
        const zh = ROLE_TEXT.zh[id] && ROLE_TEXT.zh[id].duty;
        const en = ROLE_TEXT.en[id] && ROLE_TEXT.en[id].duty;
        if (!own || own === zh || own === en) return (ROLE_TEXT[currentLocale][id] || {}).duty || own;
        return own;
      };
      const latinClass = text => (/^[\x20-\x7e]{2,}$/.test(String(text || '')) ? 'is-latin' : '');

      const SEALS = { treasury: ['帑', 'AER'], files: ['档', 'TAB'], app: ['三', 'SPQR'], roster: ['职', 'IX'], flow: ['流', 'ITER'], exec: ['令', 'ACTA'], chat: ['议', 'VOX'], edict: ['旨', 'E'], annals: ['史', 'LIB'] };
      const sealText = name => (SEALS[name] || ['?', '?'])[isEn() ? 1 : 0];
      function Seal({ name, size }) {
        const full = sealText(name);
        // 极小的印章放不下 ACTA / SPQR，只留首字母
        const text = size === 'xs' && /^[A-Z]{2,}$/.test(full) ? full.slice(0, 1) : full;
        const base = size === 'sm' ? 17 : size === 'xs' ? 10 : size === 'md' ? 18 : 22;
        const latin = /^[A-Z]+$/.test(text);
        const fontSize = latin ? Math.max(7, Math.round(base * (text.length > 3 ? 0.5 : text.length > 2 ? 0.56 : text.length > 1 ? 0.7 : 0.95))) : base;
        return h('span', {
          className: cx('ssl-seal', size && `ssl-seal--${size}`, latin && 'is-latin'),
          style: { fontSize: `${fontSize}px` },
          'aria-hidden': true,
        }, text);
      }

      const ROLE_GROUPS = [
        { key: 'groupDepartments', note: 'groupDepartmentsNote', ids: ['zhongshu', 'menxia', 'shangshu'] },
        { key: 'groupMinistries', note: 'groupMinistriesNote', ids: ['personnel', 'revenue', 'rites', 'war', 'justice', 'works'] },
      ];
      ROLE_GROUPS.push({ key: 'groupWatch', note: 'groupWatchNote', ids: ['jinyiwei', 'yushi'] });
      const ALL_ROLES = ROLE_GROUPS.flatMap(group => group.ids);
      // 插件自己办、不调模型的岗位
      const BUILT_IN = new Set(['shangshu', 'jinyiwei']);
      const MINISTRY_IDS = ROLE_GROUPS[1].ids;

      // 状态 → [中文, English, 色调]
      const STATUS = {
        queued: ['候朝', 'Queued', 'mut'],
        running: ['办差中', 'In session', 'warn'],
        'awaiting-input': ['待回填', 'Awaiting input', 'info'],
        'awaiting-approval': ['待批红', 'Awaiting seal', 'seal'],
        done: ['已归档', 'Archived', 'ok'],
        failed: ['已失败', 'Failed', 'err'],
        rejected: ['已驳回', 'Rejected', 'err'],
        cancelled: ['已叫停', 'Halted', 'mut'],
        pending: ['未办', 'Pending', 'mut'],
        'handed-off': ['已出工单', 'Work order', 'info'],
        skipped: ['已跳过', 'Skipped', 'mut'],
        idle: ['空闲', 'Idle', 'mut'],
      };
      const statusLabel = status => (STATUS[status] ? STATUS[status][isEn() ? 1 : 0] : status);

      // 公文性质 → [中文, English, 色调, 白话说明（中）, 白话说明（英）]
      const KINDS = {
        draft: ['拟旨', 'Mandate', 'plain', '皇帝把圣意交给中书省起草方案', 'Caesar hands his will to the Consul to draft a plan'],
        submit: ['送审', 'Submission', 'plain', '中书省把方案送门下省审议', 'The Consul submits the plan to the Tribune'],
        veto: ['封驳', 'Veto', 'err', '审查不通过：门下省把方案打回重拟', 'Review failed: the Tribune sends the plan back'],
        assent: ['准奏', 'Assent', 'ok', '审查通过，可以派单', 'Review passed; orders can go out'],
        overrule: ['保留', 'Overruled', 'warn', '丞相模式下封驳未决，按最后一版执行，意见转为注意事项', 'Autonomy: unresolved vetoes become cautions and the last draft goes ahead'],
        dispatch: ['派单', 'Dispatch', 'plain', '尚书省把方案拆成差事派给六部', 'The Proconsul splits the plan into orders for the magistrates'],
        order: ['差事', 'Order', 'plain', '派给某一部的一件具体工作', 'One concrete piece of work for one office'],
        retry: ['重办', 'Retry', 'warn', '失败后带着失败原因再办一次', 'A failed order tried again with the error in hand'],
        report: ['回文', 'Report', 'ok', '办完后的汇报', 'The report back after the work'],
        referral: ['移文', 'Referral', 'warn', '某部请另一部协助，由尚书省转办（只转一层）', 'One office asks another for help; the Proconsul forwards it (one hop only)'],
        fill: ['回填', 'Filled in', 'info', '只有图形界面的岗位，由你人工完成并填写结果', 'A GUI-only office: you did the work and filled in the result'],
        audit: ['复核', 'Audit', 'plain', '门下省按验收标准检查执行结果', 'The Tribune checks the results against the acceptance criteria'],
        remedy: ['补救', 'Remedy', 'warn', '复核不过：中书拟补救差事，六部补办', 'The audit failed: remedial orders are drafted and carried out'],
        memorial: ['上奏', 'Report to Caesar', 'seal', '尚书省汇总结果，交你批红（批准）', 'The Proconsul sums up and asks for your seal (approval)'],
        notice: ['告示', 'Notice', 'info', '朝堂说明：朝制、隔离分支、前朝经验、实录、未办的移文等', 'Court notices: procedure, isolation, lessons, chronicle, dropped referrals'],
        inspect: ['巡查', 'Inspection', 'ok', '监察御史检查这件差事的产出', 'The agens in rebus checks this order’s output'],
        impeach: ['弹劾', 'Impeachment', 'err', '御史发现产出不实（缺文件、说的和做的对不上），打回重办', 'The inspector found the output does not hold up; the order is redone'],
        admonish: ['督办', 'Admonition', 'warn', '锦衣卫发现推脱或失败，按压力阶梯督办重办（申饬 → 问话 → 考成 → 革职留任）', 'The Guard saw shirking or failure and escalates the redo (admonition → interrogation → review → last chance)'],
        guard: ['锦衣卫', 'Guard', 'err', '锦衣卫出手：卡死拿下、超支停朝', 'The Praetorian Guard acted: seized a stalled task or halted overspending'],
        chronicle: ['修史', 'Chronicle', 'plain', '史官把这份奏折值得记住的写进实录', 'The annalist writes what is worth keeping into the chronicle'],
      };
      const LEGACY_KIND = { 拟旨: 'draft', 送审: 'submit', 封驳: 'veto', 准奏: 'assent', 保留: 'overrule', 派单: 'dispatch', 差事: 'order', 重办: 'retry', 回文: 'report', 移文: 'referral', 复核: 'audit', 补救: 'remedy', 上奏: 'memorial', 文书: 'notice' };
      const kindOf = kind => KINDS[LEGACY_KIND[kind] || kind];
      const kindLabel = kind => { const item = kindOf(kind); return item ? item[isEn() ? 1 : 0] : String(kind || ''); };
      const kindGloss = kind => { const item = kindOf(kind); return item ? item[isEn() ? 4 : 3] : ''; };
      const kindTone = item => (item.ok === false ? 'err' : (kindOf(item.kind) || [])[2] || 'plain');
      function KindPill({ item }) {
        return h('span', { className: cx('ssl-pill', `ssl-pill--${kindTone(item)}`), title: kindGloss(item.kind) }, kindLabel(item.kind));
      }

      const EVENTS = {
        open: ['开朝', 'Opened'], stage: ['阶段', 'Stage'], message: ['公文', 'Message'], task: ['部务', 'Order done'],
        dispatch: ['派单', 'Dispatch'], memorial: ['上奏', 'Reported'], autoApprove: ['自动批红', 'Auto-sealed'], approve: ['批红', 'Sealed'],
        reject: ['驳回', 'Rejected'], cancel: ['叫停', 'Halted'], fail: ['失败', 'Failed'], remedy: ['补救', 'Remedy'],
        merge: ['合并', 'Merged'], discard: ['丢弃分支', 'Discarded'], guard: ['锦衣卫', 'Guard'],
      };
      const eventLabel = type => (EVENTS[type] ? EVENTS[type][isEn() ? 1 : 0] : type);

      const ADAPTER_LABEL = { cli: ['命令行', 'Command line'], self: ['DSH 本体', 'DSH itself'], manual: ['人工', 'Manual'] };

      const FLOW = [
        { id: 'drafting', label: ['中书拟旨', 'Draft'] },
        { id: 'reviewing', label: ['门下封驳', 'Veto?'] },
        { id: 'dispatching', label: ['尚书派单', 'Dispatch'] },
        { id: 'executing', label: ['六部执行', 'Work'] },
        { id: 'rechecking', label: ['门下复核', 'Audit'] },
        { id: 'memorial', label: ['上奏批红', 'Seal'] },
      ];
      const flowLabel = step => step.label[isEn() ? 1 : 0];
      const isLive = status => status === 'running' || status === 'awaiting-input';

      function timeText(ts) {
        try {
          return new Date(ts).toLocaleTimeString(isEn() ? 'en-GB' : 'zh-CN', { hour12: false });
        } catch {
          return String(ts || '');
        }
      }

      function dateTimeText(ts) {
        try {
          const d = new Date(ts);
          const sameDay = d.toDateString() === new Date().toDateString();
          return sameDay
            ? `${t('today')} ${timeText(ts)}`
            : d.toLocaleString(isEn() ? 'en-GB' : 'zh-CN', { hour12: false, month: isEn() ? 'short' : 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch {
          return String(ts || '');
        }
      }

      function fmtElapsed(ms) {
        const total = Math.max(0, Math.round((ms || 0) / 1000));
        const m = Math.floor(total / 60);
        const s = total % 60;
        if (isEn()) return m ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
        return m ? `${m}分${String(s).padStart(2, '0')}秒` : `${s}秒`;
      }

      /** 二〇二六年十月廿八日：奏折落款用的汉字日期 */
      function cnDate(date = new Date()) {
        const digits = '〇一二三四五六七八九';
        const year = String(date.getFullYear()).split('').map(d => digits[Number(d)]).join('');
        const num = n => (n <= 10 ? (n === 10 ? '十' : digits[n])
          : n < 20 ? `十${digits[n - 10]}`
          : n === 20 ? '二十' : n < 30 ? `廿${digits[n - 20]}`
          : n === 30 ? '三十' : `卅${digits[n - 30]}`);
        return `${year}年${num(date.getMonth() + 1)}月${num(date.getDate())}日`;
      }

      /** XXIX · OCT · MMXXVI：卷轴落款用的罗马数字日期 */
      function roman(n) {
        const table = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
        let out = '';
        let rest = n;
        for (const [value, sign] of table) while (rest >= value) { out += sign; rest -= value; }
        return out;
      }
      const ROMAN_MONTHS = ['IAN', 'FEB', 'MAR', 'APR', 'MAI', 'IVN', 'IVL', 'AVG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const romanDate = (date = new Date()) => `${roman(date.getDate())} · ${ROMAN_MONTHS[date.getMonth()]} · ${roman(date.getFullYear())}`;

      /** 老奏折的摘要里可能还是原始 JSON（方案 / 审议 / 移文），换成一句人话 */
      function prettySummary(text) {
        let value = String(text || '').replace(/\{"handoff"[\s\S]*\}\s*$/, '').trim();
        if (value.startsWith('{')) {
          try {
            const data = JSON.parse(value);
            if (Array.isArray(data.steps)) value = `${data.summary || ''}${data.steps.length ? ` (${data.steps.length})` : ''}`;
            else if (data.verdict) value = `${kindLabel(data.verdict === 'approve' ? 'assent' : 'veto')}${Array.isArray(data.issues) && data.issues.length ? `: ${data.issues.join('; ')}` : ''}`;
          } catch {
            /* 截断的 JSON：原样显示 */
          }
        }
        return value;
      }

      /** 盖完印再清空：让「准」字落在刚写的圣意上；这期间若又改了内容就不动 */
      const clearAfterStamp = (setValue, sent) => setTimeout(() => setValue(current => (current === sent ? '' : current)), 1300);

      // ---------- 下旨框：中文是奏折（竖排可切横排），英文是罗马卷轴 ----------
      const ORIENT_KEY = 'sansheng-liubu.orientation';
      function useOrientation() {
        const [value, setValue] = useState(() => {
          try {
            return localStorage.getItem(ORIENT_KEY) || 'v';
          } catch {
            return 'v';
          }
        });
        const set = next => {
          setValue(next);
          try {
            localStorage.setItem(ORIENT_KEY, next);
          } catch {
            /* 存不了就只在本次生效 */
          }
        };
        return [value, set];
      }

      function Composer(props) {
        useLocale();
        return isEn() ? h(Scroll, props) : h(Zouzhe, props);
      }

      const submitOnEnter = (canSubmit, onSubmit) => event => {
        if (event.key !== 'Enter' || event.shiftKey || event.altKey) return;
        if (event.isComposing || event.keyCode === 229) return;
        event.preventDefault();
        if (canSubmit) onSubmit();
      };

      /**
       * 奏折式下旨框。竖排右起书写（可切横排；compact 时固定横排信笺），朱印即提交按钮；
       * stamp 每变一次就在纸上盖一个「准」字印。
       */
      function Zouzhe({ value, onChange, onSubmit, canSubmit, sending, disabled, placeholder, extra, caption, stamp, compact, autoFocus }) {
        const [orient, setOrient] = useOrientation();
        const horizontal = !compact && orient === 'h';
        return h('div', { className: cx('zz', compact && 'zz--compact', horizontal && 'zz--h') },
          h('div', { className: 'zz-book' },
            h('div', { className: 'zz-paper' },
              h('div', { className: 'zz-head', 'aria-hidden': true },
                h('span', { className: 'zz-title' }, '圣意'),
                h('span', { className: 'zz-sub' }, '奉天承运 皇帝诏曰')),
              h('textarea', {
                className: 'zz-text', value, disabled, placeholder, autoFocus, 'aria-label': t('briefLabel'),
                onChange: event => onChange(event.target.value),
                onKeyDown: submitOnEnter(canSubmit, onSubmit),
              }),
              h('div', { className: 'zz-tail' },
                h('span', { className: 'zz-date', 'aria-hidden': true }, cnDate()),
                h('button', { className: 'zz-seal', disabled: !canSubmit, onClick: onSubmit, title: t('sealTitle'), 'aria-label': t('issue') },
                  h('span', null, sending ? '开朝' : '下旨'))),
              stamp ? h('span', { key: stamp, className: 'zz-stamp', 'aria-hidden': true }, '准') : null)),
          extra ? h('div', { className: 'zz-slips' }, extra) : null,
          caption || !compact ? h('div', { className: 'zz-tools' },
            h('div', { className: 'zz-caption' }, caption || ''),
            compact ? null : h('button', {
              className: 'ssl-btn ssl-btn--ghost ssl-btn--sm', title: t('orientTitle'),
              onClick: () => setOrient(horizontal ? 'v' : 'h'),
            }, horizontal ? t('orientVertical') : t('orientHorizontal'))) : null);
      }

      /** 罗马卷轴：木轴 + 莎草纸，按火漆印 SPQR 下旨，盖下去是一枚 APPROBATVM */
      function Scroll({ value, onChange, onSubmit, canSubmit, sending, disabled, placeholder, extra, caption, stamp, compact, autoFocus }) {
        return h('div', { className: cx('sc', compact && 'sc--compact') },
          h('div', { className: 'sc-scroll' },
            h('span', { className: 'sc-rod', 'aria-hidden': true }),
            h('div', { className: 'sc-paper' },
              h('div', { className: 'sc-head', 'aria-hidden': true },
                h('span', { className: 'sc-title' }, 'EDICTVM'),
                h('span', { className: 'sc-sub' }, 'By order of Caesar · S·P·Q·R')),
              h('textarea', {
                className: 'sc-text', value, disabled, placeholder, autoFocus, 'aria-label': t('briefLabel'),
                onChange: event => onChange(event.target.value),
                onKeyDown: submitOnEnter(canSubmit, onSubmit),
              }),
              h('div', { className: 'sc-foot' },
                h('span', { className: 'sc-date', 'aria-hidden': true }, romanDate()),
                h('button', { className: 'sc-seal', disabled: !canSubmit, onClick: onSubmit, title: t('sealTitle'), 'aria-label': t('issue') },
                  h('span', null, sending ? '…' : 'SPQR'))),
              stamp ? h('span', { key: stamp, className: 'sc-stamp', 'aria-hidden': true }, h('span', null, h('b', null, 'SPQR'), 'APPROBATVM')) : null),
            h('span', { className: 'sc-rod', 'aria-hidden': true })),
          extra ? h('div', { className: 'zz-slips' }, extra) : null,
          caption ? h('div', { className: 'zz-caption' }, caption) : null);
      }

      function StatusPill({ status, text }) {
        const [, , tone] = STATUS[status] || [status, status, 'mut'];
        return h('span', { className: cx('ssl-pill', `ssl-pill--${tone}`) },
          h('span', { className: cx('ssl-dot', isLive(status) && 'ssl-dot--pulse') }),
          text || statusLabel(status));
      }

      /** 终端风格的输出尾巴，有新输出时自动滚到底 */
      function Terminal({ text, max = 900, height = 160 }) {
        const ref = useRef(null);
        const body = String(text || '').slice(-max);
        useEffect(() => {
          if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
        }, [body]);
        return h('pre', { ref, className: cx('ssl-term', !body && 'ssl-term--empty'), style: { maxHeight: `${height}px` } }, body || t('waitingOutput'));
      }

      /** 朝会流程每一步的状态：is-done 已过 / is-active 进行中 / is-halted 停在此处 / '' 未到 */
      function flowStates(edict) {
        let current = -1;
        let halted = -1;
        if (edict) {
          if (edict.status === 'done') current = FLOW.length;
          else if (edict.status === 'awaiting-approval') current = FLOW.length - 1;
          // 自我修复阶段是在补办差事，流程条上落在「六部执行」
          const stageOf = id => FLOW.findIndex(step => step.id === (id === 'fixing' ? 'executing' : id));
          if (isLive(edict.status)) current = Math.max(0, stageOf(edict.stage));
          else if (edict.haltedAt) {
            const at = edict.haltedAt === 'awaiting-approval' ? FLOW.length - 1 : stageOf(edict.haltedAt);
            halted = at;
            current = at;
          }
        }
        return FLOW.map((step, index) => (index === halted ? 'is-halted'
          : index < current ? 'is-done'
          : index === current ? (edict && (edict.status === 'awaiting-approval' || isLive(edict.status)) ? 'is-active' : 'is-done')
          : ''));
      }
      const flowNode = (state, index) => (state === 'is-done' ? '✓' : state === 'is-halted' ? '×' : index + 1);

      /** 朝会流程条（横排） */
      function Flow({ edict }) {
        const states = flowStates(edict);
        return h('div', { className: 'ssl-flow' }, FLOW.map((step, index) => h('div', { key: step.id, className: cx('ssl-flow-step', states[index]) },
          h('div', { className: 'ssl-flow-node' }, flowNode(states[index], index)),
          h('div', { className: 'ssl-flow-label' }, flowLabel(step)))));
      }

      /** 朝会流程（竖排，放朝堂右栏）：进行中的那一步底下带上当前进展 */
      function FlowList({ edict }) {
        const states = flowStates(edict);
        return h('ol', { className: 'ssl-vflow' }, FLOW.map((step, index) => h('li', { key: step.id, className: states[index] },
          h('span', { className: 'ssl-vflow-node' }, flowNode(states[index], index)),
          h('div', { className: 'ssl-grow' },
            h('div', { className: 'ssl-vflow-label' }, flowLabel(step)),
            states[index] === 'is-active' && edict && edict.note ? h('div', { className: 'ssl-caption' }, edict.note) : null))));
      }

      function Section({ title, note, right }) {
        return h('div', { className: 'ssl-section' }, h('h3', null, title), note ? h('span', null, note) : null, right || null);
      }

      // ---------- 官职卡：换人 + 换模型 + 实时状态 ----------
      function RoleCard({ roleId, role, agents, live, onAssign, fallbackName }) {
        const agent = agents.find(item => item.id === role.agentId) || null;
        const models = agent && Array.isArray(agent.models) ? agent.models : [];
        const current = role.model || '';
        const [draft, setDraft] = useState(current);
        useEffect(() => setDraft(current), [current]);
        const duty = roleDuty(roleId, role.duty);
        const [dutyDraft, setDutyDraft] = useState(duty);
        useEffect(() => setDutyDraft(duty), [duty]);
        const title = roleName(roleId);

        const commit = () => {
          const next = String(draft || '').trim();
          if (next !== current) onAssign(roleId, { model: next });
        };
        // 职掌会写进拟旨 prompt，中书按它决定把活派给谁
        const commitDuty = () => {
          const next = String(dutyDraft || '').trim();
          if (next && next !== duty) onAssign(roleId, { duty: next });
          else setDutyDraft(duty);
        };
        // 当前任职的 agent 即使停用了也要列出来：否则下拉框显示第一项、实际值却是停用的那个，选第一项也触发不了 onChange
        const options = agents.filter(item => item.enabled !== false || item.id === role.agentId);
        const isCli = agent && agent.adapter === 'cli' && agent.enabled !== false;
        const glyph = roleGlyph(roleId);

        let note = null;
        if (BUILT_IN.has(roleId)) note = h('div', { className: 'ssl-caption', style: { marginTop: '8px' } }, t(roleId === 'jinyiwei' ? 'roleJinyiwei' : 'roleShangshu'));
        else if (roleId === 'yushi' && isCli) note = h('div', { className: 'ssl-caption', style: { marginTop: '8px' } }, t('roleYushi'));
        else if (fallbackName && !isCli) {
          const reason = !agent ? t('roleVacantShort') : agent.enabled === false ? t('roleDisabledShort', { name: agent.name }) : t('roleNoCliShort', { name: agent.name });
          note = h('div', { className: 'ssl-caption', style: { marginTop: '8px', color: 'var(--ssl-ok)' } }, t('roleDeputy', { reason, deputy: fallbackName }));
        } else if (!agent) note = h('div', { className: 'ssl-hint' }, t('roleVacant'));
        else if (agent.enabled === false) note = h('div', { className: 'ssl-hint' }, t('roleDisabled', { name: agent.name }));
        else if (agent.adapter !== 'cli') note = h('div', { className: 'ssl-caption', style: { marginTop: '8px' } }, agent.adapter === 'self' ? t('roleSelf') : t('roleManual'));

        return h('div', { className: cx('ssl-card ssl-role', live && 'is-live') },
          h('div', { className: 'ssl-role-head' },
            h('span', { className: cx('ssl-glyph', latinClass(glyph)) }, glyph),
            h('div', { className: 'ssl-grow' },
              h('div', { className: 'ssl-role-title' }, title),
              h('input', {
                className: 'ssl-inline',
                value: dutyDraft,
                title: t('dutyTitle', { duty }),
                'aria-label': t('dutyAria', { role: title }),
                onChange: event => setDutyDraft(event.target.value),
                onBlur: commitDuty,
                onKeyDown: event => {
                  if (event.key === 'Enter') event.target.blur();
                  if (event.key === 'Escape') { setDutyDraft(duty); setTimeout(() => event.target.blur()); }
                },
              })),
            live ? h(StatusPill, { status: 'running', text: fmtElapsed(live.elapsedMs) }) : h(StatusPill, { status: 'idle' })),
          BUILT_IN.has(roleId) ? null : h('div', { className: 'ssl-role-fields' },
            h('label', { className: 'ssl-field' },
              h('span', { className: 'ssl-label' }, t('fieldAgent')),
              h('select', {
                className: 'ssl-input',
                value: role.agentId || '',
                onChange: event => onAssign(roleId, { agentId: event.target.value }),
              },
              h('option', { value: '' }, t('vacantOption')),
              options.map(item => h('option', { key: item.id, value: item.id },
                `${item.name}${item.enabled === false ? t('disabledSuffix') : ''}`)))),
            h('label', { className: 'ssl-field' },
              h('span', { className: 'ssl-label' }, t('fieldModel')),
              h('input', {
                className: 'ssl-input',
                value: draft,
                disabled: !isCli || roleId === 'shangshu',
                list: `ssl-models-${roleId}`,
                placeholder: roleId === 'shangshu' ? t('modelPlugin') : isCli ? t('modelDefault') : t('modelNoCli'),
                onChange: event => setDraft(event.target.value),
                onBlur: commit,
                onKeyDown: event => {
                  if (event.key === 'Enter') event.target.blur();
                  if (event.key === 'Escape') { setDraft(current); setTimeout(() => event.target.blur()); }
                },
              }),
              h('datalist', { id: `ssl-models-${roleId}` }, models.map(model => h('option', { key: model, value: model }))))),
          note,
          live ? h('div', { className: 'ssl-live' },
            h('div', { className: 'ssl-caption ssl-ellipsis' }, `${kindLabel(live.kind)} · ${live.title || t('working')}`),
            powerOfState(courtStore.state).see >= 3 ? h(Activity, { item: live, state: courtStore.state, compact: true }) : null) : null);
      }

      // ---------- 官制模板：一键改九个岗位的职掌（中书按职掌派活） ----------
      const COURT_TEMPLATES = {
        dev: {
          name: ['通用研发', 'General engineering'],
          duties: {
            zh: Object.fromEntries(ALL_ROLES.map(id => [id, ROLE_TEXT.zh[id].duty])),
            en: Object.fromEntries(ALL_ROLES.map(id => [id, ROLE_TEXT.en[id].duty])),
          },
        },
        video: {
          name: ['短视频', 'Short video'],
          duties: {
            zh: {
              zhongshu: '企划总纲：选题、受众、前 3 秒钩子、结构、时长与风格',
              menxia: '审企划与成片：钩子强度、时长、平台规范、版权与肖像风险',
              shangshu: '派单与汇总',
              revenue: '对标与数据：拆解同类爆款，定话题标签与发布时段',
              rites: '脚本与分镜表（镜号/时长/画面/台词/字幕），以及发布标题、描述、话题标签',
              works: '画面生成：按分镜逐镜生成视频片段或图片（AI 生图/生视频 API 或本地工具）',
              personnel: '配乐与音效：选曲或生成，确认可商用授权，导出音频',
              war: '剪辑合成：按分镜拼接、烧录字幕、混音，用 ffmpeg 导出 1080x1920 竖屏成片',
              justice: '成片质检：用 ffprobe 查时长、分辨率、响度，核对字幕错字与安全区',
            },
            en: {
              zhongshu: 'Creative brief: topic, audience, 3-second hook, structure, length and style',
              menxia: 'Review brief and cut: hook strength, length, platform rules, copyright and likeness risk',
              shangshu: 'Dispatches orders and reports back',
              revenue: 'Benchmarks and data: dissect similar hits, choose hashtags and posting time',
              rites: 'Script and shot list (shot/length/visual/line/caption), plus title, description and hashtags',
              works: 'Visuals: generate each shot as video or image (AI image/video APIs or local tools)',
              personnel: 'Music and sound: pick or generate tracks, confirm commercial licence, export audio',
              war: 'Edit and render: assemble shots, burn captions, mix, export 1080x1920 vertical with ffmpeg',
              justice: 'Quality check: ffprobe for length, resolution and loudness; proofread captions and safe areas',
            },
          },
        },
      };

      function RulesCard({ state, onSave }) {
        const rules = state.rules || {};
        const autonomous = rules.autonomous === true;
        const cliAgents = state.agents.filter(item => item.adapter === 'cli' && item.enabled !== false);
        const setRule = patch => onSave({ rules: { ...rules, ...patch } }, t('rulesSaved'));
        const applyTemplate = key => {
          const template = COURT_TEMPLATES[key];
          if (!template) return;
          const roles = { ...state.roles };
          Object.entries(template.duties[isEn() ? 'en' : 'zh']).forEach(([roleId, duty]) => { roles[roleId] = { ...(roles[roleId] || {}), duty }; });
          onSave({ roles }, t('templateApplied', { name: template.name[isEn() ? 1 : 0] }));
        };
        const check = (key, label, title) => h('label', { className: 'ssl-check', title },
          h('input', { type: 'checkbox', checked: key === 'isolation' ? rules.isolation !== 'off' : rules[key] !== false && (key !== 'autoMerge' || rules.autoMerge === true), onChange: event => {
            const on = event.target.checked;
            setRule(key === 'isolation' ? { isolation: on ? 'worktree' : 'off' } : { [key]: on });
          } }),
          label);
        const numberSelect = (key, label, fallback, render) => h('label', { className: 'ssl-field' },
          h('span', { className: 'ssl-label' }, label),
          h('select', { className: 'ssl-input', value: String(rules[key] ?? fallback), onChange: event => setRule({ [key]: Number(event.target.value) }) },
            [1, 2, 3, 4].map(n => h('option', { key: n, value: String(n) }, render(n)))));

        return h('div', { className: cx('ssl-card', autonomous && 'is-auto') },
          h('div', { className: 'ssl-rules' },
            h('div', { className: 'ssl-auto' },
              h('label', { className: 'ssl-switch', title: autonomous ? t('autoOnTitle') : t('autoOffTitle') },
                h('input', { type: 'checkbox', checked: autonomous, onChange: event => setRule({ autonomous: event.target.checked }) }),
                h('span', null)),
              h('div', { className: 'ssl-grow' },
                h('div', { className: 'ssl-role-title' }, autonomous ? t('autoOn') : t('autoOff')),
                h('div', { className: 'ssl-caption' }, autonomous ? t('autoOnDesc') : t('autoOffDesc')))),
            h('label', { className: 'ssl-field' },
              h('span', { className: 'ssl-label' }, t('fieldDeputy')),
              h('select', {
                className: 'ssl-input', value: rules.fallbackAgentId || '',
                onChange: event => setRule({ fallbackAgentId: event.target.value }),
              },
              h('option', { value: '' }, t('noDeputy')),
              cliAgents.map(item => h('option', { key: item.id, value: item.id }, item.name)))),
            h('label', { className: 'ssl-field' },
              h('span', { className: 'ssl-label' }, t('fieldFix')),
              h('select', {
                className: 'ssl-input', value: String(rules.maxFixRounds ?? 2),
                onChange: event => setRule({ maxFixRounds: Number(event.target.value) }),
              }, [0, 1, 2, 3].map(n => h('option', { key: n, value: String(n) }, n ? t('fixRounds', { n }) : t('noFix'))))),
            h('label', { className: 'ssl-field' },
              h('span', { className: 'ssl-label' }, t('fieldTemplate')),
              h('select', {
                className: 'ssl-input', value: '',
                onChange: event => { applyTemplate(event.target.value); event.target.value = ''; },
              },
              h('option', { value: '' }, t('applyTemplate')),
              Object.entries(COURT_TEMPLATES).map(([key, template]) => h('option', { key, value: key }, template.name[isEn() ? 1 : 0]))))),
          h('div', { className: 'ssl-rules2' },
            check('isolation', t('ruleIsolation'), t('ruleIsolationTitle')),
            check('execWrites', t('ruleWrites'), t('ruleWritesTitle')),
            check('autoMerge', t('ruleAutoMerge'), t('ruleAutoMergeTitle')),
            check('useMemory', t('ruleMemory'), t('ruleMemoryTitle')),
            check('regimePowers', zhEn('朝局定皇权', 'Regime sets power'), zhEn('开着：朝中工具越少，皇帝看得越少、驳回不了、能并行的越少；关掉：都按下面的上限走', 'On: fewer tools means you see less, cannot reject and run less in parallel. Off: the limits below apply')),
            // 朝局定皇权时，并行与同时开朝的数目由朝局定，这两项只读
            rules.regimePowers !== false
              ? h('div', { className: 'ssl-field' },
                h('span', { className: 'ssl-label' }, `${t('ruleParallel')} / ${t('ruleConcurrent')}`),
                h('span', { className: 'ssl-caption', style: { paddingTop: '6px' } }, `${zhEn('由朝局定：', 'Set by the regime: ')}${doText(powerOfState(state))}`))
              : h(React.Fragment, null,
                numberSelect('parallel', t('ruleParallel'), 2, n => (n === 1 ? t('serial') : t('parallelN', { n }))),
                numberSelect('maxConcurrent', t('ruleConcurrent'), 2, n => t('concurrentN', { n })))),
          h('div', { className: 'ssl-rules2' },
            h('label', { className: 'ssl-field' },
              h('span', { className: 'ssl-label' }, t('ruleMode')),
              h('select', { className: 'ssl-input', value: rules.mode || 'auto', onChange: event => setRule({ mode: event.target.value }) },
                ['auto', 'express', 'standard', 'grand'].map(value => h('option', { key: value, value }, t(`mode_${value}`))))),
            h('label', { className: 'ssl-field' },
              h('span', { className: 'ssl-label' }, t('ruleRetries')),
              h('select', { className: 'ssl-input', value: String(rules.maxRetries ?? 1), onChange: event => setRule({ maxRetries: Number(event.target.value) }) },
                [0, 1, 2, 3].map(n => h('option', { key: n, value: String(n) }, n ? t('retriesN', { n }) : t('noRetry'))))),
            h('label', { className: 'ssl-field' },
              h('span', { className: 'ssl-label' }, t('rulePressure')),
              h('select', { className: 'ssl-input', value: rules.pressure || 'standard', onChange: event => setRule({ pressure: event.target.value }) },
                ['standard', 'gentle', 'off'].map(value => h('option', { key: value, value }, t(`pressure_${value}`))))),
            h('label', { className: 'ssl-field' },
              h('span', { className: 'ssl-label' }, t('ruleStall')),
              h('select', { className: 'ssl-input', value: String(rules.stallSeconds ?? 300), onChange: event => setRule({ stallSeconds: Number(event.target.value) }) },
                [0, 120, 300, 600, 1200].map(n => h('option', { key: n, value: String(n) }, n ? t('stallN', { n: n / 60 }) : t('stallOff'))))),
            check('historian', t('ruleHistorian'), t('ruleHistorianTitle')),
            h('span', null)));
      }

      /** 保存编制（群臣 / 官职 / 朝规）的一部分，其余沿用当前值 */
      function savePresetPatch(state, patch, onRefresh, notify, okText) {
        const body = { agents: state.agents, roles: state.roles, rules: state.rules, ...patch };
        apiJson('/preset', { method: 'PUT', body: JSON.stringify(body) })
          .then(() => { onRefresh(); notify(okText); })
          .catch(error => notify(String(error.message || error), 'err'));
      }

      const liveByRoleOf = live => {
        const map = {};
        (live || []).forEach(item => { if (!map[item.roleId]) map[item.roleId] = item; });
        return map;
      };

      // ---------- 朝规 + 三省六部名册：朝堂页签与头部「朝堂职位」视图共用 ----------
      function CourtRoster({ state, onRefresh, notify }) {
        const liveByRole = useMemo(() => liveByRoleOf(state.live), [state.live]);
        const savePreset = (patch, okText) => savePresetPatch(state, patch, onRefresh, notify, okText);
        const assign = (roleId, patch) => {
          const prev = state.roles[roleId] || {};
          const next = { ...prev, ...patch };
          // 换了人，上一位的模型名多半不适用（如把 opus 带给 Codex），清空回默认
          if (patch.agentId !== undefined && patch.agentId !== prev.agentId) next.model = '';
          savePreset({ roles: { ...state.roles, [roleId]: next } }, t('roleUpdated', { role: roleName(roleId) }));
        };
        const autonomous = state.rules && state.rules.autonomous === true;
        const fallbackAgent = autonomous && state.agents.find(item => item.id === state.rules.fallbackAgentId && item.adapter === 'cli' && item.enabled !== false);
        const fallbackName = fallbackAgent ? fallbackAgent.name : '';

        return h('div', null,
          h(Section, { title: t('rulesTitle'), note: t('rulesNote') }),
          h(RulesCard, { state, onSave: savePreset }),
          ROLE_GROUPS.map(group => h('div', { key: group.key },
            h(Section, { title: t(group.key), note: t(group.note) }),
            h('div', { className: 'ssl-grid' }, group.ids.map(roleId => h(RoleCard, {
              key: roleId,
              roleId,
              role: state.roles[roleId] || {},
              agents: state.agents,
              live: liveByRole[roleId],
              onAssign: assign,
              fallbackName: BUILT_IN.has(roleId) ? '' : fallbackName,
            }))))));
      }

      /** 下旨框下方的两张附签：工作目录（带最近用过的目录）、验收标准 */
      function EdictSlips({ workspace, setWorkspace, criteria, setCriteria, workspaces = [], mode, setMode, brief = '' }) {
        return h(React.Fragment, null,
          setMode ? h(ModePicker, { mode, setMode, brief }) : null,
          h('label', { className: 'ssl-field' },
            h('span', { className: 'ssl-label' }, t('fieldWorkspace')),
            h('input', { className: 'ssl-input', value: workspace, list: 'ssl-ws-list', placeholder: t('workspacePh'), onChange: event => setWorkspace(event.target.value) }),
            h('datalist', { id: 'ssl-ws-list' }, workspaces.map(item => h('option', { key: item, value: item })))),
          setCriteria ? h('label', { className: 'ssl-field' },
            h('span', { className: 'ssl-label' }, t('fieldCriteria')),
            h('input', { className: 'ssl-input', value: criteria, placeholder: t('criteriaPh'), onChange: event => setCriteria(event.target.value) })) : null);
      }

      /** 下旨：各入口共用的提交逻辑 */
      function useEdictSubmit({ notify, onDone, workflow }) {
        const [sending, setSending] = useState(false);
        const [stamp, setStamp] = useState(0);
        const submit = (input, clear) => {
          if (sending) return;
          setSending(true);
          apiJson('/edicts', { method: 'POST', body: JSON.stringify({ ...input, locale: currentLocale, ...(workflow !== undefined ? { workflow } : {}) }) })
            .then(result => {
              notify(t('opened', { id: result.id }), 'ok', result.isolation);
              // 新建的产出文件夹都在同一个根目录下：把这个根目录登记成 DSH 侧栏的工作区，产出在侧栏里就找得到
              if (result.newFolder && courtStore.state && courtStore.state.outputRoot) registerWorkspace(courtStore.state.outputRoot, zhEn('三省六部产出', 'Senate output'));
              setStamp(Date.now());
              if (clear) clear();
              if (onDone) onDone(result);
            })
            .catch(error => notify(String(error.message || error), 'err'))
            .finally(() => setSending(false));
        };
        return { sending, stamp, submit };
      }

      // ---------- 上手检查：每个岗位的人在不在、能不能自动跑 ----------
      function ReadinessCard({ state, notify, compact }) {
        const [probes, setProbes] = useState(null);
        const [pending, setPending] = useState(false);
        const run = () => {
          setPending(true);
          apiJson('/probe-all', { method: 'POST', body: '{}' })
            .then(setProbes)
            .catch(error => notify(String(error.message || error), 'err'))
            .finally(() => setPending(false));
        };
        const autonomous = state.rules && state.rules.autonomous === true;
        const items = ALL_ROLES.filter(id => !BUILT_IN.has(id)).map(roleId => {
          const role = state.roles[roleId] || {};
          const agent = state.agents.find(item => item.id === role.agentId);
          let tone = 'ok';
          let text = '';
          if (!agent) { tone = 'err'; text = t('readyVacant'); }
          else if (agent.enabled === false) { tone = 'err'; text = t('readyDisabled', { name: agent.name }); }
          else if (agent.adapter !== 'cli') { tone = 'warn'; text = autonomous ? t('readyDeputy', { name: agent.name }) : t('readyManual', { name: agent.name }); }
          else if (!probes) { tone = 'mut'; text = t('readyUnchecked', { name: agent.name }); }
          else if (probes[agent.id] && probes[agent.id].ok) text = t('readyOk', { name: agent.name });
          else { tone = 'err'; text = t('readyMissing', { cmd: agent.command }); }
          return { roleId, tone, text };
        });
        const problems = items.filter(item => item.tone === 'err').length;
        return h('div', { className: 'ssl-card' },
          h('div', { className: 'ssl-card-h', style: { marginBottom: 0 } },
            h('div', { className: 'ssl-grow' },
              h('h4', { className: 'ssl-card-t' }, t('readyTitle')),
              h('div', { className: 'ssl-caption' }, probes ? (problems ? t('readyProblems', { n: problems }) : t('readyAllGood')) : t('readyHint'))),
            h('button', { className: 'ssl-btn ssl-btn--sm', disabled: pending, onClick: run }, pending ? t('probing') : t('probeAll'))),
          compact ? null : h('div', { className: 'ssl-steps-guide' },
            [1, 2, 3].map(n => h('div', { key: n }, h('b', null, t(`guide${n}T`)), t(`guide${n}`)))),
          h('div', { className: 'ssl-ready' }, items.map(item => h('div', { key: item.roleId, className: cx('ssl-ready-item', item.tone) },
            h('span', { className: 'ssl-dot' }),
            h('b', null, roleName(item.roleId)),
            h('span', { className: 'ssl-caption ssl-ellipsis', title: item.text }, item.text)))));
      }

      // ---------- 术语表：官名与公文的白话 ----------
      function Glossary() {
        return h('div', { className: 'ssl-card' },
          h('details', { className: 'ssl-details' },
            h('summary', null, t('glossaryTitle'), h('span', { className: 'ssl-caption', style: { fontWeight: 400 } }, t('glossaryNote'))),
            h('div', { className: 'ssl-gloss' }, ALL_ROLES.map(id => h('div', { key: id, className: 'ssl-gloss-item' },
              h('span', { className: 'ssl-pill ssl-pill--plain' }, `${ROLE_TEXT.zh[id].title} ⇄ ${ROLE_TEXT.en[id].title}`),
              h('span', null, roleDuty(id, '')))),
            ),
            h('div', { className: 'ssl-gloss', style: { marginTop: '14px' } }, Object.keys(KINDS).map(kind => h('div', { key: kind, className: 'ssl-gloss-item' },
              h(KindPill, { item: { kind } }),
              h('span', null, kindGloss(kind)))))));
      }

      // ---------- 下旨框里的工具条：照 DSH 输入框——左边附件、权限、工作目录，右边朝制 ----------
      const PERMISSION_INFO = {
        read: [['仅可查看', '各部只读不写：适合查问题、出报告'], ['Read only', 'Magistrates read but never write: good for investigating and reporting']],
        workspace: [['工作区内修改', '各部可在工作目录（隔离分支）里改文件'], ['Edit in workspace', 'Magistrates may edit files inside the working folder (on the isolated branch)']],
        full: [['完全权限', '放开各工具自己的确认，可跑命令、联网、改工作目录外的文件'], ['Full access', 'Lifts each tool’s own confirmations: commands, network and files outside the folder']],
      };
      const permissionInfo = key => {
        const row = (PERMISSION_INFO[key] || PERMISSION_INFO.workspace)[isEn() ? 1 : 0];
        return { name: row[0], desc: row[1] };
      };
      const MODE_KEYS = ['', 'express', 'standard', 'grand'];
      const defaultPermission = state => (state && state.rules && state.rules.execWrites === false ? 'read' : 'workspace');
      const emptyDecree = () => ({ workspace: '', permission: '', attachments: [], criteria: '', mode: '' });
      const fmtSize = bytes => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

      /** 工作目录候选：DSH 侧栏的工作区 + 朝堂最近用过的（宿主读 DSH 自己的 workspace.json） */
      function useWorkspaces() {
        const [list, setList] = useState([]);
        const reload = () => apiJson('/workspaces').then(result => setList(result.workspaces || [])).catch(() => setList([]));
        useEffect(() => { reload(); }, []);
        return [list, reload];
      }

      /** 把选中的文件读成 data URL（随下旨一起交给宿主存进奏折目录） */
      function readFiles(files) {
        return Promise.all([...files].map(file => new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve({ name: file.name, size: file.size, data: String(reader.result || '') });
          reader.onerror = () => reject(reader.error || new Error(file.name));
          reader.readAsDataURL(file);
        })));
      }

      /** 朝制估算：会走哪种朝制、大约几次调用、多少钱 */
      function useEstimate(brief, mode) {
        const [estimate, setEstimate] = useState(null);
        useEffect(() => {
          if (!String(brief || '').trim()) { setEstimate(null); return undefined; }
          const timer = setTimeout(() => {
            apiJson('/estimate', { method: 'POST', body: JSON.stringify({ brief, mode: mode || undefined, locale: currentLocale }) })
              .then(setEstimate)
              .catch(() => setEstimate(null));
          }, 450);
          return () => clearTimeout(timer);
        }, [brief, mode]);
        return estimate;
      }

      function DecreeBar({ state, value, onChange, brief, notify, withMode = true }) {
        const set = patch => onChange({ ...value, ...patch });
        const [workspaces, reload] = useWorkspaces();
        const fileRef = useRef(null);
        const [showCriteria, setShowCriteria] = useState(!!value.criteria);
        const permission = value.permission || defaultPermission(state);
        const estimate = useEstimate(withMode ? brief : '', value.mode);
        const tell = (text, tone) => (notify ? notify(text, tone) : null);

        const addFiles = files => {
          if (!files || !files.length) return;
          readFiles(files)
            .then(list => {
              const next = [...value.attachments, ...list].slice(0, 12);
              const total = next.reduce((sum, item) => sum + item.size, 0);
              if (next.some(item => item.size > 10 * 1048576) || total > 20 * 1048576) {
                tell(zhEn('附件太大：单个不超过 10 MB，合计不超过 20 MB', 'Attachments too large: at most 10 MB each and 20 MB in total'), 'err');
                return;
              }
              set({ attachments: next });
            })
            .catch(error => tell(String(error.message || error), 'err'));
        };
        const pickFolder = () => apiJson('/pick-folder', { method: 'POST', body: JSON.stringify({ start: value.workspace }) })
          .then(result => {
            // 选中的文件夹同时登记成 DSH 工作区：侧栏里也找得到，下次 DSH 自己的会话也能直接用
            if (result.path) { set({ workspace: result.path }); registerWorkspace(result.path); setTimeout(reload, 600); } else if (result.unsupported) tell(zhEn('这台机器弹不出选文件夹的对话框，请直接选列表里的目录', 'No folder dialog is available here; pick a folder from the list'), 'err');
          })
          .catch(error => tell(String(error.message || error), 'err'));
        const known = workspaces.some(item => item.path === value.workspace);
        const folderName = value.workspace ? (workspaces.find(item => item.path === value.workspace) || {}).title || value.workspace.split(/[\\/]/).filter(Boolean).pop() : zhEn('新建产出文件夹', 'New output folder');

        return h('div', { className: 'ssl-decree' },
          h('div', { className: 'ssl-decree-bar' },
            h('button', {
              type: 'button', className: 'ssl-tool ssl-tool--icon', title: zhEn('添加附件（随旨交给各部）', 'Attach files (handed to the magistrates)'),
              'aria-label': zhEn('添加附件', 'Attach files'), onClick: () => fileRef.current && fileRef.current.click(),
            }, '+'),
            h('input', { ref: fileRef, type: 'file', multiple: true, hidden: true, onChange: event => { addFiles(event.target.files); event.target.value = ''; } }),
            h('label', { className: 'ssl-tool', title: permissionInfo(permission).desc },
              h('span', { className: 'ssl-tool-ic', 'aria-hidden': true }, '◈'),
              h('span', { className: 'ssl-tool-text' }, permissionInfo(permission).name),
              h('select', { value: permission, 'aria-label': zhEn('权限', 'Permission'), onChange: event => set({ permission: event.target.value }) },
                Object.keys(PERMISSION_INFO).map(key => h('option', { key, value: key }, permissionInfo(key).name)))),
            h('label', { className: 'ssl-tool ssl-tool--folder', title: value.workspace || zhEn('不选 = 在「文档/SanshengLiubu」下给这道旨新建一个文件夹；选 git 仓库会自动隔离到分支', 'None = a new folder for this decree under Documents/SanshengLiubu; git repos are isolated on a branch') },
              h('span', { className: 'ssl-tool-ic', 'aria-hidden': true }, '▤'),
              h('span', { className: 'ssl-tool-text' }, folderName),
              h('select', {
                value: value.workspace, 'aria-label': t('fieldWorkspace'),
                onChange: event => (event.target.value === '::pick::' ? pickFolder() : set({ workspace: event.target.value })),
              },
              h('option', { value: '' }, zhEn('新建产出文件夹（文档/SanshengLiubu）', 'New output folder (Documents/SanshengLiubu)')),
              value.workspace && !known ? h('option', { value: value.workspace }, value.workspace) : null,
              workspaces.length ? h('optgroup', { label: zhEn('DSH 工作区与最近用过的', 'DSH workspaces and recent folders') },
                workspaces.map(item => h('option', { key: item.path, value: item.path }, `${item.title} — ${item.path}`))) : null,
              h('option', { value: '::pick::' }, zhEn('选择其他文件夹…', 'Choose another folder…')))),
            h('button', {
              type: 'button', className: cx('ssl-tool', (showCriteria || value.criteria) && 'is-on'), title: zhEn('写明怎样算办成（可选）', 'Say what “done” means (optional)'),
              onClick: () => setShowCriteria(!showCriteria),
            }, h('span', { className: 'ssl-tool-ic', 'aria-hidden': true }, '✓'), h('span', { className: 'ssl-tool-text' }, t('fieldCriteria').replace(/（.*|\(.*/, ''))),
            h('span', { className: 'ssl-grow' }),
            // 傀儡皇帝选不了朝制：由权臣按「自动」定
            withMode && !powerOfState(state).mode ? h('span', {
              className: 'ssl-tool is-locked', title: zhEn('朝局「加九锡」：朝制由权臣按「自动」定，任用别家工具才能亲选', 'Under Dictator Perpetuo the strongman picks the procedure; appoint another tool to choose it yourself'),
            }, h('span', { className: 'ssl-tool-text' }, `${t('fieldMode')} · ${t('mode_auto')}`))
            : withMode ? h('label', { className: 'ssl-tool', title: t(`modeDesc_${value.mode || 'auto'}`) },
              h('span', { className: 'ssl-tool-text' }, `${t('fieldMode')} · ${t(`mode_${value.mode || 'auto'}`)}`),
              h('select', { value: value.mode, 'aria-label': t('fieldMode'), onChange: event => set({ mode: event.target.value }) },
                MODE_KEYS.map(key => h('option', { key: key || 'auto', value: key }, t(`mode_${key || 'auto'}`))))) : null),
          value.attachments.length ? h('div', { className: 'ssl-decree-files' }, value.attachments.map((file, index) => h('span', { key: `${file.name}-${index}`, className: 'ssl-file-chip', title: file.name },
            h('span', { className: 'ssl-ellipsis' }, file.name),
            h('i', null, fmtSize(file.size)),
            h('button', { type: 'button', 'aria-label': zhEn(`移除 ${file.name}`, `Remove ${file.name}`), onClick: () => set({ attachments: value.attachments.filter((_, i) => i !== index) }) }, '×')))) : null,
          showCriteria || value.criteria ? h('input', {
            className: 'ssl-input ssl-decree-criteria', value: value.criteria, placeholder: t('criteriaPh'), 'aria-label': t('fieldCriteria'),
            onChange: event => set({ criteria: event.target.value }),
          }) : null,
          withMode && estimate ? h('div', { className: 'ssl-estimate ssl-decree-estimate' },
            t('estimateLine', {
              mode: t(`mode_${estimate.mode}`),
              calls: estimate.calls[0] === estimate.calls[1] ? estimate.calls[0] : `${estimate.calls[0]}–${estimate.calls[1]}`,
              ministry: estimate.ministry ? ` → ${roleName(estimate.ministry)}` : '',
            }),
            h(Money, { usd: estimate.usd[0], compact: true }), '–', h(Money, { usd: estimate.usd[1], compact: true }),
            h('i', { title: estimate.reason }, estimate.basis === 'history' ? t('basisHistory') : t('basisDefault'))) : null);
      }

      /** 下旨时一并交给宿主的字段 */
      const decreePayload = value => ({
        workspace: value.workspace || undefined,
        permission: value.permission || undefined,
        criteria: value.criteria || undefined,
        mode: value.mode || undefined,
        attachments: value.attachments.length ? value.attachments.map(file => ({ name: file.name, data: file.data })) : undefined,
      });

      // ---------- 朝堂：照 Claude Code 桌面版的三栏——左边奏折目录，中间圣旨与回奏，右边流程 ----------
      const FILTERS = [
        ['all', 'filterAll', () => true],
        ['active', 'filterActive', item => isLive(item.status) || item.status === 'queued'],
        ['approval', 'filterApproval', item => item.status === 'awaiting-approval'],
        ['done', 'filterDone', item => item.status === 'done'],
        ['closed', 'filterClosed', item => item.status === 'failed' || item.status === 'rejected' || item.status === 'cancelled'],
      ];

      function CourtTab({ state, onRefresh, notify, onGo, selected, onSelect }) {
        const [brief, setBrief] = useState('');
        const [decree, setDecree] = useState(emptyDecree);
        const [filter, setFilter] = useState('all');
        const [sideOpen, setSideOpen] = useState(false);
        const [doc, setDoc] = useState(null);
        const [detail, pull] = useEdictDetail(selected);
        const threadRef = useRef(null);
        const stick = useRef(true);
        // 三栏里已经摆着谁在办，右下角的值房胶囊就收起来
        usePaneMounted();
        const full = state.full === true;
        const autonomous = state.rules && state.rules.autonomous === true;
        const { sending, stamp, submit } = useEdictSubmit({
          notify,
          onDone: result => { onRefresh(); stick.current = true; if (result && result.id) onSelect(result.id); },
        });
        const send = () => {
          if (!brief.trim() || full) return;
          // 附件、验收标准只跟这一道旨；工作目录、权限、朝制留着给下一道
          submit({ brief, ...decreePayload(decree) }, () => { clearAfterStamp(setBrief, brief); setDecree(prev => ({ ...prev, attachments: [], criteria: '' })); });
        };
        useEffect(() => { setDoc(null); setSideOpen(false); stick.current = true; }, [selected]);

        const view = detail && detail.id === selected ? detail : null;
        const summary = selected ? state.edicts.find(item => item.id === selected) || null : null;
        const progressKey = view ? `${view.status}|${(view.messages || []).length}|${(view.live || []).map(item => item.tail.length).join(',')}` : '';
        // 回奏一到就滚到底；用户往上翻看时不打扰
        useEffect(() => {
          const el = threadRef.current;
          if (el && stick.current && selected) el.scrollTop = el.scrollHeight;
        }, [progressKey, selected]);

        const openDoc = name => apiJson(`/artifact?id=${encodeURIComponent(selected)}&name=${encodeURIComponent(name)}`)
          .then(data => setDoc({ name, text: data.text || '' }))
          .catch(error => notify(String(error.message || error), 'err'));

        const runningCount = state.busy ? state.busy.length : 0;
        // 只做不花钱的检查（有没有人、是否停用）；真正探测 CLI 在「群臣」页
        const broken = ALL_ROLES.filter(id => !BUILT_IN.has(id)).filter(roleId => {
          const agent = state.agents.find(item => item.id === (state.roles[roleId] || {}).agentId);
          return !agent || agent.enabled === false;
        }).length;
        const note = broken ? t('courtNoteBroken', { n: broken }) : state.edicts.length ? '' : t('courtNoteFirst');
        const composerProps = {
          value: brief,
          onChange: setBrief,
          onSubmit: send,
          canSubmit: !full && !sending && !!brief.trim(),
          sending,
          stamp,
          extra: h(DecreeBar, { state, value: decree, onChange: setDecree, brief, notify }),
        };

        // 左栏：新旨 + 筛选 + 奏折目录
        const filterFn = (FILTERS.find(item => item[0] === filter) || FILTERS[0])[2];
        const list = state.edicts.filter(filterFn);
        const left = h('aside', { className: 'ssl-bench-list' },
          h('button', { className: cx('ssl-bench-new', !selected && 'is-active'), onClick: () => onSelect('') },
            h('span', { 'aria-hidden': true }, '＋'), zhEn('新旨', 'New decree')),
          state.edicts.length ? h('div', { className: 'ssl-filter' }, FILTERS.map(([id, key, fn]) => {
            const n = state.edicts.filter(fn).length;
            return h('button', { key: id, className: cx('ssl-chip', filter === id && 'is-active'), onClick: () => setFilter(id) }, id === 'all' ? t(key) : `${t(key)} ${n}`);
          })) : null,
          list.length ? h('div', { className: 'ssl-list' }, list.map(item => h('button', {
            key: item.id, className: cx('ssl-item', selected === item.id && 'is-active'), onClick: () => onSelect(item.id), title: item.brief,
          },
          h('div', { className: 'ssl-item-t ssl-ellipsis' }, item.brief),
          h('div', { className: 'ssl-item-m' }, h(StatusPill, { status: item.status }), dateTimeText(item.createdAt)))))
            : h('div', { className: 'ssl-empty' }, state.edicts.length ? t('filterEmpty') : t('noEdictsShort')));

        // 中栏：没选奏折时是一张大圣旨；选了就是这道旨的来回，圣旨框挪到底下
        const head = h('div', { className: 'ssl-bench-head' },
          state.edicts.length ? h('select', {
            className: 'ssl-input ssl-bench-pick', value: selected || '', 'aria-label': t('pickEdictAria'),
            onChange: event => onSelect(event.target.value),
          },
          h('option', { value: '' }, zhEn('＋ 新旨', '+ New decree')),
          state.edicts.slice(0, 40).map(item => h('option', { key: item.id, value: item.id }, `${statusLabel(item.status)} | ${item.brief.slice(0, 30)}`))) : null,
          h('div', { className: 'ssl-grow ssl-bench-title ssl-ellipsis' }, summary ? summary.brief : t('issueTitle')),
          summary ? h(StatusPill, { status: summary.status })
            : runningCount ? h(StatusPill, { status: 'running', text: t('inSessionN', { n: runningCount, cap: state.capacity || 2 }) })
            : h('span', { className: 'ssl-caption' }, t('issueHint')),
          h('button', {
            className: cx('ssl-btn ssl-bench-flowbtn', sideOpen && 'is-on'), 'aria-expanded': sideOpen,
            onClick: () => setSideOpen(value => !value),
          }, h('span', { 'aria-hidden': true }, sideOpen ? '›' : '‹'), sideOpen ? zhEn('收起流程', 'Hide flow') : zhEn('流程', 'Flow')));

        const thread = !selected
          ? h('div', { className: 'ssl-bench-blank' },
              note ? h('div', { className: 'ssl-court-note' },
                h('span', { className: 'ssl-grow' }, note),
                h('button', { className: 'ssl-btn ssl-btn--sm', onClick: () => onGo('agents') }, t('goSetup'))) : null,
              h(UpgradeCard, { state, notify, onRefresh, onGo }),
              h(Composer, {
                ...composerProps,
                placeholder: t('briefPh'),
                caption: full ? t('fullCaption', { n: state.capacity || 2 }) : autonomous ? t('autoCaption') : t('normalCaption'),
              }),
              h(DecreeStarters, { onPick: text => setBrief(text) }))
          : view ? h(Thread, { detail: view, state, notify, onChanged: () => { onRefresh(); pull(); }, onOpenDoc: openDoc, onGo })
          : h('div', { className: 'ssl-empty' }, t('loading'));

        const center = h('section', { className: 'ssl-bench-main' },
          head,
          h('div', {
            className: 'ssl-bench-thread', ref: threadRef,
            onScroll: event => {
              const el = event.currentTarget;
              stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
            },
          }, thread),
          selected ? h('div', { className: 'ssl-bench-compose' }, h(Composer, {
            ...composerProps,
            compact: true,
            disabled: full,
            placeholder: full ? t('fullShort') : zhEn('再下一道旨……（Enter 下旨，Shift + Enter 换行）', 'Another decree… (Enter to issue, Shift + Enter for a new line)'),
          })) : null,
          doc ? h('div', { className: 'ssl-chat-doc' },
            h('div', { className: 'ssl-card-h', style: { padding: '10px 12px', margin: 0, borderBottom: '1px solid var(--ssl-line)' } },
              h('h4', { className: 'ssl-card-t ssl-mono ssl-ellipsis' }, doc.name),
              h('button', { className: 'ssl-btn ssl-btn--ghost ssl-btn--sm', onClick: () => setDoc(null) }, t('close'))),
            h('div', { style: { flex: 1, minHeight: 0, overflow: 'auto', padding: '12px 16px' } },
              /\.md$/i.test(doc.name) ? h(Md, { text: doc.text || t('emptyDoc') }) : h('pre', { className: 'ssl-doc', style: { maxHeight: 'none', margin: 0 } }, doc.text || t('emptyDoc')))) : null);

        // 右栏：流程、差事、全景、往来、文书；窄了就收成抽屉，由「流程」按钮拉出来
        const right = h('aside', { className: cx('ssl-bench-side', sideOpen && 'is-open') },
          view ? h(BenchSide, { detail: view, state, notify, onChanged: () => { onRefresh(); pull(); }, onOpenDoc: openDoc, onGo })
            : h(IdleSide, { state, onGo }));

        return h('div', { className: 'ssl-bench' }, left, center, right);
      }

      // 新旨的起手式：常见的几类活，点一下填进圣旨框，改改就能下。写清目标、范围、验收标准，门下就少驳几轮
      const STARTERS = [
        ['修 bug', 'Fix a bug', '修复：<哪里出错、怎么复现>。修好后跑相关测试，确认不再出现，并说明改了哪些文件。', 'Fix: <what breaks and how to reproduce it>. Run the related tests afterwards to confirm, and list the files you changed.'],
        ['审查改动', 'Review changes', '审查最近的改动：找出 bug、安全隐患和没覆盖的测试，按严重程度列出，每条写明文件和行号。', 'Review the latest changes: list bugs, security risks and missing tests by severity, each with file and line.'],
        ['写周报', 'Weekly report', '根据本周的 git 提交写一份周报：完成了什么、遇到的风险、下周计划，一页以内。', 'Write a one-page weekly report from this week’s commits: what was done, risks, next week’s plan.'],
        ['整理数据', 'Tidy data', '把 <文件或目录> 里的数据整理成一张表格（CSV），去重、补齐缺失项，并写三条关键结论。', 'Turn the data in <file or folder> into one clean CSV table (dedupe, fill gaps) and write three key findings.'],
        ['写文档', 'Write docs', '给 <模块> 写一份使用说明：安装、最小示例、常见问题，放在 docs/ 下。', 'Write a guide for <module>: install, a minimal example and FAQ, under docs/.'],
        ['写首诗', 'Write a poem', '写一首关于 <主题> 的七言绝句，附一句白话解释。', 'Write a short poem about <theme>, with one line explaining it.'],
      ];
      function DecreeStarters({ onPick }) {
        return h('div', { className: 'ssl-starters' },
          h('span', null, zhEn('起手式', 'Start from')),
          STARTERS.map(row => h('button', { key: row[0], className: 'ssl-chip', title: zhEn(row[2], row[3]), onClick: () => onPick(zhEn(row[2], row[3])) }, zhEn(row[0], row[1]))));
      }

      /** 回奏里常见的 Markdown：标题、列表、代码块、粗体、行内代码；其余照原样显示（不用 innerHTML） */
      const mdInline = text => String(text).split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/).map((part, index) => (
        part.length > 4 && part.startsWith('**') && part.endsWith('**') ? h('b', { key: index }, part.slice(2, -2))
          : part.length > 2 && part.startsWith('`') && part.endsWith('`') ? h('code', { key: index }, part.slice(1, -1))
          : part));
      function Md({ text }) {
        const blocks = [];
        const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
        let para = [];
        let list = null;
        const flushPara = () => {
          if (para.length) blocks.push(h('p', { key: blocks.length }, mdInline(para.join('\n'))));
          para = [];
        };
        const flushList = () => {
          if (list) blocks.push(h(list.ordered ? 'ol' : 'ul', { key: blocks.length }, list.items.map((item, index) => h('li', { key: index }, mdInline(item)))));
          list = null;
        };
        for (let i = 0; i < lines.length; i += 1) {
          const line = lines[i];
          if (/^\s*```/.test(line)) {
            flushPara();
            flushList();
            const body = [];
            for (i += 1; i < lines.length && !/^\s*```/.test(lines[i]); i += 1) body.push(lines[i]);
            blocks.push(h('pre', { key: blocks.length, className: 'ssl-md-code' }, body.join('\n')));
            continue;
          }
          const heading = line.match(/^(#{1,4})\s+(.*)$/);
          if (heading) {
            flushPara();
            flushList();
            blocks.push(h('div', { key: blocks.length, className: 'ssl-md-h' }, mdInline(heading[2])));
            continue;
          }
          const item = line.match(/^\s*(?:[-*+]|(\d+)[.)])\s+(.*)$/);
          if (item) {
            flushPara();
            const ordered = item[1] !== undefined;
            if (list && list.ordered !== ordered) flushList();
            if (!list) list = { ordered, items: [] };
            list.items.push(item[2]);
            continue;
          }
          if (!line.trim()) {
            flushPara();
            flushList();
            continue;
          }
          flushList();
          para.push(line);
        }
        flushPara();
        flushList();
        return h('div', { className: 'ssl-md' }, blocks);
      }

      /** 一条公文往来的气泡（朝堂中栏、朝会页、右侧面板共用） */
      function DispatchBubble({ item, onOpen }) {
        const mine = partyId(item.from) === 'emperor';
        const summary = prettySummary(item.summary) || item.title || t('noSummary');
        return h('div', { className: cx('ssl-msg', mine && 'is-mine') },
          h(Avatar, { party: item.from }),
          h('div', { className: 'ssl-msg-main' },
            h('div', { className: 'ssl-msg-meta' },
              h('b', null, roleName(item.from)),
              h('span', null, `→ ${roleName(item.to)}`),
              h(KindPill, { item }),
              h('span', null, timeText(item.at))),
            h('div', { className: cx('ssl-bubble', item.ok === false && 'is-err') },
              summary,
              item.model || item.durationMs || item.artifact ? h('div', { className: 'ssl-bubble-foot' },
                item.model ? h('span', { className: 'ssl-mono' }, item.model) : null,
                item.durationMs ? h('span', null, t('tookN', { t: fmtElapsed(item.durationMs) })) : null,
                item.artifact && onOpen ? h('button', { className: 'ssl-link', onClick: () => onOpen(item.artifact) }, t('viewDoc')) : null) : null)));
      }

      /** 正在办的岗位：打字中的气泡，带输出尾巴 */
      function LiveBubble({ item }) {
        return h('div', { className: 'ssl-msg' },
          h(Avatar, { party: item.roleId }),
          h('div', { className: 'ssl-msg-main' },
            h('div', { className: 'ssl-msg-meta' },
              h('b', null, roleName(item.roleId)),
              h('span', null, `${kindLabel(item.kind)}${item.title ? ` · ${item.title}` : ''} · ${t('workingFor', { t: fmtElapsed(item.elapsedMs) })}`),
              item.agent ? h('span', { className: 'ssl-mono' }, `${item.agent}${item.model ? ` · ${item.model}` : ''}`) : null),
            h('div', { className: 'ssl-bubble is-live' },
              h(Activity, { item, state: courtStore.state }),
              h('span', { className: 'ssl-typing', 'aria-label': t('typing') }, h('i'), h('i'), h('i')))));
      }

      /** 朝堂中栏：圣旨 → 中书方案 → 各部回奏（全文）→ 此刻在办 → 待回填 → 回奏与批红 */
      function Thread({ detail, state, notify, onChanged, onOpenDoc, onGo }) {
        const power = powerOfState(state);
        const [rejecting, setRejecting] = useState(false);
        const [rejectNote, setRejectNote] = useState('');
        useEffect(() => { setRejecting(false); setRejectNote(''); }, [detail.id]);
        const act = (action, body, okText) => apiJson(`/edicts/${detail.id}/${action}`, { method: 'POST', body: JSON.stringify(body || {}) })
          .then(() => { notify(okText); onChanged(); })
          .catch(error => notify(String(error.message || error), 'err'));

        const results = detail.results || [];
        const resultOf = seq => (results.find(item => item.seq === seq) || {}).summary || '';
        const plan = detail.plan || null;
        const live = detail.live || [];
        const waiting = detail.steps.filter(step => step.status === 'awaiting-input');
        const answered = detail.steps.filter(step => step.status !== 'pending' && step.status !== 'awaiting-input' && resultOf(step.seq));
        const canApprove = detail.status === 'awaiting-approval';
        const canReject = canApprove || isLive(detail.status);
        const canCancel = isLive(detail.status) || detail.status === 'queued';
        const merges = detail.git && detail.git.finalized && !detail.git.empty && !detail.git.merged && !detail.git.discarded;
        const hasMemorial = detail.artifacts.includes('06-memorial.md');
        const onBranch = merges;
        const recheck = detail.recheck || null;
        const doReject = () => { act('reject', { note: rejectNote }, t('rejectedToast')); setRejecting(false); setRejectNote(''); };

        return h('div', { className: 'ssl-thread' },
          // 圣旨
          h('div', { className: 'ssl-msg is-mine' },
            h(Avatar, { party: 'emperor' }),
            h('div', { className: 'ssl-msg-main' },
              h('div', { className: 'ssl-msg-meta' }, h('b', null, roleName('emperor')), h('span', null, dateTimeText(detail.createdAt))),
              h('div', { className: 'ssl-bubble' }, detail.brief),
              h('div', { className: 'ssl-meta ssl-thread-pills' },
                h(ModePill, { detail }),
                detail.autonomous ? h('span', { className: 'ssl-pill ssl-pill--ok' }, t('autoPill')) : null,
                detail.permission ? h('span', { className: 'ssl-pill ssl-pill--plain', title: permissionInfo(detail.permission).desc }, permissionInfo(detail.permission).name) : null,
                (detail.attachments || []).length ? h('span', { className: 'ssl-pill ssl-pill--plain', title: detail.attachments.map(file => file.name).join(', ') }, zhEn(`附件 ${detail.attachments.length}`, `${detail.attachments.length} attached`)) : null,
                detail.workspace ? h('span', { className: 'ssl-mono ssl-ellipsis', title: detail.workspace, style: { maxWidth: '260px' } }, detail.workspace) : null))),
          // 中书方案（急递没有；朝局看不见流程时也不给看）
          power.see >= 2 && plan && detail.mode !== 'express' && (plan.summary || (plan.steps || []).length) ? h('div', { className: 'ssl-msg' },
            h(Avatar, { party: 'zhongshu' }),
            h('div', { className: 'ssl-msg-main' },
              h('div', { className: 'ssl-msg-meta' }, h('b', null, roleName('zhongshu')), h('span', null, zhEn('拟定方案', 'drafted the plan')),
                detail.rounds > 1 ? h('span', null, t('draftRounds', { n: detail.rounds })) : null),
              h('div', { className: 'ssl-bubble' },
                plan.summary ? h('div', null, plan.summary) : null,
                detail.steps.length ? h('ol', { className: 'ssl-thread-plan' }, detail.steps.map(step => h('li', { key: step.seq },
                  h('b', null, roleName(step.ministry)), ` · ${step.title}`))) : null))) : null,
          // 各部回奏：全文，不再截断
          answered.map(step => h('div', { key: step.seq, className: 'ssl-msg ssl-msg--result' },
            h(Avatar, { party: step.ministry }),
            h('div', { className: 'ssl-msg-main' },
              h('div', { className: 'ssl-msg-meta' },
                h('b', null, roleName(step.ministry)),
                h('span', null, `#${step.seq} ${step.title}`),
                h(StatusPill, { status: step.status, text: step.status === 'done' ? t('stepDone') : undefined }),
                step.agent ? h('span', { className: 'ssl-mono' }, step.agent) : null),
              h('div', { className: cx('ssl-bubble', step.status === 'failed' && 'is-err') },
                h(Md, { text: resultOf(step.seq) }),
                step.deliverable || step.workOrder || (step.impeachments || []).length ? h('div', { className: 'ssl-bubble-foot' },
                  step.deliverable ? h('span', { className: 'ssl-mono' }, `→ ${step.deliverable}`) : null,
                  (step.impeachments || []).length ? h('span', { style: { color: 'var(--ssl-err)' } }, `${roleName('yushi')}: ${step.impeachments.join('; ')}`) : null,
                  step.workOrder ? h('button', { className: 'ssl-link', onClick: () => onOpenDoc(step.workOrder) }, t('viewWorkOrder')) : null) : null)))),
          power.see >= 3 ? live.map(item => h(LiveBubble, { key: `live-${item.callId || item.roleId}`, item })) : null,
          waiting.map(step => h('div', { key: `fill-${step.seq}`, className: 'ssl-thread-block' }, h(FillCard, { edictId: detail.id, step, notify, onDone: onChanged, onOpen: onOpenDoc }))),
          (isLive(detail.status) || detail.status === 'queued') && power.see >= 2 ? h(Narrator, { detail }) : null,
          (isLive(detail.status) || detail.status === 'queued') && power.see < 3 ? h('div', { className: 'ssl-thread-block' },
            power.see < 2 ? h('div', { className: 'ssl-narrator is-live' }, h('span', { className: 'ssl-dot ssl-dot--pulse' }),
              h('span', null, zhEn(`权臣正在办理，已 ${fmtElapsed(Date.now() - detail.createdAt)}`, `The strongman is at work: ${fmtElapsed(Date.now() - detail.createdAt)} so far`))) : null,
            h(Veil, { state, need: power.see < 2 ? 2 : 3, what: power.see < 2 ? zhEn('办到哪一步', 'Which stage it is at') : zhEn('各部此刻在办什么', 'What each office is doing'), onGo })) : null,
          detail.error ? h('div', { className: 'ssl-alert' }, detail.error) : null,
          // 回奏与批红
          hasMemorial || canApprove || canCancel || detail.status === 'done' ? h('div', { className: cx('ssl-card ssl-verdict', canApprove && 'is-awaiting') },
            h('div', { className: 'ssl-card-h' },
              h('div', { className: 'ssl-grow' },
                h('h4', { className: 'ssl-card-t' }, canApprove ? zhEn('尚书省上奏，候陛下批红', 'The Proconsul reports; awaiting your seal')
                  : canCancel ? zhEn('正在办理', 'In progress') : zhEn('回奏', 'Report')),
                detail.note ? h('div', { className: 'ssl-caption' }, detail.note) : null),
              detail.spend && detail.spend.calls ? h(Money, { usd: detail.spend.costUsd, estimated: detail.spend.estimated, compact: true }) : null,
              h(StatusPill, { status: detail.status })),
            recheck && recheck.verdict ? h('div', { className: 'ssl-caption' },
              h('b', null, roleName('menxia'), zhEn('复核：', ' audit: ')),
              recheck.verdict === 'approve' ? zhEn('通过', 'passed') : zhEn('未通过', 'failed'),
              (recheck.issues || []).length ? ` · ${recheck.issues.join('; ')}` : '') : null,
            h('div', { className: 'ssl-actions', style: { marginTop: '12px' } },
              canApprove ? h('button', { className: 'ssl-btn ssl-btn--seal', onClick: () => act('approve', null, merges ? t('approvedMergedToast') : t('approvedToast')) }, merges ? t('approveMerge') : t('approve')) : null,
              canReject && !rejecting && power.reject ? h('button', { className: 'ssl-btn ssl-btn--danger', onClick: () => setRejecting(true) }, t('reject')) : null,
              canCancel ? h('button', { className: 'ssl-btn', title: power.reject ? '' : zhEn('叫停是安全阀，任何朝局都能用', 'Halting is the safety valve and works under any regime'), onClick: () => act('cancel', null, t('haltedToast')) }, t('halt')) : null,
              hasMemorial ? h('button', { className: 'ssl-btn ssl-btn--ghost', onClick: () => onOpenDoc('06-memorial.md') }, zhEn('看奏折全文', 'Read the full report')) : null,
              onBranch ? null : h(OpenFolderButton, { edictId: detail.id, notify })),
            canReject && !power.reject ? h('div', { className: 'ssl-caption ssl-no-power' },
              zhEn(`朝局「${regimeInfo(state.regime.level).name}」：权臣当道，傀儡皇帝只能盖章，驳回不了。`, `Under “${regimeInfo(state.regime.level).name}” Caesar is a figurehead: he can stamp, not reject. `),
              h('button', { className: 'ssl-link', onClick: () => onGo('roster') }, zhEn('任用别家工具夺回驳回之权 →', 'Appoint another tool to win it back →'))) : null,
            rejecting ? h('div', { className: 'ssl-actions', style: { marginTop: '10px' } },
              h('input', {
                className: 'ssl-input ssl-grow', autoFocus: true, value: rejectNote, placeholder: t('rejectPh'), style: { minWidth: '200px' },
                onChange: event => setRejectNote(event.target.value),
                onKeyDown: event => {
                  if (event.key === 'Enter') doReject();
                  if (event.key === 'Escape') setRejecting(false);
                },
              }),
              h('button', { className: 'ssl-btn ssl-btn--danger', onClick: doReject }, t('rejectConfirm')),
              h('button', { className: 'ssl-btn ssl-btn--ghost', onClick: () => setRejecting(false) }, t('cancel'))) : null,
            rejecting ? h('div', { className: 'ssl-caption', style: { marginTop: '6px' } }, t('rejectMemoryNote')) : null) : null);
      }

      /** 朝堂右栏（选了奏折）：流程、差事、隔离分支与改动、全景缩略、往来摘要、文书 */
      function BenchSide({ detail, state, notify, onChanged, onOpenDoc, onGo }) {
        const power = powerOfState(state);
        const act = (action, body, okText) => apiJson(`/edicts/${detail.id}/${action}`, { method: 'POST', body: JSON.stringify(body || {}) })
          .then(() => { notify(okText); onChanged(); })
          .catch(error => notify(String(error.message || error), 'err'));
        const messages = detail.messages || [];
        const recent = messages.slice(-8).reverse();
        const more = h('button', { className: 'ssl-link', onClick: () => onGo('memorial') }, zhEn('朝会页看全部 →', 'Open in Forum →'));
        return h('div', { className: 'ssl-stack' },
          h(PowerCard, { state, onGo }),
          power.see >= 2 ? h('div', { className: 'ssl-card' },
            h('div', { className: 'ssl-card-h' }, h('h4', { className: 'ssl-card-t' }, zhEn('流程', 'Flow')), h(ModePill, { detail })),
            h(FlowList, { edict: detail })) : null,
          power.see >= 2 ? h('div', { className: 'ssl-card' },
            h('div', { className: 'ssl-card-h' },
              h('h4', { className: 'ssl-card-t' }, t('stepsTitle')),
              h('span', { className: 'ssl-caption' }, detail.steps.length ? t('stepsDone', { done: detail.steps.filter(step => step.status === 'done').length, n: detail.steps.length }) : '')),
            detail.steps.length ? h(StepList, { steps: detail.steps, edictStatus: detail.status }) : h('div', { className: 'ssl-empty' }, t('notDispatched'))) : null,
          h(GitCard, { detail, act, onOpen: onOpenDoc, noDiscard: !power.reject }),
          h(FilesCard, { detail, notify }),
          power.see < 4 ? h(Veil, { state, need: 4, what: zhEn('公文往来与朝会全景', 'Dispatches and the panorama'), onGo, compact: true }) : null,
          power.see >= 4 && (detail.calls || []).length ? h('div', { className: 'ssl-card' },
            h('div', { className: 'ssl-card-h' }, h('h4', { className: 'ssl-card-t' }, t('panoTitle')), more),
            h(Panorama, { detail, compact: true, onOpen: onOpenDoc })) : null,
          power.see >= 4 ? h('div', { className: 'ssl-card' },
            h('div', { className: 'ssl-card-h' },
              h('h4', { className: 'ssl-card-t' }, t('messagesTitle')),
              h('span', { className: 'ssl-caption' }, t('itemsN', { n: messages.length }))),
            recent.length ? h('div', { className: 'ssl-mini-list' }, recent.map(item => h('button', {
              key: item.seq, className: cx('ssl-mini', item.ok === false && 'is-err'), title: prettySummary(item.summary).slice(0, 400),
              onClick: () => (item.artifact ? onOpenDoc(item.artifact) : onGo('memorial')),
            },
            h('div', { className: 'ssl-mini-h' },
              h('span', { className: 'ssl-mini-route ssl-ellipsis' }, `${roleName(item.from)} → ${roleName(item.to)}`),
              h(KindPill, { item }),
              h('span', { className: 'ssl-caption' }, timeText(item.at))),
            h('div', { className: 'ssl-caption ssl-ellipsis' }, item.title || prettySummary(item.summary).slice(0, 80) || '—')))) : h('div', { className: 'ssl-empty' }, t('waitingReports')),
            messages.length > recent.length ? h('div', { style: { marginTop: '8px' } }, more) : null) : null,
          power.see >= 2 && detail.artifacts.length ? h('div', { className: 'ssl-card' },
            h('div', { className: 'ssl-card-h' }, h('h4', { className: 'ssl-card-t' }, t('artifactsTitle')), h('span', { className: 'ssl-caption' }, t('docsN', { n: detail.artifacts.length }))),
            h('div', { className: 'ssl-files' }, detail.artifacts.map(name => h('button', { key: name, className: 'ssl-file', onClick: () => onOpenDoc(name) }, name)))) : null);
      }

      /** 朝堂右栏（还没选奏折）：流程说明 + 值房里谁在忙 */
      function IdleSide({ state, onGo }) {
        const live = state.live || [];
        return h('div', { className: 'ssl-stack' },
          h(PowerCard, { state, onGo }),
          h('div', { className: 'ssl-card' },
            h('div', { className: 'ssl-card-h' }, h('h4', { className: 'ssl-card-t' }, zhEn('流程', 'Flow'))),
            h(FlowList, { edict: null }),
            h('div', { className: 'ssl-caption', style: { marginTop: '10px' } }, zhEn('短而单一的旨意走急递：直接派给一个部，跳过拟旨、封驳和复核。', 'Short, single-task decrees go express: straight to one magistrate, skipping draft, veto and audit.'))),
          h('div', { className: 'ssl-card' },
            h('div', { className: 'ssl-card-h' },
              h('h4', { className: 'ssl-card-t' }, t('workroomTitle')),
              live.length ? h(StatusPill, { status: 'running', text: t('rolesN', { n: live.length }) }) : h(StatusPill, { status: 'idle', text: t('noWork') })),
            !live.length ? h('div', { className: 'ssl-caption' }, t('quietCourtNote'))
              : powerOfState(state).see < 3 ? h(Veil, { state, need: 3, what: zhEn('谁在办什么', 'Who is doing what'), onGo, compact: true })
              : live.map(item => h('div', { key: item.callId || `${item.edictId}:${item.roleId}`, className: 'ssl-between', style: { padding: '4px 0' } },
                h('span', { className: 'ssl-ellipsis' }, `${roleName(item.roleId)} · ${kindLabel(item.kind)}`),
                h('span', { className: 'ssl-caption' }, fmtElapsed(item.elapsedMs))))));
      }

      // ---------- 官职：谁担任哪个岗位、朝规、术语 ----------
      function RosterTab({ state, onRefresh, notify }) {
        return h('div', null,
          h('div', { style: { marginTop: '4px' } }, h(RegimeCard, { state, onRefresh, notify })),
          h(CourtRoster, { state, onRefresh, notify }),
          h('div', { style: { marginTop: '12px' } }, h(Glossary)));
      }

      // ---------- 值房：各岗位此刻在干什么 ----------
      function WorkroomTab({ state, onOpenEdict, onGo }) {
        const see = powerOfState(state).see;
        const live = state.live || [];
        const liveByRole = useMemo(() => liveByRoleOf(live), [live]);
        // 办理中与待批红的都摆在这里（原先挂在朝堂下旨框下面）
        const running = state.edicts.filter(item => isLive(item.status) || item.status === 'awaiting-approval');
        const recent = state.recent || [];

        return h('div', null,
          running.length ? running.map(item => h('div', { key: item.id, className: 'ssl-card' },
            h('div', { className: 'ssl-card-h', style: { marginBottom: '16px' } },
              h('div', { className: 'ssl-grow' },
                h('h4', { className: 'ssl-card-t ssl-ellipsis' }, item.brief),
                h('div', { className: 'ssl-caption ssl-ellipsis' }, see >= 2 ? `${item.note || ''} · ${item.id}` : item.id)),
              h(StatusPill, { status: item.status }),
              h('button', { className: 'ssl-btn ssl-btn--sm', onClick: () => onOpenEdict(item.id) }, t('openEdict'))),
            see >= 2 ? h(Flow, { edict: item }) : null))
            : h('div', { className: 'ssl-card' },
              h('div', { className: 'ssl-card-h', style: { marginBottom: 0 } },
                h('div', { className: 'ssl-grow' },
                  h('h4', { className: 'ssl-card-t' }, t('quietCourt')),
                  h('div', { className: 'ssl-caption' }, t('quietCourtNote'))),
                h(StatusPill, { status: 'idle', text: t('noWork') }))),
          h(Section, { title: t('workroomTitle'), note: live.length ? t('workroomBusy', { n: live.length }) : t('workroomIdle') }),
          see < 3 ? h('div', { className: 'ssl-card', style: { marginBottom: '12px' } }, h(Veil, { state, need: 3, what: zhEn('各部此刻在办什么', 'What each office is doing now'), onGo })) : null,
          h('div', { className: 'ssl-grid' }, ALL_ROLES.map(roleId => {
            const role = state.roles[roleId] || {};
            const item = liveByRole[roleId];
            const count = live.filter(entry => entry.roleId === roleId).length;
            const agent = state.agents.find(entry => entry.id === role.agentId) || {};
            const glyph = roleGlyph(roleId);
            return h('div', { key: roleId, className: cx('ssl-card ssl-role', item && 'is-live') },
              h('div', { className: 'ssl-role-head' },
                h('span', { className: cx('ssl-glyph', latinClass(glyph)) }, glyph),
                h('div', { className: 'ssl-grow' },
                  h('div', { className: 'ssl-role-title' }, roleName(roleId)),
                  h('div', { className: 'ssl-caption ssl-ellipsis' }, `${agent.name || t('vacant')}${role.model ? ` · ${role.model}` : ''}`)),
                item ? h(StatusPill, { status: 'running', text: count > 1 ? `×${count} · ${fmtElapsed(item.elapsedMs)}` : fmtElapsed(item.elapsedMs) }) : h(StatusPill, { status: 'idle' })),
              item ? h('div', { style: { marginTop: '12px' } },
                h('div', { className: 'ssl-between' },
                  h(KindPill, { item }),
                  h('span', { className: 'ssl-caption ssl-ellipsis' }, item.title || t('working'))),
                see >= 3 ? h(Activity, { item, state }) : null)
                : h('div', { className: 'ssl-caption', style: { marginTop: '12px' } }, t('noWork')));
          })),
          recent.length ? h(React.Fragment, null,
            h(Section, { title: t('recentDone'), note: t('recentDoneNote') }),
            h('div', { className: 'ssl-card' }, h('div', { className: 'ssl-steps' }, recent.map((item, index) => h('div', { key: `${item.edictId}-${index}`, className: 'ssl-step' },
              h('span', { className: cx('ssl-step-no', latinClass(roleGlyph(item.roleId))), style: { width: 'auto', minWidth: '22px', padding: '0 4px' } }, roleGlyph(item.roleId)),
              h('div', { className: 'ssl-grow' },
                h('div', { className: 'ssl-ellipsis', style: { fontWeight: 500 } }, `${roleName(item.roleId)} · ${item.title || kindLabel(item.kind)}`),
                h('div', { className: 'ssl-caption ssl-ellipsis' }, `${item.agent} · ${fmtElapsed(item.durationMs)} · ${timeText(item.endedAt)}`)),
              h(StatusPill, { status: item.ok ? 'done' : 'failed' })))))) : null);
      }

      // ---------- 值房浮层：常驻在 DSH 界面右下角（shell.overlay） ----------
      function Hud() {
        useLocale();
        const { state } = useCourtState();
        const [open, setOpen] = useState(false);
        const paneOpen = usePaneOpen();
        const live = (state && state.live) || [];
        if (!live.length || paneOpen) return null;
        return h('div', { className: 'ssl-overlay ssl-hud' },
          open ? h('div', { className: 'ssl-hud-panel' },
            h('div', { className: 'ssl-between', style: { marginBottom: '10px' } },
              h('b', { style: { fontSize: '13px' } }, t('workroomTitle')),
              h('button', { className: 'ssl-btn ssl-btn--ghost ssl-btn--sm', onClick: () => setOpen(false) }, t('collapse'))),
            live.map(item => h('div', { key: item.callId || `${item.edictId}:${item.roleId}`, className: 'ssl-hud-item' },
              h('div', { className: 'ssl-between' },
                h('b', { style: { fontSize: '12.5px' } }, `${roleName(item.roleId)} · ${kindLabel(item.kind)}`),
                h('span', { className: 'ssl-caption' }, fmtElapsed(item.elapsedMs))),
              h('div', { className: 'ssl-caption ssl-ellipsis' }, `${item.agent}${item.model ? ` · ${item.model}` : ''}${item.title ? ` · ${item.title}` : ''}`),
              powerOfState(state).see >= 3 ? h(Activity, { item, state, compact: true }) : null))) : null,
          h('button', { className: 'ssl-hud-pill', title: t('hudTitle'), onClick: () => setOpen(value => !value) },
            h('span', { className: 'ssl-dot ssl-dot--pulse' }),
            t('hudPill', { n: live.length }),
            h('span', { className: 'ssl-muted' }, [...new Set(live.map(item => roleName(item.roleId)))].slice(0, 2).join(isEn() ? ', ' : '、'))));
      }

      // ---------- 殿宇：语言、主题、背景 ----------
      function Swatch({ bg, side, panel, text, accent, line }) {
        return h('div', { className: 'ssl-swatch', style: { background: bg, borderColor: line } },
          h('div', { className: 'ssl-swatch-side', style: { background: side } },
            h('div', { className: 'ssl-swatch-line', style: { background: accent, width: '70%' } }),
            h('div', { className: 'ssl-swatch-line', style: { background: text, opacity: 0.25, width: '85%' } }),
            h('div', { className: 'ssl-swatch-line', style: { background: text, opacity: 0.25, width: '60%' } })),
          h('div', { className: 'ssl-swatch-main' },
            h('div', { className: 'ssl-swatch-line', style: { background: text, opacity: 0.85, width: '55%', height: '6px' } }),
            h('div', { style: { flex: 1, borderRadius: '5px', background: panel, border: `1px solid ${line}`, padding: '5px 6px', display: 'flex', flexDirection: 'column', gap: '4px' } },
              h('div', { className: 'ssl-swatch-line', style: { background: text, opacity: 0.3, width: '90%', height: '4px' } }),
              h('div', { className: 'ssl-swatch-line', style: { background: accent, width: '32%', height: '7px', marginTop: 'auto' } }))));
      }

      // 主题与皮肤的名字、说明：[中, 英]
      const THEME_TEXT = {
        default: [['DSH 默认主题', '回到你原本的明暗设置'], ['DSH default', 'Back to your own light / dark setting']],
        gong: [['宫廷 · 朱', '宣纸底 + 朱红主色 + 墨字，浅色专用'], ['Palace · Vermilion', 'Rice paper, vermilion and ink. Light']],
        mo: [['墨夜 · 金', '墨底 + 鎏金，深色专用'], ['Ink Night · Gold', 'Ink black and gilt. Dark']],
        zijin: [['紫禁城 · 朝堂', '宫殿背景 + 半透明面板，可换成自己的图'], ['Forbidden City', 'Palace backdrop behind translucent panels; bring your own image']],
        marble: [['大理石 · 紫', '大理石白 + 帝王紫，浅色专用'], ['Marble · Tyrian Purple', 'Marble white and imperial purple. Light']],
        nox: [['帝国之夜 · 金', '斑岩深紫 + 金，深色专用'], ['Nox Imperii · Gold', 'Porphyry night and gold. Dark']],
        roma: [['罗马广场', '神庙柱廊背景 + 半透明面板，可换成自己的图'], ['Forum Romanum', 'Temple and colonnade backdrop behind translucent panels; bring your own image']],
      };
      const SKIN_TEXT = {
        default: [['默认', '完全不动 DSH 的颜色'], ['Default', 'Leave DSH colours untouched']],
        cinnabar: [['朱批', '朱红主色 + 纸色底，暗色偏暖'], ['Cinnabar', 'Vermilion accent on a paper tone']],
        ink: [['黛青', '青黛主色，冷调背景，适合长时间盯代码'], ['Indigo', 'Indigo accent, cool background for long coding sessions']],
      };
      const textOf = (table, key) => table[key][isEn() ? 1 : 0];

      function LanguageCard({ ui, onChoose }) {
        const current = currentLocale;
        const option = (value, title, desc, seal) => h('button', {
          key: value, className: cx('ssl-card ssl-pick', current === value && 'is-active'), onClick: () => onChoose(value),
        },
        h('div', { className: 'ssl-row', style: { alignItems: 'center' } },
          h('span', { className: cx('ssl-seal ssl-seal--sm', value === 'en' && 'is-latin'), style: value === 'en' ? { fontSize: '9px' } : null }, seal),
          h('div', { className: 'ssl-grow' },
            h('div', { className: 'ssl-between' },
              h('span', { className: 'ssl-role-title' }, title),
              current === value ? h('span', { className: 'ssl-pill ssl-pill--seal' }, t('inUse')) : null),
            h('div', { className: 'ssl-caption', style: { marginTop: '2px' } }, desc))));
        return h('div', { className: 'ssl-grid' },
          option('zh', '中文 · 三省六部', '中书拟旨、门下封驳、尚书派单、六部办差；奏折竖排、朱印下旨。', '三'),
          option('en', 'English · Roman Senate', 'The Consul drafts, the Tribune vetoes, the Proconsul dispatches to six magistrates. Papyrus scroll and SPQR seal.', 'SPQR'));
      }

      function HallTab({ state, onRefresh, notify }) {
        const ui = state.ui || {};
        const currentTheme = ui.theme || 'default';
        const currentSkin = ui.skin || 'default';
        const save = (next, okText) => {
          apiJson('/ui', { method: 'PUT', body: JSON.stringify(next) })
            .then(() => { onRefresh(); notify(okText || t('applied')); })
            .catch(error => notify(String(error.message || error), 'err'));
        };
        const chooseLocale = value => {
          localeStore.set(value);
          save({ locale: value }, t('langApplied'));
        };
        // 整套主题与浅改皮肤互斥：两者都改同一批令牌，叠在一起谁赢不确定
        const chooseTheme = key => {
          applyTheme(key);
          applySkin('default');
          save({ theme: key, skin: 'default' });
        };
        const chooseSkin = key => {
          applySkin(key);
          applyTheme('default');
          save({ skin: key, theme: 'default' });
        };

        const pick = (key, selected, onClick, preview, title, desc) => h('button', {
          key, className: cx('ssl-card ssl-pick', selected && 'is-active'), onClick,
        },
        preview,
        h('div', { className: 'ssl-between' },
          h('span', { className: 'ssl-role-title' }, title),
          selected ? h('span', { className: 'ssl-pill ssl-pill--seal' }, t('inUse')) : null),
        h('div', { className: 'ssl-caption', style: { marginTop: '2px' } }, desc));

        // 英文界面把罗马主题排前面，中文界面把宫廷主题排前面
        const order = isEn() ? ['roma', 'marble', 'nox', 'zijin', 'gong', 'mo'] : ['zijin', 'gong', 'mo', 'roma', 'marble', 'nox'];
        const themeCards = [
          pick('default', currentTheme === 'default', () => chooseTheme('default'),
            h(Swatch, { bg: '#f4f4f5', side: '#ebebed', panel: '#ffffff', text: '#18181b', accent: '#3f3f46', line: '#e4e4e7' }),
            ...textOf(THEME_TEXT, 'default')),
          ...order.filter(key => THEMES[key]).map(key => {
            const tk = THEMES[key].tokens;
            const preview = THEMES[key].backdrop
              ? h('div', {
                  className: 'ssl-swatch',
                  style: { background: `linear-gradient(rgba(12,7,5,.2),rgba(12,7,5,.35)), url("${backdropUrl(ui.background, ui.backgroundVersion, key)}") center/cover` },
                })
              : h(Swatch, {
                  bg: tk['--dsw-alias-bg-base'], side: tk['--dsw-specific-sidebar-fill'], panel: tk['--dsw-alias-bg-layer-1'],
                  text: tk['--dsw-alias-label-primary'], accent: tk['--dsw-alias-brand-primary'], line: tk['--dsw-alias-border-l2'],
                });
            return pick(key, currentTheme === key, () => chooseTheme(key), preview, ...textOf(THEME_TEXT, key));
          }),
        ];

        const fileRef = useRef(null);
        const [uploading, setUploading] = useState(false);
        const backdropTheme = THEMES[currentTheme] && THEMES[currentTheme].backdrop ? currentTheme : (isEn() ? 'roma' : 'zijin');
        const upload = file => {
          if (!file) return;
          if (file.size > 10 * 1024 * 1024) { notify(t('imageTooBig'), 'err'); return; }
          const reader = new FileReader();
          reader.onload = () => {
            setUploading(true);
            apiJson('/background', { method: 'PUT', body: JSON.stringify({ dataUrl: reader.result }) })
              .then(next => {
                setBackdropOptions(next);
                onRefresh();
                notify(THEMES[currentTheme] && THEMES[currentTheme].backdrop ? t('bgChanged') : t('bgUploaded'));
              })
              .catch(error => notify(String(error.message || error), 'err'))
              .finally(() => setUploading(false));
          };
          reader.onerror = () => notify(t('imageReadFailed'), 'err');
          reader.readAsDataURL(file);
        };
        const resetBackground = () => apiJson('/background', { method: 'DELETE' })
          .then(next => { setBackdropOptions(next); onRefresh(); notify(t('bgReset')); })
          .catch(error => notify(String(error.message || error), 'err'));
        const setDim = value => {
          setBackdropOptions({ ...ui, backgroundDim: value });
          save({ backgroundDim: value });
        };
        const dim = Number(ui.backgroundDim) || 0.45;

        const backgroundCard = h('div', { className: 'ssl-card' },
          h('div', { className: 'ssl-row', style: { flexWrap: 'wrap', alignItems: 'center' } },
            h('div', {
              className: 'ssl-swatch',
              style: {
                width: '200px', height: '112px', margin: 0, flex: '0 0 auto',
                background: `linear-gradient(rgba(12,7,5,${dim}),rgba(12,7,5,${Math.min(0.9, dim + 0.12)})), url("${backdropUrl(ui.background, ui.backgroundVersion, backdropTheme)}") center/cover`,
              },
            }),
            h('div', { className: 'ssl-grow', style: { minWidth: '220px' } },
              h('div', { className: 'ssl-role-title' }, ui.background === 'custom' ? t('bgCustom') : t('bgBuiltin')),
              h('div', { className: 'ssl-caption', style: { margin: '2px 0 10px' } }, t('bgNote')),
              h('div', { className: 'ssl-actions' },
                h('input', {
                  ref: fileRef, type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', style: { display: 'none' },
                  onChange: event => { upload(event.target.files && event.target.files[0]); event.target.value = ''; },
                }),
                h('button', { className: 'ssl-btn ssl-btn--sm', disabled: uploading, onClick: () => fileRef.current && fileRef.current.click() }, uploading ? t('uploading') : t('upload')),
                ui.background === 'custom' ? h('button', { className: 'ssl-btn ssl-btn--ghost ssl-btn--sm', onClick: resetBackground }, t('bgRestore')) : null,
                h('span', { className: 'ssl-caption', style: { marginLeft: '6px' } }, t('dimLabel')),
                [[t('dimLight'), 0.25], [t('dimMid'), 0.45], [t('dimDark'), 0.65]].map(([label, value]) => h('button', {
                  key: value,
                  className: cx('ssl-chip', Math.abs(dim - value) < 0.05 && 'is-active'),
                  onClick: () => setDim(value),
                }, label))))));

        const skinCards = Object.keys(SKINS).map(key => {
          const tk = SKINS[key].tokens;
          const preview = tk
            ? h('div', { style: { display: 'flex', gap: '6px', marginBottom: '12px' } },
                h('div', { style: { flex: 1 } }, h(Swatch, { bg: tk['--dsw-alias-bg-base'].light, side: tk['--dsw-specific-sidebar-fill'].light, panel: tk['--dsw-alias-bg-layer-1'].light, text: '#1f1f1f', accent: tk['--dsw-alias-brand-primary'].light, line: tk['--dsw-alias-border-l2'].light })),
                h('div', { style: { flex: 1 } }, h(Swatch, { bg: tk['--dsw-alias-bg-base'].dark, side: tk['--dsw-specific-sidebar-fill'].dark, panel: tk['--dsw-alias-bg-layer-1'].dark, text: '#ededed', accent: tk['--dsw-alias-brand-primary'].dark, line: tk['--dsw-alias-border-l2'].dark })))
            : h('div', { style: { display: 'flex', gap: '6px', marginBottom: '12px' } },
                h('div', { style: { flex: 1 } }, h(Swatch, { bg: '#f4f4f5', side: '#ebebed', panel: '#ffffff', text: '#18181b', accent: '#3f3f46', line: '#e4e4e7' })),
                h('div', { style: { flex: 1 } }, h(Swatch, { bg: '#18181b', side: '#141416', panel: '#202023', text: '#ededed', accent: '#d4d4d8', line: '#2e2e33' })));
          return pick(key, currentSkin === key && currentTheme === 'default', () => chooseSkin(key),
            h('div', { className: 'ssl-skin-preview' }, preview), ...textOf(SKIN_TEXT, key));
        });

        return h('div', null,
          h(Section, { title: t('langTitle'), note: t('langNote') }),
          h(LanguageCard, { ui, onChoose: chooseLocale }),
          h(Section, { title: t('themesTitle'), note: t('themesNote') }),
          h('div', { className: 'ssl-grid' }, themeCards),
          h(Section, { title: t('bgTitle'), note: t('bgSectionNote') }),
          backgroundCard,
          h(Section, { title: t('skinsTitle'), note: t('skinsNote') }),
          h('div', { className: 'ssl-grid' }, skinCards),
          h(Section, { title: t('builtInTitle') }),
          h('div', { className: 'ssl-card' },
            [1, 2, 3, 4].map(n => h('div', { key: n, className: 'ssl-feature' },
              h('div', null, h('b', null, t(`feature${n}T`)), h('span', null, t(`feature${n}`)))))));
      }

      // ---------- 会话头部「下旨」：不切页也能开朝 ----------
      const composer = {
        open: false,
        listeners: new Set(),
        set(open) {
          composer.open = open;
          for (const listener of composer.listeners) listener(open);
        },
        subscribe(listener) {
          composer.listeners.add(listener);
          return () => composer.listeners.delete(listener);
        },
      };

      function EdictHeaderButton() {
        useLocale();
        return h('button', {
          className: 'ssl-header-btn',
          title: t('headerBtnTitle'),
          onClick: () => composer.set(true),
        }, h('b', { style: isEn() ? { fontFamily: 'var(--sc-serif, serif)' } : null }, sealText('edict')), t('issue'));
      }

      function EdictComposer() {
        useLocale();
        const [open, setOpen] = useState(composer.open);
        const [brief, setBrief] = useState('');
        const [decree, setDecree] = useState(emptyDecree);
        const [msg, setMsg] = useState({ text: '', tone: '' });
        const { state } = useCourtState(open);
        useEffect(() => composer.subscribe(setOpen), []);
        useEffect(() => {
          if (!open) return undefined;
          const onKey = event => { if (event.key === 'Escape') composer.set(false); };
          window.addEventListener('keydown', onKey);
          return () => window.removeEventListener('keydown', onKey);
        }, [open]);
        const notify = (text, tone, extra) => setMsg({ text: extra ? `${text}\n${extra}` : text, tone });
        const { sending, stamp, submit } = useEdictSubmit({
          notify,
          onDone: () => {
            openPane(PANE_CHAT);
            // 等印盖完再收起
            setTimeout(() => { composer.set(false); setMsg({ text: '', tone: '' }); }, 1600);
          },
        });
        if (!open) return null;
        const send = () => {
          if (!brief.trim()) return;
          setMsg({ text: '', tone: '' });
          submit({ brief, ...decreePayload(decree) }, () => { clearAfterStamp(setBrief, brief); setDecree(prev => ({ ...prev, attachments: [], criteria: '' })); });
        };
        return h('div', {
          className: 'ssl-overlay ssl-mask',
          onClick: event => { if (event.target === event.currentTarget) composer.set(false); },
        },
        h('div', { className: 'ssl-modal', role: 'dialog', 'aria-label': t('issue') },
          h('div', { className: 'ssl-modal-h' },
            h(Seal, { name: 'edict' }),
            h('div', null,
              h('div', { className: 'ssl-role-title', style: { fontSize: '15px' } }, t('modalTitle')),
              h('div', { className: 'ssl-caption' }, t('normalCaption')))),
          h('div', { style: { marginTop: '14px' } }, h(Composer, {
            value: brief,
            onChange: setBrief,
            onSubmit: send,
            canSubmit: !sending && !!brief.trim() && !(state && state.full),
            sending,
            stamp,
            autoFocus: true,
            placeholder: t('briefPh'),
            extra: state ? h(DecreeBar, { state, value: decree, onChange: setDecree, brief, notify }) : null,
          })),
          msg.text ? h('div', { className: cx('ssl-alert', msg.tone === 'ok' && 'ssl-alert--info'), style: { whiteSpace: 'pre-wrap' } }, msg.text) : null,
          h('div', { className: 'ssl-actions', style: { justifyContent: 'flex-end', marginTop: '14px' } },
            h('button', { className: 'ssl-btn ssl-btn--ghost', onClick: () => composer.set(false) }, t('cancel')))));
      }

      // ---------- 往来：公文流 ----------
      function MessageList({ messages, onOpen }) {
        if (!messages.length) return h('div', { className: 'ssl-empty' }, t('noMessages'));
        return h('div', { className: 'ssl-tl' }, messages.map(item => {
          const tone = kindTone(item);
          const summary = prettySummary(item.summary);
          return h('div', { key: item.seq, className: cx('ssl-tl-item', `tone-${tone}`) },
            h('div', { className: 'ssl-tl-head' },
              h(KindPill, { item }),
              h('span', { className: 'ssl-tl-route' }, roleName(item.from), h('i', null, '→'), roleName(item.to)),
              item.title ? h('span', { className: 'ssl-caption ssl-ellipsis' }, item.title) : null),
            summary ? h('div', { className: 'ssl-tl-body', style: { whiteSpace: 'pre-wrap' } }, summary.length > 320 ? `${summary.slice(0, 320)}…` : summary) : null,
            h('div', { className: 'ssl-tl-foot' },
              h('span', null, timeText(item.at)),
              item.model ? h('span', { className: 'ssl-mono' }, item.model) : null,
              item.durationMs ? h('span', null, t('tookN', { t: fmtElapsed(item.durationMs) })) : null,
              item.ok === false ? h('span', { style: { color: 'var(--ssl-err)' } }, t('failedWord')) : null,
              item.artifact ? h('button', { className: 'ssl-link', onClick: () => onOpen(item.artifact) }, t('viewDoc')) : null));
        }));
      }

      // ---------- 奏折：隔离分支卡 ----------
      function GitCard({ detail, act, onOpen, noDiscard }) {
        const g = detail.git;
        if (!g) {
          return detail.isolationNote ? h('div', { className: 'ssl-alert ssl-alert--info', style: { marginTop: 0 } }, detail.isolationNote) : null;
        }
        const live = isLive(detail.status);
        const stat = g.stat;
        const canMerge = detail.status === 'done' && g.finalized && !g.merged && !g.discarded && !g.empty;
        const canDiscard = !noDiscard && !live && g.finalized && !g.merged && !g.discarded && !g.empty;
        const state = g.merged ? h('span', { className: 'ssl-pill ssl-pill--ok' }, t('gitMerged', { base: g.base || 'HEAD' }))
          : g.discarded ? h('span', { className: 'ssl-pill' }, t('gitDiscardedPill'))
          : g.empty ? h('span', { className: 'ssl-pill' }, t('gitEmpty'))
          : live ? h(StatusPill, { status: 'running', text: t('gitWorking') })
          : h('span', { className: 'ssl-pill ssl-pill--warn' }, t('gitUnmerged'));
        return h('div', { className: 'ssl-card' },
          h('div', { className: 'ssl-card-h' },
            h('div', { className: 'ssl-grow' },
              h('h4', { className: 'ssl-card-t' }, t('gitTitle')),
              h('div', { className: 'ssl-caption', style: { marginTop: '4px', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' } },
                h('span', { className: 'ssl-branch' }, g.branch),
                h('span', null, '→'),
                h('span', { className: 'ssl-branch' }, g.base || (g.baseCommit || '').slice(0, 8)),
                stat ? h('span', null, h('span', { style: { color: 'var(--ssl-ok)' } }, `+${stat.insertions}`), ' ', h('span', { style: { color: 'var(--ssl-err)' } }, `-${stat.deletions}`), ` · ${t('filesN', { n: stat.files.length })}`) : null)),
            state),
          g.commitError ? h('div', { className: 'ssl-alert' }, g.commitError) : null,
          g.error ? h('div', { className: 'ssl-alert' }, g.error) : null,
          stat && stat.files.length ? h('div', { className: 'ssl-git-files' }, stat.files.slice(0, 40).map(file => h('div', { key: file.file, className: 'ssl-git-file' },
            h('span', { className: 'ssl-grow ssl-ellipsis', title: file.file }, file.file),
            file.binary ? h('span', { className: 'ssl-caption' }, 'bin') : h('span', null, h('span', { className: 'add' }, `+${file.add}`), ' ', h('span', { className: 'del' }, `-${file.del}`))))) : null,
          live ? h('div', { className: 'ssl-caption', style: { marginTop: '8px' } }, t('gitLiveNote')) : null,
          h('div', { className: 'ssl-actions', style: { marginTop: '12px' } },
            detail.artifacts.includes('07-changes.patch') ? h('button', { className: 'ssl-btn ssl-btn--sm', onClick: () => onOpen('07-changes.patch') }, t('viewPatch')) : null,
            canMerge ? h('button', { className: 'ssl-btn ssl-btn--seal ssl-btn--sm', onClick: () => act('merge', null, t('mergedToast')) }, t('mergeNow')) : null,
            canDiscard ? h(ConfirmButton, { className: 'ssl-btn ssl-btn--danger ssl-btn--sm', label: t('discardBranch'), confirm: t('discardConfirm'), onConfirm: () => act('discard', null, t('discardedToast')) }) : null));
      }

      /** 二次确认的按钮：第一下变成「确认？」，3 秒内再点才生效 */
      function ConfirmButton({ className, label, confirm, onConfirm }) {
        const [armed, setArmed] = useState(false);
        useEffect(() => {
          if (!armed) return undefined;
          const timer = setTimeout(() => setArmed(false), 3000);
          return () => clearTimeout(timer);
        }, [armed]);
        return h('button', { className, onClick: () => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); } }, armed ? confirm : label);
      }

      // ---------- 待回填：人工岗位做完，把结果填回来，朝会接着走 ----------
      function FillCard({ edictId, step, notify, onDone, onOpen, compact }) {
        const [text, setText] = useState('');
        const [busy, setBusy] = useState(false);
        const { state } = useCourtState();
        const deputy = state && state.deputy;
        const send = (skip, delegate = false) => {
          setBusy(true);
          apiJson(`/edicts/${edictId}/fill`, { method: 'POST', body: JSON.stringify({ seq: step.seq, text, skip, delegate }) })
            .then(() => {
              notify(delegate ? zhEn(`已交给 ${deputy.name} 代办`, `Handed to ${deputy.name}`) : skip ? t('skippedToast') : t('filledToast'));
              setText('');
              if (onDone) onDone();
            })
            .catch(error => notify(String(error.message || error), 'err'))
            .finally(() => setBusy(false));
        };
        return h('div', { className: 'ssl-card is-fill' },
          h('div', { className: 'ssl-card-h' },
            h('div', { className: 'ssl-grow' },
              h('h4', { className: 'ssl-card-t' }, t('fillTitle', { role: roleName(step.ministry), title: step.title })),
              h('div', { className: 'ssl-caption' }, t('fillNote'))),
            h(StatusPill, { status: 'awaiting-input' })),
          !compact && step.instruction ? h('div', { className: 'ssl-quote' }, step.instruction) : null,
          h('textarea', {
            className: 'ssl-input', style: { marginTop: '10px', minHeight: compact ? '70px' : '96px' }, value: text,
            placeholder: t('fillPh', { deliverable: step.deliverable || '…' }), onChange: event => setText(event.target.value),
          }),
          h('div', { className: 'ssl-actions', style: { marginTop: '10px' } },
            h('button', { className: 'ssl-btn ssl-btn--primary ssl-btn--sm', disabled: busy || !text.trim(), onClick: () => send(false) }, t('fillSubmit')),
            deputy ? h('button', { className: 'ssl-btn ssl-btn--sm', disabled: busy, title: zhEn('这个岗位没有命令行：让代办照原差事去办', 'This office has no command line: let the deputy do the order'), onClick: () => send(false, true) },
              zhEn(`交给 ${deputy.name} 代办`, `Hand to ${deputy.name}`)) : null,
            h('button', { className: 'ssl-btn ssl-btn--sm', disabled: busy, onClick: () => send(true) }, t('fillSkip')),
            step.workOrder && onOpen ? h('button', { className: 'ssl-link', onClick: () => onOpen(step.workOrder) }, t('viewWorkOrder')) : null));
      }

      // ---------- 朝会：一道旨的全景——泳道图、各部门之间的往来、差事、文书、事件 ----------
      function ForumTab({ state, notify, selected, onSelect, onGo }) {
        const auto = pickEdict(state);
        const edictId = selected || (auto && auto.id) || '';
        const [detail] = useEdictDetail(edictId);
        const [artifact, setArtifact] = useState({ name: '', text: '' });
        const viewerRef = useRef(null);
        useEffect(() => { setArtifact({ name: '', text: '' }); }, [edictId]);

        const openArtifact = name => apiJson(`/artifact?id=${encodeURIComponent(edictId)}&name=${encodeURIComponent(name)}`)
          .then(data => {
            setArtifact({ name, text: data.text || '' });
            setTimeout(() => { if (viewerRef.current) viewerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 30);
          })
          .catch(error => notify(String(error.message || error), 'err'));

        if (!state.edicts.length) return h('div', { className: 'ssl-card ssl-empty' }, t('noEdictsYet'));

        const bar = h('div', { className: 'ssl-forum-bar' },
          h('select', {
            className: 'ssl-input', value: edictId, 'aria-label': t('pickEdictAria'),
            onChange: event => onSelect(event.target.value),
          }, state.edicts.slice(0, 60).map(item => h('option', { key: item.id, value: item.id }, `${statusLabel(item.status)} | ${item.brief.slice(0, 40)}`))),
          detail && detail.id === edictId ? h(StatusPill, { status: detail.status }) : null,
          h('button', { className: 'ssl-btn ssl-btn--sm', onClick: () => { onSelect(edictId); onGo('court'); } }, zhEn('回朝堂看结果', 'Back to the result')));

        if (!detail || detail.id !== edictId) return h('div', null, bar, h(LoadingCard, {}));
        const messages = detail.messages || [];
        const live = detail.live || [];
        // 朝会全景与各部往来要到三巨头才看得见；之前只给看差事与文书
        if (powerOfState(state).see < 4) {
          return h('div', null,
            bar,
            h('div', { className: 'ssl-card' }, h(Veil, { state, need: 4, what: zhEn('朝会全景与各部之间的往来', 'The panorama and the dispatches between offices'), onGo })),
            h('div', { style: { marginTop: '12px' } }, h(FilesCard, { detail, notify })));
        }

        return h('div', null,
          bar,
          (detail.calls || []).length ? h(Panorama, { detail, onOpen: openArtifact })
            : h('div', { className: 'ssl-card' }, h('h4', { className: 'ssl-card-t' }, t('panoTitle')), h('div', { className: 'ssl-empty' }, t('waitingReports'))),
          h('div', { className: 'ssl-detail-cols' },
            h('div', { className: 'ssl-card' },
              h('div', { className: 'ssl-card-h' },
                h('h4', { className: 'ssl-card-t' }, zhEn('各部往来', 'Dispatches between offices')),
                h('span', { className: 'ssl-caption' }, t('itemsN', { n: messages.length }))),
              messages.length || live.length ? h('div', { className: 'ssl-forum-chat' },
                messages.map(item => h(DispatchBubble, { key: item.seq, item, onOpen: openArtifact })),
                live.map(item => h(LiveBubble, { key: `live-${item.callId || item.roleId}`, item })))
                : h('div', { className: 'ssl-empty' }, t('waitingReports'))),
            h('div', { className: 'ssl-stack' },
              h('div', { className: 'ssl-card' },
                h('div', { className: 'ssl-card-h' }, h('h4', { className: 'ssl-card-t' }, t('stepsTitle')), h('span', { className: 'ssl-caption' }, detail.steps.length ? t('stepsDone', { done: detail.steps.filter(step => step.status === 'done').length, n: detail.steps.length }) : '')),
                detail.steps.length ? h(StepList, { steps: detail.steps, edictStatus: detail.status }) : h('div', { className: 'ssl-empty' }, t('notDispatched'))),
              h('div', { className: 'ssl-card' },
                h('div', { className: 'ssl-card-h' }, h('h4', { className: 'ssl-card-t' }, t('artifactsTitle')), h('span', { className: 'ssl-caption' }, t('docsN', { n: detail.artifacts.length }))),
                detail.artifacts.length
                  ? h('div', { className: 'ssl-files' }, detail.artifacts.map(name => h('button', {
                      key: name, className: cx('ssl-file', artifact.name === name && 'is-active'), onClick: () => openArtifact(name),
                    }, name)))
                  : h('div', { className: 'ssl-empty' }, t('none'))),
              h(FilesCard, { detail, notify }))),
          artifact.name ? h('div', { className: 'ssl-card', ref: viewerRef, style: { marginTop: '12px' } },
            h('div', { className: 'ssl-card-h' },
              h('h4', { className: 'ssl-card-t ssl-mono' }, artifact.name),
              h('button', { className: 'ssl-btn ssl-btn--ghost ssl-btn--sm', onClick: () => setArtifact({ name: '', text: '' }) }, t('close'))),
            h('pre', { className: 'ssl-doc' }, artifact.text || t('emptyDoc'))) : null,
          h('div', { className: 'ssl-card', style: { marginTop: '12px' } },
            h('details', { className: 'ssl-details' },
              h('summary', null, t('eventsTitle'), h('span', { className: 'ssl-caption', style: { fontWeight: 400 } }, t('itemsN', { n: detail.events.length }))),
              h('div', { className: 'ssl-events' }, detail.events.slice(-60).flatMap((event, index) => {
                const data = event.data || {};
                const text = data.note || data.error || data.stage || (data.from ? `${roleName(data.from)} → ${roleName(data.to)} ${kindLabel(data.kind)}` : '') || data.title || '';
                return [
                  h('span', { key: `t${index}`, className: 't' }, timeText(event.at)),
                  h('span', { key: `k${index}`, className: 'k' }, eventLabel(event.type)),
                  h('span', { key: `d${index}`, className: 'd', title: text }, text),
                ];
              })))));
      }

      /** 差事清单：序号、部门、依赖（after）、状态 */
      function StepList({ steps, edictStatus }) {
        return h('div', { className: 'ssl-steps' }, steps.map(step => h('div', { key: step.seq, className: 'ssl-step' },
          h('span', { className: 'ssl-step-no' }, step.seq),
          h('div', { className: 'ssl-grow' },
            h('div', { className: 'ssl-ellipsis', style: { fontWeight: 500 } }, step.title),
            h('div', { className: 'ssl-caption ssl-ellipsis' },
              [roleName(step.ministry), step.agent, step.retried ? t('retriedTag') : '',
                step.after && step.after.length ? t('afterTag', { list: step.after.map(n => `#${n}`).join(' ') }) : t('rootTag')]
                .filter(Boolean).join(' · '))),
          step.status === 'done'
            ? h(StatusPill, { status: 'done', text: t('stepDone') })
            : h(StatusPill, { status: step.status === 'pending' && !isLive(edictStatus) ? 'skipped' : step.status }))));
      }

      // ---------- 史馆：跨奏折的记忆与门下统计 ----------
      function AnnalsTab(props) {
        return h(React.Fragment, null, h(WikiPanel, props), h(Section, { title: t('statsTitle'), note: t('statsNote') }), h(AnnalsStats, props));
      }

      function AnnalsStats({ state, onRefresh, notify }) {
        const [data, setData] = useState(null);
        const load = useCallback(() => apiJson('/annals').then(setData).catch(error => notify(String(error.message || error), 'err')), []);
        useEffect(() => { load(); }, [load, state.edicts.length]);
        const remove = id => apiJson(`/annals/${id}`, { method: 'DELETE' }).then(next => { setData(next); notify(t('annalRemoved')); }).catch(error => notify(String(error.message || error), 'err'));
        const clear = () => apiJson('/annals', { method: 'DELETE' }).then(next => { setData(next); notify(t('annalsCleared')); }).catch(error => notify(String(error.message || error), 'err'));
        const memoryOn = state.rules && state.rules.useMemory !== false;
        if (!data) return h(LoadingCard, {});
        const { entries, stats } = data;
        const pct = value => `${Math.round((value || 0) * 100)}%`;
        const ministries = MINISTRY_IDS.filter(id => stats.ministries[id]);
        return h('div', null,
          h('div', { className: 'ssl-kpis' },
            [[stats.total, t('kpiTotal')], [pct(stats.vetoRate), t('kpiVetoRate')], [pct(stats.firstPassRate), t('kpiFirstPass')], [stats.fixRounds, t('kpiFixRounds')]]
              .map(([value, label]) => h('div', { key: label, className: 'ssl-kpi' }, h('b', null, value), h('span', null, label)))),
          stats.rubberStamp ? h('div', { className: 'ssl-alert' }, t('rubberStamp')) : null,
          !memoryOn ? h('div', { className: 'ssl-alert ssl-alert--info' }, t('memoryOff')) : null,
          ministries.length ? h(React.Fragment, null,
            h(Section, { title: t('ministryStats'), note: t('ministryStatsNote') }),
            h('div', { className: 'ssl-card' }, h('div', { className: 'ssl-steps' }, ministries.map(id => {
              const bucket = stats.ministries[id];
              return h('div', { key: id, className: 'ssl-step' },
                h('span', { style: { width: '92px', flex: '0 0 92px', fontWeight: 500 } }, roleName(id)),
                h('div', { className: 'ssl-grow' }, h('div', { className: 'ssl-meter' },
                  h('i', { className: 'ok', style: { width: `${(bucket.done / bucket.total) * 100}%` } }),
                  h('i', { className: 'err', style: { width: `${(bucket.failed / bucket.total) * 100}%` } }))),
                h('span', { className: 'ssl-caption', style: { width: '120px', textAlign: 'right' } }, t('doneOfN', { done: bucket.done, n: bucket.total, failed: bucket.failed })));
            })))) : null,
          h(Section, {
            title: t('lessonsTitle'), note: t('lessonsNote'),
            right: entries.length ? h(ConfirmButton, { className: 'ssl-btn ssl-btn--ghost ssl-btn--sm', label: t('clearAll'), confirm: t('clearConfirm'), onConfirm: clear }) : null,
          }),
          entries.length ? entries.map(entry => h('div', { key: entry.id, className: 'ssl-card ssl-annal' },
            h('div', { className: 'ssl-between' },
              h('div', { className: 'ssl-grow', style: { minWidth: 0 } },
                h('div', { className: 'ssl-item-t ssl-ellipsis' }, entry.brief),
                h('div', { className: 'ssl-item-m' }, h(StatusPill, { status: entry.outcome }), dateTimeText(entry.at),
                  entry.vetoes ? h('span', null, t('vetoesN', { n: entry.vetoes })) : null)),
              h('button', { className: 'ssl-btn ssl-btn--ghost ssl-btn--sm', title: t('forgetTitle'), onClick: () => remove(entry.id) }, t('forget'))),
            entry.lessons.length ? h('ul', { className: 'ssl-lessons' }, entry.lessons.map((lesson, index) => h('li', { key: index }, lesson.text))) : null))
            : h('div', { className: 'ssl-card ssl-empty' }, t('noAnnals')));
      }

      // ---------- 群臣：agent 注册表 ----------
      function AgentsTab({ state, onRefresh, notify }) {
        const [drafts, setDrafts] = useState({});
        const [probe, setProbe] = useState({});
        const [saving, setSaving] = useState(false);
        const [open, setOpen] = useState({});
        const toggle = id => setOpen(prev => ({ ...prev, [id]: !prev[id] }));

        const edit = (id, patch) => setDrafts(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
        const valueOf = (id, key, fallback) => (drafts[id] && drafts[id][key] !== undefined ? drafts[id][key] : fallback);
        const dirty = Object.keys(drafts).length;
        const words = text => String(text).split(/\s+/).filter(Boolean);

        const save = () => {
          const agents = state.agents.map(item => {
            const draft = drafts[item.id] || {};
            const next = { ...item };
            if (draft.command !== undefined) next.command = draft.command;
            if (draft.argsText !== undefined) next.args = words(draft.argsText);
            if (draft.modelArgsText !== undefined) next.modelArgs = words(draft.modelArgsText);
            if (draft.execArgsText !== undefined) next.execArgs = words(draft.execArgsText);
            if (draft.autoArgsText !== undefined) next.autoArgs = words(draft.autoArgsText);
            if (draft.formatArgsText !== undefined) next.formatArgs = words(draft.formatArgsText);
            if (draft.resumeArgsText !== undefined) next.resumeArgs = words(draft.resumeArgsText);
            if (draft.outputFormat !== undefined) next.outputFormat = draft.outputFormat;
            if (draft.modelsText !== undefined) next.models = String(draft.modelsText).split(/[,，]/).map(text => text.trim()).filter(Boolean);
            if (draft.enabled !== undefined) next.enabled = draft.enabled;
            return next;
          });
          setSaving(true);
          apiJson('/preset', { method: 'PUT', body: JSON.stringify({ agents, roles: state.roles, rules: state.rules }) })
            .then(() => { setDrafts({}); notify(t('agentsSaved')); onRefresh(); })
            .catch(error => notify(String(error.message || error), 'err'))
            .finally(() => setSaving(false));
        };

        const doProbe = id => {
          setProbe(prev => ({ ...prev, [id]: { pending: true } }));
          apiJson('/probe', { method: 'POST', body: JSON.stringify({ agentId: id }) })
            .then(result => setProbe(prev => ({ ...prev, [id]: result })))
            .catch(error => setProbe(prev => ({ ...prev, [id]: { ok: false, detail: String(error.message || error) } })));
        };
        const probeAll = () => apiJson('/probe-all', { method: 'POST', body: '{}' })
          .then(setProbe)
          .catch(error => notify(String(error.message || error), 'err'));

        // 每个 agent 当前担任的官职
        const postsOf = id => ALL_ROLES.filter(roleId => (state.roles[roleId] || {}).agentId === id).map(roleName);
        const field = (id, key, label, value, placeholder, wide) => h('label', { className: 'ssl-field', style: wide ? { gridColumn: '1 / -1' } : null },
          h('span', { className: 'ssl-label' }, label),
          h('input', { className: 'ssl-input ssl-mono', value: valueOf(id, key, value), placeholder, onChange: event => edit(id, { [key]: event.target.value }) }));

        return h('div', null,
          h('div', { style: { marginBottom: '12px' } }, h(ReadinessCard, { state, notify, compact: state.edicts.length > 0 })),
          h('div', { className: 'ssl-between', style: { marginBottom: '12px', flexWrap: 'wrap' } },
            h('span', { className: 'ssl-caption' }, t('agentsIntro')),
            h('div', { className: 'ssl-actions' },
              h('span', { className: 'ssl-caption ssl-mono ssl-ellipsis', title: state.root, style: { maxWidth: '360px' } }, state.root),
              h('button', { className: 'ssl-btn ssl-btn--sm', onClick: probeAll }, t('probeAll')))),
          h('div', { className: 'ssl-grid ssl-agents' }, state.agents.map(item => {
            const check = probe[item.id];
            const enabled = valueOf(item.id, 'enabled', item.enabled !== false);
            const posts = postsOf(item.id);
            // 默认收起，只露一行：开关、名字、现任、类型、探测结果；有没保存的改动时保持展开
            const expanded = open[item.id] === true || (open[item.id] === undefined && !!drafts[item.id]);
            const summary = item.adapter === 'cli'
              ? [item.command, (item.models || []).slice(0, 3).join(', ')].filter(Boolean).join(' · ')
              : (ADAPTER_LABEL[item.adapter] || [item.adapter, item.adapter])[isEn() ? 1 : 0];
            return h('div', { key: item.id, className: cx('ssl-card ssl-agent', !enabled && 'is-off', expanded && 'is-open') },
              h('div', { className: 'ssl-role-head' },
                h('label', { className: 'ssl-switch', title: enabled ? t('enabled') : t('disabled') },
                  h('input', { type: 'checkbox', checked: enabled, onChange: event => edit(item.id, { enabled: event.target.checked }) }),
                  h('span', null)),
                h('button', { className: 'ssl-agent-toggle ssl-grow', 'aria-expanded': expanded, onClick: () => toggle(item.id) },
                  h('div', { className: 'ssl-role-title ssl-ellipsis' },
                    check && !check.pending ? h('span', { className: cx('ssl-dot', check.ok ? 'is-ok' : 'is-err'), title: check.detail }) : null,
                    item.name),
                  h('div', { className: 'ssl-caption ssl-ellipsis' }, posts.length ? t('postsNow', { list: posts.join(isEn() ? ', ' : '、') }) : t('noPost')),
                  expanded ? null : h('div', { className: 'ssl-caption ssl-mono ssl-ellipsis' }, summary)),
                item.adapter === 'cli' ? h('button', { className: 'ssl-btn ssl-btn--sm', disabled: check && check.pending, onClick: () => doProbe(item.id) }, check && check.pending ? t('probing') : t('probe')) : null,
                h('button', { className: 'ssl-btn ssl-btn--ghost ssl-btn--sm ssl-chevron', title: expanded ? t('collapse') : t('expand'), 'aria-label': expanded ? t('collapse') : t('expand'), onClick: () => toggle(item.id) }, expanded ? '▴' : '▾')),
              !expanded ? null : (item.traits || []).length ? h('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '10px' } },
                item.traits.map(trait => h('span', { key: trait, className: 'ssl-pill' }, trait))) : null,
              !expanded ? null : item.adapter === 'cli' ? h('div', { className: 'ssl-agent-fields' },
                field(item.id, 'command', t('fieldCommand'), item.command || ''),
                field(item.id, 'argsText', t('fieldArgs'), (item.args || []).join(' ')),
                field(item.id, 'modelArgsText', t('fieldModelArgs'), (item.modelArgs || []).join(' ')),
                field(item.id, 'modelsText', t('fieldModels'), (item.models || []).join(', ')),
                field(item.id, 'execArgsText', t('fieldExecArgs'), (item.execArgs || []).join(' '), t('execArgsPh'), true),
                field(item.id, 'autoArgsText', t('fieldAutoArgs'), (item.autoArgs || []).join(' '), t('autoArgsPh'), true),
                h('label', { className: 'ssl-field' },
                  h('span', { className: 'ssl-label' }, t('fieldOutputFormat')),
                  h('select', { className: 'ssl-input', value: valueOf(item.id, 'outputFormat', item.outputFormat || 'text'), onChange: event => edit(item.id, { outputFormat: event.target.value }) },
                    ['claude-stream', 'codex-json', 'text'].map(value => h('option', { key: value, value }, t(`format_${value.replace('-', '_')}`))))),
                field(item.id, 'formatArgsText', t('fieldFormatArgs'), (item.formatArgs || []).join(' '), '--output-format stream-json --verbose'),
                field(item.id, 'resumeArgsText', t('fieldResumeArgs'), (item.resumeArgs || []).join(' '), t('resumeArgsPh'), true))
                : h('div', { className: 'ssl-alert ssl-alert--info' }, item.adapter === 'self' ? t('adapterSelfNote') : t('adapterManualNote')),
              expanded && check && !check.pending ? h('div', { className: 'ssl-probe' },
                h('span', { className: cx('ssl-pill', check.ok ? 'ssl-pill--ok' : 'ssl-pill--err') }, check.ok ? t('found') : t('notFound')),
                h('span', { className: 'ssl-mono ssl-ellipsis', title: check.detail }, check.detail)) : null);
          })),
          h('div', { className: 'ssl-savebar' },
            h('span', { className: 'ssl-caption' }, dirty ? t('unsavedN', { n: dirty }) : t('allSaved')),
            h('div', { className: 'ssl-actions' },
              dirty ? h('button', { className: 'ssl-btn ssl-btn--ghost', onClick: () => setDrafts({}) }, t('undo')) : null,
              h('button', { className: 'ssl-btn ssl-btn--primary', disabled: !dirty || saving, onClick: save }, saving ? t('saving') : t('saveAgents')))));
      }

      function Toast({ toast }) {
        if (!toast) return null;
        return h('div', { className: cx('ssl-overlay ssl-toast', `ssl-toast--${toast.tone}`), role: 'status', style: { whiteSpace: 'pre-wrap' } },
          h('span', { className: 'ssl-dot' }), toast.text);
      }

      /** 提示条：返回 [要渲染的节点, notify(text, tone, 附加说明)] */
      function useToast() {
        const [toast, setToast] = useState(null);
        const notify = useCallback((text, tone = 'ok', extra = '') => setToast({ text: extra ? `${text}\n${extra}` : text, tone, at: Date.now() }), []);
        useEffect(() => {
          if (!toast) return undefined;
          const timer = setTimeout(() => setToast(null), toast.tone === 'err' ? 5200 : 2600);
          return () => clearTimeout(timer);
        }, [toast]);
        return [h(Toast, { toast }), notify];
      }

      // 朝堂状态的共享轮询：主页面、头部视图、右侧面板、浮层同时开着时只发一路请求
      const courtStore = {
        state: null,
        error: '',
        timer: null,
        listeners: new Set(),
        pull() {
          apiJson('/state')
            .then(data => {
              courtStore.state = data;
              courtStore.error = '';
              if (data && data.ui && data.ui.locale) localeStore.set(data.ui.locale);
              if (data && data.rules && data.rules.treasury) moneySettings = data.rules.treasury;
              courtStore.emit();
            })
            .catch(error => { courtStore.error = String(error.message || error); courtStore.emit(); });
        },
        emit() {
          for (const listener of courtStore.listeners) listener();
        },
        subscribe(listener) {
          courtStore.listeners.add(listener);
          if (!courtStore.timer) {
            courtStore.pull();
            courtStore.timer = setInterval(courtStore.pull, 2000);
          }
          return () => {
            courtStore.listeners.delete(listener);
            if (!courtStore.listeners.size) {
              clearInterval(courtStore.timer);
              courtStore.timer = null;
            }
          };
        },
      };

      // 右侧面板里开着「政令执行 / 各部门沟通」时，右下角的值房胶囊会压在面板上，而且内容重复，就收起来
      const paneMounts = {
        count: 0,
        listeners: new Set(),
        change(delta) {
          paneMounts.count += delta;
          for (const listener of paneMounts.listeners) listener(paneMounts.count);
        },
      };

      function usePaneMounted() {
        useEffect(() => {
          paneMounts.change(1);
          return () => paneMounts.change(-1);
        }, []);
      }

      function usePaneOpen() {
        const [open, setOpen] = useState(paneMounts.count > 0);
        useEffect(() => {
          const listener = count => setOpen(count > 0);
          paneMounts.listeners.add(listener);
          // 同一轮挂载里面板可能先于本组件计数，订阅时补对一次
          listener(paneMounts.count);
          return () => paneMounts.listeners.delete(listener);
        }, []);
        return open;
      }

      /** enabled = false 时不订阅（比如常驻浮层里没打开的弹窗），免得白白轮询 */
      function useCourtState(enabled = true) {
        const [, force] = useState(0);
        useEffect(() => (enabled ? courtStore.subscribe(() => force(n => n + 1)) : undefined), [enabled]);
        return { state: courtStore.state, error: courtStore.error, refresh: courtStore.pull };
      }

      /** 轮询一份奏折的详情（含公文往来与实时输出） */
      function useEdictDetail(edictId) {
        const [detail, setDetail] = useState(null);
        const pull = useCallback(() => {
          if (!edictId) return Promise.resolve();
          return apiJson(`/edicts/${edictId}`).then(setDetail).catch(() => {});
        }, [edictId]);
        useEffect(() => {
          setDetail(null);
          if (!edictId) return undefined;
          pull();
          const timer = setInterval(pull, 2000);
          return () => clearInterval(timer);
        }, [edictId, pull]);
        return [detail, pull];
      }

      function LanguageSwitch() {
        const choose = value => {
          if (value === currentLocale) return;
          localeStore.set(value);
          apiJson('/ui', { method: 'PUT', body: JSON.stringify({ locale: value }) }).then(courtStore.pull).catch(() => {});
        };
        return h('div', { className: 'ssl-lang', role: 'group', 'aria-label': 'Language' },
          h('button', { className: cx(currentLocale === 'zh' && 'is-active'), onClick: () => choose('zh') }, '中'),
          h('button', { className: cx(currentLocale === 'en' && 'is-active'), onClick: () => choose('en') }, 'EN'));
      }

      // ================= 朝局与帝王传记 =================
      const zhEn = (zh, en) => (isEn() ? en : zh);
      const REGIME_KEYS = ['jiuxi', 'quanchen', 'liangdang', 'sanju', 'qiangang'];
      // 五级朝局：[中, 英] 各自的 名字 / 条件 / 典故 / 得 / 失
      const REGIME_INFO = {
        jiuxi: [
          ['加九锡', '只用一家工具，模型也出自同一家', '王莽、曹操、司马昭受九锡，下一步就是篡位', '最快最省，缓存命中最高', '一家拟旨、审议、办差，皇帝看不见过程也插不上手；自己审自己，封驳形同虚设'],
          ['Dictator Perpetuo', 'One tool, models from one house', 'Caesar was made dictator for life in 44 BC; the Ides of March came a month later', 'Fastest and cheapest, best cache reuse', 'One house drafts, reviews and works; you can neither see nor step in, and self-review makes the veto a formality'],
        ],
        quanchen: [
          ['权倾朝野', '只用一家工具，但调了不同家的模型', '霍光、严嵩：朝中大事都经一人之手', '不同家的模型盲区不同，比加九锡多一层把关', '都跑在同一套工具和沙箱里，工具层面的毛病会一起犯；审议只能作参考'],
          ['Sejanus’ Rome', 'One tool calling models from different houses', 'Tiberius withdrew to Capri; every message reached him through his prefect Sejanus', 'Different models have different blind spots', 'Everything runs in one tool and sandbox, so tool-level mistakes are shared; review is advisory'],
        ],
        liangdang: [
          ['两党争霸', '两家工具，如 DSH + Claude Code', '北宋新旧党争；罗马分东西两帝', '一家办、另一家审，是真正的交叉检查', '来回多、花钱多；僵持时皇帝得亲自断案'],
          ['East and West', 'Two tools, e.g. DSH + Claude Code', 'In 395 the empire split between Arcadius in the East and Honorius in the West', 'One house works and the other reviews: a real cross-check', 'More rounds and more spend; deadlocks need your ruling'],
        ],
        sanju: [
          ['三巨头', '三家工具，如 DSH + WorkBuddy + Claude Code', '三国鼎立；凯撒、庞培、克拉苏结前三头同盟', '各领擅长的岗位，拟旨、审议、办差分属几家，互相牵制', '交接多、花钱多；一家倒下，同盟即瓦解'],
          ['Triumvirate', 'Three tools, e.g. DSH + WorkBuddy + Claude Code', 'Caesar, Pompey and Crassus; later Octavian, Antony and Lepidus split the provinces', 'Each house holds what it does best, and they keep each other in check', 'More hand-offs and spend; lose one house and the pact collapses'],
        ],
        qiangang: [
          ['乾纲独断', '四家及以上工具', '推恩令之后的汉武帝：众建诸侯而少其力', '量才授官：每个岗位都交给最合适的那家，没有哪家能一手遮天', '要管的工具多；每份奏折只调用对口的那一两家，不会四家全上'],
          ['Tetrarchy', 'Four tools or more', 'Diocletian shared the empire among four, yet kept the final word', 'Every office goes to the house that suits it, and no house can rule alone', 'More tools to keep in order; a decree still calls only the one or two that fit'],
        ],
      };
      const regimeInfo = key => {
        const row = (REGIME_INFO[key] || REGIME_INFO.jiuxi)[isEn() ? 1 : 0];
        return { name: row[0], when: row[1], story: row[2], gain: row[3], cost: row[4] };
      };
      // ---------- 朝局定皇权：看得见多少、能决定多少、能办成多少（宿主按现任官员算好，放在 state.regime.power） ----------
      const FULL_POWER = { see: 5, reject: true, mode: true, concurrent: 4, parallel: 4, bound: false };
      const powerOfState = state => (state && state.regime && state.regime.power) || FULL_POWER;
      // 第 n 级多看见什么；第 n 级对应第 n 个朝局
      const SEE_TEXT = [
        null,
        ['结果', 'Results'],
        ['流程与差事', 'Flow and orders'],
        ['各部此刻在办什么', 'What each office is doing now'],
        ['公文往来与朝会全景', 'Dispatches and the panorama'],
        ['原始过程（命令与输出）', 'Raw process (commands and output)'],
      ];
      const seeName = n => SEE_TEXT[n][isEn() ? 1 : 0];
      const seeList = n => [1, 2, 3, 4, 5].filter(i => i <= n).map(seeName).join(isEn() ? ', ' : '、');
      const decideList = power => [zhEn('批红', 'Seal'), zhEn('叫停', 'Halt'), power.mode ? zhEn('选朝制', 'Pick procedure') : '', power.reject ? zhEn('驳回 / 丢弃分支', 'Reject / discard') : '']
        .filter(Boolean).join(isEn() ? ', ' : '、');
      const doText = power => zhEn(`同时 ${power.concurrent} 份奏折，一份里 ${power.parallel} 个部同时办`, `${power.concurrent} decree${power.concurrent > 1 ? 's' : ''} at once, ${power.parallel} office${power.parallel > 1 ? 's' : ''} in parallel`);

      /** 最低哪一级朝局有这项皇权（看得见第 n 层 / 能驳回……） */
      const unlockAt = (state, key, need = true) => {
        const powers = (state && state.regime && state.regime.powers) || {};
        return REGIME_KEYS.find(level => powers[level] && (key === 'see' ? powers[level].see >= need : powers[level][key] === need)) || 'qiangang';
      };

      /** 看不见的那一层：说明为什么看不见、升到哪个朝局能看见 */
      function Veil({ state, need, what, onGo, compact }) {
        const power = powerOfState(state);
        if (power.see >= need) return null;
        const now = regimeInfo(state.regime && state.regime.level).name;
        const unlock = regimeInfo(unlockAt(state, 'see', need)).name;
        return h('div', { className: cx('ssl-veil', compact && 'is-compact') },
          h('span', { className: 'ssl-veil-ic', 'aria-hidden': true }, '帘'),
          h('span', { className: 'ssl-grow' },
            zhEn(`${what}：朝局「${now}」，权臣隔着帘子，看不见。升到「${unlock}」可见。`, `${what}: under “${now}” the strongman keeps this behind the curtain. Visible from “${unlock}”.`)),
          onGo ? h('button', { className: 'ssl-link', onClick: () => onGo('roster') }, zhEn('去任命', 'Appoint')) : null);
      }

      /** 皇权：此刻看得见 / 能决定 / 能办成什么，以及再升一级多得什么 */
      function PowerCard({ state, onGo }) {
        const regime = state.regime;
        if (!regime) return null;
        const power = powerOfState(state);
        const next = REGIME_KEYS[regime.rank] || '';
        const nextPower = next && regime.powers ? regime.powers[next] : null;
        return h('div', { className: 'ssl-card ssl-power' },
          h('div', { className: 'ssl-card-h' },
            h('h4', { className: 'ssl-card-t' }, zhEn('皇权', 'Your power'), ' · ', regimeInfo(regime.level).name),
            onGo && next ? h('button', { className: 'ssl-link', onClick: () => onGo('roster') }, zhEn('升一级 →', 'Rise →')) : null),
          !power.bound ? h('div', { className: 'ssl-caption' }, zhEn('朝规里关了「朝局定皇权」：什么都看得见、都能决定。', '“Regime sets power” is off in the rules: you see and decide everything.')) : h(React.Fragment, null,
            h('div', { className: 'ssl-power-row' }, h('b', null, zhEn('看得见', 'See')), h('span', null, seeList(power.see))),
            h('div', { className: 'ssl-power-row' }, h('b', null, zhEn('能决定', 'Decide')), h('span', null, decideList(power), power.reject ? '' : h('em', null, zhEn('；不能驳回', '; no reject')))),
            h('div', { className: 'ssl-power-row' }, h('b', null, zhEn('能办成', 'Do')), h('span', null, doText(power))),
            next && nextPower ? h('div', { className: 'ssl-caption ssl-power-next' },
              zhEn(`再任用一家工具升到「${regimeInfo(next).name}」：`, `One more tool lifts you to “${regimeInfo(next).name}”: `),
              gainsOf(power, nextPower).join(isEn() ? ', ' : '，'),
              isEn() ? '.' : '。') : null));
      }

      /** 升一级多得什么：多看见哪几层、拿回哪些权、多办几份 */
      function gainsOf(from, to) {
        const gains = [];
        if (to.see > from.see) gains.push(zhEn(`多看见${[...Array(to.see - from.see)].map((_, i) => seeName(from.see + i + 1)).join('、')}`, `see ${[...Array(to.see - from.see)].map((_, i) => seeName(from.see + i + 1).toLowerCase()).join(', ')}`));
        if (to.mode && !from.mode) gains.push(zhEn('能亲选朝制', 'pick the procedure'));
        if (to.reject && !from.reject) gains.push(zhEn('拿回驳回之权', 'win the right to reject'));
        if (to.concurrent > from.concurrent || to.parallel > from.parallel) gains.push(zhEn(`同时能办 ${to.concurrent} 份、${to.parallel} 个部并行`, `${to.concurrent} decrees at once, ${to.parallel} offices in parallel`));
        return gains;
      }

      // ---------- 只用一家工具时：告诉你再接一家能多得什么，并一键接入 ----------
      const UPGRADE_KEY = 'sansheng-liubu.upgrade-dismissed';
      const INSTALL_HINTS = { claude: 'npm i -g @anthropic-ai/claude-code', codex: 'npm i -g @openai/codex', gemini: 'npm i -g @google/gemini-cli', qwen: 'npm i -g @qwen-code/qwen-code' };
      function UpgradeCard({ state, notify, onRefresh, onGo }) {
        const regime = state.regime;
        const [hidden, setHidden] = useState(() => {
          try { return !!regime && localStorage.getItem(UPGRADE_KEY) === regime.level; } catch { return false; }
        });
        const [busy, setBusy] = useState('');
        if (!regime || !regime.power || !regime.power.bound || regime.rank > 2 || hidden || !regime.powers) return null;
        const holding = new Set(Object.values(state.roles || {}).map(role => role.agentId));
        // 候选：有命令行、还没任职的工具（停用的也算，接入时顺手启用）
        const candidates = state.agents.filter(agent => agent.adapter === 'cli' && !holding.has(agent.id)).slice(0, 3);
        const gains = gainsOf(regime.power, regime.powers.liangdang);
        const dismiss = () => {
          try { localStorage.setItem(UPGRADE_KEY, regime.level); } catch { /* 存不了就只在这次隐藏 */ }
          setHidden(true);
        };
        // 接入：先探测 CLI 在不在，在就启用并让它当门下省（别家来审，封驳才算数）
        const join = agent => {
          setBusy(agent.id);
          apiJson('/probe', { method: 'POST', body: JSON.stringify({ agentId: agent.id }) })
            .then(result => {
              if (!result || !result.ok) {
                const hint = INSTALL_HINTS[String(agent.command || '').replace(/\.cmd$/i, '').toLowerCase()];
                notify(zhEn(`本机没找到 ${agent.command}。${hint ? `先在终端运行 ${hint} 并登录一次，` : '先装好它，'}再点一次。`, `${agent.command} was not found. ${hint ? `Run ${hint} and sign in once, ` : 'Install it, '}then try again.`), 'err');
                return;
              }
              const agents = state.agents.map(item => (item.id === agent.id ? { ...item, enabled: true } : item));
              const roles = { ...state.roles, menxia: { ...(state.roles.menxia || {}), agentId: agent.id, model: '' } };
              savePresetPatch({ ...state, agents }, { agents, roles }, onRefresh, notify, zhEn(`${agent.name} 已接入，担任门下省`, `${agent.name} joined as the Tribune`));
            })
            .catch(error => notify(String(error.message || error), 'err'))
            .finally(() => setBusy(''));
        };
        return h('div', { className: 'ssl-upgrade' },
          h('div', { className: 'ssl-grow' },
            h('b', null, zhEn(`现在是「${regimeInfo(regime.level).name}」：一家工具包办。`, `Now “${regimeInfo(regime.level).name}”: one tool does everything. `)),
            h('span', null, zhEn(`再接一家升为「${regimeInfo('liangdang').name}」：${gains.join('，')}，而且别家来审，把关分会明显上去。`, `Add one more to reach “${regimeInfo('liangdang').name}”: ${gains.join(', ')}, and a second tool reviews the work.`))),
          h('div', { className: 'ssl-actions' },
            candidates.map(agent => h('button', { key: agent.id, className: 'ssl-btn ssl-btn--seal ssl-btn--sm', disabled: !!busy, onClick: () => join(agent) },
              busy === agent.id ? zhEn('探测中…', 'Checking…') : zhEn(`接入 ${agent.name}`, `Add ${agent.name}`))),
            candidates.length ? null : h('button', { className: 'ssl-btn ssl-btn--sm', onClick: () => onGo('agents') }, zhEn('去群臣添加工具', 'Add a tool in Cohort')),
            h('button', { className: 'ssl-btn ssl-btn--ghost ssl-btn--sm', onClick: dismiss }, zhEn('知道了', 'Dismiss'))));
      }

      /** 五级朝局各自的皇权，当前这一级高亮（官职页） */
      function PowerTable({ state }) {
        const regime = state.regime;
        const powers = (regime && regime.powers) || {};
        return h('table', { className: 'ssl-table ssl-power-table' },
          h('thead', null, h('tr', null,
            h('th', null, zhEn('朝局', 'Regime')), h('th', null, zhEn('看得见', 'See')), h('th', null, zhEn('能决定', 'Decide')), h('th', null, zhEn('能办成', 'Do')))),
          h('tbody', null, REGIME_KEYS.map((key, index) => {
            const power = powers[key];
            if (!power) return null;
            const before = index ? (powers[REGIME_KEYS[index - 1]] || { see: 0 }).see : 0;
            // 这一级比上一级多看见的几层；一样多就写「同上」
            const added = [...Array(Math.max(0, power.see - before))].map((_, i) => seeName(before + i + 1));
            return h('tr', { key, className: cx(regime && regime.level === key && 'is-current') },
              h('td', null, h('b', null, regimeInfo(key).name)),
              h('td', null, !before ? added.join(isEn() ? ', ' : '、') : added.length ? `+ ${added.join(isEn() ? ', ' : '、')}` : zhEn('同上', 'Same')),
              h('td', null, decideList(power)),
              h('td', null, doText(power)));
          })));
      }

      // ---------- 各部在办什么：把工具动作翻成白话，原始命令只在乾纲独断时折起来给看 ----------
      const ACTIVITY = [
        ['edit', /^(edit|write|create|apply_?patch|patch|str_replace\w*|multi_?edit|notebook_?edit|update_?file|write_?file|file_change)$/i, ['改文件', 'edited files']],
        ['read', /^(read|view|cat|open|read_?file|view_?file)$/i, ['读文件', 'read files']],
        ['find', /^(glob|grep|search|find|ls|list|list_?dir|list_?files|rg|codebase_search)$/i, ['查找', 'searched']],
        ['agent', /^(subagent|task|agent|list_?agents|spawn_?agent|dispatch)$/i, ['派帮手', 'helpers']],
        ['web', /^(web\w*|fetch|browse|http\w*|curl)$/i, ['查资料', 'looked up']],
        ['plan', /^(todo\w*|plan|think\w*)$/i, ['理思路', 'planned']],
      ];
      const RUN = ['run', null, ['跑命令', 'ran commands']];
      const PATHISH = /[\\/]|\.[a-z0-9]{1,5}$/i;
      function describeTail(tail) {
        const counts = new Map();
        let last = null;
        let said = '';
        for (const raw of String(tail || '').split('\n')) {
          const line = raw.trim();
          if (!line) continue;
          if (line.startsWith('▸')) {
            const [tool = '', ...rest] = line.slice(1).trim().split(/\s+/);
            const kind = ACTIVITY.find(([, pattern]) => pattern.test(tool)) || RUN;
            counts.set(kind[0], { label: kind[2], n: ((counts.get(kind[0]) || {}).n || 0) + 1 });
            // 文件动作带上文件名（只要名字，不要整条路径）；命令一律不展示
            const target = rest.join(' ');
            last = { label: kind[2], file: kind !== RUN && PATHISH.test(target) ? target.split(/[\\/]/).filter(Boolean).pop() : '' };
          } else if (/[A-Za-z一-鿿]/.test(line) && line.length >= 6 && !/^[{}[\]();<>]/.test(line)) {
            said = line;
          }
        }
        return { counts: [...counts.values()], last, said: said.length > 110 ? `${said.slice(0, 110)}…` : said };
      }

      function Activity({ item, state, compact }) {
        const power = powerOfState(state);
        const { counts, last, said } = describeTail(item.tail);
        const label = pair => pair[isEn() ? 1 : 0];
        return h('div', { className: cx('ssl-act', compact && 'is-compact') },
          h('div', { className: 'ssl-act-now' },
            last ? zhEn(`正在${label(last.label)}${last.file ? ` · ${last.file}` : ''}`, `Now: ${label(last.label)}${last.file ? ` · ${last.file}` : ''}`)
              : said || zhEn('正在思考……', 'Thinking…')),
          counts.length ? h('div', { className: 'ssl-act-counts' }, counts.map(entry => h('span', { key: entry.label[0], className: 'ssl-pill ssl-pill--plain' }, `${label(entry.label)} ×${entry.n}`))) : null,
          said && last && !compact ? h('div', { className: 'ssl-act-said' }, said) : null,
          power.see >= 5 && item.tail ? h('details', { className: 'ssl-act-raw' },
            h('summary', null, zhEn('原始过程', 'Raw process')),
            h(Terminal, { text: item.tail, max: 1500, height: 180 })) : null);
      }

      // 架空程度
      const PUPPET_INFO = {
        supreme: [['大权在握', '朝中多家分权，大事你亲自拍板。'], ['Firm grip', 'Power is spread across houses and you make the big calls yourself.']],
        steady: [['垂拱而治', '分权得当，偶尔放手给丞相。'], ['Light hand', 'Power is well spread; now and then you let the regent decide.']],
        shared: [['君臣共治', '朝中有一两家说了算，但批红还握在你手里。'], ['Shared rule', 'One or two houses run things, but the seal is still yours.']],
        slipping: [['大权旁落', '一家独大，或者多半由丞相代你拍板。'], ['Power slipping', 'One house dominates, or the regent decides most decrees for you.']],
        figurehead: [['形同傀儡', '权臣包办一切，你只在最后盖个印，像汉献帝。'], ['Figurehead', 'One house does everything and you only stamp the end, like Honorius at Ravenna.']],
      };
      const puppetInfo = key => {
        const row = (PUPPET_INFO[key] || PUPPET_INFO.shared)[isEn() ? 1 : 0];
        return { name: row[0], desc: row[1] };
      };
      // 皇帝六能：名字 / 怎么算 / 怎么补
      const ABILITY_INFO = {
        zhiren: [['知人', '朝局越分权越高；拟旨与封驳出自同一家扣分', '再任用一家工具，或让拟旨与封驳分属两家'], ['Appointments', 'Higher the more houses share power; same-house drafting and review costs points', 'Bring in another tool, or give drafting and review to different houses']],
        mingcha: [['明察', '拍板的奏折里，亲自批红、驳回或叫停的比例', '少交给丞相拍板，奏折上来亲自批红或驳回'], ['Oversight', 'Share of decided decrees you sealed, rejected or halted yourself', 'Let the regent decide less; seal or reject decrees yourself']],
        jiejian: [['节俭', '废料越少、缓存命中越高越好', '看国库里「户部的建议」：废料多半来自被封驳的草稿和重办'], ['Thrift', 'Less waste and more cache reuse score higher', 'See the Quaestor’s advice in the Aerarium: waste is mostly vetoed drafts and redos']],
        shengming: [['圣明', '门下一次就准奏的比例；给了验收标准加分', '下旨时写清目标、范围和验收标准，门下就少驳几轮'], ['Clarity', 'Share of plans passed on the first review; acceptance criteria add points', 'State the goal, scope and acceptance criteria and the Tribune will veto less']],
        qinzheng: [['勤政', '近 30 天下了几道旨', '多下几道旨，史馆和这张图才有数据'], ['Diligence', 'Decrees issued in the last 30 days', 'Issue more decrees so the Annals and this chart have data']],
        zhiji: [['治绩', '办成的奏折占比', '去奏折页看失败原因，常见是 CLI 没装好或权限不够'], ['Results', 'Share of decrees that succeeded', 'Check failed decrees: usually a missing CLI or missing write permission']],
      };
      const ABILITY_KEYS = Object.keys(ABILITY_INFO);
      const abilityInfo = key => {
        const row = ABILITY_INFO[key][isEn() ? 1 : 0];
        return { name: row[0], how: row[1], tip: row[2] };
      };
      const TITLES_BY_ABILITY = {
        zhiren: ['知人善任之君', 'the Judge of Men'], mingcha: ['明察秋毫之君', 'the Watchful'], jiejian: ['节用爱民之君', 'the Frugal'],
        shengming: ['圣明烛照之君', 'the Clear-Sighted'], qinzheng: ['宵衣旰食之君', 'the Tireless'], zhiji: ['功业彪炳之君', 'the Accomplished'],
      };

      /** 五级朝局的阶梯，当前这一级高亮 */
      function RegimeLadder({ level }) {
        const current = REGIME_KEYS.indexOf(level);
        return h('ol', { className: 'ssl-ladder', 'aria-label': zhEn('五级朝局', 'Five regimes') }, REGIME_KEYS.map((key, index) => {
          const info = regimeInfo(key);
          return h('li', { key, className: cx(index === current && 'is-current', index < current && 'is-past'), title: `${info.when}\n${info.story}` },
            h('b', null, index + 1),
            h('span', { className: 'ssl-ladder-name' }, info.name),
            h('span', { className: 'ssl-ladder-when' }, info.when));
        }));
      }

      /** 头部的朝局小签：点一下进帝王传记 */
      function RegimeChip({ regime, onClick }) {
        if (!regime) return null;
        const info = regimeInfo(regime.level);
        const puppet = regime.puppet ? puppetInfo(regime.puppet.verdict) : null;
        return h('button', { className: cx('ssl-regime-chip', `is-${regime.level}`), onClick, title: `${info.when}${puppet ? `\n${puppet.name} · ${regime.puppet.score}` : ''}` },
          h('span', { className: 'ssl-caption' }, zhEn('朝局', 'Regime')),
          h('b', null, info.name),
          h('span', { className: 'ssl-regime-dots', 'aria-hidden': true }, REGIME_KEYS.map((key, index) => h('i', { key, className: cx(index <= regime.rank - 1 && 'on') }))));
      }

      /** 官职页顶部：当前朝局、各家分了哪些岗位、再任用谁能升一级 */
      function RegimeCard({ state, onRefresh, notify }) {
        const regime = state.regime;
        if (!regime) return null;
        const info = regimeInfo(regime.level);
        const apply = item => {
          const prev = state.roles[item.roleId] || {};
          savePresetPatch(state, { roles: { ...state.roles, [item.roleId]: { ...prev, agentId: item.agentId, model: '' } } }, onRefresh, notify,
            zhEn(`${roleName(item.roleId)}改由 ${item.agent} 担任`, `${roleName(item.roleId)} is now held by ${item.agent}`));
        };
        return h('div', { className: 'ssl-card ssl-regime' },
          h('div', { className: 'ssl-card-h' },
            h('div', { className: 'ssl-grow' },
              h('h4', { className: 'ssl-card-t' }, zhEn('朝局', 'Regime'), ' · ', info.name),
              h('div', { className: 'ssl-caption' }, zhEn('按官职任命算，不调模型、不花钱；工具越多，权越分散，皇权越稳', 'Read from who holds office, no model calls; the more tools, the more power is spread and the safer your throne'))),
            regime.autonomous ? h('span', { className: 'ssl-pill ssl-pill--warn' }, zhEn('丞相模式', 'Regent mode')) : null),
          h(RegimeLadder, { level: regime.level }),
          // 每种朝局下皇帝看得见多少、能决定多少、能办成多少
          regime.powers ? h('div', { className: 'ssl-power-wrap' },
            h('div', { className: 'ssl-label' }, zhEn('朝局定皇权', 'What each regime lets you do')),
            h(PowerTable, { state }),
            h('div', { className: 'ssl-caption', style: { marginTop: '6px' } }, zhEn('叫停任何朝局都能用：跑着的工具随时得能停下来。朝规里可关掉「朝局定皇权」。', 'Halting works under every regime: a running tool must always be stoppable. “Regime sets power” can be turned off in the rules.'))) : null,
          h('div', { className: 'ssl-regime-body' },
            h('div', null,
              h('p', { className: 'ssl-regime-story' }, info.story),
              h('div', { className: 'ssl-regime-row' }, h('span', { className: 'ssl-pill ssl-pill--ok' }, zhEn('得', 'Gain')), h('span', null, info.gain)),
              h('div', { className: 'ssl-regime-row' }, h('span', { className: 'ssl-pill ssl-pill--err' }, zhEn('失', 'Cost')), h('span', null, info.cost))),
            h('div', null,
              h('div', { className: 'ssl-label' }, zhEn('各家领哪些岗位', 'Who holds what')),
              regime.tools.length ? regime.tools.map(tool => h('div', { key: tool.agentId, className: 'ssl-regime-house' },
                h('b', null, tool.name),
                h('span', { className: 'ssl-caption' }, tool.offices.map(roleName).join(isEn() ? ', ' : '、')))) : h('div', { className: 'ssl-caption' }, zhEn('还没有人在任', 'No one holds office yet')))),
          regime.suggestions.length ? h('div', { className: 'ssl-regime-tips' }, regime.suggestions.map((item, index) => h('div', { key: index, className: 'ssl-regime-tip' },
            h('span', { className: 'ssl-grow' },
              item.kind === 'appoint' ? zhEn(
                `把${roleName(item.roleId)}交给 ${item.agent}${item.fit ? '（对口）' : ''}，朝局可升为「${regimeInfo(item.to).name}」`,
                `Give the ${roleName(item.roleId)} to ${item.agent}${item.fit ? ' (a good fit)' : ''} to rise to “${regimeInfo(item.to).name}”`)
                : item.kind === 'recuse' ? zhEn(
                  `回避：拟旨与封驳出自同一家，自己审自己。把门下省交给 ${item.agent}，封驳才算数`,
                  `Recusal: the same house drafts and reviews. Give the Tribune to ${item.agent} so the veto means something`)
                : zhEn(`群臣里没有闲着的工具：在「群臣」启用或添加一个，朝局可升为「${regimeInfo(item.to).name}」`,
                  `No idle tool in the Cohort: enable or add one to rise to “${regimeInfo(item.to).name}”`)),
            item.agentId ? h('button', { className: 'ssl-btn ssl-btn--sm', onClick: () => apply(item) }, zhEn('照此任命', 'Appoint')) : null))) : null);
      }

      /** 六轴雷达：单一系列，数值列表就是它的表格视图；悬停每个顶点看数值 */
      function Radar({ axes, label }) {
        const size = 240;
        const c = size / 2;
        const r = 84;
        const n = axes.length;
        const point = (index, value) => {
          const angle = -Math.PI / 2 + (index * 2 * Math.PI) / n;
          return [c + Math.cos(angle) * r * value / 100, c + Math.sin(angle) * r * value / 100];
        };
        const poly = values => values.map((value, index) => point(index, value).map(v => v.toFixed(1)).join(',')).join(' ');
        const values = axes.map(axis => (axis.value == null ? 0 : axis.value));
        return h('div', { className: 'ssl-radar' },
          // 两侧各留 58 的边给轴名（英文名比中文长），不让文字压到旁边的数值列表
          h('svg', { viewBox: `-58 -6 ${size + 116} ${size + 12}`, role: 'img', 'aria-label': label },
            [25, 50, 75, 100].map(level => h('polygon', { key: level, className: 'ssl-radar-grid', points: poly(axes.map(() => level)) })),
            axes.map((axis, index) => {
              const [x, y] = point(index, 100);
              return h('line', { key: axis.key, className: 'ssl-radar-grid', x1: c, y1: c, x2: x, y2: y });
            }),
            h('polygon', { className: 'ssl-radar-area', points: poly(values) }),
            axes.map((axis, index) => {
              const [x, y] = point(index, values[index]);
              return h('g', { key: axis.key },
                h('circle', { className: cx('ssl-radar-dot', axis.value == null && 'is-empty'), cx: x, cy: y, r: 4 }),
                // 比点大的透明热区，悬停出数值
                h('circle', { cx: x, cy: y, r: 12, fill: 'transparent' }, h('title', null, `${axis.name}: ${axis.value == null ? zhEn('暂无', 'no data') : axis.value}${axis.note ? ` · ${axis.note}` : ''}`)));
            }),
            axes.map((axis, index) => {
              const [x, y] = point(index, 122);
              const anchor = Math.abs(x - c) < 4 ? 'middle' : x > c ? 'start' : 'end';
              return h('text', { key: axis.key, className: 'ssl-radar-label', x, y: y + 4, textAnchor: anchor }, axis.name);
            })),
          h('ul', { className: 'ssl-radar-list' }, axes.map(axis => h('li', { key: axis.key, title: axis.how || '' },
            h('span', null, axis.name),
            h('b', null, axis.value == null ? '—' : axis.value),
            axis.note ? h('i', null, axis.note) : null))));
      }

      // ---------- 帝王传记 ----------
      // ---------- 成效：同样的活，与一个工具单干相比快了多少、交到你手上前好了多少 ----------
      const rate = value => (value == null ? '—' : `${Math.round(value * 100)}%`);
      const CATCH_INFO = {
        veto: [['门下封驳', '方案没想清楚就被打回重拟'], ['Tribune veto', 'Plans sent back before any work began']],
        impeach: [['御史弹劾', '回奏不实、产出缺失，带着问题重办'], ['Impeachment', 'Reports that did not hold up, redone with the findings']],
        admonish: [['锦衣卫督办', '推脱、说「请您手动」的被打回'], ['Admonition', 'Shirking (“you can do it manually”) sent back']],
        guard: [['锦衣卫看守', '卡死不动、超支的被拿下'], ['Guard', 'Stalled or overspending work stopped']],
        remedy: [['复核补救', '复核不过，自动补办'], ['Remedy', 'Failed the audit and was fixed automatically']],
      };
      const catchInfo = key => { const row = CATCH_INFO[key][isEn() ? 1 : 0]; return { name: row[0], desc: row[1] }; };

      /** 两根条对比：单干（灰）与三省六部（主色），数值写在条后面 */
      function CompareRow({ label, solo, court, soloText, courtText, max, better }) {
        const width = value => `${max ? Math.max(2, Math.min(100, (value / max) * 100)) : 0}%`;
        return h('div', { className: 'ssl-cmp' },
          h('div', { className: 'ssl-cmp-label' }, label),
          h('div', { className: 'ssl-cmp-bars' },
            h('div', { className: 'ssl-cmp-row', title: `${zhEn('单干', 'Alone')}: ${soloText}` },
              h('span', { className: 'ssl-cmp-who' }, zhEn('单干', 'Alone')),
              h('div', { className: 'ssl-cmp-track' }, h('i', { className: 'is-solo', style: { width: width(solo) } })),
              h('b', null, soloText)),
            h('div', { className: 'ssl-cmp-row', title: `${zhEn('三省六部', 'Senate')}: ${courtText}` },
              h('span', { className: 'ssl-cmp-who' }, zhEn('三省六部', 'Senate')),
              h('div', { className: 'ssl-cmp-track' }, h('i', { className: 'is-court', style: { width: width(court) } })),
              h('b', null, courtText, better ? h('em', null, better) : null))));
      }

      function ImpactTab({ state, onGo }) {
        const [data, setData] = useState(null);
        const [error, setError] = useState('');
        useEffect(() => {
          apiJson('/impact').then(setData).catch(err => setError(String(err.message || err)));
        }, [state.edicts.length, state.edicts.filter(item => item.status === 'done').length]);
        if (error) return h('div', { className: 'ssl-card ssl-alert' }, error);
        if (!data) return h('div', { className: 'ssl-card ssl-empty' }, t('loading'));
        if (!data.count) {
          return h('div', { className: 'ssl-card ssl-empty' },
            h('p', { style: { margin: '0 0 12px' } }, zhEn('还没有办完的奏折。办完第一份，这里就会算出：同样的活比一个工具单干快了多少、交到你手上之前多拦下了几个问题。',
              'No finished decrees yet. After the first one, this page shows how much faster it was than one tool working alone and how many problems were caught before reaching you.')),
            h('button', { className: 'ssl-btn ssl-btn--seal', onClick: () => onGo('court') }, zhEn('去下旨', 'Issue a decree')));
        }
        const { time, quality, catches, caught, money, recent } = data;
        const speedup = time.speedup ? `${time.speedup.toFixed(time.speedup >= 10 ? 0 : 1)}×` : '—';
        const faster = time.speedup && time.speedup > 1 ? Math.round((1 - 1 / time.speedup) * 100) : 0;
        const maxTime = Math.max(time.soloMs, time.execWallMs + time.reviewMs, 1);
        const net = time.netSavedMs;

        return h('div', null,
          h('div', { className: 'ssl-impact-hero' },
            h('div', { className: 'ssl-card ssl-impact-big' },
              h('span', { className: 'ssl-caption' }, zhEn('办差比单干快', 'Faster than one tool alone')),
              h('b', null, speedup),
              h('span', { className: 'ssl-caption' }, faster ? zhEn(`少等 ${faster}%：${fmtElapsed(time.soloMs)} → ${fmtElapsed(time.execWallMs)}`, `${faster}% less waiting: ${fmtElapsed(time.soloMs)} → ${fmtElapsed(time.execWallMs)}`) : zhEn('还没有并行办过的差事', 'No parallel work yet'))),
            h('div', { className: 'ssl-card ssl-impact-big' },
              h('span', { className: 'ssl-caption' }, zhEn('交到你手上前的合格率', 'Pass rate before it reaches you')),
              h('b', null, quality.upliftPts != null ? `+${quality.upliftPts}` : '—', h('small', null, zhEn(' 个百分点', ' pts'))),
              h('span', { className: 'ssl-caption' }, zhEn(`单干 ${rate(quality.firstPassRate)} → 三省六部 ${rate(quality.passRate)}`, `Alone ${rate(quality.firstPassRate)} → Senate ${rate(quality.passRate)}`))),
            h('div', { className: 'ssl-card ssl-impact-big' },
              h('span', { className: 'ssl-caption' }, zhEn('在你看到之前拦下的问题', 'Problems caught before you saw them')),
              h('b', null, caught),
              h('span', { className: 'ssl-caption' }, zhEn(`${data.count} 份奏折，单干时这些都会原样交到你手上`, `${data.count} decrees; alone, all of these would have reached you`))),
            h('div', { className: 'ssl-card ssl-impact-big' },
              h('span', { className: 'ssl-caption' }, zhEn('把关分', 'Quality score')),
              h('b', null, quality.score != null ? quality.score : '—', h('small', null, ' / 100')),
              h('span', { className: 'ssl-caption' }, zhEn('交叉审议、逐件复核、最终合格、救回率', 'Cross-review, audits, final pass, rescues')))),

          h('div', { className: 'ssl-cols', style: { marginTop: '12px' } },
            h('div', { className: 'ssl-card' },
              h('div', { className: 'ssl-card-h' },
                h('h4', { className: 'ssl-card-t' }, zhEn('同样的活：单干 vs 三省六部', 'Same work: alone vs the Senate')),
                h('span', { className: 'ssl-caption' }, zhEn('悬停看数值', 'Hover for values'))),
              h(CompareRow, {
                label: zhEn('办差耗时（越短越好）', 'Time at work (shorter is better)'), max: maxTime,
                solo: time.soloMs, court: time.execWallMs, soloText: fmtElapsed(time.soloMs), courtText: fmtElapsed(time.execWallMs),
                better: faster ? zhEn(` 快 ${faster}%`, ` ${faster}% faster`) : '',
              }),
              h(CompareRow, {
                label: zhEn('交到你手上前合格（越高越好）', 'Passed before reaching you (higher is better)'), max: 1,
                solo: quality.firstPassRate || 0, court: quality.passRate || 0, soloText: rate(quality.firstPassRate), courtText: rate(quality.passRate),
                better: quality.upliftPts ? zhEn(` +${quality.upliftPts} 点`, ` +${quality.upliftPts} pts`) : '',
              }),
              h(CompareRow, {
                label: zhEn('有人替你把关', 'Someone checks the work'), max: 1,
                solo: 0, court: quality.auditRate || 0, soloText: zhEn('没有', 'Nobody'), courtText: rate(quality.auditRate),
              })),
            h('div', { className: 'ssl-card' },
              h('div', { className: 'ssl-card-h' }, h('h4', { className: 'ssl-card-t' }, zhEn('时间账', 'Time ledger'))),
              h('div', { className: 'ssl-ledger' },
                h('div', null, h('span', null, zhEn('并行省下', 'Saved by parallel work')), h('b', { className: 'is-plus' }, `+${fmtElapsed(time.parallelSavedMs)}`)),
                h('div', null, h('span', { title: zhEn('每拦下一个问题，按一次办差的平均时长算你少返工一次', 'Each caught problem counts as one redo you did not have to do, at the average order length') }, zhEn('少返工（估算）', 'Rework avoided (estimate)')), h('b', { className: 'is-plus' }, `+${fmtElapsed(time.reworkSavedMs)}`)),
                h('div', null, h('span', null, zhEn('拟旨、封驳、复核多花', 'Spent on drafting, review and audit')), h('b', { className: 'is-minus' }, `−${fmtElapsed(time.reviewMs)}`)),
                h('div', { className: 'is-total' }, h('span', null, zhEn('净省', 'Net')), h('b', { className: net >= 0 ? 'is-plus' : 'is-minus' }, `${net >= 0 ? '+' : '−'}${fmtElapsed(Math.abs(net))}`))),
              h('div', { className: 'ssl-ledger', style: { marginTop: '12px' } },
                h('div', null, h('span', null, zhEn('为把关多付', 'Paid for checking')), h(Money, { usd: money.reviewCostUsd, compact: true })),
                h('div', null, h('span', null, zhEn('缓存省下', 'Saved by the cache')), h(Money, { usd: money.savedUsd, compact: true }))),
              net < 0 ? h('div', { className: 'ssl-caption', style: { marginTop: '8px' } }, zhEn('净省为负：审议花的时间比省下的多。短小的活交给急递，或在朝规里把朝制设为自动。', 'Net is negative: review took longer than it saved. Send small jobs express, or set the procedure to auto in the rules.')) : null)),

          h(Section, { title: zhEn('拦下了什么', 'What was caught'), note: zhEn('单干时，这些问题都要你自己发现、自己返工', 'Alone, you would have found and fixed each of these yourself') }),
          h('div', { className: 'ssl-grid ssl-catches' }, Object.keys(CATCH_INFO).map(key => h('div', { key, className: cx('ssl-card ssl-catch', catches[key] && 'is-hit') },
            h('b', null, catches[key] || 0),
            h('div', null, h('div', { className: 'ssl-role-title' }, catchInfo(key).name), h('div', { className: 'ssl-caption' }, catchInfo(key).desc))))),

          h(Section, { title: zhEn('把关明细', 'Quality detail') }),
          h('div', { className: 'ssl-card' },
            h('div', { className: 'ssl-ledger' },
              h('div', null, h('span', { title: zhEn('拟旨与封驳出自两家工具的比例：别家来审，才看得出自家的盲区', 'Share of plans reviewed by a different tool than the one that drafted them') }, zhEn('交叉审议', 'Cross-tool review')), h('b', null, rate(quality.crossRate))),
              h('div', null, h('span', null, zhEn('有御史巡查或门下复核', 'Inspected or audited')), h('b', null, rate(quality.auditRate))),
              h('div', null, h('span', { title: zhEn('被拦下过问题的奏折里，最后仍然办成的比例', 'Of decrees with caught problems, the share that still ended well') }, zhEn('救回率', 'Rescue rate')), h('b', null, rate(quality.rescueRate))),
              h('div', null, h('span', null, zhEn('一次就办对', 'Right first time')), h('b', null, rate(quality.firstPassRate)))),
            quality.crossRate === 0 || quality.crossRate == null ? h('div', { className: 'ssl-caption', style: { marginTop: '8px' } },
              zhEn('拟旨与封驳出自同一家工具时，审议只能算自查。再接一家工具当门下省，把关分会明显上去。', 'When the same tool drafts and reviews, review is only a self-check. Give the Tribune to another tool and the score rises.'),
              ' ', h('button', { className: 'ssl-link', onClick: () => onGo('roster') }, zhEn('去任命 →', 'Appoint →'))) : null),

          h(Section, { title: zhEn('最近的奏折', 'Recent decrees'), note: zhEn('这张表就是上面各图的数据', 'This table is the data behind the charts above') }),
          h('div', { className: 'ssl-card', style: { overflowX: 'auto' } },
            h('table', { className: 'ssl-table' },
              h('thead', null, h('tr', null,
                h('th', null, zhEn('奏折', 'Decree')), h('th', null, zhEn('单干', 'Alone')), h('th', null, zhEn('三省六部', 'Senate')),
                h('th', null, zhEn('快了', 'Faster')), h('th', null, zhEn('拦下', 'Caught')), h('th', null, zhEn('合格', 'Passed')))),
              h('tbody', null, recent.map(row => h('tr', { key: row.id },
                h('td', { className: 'ssl-ellipsis', style: { maxWidth: '320px' }, title: row.brief }, row.brief),
                h('td', null, fmtElapsed(row.soloMs)),
                h('td', null, fmtElapsed(row.execWallMs)),
                h('td', null, row.execWallMs && row.soloMs > row.execWallMs ? `${Math.round((1 - row.execWallMs / row.soloMs) * 100)}%` : '—'),
                h('td', null, row.caught || '—'),
                h('td', null, row.passed ? '✓' : '✗')))))),

          h('div', { className: 'ssl-card', style: { marginTop: '12px' } },
            h('details', { className: 'ssl-details' },
              h('summary', null, zhEn('怎么算的', 'How this is measured')),
              h('ul', { className: 'ssl-lessons' },
                h('li', null, zhEn('单干：同一批办差调用由一个工具一件件做，耗时是它们的时长之和；没有封驳、巡查、复核。', 'Alone: the same work orders done one after another by one tool, so the time is their sum; no veto, inspection or audit.')),
                h('li', null, zhEn('三省六部：办差并行，耗时按墙钟算（同时进行的只算一次）；拟旨、封驳、复核的时间单独记在时间账里，不藏。', 'Senate: orders run in parallel and are timed by the clock (overlaps count once); drafting, review and audit time is listed separately in the ledger.')),
                h('li', null, zhEn('合格率：单干只有「一次就办对、没被拦下任何问题」的算合格；三省六部按最后通过复核或你批红算。', 'Pass rate: alone, only work with no caught problems counts; with the Senate, work that finally passed the audit or your seal counts.')),
                h('li', null, zhEn('少返工是估算：每拦下一个问题，按一次办差的平均时长算。只用已记下的数据，不调模型、不花钱。', 'Rework avoided is an estimate: one average order per caught problem. Only recorded data is used; no model calls.'))))));
      }

      function BiographyTab({ state, onGo }) {
        const [bio, setBio] = useState(null);
        const [error, setError] = useState('');
        useEffect(() => {
          apiJson('/biography').then(setBio).catch(err => setError(String(err.message || err)));
        }, [state.edicts.length, state.regime && state.regime.level]);
        if (error) return h('div', { className: 'ssl-card ssl-alert' }, error);
        if (!bio) return h('div', { className: 'ssl-card ssl-empty' }, t('loading'));

        const regime = bio.regime;
        const info = regimeInfo(regime.level);
        const puppet = puppetInfo(regime.puppet.verdict);
        const reign = bio.reign;
        const scored = ABILITY_KEYS.filter(key => bio.abilities[key] != null);
        const best = scored.slice().sort((a, b) => bio.abilities[b] - bio.abilities[a])[0];
        const worst = scored.slice().sort((a, b) => bio.abilities[a] - bio.abilities[b])[0];
        const title = !reign.edicts ? zhEn('新君初立', 'a new Caesar')
          : regime.puppet.verdict === 'figurehead' ? zhEn('傀儡天子', 'a figurehead Caesar')
          : TITLES_BY_ABILITY[best || 'qinzheng'][isEn() ? 1 : 0];
        const days = reign.since ? Math.max(1, Math.ceil((Date.now() - reign.since) / 86400000)) : 0;

        const taskAxes = MINISTRY_IDS.map(id => {
          const bucket = bio.tasks[id] || { total: 0, done: 0 };
          return {
            key: id, name: roleName(id),
            value: bucket.total ? Math.round(100 * bucket.done / bucket.total) : null,
            note: zhEn(`${bucket.done}/${bucket.total} 件`, `${bucket.done}/${bucket.total}`),
          };
        });
        const abilityAxes = ABILITY_KEYS.map(key => ({ key, name: abilityInfo(key).name, how: abilityInfo(key).how, value: bio.abilities[key] }));
        const regimeHistory = REGIME_KEYS.filter(key => reign.regimes[key]);

        return h('div', null,
          h('div', { className: 'ssl-card ssl-bio-head' },
            h('div', { className: 'ssl-grow' },
              h('div', { className: 'ssl-caption' }, zhEn('帝王传记', 'Res Gestae')),
              h('h3', { className: 'ssl-bio-title' }, title),
              h('p', { className: 'ssl-caption', style: { margin: '6px 0 0' } }, reign.edicts
                ? zhEn(`在位 ${days} 日，下旨 ${reign.edicts} 道：办成 ${reign.done}、驳回 ${reign.rejected}、叫停 ${reign.cancelled}、失败 ${reign.failed}；亲裁 ${reign.ruled} 道，丞相代裁 ${reign.regent} 道。`,
                  `${days} days on the throne, ${reign.edicts} decrees: ${reign.done} done, ${reign.rejected} rejected, ${reign.cancelled} halted, ${reign.failed} failed; ${reign.ruled} decided by you, ${reign.regent} by the regent.`)
                : zhEn('还没下过旨。下第一道旨，传记就从这里写起。', 'No decrees yet. Your record begins with the first one.'))),
            h('div', { className: cx('ssl-puppet', `is-${regime.puppet.verdict}`) },
              h('div', { className: 'ssl-between' },
                h('span', { className: 'ssl-caption' }, zhEn('是否被架空', 'Are you a puppet?')),
                h('b', null, puppet.name)),
              h('div', { className: 'ssl-meter', role: 'meter', 'aria-valuenow': regime.puppet.score, 'aria-valuemin': 0, 'aria-valuemax': 100, title: zhEn(`架空指数 ${regime.puppet.score}/100`, `Puppet index ${regime.puppet.score}/100`) },
                h('i', { style: { width: `${regime.puppet.score}%` } })),
              h('div', { className: 'ssl-between ssl-caption' }, h('span', null, zhEn('大权在握', 'In control')), h('span', null, `${regime.puppet.score}/100`), h('span', null, zhEn('形同傀儡', 'Figurehead'))),
              h('p', { className: 'ssl-caption', style: { margin: '6px 0 0' } }, puppet.desc))),

          h(Section, { title: zhEn('朝局', 'Regime'), note: `${info.name} · ${info.when}` }),
          h('div', { className: 'ssl-card' },
            h(RegimeLadder, { level: regime.level }),
            h('div', { className: 'ssl-regime-row', style: { marginTop: '10px' } }, h('span', { className: 'ssl-pill ssl-pill--ok' }, zhEn('得', 'Gain')), h('span', null, info.gain)),
            h('div', { className: 'ssl-regime-row' }, h('span', { className: 'ssl-pill ssl-pill--err' }, zhEn('失', 'Cost')), h('span', null, info.cost)),
            regimeHistory.length ? h('div', { className: 'ssl-caption', style: { marginTop: '10px' } },
              zhEn('历朝：', 'Past decrees: '), regimeHistory.map(key => `${regimeInfo(key).name} ×${reign.regimes[key]}`).join(isEn() ? ', ' : '、')) : null,
            regime.suggestions.length ? h('div', { style: { marginTop: '10px' } },
              h('button', { className: 'ssl-btn ssl-btn--sm', onClick: () => onGo('roster') }, zhEn('去官职页调整任命 →', 'Adjust appointments →'))) : null),

          h('div', { className: 'ssl-cols ssl-bio-radars' },
            h('div', { className: 'ssl-card' },
              h('div', { className: 'ssl-card-h' },
                h('h4', { className: 'ssl-card-t' }, zhEn('任务雷达', 'Tasks by magistrate')),
                h('span', { className: 'ssl-caption' }, zhEn('各部办成率', 'success rate per office'))),
              h(Radar, { axes: taskAxes, label: zhEn('六部办成率雷达图', 'Success rate radar of the six magistrates') })),
            h('div', { className: 'ssl-card' },
              h('div', { className: 'ssl-card-h' },
                h('h4', { className: 'ssl-card-t' }, zhEn('皇帝六能', 'Your six virtues')),
                h('span', { className: 'ssl-caption' }, zhEn('0–100，悬停看算法', '0–100, hover for how'))),
              h(Radar, { axes: abilityAxes, label: zhEn('皇帝能力雷达图', 'Emperor ability radar') }))),

          worst ? h('div', { className: 'ssl-card', style: { marginTop: '12px' } },
            h('h4', { className: 'ssl-card-t', style: { marginBottom: '6px' } }, zhEn('史臣曰', 'The annalist says')),
            h('p', { style: { margin: 0 } },
              zhEn(`长于${abilityInfo(best).name}，短于${abilityInfo(worst).name}。`, `Strong in ${abilityInfo(best).name}, weak in ${abilityInfo(worst).name}. `),
              abilityInfo(worst).tip, isEn() ? '.' : '。')) : null,
          h(Achievements, { bio, state }));
      }

      /** 功勋：做到了就盖上朱印，没做到的给出进度。全按已记下的数据算 */
      function Achievements({ bio, state }) {
        const [impact, setImpact] = useState(null);
        useEffect(() => { apiJson('/impact').then(setImpact).catch(() => setImpact(null)); }, [state.edicts.length]);
        const reign = bio.reign;
        const rank = (state.regime && state.regime.rank) || 1;
        const reached = key => !!(reign.regimes && reign.regimes[key]) || REGIME_KEYS.indexOf(key) < rank;
        const ministries = MINISTRY_IDS.filter(id => bio.tasks[id] && bio.tasks[id].total > 0).length;
        const catches = (impact && impact.catches) || {};
        const time = (impact && impact.time) || {};
        const money = (impact && impact.money) || {};
        const list = [
          ['登', 'I', ['登基', 'Accession'], ['下第一道旨', 'Issue your first decree'], reign.edicts, 1],
          ['勤', 'II', ['勤政', 'Diligence'], ['下满 20 道旨', 'Issue 20 decrees'], reign.edicts, 20],
          ['亲', 'III', ['亲政', 'Personal rule'], ['亲自批红或驳回 10 道', 'Seal or reject 10 decrees yourself'], reign.ruled, 10],
          ['功', 'IV', ['功业', 'Triumph'], ['办成 30 道', 'Finish 30 decrees'], reign.done, 30],
          ['齐', 'V', ['六部齐备', 'Six magistrates'], ['六部都办过差', 'Every magistrate has served'], ministries, 6],
          ['分', 'VI', ['分权', 'Divided power'], ['升到两党争霸', 'Reach East and West'], reached('liangdang') ? 1 : 0, 1],
          ['鼎', 'VII', ['三足鼎立', 'Triumvirate'], ['升到三巨头', 'Reach the Triumvirate'], reached('sanju') ? 1 : 0, 1],
          ['乾', 'VIII', ['乾纲独断', 'Tetrarchy'], ['升到乾纲独断', 'Reach the Tetrarchy'], reached('qiangang') ? 1 : 0, 1],
          ['谏', 'IX', ['广开言路', 'Open court'], ['门下封驳 5 次', 'The Tribune vetoes 5 times'], catches.veto || 0, 5],
          ['察', 'X', ['明察秋毫', 'Sharp eyes'], ['御史弹劾 3 次', '3 impeachments'], catches.impeach || 0, 3],
          ['速', 'XI', ['并行如飞', 'Swift as Mercury'], ['并行累计省下 1 小时', 'Save an hour by parallel work'], Math.floor((time.parallelSavedMs || 0) / 60000), 60],
          ['俭', 'XII', ['节用', 'Thrift'], ['缓存累计省下 1 美元', 'Save $1 through the cache'], Math.floor((money.savedUsd || 0) * 100), 100],
        ];
        const won = list.filter(row => row[4] >= row[5]).length;
        return h(React.Fragment, null,
          h(Section, { title: zhEn('功勋', 'Honours'), note: zhEn(`已得 ${won} / ${list.length}`, `${won} of ${list.length} won`) }),
          h('div', { className: 'ssl-badges' }, list.map(([seal, latin, name, how, value, target]) => {
            const done = value >= target;
            return h('div', { key: seal, className: cx('ssl-badge', done && 'is-won'), title: `${zhEn(how[0], how[1])} · ${Math.min(value, target)}/${target}` },
              h('span', { className: cx('ssl-badge-seal', isEn() && 'is-latin') }, isEn() ? latin : seal),
              h('div', { className: 'ssl-grow' },
                h('div', { className: 'ssl-role-title' }, zhEn(name[0], name[1])),
                h('div', { className: 'ssl-caption' }, zhEn(how[0], how[1])),
                done ? null : h('div', { className: 'ssl-meter' }, h('i', { style: { width: `${Math.min(100, (value / target) * 100)}%` } }))));
          })));
      }

      function App({ embedded }) {
        useLocale();
        const { state, error, refresh } = useCourtState();
        const [tab, setTab] = useState('court');
        const [toastNode, notify] = useToast();
        // 朝堂与朝会共用的「当前奏折」：null = 还没定，'' = 新旨
        const [selected, setSelected] = useState(null);
        useEffect(() => {
          if (selected !== null || !state) return;
          const busy = state.edicts.find(item => isLive(item.status) || item.status === 'awaiting-approval');
          setSelected(busy ? busy.id : '');
        }, [state, selected]);

        // 皮肤/主题跟着宿主里存的选择走：每次拿到 state 都对齐一次（多实例、重启后自动恢复）
        const ui = (state && state.ui) || {};
        const skin = ui.skin || 'default';
        const themeKey = ui.theme || 'default';
        useEffect(() => {
          setBackdropOptions(ui);
        }, [ui.background, ui.backgroundVersion, ui.backgroundDim]);
        useEffect(() => {
          applyTheme(themeKey);
          applySkin(skin);
        }, [skin, themeKey]);

        const openEdict = id => {
          setSelected(id);
          setTab('court');
        };

        const edicts = (state && state.edicts) || [];
        const liveCount = (state && state.live && state.live.length) || 0;
        const awaiting = edicts.filter(item => item.status === 'awaiting-approval' || item.status === 'awaiting-input').length;
        const running = edicts.filter(item => isLive(item.status)).length;
        const archived = edicts.filter(item => item.status === 'done').length;

        const tabs = [
          ['court', t('tabCourt'), awaiting ? h('span', { className: 'ssl-count ssl-count--seal' }, awaiting) : null],
          ['memorial', zhEn('朝会', 'Forum'), null],
          ['workroom', t('tabWorkroom'), liveCount ? h('span', { className: 'ssl-count' }, liveCount) : null],
          ['roster', t('tabRoster'), null],
          ['annals', t('tabAnnals'), null],
          ['treasury', t('tabTreasury'), null],
          ['impact', zhEn('成效', 'Gains'), null],
          ['biography', t('tabBio'), null],
          ['agents', t('tabAgents'), null],
          ['hall', t('tabHall'), null],
        ];

        // 朝堂是三栏工作台：整页定高，三栏各自滚动
        const bench = tab === 'court' && !!state;
        return h('div', { className: cx('ssl-root', embedded && 'is-embedded', bench && 'is-bench') }, h('div', { className: cx('ssl', bench && 'is-bench'), 'data-locale': currentLocale },
          h('div', { className: 'ssl-head' },
            h(Seal, { name: 'app' }),
            h('div', { className: 'ssl-head-text' },
              h('h2', { className: 'ssl-h1' }, t('appName')),
              h('p', { className: 'ssl-sub' }, t('appSub'))),
            h(LanguageSwitch),
            state ? h(RegimeChip, { regime: state.regime, onClick: () => setTab('biography') }) : null,
            state ? h('div', { className: 'ssl-stats' },
              h('div', { className: cx('ssl-stat', running && 'ssl-stat--warn') }, h('b', null, running), h('span', null, t('statRunning'))),
              h('div', { className: cx('ssl-stat', awaiting && 'ssl-stat--seal') }, h('b', null, awaiting), h('span', null, t('statAwaiting'))),
              h('div', { className: 'ssl-stat' }, h('b', null, archived), h('span', null, t('statArchived')))) : null),
          h('nav', { className: 'ssl-nav', role: 'tablist' }, tabs.map(([id, text, badge]) => h('button', {
            key: id, role: 'tab', 'aria-selected': tab === id, className: cx(tab === id && 'is-active'),
            onClick: () => setTab(id),
          }, text, badge))),
          error && !state ? h('div', { className: 'ssl-card' },
            h('div', { className: 'ssl-alert', style: { marginTop: 0 } }, t('noHost', { error })),
            h('p', { className: 'ssl-caption', style: { margin: '10px 0 0' } }, t('noHostHint')))
            : !state ? h('div', { className: 'ssl-card ssl-empty' }, t('loading'))
            : tab === 'court' ? h(CourtTab, { state, onRefresh: refresh, notify, onGo: setTab, selected: selected || '', onSelect: setSelected })
            : tab === 'roster' ? h(RosterTab, { state, onRefresh: refresh, notify })
            : tab === 'biography' ? h(BiographyTab, { state, onGo: setTab })
            : tab === 'workroom' ? h(WorkroomTab, { state, onOpenEdict: openEdict, onGo: setTab })
            : tab === 'memorial' ? h(ForumTab, { state, notify, selected: selected || '', onSelect: setSelected, onGo: setTab })
            : tab === 'annals' ? h(AnnalsTab, { state, onRefresh: refresh, notify })
            : tab === 'treasury' ? h(TreasuryTab, { state, onRefresh: refresh, notify })
            : tab === 'impact' ? h(ImpactTab, { state, onGo: setTab })
            : tab === 'hall' ? h(HallTab, { state, onRefresh: refresh, notify })
            : h(AgentsTab, { state, onRefresh: refresh, notify }),
          error && state ? h('div', { className: 'ssl-alert' }, t('hostLost', { error })) : null,
          toastNode));
      }

      const SID = 'sansheng-liubu';

      // ---------- DSH 侧栏「工作区」：三省六部用到的文件夹登记进去，在侧栏里就能找到、能开会话 ----------
      // 侧栏的工作区列表只列 DSH 自己的会话，插件加不了行、也写不进会话；能做的是把文件夹登记成工作区（ctx.workspaces，可选服务）
      let workspacesApi = null;
      const registeredDirs = new Set();
      function registerWorkspace(dir, title) {
        if (!workspacesApi || !dir || registeredDirs.has(dir)) return;
        registeredDirs.add(dir);
        Promise.resolve()
          .then(() => workspacesApi.create({ path: dir }))
          .then(view => {
            // 只给新登记、还叫文件夹名的起个名字；用户自己改过名的不动
            const base = String(dir).split(/[\\/]/).filter(Boolean).pop();
            if (title && view && view.id && (!view.title || view.title === base)) return workspacesApi.rename(view.id, title);
            return null;
          })
          .catch(error => {
            registeredDirs.delete(dir);
            console.warn('[sansheng-liubu] register workspace failed:', error);
          });
      }

      // ================= 做进 DSH：会话头部视图 + 右侧面板 =================
      let sidebarRightApi = null; // ctx.sidebarRight（可选服务，旧版 DSH 没有）
      const PANE_EXEC = 'sansheng-exec';
      const PANE_CHAT = 'sansheng-chat';

      /** 打开右侧面板的某个页签；没有右侧面板服务或当前不在会话里时静默跳过 */
      function openPane(kind) {
        try {
          if (sidebarRightApi && typeof sidebarRightApi.openTab === 'function') sidebarRightApi.openTab(kind);
        } catch (error) {
          console.warn('[sansheng-liubu] open right pane failed:', error);
        }
      }

      // 钦定流程存在宿主（state.json），任何入口下旨、包括模型调 sansheng_edict 都会带上。
      // 老版本存在浏览器 localStorage 里，第一次打开时搬过去。
      const LEGACY_WORKFLOW_KEY = 'sansheng-liubu.workflow';
      function takeLegacyWorkflow() {
        try {
          const list = JSON.parse(localStorage.getItem(LEGACY_WORKFLOW_KEY) || '[]');
          localStorage.removeItem(LEGACY_WORKFLOW_KEY);
          return Array.isArray(list) ? list.filter(item => item && item.ministry) : [];
        } catch {
          return [];
        }
      }

      /** 右侧面板默认看哪份奏折：正在办的，否则最近一份 */
      const pickEdict = state => (state ? state.edicts.find(item => isLive(item.status)) || state.edicts[0] || null : null);

      function LoadingCard({ error }) {
        return h('div', { className: 'ssl-card ssl-empty' }, error ? t('noHost', { error }) : t('loading'));
      }

      function ViewFrame({ seal, title, sub, toast, children }) {
        return h('div', { className: 'ssl-scroll' },
          h('div', { className: 'ssl ssl-view', 'data-locale': currentLocale },
            h('div', { className: 'ssl-view-head' },
              h(Seal, { name: seal, size: 'sm' }),
              h('div', null,
                h('div', { className: 'ssl-h1', style: { fontSize: '17px' } }, title),
                h('div', { className: 'ssl-caption' }, sub))),
            children,
            toast));
      }

      // ---------- 头部视图「朝堂职位」 ----------
      function CourtView() {
        useLocale();
        const { state, error, refresh } = useCourtState();
        const [toastNode, notify] = useToast();
        return h(ViewFrame, { seal: 'roster', title: t('viewRoster'), sub: t('viewRosterSub'), toast: toastNode },
          state ? h(CourtRoster, { state, onRefresh: refresh, notify }) : h(LoadingCard, { error }));
      }

      // ---------- 头部视图「确定工作流」 ----------
      function WorkflowView() {
        useLocale();
        const { state, error, refresh } = useCourtState();
        const [toastNode, notify] = useToast();
        const [steps, setStepsRaw] = useState(null);
        const [brief, setBrief] = useState('');
        const [decree, setDecree] = useState(emptyDecree);
        const saveTimer = useRef(null);
        const { sending, stamp, submit } = useEdictSubmit({ notify, onDone: () => { refresh(); openPane(PANE_CHAT); } });

        // 第一次拿到宿主状态时载入流程；宿主里没有、浏览器里有老存档就搬过去
        useEffect(() => {
          if (!state || steps !== null) return;
          const legacy = state.workflow && state.workflow.length ? [] : takeLegacyWorkflow();
          if (legacy.length) {
            setStepsRaw(legacy);
            apiJson('/workflow', { method: 'PUT', body: JSON.stringify({ workflow: legacy }) }).catch(() => {});
          } else setStepsRaw(state.workflow || []);
        }, [state, steps]);

        const setSteps = next => {
          setStepsRaw(next);
          clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => {
            apiJson('/workflow', { method: 'PUT', body: JSON.stringify({ workflow: next }) })
              .then(refresh)
              .catch(err => notify(String(err.message || err), 'err'));
          }, 400);
        };
        if (!state || steps === null) return h(ViewFrame, { seal: 'flow', title: t('viewFlow'), sub: '', toast: toastNode }, h(LoadingCard, { error }));

        const ministries = state.ministries || [];
        const titleOf = id => roleName(id);
        const dutyOf = id => roleDuty(id, (state.roles[id] || {}).duty);
        const full = state.full === true;
        const autonomous = state.rules && state.rules.autonomous === true;
        const update = (index, patch) => setSteps(steps.map((item, i) => (i === index ? { ...item, ...patch } : item)));
        const move = (index, delta) => {
          const target = index + delta;
          if (target < 0 || target >= steps.length) return;
          const next = steps.slice();
          [next[index], next[target]] = [next[target], next[index]];
          setSteps(next);
        };
        const send = () => {
          if (!brief.trim() || full) return;
          clearTimeout(saveTimer.current);
          submit({ brief, ...decreePayload({ ...decree, mode: '' }), workflow: steps }, () => { clearAfterStamp(setBrief, brief); setDecree(prev => ({ ...prev, attachments: [], criteria: '' })); });
        };
        const templates = state.workflowTemplates || {};
        const lang = isEn() ? 'en' : 'zh';

        const chain = [
          flowLabel(FLOW[0]), flowLabel(FLOW[1]),
          ...(steps.length ? steps.map(item => `${titleOf(item.ministry)} · ${item.title || dutyOf(item.ministry).split(/[，、：,;]/)[0]}`) : [t('chainFree')]),
          flowLabel(FLOW[4]), autonomous ? t('chainAuto') : flowLabel(FLOW[5]),
        ];

        return h(ViewFrame, { seal: 'flow', title: t('viewFlow'), sub: t('viewFlowSub'), toast: toastNode },
          h(Section, { title: t('fixedFlow'), note: steps.length ? t('fixedFlowN', { n: steps.length }) : t('fixedFlowNone') }),
          h('div', { className: 'ssl-card' },
            h('div', { className: 'ssl-between', style: { flexWrap: 'wrap', marginBottom: '12px' } },
              h('div', { className: 'ssl-actions' },
                h('span', { className: 'ssl-caption' }, t('templates')),
                Object.entries(templates).map(([key, template]) => h('button', {
                  key, className: 'ssl-chip', onClick: () => setSteps(template.steps.map(item => ({ ministry: item.ministry, title: item.title[lang] || item.title.zh }))),
                }, template.name[lang] || template.name.zh)),
                h('button', { className: 'ssl-chip', onClick: () => setSteps([]) }, t('clearFlow'))),
              h('span', { className: 'ssl-caption' }, t('flowMax'))),
            h('div', { className: 'ssl-chain' }, chain.map((text, index) => h(React.Fragment, { key: index },
              index ? h('span', { className: 'ssl-chain-arrow' }, '→') : null,
              h('span', { className: cx('ssl-chain-node', (index < 2 || index >= chain.length - 2) && 'is-fixed') }, text)))),
            steps.length ? h('div', { className: 'ssl-wf' }, steps.map((item, index) => h('div', { key: index, className: 'ssl-wf-row' },
              h('span', { className: 'ssl-step-no' }, index + 1),
              h('select', {
                className: 'ssl-input', value: item.ministry, 'aria-label': t('stepMinistryAria', { n: index + 1 }),
                onChange: event => update(index, { ministry: event.target.value }),
              }, ministries.map(m => h('option', { key: m.id, value: m.id }, titleOf(m.id)))),
              h('input', {
                className: 'ssl-input', value: item.title, placeholder: dutyOf(item.ministry), 'aria-label': t('stepTitleAria', { n: index + 1 }),
                onChange: event => update(index, { title: event.target.value }),
              }),
              h('div', { className: 'ssl-actions', style: { flexWrap: 'nowrap', gap: '2px' } },
                h('button', { className: 'ssl-btn ssl-btn--ghost ssl-btn--sm', title: t('moveUp'), disabled: index === 0, onClick: () => move(index, -1) }, '↑'),
                h('button', { className: 'ssl-btn ssl-btn--ghost ssl-btn--sm', title: t('moveDown'), disabled: index === steps.length - 1, onClick: () => move(index, 1) }, '↓'),
                h('button', { className: 'ssl-btn ssl-btn--ghost ssl-btn--sm', title: t('remove'), onClick: () => setSteps(steps.filter((_, i) => i !== index)) }, '✕')))))
              : h('div', { className: 'ssl-empty' }, t('flowEmpty')),
            h('div', { style: { marginTop: '10px' } },
              h('button', {
                className: 'ssl-btn ssl-btn--sm', disabled: steps.length >= 12,
                onClick: () => setSteps([...steps, { ministry: 'war', title: '' }]),
              }, t('addStep')))),
          h(Section, { title: t('issueTitle'), note: t('issueByFlow') }),
          h('div', { className: 'ssl-card' }, h(Composer, {
            value: brief,
            onChange: setBrief,
            onSubmit: send,
            canSubmit: !full && !sending && !!brief.trim(),
            sending,
            stamp,
            placeholder: t('briefPhVideo'),
            extra: h(DecreeBar, { state, value: decree, onChange: setDecree, brief, notify, withMode: false }),
            caption: full ? t('fullCaption', { n: state.capacity || 2 }) : autonomous ? t('flowAutoCaption') : t('flowCaption'),
          })),
          h(Section, { title: t('rulesTitle') }),
          h(RulesCard, { state, onSave: (patch, okText) => savePresetPatch(state, patch, refresh, notify, okText) }));
      }

      // ---------- 右侧面板「政令执行」 ----------
      function ExecPane() {
        useLocale();
        usePaneMounted();
        const { state, error, refresh } = useCourtState();
        const [toastNode, notify] = useToast();
        const current = pickEdict(state);
        const [detail, pull] = useEdictDetail(current && current.id);
        const act = (action, okText) => apiJson(`/edicts/${current.id}/${action}`, { method: 'POST', body: '{}' })
          .then(() => { notify(okText); refresh(); pull(); })
          .catch(err => notify(String(err.message || err), 'err'));

        let body;
        if (!state) body = h(LoadingCard, { error });
        else if (!current) body = h('div', { className: 'ssl-card ssl-empty' }, t('paneExecEmpty'));
        else {
          const view = detail || current;
          const see = powerOfState(state).see;
          const merges = detail && detail.git && detail.git.finalized && !detail.git.empty && !detail.git.merged && !detail.git.discarded;
          const waiting = detail ? detail.steps.filter(step => step.status === 'awaiting-input') : [];
          body = h('div', { className: 'ssl-stack' },
            h('div', { className: 'ssl-card' },
              h('p', { className: 'ssl-brief', style: { fontSize: '14px' } }, view.brief),
              h('div', { className: 'ssl-meta' },
                h(StatusPill, { status: view.status }),
                view.autonomous ? h('span', { className: 'ssl-pill ssl-pill--ok' }, t('autoPill')) : null,
                detail && detail.git ? h('span', { className: 'ssl-branch', title: detail.isolationNote }, detail.git.branch) : null,
                view.note ? h('span', null, view.note) : null),
              see >= 2 ? h('div', { style: { margin: '14px 0 2px' } }, h(Flow, { edict: view })) : null,
              detail && see >= 2 ? h(Narrator, { detail }) : null,
              detail && see >= 4 ? h(Panorama, { detail, compact: true }) : null,
              see < 3 && isLive(view.status) ? h('div', { style: { marginTop: '10px' } }, h(Veil, { state, need: see < 2 ? 2 : 3, what: see < 2 ? zhEn('办到哪一步', 'Which stage it is at') : zhEn('各部此刻在办什么', 'What each office is doing'), compact: true })) : null,
              view.error ? h('div', { className: 'ssl-alert' }, view.error) : null,
              h('div', { className: 'ssl-actions', style: { marginTop: '12px' } },
                view.status === 'awaiting-approval' ? h('button', { className: 'ssl-btn ssl-btn--seal ssl-btn--sm', onClick: () => act('approve', merges ? t('approvedMergedToast') : t('approvedToast')) }, merges ? t('approveMerge') : t('approve')) : null,
                isLive(view.status) ? h('button', { className: 'ssl-btn ssl-btn--sm', onClick: () => act('cancel', t('haltedToast')) }, t('halt')) : null,
                h('button', { className: 'ssl-btn ssl-btn--ghost ssl-btn--sm', onClick: () => openPane(PANE_CHAT) }, t('openChat')))),
            waiting.map(step => h(FillCard, { key: step.seq, edictId: detail.id, step, notify, onDone: pull, compact: true })),
            see >= 3 && detail && detail.live && detail.live.length ? h('div', { className: 'ssl-card' },
              h('div', { className: 'ssl-card-h' }, h('h4', { className: 'ssl-card-t' }, t('liveNow')), h(StatusPill, { status: 'running', text: t('rolesN', { n: detail.live.length }) })),
              detail.live.map(item => h('div', { key: item.callId || item.roleId, style: { marginTop: '6px' } },
                h('div', { className: 'ssl-between' },
                  h('b', { style: { fontSize: '12.5px' } }, `${roleName(item.roleId)} · ${kindLabel(item.kind)}`),
                  h('span', { className: 'ssl-caption' }, fmtElapsed(item.elapsedMs))),
                h('div', { className: 'ssl-caption ssl-ellipsis' }, `${item.agent}${item.model ? ` · ${item.model}` : ''}${item.title ? ` · ${item.title}` : ''}`),
                h(Activity, { item, state, compact: true })))) : null,
            h('div', { className: 'ssl-card' },
              h('div', { className: 'ssl-card-h' },
                h('h4', { className: 'ssl-card-t' }, t('stepsTitle')),
                h('span', { className: 'ssl-caption' }, view.steps && view.steps.length ? t('stepsDone', { done: view.steps.filter(step => step.status === 'done').length, n: view.steps.length }) : '')),
              view.steps && view.steps.length ? h(StepList, { steps: view.steps, edictStatus: view.status }) : h('div', { className: 'ssl-empty' }, t('notDispatched'))));
        }
        return h('div', { className: 'ssl-scroll' }, h('div', { className: 'ssl ssl-pane', 'data-locale': currentLocale }, body, toastNode));
      }

      // ---------- 右侧面板「各部门沟通」：公文往来按群聊排开 ----------
      const DEPT_COLORS = ['#b4362b', '#2e6f9e', '#7d4a9e', '#1f8a70', '#c27c0e', '#a0442a', '#8e2f2f', '#4f6372', '#3f7d3a'];
      const DEPT_FIXED = { emperor: '#c9a227', zhongshu: '#b4362b', menxia: '#2e6f9e', shangshu: '#7d4a9e', ministries: '#5d5348' };
      function deptColor(key) {
        const id = partyId(key);
        if (DEPT_FIXED[id]) return DEPT_FIXED[id];
        let hash = 0;
        for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
        return DEPT_COLORS[hash % DEPT_COLORS.length];
      }

      function Avatar({ party }) {
        const glyph = roleGlyph(party);
        return h('span', { className: cx('ssl-avatar', latinClass(glyph)), style: { background: deptColor(party), fontSize: glyph.length > 2 ? '9px' : null } }, glyph);
      }

      function ChatPane() {
        useLocale();
        usePaneMounted();
        const { state, refresh } = useCourtState();
        const [toastNode, notify] = useToast();
        const [picked, setPicked] = useState('');
        const auto = pickEdict(state);
        const edictId = picked || (auto && auto.id) || '';
        const [detail] = useEdictDetail(edictId);
        const [doc, setDoc] = useState(null);
        const [draft, setDraft] = useState('');
        const listRef = useRef(null);
        const stick = useRef(true);
        const messages = (detail && detail.messages) || [];
        const live = (detail && detail.live) || [];
        const liveKey = live.map(item => item.tail.length).join(',');
        const { sending, stamp, submit } = useEdictSubmit({
          notify,
          onDone: () => { setPicked(''); stick.current = true; refresh(); },
        });

        // 有新消息时滚到底；用户往上翻看时不打扰
        useEffect(() => {
          const el = listRef.current;
          if (el && stick.current) el.scrollTop = el.scrollHeight;
        }, [messages.length, liveKey, edictId]);

        const full = state && state.full === true;
        const send = () => {
          if (!draft.trim() || full) return;
          submit({ brief: draft }, () => clearAfterStamp(setDraft, draft));
        };
        const openDoc = name => apiJson(`/artifact?id=${encodeURIComponent(edictId)}&name=${encodeURIComponent(name)}`)
          .then(data => setDoc({ name, text: data.text || '' }))
          .catch(err => notify(String(err.message || err), 'err'));

        const waiting = detail ? detail.steps.filter(step => step.status === 'awaiting-input') : [];
        const workflowSteps = (state && state.workflow) || [];

        return h('div', { className: 'ssl ssl-chat', 'data-locale': currentLocale },
          h('div', { className: 'ssl-chat-head' },
            state && state.edicts.length ? h('select', {
              className: 'ssl-input', value: edictId, 'aria-label': t('pickEdictAria'),
              onChange: event => { setPicked(event.target.value); stick.current = true; setDoc(null); },
            }, state.edicts.slice(0, 15).map(item => h('option', { key: item.id, value: item.id },
              `${statusLabel(item.status)} | ${item.brief.slice(0, 28)}`)))
              : h('span', { className: 'ssl-caption' }, t('noEdictsShort')),
            detail ? h(StatusPill, { status: detail.status }) : null),
          h('div', {
            className: 'ssl-chat-list', ref: listRef,
            onScroll: event => {
              const el = event.currentTarget;
              stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            },
          },
          !edictId ? h('div', { className: 'ssl-empty' }, t('chatEmpty'))
            : !messages.length && !live.length ? h('div', { className: 'ssl-empty' }, t('waitingReports'))
            : null,
          // 各部之间的往来要到三巨头才看得见
          state && powerOfState(state).see < 4 && edictId ? h(Veil, { state, need: 4, what: zhEn('各部之间的往来', 'Dispatches between offices') })
            : messages.map(item => h(DispatchBubble, { key: item.seq, item, onOpen: openDoc })),
          state && powerOfState(state).see >= 3 ? live.map(item => h(LiveBubble, { key: `live-${item.callId || item.roleId}`, item })) : null,
          waiting.map(step => h('div', { key: `fill-${step.seq}`, style: { margin: '4px 0 14px' } },
            h(FillCard, { edictId: detail.id, step, notify, compact: true, onOpen: openDoc })))),
          h('div', { className: 'ssl-chat-compose' }, h(Composer, {
            compact: true,
            value: draft,
            onChange: setDraft,
            onSubmit: send,
            canSubmit: !full && !sending && !!draft.trim(),
            disabled: full,
            sending,
            stamp,
            placeholder: full ? t('fullShort') : t('chatPh'),
            caption: workflowSteps.length ? t('chatFlowN', { n: workflowSteps.length }) : t('chatFlowFree'),
          })),
          doc ? h('div', { className: 'ssl-chat-doc' },
            h('div', { className: 'ssl-card-h', style: { padding: '10px 12px', margin: 0, borderBottom: '1px solid var(--ssl-line)' } },
              h('h4', { className: 'ssl-card-t ssl-mono ssl-ellipsis' }, doc.name),
              h('button', { className: 'ssl-btn ssl-btn--ghost ssl-btn--sm', onClick: () => setDoc(null) }, t('close'))),
            h('pre', { className: 'ssl-doc', style: { margin: '10px', flex: 1, maxHeight: 'none' } }, doc.text || t('emptyDoc'))) : null,
          toastNode);
      }

      /** 右侧面板「+」页里的入口图标：一枚小印章（中文是汉字，英文是拉丁缩写） */
      const sealIcon = name => function SealIcon({ size = 22, className }) {
        useLocale();
        const text = sealText(name);
        const latin = /^[A-Z]+$/.test(text);
        return h('svg', { width: size, height: size, viewBox: '0 0 24 24', className, 'aria-hidden': true },
          h('rect', { x: 1.5, y: 1.5, width: 21, height: 21, rx: 5, fill: '#b4362b' }),
          h('text', {
            x: 12, y: latin ? 15.2 : 16.6, textAnchor: 'middle', fontSize: latin ? (text.length > 3 ? 6.5 : 8) : 13, fontWeight: 700, fill: '#fff',
            fontFamily: latin ? 'Georgia, serif' : '"Noto Serif SC", "Songti SC", "STSong", serif',
          }, text));
      };
      const paneTitle = (seal, key) => function PaneTitle() {
        useLocale();
        return h('span', { className: 'ssl-overlay ssl-pane-title' }, h(Seal, { name: seal, size: 'xs' }), t(key));
      };
      function SideGlyph() {
        useLocale();
        return isEn()
          ? h('span', { style: { fontSize: '9px', fontWeight: 700, letterSpacing: '.04em', fontFamily: 'Georgia, serif' } }, 'SPQR')
          : h('span', { style: { fontSize: '13px', fontWeight: 700, fontFamily: '"Noto Serif SC", "Songti SC", "STSong", serif' } }, '三');
      }

      const PANES = [
        { id: `${SID}-exec`, kind: PANE_EXEC, label: 'paneExec', desc: 'paneExecDesc', order: 60, icon: sealIcon('exec'), body: ExecPane, title: paneTitle('exec', 'paneExec') },
        { id: `${SID}-chat`, kind: PANE_CHAT, label: 'paneChat', desc: 'paneChatDesc', order: 61, icon: sealIcon('chat'), body: ChatPane, title: paneTitle('chat', 'paneChat') },
      ];

      // ================= v0.7：国库、朝制、旁白、全景、文书房、实录 =================

      // 国库的币制：中文按汉制五铢钱（1 钱 = 1 分人民币，1 金 = 10000 钱），
      // 英文按罗马币制（1 sestertius = $0.01，4 sestertii = 1 denarius，25 denarii = 1 aureus = $1）。旁边永远写真实金额。
      let moneySettings = { currency: 'CNY', rate: 7.1 };

      function realMoney(usd) {
        const value = Number(usd) || 0;
        if (moneySettings.currency === 'USD') return `$${value.toFixed(value < 1 ? 4 : 2)}`;
        const cny = value * (Number(moneySettings.rate) || 7.1);
        return `¥${cny.toFixed(cny < 1 ? 3 : 2)}`;
      }

      /** 拆成币：[[币种, 枚数], …]，从大到小 */
      function coinsOf(usd) {
        const value = Math.max(0, Number(usd) || 0);
        if (isEn()) {
          const sest = Math.round(value * 100);
          const aurei = Math.floor(sest / 100);
          const denarii = Math.floor((sest % 100) / 4);
          const rest = sest % 4;
          const out = [];
          if (aurei) out.push(['aureus', aurei]);
          if (denarii) out.push(['denarius', denarii]);
          if (rest || !out.length) out.push(['sestertius', rest]);
          return out;
        }
        const qian = Math.round(value * (Number(moneySettings.rate) || 7.1) * 100);
        const jin = Math.floor(qian / 10000);
        const out = [];
        if (jin) out.push(['jin', jin]);
        out.push(['wuzhu', qian % 10000]);
        return out;
      }

      const COIN_NAME = {
        jin: ['金', 'gold'], wuzhu: ['钱', 'coins'], aureus: ['aureus', 'aurei'], denarius: ['denarius', 'denarii'], sestertius: ['sestertius', 'sestertii'],
      };

      /** 一枚币的样子：五铢钱外圆内方、马蹄金、罗马金银铜币（月桂环 + 铭文） */
      function Coin({ type, size = 16 }) {
        const s = size;
        if (type === 'wuzhu') {
          return h('svg', { width: s, height: s, viewBox: '0 0 24 24', 'aria-hidden': true, className: 'ssl-coin' },
            h('defs', null, h('radialGradient', { id: 'wz', cx: '35%', cy: '30%' }, h('stop', { offset: '0', stopColor: '#d9b77a' }), h('stop', { offset: '1', stopColor: '#7d5a2b' }))),
            h('circle', { cx: 12, cy: 12, r: 11, fill: 'url(#wz)', stroke: '#5e421d', strokeWidth: 1 }),
            h('circle', { cx: 12, cy: 12, r: 9, fill: 'none', stroke: '#5e421d', strokeWidth: 0.6, opacity: 0.6 }),
            h('rect', { x: 9, y: 9, width: 6, height: 6, fill: 'var(--ssl-panel, #fff)', stroke: '#5e421d', strokeWidth: 0.8 }),
            h('text', { x: 17.6, y: 13.6, fontSize: 4.6, fill: '#3d2a10', textAnchor: 'middle', fontFamily: 'serif', fontWeight: 700 }, '五'),
            h('text', { x: 6.4, y: 13.6, fontSize: 4.6, fill: '#3d2a10', textAnchor: 'middle', fontFamily: 'serif', fontWeight: 700 }, '銖'));
        }
        if (type === 'jin') {
          return h('svg', { width: s, height: s, viewBox: '0 0 24 24', 'aria-hidden': true, className: 'ssl-coin' },
            h('ellipse', { cx: 12, cy: 14, rx: 10.5, ry: 7, fill: '#e2b23c', stroke: '#8a6412', strokeWidth: 1 }),
            h('ellipse', { cx: 12, cy: 11.5, rx: 6.5, ry: 4, fill: '#f6d878', stroke: '#8a6412', strokeWidth: 0.8 }),
            h('text', { x: 12, y: 13.4, fontSize: 5.2, fill: '#6b4a08', textAnchor: 'middle', fontFamily: 'serif', fontWeight: 700 }, '金'));
        }
        const metal = { aureus: ['#f3d27a', '#a87b16', '#5c3f05'], denarius: ['#f1f1f1', '#9a9a9a', '#4a4a4a'], sestertius: ['#d79a64', '#8a5525', '#4a2a10'] }[type] || ['#ccc', '#888', '#333'];
        const label = { aureus: 'AVG', denarius: 'SPQR', sestertius: 'S C' }[type] || '';
        return h('svg', { width: s, height: s, viewBox: '0 0 24 24', 'aria-hidden': true, className: 'ssl-coin' },
          h('defs', null, h('radialGradient', { id: `rc-${type}`, cx: '35%', cy: '30%' }, h('stop', { offset: '0', stopColor: metal[0] }), h('stop', { offset: '1', stopColor: metal[1] }))),
          h('circle', { cx: 12, cy: 12, r: 11, fill: `url(#rc-${type})`, stroke: metal[2], strokeWidth: 1 }),
          h('circle', { cx: 12, cy: 12, r: 8.6, fill: 'none', stroke: metal[2], strokeWidth: 0.9, strokeDasharray: '1.6 1.1', opacity: 0.75 }),
          h('text', { x: 12, y: 14, fontSize: label.length > 3 ? 4.6 : 5.4, fill: metal[2], textAnchor: 'middle', fontFamily: 'Georgia, serif', fontWeight: 700 }, label));
      }

      /** 金额：币 + 真实货币；estimated 时标「估」 */
      function Money({ usd, estimated, compact, big }) {
        const coins = coinsOf(usd);
        const size = big ? 22 : 14;
        return h('span', { className: cx('ssl-money', big && 'is-big'), title: `${realMoney(usd)}${estimated ? ` · ${t('estimatedTag')}` : ''} · $${(Number(usd) || 0).toFixed(5)}` },
          coins.slice(0, compact ? 2 : 3).map(([type, count]) => h('span', { key: type, className: 'ssl-money-coin' },
            h(Coin, { type, size }), h('b', null, count.toLocaleString()), compact ? null : h('i', null, COIN_NAME[type][isEn() ? (count === 1 ? 0 : 1) : 0]))),
          h('span', { className: 'ssl-money-real' }, realMoney(usd)),
          estimated ? h('span', { className: 'ssl-money-est' }, t('estimatedTag')) : null);
      }

      const fmtTokens = n => {
        const value = Number(n) || 0;
        if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
        if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
        return String(value);
      };
      const pct = value => `${Math.round((Number(value) || 0) * 100)}%`;

      // ---------- 朝制 ----------
      const MODE_TONE = { express: 'ok', standard: 'plain', grand: 'seal' };
      function ModePill({ detail }) {
        const mode = detail.mode || 'standard';
        return h('span', { className: cx('ssl-pill', `ssl-pill--${MODE_TONE[mode] || 'plain'}`), title: t(`modeDesc_${mode}`) }, t(`mode_${mode}`));
      }

      /** 下旨前选朝制，并按国库历史均价估一下要花多少 */
      function ModePicker({ mode, setMode, brief }) {
        const [estimate, setEstimate] = useState(null);
        useEffect(() => {
          if (!String(brief || '').trim()) { setEstimate(null); return undefined; }
          const timer = setTimeout(() => {
            apiJson('/estimate', { method: 'POST', body: JSON.stringify({ brief, mode: mode || undefined, locale: currentLocale }) })
              .then(setEstimate)
              .catch(() => setEstimate(null));
          }, 450);
          return () => clearTimeout(timer);
        }, [brief, mode]);
        return h('div', { className: 'ssl-field', style: { flexBasis: '100%' } },
          h('span', { className: 'ssl-label' }, t('fieldMode')),
          h('div', { className: 'ssl-modes' },
            ['', 'express', 'standard', 'grand'].map(value => h('button', {
              key: value || 'auto', type: 'button', className: cx('ssl-chip', (mode || '') === value && 'is-active'), title: t(`modeDesc_${value || 'auto'}`),
              onClick: () => setMode(value),
            }, t(`mode_${value || 'auto'}`))),
            estimate ? h('span', { className: 'ssl-estimate' },
              t('estimateLine', {
                mode: t(`mode_${estimate.mode}`),
                calls: estimate.calls[0] === estimate.calls[1] ? estimate.calls[0] : `${estimate.calls[0]}–${estimate.calls[1]}`,
                ministry: estimate.ministry ? ` → ${roleName(estimate.ministry)}` : '',
              }),
              h(Money, { usd: estimate.usd[0], compact: true }), '–', h(Money, { usd: estimate.usd[1], compact: true }),
              h('i', { title: estimate.reason }, estimate.basis === 'history' ? t('basisHistory') : t('basisDefault'))) : null));
      }

      // ---------- 旁白：此刻发生着什么，一句话 ----------
      function narrate(detail) {
        const live = detail.live || [];
        if (live.length) {
          return live.map(item => t('narrateLive', {
            role: roleName(item.roleId), kind: kindLabel(item.kind), title: item.title ? `「${item.title}」` : '', time: fmtElapsed(item.elapsedMs),
            agent: `${item.agent}${item.model ? ` · ${item.model}` : ''}`,
          })).join(isEn() ? '; ' : '；');
        }
        const waiting = (detail.steps || []).filter(step => step.status === 'awaiting-input');
        if (waiting.length) return t('narrateWaiting', { list: waiting.map(step => `${roleName(step.ministry)}「${step.title}」`).join(isEn() ? ', ' : '、') });
        if (detail.status === 'awaiting-approval') return t('narrateSeal');
        return detail.note || '';
      }
      function Narrator({ detail }) {
        const text = narrate(detail);
        if (!text) return null;
        return h('div', { className: cx('ssl-narrator', isLive(detail.status) && 'is-live') },
          h('span', { className: cx('ssl-dot', isLive(detail.status) && 'ssl-dot--pulse') }),
          h('span', null, text));
      }

      // ---------- 朝会全景：每个岗位一条泳道，每次调用一根条，看得出谁在何时并行、哪里被封驳 / 弹劾 / 重办 ----------
      const LANE_ORDER = ['emperor', 'zhongshu', 'menxia', 'shangshu', ...MINISTRY_IDS, 'yushi', 'jinyiwei', 'historian'];
      const MARK_KINDS = { veto: 'zhongshu', impeach: null, admonish: null, guard: null, fill: null };
      function Panorama({ detail, compact, onOpen }) {
        const [, tick] = useState(0);
        const live = isLive(detail.status);
        useEffect(() => {
          if (!live) return undefined;
          const timer = setInterval(() => tick(n => n + 1), 1000);
          return () => clearInterval(timer);
        }, [live]);
        const calls = detail.calls || [];
        if (!calls.length) return null;
        const start = Math.min(detail.createdAt || Infinity, ...calls.map(call => call.startedAt));
        const marks = (detail.messages || []).filter(item => item.kind in MARK_KINDS);
        const end = Math.max(live ? Date.now() : 0, ...calls.map(call => call.endedAt || Date.now()), ...marks.map(item => item.at), start + 1000);
        const span = end - start;
        const x = ts => `${Math.max(0, Math.min(100, ((ts - start) / span) * 100))}%`;
        const lanes = LANE_ORDER.filter(id => calls.some(call => call.roleId === id) || marks.some(item => partyId(item.to) === id));
        const barClass = call => (!call.endedAt ? 'is-live'
          : call.outcome === 'vetoed' ? 'is-veto'
          : call.outcome === 'retried' ? 'is-retry'
          : call.outcome === 'failed' || call.ok === false ? 'is-fail'
          : call.outcome === 'discarded' ? 'is-waste'
          : 'is-ok');
        const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ left: `${f * 100}%`, label: fmtElapsed(span * f) }));
        const total = calls.length;
        const parallelPeak = (() => {
          let peak = 0;
          for (const call of calls) {
            const at = call.startedAt;
            peak = Math.max(peak, calls.filter(other => other.startedAt <= at && (other.endedAt || Date.now()) > at).length);
          }
          return peak;
        })();
        return h('div', { className: cx('ssl-card ssl-pano', compact && 'is-compact') },
          compact ? null : h('div', { className: 'ssl-card-h' },
            h('h4', { className: 'ssl-card-t' }, t('panoTitle')),
            h('span', { className: 'ssl-caption' }, t('panoMeta', { calls: total, peak: parallelPeak, time: fmtElapsed(span) }))),
          h('div', { className: 'ssl-pano-grid' },
            lanes.map(id => h(React.Fragment, { key: id },
              h('div', { className: 'ssl-pano-lane' }, h('span', { className: cx('ssl-pano-glyph', latinClass(roleGlyph(id))), style: { background: deptColor(id) } }, roleGlyph(id)), compact ? null : h('span', { className: 'ssl-ellipsis' }, roleName(id))),
              h('div', { className: 'ssl-pano-track' },
                calls.filter(call => call.roleId === id).map(call => h('button', {
                  key: call.id, type: 'button', className: cx('ssl-pano-bar', barClass(call), call.resumed && 'is-resumed'),
                  style: { left: x(call.startedAt), width: `max(4px, calc(${x(call.endedAt || Date.now())} - ${x(call.startedAt)}))` },
                  title: [
                    `${kindLabel(call.kind)}${call.title ? ` · ${call.title}` : ''}`,
                    `${call.agentName || ''}${call.model ? ` · ${call.model}` : ''}${call.resumed ? ` · ${t('resumedTag')}` : ''}`,
                    `${fmtElapsed((call.endedAt || Date.now()) - call.startedAt)} · ${fmtTokens(call.input + call.output + call.cacheRead + call.cacheWrite)} tok · ${realMoney(call.costUsd)}${call.estimated ? ` (${t('estimatedTag')})` : ''}`,
                    call.outcome && call.outcome !== 'used' ? t(`outcome_${call.outcome}`) : '',
                  ].filter(Boolean).join('\n'),
                  onClick: () => onOpen && call.artifact && onOpen(call.artifact),
                })),
                marks.filter(item => partyId(item.to) === id).map(item => h('span', {
                  key: `m${item.seq}`, className: cx('ssl-pano-mark', `is-${item.kind}`), style: { left: x(item.at) },
                  title: `${kindLabel(item.kind)} · ${prettySummary(item.summary).slice(0, 160)}`,
                }))))),
            h('div', null),
            h('div', { className: 'ssl-pano-axis' }, ticks.map(item => h('span', { key: item.left, style: { left: item.left } }, item.label)))),
          compact ? null : h('div', { className: 'ssl-pano-legend' },
            [['is-ok', 'legendOk'], ['is-live', 'legendLive'], ['is-veto', 'legendVeto'], ['is-retry', 'legendRetry'], ['is-fail', 'legendFail'], ['is-resumed', 'legendResumed']]
              .map(([klass, key]) => h('span', { key }, h('i', { className: cx('ssl-pano-bar', klass) }), t(key))),
            h('span', null, h('i', { className: 'ssl-pano-mark is-impeach' }), t('legendMark'))));
      }

      // ---------- 文书房：改了哪些文件、产出在不在，点开看内容或补丁 ----------
      function DiffView({ text }) {
        if (!text) return h('div', { className: 'ssl-empty' }, t('noDiff'));
        return h('pre', { className: 'ssl-doc ssl-diff' }, String(text).split('\n').slice(0, 2000).map((line, index) => h('span', {
          key: index,
          className: line.startsWith('+') && !line.startsWith('+++') ? 'add' : line.startsWith('-') && !line.startsWith('---') ? 'del' : line.startsWith('@@') ? 'hunk' : '',
        }, `${line}\n`)));
      }

      /** 在系统里打开这道旨的产出：folder 打开文件夹 / reveal 在文件夹里选中 / open 用默认程序打开（只限文档、图片、音视频） */
      const openOnDisk = (edictId, rel, how, notify) => apiJson(`/edicts/${edictId}/open`, { method: 'POST', body: JSON.stringify({ path: rel || '', how }) })
        .catch(error => notify(String(error.message || error), 'err'));
      function OpenFolderButton({ edictId, notify, className }) {
        return h('button', {
          className: className || 'ssl-btn ssl-btn--ghost', title: zhEn('在资源管理器里打开这道旨的工作目录', 'Open this decree’s folder in your file manager'),
          onClick: () => openOnDisk(edictId, '', 'folder', notify),
        }, zhEn('打开产出文件夹', 'Open output folder'));
      }

      function FilesCard({ detail, notify }) {
        const [files, setFiles] = useState(null);
        const [open, setOpen] = useState(null);
        const live = isLive(detail.status);
        const load = useCallback(() => apiJson(`/edicts/${detail.id}/files`).then(setFiles).catch(() => {}), [detail.id]);
        useEffect(() => {
          load();
          if (!live) return undefined;
          const timer = setInterval(load, 5000);
          return () => clearInterval(timer);
        }, [load, live, detail.status]);
        const show = (rel, diff) => apiJson(`/edicts/${detail.id}/file?path=${encodeURIComponent(rel)}&diff=${diff ? 1 : 0}`)
          .then(data => setOpen({ ...data, rel }))
          .catch(error => notify(String(error.message || error), 'err'));
        if (!files) return null;
        const { changed, deliverables } = files;
        const missing = deliverables.filter(item => !item.exists).length;
        const onDisk = !!files.folder;
        return h('div', { className: 'ssl-card' },
          h('div', { className: 'ssl-card-h' },
            h('div', { className: 'ssl-grow' },
              h('h4', { className: 'ssl-card-t' }, t('filesTitle')),
              h('div', { className: 'ssl-caption' }, t(`filesSource_${files.source}`))),
            missing ? h('span', { className: 'ssl-pill ssl-pill--err' }, t('missingN', { n: missing })) : deliverables.length ? h('span', { className: 'ssl-pill ssl-pill--ok' }, t('allDelivered')) : null),
          // 产出在磁盘上的哪个文件夹，一键在资源管理器里打开
          h('div', { className: 'ssl-files-where' },
            h('span', { className: 'ssl-mono ssl-ellipsis ssl-grow', title: files.folder || files.workspace }, files.folder || files.workspace || ''),
            onDisk ? h(OpenFolderButton, { edictId: detail.id, notify, className: 'ssl-btn ssl-btn--sm' })
              : h('span', { className: 'ssl-caption' }, zhEn('批红合并后才落到这里', 'Lands here once sealed and merged'))),
          !changed.length && !deliverables.length ? h('div', { className: 'ssl-caption' }, zhEn('还没有文件改动；文字类成果直接写在回奏里。', 'No files changed yet; text results are in the report itself.')) : null,
          deliverables.length ? h('div', { className: 'ssl-files', style: { marginBottom: '10px' } }, deliverables.map(item => h('button', {
            key: item.path, className: cx('ssl-file', !item.exists && 'is-missing'), title: item.exists ? t('deliverableOk') : t('deliverableMissing'),
            onClick: () => item.exists && show(item.path, false),
          }, `${item.exists ? '✓' : '✗'} ${item.path}`))) : null,
          changed.length ? h('div', { className: 'ssl-git-files' }, changed.slice(0, 60).map(item => h('div', { key: item.file, className: 'ssl-git-file' },
            h('span', { className: 'ssl-grow ssl-ellipsis', title: item.file }, item.file),
            item.binary ? h('span', { className: 'ssl-caption' }, 'bin') : h('span', null, h('span', { className: 'add' }, `+${item.add}`), ' ', h('span', { className: 'del' }, `-${item.del}`)),
            detail.git ? h('button', { className: 'ssl-link', onClick: () => show(item.file, true) }, t('viewDiff')) : null,
            h('button', { className: 'ssl-link', onClick: () => show(item.file, false) }, t('viewFile')),
            onDisk && item.openable ? h('button', { className: 'ssl-link', title: zhEn('用默认程序打开', 'Open with the default app'), onClick: () => openOnDisk(detail.id, item.file, 'open', notify) }, zhEn('打开', 'Open')) : null,
            onDisk ? h('button', { className: 'ssl-link', title: zhEn('在文件夹里选中它', 'Show it in its folder'), onClick: () => openOnDisk(detail.id, item.file, 'reveal', notify) }, zhEn('定位', 'Reveal')) : null))) : null,
          open ? h('div', { style: { marginTop: '12px' } },
            h('div', { className: 'ssl-between', style: { marginBottom: '6px' } },
              h('b', { className: 'ssl-mono' }, `${open.rel}${open.diff ? ' · diff' : ''}`),
              h('div', { className: 'ssl-actions' },
                detail.git ? h('button', { className: 'ssl-btn ssl-btn--ghost ssl-btn--sm', onClick: () => show(open.rel, !open.diff) }, open.diff ? t('viewFile') : t('viewDiff')) : null,
                h('button', { className: 'ssl-btn ssl-btn--ghost ssl-btn--sm', onClick: () => setOpen(null) }, t('close')))),
            open.diff ? h(DiffView, { text: open.text }) : h('pre', { className: 'ssl-doc' }, open.text === null ? t('fileGone') : open.text || t('emptyDoc'))) : null);
      }

      // ---------- 实录：仿 LLM Wiki 的长期记忆，可读、可改、可追溯 ----------
      /** 实录页的标题：文件夹页写「文件夹：名字」，岗位页写「岗位：官名」 */
      function pageTitle(meta, rel) {
        if (/^offices\//.test(rel)) return zhEn(`岗位：${roleName(rel.replace(/^offices\/|\.md$/g, ''))}`, `Office: ${roleName(rel.replace(/^offices\/|\.md$/g, ''))}`);
        return zhEn(`文件夹：${(meta && meta.title) || rel}`, `Folder: ${(meta && meta.title) || rel}`);
      }

      /** 编年的一行（「2026-10-30 06:29 · ingest · edict-… [running] +0 · 圣意」，时间是 UTC）翻成白话、换成本地时间 */
      function wikiLogText(line) {
        const match = String(line).replace(/^- /, '').match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}) · (\w+) · (.*)$/);
        if (!match) return String(line).replace(/^- /, '');
        const at = new Date(`${match[1].replace(' ', 'T')}:00Z`).getTime();
        const when = Number.isNaN(at) ? match[1] : dateTimeText(at);
        const [, , action, rest] = match;
        let text = rest;
        if (action === 'ingest') {
          const x = rest.match(/\+(\d+)(?: · (.*))?$/);
          if (x) text = x[2] ? zhEn(`史官读完「${x[2]}」，记下 ${x[1]} 条`, `Read “${x[2]}”, noted ${x[1]}`) : zhEn(`史官记下 ${x[1]} 条`, `The annalist noted ${x[1]}`);
        } else if (action === 'settle') {
          const outcome = (rest.match(/→ (\w+)/) || [])[1];
          text = outcome === 'done' ? zhEn('你批红了，那道旨记下的条目转为可信 ✓', 'You sealed it; its notes are now trusted ✓')
            : outcome === 'rejected' ? zhEn('那道旨被驳回，记下的条目作废 ✗', 'That decree was rejected; its notes are void ✗')
            : zhEn('那道旨没办成，记下的条目仍待确认', 'That decree did not finish; its notes stay unconfirmed');
        } else if (action === 'lint') {
          text = zhEn(`整理了一遍（${(rest.match(/\d+/) || ['0'])[0]} 处）`, `Tidied up (${(rest.match(/\d+/) || ['0'])[0]} fixes)`);
        } else if (action === 'edit') {
          text = zhEn(`你改了 ${rest}`, `You edited ${rest}`);
        }
        return `${when} · ${text}`;
      }

      function WikiPanel({ notify }) {
        const [data, setData] = useState(null);
        const [current, setCurrent] = useState('');
        const [page, setPage] = useState(null);
        const [editing, setEditing] = useState(false);
        const [draft, setDraft] = useState('');
        const load = useCallback(() => apiJson('/wiki').then(next => {
          setData(next);
          if (!current && next.pages.length) setCurrent(next.pages[0].path);
        }).catch(error => notify(String(error.message || error), 'err')), [current]);
        useEffect(() => { load(); }, []);
        useEffect(() => {
          if (!current) return;
          setEditing(false);
          apiJson(`/wiki/page?path=${encodeURIComponent(current)}`).then(setPage).catch(() => setPage(null));
        }, [current]);
        const save = () => apiJson('/wiki/page', { method: 'PUT', body: JSON.stringify({ path: current, text: draft }) })
          .then(next => { setPage(next); setEditing(false); notify(t('wikiSaved')); load(); })
          .catch(error => notify(String(error.message || error), 'err'));
        const lint = () => apiJson('/wiki/lint', { method: 'POST', body: '{}' })
          .then(next => { setData(next); notify(t('wikiLinted', { n: next.issues.length })); if (current) apiJson(`/wiki/page?path=${encodeURIComponent(current)}`).then(setPage); })
          .catch(error => notify(String(error.message || error), 'err'));
        if (!data) return h(LoadingCard, {});
        const groups = [['projects', t('wikiProjects')], ['offices', t('wikiOffices')]];
        return h(React.Fragment, null,
          h(Section, {
            title: t('wikiTitle'), note: t('wikiNote'),
            right: h('button', { className: 'ssl-btn ssl-btn--ghost ssl-btn--sm', onClick: lint }, t('wikiLint')),
          }),
          data.pages.length ? h('div', { className: 'ssl-split' },
            h('div', { className: 'ssl-side' },
              groups.map(([group, label]) => {
                const list = data.pages.filter(item => item.group === group);
                if (!list.length) return null;
                return h('div', { key: group },
                  h('div', { className: 'ssl-caption', style: { padding: '4px 6px' } }, label),
                  h('div', { className: 'ssl-list' }, list.map(item => h('button', {
                    key: item.path, className: cx('ssl-item', current === item.path && 'is-active'), onClick: () => setCurrent(item.path),
                  },
                  h('div', { className: 'ssl-item-t ssl-ellipsis' }, group === 'offices' ? roleName(item.path.replace(/^offices\/|\.md$/g, '')) : item.title),
                  h('div', { className: 'ssl-item-m' }, h('span', null, t('wikiCounts', { n: item.count, v: item.verified })), h('span', null, item.updated))))));
              }),
              h('div', { className: 'ssl-caption', style: { padding: '10px 6px 4px' } }, t('wikiLog')),
              h('div', { className: 'ssl-wiki-log' }, data.log.slice(0, 30).map((line, index) => h('div', { key: index }, wikiLogText(line))))),
            h('div', { className: 'ssl-card' },
              page ? h(React.Fragment, null,
                h('div', { className: 'ssl-card-h' },
                  h('div', { className: 'ssl-grow' },
                    h('h4', { className: 'ssl-card-t' }, pageTitle(data.pages.find(item => item.path === page.path), page.path)),
                    h('div', { className: 'ssl-caption ssl-mono ssl-ellipsis' }, (data.pages.find(item => item.path === page.path) || {}).workspace || page.path)),
                  editing
                    ? h('div', { className: 'ssl-actions' },
                        h('button', { className: 'ssl-btn ssl-btn--primary ssl-btn--sm', onClick: save }, t('save')),
                        h('button', { className: 'ssl-btn ssl-btn--ghost ssl-btn--sm', onClick: () => setEditing(false) }, t('cancel')))
                    : h('button', { className: 'ssl-btn ssl-btn--sm', onClick: () => { setDraft(page.text); setEditing(true); } }, t('edit'))),
                editing
                  ? h('textarea', { className: 'ssl-input ssl-mono', style: { minHeight: '360px' }, value: draft, onChange: event => setDraft(event.target.value) })
                  : h(WikiView, { text: page.text }),
                h('div', { className: 'ssl-caption', style: { marginTop: '8px' } }, t('wikiLegend')))
                : h('div', { className: 'ssl-empty' }, t('loading'))))
            : h('div', { className: 'ssl-card ssl-empty' }, t('wikiEmpty')));
      }

      /** 实录页的阅读视图：标题、条目，出处与可信度做成小标签 */
      function WikiView({ text }) {
        const lines = String(text || '').replace(/^---[\s\S]*?---\n?/, '').split('\n');
        return h('div', { className: 'ssl-wiki' }, lines.map((line, index) => {
          if (/^#\s/.test(line)) return h('h3', { key: index }, line.replace(/^#\s+/, ''));
          if (/^##\s/.test(line)) return h('h4', { key: index }, line.replace(/^##\s+/, ''));
          const entry = line.match(/^-\s+(📌\s*)?(.*?)\s*〔([^〕]*)〕\s*$/);
          if (entry) {
            const [sources, mark = '?', date = ''] = entry[3].split('·').map(part => part.trim());
            return h('div', { key: index, className: cx('ssl-wiki-entry', mark === '✗' && 'is-refuted') },
              entry[1] ? h('span', { className: 'ssl-pill ssl-pill--seal' }, '📌') : null,
              h('span', { className: 'ssl-grow' }, entry[2]),
              h('span', { className: cx('ssl-pill', mark === '✓' ? 'ssl-pill--ok' : mark === '✗' ? 'ssl-pill--err' : 'ssl-pill--warn'), title: t(mark === '✓' ? 'markVerified' : mark === '✗' ? 'markRefuted' : 'markUnverified') }, mark),
              h('span', { className: 'ssl-caption ssl-mono', title: sources }, `${sources.split(',')[0]}${date ? ` · ${date}` : ''}`));
          }
          if (!line.trim()) return null;
          return h('p', { key: index, className: 'ssl-caption' }, line);
        }));
      }

      // ---------- 国库 ----------
      function Bars({ rows, value, label, money }) {
        const max = Math.max(...rows.map(value), 0.000001);
        return h('div', { className: 'ssl-bars' }, rows.map((row, index) => h('div', { key: index, className: 'ssl-bars-row' },
          h('span', { className: 'ssl-ellipsis' }, label(row)),
          h('div', { className: 'ssl-bars-track' }, h('i', { style: { width: `${(value(row) / max) * 100}%` } })),
          h('span', { className: 'ssl-bars-val' }, money ? realMoney(value(row)) : value(row)))));
      }

      function TreasuryTab({ state, onRefresh, notify }) {
        const [data, setData] = useState(null);
        const [settings, setSettings] = useState(null);
        const load = useCallback(() => apiJson('/treasury').then(next => { setData(next); setSettings(next.settings); }).catch(error => notify(String(error.message || error), 'err')), []);
        useEffect(() => {
          load();
          const timer = setInterval(load, 10000);
          return () => clearInterval(timer);
        }, [load]);
        if (!data || !settings) return h(LoadingCard, {});
        const { stats } = data;
        const totals = stats.totals;
        const tokensAll = totals.input + totals.output + totals.cacheRead + totals.cacheWrite;
        const save = patch => apiJson('/treasury', { method: 'PUT', body: JSON.stringify({ settings: patch }) })
          .then(next => { setData(next); setSettings(next.settings); moneySettings = next.settings; onRefresh(); notify(t('treasurySaved')); })
          .catch(error => notify(String(error.message || error), 'err'));
        const advice = [];
        if (totals.calls >= 5 && stats.wasteRate > 0.25) advice.push(t('adviceWaste', { p: pct(stats.wasteRate) }));
        if (totals.calls >= 10 && stats.cacheHitRate < 0.3) advice.push(t('adviceCache', { p: pct(stats.cacheHitRate) }));
        if (totals.estimatedCalls) advice.push(t('adviceEstimated', { n: totals.estimatedCalls }));
        if ((stats.waste.vetoed || 0) > (stats.waste.retried || 0) && stats.waste.vetoed > 0) advice.push(t('adviceVeto'));
        if (settings.budgetPerEdictUsd <= 0) advice.push(t('adviceBudget'));
        const days = stats.days;
        const maxDay = Math.max(...days.map(day => day.costUsd), 0.000001);
        const roles = Object.entries(stats.byRole).sort((a, b) => b[1].costUsd - a[1].costUsd);
        const agents = Object.entries(stats.byAgent).sort((a, b) => b[1].costUsd - a[1].costUsd);
        return h('div', null,
          h('div', { className: 'ssl-treasury-head ssl-card' },
            h(Seal, { name: 'treasury' }),
            h('div', { className: 'ssl-grow' },
              h('div', { className: 'ssl-caption' }, t('treasuryMonth')),
              h(Money, { usd: stats.monthUsd, big: true })),
            h('div', { className: 'ssl-grow' },
              h('div', { className: 'ssl-caption' }, t('treasuryToday')),
              h(Money, { usd: stats.todayUsd, big: true })),
            h('div', { className: 'ssl-grow' },
              h('div', { className: 'ssl-caption' }, t('treasuryAll')),
              h(Money, { usd: totals.costUsd, big: true }))),
          h('div', { className: 'ssl-kpis', style: { marginTop: '12px' } },
            [[fmtTokens(tokensAll), t('kpiTokens', { calls: totals.calls })],
              [pct(stats.cacheHitRate), t('kpiCache', { n: fmtTokens(totals.cacheRead) })],
              [realMoney(totals.savedUsd), t('kpiSaved')],
              [pct(stats.wasteRate), t('kpiWaste', { m: realMoney(totals.wasteUsd) })]]
              .map(([value, label]) => h('div', { key: label, className: 'ssl-kpi' }, h('b', null, value), h('span', null, label)))),
          advice.length ? h('div', { className: 'ssl-card', style: { marginTop: '12px' } },
            h('h4', { className: 'ssl-card-t', style: { marginBottom: '6px' } }, t('adviceTitle')),
            h('ul', { className: 'ssl-lessons' }, advice.map((item, index) => h('li', { key: index }, item)))) : null,
          h(Section, { title: t('daysTitle'), note: t('daysNote') }),
          h('div', { className: 'ssl-card' },
            h('div', { className: 'ssl-days' }, days.map(day => h('div', { key: day.day, className: 'ssl-day', title: `${day.day} · ${realMoney(day.costUsd)} · ${day.calls} calls · ${fmtTokens(day.tokens)} tok` },
              h('div', { className: 'ssl-day-bar' }, h('i', { style: { height: `${(day.costUsd / maxDay) * 100}%` } })),
              h('span', null, day.day.slice(8)))))),
          h('div', { className: 'ssl-cols', style: { marginTop: '12px' } },
            h('div', { className: 'ssl-card' },
              h('h4', { className: 'ssl-card-t', style: { marginBottom: '10px' } }, t('byRole')),
              roles.length ? h(Bars, { rows: roles, value: ([, row]) => row.costUsd, label: ([id, row]) => `${roleName(id)} · ${row.calls}`, money: true }) : h('div', { className: 'ssl-empty' }, t('none'))),
            h('div', { className: 'ssl-card' },
              h('h4', { className: 'ssl-card-t', style: { marginBottom: '10px' } }, t('wasteTitle')),
              Object.keys(stats.waste).length
                ? h(Bars, { rows: Object.entries(stats.waste), value: ([, usd]) => usd, label: ([kind]) => t(`outcome_${kind}`), money: true })
                : h('div', { className: 'ssl-empty' }, t('noWaste')),
              h('h4', { className: 'ssl-card-t', style: { margin: '16px 0 10px' } }, t('byAgent')),
              agents.length ? h(Bars, { rows: agents, value: ([, row]) => row.costUsd, label: ([name, row]) => `${name} · ${pct(row.tokens ? row.cacheRead / row.tokens : 0)} ${t('cacheShort')}`, money: true }) : h('div', { className: 'ssl-empty' }, t('none')))),
          h(Section, { title: t('ledgerTitle'), note: t('ledgerNote') }),
          h('div', { className: 'ssl-card', style: { overflowX: 'auto' } },
            stats.recent.length ? h('table', { className: 'ssl-table' },
              h('thead', null, h('tr', null, [t('colTime'), t('colOffice'), t('colModel'), t('colIn'), t('colCache'), t('colOut'), t('colCost'), t('colUse')].map(label => h('th', { key: label }, label)))),
              h('tbody', null, stats.recent.map(entry => h('tr', { key: entry.id, className: entry.outcome && entry.outcome !== 'used' ? 'is-waste' : '' },
                h('td', null, dateTimeText(entry.at)),
                h('td', { title: entry.brief }, `${roleName(entry.roleId)} · ${kindLabel(entry.kind)}`),
                h('td', { className: 'ssl-mono' }, entry.model || entry.agentName),
                h('td', null, fmtTokens(entry.input)),
                h('td', null, `${fmtTokens(entry.cacheRead)}${entry.cacheWrite ? ` +${fmtTokens(entry.cacheWrite)}` : ''}`),
                h('td', null, fmtTokens(entry.output)),
                h('td', null, h(Money, { usd: entry.costUsd, estimated: entry.estimated, compact: true })),
                h('td', null, t(`outcome_${entry.outcome || 'used'}`)))))) : h('div', { className: 'ssl-empty' }, t('ledgerEmpty'))),
          h(Section, { title: t('treasurySettings') }),
          h('div', { className: 'ssl-card' },
            h('div', { className: 'ssl-rules2', style: { borderTop: 0, marginTop: 0, paddingTop: 0 } },
              h('label', { className: 'ssl-field' },
                h('span', { className: 'ssl-label' }, t('fieldCurrency')),
                h('select', { className: 'ssl-input', value: settings.currency, onChange: event => save({ currency: event.target.value }) },
                  h('option', { value: 'CNY' }, 'CNY ¥'), h('option', { value: 'USD' }, 'USD $'))),
              h('label', { className: 'ssl-field' },
                h('span', { className: 'ssl-label' }, t('fieldRate')),
                h('input', { className: 'ssl-input', type: 'number', step: '0.01', defaultValue: settings.rate, onBlur: event => save({ rate: Number(event.target.value) }) })),
              h('label', { className: 'ssl-field' },
                h('span', { className: 'ssl-label' }, t('fieldBudgetEdict')),
                h('input', { className: 'ssl-input', type: 'number', step: '0.1', min: '0', defaultValue: settings.budgetPerEdictUsd, onBlur: event => save({ budgetPerEdictUsd: Number(event.target.value) }) })),
              h('label', { className: 'ssl-field' },
                h('span', { className: 'ssl-label' }, t('fieldBudgetMonth')),
                h('input', { className: 'ssl-input', type: 'number', step: '1', min: '0', defaultValue: settings.monthlyBudgetUsd, onBlur: event => save({ monthlyBudgetUsd: Number(event.target.value) }) })),
              h('span', null), h('span', null)),
            h('div', { className: 'ssl-caption', style: { marginTop: '10px' } }, t('coinNote')),
            h('details', { className: 'ssl-details', style: { marginTop: '12px' } },
              h('summary', null, t('pricesTitle'), h('span', { className: 'ssl-caption', style: { fontWeight: 400 } }, t('pricesNote'))),
              h(PriceTable, { prices: data.prices, onSave: prices => apiJson('/treasury', { method: 'PUT', body: JSON.stringify({ prices }) }).then(next => { setData(next); notify(t('treasurySaved')); }).catch(error => notify(String(error.message || error), 'err')) }))));
      }

      function PriceTable({ prices, onSave }) {
        const [rows, setRows] = useState(() => Object.entries(prices).map(([key, value]) => ({ key, ...value })));
        const update = (index, patch) => setRows(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
        const fields = ['input', 'cacheRead', 'cacheWrite', 'output'];
        return h('div', { style: { marginTop: '10px' } },
          h('table', { className: 'ssl-table' },
            h('thead', null, h('tr', null, [t('colModelPrefix'), t('colIn'), t('colCacheRead'), t('colCacheWrite'), t('colOut')].map(label => h('th', { key: label }, label)))),
            h('tbody', null, rows.map((row, index) => h('tr', { key: index },
              h('td', null, h('input', { className: 'ssl-input ssl-mono', value: row.key, onChange: event => update(index, { key: event.target.value }) })),
              fields.map(field => h('td', { key: field }, h('input', { className: 'ssl-input', type: 'number', step: '0.001', value: row[field], onChange: event => update(index, { [field]: event.target.value }) }))))))),
          h('div', { className: 'ssl-actions', style: { marginTop: '8px' } },
            h('button', { className: 'ssl-btn ssl-btn--sm', onClick: () => setRows([...rows, { key: '', input: 0, cacheRead: 0, cacheWrite: 0, output: 0 }]) }, t('addRow')),
            h('button', { className: 'ssl-btn ssl-btn--primary ssl-btn--sm', onClick: () => onSave(Object.fromEntries(rows.filter(row => row.key).map(row => [row.key, { input: Number(row.input), cacheRead: Number(row.cacheRead), cacheWrite: Number(row.cacheWrite), output: Number(row.output) }]))) }, t('save'))));
      }

      // ---------- 界面文案：zh = 三省六部，en = 古罗马元老院 ----------
      const TEXT = {
        zh: {
          appName: '三省六部',
          appSub: '把本机的 AI 工具排成朝堂：中书拟旨、门下封驳、尚书派单、六部并行办差，全程在隔离分支里进行，批红才合并。',
          tabCourt: '朝堂', tabWorkroom: '值房', tabMemorials: '奏折', tabAnnals: '史馆', tabHall: '殿宇', tabAgents: '群臣', tabRoster: '官职', tabBio: '本纪',
          courtNoteFirst: '头一回上朝：先去「群臣」点一下一键探测，确认每个岗位的 CLI 都找得到。', courtNoteBroken: '{n} 个岗位没人或已停用，派到那里的差事会失败。', goSetup: '去检查 →',
          statRunning: '在办', statAwaiting: '待你处理', statArchived: '已归档',
          noHost: '无法连接宿主：{error}', noHostHint: '确认插件的宿主半已加载（设置 → 插件），或重启 DSH 后再试。',
          hostLost: '与宿主的连接中断：{error}（显示的是最后一次拿到的状态）',
          loading: '加载中…', today: '今天', working: '处理中', waitingOutput: '等待输出…', vacant: '空缺', none: '暂无',
          close: '关闭', cancel: '取消', collapse: '收起', expand: '展开', applied: '已应用', inUse: '使用中', emptyDoc: '（空）', noSummary: '（无摘要）',
          issue: '下旨', issueTitle: '下旨', briefLabel: '圣意', sealTitle: '下旨（Enter）',
          orientTitle: '奏折竖排右起书写；写路径、英文或代码时可以切成横排',
          orientVertical: '改竖排', orientHorizontal: '改横排',
          issueHint: 'Enter 下旨 · Shift + Enter 换行',
          briefPh: '要办成什么事？写清目标、范围和期望结果。例：把 reports 里的 CSV 汇总成月度报表，写一份周报，并检查本周改动的测试是否通过。',
          briefPhVideo: '要办成什么事？例：做一条二十五秒的 TikTok 竖屏视频，主题「打工人五分钟早餐」，轻松搞笑。',
          fieldWorkspace: '工作目录', workspacePh: '留空 = 在「文档/SanshengLiubu」下新建文件夹；git 仓库会自动隔离到分支',
          fieldCriteria: '验收标准（可选）', criteriaPh: '如：测试全部通过、时长 22-28 秒',
          opened: '已开朝：{id}',
          fullCaption: '朝堂同时最多办 {n} 份奏折，请等一份办完',
          autoCaption: '丞相模式：拟旨 → 封驳 → 六部并行执行 → 复核 → 自我修复 → 自动归档，全程不问你',
          normalCaption: '中书拟旨 → 门下封驳 → 尚书派单 → 六部执行 → 门下复核 → 上奏批红',
          inSessionN: '在办 {n}/{cap}',
          recentTitle: '最近奏折', allArrow: '全部 →', noEdicts: '还没有奏折。写下圣意，开第一次朝会。', openEdict: '查看奏折',
          groupDepartments: '三省', groupDepartmentsNote: '拟旨 · 封驳 · 派单',
          groupMinistries: '六部', groupMinistriesNote: '各司其职，按派单办差，互不依赖的差事并行',
          rulesTitle: '朝规', rulesNote: '开朝时生效，已在办的奏折不受影响', rulesSaved: '朝规已更新',
          autoOn: '丞相模式 · 无人值守', autoOff: '丞相模式', autoOnTitle: '丞相模式已开', autoOffTitle: '丞相模式已关',
          autoOnDesc: '全程不问你：没有命令行的岗位由代办接手，失败自动重办，复核不过自动补救，通过即归档',
          autoOffDesc: '关闭时：人工岗位暂停等你回填，奏折上奏后等你批红（批红即合并分支）',
          fieldDeputy: '代办人选', noDeputy: '不代办', fieldFix: '自我修复', noFix: '不修复', fixRounds: '最多 {n} 轮',
          fieldTemplate: '官制模板', applyTemplate: '套用职掌…', templateApplied: '已套用「{name}」官制，可在下面的卡片上逐个微调职掌',
          ruleIsolation: '隔离分支', ruleIsolationTitle: '工作目录是 git 仓库时，每份奏折在独立的 worktree 分支里办，批红才合并进原分支',
          ruleWrites: '各部可写文件', ruleWritesTitle: '常规模式下给执行差事追加「写入参数」（群臣页可改），否则 CLI 只能出方案、改不了文件',
          ruleAutoMerge: '丞相归档即合并', ruleAutoMergeTitle: '丞相模式复核通过后直接把分支合并进原分支（默认关：留给你点合并）',
          ruleMemory: '史馆记忆', ruleMemoryTitle: '拟旨与审议时带上以往相似奏折留下的教训',
          ruleParallel: '六部并行', serial: '逐件办', parallelN: '最多 {n} 件同时',
          ruleConcurrent: '同时开朝', concurrentN: '{n} 份奏折',
          roleUpdated: '已更新 {role}',
          fieldAgent: '任职', fieldModel: '模型', vacantOption: '— 空缺 —', disabledSuffix: '（已停用）',
          modelDefault: 'CLI 默认', modelNoCli: '不走命令行', modelPlugin: '插件内置，不调模型',
          dutyTitle: '职掌：{duty}（点击修改，中书按职掌派活）', dutyAria: '{role}职掌',
          roleShangshu: '尚书省由插件确定式完成派单与汇总，不额外调用模型',
          roleDeputy: '{reason}，丞相模式下由 {deputy} 代办',
          roleVacantShort: '此职空缺', roleDisabledShort: '{name} 已停用', roleNoCliShort: '{name} 没有命令行',
          roleVacant: '此职空缺，派到这里的差事会直接失败', roleDisabled: '{name} 已停用，请换人或去「群臣」启用',
          roleSelf: '由 DSH 本体处理：出待办，主 agent（sansheng_fill）或你回填后继续',
          roleManual: '没有命令行：出工单，朝会暂停等你回填，或一键交给 DSH 代办',
          readyTitle: '上手检查', readyHint: '先点「一键探测」，确认每个岗位的 CLI 都找得到。',
          readyProblems: '{n} 个岗位有问题，派到那里的差事会失败', readyAllGood: '每个岗位都能办差', probeAll: '一键探测', probing: '探测中…',
          readyVacant: '空缺', readyDisabled: '{name} 已停用', readyDeputy: '{name} 没有命令行，由代办接手', readyManual: '{name} 没有命令行，到时暂停等你回填',
          readyUnchecked: '{name}，未探测', readyOk: '{name} 就绪', readyMissing: '找不到 {cmd}，去「群臣」填绝对路径',
          guide1T: '① 群臣就位', guide1: '装好并登录 claude / codex 等 CLI，点「一键探测」。',
          guide2T: '② 下旨', guide2: '写清要办的事；工作目录是 git 仓库时，全程在隔离分支里改。',
          guide3T: '③ 批红', guide3: '在「奏折」看改动与补丁，批红即合并，驳回则丢弃。',
          glossaryTitle: '术语表', glossaryNote: '官名与公文的白话说明（中文 ⇄ 罗马）',
          quietCourt: '朝堂清静', quietCourtNote: '没有正在办理的奏折，下旨后这里会实时显示各岗位的输出', noWork: '无差事',
          workroomTitle: '值房', workroomBusy: '{n} 件差事在办 · 每 2 秒刷新', workroomIdle: '各岗位空闲',
          recentDone: '刚办完', recentDoneNote: '最近十分钟内办完的差事',
          hudTitle: '三省六部 · 值房', hudPill: '朝堂 {n} 在办',
          langTitle: '语言与官制', langNote: '整套界面、公文与给模型的提示词一起切换；已开朝的奏折保持原来的语言', langApplied: '已切换',
          themesTitle: '整套主题', themesNote: '接管明暗设置，切回默认即还原',
          bgTitle: '殿宇背景', bgSectionNote: '紫禁城 · 朝堂 / 罗马广场 主题专用',
          bgCustom: '自定义背景图', bgBuiltin: '内置插画',
          bgNote: '只在带背景的主题下显示。可以换成你自己的照片（png / jpg / webp，10MB 以内，请用你有权使用的图片）。',
          upload: '上传图片', uploading: '上传中…', bgRestore: '恢复内置', dimLabel: '压暗', dimLight: '浅', dimMid: '中', dimDark: '深',
          imageTooBig: '图片太大了（上限 10MB）', imageReadFailed: '读取图片失败', bgChanged: '背景已更换', bgUploaded: '背景已上传，切到带背景的主题即可看到', bgReset: '已恢复内置插画',
          skinsTitle: '浅改皮肤', skinsNote: '只叠主色与背景层次，跟随你当前的明暗偏好（左浅右深）',
          builtInTitle: '还做进了 DSH 里',
          feature1T: '会话头部「下旨」按钮', feature1: '正常对话时也能直接开朝（conversation.session.header.actions + shell.overlay）',
          feature2T: '右侧面板「政令执行」「各部门沟通」', feature2: '流程条、实时输出、回填、批红，公文往来排成群聊（sidebar.right.pane.tab）',
          feature3T: '会话头部视图「朝堂职位」「确定工作流」', feature3: '与「对话」「轨迹」并列（conversation.view）',
          feature4T: '模型工具', feature4: 'sansheng_edict / status / approve / reject / fill / assign：在对话里下旨、查进度、回填、批红',
          headerBtnTitle: '下旨：把任务交给朝堂（三省六部）', modalTitle: '下旨 · 交给朝堂办理',
          noMessages: '还没有公文往来。', tookN: '用时 {t}', failedWord: '失败', viewDoc: '查看文书',
          gitTitle: '隔离分支', gitMerged: '已合并进 {base}', gitDiscardedPill: '已丢弃', gitEmpty: '没有改动', gitWorking: '办差中', gitUnmerged: '待合并',
          filesN: '{n} 个文件', gitLiveNote: '各部正在分支的 worktree 里改动，原目录不受影响；办完后统一提交。',
          viewPatch: '查看补丁', mergeNow: '合并到原分支', mergedToast: '已合并', discardBranch: '丢弃分支', discardConfirm: '确认丢弃？', discardedToast: '分支已丢弃',
          fillTitle: '待回填：{role} · {title}', fillNote: '这个岗位没有命令行。按工单人工做完，把结果（做了什么、产出在哪）填在这里，朝会接着走。',
          fillPh: '例：已完成，产出在 {deliverable}', fillSubmit: '提交回填', fillSkip: '跳过此差事', viewWorkOrder: '查看工单',
          filledToast: '已回填，朝会继续', skippedToast: '已跳过，朝会继续',
          filterAll: '全部', filterActive: '在办', filterApproval: '待批红', filterDone: '已归档', filterClosed: '未成', filterEmpty: '这一类下没有奏折',
          noEdictsYet: '还没有奏折。去「朝堂」下旨，或在对话里让模型调用 sansheng_edict。', pickEdict: '左侧选择一份奏折',
          autoPill: '丞相', draftRounds: '拟旨 {n} 轮', fixRoundsMeta: '自我修复 {n} 轮', lessonsN: '参考前朝经验 {n} 条',
          approve: '批红', approveMerge: '批红并合并', reject: '驳回', halt: '叫停', rejectConfirm: '确认驳回',
          rejectPh: '驳回理由（会记进史馆，下次拟旨引以为戒）', rejectMemoryNote: '分支会保留一份快照，可在下方丢弃。',
          approvedToast: '已批红归档', approvedMergedToast: '已批红，成果已合并', rejectedToast: '已驳回', haltedToast: '已叫停',
          liveNow: '此刻在办', rolesN: '{n} 件', messagesTitle: '公文往来', itemsN: '{n} 件', stepsTitle: '六部差事', stepsDone: '{done}/{n} 已办',
          notDispatched: '尚未派单', artifactsTitle: '文书与产物', docsN: '{n} 份', eventsTitle: '朝会记录',
          retriedTag: '重办过', stepDone: '已办', afterTag: '待 {list}', rootTag: '可先办',
          kpiTotal: '记入史馆的奏折', kpiVetoRate: '门下封驳率', kpiFirstPass: '首轮准奏率', kpiFixRounds: '自我修复轮数',
          rubberStamp: '门下省已经五份以上奏折一次都没封驳过，可能在走过场：换一个更严的模型，或改 lib/prompts.mjs 里的判定标准。',
          memoryOff: '朝规里关掉了「史馆记忆」：教训照记，但拟旨时不会带上。',
          ministryStats: '各部成绩', ministryStatsNote: '绿色办成，红色办砸',
          doneOfN: '{done}/{n} 办成 · {failed} 败',
          lessonsTitle: '前朝经验', lessonsNote: '每份奏折留下的教训；相似的圣意下次会自动带上',
          clearAll: '全部清空', clearConfirm: '确认清空？', forget: '遗忘', forgetTitle: '这条往事不再参考',
          vetoesN: '封驳 {n} 次', noAnnals: '史馆还是空的。办完第一份奏折后，这里会记下教训与成绩。',
          annalRemoved: '已遗忘', annalsCleared: '史馆已清空',
          agentsIntro: '本机可调用的 AI 工具。命令行类可探测是否装好；改完记得保存。',
          enabled: '已启用', disabled: '已停用', postsNow: '现任：{list}', noPost: '暂无官职', probe: '探测', found: '找到', notFound: '未找到',
          fieldCommand: '命令', fieldArgs: '基础参数（空格分隔，可用 {prompt}）', fieldModelArgs: '模型参数（{model}）', fieldModels: '模型候选（逗号分隔）',
          fieldExecArgs: '写入参数（常规模式执行差事时追加，允许改文件）', execArgsPh: '如 --permission-mode acceptEdits；留空则只能出方案',
          fieldAutoArgs: '无人值守参数（丞相模式下追加，放开这个 CLI 自己的权限确认）', autoArgsPh: '如 --full-auto；留空则无人值守时可能写不了文件',
          adapterSelfNote: 'DSH 本体：相关差事出待办，主 agent 用 sansheng_fill 或你在奏折页回填后继续。',
          adapterManualNote: '人工适配器：这个工具只有图形界面。派到它的差事会出工单并暂停：你可以回填结果、跳过，或交给 DSH 代办。',
          unsavedN: '{n} 个 agent 有未保存的修改', allSaved: '所有修改已保存', undo: '撤销', saving: '保存中…', saveAgents: '保存群臣配置', agentsSaved: '群臣配置已保存',
          viewRoster: '朝堂职位', viewRosterSub: '三省六部的人选、模型与职掌，改完立即生效',
          viewFlow: '确定工作流', viewFlowSub: '排好各部门的先后顺序再下旨，中书省必须照此拟旨（存在宿主，任何入口下旨都带上）',
          fixedFlow: '钦定流程', fixedFlowN: '{n} 步，顺序与分工由你定', fixedFlowNone: '未指定：由中书省自拟（可并行）',
          templates: '模板', clearFlow: '清空（中书自拟）', flowMax: '最多 12 步',
          chainFree: '六部（中书自拟）', chainAuto: '自动归档',
          stepMinistryAria: '第 {n} 步部门', stepTitleAria: '第 {n} 步内容', moveUp: '上移', moveDown: '下移', remove: '删除',
          flowEmpty: '没有钦定流程时，中书省按圣意和各部职掌自己拆步骤，互不依赖的可以并行。选个模板或添加一步来自己定。',
          addStep: '+ 添加一步', issueByFlow: '按上面的流程开朝',
          flowAutoCaption: '丞相模式：全程不问你，下旨后在右侧「各部门沟通」看进展', flowCaption: '下旨后在右侧「各部门沟通」看进展',
          paneExec: '政令执行', paneExecDesc: '当前奏折的流程、各部差事、回填与实时输出',
          paneChat: '各部门沟通', paneChatDesc: '三省六部之间的公文往来，像群聊一样看',
          paneExecEmpty: '朝堂清静。到头部「确定工作流」下旨，这里会显示执行进度。', openChat: '看各部门沟通',
          pickEdictAria: '选择奏折', noEdictsShort: '还没有奏折', chatEmpty: '在下面写圣意下旨，三省六部的往来会像群聊一样出现在这里。',
          waitingReports: '等待各部回文…', workingFor: '办差中 {t}', typing: '正在输出',
          fullShort: '朝堂满额，办完一份后可再下旨', chatPh: '写下圣意，Enter 下旨，Shift + Enter 换行',
          chatFlowN: '按钦定流程 {n} 步', chatFlowFree: '由中书省自拟流程',
        },
        en: {
          appName: 'Imperial Senate',
          appSub: 'Your AI tools as a Roman Senate: the Consul drafts, the Tribune vetoes, the Proconsul dispatches, the magistrates work in parallel, all on an isolated branch that is merged only under your seal.',
          tabCourt: 'Senate', tabWorkroom: 'Officium', tabMemorials: 'Decrees', tabAnnals: 'Annals', tabHall: 'Palace', tabAgents: 'Cohort', tabRoster: 'Offices', tabBio: 'Res Gestae',
          courtNoteFirst: 'First session: open Cohort and press Probe all to check every office can find its CLI.', courtNoteBroken: '{n} offices are vacant or disabled; orders sent there will fail.', goSetup: 'Check →',
          statRunning: 'In session', statAwaiting: 'Need you', statArchived: 'Archived',
          noHost: 'Cannot reach the host: {error}', noHostHint: 'Check that the plugin\'s host half is loaded (Settings → Plugins), or restart DSH.',
          hostLost: 'Lost contact with the host: {error} (showing the last known state)',
          loading: 'Loading…', today: 'Today', working: 'Working', waitingOutput: 'Waiting for output…', vacant: 'Vacant', none: 'None',
          close: 'Close', cancel: 'Cancel', collapse: 'Hide', expand: 'Show', applied: 'Applied', inUse: 'In use', emptyDoc: '(empty)', noSummary: '(no summary)',
          issue: 'Decree', issueTitle: 'Issue a decree', briefLabel: 'Caesar\'s will', sealTitle: 'Seal the decree (Enter)',
          orientTitle: 'Switch writing direction', orientVertical: 'Vertical', orientHorizontal: 'Horizontal',
          issueHint: 'Enter to issue · Shift + Enter for a new line',
          briefPh: 'What must be done? State the goal, the scope and the expected result. E.g. Combine the CSVs in reports/ into a monthly report, write a weekly summary, and check that this week\'s changed tests pass.',
          briefPhVideo: 'What must be done? E.g. Make a 25-second vertical TikTok video: "a five-minute breakfast for busy workers", light and funny.',
          fieldWorkspace: 'Working folder', workspacePh: 'Empty = a new folder under Documents/SanshengLiubu; a git repo is isolated on its own branch',
          fieldCriteria: 'Acceptance criteria (optional)', criteriaPh: 'e.g. all tests pass, 22-28 seconds long',
          opened: 'The Senate convenes: {id}',
          fullCaption: 'The Senate handles at most {n} decrees at a time. Wait for one to finish',
          autoCaption: 'Autonomy: draft → veto → parallel work → audit → self-repair → archive, without asking you',
          normalCaption: 'Consul drafts → Tribune reviews → Proconsul dispatches → magistrates work → Tribune audits → your seal',
          inSessionN: 'In session {n}/{cap}',
          recentTitle: 'Recent decrees', allArrow: 'All →', noEdicts: 'No decrees yet. Write Caesar\'s will and convene the Senate.', openEdict: 'Open decree',
          groupDepartments: 'The three offices', groupDepartmentsNote: 'draft · veto · dispatch',
          groupMinistries: 'The six magistrates', groupMinistriesNote: 'each to their remit; independent orders run in parallel',
          rulesTitle: 'Standing orders', rulesNote: 'Fixed when a decree opens; running decrees are unaffected', rulesSaved: 'Standing orders updated',
          autoOn: 'Autonomy · unattended', autoOff: 'Autonomy', autoOnTitle: 'Autonomy is on', autoOffTitle: 'Autonomy is off',
          autoOnDesc: 'Never asks you: a deputy covers GUI-only offices, failures are retried, failed audits are remedied, passing work is archived',
          autoOffDesc: 'When off: GUI-only offices pause for your input, and the report waits for your seal (sealing merges the branch)',
          fieldDeputy: 'Deputy', noDeputy: 'No deputy', fieldFix: 'Self-repair', noFix: 'Off', fixRounds: 'Up to {n} rounds',
          fieldTemplate: 'Office template', applyTemplate: 'Apply remits…', templateApplied: 'Applied the "{name}" template. Fine-tune each remit on the cards below',
          ruleIsolation: 'Isolated branch', ruleIsolationTitle: 'In a git repo, each decree works in its own worktree branch and is merged only when you seal it',
          ruleWrites: 'Magistrates may write', ruleWritesTitle: 'In standard mode, executing orders get the agent\'s write arguments (Cohort tab); without them the CLIs can only advise',
          ruleAutoMerge: 'Merge on auto-archive', ruleAutoMergeTitle: 'In autonomy, merge the branch as soon as the audit passes (off by default: you click Merge)',
          ruleMemory: 'Annals memory', ruleMemoryTitle: 'Feed lessons from similar past decrees into drafting and review',
          ruleParallel: 'Parallel orders', serial: 'One at a time', parallelN: 'Up to {n} at once',
          ruleConcurrent: 'Concurrent decrees', concurrentN: '{n} decrees',
          roleUpdated: '{role} updated',
          fieldAgent: 'Holder', fieldModel: 'Model', vacantOption: '— vacant —', disabledSuffix: ' (disabled)',
          modelDefault: 'CLI default', modelNoCli: 'No command line', modelPlugin: 'Built in, no model',
          dutyTitle: 'Remit: {duty} (click to edit; the Consul assigns work by remit)', dutyAria: '{role} remit',
          roleShangshu: 'The Proconsul is the plugin itself: dispatch and summary are deterministic, no model call',
          roleDeputy: '{reason}; in autonomy {deputy} stands in',
          roleVacantShort: 'Vacant', roleDisabledShort: '{name} is disabled', roleNoCliShort: '{name} has no command line',
          roleVacant: 'Vacant: orders sent here will fail', roleDisabled: '{name} is disabled. Appoint someone else or enable it in the Cohort tab',
          roleSelf: 'Handled by DSH itself: the main agent (sansheng_fill) or you fill in the result, then the session continues',
          roleManual: 'No command line: a work order is issued and the session pauses for your input, or hand it to DSH in one click',
          readyTitle: 'Readiness check', readyHint: 'Press "Probe all" to confirm every office\'s CLI can be found.',
          readyProblems: '{n} offices have problems; orders sent there will fail', readyAllGood: 'Every office is ready', probeAll: 'Probe all', probing: 'Probing…',
          readyVacant: 'vacant', readyDisabled: '{name} is disabled', readyDeputy: '{name} has no CLI; the deputy covers it', readyManual: '{name} has no CLI; will pause for your input',
          readyUnchecked: '{name}, not probed', readyOk: '{name} ready', readyMissing: '{cmd} not found; set an absolute path in the Cohort tab',
          guide1T: '① Muster the cohort', guide1: 'Install and log in to claude / codex and the rest, then press "Probe all".',
          guide2T: '② Issue a decree', guide2: 'Say what must be done. In a git repo all edits happen on an isolated branch.',
          guide3T: '③ Seal it', guide3: 'Review the changes and patch under Decrees. Seal to merge, reject to discard.',
          glossaryTitle: 'Glossary', glossaryNote: 'Offices and dispatches in plain words (Chinese ⇄ Roman)',
          quietCourt: 'The Senate is quiet', quietCourtNote: 'No decree is running. Once you issue one, each office\'s live output appears here', noWork: 'Idle',
          workroomTitle: 'Officium', workroomBusy: '{n} orders running · refreshed every 2s', workroomIdle: 'All offices idle',
          recentDone: 'Just finished', recentDoneNote: 'Orders completed in the last ten minutes',
          hudTitle: 'Imperial Senate · Officium', hudPill: 'Senate: {n} at work',
          langTitle: 'Language and court', langNote: 'Switches the interface, the dispatches and the prompts sent to the models; running decrees keep their language', langApplied: 'Language switched',
          themesTitle: 'Themes', themesNote: 'Take over light / dark; switch back to the default to restore',
          bgTitle: 'Backdrop', bgSectionNote: 'For the Forbidden City and Forum Romanum themes',
          bgCustom: 'Custom backdrop', bgBuiltin: 'Built-in illustration',
          bgNote: 'Shown only by themes with a backdrop. Replace it with your own photo (png / jpg / webp, up to 10MB, one you have the right to use).',
          upload: 'Upload image', uploading: 'Uploading…', bgRestore: 'Restore built-in', dimLabel: 'Dim', dimLight: 'Light', dimMid: 'Medium', dimDark: 'Dark',
          imageTooBig: 'The image is too large (10MB at most)', imageReadFailed: 'Could not read the image', bgChanged: 'Backdrop changed', bgUploaded: 'Uploaded. Switch to a theme with a backdrop to see it', bgReset: 'Built-in illustration restored',
          skinsTitle: 'Light skins', skinsNote: 'Only accent and background layers; follows your light / dark preference (left light, right dark)',
          builtInTitle: 'Also built into DSH',
          feature1T: '"Decree" button in the session header', feature1: 'Convene the Senate from any conversation (conversation.session.header.actions + shell.overlay)',
          feature2T: 'Right pane: "Acta" and "Senate floor"', feature2: 'Flow bar, live output, input requests and sealing; dispatches shown as a group chat (sidebar.right.pane.tab)',
          feature3T: 'Header views: "Offices" and "Procedure"', feature3: 'Next to Conversation and Trajectory (conversation.view)',
          feature4T: 'Model tools', feature4: 'sansheng_edict / status / approve / reject / fill / assign: issue, follow, fill in and seal decrees from the chat',
          headerBtnTitle: 'Issue a decree: hand the task to the Senate', modalTitle: 'Issue a decree · hand it to the Senate',
          noMessages: 'No dispatches yet.', tookN: 'took {t}', failedWord: 'failed', viewDoc: 'View document',
          gitTitle: 'Isolated branch', gitMerged: 'Merged into {base}', gitDiscardedPill: 'Discarded', gitEmpty: 'No changes', gitWorking: 'At work', gitUnmerged: 'Not merged',
          filesN: 'files: {n}', gitLiveNote: 'The magistrates are editing the branch\'s worktree; your folder is untouched. Everything is committed at the end.',
          viewPatch: 'View patch', mergeNow: 'Merge into original branch', mergedToast: 'Merged', discardBranch: 'Discard branch', discardConfirm: 'Discard for good?', discardedToast: 'Branch discarded',
          fillTitle: 'Awaiting input: {role} · {title}', fillNote: 'This office has no command line. Do the work order by hand, then write what you did and where the output is. The session carries on.',
          fillPh: 'e.g. Done; the output is in {deliverable}', fillSubmit: 'Submit', fillSkip: 'Skip this order', viewWorkOrder: 'View work order',
          filledToast: 'Filled in; the session continues', skippedToast: 'Skipped; the session continues',
          filterAll: 'All', filterActive: 'Running', filterApproval: 'Awaiting seal', filterDone: 'Archived', filterClosed: 'Closed', filterEmpty: 'No decrees here',
          noEdictsYet: 'No decrees yet. Issue one from the Senate tab, or let the model call sansheng_edict.', pickEdict: 'Pick a decree on the left',
          autoPill: 'Autonomous', draftRounds: 'Draft rounds: {n}', fixRoundsMeta: 'Self-repair rounds: {n}', lessonsN: 'Lessons consulted: {n}',
          approve: 'Seal', approveMerge: 'Seal and merge', reject: 'Reject', halt: 'Halt', rejectConfirm: 'Reject',
          rejectPh: 'Reason (kept in the Annals so the next draft avoids it)', rejectMemoryNote: 'A snapshot of the branch is kept; discard it below.',
          approvedToast: 'Sealed and archived', approvedMergedToast: 'Sealed; changes merged', rejectedToast: 'Rejected', haltedToast: 'Halted',
          liveNow: 'At work now', rolesN: 'At work: {n}', messagesTitle: 'Dispatches', itemsN: '{n}', stepsTitle: 'Orders', stepsDone: '{done}/{n} done',
          notDispatched: 'Not dispatched yet', artifactsTitle: 'Documents and output', docsN: 'count: {n}', eventsTitle: 'Session log',
          retriedTag: 'retried', stepDone: 'Done', afterTag: 'after {list}', rootTag: 'can start first',
          kpiTotal: 'Decrees in the Annals', kpiVetoRate: 'Tribune veto rate', kpiFirstPass: 'Passed on first review', kpiFixRounds: 'Self-repair rounds',
          rubberStamp: 'The Tribune has not vetoed a single one of five or more decrees and may be rubber-stamping. Try a stricter model or tighten the standard in lib/prompts.mjs.',
          memoryOff: '"Annals memory" is off in the standing orders: lessons are still recorded but not fed to the Consul.',
          ministryStats: 'Magistrates\' record', ministryStatsNote: 'green done, red failed',
          doneOfN: '{done}/{n} done · {failed} failed',
          lessonsTitle: 'Lessons', lessonsNote: 'What each decree taught; similar decrees get them automatically',
          clearAll: 'Clear all', clearConfirm: 'Clear for good?', forget: 'Forget', forgetTitle: 'Stop consulting this one',
          vetoesN: 'Vetoes: {n}', noAnnals: 'The Annals are empty. After the first decree, lessons and records appear here.',
          annalRemoved: 'Forgotten', annalsCleared: 'Annals cleared',
          agentsIntro: 'AI tools available on this machine. Command-line ones can be probed; remember to save.',
          enabled: 'Enabled', disabled: 'Disabled', postsNow: 'Holds: {list}', noPost: 'No office', probe: 'Probe', found: 'Found', notFound: 'Not found',
          fieldCommand: 'Command', fieldArgs: 'Base arguments (space-separated, {prompt} allowed)', fieldModelArgs: 'Model arguments ({model})', fieldModels: 'Candidate models (comma-separated)',
          fieldExecArgs: 'Write arguments (added to executing orders in standard mode, allow editing files)', execArgsPh: 'e.g. --permission-mode acceptEdits; empty = advice only',
          fieldAutoArgs: 'Autonomy arguments (added in autonomy, lift the CLI\'s own permission prompts)', autoArgsPh: 'e.g. --full-auto; empty = may not be able to write unattended',
          adapterSelfNote: 'DSH itself: its orders become to-dos; the main agent (sansheng_fill) or you fill in the result on the decree page.',
          adapterManualNote: 'Manual adapter: this tool only has a GUI. Orders sent to it issue a work order and pause: fill in the result, skip it, or hand it to DSH.',
          unsavedN: '{n} agents have unsaved changes', allSaved: 'All changes saved', undo: 'Undo', saving: 'Saving…', saveAgents: 'Save cohort', agentsSaved: 'Cohort saved',
          viewRoster: 'Offices', viewRosterSub: 'Who holds each office, with which model and remit. Changes apply at once',
          viewFlow: 'Procedure', viewFlowSub: 'Fix the order of the magistrates before issuing; the Consul must follow it (stored on the host, used by every entry point)',
          fixedFlow: 'Fixed procedure', fixedFlowN: '{n} steps, order and assignment set by you', fixedFlowNone: 'None: the Consul plans it (in parallel where possible)',
          templates: 'Templates', clearFlow: 'Clear (Consul decides)', flowMax: '12 steps at most',
          chainFree: 'Magistrates (planned by the Consul)', chainAuto: 'Auto-archive',
          stepMinistryAria: 'Step {n} office', stepTitleAria: 'Step {n} task', moveUp: 'Move up', moveDown: 'Move down', remove: 'Remove',
          flowEmpty: 'Without a fixed procedure the Consul breaks the work down by remit, running independent orders in parallel. Pick a template or add a step to set it yourself.',
          addStep: '+ Add step', issueByFlow: 'Convene with the procedure above',
          flowAutoCaption: 'Autonomy: never asks you. Follow it on the "Senate floor" pane', flowCaption: 'Follow it on the "Senate floor" pane on the right',
          paneExec: 'Acta', paneExecDesc: 'Flow, orders, input requests and live output of the current decree',
          paneChat: 'Senate floor', paneChatDesc: 'Dispatches between the offices, read like a group chat',
          paneExecEmpty: 'The Senate is quiet. Issue a decree from the "Procedure" header view and progress appears here.', openChat: 'Senate floor',
          pickEdictAria: 'Pick a decree', noEdictsShort: 'No decrees yet', chatEmpty: 'Write Caesar\'s will below. The offices\' dispatches appear here like a group chat.',
          waitingReports: 'Waiting for reports…', workingFor: 'at work {t}', typing: 'writing',
          fullShort: 'The Senate is full; issue again once one finishes', chatPh: 'Write Caesar\'s will; Enter to issue, Shift + Enter for a new line',
          chatFlowN: 'Fixed procedure: {n} steps', chatFlowFree: 'The Consul plans the procedure',
        },
      };

      // v0.7 文案：监察、朝制、国库、全景、文书房、实录
      Object.assign(TEXT.zh, {
        groupWatch: '监察', groupWatchNote: '锦衣卫看守督办，御史巡查弹劾',
        roleJinyiwei: '锦衣卫由插件确定式执行，不耗 token：卡死即拿下、推脱即督办（申饬 → 问话 → 考成 → 革职留任）、超支即停朝',
        roleYushi: '常朝只做确定式巡查（产出在不在、回奏空不空），不耗 token；大朝会再用这里的模型逐件细看',
        ruleMode: '默认朝制', mode_auto: '自动', mode_express: '急递', mode_standard: '常朝', mode_grand: '大朝会',
        modeDesc_auto: '短而单一的走急递，长或多步的走大朝会，其余常朝',
        modeDesc_express: '不拟旨、不封驳、不复核，直接派给一个部：1 次调用起，最省',
        modeDesc_standard: '拟旨、封驳、派单、执行、复核；御史只做确定式巡查',
        modeDesc_grand: '常朝之外，御史再逐件调模型巡查：最稳，也最贵',
        ruleRetries: '督办重办', retriesN: '最多 {n} 次', noRetry: '不重办',
        rulePressure: '督办口吻', pressure_standard: '锦衣卫（施压）', pressure_gentle: '勉励（温和）', pressure_off: '不督办',
        ruleStall: '卡死拿下', stallN: '{n} 分钟无动静', stallOff: '不看守',
        ruleHistorian: '史官修实录', ruleHistorianTitle: '每份奏折上奏前，调一次便宜的模型把值得记住的写进实录（默认 Claude Code · haiku）',
        tabTreasury: '国库', statsTitle: '史馆统计', statsNote: '封驳率、各部成绩与每份奏折的教训',
        fieldOutputFormat: '输出格式（国库记账用）', format_claude_stream: 'Claude stream-json（有真账）', format_codex_json: 'Codex --json（有真账）', format_text: '纯文本（按字数估算）',
        fieldFormatArgs: '格式参数', fieldResumeArgs: '续接参数（{session}，同岗位后续轮次只发增量）', resumeArgsPh: '如 --resume {session}；留空 = 不续接',
        estimatedTag: '估', fieldMode: '朝制',
        estimateLine: '预计 {mode}{ministry} · {calls} 次调用 ·', basisHistory: '按你的历史均价', basisDefault: '按经验值（还没有历史）',
        narrateLive: '{role}正在{kind}{title} · 已 {time} · {agent}', narrateWaiting: '等你回填：{list}', narrateSeal: '已上奏，等你批红',
        panoTitle: '朝会全景', panoMeta: '{calls} 次调用 · 最多 {peak} 件同时 · 历时 {time}', resumedTag: '续接会话',
        outcome_used: '有效', outcome_vetoed: '被封驳的草稿', outcome_retried: '重办前的一次', outcome_failed: '失败', outcome_discarded: '奏折未成，作废',
        legendOk: '办成', legendLive: '在办', legendVeto: '被封驳', legendRetry: '重办过', legendFail: '失败 / 作废', legendResumed: '续接会话（白框）', legendMark: '弹劾 / 督办 / 回填 / 锦衣卫',
        noDiff: '没有差异', filesTitle: '文书房', filesSource_worktree: '各部正在隔离副本里改动（实时）', filesSource_branch: '来自隔离分支（批红前原目录不变）', filesSource_workspace: '来自工作目录',
        missingN: '缺 {n} 件产出', allDelivered: '产出齐全', deliverableOk: '产出存在，点开看内容', deliverableMissing: '方案写明的产出不存在',
        viewDiff: '看改动', viewFile: '看全文', fileGone: '（文件不存在）',
        wikiSaved: '实录已保存', wikiLinted: '体检完成：{n} 处整理', wikiProjects: '按文件夹', wikiOffices: '按岗位',
        wikiTitle: '实录（朝廷的记事本）', wikiNote: '每办完一道旨，史官把以后用得上的事记下来：这个文件夹怎么跑、怎么测、哪里有坑。下次在同一个文件夹办事，各部会先看这里。你可以直接改，改了以你为准',
        wikiLint: '整理一遍（去重、去掉过时和被驳回的）', wikiCounts: '{n} 条 · {v} 条已确认', wikiLog: '最近记录', save: '保存', edit: '编辑',
        wikiLegend: '每条后面的记号：✓ 你批红过，可信 · ? 还没批红 · ✗ 那道旨被驳回了，不可信 · 📌 置顶，各部最先看。自己加一条就写一行「- 内容」。',
        wikiEmpty: '实录还是空的。第一份奏折上奏后，史官会把这个目录怎么构建、怎么测试、有哪些坑记下来，下次直接用。',
        markVerified: '已批红验证', markRefuted: '奏折被驳回，不再召回', markUnverified: '还没批红',
        treasurySaved: '国库设置已保存',
        adviceWaste: '废料占 {p}：先看「废料」里是哪一类多。封驳多就改拟旨提示词或换中书的模型；重办多就看锦衣卫督办记录。',
        adviceCache: '缓存命中只有 {p}：确认 Claude Code 用 stream-json 输出并开了续接会话，同一岗位的后续轮次才吃得到缓存。',
        adviceEstimated: '{n} 次调用的用量是按字数估算的：给这些 CLI 配上结构化输出（群臣页「输出格式」）才有真账。',
        adviceVeto: '被封驳的草稿是最大的废料：小活改走急递，或在朝堂职位里把中书的职掌写得更具体。',
        adviceBudget: '还没设单份奏折的拨款：设一个上限，锦衣卫会在超支时停朝。',
        treasuryMonth: '本月', treasuryToday: '今日', treasuryAll: '累计',
        kpiTokens: 'token 总量 · {calls} 次调用', kpiCache: '缓存命中率 · 读缓存 {n}', kpiSaved: '缓存省下', kpiWaste: '废料占比 · {m}',
        adviceTitle: '户部的建议', daysTitle: '近两周', daysNote: '每天的花销', byRole: '各岗位花销', wasteTitle: '废料', noWaste: '没有废料', byAgent: '各工具花销与缓存', cacheShort: '缓存',
        ledgerTitle: '账本', ledgerNote: '最近 30 次调用', colTime: '时间', colOffice: '岗位', colModel: '模型', colIn: '输入', colCache: '缓存读 +写', colOut: '输出', colCost: '花销', colUse: '用途',
        ledgerEmpty: '还没有入账。', treasurySettings: '国库设置', fieldCurrency: '币种', fieldRate: '美元汇率', fieldBudgetEdict: '单份奏折拨款（美元，0 = 不限）', fieldBudgetMonth: '每月预算（美元，0 = 不限）',
        coinNote: '币制：汉五铢，1 钱 = 1 分人民币，1 金 = 10000 钱。旁边是真实金额；Claude Code 自己报花销时以它为准，其余按价目表算。',
        pricesTitle: '价目表', pricesNote: '美元 / 百万 token，按模型名前缀匹配；各家价格常变，请按你的账单改',
        colModelPrefix: '模型前缀', colCacheRead: '缓存读', colCacheWrite: '缓存写', addRow: '+ 加一行',
      });
      Object.assign(TEXT.en, {
        groupWatch: 'The watch', groupWatchNote: 'the Guard supervises, the agentes in rebus inspect',
        roleJinyiwei: 'The Praetorian Guard is the plugin itself and costs no tokens: it seizes stalled work, escalates shirking (admonition → interrogation → review → last chance) and halts overspending',
        roleYushi: 'In the Senate procedure the inspector only runs free deterministic checks (does the deliverable exist, is the report empty); in the Comitia it also inspects each order with this model',
        ruleMode: 'Default procedure', mode_auto: 'Auto', mode_express: 'Cursus publicus', mode_standard: 'Senate', mode_grand: 'Comitia',
        modeDesc_auto: 'Short single-clause briefs go by courier, long or multi-step ones to the Comitia, the rest to the Senate',
        modeDesc_express: 'No draft, review or audit: sent straight to one magistrate. One call; the cheapest',
        modeDesc_standard: 'Draft, veto, dispatch, work, audit; deterministic inspection only',
        modeDesc_grand: 'The Senate procedure plus a model inspection of every order: safest and dearest',
        ruleRetries: 'Redo on failure', retriesN: 'up to {n}', noRetry: 'no redo',
        rulePressure: 'Admonition tone', pressure_standard: 'Praetorian (pressing)', pressure_gentle: 'Encouraging', pressure_off: 'Off',
        ruleStall: 'Seize when silent', stallN: '{n} min silent', stallOff: 'off',
        ruleHistorian: 'Annalist keeps the chronicle', ruleHistorianTitle: 'Before each report, one cheap model call writes what is worth keeping into the chronicle (Claude Code · haiku by default)',
        tabTreasury: 'Aerarium', statsTitle: 'Records', statsNote: 'veto rate, magistrates’ record and each decree’s lessons',
        fieldOutputFormat: 'Output format (for the books)', format_claude_stream: 'Claude stream-json (exact)', format_codex_json: 'Codex --json (exact)', format_text: 'Plain text (estimated)',
        fieldFormatArgs: 'Format arguments', fieldResumeArgs: 'Resume arguments ({session}; later rounds of the same office send only the delta)', resumeArgsPh: 'e.g. --resume {session}; empty = never resume',
        estimatedTag: 'est.', fieldMode: 'Procedure',
        estimateLine: 'Expect {mode}{ministry} · {calls} calls ·', basisHistory: 'from your average cost', basisDefault: 'rule of thumb (no history yet)',
        narrateLive: 'The {role} is on {kind}{title} · {time} · {agent}', narrateWaiting: 'Waiting for your input: {list}', narrateSeal: 'Reported; waiting for your seal',
        panoTitle: 'Session panorama', panoMeta: '{calls} calls · up to {peak} at once · {time}', resumedTag: 'resumed session',
        outcome_used: 'used', outcome_vetoed: 'vetoed draft', outcome_retried: 'attempt before a redo', outcome_failed: 'failed', outcome_discarded: 'decree failed; discarded',
        legendOk: 'done', legendLive: 'running', legendVeto: 'vetoed', legendRetry: 'redone', legendFail: 'failed / discarded', legendResumed: 'resumed session (white rim)', legendMark: 'impeachment / admonition / input / Guard',
        noDiff: 'No differences', filesTitle: 'Tabularium', filesSource_worktree: 'Live: the magistrates are editing the isolated copy', filesSource_branch: 'From the isolated branch (your folder is untouched until you seal)', filesSource_workspace: 'From the working folder',
        missingN: '{n} deliverables missing', allDelivered: 'All deliverables present', deliverableOk: 'Present; click to read', deliverableMissing: 'The plan named this deliverable but it does not exist',
        viewDiff: 'diff', viewFile: 'file', fileGone: '(file does not exist)',
        wikiSaved: 'Chronicle saved', wikiLinted: 'Lint done: {n} fixes', wikiProjects: 'By folder', wikiOffices: 'By office',
        wikiTitle: 'Chronicle (the Senate’s notebook)', wikiNote: 'After each decree the annalist notes what will help next time: how this folder runs, how it is tested, where the traps are. The next decree in the same folder reads it first. Edit freely; your edits win',
        wikiLint: 'Tidy up (drop duplicates, stale and rejected)', wikiCounts: '{n} notes · {v} confirmed', wikiLog: 'Recent', save: 'Save', edit: 'Edit',
        wikiLegend: 'The mark after each note: ✓ you sealed it, trustworthy · ? not sealed yet · ✗ that decree was rejected, not trustworthy · 📌 pinned, read first. Add your own as a line “- text”.',
        wikiEmpty: 'The chronicle is empty. After the first report, the annalist records how this folder builds, how it is tested and where the traps are, so the next decree starts informed.',
        markVerified: 'verified by your seal', markRefuted: 'decree rejected; no longer recalled', markUnverified: 'not sealed yet',
        treasurySaved: 'Treasury settings saved',
        adviceWaste: 'Waste is {p}. Check which kind dominates: many vetoes → sharpen the drafting prompt or the Consul’s model; many redos → read the Guard’s admonitions.',
        adviceCache: 'Cache hit rate is only {p}. Make sure Claude Code uses stream-json and session resume so later rounds of the same office hit the cache.',
        adviceEstimated: '{n} calls were estimated from text length. Give those CLIs a structured output format (Cohort tab) for exact books.',
        adviceVeto: 'Vetoed drafts are the biggest waste: send small jobs by courier, or make the Consul’s remit more specific.',
        adviceBudget: 'No per-decree allotment is set. Set one and the Guard halts a decree that overspends.',
        treasuryMonth: 'This month', treasuryToday: 'Today', treasuryAll: 'All time',
        kpiTokens: 'tokens · {calls} calls', kpiCache: 'cache hit rate · {n} read', kpiSaved: 'saved by the cache', kpiWaste: 'waste · {m}',
        adviceTitle: 'The Quaestor advises', daysTitle: 'Last two weeks', daysNote: 'spend per day', byRole: 'Spend by office', wasteTitle: 'Waste', noWaste: 'No waste', byAgent: 'Spend and cache by tool', cacheShort: 'cache',
        ledgerTitle: 'Ledger', ledgerNote: 'last 30 calls', colTime: 'Time', colOffice: 'Office', colModel: 'Model', colIn: 'Input', colCache: 'Cache read +write', colOut: 'Output', colCost: 'Cost', colUse: 'Use',
        ledgerEmpty: 'Nothing booked yet.', treasurySettings: 'Treasury settings', fieldCurrency: 'Currency', fieldRate: 'USD rate', fieldBudgetEdict: 'Allotment per decree (USD, 0 = none)', fieldBudgetMonth: 'Monthly budget (USD, 0 = none)',
        coinNote: 'Coinage: 1 sestertius = $0.01, 4 sestertii = 1 denarius, 25 denarii = 1 aureus = $1. Real money is shown alongside; Claude Code’s own cost report wins, other calls use the price table.',
        pricesTitle: 'Price table', pricesNote: 'USD per million tokens, matched by model-name prefix; prices change, so set yours from your bill',
        colModelPrefix: 'Model prefix', colCacheRead: 'Cache read', colCacheWrite: 'Cache write', addRow: '+ Add row',
      });

      // 不同 DSH 版本的 slot 契约可能不同：注册失败只告警，不拖垮插件；
      // 设置页那一份是兜底（dsh-mcp-plus 同款，最稳）。
      function apply(ctx) {
        // 启动时拉一次存档：恢复语言、主题与背景（第三方主题不进 DSH 的设置持久化）
        const boot = apiJson('/state')
          .then(data => {
            if (data && data.ui && data.ui.locale) localeStore.set(data.ui.locale);
            return data;
          })
          .catch(() => null);

        // 1) 独立页面：侧栏入口 + 主区面板。按 dshmarket 的写法，两者在侧栏可用时一起注册，
        //    且 main 的 key 必须等于侧栏条目的 id——点侧栏条目时宿主按这个 id 找面板。
        try {
          ctx.slots.inject('sidebar.panellist', function* () {
            try {
              yield ctx.slots.register({ name: 'main', key: SID, label: () => t('appName') }, () => h(App));
              yield ctx.slots.register({ name: 'sidebar.panellist', id: SID, order: 30, label: () => t('appName') }, () => h(SideGlyph));
            } catch (error) {
              console.warn('[sansheng-liubu] sidebar page registration failed:', error);
            }
          });
        } catch (error) {
          console.warn('[sansheng-liubu] sidebar.panellist unavailable:', error);
        }

        // 2) 设置页兜底
        try {
          ctx.slots.inject('settings.section', function* () {
            try {
              yield ctx.slots.register({ name: 'settings.section', id: SID, order: 41, label: () => t('appName'), inject: () => ({ embedded: true }) }, App);
            } catch (error) {
              console.warn('[sansheng-liubu] settings.section registration failed:', error);
            }
          });
        } catch (error) {
          console.warn('[sansheng-liubu] settings.section unavailable:', error);
        }

        // 3) 值房浮层：有奏折在办时，右下角常驻一枚可展开的胶囊
        // 4) 会话头部「下旨」按钮 + 浮层里的下旨弹窗（头部空间有限，弹窗走浮层不容易被裁切）
        const overlays = [
          ['shell.overlay', `${SID}-hud`, Hud],
          ['conversation.session.header.actions', `${SID}-edict`, EdictHeaderButton],
          ['shell.overlay', `${SID}-composer`, EdictComposer],
        ];
        for (const [slot, id, component] of overlays) {
          try {
            ctx.slots.inject(slot, function* () {
              try {
                yield ctx.slots.register({ name: slot, id, label: () => t(id.endsWith('hud') ? 'hudTitle' : 'issue') }, component);
              } catch (error) {
                console.warn(`[sansheng-liubu] ${slot} registration failed:`, error);
              }
            });
          } catch (error) {
            console.warn(`[sansheng-liubu] ${slot} unavailable:`, error);
          }
        }

        // 6) 会话头部视图：与「对话」「轨迹」并列（conversation.view；新视图可能先收在「···」里，可以固定出来）
        try {
          ctx.slots.inject('conversation.view', function* () {
            try {
              yield ctx.slots.register(
                { name: 'conversation.view', id: `${SID}-court`, order: 20, label: () => t('viewRoster'), inject: sessionId => ({ sessionId }) },
                CourtView,
              );
              yield ctx.slots.register(
                { name: 'conversation.view', id: `${SID}-workflow`, order: 21, label: () => t('viewFlow'), inject: sessionId => ({ sessionId }) },
                WorkflowView,
              );
            } catch (error) {
              console.warn('[sansheng-liubu] conversation.view registration failed:', error);
            }
          });
        } catch (error) {
          console.warn('[sansheng-liubu] conversation.view unavailable:', error);
        }

        // 7) 右侧面板页签：政令执行 / 各部门沟通。类型登记走 sidebarRightTabs，页签正文与标题走 slot，三者用同一个 id 对上
        for (const pane of PANES) {
          try {
            ctx.slots.inject('sidebar.right.pane.tab', function* () {
              try {
                yield ctx.slots.register({ name: 'sidebar.right.pane.tab', key: pane.id }, pane.body);
              } catch (error) {
                console.warn(`[sansheng-liubu] right pane registration failed (${pane.kind}):`, error);
              }
            });
            ctx.slots.inject('sidebar.right.pane.tab.title', function* () {
              try {
                yield ctx.slots.register({ name: 'sidebar.right.pane.tab.title', key: pane.id }, pane.title);
              } catch (error) {
                console.warn(`[sansheng-liubu] right pane title registration failed (${pane.kind}):`, error);
              }
            });
          } catch (error) {
            console.warn('[sansheng-liubu] right pane slots unavailable:', error);
          }
        }
        try {
          ctx.inject(['sidebarRightTabs', 'sidebarRight'], scope => {
            sidebarRightApi = scope.sidebarRight;
            for (const pane of PANES) {
              try {
                scope.effect(() => scope.sidebarRightTabs.register({
                  id: pane.id,
                  kind: pane.kind,
                  title: () => t(pane.label),
                  guide: [{ id: pane.kind, order: pane.order, title: () => t(pane.label), description: () => t(pane.desc), icon: pane.icon }],
                }), `sansheng-liubu: ${pane.kind}`);
              } catch (error) {
                console.warn(`[sansheng-liubu] right pane type registration failed (${pane.kind}):`, error);
              }
            }
            scope.effect(() => () => { sidebarRightApi = null; }, 'sansheng-liubu: sidebar right');
          });
        } catch (error) {
          console.warn('[sansheng-liubu] right pane service unavailable; Acta / Senate floor skipped:', error);
        }

        // 4b) DSH 工作区服务：把三省六部的产出文件夹、用系统对话框选的文件夹登记进侧栏
        try {
          ctx.inject(['workspaces'], scope => {
            workspacesApi = scope.workspaces;
            scope.effect(() => () => { workspacesApi = null; }, 'sansheng-liubu: workspaces');
          });
        } catch (error) {
          console.warn('[sansheng-liubu] workspaces service unavailable; folders are not added to the sidebar:', error);
        }

        // 5) 主题：注册整套主题（宫廷 / 墨夜 / 紫禁城 / 大理石 / 帝国之夜 / 罗马广场）+ 令牌叠加皮肤（官方 ctx.theme 扩展点，缺失就跳过）
        try {
          ctx.inject(['theme'], scope => {
            themeApi = scope.theme;
            const disposers = [];
            for (const key of Object.keys(THEMES)) {
              try {
                disposers.push(scope.theme.register({
                  id: themeIdOf(key),
                  colorScheme: THEMES[key].colorScheme,
                  tokens: THEMES[key].tokens,
                }));
              } catch (error) {
                console.warn(`[sansheng-liubu] theme registration failed (${key}):`, error);
              }
            }
            scope.effect(() => () => {
              // 卸载时如果正用着我们的主题，先切回用户自己的 preference，再注销注册
              try {
                if (themeApi && activeTheme !== 'default') restoreUserTheme();
              } catch {
                /* ignore */
              }
              activeTheme = 'default';
              syncBackdrop();
              for (const dispose of disposers) {
                try {
                  dispose();
                } catch {
                  /* ignore */
                }
              }
              if (skinDisposer) {
                try {
                  skinDisposer();
                } catch {
                  /* ignore */
                }
                skinDisposer = null;
              }
            }, 'sansheng-liubu.theme');
            applyTheme(activeTheme);
            applySkin(activeSkin);
            boot.then(data => {
              const ui = (data && data.ui) || {};
              setBackdropOptions(ui);
              applyTheme(ui.theme || 'default');
              applySkin(ui.skin || 'default');
            });
          });
        } catch (error) {
          console.warn('[sansheng-liubu] theme service unavailable; themes and skins skipped:', error);
        }
      }

      return { name: 'dsh-sansheng-liubu', inject: ['slots'], apply };
    },
  });
})();
