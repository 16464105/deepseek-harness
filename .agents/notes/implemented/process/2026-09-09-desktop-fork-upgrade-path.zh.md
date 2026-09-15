# Agent Note: 通过外部化定制打通桌面 fork 的升级路径

Status: implemented

[English](2026-09-09-desktop-fork-upgrade-path.md) | 中文

## 问题

本 fork 发布的桌面应用在行为上不同于上游发布版：腾讯 CodeBuddy provider 路由、浏览器工具套件、MCP 管理器及其设置页、Skills 设置页、在有图片随下一次请求发送时拒绝纯文本路由的模型席位、16384px 图片上限，以及生产品牌图形。上游 `dsh-v0.1.5-rc.2` 自带 Electron 应用，因此本次合并以上游的 `apps/desktop` 为基础，再把 fork 的行为重新移植上去。

该合并留下两个问题。打包会内嵌自动更新源，而默认部署解析到 `https://download.deepseek.com`；用户通过该 feed 安装上游发布版会替换打包的 seed，并丢失所有 fork 专有包。此外，fork 的行为有一部分以补丁形式存在于上游文件中，因此每次上游升级都要重新解决同样的冲突。

## 决策

打包后的更新器不跟随上游发布流。`.github/workflows/desktop-macos.yml` 面向一个当前不提供任何内容的部署自有 origin 打包，因此启动检查静默失败，不会提供任何上游构建；一旦存在内部 feed，用一个仓库变量切换 origin 即可。

fork 行为的外部化分两层推进，因为两层的前提条件不同。

**第一层——组合即可表达，无需上游改动。** 凡是已验证的 `Config` 字段、可替换的插件槽位或构建环境变量能表达的定制，都从补丁源码中移出。16384px 单边图片上限是第一个：`attachment-local` 已把 `maxImageDimension` 声明为已验证字段，因此由 `packages/bundle/desktop-app/cordis.patch.yml` 设置它，而 `packages/attachment/attachment-local` 重新与上游一致。品牌图形本已是可替换的占位者：`ui-brand-official` 填充 `sidebar.brand.name` 与 `sidebar.brand.mark`，而 `sidebar.brand.name` 是单占位槽位，后注册者可用更低优先级遮蔽它。产品标题在回退到 locale 之前先读取 `process.env.DSH_CLIENT_TITLE`。

**第二层——需要上游扩展点，fork 无法独自提供。** 仍有 10 个上游源文件承载 fork 行为，分四组：

- `packages/api/session-controller` 把路由声明的输入模态投影进客户端目录，并透传 refresh 请求；原本位于此处的 skill 目录界面现在有自己的包。
- `packages/client/ui-model-selection` 在有图片随下一次请求发送时拒绝纯文本路由。它读取 `useInput`——一个既有的 session 座位——因此不需要新的框架界面，只需要上面的模态字段。
- `packages/client/ui-settings-models` 让 onboarding 步骤通用化：`preferredProvider` 是已验证的配置字段，readiness 以该 provider 作为参数。
- `packages/llm/llm-pi-ai` 与 `packages/skill/skill` 承载 `prepareRequest` 适配器钩子与目录刷新 view option。两者都遵循其邻居已有的形态：`prepareRequest` 与 `resolveApiKey`、`resolveAttachments`、`onReplayDegrade` 并列，`refresh` 与 `scope`、`cwd`、`signal` 一同走在 `SkillViewOptions` 上。

八项第一层工作已经落地。`packages/api/remotes` 重新与上游一致：browser popup 与 MCP 设置页各自通过 `ctx.remote.$mount` 挂载自己生成的 Remote contribution（agent-team 客户端使用的模式），因此共享装配不再命名任何一个命名空间。图片上限已移入组合。桌面层挂载 browser、popup、MCP manager 与 MCP 设置这些行，因为上游的 base 与 web-app bundle 完全不含 browser 或 MCP 行——缺少这些行时，打包版本会启动成纯 Web 界面。onboarding 目标成为 `preferredProvider` 配置字段。品牌图形移入 `dsh-client-ui-brand-desktop`，它以更低的槽位优先级遮蔽官方占位者；回退 `FishLogo` 同时恢复了首屏的游动动画，因为它的形变目标是在上游坐标系中生成的。Skills 管理页与用户 skill 目录各自移入独立包（`dsh-client-ui-settings-skill` 与 `dsh-skill-directory`），使 `ui-skill` 只负责聊天选择器。`ui-primitives` 与 `client/locale` 重新与上游一致，模型席位宿主侧的图片需求管线被移除，因为从未有代码设置它——草稿自身的附件一直是唯一有效信号。

这七个桌面专有包可发布，且已位于上游目录树之外，因此一旦它们所补丁的包暴露上述扩展点，就能安装进上游 profile。`@deepseek-ai/dsh-llm-tencent-codebuddy` 已经声明 `dsh.bundle.patch`，因此 CLI profile 可以用 `dsh plugin` 添加腾讯路由，不必等待那些尚未落地的扩展点（[可安装组合包笔记](../architecture/2026-09-15-tencent-codebuddy-installable-profile-bundle.zh.md)）。

## 考虑过的替代方案

**跟随上游发布流并接受替换。** 已否决：上游发布版自带的 seed 不含 fork 专有包，也不含存在于上游文件补丁中的行为，因此安装更新会静默移除腾讯路由、浏览器套件、MCP 与 Skills 设置页，以及图片准入行为。

**在上游应用之外保留 fork 自己的 `apps/desktop`。** 已否决：上游应用已拥有自动更新、macOS 公证、seed 存储、S3 发布上传与 Windows 签名，因此第二个桌面应用会重复全部这些能力并逐渐漂移。

**把所有定制都移入外部插件，且不做任何上游改动。** 作为完整答案已否决：模型席位的图片拦截、skill 目录操作、onboarding 对话框与 pi-ai 请求钩子都需要上游今天尚未声明的扩展点，而浏览器与 MCP 界面还依赖 fork 已经使用的 `ctx.attachments` 与槽位约定。两层拆分把无需上游改动的工作与需要上游改动的工作分开。

## 影响

打包与上游发布流解耦，因此用户不会因自动更新而静默丢失 fork 的定制。fork 仍需维护一个分支，但补丁面是明确的：本文列举的 16 个上游文件，而不是整个桌面应用。

图片上限现在是部署值，因此部署无需改代码即可调整它；共享默认值保持 8192px。在上游具备那些扩展点之前，上游升级仍会在这 16 个文件上冲突。

`pnpm run release:pack --family dsh` 要求整个 family 使用同一版本，因此这七个桌面专有包与上游各包一同使用 `0.1.5-rc.2`。

## 测试

`packages/bundle/desktop-app/tests/desktop-app.spec.ts` 把 bundle 补丁组合到 base 行之上，并把 `attachment-local` 的组合后 `maxImageDimension` 固定为 16384。`packages/attachment/attachment-local/tests/index.spec.ts` 把共享默认值固定为 8192，因此两者不会在无人察觉的情况下一起漂移。桌面打包链路由 `.github/workflows/desktop-macos.yml` 覆盖，它要求打包脚本读取的那些发布标识符。
