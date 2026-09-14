import { describe, expect, it } from 'vitest'
import { composeEntries } from '@deepseek-ai/dsh-app-boot'
import { loadOverlayPatches } from '@deepseek-ai/dsh-app-boot'
import { fileURLToPath } from 'node:url'

describe('desktop profile bundle', () => {
  it('pins loopback random-port hosting and the Tencent default route', () => {
    const path = fileURLToPath(new URL('../cordis.patch.yml', import.meta.url))
    const baseRows = [
      'webserver',
      'web-runtime',
      'connection',
      'client-hmr',
      'attachment-local',
      'llm-deepseek',
      'agent-default-model',
      'ui-settings-models',
    ].map(id => ({ id, name: `test-${id}` }))
    const rows = new Map(composeEntries([
      [{ insert: baseRows }],
      loadOverlayPatches('desktop-test', path),
    ])
      .filter(row => typeof row.id === 'string')
      .map(row => [row.id, row]))

    expect(rows.get('webserver')?.config).toEqual({ host: '127.0.0.1', port: 0 })
    expect(rows.get('web-runtime')?.config).toMatchObject({
      printUrl: false,
      openBrowser: false,
      surfaceContext: false,
      trustedHosts: [],
    })
    expect(rows.get('agent-default-model')?.config).toEqual({
      provider: 'tencent-internal',
      model: 'gpt-5.6-sol',
    })
    // The deployment raises the per-side image bound through composition
    // rather than a patched package default.
    expect(rows.get('attachment-local')?.config).toEqual({ maxImageDimension: 16_384 })
    // A first-run user is onboarded into this deployment's own route.
    expect(rows.get('ui-settings-models')?.config).toEqual({ preferredProvider: 'tencent-internal' })
    expect(rows.get('llm-deepseek')?.disabled).not.toBe(true)
    expect(rows.get('llm-tencent-codebuddy')?.name).toBe('@deepseek-ai/dsh-llm-tencent-codebuddy')
    // Upstream's base and web-app bundles carry no browser or MCP row, so this
    // layer owns them; without these mounts the packaged desktop ships the
    // plain Web surface.
    expect(rows.get('browser')?.name).toBe('@deepseek-ai/dsh-browser')
    expect(rows.get('browser-popup')?.name).toBe('@deepseek-ai/dsh-browser-popup')
    expect(rows.get('mcp-manager')?.name).toBe('@deepseek-ai/dsh-mcp-manager')
    expect(rows.get('ui-settings-mcp')?.name).toBe('@deepseek-ai/dsh-client-ui-settings-mcp')
  })
})
