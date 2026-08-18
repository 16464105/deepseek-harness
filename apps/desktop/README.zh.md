# `@deepseek-ai/dsh-desktop`

[English](README.md) | 中文

DeepSeek Harness 的 Electron 应用。主进程会在同一进程内启动随发行版交付的 `desktop` profile，通过随机回环端口加载现有 Web 前端，并在最后一个窗口关闭时负责拆卸 Host。renderer 继续使用与 `dsh web` 相同的 client 插件图；应用不会维护第二套 UI 实现。

## 从源码运行

先完整构建一次仓库，再启动 Electron：

```sh
npx --yes pnpm@11.7.0 run build
npx --yes pnpm@11.7.0 run desktop:start
```

在全新的桌面 home 中，Models 引导弹窗只要求填写腾讯 CodeBuddy Key。保存操作会通过 Harness 凭据服务将密钥写入 `TENCENT_CODEBUDDY_API_KEY`；提供方端点、协议、模型 catalog、容量和请求标头均由包持有。腾讯适配器在任何机器上都提供其固定的 29 模型 catalog——无需本地状态——Models 卡片通过其「自定义设置」折叠区编辑该目录，与直连 DeepSeek 卡片完全一致。Models 选择器也会保留直连 DeepSeek catalog。配置的桌面默认模型仍是 `tencent-internal/gpt-5.6-sol`，它属于固定 catalog。

若启动环境没有设置 `DSH_HOME`，桌面状态位于 Electron 的逐用户应用数据目录下的 `harness/` 中。进程将操作系统 home 目录作为初始 workspace。

## 打包

打包时保留完整的 workspace 安装。Electron Builder 和 TypeScript 编译器属于开发依赖，应用的生产闭包则包含 workspace 链接；删除 `node_modules` 后执行 `npm ci --only=production` 会移除组装本应用所需的工具和本地包图。Electron Builder 会从打包后的应用中排除开发依赖和 package script。

只构建一次仓库并生成两个 macOS DMG：

```sh
npx --yes pnpm@11.7.0 run desktop:package:mac
```

该命令为 Apple 芯片生成 `DeepSeek Harness-<version>-mac-arm64.dmg`，为 Intel 生成 `DeepSeek Harness-<version>-mac-x64.dmg`。每个产物只包含一套 Electron 架构；构建不会生成 Universal 应用。

只需要一种产物时，可单独构建对应架构：

```sh
npx --yes pnpm@11.7.0 run desktop:package:mac:arm64
npx --yes pnpm@11.7.0 run desktop:package:mac:x64
```

需要检查内容或在本机启动时，为当前架构构建未封装应用目录：

```sh
npx --yes pnpm@11.7.0 run desktop:package:dir
```

根命令都会先完整构建仓库。Electron Builder 将产物写入 `apps/desktop/dist/`，并从 `apps/web/public/favicon.svg` 生成各平台的应用图标。JavaScript 与运行时资源位于 `app.asar`；只有原生 addon、必需动态库、ripgrep 和 node-pty helper 保留在 `app.asar.unpacked`。macOS 包只保留目标架构的 Sharp、Koffi、ripgrep、node-pty 和 native-addon 二进制。TypeScript 源码、source map，以及包根目录的测试、文档和示例目录不会进入产物。

桌面包是可执行部署根：其生产依赖会显式提供交付 profile 可达的每个必需 workspace peer。`pnpm run verify-runtime-closure` 会在发布前检查该闭包，避免 Electron Builder 静默遗漏插件的服务包。

## 窗口与 Host 生命周期

BrowserWindow 启用上下文隔离和 Chromium sandbox，关闭 Node 集成，将窗口内导航限制在应用 origin，并用系统浏览器打开普通外部 HTTP(S) 链接。单实例锁会在第二次启动时聚焦已有窗口。本地 Host 只在 `127.0.0.1` 上绑定临时端口，不授予 LAN 信任，关闭 client HMR 和用户 patch 监视，并在 Electron 退出前完成 dispose。

## 已知限制

- **可分发的 macOS DMG 必须同时完成 Developer ID 签名和公证**：Electron Builder 会使用可用的签名身份，并在配置 Apple 凭据后尝试公证。构建日志若显示跳过签名或公证，该产物只能用于本地测试；不要要求接收者通过清除隔离属性来绕过 Gatekeeper。
- **腾讯访问仍依赖企业网络与有效的 CodeBuddy Key**：成功存储密钥只证明本地配置完成；认证和网络可达性由提供方在首次请求时判定。
- **腾讯模型 catalog 是随包交付的快照** — 腾讯更改网关模型时，需要通过下一次包发布或 Models 卡片上的 `models` 覆盖到达本应用。
- **renderer 使用回环 HTTP 载体**：随机端口只在进程内使用且不会打印，但该应用没有用 Electron IPC 替换 Web 载体。
