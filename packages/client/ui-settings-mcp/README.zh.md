---
description: "Web 客户端的 MCP 设置分区:管理本地进程与 Streamable HTTP 服务器。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-mcp

[English](README.md) | 中文

## 概述

Web 客户端的 MCP 设置分区。它注册顶层 `MCP` 设置入口，并通过 `mcp-manager` Remote 管理本地进程和 Streamable HTTP 服务器。

## 目录

- [行为](#behavior)
- [模型体验](#model-experience)
- [开发备注](#dev-note)

-----

<a id="behavior"></a>
## 行为

页面列出每个已存服务器的传输方式、启用状态、连接阶段、已发现工具数量和 `hasSecrets` 标记。用户可以添加、编辑、启用、停用、重连和删除服务器。表单解析每行一个参数、`KEY=VALUE` 环境变量及 `Name: Value` 请求头；所有写入都会通过 Host Remote 立即生效。

编辑时敏感字段会保持空白。留空会保留已存环境变量或请求头，显式勾选清除选项才会删除它们。浏览器永远不会收到敏感字段值。只读设置文档仍会显示目录，但会禁用所有修改控件。

#### KV Cache 影响

无；设置 UI 不组装或发送提供方请求。

-----

<a id="dev-note"></a>
## 开发备注

该分区通过 `mcp-manager` Remote 读写;所有写入立即生效并由宿主持久化。

<a id="model-experience"></a>
## 模型体验

无,因为本包是浏览器端 MCP 设置层,不注册任何面向模型的内容。

#### KV 缓存影响

无;本包既不组装也不发送提供方请求。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与暂缓事项

- 表单提供 stdio、Streamable HTTP、超时和敏感字段编辑；重连策略仍使用组合时的默认值，页面不编辑它。
- 编辑时服务器名称不可修改，因为它属于每个已发布工具名称的一部分。

-----

<a id="model-experience"></a>
