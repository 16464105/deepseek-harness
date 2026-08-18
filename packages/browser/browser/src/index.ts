/**
 * `@deepseek-ai/dsh-browser`: model-facing browser-operation tools over one
 * persistent local Chromium, driven through Playwright. The package is a
 * function/namespace plugin (no default export) that registers the tool suite
 * on `ctx.tools`; the Playwright session lives behind the private
 * {@link BrowserController} because it has no external consumer.
 * @module @deepseek-ai/dsh-browser
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-tools'
import { BrowserController, DEFAULT_ENGINE, DEFAULT_HEADLESS, PlaywrightBrowser } from './controller.ts'
import { applyBrowserTools, applyScreenshotTool } from './tools.ts'

export { BrowserError } from './types.ts'
export type { BrowserErrorCode } from './types.ts'
export { validateTarget } from './types.ts'
export { BrowserController, DEFAULT_ENGINE, DEFAULT_HEADLESS, PlaywrightBrowser, translateLaunchError } from './controller.ts'
export type { BrowserControllerConfig, BrowserLike, BrowserSnapshot } from './controller.ts'
export { BROWSER_GUIDANCE, BROWSER_TOOL_PREFIX, KEY_MODIFIERS, SNAPSHOT_MAX_CHARS, SNAPSHOT_FOOTER, applyBrowserTools, formatSnapshotOutput } from './tools.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'browser'

/** Services required before the browser tools can register. */
export const inject = ['tools', 'systemPrompt']

/** Plugin config: engine/host selection for the Playwright session. */
export interface Config {
  /** Browser engine to launch: `chromium` (default) or `chrome`. */
  engine?: 'chromium' | 'chrome'
  /** Launch in headless mode (no visible window). Defaults to true. */
  headless?: boolean
}

export const Config: z<Config> = z.object({
  engine: z.union(['chromium', 'chrome'] as const).default(DEFAULT_ENGINE),
  headless: z.boolean().default(DEFAULT_HEADLESS),
})

/**
 * Register the browser tool suite. The Playwright controller is created eagerly
 * with the resolved engine knobs and closed on dispose; the browser process
 * itself starts on first use. `browser_screenshot` registers only while a
 * durable attachment store is mounted (the image block it returns must
 * reference a committed attachment).
 * @param ctx - the context whose `tools` and `systemPrompt` registries receive
 *   the registrations.
 * @param config - the plugin config; schemastery fills every default.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = config as Required<Config>
  const controller = new BrowserController(ctx, new PlaywrightBrowser(resolved.engine, resolved.headless))
  applyBrowserTools(ctx, controller)
  // browser_screenshot is composition-conditional: without a mounted
  // attachment store the deployment cannot durably commit image bytes, so the
  // tool never registers; the execute body keeps a defensive re-check for
  // direct callers.
  ctx.inject(['attachments'], (imageCtx) => {
    applyScreenshotTool(imageCtx, controller)
  })
}
