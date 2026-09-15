---
description: "可安装的腾讯 CodeBuddy profile 组合包：tencent-internal 路由、包持有的 catalog，以及只填 Key 的默认模型。"
kind: "package-bundle"
---

# `@deepseek-ai/dsh-llm-tencent-codebuddy`

[English](README.md) | 中文

## 概述

把本组合包安装进 dsh profile，即可使用腾讯内网 CodeBuddy 模型。该层会注册固定的 `tencent-internal` 路由，提供包持有的 29 个桌面聊天模型 catalog，并选择 `tencent-internal/hy3-ioa` 作为默认模型。在 Models 页面或通过凭据服务存储 CodeBuddy Key；首次进入不会弹出填写框。用 `dsh plugin` 添加或移除本组合包；随附的 desktop profile 已经挂载同一条路由。调用方无法通过 settings 把受信任密钥重定向到其他端点。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

### 安装到 profile

将本包添加到已初始化的 profile，然后重启该 profile：

```sh
dsh plugin --profile web add @deepseek-ai/dsh-llm-tencent-codebuddy
dsh plugin --profile web remove @deepseek-ai/dsh-llm-tencent-codebuddy
dsh --profile web
```

箱内层（例如 `@deepseek-ai/dsh-base`）从 dsh 安装目录解析。`add` 成功后，`dsh plugin` 会把本包追加到 `dsh.profile.bundles`，因为 manifest 声明了 `dsh.bundle.patch`。没有该声明的包会留作普通依赖，永远不会挂载 `tencent-internal`。

同一对 `add` / `remove` 也适用于 `headless`、`sdk` 与 `acp`。profile 必须已经包含 `@deepseek-ai/dsh-base`，本层会替换其中的 `agent-default-model` 行。移除本包后，下一次启动会撤回该路由并恢复原先的默认模型。

不要把本组合包添加到已经插入 `llm-tencent-codebuddy` 的 profile。随附的 desktop profile 已经通过 [`dsh-desktop-app`](../../bundle/desktop-app/README.zh.md) 挂载该适配器。

### 获得的功能

profile 会获得 `tencent-internal` 提供方、包持有的 catalog，以及作为默认模型的 `tencent-internal/hy3-ioa`。官方 DeepSeek 仍保持挂载。通过凭据服务或启动环境存储 `TENCENT_CODEBUDDY_API_KEY`；Models 页面写入的也是同一引用。

| 事实 | 值 |
|---|---|
| 提供方路由 | `tencent-internal` |
| 显示名称 | `Tencent CodeBuddy` |
| 端点 | `https://copilot.tencent.com/v2` |
| 协议 | OpenAI Chat Completions |
| 默认模型 | `hy3-ioa` |
| 模型 catalog | 包持有的固定 catalog：桌面聊天模型（`craft`/`ask`/`plan` 并集，取自一次桌面客户端缓存投影）共 29 个 |
| 上下文窗口 | 各模型的 catalog 元数据 |
| 默认输出上限 | 各模型的 catalog 元数据 |
| 输入 | 文本，以及 catalog 声明支持时的图片 |
| 推理等级 | 推理模型支持 `low`、`medium`、`high`、`xhigh`、`max` |
| 默认凭据引用 | `TENCENT_CODEBUDDY_API_KEY` |

catalog 由本包持有。腾讯端点不提供 OpenAI 兼容的 `/models` 列表，因此 catalog 是内网网关当前提供的固定模型集合，由一次桌面客户端缓存投影写入 `src/catalog.ts`：`craft`、`ask`、`plan` 桌面聊天模式的有序并集，含每个模型的显示名称、上下文窗口、输出上限、图片支持与推理能力。catalog 随产品交付，而不是运行时发现。

配置的 `models` 列表整体替换固定 catalog——与 DeepSeek 直连适配器的咨询性 catalog 同一条契约——这正是 Models 页面编辑目录的方式。省略列表时提供固定 catalog；显式空列表则清空。重复 id 在写入处被拒绝。

### 配置

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

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

声明的 patch 会插入适配器行，并把 `agent-default-model` 替换为 `tencent-internal/hy3-ioa`。没有该行的 headless 或 SDK 树会跳过默认路由 patch 并给出警告，同时仍会挂载适配器。

每个请求都携带 CodeBuddy CLI 路由与 IDE 标头、固定 CLI `User-Agent`、逐 Session 稳定的 conversation id，以及每次调用新建的 request/message id。无法安全放入标头的 Session id 会表示为确定性的 SHA-256 前缀，而不会直接复制进标头。

