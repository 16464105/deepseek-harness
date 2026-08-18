/**
 * Client-side parsing of the standard MCP JSON shape
 * (`{serverName: {url|command, headers|env, timeout, transportType}}`) into
 * one save draft per server. The same rules as the host's `document.ts`:
 * `timeout` below 1000 reads as seconds, a `url` selects streamable-http,
 * a `command` selects stdio, and headers/env maps split into drafts.
 */

import type { McpServerDraft } from '@deepseek-ai/dsh-api-remotes/client'

/** One raw standard entry. */
interface StandardEntry {
  url?: unknown
  command?: unknown
  args?: unknown
  env?: unknown
  cwd?: unknown
  headers?: unknown
  timeout?: unknown
  enabled?: unknown
}

/** The same server-name alphabet the host's mcp-client accepts. */
export const MCP_SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

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

/** Interpret the timeout field: values below 1000 read as seconds. */
function timeoutMs(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined
  return value < 1000 ? value * 1000 : value
}

/**
 * Parse the pasted standard JSON into server drafts.
 * @param text - the pasted document text.
 * @returns the drafts, or undefined when the text is not a usable document.
 */
export function parseMcpJson(text: string): McpServerDraft[] | undefined {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return undefined
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const drafts: McpServerDraft[] = []
  for (const [serverName, value] of Object.entries(raw)) {
    if (!MCP_SERVER_NAME_PATTERN.test(serverName)) return undefined
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
    const entry = value as StandardEntry
    const common = {
      serverName,
      enabled: entry.enabled !== false,
      toolCallTimeoutMs: timeoutMs(entry.timeout) ?? 60_000,
    }
    if (typeof entry.url === 'string' && entry.url.length > 0) {
      const headers = stringMap(entry.headers)
      if (entry.headers !== undefined && headers === undefined) return undefined
      drafts.push({
        ...common,
        transport: 'streamable-http',
        url: entry.url,
        ...(headers === undefined ? {} : { headers }),
      })
      continue
    }
    if (typeof entry.command === 'string' && entry.command.length > 0) {
      if (entry.args !== undefined
        && (!Array.isArray(entry.args) || entry.args.some(arg => typeof arg !== 'string'))) return undefined
      const env = stringMap(entry.env)
      if (entry.env !== undefined && env === undefined) return undefined
      if (entry.cwd !== undefined && typeof entry.cwd !== 'string') return undefined
      drafts.push({
        ...common,
        transport: 'stdio',
        command: entry.command,
        args: entry.args === undefined ? [] : entry.args as string[],
        cwd: entry.cwd === undefined ? '' : entry.cwd,
        ...(env === undefined ? {} : { env }),
      })
      continue
    }
    return undefined
  }
  return drafts
}
