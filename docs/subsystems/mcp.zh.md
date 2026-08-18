# MCP 服务器管理

[English](mcp.md) | 中文

MCP 包把 Host 连接到外部 Model Context Protocol 服务器。`mcp-client` 为每个服务器拥有一个传输、工具发现、重连 supervisor 和模型可见工具世代；`mcp-manager` 在 `mcp-manager` 设置命名空间中持久化定义，向 Remote 调用方隐藏环境变量和 HTTP 请求头，并协调启用的子 fiber。Web 设置消费者见 [`packages/client/ui-settings-mcp/README.md`](../../packages/client/ui-settings-mcp/README.md)；包级配置与限制见 [`packages/mcp/mcp-manager/README.md`](../../packages/mcp/mcp-manager/README.md)。

## 运行时状态

客户端为传输阶段和已发现工具数量发出 `mcp/status`。管理器投影这些值，不把自身插件激活误报为服务器已连接。停用或删除条目会释放子 fiber，并注销服务器发布的工具；启用或重连会挂载新的世代。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — this section is byte-identical in both language sides of the page. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxmcpmanager--mcpmanager"></a>

### `ctx.mcpManager` — `McpManager`

Host service that persists definitions and mounts one mcp-client fiber per enabled server.

```ts cordis-catalog
/** Return every managed server without environment variables or HTTP headers.
 * @returns The current writable state, the host-resolved `mcp.json` path, and the secret-redacted server directory.
 */
@Remote('list') async list(): Promise<McpServerSnapshot>

/** Materialize the absent `mcp.json` and return its path for the open action.
 * @returns The host-resolved document path, ready for a native opener.
 */
@Remote('openDocument') async openDocument(): Promise<string>

/** Create or replace one server definition, retaining omitted secrets on edits.
 * @param draft - The validated server definition and optional write-only secrets.
 * @returns The updated writable state and server directory.
 */
@Remote('save') async save(draft: McpServerDraft): Promise<McpServerSnapshot>

/** Enable or disable one stored server and reconcile its live fiber.
 * @param serverName - Stored server namespace.
 * @param enabled - Whether the manager should mount the server.
 * @returns The updated writable state and server directory.
 */
@Remote('setEnabled') async setEnabled(serverName: string, enabled: boolean): Promise<McpServerSnapshot>

/** Delete one stored server and dispose its live fiber.
 * @param serverName - Stored server namespace.
 * @returns The updated writable state and server directory.
 */
@Remote('removeServer') async remove(serverName: string): Promise<McpServerSnapshot>

/** Dispose and reconnect one enabled server without changing its stored definition.
 * @param serverName - Stored server namespace.
 * @returns The updated writable state and server directory.
 */
@Remote('restart') async restart(serverName: string): Promise<McpServerSnapshot>
```

Source: [`packages/mcp/mcp-manager/src/index.ts:114`](../../packages/mcp/mcp-manager/src/index.ts)

<a id="mcp-events"></a>

### `mcp/*` events

<a id="mcpstatus--emit"></a>

#### `mcp/status` — emit

Publish a configured server's transport phase and discovered tool count to management consumers.

```ts cordis-catalog
/**
 * Publish a configured server's transport phase and discovered tool count to management consumers.
 * @param status - Current state of one configured MCP server.
 * @mode emit
 */
'mcp/status'(status: McpConnectionStatus): void
```

Source: [`packages/mcp/mcp-client/src/index.ts:41`](../../packages/mcp/mcp-client/src/index.ts)
<!-- END GENERATED cordis-surface -->
