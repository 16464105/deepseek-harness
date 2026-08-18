/**
 * The Playwright-backed browser session behind the browser tools. One service
 * instance owns one Chromium browser (lazy first launch), one persistent page,
 * and the last accessibility snapshot the model acted on, so element references
 * remain meaningful across tool calls.
 * @module @deepseek-ai/dsh-browser/controller
 */

import { Context, Service } from '@deepseek-ai/cordis'
import type { Browser, BrowserContext, Page } from 'playwright'
import { BrowserError } from './types.ts'

/** Engine/host knobs the browser tools accept. All have shipped defaults. */
export interface BrowserControllerConfig {
  /**
   * Browser engine to launch. `chromium` drives the Playwright Chromium the
   * `playwright` package ships; `chrome` drives a Chrome/Chromium installation
   * on the host (Chrome on macOS, channel `chrome` elsewhere). Playwright
   * downloads the matching browser on first use when no browser binary exists.
   * Defaults to `chromium`.
   */
  engine?: 'chromium' | 'chrome'
  /** Launch in headless mode (no visible window). Defaults to true. */
  headless?: boolean
}

/** One finalized snapshot answer for the model. */
export interface BrowserSnapshot {
  /** The aria snapshot YAML for the current page. */
  snapshot: string
  /** The current page URL at snapshot time. */
  url: string
  /** The current page title at snapshot time. */
  title: string
}

/** Resolve the current page or throw the typed NO_PAGE failure. */
/* v8 ignore next 4 -- the page-undefined guard is defensive: every operation resolves a page first. */
function requirePage(page: Page | undefined): Page {
  if (page === undefined) {
    throw new BrowserError('no page is open — call browser_navigate first', 'NO_PAGE')
  }
  return page
}

/**
 * Translate a Playwright thrown value into a {@link BrowserError}. A page close
 * or crash becomes NO_PAGE; a selector mismatch becomes STALE_REF; everything
 * else becomes BROWSER_FAILURE.
 * @param error - the thrown value from a Playwright operation.
 * @returns the typed error, always a {@link BrowserError}.
 */
function translatePlaywrightError(error: unknown): BrowserError {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('page') && (message.includes('closed') || message.includes('crashed') || message.includes('disposed'))) {
    return new BrowserError(`the browser page is no longer available: ${message}`, 'NO_PAGE', { cause: error })
  }
  if (message.includes('locator') && (message.includes('strict mode') || message.includes('not resolved'))) {
    return new BrowserError(`the element reference is stale or ambiguous; re-run browser_snapshot and use a current [ref]: ${message}`, 'STALE_REF', { cause: error })
  }
  return new BrowserError(`browser operation failed: ${message}`, 'BROWSER_FAILURE', { cause: error })
}

/**
 * A disposable Playwright wrapper. Tests inject a fake whose `run` executes
 * `body(page)`; the service resolves pages only through that factory so the
 * engine stays swappable without exposing a seam.
 */
export interface BrowserLike {
  /** Open the persistent page, run the body against it, and return its value. */
  run<T>(body: (page: Page) => Promise<T>): Promise<T>
  /** Close browser, context, and page (idempotent). */
  close(): Promise<void>
}

/**
 * Translate a browser-launch thrown value into a {@link BrowserError}, with the
 * engine-specific actionable fallback for `chrome`.
 * @param engine - the configured engine.
 * @param error - the thrown value from `chromium.launch`.
 * @returns the typed NO_BROWSER error.
 */
export function translateLaunchError(engine: 'chromium' | 'chrome', error: unknown): BrowserError {
  const message = error instanceof Error ? error.message : String(error)
  if (engine === 'chrome') {
    return new BrowserError(`no Chrome installation is available (channel "chrome"): ${message} — switch browser.engine to "chromium" to use the bundled Chromium`, 'NO_BROWSER', { cause: error })
  }
  return new BrowserError(`cannot launch the Playwright browser: ${message}`, 'NO_BROWSER', { cause: error })
}

/**
 * The Playwright engine used at runtime. Split from {@link BrowserController}
 * so the controller holds no launch logic the launcher factory cannot replace.
 */
export class PlaywrightBrowser implements BrowserLike {
  private browser: Browser | undefined
  private context: BrowserContext | undefined
  private page: Page | undefined

  constructor(
    private readonly engine: 'chromium' | 'chrome',
    private readonly headless: boolean,
  ) {}

  async run<T>(body: (page: Page) => Promise<T>): Promise<T> {
    return body(await this.requirePage())
  }

  private async requirePage(): Promise<Page> {
    if (this.page !== undefined && !this.page.isClosed()) return this.page
    const { chromium } = await import('playwright')
    try {
      // engine 'chrome' launches the host Chrome installation (launch channel);
      // 'chromium' launches the Playwright-managed Chromium build.
      this.browser = this.engine === 'chrome'
        ? await chromium.launch({ headless: this.headless, channel: 'chrome' })
        : await chromium.launch({ headless: this.headless })
      this.context = await this.browser.newContext()
      this.page = await this.context.newPage()
    } catch (error: unknown) {
      throw translateLaunchError(this.engine, error)
    }
    return this.page
  }

