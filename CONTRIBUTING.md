# 参与贡献 · Contributing

谢谢你愿意帮朝堂添砖加瓦。下面是改代码之前要知道的几件事；English summary at the end.

## 先聊再改

- **使用问题**发到 [Discussions · Q&A](https://github.com/shilaoban666/dsh-imperial-court/discussions/categories/q-a)，**点子**发到 [Ideas](https://github.com/shilaoban666/dsh-imperial-court/discussions/categories/ideas)。
- **确定的 bug、确定要做的功能**再开 [Issue](https://github.com/shilaoban666/dsh-imperial-court/issues/new/choose)。
- 大改动（新流程、新页面、改提示词）先开 Issue 说一下思路，免得白写。

## 本地跑起来

需要 Node 20+ 与 git，**零依赖**，不用 `npm install`。

```bash
npm test                      # 全部测试：真的 git 仓库 + 假 CLI（test/fake-agent.mjs）跑完整朝会
python -m http.server 8765    # 打开 http://localhost:8765/preview.html 看界面（真实 client.js + 模拟宿主）
```

装进 DSH 自己试：把 `cordis.patch.yml` 里的 `name` 换成本仓库 `index.mjs` 的绝对路径，`dsh --patch cordis.patch.yml`。

## 代码在哪

| 文件 | 管什么 |
|---|---|
| `index.mjs` | 宿主半：状态、HTTP 端点、给模型的工具、丞相府队列 |
| `client.js` | 浏览器半：零构建的 IIFE，React 由 DSH 提供 |
| `lib/court.mjs` | 朝会流程：拟旨 → 封驳 → 派单 → 六部并行 → 巡查 → 复核 |
| `lib/adapters.mjs` | 怎么调各家 CLI（stdin / 参数 / 文件、模型、思考深度、权限） |
| `lib/catalog.mjs` | 群臣市场：常见工具的说明、安装方式、调用模板 |
| `lib/staffing.mjs` | 自动编制与一键推荐 |
| `lib/i18n.mjs`、`lib/modern.mjs` | 中 / 英、古代 / 一人公司两套说法 |
| `preview.html` | 模拟宿主，界面改动在这里看 |

## 几条规矩

1. **测试要钉住新行为。** 改流程就在 `test/` 里加一条端到端用例；假 CLI 不够用就给 `test/fake-agent.mjs` 加一个 `FAKE_FLAGS`。
2. **文案四套都要改**：中文、英文（古罗马）、以及两者的「一人公司」说法。`test/modern.test.mjs` 与 `test/client.test.mjs` 会查现代风格里有没有漏网的古代词。
3. **不夸大。** README、更新日志、提示词里写的数字和能力都要对得上代码；没在真机跑过的，写进「没验证的」。
4. **接一个新工具**：在 `lib/catalog.mjs` 加一项（说明、优缺点、安装方式、调用模板，调用方式要对照该工具的文档或 `--help`），在 `lib/staffing.mjs` 的 `PREFER` 里排个位，`test/roster.test.mjs` 会检查模板能不能存下来。
5. **安全**：不往提示词、存档、日志里写 API Key；新端点要过 `checkRequest`；安全问题按 [SECURITY.md](SECURITY.md) 私下报告。

## 分支与发布

- 从 `master` 拉 `feature/<名字>` 或 `fix/<名字>`，PR 提到 **`dev`**。
- 维护者把 `dev` 合入 `release`（发布分支），再把 `release` 合入 `master` 并打 tag。
- PR 描述里写清：改了什么、怎么验证的、**没验证的**（模板里有）。CI 会在 Windows / macOS / Linux × Node 20 / 22 上跑全部测试。

---

## English summary

- Questions go to [Discussions · Q&A](https://github.com/shilaoban666/dsh-imperial-court/discussions/categories/q-a), ideas to [Ideas](https://github.com/shilaoban666/dsh-imperial-court/discussions/categories/ideas); confirmed bugs and agreed features to Issues.
- Zero dependencies: `npm test` runs everything against real git repositories and a fake CLI; `python -m http.server 8765` and open `preview.html` to see the UI on a mock host.
- Pin new behaviour with a test; update all four string sets (Chinese, English, and the One-Person Company wording of each); do not overstate what the code does.
- Branch from `master`, open the PR against `dev`; `dev` → `release` → `master` (tagged) is done by the maintainer.
