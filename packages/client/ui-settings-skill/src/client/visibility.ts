/** Client-local selection of skills shown in the chat command picker. */

const STORAGE_KEY = 'dsh.skill-picker.hidden.v1'

function readHidden(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set()
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown
    if (!Array.isArray(value)) return new Set()
    return new Set(value.filter((entry): entry is string => typeof entry === 'string'))
  } catch {
    return new Set()
  }
}

/** Observable persisted selection shared by the picker and Settings page. */
export class SkillVisibility {
  private hidden = readHidden()
  private snapshot = [...this.hidden].sort()
  private readonly listeners = new Set<() => void>()

  /** Stable hidden-name snapshot for React external-store consumers. */
  getSnapshot = (): readonly string[] => this.snapshot

  /** Subscribe to selection changes. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /**
   * Return whether a skill is shown in the chat picker.
   * @param name - Skill name.
   * @returns Whether the skill is visible.
   */
  isVisible(name: string): boolean {
    return !this.hidden.has(name)
  }

  /**
   * Set a skill's chat-picker visibility and persist the browser-local choice.
   * @param name - Skill name.
   * @param visible - Whether the skill should appear in the picker.
   */
  setVisible(name: string, visible: boolean): void {
    const changed = visible ? this.hidden.delete(name) : !this.hidden.has(name)
    if (!visible && changed) this.hidden.add(name)
    if (!changed) return
    this.snapshot = [...this.hidden].sort()
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.snapshot)) } catch { /* storage is optional */ }
    for (const listener of [...this.listeners]) listener()
  }
}
