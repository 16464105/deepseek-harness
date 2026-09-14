/**
 * `@deepseek-ai/dsh-skill-directory` Host half: a {@link SkillDirectoryService}
 * Remote surface that reports the user skills directory and opens it with the
 * host's native opener. The directory is the same single harness-home root the
 * root `dsh-skill-filesystem` provider scans as `user-dsh`, so the surface
 * opens exactly where discovered user skills come from.
 * @module @deepseek-ai/dsh-skill-directory
 */

import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { canOpenNativePath, openNativePath } from '@deepseek-ai/dsh-native-command'
import { TypertRemoteService, Remote, RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import type { SkillDirectoryInfo } from './types.ts'

export type { SkillDirectoryInfo } from './types.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'skill-directory'

/** The user skills directory: one harness-home root, created on demand. */
export function skillsDirectory(): string {
  return join(resolveDshHome(), 'skills')
}

/**
 * The user skills directory Remote service (`ctx.skillDirectory`). Client-side
 * `remote.skillDirectory` proxies these methods through the typert channel.
 */
export class SkillDirectoryService extends TypertRemoteService {
  constructor(ctx: Context) {
    super(ctx, 'skillDirectory')
  }

  /**
   * Report the user skills directory and whether this host can open it.
   * @returns the absolute path and native-opener availability.
   */
  @Remote('info')
  async info(): Promise<SkillDirectoryInfo> {
    const path = skillsDirectory()
    // Created here rather than left absent: a home whose person never
    // installed a user skill has no directory yet, and the macOS opener fails
    // on a missing target, so the reveal action would otherwise always error.
    await mkdir(path, { recursive: true })
    return { openDirectory: path, canOpenPath: canOpenNativePath() }
  }

  /**
   * Open the user skills directory with the host's native opener.
   * @param signal - caller lifetime carried by the Remote transport.
   * @returns whether the opener accepted the path; the client reveals the
   * directory as text when it did not.
   * @throws RemoteError when the opener reports a failure.
   */
  @Remote('open')
  async open(signal: AbortSignal): Promise<{ opened: boolean; path: string }> {
    const path = skillsDirectory()
    await mkdir(path, { recursive: true })
    if (!canOpenNativePath()) return { opened: false, path }
    signal.throwIfAborted()
    try {
      await openNativePath(path, signal)
      return { opened: true, path }
    } catch (error: unknown) {
      throw new RemoteError('gateway/internal', `opening the skills directory failed: ${String(error)}`, {})
    }
  }
}

/** Register the skills-directory Remote surface. */
export function apply(ctx: Context): void {
  ctx.plugin(SkillDirectoryService)
}
