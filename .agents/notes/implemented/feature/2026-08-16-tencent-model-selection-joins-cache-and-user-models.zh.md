# Agent Note: 腾讯模型以固定 catalog 交付并附带用户可编辑目录

Status: implemented

[English](2026-08-16-tencent-model-selection-joins-cache-and-user-models.md) | 中文

## Problem

腾讯 CodeBuddy 适配器最初提供本地安装的 CodeBuddy 桌面客户端所缓存的模型，卡片上还带一张可见性映射。这个设计让提供的 catalog 依赖本地 SQLite 数据库：新机器在桌面客户端填充缓存前什么都不显示；用户无法添加缓存未列出的模型；而提供方真正的模型集合——内网网关提供的固定列表——被机器本地状态遮蔽。该端点也不提供可询问的 OpenAI 兼容 `/models` 列表。

## Decision

**catalog 由本包持有。** `src/catalog.ts` 固定 29 个桌面聊天模型（`craft`/`ask`/`plan` 并集，取自一次桌面客户端缓存投影），含显示名称、上下文窗口、输出上限、图片支持与推理能力。schema 把这个 catalog 物化为 `models` 的默认值，因此裸挂载即可提供完整目录，完全不再读取本地数据库。SQLite 缓存读取器、`stateDatabase` 配置字段、`modelVisibility` 映射与发现注册全部移除。

**配置的 `models` 列表整体替换 catalog**——与 DeepSeek 直连适配器的咨询性 catalog 同一条契约——这正是 Models 页面编辑目录的方式。首次编辑会把完整数组物化到用户层；**恢复默认模型**取消该覆盖；重复 id 由 `resolveProfiles` 在写入处拒绝。

**腾讯卡片采用 DeepSeek 的形态。** 端点保持固定，因此卡片只提供 API 密钥字段与收起的「自定义设置」折叠区，固定目录经其 schema 默认值由 `DeepSeekModelsEditor` 渲染。没有获取动作、没有可见性复选框、没有新增模型分区：目录本身就是编辑面。

## Alternatives considered

**读取本地桌面缓存** — 旧设计；否决，因为它让提供的 catalog 成为机器本地状态，需要显式刷新动作，且没有可用数据库时启动失败。

**询问腾讯端点的模型列表** — 否决，因为 `https://copilot.tencent.com/v2/models` 返回 404；网关通过桌面客户端的产品配置发布模型，而现在由随包 catalog 钉住这份配置。

**在固定 catalog 旁保留可见性映射** — 否决，因为目录编辑器取代了它的功能：隐藏模型就是删除该行，而它服务的刷新流程已不存在。

**让用户把桌面缓存抓取进目录** — 否决，因为这会重新引入固定 catalog 已消除的机器本地读取，而随包快照与缓存投影出的并集相同。

## Consequences

腾讯路由在任何机器上都能提供其固定 catalog，无需本地状态；Models 卡片像 DeepSeek 卡片一样直接编辑该目录。Loader、provider、wiring 与客户端测试钉住固定 catalog、替换语义与卡片形态；web e2e 快照展示 29 个模型的选择器。腾讯更改网关模型时，通过下一次包发布或用户的 `models` 覆盖到达部署，而不是通过缓存刷新。
