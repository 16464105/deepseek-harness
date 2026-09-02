/**
 * Unit coverage for the browser controller's translation/validation and the
 * model-facing tool suite, driven by an in-memory fake {@link BrowserLike} —
 * no browser binary runs here. The real chromium path is covered by
 * {@link ./chromium.e2e.ts}.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Page } from 'playwright'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { BrowserController, BrowserError, translateLaunchError, validateTarget } from '@deepseek-ai/dsh-browser'
import type { BrowserLike } from '@deepseek-ai/dsh-browser'
import * as BrowserPlugin from '@deepseek-ai/dsh-browser'
import { applyBrowserTools, applyScreenshotTool, formatSnapshotOutput } from '../src/tools.ts'

/** Minimal page stand-in for controller tests; records calls for assertions. */
interface FakePageRecorder {
  gotoCalls: Array<[string, unknown]>
  locatorCalls: string[]
  keyboardDown: string[]
  keyboardUp: string[]
  keyboardPress: string[]
  closed: boolean
}

function fakePage(overrides: Partial<Record<'url' | 'title' | 'snapshot', string>> = {}): Page & { recorder: FakePageRecorder } {
  const recorder: FakePageRecorder = {
    gotoCalls: [],
    locatorCalls: [],
    keyboardDown: [],
    keyboardUp: [],
    keyboardPress: [],
    closed: false,
  }
  const page = {
    recorder,
    goto: async (url: string, options: unknown) => { recorder.gotoCalls.push([url, options]) },
    title: async () => overrides.title ?? '',
    url: () => overrides.url ?? 'about:blank',
    ariaSnapshot: async () => overrides.snapshot ?? '',
    locator: (selector: string) => {
      recorder.locatorCalls.push(selector)
      return {
        click: async () => undefined,
        fill: async () => undefined,
      }
    },
    keyboard: {
      down: async (key: string) => { recorder.keyboardDown.push(key) },
      up: async (key: string) => { recorder.keyboardUp.push(key) },
      press: async (key: string) => { recorder.keyboardPress.push(key) },
    },
    screenshot: async () => Buffer.from('png'),
    isClosed: () => recorder.closed,
    close: async () => { recorder.closed = true },
  } as unknown as Page & { recorder: FakePageRecorder }
  return page
}

function fakeBrowser(page: Page): BrowserLike & { closed: boolean } {
  return {
    closed: false,
    run: async body => body(page),
    close: async () => { },
  }
}

async function mountController(): Promise<{ ctx: Context; controller: BrowserController; page: ReturnType<typeof fakePage> }> {
  const ctx = new Context()
  const page = fakePage()
  const browser = fakeBrowser(page)
  const controller = new BrowserController(ctx, browser)
  return { ctx, controller, page }
}

const toolSignal = new AbortController().signal
let callCounter = 0
function callTool(ctx: Context, name: string, args: unknown) {
  return ctx.tools.execute({ signal: toolSignal, callId: ToolCallId(`call-${++callCounter}`), name, arguments: args })
}

describe('validateTarget', () => {
  it('accepts absolute http(s) URLs', () => {
    expect(validateTarget('https://example.com/')).toBe('https://example.com/')
    expect(validateTarget('http://127.0.0.1:8080/x')).toBe('http://127.0.0.1:8080/x')
  })

  it('rejects non-http(s) schemes with BAD_TARGET', () => {
    expect(() => validateTarget('ftp://example.com')).toThrow(expect.objectContaining({ code: 'BAD_TARGET' }))
    expect(() => validateTarget('file:///etc/passwd')).toThrow(expect.objectContaining({ code: 'BAD_TARGET' }))
  })

  it('rejects URLs with embedded credentials', () => {
    expect(() => validateTarget('https://user:pass@example.com/')).toThrow(expect.objectContaining({ code: 'BAD_TARGET' }))
  })

  it('rejects blank or unparseable targets', () => {
    expect(() => validateTarget('   ')).toThrow(/non-empty/)
    expect(() => validateTarget('not a url')).toThrow(expect.objectContaining({ code: 'BAD_TARGET' }))
  })
})

