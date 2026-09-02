---
description: "DSH Web 客户端的实时浏览器预览浮层：在右上角浮动窗格中显示模型驱动的 Playwright 页面。"
kind: "package-reference"
---

# @deepseek-ai/dsh-browser-popup

[English](README.md) | 中文

## 概述

DSH Web 客户端的实时浏览器预览浮层：在右上角浮动窗格中显示模型驱动的 Playwright 页面，每 1.5 秒刷新。Host 半区暴露 Remote 服务（`browserPopup`），提供 `shot`（二进制安全的 base64 截图）、`pageInfo`（url/标题）与 `navigate`；Client 半区占据 `shell.overlay` 槽位，并在画布上以原生分辨率渲染截图（CSS 缩放显示）。

该浮层是附加性的：它向帧级 `shell.overlay` 列表槽位贡献一个条目，绝不替换 shell 外观，展开前可点击穿透。它与 `browser` 工具套件（同一 `browser` 服务依赖）并列发布，仅在启用浏览器时才有意义。

## 目录

- [Remote 面](#remote-surface)
- [Client 浮层](#client-overlay)
- [模型体验](#model-experience)
- [已知限制与待办](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="remote-surface"></a>
## Remote 面

| 方法 | 返回 | 行为 |
|---|---|---|
| `shot` | `BrowserShotResult` | 将当前页面视口捕获为 base64 PNG（`png`、`byteLen`、`b64Len`）。 |
| `pageInfo` | `BrowserPageInfoResult` | 返回当前页面 URL 与标题。 |
| `navigate` | `BrowserNavigateResult` | 将持久页面导航至绝对 http(s) URL。 |

每个方法都惰性解析浏览器服务，并在浏览器不可用时返回 `{ ok: false, error }`，因此浮层会降级为错误字符串而不是让 Remote 调用失败。

<a id="client-overlay"></a>
## Client 浮层

Client 半区注册 `shell.overlay` 槽位的一个占用者。会话头部开关显示或隐藏它；关闭按钮完全隐藏它，因此在点击头部操作前不渲染任何内容。截图以原生分辨率渲染到画布上，CSS 缩放显示。

<a id="model-experience"></a>
-----

<a id="dev-note"></a>
## 开发备注

该浮层依赖 `browser` 服务被挂载且存在 Playwright Chromium 安装；两者缺失时它渲染错误状态而不是让 Remote 调用失败。

<a id="known-limitations-and-deferred-work"></a>

## 模型体验

### 预览浮层

#### 模型看到什么

该浮层仅用于展示：它绝不向模型请求贡献 token，绝不进入会话日志，也不改变模型可见的工具面。它渲染与 `browser_*` 工具驱动的同一个 Playwright 页面，按固定间隔刷新，让人在不改变对话记录的情况下观看模型的导航。

#### Token 影响

零 token。该浮层不添加任何提示内容、工具 schema 或事件日志行。

#### KV 缓存影响

无。该浮层不持有模型可见状态，也不写入缓存读取的任何内容。

## 已知限制与待办

- **固定刷新间隔** — 浮层按固定 1.5s 节奏重新截图;直播式视频流与逐帧差异不在范围内。
- **单浏览器页面** — 浮层显示浏览器工具套件驱动的单个持久 Playwright 页面;多页面或标签页不预览。
