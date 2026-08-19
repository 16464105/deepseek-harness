# Agent Note：桌面 Windows 包声明目标平台原生依赖

Status: implemented

[English](2026-08-19-desktop-windows-native-dependencies.md) | 中文

## Problem

Windows x64 Electron 包在 `app.asar` 已包含 workspace 模块和 profile patch 的情况下，启动仍以 Cordis include `AggregateError` 失败。Electron Builder 报告未打入平台可选依赖，因为 pnpm 11 不会为打包项目传递安装平台二进制。桌面 manifest 只声明了 macOS 的 Sharp、Koffi、ripgrep 和 native-addon 包。

## Decision

`apps/desktop/package.json` 在 macOS 变体旁声明 Windows x64 的 Koffi、ripgrep 与 `node-addon-require-builtin` 变体。Sharp 已经传递声明自身的平台载荷。`pnpm-workspace.yaml` 在 `supportedArchitectures` 中列出 macOS arm64/x64 与 Windows x64，使 pnpm 在 Electron Builder 计算依赖图前安装所有必需可选包。

当所需 Windows 预构建产物可用时，Windows 交叉打包使用 `electron-builder --win nsis --x64 --config.npmRebuild=false`。没有预构建产物时，原生编译仍由 Windows runner 负责。

## Alternatives considered

**让 Electron Builder 发现传递性平台包。** 拒绝，因为 pnpm 11 有意不为打包项目安装这些包，而 Electron Builder 只报告遗漏，不会让构建失败。

**交叉打包时重编译所有原生依赖。** 拒绝，因为 `node-gyp` 不支持从 macOS 编译 Windows 原生模块。没有预构建产物的依赖仍需回退到 Windows runner。

## Consequences

Windows 安装包包含已发布 profile 所需的原生模块，不再依赖 Electron Builder 发现传递性平台包。macOS 打包保留现有的按架构过滤。发布验证除了检查 workspace 运行时闭包，还必须检查目标包中的原生文件。

## Verification

补充声明后重新构建了 Windows x64 NSIS 包。Electron Builder 跳过依赖重编译，成功打包 `app.asar` 并生成安装包；包内已存在 Windows x64 的 `node-pty` 预构建二进制，其余平台包现已由打包项目显式声明。
