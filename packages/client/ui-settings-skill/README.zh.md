---
description: "桌面端基于会话 skill 目录的 Skills 管理页；面向管理本地 Skill 的用户与桌面 fork 维护者。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-skill

[English](README.md) | 中文

## 概述

本包为设置界面提供 Skills 页面：它列出当前会话的 skill 目录、按关键词过滤、切换每个 skill 在聊天命令选择器中的可见性，并在宿主桌面端揭示或打开用户 skill 目录。为希望设置界面能管理 skill 的部署选择它；上游的 `ui-skill` 只负责聊天选择器，不提供管理页。它通过 skills Remote 读取目录，不影响模型请求。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

在设置界面需要管理 skill 的部署的浏览器 roster 中挂载本插件，`dsh-desktop-app` 就是这么做的。

### 页面提供什么

页面列出当前会话目录返回的每个 skill，并显示其描述、提供方与来源。搜索框按名称、描述或提供方过滤。每一行带有聊天选择器可见性开关，持久化在浏览器中，使选择器与本页保持一致。刷新操作会重新读取所有提供方，这正是让在应用之外新增的 skill 文件无需重启即可出现的原因。

### 打开 skill 目录

宿主报告用户 skill 目录的绝对路径，以及它能否原生打开路径。在桌面宿主上页面提供打开操作；其他环境则把路径作为文本展示，便于复制。目录与打开操作都归宿主所有，不属于本包。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节 — 点击展开</summary>

页面在 `settings.skill` locale 命名空间下注册一个 `settings.section` 占位者。`SkillVisibility` 把选择器选择作为浏览器本地持久化集合并置于外部 store 快照之后，因此页面与选择器读取同一个来源。`SkillsDirectoryStore` 负责目录事实与进行中的打开操作。目录读取把 refresh 透传给 skills Remote，其宿主侧会重新读取提供方而不是返回缓存观察。浏览器半部分是 [`src/client/index.ts`](src/client/index.ts)；node 半部分是一个空的 Loader 座位。

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

当 Skills 界面不够用时阅读这些页面。

- [ui-skill](../ui-skill/README.zh.md) — 本页可见性选择所服务的聊天命令选择器。
- [ui-settings](../ui-settings/README.zh.md) — 声明本页占据的 `settings.section` 槽位。
- [ui-settings-mcp](../ui-settings-mcp/README.zh.md) — MCP 服务器的同类管理页。

-----

<a id="model-experience"></a>
## 模型体验

间接地，通过它与 ui-skill 共享的聊天命令选择器可见性选择：隐藏某个 skill 会把它从选择器候选中移除，因此模型永远不会被提供它。

#### KV 缓存影响

无；本包既不组装也不发送提供方请求。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

这些限制定义了 skill 管理的供给方式。它们是当前的包约束，不是任务清单。

- **可见性是浏览器本地的** — 选择器选择持久化在 `localStorage`，因此不会跨浏览器或跨宿主跟随某个人。
- **此处目录只读** — 本页管理可见性并揭示目录；它不创建、编辑或删除 skill 文件。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 — 点击展开</summary>

无。

</details>

**运行时不变式：** 不发布伴生文件。本页只拥有浏览器本地呈现状态，其注册随插件 fiber 一同退出。
