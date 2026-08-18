/**
 * Real-Chromium end-to-end coverage: the shipped `PlaywrightBrowser` driving
 * the Playwright-managed Chromium through the tool registry, including the
 * aria-ref interaction loop (snapshot → click → snapshot) and the screenshot
 * attachment path. Skips itself when no browser binary is available (no
 * Playwright Chromium install), so the unit suite stays the keyless contract.
 */

import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { CallId, LlmAdapter, LlmRuntime } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, LlmModelInfo, LlmResolvedModelInfo, StreamChunk } from '@deepseek-ai/dsh-llm'
import LocalAttachmentStore from '@deepseek-ai/dsh-attachment-local'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { BrowserController, PlaywrightBrowser } from '@deepseek-ai/dsh-browser'
import { applyBrowserTools, applyScreenshotTool } from '../src/tools.ts'

/** Playwright's chromium lookup roots; presence proves a binary without launching. */
function chromiumInstalled(): boolean {
  const candidates = [
    join(homedir(), 'Library', 'Caches', 'ms-playwright'),
    join(homedir(), '.cache', 'ms-playwright'),
  ]
  return candidates.some(root => existsSync(root))
}

const maybe = chromiumInstalled() ? describe : describe.skip

/** Exact-route fake adapter; `stream` is unreachable in these tests. */
class CatalogAdapter extends LlmAdapter {
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
    throw new Error('browser chromium tests never stream')
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

const testToolSignal = new AbortController().signal

let server: Server
let base: string
let handler: (req: IncomingMessage, res: ServerResponse) => void

let ctx: Context
let counter = 0
function callTool(name: string, args: unknown, agent?: object) {
  return ctx.tools.execute({
    signal: testToolSignal,
    callId: CallId(`browser-call-${++counter}`),
    name,
    arguments: args,
    ...agent ? { agent: agent as never } : {},
  })
}

maybe('browser tools over real Chromium', () => {
  beforeAll(async () => {
    handler = (_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end('<html><body><h1>Hello</h1><button id="go" onclick="document.title=\'clicked\'">Go</button><input id="name" placeholder="Name"></body></html>')
    }
    server = createServer((req, res) => { handler(req, res) })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

    ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    // dshHome points into a temp dir so the e2e never writes the real home.
    await ctx.plugin(LocalAttachmentStore, { dshHome: join(process.cwd(), 'node_modules/.tmp-browser-e2e') })
    await ctx.plugin(LlmRuntime)
    ctx.llm.registerAdapter(['visual'], new CatalogAdapter([
      { provider: 'visual', id: 'vision-model', name: 'Vision', inputModalities: ['text', 'image'] },
    ]))
    const controller = new BrowserController(ctx, new PlaywrightBrowser('chromium', true))
    applyBrowserTools(ctx, controller)
    applyScreenshotTool(ctx, controller)
  })

  afterAll(async () => {
    // The service disposal effects (browser close) run on context teardown;
    // the persistent page is closed by the plugin's effect.
    await new Promise<void>(resolve => server.close(() => { resolve() }))
  })

  it('navigates, snapshots, clicks by ref, and observes the effect', async () => {
    const nav = await callTool('browser_navigate', { url: base })
    expect(nav.isError).toBe(false)

    const snap = await callTool('browser_snapshot', {})
    expect(snap.isError).toBe(false)
    const text = snap.content.map(block => block.type === 'text' ? block.text : '').join('')
    expect(text).toContain('heading "Hello"')
    expect(text).toContain('[ref=')

    const buttonRef = /button "Go" \[ref=([^\]]+)\]/.exec(text)?.[1]
    expect(buttonRef).toBeDefined()
    const click = await callTool('browser_click', { ref: buttonRef })
    expect(click.isError).toBe(false)

    // The page title flips only if the real click fired the onclick handler.
    const after = await callTool('browser_snapshot', {})
    const afterText = after.content.map(block => block.type === 'text' ? block.text : '').join('')
    expect(afterText).toContain('clicked')
  })

  it('types into a referenced text field and the page reports it', async () => {
    const snap = await callTool('browser_snapshot', {})
    const text = snap.content.map(block => block.type === 'text' ? block.text : '').join('')
    const inputRef = /textbox "Name" \[ref=([^\]]+)\]/.exec(text)?.[1]
    expect(inputRef).toBeDefined()
    const typed = await callTool('browser_type', { ref: inputRef, text: 'hello world' })
    expect(typed.isError).toBe(false)

    // The fill is observable by the page itself (no navigation needed).
    const check = await callTool('browser_snapshot', {})
    const checkText = check.content.map(block => block.type === 'text' ? block.text : '').join('')
    expect(checkText).toContain('hello world')
  })

  it('captures a screenshot with the image attachment block', async () => {
    const shot = await callTool('browser_screenshot', {}, agentOn('vision-model'))
    expect(shot.isError).toBe(false)
    const imageBlocks = shot.content.filter(block => block.type === 'image')
    expect(imageBlocks).toHaveLength(1)
    const text = shot.content.filter(block => block.type === 'text').map(block => block.type === 'text' ? block.text : '').join('')
    expect(text).toContain('image/png')
  })

  it('refuses a screenshot for a text-only route', async () => {
    const shot = await callTool('browser_screenshot', {}, agentOn('missing-model'))
    expect(shot.isError).toBe(true)
  })
})
