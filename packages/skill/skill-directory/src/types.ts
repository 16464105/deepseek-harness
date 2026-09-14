/** Wire types for the user skills directory Remote surface. */

/** Host facts about the user skills directory a client reveals or opens. */
export interface SkillDirectoryInfo {
  /** Absolute user skills directory on the Host, created on first read. */
  readonly openDirectory: string
  /** Whether the Host can open that directory with its native opener. */
  readonly canOpenPath: boolean
}
