import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { parseStandardDocument, parseTimeout } from '../src/document.ts'

const clientRuntime = vi.hoisted(() => {
  return {
    mounted: [] as Array<{ config: Record<string, unknown>; dispose: ReturnType<typeof vi.fn> }>,
  }
})

vi.mock('@deepseek-ai/dsh-mcp-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@deepseek-ai/dsh-mcp-client')>()
  return {
    ...actual,
    async apply(ctx: Context, config: { serverName: string }): Promise<void> {
      const dispose = vi.fn()
      clientRuntime.mounted.push({ config: structuredClone(config), dispose })
      ctx.effect(() => dispose)
      ctx.emit('mcp/status', {
        serverName: config.serverName,
        phase: 'connected',
        toolCount: config.serverName.length,
      })
    },
  }
})

import McpManager, { type McpServerDraft } from '../src/index.ts'

const STDIO_DRAFT: McpServerDraft = {
  transport: 'stdio',
  serverName: 'local_files',
  enabled: true,
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
  cwd: '/tmp',
  env: { TOKEN: 'never-return-this' },
  toolCallTimeoutMs: 30_000,
}

const contexts: Context[] = []
let documentDir: string | undefined

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  if (documentDir !== undefined) {
    await rm(documentDir, { recursive: true, force: true })
    documentDir = undefined
  }
})

beforeEach(() => {
  clientRuntime.mounted.length = 0
})

async function boot(options: { watch?: boolean } = {}): Promise<{
  ctx: Context
  manager: McpManager
  documentPath: string
}> {
  documentDir = await mkdtemp(join(tmpdir(), 'dsh-mcp-manager-'))
  const documentPath = join(documentDir, 'mcp.json')
  const ctx = new Context()
  contexts.push(ctx)
  ctx.provide('tools', {} as never)
  await ctx.plugin(McpManager, { documentPath, watch: options.watch ?? false })
  const manager = ctx.get('mcpManager') as McpManager
  return { ctx, manager, documentPath }
}

describe('standard document parsing', () => {
  it('parses the Claude-Desktop-style streamable-http shape', () => {
    const servers = parseStandardDocument({
      tapd_mcp_http: {
        url: 'https://mcpgw.knot.woa.com/tapd/',
        timeout: 20000,
        headers: { 'X-Tapd-Access-Token': 'token' },
        transportType: 'streamable-http',
      },
    })
    expect(servers).toHaveLength(1)
    expect(servers[0]).toMatchObject({
      serverName: 'tapd_mcp_http',
      enabled: true,
      config: {
        transport: 'streamable-http',
        url: 'https://mcpgw.knot.woa.com/tapd/',
        headers: { 'X-Tapd-Access-Token': 'token' },
        toolCallTimeoutMs: 20_000,
      },
    })
  })

  it('interprets small timeouts as seconds and large as milliseconds', () => {
    expect(parseTimeout(60)).toBe(60_000)
    expect(parseTimeout(20_000)).toBe(20_000)
    expect(parseTimeout(undefined)).toBeUndefined()
    expect(parseTimeout('x')).toBeUndefined()
  })

  it('parses a command entry as stdio and rejects unusable entries', () => {
    const servers = parseStandardDocument({
      local: { command: 'npx', args: ['-y', 'server'], cwd: '/tmp', env: { A: 'b' } },
    })
    expect(servers[0]?.config).toMatchObject({
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'server'],
      cwd: '/tmp',
      env: { A: 'b' },
    })
    expect(() => parseStandardDocument({ broken: { nothing: true } }))
      .toThrow(/not a usable MCP server definition/)
  })

  it('treats missing enabled as true and missing timeout as the default', () => {
    const [server] = parseStandardDocument({ x: { url: 'https://e' } })
    expect(server?.enabled).toBe(true)
    expect(server?.config.toolCallTimeoutMs).toBe(60_000)
  })
})

