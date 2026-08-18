import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { SessionId, SkillEntry } from '@deepseek-ai/dsh-api-remotes/client'
import { IconFolderOpenOutline16, IconRefreshOutline16, IconSearchOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SkillVisibility } from './visibility.ts'
import type { SkillsDirectoryState } from './skills-directory-store.ts'
import type { SkillKey } from './locales.ts'
import css from './SkillSettingsSection.module.css'

/** Settings-page dependencies supplied by the plugin registration. */
export interface SkillSettingsInjected {
  readonly currentSession: {
    readonly getSnapshot: () => SessionId | undefined
    readonly subscribe: (listener: () => void) => () => void
  }
  readonly visibility: SkillVisibility
  readonly list: (sessionId: SessionId, refresh: boolean) => Promise<readonly SkillEntry[]>
  hooks: {
    /** User skills directory facts, bound by the renderer as useSkillsDirectory. */
    skillsDirectory: {
      getSnapshot: () => SkillsDirectoryState
      subscribe: (listener: () => void) => () => void
    }
  }
  /** Read the host directory facts for the current session. */
  loadDirectory: (sessionId: SessionId) => void
  /** Ask the host to open the user skills directory on the desktop. */
  openDirectory: () => void
}

/** Full props assembled by the Settings slot renderer. */
export type SkillSettingsProps = PropsRuntime<'settings.section'>
  & PropsLocale<'skill'>
  & InjectFace<SkillSettingsInjected>

type ViewState =
  | { readonly status: 'idle' | 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly skills: readonly SkillEntry[] }

const SOURCE_KEYS = {
  'project-dsh': 'settings.sourceProject',
  'project-agents': 'settings.sourceProject',
  'user-dsh': 'settings.sourceUser',
  'user-agents': 'settings.sourceUser',
  bundled: 'settings.sourceBundled',
  runtime: 'settings.sourceRuntime',
  custom: 'settings.sourceCustom',
} as const satisfies Record<string, SkillKey>

/** Render the Skill catalog and chat-picker visibility controls. */
export function SkillSettingsSection({
  currentSession, visibility, list, loadDirectory, openDirectory, useSkillsDirectory, t,
}: SkillSettingsProps): ReactNode {
  const sessionId = useSyncExternalStore(currentSession.subscribe, currentSession.getSnapshot)
  useSyncExternalStore(visibility.subscribe, visibility.getSnapshot)
  const directory = useSkillsDirectory(snapshot => snapshot)
  const [query, setQuery] = useState('')
  const [request, setRequest] = useState(0)
  const [state, setState] = useState<ViewState>({ status: 'idle' })

  useEffect(() => {
    if (sessionId === undefined) {
      setState({ status: 'idle' })
      return
    }
    let current = true
    setState({ status: 'loading' })
    void list(sessionId, request > 0).then(
      (skills) => { if (current) setState({ status: 'ready', skills }) },
      () => { if (current) setState({ status: 'error' }) },
    )
    return () => { current = false }
  }, [list, request, sessionId])

  useEffect(() => {
    if (sessionId === undefined) return
    loadDirectory(sessionId)
  }, [loadDirectory, sessionId])

  const normalized = query.trim().toLocaleLowerCase()
  const filtered = useMemo(() => state.status === 'ready'
    ? state.skills.filter(skill => [skill.name, skill.description, skill.provider]
      .some(value => value.toLocaleLowerCase().includes(normalized)))
    : [], [normalized, state])

  const refresh = (): void => { setRequest(value => value + 1) }

  return (
    <section className={css.section} aria-busy={state.status === 'loading'}>
      <div className={css.heading}>
        <div>
          <h2>{t('settings.title')}</h2>
          <p>{t('settings.intro')}</p>
        </div>
        <button type="button" className={css.refresh} onClick={refresh} disabled={sessionId === undefined || state.status === 'loading'}>
          <IconRefreshOutline16 size={16} />
          <span>{state.status === 'loading' ? t('settings.refreshing') : t('settings.refresh')}</span>
        </button>
      </div>
      {/* Installing a skill is dropping a file into the user skills
        directory; the action opens it on the desktop, or reveals its path
        where the host has no native opener (the preset-roster pattern). */}
      <div className={css.install}>
        <p className={css.installText}>{t('settings.installIntro')}</p>
        {directory.status === 'ready' && directory.canOpenPath ? (
          <button
            type="button"
            className={css.openDirectory}
            disabled={directory.opening}
            onClick={() => { openDirectory() }}
          >
            <IconFolderOpenOutline16 size={16} />
            <span>{directory.opening ? t('settings.opening') : t('settings.openDirectory')}</span>
          </button>
        ) : null}
        {directory.status === 'ready' && !directory.canOpenPath && directory.path !== null ? (
          <p className={css.revealedPath}>
            <span className={css.revealedPathLabel}>{t('settings.directoryLabel')}</span>
            <code>{directory.path}</code>
          </p>
        ) : null}
        {directory.error !== null ? <span className={css.directoryError} role="alert">{t('settings.openError')}</span> : null}
      </div>
      {sessionId === undefined ? <p className={css.status}>{t('settings.noSession')}</p> : null}
      {state.status === 'error' ? (
        <div className={css.failure} role="alert">
          <span>{t('settings.error')}</span>
          <button type="button" onClick={refresh}>{t('settings.retry')}</button>
        </div>
      ) : null}
      {state.status === 'ready' ? (
        <>
          <label className={css.search}>
            <IconSearchOutline16 size={16} aria-hidden="true" />
            <input
              type="search"
              value={query}
              placeholder={t('settings.search')}
              aria-label={t('settings.search')}
              onChange={(event) => { setQuery(event.currentTarget.value) }}
            />
          </label>
          <div className={css.count}>{t('settings.count').replace('{count}', String(filtered.length))}</div>
          {filtered.length === 0 ? <p className={css.status}>{t(normalized === '' ? 'settings.empty' : 'settings.emptySearch')}</p> : null}
          <ul className={css.list}>
            {filtered.map((skill) => {
              const sourceKey = (SOURCE_KEYS as Partial<Record<string, SkillKey>>)[skill.source]
              const source = sourceKey === undefined ? skill.source : t(sourceKey)
              return (
                <li className={css.row} key={skill.name}>
                  <div className={css.details}>
                    <div className={css.nameLine}>
                      <strong>{skill.name}</strong>
                      <span>{source}</span>
                      {!skill.modelInvocable ? <span>{t('settings.userOnly')}</span> : null}
                    </div>
                    <p>{skill.description}</p>
                    <code>{skill.provider}</code>
                  </div>
                  <label className={css.toggle}>
                    <input
                      type="checkbox"
                      checked={visibility.isVisible(skill.name)}
                      onChange={(event) => { visibility.setVisible(skill.name, event.currentTarget.checked) }}
                    />
                    <span>{t('settings.showInChat')}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </>
      ) : null}
    </section>
  )
}
