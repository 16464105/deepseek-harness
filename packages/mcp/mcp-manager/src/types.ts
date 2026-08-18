/** Client-safe MCP management payloads. */

/** Automatic reconnect options accepted by the manager. */
export interface McpReconnectDraft {
  readonly enabled?: boolean
  readonly initialDelayMs?: number
  readonly maxDelayMs?: number
  readonly maxAttempts?: number
}

/** Shared editable fields for one managed MCP server. */
interface McpServerDraftBase {
  readonly serverName: string
  readonly enabled: boolean
  readonly toolCallTimeoutMs: number
  readonly reconnect?: McpReconnectDraft
  /** Remove stored environment variables or headers instead of retaining them. */
  readonly clearSecrets?: boolean
}

/** Editable stdio MCP server. `env` is write-only. */
export interface McpStdioServerDraft extends McpServerDraftBase {
  readonly transport: 'stdio'
  readonly command: string
  readonly args: readonly string[]
  readonly cwd: string
  readonly env?: Readonly<Record<string, string>>
}

/** Editable Streamable HTTP MCP server. `headers` is write-only. */
export interface McpHttpServerDraft extends McpServerDraftBase {
  readonly transport: 'streamable-http'
  readonly url: string
  readonly headers?: Readonly<Record<string, string>>
}

/** Complete write payload for one managed server. */
export type McpServerDraft = McpStdioServerDraft | McpHttpServerDraft

/** Runtime connection phase shown by management surfaces. */
export type McpManagedPhase = 'disabled' | 'connecting' | 'connected' | 'reconnecting' | 'failed'

/** Non-secret projection of one managed stdio server. */
export interface McpStdioServerView {
  readonly transport: 'stdio'
  readonly serverName: string
  readonly enabled: boolean
  readonly command: string
  readonly args: readonly string[]
  readonly cwd: string
  readonly toolCallTimeoutMs: number
  readonly reconnect?: McpReconnectDraft
  readonly hasSecrets: boolean
  readonly phase: McpManagedPhase
  readonly toolCount: number
}

/** Non-secret projection of one managed Streamable HTTP server. */
export interface McpHttpServerView {
  readonly transport: 'streamable-http'
  readonly serverName: string
  readonly enabled: boolean
  readonly url: string
  readonly toolCallTimeoutMs: number
  readonly reconnect?: McpReconnectDraft
  readonly hasSecrets: boolean
  readonly phase: McpManagedPhase
  readonly toolCount: number
}

/** Non-secret projection of one managed server. */
export type McpServerView = McpStdioServerView | McpHttpServerView

/** Current managed server directory. */
export interface McpServerSnapshot {
  readonly writable: boolean
  /** Absolute host path of the dedicated `mcp.json` document, for the settings-page open action. */
  readonly documentPath: string
  readonly servers: readonly McpServerView[]
}
