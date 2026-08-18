/** Persistent MCP server manager with a secret-redacted Remote control face. */

import type { Context, Fiber, Plugin } from '@deepseek-ai/cordis'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import * as McpClient from '@deepseek-ai/dsh-mcp-client'
import type { Config as McpClientConfig, McpConnectionStatus } from '@deepseek-ai/dsh-mcp-client'
import { watch as chokidarWatch } from 'chokidar'
import { mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { parseStandardDocument, renderStandardDocument, type ManagedServer } from './document.ts'
import type {
  McpManagedPhase,
  McpServerDraft,
  McpServerSnapshot,
  McpServerView,
} from './types.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Persistent dynamic MCP server manager. */
    mcpManager: McpManager
  }
}

/** Runtime options for {@link McpManager}; the document path defaults to `<harness home>/mcp.json`. */
export interface McpManagerOptions {
  /** Absolute path of the dedicated MCP JSON document (tests point it at a temp file). */
  documentPath?: string
  /** Watch the document and hot-publish external edits; defaults to true. Tests pass false. */
  watch?: boolean
  /** Watcher write-settle window in milliseconds; defaults to 100. */
  debounceMs?: number
}

// Every dynamic config has already passed the document parser. The runtime
// face intentionally omits Config so Cordis does not normalize it a second
// time before calling the mcp-client entry point.
const MCP_CLIENT_RUNTIME = {
  name: McpClient.name,
  inject: McpClient.inject,
  apply: McpClient.apply,
} satisfies Plugin.Object

interface RunningServer {
  readonly fiber: Fiber
  readonly signature: string
}

interface RuntimeState {
  readonly phase: McpManagedPhase
  readonly toolCount: number
}

function configSignature(config: McpClientConfig): string {
  return JSON.stringify(config)
}

function signatureOf(server: ManagedServer): string {
  return configSignature(server.config)
}

/** Whether a filesystem error means absence; every non-ENOENT failure must surface. */
function isENOENT(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === 'ENOENT'
}

function draftToConfig(draft: McpServerDraft, previous: ManagedServer | undefined): McpClientConfig {
  const common = {
    serverName: draft.serverName,
    toolCallTimeoutMs: draft.toolCallTimeoutMs,
    failOnStartupError: false,
    ...draft.reconnect === undefined ? {} : { reconnect: { ...draft.reconnect } },
  }
  if (draft.transport === 'stdio') {
    const retained = previous?.config.transport === 'stdio' ? previous.config.env : {}
    return {
      ...common,
      transport: 'stdio',
      command: draft.command,
      args: [...draft.args],
      cwd: draft.cwd,
      env: draft.clearSecrets === true ? {} : { ...(draft.env ?? retained) },
    }
  }
  const retained = previous?.config.transport === 'streamable-http' ? previous.config.headers : {}
  return {
    ...common,
    transport: 'streamable-http',
    url: draft.url,
    headers: draft.clearSecrets === true ? {} : { ...(draft.headers ?? retained) },
  }
}

/** Host service that persists definitions and mounts one mcp-client fiber per enabled server. */
export class McpManager extends TypertRemoteService {
  static inject = ['tools']

  private readonly documentPath: string
  private readonly watch: boolean
  private readonly debounceMs: number
  /** The last successfully parsed servers; empty until the document is read. */
  private servers: ManagedServer[] = []
  private readonly running = new Map<string, RunningServer>()
  private readonly states = new Map<string, RuntimeState>()
  private reconcileTail: Promise<void> = Promise.resolve()
  private closed = false
  /** Settles once the initial document read (and materialization) is done. */
  private readonly ready: Promise<void>

