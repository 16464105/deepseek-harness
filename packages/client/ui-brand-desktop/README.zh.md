---
description: "桌面部署的侧边栏品牌占位者，取代官方图形；面向选择品牌呈现方式的桌面 fork 维护者。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-brand-desktop

[English](README.md) | 中文

## 概述

本包为桌面部署在侧边栏提供自己的鲸鱼标志与产品名。它以低于官方占位者的优先级注册，从而赢得单占位槽位的选举，无需修改官方包、共享 locale 字典或品牌 primitive。为具有自身标识的构建选择它；沿用上游图形的部署只要不挂载这一行即可。它没有运行时状态，也不影响模型请求。

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

在标识不同于上游的部署的浏览器 roster 中挂载本插件，`dsh-desktop-app` 就是这么做的。

### 赢得选举

`sidebar.brand.mark` 与 `sidebar.brand.name` 是单占位槽位：每个优先级只有一个占位者，且优先级最低者渲染。官方占位者以默认优先级 `0` 注册，因此本包以 `-10` 注册并将其遮蔽。两个占位者作为一个声明感知的注册集合安装，因此无论本行在侧边栏声明之前还是之后激活都能工作。

### 不改动共享字典

侧边栏从 `brand.localBuild` locale 键渲染其回退名称。由于官方占位者在桌面构建中已占据该槽位，回退永远不会渲染，因此本包把产品名作为自己的占位者携带，而不是去修改共享字典。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节 — 点击展开</summary>

标志使用生产 wordmark 矢量而非位图重建，并填充品牌蓝，使侧边栏、首屏、favicon 与 Electron 图标共用一种颜色。浏览器半部分是 [`src/client/index.ts`](src/client/index.ts)，其图形位于 [`src/client/Brand.tsx`](src/client/Brand.tsx)；node 半部分是一个空的 Loader 座位。浏览器标题属于构建环境（`DSH_CLIENT_TITLE`），不在槽位系统内。

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

当品牌界面不够用时阅读这些页面。

- [ui-sidebar](../ui-sidebar/README.zh.md) — 声明 `sidebar.brand.mark` 与 `sidebar.brand.name` 并渲染其回退。
- [ui-brand-official](../ui-brand-official/README.zh.md) — 本包所遮蔽的上游占位者。
- [槽位参考](../../../docs/subsystems/slots.zh.md) — 本包依赖的单占位选举规则。

-----

<a id="model-experience"></a>
## 模型体验

间接地，通过它占据的侧边栏与首屏槽位，这些槽位只改变渲染出的图形；本包自身不注册任何提示词、schema 或结果。

#### KV 缓存影响

无；本包既不组装也不发送提供方请求。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

这些限制定义了品牌呈现的供给方式。它们是当前的包约束，不是任务清单。

- **首屏保留自己的回退** — `conversation.hero.brand.mark` 仍使用声明包自身的动画鱼，因此本包只占据侧边栏。
- **浏览器标题是独立的** — `DSH_CLIENT_TITLE` 在构建期选择标题文本，而不是通过 UI 槽位。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 — 点击展开</summary>

无。

</details>

**运行时不变式：** 不发布伴生文件。本包不保留可变状态，其两个槽位占位者通过一个事务性 effect 安装与退出。
