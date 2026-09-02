/**
 * `@deepseek-ai/dsh-browser-popup` Client half: a session-header toggle that
 * shows the browser preview overlay on demand. The overlay is not resident —
 * nothing renders until the header action is clicked, and the close button
 * hides it entirely.
 * @module @deepseek-ai/dsh-browser-popup/client
 */

import { createElement, useEffect, useState } from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-browser-popup/remote'
// Type-only: pulls the ui-layout SlotMap merge that declares `shell.overlay`
// and the ui-conversation merge that declares `conversation.session.header.actions`.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { BrowserPopup } from './BrowserPopup.tsx'
import { BrowserPopupAction, isPopupVisible, setPopupVisible, subscribePopup } from './BrowserPopupAction.tsx'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'browser-popup-client'

/** Services required before the controls can register. */
export const inject = ['slots', 'remote', 'remote.browserPopup']

/** The overlay slot occupant id within `shell.overlay`. */
export const POPUP_ID = 'browser-popup'

/** The session-header action id within `conversation.session.header.actions`. */
export const ACTION_ID = 'browser-popup'

export { BrowserPopup } from './BrowserPopup.tsx'
export { BrowserPopupAction } from './BrowserPopupAction.tsx'

/**
 * Register the session-header toggle and the conditional overlay occupant.
 * The overlay occupant subscribes to the shared popup store and renders
 * nothing while hidden.
 * @param ctx - the context whose `slots` and `remote` services are consumed.
 */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject(
    'conversation.session.header.actions',
    () => ctx.slots.register(
      { name: 'conversation.session.header.actions', id: ACTION_ID, order: 30, label: '浏览器画面' },
      BrowserPopupAction,
    ),
  )

  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register(
      { name: 'shell.overlay', id: POPUP_ID, order: 100, label: '浏览器画面' },
      () => {
        const [visible, setVisible] = useState(isPopupVisible())
        useEffect(() => subscribePopup(() => { setVisible(isPopupVisible()) }), [])
        if (!visible) return null
        return createElement(BrowserPopup, {
          ctx,
          onClose: () => { setPopupVisible(false) },
        })
      },
    ),
  )
}
