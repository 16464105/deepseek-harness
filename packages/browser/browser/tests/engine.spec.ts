/**
 * Coverage completion for the Playwright engine wrapper: the launch path runs
 * against a mocked `playwright` module (the unit lane has no browser binary),
 * while the real Chromium path is covered by {@link ./chromium.e2e.ts}.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlaywrightBrowser } from '@deepseek-ai/dsh-browser'

/** The live page the mocked launcher hands out; tests replace it per case. */
let livePage: { isClosed: () => boolean; close: () => Promise<void> } | undefined
/** When set, `chromium.launch` rejects with this value instead of launching. */
let launchFailure: unknown
/** When set, `browser.close()` rejects with this value (the page/context close first). */
let browserCloseFailure: unknown

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(async () => {
      if (launchFailure !== undefined) throw launchFailure
      return {
        newContext: vi.fn(async () => ({
          newPage: vi.fn(async () => livePage),
          close: vi.fn(async () => undefined),
        })),
        close: vi.fn(async () => {
          if (browserCloseFailure !== undefined) throw browserCloseFailure
        }),
      }
    }),
  },
}))

function fakePage(closed = false): { isClosed: () => boolean; close: () => Promise<void> } {
  let pageClosed = closed
  return {
    isClosed: () => pageClosed,
    close: async () => { pageClosed = true },
  }
}

describe('PlaywrightBrowser launch path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    livePage = fakePage()
    launchFailure = undefined
    browserCloseFailure = undefined
  })

  it('launches chromium headless on first run and reuses the page', async () => {
    const engine = new PlaywrightBrowser('chromium', true)
    await expect(engine.run(async live => live.isClosed())).resolves.toBe(false)
    // Second run without a close hits the reuse branch.
    await expect(engine.run(async live => live.isClosed())).resolves.toBe(false)
    await engine.close()
  })

  it('launches the chrome channel for engine chrome', async () => {
    const engine = new PlaywrightBrowser('chrome', false)
    await expect(engine.run(async live => live.isClosed())).resolves.toBe(false)
    await engine.close()
  })

  it('relaunches after close instead of reusing a closed page', async () => {
    const engine = new PlaywrightBrowser('chromium', true)
    await engine.run(async () => undefined)
    await engine.close()
    livePage = fakePage()
    await expect(engine.run(async live => live.isClosed())).resolves.toBe(false)
    await engine.close()
  })

  it('close() tolerates a page whose close rejects', async () => {
    livePage = { isClosed: () => false, close: async () => { throw new Error('close refused') } }
    const engine = new PlaywrightBrowser('chromium', true)
    await engine.run(async () => undefined)
    await expect(engine.close()).resolves.toBeUndefined()
  })

  it('close() tolerates a browser whose close rejects', async () => {
    browserCloseFailure = new Error('browser close refused')
    const engine = new PlaywrightBrowser('chromium', true)
    await engine.run(async () => undefined)
    await expect(engine.close()).resolves.toBeUndefined()
  })

  it('close() before any launch settles the undefined page/context arms', async () => {
    const engine = new PlaywrightBrowser('chromium', true)
    await expect(engine.close()).resolves.toBeUndefined()
  })

  it('translates a launch rejection into NO_BROWSER for chromium', async () => {
    launchFailure = new Error('Executable does not exist')
    const engine = new PlaywrightBrowser('chromium', true)
    await expect(engine.run(async () => undefined)).rejects.toThrow(expect.objectContaining({ code: 'NO_BROWSER' }))
    await engine.close()
  })

  it('translates a launch rejection into NO_BROWSER for chrome', async () => {
    launchFailure = new Error('Executable does not exist')
    const engine = new PlaywrightBrowser('chrome', true)
    await expect(engine.run(async () => undefined)).rejects.toThrow(/switch browser.engine to "chromium"/)
    await engine.close()
  })

  it('translates a non-Error launch rejection', async () => {
    launchFailure = 'plain string failure'
    const engine = new PlaywrightBrowser('chromium', true)
    await expect(engine.run(async () => undefined)).rejects.toThrow(expect.objectContaining({ code: 'NO_BROWSER' }))
    await engine.close()
  })
})
