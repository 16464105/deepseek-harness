---
description: "tencent-internal 包组：可安装的腾讯 CodeBuddy profile 组合包，供在共享 LLM 适配器旁添加内网路由的读者使用。"
kind: "package-group"
---

# tencent-internal/ — 腾讯 CodeBuddy profile 组合包

[English](README.md) | 中文

## 概述

tencent-internal 组提供一个可安装的腾讯 CodeBuddy profile 组合包。把它加进 dsh profile 后，会挂载 `tencent-internal` 路由、提供包持有的 catalog，并把默认模型设为 `hy3-ioa`。在 Models 页面或凭据服务中存储 CodeBuddy Key；首次进入不会弹出填写框。该组与 `llm/` 平级，因此这条可安装路由不会嵌在共享 LLM 适配器家族里。

## 目录

- [包](#packages)
- [相关文档](#related-documentation)
- [开发备注](#dev-note)

-----

<a id="packages"></a>
## 包

| 包 | 职责 | ctx key |
|---|---|---|
| [`llm-tencent-codebuddy/`](llm-tencent-codebuddy/README.zh.md) | 可安装的腾讯 CodeBuddy 路由，带包持有的 catalog | 注册到 `ctx.llm` |

-----

<a id="related-documentation"></a>
## 相关文档

- [LLM 流式子系统](../../docs/subsystems/llm-streaming.zh.md) — 本路由注册所依据的消息、流式与适配器约定。
- [llm 组](../llm/README.zh.md) — 共享的模型调用服务与官方 DeepSeek 适配器。
- [腾讯 CodeBuddy 作为可安装 profile 组合包](../../.agents/notes/implemented/architecture/2026-09-15-tencent-codebuddy-installable-profile-bundle.zh.md) — 为何本包既是适配器也是 `dsh plugin` 层。

<a id="dev-note"></a>
## 开发备注

无。
