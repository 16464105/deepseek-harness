/** Navigation policy for the Electron desktop window. */

/**
 * Build the window URL for this process's loopback Host.
 * The first navigation must carry Connection's process token so
 * `authorizeIndex` can mint the browser-session cookie; a bare origin
 * receives the same 401 as an unauthenticated `dsh web` tab.
 * @param port - the bound loopback port.
 * @param authenticatedUrl - Connection's process-token URL builder.
 * @returns root URL that `authorizeIndex` accepts for initial login.
 */
export function authenticatedApplicationUrl(
  port: number,
  authenticatedUrl: (baseUrl: string) => string,
): string {
  return authenticatedUrl(`http://127.0.0.1:${String(port)}`)
}

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
