/** MCP management Settings contribution. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { McpSettingsSection, type McpSettingsInjected } from './McpSettingsSection.tsx'
import { en, zh, type McpSettingsKey } from './locales.ts'

export type { McpSettingsInjected, McpSettingsProps } from './McpSettingsSection.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** MCP management Settings copy. */
    'settings.mcp': McpSettingsKey
  }
}

const NS = 'settings.mcp'
export const inject = ['slots', 'locale', 'remote', 'remote.mcpManager', 'connection']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-mcp: dictionaries')
  const t = ctx.locale.bind(NS)
  type Operation<T> = Promise<
    { ok: true; value: T } | { ok: false; error: { code: string; message: string } }
  >
  const unwrap = async <T>(operation: Operation<T>): Promise<T> => {
    const result = await operation
    if (!result.ok) throw new Error(`mcpManager failed: ${result.error.code}: ${result.error.message}`)
    return result.value
  }
  const injected = (): McpSettingsInjected => ({
    list: () => unwrap(ctx.remote.mcpManager.list()),
    save: draft => unwrap(ctx.remote.mcpManager.save(draft)),
    setEnabled: (serverName, enabled) => unwrap(ctx.remote.mcpManager.setEnabled(serverName, enabled)),
    remove: serverName => unwrap(ctx.remote.mcpManager.removeServer(serverName)),
    restart: serverName => unwrap(ctx.remote.mcpManager.restart(serverName)),
    openDocument: () => {
      // The host materializes the absent `mcp.json`, resolves its path, and
      // opens it; the client never submits a path of its own.
      void unwrap(ctx.remote.mcpManager.open()).catch(() => undefined)
    },
  })
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'mcp',
    order: 25,
    label: () => t('nav'),
    locale: NS,
    inject: injected,
  }, McpSettingsSection))
}
