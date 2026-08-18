# Agent Note: 设置管理的 Skill 与 MCP 服务器

Status: implemented

[English](2026-08-16-settings-managed-skills-and-mcp-servers.md) | 中文

## 问题

Web 设置页已经提供模型和常规配置，但没有入口查看当前工作区的 Skill 目录，也不能在不编辑 Host 配置的情况下管理 MCP 服务器。MCP 凭据还需要一条只写路径，使浏览器可以显示连接状态而不拿到环境变量或 HTTP 请求头。

## 决策

`ui-skill` 注册顶层设置分区，通过 `skill.list(sessionId, refresh)` 读取当前会话工作区。页面展示 source/provider 信息，只在 `localStorage` 的 `dsh.skill-picker.hidden.v1` 中存储聊天选择器可见性；该映射不改变 `SKILL.md`、模型调用或 Host 授权。刷新操作调用 Host `SkillRegistry.refresh()`，再重新读取工作区目录。

`mcp-manager` 以标准 MCP 服务器形态自管专属的 `mcp.json`——「服务器名 → 定义」的扁平映射（`url`/`command`、`headers`/`env`、1000 以下按秒以上按毫秒的 `timeout`、`enabled`）——原子写入并带热加载监视器，通过 `list` 暴露该宿主解析的路径，并为每个启用的定义挂载一个 `mcp-client` 运行时。设置页编辑器新增粘贴 JSON 导入，把该形态解析为每个服务器一个 save draft。Remote 提供 list、save、setEnabled、remove 和 restart 操作。list 投影会省略 `env` 与 `headers`，只返回 `hasSecrets`。编辑时省略敏感映射会保留已存值；只有 `clearSecrets` 才会显式清除它们。连接阶段和工具数量来自 `mcp-client` 发出的 `mcp/status` 事件，而不是插件是否激活。

MCP 设置客户端负责 stdio 与 Streamable HTTP 服务器的目录和编辑器。编辑时敏感输入保持空白，保存立即生效，只读设置会禁用修改操作；编辑时服务器名称固定，因为它是每个已发布工具名称的前缀。

## 曾考虑的替代方案

**让设置文档返回脱敏值，并由浏览器重建整个分区。** 不采用：脱敏后的替换会无声删除凭据；管理器的只写 draft 与显式清除操作让 Host 保持敏感字段所有权。

**把 MCP 连接状态表示成管理器插件是否激活。** 不采用：管理器可以激活但子服务器不可达。由客户端拥有的状态事件才表示真实传输生命周期和工具发现世代。

**使用客户端存储作为 Skill 目录来源。** 不采用：目录属于当前 Host 工作区，并且刷新后可能变化。客户端存储只负责把条目从聊天选择器中隐藏的展示偏好。

## 后果

设置现在可以管理已配置 MCP 服务器的完整生命周期，不必编辑 `cordis.yml`；敏感字段留在 Host 侧，实时子 fiber 会在每次已提交的设置变化后协调。Web UI 提供两个顶层管理分区，并覆盖本地化状态、校验、失败和只读行为。Skill 可见性跟随浏览器 profile，只影响选择器结果；已存在或直接输入的 Skill 仍可供 Host 和模型执行。

Host、客户端和 MCP 客户端的聚焦测试覆盖持久化、动态挂载／释放／重连、敏感字段保留与清除、状态投影、UI 修改、校验、失败状态和只读行为。真实 Web 快照与本地 UI 录制仍是组装客户端的产品界面验证。