  /** Close browser, context, and page; used on service disposal and snapshot teardown. */
  async close(): Promise<void> {
    await Promise.allSettled([
      this.page !== undefined && !this.page.isClosed() ? this.page.close() : Promise.resolve(),
      this.context !== undefined ? this.context.close() : Promise.resolve(),
    ])
    if (this.browser !== undefined) await this.browser.close().catch(() => {})
    this.page = undefined
    this.context = undefined
    this.browser = undefined
  }
}

/**
 * The live browser session the tools drive. The browser and page are created on
 * first use; disposal closes them so a plugin reload leaves no orphan process.
 * All operations except {@link snapshot} re-validate the page and translate
 * Playwright failures into {@link BrowserError}.
 */
export class BrowserController extends Service {
  /** The Playwright engine wrapper every operation runs through. */
  private readonly browser: BrowserLike
  /** The last aria snapshot the model acted on, captured with `[ref=...]` markers. */
  private lastSnapshot: string | undefined

  constructor(
    ctx: Context,
    browser: BrowserLike,
  ) {
    super(ctx, 'browser')
    this.browser = browser
    ctx.effect(() => async () => {
      await this.browser.close()
      this.lastSnapshot = undefined
    }, 'browser.close()')
  }

  /**
   * Navigate the persistent page to an http(s) URL.
   * @param url - the absolute http(s) target URL, already validated.
   * @returns completion after the page load settles.
   */
  async navigate(url: string): Promise<void> {
    try {
      await this.browser.run(async (page) => {
        await page.goto(url, { waitUntil: 'load' })
      })
    } catch (error: unknown) {
      if (error instanceof BrowserError) throw error
      throw translatePlaywrightError(error)
    }
  }

  /**
   * Click the element the model references (`aria-ref=<ref>` from the last snapshot).
   * @param ref - the aria snapshot ref from the last `browser_snapshot`.
   * @returns completion after the click settles.
   */
  async click(ref: string): Promise<void> {
    try {
      await this.browser.run(async (page) => {
        await requirePage(page).locator(`aria-ref=${ref}`).click()
      })
    } catch (error: unknown) {
      if (error instanceof BrowserError) throw error
      throw translatePlaywrightError(error)
    }
  }

  /**
   * Type `text` into the referenced element.
   * @param ref - the aria snapshot ref from the last `browser_snapshot`.
   * @param text - the content that replaces the field's current value.
   * @returns completion after the fill settles.
   */
  async type(ref: string, text: string): Promise<void> {
    try {
      await this.browser.run(async (page) => {
        await requirePage(page).locator(`aria-ref=${ref}`).fill(text)
      })
    } catch (error: unknown) {
      if (error instanceof BrowserError) throw error
      throw translatePlaywrightError(error)
    }
  }

  /**
   * Press one key, optionally with modifier keys, on the current page.
   * @param key - the key to press (`Enter`, `Escape`, a character, ...).
   * @param modifiers - modifier keys held while pressing, in press order.
   * @returns completion after the press and modifier release settle.
   */
  async pressKey(key: string, modifiers: readonly string[]): Promise<void> {
    try {
      await this.browser.run(async (page) => {
        for (const modifier of modifiers) {
          await page.keyboard.down(modifier)
        }
        try {
          await page.keyboard.press(key)
        } finally {
          for (const modifier of [...modifiers].reverse()) {
            await page.keyboard.up(modifier)
          }
        }
      })
    } catch (error: unknown) {
      if (error instanceof BrowserError) throw error
      throw translatePlaywrightError(error)
    }
  }

  /**
   * Capture a fresh aria snapshot with element refs for the model.
   * @returns the snapshot YAML, the current page URL, and the page title.
   */
  async snapshot(): Promise<BrowserSnapshot> {
    try {
      return await this.browser.run(async (page) => {
        const current = await requirePage(page).ariaSnapshot({ mode: 'ai' })
        this.lastSnapshot = current
        return {
          snapshot: current,
          url: page.url(),
          title: await page.title(),
        }
      })
    } catch (error: unknown) {
      if (error instanceof BrowserError) throw error
      throw translatePlaywrightError(error)
    }
  }

  /**
   * Return the last snapshot taken, or undefined before the first snapshot.
   * @returns the most recent snapshot text with `[ref]` markers, when any.
   */
  peekLastSnapshot(): string | undefined {
    return this.lastSnapshot
  }

  /**
   * Capture a PNG screenshot of the current page viewport.
   * @returns the encoded PNG bytes.
   */
  async screenshot(): Promise<Uint8Array> {
    try {
      return await this.browser.run(async (page) => {
        const bytes = await requirePage(page).screenshot({ type: 'png', fullPage: false })
        return new Uint8Array(bytes)
      })
    } catch (error: unknown) {
      if (error instanceof BrowserError) throw error
      throw translatePlaywrightError(error)
    }
  }
}

/** Default engine: Playwright's managed Chromium. */
export const DEFAULT_ENGINE = 'chromium'

/** Default headless mode: true (no visible window). */
export const DEFAULT_HEADLESS = true