describe('McpManager', () => {
  it('loads a pre-existing standard document at mount', async () => {
    documentDir = await mkdtemp(join(tmpdir(), 'dsh-mcp-manager-'))
    const documentPath = join(documentDir, 'mcp.json')
    await writeFile(documentPath, JSON.stringify({
      tapd_mcp_http: {
        url: 'https://mcpgw.knot.woa.com/tapd/',
        timeout: 20000,
        headers: { 'X-Tapd-Access-Token': 'never-return-this' },
        transportType: 'streamable-http',
      },
    }))
    const ctx = new Context()
    contexts.push(ctx)
    ctx.provide('tools', {} as never)
    await ctx.plugin(McpManager, { documentPath, watch: false })
    const manager = ctx.get('mcpManager') as McpManager

    const snapshot = await manager.list()
    expect(snapshot.documentPath).toBe(documentPath)
    expect(snapshot.servers).toHaveLength(1)
    expect(snapshot.servers[0]).toMatchObject({
      transport: 'streamable-http',
      serverName: 'tapd_mcp_http',
      url: 'https://mcpgw.knot.woa.com/tapd/',
      toolCallTimeoutMs: 20_000,
      hasSecrets: true,
      phase: 'connected',
      toolCount: 13,
    })
    expect(JSON.stringify(snapshot)).not.toContain('never-return-this')
    expect(clientRuntime.mounted).toHaveLength(1)
    expect(clientRuntime.mounted[0]?.config).toMatchObject({
      serverName: 'tapd_mcp_http',
      url: 'https://mcpgw.knot.woa.com/tapd/',
      headers: { 'X-Tapd-Access-Token': 'never-return-this' },
    })
  })

  it('persists saves as the standard document and retains omitted secrets', async () => {
    const { manager, documentPath } = await boot()
    await manager.save(STDIO_DRAFT)
    const stored = JSON.parse(await readFile(documentPath, 'utf8')) as Record<string, unknown>
    expect(stored).toMatchObject({
      local_files: { command: 'npx', env: { TOKEN: 'never-return-this' } },
    })

    const { env: _env, ...withoutEnv } = STDIO_DRAFT
    await manager.save({ ...withoutEnv, command: 'node' })
    let current = JSON.parse(await readFile(documentPath, 'utf8')) as Record<string, unknown>
    expect(current['local_files']).toMatchObject({ command: 'node', env: { TOKEN: 'never-return-this' } })

    const cleared = await manager.save({ ...withoutEnv, command: 'node', clearSecrets: true })
    current = JSON.parse(await readFile(documentPath, 'utf8')) as Record<string, unknown>
    // An emptied secret map leaves no env key at all in the standard document.
    expect(current['local_files']).not.toHaveProperty('env')
    expect(cleared.servers[0]?.hasSecrets).toBe(false)
  })

  it('disposes and remounts fibers across disable, enable, restart, and remove', async () => {
    const { manager } = await boot()
    await manager.save(STDIO_DRAFT)
    const first = clientRuntime.mounted[0]!

    const disabled = await manager.setEnabled('local_files', false)
    expect(first.dispose).toHaveBeenCalledOnce()
    expect(disabled.servers[0]).toMatchObject({ enabled: false, phase: 'disabled', toolCount: 0 })

    await manager.setEnabled('local_files', true)
    expect(clientRuntime.mounted).toHaveLength(2)
    const second = clientRuntime.mounted[1]!

    await manager.restart('local_files')
    expect(second.dispose).toHaveBeenCalledOnce()
    expect(clientRuntime.mounted).toHaveLength(3)

    const removed = await manager.remove('local_files')
    expect(clientRuntime.mounted[2]?.dispose).toHaveBeenCalledOnce()
    expect(removed.servers).toEqual([])
  })

  it('rejects unknown targets and disabled restart', async () => {
    const { manager } = await boot()
    await manager.save(STDIO_DRAFT)
    await expect(manager.remove('missing')).rejects.toThrow(/unknown server/)
    await manager.setEnabled('local_files', false)
    await expect(manager.restart('local_files')).rejects.toThrow(/disabled server/)
  })

  it('materializes the empty mcp.json at mount and exposes its path', async () => {
    const { manager, documentPath } = await boot()
    await expect(manager.list()).resolves.toMatchObject({ documentPath, servers: [] })
    const onDisk = JSON.parse(await readFile(documentPath, 'utf8')) as unknown
    expect(onDisk).toEqual({})
  })

  it('hot-publishes an external mcp.json edit into the manager', async () => {
    const { manager, documentPath } = await boot({ watch: true })
    await manager.list()
    await writeFile(documentPath, JSON.stringify({
      gongfeng: {
        url: 'https://mcpgw.knot.woa.com/gongfeng',
        timeout: 60,
        headers: { Authorization: 'Bearer token' },
      },
    }))
    await vi.waitFor(async () => {
      const listed = await manager.list()
      expect(listed.servers).toHaveLength(1)
      expect(listed.servers[0]?.serverName).toBe('gongfeng')
      expect(listed.servers[0]?.toolCallTimeoutMs).toBe(60_000)
    }, { timeout: 5000 })
  })
})
