# Agent Note: Electron 桌面客户端与只填 Key 的腾讯 CodeBuddy 配置

Status: implemented

[English](2026-08-16-electron-desktop-tencent-codebuddy.md) | 中文

## 问题

Harness 图形界面需要先运行本地命令，再使用外部浏览器。桌面发行形态需要统一的应用生命周期，同时不能复制已经建立的 Web client、Host 组合、会话持久化或配置服务。腾讯员工还需要使用内网 CodeBuddy 路由，而不应把 TT Switch 提供方细节翻译成一大段 Harness profile；常规设置只应要求填写自己的 Key，非标准 CodeBuddy 安装则可以覆盖客户端状态数据库。

Electron 还带来模块加载限制。Cordis 通常通过 Node 私有模块适配器导入 profile 插件，但 Electron 不公开该适配器。Loader 配置项可能来自嵌套 Include、Group、preset 和运行时 `ctx.loader.create()` 调用，因此只解析启动时的 Include 会让后续插件导入失败。

## 决策

**Electron 通过私有回环 Host 复用已经组装好的 Web 应用。** `apps/desktop` 在进程内启动随发行版交付的 `desktop` profile，取得其临时 `127.0.0.1` Web 服务器 URL，并在启用 sandbox 的 BrowserWindow 中加载该 URL。主进程负责单实例锁与 Host dispose。renderer 继续使用现有 client 插件图和 HTTP/WebSocket 载体；不存在桌面专用前端或协议分叉。

**desktop profile 是 `base + web-app + desktop-app`。** 最后一层只改变部署事实：临时回环绑定、不打印 URL、不注入 Web 表层提示词上下文、不启用 client HMR、保留直接 DeepSeek 适配器、挂载腾讯 CodeBuddy，并选择 `tencent-internal/gpt-5.6-sol`。Electron 启动器会关闭用户 patch 监视，因为其运行时不提供 HMR watcher 所需的 Node 能力。桌面状态默认使用 Electron 自己的 Harness home，而不是 CLI home。

**腾讯协议配置固定，可选模型则跟随本地 CodeBuddy 桌面客户端。** `dsh-llm-tencent-codebuddy` 持有 `https://copilot.tencent.com/v2` 端点、OpenAI Chat Completions 协议、CodeBuddy 路由／IDE 标头、请求身份、消息归一化、流式 usage、最小输出限制，以及从 TT Switch 实现核对的 tool-choice 适配。腾讯只从当前 user 消息处理图片，而 Harness 可能把工作区指令追加为另一条相邻 user 消息；适配器只在相邻 user 消息组含图片时合并该组，并保持片段顺序，不改变普通纯文本历史。适配器提供包持有的固定 catalog：29 个桌面聊天模型（`craft`/`ask`/`plan` 并集，取自一次桌面客户端缓存投影）；配置的 `models` 列表会替换它，这正是 Models 卡片编辑目录的方式（见[模型选择合并笔记](2026-08-16-tencent-model-selection-joins-cache-and-user-models.md)）。它通过公开的 profile 解析和请求准备 hook 复用 pi-ai。Models 引导协调器在 desktop 同时组合两条目标时先选择腾讯 CodeBuddy，未挂载腾讯时再回退到 DeepSeek；因此 desktop 组合优先显示腾讯 Key 输入框，同时保留两个模型 catalog，并通过现有凭据服务存储机密。

**Loader 导入解析是逐实例的 Host hook，并由每棵 EntryTree 调用。** vendored Loader 公开 `resolveImport(specifier, parentURL, attributes)`；`EntryTree.import()` 会在私有适配器或原生 dynamic import 之前调用它。封闭运行时传入 `bareModuleBaseUrl` 时，app boot 会提供一个基于 `createRequire(installAnchor).resolve()` 的 resolver，把裸包名转换为绝对 file URL，同时保留相对配置的导入。同一基准还会安装进程级 Node `registerHooks` 解析回退，使树外模块内部的嵌套 `import` 在 `$DSH_HOME/profiles/node_modules` 符号链接指向 `app.asar` 时仍能到达安装目录（[asar 嵌套 ESM 解析](../bug-fix/2026-08-21-asar-fallback-nested-esm-imports.md)）。client 模块发现使用 Loader hook 解析包元数据，而不是跟随这些可写 profile 符号链接。受维护的 profile module fallback 仍是源码启动和 CJS `createRequire` 用来解析这些包名的已安装依赖闭包。桌面部署清单会显式提供该闭包中的每个必需 workspace peer，仓库运行时闭包门禁会审计两个可执行部署根。该机制覆盖嵌套树和运行时创建的树，并且在有无 Node 私有适配器时都能工作，包括可写 profile 位于应用目录之外的 Electron 归档。

