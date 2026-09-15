# Agent Note: Tencent CodeBuddy as an installable profile bundle

Status: implemented

[English](2026-09-15-tencent-codebuddy-installable-profile-bundle.md) | 中文

## 问题

腾讯 CodeBuddy 适配器只有在 [`dsh-desktop-app`](../../../../packages/bundle/desktop-app/README.zh.md) 插入它时才会进入正在运行的 dsh。`dsh plugin --profile <name> add` 只会为声明了 `dsh.bundle.patch` 的包激活配置层，因此把 `@deepseek-ai/dsh-llm-tencent-codebuddy` 安装进 `web`、`headless`、`sdk` 或 `acp` 只会留下普通依赖，永远不会挂载 `tencent-internal`。从这些随附 profile 起步的腾讯员工没有受支持的内网路由安装路径。

## 决策

**`@deepseek-ai/dsh-llm-tencent-codebuddy` 既是适配器插件，也是可安装的 profile 组合包。** 它位于 `packages/tencent-internal/`，与 `packages/llm/` 平级。其 manifest 声明 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`。该 patch 会插入 `llm-tencent-codebuddy` 行，并把 `agent-default-model` 替换为 `tencent-internal/hy3-ioa`。它不设置 `ui-settings-models.preferredProvider`，因此首次进入不会弹出 CodeBuddy Key 填写框。

**随附的 desktop profile 仍通过 `dsh-desktop-app` 挂载该适配器。** 桌面继续使用 `base + web-app + desktop-app` 这三段内置前缀以及嵌套 insert，因此现有 Electron profile 不需要持久化的 bundle 列表迁移。其他 profile 用 `dsh plugin --profile <name> add|remove @deepseek-ai/dsh-llm-tencent-codebuddy` 添加或移除该路由。不要把本组合包添加到已经插入 `llm-tencent-codebuddy` 的树上：第二次插入会重复适配器行。

协议事实仍由本包持有：固定端点、OpenAI Chat Completions 协议、CodeBuddy 标头、payload 归一化，以及包持有的 catalog。该适配器约定相对[桌面 CodeBuddy 笔记](../feature/2026-08-16-electron-desktop-tencent-codebuddy.zh.md)与[catalog 笔记](../feature/2026-08-16-tencent-model-selection-joins-cache-and-user-models.zh.md)没有变化。

## 考虑过的替代方案

**只携带 patch 的独立包装组合包。** 拒绝，因为 [`dsh-subagent-codex`](../../../../packages/subagent/subagent-codex/README.zh.md) 已经用同一个包同时作为插件和组合包，第二个包只会用来插入本适配器。

**把适配器从 `dsh-desktop-app` 移到 `DESKTOP_PROFILE_BUNDLES`。** 延后，因为 Electron 在 Host 启动时直接从 profile manifest 读取 `dsh.profile.bundles`，不经过插件管理器的前缀辅助函数。更改内置前缀却不持久改写清单，会让仍只在 `desktop-app` 内嵌套 insert 的现有桌面安装丢失腾讯路由。

**只插入适配器，不改变默认模型。** 拒绝，因为该层的目的就是把腾讯路由设为默认；若仍把官方 DeepSeek 留作默认，`dsh plugin add` 之后该路由会被藏在手动选择器后面。

**把首次引导目标改到 CodeBuddy Key 输入框。** 拒绝：首次进入不会弹出该 Key 填写框。Models 页面与凭据服务仍存储 `TENCENT_CODEBUDDY_API_KEY`。

## 影响

CLI profile 无需编辑 `dsh-desktop-app` 即可添加腾讯路由。随附的桌面组合仍嵌套插入适配器，并且不会把 Models 引导目标改到 CodeBuddy Key。在 desktop 上再叠本组合包会重复适配器行，包 README 禁止这样做。

## 测试

`packages/tencent-internal/llm-tencent-codebuddy/tests/bundle.spec.ts` 会把已声明 patch 组合到带 base 的树上、缺少 `agent-default-model` 的树上，以及已经插入该适配器的树上，并且不改 `ui-settings-models`。对 scratch home 运行 `dsh plugin --profile web add` 安装本包后，该包会出现在 `dsh.profile.bundles` 中；随后 `--dump-default-config` 会显示一行 `llm-tencent-codebuddy` 与 `tencent-internal/hy3-ioa`，且不设置 `preferredProvider`。`dsh plugin --profile web remove` 会撤回该行并恢复 web 默认值。
