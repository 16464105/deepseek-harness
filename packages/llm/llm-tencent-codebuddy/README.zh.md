---
description: "腾讯内部 CodeBuddy LLM 适配器:tencent-internal 固定路由与固定模型目录。"
kind: "package-reference"
---

# `@deepseek-ai/dsh-llm-tencent-codebuddy`

[English](README.md) | 中文

## 概述

面向 Harness LLM seam 的腾讯内网 CodeBuddy 适配器。本包公开一个固定路由 `tencent-internal`，底层复用 pi-ai 的 OpenAI Chat Completions 传输、本包持有的固定模型 catalog，以及该集成使用的请求归一化。部署配置包含凭据引用、可选的模型目录覆盖、超时和重试策略；调用方无法通过 settings 将受信任密钥重定向到其他端点。

包根导出 Cordis 插件契约、固定的提供方／默认模型／凭据常量、固定 catalog，以及聚焦协议测试使用的请求标头和 payload 归一化 helper。

## 目录

- [固定提供方事实](#fixed-provider-facts)
- [模型目录](#model-catalog)
- [配置](#config)
- [模型体验](#model-experience)
- [已知限制与待办](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="fixed-provider-facts"></a>
## 固定提供方事实

| 事实 | 值 |
|---|---|
| 提供方路由 | `tencent-internal` |
| 显示名称 | `Tencent CodeBuddy` |
| 端点 | `https://copilot.tencent.com/v2` |
| 协议 | OpenAI Chat Completions |
| 默认模型 | `gpt-5.6-sol` |
| 模型 catalog | 包持有的固定 catalog：桌面聊天模型（`craft`/`ask`/`plan` 并集，取自一次桌面客户端缓存投影）共 29 个 |
| 上下文窗口 | 各模型的 catalog 元数据 |
| 默认输出上限 | 各模型的 catalog 元数据 |
| 输入 | 文本，以及 catalog 声明支持时的图片 |
| 推理等级 | 推理模型支持 `low`、`medium`、`high`、`xhigh`、`max` |
| 默认凭据引用 | `TENCENT_CODEBUDDY_API_KEY` |

<a id="model-catalog"></a>
## 模型 catalog

catalog 由本包持有。腾讯端点不提供 OpenAI 兼容的 `/models` 列表，因此 catalog 是内网网关当前提供的固定模型集合，由一次桌面客户端缓存投影写入 `src/catalog.ts`：`craft`、`ask`、`plan` 桌面聊天模式的有序并集，含每个模型的显示名称、上下文窗口、输出上限、图片支持与推理能力。catalog 随产品交付，而不是运行时发现。

配置的 `models` 列表整体替换固定 catalog——与 DeepSeek 直连适配器的咨询性 catalog 同一条契约——这正是 Models 页面编辑目录的方式。省略列表时提供固定 catalog；显式空列表则清空。重复 id 在写入处被拒绝。

<a id="config"></a>
## 配置

```yaml
- id: llm-tencent-codebuddy
  name: '@deepseek-ai/dsh-llm-tencent-codebuddy'
  config:
    apiKeyEnv: TENCENT_CODEBUDDY_API_KEY
    models:                          # optional; omission serves the fixed catalog
      - id: gateway-new-model
        name: Gateway New Model
        contextWindow: 262144        # optional; route defaults apply when omitted
    timeoutMs: 300000                 # optional provider SDK timeout
    streamIdleTimeoutMs: 300000       # optional; five-minute default
    retryPolicy:                      # optional; omission uses normal defaults
      mode: normal
```

`apiKeyEnv` 是凭据引用，绝不是密钥字面值。每次请求都会通过 `ctx.credentials` 解析它；未挂载凭据服务时回退到捕获的启动环境。解析值会被 trim 并校验为标头可承载的密钥；失败时抛出 `MISSING_CREDENTIAL` 或 `INVALID_CREDENTIAL`，且不会暴露机密内容。插件会注册 `llm-tencent-codebuddy` settings namespace 和可配置提供方目录条目，因此 Models 页面可以存储密钥与模型目录，而不改变固定端点或协议。模型列表、超时和重试 settings 的变更通过正常 settings 生命周期生效；重试策略变化时会原地替换路由注册。

<a id="codebuddy-request-adaptation"></a>
## CodeBuddy 请求适配

每个请求都携带 CodeBuddy CLI 路由与 IDE 标头、固定 CLI `User-Agent`、逐 Session 稳定的 conversation id，以及每次调用新建的 request/message id。无法安全放入标头的 Session id 会表示为确定性的 SHA-256 前缀，而不会直接复制进标头。

传输前，适配器会把 `system` 和 `developer` 消息合并为一条开头的 system 消息；没有 system 内容时补充中性 system 消息；首条会话消息不是 user 时插入一条 user `Hello`；递归移除 `cache_control`；强制开启 streaming 与 usage；将 `max_completion_tokens` 映射为 `max_tokens`；确保 CodeBuddy 要求的最小输出 token 数 100；并归一化腾讯 tool choice 形式。腾讯只从当前 user 消息处理图片，而 Harness 可能把工作区上下文追加为第二条相邻 user 消息，因此适配器只在相邻 user 消息组含图片时合并该组，并保持内容片段顺序；纯文本消息组以及被 assistant 或 tool 历史分隔的 user 消息仍然保持独立。具名 tool choice 会收窄到唯一匹配的声明；不存在或存在歧义时会在网络 I/O 前失败。

传输与 stream 转换仍由 [`dsh-llm-pi-ai`](../llm-pi-ai/README.zh.md) 负责。它公开的 `resolveProfiles` 与 `prepareRequest` hook 让本包可以复用凭据、附件、回放、超时和流式行为，同时继续由本包持有提供方事实和协议归一化。

-----

<a id="dev-note"></a>
## 开发备注

该适配器面向桌面部署:Tencent CodeBuddy 端点与规范化位于此处而非 `llm-pi-ai`,桌面 profile 选择其默认模型。路由固定,不能通过设置重定向。

-----

<a id="model-experience"></a>
## 模型体验

### CodeBuddy 请求

#### 模型看到的内容

模型会收到合并为一条开头 system 消息的 Harness system/developer 内容；只有腾讯会话语法要求在现有历史之前先出现 user 轮次时，才会紧接一条 user `Hello`。当图片输入与后续 Harness 上下文位于相邻 user 消息时，两者会合并为一个有序的 user 内容列表，使腾讯仍能处理图片。纯文本轮次、该场景以外的附件、tool 声明和后续历史在其他方面保持 pi-ai 的 Chat Completions 转换结果。

#### Token 影响

在常见 tokenizer 下，插入的 `Hello` 只占很少的 token，并且只会在现有首条非 system 轮次不是 user 时出现。合并 system/developer 消息会增加分隔符，但不会添加新的语义指令；确切数量由提供方 tokenizer 决定。

#### KV Cache 影响

稳定的 system 内容与归一化历史会在多轮之间保留稳定前缀。请求 id 只存在于标头，不影响模型可见的缓存身份。提供方、模型或上游消息变化可能从第一个变化 token 起阻止复用。

### CodeBuddy 响应

#### 模型看到的内容

pi-ai 将 CodeBuddy 流式事件转换为 Harness reasoning、text、tool-call、usage 与 finish chunk。只有 agent loop 保留的内容才会进入后续请求。

#### Token 影响

每个 stream 都会请求 usage，并通过共享 LLM 词汇报告。选中 catalog 模型的输出值是请求默认值，最终仍由提供方执行限制。

#### KV Cache 影响

保留的响应内容追加到下一次请求，不会改变其更早的前缀。传输标头和 usage 字段不会进入后续模型输入。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与暂缓事项

- **catalog 是随包交付的快照** — 腾讯可能在不动本包的情况下更改网关提供的模型；部署或用户通过 `models` 覆盖增删 id，直到下一次发布刷新固定 catalog。
- **网络与账号资格仍是外部事实** — 路由已注册且密钥已存储，也不代表企业网络可达或账号拥有模型权限；首次请求会报告对应的提供方失败。
- **归一化遵循观测到的 CodeBuddy 协议** — 腾讯可以独立修改所需标头或 payload 规则；聚焦测试能阻止本地漂移，但无法保证未公开远端接口永远不变。