describe('BrowserController', () => {
  afterEach(() => { vi.clearAllMocks() })

  it('navigates the persistent page', async () => {
    const { controller, page } = await mountController()
    await controller.navigate('https://example.com/')
    expect(page.recorder.gotoCalls).toEqual([['https://example.com/', { waitUntil: 'load' }]])
  })

  it('clicks and types through aria-ref locators', async () => {
    const { controller, page } = await mountController()
    await controller.click('e3')
    expect(page.recorder.locatorCalls).toContain('aria-ref=e3')
    await controller.type('e4', 'hello')
    expect(page.recorder.locatorCalls).toContain('aria-ref=e4')
  })

  it('captures a snapshot and records it for ref validation', async () => {
    const ctx = new Context()
    const page = fakePage({ snapshot: '- button "Go" [ref=e3]', url: 'https://x.test/', title: 'X' })
    const subject = new BrowserController(ctx, fakeBrowser(page))
    const result = await subject.snapshot()
    expect(result.snapshot).toContain('[ref=e3]')
    expect(result.url).toBe('https://x.test/')
    expect(subject.peekLastSnapshot()).toContain('[ref=e3]')
  })

  it('translates a stale locator failure into STALE_REF', async () => {
    const failing: BrowserLike = {
      run: async () => {
        throw new Error('locator.strict mode violation: resolved to 2 elements')
      },
      close: async () => {},
    }
    const subject = new BrowserController(new Context(), failing)
    await expect(subject.click('e1')).rejects.toThrow(expect.objectContaining({ code: 'STALE_REF' }))
  })

  it('translates a not-resolved locator failure into STALE_REF', async () => {
    const failing: BrowserLike = {
      run: async () => {
        throw new Error('locator.click: element not resolved')
      },
      close: async () => {},
    }
    const subject = new BrowserController(new Context(), failing)
    await expect(subject.click('e1')).rejects.toThrow(expect.objectContaining({ code: 'STALE_REF' }))
  })

  it('translates a page-crash failure into NO_PAGE', async () => {
    const failing: BrowserLike = {
      run: async () => {
        throw new Error('page has been closed')
      },
      close: async () => {},
    }
    const subject = new BrowserController(new Context(), failing)
    await expect(subject.snapshot()).rejects.toThrow(expect.objectContaining({ code: 'NO_PAGE' }))
  })

  it('translates a crashed page into NO_PAGE', async () => {
    const failing: BrowserLike = {
      run: async () => {
        throw new Error('page crashed unexpectedly')
      },
      close: async () => {},
    }
    const subject = new BrowserController(new Context(), failing)
    await expect(subject.snapshot()).rejects.toThrow(expect.objectContaining({ code: 'NO_PAGE' }))
  })

  it('translates a disposed page into NO_PAGE', async () => {
    const failing: BrowserLike = {
      run: async () => {
        throw new Error('page has been disposed')
      },
      close: async () => {},
    }
    const subject = new BrowserController(new Context(), failing)
    await expect(subject.snapshot()).rejects.toThrow(expect.objectContaining({ code: 'NO_PAGE' }))
  })

  it('translates a non-Error thrown value into BROWSER_FAILURE', async () => {
    const failing: BrowserLike = {
      run: async () => {
        throw 'plain string failure'
      },
      close: async () => {},
    }
    const subject = new BrowserController(new Context(), failing)
    await expect(subject.snapshot()).rejects.toThrow(expect.objectContaining({ code: 'BROWSER_FAILURE' }))
  })

  it('presses a key with ordered modifier down/up around it', async () => {
    const { controller, page } = await mountController()
    await controller.pressKey('Enter', ['Shift', 'Control'])
    expect(page.recorder.keyboardDown).toEqual(['Shift', 'Control'])
    expect(page.recorder.keyboardPress).toEqual(['Enter'])
    expect(page.recorder.keyboardUp).toEqual(['Control', 'Shift'])
  })

  it('translates an engine launch failure into NO_BROWSER', () => {
    const failure = translateLaunchError('chromium', new Error('Executable does not exist'))
    expect(failure).toBeInstanceOf(Error)
    expect(failure.code).toBe('NO_BROWSER')
  })

  it('reports the chrome engine with its actionable fallback message', () => {
    const failure = translateLaunchError('chrome', new Error('Executable does not exist'))
    expect(failure.code).toBe('NO_BROWSER')
    expect(failure.message).toContain('switch browser.engine to "chromium"')
  })

  it('passes BrowserError through every operation unchanged', async () => {
    const typed = new BrowserError('no page is open', 'NO_PAGE')
    const failing: BrowserLike = {
      run: async () => { throw typed },
      close: async () => {},
    }
    const subject = new BrowserController(new Context(), failing)
    for (const operation of [
      () => subject.navigate('https://example.com/'),
      () => subject.click('e1'),
      () => subject.type('e1', 'x'),
      () => subject.pressKey('Enter', []),
      () => subject.snapshot(),
      () => subject.screenshot(),
    ]) {
      await expect(operation()).rejects.toBe(typed)
    }
  })

  it('translates a generic engine error into BROWSER_FAILURE for every operation', async () => {
    const failing: BrowserLike = {
      run: async () => { throw new Error('connection refused') },
      close: async () => {},
    }
    const subject = new BrowserController(new Context(), failing)
    for (const operation of [
      () => subject.navigate('https://example.com/'),
      () => subject.click('e1'),
      () => subject.type('e1', 'x'),
      () => subject.pressKey('Enter', []),
      () => subject.snapshot(),
      () => subject.screenshot(),
    ]) {
      await expect(operation()).rejects.toThrow(expect.objectContaining({ code: 'BROWSER_FAILURE' }))
    }
  })

  it('captures a screenshot through the persistent page', async () => {
    const { controller } = await mountController()
    const bytes = await controller.screenshot()
    expect(bytes).toBeInstanceOf(Uint8Array)
  })

  it('disposes the browser and clears the last snapshot through the fiber effect', async () => {
    const ctx = new Context()
    const page = fakePage({ snapshot: '- button "Go" [ref=e3]' })
    const browser = fakeBrowser(page)
    const subject = new BrowserController(ctx, browser)
    await subject.snapshot()
    expect(subject.peekLastSnapshot()).toContain('[ref=e3]')
    await ctx.fiber.dispose()
    expect(subject.peekLastSnapshot()).toBeUndefined()
  })
})

