// 三省六部 · 浏览器半（DSH Web 客户端插件）
// 零构建：直接是 IIFE，通过 window.__ModuleLoader__ 注册；UI 走宿主半注册的 /sansheng-liubu/* 端点。
(function () {
  const API = '/sansheng-liubu';

  async function apiJson(path, options = {}) {
    const res = await fetch(API + path, {
      headers: { 'Content-Type': 'application/json' },
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
  color: var(--ssl-fg);
  font-size: 13px;
  line-height: 1.55;
}
.ssl *, .ssl-overlay * { box-sizing: border-box; }
/* min-width: 0：宿主容器若是 flex，单行省略的长标题会按全文宽度撑开整页 */
.ssl { padding: 22px 28px 96px; max-width: 1200px; min-width: 0; width: 100%; margin: 0 auto; }

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

/* 页签 */
.ssl-nav {
  display: inline-flex; gap: 2px; padding: 3px; margin: 20px 0 18px; border-radius: 11px;
  background: var(--ssl-sunken); border: 1px solid var(--ssl-line); max-width: 100%; overflow-x: auto;
}
.ssl-nav button {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 15px; border: 0; border-radius: 8px;
  background: transparent; color: var(--ssl-mut); font: inherit; font-size: 13px; cursor: pointer; white-space: nowrap;
  transition: background .15s, color .15s;
}
.ssl-nav button:hover { color: var(--ssl-fg); }
.ssl-nav button.is-active {
  background: var(--ssl-panel); color: var(--ssl-fg); font-weight: 600;
  box-shadow: 0 1px 2px rgba(0,0,0,.06), 0 0 0 1px var(--ssl-line);
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
.ssl-section h3 { margin: 0; font: 600 14px/1 var(--ssl-serif); letter-spacing: .12em; color: var(--ssl-fg); }
.ssl-section span { font-size: 12px; color: var(--ssl-mut); }
.ssl-section::after { content: ""; flex: 1; height: 1px; background: var(--ssl-line); }
.ssl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(268px, 1fr)); gap: 12px; }
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
  width: 540px; max-width: 100%; padding: 20px 22px; border-radius: 16px; border: 1px solid var(--ssl-line2);
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
.ssl-scroll { height: 100%; overflow: auto; }
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
.ssl-chat-compose textarea.ssl-input { min-height: 54px; }
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

@media (max-width: 900px) {
  .ssl { padding: 16px 16px 80px; }
  .ssl-cols, .ssl-split, .ssl-detail-cols { grid-template-columns: minmax(0, 1fr); }
  .ssl-rules { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px 12px; }
  .ssl-rules .ssl-auto { grid-column: 1 / -1; }
  .ssl-side { position: static; max-height: 300px; }
  .ssl-stats { width: 100%; }
  .ssl-stat { flex: 1; }
}
@media (max-width: 560px) {
  .ssl-role-fields, .ssl-agent-fields, .ssl-rules { grid-template-columns: minmax(0, 1fr); }
  .ssl-wf-row { grid-template-columns: 22px 84px minmax(0, 1fr) auto; gap: 6px; }
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
      const backdropUrl = (image = backdrop.image, version = backdrop.version) => (image === 'custom' ? `${API}/background?v=${version}` : PALACE_URL);

      function setBackdropOptions(ui = {}) {
        backdrop.image = ui.background === 'custom' ? 'custom' : 'palace';
        backdrop.version = ui.backgroundVersion || 0;
        backdrop.dim = Number(ui.backgroundDim) || 0.45;
        syncBackdrop();
      }

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

      const ROLE_GROUPS = [
        { title: '三省', note: '拟旨 · 封驳 · 派单', ids: ['zhongshu', 'menxia', 'shangshu'] },
        { title: '六部', note: '各司其职，按派单办差', ids: ['personnel', 'revenue', 'rites', 'war', 'justice', 'works'] },
      ];
      const ALL_ROLES = ROLE_GROUPS.flatMap(group => group.ids);

      // 状态 → [文字, 色调]
      const STATUS = {
        queued: ['候朝', 'mut'],
        running: ['办差中', 'warn'],
        'awaiting-approval': ['待批红', 'seal'],
        done: ['已归档', 'ok'],
        failed: ['已失败', 'err'],
        rejected: ['已驳回', 'err'],
        cancelled: ['已叫停', 'mut'],
        pending: ['未办', 'mut'],
        'handed-off': ['待人工', 'info'],
        idle: ['空闲', 'mut'],
      };

      const ADAPTER_LABEL = { cli: '命令行', self: 'DSH 本体', manual: '人工' };

      // 公文性质 → 色调
      const KIND_TONE = { 封驳: 'err', 准奏: 'ok', 移文: 'warn', 上奏: 'seal', 回文: 'ok', 派单: 'plain', 差事: 'plain', 重办: 'warn', 补救: 'warn', 保留: 'warn' };

      const FLOW = [
        { id: 'drafting', label: '中书拟旨' },
        { id: 'reviewing', label: '门下封驳' },
        { id: 'dispatching', label: '尚书派单' },
        { id: 'executing', label: '六部执行' },
        { id: 'rechecking', label: '门下复核' },
        { id: 'memorial', label: '上奏批红' },
      ];

      function timeText(ts) {
        try {
          return new Date(ts).toLocaleTimeString('zh-CN', { hour12: false });
        } catch {
          return String(ts || '');
        }
      }

      function dateTimeText(ts) {
        try {
          const d = new Date(ts);
          const today = new Date();
          const sameDay = d.toDateString() === today.toDateString();
          return sameDay ? `今天 ${timeText(ts)}` : d.toLocaleString('zh-CN', { hour12: false, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch {
          return String(ts || '');
        }
      }

      function fmtElapsed(ms) {
        const total = Math.max(0, Math.round((ms || 0) / 1000));
        const m = Math.floor(total / 60);
        const s = total % 60;
        return m ? `${m}分${String(s).padStart(2, '0')}秒` : `${s}秒`;
      }

      function StatusPill({ status, text }) {
        const [label, tone] = STATUS[status] || [status, 'mut'];
        return h('span', { className: cx('ssl-pill', `ssl-pill--${tone}`) },
          h('span', { className: cx('ssl-dot', status === 'running' && 'ssl-dot--pulse') }),
          text || label);
      }

      /** 终端风格的输出尾巴，有新输出时自动滚到底 */
      function Terminal({ text, max = 900, height = 160 }) {
        const ref = useRef(null);
        const body = String(text || '').slice(-max);
        useEffect(() => {
          if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
        }, [body]);
        return h('pre', { ref, className: cx('ssl-term', !body && 'ssl-term--empty'), style: { maxHeight: `${height}px` } }, body || '等待输出…');
      }

      /** 朝会流程条：已过 / 进行中 / 停在此处 / 未到 */
      function Flow({ edict }) {
        let current = -1;
        let halted = -1;
        if (edict) {
          if (edict.status === 'done') current = FLOW.length;
          else if (edict.status === 'awaiting-approval') current = FLOW.length - 1;
          // 自我修复阶段是在补办差事，流程条上落在「六部执行」
          const stageOf = id => FLOW.findIndex(step => step.id === (id === 'fixing' ? 'executing' : id));
          if (edict.status === 'running') current = Math.max(0, stageOf(edict.stage));
          else if (edict.haltedAt) {
            const at = edict.haltedAt === 'awaiting-approval' ? FLOW.length - 1 : stageOf(edict.haltedAt);
            halted = at;
            current = at;
          }
        }
        return h('div', { className: 'ssl-flow' }, FLOW.map((step, index) => {
          const state = index === halted ? 'is-halted'
            : index < current ? 'is-done'
            : index === current ? (edict && edict.status === 'awaiting-approval' ? 'is-active' : edict && edict.status === 'running' ? 'is-active' : 'is-done')
            : '';
          return h('div', { key: step.id, className: cx('ssl-flow-step', state) },
            h('div', { className: 'ssl-flow-node' }, state === 'is-done' ? '✓' : state === 'is-halted' ? '×' : index + 1),
            h('div', { className: 'ssl-flow-label' }, step.label));
        }));
      }

      function Section({ title, note }) {
        return h('div', { className: 'ssl-section' }, h('h3', null, title), note ? h('span', null, note) : null);
      }

      // ---------- 官职卡：换人 + 换模型 + 实时状态 ----------
      function RoleCard({ roleId, role, agents, live, onAssign, fallbackName }) {
        const agent = agents.find(item => item.id === role.agentId) || null;
        const models = agent && Array.isArray(agent.models) ? agent.models : [];
        const current = role.model || '';
        const [draft, setDraft] = useState(current);
        useEffect(() => setDraft(current), [current]);
        const duty = role.duty || '';
        const [dutyDraft, setDutyDraft] = useState(duty);
        useEffect(() => setDutyDraft(duty), [duty]);

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

        return h('div', { className: cx('ssl-card ssl-role', live && 'is-live') },
          h('div', { className: 'ssl-role-head' },
            h('span', { className: 'ssl-glyph' }, (role.title || roleId).slice(0, 1)),
            h('div', { className: 'ssl-grow' },
              h('div', { className: 'ssl-role-title' }, role.title || roleId),
              h('input', {
                className: 'ssl-inline',
                value: dutyDraft,
                title: `职掌：${duty}（点击修改，中书按职掌派活）`,
                'aria-label': `${role.title || roleId}职掌`,
                onChange: event => setDutyDraft(event.target.value),
                onBlur: commitDuty,
                onKeyDown: event => {
                  if (event.key === 'Enter') event.target.blur();
                  if (event.key === 'Escape') { setDutyDraft(duty); setTimeout(() => event.target.blur()); }
                },
              })),
            live ? h(StatusPill, { status: 'running', text: fmtElapsed(live.elapsedMs) }) : h(StatusPill, { status: 'idle' })),
          h('div', { className: 'ssl-role-fields' },
            h('label', { className: 'ssl-field' },
              h('span', { className: 'ssl-label' }, '任职'),
              h('select', {
                className: 'ssl-input',
                value: role.agentId || '',
                onChange: event => onAssign(roleId, { agentId: event.target.value }),
              },
              h('option', { value: '' }, '— 空缺 —'),
              options.map(item => h('option', { key: item.id, value: item.id },
                `${item.name}${item.enabled === false ? '（已停用）' : ''}`)))),
            h('label', { className: 'ssl-field' },
              h('span', { className: 'ssl-label' }, '模型'),
              h('input', {
                className: 'ssl-input',
                value: draft,
                disabled: !isCli,
                list: `ssl-models-${roleId}`,
                placeholder: isCli ? 'CLI 默认' : '不走命令行',
                onChange: event => setDraft(event.target.value),
                onBlur: commit,
                onKeyDown: event => {
                  if (event.key === 'Enter') event.target.blur();
                  if (event.key === 'Escape') { setDraft(current); setTimeout(() => event.target.blur()); }
                },
              }),
              h('datalist', { id: `ssl-models-${roleId}` }, models.map(model => h('option', { key: model, value: model }))))),
          fallbackName && !isCli
            ? h('div', { className: 'ssl-caption', style: { marginTop: '8px', color: 'var(--ssl-ok)' } },
                `${!agent ? '此职空缺' : agent.enabled === false ? `${agent.name} 已停用` : `${agent.name} 没有命令行`}，自治模式下由 ${fallbackName} 代办`)
            : !agent ? h('div', { className: 'ssl-hint' }, '此职空缺，派到这里的差事会直接失败')
            : agent.enabled === false ? h('div', { className: 'ssl-hint' }, `${agent.name} 已停用，请换人或去「群臣」启用`)
            : agent.adapter !== 'cli' ? h('div', { className: 'ssl-caption', style: { marginTop: '8px' } }, agent.adapter === 'self' ? '由 DSH 本体处理：生成待办，不自动执行' : '人工办理：生成工单，做完回填')
            : null,
          live ? h('div', { className: 'ssl-live' },
            h('div', { className: 'ssl-caption ssl-ellipsis' }, `${live.kind} · ${live.title || '处理中'}`),
            h(Terminal, { text: live.tail, max: 600, height: 110 })) : null);
      }

      // ---------- 官制模板：一键改九个岗位的职掌（中书按职掌派活） ----------
      const COURT_TEMPLATES = {
        dev: {
          name: '通用研发',
          duties: {
            zhongshu: '起草方案（拟旨）', menxia: '审议封驳', shangshu: '派单与汇总',
            personnel: '人事、账号、权限、配置', revenue: '数据、表格、报表、财务', rites: '文书、汇报、PPT、对外沟通',
            war: '写代码、构建、部署', justice: '测试、审查、合规', works: '界面、设计、基础设施',
          },
        },
        video: {
          name: '短视频',
          duties: {
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
        },
      };

      function RulesCard({ state, onSave }) {
        const rules = state.rules || {};
        const autonomous = rules.autonomous === true;
        const cliAgents = state.agents.filter(item => item.adapter === 'cli' && item.enabled !== false);
        const setRule = patch => onSave({ rules: { ...rules, ...patch } }, '朝规已更新');
        const applyTemplate = key => {
          const template = COURT_TEMPLATES[key];
          if (!template) return;
          const roles = { ...state.roles };
          Object.entries(template.duties).forEach(([roleId, duty]) => { roles[roleId] = { ...(roles[roleId] || {}), duty }; });
          onSave({ roles }, `已套用「${template.name}」官制，可在下面的卡片上逐个微调职掌`);
        };
        return h('div', { className: cx('ssl-card', autonomous && 'is-auto') },
          h('div', { className: 'ssl-rules' },
            h('div', { className: 'ssl-auto' },
              h('label', { className: 'ssl-switch', title: autonomous ? '自治模式已开' : '自治模式已关' },
                h('input', { type: 'checkbox', checked: autonomous, onChange: event => setRule({ autonomous: event.target.checked }) }),
                h('span', null)),
              h('div', { className: 'ssl-grow' },
                h('div', { className: 'ssl-role-title' }, autonomous ? '自治模式 · 无人值守' : '自治模式'),
                h('div', { className: 'ssl-caption' }, autonomous
                  ? '全程不问你：没有命令行的岗位由代办接手，失败自动重办，复核不过自动补救，通过即归档'
                  : '关闭时：人工类岗位只出工单，奏折上奏后等你批红'))),
            h('label', { className: 'ssl-field' },
              h('span', { className: 'ssl-label' }, '代办人选'),
              h('select', {
                className: 'ssl-input', value: rules.fallbackAgentId || '',
                onChange: event => setRule({ fallbackAgentId: event.target.value }),
              },
              h('option', { value: '' }, '不代办'),
              cliAgents.map(item => h('option', { key: item.id, value: item.id }, item.name)))),
            h('label', { className: 'ssl-field' },
              h('span', { className: 'ssl-label' }, '自我修复'),
              h('select', {
                className: 'ssl-input', value: String(rules.maxFixRounds ?? 2),
                onChange: event => setRule({ maxFixRounds: Number(event.target.value) }),
              }, [0, 1, 2, 3].map(n => h('option', { key: n, value: String(n) }, n ? `最多 ${n} 轮` : '不修复')))),
            h('label', { className: 'ssl-field' },
              h('span', { className: 'ssl-label' }, '官制模板'),
              h('select', {
                className: 'ssl-input', value: '',
                onChange: event => { applyTemplate(event.target.value); event.target.value = ''; },
              },
              h('option', { value: '' }, '套用职掌…'),
              Object.entries(COURT_TEMPLATES).map(([key, template]) => h('option', { key, value: key }, template.name))))));
      }

      /** 保存编制（群臣 / 官职 / 朝规）的一部分，其余沿用当前值 */
      function savePresetPatch(state, patch, onRefresh, notify, okText) {
        const body = { agents: state.agents, roles: state.roles, rules: state.rules, ...patch };
        apiJson('/preset', { method: 'PUT', body: JSON.stringify(body) })
          .then(() => { onRefresh(); notify(okText); })
          .catch(error => notify(String(error.message || error), 'err'));
      }

      // ---------- 朝规 + 三省六部名册：朝堂页签与头部「朝堂职位」视图共用 ----------
      function CourtRoster({ state, onRefresh, notify }) {
        const liveByRole = useMemo(() => {
          const map = {};
          (state.live || []).forEach(item => { map[item.roleId] = item; });
          return map;
        }, [state.live]);
        const savePreset = (patch, okText) => savePresetPatch(state, patch, onRefresh, notify, okText);
        const assign = (roleId, patch) => {
          const prev = state.roles[roleId] || {};
          const next = { ...prev, ...patch };
          // 换了人，上一位的模型名多半不适用（如把 opus 带给 Codex），清空回默认
          if (patch.agentId !== undefined && patch.agentId !== prev.agentId) next.model = '';
          savePreset({ roles: { ...state.roles, [roleId]: next } }, `已更新 ${prev.title || roleId}`);
        };
        const autonomous = state.rules && state.rules.autonomous === true;
        const fallbackAgent = autonomous && state.agents.find(item => item.id === state.rules.fallbackAgentId && item.adapter === 'cli' && item.enabled !== false);
        const fallbackName = fallbackAgent ? fallbackAgent.name : '';

        return h('div', null,
          h(Section, { title: '朝规', note: '开朝时生效，已在办的奏折不受影响' }),
          h(RulesCard, { state, onSave: savePreset }),
          ROLE_GROUPS.map(group => h('div', { key: group.title },
            h(Section, { title: group.title, note: group.note }),
            h('div', { className: 'ssl-grid' }, group.ids.map(roleId => h(RoleCard, {
              key: roleId,
              roleId,
              role: state.roles[roleId] || {},
              agents: state.agents,
              live: liveByRole[roleId],
              onAssign: assign,
              // 尚书省由插件自己确定式完成，不存在代办
              fallbackName: roleId === 'shangshu' ? '' : fallbackName,
            }))))));
      }

      // ---------- 朝堂：下旨 + 编队 ----------
      function CourtTab({ state, onRefresh, notify, onOpenEdict }) {
        const [brief, setBrief] = useState('');
        const [workspace, setWorkspace] = useState('');
        const [criteria, setCriteria] = useState('');
        const [sending, setSending] = useState(false);
        const busy = state.busy && state.busy.length > 0;
        const autonomous = state.rules && state.rules.autonomous === true;

        const submit = () => {
          if (!brief.trim() || busy || sending) return;
          setSending(true);
          apiJson('/edicts', { method: 'POST', body: JSON.stringify({ brief, workspace: workspace || undefined, criteria: criteria || undefined, workflow: loadWorkflow() }) })
            .then(result => {
              notify(`已开朝：${result.id}`);
              setBrief('');
              setCriteria('');
              onRefresh();
              openPane(PANE_CHAT);
            })
            .catch(error => notify(String(error.message || error), 'err'))
            .finally(() => setSending(false));
        };

        const recent = state.edicts.slice(0, 5);
        const current = state.edicts.find(item => item.status === 'running') || state.edicts.find(item => item.status === 'awaiting-approval');

        return h('div', null,
          h('div', { className: 'ssl-cols' },
            h('div', { className: 'ssl-card' },
              h('div', { className: 'ssl-card-h' },
                h('h4', { className: 'ssl-card-t' }, '下旨'),
                busy ? h(StatusPill, { status: 'running', text: '朝堂办差中' }) : h('span', { className: 'ssl-caption' }, 'Ctrl + Enter 提交')),
              h('textarea', {
                className: 'ssl-input',
                value: brief,
                placeholder: '圣意：要办成什么事？写清目标、范围和期望结果。\n例：把 reports/ 里的 CSV 汇总成月度报表，写一份周报，并检查 src 里本周改动的测试是否通过。',
                onChange: event => setBrief(event.target.value),
                onKeyDown: event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) submit(); },
              }),
              h('div', { className: 'ssl-row', style: { flexWrap: 'wrap' } },
                h('label', { className: 'ssl-field ssl-grow', style: { minWidth: '200px' } },
                  h('span', { className: 'ssl-label' }, '工作目录'),
                  h('input', { className: 'ssl-input', value: workspace, placeholder: '留空 = DSH 当前目录', onChange: event => setWorkspace(event.target.value) })),
                h('label', { className: 'ssl-field ssl-grow', style: { minWidth: '160px' } },
                  h('span', { className: 'ssl-label' }, '验收标准（可选）'),
                  h('input', { className: 'ssl-input', value: criteria, placeholder: '如：测试全部通过、有周报文件', onChange: event => setCriteria(event.target.value) }))),
              h('div', { className: 'ssl-between', style: { marginTop: '14px' } },
                h('span', { className: 'ssl-caption' }, busy ? '同一时间只受理一份奏折，请等当前这份办完'
                  : autonomous ? '自治模式：拟旨 → 封驳 → 六部执行 → 复核 → 自我修复 → 自动归档，全程不问你'
                  : '中书拟旨 → 门下封驳 → 尚书派单 → 六部执行 → 上奏'),
                h('button', { className: 'ssl-btn ssl-btn--seal', disabled: busy || sending || !brief.trim(), onClick: submit }, sending ? '开朝中…' : '下旨'))),
            h('div', { className: 'ssl-card' },
              h('div', { className: 'ssl-card-h' },
                h('h4', { className: 'ssl-card-t' }, '最近奏折'),
                state.edicts.length ? h('button', { className: 'ssl-btn ssl-btn--ghost ssl-btn--sm', onClick: () => onOpenEdict(null) }, '全部 →') : null),
              recent.length
                ? h('div', { className: 'ssl-list', style: { margin: '-4px -8px' } }, recent.map(item => h('button', {
                    key: item.id, className: 'ssl-item', onClick: () => onOpenEdict(item.id),
                  },
                  h('div', { className: 'ssl-item-t ssl-ellipsis' }, item.brief),
                  h('div', { className: 'ssl-item-m' }, h(StatusPill, { status: item.status }), dateTimeText(item.createdAt)))))
                : h('div', { className: 'ssl-empty' }, '还没有奏折。写下圣意，开第一次朝会。'))),
          current ? h('div', { className: 'ssl-card', style: { marginTop: '12px' } },
            h('div', { className: 'ssl-card-h' },
              h('div', { className: 'ssl-grow' },
                h('h4', { className: 'ssl-card-t ssl-ellipsis' }, current.brief),
                h('div', { className: 'ssl-caption' }, current.note || current.id)),
              h('button', { className: 'ssl-btn ssl-btn--sm', onClick: () => onOpenEdict(current.id) }, '查看奏折')),
            h(Flow, { edict: current })) : null,
          h(CourtRoster, { state, onRefresh, notify }));
      }

      // ---------- 值房：各岗位此刻在干什么 ----------
      function WorkroomTab({ state, onOpenEdict }) {
        const liveByRole = useMemo(() => {
          const map = {};
          (state.live || []).forEach(item => { map[item.roleId] = item; });
          return map;
        }, [state.live]);
        const running = state.edicts.find(item => item.status === 'running');
        const liveCount = (state.live || []).length;

        return h('div', null,
          h('div', { className: 'ssl-card' },
            h('div', { className: 'ssl-card-h', style: { marginBottom: running ? '16px' : 0 } },
              h('div', { className: 'ssl-grow' },
                h('h4', { className: 'ssl-card-t ssl-ellipsis' }, running ? running.brief : '朝堂清静'),
                h('div', { className: 'ssl-caption' }, running ? `${running.note || ''} · ${running.id}` : '没有正在办理的奏折，下旨后这里会实时显示各岗位的输出')),
              running ? h('button', { className: 'ssl-btn ssl-btn--sm', onClick: () => onOpenEdict(running.id) }, '查看奏折')
                : h(StatusPill, { status: 'idle', text: '无差事' })),
            running ? h(Flow, { edict: running }) : null),
          h(Section, { title: '值房', note: liveCount ? `${liveCount} 个岗位正在办差 · 每 2 秒刷新` : '各岗位空闲' }),
          h('div', { className: 'ssl-grid' }, ALL_ROLES.map(roleId => {
            const role = state.roles[roleId] || {};
            const live = liveByRole[roleId];
            const agent = state.agents.find(item => item.id === role.agentId) || {};
            return h('div', { key: roleId, className: cx('ssl-card ssl-role', live && 'is-live') },
              h('div', { className: 'ssl-role-head' },
                h('span', { className: 'ssl-glyph' }, (role.title || roleId).slice(0, 1)),
                h('div', { className: 'ssl-grow' },
                  h('div', { className: 'ssl-role-title' }, role.title || roleId),
                  h('div', { className: 'ssl-caption ssl-ellipsis' }, `${agent.name || '空缺'}${role.model ? ` · ${role.model}` : ''}`)),
                live ? h(StatusPill, { status: 'running', text: fmtElapsed(live.elapsedMs) }) : h(StatusPill, { status: 'idle' })),
              live ? h('div', { style: { marginTop: '12px' } },
                h('div', { className: 'ssl-between' },
                  h('span', { className: 'ssl-pill ssl-pill--plain' }, live.kind),
                  h('span', { className: 'ssl-caption ssl-ellipsis' }, live.title || '处理中')),
                h(Terminal, { text: live.tail, max: 1200, height: 180 }))
                : h('div', { className: 'ssl-caption', style: { marginTop: '12px' } }, '暂无差事'));
          })));
      }

      // ---------- 值房浮层：常驻在 DSH 界面右下角（shell.overlay） ----------
      function Hud() {
        const { state } = useCourtState();
        const [open, setOpen] = useState(false);
        const paneOpen = usePaneOpen();
        const live = (state && state.live) || [];
        if (!live.length || paneOpen) return null;
        return h('div', { className: 'ssl-overlay ssl-hud' },
          open ? h('div', { className: 'ssl-hud-panel' },
            h('div', { className: 'ssl-between', style: { marginBottom: '10px' } },
              h('b', { style: { fontSize: '13px' } }, '值房'),
              h('button', { className: 'ssl-btn ssl-btn--ghost ssl-btn--sm', onClick: () => setOpen(false) }, '收起')),
            live.map(item => h('div', { key: `${item.edictId}:${item.roleId}`, className: 'ssl-hud-item' },
              h('div', { className: 'ssl-between' },
                h('b', { style: { fontSize: '12.5px' } }, `${item.role} · ${item.kind}`),
                h('span', { className: 'ssl-caption' }, fmtElapsed(item.elapsedMs))),
              h('div', { className: 'ssl-caption ssl-ellipsis' }, `${item.agent}${item.model ? ` · ${item.model}` : ''}${item.title ? ` · ${item.title}` : ''}`),
              h(Terminal, { text: item.tail, max: 500, height: 120 })))) : null,
          h('button', { className: 'ssl-hud-pill', title: '三省六部 · 值房', onClick: () => setOpen(value => !value) },
            h('span', { className: 'ssl-dot ssl-dot--pulse' }),
            `朝堂 ${live.length} 在办`,
            h('span', { className: 'ssl-muted' }, live.map(item => item.role).slice(0, 2).join('、'))));
      }

      // ---------- 殿宇：改 DSH 自己的样子 ----------
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

      function HallTab({ state, onRefresh, notify }) {
        const ui = state.ui || {};
        const currentTheme = ui.theme || 'default';
        const currentSkin = ui.skin || 'default';
        const save = next => {
          apiJson('/ui', { method: 'PUT', body: JSON.stringify(next) })
            .then(() => { onRefresh(); notify('已应用'); })
            .catch(error => notify(String(error.message || error), 'err'));
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
          selected ? h('span', { className: 'ssl-pill ssl-pill--seal' }, '使用中') : null),
        h('div', { className: 'ssl-caption', style: { marginTop: '2px' } }, desc));

        const themeCards = [
          pick('default', currentTheme === 'default', () => chooseTheme('default'),
            h(Swatch, { bg: '#f4f4f5', side: '#ebebed', panel: '#ffffff', text: '#18181b', accent: '#3f3f46', line: '#e4e4e7' }),
            'DSH 默认主题', '回到你原本的明暗设置'),
          ...Object.keys(THEMES).map(key => {
            const t = THEMES[key].tokens;
            const preview = THEMES[key].backdrop
              ? h('div', {
                  className: 'ssl-swatch',
                  style: { background: `linear-gradient(rgba(12,7,5,.2),rgba(12,7,5,.35)), url("${backdropUrl(ui.background, ui.backgroundVersion)}") center/cover` },
                })
              : h(Swatch, {
                  bg: t['--dsw-alias-bg-base'], side: t['--dsw-specific-sidebar-fill'], panel: t['--dsw-alias-bg-layer-1'],
                  text: t['--dsw-alias-label-primary'], accent: t['--dsw-alias-brand-primary'], line: t['--dsw-alias-border-l2'],
                });
            return pick(key, currentTheme === key, () => chooseTheme(key), preview, THEMES[key].name, `${THEMES[key].desc}`);
          }),
        ];

        const fileRef = useRef(null);
        const [uploading, setUploading] = useState(false);
        const upload = file => {
          if (!file) return;
          if (file.size > 10 * 1024 * 1024) { notify('图片太大了（上限 10MB）', 'err'); return; }
          const reader = new FileReader();
          reader.onload = () => {
            setUploading(true);
            apiJson('/background', { method: 'PUT', body: JSON.stringify({ dataUrl: reader.result }) })
              .then(next => {
                setBackdropOptions(next);
                onRefresh();
                notify(currentTheme === 'zijin' ? '背景已更换' : '背景已上传，切到「紫禁城 · 朝堂」主题即可看到');
              })
              .catch(error => notify(String(error.message || error), 'err'))
              .finally(() => setUploading(false));
          };
          reader.onerror = () => notify('读取图片失败', 'err');
          reader.readAsDataURL(file);
        };
        const resetBackground = () => apiJson('/background', { method: 'DELETE' })
          .then(next => { setBackdropOptions(next); onRefresh(); notify('已恢复内置宫殿图'); })
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
                background: `linear-gradient(rgba(12,7,5,${dim}),rgba(12,7,5,${Math.min(0.9, dim + 0.12)})), url("${backdropUrl(ui.background, ui.backgroundVersion)}") center/cover`,
              },
            }),
            h('div', { className: 'ssl-grow', style: { minWidth: '220px' } },
              h('div', { className: 'ssl-role-title' }, ui.background === 'custom' ? '自定义背景图' : '内置宫殿插画'),
              h('div', { className: 'ssl-caption', style: { margin: '2px 0 10px' } },
                '只在「紫禁城 · 朝堂」主题下显示。可以换成你自己的紫禁城照片（png / jpg / webp，10MB 以内，请用你有权使用的图片）。'),
              h('div', { className: 'ssl-actions' },
                h('input', {
                  ref: fileRef, type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', style: { display: 'none' },
                  onChange: event => { upload(event.target.files && event.target.files[0]); event.target.value = ''; },
                }),
                h('button', { className: 'ssl-btn ssl-btn--sm', disabled: uploading, onClick: () => fileRef.current && fileRef.current.click() }, uploading ? '上传中…' : '上传图片'),
                ui.background === 'custom' ? h('button', { className: 'ssl-btn ssl-btn--ghost ssl-btn--sm', onClick: resetBackground }, '恢复内置') : null,
                h('span', { className: 'ssl-caption', style: { marginLeft: '6px' } }, '压暗'),
                [['浅', 0.25], ['中', 0.45], ['深', 0.65]].map(([label, value]) => h('button', {
                  key: label,
                  className: cx('ssl-chip', Math.abs(dim - value) < 0.05 && 'is-active'),
                  onClick: () => setDim(value),
                }, label))))));

        const skinCards = Object.keys(SKINS).map(key => {
          const skin = SKINS[key];
          const tk = skin.tokens;
          const preview = tk
            ? h('div', { style: { display: 'flex', gap: '6px', marginBottom: '12px' } },
                h('div', { style: { flex: 1 } }, h(Swatch, { bg: tk['--dsw-alias-bg-base'].light, side: tk['--dsw-specific-sidebar-fill'].light, panel: tk['--dsw-alias-bg-layer-1'].light, text: '#1f1f1f', accent: tk['--dsw-alias-brand-primary'].light, line: tk['--dsw-alias-border-l2'].light })),
                h('div', { style: { flex: 1 } }, h(Swatch, { bg: tk['--dsw-alias-bg-base'].dark, side: tk['--dsw-specific-sidebar-fill'].dark, panel: tk['--dsw-alias-bg-layer-1'].dark, text: '#ededed', accent: tk['--dsw-alias-brand-primary'].dark, line: tk['--dsw-alias-border-l2'].dark })))
            : h('div', { style: { display: 'flex', gap: '6px', marginBottom: '12px' } },
                h('div', { style: { flex: 1 } }, h(Swatch, { bg: '#f4f4f5', side: '#ebebed', panel: '#ffffff', text: '#18181b', accent: '#3f3f46', line: '#e4e4e7' })),
                h('div', { style: { flex: 1 } }, h(Swatch, { bg: '#18181b', side: '#141416', panel: '#202023', text: '#ededed', accent: '#d4d4d8', line: '#2e2e33' })));
          // 预览里的 Swatch 自带 marginBottom，两张并排时去掉
          return pick(key, currentSkin === key && currentTheme === 'default', () => chooseSkin(key),
            h('div', { className: 'ssl-skin-preview' }, preview), skin.name, skin.desc);
        });

        return h('div', null,
          h(Section, { title: '整套主题', note: '接管明暗设置，切回默认即还原' }),
          h('div', { className: 'ssl-grid' }, themeCards),
          h(Section, { title: '朝堂背景', note: '紫禁城 · 朝堂主题专用' }),
          backgroundCard,
          h(Section, { title: '浅改皮肤', note: '只叠主色与背景层次，跟随你当前的明暗偏好（左浅右深）' }),
          h('div', { className: 'ssl-grid' }, skinCards),
          h(Section, { title: '还做进了 DSH 里' }),
          h('div', { className: 'ssl-card' },
            [
              ['会话头部「下旨」按钮', '正常对话时也能直接开朝，弹窗填圣意即可（conversation.session.header.actions）'],
              ['值房浮层', '有奏折在办时右下角常驻胶囊，点开看实时输出（shell.overlay）'],
              ['侧栏入口 + 独立整页', '老版本 DSH 退回设置页里的「三省六部」（sidebar.panellist + main / settings.section）'],
              ['尚未实现', '工具调用卡片（tool.call.toolview）与产品图标替换：图标需要 ui-primitives 的 ICON_SYMBOLS id'],
            ].map(([title, desc]) => h('div', { key: title, className: 'ssl-feature' },
              h('div', null, h('b', null, title), h('span', null, desc))))));
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
        return h('button', {
          className: 'ssl-header-btn',
          title: '下旨：把任务交给朝堂（三省六部）',
          onClick: () => composer.set(true),
        }, h('b', null, '旨'), '下旨');
      }

      function EdictComposer() {
        const [open, setOpen] = useState(composer.open);
        const [brief, setBrief] = useState('');
        const [workspace, setWorkspace] = useState('');
        const [msg, setMsg] = useState({ text: '', tone: '' });
        const [busy, setBusy] = useState(false);
        useEffect(() => composer.subscribe(setOpen), []);
        useEffect(() => {
          if (!open) return undefined;
          const onKey = event => { if (event.key === 'Escape') composer.set(false); };
          window.addEventListener('keydown', onKey);
          return () => window.removeEventListener('keydown', onKey);
        }, [open]);
        if (!open) return null;
        const submit = () => {
          if (!brief.trim() || busy) return;
          setBusy(true);
          setMsg({ text: '', tone: '' });
          apiJson('/edicts', { method: 'POST', body: JSON.stringify({ brief, workspace: workspace || undefined, workflow: loadWorkflow() }) })
            .then(result => {
              setMsg({ text: `已开朝：${result.id}`, tone: 'ok' });
              setBrief('');
              openPane(PANE_CHAT);
              setTimeout(() => { composer.set(false); setMsg({ text: '', tone: '' }); }, 1200);
            })
            .catch(error => setMsg({ text: String(error.message || error), tone: 'err' }))
            .finally(() => setBusy(false));
        };
        return h('div', {
          className: 'ssl-overlay ssl-mask',
          onClick: event => { if (event.target === event.currentTarget) composer.set(false); },
        },
        h('div', { className: 'ssl-modal', role: 'dialog', 'aria-label': '下旨' },
          h('div', { className: 'ssl-modal-h' },
            h('span', { className: 'ssl-seal' }, '旨'),
            h('div', null,
              h('div', { className: 'ssl-role-title', style: { fontSize: '15px' } }, '下旨 · 交给朝堂办理'),
              h('div', { className: 'ssl-caption' }, '中书拟旨 → 门下封驳 → 尚书派单 → 六部执行 → 上奏'))),
          h('label', { className: 'ssl-field' },
            h('span', { className: 'ssl-label' }, '圣意'),
            h('textarea', {
              className: 'ssl-input', value: brief, autoFocus: true,
              placeholder: '例：把 reports/ 里的 CSV 汇总成月度报表，写一份周报，并检查本周改动的测试是否通过。',
              onChange: event => setBrief(event.target.value),
              onKeyDown: event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) submit(); },
            })),
          h('label', { className: 'ssl-field' },
            h('span', { className: 'ssl-label' }, '工作目录'),
            h('input', { className: 'ssl-input', value: workspace, placeholder: '留空 = DSH 当前目录', onChange: event => setWorkspace(event.target.value) })),
          msg.text ? h('div', { className: cx('ssl-alert', msg.tone === 'ok' && 'ssl-alert--info') }, msg.text) : null,
          h('div', { className: 'ssl-actions', style: { justifyContent: 'flex-end', marginTop: '18px' } },
            h('button', { className: 'ssl-btn', onClick: () => composer.set(false) }, '取消'),
            h('button', { className: 'ssl-btn ssl-btn--seal', disabled: busy || !brief.trim(), onClick: submit }, busy ? '开朝中…' : '下旨'))));
      }

      // ---------- 往来：公文流 ----------
      function MessageList({ messages, onOpen }) {
        if (!messages.length) return h('div', { className: 'ssl-empty' }, '还没有公文往来。');
        return h('div', { className: 'ssl-tl' }, messages.map(item => {
          const tone = item.ok === false ? 'err' : KIND_TONE[item.kind] || 'plain';
          return h('div', { key: item.seq, className: cx('ssl-tl-item', `tone-${tone}`) },
            h('div', { className: 'ssl-tl-head' },
              h('span', { className: cx('ssl-pill', `ssl-pill--${tone}`) }, item.kind),
              h('span', { className: 'ssl-tl-route' }, item.from, h('i', null, '→'), item.to),
              item.title ? h('span', { className: 'ssl-caption ssl-ellipsis' }, item.title) : null),
            item.summary ? h('div', { className: 'ssl-tl-body' }, item.summary.length > 280 ? `${item.summary.slice(0, 280)}…` : item.summary) : null,
            h('div', { className: 'ssl-tl-foot' },
              h('span', null, timeText(item.at)),
              item.model ? h('span', { className: 'ssl-mono' }, item.model) : null,
              item.durationMs ? h('span', null, `用时 ${fmtElapsed(item.durationMs)}`) : null,
              item.ok === false ? h('span', { style: { color: 'var(--ssl-err)' } }, '失败') : null,
              item.artifact ? h('button', { className: 'ssl-link', onClick: () => onOpen(item.artifact) }, '查看文书') : null));
        }));
      }

      // ---------- 奏折：列表 + 详情 ----------
      const FILTERS = [
        ['all', '全部', () => true],
        ['active', '在办', item => item.status === 'running' || item.status === 'queued'],
        ['approval', '待批红', item => item.status === 'awaiting-approval'],
        ['done', '已归档', item => item.status === 'done'],
        ['closed', '未成', item => item.status === 'failed' || item.status === 'rejected' || item.status === 'cancelled'],
      ];

      function MemorialTab({ state, onRefresh, notify, focusId }) {
        const [selected, setSelected] = useState(focusId || null);
        const [detail, setDetail] = useState(null);
        const [artifact, setArtifact] = useState({ name: '', text: '' });
        const [filter, setFilter] = useState('all');
        const [rejecting, setRejecting] = useState(false);
        const [rejectNote, setRejectNote] = useState('');
        const viewerRef = useRef(null);

        useEffect(() => { if (focusId) setSelected(focusId); }, [focusId]);

        useEffect(() => {
          setDetail(null);
          setArtifact({ name: '', text: '' });
          setRejecting(false);
          if (!selected) return undefined;
          let alive = true;
          const pull = () => apiJson(`/edicts/${selected}`)
            .then(data => { if (alive) setDetail(data); })
            .catch(error => { if (alive) notify(String(error.message || error), 'err'); });
          pull();
          const timer = setInterval(pull, 2000);
          return () => {
            alive = false;
            clearInterval(timer);
          };
        }, [selected]);

        useEffect(() => {
          if (!selected && state.edicts.length) setSelected(state.edicts[0].id);
        }, [state.edicts, selected]);

        const act = (action, body, okText) => {
          apiJson(`/edicts/${selected}/${action}`, { method: 'POST', body: JSON.stringify(body || {}) })
            .then(() => { notify(okText); onRefresh(); return apiJson(`/edicts/${selected}`); })
            .then(setDetail)
            .catch(error => notify(String(error.message || error), 'err'));
        };

        const openArtifact = name => apiJson(`/artifact?id=${encodeURIComponent(selected)}&name=${encodeURIComponent(name)}`)
          .then(data => {
            setArtifact({ name, text: data.text || '' });
            setTimeout(() => { if (viewerRef.current) viewerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 30);
          })
          .catch(error => notify(String(error.message || error), 'err'));

        const filterFn = (FILTERS.find(item => item[0] === filter) || FILTERS[0])[2];
        const list = state.edicts.filter(filterFn);

        if (!state.edicts.length) {
          return h('div', { className: 'ssl-card ssl-empty' }, '还没有奏折。去「朝堂」下旨，或在对话里让模型调用 sansheng_edict。');
        }

        const side = h('div', { className: 'ssl-side' },
          h('div', { className: 'ssl-filter' }, FILTERS.map(([id, text, fn]) => {
            const n = state.edicts.filter(fn).length;
            return h('button', { key: id, className: cx('ssl-chip', filter === id && 'is-active'), onClick: () => setFilter(id) }, id === 'all' ? text : `${text} ${n}`);
          })),
          list.length ? h('div', { className: 'ssl-list' }, list.map(item => h('button', {
            key: item.id,
            className: cx('ssl-item', selected === item.id && 'is-active'),
            onClick: () => setSelected(item.id),
          },
          h('div', { className: 'ssl-item-t ssl-ellipsis' }, item.brief),
          h('div', { className: 'ssl-item-m' }, h(StatusPill, { status: item.status }), dateTimeText(item.createdAt)))))
            : h('div', { className: 'ssl-empty' }, '这一类下没有奏折'));

        let main;
        if (!detail) {
          main = h('div', { className: 'ssl-card ssl-empty' }, selected ? '加载中…' : '左侧选择一份奏折');
        } else {
          const canApprove = detail.status === 'awaiting-approval';
          const canReject = canApprove || detail.status === 'running';
          const canCancel = detail.status === 'running' || detail.status === 'queued';
          main = h('div', { className: 'ssl-stack' },
            h('div', { className: 'ssl-card' },
              h('div', { className: 'ssl-row' },
                h('div', { className: 'ssl-grow' },
                  h('p', { className: 'ssl-brief' }, detail.brief),
                  h('div', { className: 'ssl-meta' },
                    h(StatusPill, { status: detail.status }),
                    h('span', { className: 'ssl-mono' }, detail.id),
                    h('span', null, dateTimeText(detail.createdAt)),
                    detail.autonomous ? h('span', { className: 'ssl-pill ssl-pill--ok' }, '自治') : null,
                    detail.rounds ? h('span', null, `拟旨 ${detail.rounds} 轮`) : null,
                    detail.fixRounds ? h('span', null, `自我修复 ${detail.fixRounds} 轮`) : null,
                    detail.note ? h('span', null, detail.note) : null))),
              h('div', { style: { margin: '18px 0 4px' } }, h(Flow, { edict: detail })),
              detail.error ? h('div', { className: 'ssl-alert' }, detail.error) : null,
              canApprove || canReject || canCancel ? h('div', { className: 'ssl-actions', style: { marginTop: '16px' } },
                canApprove ? h('button', { className: 'ssl-btn ssl-btn--seal', onClick: () => act('approve', null, '已批红归档') }, '批红') : null,
                canReject && !rejecting ? h('button', { className: 'ssl-btn ssl-btn--danger', onClick: () => setRejecting(true) }, '驳回') : null,
                canCancel ? h('button', { className: 'ssl-btn', onClick: () => act('cancel', null, '已叫停') }, '叫停') : null,
                rejecting ? h('div', { className: 'ssl-actions ssl-grow', style: { minWidth: '260px' } },
                  h('input', {
                    className: 'ssl-input ssl-grow', autoFocus: true, value: rejectNote, placeholder: '驳回理由（可选）',
                    onChange: event => setRejectNote(event.target.value),
                    onKeyDown: event => {
                      if (event.key === 'Enter') { act('reject', { note: rejectNote || '皇帝驳回' }, '已驳回'); setRejecting(false); setRejectNote(''); }
                      if (event.key === 'Escape') setRejecting(false);
                    },
                  }),
                  h('button', { className: 'ssl-btn ssl-btn--danger', onClick: () => { act('reject', { note: rejectNote || '皇帝驳回' }, '已驳回'); setRejecting(false); setRejectNote(''); } }, '确认驳回'),
                  h('button', { className: 'ssl-btn ssl-btn--ghost', onClick: () => setRejecting(false) }, '取消')) : null) : null),
            detail.live && detail.live.length ? h('div', { className: 'ssl-card' },
              h('div', { className: 'ssl-card-h' }, h('h4', { className: 'ssl-card-t' }, '此刻在办'), h(StatusPill, { status: 'running', text: `${detail.live.length} 个岗位` })),
              detail.live.map(item => h('div', { key: item.roleId, style: { marginTop: '8px' } },
                h('div', { className: 'ssl-between' },
                  h('b', { style: { fontSize: '12.5px' } }, `${item.role} · ${item.kind}${item.title ? ` · ${item.title}` : ''}`),
                  h('span', { className: 'ssl-caption' }, `${item.agent}${item.model ? ` · ${item.model}` : ''} · ${fmtElapsed(item.elapsedMs)}`)),
                h(Terminal, { text: item.tail, max: 1200, height: 180 })))) : null,
            h('div', { className: 'ssl-detail-cols' },
              h('div', { className: 'ssl-card' },
                h('div', { className: 'ssl-card-h' }, h('h4', { className: 'ssl-card-t' }, '公文往来'), h('span', { className: 'ssl-caption' }, `${(detail.messages || []).length} 件`)),
                h(MessageList, { messages: detail.messages || [], onOpen: openArtifact })),
              h('div', { className: 'ssl-stack' },
                h('div', { className: 'ssl-card' },
                  h('div', { className: 'ssl-card-h' }, h('h4', { className: 'ssl-card-t' }, '六部差事'), h('span', { className: 'ssl-caption' }, detail.steps.length ? `${detail.steps.filter(step => step.status === 'done').length}/${detail.steps.length} 已办` : '')),
                  detail.steps.length ? h('div', { className: 'ssl-steps' }, detail.steps.map(step => {
                    const role = state.roles[step.ministry] || {};
                    return h('div', { key: step.seq, className: 'ssl-step' },
                      h('span', { className: 'ssl-step-no' }, step.seq),
                      h('div', { className: 'ssl-grow' },
                        h('div', { className: 'ssl-ellipsis', style: { fontWeight: 500 } }, step.title),
                        h('div', { className: 'ssl-caption ssl-ellipsis' },
                          `${role.title || step.ministry}${step.agent ? ` · ${step.agent}` : ''}${step.retried ? ' · 重办过' : ''}`)),
                      h(StatusPill, { status: step.status === 'pending' && detail.status === 'running' ? 'pending' : step.status }));
                  })) : h('div', { className: 'ssl-empty' }, '尚未派单')),
                h('div', { className: 'ssl-card' },
                  h('div', { className: 'ssl-card-h' }, h('h4', { className: 'ssl-card-t' }, '文书与产物'), h('span', { className: 'ssl-caption' }, `${detail.artifacts.length} 份`)),
                  detail.artifacts.length
                    ? h('div', { className: 'ssl-files' }, detail.artifacts.map(name => h('button', {
                        key: name, className: cx('ssl-file', artifact.name === name && 'is-active'), onClick: () => openArtifact(name),
                      }, name)))
                    : h('div', { className: 'ssl-empty' }, '暂无')))),
            artifact.name ? h('div', { className: 'ssl-card', ref: viewerRef },
              h('div', { className: 'ssl-card-h' },
                h('h4', { className: 'ssl-card-t ssl-mono' }, artifact.name),
                h('button', { className: 'ssl-btn ssl-btn--ghost ssl-btn--sm', onClick: () => setArtifact({ name: '', text: '' }) }, '关闭')),
              h('pre', { className: 'ssl-doc' }, artifact.text || '（空）')) : null,
            h('div', { className: 'ssl-card' },
              h('details', { className: 'ssl-details' },
                h('summary', null, '朝会记录', h('span', { className: 'ssl-caption', style: { fontWeight: 400 } }, `${detail.events.length} 条`)),
                h('div', { className: 'ssl-events' }, detail.events.slice(-60).flatMap((event, index) => {
                  const data = event.data || {};
                  const text = data.note || data.error || data.stage || (data.from ? `${data.from} → ${data.to} ${data.kind || ''}` : '') || data.title || '';
                  return [
                    h('span', { key: `t${index}`, className: 't' }, timeText(event.at)),
                    h('span', { key: `k${index}`, className: 'k' }, event.type),
                    h('span', { key: `d${index}`, className: 'd', title: text }, text),
                  ];
                })))));
        }

        return h('div', { className: 'ssl-split' }, side, main);
      }

      // ---------- 群臣：agent 注册表 ----------
      function AgentsTab({ state, onRefresh, notify }) {
        const [drafts, setDrafts] = useState({});
        const [probe, setProbe] = useState({});
        const [saving, setSaving] = useState(false);

        const edit = (id, patch) => setDrafts(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
        const valueOf = (id, key, fallback) => (drafts[id] && drafts[id][key] !== undefined ? drafts[id][key] : fallback);
        const dirty = Object.keys(drafts).length;

        const save = () => {
          const agents = state.agents.map(item => {
            const draft = drafts[item.id] || {};
            const next = { ...item };
            if (draft.command !== undefined) next.command = draft.command;
            if (draft.argsText !== undefined) next.args = String(draft.argsText).split(/\s+/).filter(Boolean);
            if (draft.modelArgsText !== undefined) next.modelArgs = String(draft.modelArgsText).split(/\s+/).filter(Boolean);
            if (draft.autoArgsText !== undefined) next.autoArgs = String(draft.autoArgsText).split(/\s+/).filter(Boolean);
            if (draft.modelsText !== undefined) next.models = String(draft.modelsText).split(/[,，]/).map(text => text.trim()).filter(Boolean);
            if (draft.enabled !== undefined) next.enabled = draft.enabled;
            return next;
          });
          setSaving(true);
          apiJson('/preset', { method: 'PUT', body: JSON.stringify({ agents, roles: state.roles, rules: state.rules }) })
            .then(() => { setDrafts({}); notify('群臣配置已保存'); onRefresh(); })
            .catch(error => notify(String(error.message || error), 'err'))
            .finally(() => setSaving(false));
        };

        const doProbe = id => {
          setProbe(prev => ({ ...prev, [id]: { pending: true } }));
          apiJson('/probe', { method: 'POST', body: JSON.stringify({ agentId: id }) })
            .then(result => setProbe(prev => ({ ...prev, [id]: result })))
            .catch(error => setProbe(prev => ({ ...prev, [id]: { ok: false, detail: String(error.message || error) } })));
        };

        // 每个 agent 当前担任的官职
        const postsOf = id => ALL_ROLES.filter(roleId => (state.roles[roleId] || {}).agentId === id).map(roleId => (state.roles[roleId] || {}).title || roleId);

        return h('div', null,
          h('div', { className: 'ssl-between', style: { marginBottom: '12px' } },
            h('span', { className: 'ssl-caption' }, '本机可调用的 AI 工具。命令行类可探测是否装好；改完记得保存。'),
            h('span', { className: 'ssl-caption ssl-mono ssl-ellipsis', title: state.root }, state.root)),
          h('div', { className: 'ssl-grid', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))' } }, state.agents.map(item => {
            const check = probe[item.id];
            const enabled = valueOf(item.id, 'enabled', item.enabled !== false);
            const posts = postsOf(item.id);
            return h('div', { key: item.id, className: cx('ssl-card ssl-agent', !enabled && 'is-off') },
              h('div', { className: 'ssl-role-head' },
                h('label', { className: 'ssl-switch', title: enabled ? '已启用' : '已停用' },
                  h('input', { type: 'checkbox', checked: enabled, onChange: event => edit(item.id, { enabled: event.target.checked }) }),
                  h('span', null)),
                h('div', { className: 'ssl-grow' },
                  h('div', { className: 'ssl-role-title' }, item.name),
                  h('div', { className: 'ssl-caption ssl-ellipsis' }, posts.length ? `现任：${posts.join('、')}` : '暂无官职')),
                h('span', { className: 'ssl-pill ssl-pill--plain' }, ADAPTER_LABEL[item.adapter] || item.adapter),
                item.adapter === 'cli' ? h('button', { className: 'ssl-btn ssl-btn--sm', disabled: check && check.pending, onClick: () => doProbe(item.id) }, check && check.pending ? '探测中…' : '探测') : null),
              (item.traits || []).length ? h('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '10px' } },
                item.traits.map(trait => h('span', { key: trait, className: 'ssl-pill' }, trait))) : null,
              item.adapter === 'cli' ? h('div', null,
                h('div', { className: 'ssl-agent-fields' },
                  h('label', { className: 'ssl-field' },
                    h('span', { className: 'ssl-label' }, '命令'),
                    h('input', { className: 'ssl-input ssl-mono', value: valueOf(item.id, 'command', item.command || ''), onChange: event => edit(item.id, { command: event.target.value }) })),
                  h('label', { className: 'ssl-field' },
                    h('span', { className: 'ssl-label' }, '基础参数（空格分隔，可用 {prompt}）'),
                    h('input', { className: 'ssl-input ssl-mono', value: valueOf(item.id, 'argsText', (item.args || []).join(' ')), onChange: event => edit(item.id, { argsText: event.target.value }) }))),
                h('div', { className: 'ssl-agent-fields' },
                  h('label', { className: 'ssl-field' },
                    h('span', { className: 'ssl-label' }, '模型参数（{model}）'),
                    h('input', { className: 'ssl-input ssl-mono', value: valueOf(item.id, 'modelArgsText', (item.modelArgs || []).join(' ')), onChange: event => edit(item.id, { modelArgsText: event.target.value }) })),
                  h('label', { className: 'ssl-field' },
                    h('span', { className: 'ssl-label' }, '模型候选（逗号分隔）'),
                    h('input', { className: 'ssl-input ssl-mono', value: valueOf(item.id, 'modelsText', (item.models || []).join(', ')), onChange: event => edit(item.id, { modelsText: event.target.value }) }))),
                h('label', { className: 'ssl-field' },
                  h('span', { className: 'ssl-label' }, '自治参数（自治模式下追加，放开这个 CLI 自己的权限确认）'),
                  h('input', {
                    className: 'ssl-input ssl-mono',
                    value: valueOf(item.id, 'autoArgsText', (item.autoArgs || []).join(' ')),
                    placeholder: '如 --permission-mode acceptEdits；留空则无人值守时可能写不了文件',
                    onChange: event => edit(item.id, { autoArgsText: event.target.value }),
                  })))
                : h('div', { className: 'ssl-alert ssl-alert--info' },
                    item.adapter === 'self' ? 'DSH 本体：不自动执行，相关步骤会生成待办交回朝堂。' : '人工适配器：这个工具只有图形界面，派到它的差事会生成工单，需人工完成后回填。'),
              check && !check.pending ? h('div', { className: 'ssl-probe' },
                h('span', { className: cx('ssl-pill', check.ok ? 'ssl-pill--ok' : 'ssl-pill--err') }, check.ok ? '找到' : '未找到'),
                h('span', { className: 'ssl-mono ssl-ellipsis', title: check.detail }, check.detail)) : null);
          })),
          h('div', { className: 'ssl-savebar' },
            h('span', { className: 'ssl-caption' }, dirty ? `${dirty} 个 agent 有未保存的修改` : '所有修改已保存'),
            h('div', { className: 'ssl-actions' },
              dirty ? h('button', { className: 'ssl-btn ssl-btn--ghost', onClick: () => setDrafts({}) }, '撤销') : null,
              h('button', { className: 'ssl-btn ssl-btn--primary', disabled: !dirty || saving, onClick: save }, saving ? '保存中…' : '保存群臣配置'))));
      }

      function Toast({ toast }) {
        if (!toast) return null;
        return h('div', { className: cx('ssl-overlay ssl-toast', `ssl-toast--${toast.tone}`), role: 'status' },
          h('span', { className: 'ssl-dot' }), toast.text);
      }

      /** 提示条：返回 [要渲染的节点, notify(text, tone)] */
      function useToast() {
        const [toast, setToast] = useState(null);
        const notify = useCallback((text, tone = 'ok') => setToast({ text, tone, at: Date.now() }), []);
        useEffect(() => {
          if (!toast) return undefined;
          const timer = setTimeout(() => setToast(null), toast.tone === 'err' ? 4200 : 2200);
          return () => clearTimeout(timer);
        }, [toast]);
        return [h(Toast, { toast }), notify];
      }

      // 朝堂状态的共享轮询：头部视图、右侧面板、浮层同时开着时只发一路请求
      const courtStore = {
        state: null,
        error: '',
        timer: null,
        listeners: new Set(),
        pull() {
          apiJson('/state')
            .then(data => { courtStore.state = data; courtStore.error = ''; courtStore.emit(); })
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

      function useCourtState() {
        const [, force] = useState(0);
        useEffect(() => courtStore.subscribe(() => force(n => n + 1)), []);
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

      function App() {
        const [state, setState] = useState(null);
        const [tab, setTab] = useState('court');
        const [error, setError] = useState('');
        const [toastNode, notify] = useToast();
        const [focusId, setFocusId] = useState(null);

        const load = useCallback(() => {
          apiJson('/state')
            .then(data => { setState(data); setError(''); })
            .catch(err => setError(String(err.message || err)));
        }, []);

        useEffect(() => {
          load();
          const timer = setInterval(load, 2000);
          return () => clearInterval(timer);
        }, [load]);

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
          setFocusId(id);
          setTab('memorial');
        };

        const edicts = (state && state.edicts) || [];
        const liveCount = (state && state.live && state.live.length) || 0;
        const awaiting = edicts.filter(item => item.status === 'awaiting-approval').length;
        const running = edicts.filter(item => item.status === 'running').length;
        const archived = edicts.filter(item => item.status === 'done').length;

        const tabs = [
          ['court', '朝堂', null],
          ['workroom', '值房', liveCount ? h('span', { className: 'ssl-count' }, liveCount) : null],
          ['memorial', '奏折', awaiting ? h('span', { className: 'ssl-count ssl-count--seal' }, awaiting) : null],
          ['hall', '殿宇', null],
          ['agents', '群臣', null],
        ];

        return h('div', { className: 'ssl' },
          h('div', { className: 'ssl-head' },
            h('span', { className: 'ssl-seal', 'aria-hidden': true }, '三'),
            h('div', { className: 'ssl-head-text' },
              h('h2', { className: 'ssl-h1' }, '三省六部'),
              h('p', { className: 'ssl-sub' }, '把本机的 AI 工具排成朝堂：中书拟旨、门下封驳、尚书派单、六部办差。每个岗位可单独指定模型。')),
            state ? h('div', { className: 'ssl-stats' },
              h('div', { className: cx('ssl-stat', running && 'ssl-stat--warn') }, h('b', null, running), h('span', null, '在办')),
              h('div', { className: cx('ssl-stat', awaiting && 'ssl-stat--seal') }, h('b', null, awaiting), h('span', null, '待批红')),
              h('div', { className: 'ssl-stat' }, h('b', null, archived), h('span', null, '已归档'))) : null),
          h('nav', { className: 'ssl-nav', role: 'tablist' }, tabs.map(([id, text, badge]) => h('button', {
            key: id, role: 'tab', 'aria-selected': tab === id, className: cx(tab === id && 'is-active'),
            onClick: () => { setTab(id); if (id !== 'memorial') setFocusId(null); },
          }, text, badge))),
          error && !state ? h('div', { className: 'ssl-card' },
            h('div', { className: 'ssl-alert', style: { marginTop: 0 } }, `无法连接宿主：${error}`),
            h('p', { className: 'ssl-caption', style: { margin: '10px 0 0' } }, '确认插件的宿主半已加载（设置 → 插件），或重启 DSH 后再试。'))
            : !state ? h('div', { className: 'ssl-card ssl-empty' }, '加载中…')
            : tab === 'court' ? h(CourtTab, { state, onRefresh: load, notify, onOpenEdict: openEdict })
            : tab === 'workroom' ? h(WorkroomTab, { state, onOpenEdict: openEdict })
            : tab === 'memorial' ? h(MemorialTab, { state, onRefresh: load, notify, focusId })
            : tab === 'hall' ? h(HallTab, { state, onRefresh: load, notify })
            : h(AgentsTab, { state, onRefresh: load, notify }),
          error && state ? h('div', { className: 'ssl-alert' }, `与宿主的连接中断：${error}（显示的是最后一次拿到的状态）`) : null,
          toastNode);
      }

      const SID = 'sansheng-liubu';

      // ================= 做进 DSH：会话头部视图 + 右侧面板 =================
      let sidebarRightApi = null; // ctx.sidebarRight（可选服务，旧版 DSH 没有）
      const PANE_EXEC = 'sansheng-exec';
      const PANE_CHAT = 'sansheng-chat';

      /** 打开右侧面板的某个页签；没有右侧面板服务或当前不在会话里时静默跳过 */
      function openPane(kind) {
        try {
          if (sidebarRightApi && typeof sidebarRightApi.openTab === 'function') sidebarRightApi.openTab(kind);
        } catch (error) {
          console.warn('[三省六部] 打开右侧面板失败：', error);
        }
      }

      // 钦定流程：皇帝在「确定工作流」里排好的部门顺序，存在本机，下旨时一并带上
      const WORKFLOW_KEY = 'sansheng-liubu.workflow';
      const WORKFLOW_TEMPLATES = {
        video: {
          name: '短视频',
          steps: [
            { ministry: 'revenue', title: '对标爆款，定选题与话题' },
            { ministry: 'rites', title: '写脚本与分镜表' },
            { ministry: 'works', title: '逐镜生成画面' },
            { ministry: 'personnel', title: '配乐与音效' },
            { ministry: 'war', title: '剪辑合成成片' },
            { ministry: 'justice', title: '成片质检' },
            { ministry: 'rites', title: '发布标题、描述与话题标签' },
          ],
        },
        dev: {
          name: '研发',
          steps: [
            { ministry: 'war', title: '实现功能' },
            { ministry: 'justice', title: '测试与代码审查' },
            { ministry: 'rites', title: '写变更说明' },
          ],
        },
        report: {
          name: '报告',
          steps: [
            { ministry: 'revenue', title: '整理与分析数据' },
            { ministry: 'rites', title: '撰写报告' },
            { ministry: 'justice', title: '核对数据与结论' },
          ],
        },
      };

      function loadWorkflow() {
        try {
          const list = JSON.parse(localStorage.getItem(WORKFLOW_KEY) || '[]');
          return Array.isArray(list) ? list.filter(item => item && item.ministry) : [];
        } catch {
          return [];
        }
      }

      function saveWorkflow(list) {
        try {
          localStorage.setItem(WORKFLOW_KEY, JSON.stringify(list));
        } catch {
          /* 存不了就只在本次会话里生效 */
        }
      }

      /** 右侧面板默认看哪份奏折：正在办的，否则最近一份 */
      const pickEdict = state => (state ? state.edicts.find(item => item.status === 'running') || state.edicts[0] || null : null);

      function LoadingCard({ error }) {
        return h('div', { className: 'ssl-card ssl-empty' }, error ? `无法连接宿主：${error}` : '加载中…');
      }

      function ViewFrame({ seal, title, sub, toast, children }) {
        return h('div', { className: 'ssl-scroll' },
          h('div', { className: 'ssl ssl-view' },
            h('div', { className: 'ssl-view-head' },
              h('span', { className: 'ssl-seal ssl-seal--sm', 'aria-hidden': true }, seal),
              h('div', null,
                h('div', { className: 'ssl-h1', style: { fontSize: '17px' } }, title),
                h('div', { className: 'ssl-caption' }, sub))),
            children,
            toast));
      }

      // ---------- 头部视图「朝堂职位」 ----------
      function CourtView() {
        const { state, error, refresh } = useCourtState();
        const [toastNode, notify] = useToast();
        return h(ViewFrame, { seal: '职', title: '朝堂职位', sub: '三省六部的人选、模型与职掌，改完立即生效', toast: toastNode },
          state ? h(CourtRoster, { state, onRefresh: refresh, notify }) : h(LoadingCard, { error }));
      }

      // ---------- 头部视图「确定工作流」 ----------
      function WorkflowView() {
        const { state, error, refresh } = useCourtState();
        const [toastNode, notify] = useToast();
        const [steps, setStepsRaw] = useState(loadWorkflow);
        const [brief, setBrief] = useState('');
        const [workspace, setWorkspace] = useState('');
        const [criteria, setCriteria] = useState('');
        const [sending, setSending] = useState(false);
        const setSteps = next => {
          setStepsRaw(next);
          saveWorkflow(next);
        };
        if (!state) return h(ViewFrame, { seal: '流', title: '确定工作流', sub: '', toast: toastNode }, h(LoadingCard, { error }));

        const ministries = state.ministries || [];
        const titleOf = id => (ministries.find(item => item.id === id) || {}).title || id;
        const dutyOf = id => (ministries.find(item => item.id === id) || {}).duty || '';
        const busy = state.busy && state.busy.length > 0;
        const autonomous = state.rules && state.rules.autonomous === true;
        const update = (index, patch) => setSteps(steps.map((item, i) => (i === index ? { ...item, ...patch } : item)));
        const move = (index, delta) => {
          const target = index + delta;
          if (target < 0 || target >= steps.length) return;
          const next = steps.slice();
          [next[index], next[target]] = [next[target], next[index]];
          setSteps(next);
        };

        const submit = () => {
          if (!brief.trim() || busy || sending) return;
          setSending(true);
          apiJson('/edicts', {
            method: 'POST',
            body: JSON.stringify({ brief, workspace: workspace || undefined, criteria: criteria || undefined, workflow: steps }),
          })
            .then(result => {
              notify(`已开朝：${result.id}`);
              setBrief('');
              refresh();
              openPane(PANE_CHAT);
            })
            .catch(err => notify(String(err.message || err), 'err'))
            .finally(() => setSending(false));
        };

        const chain = [
          '中书拟旨', '门下封驳',
          ...(steps.length ? steps.map(item => `${titleOf(item.ministry)}·${item.title || dutyOf(item.ministry).split(/[，、：]/)[0]}`) : ['六部（中书自拟）']),
          '门下复核', autonomous ? '自动归档' : '上奏批红',
        ];

        return h(ViewFrame, { seal: '流', title: '确定工作流', sub: '排好各部门的先后顺序再下旨，中书省必须照此拟旨', toast: toastNode },
          h(Section, { title: '钦定流程', note: steps.length ? `${steps.length} 步，顺序与分工由你定` : '未指定：由中书省自拟' }),
          h('div', { className: 'ssl-card' },
            h('div', { className: 'ssl-between', style: { flexWrap: 'wrap', marginBottom: '12px' } },
              h('div', { className: 'ssl-actions' },
                h('span', { className: 'ssl-caption' }, '模板'),
                Object.entries(WORKFLOW_TEMPLATES).map(([key, template]) => h('button', {
                  key, className: 'ssl-chip', onClick: () => setSteps(template.steps.map(item => ({ ...item }))),
                }, template.name)),
                h('button', { className: 'ssl-chip', onClick: () => setSteps([]) }, '清空（中书自拟）')),
              h('span', { className: 'ssl-caption' }, '最多 12 步')),
            h('div', { className: 'ssl-chain' }, chain.map((text, index) => h(React.Fragment, { key: index },
              index ? h('span', { className: 'ssl-chain-arrow' }, '→') : null,
              h('span', { className: cx('ssl-chain-node', (index < 2 || index >= chain.length - 2) && 'is-fixed') }, text)))),
            steps.length ? h('div', { className: 'ssl-wf' }, steps.map((item, index) => h('div', { key: index, className: 'ssl-wf-row' },
              h('span', { className: 'ssl-step-no' }, index + 1),
              h('select', {
                className: 'ssl-input', value: item.ministry, 'aria-label': `第 ${index + 1} 步部门`,
                onChange: event => update(index, { ministry: event.target.value }),
              }, ministries.map(m => h('option', { key: m.id, value: m.id }, m.title))),
              h('input', {
                className: 'ssl-input', value: item.title, placeholder: dutyOf(item.ministry), 'aria-label': `第 ${index + 1} 步内容`,
                onChange: event => update(index, { title: event.target.value }),
              }),
              h('div', { className: 'ssl-actions', style: { flexWrap: 'nowrap', gap: '2px' } },
                h('button', { className: 'ssl-btn ssl-btn--ghost ssl-btn--sm', title: '上移', disabled: index === 0, onClick: () => move(index, -1) }, '↑'),
                h('button', { className: 'ssl-btn ssl-btn--ghost ssl-btn--sm', title: '下移', disabled: index === steps.length - 1, onClick: () => move(index, 1) }, '↓'),
                h('button', { className: 'ssl-btn ssl-btn--ghost ssl-btn--sm', title: '删除', onClick: () => setSteps(steps.filter((_, i) => i !== index)) }, '✕')))))
              : h('div', { className: 'ssl-empty' }, '没有钦定流程时，中书省按圣意和各部职掌自己拆步骤。选个模板或添加一步来自己定。'),
            h('div', { style: { marginTop: '10px' } },
              h('button', {
                className: 'ssl-btn ssl-btn--sm', disabled: steps.length >= 12,
                onClick: () => setSteps([...steps, { ministry: 'war', title: '' }]),
              }, '+ 添加一步'))),
          h(Section, { title: '下旨', note: '按上面的流程开朝' }),
          h('div', { className: 'ssl-card' },
            h('textarea', {
              className: 'ssl-input', value: brief,
              placeholder: '圣意：要办成什么事？\n例：做一条 25 秒的 TikTok 竖屏视频，主题「打工人 5 分钟早餐」，轻松搞笑。',
              onChange: event => setBrief(event.target.value),
              onKeyDown: event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) submit(); },
            }),
            h('div', { className: 'ssl-row', style: { flexWrap: 'wrap' } },
              h('label', { className: 'ssl-field ssl-grow', style: { minWidth: '200px' } },
                h('span', { className: 'ssl-label' }, '工作目录'),
                h('input', { className: 'ssl-input', value: workspace, placeholder: '留空 = DSH 当前目录', onChange: event => setWorkspace(event.target.value) })),
              h('label', { className: 'ssl-field ssl-grow', style: { minWidth: '160px' } },
                h('span', { className: 'ssl-label' }, '验收标准（可选）'),
                h('input', { className: 'ssl-input', value: criteria, placeholder: '如：时长 22-28 秒、1080x1920', onChange: event => setCriteria(event.target.value) }))),
            h('div', { className: 'ssl-between', style: { marginTop: '14px' } },
              h('span', { className: 'ssl-caption' }, busy ? '朝堂正在办差，办完后再下旨' : autonomous ? '自治模式：全程不问你，下旨后在右侧「各部门沟通」看进展' : '下旨后在右侧「各部门沟通」看进展'),
              h('button', { className: 'ssl-btn ssl-btn--seal', disabled: busy || sending || !brief.trim(), onClick: submit }, sending ? '开朝中…' : '下旨'))),
          h(Section, { title: '朝规' }),
          h(RulesCard, { state, onSave: (patch, okText) => savePresetPatch(state, patch, refresh, notify, okText) }));
      }

      // ---------- 右侧面板「政令执行」 ----------
      function ExecPane() {
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
        else if (!current) body = h('div', { className: 'ssl-card ssl-empty' }, '朝堂清静。到头部「确定工作流」下旨，这里会显示执行进度。');
        else {
          const view = detail || current;
          body = h('div', { className: 'ssl-stack' },
            h('div', { className: 'ssl-card' },
              h('p', { className: 'ssl-brief', style: { fontSize: '14px' } }, view.brief),
              h('div', { className: 'ssl-meta' },
                h(StatusPill, { status: view.status }),
                view.autonomous ? h('span', { className: 'ssl-pill ssl-pill--ok' }, '自治') : null,
                view.note ? h('span', null, view.note) : null),
              h('div', { style: { margin: '14px 0 2px' } }, h(Flow, { edict: view })),
              view.error ? h('div', { className: 'ssl-alert' }, view.error) : null,
              h('div', { className: 'ssl-actions', style: { marginTop: '12px' } },
                view.status === 'awaiting-approval' ? h('button', { className: 'ssl-btn ssl-btn--seal ssl-btn--sm', onClick: () => act('approve', '已批红归档') }, '批红') : null,
                view.status === 'running' ? h('button', { className: 'ssl-btn ssl-btn--sm', onClick: () => act('cancel', '已叫停') }, '叫停') : null,
                h('button', { className: 'ssl-btn ssl-btn--ghost ssl-btn--sm', onClick: () => openPane(PANE_CHAT) }, '看各部门沟通'))),
            detail && detail.live && detail.live.length ? h('div', { className: 'ssl-card' },
              h('div', { className: 'ssl-card-h' }, h('h4', { className: 'ssl-card-t' }, '此刻在办'), h(StatusPill, { status: 'running', text: `${detail.live.length} 个岗位` })),
              detail.live.map(item => h('div', { key: item.roleId, style: { marginTop: '6px' } },
                h('div', { className: 'ssl-between' },
                  h('b', { style: { fontSize: '12.5px' } }, `${item.role} · ${item.kind}`),
                  h('span', { className: 'ssl-caption' }, fmtElapsed(item.elapsedMs))),
                h('div', { className: 'ssl-caption ssl-ellipsis' }, `${item.agent}${item.model ? ` · ${item.model}` : ''}${item.title ? ` · ${item.title}` : ''}`),
                h(Terminal, { text: item.tail, max: 900, height: 150 })))) : null,
            h('div', { className: 'ssl-card' },
              h('div', { className: 'ssl-card-h' },
                h('h4', { className: 'ssl-card-t' }, '六部差事'),
                h('span', { className: 'ssl-caption' }, view.steps && view.steps.length ? `${view.steps.filter(step => step.status === 'done').length}/${view.steps.length} 已办` : '')),
              view.steps && view.steps.length ? h('div', { className: 'ssl-steps' }, view.steps.map(step => h('div', { key: step.seq, className: 'ssl-step' },
                h('span', { className: 'ssl-step-no' }, step.seq),
                h('div', { className: 'ssl-grow' },
                  h('div', { className: 'ssl-ellipsis', style: { fontWeight: 500 } }, step.title),
                  h('div', { className: 'ssl-caption ssl-ellipsis' }, `${(state.roles[step.ministry] || {}).title || step.ministry}${step.agent ? ` · ${step.agent}` : ''}`)),
                h(StatusPill, { status: step.status }))))
                : h('div', { className: 'ssl-empty' }, '尚未派单')));
        }
        return h('div', { className: 'ssl-scroll' }, h('div', { className: 'ssl ssl-pane' }, body, toastNode));
      }

      // ---------- 右侧面板「各部门沟通」：公文往来按群聊排开 ----------
      const DEPT_COLORS = ['#b4362b', '#2e6f9e', '#7d4a9e', '#1f8a70', '#c27c0e', '#a0442a', '#8e2f2f', '#4f6372', '#3f7d3a'];
      const DEPT_FIXED = { 皇帝: '#c9a227', 中书省: '#b4362b', 门下省: '#2e6f9e', 尚书省: '#7d4a9e' };
      function deptColor(name) {
        if (DEPT_FIXED[name]) return DEPT_FIXED[name];
        let hash = 0;
        for (const ch of String(name)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
        return DEPT_COLORS[hash % DEPT_COLORS.length];
      }

      function ChatPane() {
        usePaneMounted();
        const { state, refresh } = useCourtState();
        const [toastNode, notify] = useToast();
        const [picked, setPicked] = useState('');
        const auto = pickEdict(state);
        const edictId = picked || (auto && auto.id) || '';
        const [detail] = useEdictDetail(edictId);
        const [doc, setDoc] = useState(null);
        const [draft, setDraft] = useState('');
        const [sending, setSending] = useState(false);
        const listRef = useRef(null);
        const stick = useRef(true);
        const messages = (detail && detail.messages) || [];
        const live = (detail && detail.live) || [];
        const liveKey = live.map(item => item.tail.length).join(',');

        // 有新消息时滚到底；用户往上翻看时不打扰
        useEffect(() => {
          const el = listRef.current;
          if (el && stick.current) el.scrollTop = el.scrollHeight;
        }, [messages.length, liveKey, edictId]);

        const busy = state && state.busy && state.busy.length > 0;
        const send = () => {
          if (!draft.trim() || busy || sending) return;
          setSending(true);
          apiJson('/edicts', { method: 'POST', body: JSON.stringify({ brief: draft, workflow: loadWorkflow() }) })
            .then(result => {
              notify(`已开朝：${result.id}`);
              setDraft('');
              setPicked('');
              stick.current = true;
              refresh();
            })
            .catch(err => notify(String(err.message || err), 'err'))
            .finally(() => setSending(false));
        };
        const openDoc = name => apiJson(`/artifact?id=${encodeURIComponent(edictId)}&name=${encodeURIComponent(name)}`)
          .then(data => setDoc({ name, text: data.text || '' }))
          .catch(err => notify(String(err.message || err), 'err'));

        const bubble = item => {
          const mine = item.from === '皇帝';
          const tone = item.ok === false ? 'err' : KIND_TONE[item.kind] || 'plain';
          return h('div', { key: item.seq, className: cx('ssl-msg', mine && 'is-mine') },
            h('span', { className: 'ssl-avatar', style: { background: deptColor(item.from) } }, mine ? '朕' : item.from.slice(0, 1)),
            h('div', { className: 'ssl-msg-main' },
              h('div', { className: 'ssl-msg-meta' },
                h('b', null, item.from),
                h('span', null, `→ ${item.to}`),
                h('span', { className: cx('ssl-pill', `ssl-pill--${tone}`) }, item.kind),
                h('span', null, timeText(item.at))),
              h('div', { className: cx('ssl-bubble', item.ok === false && 'is-err') },
                item.summary || item.title || '（无摘要）',
                item.model || item.durationMs || item.artifact ? h('div', { className: 'ssl-bubble-foot' },
                  item.model ? h('span', { className: 'ssl-mono' }, item.model) : null,
                  item.durationMs ? h('span', null, `用时 ${fmtElapsed(item.durationMs)}`) : null,
                  item.artifact ? h('button', { className: 'ssl-link', onClick: () => openDoc(item.artifact) }, '查看文书') : null) : null)));
        };

        return h('div', { className: 'ssl ssl-chat' },
          h('div', { className: 'ssl-chat-head' },
            state && state.edicts.length ? h('select', {
              className: 'ssl-input', value: edictId, 'aria-label': '选择奏折',
              onChange: event => { setPicked(event.target.value); stick.current = true; setDoc(null); },
            }, state.edicts.slice(0, 15).map(item => h('option', { key: item.id, value: item.id },
              `${(STATUS[item.status] || [item.status])[0]}｜${item.brief.slice(0, 28)}`)))
              : h('span', { className: 'ssl-caption' }, '还没有奏折'),
            detail ? h(StatusPill, { status: detail.status }) : null),
          h('div', {
            className: 'ssl-chat-list', ref: listRef,
            onScroll: event => {
              const el = event.currentTarget;
              stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            },
          },
          !edictId ? h('div', { className: 'ssl-empty' }, '在下面写圣意下旨，三省六部的往来会像群聊一样出现在这里。')
            : !messages.length && !live.length ? h('div', { className: 'ssl-empty' }, '等待各部回文…')
            : null,
          messages.map(bubble),
          live.map(item => h('div', { key: `live-${item.roleId}`, className: 'ssl-msg' },
            h('span', { className: 'ssl-avatar', style: { background: deptColor(item.role) } }, item.role.slice(0, 1)),
            h('div', { className: 'ssl-msg-main' },
              h('div', { className: 'ssl-msg-meta' },
                h('b', null, item.role),
                h('span', null, `${item.kind} · 办差中 ${fmtElapsed(item.elapsedMs)}`)),
              h('div', { className: 'ssl-bubble is-live' },
                item.tail ? h('div', { className: 'ssl-mono', style: { whiteSpace: 'pre-wrap' } }, item.tail.slice(-260)) : null,
                h('span', { className: 'ssl-typing', 'aria-label': '正在输出' }, h('i'), h('i'), h('i'))))))),
          h('div', { className: 'ssl-chat-compose' },
            h('textarea', {
              className: 'ssl-input', rows: 2, value: draft,
              disabled: busy,
              placeholder: busy ? '朝会进行中，办完后可再下旨' : '写圣意，Ctrl + Enter 下旨',
              onChange: event => setDraft(event.target.value),
              onKeyDown: event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) send(); },
            }),
            h('div', { className: 'ssl-between', style: { marginTop: '8px' } },
              h('span', { className: 'ssl-caption' }, (() => {
                const n = loadWorkflow().length;
                return n ? `按钦定流程 ${n} 步` : '由中书省自拟流程';
              })()),
              h('button', { className: 'ssl-btn ssl-btn--seal ssl-btn--sm', disabled: busy || sending || !draft.trim(), onClick: send }, sending ? '开朝中…' : '下旨'))),
          doc ? h('div', { className: 'ssl-chat-doc' },
            h('div', { className: 'ssl-card-h', style: { padding: '10px 12px', margin: 0, borderBottom: '1px solid var(--ssl-line)' } },
              h('h4', { className: 'ssl-card-t ssl-mono ssl-ellipsis' }, doc.name),
              h('button', { className: 'ssl-btn ssl-btn--ghost ssl-btn--sm', onClick: () => setDoc(null) }, '关闭')),
            h('pre', { className: 'ssl-doc', style: { margin: '10px', flex: 1, maxHeight: 'none' } }, doc.text || '（空）')) : null,
          toastNode);
      }

      /** 右侧面板「+」页里的入口图标：一枚小印章 */
      const sealIcon = char => function SealIcon({ size = 22, className }) {
        return h('svg', { width: size, height: size, viewBox: '0 0 24 24', className, 'aria-hidden': true },
          h('rect', { x: 1.5, y: 1.5, width: 21, height: 21, rx: 5, fill: '#b4362b' }),
          h('text', {
            x: 12, y: 16.6, textAnchor: 'middle', fontSize: 13, fontWeight: 700, fill: '#fff',
            fontFamily: '"Noto Serif SC", "Songti SC", "STSong", serif',
          }, char));
      };
      const paneTitle = (char, text) => function PaneTitle() {
        return h('span', { className: 'ssl-overlay ssl-pane-title' }, h('span', { className: 'ssl-seal ssl-seal--xs' }, char), text);
      };

      const PANES = [
        { id: `${SID}-exec`, kind: PANE_EXEC, label: '政令执行', desc: '当前奏折的流程、各部差事与实时输出', order: 60, icon: sealIcon('令'), body: ExecPane, title: paneTitle('令', '政令执行') },
        { id: `${SID}-chat`, kind: PANE_CHAT, label: '各部门沟通', desc: '三省六部之间的公文往来，像群聊一样看', order: 61, icon: sealIcon('议'), body: ChatPane, title: paneTitle('议', '各部门沟通') },
      ];

      // 不同 DSH 版本的 slot 契约可能不同：注册失败只告警，不拖垮插件；
      // 设置页那一份是兜底（dsh-mcp-plus 同款，最稳）。
      function apply(ctx) {
        // 1) 独立页面：侧栏入口 + 主区面板。按 dshmarket 的写法，两者在侧栏可用时一起注册，
        //    且 main 的 key 必须等于侧栏条目的 id——点侧栏条目时宿主按这个 id 找面板。
        try {
          ctx.slots.inject('sidebar.panellist', function* () {
            try {
              yield ctx.slots.register({ name: 'main', key: SID, label: () => '三省六部' }, () => h(App));
              yield ctx.slots.register(
                { name: 'sidebar.panellist', id: SID, order: 30, label: () => '三省六部' },
                () => h('span', { style: { fontSize: '13px', fontWeight: 700, fontFamily: '"Noto Serif SC", "Songti SC", "STSong", serif' } }, '三'),
              );
            } catch (error) {
              console.warn('[三省六部] 侧栏页面注册失败：', error);
            }
          });
        } catch (error) {
          console.warn('[三省六部] sidebar.panellist 不可用：', error);
        }

        // 2) 设置页兜底
        try {
          ctx.slots.inject('settings.section', function* () {
            try {
              yield ctx.slots.register(
                { name: 'settings.section', id: SID, order: 41, label: () => '三省六部', inject: () => ({}) },
                App,
              );
            } catch (error) {
              console.warn('[三省六部] settings.section 注册失败：', error);
            }
          });
        } catch (error) {
          console.warn('[三省六部] settings.section 不可用：', error);
        }

        // 3) 值房浮层：有奏折在办时，右下角常驻一枚可展开的胶囊
        try {
          ctx.slots.inject('shell.overlay', function* () {
            try {
              yield ctx.slots.register({ name: 'shell.overlay', id: `${SID}-hud`, label: () => '三省六部' }, Hud);
            } catch (error) {
              console.warn('[三省六部] shell.overlay 注册失败：', error);
            }
          });
        } catch (error) {
          console.warn('[三省六部] shell.overlay 不可用：', error);
        }

        // 4a) 会话头部「下旨」按钮：正常对话时也能直接开朝
        try {
          ctx.slots.inject('conversation.session.header.actions', function* () {
            try {
              yield ctx.slots.register(
                { name: 'conversation.session.header.actions', id: `${SID}-edict`, label: () => '下旨' },
                EdictHeaderButton,
              );
            } catch (error) {
              console.warn('[三省六部] 会话头部按钮注册失败：', error);
            }
          });
        } catch (error) {
          console.warn('[三省六部] conversation.session.header.actions 不可用：', error);
        }

        // 4b) 下旨弹窗：走浮层渲染，不受头部空间限制
        try {
          ctx.slots.inject('shell.overlay', function* () {
            try {
              yield ctx.slots.register({ name: 'shell.overlay', id: `${SID}-composer`, label: () => '下旨' }, EdictComposer);
            } catch (error) {
              console.warn('[三省六部] 下旨弹窗注册失败：', error);
            }
          });
        } catch (error) {
          console.warn('[三省六部] 下旨弹窗不可用：', error);
        }

        // 6) 会话头部视图：与「对话」「轨迹」并列（conversation.view；新视图可能先收在「···」里，可以固定出来）
        try {
          ctx.slots.inject('conversation.view', function* () {
            try {
              yield ctx.slots.register(
                { name: 'conversation.view', id: `${SID}-court`, order: 20, label: () => '朝堂职位', inject: sessionId => ({ sessionId }) },
                CourtView,
              );
              yield ctx.slots.register(
                { name: 'conversation.view', id: `${SID}-workflow`, order: 21, label: () => '确定工作流', inject: sessionId => ({ sessionId }) },
                WorkflowView,
              );
            } catch (error) {
              console.warn('[三省六部] 会话视图注册失败：', error);
            }
          });
        } catch (error) {
          console.warn('[三省六部] conversation.view 不可用：', error);
        }

        // 7) 右侧面板页签：政令执行 / 各部门沟通。类型登记走 sidebarRightTabs，页签正文与标题走 slot，三者用同一个 id 对上
        for (const pane of PANES) {
          try {
            ctx.slots.inject('sidebar.right.pane.tab', function* () {
              try {
                yield ctx.slots.register({ name: 'sidebar.right.pane.tab', key: pane.id }, pane.body);
              } catch (error) {
                console.warn(`[三省六部] 右侧页签注册失败（${pane.label}）：`, error);
              }
            });
            ctx.slots.inject('sidebar.right.pane.tab.title', function* () {
              try {
                yield ctx.slots.register({ name: 'sidebar.right.pane.tab.title', key: pane.id }, pane.title);
              } catch (error) {
                console.warn(`[三省六部] 右侧页签标题注册失败（${pane.label}）：`, error);
              }
            });
          } catch (error) {
            console.warn('[三省六部] 右侧面板 slot 不可用：', error);
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
                  title: () => pane.label,
                  guide: [{ id: pane.kind, order: pane.order, title: () => pane.label, description: () => pane.desc, icon: pane.icon }],
                }), `sansheng-liubu: ${pane.kind}`);
              } catch (error) {
                console.warn(`[三省六部] 右侧页签类型登记失败（${pane.label}）：`, error);
              }
            }
            scope.effect(() => () => { sidebarRightApi = null; }, 'sansheng-liubu: sidebar right');
          });
        } catch (error) {
          console.warn('[三省六部] 右侧面板服务不可用，政令执行 / 各部门沟通跳过：', error);
        }

        // 5) 主题：注册整套主题（宫廷·朱 / 墨夜·金 / 紫禁城）+ 令牌叠加皮肤（官方 ctx.theme 扩展点，缺失就跳过）
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
                console.warn(`[三省六部] 主题注册失败（${key}）：`, error);
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
            // 第三方主题不进 DSH 的设置持久化：启动时主动拉一次存档恢复，不必等用户打开三省六部页
            apiJson('/state')
              .then(data => {
                const ui = (data && data.ui) || {};
                setBackdropOptions(ui);
                applyTheme(ui.theme || 'default');
                applySkin(ui.skin || 'default');
              })
              .catch(() => {});
          });
        } catch (error) {
          console.warn('[三省六部] theme 服务不可用，主题/皮肤功能跳过：', error);
        }
      }

      return { name: 'dsh-sansheng-liubu', inject: ['slots'], apply };
    },
  });
})();
