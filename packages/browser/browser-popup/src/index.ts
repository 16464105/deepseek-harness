/**
 * `@deepseek-ai/dsh-browser-popup` Host half: a {@link BrowserPopupService}
 * Remote surface that feeds the live browser preview overlay. Exposes `shot`
 * (binary-safe base64 screenshot), `pageInfo` (url/title), and `navigate`
 * to the web client through the typert Remote channel. The browser service
 * itself stays private in `@deepseek-ai/dsh-browser`; this plugin consumes it.
 * @module @deepseek-ai/dsh-browser-popup
 */

import type { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import type { BrowserController } from '@deepseek-ai/dsh-browser'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import type { BrowserShotResult, BrowserPageInfoResult, BrowserNavigateResult } from './types.ts'

export type { BrowserShotResult, BrowserPageInfoResult, BrowserNavigateResult } from './types.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'browser-popup'

/** Services required before the Remote surface can register. */
export const inject = ['browser']

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/**
 * Encode raw bytes as base64 without routing them through a UTF-8 string.
 * The Host `btoa` builtin is UTF-8-only and corrupts bytes >= 0x80, so PNG
 * screenshots must use this byte-safe encoder.
 * @param bytes - the raw bytes to encode.
 * @returns the base64 string.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0
    const b1 = i + 1 < bytes.length ? (bytes[i + 1] ?? 0) : 0
    const b2 = i + 2 < bytes.length ? (bytes[i + 2] ?? 0) : 0
    out += BASE64_CHARS.charAt(b0 >> 2)
    out += BASE64_CHARS.charAt(((b0 & 0x03) << 4) | (b1 >> 4))
    out += i + 1 < bytes.length ? BASE64_CHARS.charAt(((b1 & 0x0f) << 2) | (b2 >> 6)) : '='
    out += i + 2 < bytes.length ? BASE64_CHARS.charAt(b2 & 0x3f) : '='
  }
  return out
}

/**
 * The live browser preview Remote service (`ctx.browserPopup`). Client-side
 * `remote.browserPopup` proxies these methods through the typert channel;
 * every method resolves the browser service lazily so the overlay degrades
 * to an error string while the browser is unavailable.
 */
export class BrowserPopupService extends TypertRemoteService {
  static inject = ['browser']

  constructor(ctx: Context) {
    super(ctx, 'browserPopup')
  }

  /**
   * Capture the current page as a binary-safe base64 PNG.
   * @returns the screenshot result, or `ok: false` when the browser is unavailable or capture fails.
   */
  @Remote('shot')
  async shot(): Promise<BrowserShotResult> {
    const browser = this.ctx.get('browser') as BrowserController | undefined
    if (!browser || typeof browser.screenshot !== 'function') {
      return { ok: false, error: 'browser service unavailable' }
    }
    try {
      const bytes = await browser.screenshot()
      const b64 = bytesToBase64(bytes)
      return {
        ok: true,
        png: b64,
        ts: Date.now(),
        byteLen: bytes.length,
        b64Len: Math.ceil(bytes.length / 3) * 4,
        via: 'direct',
      }
    } catch (error: unknown) {
      return { ok: false, error: 'direct: ' + (error instanceof Error ? error.message : String(error)) }
    }
  }

  /**
   * Read the current page URL and title.
   * @returns the page facts, or `ok: false` when the browser is unavailable.
   */
  @Remote('pageInfo')
  async pageInfo(): Promise<BrowserPageInfoResult> {
    const browser = this.ctx.get('browser') as BrowserController | undefined
    if (!browser || typeof browser.snapshot !== 'function') {
      return { ok: false, error: 'browser service unavailable' }
    }
    try {
      const snap = await browser.snapshot()
      return { ok: true, url: snap.url, title: snap.title }
    } catch (error: unknown) {
      return { ok: false, error: 'snapshot: ' + (error instanceof Error ? error.message : String(error)) }
    }
  }

  /**
   * Navigate the persistent page to an absolute http(s) URL.
   * @param args - payload carrying the target `url` string.
   * @returns the navigation result, or `ok: false` when the browser is unavailable.
   */
  @Remote('navigate')
  async navigate(args: JsonValue): Promise<BrowserNavigateResult> {
    const url = args && typeof args === 'object' && typeof (args as { url?: unknown }).url === 'string'
      ? (args as { url: string }).url
      : ''
    const browser = this.ctx.get('browser') as BrowserController | undefined
    if (!browser || typeof browser.navigate !== 'function') {
      return { ok: false, error: 'browser service unavailable' }
    }
    try {
      await browser.navigate(url)
      return { ok: true }
    } catch (error: unknown) {
      return { ok: false, error: 'navigate: ' + (error instanceof Error ? error.message : String(error)) }
    }
  }
}

export default BrowserPopupService
