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
      'llm-deepseek',
      'agent-default-model',
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
    expect(rows.get('llm-deepseek')?.disabled).not.toBe(true)
    expect(rows.get('llm-tencent-codebuddy')?.name).toBe('@deepseek-ai/dsh-llm-tencent-codebuddy')
  })
})
