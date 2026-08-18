# MCP server management

English | [中文](mcp.zh.md)

The MCP packages connect the Host to external Model Context Protocol servers. `mcp-client` owns one transport, tool discovery, reconnect supervisor, and model-facing tool generation per server. `mcp-manager` persists those definitions under the `mcp-manager` settings namespace, hides environment variables and HTTP headers from Remote callers, and reconciles enabled child fibers. The Web settings consumer is documented in [`packages/client/ui-settings-mcp/README.md`](../../packages/client/ui-settings-mcp/README.md); package-level configuration and limitations live in [`packages/mcp/mcp-manager/README.md`](../../packages/mcp/mcp-manager/README.md).

## Runtime status

The client emits `mcp/status` for transport phases and discovered tool counts. The manager projects those values without treating its own plugin activation as server connectivity. Disabling or removing an entry disposes its child fiber, unregistering the server's published tools; enabling or restarting mounts a fresh generation.

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
