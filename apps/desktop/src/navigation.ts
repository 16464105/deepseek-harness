/** Navigation policy for the Electron desktop window. */

/**
 * Whether an in-window navigation stays on the embedded Harness origin.
 * @param target - requested navigation URL.
 * @param applicationOrigin - loopback origin loaded by the desktop window.
 * @returns whether Electron may navigate the existing window.
 */
export function isApplicationNavigation(target: string, applicationOrigin: string): boolean {
  try {
    return new URL(target).origin === applicationOrigin
  } catch {
    return false
  }
}

/**
 * Whether a denied window-open target may be handed to the system browser.
 * @param target - requested external URL.
 * @returns whether it uses an ordinary public web protocol.
 */
export function isExternalWebUrl(target: string): boolean {
  try {
    const protocol = new URL(target).protocol
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}
