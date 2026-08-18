// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  McpServerDraft, McpServerSnapshot,
} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '../src/client/index.ts'
import { McpSettingsSection } from '../src/client/McpSettingsSection.tsx'
import { parseMcpJson } from '../src/client/json-import.ts'
import { zh, type McpSettingsKey } from '../src/client/locales.ts'

function t(key: McpSettingsKey): string {
  return zh[key]
}

const EMPTY: McpServerSnapshot = { writable: true, documentPath: '/home/mcp.json', servers: [] }
const unusedHook = (() => { throw new Error('unused by MCP settings') }) as never
const kit = { useSessions: unusedHook, useWorkspaces: unusedHook }
const CONFIGURED: McpServerSnapshot = {
  writable: true,
  documentPath: '/home/mcp.json',
  servers: [{
    transport: 'stdio',
    serverName: 'files',
    enabled: true,
    command: 'npx',
    args: ['-y', 'server-filesystem'],
    cwd: '/workspace',
    toolCallTimeoutMs: 60_000,
    reconnect: { enabled: true },
    hasSecrets: true,
    phase: 'connected',
    toolCount: 3,
  }],
}

afterEach(cleanup)

function renderSection(options: {
  readonly snapshot?: McpServerSnapshot
  readonly save?: (draft: McpServerDraft) => Promise<McpServerSnapshot>
} = {}) {
  const snapshot = options.snapshot ?? EMPTY
  const list = vi.fn(() => Promise.resolve(snapshot))
  const save = vi.fn(options.save ?? (() => Promise.resolve(snapshot)))
  const setEnabled = vi.fn(() => Promise.resolve(snapshot))
  const remove = vi.fn(() => Promise.resolve(EMPTY))
  const restart = vi.fn(() => Promise.resolve(snapshot))
  const openDocument = vi.fn()
  render(<McpSettingsSection
    {...kit}
    close={() => {}}
    list={list}
    save={save}
    setEnabled={setEnabled}
    remove={remove}
    restart={restart}
    openDocument={openDocument}
    t={t as never}
  />)
  return { list, save, setEnabled, remove, restart, openDocument }
}

