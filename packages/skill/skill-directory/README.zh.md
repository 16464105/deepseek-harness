---
description: "在宿主上报告并打开用户 skill 目录的 Remote 界面；面向客户端提供 Skills 管理页的部署。"
kind: "package-reference"
---

# @deepseek-ai/dsh-skill-directory

[English](README.md) | 中文

## 概述

本包把用户 skill 目录暴露给浏览器客户端：绝对路径、宿主能否原生打开它，以及一个打开操作。它正是根 `dsh-skill-filesystem` 提供方以 `user-dsh` 扫描的同一个 harness home 根，因此该界面打开的正是发现用户 skill 的位置。在客户端提供 Skills 管理页的部署中挂载它；没有该页面的部署不需要它。它不注册任何面向模型的工具。

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

在客户端需要揭示或打开用户 skill 目录的部署的宿主 roster 中挂载本插件，`dsh-desktop-app` 就是这么做的。

### 界面提供什么

`remote.skillDirectory.info()` 返回绝对目录以及本宿主是否具备原生打开器。`remote.skillDirectory.open()` 请求宿主打开它。两者都会在目录缺席时创建它：从未安装过用户 skill 的 home 尚无该目录，而 macOS 打开器在目标缺失时会失败，因此揭示操作在全新 home 上本来总会报错。

### 没有打开器时

无头或远程宿主报告 `canOpenPath: false`，且 `open()` 返回 `{ opened: false, path }` 而不是失败。客户端据此把路径作为文本展示，而不是提供一个无法工作的操作。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节 — 点击展开</summary>

该服务是名为 `skillDirectory` 的 `TypertRemoteService`；生成的 Remote contribution 通过 `exports["./remote"]` 发布，浏览器客户端像其他包一样挂载它。目录路径只有一个函数，因此报告的路径与打开的路径不会分叉。宿主半部分是 [`src/index.ts`](src/index.ts)，其 wire 类型位于 [`src/types.ts`](src/types.ts)。

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

当目录界面不够用时阅读这些页面。

- [skill-filesystem](../skill-filesystem/README.zh.md) — 从同一 harness home 根发现 skill 的提供方。
- [skill](../skill/README.zh.md) — 该目录所供给的目录注册表。
- [ui-settings-skill](../../client/ui-settings-skill/README.zh.md) — 消费本界面的设置页。

-----

<a id="model-experience"></a>
## 模型体验

间接地，通过文件系统提供方从它报告的目录中发现 skill：某人放入该目录的 skill 会进入目录。本包自身不注册任何提示词、schema 或结果。

#### KV 缓存影响

无；本包既不组装也不发送提供方请求。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

这些限制定义了目录界面的供给方式。它们是当前的包约束，不是任务清单。

- **单一固定根** — 目录就是 harness home 的 `skills` 根，与从它发现的提供方一致；此处不可配置。
- **打开是尽力而为** — 界面报告宿主是否打开了目录，而不是某人是否看到它。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 — 点击展开</summary>

无。

</details>

**运行时不变式：** 不发布伴生文件。该服务除每次调用解析的 harness home 外不持有状态，其 Remote 命名空间随插件 fiber 一同退出。
