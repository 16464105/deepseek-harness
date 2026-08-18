# MCP — 模型上下文协议

[English](README.md) | 中文

将 harness 与 MCP 生态系统桥接的包。

| 包 | 职责 |
|---|---|
| [`mcp-client/`](mcp-client/README.md) | MCP 客户端桥接，将外部服务器工具注册到 `ctx.tools` |
| [`mcp-manager/`](mcp-manager/README.md) | 持久化 MCP 服务器定义，并协调启用的客户端 fiber |