describe('McpSettingsSection', () => {
  it('adds stdio and HTTP servers with parsed write-only configuration', async () => {
    const { save } = renderSection()
    await screen.findByText('尚未配置 MCP 服务器。')
    fireEvent.click(screen.getByRole('button', { name: '添加服务器' }))
    fireEvent.change(screen.getByLabelText('服务器名称'), { target: { value: 'local_tools' } })
    fireEvent.change(screen.getByLabelText('启动命令'), { target: { value: 'npx' } })
    fireEvent.change(screen.getByLabelText('参数'), { target: { value: '-y\nserver-package' } })
    fireEvent.change(screen.getByLabelText('工作目录'), { target: { value: '/workspace' } })
    fireEvent.change(screen.getByLabelText('环境变量'), { target: { value: 'TOKEN=secret\nMODE=fast' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(save).toHaveBeenCalledWith({
        transport: 'stdio',
        serverName: 'local_tools',
        enabled: true,
        command: 'npx',
        args: ['-y', 'server-package'],
        cwd: '/workspace',
        env: { TOKEN: 'secret', MODE: 'fast' },
        toolCallTimeoutMs: 60_000,
      })
    })

    fireEvent.click(screen.getByRole('button', { name: '添加服务器' }))
    fireEvent.click(screen.getByRole('button', { name: 'HTTP' }))
    fireEvent.change(screen.getByLabelText('服务器名称'), { target: { value: 'remote' } })
    fireEvent.change(screen.getByLabelText('MCP 地址'), { target: { value: 'https://mcp.example.test/api' } })
    fireEvent.change(screen.getByLabelText('请求头'), { target: { value: 'Authorization: Bearer secret' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(save).toHaveBeenLastCalledWith({
        transport: 'streamable-http',
        serverName: 'remote',
        enabled: true,
        url: 'https://mcp.example.test/api',
        headers: { Authorization: 'Bearer secret' },
        toolCallTimeoutMs: 60_000,
      })
    })
  })

  it('shows runtime state and controls toggle, restart, and confirmed removal', async () => {
    const { setEnabled, restart, remove } = renderSection({ snapshot: CONFIGURED })
    expect(await screen.findByText('files')).toBeTruthy()
    expect(screen.getByText('已连接')).toBeTruthy()
    expect(screen.getByText('3 个工具')).toBeTruthy()
    expect(screen.getByText('已保存敏感配置')).toBeTruthy()

    fireEvent.click(screen.getByRole('checkbox'))
    await waitFor(() => { expect(setEnabled).toHaveBeenCalledWith('files', false) })
    fireEvent.click(screen.getByRole('button', { name: '重新连接 files' }))
    await waitFor(() => { expect(restart).toHaveBeenCalledWith('files') })
    fireEvent.click(screen.getByRole('button', { name: '删除 files' }))
    const confirmation = screen.getByText('确定删除 files？').parentElement!
    fireEvent.click(within(confirmation).getByRole('button', { name: '删除' }))
    await waitFor(() => { expect(remove).toHaveBeenCalledWith('files') })
  })

  it('does not reveal stored secrets while editing and can explicitly clear them', async () => {
    const { save } = renderSection({ snapshot: CONFIGURED })
    await screen.findByText('files')
    fireEvent.click(screen.getByRole('button', { name: '编辑 files' }))
    expect(screen.getByLabelText<HTMLTextAreaElement>('环境变量').value).toBe('')
    fireEvent.change(screen.getByLabelText('启动命令'), { target: { value: 'node' } })
    fireEvent.click(screen.getByLabelText('清除已保存的敏感配置'))
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(save).toHaveBeenCalledWith(expect.objectContaining({
        serverName: 'files',
        command: 'node',
        clearSecrets: true,
      }))
    })
    expect(save.mock.calls[0]?.[0]).not.toHaveProperty('env')
  })

  it('disables mutations for read-only settings', async () => {
    renderSection({ snapshot: { ...CONFIGURED, writable: false } })
    expect(await screen.findByText('当前设置文档为只读。')).toBeTruthy()
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '添加服务器' }).disabled).toBe(true)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '编辑 files' }).disabled).toBe(true)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '删除 files' }).disabled).toBe(true)
    expect(screen.getByRole<HTMLInputElement>('checkbox').disabled).toBe(true)
  })

  it('surfaces load, validation, and operation failures', async () => {
    const list = vi.fn(() => Promise.reject(new Error('offline')))
    render(<McpSettingsSection
      {...kit}
      close={() => {}}
      list={list}
      save={() => Promise.resolve(EMPTY)}
      setEnabled={() => Promise.resolve(EMPTY)}
      remove={() => Promise.resolve(EMPTY)}
      restart={() => Promise.resolve(EMPTY)}
      openDocument={() => {}}
      t={t as never}
    />)
    expect(await screen.findByText(/暂时无法读取 MCP 服务器/)).toBeTruthy()
    cleanup()

    const save = vi.fn(() => Promise.reject(new Error('write failed')))
    renderSection({ save })
    await screen.findByText('尚未配置 MCP 服务器。')
    fireEvent.click(screen.getByRole('button', { name: '添加服务器' }))
    fireEvent.change(screen.getByLabelText('服务器名称'), { target: { value: 'bad name' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(screen.getByRole('alert').textContent).toContain('服务器名称格式不正确。')
    fireEvent.change(screen.getByLabelText('服务器名称'), { target: { value: 'valid' } })
    fireEvent.change(screen.getByLabelText('启动命令'), { target: { value: 'node' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(await screen.findByText('操作失败，请重试。')).toBeTruthy()
  })
})

describe('parseMcpJson', () => {
  it('parses the standard JSON shape into server drafts', () => {
    const drafts = parseMcpJson(JSON.stringify({
      tapd_mcp_http: {
        url: 'https://mcpgw.knot.woa.com/tapd/',
        timeout: 20000,
        headers: { 'X-Tapd-Access-Token': 'token' },
        transportType: 'streamable-http',
      },
      gongfeng: {
        url: 'https://mcpgw.knot.woa.com/gongfeng',
        timeout: 60,
        headers: { Authorization: 'Bearer x' },
      },
    }))
    expect(drafts).toHaveLength(2)
    expect(drafts?.[0]).toMatchObject({
      serverName: 'tapd_mcp_http',
      transport: 'streamable-http',
      url: 'https://mcpgw.knot.woa.com/tapd/',
      headers: { 'X-Tapd-Access-Token': 'token' },
      toolCallTimeoutMs: 20_000,
    })
    expect(drafts?.[1]).toMatchObject({
      serverName: 'gongfeng',
      toolCallTimeoutMs: 60_000,
    })
  })

  it('rejects names outside the host alphabet and broken shapes', () => {
    expect(parseMcpJson('{iWiki官方MCP: {url: "https://x"}}')).toBeUndefined()
    expect(parseMcpJson('not json')).toBeUndefined()
    expect(parseMcpJson('{"x": {"nothing": true}}')).toBeUndefined()
  })
})