describe('browser tools', () => {
  let ctx: Context

  beforeEach(async () => {
    ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
  })

  it('registers the core tools and the screenshot tool with attachments', async () => {
    const controller = new BrowserController(ctx, fakeBrowser(fakePage()))
    applyBrowserTools(ctx, controller)
    applyScreenshotTool(ctx, controller)
    expect(ctx.tools.schemas().map(s => s.name)).toEqual(expect.arrayContaining([
      'browser_navigate', 'browser_click', 'browser_type', 'browser_press_key', 'browser_snapshot', 'browser_screenshot',
    ]))
  })

  it('omits browser_screenshot without attachments', async () => {
    const controller = new BrowserController(ctx, fakeBrowser(fakePage()))
    applyBrowserTools(ctx, controller)
    const names = ctx.tools.schemas().map(s => s.name)
    expect(names).toContain('browser_snapshot')
    expect(names).not.toContain('browser_screenshot')
  })

  it('formats a snapshot output with url/title envelope', () => {
    const text = formatSnapshotOutput({ snapshot: '- heading "Hi"', url: 'https://a.test/', title: 'A' })
    expect(text).toContain('<url>https://a.test/</url>')
    expect(text).toContain('<title>A</title>')
    expect(text).toContain('- heading "Hi"')
  })

  it('keeps name/inject/Config through the real Loader unwrap', () => {
    expect('default' in BrowserPlugin).toBe(false)
    expect(BrowserPlugin.name).toBe('browser')
    expect(BrowserPlugin.inject).toEqual(['tools', 'systemPrompt'])
    expect(typeof BrowserPlugin.apply).toBe('function')
  })

  it('browser_navigate executes through the controller', async () => {
    const controller = new BrowserController(ctx, fakeBrowser(fakePage()))
    applyBrowserTools(ctx, controller)
    const result = await callTool(ctx, 'browser_navigate', { url: 'https://example.com/' })
    expect(result.isError).toBe(false)
  })

  it('rejects a stale ref in browser_click before touching the page', async () => {
    const page = fakePage({ snapshot: '- button "Go" [ref=e3]' })
    const controller = new BrowserController(ctx, fakeBrowser(page))
    applyBrowserTools(ctx, controller)
    await controller.snapshot()
    const result = await callTool(ctx, 'browser_click', { ref: 'e999' })
    expect(result.isError).toBe(true)
    expect(page.recorder.locatorCalls).not.toContain('aria-ref=e999')
  })

  it('rejects a navigation to a non-http(s) URL as a structured error', async () => {
    const controller = new BrowserController(ctx, fakeBrowser(fakePage()))
    applyBrowserTools(ctx, controller)
    const result = await callTool(ctx, 'browser_navigate', { url: 'file:///etc/passwd' })
    expect(result.isError).toBe(true)
  })

  it('validates browser_press_key modifiers', async () => {
    const controller = new BrowserController(ctx, fakeBrowser(fakePage()))
    applyBrowserTools(ctx, controller)
    const bad = await callTool(ctx, 'browser_press_key', { key: 'Enter', modifiers: ['Hyper'] })
    expect(bad.isError).toBe(true)
    const good = await callTool(ctx, 'browser_press_key', { key: 'Enter', modifiers: ['control'] })
    expect(good.isError).toBe(false)
  })
})