**macOS 发行使用按架构分离的 ASAR DMG。** 一个打包入口会生成 `arm64` 与 `x64` DMG，并在每个文件名中标明架构；构建不会生成 Universal 应用。Electron Builder 会归档 JavaScript 与运行时资源，排除 TypeScript、source map 和包根目录的开发材料，并且只解包必须以普通文件存在的原生库与可执行文件。按架构过滤器只保留匹配的 Sharp、Koffi、ripgrep、node-pty 和 native-addon 包。Developer ID 签名使用构建主机上的可用身份；对外分发要求同一产物完成 Apple 公证，而不是要求接收者关闭 Gatekeeper 隔离。

**Electron 窗口拒绝 renderer 提权。** 应用启用上下文隔离和 Chromium sandbox，关闭 Node 集成，把窗口内导航限制在应用 origin，并且只把普通外部 HTTP(S) URL 交给系统浏览器。

## 考虑过的替代方案

**用 Tauri 重写应用。** 拒绝，因为这会引入第二套原生构建和桥接，而现有 TypeScript Host 与 Web client 已经组成完整产品。

**用 Electron IPC 替换 Web 载体。** 延后，因为它需要第二套载体实现和更广的协议验证，却不能改善所要求的只填 Key 流程。回环服务器仍只绑定一个临时本地端口。该选择取代早期 [GUI 分层 Note](../architecture/2026-07-19-gui-layering-and-rpc-protocol.md)预留的仅 IPC 方向，同时保留其 client/Host 分层。

**继续打开系统浏览器。** 拒绝，因为它无法提供统一客户端生命周期或可分发的桌面应用。

**依赖 Node 私有 Loader 适配器。** 拒绝，因为 Electron 不提供它，而且只解析顶层行会遗漏嵌套或运行时 Loader 树创建的导入。

**交付一个 Universal macOS 应用或直接分发未封装 `.app`。** 拒绝，因为 Universal 构建会同时携带两套 Electron 和原生依赖架构，而未封装应用会在传输和 Gatekeeper 检查时暴露完整文件树。分离 DMG 能明确接收者架构，并让每个传输包只包含一套运行时。

**要求用户配置通用 pi-ai 提供方 profile。** 拒绝，因为端点、协议、模型元数据和 CodeBuddy 请求规则都是部署常量。将它们设为可编辑会增加密钥重定向风险，并要求用户理解协议才能首次使用。

**继续提供内置 catalog。** 拒绝，因为发行快照无法表示已登录 CodeBuddy 桌面客户端当前提供的模型，而且会让不可用的本地缓存看起来仍然健康。客户端缓存缺失或无效时，提供方会直接失败。

**通过腾讯 `/models` 路由发现。** 拒绝，因为 CodeBuddy 通过产品配置交付模型可用性，而不是通过通用 OpenAI 兼容发现端点。读取该本地缓存也避免了携带凭据的启动请求。

## 后果

仓库可以启动并打包一个 Electron 应用，其默认路由是腾讯 CodeBuddy，同时 Models 页面保留官方 DeepSeek 路由及其模型 catalog。腾讯选择器会跟随本地 CodeBuddy 客户端中的桌面聊天模式；其设置卡片可以重新查询数据库，并选择 composer 列出哪些缓存 id。没有可用缓存时，腾讯适配器无法加载。配置的 `gpt-5.6-sol` 默认值可能不在账号缓存中，此时 composer 会保持不可用，直到用户选择一个已提供的模型。两条路由都不可用时，首次引导会先请求腾讯 Key，再回退到 DeepSeek。浏览器与桌面表层共享相同 client 包和 Host API；桌面特有行为只存在于一个 profile 层和一个启动器中。腾讯协议变化需要发布适配器更新，而不是要求用户重新配置。封闭运行时由 app boot 提供 resolver 时，无需 Cordis 的 Node 私有适配器即可导入裸插件，同一安装目录 require 还会应答这些插件内部的嵌套 ESM 导入；Loader vendor 日志会记录这项本地扩展。

macOS 构建会分别生成 Apple 芯片与 Intel DMG。每个组装后的应用只包含一套 Electron 架构及其匹配的可选原生包；ASAR 解包目录只包含运行时必需的原生二进制，而不是完整依赖目录。Developer ID 签名和 Apple 公证没有同时成功时，产物只能用于本地测试。

应用仍会打开一个随机回环监听端口，并依赖企业网络可达性与有效腾讯账号。源码和打包产物 smoke 可以在不发送模型请求的情况下证明启动、引导、凭据持久化、导航策略、拆卸和两种 macOS 架构的原生加载；无密钥浏览器快照会证明只有桌面聊天缓存项能够抵达共用客户端选择器，`cli` 专属项不会出现，也会证明工作区指令跟在图片之后时，图片仍保留在腾讯的当前 user 消息中。远端认证与模型输出需要授权 Key，仍属于外部验证。
