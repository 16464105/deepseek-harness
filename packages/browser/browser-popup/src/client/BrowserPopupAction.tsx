/**
 * The session-header toggle for the browser preview overlay. One button in
 * `conversation.session.header.actions`; clicking it toggles the overlay's
 * visibility through the module-level popup store. The button stays mounted
 * so the overlay can be re-opened after being closed.
 * @module @deepseek-ai/dsh-browser-popup/client/BrowserPopupAction
 */

import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'

/** Full props for the session-header action. */
export type BrowserPopupActionProps = PropsRuntime<'conversation.session.header.actions'>

/** Module-level overlay visibility: shared by the header action and the overlay occupant. */
export interface PopupStore {
  visible: boolean
  listeners: Set<() => void>
}

/** The single shared popup store. */
export const popupStore: PopupStore = { visible: false, listeners: new Set() }

/** Read the current visibility. */
export function isPopupVisible(): boolean {
  return popupStore.visible
}

/** Set visibility and notify subscribers. */
export function setPopupVisible(visible: boolean): void {
  if (popupStore.visible === visible) return
  popupStore.visible = visible
  for (const listener of popupStore.listeners) listener()
}

/** Subscribe to visibility changes; returns an unsubscribe function. */
export function subscribePopup(subscriber: () => void): () => void {
  popupStore.listeners.add(subscriber)
  return () => { popupStore.listeners.delete(subscriber) }
}

/**
 * Render the session-header toggle button for the browser preview.
 * @returns the button element.
 */
export function BrowserPopupAction(_props: BrowserPopupActionProps): ReactElement {
  const [visible, setVisible] = useState(isPopupVisible())

  useEffect(() => subscribePopup(() => { setVisible(isPopupVisible()) }), [])

  return (
    <button
      type="button"
      onClick={() => { setPopupVisible(!visible) }}
      title="浏览器画面"
      style={{
        background: 'transparent', border: 'none', color: '#c8c8d8', cursor: 'pointer',
        fontSize: '13px', lineHeight: '1', padding: '4px 6px', borderRadius: '6px', flexShrink: 0,
      }}
    >
      {visible ? '🖥️ 浏览器画面 ✓' : '🖥️ 浏览器画面'}
    </button>
  )
}
