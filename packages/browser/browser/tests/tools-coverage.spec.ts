/**
 * Coverage completion for the browser tools module: exercises the full
 * applyBrowserTools/applyScreenshotTool registration surface, the pinned
 * model-facing renderers (snapshot envelope, screenshot envelope), the
 * browser_press_key modifier validation, and the screenshot route gate —
 * all against the in-memory fake, matching the unit lane's keyless contract.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { ToolCallId, LlmAdapter, LlmRuntime } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, LlmModelInfo, LlmResolvedModelInfo, StreamChunk } from '@deepseek-ai/dsh-llm'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import type { ImageAttachmentRef, ImageMediaType } from '@deepseek-ai/dsh-attachment'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { BrowserController, BrowserError } from '@deepseek-ai/dsh-browser'
import type { BrowserLike } from '@deepseek-ai/dsh-browser'
import * as BrowserPlugin from '@deepseek-ai/dsh-browser'
import { applyBrowserTools, applyScreenshotTool, formatSnapshotOutput, SNAPSHOT_FOOTER } from '../src/tools.ts'
import type { Page } from 'playwright'

/** One 1x1 PNG for the screenshot path (valid signature + IHDR). */
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64')

/** Exact-route fake adapter; stream is unreachable in these tests. */
class VisionAdapter extends LlmAdapter {
  constructor(private readonly models: LlmModelInfo[]) {
    super()
  }

  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    const resolved = this.models.find(candidate => candidate.id === model)
    return Promise.resolve({
      provider,
      id: model,
      name: resolved?.name ?? model,
      ...resolved?.inputModalities === undefined ? {} : { inputModalities: [...resolved.inputModalities] },
    })
  }

  override stream(_options: GenerateOptions): AsyncIterable<StreamChunk> {
    throw new Error('browser tool tests never stream')
  }
}

/** A fake calling agent pinned to one routed provider/model. */
function agentOn(model: string | undefined, provider = 'visual'): object {
  return {
    options: {},
    session: {
      header: { cwd: process.cwd() },
      requestHeader: () => (model === undefined ? undefined : { config: { provider, model } }),
      append: () => undefined,
    },
  }
}

/** Page stand-in whose screenshot returns the fixed PNG. */
function pngPage(): Page {
  return {
    goto: async () => undefined,
    title: async () => 'PNG page',
    url: () => 'https://png.test/',
    ariaSnapshot: async () => '- heading "PNG" [ref=e1]',
    locator: () => ({ click: async () => undefined, fill: async () => undefined }),
    keyboard: { down: async () => undefined, up: async () => undefined, press: async () => undefined },
    screenshot: async () => Buffer.from(PNG_1X1),
    isClosed: () => false,
    close: async () => undefined,
  } as unknown as Page
}

function fakeBrowser(page: Page): BrowserLike {
  return { run: async body => body(page), close: async () => undefined }
}

/** Minimal in-memory attachment store: records one PNG and replays its dims. */
class MemoryAttachmentStore extends Object {
  saved: ImageAttachmentRef | undefined

  imageLimits = Object.freeze({
    maxImageBytes: 1_000_000,
    maxImagesPerMessage: 1,
    maxMessageImageBytes: 1_000_000,
    maxImagePixels: 10_000_000,
    mediaTypes: Object.freeze(['image/png'] as const),
  })

  saveImage(input: { data: Uint8Array; mediaType: ImageMediaType; name?: string }): Promise<ImageAttachmentRef> {
    this.saved = {
      attachmentId: AttachmentId('test-attachment'),
      mediaType: input.mediaType,
      bytes: input.data.byteLength,
      width: 1,
      height: 1,
      ...input.name === undefined ? {} : { name: input.name },
    }
    return Promise.resolve(this.saved)
  }
}

let ctx: Context
let controller: BrowserController
let attachments: MemoryAttachmentStore
let counter = 0
const toolSignal = new AbortController().signal

function callTool(name: string, args: unknown, agent?: object) {
  return ctx.tools.execute({
    signal: toolSignal,
    callId: ToolCallId(`tool-cov-call-${++counter}`),
    name,
    arguments: args,
    ...agent ? { agent: agent as never } : {},
  })
}

