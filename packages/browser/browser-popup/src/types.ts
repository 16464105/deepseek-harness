/**
 * JSON vocabulary of the browser-popup Remote surface. These types cross the
 * Host/Client wire through the typert Remote channel, so they must be plain
 * JSON values and exported from a public type subpath (this module).
 * @module @deepseek-ai/dsh-browser-popup/types
 */

/** One screenshot answer for the overlay. */
export interface BrowserShotResult {
  ok: boolean
  png?: string
  ts?: number
  byteLen?: number
  b64Len?: number
  via?: string
  error?: string
}

/** One page-info answer for the overlay. */
export interface BrowserPageInfoResult {
  ok: boolean
  url?: string
  title?: string
  error?: string
}

/** One navigation answer for the overlay. */
export interface BrowserNavigateResult {
  ok: boolean
  error?: string
}
