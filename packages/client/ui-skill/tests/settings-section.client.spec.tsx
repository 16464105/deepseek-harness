// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionId, SkillEntry } from '@deepseek-ai/dsh-api-remotes/client'
import { SkillSettingsSection } from '../src/client/SkillSettingsSection.tsx'
import { zh, type SkillKey } from '../src/client/locales.ts'
import { SkillVisibility } from '../src/client/visibility.ts'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'

const SESSION_ID = 'skill-settings-session' as SessionId
const unusedHook = (() => { throw new Error('unused by Skill settings') }) as never
const kit = { useSessions: unusedHook, useWorkspaces: unusedHook }
const SKILLS: SkillEntry[] = [
  {
    name: 'project-review',
    description: 'Review the current project',
    modelInvocable: true,
    source: 'project-dsh',
    provider: 'filesystem',
  },
  {
    name: 'release-notes',
    description: 'Prepare release notes',
    modelInvocable: false,
    source: 'bundled',
    provider: 'filesystem',
  },
]

/** A directory source bound like the slot renderer's useSkillsDirectory. */
type DirectoryState = {
  status: 'idle' | 'loading' | 'ready' | 'unavailable'
  opening: boolean
  canOpenPath: boolean
  path: string | null
  error: string | null
}

function directorySource(state: DirectoryState) {
  const store = createSnapshotStore(state)
  const useSkillsDirectory: SnapshotSelectorHook<DirectoryState> = select => select(store.getSnapshot())
  return { store, useSkillsDirectory }
}

function t(key: SkillKey): string {
  return zh[key]
}

function sessionSource(sessionId: SessionId | undefined) {
  return {
    getSnapshot: () => sessionId,
    subscribe: () => () => {},
  }
}

function renderSection(overrides: {
  list?: (sessionId: SessionId, refresh: boolean) => Promise<readonly SkillEntry[]>
  visibility?: SkillVisibility
  directory?: ReturnType<typeof directorySource>
  loadDirectory?: (sessionId: SessionId) => void
  openDirectory?: () => void
}) {
  const list = overrides.list ?? vi.fn(() => Promise.resolve(SKILLS))
  const loadDirectory = overrides.loadDirectory ?? vi.fn()
  const openDirectory = overrides.openDirectory ?? vi.fn()
  const dir = overrides.directory ?? directorySource({ status: 'idle', opening: false, canOpenPath: false, path: null, error: null })
  const visibility = overrides.visibility ?? new SkillVisibility()
  render(<SkillSettingsSection
    {...kit}
    close={() => {}}
    currentSession={sessionSource(SESSION_ID)}
    visibility={visibility}
    list={list}
    loadDirectory={loadDirectory}
    openDirectory={openDirectory}
    useSkillsDirectory={dir.useSkillsDirectory}
    t={t as never}
  />)
  return { list, loadDirectory, openDirectory }
}

describe('SkillSettingsSection', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(cleanup)

  it('lists workspace skills and persists chat-picker visibility', async () => {
    const { list } = renderSection({})
    expect(await screen.findByText('project-review')).toBeTruthy()
    expect(screen.getByText('release-notes')).toBeTruthy()
    const toggles = screen.getAllByRole('checkbox')
    fireEvent.click(toggles[0]!)
    expect(new SkillVisibility().isVisible('project-review')).toBe(false)
    expect(list).toHaveBeenCalled()
  })

  it('requests a fresh host catalog from the refresh button', async () => {
    const list = vi.fn(() => Promise.resolve(SKILLS))
    renderSection({ list })
    await screen.findByText('project-review')
    fireEvent.click(screen.getByRole('button', { name: '刷新目录' }))
    await waitFor(() => { expect(list).toHaveBeenLastCalledWith(SESSION_ID, true) })
  })

  it('waits for a current session before listing', () => {
    const list = vi.fn(() => Promise.resolve(SKILLS))
    render(<SkillSettingsSection
      {...kit}
      close={() => {}}
      currentSession={sessionSource(undefined)}
      visibility={new SkillVisibility()}
      list={list}
      loadDirectory={vi.fn()}
      openDirectory={vi.fn()}
      useSkillsDirectory={(() => { const src = directorySource({ status: 'idle', opening: false, canOpenPath: false, path: null, error: null }); return src.useSkillsDirectory })()}
      t={t as never}
    />)
    expect(screen.getByText('打开一个会话后即可读取该工作区的 Skill。')).toBeTruthy()
    expect(list).not.toHaveBeenCalled()
  })

  it('explains installation and opens the user skills directory from the button', async () => {
    const openDirectory = vi.fn()
    const dir = directorySource({
      status: 'ready', opening: false, canOpenPath: true, path: '/dsh/skills', error: null,
    })
    renderSection({ directory: dir, openDirectory })
    expect(await screen.findByText('project-review')).toBeTruthy()
    // The install hint and the open action are on the page.
    expect(screen.getByText(/Skill 就是一个 Markdown 文件/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '打开 Skill 目录' }))
    expect(openDirectory).toHaveBeenCalled()
  })

  it('reveals the directory path as text when the host has no desktop opener', async () => {
    const dir = directorySource({
      status: 'ready', opening: false, canOpenPath: false, path: '/dsh/skills', error: null,
    })
    renderSection({ directory: dir })
    expect(await screen.findByText('project-review')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '打开 Skill 目录' })).toBeNull()
    expect(screen.getByText('/dsh/skills')).toBeTruthy()
  })
})
