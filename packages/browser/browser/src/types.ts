/**
 * Vocabulary for the browser-operation tools. Only the model-facing value shapes
 * and the {@link BrowserError} taxonomy live here; the Playwright-backed session
 * controller is {@link ./controller.ts} and the tool schemas are {@link ./tools.ts}.
 * @module @deepseek-ai/dsh-browser/types
 */

import { HarnessError } from '@deepseek-ai/dsh-llm'

/**
 * Machine-routable browser-operation failures. `NO_BROWSER` covers an unlaunchable
 * engine (no browser binary, sandbox refusal, launcher error); `NO_PAGE` covers a
 * missing or crashed page; `STALE_REF` covers an `aria-ref` that is absent from
 * the last snapshot. Tool execution exposes these codes as structured error
 * metadata; the model-facing messages are pinned in {@link ./tools.ts}.
 */
export type BrowserErrorCode =
  | 'NO_BROWSER'
  | 'NO_PAGE'
  | 'STALE_REF'
  | 'BAD_TARGET'
  | 'BROWSER_FAILURE'

/**
 * Typed browser failure with a machine-routable, closed code. Tool execution
 * surfaces the code in structured error metadata so policy and callers can
 * distinguish "browser not installed" from "stale element reference".
 */
export class BrowserError extends HarnessError {
  constructor(message: string, code: BrowserErrorCode, options?: ErrorOptions) {
    super(message, code, options)
    this.name = 'BrowserError'
  }
}

/**
 * Validate one `browser_navigate` target URL.
 * @param url - the raw model-supplied URL.
 * @returns the accepted URL unchanged.
 * @throws {@link BrowserError} `BAD_TARGET` for non-http(s), credentialed, or unparseable URLs.
 */
export function validateTarget(url: string): string {
  if (url.trim().length === 0) throw new Error('url must be a non-empty string')
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch (error: unknown) {
    throw new BrowserError(`invalid URL "${url}": only absolute http(s) URLs are accepted`, 'BAD_TARGET', { cause: error })
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BrowserError(`unsupported URL scheme "${parsed.protocol}" — only http(s) URLs are accepted`, 'BAD_TARGET')
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new BrowserError('URLs with embedded credentials are rejected', 'BAD_TARGET')
  }
  return url
}