beforeEach(async () => {
  ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(LlmRuntime)
  ctx.llm.registerAdapter(['visual'], new VisionAdapter([
    { provider: 'visual', id: 'vision-model', name: 'Vision', inputModalities: ['text', 'image'] },
    { provider: 'visual', id: 'text-model', name: 'Text', inputModalities: ['text'] },
  ]))
  // The attachment seam is registered directly on ctx so ctx.get('attachments')
  // resolves; its methods are our in-memory recorder.
  attachments = new MemoryAttachmentStore()
  await ctx.plugin(function memoryAttachments(inner: Context): void {
    inner.provide('attachments', attachments)
  })
  controller = new BrowserController(ctx, fakeBrowser(pngPage()))
  applyBrowserTools(ctx, controller)
  applyScreenshotTool(ctx, controller)
})

afterEach(async () => {
  await ctx.fiber.dispose()
})

describe('browser tools registration surface', () => {
  it('registers the core six tools and the screenshot tool together', () => {
    const names = ctx.tools.schemas().map(s => s.name)
    expect(names).toEqual(expect.arrayContaining([
      'browser_navigate', 'browser_click', 'browser_type', 'browser_press_key', 'browser_snapshot', 'browser_screenshot',
    ]))
    // Every tool classifies as exclusive (concurrency-unsafe) through the
    // registry's scheduling-mode resolver.
    const all = ['browser_navigate', 'browser_click', 'browser_type', 'browser_press_key', 'browser_snapshot', 'browser_screenshot']
    for (const name of all) {
      expect(ctx.tools.executionMode({ signal: toolSignal, callId: ToolCallId(`mode-${name}`), name, arguments: {} }).kind).toBe('exclusive')
    }
  })

  it('registers the guidance prompt section', async () => {
    const assembly = await ctx.systemPrompt.assemble()
    expect(assembly.sections.map(s => s.name)).toContain('tool:browser')
  })

  it('runs browser_snapshot through the registry and formats the envelope', async () => {
    const result = await callTool('browser_snapshot', {})
    expect(result.isError).toBe(false)
    const text = result.content.map(b => b.type === 'text' ? b.text : '').join('')
    expect(text).toContain('<url>https://png.test/</url>')
    expect(text).toContain('<title>PNG page</title>')
    expect(text).toContain('- heading "PNG" [ref=e1]')
    expect(text).toContain(SNAPSHOT_FOOTER)
  })

  it('appends the truncation notice for an oversized snapshot', async () => {
    const longCtx = new Context()
    await longCtx.plugin(SystemPrompt)
    await longCtx.plugin(ToolRuntime)
    const page = pngPage()
    ;(page as unknown as { ariaSnapshot: () => Promise<string> }).ariaSnapshot = async () => 'x'.repeat(200_001)
    const longController = new BrowserController(longCtx, fakeBrowser(page))
    applyBrowserTools(longCtx, longController)
    const result = await callToolWith(longCtx, 'browser_snapshot', {})
    expect(result.isError).toBe(false)
    const text = result.content.map(b => b.type === 'text' ? b.text : '').join('')
    expect(text).toContain('Snapshot truncated')
    await longCtx.fiber.dispose()
  })

  it('formats a snapshot output with url/title envelope', () => {
    const text = formatSnapshotOutput({ snapshot: '- heading "Hi"', url: 'https://a.test/', title: 'A' })
    expect(text).toContain('<url>https://a.test/</url>')
    expect(text).toContain('<title>A</title>')
    expect(text).toContain('- heading "Hi"')
  })

  it('browser_press_key rejects unknown modifiers and accepts case-insensitive ones', async () => {
    const bad = await callTool('browser_press_key', { key: 'Enter', modifiers: ['Hyper'] })
    expect(bad.isError).toBe(true)
    const good = await callTool('browser_press_key', { key: 'Enter', modifiers: ['control', 'SHIFT'] })
    expect(good.isError).toBe(false)
    // Duplicate modifier spellings collapse to one held key.
    const dup = await callTool('browser_press_key', { key: 'Enter', modifiers: ['Control', 'control'] })
    expect(dup.isError).toBe(false)
    // A blank key is refused by argument validation.
    const blank = await callTool('browser_press_key', { key: '   ' })
    expect(blank.isError).toBe(true)
  })

  it('browser_navigate rejects non-http(s) URLs as structured failures', async () => {
    const result = await callTool('browser_navigate', { url: 'file:///etc/passwd' })
    expect(result.isError).toBe(true)
  })

  it('rejects a stale ref in browser_click', async () => {
    await controller.snapshot()
    const result = await callTool('browser_click', { ref: 'e999' })
    expect(result.isError).toBe(true)
  })

  it('runs browser_click and browser_type against valid refs', async () => {
    await controller.snapshot()
    const click = await callTool('browser_click', { ref: 'e1' })
    expect(click.isError).toBe(false)
    const type = await callTool('browser_type', { ref: 'e1', text: 'hi' })
    expect(type.isError).toBe(false)
  })
})

