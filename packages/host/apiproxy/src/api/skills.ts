/**
 * skills domain contract: read-only skill catalog lookup addressed by session.
 * The session's header cwd resolves to the canonical project root host-side —
 * the client never submits a raw path, and skill lookup never creates or
 * resumes an Agent.
 */

import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { RpcRequest, RpcResponse } from './rpc.ts'

/**
 * The user skills directory the client may offer to open.
 *
 * `openDirectory` is the absolute Host path of `<dshHome>/skills` — the
 * directory a person drops a skill file into to install it. The client never
 * submits a path; the Host resolves it, and the client only opens it through
 * `host.openPath`. `canOpenPath` reports whether this deployment can hand a
 * path to a native desktop opener (macOS/Windows always can; headless Linux
 * cannot), so the surface can offer the button or reveal the path as text
 * instead.
 */
export interface SkillDirectoryInfo {
  /** Absolute host path of the user skills directory. */
  readonly openDirectory: string
  /** Whether the host can open a directory on a native desktop. */
  readonly canOpenPath: boolean
}

/** Skill catalog row (wire projection of the host SkillSummary; provider/source vocabulary stays host-side). */
export interface SkillEntry {
  /** Kebab-case identifier the user references as `/name` in the composer. */
  readonly name: string
  /** Short routing description. */
  readonly description: string
  /** Optional extra routing guidance. */
  readonly whenToUse?: string
  /** False marks a user-only skill (`disable-model-invocation`): invocable here, absent from the model catalog. */
  readonly modelInvocable: boolean
  /** Discovery source of the winning skill, such as project, user, or bundled. */
  readonly source: string
  /** Provider that owns the winning skill body. */
  readonly provider: string
}

/**
 * Skill-domain unary methods (the map key skill.* of RpcMethodMap). Listing
 * is the domain's only RPC: invocation itself is a plain `session.prompt`
 * whose leading `/name` token the host recognizes at the pre-step boundary
 * (`dsh-tool-skill` injects the rendered body there), so every client shares
 * one deterministic path with no dedicated invocation wire.
 */
export interface SkillsApi {
  /**
   * Lists the user-invocable skill catalog for the session's project, plus
   * the user skills directory a person installs skills into (`<dshHome>/skills`).
   */
  list(
    request: RpcRequest<{ sessionId: SessionId; refresh?: boolean }>,
  ): Promise<RpcResponse<{ skills: readonly SkillEntry[] } & SkillDirectoryInfo>>
}
