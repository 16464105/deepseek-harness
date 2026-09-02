---
description: "持久化 MCP 服务器管理:标准 MCP JSON 文档与脱敏 Remote 目录。"
kind: "package-reference"
---

# @deepseek-ai/dsh-mcp-manager

[English](README.md) | 中文

## 概述

Host 应用的持久化 MCP 服务器管理插件。插件持有标准的 MCP JSON 文档，提供隐藏敏感字段的 Remote 目录，并为每个启用的服务器挂载一个 [`@deepseek-ai/dsh-mcp-client`](../mcp-client/README.zh.md) fiber。

## 目录

- [配置](#configuration)
- [运行时](#runtime)
- [模型体验](#model-experience)
- [已知限制与暂缓事项](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="configuration"></a>
## 配置

管理器拥有独立的 JSON 文档，位于 `<harness home>/mcp.json`，与部署的主 `settings.yaml` 隔离。文档采用标准 MCP 服务器形态——「服务器名 → 定义」的扁平映射——用户可以直接粘贴其他 MCP 客户端已经在用的配置：

```json
{
  "tapd_mcp_http": {
    "url": "https://mcpgw.knot.woa.com/tapd/",
    "timeout": 20000,
    "headers": { "X-Tapd-Access-Token": "…" },
    "transportType": "streamable-http"
  },
  "local-files": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"],
    "cwd": "/workspace",
    "env": { "MCP_TOKEN": "…" }
  }
}
```

每个条目要么给出 `url`（Streamable HTTP），要么给出 `command`（stdio）；`headers`/`env` 承载敏感字段；`timeout` 在 1000 以下按秒读、以上按毫秒读（业界惯例的分界：`60` 是一分钟，`20000` 是二十秒）；`enabled: false` 停用服务器而不删除。文档在挂载时物化，外部编辑经监视器热发布，设置页面的打开操作把它交给原生编辑器。

`headers` 与 `env` 在 Remote 目录上只写不读：`list` 只返回 `hasSecrets`，UI 编辑时省略这些字段会保留已存值；必须在 draft 中显式设置 `clearSecrets: true` 才会清除它们。

<a id="runtime"></a>
## 运行时

保存、启用、停用、删除或重连服务器都会协调实时 fiber，无需重启 Host。管理器从 MCP 客户端状态事件报告 `connecting`、`connected`、`reconnecting`、`failed` 和 `disabled`，并带回已发现的工具数量。连接失败不会把插件本身伪装成已连接；服务器行仍可用于重试或编辑。

Remote 写方法会拒绝未知服务器名称和对停用服务器的重连请求。管理器释放时会等待排队的协调任务，并释放所有子 MCP fiber。

-----

<a id="dev-note"></a>
## 开发备注

文档位于 `<harness home>/mcp.json`;管理器在首次打开时物化它,写入经过序列化且原子。每个启用的服务器挂载一个 `mcp-client` fiber;禁用会移除该 fiber 及其服务器定义。

-----

<a id="model-experience"></a>
## 模型体验

本包不直接改变模型请求。启用的子 fiber 通过 `mcp-client` 注册已发现的 MCP 工具；本包只拥有持久化定义和管理控件。

#### KV Cache 影响

管理状态本身没有影响。每个已启用子客户端的已发现工具集合遵循 `mcp-client` 记录的缓存行为。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与暂缓事项

- 管理器一次编辑一个 `serverName`；如需更换 namespace，应删除旧条目后添加新条目，避免已有工具名称发生变化。
- 敏感字段绝不会返回给客户端 UI 或 Remote 调用方。存储值的保护仍由文档权限（`0600`）与脱敏投影负责。
