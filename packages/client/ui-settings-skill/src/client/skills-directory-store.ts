/** State owner for the "open skills directory" action on the Skills settings page. */

import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { TypertClientRemote } from '@deepseek-ai/dsh-typert-protocol'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'

/** Browser state of the Host-owned user skills directory. */
export interface SkillsDirectoryState {
  /** Metadata-loading phase; unavailable means the host answered no directory or the read failed. */
  status: 'idle' | 'loading' | 'ready' | 'unavailable'
  /** Whether one native-open request is in flight. */
  opening: boolean
  /** Whether the host can open the directory on a native desktop. */
  canOpenPath: boolean
  /** The absolute directory path, revealed as text when the host cannot open it. */
  path: string | null
  /** Last native-open diagnostic; the UI exposes only localized copy. */
  error: string | null
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Loads the user skills directory and invokes the pathless Host-owned open operation. */
export class SkillsDirectoryStore {
  /** uSES-safe state source shared by the registered section action. */
  readonly store: SnapshotStore<SkillsDirectoryState> = createSnapshotStore({
    status: 'idle', opening: false, canOpenPath: false, path: null, error: null,
  })

  private generation = 0

  /**
   * @param skills - the skills wire face that reports and opens the directory.
   */
  constructor(private readonly skills: Pick<TypertClientRemote['skills'], 'list' | 'openDirectory'>) {}

  /**
   * Read the current directory facts from the host. Requires a session so the
   * skills domain can resolve its project scope, matching the catalog read.
   * @param sessionId - the session the page is viewing.
   * @returns after the latest metadata response updates the store.
   */
  async load(sessionId: SessionId): Promise<void> {
    const generation = ++this.generation
    this.store.update((state) => {
      state.status = 'loading'
      state.error = null
    })
    try {
      const result = await this.skills.list({ sessionId })
      if (generation !== this.generation) return
      if (!result.ok) {
        this.store.update((state) => {
          state.status = 'unavailable'
          state.error = result.error.message
        })
        return
      }
      this.store.update((state) => {
        state.status = 'ready'
        state.canOpenPath = result.value.canOpenPath
        state.path = result.value.openDirectory
        state.error = null
      })
    } catch (error) {
      if (generation !== this.generation) return
      this.store.update((state) => {
        state.status = 'unavailable'
        state.error = messageOf(error)
      })
    }
  }

  /**
   * Open the directory once; concurrent gestures collapse behind the in-flight action.
   * @returns after the native-open request settles, or immediately when unavailable/opening.
   */
  async open(): Promise<void> {
    const current = this.store.getSnapshot()
    if (current.status !== 'ready' || current.opening || !current.canOpenPath) return
    this.store.update((state) => {
      state.opening = true
      state.error = null
    })
    try {
      const result = await this.skills.openDirectory()
      if (!result.ok) throw new Error(result.error.message)
    } catch (error) {
      this.store.update((state) => { state.error = messageOf(error) })
    } finally {
      this.store.update((state) => { state.opening = false })
    }
  }
}
