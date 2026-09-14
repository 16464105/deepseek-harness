/** Skills management Settings contribution. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls the client session service (ctx.sessions) this section
// reads the current session from.
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import { SkillSettingsSection, type SkillSettingsInjected } from './SkillSettingsSection.tsx'
import { SkillsDirectoryStore } from './skills-directory-store.ts'
import { SkillVisibility } from './visibility.ts'
import { en, NS, zh, type SkillSettingsKey } from './locales.ts'

export type { SkillSettingsInjected, SkillSettingsProps } from './SkillSettingsSection.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Skills management Settings copy. */
    'settings.skill': SkillSettingsKey
  }
}

/** Services required before the section can register. */
export const inject = ['slots', 'locale', 'remote.skills', 'sessions']

/**
 * Register the Skills Settings section over the session skill catalog.
 * @param ctx - the client context whose slots, locale, sessions, and Remote
 *   services the section consumes.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-skill: dictionaries')
  const t = ctx.locale.bind(NS)
  const sessions = ctx.sessions
  // The chat-picker visibility choice is shared with the picker's own filter,
  // so one instance owns it for the whole client.
  const visibility = new SkillVisibility()
  // The skills directory action state: the host's answer to "where do skills
  // live" plus the open gesture. One instance shared by the settings section.
  const directoryStore = new SkillsDirectoryStore(ctx.remote.skills)

  const currentSession: SkillSettingsInjected['currentSession'] = {
    getSnapshot: () => sessions.list.getSnapshot().current,
    subscribe: listener => sessions.list.subscribe(listener),
  }
  const injected = (): SkillSettingsInjected => ({
    currentSession,
    visibility,
    list: async (sessionId, refresh) => {
      // The explicit refresh gesture re-reads every provider; ordinary reads
      // ride the catalog's own cache.
      const result = await ctx.remote.skills.list({
        sessionId,
        ...refresh ? { refresh: true } : {},
      })
      if (!result.ok) throw new Error(`skills/list failed: ${result.error.code}: ${result.error.message}`)
      return result.value.skills
    },
    hooks: { skillsDirectory: directoryStore.store },
    loadDirectory: (sessionId) => { void directoryStore.load(sessionId) },
    openDirectory: () => { void directoryStore.open() },
  })

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'skills',
    order: 20,
    label: () => t('settings.nav'),
    locale: NS,
    inject: injected,
  }, SkillSettingsSection))
}
