/**
 * `@deepseek-ai/dsh-browser-popup` Client half: registers the browser preview
 * overlay in the `shell.overlay` slot. The overlay polls the Host
 * `browserPopup` Remote service every 1.5s while expanded.
 * @module @deepseek-ai/dsh-browser-popup/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-browser-popup/remote'
// Type-only: pulls the ui-layout SlotMap merge that declares `shell.overlay`.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { BrowserPopup } from './BrowserPopup.tsx'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'browser-popup-client'

/** Services required before the overlay can register. */
export const inject = ['slots', 'remote', 'remote.browserPopup']

/** The overlay slot occupant id within `shell.overlay`. */
export const POPUP_ID = 'browser-popup'

export { BrowserPopup } from './BrowserPopup.tsx'

/**
 * Register the browser preview overlay in `shell.overlay`.
 * @param ctx - the context whose `slots` and `remote` services are consumed.
 */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register(
      { name: 'shell.overlay', id: POPUP_ID, order: 100, label: '浏览器画面' },
      () => BrowserPopup(ctx),
    ),
  )
}