传输前，适配器会把 `system` 和 `developer` 消息合并为一条开头的 system 消息；没有 system 内容时补充中性 system 消息；首条会话消息不是 user 时插入一条 user `Hello`；递归移除 `cache_control`；强制开启 streaming 与 usage；将 `max_completion_tokens` 映射为 `max_tokens`；确保 CodeBuddy 要求的最小输出 token 数 100；并归一化腾讯 tool choice 形式。腾讯只从当前 user 消息处理图片，而 Harness 可能把工作区上下文追加为第二条相邻 user 消息，因此适配器只在相邻 user 消息组含图片时合并该组，并保持内容片段顺序；纯文本消息组以及被 assistant 或 tool 历史分隔的 user 消息仍然保持独立。具名 tool choice 会收窄到唯一匹配的声明；不存在或存在歧义时会在网络 I/O 前失败。

传输与 stream 转换仍由 [`dsh-llm-pi-ai`](../../llm/llm-pi-ai/README.zh.md) 负责。它公开的 `resolveProfiles` 与 `prepareRequest` hook 让本包可以复用凭据、附件、回放、超时和流式行为，同时继续由本包持有提供方事实和协议归一化。

| 文件 | 职责 |
|---|---|
| [`cordis.patch.yml`](cordis.patch.yml) | Profile patch：默认路由、适配器插入 |
| [`src/index.ts`](src/index.ts) | 插件入口：catalog、凭据、适配器注册 |
| [`src/catalog.ts`](src/catalog.ts) | 包持有的模型目录 |
| [`src/tencent-request.ts`](src/tencent-request.ts) | 标头与 payload 归一化 |

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [LLM 组](../../llm/README.zh.md) — 提供方适配器与模型调用服务。
- [pi-ai 适配器](../../llm/llm-pi-ai/README.zh.md) — 本包复用的传输、流式与 profile 解析。
- [桌面应用组合包](../../bundle/desktop-app/README.zh.md) — 已经挂载本适配器的随附桌面层。
- [Profile 插件组合包](../../../.agents/notes/implemented/architecture/2026-08-05-profile-plugin-bundles.zh.md) — `dsh plugin` 如何激活已声明的 patch。

-----

<a id="model-experience"></a>
## 模型体验

### 默认模型选择

#### 模型会看到什么

默认模型路由解析为 `tencent-internal/hy3-ioa`；提示或工具面相比仍默认官方 DeepSeek 的 profile 无其他变化。模型看到的提示组合与该 profile 相同；只有默认路由不同。

#### Token 影响

本层无 token 变化：模型目录默认值替换不会向任何请求添加内容。

#### KV Cache 影响

无。默认选择是部署事实，不是会话日志值。

### CodeBuddy 请求

#### 模型会看到什么

模型会收到合并为一条开头 system 消息的 Harness system/developer 内容；只有腾讯会话语法要求在现有历史之前先出现 user 轮次时，才会紧接一条 user `Hello`。当图片输入与后续 Harness 上下文位于相邻 user 消息时，两者会合并为一个有序的 user 内容列表，使腾讯仍能处理图片。纯文本轮次、该场景以外的附件、tool 声明和后续历史在其他方面保持 pi-ai 的 Chat Completions 转换结果。

#### Token 影响

在常见 tokenizer 下，插入的 `Hello` 只占很少的 token，并且只会在现有首条非 system 轮次不是 user 时出现。合并 system/developer 消息会增加分隔符，但不会添加新的语义指令；确切数量由提供方 tokenizer 决定。

#### KV Cache 影响

稳定的 system 内容与归一化历史会在多轮之间保留稳定前缀。请求 id 只存在于标头，不影响模型可见的缓存身份。提供方、模型或上游消息变化可能从第一个变化 token 起阻止复用。

### CodeBuddy 响应

#### 模型会看到什么

pi-ai 将 CodeBuddy 流式事件转换为 Harness reasoning、text、tool-call、usage 与 finish chunk。只有 agent loop 保留的内容才会进入后续请求。

#### Token 影响

每个 stream 都会请求 usage，并通过共享 LLM 词汇报告。选中 catalog 模型的输出值是请求默认值，最终仍由提供方执行限制。

#### KV Cache 影响

保留的响应内容追加到下一次请求，不会改变其更早的前缀。传输标头和 usage 字段不会进入后续模型输入。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **catalog 是随包交付的快照** — 腾讯可能在不动本包的情况下更改网关提供的模型；部署或用户通过 `models` 覆盖增删 id，直到下一次发布刷新固定 catalog。
- **网络与账号资格仍是外部事实** — 路由已注册且密钥已存储，也不代表企业网络可达或账号拥有模型权限；首次请求会报告对应的提供方失败。
- **归一化遵循观测到的 CodeBuddy 协议** — 腾讯可以独立修改所需标头或 payload 规则；聚焦测试能阻止本地漂移，但无法保证未公开远端接口永远不变。
- **不要把本组合包叠到已经插入 `llm-tencent-codebuddy` 的树上** — 第二次插入会重复适配器行；随附 desktop profile 已经通过 `dsh-desktop-app` 挂载它。
- **没有 `agent-default-model` 的树会保留原先的默认值** — 默认路由 patch 会被跳过，而适配器在 insert 生效时仍会挂载。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

端点与归一化位于本包而非 `llm-pi-ai`。路由固定，不能通过设置重定向。

</details>
