---
description: "浏览器操作能力组：一个由 Playwright 驱动的持久本地 Chromium 与面向模型的浏览器工具套件。"
kind: "package-group"
---

# browser/ — 浏览器操作能力

[English](README.md) | 中文

## 概述

browser 组提供 Harness 的浏览器操作能力：一个由 Playwright 驱动的持久本地 Chromium，以可访问性快照交互循环的形式暴露给模型。核心 `browser` 包拥有 Playwright 会话控制器与 `browser_*` 工具套件；`browser-popup` 为 Web 客户端增加实时预览浮层。本页映射该组；每个包的 README 拥有各自的包级契约。

## 目录

- [包](#packages)
- [相关文档](#related-documentation)
- [开发备注](#dev-note)

-----

<a id="packages"></a>
## 包

| 包 | 角色 | ctx key |
|---|---|---|
| [`browser/`](browser/README.zh.md) | 驱动一个持久 Playwright Chromium 并向模型暴露 `browser_*` 工具套件 | `ctx.browser` |
| [`browser-popup/`](browser-popup/README.zh.md) | Web 客户端的实时浏览器预览浮层 | `ctx.browserPopup` |

-----

<a id="related-documentation"></a>
## 相关文档

- [tool-catalog](../../docs/tool-catalog.zh.md) — 面向模型的工具 schema 注册表。

-----

<a id="dev-note"></a>
## 开发备注

浏览器会话是单个持久页面：模型导航它、快照它，并通过可访问性引用进行交互。Harness 不随附无头浏览器二进制——Playwright Chromium 安装是开发与 CI 前提。
