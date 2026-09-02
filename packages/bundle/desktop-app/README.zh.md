---
description: "Electron 应用程序的桌面 profile 补丁层，叠加于 dsh-base 与 dsh-web-app 之上。"
kind: "package-bundle"
---

# `@deepseek-ai/dsh-desktop-app`

[English](README.md) | 中文

## 概述

应用于 [`dsh-base`](../base/README.zh.md) 与 [`dsh-web-app`](../web-app/README.zh.md) 之后的桌面 profile 补丁层。它为 Electron 保留现有 Host 与浏览器客户端组合,将 Web 服务器绑定到临时回环端口,抑制打印 URL、默认浏览器打开与 Web 面提示上下文,禁用客户端 HMR,保留直连 DeepSeek 适配器,挂载 [`dsh-llm-tencent-codebuddy`](../../llm/llm-tencent-codebuddy/README.zh.md),并选择 `tencent-internal/gpt-5.6-sol` 作为默认模型。

Electron 主进程(而非本 bundle)拥有原生窗口、单实例行为、桌面 Harness home 与进程关闭。本包仅携带补丁列表与必需的包不变式伴生文件。

## 目录

- [模型体验](#model-experience)
- [已知限制与待办](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="model-experience"></a>
-----

<a id="dev-note"></a>
## 开发备注

本包是纯补丁载体:`src` 不发布任何运行时代码,其不变式伴生文件检查组合后的 profile 装配。

## 模型体验

### 默认模型选择

#### 模型看到什么

默认模型路由解析为 `tencent-internal/gpt-5.6-sol`;提示或工具面相比 Web profile 无其他变化。模型看到的提示组合与 Web profile 相同;只有默认路由不同。

#### Token 影响

本层无 token 变化:模型目录默认值替换不会向任何请求添加内容。

#### KV 缓存影响

无。默认选择是部署事实,不是会话日志值。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与待办

- **纯组合层** — 桌面补丁是组合事实;Electron 主进程拥有全部原生窗口行为,由 `apps/desktop` 文档化。
