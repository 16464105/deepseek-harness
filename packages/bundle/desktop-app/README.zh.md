# `@deepseek-ai/dsh-desktop-app`

[English](README.md) | 中文

应用在 [`dsh-base`](../base/README.md) 与 [`dsh-web-app`](../web-app/README.md) 之后的桌面 profile patch 层。它为 Electron 保留既有 Host 和浏览器 client 组合，将 Web 服务器绑定到临时回环端口，关闭 URL 输出与 Web 表层提示词上下文，禁用 client HMR、保留直接 DeepSeek 适配器，挂载 [`dsh-llm-tencent-codebuddy`](../../llm/llm-tencent-codebuddy/README.md)，并选择 `tencent-internal/gpt-5.6-sol` 作为默认模型。

原生窗口、单实例行为、桌面 Harness home 和进程关闭由 Electron 主进程负责，而不是本组合包。本包只携带 patch 列表和所需的包级 invariant companion。

腾讯适配器从本地 CodeBuddy 客户端的桌面聊天缓存解析可选模型，其设置卡片可以重新读取缓存，并过滤共享聊天选择器。组合包配置的 `gpt-5.6-sol` 默认值不会把不可用模型加入该列表；缓存未包含它的用户需要选择一个已列出的腾讯模型。

## 模型体验

### 桌面组合

#### 模型看到的内容

本组合包选择腾讯 CodeBuddy 作为默认提供方，并移除 `web-runtime` 注入的 Web 专用 `harness:source` 与 `app:web-surface` 上下文。其他所有模型可见内容来自 `dsh-base`、选中的 agent preset，以及已挂载的 DeepSeek 与腾讯适配器。

#### Token 影响

本组合包不添加提示词文本。关闭 Web 表层上下文会从桌面会话中移除其源码说明行、表层说明段落和受管 `DSH_WEB_URL` 描述。

#### KV Cache 影响

选中的提供方和模型决定缓存域。本组合包不会添加会变化的请求前缀。

## 已知限制与延后工作

- **该层假定下方已经应用 `base + web-app`**：单独挂载时，其按 id 定位的 patch 无法组成完整应用。
- **默认提供方和模型有意固定**：适配器可以从账号的缓存 catalog 中排除该模型；端点、协议和 catalog 解析应由适配器持有，而不是写进用户 patch 默认值。
