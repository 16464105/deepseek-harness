/**
 * Standard MCP document parsing for the persistent server manager. The
 * dedicated `mcp.json` is a flat map of server name → server definition in
 * the Claude-Desktop-style shape a person already knows:
 *
 * ```json
 * {
 *   "tapd_mcp_http": {
 *     "url": "https://mcpgw.knot.woa.com/tapd/",
 *     "timeout": 20000,
 *     "headers": { "X-Tapd-Access-Token": "…" },
 *     "transportType": "streamable-http"
 *   }
 * }
 * ```
 *
 * @module dsh-mcp-manager/document
 */

import type { Config as McpClientConfig } from '@deepseek-ai/dsh-mcp-client'

/** One managed server: the resolved mcp-client config plus the enabled flag. */
export interface ManagedServer {
  readonly serverName: string
  readonly enabled: boolean
  readonly config: McpClientConfig
}

/** One raw entry of the standard document (unknown fields tolerated). */
interface StandardEntry {
  url?: unknown
  command?: unknown
  args?: unknown
  env?: unknown
  cwd?: unknown
  headers?: unknown
  timeout?: unknown
  transportType?: unknown
  enabled?: unknown
  reconnect?: unknown
}

/** The raw standard document: a flat map of server name → definition. */
export type StandardDocument = Record<string, unknown>

/** A positive finite number, or undefined. */
function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

/** A plain string-keyed map, or undefined. */
function stringMap(value: unknown): Record<string, string> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const result: Record<string, string> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'string') return undefined
    result[key] = entry
  }
  return result
}

/**
 * Interpret one entry's `timeout`: the conventional shape carries either
 * seconds (`60`) or milliseconds (`20000`), so values below 1000 read as
 * seconds and everything above as milliseconds — the same split the two
 * observed configurations use.
 * @param value - the raw timeout field.
 * @returns milliseconds, or undefined when absent or unusable.
 */
export function parseTimeout(value: unknown): number | undefined {
  const raw = positiveNumber(value)
  if (raw === undefined) return undefined
  return raw < 1000 ? raw * 1000 : raw
}

/** Parse one standard entry into a managed server, or undefined when unusable. */
function parseEntry(serverName: string, raw: unknown): ManagedServer | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const entry = raw as StandardEntry
  const timeoutMs = parseTimeout(entry.timeout)
  const enabled = entry.enabled === undefined ? true : entry.enabled === true
  const reconnect = entry.reconnect !== undefined
    ? (entry.reconnect as McpClientConfig['reconnect'])
    : undefined
  const common = {
    toolCallTimeoutMs: timeoutMs ?? 60_000,
    failOnStartupError: false,
    ...reconnect === undefined ? {} : { reconnect },
  }
  if (typeof entry.url === 'string' && entry.url.length > 0) {
    const headers = stringMap(entry.headers)
    if (entry.headers !== undefined && headers === undefined) return undefined
    return {
      serverName,
      enabled,
      config: {
        transport: 'streamable-http',
        serverName,
        url: entry.url,
        headers: headers ?? {},
        ...common,
      },
    }
  }
  if (typeof entry.command === 'string' && entry.command.length > 0) {
    const args = Array.isArray(entry.args) && entry.args.every(arg => typeof arg === 'string')
      ? entry.args
      : undefined
    if (entry.args !== undefined && args === undefined) return undefined
    const env = stringMap(entry.env)
    if (entry.env !== undefined && env === undefined) return undefined
    const cwd = entry.cwd === undefined || typeof entry.cwd === 'string' ? entry.cwd : undefined
    if (entry.cwd !== undefined && cwd === undefined) return undefined
    return {
      serverName,
      enabled,
      config: {
        transport: 'stdio',
        serverName,
        command: entry.command,
        args: args ?? [],
        env: env ?? {},
        cwd: cwd ?? '',
        ...common,
      },
    }
  }
  return undefined
}

/**
 * Parse a standard document into managed servers, refusing any entry that
 * neither the url nor the command shape can serve. Duplicate names are
 * impossible in a map; the validator below still re-checks the resolved list
 * because a malformed entry must name its own key.
 * @param raw - the parsed JSON document.
 * @returns the managed servers in document order.
 * @throws when an entry is unusable, naming the offending server name.
 */
export function parseStandardDocument(raw: unknown): ManagedServer[] {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return []
  const servers: ManagedServer[] = []
  for (const [serverName, entry] of Object.entries(raw)) {
    const parsed = parseEntry(serverName, entry)
    if (parsed === undefined) {
      throw new Error(`mcp-manager: entry "${serverName}" is not a usable MCP server definition`)
    }
    servers.push(parsed)
  }
  return servers
}

/** Render one managed server back into the standard document shape. */
function renderEntry(server: ManagedServer): Record<string, unknown> {
  const { enabled, config } = server
  const common: Record<string, unknown> = {
    ...enabled ? {} : { enabled: false },
    ...config.toolCallTimeoutMs === 60_000 ? {} : { timeout: config.toolCallTimeoutMs },
    ...config.reconnect === undefined ? {} : { reconnect: config.reconnect },
  }
  if (config.transport === 'stdio') {
    return {
      command: config.command,
      ...config.args.length === 0 ? {} : { args: config.args },
      ...Object.keys(config.env).length === 0 ? {} : { env: config.env },
      ...config.cwd === '' ? {} : { cwd: config.cwd },
      ...common,
    }
  }
  return {
    url: config.url,
    transportType: 'streamable-http',
    ...Object.keys(config.headers).length === 0 ? {} : { headers: config.headers },
    ...common,
  }
}

/**
 * Render the managed servers as the standard JSON document text.
 * @param servers - the managed server definitions, keyed by server name.
 * @returns the pretty-printed JSON document.
 */
export function renderStandardDocument(servers: readonly ManagedServer[]): string {
  const document: Record<string, unknown> = {}
  for (const server of servers) document[server.serverName] = renderEntry(server)
  return `${JSON.stringify(document, null, 2)}\n`
}
