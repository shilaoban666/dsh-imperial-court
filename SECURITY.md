# 安全说明 · Security

## 报告漏洞 · Reporting

请不要开公开 Issue。用 GitHub 的 [私密漏洞报告](https://github.com/shilaoban666/dsh-imperial-court/security/advisories/new) 说明复现步骤与影响。如果那个入口没开，就开一个只写「有安全问题想私下沟通」的 Issue，不要贴细节。

Please do not open a public issue. Use GitHub's [private vulnerability report](https://github.com/shilaoban666/dsh-imperial-court/security/advisories/new) with steps to reproduce and the impact. If that entry is not enabled, open an issue that only says you have a security matter to discuss privately, without details.

## 这个插件能做什么 · What this plugin can do

三省六部在你的机器上启动你配置的命令行工具（Claude Code、Codex、`dsh headless`……），让它们读写工作目录。请把它当成「能替你敲命令的东西」来对待：

- **隔离保护的是仓库，不是机器。** 工作目录是 git 仓库时，每道旨在自己的 `git worktree` 与分支里办，批红前原目录不动。仓库之外的文件、网络、环境变量不在保护范围内。
- **无人值守参数会放开 CLI 自己的确认。** 丞相模式、「完全权限」会追加 `autoArgs`（如 `--full-auto`）。只挂你信任的 CLI，只在你信任的仓库里用。
- **一键安装走的是各家官方脚本**（`irm https://claude.ai/install.ps1 | iex`、`curl -fsSL https://claude.ai/install.sh | bash`、`npm install -g @openai/codex`），只在你点了按钮之后执行。
- **API Key 放环境变量**，不要写进圣意、验收标准或附件：它们会进提示词、奏折存档与实录。

The plugin starts the command-line tools you configure and lets them read and write the working folder. Isolation protects the repository, not the machine; autonomy arguments lift each CLI's own confirmations; one-click install runs the vendors' official install scripts, only after you click; keep API keys in environment variables, never in a decree.

## HTTP 端点 · The HTTP endpoint

界面通过宿主的 `/sansheng-liubu/*` 读写状态。每个请求（读请求也算）要过四道检查：

0. **DSH 的访问检查**：先交给 DSH 自己的 `connection.requestRejection`，与 DSH 核心 API 同一套规则；拿不到这个服务就一律拒绝（v1.2.1 起）。
1. **Host**：只认回环地址、`*.localhost`、IP 字面量，或配置里 `allowedHosts` 放行的域名（挡 DNS 重绑定，读请求也查）。
2. **来源**：浏览器标明跨站的、Origin 与 Host 对不上的拒绝。
3. **类型**：改状态的请求只收 `application/json`（挡跨站表单）。

登录与可信主机由 DSH 的访问检查负责，插件不另设一套。把 DSH 暴露到不可信网络之前，请先按 DSH 的文档配置可信主机与鉴权。

Every request, reads included, first goes through DSH's own access check (`connection.requestRejection`, the same rules as DSH's core API; refused if the service is unavailable, since v1.2.1). The plugin then checks the Host header (loopback, `*.localhost`, IP literals, or names in `allowedHosts`), the request origin, and the content type. Sign-in and trusted hosts are DSH's job; configure them in DSH before exposing it to an untrusted network.

## 支持的版本 · Supported versions

只维护最新的发布版本。Only the latest release is maintained.