  constructor(ctx: Context, options: McpManagerOptions = {}) {
    super(ctx, 'mcpManager')
    ctx.on('mcp/status', (status) => { this.observeStatus(status) })
    this.documentPath = options.documentPath ?? dshHomePath('mcp.json')
    this.watch = options.watch ?? true
    this.debounceMs = options.debounceMs ?? 100
    this.ready = this.load().catch((error: unknown) => { this.ctx.logger.error(error) })
    if (this.watch) {
      const watcher = chokidarWatch(this.documentPath, {
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: this.debounceMs,
          pollInterval: Math.max(1, Math.min(this.debounceMs, 10)),
        },
      })
      watcher.on('all', () => {
        if (this.closed) return
        void this.reload().catch((error: unknown) => { this.ctx.logger.error(error) })
      })
      ctx.effect(() => async () => { await watcher.close() }, 'mcp-manager: document watcher')
    }
    ctx.effect(() => async () => {
      this.closed = true
      await this.reconcileTail
      await Promise.all([...this.running.values()].map(server => server.fiber.dispose()))
      this.running.clear()
      this.states.clear()
    }, 'mcp-manager: dynamic servers')
  }

  /** Read the document, materialize an absent one, and reconcile. */
  private async load(): Promise<void> {
    let text: string | undefined
    try {
      text = await readFile(this.documentPath, 'utf8')
    } catch (error) {
      if (!isENOENT(error)) throw error
      text = undefined
    }
    if (text === undefined) {
      // The file is absent: materialize the empty document so the open
      // action and any direct editor workflow always see a real file.
      await this.persist([])
      await this.scheduleReconcile()
      return
    }
    this.applyText(text)
    await this.scheduleReconcile()
  }

  /** Reread the document after an external edit; invalid content keeps the last good state. */
  private async reload(): Promise<void> {
    const text = await readFile(this.documentPath, 'utf8')
    this.applyText(text)
    await this.scheduleReconcile()
  }

  private applyText(text: string): void {
    if (text.trim() === '') {
      this.servers = []
      return
    }
    const parsed = parseStandardDocument(JSON.parse(text) as unknown)
    this.servers = parsed
  }

  /** Persist the current servers into the standard document. */
  private async persist(servers: readonly ManagedServer[]): Promise<void> {
    await mkdir(dirname(this.documentPath), { recursive: true, mode: 0o700 })
    await withFileLock(this.documentPath, async () => {
      await writeFileAtomic(this.documentPath, renderStandardDocument(servers), {
        mode: 0o600,
        dirMode: 0o700,
      })
    })
    this.servers = [...servers]
  }

  /** Materialize the absent `mcp.json` and return its path for the open action. */
  @Remote('openDocument')
  async openDocument(): Promise<string> {
    await this.ready
    try {
      await readFile(this.documentPath, 'utf8')
    } catch (error) {
      if (!isENOENT(error)) throw error
      await this.persist([])
    }
    return this.documentPath
  }

  /** Return every managed server without environment variables or HTTP headers.
   * @returns The current writable state, the host-resolved `mcp.json` path, and the secret-redacted server directory.
   */
  @Remote('list')
  async list(): Promise<McpServerSnapshot> {
    await this.ready
    return {
      writable: true,
      documentPath: this.documentPath,
      servers: this.servers.map(server => this.project(server)),
    }
  }

  /** Create or replace one server definition, retaining omitted secrets on edits.
   * @param draft - The validated server definition and optional write-only secrets.
   * @returns The updated writable state and server directory.
   */
  @Remote('save')
  async save(draft: McpServerDraft): Promise<McpServerSnapshot> {
    await this.ready
    const previous = this.servers.find(server => server.serverName === draft.serverName)
    const config = draftToConfig(draft, previous)
    const next: ManagedServer = { serverName: draft.serverName, enabled: draft.enabled, config }
    const servers = previous === undefined
      ? [...this.servers, next]
      : this.servers.map(server => server.serverName === draft.serverName ? next : server)
    await this.persist(servers)
    await this.scheduleReconcile()
    return await this.list()
  }

  /** Enable or disable one stored server and reconcile its live fiber.
   * @param serverName - Stored server namespace.
   * @param enabled - Whether the manager should mount the server.
   * @returns The updated writable state and server directory.
   */
  @Remote('setEnabled')
  async setEnabled(serverName: string, enabled: boolean): Promise<McpServerSnapshot> {
    await this.ready
    const target = this.servers.find(server => server.serverName === serverName)
    if (target === undefined) throw new Error(`mcp-manager: unknown server "${serverName}"`)
    const servers = this.servers.map(server => server.serverName === serverName
      ? { ...server, enabled }
      : server)
    await this.persist(servers)
    await this.scheduleReconcile()
    return await this.list()
  }

  /** Delete one stored server and dispose its live fiber.
   * @param serverName - Stored server namespace.
   * @returns The updated writable state and server directory.
   */
  @Remote('removeServer')
  async remove(serverName: string): Promise<McpServerSnapshot> {
    await this.ready
    if (!this.servers.some(server => server.serverName === serverName)) {
      throw new Error(`mcp-manager: unknown server "${serverName}"`)
    }
    await this.persist(this.servers.filter(server => server.serverName !== serverName))
    await this.scheduleReconcile()
    return await this.list()
  }

  /** Dispose and reconnect one enabled server without changing its stored definition.
   * @param serverName - Stored server namespace.
   * @returns The updated writable state and server directory.
   */
  @Remote('restart')
  async restart(serverName: string): Promise<McpServerSnapshot> {
    await this.ready
    const managed = this.servers.find(server => server.serverName === serverName)
    if (managed === undefined) throw new Error(`mcp-manager: unknown server "${serverName}"`)
    if (!managed.enabled) throw new Error(`mcp-manager: disabled server "${serverName}" cannot reconnect`)
    const live = this.running.get(serverName)
    if (live !== undefined) {
      this.running.delete(serverName)
      await live.fiber.dispose()
    }
    await this.mount(managed)
    return await this.list()
  }

  private observeStatus(status: McpConnectionStatus): void {
    if (!this.servers.some(server => server.serverName === status.serverName && server.enabled)) return
    this.states.set(status.serverName, { phase: status.phase, toolCount: status.toolCount })
  }

  private scheduleReconcile(): Promise<void> {
    const run = this.reconcileTail.then(() => this.reconcile())
    this.reconcileTail = run.catch((error: unknown) => { this.ctx.logger.error(error) })
    return run
  }

  private async reconcile(): Promise<void> {
    const desired = new Map(this.servers.map(server => [server.serverName, server]))
    for (const [serverName, live] of [...this.running]) {
      const next = desired.get(serverName)
      if (next?.enabled === true && live.signature === signatureOf(next)) continue
      this.running.delete(serverName)
      await live.fiber.dispose()
    }
    for (const server of desired.values()) {
      if (!server.enabled) {
        this.states.set(server.serverName, { phase: 'disabled', toolCount: 0 })
        continue
      }
      if (this.running.has(server.serverName)) continue
      await this.mount(server)
    }
    for (const serverName of [...this.states.keys()]) {
      if (!desired.has(serverName)) this.states.delete(serverName)
    }
  }

  private async mount(server: ManagedServer): Promise<void> {
    this.states.set(server.serverName, { phase: 'connecting', toolCount: 0 })
    const fiber = this.ctx.plugin(MCP_CLIENT_RUNTIME, server.config)
    this.running.set(server.serverName, { fiber, signature: signatureOf(server) })
    try {
      await fiber.await()
    } catch (error) {
      if (this.running.get(server.serverName)?.fiber === fiber) {
        this.running.delete(server.serverName)
        this.states.set(server.serverName, { phase: 'failed', toolCount: 0 })
      }
      this.ctx.logger.error(error)
    }
  }

  private project(server: ManagedServer): McpServerView {
    const state = this.states.get(server.serverName)
      ?? { phase: server.enabled ? 'connecting' as const : 'disabled' as const, toolCount: 0 }
    const common = {
      serverName: server.serverName,
      enabled: server.enabled,
      toolCallTimeoutMs: server.config.toolCallTimeoutMs,
      ...server.config.reconnect === undefined ? {} : { reconnect: { ...server.config.reconnect } },
      phase: state.phase,
      toolCount: state.toolCount,
    }
    return server.config.transport === 'stdio'
      ? {
        ...common,
        transport: 'stdio',
        command: server.config.command,
        args: [...server.config.args],
        cwd: server.config.cwd,
        hasSecrets: Object.keys(server.config.env).length > 0,
      }
      : {
        ...common,
        transport: 'streamable-http',
        url: server.config.url,
        hasSecrets: Object.keys(server.config.headers).length > 0,
      }
  }
}

export default McpManager