describe('browser_screenshot', () => {
  it('captures a screenshot and returns the image block with attachment', async () => {
    const result = await callTool('browser_screenshot', {}, agentOn('vision-model'))
    expect(result.isError).toBe(false)
    const imageBlocks = result.content.filter(b => b.type === 'image')
    expect(imageBlocks).toHaveLength(1)
    expect(attachments.saved?.attachmentId).toBe('test-attachment')
    const text = result.content.filter(b => b.type === 'text').map(b => b.type === 'text' ? b.text : '').join('')
    expect(text).toContain('image/png')
  })

  it('refuses a screenshot for a text-only route', async () => {
    const result = await callTool('browser_screenshot', {}, agentOn('text-model'))
    expect(result.isError).toBe(true)
  })

  it('refuses a screenshot when no route can be resolved', async () => {
    const result = await callTool('browser_screenshot', {}, agentOn(undefined))
    expect(result.isError).toBe(true)
  })

  it('refuses a screenshot when no attachment service is mounted', async () => {
    const bare = new Context()
    await bare.plugin(SystemPrompt)
    await bare.plugin(ToolRuntime)
    const bareController = new BrowserController(bare, fakeBrowser(pngPage()))
    applyScreenshotTool(bare, bareController)
    const result = await callToolWith(bare, 'browser_screenshot', {}, agentOn('vision-model'))
    expect(result.isError).toBe(true)
    await bare.fiber.dispose()
  })
})

describe('browser plugin apply', () => {
  it('mounts through the real plugin entry with and without attachments', async () => {
    // Without attachments: five core tools, no screenshot.
    const bare = new Context()
    await bare.plugin(SystemPrompt)
    await bare.plugin(ToolRuntime)
    await bare.plugin(BrowserPlugin)
    expect(bare.tools.schemas().map(s => s.name)).toEqual(expect.arrayContaining([
      'browser_navigate', 'browser_click', 'browser_type', 'browser_press_key', 'browser_snapshot',
    ]))
    expect(bare.tools.schemas().map(s => s.name)).not.toContain('browser_screenshot')
    await bare.fiber.dispose()

    // With attachments mounted first: the screenshot tool joins.
    const withStore = new Context()
    await withStore.plugin(SystemPrompt)
    await withStore.plugin(ToolRuntime)
    const store = new MemoryAttachmentStore()
    await withStore.plugin(function memoryAttachments(inner: Context): void {
      inner.provide('attachments', store)
    })
    await withStore.plugin(BrowserPlugin)
    expect(withStore.tools.schemas().map(s => s.name)).toContain('browser_screenshot')
    await withStore.fiber.dispose()
  })
})

/** Dispatch through a specific context (the shared counter stays global). */
function callToolWith(target: Context, name: string, args: unknown, agent?: object) {
  return target.tools.execute({
    signal: toolSignal,
    callId: ToolCallId(`tool-cov-call-${++counter}`),
    name,
    arguments: args,
    ...agent ? { agent: agent as never } : {},
  })
}

/** Guard that a BrowserError remains instanceof Error through the pipeline. */
void BrowserError
